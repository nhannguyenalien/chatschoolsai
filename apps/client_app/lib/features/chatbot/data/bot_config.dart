class BotConfig {
  const BotConfig({
    required this.tenant,
    required this.botName,
    required this.greeting,
    required this.systemPrompt,
    required this.model,
    required this.temperature,
    required this.maxTokens,
    required this.streaming,
  });

  final String tenant;
  final String botName;
  final String greeting;
  final String systemPrompt;
  final String model;
  final double temperature;
  final int maxTokens;
  final bool streaming;

  factory BotConfig.fromJson(Map<String, dynamic> json) => BotConfig(
    tenant: json['tenant'] as String? ?? '',
    botName: json['bot_name'] as String? ?? '',
    greeting: json['greeting'] as String? ?? '',
    systemPrompt: json['system_prompt'] as String? ?? '',
    model: json['model'] as String? ?? '',
    temperature: (json['temperature'] as num?)?.toDouble() ?? 0.7,
    maxTokens: (json['max_tokens'] as num?)?.toInt() ?? 1024,
    streaming: json['streaming'] as bool? ?? false,
  );

  Map<String, dynamic> toPatch() => {
    'bot_name': botName.trim(),
    'greeting': greeting.trim(),
    'system_prompt': systemPrompt.trim(),
    'model': model.trim(),
    'temperature': temperature,
    'max_tokens': maxTokens,
    'streaming': streaming,
  };

  BotConfig copyWith({
    String? botName,
    String? greeting,
    String? systemPrompt,
    String? model,
    double? temperature,
    int? maxTokens,
    bool? streaming,
  }) => BotConfig(
    tenant: tenant,
    botName: botName ?? this.botName,
    greeting: greeting ?? this.greeting,
    systemPrompt: systemPrompt ?? this.systemPrompt,
    model: model ?? this.model,
    temperature: temperature ?? this.temperature,
    maxTokens: maxTokens ?? this.maxTokens,
    streaming: streaming ?? this.streaming,
  );
}
