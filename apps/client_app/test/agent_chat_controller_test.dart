import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/agent_chat/data/agent_chat_repository.dart';
import 'package:schools_ai_app/features/agent_chat/data/agent_message.dart';
import 'package:schools_ai_app/features/agent_chat/presentation/agent_chat_controller.dart';

class FakeAgentChatRepository implements AgentChatRepository {
  List<AgentMessage>? received;

  @override
  Future<String> send(List<AgentMessage> messages) async {
    received = messages;
    return 'Đã cập nhật cấu hình.';
  }
}

void main() {
  test('keeps conversation history when sending to agent', () async {
    final repository = FakeAgentChatRepository();
    final controller = AgentChatController(repository);

    await controller.send('  Kiểm tra cấu hình  ');

    expect(repository.received!.single.content, 'Kiểm tra cấu hình');
    expect(controller.state.messages, hasLength(2));
    expect(controller.state.messages.last.role, AgentMessageRole.assistant);
    expect(controller.state.isSending, isFalse);
  });

  test('rejects oversized message before calling repository', () async {
    final repository = FakeAgentChatRepository();
    final controller = AgentChatController(repository);

    await controller.send('x' * 10001);

    expect(repository.received, isNull);
    expect(controller.state.messages, isEmpty);
    expect(controller.state.errorMessage, contains('10.000'));
  });
}
