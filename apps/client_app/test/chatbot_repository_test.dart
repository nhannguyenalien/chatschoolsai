import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schools_ai_app/core/network/api_client.dart';
import 'package:schools_ai_app/features/chatbot/data/bot_config.dart';
import 'package:schools_ai_app/features/chatbot/data/chatbot_repository.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient api;
  late ApiChatbotRepository repository;

  setUp(() {
    api = MockApiClient();
    repository = ApiChatbotRepository(api);
  });

  test('maps config and documents from the public API contract', () async {
    when(() => api.getJson('/api/v1/config')).thenAnswer(
      (_) async => {
        'config': {
          'tenant': 'school-a',
          'bot_name': 'Trợ lý',
          'temperature': 0.4,
          'max_tokens': 1200,
        },
      },
    );
    when(() => api.getJson('/api/v1/knowledge')).thenAnswer(
      (_) async => {
        'documents': [
          {
            'id': 'doc-1',
            'title': 'Học phí',
            'char_count': 321,
            'created': '2026-08-12T08:00:00Z',
          },
          'invalid-row',
        ],
      },
    );

    final config = await repository.fetchConfig();
    final documents = await repository.fetchKnowledge();

    expect(config.tenant, 'school-a');
    expect(config.temperature, 0.4);
    expect(documents.single.id, 'doc-1');
    expect(documents.single.created, DateTime.utc(2026, 8, 12, 8));
  });

  test('writes only the allowlisted config patch', () async {
    Map<String, dynamic>? sentBody;
    when(
      () => api.patchJson('/api/v1/config', body: any(named: 'body')),
    ).thenAnswer((invocation) async {
      sentBody = invocation.namedArguments[#body] as Map<String, dynamic>;
      return const {};
    });

    await repository.updateConfig(
      const BotConfig(
        tenant: 'must-not-be-sent',
        botName: ' Bot ',
        greeting: ' Xin chào ',
        systemPrompt: ' Prompt ',
        model: ' model ',
        temperature: 0.7,
        maxTokens: 1024,
        streaming: true,
      ),
    );

    expect(sentBody, isNot(contains('tenant')));
    expect(sentBody, isNot(contains('api_key')));
    expect(sentBody!['bot_name'], 'Bot');
    expect(sentBody!['system_prompt'], 'Prompt');
  });

  test('uses stable knowledge endpoints and normalized payloads', () async {
    Map<String, dynamic>? addedBody;
    when(
      () => api.postJson('/api/v1/knowledge', body: any(named: 'body')),
    ).thenAnswer((invocation) async {
      addedBody = invocation.namedArguments[#body] as Map<String, dynamic>;
      return const {};
    });
    when(
      () => api.deleteJson('/api/v1/knowledge/doc%2F1'),
    ).thenAnswer((_) async => const {});
    when(
      () => api.postJson('/api/v1/knowledge/sync'),
    ).thenAnswer((_) async => const {});

    await repository.addKnowledge(' Tiêu đề ', ' Nội dung ');
    await repository.deleteKnowledge('doc/1');
    await repository.syncKnowledge();

    expect(addedBody, {'title': 'Tiêu đề', 'text': 'Nội dung'});
    verify(() => api.deleteJson('/api/v1/knowledge/doc%2F1')).called(1);
    verify(() => api.postJson('/api/v1/knowledge/sync')).called(1);
  });

  test('sends test chat with session and returns a normalized reply', () async {
    Map<String, dynamic>? sentBody;
    when(
      () => api.postJson('/api/v1/chat', body: any(named: 'body')),
    ).thenAnswer((invocation) async {
      sentBody = invocation.namedArguments[#body] as Map<String, dynamic>;
      return {'success': true, 'reply': '  Xin chào bạn  '};
    });

    final reply = await repository.sendTestMessage('session-1', ' Câu hỏi ');

    expect(sentBody, {'session': 'session-1', 'question': 'Câu hỏi'});
    expect(reply, 'Xin chào bạn');
  });

  test('rejects an invalid empty chatbot reply', () async {
    when(
      () => api.postJson('/api/v1/chat', body: any(named: 'body')),
    ).thenAnswer((_) async => {'success': true, 'reply': '   '});

    expect(
      () => repository.sendTestMessage('session-1', 'Câu hỏi'),
      throwsA(isA<FormatException>()),
    );
  });
}
