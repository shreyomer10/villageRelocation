// src/components/FamilyPieChart.jsx
import React from "react";

export default function FamilyPieChart({ total, opt1, opt2, loading, error }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  const opt2Percent = total > 0 ? (opt2 / total) * 100 : 0;
  const opt1Percent = total > 0 ? (opt1 / total) * 100 : 0;
  const opt2Dash = (opt2Percent / 100) * c;
  const opt1Dash = c - opt2Dash;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg h-full flex flex-col">
      <h2 className="text-lg text-center font-semibold text-gray-700 mb-4">
        Families / Beneficiaries
      </h2>

      {error && (
        <div className="text-sm text-red-600 mb-3">{error}</div>
      )}

      <div className="flex flex-col items-center">
        {loading ? (
          <div className="py-8 text-sm text-gray-600">Loading counts…</div>
        ) : (
          <>
            {/* Pie chart */}
            <div className="w-44 h-44 flex items-center justify-center mb-6">
              <svg width="160" height="160" viewBox="0 0 160 160">
                <g transform="translate(80,80)">
                  <circle r={r} fill="#f6f6f6" />
                  <circle
                    r={r}
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth="40"
                    strokeDasharray={`${opt2Dash} ${opt1Dash}`}
                    strokeLinecap="butt"
                    transform="rotate(-90)"
                  />
                  <circle
                    r={r}
                    fill="transparent"
                    stroke="#f97316"
                    strokeWidth="40"
                    strokeDasharray={`${opt1Dash} ${opt2Dash}`}
                    strokeLinecap="butt"
                    transform={`rotate(${(-90 + (opt2Percent / 100) * 360)})`}
                  />
                  <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="700"
                    fill="#111"
                  >
                    {Math.round(opt2Percent)}%
                  </text>
                  <text
                    x="0"
                    y="28"
                    textAnchor="middle"
                    fontSize="12"
                    fill="#111"
                  >
                    {opt2}
                  </text>
                </g>
              </svg>
            </div>

            {/* Details */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Total Number of Families/Beneficiaries:
              </p>
              <div className="text-2xl font-bold mt-1">{total}</div>

              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                <p className="text-sm text-gray-700">
                  Option 1 Families:{" "}
                  <span className="font-semibold">{opt1}</span>
                </p>
              </div>

              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <p className="text-sm text-gray-700">
                  Option 2 Families:{" "}
                  <span className="font-semibold">{opt2}</span>
                </p>
              </div>

              <a
                href="#"
                className="text-xs text-blue-600 mt-3 inline-block hover:underline"
              >
                View all Beneficiaries/Families Status
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
