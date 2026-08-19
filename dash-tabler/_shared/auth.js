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

  // 2. Kiểm tra trường tenant của tài khoản
  if (!user || !user.tenant) {
    console.error("[Auth] Không tìm thấy trường tenant trên PocketBase của user này:", user);
    alert("Tài khoản chưa được cấp tenant. Liên hệ admin.");
    PB.authStore.clear();
    redirectToLogin();
    return;
  }

  // Nếu mọi thứ ok -> Set biến toàn cục để các trang con xài
  window.TENANT    = user.tenant;
  window.AUTH_USER = user;

  // Ẩn modal login đi (hàm này tự chạy nếu đang ở trang index)
  if (typeof hideLoginModal === "function") {
    hideLoginModal();
  }

  // Đổ thông tin tên, avatar lên sidebar
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