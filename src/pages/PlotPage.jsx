// src/pages/PlotsPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";

export default function PlotsPage() {
  const navigate = useNavigate();
  const villageId = localStorage.getItem("villageId") || "";

  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15); // default page size
  const [totalCount, setTotalCount] = useState(null);

  // building types used as "typeId" for plots (fetched from /buildings/<villageId>)
  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // filters / search
  const [filterTypeId, setFilterTypeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchTimer = useRef(null);

  // deleted view toggle
  const [showDeleted, setShowDeleted] = useState(false);

  // helper for auth headers (keeps support for Authorization if you ever use header-based token)
  function authHeaders() {
    const token = localStorage.getItem("token");
    return token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
  }

  // --- helper: fetch that always sends cookies and safely parses responses ---
  async function fetchWithCreds(url, opts = {}) {
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
        ...opts,
      });

      const text = await res.text().catch(() => "");
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        json = null;
      }

      return { res, ok: res.ok, status: res.status, json, text };
    } catch (err) {
      return { res: null, ok: false, status: 0, json: null, text: String(err) };
    }
  }
  // -------------------------------------------------------------------------

  // load types (buildings) for dropdown
  useEffect(() => {
    let mounted = true;
    (async () => {
      setTypesLoading(true);
      try {
        if (!villageId) {
          setTypes([]);
          return;
        }
        const url = `${API_BASE}/buildings/${encodeURIComponent(villageId)}`;
        const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

        if (!mounted) return;

        if (!ok) {
          if (status === 404) {
            setTypes([]);
            return;
          }
          if (status === 401) {
            setError((json && (json.message || json.error)) || text || "Unauthorized — please sign in");
            return;
          }
          throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch building types: ${status}`);
        }

        const payload = json ?? {};
        const items = payload?.result?.items ?? (Array.isArray(payload) ? payload : []);
        if (!mounted) return;
        setTypes(items);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(err.message || "Failed to load building types");
      } finally {
        if (mounted) setTypesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [villageId]);

  // fetch plots when villageId or page or pageSize changes
  useEffect(() => {
    // reset to page 1 when village changes
    setPage(1);
  }, [villageId]);

  useEffect(() => {
    fetchPlots(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, page, pageSize]);

  // debounced search for client side filtering
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => setDebouncedQuery(searchQuery.trim().toLowerCase()),
      250
    );
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  async function fetchPlots(requestPage = 1) {
    if (!villageId) {
      setError("Missing villageId (store it as localStorage 'villageId')");
      setPlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // request with page & limit.
      const q = `?page=${encodeURIComponent(requestPage)}&limit=${encodeURIComponent(pageSize)}`;
      const url = `${API_BASE}/plots/${encodeURIComponent(villageId)}${q}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

      if (!ok) {
        if (status === 404) {
          setPlots([]);
          setLoading(false);
          return;
        }
        if (status === 401) {
          setError((json && (json.message || json.error)) || text || "Unauthorized — please sign in");
          setPlots([]);
          setLoading(false);
          return;
        }
        throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch plots: ${status}`);
      }

      const payload = json ?? {};

      // robust parsing for different payload shapes:
      let items = [];
      let respPage = requestPage;
      let respLimit = pageSize;
      let respCount = null;

      if (payload.result) {
        const r = payload.result;
        items = r.items ?? (Array.isArray(r) ? r : []);
        respPage = r.page ?? r.pageNo ?? payload.page ?? requestPage;
        respLimit = r.limit ?? payload.limit ?? pageSize;
        respCount = r.count ?? payload.count ?? null;
      } else {
        items = payload?.result?.items ?? payload.items ?? (Array.isArray(payload) ? payload : []);
        respPage = payload.page ?? requestPage;
        respLimit = payload.limit ?? pageSize;
        respCount = payload.count ?? null;
      }

      setPlots(items);
      setPage(Number(respPage ?? requestPage));
      setPageSize(Number(respLimit ?? pageSize));
      setTotalCount(respCount !== null ? Number(respCount) : null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching plots");
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }

  // toggle deleted view (just toggle, data comes from the single /plots response for the current page)
  function toggleDeletedView() {
    setShowDeleted((s) => !s);
  }

  // derive active and deleted lists from the single page's plots array
  const allPlots = plots || [];
  const deletedPlotsList = allPlots.filter((p) => p.deleted);
  const activePlotsList = allPlots.filter((p) => !p.deleted);

  // derived filtered list for the main grid (show only active plots)
  const filteredPlots = (activePlotsList || []).filter((p) => {
    // type filter (client-side only)
    if (filterTypeId) {
      const plotType =
        String(p.typeId ?? p.type_id ?? p.id ?? p.optionId ?? "");
      if (String(filterTypeId) !== plotType) return false;
    }

    if (!debouncedQuery) return true;
    const q = debouncedQuery;
    const name = (p.name || "").toString().toLowerCase();
    const pid = (p.plotId || "").toString().toLowerCase();
    const fam = (p.familyId || "").toString().toLowerCase();
    const type = (p.typeId || "").toString().toLowerCase();
    return (
      name.includes(q) ||
      pid.includes(q) ||
      fam.includes(q) ||
      type.includes(q)
    );
  });

  // filtered deleted plots to show in deleted panel (client-side only)
  const filteredDeletedPlots = (deletedPlotsList || []).filter((dp) => {
    if (filterTypeId) {
      const dpType =
        String(dp.typeId ?? dp.type_id ?? dp.id ?? dp.optionId ?? "");
      if (String(filterTypeId) !== dpType) return false;
    }
    return true;
  });

  function typeNameFor(typeId) {
    const t = (types || []).find(
      (x) =>
        (x.typeId ?? x.type_id ?? x.id ?? x.optionId) === typeId ||
        String(x.typeId) === String(typeId)
    );
    return t?.name ?? typeId;
  }

  // pagination helpers
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  function goPage(n) {
    if (!n || n < 1) return;
    if (totalPages && n > totalPages) return;
    setPage(n);
  }

  // render page number buttons (small window)
  function renderPageButtons() {
    if (!totalPages) return (
      <div className="text-sm">Page {page}</div>
    );

    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    if (end - start + 1 < windowSize) {
      start = Math.max(1, end - windowSize + 1);
    }

    const buttons = [];
    for (let i = start; i <= end; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => goPage(i)}
          className={`px-2 py-1 rounded ${i === page ? "bg-gray-200" : "hover:bg-gray-100"}`}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => goPage(1)}
          disabled={page === 1}
          className="px-2 py-1 rounded disabled:opacity-50"
        >
          {"<<"}
        </button>
        <button
          onClick={() => goPage(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 rounded disabled:opacity-50"
        >
          Prev
        </button>

        {buttons}

        <button
          onClick={() => goPage(page + 1)}
          disabled={totalPages !== null && page >= totalPages}
          className="px-2 py-1 rounded disabled:opacity-50"
        >
          Next
        </button>
        <button
          onClick={() => goPage(totalPages)}
          disabled={totalPages !== null && page >= totalPages}
          className="px-2 py-1 rounded disabled:opacity-50"
        >
          {">>"}
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Fancy custom dropdown component (replaces native <select>)        */
  function SelectDropdown({ value, onChange, items = [], placeholder = "All types" }) {
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(null);
    const ref = useRef(null);

    useEffect(() => {
      function onDoc(e) {
        if (!ref.current) return;
        if (!ref.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const selected = items.find(
      (it) => String(it.typeId ?? it.type_id ?? it.id ?? it.optionId) === String(value)
    );

    const selectedName = selected ? selected.name || `#${selected.typeId ?? selected.id}` : placeholder;

    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-150 focus:outline-none w-64"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <div className="flex-1 text-left truncate text-sm">
            <span className={selected ? "font-medium text-gray-900" : "text-gray-500"}>{selectedName}</span>
          </div>

          <div className="flex items-center gap-2">
            {selected && (
              <button
                onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
                className="text-xs px-2 py-1 bg-gray-100 rounded-full hover:bg-gray-200"
                aria-label="Clear selection"
              >
                Clear
              </button>
            )}

            <svg className={`w-4 h-4 transform ${open ? "rotate-180" : "rotate-0"} transition-transform`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-2 w-64 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
            <div className="max-h-64 overflow-auto">
              {items.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No types available</div>
              ) : (
                items.map((it) => {
                  const id = it.typeId ?? it.type_id ?? it.id ?? it.optionId;
                  return (
                    <div
                      key={String(id)}
                      onMouseEnter={() => setHovered(it)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => { onChange(String(id)); setOpen(false); }}
                      role="option"
                      aria-selected={String(id) === String(value)}
                      className={`px-3 py-3 cursor-pointer hover:bg-gray-50 flex items-start justify-between transition-colors ${String(id) === String(value) ? "bg-gray-50" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{it.name ?? `Type ${String(id)}`}</div>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        {String(id) === String(value) && (
                          <div className="text-blue-600 font-semibold">✓</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  /* ------------------------------------------------------------------ */

  // --- NEW: helper to store selected plot in localStorage and navigate ---
  function selectPlot(plot) {
    try {
      const pid = plot.plotId ?? plot.id ?? plot._id ?? "";
      localStorage.setItem("plotId", String(pid));
      const preview = {
        plotId: pid,
        name: plot.name ?? null,
        familyId: plot.familyId ?? null,
        typeId: plot.typeId ?? null,
      };
      localStorage.setItem("selectedPlot", JSON.stringify(preview));
    } catch (e) {
      console.warn("Failed to save selected plot to localStorage", e);
    }
    navigate(`/plots/one/${encodeURIComponent(plot.plotId ?? plot.id ?? plot._id ?? "")}`);
  }

  // render
  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar showVillageInNavbar={true} />
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header / controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="px-3 py-2 border rounded-md bg-white text-sm shadow-sm hover:shadow"
            >
              ← Back
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative bg-white rounded-md border flex items-center shadow-sm">
              <svg
                className="w-5 h-5 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plots by name, id, family or type"
                className="p-2 outline-none w-56"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedQuery("");
                  }}
                  className="px-2 py-1 text-sm text-gray-500"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-sm">
              <SelectDropdown
                items={types}
                value={filterTypeId}
                onChange={(v) => setFilterTypeId(v)}
                placeholder={typesLoading ? "Loading types…" : "All types"}
              />
            </div>

          </div>

        </div>

        {/* pagination info & controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Showing range */}
            <div className="text-sm text-gray-600">
              {totalCount ? (
                <>
                  Showing {Math.min(totalCount, (page - 1) * pageSize + 1)}–{Math.min(totalCount, page * pageSize)} of {totalCount}
                </>
              ) : (
                <>Page {page}</>
              )}
            </div>

            {/* page size selector */}
            <div className="flex items-center gap-2 text-sm">
              <div className="text-xs text-gray-500">Page size</div>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="p-1 border rounded"
              >
                {[5, 10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>{renderPageButtons()}</div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading plots…</div>
        ) : error ? (
          <div className="text-red-600 py-6 whitespace-pre-wrap">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredPlots.length === 0 ? (
              <div className="text-sm text-gray-500">No plots found</div>
            ) : (
              filteredPlots.map((p) => {
                return (
                  <div
                    key={String(p.plotId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        selectPlot(p);
                      }
                    }}
                    onClick={() => selectPlot(p)}
                    className={`bg-white rounded-xl shadow hover:shadow-lg p-4 border transition transform ${p.deleted ? "ring-0" : ""} cursor-pointer`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className={`text-lg font-semibold truncate ${p.deleted ? "line-through text-gray-400" : "text-gray-800"}`}>
                            {p.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {typeNameFor(p.typeId)}
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-gray-500 flex flex-wrap gap-3">
                          <div className="px-2 py-1 bg-gray-100 rounded">
                            ID: {p.plotId}
                          </div>
                          <div className="px-2 py-1 bg-gray-100 rounded">
                            Family: {p.familyId ?? "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* link to view deleted plots - only show when there are deleted plots in this page */}
            {!loading && deletedPlotsList && deletedPlotsList.length > 0 && (
              <div className="sm:col-span-2 mt-3 text-center">
                <button
                  onClick={toggleDeletedView}
                  className="underline text-blue-600"
                >
                  {showDeleted
                    ? "Hide deleted plots"
                    : `View deleted plots (${deletedPlotsList.length})`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Deleted plots panel */}
        {showDeleted && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3">Deleted plots (this page)</h4>
            {filteredDeletedPlots.length === 0 ? (
              <div className="text-xs text-gray-500">No deleted plots</div>
            ) : (
              <div className="space-y-3 ">
                {filteredDeletedPlots.map((dp) => (
                  <div
                    key={String(dp.plotId)}
                    className="p-3 bg-gray-50 border rounded-xl"
                  >
                    <div className="font-medium text-gray-400">
                      {dp.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      ID: {dp.plotId}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Type: {typeNameFor(dp.typeId)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="h-24" />
      </div>
    </div>
  );
}
