import 'package:flutter_test/flutter_test.dart';
import 'package:schools_ai_app/features/posts/data/content_post.dart';

void main() {
  test('maps post targets and media from API response', () {
    final post = ContentPost.fromJson({
      'id': 'post-1',
      'title': 'Ngày hội tuyển sinh',
      'content': 'Nội dung',
      'created': '2026-08-12T08:00:00.000Z',
      'targets': [
        {'id': 'target-1', 'platform': 'facebook', 'status': 'pending'},
      ],
      'media': [
        {'url': 'https://example.com/image.jpg', 'type': 'image'},
      ],
    });

    expect(post.id, 'post-1');
    expect(post.targets.single.platform, 'facebook');
    expect(post.media.single.type, 'image');
    expect(post.canApprove, isTrue);
  });

  test('post without pending targets cannot be approved', () {
    final post = ContentPost.fromJson({
      'targets': [
        {'status': 'published'},
      ],
    });

    expect(post.canApprove, isFalse);
  });
}
