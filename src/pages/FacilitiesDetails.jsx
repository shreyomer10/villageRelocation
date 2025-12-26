// src/pages/FacilityDetails.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { motion } from "framer-motion";
import { Image as ImageIcon, ArrowLeft, Search } from "lucide-react";
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

export default function FacilityDetails() {
  const rawParams = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const authCtx = useContext(AuthContext);

  // resolve facilityId / villageId from route, location.state, authCtx or localStorage
  const resolveFacilityIdFromStorage = () => {
    try {
      const byKey = localStorage.getItem("facilityId") || localStorage.getItem("FACILITY_ID");
      if (byKey) return byKey;
      const rawSel = localStorage.getItem("selectedFacility") || localStorage.getItem("SELECTED_FACILITY");
      if (rawSel) {
        const parsed = JSON.parse(rawSel);
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) return normalized.facilityId ?? normalized.id ?? normalized._id ?? null;
      }
    } catch {}
    return null;
  };

  const resolveVillageIdFromStorage = () => {
    try {
      const byKey = localStorage.getItem("villageId") || localStorage.getItem("VILLAGE_ID");
      if (byKey) return byKey;
      const rawSel = localStorage.getItem("selectedVillage") || localStorage.getItem("SELECTED_VILLAGE");
      if (rawSel) {
        const parsed = JSON.parse(rawSel);
        const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
        if (normalized) return normalized.villageId ?? normalized.village ?? null;
      }
    } catch {}
    return null;
  };

  const extractFacilityIdFromAuth = (ctx) => {
    if (!ctx) return null;
    try {
      if (ctx.facilityId) return ctx.facilityId;
      if (ctx.selectedFacility) {
        const sm = ctx.selectedFacility;
        if (typeof sm === "string") return sm;
        if (Array.isArray(sm)) return sm[0]?.facilityId ?? sm[0]?.id ?? sm[0]?._id ?? null;
        return sm.facilityId ?? sm.id ?? sm._id ?? null;
      }
    } catch {}
    return null;
  };

  const extractVillageIdFromAuth = (ctx) => {
    if (!ctx) return null;
    try {
      if (ctx.villageId) return ctx.villageId;
      if (ctx.selectedVillage) {
        const sv = ctx.selectedVillage;
        if (typeof sv === "string") return sv;
        if (Array.isArray(sv)) return sv[0]?.villageId ?? sv[0]?.village ?? null;
        return sv.villageId ?? sv.village ?? null;
      }
    } catch {}
    return null;
  };

  const getInitialFacility = () => {
    const fromRoute = rawParams.facilityId;
    if (fromRoute) return fromRoute;
    const fromLocation = location?.state?.selectedFacility && (location.state.selectedFacility.facilityId ?? location.state.selectedFacility.id);
    if (fromLocation) return fromLocation;
    const fromAuth = extractFacilityIdFromAuth(authCtx);
    if (fromAuth) return fromAuth;
    const fromStorage = resolveFacilityIdFromStorage();
    if (fromStorage) return fromStorage;
    return null;
  };

  const getInitialVillage = () => {
    const fromLocation = location?.state?.selectedFacility && (location.state.selectedFacility.villageId ?? location.state.selectedFacility.village);
    if (fromLocation) return fromLocation;
    const fromAuth = extractVillageIdFromAuth(authCtx);
    if (fromAuth) return fromAuth;
    const fromStorage = resolveVillageIdFromStorage();
    if (fromStorage) return fromStorage;
    return null;
  };

  const [facilityId, setFacilityId] = useState(getInitialFacility() ? String(getInitialFacility()) : null);
  const [villageId, setVillageId] = useState(getInitialVillage() ? String(getInitialVillage()) : null);

  useEffect(() => {
    const fromRoute = rawParams.facilityId ?? null;
    const fromLocation = location?.state?.selectedFacility && (location.state.selectedFacility.facilityId ?? location.state.selectedFacility.id);
    const fromAuth = extractFacilityIdFromAuth(authCtx);
    const fromStorage = resolveFacilityIdFromStorage();
    const resolved = fromRoute || fromLocation || fromAuth || fromStorage || null;
    if (resolved && String(resolved) !== facilityId) setFacilityId(String(resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawParams.facilityId, location?.state?.selectedFacility, authCtx]);

  useEffect(() => {
    const fromLocation = location?.state?.selectedFacility && (location.state.selectedFacility.villageId ?? location.state.selectedFacility.village);
    const fromAuth = extractVillageIdFromAuth(authCtx);
    const fromStorage = resolveVillageIdFromStorage();
    const resolved = fromLocation || fromAuth || fromStorage || null;
    if (resolved && String(resolved) !== villageId) setVillageId(String(resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state?.selectedFacility, authCtx]);

  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      if (e.key === "facilityId" || e.key === "FACILITY_ID") {
        if (e.newValue) setFacilityId(String(e.newValue));
      }
      if (e.key === "selectedFacility") {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
          if (normalized && (normalized.facilityId || normalized.id)) setFacilityId(String(normalized.facilityId ?? normalized.id));
        } catch {}
      }
      if (e.key === "villageId" || e.key === "VILLAGE_ID") {
        if (e.newValue) setVillageId(String(e.newValue));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [verifications, setVerifications] = useState([]);
  const [verificationsLoading, setVerificationsLoading] = useState(false);

  // filters (server-side)
  const [nameFilter, setNameFilter] = useState(""); // server-side name filter
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");

  // UI-only search input (debounced -> nameFilter)
  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalVerification, setModalVerification] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsDocs, setDocsDocs] = useState([]);
  const [docsTitle, setDocsTitle] = useState("Documents");
  const [docsLoading, setDocsLoading] = useState(false);

  const [expandedNotesFor, setExpandedNotesFor] = useState(null);

  const verifRefs = useRef({});

  useEffect(() => {
    // debounce search input to update server-side nameFilter
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const trimmed = (search || "").trim();
      if (trimmed !== nameFilter) {
        setNameFilter(trimmed);
        setPage(1);
      }
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, villageId]);

  useEffect(() => {
    // fetch when any server-side filter or pagination changes
    fetchVerifications(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, nameFilter, statusFilter, fromDateFilter, toDateFilter]);

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
      if (!facilityId || !villageId) {
        setVerifications([]);
        setTotalCount(0);
        return;
      }
      setPage(1);
      await fetchVerifications(1, limit);
    } catch (err) {
      console.error("loadAll:", err);
      setPageError(err.message || "Error loading facility verifications");
    } finally {
      setLoading(false);
    }
  }

  async function fetchVerifications(pageArg = page, limitArg = limit) {
    setVerificationsLoading(true);
    setPageError(null);
    try {
      if (!facilityId || !villageId) {
        setVerifications([]);
        setTotalCount(0);
        return;
      }
      const qs = new URLSearchParams();
      qs.set("page", String(pageArg || 1));
      qs.set("limit", String(limitArg || 15));
      if (nameFilter) qs.set("name", nameFilter);
      if (statusFilter) qs.set("status", statusFilter);
      if (fromDateFilter) qs.set("fromDate", dateStartOfDay(fromDateFilter));
      if (toDateFilter) qs.set("toDate", dateEndOfDay(toDateFilter));

      const url = `${API_BASE}/facility_verification/${encodeURIComponent(villageId)}/${encodeURIComponent(facilityId)}?${qs.toString()}`;
      const res = await authFetch(url, { method: "GET" });
      const text = await res.text().catch(() => "");
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }

      if (!res.ok) {
        const msg = (json && (json.message || json.error)) || text || `Failed to fetch verifications: ${res.status}`;
        if (res.status === 404) {
          setVerifications([]);
          setTotalCount(0);
          setVerificationsLoading(false);
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
      setVerifications(items);
      setTotalCount(Number(count) || items.length || 0);
    } catch (err) {
      console.error("fetchVerifications:", err);
      setPageError(err.message || "Failed to fetch verifications");
      setVerifications([]);
      setTotalCount(0);
    } finally {
      setVerificationsLoading(false);
    }
  }

  async function fetchVerificationOne(verificationId) {
    if (!verificationId) return null;
    setModalLoading(true);
    setPageError(null);
    try {
      const url = `${API_BASE}/facility_verification/one/${encodeURIComponent(verificationId)}`;
      const res = await authFetch(url, { method: "GET" });
      const text = await res.text().catch(() => "");
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }

      if (!res.ok) {
        const msg = (json && (json.message || json.error)) || text || `Failed to fetch verification: ${res.status}`;
        throw new Error(msg);
      }
      const payload = json ?? {};
      const result = payload.result ?? payload ?? null;
      return result;
    } catch (err) {
      console.error("fetchVerificationOne:", err);
      setPageError(err.message || "Failed to fetch verification");
      return null;
    } finally {
      setModalLoading(false);
    }
  }

  async function fetchVerificationDocs(verificationId) {
    if (!verificationId) return [];
    setDocsLoading(true);
    setPageError(null);
    try {
      const tryUrls = [
        `${API_BASE}/facility_verification/docs/${encodeURIComponent(verificationId)}`,
        `${API_BASE}/facility_verification/${encodeURIComponent(verificationId)}/docs`,
        `${API_BASE}/facility_verification/one/${encodeURIComponent(verificationId)}`,
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
          if (payload.result && Array.isArray(payload.result.docs)) docsArr = payload.result.docs;
          else if (Array.isArray(payload.docs)) docsArr = payload.docs;
          else if (Array.isArray(payload)) docsArr = payload;
          else if (payload.result && Array.isArray(payload.result)) docsArr = payload.result;
          else if (payload.files && Array.isArray(payload.files)) docsArr = payload.files;

          if (!Array.isArray(docsArr) && (payload.result || payload)) {
            const obj = payload.result ?? payload;
            const candidates = ["docs", "documents", "photos", "images", "files", "attachments"];
            for (const c of candidates) {
              if (Array.isArray(obj[c])) { docsArr = obj[c]; break; }
            }
            if (!Array.isArray(docsArr)) docsArr = [];
          }

          const normalized = (docsArr || []).map((item) => {
            if (!item) return null;
            if (typeof item === "string") return item;
            if (typeof item === "object") return item.url ?? item.link ?? item.path ?? item.file ?? item.src ?? item.location ?? null;
            return null;
          }).filter(Boolean);

          return normalized;
        } catch (innerErr) {
          console.warn(`fetchVerificationDocs candidate failed (${url}):`, innerErr?.message || innerErr);
          continue;
        }
      }

      return [];
    } catch (err) {
      console.error("fetchVerificationDocs:", err);
      setPageError(err.message || "Failed to fetch docs");
      return [];
    } finally {
      setDocsLoading(false);
    }
  }

  async function openVerificationModalById(e, verificationId) {
    e?.stopPropagation?.();
    setModalLoading(true);
    setModalVerification(null);
    setModalOpen(true);
    try {
      const data = await fetchVerificationOne(verificationId);
      if (data) setModalVerification(data);
    } catch (err) {
      console.error("openVerificationModalById:", err);
      setModalVerification(null);
    } finally {
      setModalLoading(false);
    }
  }

  async function openDocsModalById(e, verificationId) {
    e?.stopPropagation?.();
    setDocsLoading(true);
    setDocsDocs([]);
    setDocsTitle("Documents");
    setDocsOpen(true);
    try {
      const docsList = await fetchVerificationDocs(verificationId);
      setDocsDocs(docsList || []);
      try {
        const maybe = await fetchVerificationOne(verificationId);
        const title = (maybe && (maybe.name ?? maybe.title ?? maybe.verificationId)) || "Documents";
        setDocsTitle(title);
      } catch (e) {}
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
    setModalVerification(null);
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

  if (!facilityId) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="rounded-lg shadow p-6">
          <div className="text-lg font-semibold mb-2">No facility selected</div>
          <div className="text-sm text-slate-600">Please select a facility from the Facilities list first.</div>
          <div className="mt-4">
            <button onClick={() => navigate("/facility")} className="px-4 py-2 bg-blue-600 text-white rounded">Go to facilities</button>
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
            <h1 className="text-2xl font-semibold text-slate-800">Facility Verifications</h1>
          </div>

          <div style={{ width: 120 }} />
        </div>

        {/* Filters */}
        <div className="bg-yellow-100 border rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end mb-4">
          <div className="flex flex-col">
            <label className="text-xs text-slate-600">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="mt-1 px-3 py-2 border rounded-md shadow-sm"
            >
              <option value="">ALL</option>
              <option value="1">Forest Guard</option>
              <option value="2">Range Assistant</option>
              <option value="3">Range Officer</option>
              <option value="4">Assistant Director</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-slate-600">From date</label>
            <input
              type="date"
              value={fromDateFilter}
              onChange={(e) => { setFromDateFilter(e.target.value); setPage(1); }}
              className="mt-1 px-3 py-2 border rounded-md shadow-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-slate-600">To date</label>
            <input
              type="date"
              value={toDateFilter}
              onChange={(e) => { setToDateFilter(e.target.value); setPage(1); }}
              className="mt-1 px-3 py-2 border rounded-md shadow-sm"
            />
          </div>

          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter name/notes/inserted by..."
              className="pl-9 pr-3 py-2 border rounded w-64"
            />
            <div className="absolute left-3 top-2.5 text-slate-400"><Search size={16} /></div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => { setPage(1); fetchVerifications(1, limit); }} className="px-4 py-2 bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-md">Apply</button>
            <button onClick={() => {
              setSearch("");
              setNameFilter("");
              setStatusFilter("");
              setFromDateFilter("");
              setToDateFilter("");
              setPage(1);
              fetchVerifications(1, limit);
            }} className="px-4 py-2 bg-white border rounded-md">Clear</button>
          </div>
        </div>

        {/* Pagination top */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-slate-600">
            <span className="text-sm px-3">Per page :</span>
            <select
              value={limit}
              onChange={async (e) => { const newLimit = Number(e.target.value) || 15; setLimit(newLimit); setPage(1); await fetchVerifications(1, newLimit); }}
              className="border rounded px-2 py-1"
            >
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
        {verificationsLoading ? (
          <div className="text-sm text-slate-500">Loading verifications…</div>
        ) : (verifications || []).length === 0 ? (
          <div className="text-sm text-slate-500">No verifications found.</div>
        ) : (
          <div className="space-y-4">
            {(verifications || []).map((v, idx) => {
              const key = v.verificationId ?? v._id ?? v.id ?? `ver-${idx}`;
              const rawNotes = (v.notes || v.description || "");
              const shortNotes = rawNotes.replace(/\s+/g, " ").slice(0, 400);
              const isExpanded = expandedNotesFor === key;
              return (
                <motion.div
                  key={key}
                  ref={(el) => { if (el) verifRefs.current[key] = el; }}
                  tabIndex={0}
                  className={`relative overflow-hidden rounded-xl p-4 bg-blue-100 border border-slate-200 hover:shadow-lg transition transform hover:-translate-y-0.5 ${v.deleted ? "opacity-60" : ""}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-semibold text-slate-800 truncate">{v.name ?? v.title ?? `Verification ${idx + 1}`}</div>
                            <div className="flex-shrink-0"><StatusBadge status={v.status ?? 0} /></div>
                          </div>

                          <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                            {isExpanded ? rawNotes : `${shortNotes}${rawNotes.length > 400 ? "…" : ""}`}
                          </div>

                          <div className="mt-3 text-xs text-slate-600 grid grid-cols-2 gap-2">
                            <div>Inspector: <span className="font-medium">{v.insertedBy ?? "—"}</span></div>
                            <div>Date: <span className="font-medium">{fmtDate(v.insertedAt)}</span></div>
                          </div>

                          <div className="mt-2 text-xs text-slate-600">Verified by <span className="font-medium">{v.verifiedBy ?? "—"}</span><span className="mx-2">•</span><span>{fmtDate(v.verifiedAt)}</span></div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => openVerificationModalById(e, v.verificationId ?? v._id ?? v.id)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-lg text-sm hover:scale-[1.01]">Status history</button>

                            <button onClick={(e) => openDocsModalById(e, v.verificationId ?? v._id ?? v.id)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm hover:shadow-sm">
                              <ImageIcon size={16} /> <span>Docs</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {rawNotes.length > 400 && (
                              <button onClick={() => setExpandedNotesFor(isExpanded ? null : key)} className="text-sm px-3 py-1 rounded bg-white border">{isExpanded ? "Show less" : "Show more"}</button>
                            )}
                            <div className="text-xs text-slate-500">{v.deleted ? "Deleted" : ""}</div>
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

      {/* Modal: Status history */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeModal} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-2xl mx-4">
            <div className="bg-[#f8f0dc] rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <div className="text-lg font-semibold">Status history</div>
                  <div className="text-xs text-slate-500">{modalLoading ? "Loading…" : (modalVerification?.name ?? modalVerification?.title ?? modalVerification?.verificationId ?? "Verification")}</div>
                </div>
                <button onClick={closeModal} aria-label="Close" className="px-3 py-1 rounded bg-gray-100">Close</button>
              </div>

              <div className="p-4 max-h-[75vh] overflow-y-auto space-y-4">
                {modalLoading ? (
                  <div className="text-sm text-slate-500">Loading…</div>
                ) : modalVerification ? (
                  <>
                    {Array.isArray(modalVerification.statusHistory) && modalVerification.statusHistory.length > 0 ? (
                      modalVerification.statusHistory.map((h, i) => (
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
