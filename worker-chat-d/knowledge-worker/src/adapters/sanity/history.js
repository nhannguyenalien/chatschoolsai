const DEFAULT_API_VERSION = "v2021-06-07";
const SAFE_PROJECT_ID = /^[a-z0-9-]+$/;
const SAFE_DATASET = /^[A-Za-z0-9_-]+$/;

export class SanityHistoryConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SanityHistoryConfigurationError";
  }
}

function parseSiteTarget(site) {
  const [projectId, dataset, ...rest] = String(site?.page_id || "").split(":");
  if (!projectId || !dataset || rest.length || !SAFE_PROJECT_ID.test(projectId) || !SAFE_DATASET.test(dataset)) {
    throw new SanityHistoryConfigurationError('Sanity page_id must use the safe "projectId:dataset" format.');
  }
  return { projectId, dataset };
}

export function createSanityHistoryAdapter({ fetchImpl = fetch, apiVersion = DEFAULT_API_VERSION } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Sanity history adapter requires fetch.");

  return {
    supports(site) {
      return site?.platform === "sanity";
    },

    async listHistoricalTopics(site) {
      if (!this.supports(site)) return [];
      const { projectId, dataset } = parseSiteTarget(site);
      const query = '*[_type == "blog" && !defined(translationOf)] | order(_createdAt desc){title}';
      const url = `https://${projectId}.api.sanity.io/${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}`;
      const headers = { Accept: "application/json" };
      if (site.access_token) headers.Authorization = `Bearer ${site.access_token}`;

      const response = await fetchImpl(url, { headers });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`Sanity history query returned invalid JSON (HTTP ${response.status}).`);
      }
      if (!response.ok) {
        const detail = payload?.error?.description || payload?.error?.message || payload?.message || `HTTP ${response.status}`;
        throw new Error(`Sanity history query failed: ${detail}`);
      }
      if (!Array.isArray(payload.result)) throw new Error("Sanity history query returned an invalid result.");
      return payload.result
        .filter((document) => typeof document?.title === "string" && document.title.trim())
        .map((document) => ({ title: document.title.trim(), source: "legacy-sanity" }));
    },
  };
}
