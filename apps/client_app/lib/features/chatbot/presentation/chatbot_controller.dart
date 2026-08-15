import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/bot_config.dart';
import '../data/chatbot_repository.dart';
import '../data/chatbot_test_message.dart';
import '../data/knowledge_document.dart';

class ChatbotState {
  const ChatbotState({
    this.config,
    this.documents = const [],
    this.isLoading = false,
    this.isSaving = false,
    this.isTesting = false,
    this.testMessages = const [],
    this.errorMessage,
  });
  final BotConfig? config;
  final List<KnowledgeDocument> documents;
  final bool isLoading;
  final bool isSaving;
  final bool isTesting;
  final List<ChatbotTestMessage> testMessages;
  final String? errorMessage;

  ChatbotState copyWith({
    BotConfig? config,
    List<KnowledgeDocument>? documents,
    bool? isLoading,
    bool? isSaving,
    bool? isTesting,
    List<ChatbotTestMessage>? testMessages,
    String? errorMessage,
    bool clearError = false,
  }) => ChatbotState(
    config: config ?? this.config,
    documents: documents ?? this.documents,
    isLoading: isLoading ?? this.isLoading,
    isSaving: isSaving ?? this.isSaving,
    isTesting: isTesting ?? this.isTesting,
    testMessages: testMessages ?? this.testMessages,
    errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
  );
}

class ChatbotController extends StateNotifier<ChatbotState> {
  ChatbotController(this._repository)
    : _testSession = _newTestSession(),
      super(const ChatbotState());
  final ChatbotRepository _repository;
  String _testSession;

  static String _newTestSession() =>
      'app-test-${DateTime.now().microsecondsSinceEpoch}';

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final results = await Future.wait([
        _repository.fetchConfig(),
        _repository.fetchKnowledge(),
      ]);
      state = state.copyWith(
        config: results[0] as BotConfig,
        documents: results[1] as List<KnowledgeDocument>,
        isLoading: false,
      );
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<bool> save(BotConfig config) async => _run(() async {
    await _repository.updateConfig(config);
    state = state.copyWith(config: config);
  });

  Future<bool> add(String title, String text) async {
    final cleanTitle = title.trim();
    final cleanText = text.trim();
    if (cleanTitle.isEmpty || cleanText.isEmpty) return false;
    if (cleanTitle.length > 200 || cleanText.length > 500000) {
      state = state.copyWith(
        errorMessage: cleanTitle.length > 200
            ? 'Tiêu đề không được vượt quá 200 ký tự.'
            : 'Nội dung training không được vượt quá 500.000 ký tự.',
      );
      return false;
    }
    return _run(() async {
      await _repository.addKnowledge(cleanTitle, cleanText);
      state = state.copyWith(documents: await _repository.fetchKnowledge());
    });
  }

  Future<bool> delete(String id) => _run(() async {
    await _repository.deleteKnowledge(id);
    state = state.copyWith(
      documents: state.documents.where((item) => item.id != id).toList(),
    );
  });

  Future<bool> sync() => _run(_repository.syncKnowledge);

  Future<bool> sendTestMessage(String question) async {
    final cleanQuestion = question.trim();
    if (cleanQuestion.isEmpty || state.isTesting) return false;
    if (cleanQuestion.length > 10000) {
      state = state.copyWith(
        errorMessage: 'Câu hỏi không được vượt quá 10.000 ký tự.',
      );
      return false;
    }
    state = state.copyWith(
      isTesting: true,
      clearError: true,
      testMessages: [
        ...state.testMessages,
        ChatbotTestMessage(text: cleanQuestion, isUser: true),
      ],
    );
    try {
      final reply = await _repository.sendTestMessage(
        _testSession,
        cleanQuestion,
      );
      state = state.copyWith(
        isTesting: false,
        testMessages: [
          ...state.testMessages,
          ChatbotTestMessage(text: reply, isUser: false),
        ],
      );
      return true;
    } catch (error) {
      state = state.copyWith(isTesting: false, errorMessage: error.toString());
      return false;
    }
  }

  void clearTestConversation() {
    if (state.isTesting) return;
    _testSession = _newTestSession();
    state = state.copyWith(testMessages: const [], clearError: true);
  }

  Future<bool> _run(Future<void> Function() action) async {
    if (state.isSaving) return false;
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      await action();
      state = state.copyWith(isSaving: false);
      return true;
    } catch (error) {
      state = state.copyWith(isSaving: false, errorMessage: error.toString());
      return false;
    }
  }
}

final chatbotRepositoryProvider = Provider<ChatbotRepository>((ref) {
  return ApiChatbotRepository(ref.watch(apiClientProvider));
});

final chatbotControllerProvider =
    StateNotifierProvider<ChatbotController, ChatbotState>((ref) {
      final controller = ChatbotController(
        ref.watch(chatbotRepositoryProvider),
      );
      controller.load();
      return controller;
    });
