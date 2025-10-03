import React, { useState } from "react";
import StageProgress from "./StageProgress"; // âœ… Import the component

export default function RelocationTracker({ stages = [] }) {
  const [currentStage, setCurrentStage] = useState(1);       // Active main stage
  const [currentSubStage, setCurrentSubStage] = useState(1); // Active sub-stage within current stage
  const [selectedStage, setSelectedStage] = useState(null);

  const totalSteps = stages.length || 1;
  const progressPercent =
    currentStage <= 1
      ? 0
      : ((Math.min(currentStage, totalSteps) - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg">
      <h3 className="text-lg font-semibold text-gray-700 text-center mb-6">
        Stages Of Relocation
      </h3>

      {/* âœ… StageProgress with Sub-Stage Dropdown Enabled */}
      <StageProgress
        currentStage={currentStage}
        currentSubStage={currentSubStage}
        showSubStage={true} // <-- ENABLE sub-stage dropdown
      />

      {/* Legend */}
      <div className="mt-5 flex gap-4 items-center text-sm text-gray-600 justify-center">
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

      {/* Current Stage Info */}
      <div className="text-center mt-6 font-medium">
        Current Stage:{" "}
        {stages.find((s) => s.sequence_no === currentStage)?.name ??
          `Step ${currentStage}`}
      </div>
      <p className="text-xs text-center text-gray-500 mt-2">
        Click on a stage to view details
      </p>

      {/* Modal */}
      {selectedStage && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-11/12 sm:w-96 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSelectedStage(null)}
              aria-label="Close"
            >
              âœ•
            </button>
            <h2 className="text-lg font-semibold mb-4">
              {selectedStage.name}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {selectedStage.description}
            </p>
            <div className="space-y-2">
              {(selectedStage.files || []).length === 0 && (
                <div className="text-xs text-gray-500">
                  No supporting files available.
                </div>
              )}
              {(selectedStage.files || []).map((file, index) => (
                <a
                  key={index}
                  href={file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:underline text-sm"
                >
                  View File {index + 1}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
