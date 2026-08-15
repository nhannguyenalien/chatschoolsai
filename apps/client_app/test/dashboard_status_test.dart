import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/dashboard/data/dashboard_status.dart';

void main() {
  test('maps API status response and defaults missing counts to zero', () {
    final status = DashboardStatus.fromJson({
      'tenant': 'school-a',
      'pending': 3,
      'approved': 2.0,
      'published': 9,
    });

    expect(status.tenant, 'school-a');
    expect(status.pending, 3);
    expect(status.approved, 2);
    expect(status.scheduled, 0);
    expect(status.published, 9);
    expect(status.error, 0);
  });
}
