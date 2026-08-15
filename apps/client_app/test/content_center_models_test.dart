import 'package:schools_ai_app/features/content_center/data/content_center_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses content plan cadence stored as JSON text', () {
    final plan = ContentPlan.fromJson({
      'id': 'plan-1',
      'site_id': 'site-1',
      'name': 'Daily',
      'timezone': 'Asia/Ho_Chi_Minh',
      'status': 'active',
      'cadence_json': '{"days":["mon","fri"],"times":["09:00"]}',
      'items': [
        {'id': 'item-1', 'topic': 'AI', 'status': 'queued'},
      ],
    });

    expect(plan.days, ['mon', 'fri']);
    expect(plan.times, ['09:00']);
    expect(plan.items.single.topic, 'AI');
  });

  test('calculates analytics model from totals and derived fields', () {
    final insight = PerformanceInsights.fromJson({
      'snapshotCount': 2,
      'totals': {
        'clicks': 12,
        'impressions': 100,
        'sessions': 40,
        'conversions': 3,
      },
      'derived': {'ctr': .12, 'engagementRate': .75, 'conversionRate': .075},
    });

    expect(insight.snapshotCount, 2);
    expect(insight.ctr, .12);
    expect(insight.conversionRate, .075);
  });
}
