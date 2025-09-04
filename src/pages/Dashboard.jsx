// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sliders, Calendar, CheckCircle, Clock, X } from "lucide-react";
import MainNavbar from "../component/MainNavbar";

const stageDefs = [
  { stage_id: 1, name: "Gram Sabha Meeting", description: "Initial consent", sequence_no: 1 },
  { stage_id: 2, name: "Consent Collection", description: "Collect family consent", sequence_no: 2 },
  { stage_id: 3, name: "Land Identification", description: "Identify land", sequence_no: 3 },
  { stage_id: 4, name: "Compensation Approval", description: "Approve funds", sequence_no: 4 },
  { stage_id: 5, name: "Relocation Completed", description: "Handover", sequence_no: 5 },
];

function Modal({ open, onClose, village, loading, onOpenProfile }) {
  if (!open) return null;

  const statusToSequence = {
    "Gram Panchayat Meeting": 1,
    "Gram Sabha Meeting": 1,
    "Consent Collected": 2,
    "Relocation In progress": 4,
    "In progress": 3,
    "Not done yet": 0,
    "N/A": 0,
  };

  const currentSequence =
    typeof village?.currentStage === "number"
      ? village.currentStage
      : typeof village?.sequence_no === "number"
      ? village.sequence_no
      : statusToSequence[village?.status] ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-md hover:bg-gray-100"
          aria-label="Close"
        >
          <X />
        </button>

        {loading ? (
          <div className="py-12 text-center">Loading village details…</div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-1">{village?.name ?? "-"}</h2>
            <p className="text-sm text-gray-600 mb-6">Village ID: {village?.villageId ?? village?.village_id ?? "-"}</p>

            <div className="mb-6">
              {/* Stage Progress Bar */}
              <div className="relative w-full">
                <div className="flex justify-between items-center relative z-10">
                  {stageDefs.map((stage) => {
                    const seq = stage.sequence_no;
                    const completed = seq < currentSequence && currentSequence > 0;
                    const active = seq === currentSequence;

                    return (
                      <div key={stage.stage_id} className="flex flex-col items-center w-full">
                        <div
                          className={`w-10 h-10 flex items-center justify-center rounded-full border-2 font-semibold
                            ${completed ? "bg-green-500 border-green-500 text-white" : ""}
                            ${active ? "bg-white border-green-500 text-green-600" : ""}
                            ${!completed && !active ? "bg-white border-gray-300 text-gray-400" : ""}
                          `}
                        >
                          {completed ? "✓" : seq}
                        </div>
                        <p
                          className={`text-xs mt-2 font-medium text-center ${
                            completed || active ? "text-green-700" : "text-gray-400"
                          }`}
                        >
                          {stage.name}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="absolute top-5 left-0 w-full flex justify-between px-5">
                  {stageDefs.slice(0, -1).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-0.5 flex-1 mx-1 ${
                        stageDefs[idx].sequence_no < currentSequence ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-6 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-sm font-medium">
                    {village?.status ??
                      (currentSequence > 0 ? (stageDefs.find((s) => s.sequence_no === currentSequence)?.name ?? `Step ${currentSequence}`) : "N/A")}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-500">Last update</div>
                  <div className="text-sm font-medium">{village?.lastUpdatedOn ?? village?.lastUpdatedOn ?? "-"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <div>
                  <div className="text-xs text-gray-500">Current Step</div>
                  <div className="text-sm font-medium">{currentSequence > 0 ? `Step ${currentSequence}` : "Not started"}</div>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              <p>
                <span className="font-medium">Notes:</span> This area can show extra details pulled from backend (contact person, progress %, next action items, docs, etc.).
              </p>
              <p className="mt-2">
                <span className="font-medium">Area of relocation:</span> {village?.areaOfRelocation ?? village?.area_of_relocation ?? "-"}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50" onClick={onClose}>
                Close
              </button>
              <button onClick={onOpenProfile} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
                Open Profile
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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

  // normalize server item -> UI item
  function normalizeListItem(item) {
    const villageId = item.village_id ?? item.villageId ?? (item.village_id?.toUpperCase?.() ?? undefined);
    const name = item.name ?? item.Name ?? "Unknown";
    const currentStage = item.current_stage ?? item.currentStage ?? item.current_stage ?? null;
    const dateRaw = item.updated_at ?? item.lastUpdatedOn ?? item.updatedAt ?? item.updatedAt ?? "-";
    const date = typeof dateRaw === "string" ? dateRaw : dateRaw ? new Date(dateRaw).toLocaleString() : "-";
    const status =
      item.status ??
      (typeof currentStage === "number" && currentStage > 0
        ? (stageDefs.find((s) => s.sequence_no === currentStage)?.name ?? `Step ${currentStage}`)
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
        const res = await fetch("https://villagerelocation.onrender.com/villages");
        if (!res.ok) {
          throw new Error(`Failed to fetch villages (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;

        const normalized = (data || []).map(normalizeListItem);
        setVillages(normalized);

        // store a default villageId for later use (AuthProvider can read localStorage)
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

  // When user clicks a card -> fetch /villages/<id> from backend and show details
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

      // store currently selected village id for later use
      localStorage.setItem("villageId", id);

      // normalize the server response into the same shape the modal expects
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

  // read name from localStorage user (Auth previously stored { name })
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

      <Modal open={!!selectedVillage} onClose={closeModal} village={selectedVillage || {}} loading={detailLoading} onOpenProfile={openProfile} />

      <div className="h-20" />
    </div>
  );
}
