// src/context/AuthContext.jsx
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

/** Minimal safe fetch that returns parsed JSON when available and text otherwise */
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

/** Try decode JWT payload (no signature verification) */
function parseJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
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

  // Initialize from localStorage
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.name) setUserState({ name: parsed.name, role: parsed.role, email: parsed.email });
      }
    } catch {}

    const sv = localStorage.getItem(STORAGE_KEYS.VILLAGE);
    if (sv) setVillageIdState(sv);

    try {
      const sel = localStorage.getItem(STORAGE_KEYS.SELECTED_VILLAGE);
      if (sel) {
        const parsed = JSON.parse(sel);
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) {
          setVillageState(normalized);
          const id = normalized.villageId ?? normalized.village_id ?? normalized.id ?? null;
          if (id) setVillageIdState(String(id));
          const name = normalized.villageName ?? normalized.name ?? normalized.village_name ?? null;
          if (name) setVillageNameState(String(name));
        }
      }
    } catch {}

    const vn = localStorage.getItem(STORAGE_KEYS.VILLAGE_NAME);
    if (vn) setVillageNameState(vn);

    const st = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (st) setTokenState(st);

    const se = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    if (se) {
      const expiry = Number(se);
      if (!Number.isNaN(expiry)) setTokenExpiresAt(expiry);
    }

    try {
      const srf = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (srf) {
        let normalized = null;
        try {
          const parsed = JSON.parse(srf);
          normalized = normalizeRefreshToken(parsed);
        } catch {
          normalized = normalizeRefreshToken(srf);
        }
        if (normalized) {
          setRefreshTokenString(normalized);
        } else {
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        }
      }
    } catch {}
  }, []);

  // persist user
  useEffect(() => {
    try {
      if (user && user.name) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {}
  }, [user]);

  // persist villageId
  useEffect(() => {
    try {
      if (villageId) localStorage.setItem(STORAGE_KEYS.VILLAGE, villageId);
      else localStorage.removeItem(STORAGE_KEYS.VILLAGE);
    } catch {}
  }, [villageId]);

  // persist selected village object
  useEffect(() => {
    try {
      if (village && typeof village === "object") localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(village));
      else localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
    } catch {}
  }, [village]);

  // persist village name
  useEffect(() => {
    try {
      if (villageName) localStorage.setItem(STORAGE_KEYS.VILLAGE_NAME, villageName);
      else localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
    } catch {}
  }, [villageName]);

  // persist token + expiry + refreshToken
  useEffect(() => {
    try {
      if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      else localStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch {}
  }, [token]);

  useEffect(() => {
    try {
      if (tokenExpiresAt) localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(tokenExpiresAt));
      else localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    } catch {}
  }, [tokenExpiresAt]);

  useEffect(() => {
    try {
      const normalized = normalizeRefreshToken(refreshTokenString);
      if (normalized) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, normalized);
      else localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch {}
  }, [refreshTokenString]);

  // storage sync across tabs
  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      try {
        if (e.key === STORAGE_KEYS.USER) {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          setUserState(val && val.name ? { name: val.name, role: val.role, email: val.email } : null);
        }
      } catch {
        setUserState(null);
      }
      if (e.key === STORAGE_KEYS.VILLAGE) setVillageIdState(e.newValue);
      if (e.key === STORAGE_KEYS.SELECTED_VILLAGE) {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          const normalized = Array.isArray(val) ? val[0] ?? null : val;
          setVillageState(normalized);
          if (normalized && (normalized.villageId || normalized.village_id || normalized.id)) {
            const id = normalized.villageId ?? normalized.village_id ?? normalized.id;
            setVillageIdState(String(id));
          }
          const name = normalized ? (normalized.villageName ?? normalized.name ?? normalized.village_name ?? null) : null;
          setVillageNameState(name ? String(name) : null);
        } catch {
          setVillageState(null);
          setVillageNameState(null);
        }
      }
      if (e.key === STORAGE_KEYS.VILLAGE_NAME) setVillageNameState(e.newValue);
      if (e.key === STORAGE_KEYS.TOKEN) setTokenState(e.newValue);
      if (e.key === STORAGE_KEYS.TOKEN_EXPIRY) {
        const v = e.newValue ? Number(e.newValue) : null;
        setTokenExpiresAt(v && !Number.isNaN(v) ? v : null);
      }
      if (e.key === STORAGE_KEYS.REFRESH_TOKEN) {
        try {
          let normalized = null;
          if (!e.newValue) normalized = null;
          else {
            try {
              const parsed = JSON.parse(e.newValue);
              normalized = normalizeRefreshToken(parsed);
            } catch {
              normalized = normalizeRefreshToken(e.newValue);
            }
          }
          setRefreshTokenString(normalized);
        } catch {
          setRefreshTokenString(null);
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // tick for tokenRemaining (updates every second)
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

  // clear timers helper
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

  // expiry timer -> possible automatic state clear on expiry
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

  // internal refresh implementation:
  //   - supports sending normalized refresh token string (body) or cookie-only fallback
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
          const newToken = payload.token ?? null;
          const expiresIn = payload.expiresIn ?? payload.expires_in;
          const expiresAt = payload.expiresAt ?? payload.expires_at;
          const newRefreshRaw = payload.refreshToken ?? payload.refresh_token ?? null;
          const newRefresh = normalizeRefreshToken(newRefreshRaw);

          let absExpiry = null;
          if (expiresIn && !isNaN(Number(expiresIn))) absExpiry = Date.now() + Number(expiresIn) * 1000;
          else if (expiresAt) {
            const asNum = Number(expiresAt);
            absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
          }

          // if no expiry provided but token present, try parse 'exp' from JWT
          if (!absExpiry && newToken) {
            const parsed = parseJwt(newToken);
            if (parsed && parsed.exp) {
              const maybeExpMs = Number(parsed.exp) * 1000;
              if (!Number.isNaN(maybeExpMs)) absExpiry = maybeExpMs;
            }
          }
          if (!absExpiry && newToken) absExpiry = Date.now() + 15 * 60 * 1000;

          setTokenState(newToken);
          if (absExpiry) setTokenExpiresAt(absExpiry);
          if (newRefresh) setRefreshTokenString(newRefresh);

          if (payload.user && payload.user.name) {
            setUserState({ name: payload.user.name, role: payload.user.role, email: payload.user.email });
            try {
              localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: payload.user.name, role: payload.user.role, email: payload.user.email }));
            } catch {}
          } else if (newToken) {
            // derive user from JWT if present
            const parsed = parseJwt(newToken);
            if (parsed && (parsed.name || parsed.email || parsed.sub)) {
              setUserState({ name: parsed.name ?? parsed.sub ?? null, role: parsed.role ?? null, email: parsed.email ?? null });
              try {
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: parsed.name ?? parsed.sub ?? null, role: parsed.role ?? null, email: parsed.email ?? null }));
              } catch {}
            }
          }

          if (payload.selectedVillage) {
            const sv = normalizeSelectedVillage(payload.selectedVillage);
            if (sv) {
              setVillageState(sv);
              const id = normalizeVillageId(sv);
              if (id) setVillageIdState(id);
              const name = sv.villageName ?? sv.name ?? sv.village_name ?? null;
              setVillageNameState(name ? String(name) : null);
              try {
                localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(sv));
              } catch {}
            }
          }

          return true;
        }

        // If first failed and server indicates OTP/cookie-only expectation, try cookie-only
        if (!first.ok) {
          const looksLikeOtpValidationError =
            (first.json &&
              first.json.detail &&
              typeof first.json.detail === "string" &&
              first.json.detail.toLowerCase().includes("otp")) ||
            (first.json &&
              first.json.errors &&
              JSON.stringify(first.json.errors).toLowerCase().includes("otp")) ||
            (first.text && first.text.toLowerCase().includes("otp")) ||
            (first.json &&
              JSON.stringify(first.json).toLowerCase().includes("extra_forbidden"));

          if (opts.allowCookieFallback && looksLikeOtpValidationError) {
            const second = await attempt({}); // empty body (cookie flow)
            if (second.ok) {
              const payload = second.json ?? {};
              const newToken = payload.token ?? null;
              const expiresIn = payload.expiresIn ?? payload.expires_in;
              const expiresAt = payload.expiresAt ?? payload.expires_at;
              const newRefreshRaw = payload.refreshToken ?? payload.refresh_token ?? null;
              const newRefresh = normalizeRefreshToken(newRefreshRaw);

              let absExpiry = null;
              if (expiresIn && !isNaN(Number(expiresIn))) absExpiry = Date.now() + Number(expiresIn) * 1000;
              else if (expiresAt) {
                const asNum = Number(expiresAt);
                absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
              }

              if (!absExpiry && newToken) {
                const parsed = parseJwt(newToken);
                if (parsed && parsed.exp) absExpiry = Number(parsed.exp) * 1000;
              }
              if (!absExpiry && newToken) absExpiry = Date.now() + 15 * 60 * 1000;

              setTokenState(newToken);
              if (absExpiry) setTokenExpiresAt(absExpiry);
              if (newRefresh) setRefreshTokenString(newRefresh);

              if (payload.user && payload.user.name) {
                setUserState({ name: payload.user.name, role: payload.user.role, email: payload.user.email });
                try {
                  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: payload.user.name, role: payload.user.role, email: payload.user.email }));
                } catch {}
              } else if (newToken) {
                const parsed = parseJwt(newToken);
                if (parsed && (parsed.name || parsed.email || parsed.sub)) {
                  setUserState({ name: parsed.name ?? parsed.sub ?? null, role: parsed.role ?? null, email: parsed.email ?? null });
                }
              }

              if (payload.selectedVillage) {
                const sv = normalizeSelectedVillage(payload.selectedVillage);
                if (sv) {
                  setVillageState(sv);
                  const id = normalizeVillageId(sv);
                  if (id) setVillageIdState(id);
                  const name = sv.villageName ?? sv.name ?? sv.village_name ?? null;
                  setVillageNameState(name ? String(name) : null);
                }
              }

              return true;
            }
          }
          return false;
        }

        return false;
      } catch (err) {
        return false;
      }
    },
    [refreshTokenString]
  );

  // PUBLIC: forceRefresh (exposed to components). Returns boolean; does not auto-logout.
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
      } catch {}
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
        } catch {}
        return;
      }
      setVillageState(normalized);
      const id = normalizeVillageId(normalized);
      if (id !== undefined && id !== null) setVillageIdState(String(id));
      const name = normalized.villageName ?? normalized.name ?? normalized.village_name ?? null;
      setVillageNameState(name ? String(name) : null);
      try {
        localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(normalized));
      } catch {}
    } else {
      setVillageState(null);
      setVillageIdState(null);
      setVillageNameState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
        localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
      } catch {}
    }
  }, []);

  // setToken helper for callers - accepts options { expiresIn, expiresAt, refreshToken }
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

    // if server didn't provide expiry but token is JWT, attempt to read exp claim
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

  // login payload normalization â€” returns true when processed successfully
  const login = useCallback(
    async (payload = {}) => {
      try {
        const p = payload || {};
        // If server returned a token only, try parse the token to derive user + expiry
        const userObj = p.user ?? (p.name || p.role || p.email ? { name: p.name, role: p.role, email: p.email } : null);
        if (userObj && userObj.name) {
          setUserState({ name: userObj.name, role: userObj.role, email: userObj.email });
          try {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: userObj.name, role: userObj.role, email: userObj.email }));
          } catch {}
        }

        // village from user object
        if (userObj) {
          const vidRawFromUser = userObj.villageID ?? userObj.villageId ?? userObj.village_id ?? userObj.villageIDList ?? null;
          const normalizedFromUser = normalizeVillageId(vidRawFromUser);
          if (normalizedFromUser) {
            setVillageIdState(normalizedFromUser);
            const minimalSv = { villageId: normalizedFromUser };
            setVillageState(minimalSv);
            try {
              localStorage.setItem(STORAGE_KEYS.VILLAGE, normalizedFromUser);
              localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(minimalSv));
            } catch {}
          }
        }

        // token handling: accept token or accessToken
        const tok = p.token ?? p.accessToken ?? p.access_token ?? null;
        if (tok) {
          // use setToken helper to automatically parse expiry if possible
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

          // If user not provided, try extract from JWT payload
          if (!userObj) {
            const parsed = parseJwt(tok);
            if (parsed && (parsed.name || parsed.email || parsed.sub)) {
              setUserState({ name: parsed.name ?? parsed.sub ?? null, role: parsed.role ?? null, email: parsed.email ?? null });
              try {
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: parsed.name ?? parsed.sub ?? null, role: parsed.role ?? null, email: parsed.email ?? null }));
              } catch {}
            }
          }
        }

        // refresh token
        const rawRefresh = p.refreshToken ?? p.refresh_token ?? null;
        if (rawRefresh) {
          const normalized = normalizeRefreshToken(rawRefresh);
          setRefreshTokenString(normalized);
        }

        // selected village
        const rawSv = p.selectedVillage ?? p.selected_village ?? p.selected ?? null;
        const normalizedSv = normalizeSelectedVillage(rawSv);
        if (normalizedSv) {
          setVillage(normalizedSv);
        }

        // fallback villageId fields
        if (!normalizedSv && (p.villageId || p.village_id || p.villageID)) {
          const vidRaw = p.villageId ?? p.village_id ?? p.villageID;
          const normalizedId = normalizeVillageId(vidRaw);
          if (normalizedId) {
            setVillageIdState(normalizedId);
            try {
              localStorage.setItem(STORAGE_KEYS.VILLAGE, normalizedId);
            } catch {}
          }
        }

        return true;
      } catch (err) {
        return false;
      }
    },
    [setVillage]
  );

  const logout = useCallback(() => {
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
    } catch {}
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
