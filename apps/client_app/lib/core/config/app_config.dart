import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppEnvironment { dev, staging, production }

class AppConfig {
  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.pocketBaseUrl,
  });

  factory AppConfig.fromEnvironment() {
    const environmentName = String.fromEnvironment(
      'APP_ENV',
      defaultValue: 'dev',
    );
    const baseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'https://apic.schoolsai.work',
    );
    const pocketBaseUrl = String.fromEnvironment(
      'POCKETBASE_URL',
      defaultValue: 'https://nhannguyen123-chat.hf.space',
    );

    return AppConfig(
      environment: AppEnvironment.values.firstWhere(
        (value) => value.name == environmentName,
        orElse: () => AppEnvironment.dev,
      ),
      apiBaseUrl: baseUrl.replaceAll(RegExp(r'/$'), ''),
      pocketBaseUrl: pocketBaseUrl.replaceAll(RegExp(r'/$'), ''),
    );
  }

  final AppEnvironment environment;
  final String apiBaseUrl;
  final String pocketBaseUrl;
}

final appConfigProvider = Provider<AppConfig>(
  (_) => AppConfig.fromEnvironment(),
);
