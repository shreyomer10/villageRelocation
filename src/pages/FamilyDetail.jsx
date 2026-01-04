// src/pages/FamilyDetails.jsx
import React, { useEffect, useMemo, useState, useRef, useContext, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { motion } from "framer-motion";
import { FileText, Image as ImageIcon, ArrowLeft, Search, RefreshCw, CheckCircle } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import DocumentModal from "../component/DocsModal";

function fmtDate(iso) {
  try {
    if (!iso) return "—";
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toLocaleString();
    return iso;
  } catch (e) {
    return iso;
  }
}

function StatusBadge({ status }) {
  const map = {
    "-1": { label: "Deleted", color: "bg-gray-100 text-gray-700" },
    "1": { label: "Forest Guard", color: "bg-yellow-200 text-yellow-800" },
    "2": { label: "Range Assistant", color: "bg-blue-300 text-blue-800" },
    "3": { label: "Range Officer", color: "bg-indigo-300 text-indigo-800" },
    "4": { label: "Assistant Director", color: "bg-green-300 text-green-800" },
  };
  const entry = map[String(status)] || { label: `Status ${status}`, color: "bg-gray-100 text-gray-800" };
  return <span className={`text-xs px-2 py-1 rounded ${entry.color}`}>{entry.label}</span>;
}

function StageBadge({ name }) {
  if (!name) return null;
  return <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 ml-2">{name}</span>;
}

export default function FamilyDetails() {
  const rawParams = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const authCtx = useContext(AuthContext);

  const resolveFamilyIdFromStorage = () => {
    try {
      const byKey = localStorage.getItem("familyId") || localStorage.getItem("FAMILY_ID") || localStorage.getItem("FAMILYId");
      if (byKey) return byKey;
      const rawSel = localStorage.getItem("selectedFamily") || localStorage.getItem("SELECTED_FAMILY");
      if (rawSel) {
        const parsed = JSON.parse(rawSel);
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) return normalized.familyId ?? normalized.id ?? normalized._id ?? null;
      }
    } catch {}
    return null;
  };

  const resolveVillageIdFromStorage = () => {
    try {
      const byKey = localStorage.getItem("villageId") || localStorage.getItem("VILLAGE") || localStorage.getItem("villageID");
      if (byKey) return byKey;
      const rawSel = localStorage.getItem("selectedPlot") || localStorage.getItem("selectedVillage");
      if (rawSel) {
        const parsed = JSON.parse(rawSel);
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) return normalized.villageId ?? normalized.village ?? null;
      }
    } catch {}
    return null;
  };

  const extractFamilyIdFromAuth = (ctx) => {
    if (!ctx) return null;
    try {
      if (ctx.familyId) return ctx.familyId;
      if (ctx.FAMILY_ID) return ctx.FAMILY_ID;
      if (ctx.selectedFamily) {
        const sf = ctx.selectedFamily;
        if (typeof sf === "string") return sf;
        if (Array.isArray(sf)) {
          const first = sf[0] ?? null;
          if (first) return first.familyId ?? first.id ?? first._id ?? null;
        }
        return sf.familyId ?? sf.id ?? sf._id ?? null;
      }
    } catch {}
    return null;
  };

  const extractVillageIdFromAuth = (ctx) => {
    if (!ctx) return null;
    try {
      if (ctx.villageId) return ctx.villageId;
      if (ctx.VILLAGE) return ctx.VILLAGE;
      if (ctx.selectedPlot) {
        const sp = ctx.selectedPlot;
        if (typeof sp === "string") return sp;
        if (Array.isArray(sp)) {
          const first = sp[0] ?? null;
          if (first) return first.villageId ?? first.village ?? null;
        }
        return sp.villageId ?? sp.village ?? null;
      }
    } catch {}
    return null;
  };

  const getInitialFamily = () => {
    const fromRoute = rawParams.familyId;
    if (fromRoute) return fromRoute;
    const fromLocation = location?.state?.selectedFamily && (location.state.selectedFamily.familyId ?? location.state.selectedFamily.id ?? location.state.selectedFamily._id);
    if (fromLocation) return fromLocation;
    const fromAuth = extractFamilyIdFromAuth(authCtx);
    if (fromAuth) return fromAuth;
    const fromStorage = resolveFamilyIdFromStorage();
    if (fromStorage) return fromStorage;
    return null;
  };

  const getInitialVillage = () => {
    const fromLocation = location?.state?.selectedFamily && (location.state.selectedFamily.villageId ?? location.state.selectedFamily.village);
    if (fromLocation) return fromLocation;
    const fromAuth = extractVillageIdFromAuth(authCtx);
    if (fromAuth) return fromAuth;
    const fromStorage = resolveVillageIdFromStorage();
    if (fromStorage) return fromStorage;
    return null;
  };

  const [familyId, setFamilyId] = useState(getInitialFamily() ? String(getInitialFamily()) : null);
  const [villageId, setVillageId] = useState(getInitialVillage() ? String(getInitialVillage()) : null);

  useEffect(() => {
    const fromRoute = rawParams.familyId ?? null;
    const fromLocation = location?.state?.selectedFamily && (location.state.selectedFamily.familyId ?? location.state.selectedFamily.id ?? location.state.selectedFamily._id);
    const fromAuth = extractFamilyIdFromAuth(authCtx);
    const fromStorage = resolveFamilyIdFromStorage();
    const resolved = fromRoute || fromLocation || fromAuth || fromStorage || null;
    if (resolved && String(resolved) !== familyId) setFamilyId(String(resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawParams.familyId, location?.state?.selectedFamily, authCtx]);

  useEffect(() => {
    const fromLocation = location?.state?.selectedFamily && (location.state.selectedFamily.villageId ?? location.state.selectedFamily.village);
    const fromAuth = extractVillageIdFromAuth(authCtx);
    const fromStorage = resolveVillageIdFromStorage();
    const resolved = fromLocation || fromAuth || fromStorage || null;
    if (resolved && String(resolved) !== villageId) setVillageId(String(resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state?.selectedFamily, authCtx]);

  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      if (e.key === "familyId" || e.key === "FAMILY_ID") {
        if (e.newValue) setFamilyId(String(e.newValue));
      }
      if (e.key === "selectedFamily") {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
          if (normalized && (normalized.familyId || normalized.id)) setFamilyId(String(normalized.familyId ?? normalized.id));
        } catch {}
      }
      if (e.key === "villageId" || e.key === "villageID") {
        if (e.newValue) setVillageId(String(e.newValue));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  // filters (server-side)
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  // server-side name filter (sent as `name` query param)
  const [nameFilter, setNameFilter] = useState("");

  // server-side stage filter (added)
  const [stageFilter, setStageFilter] = useState("");

  // UI-only search input (debounced -> nameFilter)
  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalUpdate, setModalUpdate] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsDocs, setDocsDocs] = useState([]);
  const [docsTitle, setDocsTitle] = useState("Documents");
  const [docsLoading, setDocsLoading] = useState(false);

  const [expandedNotesFor, setExpandedNotesFor] = useState(null);

  const updateRefs = useRef({});

  // ----------------- LOGS (line chart) state + abort + cache -----------------
  const [logsItems, setLogsItems] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const logsControllerRef = useRef(null);
  const logsCacheRef = useRef({}); // keyed by village|family|filters

  // timeline state
  const [timelineStages, setTimelineStages] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState(null);
  const [lastCompletedIndex, setLastCompletedIndex] = useState(-1);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [completedLinePercent, setCompletedLinePercent] = useState(0);
  const [currentOptionObj, setCurrentOptionObj] = useState(null);

  // hover behavior for timeline popups
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [popupHovered, setPopupHovered] = useState(false);
  const hideTimerRef = useRef(null);

  // helper to read token & build auth headers
  function authHeaders() {
    const token = localStorage.getItem("token") || null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchWithCreds(url, opts = {}) {
    try {
      const headers = { ...(opts.headers || {}), ...(opts.authHeaders || {}) };
      const res = await fetch(url, {
        method: opts.method || "GET",
        credentials: "include",
        headers,
        body: opts.body,
        signal: opts.signal,
      });
      const text = await res.text().catch(() => "");
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      return { res, ok: res.ok, status: res.status, json, text };
    } catch (err) {
      if (err && err.name === "AbortError") return { res: null, ok: false, status: 0, json: null, text: "aborted", aborted: true };
      return { res: null, ok: false, status: 0, json: null, text: String(err) };
    }
  }

  // ----------------- Logs (line chart) -----------------
  // Chart visible only when no server-side filter is active
  const showLogsChart = Boolean(villageId && familyId) &&
    !statusFilter && !fromDateFilter && !toDateFilter && !nameFilter && !stageFilter;

  useEffect(() => {
    // debounce logs fetch to avoid spamming when params change rapidly
    const key = `${villageId || ""}|${familyId || ""}|${statusFilter||''}|${fromDateFilter||''}|${toDateFilter||''}|${nameFilter||''}|${stageFilter||''}`;
    if (!showLogsChart) {
      try { if (logsControllerRef.current) { logsControllerRef.current.abort(); logsControllerRef.current = null; } } catch {}
      setLogsItems([]);
      setLogsLoading(false);
      setLogsError(null);
      return;
    }

    let mounted = true;
    const tid = setTimeout(async () => {
      try {
        if (logsCacheRef.current[key]) {
          if (!mounted) return;
          setLogsItems(logsCacheRef.current[key]);
          setLogsError(null);
          setLogsLoading(false);
          return;
        }

        try { if (logsControllerRef.current) logsControllerRef.current.abort(); } catch {}
        const controller = new AbortController();
        logsControllerRef.current = controller;
        setLogsLoading(true);
        setLogsError(null);

        const params = new URLSearchParams();
        params.append('type', 'family'); // type = family
        if (villageId) params.append('villageId', villageId);
        if (familyId) params.append('familyId', familyId);
        params.append('page', '1');
        params.append('limit', String(Math.max(100, limit)));
        const url = `${API_BASE}/logs?${params.toString()}`;

        const { ok, status, json, text, aborted } = await fetchWithCreds(url, { method: 'GET', signal: controller.signal, authHeaders: authHeaders() });
        if (!mounted) return;
        if (aborted) return;

        if (!ok) {
          if (status === 404) {
            setLogsItems([]);
            setLogsError(null);
            setLogsLoading(false);
            return;
          }
          throw new Error((json && (json.message || json.error)) || text || `Failed to fetch logs: ${status}`);
        }

        const payload = json ?? {};
        const result = payload.result ?? payload ?? {};
        const items = result.items ?? (Array.isArray(result) ? result : []);
        const finalItems = Array.isArray(items) ? items : [];
        logsCacheRef.current[key] = finalItems;
        setLogsItems(finalItems);
        setLogsError(null);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error('fetch logs error:', err);
        setLogsError(err.message || 'Failed to load logs');
        setLogsItems([]);
      } finally {
        if (mounted) setLogsLoading(false);
      }
    }, 420);

    return () => { mounted = false; clearTimeout(tid); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, familyId, statusFilter, fromDateFilter, toDateFilter, nameFilter, stageFilter, limit]);

  // Chart renderer — focused on the three actions required by user
  function LogsLineChart({ items }) {
    if (!items || items.length === 0) {
      return <div className="text-sm text-gray-500">No activity logs available to plot.</div>;
    }

    // Normalize action name to one of: Insert, Edited, Delete
    function normalizeAction(a) {
      if (!a) return 'other';
      const lower = String(a).toLowerCase();
      if (lower.includes('delete')) return 'Delete';
      if (lower.includes('edited') || lower.includes('edit') || lower.includes('update')) return 'Edited';
      if (lower.includes('insert') || lower.includes('create') || lower.includes('added')) return 'Insert';
      if (lower.includes('family') && lower.includes('insert')) return 'Insert';
      if (lower.includes('family') && (lower.includes('edit') || lower.includes('updated') || lower.includes('edited'))) return 'Edited';
      if (lower.includes('family') && lower.includes('delete')) return 'Delete';
      return 'other';
    }

    const byMonth = {};
    items.forEach((it) => {
      const timeStr = it.updateTime ?? it.update_time ?? it.time ?? it.createdAt ?? it.insertedAt ?? it.created_at ?? null;
      let monthKey = null;
      if (typeof timeStr === 'string' && timeStr.length >= 7) {
        const m = timeStr.match(/^(\d{4})[-\/](\d{2})/);
        if (m) monthKey = `${m[1]}-${m[2]}`;
        else {
          const parsed = new Date(timeStr);
          if (!Number.isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const mm = String(parsed.getMonth() + 1).padStart(2, '0');
            monthKey = `${y}-${mm}`;
          }
        }
      } else if (timeStr instanceof Date) {
        const y = timeStr.getFullYear();
        const mm = String(timeStr.getMonth() + 1).padStart(2, '0');
        monthKey = `${y}-${mm}`;
      } else {
        const parsed = new Date(it.createdAt || it.time || it.insertedAt || Date.now());
        if (!Number.isNaN(parsed.getTime())) {
          const y = parsed.getFullYear();
          const mm = String(parsed.getMonth() + 1).padStart(2, '0');
          monthKey = `${y}-${mm}`;
        } else monthKey = 'unknown';
      }
      if (!monthKey) monthKey = 'unknown';
      if (!byMonth[monthKey]) byMonth[monthKey] = { Insert: 0, Edited: 0, Delete: 0 };
      const action = normalizeAction(it.action ?? it.event ?? it.type ?? it.activity ?? it.description ?? '');
      if (action === 'Insert' || action === 'Edited' || action === 'Delete') {
        byMonth[monthKey][action] = (byMonth[monthKey][action] || 0) + 1;
      }
    });

    const months = Object.keys(byMonth).filter(k => k !== 'unknown').sort((a, b) => a.localeCompare(b));
    if (months.length === 0) months.push('unknown');

    const insertSeries = months.map(m => byMonth[m]?.Insert ?? 0);
    const editedSeries = months.map(m => byMonth[m]?.Edited ?? 0);
    const deleteSeries = months.map(m => byMonth[m]?.Delete ?? 0);

    const maxVal = Math.max(...insertSeries, ...editedSeries, ...deleteSeries, 1);
    const width = 820;
    const height = 240;
    const paddingLeft = 64;
    const paddingRight = 24;
    const paddingTop = 20;
    const paddingBottom = 44;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const xForIndex = (i) => {
      if (months.length === 1) return paddingLeft + plotWidth / 2;
      return paddingLeft + (i / (months.length - 1)) * plotWidth;
    };
    const yForValue = (v) => {
      const frac = v / maxVal;
      return paddingTop + (1 - frac) * plotHeight;
    };

    const ticks = 4;
    const tickVals = Array.from({ length: ticks + 1 }).map((_, i) => Math.round((i / ticks) * maxVal));
    const colors = { Insert: "#10b981", Edited: "#f59e0b", Delete: "#ef4444" };

    return (
      <div className="bg-white rounded-lg border p-3 shadow-sm w-full mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-sm text-gray-600">Family activity (family)</div>
            <div className="text-lg font-semibold">Family Insert / Edited / Deleted</div>
          </div>
          <div className="text-xs text-gray-400">Hidden when server filters are active</div>
        </div>

        <div className="overflow-auto">
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Family activity chart">
            <defs>
              <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0b1220" floodOpacity="0.06" />
              </filter>
            </defs>

            {tickVals.map((tv, i) => {
              const y = yForValue(tv);
              return (
                <g key={`tick_${i}`}>
                  <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="#eef2ff" strokeWidth="1" />
                  <text x={paddingLeft - 8} y={y + 4} fontSize="11" fill="#475569" textAnchor="end" style={{ fontFamily: "Inter, system-ui" }}>{tv}</text>
                </g>
              );
            })}

            {months.map((m, i) => {
              const x = xForIndex(i);
              return (
                <g key={`x_${m}`}>
                  <text x={x} y={height - 18} fontSize="11" fill="#475569" textAnchor="middle" style={{ fontFamily: "Inter, system-ui" }}>{m}</text>
                </g>
              );
            })}

            {["Insert", "Edited", "Delete"].map((key) => {
              const series = key === "Insert" ? insertSeries : key === "Edited" ? editedSeries : deleteSeries;
              const path = series.map((val, idx) => {
                const x = xForIndex(idx);
                const y = yForValue(val);
                return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
              }).join(" ");
              const lastX = xForIndex(series.length - 1);
              const firstX = xForIndex(0);
              const baseY = yForValue(0);
              const areaPath = `${path} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} L ${firstX.toFixed(2)} ${baseY.toFixed(2)} Z`;
              return <path key={`area_${key}`} d={areaPath} fill={colors[key]} opacity="0.06" />;
            })}

            {["Insert", "Edited", "Delete"].map((key) => {
              const series = key === "Insert" ? insertSeries : key === "Edited" ? editedSeries : deleteSeries;
              const d = series.map((val, idx) => {
                const x = xForIndex(idx);
                const y = yForValue(val);
                return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
              }).join(" ");
              return (
                <g key={`line_${key}`}>
                  <path d={d} fill="none" stroke={colors[key]} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "url(#softShadow)" }} />
                  {series.map((val, idx) => {
                    const x = xForIndex(idx);
                    const y = yForValue(val);
                    return <circle key={`pt_${key}_${idx}`} cx={x} cy={y} r={3.6} fill="#fff" stroke={colors[key]} strokeWidth={2} />;
                  })}
                </g>
              );
            })}

            <g transform={`translate(${paddingLeft}, ${paddingTop - 6})`}>
              {["Insert", "Edited", "Delete"].map((k, i) => (
                <g key={`leg_${k}`} transform={`translate(${i * 120}, 0)`}>
                  <rect x={0} y={-12} width={14} height={8} rx={2} fill={colors[k]} />
                  <text x={20} y={-4} fontSize="12" fill="#0f172a" style={{ fontFamily: "Inter, system-ui" }}>{k}</text>
                </g>
              ))}
            </g>

          </svg>
        </div>
      </div>
    );
  }

  // ----------------- end logs/chart -----------------

  // debounce search -> setNameFilter (server param)
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      const trimmed = (search || "").trim();
      setNameFilter(trimmed);
      setPage(1);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, villageId]);

  // fetch when any server-side filter or pagination changes (now includes nameFilter and stageFilter)
  useEffect(() => {
    fetchUpdates(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter, fromDateFilter, toDateFilter, nameFilter, stageFilter]);

  function authFetch(url, opts = {}) {
    return fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(opts.headers || {}) }, ...opts });
  }

  function dateStartOfDay(d) {
    if (!d) return null;
    return `${d} 00:00:00`;
  }
  function dateEndOfDay(d) {
    if (!d) return null;
    return `${d} 23:59:59`;
  }

  async function loadAll() {
    setLoading(true);
    setPageError(null);
    try {
      if (!familyId || !villageId) {
        setUpdates([]);
        setTotalCount(0);
        return;
      }
      setPage(1);
      await Promise.all([fetchUpdates(1, limit), fetchTimelineForFamily()]);
    } catch (err) {
      console.error("loadAll:", err);
      setPageError(err.message || "Error loading family updates");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUpdates(pageArg = page, limitArg = limit) {
    setUpdatesLoading(true);
    setPageError(null);
    try {
      if (!familyId || !villageId) {
        setUpdates([]);
        setTotalCount(0);
        setUpdatesLoading(false);
        return;
      }
      const qs = new URLSearchParams();
      qs.set("page", String(pageArg || 1));
      qs.set("limit", String(limitArg || 15));
      if (statusFilter) qs.set("status", statusFilter);
      if (fromDateFilter) qs.set("fromDate", dateStartOfDay(fromDateFilter));
      if (toDateFilter) qs.set("toDate", dateEndOfDay(toDateFilter));
      if (nameFilter) qs.set("name", nameFilter);
      if (stageFilter) qs.set("stage", stageFilter);

      const url = `${API_BASE}/updates/${encodeURIComponent(villageId)}/${encodeURIComponent(familyId)}?${qs.toString()}`;
      const res = await authFetch(url, { method: "GET" });
      const text = await res.text().catch(() => "");
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }

      if (!res.ok) {
        const msg = (json && (json.message || json.error)) || text || `Failed to fetch updates: ${res.status}`;
        if (res.status === 404) {
          setUpdates([]);
          setTotalCount(0);
          setUpdatesLoading(false);
          return;
        }
        throw new Error(msg);
      }

      const payload = json ?? {};
      let items = [];
      let count = 0;
      if (payload.result) {
        items = payload.result.items ?? [];
        count = payload.result.count ?? payload.result.total ?? 0;
      } else if (Array.isArray(payload)) {
        items = payload;
        count = items.length;
      } else {
        items = payload.items ?? [];
        count = payload.count ?? 0;
      }
      items = Array.isArray(items) ? items : [];
      setUpdates(items);
      setTotalCount(Number(count) || items.length || 0);
    } catch (err) {
      console.error("fetchUpdates:", err);
      setPageError(err.message || "Failed to fetch updates");
      setUpdates([]);
      setTotalCount(0);
    } finally {
      setUpdatesLoading(false);
    }
  }

  async function fetchUpdateOne(updateId) {
    if (!updateId) return null;
    setModalLoading(true);
    setPageError(null);
    try {
      const url = `${API_BASE}/updates/one/${encodeURIComponent(updateId)}`;
      const res = await authFetch(url, { method: "GET" });
      const text = await res.text().catch(() => "");
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }

      if (!res.ok) {
        const msg = (json && (json.message || json.error)) || text || `Failed to fetch update: ${res.status}`;
        throw new Error(msg);
      }
      const payload = json ?? {};
      const result = payload.result ?? payload ?? null;
      return result;
    } catch (err) {
      console.error("fetchUpdateOne:", err);
      setPageError(err.message || "Failed to fetch update");
      return null;
    } finally {
      setModalLoading(false);
    }
  }

  // New: fetch only docs for an update. Tries a dedicated docs endpoint first, falls back to the full update endpoint.
  async function fetchUpdateDocs(updateId) {
    if (!updateId) return [];
    setDocsLoading(true);
    setPageError(null);
    try {
      const tryUrls = [
        `${API_BASE}/updates/docs/${encodeURIComponent(updateId)}`,
        `${API_BASE}/updates/${encodeURIComponent(updateId)}/docs`,
        `${API_BASE}/updates/one/${encodeURIComponent(updateId)}`,
      ];

      for (let i = 0; i < tryUrls.length; i++) {
        const url = tryUrls[i];
        try {
          const res = await authFetch(url, { method: "GET" });
          const text = await res.text().catch(() => "");
          let json = null;
          try { json = text ? JSON.parse(text) : null; } catch { json = null; }

          if (!res.ok) {
            if (res.status === 404) continue;
            const msg = (json && (json.message || json.error)) || text || `Failed to fetch docs: ${res.status}`;
            throw new Error(msg);
          }

          let payload = json ?? {};
          let docsArr = null;
          if (payload.result && (Array.isArray(payload.result.docs) || Array.isArray(payload.result.documents))) {
            docsArr = payload.result.docs ?? payload.result.documents;
          } else if (Array.isArray(payload.docs) || Array.isArray(payload.documents)) {
            docsArr = payload.docs ?? payload.documents;
          } else if (Array.isArray(payload)) {
            docsArr = payload;
          } else if (payload.result && Array.isArray(payload.result)) {
            docsArr = payload.result;
          } else if (payload.files && Array.isArray(payload.files)) {
            docsArr = payload.files;
          }

          if (!Array.isArray(docsArr) && (payload.result || payload)) {
            const obj = payload.result ?? payload;
            const candidates = ["docs", "documents", "photos", "images", "files", "attachments"];
            for (const c of candidates) {
              if (Array.isArray(obj[c])) { docsArr = obj[c]; break; }
            }
            if (!Array.isArray(docsArr)) {
              docsArr = [];
            }
          }

          const normalized = (docsArr || []).map((item) => {
            if (!item) return null;
            if (typeof item === "string") return item;
            if (typeof item === "object") {
              return item.url ?? item.link ?? item.path ?? item.file ?? item.src ?? item.location ?? null;
            }
            return null;
          }).filter(Boolean);

          return normalized;
        } catch (innerErr) {
          console.warn(`fetchUpdateDocs candidate failed (${url}):`, innerErr?.message || innerErr);
          continue;
        }
      }

      return [];
    } catch (err) {
      console.error("fetchUpdateDocs:", err);
      setPageError(err.message || "Failed to fetch docs");
      return [];
    } finally {
      setDocsLoading(false);
    }
  }

  async function openUpdateModalById(e, updateId) {
    e?.stopPropagation?.();
    setModalLoading(true);
    setModalUpdate(null);
    setModalOpen(true);
    try {
      const data = await fetchUpdateOne(updateId);
      if (data) setModalUpdate(data);
    } catch (err) {
      console.error("openUpdateModalById:", err);
      setModalUpdate(null);
    } finally {
      setModalLoading(false);
    }
  }

  // Updated: fetch docs-only then open DocumentModal with normalized list of links
  async function openDocsModalById(e, updateId) {
    e?.stopPropagation?.();
    setDocsLoading(true);
    setDocsDocs([]);
    setDocsTitle("Documents");
    setDocsOpen(true);
    try {
      const docsList = await fetchUpdateDocs(updateId);
      setDocsDocs(docsList || []);

      try {
        const maybe = await fetchUpdateOne(updateId);
        const title = (maybe && (maybe.name ?? maybe.updateName ?? maybe.title ?? maybe.updateId)) || "Documents";
        setDocsTitle(title);
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error("openDocsModalById:", err);
      setDocsDocs([]);
      setDocsTitle("Documents");
    } finally {
      setDocsLoading(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setModalUpdate(null);
  }

  function gotoPage(p) {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)));
    const np = Math.max(1, Math.min(totalPages, Number(p) || 1));
    if (np === page) return;
    setPage(np);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPageButtons() {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)));
    const maxButtons = 7;
    const pages = [];
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const left = Math.max(2, page - 1);
      const right = Math.min(totalPages - 1, page + 1);
      pages.push(1);
      if (left > 2) pages.push("left-ellipsis");
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < totalPages - 1) pages.push("right-ellipsis");
      pages.push(totalPages);
    }
    return pages.map((p, idx) => {
      if (p === "left-ellipsis" || p === "right-ellipsis") return <span key={`e-${idx}`} className="px-3 py-1">…</span>;
      return (
        <button
          key={p}
          onClick={() => gotoPage(p)}
          className={`px-3 py-1 rounded ${p === page ? "bg-indigo-600 text-white" : "bg-white border hover:bg-gray-50"}`}
        >
          {p}
        </button>
      );
    });
  }

  // ----------------- Timeline helpers & fetch -----------------
  function normalizeOptionStages(optionObj, completedSubsSet) {
    if (!optionObj || !Array.isArray(optionObj.stages)) return [];
    return (optionObj.stages || [])
      .filter(s => !s?.deleted)
      .slice()
      .sort((a, b) => {
        const pa = Number(a.position ?? 0) || 0;
        const pb = Number(b.position ?? 0) || 0;
        if (pa || pb) return pa - pb;
        return (a.stageId || a.stageid || "").localeCompare(b.stageId || b.stageid || "");
      })
      .map((stage, sIdx) => {
        const stageId = stage.stageId ?? stage.stageid ?? stage.id ?? stage._id ?? stage.name ?? `stage-${sIdx}`;
        const stageTitle = stage.name ?? stage.title ?? stage.stageName ?? stage.stageId ?? stageId;
        const rawSubstages = stage.subStages || stage.substages || stage.sub_stages || stage.items || [];

        const mappedSubstages = (Array.isArray(rawSubstages ? rawSubstages : []) ? rawSubstages : []).map((ss, idx) => {
          const ssId = ss.subStageId ?? ss.substageId ?? ss.id ?? ss._id ?? ss.name ?? `sub-${sIdx}-${idx}`;
          const ssTitle = ss.name ?? ss.title ?? ss.subStageName ?? ssId;
          const completed = completedSubsSet.has(String(ssId)) || completedSubsSet.has(String(ssTitle)) || false;
          return {
            raw: ss,
            id: String(ssId),
            name: String(ssTitle),
            completed,
          };
        });

        const stageCompleted = mappedSubstages.length > 0 ? mappedSubstages.every(s => s.completed) : completedSubsSet.has(String(stageId)) || false;

        return {
          raw: stage,
          id: String(stageId),
          name: String(stageTitle),
          stageId,
          title: String(stageTitle),
          position: Number(stage.position ?? 0) || 0,
          completed: stageCompleted,
          subStages: mappedSubstages,
        };
      });
  }

  function resolveStageNameForUpdate(u) {
    if (!u) return null;
    const candidates = [];
    const fields = ["stage", "stageId", "stageid", "currentStage", "current_stage", "stageName", "stage_name", "stage_id", "name"];
    for (const f of fields) {
      const v = u[f] ?? u[f.toLowerCase?.()];
      if (v) {
        if (typeof v === "string") candidates.push(v.trim());
        else candidates.push(String(v));
      }
    }

    if (u.raw && (u.raw.stage || u.raw.stageId || u.raw.stageName)) {
      if (u.raw.stage) candidates.push(String(u.raw.stage));
      if (u.raw.stageId) candidates.push(String(u.raw.stageId));
      if (u.raw.stageName) candidates.push(String(u.raw.stageName));
    }

    if (Array.isArray(timelineStages) && timelineStages.length > 0) {
      const lowered = timelineStages.map(s => ({
        id: String(s.id ?? s.stageId ?? s.stageid ?? s.title ?? s.name ?? "").toLowerCase(),
        rawId: s.id ?? s.stageId ?? s.stageid ?? "",
        name: String(s.name ?? s.title ?? s.stageId ?? s.id ?? ""),
      }));
      for (const cand of candidates) {
        const c = String(cand).toLowerCase();
        const found = lowered.find(ls => ls.id === c || String(ls.name).toLowerCase() === c);
        if (found) return found.name;
        const foundIncl = lowered.find(ls => (ls.id && c.includes(ls.id)) || (ls.name && c.includes(String(ls.name).toLowerCase())) || (ls.id && String(ls.id).includes(c)));
        if (foundIncl) return foundIncl.name;
      }
    }

    if (u.stageName) return String(u.stageName);
    if (u.currentStage) return String(u.currentStage);
    if (u.stage) return String(u.stage);
    return null;
  }

  async function fetchTimelineForFamily() {
    setTimelineLoading(true);
    setTimelineError(null);
    setTimelineStages([]);
    setCurrentOptionObj(null);
    setLastCompletedIndex(-1);
    setCurrentIndex(-1);
    setCompletedLinePercent(0);

    if (!familyId) {
      setTimelineLoading(false);
      return;
    }

    try {
      const triesOptions = [`${API_BASE}/option`, `${API_BASE}/options`, `${API_BASE}/option/list`, `${API_BASE}/stages`];
      let opts = [];
      for (const url of triesOptions) {
        try {
          const res = await authFetch(url, { method: "GET" });
          if (!res.ok) continue;
          const j = await res.json().catch(() => null);
          if (j && j.result && Array.isArray(j.result.items)) { opts = j.result.items; break; }
          if (j && j.result && Array.isArray(j.result)) { opts = j.result; break; }
          if (Array.isArray(j)) { opts = j; break; }
        } catch (e) {
          // continue
        }
      }

      const famUrl = `${API_BASE}/families/${encodeURIComponent(familyId)}`;
      let fam = null;
      try {
        const fres = await authFetch(famUrl, { method: "GET" });
        if (fres.ok) {
          const fj = await fres.json().catch(() => null);
          fam = (fj && fj.result) ? fj.result : fj;
        }
      } catch (e) {
        // ignore
      }

      const optionKey = fam?.relocationOption ?? fam?.relocation ?? null;
      const findCurrentOption = () => {
        if (!optionKey || !Array.isArray(opts)) return null;
        let cur = opts.find((o) => (o.optionId || o.optionid || "").toString() === (optionKey || "").toString());
        if (cur) return cur;
        cur = opts.find((o) => {
          if (o.optionId && String(optionKey).includes(String(o.optionId))) return true;
          if (o.name && String(optionKey).toLowerCase().includes(String(o.name).toLowerCase())) return true;
          return false;
        });
        return cur || null;
      };
      const optionObj = findCurrentOption();
      setCurrentOptionObj(optionObj || null);

      const completedSubs = new Set((fam?.completedSubstages ?? fam?.completedSubStages ?? fam?.completed_substages ?? fam?.stagesCompleted ?? []).map(s => String(s)));

      let built = [];
      if (optionObj && Array.isArray(optionObj.stages)) {
        built = normalizeOptionStages(optionObj, completedSubs);
      } else {
        built = Array.from(completedSubs).map((s, i) => ({
          id: s,
          name: String(s),
          title: String(s),
          position: i,
          completed: true,
          subStages: [],
          raw: {},
          stageId: s,
        }));
      }

      setTimelineStages(built);

      const last = (() => {
        if (!built || !built.length) return -1;
        let L = -1;
        built.forEach((st, i) => { if (st.completed) L = i; });
        return L;
      })();
      setLastCompletedIndex(last);

      const explicitIndex = (() => {
        const curProp = fam?.currentStage ?? fam?.current_stage ?? null;
        if (!curProp) return -1;
        const cur = String(curProp).toLowerCase();
        return built.findIndex(s =>
          String(s.stageId ?? "").toLowerCase() === cur ||
          String(s.name ?? "").toLowerCase() === cur ||
          String(s.position ?? "").toLowerCase() === cur ||
          (cur.includes("_") && String(s.stageId ?? "").toLowerCase().includes(cur))
        );
      })();
      const curIdx = explicitIndex >= 0 ? explicitIndex : (last >= built.length - 1 ? last : last + 1);
      setCurrentIndex(curIdx);

      const percent = (() => {
        const len = built.length;
        if (!len) return 0;
        if (len === 1) return last >= 0 ? 100 : 0;
        const gaps = len - 1;
        const p = gaps > 0 ? (last / gaps) * 100 : 0;
        return Math.max(0, Math.min(100, p));
      })();
      setCompletedLinePercent(percent);
    } catch (err) {
      console.error("fetchTimelineForFamily:", err);
      setTimelineError(err?.message || "Failed to load timeline");
    } finally {
      setTimelineLoading(false);
    }
  }

  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }
  function handleCircleEnter(idx) {
    clearHideTimer();
    setHoveredIndex(idx);
  }
  function handleCircleLeave(idx) {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!popupHovered) setHoveredIndex((h) => (h === idx ? null : h));
      hideTimerRef.current = null;
    }, 150);
  }
  function handlePopupEnter() {
    clearHideTimer();
    setPopupHovered(true);
  }
  function handlePopupLeave() {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setPopupHovered(false);
      setHoveredIndex(null);
      hideTimerRef.current = null;
    }, 150);
  }

  function onStageClick(stage, idx) {
    try {
      const stageId = stage?.id ?? stage?.stageId ?? stage?.stageid ?? stage?.name ?? String(idx);
      const newStage = stageFilter === stageId ? "" : stageId;
      setStageFilter(newStage);
      setPage(1);
    } catch (e) {
      console.error("onStageClick:", e);
    }
  }

  function onSubClick(stage, sub) {
    try {
      const subId = sub?.id ?? sub?.subStageId ?? sub?.substageId ?? sub?.name ?? null;
      if (!subId) return;
      const stageId = stage?.id ?? stage?.stageId ?? stage?.stageid ?? stage?.name ?? null;
      setStageFilter(stageId ? String(stageId) : "");
      setNameFilter(String(subId));
      setPage(1);
    } catch (e) {
      console.error("onSubClick:", e);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">Loading …</div>
    </div>
  );

  if (!familyId) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="rounded-lg shadow p-6">
          <div className="text-lg font-semibold mb-2">No family selected</div>
          <div className="text-sm text-slate-600">Please select a family from the Families list first.</div>
          <div className="mt-4">
            <button onClick={() => navigate("/family")} className="px-4 py-2 bg-blue-600 text-white rounded">Go to families</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white flex items-center gap-2 text-sm text-slate-700"><ArrowLeft size={16} /> Back</button>
          </div>

          <div className="flex items-center flex-col">
            <h1 className="text-2xl font-semibold text-slate-800">Family Options Updates</h1>
          </div>

          <div style={{ width: 120 }} />
        </div>

        {/* ====== Family activity chart (placed above timeline) ====== */}
        <div className="mb-6">
          {showLogsChart ? (
            logsLoading ? (
              <div className="text-sm text-gray-600 py-2">Loading activity chart…</div>
            ) : logsError ? (
              <div className="text-sm text-red-600 py-2">{logsError}</div>
            ) : (
              <LogsLineChart items={logsItems} />
            )
          ) : (
            <div className="text-sm text-gray-400 italic mb-4">Activity chart (family) hidden while server-side filters are active.</div>
          )}
        </div>

        {/* TIMELINE */}
        <div className="rounded-lg border p-4 mb-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-lg font-semibold text-gray-700">Stages Of Options</h4>
              <div className="text-xs text-gray-400">Click a stage to filter updates by that stage.</div>
            </div>
            <div className="flex items-center gap-2">
              {stageFilter ? (
                <div className="text-sm text-slate-600">Filtered: <span className="font-medium ml-2">{stageFilter}</span></div>
              ) : (
                <div className="text-sm text-slate-400">No stage filter</div>
              )}
              {stageFilter && <button onClick={() => { setStageFilter(""); setPage(1); }} className="px-2 py-1 bg-white border rounded">Clear</button>}
            </div>
          </div>

          <div>
            {timelineLoading && <div className="text-sm text-gray-500">Loading timeline…</div>}
            {timelineError && <div className="text-sm text-red-500">Error: {timelineError}</div>}
            {!timelineLoading && (!timelineStages || timelineStages.length === 0) && (
              <div className="text-sm text-gray-500">No timeline available for this family.</div>
            )}

            {!timelineLoading && timelineStages.length > 0 && (
              <div className="relative">
                <div className="h-1 bg-gray-200 rounded-full w-full absolute" style={{ top: "32px", left: 0, right: 0, zIndex: 0 }} aria-hidden="true" />
                <div className="h-1 rounded-full absolute" style={{ top: "32px", left: 0, width: `${completedLinePercent}%`, backgroundColor: "#2563eb", zIndex: 1, transition: "width 240ms ease" }} aria-hidden="true" />
                <div className="flex justify-between items-start relative z-10">
                  {timelineStages.map((stage, idx) => {
                    const isBefore = idx <= lastCompletedIndex - 0;
                    const isCurrent = idx === currentIndex && !stage.completed;
                    const isCompleted = stage.completed || isBefore;
                    const selected = String(stageFilter) && (String(stageFilter) === String(stage.id) || String(stageFilter) === String(stage.stageId) || String(stageFilter).toLowerCase() === String(stage.name).toLowerCase());
                    const circleClass = selected
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-200"
                      : (isCompleted ? "bg-blue-600 text-white" : isCurrent ? "bg-white text-blue-600 border-2 border-blue-600 shadow-sm" : "bg-white text-gray-400 border border-gray-300");

                    return (
                      <div key={stage.id ?? idx} className="flex flex-col items-center w-full max-w-[220px] relative" style={{ width: `${100 / Math.max(1, timelineStages.length)}%`, maxWidth: 220 }}>
                        <div className="h-16 flex items-center justify-center">
                          <button
                            onMouseEnter={() => handleCircleEnter(idx)}
                            onMouseLeave={() => handleCircleLeave(idx)}
                            onClick={() => onStageClick(stage, idx)}
                            title={stage.name}
                            className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition ${circleClass}`}
                          >
                            {isCompleted ? <CheckCircle className="w-5 h-5 text-white" /> : <span className={`font-semibold text-sm ${isCurrent ? "text-blue-600" : "text-gray-400"}`}>{idx + 1}</span>}
                          </button>
                        </div>

                        <div className={`mt-2 text-center text-sm truncate ${isCompleted || isCurrent ? "text-slate-800" : "text-gray-400"}`}>
                          {stage.name}
                        </div>

                        {hoveredIndex === idx && Array.isArray(stage.subStages) && stage.subStages.length > 0 && (
                          <div className="absolute left-1/2 -translate-x-1/2 top-[92px] z-50 w-64 rounded-lg shadow-lg p-2 text-sm" style={{ backgroundColor: "rgba(255,255,255,0.98)", border: "1px solid rgba(0,0,0,0.06)" }} onMouseEnter={handlePopupEnter} onMouseLeave={handlePopupLeave} role="dialog" aria-label={`Sub-stages for ${stage.name}`}>
                            <div className="max-h-44 overflow-auto space-y-1 pr-2">
                              {stage.subStages.map((ss, sidx) => {
                                const completedSub = ss.completed ?? false;
                                const itemClass = completedSub ? "bg-blue-50 text-blue-800 rounded px-2 py-1" : "bg-white text-gray-700 rounded px-2 py-1";
                                return (
                                  <div key={String(ss.subStageId ?? ss.id ?? sidx)} className={`flex items-center justify-between ${itemClass}`} title={ss.name} onClick={(e) => { e.stopPropagation(); onSubClick(stage, ss); }} style={{ cursor: "pointer" }}>
                                    <div className="truncate text-xs">{ss.name}</div>
                                    <div className="text-xs text-gray-400">{completedSub ? "✓" : ""}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-yellow-100 border rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end mb-4">
          <div className="flex flex-col">
            <label className="text-xs text-slate-600">Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="mt-1 px-3 py-2 border rounded-md shadow-sm">
              <option value="">ALL</option>
              <option value="1">Forest Guard</option>
              <option value="2">Range Assistant</option>
              <option value="3">Range Officer</option>
              <option value="4">Assistant Director</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-slate-600">From date</label>
            <input type="date" value={fromDateFilter} onChange={(e) => { setFromDateFilter(e.target.value); setPage(1); }} className="mt-1 px-3 py-2 border rounded-md shadow-sm" />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-slate-600">To date</label>
            <input type="date" value={toDateFilter} onChange={(e) => { setToDateFilter(e.target.value); setPage(1); }} className="mt-1 px-3 py-2 border rounded-md shadow-sm" />
          </div>

          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter name/notes/inserted by..." className="pl-9 pr-3 py-2 border rounded w-64" />
            <div className="absolute left-3 top-2.5 text-slate-400"><Search size={16} /></div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => { setPage(1); fetchUpdates(1, limit); }} className="px-4 py-2 bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-md">Apply</button>
            <button onClick={() => { setSearch(""); setNameFilter(""); setStatusFilter(""); setFromDateFilter(""); setToDateFilter(""); setStageFilter(""); setPage(1); fetchUpdates(1, limit); }} className="px-4 py-2 bg-white border rounded-md">Clear</button>
          </div>
        </div>

        {/* Pagination top */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-slate-600">
            <span className="text-sm px-3">Per page :</span>
            <select value={limit} onChange={async (e) => { const newLimit = Number(e.target.value) || 15; setLimit(newLimit); setPage(1); await fetchUpdates(1, newLimit); }} className="border rounded px-2 py-1">
              <option value={5}>5</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => gotoPage(page - 1)} disabled={page <= 1} className={`px-3 py-1 rounded ${page <= 1 ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}>Prev</button>
            <div className="flex items-center gap-1">{renderPageButtons()}</div>
            <button onClick={() => gotoPage(page + 1)} disabled={page >= Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)))} className={`px-3 py-1 rounded ${page >= Math.max(1, Math.ceil((totalCount || 0) / (limit || 1))) ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}>Next</button>
          </div>
        </div>

        {pageError && <div className="mb-3 text-sm text-red-600">Error: {pageError}</div>}

        {/* List (server-side filtered) */}
        {updatesLoading ? (
          <div className="text-sm text-slate-500">Loading updates…</div>
        ) : (updates || []).length === 0 ? (
          <div className="text-sm text-slate-500">No updates found.</div>
        ) : (
          <div className="space-y-4">
            {updates.map((u, idx) => {
              const key = u.updateId ?? u._id ?? u.id ?? `upd-${idx}`;
              const rawNotes = (u.notes || u.description || "");
              const shortNotes = rawNotes.replace(/\s+/g, " ").slice(0, 400);
              const isExpanded = expandedNotesFor === key;

              const stageName = resolveStageNameForUpdate(u);

              return (
                <motion.div
                  key={key}
                  ref={(el) => { if (el) updateRefs.current[key] = el; }}
                  tabIndex={0}
                  className={`relative overflow-hidden rounded-xl p-4 bg-blue-100 border border-slate-200 hover:shadow-lg transition transform hover:-translate-y-0.5 ${u.deleted ? "opacity-60" : ""}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-semibold text-slate-800 truncate">{u.name ?? u.updateName ?? `Update ${idx + 1}`}</div>
                            <div className="flex-shrink-0 flex items-center">
                              <StatusBadge status={u.status ?? 0} />
                              <StageBadge name={stageName} />
                            </div>
                          </div>

                          <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                            {isExpanded ? rawNotes : `${shortNotes}${rawNotes.length > 400 ? "…" : ""}`}
                          </div>

                          <div className="mt-2 text-xs text-slate-600">Inserted by <span className="font-medium">{u.insertedBy ?? "—"}</span><span className="mx-2">•</span><span>{fmtDate(u.insertedAt)}</span></div>

                          <div className="mt-1 text-xs text-slate-600">Verification: <span className="font-medium">{u.verifiedBy ?? "—"}</span><span className="mx-2">•</span><span>{fmtDate(u.verifiedAt)}</span></div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => openUpdateModalById(e, u.updateId ?? u._id ?? u.id)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-lg text-sm hover:scale-[1.01]">Status history</button>

                            <button onClick={(e) => openDocsModalById(e, u.updateId ?? u._id ?? u.id)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm hover:shadow-sm">
                              <ImageIcon size={16} /> <span>Docs</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {rawNotes.length > 400 && (
                              <button onClick={() => setExpandedNotesFor(isExpanded ? null : key)} className="text-sm px-3 py-1 rounded bg-white border">{isExpanded ? "Show less" : "Show more"}</button>
                            )}
                            <div className="text-xs text-slate-500">{u.deleted ? "Deleted" : ""}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="h-24" />
      </div>

      {/* Modal: Status history ONLY (no verification/details) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeModal} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-2xl mx-4">
            <div className="bg-[#f8f0dc] rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <div className="text-lg font-semibold">Status history</div>
                  <div className="text-xs text-slate-500">{modalLoading ? "Loading…" : (modalUpdate?.name ?? modalUpdate?.updateName ?? modalUpdate?.updateId ?? "Update")}</div>
                </div>
                <button onClick={closeModal} aria-label="Close" className="px-3 py-1 rounded bg-gray-100">Close</button>
              </div>

              <div className="p-4 max-h-[75vh] overflow-y-auto space-y-4">
                {modalLoading ? (
                  <div className="text-sm text-slate-500">Loading…</div>
                ) : modalUpdate ? (
                  <>
                    {Array.isArray(modalUpdate.statusHistory) && modalUpdate.statusHistory.length > 0 ? (
                      modalUpdate.statusHistory.map((h, i) => (
                        <div key={i} className="border flex justify-between rounded-lg p-3 bg-indigo-100">
                          <div>
                            <div className="font-medium">{h.comments ?? "—"}</div>
                            <div className="text-xs text-slate-500 mt-1">By {h.verifier ?? "—"} • {fmtDate(h.time)}</div>
                          </div>
                          <div className="px-3 py-1"><StatusBadge status={h.status} /></div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-600">No status history available.</div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-slate-500">No status history available.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document modal (reusable) */}
      <DocumentModal
        open={docsOpen}
        onClose={() => { setDocsOpen(false); setDocsDocs([]); setDocsTitle("Documents"); }}
        docs={docsDocs}
        title={docsTitle}
        loading={docsLoading}
      />
    </div>
  );
}
