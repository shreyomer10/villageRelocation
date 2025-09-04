// src/pages/FamilyList.jsx
import React, { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

export default function FamilyList() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [filterOption, setFilterOption] = useState("All"); // "All" | "Option 1" | "Option 2"
  const [search, setSearch] = useState("");

  // family detail modal
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState(null);
  const [familyDetails, setFamilyDetails] = useState(null);

  // read villageId from localStorage (same key used elsewhere)
  const storedVillageId = typeof window !== "undefined" ? localStorage.getItem("villageId") : null;

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
          throw new Error("No village selected. Please select a village from the dashboard.");
        }

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const optParam = optionQueryParam(filterOption);
        const url =
          `https://villagerelocation.onrender.com/villages/${encodeURIComponent(storedVillageId)}/beneficiaries` +
          (optParam ? `?option=${optParam}` : "");

        const res = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
        if (!res.ok) {
          throw new Error(`Failed to fetch beneficiaries (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;
        setBeneficiaries(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        if (err.name !== "AbortError") setListError(err.message || "Unable to load beneficiaries.");
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

  // fetch family details
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

      const res = await fetch(`https://villagerelocation.onrender.com/families/${encodeURIComponent(familyId)}`, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Family not found");
        throw new Error(`Failed to fetch family (${res.status})`);
      }
      const data = await res.json();
      setFamilyDetails(data);
    } catch (err) {
      if (err.name !== "AbortError") setFamilyError(err.message || "Unable to load family.");
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

  // minimal header + no-village state
  if (!storedVillageId) {
    return (
      <div className="min-h-screen bg-[#f8f0dc] font-sans">
        <header className="bg-[#a7dec0] shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/images/logo.png" alt="logo" className="w-16 h-16 object-contain" />
              <h1 className="text-2xl font-bold text-black">
                Tilai Dabra Beneficiaries - <span className="text-green-800">Family List</span>
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
            <p className="text-sm text-gray-700">No village selected. Please select a village from the dashboard first.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      {/* Header */}
      <header className="bg-[#a7dec0] shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/images/logo.png" alt="logo" className="w-16 h-16 object-contain" />
            <h1 className="text-2xl font-bold text-black">
              {storedVillageId} Beneficiaries - <span className="text-green-800">Family List</span>
            </h1>
          </div>

          <div className="text-right">
            <div className="text-[#4a3529] font-bold text-2xl leading-none">माटी</div>
            <div className="text-sm text-[#4a3529] tracking-wider">MAATI</div>
          </div>
        </div>
      </header>

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
              className={`px-4 py-1 rounded-lg shadow ${filterOption === "All" ? "bg-black text-white" : "bg-white hover:bg-gray-100"}`}
            >
              All Families
            </button>

            <button
              onClick={() => setFilterOption("Option 1")}
              className={`px-4 py-1 rounded-lg shadow ${filterOption === "Option 1" ? "bg-black text-white" : "bg-white hover:bg-gray-100"}`}
            >
              Option 1 Families
            </button>

            <button
              onClick={() => setFilterOption("Option 2")}
              className={`px-4 py-1 rounded-lg shadow ${filterOption === "Option 2" ? "bg-black text-white" : "bg-white hover:bg-gray-100"}`}
            >
              Option 2 Families
            </button>
          </div>
        </div>

        {/* Errors / Loading */}
        {listError && <div className="text-sm text-red-600 mb-4">{listError}</div>}
        {loadingList ? (
          <div className="py-8 text-center text-sm text-gray-600">Loading families…</div>
        ) : (
          <>
            {filteredFamilies.length === 0 ? (
              <div className="text-sm text-gray-600">No families found.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {filteredFamilies.map((family) => (
                  <div key={family.familyId} className="bg-[#f0f4ff] rounded-xl p-4 shadow-md text-center hover:shadow-lg transition">
                    <img
                      src={family.mukhiyaPhoto || "/images/default-avatar.png"}
                      alt={family.mukhiyaName || "Mukhiya"}
                      onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
                      className="w-24 h-24 mx-auto rounded-full object-cover border mb-3"
                    />
                    <h3 className="font-semibold text-gray-800">{family.mukhiyaName || "Unknown"}</h3>
                    <button
                      onClick={() => handleViewFamily(family.familyId)}
                      className="mt-3 px-4 py-1 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-md shadow"
                    >
                      View Family
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Family Modal - styled like your mockup */}
      {selectedFamilyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40">
          <div className="relative w-full max-w-4xl bg-transparent">
            {/* Outer rounded container with big border and shadow */}
            <div className="rounded-3xl bg-white p-6 shadow-2xl border-2 border-gray-200">
              <button
                onClick={closeModal}
                className="absolute right-6 top-6 bg-white p-2 rounded-full shadow hover:bg-gray-50"
                aria-label="Close"
              >
                <X />
              </button>

              {/* Inner rounded card with padding & inner border to mimic the mock */}
              <div className="rounded-2xl border-2 border-gray-100 p-6 bg-white">
                {familyLoading ? (
                  <div className="py-20 text-center text-gray-600">Loading family details…</div>
                ) : familyError ? (
                  <div className="py-8 text-center text-red-600">{familyError}</div>
                ) : familyDetails ? (
                  <div className="flex flex-col gap-6">
                    {/* Top row: left = head + members, right = geo image */}
                    <div className="flex gap-6 items-start">
                      {/* Left column */}
                      <div className="flex-1">
                        {/* Mukhiya (main head) */}
                        <div className="flex items-center gap-4 mb-6">
                          <img
                            src={familyDetails.family?.mukhiyaPhoto || "/images/default-avatar.png"}
                            onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
                            alt={familyDetails.family?.mukhiyaName || "Mukhiya"}
                            className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md"
                          />
                          <div>
                            <div className="text-xl font-bold">{familyDetails.family?.mukhiyaName || "Unknown"}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              Age: {familyDetails.family?.age ?? "—"} {/* if backend provides age */}
                            </div>
                            <div className="text-sm text-gray-600">Health Status: {familyDetails.family?.healthStatus ?? "—"}</div>
                            <div className="text-xs text-gray-500 mt-1">Family ID: {familyDetails.family?.familyId}</div>
                          </div>
                        </div>

                        {/* Members row (avatars + small details) */}
                        <div className="grid grid-cols-3 gap-4">
                          {Array.isArray(familyDetails.members) && familyDetails.members.length > 0 ? (
                            familyDetails.members.slice(0, 6).map((m, i) => (
                              <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-md">
                                <img
                                  src={m.photo || "/images/default-avatar.png"}
                                  onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
                                  alt={m.name || "Member"}
                                  className="w-12 h-12 rounded-full object-cover border"
                                />
                                <div>
                                  <div className="text-sm font-medium">{m.name ?? m.memberName ?? "Member"}</div>
                                  <div className="text-xs text-gray-500">
                                    {m.age ? `${m.age} yrs` : ""} {m.relation ? `• ${m.relation}` : ""}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">No members listed.</div>
                          )}
                        </div>
                      </div>

                      {/* Right column: Geo tagged image */}
                      <div className="w-1/3 min-w-[220px]">
                        <div className="text-md font-semibold mb-3">Geo tagged Photos of Land Provided</div>
                        <div className="w-full h-44 rounded-lg overflow-hidden shadow-inner border border-gray-100 bg-gray-100">
                          {/* Prefer a geo image from option1Housing (first item), fallback to default */}
                          <img
                            src={
                              (Array.isArray(familyDetails.option1Housing) && familyDetails.option1Housing[0]?.url) ||
                              (Array.isArray(familyDetails.option1Housing) && familyDetails.option1Housing[0]?.photo) ||
                              "/images/default-land.png"
                            }
                            alt="geo"
                            className="w-full h-full object-cover"
                            onError={(e) => (e.currentTarget.src = "/images/default-land.png")}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-2">Tap image to view full size</div>
                      </div>
                    </div>

                    {/* Bottom big pill - Other details */}
                    <div className="mt-4">
                      <div className="rounded-full bg-gray-50 border border-gray-200 py-8 px-6 text-center shadow-sm">
                        <div className="text-2xl font-bold text-gray-700">other details</div>
                        <div className="mt-3 text-sm text-gray-500">
                          {/* Example details — replace with fields your backend provides. */}
                          Mukhiya ID: {familyDetails.family?.mukhiyaId ?? "—"} • Created: {familyDetails.family?.createdAt ? new Date(familyDetails.family.createdAt).toLocaleDateString() : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">No details to show.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
