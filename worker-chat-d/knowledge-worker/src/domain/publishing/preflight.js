// Kiểm tra trước giờ đăng: phát hiện lỗi chắc chắn xảy ra (token, media, caption) khi còn thời gian sửa.
// Không đăng gì cả; chỉ đọc. Trả về danh sách vấn đề, rỗng nghĩa là ổn.
export const PREFLIGHT_WINDOW_MINUTES = 75;
export const PREFLIGHT_MARKER = '⚠️ Cảnh báo trước giờ đăng';
const IG_CAPTION_LIMIT = 2200;
const META_TOKEN_CODES = new Set([102, 190]);

async function mediaReachable(url, fetchImpl) {
  try {
    let res = await fetchImpl(url, { method: 'HEAD', timeout: 15e3 });
    // Một số CDN không cho HEAD; thử lại bằng GET có Range để không tải cả file.
    if (res.status === 405 || res.status === 403) res = await fetchImpl(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, timeout: 15e3 });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

export async function checkTargetPreflight({ target, page, post, media, graphVersion = 'v19.0', fetchImpl }) {
  const problems = [];
  const platform = target.platform;
  if (!post) problems.push('Không tìm thấy bài viết gốc.');
  if (!page || !page.access_token) {
    problems.push('Chưa cấu hình token cho trang này (sm-config.html).');
    return problems;
  }
  if (platform === 'facebook' || platform === 'instagram') {
    try {
      const res = await fetchImpl(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(page.page_id)}?fields=id&access_token=${encodeURIComponent(page.access_token)}`, { timeout: 15e3 });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        const code = Number(data.error?.code);
        problems.push(META_TOKEN_CODES.has(code)
          ? 'Token trang đã hết hạn hoặc không hợp lệ — vào sm-config.html kết nối lại.'
          : `Meta từ chối truy cập trang: ${String(data.error?.message || res.status).slice(0, 150)}`);
      }
    } catch {
      // Lỗi mạng khi kiểm tra không phải lỗi của bài; để lần kiểm tra sau.
    }
  }
  if (platform === 'instagram') {
    if (!media?.url) problems.push('Instagram bắt buộc có ảnh/video nhưng bài chưa có media.');
    if ((post?.content || '').length > IG_CAPTION_LIMIT) problems.push(`Caption dài ${post.content.length} ký tự, vượt giới hạn ${IG_CAPTION_LIMIT} của Instagram.`);
  }
  if (media?.url && !(await mediaReachable(media.url, fetchImpl))) {
    problems.push('Không truy cập được URL ảnh/video của bài (có thể đã bị xoá hoặc chặn).');
  }
  return problems;
}

export function preflightNotice({ platform, title, scheduledAt, problems }) {
  return [
    `${PREFLIGHT_MARKER}${platform ? ` (${platform})` : ''}`,
    title ? `Bài: ${String(title).slice(0, 80)}` : null,
    scheduledAt ? `Giờ đăng: ${scheduledAt}` : null,
    ...problems.map((problem) => `- ${problem}`),
    'Hãy sửa trước giờ đăng, nếu không bài sẽ lỗi.'
  ].filter(Boolean).join('\n');
}
