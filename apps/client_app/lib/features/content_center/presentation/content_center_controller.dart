import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../data/content_center_models.dart';
import '../data/content_center_repository.dart';

final contentCenterRepositoryProvider = Provider(
  (ref) => ContentCenterRepository(ref.watch(apiClientProvider)),
);
final publishSchedulesProvider = FutureProvider<List<PublishSchedule>>(
  (ref) => ref.watch(contentCenterRepositoryProvider).schedules(),
);
final contentPlansProvider = FutureProvider<List<ContentPlan>>(
  (ref) => ref.watch(contentCenterRepositoryProvider).plans(),
);
final planningReviewProvider = FutureProvider<PlanningReview>(
  (ref) => ref.watch(contentCenterRepositoryProvider).review(),
);
final analyticsSourceProvider = StateProvider<String>((ref) => 'gsc');
final selectedSiteProvider = StateProvider<String?>((ref) => null);
final performanceInsightsProvider = FutureProvider<PerformanceInsights?>((
  ref,
) async {
  var site = ref.watch(selectedSiteProvider);
  if (site == null || site.isEmpty) {
    final plans = await ref.watch(contentPlansProvider.future);
    if (plans.isEmpty) return null;
    site = plans.first.siteId;
  }
  return ref
      .watch(contentCenterRepositoryProvider)
      .insights(site, ref.watch(analyticsSourceProvider));
});

void refreshContentCenter(WidgetRef ref) {
  ref.invalidate(publishSchedulesProvider);
  ref.invalidate(contentPlansProvider);
  ref.invalidate(planningReviewProvider);
  ref.invalidate(performanceInsightsProvider);
}
