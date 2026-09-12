import '../../../core/network/api_client.dart';
import 'billing_status.dart';

abstract interface class BillingRepository {
  Future<BillingStatus> fetchStatus();
}

class ApiBillingRepository implements BillingRepository {
  const ApiBillingRepository(this._client);

  final ApiClient _client;

  @override
  Future<BillingStatus> fetchStatus() async {
    final json = await _client.getJson('/api/v1/billing');
    return BillingStatus.fromJson(json);
  }
}
