import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../config/app_config.dart';

class CallRtcException implements Exception {
  const CallRtcException(this.message);

  final String message;

  @override
  String toString() => message;
}

class LocalCallLeg {
  const LocalCallLeg({required this.sessionId, required this.trackName});

  final String sessionId;
  final String trackName;
}

/// Dart port of the WebRTC signaling flow the web dashboard uses
/// (`dash-tabler/messages.html`: createLocalCallLeg/pullRemoteCallLeg/teardownCallLocal),
/// talking to the same unauthenticated worker proxy (`/call/rtc/*`) that holds the Cloudflare
/// Realtime app secret — one instance per call.
class CallRtcClient {
  CallRtcClient(this._dio);

  final Dio _dio;

  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  String? _sessionId;

  void Function(MediaStream stream)? onRemoteStream;

  Future<LocalCallLeg> createLocalCallLeg() async {
    final created = await _post('/call/rtc/session-new');
    final sessionId = created['sessionId'] as String?;
    if (sessionId == null || sessionId.isEmpty) {
      throw CallRtcException(
        created['error']?.toString() ?? 'Không tạo được phiên gọi',
      );
    }
    _sessionId = sessionId;

    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': false,
    });
    final pc = await createPeerConnection({});
    _pc = pc;
    pc.onTrack = (event) {
      if (event.streams.isNotEmpty) onRemoteStream?.call(event.streams.first);
    };

    final track = _localStream!.getAudioTracks().first;
    final transceiver = await pc.addTransceiver(
      track: track,
      init: RTCRtpTransceiverInit(direction: TransceiverDirection.SendOnly),
    );
    final trackName = 'mic-${_randomSuffix()}';

    final offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    final pushed = await _post('/call/rtc/tracks-new', {
      'sessionId': sessionId,
      'payload': {
        'sessionDescription': {'type': 'offer', 'sdp': offer.sdp},
        'tracks': [
          {'location': 'local', 'mid': transceiver.mid, 'trackName': trackName},
        ],
      },
    });
    await _applyRemoteDescriptionIfPresent(pc, pushed);

    return LocalCallLeg(sessionId: sessionId, trackName: trackName);
  }

  Future<void> pullRemoteCallLeg(
    String remoteSessionId,
    String remoteTrackName,
  ) async {
    final pc = _pc;
    final sessionId = _sessionId;
    if (pc == null || sessionId == null) {
      throw const CallRtcException('Chưa khởi tạo phiên gọi cục bộ');
    }
    final pulled = await _post('/call/rtc/tracks-new', {
      'sessionId': sessionId,
      'payload': {
        'tracks': [
          {
            'location': 'remote',
            'sessionId': remoteSessionId,
            'trackName': remoteTrackName,
          },
        ],
      },
    });
    if (pulled['requiresImmediateRenegotiation'] != true) return;

    final offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    final renegotiated = await _post('/call/rtc/renegotiate', {
      'sessionId': sessionId,
      'payload': {
        'sessionDescription': {'type': 'offer', 'sdp': offer.sdp},
      },
    });
    await _applyRemoteDescriptionIfPresent(pc, renegotiated);
  }

  void setMuted(bool muted) {
    for (final track in _localStream?.getAudioTracks() ?? const []) {
      track.enabled = !muted;
    }
  }

  Future<void> teardown() async {
    final sessionId = _sessionId;
    await _localStream?.dispose();
    await _pc?.close();
    _pc = null;
    _localStream = null;
    _sessionId = null;
    if (sessionId != null) {
      try {
        await _post('/call/rtc/tracks-close', {
          'sessionId': sessionId,
          'payload': {},
        });
      } catch (_) {
        // best-effort cleanup, giống teardownCallLocal() trên web
      }
    }
  }

  Future<void> _applyRemoteDescriptionIfPresent(
    RTCPeerConnection pc,
    Map<String, dynamic> response,
  ) async {
    final remoteDesc = response['sessionDescription'] as Map?;
    if (remoteDesc == null) return;
    await pc.setRemoteDescription(
      RTCSessionDescription(
        remoteDesc['sdp'] as String?,
        remoteDesc['type'] as String?,
      ),
    );
  }

  Future<Map<String, dynamic>> _post(
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final response = await _dio.post<Map<String, dynamic>>(
      path,
      data: body ?? const {},
    );
    return response.data ?? const {};
  }

  String _randomSuffix() {
    final micros = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
    return micros.substring(micros.length > 8 ? micros.length - 8 : 0);
  }
}

/// Plain (unauthenticated) Dio pointed at the worker — `/call/rtc/*` mirrors the web dashboard's
/// direct `fetch(WORKER_URL + path)` calls and does not need the tenant Bearer apiKey.
final callRtcDioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  return Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
    ),
  );
});
