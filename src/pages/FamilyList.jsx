﻿// src/pages/FamilyList.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { AuthContext } from "../context/AuthContext";
import FamilyOverviewModal from "../component/FamilyOverviewModal";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";

function sanitizeFamilyId(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  const trimmed = s.replace(/^\/+|\/+$/g, "");
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : trimmed;
}

function FamilyCard({ family, onOpenModal }) {
  const photo = family.mukhiyaPhoto || "/images/default-avatar.png";
  const name = family.mukhiyaName || "Unknown";
  const rawFamilyId = family.familyId ?? family.id ?? family._id ?? "—";
  const displayFamilyId = String(rawFamilyId);
  const familyIdForNav = sanitizeFamilyId(rawFamilyId) ?? displayFamilyId;
  const optionRaw = family.relocationOption || family.relocation || "";
  const optionDisplay = optionRaw ? optionRaw.toString().replace(/_/g, " ") : "—";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-100 rounded-2xl p-4 shadow cursor-pointer hover:shadow-lg transition"
      onClick={() => onOpenModal(familyIdForNav)}
    >
      <div className="flex items-center gap-7">
        <img
          src={photo}
          onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
          alt={name}
          className="w-20 h-20 rounded-full object-cover border bg-gray-50"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-gray-800 truncate">{name}</div>
              <div className="text-xs text-gray-500 mt-1 truncate">
                ID: <span className="font-medium text-gray-700">{displayFamilyId}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">
                Option: <span className="font-medium text-gray-700">{optionDisplay}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal(familyIdForNav);
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                View Family
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function FamilyList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);

  const queryVillageId = searchParams.get("villageId");
  const [storedVillageId, setStoredVillageId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("villageId") : null
  );
  const effectiveVillageId = queryVillageId ?? storedVillageId;

  const [reloadKey, setReloadKey] = useState(0);

  const openParam = (searchParams.get("open") ?? "").toLowerCase();
  const normalizedOpen =
    openParam === "option1" || openParam === "1" || openParam === "option-1"
      ? "Option_1"
      : openParam === "option2" || openParam === "2" || openParam === "option-2"
      ? "Option_2"
      : openParam === "all"
      ? "All"
      : null;
  const [filterOption, setFilterOption] = useState(normalizedOpen ?? "All");

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const p = Number(searchParams.get("limit"));
    return [5, 10, 15, 25, 50].includes(p) ? p : 15;
  });
  const [totalCount, setTotalCount] = useState(null);

  const [search, setSearch] = useState(() => searchParams.get("mukhiyaName") || "");
  const searchDebounceRef = useRef(null);

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const optionAllRef = useRef(null);
  const option1Ref = useRef(null);
  const option2Ref = useRef(null);
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);

  // chart state (existing analytics)
  const [chartData, setChartData] = useState([]);
  const [chartKeys, setChartKeys] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null); // we won't show this in UI

  // ----------------- Logs (family activity) state + abort + cache -----------------
  const [logsItems, setLogsItems] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const logsControllerRef = useRef(null);
  const logsCacheRef = useRef({}); // keyed by village|filter|search

  function authHeaders() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
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

  // Chart renderer — simple SVG line + area chart similar to other pages
  function LogsLineChart({ items }) {
    if (!items || items.length === 0) {
      return <div className="text-sm text-gray-500">No activity logs available to plot.</div>;
    }

    function normalizeAction(a) {
      if (!a) return "other";
      const lower = String(a).toLowerCase();
      if (lower.includes("delete")) return "Delete";
      if (lower.includes("edited") || lower.includes("edit") || lower.includes("update")) return "Edited";
      if (lower.includes("insert") || lower.includes("create") || lower.includes("added")) return "Insert";
      if (lower.includes("family") && lower.includes("insert")) return "Insert";
      if (lower.includes("family") && (lower.includes("edit") || lower.includes("updated") || lower.includes("edited"))) return "Edited";
      if (lower.includes("family") && lower.includes("delete")) return "Delete";
      return "other";
    }

    const byMonth = {};
    items.forEach((it) => {
      const timeStr = it.updateTime ?? it.update_time ?? it.time ?? it.createdAt ?? it.insertedAt ?? it.created_at ?? null;
      let monthKey = null;
      if (typeof timeStr === "string" && timeStr.length >= 7) {
        const m = timeStr.match(/^(\d{4})[-\/](\d{2})/);
        if (m) monthKey = `${m[1]}-${m[2]}`;
        else {
          const parsed = new Date(timeStr);
          if (!Number.isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const mm = String(parsed.getMonth() + 1).padStart(2, "0");
            monthKey = `${y}-${mm}`;
          }
        }
      } else if (timeStr instanceof Date) {
        const y = timeStr.getFullYear();
        const mm = String(timeStr.getMonth() + 1).padStart(2, "0");
        monthKey = `${y}-${mm}`;
      } else {
        const parsed = new Date(it.createdAt || it.time || it.insertedAt || Date.now());
        if (!Number.isNaN(parsed.getTime())) {
          const y = parsed.getFullYear();
          const mm = String(parsed.getMonth() + 1).padStart(2, "0");
          monthKey = `${y}-${mm}`;
        } else monthKey = "unknown";
      }
      if (!monthKey) monthKey = "unknown";
      if (!byMonth[monthKey]) byMonth[monthKey] = { Insert: 0, Edited: 0, Delete: 0 };
      const action = normalizeAction(it.action ?? it.event ?? it.type ?? it.activity ?? it.description ?? "");
      if (action === "Insert" || action === "Edited" || action === "Delete") {
        byMonth[monthKey][action] = (byMonth[monthKey][action] || 0) + 1;
      }
    });

    const months = Object.keys(byMonth).filter(k => k !== "unknown").sort((a, b) => a.localeCompare(b));
    if (months.length === 0) months.push("unknown");

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

  // debounce + fetch logs effect
  useEffect(() => {
    const key = `${effectiveVillageId || ""}|${filterOption || ""}|${search || ""}`;
    // Only show logs chart when no server-side filters active:
    // for FamilyList: require effectiveVillageId and filterOption === 'All' and empty search
    const showLogsChart = Boolean(effectiveVillageId) && (!filterOption || filterOption === "All") && (!search || search.trim() === "");

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
        params.append("type", "family"); // type is family
        if (effectiveVillageId) params.append("villageId", effectiveVillageId);
        params.append("page", "1");
        params.append("limit", String(Math.max(100, pageSize)));
        const url = `${API_BASE}/logs?${params.toString()}`;

        const { ok, status, json, text, aborted } = await fetchWithCreds(url, { method: "GET", signal: controller.signal, authHeaders: authHeaders() });
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
        if (err && err.name === "AbortError") return;
        console.error("fetch logs error:", err);
        setLogsError(err.message || "Failed to load logs");
        setLogsItems([]);
      } finally {
        if (mounted) setLogsLoading(false);
      }
    }, 420);

    return () => { mounted = false; clearTimeout(tid); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveVillageId, filterOption, search, pageSize]);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFamilyId, setModalFamilyId] = useState(null);

  useEffect(() => {
    function onStorage(e) {
      if (e.key === "villageId") setStoredVillageId(e.newValue);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    return () => {};
  }, []);

  useEffect(() => {
    const open = (searchParams.get("open") ?? "").toLowerCase();
    if (open === "option1" || open === "1" || open === "option-1") {
      setFilterOption("Option_1");
      setFilterMenuOpen(false);
      setTimeout(() => option1Ref.current?.focus(), 0);
    } else if (open === "option2" || open === "2" || open === "option-2") {
      setFilterOption("Option_2");
      setFilterMenuOpen(false);
      setTimeout(() => option2Ref.current?.focus(), 0);
    } else if (open === "all") {
      setFilterOption("All");
      setFilterMenuOpen(false);
      setTimeout(() => optionAllRef.current?.focus(), 0);
    } else if (open === "filter") {
      setFilterMenuOpen(true);
      setTimeout(() => optionAllRef.current?.focus(), 0);
    } else {
      setFilterOption("All");
      setFilterMenuOpen(false);
    }
  }, [searchParams]);

  function setOpenQueryToFilter() {
    const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
    qp.set("open", "filter");
    if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
    setSearchParams(qp, { replace: true });
  }

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    async function loadList() {
      setLoadingList(true);
      setListError(null);

      try {
        if (!effectiveVillageId) {
          throw new Error("No village selected. Please select a village from the dashboard.");
        }

        // Build headers + credentials
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const qp = new URLSearchParams();
        qp.set("page", String(page));
        qp.set("limit", String(pageSize));
        if (filterOption && filterOption !== "All") qp.set("optionId", filterOption);
        if (search && search.trim().length > 0) qp.set("mukhiyaName", search.trim());

        const url = `${API_BASE}/villages/${encodeURIComponent(effectiveVillageId)}/beneficiaries?${qp.toString()}`;

        const res = await fetch(url, {
          method: "GET",
          headers,
          signal: ctrl.signal,
          credentials: "include",
        });

        if (!res.ok) {
          let bodyText = "";
          try {
            const tmp = await res.json();
            bodyText = tmp && tmp.message ? `: ${tmp.message}` : "";
          } catch {
            try {
              bodyText = `: ${await res.text()}`;
            } catch {}
          }
          throw new Error(`Failed to fetch beneficiaries (${res.status})${bodyText}`);
        }

        const data = await res.json().catch(() => null);
        const list = (data && Array.isArray(data.result) ? data.result : Array.isArray(data) ? data : (data && Array.isArray(data.result) ? data.result : []));

        let total = null;
        if (data && typeof data.totalCount === "number") total = data.totalCount;
        else if (data && typeof data.total === "number") total = data.total;
        else if (data && typeof data.count === "number") total = data.count;
        else {
          const hdr = res.headers.get("X-Total-Count");
          if (hdr) {
            const n = Number(hdr);
            if (!Number.isNaN(n)) total = n;
          }
        }

        if (!mounted) return;
        setBeneficiaries(list || []);
        setTotalCount(total !== null ? total : null);
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError") setListError(err.message || "Unable to load beneficiaries.");
      } finally {
        if (mounted) setLoadingList(false);
      }
    }

    loadList();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [effectiveVillageId, reloadKey, page, pageSize, filterOption, search]);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target) && !filterBtnRef.current?.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
      if (search) qp.set("mukhiyaName", search);
      else qp.delete("mukhiyaName");
      if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
      setSearchParams(qp, { replace: true });
    }, 450);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  // prettier, formal tooltip component
  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    const entry = payload[0];
    return (
      <div className="bg-white p-3 shadow rounded text-sm" style={{ minWidth: 140 }}>
        <div className="font-semibold text-gray-800 mb-1">{label}</div>
        <div className="text-gray-600">Count: <span className="font-medium text-gray-900">{new Intl.NumberFormat().format(entry.value)}</span></div>
      </div>
    );
  }

  useEffect(() => {
    let mounted = true;

    async function fetchAnalyticsForOption(optionKey) {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = `${API_BASE}/analytics/options/${encodeURIComponent(optionKey)}${effectiveVillageId ? `?villageId=${encodeURIComponent(effectiveVillageId)}` : ""}`;
      const res = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include",
      });
      if (!res.ok) {
        try {
          const tmp = await res.json();
          console.error("Analytics fetch unexpected status:", res.status, tmp);
        } catch {
          try {
            const txt = await res.text();
            console.error("Analytics fetch unexpected status:", res.status, txt);
          } catch (e) {
            console.error("Analytics fetch unexpected status and failed to parse body", e);
          }
        }
        return { stages: [] };
      }
      const json = await res.json().catch(() => ({}));
      return (json && json.result) ? json.result : json;
    }

    async function loadChart() {
      if (!filterOption || filterOption === "All") {
        if (mounted) {
          setChartData([]);
          setChartKeys([]);
          setChartError(null);
          setChartLoading(false);
        }
        return;
      }

      setChartLoading(true);
      setChartError(null);
      setChartData([]);
      setChartKeys([]);

      try {
        const resp = await fetchAnalyticsForOption(filterOption);
        const stages = Array.isArray(resp?.stages) ? resp.stages : [];

        const data = stages.map((s) => ({
          name: (s && (s.name || s.id)) || "—",
          count: Number(s.count || 0),
        }));

        if (!mounted) return;

        const hasNonZero = data.some(d => Number(d.count) > 0);
        if (!data.length || !hasNonZero) {
          setChartData([]);
          setChartKeys([filterOption]);
          setChartError(null);
        } else {
          setChartData(data);
          setChartKeys([filterOption]);
          setChartError(null);
        }
      } catch (err) {
        console.error("Analytics fetch failed:", err);
        if (!mounted) return;
        setChartData([]);
        setChartKeys([]);
        setChartError(null);
      } finally {
        if (mounted) setChartLoading(false);
      }
    }

    loadChart();
    return () => {
      mounted = false;
    };
  }, [filterOption, effectiveVillageId]);

  // Navigate to family details page
  const navigateToFamilyDetails = (familyId) => {
    if (familyId === undefined || familyId === null) {
      console.error("No familyId provided to navigation");
      return;
    }
    const fid = String(sanitizeFamilyId(familyId) ?? familyId);
    try { localStorage.setItem("selectedFamilyId", fid); localStorage.setItem("familyId", fid); } catch (e) { console.warn("Could not persist selectedFamilyId to localStorage", e); }
    try {
      if (auth) {
        if (typeof auth.setSelectedFamilyId === "function") auth.setSelectedFamilyId(fid);
        else if (typeof auth.setFamilyId === "function") auth.setFamilyId(fid);
        else if (typeof auth.setSelectedFamily === "function") auth.setSelectedFamily(fid);
      }
    } catch (e) { console.warn("AuthContext update error:", e); }

    setModalOpen(false);
    setModalFamilyId(null);

    navigate(`/families`, { state: { familyId: fid } });
  };

  const refresh = () => setReloadKey((k) => k + 1);

  if (!effectiveVillageId) {
    return (
      <div className="min-h-screen bg-[#f8f0dc] font-sans">
        <header className="bg-[#a7dec0] shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/logo.png" alt="logo" className="w-16 h-16 object-contain" />
              <h1 className="text-2xl font-bold text-black">
                Tilai Dabra Beneficiaries - <span className="text-green-800">Family List</span>
              </h1>
            </div>
            <div className="text-right">
              <div className="text-[#4a3529] font-bold text-2xl leading-none">माटी</div>
              <div className="text-sm text-[#4a3529] tracking-wider">MAATI</div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-6">
          <div className="bg-white rounded-xl p-6 shadow text-center">
            <p className="text-sm text-gray-700">No village selected. Please select a village from the dashboard first.</p>
          </div>
        </main>
      </div>
    );
  }

  const shouldShowChartBox = filterOption !== "All";
  const startIndex = totalCount !== null ? (totalCount === 0 ? 0 : (page - 1) * pageSize + 1) : (beneficiaries.length === 0 ? 0 : (page - 1) * pageSize + 1);
  const endIndex = startIndex === 0 ? 0 : startIndex + beneficiaries.length - 1;
  const totalPages = totalCount !== null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;

  function gotoPage(p) {
    const np = Math.max(1, Math.min(totalPages || p, Number(p) || 1));
    if (np === page) return;
    setPage(np);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  }

  function renderPageButtons() {
    if (totalPages !== null) {
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

      return (
        <div className="flex items-center gap-2">
          <button onClick={() => gotoPage(page - 1)} disabled={page <= 1} className={`px-3 py-1 rounded ${page <= 1 ? 'bg-gray-100 text-gray-400' : 'bg-white border'}`}>Prev</button>
          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === 'left-ellipsis' || p === 'right-ellipsis') return <span key={`e-${idx}`} className="px-3 py-1">…</span>;
              return (
                <button
                  key={p}
                  onClick={() => gotoPage(p)}
                  className={`px-3 py-1 rounded ${p === page ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages} className={`px-3 py-1 rounded ${page >= totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white border'}`}>Next</button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button onClick={() => gotoPage(page - 1)} disabled={page <= 1} className={`px-3 py-1 rounded ${page <= 1 ? 'bg-gray-100 text-gray-400' : 'bg-white border'}`}>Prev</button>
        <div className="text-sm px-2">Page {page}</div>
        <button onClick={() => { if (beneficiaries.length < pageSize) return; gotoPage(page + 1); }} disabled={beneficiaries.length < pageSize} className={`px-3 py-1 rounded ${beneficiaries.length < pageSize ? 'bg-gray-100 text-gray-400' : 'bg-white border'}`}>Next</button>
      </div>
    );
  }

  const openOverviewModal = (fid) => {
    setModalFamilyId(String(fid));
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <div>
        <MainNavbar village={effectiveVillageId} showInNavbar={true} />
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
          <button onClick={() => navigate("/home")} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm">← Back</button>

          <div className="flex items-center gap-3">
            <div className="relative"
                 onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } setFilterMenuOpen(true); setOpenQueryToFilter(); setTimeout(() => optionAllRef.current?.focus(), 50); }}
                 onMouseLeave={() => { closeTimerRef.current = setTimeout(() => setFilterMenuOpen(false), 150); }}>
              <button ref={filterBtnRef} aria-haspopup="true" aria-expanded={filterMenuOpen} onFocus={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } setFilterMenuOpen(true); setOpenQueryToFilter(); }} onBlur={() => { setTimeout(() => { if (!menuRef.current) return; const active = document.activeElement; if (!menuRef.current.contains(active) && !filterBtnRef.current?.contains(active)) { setFilterMenuOpen(false); } }, 10); }} className="inline-flex items-center gap-2 p-2 bg-white border rounded-lg shadow hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400">
                <SlidersHorizontal size={18} />
              </button>

              {filterMenuOpen && (
                <div ref={menuRef} role="menu" aria-label="Filter options" className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg z-50 py-2">
                  <button ref={optionAllRef} role="menuitem" onClick={() => { setFilterOption("All"); setFilterMenuOpen(false); setPage(1); const qp = new URLSearchParams(Object.fromEntries(searchParams.entries())); qp.set("open", "all"); if (effectiveVillageId) qp.set("villageId", effectiveVillageId); setSearchParams(qp, { replace: true }); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "All" ? "font-semibold" : ""}`}>All Families</button>
                  <button ref={option1Ref} role="menuitem" onClick={() => { setFilterOption("Option_1"); setFilterMenuOpen(false); setPage(1); const qp = new URLSearchParams(Object.fromEntries(searchParams.entries())); qp.set("open", "option1"); if (effectiveVillageId) qp.set("villageId", effectiveVillageId); setSearchParams(qp, { replace: true }); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "Option_1" ? "font-semibold" : ""}`}>Option 1 Families</button>
                  <button ref={option2Ref} role="menuitem" onClick={() => { setFilterOption("Option_2"); setFilterMenuOpen(false); setPage(1); const qp = new URLSearchParams(Object.fromEntries(searchParams.entries())); qp.set("open", "option2"); if (effectiveVillageId) qp.set("villageId", effectiveVillageId); setSearchParams(qp, { replace: true }); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "Option_2" ? "font-semibold" : ""}`}>Option 2 Families</button>
                </div>
              )}
            </div>

            <input type="text" placeholder="Search by mukhiya name" value={search} onChange={(e) => setSearch(e.target.value)} className="px-4 py-2 border rounded-md shadow-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">{totalCount !== null ? <>{totalCount === 0 ? 0 : startIndex}–{endIndex} of {totalCount}</> : <>Page {page}</>}</div>
            <div className="flex items-center gap-2 text-sm">
              <div className="text-xs text-gray-500">Page size</div>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="p-1 border rounded">{[5,10,15,25,50].map(n => <option key={n} value={n}>{n}</option>)}</select>
            </div>
          </div>

          <div>{renderPageButtons()}</div>
        </div>

        {/* ----------------- Family activity logs chart (placed between pagination and cards) ----------------- */}
        <div className="mb-6 w-full">
          { (Boolean(effectiveVillageId) && (!filterOption || filterOption === "All") && (!search || search.trim() === "")) ? (
            logsLoading ? (
              <div className="h-36 flex items-center justify-center text-sm text-gray-600">Loading activity chart…</div>
            ) : logsError ? (
              <div className="h-36 flex items-center justify-center text-sm text-red-600">{logsError}</div>
            ) : (
              <LogsLineChart items={logsItems} />
            )
          ) : (
            <div className="text-sm text-gray-400 italic mb-4">Activity chart (family) hidden while server-side filters are active.</div>
          )}
        </div>

        {/* existing analytics box (optional, shows when filterOption != All) */}
        {shouldShowChartBox && (
          <div className="mb-6 w-full bg-white rounded-xl p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800">Stage analytics</div>
              <div className="text-xs text-gray-500">{chartKeys.length ? `${chartKeys[0].toString().replace(/_/g, " ")}` : filterOption.replace(/_/g, " ")}</div>
            </div>

            <div className="h-64">
              {chartLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-600">Loading chart…</div>
              ) : chartData && chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 12, right: 24, left: 8, bottom: 48 }}
                    barCategoryGap="20%"
                  >
                    <defs>
                      <linearGradient id="gradChart" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#4338ca" stopOpacity="0.95" />
                      </linearGradient>
                      <filter id="softShadow" x="-20%" y="-50%" width="140%" height="200%">
                        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.12"/>
                      </filter>
                    </defs>

                    <CartesianGrid stroke="#e9e9f0" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#374151" }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={64}
                    />
                    <YAxis
                      tickFormatter={(v) => Number.isInteger(v) ? v : v}
                      tick={{ fontSize: 12, fill: "#374151" }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="square"
                      wrapperStyle={{ paddingTop: 6, paddingRight: 6, fontSize: 12 }}
                    />
                    <Bar
                      dataKey="count"
                      name={chartKeys[0] ? chartKeys[0].toString().replace(/_/g, " ") : "Count"}
                      fill="url(#gradChart)"
                      radius={[10, 10, 4, 4]}
                      animationDuration={800}
                      barSize={28}
                    >
                      <LabelList dataKey="count" position="top" formatter={(val) => new Intl.NumberFormat().format(val)} style={{ fontSize: 12, fill: "#111827", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">No analytics available.</div>
              )}
            </div>
          </div>
        )}

        {listError && <div className="text-sm text-red-600 mb-4">{listError}</div>}
        {loadingList ? (
          <div className="py-8 text-center text-sm text-gray-600">Loading families…</div>
        ) : (
          <>
            {beneficiaries.length === 0 ? (
              <div className="text-sm text-gray-600">No families found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {beneficiaries.map((family) => (
                  <FamilyCard key={family.familyId ?? family.id ?? family._id} family={family} onOpenModal={openOverviewModal} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <FamilyOverviewModal
        familyId={modalFamilyId}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setModalFamilyId(null); }}
        onShowDetails={(fid) => navigateToFamilyDetails(fid)}
      />
    </div>
  );
}
