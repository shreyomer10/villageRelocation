import React, { useEffect, useState, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, MapPin, Calendar, Layers, User } from "lucide-react";
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

  const [saving, setSaving] = useState(false);

  // Helper to close the modal and clear selectedVillageId in context/localStorage
  const closeModal = useCallback(() => {
    try {
      if (typeof setSelectedVillageId === "function") setSelectedVillageId(null);
    } catch (e) {
      // swallow to avoid breaking UI
      // eslint-disable-next-line no-console
      console.warn("setSelectedVillageId threw while clearing:", e);
    }
    try {
      localStorage.removeItem("selectedVillageId");
    } catch (e) {
      // ignore localStorage errors (private mode, etc.)
    }
    try {
      onClose();
    } catch (e) {
      // keep UI responsive
      // eslint-disable-next-line no-console
      console.warn("onClose threw:", e);
    }
  }, [onClose, setSelectedVillageId]);

  // put village id into context (if setter exists) and persist locally when modal opens
  useEffect(() => {
    if (!open) return;
    const id = village?.villageId ?? village?.id ?? village?._id ?? null;
    if (id && typeof setSelectedVillageId === "function") {
      try {
        setSelectedVillageId(id);
      } catch (e) {
        // swallow to avoid breaking UI if context setter misbehaves
        // eslint-disable-next-line no-console
        console.warn("setSelectedVillageId threw:", e);
      }
    }
    try {
      if (id != null) localStorage.setItem("selectedVillageId", String(id));
    } catch (e) {
      // ignore localStorage errors
    }

    // cleanup when the modal is closed/unmounted
    return () => {
      try {
        if (typeof setSelectedVillageId === "function") setSelectedVillageId(null);
      } catch (e) {}
      try {
        localStorage.removeItem("selectedVillageId");
      } catch (e) {}
    };
  }, [village, open, setSelectedVillageId]);

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
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  if (!open) return null;

  if (!village) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-md w-full max-w-2xl p-4 border border-gray-100 relative">
          <button
            onClick={closeModal}
            className="absolute right-3 top-3 p-1 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="py-8 text-center text-gray-600 text-sm">No details available.</div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={closeModal}
              className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-sm"
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

  const stageDef = stageDefs.find((s) => s.stage_id === currentSeq) ?? null;
  const subStages = Array.isArray(stageDef?.subStages) ? stageDef.subStages : [];
  const stageName = stageDef?.name ?? "Unknown stage";
  const subStageObj = subStages.find((s) => String(s.id) === String(currentSub)) ?? null;
  const subStageName = subStageObj?.name ?? null;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        // close when clicking the overlay (but not when clicking inner content)
        if (e.target === e.currentTarget) closeModal();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-md w-full max-w-2xl p-4 border border-transparent relative transform transition-all"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxHeight: "85vh", overflowY: "auto" }}
      >
        {/* Close Button */}
        <button
          onClick={closeModal}
          className="absolute right-3 top-3 p-1 rounded-full hover:bg-gray-100"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            
            <div>
              <h2 className="text-md font-semibold text-gray-900">{village.name}</h2>
              <p className="text-xs text-gray-500">ID: {village.villageId ?? village.id ?? village._id}</p>
            </div>
          </div>

          
        </div>

        {/* Stage Progress - compact */}
        <div className="mb-4">
          <div className="mx-auto mx-w-auto">
            <StageProgress  currentStage={currentSeq} currentSubStage={currentSub} />
            <div className="mt-2 text-center">
  <h1 className="text-lg font-semibold">
    Current Stage: <span className="text-indigo-700">{stageName}</span>
    {subStageName && (
      <span className="text-gray-400 text-sm ml-2">({subStageName})</span>
    )}
  </h1>
</div>

          </div>
        </div>

        {/* Main Content - compact layout */}
        <div className="gap-3 mb-3">
          <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-100 rounded-lg p-3 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Calendar className="w-7 h-7 text-gray-500 mt-1" />
                <div>
                  <dt className="text-xs text-gray-400 uppercase">Last updated</dt>
                  <dd className="text-gray-800 font-medium">{updatedOn}</dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-7 h-7 text-gray-500 mt-1" />
                <div>
                  <dt className="text-xs text-gray-400 uppercase">Site</dt>
                  <dd className="text-gray-800 font-medium">{siteOfRelocation}</dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Layers className="w-7 h-7 text-gray-500 mt-1" />
                <div>
                  <dt className="text-xs text-gray-400 uppercase">Area (ha)</dt>
                  <dd className="text-gray-800 font-medium">{areaDiverted}</dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <User className="w-7 h-7 text-gray-500 mt-1" />
                <div>
                  <dt className="text-xs text-gray-400 uppercase">Updated by</dt>
                  <dd className="text-gray-800 font-medium">{village.updatedBy ?? village.lastUpdatedBy ?? village.lastUpdatedby ?? "-"}</dd>
                </div>
              </div>
            </div>

            {village.notes && (
              <div className="mt-3 p-2 rounded-md bg-white border border-gray-100 text-xs text-gray-600">
                {village.notes}
              </div>
            )}
          </div>

          
        </div>

        {/* Buttons below village details */}
        <div className="mt-2 flex flex-col sm:flex-row sm:justify-center gap-2">
          <button
            onClick={() => handleOpenProfile(village)}
            className="w-full sm:w-auto text-sm px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm hover:opacity-95"
          >
            Open Profile
          </button>
          <button
            onClick={closeModal}
            className="w-full sm:w-auto text-sm px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {/* Footer small note */}
        <div className="text-xs text-gray-400 text-right mt-3">Last synced: {updatedOn}</div>
      </div>
    </div>
  );
}
