// src/component/StageModal.jsx
import React, { useEffect, useState, useRef } from "react";

/**
 * StageModal
 * - villageId is optional for building-related endpoints; most stage endpoints are global.
 * - onClose: callback
 *
 * Supports:
 * - GET /stages
 * - PUT /stages/<stageId>
 * - DELETE /stages/<stageId>
 * - POST /substage/insert/<stageId>
 * - PUT /sstages/<stageId>/<subStageId>
 * - DELETE /sstages/<stageId>/<subStageId>
 *
 * Notes:
 * - If your backend exposes POST /stages/insert for creating top-level stages we attempt it,
 *   otherwise user will be alerted that "create top-level stage not available".
 */

export default function StageModal({ onClose }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [showAddForm, setShowAddForm] = useState(false); // top-level stage create
  const [showSubstageFormFor, setShowSubstageFormFor] = useState(null); // stageId for which to add substage
  const [editStage, setEditStage] = useState(null); // { stageId, name, desc }
  const [editSubstage, setEditSubstage] = useState(null); // { stageId, subStageId, name, desc }

  const [selectMode, setSelectMode] = useState(false);
  const [selectDropdown, setSelectDropdown] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => (mountedRef.current = false);
  }, []);

  // fetch stages
  async function fetchStages(signal) {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`https://villagerelocation.onrender.com/stages`, {
        method: "GET",
        headers,
        signal,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to load stages: ${res.status} ${txt}`);
      }
      const payload = await res.json();
      // payload may be { error: false, result: { count, items: [...] } } or just items
      let items = [];
      if (payload?.result?.items) items = payload.result.items;
      else if (Array.isArray(payload.result)) items = payload.result;
      else if (Array.isArray(payload)) items = payload;
      else if (Array.isArray(payload.items)) items = payload.items;

      if (!mountedRef.current) return;
      setStages(items);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchStages(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  // selection helpers
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(stages.map((s) => s.stageId ?? s.stage_id ?? s.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Top-level stage update
  async function submitStageUpdate(e) {
    e && e.preventDefault();
    if (!editStage || !editStage.stageId) return;
    const { stageId, name, desc } = editStage;
    if (!name || name.trim() === "") {
      alert("Provide stage name");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `https://villagerelocation.onrender.com/stages/${encodeURIComponent(stageId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ name: name.trim(), desc: desc ?? undefined }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Update failed: ${res.status} ${txt}`);
      }
      // refresh list
      const ctrl = new AbortController();
      await fetchStages(ctrl.signal);
      setEditStage(null);
    } catch (err) {
      alert(err.message || "Failed to update stage");
    }
  }

  // Delete stage
  async function deleteStage(stageId) {
    if (!confirm(`Soft-delete stage ${stageId}?`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `https://villagerelocation.onrender.com/stages/${encodeURIComponent(stageId)}`,
        {
          method: "DELETE",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Delete failed: ${res.status} ${txt}`);
      }
      const ctrl = new AbortController();
      await fetchStages(ctrl.signal);
      clearSelection();
    } catch (err) {
      alert(err.message || "Failed to delete stage");
    }
  }

  // Insert substage
  async function submitAddSubstage(e, stageId, payload) {
    e && e.preventDefault();
    if (!stageId || !payload?.name) {
      alert("Provide substage name");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `https://villagerelocation.onrender.com/substage/insert/${encodeURIComponent(stageId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Insert substage failed: ${res.status} ${txt}`);
      }
      const ctrl = new AbortController();
      await fetchStages(ctrl.signal);
      setShowSubstageFormFor(null);
    } catch (err) {
      alert(err.message || "Failed to insert substage");
    }
  }

  // Update substage
  async function submitEditSubstage(e) {
    e && e.preventDefault();
    if (!editSubstage) return;
    const { stageId, subStageId, name, desc } = editSubstage;
    if (!name || !subStageId) {
      alert("Missing substage data");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `https://villagerelocation.onrender.com/sstages/${encodeURIComponent(stageId)}/${encodeURIComponent(subStageId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ name: name.trim(), desc: desc ?? undefined }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Update substage failed: ${res.status} ${txt}`);
      }
      const ctrl = new AbortController();
      await fetchStages(ctrl.signal);
      setEditSubstage(null);
    } catch (err) {
      alert(err.message || "Failed to update substage");
    }
  }

  // Delete substage
  async function deleteSubstage(stageId, subStageId) {
    if (!confirm(`Delete sub-stage ${subStageId} under ${stageId}?`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `https://villagerelocation.onrender.com/sstages/${encodeURIComponent(stageId)}/${encodeURIComponent(subStageId)}`,
        {
          method: "DELETE",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Delete substage failed: ${res.status} ${txt}`);
      }
      const ctrl = new AbortController();
      await fetchStages(ctrl.signal);
    } catch (err) {
      alert(err.message || "Failed to delete substage");
    }
  }

  // Bulk delete selected stages
  async function deleteSelected() {
    if (selectedIds.size === 0) {
      alert("No stages selected");
      return;
    }
    if (!confirm(`Delete ${selectedIds.size} selected stage(s)?`)) return;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await fetch(`https://villagerelocation.onrender.com/stages/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const txt = await res.text();
          console.warn(`Failed to delete ${id}: ${res.status} ${txt}`);
        }
      } catch (err) {
        console.warn(`Failed to delete ${id}: ${err.message}`);
      }
    }
    const ctrl = new AbortController();
    await fetchStages(ctrl.signal);
    clearSelection();
  }

  // Delete all (all fetched stages)
  async function deleteAll() {
    if (!confirm("Delete ALL fetched stages? This will mark them deleted (soft delete).")) return;
    setSelectedIds(new Set(stages.map(s => s.stageId ?? s.stage_id ?? s.id)));
    await deleteSelected();
  }

  // Add top-level stage (attempt endpoint POST /stages/insert if present)
  async function submitAddStage(e, payload) {
    e && e.preventDefault();
    if (!payload?.name) {
      alert("Provide stage name");
      return;
    }

    // Try POST /stages/insert first (may or may not exist)
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://villagerelocation.onrender.com/stages/insert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 404 || res.status === 400) {
        // if server doesn't support create top-level stage, fallback: alert user
        const txt = await res.text();
        alert(`Create stage not supported by backend: ${res.status} ${txt}`);
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Create stage failed: ${res.status} ${txt}`);
      }

      const ctrl = new AbortController();
      await fetchStages(ctrl.signal);
      setShowAddForm(false);
    } catch (err) {
      alert(err.message || "Failed to create stage (or endpoint not present)");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-auto max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Manage Stages</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowAddForm(s => !s); setSelectMode(false); }}
              className="px-3 py-1 rounded bg-green-100 hover:bg-green-200 text-sm"
            >
              Add Stage
            </button>

            <div className="relative">
              <button
                onClick={() => { setSelectMode(s => !s); setSelectDropdown(sd => !sd); }}
                className={`px-3 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-sm ${selectMode ? "ring-2 ring-indigo-200" : ""}`}
              >
                Select
              </button>
              {selectDropdown && (
                <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow p-2">
                  <button onClick={() => { selectAll(); setSelectDropdown(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm">Select all</button>
                  <button onClick={() => { deleteSelected(); setSelectDropdown(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-red-600">Delete selected</button>
                  <button onClick={() => { deleteAll(); setSelectDropdown(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-red-700">Delete all</button>
                </div>
              )}
            </div>

            <button onClick={onClose} className="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-sm">Close</button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Add top-level stage form */}
          {showAddForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.target);
                const payload = {
                  name: (form.get("name") || "").toString().trim(),
                  desc: (form.get("desc") || "").toString().trim() || undefined,
                };
                submitAddStage(e, payload);
              }}
              className="bg-gray-50 p-3 rounded"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input name="name" className="p-2 border rounded" placeholder="Stage name" />
                <input name="desc" className="p-2 border rounded" placeholder="Short description (optional)" />
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create Stage</button>
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
              </div>
            </form>
          )}

          {/* Stage list */}
          <div>
            {loading ? (
              <div className="text-sm text-gray-500">Loading stagesâ€¦</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : stages.length === 0 ? (
              <div className="text-sm text-gray-500">No stages found.</div>
            ) : (
              <div className="space-y-3">
                {stages.map((s) => {
                  const stageId = s.stageId ?? s.stage_id ?? s.id;
                  const subStages = s.stages ?? s.subStages ?? s.sub_stages ?? s.options ?? [];
                  return (
                    <div key={String(stageId)} className="border rounded p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">{s.name ?? `Stage ${stageId}`}</div>
                              {s.desc && <div className="text-xs text-gray-500 mt-1">{s.desc}</div>}
                              <div className="text-xs text-gray-400 mt-1">ID: {stageId}</div>
                            </div>
                            {selectMode && (
                              <input type="checkbox" checked={selectedIds.has(stageId)} onChange={() => toggleSelect(stageId)} className="ml-2" />
                            )}
                          </div>

                          {/* Sub-stages list */}
                          <div className="mt-3 space-y-2">
                            {Array.isArray(subStages) && subStages.length > 0 ? (
                              subStages.map((ss) => {
                                const subId = ss.subStageId ?? ss.sub_stage_id ?? ss.id ?? ss.sub_id ?? ss.subId ?? ss.name;
                                return (
                                  <div key={String(subId)} className="flex items-center justify-between gap-3 p-2 border rounded">
                                    <div>
                                      <div className="text-sm font-medium">{ss.name ?? `Sub ${subId}`}</div>
                                      {ss.desc && <div className="text-xs text-gray-500">{ss.desc}</div>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setEditSubstage({ stageId: stageId, subStageId: subId, name: ss.name ?? "", desc: ss.desc ?? "" })}
                                        className="px-3 py-1 rounded bg-indigo-50 text-sm"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => deleteSubstage(stageId, subId)}
                                        className="px-3 py-1 rounded bg-red-50 text-red-600 text-sm"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-xs text-gray-500">No sub-stages</div>
                            )}
                          </div>

                          {/* add substage toggle */}
                          <div className="mt-3">
                            {showSubstageFormFor === stageId ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const fd = new FormData(e.target);
                                  const payload = {
                                    name: (fd.get("sname") || "").toString().trim(),
                                    desc: (fd.get("sdesc") || "").toString().trim() || undefined,
                                    deleted: false,
                                    position: fd.get("position") ? Number(fd.get("position")) : undefined,
                                  };
                                  submitAddSubstage(e, stageId, payload);
                                }}
                                className="bg-gray-50 p-2 rounded"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  <input name="sname" placeholder="Substage name" className="p-2 border rounded" />
                                  <input name="sdesc" placeholder="Description (optional)" className="p-2 border rounded" />
                                  <input name="position" placeholder="Position (0..n)" className="p-2 border rounded" />
                                </div>
                                <div className="mt-2 flex gap-2">
                                  <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Add</button>
                                  <button type="button" onClick={() => setShowSubstageFormFor(null)} className="px-3 py-1 bg-gray-100 rounded text-sm">Cancel</button>
                                </div>
                              </form>
                            ) : (
                              <button onClick={() => setShowSubstageFormFor(stageId)} className="px-3 py-1 rounded bg-green-50 text-sm mt-2">+ Add Sub-stage</button>
                            )}
                          </div>
                        </div>

                        {/* actions for top-level stage */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setEditStage({ stageId: stageId, name: s.name ?? "", desc: s.desc ?? "" })}
                            className="px-3 py-1 rounded bg-indigo-50 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteStage(stageId)}
                            className="px-3 py-1 rounded bg-red-50 text-red-600 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Editing top-level stage modal area */}
          {editStage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Edit Stage</h4>
                  <button onClick={() => setEditStage(null)} className="text-gray-500">âœ•</button>
                </div>
                <form onSubmit={submitStageUpdate} className="space-y-2">
                  <input className="w-full p-2 border rounded" value={editStage.name} onChange={(e) => setEditStage(prev => ({ ...prev, name: e.target.value }))} />
                  <input className="w-full p-2 border rounded" value={editStage.desc} onChange={(e) => setEditStage(prev => ({ ...prev, desc: e.target.value }))} />
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                    <button type="button" onClick={() => setEditStage(null)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit substage modal */}
          {editSubstage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Edit Sub-stage</h4>
                  <button onClick={() => setEditSubstage(null)} className="text-gray-500">âœ•</button>
                </div>
                <form onSubmit={submitEditSubstage} className="space-y-2">
                  <input className="w-full p-2 border rounded" value={editSubstage.name} onChange={(e) => setEditSubstage(prev => ({ ...prev, name: e.target.value }))} />
                  <input className="w-full p-2 border rounded" value={editSubstage.desc} onChange={(e) => setEditSubstage(prev => ({ ...prev, desc: e.target.value }))} />
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                    <button type="button" onClick={() => setEditSubstage(null)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
