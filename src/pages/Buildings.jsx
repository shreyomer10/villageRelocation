// Buildings.jsx — updated to call /buildings and /bstages backend routes
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api";

/**
 * Adapted from original StagePage.jsx (see uploaded version for original).
 * Main change: wire requests to the Flask backend endpoints:
 *  - /buildings/<villageId>
 *  - /buildings/insert
 *  - /buildings/<buildingId>/<villageId> (PUT, DELETE)
 *  - /bstages/... for nested stages
 *
 * NOTE: this component expects a `villageId` stored in localStorage as "villageId".
 * If you prefer a different source (route param, context, etc.) change the `villageId` retrieval accordingly.
 */

export default function StagePage() {
  const navigate = useNavigate();

  const [stages, setStages] = useState([]); // top-level "buildings" containing nested stages
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // refs for automatic scrolling
  const stageRefs = useRef({}); // keyed by String(stageId)
  const subRefs = useRef({}); // keyed by `${stageId}:${subId}`

  // drag state for stages (kept but top-level dragging disabled in UI)
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // substage pending reorder waiting for user confirmation
  const [pendingSubstageReorder, setPendingSubstageReorder] = useState(null);
  const [persistingSubstage, setPersistingSubstage] = useState(null); // subId being persisted

  // per-stage inline deleted-substage toggle + cache
  const [showDeletedInExpanded, setShowDeletedInExpanded] = useState({});
  const [deletedSubstageCache, setDeletedSubstageCache] = useState({});

  // UI state
  const [globalSelectMode, setGlobalSelectMode] = useState(false);
  const [selectedStageIds, setSelectedStageIds] = useState(new Set());
  const [expandedStageIds, setExpandedStageIds] = useState(new Set());
  const [stageSubSelectMode, setStageSubSelectMode] = useState({});
  const [selectedSubstages, setSelectedSubstages] = useState({});

  // edit/create
  const [editStage, setEditStage] = useState(null);
  const [editSubstage, setEditSubstage] = useState(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPosition, setCreatePosition] = useState("");
  const [createSubstages, setCreateSubstages] = useState([{ name: "", desc: "" }]);
  const [creating, setCreating] = useState(false);

  const [showAddFormFor, setShowAddFormFor] = useState(null);

  // global deleted-stages list (unchanged variable names)
  const [deletedStagesCache, setDeletedStagesCache] = useState([]);
  const [deletedStagesLoading, setDeletedStagesLoading] = useState(false);
  const [deletedStagesError, setDeletedStagesError] = useState(null);
  const [showDeletedStages, setShowDeletedStages] = useState(false);
  const [expandedDeletedStageIds, setExpandedDeletedStageIds] = useState(new Set());

  // delete confirmation modal state
  // shape: { type: 'stage'|'substage'|'multipleStages'|'multipleSubstages', stageId?, subStageId?, ids?, name? }
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [performingDelete, setPerformingDelete] = useState(false);

  // villageId source:
  const villageId = localStorage.getItem("villageId") || "";

  // ---------- initial load ----------
  useEffect(() => {
    let mounted = true;
    (async function load() {
      setLoading(true);
      setError(null);

      if (!villageId) {
        setError("Missing villageId (store it as localStorage 'villageId')");
        setStages([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(villageId)}`);
        if (res.status === 404) {
          if (!mounted) return;
          setStages([]);
          setError(null);
          return;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to load buildings: ${res.status} ${txt}`);
        }
        const payload = await res.json();
        let items = [];
        if (payload?.result?.items) items = payload.result.items;
        else if (Array.isArray(payload.result)) items = payload.result;
        else if (Array.isArray(payload)) items = payload;
        else if (Array.isArray(payload.items)) items = payload.items;
        if (!mounted) return;
        // ensure sorting by position if present (top-level may not have position; keep as-is)
        items = (items || []).slice().sort((a, b) => (Number(a.position ?? 0) - Number(b.position ?? 0)));
        setStages(items);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(err.message || "Failed to fetch buildings");
        setStages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId]);

  // reloadStages now returns the canonical list for callers to use
  async function reloadStages() {
    if (!villageId) return null;
    try {
      const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(villageId)}`);
      if (!res.ok) {
        console.warn("reloadStages: failed to reload", res.status);
        return null;
      }
      const payload = await res.json();
      let items = [];
      if (payload?.result?.items) items = payload.result.items;
      else if (Array.isArray(payload.result)) items = payload.result;
      else if (Array.isArray(payload)) items = payload;
      else if (Array.isArray(payload.items)) items = payload.items;
      items = (items || []).slice().sort((a, b) => (Number(a.position ?? 0) - Number(b.position ?? 0)));
      setStages(items);
      return items;
    } catch (e) {
      console.error("reloadStages error", e);
      return null;
    }
  }

  function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
  }

  // ---------- Helpers for ID detection ----------
  // top-level "buildings" can have typeId, optionId, id etc; substages have stageId etc.
  const getStageId = (s) => s.typeId ?? s.optionId ?? s.option_id ?? s.stageId ?? s.stage_id ?? s.id;
  const getSubId = (ss) => ss.stageId ?? ss.subStageId ?? ss.sub_stage_id ?? ss.id ?? ss.sub_id ?? ss.subId ?? ss.name;

  // ---------- Global select ----------
  function toggleGlobalSelect() {
    setGlobalSelectMode(prev => {
      const next = !prev;
      if (!next) {
        setSelectedStageIds(new Set());
        setSelectedSubstages({});
      } else {
        setShowCreatePanel(false);
      }
      return next;
    });
  }

  function toggleStageCheckbox(stageId) {
    setSelectedStageIds(prev => {
      const copy = new Set(prev);
      if (copy.has(stageId)) copy.delete(stageId);
      else copy.add(stageId);
      return copy;
    });
    setSelectedSubstages(prev => {
      const copy = { ...prev };
      delete copy[stageId];
      return copy;
    });
  }

  // deselect all global
  function deselectAllStages() {
    setSelectedStageIds(new Set());
  }

  function requestDeleteSelectedStages() {
    if (selectedStageIds.size === 0) return;
    setDeleteConfirm({ type: 'multipleStages', ids: Array.from(selectedStageIds) });
  }

  // ---------- Expand & per-stage sub-select ----------
  function toggleExpandStage(stageId) {
    setExpandedStageIds(prev => {
      const copy = new Set(prev);
      if (copy.has(stageId)) copy.delete(stageId);
      else copy.add(stageId);
      return copy;
    });
    setStageSubSelectMode(prev => ({ ...prev, [stageId]: false }));
    setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: false }));
  }

  // Toggle showing deleted substages inline within an expanded stage card.
  async function toggleShowDeletedInline(stageId) {
    const currently = !!showDeletedInExpanded[stageId];
    if (currently) {
      setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: false }));
      return;
    }

    const s = stages.find(x => String(getStageId(x)) === String(stageId));
    const localDeleted = Array.isArray(s?.stages) ? s.stages.filter(ss => ss.deleted === true) : [];
    // If there are local deleted items already present, show them immediately
    if (localDeleted.length > 0) {
      setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: true }));
      return;
    }

    // If we've previously fetched deleted-substage cache for this stage
    if (Object.prototype.hasOwnProperty.call(deletedSubstageCache, stageId)) {
      const cached = deletedSubstageCache[stageId] || [];
      if (cached.length > 0) {
        // merge into stage list and show
        setStages(prev => prev.map(st => {
          if (String(getStageId(st)) !== String(stageId)) return st;
          const existing = Array.isArray(st.stages) ? st.stages.slice() : [];
          const existingIds = new Set(existing.map(x => String(getSubId(x))));
          const toAdd = cached.filter(x => !existingIds.has(String(getSubId(x))));
          return { ...st, stages: [...existing, ...toAdd] };
        }));
        setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: true }));
      }
      return;
    }

    // Use backend route for deleted sub-stages: /deleted_bstages/<buildingId>/<villageId>
    try {
      const res = await fetch(`${API_BASE}/deleted_bstages/${encodeURIComponent(stageId)}/${encodeURIComponent(villageId)}`);
      if (res.status === 404) {
        // no deleted sub-stages
        setDeletedSubstageCache(prev => ({ ...prev, [stageId]: [] }));
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed: ${res.status} ${txt}`);
      }
      const data = await res.json();
      const items = data?.result?.items ?? [];
      const marked = items.map(it => ({ ...it, deleted: true }));

      // cache the fetched deleted items
      setDeletedSubstageCache(prev => ({ ...prev, [stageId]: marked }));

      if (marked.length > 0) {
        // merge and show
        setStages(prev => prev.map(st => {
          if (String(getStageId(st)) !== String(stageId)) return st;
          const existing = Array.isArray(st.stages) ? st.stages.slice() : [];
          const existingIds = new Set(existing.map(x => String(getSubId(x))));
          const toAdd = marked.filter(x => !existingIds.has(String(getSubId(x))));
          return { ...st, stages: [...existing, ...toAdd] };
        }));

        setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: true }));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch deleted sub-stages");
    }
  }

  function toggleStageSubSelectMode(stageId) {
    setStageSubSelectMode(prev => {
      const copy = { ...prev };
      copy[stageId] = !copy[stageId];
      if (!copy[stageId]) {
        const copySel = { ...selectedSubstages };
        delete copySel[stageId];
        setSelectedSubstages(copySel);
      }
      return copy;
    });
  }

  function toggleSubstageCheckbox(stageId, subId) {
    setSelectedSubstages(prev => {
      const copy = { ...prev };
      const cur = new Set(copy[stageId] || []);
      if (cur.has(subId)) cur.delete(subId);
      else cur.add(subId);
      if (cur.size === 0) delete copy[stageId];
      else copy[stageId] = cur;
      return copy;
    });
  }

  // deselect all substages for a stage
  function deselectAllSubstagesFor(stageId) {
    setSelectedSubstages(prev => {
      const copy = { ...prev };
      if (copy[stageId]) delete copy[stageId];
      return copy;
    });
  }

  function requestDeleteSelectedSubstages(stageId) {
    const set = selectedSubstages[stageId];
    if (!set || set.size === 0) return;
    setDeleteConfirm({ type: 'multipleSubstages', stageId, ids: Array.from(set) });
  }

  // ---------- create / update / delete (adjusted endpoints) ----------
  async function handleCreateStage(e) {
    e && e.preventDefault();
    if (!createName || createName.trim() === "") return;
    setCreating(true);

    if (!villageId) {
      setError("Missing villageId; cannot create building.");
      setCreating(false);
      return;
    }

    try {
      // prepare payload expected by backend BuildingInsert model
      const payload = {
        name: createName.trim(),
        desc: createDesc?.trim() || undefined,
        villageId: villageId,
        deleted: false,
        stages: createSubstages.map(s => ({ name: (s.name || "").trim(), desc: (s.desc || "").trim() || undefined })).filter(x => x.name),
      };

      const res = await fetch(`${API_BASE}/buildings/insert`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Create failed: ${res.status} ${txt}`);
      }
      const data = await res.json();
      const inserted = data?.result ?? null;

      // reload canonical list and expand newly created building if possible
      const items = await reloadStages();
      if (inserted) {
        const insertedId = inserted.typeId ?? inserted.type_id ?? inserted.optionId ?? inserted.option_id ?? inserted.id;
        if (insertedId != null) {
          setExpandedStageIds(prev => {
            const copy = new Set(prev);
            copy.add(String(insertedId));
            return copy;
          });
          setTimeout(() => {
            try {
              const el = stageRefs.current[String(insertedId)];
              if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            } catch (e) { console.warn('scroll fail', e); }
          }, 150);
        } else if (items && inserted && inserted.name) {
          const found = items.find(it => String(it.name) === String(inserted.name));
          if (found) {
            const fid = String(getStageId(found));
            setExpandedStageIds(prev => { const copy = new Set(prev); copy.add(fid); return copy; });
            setTimeout(() => {
              try { const el = stageRefs.current[fid]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
            }, 150);
          }
        }
      }

      setCreateName(""); setCreateDesc(""); setCreatePosition(""); setCreateSubstages([{ name: "", desc: "" }]); setShowCreatePanel(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create building");
    } finally {
      setCreating(false);
    }
  }

  // ---------- Add substage (bstages) ----------
  async function submitAddSubstage(e, buildingIdParam, payload) {
    e && e.preventDefault && e.preventDefault();
    setError(null);

    if (!villageId) {
      setError("Missing villageId; cannot add sub-stage.");
      return;
    }

    if (!payload || !payload.name || String(payload.name).trim() === "") {
      setError("Sub-stage name is required");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bstages/insert/${encodeURIComponent(buildingIdParam)}/${encodeURIComponent(villageId)}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.status === 404) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Building not found: ${txt}`);
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Insert failed: ${res.status} ${txt}`);
      }

      const data = await res.json();
      const inserted = data?.result ?? null;

      // Always reload canonical list
      const fresh = await reloadStages();

      if (fresh) {
        const parent = fresh.find(x => String(getStageId(x)) === String(buildingIdParam));
        if (parent) {
          setExpandedStageIds(prev => { const copy = new Set(prev); copy.add(String(buildingIdParam)); return copy; });

          // try to discover inserted sub-id
          let subId = null;
          if (inserted) {
            subId = inserted.stageId ?? inserted.subStageId ?? inserted.sub_stage_id ?? inserted.id ?? inserted.sub_id ?? inserted.subId;
          }

          if (!subId && payload && payload.name) {
            const candidates = (parent.stages ?? []).filter(ss => String((ss.name ?? "")).trim() === String((payload.name ?? "").trim()));
            if (candidates.length === 1) subId = getSubId(candidates[0]);
            else if (candidates.length > 1) subId = getSubId(candidates[candidates.length - 1]);
          }

          setTimeout(() => {
            try {
              if (subId) {
                const el = subRefs.current[`${buildingIdParam}:${subId}`];
                if (el && typeof el.scrollIntoView === 'function') {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  return;
                }
              }
              const pel = stageRefs.current[String(buildingIdParam)];
              if (pel && typeof pel.scrollIntoView === 'function') pel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) { console.warn('scroll fail', e); }
          }, 150);
        }
      }

      setShowAddFormFor(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to add sub-stage");
    }
  }

  // ---------- Edit substage (PUT to /bstages/<buildingId>/<villageId>/<stageId>) ----------
  async function submitEditSubstage(e) {
    e && e.preventDefault();
    if (!editSubstage) return;
    const { stageId: buildingIdParam, subStageId, name, desc } = editSubstage;
    if (!name || !subStageId) return;
    if (!villageId) {
      setError("Missing villageId; cannot update sub-stage.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/bstages/${encodeURIComponent(buildingIdParam)}/${encodeURIComponent(villageId)}/${encodeURIComponent(subStageId)}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim(), desc: desc ?? undefined }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Update substage failed: ${res.status} ${txt}`);
      }
      const payload = await res.json();
      const updated = payload?.result ?? { subStageId, name, desc };
      setStages(prev => prev.map(s => {
        if (String(getStageId(s)) !== String(buildingIdParam)) return s;
        const list = (s.stages ?? []).map(ss => {
          if (String(getSubId(ss)) === String(subStageId)) return { ...ss, ...updated };
          return ss;
        });
        return { ...s, stages: list };
      }));
      setEditSubstage(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update substage");
    }
  }

  // request single-substage delete via modal
  function requestDeleteSubstage(stageId, subStageId, name) {
    setDeleteConfirm({ type: 'substage', stageId, subStageId, name });
  }

  async function performDeleteSubstage(stageId, subStageId) {
    if (!villageId) {
      setError("Missing villageId; cannot delete sub-stage.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/bstages/${encodeURIComponent(stageId)}/${encodeURIComponent(villageId)}/${encodeURIComponent(subStageId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Delete failed: ${res.status} ${txt}`);
      }
      setStages(prev => prev.map(s => {
        if (String(getStageId(s)) !== String(stageId)) return s;
        const list = (s.stages ?? []).map(ss => {
          if (String(getSubId(ss)) === String(subStageId)) return { ...ss, deleted: true };
          return ss;
        });
        return { ...s, stages: list };
      }));
      setSelectedSubstages(prev => {
        const c = { ...prev };
        if (c[stageId]) { c[stageId].delete(subStageId); if (c[stageId].size === 0) delete c[stageId]; }
        return c;
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete substage");
    }
  }

  // ---------- deleted buildings global toggle (calls /deleted_buildings/<villageId>) ----------
  async function toggleDeletedStagesGlobal() {
    if (!villageId) {
      setError("Missing villageId; cannot fetch deleted buildings.");
      return;
    }
    if (showDeletedStages) {
      setShowDeletedStages(false);
      return;
    }
    if (deletedStagesCache && deletedStagesCache.length > 0) {
      setShowDeletedStages(true);
      return;
    }
    setDeletedStagesLoading(true);
    setDeletedStagesError(null);
    try {
      const res = await fetch(`${API_BASE}/deleted_buildings/${encodeURIComponent(villageId)}`);
      if (res.status === 404) {
        setDeletedStagesCache([]);
        setShowDeletedStages(true);
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed: ${res.status} ${txt}`);
      }
      const data = await res.json();
      const items = data?.result?.items ?? (Array.isArray(data) ? data : []);
      setDeletedStagesCache(items);
      setShowDeletedStages(true);
    } catch (err) {
      console.error(err);
      setDeletedStagesError(err.message || "Failed to fetch deleted buildings");
    } finally {
      setDeletedStagesLoading(false);
    }
  }

  function toggleExpandDeletedStage(stageId) {
    setExpandedDeletedStageIds(prev => {
      const copy = new Set(prev);
      if (copy.has(stageId)) copy.delete(stageId);
      else copy.add(stageId);
      return copy;
    });
  }

  // ---------- helper render for substage row (active list) ----------
  function renderSubstageRow(stageId, ss, indexInStage) {
    const subId = getSubId(ss);
    const perStageSelecting = !!stageSubSelectMode[stageId];
    const subSelected = !!(selectedSubstages[stageId] && selectedSubstages[stageId].has(subId));
    const isDraggingOver = String(pendingSubstageReorder?.stageId) === String(stageId) && pendingSubstageReorder?.insertAt === indexInStage && pendingSubstageReorder?.movedId === subId ? true : false;

    return (
      <div
        key={String(subId)}
        ref={(el) => {
          if (el) subRefs.current[`${stageId}:${subId}`] = el;
          else delete subRefs.current[`${stageId}:${subId}`];
        }}
        draggable={!globalSelectMode && !perStageSelecting}
        onDragStart={(e) => handleSubDragStart(e, stageId, indexInStage)}
        onDragOver={(e) => handleSubDragOver(e, stageId, indexInStage)}
        onDrop={(e) => handleSubDrop(e, stageId, indexInStage)}
        onDragEnd={() => { /* optional cleanup */ }}
        className={`flex flex-col gap-2 p-2 border rounded bg-white ${isDraggingOver ? 'border-dashed border-2' : ''}`}
      >
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {perStageSelecting && (
              ss.deleted ? (
                <input type="checkbox" disabled />
              ) : (
                <input type="checkbox" checked={subSelected} onChange={() => toggleSubstageCheckbox(stageId, subId)} />
              )
            )}
            <div className="min-w-0">
              <div className={`${ss.deleted ? "line-through text-gray-400" : "text-gray-800"} font-medium truncate`}>{ss.name ?? `Sub ${subId}`}</div>
              {ss.desc && <div className="text-xs text-gray-500 truncate mt-1">{ss.desc}</div>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!perStageSelecting && (
              <>
                <button onClick={() => setEditSubstage({ stageId, subStageId: subId, name: ss.name ?? "", desc: ss.desc ?? "" })} className="px-2 py-1 rounded bg-indigo-50 text-sm">Edit</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // // ---------- Stage drag & drop handlers (top-level reordering disabled) ----------
  // function handleDragStart(e, index) { return; }
  // function handleDragOver(e, index) { return; }
  // async function handleDrop(e, targetIndex) { return; }
  // function handleDragEnd() { return; }

  // // ---------- Substage reorder (up/down) - creates pendingSubstageReorder ----------
  // function reorderSubstage(stageId, subId, dir) { /* omitted for brevity (kept in original) */ }

  // // ---------- Substage drag handlers (per-stage drag-and-drop) ----------
  const [subDragInfo, setSubDragInfo] = useState(null);
  const [subDragOver, setSubDragOver] = useState({ stageId: null, index: null });

  function handleSubDragStart(e, stageId, sourceIndex) {
    if (globalSelectMode) return;
    setSubDragInfo({ stageId: String(stageId), sourceIndex });
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(sourceIndex)); e.dataTransfer.setData('application/json', JSON.stringify({ stageId })); } catch (err) {}
  }

  function handleSubDragOver(e, stageId, overIndex) {
    e.preventDefault();
    if (globalSelectMode) return;
    if (!subDragInfo) return;
    if (String(subDragInfo.stageId) !== String(stageId)) return;
    setSubDragOver({ stageId: String(stageId), index: overIndex });
  }

  async function handleSubDrop(e, stageId, targetIndex) {
    e.preventDefault();
    if (globalSelectMode) return;
    // determine source index (prefer state fallback to dataTransfer)
    let sourceIndex = subDragInfo?.sourceIndex;
    if (sourceIndex === null || sourceIndex === undefined) {
      try { const dt = e.dataTransfer.getData('text/plain'); sourceIndex = dt !== '' ? Number(dt) : null; } catch (err) { sourceIndex = null; }
    }
    if (sourceIndex === null || sourceIndex === undefined || isNaN(sourceIndex)) { setSubDragInfo(null); setSubDragOver({ stageId: null, index: null }); return; }
    if (!subDragInfo || String(subDragInfo.stageId) !== String(stageId)) { setSubDragInfo(null); setSubDragOver({ stageId: null, index: null }); return; }

    if (sourceIndex === targetIndex) { setSubDragInfo(null); setSubDragOver({ stageId: null, index: null }); return; }

    const sIndex = stages.findIndex(st => String(getStageId(st)) === String(stageId));
    if (sIndex === -1) { setSubDragInfo(null); setSubDragOver({ stageId: null, index: null }); return; }

    const stage = stages[sIndex];
    const list = Array.isArray(stage.stages) ? stage.stages.slice() : [];
    if (sourceIndex < 0 || sourceIndex >= list.length) { setSubDragInfo(null); setSubDragOver({ stageId: null, index: null }); return; }
    const newIdx = Math.max(0, Math.min(list.length - 1, targetIndex));

    // optimistic local reorder
    const newList = list.slice();
    const [moved] = newList.splice(sourceIndex, 1);
    const insertAt = (sourceIndex < newIdx) ? newIdx : newIdx;
    newList.splice(insertAt, 0, moved);
    const withPos = newList.map((ss, i) => ({ ...ss, position: i }));

    setStages(prev => prev.map((st, ii) => ii === sIndex ? { ...st, stages: withPos } : st));

    // save pending substage reorder for confirmation
    setPendingSubstageReorder({
      stageId: String(stageId),
      stageIndex: sIndex,
      moved,
      movedId: String(getSubId(moved)),
      prevList: list,
      newList: withPos,
      insertAt,
      sourceIndex,
      targetIndex: insertAt,
    });

    setSubDragInfo(null);
    setSubDragOver({ stageId: null, index: null });
  }

  // helper: find a subId by matching name/desc within a particular stage (best-effort)
  function findSubIdByNameDesc(stageObj, name, desc) {
    if (!stageObj || !Array.isArray(stageObj.stages)) return null;
    const trimmedName = String(name ?? "").trim();
    const trimmedDesc = desc == null ? null : String(desc ?? "").trim();
    let found = stageObj.stages.find(ss => String((ss.name ?? "")).trim() === trimmedName && (trimmedDesc == null || String((ss.desc ?? "")).trim() === trimmedDesc));
    if (!found) {
      found = stageObj.stages.find(ss => String((ss.name ?? "")).trim() === trimmedName);
    }
    if (!found) return null;
    return String(getSubId(found));
  }

  // // ---------- Confirm / Cancel for substage reorder ----------
  async function confirmSubstageReorder() {
    if (!pendingSubstageReorder) return;
    setPersistingSubstage(String(pendingSubstageReorder.movedId));
    setError(null);

    let { stageId, moved, movedId, insertAt } = pendingSubstageReorder;

    try {
      if (!movedId || movedId === "undefined" || movedId === "null") {
        const fresh = await reloadStages();
        if (fresh) {
          const parent = fresh.find(x => String(getStageId(x)) === String(stageId));
          if (parent) {
            const foundId = findSubIdByNameDesc(parent, moved?.name, moved?.desc);
            if (foundId) {
              movedId = foundId;
            }
          }
        }
      }

      if (!movedId) {
        throw new Error("Reorder failed: could not determine sub-stage id for the moved item. Please refresh or edit the sub-stage to ensure it has an id.");
      }

      const payload = (() => {
        const name = (moved.name ?? "").toString();
        const desc = moved.desc ?? undefined;
        const deleted = !!moved.deleted;
        if (name && name.trim() !== "") {
          return { name: name.trim(), desc, deleted, position: insertAt };
        }
        throw new Error("Reorder failed: sub-stage must have a name locally. Please edit the sub-stage name before reordering.");
      })();

      const res = await fetch(`${API_BASE}/bstages/${encodeURIComponent(stageId)}/${encodeURIComponent(villageId)}/${encodeURIComponent(movedId)}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let txt = '';
        try { txt = await res.text(); } catch {}
        throw new Error(`Substage reorder failed: ${res.status} ${txt}`);
      }

      await reloadStages();
      setPendingSubstageReorder(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to reorder substage');
      await reloadStages();
      setPendingSubstageReorder(null);
    } finally {
      setPersistingSubstage(null);
    }
  }

  function cancelSubstageReorder() {
    if (!pendingSubstageReorder) return;
    const { stageId, prevList, stageIndex } = pendingSubstageReorder;
    setStages(prev => prev.map((st, ii) => {
      if (ii !== stageIndex) return st;
      return { ...st, stages: prevList };
    }));
    setPendingSubstageReorder(null);
  }

  // ---------- Perform delete operations after confirmation ----------
  async function performDeleteConfirmed() {
    if (!deleteConfirm) return;
    setPerformingDelete(true);
    setError(null);
    try {
      if (deleteConfirm.type === 'stage') {
        await performDeleteStage(deleteConfirm.stageId);
      } else if (deleteConfirm.type === 'substage') {
        await performDeleteSubstage(deleteConfirm.stageId, deleteConfirm.subStageId);
      } else if (deleteConfirm.type === 'multipleStages') {
        const failures = [];
        for (const id of (deleteConfirm.ids || [])) {
          try {
            const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(id)}/${encodeURIComponent(villageId)}`, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) {
              const txt = await res.text().catch(() => '');
              failures.push(`${id}: ${res.status} ${txt}`);
            }
          } catch (e) {
            failures.push(`${id}: ${e.message}`);
          }
        }
        await reloadStages();
        setSelectedStageIds(new Set());
        setGlobalSelectMode(false);
        if (failures.length > 0) setError(`Some deletes failed:\n${failures.join('\n')}`);
      } else if (deleteConfirm.type === 'multipleSubstages') {
        const failures = [];
        for (const sid of (deleteConfirm.ids || [])) {
          try {
            const res = await fetch(`${API_BASE}/bstages/${encodeURIComponent(deleteConfirm.stageId)}/${encodeURIComponent(villageId)}/${encodeURIComponent(sid)}`, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) {
              const txt = await res.text().catch(() => '');
              failures.push(`${sid}: ${res.status} ${txt}`);
            }
          } catch (e) {
            failures.push(`${sid}: ${e.message}`);
          }
        }
        // update UI to mark deleted
        setStages(prev => prev.map(s => {
          if (String(getStageId(s)) !== String(deleteConfirm.stageId)) return s;
          const list = (s.stages ?? []).map(ss => {
            if ((deleteConfirm.ids || []).some(x => String(x) === String(getSubId(ss)))) return { ...ss, deleted: true };
            return ss;
          });
          return { ...s, stages: list };
        }));
        setStageSubSelectMode(prev => ({ ...prev, [deleteConfirm.stageId]: false }));
        setSelectedSubstages(prev => { const c = { ...prev }; delete c[deleteConfirm.stageId]; return c; });
        if (failures.length > 0) setError(`Some substage deletes failed:\n${failures.join('\n')}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Delete failed");
      await reloadStages();
    } finally {
      setPerformingDelete(false);
      setDeleteConfirm(null);
    }
  }

  // helper used in performDeleteConfirmed
  async function performDeleteStage(stageId) {
    if (!villageId) {
      throw new Error("Missing villageId; cannot delete building.");
    }
    try {
      const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(stageId)}/${encodeURIComponent(villageId)}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`${res.status} ${txt}`);
      }
      await reloadStages();
    } catch (err) {
      throw err;
    }
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar />
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div>
            <button
              onClick={() => navigate("/home")}
              className="px-3 py-2 border rounded-md bg-white text-sm"
            >
              ◀ Back
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {!globalSelectMode && (
              <button
                onClick={() => setShowCreatePanel(s => !s)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md w-full sm:w-auto text-sm"
              >
                + Add
              </button>
            )}

            <button
              onClick={toggleGlobalSelect}
              className={`px-4 py-2 rounded-md ${globalSelectMode ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-700"} w-full sm:w-auto text-sm`}
              title={globalSelectMode ? "Exit select mode" : "Enter select mode"}
            >
              {globalSelectMode ? "Done" : "Select"}
            </button>

            {globalSelectMode && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={requestDeleteSelectedStages}
                  disabled={selectedStageIds.size === 0}
                  className={`px-4 py-2 rounded-md ${selectedStageIds.size === 0 ? "bg-red-100 text-red-300 cursor-not-allowed" : "bg-red-600 text-white"} w-full sm:w-auto text-sm`}
                  title={selectedStageIds.size === 0 ? "No stages selected" : `Delete selected (${selectedStageIds.size})`}
                >
                  Delete ({selectedStageIds.size})
                </button>

                {selectedStageIds.size > 0 && (
                  <button
                    onClick={deselectAllStages}
                    className="px-4 py-2 rounded-md bg-gray-200 text-gray-700 w-full sm:w-auto text-sm"
                    title="Deselect all selected stages"
                  >
                    Deselect all
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {showCreatePanel && (
          <form onSubmit={handleCreateStage} className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Building name</label>
                <input value={createName} onChange={(e) => setCreateName(e.target.value)} className="w-full p-2 border rounded" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} className="w-full p-2 border rounded" />
              </div>
            </div>
            <div className="center"><button type="button" onClick={() => setCreateSubstages(prev => [...prev, { name: "", desc: "" }])} className="px-6 py-2 mt-3 bg-green-600 text-white rounded justi-center">+ add stages (optional)</button>
            </div>

            <div className="mt-3 space-y-2">
              {createSubstages.map((x, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-6 gap-2 items-center">
                  <input value={x.name} onChange={(e) => setCreateSubstages(prev => prev.map((v, ii) => ii === i ? { ...v, name: e.target.value } : v))} placeholder="Sub-stage name" className="md:col-span-2 p-2 border rounded w-full" />
                  <input value={x.desc} onChange={(e) => setCreateSubstages(prev => prev.map((v, ii) => ii === i ? { ...v, desc: e.target.value } : v))} placeholder="Description" className="md:col-span-3 p-2 border rounded w-full" />
                  <div className="md:col-span-1">
                    <button type="button" onClick={() => setCreateSubstages(prev => prev.filter((_, ii) => ii !== i))} className="px-2 py-2 border rounded w-full sm:w-auto">Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2 flex-col sm:flex-row justify-center">
              <button type="submit" className="px-10 py-2 bg-blue-600 text-white rounded w-full sm:w-auto">{creating ? "Creating…" : "Create"}</button>
              <button type="button" onClick={() => setShowCreatePanel(false)} className="px-10 py-2 border rounded w-full sm:w-auto">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8">Loading buildings…</div>
        ) : error ? (
          <div className="text-red-600 py-6 whitespace-pre-wrap">{error}</div>
        ) : (
          <div className="space-y-4">
            {stages.length === 0 ? (
              <div className="text-sm text-gray-500">No buildings</div>
            ) : (
              stages.map((s, index) => {
                const stageId = getStageId(s);
                const subStages = s.stages ?? s.subStages ?? s.sub_stages ?? s.options ?? [];
                const expanded = expandedStageIds.has(stageId);
                const stageSelected = selectedStageIds.has(stageId);

                const localDeleted = Array.isArray(subStages) ? subStages.filter(ss => ss.deleted === true) : [];
                const cachedDeleted = deletedSubstageCache[stageId] ?? [];
                const mergedDeletedMap = new Map();
                [...localDeleted, ...cachedDeleted].forEach(d => mergedDeletedMap.set(String(getSubId(d)), d));
                const mergedDeleted = Array.from(mergedDeletedMap.values());

                const activeSubs = Array.isArray(subStages) ? subStages.filter(ss => !ss.deleted) : [];

                const showDeletedLink = mergedDeleted.length > 0;

                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={String(stageId)}
                    ref={(el) => {
                      if (el) stageRefs.current[String(stageId)] = el;
                      else delete stageRefs.current[String(stageId)];
                    }}
                    className={`bg-white rounded-lg shadow p-4 border relative ${isDragOver ? "border-dashed border-2" : ""}`}
                    draggable={false}
                    style={{ cursor: "default" }}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {globalSelectMode && (
                          <input
                            type="checkbox"
                            checked={stageSelected}
                            onChange={() => toggleStageCheckbox(stageId)}
                            className="w-4 h-4"
                            aria-label={stageSelected ? "Deselect building" : "Select building"}
                          />
                        )}

                        <div>
                          <div className="text-base sm:text-lg font-semibold text-gray-800 truncate">{s.name}</div>
                          {s.desc && <div className="text-sm text-gray-500 mt-1 truncate">{s.desc}</div>}
                          <div className="text-xs text-gray-400 mt-1">ID: {stageId} </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 sm:mt-0">
                        {!globalSelectMode && !expanded && (
                          <>
                            <button onClick={() => setEditStage({ stageId, name: s.name ?? "", desc: s.desc ?? "", deleted: !!s.deleted })} className="px-3 py-1 rounded bg-indigo-50 text-sm">Edit</button>
                            <button onClick={() => toggleExpandStage(stageId)} className="px-3 py-1 rounded bg-gray-50 text-sm">▼</button>
                          </>
                        )}

                        {!globalSelectMode && expanded && (
                          <>
                            <button onClick={() => toggleExpandStage(stageId)} className="px-3 py-1 rounded bg-gray-50 text-sm">▲</button>
                          </>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-4 border-t pt-4 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-3">
                          <div className="text-sm text-gray-600">Sub-stages ({activeSubs.length})</div>

                          <div className="flex items-center gap-2">
                            {activeSubs.length > 0 && (
                              <>
                                <button
                                  onClick={() => toggleStageSubSelectMode(stageId)}
                                  className={`px-2 py-1 rounded text-sm ${stageSubSelectMode[stageId] ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700'}`}
                                  aria-pressed={!!stageSubSelectMode[stageId]}
                                  title={stageSubSelectMode[stageId] ? 'Exit sub-stage select' : 'Select sub-stages'}
                                >
                                  {stageSubSelectMode[stageId] ? 'Done' : 'Select'}
                                </button>

                                {stageSubSelectMode[stageId] && selectedSubstages[stageId] && selectedSubstages[stageId].size > 0 && (
                                  <>
                                    <button
                                      onClick={() => requestDeleteSelectedSubstages(stageId)}
                                      disabled={!(selectedSubstages[stageId] && selectedSubstages[stageId].size > 0)}
                                      className={`px-3 py-1 rounded ${!(selectedSubstages[stageId] && selectedSubstages[stageId].size > 0) ? "bg-red-100 text-red-300 cursor-not-allowed" : "bg-red-600 text-white"} text-sm`}
                                      title={!(selectedSubstages[stageId] && selectedSubstages[stageId].size > 0) ? "No sub-stages selected" : `Delete selected (${selectedSubstages[stageId].size})`}
                                    >
                                      Delete selected ({selectedSubstages[stageId]?.size ?? 0})
                                    </button>

                                    <button
                                      onClick={() => deselectAllSubstagesFor(stageId)}
                                      className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-sm"
                                      title="Deselect all selected sub-stages in this building"
                                    >
                                      Deselect all
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 max-h-[50vh] sm:max-h-[40vh] overflow-auto">
                          {activeSubs.length === 0 ? (
                            <div className="text-xs text-gray-500">No sub-stages</div>
                          ) : (
                            activeSubs.map((ss, i) => renderSubstageRow(stageId, ss, i))
                          )}
                        </div>

                        <div className="mt-2">
                          {!showAddFormFor || showAddFormFor !== stageId ? (
                            <button onClick={() => setShowAddFormFor(stageId)} className="px-3 py-1 rounded bg-green-50 text-sm w-full sm:w-auto">+ Add Sub-stage</button>
                          ) : (
                            <form onSubmit={(e) => {
                              e.preventDefault();
                              const fd = new FormData(e.target);
                              const payload = {
                                name: (fd.get("sname") || "").toString().trim(),
                                desc: (fd.get("sdesc") || "").toString().trim() || undefined,
                                deleted: false,
                                position: fd.get("position") ? Number(fd.get("position")) : undefined
                              };
                              submitAddSubstage(e, stageId, payload);
                            }} className="bg-gray-50 p-3 rounded w-full">
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                <input name="sname" placeholder="Name" className="md:col-span-2 p-2 border rounded w-full" />
                                <input name="sdesc" placeholder="Description" className="p-2 border rounded w-full" />
                                <input name="position" placeholder="Position (optional)" className="p-2 border rounded w-full" />
                              </div>
                              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded w-full sm:w-auto">Add</button>
                                <button type="button" onClick={() => setShowAddFormFor(null)} className="px-3 py-1 border rounded w-full sm:w-auto">Cancel</button>
                              </div>
                            </form>
                          )}
                        </div>

                        {showDeletedLink && (
                          <div className="mt-2 flex flex-col sm:flex-row sm:justify-end items-center gap-3">
                            <button onClick={() => toggleShowDeletedInline(stageId)} className="text-sm text-indigo-600 underline">
                              {showDeletedInExpanded[stageId] ? "Hide deleted sub-stages" : `Deleted sub-stages (${mergedDeleted.length})`}
                            </button>
                            {!showDeletedInExpanded[stageId] && <div className="text-xs text-gray-400"></div>}
                          </div>
                        )}

                        {showDeletedInExpanded[stageId] && (
                          <div className="mt-3 bg-gray-50 p-3 rounded border">
                            {mergedDeleted.length === 0 ? (
                              <div className="text-xs text-gray-500">No deleted sub-stages</div>
                            ) : (
                              <div className="space-y-2">
                                {mergedDeleted.map(sub => {
                                  const subId = getSubId(sub);
                                  return (
                                    <div key={String(subId)} className="p-2 bg-white border rounded">
                                      <div className={`${sub.deleted ? "line-through text-gray-400" : "text-gray-800"} font-medium`}>{sub.name}</div>
                                      {sub.desc && <div className="text-xs text-gray-500 mt-1">{sub.desc}</div>}
                                      <div className="text-xs text-gray-400 mt-1">ID: {subId}{sub.deleted ? " (deleted)" : ""}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Center: toggle deleted buildings (global) */}
        <div className="mt-4">
          <div className="flex justify-center">
            <button onClick={toggleDeletedStagesGlobal} className="text-sm text-indigo-600 underline px-2 py-1">
              {showDeletedStages ? "Hide deleted buildings" : "Show deleted buildings"}
            </button>
          </div>

          {showDeletedStages && (
            <div className="mt-7 ">
              {deletedStagesLoading ? (
                <div className="text-sm text-gray-600">Loading deleted buildings…</div>
              ) : deletedStagesError ? (
                <div className="text-sm text-red-600">{deletedStagesError}</div>
              ) : deletedStagesCache.length === 0 ? (
                <div className="text-sm text-gray-500">No deleted buildings</div>
              ) : (
                <div className="space-y-4">
                  {deletedStagesCache.map(ds => {
                    const id = ds.typeId ?? ds.type_id ?? ds.stageId ?? ds.stage_id ?? ds.id ?? ds.optionId;
                    const dsSub = ds.stages ?? ds.subStages ?? ds.sub_stages ?? [];
                    const isExpanded = expandedDeletedStageIds.has(id);
                    return (
                      <div key={String(id)} className="p-4 border rounded-xl bg-gray-100 ">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{ds.name}</div>
                            {ds.desc && <div className="text-xs text-gray-500 mt-1">{ds.desc}</div>}
                            <div className="text-xs text-gray-400 mt-1">ID: {id}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleExpandDeletedStage(id)}
                              className="px-2 py-1 rounded bg-gray-100 text-sm"
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            {Array.isArray(dsSub) && dsSub.length > 0 ? (
                              dsSub.map(sub => {
                                const subId = sub.subStageId ?? sub.sub_stage_id ?? sub.id ?? sub.sub_id ?? sub.subId ?? sub.stageId ?? sub.name;
                                return (
                                  <div key={String(subId)} className="p-2 bg-gray-50 border rounded">
                                    <div className={`${sub.deleted ? "line-through text-gray-400" : "text-gray-800"} font-medium`}>{sub.name}</div>
                                    {sub.desc && <div className="text-xs text-gray-500 mt-1">{sub.desc}</div>}
                                    <div className="text-xs text-gray-400 mt-1">ID: {subId}{sub.deleted ? " (deleted)" : ""}</div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-xs text-gray-500">No sub-stages</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit building modal (PUT /buildings/<buildingId>/<villageId>) */}
        {editStage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md sm:max-w-lg md:max-w-xl mx-3 sm:mx-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Edit Building</h4>
                <button onClick={() => setEditStage(null)} className="text-gray-500">×</button>
              </div>
              <form onSubmit={async (e) => { e.preventDefault(); try {
                    if (!villageId) throw new Error("Missing villageId; cannot update building.");
                    const payload = { name: editStage.name, desc: editStage.desc, deleted: !!editStage.deleted };
                    const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(editStage.stageId)}/${encodeURIComponent(villageId)}`, {
                      method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
                    });
                    if (!res.ok) { const t = await res.text().catch(()=> ''); throw new Error(`${res.status} ${t}`); }
                    await reloadStages();
                    setEditStage(null);
                } catch(err) { setError(err.message); }
              }} className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700">Name</label>
                  <input className="w-full p-2 border rounded" value={editStage.name} onChange={(e) => setEditStage(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Description</label>
                  <input className="w-full p-2 border rounded" value={editStage.desc} onChange={(e) => setEditStage(p => ({ ...p, desc: e.target.value }))} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editStage.deleted} onChange={(e) => setEditStage(p => ({ ...p, deleted: e.target.checked }))} />
                    <span className="text-sm">Mark deleted</span>
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                  <button type="button" onClick={() => setEditStage(null)} className="px-4 py-2 border rounded">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit substage modal */}
        {editSubstage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md sm:max-w-lg md:max-w-xl mx-3 sm:mx-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Edit Sub-stage</h4>
                <button onClick={() => setEditSubstage(null)} className="text-gray-500">×</button>
              </div>
              <form onSubmit={submitEditSubstage} className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700">Name</label>
                  <input className="w-full p-2 border rounded" value={editSubstage.name} onChange={(e) => setEditSubstage(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Description</label>
                  <input className="w-full p-2 border rounded" value={editSubstage.desc} onChange={(e) => setEditSubstage(p => ({ ...p, desc: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                  <button type="button" onClick={() => setEditSubstage(null)} className="px-4 py-2 border rounded">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirm pending substage reorder */}
        {pendingSubstageReorder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-3 sm:mx-0">
              <h3 className="text-lg font-semibold mb-2">Confirm sub-stage reorder</h3>
              <div className="text-sm text-gray-700 mb-4">
                Move "<span className="font-medium">{pendingSubstageReorder.moved?.name ?? pendingSubstageReorder.movedId}</span>" to position <span className="font-medium">{pendingSubstageReorder.insertAt}</span> in building <span className="font-medium">{(stages[pendingSubstageReorder.stageIndex]?.name) ?? pendingSubstageReorder.stageId}</span>?
              </div>
              {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={cancelSubstageReorder} disabled={!!persistingSubstage} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={confirmSubstageReorder} disabled={!!persistingSubstage} className="px-4 py-2 bg-blue-600 text-white rounded">{persistingSubstage ? "Saving…" : "Confirm"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-3 sm:mx-0">
              <h3 className="text-lg font-semibold mb-2">Confirm delete</h3>
              <div className="text-sm text-gray-700 mb-4">
                {deleteConfirm.type === 'stage' && (
                  <>Are you sure you want to delete building "<span className="font-medium">{deleteConfirm.name ?? deleteConfirm.stageId}</span>"?</>
                )}
                {deleteConfirm.type === 'substage' && (
                  <>Are you sure you want to delete sub-stage "<span className="font-medium">{deleteConfirm.name ?? deleteConfirm.subStageId}</span>"?</>
                )}
                {deleteConfirm.type === 'multipleStages' && (
                  <>Are you sure you want to delete <span className="font-medium">{(deleteConfirm.ids || []).length}</span> selected buildings?</>
                )}
                {deleteConfirm.type === 'multipleSubstages' && (
                  <>Are you sure you want to delete <span className="font-medium">{(deleteConfirm.ids || []).length}</span> selected sub-stages?</>
                )}
              </div>

              {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteConfirm(null)} disabled={performingDelete} className="px-4 py-2 border rounded">Cancel</button>
                <button onClick={performDeleteConfirmed} disabled={performingDelete} className="px-4 py-2 bg-red-600 text-white rounded">{performingDelete ? "Deleting…" : "Delete"}</button>
              </div>
            </div>
          </div>
        )}

        <div className="h-24" />
      </div>
    </div>
  );
}
