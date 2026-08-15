import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/core/auth/auth_controller.dart';
import 'package:schools_ai_app/core/auth/credential_store.dart';
import 'package:schools_ai_app/core/auth/google_auth_service.dart';
import 'package:schools_ai_app/core/auth/onboarding_service.dart';

class MemoryCredentialStore implements CredentialStore {
  String? value;

  @override
  Future<void> clear() async => value = null;

  @override
  Future<String?> readApiKey() async => value;

  @override
  Future<void> saveApiKey(String apiKey) async => value = apiKey;
}

class FakeGoogleAuthService implements GoogleAuthService {
  FakeGoogleAuthService({this.result, this.error});

  final GoogleSignInResult? result;
  final GoogleAuthException? error;
  bool signedOut = false;

  @override
  Future<GoogleSignInResult> signIn() async {
    if (error != null) throw error!;
    return result!;
  }

  @override
  Future<void> signOut() async => signedOut = true;
}

class FailingCredentialStore extends MemoryCredentialStore {
  @override
  Future<void> saveApiKey(String apiKey) async {
    throw StateError('Keychain is unavailable');
  }
}

void main() {
  test(
    'sign in trims and stores the API key, then sign out clears it',
    () async {
      final store = MemoryCredentialStore();
      final googleAuth = FakeGoogleAuthService();
      final controller = AuthController(store, googleAuth);
      await controller.initialize();

      await controller.signInWithApiKey('  secret-key  ');
      expect(controller.state.apiKey, 'secret-key');
      expect(store.value, 'secret-key');

      await controller.signOut();
      expect(controller.state.isAuthenticated, isFalse);
      expect(store.value, isNull);
      expect(googleAuth.signedOut, isTrue);
    },
  );

  test('rejects an empty API key', () async {
    final controller = AuthController(
      MemoryCredentialStore(),
      FakeGoogleAuthService(),
    );
    await controller.signInWithApiKey('   ');

    expect(controller.state.isAuthenticated, isFalse);
    expect(controller.state.errorMessage, isNotNull);
  });

  test('Google sign in stores tenant API key and user details', () async {
    final store = MemoryCredentialStore();
    final controller = AuthController(
      store,
      FakeGoogleAuthService(
        result: const GoogleSignInResult(
          apiKey: 'google-tenant-key',
          tenant: 'school-a',
          displayName: 'Teacher A',
        ),
      ),
    );

    await controller.signInWithGoogle();

    expect(controller.state.apiKey, 'google-tenant-key');
    expect(controller.state.tenant, 'school-a');
    expect(controller.state.displayName, 'Teacher A');
    expect(store.value, 'google-tenant-key');
    expect(controller.state.errorMessage, isNull);
  });

  test('Google sign in exposes a safe error and stays signed out', () async {
    final controller = AuthController(
      MemoryCredentialStore(),
      FakeGoogleAuthService(
        error: const GoogleAuthException('Tài khoản chưa được cấu hình.'),
      ),
    );

    await controller.signInWithGoogle();

    expect(controller.state.isAuthenticated, isFalse);
    expect(controller.state.isSubmitting, isFalse);
    expect(controller.state.errorMessage, 'Tài khoản chưa được cấu hình.');
  });

  test('Google sign in reports a secure storage failure', () async {
    final controller = AuthController(
      FailingCredentialStore(),
      FakeGoogleAuthService(
        result: const GoogleSignInResult(
          apiKey: 'google-tenant-key',
          tenant: 'school-a',
        ),
      ),
    );

    await controller.signInWithGoogle();

    expect(controller.state.isAuthenticated, isFalse);
    expect(controller.state.isSubmitting, isFalse);
    expect(
      controller.state.errorMessage,
      'Google đã xác thực nhưng app không thể lưu phiên đăng nhập an toàn.',
    );
  });

  test('switches to a newly provisioned bot and persists its key', () async {
    final store = MemoryCredentialStore();
    final controller = AuthController(store, FakeGoogleAuthService());

    await controller.useProvisionedBot(
      const ProvisionedBot(
        apiKey: 'sk_second',
        tenant: 'second-bot',
        botName: 'Bot 2',
      ),
    );

    expect(controller.state.apiKey, 'sk_second');
    expect(controller.state.tenant, 'second-bot');
    expect(store.value, 'sk_second');
  });
}
