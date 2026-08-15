import '../../../core/network/api_client.dart';
import 'agent_message.dart';

abstract interface class AgentChatRepository {
  Future<String> send(List<AgentMessage> messages);
}

class ApiAgentChatRepository implements AgentChatRepository {
  const ApiAgentChatRepository(this._client);
  final ApiClient _client;

  @override
  Future<String> send(List<AgentMessage> messages) async {
    final json = await _client.postJson(
      '/api/v1/agent-chat',
      body: {'messages': messages.map((message) => message.toJson()).toList()},
    );
    return json['reply']?.toString() ?? 'Agent chưa trả về nội dung.';
  }
}
