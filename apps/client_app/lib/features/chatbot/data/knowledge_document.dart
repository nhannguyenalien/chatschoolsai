class KnowledgeDocument {
  const KnowledgeDocument({
    required this.id,
    required this.title,
    required this.charCount,
    required this.created,
  });

  final String id;
  final String title;
  final int charCount;
  final DateTime? created;

  factory KnowledgeDocument.fromJson(Map<String, dynamic> json) =>
      KnowledgeDocument(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? 'Không có tiêu đề',
        charCount: (json['char_count'] as num?)?.toInt() ?? 0,
        created: DateTime.tryParse(json['created'] as String? ?? ''),
      );
}
