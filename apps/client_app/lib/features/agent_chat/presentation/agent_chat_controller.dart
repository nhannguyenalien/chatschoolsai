import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/agent_chat_repository.dart';
import '../data/agent_message.dart';

class AgentChatState {
  const AgentChatState({
    this.messages = const [],
    this.isSending = false,
    this.errorMessage,
  });

  final List<AgentMessage> messages;
  final bool isSending;
  final String? errorMessage;

  AgentChatState copyWith({
    List<AgentMessage>? messages,
    bool? isSending,
    String? errorMessage,
    bool clearError = false,
  }) => AgentChatState(
    messages: messages ?? this.messages,
    isSending: isSending ?? this.isSending,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
  );
}

class AgentChatController extends StateNotifier<AgentChatState> {
  AgentChatController(this._repository) : super(const AgentChatState());
  final AgentChatRepository _repository;

  Future<void> send(String value) async {
    final content = value.trim();
    if (content.isEmpty || state.isSending) return;
    if (content.length > 10000) {
      state = state.copyWith(
        errorMessage: 'Tin nhắn không được vượt quá 10.000 ký tự.',
      );
      return;
    }

    final messages = [
      ...state.messages,
      AgentMessage(role: AgentMessageRole.user, content: content),
    ];
    state = state.copyWith(
      messages: messages,
      isSending: true,
      clearError: true,
    );
    try {
      final reply = await _repository.send(messages);
      state = state.copyWith(
        messages: [
          ...messages,
          AgentMessage(role: AgentMessageRole.assistant, content: reply),
        ],
        isSending: false,
      );
    } catch (error) {
      state = state.copyWith(isSending: false, errorMessage: error.toString());
    }
  }

  void clear() => state = const AgentChatState();

  void dismissError() => state = state.copyWith(clearError: true);
}

final agentChatRepositoryProvider = Provider<AgentChatRepository>((ref) {
  return ApiAgentChatRepository(ref.watch(apiClientProvider));
});

final agentChatControllerProvider =
    StateNotifierProvider<AgentChatController, AgentChatState>((ref) {
      return AgentChatController(ref.watch(agentChatRepositoryProvider));
    });
