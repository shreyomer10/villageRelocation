import React, { useEffect, useRef, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext"; // adjust path to where your provider lives

export default function MainNavbar({
  logoUrl = "/images/logo.png",
  brandDevanagari = "माटी",
  brandLatin = "MAATI",
  durationSeconds = 900, // token lifetime (default 15 min)
  onRefreshToken,
  onLogout,
  name = "",
  village = "",
  showWelcome = false,
  showInNavbar = false,
  showVillageInNavbar = false,
  rightContent = null,
  refreshBeforeSeconds = 60,
}) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  // Context values
  const ctxUser = auth?.user ?? null;
  // Prefer explicit villageName; fallback to common fields or ID
  const ctxVillage =
    auth?.villageName ??
    auth?.village?.villageName ??
    auth?.village?.name ??
    auth?.village?.village_name ??
    auth?.village?.title ??
    auth?.villageId ??
    null;

  const ctxRemaining = typeof auth?.tokenRemaining === "number" ? auth.tokenRemaining : null;
  const ctxExpiresAt = auth?.tokenExpiresAt ?? null;
  const ctxForceRefresh = auth?.forceRefresh ?? null;
  const ctxLogout = auth?.logout ?? null;

  // Local state
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState(null); // null | 'refresh' | 'logout'
  const [remaining, setRemaining] = useState(null);
  const [progressFilled, setProgressFilled] = useState(false);
  const [toast, setToast] = useState({ visible: false, text: "", important: false });

  // Refs
  const ctxRemainingRef = useRef(ctxRemaining);
  const ctxExpiresAtRef = useRef(ctxExpiresAt);
  const ctxUserRef = useRef(ctxUser);
  const autoRefreshTriggeredRef = useRef(false);
  const calledRefreshRef = useRef(false);
  const lastShownMinuteRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    ctxRemainingRef.current = ctxRemaining;
  }, [ctxRemaining]);
  useEffect(() => {
    ctxExpiresAtRef.current = ctxExpiresAt;
  }, [ctxExpiresAt]);
  useEffect(() => {
    ctxUserRef.current = ctxUser;
  }, [ctxUser]);

  // Force refresh if no token info but logged in
  useEffect(() => {
    if (!ctxUserRef.current) return;
    if (!ctxRemainingRef.current && !ctxExpiresAtRef.current && !calledRefreshRef.current) {
      calledRefreshRef.current = true;
      ctxForceRefresh?.().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxForceRefresh]);

  // Timer interval to update remaining time
  useEffect(() => {
    const computeRemaining = () => {
      if (ctxExpiresAtRef.current) {
        const ms = ctxExpiresAtRef.current - Date.now();
        return Math.max(0, Math.ceil(ms / 1000));
      }
      if (typeof ctxRemainingRef.current === "number") return Math.max(0, Math.ceil(ctxRemainingRef.current));
      return null;
    };

    setRemaining(computeRemaining());
    const iv = setInterval(() => {
      const val = computeRemaining();
      setRemaining(val !== null ? val : (prev) => (typeof prev === "number" && prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (remaining !== null && !progressFilled) {
      const t = setTimeout(() => setProgressFilled(true), 100);
      return () => clearTimeout(t);
    }
    // nothing to clean up otherwise
  }, [remaining, progressFilled]);

  // Minute-based toast notifications
  useEffect(() => {
    let minutes = null;
    if (ctxExpiresAtRef.current) {
      const ms = ctxExpiresAtRef.current - Date.now();
      minutes = ms <= 0 ? 0 : Math.ceil(ms / 60000);
    } else if (typeof remaining === "number") {
      minutes = Math.ceil(remaining / 60);
    }

    if (minutes === null) return;

    if (typeof remaining === "number" && remaining > durationSeconds - 5) {
      lastShownMinuteRef.current = null;
    }

    if (minutes !== lastShownMinuteRef.current) {
      lastShownMinuteRef.current = minutes;
      if (minutes <= 0) showToast("Session expired", true);
      else if (minutes <= 3) showToast(`${minutes} min left — refresh token recommended`, true);
      else showToast(`${minutes} min left`, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, ctxExpiresAt]);

  function showToast(text, important = false) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ visible: true, text, important });
    toastTimerRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4500);
  }

  // Clear toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  // Auto-refresh trigger
  useEffect(() => {
    const cur = typeof ctxRemaining === "number" ? ctxRemaining : remaining;
    if (cur == null || cur > refreshBeforeSeconds + 5) autoRefreshTriggeredRef.current = false;

    if (cur !== null && cur <= refreshBeforeSeconds && cur > 0 && !autoRefreshTriggeredRef.current) {
      autoRefreshTriggeredRef.current = true;
      // prefer the prop callback if provided
      (onRefreshToken?.() ?? ctxForceRefresh?.())?.catch?.(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxRemaining, ctxExpiresAt, remaining, refreshBeforeSeconds, onRefreshToken, ctxForceRefresh]);

  const formatTime = (sec) => {
    if (sec == null) return "--:--";
    if (sec <= 0) return "Session expired";
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) return `${hrs} hr ${mins} min ${s} sec`;
    if (mins > 0) return `${mins} min ${s} sec`;
    return `${s} sec`;
  };

  const displayRemaining = typeof remaining === "number" ? remaining : null;
  const getProgressColor = () => {
    if (displayRemaining === null) return "#10b981";
    if (displayRemaining <= 180) return "#ef4444";
    if (displayRemaining <= 300) {
      const progress = (300 - displayRemaining) / 120;
      const green = Math.round(16 + (239 - 16) * progress);
      const red = Math.round(185 - 185 * progress);
      const blue = Math.round(129 - 61 * progress);
      return `rgb(${green}, ${red}, ${blue})`;
    }
    return "#10b981";
  };

  const displayName = ctxUser?.name ?? name;
  const displayRole = ctxUser?.role ?? null;
  const displayVillage = ctxVillage ?? village;

  const openConfirm = (mode) => {
    setMenuMode(mode);
    setMenuOpen(true);
  };

  const performRefresh = async () => {
    setMenuOpen(false);
    setMenuMode(null);
    autoRefreshTriggeredRef.current = true;
    try {
      await (onRefreshToken?.() ?? ctxForceRefresh?.());
    } catch {}
  };

  const performLogout = () => {
    setMenuOpen(false);
    setMenuMode(null);
    try {
      if (onLogout) return onLogout();
      if (ctxLogout) return ctxLogout();
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = "/login";
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    if (menuOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const centerContent = (() => {
    if (showInNavbar && displayVillage) {
      return (
        <h1 className="text-2xl font-bold text-black text-center whitespace-nowrap">
          {displayVillage} <span className="text-2xl font-bold text-black">Beneficiaries -</span>{" "}
          <span className="text-green-800 font-semibold">Family List</span>
        </h1>
      );
    }
    if (showVillageInNavbar && displayVillage) {
      return <div className="text-2xl font-bold text-green-800 text-center whitespace-nowrap">{displayVillage}</div>;
    }
    return null;
  })();

  return (
    <header className="w-full select-none">
      {/* Navbar top section */}
      <div className="bg-[#a7dec0]">
        <div className="max-w-8xl mx-auto px-4">
          <div className="relative flex items-center justify-between py-2 min-h-[64px]">
            <div className="flex items-center gap-3">
              <img
                onClick={() => navigate("/dashboard")}
                src={logoUrl}
                alt="logo"
                className="w-18 h-14 object-contain cursor-pointer"
                role="button"
              />
              <div className="text-left">
                <div className="text-[#4a3529] font-bold text-xl leading-none">{brandDevanagari}</div>
                <div className="text-xs text-[#4a3529] tracking-wider">{brandLatin}</div>
              </div>

            </div>
            {showWelcome && displayName && (
              <div className="text-lg font-semibold text-right text-black leading-tight">
                Welcome {displayName} {displayRole ? `(${displayRole})` : ""}
              </div>
            )}
            {centerContent && (
              <div
                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                style={{ width: "72%", maxWidth: 900 }}
              >
                <div className="mx-auto text-center truncate">{centerContent}</div>
              </div>
            )}
            <div className="flex items-center justify-end gap-4">

              {rightContent && <div className="mr-2">{rightContent}</div>}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="focus:outline-none p-1 rounded-full hover:bg-white/30 transition"
                title="Account Menu"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
              >
                <div className="w-8 h-8 rounded-full bg-white/90 border border-[#4a3529] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4a3529]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-transparent border-t">
        <div className="flex items-center justify-between py-1">
          <div className="flex w-full items-center truncate">
            <div className="relative w-full h-6 overflow-hidden border bg-gray-100">
              <div
                className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out ${progressFilled ? "w-full" : "w-0"}`}
                style={{ backgroundColor: getProgressColor(), zIndex: 1 }}
              />
              <div className="relative z-10 h-full overflow-hidden">
                <div
                  className={`text-scroll whitespace-nowrap font-semibold text-white px-3 ${progressFilled ? "animate-scroll" : "opacity-0"}`}
                >
                  Login expires in: {formatTime(displayRemaining)} • Session Status: Active •
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll animation */}
      <style>{`
        .text-scroll { transform: translateX(100%); }
        .animate-scroll { animation: scroll-left-to-right 15s linear infinite; }
        @keyframes scroll-left-to-right { from { transform: translateX(100%);} to { transform: translateX(-100%);} }
        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>

      {/* Toast */}
      <div className="fixed top-4 right-4 z-60">
        {toast.visible && (
          <div
            className={`max-w-xs shadow-lg rounded-2xl p-3 border ${
              toast.important ? "bg-red-50 border-red-200" : "bg-white border-gray-100"
            }`}
            role="status"
            aria-live={toast.important ? "assertive" : "polite"}
          >
            <div className="flex items-start gap-3">
              <div className="text-sm leading-tight break-words">{toast.text}</div>
              {toast.important && (
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => openConfirm("refresh")}
                    className="text-xs px-3 py-1 rounded bg-red-600 text-white shadow-sm"
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Overlay */}
      <div
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 transition-opacity ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      >
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Sidebar Menu */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Account Menu"
        className={`fixed top-0 right-0 z-50 h-full w-80 max-w-full transform transition-transform duration-300 ease-in-out bg-white shadow-2xl ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="text-sm font-medium">
            {menuMode === "refresh" ? "Token Refresh" : menuMode === "logout" ? "Sign Out" : "Account Menu"}
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 rounded hover:bg-gray-100 focus:outline-none"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-auto h-full pb-20">
          {menuMode === "refresh" ? (
            <>
              <div className="text-lg font-medium mb-4">Do you want to refresh your session token now?</div>
              <div className="space-y-2">
                <button onClick={performRefresh} className="w-full text-left px-3 py-2 rounded bg-green-600 text-white">
                  Confirm Refresh
                </button>
                <button
                  onClick={() => setMenuMode(null)}
                  className="w-full text-left px-3 py-2 rounded border"
                >
                  Back
                </button>
              </div>
              <div className="mt-6 text-xs text-gray-400">
                Auto-refresh will also occur automatically when token gets near expiry.
              </div>
            </>
          ) : menuMode === "logout" ? (
            <>
              <div className="text-lg font-medium mb-4">Are you sure you want to sign out?</div>
              <div className="space-y-2">
                <button onClick={performLogout} className="w-full text-left px-3 py-2 rounded bg-red-600 text-white">
                  Confirm Logout
                </button>
                <button
                  onClick={() => setMenuMode(null)}
                  className="w-full text-left px-3 py-2 rounded border"
                >
                  Back
                </button>
              </div>
              <div className="mt-6 text-xs text-gray-400">
                You will be redirected to the login page after logout.
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-sm text-gray-500 mb-4">Account Actions</div>
                
                <button
                  onClick={() => setMenuMode("refresh")}
                  className="w-full text-left px-3 py-2 rounded border hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M3 21v-5h5"/>
                  </svg>
                  Refresh Token
                </button>
                <button
                  onClick={() => setMenuMode("logout")}
                  className="w-full text-left px-3 py-2 rounded border hover:bg-gray-50 flex items-center gap-2 text-red-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M16 17l5-5-5-5M21 12H9"/>
                    <path d="M12 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7"/>
                  </svg>
                  Logout
                </button>
              </div>
              <div className="mt-8 text-xs text-gray-400">Version 1.0.0</div>
            </>
          )}
        </div>
      </aside>
    </header>
  );
}
