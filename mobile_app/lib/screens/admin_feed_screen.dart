import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class AdminFeedScreen extends StatefulWidget {
  final String wsUrl;
  const AdminFeedScreen({Key? key, required this.wsUrl}) : super(key: key);

  @override
  State<AdminFeedScreen> createState() => _AdminFeedScreenState();
}

class _AdminFeedScreenState extends State<AdminFeedScreen> {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  List<String> _activeDevices = [];
  
  // Maps deviceId -> last received screen frame bytes
  final Map<String, Uint8List> _deviceFrames = {};
  String? _selectedDevice;

  @override
  void initState() {
    super.initState();
    _connectToAdminWS();
  }

  @override
  void dispose() {
    _channel?.sink.close();
    super.dispose();
  }

  void _connectToAdminWS() {
    final url = '${widget.wsUrl}?type=admin';
    print('Admin connecting to: $url');

    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      
      _channel!.stream.listen(
        (message) {
          if (message is String) {
            // Text Message: Handle list and status updates
            _handleTextMessage(message);
          } else {
            // Binary Message: Handle screen stream frames
            _handleBinaryMessage(message);
          }
        },
        onDone: () {
          print('Admin WebSocket closed');
          if (mounted) {
            setState(() {
              _isConnected = false;
            });
          }
        },
        onError: (err) {
          print('Admin WebSocket error: $err');
          if (mounted) {
            setState(() {
              _isConnected = false;
            });
          }
        },
      );

      setState(() {
        _isConnected = true;
      });
    } catch (e) {
      print('Admin WebSocket connection error: $e');
      setState(() {
        _isConnected = false;
      });
    }
  }

  void _handleTextMessage(String message) {
    try {
      final Map<String, dynamic> data = jsonDecode(message);
      final type = data['type'];
      
      setState(() {
        if (type == 'device_list') {
          _activeDevices = List<String>.from(data['devices']);
        } else if (type == 'device_connected') {
          final devId = data['deviceId'] as String;
          if (!_activeDevices.contains(devId)) {
            _activeDevices.add(devId);
          }
        } else if (type == 'device_disconnected') {
          final devId = data['deviceId'] as String;
          _activeDevices.remove(devId);
          _deviceFrames.remove(devId);
          if (_selectedDevice == devId) {
            _selectedDevice = null;
          }
        }
      });
    } catch (e) {
      print('Failed to parse text message: $e');
    }
  }

  void _handleBinaryMessage(dynamic message) {
    try {
      final bytes = message as List<int>;
      if (bytes.isEmpty) return;

      // Extract length of device ID (header)
      final int idLength = bytes[0];
      if (bytes.length < 1 + idLength) return;

      // Extract device ID string
      final String deviceId = utf8.decode(bytes.sublist(1, 1 + idLength));
      
      // Extract binary frame bytes (PNG/JPEG image)
      final Uint8List frameBytes = Uint8List.fromList(bytes.sublist(1 + idLength));

      if (mounted) {
        setState(() {
          _deviceFrames[deviceId] = frameBytes;
          
          // Add to device list if not registered
          if (!_activeDevices.contains(deviceId)) {
            _activeDevices.add(deviceId);
          }
        });
      }
    } catch (e) {
      print('Failed parsing binary frame: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B), // Slate 800
        title: const Text(
          'Admin Live Streams',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF10B981)),
            onPressed: () {
              _channel?.sink.close();
              _connectToAdminWS();
            },
          )
        ],
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Connection banner
            Container(
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
              color: _isConnected ? const Color(0xFF10B981).withOpacity(0.1) : Colors.red.withOpacity(0.1),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _isConnected ? Icons.check_circle : Icons.error,
                    color: _isConnected ? const Color(0xFF10B981) : Colors.red,
                    size: 14,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _isConnected ? 'Connected to Stream Hub' : 'Disconnected. Reconnecting...',
                    style: TextStyle(
                      fontSize: 11,
                      color: _isConnected ? const Color(0xFF10B981) : Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            
            // Layout switcher (Active list or Selected device detail view)
            Expanded(
              child: _activeDevices.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.monitor_heart, color: const Color(0xFF475569), size: 64),
                          const SizedBox(height: 16),
                          Text(
                            'No active screens streaming.\nWaiting for clocked-in devices...',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 14, height: 1.5),
                          ),
                        ],
                      ),
                    )
                  : _selectedDevice != null
                      ? _buildStreamDetailView()
                      : _buildStreamsGridView(),
            ),
          ],
        ),
      ),
    );
  }

  // Grid view of all active streams
  Widget _buildStreamsGridView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.all(16.0),
          child: Text(
            'Clocked In Devices',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 0.65,
            ),
            itemCount: _activeDevices.length,
            itemBuilder: (context, index) {
              final deviceId = _activeDevices[index];
              final frame = _deviceFrames[deviceId];

              return GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedDevice = deviceId;
                  });
                },
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: frame != null
                            ? Image.memory(
                                frame,
                                fit: BoxFit.contain,
                                gaplessPlayback: true, // Prevents screen flickering
                              )
                            : Container(
                                color: Colors.black45,
                                child: const Center(
                                  child: CircularProgressIndicator(color: Color(0xFF10B981), strokeWidth: 2),
                                ),
                              ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(12),
                        color: const Color(0xFF0F172A),
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: Color(0xFF10B981),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                deviceId,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      )
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // Expanded details view of a single device stream
  Widget _buildStreamDetailView() {
    final deviceId = _selectedDevice!;
    final frame = _deviceFrames[deviceId];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Control Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: const Color(0xFF1E293B),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () {
                  setState(() {
                    _selectedDevice = null;
                  });
                },
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      deviceId,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const Text(
                      'Live Screen Feed',
                      style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(100),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.videocam, color: Color(0xFF10B981), size: 14),
                    SizedBox(width: 6),
                    Text(
                      'LIVE',
                      style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        
        // Large Stream Monitor
        Expanded(
          child: Container(
            color: Colors.black,
            alignment: Alignment.center,
            child: frame != null
                ? Image.memory(
                    frame,
                    fit: BoxFit.contain,
                    gaplessPlayback: true, // Prevents flickering
                  )
                : const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircularProgressIndicator(color: Color(0xFF10B981)),
                      SizedBox(height: 16),
                      Text(
                        'Buffering stream...',
                        style: TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}
