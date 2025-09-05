// File: src/components/VillageOverview.jsx
import React from "react";
import { X, CheckCircle, Calendar, Clock } from "lucide-react";

export default function VillageOverview({ open, onClose, village = {}, loading = false, onOpenProfile, stageDefs = [] }) {
  if (!open) return null;

  const statusToSequence = {
    "Gram Panchayat Meeting": 1,
    "Gram Sabha Meeting": 1,
    "Consent Collected": 2,
    "Relocation In progress": 4,
    "In progress": 3,
    "Not done yet": 0,
    "N/A": 0,
  };

  const currentSequence =
    typeof village?.currentStage === "number"
      ? village.currentStage
      : typeof village?.sequence_no === "number"
      ? village.sequence_no
      : statusToSequence[village?.status] ?? 0;

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
            <p className="text-sm text-gray-600 mb-6">Village ID: {village?.villageId ?? village?.village_id ?? "-"}</p>

            <div className="mb-6">
              {/* Stage Progress Bar */}
              <div className="relative w-full">
                <div className="flex justify-between items-center relative z-10">
                  {stageDefs.map((stage) => {
                    const seq = stage.sequence_no;
                    const completed = seq < currentSequence && currentSequence > 0;
                    const active = seq === currentSequence;

                    return (
                      <div key={stage.stage_id} className="flex flex-col items-center w-full">
                        <div
                          className={`w-10 h-10 flex items-center justify-center rounded-full border-2 font-semibold
                            ${completed ? "bg-green-500 border-green-500 text-white" : ""}
                            ${active ? "bg-white border-green-500 text-green-600" : ""}
                            ${!completed && !active ? "bg-white border-gray-300 text-gray-400" : ""}
                          `}
                        >
                          {completed ? "✓" : seq}
                        </div>
                        <p
                          className={`text-xs mt-2 font-medium text-center ${
                            completed || active ? "text-green-700" : "text-gray-400"
                          }`}
                        >
                          {stage.name}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="absolute top-5 left-0 w-full flex justify-between px-5">
                  {stageDefs.slice(0, -1).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-0.5 flex-1 mx-1 ${
                        stageDefs[idx].sequence_no < currentSequence ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-6 mb-4">
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
                  <div className="text-sm font-medium">{village?.lastUpdatedOn ?? village?.lastUpdatedOn ?? "-"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-500">Current Step</div>
                  <div className="text-sm font-medium">{currentSequence > 0 ? `Step ${currentSequence}` : "Not started"}</div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              <p>
                <span className="font-medium">Notes:</span> This area can show extra details pulled from backend (contact person, progress %, next action items, docs, etc.).
              </p>
              <p className="mt-2">
                <span className="font-medium">Area of relocation:</span> {village?.areaOfRelocation ?? village?.area_of_relocation ?? "-"}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50" onClick={onClose}>
                Close
              </button>
              <button onClick={onOpenProfile} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
                Open Profile
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// File: src/pages/Dashboard.jsx
