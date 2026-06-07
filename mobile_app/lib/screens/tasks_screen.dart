import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/stream_service.dart';
import '../services/url_helper.dart';

class TasksScreen extends StatefulWidget {
  final StreamService streamService;
  final String serverIp;
  final bool isEmbedded;

  const TasksScreen({
    super.key,
    required this.streamService,
    required this.serverIp,
    this.isEmbedded = false,
  });

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  List<Map<String, dynamic>> _tasks = [];
  bool _isLoading = true;
  String _activeFilter = 'All'; // 'All', 'Pending', 'Completed'

  String get _httpBackendUrl => UrlHelper.getHttpUrl(widget.serverIp);

  @override
  void initState() {
    super.initState();
    _fetchTasks();
  }

  Future<void> _fetchTasks() async {
    try {
      final deviceId = widget.streamService.deviceId;
      final url = Uri.parse('$_httpBackendUrl/api/devices/tasks');
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 10);

      final request = await client.getUrl(url);
      request.headers.set('x-device-id', deviceId);

      final response = await request.close();
      final responseBodyString = await response.transform(utf8.decoder).join();
      final responseData =
          jsonDecode(responseBodyString) as Map<String, dynamic>;

      if (response.statusCode == 200 && responseData['success'] == true) {
        setState(() {
          _tasks = List<Map<String, dynamic>>.from(responseData['tasks'] ?? []);
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      debugPrint('Error loading tasks: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _updateTaskStatus(String taskId, String newStatus) async {
    try {
      final deviceId = widget.streamService.deviceId;
      final url = Uri.parse('$_httpBackendUrl/api/devices/tasks/$taskId');
      final client = HttpClient();
      client.connectionTimeout = const Duration(seconds: 10);

      final request = await client.putUrl(url);
      request.headers.set('x-device-id', deviceId);
      request.headers.set('content-type', 'application/json');
      request.write(jsonEncode({'status': newStatus}));

      final response = await request.close();
      final responseBodyString = await response.transform(utf8.decoder).join();
      final responseData =
          jsonDecode(responseBodyString) as Map<String, dynamic>;

      if (response.statusCode == 200 && responseData['success'] == true) {
        // Find and update local task status
        setState(() {
          final index = _tasks.indexWhere((t) => t['id'] == taskId);
          if (index != -1) {
            _tasks[index]['status'] = newStatus;
            _tasks[index]['updatedAt'] = DateTime.now().toIso8601String();
          }
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Task status updated to $newStatus',
              style: const TextStyle(color: Colors.white),
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              responseData['error'] ?? 'Failed to update task status',
            ),
            backgroundColor: Colors.redAccent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error updating task: $e');
    }
  }

  List<Map<String, dynamic>> _getFilteredTasks() {
    if (_activeFilter == 'All') return _tasks;
    if (_activeFilter == 'Pending') {
      return _tasks.where((t) {
        final status = t['status'];
        return status == 'todo' ||
            status == 'backlog' ||
            status == 'in progress';
      }).toList();
    }
    if (_activeFilter == 'Completed') {
      return _tasks.where((t) {
        final status = t['status'];
        return status == 'done' || status == 'canceled';
      }).toList();
    }
    return _tasks;
  }

  void _showTaskDetails(Map<String, dynamic> task) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E293B), // Slate 800
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final status = task['status'] ?? 'todo';
            final title = task['title'] ?? '';
            final description =
                task['description'] ?? 'No description provided.';
            final priority = task['priority'] ?? 'medium';
            final label = task['label'] ?? 'feature';
            final dueDateStr = task['dueDate'];

            // Format due date if available
            String dueDateFormatted = 'No due date';
            if (dueDateStr != null) {
              try {
                final date = DateTime.parse(dueDateStr);
                dueDateFormatted = DateFormat('MMM dd, yyyy').format(date);
              } catch (_) {}
            }

            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFF475569),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _buildPriorityBadge(priority),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _buildStatusBadge(status),
                      const SizedBox(width: 8),
                      _buildLabelBadge(label),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Description',
                    style: TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    description,
                    style: const TextStyle(
                      color: Color(0xFFE2E8F0),
                      fontSize: 14,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      const Icon(
                        Icons.calendar_today,
                        size: 14,
                        color: Color(0xFF64748B),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Due Date: $dueDateFormatted',
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Divider(color: Color(0xFF334155), height: 1),
                  const SizedBox(height: 24),
                  // Actions based on status
                  _buildActionButtons(task, status, setModalState),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildActionButtons(
    Map<String, dynamic> task,
    String status,
    StateSetter setModalState,
  ) {
    if (status == 'todo' || status == 'backlog') {
      return Row(
        children: [
          Expanded(
            child: ElevatedButton.icon(
              icon: const Icon(Icons.play_arrow_rounded, color: Colors.white),
              label: const Text(
                'Start Task',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF3B82F6), // Blue
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () async {
                await _updateTaskStatus(task['id'], 'in progress');
                if (mounted) {
                  Navigator.pop(context);
                }
              },
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton.icon(
              icon: const Icon(Icons.check_circle_rounded, color: Colors.white),
              label: const Text(
                'Complete',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981), // Emerald
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              onPressed: () async {
                await _updateTaskStatus(task['id'], 'done');
                if (mounted) {
                  Navigator.pop(context);
                }
              },
            ),
          ),
        ],
      );
    } else if (status == 'in progress') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton.icon(
            icon: const Icon(Icons.check_circle_rounded, color: Colors.white),
            label: const Text(
              'Mark Completed',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981), // Emerald
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () async {
              await _updateTaskStatus(task['id'], 'done');
              if (mounted) {
                Navigator.pop(context);
              }
            },
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(
                    Icons.pause_rounded,
                    color: Color(0xFF94A3B8),
                  ),
                  label: const Text(
                    'Pause Task',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFE2E8F0),
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF475569)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: () async {
                    await _updateTaskStatus(task['id'], 'todo');
                    if (mounted) {
                      Navigator.pop(context);
                    }
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(
                    Icons.cancel_rounded,
                    color: Colors.redAccent,
                  ),
                  label: const Text(
                    'Cancel',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.redAccent,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.redAccent),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: () async {
                    await _updateTaskStatus(task['id'], 'canceled');
                    if (mounted) {
                      Navigator.pop(context);
                    }
                  },
                ),
              ),
            ],
          ),
        ],
      );
    } else {
      // Completed or Canceled
      return ElevatedButton.icon(
        icon: const Icon(Icons.refresh_rounded, color: Colors.white),
        label: const Text(
          'Reopen Task',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF64748B), // Slate 500
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        onPressed: () async {
          await _updateTaskStatus(task['id'], 'todo');
          if (mounted) {
            Navigator.pop(context);
          }
        },
      );
    }
  }

  Widget _buildPriorityBadge(String priority) {
    Color bg;
    Color fg;
    switch (priority.toLowerCase()) {
      case 'high':
        bg = Colors.redAccent.withOpacity(0.15);
        fg = Colors.redAccent;
        break;
      case 'medium':
        bg = Colors.amber.withOpacity(0.15);
        fg = Colors.amber;
        break;
      default:
        bg = Colors.blue.withOpacity(0.15);
        fg = Colors.blue;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: fg.withOpacity(0.3), width: 1),
      ),
      child: Text(
        priority.toUpperCase(),
        style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    switch (status.toLowerCase()) {
      case 'backlog':
        color = const Color(0xFF64748B); // Slate
        break;
      case 'todo':
        color = const Color(0xFF3B82F6); // Blue
        break;
      case 'in progress':
        color = const Color(0xFFF59E0B); // Amber
        break;
      case 'done':
        color = const Color(0xFF10B981); // Emerald
        break;
      case 'canceled':
        color = const Color(0xFFEF4444); // Red
        break;
      default:
        color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildLabelBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF475569).withOpacity(0.3),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: const Color(0xFF475569).withOpacity(0.5),
          width: 1,
        ),
      ),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          color: Color(0xFFE2E8F0),
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildTaskCard(Map<String, dynamic> task) {
    final id = task['id'] ?? '';
    final title = task['title'] ?? '';
    final description = task['description'] ?? '';
    final status = task['status'] ?? 'todo';
    final priority = task['priority'] ?? 'medium';
    final label = task['label'] ?? 'feature';
    final dueDateStr = task['dueDate'];

    String dueDateFormatted = '';
    if (dueDateStr != null) {
      try {
        final date = DateTime.parse(dueDateStr);
        dueDateFormatted = DateFormat('MMM dd, yyyy').format(date);
      } catch (_) {}
    }

    return Card(
      color: const Color(0xFF1E293B), // Slate 800
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: status == 'in progress'
              ? const Color(0xFFF59E0B).withValues(alpha: 0.5)
              : Colors.transparent,
          width: 1,
        ),
      ),
      child: InkWell(
        onTap: () => _showTaskDetails(task),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    id,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: Color(0xFF64748B),
                    ),
                  ),
                  _buildPriorityBadge(priority),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: Colors.white,
                ),
              ),
              if (description.isNotEmpty) const SizedBox(height: 6),
              if (description.isNotEmpty)
                Text(
                  description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF94A3B8),
                  ),
                ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      _buildStatusBadge(status),
                      const SizedBox(width: 6),
                      _buildLabelBadge(label),
                    ],
                  ),
                  if (dueDateFormatted.isNotEmpty)
                    Row(
                      children: [
                        const Icon(
                          Icons.calendar_today,
                          size: 10,
                          color: Color(0xFF64748B),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          dueDateFormatted,
                          style: const TextStyle(
                            fontSize: 10,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredTasks = _getFilteredTasks();

    final mainContent = Column(
      children: [
        // Filter Bar
        Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              _buildFilterChip('All'),
              const SizedBox(width: 8),
              _buildFilterChip('Pending'),
              const SizedBox(width: 8),
              _buildFilterChip('Completed'),
            ],
          ),
        ),

        // Tasks List
        Expanded(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF10B981),
                  ),
                )
              : filteredTasks.isEmpty
                  ? const Center(
                      child: Text(
                        'No tasks assigned.',
                        style: TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 14,
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      color: const Color(0xFF10B981),
                      onRefresh: _fetchTasks,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        itemCount: filteredTasks.length,
                        itemBuilder: (context, index) {
                          return _buildTaskCard(filteredTasks[index]);
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
          'My Assigned Tasks',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
            color: Colors.white,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () {
              setState(() => _isLoading = true);
              _fetchTasks();
            },
          ),
        ],
      ),
      body: SafeArea(child: mainContent),
    );
  }

  Widget _buildFilterChip(String label) {
    final bool isSelected = _activeFilter == label;
    return GestureDetector(
      onTap: () {
        setState(() {
          _activeFilter = label;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF10B981) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF10B981)
                : const Color(0xFF334155),
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF94A3B8),
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}
