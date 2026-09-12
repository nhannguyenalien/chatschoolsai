import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/loyalty_models.dart';
import '../data/loyalty_repository.dart';
import '../data/reward_world_models.dart';

final loyaltyRepositoryProvider = Provider<LoyaltyRepository>((ref) {
  return ApiLoyaltyRepository(ref.watch(apiClientProvider));
});

final rewardCampaignsProvider = FutureProvider<List<RewardCampaign>>((ref) {
  return ref.watch(loyaltyRepositoryProvider).fetchCampaigns();
});

final loyaltyProgramProvider = FutureProvider<LoyaltyProgram?>((ref) {
  return ref.watch(loyaltyRepositoryProvider).fetchProgram();
});
