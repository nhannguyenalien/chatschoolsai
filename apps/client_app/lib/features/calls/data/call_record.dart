class CallRecord {
  const CallRecord({
    required this.id,
    required this.session,
    required this.status,
    required this.initiator,
    required this.customerCfSessionId,
    required this.customerTrackName,
    required this.adminCfSessionId,
    required this.adminTrackName,
    required this.endedReason,
    required this.createdAt,
  });

  factory CallRecord.fromJson(Map<String, dynamic> json) => CallRecord(
    id: json['id'] as String? ?? '',
    session: json['session'] as String? ?? '',
    status: json['status'] as String? ?? '',
    initiator: json['initiator'] as String? ?? '',
    customerCfSessionId: json['customer_cf_session_id'] as String? ?? '',
    customerTrackName: json['customer_track_name'] as String? ?? '',
    adminCfSessionId: json['admin_cf_session_id'] as String? ?? '',
    adminTrackName: json['admin_track_name'] as String? ?? '',
    endedReason: json['ended_reason'] as String? ?? '',
    createdAt: DateTime.tryParse(json['created'] as String? ?? '')?.toLocal(),
  );

  final String id;
  final String session;
  final String status;
  final String initiator;
  final String customerCfSessionId;
  final String customerTrackName;
  final String adminCfSessionId;
  final String adminTrackName;
  final String endedReason;
  final DateTime? createdAt;

  bool get isRinging => status == 'ringing';
  bool get isActive => status == 'active';
  bool get isEnded => status == 'ended';
  bool get isFromCustomer => initiator == 'customer';
}
