class BillingStatus {
  const BillingStatus({
    required this.planId,
    required this.messageLimit,
    required this.messageUsed,
    required this.messageRemaining,
    required this.usedPercent,
    required this.email,
  });

  factory BillingStatus.fromJson(Map<String, dynamic> json) => BillingStatus(
    planId: json['plan_id'] as String? ?? 'free',
    messageLimit: (json['message_limit'] as num?)?.toInt() ?? 0,
    messageUsed: (json['message_used'] as num?)?.toInt() ?? 0,
    messageRemaining: (json['message_remaining'] as num?)?.toInt() ?? 0,
    usedPercent: (json['used_percent'] as num?)?.toInt() ?? 0,
    email: json['email'] as String? ?? '',
  );

  final String planId;
  final int messageLimit;
  final int messageUsed;
  final int messageRemaining;
  final int usedPercent;
  final String email;

  bool get isPro => planId == 'pro';
}
