export const API_DOCS_HTML = String.raw`
<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Knowledge Worker API</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --bg-alt: #f6f7f9;
    --fg: #1c1f26;
    --fg-muted: #5b6270;
    --border: #e3e6eb;
    --accent: #2f6feb;
    --accent-bg: #eaf1fe;
    --code-bg: #0f172a;
    --code-fg: #e2e8f0;
    --get: #0a7d3c;
    --post: #2f6feb;
    --put: #b5750a;
    --patch: #9a5cd0;
    --delete: #c0392b;
    --ok: #0a7d3c;
    --err: #c0392b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161a;
      --bg-alt: #1b1e24;
      --fg: #e7e9ee;
      --fg-muted: #9aa2b1;
      --border: #2a2e37;
      --accent: #6ea1ff;
      --accent-bg: #1c2740;
      --code-bg: #0b0e14;
      --code-fg: #d6deeb;
      --get: #3ecb7e;
      --post: #6ea1ff;
      --put: #e0a938;
      --patch: #c795f5;
      --delete: #f07868;
      --ok: #3ecb7e;
      --err: #f07868;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.55;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code, pre, .mono, input, textarea, button {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  code {
    font-size: 0.86em;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.1em 0.4em;
  }
  pre {
    background: var(--code-bg);
    color: var(--code-fg);
    border-radius: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    margin: 10px 0;
    font-size: 0.82rem;
  }
  pre code { background: none; border: none; padding: 0; color: inherit; }

  /* ---- top bar: API key + language ---- */
  .keybar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 20px;
    background: var(--accent-bg);
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
  }
  .keybar label { font-weight: 600; white-space: nowrap; }
  .keybar input[type="text"], .keybar input[type="password"] {
    flex: 1 1 260px;
    min-width: 180px;
    padding: 6px 9px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    font-size: 0.82rem;
  }
  .keybar select {
    padding: 6px 9px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    font-size: 0.82rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .keybar .hint { color: var(--fg-muted); font-size: 0.78rem; }
  .keybar .toggle-vis { cursor: pointer; }
  .keybar .spacer { flex: 1 1 0; min-width: 0; }

  .layout {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    max-width: 1180px;
    margin: 0 auto;
  }
  nav {
    position: sticky;
    top: 45px;
    align-self: start;
    max-height: calc(100vh - 45px);
    overflow-y: auto;
    padding: 24px 18px 40px;
    border-right: 1px solid var(--border);
  }
  nav .brand {
    font-weight: 700;
    font-size: 1.05rem;
    margin-bottom: 4px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  nav .brand small {
    display: block;
    font-weight: 400;
    color: var(--fg-muted);
    font-size: 0.75rem;
    margin-top: 2px;
  }
  nav ul { list-style: none; margin: 14px 0 0; padding: 0; }
  nav .group-title {
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
    color: var(--fg-muted);
    margin: 16px 0 6px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  nav li a {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 3px 0;
    color: var(--fg);
    font-size: 0.82rem;
  }
  nav li a:hover { color: var(--accent); text-decoration: none; }
  nav .m {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    min-width: 30px;
    text-align: center;
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  main { padding: 32px 40px 100px; min-width: 0; }
  main h1 { font-size: 1.7rem; margin-bottom: 6px; }
  main .lede { color: var(--fg-muted); margin-top: 0; max-width: 68ch; }

  .callout {
    background: var(--accent-bg);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 14px 16px;
    margin: 18px 0;
    font-size: 0.92rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .callout h3 { margin: 0 0 6px; font-size: 0.95rem; }
  .callout ol.conn-steps { margin: 10px 0 0; padding-left: 20px; }
  .callout ol.conn-steps li { margin-bottom: 8px; line-height: 1.5; }
  .callout ol.conn-steps li:last-child { margin-bottom: 0; }

  section.resource { margin-top: 46px; }
  section.resource h2 {
    font-size: 1.25rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }
  section.resource > p.desc { color: var(--fg-muted); margin-top: 4px; }

  .endpoint {
    margin: 26px 0;
    padding: 18px 20px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-alt);
  }
  .endpoint .sig {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 0.95rem;
  }
  .endpoint .sig .path { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 600; }
  .badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    color: #fff;
    letter-spacing: 0.02em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .badge.GET { background: var(--get); }
  .badge.POST { background: var(--post); }
  .badge.PUT { background: var(--put); }
  .badge.PATCH { background: var(--patch); }
  .badge.DELETE { background: var(--delete); }
  .badge.auth {
    background: transparent;
    color: var(--fg-muted);
    border: 1px solid var(--border);
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .endpoint .summary { margin: 8px 0 0; color: var(--fg); font-size: 0.9rem; }
  .field-table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 0.85rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .field-table th, .field-table td {
    text-align: left;
    padding: 5px 8px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .field-table th { color: var(--fg-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
  .field-table td.name { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: nowrap; }
  .field-table td.req { color: var(--delete); font-size: 0.75rem; }
  .field-table td.opt { color: var(--fg-muted); font-size: 0.75rem; }
  .note {
    font-size: 0.82rem;
    color: var(--fg-muted);
    margin-top: 8px;
    padding-left: 10px;
    border-left: 3px solid var(--border);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* ---- try it panel ---- */
  .tryit {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px dashed var(--border);
  }
  .tryit-toggle {
    background: none;
    border: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }
  .tryit-body { display: none; margin-top: 12px; }
  .tryit-body.open { display: block; }
  .tryit-row { margin: 8px 0; }
  .tryit-row label {
    display: block;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--fg-muted);
    margin-bottom: 3px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .tryit-row input, .tryit-row textarea {
    width: 100%;
    padding: 7px 9px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    font-size: 0.82rem;
  }
  .tryit-row textarea { min-height: 90px; resize: vertical; }
  .send-btn {
    padding: 7px 16px;
    border-radius: 6px;
    border: none;
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    font-size: 0.82rem;
    cursor: pointer;
    margin-top: 4px;
  }
  .send-btn:disabled { opacity: 0.6; cursor: default; }
  .tryit-result {
    margin-top: 10px;
    max-height: 320px;
  }
  .tryit-result.status-ok { border-left: 3px solid var(--ok); }
  .tryit-result.status-err { border-left: 3px solid var(--err); }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    nav { position: static; max-height: none; border-right: none; border-bottom: 1px solid var(--border); }
    .cols { grid-template-columns: 1fr; }
    main { padding: 24px 18px 80px; }
  }
  footer {
    max-width: 1180px;
    margin: 0 auto;
    padding: 24px 40px 60px;
    color: var(--fg-muted);
    font-size: 0.82rem;
    border-top: 1px solid var(--border);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
</style>
</head>
<body>

<div class="keybar">
  <label for="api-key-input" data-i18n="kb_label">API key</label>
  <input id="api-key-input" type="password" placeholder="sk_xxxxxxxxxxxxxxxx" autocomplete="off" />
  <span class="toggle-vis" id="toggle-key-vis" title="Hiện/ẩn key" data-i18n-title="kb_toggle_title">👁</span>
  <span class="hint" data-i18n="kb_hint">Chỉ lưu trong trình duyệt của bạn (localStorage) — dùng cho mọi nút "Gửi request" trên trang này.</span>
  <span class="spacer"></span>
  <select id="lang-select" onchange="setLang(this.value)" aria-label="Language">
    <option value="vi">🇻🇳 Tiếng Việt</option>
    <option value="en">🇬🇧 English</option>
    <option value="ja">🇯🇵 日本語</option>
    <option value="es">🇪🇸 Español</option>
    <option value="fr">🇫🇷 Français</option>
    <option value="ko">🇰🇷 한국어</option>
  </select>
</div>

<div class="layout">
<nav>
  <div class="brand">Knowledge Worker API
    <small>Chatbot · Loyalty · Content Planning</small>
  </div>
  <ul>
    <li><a href="#intro" data-i18n="nav_intro">Giới thiệu &amp; Auth</a></li>

    <div class="group-title" data-i18n="nav_g_botconfig">Bot &amp; cấu hình</div>
    <li><a href="#post-bots"><span class="m badge POST">POST</span> /bots</a></li>
    <li><a href="#get-config"><span class="m badge GET">GET</span> /config</a></li>
    <li><a href="#patch-config"><span class="m badge PATCH">PATCH</span> /config</a></li>
    <li><a href="#post-agent-chat"><span class="m badge POST">POST</span> /agent-chat</a></li>
    <li><a href="#get-agent-chat-tools"><span class="m badge GET">GET</span> /agent-chat/tools</a></li>
    <li><a href="#connect-messenger-instagram" data-i18n="conn_meta_nav">↳ Kết nối Messenger/Instagram</a></li>

    <div class="group-title" data-i18n="nav_g_chat">Chat &amp; khách hàng</div>
    <li><a href="#post-chat"><span class="m badge POST">POST</span> /chat</a></li>
    <li><a href="#post-chat-link"><span class="m badge POST">POST</span> /chat-link</a></li>
    <li><a href="#put-customer-context"><span class="m badge PUT">PUT</span> /customer-context</a></li>
    <li><a href="#get-messages"><span class="m badge GET">GET</span> /messages</a></li>
    <li><a href="#post-messages"><span class="m badge POST">POST</span> /messages</a></li>

    <div class="group-title" data-i18n="nav_g_calls">Gọi thoại (voice)</div>
    <li><a href="#get-calls"><span class="m badge GET">GET</span> /calls</a></li>
    <li><a href="#post-calls-start"><span class="m badge POST">POST</span> /calls/start</a></li>
    <li><a href="#post-calls-accept"><span class="m badge POST">POST</span> /calls/accept</a></li>
    <li><a href="#post-calls-end"><span class="m badge POST">POST</span> /calls/decline · /end</a></li>

    <div class="group-title" data-i18n="nav_g_content">Nội dung &amp; đăng bài</div>
    <li><a href="#get-posts"><span class="m badge GET">GET</span> /posts</a></li>
    <li><a href="#post-posts"><span class="m badge POST">POST</span> /posts</a></li>
    <li><a href="#post-posts-approve"><span class="m badge POST">POST</span> /posts/:id/approve</a></li>
    <li><a href="#post-content-cluster"><span class="m badge POST">POST</span> /content-cluster</a></li>
    <li><a href="#get-status"><span class="m badge GET">GET</span> /status</a></li>
    <li><a href="#post-trigger"><span class="m badge POST">POST</span> /trigger/*</a></li>

    <div class="group-title" data-i18n="nav_g_knowledge">Knowledge base</div>
    <li><a href="#get-knowledge"><span class="m badge GET">GET</span> /knowledge</a></li>
    <li><a href="#post-knowledge"><span class="m badge POST">POST</span> /knowledge</a></li>
    <li><a href="#delete-knowledge"><span class="m badge DELETE">DEL</span> /knowledge/:id</a></li>
    <li><a href="#post-knowledge-sync"><span class="m badge POST">POST</span> /knowledge/sync</a></li>

    <div class="group-title" data-i18n="nav_g_lessons">Bài học (Lessons)</div>
    <li><a href="#post-lessons"><span class="m badge POST">POST</span> /lessons</a></li>
    <li><a href="#delete-lessons"><span class="m badge DELETE">DEL</span> /lessons/:id</a></li>

    <div class="group-title" data-i18n="nav_g_marketplace">Marketplace / API ngoài</div>
    <li><a href="#get-agent-tools"><span class="m badge GET">GET</span> /agent-tools</a></li>
    <li><a href="#post-agent-tools"><span class="m badge POST">POST</span> /agent-tools</a></li>
    <li><a href="#delete-agent-tools"><span class="m badge DELETE">DEL</span> /agent-tools/:id</a></li>
    <li><a href="#post-marketplace-chat"><span class="m badge POST">POST</span> /marketplace-chat</a></li>

    <div class="group-title" data-i18n="nav_g_schedules">Lịch đăng tự động</div>
    <li><a href="#get-schedules"><span class="m badge GET">GET</span> /schedules</a></li>
    <li><a href="#post-schedules"><span class="m badge POST">POST</span> /schedules</a></li>
    <li><a href="#patch-schedules"><span class="m badge PATCH">PATCH</span> /schedules/:id</a></li>
    <li><a href="#delete-schedules"><span class="m badge DELETE">DEL</span> /schedules/:id</a></li>

    <div class="group-title" data-i18n="nav_g_loyalty">Loyalty &amp; Content Planning</div>
    <li><a href="#loyalty"><span class="m badge GET">···</span> /loyalty/*</a></li>
    <li><a href="#content-planning"><span class="m badge GET">···</span> /content-planning/*</a></li>

    <div class="group-title" data-i18n="nav_g_other">Khác</div>
    <li><a href="#errors" data-i18n="nav_errors">Mã lỗi chung</a></li>
    <li><a href="#quickstart" data-i18n="nav_quickstart">Ví dụ: gửi tin nhắn cho khách</a></li>
  </ul>
</nav>

<main>
  <h1>Knowledge Worker API</h1>
  <p class="lede" data-i18n-html="main_lede">Tài liệu tham khảo cho toàn bộ API công khai (<code>/api/v1/*</code>) của Knowledge Worker — dùng khi hệ thống ngoài (POS, CRM, tổng đài...) muốn tích hợp chatbot, gọi thoại, loyalty và quản lý nội dung theo từng tenant. Mỗi endpoint chính có nút <strong>"Thử API"</strong> để gọi thật ngay trên trang, không cần Postman.</p>

  <section id="intro">
    <h2 data-i18n="intro_h2">Base URL &amp; Xác thực</h2>
    <div class="cols">
      <div>
        <table class="field-table">
          <tr><th>Base URL</th><td><code>https://apic.schoolsai.work</code></td></tr>
          <tr><th data-i18n="intro_th_format">Format</th><td>JSON (request &amp; response)</td></tr>
          <tr><th>Auth</th><td><code>Authorization: Bearer &lt;api_key&gt;</code></td></tr>
        </table>
      </div>
      <div class="callout">
        <h3 data-i18n="intro_callout_title">Lấy API key ở đâu?</h3>
        <span data-i18n-html="intro_callout_body">Mỗi tenant có 1 <code>api_key</code> riêng (sinh khi tạo bot qua <code>/api/onboarding/register</code> hoặc <code>POST /api/v1/bots</code>), xem lại trong trang cấu hình (config.html) của dashboard. Dán key vào ô "API key" ở đầu trang này để dùng các nút "Thử API" bên dưới.</span>
      </div>
    </div>
    <p data-i18n-html="intro_p1">Luôn truyền API key bằng header <code>Authorization: Bearer sk_xxx</code>. Không đặt secret trong URL hoặc query string.</p>
    <p data-i18n-html="intro_p2">Mọi endpoint dưới đây đều tự động giới hạn theo đúng <strong>tenant</strong> gắn với API key — không có cách nào đọc/ghi dữ liệu của tenant khác.</p>
  </section>

  <!-- ===================== BOT & CONFIG ===================== -->
  <section class="resource" id="bot-config">
    <h2 data-i18n="nav_g_botconfig">Bot &amp; cấu hình</h2>
    <p class="desc" data-i18n="sec_botconfig_desc">Tạo bot mới, đọc/ghi cấu hình, hoặc để một trợ lý AI tự cập nhật cấu hình qua hội thoại tự nhiên.</p>

    <div class="endpoint" id="post-bots">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/bots</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_post_bots_summary">Tạo thêm 1 bot/tenant mới từ một tài khoản đã có API key.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">tenant</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_post_bots_n1">3-40 ký tự: chữ thường/số/gạch ngang/gạch dưới</td></tr>
        <tr><td class="name">bot_name</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_post_bots_n2">2-80 ký tự</td></tr>
        <tr><td class="name">greeting</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_post_bots_n3">tối đa 500 ký tự</td></tr>
        <tr><td class="name">system_prompt</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_post_bots_n4">tối đa 10.000 ký tự</td></tr>
      </table>
      <pre><code>{ "success": true, "tenant": "abc-shop", "bot_name": "AB Shop", "api_key": "sk_...", "created_from": "your-tenant" }</code></pre>
      <p class="note" data-i18n-html="ep_post_bots_note">Lỗi 409 nếu <code>tenant</code> đã tồn tại.</p>
      <div class="tryit" data-method="POST" data-path="/api/v1/bots"
        data-body='{"tenant":"demo-shop","bot_name":"Demo Shop","greeting":"","system_prompt":""}'></div>
    </div>

    <div class="endpoint" id="get-config">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/config</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_get_config_summary">Đọc cấu hình hiện tại của bot (tên, màu, webhook, system_prompt, model, temperature, Telegram chat id, Cloudinary, brand_logo_url...).</p>
      <pre><code>{ "success": true, "config": { "bot_name": "...", "greeting": "...", "system_prompt": "...", "model": "...", "temperature": 0.3, "max_tokens": 1000, "streaming": true, "webhook": "...", "owner_telegram_chat_id": "...", "..." : "..." } }</code></pre>
      <div class="tryit" data-method="GET" data-path="/api/v1/config"></div>
    </div>

    <div class="endpoint" id="patch-config">
      <div class="sig"><span class="badge PATCH">PATCH</span><span class="path">/api/v1/config</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_patch_config_summary">Cập nhật một phần cấu hình — chỉ gửi field muốn đổi.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">bot_name, bot_avatar, color, webhook, greeting, system_prompt, response_language, model, owner_telegram_chat_id, cloudinary_*, brand_logo_url</td><td>string</td><td data-i18n="ep_patch_config_n1">trim tự động</td></tr>
        <tr><td class="name">temperature</td><td>number</td><td>0 – 2</td></tr>
        <tr><td class="name">max_tokens</td><td>integer</td><td>1 – 32768</td></tr>
        <tr><td class="name">streaming</td><td>boolean</td><td>&nbsp;</td></tr>
      </table>
      <pre><code>{ "success": true, "updated": ["greeting", "temperature"] }</code></pre>
      <div class="tryit" data-method="PATCH" data-path="/api/v1/config"
        data-body='{"greeting":"Xin chào! Tôi có thể giúp gì cho bạn?"}'></div>
    </div>

    <div class="endpoint" id="post-agent-chat">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/agent-chat</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_post_agent_chat_summary">Chat tự nhiên với trợ lý cấu hình — model tự gọi tool để lưu cấu hình, kết nối kênh (Facebook/Instagram/Zalo/WordPress/Sanity...), thêm agent tool, lên lịch đăng bài, tạo chat-link, v.v. thay vì phải gọi từng API bên dưới bằng tay.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th></tr>
        <tr><td class="name">messages</td><td>array&lt;{role: "user"|"assistant", content: string}&gt;</td><td class="req" data-i18n="ep_post_agent_chat_n1">có — tối đa 100 message, message cuối phải là "user"</td></tr>
      </table>
      <pre><code>{ "success": true, "reply": "Đã cập nhật lời chào." }</code></pre>
      <div class="tryit" data-method="POST" data-path="/api/v1/agent-chat"
        data-body='{"messages":[{"role":"user","content":"Cấu hình hiện tại của tôi là gì?"}]}'></div>
    </div>

    <div class="endpoint" id="get-agent-chat-tools">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/agent-chat/tools</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_get_agent_chat_tools_summary">Liệt kê toàn bộ tool mà <code>/agent-chat</code> có thể gọi (built-in + tool tùy chỉnh của tenant).</p>
      <div class="tryit" data-method="GET" data-path="/api/v1/agent-chat/tools"></div>
    </div>

    <div class="callout" id="connect-messenger-instagram">
      <h3 data-i18n="conn_meta_title">Kết nối Messenger / Instagram (chat riêng + tự động trả lời bình luận)</h3>
      <span data-i18n-html="conn_meta_intro">Làm theo đúng 4 bước dưới đây — dùng ngay ô "Thử API" bên dưới, không cần công cụ nào khác.</span>
      <ol class="conn-steps">
        <li data-i18n-html="conn_meta_step1">Gửi tin nhắn cho trợ lý cấu hình (ô "Thử API" ngay dưới đây) để kết nối Page/tài khoản Instagram của bạn — điền đúng <code>page_id</code> và <code>access_token</code> của bạn vào chỗ ví dụ trước khi gửi. Nếu trang này đã kết nối để đăng bài trước đó, chỉ cần tạo lại <code>access_token</code> có th\xEAm quyền <code>pages_messaging</code> v\xE0 <code>pages_manage_engagement</code> rồi kết nối lại — kh\xF4ng cần l\xE0m g\xEC kh\xE1c.</li>
        <li data-i18n="conn_meta_step2">Bot sẽ trả về 1 Verify Token riêng cho đúng trang của bạn — copy lại.</li>
        <li data-i18n-html="conn_meta_step3">V\xE0o Meta App Dashboard của bạn → Webhooks → đăng k\xFD: Callback URL cố định <code>https://apic.schoolsai.work/meta-webhook</code>, d\xE1n Verify Token vừa nhận, subscribe field <code>messages</code> (chat ri\xEAng) v\xE0 <code>feed</code> (Facebook)/<code>comments</code> (Instagram) nếu muốn tự động trả lời b\xECnh luận.</li>
        <li data-i18n-html="conn_meta_step4">Nếu App của bạn chưa qua App Review cho <code>pages_messaging</code>/<code>pages_manage_engagement</code>, chỉ t\xE0i khoản admin/tester của App mới nhận được tin nhắn/b\xECnh luận thật khi test — muốn nhận từ kh\xE1ch h\xE0ng thật cần ho\xE0n tất App Review tr\xEAn Meta.</li>
      </ol>
      <div class="tryit" data-method="POST" data-path="/api/v1/agent-chat"
        data-body='{"messages":[{"role":"user","content":"Kết nối trang Facebook của tôi, page_id là <ID Page của bạn>, access_token là <access token của bạn>"}]}'></div>
    </div>
  </section>

  <!-- ===================== CHAT ===================== -->
  <section class="resource" id="chat">
    <h2 data-i18n="nav_g_chat">Chat &amp; khách hàng</h2>
    <p class="desc" data-i18n="sec_chat_desc">Chatbot cho khách cuối, tạo link chat riêng cho từng khách (dùng trong SMS/Zalo/email), gửi ngữ cảnh khách hàng, và gửi/đọc tin nhắn phiên chat — đây là nhóm endpoint hệ thống ngoài (POS...) hay dùng nhất.</p>

    <div class="endpoint" id="post-chat">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/chat</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_chat_summary">Gửi 1 tin nhắn của khách tới chatbot AI và nhận câu trả lời (tương đương endpoint <code>/chat</code> nội bộ nhưng tự ép đúng tenant theo API key).</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">session</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td>&nbsp;</td></tr>
        <tr><td class="name">question</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td>≤ 10.000 ký tự</td></tr>
        <tr><td class="name">lesson_id</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n-html="ep_post_chat_lesson_id_note">có thì trả lời theo đúng phạm vi lesson đó (xem <a href="#lessons">Bài học (Lessons)</a>), bỏ trống = bot trợ lý chung</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/chat"
        data-body='{"session":"demo-session-1","question":"Xin chào","lesson_id":""}'></div>
    </div>

    <div class="endpoint" id="post-chat-link">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/chat-link</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_chat_link_summary">Sinh 1 link chat riêng, gắn sẵn tên khách + (tuỳ chọn) ngữ cảnh khách hàng — không cần tạo tenant hay ghi session trước, widget <code>chat.html</code> tự đọc từ URL. Dùng khi hệ thống ngoài (vd POS) muốn gửi link chat cho khách qua SMS/Zalo/email.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">customer_name</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_post_chat_link_n1">tên hiển thị trong chat</td></tr>
        <tr><td class="name">customer_context</td><td>object</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_post_chat_link_n2">ghi luôn ngữ cảnh khách (đơn hàng, mã KH...) cho session mới tạo</td></tr>
      </table>
      <pre><code>{ "success": true, "session": "a1b2c3d4-...", "chat_url": "https://chat.schoolsai.work/chat.html?bot=your-tenant&session=a1b2c3d4-...&u=Nguy%E1%BB%85n%20V%C4%83n%20A" }</code></pre>
      <div class="tryit" data-method="POST" data-path="/api/v1/chat-link"
        data-body='{"customer_name":"Nguyễn Văn A","customer_context":{"order_id":"DH-1024"}}'></div>
    </div>

    <div class="endpoint" id="put-customer-context">
      <div class="sig"><span class="badge PUT">PUT</span><span class="path">/api/v1/customer-context</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_put_customer_context_summary">Ghi/cập nhật ngữ cảnh khách hàng (đơn hàng, trạng thái, ghi chú...) cho 1 session đã tồn tại — để chatbot AI có sẵn dữ liệu thật khi trả lời khách, không cần khách tự khai lại.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th></tr>
        <tr><td class="name">session</td><td>string</td><td class="req" data-i18n="common_yes">có</td></tr>
        <tr><td class="name">context</td><td>object</td><td class="req" data-i18n="ep_put_customer_context_n1">có — object phẳng, không phải mảng</td></tr>
      </table>
      <pre><code>{ "success": true, "session": "a1b2c3d4-..." }</code></pre>
      <div class="tryit" data-method="PUT" data-path="/api/v1/customer-context"
        data-body='{"session":"demo-session-1","context":{"order_id":"DH-1024","status":"Đang xử lý"}}'></div>
    </div>

    <div class="endpoint" id="get-messages">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/messages</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_get_messages_summary">Lấy lịch sử tin nhắn của tenant (tối đa 100, mới nhất trước).</p>
      <table class="field-table">
        <tr><th data-i18n="fh_query">Query</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">session</td><td class="opt" data-i18n="ep_get_messages_n1">lọc theo 1 session cụ thể (không truyền = toàn bộ tenant)</td></tr>
      </table>
      <pre><code>{ "success": true, "messages": [
  { "id": "...", "session": "...", "username": "Khách", "text": "...", "is_bot": false, "needs_human": true, "escalation_resolved": false, "created": "..." }
] }</code></pre>
      <div class="tryit" data-method="GET" data-path="/api/v1/messages" data-query='["session"]'></div>
    </div>

    <div class="endpoint" id="post-messages">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/messages</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_messages_summary"><strong>Gửi tin nhắn chủ động</strong> tới 1 session đã tồn tại — dùng để hệ thống ngoài (POS, CRM...) chủ động báo tin cho khách qua đúng cuộc chat đang mở (vd "đơn hàng đã xong"). Tự động đánh dấu mọi tin nhắn <code>needs_human</code> đang chờ của session đó là <code>escalation_resolved</code>.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">session</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n-html="ep_post_messages_n1">≤ 200 ký tự — phải là session đã có ít nhất 1 tin nhắn (tạo qua <code>/chat-link</code> hoặc khách đã chat 1 lần)</td></tr>
        <tr><td class="name">text</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_post_messages_n2">≤ 10.000 ký tự</td></tr>
      </table>
      <pre><code>curl -X POST https://apic.schoolsai.work/api/v1/messages \
  -H "Authorization: Bearer sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"session":"a1b2c3d4-...","text":"Đơn hàng của bạn đã xong, mời bạn ghé lấy nhé!"}'</code></pre>
      <pre><code>// 200
{ "success": true, ... }
// 404 — session chưa từng có tin nhắn nào
{ "error": "Không tìm thấy phiên trò chuyện" }</code></pre>
      <p class="note" data-i18n-html="ep_post_messages_note">Nếu chưa chắc session còn tồn tại, gọi <code>GET /api/v1/messages?session=...</code> trước để kiểm tra, hoặc tạo session bằng <code>POST /api/v1/chat-link</code> ngay từ đầu (server tự lưu <code>customer_context</code> nếu có).</p>
      <div class="tryit" data-method="POST" data-path="/api/v1/messages"
        data-body='{"session":"demo-session-1","text":"Đơn hàng của bạn đã xong, mời bạn ghé lấy nhé!"}'></div>
    </div>
  </section>

  <!-- ===================== CALLS ===================== -->
  <section class="resource" id="calls">
    <h2 data-i18n="nav_g_calls">Gọi thoại (voice)</h2>
    <p class="desc" data-i18n-html="sec_calls_desc">Quản lý cuộc gọi thoại admin ↔ khách qua Cloudflare Realtime (SFU). Trạng thái ringing/active/ended được đồng bộ realtime cho cả 2 phía qua PocketBase, giống cơ chế của <code>messages</code>.</p>

    <div class="endpoint" id="get-calls">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/calls</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_get_calls_summary">Liệt kê cuộc gọi chưa kết thúc (<code>status != "ended"</code>) của tenant.</p>
      <table class="field-table"><tr><th data-i18n="fh_query">Query</th><th data-i18n="fh_note">Ghi chú</th></tr><tr><td class="name">session</td><td class="opt" data-i18n="ep_get_calls_n1">lọc theo session</td></tr></table>
      <div class="tryit" data-method="GET" data-path="/api/v1/calls" data-query='["session"]'></div>
    </div>
    <div class="endpoint" id="post-calls-start">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/calls/start</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_post_calls_start_summary">Admin bắt đầu 1 cuộc gọi tới khách trong 1 session.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_required">Bắt buộc</th></tr>
        <tr><td class="name">session</td><td class="req" data-i18n="common_yes">có</td></tr>
        <tr><td class="name">cf_session_id, track_name</td><td class="req" data-i18n="ep_post_calls_start_n1">có — id phiên WebRTC từ Cloudflare Realtime</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/calls/start"
        data-body='{"session":"demo-session-1","cf_session_id":"","track_name":""}'></div>
    </div>
    <div class="endpoint" id="post-calls-accept">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/calls/accept</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_calls_accept_summary">Admin trả lời cuộc gọi đang <code>ringing</code>.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_required">Bắt buộc</th></tr>
        <tr><td class="name">call_id</td><td class="req" data-i18n="common_yes">có</td></tr>
        <tr><td class="name">cf_session_id, track_name</td><td class="req" data-i18n="common_yes">có</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/calls/accept"
        data-body='{"call_id":"","cf_session_id":"","track_name":""}'></div>
    </div>
    <div class="endpoint" id="post-calls-end">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/calls/decline</span> &nbsp;·&nbsp; <span class="badge POST">POST</span><span class="path">/api/v1/calls/end</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_post_calls_end_summary">Từ chối (chưa nghe) hoặc kết thúc (đang gọi) 1 cuộc gọi.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">call_id</td><td class="req" data-i18n="common_yes">có</td><td>&nbsp;</td></tr>
        <tr><td class="name">reason</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_post_calls_end_n1">mặc định "declined" / "hangup"</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/calls/decline"
        data-body='{"call_id":"","reason":""}'></div>
      <div class="tryit" data-method="POST" data-path="/api/v1/calls/end"
        data-body='{"call_id":"","reason":""}'></div>
    </div>
  </section>

  <!-- ===================== CONTENT ===================== -->
  <section class="resource" id="content">
    <h2 data-i18n="nav_g_content">Nội dung &amp; đăng bài</h2>
    <p class="desc" data-i18n="sec_content_desc">Tạo/duyệt bài viết social &amp; blog, xem trạng thái pipeline đăng bài, và chạy thủ công các job nền (crawl RSS, publish, agent).</p>

    <div class="endpoint" id="get-posts">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/posts</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_get_posts_summary">Liệt kê tối đa 50 bài gần nhất, kèm targets (kênh đăng + trạng thái) và media.</p>
      <table class="field-table"><tr><th data-i18n="fh_query">Query</th><th data-i18n="fh_note">Ghi chú</th></tr><tr><td class="name">status</td><td class="opt" data-i18n="ep_get_posts_n1">lọc bài có ít nhất 1 target ở trạng thái này (pending/approved/scheduled/publishing/published/error)</td></tr></table>
      <div class="tryit" data-method="GET" data-path="/api/v1/posts" data-query='["status"]'></div>
    </div>
    <div class="endpoint" id="post-posts">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/posts</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_posts_summary">Tạo bài viết mới, tự tạo target cho từng kênh đã kết nối (mặc định facebook nếu không truyền <code>platforms</code>).</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th></tr>
        <tr><td class="name">title, content</td><td>string</td><td class="req" data-i18n="common_yes">có</td></tr>
        <tr><td class="name">image_prompt, image_url, video_url</td><td>string</td><td class="opt" data-i18n="common_no">không</td></tr>
        <tr><td class="name">platforms</td><td>string[]</td><td class="opt" data-i18n="ep_post_posts_n1">không — mặc định ["facebook"]</td></tr>
        <tr><td class="name">auto_approve</td><td>boolean</td><td class="opt" data-i18n="ep_post_posts_n2">true = tạo target ở trạng thái "approved" luôn, bỏ qua bước duyệt</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/posts"
        data-body='{"title":"Bài viết demo","content":"Nội dung demo...","platforms":["facebook"],"auto_approve":false}'></div>
    </div>
    <div class="endpoint" id="post-posts-approve">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/posts/:id/approve</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_post_posts_approve_summary">Duyệt toàn bộ target đang "pending" của 1 bài. Bị chặn (409) nếu bài thuộc content-plan mà dependency chưa sẵn sàng.</p>
      <div class="tryit" data-method="POST" data-path="/api/v1/posts/:id/approve"></div>
    </div>
    <div class="endpoint" id="post-content-cluster">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/content-cluster</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_post_content_cluster_summary">Lên kế hoạch + viết nền (async) 1 cụm nhiều bài blog SEO xoay quanh 1 chủ đề, có liên kết nội bộ giữa các bài.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">topic</td><td class="req" data-i18n="common_yes">có</td><td>&nbsp;</td></tr>
        <tr><td class="name">count</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_post_content_cluster_n1">mặc định 5, tối đa 8</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/content-cluster"
        data-body='{"topic":"Chủ đề demo","count":3}'></div>
    </div>
    <div class="endpoint" id="get-status">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/status</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_get_status_summary">Đếm số bài theo từng trạng thái pipeline (pending/approved/scheduled/publishing/published/error).</p>
      <div class="tryit" data-method="GET" data-path="/api/v1/status"></div>
    </div>
    <div class="endpoint" id="post-trigger">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/trigger/rss-crawl</span> · <span class="path">/trigger/publish</span> · <span class="path">/trigger/agent</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_post_trigger_summary">Chạy thủ công (không đợi cron) job crawl RSS + viết nháp, job publish bài đã duyệt, hoặc 1 lượt AI agent vận hành cho tenant hiện tại.</p>
      <div class="tryit" data-method="POST" data-path="/api/v1/trigger/rss-crawl"></div>
      <div class="tryit" data-method="POST" data-path="/api/v1/trigger/publish"></div>
      <div class="tryit" data-method="POST" data-path="/api/v1/trigger/agent"></div>
    </div>
  </section>

  <!-- ===================== KNOWLEDGE ===================== -->
  <section class="resource" id="knowledge">
    <h2 data-i18n="nav_g_knowledge">Knowledge base</h2>
    <p class="desc" data-i18n="sec_knowledge_desc">Tài liệu làm ngữ cảnh RAG cho chatbot (embed vào Vectorize).</p>
    <div class="endpoint" id="get-knowledge">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/knowledge</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_get_knowledge_summary">Liệt kê tối đa 100 tài liệu (id, title, char_count, created).</p>
      <div class="tryit" data-method="GET" data-path="/api/v1/knowledge"></div>
    </div>
    <div class="endpoint" id="post-knowledge">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/knowledge</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_knowledge_summary">Thêm 1 tài liệu mới, tự động embed cho tìm kiếm ngữ nghĩa (tương đương endpoint nội bộ <code>/embed</code>, ép đúng tenant).</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">text</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td>≤ 500.000 ký tự</td></tr>
        <tr><td class="name">title</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td>≤ 200 ký tự</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/knowledge"
        data-body='{"title":"Tài liệu demo","text":"Nội dung tài liệu training cho chatbot..."}'></div>
    </div>
    <div class="endpoint" id="delete-knowledge">
      <div class="sig"><span class="badge DELETE">DELETE</span><span class="path">/api/v1/knowledge/:id</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_delete_knowledge_summary">Xoá 1 tài liệu theo id.</p>
      <div class="tryit" data-method="DELETE" data-path="/api/v1/knowledge/:id"></div>
    </div>
    <div class="endpoint" id="post-knowledge-sync">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/knowledge/sync</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_post_knowledge_sync_summary">Đồng bộ lại toàn bộ nguồn tài liệu đã cấu hình (vd Sanity/WordPress) cho tenant.</p>
      <div class="tryit" data-method="POST" data-path="/api/v1/knowledge/sync"></div>
    </div>
  </section>

  <!-- ===================== LESSONS ===================== -->
  <section class="resource" id="lessons">
    <h2 data-i18n="nav_g_lessons">Bài học (Lessons)</h2>
    <p class="desc" data-i18n-html="sec_lessons_desc">Cho hệ thống LMS/khoá học (vd skillgo-app) tạo <strong>1 bot AI riêng cho từng bài học</strong> + <strong>1 bot trợ lý chung</strong> cho toàn bộ khoá, mà không cần tạo hạ tầng riêng cho từng bài học.</p>

    <div class="callout">
      <h3 data-i18n="lessons_arch_title">Kiến trúc: vì sao chỉ 2 endpoint là đủ?</h3>
      <span data-i18n-html="lessons_arch_body">Không tạo workspace/RAG riêng cho từng lesson (không chịu nổi khi tạo hàng nghìn lesson/ngày). Thay vào đó: <strong>bot theo lesson</strong> lookup thẳng nội dung theo <code>lesson_id</code> và nhét vào đúng câu hỏi đó (không qua tìm kiếm ngữ nghĩa, luôn chính xác 100% trong phạm vi bài học) — kích hoạt bằng cách gửi kèm <code>lesson_id</code> khi gọi <a href="#post-chat">POST /api/v1/chat</a>. <strong>Bot trợ lý chung</strong> vẫn dùng đúng 1 workspace RAG có sẵn của tenant (như nhóm <a href="#knowledge">Knowledge base</a> ở trên) — mỗi lesson mới chỉ là thêm 1 tài liệu vào workspace đó, không tạo gì mới; gọi <code>/api/v1/chat</code> không kèm <code>lesson_id</code> để dùng bot này.</span>
    </div>

    <div class="endpoint" id="post-lessons">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/lessons</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_lessons_summary">Tạo mới hoặc cập nhật 1 lesson (upsert theo <code>lesson_id</code>). Tự động: (1) lưu nội dung để bot theo lesson lookup thẳng, (2) nhúng vào workspace RAG của tenant cho bot trợ lý chung, (3) nếu lesson đã tồn tại thì tự xoá bản nhúng cũ trước khi nhúng lại — gọi lại API này mỗi khi sửa nội dung lesson là đủ, không cần tự quản lý embedding.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">lesson_id</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_post_lessons_n1">id lesson bên hệ thống của bạn — ≤ 100 ký tự, dùng lại đúng id này khi chat/xoá</td></tr>
        <tr><td class="name">title</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td>&nbsp;</td></tr>
        <tr><td class="name">content</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_post_lessons_n2">toàn bộ nội dung bài học (text) — ≤ 500.000 ký tự</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/lessons"
        data-body='{"lesson_id":"lesson-042","title":"Bài 4: Vòng lặp for","content":"Nội dung đầy đủ của bài học..."}'></div>
    </div>

    <div class="endpoint" id="delete-lessons">
      <div class="sig"><span class="badge DELETE">DELETE</span><span class="path">/api/v1/lessons/:lesson_id</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_delete_lessons_summary">Xoá 1 lesson — dọn luôn bản nhúng RAG tương ứng khỏi workspace của tenant, để bot trợ lý chung không còn nhắc tới nội dung đã xoá.</p>
      <div class="tryit" data-method="DELETE" data-path="/api/v1/lessons/:lesson_id"></div>
    </div>

    <div class="callout">
      <h3 data-i18n="lessons_integrate_title">Checklist tích hợp cho dev hệ thống ngoài</h3>
      <span data-i18n-html="lessons_integrate_body">
        1) Ở chỗ code tạo/sửa lesson đã có sẵn trong hệ thống của bạn, gọi thêm <code>POST /api/v1/lessons</code> ngay sau khi lưu thành công — không cần màn hình quản lý riêng.<br>
        2) Ở chỗ xoá lesson, gọi thêm <code>DELETE /api/v1/lessons/:lesson_id</code>.<br>
        3) Ở màn chat trong 1 bài học, gửi kèm <code>lesson_id</code> khi gọi <a href="#post-chat">POST /api/v1/chat</a>; ở màn trợ lý chung thì bỏ trống field này.<br>
        4) Nếu lesson được tạo hàng loạt (vd hàng nghìn/ngày), gọi <code>POST /api/v1/lessons</code> qua hàng đợi/job nền — đừng gọi đồng bộ ngay trong request tạo lesson của người dùng cuối, tránh làm chậm thao tác của họ.
      </span>
    </div>
  </section>

  <!-- ===================== MARKETPLACE / EXTERNAL API TOOLS ===================== -->
  <section class="resource" id="marketplace">
    <h2 data-i18n="nav_g_marketplace">Marketplace / API ngoài</h2>
    <p class="desc" data-i18n-html="sec_marketplace_desc">Cho khách hàng cuối <strong>tra cứu/tư vấn bằng chat</strong> khi bạn đã có sẵn 1 platform + API riêng (vd sàn bất động sản, việc làm, hoặc bất kỳ ngành nào khác) — không cần Knowledge Worker tự lưu dữ liệu, chỉ cần đăng ký API search có sẵn của bạn làm 1 "tool" cho AI gọi.</p>

    <div class="callout">
      <h3 data-i18n="mp_arch_title">Cơ chế: đăng ký tool 1 lần, dùng lại cho mọi ngành</h3>
      <span data-i18n-html="mp_arch_body">Đăng ký API search thật của bạn qua <a href="#post-agent-tools">POST /api/v1/agent-tools</a> (URL, tham số, cách đọc kết quả). Khách hàng cuối chat qua <a href="#post-marketplace-chat">POST /api/v1/marketplace-chat</a> — AI tự gọi đúng tool đã đăng ký để trả lời, không bịa thông tin ngoài kết quả tool trả về. Đổi ngành/thêm ngành mới chỉ là đăng ký thêm tool khác, không phải sửa code.</span>
    </div>

    <div class="callout">
      <h3 data-i18n="mp_v1_title">V1: chỉ hỗ trợ tra cứu (GET), chưa hỗ trợ tạo/sửa dữ liệu qua chat</h3>
      <span data-i18n-html="mp_v1_body">Vì endpoint <code>/marketplace-chat</code> mở cho khách hàng ẩn danh, tool có <code>method</code> khác <code>GET</code> bị <strong>chặn ở tầng code</strong> (không chỉ ở system prompt) khi gọi qua kênh này — tránh bị lợi dụng tạo/ghi dữ liệu hàng loạt qua chat. Đăng ký tool GET (search/đọc chi tiết) vẫn dùng bình thường.</span>
    </div>

    <div class="endpoint" id="get-agent-tools">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/agent-tools</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_get_agent_tools_summary">Liệt kê các tool (API ngoài) tenant đã đăng ký.</p>
      <div class="tryit" data-method="GET" data-path="/api/v1/agent-tools"></div>
    </div>

    <div class="endpoint" id="post-agent-tools">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/agent-tools</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_agent_tools_summary">Đăng ký 1 API ngoài làm tool cho AI gọi. Dùng <code>{tên_tham_số}</code> trong <code>url_template</code> để chèn giá trị model chọn.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">name</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_agent_tools_n1">chỉ chữ/số/gạch dưới</td></tr>
        <tr><td class="name">description</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_agent_tools_n2">để model biết khi nào nên gọi tool này</td></tr>
        <tr><td class="name">method</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_agent_tools_n3">mặc định GET — kênh marketplace-chat chỉ chạy được GET</td></tr>
        <tr><td class="name">url_template</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_agent_tools_n4">vd https://api.client.com/search?q={keyword}&price_max={price_max}</td></tr>
        <tr><td class="name">parameters_schema</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_agent_tools_n5">JSON Schema dạng chuỗi, mô tả tham số model được điền</td></tr>
        <tr><td class="name">headers_template</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_agent_tools_n6">JSON dạng chuỗi, vd API key tĩnh của bạn</td></tr>
        <tr><td class="name">result_path</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_agent_tools_n7">đường dẫn lấy phần cần thiết từ response JSON, vd data.results</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/agent-tools"
        data-body='{"name":"search_listings","description":"Tìm tin đăng theo từ khoá, giá, khu vực","method":"GET","url_template":"https://api.client.com/search?q={keyword}&price_max={price_max}","parameters_schema":"{\"type\":\"object\",\"properties\":{\"keyword\":{\"type\":\"string\"},\"price_max\":{\"type\":\"number\"}},\"required\":[]}","result_path":"data.results"}'></div>
    </div>

    <div class="endpoint" id="delete-agent-tools">
      <div class="sig"><span class="badge DELETE">DELETE</span><span class="path">/api/v1/agent-tools/:id</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_delete_agent_tools_summary">Gỡ 1 tool đã đăng ký.</p>
      <div class="tryit" data-method="DELETE" data-path="/api/v1/agent-tools/:id"></div>
    </div>

    <div class="endpoint" id="post-marketplace-chat">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/marketplace-chat</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n-html="ep_post_marketplace_chat_summary">Chat cho khách hàng cuối — AI tự gọi đúng tool GET đã đăng ký (xem <a href="#post-agent-tools">POST /agent-tools</a>) để trả lời, áp dụng cùng giới hạn lượt chat/tháng như <a href="#post-chat">POST /chat</a>.</p>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">session</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td>&nbsp;</td></tr>
        <tr><td class="name">messages</td><td>array</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_post_agent_chat_n1">có — tối đa 100 message, message cuối phải là "user"</td></tr>
        <tr><td class="name">item_id</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n-html="ep_post_marketplace_chat_item_id_note">khách đang xem đúng 1 mục cụ thể (vd trang chi tiết 1 tin BĐS) — server tự gọi thẳng tool tên <code>get_item_detail</code> (nếu đã đăng ký) với tham số <code>id</code>, không chờ model quyết định, đảm bảo tư vấn đúng mục đang xem</td></tr>
        <tr><td class="name">item_context</td><td>string</td><td class="opt" data-i18n="common_no">không</td><td data-i18n-html="ep_post_marketplace_chat_item_context_note">≤ 20.000 ký tự — nếu hệ thống gọi API này (backend của bạn) đã có sẵn nội dung mục đang xem, gửi thẳng text đã làm sạch qua đây thay vì dùng <code>item_id</code>; ưu tiên hơn <code>item_id</code> nếu cả 2 cùng được gửi, tránh phải gọi ngược lại API của bạn</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/marketplace-chat"
        data-body='{"session":"demo-session-1","messages":[{"role":"user","content":"Tìm giúp tôi nhà dưới 5 tỷ ở quận 7"}]}'></div>
    </div>

    <div class="callout">
      <h3 data-i18n="mp_detail_title">Tư vấn theo đúng 1 mục đang xem (vd trang chi tiết 1 tin)</h3>
      <span data-i18n-html="mp_detail_body">Khi khách đang ở trang chi tiết 1 tin/mục cụ thể — giống hệt trường hợp học viên đang mở 1 lesson (xem <a href="#lessons">Bài học (Lessons)</a>) — không cần "tìm kiếm" gì cả vì đã biết chính xác id. Đăng ký thêm 1 tool GET tên đúng <code>get_item_detail</code> (nhận tham số <code>id</code>) trỏ vào API xem chi tiết của bạn, rồi gửi kèm <code>item_id</code> khi gọi <code>/marketplace-chat</code> — server tự lấy đúng dữ liệu mục đó và tư vấn trong phạm vi đó, không bịa.</span>
    </div>
  </section>

  <!-- ===================== SCHEDULES ===================== -->
  <section class="resource" id="schedules">
    <h2 data-i18n="nav_g_schedules">Lịch đăng tự động</h2>
    <p class="desc" data-i18n="sec_schedules_desc">Đặt luật lên lịch đăng bài tự động theo ngày trong tuần + khung giờ, cho nội dung blog hoặc social.</p>
    <div class="endpoint" id="get-schedules">
      <div class="sig"><span class="badge GET">GET</span><span class="path">/api/v1/schedules</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <div class="tryit" data-method="GET" data-path="/api/v1/schedules"></div>
    </div>
    <div class="endpoint" id="post-schedules">
      <div class="sig"><span class="badge POST">POST</span><span class="path">/api/v1/schedules</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <table class="field-table">
        <tr><th data-i18n="fh_field">Trường</th><th data-i18n="fh_type">Kiểu</th><th data-i18n="fh_required">Bắt buộc</th><th data-i18n="fh_note">Ghi chú</th></tr>
        <tr><td class="name">content_type</td><td>string</td><td class="req" data-i18n="common_yes">có</td><td>"blog" · "social"</td></tr>
        <tr><td class="name">times</td><td>string[]</td><td class="req" data-i18n="common_yes">có</td><td data-i18n="ep_post_schedules_n1">mảng "HH:MM", 1 giờ = 1 bài/ngày áp dụng</td></tr>
        <tr><td class="name">days</td><td>string[]</td><td class="opt" data-i18n="common_no">không</td><td data-i18n="ep_post_schedules_n2">mon..sun; rỗng/bỏ qua = áp dụng hàng ngày</td></tr>
        <tr><td class="name">is_active</td><td>boolean</td><td class="opt" data-i18n="common_no">không</td><td>&nbsp;</td></tr>
      </table>
      <div class="tryit" data-method="POST" data-path="/api/v1/schedules"
        data-body='{"content_type":"social","times":["08:00","18:00"],"days":[],"is_active":true}'></div>
    </div>
    <div class="endpoint" id="patch-schedules">
      <div class="sig"><span class="badge PATCH">PATCH</span><span class="path">/api/v1/schedules/:id</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <p class="summary" data-i18n="ep_patch_schedules_summary">Cập nhật 1 phần (cùng field như tạo mới, tất cả optional).</p>
      <div class="tryit" data-method="PATCH" data-path="/api/v1/schedules/:id"
        data-body='{"is_active":false}'></div>
    </div>
    <div class="endpoint" id="delete-schedules">
      <div class="sig"><span class="badge DELETE">DELETE</span><span class="path">/api/v1/schedules/:id</span><span class="badge auth" data-i18n="badge_auth">cần API key</span></div>
      <div class="tryit" data-method="DELETE" data-path="/api/v1/schedules/:id"></div>
    </div>
  </section>

  <!-- ===================== LOYALTY ===================== -->
  <section class="resource" id="loyalty">
    <h2 data-i18n="sec_loyalty_h2">Loyalty <span class="mono" style="font-weight:400;color:var(--fg-muted);font-size:0.8em;">/api/v1/loyalty/*</span></h2>
    <p class="desc" data-i18n="sec_loyalty_desc">Chương trình khách hàng thân thiết, tích/đổi điểm, campaign quay thưởng (reward-world).</p>
    <table class="field-table">
      <tr><th data-i18n="fh_method">Method</th><th data-i18n="fh_path">Path</th><th data-i18n="fh_note">Ghi chú</th></tr>
      <tr><td><span class="badge GET">GET</span></td><td class="name">/loyalty/program</td><td data-i18n="loy_n1">đọc cấu hình chương trình loyalty của tenant</td></tr>
      <tr><td><span class="badge PUT">PUT</span></td><td class="name">/loyalty/program</td><td data-i18n="loy_n2">tạo/cập nhật cấu hình chương trình</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/loyalty/sales</td><td data-i18n="loy_n3">ghi nhận 1 giao dịch bán hàng để tích điểm</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/loyalty/redemptions</td><td data-i18n="loy_n4">đổi điểm lấy ưu đãi</td></tr>
      <tr><td><span class="badge GET">GET</span></td><td class="name">/loyalty/account</td><td data-i18n="loy_n5">xem điểm/hạng của 1 khách</td></tr>
      <tr><td><span class="badge GET">GET</span></td><td class="name">/loyalty/reward-world/campaigns</td><td data-i18n="loy_n6">danh sách campaign quay thưởng</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/loyalty/reward-world/campaigns/:id/join</td><td data-i18n="loy_n7">khách tham gia campaign</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/loyalty/reward-world/spins</td><td data-i18n="loy_n8">thực hiện 1 lượt quay</td></tr>
      <tr><td><span class="badge GET">GET</span></td><td class="name">/loyalty/reward-world/rewards</td><td data-i18n="loy_n9">danh sách phần thưởng đã trúng</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/loyalty/reward-world/rewards/:id/claim</td><td data-i18n="loy_n10">nhận thưởng (kích hoạt fulfillment provider)</td></tr>
    </table>
    <p class="note" data-i18n-html="sec_loyalty_note">Chưa có nút "Thử API" cho nhóm này trên trang — payload phức tạp/khác nhau theo campaign. Gọi trực tiếp bằng curl/Postman theo path ở trên (vẫn dùng cùng <code>Authorization: Bearer &lt;api_key&gt;</code>).</p>
  </section>

  <!-- ===================== CONTENT PLANNING ===================== -->
  <section class="resource" id="content-planning">
    <h2>Content Planning <span class="mono" style="font-weight:400;color:var(--fg-muted);font-size:0.8em;">/api/v1/content-planning/*</span></h2>
    <p class="desc" data-i18n-html="sec_cp_desc">Lập kế hoạch nội dung dài hạn theo chủ đề, phân tích xu hướng, sinh bài + dịch, luồng duyệt/từ chối riêng cho content plan (khác với duyệt bài đơn lẻ ở <code>/posts/:id/approve</code>).</p>
    <table class="field-table">
      <tr><th data-i18n="fh_method">Method</th><th data-i18n="fh_path">Path</th></tr>
      <tr><td><span class="badge GET">GET</span></td><td class="name">/content-planning/plans</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/plans</td></tr>
      <tr><td><span class="badge PATCH">PATCH</span></td><td class="name">/content-planning/plans/:id</td></tr>
      <tr><td><span class="badge GET">GET</span></td><td class="name">/content-planning/review</td></tr>
      <tr><td><span class="badge GET">GET</span></td><td class="name">/content-planning/analytics/insights</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/analytics/import</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/trends/import</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/trends/recommend</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/plans/:id/review</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/plans/:id/approve-to-plan</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/plans/:id/topics/:topicId/schedule</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/items/:id/generate</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/items/:id/translate</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/items/:id/approve</td></tr>
      <tr><td><span class="badge POST">POST</span></td><td class="name">/content-planning/items/:id/reject</td></tr>
    </table>
    <p class="note" data-i18n-html="sec_cp_note">Nhóm này chủ yếu phục vụ dashboard nội bộ (composer.html) — hệ thống ngoài thường chỉ cần nhóm "Chat &amp; khách hàng" và "Loyalty" ở trên. Chưa có nút "Thử API" cho nhóm này.</p>
  </section>

  <section id="errors" class="resource">
    <h2 data-i18n="nav_errors">Mã lỗi chung</h2>
    <table class="field-table">
      <tr><th>Status</th><th data-i18n="err_th_meaning">Ý nghĩa</th></tr>
      <tr><td>400</td><td data-i18n-html="err_400">Thiếu field bắt buộc hoặc dữ liệu không hợp lệ — chi tiết trong <code>error</code></td></tr>
      <tr><td>401</td><td data-i18n-html="err_401">Thiếu/sai <code>Authorization: Bearer &lt;api_key&gt;</code></td></tr>
      <tr><td>403</td><td data-i18n="err_403">Record tồn tại nhưng thuộc tenant khác</td></tr>
      <tr><td>404</td><td data-i18n="err_404">Không tìm thấy resource (post/session/call/schedule id)</td></tr>
      <tr><td>409</td><td data-i18n="err_409">Xung đột — vd tenant slug đã dùng, hoặc dependency content-plan chưa sẵn sàng</td></tr>
      <tr><td>502</td><td data-i18n="err_502">Lỗi khi gọi tới PocketBase/dịch vụ backend nội bộ</td></tr>
    </table>
    <p data-i18n-html="err_footer_p">Mọi lỗi trả JSON dạng <code>{ "error": "..." }</code>.</p>
  </section>

  <section id="quickstart" class="resource">
    <h2 data-i18n="qs_h2">Ví dụ: chủ động báo tin cho khách khi đơn hàng xong</h2>
    <p class="desc" data-i18n-html="qs_desc">Flow điển hình cho hệ thống POS: tạo link chat gắn tên khách khi có đơn mới, lưu lại <code>session</code>; khi đơn chuyển trạng thái "Đã xong", gọi <code>/messages</code> để gửi thông báo vào đúng cuộc chat đó. Có thể thử trực tiếp bằng 2 nút "Thử API" ở mục <a href="#post-chat-link">/chat-link</a> và <a href="#post-messages">/messages</a> phía trên (nhớ copy đúng <code>session</code> trả về từ bước 1 sang bước 2).</p>
    <pre><code># 1. Khi tạo đơn — sinh link chat riêng cho khách, kèm ngữ cảnh đơn hàng
curl -X POST https://apic.schoolsai.work/api/v1/chat-link \
  -H "Authorization: Bearer sk_xxx" -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Nguyễn Văn A",
    "customer_context": { "order_id": "DH-1024", "status": "Đang xử lý" }
  }'
# -> { "session": "a1b2c3d4-...", "chat_url": "https://chat.schoolsai.work/chat.html?..." }
# Lưu lại session + gửi chat_url cho khách qua SMS/Zalo/email.

# 2. Khi đơn chuyển "Đã xong" — gửi tin nhắn chủ động vào đúng session đã lưu
curl -X POST https://apic.schoolsai.work/api/v1/messages \
  -H "Authorization: Bearer sk_xxx" -H "Content-Type: application/json" \
  -d '{
    "session": "a1b2c3d4-...",
    "text": "Đơn hàng DH-1024 của bạn đã xong, mời bạn ghé lấy nhé!"
  }'</code></pre>
  </section>
</main>
</div>
<footer data-i18n-html="footer_text">Knowledge Worker · apic.schoolsai.work — tài liệu này được sinh trực tiếp từ route thật trong <code>src/index.js</code>, <code>src/api/loyalty.js</code>, <code>src/api/contentPlanning.js</code>. Lệch với hành vi thật, sửa code trước rồi cập nhật lại trang này.</footer>

<script>
var I18N_DICT = {
  vi: {
    kb_label: "API key", kb_hint: 'Chỉ lưu trong trình duyệt của bạn (localStorage) — dùng cho mọi nút "Gửi request" trên trang này.', kb_toggle_title: "Hiện/ẩn key",
    nav_intro: "Giới thiệu & Auth", nav_g_botconfig: "Bot & cấu hình", nav_g_chat: "Chat & khách hàng", nav_g_calls: "Gọi thoại (voice)", nav_g_content: "Nội dung & đăng bài", nav_g_knowledge: "Knowledge base", nav_g_lessons: "Bài học (Lessons)", nav_g_marketplace: "Marketplace / API ngoài", nav_g_schedules: "Lịch đăng tự động", nav_g_loyalty: "Loyalty & Content Planning", nav_g_other: "Khác", nav_errors: "Mã lỗi chung", nav_quickstart: "Ví dụ: gửi tin nhắn cho khách",
    main_lede: 'Tài liệu tham khảo cho toàn bộ API công khai (<code>/api/v1/*</code>) của Knowledge Worker — dùng khi hệ thống ngoài (POS, CRM, tổng đài...) muốn tích hợp chatbot, gọi thoại, loyalty và quản lý nội dung theo từng tenant. Mỗi endpoint chính có nút <strong>"Thử API"</strong> để gọi thật ngay trên trang, không cần Postman.',
    intro_h2: "Base URL & Xác thực", intro_th_format: "Format", intro_callout_title: "Lấy API key ở đâu?",
    intro_callout_body: 'Mỗi tenant có 1 <code>api_key</code> riêng (sinh khi tạo bot qua <code>/api/onboarding/register</code> hoặc <code>POST /api/v1/bots</code>), xem lại trong trang cấu hình (config.html) của dashboard. Dán key vào ô "API key" ở đầu trang này để dùng các nút "Thử API" bên dưới.',
    intro_p1: 'Luôn truyền API key bằng header <code>Authorization: Bearer sk_xxx</code>. Không đặt secret trong URL hoặc query string.',
    intro_p2: 'Mọi endpoint dưới đây đều tự động giới hạn theo đúng <strong>tenant</strong> gắn với API key — không có cách nào đọc/ghi dữ liệu của tenant khác.',
    fh_field: "Trường", fh_type: "Kiểu", fh_required: "Bắt buộc", fh_note: "Ghi chú", fh_query: "Query", fh_method: "Method", fh_path: "Path",
    common_yes: "có", common_no: "không", badge_auth: "cần API key",
    sec_botconfig_desc: "Tạo bot mới, đọc/ghi cấu hình, hoặc để một trợ lý AI tự cập nhật cấu hình qua hội thoại tự nhiên.",
    ep_post_bots_summary: "Tạo thêm 1 bot/tenant mới từ một tài khoản đã có API key.",
    ep_post_bots_n1: "3-40 ký tự: chữ thường/số/gạch ngang/gạch dưới", ep_post_bots_n2: "2-80 ký tự", ep_post_bots_n3: "tối đa 500 ký tự", ep_post_bots_n4: "tối đa 10.000 ký tự",
    ep_post_bots_note: 'Lỗi 409 nếu <code>tenant</code> đã tồn tại.',
    ep_get_config_summary: "Đọc cấu hình hiện tại của bot (tên, màu, webhook, system_prompt, model, temperature, Telegram chat id, Cloudinary, brand_logo_url...).",
    ep_patch_config_summary: "Cập nhật một phần cấu hình — chỉ gửi field muốn đổi.", ep_patch_config_n1: "trim tự động",
    ep_post_agent_chat_summary: "Chat tự nhiên với trợ lý cấu hình — model tự gọi tool để lưu cấu hình, kết nối kênh (Facebook/Instagram/Zalo/WordPress/Sanity...), thêm agent tool, lên lịch đăng bài, tạo chat-link, v.v. thay vì phải gọi từng API bên dưới bằng tay.",
    ep_post_agent_chat_n1: 'có — tối đa 100 message, message cuối phải là "user"',
    ep_get_agent_chat_tools_summary: 'Liệt kê toàn bộ tool mà <code>/agent-chat</code> có thể gọi (built-in + tool tùy chỉnh của tenant).',
    conn_meta_nav: "↳ Kết nối Messenger/Instagram",
    conn_meta_title: "Kết nối Messenger / Instagram (chat riêng + tự động trả lời bình luận)",
    conn_meta_intro: 'Làm theo đúng 4 bước dưới đây — dùng ngay ô "Thử API" bên dưới, không cần công cụ nào khác.',
    conn_meta_step1: 'Gửi tin nhắn cho trợ lý cấu hình (ô "Thử API" ngay dưới đây) để kết nối Page/tài khoản Instagram của bạn — điền đúng <code>page_id</code> và <code>access_token</code> của bạn vào chỗ ví dụ trước khi gửi. Nếu trang này đã kết nối để đăng bài trước đó, chỉ cần tạo lại <code>access_token</code> có thêm quyền <code>pages_messaging</code> và <code>pages_manage_engagement</code> rồi kết nối lại — không cần làm gì khác.',
    conn_meta_step2: "Bot sẽ trả về 1 Verify Token riêng cho đúng trang của bạn — copy lại.",
    conn_meta_step3: 'Vào Meta App Dashboard của bạn → Webhooks → đăng ký: Callback URL cố định <code>https://apic.schoolsai.work/meta-webhook</code>, dán Verify Token vừa nhận, subscribe field <code>messages</code> (chat riêng) và <code>feed</code> (Facebook)/<code>comments</code> (Instagram) nếu muốn tự động trả lời bình luận.',
    conn_meta_step4: 'Nếu App của bạn chưa qua App Review cho <code>pages_messaging</code>/<code>pages_manage_engagement</code>, chỉ tài khoản admin/tester của App mới nhận được tin nhắn/bình luận thật khi test — muốn nhận từ khách hàng thật cần hoàn tất App Review trên Meta.',
    sec_chat_desc: "Chatbot cho khách cuối, tạo link chat riêng cho từng khách (dùng trong SMS/Zalo/email), gửi ngữ cảnh khách hàng, và gửi/đọc tin nhắn phiên chat — đây là nhóm endpoint hệ thống ngoài (POS...) hay dùng nhất.",
    ep_post_chat_summary: 'Gửi 1 tin nhắn của khách tới chatbot AI và nhận câu trả lời (tương đương endpoint <code>/chat</code> nội bộ nhưng tự ép đúng tenant theo API key).',
    ep_post_chat_link_summary: 'Sinh 1 link chat riêng, gắn sẵn tên khách + (tuỳ chọn) ngữ cảnh khách hàng — không cần tạo tenant hay ghi session trước, widget <code>chat.html</code> tự đọc từ URL. Dùng khi hệ thống ngoài (vd POS) muốn gửi link chat cho khách qua SMS/Zalo/email.',
    ep_post_chat_link_n1: "tên hiển thị trong chat", ep_post_chat_link_n2: "ghi luôn ngữ cảnh khách (đơn hàng, mã KH...) cho session mới tạo",
    ep_put_customer_context_summary: "Ghi/cập nhật ngữ cảnh khách hàng (đơn hàng, trạng thái, ghi chú...) cho 1 session đã tồn tại — để chatbot AI có sẵn dữ liệu thật khi trả lời khách, không cần khách tự khai lại.",
    ep_put_customer_context_n1: "có — object phẳng, không phải mảng",
    ep_get_messages_summary: "Lấy lịch sử tin nhắn của tenant (tối đa 100, mới nhất trước).", ep_get_messages_n1: "lọc theo 1 session cụ thể (không truyền = toàn bộ tenant)",
    ep_post_messages_summary: '<strong>Gửi tin nhắn chủ động</strong> tới 1 session đã tồn tại — dùng để hệ thống ngoài (POS, CRM...) chủ động báo tin cho khách qua đúng cuộc chat đang mở (vd "đơn hàng đã xong"). Tự động đánh dấu mọi tin nhắn <code>needs_human</code> đang chờ của session đó là <code>escalation_resolved</code>.',
    ep_post_messages_n1: '≤ 200 ký tự — phải là session đã có ít nhất 1 tin nhắn (tạo qua <code>/chat-link</code> hoặc khách đã chat 1 lần)', ep_post_messages_n2: "≤ 10.000 ký tự",
    ep_post_messages_note: 'Nếu chưa chắc session còn tồn tại, gọi <code>GET /api/v1/messages?session=...</code> trước để kiểm tra, hoặc tạo session bằng <code>POST /api/v1/chat-link</code> ngay từ đầu (server tự lưu <code>customer_context</code> nếu có).',
    sec_calls_desc: 'Quản lý cuộc gọi thoại admin ↔ khách qua Cloudflare Realtime (SFU). Trạng thái ringing/active/ended được đồng bộ realtime cho cả 2 phía qua PocketBase, giống cơ chế của <code>messages</code>.',
    ep_get_calls_summary: 'Liệt kê cuộc gọi chưa kết thúc (<code>status != "ended"</code>) của tenant.', ep_get_calls_n1: "lọc theo session",
    ep_post_calls_start_summary: "Admin bắt đầu 1 cuộc gọi tới khách trong 1 session.", ep_post_calls_start_n1: "có — id phiên WebRTC từ Cloudflare Realtime",
    ep_post_calls_accept_summary: 'Admin trả lời cuộc gọi đang <code>ringing</code>.',
    ep_post_calls_end_summary: "Từ chối (chưa nghe) hoặc kết thúc (đang gọi) 1 cuộc gọi.", ep_post_calls_end_n1: 'mặc định "declined" / "hangup"',
    sec_content_desc: "Tạo/duyệt bài viết social & blog, xem trạng thái pipeline đăng bài, và chạy thủ công các job nền (crawl RSS, publish, agent).",
    ep_get_posts_summary: "Liệt kê tối đa 50 bài gần nhất, kèm targets (kênh đăng + trạng thái) và media.", ep_get_posts_n1: "lọc bài có ít nhất 1 target ở trạng thái này (pending/approved/scheduled/publishing/published/error)",
    ep_post_posts_summary: 'Tạo bài viết mới, tự tạo target cho từng kênh đã kết nối (mặc định facebook nếu không truyền <code>platforms</code>).',
    ep_post_posts_n1: 'không — mặc định ["facebook"]', ep_post_posts_n2: 'true = tạo target ở trạng thái "approved" luôn, bỏ qua bước duyệt',
    ep_post_posts_approve_summary: 'Duyệt toàn bộ target đang "pending" của 1 bài. Bị chặn (409) nếu bài thuộc content-plan mà dependency chưa sẵn sàng.',
    ep_post_content_cluster_summary: "Lên kế hoạch + viết nền (async) 1 cụm nhiều bài blog SEO xoay quanh 1 chủ đề, có liên kết nội bộ giữa các bài.", ep_post_content_cluster_n1: "mặc định 5, tối đa 8",
    ep_get_status_summary: "Đếm số bài theo từng trạng thái pipeline (pending/approved/scheduled/publishing/published/error).",
    ep_post_trigger_summary: "Chạy thủ công (không đợi cron) job crawl RSS + viết nháp, job publish bài đã duyệt, hoặc 1 lượt AI agent vận hành cho tenant hiện tại.",
    sec_knowledge_desc: "Tài liệu làm ngữ cảnh RAG cho chatbot (embed vào Vectorize).",
    ep_get_knowledge_summary: "Liệt kê tối đa 100 tài liệu (id, title, char_count, created).",
    ep_post_knowledge_summary: 'Thêm 1 tài liệu mới, tự động embed cho tìm kiếm ngữ nghĩa (tương đương endpoint nội bộ <code>/embed</code>, ép đúng tenant).',
    ep_delete_knowledge_summary: "Xoá 1 tài liệu theo id.", ep_post_knowledge_sync_summary: "Đồng bộ lại toàn bộ nguồn tài liệu đã cấu hình (vd Sanity/WordPress) cho tenant.",
    ep_post_chat_lesson_id_note: 'có thì trả lời theo đúng phạm vi lesson đó (xem <a href="#lessons">Bài học (Lessons)</a>), bỏ trống = bot trợ lý chung',
    sec_lessons_desc: 'Cho hệ thống LMS/khoá học (vd skillgo-app) tạo <strong>1 bot AI riêng cho từng bài học</strong> + <strong>1 bot trợ lý chung</strong> cho toàn bộ khoá, mà không cần tạo hạ tầng riêng cho từng bài học.',
    lessons_arch_title: "Kiến trúc: vì sao chỉ 2 endpoint là đủ?",
    lessons_arch_body: 'Không tạo workspace/RAG riêng cho từng lesson (không chịu nổi khi tạo hàng nghìn lesson/ngày). Thay vào đó: <strong>bot theo lesson</strong> lookup thẳng nội dung theo <code>lesson_id</code> và nhét vào đúng câu hỏi đó (không qua tìm kiếm ngữ nghĩa, luôn chính xác 100% trong phạm vi bài học) — kích hoạt bằng cách gửi kèm <code>lesson_id</code> khi gọi <a href="#post-chat">POST /api/v1/chat</a>. <strong>Bot trợ lý chung</strong> vẫn dùng đúng 1 workspace RAG có sẵn của tenant (như nhóm <a href="#knowledge">Knowledge base</a> ở trên) — mỗi lesson mới chỉ là thêm 1 tài liệu vào workspace đó, không tạo gì mới; gọi <code>/api/v1/chat</code> không kèm <code>lesson_id</code> để dùng bot này.',
    ep_post_lessons_summary: 'Tạo mới hoặc cập nhật 1 lesson (upsert theo <code>lesson_id</code>). Tự động: (1) lưu nội dung để bot theo lesson lookup thẳng, (2) nhúng vào workspace RAG của tenant cho bot trợ lý chung, (3) nếu lesson đã tồn tại thì tự xoá bản nhúng cũ trước khi nhúng lại — gọi lại API này mỗi khi sửa nội dung lesson là đủ, không cần tự quản lý embedding.',
    ep_post_lessons_n1: "id lesson bên hệ thống của bạn — ≤ 100 ký tự, dùng lại đúng id này khi chat/xoá",
    ep_post_lessons_n2: "toàn bộ nội dung bài học (text) — ≤ 500.000 ký tự",
    ep_delete_lessons_summary: "Xoá 1 lesson — dọn luôn bản nhúng RAG tương ứng khỏi workspace của tenant, để bot trợ lý chung không còn nhắc tới nội dung đã xoá.",
    lessons_integrate_title: "Checklist tích hợp cho dev hệ thống ngoài",
    lessons_integrate_body: '1) Ở chỗ code tạo/sửa lesson đã có sẵn trong hệ thống của bạn, gọi thêm <code>POST /api/v1/lessons</code> ngay sau khi lưu thành công — không cần màn hình quản lý riêng.<br>2) Ở chỗ xoá lesson, gọi thêm <code>DELETE /api/v1/lessons/:lesson_id</code>.<br>3) Ở màn chat trong 1 bài học, gửi kèm <code>lesson_id</code> khi gọi <a href="#post-chat">POST /api/v1/chat</a>; ở màn trợ lý chung thì bỏ trống field này.<br>4) Nếu lesson được tạo hàng loạt (vd hàng nghìn/ngày), gọi <code>POST /api/v1/lessons</code> qua hàng đợi/job nền — đừng gọi đồng bộ ngay trong request tạo lesson của người dùng cuối, tránh làm chậm thao tác của họ.',
    sec_marketplace_desc: 'Cho khách hàng cuối <strong>tra cứu/tư vấn bằng chat</strong> khi bạn đã có sẵn 1 platform + API riêng (vd sàn bất động sản, việc làm, hoặc bất kỳ ngành nào khác) — không cần Knowledge Worker tự lưu dữ liệu, chỉ cần đăng ký API search có sẵn của bạn làm 1 "tool" cho AI gọi.',
    mp_arch_title: "Cơ chế: đăng ký tool 1 lần, dùng lại cho mọi ngành",
    mp_arch_body: 'Đăng ký API search thật của bạn qua <a href="#post-agent-tools">POST /api/v1/agent-tools</a> (URL, tham số, cách đọc kết quả). Khách hàng cuối chat qua <a href="#post-marketplace-chat">POST /api/v1/marketplace-chat</a> — AI tự gọi đúng tool đã đăng ký để trả lời, không bịa thông tin ngoài kết quả tool trả về. Đổi ngành/thêm ngành mới chỉ là đăng ký thêm tool khác, không phải sửa code.',
    mp_v1_title: "V1: chỉ hỗ trợ tra cứu (GET), chưa hỗ trợ tạo/sửa dữ liệu qua chat",
    mp_v1_body: 'Vì endpoint <code>/marketplace-chat</code> mở cho khách hàng ẩn danh, tool có <code>method</code> khác <code>GET</code> bị <strong>chặn ở tầng code</strong> (không chỉ ở system prompt) khi gọi qua kênh này — tránh bị lợi dụng tạo/ghi dữ liệu hàng loạt qua chat. Đăng ký tool GET (search/đọc chi tiết) vẫn dùng bình thường.',
    ep_get_agent_tools_summary: "Liệt kê các tool (API ngoài) tenant đã đăng ký.",
    ep_post_agent_tools_summary: 'Đăng ký 1 API ngoài làm tool cho AI gọi. Dùng <code>{tên_tham_số}</code> trong <code>url_template</code> để chèn giá trị model chọn.',
    ep_agent_tools_n1: "chỉ chữ/số/gạch dưới", ep_agent_tools_n2: "để model biết khi nào nên gọi tool này",
    ep_agent_tools_n3: "mặc định GET — kênh marketplace-chat chỉ chạy được GET",
    ep_agent_tools_n4: "vd https://api.client.com/search?q={keyword}&price_max={price_max}",
    ep_agent_tools_n5: "JSON Schema dạng chuỗi, mô tả tham số model được điền",
    ep_agent_tools_n6: "JSON dạng chuỗi, vd API key tĩnh của bạn",
    ep_agent_tools_n7: "đường dẫn lấy phần cần thiết từ response JSON, vd data.results",
    ep_delete_agent_tools_summary: "Gỡ 1 tool đã đăng ký.",
    ep_post_marketplace_chat_summary: 'Chat cho khách hàng cuối — AI tự gọi đúng tool GET đã đăng ký (xem <a href="#post-agent-tools">POST /agent-tools</a>) để trả lời, áp dụng cùng giới hạn lượt chat/tháng như <a href="#post-chat">POST /chat</a>.',
    ep_post_marketplace_chat_item_id_note: 'khách đang xem đúng 1 mục cụ thể (vd trang chi tiết 1 tin BĐS) — server tự gọi thẳng tool tên <code>get_item_detail</code> (nếu đã đăng ký) với tham số <code>id</code>, không chờ model quyết định, đảm bảo tư vấn đúng mục đang xem',
    mp_detail_title: "Tư vấn theo đúng 1 mục đang xem (vd trang chi tiết 1 tin)",
    mp_detail_body: 'Khi khách đang ở trang chi tiết 1 tin/mục cụ thể — giống hệt trường hợp học viên đang mở 1 lesson (xem <a href="#lessons">Bài học (Lessons)</a>) — không cần "tìm kiếm" gì cả vì đã biết chính xác id. Có 2 cách: (1) nếu hệ thống gọi API này (backend của bạn) đã có sẵn nội dung mục đó, gửi thẳng qua <code>item_context</code> — nhanh nhất, không cần đăng ký tool, bạn tự kiểm soát nội dung gửi; (2) nếu không có sẵn, đăng ký 1 tool GET tên đúng <code>get_item_detail</code> (nhận tham số <code>id</code>) trỏ vào API xem chi tiết của bạn, rồi gửi kèm <code>item_id</code> — server tự gọi tool đó lấy dữ liệu. Gửi cả 2 thì <code>item_context</code> được ưu tiên dùng.',
    ep_post_marketplace_chat_item_context_note: '≤ 20.000 ký tự — nếu hệ thống gọi API này (backend của bạn) đã có sẵn nội dung mục đang xem, gửi thẳng text đã làm sạch qua đây thay vì dùng <code>item_id</code>; ưu tiên hơn <code>item_id</code> nếu cả 2 cùng được gửi, tránh phải gọi ngược lại API của bạn',
    sec_schedules_desc: "Đặt luật lên lịch đăng bài tự động theo ngày trong tuần + khung giờ, cho nội dung blog hoặc social.",
    ep_post_schedules_n1: 'mảng "HH:MM", 1 giờ = 1 bài/ngày áp dụng', ep_post_schedules_n2: "mon..sun; rỗng/bỏ qua = áp dụng hàng ngày",
    ep_patch_schedules_summary: "Cập nhật 1 phần (cùng field như tạo mới, tất cả optional).",
    sec_loyalty_h2: 'Loyalty <span class="mono" style="font-weight:400;color:var(--fg-muted);font-size:0.8em;">/api/v1/loyalty/*</span>',
    sec_loyalty_desc: "Chương trình khách hàng thân thiết, tích/đổi điểm, campaign quay thưởng (reward-world).",
    loy_n1: "đọc cấu hình chương trình loyalty của tenant", loy_n2: "tạo/cập nhật cấu hình chương trình", loy_n3: "ghi nhận 1 giao dịch bán hàng để tích điểm", loy_n4: "đổi điểm lấy ưu đãi", loy_n5: "xem điểm/hạng của 1 khách", loy_n6: "danh sách campaign quay thưởng", loy_n7: "khách tham gia campaign", loy_n8: "thực hiện 1 lượt quay", loy_n9: "danh sách phần thưởng đã trúng", loy_n10: "nhận thưởng (kích hoạt fulfillment provider)",
    sec_loyalty_note: 'Chưa có nút "Thử API" cho nhóm này trên trang — payload phức tạp/khác nhau theo campaign. Gọi trực tiếp bằng curl/Postman theo path ở trên (vẫn dùng cùng <code>Authorization: Bearer &lt;api_key&gt;</code>).',
    sec_cp_desc: 'Lập kế hoạch nội dung dài hạn theo chủ đề, phân tích xu hướng, sinh bài + dịch, luồng duyệt/từ chối riêng cho content plan (khác với duyệt bài đơn lẻ ở <code>/posts/:id/approve</code>).',
    sec_cp_note: 'Nhóm này chủ yếu phục vụ dashboard nội bộ (composer.html) — hệ thống ngoài thường chỉ cần nhóm "Chat & khách hàng" và "Loyalty" ở trên. Chưa có nút "Thử API" cho nhóm này.',
    err_th_meaning: "Ý nghĩa",
    err_400: 'Thiếu field bắt buộc hoặc dữ liệu không hợp lệ — chi tiết trong <code>error</code>', err_401: 'Thiếu/sai <code>Authorization: Bearer &lt;api_key&gt;</code>', err_403: "Record tồn tại nhưng thuộc tenant khác", err_404: "Không tìm thấy resource (post/session/call/schedule id)", err_409: "Xung đột — vd tenant slug đã dùng, hoặc dependency content-plan chưa sẵn sàng", err_502: "Lỗi khi gọi tới PocketBase/dịch vụ backend nội bộ",
    err_footer_p: 'Mọi lỗi trả JSON dạng <code>{ "error": "..." }</code>.',
    qs_h2: "Ví dụ: chủ động báo tin cho khách khi đơn hàng xong",
    qs_desc: 'Flow điển hình cho hệ thống POS: tạo link chat gắn tên khách khi có đơn mới, lưu lại <code>session</code>; khi đơn chuyển trạng thái "Đã xong", gọi <code>/messages</code> để gửi thông báo vào đúng cuộc chat đó. Có thể thử trực tiếp bằng 2 nút "Thử API" ở mục <a href="#post-chat-link">/chat-link</a> và <a href="#post-messages">/messages</a> phía trên (nhớ copy đúng <code>session</code> trả về từ bước 1 sang bước 2).',
    footer_text: 'Knowledge Worker · apic.schoolsai.work — tài liệu này được sinh trực tiếp từ route thật trong <code>src/index.js</code>, <code>src/api/loyalty.js</code>, <code>src/api/contentPlanning.js</code>. Lệch với hành vi thật, sửa code trước rồi cập nhật lại trang này.',
    tt_try: "Thử API", tt_hide: "Ẩn form", tt_path: "(path)", tt_query: "(query, tuỳ chọn)", tt_body: "Body (JSON)", tt_send: "Gửi request →", tt_sending: "Đang gửi", tt_neterr: "Lỗi mạng:"
  },
  en: {
    kb_label: "API key", kb_hint: 'Only stored in your browser (localStorage) — used by every "Send request" button on this page.', kb_toggle_title: "Show/hide key",
    nav_intro: "Introduction & Auth", nav_g_botconfig: "Bot & config", nav_g_chat: "Chat & customers", nav_g_calls: "Voice calls", nav_g_content: "Content & posting", nav_g_knowledge: "Knowledge base", nav_g_lessons: "Lessons", nav_g_marketplace: "Marketplace / External APIs", nav_g_schedules: "Publish schedules", nav_g_loyalty: "Loyalty & Content Planning", nav_g_other: "Other", nav_errors: "Common error codes", nav_quickstart: "Example: proactively message a customer",
    main_lede: 'Reference for the full public API (<code>/api/v1/*</code>) of Knowledge Worker — for external systems (POS, CRM, call center...) integrating chatbot, voice calls, loyalty, and content management per tenant. Every main endpoint has a <strong>"Try it"</strong> button to call it live on the page, no Postman needed.',
    intro_h2: "Base URL & Authentication", intro_th_format: "Format", intro_callout_title: "Where do I get an API key?",
    intro_callout_body: 'Each tenant has its own <code>api_key</code> (generated when creating a bot via <code>/api/onboarding/register</code> or <code>POST /api/v1/bots</code>), viewable again on the dashboard\'s config page (config.html). Paste it into the "API key" field at the top of this page to use the "Try it" buttons below.',
    intro_p1: 'Always pass the API key in the <code>Authorization: Bearer sk_xxx</code> header. Never put secrets in URLs or query strings.',
    intro_p2: 'Every endpoint below is automatically scoped to the <strong>tenant</strong> tied to the API key — there is no way to read or write another tenant\'s data.',
    fh_field: "Field", fh_type: "Type", fh_required: "Required", fh_note: "Notes", fh_query: "Query", fh_method: "Method", fh_path: "Path",
    common_yes: "yes", common_no: "no", badge_auth: "requires API key",
    sec_botconfig_desc: "Create new bots, read/write configuration, or let an AI assistant update the config through natural conversation.",
    ep_post_bots_summary: "Creates one more bot/tenant from an account that already has an API key.",
    ep_post_bots_n1: "3-40 chars: lowercase letters/digits/hyphen/underscore", ep_post_bots_n2: "2-80 chars", ep_post_bots_n3: "max 500 chars", ep_post_bots_n4: "max 10,000 chars",
    ep_post_bots_note: 'Returns 409 if <code>tenant</code> already exists.',
    ep_get_config_summary: "Reads the bot's current configuration (name, color, webhook, system_prompt, model, temperature, Telegram chat id, Cloudinary, brand_logo_url...).",
    ep_patch_config_summary: "Updates part of the configuration — only send the fields you want to change.", ep_patch_config_n1: "auto-trimmed",
    ep_post_agent_chat_summary: "Natural-language chat with the config assistant — the model calls tools to save configuration, connect channels (Facebook/Instagram/Zalo/WordPress/Sanity...), add agent tools, schedule posts, create chat-links, etc. instead of calling each API below by hand.",
    ep_post_agent_chat_n1: 'yes — up to 100 messages, the last one must have role "user"',
    ep_get_agent_chat_tools_summary: 'Lists every tool <code>/agent-chat</code> can call (built-in + the tenant\'s custom tools).',
    conn_meta_nav: "↳ Connect Messenger/Instagram",
    conn_meta_title: "Connect Messenger / Instagram (DMs + automatic comment replies)",
    conn_meta_intro: 'Follow these 4 steps — use the "Try it" box below, no other tool needed.',
    conn_meta_step1: 'Send a message to the config assistant (the "Try it" box right below) to connect your Page/Instagram account — fill in your real <code>page_id</code> and <code>access_token</code> before sending. If this page was already connected for posting, just regenerate the <code>access_token</code> with the extra <code>pages_messaging</code> and <code>pages_manage_engagement</code> permissions and reconnect it — nothing else needed.',
    conn_meta_step2: "The bot returns a Verify Token unique to your page — copy it.",
    conn_meta_step3: 'Go to your Meta App Dashboard → Webhooks → subscribe: fixed Callback URL <code>https://apic.schoolsai.work/meta-webhook</code>, paste the Verify Token you got, subscribe to the <code>messages</code> field (DMs) and <code>feed</code> (Facebook)/<code>comments</code> (Instagram) if you want automatic comment replies.',
    conn_meta_step4: 'If your App hasn\'t passed App Review for <code>pages_messaging</code>/<code>pages_manage_engagement</code>, only admin/tester accounts of the App will receive real messages/comments during testing — App Review must be completed to receive them from real customers.',
    sec_chat_desc: "End-customer chatbot, per-customer chat links (for SMS/Zalo/email), sending customer context, and sending/reading session messages — the group external systems (POS...) use most.",
    ep_post_chat_summary: 'Sends one customer message to the AI chatbot and returns its reply (same as the internal <code>/chat</code> endpoint, but forces the correct tenant from the API key).',
    ep_post_chat_link_summary: 'Generates a dedicated chat link pre-filled with a customer\'s name + (optionally) customer context — no need to create a tenant or record a session first, the <code>chat.html</code> widget reads it straight from the URL. Use this when an external system (e.g. POS) wants to send the customer a chat link via SMS/Zalo/email.',
    ep_post_chat_link_n1: "name shown in the chat", ep_post_chat_link_n2: "also saves customer context (order, customer id...) for the newly created session",
    ep_put_customer_context_summary: "Writes/updates customer context (order, status, notes...) for an existing session — so the AI chatbot has real data on hand when replying, without the customer re-stating it.",
    ep_put_customer_context_n1: "yes — a flat object, not an array",
    ep_get_messages_summary: "Fetches the tenant's message history (up to 100, newest first).", ep_get_messages_n1: "filter by a specific session (omit = the whole tenant)",
    ep_post_messages_summary: '<strong>Proactively sends a message</strong> into an existing session — used by external systems (POS, CRM...) to proactively notify a customer in their currently open chat (e.g. "your order is ready"). Automatically marks any pending <code>needs_human</code> messages in that session as <code>escalation_resolved</code>.',
    ep_post_messages_n1: '≤ 200 chars — must be a session that already has at least one message (created via <code>/chat-link</code> or the customer has chatted once)', ep_post_messages_n2: "≤ 10,000 chars",
    ep_post_messages_note: 'If you are not sure the session still exists, call <code>GET /api/v1/messages?session=...</code> first to check, or create the session with <code>POST /api/v1/chat-link</code> up front (the server saves <code>customer_context</code> automatically if provided).',
    sec_calls_desc: 'Manage admin ↔ customer voice calls over Cloudflare Realtime (SFU). The ringing/active/ended status is synced in real time to both sides through PocketBase, the same mechanism as <code>messages</code>.',
    ep_get_calls_summary: 'Lists the tenant\'s calls that have not ended (<code>status != "ended"</code>).', ep_get_calls_n1: "filter by session",
    ep_post_calls_start_summary: "Admin starts a call to a customer within a session.", ep_post_calls_start_n1: "yes — WebRTC session id from Cloudflare Realtime",
    ep_post_calls_accept_summary: 'Admin answers a call that is currently <code>ringing</code>.',
    ep_post_calls_end_summary: "Declines (not yet answered) or ends (in progress) a call.", ep_post_calls_end_n1: 'defaults to "declined" / "hangup"',
    sec_content_desc: "Create/approve social & blog posts, view the publishing pipeline status, and manually run background jobs (RSS crawl, publish, agent).",
    ep_get_posts_summary: "Lists up to the 50 most recent posts, including targets (channel + status) and media.", ep_get_posts_n1: "only posts with at least one target in this status (pending/approved/scheduled/publishing/published/error)",
    ep_post_posts_summary: 'Creates a new post, auto-creating a target for each connected channel (defaults to facebook if <code>platforms</code> is omitted).',
    ep_post_posts_n1: 'no — defaults to ["facebook"]', ep_post_posts_n2: 'true = create the target already "approved", skipping the review step',
    ep_post_posts_approve_summary: 'Approves every "pending" target of one post. Blocked (409) if the post belongs to a content-plan whose dependencies are not ready.',
    ep_post_content_cluster_summary: "Plans and drafts (async, in the background) a cluster of several SEO blog posts around one topic, interlinked with each other.", ep_post_content_cluster_n1: "defaults to 5, max 8",
    ep_get_status_summary: "Counts posts by pipeline status (pending/approved/scheduled/publishing/published/error).",
    ep_post_trigger_summary: "Manually runs (without waiting for the cron) the RSS crawl + draft job, the approved-post publish job, or one pass of the operations AI agent for the current tenant.",
    sec_knowledge_desc: "Documents used as RAG context for the chatbot (embedded into Vectorize).",
    ep_get_knowledge_summary: "Lists up to 100 documents (id, title, char_count, created).",
    ep_post_knowledge_summary: 'Adds a new document, automatically embedded for semantic search (same as the internal <code>/embed</code> endpoint, forced to the correct tenant).',
    ep_delete_knowledge_summary: "Deletes one document by id.", ep_post_knowledge_sync_summary: "Re-syncs every configured document source (e.g. Sanity/WordPress) for the tenant.",
    ep_post_chat_lesson_id_note: 'if set, the reply is scoped to that lesson (see <a href="#lessons">Lessons</a>); omit for the general assistant bot',
    sec_lessons_desc: 'Lets an LMS/course system (e.g. skillgo-app) give <strong>each lesson its own AI bot</strong> plus <strong>one general assistant bot</strong> for the whole course, without provisioning separate infrastructure per lesson.',
    lessons_arch_title: "Architecture: why just 2 endpoints are enough",
    lessons_arch_body: 'No separate workspace/RAG is created per lesson (that would not survive thousands of lessons created per day). Instead: the <strong>per-lesson bot</strong> looks up the content directly by <code>lesson_id</code> and injects it straight into that request\'s question (no semantic search, always 100% accurate within the lesson\'s scope) — enable it by passing <code>lesson_id</code> to <a href="#post-chat">POST /api/v1/chat</a>. The <strong>general assistant bot</strong> still uses the tenant\'s single existing RAG workspace (same one as <a href="#knowledge">Knowledge base</a> above) — each new lesson is just one more document added to that workspace, nothing new is provisioned; call <code>/api/v1/chat</code> without <code>lesson_id</code> to use this bot.',
    ep_post_lessons_summary: 'Creates or updates one lesson (upserted by <code>lesson_id</code>). Automatically: (1) stores the content for the per-lesson bot to look up directly, (2) embeds it into the tenant\'s RAG workspace for the general assistant bot, (3) if the lesson already exists, deletes the old embedding before re-embedding — just call this API again whenever lesson content changes, no manual embedding management needed.',
    ep_post_lessons_n1: "your own system's lesson id — ≤ 100 chars, reuse the same id for chat/delete",
    ep_post_lessons_n2: "the full lesson content (text) — ≤ 500,000 chars",
    ep_delete_lessons_summary: "Deletes one lesson — also cleans up its RAG embedding from the tenant's workspace, so the general assistant bot stops referencing the deleted content.",
    lessons_integrate_title: "Integration checklist for developers on other systems",
    lessons_integrate_body: '1) Wherever your system already creates/updates a lesson, add a call to <code>POST /api/v1/lessons</code> right after the save succeeds — no separate admin screen needed.<br>2) Wherever a lesson is deleted, add a call to <code>DELETE /api/v1/lessons/:lesson_id</code>.<br>3) When chatting inside a lesson, pass <code>lesson_id</code> to <a href="#post-chat">POST /api/v1/chat</a>; leave it out for the general assistant screen.<br>4) If lessons are created in bulk (e.g. thousands/day), call <code>POST /api/v1/lessons</code> from a queue/background job — do not call it synchronously inside the end-user\'s lesson-creation request, to avoid slowing them down.',
    sec_marketplace_desc: 'Lets end customers <strong>search and get advice via chat</strong> when you already have your own platform + API (e.g. a real estate or job marketplace, or any other vertical) — no need for Knowledge Worker to store any data itself, just register your existing search API as a "tool" the AI can call.',
    mp_arch_title: "How it works: register a tool once, reuse for any vertical",
    mp_arch_body: 'Register your real search API via <a href="#post-agent-tools">POST /api/v1/agent-tools</a> (URL, parameters, how to read the result). End customers chat through <a href="#post-marketplace-chat">POST /api/v1/marketplace-chat</a> — the AI calls the registered tool to answer, never making up information beyond what the tool returns. Switching or adding a vertical is just registering a different tool, not a code change.',
    mp_v1_title: "V1: read-only (GET) only, no create/write via chat yet",
    mp_v1_body: 'Because <code>/marketplace-chat</code> is open to anonymous end customers, any tool whose <code>method</code> is not <code>GET</code> is <strong>blocked at the code level</strong> (not just in the system prompt) when called through this channel — preventing abuse for bulk data creation via chat. Registered GET tools (search/detail lookup) work normally.',
    ep_get_agent_tools_summary: "Lists the tools (external APIs) the tenant has registered.",
    ep_post_agent_tools_summary: 'Registers an external API as a tool the AI can call. Use <code>{param_name}</code> in <code>url_template</code> to substitute a value the model chooses.',
    ep_agent_tools_n1: "letters/digits/underscore only", ep_agent_tools_n2: "lets the model know when to call this tool",
    ep_agent_tools_n3: "defaults to GET — the marketplace-chat channel only runs GET",
    ep_agent_tools_n4: "e.g. https://api.client.com/search?q={keyword}&price_max={price_max}",
    ep_agent_tools_n5: "a JSON Schema string describing the parameters the model can fill in",
    ep_agent_tools_n6: "a JSON string, e.g. your static API key",
    ep_agent_tools_n7: "path to the relevant part of the JSON response, e.g. data.results",
    ep_delete_agent_tools_summary: "Removes a registered tool.",
    ep_post_marketplace_chat_summary: 'Chat for end customers — the AI calls the right registered GET tool (see <a href="#post-agent-tools">POST /agent-tools</a>) to answer, under the same monthly chat quota as <a href="#post-chat">POST /chat</a>.',
    ep_post_marketplace_chat_item_id_note: 'the customer is viewing one specific item (e.g. a real-estate listing detail page) — the server calls the tool named <code>get_item_detail</code> directly (if registered) with an <code>id</code> parameter, without waiting for the model to decide, so advice always matches the item being viewed',
    mp_detail_title: "Advice scoped to the item currently being viewed (e.g. a listing detail page)",
    mp_detail_body: 'When a customer is on a specific item\'s detail page — the same situation as a student having a lesson open (see <a href="#lessons">Lessons</a>) — no "search" is needed since the id is already known. Two options: (1) if the system calling this API (your backend) already has the item\'s content on hand, send it directly via <code>item_context</code> — fastest, no tool registration needed, you control exactly what\'s sent; (2) otherwise, register one GET tool named exactly <code>get_item_detail</code> (taking an <code>id</code> parameter) pointing to your detail-lookup API, then pass <code>item_id</code> — the server calls that tool to fetch the data. If both are sent, <code>item_context</code> takes priority.',
    ep_post_marketplace_chat_item_context_note: '≤ 20,000 chars — if the system calling this API (your backend) already has the content of the item being viewed, send the cleaned-up text directly here instead of using <code>item_id</code>; takes priority over <code>item_id</code> if both are sent, avoiding a call back to your own API',
    sec_schedules_desc: "Sets rules for automatically publishing content on given weekdays + time slots, for blog or social content.",
    ep_post_schedules_n1: 'array of "HH:MM", each time = one post/day at that slot', ep_post_schedules_n2: "mon..sun; empty/omitted = every day",
    ep_patch_schedules_summary: "Partially updates a schedule (same fields as creation, all optional).",
    sec_loyalty_h2: 'Loyalty <span class="mono" style="font-weight:400;color:var(--fg-muted);font-size:0.8em;">/api/v1/loyalty/*</span>',
    sec_loyalty_desc: "Loyalty program, earning/redeeming points, spin-to-win campaigns (reward-world).",
    loy_n1: "reads the tenant's loyalty program configuration", loy_n2: "creates/updates the program configuration", loy_n3: "records one sale to earn points", loy_n4: "redeems points for a reward", loy_n5: "views a customer's points/tier", loy_n6: "lists spin-to-win campaigns", loy_n7: "customer joins a campaign", loy_n8: "performs one spin", loy_n9: "lists rewards won", loy_n10: "claims a reward (triggers the fulfillment provider)",
    sec_loyalty_note: 'No "Try it" button for this group yet — payloads are complex and vary by campaign. Call it directly with curl/Postman using the paths above (still uses the same <code>Authorization: Bearer &lt;api_key&gt;</code>).',
    sec_cp_desc: 'Long-term topic-based content planning, trend analysis, generating + translating posts, and a separate review/reject flow for content plans (different from approving a single post at <code>/posts/:id/approve</code>).',
    sec_cp_note: 'This group mainly serves the internal dashboard (composer.html) — external systems usually only need the "Chat & customers" and "Loyalty" groups above. No "Try it" button for this group yet.',
    err_th_meaning: "Meaning",
    err_400: 'Missing a required field or invalid data — see <code>error</code> for details', err_401: 'Missing/invalid <code>Authorization: Bearer &lt;api_key&gt;</code>', err_403: "Record exists but belongs to a different tenant", err_404: "Resource not found (post/session/call/schedule id)", err_409: "Conflict — e.g. tenant slug already taken, or a content-plan dependency is not ready", err_502: "Error calling PocketBase or an internal backend service",
    err_footer_p: 'Every error returns JSON shaped like <code>{ "error": "..." }</code>.',
    qs_h2: "Example: proactively notify a customer when their order is ready",
    qs_desc: 'Typical POS flow: generate a chat link with the customer\'s name when a new order comes in, save the <code>session</code>; when the order status becomes "Done", call <code>/messages</code> to send a notice into that same chat. Try it directly with the two "Try it" buttons under <a href="#post-chat-link">/chat-link</a> and <a href="#post-messages">/messages</a> above (remember to copy the <code>session</code> from step 1 into step 2).',
    footer_text: 'Knowledge Worker · apic.schoolsai.work — this page is generated directly from the real routes in <code>src/index.js</code>, <code>src/api/loyalty.js</code>, <code>src/api/contentPlanning.js</code>. If it drifts from actual behavior, fix the code first, then update this page.',
    tt_try: "Try it", tt_hide: "Hide form", tt_path: "(path)", tt_query: "(query, optional)", tt_body: "Body (JSON)", tt_send: "Send request →", tt_sending: "Sending", tt_neterr: "Network error:"
  },
  ja: {
    kb_label: "APIキー", kb_hint: "このブラウザ（localStorage）にのみ保存されます — このページのすべての「リクエスト送信」ボタンで使用します。", kb_toggle_title: "キーの表示/非表示",
    nav_intro: "概要と認証", nav_g_botconfig: "ボットと設定", nav_g_chat: "チャットと顧客", nav_g_calls: "音声通話", nav_g_content: "コンテンツと投稿", nav_g_knowledge: "ナレッジベース", nav_g_schedules: "自動投稿スケジュール", nav_g_loyalty: "ロイヤルティとコンテンツ計画", nav_g_other: "その他", nav_errors: "共通エラーコード", nav_quickstart: "例：顧客への能動的なメッセージ送信",
    main_lede: 'Knowledge Workerの公開API（<code>/api/v1/*</code>）全体のリファレンスです。外部システム（POS、CRM、コールセンターなど）がテナントごとにチャットボット、音声通話、ロイヤルティ、コンテンツ管理を統合する際に使用します。主要な各エンドポイントには<strong>「試す」</strong>ボタンがあり、Postman不要でページ上から実際に呼び出せます。',
    intro_h2: "ベースURLと認証", intro_th_format: "形式", intro_callout_title: "APIキーはどこで取得しますか？",
    intro_callout_body: 'テナントごとに固有の<code>api_key</code>があります（<code>/api/onboarding/register</code>またはPOST /api/v1/botsでボット作成時に生成）。ダッシュボードの設定ページ（config.html）で再確認できます。このページ上部の「APIキー」欄に貼り付けると、下の「試す」ボタンで使用できます。',
    intro_p1: 'APIキーは必ず<code>Authorization: Bearer sk_xxx</code>ヘッダーで送信してください。URLやクエリ文字列にシークレットを含めないでください。',
    intro_p2: '以下の各エンドポイントは、APIキーに紐づく<strong>テナント</strong>に自動的に制限されます — 他のテナントのデータを読み書きする方法はありません。',
    fh_field: "項目", fh_type: "型", fh_required: "必須", fh_note: "備考", fh_query: "クエリ", fh_method: "メソッド", fh_path: "パス",
    common_yes: "はい", common_no: "いいえ", badge_auth: "APIキーが必要",
    sec_botconfig_desc: "新しいボットの作成、設定の読み書き、またはAIアシスタントに自然な会話で設定を更新させます。",
    ep_post_bots_summary: "既にAPIキーを持つアカウントから、ボット/テナントをもう1つ作成します。",
    ep_post_bots_n1: "3〜40文字：小文字/数字/ハイフン/アンダースコア", ep_post_bots_n2: "2〜80文字", ep_post_bots_n3: "最大500文字", ep_post_bots_n4: "最大10,000文字",
    ep_post_bots_note: '<code>tenant</code>が既に存在する場合は409エラーになります。',
    ep_get_config_summary: "ボットの現在の設定（名前、色、webhook、system_prompt、model、temperature、Telegramチャットid、Cloudinary、brand_logo_urlなど）を取得します。",
    ep_patch_config_summary: "設定の一部を更新します — 変更したいフィールドのみ送信してください。", ep_patch_config_n1: "自動トリム",
    ep_post_agent_chat_summary: "設定アシスタントとの自然言語チャットです。モデルがツールを呼び出して設定を保存し、チャンネル（Facebook/Instagram/Zalo/WordPress/Sanityなど）を接続し、エージェントツールを追加し、投稿をスケジュールし、chat-linkを作成するなど、下記の各APIを個別に呼ぶ代わりに使えます。",
    ep_post_agent_chat_n1: 'はい — 最大100メッセージ、最後は role "user" である必要があります',
    ep_get_agent_chat_tools_summary: '<code>/agent-chat</code>が呼び出せる全ツール（組み込み＋テナントのカスタムツール）を一覧表示します。',
    sec_chat_desc: "エンドユーザー向けチャットボット、顧客ごとの専用チャットリンク（SMS/Zalo/メール用）、顧客コンテキストの送信、セッションメッセージの送受信 — 外部システム（POSなど）が最もよく使うグループです。",
    ep_post_chat_summary: '顧客からのメッセージをAIチャットボットに送信し、返信を受け取ります（内部の<code>/chat</code>エンドポイントと同様ですが、APIキーから正しいテナントを強制します）。',
    ep_post_chat_link_summary: '顧客名＋（任意で）顧客コンテキストを埋め込んだ専用チャットリンクを生成します — テナント作成やセッション事前登録は不要で、<code>chat.html</code>ウィジェットがURLから直接読み取ります。外部システム（POSなど）がSMS/Zalo/メールでチャットリンクを顧客に送りたい場合に使用します。',
    ep_post_chat_link_n1: "チャットに表示される名前", ep_post_chat_link_n2: "新規作成したセッションに顧客コンテキスト（注文、顧客IDなど）も保存する",
    ep_put_customer_context_summary: "既存セッションの顧客コンテキスト（注文、ステータス、メモなど）を書き込み/更新します — 顧客に再入力させることなく、AIチャットボットが返信時に実データを使えるようにします。",
    ep_put_customer_context_n1: "はい — 配列ではなくフラットなオブジェクト",
    ep_get_messages_summary: "テナントのメッセージ履歴を取得します（最大100件、新しい順）。", ep_get_messages_n1: "特定のセッションで絞り込み（未指定＝テナント全体）",
    ep_post_messages_summary: '既存セッションに<strong>能動的にメッセージを送信</strong>します — 外部システム（POS、CRMなど）が現在開いているチャットに顧客への通知（例：「ご注文が完了しました」）を能動的に送るために使います。そのセッションで保留中の<code>needs_human</code>メッセージは自動的に<code>escalation_resolved</code>としてマークされます。',
    ep_post_messages_n1: '200文字以内 — 少なくとも1件のメッセージが既にあるセッションである必要があります（<code>/chat-link</code>で作成、または顧客が一度チャット済み）', ep_post_messages_n2: "10,000文字以内",
    ep_post_messages_note: 'セッションが存在するか確信が持てない場合は、まず<code>GET /api/v1/messages?session=...</code>で確認するか、最初から<code>POST /api/v1/chat-link</code>でセッションを作成してください（<code>customer_context</code>があれば自動保存されます）。',
    sec_calls_desc: '管理者↔顧客の音声通話をCloudflare Realtime（SFU）経由で管理します。ringing/active/endedのステータスは、<code>messages</code>と同じ仕組みでPocketBase経由で両者にリアルタイム同期されます。',
    ep_get_calls_summary: 'テナントの未終了（<code>status != "ended"</code>）の通話を一覧表示します。', ep_get_calls_n1: "セッションで絞り込み",
    ep_post_calls_start_summary: "管理者がセッション内で顧客への通話を開始します。", ep_post_calls_start_n1: "はい — Cloudflare RealtimeのWebRTCセッションID",
    ep_post_calls_accept_summary: '<code>ringing</code>中の通話に管理者が応答します。',
    ep_post_calls_end_summary: "通話を拒否（未応答時）または終了（通話中）します。", ep_post_calls_end_n1: 'デフォルトは"declined" / "hangup"',
    sec_content_desc: "SNS・ブログ投稿の作成/承認、投稿パイプラインの状態確認、バックグラウンドジョブ（RSSクロール、publish、agent）の手動実行を行います。",
    ep_get_posts_summary: "直近最大50件の投稿を、targets（配信チャンネル＋ステータス）とメディア付きで一覧表示します。", ep_get_posts_n1: "このステータス（pending/approved/scheduled/publishing/published/error）のtargetを1つ以上持つ投稿のみ",
    ep_post_posts_summary: '新規投稿を作成し、接続済みの各チャンネルに対してtargetを自動作成します（<code>platforms</code>未指定時はfacebookがデフォルト）。',
    ep_post_posts_n1: 'いいえ — デフォルトは["facebook"]', ep_post_posts_n2: 'true = レビューを省略し、targetを最初から"approved"状態で作成',
    ep_post_posts_approve_summary: '1件の投稿の"pending"状態のtargetをすべて承認します。投稿がcontent-planに属し、依存関係が未整備の場合はブロックされます（409）。',
    ep_post_content_cluster_summary: "1つのトピックを中心に、相互リンクされた複数のSEOブログ記事クラスタをバックグラウンド（非同期）で計画・執筆します。", ep_post_content_cluster_n1: "デフォルト5、最大8",
    ep_get_status_summary: "パイプラインのステータス（pending/approved/scheduled/publishing/published/error）ごとに投稿数を集計します。",
    ep_post_trigger_summary: "cronを待たずに、RSSクロール＋下書き作成ジョブ、承認済み投稿のpublishジョブ、または現在のテナント向けAI運用エージェントの1回の実行を手動で実行します。",
    sec_knowledge_desc: "チャットボットのRAGコンテキストとして使うドキュメント（Vectorizeに埋め込み）。",
    ep_get_knowledge_summary: "最大100件のドキュメント（id、title、char_count、created）を一覧表示します。",
    ep_post_knowledge_summary: '新しいドキュメントを追加し、セマンティック検索用に自動的に埋め込みます（内部の<code>/embed</code>エンドポイントと同様、テナントを強制）。',
    ep_delete_knowledge_summary: "idで1件のドキュメントを削除します。", ep_post_knowledge_sync_summary: "設定済みの全ドキュメントソース（例：Sanity/WordPress）をテナント向けに再同期します。",
    sec_schedules_desc: "ブログまたはSNSコンテンツについて、曜日＋時間帯を指定した自動投稿ルールを設定します。",
    ep_post_schedules_n1: '"HH:MM"の配列。各時刻＝1日1投稿が適用される', ep_post_schedules_n2: "mon〜sun；空/省略＝毎日適用",
    ep_patch_schedules_summary: "一部を更新します（作成時と同じフィールドで、すべて任意）。",
    sec_loyalty_h2: 'Loyalty <span class="mono" style="font-weight:400;color:var(--fg-muted);font-size:0.8em;">/api/v1/loyalty/*</span>',
    sec_loyalty_desc: "ロイヤルティプログラム、ポイントの獲得/交換、スピン抽選キャンペーン（reward-world）。",
    loy_n1: "テナントのロイヤルティプログラム設定を取得", loy_n2: "プログラム設定を作成/更新", loy_n3: "1件の販売を記録してポイントを付与", loy_n4: "ポイントを特典と交換", loy_n5: "顧客のポイント/ランクを表示", loy_n6: "スピン抽選キャンペーン一覧", loy_n7: "顧客がキャンペーンに参加", loy_n8: "1回スピンを実行", loy_n9: "獲得した景品の一覧", loy_n10: "景品を受け取る（fulfillmentプロバイダーを起動）",
    sec_loyalty_note: 'このグループにはまだ「試す」ボタンがありません — ペイロードが複雑でキャンペーンごとに異なるためです。上記のパスを使ってcurl/Postmanで直接呼び出してください（同じ<code>Authorization: Bearer &lt;api_key&gt;</code>を使用）。',
    sec_cp_desc: 'トピック別の長期コンテンツ計画、トレンド分析、記事生成＋翻訳、content plan専用のレビュー/却下フロー（<code>/posts/:id/approve</code>での単体投稿承認とは異なります）。',
    sec_cp_note: 'このグループは主に内部ダッシュボード（composer.html）向けです — 外部システムは通常、上記の「チャットと顧客」と「Loyalty」グループのみ必要です。このグループにはまだ「試す」ボタンがありません。',
    err_th_meaning: "意味",
    err_400: '必須フィールドの欠落、またはデータが不正です — 詳細は<code>error</code>を参照', err_401: '<code>Authorization: Bearer &lt;api_key&gt;</code>が欠落/不正', err_403: "レコードは存在しますが別のテナントに属しています", err_404: "リソースが見つかりません（post/session/call/schedule id）", err_409: "競合 — 例：tenant slugが既に使用されている、またはcontent-planの依存関係が未整備", err_502: "PocketBase/内部バックエンドサービス呼び出し時のエラー",
    err_footer_p: 'すべてのエラーは<code>{ "error": "..." }</code>形式のJSONを返します。',
    qs_h2: "例：注文完了時に顧客へ能動的に通知する",
    qs_desc: '典型的なPOSフロー：新規注文時に顧客名入りのチャットリンクを生成し、<code>session</code>を保存します。注文ステータスが「完了」になったら、<code>/messages</code>を呼び出して同じチャットに通知を送ります。上記の<a href="#post-chat-link">/chat-link</a>と<a href="#post-messages">/messages</a>の「試す」ボタン2つで直接試せます（ステップ1で返された<code>session</code>をステップ2にコピーするのを忘れずに）。',
    footer_text: 'Knowledge Worker · apic.schoolsai.work — このページは<code>src/index.js</code>、<code>src/api/loyalty.js</code>、<code>src/api/contentPlanning.js</code>内の実際のルートから直接生成されています。実際の動作とずれている場合は、先にコードを修正してからこのページを更新してください。',
    tt_try: "試す", tt_hide: "フォームを隠す", tt_path: "（パス）", tt_query: "（クエリ、任意）", tt_body: "ボディ（JSON）", tt_send: "リクエスト送信 →", tt_sending: "送信中", tt_neterr: "ネットワークエラー："
  },
  es: {
    kb_label: "Clave API", kb_hint: 'Solo se guarda en tu navegador (localStorage) — se usa en todos los botones "Enviar solicitud" de esta página.', kb_toggle_title: "Mostrar/ocultar clave",
    nav_intro: "Introducción y autenticación", nav_g_botconfig: "Bot y configuración", nav_g_chat: "Chat y clientes", nav_g_calls: "Llamadas de voz", nav_g_content: "Contenido y publicaciones", nav_g_knowledge: "Base de conocimiento", nav_g_schedules: "Programación de publicaciones", nav_g_loyalty: "Fidelización y planificación de contenido", nav_g_other: "Otros", nav_errors: "Códigos de error comunes", nav_quickstart: "Ejemplo: notificar proactivamente a un cliente",
    main_lede: 'Referencia de toda la API pública (<code>/api/v1/*</code>) de Knowledge Worker — para sistemas externos (POS, CRM, centro de llamadas...) que integran chatbot, llamadas de voz, fidelización y gestión de contenido por tenant. Cada endpoint principal tiene un botón <strong>"Probar API"</strong> para llamarlo de verdad desde esta página, sin necesidad de Postman.',
    intro_h2: "URL base y autenticación", intro_th_format: "Formato", intro_callout_title: "¿Dónde consigo una clave API?",
    intro_callout_body: 'Cada tenant tiene su propia <code>api_key</code> (generada al crear un bot mediante <code>/api/onboarding/register</code> o <code>POST /api/v1/bots</code>), visible de nuevo en la página de configuración del dashboard (config.html). Pega la clave en el campo "Clave API" en la parte superior de esta página para usar los botones "Probar API" de abajo.',
    intro_p1: 'Envía siempre la clave API en el encabezado <code>Authorization: Bearer sk_xxx</code>. Nunca pongas secretos en URLs ni cadenas de consulta.',
    intro_p2: 'Todos los endpoints de abajo están automáticamente limitados al <strong>tenant</strong> asociado a la clave API — no hay forma de leer/escribir datos de otro tenant.',
    fh_field: "Campo", fh_type: "Tipo", fh_required: "Obligatorio", fh_note: "Notas", fh_query: "Query", fh_method: "Método", fh_path: "Ruta",
    common_yes: "sí", common_no: "no", badge_auth: "requiere clave API",
    sec_botconfig_desc: "Crea nuevos bots, lee/escribe la configuración, o deja que un asistente de IA actualice la configuración mediante conversación natural.",
    ep_post_bots_summary: "Crea un bot/tenant adicional desde una cuenta que ya tiene una clave API.",
    ep_post_bots_n1: "3-40 caracteres: minúsculas/números/guion/guion bajo", ep_post_bots_n2: "2-80 caracteres", ep_post_bots_n3: "máx. 500 caracteres", ep_post_bots_n4: "máx. 10.000 caracteres",
    ep_post_bots_note: 'Devuelve 409 si el <code>tenant</code> ya existe.',
    ep_get_config_summary: "Lee la configuración actual del bot (nombre, color, webhook, system_prompt, model, temperature, chat id de Telegram, Cloudinary, brand_logo_url...).",
    ep_patch_config_summary: "Actualiza parte de la configuración — envía solo los campos que quieras cambiar.", ep_patch_config_n1: "recortado automáticamente",
    ep_post_agent_chat_summary: "Chat en lenguaje natural con el asistente de configuración — el modelo llama herramientas para guardar la configuración, conectar canales (Facebook/Instagram/Zalo/WordPress/Sanity...), añadir herramientas del agente, programar publicaciones, crear chat-links, etc. en lugar de llamar cada API de abajo manualmente.",
    ep_post_agent_chat_n1: 'sí — hasta 100 mensajes, el último debe tener role "user"',
    ep_get_agent_chat_tools_summary: 'Lista todas las herramientas que <code>/agent-chat</code> puede llamar (integradas + herramientas personalizadas del tenant).',
    sec_chat_desc: "Chatbot para el cliente final, enlaces de chat individuales por cliente (para SMS/Zalo/email), envío de contexto del cliente, y envío/lectura de mensajes de sesión — el grupo que más usan los sistemas externos (POS...).",
    ep_post_chat_summary: 'Envía un mensaje del cliente al chatbot de IA y devuelve su respuesta (igual que el endpoint interno <code>/chat</code>, pero forzando el tenant correcto según la clave API).',
    ep_post_chat_link_summary: 'Genera un enlace de chat dedicado con el nombre del cliente + (opcionalmente) contexto del cliente — sin necesidad de crear un tenant ni registrar una sesión antes; el widget <code>chat.html</code> lo lee directamente de la URL. Úsalo cuando un sistema externo (p. ej. un POS) quiera enviar al cliente un enlace de chat por SMS/Zalo/email.',
    ep_post_chat_link_n1: "nombre mostrado en el chat", ep_post_chat_link_n2: "también guarda el contexto del cliente (pedido, id de cliente...) para la sesión recién creada",
    ep_put_customer_context_summary: "Escribe/actualiza el contexto del cliente (pedido, estado, notas...) para una sesión existente — para que el chatbot de IA tenga datos reales al responder, sin que el cliente tenga que repetirlos.",
    ep_put_customer_context_n1: "sí — un objeto plano, no un array",
    ep_get_messages_summary: "Obtiene el historial de mensajes del tenant (hasta 100, más recientes primero).", ep_get_messages_n1: "filtra por una sesión concreta (si se omite = todo el tenant)",
    ep_post_messages_summary: '<strong>Envía un mensaje de forma proactiva</strong> a una sesión existente — usado por sistemas externos (POS, CRM...) para notificar proactivamente a un cliente en su chat abierto (p. ej. "tu pedido está listo"). Marca automáticamente cualquier mensaje <code>needs_human</code> pendiente de esa sesión como <code>escalation_resolved</code>.',
    ep_post_messages_n1: '≤ 200 caracteres — debe ser una sesión que ya tenga al menos un mensaje (creada vía <code>/chat-link</code> o porque el cliente ya chateó una vez)', ep_post_messages_n2: "≤ 10.000 caracteres",
    ep_post_messages_note: 'Si no estás seguro de que la sesión siga existiendo, llama primero a <code>GET /api/v1/messages?session=...</code> para comprobarlo, o crea la sesión con <code>POST /api/v1/chat-link</code> desde el principio (el servidor guarda <code>customer_context</code> automáticamente si se proporciona).',
    sec_calls_desc: 'Gestiona llamadas de voz admin ↔ cliente a través de Cloudflare Realtime (SFU). El estado ringing/active/ended se sincroniza en tiempo real para ambas partes vía PocketBase, el mismo mecanismo que <code>messages</code>.',
    ep_get_calls_summary: 'Lista las llamadas del tenant que no han terminado (<code>status != "ended"</code>).', ep_get_calls_n1: "filtra por sesión",
    ep_post_calls_start_summary: "El admin inicia una llamada al cliente dentro de una sesión.", ep_post_calls_start_n1: "sí — id de sesión WebRTC de Cloudflare Realtime",
    ep_post_calls_accept_summary: 'El admin responde una llamada que está en <code>ringing</code>.',
    ep_post_calls_end_summary: "Rechaza (aún sin responder) o termina (en curso) una llamada.", ep_post_calls_end_n1: 'por defecto "declined" / "hangup"',
    sec_content_desc: "Crea/aprueba publicaciones sociales y de blog, consulta el estado del pipeline de publicación, y ejecuta manualmente los jobs en segundo plano (crawl de RSS, publish, agent).",
    ep_get_posts_summary: "Lista hasta las 50 publicaciones más recientes, con sus targets (canal + estado) y media.", ep_get_posts_n1: "solo publicaciones con al menos un target en este estado (pending/approved/scheduled/publishing/published/error)",
    ep_post_posts_summary: 'Crea una nueva publicación, generando automáticamente un target por cada canal conectado (por defecto facebook si se omite <code>platforms</code>).',
    ep_post_posts_n1: 'no — por defecto ["facebook"]', ep_post_posts_n2: 'true = crea el target ya "approved", saltando el paso de revisión',
    ep_post_posts_approve_summary: 'Aprueba todos los targets "pending" de una publicación. Se bloquea (409) si la publicación pertenece a un content-plan cuyas dependencias no están listas.',
    ep_post_content_cluster_summary: "Planifica y redacta en segundo plano (async) un clúster de varias entradas de blog SEO en torno a un tema, enlazadas entre sí.", ep_post_content_cluster_n1: "por defecto 5, máx. 8",
    ep_get_status_summary: "Cuenta las publicaciones por estado del pipeline (pending/approved/scheduled/publishing/published/error).",
    ep_post_trigger_summary: "Ejecuta manualmente (sin esperar al cron) el job de crawl de RSS + borrador, el job de publish de publicaciones aprobadas, o una pasada del agente de IA de operaciones para el tenant actual.",
    sec_knowledge_desc: "Documentos usados como contexto RAG para el chatbot (embebidos en Vectorize).",
    ep_get_knowledge_summary: "Lista hasta 100 documentos (id, title, char_count, created).",
    ep_post_knowledge_summary: 'Añade un nuevo documento, embebido automáticamente para búsqueda semántica (igual que el endpoint interno <code>/embed</code>, forzando el tenant correcto).',
    ep_delete_knowledge_summary: "Elimina un documento por id.", ep_post_knowledge_sync_summary: "Vuelve a sincronizar todas las fuentes de documentos configuradas (p. ej. Sanity/WordPress) para el tenant.",
    sec_schedules_desc: "Define reglas para publicar contenido automáticamente en ciertos días de la semana + franjas horarias, para contenido de blog o social.",
    ep_post_schedules_n1: 'array de "HH:MM"; cada hora = 1 publicación/día en esa franja', ep_post_schedules_n2: "mon..sun; vacío/omitido = todos los días",
    ep_patch_schedules_summary: "Actualiza parcialmente una programación (mismos campos que al crear, todos opcionales).",
    sec_loyalty_h2: 'Loyalty <span class="mono" style="font-weight:400;color:var(--fg-muted);font-size:0.8em;">/api/v1/loyalty/*</span>',
    sec_loyalty_desc: "Programa de fidelización, obtención/canje de puntos, campañas de ruleta (reward-world).",
    loy_n1: "lee la configuración del programa de fidelización del tenant", loy_n2: "crea/actualiza la configuración del programa", loy_n3: "registra una venta para acumular puntos", loy_n4: "canjea puntos por una recompensa", loy_n5: "consulta los puntos/nivel de un cliente", loy_n6: "lista las campañas de ruleta", loy_n7: "el cliente se une a una campaña", loy_n8: "realiza un giro", loy_n9: "lista las recompensas ganadas", loy_n10: "reclama una recompensa (activa el proveedor de fulfillment)",
    sec_loyalty_note: 'Este grupo aún no tiene botón "Probar API" — los payloads son complejos y varían según la campaña. Llámalo directamente con curl/Postman usando las rutas de arriba (usa el mismo <code>Authorization: Bearer &lt;api_key&gt;</code>).',
    sec_cp_desc: 'Planificación de contenido a largo plazo por tema, análisis de tendencias, generación + traducción de artículos, y un flujo de revisión/rechazo independiente para los content plans (distinto de aprobar una publicación individual en <code>/posts/:id/approve</code>).',
    sec_cp_note: 'Este grupo sirve principalmente al dashboard interno (composer.html) — los sistemas externos normalmente solo necesitan los grupos "Chat y clientes" y "Loyalty" de arriba. Este grupo aún no tiene botón "Probar API".',
    err_th_meaning: "Significado",
    err_400: 'Falta un campo obligatorio o los datos no son válidos — detalles en <code>error</code>', err_401: 'Falta o es inválido <code>Authorization: Bearer &lt;api_key&gt;</code>', err_403: "El registro existe pero pertenece a otro tenant", err_404: "Recurso no encontrado (id de post/session/call/schedule)", err_409: "Conflicto — p. ej. el slug del tenant ya está en uso, o una dependencia del content-plan no está lista", err_502: "Error al llamar a PocketBase o a un servicio backend interno",
    err_footer_p: 'Todos los errores devuelven JSON con la forma <code>{ "error": "..." }</code>.',
    qs_h2: "Ejemplo: notificar proactivamente a un cliente cuando su pedido está listo",
    qs_desc: 'Flujo típico para un sistema POS: genera un enlace de chat con el nombre del cliente cuando llega un pedido nuevo, guarda el <code>session</code>; cuando el pedido pasa a "Listo", llama a <code>/messages</code> para enviar un aviso a ese mismo chat. Puedes probarlo directamente con los dos botones "Probar API" en <a href="#post-chat-link">/chat-link</a> y <a href="#post-messages">/messages</a> más arriba (recuerda copiar el <code>session</code> devuelto en el paso 1 al paso 2).',
    footer_text: 'Knowledge Worker · apic.schoolsai.work — esta página se genera directamente a partir de las rutas reales en <code>src/index.js</code>, <code>src/api/loyalty.js</code>, <code>src/api/contentPlanning.js</code>. Si difiere del comportamiento real, corrige primero el código y luego actualiza esta página.',
    tt_try: "Probar API", tt_hide: "Ocultar formulario", tt_path: "(ruta)", tt_query: "(query, opcional)", tt_body: "Cuerpo (JSON)", tt_send: "Enviar solicitud →", tt_sending: "Enviando", tt_neterr: "Error de red:"
  },
  fr: {
    kb_label: "Clé API", kb_hint: 'Stockée uniquement dans votre navigateur (localStorage) — utilisée par tous les boutons « Envoyer la requête » de cette page.', kb_toggle_title: "Afficher/masquer la clé",
    nav_intro: "Introduction et authentification", nav_g_botconfig: "Bot et configuration", nav_g_chat: "Chat et clients", nav_g_calls: "Appels vocaux", nav_g_content: "Contenu et publications", nav_g_knowledge: "Base de connaissances", nav_g_schedules: "Planification des publications", nav_g_loyalty: "Fidélité et planification de contenu", nav_g_other: "Autres", nav_errors: "Codes d'erreur courants", nav_quickstart: "Exemple : notifier un client de façon proactive",
    main_lede: 'Référence de toute l\'API publique (<code>/api/v1/*</code>) de Knowledge Worker — pour les systèmes externes (caisse/POS, CRM, centre d\'appels...) qui intègrent le chatbot, les appels vocaux, la fidélité et la gestion de contenu par tenant. Chaque endpoint principal dispose d\'un bouton <strong>« Tester l\'API »</strong> pour l\'appeler réellement depuis cette page, sans Postman.',
    intro_h2: "URL de base et authentification", intro_th_format: "Format", intro_callout_title: "Où trouver une clé API ?",
    intro_callout_body: 'Chaque tenant possède sa propre <code>api_key</code> (générée lors de la création d\'un bot via <code>/api/onboarding/register</code> ou <code>POST /api/v1/bots</code>), consultable à nouveau dans la page de configuration du dashboard (config.html). Collez la clé dans le champ « Clé API » en haut de cette page pour utiliser les boutons « Tester l\'API » ci-dessous.',
    intro_p1: 'Transmettez toujours la clé API dans l\'en-tête <code>Authorization: Bearer sk_xxx</code>. Ne placez jamais de secret dans une URL ou une query string.',
    intro_p2: 'Chaque endpoint ci-dessous est automatiquement limité au <strong>tenant</strong> associé à la clé API — impossible de lire/écrire les données d\'un autre tenant.',
    fh_field: "Champ", fh_type: "Type", fh_required: "Obligatoire", fh_note: "Remarques", fh_query: "Query", fh_method: "Méthode", fh_path: "Chemin",
    common_yes: "oui", common_no: "non", badge_auth: "clé API requise",
    sec_botconfig_desc: "Créer de nouveaux bots, lire/écrire la configuration, ou laisser un assistant IA mettre à jour la configuration par conversation naturelle.",
    ep_post_bots_summary: "Crée un bot/tenant supplémentaire à partir d'un compte disposant déjà d'une clé API.",
    ep_post_bots_n1: "3-40 caractères : minuscules/chiffres/tiret/tiret bas", ep_post_bots_n2: "2-80 caractères", ep_post_bots_n3: "500 caractères max", ep_post_bots_n4: "10 000 caractères max",
    ep_post_bots_note: 'Renvoie 409 si le <code>tenant</code> existe déjà.',
    ep_get_config_summary: "Lit la configuration actuelle du bot (nom, couleur, webhook, system_prompt, model, temperature, chat id Telegram, Cloudinary, brand_logo_url...).",
    ep_patch_config_summary: "Met à jour une partie de la configuration — n'envoyez que les champs à modifier.", ep_patch_config_n1: "rogné automatiquement",
    ep_post_agent_chat_summary: "Chat en langage naturel avec l'assistant de configuration — le modèle appelle des outils pour enregistrer la configuration, connecter des canaux (Facebook/Instagram/Zalo/WordPress/Sanity...), ajouter des outils d'agent, planifier des publications, créer des chat-links, etc. au lieu d'appeler chaque API ci-dessous à la main.",
    ep_post_agent_chat_n1: 'oui — jusqu\'à 100 messages, le dernier doit avoir le role "user"',
    ep_get_agent_chat_tools_summary: 'Liste tous les outils que <code>/agent-chat</code> peut appeler (intégrés + outils personnalisés du tenant).',
    sec_chat_desc: "Chatbot pour le client final, liens de chat dédiés par client (pour SMS/Zalo/e-mail), envoi du contexte client, et envoi/lecture des messages de session — le groupe le plus utilisé par les systèmes externes (POS...).",
    ep_post_chat_summary: 'Envoie un message du client au chatbot IA et renvoie sa réponse (identique à l\'endpoint interne <code>/chat</code>, mais force le bon tenant selon la clé API).',
    ep_post_chat_link_summary: 'Génère un lien de chat dédié pré-rempli avec le nom du client + (en option) le contexte client — sans créer de tenant ni enregistrer de session au préalable, le widget <code>chat.html</code> les lit directement depuis l\'URL. À utiliser quand un système externe (ex. POS) veut envoyer au client un lien de chat par SMS/Zalo/e-mail.',
    ep_post_chat_link_n1: "nom affiché dans le chat", ep_post_chat_link_n2: "enregistre aussi le contexte client (commande, id client...) pour la session nouvellement créée",
    ep_put_customer_context_summary: "Écrit/met à jour le contexte client (commande, statut, notes...) pour une session existante — afin que le chatbot IA dispose de vraies données pour répondre, sans que le client ait à les répéter.",
    ep_put_customer_context_n1: "oui — un objet plat, pas un tableau",
    ep_get_messages_summary: "Récupère l'historique des messages du tenant (jusqu'à 100, les plus récents en premier).", ep_get_messages_n1: "filtre sur une session précise (omis = tout le tenant)",
    ep_post_messages_summary: '<strong>Envoie un message de façon proactive</strong> dans une session existante — utilisé par les systèmes externes (POS, CRM...) pour notifier proactivement un client dans son chat actuellement ouvert (ex. « votre commande est prête »). Marque automatiquement tout message <code>needs_human</code> en attente de cette session comme <code>escalation_resolved</code>.',
    ep_post_messages_n1: '≤ 200 caractères — doit être une session ayant déjà au moins un message (créée via <code>/chat-link</code> ou le client a déjà discuté une fois)', ep_post_messages_n2: "≤ 10 000 caractères",
    ep_post_messages_note: 'Si vous n\'êtes pas sûr que la session existe encore, appelez d\'abord <code>GET /api/v1/messages?session=...</code> pour vérifier, ou créez la session avec <code>POST /api/v1/chat-link</code> dès le départ (le serveur enregistre automatiquement <code>customer_context</code> s\'il est fourni).',
    sec_calls_desc: 'Gère les appels vocaux admin ↔ client via Cloudflare Realtime (SFU). Le statut ringing/active/ended est synchronisé en temps réel des deux côtés via PocketBase, le même mécanisme que <code>messages</code>.',
    ep_get_calls_summary: 'Liste les appels du tenant qui ne sont pas terminés (<code>status != "ended"</code>).', ep_get_calls_n1: "filtre par session",
    ep_post_calls_start_summary: "L'admin démarre un appel vers un client dans une session.", ep_post_calls_start_n1: "oui — id de session WebRTC provenant de Cloudflare Realtime",
    ep_post_calls_accept_summary: 'L\'admin répond à un appel actuellement <code>ringing</code>.',
    ep_post_calls_end_summary: "Refuse (pas encore décroché) ou termine (en cours) un appel.", ep_post_calls_end_n1: 'par défaut "declined" / "hangup"',
    sec_content_desc: "Créer/approuver des publications social & blog, consulter l'état du pipeline de publication, et exécuter manuellement les jobs en arrière-plan (crawl RSS, publish, agent).",
    ep_get_posts_summary: "Liste jusqu'aux 50 publications les plus récentes, avec les targets (canal + statut) et les médias.", ep_get_posts_n1: "seulement les publications ayant au moins un target dans ce statut (pending/approved/scheduled/publishing/published/error)",
    ep_post_posts_summary: 'Crée une nouvelle publication, en créant automatiquement un target pour chaque canal connecté (facebook par défaut si <code>platforms</code> est omis).',
    ep_post_posts_n1: 'non — par défaut ["facebook"]', ep_post_posts_n2: 'true = crée le target déjà « approved », en sautant l\'étape de validation',
    ep_post_posts_approve_summary: 'Approuve tous les targets « pending » d\'une publication. Bloqué (409) si la publication appartient à un content-plan dont les dépendances ne sont pas prêtes.',
    ep_post_content_cluster_summary: "Planifie et rédige en arrière-plan (async) un cluster de plusieurs articles de blog SEO autour d'un thème, reliés entre eux.", ep_post_content_cluster_n1: "5 par défaut, 8 max",
    ep_get_status_summary: "Compte les publications par statut de pipeline (pending/approved/scheduled/publishing/published/error).",
    ep_post_trigger_summary: "Exécute manuellement (sans attendre le cron) le job de crawl RSS + brouillon, le job de publish des publications approuvées, ou une passe de l'agent IA d'exploitation pour le tenant courant.",
    sec_knowledge_desc: "Documents utilisés comme contexte RAG pour le chatbot (intégrés dans Vectorize).",
    ep_get_knowledge_summary: "Liste jusqu'à 100 documents (id, title, char_count, created).",
    ep_post_knowledge_summary: 'Ajoute un nouveau document, automatiquement vectorisé pour la recherche sémantique (identique à l\'endpoint interne <code>/embed</code>, tenant forcé).',
    ep_delete_knowledge_summary: "Supprime un document par id.", ep_post_knowledge_sync_summary: "Resynchronise toutes les sources de documents configurées (ex. Sanity/WordPress) pour le tenant.",
    sec_schedules_desc: "Définit des règles de publication automatique de contenu selon des jours de la semaine + créneaux horaires, pour du contenu blog ou social.",
    ep_post_schedules_n1: 'tableau de "HH:MM", chaque heure = 1 publication/jour appliquée', ep_post_schedules_n2: "mon..sun ; vide/omis = tous les jours",
    ep_patch_schedules_summary: "Met à jour partiellement une planification (mêmes champs qu'à la création, tous facultatifs).",
    sec_loyalty_h2: 'Loyalty <span class="mono" style="font-weight:400;color:var(--fg-muted);font-size:0.8em;">/api/v1/loyalty/*</span>',
    sec_loyalty_desc: "Programme de fidélité, gain/échange de points, campagnes de roue de la fortune (reward-world).",
    loy_n1: "lit la configuration du programme de fidélité du tenant", loy_n2: "crée/met à jour la configuration du programme", loy_n3: "enregistre une vente pour gagner des points", loy_n4: "échange des points contre une récompense", loy_n5: "consulte les points/le niveau d'un client", loy_n6: "liste les campagnes de roue de la fortune", loy_n7: "le client rejoint une campagne", loy_n8: "effectue un tour de roue", loy_n9: "liste les récompenses gagnées", loy_n10: "réclame une récompense (déclenche le fournisseur de fulfillment)",
    sec_loyalty_note: 'Ce groupe n\'a pas encore de bouton « Tester l\'API » — les payloads sont complexes et varient selon la campagne. Appelez directement en curl/Postman avec les chemins ci-dessus (même <code>Authorization: Bearer &lt;api_key&gt;</code>).',
    sec_cp_desc: 'Planification de contenu à long terme par thème, analyse des tendances, génération + traduction d\'articles, et un flux de validation/rejet distinct pour les content plans (différent de l\'approbation d\'une publication unique via <code>/posts/:id/approve</code>).',
    sec_cp_note: 'Ce groupe sert principalement le dashboard interne (composer.html) — les systèmes externes n\'ont généralement besoin que des groupes « Chat et clients » et « Loyalty » ci-dessus. Pas encore de bouton « Tester l\'API » pour ce groupe.',
    err_th_meaning: "Signification",
    err_400: 'Champ obligatoire manquant ou données invalides — détails dans <code>error</code>', err_401: '<code>Authorization: Bearer &lt;api_key&gt;</code> manquant/invalide', err_403: "L'enregistrement existe mais appartient à un autre tenant", err_404: "Ressource introuvable (id de post/session/call/schedule)", err_409: "Conflit — ex. slug de tenant déjà utilisé, ou dépendance de content-plan non prête", err_502: "Erreur lors de l'appel à PocketBase ou à un service backend interne",
    err_footer_p: 'Chaque erreur renvoie un JSON de la forme <code>{ "error": "..." }</code>.',
    qs_h2: "Exemple : notifier un client de façon proactive quand sa commande est prête",
    qs_desc: 'Flux typique pour un système POS : générer un lien de chat avec le nom du client à l\'arrivée d\'une nouvelle commande, enregistrer le <code>session</code> ; quand la commande passe au statut « Prête », appeler <code>/messages</code> pour envoyer une notification dans ce même chat. Testez directement avec les deux boutons « Tester l\'API » sous <a href="#post-chat-link">/chat-link</a> et <a href="#post-messages">/messages</a> ci-dessus (pensez à copier le <code>session</code> renvoyé à l\'étape 1 dans l\'étape 2).',
    footer_text: 'Knowledge Worker · apic.schoolsai.work — cette page est générée directement à partir des routes réelles dans <code>src/index.js</code>, <code>src/api/loyalty.js</code>, <code>src/api/contentPlanning.js</code>. En cas d\'écart avec le comportement réel, corrigez d\'abord le code puis mettez à jour cette page.',
    tt_try: "Tester l'API", tt_hide: "Masquer le formulaire", tt_path: "(chemin)", tt_query: "(query, optionnel)", tt_body: "Corps (JSON)", tt_send: "Envoyer la requête →", tt_sending: "Envoi en cours", tt_neterr: "Erreur réseau :"
  },
  ko: {
    kb_label: "API 키", kb_hint: "이 브라우저(localStorage)에만 저장됩니다 — 이 페이지의 모든 \"요청 보내기\" 버튼에서 사용됩니다.", kb_toggle_title: "키 표시/숨기기",
    nav_intro: "소개 및 인증", nav_g_botconfig: "봇 및 설정", nav_g_chat: "채팅 및 고객", nav_g_calls: "음성 통화", nav_g_content: "콘텐츠 및 게시", nav_g_knowledge: "지식 베이스", nav_g_schedules: "자동 게시 일정", nav_g_loyalty: "로열티 및 콘텐츠 기획", nav_g_other: "기타", nav_errors: "공통 오류 코드", nav_quickstart: "예시: 고객에게 능동적으로 메시지 보내기",
    main_lede: 'Knowledge Worker의 전체 공개 API(<code>/api/v1/*</code>) 레퍼런스입니다 — 외부 시스템(POS, CRM, 콜센터 등)이 테넌트별로 챗봇, 음성 통화, 로열티, 콘텐츠 관리를 연동할 때 사용합니다. 주요 엔드포인트마다 <strong>"API 테스트"</strong> 버튼이 있어 Postman 없이도 페이지에서 바로 실제 호출을 해볼 수 있습니다.',
    intro_h2: "기본 URL 및 인증", intro_th_format: "형식", intro_callout_title: "API 키는 어디서 받나요?",
    intro_callout_body: '각 테넌트는 고유한 <code>api_key</code>를 가집니다(<code>/api/onboarding/register</code> 또는 <code>POST /api/v1/bots</code>로 봇 생성 시 발급). 대시보드 설정 페이지(config.html)에서 다시 확인할 수 있습니다. 이 페이지 상단의 "API 키" 입력란에 붙여넣으면 아래의 "API 테스트" 버튼을 사용할 수 있습니다.',
    intro_p1: 'API 키는 항상 <code>Authorization: Bearer sk_xxx</code> 헤더로 전송하세요. URL이나 쿼리 문자열에 비밀값을 넣지 마세요.',
    intro_p2: '아래의 모든 엔드포인트는 API 키에 연결된 <strong>테넌트</strong>로 자동 제한됩니다 — 다른 테넌트의 데이터를 읽거나 쓸 방법은 없습니다.',
    fh_field: "필드", fh_type: "타입", fh_required: "필수", fh_note: "비고", fh_query: "쿼리", fh_method: "메서드", fh_path: "경로",
    common_yes: "예", common_no: "아니요", badge_auth: "API 키 필요",
    sec_botconfig_desc: "새 봇을 생성하고, 설정을 읽고/쓰거나, AI 어시스턴트가 자연스러운 대화로 설정을 업데이트하게 합니다.",
    ep_post_bots_summary: "이미 API 키가 있는 계정에서 봇/테넌트를 하나 더 생성합니다.",
    ep_post_bots_n1: "3-40자: 소문자/숫자/하이픈/언더스코어", ep_post_bots_n2: "2-80자", ep_post_bots_n3: "최대 500자", ep_post_bots_n4: "최대 10,000자",
    ep_post_bots_note: '<code>tenant</code>가 이미 존재하면 409를 반환합니다.',
    ep_get_config_summary: "봇의 현재 설정(이름, 색상, webhook, system_prompt, model, temperature, 텔레그램 chat id, Cloudinary, brand_logo_url 등)을 조회합니다.",
    ep_patch_config_summary: "설정의 일부를 업데이트합니다 — 변경하려는 필드만 보내세요.", ep_patch_config_n1: "자동 트림",
    ep_post_agent_chat_summary: "설정 어시스턴트와의 자연어 채팅입니다 — 모델이 도구를 호출해 설정을 저장하고, 채널(Facebook/Instagram/Zalo/WordPress/Sanity 등)을 연결하고, 에이전트 도구를 추가하고, 게시 일정을 잡고, chat-link를 생성하는 등 아래의 각 API를 직접 호출하는 대신 사용할 수 있습니다.",
    ep_post_agent_chat_n1: '예 — 최대 100개 메시지, 마지막 메시지는 role이 "user"여야 함',
    ep_get_agent_chat_tools_summary: '<code>/agent-chat</code>이 호출할 수 있는 모든 도구(기본 제공 + 테넌트의 커스텀 도구)를 나열합니다.',
    sec_chat_desc: "최종 고객용 챗봇, 고객별 전용 채팅 링크(SMS/Zalo/이메일용), 고객 컨텍스트 전송, 세션 메시지 전송/조회 — 외부 시스템(POS 등)이 가장 많이 사용하는 그룹입니다.",
    ep_post_chat_summary: '고객의 메시지 1건을 AI 챗봇에 보내고 응답을 받습니다(내부 <code>/chat</code> 엔드포인트와 동일하지만, API 키로 올바른 테넌트를 강제합니다).',
    ep_post_chat_link_summary: '고객 이름 + (선택적으로) 고객 컨텍스트가 미리 채워진 전용 채팅 링크를 생성합니다 — 테넌트를 만들거나 세션을 미리 기록할 필요가 없으며, <code>chat.html</code> 위젯이 URL에서 직접 읽어옵니다. 외부 시스템(예: POS)이 SMS/Zalo/이메일로 고객에게 채팅 링크를 보내고 싶을 때 사용합니다.',
    ep_post_chat_link_n1: "채팅에 표시될 이름", ep_post_chat_link_n2: "새로 생성된 세션에 고객 컨텍스트(주문, 고객 ID 등)도 함께 저장",
    ep_put_customer_context_summary: "기존 세션에 대한 고객 컨텍스트(주문, 상태, 메모 등)를 기록/업데이트합니다 — 고객이 다시 말하지 않아도 AI 챗봇이 응답 시 실제 데이터를 사용할 수 있도록 합니다.",
    ep_put_customer_context_n1: "예 — 배열이 아닌 평평한(flat) 객체",
    ep_get_messages_summary: "테넌트의 메시지 기록을 가져옵니다(최대 100개, 최신순).", ep_get_messages_n1: "특정 세션으로 필터링(생략 시 = 테넌트 전체)",
    ep_post_messages_summary: '기존 세션에 <strong>능동적으로 메시지를 전송</strong>합니다 — 외부 시스템(POS, CRM 등)이 현재 열려 있는 채팅에 고객에게 능동적으로 알릴 때 사용합니다(예: "주문이 완료되었습니다"). 해당 세션의 대기 중인 <code>needs_human</code> 메시지를 자동으로 <code>escalation_resolved</code>로 표시합니다.',
    ep_post_messages_n1: '200자 이하 — 이미 메시지가 하나 이상 있는 세션이어야 함(<code>/chat-link</code>로 생성했거나 고객이 한 번 채팅한 경우)', ep_post_messages_n2: "10,000자 이하",
    ep_post_messages_note: '세션이 아직 존재하는지 확실하지 않다면 먼저 <code>GET /api/v1/messages?session=...</code>로 확인하거나, 처음부터 <code>POST /api/v1/chat-link</code>로 세션을 생성하세요(<code>customer_context</code>가 있으면 서버가 자동으로 저장합니다).',
    sec_calls_desc: 'Cloudflare Realtime(SFU)을 통해 관리자↔고객 음성 통화를 관리합니다. ringing/active/ended 상태는 <code>messages</code>와 동일한 방식으로 PocketBase를 통해 양쪽에 실시간 동기화됩니다.',
    ep_get_calls_summary: '테넌트의 종료되지 않은(<code>status != "ended"</code>) 통화를 나열합니다.', ep_get_calls_n1: "세션으로 필터링",
    ep_post_calls_start_summary: "관리자가 세션 내에서 고객에게 통화를 시작합니다.", ep_post_calls_start_n1: "예 — Cloudflare Realtime의 WebRTC 세션 ID",
    ep_post_calls_accept_summary: '현재 <code>ringing</code> 중인 통화에 관리자가 응답합니다.',
    ep_post_calls_end_summary: "통화를 거절(아직 응답 전)하거나 종료(진행 중)합니다.", ep_post_calls_end_n1: '기본값 "declined" / "hangup"',
    sec_content_desc: "소셜 및 블로그 게시물 생성/승인, 게시 파이프라인 상태 확인, 백그라운드 작업(RSS 크롤링, publish, agent) 수동 실행.",
    ep_get_posts_summary: "최근 최대 50개 게시물을 targets(채널 + 상태)와 미디어와 함께 나열합니다.", ep_get_posts_n1: "이 상태(pending/approved/scheduled/publishing/published/error)의 target을 하나 이상 가진 게시물만",
    ep_post_posts_summary: '새 게시물을 생성하고, 연결된 각 채널에 대해 target을 자동 생성합니다(<code>platforms</code>를 생략하면 기본값은 facebook).',
    ep_post_posts_n1: '아니요 — 기본값 ["facebook"]', ep_post_posts_n2: 'true = 검토 단계를 건너뛰고 target을 바로 "approved" 상태로 생성',
    ep_post_posts_approve_summary: '게시물 1건의 "pending" 상태 target을 모두 승인합니다. 게시물이 content-plan에 속하고 의존성이 준비되지 않은 경우 차단됩니다(409).',
    ep_post_content_cluster_summary: "하나의 주제를 중심으로 상호 링크된 여러 개의 SEO 블로그 게시물 클러스터를 백그라운드(비동기)로 기획하고 작성합니다.", ep_post_content_cluster_n1: "기본값 5, 최대 8",
    ep_get_status_summary: "파이프라인 상태(pending/approved/scheduled/publishing/published/error)별 게시물 수를 집계합니다.",
    ep_post_trigger_summary: "cron을 기다리지 않고 RSS 크롤링 + 초안 작성 작업, 승인된 게시물 publish 작업, 또는 현재 테넌트의 AI 운영 에이전트 1회 실행을 수동으로 실행합니다.",
    sec_knowledge_desc: "챗봇의 RAG 컨텍스트로 사용되는 문서(Vectorize에 임베딩).",
    ep_get_knowledge_summary: "최대 100개 문서(id, title, char_count, created)를 나열합니다.",
    ep_post_knowledge_summary: '새 문서를 추가하고 시맨틱 검색을 위해 자동으로 임베딩합니다(내부 <code>/embed</code> 엔드포인트와 동일하며 테넌트를 강제 적용).',
    ep_delete_knowledge_summary: "id로 문서 1건을 삭제합니다.", ep_post_knowledge_sync_summary: "설정된 모든 문서 소스(예: Sanity/WordPress)를 테넌트에 대해 다시 동기화합니다.",
    sec_schedules_desc: "블로그 또는 소셜 콘텐츠에 대해 요일 + 시간대를 지정한 자동 게시 규칙을 설정합니다.",
    ep_post_schedules_n1: '"HH:MM" 배열, 각 시간 = 해당 시간대에 하루 1개 게시물 적용', ep_post_schedules_n2: "mon..sun; 비어 있거나 생략 시 = 매일 적용",
    ep_patch_schedules_summary: "일정을 부분 업데이트합니다(생성 시와 동일한 필드, 모두 선택 사항).",
    sec_loyalty_h2: 'Loyalty <span class="mono" style="font-weight:400;color:var(--fg-muted);font-size:0.8em;">/api/v1/loyalty/*</span>',
    sec_loyalty_desc: "로열티 프로그램, 포인트 적립/교환, 룰렛 캠페인(reward-world).",
    loy_n1: "테넌트의 로열티 프로그램 설정 조회", loy_n2: "프로그램 설정 생성/업데이트", loy_n3: "판매 1건을 기록하여 포인트 적립", loy_n4: "포인트를 혜택으로 교환", loy_n5: "고객의 포인트/등급 조회", loy_n6: "룰렛 캠페인 목록", loy_n7: "고객이 캠페인에 참여", loy_n8: "룰렛 1회 실행", loy_n9: "획득한 경품 목록", loy_n10: "경품 수령(fulfillment 제공업체 실행)",
    sec_loyalty_note: '이 그룹에는 아직 "API 테스트" 버튼이 없습니다 — payload가 복잡하고 캠페인마다 다르기 때문입니다. 위의 경로로 curl/Postman을 통해 직접 호출하세요(동일한 <code>Authorization: Bearer &lt;api_key&gt;</code> 사용).',
    sec_cp_desc: '주제별 장기 콘텐츠 기획, 트렌드 분석, 글 생성 + 번역, content plan 전용 검토/반려 흐름(<code>/posts/:id/approve</code>에서의 개별 게시물 승인과는 다름).',
    sec_cp_note: '이 그룹은 주로 내부 대시보드(composer.html)용입니다 — 외부 시스템은 보통 위의 "채팅 및 고객"과 "Loyalty" 그룹만 필요합니다. 이 그룹에는 아직 "API 테스트" 버튼이 없습니다.',
    err_th_meaning: "의미",
    err_400: '필수 필드 누락 또는 잘못된 데이터 — 자세한 내용은 <code>error</code> 참조', err_401: '<code>Authorization: Bearer &lt;api_key&gt;</code> 누락/오류', err_403: "레코드는 존재하지만 다른 테넌트에 속함", err_404: "리소스를 찾을 수 없음(post/session/call/schedule id)", err_409: "충돌 — 예: 테넌트 slug가 이미 사용 중이거나 content-plan 의존성이 준비되지 않음", err_502: "PocketBase/내부 백엔드 서비스 호출 중 오류",
    err_footer_p: '모든 오류는 <code>{ "error": "..." }</code> 형태의 JSON을 반환합니다.',
    qs_h2: "예시: 주문이 완료되었을 때 고객에게 능동적으로 알리기",
    qs_desc: '전형적인 POS 흐름: 새 주문이 들어오면 고객 이름이 담긴 채팅 링크를 생성하고 <code>session</code>을 저장합니다. 주문 상태가 "완료"로 바뀌면 <code>/messages</code>를 호출해 동일한 채팅으로 알림을 보냅니다. 위의 <a href="#post-chat-link">/chat-link</a>와 <a href="#post-messages">/messages</a>에 있는 두 개의 "API 테스트" 버튼으로 바로 시도해볼 수 있습니다(1단계에서 반환된 <code>session</code>을 2단계에 복사하는 것을 잊지 마세요).',
    footer_text: 'Knowledge Worker · apic.schoolsai.work — 이 페이지는 <code>src/index.js</code>, <code>src/api/loyalty.js</code>, <code>src/api/contentPlanning.js</code>의 실제 라우트로부터 직접 생성됩니다. 실제 동작과 다르면 코드를 먼저 수정한 뒤 이 페이지를 업데이트하세요.',
    tt_try: "API 테스트", tt_hide: "폼 숨기기", tt_path: "(경로)", tt_query: "(쿼리, 선택)", tt_body: "본문 (JSON)", tt_send: "요청 보내기 →", tt_sending: "전송 중", tt_neterr: "네트워크 오류:"
  }
};
var SUPPORTED_LANGS = ["vi", "en", "ja", "es", "fr", "ko"];

function getLang() {
  var saved = localStorage.getItem("lang") || "vi";
  return SUPPORTED_LANGS.indexOf(saved) !== -1 ? saved : "vi";
}
function t(key) {
  var lang = getLang();
  return (I18N_DICT[lang] && I18N_DICT[lang][key]) || (I18N_DICT.vi && I18N_DICT.vi[key]) || key;
}
function applyI18n() {
  var lang = getLang();
  document.documentElement.lang = lang;
  var sel = document.getElementById("lang-select");
  if (sel) sel.value = lang;
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
  document.querySelectorAll(".tryit-toggle").forEach(function (btn) {
    var body = document.getElementById(btn.dataset.target);
    btn.textContent = body && body.classList.contains("open") ? t("tt_hide") : t("tt_try");
  });
}
function setLang(lang) {
  if (SUPPORTED_LANGS.indexOf(lang) === -1) return;
  localStorage.setItem("lang", lang);
  applyI18n();
}

(function () {
  var KEY_STORAGE = "kw_api_key";
  var keyInput = document.getElementById("api-key-input");
  var toggleVis = document.getElementById("toggle-key-vis");
  keyInput.value = localStorage.getItem(KEY_STORAGE) || "";
  keyInput.addEventListener("input", function () {
    localStorage.setItem(KEY_STORAGE, keyInput.value);
  });
  toggleVis.addEventListener("click", function () {
    keyInput.type = keyInput.type === "password" ? "text" : "password";
  });

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  document.querySelectorAll(".tryit").forEach(function (box) {
    var method = box.dataset.method;
    var pathTpl = box.dataset.path;
    var queryNames = [];
    try { queryNames = JSON.parse(box.dataset.query || "[]"); } catch (e) {}
    var bodyExample = box.dataset.body || "";
    var hasBody = method !== "GET" && method !== "DELETE" && bodyExample;
    var pathParams = [];
    var re = /:([a-zA-Z_]+)/g, m;
    while ((m = re.exec(pathTpl))) pathParams.push(m[1]);

    var toggleId = "tt-" + Math.random().toString(36).slice(2);
    var html = '<button type="button" class="tryit-toggle" data-target="' + toggleId + '" data-i18n="tt_try">Thử API</button>';
    html += '<div class="tryit-body" id="' + toggleId + '">';

    pathParams.forEach(function (p) {
      html += '<div class="tryit-row"><label>' + escapeHtml(p) + ' <span data-i18n="tt_path">(path)</span></label>' +
        '<input type="text" data-param="' + escapeHtml(p) + '" placeholder="' + escapeHtml(p) + '" /></div>';
    });
    queryNames.forEach(function (q) {
      html += '<div class="tryit-row"><label>' + escapeHtml(q) + ' <span data-i18n="tt_query">(query, tuỳ chọn)</span></label>' +
        '<input type="text" data-query="' + escapeHtml(q) + '" placeholder="' + escapeHtml(q) + '" /></div>';
    });
    if (hasBody) {
      html += '<div class="tryit-row"><label data-i18n="tt_body">Body (JSON)</label>' +
        '<textarea data-body>' + escapeHtml(bodyExample) + '</textarea></div>';
    }
    html += '<button type="button" class="send-btn"><span data-i18n="tt_send">Gửi request &rarr;</span></button>';
    html += '<pre class="tryit-result" hidden></pre>';
    html += "</div>";
    box.innerHTML = html;

    var toggleBtn = box.querySelector(".tryit-toggle");
    var body = box.querySelector(".tryit-body");
    toggleBtn.addEventListener("click", function () {
      body.classList.toggle("open");
      toggleBtn.textContent = body.classList.contains("open") ? t("tt_hide") : t("tt_try");
    });

    var sendBtn = box.querySelector(".send-btn");
    sendBtn.addEventListener("click", function () {
      var apiKey = keyInput.value.trim();
      var path = pathTpl;
      box.querySelectorAll("[data-param]").forEach(function (inp) {
        path = path.replace(":" + inp.dataset.param, encodeURIComponent(inp.value || ""));
      });
      var qs = [];
      box.querySelectorAll("[data-query]").forEach(function (inp) {
        if (inp.value) qs.push(encodeURIComponent(inp.dataset.query) + "=" + encodeURIComponent(inp.value));
      });
      var url = path + (qs.length ? "?" + qs.join("&") : "");
      var opts = { method: method, headers: {} };
      if (apiKey) opts.headers["Authorization"] = "Bearer " + apiKey;
      if (hasBody) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = box.querySelector("[data-body]").value;
      }
      var resultEl = box.querySelector(".tryit-result");
      resultEl.hidden = false;
      resultEl.className = "tryit-result";
      resultEl.textContent = t("tt_sending") + " " + method + " " + url + " ...";
      sendBtn.disabled = true;
      fetch(url, opts)
        .then(function (res) {
          return res.text().then(function (text) {
            var pretty = text;
            try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) {}
            resultEl.classList.add(res.ok ? "status-ok" : "status-err");
            resultEl.textContent = "HTTP " + res.status + "\n\n" + pretty;
          });
        })
        .catch(function (err) {
          resultEl.classList.add("status-err");
          resultEl.textContent = t("tt_neterr") + " " + err.message;
        })
        .finally(function () {
          sendBtn.disabled = false;
        });
    });
  });

  applyI18n();
})();
</script>
</body>
</html>
`;
