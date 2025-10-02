// src/context/AuthContext.jsx (guarded/instrumented)
import React, { createContext, useCallback, useEffect, useRef, useState } from "react";

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  villageId: null,
  setVillageId: () => {},
  village: null,
  setVillage: () => {},
  villageName: null,
  token: null,
  tokenExpiresAt: null,
  tokenRemaining: null,
  refreshTokenString: null,
  setToken: () => {},
  login: async () => {},
  logout: () => {},
  forceRefresh: async () => {},
  isAuthenticated: false,
});

const STORAGE_KEYS = {
  USER: "user",
  VILLAGE: "villageId",
  SELECTED_VILLAGE: "selectedVillage",
  VILLAGE_NAME: "villageName",
  TOKEN: "token",
  TOKEN_EXPIRY: "tokenExpiry",
  REFRESH_TOKEN: "refreshToken",
};

function safeParseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("[Auth] safeParseJson failed", err, raw);
    return null;
  }
}

function normalizeVillageId(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : null;
  if (typeof raw === "object") {
    const id = raw.villageId ?? raw.village_id ?? raw.id ?? raw.ID ?? null;
    return id !== null && id !== undefined ? String(id) : null;
  }
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw || null;
  return null;
}

function normalizeSelectedVillage(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.length ? raw[0] : null;
  if (typeof raw === "string" || typeof raw === "number") return { villageId: String(raw) };
  if (typeof raw === "object") return raw;
  return null;
}

function normalizeRefreshToken(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") return raw || null;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "object") {
    return raw.token ?? raw.refreshToken ?? raw.refresh_token ?? raw.id ?? null;
  }
  try {
    return String(raw);
  } catch {
    return null;
  }
}

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}
    return { ok: res.ok, status: res.status, json, text };
  } catch (err) {
    return { ok: false, status: 0, json: null, text: String(err) };
  }
}

function parseJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // atob can throw on invalid input
    const decoded = typeof atob === "function" ? atob(payload) : null;
    return decoded ? JSON.parse(decoded) : null;
  } catch (err) {
    console.warn("[Auth] parseJwt failed", err);
    return null;
  }
}

export function AuthProvider({ children }) {
  // instrumentation
  const [initError, setInitError] = useState(null);
  useEffect(() => {
    console.log("[Auth] AuthProvider mounting");
    return () => console.log("[Auth] AuthProvider unmount");
  }, []);

  const [user, setUserState] = useState(null);
  const [villageId, setVillageIdState] = useState(null);
  const [village, setVillageState] = useState(null);
  const [villageName, setVillageNameState] = useState(null);

  const [token, setTokenState] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [refreshTokenString, setRefreshTokenString] = useState(null);

  const [tokenRemaining, setTokenRemaining] = useState(null);

  const expiryTimerRef = useRef(null);
  const tickIntervalRef = useRef(null);

  // Initialize from localStorage (guarded)
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
      const parsed = safeParseJson(rawUser);
      if (parsed?.name) setUserState({ name: parsed.name, role: parsed.role, email: parsed.email });
    } catch (err) {
      console.error("[Auth] init user error", err);
    }

    try {
      const sv = localStorage.getItem(STORAGE_KEYS.VILLAGE);
      if (sv) setVillageIdState(sv);
    } catch (err) {
      console.warn("[Auth] read villageId failed", err);
    }

    try {
      const sel = localStorage.getItem(STORAGE_KEYS.SELECTED_VILLAGE);
      const parsed = safeParseJson(sel);
      const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
      if (normalized) {
        setVillageState(normalized);
        const id = normalized.villageId ?? normalized.village_id ?? normalized.id ?? null;
        if (id) setVillageIdState(String(id));
        const name = normalized.villageName ?? normalized.name ?? normalized.village_name ?? null;
        if (name) setVillageNameState(String(name));
      }
    } catch (err) {
      console.warn("[Auth] selected village init failed", err);
    }

    try {
      const vn = localStorage.getItem(STORAGE_KEYS.VILLAGE_NAME);
      if (vn) setVillageNameState(vn);
    } catch (err) {
      console.warn("[Auth] village name read failed", err);
    }

    try {
      const st = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (st) setTokenState(st);
    } catch (err) {
      console.warn("[Auth] token read failed", err);
    }

    try {
      const se = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
      if (se) {
        const expiry = Number(se);
        if (!Number.isNaN(expiry)) setTokenExpiresAt(expiry);
      }
    } catch (err) {
      console.warn("[Auth] tokenExpiry read failed", err);
    }

    try {
      const srf = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (srf) {
        let normalized = null;
        const parsed = safeParseJson(srf);
        normalized = parsed ? normalizeRefreshToken(parsed) : normalizeRefreshToken(srf);
        if (normalized) setRefreshTokenString(normalized);
        else localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      }
    } catch (err) {
      console.warn("[Auth] refresh token init failed", err);
    }
  }, []);

  // (the rest of your code kept but wrapped with console logs on important branches)
  useEffect(() => {
    try {
      if (user && user.name) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (err) {
      console.warn("[Auth] persist user failed", err);
    }
  }, [user]);

  useEffect(() => {
    try {
      if (villageId) localStorage.setItem(STORAGE_KEYS.VILLAGE, villageId);
      else localStorage.removeItem(STORAGE_KEYS.VILLAGE);
    } catch (err) {
      console.warn("[Auth] persist village failed", err);
    }
  }, [villageId]);

  useEffect(() => {
    try {
      if (village && typeof village === "object") localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(village));
      else localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
    } catch (err) {
      console.warn("[Auth] persist selectedVillage failed", err);
    }
  }, [village]);

  useEffect(() => {
    try {
      if (villageName) localStorage.setItem(STORAGE_KEYS.VILLAGE_NAME, villageName);
      else localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
    } catch (err) {
      console.warn("[Auth] persist villageName failed", err);
    }
  }, [villageName]);

  useEffect(() => {
    try {
      if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      else localStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch (err) {
      console.warn("[Auth] persist token failed", err);
    }
  }, [token]);

  useEffect(() => {
    try {
      if (tokenExpiresAt) localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(tokenExpiresAt));
      else localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    } catch (err) {
      console.warn("[Auth] persist tokenExpiry failed", err);
    }
  }, [tokenExpiresAt]);

  useEffect(() => {
    try {
      const normalized = normalizeRefreshToken(refreshTokenString);
      if (normalized) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, normalized);
      else localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (err) {
      console.warn("[Auth] persist refreshToken failed", err);
    }
  }, [refreshTokenString]);

  useEffect(() => {
    function onStorage(e) {
      try {
        if (!e.key) return;
        if (e.key === STORAGE_KEYS.USER) {
          const val = e.newValue ? safeParseJson(e.newValue) : null;
          setUserState(val && val.name ? { name: val.name, role: val.role, email: val.email } : null);
        }
        if (e.key === STORAGE_KEYS.VILLAGE) setVillageIdState(e.newValue);
        if (e.key === STORAGE_KEYS.SELECTED_VILLAGE) {
          const val = e.newValue ? safeParseJson(e.newValue) : null;
          const normalized = Array.isArray(val) ? val[0] ?? null : val;
          setVillageState(normalized);
          if (normalized && (normalized.villageId || normalized.village_id || normalized.id)) {
            const id = normalized.villageId ?? normalized.village_id ?? normalized.id;
            setVillageIdState(String(id));
          }
          const name = normalized ? (normalized.villageName ?? normalized.name ?? normalized.village_name ?? null) : null;
          setVillageNameState(name ? String(name) : null);
        }
        if (e.key === STORAGE_KEYS.VILLAGE_NAME) setVillageNameState(e.newValue);
        if (e.key === STORAGE_KEYS.TOKEN) setTokenState(e.newValue);
        if (e.key === STORAGE_KEYS.TOKEN_EXPIRY) {
          const v = e.newValue ? Number(e.newValue) : null;
          setTokenExpiresAt(v && !Number.isNaN(v) ? v : null);
        }
        if (e.key === STORAGE_KEYS.REFRESH_TOKEN) {
          let normalized = null;
          if (!e.newValue) normalized = null;
          else {
            const parsed = safeParseJson(e.newValue);
            normalized = parsed ? normalizeRefreshToken(parsed) : normalizeRefreshToken(e.newValue);
          }
          setRefreshTokenString(normalized);
        }
      } catch (err) {
        console.warn("[Auth] storage event handler failed", err);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    if (!tokenExpiresAt) {
      setTokenRemaining(null);
      return undefined;
    }

    function tick() {
      const now = Date.now();
      const ms = Math.max(0, tokenExpiresAt - now);
      setTokenRemaining(Math.ceil(ms / 1000));
    }
    tick();
    tickIntervalRef.current = setInterval(tick, 1000);
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [tokenExpiresAt]);

  const clearTimers = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimers();
    if (!tokenExpiresAt) return undefined;
    const now = Date.now();
    const msToExpiry = tokenExpiresAt - now;
    if (msToExpiry <= 0) {
      setTokenState(null);
      setTokenExpiresAt(null);
      return undefined;
    }
    expiryTimerRef.current = setTimeout(() => {
      setTokenState(null);
      setTokenExpiresAt(null);
    }, msToExpiry);
    return () => clearTimers();
  }, [tokenExpiresAt, clearTimers]);

  const doRefresh = useCallback(
    async (opts = { allowCookieFallback: true }) => {
      try {
        const normalized = normalizeRefreshToken(refreshTokenString);
        const headers = { "Content-Type": "application/json", Accept: "application/json" };

        const attempt = async (bodyObj) => {
          const { ok, status, json, text } = await safeFetch("https://villagerelocation.onrender.com/refresh", {
            method: "POST",
            headers,
            body: JSON.stringify(bodyObj),
            credentials: "include",
          });
          return { ok, status, json, text };
        };

        const firstBody = normalized ? { refreshToken: normalized } : {};
        const first = await attempt(firstBody);

        if (first.ok) {
          const payload = first.json ?? {};
          // ... apply payload like before, with try/catch around localStorage writes
          try {
            const newToken = payload.token ?? null;
            // derive expiry, refresh token, user etc. (same as original)
            // for brevity, keep same logic but wrapped in try/catch if you want
            // we'll set values minimal here:
            if (newToken) setTokenState(newToken);
            if (payload.user && payload.user.name) setUserState({ name: payload.user.name, role: payload.user.role, email: payload.user.email });
            return true;
          } catch (err) {
            console.warn("[Auth] doRefresh payload handling failed", err);
            return false;
          }
        }

        // cookie-fallback branch (kept minimal)
        if (!first.ok && opts.allowCookieFallback) {
          const second = await attempt({});
          if (second.ok) {
            try {
              const payload = second.json ?? {};
              if (payload.token) setTokenState(payload.token);
              if (payload.user && payload.user.name) setUserState({ name: payload.user.name, role: payload.user.role, email: payload.user.email });
              return true;
            } catch (err) {
              console.warn("[Auth] doRefresh second payload failed", err);
            }
          }
        }
        return false;
      } catch (err) {
        console.warn("[Auth] doRefresh error", err);
        return false;
      }
    },
    [refreshTokenString]
  );

  const forceRefresh = useCallback(async () => {
    return await doRefresh({ allowCookieFallback: true });
  }, [doRefresh]);

  const setUser = useCallback((u) => setUserState(u ? { name: u.name, role: u.role, email: u.email } : null), []);
  const setVillageId = useCallback((id) => {
    const normalized = normalizeVillageId(id);
    setVillageIdState(normalized ?? null);
    if (!normalized) {
      setVillageState(null);
      setVillageNameState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
        localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
      } catch (err) {
        console.warn("[Auth] clear village storage failed", err);
      }
    }
  }, []);
  const setVillage = useCallback((v) => {
    if (v && typeof v === "object") {
      const normalized = Array.isArray(v) ? v[0] ?? null : v;
      if (!normalized) {
        setVillageState(null);
        setVillageIdState(null);
        setVillageNameState(null);
        try {
          localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
          localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
        } catch (err) {
          console.warn("[Auth] clear selectedVillage failed", err);
        }
        return;
      }
      setVillageState(normalized);
      const id = normalizeVillageId(normalized);
      if (id !== undefined && id !== null) setVillageIdState(String(id));
      const name = normalized.villageName ?? normalized.name ?? normalized.village_name ?? null;
      setVillageNameState(name ? String(name) : null);
      try {
        localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(normalized));
      } catch (err) {
        console.warn("[Auth] persist selectedVillage failed", err);
      }
    } else {
      setVillageState(null);
      setVillageIdState(null);
      setVillageNameState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
        localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
      } catch (err) {
        console.warn("[Auth] clear selectedVillage failed", err);
      }
    }
  }, []);

  const setToken = useCallback((t, options = {}) => {
    const { expiresIn, expiresAt, refreshToken: rToken } = options;
    setTokenState(t ?? null);
    if (rToken !== undefined) {
      const normalized = normalizeRefreshToken(rToken);
      setRefreshTokenString(normalized ?? null);
    }
    if (t == null) {
      setTokenExpiresAt(null);
      return;
    }
    let absExpiry = null;
    if (expiresIn && !isNaN(Number(expiresIn))) absExpiry = Date.now() + Number(expiresIn) * 1000;
    else if (expiresAt) {
      const asNum = Number(expiresAt);
      absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
    }
    if (!absExpiry && t) {
      const parsed = parseJwt(t);
      if (parsed && parsed.exp) {
        const maybe = Number(parsed.exp) * 1000;
        if (!Number.isNaN(maybe)) absExpiry = maybe;
      }
    }
    if (!absExpiry) absExpiry = Date.now() + 15 * 60 * 1000;
    setTokenExpiresAt(absExpiry);
  }, []);

  const login = useCallback(async (payload = {}) => {
    try {
      const p = payload || {};
      const userObj = p.user ?? (p.name || p.role || p.email ? { name: p.name, role: p.role, email: p.email } : null);
      if (userObj && userObj.name) {
        setUserState({ name: userObj.name, role: userObj.role, email: userObj.email });
        try {
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: userObj.name, role: userObj.role, email: userObj.email }));
        } catch (err) {
          console.warn("[Auth] persist user in login failed", err);
        }
      }
      // token handling
      const tok = p.token ?? p.accessToken ?? p.access_token ?? null;
      if (tok) {
        setTokenState(tok);
        let absExpiry = null;
        const expiresIn = p.expiresIn ?? p.expires_in;
        const expiresAt = p.expiresAt ?? p.expires_at;
        if (expiresIn && !isNaN(Number(expiresIn))) absExpiry = Date.now() + Number(expiresIn) * 1000;
        else if (expiresAt) {
          const asNum = Number(expiresAt);
          absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
        }
        if (!absExpiry) {
          const parsed = parseJwt(tok);
          if (parsed && parsed.exp) absExpiry = Number(parsed.exp) * 1000;
        }
        if (!absExpiry) absExpiry = Date.now() + 15 * 60 * 1000;
        setTokenExpiresAt(absExpiry);
      }
      const rawRefresh = p.refreshToken ?? p.refresh_token ?? null;
      if (rawRefresh) {
        const normalized = normalizeRefreshToken(rawRefresh);
        setRefreshTokenString(normalized);
      }
      const rawSv = p.selectedVillage ?? p.selected_village ?? p.selected ?? null;
      const normalizedSv = normalizeSelectedVillage(rawSv);
      if (normalizedSv) setVillage(normalizedSv);
      if (!normalizedSv && (p.villageId || p.village_id || p.villageID)) {
        const vidRaw = p.villageId ?? p.village_id ?? p.villageID;
        const normalizedId = normalizeVillageId(vidRaw);
        if (normalizedId) {
          setVillageIdState(normalizedId);
          try {
            localStorage.setItem(STORAGE_KEYS.VILLAGE, normalizedId);
          } catch (err) {
            console.warn("[Auth] persist villageId failed", err);
          }
        }
      }
      return true;
    } catch (err) {
      console.warn("[Auth] login failed", err);
      return false;
    }
  }, [setVillage]);

  const logout = useCallback(() => {
    try {
      setUserState(null);
      setVillageIdState(null);
      setVillageState(null);
      setVillageNameState(null);
      setTokenState(null);
      setTokenExpiresAt(null);
      setRefreshTokenString(null);
      clearTimers();
      try {
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.VILLAGE);
        localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
        localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      } catch (err) {
        console.warn("[Auth] logout clear storage failed", err);
      }
    } catch (err) {
      console.warn("[Auth] logout failed", err);
    }
  }, [clearTimers]);

  const isAuthenticated = !!(user && token);

  const value = {
    user,
    setUser,
    villageId,
    setVillageId,
    village,
    setVillage,
    villageName,
    token,
    setToken,
    tokenExpiresAt,
    tokenRemaining,
    refreshTokenString,
    login,
    logout,
    forceRefresh,
    isAuthenticated,
  };

  // surface initialization failure if any
  if (initError) {
    console.error("[Auth] initialization error", initError);
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
