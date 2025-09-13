// src/components/StageProgress.jsx
import React, { useState } from "react";
import { stageDefs } from "../config/stages";

/**
 * Props:
 * - showSubStage (boolean): whether hovering a stage shows sub-stages (default: false)
 * - showOnlyCurrentSubStage (boolean): when true, popup shows only the current sub-stage (default: false)
 * - currentStage (number): the active stage id/sequence (default: 0)
 * - currentSubStage (number?): the active sub-stage index (1-based) within the active stage (default: null)
 */
export default function StageProgress({
  showSubStage = false,
  showOnlyCurrentSubStage = false, // NEW
  currentStage = 0,
  currentSubStage = null,
}) {
  const [hoveredStage, setHoveredStage] = useState(null);

  const totalSteps = stageDefs.length || 1;

  // Calculate main progress percentage
  const progressPercent =
    currentStage <= 1
      ? 0
      : ((Math.min(currentStage, totalSteps) - 1) / (totalSteps - 1)) * 100;

  /** Determine sub-stage visual status */
  const getSubStatus = (stageSeq, subIndex) => {
    const completedStage = stageSeq < currentStage && currentStage > 0;
    const activeStage = stageSeq === currentStage;

    if (completedStage) return "completed";

    if (activeStage) {
      if (currentSubStage == null) return "upcoming";
      if (subIndex + 1 < currentSubStage) return "completed";
      if (subIndex + 1 === currentSubStage) return "current";
      return "upcoming";
    }

    return "upcoming"; // future stage
  };

  return (
    <div>
      {/* Progress bar */}
      <div className="relative mb-4">
        {/* Base background bar */}
        <div className="h-1 bg-gray-200 rounded-full w-full absolute top-5 left-0" />

        {/* Filled progress */}
        <div
          className="h-1 rounded-full absolute top-5 left-0 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%`, backgroundColor: "#16a34a" }}
        />

        {/* Stage circles */}
        <div className="flex justify-between items-start relative z-10 mt-2">
          {stageDefs.map((stage) => {
            const seq = stage.stage_id;
            const completed = seq < currentStage && currentStage > 0;
            const active = seq === currentStage;
            const isHovered = hoveredStage === seq;

            return (
              <div
                key={stage.stage_id}
                className="flex flex-col items-center w-full max-w-[110px] relative"
                onMouseEnter={() => showSubStage && setHoveredStage(seq)}
                onMouseLeave={() => showSubStage && setHoveredStage(null)}
              >
                {/* Stage Circle */}
                <div
                  className="flex items-center justify-center w-10 h-10 cursor-pointer"
                  aria-current={active ? "step" : undefined}
                  aria-label={`${stage.name} ${
                    completed ? "completed" : active ? "current" : "upcoming"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors duration-200 shadow-sm
                      ${
                        completed
                          ? "bg-green-600 text-white border-green-600"
                          : active
                          ? "bg-white text-green-700 border-green-600 shadow"
                          : "bg-white text-gray-400 border-gray-300"
                      }`}
                  >
                    {completed ? "✓" : seq}
                  </div>
                </div>

                {/* Stage Name */}
                <div className="text-center mt-2">
                  <div
                    className={`text-xs font-medium ${
                      completed || active ? "text-gray-800" : "text-gray-400"
                    }`}
                  >
                    {stage.name}
                  </div>
                </div>

                {/* Sub-stages on hover */}
                {showSubStage &&
                  isHovered &&
                  Array.isArray(stage.subStages) &&
                  stage.subStages.length > 0 && (
                    <div className="absolute top-14 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-48 z-50">
                      <ul className="space-y-1">
                        {/*
                          If showOnlyCurrentSubStage is true, filter subStages to only the one
                          whose getSubStatus(...) === "current". Otherwise show all.
                        */}
                        {(
                          showOnlyCurrentSubStage
                            ? stage.subStages.filter((_, idx) =>
                                getSubStatus(seq, idx) === "current"
                              )
                            : stage.subStages
                        ).map((sub, idx) => {
                          // Note: when we filtered, idx refers to index in original array if we didn't re-map indexes.
                          // To compute status reliably, find original index:
                          const originalIdx = stage.subStages.indexOf(sub);
                          const status = getSubStatus(seq, originalIdx);

                          return (
                            <li
                              key={`${seq}-${sub.id}`}
                              className={`text-xs p-1 rounded transition-colors duration-200 ${
                                status === "completed"
                                  ? "bg-blue-100 text-blue-700 font-medium"
                                  : status === "current"
                                  ? "bg-orange-300 text-orange-800 font-semibold"
                                  : "text-gray-600"
                              }`}
                            >
                              {sub.name}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
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
