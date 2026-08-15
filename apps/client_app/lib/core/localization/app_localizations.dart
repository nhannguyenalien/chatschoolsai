import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const supportedLocales = [
  Locale('vi'),
  Locale('en'),
  Locale('ja'),
  Locale('es'),
  Locale('fr'),
  Locale('ko'),
];

const languageNames = {
  'vi': 'Tiếng Việt',
  'en': 'English',
  'ja': '日本語',
  'es': 'Español',
  'fr': 'Français',
  'ko': '한국어',
};

final localeProvider = StateNotifierProvider<LocaleController, Locale>(
  (ref) => LocaleController(),
);

class LocaleController extends StateNotifier<Locale> {
  LocaleController() : super(const Locale('vi')) {
    _restore();
  }

  Future<void> _restore() async {
    final code = (await SharedPreferences.getInstance()).getString('language');
    if (code != null &&
        supportedLocales.any((locale) => locale.languageCode == code)) {
      state = Locale(code);
    }
  }

  Future<void> setLocale(Locale locale) async {
    if (!supportedLocales.contains(locale)) return;
    state = locale;
    await (await SharedPreferences.getInstance()).setString(
      'language',
      locale.languageCode,
    );
  }
}

class AppLocalizations {
  const AppLocalizations(this.locale);
  final Locale locale;

  static const delegate = _AppLocalizationsDelegate();

  static AppLocalizations of(BuildContext context) =>
      Localizations.of<AppLocalizations>(context, AppLocalizations) ??
      const AppLocalizations(Locale('vi'));

  String tr(String key) =>
      _deepTranslations[locale.languageCode]?[key] ??
      _translations[locale.languageCode]?[key] ??
      _deepTranslations['en']?[key] ??
      _translations['vi']![key] ??
      key;
}

extension LocalizationContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => supportedLocales.any(
    (value) => value.languageCode == locale.languageCode,
  );

  @override
  Future<AppLocalizations> load(Locale locale) async =>
      AppLocalizations(locale);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

// Detailed feature copy. Keeping it separate makes missing deep-screen strings
// easy to audit while sharing the same lookup API.
const _deepTranslations = <String, Map<String, String>>{
  'vi': {
    'chatbot_manage': 'Quản lý chatbot',
    'new_bot': 'Tạo bot mới',
    'configuration': 'Cấu hình',
    'training': 'Training',
    'test_chatbot': 'Thử chatbot',
    'bot_id_label': 'Mã bot (ví dụ: tuvan-tuyensinh)',
    'bot_name': 'Tên bot',
    'complete_bot_fields': 'Vui lòng nhập đủ mã bot và tên bot.',
    'create_bot': 'Tạo bot',
    'bot_created': 'Đã tạo và chuyển sang bot',
    'usage_notice':
        'Tin nhắn tại đây chạy qua chatbot thật và được tính vào lượt sử dụng.',
    'new_chat': 'Cuộc chat mới',
    'training_question': 'Hãy hỏi một câu có trong dữ liệu training.',
    'chatbot_question_hint': 'Nhập câu hỏi để thử chatbot…',
    'no_config': 'Chưa có cấu hình.',
    'greeting': 'Lời chào',
    'save_config': 'Lưu cấu hình',
    'config_saved': 'Đã lưu cấu hình chatbot.',
    'number_0_2': 'Nhập số từ 0 đến 2',
    'number_1_32768': 'Từ 1 đến 32768',
    'add_document': 'Thêm tài liệu',
    'sync_again': 'Đồng bộ lại',
    'no_training': 'Chưa có dữ liệu training.',
    'characters': 'ký tự',
    'delete': 'Xóa',
    'add_training': 'Thêm dữ liệu training',
    'title': 'Tiêu đề',
    'content': 'Nội dung',
    'add': 'Thêm',
    'delete_training': 'Xóa dữ liệu training?',
    'delete_training_body': 'sẽ bị xóa khỏi kho kiến thức chatbot.',
    'messages_subtitle':
        'Xem lịch sử trò chuyện và tiếp nhận các cuộc hội thoại cần hỗ trợ.',
    'all': 'Tất cả',
    'needs_attention': 'Cần xử lý',
    'no_conversations': 'Chưa có cuộc trò chuyện nào.',
    'session': 'Phiên',
    'admin_reply_hint': 'Nhập phản hồi với tư cách Admin…',
    'send_reply': 'Gửi phản hồi',
    'reply_failed': 'Không gửi được phản hồi',
    'select_conversation': 'Chọn một cuộc trò chuyện để xem lịch sử.',
    'schedule_title': 'Lịch đăng tự động',
    'schedule_subtitle':
        'Đặt ngày và khung giờ xuất bản blog hoặc nội dung mạng xã hội.',
    'add_schedule': 'Thêm lịch',
    'no_schedule': 'Chưa có lịch tự động.',
    'social_media': 'Mạng xã hội',
    'every_day': 'Mọi ngày',
    'edit': 'Sửa',
    'delete_schedule_confirm': 'Xoá lịch này?',
    'planning_subtitle':
        'Lập nhịp nội dung, duyệt chủ đề AI và vận hành hàng đợi tạo bài.',
    'create_plan': 'Tạo plan',
    'no_plan': 'Chưa có content plan. Tạo plan để bắt đầu.',
    'suggested_topics': 'Chủ đề đề xuất & hàng đợi duyệt',
    'suggest_ai': 'Đề xuất chủ đề AI',
    'import_trend_json': 'Nhập trend JSON',
    'add_to_plan': 'Đưa vào plan',
    'create_draft': 'Tạo bản nháp',
    'translate_post': 'Dịch bài',
    'approve': 'Duyệt',
    'reject': 'Từ chối',
    'select_plan': 'Chọn content plan',
    'schedule_30_days': 'Xếp lịch 30 ngày',
    'edit_plan': 'Sửa plan',
    'pause': 'Tạm dừng',
    'activate': 'Kích hoạt',
    'analytics_subtitle':
        'Theo dõi hiệu quả GSC/GA4. Chỉ số dùng để tư vấn, không tự sửa nội dung.',
    'import_json': 'Nhập JSON',
    'select_site': 'Chọn site',
    'cancel_alt': 'Huỷ',
    'save': 'Lưu',
    'confirm': 'Xác nhận',
    'updated_success': 'Đã cập nhật thành công.',
    'update_failed': 'Không thể cập nhật',
  },
  'en': {
    'chatbot_manage': 'Manage chatbot',
    'new_bot': 'Create bot',
    'configuration': 'Configuration',
    'training': 'Training',
    'test_chatbot': 'Test chatbot',
    'bot_id_label': 'Bot ID (e.g. admissions-advisor)',
    'bot_name': 'Bot name',
    'complete_bot_fields': 'Enter both the bot ID and bot name.',
    'create_bot': 'Create bot',
    'bot_created': 'Created and switched to bot',
    'usage_notice':
        'Messages here use the live chatbot and count toward usage.',
    'new_chat': 'New chat',
    'training_question': 'Ask a question covered by your training data.',
    'chatbot_question_hint': 'Enter a question to test the chatbot…',
    'no_config': 'No configuration yet.',
    'greeting': 'Greeting',
    'save_config': 'Save configuration',
    'config_saved': 'Chatbot configuration saved.',
    'number_0_2': 'Enter a number from 0 to 2',
    'number_1_32768': 'Enter 1 to 32768',
    'add_document': 'Add document',
    'sync_again': 'Sync again',
    'no_training': 'No training data yet.',
    'characters': 'characters',
    'delete': 'Delete',
    'add_training': 'Add training data',
    'title': 'Title',
    'content': 'Content',
    'add': 'Add',
    'delete_training': 'Delete training data?',
    'delete_training_body': 'will be removed from the chatbot knowledge base.',
    'messages_subtitle':
        'Review chat history and handle conversations that need support.',
    'all': 'All',
    'needs_attention': 'Needs attention',
    'no_conversations': 'No conversations yet.',
    'session': 'Session',
    'admin_reply_hint': 'Reply as Admin…',
    'send_reply': 'Send reply',
    'reply_failed': 'Could not send reply',
    'select_conversation': 'Select a conversation to view its history.',
    'schedule_title': 'Automatic publishing schedule',
    'schedule_subtitle':
        'Set publishing days and times for blog or social content.',
    'add_schedule': 'Add schedule',
    'no_schedule': 'No automatic schedules yet.',
    'social_media': 'Social media',
    'every_day': 'Every day',
    'edit': 'Edit',
    'delete_schedule_confirm': 'Delete this schedule?',
    'planning_subtitle':
        'Plan your content cadence, review AI topics, and manage the post creation queue.',
    'create_plan': 'Create plan',
    'no_plan': 'No content plan yet. Create one to get started.',
    'suggested_topics': 'Suggested topics & review queue',
    'suggest_ai': 'Suggest topics with AI',
    'import_trend_json': 'Import trend JSON',
    'add_to_plan': 'Add to plan',
    'create_draft': 'Create draft',
    'translate_post': 'Translate post',
    'approve': 'Approve',
    'reject': 'Reject',
    'select_plan': 'Select content plan',
    'schedule_30_days': 'Schedule 30 days',
    'edit_plan': 'Edit plan',
    'pause': 'Pause',
    'activate': 'Activate',
    'analytics_subtitle':
        'Monitor GSC/GA4 performance. Metrics provide recommendations and never alter content automatically.',
    'import_json': 'Import JSON',
    'select_site': 'Select site',
    'cancel_alt': 'Cancel',
    'save': 'Save',
    'confirm': 'Confirm',
    'updated_success': 'Updated successfully.',
    'update_failed': 'Could not update',
  },
  'ja': {
    'chatbot_manage': 'チャットボット管理',
    'new_bot': 'ボット作成',
    'configuration': '設定',
    'training': 'トレーニング',
    'test_chatbot': 'チャットボットをテスト',
    'messages_subtitle': 'チャット履歴を確認し、サポートが必要な会話に対応します。',
    'all': 'すべて',
    'needs_attention': '対応が必要',
    'no_conversations': '会話はまだありません。',
    'select_conversation': '履歴を表示する会話を選択してください。',
  },
  'es': {
    'chatbot_manage': 'Gestionar chatbot',
    'new_bot': 'Crear bot',
    'configuration': 'Configuración',
    'training': 'Entrenamiento',
    'test_chatbot': 'Probar chatbot',
    'messages_subtitle':
        'Revisa el historial y atiende las conversaciones que necesitan ayuda.',
    'all': 'Todas',
    'needs_attention': 'Requiere atención',
    'no_conversations': 'Aún no hay conversaciones.',
    'select_conversation': 'Selecciona una conversación para ver el historial.',
  },
  'fr': {
    'chatbot_manage': 'Gérer le chatbot',
    'new_bot': 'Créer un bot',
    'configuration': 'Configuration',
    'training': 'Entraînement',
    'test_chatbot': 'Tester le chatbot',
    'messages_subtitle':
        'Consultez l’historique et traitez les conversations nécessitant une assistance.',
    'all': 'Toutes',
    'needs_attention': 'À traiter',
    'no_conversations': 'Aucune conversation.',
    'select_conversation':
        'Sélectionnez une conversation pour afficher son historique.',
  },
  'ko': {
    'chatbot_manage': '챗봇 관리',
    'new_bot': '봇 만들기',
    'configuration': '설정',
    'training': '학습',
    'test_chatbot': '챗봇 테스트',
    'messages_subtitle': '채팅 기록을 확인하고 지원이 필요한 대화를 처리하세요.',
    'all': '전체',
    'needs_attention': '처리 필요',
    'no_conversations': '아직 대화가 없습니다.',
    'select_conversation': '기록을 볼 대화를 선택하세요.',
  },
};

const _translations = <String, Map<String, String>>{
  'vi': {
    'language': 'Ngôn ngữ',
    'logout': 'Đăng xuất',
    'retry': 'Thử lại',
    'cancel': 'Hủy',
    'create': 'Tạo',
    'send': 'Gửi',
    'nav_overview': 'Tổng quan',
    'nav_agent': 'Agent',
    'nav_chatbot': 'Chatbot',
    'nav_messages': 'Tin nhắn',
    'nav_content': 'Nội dung',
    'nav_loyalty': 'Loyalty',
    'login_subtitle': 'Đăng nhập để quản lý và huấn luyện chatbot',
    'continue_google': 'Tiếp tục với Google',
    'create_account_bot': 'Tạo tài khoản và bot mới',
    'api_login_dev': 'Đăng nhập bằng API key (phát triển)',
    'continue_api': 'Tiếp tục bằng API key',
    'create_account': 'Tạo tài khoản',
    'your_name': 'Tên của bạn',
    'password_hint': 'Mật khẩu (ít nhất 8 ký tự)',
    'tenant_hint': 'Mã bot, ví dụ: truong-abc',
    'bot_name_hint': 'Tên bot, ví dụ: Trợ lý ABC',
    'required': 'Không được để trống',
    'password_short': 'Mật khẩu phải có ít nhất 8 ký tự.',
    'creating': 'Đang tạo…',
    'create_login': 'Tạo và đăng nhập',
    'overview_subtitle':
        'Theo dõi quy trình nội dung của trường theo thời gian thực.',
    'workspace': 'Không gian làm việc',
    'pending': 'Chờ duyệt',
    'approved': 'Đã duyệt',
    'scheduled': 'Đã lên lịch',
    'publishing': 'Đang đăng',
    'published': 'Đã đăng',
    'error': 'Lỗi',
    'load_failed': 'Không tải được dữ liệu',
    'posts': 'Bài viết',
    'auto_schedule': 'Lịch tự động',
    'content_plan': 'Content plan',
    'analytics': 'Analytics',
    'loyalty_desc':
        'Quản lý tương tác và chương trình gắn kết cộng đồng nhà trường.',
    'members': 'Thành viên',
    'members_desc': 'Tổng hợp hồ sơ và mức độ tương tác.',
    'points_tiers': 'Điểm & hạng',
    'points_desc': 'Thiết kế cơ chế ghi nhận phù hợp.',
    'rewards': 'Phần thưởng',
    'rewards_desc': 'Quản lý ưu đãi và lịch sử đổi thưởng.',
  },
  'en': {
    'language': 'Language',
    'logout': 'Log out',
    'retry': 'Retry',
    'cancel': 'Cancel',
    'create': 'Create',
    'send': 'Send',
    'nav_overview': 'Overview',
    'nav_agent': 'Agent',
    'nav_chatbot': 'Chatbot',
    'nav_messages': 'Messages',
    'nav_content': 'Content',
    'nav_loyalty': 'Loyalty',
    'login_subtitle': 'Sign in to manage and train your chatbot',
    'continue_google': 'Continue with Google',
    'create_account_bot': 'Create an account and new bot',
    'api_login_dev': 'Sign in with API key (development)',
    'continue_api': 'Continue with API key',
    'create_account': 'Create account',
    'your_name': 'Your name',
    'password_hint': 'Password (at least 8 characters)',
    'tenant_hint': 'Bot ID, e.g. school-abc',
    'bot_name_hint': 'Bot name, e.g. ABC Assistant',
    'required': 'This field is required',
    'password_short': 'Password must contain at least 8 characters.',
    'creating': 'Creating…',
    'create_login': 'Create and sign in',
    'overview_subtitle': "Monitor your school's content workflow in real time.",
    'workspace': 'Workspace',
    'pending': 'Pending',
    'approved': 'Approved',
    'scheduled': 'Scheduled',
    'publishing': 'Publishing',
    'published': 'Published',
    'error': 'Error',
    'load_failed': 'Could not load data',
    'posts': 'Posts',
    'auto_schedule': 'Auto schedule',
    'content_plan': 'Content plan',
    'analytics': 'Analytics',
    'loyalty_desc': 'Manage engagement and community loyalty programs.',
    'members': 'Members',
    'members_desc': 'View profiles and engagement levels.',
    'points_tiers': 'Points & tiers',
    'points_desc': 'Design an appropriate recognition system.',
    'rewards': 'Rewards',
    'rewards_desc': 'Manage benefits and redemption history.',
  },
  'ja': {
    'language': '言語',
    'logout': 'ログアウト',
    'retry': '再試行',
    'cancel': 'キャンセル',
    'create': '作成',
    'send': '送信',
    'nav_overview': '概要',
    'nav_agent': 'エージェント',
    'nav_chatbot': 'チャットボット',
    'nav_messages': 'メッセージ',
    'nav_content': 'コンテンツ',
    'nav_loyalty': 'ロイヤルティ',
    'login_subtitle': 'ログインしてチャットボットを管理・学習',
    'continue_google': 'Googleで続行',
    'create_account_bot': 'アカウントと新しいボットを作成',
    'api_login_dev': 'APIキーでログイン（開発用）',
    'continue_api': 'APIキーで続行',
    'create_account': 'アカウント作成',
    'your_name': 'お名前',
    'password_hint': 'パスワード（8文字以上）',
    'tenant_hint': 'ボットID（例：school-abc）',
    'bot_name_hint': 'ボット名（例：ABCアシスタント）',
    'required': '必須項目です',
    'password_short': 'パスワードは8文字以上必要です。',
    'creating': '作成中…',
    'create_login': '作成してログイン',
    'overview_subtitle': '学校のコンテンツワークフローをリアルタイムで確認します。',
    'workspace': 'ワークスペース',
    'pending': '承認待ち',
    'approved': '承認済み',
    'scheduled': '予約済み',
    'publishing': '公開中',
    'published': '公開済み',
    'error': 'エラー',
    'load_failed': 'データを読み込めません',
    'posts': '投稿',
    'auto_schedule': '自動スケジュール',
    'content_plan': 'コンテンツ計画',
    'analytics': '分析',
    'loyalty_desc': '学校コミュニティの交流とロイヤルティを管理します。',
    'members': 'メンバー',
    'members_desc': 'プロフィールと交流状況を確認します。',
    'points_tiers': 'ポイント・ランク',
    'points_desc': '適切な評価制度を設計します。',
    'rewards': '特典',
    'rewards_desc': '特典と交換履歴を管理します。',
  },
  'es': {
    'language': 'Idioma',
    'logout': 'Cerrar sesión',
    'retry': 'Reintentar',
    'cancel': 'Cancelar',
    'create': 'Crear',
    'send': 'Enviar',
    'nav_overview': 'Resumen',
    'nav_agent': 'Agente',
    'nav_chatbot': 'Chatbot',
    'nav_messages': 'Mensajes',
    'nav_content': 'Contenido',
    'nav_loyalty': 'Fidelización',
    'login_subtitle': 'Inicia sesión para gestionar y entrenar tu chatbot',
    'continue_google': 'Continuar con Google',
    'create_account_bot': 'Crear una cuenta y un bot nuevo',
    'api_login_dev': 'Iniciar sesión con clave API (desarrollo)',
    'continue_api': 'Continuar con clave API',
    'create_account': 'Crear cuenta',
    'your_name': 'Tu nombre',
    'password_hint': 'Contraseña (mínimo 8 caracteres)',
    'tenant_hint': 'ID del bot, p. ej. escuela-abc',
    'bot_name_hint': 'Nombre del bot, p. ej. Asistente ABC',
    'required': 'Este campo es obligatorio',
    'password_short': 'La contraseña debe tener al menos 8 caracteres.',
    'creating': 'Creando…',
    'create_login': 'Crear e iniciar sesión',
    'overview_subtitle':
        'Supervisa el flujo de contenido de tu escuela en tiempo real.',
    'workspace': 'Espacio de trabajo',
    'pending': 'Pendiente',
    'approved': 'Aprobado',
    'scheduled': 'Programado',
    'publishing': 'Publicando',
    'published': 'Publicado',
    'error': 'Error',
    'load_failed': 'No se pudieron cargar los datos',
    'posts': 'Publicaciones',
    'auto_schedule': 'Programación automática',
    'content_plan': 'Plan de contenido',
    'analytics': 'Analítica',
    'loyalty_desc':
        'Gestiona la participación y fidelización de la comunidad escolar.',
    'members': 'Miembros',
    'members_desc': 'Consulta perfiles y niveles de participación.',
    'points_tiers': 'Puntos y niveles',
    'points_desc': 'Diseña un sistema de reconocimiento adecuado.',
    'rewards': 'Recompensas',
    'rewards_desc': 'Gestiona beneficios e historial de canjes.',
  },
  'fr': {
    'language': 'Langue',
    'logout': 'Se déconnecter',
    'retry': 'Réessayer',
    'cancel': 'Annuler',
    'create': 'Créer',
    'send': 'Envoyer',
    'nav_overview': 'Vue d’ensemble',
    'nav_agent': 'Agent',
    'nav_chatbot': 'Chatbot',
    'nav_messages': 'Messages',
    'nav_content': 'Contenu',
    'nav_loyalty': 'Fidélité',
    'login_subtitle': 'Connectez-vous pour gérer et entraîner votre chatbot',
    'continue_google': 'Continuer avec Google',
    'create_account_bot': 'Créer un compte et un nouveau bot',
    'api_login_dev': 'Connexion par clé API (développement)',
    'continue_api': 'Continuer avec la clé API',
    'create_account': 'Créer un compte',
    'your_name': 'Votre nom',
    'password_hint': 'Mot de passe (8 caractères minimum)',
    'tenant_hint': 'ID du bot, ex. ecole-abc',
    'bot_name_hint': 'Nom du bot, ex. Assistant ABC',
    'required': 'Ce champ est obligatoire',
    'password_short': 'Le mot de passe doit contenir au moins 8 caractères.',
    'creating': 'Création…',
    'create_login': 'Créer et se connecter',
    'overview_subtitle':
        'Suivez le flux de contenu de votre école en temps réel.',
    'workspace': 'Espace de travail',
    'pending': 'En attente',
    'approved': 'Approuvé',
    'scheduled': 'Planifié',
    'publishing': 'Publication',
    'published': 'Publié',
    'error': 'Erreur',
    'load_failed': 'Impossible de charger les données',
    'posts': 'Publications',
    'auto_schedule': 'Planning automatique',
    'content_plan': 'Plan de contenu',
    'analytics': 'Analytique',
    'loyalty_desc':
        'Gérez l’engagement et la fidélité de la communauté scolaire.',
    'members': 'Membres',
    'members_desc': 'Consultez les profils et niveaux d’engagement.',
    'points_tiers': 'Points et niveaux',
    'points_desc': 'Concevez un système de reconnaissance adapté.',
    'rewards': 'Récompenses',
    'rewards_desc': 'Gérez les avantages et l’historique des échanges.',
  },
  'ko': {
    'language': '언어',
    'logout': '로그아웃',
    'retry': '다시 시도',
    'cancel': '취소',
    'create': '만들기',
    'send': '보내기',
    'nav_overview': '개요',
    'nav_agent': '에이전트',
    'nav_chatbot': '챗봇',
    'nav_messages': '메시지',
    'nav_content': '콘텐츠',
    'nav_loyalty': '로열티',
    'login_subtitle': '로그인하여 챗봇을 관리하고 학습시키세요',
    'continue_google': 'Google로 계속',
    'create_account_bot': '계정 및 새 봇 만들기',
    'api_login_dev': 'API 키로 로그인(개발)',
    'continue_api': 'API 키로 계속',
    'create_account': '계정 만들기',
    'your_name': '이름',
    'password_hint': '비밀번호(8자 이상)',
    'tenant_hint': '봇 ID(예: school-abc)',
    'bot_name_hint': '봇 이름(예: ABC 도우미)',
    'required': '필수 입력 항목입니다',
    'password_short': '비밀번호는 8자 이상이어야 합니다.',
    'creating': '만드는 중…',
    'create_login': '만들고 로그인',
    'overview_subtitle': '학교 콘텐츠 워크플로를 실시간으로 확인합니다.',
    'workspace': '작업 공간',
    'pending': '승인 대기',
    'approved': '승인됨',
    'scheduled': '예약됨',
    'publishing': '게시 중',
    'published': '게시됨',
    'error': '오류',
    'load_failed': '데이터를 불러올 수 없습니다',
    'posts': '게시물',
    'auto_schedule': '자동 일정',
    'content_plan': '콘텐츠 계획',
    'analytics': '분석',
    'loyalty_desc': '학교 커뮤니티 참여와 로열티 프로그램을 관리합니다.',
    'members': '회원',
    'members_desc': '프로필과 참여 수준을 확인합니다.',
    'points_tiers': '포인트 및 등급',
    'points_desc': '적절한 인정 체계를 설계합니다.',
    'rewards': '보상',
    'rewards_desc': '혜택과 교환 내역을 관리합니다.',
  },
};

class LanguageMenu extends ConsumerWidget {
  const LanguageMenu({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeProvider).languageCode;
    return PopupMenuButton<String>(
      tooltip: context.l10n.tr('language'),
      icon: const Icon(Icons.language_rounded),
      initialValue: current,
      onSelected: (code) =>
          ref.read(localeProvider.notifier).setLocale(Locale(code)),
      itemBuilder: (_) => languageNames.entries
          .map(
            (entry) => PopupMenuItem(
              value: entry.key,
              child: Row(
                children: [
                  if (entry.key == current) const Icon(Icons.check, size: 18),
                  if (entry.key == current) const SizedBox(width: 8),
                  Text(entry.value),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}
