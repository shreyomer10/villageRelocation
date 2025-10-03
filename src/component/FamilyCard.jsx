// src/components/FamilyCard.jsx
import React from "react";

export default function FamilyCard({ family, onView }) {
  return (
    <div className="bg-[#f0f4ff] rounded-xl p-4 shadow-md text-center hover:shadow-lg transition">
      <img
        src={family.mukhiyaPhoto || "/images/default-avatar.png"}
        alt={family.mukhiyaName || "Mukhiya"}
        onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
        className="w-24 h-24 mx-auto rounded-full object-cover border mb-3"
      />
      <h3 className="font-semibold text-gray-800">
        {family.mukhiyaName || "Unknown"}
      </h3>
      <button
        onClick={() => onView(family.familyId)}
        className="mt-3 px-4 py-1 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-md shadow"
      >
        View Family
      </button>
    </div>
  );
}
