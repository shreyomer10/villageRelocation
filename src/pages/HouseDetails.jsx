// src/pages/HomeDetailsPage.jsx
import React, { useEffect, useMemo, useState, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainNavbar from '../component/MainNavbar';
import { API_BASE } from '../config/Api.js';
import { motion } from 'framer-motion';
import { FileText, RefreshCw, ArrowLeft, Search } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import DocsModal from '../component/DocsModal';

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function StatusBadge({ status }) {
  const map = {
    '-1': { label: 'Deleted', cls: 'bg-gray-100 text-gray-700' },
    '1': { label: 'Forest Guard', cls: 'bg-yellow-200 text-yellow-800' },
    '2': { label: 'Range Assistant', cls: 'bg-blue-300 text-blue-800' },
    '3': { label: 'Range Officer', cls: 'bg-indigo-300 text-indigo-800' },
    '4': { label: 'Assistant Director', cls: 'bg-green-300 text-green-800' }
  };
  const e = map[String(status)] || { label: `Status ${status}`, cls: 'bg-gray-100 text-gray-800' };
  return <span className={`text-xs px-2 py-1 rounded ${e.cls}`}>{e.label}</span>;
}

export default function HomeDetailsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { plotId: ctxPlotId, selectedPlot, villageId: ctxVillageId } = useContext(AuthContext || {});

  const routePlotId = params.plotId ?? params.plot_id ?? null;
  const routeVillageId = params.villageId ?? params.village ?? params.villageID ?? null;

  const resolvePlotFromStorage = () => {
    try {
      const p = localStorage.getItem('plotId'); if (p) return p;
      const raw = localStorage.getItem('selectedPlot'); if (!raw) return null;
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
      return normalized ? (normalized.plotId ?? normalized.id) : null;
    } catch { return null; }
  };
  const resolveVillageFromStorage = () => {
    try {
      const v = localStorage.getItem('villageId') || localStorage.getItem('villageID'); if (v) return v;
      const raw = localStorage.getItem('selectedPlot'); if (!raw) return null;
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
      return normalized ? (normalized.villageId ?? normalized.village) : null;
    } catch { return null; }
  };

  const initialPlot = routePlotId
    || ctxPlotId
    || (selectedPlot && (selectedPlot.plotId ?? selectedPlot.id))
    || resolvePlotFromStorage();

  const initialVillage = routeVillageId
    || ctxVillageId
    || (selectedPlot && (selectedPlot.villageId ?? selectedPlot.village))
    || resolveVillageFromStorage();

  const [resolvedPlotId, setResolvedPlotId] = useState(initialPlot);
  const [resolvedVillageId, setResolvedVillageId] = useState(initialVillage);

  useEffect(() => {
    const p = routePlotId
      || ctxPlotId
      || (selectedPlot && (selectedPlot.plotId ?? selectedPlot.id))
      || resolvePlotFromStorage();
    if (p) setResolvedPlotId(String(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePlotId, ctxPlotId, selectedPlot]);

  useEffect(() => {
    const v = routeVillageId
      || ctxVillageId
      || (selectedPlot && (selectedPlot.villageId ?? selectedPlot.village))
      || resolveVillageFromStorage();
    if (v) setResolvedVillageId(String(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeVillageId, ctxVillageId, selectedPlot]);

  useEffect(() => {
    function onStorage(e) {
      if (!e.key) return;
      if (e.key === 'plotId') setResolvedPlotId(e.newValue);
      if (e.key === 'villageId' || e.key === 'villageID') setResolvedVillageId(e.newValue);
      if (e.key === 'selectedPlot') {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          const normalized = Array.isArray(parsed) ? parsed[0] ?? null : parsed;
          if (normalized && (normalized.plotId || normalized.id)) setResolvedPlotId(String(normalized.plotId ?? normalized.id));
          if (normalized && (normalized.villageId || normalized.village)) setResolvedVillageId(String(normalized.villageId ?? normalized.village));
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // UI & data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [house, setHouse] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [search, setSearch] = useState('');

  // verifications: fetched from server (no caching)
  const [verifications, setVerifications] = useState([]);
  const [verifLoading, setVerifLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // filters + pagination
  const [selectedHome, setSelectedHome] = useState(null);
  const [filteredStage, setFilteredStage] = useState(null); // server-side currentStage
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // server-side filters exposed in UI
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  // optional homeId filter (keeps compatibility if you want it)
  const [homeIdFilter, setHomeIdFilter] = useState('');
  // server-side name/search filter
  const [nameFilter, setNameFilter] = useState('');
  const searchDebounceRef = useRef(null);

  // modal (status history)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVerification, setModalVerification] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // modal (docs)
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [docsModalDocs, setDocsModalDocs] = useState(null);
  const [docsModalLoading, setDocsModalLoading] = useState(false);

  // abort controllers
  const fetchAbortRef = useRef(null);
  const modalAbortRef = useRef(null);

  async function fetchWithSignal(url, signal) {
    const opts = {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache'
      },
      signal
    };
    const res = await fetch(url, opts);
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: res.ok, status: res.status, json, text };
  }

  // House metadata
  async function fetchHouse() {
    try {
      if (!resolvedPlotId) { setHouse(null); return; }
      const url = `${API_BASE}/house/one/${encodeURIComponent(resolvedPlotId)}?_t=${Date.now()}`;
      const { ok, status, json, text } = await fetchWithSignal(url, null);
      if (!ok) {
        if (status === 401) setError((json && (json.message || json.error)) || text || 'Unauthorized');
        else console.warn('fetchHouse failed', status, text);
        return;
      }
      const payload = json ?? {};
      const item = payload.result ?? payload;
      if (!item) { setHouse(null); return; }
      const normalized = { ...item };
      normalized.homeDetails = Array.isArray(item.homeDetails) ? item.homeDetails : (Array.isArray(item.home_details) ? item.home_details : []);
      normalized.plotId = normalized.plotId ?? normalized.plot_id ?? resolvedPlotId;
      normalized.mukhiyaName = normalized.mukhiyaName ?? normalized.mukhiya_name ?? '';
      normalized.numberOfHome = normalized.numberOfHome ?? normalized.number_of_home ?? normalized.homeDetails?.length ?? 0;
      normalized.stagesCompleted = Array.isArray(item.stagesCompleted) ? item.stagesCompleted : [];
      setHouse(normalized);

      // ensure URL matches plot
      try {
        const currentRoutePlot = params.plotId || params.plot_id;
        if (!currentRoutePlot && normalized.plotId) navigate(`/house/one/${encodeURIComponent(String(normalized.plotId))}`, { replace: true });
      } catch {}
    } catch (err) {
      console.error('fetchHouse error', err);
      setError(err?.message || 'Error fetching house');
      setHouse(null);
    }
  }

  async function fetchBuildings() {
    try {
      if (!resolvedVillageId) { setBuildings([]); return; }
      const url = `${API_BASE}/buildings/${encodeURIComponent(resolvedVillageId)}?_t=${Date.now()}`;
      const { ok, status, json, text } = await fetchWithSignal(url, null);
      if (!ok) {
        if (status === 401) setError((json && (json.message || json.error)) || text || 'Unauthorized');
        else console.warn('fetchBuildings failed', status, text);
        setBuildings([]);
        return;
      }
      const payload = json ?? {};
      const items = payload?.result?.items ?? (Array.isArray(payload) ? payload : []);
      setBuildings(items);
    } catch (e) {
      console.error('fetchBuildings error', e);
      setBuildings([]);
    }
  }

  // Core: fetch verifications (page, limit, optional homeId, currentStage, status, fromDate, toDate, name)
  async function fetchFieldVerifications({ page: pageArg = 1, limit: limitArg = 15, currentStage = null, status = null, fromDate = null, toDate = null, homeId = null, name = null } = {}) {
    // abort previous
    if (fetchAbortRef.current) {
      try { fetchAbortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const signal = controller.signal;

    setVerifLoading(true);
    setVerifications([]);
    setTotalCount(0);
    setError(null);

    if (!resolvedVillageId || !resolvedPlotId) {
      setVerifLoading(false);
      return [];
    }

    try {
      const qs = new URLSearchParams();
      qs.set('page', String(pageArg || 1));
      qs.set('limit', String(limitArg || 15));
      if (currentStage) qs.set('currentStage', String(currentStage));
      if (status) qs.set('status', String(status));
      if (fromDate) qs.set('fromDate', String(fromDate));
      if (toDate) qs.set('toDate', String(toDate));
      if (homeId) qs.set('homeId', String(homeId));
      if (name) qs.set('name', String(name));
      // cache-busting
      qs.set('_t', String(Date.now()));

      const url = `${API_BASE}/field_verification/${encodeURIComponent(resolvedVillageId)}/${encodeURIComponent(resolvedPlotId)}?${qs.toString()}`;
      console.debug('[fetchFieldVerifications] starting', { url, pageArg, limitArg, currentStage, status, fromDate, toDate, homeId, name });

      const { ok, status: st, json, text } = await fetchWithSignal(url, signal);

      if (!ok) {
        if (st === 401) setError((json && (json.message || json.error)) || text || 'Unauthorized');
        else console.warn('fetchFieldVerifications failed', st, text);
        setVerifications([]); setTotalCount(0);
        return [];
      }

      const payload = json ?? {};
      let items = [];
      let count = 0;
      if (payload.result) {
        items = payload.result.items ?? [];
        count = payload.result.count ?? (payload.result.total ?? 0);
      } else if (Array.isArray(payload)) {
        items = payload;
        count = items.length;
      } else {
        items = payload.items ?? [];
        count = payload.count ?? 0;
      }
      items = Array.isArray(items) ? items : [];

      setVerifications(items);
      setTotalCount(Number(count) || 0);

      console.debug('[fetchFieldVerifications] finished', { itemsCount: items.length, totalCount: count });
      return items;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        console.debug('[fetchFieldVerifications] aborted');
        return [];
      }
      console.error('fetchFieldVerifications error', err);
      setVerifications([]); setTotalCount(0);
      setError(err?.message || 'Error fetching verifications');
      return [];
    } finally {
      setVerifLoading(false);
    }
  }

  // SINGLE verification fetch -> Uses /field_verification/one/:id
  async function fetchVerification(verificationId) {
    if (modalAbortRef.current) {
      try { modalAbortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    modalAbortRef.current = controller;
    const signal = controller.signal;

    try {
      if (!verificationId) return null;
      const url = `${API_BASE}/field_verification/one/${encodeURIComponent(verificationId)}?_t=${Date.now()}`;
      const { ok, status, json, text } = await fetchWithSignal(url, signal);
      if (!ok) {
        console.warn('fetchVerification failed', status, text);
        return null;
      }
      return (json ?? {}).result ?? json ?? null;
    } catch (err) {
      if (err && err.name === 'AbortError') return null;
      console.error('fetchVerification error', err);
      return null;
    }
  }

  // helper: building for house
  function findBuildingForHouse() {
    if (!house || buildings.length === 0) return null;
    const idsToMatch = new Set([
      String(house.plotId ?? ''), String(house.familyId ?? ''), String(house._id ?? ''), String(house.id ?? '')
    ]);
    const match = buildings.find(b => {
      const candidateIds = [b.buildingId, b._id, b.id, b.plotId, b.plot_id, b.familyId].map(x => x == null ? '' : String(x));
      return candidateIds.some(id => idsToMatch.has(id));
    });
    return match ?? null;
  }
  function getTypeName() {
    const b = findBuildingForHouse();
    if (b) return b.typeName ?? b.type ?? b.buildingType ?? b.type_id ?? b.name ?? '';
    return house?.typeName ?? house?.type ?? house?.typeId ?? '';
  }

  // Stage map: derive from building if available, otherwise infer from fetched verifications
  function getStagesMap() {
    const building = findBuildingForHouse();
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

    const seen = new Map();
    for (const d of verifications || []) {
      const st = d.currentStage ?? d.stageId ?? d.current_stage ?? null;
      if (!st) continue;
      if (!seen.has(st)) seen.set(st, { id: st, name: d.name ?? st, order: seen.size });
    }
    return Array.from(seen.values());
  }

  function getCompletionDateForStage(stage) {
    const candidates = verifications || [];
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

  const stagesMap = useMemo(() => getStagesMap(), [buildings, verifications]);
  const completed = Array.isArray(selectedHome?.stagesCompleted) ? selectedHome.stagesCompleted : (Array.isArray(house?.stagesCompleted) ? house.stagesCompleted : []);
  const timeline = useMemo(() => stagesMap.map((st, idx) => {
    const name = st.name ?? st.label ?? String(st.id ?? `Stage ${idx + 1}`);
    const isCompleted = completed.includes(name) || completed.includes(st.id) || completed.includes(String(idx));
    const completionDate = isCompleted ? getCompletionDateForStage(st) : null;
    return { ...st, name, order: st.order ?? idx, isCompleted, completionDate };
  }), [stagesMap, completed, verifications]);

  const completedCount = timeline.filter(t => t.isCompleted).length;
  const pct = stagesMap.length ? Math.round((completedCount / stagesMap.length) * 100) : 0;

  // displayItems now directly reflects server returned verifications (no client-side filtering/searching)
  const displayItems = useMemo(() => Array.isArray(verifications) ? verifications : [], [verifications]);

  // user actions
  async function onTimelineClick(t) {
    const stageId = t?.id ?? null;
    if (!stageId) { setFilteredStage(null); setPage(1); await fetchFieldVerifications({ page: 1, limit, currentStage: null, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: homeIdFilter || null, name: nameFilter || null }); return; }
    const same = String(filteredStage) === String(stageId);
    if (same) {
      setFilteredStage(null);
      setPage(1);
      await fetchFieldVerifications({ page: 1, limit, currentStage: null, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: homeIdFilter || null, name: nameFilter || null });
    } else {
      setFilteredStage(stageId);
      setPage(1);
      await fetchFieldVerifications({ page: 1, limit, currentStage: stageId, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: homeIdFilter || null, name: nameFilter || null });
    }
  }

  async function onSelectHome(h) {
    const hid = h?.homeId ?? h?.home_id ?? h?.home ?? null;
    const cur = selectedHome?.homeId ?? selectedHome?.home_id ?? selectedHome?.home ?? null;
    if (String(hid) === String(cur)) {
      setSelectedHome(null);
      setFilteredStage(null);
      setPage(1);
      await fetchFieldVerifications({ page: 1, limit, currentStage: null, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: null, name: nameFilter || null });
      return;
    }

    setSelectedHome(h);
    setFilteredStage(null);
    setPage(1);
    setSearch('');
    await fetchFieldVerifications({ page: 1, limit, currentStage: null, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: hid, name: nameFilter || null });
  }

  async function gotoPage(p) {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)));
    const np = Math.max(1, Math.min(totalPages, Number(p) || 1));
    if (np === page) return;
    setPage(np);
    const hid = selectedHome ? (selectedHome.homeId ?? selectedHome.home_id ?? selectedHome.home) : null;
    await fetchFieldVerifications({ page: np, limit, currentStage: filteredStage, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: hid, name: nameFilter || null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onChangeLimit(newLimit) {
    const n = Number(newLimit) || 15;
    setLimit(n);
    setPage(1);
    const hid = selectedHome ? (selectedHome.homeId ?? selectedHome.home_id ?? selectedHome.home) : null;
    await fetchFieldVerifications({ page: 1, limit: n, currentStage: filteredStage, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: hid, name: nameFilter || null });
  }

  async function openHistoryModalById(e, verificationId) {
    e.stopPropagation?.();
    setModalLoading(true);
    setModalVerification(null);
    try {
      const data = await fetchVerification(verificationId);
      if (data) setModalVerification(data);
      else setModalVerification({ verificationId, statusHistory: [], docs: [], name: '' });
      setModalOpen(true);
    } catch (err) {
      console.error('openHistoryModalById error', err);
      setModalVerification({ verificationId, statusHistory: [], docs: [], name: '' });
      setModalOpen(true);
    } finally {
      setModalLoading(false);
    }
  }

  async function openDocsModalById(e, verificationId) {
    e.stopPropagation?.();
    setDocsModalLoading(true);
    setDocsModalDocs(null);
    try {
      const data = await fetchVerification(verificationId);
      // try common fields for docs
      const docs = (data && (data.docs || data.documents || data.photos || data.files)) ?? [];
      setDocsModalDocs(Array.isArray(docs) ? docs : []);
      setDocsModalOpen(true);
    } catch (err) {
      console.error('openDocsModalById error', err);
      setDocsModalDocs([]);
      setDocsModalOpen(true);
    } finally {
      setDocsModalLoading(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setModalVerification(null);
    if (modalAbortRef.current) try { modalAbortRef.current.abort(); } catch {}
  }

  function closeDocsModal() {
    setDocsModalOpen(false);
    setDocsModalDocs(null);
    if (modalAbortRef.current) try { modalAbortRef.current.abort(); } catch {}
  }

  // search debounce -> set nameFilter (server-side) and refetch
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      const trimmed = (search || '').trim();
      setNameFilter(trimmed);
      setPage(1);
      const hid = selectedHome ? (selectedHome.homeId ?? selectedHome.home_id ?? selectedHome.home) : null;
      await fetchFieldVerifications({ page: 1, limit, currentStage: filteredStage, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: hid, name: trimmed || null });
    }, 450);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchBuildings(), resolvedPlotId ? fetchHouse() : Promise.resolve()]);
        if (!mounted) return;
        setPage(1);
        setFilteredStage(null);
        const hid = selectedHome ? (selectedHome.homeId ?? selectedHome.home_id ?? selectedHome.home) : null;
        await fetchFieldVerifications({ page: 1, limit, currentStage: null, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: hid, name: nameFilter || null });
      } catch (e) {
        if (e && e.name === 'AbortError') { /* ignore */ }
        else {
          console.error('initial load error', e);
          setError(e?.message || 'Error loading data');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedVillageId, resolvedPlotId]);

  // effect guard (keeps behavior consistent if external changes occur)
  useEffect(() => {
    (async () => {
      if (!resolvedVillageId || !resolvedPlotId) return;
      const hid = selectedHome ? (selectedHome.homeId ?? selectedHome.home_id ?? selectedHome.home) : null;
      await fetchFieldVerifications({ page, limit, currentStage: filteredStage, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: hid, name: nameFilter || null });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, selectedHome, filteredStage, statusFilter, fromDateFilter, toDateFilter, nameFilter]);

  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) try { fetchAbortRef.current.abort(); } catch {}
      if (modalAbortRef.current) try { modalAbortRef.current.abort(); } catch {}
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / (limit || 1)));
  function renderPageButtons() {
    const maxButtons = 7;
    const pages = [];
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const left = Math.max(2, page - 1);
      const right = Math.min(totalPages - 1, page + 1);
      pages.push(1);
      if (left > 2) pages.push('left-ellipsis');
      for (let i = left; i <= right; i++) pages.push(i);
      if (right < totalPages - 1) pages.push('right-ellipsis');
      pages.push(totalPages);
    }
    return pages.map((p, idx) => {
      if (p === 'left-ellipsis' || p === 'right-ellipsis') return <span key={`e-${idx}`} className="px-3 py-1">…</span>;
      return (
        <button key={p} onClick={() => gotoPage(p)} className={`px-3 py-1 rounded ${p === page ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
          {p}
        </button>
      );
    });
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f0dc]">
      <MainNavbar showVillageInNavbar />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">Loading…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#f8f0dc]">
      <MainNavbar showVillageInNavbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="rounded-lg shadow p-6 text-center">
          <div className="text-lg font-semibold mb-2">{error}</div>
          <div className="mt-4">
            <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded mr-2">Go back</button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded">Retry</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!house) return (
    <div className="min-h-screen bg-[#f8f0dc]">
      <MainNavbar showVillageInNavbar />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">No house found.</div>
    </div>
  );

  const typeName = getTypeName();

  // filter helpers
  const applyFilters = async () => {
    setPage(1);
    const hid = selectedHome ? (selectedHome.homeId ?? selectedHome.home_id ?? selectedHome.home) : null;
    await fetchFieldVerifications({ page: 1, limit, currentStage: filteredStage, status: statusFilter || null, fromDate: fromDateFilter || null, toDate: toDateFilter || null, homeId: homeIdFilter || hid, name: nameFilter || null });
  };

  const clearFilters = async () => {
    setStatusFilter('');
    setFromDateFilter('');
    setToDateFilter('');
    setHomeIdFilter('');
    setFilteredStage(null);
    setPage(1);
    const hid = selectedHome ? (selectedHome.homeId ?? selectedHome.home_id ?? selectedHome.home) : null;
    setNameFilter('');
    setSearch('');
    await fetchFieldVerifications({ page: 1, limit, currentStage: null, status: null, fromDate: null, toDate: null, homeId: hid, name: null });
  };

  return (
    <div className="min-h-screen bg-[#f8f0dc]">
      <MainNavbar showVillageInNavbar />
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white flex items-center gap-2 text-sm text-slate-700"><ArrowLeft size={16} /> Back</button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={async () => { setFilteredStage(null); setPage(1); setSelectedHome(null); await fetchFieldVerifications({ page: 1, limit, currentStage: null, name: nameFilter || null }); }} className="px-3 py-2 border rounded bg-white text-sm flex items-center gap-2 text-slate-700"><RefreshCw size={16} /> Refresh</button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* left */}
          <div className="col-span-12 md:col-span-4">
            <div className="bg-yellow-100 from-white to-slate-50 rounded-2xl shadow-lg p-5 mb-4 border border-slate-100">
              <h3 className="text-lg font-medium text-gray-900 mb-1">House summary</h3>
              <div className="text-sm text-gray-800 space-y-2 mt-5">
                <div><span className="font-medium">Mukhiya : </span> {house.mukhiyaName ?? '—'}</div>
                <div><span className="font-medium">Family ID : </span> {house.familyId ?? '—'}</div>
                <div><span className="font-medium">Number of homes : </span> {house.numberOfHome ?? '—'}</div>
              </div>
            </div>

            <div className="text-m font-medium text-gray-700 mb-3 mt-9 px-3">House Details</div>

            <div className="space-y-3">
              {Array.isArray(house.homeDetails) && house.homeDetails.length > 0 ? house.homeDetails.map((h, i) => {
                const hid = h.homeId ?? h.home_id ?? h.home ?? `home-${i}`;
                const cur = selectedHome?.homeId ?? selectedHome?.home_id ?? selectedHome?.home ?? null;
                const isSelected = cur && String(cur) === String(hid);
                return (
                  <button
                    key={hid}
                    onClick={() => onSelectHome(h)}
                    className={`w-full text-left p-3 rounded-2xl transition border flex items-center gap-3 ${isSelected ? 'bg-blue-100 from-indigo-50 to-white border-indigo-200 shadow' : 'bg-red-100 border-red-200 hover:shadow-sm'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${isSelected ? 'bg-indigo-600' : 'bg-red-400'}`}>
                      {String(i + 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{h.mukhiyaName ?? (h.name ?? hid)}</div>
                      <div className="mt-1 text-xs text-slate-500">Stages completed: <span className="font-medium">{Array.isArray(h.stagesCompleted) ? h.stagesCompleted.length : 0}</span></div>
                    </div>
                    <div className="ml-auto text-xs text-slate-400">{isSelected ? 'Selected' : ''}</div>
                  </button>
                );
              }) : (
                <div className="text-sm text-slate-500">No home details available.</div>
              )}
            </div>
          </div>

          {/* right */}
          <div className="col-span-12 md:col-span-8">
            {selectedHome ? (
              <div className="bg-white rounded-xl shadow p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-slate-800">Timeline</h3>
                    <div className="text-xs text-slate-500">Stage order</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%`, backgroundColor: '#2563eb' }} className="h-full rounded" />
                    </div>
                    <div className="text-sm font-medium text-slate-700">{pct}%</div>
                  </div>
                </div>

                {timeline.length === 0 ? (
                  <div className="text-sm text-slate-500">No stage map available</div>
                ) : (
                  <div className="relative px-4 py-4">
                    <div className="relative">
                      <div className="absolute left-4 right-4 top-0 h-12 flex items-center pointer-events-none" aria-hidden>
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
                                <button type="button" onClick={(e) => { e.stopPropagation(); onTimelineClick(t); }} className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition ${isCompleted ? 'bg-blue-700 text-white border-blue-700' : isFiltered ? 'bg-white text-blue-700 border-2 border-blue-700' : 'bg-white text-gray-400 border border-gray-300'}`}>
                                  {isCompleted ? '✓' : String(i + 1)}
                                </button>
                              </div>

                              <div className={`mt-2 text-center text-sm truncate ${isCompleted || isFiltered ? 'text-slate-800' : 'text-gray-400'}`}>{t.name}</div>

                              {t.completionDate && <div className="text-xs text-slate-500 mt-1">{fmtDate(t.completionDate)}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow p-4 mb-6 text-sm text-slate-500">Select a home to show the timeline.</div>
            )}

            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-slate-800">Verifications</h3>

                  <div className="flex items-center gap-3">
                    <div className="text-sm text-slate-500 mr-3">Showing: <span className="font-medium">{`${displayItems.length} on page ${page}`}</span></div>
                    <div className="relative">
                      
                    </div>
                    {filteredStage && (
                      <button onClick={async () => { setFilteredStage(null); setPage(1); await fetchFieldVerifications({ page: 1, limit, currentStage: null, name: nameFilter || null }); }} className="px-3 py-2 text-sm bg-white border rounded">Clear stage filter</button>
                    )}
                  </div>
                </div>

                {/* NEW: server-side filter controls (keeps existing style) */}
                <div className="bg-yellow-100 border rounded-xl p-3 flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs text-slate-600">Status</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 px-2 py-1 border rounded">
                      <option value="">— any —</option>
                      <option value="1">Forest Guard</option>
                      <option value="2">Range Assistant</option>
                      <option value="3">Range Officer</option>
                      <option value="4">Assistant Director</option>
                      <option value="-1">Deleted</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600">From date</label>
                    <input type="date" value={fromDateFilter} onChange={(e) => setFromDateFilter(e.target.value)} className="mt-1 px-2 py-1 border rounded" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600">To date</label>
                    <input type="date" value={toDateFilter} onChange={(e) => setToDateFilter(e.target.value)} className="mt-1 px-2 py-1 border rounded" />
                  </div>

                  <div className="relative">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter verifications or inserted by..." className="pl-9 pr-3 py-2 border rounded w-64 focus:outline-none focus:ring" />
                    <div className="absolute left-3 top-2.5 text-slate-400"><Search size={16} /></div>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={applyFilters} className="px-3 py-1 bg-sky-600 text-white rounded">Apply</button>
                    <button onClick={clearFilters} className="px-3 py-1 bg-white border rounded">Clear</button>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Page size:</span>
                      <select value={limit} onChange={(e) => onChangeLimit(e.target.value)} className="p-2 border rounded">
                        {[5, 10, 15, 25, 50].map(n => (<option key={n} value={n}>{n}</option>))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => gotoPage(page - 1)} disabled={page <= 1} className={`px-3 py-1 rounded ${page <= 1 ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}>Prev</button>
                    <div className="flex items-center gap-1">{renderPageButtons()}</div>
                    <button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages} className={`px-3 py-1 rounded ${page >= totalPages ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-gray-50"}`}>Next</button>
                  </div>
                </div>

                {verifLoading ? (
                  <div className="text-sm text-slate-500">Loading verifications…</div>
                ) : displayItems.length === 0 ? (
                  <div className="text-sm text-slate-500">No verification found on this page.</div>
                ) : displayItems.map((s, idx) => {
                  const key = s.verificationId ?? s.stageId ?? s._id ?? `stage-${idx}`;
                  const shortNotes = (s.notes || '').replace(/\s+/g, ' ').slice(0, 500);

                  return (
                    <motion.div key={key} tabIndex={0} className={`relative overflow-hidden rounded-xl p-4 bg-blue-100 border border-slate-200 hover:shadow-lg transition transform hover:-translate-y-0.5 ${s.deleted ? 'opacity-60' : ''}`}>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="text-sm font-semibold text-slate-800 truncate">{s.name ?? s.currentStage ?? `Stage ${idx + 1}`}</div>
                                <div className="flex-shrink-0"><StatusBadge status={s.status ?? 0} /></div>
                              </div>

                              <div className="mt-2 text-sm text-slate-700 leading-relaxed max-h-28 overflow-hidden">
                                {shortNotes}{(s.notes || '').length > 500 ? '…' : ''}
                              </div>

                              <div className="mt-3 text-xs text-slate-600">
                                Inserted by <span className="font-medium">{s.insertedBy ?? '—'}</span>
                                <span className="mx-2">•</span>
                                <span>{fmtDate(s.insertedAt)}</span>
                              </div>

                              <div className="mt-2 text-xs text-slate-600">
                                Verification: <span className="font-medium">{s.verifiedBy ?? '—'}</span>
                                <span className="mx-2">•</span>
                                <span>{fmtDate(s.verifiedAt)}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); openHistoryModalById(e, s.verificationId ?? s.verification_id ?? s.verification ?? s._id); }} className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 focus:outline-none">Status history</button>

                                {/* NEW: Documents button (calls same API but extracts docs and opens DocsModal) */}
                                <button onClick={(e) => { e.stopPropagation(); openDocsModalById(e, s.verificationId ?? s.verification_id ?? s.verification ?? s._id); }} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border text-slate-700 rounded-lg text-sm hover:bg-gray-50 focus:outline-none"><FileText size={16} />Docs</button>
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
          </div>
        </div>

        {/* Modal: Status history */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black opacity-40" onClick={closeModal} />
            <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-2xl mx-4">
              <div className="bg-[#f8f0dc] rounded-2xl shadow-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                  <div>
                    <div className="text-lg  font-semibold">Status history</div>
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
                                  <div className="font-semibold text-slate-800">{h.comments ?? '—'}</div>
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
                                <a href={typeof d === 'string' ? d : d.url} target="_blank" rel="noreferrer" className="text-sm text-sky-600 underline">Open</a>
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

        {/* Docs Modal (opened by "View documents" button) */}
        {docsModalOpen && (
          <DocsModal
            open={docsModalOpen}
            onClose={closeDocsModal}
            docs={docsModalDocs ?? []}
            loading={docsModalLoading}
          />
        )}

      </div>
    </div>
  );
}
