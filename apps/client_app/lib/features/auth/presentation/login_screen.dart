import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/config/app_config.dart';
import '../../../core/auth/onboarding_service.dart';
import '../../../core/localization/app_localizations.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _controller = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final config = ref.watch(appConfigProvider);

    return Scaffold(
      appBar: AppBar(actions: const [LanguageMenu()]),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      Icons.auto_awesome_rounded,
                      size: 52,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Schools AI',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      context.l10n.tr('login_subtitle'),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 28),
                    OutlinedButton(
                      key: const Key('google-sign-in-button'),
                      onPressed: auth.isSubmitting ? null : _signInWithGoogle,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: auth.isSubmitting
                          ? const SizedBox.square(
                              dimension: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'G',
                                  style: TextStyle(
                                    color: Color(0xff4285f4),
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                SizedBox(width: 12),
                                Text(context.l10n.tr('continue_google')),
                              ],
                            ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Text(
                            context.l10n.tr('or_divider'),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      key: const Key('account-email-field'),
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(
                        labelText: context.l10n.tr('login_email_label'),
                        prefixIcon: const Icon(Icons.mail_outline_rounded),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      key: const Key('account-password-field'),
                      controller: _passwordController,
                      obscureText: true,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(
                        labelText: context.l10n.tr('login_password_label'),
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                      ),
                      onSubmitted: auth.isSubmitting
                          ? null
                          : (_) => _signInWithAccount(),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        key: const Key('account-sign-in-button'),
                        onPressed: auth.isSubmitting
                            ? null
                            : _signInWithAccount,
                        child: auth.isSubmitting
                            ? const SizedBox.square(
                                dimension: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(context.l10n.tr('sign_in_account_button')),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextButton.icon(
                      key: const Key('register-account-button'),
                      onPressed: auth.isSubmitting ? null : _showRegistration,
                      icon: const Icon(Icons.person_add_alt_1_rounded),
                      label: Text(context.l10n.tr('create_account_bot')),
                    ),
                    if (auth.errorMessage != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        auth.errorMessage!,
                        key: const Key('auth-error'),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ],
                    if (config.environment != AppEnvironment.production) ...[
                      const SizedBox(height: 16),
                      ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: Text(context.l10n.tr('api_login_dev')),
                        children: [
                          TextField(
                            key: const Key('api-key-field'),
                            controller: _controller,
                            obscureText: true,
                            autocorrect: false,
                            enableSuggestions: false,
                            decoration: const InputDecoration(
                              labelText: 'API key',
                              prefixIcon: Icon(Icons.key_rounded),
                            ),
                            onSubmitted: auth.isSubmitting
                                ? null
                                : (_) => _submit(),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              key: const Key('sign-in-button'),
                              onPressed: auth.isSubmitting ? null : _submit,
                              icon: const Icon(Icons.login_rounded),
                              label: Text(context.l10n.tr('continue_api')),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submit() => ref
      .read(authControllerProvider.notifier)
      .signInWithApiKey(_controller.text);

  Future<void> _signInWithGoogle() =>
      ref.read(authControllerProvider.notifier).signInWithGoogle();

  Future<void> _signInWithAccount() => ref
      .read(authControllerProvider.notifier)
      .signInWithEmailPassword(_emailController.text, _passwordController.text);

  Future<void> _showRegistration() async {
    final result = await showDialog<ProvisionedBot>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _RegistrationDialog(),
    );
    if (result != null) {
      await ref.read(authControllerProvider.notifier).useProvisionedBot(result);
    }
  }
}

class _RegistrationDialog extends ConsumerStatefulWidget {
  const _RegistrationDialog();

  @override
  ConsumerState<_RegistrationDialog> createState() =>
      _RegistrationDialogState();
}

class _RegistrationDialogState extends ConsumerState<_RegistrationDialog> {
  final formKey = GlobalKey<FormState>();
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  final tenant = TextEditingController();
  final botName = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    for (final value in [name, email, password, tenant, botName]) {
      value.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(context.l10n.tr('create_account')),
    content: SizedBox(
      width: 440,
      child: Form(
        key: formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _field(name, context.l10n.tr('your_name')),
              _field(email, 'Email', type: TextInputType.emailAddress),
              _field(password, context.l10n.tr('password_hint'), secret: true),
              _field(tenant, context.l10n.tr('tenant_hint')),
              _field(botName, context.l10n.tr('bot_name_hint')),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
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
      ),
    ),
    actions: [
      TextButton(
        onPressed: busy ? null : () => Navigator.pop(context),
        child: Text(context.l10n.tr('cancel')),
      ),
      FilledButton(
        onPressed: busy ? null : _submit,
        child: Text(
          busy ? context.l10n.tr('creating') : context.l10n.tr('create_login'),
        ),
      ),
    ],
  );

  Widget _field(
    TextEditingController controller,
    String label, {
    bool secret = false,
    TextInputType? type,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: TextFormField(
      controller: controller,
      obscureText: secret,
      keyboardType: type,
      decoration: InputDecoration(labelText: label),
      validator: (value) =>
          (value?.trim().isEmpty ?? true) ? context.l10n.tr('required') : null,
    ),
  );

  Future<void> _submit() async {
    if (!(formKey.currentState?.validate() ?? false)) return;
    if (password.text.length < 8) {
      setState(() => error = context.l10n.tr('password_short'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await ref
          .read(onboardingServiceProvider)
          .register(
            name: name.text,
            email: email.text,
            password: password.text,
            tenant: tenant.text,
            botName: botName.text,
          );
      if (mounted) {
        Navigator.pop(context, result);
      }
    } on OnboardingException catch (exception) {
      if (mounted) {
        setState(() {
          busy = false;
          error = exception.message;
        });
      }
    }
  }
}
