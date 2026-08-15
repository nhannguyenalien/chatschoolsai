import '../../../core/network/api_client.dart';
import 'chat_message.dart';

abstract interface class MessagesRepository {
  Future<List<ChatMessage>> fetchMessages();
  Future<void> sendReply({required String session, required String text});
}

class ApiMessagesRepository implements MessagesRepository {
  const ApiMessagesRepository(this._client);

  final ApiClient _client;

  @override
  Future<List<ChatMessage>> fetchMessages() async {
    final json = await _client.getJson('/api/v1/messages');
    final messages = json['messages'] as List? ?? const [];
    return messages
        .whereType<Map>()
        .map((item) => ChatMessage.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  @override
  Future<void> sendReply({
    required String session,
    required String text,
  }) async {
    await _client.postJson(
      '/api/v1/messages',
      body: {'session': session, 'text': text.trim()},
    );
  }
}
