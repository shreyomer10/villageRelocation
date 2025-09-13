// File: src/pages/Dashboard.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sliders, Calendar, CheckCircle, Map, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";

import MainNavbar from "../component/MainNavbar";
import VillageModal from "../component/VillageModal";
import { stageDefs } from "../config/stages";
import { AuthContext } from "../context/AuthContext";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";

// --- New Map Configuration ---
const LIBRARIES = ["places"];
const MAP_CENTER = { lat: 22.48, lng: 81.78 };
const OVERLAY_TOP_PADDING = 140;
const SUMMARY_EXPANDED_WIDTH = 520; // must match QuickSummaryTable expandedWidth
const SUMMARY_COLLAPSED_WIDTH = 56; // must match QuickSummaryTable collapsedWidth

const MAP_OPTIONS = {
  restriction: {
    latLngBounds: { north: 22.8, south: 22.3, east: 82.1, west: 81.6 },
    strictBounds: false,
  },
  minZoom: 10,
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: false,
  streetViewControl: false,
  mapTypeControl: false,
  mapTypeId: "hybrid",
};

// --- Replace your QuickSummaryTable with this corrected version ---
function QuickSummaryTable({ villages = [], maxRows = 10, isMapView = false, collapsed = false, onToggleCollapsed, onGuidelineClick }) {
  const TOTAL_SUBSTAGES = 29;
  const TOTAL_STAGES = 6;
  const rows = villages.slice(0, maxRows);

  const expandedWidth = SUMMARY_EXPANDED_WIDTH; // px
  const collapsedWidth = SUMMARY_COLLAPSED_WIDTH; // px
  const widthPx = isMapView ? (collapsed ? collapsedWidth : expandedWidth) : expandedWidth;

  function computeProgress(stage, substage) {
    const s = Number(stage) || 0;
    const sub = Number(substage) || 0;
    const perStage = TOTAL_SUBSTAGES / TOTAL_STAGES;
    const completed = Math.max(0, (s - 1) * perStage + sub);
    const pct = Math.round((completed / TOTAL_SUBSTAGES) * 100);
    return Math.min(100, Math.max(0, pct));
  }

  function getSubstageName(stage, substage) {
    try {
      const s = Number(stage) || 0;
      const sub = substage == null ? null : substage;
      const stageDef = stageDefs.find(sd => sd.stage_id === s || sd.stageId === s || sd.id === s);
      if (stageDef) {
        const list = stageDef.substages || stageDef.subStages || stageDef.subStagesList || stageDef.steps || stageDef.children || stageDef.sub || stageDef.sub_stage_list;
        if (Array.isArray(list)) {
          const found = list.find(ss => ss.substage_id === sub || ss.sub_stage_id === sub || ss.id === sub || ss.index === sub || ss.order === sub);
          if (found) return found.name ?? found.title ?? String(sub);
          if (typeof sub === 'number' && sub > 0 && list.length >= sub) return list[sub - 1].name ?? list[sub - 1].title ?? String(sub);
        }
      }
    } catch (e) {
      // ignore and fallback below
    }
    return substage == null ? '-' : String(substage);
  }

  return (
    <div
      role="region"
      aria-expanded={!collapsed}
      className="bg-white rounded-lg shadow-md relative overflow-hidden"
      style={{
        width: `${widthPx}px`,
        transition: "width 260ms cubic-bezier(.2,.9,.2,1)",
      }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h3
          className={`font-semibold text-gray-800 transition-opacity duration-200 ${
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {!collapsed ? "Quick View" : ""}
        </h3>

        <div className="flex items-center gap-2">
          {!collapsed && <div className="text-sm text-gray-500">Top {rows.length}</div>}

          {/* Guideline button moved INSIDE the QuickSummaryTable header (right corner of the table) */}
          <button
            onClick={() => typeof onGuidelineClick === 'function' && onGuidelineClick()}
            aria-label="Guideline"
            className={`px-3 py-1 rounded-md text-sm bg-white border border-gray-200 hover:bg-gray-50 focus:outline-none ${collapsed ? 'hidden' : ''}`}
            type="button"
          >
            Guideline
          </button>

          {isMapView ? (
            <button
              onClick={() => onToggleCollapsed && onToggleCollapsed((c) => !c)}
              aria-label={collapsed ? "Open quick view" : "Collapse quick view"}
              className="p-2 bg-gray-100 rounded hover:bg-gray-200 flex items-center justify-center"
              style={{ width: 36, height: 36 }}
              type="button"
            >
              {collapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          ) : (
            <div style={{ width: 36, height: 36 }} aria-hidden />
          )}
        </div>
      </div>

      <div
        className="px-3 pb-3 overflow-hidden"
        style={{
          maxHeight: collapsed ? 0 : 560,
          transition: "max-height 260ms cubic-bezier(.2,.9,.2,1), opacity 220ms",
          opacity: collapsed ? 0 : 1,
        }}
        aria-hidden={collapsed}
      >
        <div className="overflow-y-auto max-h-[520px]">
          <table className="w-full table-auto text-left text-base">
            <thead>
              <tr className="text-gray-600">
                <th className="pb-2">Village</th>
                <th className="pb-2">Stage</th>
                <th className="pb-2">Substage</th>
                <th className="pb-2">Site</th>
                <th className="pb-2">Progress</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((v) => {
                const progress = computeProgress(v.currentStage, v.currentSubStage);
                return (
                  <tr key={v.villageId} className="align-top border-t border-gray-100">
                    <td className="py-3 pr-2 truncate max-w-[220px]">{v.name}</td>
                    <td className="py-3 pr-2 text-gray-700">{v.status}</td>
                    <td className="py-3 pr-2 text-gray-600">{getSubstageName ? getSubstageName(v.currentStage, v.currentSubStage) : (v.currentSubStage ?? "-")}</td>
                    <td className="py-3 pr-2 truncate max-w-[260px]">{v.siteOfRelocation ?? "-"}</td>
                    <td className="py-3 pr-2 w-[180px]">
                      <div className="text-xs text-gray-600 mb-1">{progress}%</div>
                      <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                        <div
                          className="h-2 rounded"
                          style={{ width: `${progress}%`, transition: "width 800ms ease" }}
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No villages to show
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-3 text-xs text-gray-500">
            Progress is approximated from stage/substage. Adjust TOTAL_SUBSTAGES/TOTAL_STAGES if needed.
          </div>
        </div>
      </div>
    </div>
  );
}

const VillageCard = ({ village, onOpen }) => {
  const { name, villageId, status = "N/A", date, lastUpdatedOn } = village;
  const bgColor = status === "N/A" ? "bg-white" : "bg-violet-50";
  const displayDate = date ?? lastUpdatedOn ?? "-";

  return (
    <div
      role="button"
      onClick={() => onOpen(village)}
      className={`${bgColor} rounded-lg p-5 shadow-md hover:shadow-lg transition transform hover:-translate-y-1 cursor-pointer border border-gray-100`}
      aria-label={`Open ${name}`}
    >
      <div className="mb-3">
        <h3 className="font-semibold text-gray-800 text-lg">{name}</h3>
        <p className="text-sm text-gray-600 mt-1">Village ID: {villageId}</p>
      </div>

      <div className="flex items-center justify-between mt-6 gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 flex-1 min-w-0">
          {status !== "N/A" ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="truncate">{status}</span>
            </>
          ) : (
            <span className="text-gray-500">N/A</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm text-gray-600 flex-shrink-0">
          <Calendar className="w-4 h-4" />
          <span>{displayDate}</span>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilterOpen, setStageFilterOpen] = useState(false);
  const [selectedStages, setSelectedStages] = useState(new Set());

  const [villages, setVillages] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [selectedVillage, setSelectedVillage] = useState(null);
  const [viewMode, setViewMode] = useState("grid");

  // controls the collapsed state of the summary aside in map view
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const stageOptions = stageDefs.map((s) => s.name).concat(["N/A"]);

  const auth = useContext(AuthContext) || {};
  const { setVillageId, setVillage } = auth;

  function normalizeListItem(item = {}) {
    const villageId = item.villageId ?? item.village_id ?? String(item.villageId ?? item.village_id ?? "");
    const name = item.name ?? item.Name ?? "Unknown";
    const currentStage =
      typeof item.currentStage === "number"
        ? item.currentStage
        : typeof item.current_stage === "number"
        ? item.current_stage
        : Number(item.currentStage) || 0;

    const dateRaw = item.updatedAt ?? item.updated_at ?? item.lastUpdatedOn ?? "-";
    let date = "-";
    if (typeof dateRaw === "string" && dateRaw !== "-") {
      const parsed = new Date(dateRaw);
      date = isNaN(parsed.getTime()) ? String(dateRaw) : parsed.toLocaleString();
    } else {
      date = dateRaw || "-";
    }

    const status =
      item.status ?? (currentStage > 0 ? stageDefs.find((s) => s.stage_id === currentStage)?.name ?? `Step ${currentStage}` : "N/A");

    const updatedBy = item.updatedBy ?? item.updated_by ?? item.updatedByUser ?? item.updated_by_user ?? item.updated_by_name ?? "-";

    const lat =
      typeof item.lat === "number"
        ? item.lat
        : typeof item.latitude === "number"
        ? item.latitude
        : typeof item.lat_dd === "number"
        ? item.lat_dd
        : null;
    const lng =
      typeof item.lng === "number"
        ? item.lng
        : typeof item.long === "number"
        ? item.long
        : typeof item.longitude === "number"
        ? item.longitude
        : null;

    return {
      name,
      villageId,
      currentStage,
      currentSubStage: item.currentSubStage ?? item.current_sub_stage ?? item.substage ?? 0,
      totalStages: item.totalStages ?? stageDefs.length,
      lastUpdatedOn: item.updatedAt ?? "-",
      lastUpdatedby: item.updatedBy ?? "-",
      areaOfRelocation: item.areaOfRelocation ?? item.siteOfRelocation ?? item.area_of_relocation ?? "-",
      areaDiverted: item.areaDiverted ?? null,
      image: item.image ?? null,
      siteOfRelocation: item.siteOfRelocation ?? item.site_of_relocation ?? "-",
      updatedBy,
      rawOriginal: item,
      date,
      status,
      lat,
      lng,
    };
  }

  useEffect(() => {
    let mounted = true;

    async function loadList() {
      setListLoading(true);
      setListError(null);

      try {
        const res = await fetch("https://villagerelocation.onrender.com/villages");
        if (!res.ok) {
          throw new Error(`Error fetching villages: ${res.status}`);
        }
        const data = await res.json();
        if (!mounted) return;
        if (data.error) {
          throw new Error(data.message || "API returned an error");
        }
        const villagesData = Array.isArray(data.result) ? data.result : [];
        const normalized = villagesData.map(normalizeListItem);
        setVillages(normalized);

        if (normalized.length > 0 && normalized[0].villageId) {
          const firstId = String(normalized[0].villageId);
          localStorage.setItem("villageId", firstId);
          if (typeof setVillageId === "function") {
            try {
              setVillageId(firstId);
            } catch (e) {
              console.error("Error setting villageId in context:", e);
            }
          }
        }
      } catch (err) {
        if (!mounted) return;
        setListError(err?.message || "Failed to load villages.");
      } finally {
        if (mounted) setListLoading(false);
      }
    }

    loadList();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStage = (s) => {
    const next = new Set(selectedStages);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSelectedStages(next);
    setStageFilterOpen(false);
  };

  const handleSaveVillage = async (updatedFields) => {
    const id = updatedFields.villageId;
    if (!id) return Promise.reject(new Error("Missing villageId"));

    const prev = villages.map((v) => (v.villageId === id ? { ...v } : v));
    setVillages((prevList) => prevList.map((v) => (v.villageId === id ? { ...v, ...updatedFields, date: new Date().toLocaleString() } : v)));

    try {
      const res = await fetch(`https://villagerelocation.onrender.com/villages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });

      if (!res.ok) {
        const text = await res.text();
        setVillages(prev);
        throw new Error(`Failed to update (${res.status}): ${text}`);
      }

      const payload = await res.json();
      const updatedFromServer = normalizeListItem(payload?.result ?? payload ?? updatedFields);

      setVillages((prevList) => prevList.map((v) => (v.villageId === id ? { ...v, ...updatedFromServer } : v)));

      try {
        if (typeof setVillageId === "function") setVillageId(String(updatedFromServer.villageId));
        if (typeof setVillage === "function") setVillage(updatedFromServer);
      } catch (e) {
        console.error("Error updating context after save:", e);
      }

      try {
        localStorage.setItem("villageId", String(updatedFromServer.villageId ?? id));
        localStorage.setItem("selectedVillage", JSON.stringify(updatedFromServer));
      } catch (e) {
        console.warn("Could not write to localStorage:", e);
      }

      return updatedFromServer;
    } catch (err) {
      return Promise.reject(err);
    }
  };

  const handleOpenVillage = (village) => {
    if (!village || !village.villageId) {
      setListError("Village id missing");
      return;
    }
    setSelectedVillage(village);
    try {
      if (typeof setVillageId === "function") setVillageId(String(village.villageId));
      if (typeof setVillage === "function") setVillage(village);
    } catch (e) {
      console.error("Error setting context on open:", e);
    }
    try {
      localStorage.setItem("villageId", String(village.villageId));
      localStorage.setItem("selectedVillage", JSON.stringify(village));
    } catch (e) {
      console.warn("Could not write to localStorage:", e);
    }
  };

  const closeModal = () => setSelectedVillage(null);

  const filteredVillages = villages.filter((v) => {
    const matchSearch = [v.name, v.villageId, v.status, v.updatedBy].join(" ").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStage = selectedStages.size === 0 || selectedStages.has(v.status);
    return matchSearch && matchStage;
  });

  const storedUserRaw = localStorage.getItem("user");
  let username = "Shrey";
  try {
    if (storedUserRaw) {
      const parsed = JSON.parse(storedUserRaw);
      if (parsed?.name) username = parsed.name;
    }
  } catch (e) {
    // ignore parsing error
  }

  const handleAddVillage = () => navigate("/villages/new");
  const openProfile = (village) => {
    if (!village) return;
    navigate(`/villages/${encodeURIComponent(village.villageId)}`);
  };

  const handleMapLoad = (map) => {
    mapRef.current = map;
    try {
      map.setOptions({ zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM } });
    } catch (e) {}

    if (window.google && !geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }

    // fit considering the current collapsed/expanded width
    requestFitToFiltered();
  };

  const handleMapUnmount = () => {
    mapRef.current = null;
  };

  // Fit/pan logic that accounts for the summary box width on the right
  const requestFitToFiltered = () => {
    if (!mapRef.current || !isMapLoaded) return;
    const markers = filteredVillages.filter((v) => typeof v.lat === "number" && typeof v.lng === "number");
    const rightPadding = viewMode === "map" ? (summaryCollapsed ? SUMMARY_COLLAPSED_WIDTH : SUMMARY_EXPANDED_WIDTH) + 48 : 60;

    if (markers.length === 0) {
      mapRef.current.panTo(MAP_CENTER);
      mapRef.current.setZoom(11);
      try {
        // make a slight shift so default center isn't covered by right-side UI
        if (viewMode === "map") mapRef.current.panBy(Math.round(rightPadding / 2), -Math.round(OVERLAY_TOP_PADDING / 2));
      } catch (e) {}
      return;
    }

    if (markers.length === 1) {
      const only = markers[0];
      mapRef.current.panTo({ lat: only.lat, lng: only.lng });
      mapRef.current.setZoom(14);
      try {
        // shift the map so the single marker appears left of center and not hidden by the aside
        if (viewMode === "map") mapRef.current.panBy(Math.round(rightPadding / 2), -Math.round(OVERLAY_TOP_PADDING / 2));
      } catch (e) {}
      return;
    }

    try {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      // fit bounds while leaving extra 'right' space for the overlay
      mapRef.current.fitBounds(bounds, { top: OVERLAY_TOP_PADDING + 40, right: rightPadding, bottom: 60, left: 60 });
    } catch (e) {
      console.warn("fitBounds failed:", e);
    }
  };

  useEffect(() => {
    if (viewMode !== "map" || !isMapLoaded) return;
    // when filteredVillages or collapsed changes, re-fit
    requestFitToFiltered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVillages, viewMode, isMapLoaded, summaryCollapsed]);

  const doMapSearch = (term) => {
    if (!isMapLoaded || !mapRef.current || !term) return;
    const match = villages.find((v) => v.name && v.name.toLowerCase().includes(term.toLowerCase()) && typeof v.lat === "number" && typeof v.lng === "number");
    if (match) {
      mapRef.current.panTo({ lat: match.lat, lng: match.lng });
      mapRef.current.setZoom(14);
      try {
        const rightPadding = viewMode === "map" ? (summaryCollapsed ? SUMMARY_COLLAPSED_WIDTH : SUMMARY_EXPANDED_WIDTH) + 48 : 60;
        if (viewMode === "map") mapRef.current.panBy(Math.round(rightPadding / 2), -Math.round(OVERLAY_TOP_PADDING / 2));
      } catch (e) {}
      return;
    }

    if (geocoderRef.current) {
      geocoderRef.current.geocode({ address: term }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          mapRef.current.panTo({ lat: loc.lat(), lng: loc.lng() });
          mapRef.current.setZoom(13);
        }
      });
    }
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      if (viewMode === "map") doMapSearch(value.trim());
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const renderMapBackground = () => {
    if (viewMode !== "map") return null;
    if (!isMapLoaded) {
      return (
        <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, background: "#00000010", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="text-white text-lg">Loading Map...</div>
        </div>
      );
    }

    return (
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
        <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={MAP_CENTER} zoom={12} options={MAP_OPTIONS} onLoad={handleMapLoad} onUnmount={handleMapUnmount}>
          {filteredVillages.filter((v) => typeof v.lat === "number" && typeof v.lng === "number").map((village) => (
            <MarkerF key={village.villageId} position={{ lat: village.lat, lng: village.lng }} title={village.name} onClick={() => handleOpenVillage(village)} />
          ))}
        </GoogleMap>
      </div>
    );
  };

  const renderContent = () => {
    if (listLoading) {
      return <div className="text-center py-12">Loading villages…</div>;
    }
    if (listError) {
      return <div className="text-center py-6 text-red-600">{listError}</div>;
    }

    if (viewMode === "grid") {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {filteredVillages.map((v, i) => (
            <VillageCard key={v.villageId ?? i} village={v} onOpen={handleOpenVillage} />
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`min-h-screen font-sans ${viewMode === "map" ? "bg-transparent" : "bg-[#f8f0dc]"}`}>
      {renderMapBackground()}

      <div style={{ position: "relative", zIndex: 20 }}>
        <MainNavbar name={username} showWelcome={true} />

        <div className="px-6 py-6">
          <div className="mx-auto flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="flex items-center w-full md:max-w-2xl gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Search by name, id or status" value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" aria-label="Search villages" />
              </div>

              <div className="relative">
                <button onClick={() => setStageFilterOpen((s) => !s)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" aria-expanded={stageFilterOpen} aria-controls="stage-filter">
                  <Sliders className="w-4 h-4" />
                  <span className="text-gray-700 text-sm">Filter</span>
                </button>
                {stageFilterOpen && (
                  <div id="stage-filter" className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 p-4 z-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Stages</h4>
                      <button onClick={() => setSelectedStages(new Set())} className="text-sm text-gray-500 hover:underline">Clear</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {stageOptions.map((s) => (
                        <label key={s} className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={selectedStages.has(s)} onChange={() => toggleStage(s)} className="w-4 h-4 rounded" />
                          <span className="truncate">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center bg-gray-200 rounded-lg p-1">
                <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md ${viewMode === "grid" ? "bg-white shadow" : "hover:bg-gray-300"}`} aria-label="Grid View">
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button onClick={() => setViewMode("map")} className={`p-1.5 rounded-md ${viewMode === "map" ? "bg-white shadow" : "hover:bg-gray-300"}`} aria-label="Map View">
                  <Map className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Guideline button removed from here and placed inside the QuickSummaryTable as requested */}
            <div className="w-full md:w-auto flex justify-end">
              <div aria-hidden style={{ width: 0, height: 0 }} />
            </div>
          </div>
        </div>

        <main className="max-w-10xl mx-8 p-8 relative z-20">
          {viewMode === "map" ? (
            <div className="relative">
              <div>{renderContent()}</div>

              {/* For map view we render the aside absolutely and allow collapse/expand. The Dashboard holds collapsed state so map-fitting can account for width changes. */}
              <aside className="absolute right-6 top-28 z-40">
                <QuickSummaryTable villages={filteredVillages} maxRows={12} isMapView collapsed={summaryCollapsed} onToggleCollapsed={setSummaryCollapsed} onGuidelineClick={handleAddVillage} />
              </aside>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-8">
              <div>{renderContent()}</div>
              <aside>
                {/* In card/grid view the summary table is static (not collapsible) and sits like a normal aside */}
                <QuickSummaryTable villages={filteredVillages} maxRows={12} isMapView={false} onGuidelineClick={handleAddVillage} />
              </aside>
            </div>
          )}
        </main>

        <VillageModal open={!!selectedVillage} village={selectedVillage} onClose={closeModal} onOpenProfile={openProfile} onSaveVillage={handleSaveVillage} />

        <div className="h-20" />
      </div>
    </div>
  );
}
