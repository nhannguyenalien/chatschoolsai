// Route /api/v1/ads/* và /api/v1/trigger/ads (xác thực bằng API key của tenant ở index.js).
export async function handleAdsRoute({ request, url, tenant, service, encrypt, cors }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
  const path = url.pathname;
  try {
    if (path === "/api/v1/ads/connections" && request.method === "GET") return json({ connections: await service.list(tenant) });
    if (path === "/api/v1/ads/connections" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      return json({ connection: await service.connect(tenant, { ...body, accountIds: body.account_ids, encrypt }) }, 201);
    }
    const del = path.match(/^\/api\/v1\/ads\/connections\/([^/]+)$/);
    if (del && request.method === "DELETE") { await service.remove(tenant, del[1]); return json({ success: true }); }
    if (path === "/api/v1/ads/reports" && request.method === "GET") return json({ reports: await service.reports(tenant) });
    if (path === "/api/v1/trigger/ads" && request.method === "POST") {
      const result = await service.runForTenant(tenant, { send: true });
      return json(result.skipped ? { success: true, skipped: true, reason: result.reason } : { success: true, severity: result.severity, tier: result.tier, report: result.text });
    }
  } catch (err) {
    return json({ error: err.status ? err.message : "Lỗi máy chủ khi xử lý Ads Agent." }, err.status || 500);
  }
  return null;
}
