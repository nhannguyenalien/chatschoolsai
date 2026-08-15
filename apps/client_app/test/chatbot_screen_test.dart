import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/chatbot/data/bot_config.dart';
import 'package:schools_ai_app/features/chatbot/data/chatbot_repository.dart';
import 'package:schools_ai_app/features/chatbot/data/knowledge_document.dart';
import 'package:schools_ai_app/features/chatbot/presentation/chatbot_controller.dart';
import 'package:schools_ai_app/features/chatbot/presentation/chatbot_screen.dart';

class WidgetChatbotRepository implements ChatbotRepository {
  String? deletedId;

  @override
  Future<BotConfig> fetchConfig() async => const BotConfig(
    tenant: 'school-a',
    botName: 'Trợ lý',
    greeting: 'Xin chào',
    systemPrompt: 'Chỉ trả lời theo dữ liệu.',
    model: 'gpt-4o-mini',
    temperature: 0.4,
    maxTokens: 1200,
    streaming: false,
  );

  @override
  Future<List<KnowledgeDocument>> fetchKnowledge() async => const [
    KnowledgeDocument(
      id: 'doc-1',
      title: 'Học phí',
      charCount: 321,
      created: null,
    ),
  ];

  @override
  Future<void> deleteKnowledge(String id) async => deletedId = id;

  @override
  Future<void> addKnowledge(String title, String text) async {}

  @override
  Future<void> syncKnowledge() async {}

  @override
  Future<void> updateConfig(BotConfig config) async {}

  @override
  Future<String> sendTestMessage(String session, String question) async =>
      'Bot trả lời: $question';
}

void main() {
  testWidgets('training deletion requires explicit confirmation', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repository = WidgetChatbotRepository();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [chatbotRepositoryProvider.overrideWithValue(repository)],
        child: const MaterialApp(home: Scaffold(body: ChatbotScreen())),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Training'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Xóa'));
    await tester.pumpAndSettle();
    expect(find.text('Xóa dữ liệu training?'), findsOneWidget);
    expect(repository.deletedId, isNull);

    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(repository.deletedId, isNull);
    expect(find.text('Học phí'), findsOneWidget);

    await tester.tap(find.byTooltip('Xóa'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Xóa'));
    await tester.pumpAndSettle();

    expect(repository.deletedId, 'doc-1');
    expect(find.text('Học phí'), findsNothing);
  });

  testWidgets('test tab sends a question and renders chatbot reply', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          chatbotRepositoryProvider.overrideWithValue(
            WidgetChatbotRepository(),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: ChatbotScreen())),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thử chatbot'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Học phí bao nhiêu?');
    await tester.tap(find.byTooltip('Gửi'));
    await tester.pumpAndSettle();

    expect(find.text('Học phí bao nhiêu?'), findsOneWidget);
    expect(find.text('Bot trả lời: Học phí bao nhiêu?'), findsOneWidget);
  });
}
