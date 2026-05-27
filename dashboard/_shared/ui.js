/**
 * _shared/ui.js
 * Utility functions dùng chung toàn dashboard
 *
 * Functions:
 *   escHtml(str)            — escape HTML để tránh XSS
 *   formatTime(iso)         — format ISO date → "dd/mm hh:mm"
 *   showToast(msg, type)    — toast notification (success | error)
 *   showLoading(elId)       — hiện spinner trong element
 *   hideLoading(elId, html) — ẩn spinner, thay bằng content
 *   confirm2(msg)           — confirm dialog (trả về Promise<boolean>)
 */

// ─────────────────────────────────────────
// HTML ESCAPE
// ─────────────────────────────────────────

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────
// FORMAT TIME
// ─────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────

let _toastTimer;

function showToast(msg, type = "success") {
  let el = document.getElementById("toast");

  // Tạo toast element nếu chưa có trong DOM
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }

  el.textContent = msg;
  el.className = `toast ${type} show`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3000);
}

// ─────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────

function showLoading(elId, msg = "Đang tải...") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      ${escHtml(msg)}
    </div>
  `;
}

function hideLoading(elId, html) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = html;
}

function showEmpty(elId, msg = "Chưa có dữ liệu") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `<div class="loading-state" style="color:var(--text3)">${escHtml(msg)}</div>`;
}

// ─────────────────────────────────────────
// BUTTON LOADING STATE
// ─────────────────────────────────────────

function btnLoading(btnId, msg = "Đang xử lý...") {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn._originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> ${escHtml(msg)}`;
}

function btnReset(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = false;
  if (btn._originalHTML) btn.innerHTML = btn._originalHTML;
}

// ─────────────────────────────────────────
// INJECT TOPBAR + SIDEBAR (dùng chung)
// Gọi renderShell() trước requireAuth()
// ─────────────────────────────────────────

function renderShell(activePage) {
  // Inject CSS variables + base styles nếu chưa có
  const shell = document.getElementById("shell");
  if (!shell) return;

  shell.innerHTML = `
    <div class="topbar">
      <div class="topbar-logo">
        <div class="dot">🤖</div>
        Bot Dashboard
      </div>
      <div class="tenant-badge" id="tenant-badge">—</div>
      <div class="user-info">
        <div class="user-avatar">
          <img id="user-photo" src="" alt="" onerror="this.style.display='none'"/>
        </div>
        <span id="user-name-display"></span>
      </div>
      <button class="btn-logout" onclick="logout()">
        <span class="material-symbols-rounded" style="font-size:14px">logout</span>
        Đăng xuất
      </button>
    </div>

    <div class="main">
      <nav class="sidebar">
        <a class="nav-item ${activePage === 'messages'  ? 'active' : ''}" href="messages.html"  data-page="messages">
          <span class="material-symbols-rounded">chat</span>
          Tin nhắn
        </a>
        <a class="nav-item ${activePage === 'leads'     ? 'active' : ''}" href="leads.html"     data-page="leads">
          <span class="material-symbols-rounded">people</span>
          Khách hàng
        </a>
        <div class="nav-divider"></div>
        <a class="nav-item ${activePage === 'knowledge' ? 'active' : ''}" href="knowledge.html" data-page="knowledge">
          <span class="material-symbols-rounded">auto_stories</span>
          Knowledge
        </a>
        <a class="nav-item ${activePage === 'config'    ? 'active' : ''}" href="config.html"    data-page="config">
          <span class="material-symbols-rounded">tune</span>
          Cài đặt Bot
        </a>
      </nav>

      <div class="content" id="content">
        <!-- page content injected here -->
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────
// SHARED CSS — inject vào <head> nếu chưa có file css riêng
// ─────────────────────────────────────────

function injectBaseStyles() {
  if (document.getElementById("base-styles")) return;

  const style = document.createElement("style");
  style.id = "base-styles";
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0a0a0f;
      --surface: #111118;
      --surface2: #18181f;
      --surface3: #1e1e28;
      --border: #2a2a38;
      --border2: #333345;
      --text: #e8e8f0;
      --text2: #9090a8;
      --text3: #5a5a72;
      --accent: #6c63ff;
      --accent2: #8b85ff;
      --accent-glow: rgba(108,99,255,0.15);
      --green: #34d399;
      --red: #f87171;
      --yellow: #fbbf24;
      --radius: 12px;
      --radius2: 8px;
    }

    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; display: flex; flex-direction: column; }

    /* TOPBAR */
    .topbar { height: 56px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 20px; gap: 16px; flex-shrink: 0; }
    .topbar-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; }
    .topbar-logo .dot { width: 28px; height: 28px; background: linear-gradient(135deg, var(--accent), #a78bfa); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
    .tenant-badge { margin-left: auto; background: var(--accent-glow); border: 1px solid var(--accent); color: var(--accent2); font-size: 12px; font-family: 'DM Mono', monospace; padding: 4px 10px; border-radius: 20px; }
    .user-info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text2); }
    .user-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--surface3); border: 1px solid var(--border2); overflow: hidden; }
    .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .btn-logout { padding: 6px 12px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius2); color: var(--text3); font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; display: flex; align-items: center; gap: 4px; }
    .btn-logout:hover { color: var(--red); border-color: var(--red); }

    /* LAYOUT */
    .main { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 220px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 16px 12px; gap: 4px; flex-shrink: 0; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius2); color: var(--text2); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; text-decoration: none; }
    .nav-item:hover { background: var(--surface2); color: var(--text); }
    .nav-item.active { background: var(--accent-glow); color: var(--accent2); border-color: rgba(108,99,255,0.2); }
    .nav-item .material-symbols-rounded { font-size: 18px; font-variation-settings: 'FILL' 0, 'wght' 300; }
    .nav-item.active .material-symbols-rounded { font-variation-settings: 'FILL' 1, 'wght' 400; }
    .nav-divider { height: 1px; background: var(--border); margin: 8px 0; }
    .content { flex: 1; overflow-y: auto; padding: 24px; }
    .content::-webkit-scrollbar { width: 4px; }
    .content::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

    /* PAGE */
    .page-header { margin-bottom: 24px; }
    .page-header h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .page-header p { color: var(--text2); font-size: 13px; }

    /* CARDS */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
    .card-title { font-size: 13px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .card-title .material-symbols-rounded { font-size: 16px; }

    /* STATS */
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
    .stat-label { font-size: 12px; color: var(--text3); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .stat-value { font-size: 28px; font-weight: 700; font-family: 'DM Mono', monospace; }
    .stat-sub { font-size: 12px; color: var(--text3); margin-top: 4px; }

    /* FORMS */
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 12px; font-weight: 500; color: var(--text2); margin-bottom: 6px; }
    .form-input { width: 100%; padding: 10px 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius2); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .form-input:focus { border-color: var(--accent); }
    .form-input::placeholder { color: var(--text3); }
    .form-input[type="color"] { padding: 6px; height: 40px; cursor: pointer; }
    textarea.form-input { resize: vertical; min-height: 80px; font-family: 'DM Mono', monospace; font-size: 12px; }

    /* BUTTONS */
    .btn-primary { padding: 10px 20px; background: var(--accent); border: none; border-radius: var(--radius2); color: white; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary:hover { background: var(--accent2); box-shadow: 0 4px 20px var(--accent-glow); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-danger { padding: 8px 14px; background: transparent; border: 1px solid rgba(248,113,113,0.3); border-radius: var(--radius2); color: var(--red); font-family: 'DM Sans', sans-serif; font-size: 12px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-danger:hover { background: rgba(248,113,113,0.1); }

    /* BADGE */
    .badge { display: inline-flex; padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; font-family: 'DM Mono', monospace; }
    .badge-green { background: rgba(52,211,153,0.1); color: var(--green); }
    .badge-yellow { background: rgba(251,191,36,0.1); color: var(--yellow); }

    /* TOAST */
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: var(--radius); font-size: 14px; font-weight: 500; z-index: 999; transform: translateY(80px); opacity: 0; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; gap: 10px; }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.success { background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.3); color: var(--green); }
    .toast.error { background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.3); color: var(--red); }

    /* SPINNER */
    .spinner { width: 16px; height: 16px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-state { display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text3); gap: 10px; font-size: 13px; }

    /* TABLES */
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
    .data-table td { padding: 12px 14px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: top; }
    .data-table tr:hover td { background: var(--surface2); }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .stats-row { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}