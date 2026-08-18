import 'dart:async';
import 'dart:math';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';

/// Incoming-call ringtone — a short 880Hz beep synthesized to PCM16 WAV bytes at
/// runtime and looped every second, mirroring `playRingtone()`/`beep()` in
/// `dash-tabler/messages.html` (Web Audio oscillator). No bundled audio asset needed.
class RingtoneService {
  RingtoneService() : _player = AudioPlayer(playerId: 'incoming-call-ringtone');

  final AudioPlayer _player;
  Timer? _timer;
  static final Uint8List _beepWav = _buildBeepWav();

  Future<void> start() async {
    stop();
    unawaited(_beep());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _beep());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    unawaited(_player.stop());
  }

  Future<void> dispose() async {
    stop();
    await _player.dispose();
  }

  Future<void> _beep() async {
    try {
      await _player.play(BytesSource(_beepWav, mimeType: 'audio/wav'));
    } catch (_) {
      // Ringtone is best-effort — a playback failure must not block the incoming call UI.
    }
  }

  static Uint8List _buildBeepWav() {
    const sampleRate = 8000;
    const durationMs = 400;
    const frequency = 880.0;
    final sampleCount = (sampleRate * durationMs / 1000).round();
    final samples = Int16List(sampleCount);
    for (var i = 0; i < sampleCount; i++) {
      final t = i / sampleRate;
      final envelope = exp(-4 * t / (durationMs / 1000));
      samples[i] = (sin(2 * pi * frequency * t) * 0.5 * envelope * 32767)
          .round();
    }
    return _pcm16ToWav(samples, sampleRate);
  }

  static Uint8List _pcm16ToWav(Int16List samples, int sampleRate) {
    final dataLength = samples.lengthInBytes;
    final buffer = ByteData(44 + dataLength);

    void writeString(int offset, String value) {
      for (var i = 0; i < value.length; i++) {
        buffer.setUint8(offset + i, value.codeUnitAt(i));
      }
    }

    writeString(0, 'RIFF');
    buffer.setUint32(4, 36 + dataLength, Endian.little);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    buffer.setUint32(16, 16, Endian.little);
    buffer.setUint16(20, 1, Endian.little); // PCM
    buffer.setUint16(22, 1, Endian.little); // mono
    buffer.setUint32(24, sampleRate, Endian.little);
    buffer.setUint32(28, sampleRate * 2, Endian.little); // byte rate
    buffer.setUint16(32, 2, Endian.little); // block align
    buffer.setUint16(34, 16, Endian.little); // bits per sample
    writeString(36, 'data');
    buffer.setUint32(40, dataLength, Endian.little);
    for (var i = 0; i < samples.length; i++) {
      buffer.setInt16(44 + i * 2, samples[i], Endian.little);
    }
    return buffer.buffer.asUint8List();
  }
}
