import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/agent_message.dart';
import 'agent_chat_controller.dart';

class AgentChatScreen extends ConsumerStatefulWidget {
  const AgentChatScreen({super.key});

  @override
  ConsumerState<AgentChatScreen> createState() => _AgentChatScreenState();
}

class _AgentChatScreenState extends ConsumerState<AgentChatScreen> {
  final inputController = TextEditingController();
  final scrollController = ScrollController();

  @override
  void dispose() {
    inputController.dispose();
    scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(agentChatControllerProvider, (previous, next) {
      if (previous?.messages.length != next.messages.length) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToEnd());
      }
    });
    final state = ref.watch(agentChatControllerProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 12, 12),
          child: Row(
            children: [
              const CircleAvatar(child: Icon(Icons.smart_toy_rounded)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'AI Agent',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const Text('Trợ lý cấu hình và vận hành'),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Xóa hội thoại',
                onPressed: state.messages.isEmpty
                    ? null
                    : () => ref
                          .read(agentChatControllerProvider.notifier)
                          .clear(),
                icon: const Icon(Icons.delete_outline_rounded),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: state.messages.isEmpty
              ? const _ChatWelcome()
              : ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 24,
                  ),
                  itemCount: state.messages.length + (state.isSending ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == state.messages.length) {
                      return const _TypingBubble();
                    }
                    return _MessageBubble(message: state.messages[index]);
                  },
                ),
        ),
        if (state.errorMessage != null)
          MaterialBanner(
            content: Text(state.errorMessage!),
            actions: [
              TextButton(
                onPressed: () => ref
                    .read(agentChatControllerProvider.notifier)
                    .dismissError(),
                child: const Text('Đóng'),
              ),
            ],
          ),
        _ChatInput(
          controller: inputController,
          enabled: !state.isSending,
          onSend: _send,
        ),
      ],
    );
  }

  void _send() {
    final content = inputController.text;
    if (content.trim().isEmpty) return;
    inputController.clear();
    ref.read(agentChatControllerProvider.notifier).send(content);
  }

  void _scrollToEnd() {
    if (!scrollController.hasClients) return;
    scrollController.animateTo(
      scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }
}

class _ChatWelcome extends StatelessWidget {
  const _ChatWelcome();

  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 560),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.auto_awesome_rounded, size: 52),
            const SizedBox(height: 14),
            Text(
              'Tôi có thể giúp gì?',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const Text(
              'Hỏi về cấu hình hiện tại, kết nối kênh hoặc yêu cầu Agent cập nhật hệ thống bằng ngôn ngữ tự nhiên.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            Card(
              color: Theme.of(context).colorScheme.errorContainer,
              child: const Padding(
                padding: EdgeInsets.all(14),
                child: Text(
                  'Không gửi mật khẩu hoặc bí mật không cần thiết. Nội dung chat sẽ được xử lý qua model AI.',
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});
  final AgentMessage message;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == AgentMessageRole.user;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 680),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isUser
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(18),
        ),
        child: SelectableText(message.content),
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) => const Align(
    alignment: Alignment.centerLeft,
    child: Padding(
      padding: EdgeInsets.all(16),
      child: SizedBox.square(
        dimension: 22,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    ),
  );
}

class _ChatInput extends StatelessWidget {
  const _ChatInput({
    required this.controller,
    required this.enabled,
    required this.onSend,
  });
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              minLines: 1,
              maxLines: 5,
              textInputAction: TextInputAction.newline,
              maxLength: 10000,
              decoration: const InputDecoration(
                hintText: 'Nhập yêu cầu cho Agent…',
                counterText: '',
              ),
            ),
          ),
          const SizedBox(width: 10),
          IconButton.filled(
            tooltip: 'Gửi',
            onPressed: enabled ? onSend : null,
            icon: const Icon(Icons.send_rounded),
          ),
        ],
      ),
    ),
  );
}
