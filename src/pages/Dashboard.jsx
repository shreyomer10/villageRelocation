// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sliders, Calendar, CheckCircle } from "lucide-react";
import MainNavbar from "../component/MainNavbar";
import VillageModal from "../component/VillageModal"; // ✅ imported modal

// ---------------- Village Card ----------------
const VillageCard = ({ village, onOpen }) => {
  const { name, villageId, status, date } = village;
  const bgColor = status === "N/A" ? "bg-white" : "bg-violet-50";

  return (
    <div
      role="button"
      onClick={() => onOpen(village)}
      className={`${bgColor} rounded-lg p-5 shadow-md hover:shadow-lg transition transform hover:-translate-y-1 cursor-pointer border border-gray-100`}
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
          <span>{date}</span>
        </div>
      </div>
    </div>
  );
};

// ---------------- Dashboard Page ----------------
export default function Dashboard() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilterOpen, setStageFilterOpen] = useState(false);
  const [selectedStages, setSelectedStages] = useState(new Set());
  const [selectedVillage, setSelectedVillage] = useState(null);

  const [villages, setVillages] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const stageOptions = [
    "Gram Panchayat Meeting",
    "Relocation In progress",
    "In progress",
    "Not done yet",
    "N/A",
  ];

  // normalize server item -> UI item
  function normalizeListItem(item) {
    const villageId =
      item.village_id ??
      item.villageId ??
      (item.village_id?.toUpperCase?.() ?? undefined);

    const name = item.name ?? item.Name ?? "Unknown";
    const currentStage =
      item.current_stage ?? item.currentStage ?? item.current_stage ?? null;

    const dateRaw =
      item.updated_at ??
      item.lastUpdatedOn ??
      item.updatedAt ??
      item.updatedAt ??
      "-";
    const date =
      typeof dateRaw === "string"
        ? dateRaw
        : dateRaw
        ? new Date(dateRaw).toLocaleString()
        : "-";

    const status =
      item.status ??
      (typeof currentStage === "number" && currentStage > 0
        ? `Step ${currentStage}`
        : "N/A");

    const sequence_no = currentStage ?? item.sequence_no ?? 0;
    return {
      name,
      villageId,
      status,
      date,
      sequence_no,
      raw: item,
    };
  }

  // initial load -> fetch /villages from backend
  useEffect(() => {
    let mounted = true;
    async function loadList() {
      setListLoading(true);
      setListError(null);
      try {
        const res = await fetch(
          "https://villagerelocation.onrender.com/villages"
        );
        if (!res.ok) {
          throw new Error(`Failed to fetch villages (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;

        const normalized = (data || []).map(normalizeListItem);
        setVillages(normalized);

        // store a default villageId for later use
        if (normalized.length > 0) {
          const firstId = normalized[0].villageId;
          if (firstId) {
            localStorage.setItem("villageId", firstId);
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
  }, []);

  const toggleStage = (s) => {
    const next = new Set(selectedStages);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSelectedStages(next);
    setStageFilterOpen(false);
  };

  // When user clicks a card -> fetch /villages/<id> from backend
  const handleOpenVillage = async (v) => {
    const id =
      v.villageId ?? v.village_id ?? v.raw?.village_id ?? v.raw?.villageId;
    if (!id) {
      setDetailError("Village id missing");
      setSelectedVillage({ name: v.name, villageId: id });
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    setSelectedVillage(null);

    try {
      const res = await fetch(
        `https://villagerelocation.onrender.com/villages/${encodeURIComponent(
          id
        )}`
      );
      if (!res.ok) {
        if (res.status === 404) throw new Error("Village not found");
        throw new Error(`Failed to fetch village details (${res.status})`);
      }
      const data = await res.json();

      // store currently selected village id
      localStorage.setItem("villageId", id);

      // normalize the server response
      const normalized = {
        name: data.name ?? data.Name ?? v.name,
        villageId: data.villageId ?? data.village_id ?? id,
        currentStage:
          data.currentStage ?? data.current_stage ?? v.sequence_no ?? 0,
        totalStages: data.totalStages ?? data.total_stages ?? 5,
        lastUpdatedOn:
          data.lastUpdatedOn ??
          data.last_updated_on ??
          data.updated_at ??
          v.date,
        location: data.location ?? {},
        areaOfRelocation:
          data.areaOfRelocation ?? data.area_of_relocation ?? "-",
        areaDiverted: data.areaDiverted ?? data.area_diverted,
        image: data.image ?? data.photo,
        raw: data,
      };

      setSelectedVillage(normalized);
    } catch (err) {
      setDetailError(err?.message || "Failed to load village details.");
      setSelectedVillage({ name: v.name, villageId: id });
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredVillages = villages.filter((v) => {
    const matchSearch = [v.name, v.villageId, v.status]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchStage =
      selectedStages.size === 0 || selectedStages.has(v.status);
    return matchSearch && matchStage;
  });

  const closeModal = () => {
    setSelectedVillage(null);
    setDetailError(null);
  };

  const openProfile = () => {
    navigate("/home");
  };

  // new: navigate to add/create village page (adjust route as needed)
  const handleAddVillage = () => {
    navigate("/villages/new");
  };

  // read name from localStorage user (Auth stored { name })
  const storedUserRaw = localStorage.getItem("user");
  let username = "Shrey";
  try {
    if (storedUserRaw) {
      const parsed = JSON.parse(storedUserRaw);
      if (parsed?.name) username = parsed.name;
    }
  } catch (e) {
    // ignore parse errors
  }

  return (
    <div className="min-h-screen bg-[rgb(245,242,236)]">
      {/* Navbar */}
      <div>
        <MainNavbar name={username} showWelcome={true} />
      </div>

      {/* Header: Search + Filter + Action Button (formally aligned) */}
      <div className="px-6 py-6">
        <div className="mx-auto flex flex-col md:flex-row items-center gap-4 justify-between">
          {/* Left: Search + Filter */}
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
                    <button
                      onClick={() => setSelectedStages(new Set())}
                      className="text-sm text-gray-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {stageOptions.map((s) => (
                      <label key={s} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedStages.has(s)}
                          onChange={() => toggleStage(s)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="truncate">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Formal action button placed to the right below navbar */}
          <div className="w-full md:w-auto flex justify-end">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Add new village"
            >
              Guidline
            </button>
          </div>
        </div>
      </div>

      {/* Villages Grid */}
      <main className="max-w-10xl mx-8 p-8">
        {listLoading ? (
          <div className="text-center py-12">Loading villages…</div>
        ) : listError ? (
          <div className="text-center py-6 text-red-600">{listError}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {filteredVillages.map((v, i) => (
              <VillageCard
                key={v.villageId ?? i}
                village={v}
                onOpen={handleOpenVillage}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      <VillageModal
        open={!!selectedVillage}
        onClose={closeModal}
        village={selectedVillage || {}}
        loading={detailLoading}
        onOpenProfile={openProfile}
      />

      <div className="h-20" />
    </div>
  );
}
