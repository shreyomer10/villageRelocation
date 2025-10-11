// src/component/TimelineOnly.jsx
import React, { useEffect, useRef, useState } from "react";
import { API_BASE } from "../config/Api.js";

/**
 * TimelineOnly
 *
 * Props:
 *  - currentStage (string|number|null)
 *  - currentSubStage (string|number|null)
 *  - completedSubstages (array of strings)  // e.g. ["Stage_17_2", ...]
 *  - onStageSelect(stageObj, index)         // click callback (click does NOT change fill)
 *
 * Behavior:
 *  - Connector fills up to the current sub-stage (fractional).
 *  - Current stage: outlined blue circle (white interior).
 *  - Stages before current: filled blue circle with ✓.
 *  - If all stages completed: all circles filled blue with ✓.
 *  - Hover popup shows only sub-stage names; interactive and scrollable.
 */
export default function TimelineOnly({
  currentStage = null,
  currentSubStage = null,
  completedSubstages = [],
  onStageSelect = () => {},
}) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // hover state + interactive popup
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [popupHovered, setPopupHovered] = useState(false);
  const hideTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // helper normalizations
  const lcCompleted = Array.isArray(completedSubstages) ? completedSubstages.map((c) => String(c).toLowerCase()) : [];

  function isSubCompleted(sub) {
    if (!sub) return false;
    const sid = String(sub.subStageId ?? "").toLowerCase();
    const sname = String(sub.name ?? "").toLowerCase();
    return lcCompleted.some((c) => c === sid || c.includes(sid) || c.includes(sname));
  }

  function isStageCompleted(stage) {
    if (!stage) return false;
    const sid = String(stage.stageId ?? "").toLowerCase();
    if (lcCompleted.some((c) => c === sid || c.includes(sid))) return true;
    if (Array.isArray(stage.subStages) && stage.subStages.length > 0) {
      return stage.subStages.every((ss) => isSubCompleted(ss));
    }
    return false;
  }

  // find active stage index (by id/name/position)
  function findStageIndex(stageProp) {
    if (!stages || stages.length === 0 || stageProp == null) return -1;
    const cur = String(stageProp).toLowerCase();
    return stages.findIndex(
      (s) =>
        String(s.stageId).toLowerCase() === cur ||
        String(s.position) === cur ||
        String(s.name).toLowerCase() === cur ||
        (cur.includes("_") && String(s.stageId).toLowerCase().includes(cur))
    );
  }

  // find sub-index (0-based) inside a stage; accepts id or numeric
  function findSubIndexInStage(stageObj, subProp) {
    if (!stageObj || !Array.isArray(stageObj.subStages) || stageObj.subStages.length === 0) return -1;
    if (subProp == null) return -1;
    const subStr = String(subProp).toLowerCase();
    // match id exactly
    const byId = stageObj.subStages.findIndex((ss) => String(ss.subStageId ?? "").toLowerCase() === subStr);
    if (byId >= 0) return byId;
    // match by name fragment
    const byName = stageObj.subStages.findIndex((ss) => String(ss.name ?? "").toLowerCase().includes(subStr));
    if (byName >= 0) return byName;
    // try trailing number like "Stage_17_2"
    const numMatch = subStr.match(/(\d+)$/);
    if (numMatch) {
      const num = Number(numMatch[1]);
      if (!Number.isNaN(num) && num >= 1 && num <= stageObj.subStages.length) return num - 1;
    }
    // if numeric index string "2"
    const justNum = Number(subStr);
    if (!Number.isNaN(justNum) && justNum >= 1 && justNum <= stageObj.subStages.length) return justNum - 1;
    return -1;
  }

  // load stages from API
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/stages`, { method: "GET", headers, signal: ctrl.signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to fetch stages: ${res.status} ${txt}`);
        }
        const payload = await res.json();

        let items = [];
        if (payload?.result?.items && Array.isArray(payload.result.items)) items = payload.result.items;
        else if (Array.isArray(payload.result)) items = payload.result;
        else if (Array.isArray(payload.items)) items = payload.items;
        else if (Array.isArray(payload)) items = payload;

        const normalized = (items || []).map((s, idx) => {
          const stageId = s?.stageId ?? s?.stage_id ?? s?.id ?? `s-${idx + 1}`;
          const subs = s?.stages ?? s?.subStages ?? s?.sub_stages ?? s?.steps ?? [];
          const subStages = Array.isArray(subs)
            ? subs.map((ss, sidx) => ({
                name: ss?.name ?? ss?.title ?? `Sub ${sidx + 1}`,
                subStageId: ss?.subStageId ?? ss?.sub_stage_id ?? ss?.sub_id ?? ss?.id ?? `${stageId}_${sidx + 1}`,
                raw: ss,
              }))
            : [];
          return {
            name: s?.name ?? s?.title ?? `Stage ${stageId}`,
            desc: s?.desc ?? s?.description ?? "",
            stageId,
            position: s?.position ?? idx,
            subStages,
            raw: s,
          };
        });

        if (!mountedRef.current) return;
        setStages(normalized);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message || "Failed to load stages");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    load();
    return () => ctrl.abort();
  }, []);

  const allStagesCompleted = stages.length > 0 && stages.every((s) => isStageCompleted(s));

  // compute fractional progress source: prefer currentStage+currentSubStage, else fall back to highest completed
  function computeProgressFraction() {
    if (!stages || stages.length === 0) return -1;
    const activeStageIndex = findStageIndex(currentStage);
    if (activeStageIndex >= 0) {
      const stageObj = stages[activeStageIndex];
      if (stageObj && Array.isArray(stageObj.subStages) && stageObj.subStages.length > 0 && currentSubStage != null) {
        const subIdx = findSubIndexInStage(stageObj, currentSubStage); // 0-based
        if (subIdx >= 0) {
          const subCount = stageObj.subStages.length;
          const within = (subIdx + 1) / Math.max(1, subCount); // 0 < within <= 1
          return activeStageIndex + within;
        }
      }
      // no matching substage or none provided -> exact stage circle
      return activeStageIndex;
    }
    // fallback: highest completed stage index
    let last = -1;
    for (let i = 0; i < stages.length; i++) if (isStageCompleted(stages[i])) last = i;
    return last;
  }

  const progressSourceFraction = computeProgressFraction();
  const progressPercent =
    progressSourceFraction >= 0 && stages.length > 1 ? (progressSourceFraction / (stages.length - 1)) * 100 : 0;

  // hover handlers (small grace so popup remains interactive)
  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }
  function handleCircleEnter(idx) {
    clearHideTimer();
    setHoveredIndex(idx);
  }
  function handleCircleLeave(idx) {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!popupHovered) setHoveredIndex((h) => (h === idx ? null : h));
      hideTimerRef.current = null;
    }, 180);
  }
  function handlePopupEnter() {
    clearHideTimer();
    setPopupHovered(true);
  }
  function handlePopupLeave() {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setPopupHovered(false);
      setHoveredIndex(null);
      hideTimerRef.current = null;
    }, 180);
  }

  function handleClick(stage, idx) {
    try {
      onStageSelect(stage, idx);
    } catch (e) {
      // ignore
    }
  }

  // render
  return (
    <div>
      {loading && <div className="mb-2 text-sm text-gray-500">Loading timeline…</div>}
      {error && <div className="mb-2 text-sm text-red-600">Error: {error}</div>}

      <div className="relative mb-2">
        {/* base line */}
        <div className="h-1 bg-gray-200 rounded-full w-full absolute top-5 left-0" />

        {/* progress fill (up to current substage fraction) */}
        {stages.length > 0 && (
          <div
            className="h-1 rounded-full absolute top-5 left-0 transition-all duration-400 ease-out"
            style={{ width: `${progressPercent}%`, backgroundColor: "#2563eb" }}
          />
        )}

        <div className="flex justify-between items-start relative z-10 mt-2">
          {stages.length === 0
            ? Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex flex-col items-center w-full max-w-[110px] relative">
                  <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                  <div className="text-center mt-2">
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))
            : stages.map((stage, idx) => {
                const stageKey = stage.stageId ?? `s-${idx}`;
                const floorProgress = Math.floor(progressSourceFraction);
                const frac = progressSourceFraction - floorProgress;
                // stages strictly before floorProgress are filled
                const isBeforeProgress = idx < floorProgress;
                // current stage is the floor index (unless all completed)
                const isCurrent = !allStagesCompleted && idx === floorProgress;
                const isCompletedVisual = allStagesCompleted || isBeforeProgress;

                const buttonClass = isCompletedVisual
                  ? "bg-blue-600 text-white border-blue-600"
                  : isCurrent
                  ? "bg-white text-blue-600 border-2 border-blue-600 shadow"
                  : "bg-white text-gray-400 border border-gray-300";

                const containerDull = !isCompletedVisual && !isCurrent ? "opacity-75" : "";

                return (
                  <div
                    key={String(stageKey)}
                    className={`flex flex-col items-center w-full max-w-[220px] relative ${containerDull}`}
                    style={{ width: `${100 / Math.max(1, stages.length)}%`, maxWidth: 220 }}
                  >
                    <div className="h-12 flex items-center justify-center">
                      <button
                        onMouseEnter={() => handleCircleEnter(idx)}
                        onMouseLeave={() => handleCircleLeave(idx)}
                        onClick={() => handleClick(stage, idx)}
                        title={stage.name}
                        className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition ${buttonClass}`}
                        aria-pressed={isCurrent}
                      >
                        {isCompletedVisual ? "✓" : String(idx + 1)}
                      </button>
                    </div>

                    <div className={`mt-2 text-center text-sm truncate ${isCompletedVisual || isCurrent ? "text-slate-800" : "text-gray-400"}`}>
                      {stage.name}
                    </div>

                    {/* interactive substage popup */}
                    {hoveredIndex === idx && Array.isArray(stage.subStages) && stage.subStages.length > 0 && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 top-[84px] z-50 w-64 rounded-lg shadow-lg p-2 text-sm"
                        style={{ backgroundColor: "rgba(255,255,255,0.98)", border: "1px solid rgba(0,0,0,0.06)" }}
                        onMouseEnter={handlePopupEnter}
                        onMouseLeave={handlePopupLeave}
                        role="dialog"
                        aria-label={`Sub-stages for ${stage.name}`}
                      >
                        <div className="max-h-44 overflow-auto space-y-1 pr-2">
                          {stage.subStages.map((ss, sidx) => {
                            const completedSub = isSubCompleted(ss);
                            const isCurrentSub =
                              currentSubStage != null &&
                              (String(currentSubStage).toLowerCase() === String(ss.subStageId ?? "").toLowerCase() ||
                                String(currentSubStage).toLowerCase().includes(String(ss.subStageId ?? "").toLowerCase()) ||
                                findSubIndexInStage(stage, currentSubStage) === sidx);
                            const itemClass = completedSub ? "bg-blue-100 text-blue-800 rounded px-2 py-1" : "bg-white text-gray-700 rounded px-2 py-1";
                            return (
                              <div
                                key={String(ss.subStageId ?? sidx)}
                                className={`flex items-center justify-between ${itemClass}`}
                                title={ss.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
                                    onStageSelect && onStageSelect({ ...stage, selectedSub: ss }, idx);
                                  } catch {}
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                <div className={`truncate text-xs ${isCurrentSub ? "font-semibold" : ""}`}>{ss.name}</div>
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
      </div>

      {/* legend */}
      <div className="mt-4 flex gap-4 justify-center text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-600" />
          Completed
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border border-blue-600 bg-white" />
          Current
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border border-gray-300 bg-white" />
          Upcoming
        </div>
      </div>
    </div>
  );
}
