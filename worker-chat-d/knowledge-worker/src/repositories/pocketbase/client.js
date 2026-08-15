export function escapePocketBaseFilter(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export class PocketBaseRepositoryError extends Error {
  constructor(operation, status, detail) {
    super(`PocketBase ${operation} failed (${status}): ${detail}`);
    this.name = "PocketBaseRepositoryError";
    this.status = status;
  }
}

export function createPocketBaseClient({ baseUrl, token, fetchImpl = fetch }) {
  if (!baseUrl) throw new Error("PocketBase baseUrl is required.");
  const root = baseUrl.replace(/\/$/, "");
  const headers = { Authorization: token, "Content-Type": "application/json" };

  async function request(operation, path, init = {}) {
    const response = await fetchImpl(`${root}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new PocketBaseRepositoryError(operation, response.status, data?.message || text || "Unknown error");
    }
    return data;
  }

  return {
    get(collection, id) {
      return request(`get ${collection}`, `/api/collections/${collection}/records/${encodeURIComponent(id)}`);
    },
    create(collection, record) {
      return request(`create ${collection}`, `/api/collections/${collection}/records`, {
        method: "POST", body: JSON.stringify(record),
      });
    },
    update(collection, id, patch) {
      return request(`update ${collection}`, `/api/collections/${collection}/records/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify(patch),
      });
    },
    delete(collection, id) {
      return request(`delete ${collection}`, `/api/collections/${collection}/records/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    list(collection, { filter, sort, page = 1, perPage = 50 } = {}) {
      const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
      if (filter) query.set("filter", filter);
      if (sort) query.set("sort", sort);
      return request(`list ${collection}`, `/api/collections/${collection}/records?${query}`);
    },
  };
}
