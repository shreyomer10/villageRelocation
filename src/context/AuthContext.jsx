import React, { createContext, useCallback, useEffect, useRef, useState } from "react";

export const AuthContext = createContext({
  user: null,
  setUser: () => {},
  userId: null,
  setUserId: () => {},
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

  // plot
  plotId: null,
  selectedPlot: null,
  setPlotId: () => {},
  setSelectedPlot: () => {},
  selectPlot: () => {},

  // material
  materialId: null,
  selectedMaterial: null,
  setMaterialId: () => {},
  setSelectedMaterial: () => {},
  selectMaterial: () => {},

  // facility (NEW)
  facilityId: null,
  selectedFacility: null,
  setFacilityId: () => {},
  setSelectedFacility: () => {},
  selectFacility: () => {},

  // family (ADDED)
  familyId: null,
  selectedFamily: null,
  setFamilyId: () => {},
  setSelectedFamily: () => {},
  selectFamily: () => {},
});

const STORAGE_KEYS = {
  USERID: "userId",
  USER: "user",
  VILLAGE: "villageId",
  SELECTED_VILLAGE: "selectedVillage",
  VILLAGE_NAME: "villageName",
  TOKEN: "token",
  TOKEN_EXPIRY: "tokenExpiry",
  REFRESH_TOKEN: "refreshToken",
  AUTH_PAYLOAD: "auth_payload",

  // canonical keys for selected plot/material/facility
  PLOT_ID: "plotId",
  SELECTED_PLOT: "selectedPlot",

  MATERIAL_ID: "materialId",
  SELECTED_MATERIAL: "selectedMaterial",

  FACILITY_ID: "facilityId",
  SELECTED_FACILITY: "selectedFacility",

  // family canonical keys (ADDED)
  FAMILY_ID: "familyId",
  SELECTED_FAMILY: "selectedFamily",
};

// (aliases and normalizers unchanged — keep full set from your original file)
const MATERIAL_ID_ALIASES = ["materialId", "MATERIAL_ID", "MATERIAL", "MATERIALID"];
const SELECTED_MATERIAL_ALIASES = ["selectedMaterial", "SELECTED_MATERIAL", "SELECTED_MATERIALS"];
const PLOT_ID_ALIASES = ["plotId", "PLOT_ID", "PLOT", "PLOTID"];
const SELECTED_PLOT_ALIASES = ["selectedPlot", "SELECTED_PLOT", "SELECTED_PLOTS"];
const FACILITY_ID_ALIASES = ["facilityId", "FACILITY_ID", "FACILITY", "FACILITYID"];
const SELECTED_FACILITY_ALIASES = ["selectedFacility", "SELECTED_FACILITY", "SELECTED_FACILITIES"];
const FAMILY_ID_ALIASES = ["familyId", "FAMILY_ID", "FAMILY", "FAMILYID"];
const SELECTED_FAMILY_ALIASES = ["selectedFamily", "SELECTED_FAMILY", "SELECTED_FAMILIES"];

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

/* ---------- plot normalizers ---------- */
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

/* ---------- material normalizers ---------- */
function normalizeMaterialId(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : null;
  if (typeof raw === "object") {
    const id = raw.materialId ?? raw.material_id ?? raw.id ?? raw._id ?? null;
    return id !== null && id !== undefined ? String(id) : null;
  }
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw || null;
  return null;
}

function normalizeSelectedMaterial(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.length ? raw[0] : null;
  if (typeof raw === "string" || typeof raw === "number") return { materialId: String(raw) };
  if (typeof raw === "object") return raw;
  return null;
}
/* ------------------------------------------- */

/* ---------- facility normalizers (NEW) ---------- */
function normalizeFacilityId(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : null;
  if (typeof raw === "object") {
    const id = raw.facilityId ?? raw.facility_id ?? raw.id ?? raw._id ?? null;
    return id !== null && id !== undefined ? String(id) : null;
  }
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw || null;
  return null;
}

function normalizeSelectedFacility(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.length ? raw[0] : null;
  if (typeof raw === "string" || typeof raw === "number") return { facilityId: String(raw) };
  if (typeof raw === "object") return raw;
  return null;
}
/* ------------------------------------------- */

/* ---------- family normalizers (ADDED) ---------- */
function normalizeFamilyId(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : null;
  if (typeof raw === "object") {
    const id = raw.familyId ?? raw.family_id ?? raw.id ?? raw._id ?? null;
    return id !== null && id !== undefined ? String(id) : null;
  }
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw || null;
  return null;
}

function normalizeSelectedFamily(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.length ? raw[0] : null;
  if (typeof raw === "string" || typeof raw === "number") return { familyId: String(raw) };
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
  const [userId, setUserIdState] = useState(null); // NEW: store canonical userId
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

  // NEW: selected material state
  const [materialId, setMaterialIdState] = useState(null);
  const [selectedMaterial, setSelectedMaterialState] = useState(null);

  // NEW: selected facility state
  const [facilityId, setFacilityIdState] = useState(null);
  const [selectedFacility, setSelectedFacilityState] = useState(null);

  // NEW: selected family state (ADDED)
  const [familyId, setFamilyIdState] = useState(null);
  const [selectedFamily, setSelectedFamilyState] = useState(null);

  const expiryTimerRef = useRef(null);
  const tickIntervalRef = useRef(null);

  // Initialize from localStorage (robust: use aliases for material/plot/facility/family)
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.name) setUserState({ name: parsed.name, role: parsed.role, email: parsed.email });
      }
    } catch {}

    const savedUserId = localStorage.getItem(STORAGE_KEYS.USERID);
    if (savedUserId) setUserIdState(savedUserId);

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

        // set user and userId if present
        if (parsed?.user) {
          try {
            const u = parsed.user;
            setUserState({ name: u.name ?? u.fullName ?? u.name ?? null, role: u.role ?? null, email: u.email ?? null });
            try {
              localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ name: u.name ?? u.fullName ?? null, role: u.role ?? null, email: u.email ?? null }));
            } catch {}
            // try extract user id from user object
            const uid = u.id ?? u.userId ?? u.user_id ?? u._id ?? null;
            if (uid) {
              setUserIdState(String(uid));
              try {
                localStorage.setItem(STORAGE_KEYS.USERID, String(uid));
              } catch {}
            }
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
        } else if (parsed?.userId || parsed?.user_id) {
          const uid = parsed.userId ?? parsed.user_id;
          if (uid) {
            setUserIdState(String(uid));
            try {
              localStorage.setItem(STORAGE_KEYS.USERID, String(uid));
            } catch {}
          }
        }

        // restore selectedPlot/plotId from auth payload if present
        if (parsed?.selectedPlot) {
          const sp = normalizeSelectedPlot(parsed.selectedPlot);
          if (sp) {
            setSelectedPlotState(sp);
            const pid = normalizePlotId(sp.plotId ?? sp.id ?? sp._id);
            if (pid) setPlotIdState(String(pid));
          }
        }

        // restore selectedMaterial if present in auth payload
        if (parsed?.selectedMaterial) {
          const sm = normalizeSelectedMaterial(parsed.selectedMaterial);
          if (sm) {
            setSelectedMaterialState(sm);
            const mid = normalizeMaterialId(sm.materialId ?? sm.id ?? sm._id);
            if (mid) setMaterialIdState(String(mid));
          }
        }

        // restore selectedFacility if present in auth payload (NEW)
        if (parsed?.selectedFacility) {
          const sf = normalizeSelectedFacility(parsed.selectedFacility);
          if (sf) {
            setSelectedFacilityState(sf);
            const fid = normalizeFacilityId(sf.facilityId ?? sf.id ?? sf._id);
            if (fid) setFacilityIdState(String(fid));
          }
        }

        // restore selectedFamily if present in auth payload (ADDED)
        if (parsed?.selectedFamily) {
          const sfam = normalizeSelectedFamily(parsed.selectedFamily);
          if (sfam) {
            setSelectedFamilyState(sfam);
            const famId = normalizeFamilyId(sfam.familyId ?? sfam.id ?? sfam._id);
            if (famId) setFamilyIdState(String(famId));
          }
        }
      }
    } catch {}

    // read plot keys directly from localStorage (aliases)
    try {
      let foundPlotId = null;
      for (const k of PLOT_ID_ALIASES) {
        const v = localStorage.getItem(k);
        if (v) {
          foundPlotId = v;
          break;
        }
      }
      if (foundPlotId) setPlotIdState(normalizePlotId(foundPlotId));
    } catch {}
    try {
      let rawSelPlot = null;
      for (const k of SELECTED_PLOT_ALIASES) {
        const v = localStorage.getItem(k);
        if (v) {
          rawSelPlot = v;
          break;
        }
      }
      if (rawSelPlot) {
        const parsed = (() => {
          try {
            return JSON.parse(rawSelPlot);
          } catch {
            return rawSelPlot; // primitive id string
          }
        })();
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) {
          const sp = normalizeSelectedPlot(normalized);
          setSelectedPlotState(sp);
          const pid = normalizePlotId(sp);
          if (pid) setPlotIdState(String(pid));
        }
      }
    } catch {}

    // read material keys from localStorage (aliases)
    try {
      let foundMatId = null;
      for (const k of MATERIAL_ID_ALIASES) {
        const v = localStorage.getItem(k);
        if (v) {
          foundMatId = v;
          break;
        }
      }
      if (foundMatId) setMaterialIdState(normalizeMaterialId(foundMatId));
    } catch {}
    try {
      let rawSelMat = null;
      for (const k of SELECTED_MATERIAL_ALIASES) {
        const v = localStorage.getItem(k);
        if (v) {
          rawSelMat = v;
          break;
        }
      }
      if (rawSelMat) {
        const parsed = (() => {
          try {
            return JSON.parse(rawSelMat);
          } catch {
            return rawSelMat; // primitive id string
          }
        })();
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) {
          const sm = normalizeSelectedMaterial(normalized);
          setSelectedMaterialState(sm);
          const mid = normalizeMaterialId(sm);
          if (mid) setMaterialIdState(String(mid));
        } else if (typeof parsed === "string") {
          // stored as primitive id string
          const sm = normalizeSelectedMaterial(parsed);
          setSelectedMaterialState(sm);
          const mid = normalizeMaterialId(parsed);
          if (mid) setMaterialIdState(String(mid));
        }
      }
    } catch {}

    // read facility keys from localStorage (aliases) (NEW)
    try {
      let foundFacId = null;
      for (const k of FACILITY_ID_ALIASES) {
        const v = localStorage.getItem(k);
        if (v) {
          foundFacId = v;
          break;
        }
      }
      if (foundFacId) setFacilityIdState(normalizeFacilityId(foundFacId));
    } catch {}
    try {
      let rawSelFac = null;
      for (const k of SELECTED_FACILITY_ALIASES) {
        const v = localStorage.getItem(k);
        if (v) {
          rawSelFac = v;
          break;
        }
      }
      if (rawSelFac) {
        const parsed = (() => {
          try {
            return JSON.parse(rawSelFac);
          } catch {
            return rawSelFac; // primitive id string
          }
        })();
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) {
          const sf = normalizeSelectedFacility(normalized);
          setSelectedFacilityState(sf);
          const fid = normalizeFacilityId(sf);
          if (fid) setFacilityIdState(String(fid));
        } else if (typeof parsed === "string") {
          const sf = normalizeSelectedFacility(parsed);
          setSelectedFacilityState(sf);
          const fid = normalizeFacilityId(parsed);
          if (fid) setFacilityIdState(String(fid));
        }
      }
    } catch {}

    // read family keys from localStorage (aliases) (ADDED)
    try {
      let foundFamilyId = null;
      for (const k of FAMILY_ID_ALIASES) {
        const v = localStorage.getItem(k);
        if (v) {
          foundFamilyId = v;
          break;
        }
      }
      if (foundFamilyId) setFamilyIdState(normalizeFamilyId(foundFamilyId));
    } catch {}
    try {
      let rawSelFamily = null;
      for (const k of SELECTED_FAMILY_ALIASES) {
        const v = localStorage.getItem(k);
        if (v) {
          rawSelFamily = v;
          break;
        }
      }
      if (rawSelFamily) {
        const parsed = (() => {
          try {
            return JSON.parse(rawSelFamily);
          } catch {
            return rawSelFamily; // primitive id string
          }
        })();
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) {
          const sfam = normalizeSelectedFamily(normalized);
          setSelectedFamilyState(sfam);
          const fid = normalizeFamilyId(sfam.familyId ?? sfam.id ?? sfam._id);
          if (fid) setFamilyIdState(String(fid));
        } else if (typeof parsed === "string") {
          const sfam = normalizeSelectedFamily(parsed);
          setSelectedFamilyState(sfam);
          const fid = normalizeFamilyId(parsed);
          if (fid) setFamilyIdState(String(fid));
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

  // persist userId
  useEffect(() => {
    try {
      if (userId) localStorage.setItem(STORAGE_KEYS.USERID, String(userId));
      else localStorage.removeItem(STORAGE_KEYS.USERID);
    } catch {}
  }, [userId]);

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

  // persist plot state (canonical keys)
  useEffect(() => {
    try {
      if (plotId) localStorage.setItem(STORAGE_KEYS.PLOT_ID, String(plotId));
      else localStorage.removeItem(STORAGE_KEYS.PLOT_ID);
    } catch {}
    // also write aliases for backwards compat (optional)
    try {
      for (const k of PLOT_ID_ALIASES) {
        if (plotId) localStorage.setItem(k, String(plotId));
        else localStorage.removeItem(k);
      }
    } catch {}
  }, [plotId]);

  useEffect(() => {
    try {
      if (selectedPlot && typeof selectedPlot === "object") localStorage.setItem(STORAGE_KEYS.SELECTED_PLOT, JSON.stringify(selectedPlot));
      else if (selectedPlot && (typeof selectedPlot === "string" || typeof selectedPlot === "number")) {
        const preview = normalizeSelectedPlot(selectedPlot);
        if (preview) localStorage.setItem(STORAGE_KEYS.SELECTED_PLOT, JSON.stringify(preview));
      } else localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
    } catch {}
    // write aliases
    try {
      for (const k of SELECTED_PLOT_ALIASES) {
        if (selectedPlot && typeof selectedPlot === "object") localStorage.setItem(k, JSON.stringify(selectedPlot));
        else if (selectedPlot && (typeof selectedPlot === "string" || typeof selectedPlot === "number")) {
          const preview = normalizeSelectedPlot(selectedPlot);
          if (preview) localStorage.setItem(k, JSON.stringify(preview));
        } else localStorage.removeItem(k);
      }
    } catch {}
  }, [selectedPlot]);

  // persist material state (canonical + aliases)
  useEffect(() => {
    try {
      if (materialId) localStorage.setItem(STORAGE_KEYS.MATERIAL_ID, String(materialId));
      else localStorage.removeItem(STORAGE_KEYS.MATERIAL_ID);
    } catch {}
    try {
      for (const k of MATERIAL_ID_ALIASES) {
        if (materialId) localStorage.setItem(k, String(materialId));
        else localStorage.removeItem(k);
      }
    } catch {}
  }, [materialId]);

  useEffect(() => {
    try {
      if (selectedMaterial && typeof selectedMaterial === "object")
        localStorage.setItem(STORAGE_KEYS.SELECTED_MATERIAL, JSON.stringify(selectedMaterial));
      else if (selectedMaterial && (typeof selectedMaterial === "string" || typeof selectedMaterial === "number")) {
        const preview = normalizeSelectedMaterial(selectedMaterial);
        if (preview) localStorage.setItem(STORAGE_KEYS.SELECTED_MATERIAL, JSON.stringify(preview));
      } else localStorage.removeItem(STORAGE_KEYS.SELECTED_MATERIAL);
    } catch {}

    try {
      for (const k of SELECTED_MATERIAL_ALIASES) {
        if (selectedMaterial && typeof selectedMaterial === "object")
          localStorage.setItem(k, JSON.stringify(selectedMaterial));
        else if (selectedMaterial && (typeof selectedMaterial === "string" || typeof selectedMaterial === "number")) {
          const preview = normalizeSelectedMaterial(selectedMaterial);
          if (preview) localStorage.setItem(k, JSON.stringify(preview));
        } else localStorage.removeItem(k);
      }
    } catch {}
  }, [selectedMaterial]);

  // persist facility state (canonical + aliases) (NEW)
  useEffect(() => {
    try {
      if (facilityId) localStorage.setItem(STORAGE_KEYS.FACILITY_ID, String(facilityId));
      else localStorage.removeItem(STORAGE_KEYS.FACILITY_ID);
    } catch {}
    try {
      for (const k of FACILITY_ID_ALIASES) {
        if (facilityId) localStorage.setItem(k, String(facilityId));
        else localStorage.removeItem(k);
      }
    } catch {}
  }, [facilityId]);

  useEffect(() => {
    try {
      if (selectedFacility && typeof selectedFacility === "object") localStorage.setItem(STORAGE_KEYS.SELECTED_FACILITY, JSON.stringify(selectedFacility));
      else if (selectedFacility && (typeof selectedFacility === "string" || typeof selectedFacility === "number")) {
        const preview = normalizeSelectedFacility(selectedFacility);
        if (preview) localStorage.setItem(STORAGE_KEYS.SELECTED_FACILITY, JSON.stringify(preview));
      } else localStorage.removeItem(STORAGE_KEYS.SELECTED_FACILITY);
    } catch {}

    try {
      for (const k of SELECTED_FACILITY_ALIASES) {
        if (selectedFacility && typeof selectedFacility === "object") localStorage.setItem(k, JSON.stringify(selectedFacility));
        else if (selectedFacility && (typeof selectedFacility === "string" || typeof selectedFacility === "number")) {
          const preview = normalizeSelectedFacility(selectedFacility);
          if (preview) localStorage.setItem(k, JSON.stringify(preview));
        } else localStorage.removeItem(k);
      }
    } catch {}
  }, [selectedFacility]);

  // persist family state (canonical + aliases) (ADDED)
  useEffect(() => {
    try {
      if (familyId) localStorage.setItem(STORAGE_KEYS.FAMILY_ID, String(familyId));
      else localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
    } catch {}
    try {
      for (const k of FAMILY_ID_ALIASES) {
        if (familyId) localStorage.setItem(k, String(familyId));
        else localStorage.removeItem(k);
      }
    } catch {}
  }, [familyId]);

  useEffect(() => {
    try {
      if (selectedFamily && typeof selectedFamily === "object") localStorage.setItem(STORAGE_KEYS.SELECTED_FAMILY, JSON.stringify(selectedFamily));
      else if (selectedFamily && (typeof selectedFamily === "string" || typeof selectedFamily === "number")) {
        const preview = normalizeSelectedFamily(selectedFamily);
        if (preview) localStorage.setItem(STORAGE_KEYS.SELECTED_FAMILY, JSON.stringify(preview));
      } else localStorage.removeItem(STORAGE_KEYS.SELECTED_FAMILY);
    } catch {}

    try {
      for (const k of SELECTED_FAMILY_ALIASES) {
        if (selectedFamily && typeof selectedFamily === "object") localStorage.setItem(k, JSON.stringify(selectedFamily));
        else if (selectedFamily && (typeof selectedFamily === "string" || typeof selectedFamily === "number")) {
          const preview = normalizeSelectedFamily(selectedFamily);
          if (preview) localStorage.setItem(k, JSON.stringify(preview));
        } else localStorage.removeItem(k);
      }
    } catch {}
  }, [selectedFamily]);

  // persist full raw payload (include selectedVillage + selectedPlot + selectedMaterial + selectedFacility + selectedFamily + userId)
  useEffect(() => {
    try {
      const raw = {
        token: token ?? undefined,
        expiresAt: tokenExpiresAt ?? undefined,
        refreshToken: refreshTokenString ?? undefined,
        user: user ?? undefined,
        userId: userId ?? undefined,
        selectedVillage: village ?? undefined,
        selectedPlot: selectedPlot ?? undefined,
        selectedMaterial: selectedMaterial ?? undefined,
        selectedFacility: selectedFacility ?? undefined,
        selectedFamily: selectedFamily ?? undefined,
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
  }, [token, tokenExpiresAt, refreshTokenString, user, userId, village, selectedPlot, selectedMaterial, selectedFacility, selectedFamily]);

  // storage sync across tabs (robust with aliases)
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
      if (e.key === STORAGE_KEYS.USERID) setUserIdState(e.newValue);
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

      // plot aliases
      if (PLOT_ID_ALIASES.includes(e.key)) {
        setPlotIdState(normalizePlotId(e.newValue));
      }
      if (SELECTED_PLOT_ALIASES.includes(e.key)) {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          const normalized = Array.isArray(val) ? val[0] ?? null : val;
          const sp = normalizeSelectedPlot(normalized ?? val ?? null);
          setSelectedPlotState(sp);
          if (sp && (sp.plotId || sp.id || sp._id)) {
            const id = sp.plotId ?? sp.id ?? sp._id;
            setPlotIdState(String(id));
          }
        } catch {
          setSelectedPlotState(null);
        }
      }

      // material aliases
      if (MATERIAL_ID_ALIASES.includes(e.key)) {
        setMaterialIdState(normalizeMaterialId(e.newValue));
      }
      if (SELECTED_MATERIAL_ALIASES.includes(e.key)) {
        try {
          const val = e.newValue ? (() => {
            try { return JSON.parse(e.newValue); } catch { return e.newValue; }
          })() : null;
          const normalized = Array.isArray(val) ? val[0] ?? null : val;
          const sm = normalizeSelectedMaterial(normalized ?? val ?? null);
          setSelectedMaterialState(sm);
          const mid = normalizeMaterialId(sm ?? val);
          if (mid) setMaterialIdState(String(mid));
        } catch {
          setSelectedMaterialState(null);
        }
      }

      // facility aliases (NEW)
      if (FACILITY_ID_ALIASES.includes(e.key)) {
        setFacilityIdState(normalizeFacilityId(e.newValue));
      }
      if (SELECTED_FACILITY_ALIASES.includes(e.key)) {
        try {
          const val = e.newValue ? (() => { try { return JSON.parse(e.newValue); } catch { return e.newValue; } })() : null;
          const normalized = Array.isArray(val) ? val[0] ?? null : val;
          const sf = normalizeSelectedFacility(normalized ?? val ?? null);
          setSelectedFacilityState(sf);
          const fid = normalizeFacilityId(sf ?? val);
          if (fid) setFacilityIdState(String(fid));
        } catch {
          setSelectedFacilityState(null);
        }
      }

      // family aliases (ADDED)
      if (FAMILY_ID_ALIASES.includes(e.key)) {
        setFamilyIdState(normalizeFamilyId(e.newValue));
      }
      if (SELECTED_FAMILY_ALIASES.includes(e.key)) {
        try {
          const val = e.newValue ? (() => { try { return JSON.parse(e.newValue); } catch { return e.newValue; } })() : null;
          const normalized = Array.isArray(val) ? val[0] ?? null : val;
          const sfam = normalizeSelectedFamily(normalized ?? val ?? null);
          setSelectedFamilyState(sfam);
          const fid = normalizeFamilyId(sfam ?? val);
          if (fid) setFamilyIdState(String(fid));
        } catch {
          setSelectedFamilyState(null);
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
            if (parsed.userId) setUserIdState(parsed.userId);
            if (parsed.selectedVillage) setVillageState(parsed.selectedVillage);

            // selectedPlot in auth payload
            if (parsed.selectedPlot) {
              const sp = normalizeSelectedPlot(parsed.selectedPlot);
              setSelectedPlotState(sp);
              if (sp && (sp.plotId || sp.id || sp._id)) {
                const id = sp.plotId ?? sp.id ?? sp._id;
                setPlotIdState(String(id));
              }
            }

            // selectedMaterial in auth payload
            if (parsed.selectedMaterial) {
              const sm = normalizeSelectedMaterial(parsed.selectedMaterial);
              setSelectedMaterialState(sm);
              const mid = normalizeMaterialId(sm ?? parsed.selectedMaterial);
              if (mid) setMaterialIdState(String(mid));
            }

            // selectedFacility in auth payload
            if (parsed.selectedFacility) {
              const sf = normalizeSelectedFacility(parsed.selectedFacility);
              setSelectedFacilityState(sf);
              const fid = normalizeFacilityId(sf ?? parsed.selectedFacility);
              if (fid) setFacilityIdState(String(fid));
            }

            // selectedFamily in auth payload (ADDED)
            if (parsed.selectedFamily) {
              const sfam = normalizeSelectedFamily(parsed.selectedFamily);
              setSelectedFamilyState(sfam);
              const fid = normalizeFamilyId(sfam ?? parsed.selectedFamily);
              if (fid) setFamilyIdState(String(fid));
            }
          } else {
            setTokenState(null);
            setTokenExpiresAt(null);
            setRefreshTokenString(null);
            setUserState(null);
            setUserIdState(null);
            setVillageState(null);
            setVillageIdState(null);
            setVillageNameState(null);
            setSelectedPlotState(null);
            setPlotIdState(null);
            setSelectedMaterialState(null);
            setMaterialIdState(null);
            setSelectedFacilityState(null);
            setFacilityIdState(null);
            setSelectedFamilyState(null);
            setFamilyIdState(null);
          }
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // tick for tokenRemaining
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
      try {
        logout(); // logout defined later, still works
      } catch {
        setUserState(null);
        setUserIdState(null);
        setVillageIdState(null);
        setVillageState(null);
        setVillageNameState(null);
        setRefreshTokenString(null);
        setSelectedPlotState(null);
        setPlotIdState(null);
        setSelectedMaterialState(null);
        setMaterialIdState(null);
        setSelectedFacilityState(null);
        setFacilityIdState(null);
        setSelectedFamilyState(null);
        setFamilyIdState(null);
        try {
          localStorage.removeItem(STORAGE_KEYS.USER);
          localStorage.removeItem(STORAGE_KEYS.USERID);
          localStorage.removeItem(STORAGE_KEYS.VILLAGE);
          localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
          localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
          localStorage.removeItem(STORAGE_KEYS.TOKEN);
          localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.AUTH_PAYLOAD);
          localStorage.removeItem(STORAGE_KEYS.PLOT_ID);
          localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
          localStorage.removeItem(STORAGE_KEYS.MATERIAL_ID);
          localStorage.removeItem(STORAGE_KEYS.SELECTED_MATERIAL);
          localStorage.removeItem(STORAGE_KEYS.FACILITY_ID);
          localStorage.removeItem(STORAGE_KEYS.SELECTED_FACILITY);
          localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
          localStorage.removeItem(STORAGE_KEYS.SELECTED_FAMILY);
        } catch {}
      }
      return undefined;
    }
    expiryTimerRef.current = setTimeout(() => {
      try {
        logout();
      } catch {
        setTokenState(null);
        setTokenExpiresAt(null);
      }
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

          if (!absExpiry) {
            if (tokenExpiresAt) {
              expirySource = "preserve";
              absExpiry = null;
            } else if (newToken) {
              absExpiry = Date.now() + 2 * 3600 * 1000;
              expirySource = "fallback";
            } else {
              expirySource = "none";
            }
          }

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

          // set userId if present in payload.user or in parsed token
          if (payload.user && (payload.user.id || payload.user.userId || payload.user._id)) {
            const uid = payload.user.id ?? payload.user.userId ?? payload.user._id;
            setUserIdState(String(uid));
            try {
              localStorage.setItem(STORAGE_KEYS.USERID, String(uid));
            } catch {}
          } else if (newToken) {
            const parsed = parseJwt(newToken);
            const maybeUid = parsed?.sub ?? parsed?.userId ?? parsed?.user_id ?? parsed?.id ?? null;
            if (maybeUid) {
              setUserIdState(String(maybeUid));
              try {
                localStorage.setItem(STORAGE_KEYS.USERID, String(maybeUid));
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

          // selectedPlot returned by refresh endpoint
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

          // selectedMaterial returned by refresh endpoint
          if (payload.selectedMaterial) {
            const sm = normalizeSelectedMaterial(payload.selectedMaterial);
            if (sm) {
              setSelectedMaterialState(sm);
              const mid = normalizeMaterialId(sm.materialId ?? sm.id ?? sm._id);
              if (mid) setMaterialIdState(mid);
              try {
                localStorage.setItem(STORAGE_KEYS.SELECTED_MATERIAL, JSON.stringify(sm));
              } catch {}
            }
          }

          // selectedFacility returned by refresh endpoint (NEW)
          if (payload.selectedFacility) {
            const sf = normalizeSelectedFacility(payload.selectedFacility);
            if (sf) {
              setSelectedFacilityState(sf);
              const fid = normalizeFacilityId(sf.facilityId ?? sf.id ?? sf._id);
              if (fid) setFacilityIdState(fid);
              try {
                localStorage.setItem(STORAGE_KEYS.SELECTED_FACILITY, JSON.stringify(sf));
              } catch {}
            }
          }

          // selectedFamily returned by refresh endpoint (ADDED)
          if (payload.selectedFamily) {
            const sfam = normalizeSelectedFamily(payload.selectedFamily);
            if (sfam) {
              setSelectedFamilyState(sfam);
              const fid = normalizeFamilyId(sfam.familyId ?? sfam.id ?? sfam._id);
              if (fid) setFamilyIdState(fid);
              try {
                localStorage.setItem(STORAGE_KEYS.SELECTED_FAMILY, JSON.stringify(sfam));
              } catch {}
            }
          }

          const remaining = absExpiry ? Math.max(0, Math.ceil((absExpiry - Date.now()) / 1000)) : null;
          if (typeof remaining === "number") setTokenRemaining(remaining);

          return { ok: true, payload, absExpiry: absExpiry ?? null, remaining: remaining ?? null, expirySource };
        };

        if (first.ok) {
          const payload = first.json ?? {};
          return handlePayload(payload);
        }

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
          const second = await attempt({});
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
    [refreshTokenString, tokenExpiresAt]
  );

  const forceRefresh = useCallback(() => {
    return doRefresh({ allowCookieFallback: true });
  }, [doRefresh]);

  const setUser = useCallback((u) => setUserState(u ? { name: u.name, role: u.role, email: u.email } : null), []);

  const setUserId = useCallback((id) => {
    const normalized = id == null ? null : String(id);
    setUserIdState(normalized);
    try {
      if (normalized) localStorage.setItem(STORAGE_KEYS.USERID, normalized);
      else localStorage.removeItem(STORAGE_KEYS.USERID);
    } catch {}
  }, []);

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

  const setToken = useCallback((t, options = {}) => {
    const { expiresIn, expiresAt, refreshToken: rToken } = options;
    setTokenState(t ?? null);
    if (rToken !== undefined) {
      const normalized = normalizeRefreshToken(rToken);
      setRefreshTokenString(normalized ?? null);
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

    if (!absExpiry && (t || expiresIn || expiresAt)) absExpiry = Date.now() + 2 * 3600 * 1000;

    if (!t && !expiresIn && !expiresAt) {
      setTokenExpiresAt(null);
      return;
    }

    setTokenExpiresAt(absExpiry);
  }, []);

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

        // set userId if available in payload.user or top-level
        const uidFromUser = userObj ? (userObj.id ?? userObj.userId ?? userObj.user_id ?? userObj._id ?? null) : null;
        const uidTop = p.userId ?? p.user_id ?? p.id ?? p._id ?? null;
        let finalUserId = uidFromUser ?? uidTop ?? null;

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
            // attempt to get user id from token if not found already
            if (!finalUserId && parsed) {
              finalUserId = parsed.sub ?? parsed.userId ?? parsed.user_id ?? parsed.id ?? finalUserId;
            }
          }
          if (!absExpiry) absExpiry = Date.now() + 2 * 3600 * 1000;
          setTokenExpiresAt(absExpiry);

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

        const rawRefresh = p.refreshToken ?? p.refresh_token ?? null;
        if (rawRefresh) {
          const normalized = normalizeRefreshToken(rawRefresh);
          setRefreshTokenString(normalized);
        }

        const rawSv = p.selectedVillage ?? p.selected_village ?? p.selected ?? null;
        const normalizedSv = normalizeSelectedVillage(rawSv);
        if (normalizedSv) {
          setVillage(normalizedSv);
        }

        // selected plot
        const rawSp = p.selectedPlot ?? p.selected_plot ?? p.selected ?? null;
        const normalizedSp = normalizeSelectedPlot(rawSp);
        if (normalizedSp) {
          setSelectedPlotState(normalizedSp);
          const pid = normalizePlotId(normalizedSp.plotId ?? normalizedSp.id ?? normalizedSp._id);
          if (pid) setPlotIdState(String(pid));
        }

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
              const preview = { plotId: normalizedPid };
              setSelectedPlotState(preview);
            } catch {}
          }
        }

        // selected material from payload (if any)
        const rawSm = p.selectedMaterial ?? p.selected_material ?? null;
        const normalizedSm = normalizeSelectedMaterial(rawSm);
        if (normalizedSm) {
          setSelectedMaterialState(normalizedSm);
          const mid = normalizeMaterialId(normalizedSm.materialId ?? normalizedSm.id ?? normalizedSm._id);
          if (mid) setMaterialIdState(String(mid));
        }

        // fallback materialId if provided directly
        if (!normalizedSm && (p.materialId || p.material_id || p._id || p.id)) {
          const midRaw = p.materialId ?? p.material_id ?? p._id ?? p.id;
          const normalizedMid = normalizeMaterialId(midRaw);
          if (normalizedMid) {
            setMaterialIdState(normalizedMid);
            try {
              const preview = { materialId: normalizedMid };
              setSelectedMaterialState(preview);
            } catch {}
          }
        }

        // selected facility from payload (NEW)
        const rawSf = p.selectedFacility ?? p.selected_facility ?? null;
        const normalizedSf = normalizeSelectedFacility(rawSf);
        if (normalizedSf) {
          setSelectedFacilityState(normalizedSf);
          const fid = normalizeFacilityId(normalizedSf.facilityId ?? normalizedSf.id ?? normalizedSf._id);
          if (fid) setFacilityIdState(String(fid));
        }

        // fallback facilityId if provided directly
        if (!normalizedSf && (p.facilityId || p.facility_id || p._id || p.id)) {
          const fidRaw = p.facilityId ?? p.facility_id ?? p._id ?? p.id;
          const normalizedFid = normalizeFacilityId(fidRaw);
          if (normalizedFid) {
            setFacilityIdState(normalizedFid);
            try {
              const preview = { facilityId: normalizedFid };
              setSelectedFacilityState(preview);
            } catch {}
          }
        }

        // selected family from payload (ADDED)
        const rawFam = p.selectedFamily ?? p.selected_family ?? null;
        const normalizedFam = normalizeSelectedFamily(rawFam);
        if (normalizedFam) {
          setSelectedFamilyState(normalizedFam);
          const fid = normalizeFamilyId(normalizedFam.familyId ?? normalizedFam.id ?? normalizedFam._id);
          if (fid) setFamilyIdState(String(fid));
        }

        // fallback familyId if provided directly
        if (!normalizedFam && (p.familyId || p.family_id || p._id || p.id)) {
          const famRaw = p.familyId ?? p.family_id ?? p._id ?? p.id;
          const normalizedFid = normalizeFamilyId(famRaw);
          if (normalizedFid) {
            setFamilyIdState(normalizedFid);
            try {
              const preview = { familyId: normalizedFid };
              setSelectedFamilyState(preview);
            } catch {}
          }
        }

        // if an explicit userId was present earlier, set it now
        if (finalUserId) {
          setUserIdState(String(finalUserId));
          try {
            localStorage.setItem(STORAGE_KEYS.USERID, String(finalUserId));
          } catch {}
        }

        try {
          localStorage.setItem(STORAGE_KEYS.AUTH_PAYLOAD, JSON.stringify(p));
        } catch {}

        const serverProvidedExpiry = (p.expiresIn ?? p.expires_in) || (p.expiresAt ?? p.expires_at) || null;
        if (!tok && userObj && !serverProvidedExpiry && !tokenExpiresAt) {
          setTokenExpiresAt(Date.now() + 2 * 3600 * 1000);
        }

        return true;
      } catch (err) {
        return false;
      }
    },
    [setVillage, tokenExpiresAt]
  );

  const logout = useCallback(() => {
    setUserState(null);
    setUserIdState(null);
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

    // clear material keys
    setSelectedMaterialState(null);
    setMaterialIdState(null);

    // clear facility keys
    setSelectedFacilityState(null);
    setFacilityIdState(null);

    // clear family keys (ADDED)
    setSelectedFamilyState(null);
    setFamilyIdState(null);

    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.USERID);
      localStorage.removeItem(STORAGE_KEYS.VILLAGE);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_VILLAGE);
      localStorage.removeItem(STORAGE_KEYS.VILLAGE_NAME);
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.AUTH_PAYLOAD);
      localStorage.removeItem(STORAGE_KEYS.PLOT_ID);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_PLOT);
      localStorage.removeItem(STORAGE_KEYS.MATERIAL_ID);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_MATERIAL);
      localStorage.removeItem(STORAGE_KEYS.FACILITY_ID);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_FACILITY);
      localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_FAMILY);
      // remove aliases too for best effort
      for (const k of [...PLOT_ID_ALIASES, ...SELECTED_PLOT_ALIASES, ...MATERIAL_ID_ALIASES, ...SELECTED_MATERIAL_ALIASES, ...FACILITY_ID_ALIASES, ...SELECTED_FACILITY_ALIASES, ...FAMILY_ID_ALIASES, ...SELECTED_FAMILY_ALIASES]) {
        try { localStorage.removeItem(k); } catch {}
      }
    } catch {}
  }, [clearTimers]);

  const isAuthenticated = !!(user && token);

  // public setters for plot
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

  // public setters for material (robust)
  const setMaterialId = useCallback((m) => {
    const normalized = normalizeMaterialId(m);
    setMaterialIdState(normalized ?? null);
    if (!normalized) {
      setSelectedMaterialState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_MATERIAL);
      } catch {}
    }
  }, []);

  const setSelectedMaterial = useCallback((sm) => {
    if (sm && typeof sm === "object") {
      const normalized = Array.isArray(sm) ? sm[0] ?? null : sm;
      if (!normalized) {
        setSelectedMaterialState(null);
        setMaterialIdState(null);
        try {
          localStorage.removeItem(STORAGE_KEYS.SELECTED_MATERIAL);
          localStorage.removeItem(STORAGE_KEYS.MATERIAL_ID);
        } catch {}
        return;
      }
      setSelectedMaterialState(normalized);
      const id = normalizeMaterialId(normalized);
      if (id !== undefined && id !== null) setMaterialIdState(String(id));
      try {
        localStorage.setItem(STORAGE_KEYS.SELECTED_MATERIAL, JSON.stringify(normalized));
      } catch {}
    } else if (sm == null) {
      setSelectedMaterialState(null);
      setMaterialIdState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_MATERIAL);
        localStorage.removeItem(STORAGE_KEYS.MATERIAL_ID);
      } catch {}
    } else {
      const normalizedId = normalizeMaterialId(sm);
      if (normalizedId) {
        setMaterialIdState(normalizedId);
        const preview = { materialId: normalizedId };
        setSelectedMaterialState(preview);
        try {
          localStorage.setItem(STORAGE_KEYS.SELECTED_MATERIAL, JSON.stringify(preview));
        } catch {}
      } else {
        setSelectedMaterialState(null);
        setMaterialIdState(null);
      }
    }
  }, []);

  const selectMaterial = useCallback((material) => {
    try {
      const mid = material.materialId ?? material.id ?? material._id ?? "";
      localStorage.setItem(STORAGE_KEYS.MATERIAL_ID, String(mid));
      const preview = {
        materialId: mid,
        name: material.name ?? null,
      };
      localStorage.setItem(STORAGE_KEYS.SELECTED_MATERIAL, JSON.stringify(preview));
      setSelectedMaterialState(preview);
      setMaterialIdState(String(mid));
    } catch (e) {
      console.warn("Failed to save selected material to localStorage", e);
    }
  }, []);

  // public setters for facility (NEW)
  const setFacilityId = useCallback((f) => {
    const normalized = normalizeFacilityId(f);
    setFacilityIdState(normalized ?? null);
    if (!normalized) {
      setSelectedFacilityState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_FACILITY);
      } catch {}
    }
  }, []);

  const setSelectedFacility = useCallback((sf) => {
    if (sf && typeof sf === "object") {
      const normalized = Array.isArray(sf) ? sf[0] ?? null : sf;
      if (!normalized) {
        setSelectedFacilityState(null);
        setFacilityIdState(null);
        try {
          localStorage.removeItem(STORAGE_KEYS.SELECTED_FACILITY);
          localStorage.removeItem(STORAGE_KEYS.FACILITY_ID);
        } catch {}
        return;
      }
      setSelectedFacilityState(normalized);
      const id = normalizeFacilityId(normalized);
      if (id !== undefined && id !== null) setFacilityIdState(String(id));
      try {
        localStorage.setItem(STORAGE_KEYS.SELECTED_FACILITY, JSON.stringify(normalized));
      } catch {}
    } else if (sf == null) {
      setSelectedFacilityState(null);
      setFacilityIdState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_FACILITY);
        localStorage.removeItem(STORAGE_KEYS.FACILITY_ID);
      } catch {}
    } else {
      const normalizedId = normalizeFacilityId(sf);
      if (normalizedId) {
        setFacilityIdState(normalizedId);
        const preview = { facilityId: normalizedId };
        setSelectedFacilityState(preview);
        try {
          localStorage.setItem(STORAGE_KEYS.SELECTED_FACILITY, JSON.stringify(preview));
        } catch {}
      } else {
        setSelectedFacilityState(null);
        setFacilityIdState(null);
      }
    }
  }, []);

  const selectFacility = useCallback((facility) => {
    try {
      const fid = facility.facilityId ?? facility.id ?? facility._id ?? "";
      localStorage.setItem(STORAGE_KEYS.FACILITY_ID, String(fid));
      const preview = {
        facilityId: fid,
        name: facility.name ?? null,
      };
      localStorage.setItem(STORAGE_KEYS.SELECTED_FACILITY, JSON.stringify(preview));
      setSelectedFacilityState(preview);
      setFacilityIdState(String(fid));
    } catch (e) {
      console.warn("Failed to save selected facility to localStorage", e);
    }
  }, []);

  // public setters for family (ADDED)
  const setFamilyId = useCallback((f) => {
    const normalized = normalizeFamilyId(f);
    setFamilyIdState(normalized ?? null);
    if (!normalized) {
      setSelectedFamilyState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_FAMILY);
      } catch {}
    }
  }, []);

  const setSelectedFamily = useCallback((sfam) => {
    if (sfam && typeof sfam === "object") {
      const normalized = Array.isArray(sfam) ? sfam[0] ?? null : sfam;
      if (!normalized) {
        setSelectedFamilyState(null);
        setFamilyIdState(null);
        try {
          localStorage.removeItem(STORAGE_KEYS.SELECTED_FAMILY);
          localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
        } catch {}
        return;
      }
      setSelectedFamilyState(normalized);
      const id = normalizeFamilyId(normalized);
      if (id !== undefined && id !== null) setFamilyIdState(String(id));
      try {
        localStorage.setItem(STORAGE_KEYS.SELECTED_FAMILY, JSON.stringify(normalized));
      } catch {}
    } else if (sfam == null) {
      setSelectedFamilyState(null);
      setFamilyIdState(null);
      try {
        localStorage.removeItem(STORAGE_KEYS.SELECTED_FAMILY);
        localStorage.removeItem(STORAGE_KEYS.FAMILY_ID);
      } catch {}
    } else {
      const normalizedId = normalizeFamilyId(sfam);
      if (normalizedId) {
        setFamilyIdState(normalizedId);
        const preview = { familyId: normalizedId };
        setSelectedFamilyState(preview);
        try {
          localStorage.setItem(STORAGE_KEYS.SELECTED_FAMILY, JSON.stringify(preview));
        } catch {}
      } else {
        setSelectedFamilyState(null);
        setFamilyIdState(null);
      }
    }
  }, []);

  const selectFamily = useCallback((family) => {
    try {
      const fid = family.familyId ?? family.id ?? family._id ?? "";
      localStorage.setItem(STORAGE_KEYS.FAMILY_ID, String(fid));
      const preview = {
        familyId: fid,
        name: family.name ?? null,
      };
      localStorage.setItem(STORAGE_KEYS.SELECTED_FAMILY, JSON.stringify(preview));
      setSelectedFamilyState(preview);
      setFamilyIdState(String(fid));
    } catch (e) {
      console.warn("Failed to save selected family to localStorage", e);
    }
  }, []);

  const value = {
    user,
    setUser,
    userId,
    setUserId,
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

    // plot exports
    plotId,
    selectedPlot,
    setPlotId,
    setSelectedPlot,
    selectPlot,

    // material exports
    materialId,
    selectedMaterial,
    setMaterialId,
    setSelectedMaterial,
    selectMaterial,

    // facility exports
    facilityId,
    selectedFacility,
    setFacilityId,
    setSelectedFacility,
    selectFacility,

    // family exports (ADDED)
    familyId,
    selectedFamily,
    setFamilyId,
    setSelectedFamily,
    selectFamily,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
