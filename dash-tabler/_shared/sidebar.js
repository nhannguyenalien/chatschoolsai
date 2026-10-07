/**
 * _shared/sidebar.js
 * Tabler sidebar — dùng chung cho mọi trang
 * Gọi: renderSidebar() sau khi auth xong
 */

// scope 'workspace': dữ liệu riêng của workspace (tenant) đang chọn — đổi workspace là đổi nội dung.
// scope 'account': dùng chung cho cả tài khoản (gói, hạn mức, dung lượng, đăng nhập) — không đổi theo workspace.
const SIDEBAR_NAV = [
  {
    scope: 'workspace',
    section: null,
    items: [
      { href: 'index.html',    icon: 'ti-layout-dashboard', labelKey: 'nav_overview' },
    ]
  },
  {
    scope: 'workspace',
    section: 'Chatbot',
    items: [
      { href: 'config.html',   icon: 'ti-settings',         labelKey: 'nav_bot_settings' },
      { href: 'widget.html',  icon: 'ti-code',              labelKey: 'nav_widget' },
      { href: 'agent-chat.html', icon: 'ti-message-2-bot',  labelKey: 'nav_agent_chat' },
      { href: 'knowledge.html',icon: 'ti-book',             labelKey: 'nav_knowledge' },
      { href: 'messages.html', icon: 'ti-message-circle',   labelKey: 'nav_messages' },
      { href: 'loyalty.html',  icon: 'ti-gift',             labelKey: 'nav_loyalty' },
      { href: 'customer/',     icon: 'ti-arrows-right-left', label: 'Xem như khách hàng' },
      // "leads.html" (nav_leads) đã bỏ — trang này chưa từng được xây, link chết âm thầm rơi về
      // Overview qua fallback SPA của Cloudflare Pages, gây nhầm cho người dùng. Thêm lại nav
      // item này khi trang thật được build.
    ]
  },
  {
    scope: 'workspace',
    sectionKey: 'nav_social_media',
    items: [
      { href: 'post.html',      icon: 'ti-article',        labelKey: 'nav_posts' },
      { href: 'composer.html',  icon: 'ti-edit',           labelKey: 'nav_composer' },
      { href: 'analytics.html', icon: 'ti-chart-bar',      labelKey: 'nav_analytics' },
      { href: 'sm-config.html', icon: 'ti-brand-facebook', labelKey: 'nav_sm_config' },
    ]
  },
  {
    scope: 'account',
    section: 'Tài khoản',
    sectionHint: 'Dùng chung mọi workspace',
    items: [
      { href: 'billing.html',  icon: 'ti-receipt',          labelKey: 'nav_billing' },
      { href: 'master-agent.html', icon: 'ti-robot', label: 'Agent tổng (mọi tenant)' },
      { href: 'account.html',  icon: 'ti-user-circle',      label: 'Thông tin tài khoản' },
      { href: (typeof WORKER_URL !== 'undefined' ? WORKER_URL : '') + '/docs', icon: 'ti-api', label: 'API Docs', external: true },
    ]
  }
];

function renderSidebar(user) {
  const el = document.getElementById('sidebar-placeholder');
  if (!el) return;

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const currentLang = typeof getLang === 'function' ? getLang() : 'vi';
  const tenant = window.TENANT || '—';
  const memberships = Array.isArray(window.TENANT_MEMBERSHIPS) ? window.TENANT_MEMBERSHIPS : [];
  const userName = user?.name || user?.email || 'Admin';
  const avatarUrl = user?.avatarUrl || user?.avatar
    ? (typeof PB !== 'undefined' && user.avatar
        ? PB.getFileUrl(user, user.avatar, { thumb: '40x40' })
        : (user?.avatarUrl || ''))
    : '';
  const tenantSwitcherHtml = `
    <div class="px-2 pt-2 pb-1">
      <div class="d-flex align-items-center justify-content-between mb-1">
        <label for="sidebar-tenant-switcher" class="form-label text-white-50 fs-6 mb-0">Workspace đang dùng</label>
        <a href="account.html#workspaces" class="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 py-0 px-2" style="font-size:11px; line-height:22px;" title="Tạo workspace mới"><i class="ti ti-plus"></i>Thêm mới</a>
      </div>
      ${memberships.length > 1 ? `
      <select id="sidebar-tenant-switcher" class="form-select form-select-sm" onchange="switchTenant(this.value)" aria-label="Chọn tenant">
        ${memberships.map((item) => `<option value="${escapeSidebarHtml(item.tenant)}" ${item.tenant === tenant ? 'selected' : ''}>${escapeSidebarHtml(item.tenant)} (${escapeSidebarHtml(item.role)})</option>`).join('')}
      </select>` : `<div class="text-white fs-5">${escapeSidebarHtml(tenant)}</div>`}
    </div>`;

  const renderGroup = group => {
    const title = group.sectionKey
      ? `<span data-i18n="${group.sectionKey}">${typeof t === 'function' ? t(group.sectionKey) : 'Social Media'}</span>`
      : (group.section ? `<span>${group.section}</span>` : '');
    const sectionHtml = title
      ? `<p class="nav-category">${title}${group.sectionHint ? `<small>${group.sectionHint}</small>` : ''}</p>`
      : '';

    const itemsHtml = group.items.map(item => {
      const isActive = !item.external && (currentPage === item.href ||
        (item.href !== 'index.html' && currentPage.startsWith(item.href.replace('.html',''))));
      const label = item.label || (typeof t === 'function' ? t(item.labelKey) : item.labelKey);
      const i18nAttr = item.labelKey ? ` data-i18n="${item.labelKey}"` : '';
      const targetAttr = item.external ? ' target="_blank" rel="noopener"' : '';
      return `
        <li class="nav-item">
          <a class="nav-link ${isActive ? 'active' : ''}" href="${item.href}"${targetAttr}>
            <span class="nav-link-icon d-md-none d-lg-inline-block">
              <i class="ti ${item.icon}"></i>
            </span>
            <span class="nav-link-title"${i18nAttr}>${label}</span>
          </a>
        </li>`;
    }).join('');

    return sectionHtml + `<ul class="navbar-nav">${itemsHtml}</ul>`;
  };

  // Hai khối: workspace (kèm bộ chọn workspace ở đầu) và tài khoản (dùng chung).
  const workspaceNavHtml = SIDEBAR_NAV.filter(g => g.scope === 'workspace').map(renderGroup).join('');
  const accountNavHtml = SIDEBAR_NAV.filter(g => g.scope === 'account').map(renderGroup).join('');
  const navHtml = `
    <style>
      .nav-scope-workspace { border-left: 3px solid #5751E1; padding-left: 4px; margin: 0 0 8px 4px; }
      .nav-scope-account { border-left: 3px solid #FFC224; padding-left: 4px; margin: 0 0 8px 4px; }
      .nav-category { margin: 6px 0 0 12px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.55); }
      .nav-category small { display: block; font-size: 10px; font-weight: 400; letter-spacing: 0; text-transform: none; color: rgba(255,255,255,.4); }
    </style>
    <div class="nav-scope-workspace">${tenantSwitcherHtml}${workspaceNavHtml}</div>
    <div class="nav-scope-account">${accountNavHtml}</div>`;

  // Dùng outerHTML (không phải innerHTML) để <aside> trở thành sibling trực tiếp của .page-wrapper —
  // CSS của Tabler định vị margin-left cho .page-wrapper bằng sibling selector, lồng thêm 1 div bọc
  // ngoài (như innerHTML để lại) sẽ làm mất offset này và khiến sidebar đè lên nội dung.
  el.outerHTML = `
    <aside class="navbar navbar-vertical navbar-expand-lg" data-bs-theme="dark">
      <div class="container-fluid">

        <!-- Mobile toggle -->
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#sidebar-menu">
          <span class="navbar-toggler-icon"></span>
        </button>

        <!-- Brand -->
        <div class="navbar-brand navbar-brand-autodark">
          <a href="index.html" class="d-flex align-items-center gap-2 text-decoration-none">
            <div class="avatar avatar-sm bg-primary rounded">
              <i class="ti ti-robot text-white" style="font-size:18px"></i>
            </div>
            <div>
              <div class="fw-bold text-white lh-1">AI Admin</div>
              <div class="text-white-50 fs-6 lh-1" id="nav-tenant-id">${tenant}</div>
            </div>
          </a>
        </div>

        <!-- Collapse -->
        <div class="collapse navbar-collapse" id="sidebar-menu">

          <!-- Nav items -->
          <div class="flex-fill overflow-auto" style="max-height:calc(100vh - 150px)">
            ${navHtml}
          </div>

          <!-- User footer -->
          <div class="mt-auto pt-3 border-top border-white-10">
            <div class="px-2 pb-2">
              <label for="sidebar-language" class="form-label text-white-50 fs-6 mb-1" data-i18n="language">Ngôn ngữ</label>
              <select id="sidebar-language" class="form-select form-select-sm" onchange="setLang(this.value)" aria-label="Language">
                <option value="vi" ${currentLang === 'vi' ? 'selected' : ''}>🇻🇳 Tiếng Việt</option>
                <option value="en" ${currentLang === 'en' ? 'selected' : ''}>🇬🇧 English</option>
                <option value="ja" ${currentLang === 'ja' ? 'selected' : ''}>🇯🇵 日本語</option>
                <option value="es" ${currentLang === 'es' ? 'selected' : ''}>🇪🇸 Español</option>
                <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>🇫🇷 Français</option>
                <option value="ko" ${currentLang === 'ko' ? 'selected' : ''}>🇰🇷 한국어</option>
              </select>
            </div>
            <div class="d-flex align-items-center gap-2 px-2 py-2">
              <span class="avatar avatar-sm rounded-circle"
                style="background-image:url('${avatarUrl}')"
                id="sidebar-avatar">
                ${!avatarUrl ? `<i class="ti ti-user"></i>` : ''}
              </span>
              <div class="flex-fill overflow-hidden">
                <div class="text-white fw-medium text-truncate fs-5" id="sidebar-username">${userName}</div>
                <div class="text-white-50 text-truncate fs-6" id="sidebar-tenant">${tenant}</div>
              </div>
              <a href="#" onclick="logout()" class="text-white-50 nav-link p-1" data-i18n-title="logout" title="${typeof t === 'function' ? t('logout') : 'Đăng xuất'}">
                <i class="ti ti-logout"></i>
              </a>
            </div>
          </div>

        </div>
      </div>
    </aside>`;

  // Sidebar chỉ là 1 phần của trang — áp dụng luôn i18n cho toàn bộ DOM còn lại
  // để mỗi trang không phải tự nhớ gọi applyI18n() riêng.
  if (typeof applyI18n === 'function') applyI18n();
}

function escapeSidebarHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Cập nhật avatar/name sau khi auth
function updateSidebarUser(user) {
  if (!user) return;
  const nameEl = document.getElementById('sidebar-username');
  const tenantEl = document.getElementById('sidebar-tenant');
  const navTenant = document.getElementById('nav-tenant-id');
  const avatarEl = document.getElementById('sidebar-avatar');

  if (nameEl) nameEl.textContent = user.name || user.email || 'Admin';
  if (tenantEl) tenantEl.textContent = window.TENANT || '—';
  if (navTenant) navTenant.textContent = window.TENANT || '—';
  if (avatarEl && user.avatar && typeof PB !== 'undefined') {
    avatarEl.style.backgroundImage = `url('${PB.getFileUrl(user, user.avatar, { thumb: '40x40' })}')`;
    avatarEl.innerHTML = '';
  }
}
