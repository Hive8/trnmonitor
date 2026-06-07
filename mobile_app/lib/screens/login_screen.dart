import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../services/stream_service.dart';
import '../services/url_helper.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  
  bool _isLoading = false;
  bool _isPasswordVisible = false;
  String? _errorMessage;

  final StreamService _streamService = StreamService();
  RawDatagramSocket? _discoverySocket;
  String _discoveredServerIp = 'monitor.trnllc.com'; // Default fallback domain

  @override
  void initState() {
    super.initState();
    _startServerDiscovery();
  }

  Future<void> _startServerDiscovery() async {
    try {
      _discoverySocket = await RawDatagramSocket.bind(
        InternetAddress.anyIPv4,
        4001,
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
              print('Discovered server on login screen: $addr');
              if (mounted) {
                setState(() {
                  _discoveredServerIp = addr;
                });
              }
            }
          } catch (_) {}
        }
      });
    } catch (e) {
      print('Discovery error on login screen: $e');
    }
  }

  void _stopServerDiscovery() {
    _discoverySocket?.close();
    _discoverySocket = null;
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final serverIp = _discoveredServerIp.trim();

    try {
      // 1. Get Device ID
      final deviceId = await _streamService.initDeviceId();

      // 2. Fetch Device Info
      final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
      String deviceModel = 'Unknown Device';
      String osVersion = 'Unknown OS';

      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        deviceModel = androidInfo.model;
        osVersion = 'Android ${androidInfo.version.release}';
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        deviceModel = iosInfo.name;
        osVersion = 'iOS ${iosInfo.systemVersion}';
      } else if (Platform.isWindows) {
        final windowsInfo = await deviceInfo.windowsInfo;
        deviceModel = windowsInfo.computerName;
        osVersion = 'Windows ${windowsInfo.majorVersion}.${windowsInfo.minorVersion}';
      } else {
        deviceModel = Platform.operatingSystem;
        osVersion = Platform.operatingSystemVersion;
      }

      // 3. Make HTTP request to Server
      final url = Uri.parse('${UrlHelper.getHttpUrl(serverIp)}/api/employees/login');
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 8);

      final request = await client.postUrl(url);
      request.headers.set('content-type', 'application/json');

      final body = jsonEncode({
        'email': email,
        'password': password,
        'deviceId': deviceId,
        'deviceModel': deviceModel,
        'osVersion': osVersion,
      });

      request.write(body);
      final response = await request.close();

      final responseBodyString = await response.transform(utf8.decoder).join();
      final responseData = jsonDecode(responseBodyString) as Map<String, dynamic>;

      if (response.statusCode == 200 && responseData['success'] == true) {
        // Save to employee_info.json
        final employee = responseData['employee'] as Map<String, dynamic>;
        employee['serverIp'] = serverIp;

        final docDir = await getApplicationDocumentsDirectory();
        final file = File('${docDir.path}/employee_info.json');
        await file.writeAsString(jsonEncode(employee));

        // Navigate to Dashboard
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (context) => const DashboardScreen()),
          );
        }
      } else {
        setState(() {
          _errorMessage = responseData['error'] ?? 'Login failed. Check server connection.';
        });
      }
    } catch (e) {
      print('Login error: $e');
      setState(() {
        _errorMessage = 'Could not connect to server at $serverIp.\nMake sure the server is running and the IP address is correct.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _stopServerDiscovery();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 20.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // App Logo/Icon
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B), // Slate 800
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF10B981).withOpacity(0.2), // Emerald glow
                            blurRadius: 20,
                            spreadRadius: 2,
                          )
                        ],
                      ),
                      child: const Icon(
                        Icons.lock_person_rounded,
                        size: 48,
                        color: Color(0xFF10B981), // Emerald 500
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Titles
                  const Text(
                    'Employee Login',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Link your device and clock in to start recording',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF94A3B8), // Slate 400
                    ),
                  ),
                  const SizedBox(height: 36),

                  // Error Message
                  if (_errorMessage != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, color: Color(0xFFEF4444)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Email Input Field
                  const Text(
                    'EMAIL ADDRESS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'e.g. john.doe@example.com',
                      hintStyle: const TextStyle(color: Color(0xFF475569)),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      prefixIcon: const Icon(Icons.email_outlined, color: Color(0xFF64748B)),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFF10B981), width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your email';
                      }
                      if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value.trim())) {
                        return 'Please enter a valid email address';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),

                  // Password Input Field
                  const Text(
                    'PASSWORD',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B),
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: !_isPasswordVisible,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Enter your password',
                      hintStyle: const TextStyle(color: Color(0xFF475569)),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      prefixIcon: const Icon(Icons.lock_outlined, color: Color(0xFF64748B)),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _isPasswordVisible ? Icons.visibility : Icons.visibility_off,
                          color: const Color(0xFF64748B),
                        ),
                        onPressed: () {
                          setState(() {
                            _isPasswordVisible = !_isPasswordVisible;
                          });
                        },
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFF10B981), width: 1.5),
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      if (value.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),

                  // Discovered Server Status
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 24.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _discoveredServerIp.isNotEmpty ? const Color(0xFF10B981) : Colors.amber,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _discoveredServerIp.isNotEmpty 
                                ? 'Server: $_discoveredServerIp' 
                                : 'Searching for server...',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Login Button
                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981), // Emerald 500
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: const Color(0xFF10B981).withOpacity(0.5),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 4,
                      shadowColor: const Color(0xFF10B981).withOpacity(0.4),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Text(
                            'Connect & Link Device',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
