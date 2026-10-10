/**
 * customer-portal/config.js
 * Cùng backend với dash-tabler (_shared/config.js) — không phải bí mật, giữ y hệt 2 hằng số.
 */

const PB_URL     = "https://nhannguyen123-chat.hf.space";
const WORKER_URL = "https://apic.schoolsai.work";

const PB = new PocketBase(PB_URL);
window.PB = PB;
