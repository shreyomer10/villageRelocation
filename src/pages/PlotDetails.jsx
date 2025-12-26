// src/pages/PlotStagesPage.jsx
import React, { useEffect, useMemo, useState, useRef, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MainNavbar from '../component/MainNavbar';
import { API_BASE } from '../config/Api.js';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft, Search, Image as ImageIcon } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import DocumentModal from '../component/DocsModal';

function fmtDate(iso) {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString();
  } catch (e) {
    return iso;
  }
}

function StatusBadge({ status }) {
  const map = {
    '-1': { label: 'Deleted', color: 'bg-gray-100 text-gray-700' },
    '1': { label: 'Forest Guard', color: 'bg-yellow-200 text-yellow-800' },
    '2': { label: 'Range Assistant', color: 'bg-blue-300 text-blue-800' },
    '3': { label: 'Range Officer', color: 'bg-indigo-300 text-indigo-800' },
    '4': { label: 'Assistant Director', color: 'bg-green-300 text-green-800' }
  };
  const entry = map[String(status)] || { label: `Status ${status}`, color: 'bg-gray-100 text-gray-800' };
  return <span className={`text-xs px-2 py-1 rounded ${entry.color}`}>{entry.label}</span>;
}

function ProgressBar({ pct }) {
  return (
    <div className="w-48 h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: '#1e40af' }} className="h-full rounded transition-all duration-500" />
    </div>
  );
}

export default function PlotStagesPage() {
  const rawParams = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { plotId: contextPlotId, selectedPlot, villageId: contextVillageId } = useContext(AuthContext || {});

  let routePlotId = rawParams.plotId ?? rawParams.villageId ?? rawParams.plot_id ?? null;
  let routeVillageId = rawParams.villageId ?? rawParams.villageID ?? rawParams.village ?? null;

  if (!rawParams.plotId && rawParams.villageId && !rawParams.villageId.includes('/')) {
    if (rawParams.plotId == null && rawParams.villageId) {
      routeVillageId = null;
    }
  }

  const resolvePlotIdFromStorageDirect = () => {
    try {
      const byKey = localStorage.getItem('plotId');
      if (byKey) return byKey;
      const rawSel = localStorage.getItem('selectedPlot');
      if (rawSel) {
        try {
          const parsed = JSON.parse(rawSel);
          const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
          if (normalized) return normalized.plotId ?? normalized.id ?? null;
        } catch {}
      }
    } catch {}
    return null;
  };

  const resolveVillageIdFromStorageDirect = () => {
    try {
      const byKey = localStorage.getItem('villageId') || localStorage.getItem('villageID');
      if (byKey) return byKey;
      const rawSel = localStorage.getItem('selectedPlot');
      if (rawSel) {
        try {
          const parsed = JSON.parse(rawSel);
          const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
          if (normalized) return normalized.villageId ?? normalized.village ?? null;
        } catch {}
      }
    } catch {}
    return null;
  };

  const initialResolvedPlot = routePlotId
    || (location && location.state && location.state.selectedPlot && (location.state.selectedPlot.plotId ?? location.state.selectedPlot.id))
    || contextPlotId
    || (selectedPlot && (selectedPlot.plotId ?? selectedPlot.id))
    || resolvePlotIdFromStorageDirect();

  const initialResolvedVillage = routeVillageId
    || (location && location.state && location.state.selectedPlot && (location.state.selectedPlot.villageId ?? location.state.selectedPlot.village))
    || contextVillageId
    || (selectedPlot && (selectedPlot.villageId ?? selectedPlot.village))
    || resolveVillageIdFromStorageDirect();

  const [resolvedPlotId, setResolvedPlotId] = useState(initialResolvedPlot);
  const [resolvedVillageId, setResolvedVillageId] = useState(initialResolvedVillage);

  useEffect(() => {
    const newRoutePlot = routePlotId
      || (location && location.state && location.state.selectedPlot && (location.state.selectedPlot.plotId ?? location.state.selectedPlot.id))
      || contextPlotId
      || (selectedPlot && (selectedPlot.plotId ?? selectedPlot.id))
      || resolvePlotIdFromStorageDirect();

    if (newRoutePlot) setResolvedPlotId(String(newRoutePlot));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePlotId, location && location.state && location.state.selectedPlot, contextPlotId, selectedPlot]);

  useEffect(() => {
    const newRouteVillage = routeVillageId
      || (location && location.state && location.state.selectedPlot && (location.state.selectedPlot.villageId ?? location.state.selectedPlot.village))
      || contextVillageId
      || (selectedPlot && (selectedPlot.villageId ?? selectedPlot.village))
      || resolveVillageIdFromStorageDirect();

    if (newRouteVillage) setResolvedVillageId(String(newRouteVillage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeVillageId, location && location.state && location.state.selectedPlot, contextVillageId, selectedPlot]);

  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      if (e.key === 'plotId') {
        setResolvedPlotId(e.newValue);
      }
      if (e.key === 'villageId' || e.key === 'villageID') {
        setResolvedVillageId(e.newValue);
      }
      if (e.key === 'selectedPlot') {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
          if (normalized && (normalized.plotId || normalized.id)) {
            setResolvedPlotId(String(normalized.plotId ?? normalized.id));
          }
          if (normalized && (normalized.villageId || normalized.village)) {
            setResolvedVillageId(String(normalized.villageId ?? normalized.village));
          }
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // page state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [plot, setPlot] = useState(null);
  const [buildings, setBuildings] = useState([]);

  // verifications state (server returns filtered results)
  const [verifications, setVerifications] = useState([]);
  const [verifLoading, setVerifLoading] = useState(false);

  // server-side filter state
  const [filteredStage, setFilteredStage] = useState(null);

  // FILTERS (homeId used as server-side search key)
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [search, setSearch] = useState(''); // will be sent to server as `homeId` (or change if backend expects `q`)

  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVerification, setModalVerification] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // docs modal
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [docsModalDocs, setDocsModalDocs] = useState([]);
  const [docsModalTitle, setDocsModalTitle] = useState('Documents');
  const [docsModalLoading, setDocsModalLoading] = useState(false);

  const stageRefs = useRef({});

  useEffect(() => { loadAll(); }, [resolvedVillageId, resolvedPlotId]); // load plot + buildings

  useEffect(() => {
    // whenever filters/pagination change, fetch from server
    fetchFieldVerifications(page, limit, filteredStage).catch(e => console.warn(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedVillageId, resolvedPlotId, page, limit, filteredStage, statusFilter, fromDateFilter, toDateFilter, search]);

  async function fetchWithCreds(url, opts = {}) {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        ...opts
      });
      const text = await res.text().catch(() => '');
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
      return { res, ok: res.ok, status: res.status, json, text };
    } catch (err) {
      return { res: null, ok: false, status: 0, json: null, text: String(err) };
    }
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchBuildings(),
        resolvedPlotId ? fetchPlot() : Promise.resolve()
      ]);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlot() {
    try {
      if (!resolvedPlotId) { setPlot(null); return; }
      const url = `${API_BASE}/plots/one/${encodeURIComponent(resolvedPlotId)}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: 'GET' });
      if (!ok) {
        if (status === 401) { const msg = (json && (json.message || json.error)) || text || 'Unauthorized — please sign in'; setError(msg); return; }
        const t = (json && (json.message || JSON.stringify(json))) || text || `Failed to fetch plot (status ${status})`;
        throw new Error(t);
      }
      const payload = json ?? {};
      let item = null;
      if (payload.result) {
        if (Array.isArray(payload.result.items) && payload.result.items.length > 0) item = payload.result.items[0];
        else if (typeof payload.result === 'object' && !Array.isArray(payload.result)) item = payload.result;
      }
      if (!item && Array.isArray(payload.items) && payload.items.length > 0) item = payload.items[0];
      if (!item && Array.isArray(payload) && payload.length > 0) item = payload[0];
      if (!item && payload && typeof payload === 'object' && !Array.isArray(payload)) {
        if (payload.plotId || payload.plot_id || payload.name || payload.familyId) item = payload;
      }
      if (!item) { setPlot(null); return; }
      const normalized = { ...item };
      normalized.docs = Array.isArray(item.docs) ? item.docs : [];
      normalized.stagesCompleted = Array.isArray(item.stagesCompleted) ? item.stagesCompleted : [];
      setPlot(normalized);
      try {
        const currentRoutePlot = rawParams.plotId || rawParams.plot_id;
        if (!currentRoutePlot && normalized.plotId) navigate(`/plots/one/${encodeURIComponent(String(normalized.plotId))}`, { replace: true });
      } catch {}
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error fetching plot');
      setPlot(null);
    }
  }

  async function fetchBuildings() {
    try {
      if (!resolvedVillageId) { setBuildings([]); return; }
      const url = `${API_BASE}/buildings/${encodeURIComponent(resolvedVillageId)}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: 'GET' });
      if (!ok) {
        if (status === 401) { const msg = (json && (json.message || json.error)) || text || 'Unauthorized — please sign in'; setError(msg); return; }
        console.warn('Failed to fetch buildings', status, text);
        setBuildings([]); return;
      }
      const payload = json ?? {};
      const items = payload?.result?.items ?? (Array.isArray(payload) ? payload : []);
      setBuildings(items);
    } catch (e) { console.error(e); setBuildings([]); }
  }

  /**
   * fetchFieldVerifications
   * - sends all filter params to server (server does all filtering)
   * - returns { items, count } for callers who need the immediate server result
   */
  async function fetchFieldVerifications(pageArg = page, limitArg = limit, currentStage = filteredStage) {
    setVerifLoading(true);
    try {
      if (!resolvedVillageId || !resolvedPlotId) {
        setVerifications([]);
        setPlot(prev => prev ? { ...prev, docs: [] } : prev);
        setTotalCount(0);
        return { items: [], count: 0 };
      }

      const qs = new URLSearchParams();
      qs.set('page', String(pageArg || 1));
      qs.set('limit', String(limitArg || 15));
      if (currentStage) qs.set('currentStage', String(currentStage));
      if (statusFilter) qs.set('status', String(statusFilter));
      if (fromDateFilter) qs.set('fromDate', String(fromDateFilter));
      if (toDateFilter) qs.set('toDate', String(toDateFilter));
      // server-side search parameter: homeId (change if backend uses different name)
      if (search) qs.set('name', String(search));

      const url = `${API_BASE}/field_verification/${encodeURIComponent(resolvedVillageId)}/${encodeURIComponent(resolvedPlotId)}?${qs.toString()}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: 'GET' });

      if (!ok) {
        if (status === 401) { const msg = (json && (json.message || json.error)) || text || 'Unauthorized — please sign in'; setError(msg); setVerifications([]); setPlot(prev => prev ? { ...prev, docs: [] } : prev); setTotalCount(0); return { items: [], count: 0 }; }
        console.warn('Failed to fetch verifications', status, text);
        setVerifications([]); setPlot(prev => prev ? { ...prev, docs: [] } : prev); setTotalCount(0); return { items: [], count: 0 };
      }

      const payload = json ?? {};
      let items = []; let count = 0;
      if (payload.result) { items = payload.result.items ?? []; count = payload.result.count ?? (payload.result.total ?? 0); }
      else if (Array.isArray(payload)) { items = payload; count = items.length; }
      else { items = payload.items ?? []; count = payload.count ?? 0; }
      items = Array.isArray(items) ? items : [];

      setVerifications(items);
      // keep plot.docs in sync with verifications so UI that expects plot.docs continues to work
      setPlot(prev => ({ ...(prev || {}), docs: items }));
      setTotalCount(Number(count) || 0);

      return { items, count: Number(count) || 0 };
    } catch (e) {
      console.error('fetchFieldVerifications error', e);
      setVerifications([]); setPlot(prev => prev ? { ...prev, docs: [] } : prev); setTotalCount(0);
      return { items: [], count: 0 };
    } finally { setVerifLoading(false); }
  }

  async function fetchVerification(verificationId) {
    try {
      if (!verificationId) return null;
      const url = `${API_BASE}/field_verification/one/${encodeURIComponent(verificationId)}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: 'GET' });
      if (!ok) { console.warn('Failed to fetch verification', status, text); return null; }
      const payload = json ?? {};
      const result = payload.result ?? payload;
      return result;
    } catch (e) { console.error('fetchVerification error', e); return null; }
  }

  // fetch only docs for a verification. Tries docs-only endpoints first and falls back to the full "one" endpoint.
  async function fetchVerificationDocs(verificationId) {
    if (!verificationId) return [];
    setDocsModalLoading(true);
    setError(null);
    try {
      const tryUrls = [
        `${API_BASE}/field_verification/docs/${encodeURIComponent(verificationId)}`,
        `${API_BASE}/field_verification/${encodeURIComponent(verificationId)}/docs`,
        `${API_BASE}/field_verification/one/${encodeURIComponent(verificationId)}`,
      ];

      for (let i = 0; i < tryUrls.length; i++) {
        const url = tryUrls[i];
        try {
          const { ok, status, json, text } = await fetchWithCreds(url, { method: 'GET' });
          if (!ok) {
            if (status === 404) continue; // try next candidate
            const msg = (json && (json.message || json.error)) || text || `Failed to fetch docs: ${status}`;
            throw new Error(msg);
          }

          const payload = json ?? {};
          let docsArr = null;

          // Common shapes
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
          } else {
            const obj = payload.result ?? payload ?? {};
            const candidates = ['docs', 'documents', 'photos', 'images', 'files', 'attachments'];
            for (const c of candidates) {
              if (Array.isArray(obj[c])) { docsArr = obj[c]; break; }
            }
          }

          if (!Array.isArray(docsArr)) docsArr = [];

          // Normalize to array of url strings where possible
          const normalized = (docsArr || []).map((item) => {
            if (!item) return null;
            if (typeof item === 'string') return item;
            if (typeof item === 'object') return item.url ?? item.link ?? item.path ?? item.file ?? item.src ?? item.location ?? null;
            return null;
          }).filter(Boolean);

          return normalized;
        } catch (innerErr) {
          console.warn(`fetchVerificationDocs candidate failed (${url}):`, innerErr?.message || innerErr);
          continue; // try next
        }
      }

      return [];
    } catch (err) {
      console.error('fetchVerificationDocs error', err);
      setError(err.message || 'Failed to fetch docs');
      return [];
    } finally {
      setDocsModalLoading(false);
    }
  }

  function findBuildingForPlot() {
    if (!plot || buildings.length === 0) return null;
    const idsToMatch = new Set([
      String(plot.plotId ?? ''), String(plot.buildingId ?? ''), String(plot._id ?? ''), String(plot.id ?? ''), String(plot.familyId ?? '')
    ]);
    const match = buildings.find(b => {
      const candidateIds = [b.buildingId, b._id, b.id, b.plotId, b.plot_id, b.familyId].map(x => x == null ? '' : String(x));
      return candidateIds.some(id => idsToMatch.has(id));
    });
    return match || null;
  }

  function getTypeName() {
    const b = findBuildingForPlot();
    if (b) return b.typeName ?? b.type ?? b.buildingType ?? b.type_id ?? b.name ?? '';
    return plot?.typeName ?? plot?.type ?? plot?.typeId ?? '';
  }

  function getStagesMap() {
    const building = findBuildingForPlot();
    if (building) {
      const possible = building.stages || building.stagesMap || building.stageMap || building.stage_list || building.stage_list_map || [];
      if (!Array.isArray(possible) && typeof possible === 'object') {
        return Object.entries(possible).map(([k, v], idx) => ({ id: k, name: v?.name ?? v ?? String(k), order: idx }));
      }
      return Array.isArray(possible) ? possible.map((s, idx) => {
        if (typeof s === 'string') return { id: s, name: s, order: idx };
        return { id: s.id ?? s.stageId ?? s.currentStage ?? `s-${idx}`, name: s.name ?? s.label ?? s.currentStage ?? `Stage ${idx + 1}`, order: idx };
      }) : [];
    }
    const docs = Array.isArray(plot?.docs) ? plot.docs : [];
    const seen = new Map();
    for (const d of docs) {
      const st = d.currentStage ?? d.stageId ?? d.current_stage ?? null;
      if (!st) continue;
      if (!seen.has(st)) {
        const nm = d.name ?? d.currentStage ?? st;
        seen.set(st, { id: st, name: nm, order: seen.size });
      }
    }
    return Array.from(seen.values());
  }

  function getCompletionDateForStage(stage) {
    if (!plot) return null;
    const candidates = plot.docs || [];
    let latest = null;
    for (const d of candidates) {
      const dStage = d.currentStage ?? d.stageId ?? d.current_stage ?? '';
      if (String(dStage) === String(stage.id) || String(dStage) === String(stage.name)) {
        const t = d.verifiedAt ?? d.insertedAt ?? null;
        if (t) {
          const dt = new Date(t);
          if (!latest || dt > latest) latest = dt;
        }
      }
    }
    return latest ? latest.toISOString() : null;
  }

  const stagesMap = useMemo(() => getStagesMap(), [buildings, plot]);
  const completed = Array.isArray(plot?.stagesCompleted) ? plot.stagesCompleted : [];
  const timeline = useMemo(() => stagesMap.map((st, idx) => {
    const name = st.name ?? st.label ?? String(st.id ?? `Stage ${idx + 1}`);
    const isCompleted = completed.includes(name) || completed.includes(st.id) || completed.includes(String(idx));
    const completionDate = isCompleted ? getCompletionDateForStage(st) : null;
    return { ...st, name, order: st.order ?? idx, isCompleted, completionDate };
  }), [stagesMap, completed, plot]);

  const completedCount = timeline.filter(t => t.isCompleted).length;
  const pct = stagesMap.length ? Math.round((completedCount / stagesMap.length) * 100) : 0;

  // NOTE: client-side filtering removed — server returns filtered `verifications`.
  const [expandedStage, setExpandedStage] = useState(null);
  useEffect(() => {
    if (!expandedStage) return undefined;
    const t = setTimeout(() => {
      const el = stageRefs.current[expandedStage];
      if (el && typeof el.scrollIntoView === 'function') {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (typeof el.focus === 'function') el.focus(); } catch (e) {}
      }
    }, 180);
    return () => clearTimeout(t);
  }, [expandedStage]);

  /**
   * Timeline click:
   * - request server filtered results for the clicked stage
   * - setFilteredStage accordingly (server will filter)
   * - inspect server result to find an initial verification to expand
   */
  async function onTimelineClick(t) {
    if (!t || !t.id) {
      setFilteredStage(null);
      setPage(1);
      await fetchFieldVerifications(1, limit, null);
      setExpandedStage(null);
      return;
    }
    const stageId = t.id;
    const same = String(filteredStage) === String(stageId);
    if (same) {
      setFilteredStage(null);
      setPage(1);
      await fetchFieldVerifications(1, limit, null);
      setExpandedStage(null);
    } else {
      setFilteredStage(stageId);
      setPage(1);
      // fetch server results and use returned items to compute first expandedStage
      const { items } = await fetchFieldVerifications(1, limit, stageId);
      let first = null;
      for (let i = 0; i < (items || []).length; i += 1) {
        const d = items[i];
        const st = d.currentStage ?? d.stageId ?? d.current_stage ?? '';
        if (String(st) === String(stageId)) {
          first = d.verificationId ?? d.verification ?? d.verification_id ?? d._id ?? null;
          if (first) break;
        }
      }
      if (first) setExpandedStage(first);
      else setExpandedStage(null);
    }
  }

  function closeModal() { setModalOpen(false); setModalVerification(null); }

  async function openHistoryModalById(e, verificationId) {
    e?.stopPropagation?.();
    setModalLoading(true); setModalVerification(null);
    try {
      const data = await fetchVerification(verificationId);
      if (data) setModalVerification(data);
      setModalOpen(true);
    } catch (err) {
      console.error('openHistoryModalById error', err);
      setModalVerification(null);
      setModalOpen(true);
    } finally {
      setModalLoading(false);
    }
  }

  /**
   * Open docs modal by fetching verification docs only and passing normalized list of URLs to DocumentModal.
   */
  async function openDocsModalById(e, verificationId) {
    e?.stopPropagation?.();
    setDocsModalLoading(true);
    setDocsModalDocs([]);
    setDocsModalTitle('Documents');
    setDocsModalOpen(true);
    try {
      const docsList = await fetchVerificationDocs(verificationId);
      setDocsModalDocs(docsList || []);

      // try to set a useful title using the verification's name if possible (non-blocking)
      try {
        const maybe = await fetchVerification(verificationId);
        const title = (maybe && (maybe.name ?? maybe.currentStage ?? maybe.title)) || 'Documents';
        setDocsModalTitle(title);
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('openDocsModalById error', err);
      setDocsModalDocs([]);
      setDocsModalTitle('Documents');
    } finally {
      setDocsModalLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)));
  function gotoPage(p) { const np = Math.max(1, Math.min(totalPages, Number(p) || 1)); if (np === page) return; setPage(np); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function renderPageButtons() {
    const maxButtons = 7; const pages = [];
    if (totalPages <= maxButtons) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      const left = Math.max(2, page - 1); const right = Math.min(totalPages - 1, page + 1);
      pages.push(1); if (left > 2) pages.push("left-ellipsis");
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < totalPages - 1) pages.push("right-ellipsis"); pages.push(totalPages);
    }
    return pages.map((p, idx) => {
      if (p === "left-ellipsis" || p === "right-ellipsis") return <span key={`e-${idx}`} className="px-3 py-1">…</span>;
      return (<button key={p} onClick={() => gotoPage(p)} className={`px-3 py-1 rounded ${p === page ? "bg-indigo-600 text-white" : "bg-white border hover:bg-gray-50"}`}>{p}</button>);
    });
  }

  async function goToPage(nextPage) { if (nextPage < 1 || nextPage > totalPages) return; setPage(nextPage); await fetchFieldVerifications(nextPage, limit, filteredStage); }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">Loading .…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className=" rounded-lg shadow p-6 text-center">
          <div className="text-lg font-semibold mb-2">{error}</div>
          <div className="mt-4">
            <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded mr-2">Go back</button>
            <button onClick={loadAll} className="px-4 py-2 bg-blue-600 text-white rounded">Retry</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!plot) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">No plot found.</div>
    </div>
  );

  const typeName = getTypeName();

  const applyFilters = async () => { setPage(1); await fetchFieldVerifications(1, limit, filteredStage); };
  const clearFilters = async () => { setStatusFilter(''); setFromDateFilter(''); setToDateFilter(''); setSearch(''); setFilteredStage(null); setPage(1); await fetchFieldVerifications(1, limit, null); };

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white flex items-center gap-2 text-sm text-slate-700"><ArrowLeft size={16}/> Back</button>
          </div>

          <div className="flex items-center  flex-col ">
            <h1 className="text-2xl font-semibold text-slate-800">{plot.name ?? plot.plotId} </h1>
             <div className="text-sm text-slate-600">{typeName ? `( ${typeName} )` : ''} </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-slate-800">Timeline</h3>
              <div className="text-xs text-slate-500">Stage order</div>
            </div>

            <div className="flex items-center gap-4">
              <ProgressBar pct={pct} />
              <div className="text-sm font-medium text-slate-700">{pct}%</div>
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="text-sm text-slate-500">No stage map available</div>
          ) : (
            <div className="relative px-4 py-4">
              <div className="relative">
                <div className="absolute left-4 right-4 top-0 h-12 flex items-center pointer-events-none" aria-hidden="true">
                  <div className="w-full h-0.5 bg-slate-200 rounded relative">
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 h-0.5 rounded" style={{ width: `${pct}%`, backgroundColor: '#1e40af', maxWidth: '100%' }} />
                  </div>
                </div>

                <div className="flex items-start justify-between relative z-10">
                  {timeline.map((t, i) => {
                    const stageKey = t.id ?? `s-${i}`;
                    const isCompleted = !!t.isCompleted;
                    const isFiltered = String(filteredStage) === String(stageKey);
                    return (
                      <div key={String(stageKey)} className="flex flex-col items-center cursor-pointer" style={{ width: `${100 / Math.max(1, timeline.length)}%`, maxWidth: 180 }} onClick={() => onTimelineClick(t)}>
                        <div className="h-12 flex items-center justify-center">
                          <button type="button" onClick={(e) => { e.stopPropagation(); onTimelineClick(t); }} className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition ${isCompleted ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg' : isFiltered ? 'bg-white text-blue-700 border-2 border-blue-700' : 'bg-white text-gray-400 border border-gray-300'}`} aria-pressed={isFiltered} aria-label={`${t.name} ${isCompleted ? 'completed' : isFiltered ? 'filtered' : 'upcoming'}`} title={t.name}>
                            {isCompleted ? '✓' : String(i + 1)}
                          </button>
                        </div>

                        <div className={`mt-2 text-center text-sm truncate ${isCompleted || isFiltered ? 'text-slate-800' : 'text-gray-400'}`}>{t.name}</div>

                        {t.completionDate && (<div className="text-xs text-slate-500 mt-1">{fmtDate(t.completionDate)}</div>)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stage cards */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-800">Verifications</h3>

              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-500 mr-3">Showing: <span className="font-medium">{filteredStage ? `${verifications.length} for selected stage (page ${page})` : `${verifications.length} total (page ${page})`}</span></div>
                <div className="relative"></div>
                {filteredStage && (<button onClick={() => { setFilteredStage(null); setPage(1); fetchFieldVerifications(1, limit, null); }} className="px-3 py-2 text-sm bg-white border rounded">Show all</button>)}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-yellow-100 from-white via-slate-50 to-white border rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
              <div className="flex flex-col">
                <label className="text-xs text-slate-600">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring">
                  <option value="">ALL</option>
                  <option value="1">Forest Guard</option>
                  <option value="2">Range Assistant</option>
                  <option value="3">Range Officer</option>
                  <option value="4">Assistant Director</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-slate-600">From date</label>
                <input type="date" value={fromDateFilter} onChange={(e) => setFromDateFilter(e.target.value)} className="mt-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring" />
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-slate-600">To date</label>
                <input type="date" value={toDateFilter} onChange={(e) => setToDateFilter(e.target.value)} className="mt-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring" />
              </div>

              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search " className="pl-9 pr-3 py-2 border rounded w-64 focus:outline-none focus:ring" />
                <div className="absolute left-3 top-2.5 text-slate-400"><Search size={16} /></div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button onClick={applyFilters} className="px-4 py-2 bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-md shadow hover:scale-[1.01]">Apply</button>
                <button onClick={clearFilters} className="px-4 py-2 bg-white border rounded-md">Clear</button>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-2">
              <div className="text-sm text-slate-600">
                <span className="text-sm px-3">Per page  :  </span>
                <select value={limit} onChange={async (e) => { const newLimit = Number(e.target.value) || 15; setLimit(newLimit); setPage(1); await fetchFieldVerifications(1, newLimit, filteredStage); }} className="border rounded px-2 py-1">
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
                <button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages} className={`px-3 py-1 rounded ${page >= totalPages ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}>Next</button>
              </div>
            </div>

            {verifLoading ? (
              <div className="text-sm text-slate-500">Loading verifications…</div>
            ) : verifications.length === 0 ? (
              <div className="text-sm text-slate-500">No verification found.</div>
            ) : verifications.map((s, idx) => {
              const key = s.verificationId ?? s.stageId ?? s._id ?? `stage-${idx}`;
              const refKey = s.verificationId ?? s.verification_id ?? s.verification ?? key;
              const shortNotes = (s.notes || '').replace(/\s+/g, ' ').slice(0, 500);

              return (
                <motion.div ref={el => { if (el) stageRefs.current[refKey] = el; }} tabIndex={0} key={key} className={`relative overflow-hidden rounded-xl p-4 bg-blue-100 border border-slate-200 hover:shadow-lg transition transform hover:-translate-y-0.5 ${s.deleted ? 'opacity-60' : ''}`}>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-semibold text-slate-800 truncate">{s.name ?? s.currentStage ?? `Stage ${idx + 1}`}</div>
                            <div className="flex-shrink-0"><StatusBadge status={s.status ?? 0} /></div>
                          </div>

                          <div className="mt-2 text-sm text-slate-700 leading-relaxed max-h-28 overflow-hidden">{shortNotes}{(s.notes || '').length > 500 ? '…' : ''}</div>

                          <div className="mt-3 text-xs text-slate-600">Inserted by <span className="font-medium">{s.insertedBy ?? '—'}</span><span className="mx-2">•</span><span>{fmtDate(s.insertedAt)}</span></div>

                          <div className="mt-2 text-xs text-slate-600">Verification: <span className="font-medium">{s.verifiedBy ?? '—'}</span><span className="mx-2">•</span><span>{fmtDate(s.verifiedAt)}</span></div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); openHistoryModalById(e, s.verificationId ?? s.verification_id ?? s.verification ?? s._id); }} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-lg text-sm hover:scale-[1.01] focus:outline-none">Status history</button>

                            <button onClick={(e) => { e.stopPropagation(); openDocsModalById(e, s.verificationId ?? s.verification_id ?? s.verification ?? s._id); }} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm hover:shadow-sm">
                              <ImageIcon size={16} /> <span>Docs</span>
                            </button>
                          </div>

                          <div className="text-xs text-slate-500">{s.deleted ? 'Deleted' : ''}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
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
                    <div className="text-xs text-slate-500">{modalLoading ? 'Loading…' : (modalVerification?.name ?? modalVerification?.currentStage ?? 'Verification')}</div>
                  </div>
                  <button onClick={closeModal} aria-label="Close" className="px-3 py-1 rounded bg-gray-100">Close</button>
                </div>

                <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
                  {modalLoading ? (
                    <div className="text-sm text-slate-500">Loading…</div>
                  ) : modalVerification ? (
                    <>
                      <div>
                        <div className="mt-2 space-y-2">
                          {Array.isArray(modalVerification.statusHistory) && modalVerification.statusHistory.length > 0 ? (
                            modalVerification.statusHistory.map((h, i) => (
                              <div key={i} className="border flex justify-between rounded-lg p-3 bg-indigo-100">
                                <div>
                                  <div className="font-medium">{h.comments ?? '—'}</div>
                                  <div className="text-xs text-slate-500 mt-1">By {h.verifier ?? '—'} • {fmtDate(h.time)}</div>
                                </div>
                                <div className="px-3 py-1"><StatusBadge status={h.status} /></div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-600">No status history available.</div>
                          )}
                        </div>
                      </div>

                      {Array.isArray(modalVerification.docs) && modalVerification.docs.length > 0 && (
                        <div>
                          <div className="font-medium">Documents</div>
                          <div className="mt-2 grid grid-cols-1 gap-2">
                            {modalVerification.docs.map((d, ii) => (
                              <div key={ii} className="flex items-center justify-between border rounded p-2">
                                <div className="flex items-center gap-2 text-slate-700 text-sm"><FileText size={16} /> <div className="truncate max-w-[360px]">{typeof d === 'string' ? d.split('/').pop() : (d.name ?? `Document ${ii + 1}`)}</div></div>
                                <div className="flex items-center gap-2">
                                  <a href={typeof d === 'string' ? d : d.url} target="_blank" rel="noreferrer" className="text-sm text-sky-600 underline">Open</a>
                                  <button onClick={(e) => { e.stopPropagation(); openDocsModalById(e, modalVerification.verificationId ?? modalVerification._id ?? modalVerification.verificationId ?? modalVerification.id); }} className="px-2 py-1 text-sm bg-white border rounded">View</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">No details available.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document modal (reusable) */}
        <DocumentModal
          open={docsModalOpen}
          onClose={() => { setDocsModalOpen(false); setDocsModalDocs([]); setDocsModalTitle('Documents'); }}
          docs={docsModalDocs}
          title={docsModalTitle}
          loading={docsModalLoading}
        />

      </div>
    </div>
  );
}
