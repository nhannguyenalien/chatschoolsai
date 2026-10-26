// Logic đặt lịch thuần (không I/O): dịch vụ + tài nguyên có sức chứa + danh sách booking đang giữ chỗ.
// Cùng một phép kiểm tra cho nhà hàng (sức chứa lớn), spa/phòng khám (sức chứa 1), khách sạn (theo đêm).

const MIN = 60000;
const DAY = 24 * 60 * MIN;
export const ACTIVE_STATUSES = new Set(["pending", "confirmed", "blocked"]);
export const CHECKIN_TIME = "14:00";
export const CHECKOUT_TIME = "12:00";
const MAX_SUGGESTIONS = 8;

export const DEFAULT_SETTINGS = Object.freeze({
  open_time: "08:00", close_time: "21:00", closed_days: [], tz_offset_min: 420, min_notice_min: 60,
  slot_step_min: 30, default_capacity: 1, default_duration_min: 60, manual_confirm: false,
});

const intOr = (value, fallback) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Math.trunc(Number(value)) : fallback);
// PocketBase lưu number chưa nhập thành 0 chứ không phải trống, nên với cấu hình 0 nghĩa là "chưa đặt" -> dùng mặc định.
const settingOr = (value, fallback) => intOr(value, 0) || fallback;

export function normalizeSettings(record) {
  const r = record || {};
  const closed = String(r.closed_days ?? "").split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => n >= 0 && n <= 6);
  return {
    open_time: /^\d{1,2}:\d{2}$/.test(r.open_time || "") ? r.open_time : DEFAULT_SETTINGS.open_time,
    close_time: /^\d{1,2}:\d{2}$/.test(r.close_time || "") ? r.close_time : DEFAULT_SETTINGS.close_time,
    closed_days: closed,
    tz_offset_min: settingOr(r.tz_offset_min, DEFAULT_SETTINGS.tz_offset_min),
    min_notice_min: Math.max(0, settingOr(r.min_notice_min, DEFAULT_SETTINGS.min_notice_min)),
    slot_step_min: Math.max(5, settingOr(r.slot_step_min, DEFAULT_SETTINGS.slot_step_min)),
    default_capacity: Math.max(1, settingOr(r.default_capacity, DEFAULT_SETTINGS.default_capacity)),
    default_duration_min: Math.max(5, settingOr(r.default_duration_min, DEFAULT_SETTINGS.default_duration_min)),
    manual_confirm: r.manual_confirm === true,
  };
}

export function stripDiacritics(value) {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

const toMinutes = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };

// Giờ địa phương của cơ sở ("YYYY-MM-DD", "HH:MM") -> Date (UTC). null nếu sai định dạng hoặc ngày không có thật.
export function parseLocal(dateStr, timeStr, offsetMin) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || "").trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(timeStr || "").trim());
  if (!d || !t || +t[1] > 23 || +t[2] > 59) return null;
  const ms = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) - offsetMin * MIN;
  const date = new Date(ms);
  return formatLocal(date, offsetMin).date === `${d[1]}-${d[2]}-${d[3]}` ? date : null;
}

export function formatLocal(date, offsetMin) {
  const iso = new Date(date.getTime() + offsetMin * MIN).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("84") && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
}

// Chọn dịch vụ theo tên khách nói (không phân biệt dấu/hoa thường). Chưa khai báo dịch vụ nào thì dùng dịch vụ mặc định.
export function findService(services, query, settings) {
  const active = (services || []).filter((s) => s.status !== "inactive");
  if (!active.length) {
    return { service: { id: "", name: "Đặt chỗ", unit: "minute", duration_min: settings.default_duration_min, resource_group: "" } };
  }
  const q = stripDiacritics(query);
  if (!q) {
    return active.length === 1 ? { service: active[0] } : { error: "service_required", options: active.map((s) => s.name) };
  }
  const exact = active.find((s) => stripDiacritics(s.name) === q);
  const partial = exact || active.find((s) => stripDiacritics(s.name).includes(q) || q.includes(stripDiacritics(s.name)));
  return partial ? { service: partial } : { error: "service_not_found", options: active.map((s) => s.name) };
}

export function slotWindow(service, dateStr, timeStr, nights, settings) {
  if (service.unit === "night") {
    const start = parseLocal(dateStr, CHECKIN_TIME, settings.tz_offset_min);
    const n = Math.max(1, Math.min(60, intOr(nights, 1)));
    if (!start) return null;
    const outDay = formatLocal(new Date(start.getTime() + n * DAY), settings.tz_offset_min).date;
    return { start, end: parseLocal(outDay, CHECKOUT_TIME, settings.tz_offset_min), nights: n };
  }
  const start = parseLocal(dateStr, timeStr, settings.tz_offset_min);
  if (!start) return null;
  return { start, end: new Date(start.getTime() + Math.max(5, intOr(service.duration_min, settings.default_duration_min)) * MIN) };
}

export function candidateResources(resources, group, settings) {
  const active = (resources || []).filter((r) => r.status !== "inactive");
  const list = (group ? active.filter((r) => (r.group || "") === group) : active)
    .map((r) => ({ ...r, capacity: Math.max(1, intOr(r.capacity, 1)) }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return list.length ? list : [{ id: "", name: "", group: group || "", capacity: settings.default_capacity }];
}

function loadOn(resource, bookings, start, end) {
  let load = 0;
  for (const b of bookings || []) {
    if (!ACTIVE_STATUSES.has(b.status)) continue;
    if (!(new Date(b.start) < end && new Date(b.end) > start)) continue;
    if (b.status === "blocked" && (!b.resource_id || b.resource_id === resource.id)) return Infinity;
    if ((b.resource_id || "") === (resource.id || "")) load += Math.max(1, intOr(b.party_size, 1));
  }
  return load;
}

// Kiểm tra một khung giờ. ok=true kèm tài nguyên được gán (còn trống đầu tiên); ngược lại có `reason`.
export function checkSlot({ service, resources, bookings, settings, start, end, quantity = 1, now = new Date() }) {
  if (!start || !end) return { ok: false, reason: "invalid_time" };
  const night = service.unit === "night";
  if (night ? end <= now : start.getTime() < now.getTime() + settings.min_notice_min * MIN) {
    return { ok: false, reason: start < now ? "past" : "too_soon" };
  }
  if (!night) {
    const local = formatLocal(start, settings.tz_offset_min);
    const weekday = new Date(`${local.date}T00:00:00Z`).getUTCDay();
    if (settings.closed_days.includes(weekday)) return { ok: false, reason: "closed_day" };
    const startMin = toMinutes(local.time);
    const endMin = startMin + (end.getTime() - start.getTime()) / MIN;
    if (startMin < toMinutes(settings.open_time) || endMin > toMinutes(settings.close_time)) return { ok: false, reason: "outside_hours" };
  }
  const candidates = candidateResources(resources, service.resource_group, settings);
  const qty = Math.max(1, intOr(quantity, 1));
  if (qty > Math.max(...candidates.map((r) => r.capacity))) return { ok: false, reason: "too_large" };
  for (const resource of candidates) {
    const load = loadOn(resource, bookings, start, end);
    if (load + qty <= resource.capacity) return { ok: true, resource, remaining: resource.capacity - load - qty };
  }
  return { ok: false, reason: "full" };
}

// Các giờ bắt đầu còn trống trong ngày (dịch vụ theo phút), bước theo settings.slot_step_min.
export function findFreeTimes({ service, resources, bookings, settings, dateStr, quantity = 1, now = new Date(), limit = MAX_SUGGESTIONS }) {
  const times = [];
  for (let m = toMinutes(settings.open_time); m < toMinutes(settings.close_time); m += settings.slot_step_min) {
    const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const win = slotWindow(service, dateStr, time, 1, settings);
    if (win && checkSlot({ service, resources, bookings, settings, ...win, quantity, now }).ok) times.push(time);
    if (times.length >= limit) break;
  }
  return times;
}

// Mẫu cấu hình theo ngành: chủ chỉ chọn loại hình rồi sửa tên/số, không phải điền từng mục.
const BASE_SETTINGS = { tz_offset_min: 420, min_notice_min: 60, slot_step_min: 30, default_capacity: 1, default_duration_min: 60, open_time: "08:00", close_time: "21:00", closed_days: "" };
const withDefaults = (settings) => ({ ...BASE_SETTINGS, ...settings });

export const BOOKING_TEMPLATES = Object.freeze({
  restaurant: {
    settings: withDefaults({ business_type: "restaurant", open_time: "10:00", close_time: "22:00", default_capacity: 40, default_duration_min: 90 }),
    services: [{ name: "Đặt bàn", unit: "minute", duration_min: 90, resource_group: "" }],
    resources: [{ name: "Sảnh chính", group: "", capacity: 40 }],
  },
  spa: {
    settings: withDefaults({ business_type: "spa", open_time: "09:00", close_time: "21:00", default_duration_min: 60 }),
    services: [
      { name: "Massage 60 phút", unit: "minute", duration_min: 60, resource_group: "" },
      { name: "Chăm sóc da mặt", unit: "minute", duration_min: 60, resource_group: "" },
    ],
    resources: [{ name: "Kỹ thuật viên 1", group: "", capacity: 1 }, { name: "Kỹ thuật viên 2", group: "", capacity: 1 }],
  },
  clinic: {
    settings: withDefaults({ business_type: "clinic", open_time: "08:00", close_time: "17:00", closed_days: "0", slot_step_min: 20, default_duration_min: 20 }),
    services: [{ name: "Khám tổng quát", unit: "minute", duration_min: 20, resource_group: "" }],
    resources: [{ name: "Bác sĩ 1", group: "", capacity: 1 }],
  },
  hotel: {
    settings: withDefaults({ business_type: "hotel", default_capacity: 5 }),
    services: [{ name: "Phòng Standard", unit: "night", resource_group: "Standard" }],
    resources: [{ name: "Standard", group: "Standard", capacity: 5 }],
  },
});
