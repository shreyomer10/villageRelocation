import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainNavbar from '../component/MainNavbar';
import { API_BASE } from '../config/Api';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, FileText, ChevronDown, RefreshCw, ArrowLeft, Search } from 'lucide-react';

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
    '-1': { label: 'Removed', color: 'bg-gray-100 text-gray-700' },
    '0': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    '1': { label: 'Submitted', color: 'bg-yellow-100 text-yellow-800' },
    '2': { label: 'Approved', color: 'bg-blue-100 text-blue-800' },
    '3': { label: 'In Review', color: 'bg-indigo-100 text-indigo-800' },
    '4': { label: 'Verified', color: 'bg-green-100 text-green-800' }
  };
  const entry = map[String(status)] || { label: `Status ${status}`, color: 'bg-gray-100 text-gray-800' };
  return <span className={`text-xs px-2 py-1 rounded ${entry.color}`}>{entry.label}</span>;
}

function ProgressBar({ pct }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export default function PlotStagesPage() {
  const { villageId, plotId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [plot, setPlot] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [expandedStage, setExpandedStage] = useState(null);
  const [search, setSearch] = useState('');

  // refs for stage cards to support auto-scroll
  const stageRefs = useRef({});

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, plotId]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchPlot(), fetchBuildings()]);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlot() {
    try {
      const res = await fetch(`${API_BASE}/plots/${encodeURIComponent(villageId)}/${encodeURIComponent(plotId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setPlot(null);
          setError('Plot not found');
          return;
        }
        const t = await res.text().catch(() => '');
        throw new Error(`Failed to fetch plot: ${res.status} ${t}`);
      }
      const payload = await res.json();
      const item = (payload?.result?.items && payload.result.items.length > 0) ? payload.result.items[0] : null;
      if (!item) {
        setPlot(null);
        return;
      }
      const normalized = { ...item };
      normalized.docs = Array.isArray(item.docs) ? item.docs : [];
      normalized.stagesCompleted = Array.isArray(item.stagesCompleted) ? item.stagesCompleted : [];
      setPlot(normalized);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error fetching plot');
      setPlot(null);
    }
  }

  async function fetchBuildings() {
    try {
      const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(villageId)}`);
      if (!res.ok) {
        setBuildings([]);
        return;
      }
      const payload = await res.json();
      const items = payload?.result?.items ?? [];
      setBuildings(items);
    } catch (e) {
      console.error(e);
      setBuildings([]);
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
    // try plot
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

  // auto-scroll to the expanded stage card to make the UI interactive
  useEffect(() => {
    if (!expandedStage) return undefined;
    // small delay to allow expand animation to start so scroll lands correctly
    const t = setTimeout(() => {
      const el = stageRefs.current[expandedStage];
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // focus it for keyboard users
          if (typeof el.focus === 'function') el.focus();
        } catch (e) {
          // ignore
        }
      }
    }, 180);
    return () => clearTimeout(t);
  }, [expandedStage]);

  if (loading) return (
    <div className="min-h-screen bg-[#fffaf0] font-sans">
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">{plot.name ?? plot.plotId}</h1>
            <div className="text-sm text-slate-600">{typeName ? `Type: ${typeName}` : ''} <span className="mx-2">•</span> Village: <span className="font-medium">{villageId}</span></div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white flex items-center gap-2 text-sm text-slate-700"><ArrowLeft size={16}/> Back</button>
            <button onClick={loadAll} className="px-3 py-2 border rounded bg-white flex items-center gap-2 text-sm text-slate-700"><RefreshCw size={16}/> Refresh</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm text-slate-500">Overall progress</div>
              <div className="mt-2 flex items-center gap-4">
                <div className="w-72">
                  <ProgressBar pct={pct} />
                </div>
                <div className="text-sm font-medium">{completedCount} of {stagesMap.length} completed</div>
              </div>
            </div>

            <div className="relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stages or inserted by..." className="pl-10 pr-3 py-2 border rounded w-64 focus:outline-none focus:ring" />
              <div className="absolute left-3 top-2.5 text-slate-400"><Search size={16} /></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
              <h3 className="text-lg font-medium text-slate-800">Stage cards</h3>

              {filteredStages.length === 0 ? (
                <div className="text-sm text-slate-500">No stages found.</div>
              ) : filteredStages.map((s, idx) => {
                const key = s.currentStage ?? s.stageId ?? `stage-${idx}`;
                const expanded = expandedStage === key;
                return (
                  <motion.div ref={el => (stageRefs.current[key] = el)} tabIndex={-1} layout key={key} className={`bg-white rounded-lg shadow-sm p-4 border ${s.deleted ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-semibold text-slate-800">{s.name ?? s.currentStage ?? `Stage ${idx + 1}`}</div>
                          <div className="text-xs text-slate-400">{s.currentStage ?? ''}</div>
                          <div className="ml-2"><StatusBadge status={s.status ?? 0} /></div>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">Inserted by: {s.insertedBy ?? '—'}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => setExpandedStage(expanded ? null : key)} aria-expanded={expanded} className="flex items-center gap-2 text-sm px-3 py-1 border rounded bg-white text-slate-700">
                          Details <ChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} size={16} />
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 pt-3 border-t text-sm text-slate-700 space-y-3">
                        <div>
                          <div className="font-medium">Notes</div>
                          <div className="mt-1 whitespace-pre-wrap">{s.notes ?? '—'}</div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1">
                            <div className="font-medium">Verification</div>
                            <div className="mt-1">ID: <span className="font-medium">{s.verificationId ?? '—'}</span></div>
                            <div>By: <span className="font-medium">{s.verifiedBy ?? '—'}</span></div>
                            <div>At: <span className="font-medium">{fmtDate(s.verifiedAt)}</span></div>
                          </div>

                          <div className="flex-1">
                            <div className="font-medium">Documents</div>
                            <div className="mt-1 space-y-2">
                              {Array.isArray(s.docs) && s.docs.length > 0 ? s.docs.map((d, ii) => (
                                <div key={ii} className="flex items-center justify-between border rounded p-2">
                                  <div className="flex items-center gap-2 text-slate-700"><FileText size={16} /> <div className="text-sm truncate">{typeof d === 'string' ? d.split('/').pop() : (d.name ?? `Document ${ii + 1}`)}</div></div>
                                  <a href={typeof d === 'string' ? d : d.url} target="_blank" rel="noreferrer" className="text-sm text-sky-600 underline">Open</a>
                                </div>
                              )) : (<div className="text-sm text-slate-500">No documents</div>)}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="font-medium">Status history</div>
                          <div className="mt-2 space-y-2">
                            {Array.isArray(s.statusHistory) && s.statusHistory.length > 0 ? s.statusHistory.map((h, i) => (
                              <div key={i} className="flex items-start justify-between bg-slate-50 p-2 rounded">
                                <div>
                                  <div className="font-medium text-sm">{h.comments || '—'}</div>
                                  <div className="text-xs text-slate-500">By {h.verifier ?? '—'} • {fmtDate(h.time)}</div>
                                </div>
                                <div className="ml-2"><StatusBadge status={h.status} /></div>
                              </div>
                            )) : <div className="text-sm text-slate-500">No history</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          <aside>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="bg-white rounded-xl shadow p-5 sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-slate-800">Timeline</h3>
                <div className="text-sm text-slate-500">{pct}%</div>
              </div>

              {timeline.length === 0 ? (
                <div className="text-sm text-slate-500">No stage map available</div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {timeline.map((t, i) => (
                    <div key={t.id ?? i} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${t.isCompleted ? 'bg-sky-600' : 'bg-slate-300'}`} />
                        <div className="text-sm text-slate-800">{t.name}</div>
                      </div>

                      <div className="text-sm text-slate-500">{t.isCompleted ? fmtDate(t.completionDate) : 'Pending'}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 text-xs text-slate-500">Simple timeline — shows stage order and completion date. Click a stage card for more details.</div>
            </motion.div>
          </aside>
        </div>
      </div>
    </div>
  );
}
