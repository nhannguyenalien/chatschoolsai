/**
 * _shared/config.js
 * Điền 2 dòng này trước khi deploy
 */

const PB_URL     = "https://nhannguyen123-chat.hf.space";
const WORKER_URL = "https://apic.schoolsai.work";

// Không cần chỉnh gì dưới đây
const PB = new PocketBase(PB_URL);
window.PB = PB;