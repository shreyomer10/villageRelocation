// src/pages/MeetingsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";

// small helper icons inline (or replace with lucide-react)
const IconAdd = () => (<span className="font-bold">＋</span>);
const IconEdit = () => (<span className="text-sm">✎</span>);
const IconDelete = () => (<span className="text-sm">🗑</span>);
const IconBack = () => (<span className="text-lg">←</span>);
const IconFilter = () => (<span className="text-lg">⚙️</span>);

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch { return iso; }
}

export default function MeetingsPage() {
  const navigate = useNavigate();
  const { villageId: paramVillageId } = useParams(); // optional param
  const storedUserRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const currentUser = (() => {
    try {
      return storedUserRaw ? JSON.parse(storedUserRaw) : null;
    } catch { return null; }
  })();
  const currentUserName = currentUser?.name ?? currentUser?.username ?? null;

  const [villageIdState, setVillageIdState] = useState(paramVillageId ?? null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI filters & controls
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [showFilters, setShowFilters] = useState(false); // mobile filter toggle

  // Add/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // meeting object when editing

  // upload previews & lightbox
  const [lightboxImage, setLightboxImage] = useState(null);

  // refreshCounter used to trigger re-fetch after create/update/delete
  const [refreshCounter, setRefreshCounter] = useState(0);

  // try fallback for villageIdState from localStorage if param not provided
  useEffect(() => {
    if (!paramVillageId) {
      const lsId = typeof window !== "undefined" ? localStorage.getItem("villageId") : null;
      if (lsId) setVillageIdState(lsId);
    }
  }, [paramVillageId]);

  // fetch meetings (use ONLY GET /meetings/<villageId>)
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!villageIdState) {
          setMeetings([]);
          setLoading(false);
          return;
        }

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const base = "https://villagerelocation.onrender.com";
        const url = `${base}/meetings/${encodeURIComponent(villageIdState)}`;

        const res = await fetch(url, { method: "GET", headers });
        if (!res.ok) {
          // If 404 return empty list (server example returns 404 with error true)
          const bodyText = await res.text().catch(()=>"");
          throw new Error(`Failed to load meetings: ${res.status} ${res.statusText} ${bodyText}`);
        }
        const payload = await res.json();

        // API standard: { error: false, message: "...", result: [ ... ] }
        const rawList = Array.isArray(payload) ? payload : (Array.isArray(payload.result) ? payload.result : []);
        const list = Array.isArray(rawList) ? rawList : [];

        // Normalize meeting objects into the shape the UI expects
        const normalized = (list || []).map((m) => {
          const raw = m && m.raw ? m.raw : m;

          const id = raw.meetingId ?? raw.id ?? raw._id ?? Math.random().toString(36).slice(2,9);
          const heldBy = raw.heldBy ?? raw.held_by ?? raw.by ?? raw.organizer ?? "Unknown";
          const venue = raw.venue ?? raw.location ?? raw.site ?? "—";
          const time = raw.time ?? raw.datetime ?? raw.meetingTime ?? raw.date ?? null;
          const notes = raw.notes ?? raw.note ?? raw.description ?? "";
          const attendees = Array.isArray(raw.attendees) ? raw.attendees : (raw.attendees ? [raw.attendees] : []);
          const docs = Array.isArray(raw.docs) ? raw.docs : (raw.docs ? [raw.docs] : []);
          const photos = Array.isArray(raw.photos) ? raw.photos : (raw.photos ? [raw.photos] : []);
          const deleted = !!(raw.deleted || raw.isDeleted || raw.invalid || raw.removed);

          return {
            id,
            heldBy,
            venue,
            time,
            notes,
            attendees,
            docs,
            photos,
            deleted,
            raw,
          };
        });

        // sort by time desc (unknown times sorted last)
        normalized.sort((a, b) => {
          const at = a.time ? Date.parse(a.time) : NaN;
          const bt = b.time ? Date.parse(b.time) : NaN;
          if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
          if (Number.isNaN(at)) return 1;
          if (Number.isNaN(bt)) return -1;
          return bt - at;
        });

        if (!mounted) return;
        setMeetings(normalized);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || String(err));
        setMeetings([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [villageIdState, refreshCounter]);

  // Derived filtered list
  const filteredMeetings = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return meetings.filter((m) => {
      if (showOnlyMine && String(m.heldBy).toLowerCase() !== String(currentUserName).toLowerCase()) return false;
      if (!q) return true;
      // search heldBy or attendees
      if ((m.heldBy || "").toString().toLowerCase().includes(q)) return true;
      if (Array.isArray(m.attendees) && m.attendees.some((a) => (a || "").toString().toLowerCase().includes(q))) return true;
      return false;
    });
  }, [meetings, query, showOnlyMine, currentUserName]);

  // Analytics: pie by heldBy, bar by month, stat avg attendees
  const analytics = useMemo(() => {
    const byHeldBy = {};
    const byMonth = {}; // "YYYY-MM"
    let totalAttendees = 0, meetingCount = 0;
    filteredMeetings.forEach((m) => {
      if (m.deleted) return;
      const h = m.heldBy || "Unknown";
      byHeldBy[h] = (byHeldBy[h] || 0) + 1;

      const d = m.time ? new Date(m.time) : null;
      const monthKey = d && !Number.isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}` : "unknown";
      byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;

      totalAttendees += (Array.isArray(m.attendees) ? m.attendees.length : (m.attendees ? 1 : 0));
      meetingCount += 1;
    });

    const pieData = Object.entries(byHeldBy).map(([key, value]) => ({ name: key, value }));
    const barData = Object.entries(byMonth).map(([month, count]) => ({ month, count }))
      .sort((a,b) => a.month.localeCompare(b.month));

    const avgAttendees = meetingCount ? (totalAttendees / meetingCount) : 0;

    return { pieData, barData, avgAttendees, meetingCount };
  }, [filteredMeetings]);

  // colors for pie (repeat palette)
  const COLORS = ["#60a5fa", "#34d399", "#f59e0b", "#ef4444", "#a78bfa", "#f472b6", "#60a5fa"];

  // --- Row actions: edit/delete (only for meetings held by current user) ---
  async function handleDelete(meetingId) {
    if (!meetingId) return;
    if (!confirm("Delete this meeting? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

      // optimistic UI: mark deleted
      setMeetings((prev) => prev.map(m => m.id === meetingId ? { ...m, deleted: true } : m));

      const base = "https://villagerelocation.onrender.com";
      const url = `${base}/meetings/${encodeURIComponent(meetingId)}`;

      const body = { heldBy: currentUserName || "" };
      const res = await fetch(url, { method: "DELETE", headers, body: JSON.stringify(body) });

      if (!res.ok) {
        // revert optimistic by triggering a refresh
        throw new Error(`Delete failed: ${res.status} ${res.statusText}`);
      }

      // on success, increment refreshCounter to refetch list
      setRefreshCounter((s) => s + 1);
    } catch (err) {
      alert("Delete failed: " + (err.message || String(err)));
      // trigger refresh to revert optimistic UI
      setRefreshCounter((s) => s + 1);
    }
  }

  function openEdit(meeting) {
    setEditing(meeting);
    setShowModal(true);
  }

  function openAdd() {
    setEditing(null);
    setShowModal(true);
  }

  // Create/Update form submit
  async function saveMeeting(formData, files, photoPreviewsFromModal = []) {
    // formData: { venue, time, heldBy, notes, attendees: [] }
    // files: { photos: [File], docs: [File] } - BUT API expects photos/docs as URL strings.
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

      const base = "https://villagerelocation.onrender.com";

      const payload = {
        villageId: villageIdState || "",
        venue: formData.venue || "",
        time: formData.time || "",
        heldBy: formData.heldBy || "",
        notes: formData.notes || "",
        attendees: Array.isArray(formData.attendees) ? formData.attendees : [],
      };

      const photos = (photoPreviewsFromModal || []).filter(p => typeof p === "string");
      if (photos.length) payload.photos = photos;

      const docUrls = (formData.docs || []).filter(d => typeof d === "string" && /^https?:\/\//i.test(d));
      if (docUrls.length) payload.docs = docUrls;

      if (editing && editing.id) {
        const url = `${base}/meetings/${encodeURIComponent(editing.id)}`;
        const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify({ heldBy: payload.heldBy, venue: payload.venue, time: payload.time, notes: payload.notes, attendees: payload.attendees, photos: payload.photos, docs: payload.docs }) });
        if (!res.ok) {
          const txt = await res.text().catch(()=>"");
          throw new Error(`Update failed: ${res.status} ${res.statusText} ${txt}`);
        }
        setRefreshCounter((s) => s + 1);
        setShowModal(false);
        setEditing(null);
        return;
      } else {
        const url = `${base}/meetings/insert`;
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
        if (res.status !== 201 && !res.ok) {
          const txt = await res.text().catch(()=>"");
          throw new Error(`Insert failed: ${res.status} ${res.statusText} ${txt}`);
        }
        setRefreshCounter((s) => s + 1);
        setShowModal(false);
        setEditing(null);
        return;
      }
    } catch (err) {
      alert("Save failed: " + (err.message || String(err)));
      throw err;
    }
  }

  // --- Add/Edit Modal component (embedded) ---
  function MeetingModal({ onClose, initial }) {
    const init = initial || {
      venue: "",
      time: "",
      heldBy: currentUserName || "",
      notes: "",
      attendees: [],
      photos: [],
      docs: [],
    };

    const [venue, setVenue] = useState(init.venue || "");
    const [time, setTime] = useState(init.time ? new Date(init.time).toISOString().slice(0,16) : "");
    const [heldBy, setHeldBy] = useState(init.heldBy || (currentUserName || ""));
    const [notes, setNotes] = useState(init.notes || "");
    const [attendees, setAttendees] = useState(Array.isArray(init.attendees) ? [...init.attendees] : []);
    const [photoFiles, setPhotoFiles] = useState([]); // local File objects (not uploadable by current API)
    const [photoPreviews, setPhotoPreviews] = useState(init.photos ? [...init.photos] : []); // strings (URLs) or object URLs for preview
    const [docFiles, setDocFiles] = useState([]); // local files (not uploadable by API)
    const [docUrlsOrNames, setDocUrlsOrNames] = useState(init.docs ? [...init.docs] : []); // store initial docs which may be URLs

    function addAttendee(name) {
      if (!name) return;
      setAttendees((s) => [...s, name]);
    }
    function removeAttendee(idx) {
      setAttendees((s) => s.filter((_, i) => i !== idx));
    }

    function onPhotoChange(e) {
      const files = Array.from(e.target.files || []);
      setPhotoFiles((s) => [...s, ...files]);
      // local preview URLs for UI
      const urls = files.map((f) => URL.createObjectURL(f));
      setPhotoPreviews((s) => [...s, ...urls]);
    }
    function onDocChange(e) {
      const files = Array.from(e.target.files || []);
      setDocFiles((s) => [...s, ...files]);
      // For docs we store file names; if user wants server upload, implement it separately
      setDocUrlsOrNames((s) => [...s, ...files.map((f) => f.name)]);
    }

    function removePhotoPreview(idx) {
      setPhotoPreviews((s) => s.filter((_,i)=>i!==idx));
      setPhotoFiles((s) => s.filter((_,i)=>i!==idx));
    }
    function removeDoc(idx) {
      setDocUrlsOrNames((s) => s.filter((_,i)=>i!==idx));
      setDocFiles((s) => s.filter((_,i)=>i!==idx));
    }

    async function submit(e) {
      e.preventDefault();

      // prepare object
      const sendData = {
        venue,
        time: time ? new Date(time).toISOString().slice(0,16) : "",
        heldBy,
        notes,
        attendees,
        // docs we will pass only those that look like URLs; local file names won't be sent because API expects URLs
        docs: (docUrlsOrNames || []).filter(d => typeof d === "string" && /^https?:\/\//i.test(d)),
      };

      try {
        await saveMeeting(sendData, { photos: photoFiles, docs: docFiles }, photoPreviews);
      } catch (err) {
        // saveMeeting already shows alert
      }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
        <form onSubmit={submit} className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-5 md:p-6 overflow-auto max-h-[90vh]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500">Village</div>
              <div className="text-lg font-semibold">{villageIdState ?? "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2">
                <IconAdd /> Save
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Venue</label>
              <input value={venue} onChange={(e)=>setVenue(e.target.value)} className="w-full p-2 border rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Time</label>
              <input type="datetime-local" value={time} onChange={(e)=>setTime(e.target.value)} className="w-full p-2 border rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Held By</label>
              <input value={heldBy} onChange={(e)=>setHeldBy(e.target.value)} className="w-full p-2 border rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Attendees</label>
              <div className="mt-1">
                <div className="flex gap-2">
                  <input id="attendeeInput" placeholder="Name" className="flex-1 p-2 border rounded" />
                  <button type="button" onClick={()=>{
                    const el = document.getElementById("attendeeInput");
                    if (!el) return;
                    const value = el.value.trim();
                    if (!value) return;
                    addAttendee(value);
                    el.value = "";
                  }} className="px-3 py-2 bg-gray-100 rounded">+ Add</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {attendees.map((a,i)=>(
                    <div key={i} className="px-2 py-1 bg-gray-50 border rounded text-sm flex items-center gap-2">
                      <span>{a}</span>
                      <button type="button" onClick={()=>removeAttendee(i)} className="text-xs text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-600">Notes</label>
              <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="w-full p-2 border rounded mt-1 h-28" />
            </div>

            <div>
              <label className="text-xs text-gray-600">Photos (URLs preferred)</label>
              <input type="file" accept="image/*" onChange={onPhotoChange} multiple className="w-full mt-1" />
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {photoPreviews.map((p, idx) => (
                  <div key={idx} className="relative">
                    <img src={p} alt="preview" className="w-20 h-20 object-cover rounded cursor-pointer" onClick={() => setLightboxImage(p)} />
                    <button type="button" onClick={()=>removePhotoPreview(idx)} className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 text-xs shadow">✕</button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-1">If you need to upload local files, add a server endpoint to receive files and return hosted URLs; this form sends URLs only.</div>
            </div>

            <div>
              <label className="text-xs text-gray-600">Documents (URLs preferred)</label>
              <input type="file" onChange={onDocChange} multiple className="w-full mt-1" />
              <div className="mt-2 space-y-1">
                {docUrlsOrNames.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="text-sm truncate max-w-[200px]">{d}</div>
                    <button type="button" onClick={()=>removeDoc(idx)} className="text-xs text-red-500">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white font-sans">
      <MainNavbar village={villageIdState} showVillageInNavbar={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500">Village ID</div>
            <div className="text-2xl font-bold text-gray-800">{villageIdState ?? "—"}</div>
            <div className="text-sm text-gray-600 mt-1">Meetings</div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm hover:shadow-md"
            >
              <IconBack /> Back
            </button>

            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-2xl shadow hover:bg-blue-700"
              title="Add meeting"
            >
              <IconAdd /> Add Meeting
            </button>

            {/* mobile-only filter toggle */}
            <button onClick={()=>setShowFilters(s=>!s)} className="ml-2 inline-flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm md:hidden">
              <IconFilter /> Filters
            </button>
          </div>
        </div>

        {/* Filters + Analytics row */}
        <div className="grid grid-cols-12 gap-6">
          <div className={`col-span-12 lg:col-span-4 transition-all ${showFilters ? "" : "md:block"}`}>
            <div className={`bg-white rounded-2xl p-4 shadow border border-gray-100 ${showFilters ? "block" : "hidden md:block"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium">Filters</div>
                <div className="text-xs text-gray-400">{filteredMeetings.length} items</div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input id="onlyMine" type="checkbox" checked={showOnlyMine} onChange={() => setShowOnlyMine(v => !v)} />
                  <label htmlFor="onlyMine" className="text-sm">Show only my meetings</label>
                </div>

                <div>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by attendee or heldBy" className="w-full p-2 border rounded" />
                </div>

                {/* quick actions */}
                <div className="flex gap-2 pt-1">
                  <button onClick={()=>{ setQuery(""); setShowOnlyMine(false); }} className="px-3 py-2 bg-gray-100 rounded">Clear</button>
                  <button onClick={()=>{ setQuery(""); setShowOnlyMine(true); }} className="px-3 py-2 bg-blue-50 text-blue-700 rounded">My meetings</button>
                </div>
              </div>
            </div>

            {/* Analytics stat card */}
            <div className="mt-4 bg-white rounded-2xl p-4 shadow border border-gray-100">
              <div className="text-sm text-gray-500">Avg attendees</div>
              <div className="text-2xl font-semibold">{analytics.avgAttendees.toFixed(1)}</div>
              <div className="text-xs text-gray-400 mt-2">Based on {analytics.meetingCount} meetings (filtered)</div>
            </div>
          </div>

          {/* Charts */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                {/* Pie */}
                <div className="md:w-1/2 w-full flex flex-col items-center justify-center">
                  <div className="w-full">
                    <div className="text-sm mb-2 pl-1">Meetings by Held By</div>
                    <div className="w-full h-56 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            dataKey="value"
                            data={analytics.pieData}
                            outerRadius="80%"
                            innerRadius="45%"
                            labelLine={false}
                            paddingAngle={4}
                          >
                            {analytics.pieData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Pie>
                          <ReTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Bar */}
                <div className="md:w-1/2 w-full">
                  <div className="text-sm mb-2 pl-1">Monthly meetings</div>
                  <div className="w-full h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.barData} margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <ReTooltip />
                        <Legend verticalAlign="bottom" height={30} wrapperStyle={{ paddingTop: 8 }} />
                        <Bar dataKey="count" fill="#2563eb" barSize={36} radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* unified legend area under both charts for clarity */}
              <div className="mt-3 px-1 flex items-center justify-center text-xs text-gray-600">
                <div className="flex items-center gap-4 flex-wrap justify-center">
                  {analytics.pieData.slice(0,6).map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2">
                      <div style={{ width: 12, height: 12, background: COLORS[i % COLORS.length], borderRadius: 3 }} />
                      <div className="truncate max-w-[120px]">{p.name}</div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 ml-4">
                    <div style={{ width: 12, height: 12, background: "#111827", borderRadius: 2 }} />
                    <div>count</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meeting table */}
        <div className="mt-6 bg-white rounded-2xl p-4 shadow border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold">Meeting list</div>
            <div className="text-sm text-gray-500">{loading ? "Loading..." : `${filteredMeetings.length} meetings`}</div>
          </div>

          {error && <div className="text-sm text-red-500 mb-2">Error: {error}</div>}

          <div className="space-y-3">
            {filteredMeetings.map((m) => {
              const isMine = String(m.heldBy).toLowerCase() === String(currentUserName).toLowerCase();
              return (
                <div key={m.id} className={`border rounded-md overflow-hidden transition-shadow ${m.deleted ? "opacity-60 bg-red-50" : isMine ? "bg-blue-50" : "bg-white"}`}>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setExpandedRow(expandedRow === m.id ? null : m.id)}>
                    <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
                      <div className="text-sm font-medium truncate max-w-[140px]">{m.id}</div>
                      <div className="text-sm font-semibold truncate max-w-[160px]">{m.heldBy}</div>
                      <div className="text-sm text-gray-600 truncate max-w-[140px]">{m.venue}</div>
                      <div className="text-sm text-gray-600">{formatDateTime(m.time)}</div>
                      <div className="text-sm text-gray-600 max-w-xs truncate">{m.notes || "—"}</div>
                      <div className="text-sm text-gray-600">Attendees: {Array.isArray(m.attendees) ? m.attendees.length : 0}</div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 md:mt-0">
                      {m.photos && m.photos.length > 0 && (
                        <img src={m.photos[0]} alt="thumb" className="w-12 h-12 object-cover rounded cursor-pointer" onClick={(e)=>{ e.stopPropagation(); setLightboxImage(m.photos[0]); }} />
                      )}

                      {isMine && !m.deleted && (
                        <>
                          <button onClick={(e)=>{ e.stopPropagation(); openEdit(m); }} title="Edit meeting" className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">
                            <IconEdit />
                          </button>
                          <button onClick={(e)=>{ e.stopPropagation(); handleDelete(m.id); }} title="Delete meeting" className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">
                            <IconDelete />
                          </button>
                        </>
                      )}
                      <div className="text-xs text-gray-400">{expandedRow === m.id ? "−" : "+"}</div>
                    </div>
                  </div>

                  {expandedRow === m.id && (
                    <div className="p-4 border-t bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium mb-1">Notes</div>
                          <div className="text-sm text-gray-700 whitespace-pre-wrap">{m.notes || "No notes"}</div>

                          <div className="text-sm font-medium mt-4 mb-1">Attendees</div>
                          <ul className="list-disc pl-5">
                            {Array.isArray(m.attendees) && m.attendees.length > 0 ? (
                              m.attendees.map((a, idx) => <li key={idx} className="text-sm">{a}</li>)
                            ) : <li className="text-sm text-gray-500">No attendees listed</li>}
                          </ul>

                          <div className="text-sm font-medium mt-4 mb-1">Documents</div>
                          <div className="flex flex-col gap-2">
                            {Array.isArray(m.docs) && m.docs.length > 0 ? (
                              m.docs.map((d, idx) => (
                                <a key={idx} href={d} target="_blank" rel="noreferrer" className="text-sm underline text-blue-600 truncate max-w-[260px]">{d.split("/").pop() || `Doc ${idx+1}`}</a>
                              ))
                            ) : <div className="text-sm text-gray-500">No documents</div>}
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-2">Photos</div>
                          <div className="flex gap-2 flex-wrap">
                            {Array.isArray(m.photos) && m.photos.length > 0 ? (
                              m.photos.map((p, idx) => (
                                <img key={idx} src={p} alt={`photo-${idx}`} className="w-24 h-24 object-cover rounded cursor-pointer" onClick={()=>setLightboxImage(p)} />
                              ))
                            ) : <div className="text-sm text-gray-500">No photos</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredMeetings.length === 0 && !loading && (
              <div className="text-center text-gray-500 py-8">No meetings found. Click "Add Meeting" to create one.</div>
            )}
          </div>
        </div>
      </div>

      {/* lightbox for images */}
      {lightboxImage && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-80 flex items-center justify-center p-4" onClick={()=>setLightboxImage(null)}>
          <img src={lightboxImage} alt="lightbox" className="max-h-[85vh] rounded shadow-lg" />
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <MeetingModal
          initial={editing ? {
            ...editing,
            photos: editing.photos || [],
            docs: editing.docs || []
          } : null}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
