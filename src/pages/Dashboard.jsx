import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sliders } from "lucide-react";
import MainNavbar from "../component/MainNavbar";
import VillageOverview from "../component/VillageOverview";

const stageDefs = [
  { stage_id: 1, name: "Gram Sabha Meeting", description: "Initial consent", sequence_no: 1 },
  { stage_id: 2, name: "Consent Collection", description: "Collect family consent", sequence_no: 2 },
  { stage_id: 3, name: "Land Identification", description: "Identify land", sequence_no: 3 },
  { stage_id: 4, name: "Compensation Approval", description: "Approve funds", sequence_no: 4 },
  { stage_id: 5, name: "Relocation Completed", description: "Handover", sequence_no: 5 },
];

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

  function normalizeListItem(item) {
    const villageId = item.village_id ?? item.villageId ?? (item.village_id?.toUpperCase?.() ?? undefined);
    const name = item.name ?? item.Name ?? "Unknown";
    const currentStage = item.current_stage ?? item.currentStage ?? item.current_stage ?? null;
    const dateRaw = item.updated_at ?? item.lastUpdatedOn ?? item.updatedAt ?? item.updatedAt ?? "-";
    const date = typeof dateRaw === "string" ? dateRaw : dateRaw ? new Date(dateRaw).toLocaleString() : "-";
    const status =
      item.status ??
      (typeof currentStage === "number" && currentStage > 0
        ? stageDefs.find((s) => s.sequence_no === currentStage)?.name ?? `Step ${currentStage}`
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

  useEffect(() => {
    let mounted = true;
    async function loadList() {
      setListLoading(true);
      setListError(null);
      try {
        const res = await fetch("https://villagerelocation.onrender.com/villages");
        if (!res.ok) {
          throw new Error(`Failed to fetch villages (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;

        const normalized = (data || []).map(normalizeListItem);
        setVillages(normalized);

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

  const handleOpenVillage = async (v) => {
    const id = v.villageId ?? v.village_id ?? v.raw?.village_id ?? v.raw?.villageId;
    if (!id) {
      setDetailError("Village id missing");
      setSelectedVillage({ name: v.name, villageId: id });
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    setSelectedVillage(null);

    try {
      const res = await fetch(`https://villagerelocation.onrender.com/villages/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Village not found");
        throw new Error(`Failed to fetch village details (${res.status})`);
      }
      const data = await res.json();

      localStorage.setItem("villageId", id);

      const normalized = {
        name: data.name ?? data.Name ?? v.name,
        villageId: data.villageId ?? data.village_id ?? id,
        currentStage: data.currentStage ?? data.current_stage ?? v.sequence_no ?? 0,
        totalStages: data.totalStages ?? data.total_stages ?? stageDefs.length,
        lastUpdatedOn: data.lastUpdatedOn ?? data.last_updated_on ?? data.updated_at ?? v.date,
        location: data.location ?? {},
        areaOfRelocation: data.areaOfRelocation ?? data.area_of_relocation,
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
    const matchSearch = [v.name, v.villageId, v.status].join(" ").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStage = selectedStages.size === 0 || selectedStages.has(v.status);
    return matchSearch && matchStage;
  });

  const closeModal = () => {
    setSelectedVillage(null);
    setDetailError(null);
  };

  const openProfile = () => {
    navigate("/home");
  };

  const storedUserRaw = localStorage.getItem("user");
  let username = "Shrey";
  try {
    if (storedUserRaw) {
      const parsed = JSON.parse(storedUserRaw);
      if (parsed?.name) username = parsed.name;
    }
  } catch (e) {
    // ignore parse errors and use fallback
  }

  return (
    <div className="min-h-screen bg-[rgb(245,242,236)]">
      <div className="bg-green-100 shadow-sm">
        <MainNavbar name={username} timer="2 hr 45 min 4 sec" />
        <div className="text-center text-xs text-gray-500 py-2">Login Expires in: 2 hr 45 min 4 sec</div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="relative flex-1 max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setStageFilterOpen((s) => !s)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Sliders className="w-4 h-4" />
              <span className="text-gray-700">Filter by Stages</span>
            </button>

            {stageFilterOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 p-4 z-20">
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

          <div className="flex-1" />
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6">
        {listLoading ? (
          <div className="text-center py-12">Loading villages…</div>
        ) : listError ? (
          <div className="text-center py-6 text-red-600">{listError}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVillages.map((v, i) => (
              <VillageCard key={v.villageId ?? i} village={v} onOpen={handleOpenVillage} />
            ))}
          </div>
        )}
      </main>

      <VillageOverview open={!!selectedVillage} onClose={closeModal} village={selectedVillage || {}} loading={detailLoading} onOpenProfile={openProfile} stageDefs={stageDefs} />

      <div className="h-20" />
    </div>
  );
}
