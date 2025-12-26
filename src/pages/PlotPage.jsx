// src/pages/PlotsPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";

export default function PlotsPage() {
  const navigate = useNavigate();
  const villageId = localStorage.getItem("villageId") || "";

  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15); // default page size
  const [totalCount, setTotalCount] = useState(null);

  // building types used as "typeId" for plots (fetched from /buildings/<villageId>)
  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // filters / search
  const [filterTypeId, setFilterTypeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchTimer = useRef(null);

  // deleted view toggle (server-side)
  const [showDeleted, setShowDeleted] = useState(false);

  // analytics (for applied type filter)
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

  // helper for auth headers (keeps support for Authorization if you ever use header-based token)
  function authHeaders() {
    const token = localStorage.getItem("token");
    return token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
  }

  // --- helper: fetch that always sends cookies and safely parses responses ---
  async function fetchWithCreds(url, opts = {}) {
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
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

  // load types (buildings) for dropdown
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
        const items = payload?.result?.items ?? (Array.isArray(payload) ? payload : []);
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

  // reset page to 1 when any filter changes (so new filters start from first page)
  useEffect(() => {
    setPage(1);
  }, [filterTypeId, debouncedQuery, showDeleted, pageSize]);

  // fetch when page, pageSize or villageId changes OR when filters change (they also cause page reset)
  useEffect(() => {
    fetchPlots(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, page, pageSize, filterTypeId, debouncedQuery, showDeleted]);

  // debounced search for server-side name filter
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

      // server-side filters
      if (debouncedQuery) {
        // backend expects 'name' for name search
        params.append("name", debouncedQuery);
      }
      if (filterTypeId) {
        params.append("typeId", String(filterTypeId));
      }
      // deleted: server expects 0 or 1; default we will request active (0) when not showing deleted
      params.append("deleted", showDeleted ? "1" : "0");

      const url = `${API_BASE}/plots/${encodeURIComponent(villageId)}?${params.toString()}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

      if (!ok) {
        if (status === 404) {
          // No plots for this filter/page
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
        throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch plots: ${status}`);
      }

      const payload = json ?? {};

      // robust parsing for different payload shapes:
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
        items = payload?.result?.items ?? payload.items ?? (Array.isArray(payload) ? payload : []);
        respPage = payload.page ?? requestPage;
        respLimit = payload.limit ?? pageSize;
        respCount = payload.count ?? null;
      }

      setPlots(items);
      setPage(Number(respPage ?? requestPage));
      setPageSize(Number(respLimit ?? pageSize));
      setTotalCount(respCount !== null ? Number(respCount) : null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching plots");
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }

  // --- ANALYTICS: fetch when a type filter is applied AND showDeleted is false ---
  useEffect(() => {
    let mounted = true;

    async function fetchAnalyticsForType() {
      // If showDeleted is active, do not fetch analytics and clear it
      if (showDeleted) {
        if (mounted) {
          setAnalytics(null);
          setAnalyticsError(null);
          setAnalyticsLoading(false);
        }
        return;
      }

      if (!villageId) {
        if (mounted) {
          setAnalytics(null);
          setAnalyticsError("Missing villageId");
          setAnalyticsLoading(false);
        }
        return;
      }

      if (!filterTypeId) {
        // clear analytics when no filter is applied
        if (mounted) {
          setAnalytics(null);
          setAnalyticsError(null);
          setAnalyticsLoading(false);
        }
        return;
      }

      if (mounted) {
        setAnalyticsLoading(true);
        setAnalyticsError(null);
      }

      try {
        const url = `${API_BASE}/analytics/building/${encodeURIComponent(villageId)}/${encodeURIComponent(filterTypeId)}`;
        const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

        if (!mounted) return;

        if (!ok) {
          if (status === 404) {
            setAnalytics(null);
            setAnalyticsError("No analytics available");
            setAnalyticsLoading(false);
            return;
          }
          if (status === 401) {
            setAnalytics(null);
            setAnalyticsError((json && (json.message || json.error)) || text || "Unauthorized — please sign in");
            setAnalyticsLoading(false);
            return;
          }
          throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch analytics: ${status}`);
        }

        const payload = json ?? {};
        const result = payload.result ?? payload;
        // Expect result.stages to be array like in your example
        if (!result || !Array.isArray(result.stages) || result.stages.length === 0) {
          setAnalytics(result ?? null);
          setAnalyticsError(null); // valid but empty
        } else {
          setAnalytics(result);
          setAnalyticsError(null);
        }
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setAnalytics(null);
        setAnalyticsError(err.message || "Failed to load analytics");
      } finally {
        if (mounted) setAnalyticsLoading(false);
      }
    }

    fetchAnalyticsForType();

    return () => {
      mounted = false;
    };
  }, [filterTypeId, villageId, showDeleted]);

  // toggle deleted view (requests deleted items from server when true)
  function toggleDeletedView() {
    setShowDeleted((s) => !s);
    setPage(1); // ensure we go back to first page when toggling
    // analytics effect will handle clearing/loading analytics based on new showDeleted
  }

  function typeNameFor(typeId) {
    const t = (types || []).find(
      (x) =>
        (x.typeId ?? x.type_id ?? x.id ?? x.optionId) === typeId ||
        String(x.typeId) === String(typeId)
    );
    return t?.name ?? typeId;
  }

  // pagination helpers
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  function goPage(n) {
    if (!n || n < 1) return;
    if (totalPages && n > totalPages) return;
    setPage(n);
  }

  // render page number buttons (small window)
  function renderPageButtons() {
    if (!totalPages) return (
      <div className="text-sm">Page {page}</div>
    );

    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    if (end - start + 1 < windowSize) {
      start = Math.max(1, end - windowSize + 1);
    }

    const buttons = [];
    for (let i = start; i <= end; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => goPage(i)}
          className={`px-2 py-1 rounded ${i === page ? "bg-gray-200" : "hover:bg-gray-100"}`}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => goPage(1)}
          disabled={page === 1}
          className="px-2 py-1 rounded disabled:opacity-50"
        >
          {"<<"}
        </button>
        <button
          onClick={() => goPage(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 rounded disabled:opacity-50"
        >
          Prev
        </button>

        {buttons}

        <button
          onClick={() => goPage(page + 1)}
          disabled={totalPages !== null && page >= totalPages}
          className="px-2 py-1 rounded disabled:opacity-50"
        >
          Next
        </button>
        <button
          onClick={() => goPage(totalPages)}
          disabled={totalPages !== null && page >= totalPages}
          className="px-2 py-1 rounded disabled:opacity-50"
        >
          {">>"}
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Fancy custom dropdown component (replaces native <select>)        */
  function SelectDropdown({ value, onChange, items = [], placeholder = "All types" }) {
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(null);
    const ref = useRef(null);

    useEffect(() => {
      function onDoc(e) {
        if (!ref.current) return;
        if (!ref.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const selected = items.find(
      (it) => String(it.typeId ?? it.type_id ?? it.id ?? it.optionId) === String(value)
    );

    const selectedName = selected ? selected.name || `#${selected.typeId ?? selected.id}` : placeholder;

    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-150 focus:outline-none w-64"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <div className="flex-1 text-left truncate text-sm">
            <span className={selected ? "font-medium text-gray-900" : "text-gray-500"}>{selectedName}</span>
          </div>

          <div className="flex items-center gap-2">
            {selected && (
              <button
                onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
                className="text-xs px-2 py-1 bg-gray-100 rounded-full hover:bg-gray-200"
                aria-label="Clear selection"
              >
                Clear
              </button>
            )}

            <svg className={`w-4 h-4 transform ${open ? "rotate-180" : "rotate-0"} transition-transform`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-2 w-64 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
            <div className="max-h-64 overflow-auto">
              {items.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No types available</div>
              ) : (
                items.map((it) => {
                  const id = it.typeId ?? it.type_id ?? it.id ?? it.optionId;
                  return (
                    <div
                      key={String(id)}
                      onMouseEnter={() => setHovered(it)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => { onChange(String(id)); setOpen(false); }}
                      role="option"
                      aria-selected={String(id) === String(value)}
                      className={`px-3 py-3 cursor-pointer hover:bg-gray-50 flex items-start justify-between transition-colors ${String(id) === String(value) ? "bg-gray-50" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{it.name ?? `Type ${String(id)}`}</div>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        {String(id) === String(value) && (
                          <div className="text-blue-600 font-semibold">✓</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  /* ------------------------------------------------------------------ */

  // Attractive SVG bar chart (gradient, axis, ticks, animated)
  function AnalyticsBarChart({ data }) {
    // hooks inside component
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
      <div className="bg-yellow-100 rounded-lg border p-2 shadow-sm w-full">
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

  // --- helper to store selected plot in localStorage and navigate ---
  function selectPlot(plot) {
    try {
      const pid = plot.plotId ?? plot.id ?? plot._id ?? "";
      if (!pid) {
        console.warn("selectPlot: no plot id found on selected plot", plot);
        return;
      }

      // ensure villageId stored as well so the details page can resolve village
      try { if (villageId) localStorage.setItem("villageId", villageId); } catch (e) {}

      localStorage.setItem("plotId", String(pid));

      const preview = {
        plotId: pid,
        name: plot.name ?? null,
        familyId: plot.familyId ?? plot.family_id ?? null,
        typeId: plot.typeId ?? plot.type_id ?? null,
        villageId: villageId || null
      };
      localStorage.setItem("selectedPlot", JSON.stringify(preview));

      // navigate using the computed pid (always). Also pass the preview in location.state for immediate consumption.
      try {
        navigate(`/plots/one/${encodeURIComponent(String(pid))}`, { state: { selectedPlot: preview } });
      } catch (e) {
        // fallback: still attempt a simple path
        try { navigate(`/plots/one/${String(pid)}`); } catch (e2) { console.warn("Navigation failed", e2); }
      }
    } catch (e) {
      console.warn("Failed to save selected plot to localStorage or navigate", e);
    }
  }

  const displayedPlots = plots || [];

  // helper to nicely compute shown range
  const startIndex = totalCount === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const endIndex = totalCount === 0 ? 0 : Math.min(totalCount ?? page * pageSize, page * pageSize);

  // render
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
                placeholder="Search plots by name"
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
            <div className="bg-white rounded-lg shadow-sm">
              <SelectDropdown
                items={types}
                value={filterTypeId}
                onChange={(v) => setFilterTypeId(v)}
                placeholder={typesLoading ? "Loading types…" : "All types"}
              />
            </div>

            <div className="ml-2">
              <button
                onClick={toggleDeletedView}
                className={`px-3 py-2 rounded-md text-sm ${showDeleted ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-600"}`}
                title="Toggle deleted plots (server-side)"
              >
                {showDeleted ? "Showing deleted" : "Showing active"}
              </button>
            </div>

          </div>

        </div>

        {/* Analytics bar chart: shown only when a type filter is applied AND showDeleted is false */}
        {filterTypeId && !showDeleted ? (
          <div className="mb-4">
            {analyticsLoading ? (
              <div className="text-sm text-gray-600 py-2">Loading analytics…</div>
            ) : analyticsError ? (
              <div className="text-sm text-red-600 py-2">{analyticsError}</div>
            ) : analytics ? (
              <AnalyticsBarChart data={analytics} />
            ) : (
              <div className="text-sm text-gray-500 py-2">No analytics for selected type.</div>
            )}
          </div>
        ) : null}

        {/* pagination info & controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Showing range */}
            <div className="text-sm text-gray-600">
              {totalCount !== null ? (
                <>
                  Showing {startIndex}–{endIndex} of {totalCount}
                </>
              ) : (
                <>Page {page}</>
              )}
            </div>

            {/* page size selector */}
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

        {loading ? (
          <div className="text-center py-8">Loading plots…</div>
        ) : error ? (
          <div className="text-red-600 py-6 whitespace-pre-wrap">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {displayedPlots.length === 0 ? (
              <div className="text-sm text-gray-500">No plots found</div>
            ) : (
              displayedPlots.map((p) => {
                const pid = String(p.plotId ?? p.id ?? p._id ?? "");
                const isDeleted = Boolean(p.deleted);
                return (
                  <div
                    key={pid}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isDeleted) {
                        selectPlot(p);
                      }
                    }}
                    onClick={() => {
                      if (!isDeleted) selectPlot(p);
                    }}
                    title={isDeleted ? "This plot is deleted" : "Open plot details"}
                    aria-disabled={isDeleted}
                    className={`relative rounded-xl shadow p-4 border transition 
                      ${isDeleted ? "bg-red-200 ring-0 cursor-not-allowed opacity-85" : "bg-blue-100 hover:shadow-lg cursor-pointer"} 
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className={`text-lg font-semibold truncate ${isDeleted ? "text-gray-600" : "text-gray-800"}`}>
                            {p.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {typeNameFor(p.typeId)}
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

        {/* If showing deleted items, render a small note */}
        {showDeleted && (
          <div className="mt-6 text-sm text-gray-600">
            Showing deleted plots. Use the toggle to switch back to active plots.
          </div>
        )}

        <div className="h-24" />
      </div>
    </div>
  );
}
