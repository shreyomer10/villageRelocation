// src/pages/FeedbackPage.jsx
import React, { useEffect, useMemo, useState, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/Api.js";
import { ArrowLeft, Search, FileText, User, MapPin, CheckCircle, AlertTriangle, Printer, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/*
  Pagination-enabled FeedbackPage.
  - Uses doProtectedFetch (token -> refresh -> cookie fallback)
  - Expects backend response shape:
    { error: false, message: "...", result: { count, items, page, limit } }
*/

export default function FeedbackPage() {
  const navigate = useNavigate();
  const auth = useContext(AuthContext) || {};
  const { selectedVillageId } = auth;

  // localStorage fallback for village id
  const villageFromLS = (() => {
    try {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("villageId");
    } catch {
      return null;
    }
  })();
  const villageId = selectedVillageId ?? villageFromLS ?? null;

  // read token helper
  const readToken = useCallback(() => {
    if (auth?.token) return auth.token;
    if (auth?.authToken) return auth.authToken;
    if (auth?.user?.token) return auth.user.token;
    if (auth?.user?.accessToken) return auth.user.accessToken;
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

  // doProtectedFetch: tries token then refresh then cookie-only fallback
  const doProtectedFetch = useCallback(
    async (url, options = {}) => {
      const opts = { method: options.method ?? "GET", headers: { ...(options.headers || {}) }, body: options.body, signal: options.signal };
      const token = readToken();

      async function attemptFetch(sendAuthHeader) {
        const headers = { ...(opts.headers || {}) };
        if (sendAuthHeader && token) headers["Authorization"] = `Bearer ${token}`;
        if (!headers.Accept) headers.Accept = "application/json";
        if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

        const resp = await fetch(url, {
          method: opts.method,
          headers,
          body: opts.body,
          credentials: "include",
          signal: opts.signal,
        });
        return resp;
      }

      // If token available, try token flow first
      if (token) {
        try {
          const r1 = await attemptFetch(true);
          if (r1.status !== 401) return r1;

          // try refresh -> retry once
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
          // network/abort -> rethrow
          throw e;
        }
      }

      // cookie-only fallback
      try {
        const rCookie = await attemptFetch(false);
        return rCookie;
      } catch (e) {
        throw e;
      }
    },
    [auth, readToken]
  );

  // safe JSON parse
  function safeParseJson(text, res) {
    const ct = (res?.headers?.get?.("content-type") || "").toLowerCase();
    const trimmed = String(text || "").trim();
    if (!ct.includes("application/json") && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      const snippet = trimmed.slice(0, 400);
      throw new Error(`Expected JSON but got content-type="${ct}". Response starts with: ${snippet}`);
    }
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      const snippet = trimmed.slice(0, 400);
      throw new Error(`Invalid JSON: ${err.message}. Response (first 400 chars): ${snippet}`);
    }
  }

  // extract list and meta from backend response shape
  function parseListResponse(payload) {
    if (!payload) return { items: [], count: 0, page: 1, limit: 15 };
    const result = payload.result ?? payload;
    const items = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
    const count = Number(result?.count ?? result?.total ?? items.length) || 0;
    const page = Number(result?.page ?? result?.pageno ?? 1) || 1;
    const limit = Number(result?.limit ?? result?.pageSize ?? 15) || 15;
    return { items, count, page, limit };
  }

  // state for pagination + data
  const [feedbacks, setFeedbacks] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // search & tabs + modal state (kept from prior)
  const [tab, setTab] = useState("all");
  const [searchAll, setSearchAll] = useState("");
  const [searchSuggestion, setSearchSuggestion] = useState("");
  const [searchComplaint, setSearchComplaint] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalDetail, setModalDetail] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // reset page when village changes
  useEffect(() => {
    setPage(1);
  }, [villageId]);

  // load feedbacks with pagination
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      if (!villageId) {
        setFeedbacks([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      try {
        const url = `${API_BASE}/feedbacks/${encodeURIComponent(villageId)}?limit=${encodeURIComponent(limit)}&page=${encodeURIComponent(page)}`;
        const res = await doProtectedFetch(url, { method: "GET", signal: ctrl.signal });
        const text = await res.text().catch(() => "");

        if (res.status === 401) {
          if (!mounted) return;
          setFeedbacks([]);
          setTotalCount(0);
          setError("Unauthorized — please sign in or your session expired.");
          setLoading(false);
          return;
        }

        if (res.status === 404) {
          if (!mounted) return;
          setFeedbacks([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          const snippet = text.slice(0, 400);
          throw new Error(`HTTP ${res.status} ${res.statusText} — ${snippet}`);
        }

        const payload = safeParseJson(text, res);
        const { items, count, page: serverPage, limit: serverLimit } = parseListResponse(payload);

        if (!mounted) return;
        setFeedbacks(Array.isArray(items) ? items : []);
        setTotalCount(Number(count) || 0);
        // align client page/limit with server's returned values (if any)
        if (serverPage && serverPage !== page) setPage(serverPage);
        if (serverLimit && serverLimit !== limit) setLimit(serverLimit);
      } catch (err) {
        if (!mounted) return;
        if (err.name === "AbortError") {
          // ignore abort
        } else {
          setError(err.message || "Failed to fetch feedbacks");
          setFeedbacks([]);
          setTotalCount(0);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [villageId, page, limit, doProtectedFetch]);

  // helpers for UI classification and search (unchanged)
  function getFeedbackTag(f) {
    const idCandidates = [f.feedbackTypeId, f.typeId, f.type_id, f.feedback_type_id];
    for (const id of idCandidates) {
      if (id === undefined || id === null) continue;
      const n = Number(id);
      if (!Number.isNaN(n)) {
        if (n === 1) return { label: "Suggestion", color: "bg-indigo-50 text-indigo-700", icon: <CheckCircle size={14} /> };
        if (n === 2) return { label: "Complaint", color: "bg-red-50 text-red-700", icon: <AlertTriangle size={14} /> };
      }
    }
    const s = ((f.feedbackType || f.type || "") + "").toLowerCase();
    if (s.includes("complaint")) return { label: "Complaint", color: "bg-red-50 text-red-700", icon: <AlertTriangle size={14} /> };
    if (s.includes("suggest")) return { label: "Suggestion", color: "bg-indigo-50 text-indigo-700", icon: <CheckCircle size={14} /> };
    return { label: f.feedbackType || f.type || "Open", color: "bg-gray-50 text-gray-700", icon: null };
  }

  const allList = useMemo(() => (Array.isArray(feedbacks) ? feedbacks.slice().reverse() : []), [feedbacks]);
  const suggestionList = useMemo(() => allList.filter((f) => (getFeedbackTag(f).label || "").toLowerCase().includes("suggest")), [allList]);
  const complaintList = useMemo(() => allList.filter((f) => (getFeedbackTag(f).label || "").toLowerCase().includes("complaint")), [allList]);

  const matchSearch = (item, q) => {
    if (!q) return true;
    const s = String(q).toLowerCase().trim();
    const fields = [item.villageId, item.feedbackType, item.type, item.familyId, item.feedbackId, item.comments, item.name, item.plotId, item.mobile, item.email];
    return fields.some((f) => String(f ?? "").toLowerCase().includes(s));
  };

  const filteredAll = useMemo(() => allList.filter((f) => matchSearch(f, searchAll)), [allList, searchAll]);
  const filteredSuggestion = useMemo(() => suggestionList.filter((f) => matchSearch(f, searchSuggestion)), [suggestionList, searchSuggestion]);
  const filteredComplaint = useMemo(() => complaintList.filter((f) => matchSearch(f, searchComplaint)), [complaintList, searchComplaint]);

  function maybeThumbnail(docs) {
    const arr = Array.isArray(docs) ? docs : null;
    if (!arr || arr.length === 0) return null;
    const u = arr[0];
    if (typeof u !== "string") return null;
    if (u.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i)) return u;
    return null;
  }

  // open modal (uses doProtectedFetch)
  async function openModalWithFetch(feedbackId) {
    if (!feedbackId) return;
    setModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setModalDetail(null);
    setHistoryExpanded(false);

    try {
      const url = `${API_BASE}/feedback/${encodeURIComponent(feedbackId)}`;
      const res = await doProtectedFetch(url, { method: "GET" });
      const text = await res.text().catch(() => "");

      if (res.status === 401) {
        setModalError("Unauthorized — please log in again.");
        setModalLoading(false);
        return;
      }
      if (res.status === 404) {
        setModalError("Feedback not found.");
        setModalLoading(false);
        return;
      }
      if (!res.ok) {
        const snippet = text.slice(0, 400);
        throw new Error(`HTTP ${res.status} ${res.statusText} — response: ${snippet}`);
      }

      const payload = safeParseJson(text, res);
      const rawDetail = payload?.result?.feedback ?? payload?.feedback ?? payload?.result ?? payload ?? null;

      const rawHistory = rawDetail?.statusHistory ?? rawDetail?.status_history ?? rawDetail?.history ?? rawDetail?.statusHist ?? [];
      const normalizedHistory = Array.isArray(rawHistory)
        ? rawHistory.map((h) => {
            const comments = h.comments ?? h.message ?? h.note ?? h.status ?? "-";
            const verifier = h.verifier ?? h.by ?? h.user ?? h.handledBy ?? null;
            const time = h.time ?? h.insertedAt ?? h.created_at ?? h.timestamp ?? h.updatedAt ?? "-";
            return { ...h, comments, verifier, time };
          })
        : [];

      const docsArr = Array.isArray(rawDetail?.docs) ? rawDetail.docs : Array.isArray(rawDetail?.attachments) ? rawDetail.attachments : [];

      setModalDetail({ ...rawDetail, docs: docsArr, statusHistory: normalizedHistory });
    } catch (err) {
      setModalError(err.message || "Failed to fetch feedback detail");
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setModalDetail(null);
    setModalError(null);
    setHistoryExpanded(false);
  }

  function FeedbackCard({ f }) {
    const tag = getFeedbackTag(f) || { label: "-", color: "bg-gray-50 text-gray-700", icon: null };
    const attachmentUrl = (Array.isArray(f.docs) && f.docs[0]) || (Array.isArray(f.attachments) && f.attachments[0]) || null;

    return (
      <div onClick={() => openModalWithFetch(f.feedbackId)} className="w-full bg-white rounded-2xl p-4 shadow-md border mb-4 cursor-pointer hover:shadow-lg transition">
        <div className="flex gap-4 items-start">
          <div className="flex-1 gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold text-slate-800">{f.name ?? "—"}</div>
                  {tab === "all" && tag && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full ${tag.color}`} onClick={(e) => e.stopPropagation()}>
                      {tag.icon}
                      <span>{tag.label}</span>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1">{f.comments ?? "—"}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-xs text-gray-400">{f.insertedAt ?? f.updatedAt ?? "-"}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin size={14} /> <span className="truncate">{f.villageId ?? "—"} · {f.plotId ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={14} /> <span>{f.familyId ?? "—"}</span>
              </div>
              {attachmentUrl ? (
                <a onClick={(e) => e.stopPropagation()} href={attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border hover:bg-gray-50">
                  <FileText size={14} /> Open attachment
                </a>
              ) : (
                <div className="text-sm text-gray-400 px-3 py-2">No attachment</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Pagination UI helpers ---
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)));

  function gotoPage(p) {
    const np = Math.max(1, Math.min(totalPages, Number(p) || 1));
    if (np === page) return;
    setPage(np);
    // optional: scroll to top of list
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPageButtons() {
    // show up to 7 buttons with truncation
    const maxButtons = 7;
    const pages = [];
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // always include first, last, current +/- 1
      const left = Math.max(2, page - 1);
      const right = Math.min(totalPages - 1, page + 1);
      pages.push(1);
      if (left > 2) pages.push("left-ellipsis");
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < totalPages - 1) pages.push("right-ellipsis");
      pages.push(totalPages);
    }

    return pages.map((p, idx) => {
      if (p === "left-ellipsis" || p === "right-ellipsis") {
        return <span key={`e-${idx}`} className="px-3 py-1">…</span>;
      }
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

  // Modal component (keeps earlier modal UI)
  function Modal() {
    const history = modalDetail?.statusHistory ?? [];
    const toShow = historyExpanded ? history : [];

    return (
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
            <motion.div key={modalDetail?.feedbackId ?? "feedback-modal"} initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 28 }} className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl border overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-4 p-4 border-b">
                <div className="w-1 h-12 bg-indigo-600 rounded" />
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={maybeThumbnail(modalDetail?.docs) || "/placeholder-attachment.png"} alt="thumb" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Feedback ID</div>
                    <div className="font-semibold text-xl">{modalDetail?.feedbackId ?? "—"}</div>
                    <div className="text-sm text-gray-600 mt-1">{modalDetail?.name ?? "—"} · {modalDetail?.familyId ?? "—"}</div>
                    <div className="text-xs text-gray-500 mt-1">{modalDetail?.insertedAt ?? modalDetail?.updatedAt ?? "-"}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white hover:bg-gray-50">
                    <Printer size={14} /> Print
                  </button>
                  <button onClick={closeModal} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <div className="text-sm font-medium text-gray-700 mb-3">Status timeline</div>
                  {modalLoading ? <div className="text-sm text-gray-500">Loading…</div> : modalError ? <div className="text-sm text-red-600">{modalError}</div> : !history || history.length === 0 ? <div className="text-sm text-gray-500">No history.</div> : <>
                    {!historyExpanded && (
                      <div className="border rounded-md p-3 bg-white text-sm text-gray-600">
                        <div className="mb-2">Status history is hidden.</div>
                        <button onClick={(e) => { e.stopPropagation(); setHistoryExpanded(true); }} className="inline-flex items-center gap-2 text-indigo-600 text-sm underline">Show status history ({history.length})</button>
                      </div>
                    )}
                    {historyExpanded && (
                      <div className="relative pl-4">
                        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
                        <div className="space-y-6">
                          {toShow.slice().reverse().map((h, idx) => (
                            <div key={idx} className="relative">
                              <div className="absolute -left-0.5 top-1 w-3 h-3 rounded-full bg-white border border-gray-300 flex items-center justify-center">
                                <div className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-indigo-600" : "bg-gray-300"}`} />
                              </div>
                              <div className="ml-6">
                                <div className="text-sm font-medium text-slate-800">{h.comments ?? "—"}</div>
                                <div className="text-xs text-gray-500 mt-1">{h.verifier ?? "System"} · {h.time ?? "-"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4"><button onClick={(e) => { e.stopPropagation(); setHistoryExpanded(false); }} className="text-sm text-indigo-600 underline">Hide status history</button></div>
                      </div>
                    )}
                  </>}
                </div>

                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">Comments</div>
                      <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{modalLoading ? "Loading…" : modalDetail?.comments ?? "-"}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Type</div>
                        <div className="font-medium">{modalDetail?.feedbackType ?? modalDetail?.type ?? "-"}</div>
                        <div className="text-xs text-gray-500 mt-3">Inserted</div>
                        <div className="text-sm">{modalDetail?.insertedAt ?? modalDetail?.updatedAt ?? "-"}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Contact</div>
                        <div className="font-medium">{modalDetail?.mobile ?? modalDetail?.email ?? "-"}</div>
                        <div className="text-xs text-gray-500 mt-3">Family / Plot</div>
                        <div className="text-sm">{modalDetail?.familyId ?? "-"} · {modalDetail?.plotId ?? "-"}</div>
                      </div>
                    </div>

                    {Array.isArray(modalDetail?.docs) && modalDetail.docs.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500">Attachments</div>
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {modalDetail.docs.map((d, i) => (
                            <a key={i} href={d} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-gray-50">
                              <FileText size={14} /> View {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 ">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50">
              <ArrowLeft size={16} /> Back
            </button>
            
          </div>
          <div>
              <h1 className="text-2xl font-bold">Feedbacks</h1>
            </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setTab("all")} className={`px-4 py-2 rounded-md ${tab === "all" ? "bg-indigo-600 text-white shadow" : "bg-white hover:bg-gray-50"}`}>All</button>
            <button onClick={() => setTab("suggestion")} className={`px-4 py-2 rounded-md ${tab === "suggestion" ? "bg-indigo-600 text-white shadow" : "bg-white hover:bg-gray-50"}`}>Suggestions</button>
            <button onClick={() => setTab("complaint")} className={`px-4 py-2 rounded-md ${tab === "complaint" ? "bg-indigo-600 text-white shadow" : "bg-white hover:bg-gray-50"}`}>Complaints</button>
          </div>
        </div>

        <div className="w-full bg-white rounded-2xl p-4 shadow-sm border mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Selected village</div>
              <div className="text-lg font-semibold">{villageId ?? "—"}</div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-sm text-gray-600">
                <div className="text-xs text-gray-400">All</div>
                <div className="font-semibold">{allList.length}</div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="text-xs text-gray-400">Suggestions</div>
                <div className="font-semibold">{suggestionList.length}</div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="text-xs text-gray-400">Complaints</div>
                <div className="font-semibold">{complaintList.length}</div>
              </div>
            </div>
          </div>
        </div>

        <section>
          {error && <div className="mb-6 p-4 bg-red-50 border rounded-lg text-red-700">{error}</div>}

          {tab === "all" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">All feedbacks</div>
                <div className="text-sm text-gray-500">Total: {totalCount}</div>
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-3 border rounded-lg px-3 py-2  bg-white flex-1">
                  <Search size={18} />
                  <input value={searchAll} onChange={(e) => setSearchAll(e.target.value)} placeholder="Search villageId / feedbackType / familyId / feedbackId / comments" className="bg-transparent outline-none text-sm w-full" />
                  <button onClick={() => setSearchAll("")} className="text-sm px-3 py-1 rounded-md bg-gray-50">Clear</button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600">Page size</div>
                  <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="px-2 py-1 border rounded">
                    {[5, 10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {/* Pagination controls */}
              <div className=" flex items-center justify-between gap-4 py-5">
                <div className="text-sm text-gray-600">Showing {(Math.min(totalCount, (page - 1) * limit + 1))}–{Math.min(totalCount, page * limit)} of {totalCount}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => gotoPage(page - 1)} disabled={page <= 1} className={`px-3 py-1 rounded ${page <= 1 ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}>Prev</button>
                  <div className="flex items-center gap-1">{renderPageButtons()}</div>
                  <button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages} className={`px-3 py-1 rounded ${page >= totalPages ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}>Next</button>
                </div>
              </div>

              <div>
                {loading ? <div className="text-sm text-gray-500">Loading…</div> : filteredAll.length === 0 ? <div className="text-sm text-gray-500">No items.</div> : (
                  <div>
                    {filteredAll.map((f) => <FeedbackCard key={f.feedbackId ?? `${f.villageId}_${f.insertedAt}`} f={f} />)}
                  </div>
                )}
              </div>

              
            </div>
          )}

          {tab === "suggestion" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Suggestions</div>
                <div className="text-sm text-gray-500">Total: {suggestionList.length}</div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-white">
                  <Search size={18} />
                  <input value={searchSuggestion} onChange={(e) => setSearchSuggestion(e.target.value)} placeholder="Search by familyId / feedbackId / comments" className="bg-transparent outline-none text-sm w-full" />
                  <button onClick={() => setSearchSuggestion("")} className="text-sm px-3 py-1 rounded-md bg-gray-50">Clear</button>
                </div>
              </div>

              <div>
                {loading ? <div className="text-sm text-gray-500">Loading…</div> : filteredSuggestion.length === 0 ? <div className="text-sm text-gray-500">No items.</div> : <div>{filteredSuggestion.map((f) => <FeedbackCard key={f.feedbackId ?? `${f.villageId}_${f.insertedAt}`} f={f} />)}</div>}
              </div>
            </div>
          )}

          {tab === "complaint" && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Complaints</div>
                <div className="text-sm text-gray-500">Total: {complaintList.length}</div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-white">
                  <Search size={18} />
                  <input value={searchComplaint} onChange={(e) => setSearchComplaint(e.target.value)} placeholder="Search by familyId / feedbackId / comments" className="bg-transparent outline-none text-sm w-full" />
                  <button onClick={() => setSearchComplaint("")} className="text-sm px-3 py-1 rounded-md bg-gray-50">Clear</button>
                </div>
              </div>

              <div>
                {loading ? <div className="text-sm text-gray-500">Loading…</div> : filteredComplaint.length === 0 ? <div className="text-sm text-gray-500">No items.</div> : <div>{filteredComplaint.map((f) => <FeedbackCard key={f.feedbackId ?? `${f.villageId}_${f.insertedAt}`} f={f} />)}</div>}
              </div>
            </div>
          )}
        </section>

        <Modal />
      </main>
    </div>
  );
}
