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

  // new exports
  plotId: null,
  selectedPlot: null,
  setPlotId: () => {},
  setSelectedPlot: () => {},
  selectPlot: () => {},
});

const STORAGE_KEYS = {
  USER: "user",
  VILLAGE: "villageId",
  SELECTED_VILLAGE: "selectedVillage",
  VILLAGE_NAME: "villageName",
  TOKEN: "token",
  TOKEN_EXPIRY: "tokenExpiry",
  REFRESH_TOKEN: "refreshToken",
  AUTH_PAYLOAD: "auth_payload",

  // new keys for selected plot
  PLOT_ID: "plotId",
  SELECTED_PLOT: "selectedPlot",
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

/* ---------- NEW: plot normalizers ---------- */
function normalizePlotId(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : null;
  if (typeof raw === "object") {
    const id = raw.plotId ?? raw.plot_id ?? raw.id ?? raw._id ?? null;
    return id !== null && id !== undefined ? String(id) : null;
  }
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw || null;
  return null;
}

function normalizeSelectedPlot(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.length ? raw[0] : null;
  if (typeof raw === "string" || typeof raw === "number") return { plotId: String(raw) };
  if (typeof raw === "object") return raw;
  return null;
}
/* ------------------------------------------- */

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

  // NEW: selected plot state
  const [plotId, setPlotIdState] = useState(null);
  const [selectedPlot, setSelectedPlotState] = useState(null);

  const expiryTimerRef = useRef(null);
  const tickIntervalRef = useRef(null);

  // Initialize from localStorage (unchanged + plot keys)...
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

    try {
      const rawAuth = localStorage.getItem(STORAGE_KEYS.AUTH_PAYLOAD);
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth);
        if (parsed?.token) setTokenState(parsed.token);

        const expiresIn = parsed?.expiresIn ?? parsed?.expires_in;
        const expiresAt = parsed?.expiresAt ?? parsed?.expires_at;
        if (expiresIn && !Number.isNaN(Number(expiresIn))) {
          setTokenExpiresAt(Date.now() + Number(expiresIn) * 1000);
        } else if (expiresAt) {
          const asNum = Number(expiresAt);
          const abs = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
          if (!Number.isNaN(abs)) setTokenExpiresAt(abs);
        }

        if (parsed?.refreshToken || parsed?.refresh_token) {
          setRefreshTokenString(normalizeRefreshToken(parsed.refreshToken ?? parsed.refresh_token));
        }

        if (parsed?.user) {
          try {
            const u = parsed.user;
            setUserState({ name: u.name ?? u.fullName ?? u.name ?? null, role: u.role ?? null, email: u.email ?? null });
            try {
              localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: u.name ?? u.fullName ?? null, role: u.role ?? null, email: u.email ?? null }));
            } catch {}
            const vidRawFromUser = u.villageID ?? u.villageId ?? u.village_id ?? u.villageIDList ?? null;
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
          } catch {}
        }

        // NEW: restore selectedPlot/plotId from auth payload if present
        if (parsed?.selectedPlot) {
          const sp = normalizeSelectedPlot(parsed.selectedPlot);
          if (sp) {
            setSelectedPlotState(sp);
            const pid = normalizePlotId(sp.plotId ?? sp.id ?? sp._id);
            if (pid) setPlotIdState(String(pid));
          }
        }
      }
    } catch {}

    // NEW: read plot keys directly from localStorage too (in case auth payload didn't include it)
    try {
      const pId = localStorage.getItem(STORAGE_KEYS.PLOT_ID);
      if (pId) setPlotIdState(pId);
    } catch {}
    try {
      const rawSelPlot = localStorage.getItem(STORAGE_KEYS.SELECTED_PLOT);
      if (rawSelPlot) {
        const parsed = JSON.parse(rawSelPlot);
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) {
          setSelectedPlotState(normalized);
          const pid = normalizePlotId(normalized.plotId ?? normalized.id ?? normalized._id);
          if (pid) setPlotIdState(String(pid));
        }
      }
    } catch {}
  }, []);

  // persisters (unchanged + plot persisters)...
  useEffect(() => {
    try {
      if (user && user.name) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {}
  }, [user]);

  useEffect(() => {
    try {
      if (villageId) localStorage.setItem(STORAGE_KEYS.VILLAGE, villageId);
      else localStorage.removeItem(STORAGE_KEYS.VILLAGE);
    } catch {}
  }, [villageId]);

  useEffect(() => {
    try {
      if (village && typeof village === "object") localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(village));
      else localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
    } catch {}
  }, [village]);

  useEffect(() => {
    try {
      if (villageName) localStorage.setItem(STORAGE_KEYS.VILLAGE_NAME, villageName);
      else localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
    } catch {}
  }, [villageName]);

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

  // NEW: persist plot state
  useEffect(() => {
    try {
      if (plotId) localStorage.setItem(STORAGE_KEYS.PLOT_ID, String(plotId));
      else localStorage.removeItem(STORAGE_KEYS.PLOT_ID);
    } catch {}
  }, [plotId]);

  useEffect(() => {
    try {
      if (selectedPlot && typeof selectedPlot === "object") localStorage.setItem(STORAGE_KEYS.SELECTED_PLOT, JSON.stringify(selectedPlot));
      else localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
    } catch {}
  }, [selectedPlot]);

  // persist full raw payload (include selectedVillage + selectedPlot)
  useEffect(() => {
    try {
      const raw = {
        token: token ?? undefined,
        expiresAt: tokenExpiresAt ?? undefined,
        refreshToken: refreshTokenString ?? undefined,
        user: user ?? undefined,
        selectedVillage: village ?? undefined,
        selectedPlot: selectedPlot ?? undefined,
      };
      const hasAny = Object.values(raw).some((v) => v !== undefined && v !== null);
      if (hasAny) {
        try {
          localStorage.setItem(STORAGE_KEYS.AUTH_PAYLOAD, JSON.stringify(raw));
        } catch {}
      } else {
        try {
          localStorage.removeItem(STORAGE_KEYS.AUTH_PAYLOAD);
        } catch {}
      }
    } catch {}
  }, [token, tokenExpiresAt, refreshTokenString, user, village, selectedPlot]);

  // storage sync across tabs (unchanged + plot keys)...
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

      // NEW: plot keys
      if (e.key === STORAGE_KEYS.PLOT_ID) {
        setPlotIdState(e.newValue);
      }
      if (e.key === STORAGE_KEYS.SELECTED_PLOT) {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          const normalized = Array.isArray(val) ? val[0] ?? null : val;
          setSelectedPlotState(normalized);
          if (normalized && (normalized.plotId || normalized.plot_id || normalized.id || normalized._id)) {
            const id = normalized.plotId ?? normalized.plot_id ?? normalized.id ?? normalized._id;
            setPlotIdState(String(id));
          }
        } catch {
          setSelectedPlotState(null);
        }
      }

      if (e.key === STORAGE_KEYS.AUTH_PAYLOAD) {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          if (parsed) {
            if (parsed.token) setTokenState(parsed.token);
            if (parsed.expiresAt) setTokenExpiresAt(Number(parsed.expiresAt));
            if (parsed.refreshToken) setRefreshTokenString(normalizeRefreshToken(parsed.refreshToken));
            if (parsed.user) setUserState(parsed.user && parsed.user.name ? { name: parsed.user.name, role: parsed.user.role, email: parsed.user.email } : null);
            if (parsed.selectedVillage) setVillageState(parsed.selectedVillage);

            // NEW: selectedPlot in auth payload
            if (parsed.selectedPlot) {
              const sp = normalizeSelectedPlot(parsed.selectedPlot);
              setSelectedPlotState(sp);
              if (sp && (sp.plotId || sp.id || sp._id)) {
                const id = sp.plotId ?? sp.id ?? sp._id;
                setPlotIdState(String(id));
              }
            }
          } else {
            setTokenState(null);
            setTokenExpiresAt(null);
            setRefreshTokenString(null);
            setUserState(null);
            setVillageState(null);
            setVillageIdState(null);
            setVillageNameState(null);
            setSelectedPlotState(null);
            setPlotIdState(null);
          }
        } catch {}
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

  // expiry timer -> automatic logout on expiry
  useEffect(() => {
    clearTimers();
    if (!tokenExpiresAt) return undefined;
    const now = Date.now();
    const msToExpiry = tokenExpiresAt - now;
    if (msToExpiry <= 0) {
      // Already expired -> ensure full logout
      setTokenState(null);
      setTokenExpiresAt(null);
      try {
        logout(); // call logout to clear user, storage, etc.
      } catch {
        // fallback clearing
        setUserState(null);
        setVillageIdState(null);
        setVillageState(null);
        setVillageNameState(null);
        setRefreshTokenString(null);
        setSelectedPlotState(null);
        setPlotIdState(null);
        try {
          localStorage.removeItem(STORAGE_KEYS.USER);
          localStorage.removeItem(STORAGE_KEYS.VILLAGE);
          localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
          localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.AUTH_PAYLOAD);
          localStorage.removeItem(STORAGE_KEYS.PLOT_ID);
          localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
        } catch {}
      }
      return undefined;
    }
    expiryTimerRef.current = setTimeout(() => {
      // on expiry, perform logout flow to clear everything and keep clients consistent
      try {
        logout();
      } catch {
        setTokenState(null);
        setTokenExpiresAt(null);
      }
    }, msToExpiry);

    return () => clearTimers();
  }, [tokenExpiresAt, clearTimers]); // logout is defined later but available at runtime

  // internal refresh implementation:
  //   - supports sending normalized refresh token string (body) or cookie-only fallback
  // RETURNS: { ok, payload?, absExpiry?, remaining?, expirySource?, status?, json?, text? }
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

        const handlePayload = (payload) => {
          const newToken = payload.token ?? null;
          const expiresIn = payload.expiresIn ?? payload.expires_in;
          const expiresAt = payload.expiresAt ?? payload.expires_at;
          const newRefreshRaw = payload.refreshToken ?? payload.refresh_token ?? null;
          const newRefresh = normalizeRefreshToken(newRefreshRaw);

          let absExpiry = null;
          let expirySource = null;
          if (expiresIn && !isNaN(Number(expiresIn))) {
            absExpiry = Date.now() + Number(expiresIn) * 1000;
            expirySource = "server";
          } else if (expiresAt) {
            const asNum = Number(expiresAt);
            absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
            expirySource = "server";
          }

          // if no expiry provided but token present, try parse 'exp' from JWT
          if (!absExpiry && newToken) {
            const parsed = parseJwt(newToken);
            if (parsed && parsed.exp) {
              const maybeExpMs = Number(parsed.exp) * 1000;
              if (!Number.isNaN(maybeExpMs)) {
                absExpiry = maybeExpMs;
                expirySource = "jwt";
              }
            }
          }

          // If we still don't have absExpiry:
          // - If there was already a tokenExpiresAt known, DO NOT overwrite it (we can't safely guess)
          // - If there was no previous expiry known, provide a fallback default (2 hours) so sessions still work.
          if (!absExpiry) {
            if (tokenExpiresAt) {
              // preserve existing expiry; don't set a new one
              expirySource = "preserve";
              absExpiry = null;
            } else if (newToken) {
              // no previous expiry and no server/jwt expiry -> fallback to 2 hours
              absExpiry = Date.now() + 2 * 3600 * 1000;
              expirySource = "fallback";
            } else {
              expirySource = "none";
            }
          }

          // Update state: only set tokenExpiresAt if we computed absExpiry (or fallback applied)
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

          // NEW: support selectedPlot returned by refresh endpoint
          if (payload.selectedPlot) {
            const sp = normalizeSelectedPlot(payload.selectedPlot);
            if (sp) {
              setSelectedPlotState(sp);
              const pid = normalizePlotId(sp.plotId ?? sp.id ?? sp._id);
              if (pid) setPlotIdState(pid);
              try {
                localStorage.setItem(STORAGE_KEYS.SELECTED_PLOT, JSON.stringify(sp));
              } catch {}
            }
          }

          const remaining = absExpiry ? Math.max(0, Math.ceil((absExpiry - Date.now()) / 1000)) : null;

          // ensure tokenRemaining immediate update only if we computed an absExpiry (or fallback)
          if (typeof remaining === "number") setTokenRemaining(remaining);

          return { ok: true, payload, absExpiry: absExpiry ?? null, remaining: remaining ?? null, expirySource };
        };

        if (first.ok) {
          const payload = first.json ?? {};
          return handlePayload(payload);
        }

        // If first failed and server indicates OTP/cookie-only expectation, try cookie-only
        const looksLikeOtpValidationError =
          (first.json &&
            first.json.detail &&
            typeof first.json.detail === "string" &&
            first.json.detail.toLowerCase().includes("otp")) ||
          (first.json &&
            first.json.errors &&
            JSON.stringify(first.json.errors).toLowerCase().includes("otp")) ||
          (first.text && first.text.toLowerCase().includes("otp")) ||
          (first.json && JSON.stringify(first.json).toLowerCase().includes("extra_forbidden"));

        if (opts.allowCookieFallback && looksLikeOtpValidationError) {
          const second = await attempt({}); // empty body (cookie flow)
          if (second.ok) {
            const payload = second.json ?? {};
            return handlePayload(payload);
          }
          return { ok: false, status: second.status, json: second.json, text: second.text };
        }

        return { ok: false, status: first.status, json: first.json, text: first.text };
      } catch (err) {
        return { ok: false, status: 0, json: null, text: String(err) };
      }
    },
    // include tokenExpiresAt so doRefresh can decide to preserve existing expiry
    [refreshTokenString, tokenExpiresAt]
  );

  // PUBLIC: forceRefresh (exposed to components). Returns result object { ok, payload, absExpiry, remaining, expirySource }
  const forceRefresh = useCallback(() => {
    return doRefresh({ allowCookieFallback: true });
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
  // NOTE: unchanged behavior: will attempt to compute expiry from params or JWT; keep this for explicit callers.
  const setToken = useCallback((t, options = {}) => {
    const { expiresIn, expiresAt, refreshToken: rToken } = options;
    setTokenState(t ?? null);
    if (rToken !== undefined) {
      const normalized = normalizeRefreshToken(rToken);
      setRefreshTokenString(normalized ?? null);
    }

    // compute absolute expiry if provided as relative or absolute
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

    // DEFAULT FALLBACK -> 2 hours (if we were asked to set an expiry or token exists)
    if (!absExpiry && (t || expiresIn || expiresAt)) absExpiry = Date.now() + 2 * 3600 * 1000;

    // If no token and no expiry requested, clear expiry
    if (!t && !expiresIn && !expiresAt) {
      setTokenExpiresAt(null);
      return;
    }

    setTokenExpiresAt(absExpiry);
  }, []);

  // login payload normalization — returns true when processed successfully
  const login = useCallback(
    async (payload = {}) => {
      try {
        const p = payload || {};
        const userObj = p.user ?? (p.name || p.role || p.email ? { name: p.name, role: p.role, email: p.email } : null);
        if (userObj && userObj.name) {
          setUserState({ name: userObj.name, role: userObj.role, email: userObj.email });
          try {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: userObj.name, role: userObj.role, email: userObj.email }));
          } catch {}
        }

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
          // set token state
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
          // DEFAULT FALLBACK -> 2 hours
          if (!absExpiry) absExpiry = Date.now() + 2 * 3600 * 1000;
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

        // NEW: selected plot from payload
        const rawSp = p.selectedPlot ?? p.selected_plot ?? p.selected ?? null;
        const normalizedSp = normalizeSelectedPlot(rawSp);
        if (normalizedSp) {
          setSelectedPlotState(normalizedSp);
          const pid = normalizePlotId(normalizedSp.plotId ?? normalizedSp.id ?? normalizedSp._id);
          if (pid) setPlotIdState(String(pid));
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

        // fallback plotId if provided directly
        if (!normalizedSp && (p.plotId || p.plot_id || p._id || p.id)) {
          const pidRaw = p.plotId ?? p.plot_id ?? p._id ?? p.id;
          const normalizedPid = normalizePlotId(pidRaw);
          if (normalizedPid) {
            setPlotIdState(normalizedPid);
            try {
              // minimal preview
              const preview = { plotId: normalizedPid };
              setSelectedPlotState(preview);
            } catch {}
          }
        }

        // persist raw backend payload
        try {
          localStorage.setItem(STORAGE_KEYS.AUTH_PAYLOAD, JSON.stringify(p));
        } catch {}

        // --- START a 2-hour expiry if the server did not provide expiry info but user logged in.
        // This covers cookie-only flows where server didn't hand back a token or expiry.
        const serverProvidedExpiry = (p.expiresIn ?? p.expires_in) || (p.expiresAt ?? p.expires_at) || null;
        if (!tok && userObj && !serverProvidedExpiry && !tokenExpiresAt) {
          // start a 2-hour session timer
          setTokenExpiresAt(Date.now() + 2 * 3600 * 1000);
        }
        // -------------------------------------------------------------------------

        return true;
      } catch (err) {
        return false;
      }
    },
    [setVillage, tokenExpiresAt]
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

    // clear plot keys too
    setSelectedPlotState(null);
    setPlotIdState(null);

    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.VILLAGE);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
      localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.AUTH_PAYLOAD);
      localStorage.removeItem(STORAGE_KEYS.PLOT_ID);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
    } catch {}
    // Keep caller responsible for redirecting if desired.
  }, [clearTimers]);

  const isAuthenticated = !!(user && token);

  // NEW: public setters for plot
  const setPlotId = useCallback((p) => {
    const normalized = normalizePlotId(p);
    setPlotIdState(normalized ?? null);
    if (!normalized) {
      setSelectedPlotState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
      } catch {}
    }
  }, []);

  const setSelectedPlot = useCallback((sp) => {
    if (sp && typeof sp === "object") {
      const normalized = Array.isArray(sp) ? sp[0] ?? null : sp;
      if (!normalized) {
        setSelectedPlotState(null);
        setPlotIdState(null);
        try {
          localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
          localStorage.removeItem(STORAGE_KEYS.PLOT_ID);
        } catch {}
        return;
      }
      setSelectedPlotState(normalized);
      const id = normalizePlotId(normalized);
      if (id !== undefined && id !== null) setPlotIdState(String(id));
      try {
        localStorage.setItem(STORAGE_KEYS.SELECTED_PLOT, JSON.stringify(normalized));
      } catch {}
    } else if (sp == null) {
      setSelectedPlotState(null);
      setPlotIdState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
        localStorage.removeItem(STORAGE_KEYS.PLOT_ID);
      } catch {}
    } else {
      // sp might be an id
      const normalizedId = normalizePlotId(sp);
      if (normalizedId) {
        setPlotIdState(normalizedId);
        const preview = { plotId: normalizedId };
        setSelectedPlotState(preview);
        try {
          localStorage.setItem(STORAGE_KEYS.SELECTED_PLOT, JSON.stringify(preview));
        } catch {}
      } else {
        setSelectedPlotState(null);
        setPlotIdState(null);
      }
    }
  }, []);

  // convenience: selectPlot similar to what you used in PlotsPage
  const selectPlot = useCallback((plot) => {
    try {
      const pid = plot.plotId ?? plot.id ?? plot._id ?? "";
      localStorage.setItem(STORAGE_KEYS.PLOT_ID, String(pid));
      const preview = {
        plotId: pid,
        name: plot.name ?? null,
        familyId: plot.familyId ?? null,
        typeId: plot.typeId ?? null,
      };
      localStorage.setItem(STORAGE_KEYS.SELECTED_PLOT, JSON.stringify(preview));
      setSelectedPlotState(preview);
      setPlotIdState(String(pid));
    } catch (e) {
      console.warn("Failed to save selected plot to localStorage", e);
    }
  }, []);

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

    // new plot exports
    plotId,
    selectedPlot,
    setPlotId,
    setSelectedPlot,
    selectPlot,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
