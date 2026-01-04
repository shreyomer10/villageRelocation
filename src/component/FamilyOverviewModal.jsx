// src/components/FamilyOverviewModal.jsx
import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import { X, MapPin, Layers, User, CheckCircle, Circle } from "lucide-react";
import { API_BASE } from "../config/Api.js";
import { AuthContext } from "../context/AuthContext";
import DocsModal from "../component/DocsModal"; // assumed existing component
import { motion, AnimatePresence } from "framer-motion";

/**
 * FamilyOverviewModal
 *
 * Visual template based on TimelineOnly (horizontal stepper + filled connector),
 * but uses the existing timelineStages data-building logic from the FamilyOverview modal.
 *
 */

export default function FamilyOverviewModal({
  familyId,
  isOpen,
  onClose,
  onShowDetails,
  showSubstages = true,
}) {
  const { setSelectedFamilyId } = useContext(AuthContext) || {};
  const ctrlRef = useRef(null);
  const mountedRef = useRef(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [optionsList, setOptionsList] = useState([]);
  const [timelineStages, setTimelineStages] = useState([]);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsTab, setDocsTab] = useState("photos");

  // newly persisted option object for the current family (used when clicking a stage)
  const [currentOptionObj, setCurrentOptionObj] = useState(null);
  // selected stage to show small inline panel / popup after clicking circle
  const [selectedStageForPopup, setSelectedStageForPopup] = useState(null);

  // hover popup state for substages
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [popupHovered, setPopupHovered] = useState(false);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const closeModal = useCallback(() => {
    try {
      if (typeof setSelectedFamilyId === "function") setSelectedFamilyId(null);
    } catch (e) {}
    try {
      localStorage.removeItem("selectedFamilyId");
    } catch (e) {}
    try {
      onClose?.();
    } catch (e) {}
  }, [onClose, setSelectedFamilyId]);

  // persist selected family id when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const id = overview?.familyId ?? familyId ?? overview?._id ?? null;
    try {
      if (id && typeof setSelectedFamilyId === "function") setSelectedFamilyId(id);
    } catch (e) {}
    try {
      if (id != null) localStorage.setItem("selectedFamilyId", String(id));
    } catch (e) {}
    return () => {
      try {
        if (typeof setSelectedFamilyId === "function") setSelectedFamilyId(null);
      } catch (e) {}
      try {
        localStorage.removeItem("selectedFamilyId");
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, familyId, overview?.familyId]);

  useEffect(() => {
    if (!isOpen) return;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    let mounted = true;

    async function fetchOptions(signal) {
      const tries = [`${API_BASE}/option`, `${API_BASE}/options`, `${API_BASE}/option/list`, `${API_BASE}/stages`];
      for (const url of tries) {
        try {
          const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" }, signal });
          if (!res.ok) continue;
          const j = await res.json().catch(() => null);
          if (j && j.result && Array.isArray(j.result.items)) return j.result.items;
          if (j && j.result && Array.isArray(j.result)) return j.result;
          if (Array.isArray(j)) return j;
        } catch (e) {
          if (e.name === "AbortError") throw e;
          // next
        }
      }
      return [];
    }

    async function load() {
      setLoading(true);
      setError(null);
      setOverview(null);
      setOptionsList([]);
      setTimelineStages([]);
      setCurrentOptionObj(null);
      try {
        if (!familyId) throw new Error("No family id provided");

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

        // 1) options/stages
        const opts = await fetchOptions(ctrl.signal);
        if (!mounted) return;
        setOptionsList(opts || []);

        // 2) family
        const familyUrl = `${API_BASE}/families/${encodeURIComponent(familyId)}`;
        const familyResp = await fetch(familyUrl, { method: "GET", headers, signal: ctrl.signal });
        if (!familyResp.ok) {
          let msg = `Failed to fetch family (${familyResp.status})`;
          try {
            const j = await familyResp.json();
            if (j?.message) msg += `: ${j.message}`;
          } catch (e) {}
          throw new Error(msg);
        }
        const familyJson = await familyResp.json().catch(() => null);
        if (!mounted) return;
        const fam = (familyJson && familyJson.result) ? familyJson.result : familyJson;
        setOverview(fam || null);

        // build timelineStages using matched option
        const optionKey = fam?.relocationOption ?? fam?.relocation ?? null;
        const findCurrentOption = () => {
          if (!optionKey || !Array.isArray(opts)) return null;
          let cur = opts.find((o) => (o.optionId || o.optionid || "").toString() === (optionKey || "").toString());
          if (cur) return cur;
          cur = opts.find((o) => {
            if (o.optionId && String(optionKey).includes(String(o.optionId))) return true;
            if (o.name && String(optionKey).toLowerCase().includes(String(o.name).toLowerCase())) return true;
            return false;
          });
          return cur || null;
        };
        const optionObj = findCurrentOption();
        // persist optionObj so clicks can display it
        setCurrentOptionObj(optionObj || null);

        const completedSubs = new Set((fam?.completedSubstages ?? fam?.completedSubStages ?? fam?.completed_substages ?? fam?.stagesCompleted ?? []).map(s => String(s)));

        let built = [];
        if (optionObj && Array.isArray(optionObj.stages)) {
          built = (optionObj.stages || [])
            .filter(s => !s?.deleted)
            .slice()
            .sort((a, b) => {
              const pa = Number(a.position ?? 0) || 0;
              const pb = Number(b.position ?? 0) || 0;
              if (pa || pb) return pa - pb;
              return (a.stageId || a.stageid || "").localeCompare(b.stageId || b.stageid || "");
            })
            .map((stage, sIdx) => {
              const stageId = stage.stageId ?? stage.stageid ?? stage.id ?? stage._id ?? stage.name ?? `stage-${sIdx}`;
              const stageTitle = stage.name ?? stage.title ?? stage.stageName ?? stage.stageId ?? stageId;
              const rawSubstages = stage.subStages || stage.substages || stage.sub_stages || stage.items || [];

              const mappedSubstages = (Array.isArray(rawSubstages) ? rawSubstages : []).map((ss, idx) => {
                const ssId = ss.subStageId ?? ss.substageId ?? ss.id ?? ss._id ?? ss.name ?? `sub-${sIdx}-${idx}`;
                const ssTitle = ss.name ?? ss.title ?? ss.subStageName ?? ssId;
                const completed = completedSubs.has(String(ssId)) || completedSubs.has(String(ssTitle)) || false;
                return {
                  raw: ss,
                  id: String(ssId),
                  name: String(ssTitle),
                  completed,
                };
              });

              const stageCompleted = mappedSubstages.length > 0 ? mappedSubstages.every(s => s.completed) : completedSubs.has(String(stageId)) || false;

              return {
                raw: stage,
                id: String(stageId),
                name: String(stageTitle),
                stageId,
                title: String(stageTitle),
                position: Number(stage.position ?? 0) || 0,
                completed: stageCompleted,
                subStages: mappedSubstages,
              };
            });
        } else {
          // fallback: treat completedSubs flat
          built = Array.from(completedSubs).map((s, i) => ({
            id: s,
            name: String(s),
            title: String(s),
            position: i,
            completed: true,
            subStages: [],
            raw: {},
            stageId: s,
          }));
        }

        setTimelineStages(built);
      } catch (err) {
        if (!mounted) return;
        if (err.name === "AbortError") return;
        setError(err.message || "Unable to load family overview");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      try {
        ctrl.abort();
      } catch (e) {}
    };
  }, [isOpen, familyId, onShowDetails]);

  // --- Map helpers (new) ---
  // extract coords from an object using various common shapes
  function extractCoordsFromOverview(obj) {
    if (!obj) return null;

    // direct numeric fields
    const directLat = obj.latitude ?? obj.lat ?? obj.latitud ?? obj.mukhiyaLat ?? obj.mukhiyaLatitude ?? null;
    const directLng = obj.longitude ?? obj.lng ?? obj.lon ?? obj.long ?? obj.mukhiyaLng ?? obj.mukhiyaLongitude ?? null;
    if (directLat != null && directLng != null) {
      const latN = Number(directLat);
      const lngN = Number(directLng);
      if (!Number.isNaN(latN) && !Number.isNaN(lngN)) return { lat: latN, lng: lngN };
    }

    // nested location object: { location: { lat, lng } } or { location: { latitude, longitude } }
    if (obj.location && (obj.location.latitude != null || obj.location.lat != null)) {
      const latN = Number(obj.location.latitude ?? obj.location.lat);
      const lngN = Number(obj.location.longitude ?? obj.location.lng ?? obj.location.lon);
      if (!Number.isNaN(latN) && !Number.isNaN(lngN)) return { lat: latN, lng: lngN };
    }

    // GeoJSON style: { location: { coordinates: [lng, lat] } } or { coordinates: [lat, lng] }
    if (obj.location && Array.isArray(obj.location.coordinates) && obj.location.coordinates.length >= 2) {
      const [a, b] = obj.location.coordinates;
      // GeoJSON is [lng, lat]
      if (typeof a === "number" && typeof b === "number") return { lat: Number(b), lng: Number(a) };
    }
    if (Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
      const [a, b] = obj.coordinates;
      // accept either [lat, lng] or [lng, lat] — guess lat if within -90..90
      if (typeof a === "number" && typeof b === "number") {
        if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
        return { lat: b, lng: a };
      }
    }

    // sometimes location returned as { latLong: "lat,lng" } or similar
    const possibleString =
      obj.latlng ?? obj.latLong ?? obj.lat_long ?? obj.locationString ?? obj.location_str ?? obj.location_text ?? null;
    if (typeof possibleString === "string") {
      const parts = possibleString.split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const a = Number(parts[0]);
        const b = Number(parts[1]);
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
          // guess order
          if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
          return { lat: b, lng: a };
        }
      }
    }

    return null;
  }

  function openMaps(lat, lng) {
    const q = `${lat},${lng}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    // open in new tab safely
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      // fallback
      window.location.href = url;
    }
  }

  async function handleOpenMap(e) {
    // don't let parent click handlers fire
    try { e?.stopPropagation?.(); } catch (e) {}

    // try overview first
    const fromOverview = extractCoordsFromOverview(overview);
    if (fromOverview) {
      openMaps(fromOverview.lat, fromOverview.lng);
      return;
    }

    // fallback: try a small backend lookup for coordinates (adjust endpoints to match your API)
    if (!familyId) {
      setError("No family id available to fetch location.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };

      const tries = [
        `${API_BASE}/families/${encodeURIComponent(familyId)}/location`,
        `${API_BASE}/families/${encodeURIComponent(familyId)}/coords`,
        `${API_BASE}/families/${encodeURIComponent(familyId)}?fields=location`,
      ];

      let found = null;
      for (const url of tries) {
        try {
          const res = await fetch(url, { method: "GET", headers });
          if (!res.ok) continue;
          const j = await res.json().catch(() => null);
          const data = (j && j.result) ? j.result : j;
          const c = extractCoordsFromOverview(data);
          if (c) { found = c; break; }
        } catch (err) {
          // ignore and try next
        }
      }

      if (found) {
        openMaps(found.lat, found.lng);
      } else {
        setError("Location not available for this family.");
      }
    } catch (err) {
      setError("Unable to fetch location.");
    } finally {
      setLoading(false);
    }
  }
  // --- end Map helpers ---

  // derived fields
  const photo = overview?.mukhiyaPhoto || (overview?.photos && overview.photos[0]) || "/images/default-avatar.png";
  const familyName = overview?.mukhiyaName || overview?.headOfFamily || "Family";
  const idDisplay = familyId || (overview && (overview.familyId || overview._id || overview.id)) || "—";
  const currentStageProp = overview?.currentStage ?? overview?.current_stage ?? null;
  const currentSubStageProp = overview?.currentSubStage ?? overview?.current_substage ?? overview?.currentSubStageId ?? null;

  // determine completed and current index similar to earlier logic
  const lastCompletedIndex = (() => {
    if (!timelineStages || !timelineStages.length) return -1;
    let last = -1;
    timelineStages.forEach((s, i) => { if (s.completed) last = i; });
    return last;
  })();

  const currentIndex = (() => {
    if (!timelineStages || !timelineStages.length) return -1;
    const explicit = (() => {
      if (!currentStageProp) return -1;
      const cur = String(currentStageProp).toLowerCase();
      return timelineStages.findIndex(s =>
        String(s.stageId ?? "").toLowerCase() === cur ||
        String(s.name ?? "").toLowerCase() === cur ||
        String(s.position ?? "").toLowerCase() === cur ||
        (cur.includes("_") && String(s.stageId ?? "").toLowerCase().includes(cur))
      );
    })();
    if (explicit >= 0) return explicit;
    if (lastCompletedIndex >= timelineStages.length - 1) return lastCompletedIndex;
    return lastCompletedIndex + 1;
  })();

  const completedLinePercent = (() => {
    const len = timelineStages.length;
    if (!len) return 0;
    if (len === 1) return lastCompletedIndex >= 0 ? 100 : 0;
    const gaps = len - 1;
    const percent = gaps > 0 ? (lastCompletedIndex / gaps) * 100 : 0;
    return Math.max(0, Math.min(100, percent));
  })();

  // popup handlers
  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }
  function handleCircleEnter(idx) {
    if (!showSubstages) return;
    clearHideTimer();
    setHoveredIndex(idx);
  }
  function handleCircleLeave(idx) {
    if (!showSubstages) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!popupHovered) setHoveredIndex((h) => (h === idx ? null : h));
      hideTimerRef.current = null;
    }, 150);
  }
  function handlePopupEnter() {
    if (!showSubstages) return;
    clearHideTimer();
    setPopupHovered(true);
  }
  function handlePopupLeave() {
    if (!showSubstages) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setPopupHovered(false);
      setHoveredIndex(null);
      hideTimerRef.current = null;
    }, 150);
  }

  // handle a click on a stage circle (kept for reference but circles are now non-clickable)
  function onStageClick(stage, idx) {
    try {
      const timelineSelection = { stage, subStage: null };
      const payload = { familyId: idDisplay, timelineSelection };

      // call parent handler if provided (keeps existing behavior elsewhere)
      if (typeof onShowDetails === "function") {
        try { onShowDetails(payload); } catch (e) { /* swallow */ }
      }

      // show the relocation option (if available) in a small inline panel
      setSelectedStageForPopup({ stage, option: currentOptionObj || overview?.relocationOption || overview?.relocation });

    } catch (e) {}
  }
  function onSubClick(stage, sub) {
    try {
      const timelineSelection = { stage, subStage: sub };
      const payload = { familyId: idDisplay, timelineSelection };
      if (typeof onShowDetails === "function") {
        try { onShowDetails(payload); } catch (e) {}
      }
      setSelectedStageForPopup({ stage, sub, option: currentOptionObj || overview?.relocationOption || overview?.relocation });
    } catch (e) {}
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden={!isOpen}>
          <motion.div className="absolute inset-0 bg-black/50" onClick={closeModal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true" />

          <motion.div className="relative w-full max-w-3xl mx-auto bg-[#f8f0dc] rounded-2xl shadow-2xl border border-gray-100 overflow-hidden" role="dialog" aria-modal="true" initial={{ y: 24, opacity: 0, scale: 0.995 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 12, opacity: 0, scale: 0.995 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} style={{ maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenMap}
                  title="Open location in Google Maps"
                  className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-600 border border-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  <MapPin className="w-6 h-6 text-white" />
                </button>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{familyName}</h3>
                  <div className="text-xs text-gray-400">
                    {overview?.mukhiyaAge ? `${overview.mukhiyaAge} yrs` : ""} {overview?.mukhiyaHealth ? `• ${overview.mukhiyaHealth} ` : ""} • {overview?.relocationOption ?? "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={closeModal} aria-label="Close dialog" className="rounded-md p-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 overflow-auto" style={{ maxHeight: "70vh" }}>
              {/* Timeline area */}
              <div className="rounded-lg border p-4   border-gray-100 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-700">Stages Of Options</h4>
                    <div className="text-xs text-gray-400">
                      Current Substage: <span className="font-medium text-gray-800">{overview?.currentStage ?? "—"}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 flex items-center gap-4">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Completed</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border-2 border-blue-600 inline-block bg-white" /> Current</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border border-gray-300 inline-block bg-white" /> Upcoming</div>
                  </div>
                </div>

                <div className="mt-6">
                  {loading && <div className="text-sm text-gray-500">Loading timeline…</div>}
                  {error && <div className="text-sm text-red-500">Error: {error}</div>}
                  {!loading && !timelineStages.length && !error && (
                    <div className="text-sm text-gray-500">No timeline data available for this family.</div>
                  )}

                  {/* Horizontal template */}
                  {!loading && timelineStages.length > 0 && (
                    <div className="relative mb-2 ">
                      {/* base line */}
                      <div className="h-1 bg-gray-200 rounded-full w-full absolute" style={{ top: "32px", left: 0, right: 0, zIndex: 0 }} aria-hidden="true" />

                      {/* filled overlay */}
                      <div className="h-1 rounded-full absolute" style={{ top: "32px", left: 0, width: `${completedLinePercent}%`, backgroundColor: "#2563eb", zIndex: 1, transition: "width 240ms ease" }} aria-hidden="true" />

                      {/* steps */}
                      <div className="flex justify-between items-start relative z-10">
                        {timelineStages.map((stage, idx) => {
                          const isBefore = idx <= lastCompletedIndex - 0; // completed
                          const isCurrent = idx === currentIndex && !stage.completed;
                          const isCompleted = stage.completed || isBefore;
                          const circleClass = isCompleted
                            ? "bg-blue-600 text-white"
                            : isCurrent
                            ? "bg-white text-blue-600 border-2 border-blue-600 shadow-sm"
                            : "bg-white text-gray-400 border border-gray-300";

                          return (
                            <div key={stage.id ?? idx} className="flex flex-col items-center w-full max-w-[220px] relative" style={{ width: `${100 / Math.max(1, timelineStages.length)}%`, maxWidth: 220 }}>
                              <div className="h-16 flex items-center justify-center">
                                {/* Circle is now non-clickable: onClick is a no-op, removed navigation and made unfocusable */}
                                <button
                                  onMouseEnter={() => handleCircleEnter(idx)}
                                  onMouseLeave={() => handleCircleLeave(idx)}
                                  onClick={(e) => { e.stopPropagation(); }} // prevent any parent navigation / handlers
                                  title={stage.name}
                                  className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition ${circleClass}`}
                                  tabIndex={-1}
                                  aria-disabled="true"
                                >
                                  {isCompleted ? <CheckCircle className="w-5 h-5 text-white" /> : <span className={`font-semibold text-sm ${isCurrent ? "text-blue-600" : "text-gray-400"}`}>{idx + 1}</span>}
                                </button>
                              </div>

                              <div className={`mt-2 text-center text-sm truncate ${isCompleted || isCurrent ? "text-slate-800" : "text-gray-400"}`}>
                                {stage.name}
                              </div>

                              {/* substage popup */}
                              {hoveredIndex === idx && showSubstages && Array.isArray(stage.subStages) && stage.subStages.length > 0 && (
                                <div className="absolute left-1/2 -translate-x-1/2 top-[92px] z-50 w-64 rounded-lg shadow-lg p-2 text-sm" style={{ backgroundColor: "rgba(255,255,255,0.98)", border: "1px solid rgba(0,0,0,0.06)" }} onMouseEnter={handlePopupEnter} onMouseLeave={handlePopupLeave} role="dialog" aria-label={`Sub-stages for ${stage.name}`}>
                                  <div className="max-h-44 overflow-auto space-y-1 pr-2">
                                    {stage.subStages.map((ss, sidx) => {
                                      const completedSub = ss.completed ?? false;
                                      const itemClass = completedSub ? "bg-blue-50 text-blue-800 rounded px-2 py-1" : "bg-white text-gray-700 rounded px-2 py-1";
                                      return (
                                        <div key={String(ss.subStageId ?? ss.id ?? sidx)} className={`flex items-center justify-between ${itemClass}`} title={ss.name} onClick={(e) => { e.stopPropagation(); onSubClick(stage, ss); }} style={{ cursor: "pointer" }}>
                                          <div className="truncate text-xs">{ss.name}</div>
                                          <div className="text-xs text-gray-400">{completedSub ? "✓" : ""}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* mobile compact */}
                      <div className="mt-4 sm:hidden">
                        <div className="flex gap-4 overflow-x-auto pb-2">
                          {timelineStages.map((stage, idx) => {
                            const isBefore = idx <= lastCompletedIndex - 0;
                            const isCurrent = idx === currentIndex && !stage.completed;
                            const isCompleted = stage.completed || isBefore;
                            return (
                              <div key={stage.id ?? idx} className="flex-shrink-0 w-40">
                                {/* mobile item: make the visual circle non-clickable as well */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); }} // no navigation
                                  className="w-full text-left"
                                  tabIndex={-1}
                                  aria-disabled="true"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? "bg-blue-600" : "bg-white border border-gray-300"}`}>
                                      {isCompleted ? <CheckCircle className="w-4 h-4 text-white" /> : <span className={`text-sm ${isCurrent ? "text-blue-600" : "text-gray-400"}`}>{idx + 1}</span>}
                                    </div>
                                    <div>
                                      <div className="text-xs font-medium text-gray-700 truncate">{stage.name}</div>
                                      <div className="text-xs text-gray-400">{isCompleted ? "Completed" : (isCurrent ? "Current" : "Upcoming")}</div>
                                    </div>
                                  </div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* inline relocation option panel shown after clicking a circle */}
                  {selectedStageForPopup && (
                    <div className="mt-4 rounded-md p-3 border bg-white shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold">Relocation option</div>
                          <div className="text-xs text-gray-600 mt-1">{String(selectedStageForPopup?.option?.name ?? selectedStageForPopup?.option ?? "No option info available")}</div>
                          {selectedStageForPopup?.stage?.name && <div className="text-xs text-gray-500 mt-1">Clicked stage: <span className="font-medium text-gray-800">{selectedStageForPopup.stage.name}</span></div>}
                        </div>
                        <div className="text-xs">
                          <button onClick={() => setSelectedStageForPopup(null)} className="px-2 py-1 text-sm rounded border">Close</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* notes */}
              {overview?.notes && (
                <div className="rounded-md border border-gray-100 p-4 bg-gray-50 text-sm text-gray-700">
                  <p className="font-medium text-gray-800">Notes</p>
                  <p className="mt-2 whitespace-pre-line text-sm">{overview.notes}</p>
                </div>
              )}

              {/* members (2-column grid) */}
              <div className="ggap-2 bg-blue-100 px-1 py-1 rounded-lg border">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium">Members</div>
                    <div className="text-xs text-gray-400">{(overview?.members?.length ?? 0)} members</div>
                  </div>

                  {overview?.members?.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {overview.members.map((m, i) => (
                        <div key={`${m.name ?? m._id}-${i}`} className="flex items-center gap-4 bg-white rounded-xl p-3  border border-gray-100">
                          <img src={m.photo || "/images/default-avatar.png"} onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")} alt={m.name} className="w-14 h-14 rounded-full object-cover border" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{m.name || "—"}</div>
                            <div className="text-xs text-gray-500">{m.age ? `${m.age} yrs` : ""} {m.gender ? ` • ${m.gender}` : ""} {m.healthStatus ? ` • ${m.healthStatus}` : ""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No members information available.</div>
                  )}
                </div>
              </div>

              {/* actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3">
                <div className="flex flex-wrap gap-2">
                  <ActionChip onClick={() => onShowDetails?.(idDisplay)}>Options Updates</ActionChip>
                  {/* Merged View Photos + View Documents into single action */}
                  <ActionChip onClick={() => { setDocsTab("photos"); setDocsOpen(true); }}>View files</ActionChip>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Docs modal */}
          {docsOpen && (
            <DocsModal open={docsOpen} onClose={() => setDocsOpen(false)} photos={overview?.photos || [photo].filter(Boolean)} docs={overview?.docs || []} initialTab={docsTab} title={`${familyName} — Documents & Photos`} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Small subcomponents */
function InfoRow({ Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition">
      <div className="w-10 h-10 flex items-center justify-center rounded-md bg-blue-800 border border-white">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <dt className="text-xs text-gray-600 uppercase">{label}</dt>
        <dd className="text-sm font-medium text-gray-900">{value ?? "—"}</dd>
      </div>
    </div>
  );
}

function ActionChip({ children, onClick }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 bg-white hover:shadow hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-100">
      {children}
    </button>
  );
}
