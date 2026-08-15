import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:schools_ai_app/core/auth/credential_store.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'regular macOS Keychain can persist the login credential',
    (_) async {
      const value = 'schools-ai-test-value';
      const storage = MacOsKeychainCredentialStore();

      await storage.clear();
      await storage.saveApiKey(value);
      expect(await storage.readApiKey(), value);
      await storage.clear();
      expect(await storage.readApiKey(), isNull);
    },
    skip: !Platform.isMacOS,
  );
}
