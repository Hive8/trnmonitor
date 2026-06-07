import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:intl/intl.dart';
import '../services/record_service.dart';
import '../services/stream_service.dart';
import 'video_player_screen.dart';
import 'admin_feed_screen.dart';
import 'package:path_provider/path_provider.dart';
import 'login_screen.dart';
import 'chat_users_screen.dart';
import 'package:geolocator/geolocator.dart';

// Styling Color Tokens
const Color emeraldColor = Color(0xFF10B981);
const Color slateColor = Color(0xFF64748B);
const Color slateAwayColor = Color(0xFF94A3B8);
const Color slateDivideColor = Color(0xFF334155);

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with WidgetsBindingObserver {
  final GlobalKey _repaintBoundaryKey = GlobalKey();
  final RecordService _recordService = RecordService();
  final StreamService _streamService = StreamService();
  
  // Stream Subscriptions
  StreamSubscription<bool>? _connectionSubscription;
  StreamSubscription<Map<String, dynamic>>? _commandSubscription;

  // Connection Configuration
  String _serverIp = '192.168.10.60:3000'; // Default to localhost (resolved via adb reverse or simulator)
  final TextEditingController _ipController = TextEditingController();
  
  bool _isClockedIn = false;
  List<File> _recordings = [];
  
  // Timers and Stats
  Timer? _statsTimer;
  Timer? _gpsTimer;
  String _elapsedTimeString = '00:00:00';
  String _fileSizeString = '0.0 MB';
  bool _isConnecting = false;
  
  // Dynamic Capture Settings
  int _targetFps = 5;
  String _targetResolution = '720x1600';

  double _getPixelRatioFromResolution(String resolution) {
    switch (resolution) {
      case '1080x2400':
        return 1.0;
      case '720x1600':
        return 0.6;
      case '480x1066':
        return 0.4;
      case '360x800':
        return 0.3;
      default:
        return 0.6;
    }
  }

  // Server Discovery
  static const int _discoveryPort = 4001;
  RawDatagramSocket? _discoverySocket;
  bool _isDiscovering = false;
  final Map<String, String> _discoveredServers = {}; // addr -> name

  String get _httpBackendUrl => 'http://$_serverIp';
  String get _wsBackendUrl => 'ws://$_serverIp';

  String _employeeId = '';
  String _employeeName = 'Loading...';
  String _employeeEmail = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ipController.text = _serverIp;
    _loadEmployeeInfo();
    _loadRecordings();

    // Subscribe to connection changes
    _connectionSubscription = _streamService.connectionStatusStream.listen((connected) {
      if (connected) {
        _streamService.sendStatus(_isClockedIn);
        _sendDeviceRecordings();
        if (_isClockedIn) {
          _streamService.startStreaming(
            _repaintBoundaryKey,
            intervalMs: 1000 ~/ _targetFps,
            pixelRatio: _getPixelRatioFromResolution(_targetResolution),
          );
        }
      }
      if (mounted) {
        setState(() {});
      }
    });

    // Subscribe to admin commands
    _commandSubscription = _streamService.commandStream.listen((payload) {
      _handleAdminCommand(payload);
    });
  }

  Future<void> _loadEmployeeInfo() async {
    try {
      final docDir = await getApplicationDocumentsDirectory();
      final file = File('${docDir.path}/employee_info.json');
      if (await file.exists()) {
        final content = await file.readAsString();
        final data = jsonDecode(content);
        if (data != null && data['email'] != null) {
          setState(() {
            _employeeId = data['id']?.toString() ?? '';
            _employeeName = '${data['firstName']} ${data['lastName']}';
            _employeeEmail = data['email'];
            if (data['serverIp'] != null) {
              _serverIp = data['serverIp'];
              _ipController.text = _serverIp;
            }
          });
          // Automatically connect on startup using the correct server IP
          _connectWebSocket();
          return;
        }
      }
    } catch (e) {
      print('Error loading employee info: $e');
    }
    // If not logged in, redirect to login screen
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  Future<void> _logout() async {
    if (_isClockedIn) {
      await _clockOut();
    }
    _streamService.disconnect();
    try {
      final docDir = await getApplicationDocumentsDirectory();
      final file = File('${docDir.path}/employee_info.json');
      if (await file.exists()) {
        await file.delete();
      }
    } catch (e) {
      print('Error during logout file deletion: $e');
    }
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  void _showLogoutConfirmationDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Logout', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Are you sure you want to logout and disconnect this device?',
          style: TextStyle(color: Color(0xFF94A3B8)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              _logout();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connectionSubscription?.cancel();
    _commandSubscription?.cancel();
    _statsTimer?.cancel();
    _gpsTimer?.cancel();
    _ipController.dispose();
    _streamService.dispose();
    _stopServerDiscovery();
    super.dispose();
  }

  // ── Server Discovery ──────────────────────────────────────────
  Future<void> _startServerDiscovery(void Function(VoidCallback) safeSetDialogState) async {
    if (_isDiscovering) return;
    _discoveredServers.clear();
    safeSetDialogState(() => _isDiscovering = true);
    try {
      _discoverySocket = await RawDatagramSocket.bind(
        InternetAddress.anyIPv4,
        _discoveryPort,
        reuseAddress: true,
      );
      _discoverySocket!.broadcastEnabled = true;
      _discoverySocket!.listen((RawSocketEvent event) {
        if (event == RawSocketEvent.read) {
          final dg = _discoverySocket?.receive();
          if (dg == null) return;
          try {
            final data = jsonDecode(utf8.decode(dg.data)) as Map<String, dynamic>;
            if (data['service'] == 'screen_recorder_admin') {
              final addr = '${dg.address.address}:${data['port']}';
              final name = data['name']?.toString() ?? 'Admin Server';
              safeSetDialogState(() => _discoveredServers[addr] = name);
            }
          } catch (_) {}
        }
      });
      // Auto-stop after 15 seconds
      Future.delayed(const Duration(seconds: 15), () {
        _stopServerDiscovery();
        safeSetDialogState(() => _isDiscovering = false);
      });
    } catch (e) {
      print('Discovery error: $e');
      safeSetDialogState(() => _isDiscovering = false);
    }
  }

  void _stopServerDiscovery() {
    _discoverySocket?.close();
    _discoverySocket = null;
    if (mounted) setState(() => _isDiscovering = false);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    print('App lifecycle state changed: $state');
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // Pause streaming when app is backgrounded to prevent Vulkan driver crash
      _streamService.stopStreaming();
    } else if (state == AppLifecycleState.resumed) {
      // Resume streaming if clocked in (reconnect WebSocket first if disconnected)
      if (!_streamService.isConnected) {
        _connectWebSocket();
      } else if (_isClockedIn) {
        _streamService.startStreaming(
          _repaintBoundaryKey,
          intervalMs: 1000 ~/ _targetFps,
          pixelRatio: _getPixelRatioFromResolution(_targetResolution),
        );
      }
    }
  }

  Future<void> _loadRecordings() async {
    final list = await _recordService.getSavedRecordings();
    setState(() {
      _recordings = list;
    });
  }

  Future<void> _connectWebSocket() async {
    if (_isConnecting) return;
    setState(() {
      _isConnecting = true;
    });
    await _streamService.connect(_wsBackendUrl);
    if (mounted) {
      setState(() {
        _isConnecting = false;
      });
    }
  }

  Future<void> _reconnectWebSocket() async {
    _streamService.disconnect();
    await _connectWebSocket();
  }

  void _handleAdminCommand(Map<String, dynamic> payload) {
    print('Received admin command: $payload');
    final action = payload['action'];
    if (action == 'clock_in') {
      if (!_isClockedIn) {
        _clockIn();
      }
    } else if (action == 'clock_out') {
      if (_isClockedIn) {
        _clockOut();
      }
    } else if (action == 'get_status') {
      _streamService.sendStatus(_isClockedIn);
    } else if (action == 'get_recordings') {
      _sendDeviceRecordings();
    } else if (action == 'upload_file') {
      final path = payload['path'];
      if (path != null) {
        try {
          _uploadRecording(path.toString(), "On Device Sync");
        } catch (e) {
          print('Error calling _uploadRecording: $e');
        }
      }
    } else if (action == 'delete_recording') {
      final path = payload['path'];
      if (path != null) {
        _deleteRecording(path.toString());
      }
    } else if (action == 'simulate_key') {
      final key = payload['key'];
      _showKeySimulationFeedback(key);
      _executeNativeAction(key);
    } else if (action == 'update_settings') {
      final newFpsValue = payload['fps'];
      final newRes = payload['resolution'];
      if (newFpsValue != null && newRes != null) {
        final int? newFps = newFpsValue is int ? newFpsValue : int.tryParse(newFpsValue.toString());
        if (newFps != null) {
          setState(() {
            _targetFps = newFps;
            _targetResolution = newRes.toString();
          });
          print('Updated target settings: FPS=$_targetFps, Resolution=$_targetResolution');
          if (_isClockedIn && _streamService.isConnected) {
            _streamService.stopStreaming();
            _streamService.startStreaming(
              _repaintBoundaryKey,
              intervalMs: 1000 ~/ _targetFps,
              pixelRatio: _getPixelRatioFromResolution(_targetResolution),
            );
          }
        }
      }
    }
  }

  Future<void> _executeNativeAction(dynamic key) async {
    if (key == null) return;
    try {
      const MethodChannel channel = MethodChannel('com.example.screenrecorder.mobile_app/actions');
      final result = await channel.invokeMethod(key.toString());
      print('Native action result for $key: $result');
    } catch (e) {
      print('Failed to execute native action $key: $e');
    }
  }

  void _showKeySimulationFeedback(dynamic key) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.videogame_asset, color: Colors.white),
              const SizedBox(width: 8),
              Text('Admin simulated key: $key', style: const TextStyle(color: Colors.white)),
            ],
          ),
          backgroundColor: Colors.deepPurple,
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // Starts the recording and streaming
  Future<void> _clockIn() async {
    if (_isClockedIn) return;
    setState(() {
      _isConnecting = true;
    });

    // 1. Request permissions first
    bool permGranted = await _recordService.requestPermissions();
    if (!permGranted) {
      _showErrorSnackBar('Permissions denied. Please enable Microphone & Photo permissions.');
      setState(() {
        _isConnecting = false;
      });
      return;
    }

    // 2. Connect to the WebSocket stream (if not already connected)
    bool wsConnected = await _streamService.connect(_wsBackendUrl);
    if (!wsConnected) {
      _showErrorSnackBar('Unable to connect to WebSocket server at $_serverIp.');
      setState(() {
        _isConnecting = false;
      });
      return;
    }

    // 3. Start local screen recording
    bool recordStarted = await _recordService.startRecording(backendUrl: _httpBackendUrl);
    if (!recordStarted) {
      _showErrorSnackBar('Failed to initialize screen recording.');
      setState(() {
        _isConnecting = false;
      });
      return;
    }

    // 4. Start streaming UI frames
    _streamService.startStreaming(
      _repaintBoundaryKey,
      intervalMs: 1000 ~/ _targetFps,
      pixelRatio: _getPixelRatioFromResolution(_targetResolution),
    );
    _streamService.sendStatus(true);

    setState(() {
      _isClockedIn = true;
      _isConnecting = false;
      _elapsedTimeString = '00:00:00';
      _fileSizeString = '0.0 MB';
    });

    // Start timer for duration and file size tracking
    _startStatsTimer();
    _startGpsTimer();
  }

  // Stops recording and streaming
  Future<void> _clockOut() async {
    if (!_isClockedIn) return;
    setState(() {
      _isConnecting = true;
    });

    _statsTimer?.cancel();
    _gpsTimer?.cancel();
    _gpsTimer = null;
    _streamService.stopStreaming();
    _streamService.sendStatus(false);
    
    final durationStr = _elapsedTimeString;
    
    try {
      final String? savedPath = await _recordService.stopRecording(backendUrl: _httpBackendUrl);
      if (savedPath != null) {
        _showSuccessSnackBar('Screen recording saved to local phone.');
        _loadRecordings().then((_) {
          _sendDeviceRecordings();
        });
        _uploadRecording(savedPath, durationStr);
      } else {
        _showErrorSnackBar('Failed to save screen recording file.');
      }
    } catch (e) {
      print('Error during clock out: $e');
      _showErrorSnackBar('Error stopping screen recording: $e');
    } finally {
      setState(() {
        _isClockedIn = false;
        _isConnecting = false;
      });
    }
  }

  Future<String> _getVideoDuration(File file) async {
    try {
      if (!await file.exists()) {
        return '00:00:00';
      }
      final length = await file.length();
      if (length < 1000) {
        return '00:01:15'; // Default mock duration for mock files
      }
      final controller = VideoPlayerController.file(file);
      await controller.initialize();
      final duration = controller.value.duration;
      final hours = duration.inHours.toString().padLeft(2, '0');
      final minutes = (duration.inMinutes % 60).toString().padLeft(2, '0');
      final seconds = (duration.inSeconds % 60).toString().padLeft(2, '0');
      await controller.dispose();
      return '$hours:$minutes:$seconds';
    } catch (e) {
      print('Error reading video duration: $e');
      return '00:01:15'; // Fallback
    }
  }

  Future<void> _uploadRecording(String filePath, String duration) async {
    try {
      final file = File(filePath);
      final exists = await file.exists();
      if (!exists) {
        print('Upload failed: File does not exist at $filePath');
        return;
      }

      String resolvedDuration = duration;
      if (resolvedDuration == 'On Device Sync' || resolvedDuration == 'On Device' || resolvedDuration.isEmpty) {
        resolvedDuration = await _getVideoDuration(file);
      }

      final fileName = filePath.split('/').last;
      final deviceId = _streamService.deviceId;

      print('Uploading recording: $fileName, Duration: $resolvedDuration, Size: ${await file.length()} bytes');
      
      try {
        final client = HttpClient();
        client.connectionTimeout = const Duration(seconds: 25);
        final request = await client.postUrl(Uri.parse('$_httpBackendUrl/api/upload'));
        
        request.headers.set('content-type', 'application/octet-stream');
        request.headers.set('x-device-id', deviceId);
        request.headers.set('x-file-name', fileName);
        request.headers.set('x-duration', resolvedDuration);
        
        // Send timestamp formatted in ISO or custom string
        final formattedTime = DateFormat('MMM dd, yyyy hh:mm a').format(DateTime.now());
        request.headers.set('x-timestamp', formattedTime);

        final fileStream = file.openRead();
        await request.addStream(fileStream);
        
        final response = await request.close();
        if (response.statusCode == 200) {
          print('Upload complete for $fileName');
          _showSuccessSnackBar('Screen recording uploaded to admin dashboard.');
        } else {
          print('Upload failed with status code: ${response.statusCode}');
          _showErrorSnackBar('Upload failed: server returned status ${response.statusCode}');
        }
      } catch (e) {
        print('Error uploading recording: $e');
        _showErrorSnackBar('Upload failed: $e');
      }
    } catch (e) {
      print('Exception in _uploadRecording: $e');
    }
  }

  Future<void> _deleteRecording(String filePath) async {
    try {
      final file = File(filePath);
      final exists = await file.exists();
      if (!exists) {
        print('Delete failed: File does not exist at $filePath');
        _showErrorSnackBar('File not found on device.');
        return;
      }

      await file.delete();
      print('Successfully deleted file on device: $filePath');
      _showSuccessSnackBar('Recording deleted from device.');
      
      // Reload states and send updated list to admin
      await _loadRecordings();
      await _sendDeviceRecordings();
    } catch (e) {
      print('Error deleting recording on device: $e');
      _showErrorSnackBar('Error deleting recording: $e');
    }
  }

  Future<void> _sendDeviceRecordings() async {
    try {
      final list = await _recordService.getSavedRecordings();
      final List<Map<String, dynamic>> recordingsData = [];
      for (final file in list) {
        try {
          if (!await file.exists()) continue;
          final fileName = file.path.split('/').last;
          final length = await file.length();
          final sizeStr = '${(length / (1024 * 1024)).toStringAsFixed(1)} MB';
          final stat = file.statSync();
          final formattedTime = DateFormat('MMM dd, yyyy hh:mm a').format(stat.modified);
          final durationStr = await _getVideoDuration(file);
          recordingsData.add({
            'name': fileName,
            'size': sizeStr,
            'timestamp': formattedTime,
            'path': file.path,
            'duration': durationStr,
          });
        } catch (e) {
          print('Error processing recording file ${file.path}: $e');
        }
      }
      _streamService.sendDeviceRecordings(recordingsData);
    } catch (e) {
      print('Error sending device recordings: $e');
    }
  }

  void _startStatsTimer() {
    _statsTimer = Timer.periodic(const Duration(seconds: 1), (timer) async {
      if (!_isClockedIn || _recordService.startTime == null) {
        timer.cancel();
        return;
      }

      final duration = DateTime.now().difference(_recordService.startTime!);
      final hours = duration.inHours.toString().padLeft(2, '0');
      final minutes = (duration.inMinutes % 60).toString().padLeft(2, '0');
      final seconds = (duration.inSeconds % 60).toString().padLeft(2, '0');

      // Estimate file size (e.g., ~1.2 MB per minute for mock/compact video)
      double mbSize = 0.0;
      if (_recordService.isMock) {
        mbSize = (duration.inSeconds * 0.02); // Mock file sizes incrementing
      } else {
        if (_recordService.currentFilePath != null) {
          final file = File(_recordService.currentFilePath!);
          if (await file.exists()) {
            mbSize = await file.length() / (1024 * 1024);
          }
        }
      }

      if (mounted) {
        setState(() {
          _elapsedTimeString = '$hours:$minutes:$seconds';
          _fileSizeString = '${mbSize.toStringAsFixed(1)} MB';
        });
      }
    });
  }

  Future<bool> _handleLocationPermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _showErrorSnackBar('Location services are disabled. Please enable them.');
      return false;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _showErrorSnackBar('Location permissions are denied.');
        return false;
      }
    }
    
    if (permission == LocationPermission.deniedForever) {
      _showErrorSnackBar('Location permissions are permanently denied, we cannot request permissions.');
      return false;
    }

    return true;
  }

  Future<void> _startGpsTimer() async {
    _gpsTimer?.cancel();
    
    final hasPermission = await _handleLocationPermission();
    if (!hasPermission) {
      print('GPS tracking disabled: location permission not granted.');
      return;
    }

    // Capture first coordinate immediately
    _captureAndSendGps();

    // Start 60-second periodic timer
    _gpsTimer = Timer.periodic(const Duration(seconds: 60), (timer) {
      if (!_isClockedIn) {
        timer.cancel();
        return;
      }
      _captureAndSendGps();
    });
  }

  Future<void> _captureAndSendGps() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      _streamService.sendGpsUpdate(position.latitude, position.longitude);
    } catch (e) {
      print('Error capturing GPS position: $e');
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: Colors.redAccent.shade700,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: emeraldColor,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Wrap the entire screen content in the RepaintBoundary so we capture the UI state
    return RepaintBoundary(
      key: _repaintBoundaryKey,
      child: Scaffold(
        backgroundColor: const Color(0xFF0F172A), // Slate 900
        appBar: AppBar(
          backgroundColor: const Color(0xFF1E293B), // Slate 800
          elevation: 0,
          title: Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isClockedIn ? emeraldColor : Colors.red,
                  boxShadow: _isClockedIn
                      ? [
                          BoxShadow(
                            color: emeraldColor.withOpacity(0.5),
                            spreadRadius: 3,
                            blurRadius: 5,
                          )
                        ]
                      : [],
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'TRN Monitor',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.chat_bubble_outline_rounded, color: emeraldColor),
              tooltip: 'Chat with Management',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => ChatUsersScreen(
                      streamService: _streamService,
                      serverIp: _serverIp,
                      employeeName: _employeeName,
                      employeeId: _employeeId,
                    ),
                  ),
                );
              },
            ),
            IconButton(
              icon: const Icon(Icons.settings, color: slateAwayColor),
              onPressed: () => _showSettingsDialog(),
            ),
            IconButton(
              icon: const Icon(Icons.admin_panel_settings, color: Colors.cyan),
              tooltip: 'Admin Section',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => AdminFeedScreen(wsUrl: _wsBackendUrl),
                  ),
                );
              },
            ),
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
              tooltip: 'Logout / Switch User',
              onPressed: () => _showLogoutConfirmationDialog(),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Connection Banner
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                color: _streamService.isConnected
                    ? emeraldColor.withOpacity(0.1)
                    : Colors.amber.withOpacity(0.1),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _streamService.isConnected ? Icons.cloud_done : Icons.cloud_off,
                      color: _streamService.isConnected ? emeraldColor : Colors.amber,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _streamService.isConnected
                          ? 'Streaming to Admin at $_serverIp'
                          : 'Admin Feed Offline (Setup Server IP in Settings)',
                      style: TextStyle(
                        fontSize: 12,
                        color: _streamService.isConnected ? emeraldColor : Colors.amber,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),

              // 2. User Stats & Status Header
              Padding(
                padding: const EdgeInsets.all(24.0),
                child: Container(
                  padding: const EdgeInsets.all(24.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B), // Slate 800
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: _isClockedIn
                          ? emeraldColor.withOpacity(0.2)
                          : slateColor.withOpacity(0.1),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'EMPLOYEE NAME',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: slateAwayColor,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.0,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _employeeName,
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white.withValues(alpha: 0.95),
                                ),
                              ),
                              if (_employeeEmail.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  _employeeEmail,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: slateAwayColor,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: _isClockedIn
                                  ? emeraldColor.withOpacity(0.15)
                                  : Colors.red.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(100),
                            ),
                            child: Text(
                              _isClockedIn ? 'CLOCKED IN' : 'CLOCKED OUT',
                              style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: _isClockedIn ? emeraldColor : Colors.redAccent,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      const Divider(color: slateDivideColor, height: 1),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatColumn('DURATION', _elapsedTimeString, Icons.timer),
                          _buildStatColumn('STORAGE', _fileSizeString, Icons.sd_storage),
                          _buildStatColumn('ID', _streamService.deviceId, Icons.phonelink_setup),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // 3. Central Clock-In Toggle Button
              Expanded(
                child: Center(
                  child: _isConnecting
                      ? const CircularProgressIndicator(color: emeraldColor)
                      : GestureDetector(
                          onTap: _isClockedIn ? _clockOut : _clockIn,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            width: 180,
                            height: 180,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _isClockedIn ? const Color(0xFF064E3B) : const Color(0xFF1E293B),
                              border: Border.all(
                                color: _isClockedIn ? emeraldColor : const Color(0xFF475569),
                                width: 4,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: _isClockedIn
                                      ? emeraldColor.withOpacity(0.3)
                                      : Colors.black.withOpacity(0.3),
                                  blurRadius: 30,
                                  spreadRadius: _isClockedIn ? 8 : 2,
                                ),
                              ],
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  _isClockedIn ? Icons.power_settings_new : Icons.touch_app,
                                  size: 48,
                                  color: _isClockedIn ? emeraldColor : const Color(0xFFCBD5E1),
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  _isClockedIn ? 'CLOCK OUT' : 'CLOCK IN',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: _isClockedIn ? emeraldColor : const Color(0xFFCBD5E1),
                                    letterSpacing: 1.0,
                                  ),
                                ),
                                if (_isClockedIn) ...[
                                  const SizedBox(height: 4),
                                  const Text(
                                    'REC SCREEN',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: Colors.redAccent,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ]
                              ],
                            ),
                          ),
                        ),
                ),
              ),

              // 4. Local Recordings List
              Container(
                height: 250,
                decoration: const BoxDecoration(
                  color: Color(0xFF1E293B), // Slate 800
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(left: 24.0, right: 24.0, top: 20.0, bottom: 12.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Local Screen Video Logs',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          Icon(Icons.video_library, color: slateAwayColor, size: 20),
                        ],
                      ),
                    ),
                    const Divider(color: slateDivideColor, height: 1),
                    Expanded(
                      child: _recordings.isEmpty
                          ? Center(
                              child: Text(
                                'No screen recordings stored yet.\nClock in to begin recording.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: const Color(0xFF94A3B8),
                                  fontSize: 13,
                                  height: 1.5,
                                ),
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              itemCount: _recordings.length,
                              itemBuilder: (context, index) {
                                final file = _recordings[index];
                                final fileName = file.path.split('/').last;
                                final dateString = _formatFileDate(file);
                                
                                return Card(
                                  color: const Color(0xFF0F172A),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  margin: const EdgeInsets.symmetric(vertical: 6),
                                  child: ListTile(
                                    leading: const CircleAvatar(
                                      backgroundColor: Color(0xFF1E293B),
                                      child: Icon(Icons.videocam, color: emeraldColor),
                                    ),
                                    title: Text(
                                      fileName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    subtitle: Text(
                                      dateString,
                                      style: const TextStyle(
                                        color: Color(0xFF94A3B8),
                                        fontSize: 11,
                                      ),
                                    ),
                                    trailing: const Icon(Icons.play_arrow_rounded, color: emeraldColor),
                                    onTap: () {
                                      Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (context) => VideoPlayerScreen(videoFile: file),
                                        ),
                                      );
                                    },
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatColumn(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: slateAwayColor, size: 20),
        const SizedBox(height: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 9,
            color: slateAwayColor,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ],
    );
  }

  String _formatFileDate(File file) {
    try {
      final stat = file.statSync();
      return DateFormat('MMM dd, yyyy - hh:mm a').format(stat.modified);
    } catch (e) {
      return 'Unknown date';
    }
  }

  void _showSettingsDialog() {
    bool dialogMounted = true;
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            void safeSetDialogState(VoidCallback fn) {
              if (dialogMounted) {
                setDialogState(fn);
              }
            }

            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              title: const Text(
                'Connect to Server',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Manual IP entry
                    TextField(
                      controller: _ipController,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Server IP:Port',
                        hintText: 'e.g. 192.168.1.10:3000',
                        hintStyle: TextStyle(color: Color(0xFF475569)),
                        labelStyle: TextStyle(color: emeraldColor),
                        enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: slateAwayColor),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: emeraldColor),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Search button
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                            color: _isDiscovering ? emeraldColor : slateColor,
                          ),
                          foregroundColor: _isDiscovering ? emeraldColor : slateAwayColor,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                        icon: _isDiscovering
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: emeraldColor,
                                ),
                              )
                            : const Icon(Icons.wifi_find, size: 18),
                        label: Text(
                          _isDiscovering ? 'Scanning network...' : 'Search for Server',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                        onPressed: _isDiscovering
                            ? () {
                                _stopServerDiscovery();
                                safeSetDialogState(() {});
                              }
                            : () => _startServerDiscovery(safeSetDialogState),
                      ),
                    ),

                    // Discovered servers list
                    if (_discoveredServers.isNotEmpty) ...
                      [
                        const SizedBox(height: 12),
                        const Text(
                          'FOUND ON NETWORK',
                          style: TextStyle(
                            fontSize: 10,
                            color: slateAwayColor,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 6),
                        ...(_discoveredServers.entries.map((e) => GestureDetector(
                              onTap: () {
                                _ipController.text = e.key;
                                safeSetDialogState(() {});
                              },
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 6),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10),
                                decoration: BoxDecoration(
                                  color: _ipController.text == e.key
                                      ? emeraldColor.withOpacity(0.15)
                                      : const Color(0xFF0F172A),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: _ipController.text == e.key
                                        ? emeraldColor.withOpacity(0.5)
                                        : const Color(0xFF334155),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.dns_rounded,
                                      size: 16,
                                      color: _ipController.text == e.key
                                          ? emeraldColor
                                          : slateAwayColor,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            e.value,
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: _ipController.text == e.key
                                                  ? emeraldColor
                                                  : Colors.white,
                                            ),
                                          ),
                                          Text(
                                            e.key,
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: slateAwayColor,
                                              fontFamily: 'monospace',
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (_ipController.text == e.key)
                                      const Icon(Icons.check_circle,
                                          color: emeraldColor, size: 16),
                                  ],
                                ),
                              ),
                            ))),
                      ],

                    if (_isDiscovering && _discoveredServers.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(top: 12),
                        child: Text(
                          'Looking for servers on your WiFi network...',
                          style: TextStyle(color: slateAwayColor, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                      ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  child: const Text('Cancel', style: TextStyle(color: slateAwayColor)),
                  onPressed: () {
                    _stopServerDiscovery();
                    Navigator.of(context).pop();
                  },
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: emeraldColor),
                  child: const Text('Connect', style: TextStyle(color: Colors.white)),
                  onPressed: () {
                    _stopServerDiscovery();
                    setState(() {
                      _serverIp = _ipController.text.trim();
                    });
                    Navigator.of(context).pop();
                    _showSuccessSnackBar('Connecting to $_serverIp...');
                    _reconnectWebSocket();
                  },
                ),
              ],
            );
          },
        );
      },
    ).then((_) {
      dialogMounted = false;
      _stopServerDiscovery();
    });
  }
}
