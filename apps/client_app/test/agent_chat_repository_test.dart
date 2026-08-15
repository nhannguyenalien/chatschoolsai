import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schools_ai_app/core/network/api_client.dart';
import 'package:schools_ai_app/features/agent_chat/data/agent_chat_repository.dart';
import 'package:schools_ai_app/features/agent_chat/data/agent_message.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient api;
  late ApiAgentChatRepository repository;

  setUp(() {
    api = MockApiClient();
    repository = ApiAgentChatRepository(api);
  });

  test(
    'sends the complete role-safe conversation to the stable endpoint',
    () async {
      Map<String, dynamic>? sentBody;
      when(
        () => api.postJson('/api/v1/agent-chat', body: any(named: 'body')),
      ).thenAnswer((invocation) async {
        sentBody = invocation.namedArguments[#body] as Map<String, dynamic>;
        return {'reply': 'Bạn cần hỗ trợ gì thêm?'};
      });

      final reply = await repository.send(const [
        AgentMessage(role: AgentMessageRole.user, content: 'Xin chào'),
        AgentMessage(role: AgentMessageRole.assistant, content: 'Chào bạn!'),
      ]);

      expect(reply, 'Bạn cần hỗ trợ gì thêm?');
      expect(sentBody, {
        'messages': [
          {'role': 'user', 'content': 'Xin chào'},
          {'role': 'assistant', 'content': 'Chào bạn!'},
        ],
      });
    },
  );

  test('returns a safe fallback when the API omits reply', () async {
    when(
      () => api.postJson('/api/v1/agent-chat', body: any(named: 'body')),
    ).thenAnswer((_) async => const {});

    final reply = await repository.send(const []);

    expect(reply, 'Agent chưa trả về nội dung.');
  });
}
