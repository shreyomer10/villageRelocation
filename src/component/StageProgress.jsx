// src/components/StageProgress.jsx
import React, { useEffect, useState } from "react";

/**
 * StageProgress (updated)
 *
 * - Fetches stages from backend (GET /stages) and uses them instead of local stageDefs.
 * - Preserves props/behavior:
 *    showSubStage (boolean) - show sub-stage popup on hover
 *    showOnlyCurrentSubStage (boolean) - when true show only the current sub-stage in the popup
 *    currentStage (number|string) - active stage id/sequence
 *    currentSubStage (number|string|null) - active sub-stage index (1-based)
 *
 * The component is resilient to multiple response shapes:
 *  - { result: { items: [...] } }
 *  - { result: [...] }
 *  - { items: [...] }
 *  - [...]
 *
 * Each stage object is normalized to have:
 *  - stage_id (prefer existing id fields or fallback to index+1)
 *  - name
 *  - description
 *  - subStages: array of { id, name, ... }
 */

export default function StageProgress({
  showSubStage = false,
  showOnlyCurrentSubStage = false,
  currentStage = 0,
  currentSubStage = null,
}) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [hoveredStage, setHoveredStage] = useState(null);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch("https://villagerelocation.onrender.com/stages", {
          method: "GET",
          headers,
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Failed to fetch stages: ${res.status} ${txt}`);
        }
        const payload = await res.json();

        // Normalize various payload shapes into an array of stage items
        let items = [];
        if (payload?.result?.items && Array.isArray(payload.result.items)) items = payload.result.items;
        else if (Array.isArray(payload.result)) items = payload.result;
        else if (Array.isArray(payload.items)) items = payload.items;
        else if (Array.isArray(payload)) items = payload;
        else items = [];

        if (!mounted) return;

        const normalized = (items || []).map((s, idx) => {
          const rawId = s?.stage_id ?? s?.id ?? s?.stageId ?? s?.sequence_no ?? s?.sequence ?? null;
          const stageId = rawId != null && rawId !== "" ? rawId : idx + 1;
          // find substage list from common names
          const subCandidates =
            s?.subStages ?? s?.stages ?? s?.sub_stages ?? s?.steps ?? s?.children ?? s?.sub ?? s?.substages ?? [];
          const subStages = Array.isArray(subCandidates) ? subCandidates : [];

          return {
            __raw: s,
            stage_id: stageId,
            name: s?.name ?? s?.title ?? `Stage ${stageId}`,
            description: s?.description ?? s?.desc ?? s?.notes ?? "",
            subStages: subStages.map((ss, sidx) => ({
              id: ss?.id ?? ss?.sub_id ?? ss?.subStageId ?? sidx + 1,
              name: ss?.name ?? ss?.title ?? String(ss) ?? `Sub ${sidx + 1}`,
              ...ss,
            })),
            ...s,
          };
        });

        setStages(normalized);
      } catch (err) {
        if (err.name !== "AbortError") setLoadError(err.message || "Failed to load stages");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, []);

  // Helpers to map the "currentStage" (which may be an id) to an index in the fetched stages array.
  const findStageIndexById = (stageId) => {
    if (stages.length === 0) return -1;
    if (stageId == null) return -1;
    const sIdStr = String(stageId);
    const idx = stages.findIndex(
      (s) => String(s.stage_id) === sIdStr || String(s.id ?? "") === sIdStr || String(s.sequence_no ?? "") === sIdStr
    );
    return idx; // -1 if not found
  };

  const totalSteps = Math.max(1, stages.length);
  const activeIndex = findStageIndexById(currentStage); // -1 if not found
  // For progress percent we derive a 1-based "position"
  const activePos = activeIndex >= 0 ? activeIndex + 1 : Number(currentStage) || 0;

  const progressPercent =
    activePos <= 1 ? 0 : ((Math.min(activePos, totalSteps) - 1) / (totalSteps - 1)) * 100;

  // Determine status of a sub-stage (completed/current/upcoming) using stage position & currentSubStage
  const getSubStatus = (stagePosOneBased, subIndexZeroBased) => {
    const csPos = activePos; // 1-based position of active stage as integer (fallback to numeric currentStage)
    const csub = currentSubStage == null ? null : Number(currentSubStage);

    if (stagePosOneBased < csPos && csPos > 0) return "completed";
    if (stagePosOneBased === csPos) {
      if (csub == null) return "upcoming";
      if (subIndexZeroBased + 1 < csub) return "completed";
      if (subIndexZeroBased + 1 === csub) return "current";
      return "upcoming";
    }
    return "upcoming";
  };

  // Decide which sublist to render for a stage (either all or only current)
  const sublistForRender = (stageObj, stagePosOneBased) => {
    const subs = Array.isArray(stageObj.subStages) ? stageObj.subStages : [];
    if (!showOnlyCurrentSubStage) return subs;
    if (stagePosOneBased !== activePos) return [];
    if (currentSubStage == null) return [];
    const idx = Number(currentSubStage) - 1;
    if (idx >= 0 && idx < subs.length) return [subs[idx]];
    return [];
  };

  return (
    <div>
      {/* loading / error */}
      {loading && <div className="mb-2 text-sm text-gray-500">Loading stages…</div>}
      {loadError && <div className="mb-2 text-sm text-red-600">Error: {loadError}</div>}

      {/* progress bar */}
      <div className="relative mb-4">
        <div className="h-1 bg-gray-200 rounded-full w-full absolute top-5 left-0" />
        <div
          className="h-1 rounded-full absolute top-5 left-0 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%`, backgroundColor: "#16a34a" }}
        />

        <div className="flex justify-between items-start relative z-10 mt-2">
          {/* If no stages yet, render small placeholders */}
          {stages.length === 0
            ? Array.from({ length: 5 }).map((_, idx) => (
                <div key={`ph-${idx}`} className="flex flex-col items-center w-full max-w-[110px] relative">
                  <div className="flex items-center justify-center w-10 h-10">
                    <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
                  </div>
                  <div className="text-center mt-2">
                    <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))
            : stages.map((stage, idx) => {
                const stagePos = idx + 1; // 1-based position in the fetched array
                const isCompleted = stagePos < activePos && activePos > 0;
                const isActive = stagePos === activePos;
                const subStages = Array.isArray(stage.subStages) ? stage.subStages : [];

                return (
                  <div
                    key={`${String(stage.stage_id)}-${idx}`}
                    className="flex flex-col items-center w-full max-w-[110px] relative group"
                    onMouseEnter={() => showSubStage && setHoveredStage(stagePos)}
                    onMouseLeave={() => showSubStage && setHoveredStage((prev) => (prev === stagePos ? null : prev))}
                  >
                    {/* circle */}
                    <div
                      className="flex items-center justify-center w-10 h-10 cursor-default"
                      aria-current={isActive ? "step" : undefined}
                      aria-label={`${stage.name} ${isCompleted ? "completed" : isActive ? "current" : "upcoming"}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors duration-200 shadow-sm
                          ${
                            isCompleted
                              ? "bg-green-600 text-white border-green-600"
                              : isActive
                              ? "bg-white text-green-700 border-green-600 shadow"
                              : "bg-white text-gray-400 border-gray-300"
                          }`}
                      >
                        {isCompleted ? "✓" : String(stage.stage_id ?? stagePos)}
                      </div>
                    </div>

                    {/* stage name */}
                    <div className="text-center mt-2">
                      <div className={`text-xs font-medium ${isCompleted || isActive ? "text-gray-800" : "text-gray-400"}`}>
                        {stage.name}
                      </div>
                    </div>

                    {/* sub-stage popup (visible on hover) */}
                    {showSubStage && hoveredStage === stagePos && subStages.length > 0 && (
                      <div
                        className="absolute top-14 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-48 z-50"
                        style={{ left: "-6rem" }}
                        role="dialog"
                        aria-label={`${stage.name} sub-stages`}
                      >
                        <ul className="space-y-1">
                          {sublistForRender(stage, stagePos).map((sub, sidx) => {
                            // locate original index for status calculation
                            const originalIdx = subStages.findIndex((x) => String(x.id ?? x.sub_id ?? x.name) === String(sub.id ?? sub.sub_id ?? sub.name));
                            const status = getSubStatus(stagePos, originalIdx >= 0 ? originalIdx : sidx);
                            const key = String(sub.id ?? sub.sub_id ?? `${stagePos}-${sidx}`);
                            return (
                              <li
                                key={key}
                                className={`text-xs p-1 rounded transition-colors duration-150 ${
                                  status === "completed"
                                    ? "bg-blue-100 text-blue-700 font-medium"
                                    : status === "current"
                                    ? "bg-orange-300 text-orange-800 font-semibold"
                                    : "text-gray-600"
                                }`}
                              >
                                {sub.name ?? String(sub)}
                              </li>
                            );
                          })}
                          {sublistForRender(stage, stagePos).length === 0 && (
                            <li className="text-xs text-gray-400">No sub-stages</li>
                          )}
                        </ul>
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
          <span className="inline-block w-3 h-3 rounded-full bg-green-600" />
          Completed
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border border-green-600 bg-white" />
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
