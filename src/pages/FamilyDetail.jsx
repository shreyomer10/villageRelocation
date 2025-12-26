// src/pages/FamilyDetails.jsx
import React, { useEffect, useMemo, useState, useRef, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { motion } from "framer-motion";
import { FileText, Image as ImageIcon, ArrowLeft, Search, RefreshCw } from "lucide-react";
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

  // debounce search -> setNameFilter (server param)
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      const trimmed = (search || "").trim();
      // update the server-side name filter
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

  // fetch when any server-side filter or pagination changes (now includes nameFilter)
  useEffect(() => {
    fetchUpdates(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter, fromDateFilter, toDateFilter, nameFilter]);

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
      await fetchUpdates(1, limit);
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
        return;
      }
      const qs = new URLSearchParams();
      qs.set("page", String(pageArg || 1));
      qs.set("limit", String(limitArg || 15));
      if (statusFilter) qs.set("status", statusFilter);
      if (fromDateFilter) qs.set("fromDate", dateStartOfDay(fromDateFilter));
      if (toDateFilter) qs.set("toDate", dateEndOfDay(toDateFilter));
      if (nameFilter) qs.set("name", nameFilter);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            <button onClick={() => { setSearch(""); setNameFilter(""); setStatusFilter(""); setFromDateFilter(""); setToDateFilter(""); setPage(1); fetchUpdates(1, limit); }} className="px-4 py-2 bg-white border rounded-md">Clear</button>
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
                            <div className="flex-shrink-0"><StatusBadge status={u.status ?? 0} /></div>
                          </div>

                          <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                            {isExpanded ? rawNotes : `${shortNotes}${rawNotes.length > 400 ? "…" : ""}`}
                          </div>

                          <div className="mt-3 text-xs text-slate-600 grid grid-cols-2 gap-2">
                            <div>Qty: <span className="font-medium">{u.qty ?? "—"}</span></div>
                            <div>Unit: <span className="font-medium">{u.unit ?? "—"}</span></div>
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
