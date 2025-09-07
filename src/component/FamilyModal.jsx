// src/components/FamilyModal.jsx
import React from "react";
import { X } from "lucide-react";

export default function FamilyModal({
  familyDetails,
  familyLoading,
  familyError,
  onClose,
}) {
  // Helper function to format currency
  const formatCurrency = (amount) => {
    if (!amount) return "₹0";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40">
      <div className="relative w-full max-w-4xl bg-transparent max-h-[90vh] overflow-y-auto">
        <div className="rounded-3xl bg-white p-6 shadow-2xl border-2 border-gray-200">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 bg-white p-2 rounded-full shadow hover:bg-gray-50 z-10"
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
                          familyDetails.mukhiyaPhoto ||
                          "/images/default-avatar.png"
                        }
                        onError={(e) =>
                          (e.currentTarget.src = "/images/default-avatar.png")
                        }
                        alt={familyDetails.mukhiyaName || "Mukhiya"}
                        className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md"
                      />
                      <div>
                        <div className="text-xl font-bold">
                          {familyDetails.mukhiyaName || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Age: {familyDetails.mukhiyaAge ?? "—"}
                        </div>
                        <div className="text-sm text-gray-600">
                          Total Members: {familyDetails.totalMembers ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Family ID: {familyDetails.familyId}
                        </div>
                        <div className="text-xs text-gray-500">
                          Relocation Option: {familyDetails.relocationOption}
                        </div>
                      </div>
                    </div>

                    {/* Family Members */}
                    <div className="mb-6">
                      <h4 className="font-semibold mb-3">Family Members</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Array.isArray(familyDetails.members) &&
                        familyDetails.members.length > 0 ? (
                          familyDetails.members.map((member, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 bg-gray-50 p-3 rounded-md"
                            >
                              <img
                                src="/images/default-avatar.png"
                                alt={member.name || "Member"}
                                className="w-12 h-12 rounded-full object-cover border"
                              />
                              <div>
                                <div className="text-sm font-medium">
                                  {member.name || "Unknown"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {member.age ? `${member.age} yrs` : ""}{" "}
                                  {member.relation ? `• ${member.relation}` : ""}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {member.occupation || ""}
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

                    {/* Address & Contact */}
                    <div className="mb-6">
                      <h4 className="font-semibold mb-2">Contact Information</h4>
                      <div className="bg-gray-50 p-4 rounded-md">
                        <div className="text-sm">
                          <strong>Address:</strong> {familyDetails.address || "—"}
                        </div>
                        <div className="text-sm mt-1">
                          <strong>Contact:</strong> {familyDetails.contactNumber || "—"}
                        </div>
                        <div className="text-sm mt-1">
                          <strong>Village:</strong> {familyDetails.villageId || "—"}
                        </div>
                      </div>
                    </div>

                    {/* Land Ownership */}
                    {familyDetails.landOwnership && (
                      <div className="mb-6">
                        <h4 className="font-semibold mb-2">Land Ownership</h4>
                        <div className="bg-gray-50 p-4 rounded-md">
                          <div className="text-sm">
                            <strong>Land Area:</strong> {familyDetails.landOwnership}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right column - Additional Info */}
                  <div className="w-1/3 min-w-[220px]">
                    {/* Compensation Details */}
                    {familyDetails.compensationDetails && (
                      <div className="mb-6">
                        <h4 className="font-semibold mb-3">Compensation Details</h4>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-sm mb-2">
                            <strong>Land Compensation:</strong><br />
                            {formatCurrency(familyDetails.compensationDetails.landCompensation)}
                          </div>
                          <div className="text-sm mb-2">
                            <strong>Structure Compensation:</strong><br />
                            {formatCurrency(familyDetails.compensationDetails.structureCompensation)}
                          </div>
                          <div className="text-sm font-semibold border-t pt-2">
                            <strong>Total Compensation:</strong><br />
                            {formatCurrency(familyDetails.compensationDetails.totalCompensation)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Documents Submitted */}
                    {familyDetails.documentsSubmitted && familyDetails.documentsSubmitted.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-semibold mb-3">Documents Submitted</h4>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <ul className="text-sm space-y-1">
                            {familyDetails.documentsSubmitted.map((doc, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                {doc}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                      <div>
                        <strong>Created:</strong>{" "}
                        {familyDetails.createdAt
                          ? new Date(familyDetails.createdAt).toLocaleDateString()
                          : "—"}
                      </div>
                      <div className="mt-1">
                        <strong>Last Updated:</strong>{" "}
                        {familyDetails.updatedAt
                          ? new Date(familyDetails.updatedAt).toLocaleDateString()
                          : "—"}
                      </div>
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