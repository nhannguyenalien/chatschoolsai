import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/dashboard_status.dart';
import 'dashboard_controller.dart';
import '../../../core/localization/app_localizations.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(dashboardStatusProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(dashboardStatusProvider.future),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          const SliverToBoxAdapter(child: _Header()),
          status.when(
            loading: () => const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => SliverFillRemaining(
              hasScrollBody: false,
              child: _ErrorState(
                message: error.toString(),
                onRetry: () => ref.invalidate(dashboardStatusProvider),
              ),
            ),
            data: (data) => SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              sliver: SliverToBoxAdapter(child: _DashboardBody(status: data)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.l10n.tr('nav_overview'),
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 6),
        Text(
          context.l10n.tr('overview_subtitle'),
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    ),
  );
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.status});
  final DashboardStatus status;

  @override
  Widget build(BuildContext context) {
    final items = [
      (
        context.l10n.tr('pending'),
        status.pending,
        Icons.hourglass_top_rounded,
        Colors.orange,
      ),
      (
        context.l10n.tr('approved'),
        status.approved,
        Icons.task_alt_rounded,
        Colors.teal,
      ),
      (
        context.l10n.tr('scheduled'),
        status.scheduled,
        Icons.event_rounded,
        Colors.indigo,
      ),
      (
        context.l10n.tr('publishing'),
        status.publishing,
        Icons.cloud_upload_rounded,
        Colors.blue,
      ),
      (
        context.l10n.tr('published'),
        status.published,
        Icons.check_circle_rounded,
        Colors.green,
      ),
      (
        context.l10n.tr('error'),
        status.error,
        Icons.error_outline_rounded,
        Colors.red,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Card(
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 8,
            ),
            leading: const CircleAvatar(child: Icon(Icons.school_rounded)),
            title: Text(context.l10n.tr('workspace')),
            subtitle: Text(status.tenant),
            trailing: const Icon(Icons.verified_user_outlined),
          ),
        ),
        const SizedBox(height: 20),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 1000
                ? 3
                : constraints.maxWidth >= 560
                ? 2
                : 1;
            final width = (constraints.maxWidth - (columns - 1) * 12) / columns;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final item in items)
                  SizedBox(
                    width: width,
                    child: _MetricCard(item: item),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.item});
  final (String, int, IconData, Color) item;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: item.$4.withValues(alpha: .12),
            foregroundColor: item.$4,
            child: Icon(item.$3),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              item.$1,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          Text('${item.$2}', style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    ),
  );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.cloud_off_rounded,
            size: 48,
            color: Theme.of(context).colorScheme.error,
          ),
          const SizedBox(height: 12),
          Text(
            context.l10n.tr('load_failed'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: Text(context.l10n.tr('retry')),
          ),
        ],
      ),
    ),
  );
}
