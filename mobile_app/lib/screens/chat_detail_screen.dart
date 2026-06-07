import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;
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

  // Attachment states
  final ImagePicker _picker = ImagePicker();
  File? _selectedFile;
  Map<String, dynamic>? _uploadedFileData;
  bool _isUploadingFile = false;
  Map<String, dynamic>? _replyingTo;

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
    _commandSubscription = widget.streamService.commandStream.listen((payload) {
      if (payload['type'] == 'new_message') {
        final messageData = payload['message'];
        if (messageData != null) {
          final senderId = messageData['senderId'];
          final receiverId = messageData['receiverId'];

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

  Future<Map<String, dynamic>?> _uploadFile(File file) async {
    try {
      final deviceId = widget.streamService.deviceId;
      final uri = Uri.parse('$_httpBackendUrl/api/attachments/upload');
      final request = http.MultipartRequest('POST', uri);
      
      request.headers['x-device-id'] = deviceId;
      request.files.add(await http.MultipartFile.fromPath('file', file.path));
      
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (data['success'] == true) {
          return data;
        }
      }
      print('Upload failed with status: ${response.statusCode}');
    } catch (e) {
      print('Error uploading file: $e');
    }
    return null;
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(source: source, imageQuality: 70);
      if (image == null) return;
      
      setState(() {
        _isUploadingFile = true;
        _selectedFile = File(image.path);
      });
      
      final result = await _uploadFile(_selectedFile!);
      if (result != null) {
        setState(() {
          _uploadedFileData = result;
        });
      } else {
        _showErrorSnackBar('Failed to upload image');
        setState(() {
          _selectedFile = null;
        });
      }
    } catch (e) {
      print('Error picking image: $e');
    } finally {
      setState(() {
        _isUploadingFile = false;
      });
    }
  }

  Future<void> _pickPDF() async {
    try {
      final FilePickerResult? result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );
      if (result == null || result.files.single.path == null) return;
      
      setState(() {
        _isUploadingFile = true;
        _selectedFile = File(result.files.single.path!);
      });
      
      final uploadResult = await _uploadFile(_selectedFile!);
      if (uploadResult != null) {
        setState(() {
          _uploadedFileData = uploadResult;
        });
      } else {
        _showErrorSnackBar('Failed to upload PDF');
        setState(() {
          _selectedFile = null;
        });
      }
    } catch (e) {
      print('Error picking PDF: $e');
    } finally {
      setState(() {
        _isUploadingFile = false;
      });
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if ((text.isEmpty && _uploadedFileData == null) || _isSending) return;

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

      dynamic messageContent = text;
      if (_uploadedFileData != null || _replyingTo != null) {
        final payload = {
          'is_json': true,
          'text': text,
        };
        if (_uploadedFileData != null) {
          payload['file_url'] = _uploadedFileData!['fileUrl'];
          payload['file_name'] = _uploadedFileData!['fileName'];
          payload['file_type'] = _uploadedFileData!['fileType'];
        }
        if (_replyingTo != null) {
          String replyText = _replyingTo!['message'] ?? '';
          try {
            if (replyText.startsWith('{')) {
              final parsed = jsonDecode(replyText);
              if (parsed['is_json'] == true) {
                replyText = parsed['text'] ?? '[Attachment]';
              }
            }
          } catch (_) {}
          
          payload['reply_to'] = {
            'id': _replyingTo!['id'],
            'sender_id': _replyingTo!['senderId'],
            'message': replyText,
            'timestamp': _replyingTo!['timestamp'],
          };
        }
        messageContent = jsonEncode(payload);
      }

      request.write(jsonEncode({
        'receiverId': widget.otherUserId,
        'message': messageContent
      }));
      
      final response = await request.close();
      final responseBodyString = await response.transform(utf8.decoder).join();
      final responseData = jsonDecode(responseBodyString) as Map<String, dynamic>;

      if (response.statusCode == 200 && responseData['success'] == true) {
        final newMessage = responseData['message'];
        setState(() {
          _messages.add(Map<String, dynamic>.from(newMessage));
          _messageController.clear();
          _uploadedFileData = null;
          _selectedFile = null;
          _replyingTo = null;
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

  void _showAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Color(0xFF10B981)),
                title: const Text('Take Photo', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: Color(0xFF10B981)),
                title: const Text('Choose Photo', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.gallery);
                },
              ),
              ListTile(
                leading: const Icon(Icons.picture_as_pdf, color: Color(0xFF10B981)),
                title: const Text('Attach PDF', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  _pickPDF();
                },
              ),
            ],
          ),
        );
      },
    );
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
                            final rawMessage = msg['message'] ?? '';
                            final timestamp = msg['timestamp'];

                            Map<String, dynamic> parsedMsg = {
                              'text': rawMessage,
                              'file_url': null,
                              'file_name': null,
                              'file_type': null,
                              'reply_to': null,
                            };

                            try {
                              if (rawMessage.startsWith('{')) {
                                final parsed = jsonDecode(rawMessage);
                                if (parsed['is_json'] == true) {
                                  parsedMsg = Map<String, dynamic>.from(parsed);
                                }
                              }
                            } catch (_) {}

                            final text = parsedMsg['text'] ?? '';

                            String timeString = '';
                            if (timestamp != null) {
                              try {
                                timeString = DateFormat('h:mm a').format(DateTime.parse(timestamp));
                              } catch (_) {}
                            }

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
                                GestureDetector(
                                  onLongPress: () {
                                    setState(() {
                                      _replyingTo = msg;
                                    });
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Replying to selected message'),
                                        duration: Duration(seconds: 1),
                                      ),
                                    );
                                  },
                                  child: Align(
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
                                          // Quote reply
                                          if (parsedMsg['reply_to'] != null)
                                            Container(
                                              margin: const EdgeInsets.only(bottom: 8),
                                              padding: const EdgeInsets.all(6),
                                              decoration: BoxDecoration(
                                                color: Colors.black.withValues(alpha: 0.1),
                                                borderRadius: BorderRadius.circular(6),
                                                border: Border(
                                                  left: BorderSide(
                                                    color: isMe ? Colors.white70 : const Color(0xFF10B981),
                                                    width: 3,
                                                  ),
                                                ),
                                              ),
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    parsedMsg['reply_to']['sender_id'] == widget.employeeId ? 'You' : 'Reply',
                                                    style: TextStyle(
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 9,
                                                      color: isMe ? Colors.white : const Color(0xFF10B981),
                                                    ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    parsedMsg['reply_to']['message'] ?? '',
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: TextStyle(
                                                      fontStyle: FontStyle.italic,
                                                      fontSize: 11,
                                                      color: isMe ? Colors.white70 : const Color(0xFF94A3B8),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),

                                          // File attachment rendering
                                          if (parsedMsg['file_url'] != null && parsedMsg['file_type'] == 'image')
                                            Container(
                                              margin: const EdgeInsets.only(bottom: 6),
                                              child: ClipRRect(
                                                borderRadius: BorderRadius.circular(8),
                                                child: Image.network(
                                                  '$_httpBackendUrl${parsedMsg['file_url']}',
                                                  fit: BoxFit.cover,
                                                  width: 200,
                                                  errorBuilder: (context, error, stackTrace) {
                                                    return Container(
                                                      color: Colors.black26,
                                                      width: 200,
                                                      height: 120,
                                                      child: const Icon(Icons.broken_image, color: Colors.white24),
                                                    );
                                                  },
                                                ),
                                              ),
                                            ),

                                          if (parsedMsg['file_url'] != null && parsedMsg['file_type'] == 'pdf')
                                            GestureDetector(
                                              onTap: () async {
                                                final docUrl = '$_httpBackendUrl${parsedMsg['file_url']}';
                                                try {
                                                  if (await canLaunchUrl(Uri.parse(docUrl))) {
                                                    await launchUrl(Uri.parse(docUrl), mode: LaunchMode.externalApplication);
                                                  } else {
                                                    _showErrorSnackBar('Could not launch PDF URL');
                                                  }
                                                } catch (e) {
                                                  print('Error launching URL: $e');
                                                }
                                              },
                                              child: Container(
                                                margin: const EdgeInsets.only(bottom: 6),
                                                padding: const EdgeInsets.all(8),
                                                decoration: BoxDecoration(
                                                  color: Colors.black26,
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Icon(Icons.picture_as_pdf, color: Colors.redAccent, size: 24),
                                                    const SizedBox(width: 8),
                                                    Expanded(
                                                      child: Column(
                                                        crossAxisAlignment: CrossAxisAlignment.start,
                                                        children: [
                                                          Text(
                                                            parsedMsg['file_name'] ?? 'document.pdf',
                                                            maxLines: 1,
                                                            overflow: TextOverflow.ellipsis,
                                                            style: const TextStyle(
                                                              color: Colors.white,
                                                              fontSize: 11,
                                                              fontWeight: FontWeight.bold,
                                                            ),
                                                          ),
                                                          const Text(
                                                            'Tap to open PDF',
                                                            style: TextStyle(
                                                              color: Color(0xFF64748B),
                                                              fontSize: 9,
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),

                                          if (text.isNotEmpty)
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
                                ),
                              ],
                            );
                          },
                        ),
            ),

            // Reply & Attachment preview layouts
            if (_replyingTo != null)
              Container(
                color: const Color(0xFF1E293B),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.reply, color: Color(0xFF10B981), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _replyingTo!['senderId'] == widget.employeeId ? 'Replying to yourself' : 'Replying to staff',
                            style: const TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            (() {
                              final text = _replyingTo!['message'] ?? '';
                              try {
                                if (text.startsWith('{')) {
                                  final parsed = jsonDecode(text);
                                  if (parsed['is_json'] == true) {
                                    return parsed['text'] ?? '[Attachment]';
                                  }
                                }
                              } catch (_) {}
                              return text;
                            })(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 16),
                      onPressed: () => setState(() => _replyingTo = null),
                    ),
                  ],
                ),
              ),
            if (_selectedFile != null || _isUploadingFile)
              Container(
                color: const Color(0xFF1E293B),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          _isUploadingFile 
                              ? Icons.cloud_upload_outlined
                              : (_uploadedFileData?['fileType'] == 'image' ? Icons.image : Icons.insert_drive_file),
                          color: const Color(0xFF10B981),
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _isUploadingFile
                                ? 'Uploading file...'
                                : (_selectedFile?.path.split('/').last ?? 'Attachment'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                          ),
                        ),
                        if (!_isUploadingFile)
                          IconButton(
                            icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 16),
                            onPressed: () {
                              setState(() {
                                _selectedFile = null;
                                _uploadedFileData = null;
                              });
                            },
                          ),
                      ],
                    ),
                    if (!_isUploadingFile && _selectedFile != null) ...[
                      const SizedBox(height: 8),
                      if (_uploadedFileData?['fileType'] == 'image')
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: Image.file(
                            _selectedFile!,
                            width: 80,
                            height: 80,
                            fit: BoxFit.cover,
                          ),
                        )
                      else if (_uploadedFileData?['fileType'] == 'pdf')
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.black26,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFF334155), width: 1),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.picture_as_pdf, color: Colors.red, size: 20),
                              const SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  _selectedFile!.path.split('/').last,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ],
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
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, color: Color(0xFF94A3B8)),
                    onPressed: _showAttachmentOptions,
                  ),
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
