import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/stream_service.dart';
import '../services/url_helper.dart';

class ChatDetailScreen extends StatefulWidget {
  final StreamService streamService;
  final String serverIp;
  final String employeeId;
  final String otherUserId;
  final String otherUserName;
  final String otherUserRole;

  const ChatDetailScreen({
    Key? key,
    required this.streamService,
    required this.serverIp,
    required this.employeeId,
    required this.otherUserId,
    required this.otherUserName,
    required this.otherUserRole,
  }) : super(key: key);

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  final List<Map<String, dynamic>> _messages = [];
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  StreamSubscription<Map<String, dynamic>>? _commandSubscription;
  StreamSubscription<bool>? _connectionSubscription;
  bool _isLoading = true;
  bool _isSending = false;

  String get _httpBackendUrl => UrlHelper.getHttpUrl(widget.serverIp);

  @override
  void initState() {
    super.initState();
    _fetchMessageHistory();
    _setupWebSocketListeners();
  }

  @override
  void dispose() {
    _commandSubscription?.cancel();
    _connectionSubscription?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _setupWebSocketListeners() {
    // Listen for incoming messages via the shared WebSocket stream
    _commandSubscription = widget.streamService.commandStream.listen((payload) {
      if (payload['type'] == 'new_message') {
        final messageData = payload['message'];
        if (messageData != null) {
          final senderId = messageData['senderId'];
          final receiverId = messageData['receiverId'];

          // Verify if message belongs to this private chat conversation
          final isMine = (senderId == widget.employeeId && receiverId == widget.otherUserId) ||
                         (senderId == widget.otherUserId && receiverId == widget.employeeId);

          if (isMine) {
            setState(() {
              _messages.add(Map<String, dynamic>.from(messageData));
            });
            _scrollToBottom();
          }
        }
      }
    });

    // Listen for WebSocket status changes to refresh UI if connection state alters
    _connectionSubscription = widget.streamService.connectionStatusStream.listen((_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  Future<void> _fetchMessageHistory() async {
    try {
      final deviceId = widget.streamService.deviceId;
      final url = Uri.parse('$_httpBackendUrl/api/devices/messages?otherUserId=${widget.otherUserId}');
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 10);

      final request = await client.getUrl(url);
      request.headers.set('x-device-id', deviceId);

      final response = await request.close();
      final responseBodyString = await response.transform(utf8.decoder).join();
      final responseData = jsonDecode(responseBodyString) as Map<String, dynamic>;

      if (response.statusCode == 200 && responseData['success'] == true) {
        final List<dynamic> history = responseData['messages'] ?? [];
        setState(() {
          _messages.clear();
          for (var msg in history) {
            _messages.add(Map<String, dynamic>.from(msg));
          }
          _isLoading = false;
        });
        _scrollToBottom();
      } else {
        print('Failed to fetch messages: ${response.statusCode}');
        setState(() => _isLoading = false);
      }
    } catch (e) {
      print('Error fetching message history: $e');
      setState(() => _isLoading = false);
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() {
      _isSending = true;
    });

    try {
      final deviceId = widget.streamService.deviceId;
      final url = Uri.parse('$_httpBackendUrl/api/devices/messages');
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 10);

      final request = await client.postUrl(url);
      request.headers.set('content-type', 'application/json');
      request.headers.set('x-device-id', deviceId);

      request.write(jsonEncode({
        'receiverId': widget.otherUserId,
        'message': text
      }));
      
      final response = await request.close();
      final responseBodyString = await response.transform(utf8.decoder).join();
      final responseData = jsonDecode(responseBodyString) as Map<String, dynamic>;

      if (response.statusCode == 200 && responseData['success'] == true) {
        final newMessage = responseData['message'];
        setState(() {
          _messages.add(Map<String, dynamic>.from(newMessage));
          _messageController.clear();
          _isSending = false;
        });
        _scrollToBottom();
      } else {
        print('Failed to send message: ${response.statusCode}');
        _showErrorSnackBar('Failed to send message. Try again.');
        setState(() => _isSending = false);
      }
    } catch (e) {
      print('Error sending message: $e');
      _showErrorSnackBar('Network error. Unable to send.');
      setState(() => _isSending = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _showErrorSnackBar(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool isConnected = widget.streamService.isConnected;
    final bool isAdmin = widget.otherUserRole == 'superadmin' || widget.otherUserRole == 'admin';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B), // Slate 800
        elevation: 1,
        title: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isConnected ? const Color(0xFF10B981) : Colors.red,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.otherUserName,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    isAdmin ? 'Admin' : 'Staff',
                    style: TextStyle(
                      fontSize: 10,
                      color: isAdmin ? Colors.cyan : const Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Connection banner if offline
            if (!isConnected)
              Container(
                width: double.infinity,
                color: Colors.red.withValues(alpha: 0.15),
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 14),
                    SizedBox(width: 8),
                    Text(
                      'WebSocket offline. Real-time updates paused.',
                      style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),

            // Message list
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF10B981),
                      ),
                    )
                  : _messages.isEmpty
                      ? const Center(
                          child: Text(
                            'No messages yet.\nSend a message to start chatting.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 13, height: 1.5),
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.all(16),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final msg = _messages[index];
                            final isMe = msg['senderId'] == widget.employeeId;
                            final text = msg['message'] ?? '';
                            final timestamp = msg['timestamp'];

                            String timeString = '';
                            if (timestamp != null) {
                              try {
                                timeString = DateFormat('h:mm a').format(DateTime.parse(timestamp));
                              } catch (_) {}
                            }

                            // Optional Date Header
                            bool showDateHeader = false;
                            if (index == 0) {
                              showDateHeader = true;
                            } else {
                              final prevMsg = _messages[index - 1];
                              final prevTimestamp = prevMsg['timestamp'];
                              if (timestamp != null && prevTimestamp != null) {
                                try {
                                  final date1 = DateTime.parse(timestamp).toLocal();
                                  final date2 = DateTime.parse(prevTimestamp).toLocal();
                                  if (date1.day != date2.day || date1.month != date2.month || date1.year != date2.year) {
                                    showDateHeader = true;
                                  }
                                } catch (_) {}
                              }
                            }

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (showDateHeader && timestamp != null)
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    child: Center(
                                      child: Text(
                                        DateFormat('MMMM dd, yyyy').format(DateTime.parse(timestamp)),
                                        style: const TextStyle(
                                          color: Color(0xFF64748B),
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                                Align(
                                  alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                                  child: Container(
                                    margin: const EdgeInsets.symmetric(vertical: 4),
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: isMe ? const Color(0xFF10B981) : const Color(0xFF1E293B),
                                      borderRadius: BorderRadius.only(
                                        topLeft: const Radius.circular(16),
                                        topRight: const Radius.circular(16),
                                        bottomLeft: Radius.circular(isMe ? 16 : 0),
                                        bottomRight: Radius.circular(isMe ? 0 : 16),
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(alpha: 0.05),
                                          blurRadius: 4,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    constraints: BoxConstraints(
                                      maxWidth: MediaQuery.of(context).size.width * 0.75,
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          text,
                                          style: TextStyle(
                                            color: isMe ? Colors.white : const Color(0xFFF1F5F9),
                                            fontSize: 14,
                                            height: 1.3,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          mainAxisSize: MainAxisSize.min,
                                          mainAxisAlignment: MainAxisAlignment.end,
                                          children: [
                                            Text(
                                              timeString,
                                              style: TextStyle(
                                                color: isMe ? Colors.white70 : const Color(0xFF64748B),
                                                fontSize: 9,
                                                fontStyle: FontStyle.italic,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
            ),

            // Input panel
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                color: Color(0xFF1E293B), // Slate 800
                border: Border(
                  top: BorderSide(color: Color(0xFF334155), width: 1),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A), // Slate 900
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFF334155), width: 1.5),
                      ),
                      child: TextField(
                        controller: _messageController,
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: const InputDecoration(
                          hintText: 'Type your message...',
                          hintStyle: TextStyle(color: Color(0xFF64748B)),
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          border: InputBorder.none,
                        ),
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _sendMessage,
                    child: CircleAvatar(
                      radius: 20,
                      backgroundColor: const Color(0xFF10B981), // Emerald 500
                      child: _isSending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
