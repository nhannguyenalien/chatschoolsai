import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_localizations.dart';
import 'call_controller.dart';

/// Full-screen incoming-call popup — mirrors `#incoming-call-overlay` in
/// `dash-tabler/messages.html`. Mounted once at the app shell root so it appears
/// regardless of which tab is active.
class IncomingCallOverlay extends ConsumerWidget {
  const IncomingCallOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final call = ref.watch(callControllerProvider);
    if (call.phase != CallPhase.incomingRinging) return const SizedBox.shrink();

    final controller = ref.read(callControllerProvider.notifier);
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.92),
        child: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircleAvatar(
                radius: 48,
                backgroundColor: Colors.blueGrey,
                child: Icon(Icons.person, size: 48, color: Colors.white),
              ),
              const SizedBox(height: 20),
              Text(
                context.l10n.tr('incoming_call'),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 48),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _CircleAction(
                    icon: Icons.call_end_rounded,
                    background: Colors.red,
                    tooltip: context.l10n.tr('decline_call'),
                    onPressed: controller.declineIncomingCall,
                  ),
                  const SizedBox(width: 48),
                  _CircleAction(
                    icon: Icons.call_rounded,
                    background: Colors.green,
                    tooltip: context.l10n.tr('answer_call'),
                    onPressed: controller.acceptIncomingCall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CircleAction extends StatelessWidget {
  const _CircleAction({
    required this.icon,
    required this.background,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final Color background;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 64,
    height: 64,
    child: IconButton.filled(
      tooltip: tooltip,
      style: IconButton.styleFrom(backgroundColor: background),
      icon: Icon(icon, color: Colors.white, size: 28),
      onPressed: onPressed,
    ),
  );
}
