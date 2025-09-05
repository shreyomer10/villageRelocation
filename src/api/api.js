const BASE = "https://villagerelocation.onrender.com";

export async function login({ email, password, signal } = {}) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal,
  });

  if (!res.ok) {
    // try to extract server-provided message, otherwise use status text
    try {
      const payload = await res.json();
      throw new Error(payload?.error || payload?.message || `HTTP ${res.status}`);
    } catch (err) {
      throw new Error(res.statusText || "Login failed");
    }
  }

  const payload = await res.json();
  return payload; // caller decides what to do with payload.user / payload.token
}

// LocalStorage helpers
export function saveUser(user) {
  try {
    localStorage.setItem("user", JSON.stringify(user));
  } catch (e) {
    console.warn("Failed to save user to localStorage", e);
  }
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch (e) {
    return null;
  }
}

export function saveToken(token) {
  try {
    if (token) localStorage.setItem("token", token);
  } catch (e) {
    console.warn("Failed to save token", e);
  }
}

export function getToken() {
  try {
    return localStorage.getItem("token");
  } catch (e) {
    return null;
  }
}

export function logout() {
  try {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  } catch (e) {
    // ignore
  }
}