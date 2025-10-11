﻿// src/pages/FamilyList.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
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

/* -------------------------
  FamilyCard (visual) — motion style, shows full details
  ------------------------- */
function FamilyCard({ family, onView }) {
  const photo = family.mukhiyaPhoto || "/images/default-avatar.png";
  const name = family.mukhiyaName || "Unknown";
  const familyId = family.familyId || family.id || family._id || "—";
  const optionRaw = family.relocationOption || family.relocation || "";
  const optionDisplay = optionRaw ? optionRaw.toString().replace(/_/g, " ") : "—";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 shadow cursor-pointer hover:shadow-lg transition"
      onClick={() => onView(familyId)}
    >
      <div className="flex items-center gap-7">
        <img
          src={photo}
          onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
          alt={name}
          className="w-20 h-20 rounded-full object-cover border"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-gray-800 truncate">{name}</div>
              <div className="text-xs text-gray-500 mt-1 truncate">
                ID: <span className="font-medium text-gray-700">{familyId}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">
                Option: <span className="font-medium text-gray-700">{optionDisplay}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView(familyId);
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

/* -------------------------
  Main FamilyList page
  ------------------------- */
export default function FamilyList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

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

  const [search, setSearch] = useState("");

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const optionAllRef = useRef(null);
  const option1Ref = useRef(null);
  const option2Ref = useRef(null);
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);

  // chart states
  const [chartData, setChartData] = useState(null); // array
  const [chartKeys, setChartKeys] = useState([]); // option keys (e.g., ['Option_1','Option_2'])
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);

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
      // if URL specifically requests filter, open menu
      setFilterMenuOpen(true);
      setTimeout(() => optionAllRef.current?.focus(), 0);
    } else {
      setFilterOption("All");
      setFilterMenuOpen(false);
    }
  }, [searchParams]);

  // -------------------------
  // Fetch beneficiaries ONCE per village / on manual refresh.
  // We intentionally do NOT include `filterOption` here so switching
  // filters won't trigger another backend call.
  // -------------------------
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

        // fetch all beneficiaries for the village — apply filter client-side
        const url = `${API_BASE}/villages/${encodeURIComponent(effectiveVillageId)}/beneficiaries`;

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

        // API returns { result: [ { familyId, mukhiyaName, mukhiyaPhoto, relocationOption } ] }
        const list = Array.isArray(data.result) ? data.result : [];
        if (!mounted) return;
        setBeneficiaries(list);
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
  }, [effectiveVillageId, reloadKey]); // <--- filterOption removed intentionally

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

  // Fetch analytics for chart based on filterOption (only when Option_1 or Option_2 selected)
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
      // If 'All' is selected, do not call analytics API
      if (!effectiveVillageId || !filterOption || filterOption === "All") {
        // clear chart state
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
        // only requested when filterOption is a single option (Option_1 or Option_2)
        const resp = await fetchAnalyticsForOption(filterOption);
        // resp.stages: [{id,name,count}]
        const data = (resp.stages || []).map((s) => ({ name: s.name || s.id, [filterOption]: s.count || 0 }));

        // Only set chart if there is data
        if (!mounted) return;
        if (data && data.length > 0) {
          setChartData(data);
          setChartKeys([filterOption]);
        } else {
          // no data -> leave chartData null so the box will not show
          setChartData(null);
          setChartKeys([]);
        }
      } catch (err) {
        if (!mounted) return;
        // on error we don't show the analytics box (per request)
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

  // apply textual search & option filter client-side (no backend calls)
  const filteredFamilies = beneficiaries.filter((f) => {
    if (!f) return false;
    const name = (f.mukhiyaName || "").toString();
    if (!name.toLowerCase().includes(search.toLowerCase())) return false;

    if (!filterOption || filterOption === "All") return true;
    const opt = (f.relocationOption || f.relocation || "").toString();
    if (!opt) return false;
    return opt.toLowerCase() === filterOption.toString().toLowerCase();
  });

  const handleViewFamily = (familyId) => {
    if (familyId === undefined || familyId === null) {
      console.error("No familyId provided to navigation");
      return;
    }
    navigate(`/families/${encodeURIComponent(familyId)}`);
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

  // show chart box only when option is Option_1 or Option_2 AND chart has data or is loading
  const shouldShowChartBox = filterOption !== "All" && (chartLoading || (chartData && chartData.length > 0));

  // helper to update URL search param for filter menu
  function setOpenQueryToFilter() {
    const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
    qp.set("open", "filter");
    if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
    setSearchParams(qp, { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <div>
        <MainNavbar village={effectiveVillageId} showInNavbar={true} />
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
          <button
            onClick={() => navigate("/home")}
            className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3">
            {/*
              Change: filter menu now opens on hover (and on focus for keyboard users).
              We keep the menu clickable, focusable and accessible. A small close-delay
              helps avoid accidental flicker when moving the mouse.
            */}
            <div
              className="relative"
              onMouseEnter={() => {
                if (closeTimerRef.current) {
                  clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = null;
                }
                setFilterMenuOpen(true);
                // keep URL in sync (optional) so users can share link
                setOpenQueryToFilter();
                // focus first option after opening
                setTimeout(() => optionAllRef.current?.focus(), 50);
              }}
              onMouseLeave={() => {
                // short delay so quick moves don't close the menu immediately
                closeTimerRef.current = setTimeout(() => setFilterMenuOpen(false), 150);
              }}
            >
              <button
                ref={filterBtnRef}
                aria-haspopup="true"
                aria-expanded={filterMenuOpen}
                onFocus={() => {
                  // keyboard users: open on focus
                  if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current);
                    closeTimerRef.current = null;
                  }
                  setFilterMenuOpen(true);
                  setOpenQueryToFilter();
                }}
                onBlur={() => {
                  // if focus moves outside both button and menu, close menu
                  setTimeout(() => {
                    if (!menuRef.current) return;
                    const active = document.activeElement;
                    if (!menuRef.current.contains(active) && !filterBtnRef.current?.contains(active)) {
                      setFilterMenuOpen(false);
                    }
                  }, 10);
                }}
                className="inline-flex items-center gap-2 p-2 bg-white border rounded-lg shadow hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <SlidersHorizontal size={18} />
              </button>

              {filterMenuOpen && (
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label="Filter options"
                  className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg z-50 py-2"
                  onFocus={() => {
                    if (closeTimerRef.current) {
                      clearTimeout(closeTimerRef.current);
                      closeTimerRef.current = null;
                    }
                  }}
                  onBlur={() => {
                    // close when keyboard focus leaves the menu
                    setTimeout(() => {
                      const active = document.activeElement;
                      if (!menuRef.current) return;
                      if (!menuRef.current.contains(active) && !filterBtnRef.current?.contains(active)) {
                        setFilterMenuOpen(false);
                      }
                    }, 10);
                  }}
                >
                  <button
                    ref={optionAllRef}
                    role="menuitem"
                    onClick={() => {
                      setFilterOption("All");
                      setFilterMenuOpen(false);
                      const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
                      qp.set("open", "all");
                      if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
                      setSearchParams(qp, { replace: true });
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "All" ? "font-semibold" : ""}`}
                  >
                    All Families
                  </button>
                  <button
                    ref={option1Ref}
                    role="menuitem"
                    onClick={() => {
                      setFilterOption("Option_1");
                      setFilterMenuOpen(false);
                      const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
                      qp.set("open", "option1");
                      if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
                      setSearchParams(qp, { replace: true });
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "Option_1" ? "font-semibold" : ""}`}
                  >
                    Option 1 Families
                  </button>
                  <button
                    ref={option2Ref}
                    role="menuitem"
                    onClick={() => {
                      setFilterOption("Option_2");
                      setFilterMenuOpen(false);
                      const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
                      qp.set("open", "option2");
                      if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
                      setSearchParams(qp, { replace: true });
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${filterOption === "Option_2" ? "font-semibold" : ""}`}
                  >
                    Option 2 Families
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="Search by mukhiya name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border rounded-md shadow-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        {/* Chart area: show only for Option_1 / Option_2 and only when there is data (or while loading) */}
        {shouldShowChartBox && (
          <div className="mb-6 w-full bg-white rounded-xl p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800">Stage analytics</div>
              <div className="text-xs text-gray-500">{`Showing ${filterOption.replace(/_/g, " ")}`}</div>
            </div>

            <div className="h-64">
              {chartLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-600">Loading chart…</div>
              ) : chartData && chartData.length ? (
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
            {filteredFamilies.length === 0 ? (
              <div className="text-sm text-gray-600">No families found.</div>
            ) : (
              // grid updated to show 3 cards per row on md+ screens
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {filteredFamilies.map((family) => (
                  <FamilyCard key={family.familyId ?? family.id ?? family._id} family={family} onView={handleViewFamily} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
