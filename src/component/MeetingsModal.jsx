import React, { useEffect, useState, useRef } from "react";

export default function MeetingsModal({ villageId, onClose }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectDropdown, setSelectDropdown] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [form, setForm] = useState({
    venue: "",
    time: "",
    attendeesText: "",
    heldBy: "",
    notes: "",
    photosText: "",
    docsText: "",
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => (mountedRef.current = false);
  }, []);

  // fetch meetings
  async function fetchMeetings(signal) {
    if (!villageId) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(
        `https://villagerelocation.onrender.com/meetings/${encodeURIComponent(villageId)}`,
        { method: "GET", headers, signal }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to load meetings: ${res.status} ${txt}`);
      }
      const payload = await res.json();
      if (!mountedRef.current) return;
      setMeetings(Array.isArray(payload.result) ? payload.result : []);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchMeetings(ctrl.signal);
    return () => ctrl.abort();
  }, [villageId]);

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
    setSelectedIds(new Set(meetings.map((m) => m.meetingId)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // delete single meeting
  async function deleteMeeting(meetingId) {
    if (!meetingId) return;
    if (!confirm(`Delete meeting ${meetingId}?`)) return;
    try {
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("user");
      let userName = "";
      try { userName = userRaw ? JSON.parse(userRaw).name ?? JSON.parse(userRaw).username ?? "" : ""; } catch { userName = ""; }

      const res = await fetch(
        `https://villagerelocation.onrender.com/meetings/${encodeURIComponent(meetingId)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ heldBy: userName || form.heldBy || "" }),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Delete failed: ${res.status} ${txt}`);
      }

      // refresh
      const ctrl = new AbortController();
      await fetchMeetings(ctrl.signal);
      clearSelection();
    } catch (err) {
      alert(err.message || "Delete failed");
    }
  }

  // bulk delete
  async function deleteSelected() {
    if (selectedIds.size === 0) {
      alert("No meetings selected");
      return;
    }
    if (!confirm(`Delete ${selectedIds.size} selected meeting(s)?`)) return;
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    let userName = "";
    try { userName = userRaw ? JSON.parse(userRaw).name ?? JSON.parse(userRaw).username ?? "" : ""; } catch { userName = ""; }

    for (const id of Array.from(selectedIds)) {
      try {
        // sequentially delete; could be parallel but keep simple
        const res = await fetch(
          `https://villagerelocation.onrender.com/meetings/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ heldBy: userName || form.heldBy || "" }),
          }
        );
        if (!res.ok) {
          const txt = await res.text();
          console.warn(`Failed to delete ${id}: ${res.status} ${txt}`);
        }
      } catch (err) {
        console.warn(`Failed to delete ${id}: ${err.message}`);
      }
    }

    // refresh
    const ctrl = new AbortController();
    await fetchMeetings(ctrl.signal);
    clearSelection();
  }

  // delete all for village
  async function deleteAllForVillage() {
    if (!confirm("Delete ALL meetings for this village? This cannot be undone.")) return;
    // Delete all by iterating over meetings
    setSelectedIds(new Set(meetings.map((m) => m.meetingId)));
    await deleteSelected();
  }

  // add meeting
  async function submitAdd(e) {
    e.preventDefault();
    // basic validation
    if (!form.villageId && !villageId) {
      alert("Missing villageId");
      return;
    }
    const payload = {
      villageId: villageId,
      venue: form.venue,
      time: form.time,
      attendees: form.attendeesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      heldBy: form.heldBy || (JSON.parse(localStorage.getItem("user") || "{}").name ?? ""),
      notes: form.notes,
      photos: form.photosText.split(",").map((s) => s.trim()).filter(Boolean),
      docs: form.docsText.split(",").map((s) => s.trim()).filter(Boolean),
    };

    // time validation (expect YYYY-MM-DDTHH:MM)
    if (form.time && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.time)) {
      alert("Time must be in YYYY-MM-DDTHH:MM format. Use the picker or type like 2025-09-20T15:30");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://villagerelocation.onrender.com/meetings/insert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Add failed: ${res.status} ${txt}`);
      }

      // success
      setShowAddForm(false);
      setForm({ venue: "", time: "", attendeesText: "", heldBy: "", notes: "", photosText: "", docsText: "" });
      const ctrl = new AbortController();
      await fetchMeetings(ctrl.signal);
    } catch (err) {
      alert(err.message || "Failed to add meeting");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg overflow-auto max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Meetings for {villageId}</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => { setShowAddForm((s) => !s); setSelectMode(false); }}
                className="px-3 py-1 rounded bg-green-100 hover:bg-green-200 text-sm"
              >
                Add
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => { setSelectMode((s) => !s); setSelectDropdown((s) => !s); }}
                className={`px-3 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-sm ${selectMode ? "ring-2 ring-indigo-200" : ""}`}
              >
                Select
              </button>
              {selectDropdown && (
                <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow p-2">
                  <button onClick={() => { selectAll(); setSelectDropdown(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm">Select all</button>
                  <button onClick={() => { deleteSelected(); setSelectDropdown(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-red-600">Delete selected</button>
                  <button onClick={() => { deleteAllForVillage(); setSelectDropdown(false); }} className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-red-700">Delete all</button>
                </div>
              )}
            </div>

            <button onClick={onClose} className="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-sm">Close</button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {showAddForm && (
            <form onSubmit={submitAdd} className="bg-gray-50 p-3 rounded">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="p-2 border rounded" placeholder="Venue" value={form.venue} onChange={(e)=>setForm({...form,venue:e.target.value})} />
                <input type="datetime-local" className="p-2 border rounded" value={form.time} onChange={(e)=>setForm({...form,time:e.target.value})} />
                <input className="p-2 border rounded" placeholder="Held by" value={form.heldBy} onChange={(e)=>setForm({...form,heldBy:e.target.value})} />
                <input className="p-2 border rounded" placeholder="Attendees (comma separated)" value={form.attendeesText} onChange={(e)=>setForm({...form,attendeesText:e.target.value})} />
                <input className="p-2 border rounded col-span-2" placeholder="Photos (comma separated URLs)" value={form.photosText} onChange={(e)=>setForm({...form,photosText:e.target.value})} />
                <input className="p-2 border rounded col-span-2" placeholder="Docs (comma separated URLs)" value={form.docsText} onChange={(e)=>setForm({...form,docsText:e.target.value})} />
                <textarea className="p-2 border rounded col-span-2" placeholder="Notes" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
                <button type="button" onClick={()=>setShowAddForm(false)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
              </div>
            </form>
          )}

          <div>
            {loading ? (
              <div className="text-sm text-gray-500">Loading meetingsâ€¦</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : meetings.length === 0 ? (
              <div className="text-sm text-gray-500">No meetings found.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {meetings.map((m) => (
                  <div key={m.meetingId} className="border rounded p-3 flex gap-3 items-start">
                    {selectMode && (
                      <input type="checkbox" checked={selectedIds.has(m.meetingId)} onChange={() => toggleSelect(m.meetingId)} className="mt-1" />
                    )}

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{m.venue ?? "â€”"}</div>
                          <div className="text-xs text-gray-500">{m.meetingId}</div>
                        </div>

                        <div className="text-right text-sm text-gray-600">
                          <div>{m.time ? new Date(m.time).toLocaleString() : "â€”"}</div>
                          <div className="text-xs">Held by: {m.heldBy ?? "â€”"}</div>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-gray-700">{m.notes ?? "â€”"}</div>

                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <div>Attendees: {(Array.isArray(m.attendees) ? m.attendees.length : (m.attendees ? String(m.attendees).split(',').length : 0))}</div>
                        {Array.isArray(m.photos) && m.photos.length > 0 && <div>Photos: {m.photos.length}</div>}
                        {Array.isArray(m.docs) && m.docs.length > 0 && <div>Docs: {m.docs.length}</div>}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={()=>openMeetingInNewTab(m.meetingId, m)} className="px-3 py-1 text-sm rounded bg-gray-100">Open</button>
                        <button onClick={()=>deleteMeeting(m.meetingId)} className="px-3 py-1 text-sm rounded bg-red-50 text-red-600">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // helper to open meeting in new tab (for viewing details or documents)
  function openMeetingInNewTab(meetingId, meeting) {
    // Create a small details page URL, or simply open the first doc if present
    if (Array.isArray(meeting.docs) && meeting.docs.length > 0) {
      window.open(meeting.docs[0], "_blank", "noopener");
      return;
    }
    // otherwise open a new blank tab with JSON of meeting (as a fallback)
    const w = window.open("", "_blank");
    if (w) {
      w.document.title = `Meeting ${meetingId}`;
      const pre = w.document.createElement("pre");
      pre.textContent = JSON.stringify(meeting, null, 2);
      w.document.body.appendChild(pre);
    }
  }
}
