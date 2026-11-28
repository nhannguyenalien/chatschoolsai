// PocketBase trong bộ nhớ cho test: cùng giao diện get/create/update/delete/list, lọc kiểu a='x' && b='y'.
export function createMemoryClient({ failCreate } = {}) {
  const tables = new Map();
  const counts = new Map();
  let seq = 0;
  const table = (name) => tables.get(name) || tables.set(name, new Map()).get(name);
  const missing = () => Object.assign(new Error("not found"), { status: 404 });
  return {
    rows: (name) => [...table(name).values()],
    async get(name, id) { const row = table(name).get(id); if (!row) throw missing(); return { ...row }; },
    async create(name, data) {
      counts.set(name, (counts.get(name) || 0) + 1);
      if (failCreate?.(name, counts.get(name))) throw Object.assign(new Error("boom"), { status: 500 });
      seq += 1;
      const row = { ...data, id: `rec${seq}`, created: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString() };
      table(name).set(row.id, row);
      return { ...row };
    },
    async update(name, id, patch) { const row = table(name).get(id); if (!row) throw missing(); Object.assign(row, patch); return { ...row }; },
    async delete(name, id) { if (!table(name).delete(id)) throw missing(); return null; },
    async list(name, { filter = "", sort = "", page = 1, perPage = 50 } = {}) {
      const conditions = filter ? filter.split(" && ").map((part) => /^(\w+)='(.*)'$/.exec(part)) : [];
      if (conditions.some((c) => !c)) throw new Error(`unsupported filter ${filter}`);
      let items = [...table(name).values()].filter((row) => conditions.every(([, key, value]) => String(row[key]) === value));
      if (sort) { const down = sort.startsWith("-"); const key = sort.replace("-", ""); items.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (down ? -1 : 1)); }
      return { items: items.slice((page - 1) * perPage, page * perPage).map((row) => ({ ...row })), totalPages: Math.max(1, Math.ceil(items.length / perPage)) };
    },
  };
}
