// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback, useRef } from "react";

// set this to your backend base URL
const API_BASE = "https://villagerelocation.onrender.com";

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  villageId: null,
  setVillageId: () => {},
  // token left for backwards compat; avoid depending on it for cookie-based auth
  token: null,
  setToken: () => {},
  login: async () => {},
  logout: () => {},
  apiFetch: async () => {}, // helper for authenticated fetches (sends cookies)
});

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null); // { name, email, ... }
  const [villageId, setVillageIdState] = useState(null);
  const [token, setTokenState] = useState(null); // optional: only if backend returns a token in JSON

  // for refresh control
  const isRefreshingRef = useRef(false);

  // --- Initialize from localStorage (only safe, non-sensitive items) ---
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.name) setUserState(parsed);
      }
    } catch (e) {
      // ignore parse errors
    }

    const storedVillage = localStorage.getItem("villageId");
    if (storedVillage) setVillageIdState(storedVillage);

    // NOTE: we intentionally do NOT read token from localStorage by default
    // to encourage cookie-based auth. If your backend returns token in JSON and
    // you want it stored, you can set it via login() and it will be kept in memory.
  }, []);

  // persist user (safe small object) and villageId
  useEffect(() => {
    if (user && user.name) {
      try {
        localStorage.setItem("user", JSON.stringify(user));
      } catch (e) {}
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  useEffect(() => {
    if (villageId) localStorage.setItem("villageId", villageId);
    else localStorage.removeItem("villageId");
  }, [villageId]);

  // NOTE: do NOT persist token in localStorage by default for HttpOnly cookie flows.
  useEffect(() => {
    if (!token) return;
    // keep token only in memory; if you want to persist, uncomment:
    // localStorage.setItem("token", token);
  }, [token]);

  // storage event listener: sync across tabs for user/village changes
  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      if (e.key === "user") {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          setUserState(val && val.name ? val : null);
        } catch {
          setUserState(null);
        }
      } else if (e.key === "villageId") {
        setVillageIdState(e.newValue);
      }
      // token key intentionally not handled here
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // safe setters
  const setUser = useCallback((u) => setUserState(u ? { ...u } : null), []);
  const setVillageId = useCallback((id) => setVillageIdState(id ?? null), []);
  const setToken = useCallback((t) => setTokenState(t ?? null), []);

  // ---------------- Helper: refresh session ----------------
  // Calls the backend refresh endpoint to renew access (server should set cookie)
  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include", // important: send cookies
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        isRefreshingRef.current = false;
        return false;
      }

      const payload = await res.json();
      // backend may return user and optional token
      if (payload?.user) setUserState(payload.user);
      if (payload?.token) setTokenState(payload.token);

      isRefreshingRef.current = false;
      return true;
    } catch (err) {
      isRefreshingRef.current = false;
      return false;
    }
  }, []);

  // ---------------- Helper: apiFetch ----------------
  // A small wrapper around fetch that:
  // - includes credentials by default
  // - if receives 401, attempts a refresh() then retries once
  const apiFetch = useCallback(
    async (input, init = {}) => {
      const merged = {
        credentials: "include", // ensures cookies are sent
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
        ...init,
      };

      // First attempt
      let res = await fetch(typeof input === "string" ? `${API_BASE}${input}` : input, merged);

      // If unauthorized, try refreshing once and retry
      if (res.status === 401) {
        const didRefresh = await refresh();
        if (didRefresh) {
          // retry once
          res = await fetch(typeof input === "string" ? `${API_BASE}${input}` : input, merged);
        } else {
          // refresh failed → logout (clear local state)
          // do not call external logout endpoint here (we do it explicitly in logout())
          setUserState(null);
          setVillageIdState(null);
          setTokenState(null);
        }
      }

      return res;
    },
    [refresh]
  );

  // ---------------- login ----------------
  // Accepts credentials object: { email, password, is_app: true/false }
  // The server should set the HttpOnly cookie on successful login (browser will store it)
  const login = useCallback(
    async (credentials) => {
      const payload = credentials || {};
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          credentials: "include", // important: receive cookie
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          let errMsg = "Login failed.";
          try {
            const body = await res.json();
            if (body?.error) errMsg = body.error;
            else if (body?.message) errMsg = body.message;
          } catch {}
          throw new Error(errMsg);
        }

        const data = await res.json();
        // expected: data.user (server may also send cookies server-side)
        if (data?.user) {
          setUserState(data.user);
        }
        // server might return a token in JSON for non-HttpOnly flows (optional)
        if (data?.token) {
          setTokenState(data.token);
        }

        return { ok: true, data };
      } catch (err) {
        return { ok: false, error: err?.message || "Login failed" };
      }
    },
    []
  );

  // ---------------- logout ----------------
  // Try to call the server logout to clear cookie; clear local state
  const logout = useCallback(async () => {
    try {
      // Optional: if server exposes a logout endpoint that clears cookies
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      // ignore network errors
    } finally {
      setUserState(null);
      setVillageIdState(null);
      setTokenState(null);
      try {
        localStorage.removeItem("user");
        localStorage.removeItem("villageId");
        // do not remove token from localStorage because we don't persist it
      } catch (e) {}
    }
  }, []);

  // Optionally: try to restore session on mount by calling refresh()
  useEffect(() => {
    // Attempt to refresh session silently (non-blocking)
    (async () => {
      try {
        await refresh();
      } catch (e) {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const value = {
    user,
    setUser,
    villageId,
    setVillageId,
    token, // may be null for HttpOnly cookie flows
    setToken,
    login,
    logout,
    apiFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
