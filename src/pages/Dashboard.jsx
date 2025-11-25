import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sliders, LayoutGrid } from "lucide-react";

import MainNavbar from "../component/MainNavbar";
import VillageModal from "../component/VillageModal";

// Use centralized API base
import { API_BASE } from "../config/Api";

import { AuthContext } from "../context/AuthContext";

// Utility: safely parse numbers from strings
function toNumberOrNull(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const DEFAULT_STAGE_COUNT = 6; // used when stages list is unavailable
const DEFAULT_TOTAL_SUBSTAGES = 29;

// Compact card used in grid view (limited fields shown)
function VillageCardCompact({ village, onOpen, computeProgress, totalSubstages, stagesList }) {
  const { name, villageId, date } = village;

  const progress = typeof computeProgress === "function" ? computeProgress(village) : (() => {
    // fallback: approximate from stage numbers
    const TOTAL_SUBSTAGES = totalSubstages || DEFAULT_TOTAL_SUBSTAGES;
    const TOTAL_STAGES = stagesList?.length || DEFAULT_STAGE_COUNT;
    const s = Number(village.currentStage) || 0;
    const sub = Number(village.currentSubStage) || 0;
    const perStage = TOTAL_SUBSTAGES / TOTAL_STAGES;
    const completed = Math.max(0, (s - 1) * perStage + sub);
    return Math.min(100, Math.max(0, Math.round((completed / TOTAL_SUBSTAGES) * 100)));
  })();

  return (
    <div role="button" onClick={() => onOpen(village)} className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 cursor-pointer border border-gray-100">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">{name} (<span className="font-medium">{villageId}</span>)</h3>
        </div>
        <div className="text-xs text-gray-500 text-right">
          <div>{date ?? "-"}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="w-full">
          <div className="text-xs text-gray-600 mb-1">{progress}%</div>
          <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
            <div className="h-2 rounded bg-green-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Grid of compact cards
function VillagesCardGrid({ villages = [], onCardClick, onCardHoverStart, onCardHoverEnd, computeProgress, totalSubstages, stagesList }) {
  if (!Array.isArray(villages) || villages.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No villages to show</div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {villages.map((v) => (
        <div key={v.villageId} onMouseEnter={() => onCardHoverStart?.(v)} onMouseLeave={() => onCardHoverEnd?.(v)}>
          <VillageCardCompact village={v} onOpen={onCardClick} computeProgress={computeProgress} totalSubstages={totalSubstages} stagesList={stagesList} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilterOpen, setStageFilterOpen] = useState(false);
  const [selectedStages, setSelectedStages] = useState(new Set());

  const [villages, setVillages] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  // stages fetched from backend
  const [stagesList, setStagesList] = useState([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [stagesError, setStagesError] = useState(null);

  const [selectedVillage, setSelectedVillage] = useState(null);

  // track hovered card id for consistency with previous behavior
  const [hoveredVillageId, setHoveredVillageId] = useState(null);

  const hoverTimeoutRef = useRef(null);
  const rowHoverTimeoutRef = useRef(null);
  const filterButtonRef = useRef(null);
  const adminButtonRef = useRef(null);
  const adminHoverTimeoutRef = useRef(null);

  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const auth = useContext(AuthContext) || {};
  const { setVillageId, setVillage } = auth;

  // compute total substages from fetched stages (fallback to DEFAULT_TOTAL_SUBSTAGES)
  const totalSubstages = React.useMemo(() => {
    try {
      if (Array.isArray(stagesList) && stagesList.length > 0) {
        return stagesList.reduce((acc, s) => {
          const list = s.stages || s.substages || s.subStages || s.steps || s.children || s.sub || s.sub_stage_list || [];
          return acc + (Array.isArray(list) ? list.length : 0);
        }, 0);
      }
    } catch (e) {}
    return DEFAULT_TOTAL_SUBSTAGES;
  }, [stagesList]);

  // compute progress by mapping village.completed_substages against stagesList
  const computeProgress = (village) => {
    try {
      const completed = Array.isArray(village.completed_substages) ? village.completed_substages : (village.completedSubstages || village.completed || []);

      if (Array.isArray(stagesList) && stagesList.length > 0) {
        const knownSubStages = new Set();
        stagesList.forEach((stage) => {
          const list = stage.stages || stage.substages || stage.subStages || stage.steps || [];
          if (Array.isArray(list)) {
            list.forEach((ss) => {
              if (ss && (ss.subStageId || ss.sub_stage_id || ss.substage_id || ss.id)) {
                knownSubStages.add(String(ss.subStageId ?? ss.sub_stage_id ?? ss.substage_id ?? ss.id));
              }
            });
          }
        });

        const uniqueCompleted = Array.from(new Set(completed.map(String))).filter((c) => knownSubStages.has(c));
        const completedCount = uniqueCompleted.length;
        if (totalSubstages > 0) {
          return Math.min(100, Math.max(0, Math.round((completedCount / totalSubstages) * 100)));
        }
      }

      if (Array.isArray(completed) && completed.length > 0) {
        const unique = Array.from(new Set(completed.map(String)));
        if (totalSubstages > 0) return Math.min(100, Math.max(0, Math.round((unique.length / totalSubstages) * 100)));
      }

      const sRaw = village.currentStage ?? village.current_stage ?? "";
      const subRaw = village.currentSubStage ?? village.current_sub_stage ?? "";
      let stageIndex = 0;
      if (sRaw && Array.isArray(stagesList)) {
        const idx = stagesList.findIndex(st => String(st.stageId ?? st.stage_id ?? st.id) === String(sRaw));
        stageIndex = idx >= 0 ? idx + 1 : 0;
      }
      const s = stageIndex || Number(sRaw) || 0;
      const sub = Number(subRaw) || 0;
      const perStage = totalSubstages / (stagesList?.length || DEFAULT_STAGE_COUNT);
      const completedApprox = Math.max(0, (s - 1) * perStage + sub);
      return Math.min(100, Math.max(0, Math.round((completedApprox / totalSubstages) * 100)));
    } catch (e) {
      return 0;
    }
  };

  // Stage options for filter: use fetched stages names when available
  const stageOptions = React.useMemo(() => {
    if (Array.isArray(stagesList) && stagesList.length > 0) return stagesList.map((s) => s.name).concat(["N/A"]);
    return ["N/A"];
  }, [stagesList]);

  function normalizeListItem(item = {}) {
    const villageId = item.villageId ?? item.village_id ?? String(item.villageId ?? item.village_id ?? "");
    const name = item.name ?? item.Name ?? "Unknown";

    const currentStage = (item.currentStage ?? item.current_stage ?? item.currentStageId ?? item.stageId ?? "") + "";
    const currentSubStage = (item.currentSubStage ?? item.current_sub_stage ?? item.substage ?? item.currentSubStageId ?? "") + "";

    const dateRaw = item.updatedAt ?? item.updated_at ?? item.lastUpdatedOn ?? item.date ?? "-";
    let date = "-";
    if (typeof dateRaw === "string" && dateRaw !== "-") {
      const parsed = new Date(dateRaw);
      date = isNaN(parsed.getTime()) ? String(dateRaw) : parsed.toLocaleString();
    } else {
      date = dateRaw || "-";
    }

    // derive status name from fetched stagesList when possible; otherwise fallback to Step X or provided status
    const status = item.status ?? (currentStage ? (Array.isArray(stagesList) && stagesList.length > 0 ? (stagesList.find((s) => String(s.stageId ?? s.stage_id ?? s.id) === String(currentStage))?.name) : `Step ${currentStage}`) : "N/A");

    const updatedBy = item.updatedBy ?? item.updated_by ?? item.updatedByUser ?? item.updated_by_user ?? item.updated_by_name ?? "-";

    const lat = toNumberOrNull(item.lat ?? item.latitude ?? item.lat_dd ?? item.latitude_dd ?? item.coordinates?.lat ?? null);
    const lng = toNumberOrNull(item.lng ?? item.long ?? item.longitude ?? item.longitude_dd ?? item.coordinates?.lng ?? null);

    return {
      name,
      villageId,
      currentStage,
      currentSubStage,
      completed_substages: item.completed_substages ?? item.completedSubstages ?? item.completed ?? [],
      totalStages: item.totalStages ?? (Array.isArray(stagesList) && stagesList.length > 0 ? stagesList.length : DEFAULT_STAGE_COUNT),
      lastUpdatedOn: item.updatedAt ?? item.date ?? "-",
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

    async function loadStages() {
      setStagesLoading(true);
      setStagesError(null);
      try {
        const res = await fetch(`${API_BASE}/stages`);
        if (!res.ok) throw new Error(`Failed to fetch stages: ${res.status}`);
        const data = await res.json();
        let list = [];
        if (Array.isArray(data)) list = data;
        else if (data?.result) {
          if (Array.isArray(data.result)) list = data.result;
          else if (Array.isArray(data.result.items)) list = data.result.items;
          else if (Array.isArray(data.result.items?.items)) list = data.result.items.items;
        } else if (Array.isArray(data.items)) list = data.items;
        if (!mounted) return;
        setStagesList(list || []);
      } catch (err) {
        if (!mounted) return;
        setStagesError(err?.message ?? String(err));
      } finally {
        if (mounted) setStagesLoading(false);
      }
    }

    loadStages();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadList() {
      setListLoading(true);
      setListError(null);

      try {
        const res = await fetch(`${API_BASE}/villages`);
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
  }, [stagesList]); // reload villages when stagesList changes so status/progress can use latest stages

  const toggleStage = (s) => {
    const next = new Set(selectedStages);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSelectedStages(next);
    setStageFilterOpen(false);
  };

  // Helper: extract emp_id from stored user object
  function getEmpIdFromLocalStorage() {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.emp_id ?? parsed?.id ?? parsed?._id ?? parsed?.userId ?? null;
    } catch (e) {
      return null;
    }
  }

  // Unified save handler — handles both insert (POST) and update (PUT)
  const handleSaveVillage = async (updatedFields) => {
    const isNew = updatedFields?.isNew || selectedVillage?.isNew || false;
    const empId = getEmpIdFromLocalStorage();
    if (!empId) {
      return Promise.reject(new Error("User identity (emp_id) not found in localStorage. Please login."));
    }

    if (isNew) {
      try {
        const payload = { ...updatedFields };
        payload.emp_id = empId;
        delete payload.isNew;

        const res = await fetch(`${API_BASE}/villages/insert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Insert failed (${res.status}): ${text}`);
        }

        const body = await res.json();
        const inserted = body?.result ?? body;
        const normalized = normalizeListItem(inserted);

        setVillages((prev) => [normalized, ...prev]);

        try {
          if (typeof setVillageId === "function") setVillageId(String(normalized.villageId));
          if (typeof setVillage === "function") setVillage(normalized);
          localStorage.setItem("villageId", String(normalized.villageId));
          localStorage.setItem("selectedVillage", JSON.stringify(normalized));
        } catch (e) {
          console.warn("Could not write to localStorage after insert:", e);
        }

        setSelectedVillage(normalized);
        return normalized;
      } catch (err) {
        return Promise.reject(err);
      }
    } else {
      const id = updatedFields.villageId ?? selectedVillage?.villageId;
      if (!id) return Promise.reject(new Error("Missing villageId for update"));

      try {
        const payload = { ...updatedFields };
        payload.emp_id = empId;

        const res = await fetch(`${API_BASE}/villages/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Update failed (${res.status}): ${text}`);
        }

        const nowDate = new Date().toLocaleString();
        setVillages((prevList) => prevList.map((v) => (String(v.villageId) === String(id) ? { ...v, ...payload, date: nowDate } : v)));

        const updatedVillage = null;
        try {
          if (typeof setVillageId === "function") setVillageId(String(id));
          if (typeof setVillage === "function") setVillage(updatedVillage);
          localStorage.setItem("villageId", String(id));
        } catch (e) {
          console.warn("Could not write to localStorage after update:", e);
        }

        const merged = { ...(updatedVillage ?? {}), ...payload, date: nowDate };
        setSelectedVillage(merged);
        return merged;
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };

  // Delete handler: soft or hard
  const handleDeleteVillage = async (villageId, { hard = false } = {}) => {
    const empId = getEmpIdFromLocalStorage();
    if (!empId) throw new Error("User identity (emp_id) not found in localStorage.");
    try {
      if (hard) {
        const res = await fetch(`${API_BASE}/villages/${encodeURIComponent(villageId)}/hard`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Hard delete failed (${res.status}): ${text}`);
        }
      } else {
        const res = await fetch(`${API_BASE}/villages/${encodeURIComponent(villageId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emp_id: empId }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Delete failed (${res.status}): ${text}`);
        }
      }

      setVillages((prev) => prev.filter((v) => String(v.villageId) !== String(villageId)));
      setSelectedVillage(null);
      try {
        localStorage.removeItem("selectedVillage");
      } catch (e) {}

      return true;
    } catch (err) {
      throw err;
    }
  };

  const handleOpenVillage = (village) => {
    if (!village || !village.villageId) {
      setListError("Village id missing");
      return;
    }
    setSelectedVillage(village);
    setHoveredVillageId(String(village.villageId));

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

  const openNewVillageModal = () => {
    setSelectedVillage({ isNew: true, name: "", siteOfRelocation: "", currentStage: 0, currentSubStage: 0 });
  };

  const closeModal = () => {
    setSelectedVillage(null);
    setTimeout(() => setHoveredVillageId(null), 80);
  };

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
  } catch (e) {}

  const handleRowHoverStart = (village) => {
    if (!village) return;
    if (rowHoverTimeoutRef.current) {
      clearTimeout(rowHoverTimeoutRef.current);
      rowHoverTimeoutRef.current = null;
    }
    setHoveredVillageId(String(village.villageId));
  };

  const handleRowHoverEnd = (_village) => {
    if (rowHoverTimeoutRef.current) clearTimeout(rowHoverTimeoutRef.current);
    rowHoverTimeoutRef.current = setTimeout(() => setHoveredVillageId(null), 120);
  };

  // Admin menu handlers
  const openAdminMenu = () => setAdminMenuOpen(true);
  const closeAdminMenu = () => setAdminMenuOpen(false);

  useEffect(() => {
    function handleDocClick(e) {
      if (!adminButtonRef.current) return;
      if (!adminButtonRef.current.contains(e.target)) setAdminMenuOpen(false);
    }
    if (adminMenuOpen) document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [adminMenuOpen]);

  const renderContent = () => {
    if (listLoading || stagesLoading) return <div className="text-center py-12">Loading villages…</div>;
    if (listError) return <div className="text-center py-6 text-red-600">{listError}</div>;
    if (stagesError) return <div className="text-center py-6 text-red-600">Stages load error: {stagesError}</div>;

    return (
      <div>
        <div className="mb-4">
          <VillagesCardGrid
            villages={filteredVillages}
            onCardClick={handleOpenVillage}
            onCardHoverStart={handleRowHoverStart}
            onCardHoverEnd={handleRowHoverEnd}
            computeProgress={computeProgress}
            totalSubstages={totalSubstages}
            stagesList={stagesList}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-[#f8f0dc]">
      <div style={{ pointerEvents: "auto" }}>
        <MainNavbar name={(() => {
          const storedUserRaw = localStorage.getItem("user");
          try {
            if (storedUserRaw) {
              const parsed = JSON.parse(storedUserRaw);
              if (parsed?.name) return parsed.name;
            }
          } catch (e) {}
          return "Shrey";
        })()} showWelcome={true} />
      </div>

      <div style={{ pointerEvents: "auto" }} className="px-6 py-6">
        <div className="mx-auto flex flex-col md:flex-row items center gap-4 justify-between">
          <div className="flex items-center w-full md:max-w-2xl gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Search by name, id or status" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" aria-label="Search villages" />
            </div>

            <div className="relative" ref={filterButtonRef} onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setStageFilterOpen(true); }} onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setStageFilterOpen(false), 150); }} onFocus={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setStageFilterOpen(true); }} onBlur={() => { hoverTimeoutRef.current = setTimeout(() => setStageFilterOpen(false), 150); }}>
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
          </div>

          <div className="w-full md:w-auto flex items-center justify-end gap-3">
            <div className="relative">
              <button onClick={openNewVillageModal} className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50">Add Village</button>
            </div>

            {/* ADMIN DROPDOWN BUTTON (added as requested) */}
            <div className="relative" ref={adminButtonRef}
              onMouseEnter={() => { if (adminHoverTimeoutRef.current) clearTimeout(adminHoverTimeoutRef.current); setAdminMenuOpen(true); }}
              onMouseLeave={() => { adminHoverTimeoutRef.current = setTimeout(() => setAdminMenuOpen(false), 150); }}
            >
              <button
                onClick={() => setAdminMenuOpen((s) => !s)}
                onFocus={() => { if (adminHoverTimeoutRef.current) clearTimeout(adminHoverTimeoutRef.current); setAdminMenuOpen(true); }}
                onBlur={() => { adminHoverTimeoutRef.current = setTimeout(() => setAdminMenuOpen(false), 150); }}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2"
                aria-haspopup="true"
                aria-expanded={adminMenuOpen}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-sm">Admin</span>
              </button>

              {adminMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-50" role="menu" aria-label="Admin menu">
                  <button
                    role="menuitem"
                    onMouseDown={() => { setAdminMenuOpen(false); navigate('/stages'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setAdminMenuOpen(false); navigate('/stages'); } }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                  >
                    Stages
                  </button>

                  <button
                    role="menuitem"
                    onMouseDown={() => { setAdminMenuOpen(false); navigate('/employees'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setAdminMenuOpen(false); navigate('/employees'); } }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                  >
                    Employees
                  </button>

                  <button
                    role="menuitem"
                    onMouseDown={() => { setAdminMenuOpen(false); navigate('/options'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setAdminMenuOpen(false); navigate('/options'); } }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                  >
                    Options
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      <main className="max-w-10xl mx-8 p-8 relative z-20" style={{ pointerEvents: "auto" }}>
        <div className="relative">
          <div>{renderContent()}</div>
        </div>
      </main>

      <div style={{ pointerEvents: "auto" }}>
        <VillageModal
          open={!!selectedVillage}
          village={selectedVillage}
          onClose={closeModal}
          onOpenProfile={(v) => navigate(`/villages/${encodeURIComponent(v.villageId)}`)}
          onSaveVillage={handleSaveVillage}
          onDeleteVillage={handleDeleteVillage}
        />
      </div>

      <div className="h-20" />
    </div>
  );
}
