import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/localization/app_localizations.dart';
import '../data/billing_status.dart';
import 'billing_controller.dart';

// Cùng 3 link Whop checkout dùng ở dash-tabler/billing.html — không phải bí mật,
// đã lộ trong bundle JS phía web nên giữ y hệt ở đây thay vì thêm cấu hình mới.
const _whopMonthlyUrl = 'https://whop.com/checkout/plan_AmLo77qFcdLYF';
const _whopYearlyUrl = 'https://whop.com/checkout/plan_5WXuEKjmm2Vyo';
const _whopAddonUrl = 'https://whop.com/checkout/plan_AmLo77qFcdLYF';

class BillingScreen extends ConsumerWidget {
  const BillingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(billingStatusProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.tr('billing_title'))),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(billingStatusProvider.future),
        child: status.when(
          loading: () => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: const [
              SizedBox(height: 200),
              Center(child: CircularProgressIndicator()),
            ],
          ),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(20),
            children: [
              const SizedBox(height: 80),
              Icon(
                Icons.cloud_off_rounded,
                size: 48,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 12),
              Text(
                error.toString(),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              Center(
                child: OutlinedButton.icon(
                  onPressed: () => ref.invalidate(billingStatusProvider),
                  icon: const Icon(Icons.refresh),
                  label: Text(context.l10n.tr('retry')),
                ),
              ),
            ],
          ),
          data: (value) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            children: [
              Text(
                context.l10n.tr('billing_subtitle'),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 20),
              _PlanCard(status: value),
              const SizedBox(height: 16),
              _UsageCard(status: value),
              const SizedBox(height: 16),
              _ActionsCard(status: value),
              const SizedBox(height: 16),
              Text(
                context.l10n.tr('billing_history_hint'),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.status});
  final BillingStatus status;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Icon(
            Icons.workspace_premium_rounded,
            size: 36,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  status.isPro
                      ? context.l10n.tr('plan_pro')
                      : context.l10n.tr('plan_free'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 2),
                Text(
                  status.isPro
                      ? context.l10n.tr('plan_pro_desc')
                      : context.l10n.tr('plan_free_desc'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Chip(
            label: Text(context.l10n.tr('active')),
            avatar: const Icon(Icons.check_circle, size: 18),
            backgroundColor: Colors.green.withValues(alpha: .12),
          ),
        ],
      ),
    ),
  );
}

class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.status});
  final BillingStatus status;

  @override
  Widget build(BuildContext context) {
    final warn = status.usedPercent >= 90;
    final color = warn
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.l10n.tr('usage_this_month'),
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${status.messageRemaining} ${context.l10n.tr('messages_remaining')}',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ],
                  ),
                ),
                Text(
                  '${status.usedPercent}%',
                  style: Theme.of(
                    context,
                  ).textTheme.headlineSmall?.copyWith(color: color),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: (status.usedPercent / 100).clamp(0, 1),
                minHeight: 10,
                color: color,
                backgroundColor: color.withValues(alpha: .12),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${context.l10n.tr('limit_label')}: ${status.messageLimit}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionsCard extends StatelessWidget {
  const _ActionsCard({required this.status});
  final BillingStatus status;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: status.isPro
            ? [
                FilledButton.icon(
                  onPressed: () => _open(_whopAddonUrl, status.email),
                  icon: const Icon(Icons.add_rounded),
                  label: Text(context.l10n.tr('buy_addon')),
                ),
              ]
            : [
                FilledButton.icon(
                  onPressed: () => _open(_whopMonthlyUrl, status.email),
                  icon: const Icon(Icons.rocket_launch_rounded),
                  label: Text(context.l10n.tr('upgrade_monthly')),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () => _open(_whopYearlyUrl, status.email),
                  icon: const Icon(Icons.star_rounded),
                  label: Text(context.l10n.tr('upgrade_yearly')),
                ),
              ],
      ),
    ),
  );

  Future<void> _open(String url, String email) {
    final uri = Uri.parse(
      url,
    ).replace(queryParameters: email.isNotEmpty ? {'email': email} : null);
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
