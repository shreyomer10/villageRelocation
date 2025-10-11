// src/pages/FeedbackPage.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/Api.js";
import { ArrowLeft, Search, FileText, User, MapPin, Clock, CheckCircle, AlertTriangle, Printer, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Design goals (updated):
// - show an explicit tag (Complaint / Suggestion) on each card when viewing the ALL tab
// - map by common fields: feedbackTypeId, typeId, feedbackType, type, or numeric codes 1/2
// - modal restyled: cleaner header, thumbnail, vertical timeline with connectors, print button
// - timeline remains hidden on modal open and only expands when user clicks the link

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { selectedVillageId } = useContext(AuthContext) || {};

  const [localStorageVillageId] = useState(() => {
    try { return typeof window !== "undefined" ? localStorage.getItem("villageId") : null; } catch { return null; }
  });
  const villageId = selectedVillageId ?? localStorageVillageId;

  // data
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // tabs + per-section search
  const [tab, setTab] = useState("all");
  const [searchAll, setSearchAll] = useState("");
  const [searchSuggestion, setSearchSuggestion] = useState("");
  const [searchComplaint, setSearchComplaint] = useState("");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalDetail, setModalDetail] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    if (!villageId) return;
    let mounted = true;
    const ctrl = new AbortController();

    async function load() {
      setLoading(true); setError(null);
      try {
        const url = `${API_BASE}/feedbacks?villageId=${encodeURIComponent(villageId)}&limit=200`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const list = payload?.result?.data ?? payload?.data ?? payload?.result ?? payload ?? [];
        if (!mounted) return;
        setFeedbacks(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError") setError(err.message || "Failed to fetch feedbacks");
      } finally { if (mounted) setLoading(false); }
    }

    load();
    return () => { mounted = false; ctrl.abort(); };
  }, [villageId]);

  // derived lists
  const allList = useMemo(() => feedbacks.slice().reverse(), [feedbacks]);
  const suggestionList = useMemo(() => allList.filter((f) => ((f.feedbackType || f.type || "") + "").toLowerCase().includes("suggest")), [allList]);
  const complaintList = useMemo(() => allList.filter((f) => ((f.feedbackType || f.type || "") + "").toLowerCase().includes("complaint")), [allList]);

  // match helper
  const matchSearch = (item, q) => {
    if (!q) return true;
    const s = String(q).toLowerCase().trim();
    const fieldsToSearch = [item.villageId, item.feedbackType, item.type, item.familyId, item.feedbackId, item.comments, item.name, item.plotId, item.mobile, item.email];
    return fieldsToSearch.some((f) => String(f ?? "").toLowerCase().includes(s));
  };

  const filteredAll = useMemo(() => allList.filter((f) => matchSearch(f, searchAll)), [allList, searchAll]);
  const filteredSuggestion = useMemo(() => suggestionList.filter((f) => matchSearch(f, searchSuggestion)), [suggestionList, searchSuggestion]);
  const filteredComplaint = useMemo(() => complaintList.filter((f) => matchSearch(f, searchComplaint)), [complaintList, searchComplaint]);


  // new: determine tag from feedbackType id / type / strings
  function getFeedbackTag(f) {
    // try numeric ids first
    const idCandidates = [f.feedbackTypeId, f.typeId, f.type_id, f.feedback_type_id];
    for (const id of idCandidates) {
      if (id === undefined || id === null) continue;
      const n = Number(id);
      if (!Number.isNaN(n)) {
        // common mapping guesses: 1 => suggestion, 2 => complaint (adjust if your backend differs)
        if (n === 1) return { label: 'Suggestion', color: 'bg-indigo-50 text-indigo-700', icon: <CheckCircle size={14} /> };
        if (n === 2) return { label: 'Complaint', color: 'bg-red-50 text-red-700', icon: <AlertTriangle size={14} /> };
      }
    }

    // string-based fallback
    const s = ((f.feedbackType || f.type || '') + '').toLowerCase();
    if (s.includes('complaint')) return { label: 'Complaint', color: 'bg-red-50 text-red-700', icon: <AlertTriangle size={14} /> };
    if (s.includes('suggest')) return { label: 'Suggestion', color: 'bg-indigo-50 text-indigo-700', icon: <CheckCircle size={14} /> };

    // default neutral
    return { label: (f.feedbackType || f.type || 'Open') , color: 'bg-gray-50 text-gray-700', icon: null };
  }

  // fetch full detail when opening modal
  async function openModalWithFetch(feedbackId) {
    if (!feedbackId) return;
    setModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setModalDetail(null);
    // crucial: hide history on open
    setHistoryExpanded(false);

    try {
      const res = await fetch(`${API_BASE}/feedback/${encodeURIComponent(feedbackId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const detail = payload?.result?.feedback ?? payload?.feedback ?? payload ?? null;

      // --- Normalise history fields from various backend shapes ---
      const rawHistory = detail?.statusHistory ?? detail?.status_history ?? detail?.history ?? detail?.statusHist ?? [];
      const normalizedHistory = Array.isArray(rawHistory) ? rawHistory.map((h) => {
        // ensure consistent keys used by the UI
        const comments = h.comments ?? h.message ?? h.note ?? h.status ?? '-';
        const verifier = h.verifier ?? h.by ?? h.user ?? h.handledBy ?? null;
        const time = h.time ?? h.insertedAt ?? h.created_at ?? h.timestamp ?? h.updatedAt ?? '-';
        return { ...h, comments, verifier, time };
      }) : [];

      const normalizedDetail = {
        ...detail,
        docs: Array.isArray(detail?.docs) ? detail.docs : (detail?.attachments && Array.isArray(detail.attachments) ? detail.attachments : []),
        statusHistory: normalizedHistory
      };

      setModalDetail(normalizedDetail);
    } catch (err) {
      if (err.name !== "AbortError") setModalError(err.message || "Failed to fetch feedback detail");
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() { setModalOpen(false); setModalDetail(null); setModalError(null); setHistoryExpanded(false); }

  // small utility: render image thumbnail if docs[0] looks like an image
  function maybeThumbnail(docs) {
    if (!Array.isArray(docs) || docs.length === 0) return null;
    const u = docs[0];
    if (typeof u !== 'string') return null;
    if (u.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i)) return u;
    return null;
  }

  function FeedbackCard({ f }) {
    const tag = getFeedbackTag(f) || { label: '-', color: 'bg-gray-50 text-gray-700', icon: null };

    // safe values for right-column display
    const rightLabel = tag.label || (f.feedbackType || f.type || '-');
    const rightColor = tag.color || 'bg-gray-50 text-gray-700';

    return (
      <div onClick={() => openModalWithFetch(f.feedbackId)} className="w-full bg-white rounded-2xl p-4 shadow-md border mb-4 cursor-pointer hover:shadow-lg transition">
        <div className="flex gap-4 items-start">

          {/* middle: main content */}
          <div className="flex-1 gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold text-slate-800">{f.name ?? '—'}</div>

                  {/* show tag only when viewing ALL tab as requested */}
                  {tab === 'all' && tag && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full ${tag.color}`} onClick={(e) => e.stopPropagation()}>
                      {tag.icon}
                      <span>{tag.label}</span>
                    </div>
                  )}
                </div>

                <div className="text-sm text-gray-500 mt-1">{f.comments ?? '—'}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-xs text-gray-400">{f.insertedAt ?? f.updatedAt ?? '-'}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-2"><MapPin size={14} /> <span className="truncate">{f.villageId ?? '—'} · {f.plotId ?? '—'}</span></div>
              <div className="flex items-center gap-2"><User size={14} /> <span>{f.familyId ?? '—'}</span></div>
              <a onClick={(e) => e.stopPropagation()} href={Array.isArray(f.docs) && f.docs[0] ? f.docs[0] : '#'} target="_blank" rel="noreferrer" className=" py-2 rounded-lg text-sm bg-blue">Open attachment</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function StatusItem({ h, isLast }) {
    return (
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <div className={`w-3 h-3 rounded-full ${isLast ? 'bg-indigo-600' : 'bg-gray-300'}`} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800">{h.comments ?? '—'}</div>
          <div className="text-xs text-gray-500">{h.verifier ? h.verifier : 'System'} · {h.time ?? '-'}</div>
        </div>
      </div>
    );
  }

  function Modal() {
    const history = modalDetail?.statusHistory ?? [];

    // When historyExpanded is false we intentionally show no timeline items.
    const toShow = historyExpanded ? history : [];

    return (
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
            <motion.div key={modalDetail?.feedbackId ?? 'feedback-modal'} initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.98 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }} className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl border overflow-hidden" onClick={(e) => e.stopPropagation()}>

              {/* restyled header */}
              <div className="flex items-center gap-4 p-4 border-b">
                <div className="w-1 h-12 bg-indigo-600 rounded" />

                <div className="flex items-center gap-4 flex-1">
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={maybeThumbnail(modalDetail?.docs) || '/placeholder-attachment.png'} alt="thumb" className="w-full h-full object-cover" />
                  </div>

                  <div>
                    <div className="text-xs text-gray-400">Feedback ID</div>
                    <div className="font-semibold text-xl">{modalDetail?.feedbackId ?? '—'}</div>
                    <div className="text-sm text-gray-600 mt-1">{modalDetail?.name ?? '—'} · {modalDetail?.familyId ?? '—'}</div>
                    <div className="text-xs text-gray-500 mt-1">{modalDetail?.insertedAt ?? modalDetail?.updatedAt ?? '-'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white hover:bg-gray-50"><Printer size={14} /> Print</button>
                  <button onClick={closeModal} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"><X size={16} /></button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* left column: timeline placeholder and expandable area */}
                <div className="md:col-span-1">
                  <div className="text-sm font-medium text-gray-700 mb-3">Status timeline</div>

                  {modalLoading ? (
                    <div className="text-sm text-gray-500">Loading…</div>
                  ) : modalError ? (
                    <div className="text-sm text-red-600">{modalError}</div>
                  ) : !history || history.length === 0 ? (
                    <div className="text-sm text-gray-500">No history.</div>
                  ) : (
                    <>
                      {/* Collapsed placeholder: show only when not expanded */}
                      {!historyExpanded && (
                        <div className="border rounded-md p-3 bg-white text-sm text-gray-600">
                          <div className="mb-2">Status history is hidden.</div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setHistoryExpanded(true); }}
                            className="inline-flex items-center gap-2 text-indigo-600 text-sm underline"
                          >
                            Show status history ({history.length})
                          </button>
                        </div>
                      )}

                      {/* Expanded timeline */}
                      {historyExpanded && (
                        <div className="relative pl-4">
                          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
                          <div className="space-y-6">
                            {toShow.slice().reverse().map((h, idx) => (
                              <div key={idx} className="relative">
                                <div className="absolute -left-0.5 top-1 w-3 h-3 rounded-full bg-white border border-gray-300 flex items-center justify-center">
                                  <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                                </div>

                                <div className="ml-6">
                                  <div className="text-sm font-medium text-slate-800">{h.comments ?? '—'}</div>
                                  <div className="text-xs text-gray-500 mt-1">{h.verifier ?? 'System'} · {h.time ?? '-'}</div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4">
                            <button onClick={(e) => { e.stopPropagation(); setHistoryExpanded(false); }} className="text-sm text-indigo-600 underline">
                              Hide status history
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* right columns: details */}
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">Comments</div>
                      <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{modalLoading ? 'Loading…' : modalDetail?.comments ?? '-'}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Type</div>
                        <div className="font-medium">{modalDetail?.feedbackType ?? modalDetail?.type ?? '-'}</div>

                        <div className="text-xs text-gray-500 mt-3">Inserted</div>
                        <div className="text-sm">{modalDetail?.insertedAt ?? modalDetail?.updatedAt ?? '-'}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Contact</div>
                        <div className="font-medium">{modalDetail?.mobile ?? modalDetail?.email ?? '-'}</div>

                        <div className="text-xs text-gray-500 mt-3">Family / Plot</div>
                        <div className="text-sm">{modalDetail?.familyId ?? '-'} · {modalDetail?.plotId ?? '-'}</div>
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
      <MainNavbar village={villageId} showInNavbar={true} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50"><ArrowLeft size={16} /> Back</button>
            <div>
              <h1 className="text-2xl font-bold">Feedbacks</h1>
              <div className="text-sm text-gray-600">Village: <span className="font-medium">{villageId ?? '—'}</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setTab('all'); }} className={`px-4 py-2 rounded-md ${tab === 'all' ? 'bg-indigo-600 text-white shadow' : 'bg-white hover:bg-gray-50'}`}>All</button>
            <button onClick={() => { setTab('suggestion'); }} className={`px-4 py-2 rounded-md ${tab === 'suggestion' ? 'bg-indigo-600 text-white shadow' : 'bg-white hover:bg-gray-50'}`}>Suggestions</button>
            <button onClick={() => { setTab('complaint'); }} className={`px-4 py-2 rounded-md ${tab === 'complaint' ? 'bg-indigo-600 text-white shadow' : 'bg-white hover:bg-gray-50'}`}>Complaints</button>
          </div>
        </div>

        {/* compact village banner with counts */}
        <div className="w-full bg-white rounded-2xl p-4 shadow-sm border mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Selected village</div>
              <div className="text-lg font-semibold">{villageId ?? '—'}</div>
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

        {/* per-section UI */}
        <section>
          {tab === 'all' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">All feedbacks</div>
                <div className="text-sm text-gray-500">Total: {allList.length}</div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-white">
                  <Search size={18} />
                  <input value={searchAll} onChange={(e) => setSearchAll(e.target.value)} placeholder="Search villageId / feedbackType / familyId / feedbackId / comments" className="bg-transparent outline-none text-sm w-full" />
                  <button onClick={() => setSearchAll('')} className="text-sm px-3 py-1 rounded-md bg-gray-50">Clear</button>
                </div>
              </div>

              <div>
                {loading ? <div className="text-sm text-gray-500">Loading…</div> : error ? <div className="text-sm text-red-600">{error}</div> : filteredAll.length === 0 ? <div className="text-sm text-gray-500">No items.</div> : (
                  <div>
                    {filteredAll.map((f) => (
                      <FeedbackCard key={f.feedbackId || Math.random()} f={f} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'suggestion' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Suggestions</div>
                <div className="text-sm text-gray-500">Total: {suggestionList.length}</div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-white">
                  <Search size={18} />
                  <input value={searchSuggestion} onChange={(e) => setSearchSuggestion(e.target.value)} placeholder="Search by familyId / feedbackId / comments" className="bg-transparent outline-none text-sm w-full" />
                  <button onClick={() => setSearchSuggestion('')} className="text-sm px-3 py-1 rounded-md bg-gray-50">Clear</button>
                </div>
              </div>

              <div>
                {loading ? <div className="text-sm text-gray-500">Loading…</div> : error ? <div className="text-sm text-red-600">{error}</div> : filteredSuggestion.length === 0 ? <div className="text-sm text-gray-500">No items.</div> : (
                  <div>
                    {filteredSuggestion.map((f) => (
                      <FeedbackCard key={f.feedbackId || Math.random()} f={f} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'complaint' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Complaints</div>
                <div className="text-sm text-gray-500">Total: {complaintList.length}</div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-white">
                  <Search size={18} />
                  <input value={searchComplaint} onChange={(e) => setSearchComplaint(e.target.value)} placeholder="Search by familyId / feedbackId / comments" className="bg-transparent outline-none text-sm w-full" />
                  <button onClick={() => setSearchComplaint('')} className="text-sm px-3 py-1 rounded-md bg-gray-50">Clear</button>
                </div>
              </div>

              <div>
                {loading ? <div className="text-sm text-gray-500">Loading…</div> : error ? <div className="text-sm text-red-600">{error}</div> : filteredComplaint.length === 0 ? <div className="text-sm text-gray-500">No items.</div> : (
                  <div>
                    {filteredComplaint.map((f) => (
                      <FeedbackCard key={f.feedbackId || Math.random()} f={f} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <Modal />
      </main>
    </div>
  );
}
