// sVillage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function VillageDashboard() {
  const navigate = useNavigate();

  // family counts & percentages
  const [total, setTotal] = useState(0);
  const [opt1, setOpt1] = useState(0);
  const [opt2, setOpt2] = useState(0);

  // village details
  const [villageName, setVillageName] = useState("User");
  const [currentStage, setCurrentStage] = useState(3);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [areaDiverted, setAreaDiverted] = useState(null);
  const [locationText, setLocationText] = useState("");
  const [imageUrl, setImageUrl] = useState(null);

  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingVillage, setLoadingVillage] = useState(true);
  const [error, setError] = useState(null);

  const [selectedStage, setSelectedStage] = useState(null);

  // UI stage definitions (kept same as your original)
  const stages = [
    { stage_id: 1, name: "Gram Sabha Meeting", description: "Initial consent", sequence_no: 1, files: ["/files/stage1.pdf"] },
    { stage_id: 2, name: "Consent Collection", description: "Collect family consent", sequence_no: 2, files: ["/files/stage2.pdf"] },
    { stage_id: 3, name: "Land Identification", description: "Identify land", sequence_no: 3, files: ["/files/stage3.pdf"] },
    { stage_id: 4, name: "Compensation Approval", description: "Approve funds", sequence_no: 4, files: ["/files/stage4.pdf"] },
    { stage_id: 5, name: "Relocation Completed", description: "Handover", sequence_no: 5, files: ["/files/stage5.pdf"] },
  ];

  // read stored user + villageId from localStorage (Auth flow stores `user` and earlier code stores `villageId`)
  const storedUserRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const storedVillageId = typeof window !== "undefined" ? localStorage.getItem("villageId") : null;
  let storedUserName = "User";
  try {
    if (storedUserRaw) {
      const parsed = JSON.parse(storedUserRaw);
      if (parsed?.name) storedUserName = parsed.name;
    }
  } catch (e) {
    // ignore parse error
  }

  useEffect(() => {
    if (storedUserName) setVillageName(storedUserName);
  }, [storedUserName]);

  // compute pie geometry (reactively derived)
  const r = 60;
  const c = 2 * Math.PI * r;
  const opt2Percent = total > 0 ? (opt2 / total) * 100 : 0;
  const opt1Percent = total > 0 ? (opt1 / total) * 100 : 0;
  const opt2Dash = (opt2Percent / 100) * c;
  const opt1Dash = c - opt2Dash;

  // fetch family counts and village info when component mounts or villageId changes
  useEffect(() => {
    let mounted = true;
    const controllerCounts = new AbortController();
    const controllerVillage = new AbortController();

    async function loadCounts(villageId) {
      setLoadingCounts(true);
      setError(null);
      try {
        if (!villageId) {
          throw new Error("No village selected. Please select a village from Dashboard.");
        }

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(
          `https://villagerelocation.onrender.com/villages/${encodeURIComponent(villageId)}/family-count`,
          { method: "GET", headers, signal: controllerCounts.signal }
        );
        if (!res.ok) {
          throw new Error(`Failed to fetch family counts (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;

        setTotal(Number(data.totalFamilies ?? 0));
        setOpt1(Number(data.familiesOption1 ?? 0));
        setOpt2(Number(data.familiesOption2 ?? 0));
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError") setError(err.message || "Unable to load family counts.");
      } finally {
        if (mounted) setLoadingCounts(false);
      }
    }

    async function loadVillage(villageId) {
      setLoadingVillage(true);
      try {
        if (!villageId) {
          throw new Error("No village selected.");
        }

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(
          `https://villagerelocation.onrender.com/villages/${encodeURIComponent(villageId)}`,
          { method: "GET", headers, signal: controllerVillage.signal }
        );
        if (!res.ok) {
          if (res.status === 404) throw new Error("Village not found.");
          throw new Error(`Failed to fetch village (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;

        // set UI bits
        setCurrentStage(Number(data.currentStage ?? data.current_stage ?? currentStage));
        setLastUpdated(data.lastUpdatedOn ?? data.last_updated_on ?? data.updated_at ?? null);
        setAreaDiverted(data.areaDiverted ?? data.area_diverted ?? null);

        const loc = data.location;
        if (loc && (loc.latitude || loc.longitude)) {
          setLocationText(`${loc.latitude ?? "-"}, ${loc.longitude ?? "-"}`);
        } else if (data.location && typeof data.location === "string") {
          setLocationText(data.location);
        } else {
          setLocationText("");
        }

        // backend may return an image URL
        if (data.image) setImageUrl(data.image);
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError") setError(err.message || "Unable to load village info.");
      } finally {
        if (mounted) setLoadingVillage(false);
      }
    }

    // start loads
    loadCounts(storedVillageId);
    loadVillage(storedVillageId);

    return () => {
      mounted = false;
      controllerCounts.abort();
      controllerVillage.abort();
    };
    // We intentionally do not include storedVillageId in deps because we read it from localStorage once at mount.
    // If elsewhere in your app you update localStorage('villageId') and want this page to reactively reload,
    // replace `storedVillageId` above with a state value or a context prop.
  }, []); // run once on mount

  return (
    <div className="min-h-screen bg-amber-50 font-sans">
      {/* Header */}
      {/* Replace the existing <header> block with this */}
<header className="bg-[#a7dec0] shadow-md">
  <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
    {/* Left: Logo */}
    <div className="flex items-center gap-4">
      <img src="/images/logo.png" alt="logo" className="w-20 h-20 object-contain" />
    </div>

    {/* Center: Village name (NEW) */}
    <div className="text-center">
      <div className="text-2xl font-bold text-green-800">
        {storedVillageId || "Village Name"}
      </div>
      {/* optional subtitle — remove if you don't want it */}
      <div className="text-sm text-gray-700 mt-0.5">
        {/* e.g. current stage or small hint */}
      </div>
    </div>

    {/* Right: Branding */}
    <div className="text-right">
      <div className="text-[#4a3529] font-bold text-2xl leading-none">माटी</div>
      <div className="text-sm text-[#4a3529] tracking-wider">MAATI</div>
    </div>
  </div>
</header>


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-6">
        {/* Left: Families Pie */}
        <section className="col-span-4">
          <div className="bg-white rounded-2xl p-6 shadow-lg h-full flex flex-col">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Families / Beneficiaries</h2>

            {error && (
              <div className="text-sm text-red-600 mb-3">
                {error}
              </div>
            )}

            <div className="flex flex-col items-center">
              {loadingCounts ? (
                <div className="py-8 text-sm text-gray-600">Loading counts…</div>
              ) : (
                <>
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
                        <text x="0" y="5" textAnchor="middle" fontSize="18" fontWeight="700" fill="#111">
                          {Math.round(opt2Percent)}%
                        </text>
                        <text x="0" y="28" textAnchor="middle" fontSize="12" fill="#111">
                          {opt2}
                        </text>
                      </g>
                    </svg>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-gray-600">Total Number of Families/Beneficiaries:</p>
                    <div className="text-2xl font-bold mt-1">{total}</div>

                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-400"></span>
                      <p className="text-sm text-gray-700">
                        Option 1 Families: <span className="font-semibold">{opt1}</span>
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <p className="text-sm text-gray-700">
                        Option 2 Families: <span className="font-semibold">{opt2}</span>
                      </p>
                    </div>

                    <a href="#" className="text-xs text-blue-600 mt-3 inline-block hover:underline">
                      View all Beneficiaries/Families Status
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Right: Progress + Location */}
        <section className="col-span-8 space-y-6">
          {/* Stages Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-700 text-center mb-6">Stages Of Relocation</h3>

            <div className="flex items-center justify-between max-w-4xl mx-auto relative">
              {stages.map((stage, idx) => {
                const isCompleted = stage.sequence_no < currentStage;
                const isActive = stage.sequence_no === currentStage;

                return (
                  <React.Fragment key={stage.stage_id}>
                    <div onClick={() => setSelectedStage(stage)} className="flex flex-col items-center relative z-10 cursor-pointer">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold 
                          ${isCompleted ? "bg-green-500 text-white" : ""}
                          ${isActive ? "border-2 border-green-500 text-green-600 bg-white" : ""}
                          ${!isCompleted && !isActive ? "border-2 border-gray-300 text-gray-500 bg-white" : ""}
                        `}
                      >
                        {isCompleted ? "✓" : stage.sequence_no}
                      </div>
                      <p className={`text-xs mt-2 font-medium text-center ${isCompleted || isActive ? "text-green-700" : "text-gray-500"}`}>
                        {stage.name}
                      </p>
                    </div>

                    {idx !== stages.length - 1 && (
                      <div
                        className={`absolute top-5 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] h-0.5 ${isCompleted ? "bg-green-500" : "bg-gray-300"}`}
                        style={{
                          width: "calc((100% / 5) - 3rem)",
                          left: `calc(${((idx + 1) * 100) / stages.length}% - 1.5rem)`,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="text-center mt-6 font-medium">
              Current Stage: {stages.find(s => s.sequence_no === currentStage)?.name ?? `Step ${currentStage}`}
            </div>
            <p className="text-xs text-center text-gray-500 mt-2">
              Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}
            </p>
          </div>

          {/* Location Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg flex items-stretch gap-6">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-800">Location of Relocation</h4>
              <p className="text-xs text-gray-700 mt-1">{locationText || "Location not available"}</p>

              <h4 className="text-sm font-semibold text-gray-800 mt-4">Total Area Diverted</h4>
              <p className="text-xs text-gray-700 mt-1">{areaDiverted ?? "—"}</p>
            </div>

            <div className="w-56 h-36 rounded-lg overflow-hidden shadow-md bg-gray-100 flex items-center justify-center">
              {imageUrl ? (
                // if backend provides a URL, use it
                // ensure the server supports CORS for images or use a proxied endpoint
                <img src={imageUrl} alt="site" className="w-full h-full object-cover" />
              ) : (
                <div className="text-sm text-gray-500">No image</div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 justify-end">
            <button onClick={() => navigate("/family")} className="bg-green-200 hover:bg-green-300 px-6 py-2 rounded-2xl shadow text-sm font-medium">
              All Beneficiaries
            </button>
            <button className="bg-green-200 hover:bg-green-300 px-6 py-2 rounded-2xl shadow text-sm font-medium">
              Plan Layout
            </button>
          </div>
        </section>
      </main>

      {/* Stage Modal */}
      {selectedStage && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-96 relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={() => setSelectedStage(null)}>
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-4">{selectedStage.name}</h2>
            <p className="text-sm text-gray-600 mb-4">{selectedStage.description}</p>
            <div className="space-y-2">
              {selectedStage.files.map((file, index) => (
                <a key={index} href={file} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline text-sm">
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
