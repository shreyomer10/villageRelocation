import React, { createContext, useState, useEffect, useCallback, useRef } from "react";

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  villageId: null,
  setVillageId: () => {},
  village: null,
  setVillage: () => {},
  villageName: null,
  token: null,
  tokenExpiresAt: null, // timestamp (ms)
  tokenRemaining: null, // seconds
  refreshToken: null, // function to manually refresh
  setToken: () => {},
  login: async () => {},
  logout: () => {},
  forceRefresh: async () => {},
});

const STORAGE_KEYS = {
  USER: "user",
  VILLAGE: "villageId",
  SELECTED_VILLAGE: "selectedVillage",
  VILLAGE_NAME: "villageName",
  TOKEN: "token",
  TOKEN_EXPIRY: "tokenExpiry", // number (ms)
  REFRESH_TOKEN: "refreshToken",
};

// NOTE: automatic pre-expiry refresh has been removed intentionally.
// Refresh will only occur when the UI calls refreshToken() or forceRefresh().
export function AuthProvider({ children }) {
  // user now stores { name, role, email }
  const [user, setUserState] = useState(null);

  // villageId (string) and full village object (optional)
  const [villageId, setVillageIdState] = useState(null);
  const [village, setVillageState] = useState(null);
  const [villageName, setVillageNameState] = useState(null);

  const [token, setTokenState] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null); // number (ms)
  const [refreshTokenState, setRefreshTokenState] = useState(null);

  // derived: seconds remaining
  const [tokenRemaining, setTokenRemaining] = useState(null);

  // timer refs
  const expiryTimerRef = useRef(null);
  const tickIntervalRef = useRef(null);

  // initialize from localStorage once on mount
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.name) setUserState({ name: parsed.name, role: parsed.role, email: parsed.email });
      }
    } catch (e) {
      // ignore
    }

    const sv = localStorage.getItem(STORAGE_KEYS.VILLAGE);
    if (sv) setVillageIdState(sv);

    try {
      const sel = localStorage.getItem(STORAGE_KEYS.SELECTED_VILLAGE);
      if (sel) {
        const parsed = JSON.parse(sel);
        if (parsed) {
          setVillageState(parsed);
          const id =
            parsed.villageId ??
            parsed.village_id ??
            parsed.id ??
            (parsed.villageId === 0 ? "0" : null);
          if (id) setVillageIdState(String(id));

          // Try to extract a name from common fields
          const name = parsed.villageName ?? parsed.name ?? parsed.village_name ?? parsed.title ?? null;
          if (name) setVillageNameState(String(name));
        }
      }
    } catch (e) {
      // ignore parse errors
    }

    const vn = localStorage.getItem(STORAGE_KEYS.VILLAGE_NAME);
    if (vn) setVillageNameState(vn);

    const st = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (st) setTokenState(st);

    const se = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    if (se) {
      const expiry = Number(se);
      if (!Number.isNaN(expiry)) setTokenExpiresAt(expiry);
    }

    const srf = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (srf) setRefreshTokenState(srf);
  }, []);

  // persist user -> localStorage when it changes (store full user object)
  useEffect(() => {
    if (user && user.name) {
      try {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.USER);
      } catch (e) {}
    }
  }, [user]);

  // persist villageId
  useEffect(() => {
    try {
      if (villageId) localStorage.setItem(STORAGE_KEYS.VILLAGE, villageId);
      else localStorage.removeItem(STORAGE_KEYS.VILLAGE);
    } catch (e) {}
  }, [villageId]);

  // persist full selected village object
  useEffect(() => {
    try {
      if (village && typeof village === "object") {
        // store a shallow JSON-friendly copy
        localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(village));
      } else {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
      }
    } catch (e) {}
  }, [village]);

  // persist village name
  useEffect(() => {
    try {
      if (villageName) localStorage.setItem(STORAGE_KEYS.VILLAGE_NAME, villageName);
      else localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
    } catch (e) {}
  }, [villageName]);

  // persist token + expiry + refreshToken
  useEffect(() => {
    try {
      if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      else localStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch (e) {}
  }, [token]);

  useEffect(() => {
    try {
      if (tokenExpiresAt) localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(tokenExpiresAt));
      else localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    } catch (e) {}
  }, [tokenExpiresAt]);

  useEffect(() => {
    try {
      if (refreshTokenState) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshTokenState);
      else localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (e) {}
  }, [refreshTokenState]);

  // storage listener to sync across tabs
  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return; // ignore clear()
      try {
        if (e.key === STORAGE_KEYS.USER) {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          setUserState(val && val.name ? { name: val.name, role: val.role, email: val.email } : null);
        }
      } catch {
        setUserState(null);
      }

      if (e.key === STORAGE_KEYS.VILLAGE) {
        setVillageIdState(e.newValue);
      }

      if (e.key === STORAGE_KEYS.SELECTED_VILLAGE) {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          setVillageState(val);
          if (val && (val.villageId || val.village_id || val.id)) {
            const id = val.villageId ?? val.village_id ?? val.id;
            setVillageIdState(String(id));
          }
          // keep villageName in sync
          const name = val ? (val.villageName ?? val.name ?? val.village_name ?? val.title ?? null) : null;
          setVillageNameState(name ? String(name) : null);
        } catch {
          setVillageState(null);
          setVillageNameState(null);
        }
      }

      if (e.key === STORAGE_KEYS.VILLAGE_NAME) {
        setVillageNameState(e.newValue);
      }

      if (e.key === STORAGE_KEYS.TOKEN) {
        setTokenState(e.newValue);
      }
      if (e.key === STORAGE_KEYS.TOKEN_EXPIRY) {
        const v = e.newValue ? Number(e.newValue) : null;
        setTokenExpiresAt(v && !Number.isNaN(v) ? v : null);
      }
      if (e.key === STORAGE_KEYS.REFRESH_TOKEN) {
        setRefreshTokenState(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ---- token timers management ----
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

  // tick for remaining seconds (updates every 1s) — keeps running after reload as long as tokenExpiresAt exists
  useEffect(() => {
    // clear previous tick
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    if (!tokenExpiresAt) {
      setTokenRemaining(null);
      return;
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

  // function to perform refresh (exposed; only runs when called)
  const refreshToken = useCallback(
    async () => {
      try {
        // body may include refreshToken if available; otherwise empty
        const body = refreshTokenState ? { refreshToken: refreshTokenState } : {};
        const headers = { "Content-Type": "application/json" };
        // if we have a bearer token, include it (API supports either cookie or Authorization)
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // IMPORTANT: include credentials so cookie-based refresh works
        const res = await fetch("https://villagerelocation.onrender.com/refresh", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          credentials: "include",
        });

        if (!res.ok) {
          // refresh failed -> return false so caller can logout if desired
          return false;
        }

        const payload = await res.json();
        // payload may contain: { token, expiresIn, expiresAt, refreshToken, user, selectedVillage }
        const newToken = payload.token ?? null;
        const expiresIn = payload.expiresIn; // seconds
        const expiresAt = payload.expiresAt; // timestamp or ISO
        const newRefresh = payload.refreshToken ?? null;

        // compute absolute expiry (ms)
        let absExpiry = null;
        if (expiresIn && !isNaN(Number(expiresIn))) {
          absExpiry = Date.now() + Number(expiresIn) * 1000;
        } else if (expiresAt) {
          const asNum = Number(expiresAt);
          absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
        }

        // If server set no expiry info but did set a token, choose a safe default
        if (!absExpiry && newToken) {
          absExpiry = Date.now() + 15 * 60 * 1000; // 15 min fallback
        }

        // Update states accordingly (may be null if server uses cookie-only)
        setTokenState(newToken);
        if (absExpiry) setTokenExpiresAt(absExpiry);
        if (newRefresh) setRefreshTokenState(newRefresh);

        // If server returned user info, keep it in sync
        if (payload.user && payload.user.name) {
          setUserState({ name: payload.user.name, role: payload.user.role, email: payload.user.email });
          try {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: payload.user.name, role: payload.user.role, email: payload.user.email }));
          } catch (e) {}
        }

        // If server returned selectedVillage, sync it (and extract name)
        if (payload.selectedVillage) {
          const sv = payload.selectedVillage;
          setVillageState(sv);
          const id = sv.villageId ?? sv.village_id ?? sv.id ?? null;
          if (id !== null && id !== undefined) setVillageIdState(String(id));
          const name = sv.villageName ?? sv.name ?? sv.village_name ?? sv.title ?? null;
          setVillageNameState(name ? String(name) : null);
          try {
            localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(sv));
          } catch (e) {}
        }

        return true;
      } catch (err) {
        // treat as refresh failure
        return false;
      }
    },
    [token, refreshTokenState]
  );

  // start expiry timer whenever tokenExpiresAt changes (we only schedule logout at expiry)
  useEffect(() => {
    // clear previous timers
    clearTimers();
    if (!tokenExpiresAt) {
      return;
    }

    const now = Date.now();
    const msToExpiry = tokenExpiresAt - now;
    if (msToExpiry <= 0) {
      // already expired
      // ensure logout is performed
      logout();
      return;
    }

    // schedule expiry logout only (no automatic refresh)
    expiryTimerRef.current = setTimeout(() => {
      logout();
    }, msToExpiry);

    return () => {
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenExpiresAt]);

  // safe setters (wrapped with useCallback so consumers can pass stable refs)
  const setUser = useCallback((u) => setUserState(u ? { name: u.name, role: u.role, email: u.email } : null), []);

  // setVillageId setter (string)
  const setVillageId = useCallback((id) => {
    setVillageIdState(id ?? null);
    // if id is cleared, also clear village object and name for consistency
    if (!id) {
      setVillageState(null);
      setVillageNameState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
        localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
      } catch (e) {}
    }
  }, []);

  // setVillage: accepts full village object or null. keeps villageId and villageName in sync
  const setVillage = useCallback((v) => {
    if (v && typeof v === "object") {
      setVillageState(v);
      const id = v.villageId ?? v.village_id ?? (v.id ?? null);
      if (id !== undefined && id !== null) {
        setVillageIdState(String(id));
      }
      // extract common name fields and persist
      const name = v.villageName ?? v.name ?? v.village_name ?? v.title ?? null;
      setVillageNameState(name ? String(name) : null);
      try {
        localStorage.setItem(STORAGE_KEYS.SELECTED_VILLAGE, JSON.stringify(v));
      } catch (e) {}
    } else {
      setVillageState(null);
      setVillageIdState(null);
      setVillageNameState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
        localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
      } catch (e) {}
    }
  }, []);

  // setToken accepts optional expiresIn/expiresAt/refreshToken
  const setToken = useCallback((t, options = {}) => {
    const { expiresIn, expiresAt, refreshToken: rToken } = options;
    setTokenState(t ?? null);
    if (rToken !== undefined) setRefreshTokenState(rToken ?? null);

    if (t == null) {
      setTokenExpiresAt(null);
      return;
    }

    let absExpiry = null;
    if (expiresIn && !isNaN(Number(expiresIn))) {
      absExpiry = Date.now() + Number(expiresIn) * 1000;
    } else if (expiresAt) {
      const asNum = Number(expiresAt);
      absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
    }
    // fallback default expiry: 15 minutes if server didn't provide expiry
    if (!absExpiry) absExpiry = Date.now() + 15 * 60 * 1000;
    setTokenExpiresAt(absExpiry);
  }, []);

  // login helper: accept multiple shapes returned by server
  // NOTE: we DO NOT auto-call refreshToken here; refresh only happens when user clicks the refresh action
  const login = useCallback(
    async ({ name, role, email, token: tok, expiresIn, expiresAt, refreshToken: rToken, selectedVillage }) => {
      if (name) setUserState({ name, role, email });
      if (tok) {
        setTokenState(tok);
        let absExpiry = null;
        if (expiresIn && !isNaN(Number(expiresIn))) {
          absExpiry = Date.now() + Number(expiresIn) * 1000;
        } else if (expiresAt) {
          const asNum = Number(expiresAt);
          absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
        }
        if (!absExpiry) absExpiry = Date.now() + 15 * 60 * 1000;
        setTokenExpiresAt(absExpiry);
      }
      // do not attempt automatic refresh for cookie-only logins
      if (rToken) setRefreshTokenState(rToken);

      // persist user to localStorage too (store full object)
      try {
        if (name) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name, role, email }));
      } catch (e) {}

      // if login payload included selectedVillage, sync it
      if (selectedVillage) {
        setVillage(selectedVillage);
      }
    },
    [setVillage]
  );

  // logout
  const logout = useCallback(() => {
    setUserState(null);
    setVillageIdState(null);
    setVillageState(null);
    setVillageNameState(null);
    setTokenState(null);
    setTokenExpiresAt(null);
    setRefreshTokenState(null);
    clearTimers();
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.VILLAGE);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
      localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (e) {}
  }, [clearTimers]);

  // expose a method to force-refresh token manually (e.g. from UI)
  const forceRefresh = useCallback(async () => {
    const ok = await refreshToken();
    if (!ok) logout();
    return ok;
  }, [refreshToken, logout]);

  // context value: expose refreshToken() function (manual), and forceRefresh()
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
    // expose manual refresh function (callable from UI). This is NOT the refresh token string.
    refreshToken, // function: call to attempt refresh
    login,
    logout,
    forceRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
