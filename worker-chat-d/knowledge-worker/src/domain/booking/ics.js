// Lịch iCalendar chỉ đọc cho từng tenant: chủ cơ sở dán link vào Google/Apple/Outlook Calendar là thấy booking.

import { msg } from "./i18n.js";

const esc = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function fold(line) {
  const parts = [];
  let rest = line;
  while (rest.length > 73) { parts.push(rest.slice(0, 73)); rest = ` ${rest.slice(73)}`; }
  parts.push(rest);
  return parts.join("\r\n");
}

export function buildIcs({ calendarName, bookings, now = new Date(), lang = "vi" }) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SchoolsAI//Booking//VI", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(calendarName || msg("calendar", lang))}`];
  for (const b of bookings || []) {
    if (b.status === "cancelled") continue;
    const blocked = b.status === "blocked";
    const summary = blocked ? msg("blocked", lang) : [b.service_name, b.customer_name && `${b.customer_name}${b.party_size > 1 ? ` (${b.party_size})` : ""}`].filter(Boolean).join(" - ") || msg("booking", lang);
    const description = [b.phone && `${msg("phone", lang)}: ${b.phone}`, b.resource_name && `${msg("served_by", lang)}: ${b.resource_name}`, b.notes].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT", `UID:${esc(b.id)}@booking.schoolsai`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(b.start)}`, `DTEND:${stamp(b.end)}`,
      `SUMMARY:${esc(summary)}`, ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
      `STATUS:${b.status === "pending" ? "TENTATIVE" : "CONFIRMED"}`, "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

// Token ký HMAC theo tenant: link lịch không cần đăng nhập nhưng không đoán được và không lộ ADMIN_SECRET.
export async function feedToken(tenant, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`booking-feed:${tenant}`)));
  return [...sig].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyFeedToken(tenant, secret, token) {
  if (!secret || !token) return false;
  const expected = await feedToken(tenant, secret);
  if (expected.length !== String(token).length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ String(token).charCodeAt(i);
  return diff === 0;
}
