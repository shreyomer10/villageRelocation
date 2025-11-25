// src/pages/FamilyDetailPage.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MainNavbar from "../component/MainNavbar";
import {
  ArrowLeft,
  Image,
  Users,
  FileText,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  File,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../config/Api.js";

/* Small helpers */
function fmtDate(d) {
  try {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleString("en-IN");
  } catch (e) {
    return d;
  }
}

function ProgressBar({ pct }) {
  return (
    <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
      <div
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: "#1e40af" }}
        className="h-full rounded"
      />
    </div>
  );
}

/* Reusable small pagination UI */
function PaginationControls({ page, totalCount, pageSize, onPage }) {
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  if (!totalPages) return <div className="text-sm">Page {page}</div>;

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

  const buttons = [];
  for (let i = start; i <= end; i++) {
    buttons.push(
      <button
        key={i}
        onClick={() => onPage(i)}
        className={`px-2 py-1 rounded ${i === page ? "bg-gray-200" : "hover:bg-gray-100"}`}
      >
        {i}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <button onClick={() => onPage(1)} disabled={page === 1} className="px-2 py-1 rounded disabled:opacity-50">
        {"<<"}
      </button>
      <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-2 py-1 rounded disabled:opacity-50">
        Prev
      </button>
      {buttons}
      <button
        onClick={() => onPage(page + 1)}
        disabled={totalPages !== null && page >= totalPages}
        className="px-2 py-1 rounded disabled:opacity-50"
      >
        Next
      </button>
      <button
        onClick={() => onPage(totalPages)}
        disabled={totalPages !== null && page >= totalPages}
        className="px-2 py-1 rounded disabled:opacity-50"
      >
        {">>"}
      </button>
    </div>
  );
}

/* Main component */
export default function FamilyDetailPage() {
  const { familyId } = useParams();
  const navigate = useNavigate();
  const mountedRef = useRef(false);

  const [family, setFamily] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [familyError, setFamilyError] = useState(null);

  // Updates (paginated)
  const [familyUpdates, setFamilyUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updatesError, setUpdatesError] = useState(null);
  const [updatesPage, setUpdatesPage] = useState(1);
  const [updatesLimit, setUpdatesLimit] = useState(15);
  const [updatesTotal, setUpdatesTotal] = useState(null);

  // Member updates (paginated)
  const [memberUpdates, setMemberUpdates] = useState([]); // flattened
  const [memberUpdatesLoading, setMemberUpdatesLoading] = useState(false);
  const [memberUpdatesError, setMemberUpdatesError] = useState(null);
  const [memberUpdatesPage, setMemberUpdatesPage] = useState(1);
  const [memberUpdatesLimit, setMemberUpdatesLimit] = useState(15);
  const [memberUpdatesTotal, setMemberUpdatesTotal] = useState(null);

  // options for overview (fetched on mount) - used for family timeline
  const [optionsList, setOptionsList] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState(null);

  // member modal will fetch fresh options each time (per user's request)
  const [memberOptionsList, setMemberOptionsList] = useState([]);
  const [memberOptionsLoading, setMemberOptionsLoading] = useState(false);
  const [memberOptionsError, setMemberOptionsError] = useState(null);

  const [tab, setTab] = useState("overview");

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchUpdates, setSearchUpdates] = useState("");
  const [expandedUpdate, setExpandedUpdate] = useState(null);

  const [memberNameFilter, setMemberNameFilter] = useState("all");
  const [memberUpdatesSearch, setMemberUpdatesSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");

  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const [expandedStage, setExpandedStage] = useState(null);
  const stageRefs = useRef({});

  // safe fetch helper (returns { ok, status, json, text })
  async function safeFetch(url, opts = {}) {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers = { ...(opts.headers || {}) };
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
      if (!headers.Accept) headers.Accept = "application/json";
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(url, {
        credentials: "include",
        ...opts,
        headers,
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

  useEffect(() => {
    mountedRef.current = true;
    const ctrl = new AbortController();

    async function loadFamily() {
      setFamilyLoading(true);
      setFamilyError(null);
      try {
        const url = `${API_BASE}/families/${encodeURIComponent(familyId)}`;
        const { ok, status, json, text } = await safeFetch(url, { method: "GET", signal: ctrl.signal });

        if (!ok) {
          if (status === 401) throw new Error("Unauthorized — please login");
          const msg = (json && (json.message || json.error)) || text || `Failed to fetch family (${status})`;
          throw new Error(msg);
        }

        const doc = (json && (json.result ?? json)) ?? {};
        if (mountedRef.current) setFamily(doc);
      } catch (err) {
        if (err.name !== "AbortError" && mountedRef.current) setFamilyError(err.message || "Unable to load family");
      } finally {
        if (mountedRef.current) setFamilyLoading(false);
      }
    }

    // initial options fetch
    fetchOptionsList(false);

    // load family details
    loadFamily();

    // load updates (first page)
    loadFamilyUpdates(updatesPage, updatesLimit, ctrl.signal);
    loadMemberUpdates(memberUpdatesPage, memberUpdatesLimit, ctrl.signal);

    return () => {
      mountedRef.current = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  // fetch options
  async function fetchOptionsList(force = false) {
    if (!force && optionsList && optionsList.length) return optionsList;
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const url = `${API_BASE}/options`;
      const { ok, status, json, text } = await safeFetch(url, { method: "GET" });
      if (!ok) {
        const msg = (json && (json.message || json.error)) || text || `Failed to fetch options (${status})`;
        throw new Error(msg);
      }
      const items = json?.result?.items ?? json?.result ?? (Array.isArray(json) ? json : []);
      if (mountedRef.current) setOptionsList(items);
      return items;
    } catch (err) {
      console.error("options load error", err);
      if (mountedRef.current) setOptionsError(err.message || "Failed to load options");
      return [];
    } finally {
      if (mountedRef.current) setOptionsLoading(false);
    }
  }

  /* ------------------------------------------------------------------ */
  // ===== Pagination-enabled family updates fetch =====
  async function loadFamilyUpdates(requestPage = 1, requestLimit = 15, signal = undefined) {
    setUpdatesLoading(true);
    setUpdatesError(null);
    try {
      if (!familyId) {
        setFamilyUpdates([]);
        setUpdatesLoading(false);
        return;
      }

      // some backends expose: /updates/<villageId>/<familyId> — try both patterns
      const villageId = family?.villageId ?? (localStorage.getItem("villageId") || "");
      // prefer the canonical family endpoint if present
      const candidates = [
        `${API_BASE}/families/${encodeURIComponent(familyId)}/updates?page=${encodeURIComponent(requestPage)}&limit=${encodeURIComponent(requestLimit)}`,
        `${API_BASE}/updates/${encodeURIComponent(villageId)}/${encodeURIComponent(familyId)}?page=${encodeURIComponent(requestPage)}&limit=${encodeURIComponent(requestLimit)}`,
      ];

      let payload = null;
      let lastErr = null;

      for (const url of candidates) {
        const { ok, status, json, text } = await safeFetch(url, { method: "GET", signal });
        if (!ok) {
          lastErr = (json && (json.message || json.error)) || text || `Failed (${status})`;
          // if 404 on the first candidate try next (some deployments use the other path)
          if (status === 404) continue;
          // unauthorized: set message and abort
          if (status === 401) throw new Error("Unauthorized — please login");
          continue;
        }
        payload = json ?? {};
        break;
      }

      if (!payload) throw new Error(lastErr || "Failed to fetch updates");

      // support multiple shapes:
      // { result: { items:[...], count, page, limit } }
      // { count, items, page, limit }
      // items may be under payload.result.items or payload.items
      const resultRoot = payload.result ?? payload;
      const items = resultRoot?.items ?? (Array.isArray(resultRoot) ? resultRoot : []);
      const respPage = Number(resultRoot?.page ?? payload?.page ?? requestPage);
      const respLimit = Number(resultRoot?.limit ?? payload?.limit ?? requestLimit);
      const respCount = resultRoot?.count ?? payload?.count ?? null;

      // ensure array
      const list = Array.isArray(items) ? items : [];

      if (mountedRef.current) {
        setFamilyUpdates(list);
        setUpdatesPage(Number(respPage ?? requestPage));
        setUpdatesLimit(Number(respLimit ?? requestLimit));
        setUpdatesTotal(respCount !== null ? Number(respCount) : null);
      }
    } catch (err) {
      console.error("loadFamilyUpdates", err);
      if (mountedRef.current) setUpdatesError(err.message || "Failed to load updates");
      if (mountedRef.current) setFamilyUpdates([]);
    } finally {
      if (mountedRef.current) setUpdatesLoading(false);
    }
  }

  // member updates pagination (server-side if backend supports; otherwise we flatten and paginate client-side)
  async function loadMemberUpdates(requestPage = 1, requestLimit = 15, signal = undefined) {
    setMemberUpdatesLoading(true);
    setMemberUpdatesError(null);
    try {
      // Try family member updates endpoint first (same as family updates in many backends)
      const villageId = family?.villageId ?? (localStorage.getItem("villageId") || "");
      const candidates = [
        `${API_BASE}/families/${encodeURIComponent(familyId)}/member-updates?page=${encodeURIComponent(requestPage)}&limit=${encodeURIComponent(requestLimit)}`,
        `${API_BASE}/families/${encodeURIComponent(familyId)}/updates?page=${encodeURIComponent(requestPage)}&limit=${encodeURIComponent(requestLimit)}`, // as fallback many backends put both lists together
        `${API_BASE}/updates/${encodeURIComponent(villageId)}/${encodeURIComponent(familyId)}?page=${encodeURIComponent(requestPage)}&limit=${encodeURIComponent(requestLimit)}`,
      ];

      let payload = null;
      for (const url of candidates) {
        const { ok, status, json, text } = await safeFetch(url, { method: "GET", signal });
        if (!ok) {
          if (status === 404) continue;
          if (status === 401) throw new Error("Unauthorized — please login");
          continue;
        }
        payload = json ?? {};
        break;
      }

      if (!payload) {
        // fallback: if backend doesn't expose member updates separately, try to flatten members array from family data and paginate locally
        const memberUpdatesFlattened = [];
        if (Array.isArray(family?.members)) {
          family.members.forEach((m) => {
            const name = m.name ?? "—";
            if (Array.isArray(m.updates)) {
              m.updates.forEach((u) => memberUpdatesFlattened.push({ ...u, memberName: name }));
            }
          });
        }
        // client-side pagination
        const total = memberUpdatesFlattened.length;
        const start = (requestPage - 1) * requestLimit;
        const pageItems = memberUpdatesFlattened.slice(start, start + requestLimit);
        if (mountedRef.current) {
          setMemberUpdates(pageItems);
          setMemberUpdatesPage(requestPage);
          setMemberUpdatesLimit(requestLimit);
          setMemberUpdatesTotal(total);
        }
        return;
      }

      const resultRoot = payload.result ?? payload;
      // many backends return member updates nested differently; try to find arrays
      const items = resultRoot?.items ?? resultRoot?.memberUpdates ?? resultRoot?.updates ?? (Array.isArray(resultRoot) ? resultRoot : []);
      const respPage = Number(resultRoot?.page ?? payload?.page ?? requestPage);
      const respLimit = Number(resultRoot?.limit ?? payload?.limit ?? requestLimit);
      const respCount = resultRoot?.count ?? payload?.count ?? null;

      const list = Array.isArray(items) ? items : [];

      if (mountedRef.current) {
        setMemberUpdates(list);
        setMemberUpdatesPage(Number(respPage ?? requestPage));
        setMemberUpdatesLimit(Number(respLimit ?? requestLimit));
        setMemberUpdatesTotal(respCount !== null ? Number(respCount) : null);
      }
    } catch (err) {
      console.error("loadMemberUpdates", err);
      if (mountedRef.current) setMemberUpdatesError(err.message || "Failed to load member updates");
      if (mountedRef.current) setMemberUpdates([]);
    } finally {
      if (mountedRef.current) setMemberUpdatesLoading(false);
    }
  }

  // refresh updates when page changes
  useEffect(() => {
    const ctrl = new AbortController();
    loadFamilyUpdates(updatesPage, updatesLimit, ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatesPage, updatesLimit, familyId]);

  useEffect(() => {
    const ctrl = new AbortController();
    loadMemberUpdates(memberUpdatesPage, memberUpdatesLimit, ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberUpdatesPage, memberUpdatesLimit, familyId, family]);

  /* ------------------------------------------------------------------ */
  // helpers for options / timeline (unchanged from your original)
  function normalizeStages(possible) {
    if (!possible) return [];

    if (Array.isArray(possible)) {
      return possible
        .map((s, idx) => {
          if (s == null) return null;
          if (typeof s === "string") return { id: s, name: s, order: idx, deleted: false, description: null };

          const id = s.id ?? s.stageId ?? s.stage_id ?? s.key ?? `s-${idx}`;
          const name = s.name ?? s.label ?? s.title ?? s.currentStage ?? String(id);
          const order = s.order ?? s.position ?? s.index ?? idx;
          const deleted = !!s.deleted;
          const description = s.description ?? s.desc ?? s.note ?? null;
          return { id, name, order, deleted, description };
        })
        .filter(Boolean)
        .filter((x) => !x.deleted);
    }

    return Object.entries(possible)
      .map(([k, v], idx) => {
        if (v == null) return null;
        if (typeof v === "string") return { id: k, name: v, order: idx, deleted: false, description: null };
        const id = v.id ?? v.stageId ?? v.stage_id ?? k;
        const name = v.name ?? v.label ?? v.title ?? String(id);
        const order = v.order ?? v.position ?? v.index ?? idx;
        const deleted = !!v.deleted;
        const description = v.description ?? v.desc ?? v.note ?? null;
        return { id, name, order, deleted, description };
      })
      .filter(Boolean)
      .filter((x) => !x.deleted);
  }

  function findOptionInListForEntity(list, entity) {
    if (!Array.isArray(list) || !list.length || !entity) return null;

    const currentStageRaw = entity.currentStage ?? "";
    const currentStage = String(currentStageRaw).trim();

    if (currentStage) {
      const byOptionId = list.find((o) => {
        const optId = String(o.optionId ?? o.id ?? o._id ?? "");
        return optId.toLowerCase() === currentStage.toLowerCase();
      });
      if (byOptionId) return byOptionId;
    }

    const candidateKeys = [
      entity.relocationOption,
      entity.relocation_option,
      entity.optionId,
      entity.option?.id,
      entity.option_id,
      entity.optionCode,
      entity.code,
      entity.stageId,
      entity.stage_id,
    ]
      .filter(Boolean)
      .map((x) => String(x).trim());

    if (candidateKeys.length) {
      for (const k of candidateKeys) {
        const match = list.find((o) => {
          const candidateIds = [
            o.optionId ?? o.id ?? o._id ?? o.option_id ?? o.code ?? "",
            o.name ?? o.title ?? o.label ?? ""
          ].map((x) => (x == null ? "" : String(x)));
          if (candidateIds.includes(String(k))) return true;
          return false;
        });
        if (match) return match;
      }
    }

    if (currentStage) {
      for (const o of list) {
        const normalized = normalizeStages(o.stages ?? o.stageList ?? o.stage_map ?? o.stageListMap ?? o.stagesMap ?? o.stage_list ?? []);
        if (normalized.some((s) => String(s.id).toLowerCase() === currentStage.toLowerCase() || String(s.name).toLowerCase() === currentStage.toLowerCase())) {
          return o;
        }
      }
    }

    return null;
  }

  function normalizedCompletedSet(arr) {
    const set = new Set();
    if (!arr || !Array.isArray(arr)) return set;
    for (const itm of arr) {
      if (itm == null) continue;
      if (typeof itm === "string" || typeof itm === "number") {
        set.add(String(itm).toLowerCase());
        continue;
      }
      const id = itm.id ?? itm.stageId ?? itm.stage_id ?? itm.key ?? null;
      const name = itm.name ?? itm.label ?? itm.title ?? null;
      if (id) set.add(String(id).toLowerCase());
      if (name) set.add(String(name).toLowerCase());
      try { set.add(JSON.stringify(itm).toLowerCase()); } catch (e) { /* ignore */ }
    }
    return set;
  }

  // family timeline (uses global optionsList fetched on mount)
  const familyTimelineObj = useMemo(() => {
    const optionObj = findOptionInListForEntity(optionsList, family);
    const stages = optionObj ? normalizeStages(optionObj.stages ?? optionObj.stageList ?? optionObj.stage_list ?? []) : [];
    const completedArr = Array.isArray(family?.stagesCompleted) ? family.stagesCompleted : [];
    const completedSet = normalizedCompletedSet(completedArr);

    const timeline = stages.map((st, idx) => {
      const name = st.name ?? String(st.id ?? `Stage ${idx + 1}`);
      const idStr = String(st.id ?? "").toLowerCase();
      const nameStr = String(name ?? "").toLowerCase();
      const isCompleted = completedSet.has(idStr) || completedSet.has(nameStr) || completedSet.has(String(idx)) || completedSet.has(String(idx + 1));
      let completionDate = null;
      if (isCompleted && Array.isArray(family?.statusHistory)) {
        const history = [...family.statusHistory].reverse();
        for (const h of history) {
          if (
            String(h.stage ?? h.currentStage ?? "").toLowerCase() === idStr ||
            String(h.stage ?? h.currentStage ?? "").toLowerCase() === nameStr ||
            String(h.notes ?? h.comments ?? "").toLowerCase().includes(nameStr)
          ) {
            completionDate = h.date ?? h.time ?? h.at ?? null;
            break;
          }
        }
      }
      return { ...st, name, order: st.order ?? idx, isCompleted, completionDate };
    });

    timeline.sort((a, b) => {
      if (a.isCompleted === b.isCompleted) return (a.order ?? 0) - (b.order ?? 0);
      return a.isCompleted ? -1 : 1;
    });

    return { optionObj, timeline };
  }, [family, optionsList]);

  const familyPct = familyTimelineObj.timeline && familyTimelineObj.timeline.length
    ? Math.round((familyTimelineObj.timeline.filter((t) => t.isCompleted).length / familyTimelineObj.timeline.length) * 100)
    : 0;

  // ---------- Updates / members helpers (kept) ----------
  const familyUpdatesSorted = useMemo(() => {
    const arr = Array.isArray(familyUpdates) ? [...familyUpdates] : [];
    arr.sort((a, b) => {
      const ta = a.verifiedAt || (a.statusHistory && a.statusHistory.length ? a.statusHistory.slice(-1)[0]?.time : null) || "";
      const tb = b.verifiedAt || (b.statusHistory && b.statusHistory.length ? b.statusHistory.slice(-1)[0]?.time : null) || "";
      return String(tb).localeCompare(String(ta));
    });
    return arr;
  }, [familyUpdates]);

  const filteredFamilyUpdates = useMemo(() => {
    const q = (searchUpdates || "").trim().toLowerCase();
    return familyUpdatesSorted.filter((u) => {
      if (statusFilter !== "all" && String(u.status) !== String(statusFilter)) return false;
      if (!q) return true;
      const hay = `${u.name ?? ""} ${u.notes ?? ""} ${u.updateId ?? ""} ${u.insertedBy ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [familyUpdatesSorted, searchUpdates, statusFilter]);

  const allMemberUpdatesFlat = useMemo(() => {
    // Prefer server-provided memberUpdates when available (memberUpdates state)
    if (Array.isArray(memberUpdates) && memberUpdates.length) {
      // if items have memberName set, keep; else try to infer
      return memberUpdates.map((u) => ({ ...u }));
    }

    // otherwise flatten from family.members and updates state
    const arr = [];
    if (Array.isArray(family?.members)) {
      family.members.forEach((m) => {
        const name = m.name ?? "—";
        if (Array.isArray(m.updates)) {
          m.updates.forEach((u) => arr.push({ ...u, memberName: name }));
        }
      });
    }
    if (Array.isArray(memberUpdates) && memberUpdates.length) {
      memberUpdates.forEach((u) => arr.push({ ...u }));
    }
    arr.sort((a, b) => {
      const ta = a.verifiedAt || (a.statusHistory && a.statusHistory.length ? a.statusHistory.slice(-1)[0]?.time : "") || "";
      const tb = b.verifiedAt || (b.statusHistory && b.statusHistory.length ? b.statusHistory.slice(-1)[0]?.time : "") || "";
      return String(tb).localeCompare(String(ta));
    });
    return arr;
  }, [memberUpdates, family]);

  const memberNames = useMemo(() => {
    const names = new Set();
    if (Array.isArray(family?.members)) family.members.forEach((m) => m.name && names.add(m.name));
    if (Array.isArray(memberUpdates)) memberUpdates.forEach((m) => m.memberName && names.add(m.memberName));
    return Array.from(names);
  }, [family, memberUpdates]);

  const filteredMemberUpdates = useMemo(() => {
    const q = (memberUpdatesSearch || "").trim().toLowerCase();
    const arr = allMemberUpdatesFlat.filter((u) => {
      if (memberNameFilter && memberNameFilter !== "all" && String(u.memberName) !== String(memberNameFilter)) return false;
      if (memberStatusFilter !== "all" && String(u.status) !== String(memberStatusFilter)) return false;
      if (!q) return true;
      const hay = `${u.memberName ?? ""} ${u.name ?? ""} ${u.notes ?? ""} ${u.updateId ?? ""} ${u.insertedBy ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return arr;
  }, [allMemberUpdatesFlat, memberNameFilter, memberUpdatesSearch, memberStatusFilter]);

  /* UI small components (same as before) */
  function StatusBadge({ status }) {
    const s = {
      1: { label: "forest Guard", color: "bg-yellow-50 text-yellow-800", dot: "bg-yellow-400" },
      2: { label: "Range Assistant", color: "bg-blue-50 text-blue-800", dot: "bg-blue-500" },
      3: { label: "Range Officer", color: "bg-indigo-50 text-indigo-800", dot: "bg-indigo-600" },
      4: { label: "Assistant Director", color: "bg-green-50 text-green-800", dot: "bg-green-600" },
    }[status];
    if (!s) return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">Unknown</span>;
    return (
      <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full ${s.color} text-xs font-semibold`}>
        <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
      </span>
    );
  }

  function UpdateCard({ u, index }) {
    const isDeleted = !!u.deleted || !!u.delete;
    const docs = Array.isArray(u.docs) ? u.docs : [];
    const latestTime = u.verifiedAt || (u.statusHistory && u.statusHistory.length ? u.statusHistory.slice(-1)[0]?.time : null);
    const expanded = expandedUpdate === (u.updateId || `idx-${index}`);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        className={`bg-white rounded-2xl p-4 shadow-sm border ${isDeleted ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDeleted ? "bg-red-50 border-red-200" : "bg-white"}`}>
                <FileText size={18} className={isDeleted ? "text-red-500" : "text-indigo-600"} />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-800 truncate">{u.name || "Update"}</h3>
                <div className="text-xs text-gray-500">{u.updateId}</div>
                {isDeleted && <span className="ml-2 px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded">Deleted</span>}
              </div>

              <div className="mt-2 text-sm text-gray-700">
                {u.notes ? (
                  <>
                    <div className={`${expanded ? "" : "line-clamp-4"}`}>{u.notes}</div>
                    {u.notes.length > 220 && (
                      <button
                        onClick={() => setExpandedUpdate(expanded ? null : (u.updateId || `idx-${index}`))}
                        className="mt-2 text-xs text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        {expanded ? (
                          <>
                            Show less <ChevronUp size={14} />
                          </>
                        ) : (
                          <>
                            Show more <ChevronDown size={14} />
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-500 italic">No notes provided</div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={u.status} />
                <div className="text-xs text-gray-500">Stage: <span className="font-medium">{u.currentStage ?? "—"}</span></div>
                <div className="text-xs text-gray-500">By: <span className="font-medium">{u.insertedBy ?? "—"}</span></div>
                {u.memberName && u.memberName !== '-' && u.memberName !== '—' && (
                  <div className="text-xs text-gray-500">Member: <span className="font-medium">{u.memberName}</span></div>
                )}
              </div>

              {docs.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">Attachments</div>
                  <div className="flex gap-2 flex-wrap">
                    {docs.map((d, di) => (
                      <a
                        key={di}
                        href={d}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-2 py-1 border rounded-md text-xs hover:bg-gray-50"
                      >
                        <File size={14} /> <span className="truncate max-w-[12rem]">{typeof d === "string" ? d.split("/").slice(-1)[0] : (d.name ?? `file-${di}`)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(latestTime)}</div>
        </div>

        {/* status history timeline (expandable) */}
        <div className="mt-4">
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 list-none">
              <Clock size={14} /> View status history ({Array.isArray(u.statusHistory) ? u.statusHistory.length : 0})
              <span className="ml-2 text-xs text-gray-400 group-open:rotate-180 transition-transform"><ChevronDown size={14} /></span>
            </summary>

            <div className="mt-3 pl-3 border-l-2 border-gray-100">
              {Array.isArray(u.statusHistory) && u.statusHistory.length ? (
                <ol className="space-y-3 mt-3">
                  {u.statusHistory.map((sh, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                      </div>
                      <div className="flex-1 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-gray-800">{sh.comments || "—"}</div>
                          <div className="text-xs text-gray-400">{fmtDate(sh.time)}</div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">By: {sh.verifier ?? "—"} • Status: {sh.status ?? "—"}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="text-sm text-gray-500 mt-3">No status history</div>
              )}
            </div>
          </details>
        </div>
      </motion.div>
    );
  }

  // Plot click behaviour (Overview plot buttons navigate to plot page)
  function handlePlotClick(np) {
    try {
      const plotId = np?.plotId ?? np?.id ?? String(np);
      const vid = family?.villageId || "";
      if (!plotId) return;
      navigate(`/plots/${encodeURIComponent(vid)}/${encodeURIComponent(plotId)}`);
    } catch (e) {
      console.error("handlePlotClick error:", e);
    }
  }

  // Overview rendering
  function renderOverview() {
    if (familyLoading) return <div className="py-8 text-center">Loading family…</div>;
    if (familyError) return <div className="text-red-600">{familyError}</div>;
    if (!family) return <div className="text-gray-700">No family data found.</div>;

    const photos = Array.isArray(family.photos) ? family.photos : [];
    const plots = Array.isArray(family.plots) ? family.plots : [];
    const { optionObj, timeline } = familyTimelineObj;

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex gap-6 items-center">
            <img
              src={family.mukhiyaPhoto || "/images/default-avatar.png"}
              alt={family.mukhiyaName || "Mukhiya"}
              onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")}
              className="w-28 h-28 object-cover rounded-full border"
            />
            <div>
              <h2 className="text-2xl font-bold">{family.mukhiyaName || "—"}</h2>
              <p className="text-sm text-gray-600">Family ID: <span className="font-mono">{family.familyId}</span></p>
              <p className="text-sm text-gray-600">Village: {family.villageId || "—"}</p>
              <p className="text-sm text-gray-600">Relocation option: {family.relocationOption ?? "—"}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <h4 className="text-sm text-gray-500">Address</h4>
              <div className="text-base text-gray-800">{family.address || "—"}</div>
            </div>
            <div>
              <h4 className="text-sm text-gray-500">Contact</h4>
              <div className="text-base text-gray-800">{family.mobile || family.phone || "—"}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <h4 className="text-sm text-gray-500">Current Stage</h4>
              <div className="inline-block mt-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{family.currentStage || "INIT"}</div>
            </div>

            <div>
              <h4 className="text-sm text-gray-500">Mukhiya Age</h4>
              <div className="text-base text-gray-800">{family.mukhiyaAge ?? "—"}</div>
            </div>

            <div>
              <h4 className="text-sm text-gray-500">Mukhiya Health</h4>
              <div className="text-base text-gray-800">{family.mukhiyaHealth ?? "—"}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <h4 className="text-sm text-gray-500">Coordinates</h4>
              <div className="text-base text-gray-800">{family.lat ?? "—"} , {family.long ?? "—"}</div>
            </div>

            <div>
              <h4 className="text-sm text-gray-500">Plots</h4>
              {plots.length ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {plots.map((p, i) => {
                    const np = (typeof p === "string") ? { plotId: p, label: p.split("_").slice(-1)[0] } : { plotId: p.plotId ?? p.id, label: p.label ?? p.name ?? String(p.plotId ?? p.id) };
                    return (
                      <button
                        key={String(np.plotId) + i}
                        onClick={() => handlePlotClick(np)}
                        className="px-3 py-1 border rounded-md text-sm bg-gray-50 hover:bg-gray-100"
                        title={String(np.plotId)}
                      >
                        {np.label || `Plot ${i + 1}`}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No plots recorded.</div>
              )}
            </div>
          </div>
        </div>

        {/* family timeline (horizontal, options-driven) */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Family Timeline</h3>
              <div className="text-xs text-gray-500">Mapped from option: {optionObj ? (optionObj.name ?? optionObj.optionId ?? optionObj.id) : "No option mapping"}</div>
            </div>

            <div className="flex items-center gap-4">
              <ProgressBar pct={familyPct} />
              <div className="text-sm font-medium text-slate-700">{familyPct}%</div>
            </div>
          </div>

          {(!familyTimelineObj.timeline || !familyTimelineObj.timeline.length) ? (
            <div className="text-sm text-gray-600">No timeline available for family.</div>
          ) : (
            <div className="relative px-4 py-4">
              <div className="relative">
                <div className="absolute left-4 right-4 top-0 h-12 flex items-center pointer-events-none" aria-hidden="true">
                  <div className="w-full h-0.5 bg-slate-200 rounded relative">
                    <div
                      className="absolute left-0 top-1/2 transform -translate-y-1/2 h-0.5 rounded"
                      style={{ width: `${familyPct}%`, backgroundColor: "#1e40af", maxWidth: "100%" }}
                    />
                  </div>
                </div>

                <div className="flex items-start justify-between relative z-10">
                  {familyTimelineObj.timeline.map((t, i) => {
                    const stageKey = t.id ?? `s-${i}`;
                    const isCompleted = !!t.isCompleted;
                    const isSelected = String(expandedStage) === String(stageKey) || String(expandedStage) === String(t.name);

                    return (
                      <div key={String(stageKey)} className="flex flex-col items-center" style={{ width: `${100 / Math.max(1, familyTimelineObj.timeline.length)}%`, maxWidth: 180 }}>
                        <div className="h-12 flex items-center justify-center">
                          <button
                            onClick={() => setExpandedStage((prev) => (prev === stageKey ? null : stageKey))}
                            className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition
                              ${isCompleted ? "bg-blue-700 text-white border-blue-700" : isSelected ? "bg-white text-blue-700 border-2 border-blue-700" : "bg-white text-gray-400 border border-gray-300"}`}
                            aria-pressed={isSelected}
                            title={t.name}
                          >
                            {isCompleted ? "✓" : String(i + 1)}
                          </button>
                        </div>

                        <div className={`mt-2 text-center text-sm truncate ${isCompleted || isSelected ? "text-slate-800" : "text-gray-400"}`}>
                          {t.name}
                        </div>

                        {t.completionDate && <div className="text-xs text-slate-500 mt-1">{fmtDate(t.completionDate)}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* expanded details */}
              {expandedStage && (
                <div className="mt-6">
                  {(() => {
                    const t = familyTimelineObj.timeline.find((x) => String(x.id) === String(expandedStage) || String(x.name) === String(expandedStage));
                    if (!t) return <div className="text-sm text-gray-600">No details for this stage.</div>;
                    return (
                      <div ref={(el) => (stageRefs.current[t.id ?? t.name] = el)} className="bg-gray-50 border rounded p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-lg font-semibold">{t.name}</div>
                            <div className="text-sm text-gray-500">Order: {t.order ?? "—"}</div>
                            {t.completionDate && <div className="text-sm text-gray-500 mt-1">Completed: {fmtDate(t.completionDate)}</div>}
                          </div>
                          <div className="text-sm">
                            <div className="font-medium">{t.isCompleted ? "Completed" : "Pending"}</div>
                          </div>
                        </div>

                        {optionObj && (
                          <div className="mt-3 text-sm text-gray-700">
                            <div><strong>Option:</strong> {optionObj.name ?? optionObj.optionId ?? optionObj.id}</div>
                            <div className="mt-2">{t.description ?? ""}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Photos + status history */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="font-semibold mb-2">Photos (preview)</h3>
          {Array.isArray(family.photos) && family.photos.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {family.photos.slice(0, 8).map((p, i) => (
                <div key={i} className="rounded overflow-hidden border cursor-pointer" onClick={() => window.open(p, "_blank")}>
                  <img src={p} alt={`photo-${i}`} onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")} className="object-cover w-full h-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600">No photos available.</div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="font-semibold mb-2">Status History</h3>
          {Array.isArray(family.statusHistory) && family.statusHistory.length ? (
            <ol className="space-y-3">
              {family.statusHistory.map((s, i) => (
                <li key={i} className="border-l-2 pl-3">
                  <div className="text-sm font-medium">{s.status || "—"} <span className="text-xs text-gray-500 ml-2">{fmtDate(s.date ?? s.time)}</span></div>
                  {s.notes && <div className="text-sm text-gray-600">{s.notes}</div>}
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-sm text-gray-600">No status history available.</div>
          )}
        </div>
      </div>
    );
  }

  function renderMembers() {
    if (familyLoading) return <div className="py-8 text-center">Loading family members…</div>;
    if (familyError) return <div className="text-red-600">{familyError}</div>;
    const mems = Array.isArray(family?.members) ? family.members : [];
    if (!mems.length) return <div className="text-sm text-gray-600">No members recorded.</div>;

    async function openMemberModal(m) {
      setMemberOptionsList([]);
      setMemberOptionsError(null);
      setMemberOptionsLoading(true);
      try {
        await fetchOptionsForMember();
      } catch (e) {
        // handled inside fetch
      } finally {
        if (mountedRef.current) {
          setSelectedMember(m);
          setShowMemberModal(true);
        }
      }
    }

    function closeMemberModal() {
      setSelectedMember(null);
      setShowMemberModal(false);
      setMemberOptionsList([]);
      setMemberOptionsError(null);
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mems.map((m) => (
            <motion.div
              key={m._id ?? m.id ?? m.name}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 shadow cursor-pointer"
              onClick={() => openMemberModal(m)}
            >
              <div className="flex items-center gap-3">
                <img src={m.photo || "/images/default-avatar.png"} onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")} alt={m.name} className="w-14 h-14 rounded-full object-cover" />
                <div>
                  <div className="font-semibold">{m.name || "—"}</div>
                  <div className="text-sm text-gray-500">{m.gender || ""} • {m.age ?? "—"} yrs</div>
                  <div className="text-xs text-gray-500 mt-1">Stage: <span className="font-medium">{m.currentStage || "—"}</span></div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button onClick={(e) => { e.stopPropagation(); setMemberNameFilter(m.name); setTab("member-updates"); }} className="text-xs text-indigo-600 hover:underline">
                  View member updates
                </button>
                <div className="text-xs text-gray-500">Option: {m.relocationOption ?? "—"}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {showMemberModal && selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={closeMemberModal} />
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white rounded-2xl shadow-lg w-full max-w-3xl p-6 z-10 overflow-auto max-h-[90vh]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <img src={selectedMember.photo || "/images/default-avatar.png"} onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")} className="w-20 h-20 rounded-full object-cover" alt={selectedMember.name} />
                  <div>
                    <h3 className="text-xl font-semibold">{selectedMember.name || "—"}</h3>
                    <div className="text-sm text-gray-500">{selectedMember.gender || "—"} • {selectedMember.age ?? "—"} yrs</div>
                    <div className="text-sm text-gray-500">Health: {selectedMember.healthStatus ?? selectedMember.health ?? "—"}</div>
                    <div className="text-sm text-gray-500">Current stage: <span className="font-medium">{selectedMember.currentStage ?? "—"}</span></div>
                    <div className="text-sm text-gray-500">Relocation option: <span className="font-medium">{selectedMember.relocationOption ?? "—"}</span></div>
                  </div>
                </div>

                <div>
                  <button onClick={closeMemberModal} className="px-3 py-1 rounded bg-gray-100">Close</button>
                </div>
              </div>

              <MemberTimelineModalBody member={selectedMember} memberOptionsList={memberOptionsList} memberOptionsLoading={memberOptionsLoading} memberOptionsError={memberOptionsError} />
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  async function fetchOptionsForMember() {
    setMemberOptionsLoading(true);
    setMemberOptionsError(null);
    setMemberOptionsList([]);
    try {
      const items = await fetchOptionsList(true);
      if (mountedRef.current) setMemberOptionsList(items);
      return items;
    } catch (err) {
      if (mountedRef.current) setMemberOptionsError(err.message || "Failed to load member options");
      return [];
    } finally {
      if (mountedRef.current) setMemberOptionsLoading(false);
    }
  }

  function MemberTimelineModalBody({ member, memberOptionsList = [], memberOptionsLoading = false, memberOptionsError = null }) {
    const [expandedMemberStage, setExpandedMemberStage] = useState(null);

    const { optionObj, stages } = useMemo(() => {
      const listToUse = (Array.isArray(memberOptionsList) && memberOptionsList.length) ? memberOptionsList : optionsList;
      const opt = findOptionInListForEntity(listToUse, member) || findOptionInListForEntity(optionsList, member) || findOptionInListForEntity(listToUse, family) || null;
      const stagesArr = opt ? normalizeStages(opt.stages ?? opt.stageList ?? opt.stage_list ?? []) : [];
      return { optionObj: opt, stages: stagesArr };
    }, [member, memberOptionsList, optionsList, family]);

    const memberCompletedArr = Array.isArray(member?.stagesCompleted) ? member.stagesCompleted : [];
    const completedSet = normalizedCompletedSet(memberCompletedArr);

    function memberCompletionDateForStage(stage) {
      if (!member) return null;
      const history = Array.isArray(member.statusHistory) ? [...member.statusHistory].reverse() : [];
      for (const h of history) {
        if (
          String(h.stage ?? h.currentStage ?? "").toLowerCase() === String(stage.id ?? stage.name ?? "").toLowerCase() ||
          String(h.notes ?? h.comments ?? "").toLowerCase().includes(String(stage.name ?? stage.id ?? "").toLowerCase())
        ) {
          return h.date ?? h.time ?? h.at ?? null;
        }
      }
      return null;
    }

    const memberTimeline = useMemo(() => {
      const t = [];
      if (stages && stages.length) {
        for (let idx = 0; idx < stages.length; idx++) {
          const st = stages[idx];
          const name = st.name ?? st.id ?? `Stage ${idx + 1}`;
          const idStr = String(st.id ?? "").toLowerCase();
          const nameStr = String(name ?? "").toLowerCase();
          const isCompleted = completedSet.has(idStr) || completedSet.has(nameStr) || completedSet.has(String(idx)) || completedSet.has(String(idx + 1));
          const completionDate = isCompleted ? memberCompletionDateForStage(st) : null;
          t.push({ ...st, name, order: st.order ?? idx, isCompleted, completionDate });
        }
      } else if (memberCompletedArr && memberCompletedArr.length) {
        for (let i = 0; i < memberCompletedArr.length; i++) {
          t.push({ id: memberCompletedArr[i], name: String(memberCompletedArr[i]), order: i, isCompleted: true, completionDate: null });
        }
      }

      t.sort((a, b) => {
        if (a.isCompleted === b.isCompleted) return (a.order ?? 0) - (b.order ?? 0);
        return a.isCompleted ? -1 : 1;
      });
      return t;
    }, [stages, memberCompletedArr]); // completedSet derived from memberCompletedArr

    const memberCompletedCount = memberTimeline.filter((x) => x.isCompleted).length;
    const memberPct = memberTimeline.length ? Math.round((memberCompletedCount / memberTimeline.length) * 100) : 0;

    return (
      <div className="mt-4">
        <h4 className="text-sm font-semibold mb-2">Member Timeline</h4>

        {memberOptionsLoading && <div className="text-sm text-gray-500 mb-2">Loading fresh option mapping for member…</div>}
        {memberOptionsError && <div className="text-sm text-red-600 mb-2">{memberOptionsError}</div>}

        {memberTimeline.length === 0 ? (
          <div className="text-sm text-gray-500 mb-4">No timeline available for this member (no option mapping or stages).</div>
        ) : (
          <div className="bg-white border rounded p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-700">Mapped from option: {optionObj ? (optionObj.name ?? optionObj.optionId ?? optionObj.id) : "—"}</div>
              <div className="flex items-center gap-4">
                <ProgressBar pct={memberPct} />
                <div className="text-sm font-medium">{memberPct}%</div>
              </div>
            </div>

            <div className="relative px-2 py-2">
              <div className="absolute left-4 right-4 top-0 h-12 flex items-center pointer-events-none" aria-hidden="true">
                <div className="w-full h-0.5 bg-slate-200 rounded relative">
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 h-0.5 rounded" style={{ width: `${memberPct}%`, backgroundColor: "#1e40af", maxWidth: "100%" }} />
                </div>
              </div>

              <div className="flex items-start justify-between relative z-10">
                {memberTimeline.map((t, i) => {
                  const stageKey = t.id ?? `s-${i}`;
                  const isCompleted = !!t.isCompleted;
                  const isSelected = String(expandedMemberStage) === String(stageKey) || String(expandedMemberStage) === String(t.name);
                  return (
                    <div key={stageKey} className="flex flex-col items-center" style={{ width: `${100 / Math.max(1, memberTimeline.length)}%`, maxWidth: 160 }}>
                      <div className="h-12 flex items-center justify-center">
                        <button
                          onClick={() => setExpandedMemberStage((prev) => (prev === stageKey ? null : stageKey))}
                          className={`relative z-20 flex items-center justify-center w-12 h-12 rounded-full focus:outline-none transition
                              ${isCompleted ? "bg-blue-700 text-white border-blue-700" : isSelected ? "bg-white text-blue-700 border-2 border-blue-700" : "bg-white text-gray-400 border border-gray-300"}`}
                          aria-pressed={isSelected}
                          title={t.name}
                        >
                          {isCompleted ? "✓" : String(i + 1)}
                        </button>
                      </div>

                      <div className={`mt-2 text-center text-sm truncate ${isCompleted || isSelected ? "text-slate-800" : "text-gray-400"}`}>
                          {t.name}
                        </div>
                      {t.completionDate && <div className="text-xs text-slate-500 mt-1">{fmtDate(t.completionDate)}</div>}
                    </div>
                  );
                })}
              </div>

              {expandedMemberStage && (
                <div className="mt-6">
                  {(() => {
                    const t = memberTimeline.find((x) => String(x.id) === String(expandedMemberStage) || String(x.name) === String(expandedMemberStage));
                    if (!t) return <div className="text-sm text-gray-600">No details for this stage.</div>;
                    return (
                      <div className="bg-gray-50 border rounded p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-lg font-semibold">{t.name}</div>
                            {t.completionDate && <div className="text-sm text-gray-500 mt-1">Completed: {fmtDate(t.completionDate)}</div>}
                          </div>
                          <div className="text-sm">
                            <div className="font-medium">{t.isCompleted ? "Completed" : "Pending"}</div>
                          </div>
                        </div>

                        {optionObj && (
                          <div className="mt-3 text-sm text-gray-700">
                            <div><strong>Option:</strong> {optionObj.name ?? optionObj.optionId ?? optionObj.id}</div>
                            <div className="mt-2">{t.description ?? ""}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderUpdates() {
    if (updatesLoading) return <div className="py-8 text-center">Loading updates…</div>;
    if (updatesError) return <div className="text-red-600">{updatesError}</div>;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-gray-50">
                <Search size={16} />
                <input
                  value={searchUpdates}
                  onChange={(e) => setSearchUpdates(e.target.value)}
                  placeholder="Search updates (name, notes, updateId, insertedBy)"
                  className="bg-transparent text-sm outline-none min-w-[220px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Status</div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="all">All</option>
                  <option value="1">Forest Guard</option>
                  <option value="2">Range Assistant</option>
                  <option value="3">Range Officer</option>
                  <option value="4">Assistant Director</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 mr-2">Total</div>
              <div className="px-2 py-1 rounded-md bg-gray-100 text-sm font-medium">{updatesTotal ?? (Array.isArray(familyUpdates) ? familyUpdates.length : 0)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredFamilyUpdates.length === 0 ? (
            <div className="text-sm text-gray-600 bg-white rounded-2xl p-6 shadow">No updates match your filters.</div>
          ) : (
            <AnimatePresence>
              {filteredFamilyUpdates.map((u, idx) => <UpdateCard key={u.updateId ?? idx} u={u} index={idx} />)}
            </AnimatePresence>
          )}
        </div>

        {/* pagination controls for updates */}
        <div className="bg-white rounded-2xl p-4 shadow flex items-center justify-between">
          <div className="text-sm text-gray-500">Showing page {updatesPage}</div>
          <PaginationControls
            page={updatesPage}
            totalCount={updatesTotal}
            pageSize={updatesLimit}
            onPage={(p) => setUpdatesPage(p)}
          />
        </div>
      </div>
    );
  }

  function renderMemberUpdates() {
    if (memberUpdatesLoading) return <div className="py-8 text-center">Loading member updates…</div>;
    if (memberUpdatesError) return <div className="text-red-600">{memberUpdatesError}</div>;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 min-w-[200px] border rounded-xl px-3 py-2 bg-gray-50">
                <Search size={16} />
                <input
                  value={memberUpdatesSearch}
                  onChange={(e) => setMemberUpdatesSearch(e.target.value)}
                  placeholder="Search member updates (member, name, notes, updateId)"
                  className="bg-transparent text-sm outline-none min-w-[220px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Member</div>
                <select
                  value={memberNameFilter}
                  onChange={(e) => setMemberNameFilter(e.target.value)}
                  className="text-sm border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="all">All members</option>
                  {memberNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">Status</div>
                <select value={memberStatusFilter} onChange={(e) => setMemberStatusFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-2 bg-white">
                  <option value="all">All</option>
                  <option value="1">Forest Guard</option>
                  <option value="2">Range Assistant</option>
                  <option value="3">Range Officer</option>
                  <option value="4">Assistant Director</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-2 py-1 rounded-md bg-gray-100 text-sm font-medium min-w text-center">{filteredMemberUpdates.length}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredMemberUpdates.length === 0 ? (
            <div className="text-sm text-gray-600 bg-white rounded-2xl p-6 shadow">No member updates match your filters.</div>
          ) : (
            <AnimatePresence>
              {filteredMemberUpdates.map((u, idx) => <UpdateCard key={u.updateId ?? idx} u={u} index={idx} />)}
            </AnimatePresence>
          )}
        </div>

        {/* pagination controls for member updates */}
        <div className="bg-white rounded-2xl p-4 shadow flex items-center justify-between">
          <div className="text-sm text-gray-500">Showing page {memberUpdatesPage}</div>
          <PaginationControls
            page={memberUpdatesPage}
            totalCount={memberUpdatesTotal}
            pageSize={memberUpdatesLimit}
            onPage={(p) => setMemberUpdatesPage(p)}
          />
        </div>
      </div>
    );
  }

  function renderDocs() {
    if (familyLoading) return <div className="py-8 text-center">Loading…</div>;
    const photos = Array.isArray(family?.photos) ? family.photos : [];
    const docs = Array.isArray(family?.docs) ? family.docs : [];

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Photos</h4>
            <div className="text-sm text-gray-500">{photos.length} found</div>
          </div>

          {photos.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
              {photos.map((p, i) => (
                <div key={i} className="rounded overflow-hidden border">
                  <img src={p} alt={`photo-${i}`} onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")} className="object-cover w-full h-40" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600 mt-3">No photos available.</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Documents</h4>
            <div className="text-sm text-gray-500">{docs.length} found</div>
          </div>

          {docs.length ? (
            <ul className="mt-3 space-y-2">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center gap-3">
                  <a className="text-sm text-indigo-600 underline" href={d} target="_blank" rel="noreferrer">Document {i + 1}</a>
                  <a href={d} download className="text-sm text-gray-500">(download)</a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-600 mt-3">No documents available.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f0dc] font-sans">
      <MainNavbar village={family?.villageId} showInNavbar={true} />

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50">
              <ArrowLeft size={16} /> Back
            </button>
            <div>
              <h1 className="text-2xl font-bold">Family Details</h1>
              <div className="text-sm text-gray-600">{family?.mukhiyaName ?? "—"} • <span className="font-mono">{familyId}</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">Last synced: <span className="font-mono">{family?.lastSync ? fmtDate(family.lastSync) : "—"}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <aside className="col-span-1">
            <div className="bg-white rounded-2xl p-4 shadow">
              <div className="flex items-center gap-3">
                <img src={family?.mukhiyaPhoto || "/images/default-avatar.png"} onError={(e) => (e.currentTarget.src = "/images/default-avatar.png")} className="w-20 h-20 rounded-full object-cover" alt="mukhiya" />
                <div>
                  <div className="font-semibold">{family?.mukhiyaName ?? "—"}</div>
                  <div className="text-xs text-gray-500">Family ID: <span className="font-mono">{family?.familyId}</span></div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div>Village: {family?.villageId ?? "—"}</div>
                <div>Option: {family?.relocationOption ?? "—"}</div>
                <div>Members: {Array.isArray(family?.members) ? family.members.length : 0}</div>
                <div>Stage: {family?.currentStage ?? "—"}</div>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => setTab("overview")} className={`flex-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${tab === "overview" ? "bg-green-50" : "bg-white"}`}><Users size={16} /> Overview</button>
                <button onClick={() => setTab("members")} className={`flex-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${tab === "members" ? "bg-green-50" : "bg-white"}`}><Image size={16} /> Members</button>
              </div>
            </div>

            <div className="mt-4 bg-white rounded-2xl p-4 shadow">
              <h4 className="font-semibold mb-2">Quick actions</h4>
              <div className="flex flex-col gap-2">
                <button onClick={() => setTab("updates")} className="w-full text-left px-3 py-2 rounded-lg border hover:bg-gray-50 inline-flex items-center gap-2"><FileText size={16} /> View updates</button>
                <button onClick={() => setTab("member-updates")} className="w-full text-left px-3 py-2 rounded-lg border hover:bg-gray-50 inline-flex items-center gap-2"><FileText size={16} /> View member updates</button>
                <button onClick={() => setTab("docs")} className="w-full text-left px-3 py-2 rounded-lg border hover:bg-gray-50 inline-flex items-center gap-2"><Image size={16} /> Photos & docs</button>
                <button onClick={() => window.print()} className="w-full text-left px-3 py-2 rounded-lg border hover:bg-gray-50 inline-flex items-center gap-2"><Clock size={16} /> Print</button>
              </div>
            </div>
          </aside>

          <section className="col-span-1 lg:col-span-2">
            <div className="bg-transparent">
              <div className="flex gap-3 items-center mb-4">
                <TabButton title="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
                <TabButton title={`Members (${Array.isArray(family?.members) ? family.members.length : 0})`} active={tab === "members"} onClick={() => setTab("members")} />
                <TabButton title={`Updates`} active={tab === "updates"} onClick={() => setTab("updates")} />
                <TabButton title={`Member Updates`} active={tab === "member-updates"} onClick={() => setTab("member-updates")} />
                <TabButton title={`Photos & Docs`} active={tab === "docs"} onClick={() => setTab("docs")} />
              </div>

              <motion.div layout className="min-h-[220px]">
                {tab === "overview" && renderOverview()}
                {tab === "members" && renderMembers()}
                {tab === "updates" && renderUpdates()}
                {tab === "member-updates" && renderMemberUpdates()}
                {tab === "docs" && renderDocs()}
              </motion.div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* TabButton component */
function TabButton({ title, active = false, onClick = () => {} }) {
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-lg ${active ? "bg-white shadow" : "bg-transparent hover:bg-white"}`}>
      <span className={`text-sm ${active ? "font-semibold" : "text-gray-600"}`}>{title}</span>
    </button>
  );
}
