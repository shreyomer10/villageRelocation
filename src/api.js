// src/api.js
const BASE = "http://127.0.0.1:5000";

async function handleRes(res) {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (!res.ok) {
    const err = payload && payload.error ? payload.error : payload || res.statusText;
    const e = new Error(err);
    e.status = res.status;
    e.payload = payload;
    throw e;
  }
  return payload;
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
    ...options,
    headers,
  });
  return handleRes(res);
}

// convenience helpers
export const api = {
  getVillages: () => apiFetch("/villages"),
  getVillage: (villageId) => apiFetch(`/villages/${encodeURIComponent(villageId)}`),
  login: (email, password) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getFamilyCount: (villageId) => apiFetch(`/villages/${encodeURIComponent(villageId)}/family-count`),
};
