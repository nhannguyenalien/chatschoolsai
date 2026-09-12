class LoyaltyProgram {
  const LoyaltyProgram({
    required this.version,
    required this.currency,
    required this.spendPerPointMinor,
    required this.pointsPerStep,
  });

  factory LoyaltyProgram.fromJson(Map<String, dynamic> json) => LoyaltyProgram(
    version: (json['version'] as num?)?.toInt() ?? 0,
    currency: json['currency'] as String? ?? 'VND',
    spendPerPointMinor: (json['spend_per_point_minor'] as num?)?.toInt() ?? 0,
    pointsPerStep: (json['points_per_step'] as num?)?.toInt() ?? 1,
  );

  final int version;
  final String currency;
  final int spendPerPointMinor;
  final int pointsPerStep;
}

class LoyaltyLedgerEntry {
  const LoyaltyLedgerEntry({
    required this.sourceRef,
    required this.amountMinor,
    required this.pointsDelta,
    required this.occurredAt,
  });

  factory LoyaltyLedgerEntry.fromJson(Map<String, dynamic> json) =>
      LoyaltyLedgerEntry(
        sourceRef: json['source_ref'] as String? ?? '',
        amountMinor: (json['amount_minor'] as num?)?.toInt() ?? 0,
        pointsDelta: (json['points_delta'] as num?)?.toInt() ?? 0,
        occurredAt: DateTime.tryParse(
          (json['occurred_at'] ?? json['created']) as String? ?? '',
        )?.toLocal(),
      );

  final String sourceRef;
  final int amountMinor;
  final int pointsDelta;
  final DateTime? occurredAt;
}

class LoyaltyAccount {
  const LoyaltyAccount({
    required this.customerRef,
    required this.customerName,
    required this.balance,
    required this.entries,
  });

  factory LoyaltyAccount.fromJson(Map<String, dynamic> json) {
    final customer = Map<String, dynamic>.from(
      json['customer'] as Map? ?? const {},
    );
    final entries = json['entries'] as List? ?? const [];
    return LoyaltyAccount(
      customerRef: customer['customer_ref'] as String? ?? '',
      customerName: customer['name'] as String?,
      balance: (json['balance'] as num?)?.toInt() ?? 0,
      entries: entries
          .whereType<Map>()
          .map(
            (item) =>
                LoyaltyLedgerEntry.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
    );
  }

  final String customerRef;
  final String? customerName;
  final int balance;
  final List<LoyaltyLedgerEntry> entries;
}

class SaleResult {
  const SaleResult({
    required this.pointsDelta,
    required this.spinsGranted,
    required this.replayed,
  });

  factory SaleResult.fromJson(Map<String, dynamic> json) {
    final entry = Map<String, dynamic>.from(json['entry'] as Map? ?? const {});
    final entitlements = json['entitlements'] as List? ?? const [];
    return SaleResult(
      pointsDelta: (entry['points_delta'] as num?)?.toInt() ?? 0,
      spinsGranted: entitlements.length,
      replayed: json['replayed'] as bool? ?? false,
    );
  }

  final int pointsDelta;
  final int spinsGranted;
  final bool replayed;
}

class RedeemResult {
  const RedeemResult({required this.balance, required this.replayed});

  factory RedeemResult.fromJson(Map<String, dynamic> json) => RedeemResult(
    balance: (json['balance'] as num?)?.toInt(),
    replayed: json['replayed'] as bool? ?? false,
  );

  final int? balance;
  final bool replayed;
}
