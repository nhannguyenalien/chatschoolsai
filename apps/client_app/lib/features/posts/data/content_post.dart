class PostTarget {
  const PostTarget({
    required this.id,
    required this.platform,
    required this.status,
    required this.scheduledAt,
    required this.errorLog,
    required this.publishedPostId,
  });

  factory PostTarget.fromJson(Map<String, dynamic> json) => PostTarget(
    id: json['id']?.toString() ?? '',
    platform: json['platform']?.toString() ?? 'unknown',
    status: json['status']?.toString() ?? 'unknown',
    scheduledAt: json['scheduled_at']?.toString() ?? '',
    errorLog: json['error_log']?.toString() ?? '',
    publishedPostId: json['published_post_id']?.toString() ?? '',
  );

  final String id;
  final String platform;
  final String status;
  final String scheduledAt;
  final String errorLog;
  final String publishedPostId;
}

class PostMedia {
  const PostMedia({required this.url, required this.type});

  factory PostMedia.fromJson(Map<String, dynamic> json) => PostMedia(
    url: json['url']?.toString() ?? '',
    type: json['type']?.toString() ?? '',
  );

  final String url;
  final String type;
}

class ContentPost {
  const ContentPost({
    required this.id,
    required this.title,
    required this.content,
    required this.created,
    required this.targets,
    required this.media,
  });

  factory ContentPost.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> maps(String key) =>
        (json[key] as List? ?? const [])
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();

    return ContentPost(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Bài viết chưa có tiêu đề',
      content: json['content']?.toString() ?? '',
      created: DateTime.tryParse(json['created']?.toString() ?? ''),
      targets: maps('targets').map(PostTarget.fromJson).toList(),
      media: maps('media').map(PostMedia.fromJson).toList(),
    );
  }

  final String id;
  final String title;
  final String content;
  final DateTime? created;
  final List<PostTarget> targets;
  final List<PostMedia> media;

  bool get canApprove => targets.any((target) => target.status == 'pending');
}
