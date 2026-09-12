import '../../../core/network/api_client.dart';
import 'loyalty_models.dart';
import 'reward_world_models.dart';

abstract interface class LoyaltyRepository {
  Future<List<RewardCampaign>> fetchCampaigns();
  Future<void> joinCampaign(String campaignId);
  Future<SpinResult> spin({
    required String campaignId,
    required String customerRef,
  });
  Future<List<CustomerReward>> fetchRewards(String customerRef);
  Future<void> claimReward(String resultId);
  Future<LoyaltyProgram?> fetchProgram();
  Future<LoyaltyProgram> saveProgram({
    required int spendPerPointMinor,
    required int pointsPerStep,
  });
  Future<LoyaltyAccount> fetchAccount(String customerRef);
  Future<SaleResult> recordSale({
    required String customerRef,
    required String receiptRef,
    required int amountMinor,
    String? customerName,
  });
  Future<RedeemResult> redeemPoints({
    required String customerRef,
    required String redemptionRef,
    required int points,
    String? note,
  });
}

class ApiLoyaltyRepository implements LoyaltyRepository {
  const ApiLoyaltyRepository(this._client);

  final ApiClient _client;

  @override
  Future<List<RewardCampaign>> fetchCampaigns() async {
    final json = await _client.getJson(
      '/api/v1/loyalty/reward-world/campaigns',
    );
    final campaigns = json['campaigns'] as List? ?? const [];
    return campaigns
        .whereType<Map>()
        .map((item) => RewardCampaign.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  @override
  Future<void> joinCampaign(String campaignId) => _client.postJson(
    '/api/v1/loyalty/reward-world/campaigns/${Uri.encodeComponent(campaignId)}/join',
  );

  @override
  Future<SpinResult> spin({
    required String campaignId,
    required String customerRef,
  }) async {
    final json = await _client.postJson(
      '/api/v1/loyalty/reward-world/spins',
      body: {
        'campaign_id': campaignId,
        'customer_ref': customerRef,
        'idempotency_key':
            'client_app:$campaignId:$customerRef:${DateTime.now().microsecondsSinceEpoch}',
      },
    );
    return SpinResult.fromJson(
      Map<String, dynamic>.from(json['result'] as Map? ?? const {}),
    );
  }

  @override
  Future<List<CustomerReward>> fetchRewards(String customerRef) async {
    final json = await _client.getJson(
      '/api/v1/loyalty/reward-world/rewards?customer_ref=${Uri.encodeComponent(customerRef)}',
    );
    final rewards = json['rewards'] as List? ?? const [];
    return rewards
        .whereType<Map>()
        .map((item) => CustomerReward.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  @override
  Future<void> claimReward(String resultId) => _client.postJson(
    '/api/v1/loyalty/reward-world/results/${Uri.encodeComponent(resultId)}/claim',
    body: const {'claim_note': 'Xác nhận trên ứng dụng'},
  );

  @override
  Future<LoyaltyProgram?> fetchProgram() async {
    final json = await _client.getJson('/api/v1/loyalty/program');
    final program = json['program'] as Map?;
    return program == null
        ? null
        : LoyaltyProgram.fromJson(Map<String, dynamic>.from(program));
  }

  @override
  Future<LoyaltyProgram> saveProgram({
    required int spendPerPointMinor,
    required int pointsPerStep,
  }) async {
    final json = await _client.putJson(
      '/api/v1/loyalty/program',
      body: {
        'currency': 'VND',
        'spend_per_point_minor': spendPerPointMinor,
        'points_per_step': pointsPerStep,
      },
    );
    return LoyaltyProgram.fromJson(json);
  }

  @override
  Future<LoyaltyAccount> fetchAccount(String customerRef) async {
    final json = await _client.getJson(
      '/api/v1/loyalty/account?customer_ref=${Uri.encodeComponent(customerRef)}&per_page=100',
    );
    return LoyaltyAccount.fromJson(json);
  }

  @override
  Future<SaleResult> recordSale({
    required String customerRef,
    required String receiptRef,
    required int amountMinor,
    String? customerName,
  }) async {
    final json = await _client.postJson(
      '/api/v1/loyalty/sales',
      body: {
        'idempotency_key': 'client_app:sale:$receiptRef',
        'customer_ref': customerRef,
        'source_type': 'manual',
        'source_ref': receiptRef,
        'amount_minor': amountMinor,
        'customer': {'name': customerName ?? '', 'phone': customerRef},
        'metadata': {'channel': 'client_app'},
      },
    );
    return SaleResult.fromJson(json);
  }

  @override
  Future<RedeemResult> redeemPoints({
    required String customerRef,
    required String redemptionRef,
    required int points,
    String? note,
  }) async {
    final json = await _client.postJson(
      '/api/v1/loyalty/redemptions',
      body: {
        'idempotency_key': 'client_app:redeem:$redemptionRef',
        'customer_ref': customerRef,
        'source_ref': redemptionRef,
        'points': points,
        'note': note ?? '',
        'metadata': {'channel': 'client_app'},
      },
    );
    return RedeemResult.fromJson(json);
  }
}
