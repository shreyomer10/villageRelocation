// src/pages/FamilyList.jsx
import React, { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import FamilyModal from "../component/FamilyModal";
import MainNavbar from "../component/MainNavbar";

// Inline FamilyCard component
function FamilyCard({ family, onView }) {
  return (
    <div className="bg-[#f0f4ff] rounded-xl p-4 shadow-md text-center hover:shadow-lg transition">
      <img
        src={family.mukhiyaPhoto || "/images/default-avatar.png"}
        alt={family.mukhiyaName || "Mukhiya"}
        onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
        className="w-24 h-24 mx-auto rounded-full object-cover border mb-3"
      />
      <h3 className="font-semibold text-gray-800">
        {family.mukhiyaName || "Unknown"}
      </h3>
      <button
        onClick={() => onView(family.familyId ?? family.id)}
        className="mt-3 px-4 py-1 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-md shadow"
      >
        View Family
      </button>
    </div>
  );
}

export default function FamilyList() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [filterOption, setFilterOption] = useState("All");
  const [search, setSearch] = useState("");

  // selected family id for modal
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);

  // track villageId from localStorage
  const [storedVillageId, setStoredVillageId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("villageId") : null
  );

  // listen for changes to villageId in localStorage
  useEffect(() => {
    function onStorage(e) {
      if (e.key === "villageId") setStoredVillageId(e.newValue);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    return () => {};
  }, []);

  function optionQueryParam(opt) {
    if (!opt || opt === "All") return "";
    if (opt === "Option 1") return "1";
    if (opt === "Option 2") return "2";
    return "";
  }

  // fetch beneficiaries
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    async function loadList() {
      setLoadingList(true);
      setListError(null);

      try {
        if (!storedVillageId) {
          throw new Error(
            "No village selected. Please select a village from the dashboard."
          );
        }

        const token = localStorage.getItem("token");
        const headers = token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" };

        const optParam = optionQueryParam(filterOption);
        const url =
          `https://villagerelocation.onrender.com/villages/${encodeURIComponent(
            storedVillageId
          )}/beneficiaries` + (optParam ? `?option=${optParam}` : "");

        const res = await fetch(url, {
          method: "GET",
          headers,
          signal: ctrl.signal,
        });

        if (!res.ok) {
          let bodyText = "";
          try {
            const tmp = await res.json();
            bodyText = tmp && tmp.message ? `: ${tmp.message}` : "";
          } catch {}
          throw new Error(`Failed to fetch beneficiaries (${res.status})${bodyText}`);
        }

        const data = await res.json();
        if (data && data.error) {
          throw new Error(data.message || "Unable to load beneficiaries.");
        }

        const list = Array.isArray(data.result) ? data.result : [];

        if (!mounted) return;
        setBeneficiaries(list);
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError")
          setListError(err.message || "Unable to load beneficiaries.");
      } finally {
        if (mounted) setLoadingList(false);
      }
    }

    loadList();
    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [filterOption, storedVillageId]);

  // filter by search
  const filteredFamilies = beneficiaries.filter((f) => {
    if (!f) return false;
    const name = (f.mukhiyaName || "").toString();
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleViewFamily = (familyId) => {
    // accept 0 as a valid id, so check for null/undefined only
    if (familyId === undefined || familyId === null) {
      console.error("No familyId provided to modal");
      return;
    }
    console.log("Opening modal for familyId:", familyId);
    setSelectedFamilyId(familyId);
  };

  const closeModal = () => {
    setSelectedFamilyId(null);
  };

  if (!storedVillageId) {
    return (
      <div className="min-h-screen bg-[#f8f0dc] font-sans">
        <header className="bg-[#a7dec0] shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/images/logo.png"
                alt="logo"
                className="w-16 h-16 object-contain"
              />
              <h1 className="text-2xl font-bold text-black">
                Tilai Dabra Beneficiaries -{" "}
                <span className="text-green-800">Family List</span>
              </h1>
            </div>
            <div className="text-right">
              <div className="text-[#4a3529] font-bold text-2xl leading-none">माटी</div>
              <div className="text-sm text-[#4a3529] tracking-wider">MAATI</div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-6">
          <div className="bg-white rounded-xl p-6 shadow text-center">
            <p className="text-sm text-gray-700">
              No village selected. Please select a village from the dashboard first.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      {/* Header */}
      <div>
        <MainNavbar village={storedVillageId} showInNavbar={true} />
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Search + Filters */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <input
            type="text"
            placeholder="Search by mukhiya name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border rounded-md shadow-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-400"
          />

          <div className="flex items-center gap-3">
            <button className="p-2 bg-white border rounded-lg shadow hover:bg-gray-50">
              <SlidersHorizontal size={18} />
            </button>

            <button
              onClick={() => setFilterOption("All")}
              className={`px-4 py-1 rounded-lg shadow ${
                filterOption === "All"
                  ? "bg-black text-white"
                  : "bg-white hover:bg-gray-100"
              }`}
            >
              All Families
            </button>

            <button
              onClick={() => setFilterOption("Option 1")}
              className={`px-4 py-1 rounded-lg shadow ${
                filterOption === "Option 1"
                  ? "bg-black text-white"
                  : "bg-white hover:bg-gray-100"
              }`}
            >
              Option 1 Families
            </button>

            <button
              onClick={() => setFilterOption("Option 2")}
              className={`px-4 py-1 rounded-lg shadow ${
                filterOption === "Option 2"
                  ? "bg-black text-white"
                  : "bg-white hover:bg-gray-100"
              }`}
            >
              Option 2 Families
            </button>
          </div>
        </div>

        {/* Errors / Loading */}
        {listError && <div className="text-sm text-red-600 mb-4">{listError}</div>}
        {loadingList ? (
          <div className="py-8 text-center text-sm text-gray-600">
            Loading families…
          </div>
        ) : (
          <>
            {filteredFamilies.length === 0 ? (
              <div className="text-sm text-gray-600">No families found.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {filteredFamilies.map((family) => (
                  <FamilyCard
                    key={family.familyId ?? family.id}
                    family={family}
                    onView={handleViewFamily}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal: render if selectedFamilyId is NOT null/undefined (accept 0 as valid id). Pass open prop and a key to force remount when id changes */}
      {selectedFamilyId !== null && (
        <FamilyModal
          key={String(selectedFamilyId)}
          isopen={true}
          familyId={selectedFamilyId}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
