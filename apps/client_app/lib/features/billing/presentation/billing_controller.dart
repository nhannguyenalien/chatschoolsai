import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/billing_repository.dart';
import '../data/billing_status.dart';

final billingRepositoryProvider = Provider<BillingRepository>((ref) {
  return ApiBillingRepository(ref.watch(apiClientProvider));
});

final billingStatusProvider = FutureProvider<BillingStatus>((ref) {
  return ref.watch(billingRepositoryProvider).fetchStatus();
});
