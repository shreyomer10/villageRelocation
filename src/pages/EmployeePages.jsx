import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Search, UploadCloud, PlusCircle, Trash2, Edit2 } from "lucide-react";

// Mobile-responsive Employees page. Layout uses Tailwind responsive utilities.
// Key mobile changes:
// - Action bar stacks on small screens (flex-col -> md:flex-row)
// - Table hides non-essential columns on small screens and shows a compact card list instead
// - Modal becomes full-screen on small devices
// - Inputs and forms are full-width on small screens

const ROLE_OPTIONS = [
  "ADMIN",
  "forestguard",
  "rangeAssistant",
  "rangeOfficer",
  "assistantDirector",
  "deputyDirector",
];

function simpleParseCSV(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? "").trim(); });
    return obj;
  });
}

function RolesPie({ employees = [] }) {
  const data = useMemo(() => {
    const map = {};
    employees.forEach(e => { const r = e.role || "UNKNOWN"; map[r] = (map[r] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a78bfa", "#c084fc", "#60a5fa"];

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Employee Roles</h3>
        <div className="text-sm text-gray-500">Total: {employees.length}</div>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={70} label>
              {data.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EmployeeForm({ initial = {}, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    name: initial.name || "",
    email: initial.email || "",
    mobile: initial.mobile || "",
    role: initial.role || "forestguard",
    password: initial.password || "",
    villageId: initial.villageId || "",
    range: initial.range || "",
    sd1: initial.sd1 || "",
    fd: initial.fd || "",
    gramPanchayat: initial.gramPanchayat || "",
    tehsil: initial.tehsil || "",
    janpad: initial.janpad || "",
    subD2: initial.subD2 || "",
    district: initial.district || "",
  });

  const update = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="bg-white rounded-lg shadow p-4 space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Name" className="p-2 border rounded w-full" />
        <input required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Email" className="p-2 border rounded w-full" />
        <input required value={form.mobile} onChange={(e) => update("mobile", e.target.value)} placeholder="Mobile" className="p-2 border rounded w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <select value={form.role} onChange={(e) => update("role", e.target.value)} className="p-2 border rounded w-full">
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Password (optional)" className="p-2 border rounded w-full" />
        <input value={form.villageId} onChange={(e) => update("villageId", e.target.value)} placeholder="Village ID" className="p-2 border rounded w-full" />
      </div>

      {/* Additional optional fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <input value={form.range} onChange={(e) => update("range", e.target.value)} placeholder="Range (optional)" className="p-2 border rounded w-full" />
        <input value={form.sd1} onChange={(e) => update("sd1", e.target.value)} placeholder="SD1 (optional)" className="p-2 border rounded w-full" />
        <input value={form.fd} onChange={(e) => update("fd", e.target.value)} placeholder="FD (optional)" className="p-2 border rounded w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <input value={form.gramPanchayat} onChange={(e) => update("gramPanchayat", e.target.value)} placeholder="Gram Panchayat" className="p-2 border rounded w-full" />
        <input value={form.tehsil} onChange={(e) => update("tehsil", e.target.value)} placeholder="Tehsil" className="p-2 border rounded w-full" />
        <input value={form.janpad} onChange={(e) => update("janpad", e.target.value)} placeholder="Janpad" className="p-2 border rounded w-full" />
        <input value={form.subD2} onChange={(e) => update("subD2", e.target.value)} placeholder="SubD2" className="p-2 border rounded w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={form.district} onChange={(e) => update("district", e.target.value)} placeholder="District" className="p-2 border rounded w-full" />
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Submit</button>
      </div>
    </form>
  );
}

function EmployeeCardMobile({ emp, onEdit, onDelete, onOpen }) {
  return (
    <div className="bg-white rounded-lg shadow p-3 mb-3" onClick={() => onOpen(emp)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{emp.name}</div>
          <div className="text-xs text-gray-500 truncate">{emp.email} • {emp.mobile}</div>
          <div className="text-xs text-gray-600 mt-1">{emp.role} {emp.villageId ? `• ${emp.villageId}` : ""}</div>
        </div>
        <div className="flex items-start gap-2">
          <button onClick={(e) => { e.stopPropagation(); onEdit(emp); }} className="p-2 bg-white rounded shadow"><Edit2 className="w-4 h-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(emp); }} className="p-2 bg-white rounded shadow"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNewForm, setShowNewForm] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null);

  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("https://villagerelocation.onrender.com/employee/all");
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.result || []);
        if (!mounted) return;
        setEmployees(list.map(e => ({ ...e })));
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Could not load employees");
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = employees.filter(e => [e.name, e.email, e.mobile].join(" ").toLowerCase().includes(search.toLowerCase()) && (filterLocation ? (e.district || e.tehsil || "").toLowerCase().includes(filterLocation.toLowerCase()) : true));

  const handleAdd = async (payload) => {
    try {
      const res = await fetch("https://villagerelocation.onrender.com/employee/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Add failed (${res.status})`);
      const json = await res.json();
      const created = json.result || json;
      setEmployees((s) => [created, ...s]);
      setShowNewForm(false);
    } catch (e) {
      alert(e?.message || "Failed to add");
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkProgress({ status: "parsing" });
    try {
      const text = await bulkFile.text();
      const rows = simpleParseCSV(text);
      const valid = rows.map((r) => ({
        name: r.name || r["Name"] || "",
        email: r.email || r["Email"] || "",
        role: r.role || r["Role"] || "forestguard",
        mobile: r.mobile || r["Mobile"] || "",
        villageId: r.villageId || r["villageId"] || r["Village ID"] || "",
        range: r.range || "",
        sd1: r.sd1 || "",
        fd: r.fd || "",
        gramPanchayat: r.gramPanchayat || "",
        tehsil: r.tehsil || "",
        janpad: r.janpad || "",
        subD2: r.subD2 || "",
        district: r.district || "",
      }));

      setBulkProgress({ status: "uploading", total: valid.length, done: 0 });

      const res = await fetch("https://villagerelocation.onrender.com/employee/bulk_add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employees: valid }),
      });
      if (!res.ok) throw new Error(`Bulk failed (${res.status})`);
      const json = await res.json();
      const resultList = json.result || json.inserted || valid;
      setEmployees((s) => [...(Array.isArray(resultList) ? resultList : valid), ...s]);
      setBulkProgress({ status: "done", total: valid.length, done: valid.length });
      setBulkFile(null);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (e) {
      setBulkProgress({ status: "error", message: e.message });
    }
  };

  const handleSelectRow = async (emp) => {
    setSelectedEmployee(emp);
    setEditingEmployee(null);
  };

  const handleSaveUpdate = async (payload) => {
    const id = payload.userId || payload._id || payload.id;
    try {
      const res = await fetch(`https://villagerelocation.onrender.com/employee/update/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const json = await res.json();
      const updated = json.result || payload;
      setEmployees((s) => s.map(it => (String(it._id || it.userId || it.id) === String(id) ? { ...it, ...updated } : it)));
      setSelectedEmployee(updated);
      setEditingEmployee(null);
    } catch (e) { alert(e.message || "Update failed"); }
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    try {
      const id = emp.userId || emp._id || emp.id;
      const res = await fetch(`https://villagerelocation.onrender.com/employee/delete/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setEmployees((s) => s.filter(it => String(it._id || it.userId || it.id) !== String(id)));
      setSelectedEmployee(null);
    } catch (e) { alert(e.message || "Delete failed"); }
  };

  return (
    <div className="min-h-screen bg-[#f8f0dc]">
      <div style={{ pointerEvents: "auto" }}>
        <MainNavbar name={(localStorage.getItem("user") && JSON.parse(localStorage.getItem("user")).name) || "Shrey"} showWelcome />
      </div>

      <div className="px-4 md:px-6 py-6" style={{ pointerEvents: "auto" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl font-semibold">Employees 👷‍♂</h1>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-3 py-2 border rounded-md bg-white text-sm"
                >
                  ← Back
                </button>
              </div>

              <div className="flex gap-2 items-center">
                <button onClick={() => setShowNewForm((s) => !s)} className="flex items-center gap-2 px-4 py-2 bg-white rounded shadow">
                  <PlusCircle className="w-4 h-4" /> <span className="hidden sm:inline">New Employee</span>
                </button>

                <label className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow cursor-pointer">
                  <UploadCloud className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Insert Bulk</span>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)} className="hidden" />
                </label>

                {/* <button onClick={handleBulkUpload} disabled={!bulkFile} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60">Upload</button> */}
              </div>
            </div>
          </div>

          {/* Bulk progress and new employee form */}
          {bulkProgress && (
            <div className="mb-4">
              <div className="bg-white p-3 rounded shadow">
                <div className="text-sm">Bulk status: {bulkProgress.status} {bulkProgress.total ? `({bulkProgress.done || 0}/{bulkProgress.total})` : ""}</div>
                {bulkProgress.message && <div className="text-xs text-red-600">{bulkProgress.message}</div>}
              </div>
            </div>
          )}

          {showNewForm && (
            <div className="mb-4">
              <EmployeeForm initial={{}} onCancel={() => setShowNewForm(false)} onSubmit={handleAdd} />
            </div>
          )}

          {/* Analytics + Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, mobile" className="w-full pl-10 p-2 border rounded bg-white" />
                </div>
                <input value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} placeholder="Filter district/tehsil" className="p-2 border rounded bg-white w-full sm:w-56" />
              </div>

              {/* Desktop table, mobile cards */}
              <div className="bg-white rounded shadow p-3">
                {/* Table for md+ */}
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
                      {loading && (
                        <tr><td colSpan={6} className="py-6 text-center">Loading…</td></tr>
                      )}
                      {error && (
                        <tr><td colSpan={6} className="py-6 text-center text-red-600">{error}</td></tr>
                      )}
                      {!loading && !error && filtered.map((emp) => (
                        <tr key={emp.userId || emp._id || emp.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleSelectRow(emp)}>
                          <td className="py-3 pr-4 text-sm">{emp.userId ?? emp._id ?? emp.id}</td>
                          <td className="py-3 pr-4 text-sm">{emp.name}</td>
                          <td className="py-3 pr-4 text-sm">{emp.email}</td>
                          <td className="py-3 pr-4 text-sm">{emp.role}</td>
                          <td className="py-3 pr-4 text-sm">{emp.mobile}</td>
                          <td className="py-3 pr-4 flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setEditingEmployee(emp); setSelectedEmployee(emp); }} className="p-2 bg-white rounded shadow"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(emp); }} className="p-2 bg-white rounded shadow"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                      {!loading && !error && filtered.length === 0 && (
                        <tr><td colSpan={6} className="py-6 text-center text-gray-500">No employees</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list */}
                <div className="md:hidden">
                  {loading && <div className="py-6 text-center">Loading…</div>}
                  {error && <div className="py-6 text-center text-red-600">{error}</div>}
                  {!loading && !error && filtered.map(emp => (
                    <EmployeeCardMobile key={emp.userId || emp._id || emp.id} emp={emp} onEdit={(e) => { setEditingEmployee(e); setSelectedEmployee(e); }} onDelete={handleDelete} onOpen={handleSelectRow} />
                  ))}
                  {!loading && !error && filtered.length === 0 && (
                    <div className="py-6 text-center text-gray-500">No employees</div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <RolesPie employees={employees} />
            </div>
          </div>

          {/* Employee detail modal / drawer */}
          {selectedEmployee && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
              <div className="absolute inset-0 bg-black/30" onClick={() => { setSelectedEmployee(null); setEditingEmployee(null); }} />

              {/* modal panel: full-width on small screens */}
              <div className="relative w-full max-w-3xl md:rounded-lg bg-white shadow p-4 z-60 sm:mx-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{selectedEmployee.name}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSelectedEmployee(null); setEditingEmployee(null); }} className="px-3 py-1 bg-gray-100 rounded">Close</button>
                  </div>
                </div>

                <div className="mt-3">
                  {editingEmployee ? (
                    <EmployeeForm initial={editingEmployee} onCancel={() => setEditingEmployee(null)} onSubmit={handleSaveUpdate} />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-gray-500">Email</div>
                        <div className="font-medium break-words">{selectedEmployee.email}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Mobile</div>
                        <div className="font-medium">{selectedEmployee.mobile}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Role</div>
                        <div className="font-medium">{selectedEmployee.role}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Village ID</div>
                        <div className="font-medium">{selectedEmployee.villageId}</div>
                      </div>

                      {/* additional fields */}
                      <div className="col-span-2">
                        <div className="text-sm text-gray-500">Location</div>
                        <div className="font-medium">{[selectedEmployee.gramPanchayat, selectedEmployee.tehsil, selectedEmployee.district].filter(Boolean).join(" / ")}</div>
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2 mt-4">
                        <button onClick={() => setEditingEmployee(selectedEmployee)} className="px-4 py-2 bg-white rounded border">Edit</button>
                        <button onClick={() => handleDelete(selectedEmployee)} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ------------------------- Dashboard updated part -------------------------
  Replace (or ensure) the admin menu block in Dashboard.jsx contains the Employees navigation.
  This is the small snippet to replace the admin menu entries inside the adminOpen menu:

  <button
    role="menuitem"
    onClick={() => { setAdminOpen(false); navigate("/admin/employees"); }}
    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 focus:outline-none"
  >
    Employees
  </button>

  Integration notes remain the same.

--------------------------------------------------------------------------*/