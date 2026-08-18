import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'account_auth_service.dart';
import 'credential_store.dart';
import 'google_auth_service.dart';
import 'onboarding_service.dart';

class AuthState {
  const AuthState({
    this.initialized = false,
    this.apiKey,
    this.tenant,
    this.displayName,
    this.isSubmitting = false,
    this.errorMessage,
  });

  final bool initialized;
  final String? apiKey;
  final String? tenant;
  final String? displayName;
  final bool isSubmitting;
  final String? errorMessage;

  bool get isAuthenticated => apiKey?.isNotEmpty ?? false;

  AuthState copyWith({
    bool? initialized,
    String? apiKey,
    bool clearApiKey = false,
    String? tenant,
    bool clearTenant = false,
    String? displayName,
    bool clearDisplayName = false,
    bool? isSubmitting,
    String? errorMessage,
    bool clearError = false,
  }) => AuthState(
    initialized: initialized ?? this.initialized,
    apiKey: clearApiKey ? null : (apiKey ?? this.apiKey),
    tenant: clearTenant ? null : (tenant ?? this.tenant),
    displayName: clearDisplayName ? null : (displayName ?? this.displayName),
    isSubmitting: isSubmitting ?? this.isSubmitting,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
  );
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._store, this._googleAuth, this._accountAuth)
    : super(const AuthState()) {
    initialize();
  }

  final CredentialStore _store;
  final GoogleAuthService _googleAuth;
  final AccountAuthService _accountAuth;

  Future<void> initialize() async {
    final apiKey = await _store.readApiKey();
    state = state.copyWith(initialized: true, apiKey: apiKey);
  }

  Future<void> signInWithApiKey(String value) async {
    final apiKey = value.trim();
    if (apiKey.isEmpty) {
      state = state.copyWith(errorMessage: 'Vui lòng nhập API key.');
      return;
    }

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _store.saveApiKey(apiKey);
      state = state.copyWith(apiKey: apiKey, isSubmitting: false);
    } catch (_) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Không thể lưu thông tin đăng nhập an toàn.',
      );
    }
  }

  Future<void> signInWithGoogle() async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final result = await _googleAuth.signIn();
      await _store.saveApiKey(result.apiKey);
      state = state.copyWith(
        apiKey: result.apiKey,
        tenant: result.tenant,
        displayName: result.displayName,
        isSubmitting: false,
      );
    } on GoogleAuthException catch (error) {
      state = state.copyWith(isSubmitting: false, errorMessage: error.message);
    } catch (_) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage:
            'Google đã xác thực nhưng app không thể lưu phiên đăng nhập an toàn.',
      );
    }
  }

  Future<void> signInWithEmailPassword(String email, String password) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final result = await _accountAuth.signInWithPassword(email, password);
      await _store.saveApiKey(result.apiKey);
      state = state.copyWith(
        apiKey: result.apiKey,
        tenant: result.tenant,
        displayName: result.displayName,
        isSubmitting: false,
      );
    } on AccountAuthException catch (error) {
      state = state.copyWith(isSubmitting: false, errorMessage: error.message);
    } catch (_) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Đăng nhập không thành công. Vui lòng thử lại.',
      );
    }
  }

  Future<void> useProvisionedBot(ProvisionedBot bot) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _store.saveApiKey(bot.apiKey);
      state = state.copyWith(
        apiKey: bot.apiKey,
        tenant: bot.tenant,
        displayName: bot.displayName,
        isSubmitting: false,
      );
    } catch (_) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Không thể lưu bot trên thiết bị.',
      );
    }
  }

  Future<void> signOut() async {
    await _googleAuth.signOut();
    await _store.clear();
    state = state.copyWith(
      clearApiKey: true,
      clearTenant: true,
      clearDisplayName: true,
      clearError: true,
    );
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) {
    return AuthController(
      ref.watch(credentialStoreProvider),
      ref.watch(googleAuthServiceProvider),
      ref.watch(accountAuthServiceProvider),
    );
  },
);
