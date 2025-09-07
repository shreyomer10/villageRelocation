// File: src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sliders, Calendar, CheckCircle } from "lucide-react";
import MainNavbar from "../component/MainNavbar";
import VillageModal from "../component/VillageModal";
import { stageDefs } from "../config/stages";

const VillageCard = ({ village, onOpen }) => {
  const { name, villageId, status = "N/A", date, lastUpdatedOn } = village;
  const bgColor = status === "N/A" ? "bg-white" : "bg-violet-50";

  // Prefer the friendly 'date' (computed in normalizeListItem), fallback to raw lastUpdatedOn.
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

  // selected village object (NOT just id) passed to modal
  const [selectedVillage, setSelectedVillage] = useState(null);

  const stageOptions = stageDefs.map((s) => s.name).concat(["N/A"]);

  function normalizeListItem(item = {}) {
    // village id (try several shapes)
    const villageId = item.villageId ?? item.village_id ?? String(item.villageId ?? item.village_id ?? "");

    const name = item.name ?? item.Name ?? "Unknown";

    const currentStage =
      typeof item.currentStage === "number"
        ? item.currentStage
        : typeof item.current_stage === "number"
        ? item.current_stage
        : Number(item.currentStage) || 0;

    // Robust date handling: if the API gives an invalid date string, fallback to raw value
    const dateRaw = item.updatedAt ?? item.updated_at ?? item.lastUpdatedOn ?? "-";
    let date = "-";
    if (typeof dateRaw === "string" && dateRaw !== "-") {
      const parsed = new Date(dateRaw);
      date = isNaN(parsed.getTime()) ? String(dateRaw) : parsed.toLocaleString();
    } else {
      date = dateRaw || "-";
    }

    const status =
      item.status ??
      (currentStage > 0 ? stageDefs.find((s) => s.stage_id === currentStage)?.name ?? `Step ${currentStage}` : "N/A");

    const updatedBy = item.updatedBy ?? item.updated_by ?? item.updatedByUser ?? item.updated_by_user ?? item.updated_by_name ?? "-";

    return {
      name,
      villageId,
      // include other useful raw fields so modal can use them without another fetch
      currentStage,
      currentSubStage: item.currentSubStage ?? item.current_sub_stage ?? null,
      totalStages: item.totalStages ?? stageDefs.length,
      lastUpdatedOn: item.updatedAt ?? "-",
      lastUpdatedby: item.updatedBy ?? "-",
      areaOfRelocation: item.areaOfRelocation ?? item.siteOfRelocation ?? item.area_of_relocation ?? "-",
      areaDiverted: item.areaDiverted ?? null,
      image: item.image ?? null,
      siteOfRelocation: item.siteOfRelocation ?? item.site_of_relocation ?? "-",
      updatedBy,
      rawOriginal: item,
      // A friendly date string for display
      date,
      status,
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
          localStorage.setItem("villageId", normalized[0].villageId);
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
  }, []);

  const toggleStage = (s) => {
    const next = new Set(selectedStages);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSelectedStages(next);
    setStageFilterOpen(false);
  };

  // Save handler: updates local state immediately (optimistic) and then PATCHes the server.
  // Returns a promise that resolves on success or rejects on failure so modal can show errors.
  const handleSaveVillage = async (updatedFields) => {
    const id = updatedFields.villageId;
    if (!id) return Promise.reject(new Error("Missing villageId"));

    // keep previous copy for rollback on error
    const prev = villages.map((v) => (v.villageId === id ? { ...v } : v));

    // optimistic update
    setVillages((prevList) => prevList.map((v) => (v.villageId === id ? { ...v, ...updatedFields, date: new Date().toLocaleString() } : v)));

    try {
      const res = await fetch(`https://villagerelocation.onrender.com/villages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });

      if (!res.ok) {
        const text = await res.text();
        // rollback
        setVillages(prev);
        throw new Error(`Failed to update (${res.status}): ${text}`);
      }

      const payload = await res.json();
      const updatedFromServer = normalizeListItem(payload?.result ?? payload ?? updatedFields);

      // merge server response
      setVillages((prevList) => prevList.map((v) => (v.villageId === id ? { ...v, ...updatedFromServer } : v)));

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
  } catch (e) {}

  const handleAddVillage = () => navigate("/villages/new");
  const openProfile = (village) => {
    // example: navigate to village profile route
    if (!village) return;
    navigate(`/villages/${encodeURIComponent(village.villageId)}`);
  };

  return (
    <div className="min-h-screen bg-[rgb(245,242,236)]">
      <MainNavbar name={username} showWelcome={true} />

      <div className="px-6 py-6">
        <div className="mx-auto flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="flex items-center w-full md:max-w-2xl gap-4">
            <div className="relative flex-1 w-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, id or status"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                aria-label="Search villages"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setStageFilterOpen((s) => !s)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                aria-expanded={stageFilterOpen}
                aria-controls="stage-filter"
              >
                <Sliders className="w-4 h-4" />
                <span className="text-gray-700 text-sm">Filter by Stages</span>
              </button>

              {stageFilterOpen && (
                <div id="stage-filter" className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 p-4 z-20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Stages</h4>
                    <button onClick={() => setSelectedStages(new Set())} className="text-sm text-gray-500 hover:underline">
                      Clear
                    </button>
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

          <div className="w-full md:w-auto flex justify-end">
            <button onClick={handleAddVillage} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label="Add new village">
              Guideline
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-10xl mx-8 p-8">
        {listLoading ? (
          <div className="text-center py-12">Loading villages…</div>
        ) : listError ? (
          <div className="text-center py-6 text-red-600">{listError}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {filteredVillages.map((v, i) => (
              <VillageCard key={v.villageId ?? i} village={v} onOpen={handleOpenVillage} />
            ))}
          </div>
        )}
      </main>

      {/* pass the full village object to modal so modal doesn't need to call the API again */}
      <VillageModal open={!!selectedVillage} village={selectedVillage} onClose={closeModal} onOpenProfile={openProfile} onSaveVillage={handleSaveVillage} />

      <div className="h-20" />
    </div>
  );
}
