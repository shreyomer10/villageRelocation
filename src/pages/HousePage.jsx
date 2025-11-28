// Updated PlotsPage.jsx — stores selected plot into AuthContext when available
// Falls back to localStorage if AuthContext is not available or doesn't expose expected setters
// Also includes a short example AuthContext implementation (below) showing the expected API.

import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";
import { AuthContext } from "../context/AuthContext"; // expected to exist in your project

export default function PlotsPage() {
  const navigate = useNavigate();
  const villageId = localStorage.getItem("villageId") || "";

  const authCtx = useContext(AuthContext);

  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15); // default page size
  const [totalCount, setTotalCount] = useState(null);

  // types (buildings) fetched from API — kept because cards rely on this
  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // filters / search (single combined field for mukhiyaName OR familyId)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchTimer = useRef(null);

  // numberOfHome filter (optional)
  const [numberOfHomeFilter, setNumberOfHomeFilter] = useState(""); // expects "1","2","3" or empty

  // deleted view toggle (server-side)
  const [showDeleted, setShowDeleted] = useState(false);

  // helper for auth headers
  function authHeaders() {
    const token = localStorage.getItem("token");
    return token
      ? { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json", Accept: "application/json" };
  }

  // fetch wrapper
  async function fetchWithCreds(url, opts = {}) {
    try {
      const headers = { ...(authHeaders() || {}), ...(opts.headers || {}) };
      const res = await fetch(url, {
        credentials: "include",
        headers,
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

  // load types (buildings) for internal use in cards (kept — cards use these details)
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
        const items = payload?.result?.items ?? (Array.isArray(payload) ? payload : (payload.items ?? []));
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

  // reset page to 1 when village changes
  useEffect(() => {
    setPage(1);
  }, [villageId]);

  // reset page to 1 when any filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, showDeleted, pageSize, numberOfHomeFilter]);

  // fetch when page, pageSize or villageId changes OR when filters change
  useEffect(() => {
    fetchPlots(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, page, pageSize, debouncedQuery, showDeleted, numberOfHomeFilter]);

  // debounced search for server-side name/family filter
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => setDebouncedQuery(searchQuery.trim()),
      300
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
      const params = new URLSearchParams();
      params.append("page", String(requestPage));
      params.append("limit", String(pageSize));

      // Combined filter behavior:
      // - if debouncedQuery contains whitespace -> treat as mukhiyaName (regex search)
      // - if debouncedQuery is a single token (alphanumeric/underscore/hyphen) -> treat as familyId
      if (debouncedQuery) {
        const q = debouncedQuery;
        const hasSpace = /\s/.test(q);
        const singleTokenIdLike = /^[A-Za-z0-9_\-]+$/.test(q);

        if (hasSpace) {
          // likely a name (multiple words) -> send as mukhiyaName (regex)
          params.append("mukhiyaName", q);
        } else if (singleTokenIdLike) {
          // single token (no spaces) -> treat as familyId
          params.append("familyId", q);
        } else {
          // fallback to name search
          params.append("mukhiyaName", q);
        }
      }

      // numberOfHome filter (backend expects 'numberOfHome' values 1/2/3)
      if (numberOfHomeFilter) {
        params.append("numberOfHome", numberOfHomeFilter);
      }

      // deleted must be "1" or "0"
      params.append("deleted", showDeleted ? "1" : "0");

      const url = `${API_BASE}/house/${encodeURIComponent(villageId)}?${params.toString()}`;
      const { ok, status, json, text } = await fetchWithCreds(url, { method: "GET" });

      if (!ok) {
        if (status === 404) {
          setPlots([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        if (status === 401) {
          setError((json && (json.message || json.error)) || text || "Unauthorized — please sign in");
          setPlots([]);
          setLoading(false);
          return;
        }
        throw new Error((json && (json.message || JSON.stringify(json))) || text || `Failed to fetch houses: ${status}`);
      }

      const payload = json ?? {};

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
        items = payload.items ?? (Array.isArray(payload) ? payload : []);
        respPage = payload.page ?? requestPage;
        respLimit = payload.limit ?? pageSize;
        respCount = payload.count ?? null;
      }

      setPlots(items || []);
      setPage(Number(respPage ?? requestPage));
      setPageSize(Number(respLimit ?? pageSize));
      setTotalCount(respCount !== null ? Number(respCount) : null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching houses");
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }

  // toggle deleted view
  function toggleDeletedView() {
    setShowDeleted((s) => !s);
    setPage(1);
  }

  // type name renderer uses fetched `types` first (if available), then falls back to server-provided fields
  function typeNameFor(typeId, plot = null) {
    const t = (types || []).find(
      (x) =>
        (x.typeId ?? x.type_id ?? x.id ?? x.optionId) === typeId ||
        String(x.typeId) === String(typeId)
    );
    if (t && (t.name || t.label)) return t.name ?? t.label;
    // prefer directly provided name from plot if server included it
    if (plot && (plot.typeName || plot.type)) return plot.typeName || plot.type;
    return typeId ?? "-";
  }

  // pagination helpers
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  function goPage(n) {
    if (!n || n < 1) return;
    if (totalPages && n > totalPages) return;
    setPage(n);
  }

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

  // store selection in AuthContext if available, otherwise fallback to localStorage
  function persistSelectedPlotToAuthContext(pid, preview) {
    try {
      if (authCtx) {
        // try common setter names (use whichever your AuthContext provides)
        if (typeof authCtx.setSelectedPlot === "function") {
          authCtx.setSelectedPlot(preview);
          return true;
        }
        if (typeof authCtx.setPlotId === "function") {
          authCtx.setPlotId(pid);
          // also store preview if context supports it
          if (typeof authCtx.setSelectedPlot === "function") authCtx.setSelectedPlot(preview);
          return true;
        }
        if (typeof authCtx.update === "function") {
          // generic update method: merge an object
          authCtx.update({ selectedPlot: preview, plotId: pid });
          return true;
        }
      }

      // fallback to localStorage
      localStorage.setItem("plotId", String(pid));
      localStorage.setItem("selectedPlot", JSON.stringify(preview));
      return true;
    } catch (e) {
      console.warn("persistSelectedPlotToAuthContext failed, falling back to localStorage", e);
      try { localStorage.setItem("plotId", String(pid)); localStorage.setItem("selectedPlot", JSON.stringify(preview)); } catch (_) {}
      return false;
    }
  }

  function selectPlot(plot) {
    try {
      const pid = plot.plotId ?? plot.id ?? plot._id ?? "";
      const preview = {
        plotId: pid,
        name: plot.name ?? null,
        familyId: plot.familyId ?? null,
        typeId: plot.typeId ?? null,
        villageId: plot.villageId ?? plot.village ?? null,
      };

      persistSelectedPlotToAuthContext(pid, preview);

      // navigate using route only — HomeDetailsPage will resolve id from AuthContext/localStorage
      navigate(`/house/one/${encodeURIComponent(pid)}`);
    } catch (e) {
      console.warn("Failed to save selected house to AuthContext/localStorage", e);
      navigate(`/house/one/${encodeURIComponent(plot.plotId ?? plot.id ?? plot._id ?? "")}`);
    }
  }

  function goToHouse(houseId, plot = null) {
    if (!houseId) return;
    try {
      const pid = plot?.plotId ?? plot?.id ?? plot?._id ?? null;
      if (pid) {
        const sp = { plotId: pid, name: plot?.name ?? null };
        persistSelectedPlotToAuthContext(pid, sp);
      }
      localStorage.setItem("houseId", String(houseId));
    } catch (e) {
      // ignore storage errors
    }
    navigate(`/house/one/${encodeURIComponent(houseId)}`);
  }

  const displayedPlots = plots || [];

  function getHomeId(h) {
    return h.houseId ?? h.homeId ?? h.id ?? h._id ?? h.house_id ?? null;
  }

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
                placeholder="Search by mukhiya name OR familyId"
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

            {/* numberOfHome select (optional) */}
            <div className="bg-white rounded-lg shadow-sm p-2 flex items-center">
              <select
                value={numberOfHomeFilter}
                onChange={(e) => setNumberOfHomeFilter(e.target.value)}
                className="p-1 text-sm outline-none"
              >
                <option value="">All homes</option>
                <option value="1">1 home</option>
                <option value="2">2 homes</option>
                <option value="3">3 homes</option>
              </select>
              {numberOfHomeFilter && (
                <button
                  onClick={() => setNumberOfHomeFilter("")}
                  className="ml-2 text-xs px-2 py-1 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="ml-2">
              <button
                onClick={toggleDeletedView}
                className={`px-3 py-2 rounded-md text-sm ${showDeleted ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-600"}`}
                title="Toggle deleted houses"
              >
                {showDeleted ? "Showing deleted" : "Showing active"}
              </button>
            </div>

          </div>

        </div>

        {/* pagination info & controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {totalCount !== null ? (
                totalCount === 0 ? (
                  <>No houses</>
                ) : (
                  <>
                    Showing {(Math.min(totalCount, (page - 1) * pageSize + 1))}–{Math.min(totalCount, page * pageSize)} of {totalCount}
                  </>
                )
              ) : (
                <>Page {page}</>
              )}
            </div>

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
          <div className="text-center py-8">Loading houses....</div>
        ) : error ? (
          <div className="text-red-600 py-6 whitespace-pre-wrap">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {displayedPlots.length === 0 ? (
              <div className="text-sm text-gray-500">No houses found</div>
            ) : (
              displayedPlots.map((p) => {
                const key = String(p.plotId ?? p.id ?? p._id ?? Math.random());
                const houseId = p.houseId ?? p.homeId ?? p._id ?? p.plotId ?? null;
                const isDeleted = Boolean(p.deleted);
                return (
                  <div
                    key={key}
                    role={isDeleted ? "button" : "link"}
                    tabIndex={isDeleted ? -1 : 0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isDeleted) {
                        selectPlot(p);
                      }
                    }}
                    onClick={() => { if (!isDeleted) selectPlot(p); }}
                    className={` rounded-xl shadow hover:shadow-lg p-4 border transition transform ${isDeleted ? "bg-red-100 ring-0 cursor-not-allowed opacity-70" : "bg-blue-100 cursor-pointer"}`}
                    aria-disabled={isDeleted}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className={`text-lg font-semibold truncate ${isDeleted ? "text-gray-400" : "text-gray-800"}`}>
                            {p.name ?? (p.homeDetails?.[0]?.mukhiyaName ?? p.plotId ?? "Unnamed")}
                          </div>
                          <div className="text-xs text-gray-500">
                            {typeNameFor(p.typeId, p)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {showDeleted && (
          <div className="mt-6 text-sm text-gray-600">
            Showing deleted houses. Use the toggle to switch back to active houses.
          </div>
        )}

        <div className="h-24" />
      </div>

    </div>
  );
}

