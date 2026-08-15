import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/content_post.dart';
import '../data/posts_repository.dart';

const postStatuses = <String?>[
  null,
  'pending',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'error',
];

final selectedPostStatusProvider = StateProvider<String?>((ref) => null);

final postsRepositoryProvider = Provider<PostsRepository>((ref) {
  return ApiPostsRepository(ref.watch(apiClientProvider));
});

final postsProvider = FutureProvider<List<ContentPost>>((ref) {
  final status = ref.watch(selectedPostStatusProvider);
  return ref.watch(postsRepositoryProvider).fetchPosts(status: status);
});
