import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import '../services/stream_service.dart';
import '../services/url_helper.dart';
import 'chat_detail_screen.dart';

class ChatUsersScreen extends StatefulWidget {
  final StreamService streamService;
  final String serverIp;
  final String employeeName;
  final String employeeId;
  final bool isEmbedded;

  const ChatUsersScreen({
    Key? key,
    required this.streamService,
    required this.serverIp,
    required this.employeeName,
    required this.employeeId,
    this.isEmbedded = false,
  }) : super(key: key);

  @override
  State<ChatUsersScreen> createState() => _ChatUsersScreenState();
}

class _ChatUsersScreenState extends State<ChatUsersScreen> {
  List<dynamic> _users = [];
  bool _isLoading = true;
  String _searchQuery = '';

  String get _httpBackendUrl => UrlHelper.getHttpUrl(widget.serverIp);

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    try {
      final deviceId = widget.streamService.deviceId;
      final url = Uri.parse('$_httpBackendUrl/api/devices/users');
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 10);

      final request = await client.getUrl(url);
      request.headers.set('x-device-id', deviceId);

      final response = await request.close();
      final responseBodyString = await response.transform(utf8.decoder).join();
      final responseData = jsonDecode(responseBodyString) as Map<String, dynamic>;

      if (response.statusCode == 200 && responseData['success'] == true) {
        setState(() {
          _users = responseData['users'] ?? [];
          _isLoading = false;
        });
      } else {
        print('Failed to load users: ${response.statusCode}');
        setState(() => _isLoading = false);
      }
    } catch (e) {
      print('Error loading users: $e');
      setState(() => _isLoading = false);
    }
  }

  List<dynamic> _getFilteredUsers() {
    if (_searchQuery.isEmpty) return _users;
    return _users.where((user) {
      final name = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.toLowerCase();
      final email = (user['email'] ?? '').toLowerCase();
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || email.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filteredUsers = _getFilteredUsers();
    final bool isConnected = widget.streamService.isConnected;

    final mainContent = Column(
      children: [
        // Search Bar
        Padding(
          padding: const EdgeInsets.all(12.0),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B), // Slate 800
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF334155), width: 1.5),
            ),
            child: TextField(
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'Search contacts...',
                hintStyle: TextStyle(color: Color(0xFF64748B)),
                prefixIcon: Icon(Icons.search, color: Color(0xFF64748B)),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 12),
              ),
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                });
              },
            ),
          ),
        ),

        // Users list
        Expanded(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF10B981),
                  ),
                )
              : filteredUsers.isEmpty
                  ? const Center(
                      child: Text(
                        'No contacts found.',
                        style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
                      ),
                    )
                  : RefreshIndicator(
                      color: const Color(0xFF10B981),
                      onRefresh: _fetchUsers,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        itemCount: filteredUsers.length,
                        itemBuilder: (context, index) {
                          final user = filteredUsers[index];
                          final id = user['id'] ?? '';
                          final firstName = user['firstName'] ?? '';
                          final lastName = user['lastName'] ?? '';
                          final fullName = '$firstName $lastName';
                          final email = user['email'] ?? '';
                          final role = user['role'] ?? 'employee';
                          final isAdmin = role == 'superadmin' || role == 'admin';

                          final initials = '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();

                          return Card(
                            color: const Color(0xFF1E293B), // Slate 800
                            margin: const EdgeInsets.symmetric(vertical: 6),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: isAdmin ? Colors.cyan.withValues(alpha: 0.15) : const Color(0xFF10B981).withValues(alpha: 0.15),
                                child: Text(
                                  initials,
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: isAdmin ? Colors.cyan : const Color(0xFF10B981),
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      fullName,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isAdmin ? Colors.cyan.withValues(alpha: 0.15) : Colors.grey.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(100),
                                    ),
                                    child: Text(
                                      isAdmin ? 'ADMIN' : 'STAFF',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 9,
                                        color: isAdmin ? Colors.cyan : Colors.white60,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              subtitle: Text(
                                email,
                                style: const TextStyle(
                                  color: Color(0xFF64748B),
                                  fontSize: 11,
                                ),
                              ),
                              trailing: const Icon(
                                Icons.chevron_right_rounded,
                                color: Color(0xFF64748B),
                              ),
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (context) => ChatDetailScreen(
                                      streamService: widget.streamService,
                                      serverIp: widget.serverIp,
                                      employeeId: widget.employeeId,
                                      otherUserId: id,
                                      otherUserName: fullName,
                                      otherUserRole: role,
                                    ),
                                  ),
                                );
                              },
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );

    if (widget.isEmbedded) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F172A), // Slate 900
        body: SafeArea(child: mainContent),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B), // Slate 800
        elevation: 0,
        title: const Text(
          'Select Contact',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () {
              setState(() => _isLoading = true);
              _fetchUsers();
            },
          )
        ],
      ),
      body: SafeArea(child: mainContent),
    );
  }
}
