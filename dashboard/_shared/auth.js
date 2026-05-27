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
  // Nếu chưa có token hợp lệ → về trang login
  if (!PB.authStore.isValid) {
    redirectToLogin();
    return;
  }

  try {
    // Refresh token để đảm bảo còn hiệu lực
    await PB.collection("tenants").authRefresh();
  } catch {
    PB.authStore.clear();
    redirectToLogin();
    return;
  }

  const user = PB.authStore.model;

  // 🔥 ĐÃ FIX: Đổi từ tenant_id thành tenant cho đúng với PocketBase của bạn
  if (!user.tenant) {
    PB.authStore.clear();
    alert("Tài khoản chưa được cấp tenant. Liên hệ admin.");
    redirectToLogin();
    return;
  }

  // 🔥 ĐÃ FIX: Đổi tenant_id thành tenant
  window.TENANT    = user.tenant;
  window.AUTH_USER = user;

  renderUserInfo(user);
}

// ─────────────────────────────────────────
// LOGIN — dùng trên trang login.html
// ─────────────────────────────────────────

async function loginWithPassword(email, password) {
  try {
    await PB.collection("tenants").authWithPassword(email, password);
    const user = PB.authStore.model;
    
    if (!user.tenant) {
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
  PB.authStore.clear();
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
  // Chỉ redirect nếu chưa ở trang login
  if (!window.location.pathname.endsWith("index.html") &&
      !window.location.pathname.endsWith("/")) {
    window.location.href = "index.html";
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