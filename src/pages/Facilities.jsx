// src/pages/FacilitiesPage.jsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/Api.js";
import {
  ArrowLeft,
  Search,
  PlusCircle,
  Edit2,
  Trash2,
  X,
  Save,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Facilities page
 * - GET /facilities
 * - POST /facilities
 * - PUT /facilities/:facilityId
 * - DELETE /facilities/:facilityId  (soft delete in backend)
 */

export default function FacilitiesPage() {
  const navigate = useNavigate();
  const auth = useContext(AuthContext) || {};
  const { selectedVillageId } = auth;

  const [localVillageId] = useState(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("villageId") : null;
    } catch {
      return null;
    }
  });
  const villageId = selectedVillageId ?? localVillageId;

  // attempt to read token from common places
  function getAuthToken() {
    if (auth?.token) return auth.token;
    if (auth?.authToken) return auth.authToken;
    if (auth?.user?.token) return auth.user.token;
    if (auth?.user?.accessToken) return auth.user.accessToken;
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        localStorage.getItem("accessToken") ||
        null
      );
    }
    return null;
  }
  const token = getAuthToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // state
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");

  // modal (create / edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [editing, setEditing] = useState(false); // false => create, true => edit
  const [form, setForm] = useState({
    facilityId: "",
    name: "",
    type: "",
    villageId: villageId || "",
    capacity: "",
    description: "",
  });

  // helper: safe parse
  function safeParseJson(text, res) {
    const ct = (res?.headers?.get?.("content-type") || "").toLowerCase();
    const trimmed = String(text || "").trim();

    if (!ct.includes("application/json") && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      const snippet = trimmed.slice(0, 400);
      throw new Error(`Expected JSON but got content-type="${ct}". Response starts with: ${snippet}`);
    }

    try {
      return JSON.parse(trimmed);
    } catch (err) {
      const snippet = trimmed.slice(0, 400);
      throw new Error(`Invalid JSON: ${err.message}. Response (first 400 chars): ${snippet}`);
    }
  }

  // small wrapper to unify API behavior
  async function apiFetch(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const headers = { Accept: "application/json", ...authHeaders, ...(opts.headers || {}) };
    const merged = { ...opts, headers };

    const res = await fetch(url, merged);
    const text = await res.text();

    // If unauthorized, redirect to login
    if (res.status === 401) {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("accessToken");
      } catch {}
      navigate("/login");
      throw new Error("Unauthorized - please login");
    }

    if (!res.ok) {
      try {
        const payload = safeParseJson(text, res);
        if (payload && payload.message) {
          throw new Error(payload.message);
        }
      } catch (e) {
        const snippet = (text || "").slice(0, 400);
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${snippet}`);
      }
    }

    const payload = safeParseJson(text, res);
    if (payload && payload.error) {
      throw new Error(payload.message || "API error");
    }

    return payload;
  }

  // normalized extractor (backend returns result.items etc.)
  function extractListFromPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload?.result?.items)) return payload.result.items;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    if (Array.isArray(payload?.result)) return payload.result;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    const possible = payload?.result?.items ?? payload?.result?.rows ?? payload?.items;
    return Array.isArray(possible) ? possible : [];
  }

  // initial load
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    async function load() {
      if (!mounted) return;
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch("/facilities", { method: "GET", signal: ctrl.signal });
        const list = extractListFromPayload(payload);
        if (!mounted) return;
        setFacilities(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Failed to fetch facilities");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // search filter
  const filtered = useMemo(() => {
    if (!search) return facilities.slice();
    const q = search.toLowerCase();
    return facilities.filter((f) => {
      return (
        String(f.facilityId ?? "").toLowerCase().includes(q) ||
        String(f.name ?? "").toLowerCase().includes(q) ||
        String(f.type ?? "").toLowerCase().includes(q) ||
        String(f.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [facilities, search]);

  // modal helpers
  function openCreateModal() {
    setEditing(false);
    setForm({ facilityId: "", name: "", type: "", villageId: villageId || "", capacity: "", description: "" });
    setModalError(null);
    setModalOpen(true);
  }

  function openEditModal(facility) {
    setEditing(true);
    setForm({
      facilityId: facility.facilityId ?? "",
      name: facility.name ?? "",
      type: facility.type ?? "",
      villageId: facility.villageId ?? villageId ?? "",
      capacity: facility.capacity !== undefined && facility.capacity !== null ? String(facility.capacity) : "",
      description: facility.description ?? "",
    });
    setModalError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalError(null);
    setModalLoading(false);
  }

  // create
  async function createFacility() {
    if (!form.name || !form.type || !(form.villageId || villageId)) {
      setModalError("Please provide name, type and villageId.");
      return;
    }

    if (form.capacity && isNaN(Number(form.capacity))) {
      setModalError("Capacity must be a number.");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const payload = {
        name: form.name,
        type: form.type,
        villageId: form.villageId || villageId,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        description: form.description || undefined,
      };

      const payloadRes = await apiFetch("/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const created = payloadRes?.result ?? payloadRes ?? null;
      if (created && created.facilityId) {
        setFacilities((prev) => [created, ...prev]);
      } else {
        await reloadFacilities();
      }

      closeModal();
    } catch (err) {
      setModalError(err.message || "Failed to create facility");
    } finally {
      setModalLoading(false);
    }
  }

  // update
  async function updateFacility() {
    if (!form.facilityId) {
      setModalError("Missing facilityId for update");
      return;
    }
    if (!form.name || !form.type) {
      setModalError("Please provide name and type.");
      return;
    }
    if (form.capacity && isNaN(Number(form.capacity))) {
      setModalError("Capacity must be a number.");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const payload = {
        name: form.name,
        type: form.type,
        villageId: form.villageId || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        description: form.description || undefined,
      };

      const path = `/facilities/${encodeURIComponent(String(form.facilityId))}`;
      const payloadRes = await apiFetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const updated = payloadRes?.result ?? payloadRes ?? payload;
      const updatedWithId = { ...updated, facilityId: form.facilityId };

      setFacilities((prev) => prev.map((f) => (String(f.facilityId) === String(form.facilityId) ? { ...f, ...updatedWithId } : f)));

      closeModal();
    } catch (err) {
      setModalError(err.message || "Failed to update facility");
    } finally {
      setModalLoading(false);
    }
  }

  // delete (soft delete in backend)
  async function deleteFacility(facilityId) {
    const ok = window.confirm(`Delete facility ${facilityId}? This action cannot be undone.`);
    if (!ok) return;

    try {
      const path = `/facilities/${encodeURIComponent(String(facilityId))}`;
      await apiFetch(path, { method: "DELETE" });

      setFacilities((prev) => prev.filter((f) => String(f.facilityId) !== String(facilityId)));
    } catch (err) {
      alert(err.message || "Failed to delete facility");
    }
  }

  // reload helper
  async function reloadFacilities() {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch("/facilities", { method: "GET" });
      const list = extractListFromPayload(payload);
      setFacilities(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || "Failed to reload facilities");
    } finally {
      setLoading(false);
    }
  }

  // small Facility card
  function FacilityCard({ f }) {
    return (
      <div className="w-full bg-white rounded-2xl p-4 shadow-md border mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-800">{f.name ?? "—"}</div>
                <div className="text-sm text-gray-500 mt-1">{f.description ?? "-"}</div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal(f)} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-blue-100">
                    <Edit2 size={14} />
                  </button>

                  <button onClick={() => deleteFacility(f.facilityId)} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-red-50 text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="text-xs text-gray-400 mt-1">
                  {f.type ?? "-"} · Capacity: {f.capacity !== undefined ? String(f.capacity) : "-"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {Array.isArray(f.docs) && f.docs.length > 0 && (
                <a href={f.docs[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50">
                  <FileText size={14} /> View
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Modal() {
    return (
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={closeModal}
          >
            <motion.div
              initial={{ y: 20, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="max-w-2xl w-full bg-[#f8f0dc] rounded-2xl shadow-2xl border overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <div className="text-xs text-gray-500">{editing ? "Edit facility" : "New facility"}</div>
                  <div className="text-lg font-semibold">{editing ? form.facilityId : "Create facility"}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={closeModal} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 gap-4">
                {modalError && <div className="text-sm text-red-600">{modalError}</div>}

                <div>
                  <label className="text-xs text-gray-500">Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                    placeholder="e.g. Community Hall"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Type</label>
                    <input
                      value={form.type}
                      onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      placeholder="e.g. School / Health / Hall"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Capacity</label>
                    <input
                      value={form.capacity}
                      onChange={(e) => setForm((s) => ({ ...s, capacity: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      placeholder="numeric (optional)"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Village ID</label>
                  <input
                    value={form.villageId}
                    onChange={(e) => setForm((s) => ({ ...s, villageId: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                    placeholder="villageId (auto-filled if available)"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button onClick={closeModal} className="px-4 py-2 rounded-md bg-white border hover:bg-gray-50" disabled={modalLoading}>
                    Cancel
                  </button>

                  <button
                    onClick={editing ? updateFacility : createFacility}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                    disabled={modalLoading}
                  >
                    <Save size={14} /> {modalLoading ? "Saving…" : editing ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/home`)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50">
              <ArrowLeft size={16} /> Back
            </button>

            
          </div>
          <div>
              <h1 className="text-2xl font-bold">Facilities</h1>
            </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-white">
              <Search size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search id / name / type / description" className="bg-transparent outline-none text-sm w-64" />
              <button onClick={() => setSearch("")} className="text-sm px-3 py-1 rounded-md bg-gray-50">Clear</button>
            </div>

            <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
              <PlusCircle size={16} /> New Facility
            </button>
          </div>
        </div>

        {/* list */}
        <section>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-500">No facilities found.</div>
          ) : (
            <div>
              {filtered.map((f) => (
                <FacilityCard key={f.facilityId ?? `${f.name}_${f.type}`} f={f} />
              ))}
            </div>
          )}
        </section>

        <Modal />
      </main>
    </div>
  );
}
