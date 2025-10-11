// src/pages/EmployeesPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Search, UploadCloud, PlusCircle, Trash2, Edit2,
  User, AtSign, Smartphone, X, ChevronDown
} from "lucide-react";
import { API_BASE } from "../config/Api.js";

/* ---------- config ---------- */
const ADD_ERROR_TIMEOUT_MS = 5000;       // auto-dismiss add-error box after this many ms
const LOAD_MAX_ATTEMPTS = 4;            // number of attempts to fetch /employee/all
const LOAD_INITIAL_DELAY_MS = 500;      // initial backoff delay in ms

/* ---------- role helpers ---------- */
const ROLE_DEFS = [
  { code: "admin", label: "Admin" },
  { code: "fg", label: "Forest Guard" },
  { code: "ra", label: "Range Assistant" },
  { code: "ro", label: "Range Officer" },
  { code: "ad", label: "Assistant Director" },
  { code: "dd", label: "Deputy Director" },
];
const CODE_TO_LABEL = Object.fromEntries(ROLE_DEFS.map((r) => [r.code, r.label]));
function getRoleCode(roleOrLabel) {
  if (!roleOrLabel) return "";
  const s = String(roleOrLabel).trim().toLowerCase();
  if (CODE_TO_LABEL[s]) return s;
  const found = ROLE_DEFS.find((r) => r.label.toLowerCase() === s);
  if (found) return found.code;
  return s;
}
function getRoleLabel(roleOrLabel) {
  const code = getRoleCode(roleOrLabel);
  return CODE_TO_LABEL[code] || String(roleOrLabel || "");
}

/* ---------- RolesPie component ---------- */
const ROLE_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a78bfa", "#c084fc", "#60a5fa"];

function RolesPie({ employees = [] }) {
  const data = useMemo(() => {
    const counts = {};
    employees.forEach((e) => {
      const key = getRoleCode(e.role || e.roleCode || "unknown") || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [employees]);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold">Employee Roles</h3>
        <div className="text-sm text-gray-500">Total: {employees.length}</div>
      </div>

      <div className="w-full flex justify-center mb-3" style={{ height: 160 }}>
        <div style={{ width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={68}
                innerRadius={36}
                paddingAngle={4}
                label={false}
                labelLine={false}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip wrapperStyle={{ zIndex: 999 }} formatter={(val, name) => [val, getRoleLabel(name)]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-1 border-t pt-3">
        <div className="grid grid-cols-1 gap-2">
          {data.length === 0 ? (
            <div className="text-sm text-gray-500">No role data available</div>
          ) : (
            data.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                  <div>
                    <div className="text-sm font-medium">{getRoleLabel(d.name)}</div>
                    <div className="text-xs text-gray-500">{d.value} user{d.value !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold">{d.value}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- EmployeeForm: styled, searchable dropdown with chips for villages ---------- */
function EmployeeForm({ initial = {}, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    name: initial.name || "",
    email: initial.email || "",
    mobile: initial.mobile || "",
    role: initial.role ? getRoleCode(initial.role) : "",
    villageIds: initial.villageID ? (Array.isArray(initial.villageID) ? initial.villageID : [initial.villageID]) : (initial.villageIds || []),
  });

  const [villages, setVillages] = useState([]);
  const [villLoading, setVillLoading] = useState(false);
  const [villError, setVillError] = useState(null);
  const [errors, setErrors] = useState({});

  // dropdown state
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    setForm({
      name: initial.name || "",
      email: initial.email || "",
      mobile: initial.mobile || "",
      role: initial.role ? getRoleCode(initial.role) : "",
      villageIds: initial.villageID ? (Array.isArray(initial.villageID) ? initial.villageID : [initial.villageID]) : (initial.villageIds || []),
    });
  }, [initial]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setVillLoading(true);
      setVillError(null);
      try {
        const res = await fetch(`${API_BASE}/villagesId`);
        if (!res.ok) throw new Error(`Failed to load villages (${res.status})`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.result || []);
        if (!mounted) return;
        setVillages(list);
      } catch (e) {
        if (!mounted) return;
        setVillError(e.message || "Could not load villages");
      } finally {
        if (mounted) setVillLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    function onDoc(e) {
      if (e.type === "keydown" && e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.type === "click") {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
      }
    }
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onDoc);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onDoc);
    };
  }, []);

  const update = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  function toggleVillage(id) {
    setForm((s) => {
      const setIds = new Set(s.villageIds || []);
      if (setIds.has(id)) setIds.delete(id);
      else setIds.add(id);
      return { ...s, villageIds: Array.from(setIds) };
    });
  }

  function removeChip(id) {
    setForm((s) => ({ ...s, villageIds: (s.villageIds || []).filter(x => x !== id) }));
  }

  function selectAllVisible(visibleIds) {
    setForm((s) => {
      const setIds = new Set(s.villageIds || []);
      visibleIds.forEach((id) => setIds.add(id));
      return { ...s, villageIds: Array.from(setIds) };
    });
  }
  function deselectAllVisible(visibleIds) {
    setForm((s) => {
      const setIds = new Set(s.villageIds || []);
      visibleIds.forEach((id) => setIds.delete(id));
      return { ...s, villageIds: Array.from(setIds) };
    });
  }

  function validate() {
    const e = {};
    if (!form.name || !form.name.trim()) e.name = "Name is required";
    if (!form.email || !form.email.trim()) e.email = "Email is required";
    if (!form.mobile || !form.mobile.trim()) e.mobile = "Mobile is required";
    if (!form.role || !String(form.role).trim()) e.role = "Please select a role";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // build visible villages from filter (map to {vid, vlabel})
  const visibleVillages = useMemo(() => {
    const q = String(filter || "").trim().toLowerCase();
    return villages
      .map((v, i) => {
        const vid = (v.villageID ?? v.villageId ?? v.id ?? v._id ?? v.code ?? v.village_code ?? String(v).trim()) || `v-${i}`;
        const vlabel = v.name ?? v.villageName ?? v.village ?? vid;
        return { vid, vlabel };
      })
      .filter((v) => !q || v.vlabel.toLowerCase().includes(q) || String(v.vid).toLowerCase().includes(q));
  }, [villages, filter]);

  // map id -> name (used to render chips with names)
  const idToLabel = useMemo(() => {
    const map = {};
    villages.forEach((v, i) => {
      const id = (v.villageID ?? v.villageId ?? v.id ?? v._id ?? v.code ?? v.village_code ?? String(v).trim()) || `v-${i}`;
      const name = v.name ?? v.villageName ?? v.village ?? id;
      map[String(id)] = name;
    });
    return map;
  }, [villages]);

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!validate()) return;
        // IMPORTANT: do NOT include userId in payload
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          role: getRoleCode(form.role),
          villageID: Array.isArray(form.villageIds) ? form.villageIds : (form.villageIds ? [form.villageIds] : []),
        };
        onSubmit(payload);
      }}
      className="bg-white rounded-2xl shadow-2xl p-5 space-y-4"
    >
      {/* NOTE: User ID is auto-assigned by backend so we DON'T show a userId input */}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 grid grid-cols-1 gap-3">
          <label className="block">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <User className="w-4 h-4 text-gray-400" /> <span className="font-medium">Full name</span>
            </div>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Anil Kumar"
              className={`w-full p-3 rounded-lg border shadow-sm focus:ring-2 focus:ring-indigo-200 transition ${errors.name ? "border-red-300" : "border-gray-200"}`}
            />
            {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name}</div>}
          </label>

          <label className="block">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <AtSign className="w-4 h-4 text-gray-400" /> <span className="font-medium">Email</span>
            </div>
            <input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="email@example.com"
              className={`w-full p-3 rounded-lg border shadow-sm focus:ring-2 focus:ring-indigo-200 transition ${errors.email ? "border-red-300" : "border-gray-200"}`}
            />
            {errors.email && <div className="text-xs text-red-600 mt-1">{errors.email}</div>}
          </label>

          <label className="block">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Smartphone className="w-4 h-4 text-gray-400" /> <span className="font-medium">Mobile</span>
            </div>
            <input
              value={form.mobile}
              onChange={(e) => update("mobile", e.target.value)}
              placeholder="+91 98xxxxxx"
              className={`w-full p-3 rounded-lg border shadow-sm focus:ring-2 focus:ring-indigo-200 transition ${errors.mobile ? "border-red-300" : "border-gray-200"}`}
            />
            {errors.mobile && <div className="text-xs text-red-600 mt-1">{errors.mobile}</div>}
          </label>
        </div>

        <div className="w-full md:w-80 flex flex-col gap-3">
          <label>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <span className="font-medium">Role</span>
            </div>
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              className={`w-full p-3 rounded-lg border shadow-sm focus:ring-2 focus:ring-indigo-200 transition ${
                errors.role ? "border-red-300" : "border-gray-200"
              }`}
            >
              <option value="" disabled hidden className="text-gray-400 italic">Select role</option>
              {ROLE_DEFS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>

            {errors.role && <div className="text-xs text-red-600 mt-1">{errors.role}</div>}
          </label>

          {/* Villages dropdown with chips */}
          <div ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-gray-600 font-medium">Villages</div>
              <div className="text-xs text-gray-400">Choose one or more</div>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => { setOpen((s) => !s); if (!open) setTimeout(() => { const el = dropdownRef.current?.querySelector("input"); if (el) el.focus(); }, 0); }}
                className="w-full p-3 rounded-lg border flex items-center justify-between gap-2 bg-white shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex flex-wrap gap-2 min-w-0">
                    {((form.villageIds || []).length === 0) ? (
                      <div className="text-gray-400 truncate">Select villages</div>
                    ) : (
                      (form.villageIds || []).slice(0, 3).map((id) => (
                        <span key={id} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs">
                          <span className="truncate max-w-[8rem]">{idToLabel[String(id)] ?? id}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeChip(id); }} className="ml-1">
                            <X className="w-3 h-3 text-indigo-600" />
                          </button>
                        </span>
                      ))
                    )}
                    {(form.villageIds || []).length > 3 && <span className="text-xs text-gray-500">+{(form.villageIds || []).length - 3}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div>{(form.villageIds || []).length} selected</div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </button>

              {open && (
                <div className="absolute z-50 mt-2 w-full bg-white border rounded-lg shadow-xl overflow-hidden">
                  <div className="p-3">
                    <div className="flex gap-2">
                      <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Search villages..."
                        className="flex-1 p-2 border rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const visibleIds = visibleVillages.map(v => v.vid);
                          const allSelected = visibleIds.length > 0 && visibleIds.every(id => (form.villageIds || []).includes(id));
                          if (allSelected) deselectAllVisible(visibleIds);
                          else selectAllVisible(visibleIds);
                        }}
                        className="px-3 py-1 text-sm bg-gray-100 rounded"
                      >
                        Select all
                      </button>
                    </div>

                    <div className="mt-3 max-h-44 overflow-auto">
                      {villLoading && <div className="text-sm text-gray-500 p-2">Loading villages…</div>}
                      {villError && <div className="text-sm text-red-600 p-2">{villError}</div>}
                      {!villLoading && !villError && visibleVillages.length === 0 && <div className="text-sm text-gray-500 p-2">No villages</div>}

                      {!villLoading && !villError && visibleVillages.map((v) => {
                        const checked = (form.villageIds || []).includes(v.vid);
                        return (
                          <label key={v.vid} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded">
                            <input type="checkbox" checked={checked} onChange={() => toggleVillage(v.vid)} className="w-4 h-4" />
                            <div className="text-sm truncate">{v.vlabel}</div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-gray-500">Selected: {(form.villageIds || []).length}</div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setOpen(false); setFilter(""); }} className="px-3 py-1 text-sm bg-gray-100 rounded">Done</button>
                        <button type="button" onClick={() => setForm((s) => ({ ...s, villageIds: [] }))} className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded">Clear</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-gray-400 mt-2">Tip: search by village name or code, then choose from the list.</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition">Cancel</button>
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold shadow hover:scale-[1.01] transition transform"
        >
          Save user
        </button>
      </div>
    </form>
  );
}

/* ---------- (rest of the page - bulk logic and list) ---------- */
export default function EmployeesPage() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewForm, setShowNewForm] = useState(false);

  // bulk
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPreview, setBulkPreview] = useState([]);
  const [showBulkPreview, setShowBulkPreview] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  // villages mappings
  const [villagesMap, setVillagesMap] = useState({});         // id -> name
  const [villagesNameToId, setVillagesNameToId] = useState({}); // lower(name) -> id

  // delete modal
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // update-specific error (render in modal instead of alert)
  const [updateError, setUpdateError] = useState(null);

  // add-specific error
  const [addError, setAddError] = useState(null);

  // delete-specific error (shown inside delete modal)
  const [deleteError, setDeleteError] = useState(null);

  // retry states for loadEmployees
  const [retrying, setRetrying] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // keep a ref to the add-error timer so we can clear on unmount/change
  const addErrorTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function fetchVillagesMap() {
      try {
        const res = await fetch(`${API_BASE}/villagesId`);
        if (!res.ok) throw new Error(`Failed to fetch villages (${res.status})`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.result || []);
        if (!mounted) return;
        const map = {};
        const nameToId = {};
        list.forEach((v) => {
          const id = (v.villageID ?? v.villageId ?? v.id ?? v._id ?? v.code ?? v.village_code ?? String(v).trim()) || "";
          const name = v.name ?? v.villageName ?? v.village ?? id;
          if (id) map[String(id)] = name;
          if (name) nameToId[String(name).trim().toLowerCase()] = String(id);
          if (id) nameToId[String(id).trim().toLowerCase()] = String(id);
          if (v.villageName) nameToId[String(v.villageName).trim().toLowerCase()] = String(id);
        });
        setVillagesMap(map);
        setVillagesNameToId(nameToId);
      } catch (e) {
        // keep quiet - UI will continue to work; village name resolution will show "name not found"
      }
    }
    fetchVillagesMap();
    return () => { mounted = false; };
  }, []);

  // helper sleep
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  // load employees with retry/backoff
  async function loadEmployees() {
    setLoading(true);
    setError(null);
    setRetrying(false);
    setRetryAttempt(0);

    let attempt = 0;
    let delay = LOAD_INITIAL_DELAY_MS;
    let lastErr = null;
    let mounted = true;

    // we use a mounted flag to prevent state updates after unmount
    try {
      while (attempt < LOAD_MAX_ATTEMPTS) {
        attempt += 1;
        try {
          const res = await fetch(`${API_BASE}/employee/all`);
          const text = await res.text().catch(() => null);
          const json = (() => { try { return text ? JSON.parse(text) : null; } catch { return null; } })();
          if (!res.ok) {
            lastErr = new Error((json && (json.message || json.error)) || text || `Failed to load (${res.status})`);
            throw lastErr;
          }
          const data = Array.isArray(json) ? json : (json?.result ?? json);
          const list = Array.isArray(data) ? data : (Array.isArray(json) ? json : []);
          const normalized = list.map((e) => {
            const vIDs = e.villageID ?? e.villageIds ?? (e.villageId ? (Array.isArray(e.villageId) ? e.villageId : [e.villageId]) : []);
            return {
              ...e,
              role: getRoleCode(e.role ?? e.roleCode ?? e.role),
              villageIDs: Array.isArray(vIDs) ? vIDs : (vIDs ? [vIDs] : []),
              villageId: Array.isArray(vIDs) ? (vIDs[0] || "") : (vIDs || ""),
            };
          });
          if (mounted) {
            setEmployees(normalized);
            setLoading(false);
            setRetrying(false);
            setRetryAttempt(0);
          }
          return;
        } catch (err) {
          lastErr = err;
          if (attempt < LOAD_MAX_ATTEMPTS) {
            if (mounted) {
              setRetrying(true);
              setRetryAttempt(attempt);
            }
            await sleep(delay);
            delay *= 2;
            continue;
          } else {
            break;
          }
        }
      }
      if (mounted) {
        setError(lastErr ? lastErr.message || String(lastErr) : "Could not load employees");
        setLoading(false);
        setRetrying(false);
      }
    } finally {
      mounted = false;
    }
  }

  useEffect(() => { loadEmployees(); }, []);

  // auto-dismiss addError after timeout
  useEffect(() => {
    if (!addError) return;
    if (addErrorTimerRef.current) {
      clearTimeout(addErrorTimerRef.current);
      addErrorTimerRef.current = null;
    }
    addErrorTimerRef.current = setTimeout(() => {
      setAddError(null);
      addErrorTimerRef.current = null;
    }, ADD_ERROR_TIMEOUT_MS);

    return () => {
      if (addErrorTimerRef.current) {
        clearTimeout(addErrorTimerRef.current);
        addErrorTimerRef.current = null;
      }
    };
  }, [addError]);

  const filtered = employees.filter(e =>
    [e.name, e.email, e.mobile].join(" ").toLowerCase().includes(search.toLowerCase()) &&
    (filterLocation ? (e.district || e.tehsil || "").toLowerCase().includes(filterLocation.toLowerCase()) : true)
  );

  /* ---------- add single ---------- */
  const handleAdd = async (payload) => {
    setAddError(null);
    try {
      const toSend = {
        name: payload.name,
        email: payload.email,
        mobile: payload.mobile,
        role: getRoleCode(payload.role),
        villageID: Array.isArray(payload.villageID) ? payload.villageID : (payload.villageID ? [payload.villageID] : (Array.isArray(payload.villageIDs) ? payload.villageIDs : (payload.villageIDs ? payload.villageIDs : []))),
      };
      const res = await fetch(`${API_BASE}/employee/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSend),
      });
      const text = await res.text().catch(() => null);
      const json = (() => { try { return text ? JSON.parse(text) : null; } catch { return null; } })();
      if (!res.ok) {
        const msg = (json && (json.message || json.error)) || text || `Add failed (${res.status})`;
        setAddError(msg);
        return;
      }
      await loadEmployees();
      setShowNewForm(false);
      setAddError(null);
    } catch (e) {
      setAddError(e?.message || "Failed to add");
    }
  };

  /* ---------- helper: find employee in loaded list (we NO LONGER call single-user API) ---------- */
  const extractId = (emp) => emp?.userId ?? emp?._id ?? emp?.id;
  const findEmployeeInState = (emp) => {
    const id = extractId(emp);
    if (!id) return emp;
    return employees.find(e => String(e.userId) === String(id) || String(e._id) === String(id) || String(e.id) === String(id)) || emp;
  };

  const handleOpenDetails = async (emp) => {
    setUpdateError(null);
    setSelectedEmployee(null);
    setEditingEmployee(null);
    setSelectedLoading(true);
    try {
      const details = findEmployeeInState(emp);
      setSelectedEmployee(details);
    } finally {
      setSelectedLoading(false);
    }
  };

  const handleStartEdit = async (emp) => {
    setUpdateError(null);
    setEditingEmployee(null);
    setSelectedEmployee(null);
    setSelectedLoading(true);
    try {
      const details = findEmployeeInState(emp);
      const normalized = {
        ...details,
        role: getRoleCode(details.role ?? details.roleCode ?? details.role),
        villageID: Array.isArray(details.villageID) ? details.villageID : (details.villageID ? [details.villageID] : (Array.isArray(details.villageIDs) ? details.villageIDs : (details.villageIds ?? []))),
      };
      setSelectedEmployee(normalized);
      setEditingEmployee(normalized);
    } finally {
      setSelectedLoading(false);
    }
  };

  /* ---------- update (DO NOT SEND userId in body) ---------- */
  // Normalize phone for submit
  const normalizeMobileForSubmit = (val) => {
    if (val === null || val === undefined) return "";
    let s = String(val).trim();
    const keepPlus = s.startsWith("+");
    s = s.replace(/[^\d]/g, "");
    if (keepPlus && s.length) s = "+" + s;
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
    return s;
  };

  // Convert village tokens/names -> village IDs using villagesMap / villagesNameToId (best-effort).
  const normalizeVillageTokensToIds = (raw) => {
    if (raw === undefined || raw === null) return [];
    const tokens = Array.isArray(raw) ? raw.flatMap(r => (typeof r === "string" ? r.split(/[;,]/) : [r])) : String(raw).split(/[;,]/);
    const out = [];
    tokens.forEach(t => {
      const tok = String(t || "").trim();
      if (!tok) return;
      // exact id match
      if (villagesMap[tok]) { out.push(tok); return; }
      // case-insensitive name/id match using nameToId map
      const lower = tok.toLowerCase();
      if (villagesNameToId[lower]) { out.push(villagesNameToId[lower]); return; }
      // fuzzy: find any key that includes or is included
      const matchKey = Object.keys(villagesNameToId).find(k => k.includes(lower) || lower.includes(k));
      if (matchKey) { out.push(villagesNameToId[matchKey]); return; }
      // fallback: push raw token (let backend validate)
      out.push(tok);
    });
    return out;
  };

  const handleSaveUpdate = async (payload) => {
    setUpdateError(null);

    // derive id (payload intentionally does not include userId)
    const idFromPayload = payload?.userId ?? payload?._id ?? payload?.id;
    const idFromEditing = editingEmployee && (editingEmployee.userId ?? editingEmployee._id ?? editingEmployee.id);
    const idFromSelected = selectedEmployee && (selectedEmployee.userId ?? selectedEmployee._id ?? selectedEmployee.id);
    const id = idFromPayload || idFromEditing || idFromSelected;

    if (!id) {
      setUpdateError("Missing employee id — cannot update.");
      return;
    }

    // Build minimal payload with only allowed fields (but handle villages specially: send array if provided)
    const toSend = {};

    if (payload.name !== undefined) {
      const v = String(payload.name || "").trim();
      if (v !== "") toSend.name = v;
    }

    if (payload.email !== undefined) {
      const v = String(payload.email || "").trim();
      if (v !== "") toSend.email = v;
    }

    if (payload.mobile !== undefined) {
      const raw = String(payload.mobile || "");
      const v = normalizeMobileForSubmit(raw);
      if (v !== "") toSend.mobile = v;
    }

    // Role: if provided, always send the short code (even if it's already short)
    if (payload.role !== undefined) {
      const code = getRoleCode(payload.role);
      if (String(code || "").trim() !== "") toSend.role = code;
    }

    // Villages: if the caller provided any village data (even empty array/string), send villageID array.
    if (payload.villageID !== undefined || payload.villageIDs !== undefined || payload.villageIds !== undefined) {
      const villagesRaw = payload.villageID ?? payload.villageIDs ?? payload.villageIds;
      const normalizedVillageIds = normalizeVillageTokensToIds(villagesRaw);
      toSend.villageID = normalizedVillageIds;
    }

    // don't send empty object
    if (Object.keys(toSend).length === 0) {
      setUpdateError("No fields to update.");
      return;
    }

    // preserve numeric id when possible (backend stores numeric userId in many deployments)
    const idForUrl = (!isNaN(Number(id)) && String(Number(id)) === String(id)) ? Number(id) : String(id);

    try {
      const res = await fetch(`${API_BASE}/employee/update/${encodeURIComponent(String(idForUrl))}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSend),
      });

      const text = await res.text().catch(() => null);
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }

      if (!res.ok) {
        // Format common response shapes into friendly message
        let messages = [];
        if (json && Array.isArray(json.detail)) {
          messages = json.detail.map(d => {
            const loc = d.loc ? (Array.isArray(d.loc) ? d.loc.join(".") : d.loc) : "body";
            return `${loc}: ${d.msg || JSON.stringify(d)}`;
          });
        } else if (json && (json.message || json.error)) {
          messages = [json.message || json.error];
        } else if (json && json.validation_errors && Array.isArray(json.validation_errors)) {
          messages = json.validation_errors.map(e => typeof e === "string" ? e : (e.error || JSON.stringify(e)));
        } else if (Array.isArray(json)) {
          messages = json.map(e => e.msg || e.message || JSON.stringify(e));
        } else if (text) {
          messages = [text];
        } else {
          messages = [`Update failed (${res.status})`];
        }

        const friendly = messages.join("; ");
        setUpdateError(friendly || `Update failed (${res.status})`);
        return;
      }

      // success — reload and close modal
      await loadEmployees();
      setEditingEmployee(null);
      setSelectedEmployee(null);
      setUpdateError(null);
    } catch (err) {
      setUpdateError(err?.message || String(err) || "Update failed");
    }
  };

  /* ---------- delete flow ---------- */
  const openDeleteModal = (emp) => { setPendingDelete(emp); setDeleteError(null); };
  const closeDeleteModal = () => { if (deleteLoading) return; setPendingDelete(null); setDeleteError(null); };

  const performDelete = async () => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const rawId = pendingDelete.userId ?? pendingDelete._id ?? pendingDelete.id;
      if (!rawId) throw new Error("Missing user id for delete");
      const id = rawId;
      const res = await fetch(`${API_BASE}/employee/delete/${encodeURIComponent(String(id))}`, { method: "DELETE" });
      const text = await res.text().catch(() => null);
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
      if (!res.ok) {
        const msg = (json && (json.message || json.error)) || text || `Delete failed (${res.status})`;
        throw new Error(msg);
      }
      await loadEmployees();
      setPendingDelete(null);
      setSelectedEmployee(null);
      setDeleteError(null);
    } catch (e) {
      setDeleteError(e?.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ---------- bulk parsing helpers (unchanged) ---------- */
  const normHeader = (h) => String(h || "").trim().replace(/\s+/g, "").toLowerCase();
  const normalizeMobile = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === "number") return String(Math.trunc(val));
    let s = String(val).trim();
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
    return s;
  };

  const handleParseBulk = async () => {
    if (!bulkFile) { setBulkProgress({ status: "error", message: "Choose a CSV/XLSX file first" }); return; }
    setBulkProgress({ status: "parsing" });
    try {
      const XLSX = (await import("xlsx")).default ?? (await import("xlsx"));
      const name = (bulkFile.name || "").toLowerCase();
      let workbook;
      if (name.endsWith(".csv")) {
        const text = await bulkFile.text();
        workbook = XLSX.read(text, { type: "string" });
      } else {
        const ab = await bulkFile.arrayBuffer();
        workbook = XLSX.read(ab, { type: "array" });
      }
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (!rows || rows.length < 2) {
        setBulkProgress({ status: "error", message: "No data found in sheet (need header + rows)." });
        return;
      }

      const headerRow = rows[0].map(h => String(h || "").trim());
      const headerMap = {};
      headerRow.forEach((h, i) => headerMap[normHeader(h)] = i);

      const requiredCandidates = {
        email: ["email", "e-mail", "e_mail"],
        name: ["name", "fullname", "full name"],
        role: ["role"],
        mobile: ["mobile", "phone", "phonenumber"],
        villageID: ["villageid", "villageids", "village_id", "village id", "villageid(s)", "village", "village name", "village_name"],
      };

      const findIndex = (candidates) => {
        for (const cand of candidates) {
          const key = cand.replace(/\s+/g, "").toLowerCase();
          if (headerMap[key] !== undefined) return headerMap[key];
        }
        return -1;
      };

      const idxEmail = findIndex(requiredCandidates.email);
      const idxName = findIndex(requiredCandidates.name);
      const idxRole = findIndex(requiredCandidates.role);
      const idxMobile = findIndex(requiredCandidates.mobile);
      const idxVillage = findIndex(requiredCandidates.villageID);

      const mapped = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every((c) => c === "" || c === null || c === undefined)) continue;

        const rawEmail = idxEmail >= 0 ? row[idxEmail] : "";
        const rawName = idxName >= 0 ? row[idxName] : "";
        const rawRole = idxRole >= 0 ? row[idxRole] : "";
        const rawMobile = idxMobile >= 0 ? row[idxMobile] : "";
        const rawVillage = idxVillage >= 0 ? row[idxVillage] : "";

        const email = rawEmail === undefined || rawEmail === null ? "" : String(rawEmail).trim();
        const name = rawName === undefined || rawName === null ? "" : String(rawName).trim();
        const role = (rawRole === undefined || rawRole === null || String(rawRole).trim() === "") ? "fg" : String(rawRole).trim();
        const mobile = normalizeMobile(rawMobile);

        let villageStr = "";
        if (Array.isArray(rawVillage)) villageStr = rawVillage.map(x => (x || "").toString().trim()).filter(Boolean).join(",");
        else if (rawVillage === null || rawVillage === undefined) villageStr = "";
        else villageStr = String(rawVillage).trim();
        villageStr = villageStr.split(/[;,]/).map(s => s.trim()).filter(Boolean).join(",");

        mapped.push({
          __idx: r - 1,
          name,
          email,
          role,
          mobile,
          villageIDs: villageStr,
          _rawRow: row,
        });
      }

      setBulkPreview(mapped);
      setShowBulkPreview(true);
      setBulkProgress(null);
    } catch (err) {
      setBulkProgress({ status: "error", message: err?.message || String(err) || "Failed to parse file" });
    }
  };

  const handleBulkRowChange = (index, field, value) => {
    setBulkPreview((s) => s.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const handleBulkRemoveRow = (index) => setBulkPreview((s) => s.filter((_, i) => i !== index));

  /* ---------- convert village tokens: name -> id (best-effort) ---------- */
  function convertVillageTokens(villageStr) {
    const tokens = String(villageStr || "").split(/[;,]/).map(s => s.trim()).filter(Boolean);
    const ids = [];
    const conversions = [];
    const unknowns = [];
    tokens.forEach((tok) => {
      const raw = String(tok).trim();
      const lower = raw.toLowerCase();
      if (villagesMap[raw]) {
        ids.push(raw);
      } else if (villagesNameToId[lower]) {
        ids.push(villagesNameToId[lower]);
        conversions.push(`${raw} → ${villagesNameToId[lower]}`);
      } else {
        const matchKey = Object.keys(villagesNameToId).find(k => k.includes(lower) || lower.includes(k));
        if (matchKey) {
          ids.push(villagesNameToId[matchKey]);
          conversions.push(`${raw} → ${villagesNameToId[matchKey]}`);
        } else {
          unknowns.push(raw);
          ids.push(raw);
        }
      }
    });
    return { ids, conversions, unknowns };
  }

  /* ---------- confirm bulk add: convert names and send ---------- */
  const handleConfirmBulkAdd = async () => {
    if (!bulkPreview || bulkPreview.length === 0) { setBulkProgress({ status: "error", message: "No rows to add" }); return; }
    setBulkProgress({ status: "uploading", total: bulkPreview.length, done: 0 });

    try {
      const conversionsAcc = [];
      const unknownsAcc = [];
      const employeesPayload = bulkPreview.map((r) => {
        const { ids, conversions, unknowns } = convertVillageTokens(r.villageIDs || "");
        if (conversions && conversions.length) conversionsAcc.push(...conversions);
        if (unknowns && unknowns.length) unknownsAcc.push({ name: r.name || r.email || "Unknown", unknowns });
        return {
          name: r.name || "",
          email: r.email || "",
          role: getRoleCode(r.role || "fg"),
          mobile: r.mobile ? String(r.mobile) : "",
          villageID: ids,
        };
      });

      const preFriendly = [];
      if (conversionsAcc.length) {
        const uniq = Array.from(new Set(conversionsAcc));
        uniq.forEach(c => preFriendly.push(`Converted: ${c}`));
      }
      if (unknownsAcc.length) {
        unknownsAcc.forEach((u) => preFriendly.push(`Unknown villages for ${u.name}: ${u.unknowns.join(", ")}`));
      }
      if (preFriendly.length) {
        setBulkProgress((p) => ({ ...(p || {}), status: "uploading", preFriendly }));
      }

      const res = await fetch(`${API_BASE}/employee/bulk_add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: employeesPayload }),
      });

      const text = await res.text().catch(() => null);
      const json = (() => { try { return JSON.parse(text || "{}"); } catch { return { raw: text }; } })();

      if (!res.ok) {
        const errMsg = json?.message || json?.error || text || `Bulk failed (${res.status})`;
        throw new Error(errMsg);
      }

      const summary = (json && json.result) ? json.result : (json || {});
      const friendly = [];
      if (Array.isArray(summary.inserted) && summary.inserted.length) friendly.push(`✓ Inserted: ${summary.inserted.join(", ")}`);
      if (Array.isArray(summary.skipped_existing) && summary.skipped_existing.length) {
        summary.skipped_existing.forEach((s) => {
          const id = s.email || s.mobile || s.name || JSON.stringify(s);
          const reason = s.reason || s.message || "";
          friendly.push(reason ? `✖ Skipped: ${id} — ${reason}` : `✖ Skipped: ${id}`);
        });
      }
      if (Array.isArray(summary.validation_errors) && summary.validation_errors.length) {
        summary.validation_errors.forEach((ve) => {
          const name = ve.employee_name || ve.name || "Unknown";
          const err = ve.error;
          let msg = "";
          if (Array.isArray(err)) msg = err.join("; ");
          else if (typeof err === "string") {
            const mBracket = err.match(/Invalid\s+villageIDs\s*:\s*\[([^\]]*)\]/i);
            if (mBracket && mBracket[1]) {
              const ids = mBracket[1].split(",").map(s => s.replace(/['"]/g, "").trim()).filter(Boolean);
              msg = ids.length === 1 ? `Village ID ${ids[0]} not found` : `Village IDs ${ids.join(", ")} not found`;
            } else {
              const ids = [];
              const regex = /['"]([A-Za-z0-9_-]+)['"]/g;
              let mm;
              while ((mm = regex.exec(err)) !== null) ids.push(mm[1]);
              if (ids.length === 1) msg = `Village ID ${ids[0]} not found`;
              else if (ids.length > 1) msg = `Village IDs ${ids.join(", ")} not found`;
              else msg = err.replace(/\s+/g, " ").trim();
            }
          } else msg = String(err);
          friendly.push(`⚠ ${name} — ${msg}`);
        });
      }

      if (friendly.length === 0) {
        friendly.push("Bulk operation completed. No descriptive summary returned by server.");
        if (summary && Object.keys(summary).length) friendly.push(`Raw: ${JSON.stringify(summary)}`);
      }

      const finalFriendly = [];
      if (Array.isArray(bulkProgress?.preFriendly) && bulkProgress.preFriendly.length) {
        finalFriendly.push(...bulkProgress.preFriendly);
      }
      finalFriendly.push(...friendly);

      await loadEmployees();
      setBulkProgress({ status: "done", total: employeesPayload.length, done: employeesPayload.length, summary, friendly: finalFriendly });
      setShowBulkPreview(false);
      setBulkPreview([]);
      setBulkFile(null);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (e) {
      setBulkProgress({ status: "error", message: e.message || "Bulk add failed" });
    }
  };

  const villageIdsToNames = (arr) => {
    if (!arr || !arr.length) return [];
    return arr.map((id) => {
      const key = String(id || "");
      const name = villagesMap[key];
      return name ? `${name} (${key})` : `${key} (name not found)`;
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f0dc]">
      <div><MainNavbar name={(localStorage.getItem("user") && JSON.parse(localStorage.getItem("user")).name) || "Shrey"} showWelcome /></div>

      <div className="px-4 md:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl font-semibold">Employees</h1>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="flex gap-2 items-center">
                <button onClick={() => navigate("/dashboard")} className="px-3 py-2 border rounded-md bg-white text-sm">← Back</button>
              </div>

              <div className="flex gap-2 items-center">
                <button onClick={() => { setShowNewForm((s) => !s); setAddError(null); }} className="flex items-center gap-2 px-4 py-2 bg-white rounded shadow">
                  <PlusCircle className="w-4 h-4" /> <span className="hidden sm:inline">New Employee</span>
                </button>

                <label className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow cursor-pointer">
                  <UploadCloud className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Insert Bulk</span>
                  <input ref={fileInputRef} type="file" accept=".csv, .xlsx, .xls" onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)} className="hidden" />
                </label>

                <button onClick={handleParseBulk} disabled={!bulkFile} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60">Upload</button>
              </div>
            </div>
          </div>

          {/* retry indicator */}
          {retrying && (
            <div className="mb-3">
              <div className="text-sm text-yellow-700">Retrying to load employees (attempt {retryAttempt} of {LOAD_MAX_ATTEMPTS})...</div>
            </div>
          )}

          {/* bulk progress */}
          {bulkProgress && (
            <div className="mb-4">
              <div className="bg-white p-3 rounded-2xl shadow">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Bulk status:
                    <span className="ml-2 font-semibold">{bulkProgress.status}</span>
                  </div>
                  <div className="text-sm text-gray-500">{bulkProgress.total ? `${bulkProgress.done || 0}/${bulkProgress.total}` : ""}</div>
                </div>

                {bulkProgress.status === "error" && bulkProgress.message && (
                  <div className="mt-3 p-3 rounded bg-red-50 border border-red-100 text-red-700">
                    <div className="font-medium">Upload failed</div>
                    <div className="text-sm mt-1">{bulkProgress.message}</div>
                  </div>
                )}

                {bulkProgress.preFriendly && bulkProgress.preFriendly.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium">Before sending</div>
                    <ul className="mt-2 space-y-1">
                      {bulkProgress.preFriendly.map((line, i) => <li key={i} className="text-sm">• {line}</li>)}
                    </ul>
                  </div>
                )}

                {bulkProgress.friendly && bulkProgress.friendly.length > 0 && (
                  <div className="mt-3">
                    <ul className="mt-2 space-y-1">
                      {bulkProgress.friendly.map((line, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${line.startsWith("✓") ? "bg-green-100 text-green-800" : line.startsWith("⚠") ? "bg-yellow-100 text-yellow-800" : line.startsWith("✖") ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                            {line.startsWith("✓") ? "✓" : line.startsWith("⚠") ? "⚠" : line.startsWith("✖") ? "✖" : "•"}
                          </span>
                          <div className="text-sm">{line.replace(/^✓\s|^⚠\s|^✖\s/, "")}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!bulkProgress.friendly && bulkProgress.summary && (
                  <div className="mt-3 text-sm">
                    <div className="font-medium">Result</div>
                    <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">{JSON.stringify(bulkProgress.summary, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* new form */}
          {showNewForm && (
            <div className="mb-4">
              {addError && (
                <div className="mb-3 p-3 rounded bg-red-50 border border-red-100 text-red-700">
                  <div className="font-medium">Failed to add user</div>
                  <div className="text-sm mt-1">{addError}</div>
                </div>
              )}
              <EmployeeForm initial={{}} onCancel={() => { setShowNewForm(false); setAddError(null); }} onSubmit={handleAdd} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, mobile" className="w-full pl-10 p-2 border rounded bg-white" />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow p-3">
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full table-auto text-left">
                    <thead>
                      <tr className="text-gray-600 border-b">
                        <th className="py-2">User ID</th>
                        <th className="py-2">Name</th>
                        <th className="py-2">Email</th>
                        <th className="py-2">Role</th>
                        <th className="py-2">Mobile</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (<tr><td colSpan={6} className="py-6 text-center">Loading…</td></tr>)}
                      {error && (<tr><td colSpan={6} className="py-6 text-center text-red-600">{error}</td></tr>)}
                      {!loading && !error && filtered.map((emp) => (
                        <tr key={emp.userId || emp._id || emp.id} className="hover:bg-gray-50 cursor-pointer">
                          <td className="py-3 pr-4 text-sm" onClick={() => handleOpenDetails(emp)}>{emp.userId ?? emp._id ?? emp.id}</td>
                          <td className="py-3 pr-4 text-sm" onClick={() => handleOpenDetails(emp)}>{emp.name}</td>
                          <td className="py-3 pr-4 text-sm" onClick={() => handleOpenDetails(emp)}>{emp.email}</td>
                          <td className="py-3 pr-4 text-sm" onClick={() => handleOpenDetails(emp)}>{getRoleLabel(emp.role)}</td>
                          <td className="py-3 pr-4 text-sm" onClick={() => handleOpenDetails(emp)}>{emp.mobile}</td>
                          <td className="py-3 pr-4 flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleStartEdit(emp); setUpdateError(null); }} className="p-2 bg-white rounded shadow"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); openDeleteModal(emp); }} className="p-2 bg-white rounded shadow"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                      {!loading && !error && filtered.length === 0 && (<tr><td colSpan={6} className="py-6 text-center text-gray-500">No employees</td></tr>)}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden">
                  {loading && <div className="py-6 text-center">Loading…</div>}
                  {error && <div className="py-6 text-center text-red-600">{error}</div>}
                  {!loading && !error && filtered.map(emp => (
                    <div key={emp.userId || emp._id || emp.id} className="mb-3">
                      <div className="bg-white rounded-2xl shadow p-3" onClick={() => handleOpenDetails(emp)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{emp.name}</div>
                            <div className="text-xs text-gray-500 truncate">{emp.email} • {emp.mobile}</div>
                            <div className="text-xs text-gray-600 mt-1">{getRoleLabel(emp.role)}{emp.villageId ? ` • ${emp.villageId}` : ""}</div>
                          </div>
                          <div className="flex items-start gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleStartEdit(emp); setUpdateError(null); }} className="p-2 bg-white rounded shadow"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); openDeleteModal(emp); }} className="p-2 bg-white rounded shadow"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-start justify-center lg:justify-end">
              <div className="w-full max-w-md">
                <RolesPie employees={employees} />
              </div>
            </div>
          </div>

          {/* centered details modal */}
          {selectedEmployee && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30" onClick={() => { setSelectedEmployee(null); setEditingEmployee(null); setUpdateError(null); }} />
              <div className="relative w-full max-w-3xl md:rounded-2xl bg-white shadow p-6 z-60 sm:mx-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg">{selectedEmployee.name}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSelectedEmployee(null); setEditingEmployee(null); setUpdateError(null); }} className="px-3 py-1 bg-gray-100 rounded">Close</button>
                  </div>
                </div>

                <div className="mt-4">
                  {selectedLoading ? (
                    <div className="py-6 text-center">Loading details…</div>
                  ) : editingEmployee ? (
                    <div>
                      {updateError && <div className="mb-3 p-2 rounded bg-red-50 text-red-700">{updateError}</div>}
                      <EmployeeForm initial={editingEmployee} onCancel={() => { setEditingEmployee(null); setUpdateError(null); }} onSubmit={handleSaveUpdate} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-gray-500">Email</div>
                        <div className="font-medium break-words">{selectedEmployee.email || "—"}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500">Mobile</div>
                        <div className="font-medium">{selectedEmployee.mobile || "—"}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500">Role</div>
                        <div className="font-medium">{getRoleLabel(selectedEmployee.role)}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500">Villages</div>
                        <div className="font-medium">
                          {
                            (selectedEmployee.villageIDs && selectedEmployee.villageIDs.length)
                              ? villageIdsToNames(selectedEmployee.villageIDs).join(", ")
                              : (selectedEmployee.villageId ? (villagesMap[String(selectedEmployee.villageId)] ? `${villagesMap[String(selectedEmployee.villageId)]} (${selectedEmployee.villageId})` : `${selectedEmployee.villageId} (name not found)`) : "—")
                          }
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* bulk preview modal */}
          {showBulkPreview && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
              <div className="absolute inset-0 bg-black/30" onClick={() => { setShowBulkPreview(false); }} />
              <div className="relative w-full max-w-4xl md:rounded-2xl bg-white shadow p-4 z-60 sm:mx-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Bulk Upload Preview ({bulkPreview.length} rows)</h3>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowBulkPreview(false); }} className="px-3 py-1 bg-gray-100 rounded">Close</button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full table-auto text-left">
                    <thead>
                      <tr className="text-gray-600 border-b">
                        <th className="py-2">#</th>
                        <th className="py-2">Name</th>
                        <th className="py-2">Email</th>
                        <th className="py-2">Role</th>
                        <th className="py-2">Mobile</th>
                        <th className="py-2">Village IDs / Names</th>
                        <th className="py-2">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2 pr-3 text-sm align-top">{idx + 1}</td>
                          <td className="py-2 pr-3"><input className="p-1 border rounded w-52" value={row.name} onChange={(e) => handleBulkRowChange(idx, "name", e.target.value)} /></td>
                          <td className="py-2 pr-3"><input className="p-1 border rounded w-56" value={row.email} onChange={(e) => handleBulkRowChange(idx, "email", e.target.value)} /></td>
                          <td className="py-2 pr-3"><input className="p-1 border rounded w-28" value={row.role} onChange={(e) => handleBulkRowChange(idx, "role", e.target.value)} /></td>
                          <td className="py-2 pr-3"><input className="p-1 border rounded w-36" value={row.mobile} onChange={(e) => handleBulkRowChange(idx, "mobile", e.target.value)} /></td>
                          <td className="py-2 pr-3"><input className="p-1 border rounded w-64" value={row.villageIDs} onChange={(e) => handleBulkRowChange(idx, "villageIDs", e.target.value)} /></td>
                          <td className="py-2 pr-3"><button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => handleBulkRemoveRow(idx)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4">
                  <button onClick={() => { setShowBulkPreview(false); }} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
                  <button onClick={handleConfirmBulkAdd} className="px-4 py-2 bg-blue-600 text-white rounded">Confirm Add All</button>
                </div>
              </div>
            </div>
          )}

          {/* delete confirmation modal */}
          {pendingDelete && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={closeDeleteModal} />
              <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-70">
                <h3 className="text-lg font-semibold mb-2">Confirm delete</h3>
                <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete <span className="font-medium">{pendingDelete.name || pendingDelete.email || "this employee"}</span>? This action cannot be undone.</p>

                {deleteError && (
                  <div className="mb-3 p-3 rounded bg-red-50 border border-red-100 text-red-700">
                    <div className="font-medium">Delete failed</div>
                    <div className="text-sm mt-1">{deleteError}</div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button onClick={closeDeleteModal} disabled={deleteLoading} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
                  <button onClick={performDelete} disabled={deleteLoading} className={`px-4 py-2 rounded text-white ${deleteLoading ? "bg-red-300" : "bg-red-600"}`}>{deleteLoading ? "Deleting..." : "Delete"}</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
