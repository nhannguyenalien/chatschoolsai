import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/onboarding_service.dart';
import '../../../core/localization/app_localizations.dart';
import '../data/bot_config.dart';
import 'chatbot_controller.dart';

class ChatbotScreen extends ConsumerWidget {
  const ChatbotScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(chatbotControllerProvider);
    if (state.isLoading && state.config == null) {
      return const Center(child: CircularProgressIndicator());
    }
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 2),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    context.l10n.tr('chatbot_manage'),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                FilledButton.tonalIcon(
                  key: const Key('create-bot-button'),
                  onPressed: state.isSaving
                      ? null
                      : () => _createBot(context, ref),
                  icon: const Icon(Icons.add_rounded),
                  label: Text(context.l10n.tr('new_bot')),
                ),
              ],
            ),
          ),
          TabBar(
            tabs: [
              Tab(text: context.l10n.tr('configuration')),
              Tab(text: context.l10n.tr('training')),
              Tab(text: context.l10n.tr('test_chatbot')),
            ],
          ),
          if (state.errorMessage != null)
            MaterialBanner(
              content: Text(state.errorMessage!),
              actions: [
                TextButton(
                  onPressed: () =>
                      ref.read(chatbotControllerProvider.notifier).load(),
                  child: Text(context.l10n.tr('retry')),
                ),
              ],
            ),
          Expanded(
            child: TabBarView(
              children: [
                _ConfigForm(config: state.config, busy: state.isSaving),
                _TrainingView(busy: state.isSaving),
                const _ChatbotTestView(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _createBot(BuildContext context, WidgetRef ref) async {
    final tenant = TextEditingController();
    final name = TextEditingController();
    String? error;
    var busy = false;
    final result = await showDialog<ProvisionedBot>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(context.l10n.tr('new_bot')),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: tenant,
                  decoration: InputDecoration(
                    labelText: context.l10n.tr('bot_id_label'),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: name,
                  decoration: InputDecoration(
                    labelText: context.l10n.tr('bot_name'),
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: busy ? null : () => Navigator.pop(context),
              child: Text(context.l10n.tr('cancel')),
            ),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (tenant.text.trim().isEmpty ||
                          name.text.trim().isEmpty) {
                        setState(
                          () => error = context.l10n.tr('complete_bot_fields'),
                        );
                        return;
                      }
                      setState(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        final bot = await ref
                            .read(onboardingServiceProvider)
                            .createBot(tenant: tenant.text, botName: name.text);
                        if (context.mounted) Navigator.pop(context, bot);
                      } on OnboardingException catch (exception) {
                        if (context.mounted) {
                          setState(() {
                            busy = false;
                            error = exception.message;
                          });
                        }
                      }
                    },
              child: Text(
                busy
                    ? context.l10n.tr('creating')
                    : context.l10n.tr('create_bot'),
              ),
            ),
          ],
        ),
      ),
    );
    tenant.dispose();
    name.dispose();
    if (result == null || !context.mounted) return;
    await ref.read(authControllerProvider.notifier).useProvisionedBot(result);
    ref.invalidate(chatbotControllerProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${context.l10n.tr('bot_created')} “${result.botName}”.',
          ),
        ),
      );
    }
  }
}

class _ChatbotTestView extends ConsumerStatefulWidget {
  const _ChatbotTestView();

  @override
  ConsumerState<_ChatbotTestView> createState() => _ChatbotTestViewState();
}

class _ChatbotTestViewState extends ConsumerState<_ChatbotTestView> {
  final input = TextEditingController();
  final scroll = ScrollController();

  @override
  void dispose() {
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatbotControllerProvider);
    ref.listen(chatbotControllerProvider, (previous, next) {
      if (previous?.testMessages.length != next.testMessages.length) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (scroll.hasClients) {
            scroll.animateTo(
              scroll.position.maxScrollExtent,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOut,
            );
          }
        });
      }
    });
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
          child: Row(
            children: [
              Expanded(child: Text(context.l10n.tr('usage_notice'))),
              TextButton.icon(
                onPressed: state.isTesting || state.testMessages.isEmpty
                    ? null
                    : () => ref
                          .read(chatbotControllerProvider.notifier)
                          .clearTestConversation(),
                icon: const Icon(Icons.refresh),
                label: Text(context.l10n.tr('new_chat')),
              ),
            ],
          ),
        ),
        Expanded(
          child: state.testMessages.isEmpty
              ? Center(child: Text(context.l10n.tr('training_question')))
              : ListView.builder(
                  controller: scroll,
                  padding: const EdgeInsets.all(16),
                  itemCount: state.testMessages.length,
                  itemBuilder: (context, index) {
                    final message = state.testMessages[index];
                    return Align(
                      alignment: message.isUser
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 680),
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: message.isUser
                              ? Theme.of(context).colorScheme.primaryContainer
                              : Theme.of(context).colorScheme.surfaceContainer,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(message.text),
                      ),
                    );
                  },
                ),
        ),
        if (state.isTesting) const LinearProgressIndicator(),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: input,
                    enabled: !state.isTesting,
                    minLines: 1,
                    maxLines: 5,
                    maxLength: 10000,
                    decoration: InputDecoration(
                      hintText: context.l10n.tr('chatbot_question_hint'),
                      counterText: '',
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: context.l10n.tr('send'),
                  onPressed: state.isTesting ? null : _send,
                  icon: const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _send() async {
    final question = input.text;
    if (question.trim().isEmpty) return;
    input.clear();
    final ok = await ref
        .read(chatbotControllerProvider.notifier)
        .sendTestMessage(question);
    if (!ok && mounted && input.text.isEmpty) input.text = question;
  }
}

class _ConfigForm extends ConsumerStatefulWidget {
  const _ConfigForm({required this.config, required this.busy});
  final BotConfig? config;
  final bool busy;

  @override
  ConsumerState<_ConfigForm> createState() => _ConfigFormState();
}

class _ConfigFormState extends ConsumerState<_ConfigForm> {
  final key = GlobalKey<FormState>();
  late final name = TextEditingController();
  late final greeting = TextEditingController();
  late final prompt = TextEditingController();
  late final model = TextEditingController();
  late final temperature = TextEditingController();
  late final maxTokens = TextEditingController();
  bool streaming = false;
  bool initialized = false;

  @override
  void didUpdateWidget(covariant _ConfigForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    _initialize();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _initialize();
  }

  void _initialize() {
    final value = widget.config;
    if (initialized || value == null) return;
    initialized = true;
    name.text = value.botName;
    greeting.text = value.greeting;
    prompt.text = value.systemPrompt;
    model.text = value.model;
    temperature.text = value.temperature.toString();
    maxTokens.text = value.maxTokens.toString();
    streaming = value.streaming;
  }

  @override
  void dispose() {
    for (final controller in [
      name,
      greeting,
      prompt,
      model,
      temperature,
      maxTokens,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.config;
    if (config == null) {
      return Center(child: Text(context.l10n.tr('no_config')));
    }
    return Form(
      key: key,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextFormField(
            controller: name,
            decoration: InputDecoration(labelText: context.l10n.tr('bot_name')),
            validator: _required,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: greeting,
            decoration: InputDecoration(labelText: context.l10n.tr('greeting')),
            minLines: 2,
            maxLines: 4,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: prompt,
            decoration: const InputDecoration(labelText: 'System prompt'),
            minLines: 5,
            maxLines: 12,
            validator: _required,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: model,
            decoration: const InputDecoration(labelText: 'Model'),
            validator: _required,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: temperature,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Temperature (0–2)',
                  ),
                  validator: _temperature,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: maxTokens,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Max tokens'),
                  validator: _tokens,
                ),
              ),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Streaming'),
            value: streaming,
            onChanged: widget.busy
                ? null
                : (value) => setState(() => streaming = value),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: widget.busy ? null : () => _save(config),
            icon: widget.busy
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_outlined),
            label: Text(context.l10n.tr('save_config')),
          ),
        ],
      ),
    );
  }

  String? _required(String? value) => value == null || value.trim().isEmpty
      ? context.l10n.tr('required')
      : null;
  String? _temperature(String? value) {
    final number = double.tryParse(value ?? '');
    return number == null || number < 0 || number > 2
        ? context.l10n.tr('number_0_2')
        : null;
  }

  String? _tokens(String? value) {
    final number = int.tryParse(value ?? '');
    return number == null || number < 1 || number > 32768
        ? context.l10n.tr('number_1_32768')
        : null;
  }

  Future<void> _save(BotConfig current) async {
    if (!key.currentState!.validate()) return;
    final updated = current.copyWith(
      botName: name.text,
      greeting: greeting.text,
      systemPrompt: prompt.text,
      model: model.text,
      temperature: double.parse(temperature.text),
      maxTokens: int.parse(maxTokens.text),
      streaming: streaming,
    );
    final ok = await ref.read(chatbotControllerProvider.notifier).save(updated);
    if (mounted && ok) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(context.l10n.tr('config_saved'))));
    }
  }
}

class _TrainingView extends ConsumerWidget {
  const _TrainingView({required this.busy});
  final bool busy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final documents = ref.watch(chatbotControllerProvider).documents;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              FilledButton.icon(
                onPressed: busy ? null : () => _add(context, ref),
                icon: const Icon(Icons.add),
                label: Text(context.l10n.tr('add_document')),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                onPressed: busy
                    ? null
                    : () => ref.read(chatbotControllerProvider.notifier).sync(),
                icon: const Icon(Icons.sync),
                label: Text(context.l10n.tr('sync_again')),
              ),
            ],
          ),
        ),
        Expanded(
          child: documents.isEmpty
              ? Center(child: Text(context.l10n.tr('no_training')))
              : ListView.builder(
                  itemCount: documents.length,
                  itemBuilder: (context, index) {
                    final item = documents[index];
                    return ListTile(
                      leading: const Icon(Icons.description_outlined),
                      title: Text(item.title),
                      subtitle: Text(
                        '${item.charCount} ${context.l10n.tr('characters')}',
                      ),
                      trailing: IconButton(
                        tooltip: context.l10n.tr('delete'),
                        onPressed: busy
                            ? null
                            : () => _delete(context, ref, item.id, item.title),
                        icon: const Icon(Icons.delete_outline),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final title = TextEditingController();
    final text = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.tr('add_training')),
        content: SizedBox(
          width: 560,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                maxLength: 200,
                decoration: InputDecoration(
                  labelText: context.l10n.tr('title'),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: text,
                maxLength: 500000,
                minLines: 6,
                maxLines: 12,
                decoration: InputDecoration(
                  labelText: context.l10n.tr('content'),
                  counterText: '',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(context.l10n.tr('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(context.l10n.tr('add')),
          ),
        ],
      ),
    );
    if (result == true) {
      await ref
          .read(chatbotControllerProvider.notifier)
          .add(title.text, text.text);
    }
    title.dispose();
    text.dispose();
  }

  Future<void> _delete(
    BuildContext context,
    WidgetRef ref,
    String id,
    String title,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.tr('delete_training')),
        content: Text('“$title” ${context.l10n.tr('delete_training_body')}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(context.l10n.tr('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(context.l10n.tr('delete')),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await ref.read(chatbotControllerProvider.notifier).delete(id);
  }
}
