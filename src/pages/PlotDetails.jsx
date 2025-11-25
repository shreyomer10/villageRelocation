import React, { useEffect, useMemo, useState, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainNavbar from '../component/MainNavbar';
import { API_BASE } from '../config/Api.js';
import { motion } from 'framer-motion';
import { FileText, ChevronDown, RefreshCw, ArrowLeft, Search } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar
} from 'recharts';
import { AuthContext } from '../context/AuthContext';

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
    '1': { label: 'forest Guard', color: 'bg-yellow-100 text-yellow-800' },
    '2': { label: 'Range Assitant', color: 'bg-blue-100 text-blue-800' },
    '3': { label: 'Range Officer', color: 'bg-indigo-100 text-indigo-800' },
    '4': { label: 'Assitant Director', color: 'bg-green-100 text-green-800' }
  };
  const entry = map[String(status)] || { label: `Status ${status}`, color: 'bg-gray-100 text-gray-800' };
  return <span className={`text-xs px-2 py-1 rounded ${entry.color}`}>{entry.label}</span>;
}

function ProgressBar({ pct }) {
  return (
    <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: '#2563eb' }} className="h-full rounded" />
    </div>
  );
}

export default function PlotStagesPage() {
  // prefer route param, but if not present fall back to AuthContext.selected plot id or localStorage
  const { villageId: routeVillageId, plotId: routePlotId } = useParams();
  const navigate = useNavigate();
  const { plotId: contextPlotId, selectedPlot, villageId: contextVillageId } = useContext(AuthContext);

  // helper to read legacy localStorage keys if context/route missing
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

  // compute initial resolved ids (route > context > selectedPlot > localStorage)
  const initialResolvedPlot = routePlotId || contextPlotId || (selectedPlot && (selectedPlot.plotId ?? selectedPlot.id)) || resolvePlotIdFromStorageDirect();
  const [resolvedPlotId, setResolvedPlotId] = useState(initialResolvedPlot);

  const initialResolvedVillage = routeVillageId || contextVillageId || (selectedPlot && (selectedPlot.villageId ?? selectedPlot.village)) || resolveVillageIdFromStorageDirect();
  const [resolvedVillageId, setResolvedVillageId] = useState(initialResolvedVillage);

  // sync when route param changes
  useEffect(() => {
    if (routePlotId) setResolvedPlotId(routePlotId);
    else {
      // if no route id, prefer context then localStorage
      const idFromContext = contextPlotId || (selectedPlot && (selectedPlot.plotId ?? selectedPlot.id));
      if (idFromContext) setResolvedPlotId(idFromContext);
      else {
        const fromStorage = resolvePlotIdFromStorageDirect();
        if (fromStorage) setResolvedPlotId(fromStorage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePlotId]);

  // sync village when route param changes
  useEffect(() => {
    if (routeVillageId) setResolvedVillageId(routeVillageId);
    else {
      const idFromContext = contextVillageId || (selectedPlot && (selectedPlot.villageId ?? selectedPlot.village));
      if (idFromContext) setResolvedVillageId(idFromContext);
      else {
        const fromStorage = resolveVillageIdFromStorageDirect();
        if (fromStorage) setResolvedVillageId(fromStorage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeVillageId]);

  // keep in sync if AuthContext selection changes (so selecting a plot elsewhere updates this page)
  useEffect(() => {
    const idFromContext = contextPlotId || (selectedPlot && (selectedPlot.plotId ?? selectedPlot.id));
    if (idFromContext && idFromContext !== resolvedPlotId) {
      setResolvedPlotId(String(idFromContext));
    }
    const vFromContext = contextVillageId || (selectedPlot && (selectedPlot.villageId ?? selectedPlot.village));
    if (vFromContext && vFromContext !== resolvedVillageId) {
      setResolvedVillageId(String(vFromContext));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextPlotId, selectedPlot, contextVillageId]);

  // also listen to storage events (keeps multi-tab selection in sync)
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [plot, setPlot] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [expandedStage, setExpandedStage] = useState(null);
  const [search, setSearch] = useState('');

  // analytics chart state
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartKeys, setChartKeys] = useState(['count']);
  const [filterOption, setFilterOption] = useState('');

  // modal for status history
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyModalStage, setHistoryModalStage] = useState(null);

  // refs for stage cards to support auto-scroll
  const stageRefs = useRef({});

  useEffect(() => {
    // when resolvedPlotId or resolvedVillageId changes, load data
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedVillageId, resolvedPlotId]);

  useEffect(() => {
    // whenever plot/building data changes, try to fetch analytics for the building type id
    const typeId = getTypeIdForAnalytics();
    if (typeId) {
      fetchAnalytics(typeId);
    } else {
      // clear chart if no type id available
      setChartData([]);
      setFilterOption('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedVillageId, buildings, plot]);

  // --- helper: fetch with credentials and safe JSON parsing ---
  async function fetchWithCreds(url, opts = {}) {
    try {
      const res = await fetch(url, {
        credentials: 'include', // << important: ensure cookies are sent
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        ...opts
      });

      const text = await res.text().catch(() => '');
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        json = null;
      }

      return { res, ok: res.ok, status: res.status, json, text };
    } catch (err) {
      return { res: null, ok: false, status: 0, json: null, text: String(err) };
    }
  }
  // ------------------------------------------------------------

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      // require resolvedPlotId to fetch the plot; buildings can still be fetched by village
      await Promise.all([fetchBuildings(), resolvedPlotId ? fetchPlot() : Promise.resolve()]);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlot() {
    try {
      if (!resolvedPlotId) {
        setPlot(null);
        return;
      }

      const url = `${API_BASE}/plots/one/${encodeURIComponent(resolvedPlotId)}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: 'GET' });

      if (!ok) {
        if (status === 401) {
          const msg = (json && (json.message || json.error)) || text || 'Unauthorized — please sign in';
          setError(msg);
          return;
        }
        const t = (json && (json.message || JSON.stringify(json))) || text || `Failed to fetch plot (status ${status})`;
        throw new Error(t);
      }

      const payload = json ?? {};

      // Robust parsing for multiple payload shapes:
      // - { result: { items: [...] } }
      // - { result: { ...single object... } }
      // - { items: [...] }
      // - [...array...]
      // - { ...single object... }
      let item = null;

      if (payload.result) {
        // shape: result.items -> array
        if (Array.isArray(payload.result.items) && payload.result.items.length > 0) {
          item = payload.result.items[0];
        } else if (typeof payload.result === 'object' && !Array.isArray(payload.result)) {
          // shape: result is the object itself (your sample)
          item = payload.result;
        }
      }

      // fallback: payload.items
      if (!item && Array.isArray(payload.items) && payload.items.length > 0) {
        item = payload.items[0];
      }

      // fallback: payload is array
      if (!item && Array.isArray(payload) && payload.length > 0) {
        item = payload[0];
      }

      // fallback: payload itself may be the object
      if (!item && payload && typeof payload === 'object' && !Array.isArray(payload)) {
        // if payload looks like the object (has plotId or name etc), use it
        if (payload.plotId || payload.plot_id || payload.name || payload.familyId) {
          item = payload;
        }
      }

      if (!item) {
        setPlot(null);
        return;
      }

      const normalized = { ...item };
      normalized.docs = Array.isArray(item.docs) ? item.docs : [];
      normalized.stagesCompleted = Array.isArray(item.stagesCompleted) ? item.stagesCompleted : [];
      setPlot(normalized);

      // If route doesn't include plotId param, update URL to canonical
      try {
        const currentRoutePlot = routePlotId;
        if (!currentRoutePlot) {
          navigate(`/plots/one/${encodeURIComponent(resolvedPlotId)}`, { replace: true });
        }
      } catch {}
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error fetching plot');
      setPlot(null);
    }
  }


  async function fetchBuildings() {
    try {
      if (!resolvedVillageId) {
        setBuildings([]);
        return;
      }
      const url = `${API_BASE}/buildings/${encodeURIComponent(resolvedVillageId)}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: 'GET' });

      if (!ok) {
        if (status === 401) {
          const msg = (json && (json.message || json.error)) || text || 'Unauthorized — please sign in';
          setError(msg);
          return;
        }
        // non-critical: just clear buildings
        console.warn('Failed to fetch buildings', status, text);
        setBuildings([]);
        return;
      }

      const payload = json ?? {};
      const items = payload?.result?.items ?? (Array.isArray(payload) ? payload : []);
      setBuildings(items);
    } catch (e) {
      console.error(e);
      setBuildings([]);
    }
  }

  // analytics fetch
  async function fetchAnalytics(typeId) {
    setChartLoading(true);
    setChartError(null);
    try {
      const url = `${API_BASE}/analytics/building/${encodeURIComponent(resolvedVillageId)}/${encodeURIComponent(typeId)}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: 'GET' });

      if (!ok) {
        if (status === 401) {
          const msg = (json && (json.message || json.error)) || text || 'Unauthorized — please sign in';
          setChartError(msg);
          setChartData([]);
          return;
        }
        const t = (json && (json.message || JSON.stringify(json))) || text || `Analytics API error: ${status}`;
        throw new Error(t);
      }

      const payload = json ?? {};
      const result = payload?.result ?? {};
      const stages = result?.stages ?? [];
      const data = stages.map(s => ({ name: s.name ?? s.id ?? 'Unknown', count: Number(s.count ?? 0) }));
      setChartData(data);
      setChartKeys(['count']);
      setFilterOption((result?.buildingName ?? typeId) || typeId);
    } catch (e) {
      console.error('analytics fetch error', e);
      setChartError(e.message || 'Failed to load analytics');
      setChartData([]);
      setChartKeys(['count']);
    } finally {
      setChartLoading(false);
    }
  }

  function findBuildingForPlot() {
    if (!plot || buildings.length === 0) return null;
    const idsToMatch = new Set([String(plot.plotId ?? ''), String(plot.buildingId ?? ''), String(plot._id ?? ''), String(plot.id ?? ''), String(plot.familyId ?? '')]);
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

  function getTypeIdForAnalytics() {
    // try to find the most probable type identifier that matches backend's `typeId` field
    const b = findBuildingForPlot();
    if (!b) return null;
    return b.typeId ?? b.type_id ?? b.type ?? b._id ?? b.id ?? b.buildingId ?? null;
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

    if (plot && Array.isArray(plot.docs)) {
      const seen = new Set();
      return plot.docs.map((d, i) => {
        const name = d.name ?? d.currentStage ?? `Stage ${i + 1}`;
        if (seen.has(name)) return null;
        seen.add(name);
        return { id: d.currentStage ?? `stage-${i}`, name, order: i };
      }).filter(Boolean);
    }
    return [];
  }

  function getCompletionDateForStage(stage) {
    if (!plot) return null;
    const candidates = plot.docs || [];
    let matched = null;
    for (const d of candidates) {
      const dNames = [d.name, d.currentStage, d.stageId, d.stage_name, d.stage].map(x => x == null ? '' : String(x));
      if (dNames.includes(String(stage.name)) || dNames.includes(String(stage.id))) {
        matched = d; break;
      }
    }
    if (!matched) {
      for (const d of candidates) {
        if (d.name && stage.name && String(d.name).includes(String(stage.name))) { matched = d; break; }
      }
    }
    if (!matched) return null;
    if (matched.verifiedAt) return matched.verifiedAt;
    if (Array.isArray(matched.statusHistory) && matched.statusHistory.length > 0) {
      const byVerified = matched.statusHistory.filter(h => Number(h.status) === 4);
      const pick = (byVerified.length > 0 ? byVerified : matched.statusHistory).sort((a, b) => new Date(b.time) - new Date(a.time))[0];
      return pick?.time ?? null;
    }
    return null;
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

  const filteredStages = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return plot?.docs || [];
    return (plot?.docs || []).filter(d => (d.name || d.currentStage || '').toLowerCase().includes(q) || (d.insertedBy || '').toLowerCase().includes(q));
  }, [search, plot]);

  // auto-scroll to the expanded stage card
  useEffect(() => {
    if (!expandedStage) return undefined;
    const t = setTimeout(() => {
      const el = stageRefs.current[expandedStage];
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof el.focus === 'function') el.focus();
        } catch (e) {}
      }
    }, 180);
    return () => clearTimeout(t);
  }, [expandedStage]);

  function openStageForTimeline(t) {
    if (!plot || !Array.isArray(plot.docs)) {
      setExpandedStage(null);
      return;
    }
    const docs = plot.docs;
    let key = null;
    for (let i = 0; i < docs.length; i += 1) {
      const d = docs[i];
      const possibleKeys = [d.currentStage ?? '', d.stageId ?? '', d.name ?? '', `stage-${i}`].map(x => String(x));
      if (possibleKeys.includes(String(t.id)) || possibleKeys.includes(String(t.name))) {
        key = d.currentStage ?? d.stageId ?? `stage-${i}`;
        break;
      }
    }
    if (key) setExpandedStage(key);
    else setExpandedStage(null);
  }

  function openHistoryModal(stageObj) {
    setHistoryModalStage(stageObj);
    setHistoryModalOpen(true);
  }
  function closeHistoryModal() {
    setHistoryModalOpen(false);
    setHistoryModalStage(null);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">Loading stages…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#fffaf0] font-sans">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-6 text-center">
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
    <div className="min-h-screen bg-[#fffaf0] font-sans">
      <MainNavbar />
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">No plot found.</div>
    </div>
  );

  const typeName = getTypeName();

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar />
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">{plot.name ?? plot.plotId}</h1>
            <div className="text-sm text-slate-600">{typeName ? `Type: ${typeName}` : ''} <span className="mx-2">•</span> Village: <span className="font-medium">{resolvedVillageId}</span></div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white flex items-center gap-2 text-sm text-slate-700"><ArrowLeft size={16}/> Back</button>
            <button onClick={loadAll} className="px-3 py-2 border rounded bg-white flex items-center gap-2 text-sm text-slate-700"><RefreshCw size={16}/> Refresh</button>
          </div>
        </div>

        {/* TIMELINE (clean, government-friendly look) */}
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
      {/* top row: fixed height equal to button (h-12 = 3rem = 48px) */}
      {/* the absolute line sits inside this row so it is vertically centered with the buttons */}
      <div className="relative">
        {/* base connector line and colored completed portion — both centered vertically inside h-12 */}
        <div className="absolute left-4 right-4 top-0 h-12 flex items-center pointer-events-none" aria-hidden="true">
          <div className="w-full h-0.5 bg-slate-200 rounded relative">
            <div
              className="absolute left-0 top-1/2 transform -translate-y-1/2 h-0.5 rounded"
              style={{ width: `${pct}%`, backgroundColor: '#1e40af', maxWidth: '100%' }}
            />
          </div>
        </div>

        {/* buttons row (z-10 so buttons are above the line) */}
        <div className="flex items-start justify-between relative z-10">
          {timeline.map((t, i) => {
            const stageKey = t.id ?? `s-${i}`;
            const isCompleted = !!t.isCompleted;
            const isSelected = (() => {
              if (!expandedStage || !plot?.docs) return false;
              return plot.docs.some((d, idx) => {
                const key = d.currentStage ?? d.stageId ?? `stage-${idx}`;
                return String(key) === String(stageKey) || String(d.name) === String(t.name) || String(d.currentStage) === String(t.name);
              });
            })();

            return (
              <div
                key={String(stageKey)}
                className="flex flex-col items-center"
                style={{ width: `${100 / Math.max(1, timeline.length)}%`, maxWidth: 180 }}
              >
                {/* button container fixed to h-12 so button is vertically centered with the line */}
                <div className="h-12 flex items-center justify-center">
                  <button
                    onClick={() => openStageForTimeline(t)}
                    className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition
                      ${isCompleted ? 'bg-blue-700 text-white border-blue-700' : isSelected ? 'bg-white text-blue-700 border-2 border-blue-700' : 'bg-white text-gray-400 border border-gray-300'}`}
                    aria-pressed={isSelected}
                    aria-label={`${t.name} ${isCompleted ? 'completed' : isSelected ? 'current' : 'upcoming'}`}
                    title={t.name}
                  >
                    {isCompleted ? '✓' : String(i + 1)}
                  </button>
                </div>

                <div className={`mt-2 text-center text-sm truncate ${isCompleted || isSelected ? 'text-slate-800' : 'text-gray-400'}`}>
                  {t.name}
                </div>

                {t.completionDate && (
                  <div className="text-xs text-slate-500 mt-1">{fmtDate(t.completionDate)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )}

        </div>

        {/* STAGE ANALYTICS BAR CHART - placed just below the timeline */}
        <div className="mb-6 w-full bg-white rounded-xl p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-800">Stage analytics</div>
            <div className="text-xs text-gray-500">{filterOption ? `Showing ${String(filterOption).replace(/_/g, ' ')}` : 'Analytics'}</div>
          </div>

          <div className="h-64">
            {chartLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-600">Loading chart…</div>
            ) : chartError ? (
              <div className="h-full flex items-center justify-center text-sm text-red-600">{chartError}</div>
            ) : chartData && chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={chartKeys[0]} name={chartKeys[0].replace(/_/g, ' ')} fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">No analytics available</div>
            )}
          </div>
        </div>

        {/* STAGE CARDS (filter moved into header to the right) */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-800">Stage cards</h3>

              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-500 mr-3">Overall: <span className="font-medium">{completedCount} of {stagesMap.length}</span></div>
                <div className="relative">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter stages or inserted by..." className="pl-9 pr-3 py-2 border rounded w-64 focus:outline-none focus:ring" />
                  <div className="absolute left-3 top-2.5 text-slate-400"><Search size={16} /></div>
                </div>
              </div>
            </div>

            {filteredStages.length === 0 ? (
              <div className="text-sm text-slate-500">No stages found.</div>
            ) : filteredStages.map((s, idx) => {
              const key = s.currentStage ?? s.stageId ?? `stage-${idx}`;
              const expanded = expandedStage === key;

              // derive a short summary for header
              const shortNotes = (s.notes || '').replace(/\s+/g, ' ').slice(0, 120);

              return (
                <motion.div
                  ref={el => (stageRefs.current[key] = el)}
                  tabIndex={-1}
                  layout
                  key={key}
                  className={`bg-white rounded-lg shadow-sm p-4 border ${s.deleted ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-slate-800">{s.name ?? s.currentStage ?? `Stage ${idx + 1}`}</div>
                        <div className="ml-2"><StatusBadge status={s.status ?? 0} /></div>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">Inserted by: {s.insertedBy ?? '—'}</div>

                    </div>
{/* Status history moved below Details button as requested */}
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => setExpandedStage(expanded ? null : key)} aria-expanded={expanded} className="flex items-center gap-2 text-sm px-3 py-1 border rounded bg-white text-slate-700">
                        Details <ChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} size={16} />
                      </button>

                      <button onClick={() => openHistoryModal(s)} className="text-sm underline text-sky-600 hover:text-sky-700">Status history</button>
                    </div>
                  </div>


                  {expanded && (
                    <div className="mt-3 pt-3 border-t text-sm text-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[46vh] overflow-y-auto pr-2">
                      <div>
                        <div className="font-medium">Notes</div>
                        <div className="mt-1 whitespace-pre-wrap leading-relaxed text-sm">{s.notes ?? '—'}</div>

                        <div className="mt-4">
                          <div className="font-medium">Verification</div>
                          <div className="mt-1 text-sm">ID: <span className="font-medium">{s.verificationId ?? '—'}</span></div>
                          <div className="text-sm">By: <span className="font-medium">{s.verifiedBy ?? '—'}</span></div>
                          <div className="text-sm">At: <span className="font-medium">{fmtDate(s.verifiedAt)}</span></div>
                        </div>
                      </div>

                      <div>
                        <div className="font-medium">Documents</div>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          {Array.isArray(s.docs) && s.docs.length > 0 ? s.docs.map((d, ii) => (
                            <div key={ii} className="flex items-center justify-between border rounded p-2">
                              <div className="flex items-center gap-2 text-slate-700 text-sm"><FileText size={16} /> <div className="truncate max-w-[220px]">{typeof d === 'string' ? d.split('/').pop() : (d.name ?? `Document ${ii + 1}`)}</div></div>
                              <a href={typeof d === 'string' ? d : d.url} target="_blank" rel="noreferrer" className="text-sm text-sky-600 underline">Open</a>
                            </div>
                          )) : (<div className="text-sm text-slate-500">No documents</div>)}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Status history modal */}
        {historyModalOpen && historyModalStage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-40" onClick={closeHistoryModal} />
            <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-2xl mx-4">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="text-lg font-semibold">{historyModalStage.name}</div>
                  <div className="text-sm text-slate-400">Status history</div>
                  <button onClick={closeHistoryModal} aria-label="Close" className="px-3 py-1 rounded bg-gray-100">Close</button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                  {Array.isArray(historyModalStage.statusHistory) && historyModalStage.statusHistory.length > 0 ? (
                    historyModalStage.statusHistory.map((h, i) => (
                      <div key={i} className="border rounded p-3 bg-slate-50">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="font-medium">{h.comments || '—'}</div>
                            <div className="text-xs text-slate-500 mt-1">By {h.verifier ?? '—'} • {fmtDate(h.time)}</div>
                          </div>
                          <div className="text-sm"><StatusBadge status={h.status} /></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-600">No status history available.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
