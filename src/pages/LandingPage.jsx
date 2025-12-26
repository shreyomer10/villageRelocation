// src/pages/LandingPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../component/Footer";

/*
  Landing page — header fixed to top, hero image fills remaining viewport (not covered by header).
  Added: a compact login box overlay on the hero which accepts a Family ID and calls the onLogin handler.

  Behavior summary:
  - Header fixed at top with explicit height (64px).
  - Hero fills the rest of the viewport (calc(100vh - 64px)).
  - Login box appears as an overlay above the hero, centered near the top of the photo.
  - Submitting the form navigates to /login?familyId=<VALUE>.
*/

function ChevronLeftIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRightIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

// compact LoginBox used as an overlay on the hero
function LoginBox({ onLogin }) {
  const [familyId, setFamilyId] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const id = (familyId ?? "").trim();
    if (!id) {
      setError("Please enter a Family ID");
      return;
    }
    setError("");
    onLogin(id);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md flex items-center gap-2" aria-label="Family login form">
      <label htmlFor="familyId" className="sr-only">Family ID</label>
      <input
        id="familyId"
        value={familyId}
        onChange={(e) => setFamilyId(e.target.value)}
        placeholder="Enter Family ID"
        className="flex-1 px-3 py-2 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        aria-invalid={!!error}
      />
      <button type="submit" className="px-3 py-2 rounded bg-emerald-800 text-white text-sm hover:bg-emerald-700">Login</button>
      {error && <div role="status" className="text-red-600 text-xs ml-2">{error}</div>}
    </form>
  );
}

function Slideshow({ slides = [], intervalMs = 4000, className = "", showControlsOnHover = true, onLogin }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hovering, setHovering] = useState(false);

  React.useEffect(() => {
    if (!slides || slides.length < 2) return;
    const id = setInterval(() => {
      if (!hovering) setCurrentIndex((p) => (p + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [slides, hovering, intervalMs]);

  if (!slides || slides.length === 0) {
    return <div className={`${className} flex items-center justify-center bg-gray-100 text-gray-500`} style={{height: 'calc(100vh - 64px)'}}>No slides</div>;
  }

  const showControls = showControlsOnHover ? hovering : true;

  // heroHeight matches header height (64px) so slideshow doesn't sit under the header
  const heroStyle = { height: 'calc(100vh - 64px)' };

  return (
    <div
      className={`${className} relative overflow-hidden`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={heroStyle}
    >
      {/* Login box overlay - positioned near top center of hero */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
        <LoginBox onLogin={onLogin} />
      </div>

      {/* Fullscreen slides (minus header) */}
      <div className="w-full h-full flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
        {slides.map((s, i) => (
          <div key={i} className="w-full h-full flex-shrink-0 relative">
            {/* image covers remaining viewport */}
            <img src={s.src} alt={s.alt ?? `slide-${i + 1}`} className="w-full h-full object-cover" draggable={false} />

            {/* caption bottom-left (won't push layout) */}
            {s.caption && (
              <div className="absolute left-6 bottom-8 md:left-12 md:bottom-12 bg-black/30 backdrop-blur-sm rounded px-4 py-3 text-white max-w-xl">
                <h3 className="text-lg md:text-2xl font-semibold">{s.caption.title}</h3>
                {s.caption.subtitle && <p className="text-sm md:text-base mt-1">{s.caption.subtitle}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls (appear on hover) */}
      {showControls && (
        <> 
          <button onClick={() => setCurrentIndex((p) => (p - 1 + slides.length) % slides.length)} aria-label="Previous" className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/30 text-white rounded-full p-3 z-30">
            <ChevronLeftIcon />
          </button>
          <button onClick={() => setCurrentIndex((p) => (p + 1) % slides.length)} aria-label="Next" className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/30 text-white rounded-full p-3 z-30">
            <ChevronRightIcon />
          </button>
        </>
      )}

      {/* indicators centered near bottom */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setCurrentIndex(i)} className={`w-3 h-3 rounded-full ${i === currentIndex ? 'bg-white' : 'bg-gray-400/60'}`} aria-label={`Go to slide ${i+1}`} />
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const slides = [
    { src: '/images/Img1.jpg', alt: 'Village landscape', caption: { title: 'Sustainable Relocation', subtitle: 'Planned, fair and transparent' } },
    { src: '/images/Img2.jpg', alt: 'Community development', caption: { title: 'Community First', subtitle: 'People and livelihoods protected' } },
    { src: '/images/Img3.jpg', alt: 'New homes', caption: { title: 'Better Living', subtitle: 'Infrastructure & services' } },
  ];

  function handleFamilyLogin(familyId) {
    // navigate to login route with familyId as query param
    navigate(`/login?familyId=${encodeURIComponent(familyId)}`);
  }

  return (
    <div className="bg-[#fff8e1]">
      {/* Header (fixed) - give it an explicit height so layout can reserve space */}
      <header className="fixed top-0 left-0 w-full h-16 bg-[#c8e6c9]/90 backdrop-blur-sm p-4 flex items-center justify-between z-50 shadow">
        <div className="flex items-center gap-3 px-6">
          <img src="/images/logo.png" alt="logo" className="h-10 w-10 rounded" />
          <div>
            <div className="text-lg font-bold text-[#1b5e20]">Village Relocation Authority</div>
            <div className="text-xs text-gray-700">Village Relocation Monitoring</div>
          </div>
        </div>

        <nav className="hidden md:flex gap-6 items-center mr-6">
          <button onClick={() => navigate('/')} className="text-sm">Login</button>
          <a href="#" onClick={(e) => e.preventDefault()} className="text-sm">Guidelines</a>
          <a href="#" onClick={(e) => e.preventDefault()} className="text-sm">About</a>
          <a href="#" onClick={(e) => e.preventDefault()} className="text-sm">FAQs</a>
          <a href="#" onClick={(e) => e.preventDefault()} className="text-sm">Contact</a>
        </nav>

        <div className="md:hidden">
          <button onClick={() => setMobileNavOpen((s) => !s)} className="p-2 rounded bg-white/30">
            <svg className="h-6 w-6 text-emerald-900" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>

        {mobileNavOpen && (
          <div className="absolute right-4 top-16 bg-white rounded-md shadow-lg p-4 w-44 md:hidden">
            <a className="block py-2 text-sm" href="/login">Login</a>
            <button className="block py-2 text-sm w-full text-left" onClick={() => setMobileNavOpen(false)}>Close</button>
          </div>
        )}
      </header>

      {/* Main: reserve header height with padding-top so header does not overlap content */}
      <main className="w-full pt-16">
        <Slideshow className="w-full" slides={slides} intervalMs={4000} showControlsOnHover={true} onLogin={handleFamilyLogin} />

        {/* Footer lives below the fold — user must scroll to reach it */}
        <div>
          <Footer />
        </div>
      </main>
    </div>
  );
}
