// src/pages/FacilitiesPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api";
import { AuthContext } from "../context/AuthContext";

/**
 * FacilitiesPage.jsx (updated)
 *
 * - Adds server-side pagination (page, pageSize) and page controls.
 * - Debounced server-side search (q param).
 * - Logs line chart between pagination and cards (calls /logs with type=Facilities).
 * - All fetch requests include credentials: "include" so cookie/token based auth works.
 * - Create/Edit/Delete flows preserved. After changes we refresh current page to keep pagination consistent.
 */

function EditIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 21v-3.75L14.06 6.19l3.75 3.75L6.75 21H3z" />
      <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15 3.25l3.75 3.75 1.96-.01z" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function FacilitiesPage() {
  const navigate = useNavigate();
  const authCtx = useContext(AuthContext);
  const villageId = localStorage.getItem("villageId") || "";

  // list + pagination
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(null);

  // modal + form
  const [showForm, setShowForm] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [form, setForm] = useState({ name: "", villageId: "", desc: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // delete
  const [toDelete, setToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // search (server-side q param)
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchTimer = useRef(null);

  // logs for line chart (type=Facilities)
  const [logsItems, setLogsItems] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [logsTotalCount, setLogsTotalCount] = useState(null);

  // helper headers
  function authHeaders() {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // debounce search -> debouncedQuery
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  // reset page when search or pageSize changes
  useEffect(() => setPage(1), [debouncedQuery, pageSize]);

  // fetch facilities when page/pageSize/villageId/debouncedQuery changes
  useEffect(() => {
    fetchFacilities(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, page, pageSize, debouncedQuery]);

  // ---------------- FETCH FACILITIES ----------------
  async function fetchFacilities(requestPage = 1) {
    setLoading(true);
    setPageError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", String(requestPage));
      params.append("limit", String(pageSize));
      if (debouncedQuery) params.append("q", debouncedQuery);
      if (villageId) params.append("villageId", villageId);

      const url = `${API_BASE}/facilities?${params.toString()}`;
      const res = await fetch(url, { headers: authHeaders(), credentials: "include" });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok) {
        const msg = (data && data.message) || `Failed to fetch facilities: ${res.status}`;
        throw new Error(msg);
      }
      if (data && data.error) throw new Error(data.message || "Server error");

      // normalize items & pagination
      let items = [];
      let respPage = requestPage;
      let respLimit = pageSize;
      let respCount = null;

      if (data.result) {
        const r = data.result;
        items = r.items ?? (Array.isArray(r) ? r : []);
        respPage = r.page ?? r.pageNo ?? data.page ?? requestPage;
        respLimit = r.limit ?? data.limit ?? pageSize;
        respCount = r.count ?? data.count ?? null;
      } else {
        items = data.items ?? (Array.isArray(data) ? data : []);
        respPage = data.page ?? requestPage;
        respLimit = data.limit ?? pageSize;
        respCount = data.count ?? null;
      }

      setFacilities(items || []);
      setPage(Number(respPage ?? requestPage));
      setPageSize(Number(respLimit ?? pageSize));
      setTotalCount(respCount !== null ? Number(respCount) : null);
    } catch (err) {
      console.error("fetchFacilities:", err);
      setPageError(err.message || "Failed to fetch facilities");
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }

  // ---------------- LOGS (line chart) ----------------
  // Chart hidden whenever a search/filter is active:
  const showLogsChart = villageId && !debouncedQuery;

  useEffect(() => {
    let mounted = true;

    if (!showLogsChart) {
      setLogsItems([]);
      setLogsTotalCount(null);
      setLogsError(null);
      setLogsLoading(false);
      return;
    }

    (async () => {
      setLogsLoading(true);
      setLogsError(null);
      try {
        const params = new URLSearchParams();
        params.append("type", "Facilities"); // per request
        if (villageId) params.append("villageId", villageId);
        params.append("page", String(page));
        params.append("limit", String(pageSize));

        const url = `${API_BASE}/logs?${params.toString()}`;
        const res = await fetch(url, { headers: authHeaders(), credentials: "include" });

        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          data = null;
        }

        if (!res.ok) {
          const msg = (data && data.message) || `Failed to fetch logs: ${res.status}`;
          throw new Error(msg);
        }
        if (data && data.error) throw new Error(data.message || "Server error");

        const payload = data.result ?? data;
        const items = payload.items ?? (Array.isArray(payload) ? payload : []);
        const count = payload.count ?? null;

        if (!mounted) return;
        setLogsItems(items);
        setLogsTotalCount(count !== null ? Number(count) : null);
      } catch (err) {
        console.error("fetchLogs:", err);
        if (!mounted) return;
        setLogsError(err.message || "Failed to load activity logs");
        setLogsItems([]);
      } finally {
        if (mounted) setLogsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [showLogsChart, page, pageSize, villageId]);

  // ---------------- HELPERS: save selection to AuthContext/localStorage ----------------
  function persistSelectedFacilityId(id) {
    if (id === undefined || id === null) return;
    const idStr = String(id);
    try {
      if (authCtx && typeof authCtx.setSelectedFacility === "function") {
        try {
          authCtx.setSelectedFacility({ facilityId: idStr });
        } catch {
          authCtx.setSelectedFacility(idStr);
        }
        return;
      }
      if (authCtx && typeof authCtx.setFacilityId === "function") {
        authCtx.setFacilityId(idStr);
        return;
      }
      if (authCtx && typeof authCtx.selectFacility === "function") {
        try {
          authCtx.selectFacility({ facilityId: idStr });
        } catch {
          authCtx.selectFacility({ id: idStr });
        }
        return;
      }
      localStorage.setItem("facilityId", idStr);
      localStorage.setItem("selectedFacility", JSON.stringify({ facilityId: idStr }));
    } catch (e) {
      console.warn("persistSelectedFacilityId failed", e);
      try { localStorage.setItem("facilityId", idStr); } catch {}
    }
  }

  function handleCardClick(facility) {
    const id = facility?.facilityId ?? facility?.id ?? facility?._id ?? facility?.facility_id;
    if (id === undefined || id === null) {
      setPageError("This facility has no id and cannot be opened.");
      return;
    }
    persistSelectedFacilityId(id);
    navigate(`/facility/one/${encodeURIComponent(String(id))}`);
  }

  function handleCardKeyDown(e, facility) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(facility);
    }
  }

  // ---------------- CREATE / UPDATE ----------------
  function resetForm() {
    setForm({ name: "", villageId: "", desc: "" });
    setEditingFacility(null);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(facility) {
    setEditingFacility(facility);
    setForm({ name: facility.name || "", villageId: facility.villageId || "", desc: facility.desc || "" });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setPageError(null);
    setFormError(null);

    const nameTrim = (form.name || "").trim();
    const villageTrim = (form.villageId || "").trim();
    const descTrim = String(form.desc || "").trim();

    const isEdit = Boolean(editingFacility);
    if (!isEdit && !nameTrim) {
      setFormError("Name is required");
      return;
    }

    const payload = {};
    const originalName = (editingFacility?.name ?? "").toString();
    if (!isEdit) {
      payload.name = nameTrim;
    } else {
      if (nameTrim !== originalName.trim()) payload.name = nameTrim;
    }

    const originalVillage = (editingFacility?.villageId ?? "").toString();
    if (!isEdit) {
      if (villageTrim !== "") payload.villageId = villageTrim;
    } else {
      if (villageTrim !== originalVillage.trim()) {
        if (villageTrim === "" && originalVillage.trim() !== "") payload.villageId = "";
        else if (villageTrim !== "") payload.villageId = villageTrim;
      }
    }

    const originalDesc = (editingFacility?.desc ?? "").toString();
    if (!isEdit) {
      if (descTrim !== "") payload.desc = descTrim;
    } else {
      if (descTrim !== originalDesc.trim()) {
        if (descTrim === "" && originalDesc.trim() !== "") payload.desc = "";
        else if (descTrim !== "") payload.desc = descTrim;
      }
    }

    if (isEdit && Object.keys(payload).length === 0) {
      setFormError("No changes to update");
      return;
    }

    const idForUrl = editingFacility?.facilityId ?? editingFacility?.id ?? editingFacility?._id ?? editingFacility?.facility_id;
    const url = isEdit ? `${API_BASE}/facilities/${encodeURIComponent(String(idForUrl))}` : `${API_BASE}/facilities`;
    const method = isEdit ? "PUT" : "POST";

    setSubmitLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok) {
        let msg = `Save failed: ${res.status}`;
        if (data) {
          if (data.message) msg = data.message;
          else if (data.errors) msg = JSON.stringify(data.errors);
          else msg = JSON.stringify(data);
        }
        throw new Error(msg);
      }
      if (data && data.error) {
        const backendMsg = data.message || JSON.stringify(data);
        throw new Error(backendMsg);
      }

      if (!isEdit) {
        const created = data?.result ?? data ?? null;
        if (created && (created.facilityId || created.id || created._id)) {
          setFacilities((prev) => [created, ...prev]);
        } else {
          await fetchFacilities(page);
        }
      } else {
        const updatedFields = data?.result ?? data ?? null;
        if (updatedFields && Object.keys(updatedFields).length > 0) {
          setFacilities((prev) =>
            prev.map((f) =>
              String(f.facilityId ?? f.id ?? f._id) === String(idForUrl) ? { ...f, ...updatedFields } : f
            )
          );
        } else {
          await fetchFacilities(page);
        }
      }

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error("handleSubmit:", err);
      const msg = err.message || "Save failed";
      setFormError(msg);
      setPageError(msg);
    } finally {
      setSubmitLoading(false);
    }
  }

  // ---------------- DELETE ----------------
  function confirmDelete(facility) {
    setToDelete(facility);
    setPageError(null);
  }

  async function handleDeleteConfirmed() {
    if (!toDelete) return;
    setDeleteLoading(true);
    setPageError(null);
    try {
      const id = toDelete?.facilityId ?? toDelete?.id ?? toDelete?._id ?? toDelete?.facility_id;
      const res = await fetch(`${API_BASE}/facilities/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok) {
        const msg = (data && data.message) || `Delete failed: ${res.status}`;
        throw new Error(msg);
      }
      if (data && data.error) throw new Error(data.message || "Server error");

      await fetchFacilities(page);
      setToDelete(null);
    } catch (err) {
      console.error("handleDeleteConfirmed:", err);
      setPageError(err.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  function cancelDelete() {
    setToDelete(null);
  }

  // ---------------- PAGINATION RENDER ----------------
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : Math.max(1, Math.ceil((facilities.length || 0) / pageSize));
  function goPage(n) {
    if (!n || n < 1) return;
    if (totalPages && n > totalPages) return;
    setPage(n);
  }

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

  // ---------------- LOGS LINE CHART (re-usable) ----------------
  function LogsLineChart({ items }) {
    if (!items || items.length === 0) {
      return <div className="text-sm text-gray-500">No activity logs on this page to plot.</div>;
    }

    function normalizeAction(a) {
      if (!a) return "other";
      const lower = String(a).toLowerCase();
      if (lower.includes("delete")) return "Delete";
      if (lower.includes("edited") || lower.includes("edit")) return "Edited";
      if (lower.includes("insert")) return "Insert";
      return "other";
    }

    const map = {};
    items.forEach((it) => {
      const timeStr = it.updateTime || it.update_time || "";
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
      }
      if (!monthKey) monthKey = "unknown";
      if (!map[monthKey]) map[monthKey] = { Insert: 0, Edited: 0, Delete: 0 };
      const act = normalizeAction(it.action);
      if (act === "Insert" || act === "Edited" || act === "Delete") {
        map[monthKey][act] = (map[monthKey][act] || 0) + 1;
      }
    });

    const months = Object.keys(map).filter(k => k !== "unknown").sort((a, b) => a.localeCompare(b));
    if (months.length === 0) months.push("unknown");

    const insertSeries = months.map(m => map[m]?.Insert ?? 0);
    const editedSeries = months.map(m => map[m]?.Edited ?? 0);
    const deleteSeries = months.map(m => map[m]?.Delete ?? 0);

    const maxVal = Math.max(...insertSeries, ...editedSeries, ...deleteSeries, 1);

    const width = 820;
    const height = 260;
    const paddingLeft = 72;
    const paddingRight = 24;
    const paddingTop = 24;
    const paddingBottom = 48;
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

    const makePath = (series) => series.map((val, idx) => {
      const x = xForIndex(idx);
      const y = yForValue(val);
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");

    const colors = { Insert: "#10b981", Edited: "#f59e0b", Delete: "#ef4444" };
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
            <div className="text-xs text-gray-400">• Chart hidden when search is active</div>
          </div>
        </div>

        <div className="overflow-auto">
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Facilities activity chart">
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
                  <text x={paddingLeft - 12} y={y + 4} fontSize="11" fill="#475569" textAnchor="end" style={{ fontFamily: "Inter, system-ui" }}>{tv}</text>
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
              return <path key={`area_${key}`} d={areaPath} fill={colors[key]} opacity="0.06" />;
            })}

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

  // ---------------- FILTERED VIEW (client-side fallback) ----------------
  const clientFiltered = facilities.filter((f) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (String(f.name || "") || "").toLowerCase().includes(q) ||
      (String(f.desc || "") || "").toLowerCase().includes(q) ||
      (String(f.facilityId || f.id || "") || "").toLowerCase().includes(q) ||
      (String(f.villageId || "") || "").toLowerCase().includes(q)
    );
  });

  // ---------------- RENDER ----------------
  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {pageError && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{pageError}</div>}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/home")} className="px-3 py-2 border rounded-md bg-white text-sm shadow-sm hover:shadow">← Back</button>
          </div>

          <div><h1 className="text-2xl font-semibold">Facilities</h1></div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by id, name, village or description" className="p-2 border rounded w-full sm:w-64" />
            <button onClick={() => { setQuery(""); setDebouncedQuery(""); }} className="px-3 py-2 border rounded bg-white">Clear</button>
            <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ Add</button>
          </div>
        </div>

        {/* pagination info & controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {totalCount !== null ? (
                totalCount === 0 ? <>No facilities</> : <>Showing {Math.min(totalCount, (page - 1) * pageSize + 1)}–{Math.min(totalCount, page * pageSize)} of {totalCount}</>
              ) : <>Page {page}</>
              }
            </div>

            <div className="flex items-center gap-2 text-sm">
              <div className="text-xs text-gray-500">Page size</div>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="p-1 border rounded">
                {[5, 10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>{renderPageButtons()}</div>
        </div>

        {/* LINE CHART: logs for Facilities */}
        <div className="mb-6">
          {showLogsChart ? (
            logsLoading ? (
              <div className="text-sm text-gray-600 py-4">Loading activity chart…</div>
            ) : logsError ? (
              <div className="text-sm text-red-600 py-2">{logsError}</div>
            ) : (
              <LogsLineChart items={logsItems} />
            )
          ) : (
            <div className="text-sm text-gray-400 italic">Activity chart (Facilities) hidden while search is active or village is not selected.</div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">Loading facilities…</div>
        ) : clientFiltered.length === 0 ? (
          <div className="text-sm text-gray-500">No facilities found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientFiltered.map((f) => (
              <div
                key={String(f.facilityId ?? f.id ?? f._id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => handleCardKeyDown(e, f)}
                onClick={() => handleCardClick(f)}
                className="relative bg-blue-100 rounded-2xl shadow p-4 hover:shadow-lg transition-shadow cursor-pointer"
                aria-label={`Open facility ${f.name || f.facilityId}`}
              >
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(f); }} className="p-1 rounded-md hover:bg-gray-100" aria-label={`Edit facility ${f.name}`} title="Edit" type="button">
                    <EditIcon className="w-4 h-4 text-indigo-600" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); confirmDelete(f); }} className="p-1 rounded-md hover:bg-gray-100" aria-label={`Delete facility ${f.name}`} title="Delete" type="button">
                    <TrashIcon className="w-4 h-4 text-red-600" />
                  </button>
                </div>

                <div className="mt-1">
                  <div className="text-lg font-semibold text-gray-900 truncate">{f.name || "-"}</div>
                  {f.villageId && <div className="text-xs text-gray-500">Village: {f.villageId}</div>}
                  {f.desc && <div className="text-sm text-gray-700 mt-1">{f.desc}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-24" />
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <form onSubmit={handleSubmit} className="bg-[#f8f0dc] rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingFacility ? "Edit Facility" : "Add Facility"}</h3>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-500" aria-label="Close form">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700">Name</label>
                <input required value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="w-full p-2 border rounded" />
              </div>

              <div>
                <label className="block text-sm text-gray-700">Village ID</label>
                <input value={form.villageId} onChange={(e) => setForm(p => ({ ...p, villageId: e.target.value }))} className="w-full p-2 border rounded" />
              </div>

              <div>
                <label className="block text-sm text-gray-700">Description</label>
                <textarea value={form.desc} onChange={(e) => setForm(p => ({ ...p, desc: e.target.value }))} rows={3} className="w-full p-2 border rounded" />
              </div>

              {formError && <div className="text-sm text-red-600">{formError}</div>}

              <div className="flex justify-end gap-2 mt-3">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" disabled={submitLoading} className={`px-4 py-2 text-white rounded ${submitLoading ? "bg-gray-400" : "bg-blue-600"}`}>
                  {submitLoading ? (editingFacility ? "Saving…" : "Creating…") : editingFacility ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {toDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-lg max-w-lg">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Delete facility</h3>
                <p className="text-m text-gray-600 mt-1">Are you sure you want to delete <strong>{toDelete.name || `ID ${toDelete.facilityId}`}</strong>?</p>

                {pageError && <div className="text-sm text-red-600 mt-2">{pageError}</div>}

                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={cancelDelete} className="px-4 py-2 border rounded" type="button" disabled={deleteLoading}>Cancel</button>
                  <button onClick={handleDeleteConfirmed} className={`px-4 py-2 text-white rounded ${deleteLoading ? "bg-gray-400" : "bg-red-600"}`} type="button" disabled={deleteLoading}>
                    {deleteLoading ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
