// src/pages/FeedbackPage.updated.jsx
import React, { useEffect, useMemo, useState, useRef, useContext } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { motion } from "framer-motion";
import { FileText, Image as ImageIcon, ArrowLeft, Search } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import DocumentModal from "../component/DocsModal";

// --------------------------------------------------------------------------------
// FeedbackPage.updated.jsx — fixed rate-limiting / too-many-requests by:
// 1) ensuring fetchFeedbacks is called exactly once per relevant change
// 2) moving logs/chart fetch into a single debounced effect with an AbortController + cache
// 3) removing duplicate fetch triggers (loadAll no longer calls fetchFeedbacks blindly)
// --------------------------------------------------------------------------------

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
    "1": { label: "New", color: "bg-yellow-200 text-yellow-800" },
    "2": { label: "Acknowledged", color: "bg-blue-300 text-blue-800" },
    "3": { label: "In Progress", color: "bg-indigo-300 text-indigo-800" },
    "4": { label: "Resolved", color: "bg-green-300 text-green-800" },
  };
  const entry = map[String(status)] || { label: `Status ${status}`, color: "bg-gray-100 text-gray-800" };
  return <span className={`text-xs px-2 py-1 rounded ${entry.color}`}>{entry.label}</span>;
}

function FeedbackTypeBadge({ type }) {
  const t = (type || "").toString().toLowerCase();
  const map = {
    complaint: { label: "Complaint", classes: "bg-red-100 text-red-800" },
    suggestion: { label: "Suggestion", classes: "bg-green-100 text-green-800" },
  };
  const entry = map[t] || { label: (type || "—"), classes: "bg-gray-100 text-gray-800" };
  return <span className={`text-xs px-2 py-1 rounded ${entry.classes}`}>{entry.label}</span>;
}

export default function FeedbackPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const authCtx = useContext(AuthContext);

  // Resolve village id from route/auth/localStorage
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

  const getInitialVillage = () => {
    const fromRoute = params.villageId;
    if (fromRoute) return String(fromRoute);
    const fromLocation = location?.state?.selectedVillage && (location.state.selectedVillage.villageId ?? location.state.selectedVillage.village);
    if (fromLocation) return String(fromLocation);
    const fromAuth = extractVillageIdFromAuth(authCtx);
    if (fromAuth) return String(fromAuth);
    const fromStorage = resolveVillageIdFromStorage();
    if (fromStorage) return String(fromStorage);
    return null;
  };

  const [villageId, setVillageId] = useState(getInitialVillage());

  useEffect(() => {
    const fromRoute = params.villageId ?? null;
    const fromLocation = location?.state?.selectedVillage && (location.state.selectedVillage.villageId ?? location.state.selectedVillage.village);
    const fromAuth = extractVillageIdFromAuth(authCtx);
    const fromStorage = resolveVillageIdFromStorage();
    const resolved = fromRoute || fromLocation || fromAuth || fromStorage || null;
    if (resolved && String(resolved) !== villageId) setVillageId(String(resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.villageId, location?.state?.selectedVillage, authCtx]);

  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      if (e.key === "villageId" || e.key === "villageID") {
        if (e.newValue) setVillageId(String(e.newValue));
      }
      if (e.key === "selectedVillage" || e.key === "selectedPlot") {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
          if (normalized && (normalized.villageId || normalized.village)) setVillageId(String(normalized.villageId ?? normalized.village));
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);

  // filters
  const [nameFilter, setNameFilter] = useState("");
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");

  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  // modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTargetId, setModalTargetId] = useState(null);

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsDocs, setDocsDocs] = useState([]);
  const [docsTitle, setDocsTitle] = useState("Documents");
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsTargetId, setDocsTargetId] = useState(null);

  const [expandedNotesFor, setExpandedNotesFor] = useState(null);
  const feedbackRefs = useRef({});

  // abort controllers & caches
  const fetchControllersRef = useRef({}); // for detail/docs per item
  const feedbackCacheRef = useRef({}); // per-feedback details cache
  const docsCacheRef = useRef({}); // per-feedback docs cache

  // LOGS (chart) state + controller + cache
  const [logsItems, setLogsItems] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const logsControllerRef = useRef(null);
  const logsCacheRef = useRef({}); // keyed by village + filters

  // debounce search -> set nameFilter
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const trimmed = (search || "").trim();
      if (trimmed !== nameFilter) {
        setNameFilter(trimmed);
        setPage(1);
      }
    }, 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // auth headers util
  function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
  }

  async function fetchWithCreds(url, opts = {}) {
    try {
      const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
      const res = await fetch(url, {
        credentials: "include",
        headers,
        method: opts.method || "GET",
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

  function dateStartOfDay(d) { if (!d) return null; return `${d} 00:00:00`; }
  function dateEndOfDay(d) { if (!d) return null; return `${d} 23:59:59`; }

  // loadAll: when village changes we want to reset page to 1 and fetch once.
  async function loadAll() {
    setLoading(true);
    setPageError(null);
    try {
      if (!villageId) {
        setFeedbacks([]);
        setTotalCount(0);
        return;
      }
      // If page is already 1, call fetchFeedbacks immediately (single call).
      // Otherwise set page to 1 and the effect watching page will fetch.
      if (page === 1) {
        await fetchFeedbacks(1, limit);
      } else {
        setPage(1);
      }
    } catch (err) {
      console.error("loadAll:", err);
      setPageError(err.message || "Error loading feedbacks");
    } finally {
      setLoading(false);
    }
  }

  function normalizeListResponse(payload) {
    if (!payload) return { items: [], count: 0 };
    if (payload.result) {
      const result = payload.result;
      const items = result.items ?? result ?? [];
      const count = result.count ?? result.total ?? (Array.isArray(result) ? result.length : 0);
      return { items: Array.isArray(items) ? items : [], count: Number(count) || 0 };
    }
    if (Array.isArray(payload)) return { items: payload, count: payload.length };
    const items = payload.items ?? payload.result ?? [];
    const count = payload.count ?? (Array.isArray(items) ? items.length : 0);
    return { items: Array.isArray(items) ? items : [], count: Number(count) || 0 };
  }

  // Fetch feedback list. This function no longer triggers logs fetch to avoid duplicates.
  async function fetchFeedbacks(pageArg = page, limitArg = limit) {
    setFeedbacksLoading(true);
    setPageError(null);
    try {
      if (!villageId) {
        setFeedbacks([]);
        setTotalCount(0);
        return;
      }
      const qs = new URLSearchParams();
      qs.set("page", String(pageArg || 1));
      qs.set("limit", String(limitArg || 15));
      if (nameFilter) qs.set("name", nameFilter);
      if (feedbackTypeFilter) qs.set("feedbackType", feedbackTypeFilter);
      if (fromDateFilter) qs.set("fromDate", dateStartOfDay(fromDateFilter));
      if (toDateFilter) qs.set("toDate", dateEndOfDay(toDateFilter));

      const url = `${API_BASE}/feedbacks/${encodeURIComponent(villageId)}?${qs.toString()}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET", headers: authHeaders() });

      if (!ok) {
        const msg = (json && (json.message || json.error)) || text || `Failed to fetch feedbacks: ${status}`;
        if (status === 404) {
          setFeedbacks([]);
          setTotalCount(0);
          setFeedbacksLoading(false);
          return;
        }
        if (status === 401) {
          setPageError((json && (json.message || json.error)) || "Unauthorized — please sign in");
          setFeedbacks([]);
          setTotalCount(0);
          setFeedbacksLoading(false);
          return;
        }
        throw new Error(msg);
      }

      const payload = json ?? {};
      const { items, count } = normalizeListResponse(payload ?? {});
      setFeedbacks(items);
      setTotalCount(Number(count) || items.length || 0);
    } catch (err) {
      console.error("fetchFeedbacks:", err);
      setPageError(err.message || "Failed to fetch feedbacks");
      setFeedbacks([]);
      setTotalCount(0);
    } finally {
      setFeedbacksLoading(false);
    }
  }

  // --- Robust single feedback fetch with abort + cache ---
  async function fetchFeedbackOne(feedbackId) {
    if (!feedbackId) return null;
    if (feedbackCacheRef.current[feedbackId]) return feedbackCacheRef.current[feedbackId];

    const key = `feedbackOne:${feedbackId}`;
    try { if (fetchControllersRef.current[key]) fetchControllersRef.current[key].abort(); } catch {}
    const controller = new AbortController();
    fetchControllersRef.current[key] = controller;

    setPageError(null);
    try {
      const url = `${API_BASE}/feedback/${encodeURIComponent(feedbackId)}`;
      const { ok, status, json, text, aborted } = await fetchWithCreds(url, { method: "GET", headers: authHeaders(), signal: controller.signal });
      if (aborted) return null;
      if (!ok) {
        const msg = (json && (json.message || json.error)) || text || `Failed to fetch feedback: ${status}`;
        if (status === 401) setPageError("Unauthorized — please sign in");
        throw new Error(msg);
      }
      const payload = json ?? {};
      const fb = payload.result?.feedback ?? payload.feedback ?? payload.result ?? payload;
      feedbackCacheRef.current[feedbackId] = fb ?? null;
      return fb ?? null;
    } catch (err) {
      if (err && err.name === "AbortError") return null;
      console.error("fetchFeedbackOne:", err);
      setPageError(err.message || "Failed to fetch feedback");
      return null;
    } finally {
      try { delete fetchControllersRef.current[key]; } catch {}
    }
  }

  // --- Docs fetch with abort + cache ---
  async function fetchFeedbackDocs(feedbackId) {
    if (!feedbackId) return [];
    if (docsCacheRef.current[feedbackId]) return docsCacheRef.current[feedbackId];
    const key = `docs:${feedbackId}`;
    try { if (fetchControllersRef.current[key]) fetchControllersRef.current[key].abort(); } catch {}
    const controller = new AbortController();
    fetchControllersRef.current[key] = controller;
    setPageError(null);
    try {
      const url = `${API_BASE}/feedback/${encodeURIComponent(feedbackId)}`;
      const { ok, status, json, text, aborted } = await fetchWithCreds(url, { method: "GET", headers: authHeaders(), signal: controller.signal });
      if (aborted) return [];
      if (!ok) {
        if (status === 404) return [];
        const msg = (json && (json.message || json.error)) || text || `Failed to fetch docs: ${status}`;
        throw new Error(msg);
      }
      const payload = json ?? {};
      const fb = payload.result?.feedback ?? payload.feedback ?? payload.result ?? payload;
      let docsArr = fb?.docs ?? fb?.documents ?? fb?.files ?? fb?.attachments ?? fb?.photos ?? null;
      if (!Array.isArray(docsArr) && typeof fb === "object") {
        const candidates = ["docs", "documents", "files", "attachments", "photos", "images"];
        for (const c of candidates) if (Array.isArray(fb[c])) { docsArr = fb[c]; break; }
      }
      if (!Array.isArray(docsArr)) docsArr = [];
      const normalized = docsArr.map((item) => {
        if (!item) return null;
        if (typeof item === "string") return item;
        if (typeof item === "object") return item.url ?? item.link ?? item.path ?? item.file ?? item.src ?? item.location ?? null;
        return null;
      }).filter(Boolean);
      docsCacheRef.current[feedbackId] = normalized;
      return normalized;
    } catch (err) {
      if (err && err.name === "AbortError") return [];
      console.error("fetchFeedbackDocs:", err);
      setPageError(err.message || "Failed to fetch docs");
      return [];
    } finally {
      try { delete fetchControllersRef.current[key]; } catch {}
    }
  }

  async function openFeedbackModalById(e, feedbackId) {
    e?.stopPropagation?.();
    if (!feedbackId) return;
    if (modalOpen && modalTargetId === feedbackId && modalFeedback) return;
    setModalTargetId(feedbackId);
    setModalLoading(true);
    setModalFeedback(null);
    setModalOpen(true);
    try {
      const data = await fetchFeedbackOne(feedbackId);
      if (data) setModalFeedback(data);
    } catch (err) {
      console.error("openFeedbackModalById:", err);
      setModalFeedback(null);
    } finally {
      setModalLoading(false);
      setModalTargetId(null);
    }
  }

  async function openFeedbackDocsModalById(e, feedbackId) {
    e?.stopPropagation?.();
    if (!feedbackId) return;
    if (docsOpen && docsTargetId === feedbackId && docsDocs.length > 0) return;
    setDocsTargetId(feedbackId);
    setDocsLoading(true);
    setDocsDocs([]);
    setDocsTitle("Documents");
    setDocsOpen(true);
    try {
      const docsList = await fetchFeedbackDocs(feedbackId);
      setDocsDocs(docsList || []);
      try {
        const maybe = await fetchFeedbackOne(feedbackId);
        const title = (maybe && (maybe.name ?? maybe.title ?? maybe.feedbackId ?? maybe.id)) || "Documents";
        setDocsTitle(title);
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error("openFeedbackDocsModalById:", err);
      setDocsDocs([]);
      setDocsTitle("Documents");
    } finally {
      setDocsLoading(false);
      setDocsTargetId(null);
    }
  }

  function closeModal() {
    try {
      const key = modalTargetId ? `feedbackOne:${modalTargetId}` : null;
      if (key && fetchControllersRef.current[key]) { try { fetchControllersRef.current[key].abort(); } catch {} delete fetchControllersRef.current[key]; }
    } catch {}
    setModalOpen(false);
    setModalFeedback(null);
    setModalLoading(false);
    setModalTargetId(null);
  }

  function closeDocsModal() {
    try {
      const key = docsTargetId ? `docs:${docsTargetId}` : null;
      if (key && fetchControllersRef.current[key]) { try { fetchControllersRef.current[key].abort(); } catch {} delete fetchControllersRef.current[key]; }
    } catch {}
    setDocsOpen(false);
    setDocsDocs([]);
    setDocsTitle("Documents");
    setDocsLoading(false);
    setDocsTargetId(null);
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

  // ----------------- LOGS (line chart) with debounce + cache + abort -----------------
  // Chart visible only when NO filters active
  const showLogsChart = Boolean(villageId) && !nameFilter && !feedbackTypeFilter && !fromDateFilter && !toDateFilter;

  useEffect(() => {
    // Debounce logs fetch to avoid spam when filters change quickly
    const key = `${villageId || ""}|${nameFilter || ""}|${feedbackTypeFilter || ""}|${fromDateFilter || ""}|${toDateFilter || ""}`;
    // If chart shouldn't be shown, clear and don't fetch
    if (!showLogsChart) {
      // cancel any running logs fetch
      try { if (logsControllerRef.current) { logsControllerRef.current.abort(); logsControllerRef.current = null; } } catch {}
      setLogsItems([]);
      setLogsError(null);
      setLogsLoading(false);
      return;
    }

    let mounted = true;
    const tid = setTimeout(async () => {
      try {
        // cache hit?
        if (logsCacheRef.current[key]) {
          if (!mounted) return;
          setLogsItems(logsCacheRef.current[key]);
          setLogsError(null);
          setLogsLoading(false);
          return;
        }

        // abort previous
        try { if (logsControllerRef.current) { logsControllerRef.current.abort(); } } catch {}
        const controller = new AbortController();
        logsControllerRef.current = controller;
        setLogsLoading(true);
        setLogsError(null);

        const params = new URLSearchParams();
        params.append("type", "Feedback");
        if (villageId) params.append("villageId", villageId);
        params.append("page", "1");
        params.append("limit", String(Math.max(100, limit)));
        const url = `${API_BASE}/logs?${params.toString()}`;
        const { ok, status, json, text, aborted } = await fetchWithCreds(url, { method: "GET", headers: authHeaders(), signal: controller.signal });

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
    }, 420); // 420ms debounce

    return () => {
      mounted = false;
      clearTimeout(tid);
      // Abort controller left to next run or explicit cancel above
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, nameFilter, feedbackTypeFilter, fromDateFilter, toDateFilter, limit]);

  // ---------------- data loading effects ----------------
  // On mount / village change -> load list (loadAll ensures we don't double call)
  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [villageId]);

  // fetch list when page/limit/filters change
  useEffect(() => {
    // call fetchFeedbacks whenever page/limit/filters change
    // note: loadAll handles the village-change initial fetch path
    fetchFeedbacks(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, nameFilter, feedbackTypeFilter, fromDateFilter, toDateFilter]);

  // cleanup on unmount: abort controllers
  useEffect(() => {
    return () => {
      try {
        if (logsControllerRef.current) { logsControllerRef.current.abort(); logsControllerRef.current = null; }
      } catch {}
      const keys = Object.keys(fetchControllersRef.current);
      for (const k of keys) {
        try { fetchControllersRef.current[k]?.abort?.(); } catch {}
      }
      fetchControllersRef.current = {};
    };
  }, []);

  // ----------------- Small chart render helper -----------------
  function LogsLineChart({ items }) {
    if (!items || items.length === 0) {
      return <div className="text-sm text-gray-500">No activity logs available to plot.</div>;
    }

    function normalizeAction(a) {
      if (!a) return "other";
      const lower = String(a).toLowerCase();
      if (lower.includes("delete")) return "Delete";
      if (lower.includes("edited") || lower.includes("edit")) return "Edited";
      if (lower.includes("insert") || lower.includes("create") || lower.includes("added")) return "Insert";
      return "other";
    }

    const map = {};
    items.forEach((it) => {
      const timeStr = it.updateTime || it.update_time || it.time || it.createdAt || it.insertedAt || "";
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
      const act = normalizeAction(it.action ?? it.event ?? it.type ?? it.activity);
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

    const ticks = 4;
    const tickVals = Array.from({ length: ticks + 1 }).map((_, i) => Math.round((i / ticks) * maxVal));
    const colors = { Insert: "#10b981", Edited: "#f59e0b", Delete: "#ef4444" };

    return (
      <div className="bg-white rounded-lg border p-3 shadow-sm w-full">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-sm text-gray-600">Activity over time (logs)</div>
            <div className="text-lg font-semibold">Insert / Edited / Delete — Feedback</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">Showing logs (recent)</div>
            <div className="text-xs text-gray-400">• Chart hidden when filters active</div>
          </div>
        </div>

        <div className="overflow-auto">
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Feedback activity chart">
            <defs>
              <filter id="softShadow2" x="-50%" y="-50%" width="200%" height="200%">
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
                  <path d={d} fill="none" stroke={colors[key]} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "url(#softShadow2)" }} />
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

  // ----------------- Rendering -----------------
  if (loading) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">Loading …</div>
    </div>
  );

  if (!villageId) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="rounded-lg shadow p-6">
          <div className="text-lg font-semibold mb-2">No village selected</div>
          <div className="text-sm text-slate-600">Please select a village first.</div>
          <div className="mt-4">
            <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-600 text-white rounded">Go back</button>
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
            <h1 className="text-2xl font-semibold text-slate-800">Feedbacks</h1>
          </div>

          <div style={{ width: 120 }} />
        </div>

        {/* Filters */}
        <div className="bg-yellow-100 border rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end mb-4">
          <div className="flex flex-col">
            <label className="text-xs text-slate-600">Feedback type</label>
            <select value={feedbackTypeFilter} onChange={(e) => { setFeedbackTypeFilter(e.target.value); setPage(1); }} className="mt-1 px-3 py-2 border rounded-md shadow-sm">
              <option value="">ALL</option>
              <option value="complaint">Complaint</option>
              <option value="suggestion">Suggestion</option>
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
            <button onClick={() => { setPage(1); fetchFeedbacks(1, limit); }} className="px-4 py-2 bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-md">Apply</button>
            <button onClick={() => { setSearch(""); setNameFilter(""); setFeedbackTypeFilter(""); setFromDateFilter(""); setToDateFilter(""); setPage(1); fetchFeedbacks(1, limit); }} className="px-4 py-2 bg-white border rounded-md">Clear</button>
          </div>
        </div>

        {/* Pagination top */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-slate-600">
            <span className="text-sm px-3">Per page :</span>
            <select value={limit} onChange={async (e) => { const newLimit = Number(e.target.value) || 15; setLimit(newLimit); setPage(1); await fetchFeedbacks(1, newLimit); }} className="border rounded px-2 py-1">
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

        {/* Logs chart */}
        <div className="mb-4">
          {showLogsChart ? (
            logsLoading ? (
              <div className="text-sm text-gray-600 py-2">Loading activity chart…</div>
            ) : logsError ? (
              <div className="text-sm text-red-600 py-2">{logsError}</div>
            ) : (
              <LogsLineChart items={logsItems} />
            )
          ) : (
            <div className="text-sm text-gray-400 italic">Activity chart (Feedback) hidden while filters are active or village is not selected.</div>
          )}
        </div>

        {/* List */}
        {feedbacksLoading ? (
          <div className="text-sm text-slate-500">Loading feedbacks…</div>
        ) : (feedbacks || []).length === 0 ? (
          <div className="text-sm text-slate-500">No feedbacks found.</div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((u, idx) => {
              const key = u.feedbackId ?? u._id ?? u.id ?? `fb-${idx}`;
              const rawNotes = (u.comments ?? u.notes ?? u.description ?? u.message ?? "");
              const shortNotes = rawNotes.replace(/\s+/g, " ").slice(0, 400);
              const isExpanded = expandedNotesFor === key;
              const detailsLoadingForThis = modalLoading && modalTargetId === key;
              const docsLoadingForThis = docsLoading && docsTargetId === key;

              return (
                <motion.div
                  key={key}
                  ref={(el) => { if (el) feedbackRefs.current[key] = el; }}
                  tabIndex={0}
                  className={`relative overflow-hidden rounded-xl p-4 bg-blue-100 border border-slate-200 hover:shadow-lg transition transform hover:-translate-y-0.5 ${u.deleted ? "opacity-60" : ""}`}
                >
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-semibold text-slate-800 truncate">{u.name ?? u.title ?? `Feedback ${idx + 1}`}</div>
                            <div className="flex-shrink-0"><FeedbackTypeBadge type={u.feedbackType ?? u.type} /></div>
                          </div>

                          <div className="mt-3 text-sm text-slate-700 leading-relaxed">
                            {isExpanded ? rawNotes : `${shortNotes}${rawNotes.length > 400 ? "…" : ""}`}
                          </div>

                          <div className="mt-2 text-xs text-slate-600">Inserted by <span className="font-medium">{u.insertedBy ?? "—"}</span><span className="mx-2">•</span><span>{fmtDate(u.insertedAt)}</span></div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => openFeedbackModalById(e, u.feedbackId ?? u._id ?? u.id)}
                              disabled={detailsLoadingForThis}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${detailsLoadingForThis ? "bg-gray-200 text-slate-500 cursor-not-allowed" : "bg-gradient-to-br from-sky-600 to-indigo-600 text-white hover:scale-[1.01]"}`}
                            >
                              {detailsLoadingForThis ? (
                                <>
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path></svg>
                                  <span>Loading</span>
                                </>
                              ) : (
                                <><span>Details</span></>
                              )}
                            </button>

                            <button
                              onClick={(e) => openFeedbackDocsModalById(e, u.feedbackId ?? u._id ?? u.id)}
                              disabled={docsLoadingForThis}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 ${docsLoadingForThis ? "bg-gray-50 text-slate-400 cursor-not-allowed border" : "bg-white border rounded-lg text-sm hover:shadow-sm"}`}
                            >
                              {docsLoadingForThis ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path></svg> : <ImageIcon size={16} />}
                              <span>Docs</span>
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

      {/* Details modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black opacity-40" onClick={closeModal} style={{ backdropFilter: "blur(6px)" }} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-2xl mx-4">
            <div className="bg-[#f8f0dc] rounded-lg shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <div className="text-lg font-semibold">Feedback details</div>
                  <div className="text-xs text-slate-500">{modalLoading ? "Loading…" : (modalFeedback?.name ?? modalFeedback?.title ?? modalFeedback?.feedbackId ?? "Feedback")}</div>
                </div>
                <button onClick={closeModal} aria-label="Close" className="px-3 py-1 rounded bg-gray-100">Close</button>
              </div>

              <div className="p-4 max-h-[75vh] overflow-y-auto space-y-4">
                {modalLoading ? (
                  <div className="text-sm text-slate-500">Loading…</div>
                ) : modalFeedback ? (
                  <>
                    <div className="text-sm text-slate-700 leading-relaxed">{modalFeedback.comments ?? modalFeedback.notes ?? modalFeedback.description ?? "—"}</div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 mt-3">
                      <div>Feedback Type: <span className="font-medium">{modalFeedback.feedbackType ?? modalFeedback.type ?? "—"}</span></div>
                      <div>Type: <span className="font-medium">{modalFeedback.type ?? "—"}</span></div>
                      <div>Family ID: <span className="font-medium">{modalFeedback.familyId ?? "—"}</span></div>
                      <div>Email: <span className="font-medium">{modalFeedback.email ?? "—"}</span></div>
                      <div>Mobile: <span className="font-medium">{modalFeedback.mobile ?? "—"}</span></div>
                      <div>Inserted at: <span className="font-medium">{fmtDate(modalFeedback.insertedAt)}</span></div>
                      <div>Updated at: <span className="font-medium">{fmtDate(modalFeedback.updatedAt)}</span></div>
                    </div>

                    {Array.isArray(modalFeedback.statusHistory) && modalFeedback.statusHistory.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <div className="font-medium">Status history</div>
                        {modalFeedback.statusHistory.map((h, i) => (
                          <div key={i} className="border flex justify-between rounded-lg p-3 bg-indigo-100">
                            <div>
                              <div className="font-medium">{h.comments ?? "—"}</div>
                              <div className="text-xs text-slate-500 mt-1">By {h.verifier ?? "—"} • {fmtDate(h.time)}</div>
                            </div>
                            <div className="px-3 py-1"><StatusBadge status={h.status} /></div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-sm text-slate-500">No details available.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document modal */}
      <DocumentModal
        open={docsOpen}
        onClose={closeDocsModal}
        docs={docsDocs}
        title={docsTitle}
        loading={docsLoading}
      />
    </div>
  );
}
