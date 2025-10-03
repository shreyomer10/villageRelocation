// File: src/component/CommunityModal.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * CommunityModal
 * - villageId (string) required
 * - onClose() required
 *
 * Supports:
 *  - GET /buildings/<villageId>
 *  - POST /buildings/insert
 *  - PUT /buildings/<buildingId>/<villageId>
 *  - DELETE /buildings/<buildingId>/<villageId>
 *
 * Notes:
 * API base: https://villagerelocation.onrender.com
 * Docs mentioned "ignore api/v1", so endpoints omit /api/v1 here.
 */
export default function CommunityModal({ villageId, onClose }) {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState(null); // building object when editing

  const [form, setForm] = useState({
    name: "",
    stagesText: "", // comma separated stage names (optional)
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => (mountedRef.current = false);
  }, []);

  async function fetchBuildings(signal) {
    if (!villageId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `https://villagerelocation.onrender.com/buildings/${encodeURIComponent(villageId)}`,
        { method: "GET", headers, signal }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to load buildings: ${res.status} ${txt}`);
      }
      const payload = await res.json();
      if (!mountedRef.current) return;
      // payload may be { result: { items: [...] } } or { result: [...] }
      let items = [];
      if (payload?.result?.items) items = payload.result.items;
      else if (Array.isArray(payload.result)) items = payload.result;
      else if (Array.isArray(payload)) items = payload;
      else items = [];

      setBuildings(items);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchBuildings(ctrl.signal);
    return () => ctrl.abort();
  }, [villageId]);

  function resetForm() {
    setForm({ name: "", stagesText: "" });
    setEditing(null);
    setShowAddForm(false);
  }

  // create building
  async function handleCreate(e) {
    e.preventDefault();
    if (!villageId) {
      alert("Missing villageId");
      return;
    }
    if (!form.name || form.name.trim() === "") {
      alert("Please provide a name for the building");
      return;
    }
    const stages = form.stagesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    const payload = {
      name: form.name.trim(),
      villageId,
      stages: stages.length > 0 ? stages : undefined,
    };

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `https://villagerelocation.onrender.com/buildings/insert`,
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
        throw new Error(`Create failed: ${res.status} ${txt}`);
      }
      // refresh list
      const ctrl = new AbortController();
      await fetchBuildings(ctrl.signal);
      resetForm();
    } catch (err) {
      alert(err.message || "Failed to create building");
    }
  }

  // prepare edit
  function startEdit(b) {
    setEditing(b);
    setForm({
      name: b.name ?? "",
      stagesText:
        Array.isArray(b.stages) && b.stages.length > 0
          ? b.stages.map((s) => s.name ?? s).join(", ")
          : "",
    });
    setShowAddForm(true);
  }

  // update building (top-level fields only)
  async function handleUpdate(e) {
    e.preventDefault();
    if (!editing) return;
    const bId = editing.typeId ?? editing.type_id ?? editing.typeId ?? editing.id ?? editing._id;
    if (!bId) {
      alert("Missing building id for update");
      return;
    }
    const token = localStorage.getItem("token");
    const updatePayload = {
      name: form.name?.trim() || undefined,
      // stages cannot be updated via this endpoint (per API). So we only send top-level fields.
    };

    // remove undefined keys
    Object.keys(updatePayload).forEach((k) => {
      if (updatePayload[k] === undefined) delete updatePayload[k];
    });

    if (Object.keys(updatePayload).length === 0) {
      alert("No fields to update");
      return;
    }

    try {
      const res = await fetch(
        `https://villagerelocation.onrender.com/buildings/${encodeURIComponent(bId)}/${encodeURIComponent(villageId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(updatePayload),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Update failed: ${res.status} ${txt}`);
      }
      // refresh
      const ctrl = new AbortController();
      await fetchBuildings(ctrl.signal);
      resetForm();
    } catch (err) {
      alert(err.message || "Failed to update building");
    }
  }

  // delete building
  async function handleDelete(b) {
    if (!b) return;
    if (!confirm(`Delete building "${b.name ?? b.typeId ?? b.type_id ?? b.id}"? This is a soft-delete.`)) return;
    try {
      const bId = b.typeId ?? b.type_id ?? b.id ?? b.typeId ?? b._id;
      if (!bId) throw new Error("Missing building id");
      const token = localStorage.getItem("token");
      const res = await fetch(
        `https://villagerelocation.onrender.com/buildings/${encodeURIComponent(bId)}/${encodeURIComponent(villageId)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Delete failed: ${res.status} ${txt}`);
      }
      // refresh
      const ctrl = new AbortController();
      await fetchBuildings(ctrl.signal);
    } catch (err) {
      alert(err.message || "Failed to delete building");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg overflow-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Community Buildings â€” {villageId}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowAddForm((s) => !s);
                setEditing(null);
              }}
              className="px-3 py-1 rounded bg-green-100 hover:bg-green-200 text-sm"
            >
              Add
            </button>
            <button onClick={onClose} className="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-sm">
              Close
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {showAddForm && (
            <form onSubmit={editing ? handleUpdate : handleCreate} className="bg-gray-50 p-3 rounded">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="p-2 border rounded"
                  placeholder="Building name (e.g. Community Hall)"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  className="p-2 border rounded"
                  placeholder="Stages (comma separated names) â€” optional"
                  value={form.stagesText}
                  onChange={(e) => setForm((f) => ({ ...f, stagesText: e.target.value }))}
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
                  {editing ? "Save Changes" : "Create Building"}
                </button>
                <button type="button" onClick={() => { resetForm(); }} className="px-4 py-2 bg-gray-100 rounded">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div>
            {loading ? (
              <div className="text-sm text-gray-500">Loading buildingsâ€¦</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : buildings.length === 0 ? (
              <div className="text-sm text-gray-500">No buildings found for this village.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {buildings.map((b) => {
                  const id = b.typeId ?? b.type_id ?? b.id ?? b._id;
                  return (
                    <div key={id ?? Math.random()} className="border rounded p-3 flex gap-3 items-start">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{b.name ?? b.title ?? "Unnamed"}</div>
                            <div className="text-xs text-gray-500">{id}</div>
                          </div>

                          <div className="text-right text-sm text-gray-600">
                            <div>Stages: {Array.isArray(b.stages) ? b.stages.length : "â€”"}</div>
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-gray-700">
                          {b.description ?? b.desc ?? "No description provided."}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button onClick={() => startEdit(b)} className="px-3 py-1 text-sm rounded bg-gray-100">Edit</button>
                          <button onClick={() => handleDelete(b)} className="px-3 py-1 text-sm rounded bg-red-50 text-red-600">Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
