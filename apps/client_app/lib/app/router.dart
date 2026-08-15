import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/agent_chat/presentation/agent_chat_screen.dart';
import '../features/chatbot/presentation/chatbot_screen.dart';
import '../features/content_center/presentation/content_center_screen.dart';
import '../features/dashboard/presentation/dashboard_screen.dart';
import '../features/loyalty/presentation/loyalty_screen.dart';
import '../features/messages/presentation/messages_screen.dart';
import '../shared/presentation/adaptive_shell.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/dashboard',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AdaptiveShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (_, _) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/agent',
                builder: (_, _) => const AgentChatScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/chatbot',
                builder: (_, _) => const ChatbotScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/messages',
                builder: (_, _) => const MessagesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/posts',
                builder: (_, _) => const ContentCenterScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/loyalty',
                builder: (_, _) => const LoyaltyScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
