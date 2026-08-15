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
    nav_loyalty: "Khách Hàng & Tích Điểm",
    nav_social_media: "Mạng xã hội",
    logout: "Đăng xuất",

    // Chung (nút, hành động lặp lại nhiều trang)
    btn_save: "Lưu",
    btn_cancel: "Hủy",
    btn_delete: "Xóa",
    btn_add: "Thêm",
    btn_search: "Tìm kiếm",
    btn_send: "Gửi",
    loading: "Đang tải...",
    language: "Ngôn ngữ",
    cfg_response_language: "Ngôn ngữ trả lời", cfg_response_language_hint: "Tự động sẽ nhận diện ngôn ngữ khách đang dùng; chọn một ngôn ngữ để bot luôn trả lời bằng ngôn ngữ đó.", comp_content_language: "Ngôn ngữ nội dung", lang_auto_customer: "Tự động theo ngôn ngữ khách hàng", lang_auto_interface: "Tự động theo ngôn ngữ giao diện",

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
    ac_capabilities_title: "Agent có thể làm được gì?",
    ac_capabilities_hint: "Danh sách này lấy trực tiếp từ backend — luôn đúng với những gì Agent thật sự làm được, không phải tài liệu viết tay có thể lỗi thời.",

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
    nav_loyalty: "Customers & Loyalty",
    nav_social_media: "Social Media",
    logout: "Log out",

    btn_save: "Save",
    btn_cancel: "Cancel",
    btn_delete: "Delete",
    btn_add: "Add",
    btn_search: "Search",
    btn_send: "Send",
    loading: "Loading...",
    language: "Language",
    cfg_response_language: "Response language", cfg_response_language_hint: "Auto detects the customer's language; select a language to make the bot always reply in it.", comp_content_language: "Content language", lang_auto_customer: "Auto — customer language", lang_auto_interface: "Auto — interface language",

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
    ac_capabilities_title: "What can this Agent do?",
    ac_capabilities_hint: "This list comes straight from the backend — always accurate to what the Agent can actually do, not a hand-written doc that can go stale.",

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
  },
  ja: {
    nav_overview: "概要", nav_bot_settings: "ボット設定", nav_agent_chat: "エージェントとチャット", nav_knowledge: "ナレッジベース", nav_messages: "チャット履歴", nav_leads: "見込み客", nav_billing: "請求", nav_posts: "SNS投稿", nav_composer: "投稿作成", nav_analytics: "分析", nav_sm_config: "チャンネル設定", nav_loyalty: "顧客・ロイヤルティ", nav_social_media: "ソーシャルメディア", logout: "ログアウト",
    language: "言語", cfg_response_language: "返信言語", cfg_response_language_hint: "自動では顧客の言語を検出します。固定する場合は言語を選択してください。", comp_content_language: "コンテンツ言語", lang_auto_customer: "自動（顧客の言語）", lang_auto_interface: "自動（画面の言語）", btn_save: "保存", btn_cancel: "キャンセル", btn_delete: "削除", btn_add: "追加", btn_search: "検索", btn_send: "送信", loading: "読み込み中...",
    idx_title: "カスタマーAIハブ",
    cfg_breadcrumb: "ボット設定", cfg_title: "アシスタントを設定", cfg_subtitle: "チャットボットの性格、動作、技術パラメータを設定します。", cfg_agentchat_banner_title: "AIエージェントとチャット", cfg_agentchat_banner_sub: "会話するだけでシステムを設定できます。下のフォームを探す必要はありません。専用ページを開いてください。", cfg_card_api_title: "外部システム向けAPI", cfg_card_agent_title: "AI運用エージェント", cfg_card_tools_title: "エージェント用カスタムツール（外部API）", cfg_card_persona_title: "システムペルソナ",
    ac_breadcrumb: "AIエージェントとチャット", ac_title: "AIエージェントとチャット", ac_subtitle: "普通に話すだけで、エージェントが内容を理解し、API経由でシステムを設定します。", ac_warning_html: '入力内容（トークンやAPIキーを含む）はAIモデルへ送信されます。このシステムに設定されたAIプロキシを信頼できる場合のみトークンを貼り付けてください（<a href="config.html">ボット設定</a>を参照）。', ac_input_placeholder: "設定内容を入力...（Enterで送信）", ac_empty: "メッセージはまだありません。下の候補を選ぶか、リクエストを入力してください。", ac_capabilities_title: "このエージェントでできること", ac_capabilities_hint: "この一覧はバックエンドから直接取得されるため、エージェントが実行できる内容を常に正確に反映します。",
    kb_title_top: "ナレッジベース", kb_title: "ナレッジベース", kb_subtitle: "ボットが学習するコンテンツを追加・管理します。テキストを貼り付けると自動で分割・埋め込みされます。", kb_search_placeholder: "ドキュメントを検索...",
    msg_title_top: "チャット履歴", msg_recent_sessions: "最近のセッション", msg_filter_all: "すべて", msg_filter_needs_human: "対応が必要", msg_select_session: "チャットセッションを選択", msg_select_session_hint: "左側の顧客をクリックするとメッセージが表示されます",
    bill_title_top: "ダッシュボード", bill_title: "請求と利用状況", bill_subtitle: "プラン、上限、取引履歴を管理します。",
    post_title: "不動産投稿", post_subtitle: "SNSへ自動公開する投稿を管理、承認、追跡します", post_btn_refresh: "更新",
    comp_title: "投稿作成", comp_subtitle: "投稿の下書き、RSSからのAIリライト、各プラットフォームへの手動公開を行います。", comp_manage_channels: "公開チャンネルを管理",
    an_title: "分析", an_subtitle: "すべてのプラットフォームの投稿状況を追跡します。", sm_title: "チャンネル設定", sm_subtitle: "Facebook、Instagram、WhatsApp、Zalo、その他のチャットAPIのページ／アカウントとトークンを管理します。"
  },
  es: {
    nav_overview: "Resumen", nav_bot_settings: "Configuración del bot", nav_agent_chat: "Chat con el agente", nav_knowledge: "Base de conocimiento", nav_messages: "Historial de chats", nav_leads: "Clientes potenciales", nav_billing: "Facturación", nav_posts: "Publicaciones sociales", nav_composer: "Redactor", nav_analytics: "Analítica", nav_sm_config: "Configuración de canales", nav_loyalty: "Clientes y fidelización", nav_social_media: "Redes sociales", logout: "Cerrar sesión",
    language: "Idioma", cfg_response_language: "Idioma de respuesta", cfg_response_language_hint: "El modo automático detecta el idioma del cliente; selecciona uno para fijarlo.", comp_content_language: "Idioma del contenido", lang_auto_customer: "Automático: idioma del cliente", lang_auto_interface: "Automático: idioma de la interfaz", btn_save: "Guardar", btn_cancel: "Cancelar", btn_delete: "Eliminar", btn_add: "Añadir", btn_search: "Buscar", btn_send: "Enviar", loading: "Cargando...",
    idx_title: "Centro de IA para clientes",
    cfg_breadcrumb: "Configuración del bot", cfg_title: "Configurar asistente", cfg_subtitle: "Configura la personalidad, el comportamiento y los parámetros técnicos de tu chatbot.", cfg_agentchat_banner_title: "Chat con el agente de IA", cfg_agentchat_banner_sub: "Habla para configurar el sistema sin buscar entre los formularios. Abre la página dedicada.", cfg_card_api_title: "API para sistemas externos", cfg_card_agent_title: "Agente de operaciones de IA", cfg_card_tools_title: "Herramientas personalizadas del agente (API externas)", cfg_card_persona_title: "Personalidad del sistema",
    ac_breadcrumb: "Chat con el agente de IA", ac_title: "Chat con el agente de IA", ac_subtitle: "Habla con normalidad: el agente entiende y configura el sistema mediante la API, sin formularios.", ac_warning_html: 'Lo que escribas (incluidos tokens o claves API) se enviará al modelo de IA. Pega tokens solo si confías en el proxy de IA configurado para este sistema (consulta <a href="config.html">Configuración del bot</a>).', ac_input_placeholder: "Escribe una solicitud de configuración... (Enter para enviar)", ac_empty: "Aún no hay mensajes. Prueba una sugerencia o escribe tu solicitud.", ac_capabilities_title: "¿Qué puede hacer este agente?", ac_capabilities_hint: "Esta lista procede directamente del backend y refleja siempre lo que el agente puede hacer.",
    kb_title_top: "Base de conocimiento", kb_title: "Base de conocimiento", kb_subtitle: "Añade y gestiona el contenido que aprende tu bot. Pega texto y se dividirá y vectorizará automáticamente.", kb_search_placeholder: "Buscar documentos...",
    msg_title_top: "Historial de chats", msg_recent_sessions: "Sesiones recientes", msg_filter_all: "Todas", msg_filter_needs_human: "Requiere atención", msg_select_session: "Selecciona una sesión", msg_select_session_hint: "Haz clic en un cliente de la izquierda para ver los mensajes",
    bill_title_top: "Panel", bill_title: "Facturación y uso", bill_subtitle: "Gestiona tu plan, límites e historial de transacciones.",
    post_title: "Publicaciones inmobiliarias", post_subtitle: "Gestiona, aprueba y controla publicaciones automáticas en redes sociales", post_btn_refresh: "Actualizar",
    comp_title: "Redactor", comp_subtitle: "Redacta publicaciones, usa IA para reescribir desde RSS y publica manualmente en tus plataformas.", comp_manage_channels: "Gestionar canales de publicación",
    an_title: "Analítica", an_subtitle: "Controla el estado de las publicaciones en todas las plataformas.", sm_title: "Configuración de canales", sm_subtitle: "Gestiona páginas, cuentas y tokens de Facebook, Instagram, WhatsApp, Zalo y otras API de chat."
  },
  fr: {
    nav_overview: "Vue d’ensemble", nav_bot_settings: "Paramètres du bot", nav_agent_chat: "Discuter avec l’agent", nav_knowledge: "Base de connaissances", nav_messages: "Historique des chats", nav_leads: "Prospects", nav_billing: "Facturation", nav_posts: "Publications sociales", nav_composer: "Rédacteur", nav_analytics: "Analytique", nav_sm_config: "Paramètres des canaux", nav_loyalty: "Clients et fidélité", nav_social_media: "Réseaux sociaux", logout: "Se déconnecter",
    language: "Langue", cfg_response_language: "Langue de réponse", cfg_response_language_hint: "Le mode automatique détecte la langue du client ; sélectionnez une langue pour la fixer.", comp_content_language: "Langue du contenu", lang_auto_customer: "Auto — langue du client", lang_auto_interface: "Auto — langue de l’interface", btn_save: "Enregistrer", btn_cancel: "Annuler", btn_delete: "Supprimer", btn_add: "Ajouter", btn_search: "Rechercher", btn_send: "Envoyer", loading: "Chargement...",
    idx_title: "Hub IA client",
    cfg_breadcrumb: "Configuration du bot", cfg_title: "Configurer l’assistant", cfg_subtitle: "Configurez la personnalité, le comportement et les paramètres techniques de votre chatbot.", cfg_agentchat_banner_title: "Discuter avec l’agent IA", cfg_agentchat_banner_sub: "Discutez simplement pour configurer le système sans parcourir les formulaires. Ouvrez la page dédiée.", cfg_card_api_title: "API pour les systèmes externes", cfg_card_agent_title: "Agent d’exploitation IA", cfg_card_tools_title: "Outils personnalisés de l’agent (API externes)", cfg_card_persona_title: "Personnalité du système",
    ac_breadcrumb: "Discuter avec l’agent IA", ac_title: "Discuter avec l’agent IA", ac_subtitle: "Parlez normalement : l’agent comprend et configure le système via l’API, sans formulaire.", ac_warning_html: 'Votre saisie (y compris les jetons ou clés API) est envoyée au modèle IA. Ne collez des jetons que si vous faites confiance au proxy IA configuré pour ce système (voir <a href="config.html">Paramètres du bot</a>).', ac_input_placeholder: "Saisissez une demande de configuration... (Entrée pour envoyer)", ac_empty: "Aucun message pour le moment. Essayez une suggestion ou saisissez votre demande.", ac_capabilities_title: "Que peut faire cet agent ?", ac_capabilities_hint: "Cette liste provient directement du backend et reflète toujours les capacités réelles de l’agent.",
    kb_title_top: "Base de connaissances", kb_title: "Base de connaissances", kb_subtitle: "Ajoutez et gérez le contenu appris par votre bot. Collez du texte : il sera automatiquement segmenté et vectorisé.", kb_search_placeholder: "Rechercher des documents...",
    msg_title_top: "Historique des chats", msg_recent_sessions: "Sessions récentes", msg_filter_all: "Toutes", msg_filter_needs_human: "Attention requise", msg_select_session: "Sélectionnez une session", msg_select_session_hint: "Cliquez sur un client à gauche pour afficher les messages",
    bill_title_top: "Tableau de bord", bill_title: "Facturation et utilisation", bill_subtitle: "Gérez votre forfait, vos limites et l’historique des transactions.",
    post_title: "Publications immobilières", post_subtitle: "Gérez, approuvez et suivez les publications automatiques sur les réseaux sociaux", post_btn_refresh: "Actualiser",
    comp_title: "Rédacteur", comp_subtitle: "Rédigez des publications, utilisez l’IA pour réécrire depuis RSS et publiez manuellement sur vos plateformes.", comp_manage_channels: "Gérer les canaux de publication",
    an_title: "Analytique", an_subtitle: "Suivez l’état des publications sur toutes les plateformes.", sm_title: "Paramètres des canaux", sm_subtitle: "Gérez les pages, comptes et jetons Facebook, Instagram, WhatsApp, Zalo et autres API de chat."
  },
  ko: {
    nav_overview: "개요", nav_bot_settings: "봇 설정", nav_agent_chat: "에이전트와 채팅", nav_knowledge: "지식 베이스", nav_messages: "채팅 기록", nav_leads: "잠재 고객", nav_billing: "결제", nav_posts: "소셜 게시물", nav_composer: "게시물 작성", nav_analytics: "분석", nav_sm_config: "채널 설정", nav_loyalty: "고객 및 로열티", nav_social_media: "소셜 미디어", logout: "로그아웃",
    language: "언어", cfg_response_language: "응답 언어", cfg_response_language_hint: "자동 모드는 고객 언어를 감지합니다. 고정하려면 언어를 선택하세요.", comp_content_language: "콘텐츠 언어", lang_auto_customer: "자동 — 고객 언어", lang_auto_interface: "자동 — 인터페이스 언어", btn_save: "저장", btn_cancel: "취소", btn_delete: "삭제", btn_add: "추가", btn_search: "검색", btn_send: "보내기", loading: "불러오는 중...",
    idx_title: "고객 AI 허브",
    cfg_breadcrumb: "봇 설정", cfg_title: "어시스턴트 설정", cfg_subtitle: "챗봇의 성격, 동작 및 기술 매개변수를 설정합니다.", cfg_agentchat_banner_title: "AI 에이전트와 채팅", cfg_agentchat_banner_sub: "대화만으로 시스템을 설정할 수 있습니다. 아래 폼을 찾을 필요 없이 전용 페이지를 여세요.", cfg_card_api_title: "외부 시스템용 API", cfg_card_agent_title: "AI 운영 에이전트", cfg_card_tools_title: "에이전트 사용자 지정 도구(외부 API)", cfg_card_persona_title: "시스템 페르소나",
    ac_breadcrumb: "AI 에이전트와 채팅", ac_title: "AI 에이전트와 채팅", ac_subtitle: "자연스럽게 말하면 에이전트가 이해하고 API를 통해 시스템을 설정합니다.", ac_warning_html: '입력한 내용(토큰 또는 API 키 포함)은 AI 모델로 전송됩니다. 이 시스템에 설정된 AI 프록시를 신뢰하는 경우에만 토큰을 붙여 넣으세요(<a href="config.html">봇 설정</a> 참조).', ac_input_placeholder: "설정 요청 입력... (Enter로 전송)", ac_empty: "아직 메시지가 없습니다. 아래 제안을 선택하거나 요청을 입력하세요.", ac_capabilities_title: "이 에이전트가 할 수 있는 일", ac_capabilities_hint: "이 목록은 백엔드에서 직접 가져오므로 에이전트의 실제 기능을 항상 정확하게 반영합니다.",
    kb_title_top: "지식 베이스", kb_title: "지식 베이스", kb_subtitle: "봇이 학습할 콘텐츠를 추가하고 관리합니다. 텍스트를 붙여 넣으면 자동으로 분할하고 임베딩합니다.", kb_search_placeholder: "문서 검색...",
    msg_title_top: "채팅 기록", msg_recent_sessions: "최근 세션", msg_filter_all: "전체", msg_filter_needs_human: "확인 필요", msg_select_session: "채팅 세션 선택", msg_select_session_hint: "왼쪽의 고객을 클릭하여 메시지를 확인하세요",
    bill_title_top: "대시보드", bill_title: "결제 및 사용량", bill_subtitle: "요금제, 한도 및 거래 내역을 관리합니다.",
    post_title: "부동산 게시물", post_subtitle: "소셜 미디어에 자동 게시되는 글을 관리, 승인 및 추적합니다", post_btn_refresh: "새로고침",
    comp_title: "게시물 작성", comp_subtitle: "게시물을 작성하고 AI로 RSS 콘텐츠를 다시 쓰며 플랫폼에 직접 게시합니다.", comp_manage_channels: "게시 채널 관리",
    an_title: "분석", an_subtitle: "모든 플랫폼의 게시 상태를 추적합니다.", sm_title: "채널 설정", sm_subtitle: "Facebook, Instagram, WhatsApp, Zalo 및 기타 채팅 API의 페이지/계정과 토큰을 관리합니다."
  }
};

const SUPPORTED_LANGS = ["vi", "en", "ja", "es", "fr", "ko"];

// Bảng này chứa toàn bộ nội dung cũ viết trực tiếp trong HTML/JavaScript.
// Tải riêng để file từ điển chính vẫn dễ bảo trì; khi tải xong trang sẽ được dịch lại.
if (!window.I18N_CONTENT) {
  const contentScript = document.createElement("script");
  contentScript.src = "_shared/i18n-content.js?v=20260814-1";
  contentScript.onload = () => applyI18n();
  document.head.appendChild(contentScript);
}

const ORIGINAL_TEXT = new WeakMap();
const ORIGINAL_ATTRS = new WeakMap();
const LAST_TRANSLATED_TEXT = new WeakMap();
const LAST_TRANSLATED_ATTRS = new WeakMap();

function translateDynamicText(source, translations) {
  if (!source || !translations) return null;
  if (translations[source]) return translations[source];

  // Các bộ đếm được render lại bằng JavaScript nên giá trị đầy đủ không thể
  // nằm sẵn trong từ điển (ví dụ "12 Hoạt động", "35 dòng").
  const counterMatch = source.match(/^(\d+)\s+(Hoạt động|dòng|bài|tài liệu|ký tự)$/);
  if (counterMatch && translations[counterMatch[2]]) {
    return `${counterMatch[1]} ${translations[counterMatch[2]]}`;
  }

  // Giữ nguyên chi tiết kỹ thuật từ API, chỉ dịch phần nhãn lỗi/trạng thái.
  const prefixes = [
    "Lỗi tải dữ liệu:", "Lỗi khởi tạo:", "Lỗi cập nhật:", "Lỗi upload:",
    "Lỗi lưu:", "Lỗi xoá:", "Lỗi xóa:", "Lỗi chạy Agent:",
  ];
  const prefix = prefixes.find((item) => source.startsWith(`${item} `));
  if (prefix && translations[prefix]) {
    return `${translations[prefix]} ${source.slice(prefix.length + 1)}`;
  }
  return null;
}

function translateLegacyContent(root = document) {
  const lang = getLang();
  const translations = window.I18N_CONTENT && window.I18N_CONTENT[lang];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, [data-i18n], [data-i18n-html]")) return;
    const previousRendered = LAST_TRANSLATED_TEXT.get(node);
    if (!ORIGINAL_TEXT.has(node) || (previousRendered !== undefined && node.nodeValue !== previousRendered)) {
      ORIGINAL_TEXT.set(node, node.nodeValue);
    }
    const original = ORIGINAL_TEXT.get(node);
    const trimmed = original.trim();
    if (!trimmed) return;
    const translated = lang === "vi" ? trimmed : translateDynamicText(trimmed, translations);
    if (!translated) {
      LAST_TRANSLATED_TEXT.delete(node);
      return;
    }
    const rendered = original.replace(trimmed, translated);
    if (node.nodeValue !== rendered) node.nodeValue = rendered;
    LAST_TRANSLATED_TEXT.set(node, rendered);
  });

  const elements = root.querySelectorAll ? root.querySelectorAll("[placeholder], [title], [aria-label]") : [];
  elements.forEach((el) => {
    let originals = ORIGINAL_ATTRS.get(el);
    if (!originals) {
      originals = {};
      ORIGINAL_ATTRS.set(el, originals);
    }
    let renderedAttrs = LAST_TRANSLATED_ATTRS.get(el);
    if (!renderedAttrs) {
      renderedAttrs = {};
      LAST_TRANSLATED_ATTRS.set(el, renderedAttrs);
    }
    ["placeholder", "title", "aria-label"].forEach((attr) => {
      if (!el.hasAttribute(attr) || el.hasAttribute(`data-i18n-${attr}`)) return;
      const current = el.getAttribute(attr);
      if (!(attr in originals) || (attr in renderedAttrs && current !== renderedAttrs[attr])) originals[attr] = current;
      const original = originals[attr];
      const translated = lang === "vi" ? original : translateDynamicText(original, translations);
      if (translated) {
        if (el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
        renderedAttrs[attr] = translated;
      }
    });
  });
}

function getLang() {
  const saved = localStorage.getItem("lang") || "vi";
  return SUPPORTED_LANGS.includes(saved) ? saved : "vi";
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
  translateLegacyContent(document);
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  localStorage.setItem("lang", lang);
  applyI18n();
  if (typeof renderSidebar === "function" && window.AUTH_USER) {
    renderSidebar(window.AUTH_USER);
    applyI18n();
  }
  window.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) translateLegacyContent(node);
      else if (node.nodeType === Node.TEXT_NODE && node.parentElement) translateLegacyContent(node.parentElement);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
});
