import { checkSlot, findFreeTimes, findService, formatLocal, normalizePhone, normalizeSettings, parseLocal, slotWindow } from "../../domain/booking/availability.js";

const DAY = 24 * 60 * 60000;
const REASONS = {
  invalid_time: "Ngày/giờ không hợp lệ (cần ngày YYYY-MM-DD, giờ HH:MM).",
  past: "Thời điểm này đã qua.",
  too_soon: "Quá sát giờ, cần đặt trước theo quy định của cơ sở.",
  closed_day: "Cơ sở nghỉ vào ngày này.",
  outside_hours: "Ngoài giờ phục vụ.",
  too_large: "Vượt quá sức chứa tối đa.",
  full: "Đã hết chỗ ở thời điểm này.",
};

export const BOOKING_TOOL_NAMES = Object.freeze(["check_availability", "create_booking", "cancel_booking"]);

const str = (description) => ({ type: "string", description });
const toolSchema = (name, description, properties, required) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });

export function bookingToolSchemas() {
  const slotProps = {
    service: str("Tên dịch vụ khách muốn (để trống nếu cơ sở chỉ có một loại)"),
    date: str("Ngày YYYY-MM-DD (theo giờ địa phương của cơ sở)"),
    time: str("Giờ bắt đầu HH:MM, 24h. Bỏ trống với khách sạn"),
    quantity: { type: "integer", description: "Số khách (nhà hàng) hoặc số phòng (khách sạn); mặc định 1" },
    nights: { type: "integer", description: "Số đêm (chỉ khách sạn)" },
  };
  return [
    toolSchema("check_availability", "Kiểm tra còn chỗ/lịch trống không và gợi ý giờ trống trong ngày. Gọi khi khách hỏi còn chỗ, hỏi giờ trống hoặc trước khi đặt.", slotProps, ["date"]),
    toolSchema("create_booking", "Ghi nhận đặt chỗ/đặt lịch. CHỈ gọi khi khách đã cung cấp đủ dịch vụ, ngày, giờ, tên, số điện thoại VÀ đã đồng ý sau khi bạn nhắc lại thông tin; thiếu gì thì hỏi thêm, KHÔNG gọi.", {
      ...slotProps, customer_name: str("Tên khách"), phone: str("Số điện thoại khách"), notes: str("Ghi chú/yêu cầu đặc biệt (tuỳ chọn)"),
    }, ["date", "customer_name", "phone"]),
    toolSchema("cancel_booking", "Huỷ lịch đã đặt của khách. Cần số điện thoại đã dùng khi đặt; nếu khách có nhiều lịch thì cần thêm mã lịch hoặc ngày.", {
      phone: str("Số điện thoại đã dùng khi đặt"), code: str("Mã lịch (tuỳ chọn)"), date: str("Ngày của lịch YYYY-MM-DD (tuỳ chọn)"),
    }, ["phone"]),
  ];
}

export const BOOKING_GUARD_NOTE = "LƯU Ý ĐẶT LỊCH: cơ sở này có hệ thống đặt lịch. Chỉ nói đã đặt/đã huỷ lịch khi kết quả công cụ ở trên báo thành công; khi chưa có kết quả đó, hãy hỏi nốt thông tin còn thiếu (dịch vụ, ngày, giờ, tên, SĐT) và nhắc lại để khách xác nhận. Không tự bịa giờ trống hay mã lịch.";

export const BOOKING_RETRIEVAL_PROMPT = " Với đặt lịch: dùng check_availability để xem chỗ trống; chỉ gọi create_booking khi khách đã đồng ý với thông tin bạn nhắc lại; luôn lấy ngày giờ theo múi giờ cơ sở.";

const codeOf = (record) => String(record.id || "").slice(-6).toUpperCase();
const describe = (record, offset) => {
  const { date, time } = formatLocal(new Date(record.start), offset);
  return { code: codeOf(record), service: record.service_name, date, time, quantity: record.party_size, status: record.status };
};

// Bộ công cụ đặt lịch cho một lượt chat. `repository` là bookingRepository; `notifyOwner` gửi tin cho chủ (lỗi thì bỏ qua).
export function createBookingTools({ repository, tenant, session = "", source = "chat", now = () => new Date(), notifyOwner = async () => {} }) {
  let loaded = null;
  const load = async () => {
    loaded ||= Promise.all([repository.getSettings(tenant), repository.listServices(tenant), repository.listResources(tenant)])
      .then(([record, services, resources]) => ({ settings: normalizeSettings(record), services, resources }));
    return loaded;
  };
  const tell = async (text) => { try { await notifyOwner(text); } catch (err) { console.error("[Booking] Báo chủ lỗi:", err.message); } };

  async function resolve(args, { needTime = false } = {}) {
    const { settings, services, resources } = await load();
    const found = findService(services, args.service, settings);
    if (found.error) return { error: found.error, options: found.options };
    if (needTime && found.service.unit !== "night" && !args.time) return { error: "missing_time", message: "Cần giờ cụ thể." };
    const quantity = Math.max(1, Math.trunc(Number(args.quantity) || 1));
    if (!needTime && found.service.unit !== "night" && !args.time) {
      const day = parseLocal(args.date, "00:00", settings.tz_offset_min);
      return day ? { settings, resources, service: found.service, win: null, day, quantity } : { error: "invalid_time", message: REASONS.invalid_time };
    }
    const win = slotWindow(found.service, args.date, args.time, args.nights, settings);
    if (!win?.start || !win.end) return { error: "invalid_time", message: REASONS.invalid_time };
    return { settings, resources, service: found.service, win, quantity };
  }

  const bookingsAround = (ctx) => ctx.win
    ? repository.listBookings(tenant, new Date(ctx.win.start.getTime() - DAY).toISOString(), new Date(ctx.win.end.getTime() + DAY).toISOString())
    : repository.listBookings(tenant, new Date(ctx.day.getTime() - DAY).toISOString(), new Date(ctx.day.getTime() + 2 * DAY).toISOString());

  async function checkAvailability(args) {
    const ctx = await resolve(args);
    if (ctx.error) return ctx;
    const { settings, resources, service, win, quantity } = ctx;
    const bookings = await bookingsAround(ctx);
    const isNight = service.unit === "night";
    if (!isNight && !args.time) {
      const times = findFreeTimes({ service, resources, bookings, settings, dateStr: args.date, quantity, now: now() });
      return { service: service.name, date: args.date, available: times.length > 0, suggested_times: times, ...(times.length ? {} : { message: REASONS.full }) };
    }
    const result = checkSlot({ service, resources, bookings, settings, ...win, quantity, now: now() });
    if (result.ok) return { service: service.name, date: args.date, time: args.time || undefined, nights: win.nights, quantity, available: true };
    const suggested = !isNight && ["full", "too_soon"].includes(result.reason)
      ? findFreeTimes({ service, resources, bookings, settings, dateStr: args.date, quantity, now: now() }) : [];
    return { service: service.name, date: args.date, time: args.time || undefined, available: false, reason: result.reason, message: REASONS[result.reason], suggested_times: suggested };
  }

  async function createBooking(args) {
    const name = String(args.customer_name || "").trim().slice(0, 100);
    const phone = normalizePhone(args.phone);
    if (!name) return { error: "missing_name", message: "Cần tên khách." };
    if (phone.length < 8 || phone.length > 15) return { error: "invalid_phone", message: "Số điện thoại không hợp lệ." };
    const ctx = await resolve(args, { needTime: true });
    if (ctx.error) return ctx;
    const { settings, resources, service, win, quantity } = ctx;
    const key = `${session}:${service.id || "-"}:${win.start.toISOString()}:${phone}`;
    const existing = await repository.findByIdempotencyKey(tenant, key);
    if (existing) return { booked: true, duplicate: true, ...describe(existing, settings.tz_offset_min), message: "Lịch này đã được ghi nhận trước đó." };
    // Kiểm tra lại ngay trước khi ghi để hạn chế đặt trùng giữa hai khách cùng lúc.
    const result = checkSlot({ service, resources, bookings: await bookingsAround(ctx), settings, ...win, quantity, now: now() });
    if (!result.ok) return { booked: false, reason: result.reason, message: REASONS[result.reason] };
    const record = await repository.createBooking({
      tenant, service_id: service.id, service_name: service.name, resource_id: result.resource.id, resource_name: result.resource.name,
      start: win.start.toISOString(), end: win.end.toISOString(), party_size: quantity,
      customer_name: name, phone, session, notes: String(args.notes || "").slice(0, 300),
      status: settings.manual_confirm ? "pending" : "confirmed", source, idempotency_key: key,
    });
    const info = describe(record, settings.tz_offset_min);
    await tell(`📅 Lịch mới (${record.status === "pending" ? "chờ xác nhận" : "đã xác nhận"}): ${info.service} • ${info.date} ${info.time} • ${quantity} • ${name} ${phone} • mã ${info.code}`);
    return {
      booked: true, ...info, customer_name: name, phone,
      message: record.status === "pending" ? "Đã ghi nhận, cơ sở sẽ xác nhận lại với khách." : "Đã đặt thành công.",
    };
  }

  async function cancelBooking(args) {
    const { settings } = await load();
    const phone = normalizePhone(args.phone);
    if (phone.length < 8) return { error: "invalid_phone", message: "Số điện thoại không hợp lệ." };
    let matches = await repository.listUpcomingByPhone(tenant, phone, now().toISOString());
    const code = String(args.code || "").trim().toUpperCase();
    if (code) matches = matches.filter((b) => codeOf(b) === code);
    if (args.date) matches = matches.filter((b) => formatLocal(new Date(b.start), settings.tz_offset_min).date === args.date);
    if (!matches.length) return { cancelled: false, message: "Không tìm thấy lịch phù hợp." };
    if (matches.length > 1) return { cancelled: false, message: "Khách có nhiều lịch, cần mã lịch hoặc ngày để chọn.", bookings: matches.map((b) => describe(b, settings.tz_offset_min)) };
    await repository.updateBooking(matches[0].id, { status: "cancelled" });
    const info = describe(matches[0], settings.tz_offset_min);
    await tell(`❌ Khách huỷ lịch: ${info.service} • ${info.date} ${info.time} • mã ${info.code}`);
    return { cancelled: true, ...info, status: "cancelled" };
  }

  const handlers = { check_availability: checkAvailability, create_booking: createBooking, cancel_booking: cancelBooking };
  return {
    schemas: bookingToolSchemas(),
    names: new Set(BOOKING_TOOL_NAMES),
    async execute(name, args = {}) {
      const handler = handlers[name];
      if (!handler) return JSON.stringify({ error: "unknown_tool" });
      return JSON.stringify(await handler(args));
    },
  };
}
