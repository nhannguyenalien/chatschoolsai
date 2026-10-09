/**
 * _shared/auth.js
 * Phụ thuộc: config.js (PB đã khởi tạo)
 *
 * Dùng trong mỗi trang:
 *   await requireAuth();   ← gọi đầu tiên, tự redirect về login nếu chưa đăng nhập
 *   renderUserInfo();      ← hiển thị tên + avatar lên topbar
 *   logout();              ← đăng xuất
 *
 * Biến global sau khi requireAuth() xong:
 *   window.TENANT    — tenant_id của user
 *   window.AUTH_USER — PocketBase user record
 */

// ─────────────────────────────────────────
// REQUIRE AUTH — gọi ở đầu mỗi trang
// ─────────────────────────────────────────

/**
 * _shared/auth.js
 * Phụ thuộc: config.js (PB đã khởi tạo)
 *
 * Dùng trong mỗi trang:
 *   await requireAuth();   ← gọi đầu tiên, tự redirect về login nếu chưa đăng nhập
 *   renderUserInfo();      ← hiển thị tên + avatar lên topbar
 *   logout();              ← đăng xuất
 *
 * Biến global sau khi requireAuth() xong:
 *   window.TENANT    — tenant của user
 *   window.AUTH_USER — PocketBase user record
 */

// ─────────────────────────────────────────
// REQUIRE AUTH — gọi ở đầu mỗi trang
// ─────────────────────────────────────────

async function requireAuth() {
  // 1. Kiểm tra xem trình duyệt có giữ token không
  if (!PB.authStore.isValid) {
    console.warn("[Auth] Không tìm thấy token hợp lệ trong localStorage.");
    redirectToLogin();
    return;
  }

  try {
    console.log("[Auth] Đang thử làm mới token với PocketBase...");
    await PB.collection("tenants").authRefresh();
    console.log("[Auth] ✅ Làm mới token thành công!");
  } catch (err) {
    console.error("[Auth] ❌ Lỗi khi chạy authRefresh:", err);

    // 🔥 CHỖ NÀY LÀ FIX CHÍNH: 
    // Chỉ xoá session nếu lỗi từ server báo về là token đã HẾT HẠN hoặc SAI (status 400 hoặc 401)
    if (err.status === 400 || err.status === 401) {
      console.error("[Auth] Token thực sự hết hạn hoặc không hợp lệ. Đang đăng xuất...");
      PB.authStore.clear();
      redirectToLogin();
      return;
    }

    // Nếu dính lỗi mạng, Hugging Face ngủ đông, lỗi 502/504 (status = 0 hoặc 5xx)
    // THÌ KHÔNG ĐƯỢC XOÁ SESSION, cứ để user dùng tiếp bằng token đang có sẵn!
    console.warn("[Auth] Lỗi mạng hoặc server Hugging Face phản hồi chậm. Giữ lại session cũ để chạy tiếp.");
  }

  const user = PB.authStore.model;
  if (!user) {
    redirectToLogin();
    return;
  }

  // Membership là lớp bổ sung. Khi collection chưa được migrate, hàm này
  // tự fallback về user.tenant nên các tài khoản cũ không bị gián đoạn.
  const tenantContext = await initializeTenantContext(user);

  // Không có tenant cũ và cũng không có membership: đây là tài khoản khách hàng.
  if (!tenantContext.activeTenant) {
    window.location.href = "customer/";
    return;
  }

  // Nếu mọi thứ ok -> Set biến toàn cục để các trang con xài
  window.TENANT    = tenantContext.activeTenant;
  window.AUTH_USER = user;

  // Ẩn modal login đi (hàm này tự chạy nếu đang ở trang index)
  if (typeof hideLoginModal === "function") {
    hideLoginModal();
  }

  // Đổ thông tin tên, avatar lên sidebar
  renderUserInfo(user);
}

const ACTIVE_TENANT_STORAGE_PREFIX = "schoolsai.activeTenant.";

function tenantStorageKey(user) {
  return `${ACTIVE_TENANT_STORAGE_PREFIX}${user.id}`;
}

function normalizeTenantMembership(record, legacyTenant) {
  return {
    id: record?.id || `legacy:${legacyTenant}`,
    tenant: String(record?.tenant || legacyTenant || "").trim(),
    role: record?.role || "owner",
    isDefault: Boolean(record?.is_default) || record?.tenant === legacyTenant,
    legacy: !record?.id,
  };
}

async function initializeTenantContext(user) {
  const legacyTenant = String(user?.tenant || "").trim();
  let memberships = [];

  try {
    const records = await PB.collection("tenant_memberships").getFullList({
      filter: `account = "${user.id}" && status = "active"`,
      sort: "-is_default,tenant",
    });
    memberships = records.map((record) => normalizeTenantMembership(record, legacyTenant));
  } catch (err) {
    // 404 là trạng thái bình thường trong giai đoạn rollout trước khi chạy migration.
    console.warn("[Auth] tenant_memberships chưa sẵn sàng; dùng tenant cũ.", err?.status || err?.message || err);
  }

  if (legacyTenant && !memberships.some((item) => item.tenant === legacyTenant)) {
    memberships.push(normalizeTenantMembership(null, legacyTenant));
  }

  const unique = [];
  const seen = new Set();
  for (const membership of memberships) {
    if (!membership.tenant || seen.has(membership.tenant)) continue;
    seen.add(membership.tenant);
    unique.push(membership);
  }

  const savedTenant = localStorage.getItem(tenantStorageKey(user));
  const active = unique.find((item) => item.tenant === savedTenant)
    || unique.find((item) => item.isDefault)
    || unique[0]
    || null;

  window.TENANT_MEMBERSHIPS = unique;
  window.TENANT = active?.tenant || "";
  window.ACTIVE_TENANT_ROLE = active?.role || "";
  if (active) localStorage.setItem(tenantStorageKey(user), active.tenant);

  return { memberships: unique, activeTenant: window.TENANT, role: window.ACTIVE_TENANT_ROLE };
}

function switchTenant(tenant) {
  const user = window.AUTH_USER || PB.authStore.model;
  const membership = (window.TENANT_MEMBERSHIPS || []).find((item) => item.tenant === tenant);
  if (!user || !membership || tenant === window.TENANT) return;
  localStorage.setItem(tenantStorageKey(user), tenant);
  // Reload để xóa toàn bộ state/cache của tenant trước khỏi trang hiện tại.
  window.location.reload();
}
// ─────────────────────────────────────────
// LOGIN — dùng trên trang login.html
// ─────────────────────────────────────────

async function loginWithPassword(email, password) {
  try {
    await PB.collection("tenants").authWithPassword(email, password);
    const user = PB.authStore.model;
    
    const tenantContext = await initializeTenantContext(user);
    if (!tenantContext.activeTenant) {
      PB.authStore.clear();
      throw new Error("Tài khoản chưa được cấp tenant.");
    }
    
    window.location.href = "messages.html";
  } catch (err) {
    throw err;
  }
}

// ─────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────

function logout() {
  const user = window.AUTH_USER || PB.authStore.model;
  if (user?.id) localStorage.removeItem(tenantStorageKey(user));
  PB.authStore.clear();
  localStorage.removeItem('loginMethod');
  redirectToLogin();
}

// ─────────────────────────────────────────
// RENDER USER INFO lên topbar
// ─────────────────────────────────────────

function renderUserInfo(user) {
  // 🔥 ĐÃ FIX: Cập nhật lại các ID này để ăn khớp hoàn toàn với file HTML dashboard của bạn
  const nameEl   = document.getElementById("user-display-name") || document.getElementById("user-name-display");
  const photoEl  = document.getElementById("user-avatar") || document.getElementById("user-photo");
  const tenantEl = document.getElementById("nav-tenant-id") || document.getElementById("tenant-badge");
  const labelEl  = document.getElementById("tenant-label");
  const cfgEl    = document.getElementById("cfg-tenant-display");

  if (nameEl)   nameEl.textContent  = user.name || user.email || "—";
  if (photoEl && user.avatarUrl) photoEl.src = user.avatarUrl;
  if (tenantEl) tenantEl.textContent = window.TENANT;
  if (labelEl)  labelEl.textContent  = window.TENANT;
  if (cfgEl)    cfgEl.value          = window.TENANT;
}

// ─────────────────────────────────────────
// REDIRECT
// ─────────────────────────────────────────

function redirectToLogin() {
  // Đổi index.html thành landing.html để nếu chưa login, hệ thống tự sút ra Landing
  if (!window.location.pathname.endsWith("landing.html") &&
      !window.location.pathname.endsWith("/")) {
    window.location.href = "landing.html";
  }
}

// ─────────────────────────────────────────
// NAV ACTIVE STATE
// Tự highlight nav item theo trang hiện tại
// ─────────────────────────────────────────

function setActiveNav() {
  const page = window.location.pathname.split("/").pop().replace(".html", "");
  document.querySelectorAll(".nav-item[data-page]").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });
}

// Read through the authenticated worker so secondary workspace access does not
// depend on a legacy PocketBase rule comparing only the account's primary slug.
async function loadWorkspaceMessages(tenant) {
  const items = new Map();
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetch(`${WORKER_URL}/api/account/messages?tenant=${encodeURIComponent(tenant)}&page=${page}`, {
      headers: { Authorization: PB.authStore.token }, cache: "no-store"
    });
    if (!response.ok) throw new Error(`Không tải được tin nhắn (${response.status})`);
    const data = await response.json();
    for (const item of data.items || []) items.set(item.id, item);
    totalPages = data.totalPages || 1;
    page += 1;
  } while (page <= totalPages);
  return { items: [...items.values()] };
}

// Đọc kênh (pages_config) qua Worker: rule PocketBase chỉ khớp workspace gốc, workspace phụ sẽ trả danh sách rỗng.
async function listPagesConfig(tenant, { activeOnly = false } = {}) {
  const response = await fetch(`${WORKER_URL}/api/account/pages-config?tenant=${encodeURIComponent(tenant)}`, {
    headers: { Authorization: PB.authStore.token }, cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return activeOnly ? data.items.filter((item) => item.is_active) : data.items;
}
