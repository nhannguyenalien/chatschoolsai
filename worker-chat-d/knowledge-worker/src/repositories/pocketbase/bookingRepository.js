import { PocketBaseRepositoryError, escapePocketBaseFilter } from "./client.js";

const esc = escapePocketBaseFilter;
// PocketBase lưu và so sánh ngày dạng "YYYY-MM-DD HH:MM:SS.sssZ" (dấu cách, không phải T) nên phải đổi trước khi lọc.
const pbDate = (iso) => new Date(iso).toISOString().replace("T", " ");

export function createBookingRepository(client) {
  const items = async (collection, options) => (await client.list(collection, options)).items || [];
  return {
    // null nếu tenant chưa bật đặt lịch (chưa có collection hoặc chưa có dòng cấu hình).
    async getSettings(tenant) {
      try {
        return (await items("booking_settings", { filter: `tenant='${esc(tenant)}'`, perPage: 1 }))[0] || null;
      } catch (err) {
        if (err instanceof PocketBaseRepositoryError && err.status === 404) return null;
        throw err;
      }
    },
    listServices: (tenant) => items("booking_services", { filter: `tenant='${esc(tenant)}'`, perPage: 100, sort: "name" }),
    listResources: (tenant) => items("booking_resources", { filter: `tenant='${esc(tenant)}'`, perPage: 100, sort: "name" }),
    // Booking còn hiệu lực giao với [fromIso, toIso).
    listBookings: (tenant, fromIso, toIso, { includeCancelled = false } = {}) => items("bookings", {
      filter: `tenant='${esc(tenant)}'${includeCancelled ? "" : " && status!='cancelled'"} && start<'${pbDate(toIso)}' && end>'${pbDate(fromIso)}'`, perPage: 500, sort: "start",
    }),
    listUpcomingByPhone: (tenant, phone, fromIso) => items("bookings", {
      filter: `tenant='${esc(tenant)}' && phone='${esc(phone)}' && (status='pending' || status='confirmed') && end>'${pbDate(fromIso)}'`, perPage: 50, sort: "start",
    }),
    async findByIdempotencyKey(tenant, key) {
      return (await items("bookings", { filter: `tenant='${esc(tenant)}' && idempotency_key='${esc(key)}' && status!='cancelled'`, perPage: 1 }))[0] || null;
    },
    getBooking: (id) => client.get("bookings", id),
    createRecord: (collection, record) => client.create(collection, record),
    updateRecord: (collection, id, patch) => client.update(collection, id, patch),
    createBooking: (record) => client.create("bookings", { ...record, start: pbDate(record.start), end: pbDate(record.end) }),
    updateBooking: (id, patch) => client.update("bookings", id, patch),
  };
}
