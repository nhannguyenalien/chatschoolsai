/**
 * _shared/i18n.js — đa ngôn ngữ nhẹ, không thư viện ngoài.
 * Cách dùng: gắn data-i18n="key" lên phần tử -> textContent được thay khi applyI18n() chạy.
 *            data-i18n-placeholder="key" cho input/textarea placeholder.
 *            data-i18n-title="key" cho tooltip title.
 * t(key) dùng trong JS khi cần chuỗi dịch (vd showToast, render list).
 */
const I18N_DICT = {
  vi: {
    // Sidebar / nav chung
    nav_overview: "Overview",
    nav_bot_settings: "Cài Đặt Bot",
    nav_agent_chat: "Chat với Agent",
    nav_knowledge: "Kiến Thức",
    nav_messages: "Nhật Ký Chat",
    nav_leads: "Khách Hàng Tiềm Năng",
    nav_billing: "Thanh Toán",
    nav_posts: "Bài Đăng BDS",
    nav_composer: "Soạn Bài",
    nav_analytics: "Analytics",
    nav_sm_config: "Cấu Hình Kênh",
    logout: "Đăng xuất",

    // Chung (nút, hành động lặp lại nhiều trang)
    btn_save: "Lưu",
    btn_cancel: "Hủy",
    btn_delete: "Xóa",
    btn_add: "Thêm",
    btn_search: "Tìm kiếm",
    btn_send: "Gửi",
    loading: "Đang tải...",

    // index.html
    idx_title: "Customer AI Hub",

    // config.html
    cfg_breadcrumb: "Bot Configuration",
    cfg_title: "Cấu Hình Trợ Lý",
    cfg_subtitle: "Thiết lập nhân cách, hành vi và thông số kỹ thuật cho chatbot của bạn.",
    cfg_agentchat_banner_title: "Chat với Agent AI",
    cfg_agentchat_banner_sub: "Nói chuyện bình thường để cấu hình hệ thống — đỡ phải mò từng form bên dưới. Xem trang riêng.",
    cfg_card_api_title: "API cho hệ thống ngoài",
    cfg_card_agent_title: "AI Agent Vận Hành",
    cfg_card_tools_title: "Tool tùy chỉnh cho Agent (API ngoài)",
    cfg_card_persona_title: "System Persona",

    // agent-chat.html
    ac_breadcrumb: "Chat với Agent AI",
    ac_title: "Chat với Agent AI",
    ac_subtitle: "Nói chuyện bình thường — Agent tự hiểu và cấu hình hệ thống giúp bạn qua API, không cần vào từng form.",
    ac_warning_html: 'Nội dung bạn gõ (kể cả token/API key nếu có) sẽ được gửi qua model AI để xử lý. Chỉ dán token khi bạn tin tưởng proxy AI đang cấu hình cho hệ thống (xem <a href="config.html">Bot Settings</a>).',
    ac_input_placeholder: "Nhập yêu cầu cấu hình... (Enter để gửi)",
    ac_empty: "Chưa có tin nhắn nào — thử 1 gợi ý bên dưới, hoặc gõ yêu cầu của bạn.",

    // knowledge.html
    kb_title_top: "Knowledge Base",
    kb_title: "Cơ Sở Dữ Liệu Kiến Thức",
    kb_subtitle: "Thêm và quản lý nội dung để bot học. Paste văn bản vào — hệ thống tự động chunk và embedding.",
    kb_search_placeholder: "Tìm kiếm tài liệu...",

    // messages.html
    msg_title_top: "Nhật ký trò chuyện",
    msg_recent_sessions: "Phiên gần đây",
    msg_filter_all: "Tất cả",
    msg_filter_needs_human: "Cần xử lý",
    msg_select_session: "Chọn một phiên chat",
    msg_select_session_hint: "Bấm vào khách hàng bên trái để xem tin nhắn",

    // billing.html
    bill_title_top: "Dashboard",
    bill_title: "Thanh Toán & Sử Dụng",
    bill_subtitle: "Quản lý gói dịch vụ, hạn mức và lịch sử giao dịch của bạn.",

    // post.html
    post_title: "Bài Đăng BDS",
    post_subtitle: "Quản lý, duyệt và theo dõi bài đăng tự động lên mạng xã hội",
    post_btn_refresh: "Làm mới",

    // composer.html
    comp_title: "Soạn Bài",
    comp_subtitle: "Soạn bài viết, dùng AI viết lại từ RSS, và đăng thủ công lên các nền tảng.",
    comp_manage_channels: "Quản lý kênh đăng",

    // analytics.html
    an_title: "Analytics",
    an_subtitle: "Theo dõi tình trạng đăng bài trên tất cả nền tảng.",

    // sm-config.html
    sm_title: "Cấu hình Kênh",
    sm_subtitle: "Quản lý Page/Account và token cho Facebook, Instagram, WhatsApp, Zalo và các API chat khác."
  },
  en: {
    nav_overview: "Overview",
    nav_bot_settings: "Bot Settings",
    nav_agent_chat: "Chat with Agent",
    nav_knowledge: "Knowledge Base",
    nav_messages: "Chat Logs",
    nav_leads: "Leads",
    nav_billing: "Billing",
    nav_posts: "Social Posts",
    nav_composer: "Composer",
    nav_analytics: "Analytics",
    nav_sm_config: "Channel Settings",
    logout: "Log out",

    btn_save: "Save",
    btn_cancel: "Cancel",
    btn_delete: "Delete",
    btn_add: "Add",
    btn_search: "Search",
    btn_send: "Send",
    loading: "Loading...",

    idx_title: "Customer AI Hub",

    cfg_breadcrumb: "Bot Configuration",
    cfg_title: "Configure Assistant",
    cfg_subtitle: "Set up your chatbot's personality, behavior, and technical parameters.",
    cfg_agentchat_banner_title: "Chat with AI Agent",
    cfg_agentchat_banner_sub: "Just talk to configure the system — no need to hunt through the forms below. Open the dedicated page.",
    cfg_card_api_title: "API for external systems",
    cfg_card_agent_title: "AI Operations Agent",
    cfg_card_tools_title: "Custom Agent Tools (external APIs)",
    cfg_card_persona_title: "System Persona",

    ac_breadcrumb: "Chat with AI Agent",
    ac_title: "Chat with AI Agent",
    ac_subtitle: "Just talk normally — the Agent understands and configures the system for you via API, no forms needed.",
    ac_warning_html: 'What you type (including any pasted tokens/API keys) is sent through the AI model for processing. Only paste tokens if you trust the AI proxy configured for this system (see <a href="config.html">Bot Settings</a>).',
    ac_input_placeholder: "Type a configuration request... (Enter to send)",
    ac_empty: "No messages yet — try a suggestion below, or type your own request.",

    kb_title_top: "Knowledge Base",
    kb_title: "Knowledge Base",
    kb_subtitle: "Add and manage the content your bot learns from. Paste text in — it's automatically chunked and embedded.",
    kb_search_placeholder: "Search documents...",

    msg_title_top: "Chat Logs",
    msg_recent_sessions: "Recent Sessions",
    msg_filter_all: "All",
    msg_filter_needs_human: "Needs attention",
    msg_select_session: "Select a chat session",
    msg_select_session_hint: "Click a customer on the left to view messages",

    bill_title_top: "Dashboard",
    bill_title: "Billing & Usage",
    bill_subtitle: "Manage your plan, limits, and transaction history.",

    post_title: "Real Estate Posts",
    post_subtitle: "Manage, approve, and track posts published automatically to social media",
    post_btn_refresh: "Refresh",

    comp_title: "Composer",
    comp_subtitle: "Draft posts, use AI to rewrite from RSS, and publish manually to your platforms.",
    comp_manage_channels: "Manage publishing channels",

    an_title: "Analytics",
    an_subtitle: "Track posting status across every platform.",

    sm_title: "Channel Settings",
    sm_subtitle: "Manage Pages/Accounts and tokens for Facebook, Instagram, WhatsApp, Zalo and other chat APIs."
  }
};

function getLang() {
  return localStorage.getItem("lang") || "vi";
}

function t(key) {
  const lang = getLang();
  return (I18N_DICT[lang] && I18N_DICT[lang][key]) || (I18N_DICT.vi && I18N_DICT.vi[key]) || key;
}

function applyI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  // Dành cho chuỗi có chứa link/markup con (vd cảnh báo kèm 1 thẻ <a>) — dịch nguyên cả HTML.
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
}

function setLang(lang) {
  localStorage.setItem("lang", lang);
  applyI18n();
  if (typeof renderSidebar === "function" && window.AUTH_USER) {
    renderSidebar(window.AUTH_USER);
    applyI18n();
  }
}
