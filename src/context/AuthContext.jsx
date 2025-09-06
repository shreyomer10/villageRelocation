// AuthProvider.jsx
import React, { createContext, useState, useEffect, useCallback, useRef } from "react";

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  villageId: null,
  setVillageId: () => {},
  token: null,
  tokenExpiresAt: null, // timestamp (ms)
  tokenRemaining: null, // seconds
  refreshToken: null,
  setToken: () => {},
  login: async () => {},
  logout: () => {},
  forceRefresh: async () => {},
});

const STORAGE_KEYS = {
  USER: "user",
  VILLAGE: "villageId",
  TOKEN: "token",
  TOKEN_EXPIRY: "tokenExpiry", // number (ms)
  REFRESH_TOKEN: "refreshToken",
};

const REFRESH_BEFORE_MS = 60 * 1000; // refresh 60s before expiry (tweakable)

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null); // { name }
  const [villageId, setVillageIdState] = useState(null);
  const [token, setTokenState] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null); // number (ms)
  const [refreshTokenState, setRefreshTokenState] = useState(null);

  // derived: seconds remaining
  const [tokenRemaining, setTokenRemaining] = useState(null);

  // timer refs
  const refreshTimerRef = useRef(null);
  const expiryTimerRef = useRef(null);
  const tickIntervalRef = useRef(null);

  // initialize from localStorage once on mount
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.name) setUserState({ name: parsed.name });
      }
    } catch (e) {
      // ignore
    }

    const sv = localStorage.getItem(STORAGE_KEYS.VILLAGE);
    if (sv) setVillageIdState(sv);

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

  // persist user -> localStorage when it changes
  useEffect(() => {
    if (user && user.name) {
      try {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: user.name }));
      } catch (e) {}
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [user]);

  // persist villageId
  useEffect(() => {
    if (villageId) localStorage.setItem(STORAGE_KEYS.VILLAGE, villageId);
    else localStorage.removeItem(STORAGE_KEYS.VILLAGE);
  }, [villageId]);

  // persist token + expiry + refreshToken
  useEffect(() => {
    if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    else localStorage.removeItem(STORAGE_KEYS.TOKEN);
  }, [token]);

  useEffect(() => {
    if (tokenExpiresAt) localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(tokenExpiresAt));
    else localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  }, [tokenExpiresAt]);

  useEffect(() => {
    if (refreshTokenState) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshTokenState);
    else localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }, [refreshTokenState]);

  // storage listener to sync across tabs
  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return; // ignore clear()
      if (e.key === STORAGE_KEYS.USER) {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          setUserState(val && val.name ? { name: val.name } : null);
        } catch {
          setUserState(null);
        }
      }
      if (e.key === STORAGE_KEYS.VILLAGE) {
        setVillageIdState(e.newValue);
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
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  // tick for remaining seconds (updates every 1s)
  useEffect(() => {
    // if there's an existing interval, clear it first
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

  // function to perform refresh
  const refreshToken = useCallback(async () => {
    // Try to refresh token via API endpoint
    try {
      // if there is a refresh token, use it; otherwise send current token
      const body = refreshTokenState ? { refreshToken: refreshTokenState } : {};
      const headers = { "Content-Type": "application/json" };
      // pass existing token in Authorization header if needed
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("https://villagerelocation.onrender.com/auth/refresh", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // refresh failed
        throw new Error("Refresh failed");
      }

      const payload = await res.json();
      // Expect payload: { token, expiresIn?, expiresAt?, refreshToken? }
      const newToken = payload.token;
      const expiresIn = payload.expiresIn; // seconds
      const expiresAt = payload.expiresAt; // timestamp or ISO

      const newRefresh = payload.refreshToken ?? refreshTokenState ?? null;

      let absExpiry = null;
      if (expiresIn && !isNaN(Number(expiresIn))) {
        absExpiry = Date.now() + Number(expiresIn) * 1000;
      } else if (expiresAt) {
        const asNum = Number(expiresAt);
        absExpiry = !Number.isNaN(asNum) ? asNum : Date.parse(expiresAt);
      }
      // if server didn't send expiry, set a default short expiry (e.g., 15 minutes) to be safe
      if (!absExpiry) {
        absExpiry = Date.now() + 15 * 60 * 1000;
      }

      setTokenState(newToken ?? null);
      setTokenExpiresAt(absExpiry);
      setRefreshTokenState(newRefresh);
      return true;
    } catch (err) {
      // refresh failed -> logout
      // console.warn("Token refresh failed", err);
      // we'll leave logout to the caller if needed, but return false
      return false;
    }
  }, [token, refreshTokenState]);

  // start timers whenever tokenExpiresAt changes
  useEffect(() => {
    clearTimers();
    if (!tokenExpiresAt || !token) return;

    const now = Date.now();
    const msToExpiry = tokenExpiresAt - now;
    if (msToExpiry <= 0) {
      // expired already
      // force logout by clearing token (user will be logged out by effect below)
      setTokenState(null);
      setTokenExpiresAt(null);
      setRefreshTokenState(null);
      return;
    }

    const refreshAt = Math.max(0, msToExpiry - REFRESH_BEFORE_MS);
    // schedule refresh
    refreshTimerRef.current = setTimeout(async () => {
      const ok = await refreshToken();
      if (!ok) {
        // unsuccessful refresh -> logout
        logout();
      }
    }, refreshAt);

    // schedule expiry logout
    expiryTimerRef.current = setTimeout(() => {
      logout();
    }, msToExpiry);

    return () => {
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenExpiresAt, token, refreshToken, clearTimers]); // refreshToken is stable via useCallback

  // safe setters (wrapped with useCallback so consumers can pass stable refs)
  const setUser = useCallback((u) => setUserState(u ? { name: u.name } : null), []);
  const setVillageId = useCallback((id) => setVillageIdState(id ?? null), []);
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
  const login = useCallback(
    ({ name, token: tok, expiresIn, expiresAt, refreshToken: rToken }) => {
      if (name) setUserState({ name });
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
      if (rToken) setRefreshTokenState(rToken);

      // persist user to localStorage too (you did earlier)
      try {
        if (name) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name }));
      } catch (e) {}
    },
    []
  );

  // logout
  const logout = useCallback(() => {
    setUserState(null);
    setVillageIdState(null);
    setTokenState(null);
    setTokenExpiresAt(null);
    setRefreshTokenState(null);
    clearTimers();
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.VILLAGE);
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

  const value = {
    user,
    setUser,
    villageId,
    setVillageId,
    token,
    setToken,
    tokenExpiresAt,
    tokenRemaining,
    refreshToken: refreshTokenState,
    login,
    logout,
    forceRefresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
