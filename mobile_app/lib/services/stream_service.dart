import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class StreamService {
  WebSocketChannel? _channel;
  Timer? _streamTimer;
  bool _isConnected = false;
  String? _deviceId;

  // Auto-reconnect configuration
  String? _lastWsUrl;
  bool _shouldReconnect = false;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;

  bool get isConnected => _isConnected;
  String get deviceId => _deviceId ?? 'Device-Unknown';

  Future<String> initDeviceId() async {
    if (_deviceId != null) return _deviceId!;
    try {
      final docDir = await getApplicationDocumentsDirectory();
      final file = File('${docDir.path}/device_id.txt');
      if (await file.exists()) {
        _deviceId = (await file.readAsString()).trim();
        print('Loaded persisted deviceId: $_deviceId');
      } else {
        _deviceId = 'Device-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
        await file.writeAsString(_deviceId!);
        print('Generated and persisted deviceId: $_deviceId');
      }

      // Persist to external storage files directory so the backend can read it via ADB on release builds
      try {
        final extDir = await getExternalStorageDirectory();
        if (extDir != null) {
          if (!await extDir.exists()) {
            await extDir.create(recursive: true);
          }
          final extFile = File('${extDir.path}/device_id.txt');
          await extFile.writeAsString(_deviceId!);
          print('Persisted deviceId to external storage: ${extFile.path}');
        }
      } catch (extError) {
        print('Error persisting deviceId to external storage: $extError');
      }
    } catch (e) {
      print('Error loading/generating deviceId: $e');
      _deviceId = 'Device-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
    }
    return _deviceId!;
  }

  // Stream controller to notify UI of connection status changes
  final StreamController<bool> _statusController = StreamController<bool>.broadcast();
  Stream<bool> get connectionStatusStream => _statusController.stream;

  // Stream controller for incoming commands
  final StreamController<Map<String, dynamic>> _commandController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get commandStream => _commandController.stream;

  // Connects to the WebSocket server as a device
  Future<bool> connect(String wsUrl) async {
    await initDeviceId();
    _lastWsUrl = wsUrl;
    _shouldReconnect = true;
    if (_isConnected) return true;

    final url = '$wsUrl?type=device&id=$deviceId';
    print('Connecting stream to: $url');

    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      
      // Listen to incoming messages (mainly for connection confirmation or command events)
      _channel!.stream.listen(
        (message) {
          print('Stream received message: $message');
          try {
            if (message is String) {
              final dynamic data = jsonDecode(message);
              if (data is Map<String, dynamic>) {
                _commandController.add(data);
              }
            }
          } catch (e) {
            print('Error parsing command message: $e');
          }
        },
        onDone: () {
          print('Stream WebSocket connection closed');
          _handleDisconnect();
        },
        onError: (err) {
          print('Stream WebSocket error: $err');
          _handleDisconnect();
        },
      );

      _isConnected = true;
      _statusController.add(true);
      _reconnectTimer?.cancel();
      _reconnectTimer = null;
      _startHeartbeat();
      return true;
    } catch (e) {
      print('WebSocket connection failed: $e');
      _handleDisconnect();
      return false;
    }
  }

  // Starts capturing frames from a RepaintBoundary and sending them over WebSocket
  void startStreaming(GlobalKey boundaryKey, {int intervalMs = 200, double pixelRatio = 0.6}) {
    if (!_isConnected || _channel == null) {
      print('Cannot start streaming: Not connected');
      return;
    }

    _streamTimer?.cancel();
    print('Starting screen stream at ${1000 ~/ intervalMs} fps (ratio: $pixelRatio)...');
    
    _streamTimer = Timer.periodic(Duration(milliseconds: intervalMs), (timer) async {
      print('Streaming timer tick: isConnected=$_isConnected, context=${boundaryKey.currentContext}');
      if (!_isConnected) {
        timer.cancel();
        return;
      }

      try {
        final RenderRepaintBoundary? boundary = 
            boundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
        
        if (boundary == null) return;
        
        // Check if size is set yet
        bool needsPaint = false;
        assert(() {
          needsPaint = boundary.debugNeedsPaint;
          return true;
        }());
        if (needsPaint) return;

        // Capture the boundary to a dart:ui image
        // pixelRatio keeps image size low for faster real-time streaming
        final ui.Image image = await boundary.toImage(pixelRatio: pixelRatio);
        
        // Convert to PNG byte data
        final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
        image.dispose(); // Prevent memory leaks

        if (byteData != null) {
          final Uint8List pngBytes = byteData.buffer.asUint8List();
          
          // Send raw binary PNG bytes to WebSocket server
          _channel!.sink.add(pngBytes);
        }
      } catch (e, stackTrace) {
        // Suppress repaint exceptions when widget is rendering or switching screens
        // but log other errors
        if (!e.toString().contains('debugNeedsPaint')) {
          print('Error capturing frame: $e\n$stackTrace');
        }
      }
    });
  }

  // Stops streaming frames
  void stopStreaming() {
    _streamTimer?.cancel();
    _streamTimer = null;
    print('Screen stream stopped');
  }

  // Disconnects from the WebSocket server
  void disconnect() {
    _shouldReconnect = false;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _stopHeartbeat();
    stopStreaming();
    if (_channel != null) {
      _channel!.sink.close();
      _channel = null;
    }
    _handleDisconnect();
  }

  void _handleDisconnect() {
    _isConnected = false;
    _statusController.add(false);
    _streamTimer?.cancel();
    _streamTimer = null;
    _stopHeartbeat();
    
    if (_shouldReconnect && _lastWsUrl != null) {
      _reconnectTimer?.cancel();
      _reconnectTimer = Timer(const Duration(seconds: 3), () {
        if (_shouldReconnect && _lastWsUrl != null) {
          print('Attempting automatic WebSocket reconnection...');
          connect(_lastWsUrl!);
        }
      });
    }
  }

  void sendStatus(bool isClockedIn) {
    if (!_isConnected || _channel == null) return;
    try {
      final msg = jsonEncode({
        'type': 'status',
        'deviceId': deviceId,
        'isClockedIn': isClockedIn,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
      _channel!.sink.add(msg);
      print('Sent status update: $msg');
    } catch (e) {
      print('Error sending status: $e');
    }
  }

  void sendDeviceRecordings(List<Map<String, dynamic>> recordings) {
    if (!_isConnected || _channel == null) return;
    try {
      final msg = jsonEncode({
        'type': 'device_recordings',
        'deviceId': deviceId,
        'recordings': recordings,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
      _channel!.sink.add(msg);
      print('Sent device recordings list: $msg');
    } catch (e) {
      print('Error sending device recordings: $e');
    }
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!_isConnected || _channel == null) {
        timer.cancel();
        return;
      }
      try {
        final heartbeatMsg = jsonEncode({
          'type': 'heartbeat',
          'deviceId': deviceId,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        });
        _channel!.sink.add(heartbeatMsg);
      } catch (e) {
        print('Error sending heartbeat: $e');
      }
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  void sendGpsUpdate(double latitude, double longitude) {
    if (!_isConnected || _channel == null) return;
    try {
      final msg = jsonEncode({
        'type': 'gps_update',
        'deviceId': deviceId,
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
      _channel!.sink.add(msg);
      print('Sent GPS update: $msg');
    } catch (e) {
      print('Error sending GPS update: $e');
    }
  }

  void dispose() {
    disconnect();
    _statusController.close();
    _commandController.close();
  }
}
