import React from "react";
import { Calendar, CheckCircle, Clock, X } from "lucide-react";

// A clean, formal horizontal stepper modal for village relocation progress.
// - Stage descriptions are not shown on the progress bar (only stage headings below each step)
// - A filled progress line shows completion up to the current step
// - Accessible aria attributes and responsive layout

const stageDefs = [
  { stage_id: 1, name: "Gram Sabha Consent", description: "Initial consent", sequence_no: 1 },
  { stage_id: 2, name: "Diversion of Land", description: "Collect family consent", sequence_no: 2 },
  { stage_id: 3, name: "Budget & Eligibility", description: "Identify land", sequence_no: 3 },
  { stage_id: 4, name: "Option 1 execution", description: "Approve funds", sequence_no: 4 },
  { stage_id: 5, name: "Option 2 execution", description: "Handover", sequence_no: 5 },
];

export default function VillageModal({ open, onClose, village, loading, onOpenProfile }) {
  if (!open) return null;

  const statusToSequence = {
    "Gram Panchayat Meeting": 1,
    "Gram Sabha Meeting": 1,
    "Consent Collected": 2,
    "Relocation In progress": 4,
    "In progress": 3
  };

  const currentSequence =
    typeof village?.currentStage === "number"
      ? village.currentStage
      : typeof village?.sequence_no === "number"
      ? village.sequence_no
      : statusToSequence[village?.status] ?? 0;

  const totalSteps = stageDefs.length;

  // Progress percent: 0% when at 0 or 1, and 100% when at last step.
  const progressPercent =
    currentSequence <= 1
      ? 0
      : ((Math.min(currentSequence, totalSteps) - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-md hover:bg-gray-100"
          aria-label="Close"
        >
          <X />
        </button>

        {loading ? (
          <div className="py-12 text-center">Loading village details…</div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-1">{village?.name ?? "-"}</h2>
            <p className="text-sm text-gray-600 mb-6">
              Village ID: {village?.villageId ?? village?.village_id ?? "-"}
            </p>

            {/* Formal Stepper / Progress */}
            <div className="mb-6">
              <div className="relative">
                {/* base track */}
                <div className="h-1 bg-gray-200 rounded-full w-full absolute top-5 left-0" />

                {/* filled track */}
                <div
                  className="h-1 rounded-full absolute top-5 left-0 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%`, backgroundColor: "#16a34a" }}
                />

                {/* Steps */}
                <div className="flex justify-between items-start relative z-10 mt-2">
                  {stageDefs.map((stage) => {
                    const seq = stage.sequence_no;
                    const completed = seq < currentSequence && currentSequence > 0;
                    const active = seq === currentSequence;

                    return (
                      <div key={stage.stage_id} className="flex flex-col items-center w-full max-w-[80px]">
                        <div
                          className={`flex items-center justify-center rounded-full border-2 w-10 h-10 font-semibold shadow-sm transition-colors duration-200`
                          }
                          aria-current={active ? "step" : undefined}
                          aria-label={`${stage.name} ${completed ? 'completed' : active ? 'current' : 'upcoming'}`}
                        >
                          {/* circle appearance */}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ` +
                              (completed
                                ? "bg-green-600 text-white border-green-600"
                                : active
                                ? "bg-white text-green-700 border-green-600 shadow"
                                : "bg-white text-gray-400 border-gray-300")}
                          >
                            {completed ? "✓" : seq}
                          </div>
                        </div>

                        {/* Stage name below number - short and formal */}
                        <div className="text-center mt-2">
                          <div className={`text-xs font-medium ${completed || active ? 'text-gray-800' : 'text-gray-400'}`}>
                            {stage.name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Small legend beneath the progress for clarity */}
              <div className="mt-4 flex gap-4 items-center text-sm text-gray-600">
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

            {/* Info Section */}
            <div className="flex gap-6 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-sm font-medium">
                    {village?.status ??
                      (currentSequence > 0
                        ? stageDefs.find((s) => s.sequence_no === currentSequence)?.name ?? `Step ${currentSequence}`
                        : "N/A")}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-500">Last update</div>
                  <div className="text-sm font-medium">{village?.lastUpdatedOn ?? "-"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-500">Current Step</div>
                  <div className="text-sm font-medium">
                    {currentSequence > 0 ? `Step ${currentSequence}` : "Not started"}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              <p className="mt-2">
                <span className="font-medium">Area of relocation:</span> {village?.areaOfRelocation ?? "-"}
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={onClose}
              >
                Close
              </button>
              <button
                onClick={onOpenProfile}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                Open Profile
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
