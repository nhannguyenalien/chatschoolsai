/**
 * _shared/sidebar.js
 * Tabler sidebar — dùng chung cho mọi trang
 * Gọi: renderSidebar() sau khi auth xong
 */

const SIDEBAR_NAV = [
  {
    section: null,
    items: [
      { href: 'index.html',    icon: 'ti-layout-dashboard', label: 'Overview' },
      { href: 'config.html',   icon: 'ti-settings',         label: 'Bot Settings' },
      { href: 'knowledge.html',icon: 'ti-book',             label: 'Knowledge Base' },
      { href: 'messages.html', icon: 'ti-message-circle',   label: 'Chat Logs' },
      { href: 'leads.html',    icon: 'ti-users',            label: 'Leads' },
      { href: 'billing.html',  icon: 'ti-receipt',          label: 'Billing' },
    ]
  },
  {
    section: 'Social Media',
    items: [
      { href: 'post.html',      icon: 'ti-article',        label: 'Bài Đăng BDS' },
      { href: 'composer.html',  icon: 'ti-edit',           label: 'Soạn Bài' },
      { href: 'analytics.html', icon: 'ti-chart-bar',      label: 'Analytics' },
      { href: 'sm-config.html', icon: 'ti-brand-facebook', label: 'Cấu hình Pages' },
    ]
  }
];

function renderSidebar(user) {
  const el = document.getElementById('sidebar-placeholder');
  if (!el) return;

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const tenant = window.TENANT || '—';
  const userName = user?.name || user?.email || 'Admin';
  const avatarUrl = user?.avatarUrl || user?.avatar
    ? (typeof PB !== 'undefined' && user.avatar
        ? PB.getFileUrl(user, user.avatar, { thumb: '40x40' })
        : (user?.avatarUrl || ''))
    : '';

  const navHtml = SIDEBAR_NAV.map(group => {
    const sectionHtml = group.section
      ? `<p class="nav-category">${group.section}</p>`
      : '';

    const itemsHtml = group.items.map(item => {
      const isActive = currentPage === item.href ||
        (item.href !== 'index.html' && currentPage.startsWith(item.href.replace('.html','')));
      return `
        <li class="nav-item">
          <a class="nav-link ${isActive ? 'active' : ''}" href="${item.href}">
            <span class="nav-link-icon d-md-none d-lg-inline-block">
              <i class="ti ${item.icon}"></i>
            </span>
            <span class="nav-link-title">${item.label}</span>
          </a>
        </li>`;
    }).join('');

    return sectionHtml + `<ul class="navbar-nav">${itemsHtml}</ul>`;
  }).join('<div class="my-2 border-top"></div>');

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
          <div class="flex-fill overflow-auto" style="max-height:calc(100vh - 200px)">
            ${navHtml}
          </div>

          <!-- User footer -->
          <div class="mt-auto pt-3 border-top border-white-10">
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
              <a href="#" onclick="logout()" class="text-white-50 nav-link p-1" title="Đăng xuất">
                <i class="ti ti-logout"></i>
              </a>
            </div>
          </div>

        </div>
      </div>
    </aside>`;
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