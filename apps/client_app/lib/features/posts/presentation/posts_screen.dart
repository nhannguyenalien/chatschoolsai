import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../dashboard/presentation/dashboard_controller.dart';
import '../data/content_post.dart';
import 'posts_controller.dart';

class PostsScreen extends ConsumerWidget {
  const PostsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedStatus = ref.watch(selectedPostStatusProvider);
    final posts = ref.watch(postsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Bài viết',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Duyệt và theo dõi nội dung trên mọi kênh.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 18),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final status in postStatuses) ...[
                      ChoiceChip(
                        label: Text(_statusLabel(status)),
                        selected: selectedStatus == status,
                        onSelected: (_) =>
                            ref
                                    .read(selectedPostStatusProvider.notifier)
                                    .state =
                                status,
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: posts.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => _PostsError(
              message: error.toString(),
              onRetry: () => ref.invalidate(postsProvider),
            ),
            data: (items) => RefreshIndicator(
              onRefresh: () => ref.refresh(postsProvider.future),
              child: items.isEmpty
                  ? const _EmptyPosts()
                  : LayoutBuilder(
                      builder: (context, constraints) => ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: EdgeInsets.fromLTRB(
                          constraints.maxWidth >= 1100 ? 64 : 20,
                          6,
                          constraints.maxWidth >= 1100 ? 64 : 20,
                          32,
                        ),
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        itemBuilder: (context, index) => _PostCard(
                          post: items[index],
                          onOpen: () =>
                              _showDetails(context, ref, items[index]),
                        ),
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _showDetails(
    BuildContext context,
    WidgetRef ref,
    ContentPost post,
  ) async {
    final approved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _PostDetails(post: post),
    );
    if (approved != true || !context.mounted) return;

    ref.invalidate(postsProvider);
    ref.invalidate(dashboardStatusProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã duyệt bài viết thành công.')),
    );
  }
}

class _PostCard extends StatelessWidget {
  const _PostCard({required this.post, required this.onOpen});
  final ContentPost post;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: onOpen,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _MediaThumbnail(media: post.media.firstOrNull),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    post.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    post.content,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final target in post.targets)
                        _TargetChip(target: target),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    ),
  );
}

class _MediaThumbnail extends StatelessWidget {
  const _MediaThumbnail({required this.media});
  final PostMedia? media;

  @override
  Widget build(BuildContext context) {
    final url = media?.url ?? '';
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 72,
        height: 72,
        child: url.isEmpty
            ? ColoredBox(
                color: Theme.of(context).colorScheme.secondaryContainer,
                child: const Icon(Icons.article_outlined),
              )
            : Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const ColoredBox(
                  color: Color(0xFFE7EDF3),
                  child: Icon(Icons.broken_image_outlined),
                ),
              ),
      ),
    );
  }
}

class _TargetChip extends StatelessWidget {
  const _TargetChip({required this.target});
  final PostTarget target;

  @override
  Widget build(BuildContext context) => Chip(
    visualDensity: VisualDensity.compact,
    avatar: Icon(_platformIcon(target.platform), size: 16),
    label: Text('${target.platform} · ${_statusLabel(target.status)}'),
    side: BorderSide.none,
  );
}

class _PostDetails extends ConsumerStatefulWidget {
  const _PostDetails({required this.post});
  final ContentPost post;

  @override
  ConsumerState<_PostDetails> createState() => _PostDetailsState();
}

class _PostDetailsState extends ConsumerState<_PostDetails> {
  bool approving = false;
  String? error;

  @override
  Widget build(BuildContext context) => DraggableScrollableSheet(
    expand: false,
    initialChildSize: .88,
    minChildSize: .5,
    maxChildSize: .96,
    builder: (context, controller) => ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
      children: [
        Center(
          child: Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.outlineVariant,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        const SizedBox(height: 22),
        Text(
          widget.post.title,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 16),
        if (widget.post.media.firstOrNull case final media?) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.network(
              media.url,
              height: 220,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const SizedBox.shrink(),
            ),
          ),
          const SizedBox(height: 18),
        ],
        SelectableText(widget.post.content),
        const SizedBox(height: 22),
        Text('Kênh xuất bản', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        for (final target in widget.post.targets)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(child: Icon(_platformIcon(target.platform))),
            title: Text(target.platform),
            subtitle: Text(
              target.errorLog.isEmpty
                  ? _statusLabel(target.status)
                  : '${_statusLabel(target.status)} · ${target.errorLog}',
            ),
          ),
        if (error != null) ...[
          const SizedBox(height: 8),
          Text(
            error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ],
        const SizedBox(height: 18),
        if (widget.post.canApprove)
          FilledButton.icon(
            onPressed: approving ? null : _confirmApprove,
            icon: approving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.task_alt_rounded),
            label: Text(approving ? 'Đang duyệt…' : 'Duyệt bài viết'),
          ),
      ],
    ),
  );

  Future<void> _confirmApprove() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Duyệt bài viết?'),
        content: const Text(
          'Tất cả kênh đang chờ sẽ được chuyển sang đã duyệt và có thể được worker đăng trong vòng 15 phút.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Duyệt'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      approving = true;
      error = null;
    });
    try {
      await ref.read(postsRepositoryProvider).approvePost(widget.post.id);
      if (mounted) Navigator.pop(context, true);
    } catch (exception) {
      if (!mounted) return;
      setState(() {
        approving = false;
        error = exception.toString();
      });
    }
  }
}

class _EmptyPosts extends StatelessWidget {
  const _EmptyPosts();

  @override
  Widget build(BuildContext context) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    children: [
      SizedBox(height: MediaQuery.sizeOf(context).height * .18),
      const Icon(Icons.inbox_outlined, size: 54),
      const SizedBox(height: 12),
      Text(
        'Chưa có bài viết',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.titleLarge,
      ),
      const SizedBox(height: 6),
      const Text('Kéo xuống để tải lại dữ liệu.', textAlign: TextAlign.center),
    ],
  );
}

class _PostsError extends StatelessWidget {
  const _PostsError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, size: 48),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Thử lại'),
          ),
        ],
      ),
    ),
  );
}

String _statusLabel(String? status) => switch (status) {
  null => 'Tất cả',
  'pending' => 'Chờ duyệt',
  'approved' => 'Đã duyệt',
  'scheduled' => 'Đã lên lịch',
  'publishing' => 'Đang đăng',
  'published' => 'Đã đăng',
  'error' => 'Lỗi',
  _ => status,
};

IconData _platformIcon(String platform) => switch (platform.toLowerCase()) {
  'facebook' => Icons.facebook_rounded,
  'instagram' => Icons.camera_alt_outlined,
  'wordpress' => Icons.language_rounded,
  'sanity' => Icons.web_rounded,
  _ => Icons.public_rounded,
};
