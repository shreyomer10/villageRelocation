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

  // building types used as "typeId" for plots (fetched from /buildings/<villageId>)
  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // filters / search
  const [filterTypeId, setFilterTypeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchTimer = useRef(null);

  // deleted plots
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedPlots, setDeletedPlots] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);

  // helper for auth headers
  function authHeaders() {
    const token = localStorage.getItem("token");
    return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" };
  }

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
        const res = await fetch(`${API_BASE}/buildings/${encodeURIComponent(villageId)}`);
        if (!mounted) return;
        if (res.status === 404) {
          setTypes([]);
          return;
        }
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`Failed to fetch building types: ${res.status} ${t}`);
        }
        const payload = await res.json();
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
    return () => { mounted = false; };
  }, [villageId]);

  // fetch plots (server side) whenever villageId or filterTypeId changes
  useEffect(() => {
    fetchPlots(filterTypeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, filterTypeId]);

  // fetch deleted plots silently so we can show/hide the "View deleted" link
  useEffect(() => {
    if (!villageId) return;
    fetchDeletedPlots(filterTypeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, filterTypeId]);

  // debounced search for client side filtering
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  async function fetchPlots(typeId = "") {
    if (!villageId) {
      setError("Missing villageId (store it as localStorage 'villageId')");
      setPlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = typeId ? `?typeId=${encodeURIComponent(typeId)}` : "";
      const res = await fetch(`${API_BASE}/plots/${encodeURIComponent(villageId)}${q}`);
      if (res.status === 404) {
        setPlots([]);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Failed to fetch plots: ${res.status} ${t}`);
      }
      const payload = await res.json();
      const items = payload?.result?.items ?? (Array.isArray(payload?.result) ? payload.result : (Array.isArray(payload) ? payload : []));
      setPlots(items);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching plots");
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDeletedPlots(typeId = "") {
    if (!villageId) return;
    setDeletedLoading(true);
    try {
      const q = typeId ? `?typeId=${encodeURIComponent(typeId)}` : "";
      const res = await fetch(`${API_BASE}/deleted_plots/${encodeURIComponent(villageId)}${q}`);
      if (res.status === 404) {
        setDeletedPlots([]);
        return;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Failed to fetch deleted plots: ${res.status} ${t}`);
      }
      const payload = await res.json();
      const items = payload?.result?.items ?? [];
      setDeletedPlots(items);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error fetching deleted plots");
      setDeletedPlots([]);
    } finally {
      setDeletedLoading(false);
    }
  }

  // toggle deleted view (called by link below cards)
  async function toggleDeletedView() {
    const next = !showDeleted;
    setShowDeleted(next);
    if (next) {
      await fetchDeletedPlots(filterTypeId);
    }
  }

  // derived filtered list (client-side search)
  const filteredPlots = (plots || []).filter(p => {
    if (!debouncedQuery) return true;
    const q = debouncedQuery;
    const name = (p.name || "").toString().toLowerCase();
    const pid = (p.plotId || "").toString().toLowerCase();
    const fam = (p.familyId || "").toString().toLowerCase();
    const type = (p.typeId || "").toString().toLowerCase();
    return name.includes(q) || pid.includes(q) || fam.includes(q) || type.includes(q);
  });

  function typeNameFor(typeId) {
    const t = (types || []).find(x => (x.typeId ?? x.type_id ?? x.id ?? x.optionId) === typeId || String(x.typeId) === String(typeId));
    return t?.name ?? typeId;
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar />
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header / controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/home')} className="px-3 py-2 border rounded-md bg-white text-sm shadow-sm hover:shadow">← Back</button>
            <div className="text-lg font-bold">Plots</div>
            <div className="text-sm text-gray-500 ml-2">{plots.length} total</div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative bg-white rounded p-2 flex items-center gap-2 shadow-sm">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search plots by name, id, family or type" className="p-2 outline-none w-56" />
              {searchQuery && <button onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }} className="px-2 py-1 text-sm text-gray-500">Clear</button>}
            </div>

            <div className="bg-white p-2 rounded shadow-sm">
              <select value={filterTypeId} onChange={(e) => setFilterTypeId(e.target.value)} className="p-2 border rounded outline-none">
                <option value="">All types</option>
                {types.map(t => {
                  const id = t.typeId ?? t.type_id ?? t.id ?? t.optionId;
                  return <option key={String(id)} value={String(id)}>{t.name} ({String(id)})</option>;
                })}
              </select>
            </div>

          </div>
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
              filteredPlots.map(p => {
                return (
                  <div
                    key={String(p.plotId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { navigate(`/plots/${encodeURIComponent(villageId)}/${encodeURIComponent(p.plotId)}`); } }}
                    onClick={() => { navigate(`/plots/${encodeURIComponent(villageId)}/${encodeURIComponent(p.plotId)}`); }}
                    className={`bg-white rounded-xl shadow hover:shadow-lg p-4 border transition transform ${p.deleted ? 'ring-0' : ''} cursor-pointer`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className={`text-lg font-semibold truncate ${p.deleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{p.name}</div>
                          <div className="text-xs text-gray-500">{typeNameFor(p.typeId)}</div>
                        </div>

                        <div className="mt-2 text-sm text-gray-500 flex flex-wrap gap-3">
                          <div className="px-2 py-1 bg-gray-100 rounded">ID: {p.plotId}</div>
                          <div className="px-2 py-1 bg-gray-100 rounded">Family: {p.familyId ?? '—'}</div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          {p.deleted ? (
                            <div className="text-xs text-red-600">Deleted</div>
                          ) : (
                            <div className="text-xs text-green-600">Active</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* link to view deleted plots - only show when there are deleted plots */}
            {(!loading && deletedPlots && deletedPlots.length > 0) && (
              <div className="sm:col-span-2 mt-3 text-center">
                <button onClick={toggleDeletedView} className="underline text-blue-600">{showDeleted ? 'Hide deleted plots' : `View deleted plots (${deletedPlots.length})`}</button>
              </div>
            )}

          </div>
        )}

        {/* Deleted plots panel */}
        {showDeleted && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3">Deleted plots</h4>
            {deletedLoading ? (
              <div className="text-sm text-gray-600">Loading deleted plots…</div>
            ) : deletedPlots.length === 0 ? (
              <div className="text-xs text-gray-500">No deleted plots</div>
            ) : (
              <div className="space-y-3">
                {deletedPlots.map(dp => (
                  <div key={String(dp.plotId)} className="p-3 bg-gray-50 border rounded">
                    <div className="font-medium line-through text-gray-400">{dp.name}</div>
                    <div className="text-xs text-gray-400 mt-1">ID: {dp.plotId}</div>
                    <div className="text-xs text-gray-400 mt-1">Type: {typeNameFor(dp.typeId)}</div>
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
