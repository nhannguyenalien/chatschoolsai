import { ContentPlanningValidationError } from "../contentPlanningErrors.js";

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function unique(values) {
  return [...new Set(values)];
}

export function parseCadence(value) {
  let cadence;
  try {
    cadence = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw new ContentPlanningValidationError("cadence_json must be valid JSON.");
  }
  if (!cadence || typeof cadence !== "object" || Array.isArray(cadence)) {
    throw new ContentPlanningValidationError("cadence_json must be an object.");
  }
  const days = unique(cadence.days || []);
  const times = unique(cadence.times || []);
  if (!days.length || days.some((day) => day !== "all" && !DAY_NAMES.includes(day))) {
    throw new ContentPlanningValidationError("cadence days must contain all or valid weekday names.");
  }
  if (!times.length || times.some((time) => typeof time !== "string" || !TIME_RE.test(time))) {
    throw new ContentPlanningValidationError("cadence times must use 24-hour HH:mm values.");
  }
  return { days: days.includes("all") ? ["all"] : days, times: times.sort() };
}

function formatter(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
  } catch {
    throw new ContentPlanningValidationError(`Invalid IANA timezone '${timeZone}'.`);
  }
}

function partsAt(date, format) {
  return Object.fromEntries(format.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function localToUtc({ year, month, day, hour, minute }, format) {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = target;
  for (let i = 0; i < 4; i += 1) {
    const actual = partsAt(new Date(instant), format);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    instant += target - represented;
  }
  const verified = partsAt(new Date(instant), format);
  if (verified.year !== year || verified.month !== month || verified.day !== day || verified.hour !== hour || verified.minute !== minute) return null;
  return new Date(instant);
}

export function buildCadenceSlots({ cadence, timeZone, from, until, limit = 200 }) {
  const parsed = parseCadence(cadence);
  const format = formatter(timeZone);
  const fromDate = new Date(from);
  const untilDate = new Date(until);
  if (Number.isNaN(fromDate.valueOf()) || Number.isNaN(untilDate.valueOf()) || untilDate < fromDate) {
    throw new ContentPlanningValidationError("Cadence slot range is invalid.");
  }
  const startLocal = partsAt(fromDate, format);
  const cursor = new Date(Date.UTC(startLocal.year, startLocal.month - 1, startLocal.day));
  const slots = [];
  for (let offset = 0; offset <= 730 && slots.length < limit; offset += 1) {
    const localDate = new Date(cursor.valueOf() + offset * 86400000);
    const dayName = DAY_NAMES[localDate.getUTCDay()];
    if (!parsed.days.includes("all") && !parsed.days.includes(dayName)) continue;
    for (const time of parsed.times) {
      const [hour, minute] = time.split(":").map(Number);
      const slot = localToUtc({
        year: localDate.getUTCFullYear(), month: localDate.getUTCMonth() + 1, day: localDate.getUTCDate(), hour, minute,
      }, format);
      if (slot && slot >= fromDate && slot <= untilDate) slots.push(slot.toISOString());
      if (slots.length >= limit) break;
    }
    if (localDate > untilDate && offset > 1) break;
  }
  return slots.sort();
}

export const SKILLGO_DAILY_BLOG_CADENCE = { days: ["all"], times: ["03:00"] };
