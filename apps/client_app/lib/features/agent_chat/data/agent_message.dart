enum AgentMessageRole { user, assistant }

class AgentMessage {
  const AgentMessage({required this.role, required this.content});

  final AgentMessageRole role;
  final String content;

  Map<String, String> toJson() => {
    'role': role == AgentMessageRole.user ? 'user' : 'assistant',
    'content': content,
  };
}
