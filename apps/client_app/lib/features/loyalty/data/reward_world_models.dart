class RewardPrize {
  const RewardPrize({required this.id, required this.name});

  factory RewardPrize.fromJson(Map<String, dynamic> json) => RewardPrize(
    id: json['id'] as String? ?? '',
    name: json['name'] as String? ?? '',
  );

  final String id;
  final String name;
}

class RewardCampaign {
  const RewardCampaign({
    required this.id,
    required this.name,
    required this.description,
    required this.spendPerSpinMinor,
    required this.joined,
    required this.prizes,
  });

  factory RewardCampaign.fromJson(Map<String, dynamic> json) {
    final prizes = json['prizes'] as List? ?? const [];
    return RewardCampaign(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      spendPerSpinMinor: (json['spend_per_spin_minor'] as num?)?.toInt() ?? 0,
      joined: json['joined'] as bool? ?? false,
      prizes: prizes
          .whereType<Map>()
          .map((item) => RewardPrize.fromJson(Map<String, dynamic>.from(item)))
          .toList(),
    );
  }

  final String id;
  final String name;
  final String? description;
  final int spendPerSpinMinor;
  final bool joined;
  final List<RewardPrize> prizes;
}

class SpinResult {
  const SpinResult({
    required this.id,
    required this.status,
    required this.prizeId,
    required this.prizeName,
  });

  factory SpinResult.fromJson(Map<String, dynamic> json) => SpinResult(
    id: json['id'] as String? ?? '',
    status: json['status'] as String? ?? 'no_win',
    prizeId: json['prize_id'] as String?,
    prizeName: json['prize_name'] as String?,
  );

  final String id;
  final String status;
  final String? prizeId;
  final String? prizeName;

  bool get won => status == 'won';
}

class CustomerReward {
  const CustomerReward({
    required this.id,
    required this.prizeName,
    required this.spunAt,
    required this.claimed,
  });

  factory CustomerReward.fromJson(Map<String, dynamic> json) => CustomerReward(
    id: json['id'] as String? ?? '',
    prizeName: json['prize_name'] as String? ?? '',
    spunAt: DateTime.tryParse(
      (json['spun_at'] ?? json['created']) as String? ?? '',
    )?.toLocal(),
    claimed: json['claim'] != null,
  );

  final String id;
  final String prizeName;
  final DateTime? spunAt;
  final bool claimed;
}
