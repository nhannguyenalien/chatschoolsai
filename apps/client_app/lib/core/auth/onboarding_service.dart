import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import 'auth_controller.dart';

class ProvisionedBot {
  const ProvisionedBot({
    required this.apiKey,
    required this.tenant,
    required this.botName,
    this.displayName,
  });

  final String apiKey;
  final String tenant;
  final String botName;
  final String? displayName;

  factory ProvisionedBot.fromJson(Map<String, dynamic> json) => ProvisionedBot(
    apiKey: json['api_key']?.toString() ?? '',
    tenant: json['tenant']?.toString() ?? '',
    botName: json['bot_name']?.toString() ?? '',
    displayName: json['display_name']?.toString(),
  );
}

class OnboardingException implements Exception {
  const OnboardingException(this.message);
  final String message;
}

class OnboardingService {
  OnboardingService(this._dio, this._readApiKey);

  final Dio _dio;
  final String? Function() _readApiKey;

  Future<ProvisionedBot> register({
    required String name,
    required String email,
    required String password,
    required String tenant,
    required String botName,
  }) => _post(
    '/api/onboarding/register',
    body: {
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
      'tenant': tenant.trim(),
      'bot_name': botName.trim(),
    },
  );

  Future<ProvisionedBot> createBot({
    required String tenant,
    required String botName,
  }) => _post(
    '/api/v1/bots',
    body: {'tenant': tenant.trim(), 'bot_name': botName.trim()},
    authenticated: true,
  );

  Future<ProvisionedBot> _post(
    String path, {
    required Map<String, dynamic> body,
    bool authenticated = false,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        path,
        data: body,
        options: Options(
          headers: {
            'Accept': 'application/json',
            if (authenticated && (_readApiKey()?.isNotEmpty ?? false))
              'Authorization': 'Bearer ${_readApiKey()}',
          },
        ),
      );
      final result = ProvisionedBot.fromJson(response.data ?? const {});
      if (result.apiKey.isEmpty || result.tenant.isEmpty) {
        throw const OnboardingException(
          'Máy chủ trả về dữ liệu bot không hợp lệ.',
        );
      }
      return result;
    } on OnboardingException {
      rethrow;
    } on DioException catch (error) {
      final data = error.response?.data;
      final detail = data is Map ? data['error']?.toString() : null;
      throw OnboardingException(
        detail?.isNotEmpty == true
            ? detail!
            : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.',
      );
    }
  }
}

final onboardingServiceProvider = Provider<OnboardingService>((ref) {
  final config = ref.watch(appConfigProvider);
  return OnboardingService(
    Dio(
      BaseOptions(
        baseUrl: config.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 25),
      ),
    ),
    () => ref.read(authControllerProvider).apiKey,
  );
});
