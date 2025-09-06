// src/components/MainNavbar.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext"; // adjust path to where your provider lives

export default function MainNavbar({
  logoUrl = "/images/logo.png",
  brandDevanagari = "माटी",
  brandLatin = "MAATI",
  // legacy prop fallback: you can still pass this (e.g. 36) but when using AuthContext
  // the component will prefer tokenRemaining from context for the timer.
  durationSeconds = 36,
  onRefreshToken, // optional callback from parent
  onLogout, // optional callback from parent
  name = "",
  village = "",
  showWelcome = false,
  showInNavbar = false,
  showVillageInNavbar = false,
  rightContent = null,
  refreshBeforeSeconds = 60, // when to auto-call onRefreshToken (if provided)
}) {
  // try to use AuthContext if present — allows automatic timer & actions
  const auth = useContext(AuthContext);

  // If auth exists, prefer its values; otherwise use props
  const ctxUser = auth?.user ?? null;
  const ctxVillage = auth?.villageId ?? null;
  const ctxRemaining = typeof auth?.tokenRemaining === "number" ? auth.tokenRemaining : null;
  const ctxForceRefresh = auth?.forceRefresh ?? null;
  const ctxLogout = auth?.logout ?? null;

  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [remaining, setRemaining] = useState(durationSeconds);
  const menuRef = useRef(null);
  const adminButtonRef = useRef(null);

  // track if we've already auto-triggered onRefreshToken for the current token cycle
  const autoRefreshTriggeredRef = useRef(false);

  // Initialize remaining from context if available, else from prop
  useEffect(() => {
    if (ctxRemaining !== null) {
      setRemaining(ctxRemaining);
    } else {
      setRemaining(durationSeconds);
    }
  }, [ctxRemaining, durationSeconds]);

  // If there's no context-provided tick, maintain a fallback local tick only
  useEffect(() => {
    // if context drives remaining, we do not run the local interval
    if (ctxRemaining !== null) return;

    const t = setInterval(() => {
      setRemaining((r) => (r <= 0 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [ctxRemaining]);

  // listen for clicks outside menu to close it
  useEffect(() => {
    function handleClick(e) {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        adminButtonRef.current &&
        !adminButtonRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // auto-refresh hook: when remaining drops below threshold, call onRefreshToken once.
  useEffect(() => {
    // reset trigger whenever remaining jumps back up (new login/new token)
    if (ctxRemaining !== null) {
      if (ctxRemaining > refreshBeforeSeconds + 5) {
        // assume a new token started or refreshed
        autoRefreshTriggeredRef.current = false;
      }
    } else {
      // if using fallback prop timer, reset trigger when it resets to full duration
      if (remaining >= durationSeconds - 1) autoRefreshTriggeredRef.current = false;
    }

    const currentRemaining = ctxRemaining !== null ? ctxRemaining : remaining;

    if (
      currentRemaining !== null &&
      currentRemaining <= refreshBeforeSeconds &&
      currentRemaining > 0 &&
      !autoRefreshTriggeredRef.current
    ) {
      // call provided callback first (preserve existing prop behavior)
      if (typeof onRefreshToken === "function") {
        try {
          onRefreshToken();
        } catch (err) {
          // swallow errors from parent callback
          // optionally you can console.error(err);
        }
        autoRefreshTriggeredRef.current = true;
      } else if (ctxForceRefresh) {
        // else if auth context exposes forceRefresh, call that
        ctxForceRefresh().catch(() => {
          // ignore - the provider will handle failed refresh and logout
        });
        autoRefreshTriggeredRef.current = true;
      }
    }
  }, [ctxRemaining, remaining, refreshBeforeSeconds, durationSeconds, onRefreshToken, ctxForceRefresh]);

  // format time helper
  function formatTime(sec) {
    if (sec == null) return "--:--";
    if (sec <= 0) return "Session expired";
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) return `${hrs} hr ${mins} min ${s} sec`;
    if (mins > 0) return `${mins} min ${s} sec`;
    return `${s} sec`;
  }

  // compute progress: prefer using provided durationSeconds as total window.
  // if ctxRemaining is larger than durationSeconds, cap to 1.
  const displayRemaining = ctxRemaining !== null ? ctxRemaining : remaining;
  const total = Math.max(1, durationSeconds);
  const progress = Math.max(0, Math.min(1, displayRemaining / total));

  // actions
  const handleRefreshPage = () => window.location.reload();

  const handleRefreshToken = async () => {
    // prefer parent callback
    if (typeof onRefreshToken === "function") {
      try {
        setMenuOpen(false);
        onRefreshToken();
        // mark as triggered so auto-refresh doesn't immediately re-trigger
        autoRefreshTriggeredRef.current = true;
      } catch (err) {
        // ignore
      }
      return;
    }

    // else prefer auth.forceRefresh()
    if (ctxForceRefresh) {
      setMenuOpen(false);
      try {
        await ctxForceRefresh();
        autoRefreshTriggeredRef.current = true;
      } catch (err) {
        // provider handles failures (e.g. logout)
      }
      return;
    }

    // fallback: reload page (last resort)
    window.location.reload();
  };

  const handleLogout = () => {
    setMenuOpen(false);
    if (typeof onLogout === "function") {
      onLogout();
      return;
    }
    if (ctxLogout) {
      ctxLogout();
      return;
    }
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = "/login";
  };

  // center content: prefer showInNavbar over showVillageInNavbar
  const displayName = ctxUser?.name ?? name;
  const displayVillage = ctxVillage ?? village;

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
      return (
        <div className="text-2xl font-bold text-green-800 text-center whitespace-nowrap">
          {displayVillage}
        </div>
      );
    }
    return null;
  })();

  return (
    <header className="w-full select-none">
      <div className="bg-[#a7dec0]">
        <div className="max-w-8xl mx-auto px-4">
          {/* top row: left and right stay in flow; center is absolutely centered */}
          <div className="relative flex items-center justify-between py-2 min-h-[64px]">
            {/* LEFT: logo + welcome */}
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="logo" className="w-14 h-14 object-contain" />

              <div>
                {showWelcome && displayName ? (
                  <div className="text-lg font-semibold text-black leading-tight">
                    Welcome {displayName}
                  </div>
                ) : null}
              </div>
            </div>

            {/* CENTER: absolutely centered to header (visually centered regardless of left/right width) */}
            {centerContent && (
              <div
                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                style={{ width: "72%", maxWidth: 900 }}
              >
                {/* truncate on very small screens to avoid overlap; show full on md+ */}
                <div className="mx-auto text-center truncate">{centerContent}</div>
              </div>
            )}

            {/* RIGHT: brand + optional slot + admin */}
            <div className="flex items-center justify-end gap-4">
              <div className="text-right">
                <div className="text-[#4a3529] font-bold text-xl leading-none">{brandDevanagari}</div>
                <div className="text-xs text-[#4a3529] tracking-wider">{brandLatin}</div>
              </div>

              {rightContent && <div className="mr-2">{rightContent}</div>}

              <div className="relative">
                <button
                  ref={adminButtonRef}
                  onClick={() => setMenuOpen((v) => !v)}
                  className="focus:outline-none p-1 rounded-full hover:bg-white/30 transition"
                  title="Account"
                >
                  <div className="w-8 h-8 rounded-full bg-white/90 border border-[#4a3529] flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4a3529]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                </button>

                {menuOpen && (
                  <div ref={menuRef} className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg ring-1 ring-black/5 z-50">
                    <ul className="py-1">
                      <li>
                        <button onClick={() => { handleRefreshPage(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Refresh page</button>
                      </li>
                      <li>
                        <button onClick={handleRefreshToken} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Refresh token</button>
                      </li>
                      <li>
                        <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50">Logout</button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* slim expiry row */}
      <div className="bg-[#eaf9ee]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center py-1 relative">
            <div className="text-sm text-[#4a6b54] z-10">
              Login Expires in:{" "}
              <span className={displayRemaining <= 10 ? "animate-pulse font-semibold text-red-600" : "font-medium"}>
                {formatTime(displayRemaining)}
              </span>
            </div>
            <div className="absolute left-4 right-4 bottom-0 h-0.5 bg-[#dff6de] rounded overflow-hidden">
              <div
                style={{
                  width: `${progress * 100}%`,
                  transition: "width 1s linear",
                  height: "100%",
                  background: displayRemaining <= 0 ? "#f87171" : "#68d391",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
