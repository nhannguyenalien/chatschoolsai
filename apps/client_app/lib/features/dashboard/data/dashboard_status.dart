class DashboardStatus {
  const DashboardStatus({
    required this.tenant,
    required this.pending,
    required this.approved,
    required this.scheduled,
    required this.publishing,
    required this.published,
    required this.error,
  });

  factory DashboardStatus.fromJson(Map<String, dynamic> json) {
    int count(String key) => (json[key] as num?)?.toInt() ?? 0;

    return DashboardStatus(
      tenant: json['tenant']?.toString() ?? '—',
      pending: count('pending'),
      approved: count('approved'),
      scheduled: count('scheduled'),
      publishing: count('publishing'),
      published: count('published'),
      error: count('error'),
    );
  }

  final String tenant;
  final int pending;
  final int approved;
  final int scheduled;
  final int publishing;
  final int published;
  final int error;
}
