// src/pages/StagePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";

/**
 * StagePage
 *
 * - Fetches /stages on mount and displays them
 * - Global Select mode, per-stage sub-select, edit/delete logic unchanged
 * - Each expanded card:
 *    - Shows active (non-deleted) sub-stages in the main list (with descriptions)
 *    - Shows "+ Add Sub-stage" area
 *    - Shows a "Deleted sub-stages" link (only if deleted subs exist)
 *      which toggles a separate list rendered below the Add area (read-only)
 * - Single global "Show deleted stages" below all cards remains unchanged
 *
 * NOTE: All alert() and confirm() calls removed per request. Errors are logged and
 * set to the `error` state where it makes sense for display at the top of the page.
 */

export default function StagePage() {
  const navigate = useNavigate();

  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  const [createSubstages, setCreateSubstages] = useState([{ name: "", desc: "" }]);
  const [creating, setCreating] = useState(false);

  const [showAddFormFor, setShowAddFormFor] = useState(null);

  // global deleted-stages list (unchanged)
  const [deletedStagesCache, setDeletedStagesCache] = useState([]);
  const [deletedStagesLoading, setDeletedStagesLoading] = useState(false);
  const [deletedStagesError, setDeletedStagesError] = useState(null);
  const [showDeletedStages, setShowDeletedStages] = useState(false);
  const [expandedDeletedStageIds, setExpandedDeletedStageIds] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    (async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("https://villagerelocation.onrender.com/stages");
        if (res.status === 404) {
          if (!mounted) return;
          setStages([]);
          setError("No stages found");
          return;
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to load stages: ${res.status} ${txt}`);
        }
        const payload = await res.json();
        let items = [];
        if (payload?.result?.items) items = payload.result.items;
        else if (Array.isArray(payload.result)) items = payload.result;
        else if (Array.isArray(payload)) items = payload;
        else if (Array.isArray(payload.items)) items = payload.items;
        if (!mounted) return;
        setStages(items);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(err.message || "Failed to fetch stages");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
  }

  // ---------- Helpers for ID detection ----------
  const getStageId = (s) => s.stageId ?? s.stage_id ?? s.id;
  const getSubId = (ss) => ss.subStageId ?? ss.sub_stage_id ?? ss.id ?? ss.sub_id ?? ss.subId ?? ss.name;

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

  async function deleteSelectedStages() {
    if (selectedStageIds.size === 0) {
      // nothing to delete
      return;
    }
    const failures = [];
    for (const id of Array.from(selectedStageIds)) {
      try {
        const res = await fetch(`https://villagerelocation.onrender.com/stages/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          failures.push(`${id}: ${res.status} ${txt}`);
        } else {
          setStages(prev => prev.filter(s => String(getStageId(s)) !== String(id)));
        }
      } catch (err) {
        console.error(err);
        failures.push(`${id}: ${err.message}`);
      }
    }
    setSelectedStageIds(new Set());
    setGlobalSelectMode(false);
    if (failures.length > 0) {
      console.error("Some deletes failed:", failures);
      setError(`Some deletes failed:\n${failures.join("\n")}`);
    }
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
  // We'll show deleted sub-stages **separately** (below the Add area).
  async function toggleShowDeletedInline(stageId) {
    const currently = !!showDeletedInExpanded[stageId];
    if (currently) {
      setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: false }));
      return;
    }

    // find stage and check local deleted
    const s = stages.find(x => String(getStageId(x)) === String(stageId));
    const localDeleted = Array.isArray(s?.stages) ? s.stages.filter(ss => ss.deleted === true) : [];

    // if local deleted exist, show them (no fetch)
    if (localDeleted.length > 0) {
      setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: true }));
      return;
    }

    // if cached, show and merge into local view
    if (deletedSubstageCache[stageId] && deletedSubstageCache[stageId].length > 0) {
      // merge into local stage.stages so that data is available consistently
      setStages(prev => prev.map(st => {
        if (String(getStageId(st)) !== String(stageId)) return st;
        const existing = Array.isArray(st.stages) ? st.stages.slice() : [];
        const existingIds = new Set(existing.map(x => String(getSubId(x))));
        const toAdd = deletedSubstageCache[stageId].filter(x => !existingIds.has(String(getSubId(x))));
        return { ...st, stages: [...existing, ...toAdd] };
      }));
      setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: true }));
      return;
    }

    // otherwise fetch deleted_substages for this stage
    try {
      const res = await fetch(`https://villagerelocation.onrender.com/deleted_substages/${encodeURIComponent(stageId)}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed: ${res.status} ${txt}`);
      }
      const data = await res.json();
      const items = data?.result?.items ?? [];
      if (!Array.isArray(items) || items.length === 0) {
        // nothing to show
        return;
      }
      const marked = items.map(it => ({ ...it, deleted: true }));
      setDeletedSubstageCache(prev => ({ ...prev, [stageId]: marked }));

      setStages(prev => prev.map(st => {
        if (String(getStageId(st)) !== String(stageId)) return st;
        const existing = Array.isArray(st.stages) ? st.stages.slice() : [];
        const existingIds = new Set(existing.map(x => String(getSubId(x))));
        const toAdd = marked.filter(x => !existingIds.has(String(getSubId(x))));
        return { ...st, stages: [...existing, ...toAdd] };
      }));

      setShowDeletedInExpanded(prev => ({ ...prev, [stageId]: true }));
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

  async function deleteSelectedSubstages(stageId) {
    const set = selectedSubstages[stageId];
    if (!set || set.size === 0) {
      // nothing selected
      return;
    }
    const failures = [];
    for (const subId of Array.from(set)) {
      try {
        const res = await fetch(`https://villagerelocation.onrender.com/sstages/${encodeURIComponent(stageId)}/${encodeURIComponent(subId)}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          failures.push(`${subId}: ${res.status} ${txt}`);
        } else {
          setStages(prev => prev.map(s => {
            if (String(getStageId(s)) !== String(stageId)) return s;
            const list = (s.stages ?? []).map(ss => {
              if (String(getSubId(ss)) === String(subId)) return { ...ss, deleted: true };
              return ss;
            });
            return { ...s, stages: list };
          }));
        }
      } catch (err) {
        console.error(err);
        failures.push(`${subId}: ${err.message}`);
      }
    }
    setSelectedSubstages(prev => {
      const copy = { ...prev };
      delete copy[stageId];
      return copy;
    });
    setStageSubSelectMode(prev => ({ ...prev, [stageId]: false }));
    if (failures.length > 0) {
      console.error("Some substage deletes failed:", failures);
      setError(`Some deletes failed:\n${failures.join("\n")}`);
    }
  }

  // ---------- create / update / delete (unchanged except removing confirm/alert prompts) ----------
  async function handleCreateStage(e) {
    e && e.preventDefault();
    if (!createName || createName.trim() === "") {
      // validation failed
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: createName.trim(),
        desc: createDesc?.trim() || undefined,
        deleted: false,
        stages: createSubstages.map(s => ({ name: (s.name || "").trim(), desc: (s.desc || "").trim() || undefined })).filter(x => x.name),
      };
      const res = await fetch("https://villagerelocation.onrender.com/stages/insert", {
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
      if (inserted) setStages(prev => [inserted, ...prev]);
      else await reloadStages();

      setCreateName(""); setCreateDesc(""); setCreateSubstages([{ name: "", desc: "" }]); setShowCreatePanel(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create stage");
    } finally {
      setCreating(false);
    }
  }

  async function reloadStages() {
    try {
      const res = await fetch("https://villagerelocation.onrender.com/stages");
      if (!res.ok) return;
      const payload = await res.json();
      let items = [];
      if (payload?.result?.items) items = payload.result.items;
      else if (Array.isArray(payload.result)) items = payload.result;
      else if (Array.isArray(payload)) items = payload;
      else if (Array.isArray(payload.items)) items = payload.items;
      setStages(items);
    } catch (e) {
      console.error(e);
    }
  }

  async function submitStageUpdate(e) {
    e && e.preventDefault();
    if (!editStage || !editStage.stageId) return;
    if (!editStage.name || editStage.name.trim() === "") {
      return;
    }
    try {
      const body = { name: editStage.name.trim(), desc: editStage.desc ?? undefined, deleted: !!editStage.deleted };
      const res = await fetch(`https://villagerelocation.onrender.com/stages/${encodeURIComponent(editStage.stageId)}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Update failed: ${res.status} ${txt}`);
      }
      const payload = await res.json();
      const updated = payload?.result ?? body;
      setStages(prev => prev.map(s => {
        if (String(getStageId(s)) === String(editStage.stageId)) return { ...s, ...updated };
        return s;
      }));
      setEditStage(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update stage");
    }
  }

  async function deleteStage(stageId) {
    try {
      const res = await fetch(`https://villagerelocation.onrender.com/stages/${encodeURIComponent(stageId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Delete failed: ${res.status} ${txt}`);
      }
      setStages(prev => prev.filter(s => String(getStageId(s)) !== String(stageId)));
      setSelectedStageIds(prev => { const c = new Set(prev); c.delete(stageId); return c; });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete stage");
    }
  }

  async function submitAddSubstage(e, stageId, payload) {
    e && e.preventDefault();
    if (!payload?.name || !payload.name.trim()) {
      return;
    }
    try {
      const res = await fetch(`https://villagerelocation.onrender.com/substage/insert/${encodeURIComponent(stageId)}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Insert failed: ${res.status} ${txt}`);
      }
      const data = await res.json();
      const inserted = data?.result ?? null;
      if (inserted) {
        setStages(prev => prev.map(s => {
          if (String(getStageId(s)) === String(stageId)) {
            const arr = Array.isArray(s.stages) ? s.stages.slice() : [];
            return { ...s, stages: [...arr, inserted] };
          }
          return s;
        }));
      } else {
        await reloadStages();
      }
      setShowAddFormFor(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to insert substage");
    }
  }

  async function submitEditSubstage(e) {
    e && e.preventDefault();
    if (!editSubstage) return;
    const { stageId, subStageId, name, desc } = editSubstage;
    if (!name || !subStageId) return;
    try {
      const res = await fetch(`https://villagerelocation.onrender.com/sstages/${encodeURIComponent(stageId)}/${encodeURIComponent(subStageId)}`, {
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
        if (String(getStageId(s)) !== String(stageId)) return s;
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

  async function deleteSubstage(stageId, subStageId) {
    try {
      const res = await fetch(`https://villagerelocation.onrender.com/sstages/${encodeURIComponent(stageId)}/${encodeURIComponent(subStageId)}`, {
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

  // ---------- single global "deleted stages" toggle (unchanged) ----------
  async function toggleDeletedStagesGlobal() {
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
      const res = await fetch("https://villagerelocation.onrender.com/deleted_stages");
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
      setDeletedStagesError(err.message || "Failed to fetch deleted stages");
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
  function renderSubstageRow(stageId, ss) {
    const subId = getSubId(ss);
    const perStageSelecting = !!stageSubSelectMode[stageId];
    const subSelected = !!(selectedSubstages[stageId] && selectedSubstages[stageId].has(subId));
    return (
      <div key={String(subId)} className="flex flex-col gap-2 p-2 border rounded bg-white">
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
                {!ss.deleted && <button onClick={() => deleteSubstage(stageId, subId)} className="px-2 py-1 rounded bg-red-50 text-sm">Delete</button>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavbar />
      <div className="max-w-6xl mx-auto p-6">
        {/* Header: Dashboard on left, Add / Select on the right */}
        <div className="flex items-center justify-between mb-6">
          {/* Left: Dashboard */}
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 py-2 border rounded-md bg-white"
            >
              ← Back
            </button>
          </div>

          {/* Right: Add / Select / Delete selected */}
          <div className="flex items-center gap-3">
            {/* Add button hidden while in global select */}
            {!globalSelectMode && (
              <button
                onClick={() => setShowCreatePanel(s => !s)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
              >
                + Add
              </button>
            )}

            {/* Global select toggle */}
            <button
              onClick={toggleGlobalSelect}
              className={`px-4 py-2 rounded-md ${globalSelectMode ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-700"}`}
              title={globalSelectMode ? "Exit select mode" : "Enter select mode"}
            >
              {globalSelectMode ? "Done" : "Select"}
            </button>

            {/* Delete selected appears only in select mode */}
            {globalSelectMode && (
              <button
                onClick={deleteSelectedStages}
                disabled={selectedStageIds.size === 0}
                className={`px-4 py-2 rounded-md ${selectedStageIds.size === 0 ? "bg-red-100 text-red-300 cursor-not-allowed" : "bg-red-600 text-white"}`}
                title={selectedStageIds.size === 0 ? "No stages selected" : `Delete selected (${selectedStageIds.size})`}
              >
                Delete selected ({selectedStageIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Create panel */}
        {showCreatePanel && (
          <form onSubmit={handleCreateStage} className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Stage name</label>
                <input value={createName} onChange={(e) => setCreateName(e.target.value)} className="w-full p-2 border rounded" />
                <label className="block text-sm font-medium text-gray-700 mt-3">Description</label>
                <input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} className="w-full p-2 border rounded" />
              </div>

              <div className="flex flex-col justify-between">
                <div className="text-sm text-gray-600">Sub-stages (optional)</div>
                <button type="button" onClick={() => setCreateSubstages(prev => [...prev, { name: "", desc: "" }])} className="px-3 py-2 bg-green-600 text-white rounded">+ add field</button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {createSubstages.map((x, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                  <input value={x.name} onChange={(e) => setCreateSubstages(prev => prev.map((v, ii) => ii === i ? { ...v, name: e.target.value } : v))} placeholder="Sub-stage name" className="md:col-span-2 p-2 border rounded" />
                  <input value={x.desc} onChange={(e) => setCreateSubstages(prev => prev.map((v, ii) => ii === i ? { ...v, desc: e.target.value } : v))} placeholder="Description" className="md:col-span-3 p-2 border rounded" />
                  <div className="md:col-span-1">
                    <button type="button" onClick={() => setCreateSubstages(prev => prev.filter((_, ii) => ii !== i))} className="px-2 py-2 border rounded">Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">{creating ? "Creating…" : "Create"}</button>
              <button type="button" onClick={() => setShowCreatePanel(false)} className="px-4 py-2 border rounded">Cancel</button>
            </div>
          </form>
        )}

        {/* Stage list */}
        {loading ? (
          <div className="text-center py-8">Loading stages…</div>
        ) : error ? (
          <div className="text-red-600 py-6 whitespace-pre-wrap">{error}</div>
        ) : (
          <div className="space-y-4">
            {stages.map((s) => {
              const stageId = getStageId(s);
              const subStages = s.stages ?? s.subStages ?? s.sub_stages ?? s.options ?? [];
              const expanded = expandedStageIds.has(stageId);
              const stageSelected = selectedStageIds.has(stageId);

              // local deleted list + potential cached ones
              const localDeleted = Array.isArray(subStages) ? subStages.filter(ss => ss.deleted === true) : [];
              const cachedDeleted = deletedSubstageCache[stageId] ?? [];
              // combine cached + local deleted by unique subId (cached items may duplicate)
              const mergedDeletedMap = new Map();
              [...localDeleted, ...cachedDeleted].forEach(d => mergedDeletedMap.set(String(getSubId(d)), d));
              const mergedDeleted = Array.from(mergedDeletedMap.values());

              // active (non-deleted) subs
              const activeSubs = Array.isArray(subStages) ? subStages.filter(ss => !ss.deleted) : [];

              const showDeletedLink = mergedDeleted.length > 0;

              return (
                <div key={String(stageId)} className="bg-white rounded-lg shadow p-4 border relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {globalSelectMode && (
                        <input type="checkbox" checked={stageSelected} onChange={() => toggleStageCheckbox(stageId)} />
                      )}

                      <div>
                        <div className="text-lg font-semibold text-gray-800 truncate">{s.name}</div>
                        {s.desc && <div className="text-sm text-gray-500 mt-1">{s.desc}</div>}
                        <div className="text-xs text-gray-400 mt-1">ID: {stageId}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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

                  {/* Expanded area */}
                  {expanded && (
                    <div className="mt-4 border-t pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">Sub-stages ({activeSubs.length})</div>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={!!stageSubSelectMode[stageId]} onChange={() => toggleStageSubSelectMode(stageId)} />
                            <span>Select</span>
                          </label>
                        </div>
                      </div>

                      {stageSubSelectMode[stageId] && selectedSubstages[stageId] && selectedSubstages[stageId].size > 0 && (
                        <div className="flex justify-end">
                          <button onClick={() => deleteSelectedSubstages(stageId)} className="px-3 py-1 bg-red-600 text-white rounded">Delete selected ({selectedSubstages[stageId].size})</button>
                        </div>
                      )}

                      {/* Active sub-stages list (non-deleted) */}
                      <div className="space-y-2">
                        {activeSubs.length === 0 ? (
                          <div className="text-xs text-gray-500">No sub-stages</div>
                        ) : (
                          activeSubs.map(ss => renderSubstageRow(stageId, ss))
                        )}
                      </div>

                      {/* Add sub-stage area */}
                      <div className="mt-2">
                        {!showAddFormFor || showAddFormFor !== stageId ? (
                          <button onClick={() => setShowAddFormFor(stageId)} className="px-3 py-1 rounded bg-green-50 text-sm">+ Add Sub-stage</button>
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
                          }} className="bg-gray-50 p-3 rounded">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <input name="sname" placeholder="Name" className="md:col-span-2 p-2 border rounded" />
                              <input name="sdesc" placeholder="Description" className="p-2 border rounded" />
                              <input name="position" placeholder="Position (optional)" className="p-2 border rounded" />
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">Add</button>
                              <button type="button" onClick={() => setShowAddFormFor(null)} className="px-3 py-1 border rounded">Cancel</button>
                            </div>
                          </form>
                        )}
                      </div>

                      {/* Deleted sub-stages link (only if any deleted exists) */}
                      {showDeletedLink && (
                        <div className="mt-2 flex justify-end items-center gap-3">
                          <button onClick={() => toggleShowDeletedInline(stageId)} className="text-sm text-indigo-600 underline">
                            {showDeletedInExpanded[stageId] ? "Hide deleted sub-stages" : `Deleted sub-stages (${mergedDeleted.length})`}
                          </button>
                          {!showDeletedInExpanded[stageId] && <div className="text-xs text-gray-400"></div>}
                        </div>
                      )}

                      {/* Deleted sub-stages separate list (rendered below Add area when toggled) */}
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
            })}

            {/* Single global deleted-stages link (placed after all stage cards) */}
            <div className="mt-4">
              <div className="flex justify-center">
                <button onClick={toggleDeletedStagesGlobal} className="text-sm text-indigo-600 underline">
                  {showDeletedStages ? "Hide deleted stages" : "Show deleted stages"}
                </button>
              </div>

              {showDeletedStages && (
                <div className="mt-3 bg-gray-50 p-3 rounded border">
                  {deletedStagesLoading ? (
                    <div className="text-sm text-gray-600">Loading deleted stages…</div>
                  ) : deletedStagesError ? (
                    <div className="text-sm text-red-600">{deletedStagesError}</div>
                  ) : deletedStagesCache.length === 0 ? (
                    <div className="text-sm text-gray-500">No deleted stages</div>
                  ) : (
                    <div className="space-y-2">
                      {deletedStagesCache.map(ds => {
                        const id = ds.stageId ?? ds.stage_id ?? ds.id;
                        const dsSub = ds.stages ?? ds.subStages ?? ds.sub_stages ?? [];
                        const isExpanded = expandedDeletedStageIds.has(id);
                        return (
                          <div key={String(id)} className="p-2 border rounded bg-white">
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
                                    const subId = sub.subStageId ?? sub.sub_stage_id ?? sub.id ?? sub.sub_id ?? sub.subId ?? sub.name;
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
          </div>
        )}

        {/* Edit stage modal */}
        {editStage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Edit Stage</h4>
                <button onClick={() => setEditStage(null)} className="text-gray-500">✕</button>
              </div>
              <form onSubmit={submitStageUpdate} className="space-y-3">
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
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Edit Sub-stage</h4>
                <button onClick={() => setEditSubstage(null)} className="text-gray-500">✕</button>
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

        <div className="h-24" />
      </div>
    </div>
  );
}
