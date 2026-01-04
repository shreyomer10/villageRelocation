// src/pages/PlotsPage.jsx
// House listing page with optional AuthContext storage and home-count analytics bar chart
import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { AuthContext } from "../context/AuthContext"; // expected to exist in your project

export default function PlotsPage() {
  const navigate = useNavigate();
  const villageId = localStorage.getItem("villageId") || "";

  const authCtx = useContext(AuthContext);

  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15); // default page size
  const [totalCount, setTotalCount] = useState(null);

  // types (buildings) fetched from API — kept because cards rely on this
  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // filters / search (single combined field for mukhiyaName OR familyId)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchTimer = useRef(null);

  // numberOfHome filter (optional)
  const [numberOfHomeFilter, setNumberOfHomeFilter] = useState(""); // expects "1","2","3" or empty

  // deleted view toggle (server-side)
  const [showDeleted, setShowDeleted] = useState(false);

  // analytics (home count) — shown only when no filter applied and showDeleted is false
  const [homeAnalytics, setHomeAnalytics] = useState(null);
  const [homeAnalyticsLoading, setHomeAnalyticsLoading] = useState(false);
  const [homeAnalyticsError, setHomeAnalyticsError] = useState(null);

  // logs (for line chart)
  const [logsItems, setLogsItems] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [logsTotalCount, setLogsTotalCount] = useState(null);

  // helper for auth headers
  function authHeaders() {
    const token = localStorage.getItem("token");
    return token
      ? { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json", Accept: "application/json" };
  }

  // fetch wrapper
  async function fetchWithCreds(url, opts = {}) {
    try {
      const headers = { ...(authHeaders() || {}), ...(opts.headers || {}) };
      const res = await fetch(url, {
        credentials: "include",
        headers,
        ...opts,
      });

      const text = await res.text().catch(() => "");
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        json = null;
      }

      return { res, ok: res.ok, status: res.status, json, text };
    } catch (err) {
      return { res: null, ok: false, status: 0, json: null, text: String(err) };
    }
  }
  // -------------------------------------------------------------------------

  // load types (buildings) for internal use in cards (kept — cards use these details)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setTypesLoading(true);
      try {
        if (!villageId) {
          setTypes([]);
          return;
        }
        const url = `${API_BASE}/buildings/${encodeURIComponent(villageId)}`;
        const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

        if (!mounted) return;

        if (!ok) {
          if (status === 404) {
            setTypes([]);
            return;
          }
          if (status === 401) {
            setError((json && (json.message || json.error)) || text || "Unauthorized — please sign in");
            return;
          }
          throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch building types: ${status}`);
        }

        const payload = json ?? {};
        const items = payload?.result?.items ?? (Array.isArray(payload) ? payload : (payload.items ?? []));
        if (!mounted) return;
        setTypes(items);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(err.message || "Failed to load building types");
      } finally {
        if (mounted) setTypesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [villageId]);

  // reset page to 1 when village changes
  useEffect(() => {
    setPage(1);
  }, [villageId]);

  // reset page to 1 when any filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, showDeleted, pageSize, numberOfHomeFilter]);

  // fetch when page, pageSize or villageId changes OR when filters change
  useEffect(() => {
    fetchPlots(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, page, pageSize, debouncedQuery, showDeleted, numberOfHomeFilter]);

  // debounced search for server-side name/family filter
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => setDebouncedQuery(searchQuery.trim()),
      300
    );
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  async function fetchPlots(requestPage = 1) {
    if (!villageId) {
      setError("Missing villageId (store it as localStorage 'villageId')");
      setPlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", String(requestPage));
      params.append("limit", String(pageSize));

      // Combined filter behavior:
      // - if debouncedQuery contains whitespace -> treat as mukhiyaName (regex search)
      // - if debouncedQuery is a single token (alphanumeric/underscore/hyphen) -> treat as familyId
      if (debouncedQuery) {
        const q = debouncedQuery;
        const hasSpace = /\s/.test(q);
        const singleTokenIdLike = /^[A-Za-z0-9_\-]+$/.test(q);

        if (hasSpace) {
          // likely a name (multiple words) -> send as mukhiyaName (regex)
          params.append("mukhiyaName", q);
        } else if (singleTokenIdLike) {
          // single token (no spaces) -> treat as familyId
          params.append("familyId", q);
        } else {
          // fallback to name search
          params.append("mukhiyaName", q);
        }
      }

      // numberOfHome filter (backend expects 'numberOfHome' values 1/2/3)
      if (numberOfHomeFilter) {
        params.append("numberOfHome", numberOfHomeFilter);
      }

      // deleted must be "1" or "0"
      params.append("deleted", showDeleted ? "1" : "0");

      const url = `${API_BASE}/house/${encodeURIComponent(villageId)}?${params.toString()}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

      if (!ok) {
        if (status === 404) {
          setPlots([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        if (status === 401) {
          setError((json && (json.message || json.error)) || text || "Unauthorized — please sign in");
          setPlots([]);
          setLoading(false);
          return;
        }
        throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch houses: ${status}`);
      }

      const payload = json ?? {};

      let items = [];
      let respPage = requestPage;
      let respLimit = pageSize;
      let respCount = null;

      if (payload.result) {
        const r = payload.result;
        items = r.items ?? (Array.isArray(r) ? r : []);
        respPage = r.page ?? r.pageNo ?? payload.page ?? requestPage;
        respLimit = r.limit ?? payload.limit ?? pageSize;
        respCount = r.count ?? payload.count ?? null;
      } else {
        items = payload.items ?? (Array.isArray(payload) ? payload : []);
        respPage = payload.page ?? requestPage;
        respLimit = payload.limit ?? pageSize;
        respCount = payload.count ?? null;
      }

      setPlots(items || []);
      setPage(Number(respPage ?? requestPage));
      setPageSize(Number(respLimit ?? pageSize));
      setTotalCount(respCount !== null ? Number(respCount) : null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching houses");
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }

  // --- HOME-COUNT ANALYTICS: fetch only when NO filters applied and showDeleted is false ---
  useEffect(() => {
    let mounted = true;

    async function fetchHomeCountAnalytics() {
      // Only show analytics when no filters are applied and showDeleted is false
      const noFilters = !debouncedQuery && !numberOfHomeFilter;
      if (!noFilters || showDeleted) {
        if (mounted) {
          setHomeAnalytics(null);
          setHomeAnalyticsError(null);
          setHomeAnalyticsLoading(false);
        }
        return;
      }

      if (!villageId) {
        if (mounted) {
          setHomeAnalytics(null);
          setHomeAnalyticsError("Missing villageId");
          setHomeAnalyticsLoading(false);
        }
        return;
      }

      if (mounted) {
        setHomeAnalyticsLoading(true);
        setHomeAnalyticsError(null);
      }

      try {
        const url = `${API_BASE}/analytics/house/${encodeURIComponent(villageId)}/home-count`;
        const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

        if (!mounted) return;

        if (!ok) {
          if (status === 404) {
            setHomeAnalytics(null);
            setHomeAnalyticsError("No analytics available");
            setHomeAnalyticsLoading(false);
            return;
          }
          if (status === 401) {
            setHomeAnalytics(null);
            setHomeAnalyticsError((json && (json.message || json.error)) || text || "Unauthorized — please sign in");
            setHomeAnalyticsLoading(false);
            return;
          }
          throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch analytics: ${status}`);
        }

        const payload = json ?? {};
        const result = payload.result ?? payload;

        const stats = result?.homeCountStats ?? null;
        if (!stats || typeof stats !== "object") {
          setHomeAnalytics(null);
          setHomeAnalyticsError(null);
        } else {
          // transform { "1": 2, "2": 5, "3": 0 } => stages array
          const stages = ["1", "2", "3"].map((k) => ({
            name: `${k} home${k === "1" ? "" : "s"}`,
            count: Number(stats[k] ?? 0),
            id: `homecount_${k}`,
          }));
          setHomeAnalytics({
            buildingName: "Home counts",
            mode: "home-count",
            stages,
            villageId: result.villageId ?? villageId,
          });
          setHomeAnalyticsError(null);
        }
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setHomeAnalytics(null);
        setHomeAnalyticsError(err.message || "Failed to load analytics");
      } finally {
        if (mounted) setHomeAnalyticsLoading(false);
      }
    }

    fetchHomeCountAnalytics();

    return () => {
      mounted = false;
    };
  }, [debouncedQuery, numberOfHomeFilter, showDeleted, villageId]);

  // --- LOGS: fetch logs for line chart (type=Houses & villageId) ---
  // Uses same page & pageSize for pagination as requested. Chart hidden when any filter is active.
  useEffect(() => {
    let mounted = true;

    // hide/clear logs when filters are applied (chart must not show)
    if (!villageId || debouncedQuery || numberOfHomeFilter || showDeleted) {
      if (mounted) {
        setLogsItems([]);
        setLogsTotalCount(null);
        setLogsError(null);
        setLogsLoading(false);
      }
      return;
    }

    (async () => {
      setLogsLoading(true);
      setLogsError(null);
      try {
        const params = new URLSearchParams();
        // per your instruction: type will be "Houses"
        params.append("type", "Houses");
        params.append("villageId", villageId);
        params.append("page", String(page));
        params.append("limit", String(pageSize));

        const url = `${API_BASE}/logs?${params.toString()}`;
        const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

        if (!mounted) return;

        if (!ok) {
          if (status === 404) {
            setLogsItems([]);
            setLogsTotalCount(0);
            setLogsLoading(false);
            return;
          }
          if (status === 401) {
            setLogsError((json && (json.message || json.error)) || text || "Unauthorized — please sign in");
            setLogsItems([]);
            setLogsLoading(false);
            return;
          }
          throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch logs: ${status}`);
        }

        const payload = json ?? {};
        const result = payload.result ?? payload;
        const items = result.items ?? (Array.isArray(result) ? result : []);
        const count = result.count ?? payload.count ?? null;

        setLogsItems(items);
        setLogsTotalCount(count !== null ? Number(count) : null);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setLogsError(err.message || "Error fetching logs");
        setLogsItems([]);
      } finally {
        if (mounted) setLogsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [villageId, page, pageSize, debouncedQuery, numberOfHomeFilter, showDeleted]);

  // toggle deleted view
  function toggleDeletedView() {
    setShowDeleted((s) => !s);
    setPage(1);
  }

  // type name renderer uses fetched `types` first (if available), then falls back to server-provided fields
  function typeNameFor(typeId, plot = null) {
    const t = (types || []).find(
      (x) =>
        (x.typeId ?? x.type_id ?? x.id ?? x.optionId) === typeId ||
        String(x.typeId) === String(typeId)
    );
    if (t && (t.name || t.label)) return t.name ?? t.label;
    // prefer directly provided name from plot if server included it
    if (plot && (plot.typeName || plot.type)) return plot.typeName || plot.type;
    return typeId ?? "-";
  }

  // pagination helpers
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : Math.max(1, Math.ceil((plots.length || 0) / pageSize));
  function goPage(n) {
    if (!n || n < 1) return;
    if (totalPages && n > totalPages) return;
    setPage(n);
  }

  // --- Feedback-style pagination rendering (Prev / numeric / Next with ellipses) ---
  function renderPageButtons() {
    const tp = totalPages || 1;
    const maxButtons = 7;
    const pages = [];

    if (tp <= maxButtons) {
      for (let i = 1; i <= tp; i++) pages.push(i);
    } else {
      const left = Math.max(2, page - 1);
      const right = Math.min(tp - 1, page + 1);
      pages.push(1);
      if (left > 2) pages.push("left-ellipsis");
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < tp - 1) pages.push("right-ellipsis");
      pages.push(tp);
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => goPage(page - 1)}
          disabled={page <= 1}
          className={`px-3 py-1 rounded ${page <= 1 ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}
        >
          Prev
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === "left-ellipsis" || p === "right-ellipsis") return <span key={`e-${idx}`} className="px-3 py-1">…</span>;
            return (
              <button
                key={p}
                onClick={() => goPage(p)}
                className={`px-3 py-1 rounded ${p === page ? "bg-indigo-600 text-white" : "bg-white border hover:bg-gray-50"}`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => goPage(page + 1)}
          disabled={page >= tp}
          className={`px-3 py-1 rounded ${page >= tp ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}
        >
          Next
        </button>
      </div>
    );
  }

  // store selection in AuthContext if available, otherwise fallback to localStorage
  function persistSelectedPlotToAuthContext(pid, preview) {
    try {
      if (authCtx) {
        // try common setter names (use whichever your AuthContext provides)
        if (typeof authCtx.setSelectedPlot === "function") {
          authCtx.setSelectedPlot(preview);
          return true;
        }
        if (typeof authCtx.setPlotId === "function") {
          authCtx.setPlotId(pid);
          // also store preview if context supports it
          if (typeof authCtx.setSelectedPlot === "function") authCtx.setSelectedPlot(preview);
          return true;
        }
        if (typeof authCtx.update === "function") {
          // generic update method: merge an object
          authCtx.update({ selectedPlot: preview, plotId: pid });
          return true;
        }
      }

      // fallback to localStorage
      localStorage.setItem("plotId", String(pid));
      localStorage.setItem("selectedPlot", JSON.stringify(preview));
      return true;
    } catch (e) {
      console.warn("persistSelectedPlotToAuthContext failed, falling back to localStorage", e);
      try { localStorage.setItem("plotId", String(pid)); localStorage.setItem("selectedPlot", JSON.stringify(preview)); } catch (_) {}
      return false;
    }
  }

  function selectPlot(plot) {
    try {
      const pid = plot.plotId ?? plot.id ?? plot._id ?? "";
      const preview = {
        plotId: pid,
        name: plot.name ?? null,
        familyId: plot.familyId ?? null,
        typeId: plot.typeId ?? null,
        villageId: plot.villageId ?? plot.village ?? null,
      };

      persistSelectedPlotToAuthContext(pid, preview);

      // navigate using route only — HomeDetailsPage will resolve id from AuthContext/localStorage
      navigate(`/house/one/${encodeURIComponent(pid)}`);
    } catch (e) {
      console.warn("Failed to save selected house to AuthContext/localStorage", e);
      navigate(`/house/one/${encodeURIComponent(plot.plotId ?? plot.id ?? plot._id ?? "")}`);
    }
  }

  function goToHouse(houseId, plot = null) {
    if (!houseId) return;
    try {
      const pid = plot?.plotId ?? plot?.id ?? plot?._id ?? null;
      if (pid) {
        const sp = { plotId: pid, name: plot?.name ?? null };
        persistSelectedPlotToAuthContext(pid, sp);
      }
      localStorage.setItem("houseId", String(houseId));
    } catch (e) {
      // ignore storage errors
    }
    navigate(`/house/one/${encodeURIComponent(houseId)}`);
  }

  const displayedPlots = plots || [];

  function getHomeId(h) {
    return h.houseId ?? h.homeId ?? h.id ?? h._id ?? h.house_id ?? null;
  }

  /* ------------------------------------------------------------------ */
  /* Attractive SVG bar chart for analytics (re-usable)                */
  function AnalyticsBarChart({ data }) {
    const gradientIdRef = useRef(`g_${Math.random().toString(36).slice(2, 9)}`);
    const shadowIdRef = useRef(`s_${Math.random().toString(36).slice(2, 9)}`);

    if (!data || !Array.isArray(data.stages) || data.stages.length === 0) {
      return <div className="text-sm text-gray-600">No analytics data available.</div>;
    }

    const stages = data.stages.map((s) => ({
      ...s,
      count: Number(s.count ?? 0),
      name: s.name ?? s.id ?? "Stage",
    }));

    const total = stages.reduce((acc, s) => acc + s.count, 0);
    let maxCount = Math.max(...stages.map((s) => s.count), 1);

    // Round up max to a nicer number for ticks (e.g., 1,2,5,10,20,50,100...)
    function niceMax(n) {
      if (n <= 10) return Math.max(1, Math.ceil(n));
      const pow = Math.pow(10, Math.floor(Math.log10(n)));
      const leading = Math.ceil(n / pow);
      if (leading <= 2) return 2 * pow;
      if (leading <= 5) return 5 * pow;
      return 10 * pow;
    }
    maxCount = niceMax(maxCount);

    const ticks = 5;
    const tickStep = Math.ceil(maxCount / ticks);
    const displayMax = tickStep * ticks;

    // layout
    const chartWidth = 820; // internal viewBox width
    const labelWidth = 210;
    const rightPadding = 24;
    const barMaxWidth = chartWidth - labelWidth - rightPadding;
    const rowHeight = 46;
    const height = stages.length * rowHeight + 64; // bottom space for x-axis

    // helpers for scaling
    const scaleX = (value) => {
      if (displayMax === 0) return 0;
      return Math.round((value / displayMax) * barMaxWidth);
    };

    // ensure at least some visual difference for small values
    const minBarPx = 6;

    return (
      <div className="bg-yellow-100 rounded-lg border p-4 shadow-sm w-full">
        <div className="overflow-auto">
          <svg
            width="100%"
            height={Math.min(420, height)}
            viewBox={`0 0 ${chartWidth} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`${data.buildingName ?? "Analytics"} bar chart`}
          >
            <defs>
              {/* gradient for bars */}
              <linearGradient id={gradientIdRef.current} x1="0" x2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
              </linearGradient>

              {/* subtle drop shadow */}
              <filter id={shadowIdRef.current} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0b1220" floodOpacity="0.12" />
              </filter>

              {/* label background */}
              <linearGradient id={`${gradientIdRef.current}_bg`} x1="0" x2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#eef2ff" />
              </linearGradient>
            </defs>

            {/* grid lines and x-axis ticks */}
            {Array.from({ length: ticks + 1 }).map((_, i) => {
              const x = labelWidth + Math.round((i / ticks) * barMaxWidth);
              const tickValue = i * tickStep;
              return (
                <g key={`g_tick_${i}`}>
                  <line x1={x} x2={x} y1={12} y2={height - 28} stroke="#e6eefb" strokeWidth="1" />
                  <text x={x} y={height - 10} textAnchor="middle" fontSize="11" fill="#475569" style={{ fontFamily: "Inter, system-ui, -apple-system" }}>
                    {tickValue}
                  </text>
                </g>
              );
            })}

            {/* bars */}
            {stages.map((s, idx) => {
              const y = 16 + idx * rowHeight;
              const barWidth = Math.max(minBarPx, scaleX(s.count));
              const label = s.name;
              const countText = String(s.count);

              // dynamic placement for count label (inside white/contrast logic)
              const inside = barWidth > 60;

              return (
                <g key={s.id ?? idx}>
                  {/* label area */}
                  <rect x="8" y={y + 6} width={labelWidth - 16} height={rowHeight - 12} rx={8} fill="transparent" />
                  <text x={12} y={y + 28} fontSize="13" fill="#0f172a" style={{ fontFamily: "Inter, system-ui, -apple-system" }}>
                    {label}
                  </text>

                  {/* bar background */}
                  <rect
                    x={labelWidth}
                    y={y + 10}
                    rx={10}
                    ry={10}
                    width={barMaxWidth}
                    height={rowHeight - 20}
                    fill="#f1f5f9"
                  />

                  {/* bar (animated) */}
                  <rect
                    x={labelWidth}
                    y={y + 10}
                    rx={10}
                    ry={10}
                    width="0"
                    height={rowHeight - 20}
                    fill={`url(#${gradientIdRef.current})`}
                    filter={`url(#${shadowIdRef.current})`}
                  >
                    <animate
                      attributeName="width"
                      from="0"
                      to={barWidth}
                      dur="700ms"
                      fill="freeze"
                    />
                  </rect>

                  {/* small rounded cap for nicer look (drawn over the animated bar) */}
                  <rect
                    x={labelWidth}
                    y={y + 10}
                    rx={10}
                    ry={10}
                    width={barWidth}
                    height={rowHeight - 20}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="0.6"
                  />

                  {/* count label */}
                  {inside ? (
                    <text
                      x={labelWidth + Math.min(barWidth - 8, barMaxWidth - 8)}
                      y={y + 28}
                      fontSize="12"
                      textAnchor="end"
                      fill="#ffffff"
                      style={{ fontFamily: "Inter, system-ui, -apple-system", fontWeight: 600 }}
                    >
                      {countText}
                    </text>
                  ) : (
                    <text
                      x={labelWidth + barWidth + 12}
                      y={y + 28}
                      fontSize="12"
                      textAnchor="start"
                      fill="#0f172a"
                      style={{ fontFamily: "Inter, system-ui, -apple-system", fontWeight: 600 }}
                    >
                      {countText}
                    </text>
                  )}
                </g>
              );
            })}

            {/* subtle bottom axis line */}
            <line x1={labelWidth} x2={labelWidth + barMaxWidth} y1={height - 32} y2={height - 32} stroke="#c7d2fe" strokeWidth="1.2" />

          </svg>
        </div>
      </div>
    );
  }
  /* ------------------------------------------------------------------ */

  // --- LogsLineChart component (renders line chart for Insert/Edited/Delete counts by month-year) ---
  function LogsLineChart({ items }) {
    // items: array of logs with { action, updateTime, ... }
    // We'll aggregate by month-year (YYYY-MM) and count occurrences for Insert, Edited, Delete.
    if (!items || items.length === 0) {
      return <div className="text-sm text-gray-500">No activity logs on this page to plot.</div>;
    }

    // helper to normalize action into one of three keys
    function normalizeAction(a) {
      if (!a) return "other";
      const lower = String(a).toLowerCase();
      if (lower.includes("delete")) return "Delete";
      if (lower.includes("edited") || lower.includes("edit")) return "Edited";
      if (lower.includes("insert")) return "Insert";
      return "other";
    }

    // aggregate counts by month-year
    const map = {}; // { "YYYY-MM": { Insert: n, Edited: n, Delete: n } }
    items.forEach((it) => {
      const timeStr = it.updateTime || it.update_time || "";
      // try to extract yyyy-mm from "YYYY-MM-DD ..." or "YYYY/MM/DD"
      let monthKey = null;
      if (typeof timeStr === "string" && timeStr.length >= 7) {
        // common format "YYYY-MM-DD"
        const m = timeStr.match(/^(\d{4})[-\/](\d{2})/);
        if (m) monthKey = `${m[1]}-${m[2]}`;
        else {
          // fallback: try parse Date
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
      }

      if (!monthKey) monthKey = "unknown";

      if (!map[monthKey]) map[monthKey] = { Insert: 0, Edited: 0, Delete: 0 };
      const act = normalizeAction(it.action);
      if (act === "Insert" || act === "Edited" || act === "Delete") {
        map[monthKey][act] = (map[monthKey][act] || 0) + 1;
      }
    });

    // create sorted months array (ascending)
    const months = Object.keys(map).filter(k => k !== "unknown").sort((a, b) => a.localeCompare(b));
    if (months.length === 0) months.push("unknown");

    // arrays of numbers for each action
    const insertSeries = months.map(m => map[m]?.Insert ?? 0);
    const editedSeries = months.map(m => map[m]?.Edited ?? 0);
    const deleteSeries = months.map(m => map[m]?.Delete ?? 0);

    const maxVal = Math.max(...insertSeries, ...editedSeries, ...deleteSeries, 1);

    // chart layout
    const width = 820;
    const height = 260;
    const paddingLeft = 72;
    const paddingRight = 24;
    const paddingTop = 24;
    const paddingBottom = 48;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    // scale helper
    const xForIndex = (i) => {
      if (months.length === 1) return paddingLeft + plotWidth / 2;
      return paddingLeft + (i / (months.length - 1)) * plotWidth;
    };
    const yForValue = (v) => {
      const frac = v / maxVal;
      return paddingTop + (1 - frac) * plotHeight;
    };

    // make path string function
    const makePath = (series) => {
      return series.map((val, idx) => {
        const x = xForIndex(idx);
        const y = yForValue(val);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(" ");
    };

    // colors
    const colors = {
      Insert: "#10b981", // green
      Edited: "#f59e0b", // amber
      Delete: "#ef4444", // red
    };

    // build tick values for y-axis (4 ticks)
    const ticks = 4;
    const tickVals = Array.from({ length: ticks + 1 }).map((_, i) => Math.round((i / ticks) * maxVal));

    return (
      <div className="bg-white rounded-lg border p-3 shadow-sm w-full">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-sm text-gray-600">Activity over time (page logs)</div>
            <div className="text-lg font-semibold">Insert / Edited / Delete — by month</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">Showing logs for page {page}</div>
            <div className="text-xs text-gray-400">• Chart hidden when filters active</div>
          </div>
        </div>

        <div className="overflow-auto">
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Logs line chart"
          >
            <defs>
              <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0b1220" floodOpacity="0.06" />
              </filter>
            </defs>

            {/* y axis grid lines & labels */}
            {tickVals.map((tv, i) => {
              const y = yForValue(tv);
              return (
                <g key={`tick_${i}`}>
                  <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="#eef2ff" strokeWidth="1" />
                  <text x={paddingLeft - 12} y={y + 4} fontSize="11" fill="#475569" textAnchor="end" style={{ fontFamily: "Inter, system-ui" }}>{tv}</text>
                </g>
              );
            })}

            {/* x-axis labels */}
            {months.map((m, i) => {
              const x = xForIndex(i);
              return (
                <g key={`x_${m}`}>
                  <text x={x} y={height - 18} fontSize="11" fill="#475569" textAnchor="middle" style={{ fontFamily: "Inter, system-ui" }}>
                    {m}
                  </text>
                </g>
              );
            })}

            {/* area under each line (subtle) */}
            {[
              { key: "Insert", series: insertSeries },
              { key: "Edited", series: editedSeries },
              { key: "Delete", series: deleteSeries }
            ].map(({ key, series }) => {
              const path = series.map((val, idx) => {
                const x = xForIndex(idx);
                const y = yForValue(val);
                return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
              }).join(" ");
              const lastX = xForIndex(series.length - 1);
              const firstX = xForIndex(0);
              const baseY = yForValue(0);
              const areaPath = `${path} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} L ${firstX.toFixed(2)} ${baseY.toFixed(2)} Z`;
              return (
                <path key={`area_${key}`} d={areaPath} fill={colors[key]} opacity="0.06" />
              );
            })}

            {/* lines */}
            {[
              { key: "Insert", series: insertSeries },
              { key: "Edited", series: editedSeries },
              { key: "Delete", series: deleteSeries }
            ].map(({ key, series }) => {
              const d = makePath(series);
              return (
                <g key={`line_${key}`}>
                  <path d={d} fill="none" stroke={colors[key]} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "url(#softShadow)" }}>
                    <animate attributeName="stroke-dasharray" from="0,1000" to="1000,0" dur="800ms" fill="freeze" />
                  </path>
                  {/* points */}
                  {series.map((val, idx) => {
                    const x = xForIndex(idx);
                    const y = yForValue(val);
                    return (
                      <g key={`pt_${key}_${idx}`}>
                        <circle cx={x} cy={y} r={3.6} fill="#fff" stroke={colors[key]} strokeWidth={2} />
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* legend */}
            <g transform={`translate(${paddingLeft}, ${paddingTop - 6})`}>
              {["Insert", "Edited", "Delete"].map((k, i) => (
                <g key={`leg_${k}`} transform={`translate(${i * 110}, 0)`}>
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

  /* ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header / controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="px-3 py-2 border rounded-md bg-white text-sm shadow-sm hover:shadow"
            >
              ← Back
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative bg-white rounded-md border flex items-center shadow-sm">
              <svg
                className="w-5 h-5 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by mukhiya name OR familyId"
                className="p-2 outline-none w-56"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedQuery("");
                  }}
                  className="px-2 py-1 text-sm text-gray-500"
                >
                  Clear
                </button>
              )}
            </div>

            {/* numberOfHome select (optional) */}
            <div className="bg-white rounded-lg shadow-sm p-2 flex items-center">
              <select
                value={numberOfHomeFilter}
                onChange={(e) => setNumberOfHomeFilter(e.target.value)}
                className="p-1 text-sm outline-none"
              >
                <option value="">All homes</option>
                <option value="1">1 home</option>
                <option value="2">2 homes</option>
                <option value="3">3 homes</option>
              </select>
              {numberOfHomeFilter && (
                <button
                  onClick={() => setNumberOfHomeFilter("")}
                  className="ml-2 text-xs px-2 py-1 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="ml-2">
              <button
                onClick={toggleDeletedView}
                className={`px-3 py-2 rounded-md text-sm ${showDeleted ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-600"}`}
                title="Toggle deleted houses"
              >
                {showDeleted ? "Showing deleted" : "Showing active"}
              </button>
            </div>

          </div>

        </div>

        {/* --- Home-count analytics: shown only when NO filters applied and showDeleted is false --- */}
        {!debouncedQuery && !numberOfHomeFilter && !showDeleted ? (
          <div className="mb-4">
            {homeAnalyticsLoading ? (
              <div className="text-sm text-gray-600 py-2">Loading analytics…</div>
            ) : homeAnalyticsError ? (
              <div className="text-sm text-red-600 py-2">{homeAnalyticsError}</div>
            ) : homeAnalytics ? (
              <AnalyticsBarChart data={homeAnalytics} />
            ) : (
              <div className="text-sm text-gray-500 py-2">No analytics for home-count available.</div>
            )}
          </div>
        ) : null}

        {/* pagination info & controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {totalCount !== null ? (
                totalCount === 0 ? (
                  <>No houses</>
                ) : (
                  <>
                    Showing {Math.min(totalCount, (page - 1) * pageSize + 1)}–{Math.min(totalCount, page * pageSize)} of {totalCount}
                  </>
                )
              ) : (
                <>Page {page}</>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <div className="text-xs text-gray-500">Page size</div>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="p-1 border rounded"
              >
                {[5, 10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>{renderPageButtons()}</div>
        </div>

        {/* LINE CHART: logs for Houses */}
        <div className="mb-6">
          {/* show chart only when no filters and villageId exists */}
          {villageId && !debouncedQuery && !numberOfHomeFilter && !showDeleted ? (
            logsLoading ? (
              <div className="text-sm text-gray-600 py-4">Loading activity chart…</div>
            ) : logsError ? (
              <div className="text-sm text-red-600 py-2">{logsError}</div>
            ) : (
              <LogsLineChart items={logsItems} />
            )
          ) : (
            <div className="text-sm text-gray-400 italic">Activity chart (Houses) hidden while filters are active or when village is not selected.</div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">Loading houses....</div>
        ) : error ? (
          <div className="text-red-600 py-6 whitespace-pre-wrap">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {displayedPlots.length === 0 ? (
              <div className="text-sm text-gray-500">No houses found</div>
            ) : (
              displayedPlots.map((p) => {
                const key = String(p.plotId ?? p.id ?? p._id ?? Math.random());
                const houseId = p.houseId ?? p.homeId ?? p._id ?? p.plotId ?? null;
                const isDeleted = Boolean(p.deleted);
                return (
                  <div
                    key={key}
                    role={isDeleted ? "button" : "link"}
                    tabIndex={isDeleted ? -1 : 0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isDeleted) {
                        selectPlot(p);
                      }
                    }}
                    onClick={() => { if (!isDeleted) selectPlot(p); }}
                    className={` rounded-xl shadow hover:shadow-lg p-4 border transition transform ${isDeleted ? "bg-red-100 ring-0 cursor-not-allowed opacity-70" : "bg-blue-100 cursor-pointer"}`}
                    aria-disabled={isDeleted}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className={`text-lg font-semibold truncate ${isDeleted ? "text-gray-400" : "text-gray-800"}`}>
                            {p.name ?? (p.homeDetails?.[0]?.mukhiyaName ?? p.plotId ?? "Unnamed")}
                          </div>
                          <div className="text-xs text-gray-500">
                            {typeNameFor(p.typeId, p)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {showDeleted && (
          <div className="mt-6 text-sm text-gray-600">
            Showing deleted houses. Use the toggle to switch back to active houses.
          </div>
        )}

        <div className="h-24" />
      </div>

    </div>
  );
}
