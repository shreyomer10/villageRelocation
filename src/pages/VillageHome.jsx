// src/pages/VillageDashboard.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import StageProgress from "../component/StageProgress";
import FamilyPieChart from "../component/FamilyPieChart";
import MainNavbar from "../component/MainNavbar";
import { stageDefs } from "../config/stages";
import { AuthContext } from "../context/AuthContext";

export default function VillageDashboard() {
  const navigate = useNavigate();
  const { selectedVillageId } = useContext(AuthContext) || {}; // prefer context

  // Local state
  const [localStorageVillageId, setLocalStorageVillageId] = useState(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("villageId") : null;
    } catch {
      return null;
    }
  });

  // Effective village id used everywhere: context first, fallback to localStorage
  const effectiveVillageId = selectedVillageId ?? localStorageVillageId;

  // Family counts
  const [total, setTotal] = useState(0);
  const [opt1, setOpt1] = useState(0);
  const [opt2, setOpt2] = useState(0);

  // Village details
  const [villageName, setVillageName] = useState("User");
  const [currentStage, setCurrentStage] = useState(3);
  const [currentSubStage, setCurrentSubStage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [areaDiverted, setAreaDiverted] = useState(null);
  const [locationText, setLocationText] = useState("");
  const [imageUrl, setImageUrl] = useState(null);

  // Extra fields from API
  const [district, setDistrict] = useState(null);
  const [docs, setDocs] = useState([]);
  const [familyMasterList, setFamilyMasterList] = useState(null);
  const [fd, setFd] = useState(null);
  const [gramPanchayat, setGramPanchayat] = useState(null);
  const [janpad, setJanpad] = useState(null);
  const [kme, setKme] = useState(null);
  const [rangeField, setRangeField] = useState(null);
  const [sd1, setSd1] = useState(null);
  const [siteOfRelocation, setSiteOfRelocation] = useState(null);
  const [subD2, setSubD2] = useState(null);
  const [tehsil, setTehsil] = useState(null);
  const [villageIdState, setVillageIdState] = useState(null);
  const [logs, setLogs] = useState([]);

  // Loading and error states
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingVillage, setLoadingVillage] = useState(true);
  const [error, setError] = useState(null);

  // Read user name from localStorage (unchanged)
  const storedUserRaw =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;

  useEffect(() => {
    if (storedUserRaw) {
      try {
        const parsed = JSON.parse(storedUserRaw);
        if (parsed?.name) setVillageName(parsed.name);
      } catch {}
    }
  }, [storedUserRaw]);

  // Listen for cross-tab 'storage' changes and same-window custom event 'villageIdChanged'
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "villageId") {
        setLocalStorageVillageId(e.newValue);
      }
    };

    const onCustom = (e) => {
      // custom event detail expected as { villageId: "..." }
      const idFromDetail = e?.detail?.villageId ?? null;
      setLocalStorageVillageId(idFromDetail ?? (typeof window !== "undefined" ? localStorage.getItem("villageId") : null));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("villageIdChanged", onCustom);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("villageIdChanged", onCustom);
    };
  }, []);

  // Helper: human readable stage + sub-stage
  function getCurrentStageName(stage, subStage) {
    if (!Array.isArray(stageDefs) || stageDefs.length === 0) return "Unknown Stage";

    const stageObj = stageDefs.find((s) => {
      const id = s?.stage_id ?? s?.id ?? s?.stageId;
      return String(id) === String(stage);
    });

    if (!stageObj) return "Unknown Stage";

    if (subStage === null || subStage === undefined || subStage === "") {
      return stageObj.name ?? "Unknown Stage";
    }

    const subStages = stageObj.subStages ?? [];
    if (!Array.isArray(subStages) || subStages.length === 0) {
      return stageObj.name ?? "Unknown Stage";
    }

    let subName = null;
    if (typeof subStages[0] === "object" && subStages[0] !== null) {
      subName =
        subStages.find((ss) => String(ss.id ?? ss.sub_id ?? ss.subId) === String(subStage))
          ?.name ?? null;
      if (!subName) {
        const idx = Number(subStage);
        if (!Number.isNaN(idx) && idx >= 1 && idx <= subStages.length) {
          subName = subStages[idx - 1]?.name ?? null;
        }
      }
    } else {
      const idx = Number(subStage);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= subStages.length) {
        subName = subStages[idx - 1];
      } else {
        const found = subStages.find((ss) => String(ss) === String(subStage));
        if (found) subName = found;
      }
    }

    if (subName) return `${stageObj.name} - ${subName}`;
    return stageObj.name ?? "Unknown Stage";
  }

  // Fetch data from backend whenever effectiveVillageId changes
  useEffect(() => {
    let mounted = true;
    const controllerCounts = new AbortController();
    const controllerVillage = new AbortController();

    async function loadCounts(villageId) {
      setLoadingCounts(true);
      setError(null);
      try {
        if (!villageId) {
          setTotal(0);
          setOpt1(0);
          setOpt2(0);
          return;
        }

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(
          `https://villagerelocation.onrender.com/villages/${encodeURIComponent(
            villageId
          )}/family-count`,
          { method: "GET", headers, signal: controllerCounts.signal }
        );
        if (!res.ok) throw new Error(`Failed to fetch family counts`);

        const data = await res.json();
        if (!mounted) return;

        setTotal(Number(data.totalFamilies ?? data.total_families ?? 0));
        setOpt1(Number(data.familiesOption1 ?? data.families_option_1 ?? 0));
        setOpt2(Number(data.familiesOption2 ?? data.families_option_2 ?? 0));
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (mounted) setLoadingCounts(false);
      }
    }

    async function loadVillage(villageId) {
      setLoadingVillage(true);
      try {
        if (!villageId) {
          // clear village fields if no id
          setVillageName("User");
          setCurrentStage(3);
          setCurrentSubStage(1);
          setLogs([]);
          setLastUpdated(null);
          setLocationText("");
          setImageUrl(null);
          setAreaDiverted(null);
          setDistrict(null);
          setDocs([]);
          setFamilyMasterList(null);
          setFd(null);
          setGramPanchayat(null);
          setJanpad(null);
          setKme(null);
          setRangeField(null);
          setSd1(null);
          setSubD2(null);
          setTehsil(null);
          setVillageIdState(null);
          return;
        }

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(
          `https://villagerelocation.onrender.com/villages/${encodeURIComponent(villageId)}`,
          { method: "GET", headers, signal: controllerVillage.signal }
        );
        if (!res.ok) throw new Error("Failed to fetch village");

        const payload = await res.json();
        if (!mounted) return;

        const result = payload?.result ?? payload;

        if (result?.name) setVillageName(result.name);

        setCurrentStage(Number(result?.currentStage ?? result?.current_stage ?? result?.stage ?? 3));
        setCurrentSubStage(
          Number(
            result?.currentSubStage ??
              result?.current_sub_stage ??
              result?.subStage ??
              result?.sub_stage ??
              1
          )
        );

        const logsArr = Array.isArray(result.logs) ? result.logs : [];
        setLogs(logsArr);

        if (logsArr.length > 0) {
          const lastLog = logsArr[logsArr.length - 1];
          setLastUpdated(lastLog.updateTime ?? lastLog.update_time ?? null);
        } else {
          setLastUpdated(null);
        }

        const lat = result.lat ?? result.latitude ?? null;
        const lon = result.long ?? result.lng ?? result.longitude ?? null;
        if (lat || lon) {
          setLocationText(`${lat ?? "-"}, ${lon ?? "-"}`);
        } else if (result?.siteOfRelocation) {
          setLocationText(result.siteOfRelocation);
        } else {
          setLocationText("");
        }
        if (result?.siteOfRelocation) setSiteOfRelocation(result.siteOfRelocation);

        if (Array.isArray(result.photos) && result.photos.length > 0) {
          setImageUrl(result.photos[0]);
        } else if (result.photo) {
          setImageUrl(result.photo);
        } else {
          setImageUrl(null);
        }

        setAreaDiverted(
          result.areaDiverted ??
            result.area_diverted ??
            result.area ??
            result.totalArea ??
            null
        );

        setDistrict(result.district ?? result?.District ?? null);
        setDocs(Array.isArray(result.docs) ? result.docs : result.docs ? [result.docs] : []);
        setFamilyMasterList(
          result.familyMasterList ?? result.family_master_list ?? result.familyList ?? null
        );
        setFd(result.fd ?? result.forestDivision ?? null);
        setGramPanchayat(result.gramPanchayat ?? result.gram_panchayat ?? null);
        setJanpad(result.janpad ?? result.jan_pad ?? null);
        setKme(result.kme ?? null);
        setRangeField(result.range ?? result.rangeField ?? null);
        setSd1(result.sd1 ?? null);
        setSubD2(result.subD2 ?? null);
        setTehsil(result.tehsil ?? null);
        setVillageIdState(result.villageId ?? result.village_id ?? result.id ?? null);
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (mounted) setLoadingVillage(false);
      }
    }

    if (effectiveVillageId) {
      loadCounts(effectiveVillageId);
      loadVillage(effectiveVillageId);
    } else {
      setLoadingCounts(false);
      setLoadingVillage(false);
    }

    return () => {
      mounted = false;
      controllerCounts.abort();
      controllerVillage.abort();
    };
  }, [effectiveVillageId]);

  // Prepare ticker text from logs
  const logsText = logs.length
    ? logs
        .map((l) => {
          const t =
            l.updateTime ??
            l.update_time ??
            l.time ??
            l.timestamp ??
            null;
          const formattedTime = t ? new Date(t).toLocaleString() : "Unknown time";
          const who = l.updateBy ?? l.update_by ?? l.by ?? "Unknown";
          const comments = l.comments ?? l.comment ?? "No comments";
          return `${comments} — ${who} — ${formattedTime}`;
        })
        .join("  •  ")
    : "No logs available";

  // Animation duration for ticker
  const durationSeconds = Math.max(12, Math.round(logsText.length / 10));

  return (
    <div className="min-h-screen bg-amber-50 font-sans">
      {/* Navbar: pass effective village id (from AuthContext if available) */}
      <MainNavbar village={effectiveVillageId} showVillageInNavbar={true} />

      {/* Ticker below navbar */}
      <div className="w-full bg-white shadow-sm">
        <style>{`
          .ticker { overflow: hidden; white-space: nowrap; }
          .ticker-inner { display: inline-block; padding: 8px 0; font-size: 0.95rem; white-space: nowrap; will-change: transform; }
          @keyframes marquee {
            from { transform: translateX(100%); }
            to { transform: translateX(-100%); }
          }
        `}</style>

        <div className="ticker">
          <div
            className="ticker-inner"
            style={{
              animationName: "marquee",
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              animationDuration: `${durationSeconds}s`,
              paddingLeft: "100%",
            }}
            aria-live="polite"
          >
            {logsText}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-6">
        {/* Pie chart */}
        <section className="col-span-4">
          <FamilyPieChart
            total={total}
            opt1={opt1}
            opt2={opt2}
            loading={loadingCounts}
            error={error}
            villageId={villageIdState || effectiveVillageId}
          />
        </section>

        {/* Right side content */}
        <section className="col-span-8 space-y-6">
          {/* Stage Progress */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-700 text-center mb-6">
              Stages Of Relocation
            </h3>
            <StageProgress
              currentStage={currentStage}
              currentSubStage={currentSubStage}
              showSubStage={true}
            />

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Current Stage:{" "}
                <span className="font-semibold text-gray-800">
                  {getCurrentStageName(currentStage, currentSubStage)}
                </span>
              </p>
            </div>
          </div>

          {/* Location Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg flex items-stretch gap-6">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-800">Location of Relocation</h4>
              <p className="text-xs text-gray-700 mt-1">{locationText || "Location not available"}</p>

              <h4 className="text-sm font-semibold text-gray-800 mt-4">Total Area Diverted</h4>
              <p className="text-xs text-gray-700 mt-1">{areaDiverted ?? "—"}</p>

              {lastUpdated && (
                <>
                  <h4 className="text-sm font-semibold text-gray-800 mt-4">Last Updated</h4>
                  <p className="text-xs text-gray-700 mt-1">
                    {new Date(lastUpdated).toLocaleString()}
                  </p>
                </>
              )}
            </div>

            <div className="w-56 h-36 rounded-lg overflow-hidden shadow-md bg-gray-100 flex items-center justify-center">
              {imageUrl ? (
                <img src={imageUrl} alt="site" className="w-full h-full object-cover" />
              ) : (
                <div className="text-sm text-gray-500">No image</div>
              )}
            </div>
          </div>

          {/* Village Details Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Village details</h4>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
              <div>
                <div className="font-medium text-gray-800">Name</div>
                <div>{villageName}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">Village ID</div>
                <div>{villageIdState ?? effectiveVillageId ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">District</div>
                <div>{district ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">Tehsil</div>
                <div>{tehsil ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">Gram Panchayat</div>
                <div>{gramPanchayat ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">Janpad</div>
                <div>{janpad ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">Forest Division</div>
                <div>{fd ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">Range</div>
                <div>{rangeField ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">SD1</div>
                <div>{sd1 ?? "—"}</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">Sub D2</div>
                <div>{subD2 ?? "—"}</div>
              </div>

              <div className="col-span-2">
                <div className="font-medium text-gray-800">Site of Relocation</div>
                <div>{siteOfRelocation ?? "—"}</div>
              </div>

              <div className="col-span-2">
                <div className="font-medium text-gray-800">Family master list</div>
                <div>
                  {familyMasterList ? (
                    <a
                      href={familyMasterList}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      Download
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <div className="font-medium text-gray-800">Docs</div>
                <div className="flex flex-col gap-1">
                  {docs.length > 0 ? (
                    docs.map((d, i) => (
                      <a
                        key={i}
                        href={d}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline text-xs"
                      >
                        Document {i + 1}
                      </a>
                    ))
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <div className="font-medium text-gray-800">KME</div>
                <div>
                  {kme ? (
                    <a href={kme} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      {kme}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-40 justify-center">
            <button
              onClick={() => navigate("/family")}
              className="bg-green-200 hover:bg-green-300 px-20 py-2 rounded-2xl shadow text-sm font-medium"
            >
              All Beneficiaries
            </button>
            <button className="bg-green-200 hover:bg-green-300 px-20 py-2 rounded-2xl shadow text-sm font-medium">
              Plan Layout
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
