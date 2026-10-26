import { tr } from "./i18n.js";

// Mẫu cấu hình theo ngành: chủ chỉ chọn loại hình rồi sửa tên/số, không phải điền từng mục.
// Tên viết "vi|en|ja|es|fr|ko"; "{n}" là số thứ tự khi một tài nguyên được nhân bản (count).
// `group` là khoá nội bộ nối dịch vụ với tài nguyên nên KHÔNG dịch.
const BASE = { tz_offset_min: 420, min_notice_min: 60, slot_step_min: 30, default_capacity: 1, default_duration_min: 60, open_time: "08:00", close_time: "21:00", closed_days: "" };

const N = {
  table: "Đặt bàn|Table reservation|テーブル予約|Reserva de mesa|Réservation de table|테이블 예약",
  hall: "Sảnh chính|Main hall|メインホール|Sala principal|Salle principale|메인 홀",
  massage: "Massage 60 phút|60-minute massage|マッサージ60分|Masaje de 60 minutos|Massage de 60 minutes|마사지 60분",
  facial: "Chăm sóc da mặt|Facial treatment|フェイシャルケア|Tratamiento facial|Soin du visage|페이셜 케어",
  therapist: "Kỹ thuật viên {n}|Therapist {n}|セラピスト{n}|Terapeuta {n}|Praticien {n}|테라피스트 {n}",
  checkup: "Khám tổng quát|General check-up|一般診察|Consulta general|Consultation générale|일반 진료",
  doctor: "Bác sĩ {n}|Doctor {n}|医師{n}|Doctor {n}|Médecin {n}|의사 {n}",
  standard: "Phòng Standard|Standard room|スタンダードルーム|Habitación estándar|Chambre standard|스탠다드 룸",
  standardType: "Standard|Standard|スタンダード|Estándar|Standard|스탠다드",
  viewing: "Xem nhà mẫu|Property viewing|物件の内見|Visita a la propiedad|Visite du bien|매물 투어",
  projectTalk: "Tư vấn dự án|Project consultation|プロジェクト相談|Consulta del proyecto|Conseil sur le projet|프로젝트 상담",
  agent: "Tư vấn viên {n}|Agent {n}|担当者{n}|Asesor {n}|Conseiller {n}|상담원 {n}",
  court1: "Thuê sân 1 giờ|Court rental (1 hour)|コートレンタル（1時間）|Alquiler de pista (1 hora)|Location de terrain (1 heure)|코트 대여 (1시간)",
  court2: "Thuê sân 2 giờ|Court rental (2 hours)|コートレンタル（2時間）|Alquiler de pista (2 horas)|Location de terrain (2 heures)|코트 대여 (2시간)",
  court: "Sân {n}|Court {n}|コート{n}|Pista {n}|Terrain {n}|코트 {n}",
  haircut: "Cắt tóc|Haircut|ヘアカット|Corte de pelo|Coupe de cheveux|헤어컷",
  color: "Nhuộm tóc|Hair coloring|ヘアカラー|Tinte de pelo|Coloration|염색",
  nails: "Làm nail|Nail care|ネイルケア|Manicura|Soin des ongles|네일 케어",
  stylist: "Nhân viên {n}|Stylist {n}|スタッフ{n}|Estilista {n}|Coiffeur {n}|스타일리스트 {n}",
  double: "Phòng đôi|Double room|ダブルルーム|Habitación doble|Chambre double|더블룸",
  family: "Phòng gia đình|Family room|ファミリールーム|Habitación familiar|Chambre familiale|패밀리룸",
  dentalExam: "Khám & tư vấn nha khoa|Dental exam & consultation|歯科検診・相談|Revisión y consulta dental|Examen et consultation dentaire|치과 검진 및 상담",
  scaling: "Lấy cao răng|Teeth cleaning|歯石除去|Limpieza dental|Détartrage|스케일링",
  filling: "Nhổ / trám răng|Extraction / filling|抜歯・充填|Extracción / empaste|Extraction / plombage|발치 / 충전",
  pt: "Buổi tập PT 1-1|1-on-1 personal training|パーソナルトレーニング|Entrenamiento personal 1 a 1|Coaching personnel 1 à 1|1:1 퍼스널 트레이닝",
  classGroup: "Lớp tập nhóm|Group class|グループクラス|Clase grupal|Cours collectif|그룹 수업",
  coach: "Huấn luyện viên {n}|Coach {n}|コーチ{n}|Entrenador {n}|Coach {n}|코치 {n}",
  studio: "Phòng tập|Studio|スタジオ|Estudio|Studio|스튜디오",
  room1: "Phòng họp 1 giờ|Meeting room (1 hour)|会議室（1時間）|Sala de reuniones (1 hora)|Salle de réunion (1 heure)|회의실 (1시간)",
  roomHalf: "Phòng họp nửa ngày|Meeting room (half day)|会議室（半日）|Sala de reuniones (medio día)|Salle de réunion (demi-journée)|회의실 (반나절)",
  room: "Phòng họp {n}|Meeting room {n}|会議室{n}|Sala {n}|Salle {n}|회의실 {n}",
  wash: "Rửa xe|Car wash|洗車|Lavado de coche|Lavage auto|세차",
  interior: "Chăm sóc nội thất xe|Interior detailing|内装クリーニング|Limpieza interior|Nettoyage intérieur|실내 디테일링",
  servicing: "Bảo dưỡng xe|Car servicing|車の整備|Mantenimiento del coche|Entretien du véhicule|차량 정비",
  bay: "Khoang {n}|Bay {n}|ベイ{n}|Bahía {n}|Baie {n}|베이 {n}",
};

const min = (name, duration_min, resource_group = "") => ({ name, unit: "minute", duration_min, resource_group });
const night = (name, resource_group) => ({ name, unit: "night", resource_group });
const res = (name, group = "", capacity = 1, count = 1) => ({ name, group, capacity, count });

const SPECS = {
  restaurant: { settings: { business_type: "restaurant", open_time: "10:00", close_time: "22:00", default_capacity: 40, default_duration_min: 90 }, services: [min(N.table, 90)], resources: [res(N.hall, "", 40)] },
  spa: { settings: { business_type: "spa", open_time: "09:00", close_time: "21:00" }, services: [min(N.massage, 60), min(N.facial, 60)], resources: [res(N.therapist, "", 1, 2)] },
  clinic: { settings: { business_type: "clinic", open_time: "08:00", close_time: "17:00", closed_days: "0", slot_step_min: 20, default_duration_min: 20 }, services: [min(N.checkup, 20)], resources: [res(N.doctor)] },
  hotel: { settings: { business_type: "hotel", default_capacity: 5 }, services: [night(N.standard, "Standard")], resources: [res(N.standardType, "Standard", 5)] },
  realestate: { settings: { business_type: "realestate", open_time: "08:00", close_time: "18:00", default_duration_min: 45 }, services: [min(N.viewing, 45), min(N.projectTalk, 30)], resources: [res(N.agent, "", 1, 3)] },
  sports: { settings: { business_type: "sports", open_time: "06:00", close_time: "22:00", slot_step_min: 60 }, services: [min(N.court1, 60, "court"), min(N.court2, 120, "court")], resources: [res(N.court, "court", 1, 4)] },
  salon: { settings: { business_type: "salon", open_time: "09:00", close_time: "20:00", default_duration_min: 45 }, services: [min(N.haircut, 45), min(N.color, 120), min(N.nails, 60)], resources: [res(N.stylist, "", 1, 3)] },
  homestay: { settings: { business_type: "homestay", default_capacity: 3 }, services: [night(N.double, "double"), night(N.family, "family")], resources: [res(N.double, "double", 3), res(N.family, "family", 2)] },
  dental: { settings: { business_type: "dental", open_time: "08:00", close_time: "17:30", closed_days: "0", default_duration_min: 30 }, services: [min(N.dentalExam, 30), min(N.scaling, 45), min(N.filling, 60)], resources: [res(N.doctor, "", 1, 2)] },
  fitness: { settings: { business_type: "fitness", open_time: "06:00", close_time: "21:00", slot_step_min: 60 }, services: [min(N.pt, 60, "coach"), min(N.classGroup, 60, "studio")], resources: [res(N.coach, "coach", 1, 2), res(N.studio, "studio", 15)] },
  meeting_room: { settings: { business_type: "meeting_room", open_time: "08:00", close_time: "20:00", slot_step_min: 60 }, services: [min(N.room1, 60), min(N.roomHalf, 240)], resources: [res(N.room, "", 1, 2)] },
  carcare: { settings: { business_type: "carcare", open_time: "07:30", close_time: "18:00", default_duration_min: 30 }, services: [min(N.wash, 30), min(N.interior, 90), min(N.servicing, 120)], resources: [res(N.bay, "", 1, 3)] },
};

export const TEMPLATE_KEYS = Object.freeze(Object.keys(SPECS));

// Mẫu đã dịch sang `lang`: tài nguyên có count>1 được nhân bản thành "Tên 1", "Tên 2"...
export function buildTemplate(key, lang = "vi") {
  const spec = SPECS[key];
  if (!spec) return null;
  return {
    settings: { ...BASE, ...spec.settings },
    services: spec.services.map((s) => ({ ...s, name: tr(s.name, lang) })),
    resources: spec.resources.flatMap(({ name, group, capacity, count }) => Array.from({ length: count }, (_, i) => ({
      name: tr(name, lang).replace("{n}", String(i + 1)), group, capacity,
    }))),
  };
}

// Bản tiếng Việt, giữ nguyên tên cũ cho phần còn lại của hệ thống và test.
export const BOOKING_TEMPLATES = Object.freeze(Object.fromEntries(TEMPLATE_KEYS.map((key) => [key, buildTemplate(key, "vi")])));
