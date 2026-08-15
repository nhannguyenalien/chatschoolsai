import '../../../core/network/api_client.dart';
import 'dashboard_status.dart';

abstract interface class DashboardRepository {
  Future<DashboardStatus> fetchStatus();
}

class ApiDashboardRepository implements DashboardRepository {
  const ApiDashboardRepository(this._client);

  final ApiClient _client;

  @override
  Future<DashboardStatus> fetchStatus() async {
    final json = await _client.getJson('/api/v1/status');
    return DashboardStatus.fromJson(json);
  }
}
