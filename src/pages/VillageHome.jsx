// src/pages/VillageDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StageProgress from "../component/StageProgress";
import FamilyPieChart from "../component/FamilyPieChart";
import MainNavbar from "../component/MainNavbar";

export default function VillageDashboard() {
  const navigate = useNavigate();

  // family counts  
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

  // stages
  const stages = [
    {
      stage_id: 1,
      name: "Gram Sabha Consent",
      description: "Initial consent",
      sequence_no: 1,
      substeps: [
        { id: "1a", title: "Option 1 & 2 Survey", completed: false, files: [] },
        { id: "1b", title: "Land Identified", completed: false, files: [] },
        { id: "1c", title: "Gram Sabha Consent – Source", completed: false, files: [] },
        { id: "1d", title: "Gram Sabha Consent – Destination", completed: false, files: [] },
      ],
    },
    {
      stage_id: 2,
      name: "Diversion of Land",
      description: "Land diversion & clearances",
      sequence_no: 2,
      substeps: [
        { id: "2a", title: "DGPS Survey", completed: false, files: [] },
        { id: "2b", title: "Registration", completed: false, files: [] },
        { id: "2c", title: "First Stage Clearance", completed: false, files: [] },
        { id: "2d", title: "Second Stage Clearance", completed: false, files: [] },
      ],
    },
    {
      stage_id: 3,
      name: "Budget & Eligibility",
      description: "Funding & eligibility",
      sequence_no: 3,
      substeps: [
        { id: "3a", title: "Budget Proposal sent", completed: false, files: [] },
        { id: "3b", title: "Budget Received from CAMPA", completed: false, files: [] },
        { id: "3c", title: "Budget Transferred to Collector", completed: false, files: [] },
        { id: "3d", title: "Eligibility Determination Committee Constituted", completed: false, files: [] },
        { id: "3e", title: "Cut off Date Declared", completed: false, files: [] },
        { id: "3f", title: "Final list of eligible beneficiaries", completed: false, files: [] },
        { id: "3g", title: "Village Relocation & Development Plan", completed: false, files: [] },
      ],
    },
    {
      stage_id: 4,
      name: "Option 1 execution",
      description: "Option 1 - direct implementation",
      sequence_no: 4,
      substeps: [
        { id: "4a", title: "Joint Accounts created", completed: false, files: [] },
        { id: "4b", title: "Amount transferred to joint accounts", completed: false, files: [] },
        { id: "4c", title: "House built", completed: false, files: [] },
      ],
    },
    {
      stage_id: 5,
      name: "Option 2 execution",
      description: "Option 2 - committee led",
      sequence_no: 5,
      substeps: [
        { id: "5a", title: "Village Relocation & Development Committee constituted", completed: false, files: [] },
        { id: "5b", title: "Joint accounts created", completed: false, files: [] },
        { id: "5c", title: "Amount transferred to joint accounts", completed: false, files: [] },
        { id: "5d", title: "Amount transferred to PD a/c of DD", completed: false, files: [] },
        { id: "5e", title: "Houses built", completed: false, files: [] },
        { id: "5f", title: "Community development as per plan", completed: false, files: [] },
      ],
    },
    {
      stage_id: 6,
      name: "Relocation Complete",
      description: "All relocation tasks complete",
      sequence_no: 6,
      substeps: [
        { id: "6a", title: "MoU signed with eligible beneficiaries", completed: false, files: [] },
        { id: "6b", title: "Entire Option 1 amount transferred to beneficiary", completed: false, files: [] },
        { id: "6c", title: "Entire houses built under option 1 & 2", completed: false, files: [] },
        { id: "6d", title: "Village vacated and shifted", completed: false, files: [] },
        { id: "6e", title: "Razing of remains in villages", completed: false, files: [] },
      ],
    },
  ];

  // read from localStorage
  const storedVillageId =
    typeof window !== "undefined" ? localStorage.getItem("villageId") : null;
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

  // fetch data
  useEffect(() => {
    let mounted = true;
    const controllerCounts = new AbortController();
    const controllerVillage = new AbortController();

    async function loadCounts(villageId) {
      setLoadingCounts(true);
      setError(null);
      try {
        if (!villageId) throw new Error("No village selected.");

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

        setTotal(Number(data.totalFamilies ?? 0));
        setOpt1(Number(data.familiesOption1 ?? 0));
        setOpt2(Number(data.familiesOption2 ?? 0));
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
        if (!villageId) throw new Error("No village selected.");

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(
          `https://villagerelocation.onrender.com/villages/${encodeURIComponent(
            villageId
          )}`,
          { method: "GET", headers, signal: controllerVillage.signal }
        );
        if (!res.ok) throw new Error("Failed to fetch village");

        const data = await res.json();
        if (!mounted) return;

        setCurrentStage(Number(data.currentStage ?? data.current_stage ?? 3));
        setLastUpdated(
          data.lastUpdatedOn ?? data.last_updated_on ?? data.updated_at ?? null
        );
        setAreaDiverted(data.areaDiverted ?? data.area_diverted ?? null);

        if (data.location) {
          if (data.location.latitude || data.location.longitude) {
            setLocationText(
              `${data.location.latitude ?? "-"}, ${data.location.longitude ?? "-"}`
            );
          } else if (typeof data.location === "string") {
            setLocationText(data.location);
          }
        }

        if (data.image) setImageUrl(data.image);
        if (data.stageDetails && Array.isArray(data.stageDetails)) {
          // data.stageDetails expected: [{ sequence_no: 1, substeps: [{ id: '1a', completed: true }, ...] }, ...]
          // merge into local stages (shallow merge)
          data.stageDetails.forEach((sd) => {
            const local = stages.find((s) => s.sequence_no === sd.sequence_no);
            if (local && Array.isArray(sd.substeps)) {
              sd.substeps.forEach((ss) => {
                const localSub = local.substeps.find((ls) => ls.id === ss.id);
                if (localSub) localSub.completed = !!ss.completed;
              });
            }
          });
        }
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (mounted) setLoadingVillage(false);
      }
    }

    loadCounts(storedVillageId);
    loadVillage(storedVillageId);

    return () => {
      mounted = false;
      controllerCounts.abort();
      controllerVillage.abort();
    };
  }, [storedVillageId]);

  return (
    <div className="min-h-screen bg-amber-50 font-sans">
      {/* Header */}
      <div>
                    <MainNavbar 
                    village={storedVillageId}
                    showVillageInNavbar={true} />
                  </div>
      

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-6">
        {/* Pie chart */}
        <section className="col-span-4">
          <FamilyPieChart
            total={total}
            opt1={opt1}
            opt2={opt2}
            loading={loadingCounts}
            error={error}
          />
        </section>

        {/* Right content */}
        <section className="col-span-8 space-y-6">
          <StageProgress stages={stages} currentStage={currentStage} />

          {/* Location Card */}
          <div className="bg-white rounded-2xl p-6 shadow-lg flex items-stretch gap-6">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-800">
                Location of Relocation
              </h4>
              <p className="text-xs text-gray-700 mt-1">
                {locationText || "Location not available"}
              </p>

              <h4 className="text-sm font-semibold text-gray-800 mt-4">
                Total Area Diverted
              </h4>
              <p className="text-xs text-gray-700 mt-1">
                {areaDiverted ?? "—"}
              </p>
            </div>

            <div className="w-56 h-36 rounded-lg overflow-hidden shadow-md bg-gray-100 flex items-center justify-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="site"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-sm text-gray-500">No image</div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-40   justify-center">
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
