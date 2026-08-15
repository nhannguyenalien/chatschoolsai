import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/messages/data/chat_message.dart';

void main() {
  test('groups messages by session and sorts newest session first', () {
    final sessions = groupChatSessions([
      _message('1', 'a', 'An', 'Xin chào', '2026-08-12T08:00:00Z'),
      _message('2', 'b', 'Bình', 'Cần giúp', '2026-08-12T10:00:00Z'),
      _message('3', 'a', 'Bot', 'Chào An', '2026-08-12T09:00:00Z', isBot: true),
    ]);

    expect(sessions.map((item) => item.id), ['b', 'a']);
    expect(sessions.last.customerName, 'An');
    expect(sessions.last.messages.map((item) => item.id), ['1', '3']);
  });

  test('resolved escalation is not shown as requiring human', () {
    final message = ChatMessage.fromJson({
      'id': '1',
      'session': 'a',
      'username': 'An',
      'text': 'Cần hỗ trợ',
      'needs_human': true,
      'escalation_resolved': true,
    });

    expect(message.requiresHuman, isFalse);
    expect(groupChatSessions([message]).single.requiresHuman, isFalse);
  });
}

ChatMessage _message(
  String id,
  String session,
  String username,
  String text,
  String created, {
  bool isBot = false,
}) => ChatMessage.fromJson({
  'id': id,
  'session': session,
  'username': username,
  'text': text,
  'is_bot': isBot,
  'created': created,
});
