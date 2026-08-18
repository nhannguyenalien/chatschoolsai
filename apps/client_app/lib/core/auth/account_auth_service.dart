import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pocketbase/pocketbase.dart';

import '../config/app_config.dart';
import 'pocketbase_tenant_resolver.dart';

class AccountSignInResult {
  const AccountSignInResult({
    required this.apiKey,
    required this.tenant,
    this.displayName,
  });

  final String apiKey;
  final String tenant;
  final String? displayName;
}

class AccountAuthException implements Exception {
  const AccountAuthException(this.message);

  final String message;
}

abstract interface class AccountAuthService {
  Future<AccountSignInResult> signInWithPassword(String email, String password);
}

class PocketBaseAccountAuthService implements AccountAuthService {
  PocketBaseAccountAuthService(String baseUrl) : _client = PocketBase(baseUrl);

  final PocketBase _client;

  @override
  Future<AccountSignInResult> signInWithPassword(
    String email,
    String password,
  ) async {
    final trimmedEmail = email.trim();
    if (trimmedEmail.isEmpty || password.isEmpty) {
      throw const AccountAuthException('Vui lòng nhập email và mật khẩu.');
    }
    try {
      final auth = await _client
          .collection('tenants')
          .authWithPassword(trimmedEmail, password);
      final record = auth.record;
      if (record == null) {
        throw const AccountAuthException(
          'Không nhận được thông tin tài khoản.',
        );
      }
      final tenant = record.getStringValue('tenant').trim();
      if (tenant.isEmpty) {
        throw const AccountAuthException(
          'Tài khoản chưa được gắn với cửa hàng.',
        );
      }
      final apiKey = await resolveApiKeyForTenant(_client, tenant);
      if (apiKey.isEmpty) {
        throw const AccountAuthException(
          'Cửa hàng chưa có API key cho chatbot.',
        );
      }
      final name = record.getStringValue('name').trim();
      return AccountSignInResult(
        apiKey: apiKey,
        tenant: tenant,
        displayName: name.isNotEmpty ? name : trimmedEmail,
      );
    } on AccountAuthException {
      _client.authStore.clear();
      rethrow;
    } on ClientException catch (error) {
      _client.authStore.clear();
      if (error.statusCode == 400) {
        throw const AccountAuthException('Email hoặc mật khẩu không đúng.');
      }
      throw AccountAuthException(
        kDebugMode
            ? 'Đăng nhập không thành công: ${error.response}'
            : 'Đăng nhập không thành công. Vui lòng thử lại.',
      );
    } catch (error) {
      _client.authStore.clear();
      throw AccountAuthException(
        kDebugMode
            ? 'Đăng nhập không thành công: $error'
            : 'Đăng nhập không thành công. Vui lòng thử lại.',
      );
    }
  }
}

final accountAuthServiceProvider = Provider<AccountAuthService>((ref) {
  return PocketBaseAccountAuthService(
    ref.watch(appConfigProvider).pocketBaseUrl,
  );
});
