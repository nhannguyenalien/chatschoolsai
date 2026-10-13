// Luật lịch đăng bài tự động (publish_schedules): chuẩn hoá input API/trợ lý và quy đổi "giờ trên tường"
// của luật sang thời điểm UTC theo múi giờ của luật/page. Không phụ thuộc Worker runtime nên test được trực tiếp.
export const PUBLISH_DAYS = new Set(["all", "mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const DEFAULT_SCHEDULE_TIMEZONE = "UTC";

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const PAGE_ID_RE = /^[0-9A-Za-z_.:-]{1,64}$/;

export function isValidTimeZone(value) {
  try { new Intl.DateTimeFormat("en", { timeZone: String(value) }).format(); return true; }
  catch { return false; }
}

// Múi giờ áp cho 1 luật: của luật → của page (extra_config.timezone) → UTC (hành vi cũ).
export function resolveRuleTimeZone(rule, page) {
  const candidates = [rule?.timezone];
  try { candidates.push(JSON.parse(page?.extra_config || "{}")?.timezone); } catch {}
  for (const candidate of candidates) {
    const tz = String(candidate || "").trim();
    if (tz && isValidTimeZone(tz)) return tz;
  }
  return DEFAULT_SCHEDULE_TIMEZONE;
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short"
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get("year")), month: Number(get("month")), day: Number(get("day")),
    hour: Number(get("hour")), minute: Number(get("minute")), second: Number(get("second")),
    weekday: DAY_NAMES.indexOf(get("weekday")?.toLowerCase().slice(0, 3))
  };
}

function offsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

// Thứ (mon..sun) của thời điểm `now` tại múi giờ `timeZone`.
export function dayNameInZone(now, timeZone) {
  return DAY_NAMES[zonedParts(now, timeZone).weekday];
}

// Thời điểm UTC ứng với "hôm nay (theo múi giờ) lúc HH:MM". Xử lý đổi giờ mùa hè bằng 1 lần hiệu chỉnh.
export function zonedSlotISO(now, timeZone, hh, mm) {
  const p = zonedParts(now, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, hh, mm, 0);
  let utc = wall - offsetMs(new Date(wall), timeZone);
  utc = wall - offsetMs(new Date(utc), timeZone);
  return new Date(utc).toISOString();
}

export function normalizePublishSchedule(body, { partial = false } = {}) {
  const patch = {};
  if (!partial || body.content_type !== undefined) {
    if (!["blog", "social"].includes(body.content_type)) throw new Error('content_type phải là "blog" hoặc "social"');
    patch.content_type = body.content_type;
  }
  if (!partial || body.times !== undefined) {
    if (!Array.isArray(body.times) || !body.times.length || body.times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time)))) {
      throw new Error('times phải là mảng giờ hợp lệ dạng "HH:MM"');
    }
    patch.times = JSON.stringify([...new Set(body.times.map(String))]);
  }
  if (body.days !== undefined) {
    if (!Array.isArray(body.days) || body.days.some((day) => !PUBLISH_DAYS.has(String(day).toLowerCase()))) {
      throw new Error("days chỉ nhận all, mon, tue, wed, thu, fri, sat, sun");
    }
    patch.days = JSON.stringify([...new Set(body.days.map((day) => String(day).toLowerCase()))]);
  } else if (!partial) patch.days = "[]";
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") throw new Error("is_active phải là boolean");
    patch.is_active = body.is_active;
  } else if (!partial) patch.is_active = true;
  // page_id rỗng = luật chung; có giá trị = luật riêng cho đúng page đó (chỉ áp cho social).
  if (body.page_id !== undefined && body.page_id !== null) {
    const pageId = String(body.page_id).trim();
    if (pageId && !PAGE_ID_RE.test(pageId)) throw new Error("page_id không hợp lệ");
    patch.page_id = pageId;
  }
  if (body.timezone !== undefined && body.timezone !== null) {
    const timezone = String(body.timezone).trim();
    if (timezone && !isValidTimeZone(timezone)) throw new Error(`timezone '${timezone}' không phải múi giờ IANA hợp lệ (vd Asia/Ho_Chi_Minh)`);
    patch.timezone = timezone;
  }
  if (patch.page_id && (patch.content_type ?? body.content_type) === "blog") throw new Error("Luật blog không gắn được với page_id");
  if (partial && !Object.keys(patch).length) throw new Error("Không có trường lịch hợp lệ để cập nhật");
  return patch;
}

export function serializePublishSchedule(s) {
  const parse = (raw) => { try { return JSON.parse(raw || "[]"); } catch { return []; } };
  return {
    id: s.id, content_type: s.content_type, days: parse(s.days), times: parse(s.times),
    is_active: !!s.is_active, page_id: s.page_id || "", timezone: s.timezone || ""
  };
}
