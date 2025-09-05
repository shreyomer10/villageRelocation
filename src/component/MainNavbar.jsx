// src/components/MainNavbar.jsx
import React, { useEffect, useRef, useState } from "react";

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
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [remaining, setRemaining] = useState(durationSeconds);
  const menuRef = useRef(null);
  const adminButtonRef = useRef(null);

  useEffect(() => setRemaining(durationSeconds), [durationSeconds]);

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => (r <= 0 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

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

  function formatTime(sec) {
    if (sec <= 0) return "Session expired";
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) return `${hrs} hr ${mins} min ${s} sec`;
    if (mins > 0) return `${mins} min ${s} sec`;
    return `${s} sec`;
  }

  const progress = Math.max(0, Math.min(1, remaining / durationSeconds));

  const handleRefreshPage = () => window.location.reload();
  const handleRefreshToken = () => {
    setRemaining(durationSeconds);
    if (typeof onRefreshToken === "function") onRefreshToken();
    setMenuOpen(false);
  };
  const handleLogout = () => {
    if (typeof onLogout === "function") onLogout();
    else {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
      window.location.href = "/login";
    }
    setMenuOpen(false);
  };

  // center content: prefer showInNavbar over showVillageInNavbar
  const centerContent = (() => {
    if (showInNavbar && village) {
      return (
        <h1 className="text-2xl font-bold text-black text-center whitespace-nowrap">
          {village} <span className="text-2xl font-bold text-black">Beneficiaries -</span>{" "}
          <span className="text-green-800 font-semibold">Family List</span>
        </h1>
      );
    }
    if (showVillageInNavbar && village) {
      return (
        <div className="text-2xl font-bold text-green-800 text-center whitespace-nowrap">
          {village}
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
                {showWelcome && name ? (
                  <div className="text-lg font-semibold text-black leading-tight">
                    Welcome {name}
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
              <span className={remaining <= 10 ? "animate-pulse font-semibold text-red-600" : "font-medium"}>
                {formatTime(remaining)}
              </span>
            </div>
            <div className="absolute left-4 right-4 bottom-0 h-0.5 bg-[#dff6de] rounded overflow-hidden">
              <div style={{ width: `${progress * 100}%`, transition: "width 1s linear", height: "100%", background: remaining <= 0 ? "#f87171" : "#68d391" }} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
