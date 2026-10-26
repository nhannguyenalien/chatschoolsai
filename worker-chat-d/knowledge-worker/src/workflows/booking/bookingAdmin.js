import { formatLocal, normalizeSettings, parseLocal, stripDiacritics } from "../../domain/booking/availability.js";
import { TEMPLATE_KEYS, buildTemplate } from "../../domain/booking/templates.js";
import { msg } from "../../domain/booking/i18n.js";
import { createBookingTools } from "./bookingTools.js";

const DAY = 24 * 60 * 60000;
const MAX_RANGE_DAYS = 62;
const STATUSES = new Set(["pending", "confirmed", "cancelled"]);

export class BookingAdminError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Bật đặt lịch cho tenant theo mẫu ngành. Đã có cấu hình thì giữ nguyên.
export async function setupFromTemplate(repository, tenant, templateName, lang = "vi") {
  const template = buildTemplate(templateName, lang);
  if (!template) throw new BookingAdminError(`template: ${TEMPLATE_KEYS.join(", ")}`);
  if (await repository.getSettings(tenant)) return { created: false };
  await repository.createRecord("booking_settings", { tenant, ...template.settings });
  for (const service of template.services) await repository.createRecord("booking_services", { tenant, status: "active", ...service });
  for (const resource of template.resources) await repository.createRecord("booking_resources", { tenant, status: "active", ...resource });
  return { created: true };
}

// Dữ liệu cho trang quản lý: cấu hình + booking trong khoảng [from, to). enabled=false nếu tenant chưa bật.
export async function loadOverview(repository, tenant, fromIso, toIso, lang = "vi") {
  const from = new Date(fromIso), to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new BookingAdminError(msg("bad_range", lang));
  if (to - from > MAX_RANGE_DAYS * DAY) throw new BookingAdminError(msg("range_limit", lang));
  const settingsRecord = await repository.getSettings(tenant);
  if (!settingsRecord) return { enabled: false };
  const [services, resources, bookings] = await Promise.all([
    repository.listServices(tenant), repository.listResources(tenant),
    repository.listBookings(tenant, from.toISOString(), to.toISOString(), { includeCancelled: true }),
  ]);
  return { enabled: true, settings: normalizeSettings(settingsRecord), services, resources, bookings };
}

// Thêm tay (khách gọi điện/đến trực tiếp): cùng luật sức chứa như đặt qua chat để lịch luôn đúng.
export async function createManual(repository, tenant, input, now = () => new Date(), lang = "vi") {
  const tools = createBookingTools({ repository, tenant, session: "dashboard", source: "dashboard", lang, now });
  const result = JSON.parse(await tools.execute("create_booking", input));
  if (!result.booked) throw new BookingAdminError(result.message || result.error || "Không đặt được", 409);
  return result;
}

// Chặn một khoảng giờ (nghỉ, bảo trì...). Không chọn tài nguyên thì chặn cả cơ sở.
export async function blockTime(repository, tenant, { date, time_from, time_to, resource_id = "", note = "" }, lang = "vi") {
  const settings = normalizeSettings(await repository.getSettings(tenant));
  const start = parseLocal(date, time_from || "00:00", settings.tz_offset_min);
  const end = time_to ? parseLocal(date, time_to, settings.tz_offset_min) : new Date(start.getTime() + DAY);
  if (!start || !end || end <= start) throw new BookingAdminError(msg("bad_block", lang));
  const resource = resource_id ? (await repository.listResources(tenant)).find((r) => r.id === resource_id) : null;
  if (resource_id && !resource) throw new BookingAdminError(msg("resource_nf", lang), 404);
  const record = await repository.createBooking({
    tenant, service_name: msg("blocked", lang), resource_id: resource?.id || "", resource_name: resource?.name || "",
    start: start.toISOString(), end: end.toISOString(), party_size: 1, customer_name: String(note).slice(0, 100),
    status: "blocked", source: "dashboard", extra_json: '{"type":"block"}',
  });
  return { id: record.id, ...formatLocal(start, settings.tz_offset_min) };
}

// Xác nhận / huỷ / đưa về chờ. Chỉ sửa booking của đúng tenant; lịch chặn thì xoá bằng cách huỷ.
export async function setStatus(repository, tenant, id, status, lang = "vi") {
  if (!STATUSES.has(status)) throw new BookingAdminError(msg("bad_status", lang));
  const booking = await repository.getBooking(id).catch(() => null);
  if (!booking || booking.tenant !== tenant) throw new BookingAdminError(msg("booking_nf", lang), 404);
  await repository.updateBooking(id, { status });
  return { id, status };
}

const clamp = (value, min, max, fallback) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};
const hhmm = (value) => (/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value).padStart(5, "0") : undefined);
const MAX_ITEMS = 50;

// Cấu hình đặt lịch từ hội thoại của chủ (AI đã tách lời chủ thành dữ liệu có cấu trúc).
// `template` điền sẵn mẫu ngành; các trường còn lại ghi đè. `replace` vô hiệu hoá dịch vụ/tài nguyên cũ không còn trong danh sách mới.
export async function applyBookingConfig(repository, tenant, config = {}, lang = "vi") {
  const base = config.template ? buildTemplate(config.template, lang) : null;
  if (config.template && !base) throw new BookingAdminError(`template: ${TEMPLATE_KEYS.join(", ")}`);
  const existing = await repository.getSettings(tenant);
  const patch = { ...(base?.settings || {}) };
  const set = (key, value) => { if (value !== undefined) patch[key] = value; };
  set("business_type", config.business_type ? String(config.business_type).slice(0, 40) : undefined);
  set("open_time", hhmm(config.open_time));
  set("close_time", hhmm(config.close_time));
  if (config.closed_days !== undefined) set("closed_days", (Array.isArray(config.closed_days) ? config.closed_days : String(config.closed_days).split(/[,\s]+/)).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6).join(","));
  if (config.tz_offset_min !== undefined) set("tz_offset_min", clamp(config.tz_offset_min, -720, 840, undefined));
  if (config.min_notice_min !== undefined) set("min_notice_min", clamp(config.min_notice_min, 0, 60 * 24 * 30, undefined));
  if (config.slot_step_min !== undefined) set("slot_step_min", clamp(config.slot_step_min, 5, 240, undefined));
  if (config.default_capacity !== undefined) set("default_capacity", clamp(config.default_capacity, 1, 5000, undefined));
  if (config.default_duration_min !== undefined) set("default_duration_min", clamp(config.default_duration_min, 5, 60 * 24, undefined));
  if (config.manual_confirm !== undefined) set("manual_confirm", config.manual_confirm === true);
  if (existing) { if (Object.keys(patch).length) await repository.updateRecord("booking_settings", existing.id, patch); }
  else await repository.createRecord("booking_settings", { tenant, ...buildTemplate("restaurant", lang).settings, ...patch });

  const services = (config.services ?? base?.services ?? []).slice(0, MAX_ITEMS).map((s) => ({
    name: String(s.name || "").trim().slice(0, 100),
    unit: s.unit === "night" ? "night" : "minute",
    duration_min: s.unit === "night" ? 0 : clamp(s.duration_min, 5, 60 * 24, 60),
    price_text: String(s.price_text || "").slice(0, 100),
    resource_group: String(s.resource_group || "").trim().slice(0, 60),
  })).filter((s) => s.name);
  const resources = (config.resources ?? base?.resources ?? []).slice(0, MAX_ITEMS * 2).map((r) => ({
    name: String(r.name || "").trim().slice(0, 100), group: String(r.group || "").trim().slice(0, 60), capacity: clamp(r.capacity, 1, 5000, 1),
  })).filter((r) => r.name);

  const sync = async (collection, current, wanted, fields) => {
    const keyOf = (name) => stripDiacritics(name);
    const byName = new Map(current.map((row) => [keyOf(row.name), row]));
    let created = 0, updated = 0, deactivated = 0;
    for (const item of wanted) {
      const row = byName.get(keyOf(item.name));
      if (row) { await repository.updateRecord(collection, row.id, { ...item, status: "active" }); updated += 1; byName.delete(keyOf(item.name)); }
      else { await repository.createRecord(collection, { tenant, status: "active", ...item }); created += 1; }
    }
    if (config.replace === true) {
      for (const row of byName.values()) if (row.status !== "inactive") { await repository.updateRecord(collection, row.id, { status: "inactive" }); deactivated += 1; }
    }
    return { created, updated, deactivated };
  };
  const result = {};
  if (config.services !== undefined || base) result.services = await sync("booking_services", await repository.listServices(tenant), services);
  if (config.resources !== undefined || base) result.resources = await sync("booking_resources", await repository.listResources(tenant), resources);
  return result;
}

// Ảnh chụp cấu hình hiện tại để AI đọc lại cho chủ.
export async function describeBookingConfig(repository, tenant) {
  const record = await repository.getSettings(tenant);
  if (!record) return null;
  const [services, resources] = await Promise.all([repository.listServices(tenant), repository.listResources(tenant)]);
  return {
    settings: normalizeSettings(record),
    services: services.filter((s) => s.status !== "inactive").map(({ name, unit, duration_min, price_text, resource_group }) => ({ name, unit: unit || "minute", duration_min, price_text, resource_group })),
    resources: resources.filter((r) => r.status !== "inactive").map(({ name, group, capacity }) => ({ name, group, capacity })),
  };
}
