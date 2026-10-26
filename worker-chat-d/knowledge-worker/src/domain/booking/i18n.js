// Văn bản đặt lịch theo ngôn ngữ. Cùng 6 ngôn ngữ với dashboard: vi, en, ja, es, fr, ko.
export const BOOKING_LANGS = Object.freeze(["vi", "en", "ja", "es", "fr", "ko"]);
const IDX = Object.fromEntries(BOOKING_LANGS.map((l, i) => [l, i]));

// Giá trị lạ hoặc "auto" thì dùng `fallback`.
export function pickLang(value, fallback = "en") {
  const v = String(value || "").trim().toLowerCase().slice(0, 2);
  return v in IDX ? v : fallback;
}

// "vi|en|ja|es|fr|ko" -> bản của ngôn ngữ đó (thiếu thì tiếng Anh).
export function tr(packed, lang) {
  const parts = String(packed).split("|");
  return parts[IDX[lang]] || parts[1] || parts[0];
}

const REASONS = {
  invalid_time: "Ngày/giờ không hợp lệ (cần ngày YYYY-MM-DD, giờ HH:MM).|Invalid date/time (need YYYY-MM-DD and HH:MM).|日付・時刻が正しくありません（YYYY-MM-DD と HH:MM が必要です）。|Fecha u hora no válida (se necesita AAAA-MM-DD y HH:MM).|Date ou heure invalide (AAAA-MM-JJ et HH:MM requis).|날짜/시간이 올바르지 않습니다 (YYYY-MM-DD, HH:MM 필요).",
  past: "Thời điểm này đã qua.|That time has already passed.|その時間はすでに過ぎています。|Ese momento ya ha pasado.|Ce moment est déjà passé.|이미 지난 시간입니다.",
  too_soon: "Quá sát giờ, cần đặt trước theo quy định của cơ sở.|Too close to the start time; please book further ahead.|開始時間まで近すぎます。もう少し前にご予約ください。|Demasiado cerca de la hora; reserve con más antelación.|Trop proche de l'heure; veuillez réserver plus à l'avance.|시작 시간이 너무 가깝습니다. 더 일찍 예약해 주세요.",
  closed_day: "Cơ sở nghỉ vào ngày này.|We are closed on this day.|この日は休業日です。|Cerramos este día.|Nous sommes fermés ce jour-là.|이 날은 휴무입니다.",
  outside_hours: "Ngoài giờ phục vụ.|Outside opening hours.|営業時間外です。|Fuera del horario de atención.|En dehors des heures d'ouverture.|영업시간 외입니다.",
  too_large: "Vượt quá sức chứa tối đa.|Exceeds the maximum capacity.|最大収容数を超えています。|Supera la capacidad máxima.|Dépasse la capacité maximale.|최대 수용 인원을 초과했습니다.",
  full: "Đã hết chỗ ở thời điểm này.|Fully booked at that time.|その時間は満席です。|Completo en ese horario.|Complet à cet horaire.|해당 시간은 마감되었습니다.",
};
export const reasonText = (reason, lang) => (REASONS[reason] ? tr(REASONS[reason], lang) : reason);

const MSG = {
  need_name: "Cần tên khách.|Customer name is required.|お客様のお名前が必要です。|Se necesita el nombre del cliente.|Le nom du client est requis.|고객 이름이 필요합니다.",
  bad_phone: "Số điện thoại không hợp lệ.|Invalid phone number.|電話番号が正しくありません。|Teléfono no válido.|Numéro de téléphone invalide.|전화번호가 올바르지 않습니다.",
  need_time: "Cần giờ cụ thể.|A specific time is required.|具体的な時間が必要です。|Se necesita una hora concreta.|Une heure précise est requise.|구체적인 시간이 필요합니다.",
  duplicate: "Lịch này đã được ghi nhận trước đó.|This booking was already recorded.|この予約はすでに登録されています。|Esta reserva ya estaba registrada.|Cette réservation est déjà enregistrée.|이미 등록된 예약입니다.",
  pending: "Đã ghi nhận, cơ sở sẽ xác nhận lại với khách.|Recorded; the venue will confirm with the customer.|受け付けました。店舗から確認のご連絡をします。|Registrada; el establecimiento la confirmará con el cliente.|Enregistrée ; l'établissement confirmera avec le client.|접수되었습니다. 매장에서 확인 연락을 드립니다.",
  booked: "Đã đặt thành công.|Booked successfully.|予約が完了しました。|Reserva realizada con éxito.|Réservation effectuée.|예약이 완료되었습니다.",
  not_found: "Không tìm thấy lịch phù hợp.|No matching booking found.|該当する予約が見つかりません。|No se encontró ninguna reserva.|Aucune réservation correspondante.|해당 예약을 찾을 수 없습니다.",
  many: "Khách có nhiều lịch, cần mã lịch hoặc ngày để chọn.|Several bookings found; a booking code or date is needed.|複数の予約があります。予約コードか日付を指定してください。|Hay varias reservas; indique el código o la fecha.|Plusieurs réservations ; indiquez le code ou la date.|예약이 여러 건입니다. 예약 코드나 날짜를 알려 주세요.",
  bad_range: "Khoảng thời gian không hợp lệ|Invalid time range|期間が正しくありません|Intervalo no válido|Période invalide|기간이 올바르지 않습니다",
  range_limit: "Chỉ xem tối đa 62 ngày mỗi lần|You can view at most 62 days at a time|一度に表示できるのは最大62日です|Máximo 62 días por consulta|62 jours maximum à la fois|한 번에 최대 62일까지 볼 수 있습니다",
  bad_block: "Khoảng chặn không hợp lệ|Invalid block range|ブロック期間が正しくありません|Intervalo de bloqueo no válido|Plage de blocage invalide|차단 기간이 올바르지 않습니다",
  resource_nf: "Không tìm thấy tài nguyên|Resource not found|リソースが見つかりません|Recurso no encontrado|Ressource introuvable|리소스를 찾을 수 없습니다",
  bad_status: "Trạng thái không hợp lệ|Invalid status|ステータスが正しくありません|Estado no válido|Statut invalide|상태가 올바르지 않습니다",
  booking_nf: "Không tìm thấy lịch|Booking not found|予約が見つかりません|Reserva no encontrada|Réservation introuvable|예약을 찾을 수 없습니다",
  blocked: "Đã chặn|Blocked|ブロック済み|Bloqueado|Bloqué|차단됨",
  booking: "Đặt chỗ|Booking|予約|Reserva|Réservation|예약",
  phone: "SĐT|Phone|電話|Tel|Tél|전화",
  served_by: "Phục vụ|Served by|担当|Atiende|Prise en charge|담당",
  calendar: "Lịch đặt chỗ|Bookings|予約カレンダー|Reservas|Réservations|예약 일정",
};
export const msg = (key, lang) => tr(MSG[key], lang);

const NEW_BOOKING = "📅 Lịch mới ({status}): {service} • {when} • {qty} • {name} {phone} • mã {code}|📅 New booking ({status}): {service} • {when} • {qty} • {name} {phone} • code {code}|📅 新しい予約（{status}）：{service} • {when} • {qty} • {name} {phone} • コード {code}|📅 Nueva reserva ({status}): {service} • {when} • {qty} • {name} {phone} • código {code}|📅 Nouvelle réservation ({status}) : {service} • {when} • {qty} • {name} {phone} • code {code}|📅 새 예약 ({status}): {service} • {when} • {qty} • {name} {phone} • 코드 {code}";
const CANCELLED = "❌ Khách huỷ lịch: {service} • {when} • mã {code}|❌ Booking cancelled by customer: {service} • {when} • code {code}|❌ お客様が予約をキャンセル：{service} • {when} • コード {code}|❌ El cliente canceló: {service} • {when} • código {code}|❌ Réservation annulée par le client : {service} • {when} • code {code}|❌ 고객이 예약을 취소했습니다: {service} • {when} • 코드 {code}";
const STATUS = {
  confirmed: "đã xác nhận|confirmed|確定|confirmada|confirmée|확정",
  pending: "chờ xác nhận|pending confirmation|確認待ち|pendiente de confirmar|en attente de confirmation|확인 대기",
};
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export function newBookingNotice(lang, info) {
  return fill(tr(NEW_BOOKING, lang), { ...info, status: tr(STATUS[info.status] || STATUS.confirmed, lang) });
}
export const cancelledNotice = (lang, info) => fill(tr(CANCELLED, lang), info);
