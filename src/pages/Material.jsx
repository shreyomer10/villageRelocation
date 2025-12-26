import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api";
import { AuthContext } from "../context/AuthContext";

/**
 * MaterialsPage.jsx (updated)
 * - clicking a card will store the selected material id in AuthContext (preferred)
 *   or localStorage (fallback) and navigate to /material/one/:materialId
 * - edit/delete button clicks stop propagation so they don't trigger card navigation
 * - key-accessible: Enter / Space on focused card will also navigate
 *
 * Fixes to updating material issue:
 * - When editing, the PUT payload now sends a clear, consistent set of fields (name and desc)
 *   so the backend receives the expected shapes and doesn't raise validation errors.
 * - The code derives the correct materialId key from multiple possible fields before calling the API.
 * - Small defensive improvements around JSON parsing and merging updated item into state.
 */

function EditIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 21v-3.75L14.06 6.19l3.75 3.75L6.75 21H3z" />
      <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15 3.25l3.75 3.75 1.96-.01z" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function MaterialsPage() {
  const navigate = useNavigate();
  const authCtx = useContext(AuthContext);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  // page-level error (visible on the main page as a banner)
  const [pageError, setPageError] = useState(null);
  // form-level error (visible inside the add/edit modal)
  const [formError, setFormError] = useState(null);

  // modal + form
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null); // full object when editing
  const [form, setForm] = useState({ name: "", desc: "" });
  const [submitLoading, setSubmitLoading] = useState(false);

  // delete confirmation modal
  const [toDelete, setToDelete] = useState(null); // material object to delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  // search
  const [query, setQuery] = useState("");

  function authHeaders() {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // ---------------- FETCH ----------------
  async function fetchMaterials() {
    setLoading(true);
    setPageError(null);
    try {
      const res = await fetch(`${API_BASE}/materials`, {
        headers: authHeaders(),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok) {
        const msg = (data && data.message) || `Failed to fetch materials: ${res.status}`;
        throw new Error(msg);
      }
      if (data && data.error) {
        throw new Error(data.message || "Server error");
      }

      // Support multiple response shapes
      let items = [];
      if (data && data.result && Array.isArray(data.result.items)) {
        items = data.result.items;
      } else if (data && Array.isArray(data.result)) {
        items = data.result;
      } else if (data && Array.isArray(data.items)) {
        items = data.items;
      } else if (data && data.result && data.result.item && Array.isArray(data.result.item)) {
        items = data.result.item;
      } else if (data && Array.isArray(data)) {
        items = data;
      }

      setMaterials(items || []);
    } catch (err) {
      console.error("fetchMaterials:", err);
      setPageError(err.message || "Failed to fetch materials");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- HELPERS ----------------
  function resetForm() {
    setForm({ name: "", desc: "" });
    setEditingMaterial(null);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(material) {
    setEditingMaterial(material);
    setForm({ name: material.name || "", desc: material.desc || "" });
    setFormError(null);
    setShowForm(true);
  }

  // Save selected material id to AuthContext if available, otherwise fallback to localStorage
  function saveSelectedMaterialId(id) {
    if (id === undefined || id === null) return;
    const idStr = String(id);
    try {
      if (authCtx && typeof authCtx.setSelectedMaterial === "function") {
        try {
          authCtx.setSelectedMaterial({ materialId: idStr });
        } catch {
          authCtx.setSelectedMaterial(idStr);
        }
        return;
      }

      if (authCtx && typeof authCtx.setMaterialId === "function") {
        authCtx.setMaterialId(idStr);
        return;
      }

      if (authCtx && typeof authCtx.selectMaterial === "function") {
        try {
          authCtx.selectMaterial({ materialId: idStr });
        } catch {
          authCtx.selectMaterial({ id: idStr });
        }
        return;
      }

      try {
        localStorage.setItem("materialId", idStr);
        localStorage.setItem("selectedMaterial", JSON.stringify({ materialId: idStr }));
      } catch (e) {
        try {
          localStorage.setItem("MATERIAL_ID", idStr);
          localStorage.setItem("SELECTED_MATERIAL", JSON.stringify({ materialId: idStr }));
        } catch {}
      }
    } catch (e) {
      console.warn("Failed to save selected material to AuthContext, falling back to localStorage", e);
      try {
        localStorage.setItem("materialId", idStr);
        localStorage.setItem("selectedMaterial", JSON.stringify({ materialId: idStr }));
      } catch {}
    }
  }

  // handle navigation when a card is clicked
  function handleCardClick(material) {
    const id = material?.materialId ?? material?.id ?? material?._id ?? material?.material_id;
    if (id === undefined || id === null) {
      setPageError("This material has no id and cannot be opened.");
      return;
    }

    saveSelectedMaterialId(id);
    navigate(`/material/one/${encodeURIComponent(String(id))}`);
  }

  function handleCardKeyDown(e, material) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(material);
    }
  }

  // ---------------- CREATE / UPDATE ----------------
  async function handleSubmit(e) {
    e.preventDefault();
    setPageError(null);
    setFormError(null);

    const nameTrim = (form.name || "").trim();
    const descRaw = form.desc ?? "";
    const descTrim = String(descRaw).trim();

    const isEdit = Boolean(editingMaterial);
    if (!isEdit && !nameTrim) {
      setFormError("Name is required");
      return;
    }

    // Build payload.
    // NOTE: For PUT (update) we send a consistent shape: include name and desc fields so the backend
    // receives predictable payloads and Pydantic validation won't fail due to missing keys.
    const payload = {};

    if (!isEdit) {
      // create requires a name; only include desc if provided (allow empty string on create if user typed it)
      payload.name = nameTrim;
      if (descTrim !== "") payload.desc = descTrim;
    } else {
      // For update: derive the canonical id and send both fields (name + desc). This avoids intermittent
      // validation errors on backends that expect at least a name field or consistent types.
      // If the user intentionally cleared desc, we include an empty string so backend can treat it as "clear".
      const originalName = (editingMaterial?.name ?? "").toString();
      // ensure name is never accidentally blank on edit (input has required attribute)
      payload.name = nameTrim !== "" ? nameTrim : originalName;
      // include desc always for updates (could be empty string if user cleared it)
      payload.desc = descTrim;
    }

    const materialIdForUrl =
      editingMaterial?.materialId ?? editingMaterial?.id ?? editingMaterial?._id ?? editingMaterial?.material_id;

    if (isEdit && !materialIdForUrl) {
      setFormError("Cannot update: material id is missing on the item.");
      return;
    }

    const url = isEdit ? `${API_BASE}/materials/${encodeURIComponent(String(materialIdForUrl))}` : `${API_BASE}/materials`;
    const method = isEdit ? "PUT" : "POST";

    setSubmitLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok) {
        let msg = `Save failed: ${res.status}`;
        if (data) {
          if (data.message) msg = data.message;
          else if (data.errors) {
            try {
              msg = Array.isArray(data.errors)
                ? data.errors
                    .map((err) =>
                      `${err.get && typeof err.get === 'function' ? err.get('loc') : err.loc ? err.loc.join('.') : ''}: ${err.msg || JSON.stringify(err)}`
                    )
                    .join('; ')
                : JSON.stringify(data.errors);
            } catch (e) {
              msg = JSON.stringify(data.errors);
            }
          } else {
            msg = JSON.stringify(data);
          }
        }
        throw new Error(msg);
      }
      if (data && data.error) {
        const backendMsg = data.message || JSON.stringify(data);
        throw new Error(backendMsg);
      }

      if (!isEdit) {
        // Prefer newly created item from backend (various shapes)
        const created = data?.result ?? data ?? null;
        if (created && (created.materialId || created.id || created._id)) {
          setMaterials((prev) => [created, ...prev]);
        } else {
          await fetchMaterials();
        }
      } else {
        const updatedFields = data?.result ?? data ?? null;
        if (updatedFields && Object.keys(updatedFields).length > 0) {
          setMaterials((prev) =>
            prev.map((m) =>
              String(m.materialId ?? m.id ?? m._id) === String(materialIdForUrl)
                ? { ...m, ...updatedFields }
                : m
            )
          );
        } else {
          // if backend didn't return changed fields, re-fetch to be safe
          await fetchMaterials();
        }
      }

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error("handleSubmit:", err);
      const msg = err.message || "Save failed";
      setFormError(msg);
      setPageError(msg);
    } finally {
      setSubmitLoading(false);
    }
  }

  // ---------------- DELETE (modal) ----------------
  function confirmDelete(material) {
    setToDelete(material);
    setPageError(null);
  }

  async function handleDeleteConfirmed() {
    if (!toDelete) return;
    setDeleteLoading(true);
    setPageError(null);
    try {
      const id = toDelete?.materialId ?? toDelete?.id ?? toDelete?._id ?? toDelete?.material_id;
      const res = await fetch(`${API_BASE}/materials/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok) {
        const msg = (data && data.message) || `Delete failed: ${res.status}`;
        throw new Error(msg);
      }
      if (data && data.error) {
        throw new Error(data.message || "Server error");
      }

      setMaterials((prev) => prev.filter((m) => String(m.materialId ?? m.id ?? m._id) !== String(id)));
      setToDelete(null);
    } catch (err) {
      console.error("handleDeleteConfirmed:", err);
      setPageError(err.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  function cancelDelete() {
    setToDelete(null);
  }

  // ---------------- SEARCH FILTER ----------------
  const filtered = materials.filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (String(m.name || "") || "").toLowerCase().includes(q) ||
      (String(m.desc || "") || "").toLowerCase().includes(q) ||
      (String(m.materialId || m.id || "") || "").toLowerCase().includes(q)
    );
  });

  // ---------------- RENDER ----------------
  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {pageError && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{pageError}</div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="px-3 py-2 border rounded-md bg-white text-sm shadow-sm hover:shadow"
            >
              ← Back
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Materials</h1>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by id, name or description"
              className="p-2 border rounded w-full sm:w-64"
            />
            <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
              + Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading materials…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-500">No materials found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <div
                key={String(m.materialId ?? m.id ?? m._id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => handleCardKeyDown(e, m)}
                onClick={() => handleCardClick(m)}
                className="relative bg-blue-100 rounded-2xl shadow p-4 hover:shadow-lg transition-shadow cursor-pointer"
                aria-label={`Open material ${m.name || m.materialId}`}
              >
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(m);
                    }}
                    className="p-1 rounded-md hover:bg-gray-100"
                    aria-label={`Edit material ${m.name}`}
                    title="Edit"
                    type="button"
                  >
                    <EditIcon className="w-4 h-4 text-indigo-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(m);
                    }}
                    className="p-1 rounded-md hover:bg-gray-100"
                    aria-label={`Delete material ${m.name}`}
                    title="Delete"
                    type="button"
                  >
                    <TrashIcon className="w-4 h-4 text-red-600" />
                  </button>
                </div>

                <div className="mt-1">
                  <div className="text-lg font-semibold text-gray-900 truncate">{m.name || "-"}</div>
                  <div className="text-sm text-gray-700">{m.desc || "-"}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-24" />
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <form onSubmit={handleSubmit} className="bg-[#f8f0dc] rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingMaterial ? "Edit Material" : "Add Material"}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-500"
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700">Description</label>
                <textarea
                  value={form.desc}
                  onChange={(e) => setForm((p) => ({ ...p, desc: e.target.value }))}
                  rows={3}
                  className="w-full p-2 border rounded"
                />
              </div>

              {formError && <div className="text-sm text-red-600">{formError}</div>}

              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className={`px-4 py-2 text-white rounded ${submitLoading ? "bg-gray-400" : "bg-blue-600"}`}
                >
                  {submitLoading ? (editingMaterial ? "Saving…" : "Creating…") : editingMaterial ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {toDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-lg max-w-lg">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Delete material</h3>
                <p className="text-m text-gray-600 mt-1">
                  Are you sure you want to delete <strong>{toDelete.name || `ID ${toDelete.materialId}`}</strong>?
                </p>

                {pageError && <div className="text-sm text-red-600 mt-2">{pageError}</div>}

                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 border rounded"
                    type="button"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirmed}
                    className={`px-4 py-2 text-white rounded ${deleteLoading ? "bg-gray-400" : "bg-red-600"}`}
                    type="button"
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
