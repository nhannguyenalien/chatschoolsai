import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'call_record.dart';

abstract interface class CallsRepository {
  Future<List<CallRecord>> fetchActiveCalls({String? session});

  Future<CallRecord> startCall({
    required String session,
    required String cfSessionId,
    required String trackName,
  });

  Future<CallRecord> acceptCall({
    required String callId,
    required String cfSessionId,
    required String trackName,
  });

  Future<CallRecord> declineCall(String callId);

  Future<CallRecord> endCall(String callId, {String? reason});
}

class ApiCallsRepository implements CallsRepository {
  const ApiCallsRepository(this._client);

  final ApiClient _client;

  @override
  Future<List<CallRecord>> fetchActiveCalls({String? session}) async {
    final path = (session == null || session.isEmpty)
        ? '/api/v1/calls'
        : '/api/v1/calls?session=${Uri.encodeQueryComponent(session)}';
    final json = await _client.getJson(path);
    final calls = json['calls'] as List? ?? const [];
    return calls
        .whereType<Map>()
        .map((item) => CallRecord.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  @override
  Future<CallRecord> startCall({
    required String session,
    required String cfSessionId,
    required String trackName,
  }) async {
    final json = await _client.postJson(
      '/api/v1/calls/start',
      body: {
        'session': session,
        'cf_session_id': cfSessionId,
        'track_name': trackName,
      },
    );
    return _callFromResponse(json);
  }

  @override
  Future<CallRecord> acceptCall({
    required String callId,
    required String cfSessionId,
    required String trackName,
  }) async {
    final json = await _client.postJson(
      '/api/v1/calls/accept',
      body: {
        'call_id': callId,
        'cf_session_id': cfSessionId,
        'track_name': trackName,
      },
    );
    return _callFromResponse(json);
  }

  @override
  Future<CallRecord> declineCall(String callId) async {
    final json = await _client.postJson(
      '/api/v1/calls/decline',
      body: {'call_id': callId},
    );
    return _callFromResponse(json);
  }

  @override
  Future<CallRecord> endCall(String callId, {String? reason}) async {
    final json = await _client.postJson(
      '/api/v1/calls/end',
      body: {'call_id': callId, 'reason': ?reason},
    );
    return _callFromResponse(json);
  }

  CallRecord _callFromResponse(Map<String, dynamic> json) =>
      CallRecord.fromJson(Map<String, dynamic>.from(json['call'] as Map));
}

final callsRepositoryProvider = Provider<CallsRepository>((ref) {
  return ApiCallsRepository(ref.watch(apiClientProvider));
});
