import React, { useState } from "react";

export default function StageProgress({ stages = [], currentStage = 0 }) {
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

      {/* Progress Tracker */}
      <div className="relative max-w-4xl mx-auto px-4">
        {/* base track */}
        <div className="h-1 bg-gray-200 rounded-full w-full absolute left-0 top-6" />

        {/* filled track */}
        <div
          className="h-1 rounded-full absolute left-0 top-6 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%`, backgroundColor: "#16a34a" }}
        />

        {/* steps */}
        <div className="flex justify-between items-start relative z-10 mt-2">
          {stages.map((stage, idx) => {
            const isCompleted = stage.sequence_no < currentStage && currentStage > 0;
            const isActive = stage.sequence_no === currentStage;

            return (
              <div
                key={stage.stage_id ?? idx}
                onClick={() => setSelectedStage(stage)}
                className="flex flex-col items-center w-full max-w-[120px] cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedStage(stage)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${stage.name} ${isCompleted ? 'completed' : isActive ? 'current' : 'upcoming'}`}
              >
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-colors duration-200 shadow-sm ` +
                    (isCompleted
                      ? "bg-green-600 text-white border-green-600"
                      : isActive
                      ? "bg-white text-green-700 border-2 border-green-600 shadow"
                      : "bg-white text-gray-400 border-2 border-gray-200")}
                  >
                    {isCompleted ? "✓" : stage.sequence_no}
                  </div>
                </div>

                <p className={`text-xs mt-2 font-medium text-center ${isCompleted || isActive ? 'text-gray-800' : 'text-gray-500'}`}>
                  {stage.name}
                </p>
              </div>
            );
          })}
        </div>

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
      </div>

      {/* Current Stage Info */}
      <div className="text-center mt-6 font-medium">
        Current Stage: {stages.find((s) => s.sequence_no === currentStage)?.name ?? `Step ${currentStage}`}
      </div>
      <p className="text-xs text-center text-gray-500 mt-2">Click on a stage to view details</p>

      {/* Modal */}
      {selectedStage && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-11/12 sm:w-96 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSelectedStage(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-4">{selectedStage.name}</h2>
            <p className="text-sm text-gray-600 mb-4">{selectedStage.description}</p>
            <div className="space-y-2">
              {(selectedStage.files || []).length === 0 && (
                <div className="text-xs text-gray-500">No supporting files available.</div>
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

