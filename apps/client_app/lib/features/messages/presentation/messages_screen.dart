import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_localizations.dart';
import '../../calls/presentation/call_controller.dart';
import '../data/chat_message.dart';
import 'messages_controller.dart';

class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key});

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  String? selectedSession;
  bool needsHumanOnly = false;

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(messagesProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.tr('nav_messages'),
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 6),
              Text(
                context.l10n.tr('messages_subtitle'),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: value.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => _LoadError(
              message: error.toString(),
              onRetry: () => ref.invalidate(messagesProvider),
            ),
            data: _buildContent,
          ),
        ),
      ],
    );
  }

  Widget _buildContent(List<ChatSession> allSessions) {
    final sessions = needsHumanOnly
        ? allSessions.where((session) => session.requiresHuman).toList()
        : allSessions;
    ChatSession? selected;
    for (final session in allSessions) {
      if (session.id == selectedSession) selected = session;
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final split = constraints.maxWidth >= 760;
        if (!split && selected != null) {
          return _Conversation(
            session: selected,
            showBack: true,
            onBack: () => setState(() => selectedSession = null),
            onRefresh: _refresh,
          );
        }
        final list = _SessionList(
          sessions: sessions,
          selectedSession: selected?.id,
          needsHumanOnly: needsHumanOnly,
          onFilterChanged: (value) => setState(() => needsHumanOnly = value),
          onSelected: (session) => setState(() => selectedSession = session.id),
          onRefresh: _refresh,
        );
        if (!split) return list;
        return Row(
          children: [
            SizedBox(width: 350, child: list),
            const VerticalDivider(width: 1),
            Expanded(
              child: selected == null
                  ? const _NoConversation()
                  : _Conversation(session: selected, onRefresh: _refresh),
            ),
          ],
        );
      },
    );
  }

  Future<void> _refresh() => ref.refresh(messagesProvider.future);
}

class _SessionList extends StatelessWidget {
  const _SessionList({
    required this.sessions,
    required this.selectedSession,
    required this.needsHumanOnly,
    required this.onFilterChanged,
    required this.onSelected,
    required this.onRefresh,
  });

  final List<ChatSession> sessions;
  final String? selectedSession;
  final bool needsHumanOnly;
  final ValueChanged<bool> onFilterChanged;
  final ValueChanged<ChatSession> onSelected;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: SegmentedButton<bool>(
          segments: [
            ButtonSegment(value: false, label: Text(context.l10n.tr('all'))),
            ButtonSegment(
              value: true,
              label: Text(context.l10n.tr('needs_attention')),
              icon: const Icon(Icons.support_agent_rounded),
            ),
          ],
          selected: {needsHumanOnly},
          onSelectionChanged: (values) => onFilterChanged(values.first),
        ),
      ),
      Expanded(
        child: RefreshIndicator(
          onRefresh: onRefresh,
          child: sessions.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 100),
                    const Icon(Icons.forum_outlined, size: 48),
                    const SizedBox(height: 12),
                    Center(child: Text(context.l10n.tr('no_conversations'))),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: sessions.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final session = sessions[index];
                    return ListTile(
                      selected: session.id == selectedSession,
                      leading: CircleAvatar(
                        child: Text(
                          session.customerName.characters.first.toUpperCase(),
                        ),
                      ),
                      title: Row(
                        children: [
                          Expanded(
                            child: Text(
                              session.customerName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (session.requiresHuman)
                            const Icon(
                              Icons.circle,
                              size: 10,
                              color: Colors.orange,
                            ),
                        ],
                      ),
                      subtitle: Text(
                        session.lastMessage.text,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: () => onSelected(session),
                    );
                  },
                ),
        ),
      ),
    ],
  );
}

class _Conversation extends ConsumerStatefulWidget {
  const _Conversation({
    required this.session,
    required this.onRefresh,
    this.showBack = false,
    this.onBack,
  });

  final ChatSession session;
  final Future<void> Function() onRefresh;
  final bool showBack;
  final VoidCallback? onBack;

  @override
  ConsumerState<_Conversation> createState() => _ConversationState();
}

class _ConversationState extends ConsumerState<_Conversation> {
  final input = TextEditingController();
  bool sending = false;

  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      ListTile(
        leading: widget.showBack
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: widget.onBack,
              )
            : const Icon(Icons.forum_rounded),
        title: Text(widget.session.customerName),
        subtitle: Text('${context.l10n.tr('session')} ${widget.session.id}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.session.requiresHuman)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Chip(
                  label: Text(context.l10n.tr('needs_attention')),
                  avatar: const Icon(Icons.priority_high),
                ),
              ),
            IconButton(
              tooltip: context.l10n.tr('call_customer'),
              icon: const Icon(Icons.call_outlined),
              onPressed: ref.watch(callControllerProvider).isIdle
                  ? () => ref
                        .read(callControllerProvider.notifier)
                        .startCall(widget.session.id)
                  : null,
            ),
          ],
        ),
      ),
      const Divider(height: 1),
      Expanded(
        child: RefreshIndicator(
          onRefresh: widget.onRefresh,
          child: ListView.builder(
            reverse: true,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(18),
            itemCount: widget.session.messages.length,
            itemBuilder: (context, index) {
              final message = widget.session.messages.reversed.elementAt(index);
              return _MessageBubble(message: message);
            },
          ),
        ),
      ),
      SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: input,
                  minLines: 1,
                  maxLines: 4,
                  enabled: !sending,
                  decoration: InputDecoration(
                    hintText: context.l10n.tr('admin_reply_hint'),
                    border: const OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                tooltip: context.l10n.tr('send_reply'),
                onPressed: sending ? null : _send,
                icon: sending
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ],
          ),
        ),
      ),
    ],
  );

  Future<void> _send() async {
    final text = input.text.trim();
    if (text.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      await ref
          .read(messagesRepositoryProvider)
          .sendReply(session: widget.session.id, text: text);
      input.clear();
      ref.invalidate(messagesProvider);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${context.l10n.tr('reply_failed')}: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final outgoing = message.isBot;
    return Align(
      alignment: outgoing ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 560),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: outgoing
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.isAdmin ? 'Admin' : message.username,
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: 3),
            SelectableText(message.text),
          ],
        ),
      ),
    );
  }
}

class _NoConversation extends StatelessWidget {
  const _NoConversation();

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.mark_chat_unread_outlined, size: 56),
        const SizedBox(height: 12),
        Text(context.l10n.tr('select_conversation')),
      ],
    ),
  );
}

class _LoadError extends StatelessWidget {
  const _LoadError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.error_outline, size: 48),
        const SizedBox(height: 12),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh),
          label: Text(context.l10n.tr('retry')),
        ),
      ],
    ),
  );
}
