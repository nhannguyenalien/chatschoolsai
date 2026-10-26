import { BOOKING_TEMPLATES, formatLocal, normalizeSettings, parseLocal } from "../../domain/booking/availability.js";
import { createBookingTools } from "./bookingTools.js";

const DAY = 24 * 60 * 60000;
const MAX_RANGE_DAYS = 62;
const STATUSES = new Set(["pending", "confirmed", "cancelled"]);

export class BookingAdminError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Bật đặt lịch cho tenant theo mẫu ngành. Đã có cấu hình thì giữ nguyên.
export async function setupFromTemplate(repository, tenant, templateName) {
  const template = BOOKING_TEMPLATES[templateName];
  if (!template) throw new BookingAdminError(`template phải là một trong: ${Object.keys(BOOKING_TEMPLATES).join(", ")}`);
  if (await repository.getSettings(tenant)) return { created: false };
  await repository.createRecord("booking_settings", { tenant, ...template.settings });
  for (const service of template.services) await repository.createRecord("booking_services", { tenant, status: "active", ...service });
  for (const resource of template.resources) await repository.createRecord("booking_resources", { tenant, status: "active", ...resource });
  return { created: true };
}

// Dữ liệu cho trang quản lý: cấu hình + booking trong khoảng [from, to). enabled=false nếu tenant chưa bật.
export async function loadOverview(repository, tenant, fromIso, toIso) {
  const from = new Date(fromIso), to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new BookingAdminError("Khoảng thời gian không hợp lệ");
  if (to - from > MAX_RANGE_DAYS * DAY) throw new BookingAdminError(`Tối đa ${MAX_RANGE_DAYS} ngày mỗi lần xem`);
  const settingsRecord = await repository.getSettings(tenant);
  if (!settingsRecord) return { enabled: false };
  const [services, resources, bookings] = await Promise.all([
    repository.listServices(tenant), repository.listResources(tenant),
    repository.listBookings(tenant, from.toISOString(), to.toISOString(), { includeCancelled: true }),
  ]);
  return { enabled: true, settings: normalizeSettings(settingsRecord), services, resources, bookings };
}

// Thêm tay (khách gọi điện/đến trực tiếp): cùng luật sức chứa như đặt qua chat để lịch luôn đúng.
export async function createManual(repository, tenant, input, now = () => new Date()) {
  const tools = createBookingTools({ repository, tenant, session: "dashboard", source: "dashboard", now });
  const result = JSON.parse(await tools.execute("create_booking", input));
  if (!result.booked) throw new BookingAdminError(result.message || result.error || "Không đặt được", 409);
  return result;
}

// Chặn một khoảng giờ (nghỉ, bảo trì...). Không chọn tài nguyên thì chặn cả cơ sở.
export async function blockTime(repository, tenant, { date, time_from, time_to, resource_id = "", note = "" }) {
  const settings = normalizeSettings(await repository.getSettings(tenant));
  const start = parseLocal(date, time_from || "00:00", settings.tz_offset_min);
  const end = time_to ? parseLocal(date, time_to, settings.tz_offset_min) : new Date(start.getTime() + DAY);
  if (!start || !end || end <= start) throw new BookingAdminError("Khoảng chặn không hợp lệ");
  const resource = resource_id ? (await repository.listResources(tenant)).find((r) => r.id === resource_id) : null;
  if (resource_id && !resource) throw new BookingAdminError("Không tìm thấy tài nguyên", 404);
  const record = await repository.createBooking({
    tenant, service_name: "Đã chặn", resource_id: resource?.id || "", resource_name: resource?.name || "",
    start: start.toISOString(), end: end.toISOString(), party_size: 1, customer_name: String(note).slice(0, 100),
    status: "blocked", source: "dashboard",
  });
  return { id: record.id, ...formatLocal(start, settings.tz_offset_min) };
}

// Xác nhận / huỷ / đưa về chờ. Chỉ sửa booking của đúng tenant; lịch chặn thì xoá bằng cách huỷ.
export async function setStatus(repository, tenant, id, status) {
  if (!STATUSES.has(status)) throw new BookingAdminError("Trạng thái không hợp lệ");
  const booking = await repository.getBooking(id).catch(() => null);
  if (!booking || booking.tenant !== tenant) throw new BookingAdminError("Không tìm thấy lịch", 404);
  await repository.updateBooking(id, { status });
  return { id, status };
}
