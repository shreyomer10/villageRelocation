import React, { createContext, useState, useEffect, useCallback } from "react";

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  villageId: null,
  setVillageId: () => {},
  token: null,
  setToken: () => {},
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null); // { name }
  const [villageId, setVillageIdState] = useState(null);
  const [token, setTokenState] = useState(null);

  // initialize from localStorage once on mount
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.name) setUserState({ name: parsed.name });
      }
    } catch (e) {
      // ignore parse errors
    }

    const storedVillage = localStorage.getItem("villageId");
    if (storedVillage) setVillageIdState(storedVillage);

    const storedToken = localStorage.getItem("token");
    if (storedToken) setTokenState(storedToken);
  }, []);

  // persist user -> localStorage when it changes
  useEffect(() => {
    if (user && user.name) {
      try {
        localStorage.setItem("user", JSON.stringify({ name: user.name }));
      } catch (e) {}
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  // persist villageId
  useEffect(() => {
    if (villageId) localStorage.setItem("villageId", villageId);
    else localStorage.removeItem("villageId");
  }, [villageId]);

  // persist token
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  // listen for changes made in other tabs/windows and keep state in sync
  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return; // ignore clear()
      if (e.key === "user") {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          setUserState(val && val.name ? { name: val.name } : null);
        } catch (err) {
          setUserState(null);
        }
      }
      if (e.key === "villageId") {
        setVillageIdState(e.newValue);
      }
      if (e.key === "token") {
        setTokenState(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // safe setters (wrapped with useCallback so consumers can pass stable refs)
  const setUser = useCallback((u) => setUserState(u ? { name: u.name } : null), []);
  const setVillageId = useCallback((id) => setVillageIdState(id ?? null), []);
  const setToken = useCallback((t) => setTokenState(t ?? null), []);

  // convenience login / logout helpers
  const login = useCallback(({ name, token: tok }) => {
    if (name) setUserState({ name });
    if (tok) setTokenState(tok);
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
    setVillageIdState(null);
    setTokenState(null);
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("villageId");
      localStorage.removeItem("token");
    } catch (e) {}
  }, []);

  const value = {
    user,
    setUser,
    villageId,
    setVillageId,
    token,
    setToken,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
