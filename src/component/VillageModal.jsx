import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { stageDefs } from "../config/stages";
import StageProgress from "./StageProgress";
import { AuthContext } from "../context/AuthContext";

export default function VillageModal({
  open = false,
  village = null,
  onClose = () => {},
  onOpenProfile = null,
  onSaveVillage = null,
}) {
  const navigate = useNavigate();
  const { setSelectedVillageId } = useContext(AuthContext) || {};

  const [editableUpdatedBy, setEditableUpdatedBy] = useState("");
  const [liveUpdatedBy, setLiveUpdatedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(""); // '', 'Saving…', 'Saved', 'Error'
  const saveTimerRef = useRef(null);

  // Helper: determine canonical village id from various possible fields
  const getVillageId = (v) => {
    if (!v) return null;
    return v.villageId ?? v.id ?? v._id ?? null;
  };

  // Helper: create a storage-safe key for the current folder/path
  const getStoragePathKey = () => {
    try {
      // Use location pathname as "folder" context. e.g. "/villages/list" -> "_villages_list"
      const path = window.location && window.location.pathname ? window.location.pathname : "root";
      const safe = path.replace(/\//g, "_") || "_root";
      return safe;
    } catch (e) {
      return "root";
    }
  };

  // Save village id locally for this "folder" (path). Also maintain a small recent list.
  const saveVillageIdLocally = (id) => {
    if (!id) return;
    try {
      const pathKey = getStoragePathKey();
      const singleKey = `selectedVillageId:${pathKey}`;
      const recentKey = `recentVillageIds:${pathKey}`;

      // store single value
      localStorage.setItem(singleKey, String(id));

      // store recent list (most recent first), keep up to 10
      const raw = localStorage.getItem(recentKey);
      let recent = [];
      try {
        recent = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(recent)) recent = [];
      } catch (e) {
        recent = [];
      }

      // remove existing entry for this id
      recent = recent.filter((r) => String(r?.id) !== String(id));
      recent.unshift({ id: String(id), ts: Date.now() });

      if (recent.length > 10) recent = recent.slice(0, 10);
      localStorage.setItem(recentKey, JSON.stringify(recent));
    } catch (e) {
      // localStorage might be disabled -> ignore silently but warn in dev
      // eslint-disable-next-line no-console
      console.warn("saveVillageIdLocally failed:", e);
    }
  };

  // put village id into context (if setter exists). support multiple id field names.
  useEffect(() => {
    if (!open) return;
    const id = getVillageId(village);
    if (id && typeof setSelectedVillageId === "function") {
      try {
        setSelectedVillageId(id);
      } catch (e) {
        // swallow to avoid breaking UI if context setter misbehaves
        // eslint-disable-next-line no-console
        console.warn("setSelectedVillageId threw:", e);
      }
    }

    // store villageId locally per-folder/path whenever modal opens or village changes
    if (id) {
      saveVillageIdLocally(id);
    }
  }, [village, open, setSelectedVillageId]);

  // initialize fields when village changes
  useEffect(() => {
    if (village) {
      const initial = village.updatedBy ?? village.lastUpdatedBy ?? village.lastUpdatedby ?? "";
      setEditableUpdatedBy(initial);
      setLiveUpdatedBy(initial);
      setSaveError(null);
      setSaveStatus("");
    }
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [village]);

  // prevent body scrolling while modal is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return;
  }, [open]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  if (!village) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-md shadow w-full max-w-2xl p-4 border border-gray-200 relative">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1 rounded hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="py-8 text-center text-gray-600">No details available.</div>
          <div className="mt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentSeq = village.currentStage ?? 0;
  const currentSub = village.currentSubStage ?? null;

  const updatedOn = village.lastUpdatedOn ?? village.updatedAt ?? village.date ?? "-";
  const areaDiverted = village.areaDiverted ?? "-";
  const siteOfRelocation = village.siteOfRelocation ?? village.areaOfRelocation ?? "-";

  const doAutoSave = async (value) => {
    const original = village.updatedBy ?? village.lastUpdatedBy ?? village.lastUpdatedby ?? "";
    if (value === original) {
      setSaveStatus("Saved");
      saveTimerRef.current = setTimeout(() => setSaveStatus(""), 1500);
      return;
    }

    if (typeof onSaveVillage !== "function") {
      setSaveStatus("Saved");
      saveTimerRef.current = setTimeout(() => setSaveStatus(""), 1500);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveStatus("Saving…");
    try {
      await onSaveVillage({
        villageId: getVillageId(village),
        updatedBy: value,
      });
      setSaving(false);
      setSaveStatus("Saved");
      saveTimerRef.current = setTimeout(() => setSaveStatus(""), 1500);
    } catch (err) {
      setSaving(false);
      const msg = err?.message ?? String(err ?? "Save failed");
      setSaveError(msg);
      setSaveStatus("Error");
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setEditableUpdatedBy(val);
    setLiveUpdatedBy(val);
    setSaveStatus("");
    setSaveError(null);

    // debounce/save after small delay (simple approach)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doAutoSave(val), 800);
  };

  const handleOpenProfile = (v) => {
    try {
      if (typeof onOpenProfile === "function") onOpenProfile(v);
    } catch (e) {
      // keep UI responsive even if callback throws
      // eslint-disable-next-line no-console
      console.warn("onOpenProfile threw:", e);
    } finally {
      try {
        navigate("/home");
      } catch (e) {
        // ignore navigation errors in tests
      }
    }
  };

  const stageDef = stageDefs.find((s) => s.stage_id === currentSeq) ?? null;
  const subStages = Array.isArray(stageDef?.subStages) ? stageDef.subStages : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        // close when clicking the overlay (but not when clicking inner content)
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-md shadow w-full max-w-2xl p-4 border border-gray-200 relative"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 p-1 rounded hover:bg-gray-100"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <header className="mb-3">
          <h2 className="text-base font-semibold text-gray-800">{village.name}</h2>
          <p className="text-xs text-gray-600">
            Village ID: {getVillageId(village)}
          </p>
        </header>

        {/* Stage Progress */}
        <div className="mb-4">
          <StageProgress currentStage={currentSeq} currentSubStage={currentSub} />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Sub-stages */}
          <div className="md:col-span-1 bg-gray-50 p-3 rounded">
            <div className="font-medium text-sm text-gray-700 mb-2">Sub-stages</div>
            {subStages.length === 0 ? (
              <div className="text-gray-500 text-xs">No stage selected</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {subStages.map((sub) => {
                  const done = currentSub !== null && Number(sub.id) <= Number(currentSub);
                  return (
                    <li key={sub.id} className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 text-xs rounded-full flex-shrink-0 ${
                          done ? "bg-green-600 text-white" : "border border-gray-300 text-gray-500"
                        }`}
                      >
                        {done ? "✓" : sub.id}
                      </span>
                      <span className={done ? "text-gray-800 text-sm" : "text-gray-500 text-sm"}>
                        {sub.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Village Details */}
          <div className="md:col-span-2 p-3 rounded border border-gray-100">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div>
                <dt className="text-xs text-gray-500 uppercase">Last updated</dt>
                <dd className="text-gray-700">{updatedOn}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Area diverted (ha)</dt>
                <dd className="text-gray-700">{areaDiverted}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Site of relocation</dt>
                <dd className="text-gray-700">{siteOfRelocation}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Updated by</dt>
                <dd className="text-gray-700">
                  {liveUpdatedBy || "-"}
                  {/* simple inline edit input (optional) */}
                  <div className="mt-1">
                    <input
                      value={editableUpdatedBy}
                      onChange={handleInputChange}
                      className="border px-2 py-1 text-sm rounded w-full"
                      placeholder="Edit updated by"
                    />
                    <div className="text-xs mt-1">
                      {saveStatus && <span>{saveStatus}{saveError ? `: ${saveError}` : ""}</span>}
                    </div>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2 mt-1">
          <button
            onClick={() => handleOpenProfile(village)}
            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            Open Profile
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
