import 'dart:convert';

class PublishSchedule {
  const PublishSchedule({
    required this.id,
    required this.contentType,
    required this.days,
    required this.times,
    required this.isActive,
  });
  final String id;
  final String contentType;
  final List<String> days;
  final List<String> times;
  final bool isActive;

  factory PublishSchedule.fromJson(Map<String, dynamic> json) =>
      PublishSchedule(
        id: '${json['id'] ?? ''}',
        contentType: '${json['content_type'] ?? 'blog'}',
        days: _strings(json['days']),
        times: _strings(json['times']),
        isActive: json['is_active'] == true,
      );
}

class ContentPlanItem {
  const ContentPlanItem({
    required this.id,
    required this.topic,
    required this.status,
    required this.scheduledAt,
    required this.translationStatus,
    required this.dependenciesReady,
  });
  final String id;
  final String topic;
  final String status;
  final String scheduledAt;
  final String translationStatus;
  final bool dependenciesReady;
  factory ContentPlanItem.fromJson(Map<String, dynamic> json) =>
      ContentPlanItem(
        id: '${json['id'] ?? ''}',
        topic: '${json['topic'] ?? ''}',
        status: '${json['status'] ?? ''}',
        scheduledAt: '${json['scheduled_at'] ?? ''}',
        translationStatus: '${json['translation_status'] ?? ''}',
        dependenciesReady: json['dependencies_ready'] == true,
      );
}

class ContentPlan {
  const ContentPlan({
    required this.id,
    required this.siteId,
    required this.name,
    required this.timezone,
    required this.status,
    required this.days,
    required this.times,
    required this.items,
  });
  final String id;
  final String siteId;
  final String name;
  final String timezone;
  final String status;
  final List<String> days;
  final List<String> times;
  final List<ContentPlanItem> items;
  factory ContentPlan.fromJson(Map<String, dynamic> json) {
    dynamic cadence = json['cadence_json'];
    if (cadence is String) {
      try {
        cadence = jsonDecode(cadence);
      } catch (_) {
        cadence = const {};
      }
    }
    final cadenceMap = cadence is Map
        ? Map<String, dynamic>.from(cadence)
        : const <String, dynamic>{};
    return ContentPlan(
      id: '${json['id'] ?? ''}',
      siteId: '${json['site_id'] ?? ''}',
      name: '${json['name'] ?? ''}',
      timezone: '${json['timezone'] ?? 'UTC'}',
      status: '${json['status'] ?? 'draft'}',
      days: _strings(cadenceMap['days']),
      times: _strings(cadenceMap['times']),
      items: (json['items'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => ContentPlanItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class TopicSuggestion {
  const TopicSuggestion({
    required this.id,
    required this.siteId,
    required this.title,
    required this.keyword,
    required this.status,
    required this.score,
  });
  final String id, siteId, title, keyword, status;
  final double score;
  factory TopicSuggestion.fromJson(Map<String, dynamic> json) =>
      TopicSuggestion(
        id: '${json['id'] ?? ''}',
        siteId: '${json['site_id'] ?? ''}',
        title: '${json['title'] ?? ''}',
        keyword: '${json['primary_keyword'] ?? ''}',
        status: '${json['status'] ?? ''}',
        score: (json['overall_score'] as num?)?.toDouble() ?? 0,
      );
}

class PlanningReview {
  const PlanningReview({required this.topics, required this.items});
  final List<TopicSuggestion> topics;
  final List<ContentPlanItem> items;
  factory PlanningReview.fromJson(Map<String, dynamic> json) => PlanningReview(
    topics: (json['topics'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => TopicSuggestion.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
    items: (json['items'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => ContentPlanItem.fromJson(Map<String, dynamic>.from(e)))
        .toList(),
  );
}

class PerformanceInsights {
  const PerformanceInsights({
    required this.snapshotCount,
    required this.clicks,
    required this.impressions,
    required this.sessions,
    required this.conversions,
    required this.ctr,
    required this.engagementRate,
    required this.conversionRate,
  });
  final int snapshotCount;
  final double clicks,
      impressions,
      sessions,
      conversions,
      ctr,
      engagementRate,
      conversionRate;
  factory PerformanceInsights.fromJson(Map<String, dynamic> json) {
    final totals = Map<String, dynamic>.from(
      json['totals'] as Map? ?? const {},
    );
    final derived = Map<String, dynamic>.from(
      json['derived'] as Map? ?? const {},
    );
    double number(dynamic value) => (value as num?)?.toDouble() ?? 0;
    return PerformanceInsights(
      snapshotCount: (json['snapshotCount'] as num?)?.toInt() ?? 0,
      clicks: number(totals['clicks']),
      impressions: number(totals['impressions']),
      sessions: number(totals['sessions']),
      conversions: number(totals['conversions']),
      ctr: number(derived['ctr']),
      engagementRate: number(derived['engagementRate']),
      conversionRate: number(derived['conversionRate']),
    );
  }
}

List<String> _strings(dynamic value) =>
    (value as List? ?? const []).map((e) => '$e').toList();
