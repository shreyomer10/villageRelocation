// src/pages/MeetingsPage.jsx
import React, { useEffect, useMemo, useState, useCallback, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { AuthContext } from "../context/AuthContext";
import DocsModal from "../component/DocsModal";
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

  // always use DocsModal for photos/docs; maintain its state here
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [docsModalItems, setDocsModalItems] = useState([]);
  const [docsModalType, setDocsModalType] = useState(null);
  const [docsModalMeeting, setDocsModalMeeting] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const modalOpen = Boolean(showModal || showDocsModal || showDeleteModal);

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
        // blob/object preview (created with URL.createObjectURL)
        if (typeof it === "string") {
          const s = it.trim();
          // consider valid url-like strings (http(s) or blob:)
          if (/^(https?:\/\/|blob:|data:)/i.test(s)) {
            return { url: s, name: s.split("/").pop() || s };
          }
          // if plain filename or other string that looks like doc name, include as name with null url
          return { url: /^(https?:\/\/|blob:|data:)/i.test(s) ? s : null, name: s };
        }
        if (typeof it === "object") {
          // common shapes: { url }, { src }, { path }, { name, url }
          const url = it.url || it.src || it.path || it.href || null;
          const name = it.name || (url ? String(url).split("/").pop() : null) || (it.filename || it.fileName) || null;
          if (url || name) return { url: url || null, name: name || String(it) };
          // fallback stringify
          try { return { url: null, name: JSON.stringify(it) }; } catch { return null; }
        }
        return null;
      })
      .filter(Boolean)
      // remove entries that are obviously empty (no url AND empty name)
      .filter(x => (x.url && String(x.url).trim()) || (x.name && String(x.name).trim()));
  }

  // Always open DocsModal with server-fresh data (preferred)
  async function openDocsModal(meeting, type) {
    try {
      if (!meeting || !meeting.meetingId) return;
      const details = await fetchMeetingDetails(meeting?.meetingId);
      const src = details ?? (meeting?.raw ?? meeting ?? {});
      const rawItems = type === "photos" ? (src.photos ?? src.photos_urls ?? src.photos_list ?? []) : (src.docs ?? src.documents ?? src.docs_list ?? []);
      const items = normalizeItemsList(rawItems);
      if (!items || items.length === 0) {
        // do not open modal if no items
        return;
      }
      setDocsModalItems(items);
      setDocsModalType(type);
      setDocsModalMeeting(meeting);
      setShowDocsModal(true);
    } catch (err) {
      console.warn("openDocsModal error:", err);
    }
  }

  // Directly open DocsModal with items you already have (local blob previews etc)
  function showDocsModalWithItems(items, type = "photos", meeting = null) {
    const normalized = normalizeItemsList(items);
    if (!normalized || normalized.length === 0) return;
    setDocsModalItems(normalized);
    setDocsModalType(type);
    setDocsModalMeeting(meeting);
    setShowDocsModal(true);
  }

  // load meetings
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

  function openEdit(meeting) { setEditing(meeting); setShowModal(true); }
  function openAdd() { setEditing(null); setShowModal(true); }

  // Save meeting (insert or update) - expects JSON (files handled in modal's flow)
  async function saveMeeting(formData, files = {}, photoPreviewsFromModal = []) {
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

      // include photos (strings) only if they look like strings (URLs or blob)
      const photos = (photoPreviewsFromModal || []).filter(p => typeof p === "string");
      if (photos.length) payload.photos = photos;

      // include docs that are URLs (server expects doc URLs in JSON). Local file uploads are not automatically handled by this endpoint.
      const docUrls = (formData.docs || []).filter(d => typeof d === "string" && /^https?:\/\//i.test(d));
      if (docUrls.length) payload.docs = docUrls;

      if (!payload.userId) throw new Error("userId missing — please sign in again.");
      if (!payload.heldBy || !String(payload.heldBy).trim()) throw new Error("Provide 'Held By' — non-empty name is required.");

      if (editing && editing.meetingId) {
        // UPDATE flow (PUT)
        const url = `${API_BASE}/meetings/${encodeURIComponent(editing.meetingId)}`;
        const res = await doProtectedFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const txt = await res.text().catch(()=>"");
          setError(`Update failed: ${res.status} ${res.statusText} ${txt}`);
          throw new Error(`Update failed: ${res.status}`);
        }
        // After successful update, refresh list to reflect changes
        setRefreshCounter(s=>s+1);
        setShowModal(false);
        setEditing(null);
        return;
      } else {
        // INSERT flow (POST /meetings/insert) - backend will generate meetingId and return created meeting in result
        const url = `${API_BASE}/meetings/insert`;
        const res = await doProtectedFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const text = await res.text().catch(()=>"");
        if (res.status !== 201 && !res.ok) {
          const txt = text.slice(0,400);
          setError(`Insert failed: ${res.status} ${res.statusText} ${txt}`);
          throw new Error(`Insert failed: ${res.status}`);
        }

        // parse response body to get created meeting
        let bodyObj = {};
        try { bodyObj = text ? JSON.parse(text) : {}; } catch (e) { bodyObj = {}; }
        const created = (bodyObj?.result ?? bodyObj) || null;

        if (created && (created.meetingId || created._id)) {
          const normalized = normalizeSingleMeeting(created);
          // Prepend to current list and maintain page limit
          setMeetings(prev => {
            const newList = [normalized, ...prev];
            // keep list to page size
            return newList.slice(0, limit);
          });
          setTotalCount(c => Number(c || 0) + 1);
          // ensure user sees first page (we just prepended)
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

  /* ---------------- Modal components (unchanged behavior, improved z-index) ---------------- */

  function MeetingModal({ onClose, initial }) {
    const init = initial || { venue: "", time: "", heldBy: currentUserName || "", notes: "", attendees: [], photos: [], docs: [] };
    const [venue, setVenue] = useState(init.venue || "");
    const [time, setTime] = useState(init.time ? new Date(init.time).toISOString().slice(0,16) : "");
    const [heldBy, setHeldBy] = useState(init.heldBy || (currentUserName || ""));
    const [notes, setNotes] = useState(init.notes || "");
    const [attendees, setAttendees] = useState(Array.isArray(init.attendees) ? [...init.attendees] : []);
    const [photoPreviews, setPhotoPreviews] = useState(init.photos ? [...init.photos] : []);
    const [photoFiles, setPhotoFiles] = useState([]); // File[]
    const [docUrlsOrNames, setDocUrlsOrNames] = useState(init.docs ? [...init.docs] : []);
    const [docFiles, setDocFiles] = useState([]); // File[]

    useEffect(() => {
      return () => {
        (photoPreviews || []).forEach(p => { try { if (p && p.startsWith && p.startsWith("blob:")) URL.revokeObjectURL(p); } catch {} });
      };
    }, [photoPreviews]);

    function addAttendee(name) { if (!name) return; setAttendees(s=>[...s, name]); }
    function removeAttendee(i) { setAttendees(s=>s.filter((_,idx)=>idx!==i)); }

    function onPhotoChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const urls = files.map(f=>URL.createObjectURL(f));
      setPhotoPreviews(s=>[...s, ...urls]);
      setPhotoFiles(s=>[...s, ...files]);
      e.target.value = "";
    }
    function onDocChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setDocFiles(s=>[...s, ...files]);
      setDocUrlsOrNames(s=>[...s, ...files.map(f=>f.name)]);
      e.target.value = "";
    }
    function removePhoto(idx) {
      setPhotoPreviews(s=>{
        const toRemove = s[idx];
        try { if (toRemove && toRemove.startsWith && toRemove.startsWith("blob:")) URL.revokeObjectURL(toRemove); } catch {}
        return s.filter((_,i)=>i!==idx);
      });
      setPhotoFiles(s=>s.filter((_,i)=>i!==idx));
    }
    function removeDoc(idx) {
      setDocUrlsOrNames(s=>s.filter((_,i)=>i!==idx));
      setDocFiles(s=>s.filter((_,i)=>i!==idx));
    }

    async function submit(e) {
      e.preventDefault();
      const sendData = {
        venue,
        time: time ? new Date(time).toISOString() : "",
        heldBy,
        notes,
        attendees,
        docs: (docUrlsOrNames || []).filter(d => typeof d === "string" && /^https?:\/\//i.test(d))
      };
      const files = { photos: photoFiles || [], docs: docFiles || [] };
      try {
        // Note: file upload is not implemented against /meetings/insert in this snippet.
        // If you need direct file upload, we should implement an upload endpoint or form-data upload step.
        await saveMeeting(sendData, files, photoPreviews);
      } catch (err) {
        // saveMeeting sets `error` for UI; we still keep modal open to let user retry/correct.
        return;
      }
    }

    // disable save if heldBy missing
    const saveDisabled = !heldBy || !heldBy.toString().trim();

    return (
      <div className="fixed inset-0 z-90 flex items-center justify-center bg-black bg-opacity-60 p-4" role="dialog" aria-modal="true">
        <form onSubmit={submit} className="w-full max-w-3xl bg-[#f8f0dc] rounded-2xl shadow-2xl p-5 md:p-6 overflow-auto max-h-[90vh]">
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
                {photoPreviews.map((p,idx)=>(<div key={idx} className="relative"><img src={p} alt="preview" className="w-20 h-20 object-cover rounded cursor-pointer" onClick={(e)=>{ e.stopPropagation(); showDocsModalWithItems([p], 'photos', null); }} /><button type="button" onClick={()=>removePhoto(idx)} className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 text-xs">✕</button></div>))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600">Documents (URLs or local files)</label>
              <input type="file" onChange={onDocChange} multiple className="w-full mt-1" />
              <div className="mt-2 space-y-1">
                {docUrlsOrNames.map((d,idx)=>(<div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <div className="text-sm truncate max-w-[200px]">
                    {typeof d === "string" && /^https?:\/\//i.test(d) ? (<a href={d} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{d}</a>) : (<span>{d}</span>)}
                  </div>
                  <button type="button" onClick={()=>removeDoc(idx)} className="text-xs text-red-500">Remove</button>
                </div>))}
              </div>
            </div>

          </div>
        </form>
      </div>
    );
  }

  function ConfirmDeleteModal({ meeting, onCancel, onConfirm }) {
    if (!meeting) return null;
    return (
      <div className="fixed inset-0 z-90 bg-black bg-opacity-45 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
          <div className="text-lg font-semibold mb-2">Confirm delete</div>
          <div className="text-sm text-gray-600 mb-4">Are you sure you want to delete meeting <span className="font-medium">{meeting.meetingId}</span> held by <span className="font-medium">{meeting.heldBy}</span>? This cannot be undone.</div>
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-100">Cancel</button>
            <button onClick={() => onConfirm(meeting)} className="px-4 py-2 rounded bg-red-600 text-white">Delete</button>
          </div>
        </div>
      </div>
    );
  }

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

  /* ------------------ Render ------------------ */
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

          <div className="mt-2 p-4">
            <div className="flex items-center justify-between mb-4"><div className="text-lg font-semibold">Meeting list</div><div className="text-sm text-gray-500">{loading ? 'Loading...' : `${(meetings||[]).length} meetings (showing ${Math.min(totalCount, (page-1)*limit+1)}–${Math.min(totalCount, page*limit)})`}</div></div>

            {error && <div className="text-sm text-red-500 mb-2">Error: {error}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(meetings||[]).map((m)=>{
                // determine photos/docs robustly using normalizeItemsList (prefer raw payload)
                const rawPhotosSource = (m.raw && (m.raw.photos ?? m.raw.photos_urls ?? m.raw.photos_list)) ?? m.photos ?? [];
                const rawDocsSource = (m.raw && (m.raw.docs ?? m.raw.documents ?? m.raw.docs_list)) ?? m.docs ?? [];
                const normalizedPhotos = normalizeItemsList(rawPhotosSource);
                const normalizedDocs = normalizeItemsList(rawDocsSource);

                const photosCount = normalizedPhotos.length;
                const docsCount = normalizedDocs.length;
                const cover = (normalizedPhotos && normalizedPhotos[0] && normalizedPhotos[0].url) ? normalizedPhotos[0].url : null;
                const heldByInitial = (m.heldBy && String(m.heldBy).trim().charAt(0).toUpperCase()) || "?";

                return (
                  <div
                    key={m.id}
                    className={`relative rounded-2xl overflow-hidden bg-blue-100 shadow-lg transform transition hover:-translate-y-1 hover:shadow-2xl`}
                    style={{ border: "1px solid rgba(15,23,42,0.04)" }}
                  >
                    {/* clickable cover image (if available) */}
                    {cover && (<div className="w-full h-40 bg-gray-100 overflow-hidden">
                      <img src={cover} alt="cover" className="w-full h-full object-cover cursor-pointer" onClick={(e)=>{ e.stopPropagation(); openDocsModal(m, 'photos'); }} />
                    </div>)}

                    <div className="p-4 pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {/* avatar circle */}
                          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold shadow-sm select-none">
                            {heldByInitial}
                          </div>
                          <div>
                            <div className="text-sm text-indigo-700 font-semibold">{m.heldBy || '—'}</div>
                            <div className="text-lg font-bold text-slate-800">{m.venue || '—'}</div>
                          </div>
                        </div>

                        {/* action buttons */}
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
                    <hr style={{border: "none", height: "2px",backgroundColor: "#ffffffff"}}/>

                    {/* footer buttons */}
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
      {showModal && (<MeetingModal initial={editing ? { ...editing, photos: editing.photos || [], docs: editing.docs || [] } : null} onClose={()=>{ setShowModal(false); setEditing(null); }} />)}

      {/* delete modal */}
      {showDeleteModal && (<ConfirmDeleteModal meeting={deleteTarget} onCancel={()=>{ setShowDeleteModal(false); setDeleteTarget(null); }} onConfirm={(m)=>handleDelete(m)} />)}

      {/* docs modal (always used for both photos & docs now) */}
      {showDocsModal && (<div className="fixed inset-0 z-90"><DocsModal items={docsModalItems} type={docsModalType} meeting={docsModalMeeting} onClose={() => { setShowDocsModal(false); setDocsModalItems([]); setDocsModalType(null); setDocsModalMeeting(null); }} /></div>)}
    </div>
  );
}
