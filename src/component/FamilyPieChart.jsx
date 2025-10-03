import React, { useEffect, useState, useRef } from "react";
import { useNavigate as useRouterNavigate } from "react-router-dom";

export default function FamilyPieChart({ villageId, navigate: navigateProp }) {
  const [total, setTotal] = useState(0);
  const [opt1, setOpt1] = useState(0);
  const [opt2, setOpt2] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: "" });
  const [drawn, setDrawn] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null); // "option1" | "option2" | null
  const containerRef = useRef(null);

  // Prefer navigate prop if provided, otherwise use react-router's hook
  let routerNavigate = null;
  try {
    routerNavigate = useRouterNavigate();
  } catch (e) {
    routerNavigate = null;
  }
  const navigate = typeof navigateProp === "function" ? navigateProp : routerNavigate;

  useEffect(() => {
    if (!villageId) {
      setError(null);
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
          headers: { "Content-Type": "application/json" },
          signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const json = await res.json();
        const r = json.result ?? json;
        const f1 = Number(r.familiesOption1 ?? r.families_option_1 ?? r.families_option1) || 0;
        const f2 = Number(r.familiesOption2 ?? r.families_option_2 ?? r.families_option2) || 0;
        const tot = Number(r.totalFamilies ?? r.total_families ?? (f1 + f2)) || (f1 + f2) || 0;

        setOpt1(f1);
        setOpt2(f2);
        setTotal(tot);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to fetch family counts");
          setTotal(0);
          setOpt1(0);
          setOpt2(0);
        }
      } finally {
        setLoading(false);
        setTimeout(() => setDrawn(true), 50);
      }
    }

    fetchCounts();

    return () => controller.abort();
  }, [villageId]);

  // donut constants
  const r = 72;
  const stroke = 24;
  const c = 2 * Math.PI * r;

  // compute percentages from current state
  const opt2Percent = total > 0 ? opt2 / total : 0;
  const opt1Percent = total > 0 ? opt1 / total : 0;

  const opt2Len = opt2Percent * c;
  const opt1Len = opt1Percent * c;

  // navigation + open param helper
  const goToFamilies = (option) => {
    if (selectedOption) return; // guard: already selected

    // want `open=option1` or `open=option2` (FamilyList reads `open` param)
    const q = option === "option1" || option === "Option 1" ? "option1" : "option2";
    const villagePart = villageId ? `&villageId=${encodeURIComponent(villageId)}` : "";
    const url = `/family?open=${encodeURIComponent(q)}${villagePart}`;

    // Update local UI so the clicked option appears "gone"
    if (q === "option1") {
      const remaining = opt2 || 0;
      setOpt1(0);
      setTotal(remaining);
      setSelectedOption("option1");
    } else {
      const remaining = opt1 || 0;
      setOpt2(0);
      setTotal(remaining);
      setSelectedOption("option2");
    }

    // re-trigger drawing animation for the visual change
    setDrawn(false);
    setTimeout(() => setDrawn(true), 50);

    // prefer navigate prop / react-router navigate
    try {
      if (typeof navigate === "function") {
        // prefer query route so FamilyList picks it up via useSearchParams
        navigate(url);
        return;
      }
    } catch (e) {
      // fallthrough to history API
    }

    // fallback: history API
    if (typeof window !== "undefined" && window.history?.pushState) {
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      window.location.href = url;
    }
  };

  // tooltip helpers
  const showTooltip = (e, text) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cursorX = e.clientX - (rect?.left || 0);
    const cursorY = e.clientY - (rect?.top || 0);
    setTooltip({ visible: true, x: cursorX + 12, y: cursorY + 12, text });
  };

  const hideTooltip = () => {
    setTooltip((t) => ({ ...t, visible: false }));
    setHovered(null);
  };

  const handleKeyPress = (e, option) => {
    if (e.key === "Enter" || e.key === " ") {
      goToFamilies(option);
    }
  };

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="bg-white rounded-2xl p-6 shadow-lg flex flex-col items-center" ref={containerRef}>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Families / Beneficiaries</h2>

        <div className="relative w-48 h-48" aria-hidden={loading || total === 0}>
          <svg viewBox="0 0 200 200" width="200" height="200" className="mx-auto">
            <defs>
              <linearGradient id="gOpt1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff7a18" />
                <stop offset="100%" stopColor="#ffb86b" />
              </linearGradient>
              <linearGradient id="gOpt2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <filter id="glowBlue" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#3b82f6" floodOpacity="0.18" />
              </filter>
              <filter id="glowOrange" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#ff7a18" floodOpacity="0.18" />
              </filter>
            </defs>

            <g transform="translate(100,100)">
              <circle r={r} fill="#f8fafc" />

              <circle
                role="button"
                aria-pressed={selectedOption === "option2"}
                tabIndex={selectedOption === "option2" ? -1 : 0}
                aria-label={`Option 2: ${opt2} families`}
                r={r}
                fill="transparent"
                stroke="url(#gOpt2)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${drawn ? opt2Len : 0} ${c - opt2Len}`}
                strokeDashoffset={0}
                transform="rotate(-90)"
                style={{
                  transition: "stroke-dasharray 900ms cubic-bezier(.2,.9,.2,1), transform 220ms, opacity 220ms",
                  cursor: selectedOption ? "default" : "pointer",
                  transformOrigin: "center",
                  filter: hovered === "opt2" ? "url(#glowBlue)" : undefined,
                  transform: hovered === "opt2" ? "scale(1.04)" : "scale(1)",
                  opacity: selectedOption === "option2" ? 0.12 : 1,
                  pointerEvents: selectedOption === "option2" ? "none" : "auto",
                }}
                onClick={() => goToFamilies("option2")}
                onKeyDown={(e) => handleKeyPress(e, "option2")}
                onMouseEnter={(e) => {
                  if (!selectedOption) {
                    setHovered("opt2");
                    showTooltip(e, `Option 2 â€” ${opt2} (${Math.round(opt2Percent * 100)}%)`);
                  }
                }}
                onMouseMove={(e) => {
                  if (!selectedOption) showTooltip(e, `Option 2 â€” ${opt2} (${Math.round(opt2Percent * 100)}%)`);
                }}
                onMouseLeave={hideTooltip}
              />

              <circle
                role="button"
                aria-pressed={selectedOption === "option1"}
                tabIndex={selectedOption === "option1" ? -1 : 0}
                aria-label={`Option 1: ${opt1} families`}
                r={r}
                fill="transparent"
                stroke="url(#gOpt1)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${drawn ? opt1Len : 0} ${c - opt1Len}`}
                strokeDashoffset={-opt2Len}
                transform={`rotate(-90)`}
                style={{
                  transition: "stroke-dasharray 900ms cubic-bezier(.2,.9,.2,1), transform 220ms, opacity 220ms",
                  cursor: selectedOption ? "default" : "pointer",
                  transformOrigin: "center",
                  filter: hovered === "opt1" ? "url(#glowOrange)" : undefined,
                  transform: hovered === "opt1" ? "scale(1.04)" : "scale(1)",
                  opacity: selectedOption === "option1" ? 0.12 : 1,
                  pointerEvents: selectedOption === "option1" ? "none" : "auto",
                }}
                onClick={() => goToFamilies("option1")}
                onKeyDown={(e) => handleKeyPress(e, "option1")}
                onMouseEnter={(e) => {
                  if (!selectedOption) {
                    setHovered("opt1");
                    showTooltip(e, `Option 1 â€” ${opt1} (${Math.round(opt1Percent * 100)}%)`);
                  }
                }}
                onMouseMove={(e) => {
                  if (!selectedOption) showTooltip(e, `Option 1 â€” ${opt1} (${Math.round(opt1Percent * 100)}%)`);
                }}
                onMouseLeave={hideTooltip}
              />

              <circle r={r - stroke / 2 - 2} fill="#ffffff" />

              {selectedOption ? (
                <text x="0" y="6" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">
                  Selected
                </text>
              ) : (
                <>
                  <text x="0" y="-6" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f172a">
                    {loading ? "â€¦" : total}
                  </text>
                  <text x="0" y="18" textAnchor="middle" fontSize="11" fill="#475569">
                    Total Families
                  </text>
                </>
              )}
            </g>
          </svg>

          {tooltip.visible && (
            <div
              className="absolute bg-white text-sm text-gray-800 px-3 py-1 rounded-lg shadow-lg pointer-events-none z-50"
              style={{
                transform: "translate(-50%, -100%)",
                left: tooltip.x,
                top: tooltip.y,
                whiteSpace: "nowrap",
              }}
            >
              {tooltip.text}
            </div>
          )}
        </div>

        {error && <div className="text-xs text-red-600 mt-3">{error}</div>}
      </div>
    </div>
  );
}
