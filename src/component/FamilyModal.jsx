// src/components/FamilyModal.jsx
import React from "react";
import { X } from "lucide-react";

export default function FamilyModal({
  familyDetails,
  familyLoading,
  familyError,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40">
      <div className="relative w-full max-w-4xl bg-transparent">
        <div className="rounded-3xl bg-white p-6 shadow-2xl border-2 border-gray-200">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 bg-white p-2 rounded-full shadow hover:bg-gray-50"
            aria-label="Close"
          >
            <X />
          </button>

          <div className="rounded-2xl border-2 border-gray-100 p-6 bg-white">
            {familyLoading ? (
              <div className="py-20 text-center text-gray-600">
                Loading family details…
              </div>
            ) : familyError ? (
              <div className="py-8 text-center text-red-600">{familyError}</div>
            ) : familyDetails ? (
              <div className="flex flex-col gap-6">
                {/* Top row */}
                <div className="flex gap-6 items-start">
                  {/* Left column */}
                  <div className="flex-1">
                    {/* Mukhiya */}
                    <div className="flex items-center gap-4 mb-6">
                      <img
                        src={
                          familyDetails.family?.mukhiyaPhoto ||
                          "/images/default-avatar.png"
                        }
                        onError={(e) =>
                          (e.currentTarget.src = "/images/default-avatar.png")
                        }
                        alt={familyDetails.family?.mukhiyaName || "Mukhiya"}
                        className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md"
                      />
                      <div>
                        <div className="text-xl font-bold">
                          {familyDetails.family?.mukhiyaName || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Age: {familyDetails.family?.age ?? "—"}
                        </div>
                        <div className="text-sm text-gray-600">
                          Health Status:{" "}
                          {familyDetails.family?.healthStatus ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Family ID: {familyDetails.family?.familyId}
                        </div>
                      </div>
                    </div>

                    {/* Members */}
                    <div className="grid grid-cols-3 gap-4">
                      {Array.isArray(familyDetails.members) &&
                      familyDetails.members.length > 0 ? (
                        familyDetails.members.slice(0, 6).map((m, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 bg-gray-50 p-3 rounded-md"
                          >
                            <img
                              src={m.photo || "/images/default-avatar.png"}
                              onError={(e) =>
                                (e.currentTarget.src =
                                  "/images/default-avatar.png")
                              }
                              alt={m.name || "Member"}
                              className="w-12 h-12 rounded-full object-cover border"
                            />
                            <div>
                              <div className="text-sm font-medium">
                                {m.name ?? m.memberName ?? "Member"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {m.age ? `${m.age} yrs` : ""}{" "}
                                {m.relation ? `• ${m.relation}` : ""}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">
                          No members listed.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right column - Geo image */}
                  <div className="w-1/3 min-w-[220px]">
                    <div className="text-md font-semibold mb-3">
                      Geo tagged Photos of Land Provided
                    </div>
                    <div className="w-full h-44 rounded-lg overflow-hidden shadow-inner border border-gray-100 bg-gray-100">
                      <img
                        src={
                          (Array.isArray(familyDetails.option1Housing) &&
                            (familyDetails.option1Housing[0]?.url ||
                              familyDetails.option1Housing[0]?.photo)) ||
                          "/images/default-land.png"
                        }
                        alt="geo"
                        className="w-full h-full object-cover"
                        onError={(e) =>
                          (e.currentTarget.src = "/images/default-land.png")
                        }
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Tap image to view full size
                    </div>
                  </div>
                </div>

                {/* Other details */}
                <div className="mt-4">
                  <div className="rounded-full bg-gray-50 border border-gray-200 py-8 px-6 text-center shadow-sm">
                    <div className="text-2xl font-bold text-gray-700">
                      other details
                    </div>
                    <div className="mt-3 text-sm text-gray-500">
                      Mukhiya ID: {familyDetails.family?.mukhiyaId ?? "—"} •
                      Created:{" "}
                      {familyDetails.family?.createdAt
                        ? new Date(
                            familyDetails.family.createdAt
                          ).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                No details to show.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
