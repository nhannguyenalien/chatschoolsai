import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../posts/presentation/posts_screen.dart';
import '../data/content_center_models.dart';
import '../data/content_center_repository.dart';
import 'content_center_controller.dart';
import '../../../core/localization/app_localizations.dart';

class ContentCenterScreen extends StatelessWidget {
  const ContentCenterScreen({super.key});
  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 4,
    child: Column(
      children: [
        Material(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            isScrollable: true,
            tabs: [
              Tab(
                icon: const Icon(Icons.article_outlined),
                text: context.l10n.tr('posts'),
              ),
              Tab(
                icon: const Icon(Icons.schedule_outlined),
                text: context.l10n.tr('auto_schedule'),
              ),
              Tab(
                icon: const Icon(Icons.calendar_month_outlined),
                text: context.l10n.tr('content_plan'),
              ),
              Tab(
                icon: const Icon(Icons.analytics_outlined),
                text: context.l10n.tr('analytics'),
              ),
            ],
          ),
        ),
        const Expanded(
          child: TabBarView(
            children: [
              PostsScreen(),
              _SchedulesView(),
              _PlanningView(),
              _AnalyticsView(),
            ],
          ),
        ),
      ],
    ),
  );
}

class _SchedulesView extends ConsumerWidget {
  const _SchedulesView();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(publishSchedulesProvider);
    return _Page(
      title: context.l10n.tr('schedule_title'),
      subtitle: context.l10n.tr('schedule_subtitle'),
      action: FilledButton.icon(
        onPressed: () => _edit(context, ref),
        icon: const Icon(Icons.add),
        label: Text(context.l10n.tr('add_schedule')),
      ),
      child: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _Error(
          message: '$e',
          retry: () => ref.invalidate(publishSchedulesProvider),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () => ref.refresh(publishSchedulesProvider.future),
          child: items.isEmpty
              ? _Empty(label: context.l10n.tr('no_schedule'))
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final s = items[i];
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          child: Icon(
                            s.contentType == 'blog'
                                ? Icons.article
                                : Icons.share,
                          ),
                        ),
                        title: Text(
                          s.contentType == 'blog'
                              ? 'Blog'
                              : context.l10n.tr('social_media'),
                        ),
                        subtitle: Text(
                          '${s.days.isEmpty ? context.l10n.tr('every_day') : s.days.join(', ')} · ${s.times.join(', ')}',
                        ),
                        trailing: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Switch(
                              value: s.isActive,
                              onChanged: (v) => _toggle(context, ref, s, v),
                            ),
                            PopupMenuButton<String>(
                              onSelected: (v) => v == 'edit'
                                  ? _edit(context, ref, s)
                                  : _delete(context, ref, s),
                              itemBuilder: (_) => [
                                PopupMenuItem(
                                  value: 'edit',
                                  child: Text(context.l10n.tr('edit')),
                                ),
                                PopupMenuItem(
                                  value: 'delete',
                                  child: Text(context.l10n.tr('delete')),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }

  Future<void> _toggle(
    BuildContext c,
    WidgetRef r,
    PublishSchedule s,
    bool active,
  ) => _run(
    c,
    r,
    () => r
        .read(contentCenterRepositoryProvider)
        .saveSchedule(
          id: s.id,
          type: s.contentType,
          days: s.days,
          times: s.times,
          active: active,
        ),
  );
  Future<void> _delete(BuildContext c, WidgetRef r, PublishSchedule s) async {
    if (await _confirm(c, c.l10n.tr('delete_schedule_confirm')) == true) {
      if (!c.mounted) return;
      await _run(
        c,
        r,
        () => r.read(contentCenterRepositoryProvider).deleteSchedule(s.id),
      );
    }
  }

  Future<void> _edit(
    BuildContext context,
    WidgetRef ref, [
    PublishSchedule? schedule,
  ]) async {
    final result = await showDialog<_ScheduleInput>(
      context: context,
      builder: (_) => _ScheduleDialog(value: schedule),
    );
    if (result == null || !context.mounted) return;
    await _run(
      context,
      ref,
      () => ref
          .read(contentCenterRepositoryProvider)
          .saveSchedule(
            id: schedule?.id,
            type: result.type,
            days: result.days,
            times: result.times,
            active: result.active,
          ),
    );
  }
}

class _PlanningView extends ConsumerWidget {
  const _PlanningView();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plans = ref.watch(contentPlansProvider);
    final review = ref.watch(planningReviewProvider);
    return _Page(
      title: 'Content planning',
      subtitle: context.l10n.tr('planning_subtitle'),
      action: FilledButton.icon(
        onPressed: () => _create(context, ref),
        icon: const Icon(Icons.add),
        label: Text(context.l10n.tr('create_plan')),
      ),
      child: RefreshIndicator(
        onRefresh: () async {
          refreshContentCenter(ref);
          await ref.read(contentPlansProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            plans.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => _Error(
                message: '$e',
                retry: () => ref.invalidate(contentPlansProvider),
              ),
              data: (items) => items.isEmpty
                  ? _Empty(label: context.l10n.tr('no_plan'))
                  : Column(
                      children: items
                          .map(
                            (p) => _PlanCard(
                              plan: p,
                              run: (action) => _run(context, ref, action),
                              repo: ref.read(contentCenterRepositoryProvider),
                            ),
                          )
                          .toList(),
                    ),
            ),
            const SizedBox(height: 20),
            Text(
              context.l10n.tr('suggested_topics'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            review.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('$e'),
              data: (value) {
                final planList = plans.valueOrNull ?? const <ContentPlan>[];
                return Column(
                  children: [
                    if (planList.isNotEmpty)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton.icon(
                              onPressed: () => _run(
                                context,
                                ref,
                                () => ref
                                    .read(contentCenterRepositoryProvider)
                                    .recommend(planList.first.siteId),
                              ),
                              icon: const Icon(Icons.auto_awesome),
                              label: Text(context.l10n.tr('suggest_ai')),
                            ),
                            OutlinedButton.icon(
                              onPressed: () =>
                                  _importTrends(context, ref, planList),
                              icon: const Icon(Icons.upload_file_outlined),
                              label: Text(context.l10n.tr('import_trend_json')),
                            ),
                          ],
                        ),
                      ),
                    ...value.topics.map(
                      (t) => Card(
                        child: ListTile(
                          title: Text(t.title),
                          subtitle: Text(
                            '${t.keyword} · điểm ${t.score.toStringAsFixed(1)} · ${t.status}',
                          ),
                          trailing: planList.isEmpty
                              ? null
                              : FilledButton.tonal(
                                  onPressed: () =>
                                      _addTopic(context, ref, t, planList),
                                  child: Text(context.l10n.tr('add_to_plan')),
                                ),
                        ),
                      ),
                    ),
                    ...value.items.map(
                      (i) => Card(
                        child: ListTile(
                          title: Text(i.topic),
                          subtitle: Text(
                            '${i.status}${i.scheduledAt.isEmpty ? '' : ' · ${i.scheduledAt}'}',
                          ),
                          trailing: Wrap(
                            children: [
                              if (i.status == 'queued')
                                IconButton(
                                  tooltip: context.l10n.tr('create_draft'),
                                  onPressed: () => _run(
                                    context,
                                    ref,
                                    () => ref
                                        .read(contentCenterRepositoryProvider)
                                        .itemAction(i.id, 'generate'),
                                  ),
                                  icon: const Icon(Icons.auto_awesome),
                                ),
                              if (i.status == 'draft' || i.status == 'review')
                                IconButton(
                                  tooltip: i.translationStatus.isEmpty
                                      ? context.l10n.tr('translate_post')
                                      : '${context.l10n.tr('translate_post')} · ${i.translationStatus}',
                                  onPressed: () => _run(
                                    context,
                                    ref,
                                    () => ref
                                        .read(contentCenterRepositoryProvider)
                                        .itemAction(i.id, 'translate'),
                                  ),
                                  icon: const Icon(Icons.translate),
                                ),
                              if (i.status == 'draft' || i.status == 'review')
                                IconButton(
                                  tooltip: context.l10n.tr('approve'),
                                  onPressed: () => _run(
                                    context,
                                    ref,
                                    () => ref
                                        .read(contentCenterRepositoryProvider)
                                        .itemAction(i.id, 'approve'),
                                  ),
                                  icon: const Icon(Icons.check_circle_outline),
                                ),
                              if (i.status == 'draft' || i.status == 'review')
                                IconButton(
                                  tooltip: context.l10n.tr('reject'),
                                  onPressed: () => _run(
                                    context,
                                    ref,
                                    () => ref
                                        .read(contentCenterRepositoryProvider)
                                        .itemAction(i.id, 'reject'),
                                  ),
                                  icon: const Icon(Icons.cancel_outlined),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final input = await showDialog<_PlanInput>(
      context: context,
      builder: (_) => const _PlanDialog(),
    );
    if (input != null && context.mounted) {
      await _run(
        context,
        ref,
        () => ref
            .read(contentCenterRepositoryProvider)
            .createPlan(
              siteId: input.site,
              name: input.name,
              timezone: input.timezone,
              days: input.days,
              times: input.times,
            ),
      );
    }
  }

  Future<void> _addTopic(
    BuildContext context,
    WidgetRef ref,
    TopicSuggestion topic,
    List<ContentPlan> plans,
  ) async {
    final matching = plans.where((p) => p.siteId == topic.siteId).toList();
    final candidates = matching.isEmpty ? plans : matching;
    final planId = candidates.length == 1
        ? candidates.first.id
        : await showDialog<String>(
            context: context,
            builder: (_) => SimpleDialog(
              title: Text(context.l10n.tr('select_plan')),
              children: candidates
                  .map(
                    (p) => SimpleDialogOption(
                      onPressed: () => Navigator.pop(context, p.id),
                      child: Text('${p.name} · ${p.siteId}'),
                    ),
                  )
                  .toList(),
            ),
          );
    if (planId == null || !context.mounted) return;
    await _run(
      context,
      ref,
      () => ref
          .read(contentCenterRepositoryProvider)
          .approveTopic(topic.id, planId),
    );
  }

  Future<void> _importTrends(
    BuildContext context,
    WidgetRef ref,
    List<ContentPlan> plans,
  ) async {
    final input = await showDialog<String>(
      context: context,
      builder: (_) => const _TrendDialog(),
    );
    if (input == null || !context.mounted) return;
    final siteId = plans.length == 1
        ? plans.first.siteId
        : await showDialog<String>(
            context: context,
            builder: (_) => SimpleDialog(
              title: const Text('Nhập trends cho site'),
              children: plans
                  .map(
                    (p) => SimpleDialogOption(
                      onPressed: () => Navigator.pop(context, p.siteId),
                      child: Text('${p.name} · ${p.siteId}'),
                    ),
                  )
                  .toList(),
            ),
          );
    if (siteId == null || !context.mounted) return;
    await _run(
      context,
      ref,
      () =>
          ref.read(contentCenterRepositoryProvider).importTrends(siteId, input),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan, required this.run, required this.repo});
  final ContentPlan plan;
  final ContentCenterRepository repo;
  final Future<void> Function(Future<void> Function()) run;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  plan.name,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Chip(label: Text(plan.status)),
            ],
          ),
          Text('${plan.siteId} · ${plan.timezone}'),
          Text(
            '${plan.days.join(', ')} · ${plan.times.join(', ')} · ${plan.items.length} mục',
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              FilledButton.tonal(
                onPressed: () => run(() => repo.schedulePlan(plan.id, 30)),
                child: Text(context.l10n.tr('schedule_30_days')),
              ),
              OutlinedButton.icon(
                onPressed: () async {
                  final input = await showDialog<_PlanInput>(
                    context: context,
                    builder: (_) => _PlanDialog(value: plan),
                  );
                  if (input == null || !context.mounted) return;
                  await run(
                    () => repo.updatePlan(
                      id: plan.id,
                      name: input.name,
                      timezone: input.timezone,
                      days: input.days,
                      times: input.times,
                    ),
                  );
                },
                icon: const Icon(Icons.edit_outlined),
                label: Text(context.l10n.tr('edit_plan')),
              ),
              OutlinedButton(
                onPressed: () => run(
                  () => repo.setPlanStatus(
                    plan.id,
                    plan.status == 'active' ? 'paused' : 'active',
                  ),
                ),
                child: Text(
                  plan.status == 'active'
                      ? context.l10n.tr('pause')
                      : context.l10n.tr('activate'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _AnalyticsView extends ConsumerWidget {
  const _AnalyticsView();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plans =
        ref.watch(contentPlansProvider).valueOrNull ?? const <ContentPlan>[];
    final selected =
        ref.watch(selectedSiteProvider) ??
        (plans.isEmpty ? null : plans.first.siteId);
    return _Page(
      title: 'Content analytics',
      subtitle: context.l10n.tr('analytics_subtitle'),
      action: OutlinedButton.icon(
        onPressed: selected == null
            ? null
            : () => _import(context, ref, selected),
        icon: const Icon(Icons.upload_file),
        label: Text(context.l10n.tr('import_json')),
      ),
      child: ListView(
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              DropdownButton<String>(
                value: selected,
                hint: Text(context.l10n.tr('select_site')),
                items: plans
                    .map(
                      (p) => DropdownMenuItem(
                        value: p.siteId,
                        child: Text('${p.name} · ${p.siteId}'),
                      ),
                    )
                    .toList(),
                onChanged: (v) =>
                    ref.read(selectedSiteProvider.notifier).state = v,
              ),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'gsc', label: Text('Google Search')),
                  ButtonSegment(value: 'ga4', label: Text('GA4')),
                ],
                selected: {ref.watch(analyticsSourceProvider)},
                onSelectionChanged: (v) =>
                    ref.read(analyticsSourceProvider.notifier).state = v.first,
              ),
            ],
          ),
          const SizedBox(height: 18),
          ref
              .watch(performanceInsightsProvider)
              .when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => _Error(
                  message: '$e',
                  retry: () => ref.invalidate(performanceInsightsProvider),
                ),
                data: (i) => i == null
                    ? const _Empty(
                        label:
                            'Tạo content plan trước để liên kết analytics với site.',
                      )
                    : Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          _Metric(
                            'Snapshots',
                            '${i.snapshotCount}',
                            Icons.storage,
                          ),
                          _Metric(
                            'Clicks',
                            i.clicks.toStringAsFixed(0),
                            Icons.ads_click,
                          ),
                          _Metric(
                            'Impressions',
                            i.impressions.toStringAsFixed(0),
                            Icons.visibility,
                          ),
                          _Metric('CTR', _percent(i.ctr), Icons.trending_up),
                          _Metric(
                            'Sessions',
                            i.sessions.toStringAsFixed(0),
                            Icons.people_outline,
                          ),
                          _Metric(
                            'Conversions',
                            i.conversions.toStringAsFixed(0),
                            Icons.task_alt,
                          ),
                          _Metric(
                            'Engagement',
                            _percent(i.engagementRate),
                            Icons.favorite_outline,
                          ),
                          _Metric(
                            'Conversion rate',
                            _percent(i.conversionRate),
                            Icons.show_chart,
                          ),
                        ],
                      ),
              ),
        ],
      ),
    );
  }

  Future<void> _import(BuildContext context, WidgetRef ref, String site) async {
    final value = await showDialog<String>(
      context: context,
      builder: (_) => const _JsonDialog(),
    );
    if (value != null && context.mounted) {
      await _run(
        context,
        ref,
        () => ref
            .read(contentCenterRepositoryProvider)
            .importAnalytics(site, value),
      );
    }
  }
}

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.subtitle,
    required this.action,
    required this.child,
  });
  final String title, subtitle;
  final Widget action, child;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
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
                  Text(title, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 4),
                  Text(subtitle),
                ],
              ),
            ),
            const SizedBox(width: 12),
            action,
          ],
        ),
        const SizedBox(height: 18),
        Expanded(child: child),
      ],
    ),
  );
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, this.icon);
  final String label, value;
  final IconData icon;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 190,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon),
            const SizedBox(height: 12),
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            Text(label),
          ],
        ),
      ),
    ),
  );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(padding: const EdgeInsets.all(32), child: Text(label)),
  );
}

class _Error extends StatelessWidget {
  const _Error({required this.message, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(message),
        TextButton(onPressed: retry, child: Text(context.l10n.tr('retry'))),
      ],
    ),
  );
}

class _ScheduleInput {
  const _ScheduleInput(this.type, this.days, this.times, this.active);
  final String type;
  final List<String> days, times;
  final bool active;
}

class _ScheduleDialog extends StatefulWidget {
  const _ScheduleDialog({this.value});
  final PublishSchedule? value;
  @override
  State<_ScheduleDialog> createState() => _ScheduleDialogState();
}

class _ScheduleDialogState extends State<_ScheduleDialog> {
  late String type = widget.value?.contentType ?? 'blog';
  late final days = TextEditingController(
    text: widget.value?.days.join(', ') ?? 'all',
  );
  late final times = TextEditingController(
    text: widget.value?.times.join(', ') ?? '09:00',
  );
  late bool active = widget.value?.isActive ?? true;
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.value == null
          ? context.l10n.tr('add_schedule')
          : context.l10n.tr('edit'),
    ),
    content: SizedBox(
      width: 420,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField(
            initialValue: type,
            decoration: const InputDecoration(labelText: 'Loại nội dung'),
            items: const [
              DropdownMenuItem(value: 'blog', child: Text('Blog')),
              DropdownMenuItem(value: 'social', child: Text('Mạng xã hội')),
            ],
            onChanged: (v) => setState(() => type = v!),
          ),
          TextField(
            controller: days,
            decoration: const InputDecoration(
              labelText: 'Ngày (all hoặc mon, tue, ...)',
            ),
          ),
          TextField(
            controller: times,
            decoration: const InputDecoration(
              labelText: 'Giờ (HH:MM, cách nhau dấu phẩy)',
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Đang hoạt động'),
            value: active,
            onChanged: (v) => setState(() => active = v),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(context.l10n.tr('cancel')),
      ),
      FilledButton(
        onPressed: () {
          final parsed = _csv(times.text);
          if (parsed.isEmpty) return;
          Navigator.pop(
            context,
            _ScheduleInput(type, _csv(days.text), parsed, active),
          );
        },
        child: Text(context.l10n.tr('save')),
      ),
    ],
  );
}

class _PlanInput {
  const _PlanInput(this.site, this.name, this.timezone, this.days, this.times);
  final String site, name, timezone;
  final List<String> days, times;
}

class _PlanDialog extends StatefulWidget {
  const _PlanDialog({this.value});
  final ContentPlan? value;
  @override
  State<_PlanDialog> createState() => _PlanDialogState();
}

class _PlanDialogState extends State<_PlanDialog> {
  late final site = TextEditingController(text: widget.value?.siteId ?? '');
  late final name = TextEditingController(text: widget.value?.name ?? '');
  late final timezone = TextEditingController(
    text: widget.value?.timezone ?? 'Asia/Ho_Chi_Minh',
  );
  late final days = TextEditingController(
    text: widget.value?.days.join(', ') ?? 'all',
  );
  late final times = TextEditingController(
    text: widget.value?.times.join(', ') ?? '09:00',
  );
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.value == null
          ? context.l10n.tr('create_plan')
          : context.l10n.tr('edit_plan'),
    ),
    content: SizedBox(
      width: 440,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: site,
            enabled: widget.value == null,
            decoration: const InputDecoration(labelText: 'Site ID *'),
          ),
          TextField(
            controller: name,
            decoration: const InputDecoration(labelText: 'Tên kế hoạch *'),
          ),
          TextField(
            controller: timezone,
            decoration: const InputDecoration(labelText: 'Múi giờ IANA'),
          ),
          TextField(
            controller: days,
            decoration: const InputDecoration(labelText: 'Ngày'),
          ),
          TextField(
            controller: times,
            decoration: const InputDecoration(labelText: 'Giờ'),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(context.l10n.tr('cancel')),
      ),
      FilledButton(
        onPressed: () {
          if (site.text.trim().isEmpty ||
              name.text.trim().isEmpty ||
              _csv(times.text).isEmpty) {
            return;
          }
          Navigator.pop(
            context,
            _PlanInput(
              site.text.trim(),
              name.text.trim(),
              timezone.text.trim(),
              _csv(days.text),
              _csv(times.text),
            ),
          );
        },
        child: Text(
          widget.value == null
              ? context.l10n.tr('create')
              : context.l10n.tr('save'),
        ),
      ),
    ],
  );
}

class _JsonDialog extends StatefulWidget {
  const _JsonDialog();
  @override
  State<_JsonDialog> createState() => _JsonDialogState();
}

class _TrendDialog extends StatefulWidget {
  const _TrendDialog();
  @override
  State<_TrendDialog> createState() => _TrendDialogState();
}

class _TrendDialogState extends State<_TrendDialog> {
  final value = TextEditingController(
    text:
        '[{"title":"Chủ đề đang tăng trưởng","primary_keyword":"từ khóa","overall_score":80}]',
  );
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Nhập dữ liệu xu hướng'),
    content: SizedBox(
      width: 620,
      child: TextField(
        controller: value,
        minLines: 8,
        maxLines: 16,
        decoration: const InputDecoration(
          border: OutlineInputBorder(),
          hintText: 'JSON xu hướng hoặc chủ đề từ công cụ nghiên cứu',
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(context.l10n.tr('cancel')),
      ),
      FilledButton(
        onPressed: () {
          if (value.text.trim().isNotEmpty) {
            Navigator.pop(context, value.text.trim());
          }
        },
        child: Text(context.l10n.tr('import_json')),
      ),
    ],
  );
}

class _JsonDialogState extends State<_JsonDialog> {
  final value = TextEditingController(
    text:
        '[\n  {"source":"gsc","externalKey":"/home","windowStart":"2026-08-01","windowEnd":"2026-08-07","metrics":{"clicks":0,"impressions":0,"ctr":0,"position":0}}\n]',
  );
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Nhập dữ liệu GSC/GA4'),
    content: SizedBox(
      width: 620,
      child: TextField(
        controller: value,
        minLines: 10,
        maxLines: 18,
        decoration: const InputDecoration(
          border: OutlineInputBorder(),
          hintText: 'Mảng JSON snapshots',
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(context.l10n.tr('cancel')),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, value.text),
        child: Text(context.l10n.tr('import_json')),
      ),
    ],
  );
}

List<String> _csv(String value) => value
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .where((e) => e.isNotEmpty)
    .toList();
String _percent(double value) => '${(value * 100).toStringAsFixed(1)}%';
Future<bool?> _confirm(BuildContext context, String text) => showDialog<bool>(
  context: context,
  builder: (_) => AlertDialog(
    title: Text(text),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context, false),
        child: Text(context.l10n.tr('cancel')),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, true),
        child: Text(context.l10n.tr('confirm')),
      ),
    ],
  ),
);
Future<void> _run(
  BuildContext context,
  WidgetRef ref,
  Future<void> Function() action,
) async {
  try {
    await action();
    refreshContentCenter(ref);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.tr('updated_success'))),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${context.l10n.tr('update_failed')}: $e')),
      );
    }
  }
}
