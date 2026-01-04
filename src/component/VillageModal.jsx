import React, { useEffect, useState, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, MapPin, Layers, User } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import Timeline from "../component/Timeline";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../config/Api.js";

export default function VillageModal({
  open = false,
  village = null,
  onClose = () => {},
  onOpenProfile = null,
  onSaveVillage = null,
}) {
  const navigate = useNavigate();
  const { setSelectedVillageId, token } = useContext(AuthContext) || {};

  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [stagesError, setStagesError] = useState(null);

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

  // fetch /stages when modal opens to map substage ids to names
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const fetchStages = async () => {
      setLoadingStages(true);
      setStagesError(null);
      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/stages`, { headers });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Failed to fetch stages: ${res.status} ${txt}`);
        }
        const data = await res.json();
        // The API returns { result: { count, items: [...] } } in your example.
        // Prefer result.items if present, otherwise fall back to other shapes.
        const list = Array.isArray(data)
          ? data
          : data?.result?.items ?? data?.result ?? data?.stages ?? data?.data ?? [];
        if (mounted) setStages(list);
      } catch (err) {
        // keep UI tolerant: surface error but continue with fallback lookup
        // eslint-disable-next-line no-console
        console.warn("Error fetching stages:", err);
        if (mounted) setStagesError(err?.message ?? String(err));
      } finally {
        if (mounted) setLoadingStages(false);
      }
    };

    fetchStages();
    return () => {
      mounted = false;
    };
  }, [open, token]);

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

  const handleSave = async () => {
    if (typeof onSaveVillage !== "function") return;
    try {
      setSaving(true);
      await onSaveVillage(village);
    } catch (e) {
      // surface minimal console info but keep UI intact
      // eslint-disable-next-line no-console
      console.error("save failed", e);
    } finally {
      setSaving(false);
    }
  };

  // derived values
  const currentSeq = village?.currentStage ?? 0;
  const currentSub = village?.currentSubStage ?? null;

  // ensure completedSubstages exists (try several common keys)
  const completedSubstages =
    village?.completedSubstages ??
    village?.completedSubStages ??
    village?.completed_substages ??
    village?.completedSteps ??
    [];

  const updatedOn = village?.lastUpdatedOn ?? village?.updatedAt ?? village?.date ?? "-";
  const areaDiverted = village?.areaDiverted ?? "-";
  const siteOfRelocation = village?.siteOfRelocation ?? village?.areaOfRelocation ?? "-";

  // small helper: present a trimmed id for compact display
  const compactId = (id) => (id ? String(id).slice(0, 8) : "-");

  // --- Helper: find substage name in fetched stages by matching stageId and subStageId ---
  const findSubstageNameFromFetched = (subId, stageId) => {
    if (subId == null) return null;
    const targetSub = String(subId);
    const targetStage = stageId != null ? String(stageId) : null;

    // If we have a targetStage string, try to find that stage object first (matching common keys)
    let candidates = stages;
    if (targetStage) {
      const found = stages.find((s) => {
        if (!s) return false;
        const ids = [s.stageId, s.id, s._id, s.code, s.key];
        return ids.some((x) => x != null && String(x) === targetStage);
      });
      if (found) candidates = [found];
    }

    // Iterate candidates and look for substage entries using the API's schema (stage.stages -> subStageId/name)
    for (const st of candidates) {
      if (!st) continue;
      // API uses 'stages' for nested substages according to the sample you pasted
      const subs = st.stages ?? st.substages ?? st.subStages ?? st.children ?? st.items ?? st.steps ?? [];
      if (!Array.isArray(subs)) continue;
      for (const ss of subs) {
        if (!ss) continue;
        // common substage id keys seen in your API: subStageId
        const subIds = [ss.subStageId, ss.substageId, ss.id, ss._id, ss.code, ss.key];
        for (const sid of subIds) {
          if (sid != null && String(sid) === targetSub) {
            return ss.name ?? ss.title ?? ss.label ?? ss.displayName ?? String(sid);
          }
        }
      }
    }

    return null;
  };

  // --- Fallback lookup using village object and other heuristics
  const getSubstageNameFallback = (subId, v) => {
    if (subId == null) return "-";

    const target = String(subId);

    const findInArray = (arr) => {
      if (!Array.isArray(arr)) return null;
      for (const item of arr) {
        if (!item) continue;
        if (typeof item === "string" || typeof item === "number") {
          if (String(item) === target) return String(item);
          continue;
        }
        const idCandidates = [item.id, item._id, item.substageId, item.subStageId, item.stageId, item.key, item.code];
        const nameCandidates = [item.name, item.title, item.label, item.substageName, item.stageName, item.displayName];
        for (const cand of idCandidates) {
          if (cand != null && String(cand) === target) {
            for (const n of nameCandidates) {
              if (n) return n;
            }
            return String(cand);
          }
        }
        const nested = item.substages || item.children || item.items || item.steps || item.stages;
        if (Array.isArray(nested)) {
          const found = findInArray(nested);
          if (found) return found;
        }
      }
      return null;
    };

    const candidates = [
      v?.subStages,
      v?.sub_stages,
      v?.substages,
      v?.stages,
      v?.stagesList,
      v?.stageDetails,
      v?.timeline,
      v?.timelineStages,
      v?.structure?.stages,
      v?.structure?.timeline,
      completedSubstages,
    ];

    for (const c of candidates) {
      const r = findInArray(c);
      if (r) return r;
    }

    if (v?.substageMap && typeof v.substageMap === "object") {
      const val = v.substageMap[target] ?? v.substageMap[subId];
      if (val) return val.name ?? val.title ?? String(val);
    }

    return String(subId);
  };

  // final: prefer fetched stage mapping, then fallback
  const currentSubName = (() => {
    if (currentSub == null) return "-";
    const fromFetched = findSubstageNameFromFetched(currentSub, currentSeq);
    if (fromFetched) return fromFetched;
    if (loadingStages) return null; // signal to UI that we're still loading
    return getSubstageNameFallback(currentSub, village);
  })();

  // handle timeline clicks (safe, won't throw if callbacks absent)
  const handleTimelineSelect = (stageObj, idx) => {
    try {
      if (stageObj?.selectedSub) {
        if (typeof onOpenProfile === "function") {
          onOpenProfile({ ...village, timelineSelection: { stage: stageObj, index: idx } });
        } else {
          handleOpenProfile(village);
        }
      } else {
        handleOpenProfile(village);
      }
    } catch (e) {
      // don't crash the UI
      // eslint-disable-next-line no-console
      console.warn("handleTimelineSelect threw", e);
      handleOpenProfile(village);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden={!open}
        >
          {/* dimmed backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
          />

          {/* Modal panel */}
          <motion.div
            className="relative w-full font-sans max-w-2xl bg-[#f8f0dc] rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
            role="dialog"
            aria-modal="true"
            initial={{ y: 24, opacity: 0, scale: 0.995 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.995 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-600 from-slate-50 to-slate-100 border border-gray-100">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{village?.name ?? "Village"}</h3>
                  <p className="text-s text-gray-500">ID: {compactId(village?.villageId ?? village?.id ?? village?._id)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={closeModal}
                  aria-label="Close dialog"
                  className="rounded-md p-2 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* body */}
            <div className="p-4 space-y-5">
              {/* Stage progress compact */}
              <div className="rounded-lg border border-gray-100 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700">Stages Of Relocation</h3>
                  </div>

                  <div className="text-sm text-gray-500">
                    Current Substage: <span className="font-medium text-gray-800">
                      {loadingStages ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" fill="none"/><path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
                          <span>Loading...</span>
                        </span>
                      ) : (
                        currentSubName ?? "-"
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <Timeline
                    currentStage={currentSeq}
                    currentSubStage={currentSub}
                    completedSubstages={completedSubstages}
                    onStageSelect={handleTimelineSelect}
                    showSubstages={false}
                  />
                </div>
              </div>

              {/* Main info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-blue-100 px-3 py-3 rounded-lg border">
                <InfoRow Icon={MapPin} label="Site" value={siteOfRelocation} />
                <InfoRow Icon={Layers} label="Area (ha)" value={areaDiverted} />
                <InfoRow Icon={User} label="Updated by" value={village?.updatedBy ?? village?.lastUpdatedBy ?? village?.lastUpdatedby ?? "-"} />
              </div>

              {village?.notes && (
                <div className="rounded-md border border-gray-100 p-4 bg-gray-50 text-sm text-gray-700">
                  <p className="font-medium text-gray-800">Notes</p>
                  <p className="mt-2 whitespace-pre-line text-sm">{village.notes}</p>
                </div>
              )}

              {/* interactive mini actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap sm:flex-row sm:items-center sm:justify-center">
                  <ActionChip onClick={() => handleOpenProfile(village)}>Open full profile</ActionChip>
                </div>
                <div className="text-xs text-gray-400 text-right">Last synced: {updatedOn}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Small subcomponents used to keep main component tidy */
function InfoRow({ Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition">
      <div className="w-10 h-10 flex items-center justify-center rounded-md bg-blue-800 border border-white">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <dt className="text-xs text-gray-600 uppercase">{label}</dt>
        <dd className="text-sm font-medium text-gray-900">{value}</dd>
      </div>
    </div>
  );
}

function ActionChip({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 bg-white hover:shadow hover:-translate-y-0.5 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-100"
    >
      {children}
    </button>
  );
}

function Spinner({ size = 20 }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="4"></circle>
      <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="4" strokeLinecap="round"></path>
    </svg>
  );
}
  