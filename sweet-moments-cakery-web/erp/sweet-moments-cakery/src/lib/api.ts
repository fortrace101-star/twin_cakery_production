let baseUrl = import.meta.env.VITE_ERP_API_URL || "/api/erp";

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`GET ${path} – ${res.statusText}`);
    return (await res.json()) as T;
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} – ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PATCH ${path} – ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DELETE ${path} – ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  },
};
