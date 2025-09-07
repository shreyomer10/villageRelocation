import React, { useEffect, useRef, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext"; // adjust path to where your provider lives

export default function MainNavbar({
  logoUrl = "/images/logo.png",
  brandDevanagari = "माटी",
  brandLatin = "MAATI",
  durationSeconds = 36,
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

  // Context values
  const ctxUser = auth?.user ?? null; // { name, role, email }
  const ctxVillage = auth?.villageId ?? null;
  const ctxRemaining = typeof auth?.tokenRemaining === "number" ? auth.tokenRemaining : null;
  const ctxExpiresAt = auth?.tokenExpiresAt ?? null; // ms timestamp
  const ctxForceRefresh = auth?.forceRefresh ?? null;
  const ctxLogout = auth?.logout ?? null;

  // UI state
  const [menuOpen, setMenuOpen] = useState(false);
  const [remaining, setRemaining] = useState(durationSeconds);
  const menuRef = useRef(null);
  const adminButtonRef = useRef(null);

  // refs to always-read latest context values inside interval
  const ctxRemainingRef = useRef(ctxRemaining);
  const ctxExpiresAtRef = useRef(ctxExpiresAt);
  const ctxUserRef = useRef(ctxUser);
  const calledRefreshRef = useRef(false);

  useEffect(() => {
    ctxRemainingRef.current = ctxRemaining;
  }, [ctxRemaining]);
  useEffect(() => {
    ctxExpiresAtRef.current = ctxExpiresAt;
  }, [ctxExpiresAt]);
  useEffect(() => {
    ctxUserRef.current = ctxUser;
  }, [ctxUser]);

  // If there is NO remaining and NO expiresAt but we do have a logged-in user, attempt one forced refresh
  useEffect(() => {
    if (!ctxUserRef.current) return; // not logged in
    if ((ctxRemainingRef.current == null && ctxExpiresAtRef.current == null) && !calledRefreshRef.current) {
      calledRefreshRef.current = true;
      if (ctxForceRefresh) {
        ctxForceRefresh().catch(() => {});
      }
    }
  }, [ctxForceRefresh]);

  // single interval to compute remaining (reads latest refs)
  useEffect(() => {
    // immediate compute
    const compute = () => {
      if (typeof ctxRemainingRef.current === "number") return ctxRemainingRef.current;
      if (ctxExpiresAtRef.current) return Math.max(0, Math.ceil((ctxExpiresAtRef.current - Date.now()) / 1000));
      return null;
    };

    const initial = compute();
    if (initial != null) setRemaining(initial);
    else setRemaining((r) => (r == null ? durationSeconds : r));

    const iv = setInterval(() => {
      const val = compute();
      if (val != null) setRemaining(val);
      else setRemaining((r) => (r == null ? durationSeconds : Math.max(0, r - 1)));
    }, 1000);

    return () => clearInterval(iv);
  }, [durationSeconds]);

  // auto-refresh behavior (call once per cycle)
  const autoRefreshTriggeredRef = useRef(false);
  useEffect(() => {
    // reset trigger on new token (jump up)
    const cur = typeof ctxRemaining === "number" ? ctxRemaining : (ctxExpiresAt ? Math.max(0, Math.ceil((ctxExpiresAt - Date.now()) / 1000)) : null);
    if (cur == null) autoRefreshTriggeredRef.current = false;
    if (cur != null && cur > refreshBeforeSeconds + 5) autoRefreshTriggeredRef.current = false;

    const currentRemaining = typeof ctxRemaining === "number" ? ctxRemaining : remaining;

    if (
      currentRemaining !== null &&
      currentRemaining <= refreshBeforeSeconds &&
      currentRemaining > 0 &&
      !autoRefreshTriggeredRef.current
    ) {
      if (typeof onRefreshToken === "function") {
        try {
          onRefreshToken();
        } catch (err) {}
        autoRefreshTriggeredRef.current = true;
      } else if (ctxForceRefresh) {
        ctxForceRefresh().catch(() => {});
        autoRefreshTriggeredRef.current = true;
      }
    }
  }, [ctxRemaining, ctxExpiresAt, remaining, refreshBeforeSeconds, durationSeconds, onRefreshToken, ctxForceRefresh]);

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

  const displayRemaining = remaining == null ? 0 : remaining;
  const total = Math.max(1, durationSeconds);
  const progress = displayRemaining != null ? Math.max(0, Math.min(1, displayRemaining / total)) : 0;

  const handleRefreshPage = () => window.location.reload();

  const handleRefreshToken = async () => {
    setMenuOpen(false);
    if (typeof onRefreshToken === "function") {
      try {
        onRefreshToken();
        autoRefreshTriggeredRef.current = true;
      } catch (err) {}
      return;
    }
    if (ctxForceRefresh) {
      try {
        await ctxForceRefresh();
        autoRefreshTriggeredRef.current = true;
      } catch (err) {}
      return;
    }
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

  const displayName = ctxUser?.name ?? name;
  const displayRole = ctxUser?.role ?? null;
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

  // close on escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="w-full select-none">
      <div className="bg-[#a7dec0]">
        <div className="max-w-8xl mx-auto px-4">
          <div className="relative flex items-center justify-between py-2 min-h-[64px]">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="logo" className="w-14 h-14 object-contain" />
              <div>
                {showWelcome && displayName ? (
                  <div className="text-lg font-semibold text-black leading-tight">
                    Welcome {displayName} {displayRole ? `(${displayRole})` : null}
                  </div>
                ) : null}
              </div>
            </div>

            {centerContent && (
              <div
                className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto"
                style={{ width: "72%", maxWidth: 900 }}
              >
                <div className="mx-auto text-center truncate">{centerContent}</div>
              </div>
            )}

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
              Login Expires in: {" "}
              <span className={displayRemaining !== null && displayRemaining <= 10 ? "animate-pulse font-semibold text-red-600" : "font-medium"}>
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

      {/* Sidebar + overlay */}
      {/* Overlay */}
      <div
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 transition-opacity ${menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMenuOpen(false)}
      >
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Sidebar panel */}
      <aside
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        className={`fixed top-0 right-0 z-50 h-full w-80 max-w-full transform transition-transform duration-300 ease-in-out bg-white shadow-2xl ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="text-sm font-medium">Account</div>
          <div>
            <button onClick={() => setMenuOpen(false)} className="p-2 rounded hover:bg-gray-100 focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-auto h-full pb-20">
          <div className="text-xs text-gray-500 mb-2">Signed in as</div>
          <div className="text-sm font-medium mb-3">{displayName}</div>
          {displayRole ? <div className="text-sm text-gray-600 mb-4">Role: {displayRole}</div> : null}

          <div className="space-y-2">
            <button onClick={() => { handleRefreshPage(); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 border">Refresh page</button>
            <button onClick={handleRefreshToken} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 border">Refresh token</button>
            <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded text-red-600 hover:bg-gray-50 border">Logout</button>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <div>Login Expires in: <span className={displayRemaining !== null && displayRemaining <= 10 ? "animate-pulse font-semibold text-red-600" : "font-medium"}>{formatTime(displayRemaining)}</span></div>
            <div className="mt-3 text-xs text-gray-400">Tip: Token will auto-refresh when it gets near expiry.</div>
          </div>

          {/* Place for extra account links or debug info */}
          <div className="mt-6 text-xs text-gray-500">
            <div className="font-semibold">Village</div>
            <div className="truncate">{displayVillage ?? "-"}</div>
          </div>

          {/* Right content copy (if desired inside sidebar) */}
          {rightContent ? <div className="mt-6">{rightContent}</div> : null}
        </div>
      </aside>
    </header>
  );
}
