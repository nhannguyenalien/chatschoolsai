import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/loyalty/data/loyalty_models.dart';
import 'package:schools_ai_app/features/loyalty/data/loyalty_repository.dart';
import 'package:schools_ai_app/features/loyalty/data/reward_world_models.dart';
import 'package:schools_ai_app/features/loyalty/presentation/loyalty_controller.dart';
import 'package:schools_ai_app/features/loyalty/presentation/loyalty_screen.dart';

class WidgetLoyaltyRepository implements LoyaltyRepository {
  bool joined = false;
  String? joinedCampaignId;
  String? claimedResultId;
  List<CustomerReward> rewards = const [
    CustomerReward(
      id: 'result-1',
      prizeName: 'Trà sữa miễn phí',
      spunAt: null,
      claimed: false,
    ),
  ];

  @override
  Future<List<RewardCampaign>> fetchCampaigns() async => [
    RewardCampaign(
      id: 'campaign-1',
      name: 'Vòng quay khai trương',
      description: 'Quay khi hóa đơn đủ điều kiện.',
      spendPerSpinMinor: 100000,
      joined: joined,
      prizes: const [
        RewardPrize(id: 'p1', name: 'Voucher 50k'),
        RewardPrize(id: 'p2', name: 'Trà sữa miễn phí'),
      ],
    ),
  ];

  @override
  Future<void> joinCampaign(String campaignId) async {
    joined = true;
    joinedCampaignId = campaignId;
  }

  @override
  Future<SpinResult> spin({
    required String campaignId,
    required String customerRef,
  }) async => const SpinResult(
    id: 'result-2',
    status: 'won',
    prizeId: 'p2',
    prizeName: 'Trà sữa miễn phí',
  );

  @override
  Future<List<CustomerReward>> fetchRewards(String customerRef) async =>
      rewards;

  @override
  Future<void> claimReward(String resultId) async {
    claimedResultId = resultId;
    rewards = rewards
        .map(
          (reward) => reward.id == resultId
              ? CustomerReward(
                  id: reward.id,
                  prizeName: reward.prizeName,
                  spunAt: reward.spunAt,
                  claimed: true,
                )
              : reward,
        )
        .toList();
  }

  LoyaltyProgram? program;
  LoyaltyAccount? account;
  String? recordedReceiptRef;
  String? redeemedRef;

  @override
  Future<LoyaltyProgram?> fetchProgram() async => program;

  @override
  Future<LoyaltyProgram> saveProgram({
    required int spendPerPointMinor,
    required int pointsPerStep,
  }) async {
    program = LoyaltyProgram(
      version: (program?.version ?? 0) + 1,
      currency: 'VND',
      spendPerPointMinor: spendPerPointMinor,
      pointsPerStep: pointsPerStep,
    );
    return program!;
  }

  @override
  Future<LoyaltyAccount> fetchAccount(String customerRef) async {
    if (account == null) {
      throw Exception('Customer was not found.');
    }
    return account!;
  }

  @override
  Future<SaleResult> recordSale({
    required String customerRef,
    required String receiptRef,
    required int amountMinor,
    String? customerName,
  }) async {
    recordedReceiptRef = receiptRef;
    return const SaleResult(pointsDelta: 10, spinsGranted: 1, replayed: false);
  }

  @override
  Future<RedeemResult> redeemPoints({
    required String customerRef,
    required String redemptionRef,
    required int points,
    String? note,
  }) async {
    redeemedRef = redemptionRef;
    return const RedeemResult(balance: 5, replayed: false);
  }
}

Future<void> _pump(WidgetTester tester, LoyaltyRepository repository) async {
  tester.view.physicalSize = const Size(1200, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [loyaltyRepositoryProvider.overrideWithValue(repository)],
      child: const MaterialApp(home: Scaffold(body: LoyaltyScreen())),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('lists reward-world campaigns and lets the store join one', (
    tester,
  ) async {
    final repository = WidgetLoyaltyRepository();
    await _pump(tester, repository);

    expect(find.text('Vòng quay khai trương'), findsOneWidget);
    expect(find.text('Voucher 50k'), findsOneWidget);
    expect(find.text('Tham gia chương trình'), findsOneWidget);
    expect(find.text('Quay thưởng'), findsNothing);

    await tester.tap(find.text('Tham gia chương trình'));
    await tester.pumpAndSettle();

    expect(repository.joinedCampaignId, 'campaign-1');
    expect(find.text('Quay thưởng'), findsOneWidget);
  });

  testWidgets('requires a customer reference before spinning', (tester) async {
    final repository = WidgetLoyaltyRepository()..joined = true;
    await _pump(tester, repository);

    await tester.tap(find.text('Quay thưởng'));
    await tester.pumpAndSettle();

    expect(
      find.text('Nhập số điện thoại hoặc mã khách trước.'),
      findsOneWidget,
    );
  });

  testWidgets('spinning shows the animated wheel and the winning prize', (
    tester,
  ) async {
    final repository = WidgetLoyaltyRepository()..joined = true;
    await _pump(tester, repository);

    await tester.enterText(find.byType(TextField), '0900000000');
    await tester.tap(find.text('Quay thưởng'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Vòng quay khai trương'), findsWidgets);

    await tester.pump(const Duration(milliseconds: 4300));
    await tester.pumpAndSettle();

    expect(find.textContaining('Trà sữa miễn phí'), findsWidgets);
  });

  testWidgets('looks up a customer and marks a reward as delivered', (
    tester,
  ) async {
    final repository = WidgetLoyaltyRepository();
    await _pump(tester, repository);

    await tester.enterText(find.byType(TextField), '0900000000');
    await tester.tap(find.text('Tra cứu'));
    await tester.pumpAndSettle();

    expect(
      find.descendant(
        of: find.byType(ListTile),
        matching: find.text('Trà sữa miễn phí'),
      ),
      findsOneWidget,
    );
    expect(find.text('Xác nhận đã giao'), findsOneWidget);

    await tester.tap(find.text('Xác nhận đã giao'));
    await tester.pumpAndSettle();
    expect(find.text('Xác nhận đã giao phần thưởng?'), findsOneWidget);

    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(repository.claimedResultId, 'result-1');
    expect(find.text('Đã giao'), findsOneWidget);
  });

  testWidgets('records a manual sale for the entered customer', (tester) async {
    final repository = WidgetLoyaltyRepository();
    await _pump(tester, repository);

    await tester.enterText(find.byType(TextField), '0900000000');
    await tester.tap(find.text('Cộng điểm'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Mã hóa đơn'),
      'HD-001',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Số tiền (VND)'),
      '100000',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Xác nhận'));
    await tester.pumpAndSettle();

    expect(repository.recordedReceiptRef, 'HD-001');
    expect(find.textContaining('Đã cộng 10'), findsOneWidget);
  });

  testWidgets('redeems points and shows the remaining balance', (tester) async {
    final repository = WidgetLoyaltyRepository();
    await _pump(tester, repository);

    await tester.enterText(find.byType(TextField), '0900000000');
    await tester.tap(find.text('Dùng điểm'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Mã đổi thưởng'),
      'RD-001',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Số điểm cần trừ'),
      '5',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Xác nhận'));
    await tester.pumpAndSettle();

    expect(repository.redeemedRef, 'RD-001');
    expect(find.textContaining('Đã trừ điểm. Số dư còn 5'), findsOneWidget);
  });
}
