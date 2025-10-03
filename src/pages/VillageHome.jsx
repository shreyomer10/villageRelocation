// src/pages/VillageDashboard.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import StageProgress from "../component/StageProgress";
import FamilyPieChart from "../component/FamilyPieChart";
import MainNavbar from "../component/MainNavbar";
import { stageDefs } from "../config/stages";
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/Api.js";

export default function VillageDashboard() {
  const navigate = useNavigate();
  const { selectedVillageId } = useContext(AuthContext) || {}; // prefer context

  // Local state (unchanged from original)
  const [localStorageVillageId, setLocalStorageVillageId] = useState(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("villageId") : null;
    } catch {
      return null;
    }
  });
  const effectiveVillageId = selectedVillageId ?? localStorageVillageId;

  const [total, setTotal] = useState(0);
  const [opt1, setOpt1] = useState(0);
  const [opt2, setOpt2] = useState(0);

  const [villageName, setVillageName] = useState("User");
  const [currentStage, setCurrentStage] = useState(3);
  const [currentSubStage, setCurrentSubStage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [areaDiverted, setAreaDiverted] = useState(null);
  const [locationText, setLocationText] = useState("");
  const [imageUrl, setImageUrl] = useState(null);

  // NEW: photos array + index + fullscreen state
  const [photos, setPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);

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

  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingVillage, setLoadingVillage] = useState(true);
  const [error, setError] = useState(null);

  // Meetings modal control (ADDED)
  const [showMeetingsModal, setShowMeetingsModal] = useState(false);

  // DOCS modal / viewer states
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [expandedStages, setExpandedStages] = useState(() => new Set());
  const [docViewerUrl, setDocViewerUrl] = useState(null);
  const [docViewerName, setDocViewerName] = useState(null);
  const [showDocViewer, setShowDocViewer] = useState(false);

  const storedUserRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;

  useEffect(() => {
    if (storedUserRaw) {
      try {
        const parsed = JSON.parse(storedUserRaw);
        if (parsed?.name) setVillageName(parsed.name);
      } catch {}
    }
  }, [storedUserRaw]);

  // sync localStorage from other tabs / custom event (unchanged)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "villageId") {
        setLocalStorageVillageId(e.newValue);
      }
    };

    const onCustom = (e) => {
      const idFromDetail = e?.detail?.villageId ?? null;
      setLocalStorageVillageId(
        idFromDetail ?? (typeof window !== "undefined" ? localStorage.getItem("villageId") : null)
      );
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("villageIdChanged", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("villageIdChanged", onCustom);
    };
  }, []);

  // getCurrentStageName helper (same as before)
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

  // Automatically cycle through photos every 5 seconds when in fullscreen mode
  useEffect(() => {
    if (!showFullscreen || photos.length === 0) return;

    const interval = setInterval(() => {
      setPhotoIndex((prevIndex) => (prevIndex + 1) % photos.length);
    }, 5000); // change image every 5 seconds

    return () => clearInterval(interval);
  }, [photos.length, showFullscreen]);

  // fetch logic (kept behaviorally same, simplified for brevity)
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

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(
          `${API_BASE}/villages/${encodeURIComponent(villageId)}/family-count`,
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
          // NEW: clear photos
          setPhotos([]);
          setPhotoIndex(0);
          return;
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(
          `${API_BASE}/villages/${encodeURIComponent(villageId)}`,
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

        // PHOTOS handling: prefer result.photos array, fallback to result.photo
        const photosArr = Array.isArray(result.photos) && result.photos.length > 0
          ? result.photos
          : result.photo
          ? [result.photo]
          : [];

        setPhotos(photosArr);
        setPhotoIndex(0);
        if (photosArr.length > 0) setImageUrl(photosArr[0]);
        else setImageUrl(null);

        setAreaDiverted(
          result.areaDiverted ?? result.area_diverted ?? result.area ?? result.totalArea ?? null
        );

        setDistrict(result.district ?? result?.District ?? null);
        // ensure docs is an array of URLs/strings
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

  // Derived current image to display
  const currentImage = photos.length > 0 ? photos[photoIndex] : imageUrl;

  // Handlers for image controls
  function nextPhoto(e) {
    // stop propagation so clicks don't bubble to parent handlers
    if (e && e.stopPropagation) e.stopPropagation();
    if (!photos || photos.length === 0) return;
    const next = (photoIndex + 1) % photos.length;
    setPhotoIndex(next);
    setImageUrl(photos[next]);
  }

  function prevPhoto(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!photos || photos.length === 0) return;
    const prev = (photoIndex - 1 + photos.length) % photos.length;
    setPhotoIndex(prev);
    setImageUrl(photos[prev]);
  }

  function openFullscreen(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!currentImage) return;
    setShowFullscreen(true);
  }

  function closeFullscreen() {
    setShowFullscreen(false);
  }

  // keyboard navigation in fullscreen
  useEffect(() => {
    if (!showFullscreen) return;
    function onKey(e) {
      if (e.key === "Escape") closeFullscreen();
      if (e.key === "ArrowRight") setPhotoIndex((s) => (photos.length ? (s + 1) % photos.length : s));
      if (e.key === "ArrowLeft") setPhotoIndex((s) => (photos.length ? (s - 1 + photos.length) % photos.length : s));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showFullscreen, photos.length]);

  // Prepare logs text for ticker (kept)
  const logsText = logs.length
    ? logs
        .map((l) => {
          const t =
            l.updateTime ?? l.update_time ?? l.time ?? l.timestamp ?? null;
          const formattedTime = t ? new Date(t).toLocaleString() : "Unknown time";
          const who = l.updateBy ?? l.update_by ?? l.by ?? "Unknown";
          const comments = l.comments ?? l.comment ?? "No comments";
          return `${comments} — ${who} — ${formattedTime}`;
        })
        .join("  •  ")
    : "No logs available";
  const durationSeconds = Math.max(12, Math.round(logsText.length / 10));

  // small presentational helper for details rows
  function DetailRow({ label, value, href }) {
    return (
      <div className="flex items-start gap-3">
        <div className="w-36 text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-800 break-words">
          {value ? (
            href ? (
              <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                {value}
              </a>
            ) : (
              <span>{value}</span>
            )
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
      </div>
    );
  }

  // DOCS modal helpers
  function toggleStageExpand(stageId) {
    setExpandedStages((prev) => {
      const copy = new Set(prev);
      if (copy.has(stageId)) copy.delete(stageId);
      else copy.add(stageId);
      return copy;
    });
  }

  // Try to find a matching doc for a given stage/substage by name match in docs URLs or filenames
  function findFileFor(stageObj, subName) {
    // normalize search tokens
    const tokens = [];
    if (stageObj?.name) tokens.push(String(stageObj.name).toLowerCase());
    if (stageObj?.stage_id) tokens.push(String(stageObj.stage_id).toLowerCase());
    if (subName) tokens.push(String(subName).toLowerCase());

    // prefer direct matches in docs array
    if (Array.isArray(docs) && docs.length > 0) {
      for (const d of docs) {
        try {
          const lower = String(d).toLowerCase();
          // if any token appears in the URL or filename, consider it a match
          if (tokens.some((t) => (t && (lower.includes(t.replace(/\s+/g, "-") ) || lower.includes(t))))) {
            return d;
          }
        } catch {}
      }
      // fallback to first doc
      return docs[0];
    }

    // final fallback to familyMasterList if present
    if (familyMasterList) return familyMasterList;

    return null;
  }

  function openDocInViewer(url, name) {
    if (!url) return;
    setDocViewerUrl(url);
    setDocViewerName(name ?? "Document");
    setShowDocViewer(true);
  }

  function closeDocViewer() {
    setShowDocViewer(false);
    setDocViewerUrl(null);
    setDocViewerName(null);
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar village={effectiveVillageId} showVillageInNavbar={true} />

      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{district ?? "—"}</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm"
            >
              ← Back
            </button>
            <button
              onClick={() => navigate("/family")}
              className="bg-green-200 hover:bg-green-300 px-4 py-2 rounded-lg shadow text-sm font-medium"
            >
              All Beneficiaries
            </button>
            <button
              onClick={() => navigate("/plan-layout")}
              className="bg-indigo-50 hover:bg-indigo-100 px-6 py-2 rounded-2xl shadow text-sm font-medium"
            >
              Plan Layout
            </button>

            <button
              onClick={() => setShowDocsModal(true)}
              className="bg-indigo-50 hover:bg-indigo-100 px-6 py-2 rounded-2xl shadow text-sm font-medium"
              title="Open stage documents"
            >
              Docs
            </button>
            <button
              onClick={() => navigate(`/plots`)}
              className="bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-2xl shadow text-sm font-medium"
              title="Open plots for this village"
            >
              Plots
            </button>

            <button
              onClick={() => navigate(`/meetings`)}
              className="bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-2xl shadow text-sm font-medium"
              title="Open meetings for this village"
            >
              Meetings
            </button>
            <button
              onClick={() => navigate(`/buildings`)}
              className="bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-2xl shadow text-sm font-medium"
              title="Open buildings for this village"
            >
              Buildings
            </button>

          </div>
        </div>

        {/* TOP ROW: Left pie + Right stacked cards */}
        <div className="grid grid-cols-12 gap-6">
          {/* Pie Chart Card */}
          <div className="col-span-12 md:col-span-4">
            <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl p-6 shadow-lg border border-gray-100 h-full flex flex-col  gap-1">
              <FamilyPieChart
                total={total}
                opt1={opt1}
                opt2={opt2}
                loading={loadingCounts}
                error={error}
                villageId={villageIdState || effectiveVillageId}
              />
              <a href={familyMasterList} target="_blank" rel="noreferrer" className="text-blue-600 underline text-center">
                Family Master List
              </a>
            </div>

          </div>

          {/* Right Column: two stacked cards */}
          <div className="col-span-12 md:col-span-8 flex flex-col gap-6">
            {/* Stage Progress card */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Stages Of Relocation</h3>
                <div className="text-sm text-gray-500">Current: <span className="font-medium text-gray-800">{getCurrentStageName(currentStage, currentSubStage)}</span></div>
              </div>

              <StageProgress
                currentStage={currentStage}
                currentSubStage={currentSubStage}
                showSubStage={true}
              />
            </div>

            {/* Location card */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="gap-4">
                  <h4 className="text-sm font-semibold text-gray-700">Location of Relocation:</h4>
                  <p className="text-sm text-gray-600 mt-2">{locationText || "Location not available"}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Site</h4>
                  <div className="text-sm text-gray-600 mt-2">{siteOfRelocation ?? "—"}</div>
                </div>

                {/* DOC button next to location */}

              </div>
              <div className=" text-center">
                <a href={kme} className="text-blue-600 underline text-center">KME_link</a>
              </div>
            </div>
          </div>
        </div>

        {/* FULL-WIDTH DETAILS BOX */}
        <div className="mt-6 gap-10">
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 gap-10">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Image large on the left with hover controls */}
              <div className="lg:w-1/3 w-full rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-100 group relative">
                {currentImage ? (
                  <>
                    <img src={currentImage} alt="uploaded" className="w-full h-64 object-cover" />

                    <div className="absolute inset-0 bg-black bg-opacity-20 opacity-0 group-hover:opacity-100 transition flex items-center justify-between px-4">
                      <button
                        onClick={prevPhoto}
                        title="Previous photo"
                        className="p-3 bg-white bg-opacity-95 rounded-full shadow hover:scale-105"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <div className="flex gap-3 items-center">
                        <button
                          onClick={nextPhoto}
                          title="Next photo"
                          className="p-3 bg-white bg-opacity-95 rounded-full shadow hover:scale-105"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <button
                          onClick={openFullscreen}
                          title="View fullscreen"
                          className="p-3 bg-white bg-opacity-95 rounded-full shadow hover:scale-105"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 4a1 1 0 011-1h3a1 1 0 110 2H5v2a1 1 0 11-2 0V4zM17 4a1 1 0 00-1-1h-3a1 1 0 100 2h2v2a1 1 0 102 0V4zM3 16a1 1 0 011 1h3a1 1 0 110-2H5v-2a1 1 0 10-2 0v3zM17 16a1 1 0 00-1 1h-3a1 1 0 100-2h2v-2a1 1 0 102 0v3z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {photos.length > 1 && (
                      <div className="absolute left-2 top-2 bg-white bg-opacity-90 rounded-full px-2 py-0.5 text-xs font-medium">
                        {photoIndex + 1}/{photos.length}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center text-gray-400">
                    <svg className="mx-auto mb-2" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M3 17l4-4a2 2 0 0 1 2.8 0L13 19" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                    <div className="text-sm">No uploaded image</div>
                  </div>
                )}
              </div>

              {/* Details on the right */}
              <div className="lg:w-2/3 w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Village details</h3>
                  <div className="text-xs text-gray-400">Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                  <DetailRow label="Name" value={villageName} />
                  <DetailRow label="Village ID" value={villageIdState ?? effectiveVillageId ?? "—"} />
                  <DetailRow label="District" value={district} />
                  <DetailRow label="Tehsil" value={tehsil} />
                  <DetailRow label="Gram Panchayat" value={gramPanchayat} />
                  <DetailRow label="Janpad" value={janpad} />
                  <DetailRow label="Forest Division" value={fd} />
                  <DetailRow label="Range" value={rangeField} />
                  <DetailRow label="SD1" value={sd1} />
                  <DetailRow label="Sub D2" value={subD2} />
                  <div className="col-span-2">
                    <DetailRow label="Site of Relocation" value={siteOfRelocation} />
                  </div>
                </div>

                {/* logs ticker */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="relative overflow-hidden h-6 bg-gray-50 rounded px-3 flex items-center border border-gray-100">
                    <div
                      className="whitespace-nowrap"
                      style={{
                        transform: `translateX(0)`,
                        animation: `marquee ${durationSeconds}s linear infinite`,
                      }}
                    >
                      {logsText}
                    </div>
                  </div>

                  <style>{`
                    @keyframes marquee {
                      0% { transform: translateX(100%); }
                      100% { transform: translateX(-100%); }
                    }
                  `}</style>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMeetingsModal && (
        <MeetingsModal
          villageId={villageIdState ?? effectiveVillageId}
          onClose={() => setShowMeetingsModal(false)}
        />
      )}

      {/* Fullscreen modal */}
      {showFullscreen && currentImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="max-w-5xl w-full mx-4 relative">
            <button onClick={closeFullscreen} className="absolute right-2 top-2 p-2 bg-white rounded-full shadow">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center justify-center gap-4">
              <button onClick={prevPhoto} className="p-3 bg-white rounded-full shadow">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <img src={currentImage} alt="fullscreen" className="max-h-[80vh] w-auto object-contain rounded" />

              <button onClick={nextPhoto} className="p-3 bg-white rounded-full shadow">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {photos.length > 1 && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-4 bg-white bg-opacity-90 rounded-full px-3 py-1 text-sm">
                {photoIndex + 1}/{photos.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Docs Modal */}
      {showDocsModal && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-12 bg-black bg-opacity-40">
          <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg overflow-auto max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Stage documents</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // quick open village docs if available
                    if (docs.length > 0) {
                      window.open(docs[0], "_blank", "noopener");
                    } else if (familyMasterList) {
                      window.open(familyMasterList, "_blank", "noopener");
                    } else {
                      setShowDocsModal(false);
                    }
                  }}
                  className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
                >
                  Open Village doc
                </button>
                <button onClick={() => setShowDocsModal(false)} className="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-sm">Close</button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {Array.isArray(stageDefs) && stageDefs.length > 0 ? (
                stageDefs.map((s, idx) => {
                  const sid = s?.stage_id ?? s?.id ?? s?.stageId ?? idx;
                  const isExpanded = expandedStages.has(String(sid));
                  const subStages = s?.subStages ?? s?.sub_stages ?? s?.subStage ?? [];

                  return (
                    <div key={String(sid)} className="border rounded-md">
                      <button
                        onClick={() => toggleStageExpand(String(sid))}
                        className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                      >
                        <div>
                          <div className="font-medium">{s?.name ?? s?.title ?? `Stage ${sid}`}</div>
                          {s?.description && <div className="text-xs text-gray-500">{s.description}</div>}
                        </div>
                        <div className="text-sm text-gray-600">{isExpanded ? "−" : "+"}</div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 bg-white">
                          {Array.isArray(subStages) && subStages.length > 0 ? (
                            <div className="space-y-2">
                              {subStages.map((ss, sidx) => {
                                const subName = typeof ss === "object" ? ss?.name ?? ss?.title ?? String(ss?.id ?? sidx + 1) : String(ss);
                                const matched = findFileFor(s, subName);
                                return (
                                  <div key={sidx} className="flex items-center justify-between gap-3 px-2 py-2 border rounded">
                                    <div className="text-sm">{subName}</div>
                                    <div className="flex items-center gap-2">
                                      {matched ? (
                                        <>
                                          <button
                                            onClick={() => openDocInViewer(matched, `${s?.name ?? "Stage"} - ${subName}`)}
                                            className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                          >
                                            View file
                                          </button>
                                          <a href={matched} target="_blank" rel="noreferrer" className="text-sm px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 underline">
                                            Open in new tab
                                          </a>
                                        </>
                                      ) : (
                                        <div className="text-sm text-gray-400">No file</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">No sub-stages defined for this stage.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500">No stages configured.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Doc Viewer Modal (iframe if possible) */}
      {showDocViewer && docViewerUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="w-full max-w-5xl bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="text-sm font-medium">{docViewerName}</div>
              <div className="flex items-center gap-2">
                <a href={docViewerUrl} target="_blank" rel="noreferrer" className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Open in new tab</a>
                <button onClick={closeDocViewer} className="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-sm">Close</button>
              </div>
            </div>

            <div className="h-[80vh] bg-gray-50 flex items-center justify-center">
              {/* Try embedding in iframe; if external source blocks embedding the user can open in new tab */}
              <iframe
                src={docViewerUrl}
                title={docViewerName}
                className="w-full h-full"
                style={{ border: "none", minHeight: "60vh" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
