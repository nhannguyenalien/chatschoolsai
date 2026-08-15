import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/chat_message.dart';
import '../data/messages_repository.dart';

final messagesRepositoryProvider = Provider<MessagesRepository>((ref) {
  return ApiMessagesRepository(ref.watch(apiClientProvider));
});

final messagesProvider = FutureProvider<List<ChatSession>>((ref) async {
  final messages = await ref.watch(messagesRepositoryProvider).fetchMessages();
  return groupChatSessions(messages);
});
