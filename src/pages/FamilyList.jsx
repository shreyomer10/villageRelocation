﻿

// File: src/pages/FamilyList.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { AuthContext } from "../context/AuthContext";
import FamilyOverviewModal from "../component/FamilyOverviewModal";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

function sanitizeFamilyId(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  const trimmed = s.replace(/^\/+|\/+$/g, "");
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : trimmed;
}

function FamilyCard({ family, onOpenModal }) {
  const photo = family.mukhiyaPhoto || "/images/default-avatar.png";
  const name = family.mukhiyaName || "Unknown";
  const rawFamilyId = family.familyId ?? family.id ?? family._id ?? "—";
  const displayFamilyId = String(rawFamilyId);
  const familyIdForNav = sanitizeFamilyId(rawFamilyId) ?? displayFamilyId;
  const optionRaw = family.relocationOption || family.relocation || "";
  const optionDisplay = optionRaw ? optionRaw.toString().replace(/_/g, " ") : "—";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-100 rounded-2xl p-4 shadow cursor-pointer hover:shadow-lg transition"
      onClick={() => onOpenModal(familyIdForNav)}
    >
      <div className="flex items-center gap-7">
        <img
          src={photo}
          onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
          alt={name}
          className="w-20 h-20 rounded-full object-cover border bg-gray-50"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-gray-800 truncate">{name}</div>
              <div className="text-xs text-gray-500 mt-1 truncate">
                ID: <span className="font-medium text-gray-700">{displayFamilyId}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">
                Option: <span className="font-medium text-gray-700">{optionDisplay}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal(familyIdForNav);
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                View Family
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function FamilyList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);

  const queryVillageId = searchParams.get("villageId");
  const [storedVillageId, setStoredVillageId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("villageId") : null
  );
  const effectiveVillageId = queryVillageId ?? storedVillageId;

  const [reloadKey, setReloadKey] = useState(0);

  const openParam = (searchParams.get("open") ?? "").toLowerCase();
  const normalizedOpen =
    openParam === "option1" || openParam === "1" || openParam === "option-1"
      ? "Option_1"
      : openParam === "option2" || openParam === "2" || openParam === "option-2"
      ? "Option_2"
      : openParam === "all"
      ? "All"
      : null;
  const [filterOption, setFilterOption] = useState(normalizedOpen ?? "All");

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const p = Number(searchParams.get("limit"));
    return [5, 10, 15, 25, 50].includes(p) ? p : 15;
  });
  const [totalCount, setTotalCount] = useState(null);

  const [search, setSearch] = useState(() => searchParams.get("mukhiyaName") || "");
  const searchDebounceRef = useRef(null);

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const optionAllRef = useRef(null);
  const option1Ref = useRef(null);
  const option2Ref = useRef(null);
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [chartData, setChartData] = useState(null);
  const [chartKeys, setChartKeys] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFamilyId, setModalFamilyId] = useState(null);

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

  useEffect(() => {
    const open = (searchParams.get("open") ?? "").toLowerCase();
    if (open === "option1" || open === "1" || open === "option-1") {
      setFilterOption("Option_1");
      setFilterMenuOpen(false);
      setTimeout(() => option1Ref.current?.focus(), 0);
    } else if (open === "option2" || open === "2" || open === "option-2") {
      setFilterOption("Option_2");
      setFilterMenuOpen(false);
      setTimeout(() => option2Ref.current?.focus(), 0);
    } else if (open === "all") {
      setFilterOption("All");
      setFilterMenuOpen(false);
      setTimeout(() => optionAllRef.current?.focus(), 0);
    } else if (open === "filter") {
      setFilterMenuOpen(true);
      setTimeout(() => optionAllRef.current?.focus(), 0);
    } else {
      setFilterOption("All");
      setFilterMenuOpen(false);
    }
  }, [searchParams]);

  function setOpenQueryToFilter() {
    const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
    qp.set("open", "filter");
    if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
    setSearchParams(qp, { replace: true });
  }

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    async function loadList() {
      setLoadingList(true);
      setListError(null);

      try {
        if (!effectiveVillageId) {
          throw new Error("No village selected. Please select a village from the dashboard.");
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" };

        const qp = new URLSearchParams();
        qp.set("page", String(page));
        qp.set("limit", String(pageSize));
        if (filterOption && filterOption !== "All") qp.set("optionId", filterOption);
        if (search && search.trim().length > 0) qp.set("mukhiyaName", search.trim());

        const url = `${API_BASE}/villages/${encodeURIComponent(effectiveVillageId)}/beneficiaries?${qp.toString()}`;

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

        const data = await res.json().catch(() => null);
        const list = (data && Array.isArray(data.result) ? data.result : Array.isArray(data) ? data : (data && Array.isArray(data.result) ? data.result : []));

        let total = null;
        if (data && typeof data.totalCount === "number") total = data.totalCount;
        else if (data && typeof data.total === "number") total = data.total;
        else if (data && typeof data.count === "number") total = data.count;
        else {
          const hdr = res.headers.get("X-Total-Count");
          if (hdr) {
            const n = Number(hdr);
            if (!Number.isNaN(n)) total = n;
          }
        }

        if (!mounted) return;
        setBeneficiaries(list || []);
        setTotalCount(total !== null ? total : null);
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
  }, [effectiveVillageId, reloadKey, page, pageSize, filterOption, search]);

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

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
      if (search) qp.set("mukhiyaName", search);
      else qp.delete("mukhiyaName");
      if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
      setSearchParams(qp, { replace: true });
    }, 450);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  useEffect(() => {
    let mounted = true;

    async function fetchAnalyticsForOption(optionKey) {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const url = `${API_BASE}/analytics/options/${encodeURIComponent(optionKey)}${effectiveVillageId ? `?villageId=${encodeURIComponent(effectiveVillageId)}` : ""}`;
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Analytics fetch failed (${res.status}) ${txt}`);
      }
      const json = await res.json().catch(() => ({}));
      if (json && json.error) throw new Error(json.message || "Analytics API error");
      return json.result || json;
    }

    async function loadChart() {
      if (!effectiveVillageId || !filterOption || filterOption === "All") {
        if (mounted) {
          setChartData(null);
          setChartKeys([]);
          setChartError(null);
          setChartLoading(false);
        }
        return;
      }

      setChartLoading(true);
      setChartError(null);
      setChartData(null);
      setChartKeys([]);

      try {
        const resp = await fetchAnalyticsForOption(filterOption);
        const data = (resp.stages || []).map((s) => ({ name: s.name || s.id, [filterOption]: s.count || 0 }));
        if (!mounted) return;
        if (data && data.length > 0) {
          setChartData(data);
          setChartKeys([filterOption]);
        } else {
          setChartData(null);
          setChartKeys([]);
        }
      } catch (err) {
        if (!mounted) return;
        setChartError(err.message || "Failed to load analytics");
        setChartData(null);
        setChartKeys([]);
      } finally {
        if (mounted) setChartLoading(false);
      }
    }

    loadChart();
    return () => {
      mounted = false;
    };
  }, [filterOption, effectiveVillageId]);

  // Navigate to family details page (same behavior as previous code) -- keep persistence and auth updates
  const navigateToFamilyDetails = (familyId) => {
    if (familyId === undefined || familyId === null) {
      console.error("No familyId provided to navigation");
      return;
    }
    const fid = String(sanitizeFamilyId(familyId) ?? familyId);
    try { localStorage.setItem("selectedFamilyId", fid); localStorage.setItem("familyId", fid); } catch (e) { console.warn("Could not persist selectedFamilyId to localStorage", e); }
    try {
      if (auth) {
        if (typeof auth.setSelectedFamilyId === "function") auth.setSelectedFamilyId(fid);
        else if (typeof auth.setFamilyId === "function") auth.setFamilyId(fid);
        else if (typeof auth.setSelectedFamily === "function") auth.setSelectedFamily(fid);
      }
    } catch (e) { console.warn("AuthContext update error:", e); }

    // closing modal and navigating
    setModalOpen(false);
    setModalFamilyId(null);

    navigate(`/families`, { state: { familyId: fid } });
  };

  const refresh = () => setReloadKey((k) => k + 1);

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
            <p className="text-sm text-gray-700">No village selected. Please select a village from the dashboard first.</p>
          </div>
        </main>
      </div>
    );
  }

  const shouldShowChartBox = filterOption !== "All" && (chartLoading || (chartData && chartData.length > 0));
  const startIndex = totalCount !== null ? (totalCount === 0 ? 0 : (page - 1) * pageSize + 1) : (beneficiaries.length === 0 ? 0 : (page - 1) * pageSize + 1);
  const endIndex = startIndex === 0 ? 0 : startIndex + beneficiaries.length - 1;
  const totalPages = totalCount !== null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;

  function renderPageButtons() {
    if (totalPages !== null) {
      const windowSize = 5;
      let start = Math.max(1, page - Math.floor(windowSize / 2));
      let end = Math.min(totalPages, start + windowSize - 1);
      if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
      const buttons = [];
      buttons.push(<button key="first" onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 border rounded mx-1 text-sm">«</button>);
      buttons.push(<button key="prev" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 border rounded mx-1 text-sm">Prev</button>);
      for (let p = start; p <= end; p++) {
        buttons.push(<button key={p} onClick={() => setPage(p)} className={`px-3 py-1 border rounded mx-1 text-sm ${p === page ? "bg-green-200 font-semibold" : ""}`}>{p}</button>);
      }
      buttons.push(<button key="next" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 border rounded mx-1 text-sm">Next</button>);
      buttons.push(<button key="last" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 border rounded mx-1 text-sm">»</button>);
      return <div className="flex items-center">{buttons}</div>;
    }

    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm">Prev</button>
        <div className="text-sm px-2">Page {page}</div>
        <button onClick={() => { if (beneficiaries.length < pageSize) return; setPage((p) => p + 1); }} disabled={beneficiaries.length < pageSize} className="px-3 py-1 border rounded text-sm">Next</button>
      </div>
    );
  }

  // open modal when a card clicked
  const openOverviewModal = (fid) => {
    setModalFamilyId(String(fid));
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <div>
        <MainNavbar village={effectiveVillageId} showInNavbar={true} />
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
          <button onClick={() => navigate("/home")} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm">← Back</button>

          <div className="flex items-center gap-3">
            <div className="relative"
                 onMouseEnter={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } setFilterMenuOpen(true); setOpenQueryToFilter(); setTimeout(() => optionAllRef.current?.focus(), 50); }}
                 onMouseLeave={() => { closeTimerRef.current = setTimeout(() => setFilterMenuOpen(false), 150); }}>
              <button ref={filterBtnRef} aria-haspopup="true" aria-expanded={filterMenuOpen} onFocus={() => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } setFilterMenuOpen(true); setOpenQueryToFilter(); }} onBlur={() => { setTimeout(() => { if (!menuRef.current) return; const active = document.activeElement; if (!menuRef.current.contains(active) && !filterBtnRef.current?.contains(active)) { setFilterMenuOpen(false); } }, 10); }} className="inline-flex items-center gap-2 p-2 bg-white border rounded-lg shadow hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400">
                <SlidersHorizontal size={18} />
              </button>

              {filterMenuOpen && (
                <div ref={menuRef} role="menu" aria-label="Filter options" className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg z-50 py-2">
                  <button ref={optionAllRef} role="menuitem" onClick={() => { setFilterOption("All"); setFilterMenuOpen(false); setPage(1); const qp = new URLSearchParams(Object.fromEntries(searchParams.entries())); qp.set("open", "all"); if (effectiveVillageId) qp.set("villageId", effectiveVillageId); setSearchParams(qp, { replace: true }); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "All" ? "font-semibold" : ""}`}>All Families</button>
                  <button ref={option1Ref} role="menuitem" onClick={() => { setFilterOption("Option_1"); setFilterMenuOpen(false); setPage(1); const qp = new URLSearchParams(Object.fromEntries(searchParams.entries())); qp.set("open", "option1"); if (effectiveVillageId) qp.set("villageId", effectiveVillageId); setSearchParams(qp, { replace: true }); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "Option_1" ? "font-semibold" : ""}`}>Option 1 Families</button>
                  <button ref={option2Ref} role="menuitem" onClick={() => { setFilterOption("Option_2"); setFilterMenuOpen(false); setPage(1); const qp = new URLSearchParams(Object.fromEntries(searchParams.entries())); qp.set("open", "option2"); if (effectiveVillageId) qp.set("villageId", effectiveVillageId); setSearchParams(qp, { replace: true }); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "Option_2" ? "font-semibold" : ""}`}>Option 2 Families</button>
                </div>
              )}
            </div>

            <input type="text" placeholder="Search by mukhiya name" value={search} onChange={(e) => setSearch(e.target.value)} className="px-4 py-2 border rounded-md shadow-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">{totalCount !== null ? <>{totalCount === 0 ? 0 : startIndex}–{endIndex} of {totalCount}</> : <>Page {page}</>}</div>
            <div className="flex items-center gap-2 text-sm">
              <div className="text-xs text-gray-500">Page size</div>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="p-1 border rounded">{[5,10,15,25,50].map(n => <option key={n} value={n}>{n}</option>)}</select>
            </div>
          </div>

          <div>{renderPageButtons()}</div>
        </div>

        {shouldShowChartBox && (
          <div className="mb-6 w-full bg-white rounded-xl p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800">Stage analytics</div>
              <div className="text-xs text-gray-500">{`Showing ${filterOption.replace(/_/g, " ")}`}</div>
            </div>

            <div className="h-64">
              {chartLoading ? <div className="h-full flex items-center justify-center text-sm text-gray-600">Loading chart…</div> : chartData && chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey={chartKeys[0]} name={chartKeys[0].replace(/_/g, " ")} fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        )}

        {listError && <div className="text-sm text-red-600 mb-4">{listError}</div>}
        {loadingList ? (
          <div className="py-8 text-center text-sm text-gray-600">Loading families…</div>
        ) : (
          <>
            {beneficiaries.length === 0 ? (
              <div className="text-sm text-gray-600">No families found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {beneficiaries.map((family) => (
                  <FamilyCard key={family.familyId ?? family.id ?? family._id} family={family} onOpenModal={openOverviewModal} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <FamilyOverviewModal
        familyId={modalFamilyId}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setModalFamilyId(null); }}
        onShowDetails={(fid) => navigateToFamilyDetails(fid)}
      />
    </div>
  );
}
