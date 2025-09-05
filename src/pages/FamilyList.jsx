// src/pages/FamilyList.jsx
import React, { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import FamilyCard from "../component/FamilyCard";
import FamilyModal from "../component/FamilyModal";
import MainNavbar from "../component/MainNavbar";

export default function FamilyList() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [filterOption, setFilterOption] = useState("All");
  const [search, setSearch] = useState("");

  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState(null);
  const [familyDetails, setFamilyDetails] = useState(null);

  const storedVillageId =
    typeof window !== "undefined"
      ? localStorage.getItem("villageId")
      : null;

  function optionQueryParam(opt) {
    if (!opt || opt === "All") return "";
    if (opt === "Option 1") return "1";
    if (opt === "Option 2") return "2";
    return "";
  }

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
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

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
          throw new Error(`Failed to fetch beneficiaries (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;
        setBeneficiaries(Array.isArray(data) ? data : []);
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

  const filteredFamilies = beneficiaries.filter((f) => {
    if (!f) return false;
    const name = (f.mukhiyaName || "").toString();
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleViewFamily = async (familyId) => {
    if (!familyId) return;
    setSelectedFamilyId(familyId);
    setFamilyLoading(true);
    setFamilyError(null);
    setFamilyDetails(null);

    const ctrl = new AbortController();
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(
        `https://villagerelocation.onrender.com/families/${encodeURIComponent(
          familyId
        )}`,
        { method: "GET", headers, signal: ctrl.signal }
      );
      if (!res.ok) {
        if (res.status === 404) throw new Error("Family not found");
        throw new Error(`Failed to fetch family (${res.status})`);
      }
      const data = await res.json();
      setFamilyDetails(data);
    } catch (err) {
      if (err.name !== "AbortError")
        setFamilyError(err.message || "Unable to load family.");
    } finally {
      setFamilyLoading(false);
    }

    return () => ctrl.abort();
  };

  const closeModal = () => {
    setSelectedFamilyId(null);
    setFamilyDetails(null);
    setFamilyError(null);
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
              <div className="text-[#4a3529] font-bold text-2xl leading-none">
                माटी
              </div>
              <div className="text-sm text-[#4a3529] tracking-wider">
                MAATI
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-6">
          <div className="bg-white rounded-xl p-6 shadow text-center">
            <p className="text-sm text-gray-700">
              No village selected. Please select a village from the dashboard
              first.
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
              <MainNavbar 
              village={storedVillageId}
              showInNavbar={true} />
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
        {listError && (
          <div className="text-sm text-red-600 mb-4">{listError}</div>
        )}
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
                    key={family.familyId}
                    family={family}
                    onView={handleViewFamily}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal */}
      {selectedFamilyId && (
        <FamilyModal
          familyDetails={familyDetails}
          familyLoading={familyLoading}
          familyError={familyError}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
