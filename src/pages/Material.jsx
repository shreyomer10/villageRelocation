// src/pages/MaterialsPage.jsx
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
 * Materials page
 * - GET /materials
 * - POST /materials
 * - PUT /materials/:materialId
 * - DELETE /materials/:materialId
 */

export default function MaterialsPage() {
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
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");

  // modal (create / edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [editing, setEditing] = useState(false); // false => create, true => edit
  const [form, setForm] = useState({
    materialId: "",
    name: "",
    unit: "",
    price: "",
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
      // optional: clear stored token if you want
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("accessToken");
      } catch {}
      navigate("/login");
      throw new Error("Unauthorized - please login");
    }

    // If no JSON (or not ok) attempt to construct helpful error
    if (!res.ok) {
      // try to parse JSON to extract message
      try {
        const payload = safeParseJson(text, res);
        // backend uses { error: true, message: "..." }
        if (payload && payload.message) {
          throw new Error(payload.message);
        }
      } catch (e) {
        // fallback to raw snippet
        const snippet = (text || "").slice(0, 400);
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${snippet}`);
      }
    }

    // parse JSON body
    const payload = safeParseJson(text, res);

    // backend may return error flag inside 200 - handle that
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
        const payload = await apiFetch("/materials", { method: "GET", signal: ctrl.signal });
        const list = extractListFromPayload(payload);
        if (!mounted) return;
        setMaterials(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!mounted) return;
        // If backend returned 404 via make_response (no materials) it might have status 404 handled earlier
        setError(err.message || "Failed to fetch materials");
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
    if (!search) return materials.slice();
    const q = search.toLowerCase();
    return materials.filter((m) => {
      return (
        String(m.materialId ?? "").toLowerCase().includes(q) ||
        String(m.name ?? "").toLowerCase().includes(q) ||
        String(m.unit ?? "").toLowerCase().includes(q) ||
        String(m.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [materials, search]);

  // modal helpers
  function openCreateModal() {
    setEditing(false);
    setForm({ materialId: "", name: "", unit: "", price: "", description: "" });
    setModalError(null);
    setModalOpen(true);
  }

  function openEditModal(material) {
    setEditing(true);
    setForm({
      materialId: material.materialId ?? "",
      name: material.name ?? "",
      unit: material.unit ?? "",
      // keep price as string for controlled input
      price: material.price !== undefined && material.price !== null ? String(material.price) : "",
      description: material.description ?? "",
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
  async function createMaterial() {
    if (!form.name || !form.unit) {
      setModalError("Please provide name and unit.");
      return;
    }

    if (form.price && isNaN(Number(form.price))) {
      setModalError("Price must be a number.");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const payload = {
        name: form.name,
        unit: form.unit,
        price: form.price ? Number(form.price) : undefined,
        description: form.description || undefined,
      };

      const payloadRes = await apiFetch("/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // backend returns { result: <createdDoc> } in your Flask code
      const created = payloadRes?.result ?? payloadRes ?? null;

      if (created && created.materialId) {
        setMaterials((prev) => [created, ...prev]);
      } else {
        // fallback full refresh
        await reloadMaterials();
      }

      closeModal();
    } catch (err) {
      setModalError(err.message || "Failed to create material");
    } finally {
      setModalLoading(false);
    }
  }

  // update
  async function updateMaterial() {
    if (!form.materialId) {
      setModalError("Missing materialId for update");
      return;
    }
    if (!form.name || !form.unit) {
      setModalError("Please provide name and unit.");
      return;
    }
    if (form.price && isNaN(Number(form.price))) {
      setModalError("Price must be a number.");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const payload = {
        name: form.name,
        unit: form.unit,
        price: form.price ? Number(form.price) : undefined,
        description: form.description || undefined,
      };

      const path = `/materials/${encodeURIComponent(String(form.materialId))}`;
      const payloadRes = await apiFetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const updated = payloadRes?.result ?? payloadRes ?? payload;
      // ensure materialId stays present in the merged object (backend returns only updated fields)
      const updatedWithId = { ...updated, materialId: form.materialId };

      // optimistic update: merge into materials array
      setMaterials((prev) =>
        prev.map((m) => (String(m.materialId) === String(form.materialId) ? { ...m, ...updatedWithId } : m))
      );

      closeModal();
    } catch (err) {
      setModalError(err.message || "Failed to update material");
    } finally {
      setModalLoading(false);
    }
  }

  // delete
  async function deleteMaterial(materialId) {
    const ok = window.confirm(`Delete material ${materialId}? This action cannot be undone.`);
    if (!ok) return;

    try {
      const path = `/materials/${encodeURIComponent(String(materialId))}`;
      await apiFetch(path, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      // remove locally
      setMaterials((prev) => prev.filter((m) => String(m.materialId) !== String(materialId)));
    } catch (err) {
      alert(err.message || "Failed to delete material");
    }
  }

  // reload helper
  async function reloadMaterials() {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch("/materials", { method: "GET" });
      const list = extractListFromPayload(payload);
      setMaterials(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || "Failed to reload materials");
    } finally {
      setLoading(false);
    }
  }

  // small Material card
  function MaterialCard({ m }) {
    return (
      <div className="w-full bg-white rounded-2xl p-4 shadow-md border mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-800">{m.name ?? "—"}</div>
                <div className="text-sm text-gray-500 mt-1">{m.description ?? "-"}</div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(m)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-blue-100"
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    onClick={() => deleteMaterial(m.materialId)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-red-50 text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="text-xs text-gray-400 mt-1">
                  {m.unit ?? "-"} · {m.price !== undefined ? String(m.price) : "-"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {/* optional preview link if there is an attached doc */}
              {Array.isArray(m.docs) && m.docs.length > 0 && (
                <a href={m.docs[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50">
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
                  <div className="text-xs text-gray-500">{editing ? "Edit material" : "New material"}</div>
                  <div className="text-lg font-semibold">{editing ? form.materialId : "Create material"}</div>
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
                    placeholder="e.g. Bricks"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Unit</label>
                    <input
                      value={form.unit}
                      onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      placeholder="e.g. Nos / Kg"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Price</label>
                    <input
                      value={form.price}
                      onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      placeholder="numeric (optional)"
                    />
                  </div>
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
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 rounded-md bg-white border hover:bg-gray-50"
                    disabled={modalLoading}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={editing ? updateMaterial : createMaterial}
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
      <MainNavbar showVillageInNavbar={true}/>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/home`)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50">
              <ArrowLeft size={16} /> Back
            </button>

            <div>
              <h1 className="text-2xl font-bold">Materials</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 border rounded-lg px-3 py-2 bg-white">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search id / name / unit / description"
                className="bg-transparent outline-none text-sm w-64"
              />
              <button onClick={() => setSearch("")} className="text-sm px-3 py-1 rounded-md bg-gray-50">Clear</button>
            </div>

            <button onClick={openCreateModal} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
              <PlusCircle size={16} /> New Material
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
            <div className="text-sm text-gray-500">No materials found.</div>
          ) : (
            <div>
              {filtered.map((m) => (
                <MaterialCard key={m.materialId ?? `${m.name}_${m.unit}`} m={m} />
              ))}
            </div>
          )}
        </section>

        <Modal />
      </main>
    </div>
  );
}
