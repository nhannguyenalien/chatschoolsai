import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/billing/data/billing_repository.dart';
import 'package:schools_ai_app/features/billing/data/billing_status.dart';
import 'package:schools_ai_app/features/billing/presentation/billing_controller.dart';
import 'package:schools_ai_app/features/billing/presentation/billing_screen.dart';

class WidgetBillingRepository implements BillingRepository {
  WidgetBillingRepository(this.status);
  final BillingStatus status;

  @override
  Future<BillingStatus> fetchStatus() async => status;
}

Future<void> _pump(WidgetTester tester, BillingRepository repository) async {
  tester.view.physicalSize = const Size(1200, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [billingRepositoryProvider.overrideWithValue(repository)],
      child: const MaterialApp(home: BillingScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('free plan shows upgrade actions and remaining usage', (
    tester,
  ) async {
    await _pump(
      tester,
      WidgetBillingRepository(
        const BillingStatus(
          planId: 'free',
          messageLimit: 100,
          messageUsed: 40,
          messageRemaining: 60,
          usedPercent: 40,
          email: 'shop@example.com',
        ),
      ),
    );

    expect(find.text('Free Plan'), findsOneWidget);
    expect(find.text('60 câu còn lại'), findsOneWidget);
    expect(find.text('Nâng cấp Pro (\$19/tháng)'), findsOneWidget);
    expect(
      find.text('Mua gói năm (\$199/năm) · Tiết kiệm 15%'),
      findsOneWidget,
    );
    expect(find.text('Nạp thêm 1.000 câu (\$7)'), findsNothing);
  });

  testWidgets('pro plan shows the add-on action instead of upgrade buttons', (
    tester,
  ) async {
    await _pump(
      tester,
      WidgetBillingRepository(
        const BillingStatus(
          planId: 'pro',
          messageLimit: 5000,
          messageUsed: 4600,
          messageRemaining: 400,
          usedPercent: 92,
          email: 'pro-shop@example.com',
        ),
      ),
    );

    expect(find.text('Pro Plan'), findsOneWidget);
    expect(find.text('Nạp thêm 1.000 câu (\$7)'), findsOneWidget);
    expect(find.text('Nâng cấp Pro (\$19/tháng)'), findsNothing);
  });
}
