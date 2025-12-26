import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api";
import { AuthContext } from "../context/AuthContext";

/*
 FacilitiesPage.jsx
 - Mirrors MaterialsPage behavior but for /facilities
 - Click a card to save selected facility in AuthContext (or localStorage) and navigate to /facility/one/:facilityId
 - Supports add/edit/delete, keyboard access, search
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

export default function FacilitiesPage() {
  const navigate = useNavigate();
  const authCtx = useContext(AuthContext);

  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [form, setForm] = useState({ name: "", villageId: "", desc: "" });
  const [submitLoading, setSubmitLoading] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState(null);

  function authHeaders() {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // ---------------- FETCH ----------------
  async function fetchFacilities() {
    setLoading(true);
    setPageError(null);
    try {
      const res = await fetch(`${API_BASE}/facilities`, { headers: authHeaders() });
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok) {
        const msg = (data && data.message) || `Failed to fetch facilities: ${res.status}`;
        throw new Error(msg);
      }
      if (data && data.error) {
        throw new Error(data.message || "Server error");
      }

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

      setFacilities(items || []);
    } catch (err) {
      console.error("fetchFacilities:", err);
      setPageError(err.message || "Failed to fetch facilities");
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFacilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- HELPERS ----------------
  function resetForm() {
    setForm({ name: "", villageId: "", desc: "" });
    setEditingFacility(null);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(facility) {
    setEditingFacility(facility);
    setForm({ name: facility.name || "", villageId: facility.villageId || "", desc: facility.desc || "" });
    setFormError(null);
    setShowForm(true);
  }

  function saveSelectedFacilityId(id) {
    if (id === undefined || id === null) return;
    const idStr = String(id);
    try {
      if (authCtx && typeof authCtx.setSelectedFacility === "function") {
        try {
          authCtx.setSelectedFacility({ facilityId: idStr });
        } catch {
          authCtx.setSelectedFacility(idStr);
        }
        return;
      }

      if (authCtx && typeof authCtx.setFacilityId === "function") {
        authCtx.setFacilityId(idStr);
        return;
      }

      if (authCtx && typeof authCtx.selectFacility === "function") {
        try {
          authCtx.selectFacility({ facilityId: idStr });
        } catch {
          authCtx.selectFacility({ id: idStr });
        }
        return;
      }

      localStorage.setItem("facilityId", idStr);
      localStorage.setItem("selectedFacility", JSON.stringify({ facilityId: idStr }));
    } catch (e) {
      console.warn("Failed to save selected facility to AuthContext, falling back to localStorage", e);
      try {
        localStorage.setItem("facilityId", idStr);
        localStorage.setItem("selectedFacility", JSON.stringify({ facilityId: idStr }));
      } catch {}
    }
  }

  function handleCardClick(facility) {
    const id = facility?.facilityId ?? facility?.id ?? facility?._id ?? facility?.facility_id;
    if (id === undefined || id === null) {
      setPageError("This facility has no id and cannot be opened.");
      return;
    }

    saveSelectedFacilityId(id);
    navigate(`/facility/one/${encodeURIComponent(String(id))}`);
  }

  function handleCardKeyDown(e, facility) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(facility);
    }
  }

  // ---------------- CREATE / UPDATE ----------------
  async function handleSubmit(e) {
    e.preventDefault();
    setPageError(null);
    setFormError(null);

    const nameTrim = (form.name || "").trim();
    const villageTrim = (form.villageId || "").trim();
    const descTrim = String(form.desc || "").trim();

    const isEdit = Boolean(editingFacility);
    if (!isEdit && !nameTrim) {
      setFormError("Name is required");
      return;
    }

    const payload = {};
    const originalName = (editingFacility?.name ?? "").toString();
    if (!isEdit) {
      payload.name = nameTrim;
    } else {
      if (nameTrim !== originalName.trim()) {
        payload.name = nameTrim;
      }
    }

    const originalVillage = (editingFacility?.villageId ?? "").toString();
    if (!isEdit) {
      if (villageTrim !== "") payload.villageId = villageTrim;
    } else {
      if (villageTrim !== originalVillage.trim()) {
        if (villageTrim === "" && originalVillage.trim() !== "") {
          payload.villageId = "";
        } else if (villageTrim !== "") {
          payload.villageId = villageTrim;
        }
      }
    }

    const originalDesc = (editingFacility?.desc ?? "").toString();
    if (!isEdit) {
      if (descTrim !== "") payload.desc = descTrim;
    } else {
      if (descTrim !== originalDesc.trim()) {
        if (descTrim === "" && originalDesc.trim() !== "") {
          payload.desc = "";
        } else if (descTrim !== "") {
          payload.desc = descTrim;
        }
      }
    }

    if (isEdit && Object.keys(payload).length === 0) {
      setFormError("No changes to update");
      return;
    }

    const url = isEdit
      ? `${API_BASE}/facilities/${encodeURIComponent(editingFacility.facilityId)}`
      : `${API_BASE}/facilities`;
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
          else if (data.errors) msg = JSON.stringify(data.errors);
          else msg = JSON.stringify(data);
        }
        throw new Error(msg);
      }
      if (data && data.error) {
        const backendMsg = data.message || JSON.stringify(data);
        throw new Error(backendMsg);
      }

      if (!isEdit) {
        const created = data?.result ?? null;
        if (created && (created.facilityId || created.facilityId === 0)) {
          setFacilities((prev) => [created, ...prev]);
        } else {
          await fetchFacilities();
        }
      } else {
        const updatedFields = data?.result ?? null;
        if (updatedFields && Object.keys(updatedFields).length > 0) {
          setFacilities((prev) =>
            prev.map((f) => (String(f.facilityId) === String(editingFacility.facilityId) ? { ...f, ...updatedFields } : f))
          );
        } else {
          await fetchFacilities();
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

  // ---------------- DELETE ----------------
  function confirmDelete(facility) {
    setToDelete(facility);
    setPageError(null);
  }

  async function handleDeleteConfirmed() {
    if (!toDelete) return;
    setDeleteLoading(true);
    setPageError(null);
    try {
      const res = await fetch(`${API_BASE}/facilities/${encodeURIComponent(toDelete.facilityId)}`, {
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

      setFacilities((prev) => prev.filter((f) => String(f.facilityId) !== String(toDelete.facilityId)));
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
  const filtered = facilities.filter((f) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (String(f.name || "") || "").toLowerCase().includes(q) ||
      (String(f.desc || "") || "").toLowerCase().includes(q) ||
      (String(f.facilityId || "") || "").toLowerCase().includes(q) ||
      (String(f.villageId || "") || "").toLowerCase().includes(q)
    );
  });

  // ---------------- RENDER ----------------
  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {pageError && <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700">{pageError}</div>}

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
            <h1 className="text-2xl font-semibold">Facilities</h1>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by id, name, village or description"
              className="p-2 border rounded w-full sm:w-64"
            />
            <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
              + Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading facilities…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-500">No facilities found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f) => (
              <div
                key={String(f.facilityId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => handleCardKeyDown(e, f)}
                onClick={() => handleCardClick(f)}
                className="relative bg-blue-100 rounded-2xl shadow p-4 hover:shadow-lg transition-shadow cursor-pointer"
                aria-label={`Open facility ${f.name || f.facilityId}`}
              >
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(f);
                    }}
                    className="p-1 rounded-md hover:bg-gray-100"
                    aria-label={`Edit facility ${f.name}`}
                    title="Edit"
                    type="button"
                  >
                    <EditIcon className="w-4 h-4 text-indigo-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(f);
                    }}
                    className="p-1 rounded-md hover:bg-gray-100"
                    aria-label={`Delete facility ${f.name}`}
                    title="Delete"
                    type="button"
                  >
                    <TrashIcon className="w-4 h-4 text-red-600" />
                  </button>
                </div>

                <div className="mt-1">
                  <div className="text-lg font-semibold text-gray-900 truncate">{f.name || "-"}</div>
                  {f.villageId && <div className="text-xs text-gray-500">Village: {f.villageId}</div>}
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
              <h3 className="text-lg font-semibold">{editingFacility ? "Edit Facility" : "Add Facility"}</h3>
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
                <label className="block text-sm text-gray-700">Village ID</label>
                <input
                  value={form.villageId}
                  onChange={(e) => setForm((p) => ({ ...p, villageId: e.target.value }))}
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
                  {submitLoading ? (editingFacility ? "Saving…" : "Creating…") : editingFacility ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {toDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-lg max-w-lg">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Delete facility</h3>
                <p className="text-m text-gray-600 mt-1">
                  Are you sure you want to delete <strong>{toDelete.name || `ID ${toDelete.facilityId}`}</strong>?
                </p>

                {pageError && <div className="text-sm text-red-600 mt-2">{pageError}</div>}

                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={cancelDelete} className="px-4 py-2 border rounded" type="button" disabled={deleteLoading}>
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
