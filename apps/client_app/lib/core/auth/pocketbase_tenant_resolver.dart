import 'package:pocketbase/pocketbase.dart';

/// Looks up the chatbot API key provisioned for [tenant] in `bot_configs`.
/// Shared by every sign-in method (Google, email/password) that authenticates
/// against the `tenants` PocketBase collection and then needs the tenant's
/// bot API key to talk to the worker's `/api/v1/*` endpoints.
Future<String> resolveApiKeyForTenant(PocketBase client, String tenant) async {
  final botConfig = await client
      .collection('bot_configs')
      .getFirstListItem(
        client.filter('tenant = {:tenant}', {'tenant': tenant}),
        fields: 'tenant,api_key',
      );
  return botConfig.getStringValue('api_key').trim();
}
