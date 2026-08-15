import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/chatbot/data/bot_config.dart';

void main() {
  test('config patch contains only writable non-secret fields', () {
    final config = BotConfig.fromJson({
      'tenant': 'school-a',
      'bot_name': ' Bot ',
      'greeting': ' Hi ',
      'system_prompt': ' Prompt ',
      'model': ' model ',
      'temperature': 0.5,
      'max_tokens': 2048,
      'streaming': true,
      'api_key': 'must-not-leak',
      'cloudinary_api_secret': 'must-not-leak',
    });
    final patch = config.toPatch();
    expect(patch['bot_name'], 'Bot');
    expect(patch['temperature'], 0.5);
    expect(patch['streaming'], isTrue);
    expect(patch, isNot(contains('tenant')));
    expect(patch, isNot(contains('api_key')));
    expect(patch, isNot(contains('cloudinary_api_secret')));
  });
}
