import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_localizations.dart';
import 'call_controller.dart';

/// Persistent call status bar — mirrors `#call-bar` in `dash-tabler/messages.html`.
/// Shown above the current tab's content whenever a call is outgoing/connecting/active.
class CallBar extends ConsumerWidget {
  const CallBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final call = ref.watch(callControllerProvider);
    final visible =
        call.phase == CallPhase.outgoingRinging ||
        call.phase == CallPhase.connecting ||
        call.phase == CallPhase.active;
    if (!visible) return const SizedBox.shrink();

    final controller = ref.read(callControllerProvider.notifier);
    final label = switch (call.phase) {
      CallPhase.outgoingRinging => context.l10n.tr('calling'),
      CallPhase.connecting => context.l10n.tr('connecting'),
      CallPhase.active => _formatElapsed(call.elapsed),
      _ => '',
    };

    return Material(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Icon(
                call.phase == CallPhase.outgoingRinging
                    ? Icons.call_made_rounded
                    : Icons.call_rounded,
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
              if (call.phase == CallPhase.active)
                IconButton(
                  tooltip: call.muted
                      ? context.l10n.tr('unmute')
                      : context.l10n.tr('mute'),
                  icon: Icon(
                    call.muted ? Icons.mic_off_rounded : Icons.mic_rounded,
                  ),
                  onPressed: controller.toggleMute,
                ),
              IconButton(
                tooltip: context.l10n.tr('end_call'),
                icon: const Icon(Icons.call_end_rounded),
                color: Theme.of(context).colorScheme.error,
                onPressed: () => controller.endCall(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatElapsed(Duration duration) {
    final seconds = duration.inSeconds;
    final minutes = (seconds ~/ 60).toString().padLeft(2, '0');
    final remaining = (seconds % 60).toString().padLeft(2, '0');
    return '$minutes:$remaining';
  }
}
