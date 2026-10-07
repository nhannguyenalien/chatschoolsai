// Truy cập PocketBase cho Ads Agent. Có retry khi token PB hết hạn (getToken(force)).
const esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export function createAdsRepository({ baseUrl, getToken, fetchImpl = fetch }) {
  async function call(method, path, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await getToken(attempt > 0);
      const res = await fetchImpl(`${baseUrl}/api/collections/${path}`, {
        method, headers: { Authorization: token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) return method === "DELETE" ? {} : res.json();
      if (attempt === 0 && [401, 403].includes(res.status)) continue;
      throw new Error(`PocketBase ${path} ${method} lỗi (${res.status})`);
    }
  }
  const list = async (collection, filter, extra = "") =>
    (await call("GET", `${collection}/records?perPage=200${extra}&filter=${encodeURIComponent(filter)}`)).items || [];

  return {
    listConnections: (tenant) => list("ads_connections", `tenant='${esc(tenant)}'`),
    async getConnection(tenant, id) {
      const items = await list("ads_connections", `tenant='${esc(tenant)}' && id='${esc(id)}'`);
      return items[0] || null;
    },
    createConnection: (record) => call("POST", "ads_connections/records", record),
    updateConnection: (id, patch) => call("PATCH", `ads_connections/records/${encodeURIComponent(id)}`, patch),
    deleteConnection: (id) => call("DELETE", `ads_connections/records/${encodeURIComponent(id)}`),
    async listTenantsWithConnections() {
      const items = await list("ads_connections", "is_active=true", "&fields=tenant");
      return [...new Set(items.map((x) => x.tenant))];
    },
    createReport: (record) => call("POST", "ads_reports/records", record),
    listReports: (tenant, limit = 10) => list("ads_reports", `tenant='${esc(tenant)}'`, `&sort=-created&fields=id,tenant,severity,summary,model,tier,created`).then((x) => x.slice(0, limit)),
  };
}
