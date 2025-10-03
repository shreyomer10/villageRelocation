// src/pages/FamilyList.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, UploadCloud, X, Check } from "lucide-react";
import MainNavbar from "../component/MainNavbar";
import { API_BASE } from "../config/Api.js";

/* -------------------------
   FamilyCard (visual)
   ------------------------- */
function FamilyCard({ family, onView }) {
  return (
    <div className="bg-[#f0f4ff] rounded-2xl p-4 shadow-md text-center hover:shadow-lg transition">
      <img
        src={family.mukhiyaPhoto || "/images/default-avatar.png"}
        alt={family.mukhiyaName || "Mukhiya"}
        onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
        className="w-24 h-24 mx-auto rounded-full object-cover border mb-3"
      />
      <h3 className="font-semibold text-gray-800">{family.mukhiyaName || "Unknown"}</h3>
      <button
        onClick={() => onView(family.familyId ?? family.id)}
        className="mt-3 px-4 py-1 text-sm bg-indigo-500 hover:bg-indigo-600 text-white rounded-md shadow"
      >
        View Family
      </button>
    </div>
  );
}

/* -------------------------
   Helper: CSV parser (handles quotes)
   - returns array of objects using header row
   ------------------------- */
function parseCSV(text) {
  // split lines, trim blank lines
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { header: [], rows: [] };

  // regex to split on commas not inside quotes
  const splitter = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;

  const header = lines[0]
    .split(splitter)
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((ln) => {
    const cols = ln.split(splitter).map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = cols[i] === undefined ? "" : cols[i];
    });
    return obj;
  });
  return { header, rows };
}

/* -------------------------
   BulkUploadModal
   - accepts CSV or JSON
   - shows preview and POSTs to /families/insertbulk
   ------------------------- */
function BulkUploadModal({ isOpen, onClose, onUploaded }) {
  const [rawContent, setRawContent] = useState(null);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [previewHeader, setPreviewHeader] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [responseSummary, setResponseSummary] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setRawContent(null);
      setFileName("");
      setParsedRows([]);
      setPreviewHeader([]);
      setResponseSummary(null);
      setUploading(false);
    }
  }, [isOpen]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result);
      setRawContent(text);

      // Determine JSON or CSV by extension or beginning char
      if (/\.json$/i.test(file.name) || text.trim().startsWith("{") || text.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(text);
          // if JSON is an object with families property, try to extract
          const arr = Array.isArray(parsed)
            ? parsed
            : parsed && Array.isArray(parsed.families)
            ? parsed.families
            : [];
          setParsedRows(arr);
          setPreviewHeader(arr.length ? Object.keys(arr[0]) : []);
        } catch (err) {
          setParsedRows([]);
          setPreviewHeader([]);
        }
      } else {
        // CSV
        const { header, rows } = parseCSV(text);
        setPreviewHeader(header);
        setParsedRows(rows);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function doUpload() {
    if (!parsedRows || !parsedRows.length) {
      alert("No families parsed. Please select a valid CSV or JSON file using the template.");
      return;
    }
    setUploading(true);
    setResponseSummary(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = token
        ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" };

      const res = await fetch(`${API_BASE}/families/insertbulk`, {
        method: "POST",
        headers,
        body: JSON.stringify({ families: parsedRows }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = { message: "No JSON response" };
      }

      if (!res.ok) {
        setResponseSummary({ error: true, message: data.message ?? `Status ${res.status}`, data });
      } else {
        setResponseSummary({ error: false, message: data.message ?? "Upload completed", data: data.result ?? data });
        // allow parent to refresh list if needed
        if (onUploaded) onUploaded();
      }
    } catch (err) {
      setResponseSummary({ error: true, message: err.message });
    } finally {
      setUploading(false);
    }
  }

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg overflow-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-3">
            <UploadCloud size={18} /> <div className="font-semibold">Bulk upload families</div>
            {fileName && <div className="text-sm text-gray-500 ml-2">({fileName})</div>}
          </div>
          <div>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border rounded-lg p-3">
              <label className="block text-sm font-medium mb-2">Choose CSV or JSON file</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,application/json,text/csv"
                onChange={handleFileSelect}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-2">
                The CSV must have a header row. Columns will map to object keys. For complex fields (members) prefer JSON input.
              </div>
            </div>

            <div className="border rounded-lg p-3">
              <label className="block text-sm font-medium mb-2">Preview</label>
              {parsedRows.length ? (
                <div className="text-sm text-gray-700">
                  <div className="mb-2">Parsed rows: <span className="font-medium">{parsedRows.length}</span></div>
                  <div className="text-xs text-gray-500 mb-2">Showing first 5 rows</div>
                  <div className="overflow-auto max-h-40 border rounded">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {previewHeader.map((h) => (
                            <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="even:bg-white odd:bg-gray-50">
                            {previewHeader.map((h) => (
                              <td key={h} className="px-2 py-1 align-top">{String(r[h] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No preview available — select a CSV or JSON file.</div>
              )}
            </div>
          </div>

          {responseSummary && (
            <div className={`p-3 rounded ${responseSummary.error ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              <div className="font-medium">{responseSummary.message}</div>
              <pre className="mt-2 max-h-40 overflow-auto text-xs">{JSON.stringify(responseSummary.data ?? responseSummary, null, 2)}</pre>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setRawContent(null);
                setParsedRows([]);
                setPreviewHeader([]);
                setFileName("");
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              onClick={doUpload}
              disabled={uploading || parsedRows.length === 0}
              className={`px-4 py-2 rounded-lg text-white ${uploading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}`}
            >
              {uploading ? "Uploading…" : "Upload to server"}
            </button>
          </div>

          <div className="text-xs text-gray-500">
            Tip: The backend expects objects matching the Family schema. If your CSV doesn't include nested fields (members, photos), prefer JSON. If you want, I can add a downloadable template file for CSV/JSON format — say the word and I'll include it in the modal.
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   Main FamilyList page
   ------------------------- */
export default function FamilyList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // villageId precedence: query param -> localStorage
  const queryVillageId = searchParams.get("villageId");
  const [storedVillageId, setStoredVillageId] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("villageId") : null
  );
  const effectiveVillageId = queryVillageId ?? storedVillageId;

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

  // filter dropdown refs
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const optionAllRef = useRef(null);
  const option1Ref = useRef(null);
  const option2Ref = useRef(null);
  const menuRef = useRef(null);

  // bulk modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

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
      setFilterMenuOpen(true);
      setTimeout(() => optionAllRef.current?.focus(), 0);
    } else {
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
          throw new Error("No village selected. Please select a village from the dashboard.");
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token
          ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" };

        const optParam = optionQueryParam(filterOption);
        const url =
          `${API_BASE}/villages/${encodeURIComponent(effectiveVillageId)}/beneficiaries` +
          (optParam ? `?optionId=${encodeURIComponent(optParam)}` : "");

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

  // navigate to family details page when card pressed
  const handleViewFamily = (familyId) => {
    if (familyId === undefined || familyId === null) {
      console.error("No familyId provided to navigation");
      return;
    }
    navigate(`/families/${encodeURIComponent(familyId)}`);
  };

  const onBulkUploaded = () => {
    // refresh list after bulk upload
    setReloadKey((k) => k + 1);
    setBulkModalOpen(false);
  };

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
            <p className="text-sm text-gray-700">No village selected. Please select a village from the dashboard first.</p>
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
        {/* Search + Filters + Bulk Upload */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <input
            type="text"
            placeholder="Search by mukhiya name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border rounded-md shadow-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-400"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm"
            >
              ← Back
            </button>

            <div className="relative">
              <button
                ref={filterBtnRef}
                onClick={() => {
                  if (filterMenuOpen) {
                    setFilterMenuOpen(false);
                  } else {
                    const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
                    qp.set("open", "filter");
                    if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
                    setSearchParams(qp, { replace: true });
                    setFilterMenuOpen(true);
                    setTimeout(() => optionAllRef.current?.focus(), 0);
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
                  className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg z-50 py-2"
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
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${
                      filterOption === "All" ? "font-semibold" : ""
                    }`}
                  >
                    All Families
                  </button>
                  <button
                    ref={option1Ref}
                    role="menuitem"
                    onClick={() => {
                      setFilterOption("Option 1");
                      setFilterMenuOpen(false);
                      const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
                      qp.set("open", "option1");
                      if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
                      setSearchParams(qp, { replace: true });
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${
                      filterOption === "Option 1" ? "font-semibold" : ""
                    }`}
                  >
                    Option 1 Families
                  </button>
                  <button
                    ref={option2Ref}
                    role="menuitem"
                    onClick={() => {
                      setFilterOption("Option 2");
                      setFilterMenuOpen(false);
                      const qp = new URLSearchParams(Object.fromEntries(searchParams.entries()));
                      qp.set("open", "option2");
                      if (effectiveVillageId) qp.set("villageId", effectiveVillageId);
                      setSearchParams(qp, { replace: true });
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 focus:outline-none ${
                      filterOption === "Option 2" ? "font-semibold" : ""
                    }`}
                  >
                    Option 2 Families
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setBulkModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow hover:bg-gray-50 text-sm"
            >
              <UploadCloud size={16} /> Bulk Upload
            </button>

            <button
              onClick={refresh}
              title="Refresh list"
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow hover:bg-gray-50 text-sm"
            >
              <Check size={16} /> Refresh
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

      {/* Bulk Upload Modal */}
      <BulkUploadModal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} onUploaded={onBulkUploaded} />
    </div>
  );
}
