import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/chatbot/data/bot_config.dart';
import 'package:schools_ai_app/features/chatbot/data/chatbot_repository.dart';
import 'package:schools_ai_app/features/chatbot/data/knowledge_document.dart';
import 'package:schools_ai_app/features/chatbot/presentation/chatbot_controller.dart';

class FakeChatbotRepository implements ChatbotRepository {
  BotConfig config = const BotConfig(
    tenant: 'school-a',
    botName: 'Trợ lý',
    greeting: 'Xin chào',
    systemPrompt: 'Chỉ trả lời theo dữ liệu.',
    model: 'gpt-4o-mini',
    temperature: 0.4,
    maxTokens: 1200,
    streaming: false,
  );
  List<KnowledgeDocument> documents = const [
    KnowledgeDocument(
      id: 'doc-1',
      title: 'Học phí',
      charCount: 100,
      created: null,
    ),
  ];
  String? addedTitle;
  String? addedText;
  String? deletedId;
  bool synced = false;
  String? testSession;
  String? testQuestion;
  Object? failure;

  void _failIfNeeded() {
    if (failure != null) throw failure!;
  }

  @override
  Future<BotConfig> fetchConfig() async {
    _failIfNeeded();
    return config;
  }

  @override
  Future<List<KnowledgeDocument>> fetchKnowledge() async {
    _failIfNeeded();
    return documents;
  }

  @override
  Future<void> updateConfig(BotConfig value) async {
    _failIfNeeded();
    config = value;
  }

  @override
  Future<void> addKnowledge(String title, String text) async {
    _failIfNeeded();
    addedTitle = title;
    addedText = text;
    documents = [
      ...documents,
      const KnowledgeDocument(
        id: 'doc-2',
        title: 'Lịch học',
        charCount: 80,
        created: null,
      ),
    ];
  }

  @override
  Future<void> deleteKnowledge(String id) async {
    _failIfNeeded();
    deletedId = id;
  }

  @override
  Future<void> syncKnowledge() async {
    _failIfNeeded();
    synced = true;
  }

  @override
  Future<String> sendTestMessage(String session, String question) async {
    _failIfNeeded();
    testSession = session;
    testQuestion = question;
    return 'Câu trả lời từ chatbot';
  }
}

void main() {
  test('loads chatbot config and training documents together', () async {
    final repository = FakeChatbotRepository();
    final controller = ChatbotController(repository);
    await controller.load();
    expect(controller.state.config?.tenant, 'school-a');
    expect(controller.state.documents.single.id, 'doc-1');
    expect(controller.state.isLoading, isFalse);
  });

  test('trims training input and refreshes document list', () async {
    final repository = FakeChatbotRepository();
    final controller = ChatbotController(repository);
    await controller.load();
    expect(await controller.add('  Lịch học ', ' Nội dung '), isTrue);
    expect(repository.addedTitle, 'Lịch học');
    expect(repository.addedText, 'Nội dung');
    expect(controller.state.documents, hasLength(2));
  });

  test('does not send blank training data', () async {
    final repository = FakeChatbotRepository();
    final controller = ChatbotController(repository);
    expect(await controller.add(' ', 'Nội dung'), isFalse);
    expect(repository.addedTitle, isNull);
  });

  test('rejects oversized training data before calling repository', () async {
    final repository = FakeChatbotRepository();
    final controller = ChatbotController(repository);

    expect(await controller.add('x' * 201, 'Nội dung'), isFalse);
    expect(repository.addedTitle, isNull);
    expect(controller.state.errorMessage, contains('200'));

    expect(await controller.add('Tiêu đề', 'x' * 500001), isFalse);
    expect(repository.addedText, isNull);
    expect(controller.state.errorMessage, contains('500.000'));
  });

  test('removes only deleted document after API succeeds', () async {
    final repository = FakeChatbotRepository();
    final controller = ChatbotController(repository);
    await controller.load();
    expect(await controller.delete('doc-1'), isTrue);
    expect(repository.deletedId, 'doc-1');
    expect(controller.state.documents, isEmpty);
  });

  test('retains state and exposes error when mutation fails', () async {
    final repository = FakeChatbotRepository();
    final controller = ChatbotController(repository);
    await controller.load();
    repository.failure = StateError('sync failed');
    expect(await controller.sync(), isFalse);
    expect(controller.state.documents, hasLength(1));
    expect(controller.state.errorMessage, contains('sync failed'));
    expect(controller.state.isSaving, isFalse);
  });

  test('sends a trimmed question and appends the real chatbot reply', () async {
    final repository = FakeChatbotRepository();
    final controller = ChatbotController(repository);

    expect(await controller.sendTestMessage('  Học phí bao nhiêu?  '), isTrue);
    expect(repository.testSession, startsWith('app-test-'));
    expect(repository.testQuestion, 'Học phí bao nhiêu?');
    expect(controller.state.testMessages, hasLength(2));
    expect(controller.state.testMessages.first.isUser, isTrue);
    expect(controller.state.testMessages.last.text, 'Câu trả lời từ chatbot');
    expect(controller.state.isTesting, isFalse);
  });

  test('new test conversation clears messages and changes session', () async {
    final repository = FakeChatbotRepository();
    final controller = ChatbotController(repository);
    await controller.sendTestMessage('Câu một');
    final firstSession = repository.testSession;

    await Future<void>.delayed(const Duration(microseconds: 1));
    controller.clearTestConversation();
    await controller.sendTestMessage('Câu hai');

    expect(controller.state.testMessages, hasLength(2));
    expect(repository.testSession, isNot(firstSession));
  });
}
