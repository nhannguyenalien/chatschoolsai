// Bản dịch trang Đặt lịch (booking.html). Mỗi dòng: [vi, en, ja, es, fr, ko]. Gộp vào bảng I18N_CONTENT của i18n.js.
(function () {
  var LANGS = ["vi", "en", "ja", "es", "fr", "ko"];
  var ROWS = [
    ["Đặt lịch — AI Admin", "Bookings — AI Admin", "予約 — AI Admin", "Reservas — AI Admin", "Réservations — AI Admin", "예약 — AI Admin"],
    ["Đặt lịch", "Bookings", "予約", "Reservas", "Réservations", "예약"],
    ["Lịch khách đặt qua chat và lịch thêm tay. Có lịch mới bạn sẽ nhận thông báo qua Telegram hoặc AI Agent tổng.", "Bookings made by customers in chat and added by hand. You get notified of new bookings via Telegram or the master AI Agent.", "チャットでお客様が予約した分と手動で追加した分の予定です。新しい予約はTelegramまたはマスターAIエージェントで通知されます。", "Reservas hechas por clientes en el chat y añadidas a mano. Recibirá avisos de nuevas reservas por Telegram o por el AI Agent principal.", "Réservations faites par les clients dans le chat et ajoutées à la main. Vous êtes prévenu des nouvelles réservations via Telegram ou l'agent IA principal.", "고객이 채팅으로 예약한 일정과 직접 추가한 일정입니다. 새 예약은 Telegram 또는 마스터 AI 에이전트로 알려 드립니다."],
    ["Bật đặt lịch cho chatbot", "Turn on bookings for your chatbot", "チャットボットの予約機能を有効にする", "Activar reservas en su chatbot", "Activer les réservations pour votre chatbot", "챗봇 예약 기능 켜기"],
    ["Chọn loại hình để điền sẵn giờ làm, dịch vụ và sức chứa, hoặc nhờ AI Agent tự cấu hình theo mô tả của bạn.", "Pick a business type to pre-fill opening hours, services and capacity, or ask the AI Agent to set it up from your description.", "業種を選ぶと営業時間・サービス・収容数が自動入力されます。説明からAIエージェントに設定させることもできます。", "Elija un tipo de negocio para rellenar horario, servicios y aforo, o pida al AI Agent que lo configure según su descripción.", "Choisissez un type d'activité pour préremplir horaires, services et capacité, ou demandez à l'agent IA de configurer selon votre description.", "업종을 선택하면 영업시간, 서비스, 수용 인원이 미리 채워집니다. 설명만으로 AI 에이전트가 설정하게 할 수도 있습니다."],
    ["Hôm nay", "Today", "今日", "Hoy", "Aujourd'hui", "오늘"],
    ["Ngày", "Day", "日", "Día", "Jour", "일"],
    ["Tuần", "Week", "週", "Semana", "Semaine", "주"],
    ["Link lịch (Google/Apple)", "Calendar link (Google/Apple)", "カレンダーリンク（Google/Apple）", "Enlace de calendario (Google/Apple)", "Lien du calendrier (Google/Apple)", "캘린더 링크 (Google/Apple)"],
    ["Chặn lịch", "Block time", "枠をブロック", "Bloquear horario", "Bloquer un créneau", "일정 차단"],
    ["Thêm lịch", "Add booking", "予約を追加", "Añadir reserva", "Ajouter une réservation", "예약 추가"],
    ["Đã xác nhận", "Confirmed", "確定", "Confirmada", "Confirmée", "확정"],
    ["Chờ xác nhận", "Pending", "確認待ち", "Pendiente", "En attente", "확인 대기"],
    ["Đã chặn", "Blocked", "ブロック済み", "Bloqueado", "Bloqué", "차단됨"],
    ["Đã huỷ", "Cancelled", "キャンセル済み", "Cancelada", "Annulée", "취소됨"],
    ["{} lịch chờ xác nhận", "{} pending bookings", "確認待ちの予約 {} 件", "{} reservas pendientes", "{} réservations en attente", "확인 대기 예약 {}건"],
    ["Dịch vụ", "Service", "サービス", "Servicio", "Service", "서비스"],
    ["Giờ", "Time", "時間", "Hora", "Heure", "시간"],
    ["Số đêm", "Nights", "泊数", "Noches", "Nuits", "숙박 일수"],
    ["Số khách", "Guests", "人数", "Personas", "Personnes", "인원"],
    ["Số phòng", "Rooms", "部屋数", "Habitaciones", "Chambres", "객실 수"],
    ["Tên khách", "Customer name", "お客様名", "Nombre del cliente", "Nom du client", "고객 이름"],
    ["Số điện thoại", "Phone number", "電話番号", "Teléfono", "Téléphone", "전화번호"],
    ["Ghi chú", "Notes", "メモ", "Notas", "Notes", "메모"],
    ["Lưu lịch", "Save booking", "予約を保存", "Guardar reserva", "Enregistrer", "예약 저장"],
    ["Khách sẽ không đặt được trong khoảng này. Để trống giờ để chặn cả ngày.", "Customers won't be able to book in this range. Leave the times empty to block the whole day.", "この期間はお客様が予約できなくなります。時間を空欄にすると終日ブロックされます。", "Los clientes no podrán reservar en este intervalo. Deje las horas vacías para bloquear todo el día.", "Les clients ne pourront pas réserver sur cette plage. Laissez les heures vides pour bloquer toute la journée.", "이 기간에는 고객이 예약할 수 없습니다. 시간을 비우면 하루 종일 차단됩니다."],
    ["Từ", "From", "開始", "Desde", "De", "시작"],
    ["Đến", "To", "終了", "Hasta", "À", "종료"],
    ["Áp dụng cho", "Applies to", "対象", "Se aplica a", "S'applique à", "적용 대상"],
    ["Cả cơ sở", "Whole venue", "施設全体", "Todo el local", "Tout l'établissement", "전체 매장"],
    ["Lý do", "Reason", "理由", "Motivo", "Motif", "사유"],
    ["Nghỉ lễ, bảo trì...", "Holiday, maintenance...", "祝日、メンテナンスなど", "Festivo, mantenimiento...", "Jour férié, maintenance...", "휴일, 점검 등"],
    ["Chặn", "Block", "ブロック", "Bloquear", "Bloquer", "차단"],
    ["Lịch đã chặn", "Blocked time", "ブロックした枠", "Horario bloqueado", "Créneau bloqué", "차단된 일정"],
    ["Đặt chỗ", "Booking", "予約", "Reserva", "Réservation", "예약"],
    ["Trống", "Free", "空き", "Libre", "Libre", "비어 있음"],
    ["Trạng thái", "Status", "ステータス", "Estado", "Statut", "상태"],
    ["Thời gian", "Time", "日時", "Fecha y hora", "Date et heure", "일시"],
    ["Khách", "Customer", "お客様", "Cliente", "Client", "고객"],
    ["Điện thoại", "Phone", "電話", "Teléfono", "Téléphone", "전화"],
    ["Số lượng", "Quantity", "数量", "Cantidad", "Quantité", "수량"],
    ["Phục vụ", "Served by", "担当", "Atiende", "Prise en charge", "담당"],
    ["Nguồn", "Source", "経路", "Origen", "Source", "경로"],
    ["Khách đặt qua chat", "Booked by customer in chat", "チャットで予約", "Reservada por el cliente en el chat", "Réservée par le client dans le chat", "고객이 채팅으로 예약"],
    ["Thêm tay", "Added manually", "手動で追加", "Añadida a mano", "Ajoutée manuellement", "직접 추가"],
    ["Xác nhận", "Confirm", "確定する", "Confirmar", "Confirmer", "확정"],
    ["Đưa về chờ", "Set to pending", "確認待ちに戻す", "Volver a pendiente", "Remettre en attente", "대기로 되돌리기"],
    ["Huỷ lịch", "Cancel booking", "予約をキャンセル", "Cancelar reserva", "Annuler la réservation", "예약 취소"],
    ["Bỏ chặn", "Unblock", "ブロック解除", "Desbloquear", "Débloquer", "차단 해제"],
    ["Lỗi tải lịch:", "Could not load bookings:", "予約を読み込めませんでした：", "No se pudieron cargar las reservas:", "Impossible de charger les réservations :", "예약을 불러오지 못했습니다:"],
    ["Đã bật đặt lịch", "Bookings enabled", "予約機能を有効にしました", "Reservas activadas", "Réservations activées", "예약 기능이 켜졌습니다"],
    ["Không bật được:", "Could not enable:", "有効にできませんでした：", "No se pudo activar:", "Activation impossible :", "켤 수 없습니다:"],
    ["Đã sao chép link. Dán vào Google Calendar → Thêm lịch → Từ URL.", "Link copied. Paste it in Google Calendar → Add calendar → From URL.", "リンクをコピーしました。Googleカレンダー → カレンダーを追加 → URLから、に貼り付けてください。", "Enlace copiado. Péguelo en Google Calendar → Añadir calendario → Desde URL.", "Lien copié. Collez-le dans Google Agenda → Ajouter un agenda → À partir de l'URL.", "링크를 복사했습니다. Google 캘린더 → 캘린더 추가 → URL로 추가에 붙여넣으세요."],
    ["Sao chép link lịch:", "Copy the calendar link:", "カレンダーリンクをコピー：", "Copie el enlace del calendario:", "Copiez le lien du calendrier :", "캘린더 링크를 복사하세요:"],
    ["Đã thêm lịch", "Booking added", "予約を追加しました", "Reserva añadida", "Réservation ajoutée", "예약이 추가되었습니다"],
    ["Đã chặn lịch", "Time blocked", "枠をブロックしました", "Horario bloqueado", "Créneau bloqué", "일정이 차단되었습니다"],
    ["Không cập nhật được:", "Could not update:", "更新できませんでした：", "No se pudo actualizar:", "Mise à jour impossible :", "업데이트할 수 없습니다:"],
    ["Ngành khác", "Other business", "その他の業種", "Otro negocio", "Autre activité", "기타 업종"],
    ["Mô tả cho AI Agent, ví dụ: \"sân pickleball 4 sân, mở 6h-22h, thuê 1 giờ 150k\"", "Describe it to the AI Agent, e.g. \"4 pickleball courts, open 6am-10pm, 1-hour rental $6\"", "AIエージェントに説明してください。例：「ピックルボールコート4面、6時〜22時、1時間レンタル」", "Descríbaselo al AI Agent, p. ej. \"4 pistas de pickleball, de 6 a 22 h, alquiler de 1 hora\"", "Décrivez-le à l'agent IA, p. ex. « 4 terrains de pickleball, 6h-22h, location 1 heure »", "AI 에이전트에게 설명하세요. 예: \"피클볼 코트 4면, 6시~22시, 1시간 대여\""],
    ["Nhà hàng", "Restaurant", "レストラン", "Restaurante", "Restaurant", "레스토랑"],
    ["Đặt bàn theo giờ, tính theo số khách", "Table reservations by time, counted by guests", "時間ごとのテーブル予約（人数単位）", "Reserva de mesa por hora, según número de personas", "Réservation de table par horaire, selon le nombre de personnes", "시간별 테이블 예약, 인원 기준"],
    ["Spa / Massage", "Spa / Massage", "スパ / マッサージ", "Spa / Masaje", "Spa / Massage", "스파 / 마사지"],
    ["Dịch vụ theo kỹ thuật viên, mỗi người một lượt", "Services by therapist, one client at a time", "セラピスト単位のサービス（1人につき1枠）", "Servicios por terapeuta, un cliente a la vez", "Services par praticien, un client à la fois", "테라피스트별 서비스, 한 번에 한 명"],
    ["Salon tóc & nail", "Hair & nail salon", "ヘア＆ネイルサロン", "Peluquería y manicura", "Salon de coiffure et ongles", "헤어 & 네일 살롱"],
    ["Cắt, nhuộm, làm nail theo nhân viên", "Cut, color and nails by stylist", "スタッフ別のカット・カラー・ネイル", "Corte, tinte y uñas por estilista", "Coupe, coloration et ongles par coiffeur", "스타일리스트별 커트, 염색, 네일"],
    ["Phòng khám", "Clinic", "クリニック", "Clínica", "Clinique", "의원"],
    ["Lịch khám theo bác sĩ, nghỉ Chủ nhật", "Appointments by doctor, closed on Sundays", "医師ごとの診察予約、日曜休診", "Citas por médico, cerrado los domingos", "Rendez-vous par médecin, fermé le dimanche", "의사별 진료 예약, 일요일 휴진"],
    ["Nha khoa", "Dental clinic", "歯科", "Clínica dental", "Cabinet dentaire", "치과"],
    ["Khám, lấy cao răng, trám răng theo bác sĩ", "Exams, cleaning and fillings by dentist", "歯科医ごとの検診・歯石除去・充填", "Revisión, limpieza y empastes por dentista", "Examens, détartrage et plombages par dentiste", "치과의사별 검진, 스케일링, 충전"],
    ["Khách sạn", "Hotel", "ホテル", "Hotel", "Hôtel", "호텔"],
    ["Đặt phòng theo đêm, nhận 14:00 trả 12:00", "Rooms by night, check-in 14:00, check-out 12:00", "1泊単位の客室予約、チェックイン14:00・チェックアウト12:00", "Habitaciones por noche, entrada 14:00, salida 12:00", "Chambres à la nuit, arrivée 14h00, départ 12h00", "1박 단위 객실 예약, 체크인 14:00 / 체크아웃 12:00"],
    ["Homestay", "Homestay", "民泊", "Alojamiento", "Chambre d'hôtes", "홈스테이"],
    ["Nhiều loại phòng, đặt theo đêm", "Several room types, booked by night", "複数の客室タイプ、1泊単位", "Varios tipos de habitación, por noche", "Plusieurs types de chambres, à la nuit", "여러 객실 유형, 1박 단위"],
    ["Bất động sản", "Real estate", "不動産", "Inmobiliaria", "Immobilier", "부동산"],
    ["Đặt lịch xem nhà, tư vấn dự án theo nhân viên", "Property viewings and project consultations by agent", "担当者ごとの内見・プロジェクト相談の予約", "Visitas a propiedades y consultas de proyecto por asesor", "Visites de biens et conseils sur projets par conseiller", "상담원별 매물 투어 및 프로젝트 상담 예약"],
    ["Sân thể thao", "Sports courts", "スポーツコート", "Pistas deportivas", "Terrains de sport", "스포츠 코트"],
    ["Thuê sân theo giờ (pickleball, tennis, bóng đá...)", "Court rental by the hour (pickleball, tennis, football...)", "時間単位のコートレンタル（ピックルボール、テニス、サッカーなど）", "Alquiler de pista por horas (pickleball, tenis, fútbol...)", "Location de terrain à l'heure (pickleball, tennis, football...)", "시간 단위 코트 대여 (피클볼, 테니스, 축구 등)"],
    ["Gym / Yoga", "Gym / Yoga", "ジム / ヨガ", "Gimnasio / Yoga", "Salle de sport / Yoga", "헬스 / 요가"],
    ["PT 1-1 và lớp tập nhóm có số chỗ", "1-on-1 training and group classes with limited seats", "パーソナルトレーニングと定員制のグループクラス", "Entrenamiento personal y clases grupales con plazas limitadas", "Coaching 1 à 1 et cours collectifs à places limitées", "1:1 트레이닝과 정원제 그룹 수업"],
    ["Phòng họp / Coworking", "Meeting rooms / Coworking", "会議室 / コワーキング", "Salas de reuniones / Coworking", "Salles de réunion / Coworking", "회의실 / 코워킹"],
    ["Thuê phòng họp theo giờ hoặc nửa ngày", "Meeting rooms by the hour or half day", "会議室を1時間または半日単位で", "Salas de reuniones por horas o medio día", "Salles de réunion à l'heure ou à la demi-journée", "회의실을 시간 또는 반나절 단위로"],
    ["Rửa xe / Gara", "Car wash / Garage", "洗車 / 整備工場", "Lavado / Taller", "Lavage / Garage", "세차 / 정비소"],
    ["Rửa xe, chăm sóc nội thất, bảo dưỡng theo khoang", "Washing, interior care and servicing by bay", "ベイ単位の洗車・内装ケア・整備", "Lavado, limpieza interior y mantenimiento por bahía", "Lavage, nettoyage intérieur et entretien par baie", "베이별 세차, 실내 관리, 정비"]
  ];
  var dict = {};
  LANGS.forEach(function (lang, i) {
    if (lang === "vi") return;
    dict[lang] = {};
    ROWS.forEach(function (row) { dict[lang][row[0]] = row[i]; });
  });
  window.I18N_BOOKING = dict;

  // Gộp vào bảng nội dung chung ngay khi i18n.js đã nạp xong (hoặc đợi tới lúc có).
  function merge() {
    if (!window.I18N_CONTENT || typeof applyI18n !== "function") return false;
    Object.keys(dict).forEach(function (lang) {
      window.I18N_CONTENT[lang] = Object.assign(window.I18N_CONTENT[lang] || {}, dict[lang]);
      if (typeof PATTERN_CACHE !== "undefined") delete PATTERN_CACHE[lang];
    });
    applyI18n();
    return true;
  }
  var tries = 0;
  (function wait() { if (!merge() && tries++ < 100) setTimeout(wait, 100); })();
})();
