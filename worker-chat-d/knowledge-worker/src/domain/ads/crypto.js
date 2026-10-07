// Mã hóa token ads (AES-GCM). Cùng định dạng với integrations/googleAnalytics.js.
const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (v) => Uint8Array.from(atob(v.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function key(secret) {
  if (!secret) throw new Error("ADS_TOKEN_ENCRYPTION_KEY chưa được cấu hình.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptJson(secret, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), new TextEncoder().encode(JSON.stringify(value)));
  return `${b64(iv)}.${b64(new Uint8Array(enc))}`;
}
export async function decryptJson(secret, value) {
  const [iv, data] = String(value || "").split(".");
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(secret), unb64(data));
  return JSON.parse(new TextDecoder().decode(clear));
}
