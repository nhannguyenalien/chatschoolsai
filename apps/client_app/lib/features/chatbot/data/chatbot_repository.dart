import '../../../core/network/api_client.dart';
import 'bot_config.dart';
import 'knowledge_document.dart';

abstract interface class ChatbotRepository {
  Future<BotConfig> fetchConfig();
  Future<void> updateConfig(BotConfig config);
  Future<List<KnowledgeDocument>> fetchKnowledge();
  Future<void> addKnowledge(String title, String text);
  Future<void> deleteKnowledge(String id);
  Future<void> syncKnowledge();
  Future<String> sendTestMessage(String session, String question);
}

class ApiChatbotRepository implements ChatbotRepository {
  ApiChatbotRepository(this._api);
  final ApiClient _api;

  @override
  Future<BotConfig> fetchConfig() async {
    final json = await _api.getJson('/api/v1/config');
    return BotConfig.fromJson(
      json['config'] as Map<String, dynamic>? ?? const {},
    );
  }

  @override
  Future<void> updateConfig(BotConfig config) async {
    await _api.patchJson('/api/v1/config', body: config.toPatch());
  }

  @override
  Future<List<KnowledgeDocument>> fetchKnowledge() async {
    final json = await _api.getJson('/api/v1/knowledge');
    final rows = json['documents'] as List<dynamic>? ?? const [];
    return rows
        .whereType<Map<String, dynamic>>()
        .map(KnowledgeDocument.fromJson)
        .toList();
  }

  @override
  Future<void> addKnowledge(String title, String text) async {
    await _api.postJson(
      '/api/v1/knowledge',
      body: {'title': title.trim(), 'text': text.trim()},
    );
  }

  @override
  Future<void> deleteKnowledge(String id) async {
    await _api.deleteJson('/api/v1/knowledge/${Uri.encodeComponent(id)}');
  }

  @override
  Future<void> syncKnowledge() async {
    await _api.postJson('/api/v1/knowledge/sync');
  }

  @override
  Future<String> sendTestMessage(String session, String question) async {
    final json = await _api.postJson(
      '/api/v1/chat',
      body: {'session': session, 'question': question.trim()},
    );
    final reply = json['reply'];
    if (reply is! String || reply.trim().isEmpty) {
      throw const FormatException('Chatbot không trả về nội dung hợp lệ.');
    }
    return reply.trim();
  }
}
