import 'dart:convert';
import '../../../core/network/api_client.dart';
import 'content_center_models.dart';

class ContentCenterRepository {
  const ContentCenterRepository(this._client);
  final ApiClient _client;

  Future<List<PublishSchedule>> schedules() async =>
      ((await _client.getJson('/api/v1/schedules'))['schedules'] as List? ??
              const [])
          .whereType<Map>()
          .map((e) => PublishSchedule.fromJson(Map<String, dynamic>.from(e)))
          .toList();
  Future<void> saveSchedule({
    String? id,
    required String type,
    required List<String> days,
    required List<String> times,
    required bool active,
  }) async {
    final body = {
      'content_type': type,
      'days': days,
      'times': times,
      'is_active': active,
    };
    if (id == null) {
      await _client.postJson('/api/v1/schedules', body: body);
    } else {
      await _client.patchJson(
        '/api/v1/schedules/${Uri.encodeComponent(id)}',
        body: body,
      );
    }
  }

  Future<void> deleteSchedule(String id) =>
      _client.deleteJson('/api/v1/schedules/${Uri.encodeComponent(id)}');

  Future<List<ContentPlan>> plans() async =>
      ((await _client.getJson('/api/v1/content-planning/plans'))['plans']
                  as List? ??
              const [])
          .whereType<Map>()
          .map((e) => ContentPlan.fromJson(Map<String, dynamic>.from(e)))
          .toList();
  Future<PlanningReview> review() async => PlanningReview.fromJson(
    await _client.getJson('/api/v1/content-planning/review'),
  );
  Future<void> createPlan({
    required String siteId,
    required String name,
    required String timezone,
    required List<String> days,
    required List<String> times,
  }) => _client.postJson(
    '/api/v1/content-planning/plans',
    body: {
      'siteId': siteId,
      'name': name,
      'timezone': timezone,
      'cadence': {'days': days, 'times': times},
      'status': 'active',
    },
  );
  Future<void> setPlanStatus(String id, String status) => _client.patchJson(
    '/api/v1/content-planning/plans/${Uri.encodeComponent(id)}',
    body: {'status': status},
  );
  Future<void> updatePlan({
    required String id,
    required String name,
    required String timezone,
    required List<String> days,
    required List<String> times,
  }) => _client.patchJson(
    '/api/v1/content-planning/plans/${Uri.encodeComponent(id)}',
    body: {
      'name': name,
      'timezone': timezone,
      'cadence': {'days': days, 'times': times},
    },
  );
  Future<void> schedulePlan(String id, int days) => _client.postJson(
    '/api/v1/content-planning/plans/${Uri.encodeComponent(id)}/schedule',
    body: {'horizonDays': days},
  );
  Future<void> recommend(String siteId) => _client.postJson(
    '/api/v1/content-planning/trends/recommend',
    body: {'siteId': siteId},
  );
  Future<void> importTrends(String siteId, String rawJson) => _client.postJson(
    '/api/v1/content-planning/trends/import',
    body: {'siteId': siteId, 'trendJson': rawJson},
  );
  Future<void> approveTopic(String topicId, String planId) => _client.postJson(
    '/api/v1/content-planning/topics/${Uri.encodeComponent(topicId)}/approve-to-plan',
    body: {'planId': planId},
  );
  Future<void> itemAction(String id, String action) => _client.postJson(
    '/api/v1/content-planning/items/${Uri.encodeComponent(id)}/$action',
  );

  Future<PerformanceInsights> insights(
    String siteId,
    String source,
  ) async => PerformanceInsights.fromJson(
    await _client.getJson(
      '/api/v1/content-planning/analytics/insights?siteId=${Uri.encodeQueryComponent(siteId)}&source=${Uri.encodeQueryComponent(source)}',
    ),
  );
  Future<void> importAnalytics(String siteId, String rawJson) async {
    final decoded = jsonDecode(rawJson);
    final snapshots = decoded is List
        ? decoded
        : (decoded is Map ? decoded['snapshots'] : null);
    if (snapshots is! List) {
      throw const FormatException(
        'JSON cần là một mảng snapshot hoặc có trường snapshots.',
      );
    }
    await _client.postJson(
      '/api/v1/content-planning/analytics/import',
      body: {'siteId': siteId, 'snapshots': snapshots},
    );
  }
}
