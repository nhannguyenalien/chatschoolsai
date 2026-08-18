import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/calls/call_rtc_client.dart';
import '../../../core/calls/ringtone_service.dart';
import '../data/call_record.dart';
import '../data/calls_repository.dart';

enum CallPhase { idle, outgoingRinging, incomingRinging, connecting, active }

class CallState {
  const CallState({
    this.phase = CallPhase.idle,
    this.activeCall,
    this.elapsed = Duration.zero,
    this.muted = false,
    this.errorMessage,
  });

  final CallPhase phase;
  final CallRecord? activeCall;
  final Duration elapsed;
  final bool muted;
  final String? errorMessage;

  bool get isIdle => phase == CallPhase.idle;

  CallState copyWith({
    CallPhase? phase,
    CallRecord? activeCall,
    Duration? elapsed,
    bool? muted,
    String? errorMessage,
    bool clearError = false,
  }) => CallState(
    phase: phase ?? this.phase,
    activeCall: activeCall ?? this.activeCall,
    elapsed: elapsed ?? this.elapsed,
    muted: muted ?? this.muted,
    errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
  );
}

/// Orchestrates a real WebRTC call, mirroring `startCall()`/`acceptIncomingCall()`/
/// `declineIncomingCall()`/`endCall()`/`handleCallRecord()` in `dash-tabler/messages.html`.
/// The web version detects incoming/updated calls via a PocketBase realtime subscription;
/// this app doesn't hold a PocketBase session, so it polls `/api/v1/calls` instead — same
/// end state (ringing/active/ended), just detected a few seconds later.
class CallController extends StateNotifier<CallState> {
  CallController(this._ref, this._repository, this._rtcDio, this._ringtone)
    : super(const CallState()) {
    _ref.listen<AuthState>(authControllerProvider, (previous, next) {
      if (next.isAuthenticated && !(previous?.isAuthenticated ?? false)) {
        _startPolling();
      } else if (!next.isAuthenticated) {
        _stopPolling();
      }
    }, fireImmediately: true);
  }

  final Ref _ref;
  final CallsRepository _repository;
  final Dio _rtcDio;
  final RingtoneService _ringtone;

  CallRtcClient? _rtc;
  Timer? _pollTimer;
  Timer? _elapsedTimer;
  DateTime? _startedAt;

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) => _poll());
    unawaited(_poll());
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _poll() async {
    if (state.phase == CallPhase.connecting) return;
    List<CallRecord> calls;
    try {
      calls = await _repository.fetchActiveCalls();
    } catch (_) {
      return;
    }

    final current = state.activeCall;
    if (current != null &&
        (state.phase == CallPhase.outgoingRinging ||
            state.phase == CallPhase.active)) {
      final mine = calls.where((c) => c.id == current.id).firstOrNull;
      if (mine == null) {
        await _handleRemoteEnd();
        return;
      }
      if (mine.isActive && state.phase == CallPhase.outgoingRinging) {
        state = state.copyWith(phase: CallPhase.active, activeCall: mine);
        _startElapsedTimer();
        return;
      }
      state = state.copyWith(activeCall: mine);
      return;
    }

    if (state.phase != CallPhase.idle &&
        state.phase != CallPhase.incomingRinging) {
      return;
    }

    final incoming = calls
        .where((c) => c.isRinging && c.isFromCustomer)
        .firstOrNull;
    if (incoming == null) {
      if (state.phase == CallPhase.incomingRinging) {
        _ringtone.stop();
        state = const CallState();
      }
      return;
    }
    if (state.phase == CallPhase.idle) {
      state = state.copyWith(
        phase: CallPhase.incomingRinging,
        activeCall: incoming,
      );
      unawaited(_ringtone.start());
    } else if (state.activeCall?.id != incoming.id) {
      state = state.copyWith(activeCall: incoming);
    }
  }

  Future<void> startCall(String session) async {
    if (state.phase != CallPhase.idle) return;
    state = const CallState(phase: CallPhase.outgoingRinging);
    final rtc = CallRtcClient(_rtcDio);
    _rtc = rtc;
    try {
      final leg = await rtc.createLocalCallLeg();
      final call = await _repository.startCall(
        session: session,
        cfSessionId: leg.sessionId,
        trackName: leg.trackName,
      );
      state = state.copyWith(activeCall: call);
    } catch (_) {
      await _teardown();
      state = const CallState(
        errorMessage: 'Không thể bắt đầu cuộc gọi. Vui lòng thử lại.',
      );
    }
  }

  Future<void> acceptIncomingCall() async {
    final call = state.activeCall;
    if (call == null) return;
    _ringtone.stop();
    state = state.copyWith(phase: CallPhase.connecting);
    final rtc = CallRtcClient(_rtcDio);
    _rtc = rtc;
    try {
      final leg = await rtc.createLocalCallLeg();
      await rtc.pullRemoteCallLeg(
        call.customerCfSessionId,
        call.customerTrackName,
      );
      final updated = await _repository.acceptCall(
        callId: call.id,
        cfSessionId: leg.sessionId,
        trackName: leg.trackName,
      );
      state = state.copyWith(phase: CallPhase.active, activeCall: updated);
      _startElapsedTimer();
    } catch (_) {
      await endCall(reason: 'error');
    }
  }

  Future<void> declineIncomingCall() async {
    final call = state.activeCall;
    _ringtone.stop();
    state = const CallState();
    if (call != null) {
      try {
        await _repository.declineCall(call.id);
      } catch (_) {
        // best-effort — call still disappears from this device's UI
      }
    }
  }

  Future<void> endCall({String? reason}) async {
    final call = state.activeCall;
    final wasUnansweredIncoming =
        call != null && call.isRinging && call.isFromCustomer;
    _ringtone.stop();
    _stopElapsedTimer();
    await _teardown();
    state = const CallState();
    if (call != null && !call.isEnded) {
      try {
        await _repository.endCall(
          call.id,
          reason: reason ?? (wasUnansweredIncoming ? 'declined' : 'hangup'),
        );
      } catch (_) {
        // best-effort — matches endRealCall()'s error handling on web
      }
    }
  }

  void toggleMute() {
    final muted = !state.muted;
    _rtc?.setMuted(muted);
    state = state.copyWith(muted: muted);
  }

  Future<void> _handleRemoteEnd() async {
    _stopElapsedTimer();
    await _teardown();
    state = const CallState();
  }

  Future<void> _teardown() async {
    await _rtc?.teardown();
    _rtc = null;
  }

  void _startElapsedTimer() {
    _startedAt = DateTime.now();
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      state = state.copyWith(elapsed: DateTime.now().difference(_startedAt!));
    });
  }

  void _stopElapsedTimer() {
    _elapsedTimer?.cancel();
    _elapsedTimer = null;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _elapsedTimer?.cancel();
    unawaited(_ringtone.dispose());
    unawaited(_rtc?.teardown());
    super.dispose();
  }
}

final callControllerProvider = StateNotifierProvider<CallController, CallState>(
  (ref) => CallController(
    ref,
    ref.watch(callsRepositoryProvider),
    ref.watch(callRtcDioProvider),
    RingtoneService(),
  ),
);
