﻿// src/pages/VillageDashboard.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import FamilyPieChart from "../component/FamilyPieChart";
import MainNavbar from "../component/MainNavbar";
import { stageDefs } from "../config/stages";
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/Api.js";
import Timeline from "../component/Timeline";

export default function VillageDashboard() {
  const navigate = useNavigate();
  const { selectedVillageId } = useContext(AuthContext) || {};

  const [localStorageVillageId, setLocalStorageVillageId] = useState(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("villageId") : null;
    } catch {
      return null;
    }
  });
  const effectiveVillageId = selectedVillageId ?? localStorageVillageId;

  // counts
  const [total, setTotal] = useState(0);
  const [opt1, setOpt1] = useState(0);
  const [opt2, setOpt2] = useState(0);

  // village fields
  const [villageName, setVillageName] = useState("User");
  const [currentStage, setCurrentStage] = useState(null);
  const [currentSubStage, setCurrentSubStage] = useState(null);
  const [completedSubstages, setCompletedSubstages] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [areaDiverted, setAreaDiverted] = useState(null);
  const [locationText, setLocationText] = useState("");
  const [imageUrl, setImageUrl] = useState(null);

  // photos
  const [photos, setPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // metadata
  const [district, setDistrict] = useState(null);
  const [docs, setDocs] = useState([]); // normalized: {name, url}
  const [familyMasterList, setFamilyMasterList] = useState(null);
  const [fd, setFd] = useState(null);
  const [gramPanchayat, setGramPanchayat] = useState(null);
  const [janpad, setJanpad] = useState(null);
  const [kme, setKme] = useState(null);
  const [rangeField, setRangeField] = useState(null);
  const [sd1, setSd1] = useState(null);
  const [siteOfRelocation, setSiteOfRelocation] = useState(null);
  const [tehsil, setTehsil] = useState(null);
  const [villageIdState, setVillageIdState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [beat, setBeat] = useState(null);
  const [circle, setCircle] = useState(null);

  // UI states
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingVillage, setLoadingVillage] = useState(true);
  const [error, setError] = useState(null);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [docViewerUrl, setDocViewerUrl] = useState(null);
  const [docViewerName, setDocViewerName] = useState(null);
  const [showDocViewer, setShowDocViewer] = useState(false);

  // timeline selection state (only used to highlight a circle)
  const [selectedStageKey, setSelectedStageKey] = useState(null);

  const storedUserRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  useEffect(() => {
    if (storedUserRaw) {
      try {
        const parsed = JSON.parse(storedUserRaw);
        if (parsed?.name) setVillageName(parsed.name);
      } catch {}
    }
  }, [storedUserRaw]);

  // sync localStorage
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

  // helper: format date
  function fmtDate(iso) {
    try {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d)) return String(iso);
      return d.toLocaleDateString() + " " + d.toLocaleTimeString();
    } catch {
      return String(iso);
    }
  }

  // fetch counts & village
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
        const res = await fetch(`${API_BASE}/villages/${encodeURIComponent(villageId)}/family-count`, { method: "GET", headers, signal: controllerCounts.signal });
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
          setVillageName("User");
          setCurrentStage(null);
          setCurrentSubStage(null);
          setCompletedSubstages([]);
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
          setTehsil(null);
          setVillageIdState(null);
          setPhotos([]);
          setPhotoIndex(0);
          return;
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/villages/${encodeURIComponent(villageId)}`, { method: "GET", headers, signal: controllerVillage.signal });
        if (!res.ok) throw new Error("Failed to fetch village");
        const payload = await res.json();
        if (!mounted) return;
        const result = payload?.result ?? payload;

        if (result?.name) setVillageName(result.name);
        setCurrentStage(result?.currentStage ?? result?.current_stage ?? result?.stage ?? null);
        setCurrentSubStage(result?.currentSubStage ?? result?.current_sub_stage ?? result?.subStage ?? null);
        setCompletedSubstages(Array.isArray(result.completed_substages) ? result.completed_substages : []);

        const logsArr = Array.isArray(result.logs) ? result.logs : [];
        setLogs(logsArr);
        if (logsArr.length > 0) {
          const lastLog = logsArr[logsArr.length - 1];
          setLastUpdated(lastLog.updateTime ?? lastLog.update_time ?? lastLog.timestamp ?? null);
        } else {
          setLastUpdated(null);
        }

        const lat = result.lat ?? result.latitude ?? null;
        const lon = result.long ?? result.lng ?? result.longitude ?? null;
        if (lat || lon) setLocationText(`${lat ?? "-"}, ${lon ?? "-"}`);
        else setLocationText("");

        setSiteOfRelocation(result.siteOfRelocation ?? null);

        const photosArr = Array.isArray(result.photos) && result.photos.length > 0 ? result.photos : result.photo ? [result.photo] : [];
        setPhotos(photosArr);
        setPhotoIndex(0);
        setImageUrl(photosArr.length > 0 ? photosArr[0] : null);

        setAreaDiverted(result.areaDiverted ?? result.area_diverted ?? result.area ?? null);
        setDistrict(result.district ?? result?.District ?? null);

        // normalize docs -> {name, url}
        let normalizedDocs = [];
        if (Array.isArray(result.docs)) {
          normalizedDocs = result.docs
            .map((d) => {
              if (!d) return null;
              if (typeof d === "string") return { name: null, url: d };
              const name = d.name ?? d.title ?? null;
              const url = d.url ?? d.link ?? d.path ?? null;
              return { name, url };
            })
            .filter(Boolean);
        } else if (result.docs && typeof result.docs === "object") {
          const d = result.docs;
          const name = d.name ?? d.title ?? null;
          const url = d.url ?? d.link ?? null;
          normalizedDocs = [{ name, url }];
        }
        setDocs(normalizedDocs);

        setFamilyMasterList(result.familyMasterList ?? result.family_master_list ?? null);
        setFd(result.fd ?? result.forestDivision ?? null);
        setGramPanchayat(result.gramPanchayat ?? result.gram_panchayat ?? null);
        setJanpad(result.janpad ?? result.jan_pad ?? null);
        setKme(result.kme ?? null);
        setRangeField(result.range ?? result.rangeField ?? null);
        setSd1(result.sd ?? null);
        setTehsil(result.tehsil ?? null);
        setVillageIdState(result.villageId ?? result.village_id ?? result.id ?? null);

        setBeat(result.beat ?? null);
        setCircle(result.circle ?? null);
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

  // image helpers
  const currentImage = photos.length > 0 ? photos[photoIndex] : imageUrl;
  function nextPhoto(e) { if (e && e.stopPropagation) e.stopPropagation(); if (!photos || photos.length === 0) return; const next = (photoIndex + 1) % photos.length; setPhotoIndex(next); setImageUrl(photos[next]); }
  function prevPhoto(e) { if (e && e.stopPropagation) e.stopPropagation(); if (!photos || photos.length === 0) return; const prev = (photoIndex - 1 + photos.length) % photos.length; setPhotoIndex(prev); setImageUrl(photos[prev]); }
  function openFullscreen(e) { if (e && e.stopPropagation) e.stopPropagation(); if (!currentImage) return; setShowFullscreen(true); }
  function closeFullscreen() { setShowFullscreen(false); }
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

  // timeline click -> simply highlight circle and set current stage (optional)
  function handleTimelineSelect(stageObj, idx) {
    setSelectedStageKey(stageObj.stageId ?? `s-${idx}`);
    // optionally set current stage/substage for dashboard view (keeps UI in sync)
    setCurrentStage(stageObj.stageId ?? idx + 1);
    setCurrentSubStage(null);
  }

  function getCurrentStageName(stage, subStage) {
    if (!Array.isArray(stageDefs) || stageDefs.length === 0) return stage ?? "Unknown Stage";
    const stageStr = stage === null || stage === undefined ? "" : String(stage);
    const subStr = subStage === null || subStage === undefined ? "" : String(subStage);
    const stageNumMatch = stageStr.match(/(\d+)/);
    let stageObj =
      stageDefs.find((s) => {
        const id = s?.stage_id ?? s?.id ?? s?.stageId;
        return String(id) === stageStr || (stageNumMatch && String(id) === stageNumMatch[1]);
      }) ||
      stageDefs.find((s) => String(s?.name ?? "").toLowerCase().includes(stageStr.toLowerCase()));
    if (!stageObj && stageNumMatch) {
      const idx = Number(stageNumMatch[1]);
      stageObj = stageDefs.find((s) => {
        const id = s?.stage_id ?? s?.id ?? s?.stageId;
        return Number(id) === idx || String(id) === String(idx);
      });
    }
    if (!stageObj) return stageStr || "Unknown Stage";
    const subStages = stageObj.subStages ?? stageObj.sub_stages ?? stageObj.subStage ?? [];
    if (!subStage || !Array.isArray(subStages) || subStages.length === 0) return stageObj.name ?? stageStr;
    let subName = null;
    if (typeof subStages[0] === "object" && subStages[0] !== null) {
      subName =
        subStages.find((ss) => String(ss?.id ?? ss?.sub_id ?? ss?.subId ?? ss?.name) === subStr || String(ss?.name ?? "").toLowerCase().includes(subStr.toLowerCase()))?.name ??
        null;
      if (!subName) {
        const idx = Number(subStr.match(/(\d+)/)?.[1]);
        if (!Number.isNaN(idx) && idx >= 1 && idx <= subStages.length) subName = subStages[idx - 1]?.name ?? null;
      }
    } else {
      const idx = Number(subStr.match(/(\d+)/)?.[1]);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= subStages.length) subName = subStages[idx - 1];
      else {
        const found = subStages.find((ss) => String(ss) === subStr);
        if (found) subName = found;
      }
    }
    if (subName) return `${stageObj.name} - ${subName}`;
    return stageObj.name ?? stageStr;
  }

  function DetailRow({ label, value, href }) {
    return (
      <div className="flex items-start gap-3">
        <div className="w-36 text-xs text-gray-500">{label}</div>
        <div className="text-sm text-gray-800 break-words">
          {value ? (href ? <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">{value}</a> : <span>{value}</span>) : <span className="text-gray-400">—</span>}
        </div>
      </div>
    );
  }

  function findFileFor(stageObj, subName) {
    const tokens = [];
    if (stageObj?.name) tokens.push(String(stageObj.name).toLowerCase());
    if (stageObj?.stageId) tokens.push(String(stageObj.stageId).toLowerCase());
    if (subName) tokens.push(String(subName).toLowerCase());

    if (Array.isArray(docs) && docs.length > 0) {
      for (const d of docs) {
        try {
          const lowerUrl = String(d.url ?? "").toLowerCase();
          const lowerName = String(d.name ?? "").toLowerCase();
          if (tokens.some((t) => (t && (lowerUrl.includes(t.replace(/\s+/g, "-") ) || lowerUrl.includes(t) || lowerName.includes(t))))) {
            return d;
          }
        } catch {}
      }
      return docs[0];
    }
    if (familyMasterList) return { name: "Family Master List", url: familyMasterList };
    return null;
  }

  function openDocInViewer(docObj, name) {
    if (!docObj) return;
    const url = typeof docObj === "string" ? docObj : docObj.url ?? null;
    if (!url) return;
    setDocViewerUrl(url);
    setDocViewerName(name ?? docObj.name ?? "Document");
    setShowDocViewer(true);
  }
  function closeDocViewer() {
    setShowDocViewer(false);
    setDocViewerUrl(null);
    setDocViewerName(null);
  }

  const googleMapsLink = (() => {
    const lat = locationText?.split?.(",")?.[0]?.trim();
    const lon = locationText?.split?.(",")?.[1]?.trim();
    if (lat && lon && lat !== "-" && lon !== "-") {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + "," + lon)}`;
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar village={effectiveVillageId} showVillageInNavbar={true} />

      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{district ?? "—"}</h1>
            <div className="text-sm text-gray-500">{villageName}</div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm">← Back</button>
            <button onClick={() => navigate("/family")} className="bg-green-200 hover:bg-green-300 px-4 py-2 rounded-lg shadow text-sm font-medium">All Beneficiaries</button>
            <button onClick={() => setShowDocsModal(true)} className="bg-indigo-50 hover:bg-indigo-100 px-6 py-2 rounded-2xl shadow text-sm font-medium" title="Open stage documents">Docs</button>
            <button onClick={() => navigate(`/plots`)} className="bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-2xl shadow text-sm font-medium" title="Open plots for this village">Plots</button>
            <button onClick={() => navigate(`/meetings`)} className="bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-2xl shadow text-sm font-medium" title="Open meetings for this village">Meetings</button>
            <button onClick={() => navigate(`/buildings`)} className="bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-2xl shadow text-sm font-medium" title="Open buildings for this village">Buildings</button>
            <button onClick={() => navigate(`/feedbacks`)} className="bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-2xl shadow text-sm font-medium" title="Open buildings for this village">feedbacks</button>
          </div>
        </div>

        {/* top row */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <div className="bg-gradient-to-br from-white to-amber-50 rounded-2xl p-6 shadow-lg border border-gray-100 h-full flex flex-col gap-1">
              <FamilyPieChart total={total} opt1={opt1} opt2={opt2} loading={loadingCounts} error={error} villageId={villageIdState || effectiveVillageId} />
              <a href={familyMasterList} target="_blank" rel="noreferrer" className="text-blue-600 underline text-center">Family Master List</a>
            </div>
          </div>

          <div className="col-span-12 md:col-span-8 flex flex-col gap-6">
            {/* Timeline only (REUSABLE) */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Stages Of Relocation</h3>
                <div className="text-sm text-gray-500">Current: <span className="font-medium text-gray-800">{getCurrentStageName(currentStage, currentSubStage)}</span></div>
              </div>

              <Timeline
                currentStage={currentStage}
                currentSubStage={currentSubStage}
                completedSubstages={completedSubstages}
                onStageSelect={handleTimelineSelect}
              />
            </div>

            {/* Location boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Old Location (Coordinates)</h4>
                  <div className="text-xs text-gray-400">Source: lat/long</div>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {locationText ? (
                    <>
                      <div>{locationText}</div>
                      {googleMapsLink && <a href={googleMapsLink} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm mt-1 inline-block">Open in Google Maps</a>}
                    </>
                  ) : (
                    <div className="text-gray-400">Not available</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">New Location (Site)</h4>
                  <div className="text-xs text-gray-400">Site of Relocation</div>
                </div>
                <div className="text-sm text-gray-600 mt-2">{siteOfRelocation ?? <span className="text-gray-400">Not available</span>}</div>
              </div>
            </div>
          </div>
        </div>

        {/* details (image + village details) */}
        <div className="mt-6">
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* image left */}
              <div className="lg:w-1/3 w-full rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-100 group relative">
                {currentImage ? (
                  <>
                    <img src={currentImage} alt="uploaded" className="w-full h-64 object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-20 opacity-0 group-hover:opacity-100 transition flex items-center justify-between px-4">
                      <button onClick={prevPhoto} title="Previous photo" className="p-3 bg-white bg-opacity-95 rounded-full shadow hover:scale-105">◀</button>
                      <div className="flex gap-3 items-center">
                        <button onClick={nextPhoto} title="Next photo" className="p-3 bg-white bg-opacity-95 rounded-full shadow hover:scale-105">▶</button>
                        <button onClick={openFullscreen} title="View fullscreen" className="p-3 bg-white bg-opacity-95 rounded-full shadow hover:scale-105">⤢</button>
                      </div>
                    </div>
                    {photos.length > 1 && <div className="absolute left-2 top-2 bg-white bg-opacity-90 rounded-full px-2 py-0.5 text-xs font-medium">{photoIndex + 1}/{photos.length}</div>}
                  </>
                ) : (
                  <div className="p-6 text-center text-gray-400">
                    <div className="text-sm">No uploaded image</div>
                  </div>
                )}
              </div>

              {/* details right */}
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
                  <DetailRow label="Beat" value={beat} />
                  <DetailRow label="Circle" value={circle} />
                  <div className="col-span-2">
                    <DetailRow label="Site of Relocation" value={siteOfRelocation} />
                  </div>
                </div>

                {/* removed animated logs ticker from here per request */}
              </div>
            </div>

            {/* removed documents quick list from inside village details box as requested */}
          </div>

          {/* Logs table - placed below the village detail box */}
          <div className="mt-4 bg-white rounded-2xl p-4 shadow border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Logs</h4>
              <div className="text-xs text-gray-400">Showing recent updates</div>
            </div>

            {Array.isArray(logs) && logs.length > 0 ? (
              <div className="overflow-auto">
                <table className="min-w-full text-sm align-middle">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">By</th>
                      <th className="py-2 pr-4">Comments</th>
                      <th className="py-2 pr-4">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice().reverse().map((l, i) => {
                      const t = l.updateTime ?? l.update_time ?? l.time ?? l.timestamp ?? null;
                      const who = l.updateBy ?? l.update_by ?? l.by ?? "Unknown";
                      const comments = l.comments ?? l.comment ?? l.msg ?? l.message ?? "No comments";
                      const source = l.source ?? l.from ?? "-";
                      return (
                        <tr key={i} className="border-t">
                          <td className="py-3 pr-4 align-top w-48 text-gray-700">{fmtDate(t) || "-"}</td>
                          <td className="py-3 pr-4 align-top text-gray-700">{who}</td>
                          <td className="py-3 pr-4 align-top text-gray-700">{comments}</td>
                          <td className="py-3 pr-4 align-top text-gray-500">{source}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No logs available.</div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen modal */}
      {showFullscreen && currentImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="max-w-5xl w-full mx-4 relative">
            <button onClick={closeFullscreen} className="absolute right-2 top-2 p-2 bg-white rounded-full shadow">✕</button>
            <div className="flex items-center justify-center gap-4">
              <button onClick={prevPhoto} className="p-3 bg-white rounded-full shadow">◀</button>
              <img src={currentImage} alt="fullscreen" className="max-h-[80vh] w-auto object-contain rounded" />
              <button onClick={nextPhoto} className="p-3 bg-white rounded-full shadow">▶</button>
            </div>
            {photos.length > 1 && <div className="absolute left-1/2 -translate-x-1/2 bottom-4 bg-white bg-opacity-90 rounded-full px-3 py-1 text-sm">{photoIndex + 1}/{photos.length}</div>}
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
                <button onClick={() => { if (docs.length > 0) { window.open(docs[0].url, "_blank", "noopener"); } else if (familyMasterList) { window.open(familyMasterList, "_blank", "noopener"); } else { setShowDocsModal(false); }}} className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Open Village doc</button>
                <button onClick={() => setShowDocsModal(false)} className="px-3 py-1 rounded bg-red-50 hover:bg-red-100 text-sm">Close</button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {Array.isArray(stageDefs) && stageDefs.length > 0 ? (
                stageDefs.map((s, idx) => {
                  const sid = s?.stage_id ?? s?.id ?? s?.stageId ?? idx;
                  const subStages = s?.subStages ?? s?.sub_stages ?? s?.stages ?? [];
                  return (
                    <div key={String(sid)} className="border rounded-md">
                      <div className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50">
                        <div>
                          <div className="font-medium">{s?.name ?? s?.title ?? `Stage ${sid}`}</div>
                          {s?.description && <div className="text-xs text-gray-500">{s.description}</div>}
                        </div>
                      </div>

                      <div className="p-3 bg-white">
                        {Array.isArray(subStages) && subStages.length > 0 ? (
                          <div className="space-y-2">
                            {subStages.map((ss, sidx) => {
                              const subName = typeof ss === "object" ? ss?.name ?? ss?.title ?? String(ss?.subStageId ?? sidx + 1) : String(ss);
                              const matched = findFileFor(s, subName);
                              return (
                                <div key={sidx} className="flex items-center justify-between gap-3 px-2 py-2 border rounded">
                                  <div className="text-sm">{subName}</div>
                                  <div className="flex items-center gap-2">
                                    {matched ? (
                                      <>
                                        <button onClick={() => openDocInViewer(matched, `${s?.name ?? "Stage"} - ${subName}`)} className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">View file</button>
                                        <a href={matched.url} target="_blank" rel="noreferrer" className="text-sm px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 underline">Open in new tab</a>
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

      {/* Doc Viewer */}
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
              <iframe src={docViewerUrl} title={docViewerName} className="w-full h-full" style={{ border: "none", minHeight: "60vh" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
