// src/pages/MeetingsPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useContext, useRef } from "react";
import ReactDOM from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { AuthContext } from "../context/AuthContext";
// DocumentModal (your uploaded DocsModal component)
import DocumentModal from "../component/DocsModal";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";

/* --- Icons --- */
const IconAdd = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IconEdit = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 21l3-1 11-11 1-3-3 1L4 20z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IconDelete = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IconPhoto = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 15l-5-5-7 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IconDoc = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IconClock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2"/><path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IconUsers = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.2"/></svg>);

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch { return iso; }
}

/* ---------- ModalPortal (ensures modals are on top) ---------- */
function ModalPortal({ children }) {
  if (typeof document === "undefined") return <>{children}</>;
  return ReactDOM.createPortal(children, document.body);
}

/* ------------------ MeetingsPage ------------------ */
export default function MeetingsPage() {
  const navigate = useNavigate();
  const { villageId: paramVillageId } = useParams();
  const auth = useContext(AuthContext);

  const currentUserName = auth?.user?.name ?? auth?.user?.username ?? (() => {
    try { const raw = localStorage.getItem("user"); return raw ? JSON.parse(raw)?.name : ""; } catch { return ""; }
  })();

  const authVillageId =
    auth?.villageId ??
    auth?.village ??
    auth?.user?.villageId ??
    auth?.user?.village ??
    null;

  const lsVillageId = typeof window !== "undefined" ? localStorage.getItem("villageId") : null;
  const [villageIdState, setVillageIdState] = useState(paramVillageId ?? authVillageId ?? lsVillageId ?? null);

  useEffect(() => {
    if (paramVillageId) {
      setVillageIdState(paramVillageId);
      try { localStorage.setItem("villageId", paramVillageId); } catch {}
      return;
    }
    if (authVillageId) {
      setVillageIdState(authVillageId);
      try { localStorage.setItem("villageId", authVillageId); } catch {}
      return;
    }
    if (lsVillageId) {
      setVillageIdState(lsVillageId);
      return;
    }
    setVillageIdState(null);
  }, [paramVillageId, authVillageId, lsVillageId]);

  // pagination & data
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [meetings, setMeetings] = useState([]); // each item preserves the original API object in `.raw`
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showOnlyMine, setShowOnlyMine] = useState(false);

  // split search state
  const [venueInput, setVenueInput] = useState("");
  const [debouncedVenue, setDebouncedVenue] = useState("");
  const [heldByInput, setHeldByInput] = useState("");
  const [debouncedHeldBy, setDebouncedHeldBy] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedVenue((venueInput||"").trim()); setPage(1); }, 420);
    return () => clearTimeout(t);
  }, [venueInput]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedHeldBy((heldByInput||"").trim()); setPage(1); }, 420);
    return () => clearTimeout(t);
  }, [heldByInput]);

  const [showFilters, setShowFilters] = useState(false);

  // modal & UI state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  // DocumentModal state
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [docsModalItems, setDocsModalItems] = useState([]);
  const [docsModalType, setDocsModalType] = useState(null);
  const [docsModalMeeting, setDocsModalMeeting] = useState(null);
  const [docsModalLoading, setDocsModalLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const modalOpen = Boolean(showModal || showDocsModal || showDeleteModal);

  // lock body scroll while modal open
  useEffect(() => {
    const prev = typeof document !== "undefined" ? document.body.style.overflow : "";
    if (modalOpen) {
      try { document.body.style.overflow = "hidden"; } catch {}
    } else {
      try { document.body.style.overflow = prev || ""; } catch {}
    }
    return () => { try { document.body.style.overflow = prev || ""; } catch {} };
  }, [modalOpen]);

  // token utils (use auth.token if available)
  const readToken = useCallback(() => {
    if (!auth) return null;
    if (auth.token) return auth.token;
    if (auth.authToken) return auth.authToken;
    if (auth.user?.token) return auth.user.token;
    if (auth.user?.accessToken) return auth.user.accessToken;
    try {
      if (typeof window === "undefined") return null;
      const keys = ["token", "authToken", "accessToken", "maati_token", "maatiAuth", "id_token", "auth_token"];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v) return v;
      }
    } catch {}
    return null;
  }, [auth]);

  const doProtectedFetch = useCallback(async (url, options = {}) => {
    const opts = { method: options.method ?? "GET", headers: { ...(options.headers || {}) }, body: options.body, signal: options.signal, isFormData: options.isFormData || false };
    const token = readToken();

    async function attemptFetch(sendAuthHeader) {
      const headers = { ...(opts.headers || {}) };
      if (sendAuthHeader && token) headers["Authorization"] = `Bearer ${token}`;
      if (!headers.Accept) headers.Accept = "application/json";
      if (opts.body && !opts.isFormData && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
      const resp = await fetch(url, {
        method: opts.method,
        headers,
        body: opts.body,
        credentials: "include",
        signal: opts.signal,
      });
      return resp;
    }

    if (token) {
      try {
        const r1 = await attemptFetch(true);
        if (r1.status !== 401) return r1;
        if (typeof auth?.forceRefresh === "function") {
          try {
            const refreshResult = await auth.forceRefresh();
            if (refreshResult && refreshResult.ok) {
              const r2 = await attemptFetch(true);
              if (r2.status !== 401) return r2;
            }
          } catch {}
        }
      } catch (e) {
        throw e;
      }
    }

    try { const rCookie = await attemptFetch(false); return rCookie; } catch (e) { throw e; }
  }, [auth, readToken]);

  function parseListResponse(payload) {
    if (!payload) return { items: [], count: 0, page: 1, limit: 15 };
    const result = payload.result ?? payload;
    const items = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
    const count = Number(result?.count ?? result?.total ?? items.length) || 0;
    const page = Number(result?.page ?? result?.pageno ?? 1) || 1;
    const limit = Number(result?.limit ?? result?.pageSize ?? 15) || 15;
    return { items, count, page, limit };
  }

  // Helper: normalize a single meeting object (from server) to UI shape used in list
  function normalizeSingleMeeting(raw) {
    if (!raw) return null;
    const id = String(raw.meetingId ?? raw.meeting_id ?? raw._id ?? Math.random().toString(36).slice(2,9));
    const venue = raw.venue ?? raw.location ?? "—";
    const heldBy = raw.heldBy ?? raw.held_by ?? raw.by ?? "";
    const time = raw.time ?? raw.datetime ?? raw.date ?? null;
    const notes = raw.notes ?? raw.note ?? raw.description ?? "";
    const attendees = Array.isArray(raw.attendees) ? raw.attendees : (raw.attendees ? [raw.attendees] : []);
    const docs = Array.isArray(raw.docs) ? raw.docs : (raw.docs ? [raw.docs] : []);
    const photos = Array.isArray(raw.photos) ? raw.photos : (raw.photos ? [raw.photos] : []);
    return { id, meetingId: raw.meetingId ?? raw.meeting_id ?? raw._id ?? null, venue, heldBy, time, notes, attendees, docs, photos, raw };
  }

  // fetch meeting detail for modal (not used for direct-show)
  async function fetchMeetingDetails(meetingId) {
    try {
      if (!meetingId) return null;
      const url = `${API_BASE}/meetings/${encodeURIComponent(meetingId)}`;
      const res = await doProtectedFetch(url, { method: "GET" });
      if (res.status === 404) return null;
      if (!res.ok) {
        const txt = await res.text().catch(()=>"");
        throw new Error(`Failed to load meeting: ${res.status} ${txt}`);
      }
      const payload = await res.json().catch(()=>null);
      const data = payload?.result ?? payload;
      return data;
    } catch (err) {
      console.warn("fetchMeetingDetails error:", err);
      return null;
    }
  }

  // Normalizer for items (strings, objects, blob previews) -> { url, name }
  function normalizeItemsList(items) {
    const arr = Array.isArray(items) ? items : (items ? [items] : []);
    return arr
      .map(it => {
        if (!it) return null;
        if (typeof it === "string") {
          const s = it.trim();
          if (/^(https?:\/\/|blob:|data:)/i.test(s)) {
            return { url: s, name: s.split("/").pop() || s };
          }
          return { url: /^(https?:\/\/|blob:|data:)/i.test(s) ? s : null, name: s };
        }
        if (typeof it === "object") {
          const url = it.url || it.src || it.path || it.href || null;
          const name = it.name || (url ? String(url).split("/").pop() : null) || (it.filename || it.fileName) || null;
          if (url || name) return { url: url || null, name: name || String(it) };
          try { return { url: null, name: JSON.stringify(it) }; } catch { return null; }
        }
        return null;
      })
      .filter(Boolean)
      .filter(x => (x.url && String(x.url).trim()) || (x.name && String(x.name).trim()));
  }

  // Determine ownership: returns true if current user is owner (by heldBy match OR userId fields)
  function isMeetingOwned(meeting) {
    if (!meeting) return false;
    try {
      const heldByRaw = (meeting.heldBy ?? (meeting.raw && (meeting.raw.heldBy || meeting.raw.held_by || meeting.raw.by)) ?? "");
      if (heldByRaw && currentUserName) {
        if (String(heldByRaw).trim().toLowerCase() === String(currentUserName).trim().toLowerCase()) return true;
      }

      const ownerIdCandidates = new Set();
      const pushIf = (v) => { if (v !== undefined && v !== null && v !== "") ownerIdCandidates.add(String(v)); };
      const src = meeting.raw || meeting;
      pushIf(src.userId ?? src.user_id ?? src.createdBy ?? src.created_by ?? src.ownerId ?? src.owner_id ?? src.user ?? src.created_by_user);
      pushIf(meeting.userId ?? meeting.user_id);

      const currentIds = new Set();
      const cpush = (v) => { if (v !== undefined && v !== null && v !== "") currentIds.add(String(v)); };
      cpush(auth?.userId ?? auth?.user?.userId ?? auth?.user?.id ?? auth?.user?._id ?? null);
      try { const lsUid = localStorage.getItem("userId"); if (lsUid) cpush(lsUid); } catch {}
      try { const raw = localStorage.getItem("user"); if (raw) { const parsed = JSON.parse(raw); if (parsed?.id) cpush(parsed.id); if (parsed?._id) cpush(parsed._id); if (parsed?.userId) cpush(parsed.userId); } } catch {}

      for (const o of ownerIdCandidates) {
        if (currentIds.has(o)) return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  // Always open DocumentModal with server-fresh data (preferred)
  async function openDocsModal(meeting, type) {
    try {
      if (!meeting) return;
      setDocsModalItems([]);
      setDocsModalType(type);
      setDocsModalMeeting(meeting);
      setDocsModalLoading(true);
      setShowDocsModal(true);

      const details = await fetchMeetingDetails(meeting?.meetingId);
      const src = details ?? (meeting?.raw ?? meeting ?? {});
      const rawItems = type === "photos" ? (src.photos ?? src.photos_urls ?? src.photos_list ?? []) : (src.docs ?? src.documents ?? src.docs_list ?? []);
      const items = normalizeItemsList(rawItems);
      setDocsModalItems(items);
    } catch (err) {
      console.warn("openDocsModal error:", err);
      setDocsModalItems([]);
    } finally {
      setDocsModalLoading(false);
    }
  }

  // Directly open DocumentModal with items you already have (local blob previews etc)
  function showDocsModalWithItems(items, type = "photos", meeting = null) {
    const normalized = normalizeItemsList(items);
    setDocsModalItems(normalized || []);
    setDocsModalType(type);
    setDocsModalMeeting(meeting);
    setDocsModalLoading(false);
    setShowDocsModal(true);
  }

  // upload helpers for S3 endpoints (reused from your code)
  async function uploadSingleFileToServer(file, fieldName) {
    const fd = new FormData();
    fd.append(`files[${fieldName}]`, file);
    const res = await doProtectedFetch(`${API_BASE}/s3/upload`, { method: "POST", body: fd, isFormData: true });
    const text = await res.text().catch(()=>"");
    if (!res.ok) {
      const snippet = text.slice(0,400);
      throw new Error(`Upload failed: ${res.status} ${res.statusText} ${snippet}`);
    }
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch(e){ payload = {}; }
    const mapping = payload.result ?? payload;
    const s3_uri = mapping && mapping[fieldName] ? mapping[fieldName] : null;
    if (!s3_uri) {
      const values = Object.values(mapping || {});
      if (values.length === 1) return values[0];
      throw new Error("Upload response missing uploaded file URI");
    }
    return s3_uri;
  }

  async function getPresignedUrlForS3Uri(s3_uri) {
    const res = await doProtectedFetch(`${API_BASE}/s3/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ s3_uri }) });
    const text = await res.text().catch(()=>"");
    if (!res.ok) {
      const snippet = text.slice(0,400);
      throw new Error(`Get access URL failed: ${res.status} ${res.statusText} ${snippet}`);
    }
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
    const result = payload.result ?? payload;
    const url = result && result.url ? result.url : (result && result.access_url ? result.access_url : null);
    if (!url) throw new Error("Access endpoint returned no URL");
    return url;
  }

  async function deleteFileOnServer(publicUrl) {
    const res = await doProtectedFetch(`${API_BASE}/s3/delete`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: publicUrl }) });
    const text = await res.text().catch(()=>"");
    if (!res.ok) {
      const snippet = text.slice(0,400);
      throw new Error(`Delete failed: ${res.status} ${res.statusText} ${snippet}`);
    }
    return true;
  }

  // load meetings (original behavior preserved)
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!villageIdState) { setMeetings([]); setTotalCount(0); setLoading(false); return; }

        const useClientSideHeldBy = Boolean(debouncedHeldBy && !showOnlyMine);

        function normalizeItems(items) {
          const normalized = (items || []).map((raw) => ({
            id: String(raw.meetingId ?? raw.meeting_id ?? raw._id ?? Math.random().toString(36).slice(2,9)),
            meetingId: raw.meetingId ?? raw.meeting_id ?? raw._id ?? null,
            venue: raw.venue ?? raw.location ?? "—",
            heldBy: raw.heldBy ?? raw.held_by ?? raw.by ?? "",
            time: raw.time ?? raw.datetime ?? raw.date ?? null,
            notes: raw.notes ?? raw.note ?? raw.description ?? "",
            attendees: Array.isArray(raw.attendees) ? raw.attendees : (raw.attendees ? [raw.attendees] : []),
            docs: Array.isArray(raw.docs) ? raw.docs : (raw.docs ? [raw.docs] : []),
            photos: Array.isArray(raw.photos) ? raw.photos : (raw.photos ? [raw.photos] : []),
            raw,
          }));
          normalized.sort((a,b)=>{
            const at = a.time ? Date.parse(a.time) : NaN;
            const bt = b.time ? Date.parse(b.time) : NaN;
            if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
            if (Number.isNaN(at)) return 1;
            if (Number.isNaN(bt)) return -1;
            return bt - at;
          });
          return normalized;
        }

        async function fetchSinglePage(p) {
          const params = new URLSearchParams();
          params.set("limit", String(limit));
          params.set("page", String(p));
          if (debouncedVenue) params.set("venue", debouncedVenue);
          if (showOnlyMine && currentUserName) params.set("heldBy", currentUserName);

          const url = `${API_BASE}/meetings/${encodeURIComponent(villageIdState)}?${params.toString()}`;
          const res = await doProtectedFetch(url, { method: "GET", signal: ctrl.signal });
          const text = await res.text().catch(()=>"");
          if (res.status === 401) { throw new Error("Unauthorized — your session may have expired."); }
          if (res.status === 404) {
            return { items: [], count: 0, page: p, limit };
          }
          if (!res.ok) {
            const snippet = text.slice(0,400);
            throw new Error(`HTTP ${res.status} ${res.statusText} — ${snippet}`);
          }
          const payload = (() => {
            try { return JSON.parse(text || "{}"); } catch { return { result: [] }; }
          })();
          return parseListResponse(payload);
        }

        if (!useClientSideHeldBy) {
          const { items, count, page: serverPage, limit: serverLimit } = await fetchSinglePage(page);
          if (!mounted) return;
          const normalized = normalizeItems(items);
          setMeetings(normalized);
          setTotalCount(Number(count) || normalized.length);
          if (serverPage && serverPage !== page) setPage(serverPage);
          if (serverLimit && serverLimit !== limit) setLimit(serverLimit);
          setError(null);
          return;
        }

        // client side heldBy search path
        const maxPagesToFetch = 20;
        const fetchedRawItems = [];
        let serverTotalCount = null;
        let serverTotalPages = null;

        const firstPage = await fetchSinglePage(1);
        if (!mounted) return;
        serverTotalCount = Number(firstPage.count || 0);
        fetchedRawItems.push(...(firstPage.items || []));
        serverTotalPages = serverTotalCount && limit ? Math.max(1, Math.ceil(serverTotalCount / limit)) : 1;

        const pagesToFetch = Math.min(serverTotalPages, maxPagesToFetch);

        for (let p = 2; p <= pagesToFetch; p++) {
          if (ctrl.signal && ctrl.signal.aborted) break;
          try {
            const pageResp = await fetchSinglePage(p);
            if (!mounted) break;
            fetchedRawItems.push(...(pageResp.items || []));
            if (fetchedRawItems.length >= serverTotalCount) break;
          } catch (errFetchPage) {
            console.warn("Stopped extra page fetches due to:", errFetchPage);
            break;
          }
        }

        if (!mounted) return;

        const allNormalized = normalizeItems(fetchedRawItems);
        const q = (debouncedHeldBy || "").toLowerCase();
        const filtered = allNormalized.filter(it => String(it.heldBy || "").toLowerCase().includes(q));

        const clientTotal = filtered.length;
        const startIdx = (page - 1) * limit;
        const pageSlice = filtered.slice(startIdx, startIdx + limit);

        setMeetings(pageSlice);
        setTotalCount(clientTotal);
        return;

      } catch (err) {
        if (!mounted) return;
        setError(err.message || String(err));
        setMeetings([]);
        setTotalCount(0);
      } finally { if (mounted) setLoading(false); }
    }

    load();
    return () => { mounted = false; ctrl.abort(); };
  }, [villageIdState, page, limit, refreshCounter, doProtectedFetch, debouncedVenue, debouncedHeldBy, showOnlyMine, currentUserName]);

  // analytics
  const analytics = useMemo(() => {
    const byHeldBy = {};
    const byMonth = {};
    let totalAttendees = 0, meetingCount = 0;
    (meetings || []).forEach((m) => {
      const h = m.heldBy || "Unknown";
      byHeldBy[h] = (byHeldBy[h] || 0) + 1;
      const d = m.time ? new Date(m.time) : null;
      const monthKey = d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : "unknown";
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
      totalAttendees += (Array.isArray(m.attendees) ? m.attendees.length : (m.attendees ? 1 : 0));
      meetingCount += 1;
    });
    const pieData = Object.entries(byHeldBy).map(([name, value]) => ({ name, value }));
    const barData = Object.entries(byMonth).map(([month, count]) => ({ month, count })).sort((a,b)=>a.month.localeCompare(b.month));
    const avgAttendees = meetingCount ? (totalAttendees / meetingCount) : 0;
    return { pieData, barData, avgAttendees, meetingCount };
  }, [meetings]);

  const COLORS = ["#60a5fa", "#34d399", "#f59e0b", "#ef4444", "#a78bfa", "#f472b6", "#60a5fa"];

  // Delete
  async function handleDelete(meeting) {
    try {
      if (!meeting || !meeting.meetingId) return;
      if (!isMeetingOwned(meeting)) {
        setError("Delete failed: you are not the owner of this meeting.");
        setShowDeleteModal(false);
        setDeleteTarget(null);
        return;
      }

      const uidCandidates = [auth?.userId, auth?.user?.userId, auth?.user?.id, auth?.user?._id];
      const uid = uidCandidates.find(Boolean) || localStorage.getItem("userId") || null;
      if (!uid) {
        setError("Delete failed: user id not found in AuthContext.");
        setShowDeleteModal(false);
        setDeleteTarget(null);
        return;
      }

      const heldBy = (meeting.heldBy || "").toString().trim();
      if (!heldBy) {
        setError("Delete failed: meeting heldBy missing.");
        setShowDeleteModal(false);
        setDeleteTarget(null);
        return;
      }

      setMeetings(prev => prev.map(m => m.meetingId === meeting.meetingId ? { ...m, deleting: true } : m));
      const url = `${API_BASE}/meetings/${encodeURIComponent(meeting.meetingId)}`;
      const body = { userId: uid, heldBy };
      const res = await doProtectedFetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text().catch(()=>"");
        setError(`Delete failed: ${res.status} ${res.statusText} ${txt}`);
        setRefreshCounter(s=>s+1);
        setShowDeleteModal(false);
        setDeleteTarget(null);
        return;
      }
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setRefreshCounter(s=>s+1);
    } catch (err) {
      setError("Delete failed: " + (err.message || String(err)));
      setRefreshCounter(s=>s+1);
      setShowDeleteModal(false);
      setDeleteTarget(null);
    }
  }

  function openEdit(meeting) {
    if (!isMeetingOwned(meeting)) {
      setError("You can only edit meetings that you created/hold.");
      return;
    }
    setEditing(meeting); setShowModal(true);
  }
  function openAdd() { setEditing(null); setShowModal(true); }

  // Save meeting (insert or update) - expects JSON (files handled in modal's flow)
  async function saveMeeting(formData, files = {}, photoUrlsFromModal = [], docUrlsFromModal = []) {
    try {
      const payload = {
        villageId: villageIdState || "",
        venue: formData.venue || "",
        time: formData.time || "",
        heldBy: formData.heldBy || "",
        notes: formData.notes || "",
        attendees: Array.isArray(formData.attendees) ? formData.attendees : [],
        userId: auth?.userId ?? auth?.user?.id ?? auth?.user?._id ?? localStorage.getItem("userId") ?? null,
      };

      const photos = (photoUrlsFromModal || []).filter(p => typeof p === "string" && /^https?:\/\//i.test(p));
      if (photos.length) payload.photos = photos;

      const docUrls = (docUrlsFromModal || []).filter(d => typeof d === "string" && /^https?:\/\//i.test(d));
      if (docUrls.length) payload.docs = docUrls;

      if (!payload.userId) throw new Error("userId missing — please sign in again.");
      if (!payload.heldBy || !String(payload.heldBy).trim()) throw new Error("Provide 'Held By' — non-empty name is required.");

      if (editing && editing.meetingId) {
        if (!isMeetingOwned(editing)) {
          setError("Update failed: you are not the owner of this meeting.");
          throw new Error("Update failed: not owner");
        }

        // UPDATE flow (PUT)
        const url = `${API_BASE}/meetings/${encodeURIComponent(editing.meetingId)}`;
        const res = await doProtectedFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const txt = await res.text().catch(()=>"");
          setError(`Update failed: ${res.status} ${res.statusText} ${txt}`);
          throw new Error(`Update failed: ${res.status}`);
        }
        setRefreshCounter(s=>s+1);
        setShowModal(false);
        setEditing(null);
        return;
      } else {
        // INSERT flow (POST /meetings/insert) — backend expects userId in body; returns created meeting in result with 201
        const url = `${API_BASE}/meetings/insert`;
        const res = await doProtectedFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const text = await res.text().catch(()=>"");
        if (res.status !== 201 && !res.ok) {
          const txt = text.slice(0,400);
          setError(`Insert failed: ${res.status} ${res.statusText} ${txt}`);
          throw new Error(`Insert failed: ${res.status}`);
        }

        let bodyObj = {};
        try { bodyObj = text ? JSON.parse(text) : {}; } catch (e) { bodyObj = {}; }
        const created = (bodyObj?.result ?? bodyObj) || null;

        if (created && (created.meetingId || created._id)) {
          const normalized = normalizeSingleMeeting(created);
          setMeetings(prev => {
            const newList = [normalized, ...prev];
            return newList.slice(0, limit);
          });
          setTotalCount(c => Number(c || 0) + 1);
          setPage(1);
          setShowModal(false);
          setEditing(null);
          setError(null);
          return;
        } else {
          // fallback: server didn't return meeting object -> refresh from server
          setRefreshCounter(s=>s+1);
          setShowModal(false);
          setEditing(null);
          return;
        }
      }
    } catch (err) {
      setError("Save failed: " + (err.message || String(err)));
      throw err;
    }
  }

  /* ---------------- Modal components (rendered via portal) ---------------- */
  function MeetingModal({ onClose, initial }) {
    const init = initial || { venue: "", time: "", heldBy: currentUserName || "", notes: "", attendees: [], photos: [], docs: [] };
    const [venue, setVenue] = useState(init.venue || "");
    const [time, setTime] = useState(init.time ? new Date(init.time).toISOString().slice(0,16) : "");
    const [heldBy, setHeldBy] = useState(init.heldBy || (currentUserName || ""));
    const [notes, setNotes] = useState(init.notes || "");
    const [attendees, setAttendees] = useState(Array.isArray(init.attendees) ? [...init.attendees] : []);

    const [photoUploads, setPhotoUploads] = useState(() => {
      const arr = (init.photos || []).map((p, idx) => ({ id: `existing-photo-${idx}-${Math.random().toString(36).slice(2,6)}`, file: null, preview: null, s3_uri: null, url: p, uploading: false, name: p.split("/").pop() }));
      return arr;
    });
    const [docUploads, setDocUploads] = useState(() => {
      const arr = (init.docs || []).map((d, idx) => ({ id: `existing-doc-${idx}-${Math.random().toString(36).slice(2,6)}`, file: null, preview: null, s3_uri: null, url: d, uploading: false, name: d.split("/").pop() }));
      return arr;
    });

    useEffect(() => {
      return () => {
        (photoUploads || []).forEach(p => { try { if (p.preview && p.preview.startsWith && p.preview.startsWith("blob:")) URL.revokeObjectURL(p.preview); } catch {} });
      };
    }, [photoUploads]);

    function addAttendee(name) { if (!name) return; setAttendees(s=>[...s, name]); }
    function removeAttendee(i) { setAttendees(s=>s.filter((_,idx)=>idx!==i)); }

    async function uploadFileAndGetUrl(file, typePrefix = "file") {
      const fieldName = `${typePrefix}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      const s3_uri = await uploadSingleFileToServer(file, fieldName);
      const url = await getPresignedUrlForS3Uri(s3_uri);
      return { s3_uri, url, fieldName };
    }

    async function onPhotoChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const newEntries = files.map((file) => {
        const id = `up-photo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
        const preview = URL.createObjectURL(file);
        return { id, file, preview, s3_uri: null, url: null, uploading: true, name: file.name };
      });
      setPhotoUploads(prev => [...prev, ...newEntries]);
      e.target.value = "";

      for (const entry of newEntries) {
        try {
          const { s3_uri, url } = await uploadFileAndGetUrl(entry.file, "photos");
          setPhotoUploads(prev => prev.map(p => p.id === entry.id ? { ...p, s3_uri, url, uploading: false, preview: null } : p));
        } catch (err) {
          setError("Photo upload failed: " + (err.message || String(err)));
          setPhotoUploads(prev => prev.map(p => p.id === entry.id ? { ...p, uploading: false } : p));
        }
      }
    }

    async function onDocChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const newEntries = files.map((file) => {
        const id = `up-doc-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
        return { id, file, preview: null, s3_uri: null, url: null, uploading: true, name: file.name };
      });
      setDocUploads(prev => [...prev, ...newEntries]);
      e.target.value = "";

      for (const entry of newEntries) {
        try {
          const { s3_uri, url } = await uploadFileAndGetUrl(entry.file, "docs");
          setDocUploads(prev => prev.map(d => d.id === entry.id ? { ...d, s3_uri, url, uploading: false } : d));
        } catch (err) {
          setError("Document upload failed: " + (err.message || String(err)));
          setDocUploads(prev => prev.map(d => d.id === entry.id ? { ...d, uploading: false } : d));
        }
      }
    }

    async function removePhoto(idx) {
      const target = photoUploads[idx];
      if (!target) return;
      if (target.url) {
        try {
          await deleteFileOnServer(target.url);
        } catch (err) {
          setError("Failed to delete photo from server: " + (err.message || String(err)));
        }
      } else if (target.preview && target.preview.startsWith && target.preview.startsWith("blob:")) {
        try { URL.revokeObjectURL(target.preview); } catch {}
      }
      setPhotoUploads(prev => prev.filter((_,i)=>i!==idx));
    }

    async function removeDoc(idx) {
      const target = docUploads[idx];
      if (!target) return;
      if (target.url) {
        try {
          await deleteFileOnServer(target.url);
        } catch (err) {
          setError("Failed to delete document from server: " + (err.message || String(err)));
        }
      }
      setDocUploads(prev => prev.filter((_,i)=>i!==idx));
    }

    async function submit(e) {
      e.preventDefault();
      const sendData = {
        venue,
        time: time ? new Date(time).toISOString() : "",
        heldBy,
        notes,
        attendees,
      };

      const photoUrls = (photoUploads || []).map(p => p.url).filter(Boolean);
      const docUrls = (docUploads || []).map(d => d.url).filter(Boolean);

      try {
        await saveMeeting(sendData, {}, photoUrls, docUrls);
      } catch (err) {
        return;
      }
    }

    const saveDisabled = !heldBy || !heldBy.toString().trim();

    return (
      <ModalPortal>
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 99999 }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
          <form onSubmit={submit} className="relative w-full max-w-3xl bg-[#f8f0dc] rounded-2xl shadow-2xl p-5 md:p-6 overflow-auto max-h-[90vh]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-gray-500">Village</div>
                <div className="text-lg font-semibold">{villageIdState ?? "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-sm">Cancel</button>
                <button type="submit" disabled={saveDisabled} className={`px-4 py-2 rounded ${saveDisabled ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'} flex items-center gap-2`}>
                  <IconAdd /> Save
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Venue</label>
                <input value={venue} onChange={(e)=>setVenue(e.target.value)} className="w-full p-2 border rounded mt-1" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Time</label>
                <input type="datetime-local" value={time} onChange={(e)=>setTime(e.target.value)} className="w-full p-2 border rounded mt-1" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Held By</label>
                <input value={heldBy} onChange={(e)=>setHeldBy(e.target.value)} className="w-full p-2 border rounded mt-1" />
              </div>

              <div>
                <label className="text-xs text-gray-600">Attendees</label>
                <div className="mt-1">
                  <div className="flex gap-2">
                    <input id="attendeeInputModal" placeholder="Name" className="flex-1 p-2 border rounded" />
                    <button type="button" onClick={()=>{ const el = document.getElementById("attendeeInputModal"); if (!el) return; const v = el.value.trim(); if (!v) return; addAttendee(v); el.value = ""; }} className="px-3 py-2 bg-gray-100 rounded">+ Add</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {attendees.map((a,i)=>(<div key={i} className="px-2 py-1 bg-gray-50 border rounded text-sm flex items-center gap-2"><span>{a}</span><button type="button" onClick={()=>removeAttendee(i)} className="text-xs text-red-500">✕</button></div>))}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-gray-600">Notes</label>
                <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="w-full p-2 border rounded mt-1 h-28" />
              </div>

              <div>
                <label className="text-xs text-gray-600">Photos</label>
                <input type="file" accept="image/*" multiple onChange={onPhotoChange} className="w-full mt-1" />
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {photoUploads.map((p, idx) => (
                    <div key={p.id} className="relative">
                      <img
                        src={p.url || p.preview}
                        alt={p.name || "preview"}
                        className="w-20 h-20 object-cover rounded cursor-pointer"
                        onClick={(e)=>{ e.stopPropagation(); showDocsModalWithItems([p.url || p.preview], 'photos', null); }}
                      />
                      {p.uploading ? <div className="absolute inset-0 flex items-center justify-center text-xs bg-white/70">Uploading…</div> : null}
                      <button type="button" onClick={()=>removePhoto(idx)} className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600">Documents (local files will be uploaded)</label>
                <input type="file" onChange={onDocChange} multiple className="w-full mt-1" />
                <div className="mt-2 space-y-1">
                  {docUploads.map((d, idx)=>(<div key={d.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="text-sm truncate max-w-[200px]">
                      {d.url ? (<a href={d.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{d.name || d.url}</a>) : (<span>{d.name || "Uploading..."}</span>)}
                    </div>
                    <div className="flex items-center gap-2">
                      {d.uploading ? <div className="text-xs text-gray-500">Uploading…</div> : null}
                      <button type="button" onClick={()=>removeDoc(idx)} className="text-xs text-red-500">Remove</button>
                    </div>
                  </div>))}
                </div>
              </div>

            </div>
          </form>
        </div>
      </ModalPortal>
    );
  }

  function ConfirmDeleteModal({ meeting, onCancel, onConfirm }) {
    if (!meeting) return null;
    return (
      <ModalPortal>
        <div className="fixed inset-0 flex items-center justify-center p-4" role="dialog" aria-modal="true" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-black bg-opacity-45" onClick={onCancel} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
            <div className="text-lg font-semibold mb-2">Confirm delete</div>
            <div className="text-sm text-gray-600 mb-4">Are you sure you want to delete meeting <span className="font-medium">{meeting.meetingId}</span> held by <span className="font-medium">{meeting.heldBy}</span>? This cannot be undone.</div>
            <div className="flex justify-end gap-2">
              <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-100">Cancel</button>
              <button onClick={() => onConfirm(meeting)} className="px-4 py-2 rounded bg-red-600 text-white">Delete</button>
            </div>
          </div>
        </div>
      </ModalPortal>
    );
  }

  // ----------------- LOGS (line chart) -----------------
  const [logsItems, setLogsItems] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [logsTotalCount, setLogsTotalCount] = useState(null);

  // Chart should be hidden when filters are active
  const showLogsChart = Boolean(villageIdState) && !debouncedVenue && !debouncedHeldBy && !showOnlyMine;

  // fetch logs for Meetings
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
        params.append("type", "Meeting");
        if (villageIdState) params.append("villageId", villageIdState);
        // request first page of logs for chart; you can request larger limit if you want to aggregate more months
        params.append("page", "1");
        params.append("limit", String(Math.max(100, limit))); // fetch up to 100 by default for chart
        const url = `${API_BASE}/logs?${params.toString()}`;
        const res = await doProtectedFetch(url, { method: "GET" });
        const text = await res.text().catch(()=>"");
        if (!res.ok) {
          const msg = `Failed to fetch logs: ${res.status} ${res.statusText} ${text.slice(0,200)}`;
          throw new Error(msg);
        }
        const payload = (() => { try { return JSON.parse(text || "{}"); } catch { return null; } })();
        const result = payload?.result ?? payload ?? {};
        const items = result.items ?? (Array.isArray(result) ? result : []);
        const count = Number(result.count ?? null);
        if (!mounted) return;
        setLogsItems(Array.isArray(items) ? items : []);
        setLogsTotalCount(!Number.isNaN(count) ? count : null);
      } catch (err) {
        console.error("fetchLogs:", err);
        if (!mounted) return;
        setLogsError(err.message || "Failed to load logs");
        setLogsItems([]);
      } finally {
        if (mounted) setLogsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [showLogsChart, villageIdState, limit, doProtectedFetch]);

  // Logs line chart component (same style as other pages)
  function LogsLineChart({ items }) {
    if (!items || items.length === 0) {
      return <div className="text-sm text-gray-500">No activity logs available to plot.</div>;
    }

    function normalizeAction(a) {
      if (!a) return "other";
      const lower = String(a).toLowerCase();
      if (lower.includes("delete")) return "Delete";
      if (lower.includes("edited") || lower.includes("edit")) return "Edited";
      if (lower.includes("insert")) return "Insert";
      return "other";
    }

    const map = {}; // { 'YYYY-MM': { Insert, Edited, Delete } }
    items.forEach((it) => {
      const timeStr = it.updateTime || it.update_time || it.time || "";
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
            <div className="text-sm text-gray-600">Activity over time (logs)</div>
            <div className="text-lg font-semibold">Insert / Edited / Delete — Meetings</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">Showing logs (recent)</div>
            <div className="text-xs text-gray-400">• Chart hidden when filters active</div>
          </div>
        </div>

        <div className="overflow-auto">
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Meetings activity chart">
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

  // ---------------- RENDER ----------------
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)));
  function gotoPage(p) { const np = Math.max(1, Math.min(totalPages, Number(p) || 1)); if (np === page) return; setPage(np); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function renderPageButtons() {
    const maxButtons = 7; const pages = [];
    if (totalPages <= maxButtons) for (let i=1;i<=totalPages;i++) pages.push(i);
    else {
      const left = Math.max(2, page-1); const right = Math.min(totalPages-1, page+1);
      pages.push(1);
      if (left>2) pages.push('left-ellipsis');
      for (let i=left;i<=right;i++) pages.push(i);
      if (right<totalPages-1) pages.push('right-ellipsis');
      pages.push(totalPages);
    }
    return pages.map((p,idx)=>{ if (p==='left-ellipsis' || p==='right-ellipsis') return <span key={`e-${idx}`} className="px-3 py-1">…</span>; return (<button key={p} onClick={()=>gotoPage(p)} className={`px-3 py-1 rounded ${p===page ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>{p}</button>); });
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />

      {/* make background inert and softened when modal open */}
      <div className={modalOpen ? "pointer-events-none select-none opacity-80" : ""}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={()=>navigate('/home')} className="inline-flex items-center gap-1 bg-white border px-3 py-1 rounded-lg shadow-sm">← Back</button>
            <div className="text-2xl font-bold text-slate-800">Meetings</div>
            <div className="flex items-center gap-3">
              <button onClick={openAdd} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-2xl shadow hover:bg-indigo-700 transition"><IconAdd /> Add Meeting</button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className={`col-span-12 lg:col-span-4 transition-all ${showFilters ? '' : 'md:block'}`}>
              <div className={`bg-white rounded-2xl p-4 shadow border ${showFilters ? 'block' : 'hidden md:block'}`}>
                <div className="flex items-center justify-between mb-3"><div className="text-sm font-medium">Filters</div><div className="text-xs text-gray-400">{(meetings||[]).length} items</div></div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2"><input id="onlyMine" type="checkbox" checked={showOnlyMine} onChange={()=>{ setShowOnlyMine(v=>!v); setPage(1); }} /><label htmlFor="onlyMine" className="text-sm">Show only my meetings</label></div>

                  <div>
                    <label className="text-xs text-gray-600">Venue</label>
                    <input value={venueInput} onChange={(e)=>setVenueInput(e.target.value)} placeholder="Search by venue" className="w-full p-2 border rounded mt-1" />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Held by</label>
                    <input value={heldByInput} onChange={(e)=>setHeldByInput(e.target.value)} placeholder="Search by who held the meeting" className="w-full p-2 border rounded mt-1" />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={()=>{ setVenueInput(''); setDebouncedVenue(''); setHeldByInput(''); setDebouncedHeldBy(''); setShowOnlyMine(false); setPage(1); }} className="px-3 py-2 bg-gray-100 rounded">Clear</button>
                    <button onClick={()=>{ setVenueInput(''); setDebouncedVenue(''); setHeldByInput(''); setDebouncedHeldBy(''); setShowOnlyMine(true); setPage(1); }} className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded">My meetings</button>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-white rounded-2xl p-4 shadow">
                <div className="text-sm text-gray-500">Avg attendees</div>
                <div className="text-2xl font-semibold">{analytics.avgAttendees.toFixed(1)}</div>
                <div className="text-xs text-gray-400 mt-2">Based on {analytics.meetingCount} meetings</div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
              <div className="bg-white rounded-2xl p-4 shadow">
                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                  <div className="md:w-1/2 w-full flex flex-col items-center justify-center">
                    <div className="w-full"><div className="text-sm mb-2 pl-1">Meetings by Held By</div><div className="w-full h-56 flex items-center justify-center"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie dataKey="value" data={analytics.pieData} outerRadius="80%" innerRadius="45%" labelLine={false} paddingAngle={4}>{analytics.pieData.map((entry, idx)=>(<Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />))}</Pie><ReTooltip/></PieChart></ResponsiveContainer></div></div>
                  </div>
                  <div className="md:w-1/2 w-full"><div className="text-sm mb-2 pl-1">Monthly meetings</div><div className="w-full h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.barData} margin={{ top: 10, right: 16, left: 0, bottom: 24 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><ReTooltip /><Legend verticalAlign="bottom" height={30} wrapperStyle={{ paddingTop: 8 }} /><Bar dataKey="count" fill="#2563eb" barSize={36} radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></div>
                </div>

                <div className="mt-3 px-1 flex items-center justify-center text-xs text-gray-600"><div className="flex items-center gap-4 flex-wrap justify-center">{analytics.pieData.slice(0,6).map((p,i)=>(<div key={p.name} className="flex items-center gap-2"><div style={{ width: 12, height: 12, background: COLORS[i % COLORS.length], borderRadius: 3 }} /><div className="truncate max-w-[120px]">{p.name}</div></div>))}</div></div>
              </div>

              <div className="mt-6 flex items-center justify-between w-full">
                <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Page size:</span><select value={limit} onChange={(e)=>{ setLimit(Number(e.target.value)); setPage(1); }} className="p-2 border rounded">{[5,10,15,25,50].map(n=>(<option key={n} value={n}>{n}</option>))}</select></div>
                <div className="flex items-center gap-2"><button onClick={()=>gotoPage(page-1)} disabled={page<=1} className={`px-3 py-1 rounded ${page<=1 ? 'bg-gray-100 text-gray-400' : 'bg-white border'}`}>Prev</button><div className="flex items-center gap-1">{renderPageButtons()}</div><button onClick={()=>gotoPage(page+1)} disabled={page>=totalPages} className={`px-3 py-1 rounded ${page>=totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white border'}`}>Next</button></div>
              </div>

            </div>
          </div>

          {/* ---------- LOGS LINE CHART: placed between pagination & meetings list ---------- */}
          <div className="mt-6">
            {showLogsChart ? (
              logsLoading ? (
                <div className="text-sm text-gray-600 py-4">Loading activity chart…</div>
              ) : logsError ? (
                <div className="text-sm text-red-600 py-2">{logsError}</div>
              ) : (
                <LogsLineChart items={logsItems} />
              )
            ) : (
              <div className="text-sm text-gray-400 italic">Activity chart (Meetings) hidden while filters are active or village is not selected.</div>
            )}
          </div>

          <div className="mt-2 p-4">
            <div className="flex items-center justify-between mb-4"><div className="text-lg font-semibold">Meeting list</div><div className="text-sm text-gray-500">{loading ? 'Loading...' : `${(meetings||[]).length} meetings (showing ${Math.min(totalCount, (page-1)*limit+1)}–${Math.min(totalCount, page*limit)})`}</div></div>

            {error && <div className="text-sm text-red-500 mb-2">Error: {error}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(meetings||[]).map((m)=>{
                const rawPhotosSource = (m.raw && (m.raw.photos ?? m.raw.photos_urls ?? m.raw.photos_list)) ?? m.photos ?? [];
                const rawDocsSource = (m.raw && (m.raw.docs ?? m.raw.documents ?? m.raw.docs_list)) ?? m.docs ?? [];
                const normalizedPhotos = normalizeItemsList(rawPhotosSource);
                const normalizedDocs = normalizeItemsList(rawDocsSource);

                const photosCount = normalizedPhotos.length;
                const docsCount = normalizedDocs.length;
                const cover = (normalizedPhotos && normalizedPhotos[0] && normalizedPhotos[0].url) ? normalizedPhotos[0].url : null;
                const heldByInitial = (m.heldBy && String(m.heldBy).trim().charAt(0).toUpperCase()) || "?";

                const owned = isMeetingOwned(m);

                return (
                  <div
                    key={m.id}
                    className={`relative rounded-2xl overflow-hidden bg-blue-100 shadow-lg transform transition hover:-translate-y-1 hover:shadow-2xl`}
                    style={{ border: "1px solid rgba(15,23,42,0.04)" }}
                  >
                    <div className="p-4 pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold shadow-sm select-none">
                            {heldByInitial}
                          </div>
                          <div>
                            <div className="text-sm text-indigo-700 font-semibold">{m.heldBy || '—'}</div>
                            <div className="text-lg font-bold text-slate-800">{m.venue || '—'}</div>
                          </div>
                        </div>

                        {owned ? (
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={(e)=>{ e.stopPropagation(); openEdit(m); }}
                            title="Edit"
                            aria-label="Edit meeting"
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border text-indigo-600 hover:bg-indigo-50 shadow-sm"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={(e)=>{ e.stopPropagation(); setDeleteTarget(m); setShowDeleteModal(true); }}
                            title="Delete"
                            aria-label="Delete meeting"
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border text-red-500 hover:bg-red-50 shadow-sm"
                          >
                            <IconDelete />
                          </button>
                        </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-gray-400" title="Not editable by you">—</div>
                        )}
                      </div>

                      <div className="mt-3 text-sm text-slate-600 line-clamp-3">{m.notes || 'No description provided.'}</div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1"><IconUsers /></span>
                            <span>{Array.isArray(m.attendees) ? m.attendees.length : (m.attendees ? 1 : 0)} attendees</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1"><IconClock /></span>
                            <span>{formatDateTime(m.time)}</span>
                          </div>
                        </div>

                        <div className="text-xs text-gray-400">{/* placeholder for any right-side tiny info */}</div>
                      </div>
                    </div>

                    <div className="p-3 border-t bg-blue-100 flex items-center justify-center gap-3">
                      <button
                        onClick={(e)=>{ e.stopPropagation(); openDocsModal(m, 'photos'); }}
                        title={photosCount ? `Open ${photosCount} photos` : "No photos"}
                        disabled={photosCount === 0}
                        className={`px-3 py-2 rounded-full text-sm flex items-center gap-2 ${photosCount === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`}
                      >
                        <IconPhoto /> <span>Photos ({photosCount})</span>
                      </button>

                      <button
                        onClick={(e)=>{ e.stopPropagation(); openDocsModal(m, 'docs'); }}
                        title={docsCount ? `Open ${docsCount} docs` : "No docs"}
                        disabled={docsCount === 0}
                        className={`px-3 py-2 rounded-full text-sm flex items-center gap-2 ${docsCount === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border hover:bg-gray-50'}`}
                      >
                        <IconDoc /> <span>Docs ({docsCount})</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {(meetings||[]).length === 0 && !loading && (<div className="text-center text-gray-500 py-8 col-span-full">No meetings found. Click "Add Meeting" to create one.</div>)}
            </div>

          </div>
        </div>
      </div>

      {/* meeting modal */}
      {showModal && (
        <MeetingModal
          initial={editing ? { ...editing, photos: editing.photos || [], docs: editing.docs || [] } : null}
          onClose={()=>{ setShowModal(false); setEditing(null); }}
        />
      )}

      {/* delete modal */}
      {showDeleteModal && (
        <ConfirmDeleteModal meeting={deleteTarget} onCancel={()=>{ setShowDeleteModal(false); setDeleteTarget(null); }} onConfirm={(m)=>handleDelete(m)} />
      )}

      {/* DocumentModal used for both photos & docs (render portal-wrapped) */}
      {showDocsModal && (
        <ModalPortal>
          <div style={{ zIndex: 99999 }}>
            <DocumentModal
              open={showDocsModal}
              onClose={() => {
                setShowDocsModal(false);
                setDocsModalItems([]);
                setDocsModalType(null);
                setDocsModalMeeting(null);
                setDocsModalLoading(false);
              }}
              docs={docsModalItems}
              title={docsModalType === 'photos' ? 'Photos' : (docsModalType === 'docs' ? 'Documents' : 'Files')}
              loading={docsModalLoading}
            />
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
