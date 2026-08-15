import '../../../core/network/api_client.dart';
import 'content_post.dart';

abstract interface class PostsRepository {
  Future<List<ContentPost>> fetchPosts({String? status});
  Future<int> approvePost(String postId);
}

class ApiPostsRepository implements PostsRepository {
  const ApiPostsRepository(this._client);

  final ApiClient _client;

  @override
  Future<List<ContentPost>> fetchPosts({String? status}) async {
    final query = status == null
        ? ''
        : '?status=${Uri.encodeQueryComponent(status)}';
    final json = await _client.getJson('/api/v1/posts$query');
    final posts = json['posts'] as List? ?? const [];
    return posts
        .whereType<Map>()
        .map((item) => ContentPost.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  @override
  Future<int> approvePost(String postId) async {
    final id = Uri.encodeComponent(postId);
    final json = await _client.postJson('/api/v1/posts/$id/approve');
    return (json['approved'] as num?)?.toInt() ?? 0;
  }
}
