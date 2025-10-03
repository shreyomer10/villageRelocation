import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import {
  ArrowLeft,
  Image,
  Users,
  FileText,
  Clock,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  File,
  FileText as FileIcon,
  CheckCircle,
  Clock as ClockIcon,
  XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../config/Api.js";

// FamilyDetailPage (updated updates UI, removed Edit/Export)
export default function FamilyDetailPage() {
  const { familyId } = useParams();
  const navigate = useNavigate();
  const mountedRef = useRef(false);

  const [family, setFamily] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [familyError, setFamilyError] = useState(null);

  const [updates, setUpdates] = useState({ familyUpdates: [], memberUpdates: [] });
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [updatesError, setUpdatesError] = useState(null);

  const [tab, setTab] = useState("overview"); // overview | members | updates | docs

  // update filters (for Updates tab)
  const [statusFilter, setStatusFilter] = useState("all"); // all, 1,2,3,4
  const [searchUpdates, setSearchUpdates] = useState("");
  const [expandedUpdate, setExpandedUpdate] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    const ctrl = new AbortController();

    async function loadFamily() {
      setFamilyLoading(true);
      setFamilyError(null);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" };

        const res = await fetch(`${API_BASE}/families/${encodeURIComponent(familyId)}`, {
          method: "GET",
          headers,
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Failed to fetch family (${res.status})`);
        }

        const data = await res.json();
        const doc = data.result ?? data; // accept either shape
        if (mountedRef.current) setFamily(doc);
      } catch (err) {
        if (err.name !== "AbortError" && mountedRef.current) setFamilyError(err.message || "Unable to load family");
      } finally {
        if (mountedRef.current) setFamilyLoading(false);
      }
    }

    async function loadUpdates() {
      setUpdatesLoading(true);
      setUpdatesError(null);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" };

        const res = await fetch(`${API_BASE}/families/${encodeURIComponent(familyId)}/updates`, {
          method: "GET",
          headers,
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Failed to fetch updates (${res.status})`);
        }

        const data = await res.json();
        if (mountedRef.current) setUpdates(data.result ?? data);
      } catch (err) {
        if (err.name !== "AbortError" && mountedRef.current) setUpdatesError(err.message || "Unable to load updates");
      } finally {
        if (mountedRef.current) setUpdatesLoading(false);
      }
    }

    loadFamily();
    loadUpdates();

    return () => {
      mountedRef.current = false;
      ctrl.abort();
    };
  }, [familyId]);

  function fmtDate(d) {
    try {
      if (!d) return "-";
      const dt = new Date(d);
      return dt.toLocaleString("en-IN");
    } catch (e) {
      return d;
    }
  }

  // prettier status mapping
  const statusMap = {
    1: { label: "Pending", color: "bg-yellow-50 text-yellow-800", dot: "bg-yellow-400" },
    2: { label: "In Review", color: "bg-blue-50 text-blue-800", dot: "bg-blue-500" },
    3: { label: "Approved", color: "bg-indigo-50 text-indigo-800", dot: "bg-indigo-600" },
    4: { label: "Verified", color: "bg-green-50 text-green-800", dot: "bg-green-600" },
  };

  // merge all family updates -> sort by verifiedAt desc (fallback to newest statusHistory time)
  const familyUpdatesSorted = useMemo(() => {
    const arr = Array.isArray(updates?.familyUpdates) ? [...updates.familyUpdates] : [];
    arr.sort((a, b) => {
      const ta = a.verifiedAt || (a.statusHistory && a.statusHistory.length ? a.statusHistory.slice(-1)[0]?.time : null) || "";
      const tb = b.verifiedAt || (b.statusHistory && b.statusHistory.length ? b.statusHistory.slice(-1)[0]?.time : null) || "";
      return String(tb).localeCompare(String(ta));
    });
    return arr;
  }, [updates]);

  // filtered based on search & status
  const filteredFamilyUpdates = useMemo(() => {
    const q = (searchUpdates || "").trim().toLowerCase();
    return familyUpdatesSorted.filter((u) => {
      if (statusFilter !== "all" && String(u.status) !== String(statusFilter)) return false;
      if (!q) return true;
      const hay = `${u.name ?? ""} ${u.notes ?? ""} ${u.updateId ?? ""} ${u.insertedBy ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [familyUpdatesSorted, searchUpdates, statusFilter]);

  // UI small components
  function StatusBadge({ status }) {
    if (!statusMap[status]) {
      return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">Unknown</span>;
    }
    const s = statusMap[status];
    return (
      <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full ${s.color} text-xs font-semibold`}>
        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  }

  function UpdateCard({ u, index }) {
    const isDeleted = !!u.deleted || !!u.delete;
    const docs = Array.isArray(u.docs) ? u.docs : [];
    const latestTime = u.verifiedAt || (u.statusHistory && u.statusHistory.length ? u.statusHistory.slice(-1)[0]?.time : null);
    const shortNotes = (u.notes || "").slice(0, 220);
    const expanded = expandedUpdate === u.updateId;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        className={`bg-white rounded-2xl p-4 shadow-sm border ${isDeleted ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDeleted ? "bg-red-50 border-red-200" : "bg-white"}`}>
                <FileText size={18} className={isDeleted ? "text-red-500" : "text-indigo-600"} />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-800 truncate">{u.name || "Update"}</h3>
                <div className="text-xs text-gray-500">{u.updateId}</div>
                {isDeleted && <span className="ml-2 px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded">Deleted</span>}
              </div>

              <div className="mt-2 text-sm text-gray-700">
                {u.notes ? (
                  <>
                    <div className={`${expanded ? "" : "line-clamp-4"}`}>{u.notes}</div>
                    {u.notes.length > 220 && (
                      <button
                        onClick={() => setExpandedUpdate(expanded ? null : u.updateId)}
                        className="mt-2 text-xs text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        {expanded ? (
                          <>
                            Show less <ChevronUp size={14} />
                          </>
                        ) : (
                          <>
                            Show more <ChevronDown size={14} />
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-500 italic">No notes provided</div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={u.status} />
                <div className="text-xs text-gray-500">Stage: <span className="font-medium">{u.currentStage ?? "—"}</span></div>
                <div className="text-xs text-gray-500">By: <span className="font-medium">{u.insertedBy ?? "—"}</span></div>
                <div className="text-xs text-gray-500">Verified: <span className="font-medium">{u.verifiedBy ?? "—"}</span></div>
                <div className="text-xs text-gray-400">• {fmtDate(latestTime)}</div>
              </div>

              {docs.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">Attachments</div>
                  <div className="flex gap-2 flex-wrap">
                    {docs.map((d, di) => (
                      <a
                        key={di}
                        href={d}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-2 py-1 border rounded-md text-xs hover:bg-gray-50"
                      >
                        <FileIcon size={14} /> <span className="truncate max-w-[12rem]">{d.split("/").slice(-1)[0]}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(latestTime)}</div>
        </div>

        {/* status history timeline (expandable) */}
        <div className="mt-4">
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 list-none">
              <ClockIcon size={14} /> View status history ({Array.isArray(u.statusHistory) ? u.statusHistory.length : 0})
              <span className="ml-2 text-xs text-gray-400 group-open:rotate-180 transition-transform"><ChevronDown size={14} /></span>
            </summary>

            <div className="mt-3 pl-3 border-l-2 border-gray-100">
              {Array.isArray(u.statusHistory) && u.statusHistory.length ? (
                <ol className="space-y-3 mt-3">
                  {u.statusHistory.map((sh, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                      </div>
                      <div className="flex-1 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-gray-800">
                            {sh.comments || "—"}
                          </div>
                          <div className="text-xs text-gray-400">{fmtDate(sh.time)}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">By: {sh.verifier ?? "—"} • Status: {statusMap[sh.status]?.label ?? sh.status}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="text-sm text-gray-500 mt-3">No status history</div>
              )}
            </div>
          </details>
        </div>
      </motion.div>
    );
  }

  // Reworked Updates tab rendering
  function renderUpdates() {
    if (updatesLoading) return <div className="py-8 text-center">Loading updates…</div>;
    if (updatesError) return <div className="text-red-600">{updatesError}</div>;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow">
          {/* Filter bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-gray-50">
                <Search size={16} />
                <input
                  value={searchUpdates}
                  onChange={(e) => setSearchUpdates(e.target.value)}
                  placeholder="Search updates (name, notes, updateId, insertedBy)"
                  className="bg-transparent text-sm outline-none min-w-[220px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Status</div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="all">All</option>
                  <option value="1">Pending</option>
                  <option value="2">In Review</option>
                  <option value="3">Approved</option>
                  <option value="4">Verified</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 mr-2">Total</div>
              <div className="px-2 py-1 rounded-md bg-gray-100 text-sm font-medium">{filteredFamilyUpdates.length}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredFamilyUpdates.length === 0 ? (
            <div className="text-sm text-gray-600 bg-white rounded-2xl p-6 shadow">No updates match your filters.</div>
          ) : (
            <AnimatePresence>
              {filteredFamilyUpdates.map((u, idx) => (
                <UpdateCard key={u.updateId ?? idx} u={u} index={idx} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    );
  }

  // Overview and Members kept same as before (no change)
  function renderOverview() {
    if (familyLoading) return <div className="py-8 text-center">Loading family…</div>;
    if (familyError) return <div className="text-red-600">{familyError}</div>;
    if (!family) return <div className="text-gray-700">No family data found.</div>;

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex gap-6 items-center">
            <img
              src={family.mukhiyaPhoto || "/images/default-avatar.png"}
              alt={family.mukhiyaName || "Mukhiya"}
              onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
              className="w-28 h-28 object-cover rounded-full border"
            />
            <div>
              <h2 className="text-2xl font-bold">{family.mukhiyaName || "—"}</h2>
              <p className="text-sm text-gray-600">Family ID: <span className="font-mono">{family.familyId}</span></p>
              <p className="text-sm text-gray-600">Village: {family.villageId || "—"}</p>
              <p className="text-sm text-gray-600">Relocation option: {family.relocationOption ?? "—"}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <h4 className="text-sm text-gray-500">Address</h4>
              <div className="text-base text-gray-800">{family.address || "—"}</div>
            </div>
            <div>
              <h4 className="text-sm text-gray-500">Contact</h4>
              <div className="text-base text-gray-800">{family.mobile || family.phone || "—"}</div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm text-gray-500">Current Stage</h4>
            <div className="inline-block mt-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{family.currentStage || "INIT"}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="font-semibold mb-2">Status History</h3>
          {Array.isArray(family.statusHistory) && family.statusHistory.length ? (
            <ol className="space-y-3">
              {family.statusHistory.map((s, i) => (
                <li key={i} className="border-l-2 pl-3">
                  <div className="text-sm font-medium">{s.status || "—"} <span className="text-xs text-gray-500 ml-2">{fmtDate(s.date)}</span></div>
                  {s.notes && <div className="text-sm text-gray-600">{s.notes}</div>}
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-sm text-gray-600">No status history available.</div>
          )}
        </div>
      </div>
    );
  }

  function renderMembers() {
    if (familyLoading) return <div className="py-8 text-center">Loading family members…</div>;
    if (familyError) return <div className="text-red-600">{familyError}</div>;
    const mems = Array.isArray(family?.members) ? family.members : [];
    if (!mems.length) return <div className="text-sm text-gray-600">No members recorded.</div>;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mems.map((m) => (
          <motion.div key={m._id ?? m.id ?? m.name} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-4 shadow">
            <div className="flex items-center gap-3">
              <img
                src={m.photo || "/images/default-avatar.png"}
                onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
                alt={m.name}
                className="w-14 h-14 rounded-full object-cover"
              />
              <div>
                <div className="font-semibold">{m.name || "—"}</div>
                <div className="text-sm text-gray-500">{m.gender || ""} • {m.age ?? "—"} yrs</div>
                <div className="text-xs text-gray-500 mt-1">Stage: <span className="font-medium">{m.currentStage || "—"}</span></div>
              </div>
            </div>

            {Array.isArray(m.updates) && m.updates.length > 0 && (
              <div className="mt-3 text-sm text-gray-600">
                <div className="text-xs text-gray-500">Latest member updates</div>
                <ul className="mt-1 list-disc list-inside max-h-28 overflow-auto">
                  {m.updates.slice(-3).map((u, idx) => (
                    <li key={idx} className="text-sm">{u.note ?? u.message ?? JSON.stringify(u)}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  }

  function renderDocs() {
    if (familyLoading) return <div className="py-8 text-center">Loading…</div>;
    const photos = Array.isArray(family?.photos) ? family.photos : [];
    const docs = Array.isArray(family?.docs) ? family.docs : [];

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Photos</h4>
            <div className="text-sm text-gray-500">{photos.length} found</div>
          </div>

          {photos.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
              {photos.map((p, i) => (
                <div key={i} className="rounded overflow-hidden border">
                  <img src={p} alt={`photo-${i}`} onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")} className="object-cover w-full h-40" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600 mt-3">No photos available.</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Documents</h4>
            <div className="text-sm text-gray-500">{docs.length} found</div>
          </div>

          {docs.length ? (
            <ul className="mt-3 space-y-2">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center gap-3">
                  <a className="text-sm text-indigo-600 underline" href={d} target="_blank" rel="noreferrer">Document {i + 1}</a>
                  <a href={d} download className="text-sm text-gray-500">(download)</a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600 mt-3">No documents available.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar village={family?.villageId} showInNavbar={true} />

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50">
              <ArrowLeft size={16} /> Back
            </button>
            <div>
              <h1 className="text-2xl font-bold">Family Details</h1>
              <div className="text-sm text-gray-600">{family?.mukhiyaName ?? "—"} • <span className="font-mono">{familyId}</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit & Export removed as requested */}
            <div className="text-sm text-gray-500">Last synced: <span className="font-mono">{family?.lastSync ? fmtDate(family.lastSync) : "—"}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: quick card + actions */}
          <aside className="col-span-1">
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="flex items-center gap-3">
                <img src={family?.mukhiyaPhoto || "/images/default-avatar.png"} onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")} className="w-20 h-20 rounded-full object-cover" alt="mukhiya" />
                <div>
                  <div className="font-semibold">{family?.mukhiyaName ?? "—"}</div>
                  <div className="text-xs text-gray-500">Family ID: <span className="font-mono">{family?.familyId}</span></div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div>Village: {family?.villageId ?? "—"}</div>
                <div>Option: {family?.relocationOption ?? "—"}</div>
                <div>Members: {Array.isArray(family?.members) ? family.members.length : 0}</div>
                <div>Stage: {family?.currentStage ?? "—"}</div>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => setTab("overview")} className={`flex-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${tab === "overview" ? "bg-green-50" : "bg-white"}`}><Users size={16} /> Overview</button>
                <button onClick={() => setTab("members")} className={`flex-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${tab === "members" ? "bg-green-50" : "bg-white"}`}><Image size={16} /> Members</button>
              </div>
            </div>

            <div className="mt-4 bg-white rounded-2xl p-4 shadow">
              <h4 className="font-semibold mb-2">Quick actions</h4>
              <div className="flex flex-col gap-2">
                <button onClick={() => setTab("updates")} className="w-full text-left px-3 py-2 rounded-lg border hover:bg-gray-50 inline-flex items-center gap-2"><FileText size={16} /> View updates</button>
                <button onClick={() => setTab("docs")} className="w-full text-left px-3 py-2 rounded-lg border hover:bg-gray-50 inline-flex items-center gap-2"><Image size={16} /> Photos & docs</button>
                <button onClick={() => window.print()} className="w-full text-left px-3 py-2 rounded-lg border hover:bg-gray-50 inline-flex items-center gap-2"><Clock size={16} /> Print</button>
              </div>
            </div>
          </aside>

          {/* Right column: tabbed content */}
          <section className="col-span-1 lg:col-span-2">
            <div className="bg-transparent">
              <div className="flex gap-3 items-center mb-4">
                <TabButton title="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
                <TabButton title={`Members (${Array.isArray(family?.members) ? family.members.length : 0})`} active={tab === "members"} onClick={() => setTab("members")} />
                <TabButton title={`Updates`} active={tab === "updates"} onClick={() => setTab("updates")} />
                <TabButton title={`Photos & Docs`} active={tab === "docs"} onClick={() => setTab("docs")} />
              </div>

              <motion.div layout className="min-h-[220px]">
                {tab === "overview" && renderOverview()}
                {tab === "members" && renderMembers()}
                {tab === "updates" && renderUpdates()}
                {tab === "docs" && renderDocs()}
              </motion.div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function TabButton({ title, active = false, onClick = () => {} }) {
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-lg ${active ? "bg-white shadow" : "bg-transparent hover:bg-white"}`}>
      <span className={`text-sm ${active ? "font-semibold" : "text-gray-600"}`}>{title}</span>
    </button>
  );
}
