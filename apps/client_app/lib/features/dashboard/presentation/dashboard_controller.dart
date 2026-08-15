import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/dashboard_repository.dart';
import '../data/dashboard_status.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return ApiDashboardRepository(ref.watch(apiClientProvider));
});

final dashboardStatusProvider = FutureProvider<DashboardStatus>((ref) {
  return ref.watch(dashboardRepositoryProvider).fetchStatus();
});
