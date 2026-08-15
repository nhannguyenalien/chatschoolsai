class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.session,
    required this.username,
    required this.text,
    required this.isBot,
    required this.needsHuman,
    required this.escalationResolved,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: json['id'] as String? ?? '',
    session: json['session'] as String? ?? '',
    username: json['username'] as String? ?? 'Khách',
    text: json['text'] as String? ?? '',
    isBot: json['is_bot'] as bool? ?? false,
    needsHuman: json['needs_human'] as bool? ?? false,
    escalationResolved: json['escalation_resolved'] as bool? ?? false,
    createdAt: DateTime.tryParse(json['created'] as String? ?? '')?.toLocal(),
  );

  final String id;
  final String session;
  final String username;
  final String text;
  final bool isBot;
  final bool needsHuman;
  final bool escalationResolved;
  final DateTime? createdAt;

  bool get requiresHuman => needsHuman && !escalationResolved;
  bool get isAdmin => isBot && username.toLowerCase() == 'admin';
}

class ChatSession {
  const ChatSession({
    required this.id,
    required this.customerName,
    required this.messages,
  });

  final String id;
  final String customerName;
  final List<ChatMessage> messages;

  ChatMessage get lastMessage => messages.last;
  bool get requiresHuman => messages.any((message) => message.requiresHuman);
}

List<ChatSession> groupChatSessions(List<ChatMessage> messages) {
  final grouped = <String, List<ChatMessage>>{};
  for (final message in messages) {
    if (message.session.isNotEmpty) {
      grouped.putIfAbsent(message.session, () => []).add(message);
    }
  }
  final sessions = grouped.entries.map((entry) {
    final items = entry.value..sort(_compareMessages);
    final customer = items.where((item) => !item.isBot).firstOrNull;
    return ChatSession(
      id: entry.key,
      customerName: customer?.username.trim().isNotEmpty == true
          ? customer!.username.trim()
          : 'Khách hàng',
      messages: List.unmodifiable(items),
    );
  }).toList();
  sessions.sort((a, b) => _compareMessages(b.lastMessage, a.lastMessage));
  return sessions;
}

int _compareMessages(ChatMessage a, ChatMessage b) {
  final dateComparison = (a.createdAt ?? DateTime(1970)).compareTo(
    b.createdAt ?? DateTime(1970),
  );
  return dateComparison != 0 ? dateComparison : a.id.compareTo(b.id);
}
