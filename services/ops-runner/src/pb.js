// Client PocketBase tối giản: tự đăng nhập superuser, tự đăng nhập lại khi token hết hạn.
export function createPb({ url, email, password, fetchImpl = fetch }) {
  let token = null;
  let tokenAt = 0;

  async function login() {
    const body = JSON.stringify({ identity: email, password });
    // PocketBase mới dùng _superusers, bản cũ dùng admins — thử lần lượt như Worker đang làm.
    for (const path of ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"]) {
      const res = await fetchImpl(`${url}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) { token = data.token; tokenAt = Date.now(); return token; }
    }
    throw new Error("Không đăng nhập được PocketBase (kiểm tra PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASS)");
  }

  async function request(path, init = {}, retried = false) {
    if (!token || Date.now() - tokenAt > 10 * 60 * 1000) await login();
    const res = await fetchImpl(`${url}${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: token } });
    if (res.status === 401 && !retried) { token = null; return request(path, init, true); }
    return res;
  }

  async function json(path, init) {
    const res = await request(path, init);
    if (!res.ok) throw new Error(`PocketBase ${init?.method || "GET"} ${path.split("?")[0]} -> ${res.status}`);
    return res.status === 204 ? null : res.json();
  }

  const enc = encodeURIComponent;

  return {
    request,
    json,
    // Lấy hết bản ghi theo trang (giới hạn maxPages để không kéo cả DB khi lọc sai).
    async list(collection, { filter = "", fields = "", sort = "", perPage = 200, maxPages = 10 } = {}) {
      const items = [];
      for (let page = 1; page <= maxPages; page++) {
        const q = `page=${page}&perPage=${perPage}&skipTotal=1${filter ? `&filter=${enc(filter)}` : ""}${fields ? `&fields=${enc(fields)}` : ""}${sort ? `&sort=${enc(sort)}` : ""}`;
        const data = await json(`/api/collections/${collection}/records?${q}`);
        items.push(...(data.items || []));
        if ((data.items || []).length < perPage) break;
      }
      return items;
    },
    async count(collection, filter = "") {
      const data = await json(`/api/collections/${collection}/records?perPage=1${filter ? `&filter=${enc(filter)}` : ""}`);
      return data.totalItems ?? 0;
    },
  };
}

// PocketBase lưu và lọc thời gian dạng "YYYY-MM-DD HH:MM:SS.mmmZ".
export const pbTime = (ms) => new Date(ms).toISOString().replace("T", " ");
