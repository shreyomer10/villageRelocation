import React, { useEffect, useState } from "react";

/**
 * FamilyPieChart
 * Fetches family counts for a given villageId from the API and renders a small pie chart + details.
 *
 * Props:
 *  - villageId (string) : required, passed from parent (e.g. "V001")
 *
 * Example usage in parent:
 *  <FamilyPieChart villageId={"V001"} />
 */
export default function FamilyPieChart({ villageId }) {
  const [total, setTotal] = useState(0);
  const [opt1, setOpt1] = useState(0);
  const [opt2, setOpt2] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!villageId) {
      setError("No villageId provided");
      setTotal(0);
      setOpt1(0);
      setOpt2(0);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const url = `https://villagerelocation.onrender.com/villages/${encodeURIComponent(
      villageId
    )}/family-count`;

    async function fetchCounts() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Add authorization header here if your API requires it, e.g.
            // Authorization: `Bearer ${token}`
          },
          signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const json = await res.json();

        // Expected shape (example):
        // { error: false, message: "Successfully Fetched Count", result: { familiesOption1: 1, familiesOption2: 0, totalFamilies: 1, villageId: "V001" } }
        if (json && json.result) {
          const r = json.result;
          // defensive parsing to numbers
          const familiesOption1 = Number(r.familiesOption1) || 0;
          const familiesOption2 = Number(r.familiesOption2) || 0;
          const totalFamilies = Number(r.totalFamilies) || familiesOption1 + familiesOption2 || 0;

          setOpt1(familiesOption1);
          setOpt2(familiesOption2);
          setTotal(totalFamilies);
        } else {
          throw new Error("Unexpected API response shape");
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to fetch family counts");
          setTotal(0);
          setOpt1(0);
          setOpt2(0);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCounts();

    return () => controller.abort();
  }, [villageId]);

  // Pie chart math
  const r = 60; // radius
  const c = 2 * Math.PI * r; // circumference

  // Digit-by-digit safe arithmetic for percentages
  const opt2Percent = total > 0 ? (opt2 / total) * 100 : 0; // (opt2 / total) * 100
  const opt1Percent = total > 0 ? (opt1 / total) * 100 : 0; // (opt1 / total) * 100

  // dash lengths on the circumference (numbers, not percentages)
  const opt2Dash = (opt2Percent / 100) * c; // portion length for opt2
  const opt1Dash = c - opt2Dash; // remaining portion length

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg h-full flex flex-col">
      <h2 className="text-lg text-center font-semibold text-gray-700 mb-4">
        Families / Beneficiaries
      </h2>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      <div className="flex flex-col items-center">
        {loading ? (
          <div className="py-8 text-sm text-gray-600">Loading counts…</div>
        ) : (
          <>
            {/* Pie chart */}
            <div className="w-44 h-44 flex items-center justify-center mb-6" aria-hidden>
              <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={`Families: ${opt2} (${Math.round(opt2Percent)}%)`}>
                <g transform="translate(80,80)">
                  <circle r={r} fill="#f6f6f6" />

                  {/* Option 2 segment (blue) - drawn first so that option1 can sit on top */}
                  <circle
                    r={r}
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth="40"
                    strokeDasharray={`${opt2Dash} ${c - opt2Dash}`}
                    strokeLinecap="butt"
                    transform={`rotate(-90)`}
                  />

                  {/* Option 1 segment (orange) - rotated by opt2's angle so it starts where option2 ended */}
                  <circle
                    r={r}
                    fill="transparent"
                    stroke="#f97316"
                    strokeWidth="40"
                    strokeDasharray={`${opt1Dash} ${c - opt1Dash}`}
                    strokeLinecap="butt"
                    transform={`rotate(${(-90 + (opt2Percent / 100) * 360)})`}
                  />

                  <text x="0" y="5" textAnchor="middle" fontSize="18" fontWeight="700" fill="#111">
                    {Math.round(opt2Percent)}%
                  </text>
                  <text x="0" y="28" textAnchor="middle" fontSize="12" fill="#111">
                    {opt2}
                  </text>
                </g>
              </svg>
            </div>

            {/* Details */}
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Number of Families/Beneficiaries:</p>
              <div className="text-2xl font-bold mt-1">{total}</div>

              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-400" />
                <p className="text-sm text-gray-700">
                  Option 1 Families: <span className="font-semibold">{opt1}</span>
                </p>
              </div>

              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <p className="text-sm text-gray-700">
                  Option 2 Families: <span className="font-semibold">{opt2}</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
