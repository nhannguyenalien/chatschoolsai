import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class CredentialStore {
  Future<String?> readApiKey();
  Future<void> saveApiKey(String apiKey);
  Future<void> clear();
}

class SecureCredentialStore implements CredentialStore {
  const SecureCredentialStore(this._storage);

  static const _key = 'tenant_api_key';
  final FlutterSecureStorage _storage;

  @override
  Future<String?> readApiKey() => _storage.read(key: _key);

  @override
  Future<void> saveApiKey(String apiKey) =>
      _storage.write(key: _key, value: apiKey);

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

class MacOsKeychainCredentialStore implements CredentialStore {
  const MacOsKeychainCredentialStore();

  static const _channel = MethodChannel('com.schoolsai.app/keychain');
  static const _key = 'tenant_api_key';

  @override
  Future<String?> readApiKey() =>
      _channel.invokeMethod<String>('read', {'key': _key});

  @override
  Future<void> saveApiKey(String apiKey) =>
      _channel.invokeMethod<void>('write', {'key': _key, 'value': apiKey});

  @override
  Future<void> clear() => _channel.invokeMethod<void>('delete', {'key': _key});
}

final credentialStoreProvider = Provider<CredentialStore>((_) {
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.macOS) {
    return const MacOsKeychainCredentialStore();
  }
  return const SecureCredentialStore(
    FlutterSecureStorage(
      mOptions: MacOsOptions(
        accountName: 'com.schoolsai.app',
        usesDataProtectionKeychain: false,
      ),
    ),
  );
});
