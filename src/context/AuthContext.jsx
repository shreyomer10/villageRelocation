// src/context/AuthContext.jsx
import React, { createContext, useCallback, useEffect, useRef, useState } from "react";

export const AuthContext = createContext({
  user: null,
  villageId: null,
  token: null,
  tokenExpiry: null,
  remainingMs: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  refreshSession: () => Promise.resolve(false),
  setVillageId: () => {},
});

const API_BASE = process.env.REACT_APP_API_BASE || "https://villagerelocation.onrender.com";

function base64UrlDecode(str) {
  if (!str) return null;
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  try {
    return atob(str);
  } catch {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch {
      return null;
    }
  }
}
function parseJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = base64UrlDecode(parts[1]);
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [villageId, setVillageIdState] = useState(null);
  const [token, setTokenState] = useState(null); // readable token if backend returned it (app flow)
  const [tokenExpiry, setTokenExpiry] = useState(null); // ms since epoch
  const [remainingMs, setRemainingMs] = useState(null);

  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  // timers
  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimers = useCallback(
    (expiryMs) => {
      clearTimers();
      setTokenExpiry(expiryMs);

      const tick = () => {
        const rem = Math.max(0, expiryMs - Date.now());
        setRemainingMs(rem);
        if (rem <= 0) {
          clearTimers();
          doLogout(); // auto logout on expiry
        }
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);

      const msUntilExpiry = Math.max(0, expiryMs - Date.now());
      timeoutRef.current = setTimeout(() => {
        clearTimers();
        doLogout();
      }, msUntilExpiry + 50);
    },
    [clearTimers]
  );

  // persistent init
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.name) setUserState({ name: parsed.name });
      }
    } catch {}

    const storedVillage = localStorage.getItem("villageId");
    if (storedVillage) setVillageIdState(storedVillage);

    const storedToken = localStorage.getItem("token");
    if (storedToken) setTokenState(storedToken);

    const storedExpiry = localStorage.getItem("tokenExpiry");
    if (storedExpiry) {
      const ms = Number(storedExpiry);
      if (!Number.isNaN(ms)) {
        startTimers(ms);
        return;
      }
    }

    // otherwise attempt to fetch session info (useful if server set httpOnly cookie)
    fetchSessionInfo().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist changes
  useEffect(() => {
    if (user && user.name) localStorage.setItem("user", JSON.stringify({ name: user.name }));
    else localStorage.removeItem("user");
  }, [user]);

  useEffect(() => {
    if (villageId) localStorage.setItem("villageId", villageId);
    else localStorage.removeItem("villageId");
  }, [villageId]);

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (tokenExpiry) localStorage.setItem("tokenExpiry", tokenExpiry.toString());
    else localStorage.removeItem("tokenExpiry");
  }, [tokenExpiry]);

  // multi-tab sync
  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      if (e.key === "user") {
        try {
          const v = e.newValue ? JSON.parse(e.newValue) : null;
          setUserState(v && v.name ? { name: v.name } : null);
        } catch {
          setUserState(null);
        }
      } else if (e.key === "villageId") {
        setVillageIdState(e.newValue);
      } else if (e.key === "token") {
        setTokenState(e.newValue);
      } else if (e.key === "tokenExpiry") {
        const ms = e.newValue ? Number(e.newValue) : null;
        if (ms && !Number.isNaN(ms)) startTimers(ms);
        else {
          clearTimers();
          setTokenExpiry(null);
          setRemainingMs(null);
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [startTimers, clearTimers]);

  // fetch session info (for cookie-only web flow)
  const fetchSessionInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return false;
      const payload = await res.json();

      const u = payload?.user;
      if (u?.name) setUserState({ name: u.name });

      // token might be returned in cookies dict or token field
      const tkn = payload?.cookies?.token ?? payload?.token ?? null;
      if (tkn) setTokenState(tkn);

      let expiryMs = null;
      if (payload?.tokenExpiry) expiryMs = Number(payload.tokenExpiry);
      else if (payload?.expiry) expiryMs = Number(payload.expiry);
      else if (tkn) {
        const dec = parseJwt(tkn);
        if (dec?.exp) expiryMs = Number(dec.exp) * 1000;
      }

      if (expiryMs && !Number.isNaN(expiryMs)) {
        startTimers(expiryMs);
        return true;
      }
      return !!u;
    } catch {
      return false;
    }
  }, [startTimers]);

  // core logout (clears local data and asks server to clear cookie)
  const doLogout = useCallback(() => {
    clearTimers();
    setUserState(null);
    setVillageIdState(null);
    setTokenState(null);
    setTokenExpiry(null);
    setRemainingMs(null);
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("villageId");
      localStorage.removeItem("token");
      localStorage.removeItem("tokenExpiry");
    } catch {}

    // best-effort notify backend to clear cookie
    fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  }, [clearTimers]);

  // public API: login({ name, token, tokenExpiry })
  const login = useCallback(
    ({ name, token: tkn, tokenExpiry: expiry }) => {
      if (name) setUserState({ name });
      if (tkn) setTokenState(tkn);

      let expiryMs = null;
      if (expiry) expiryMs = Number(expiry);
      else if (tkn) {
        const dec = parseJwt(tkn);
        if (dec?.exp) expiryMs = Number(dec.exp) * 1000;
      }

      if (expiryMs && !Number.isNaN(expiryMs)) startTimers(expiryMs);
      else fetchSessionInfo().catch(() => {});
    },
    [startTimers, fetchSessionInfo]
  );

  const logout = useCallback(() => {
    doLogout();
  }, [doLogout]);

  // refreshSession: uses Authorization header if token readable (app flow),
  // otherwise uses credentials: "include" to let cookie-based refresh happen.
  const refreshSession = useCallback(async () => {
    try {
      const hasReadableToken = Boolean(token);
      const headers = { "Content-Type": "application/json" };
      let fetchOpts = {
        method: "POST",
        headers,
        credentials: hasReadableToken ? "omit" : "include", // if token present use header, else use cookie
      };

      if (hasReadableToken) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/auth/refresh`, fetchOpts);
      if (!res.ok) return false;
      const payload = await res.json();

      // payload shape (per your docs): may return { token, employee/user }
      const u = payload?.user ?? payload?.employee;
      if (u?.name) setUserState({ name: u.name });

      const newToken = payload?.cookies?.token ?? payload?.token ?? null;
      if (newToken) setTokenState(newToken);

      let expiryMs = null;
      if (payload?.tokenExpiry) expiryMs = Number(payload.tokenExpiry);
      else if (payload?.expiry) expiryMs = Number(payload.expiry);
      else if (newToken) {
        const dec = parseJwt(newToken);
        if (dec?.exp) expiryMs = Number(dec.exp) * 1000;
      }

      if (expiryMs && !Number.isNaN(expiryMs)) {
        startTimers(expiryMs);
      } else {
        // fallback: re-fetch session info (cookie-only flows)
        await fetchSessionInfo();
      }
      return true;
    } catch {
      return false;
    }
  }, [token, startTimers, fetchSessionInfo]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const isAuthenticated = Boolean(user && (token || tokenExpiry || (remainingMs && remainingMs > 0)));

  return (
    <AuthContext.Provider
      value={{
        user,
        villageId,
        token,
        tokenExpiry,
        remainingMs,
        isAuthenticated,
        login,
        logout,
        refreshSession,
        setVillageId: (id) => setVillageIdState(id ?? null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
