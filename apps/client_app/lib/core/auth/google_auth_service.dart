import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import 'package:pocketbase/pocketbase.dart';

import '../config/app_config.dart';
import 'oauth_window.dart';

class GoogleSignInResult {
  const GoogleSignInResult({
    required this.apiKey,
    required this.tenant,
    this.displayName,
  });

  final String apiKey;
  final String tenant;
  final String? displayName;
}

class GoogleAuthException implements Exception {
  const GoogleAuthException(this.message);

  final String message;
}

abstract interface class GoogleAuthService {
  Future<GoogleSignInResult> signIn();
  Future<void> signOut();
}

class PocketBaseGoogleAuthService implements GoogleAuthService {
  PocketBaseGoogleAuthService(String baseUrl) : _client = PocketBase(baseUrl);

  static const _tenantAliases = {'toidayhoc@datdia.com': 'huutin'};
  final PocketBase _client;

  @override
  Future<GoogleSignInResult> signIn() async {
    // Reserve the browser window before the first await so Chrome recognizes
    // it as a direct result of the user's click and does not block it.
    final oauthWindow = OAuthWindow.reserve();
    try {
      if (oauthWindow.wasBlocked) {
        throw const GoogleAuthException(
          'Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép popup rồi thử lại.',
        );
      }

      final auth = await _client
          .collection('tenants')
          .authWithOAuth2('google', (url) async {
            final opened = await oauthWindow.navigate(url);
            if (!opened) {
              throw const GoogleAuthException(
                'Không thể mở cửa sổ đăng nhập Google.',
              );
            }
          })
          .timeout(
            const Duration(minutes: 2),
            onTimeout: () => throw const GoogleAuthException(
              'Đăng nhập Google quá thời gian chờ. Vui lòng thử lại.',
            ),
          );

      oauthWindow.close();

      final authRecord = auth.record;
      if (authRecord == null) {
        throw const GoogleAuthException(
          'Không nhận được thông tin tài khoản Google.',
        );
      }

      final recordEmail = authRecord.getStringValue('email').trim();
      final oauthEmail = auth.meta['email']?.toString().trim() ?? '';
      final email = (recordEmail.isNotEmpty ? recordEmail : oauthEmail)
          .toLowerCase();
      final expectedTenant = _tenantAliases[email];
      var tenant = authRecord.getStringValue('tenant').trim();
      if (expectedTenant != null && tenant != expectedTenant) {
        final updatedRecord = await _client
            .collection('tenants')
            .update(
              authRecord.id,
              body: {
                'tenant': expectedTenant,
                if (authRecord.getStringValue('name').trim().isNotEmpty)
                  'name': authRecord.getStringValue('name').trim(),
              },
            );
        tenant = updatedRecord.getStringValue('tenant').trim();
      }
      if (tenant.isEmpty) {
        throw const GoogleAuthException(
          'Tài khoản Google chưa được gắn với cửa hàng.',
        );
      }

      final botConfig = await _client
          .collection('bot_configs')
          .getFirstListItem(
            _client.filter('tenant = {:tenant}', {'tenant': tenant}),
            fields: 'tenant,api_key',
          );
      final apiKey = botConfig.getStringValue('api_key').trim();
      if (apiKey.isEmpty) {
        throw const GoogleAuthException(
          'Cửa hàng chưa có API key cho chatbot.',
        );
      }

      final name = authRecord.getStringValue('name').trim();
      return GoogleSignInResult(
        apiKey: apiKey,
        tenant: tenant,
        displayName: name.isNotEmpty ? name : (email.isNotEmpty ? email : null),
      );
    } on GoogleAuthException {
      oauthWindow.close();
      _client.authStore.clear();
      rethrow;
    } catch (error, stackTrace) {
      oauthWindow.close();
      debugPrint('Google OAuth failed: $error');
      debugPrintStack(stackTrace: stackTrace);
      _client.authStore.clear();
      throw GoogleAuthException(
        kDebugMode
            ? 'Đăng nhập Google không thành công: $error'
            : 'Đăng nhập Google không thành công. Vui lòng thử lại.',
      );
    }
  }

  @override
  Future<void> signOut() async => _client.authStore.clear();
}

final googleAuthServiceProvider = Provider<GoogleAuthService>((ref) {
  return PocketBaseGoogleAuthService(
    ref.watch(appConfigProvider).pocketBaseUrl,
  );
});
