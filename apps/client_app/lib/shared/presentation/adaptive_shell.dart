import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/localization/app_localizations.dart';

class AdaptiveShell extends ConsumerWidget {
  const AdaptiveShell({required this.shell, super.key});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final destinations = [
      _destination(
        Icons.dashboard_outlined,
        Icons.dashboard,
        context.l10n.tr('nav_overview'),
      ),
      _destination(
        Icons.smart_toy_outlined,
        Icons.smart_toy,
        context.l10n.tr('nav_agent'),
      ),
      _destination(
        Icons.psychology_outlined,
        Icons.psychology,
        context.l10n.tr('nav_chatbot'),
      ),
      _destination(
        Icons.forum_outlined,
        Icons.forum,
        context.l10n.tr('nav_messages'),
      ),
      _destination(
        Icons.article_outlined,
        Icons.article,
        context.l10n.tr('nav_content'),
      ),
      _destination(
        Icons.redeem_outlined,
        Icons.redeem,
        context.l10n.tr('nav_loyalty'),
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 840;
        if (!wide) {
          return Scaffold(
            appBar: AppBar(
              title: const Text('Schools AI'),
              actions: [
                const LanguageMenu(),
                _LogoutButton(onPressed: () => _logout(ref)),
              ],
            ),
            body: shell,
            bottomNavigationBar: NavigationBar(
              selectedIndex: shell.currentIndex,
              destinations: destinations,
              onDestinationSelected: _goBranch,
            ),
          );
        }

        return Scaffold(
          body: Row(
            children: [
              SafeArea(
                child: NavigationRail(
                  extended: constraints.maxWidth >= 1120,
                  selectedIndex: shell.currentIndex,
                  onDestinationSelected: _goBranch,
                  leading: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 18),
                    child: Icon(Icons.auto_awesome_rounded, size: 32),
                  ),
                  trailing: Expanded(
                    child: Align(
                      alignment: Alignment.bottomCenter,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const LanguageMenu(),
                            _LogoutButton(onPressed: () => _logout(ref)),
                          ],
                        ),
                      ),
                    ),
                  ),
                  destinations: destinations
                      .map(
                        (item) => NavigationRailDestination(
                          icon: item.icon,
                          selectedIcon: item.selectedIcon,
                          label: Text(item.label),
                        ),
                      )
                      .toList(),
                ),
              ),
              const VerticalDivider(width: 1),
              Expanded(child: shell),
            ],
          ),
        );
      },
    );
  }

  void _goBranch(int index) =>
      shell.goBranch(index, initialLocation: index == shell.currentIndex);

  Future<void> _logout(WidgetRef ref) =>
      ref.read(authControllerProvider.notifier).signOut();

  NavigationDestination _destination(
    IconData icon,
    IconData selectedIcon,
    String label,
  ) => NavigationDestination(
    icon: Icon(icon),
    selectedIcon: Icon(selectedIcon),
    label: label,
  );
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: context.l10n.tr('logout'),
    onPressed: onPressed,
    icon: const Icon(Icons.logout_rounded),
  );
}
