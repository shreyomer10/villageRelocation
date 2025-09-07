// src/pages/FamilyList.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // villageId precedence: query param -> localStorage
  const queryVillageId = searchParams.get("villageId");
  const [storedVillageId, setStoredVillageId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("villageId") : null
  );
  const effectiveVillageId = queryVillageId ?? storedVillageId;

  // Re-fetch key for refresh button
  const [reloadKey, setReloadKey] = useState(0);

  // filter option state: "All" | "Option 1" | "Option 2"
  const openParam = (searchParams.get("open") ?? "").toLowerCase();
  const normalizedOpen =
    openParam === "option1" || openParam === "1" || openParam === "option-1"
      ? "Option 1"
      : openParam === "option2" || openParam === "2" || openParam === "option-2"
      ? "Option 2"
      : openParam === "all"
      ? "All"
      : null;
  const [filterOption, setFilterOption] = useState(normalizedOpen ?? "All");

  // lists + loading + error
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  // search
  const [search, setSearch] = useState("");

  // selected family id for modal (accept 0 as valid)
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);

  // filter dropdown state and refs for accessibility
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const optionAllRef = useRef(null);
  const option1Ref = useRef(null);
  const option2Ref = useRef(null);
  const menuRef = useRef(null);

  // listen for localStorage villageId changes (other tabs)
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

  // keep filterOption in sync with query param when it changes externally
  useEffect(() => {
    const open = (searchParams.get("open") ?? "").toLowerCase();
    if (open === "option1" || open === "1" || open === "option-1") {
      setFilterOption("Option 1");
      // close the menu and focus the corresponding control
      setFilterMenuOpen(false);
      setTimeout(() => option1Ref.current?.focus(), 0);
    } else if (open === "option2" || open === "2" || open === "option-2") {
      setFilterOption("Option 2");
      setFilterMenuOpen(false);
      setTimeout(() => option2Ref.current?.focus(), 0);
    } else if (open === "all") {
      setFilterOption("All");
      setFilterMenuOpen(false);
      setTimeout(() => optionAllRef.current?.focus(), 0);
    } else if (open === "filter") {
      // open the filter menu (user navigation asked to open the filter pane)
      setFilterMenuOpen(true);
      // focus first item in the menu on next tick
      setTimeout(() => optionAllRef.current?.focus(), 0);
    } else {
      // default to All
      setFilterOption("All");
      setFilterMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // helper: transform filter option to API param
  function optionQueryParam(opt) {
    if (!opt || opt === "All") return "";
    if (opt === "Option 1" || String(opt).toLowerCase() === "option1") return "1";
    if (opt === "Option 2" || String(opt).toLowerCase() === "option2") return "2";
    return "";
  }

  // fetch beneficiaries when filterOption or village changes or reloadKey changes
  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    async function loadList() {
      setLoadingList(true);
      setListError(null);

      try {
        if (!effectiveVillageId) {
          throw new Error(
            "No village selected. Please select a village from the dashboard."
          );
        }

        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" };

        const optParam = optionQueryParam(filterOption);
        const url =
          `https://villagerelocation.onrender.com/villages/${encodeURIComponent(
            effectiveVillageId
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
  }, [filterOption, effectiveVillageId, reloadKey]);

  // click outside to close filter menu
  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target) && !filterBtnRef.current?.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // filter by search
  const filteredFamilies = beneficiaries.filter((f) => {
    if (!f) return false;
    const name = (f.mukhiyaName || "").toString();
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // view family (open modal)
  const handleViewFamily = (familyId) => {
    if (familyId === undefined || familyId === null) {
      console.error("No familyId provided to modal");
      return;
    }
    setSelectedFamilyId(familyId);
  };

  const closeModal = () => {
    setSelectedFamilyId(null);
  };

  // update URL (open query param) when user clicks a filter option
  const onSelectFilterOption = useCallback(
    (opt) => {
      setFilterOption(opt);
      setFilterMenuOpen(false);
      // keep villageId in URL if present
      const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
      qp.set("open", opt === "All" ? "all" : opt === "Option 1" ? "option1" : "option2");
      if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
      setSearchParams(qp, { replace: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveVillageId, searchParams]
  );

  // special handler to open-only the filter panel (ie. open=filter)
  const openFilterPanel = useCallback(() => {
    const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
    qp.set("open", "filter");
    if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
    setSearchParams(qp, { replace: true });
    setFilterMenuOpen(true);
    setTimeout(() => optionAllRef.current?.focus(), 0);
  }, [effectiveVillageId, searchParams, setSearchParams]);

  const refresh = () => setReloadKey((k) => k + 1);

  // If no village -> show select-village UI
  if (!effectiveVillageId) {
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
        <MainNavbar village={effectiveVillageId} showInNavbar={true} />
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

          <div className="relative flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm"
            >
              ← Back
            </button>
            {/* Filter button that toggles a dropdown */}
            <div className="relative">
              <button
                ref={filterBtnRef}
                onClick={() => {
                  // if menu already open, close it; otherwise open and set URL to open=filter
                  if (filterMenuOpen) {
                    setFilterMenuOpen(false);
                  } else {
                    openFilterPanel();
                  }
                }}
                aria-haspopup="true"
                aria-expanded={filterMenuOpen}
                className="inline-flex items-center gap-2 p-2 bg-white border rounded-lg shadow hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <SlidersHorizontal size={18} />
                <span className="sr-only">Open filter</span>
                <span className="hidden sm:inline">Filter</span>
              </button>

              {filterMenuOpen && (
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label="Filter options"
                  className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-50 py-2"
                >
                  <button
                    ref={optionAllRef}
                    role="menuitem"
                    onClick={() => onSelectFilterOption("All")}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${
                      filterOption === "All" ? "font-semibold" : ""
                    }`}
                  >
                    All Families
                  </button>
                  <button
                    ref={option1Ref}
                    role="menuitem"
                    onClick={() => onSelectFilterOption("Option 1")}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${
                      filterOption === "Option 1" ? "font-semibold" : ""
                    }`}
                  >
                    Option 1 Families
                  </button>
                  <button
                    ref={option2Ref}
                    role="menuitem"
                    onClick={() => onSelectFilterOption("Option 2")}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${
                      filterOption === "Option 2" ? "font-semibold" : ""
                    }`}
                  >
                    Option 2 Families
                  </button>
                </div>
              )}
            </div>

            
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
                  <FamilyCard
                    key={family.familyId ?? family.id ?? family._id}
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
