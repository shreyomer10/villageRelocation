// src/pages/LandingPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";



const BASE_URL = "https://villagerelocation.onrender.com"; // API prefix from spec

function fmtDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/* ---------------------------
   Small chevron icons used by slideshow
   --------------------------- */
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

/* ---------------------------
   Slideshow component
   - autoplay every 4s
   - pause on hover
   - prev/next buttons and indicators
   - keyboard left/right
   - touch swipe support
   - accepts className and showControlsOnHover props
   --------------------------- */
function Slideshow({ slides = [], intervalMs = 4000, className = "", showControlsOnHover = true }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const containerRef = useRef(null);
  const touchStartX = useRef(null);

  // Auto slide logic
  useEffect(() => {
    if (!Array.isArray(slides) || slides.length < 2) return undefined;

    const id = setInterval(() => {
      if (!hovering) setCurrentIndex((p) => (p + 1) % slides.length);
    }, intervalMs);

    return () => clearInterval(id);
  }, [hovering, intervalMs, slides]);

  // keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") setCurrentIndex((p) => (p - 1 + slides.length) % slides.length);
      if (e.key === "ArrowRight") setCurrentIndex((p) => (p + 1) % slides.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  // touch handlers (basic)
  function onTouchStart(e) {
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  }
  function onTouchEnd(e) {
    if (!touchStartX.current) return;
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    if (endX == null) return;
    const dx = endX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx > 0) {
        setCurrentIndex((p) => (p - 1 + slides.length) % slides.length);
      } else {
        setCurrentIndex((p) => (p + 1) % slides.length);
      }
    }
    touchStartX.current = null;
  }

  const showControls = showControlsOnHover ? hovering : true;

  if (!slides || slides.length === 0) {
    return (
      <div className={`${className} h-64 flex items-center justify-center bg-gray-100 text-gray-500`}>
        No slides
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${className} relative overflow-hidden`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      <div
        className="w-full h-full flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={index} className="w-full h-full flex-shrink-0 relative">
            <img
              src={slide.src}
              alt={slide.alt ?? `slide-${index + 1}`}
              className="w-full h-full object-cover"
              draggable={false}
            />

            {/* subtle overlay for captions */}
            {slide.caption && (
              <div className="absolute left-0 right-0 bottom-0 p-6 md:p-10 bg-gradient-to-t from-black/45 to-transparent text-white">
                <div className="max-w-3xl">
                  <h3 className="text-lg md:text-2xl font-semibold">{slide.caption.title}</h3>
                  {slide.caption.subtitle && <p className="text-sm md:text-base mt-1">{slide.caption.subtitle}</p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prev/Next buttons - show when hovering (or always if configured) */}
      {showControls && (
        <>
          <button
            onClick={() => setCurrentIndex((p) => (p - 1 + slides.length) % slides.length)}
            aria-label="Previous slide"
            className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/40 text-white rounded-full p-3 hover:bg-black/60 transition focus:outline-none focus:ring-2 focus:ring-emerald-300 z-20"
          >
            <ChevronLeftIcon />
          </button>

          <button
            onClick={() => setCurrentIndex((p) => (p + 1) % slides.length)}
            aria-label="Next slide"
            className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/40 text-white rounded-full p-3 hover:bg-black/60 transition focus:outline-none focus:ring-2 focus:ring-emerald-300 z-20"
          >
            <ChevronRightIcon />
          </button>
        </>
      )}

      {/* indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${i === currentIndex ? "bg-white" : "bg-gray-400/60"}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------
   ContactSection component (kept clean and responsive)
   Also renders social media if available
   --------------------------- */
function IconPhone() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M22 16.92V20a2 2 0 0 1-2.18 2A19 19 0 0 1 3 5.18 2 2 0 0 1 5 3h3.09a1 1 0 0 1 1 .75l.7 3a1 1 0 0 1-.25.95L8.91 9.91a12 12 0 0 0 6.18 6.18l1.27-1.09a1 1 0 0 1 .95-.25l3 .7A1 1 0 0 1 21 17.91V20z" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 8.5v7A2.5 2.5 0 0 0 5.5 18h13A2.5 2.5 0 0 0 21 15.5v-7" />
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 8.5L12 13l9-4.5" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M19.5 9.5c0 6-7.5 11-7.5 11s-7.5-5-7.5-11a7.5 7.5 0 1 1 15 0z" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 7v6l4 2" />
    </svg>
  );
}

function ContactSection({ contact }) {
  const fallback = {
    emergencyContact: null,
    headquarters: null,
    regionalOffices: [],
    workingHours: "",
    socialMedia: null,
  };
  const c = contact ?? fallback;

  return (
    <section id="contact" className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-2xl font-semibold text-emerald-900 text-center mb-8">Contact Us</h2>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="md:flex md:items-stretch">
          {/* Left panel */}
          <div className="md:w-1/2 bg-emerald-900 text-white p-8 md:p-10">
            <h3 className="text-lg font-semibold mb-3">Get in Touch</h3>
            <p className="text-sm text-white/90 mb-6 max-w-prose">Our dedicated support team is here to help with your inquiries and claims.</p>

            <div className="space-y-5">
              {c.emergencyContact && (
                <div className="flex gap-4">
                  <div className="pt-1 text-emerald-100">
                    <IconPhone />
                  </div>
                  <div>
                    <div className="font-medium">Helpline</div>
                    <div className="text-sm text-white/90">{c.emergencyContact.description ?? ""}</div>
                    <div className="text-sm mt-1">
                      <a href={`tel:${c.emergencyContact.number}`} className="underline">{c.emergencyContact.number}</a>
                    </div>
                  </div>
                </div>
              )}

              {(c.headquarters?.email || c.headquarters?.email2) && (
                <div className="flex gap-4">
                  <div className="pt-1 text-emerald-100">
                    <IconMail />
                  </div>
                  <div>
                    <div className="font-medium">Email</div>
                    <div className="text-sm text-white/90">
                      {c.headquarters?.email}
                      {c.headquarters?.email2 ? <><br />{c.headquarters.email2}</> : null}
                    </div>
                  </div>
                </div>
              )}

              {c.headquarters && (
                <div className="flex gap-4">
                  <div className="pt-1 text-emerald-100">
                    <IconPin />
                  </div>
                  <div>
                    <div className="font-medium">Head Office</div>
                    <div className="text-sm text-white/90 mt-1 whitespace-pre-line">{c.headquarters.address ?? "-"}</div>
                    {c.headquarters.phone && (
                      <div className="text-sm mt-2">Phone: <a href={`tel:${c.headquarters.phone}`} className="underline">{c.headquarters.phone}</a></div>
                    )}
                    {c.headquarters.fax && (
                      <div className="text-sm mt-1">Fax: <span className="opacity-90">{c.headquarters.fax}</span></div>
                    )}
                  </div>
                </div>
              )}

              {c.workingHours && (
                <div className="flex gap-4">
                  <div className="pt-1 text-emerald-100">
                    <IconClock />
                  </div>
                  <div>
                    <div className="font-medium">Office Hours</div>
                    <div className="text-sm text-white/90 mt-1">{c.workingHours}</div>
                  </div>
                </div>
              )}

              {c.socialMedia && (
                <div className="mt-4">
                  <div className="font-medium text-emerald-100">Follow us</div>
                  <div className="text-sm mt-1">
                    {c.socialMedia.website && (
                      <div><a href={c.socialMedia.website} target="_blank" rel="noreferrer" className="underline">Website</a></div>
                    )}
                    {c.socialMedia.facebook && <div>Facebook: <a href={`https://facebook.com/${c.socialMedia.facebook}`} target="_blank" rel="noreferrer" className="underline">{c.socialMedia.facebook}</a></div>}
                    {c.socialMedia.twitter && <div>Twitter: <a href={`https://twitter.com/${c.socialMedia.twitter.replace(/^@/,"")}`} target="_blank" rel="noreferrer" className="underline">{c.socialMedia.twitter}</a></div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="md:w-1/2 p-8 md:p-10 bg-white">
            <h3 className="text-lg font-semibold text-emerald-900 mb-4">Regional Offices</h3>

            {Array.isArray(c.regionalOffices) && c.regionalOffices.length > 0 ? (
              <div className="space-y-6">
                {c.regionalOffices.map((r, idx) => (
                  <div key={idx}>
                    <div className="text-sm font-semibold text-emerald-800 mb-1">{r.region ?? "Region"}</div>
                    <div className="text-sm text-gray-700">{r.address ?? ""}</div>
                    {r.phone && (
                      <div className="text-sm text-gray-600 mt-1">Phone: <a href={`tel:${r.phone}`} className="underline">{r.phone}</a></div>
                    )}

                    {idx < c.regionalOffices.length - 1 && (
                      <div className="border-t border-gray-100 mt-4 pt-4" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Regional offices are not available at the moment.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------
   FaqSection component (merged)
   --------------------------- */
function Chevron({ open }) {
  return (
    <svg
      className={`h-5 w-5 transform transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
    </svg>
  );
}

function FaqSection({ faq }) {
  const items = [];

  if (faq) {
    if (faq.title) {
      // optionally show title and totalQuestions above
    }

    if (Array.isArray(faq.categories) && faq.categories.length > 0) {
      faq.categories.forEach((cat, ci) => {
        const qs = Array.isArray(cat.questions) ? cat.questions : [];
        qs.forEach((q, qi) =>
          items.push({
            id: `cat-${ci}-q-${qi}`,
            question: q.question ?? q.q ?? "Question",
            answer: q.answer ?? q.a ?? "-",
            category: cat.categoryName ?? "",
          })
        );
      });
    } else if (Array.isArray(faq.questions) && faq.questions.length > 0) {
      faq.questions.forEach((q, i) =>
        items.push({
          id: `q-${i}`,
          question: q.question ?? q.q ?? "Question",
          answer: q.answer ?? q.a ?? "-",
          category: "",
        })
      );
    }
  }

  const hasItems = items.length > 0;
  const [openIndex, setOpenIndex] = useState(-1);

  function toggle(i) {
    setOpenIndex((prev) => (prev === i ? -1 : i));
  }

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <div className="bg-emerald-900 rounded-xl p-6 md:p-10 shadow-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-800/40">
            <svg className="h-6 w-6 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.09 9a3 3 0 0 1 5.82 0c0 1.5-1 2-1.5 2.5C12.5 12.7 12 13 12 15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h2 className="text-xl md:text-2xl font-semibold text-emerald-50">Frequently Asked Questions</h2>
          </div>

          {faq?.title && <div className="text-sm text-emerald-100 mt-3">{faq.title} {faq?.totalQuestions ? `Â· ${faq.totalQuestions} Qs` : ''}</div>}
        </div>

        <div className="mt-4">
          <div className="bg-white rounded-lg p-4 md:p-6 space-y-3">
            {!hasItems ? (
              <div className="text-gray-600 p-6 text-center">No FAQs available at the moment.</div>
            ) : (
              items.map((it, idx) => (
                <div key={it.id} className="rounded-md">
                  <button
                    type="button"
                    aria-expanded={openIndex === idx}
                    aria-controls={`faq-panel-${it.id}`}
                    onClick={() => toggle(idx)}
                    className="w-full flex items-center justify-between gap-4 px-4 py-3 md:py-4 bg-gray-50 hover:bg-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  >
                    <div className="text-left">
                      {it.category && <div className="text-xs text-emerald-800 font-semibold">{it.category}</div>}
                      <div className="text-sm md:text-base text-gray-800 font-medium">{it.question}</div>
                    </div>

                    <div className="flex items-center">
                      <Chevron open={openIndex === idx} />
                    </div>
                  </button>

                  <div
                    id={`faq-panel-${it.id}`}
                    role="region"
                    aria-labelledby={`faq-button-${it.id}`}
                    className={`px-4 pt-3 pb-4 text-sm text-gray-700 transition-all duration-200 ${openIndex === idx ? "max-h-96 opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}
                    style={{ transitionProperty: "max-height, opacity" }}
                  >
                    <div className="whitespace-pre-line">{it.answer}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------
   Footer component (merged)
   --------------------------- */
function Footer({ contact }) {
  const website = contact?.socialMedia?.website ?? contact?.headquarters?.website ?? null;

  return (
    <footer className="bg-[#064f3b] text-white mt-12">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img src="/images/logo.png" alt="Village Relocation Authority logo" className="h-12 w-12 rounded-full border border-white/20" />
              <div>
                <div className="font-semibold">Forest Department</div>
                <div className="text-xs opacity-80">Wildlife Damage Compensation</div>
              </div>
            </div>

            <p className="text-sm text-white/85 max-w-sm">Providing support and compensation to communities affected by wildlife damage since 1995.</p>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="/" className="hover:underline">Home</a></li>
              <li><a href="/login" className="hover:underline">Login</a></li>
              <li><a href="#guidelines" className="hover:underline">Guidelines</a></li>
              <li><a href="#faq" className="hover:underline">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="#guidelines" className="hover:underline">Relocation Guidelines</a></li>
              <li><a href="#about" className="hover:underline">About</a></li>
              <li><a href="#contact" className="hover:underline">Contact</a></li>
              <li><a href="#faq" className="hover:underline">Research</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="#faq" className="hover:underline">FAQ</a></li>
              <li><a href="#contact" className="hover:underline">Help Center</a></li>
              <li><a href="#contact" className="hover:underline">Emergency Contacts</a></li>
              <li><a href="#contact" className="hover:underline">Feedback</a></li>
            </ul>
          </div>
        </div>

        <hr className="my-6 border-white/10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-white/80">Â© {new Date().getFullYear()} Forest Department, Government of Chhattisgarh. All rights reserved.</div>

          <div className="flex items-center gap-4 text-sm text-white/80">
            {website ? <a href={website} target="_blank" rel="noreferrer" className="hover:underline">Official website</a> : null}
            <a href="/privacy" className="hover:underline">Privacy Policy</a>
            <a href="/terms" className="hover:underline">Terms of Use</a>
            <a href="/accessibility" className="hover:underline">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------
   LandingPage (main) with Slideshow integrated
   Fully connected to MAATI endpoints:
   GET /maati/guidelines
   GET /maati/aboutUs
   GET /maati/contactUs
   GET /maati/faq
   Uses robust fetch handling and displays all returned fields where possible
   --------------------------- */
export default function LandingPage() {
  const navigate = useNavigate();
  const [splashVisible, setSplashVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [guidelines, setGuidelines] = useState(null);
  const [aboutUs, setAboutUs] = useState(null);
  const [contact, setContact] = useState(null);
  const [faq, setFaq] = useState(null);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashVisible(false), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      const endpoints = {
        guidelines: `${BASE_URL}/guidelines`,
        aboutUs: `${BASE_URL}/aboutUs`,
        contactUs: `${BASE_URL}/contactUs`,
        faq: `${BASE_URL}/faq`,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        // fetch each endpoint; handle each independently so one failing doesn't wipe others
        const fetchPromises = Object.entries(endpoints).map(async ([key, url]) => {
          try {
            const res = await fetch(url, { signal: controller.signal });
            const text = await res.text().catch(() => null);
            let parsed = null;
            if (text) {
              try {
                parsed = JSON.parse(text);
              } catch (e) {
                // not json
                parsed = null;
              }
            }

            // If API returned wrapper { error:false, result: {...} } use result
            const value = parsed?.result ?? parsed ?? null;

            return { key, ok: res.ok, value, raw: parsed };
          } catch (err) {
            return { key, ok: false, value: null, raw: { error: true, message: err.message } };
          }
        });

        const results = await Promise.all(fetchPromises);
        clearTimeout(timeout);

        if (cancelled) return;

        // Map results to state
        results.forEach((r) => {
          if (r.key === 'guidelines') setGuidelines(r.value ?? null);
          if (r.key === 'aboutUs') setAboutUs(r.value ?? null);
          if (r.key === 'contactUs') setContact(r.value ?? null);
          if (r.key === 'faq') setFaq(r.value ?? null);
        });

      } catch (err) {
        if (!cancelled) {
          if (err.name === 'AbortError') setError('Request timed out');
          else setError(err.message || 'Failed to fetch content');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  if (splashVisible) {
    return (
      <div className="flex h-screen w-screen items-center bg-[#fff8e1] justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <img src="/images/logo.png" alt="logo" className="mx-auto h-20 w-28" />
          <h1 className="mt-6 text-2xl font-bold text-gray-800">MAATI</h1>
          <p className="text-gray-600 mt-2">Ensuring Transparency & Fair Relocation</p>
          <p className="text-blue-500 italic text-sm">Government of India Initiative</p>
        </div>
      </div>
    );
  }

  // default slides - replace images / captions as needed
  const slides = [
    { src: "/images/Img1.jpg", alt: "Village landscape", caption: { title: "Sustainable Relocation", subtitle: "Planned, fair and transparent" } },
    { src: "/images/Img2.jpg", alt: "Community development", caption: { title: "Community First", subtitle: "People and livelihoods protected" } },
    { src: "/images/Img3.jpg", alt: "New homes", caption: { title: "Better Living", subtitle: "Infrastructure & services" } },
    { src: "/images/Img4.jpg", alt: "Environment protection", caption: { title: "Conserving Nature", subtitle: "Balanced development" } },
  ];

  return (
    <div className="font-sans min-h-screen bg-[#fff8e1] text-gray-900 w-full">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full bg-[#c8e6c9]/95 backdrop-blur-sm p-4 flex items-center justify-between shadow z-50">
        <div className="flex items-center px-10 gap-2">
          <img src="/images/logo.png" alt="logo" className="h-14 w-20 rounded" />
          <div>
            <h1 className="text-lg font-bold text-[#1b5e20]">Village Relocation Authority</h1>
            <p className="text-xs text-gray-700">Village Relocation Monitoring</p>
          </div>
        </div>

        <nav className="hidden md:flex gap-6 text-sm items-center">
          <button onClick={() => navigate("/login")} className="hover:text-[#1b5e20]">Login</button>
          <a href="#guidelines" className="hover:text-[#1b5e20]">Guidelines</a>
          <a href="#about" className="hover:text-[#1b5e20]">About Us</a>
          <a href="#faq" className="hover:text-[#1b5e20]">FAQs</a>
          <a href="#contact" className="hover:text-[#1b5e20]">Contact</a>
        </nav>

        {/* mobile menu */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileNavOpen((s) => !s)}
            aria-label="Toggle menu"
            className="p-2 rounded-md bg-white/30"
          >
            <svg className="h-6 w-6 text-emerald-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* mobile nav panel */}
        {mobileNavOpen && (
          <div className="absolute right-4 top-16 bg-white rounded-md shadow-lg p-4 w-48 md:hidden">
            <a className="block py-2 text-sm" href="/login">Login</a>
            <a className="block py-2 text-sm" href="#guidelines" onClick={() => setMobileNavOpen(false)}>Guidelines</a>
            <a className="block py-2 text-sm" href="#about" onClick={() => setMobileNavOpen(false)}>About Us</a>
            <a className="block py-2 text-sm" href="#faq" onClick={() => setMobileNavOpen(false)}>FAQs</a>
            <a className="block py-2 text-sm" href="#contact" onClick={() => setMobileNavOpen(false)}>Contact</a>
          </div>
        )}
      </header>

      {/* Slideshow (top) - full width just below header */}
      <div className="w-full relative mt-20">
        <Slideshow className="w-full h-[320px] md:h-[480px] lg:h-[600px]" slides={slides} intervalMs={4000} showControlsOnHover={true} />
      </div>

      {/* Main */}
      <main className="max-w-6xl mx-auto p-6 space-y-10">
        {loading && (
          <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">Loading content from serverâ€¦</p>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
            Error: {error}
          </div>
        )}

        {/* Guidelines */}
        <section id="guidelines">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="mb-4 text-xl font-bold text-[#1b5e20]">Relocation Guidelines</h2>
            {guidelines ? (
              <>
                <div className="text-sm text-gray-500 mb-2">Version: {guidelines.version ?? "-"} Â· Last updated: {fmtDate(guidelines.lastUpdated)}</div>
                {guidelines.title && <h3 className="text-lg font-semibold">{guidelines.title}</h3>}
                {guidelines.content && <p className="text-gray-700 whitespace-pre-line">{guidelines.content}</p>}

                {Array.isArray(guidelines.sections) && guidelines.sections.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {guidelines.sections.map((s, idx) => (
                      <div key={idx} className="p-3 rounded border bg-gray-50">
                        {s.title && <div className="font-semibold">{s.title}</div>}
                        {s.content && <div className="text-gray-700 text-sm mt-1 whitespace-pre-line">{s.content}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* if API returns any attachments or pdf links show them */}
                {Array.isArray(guidelines.attachments) && guidelines.attachments.length > 0 && (
                  <div className="mt-4">
                    <strong>Attachments</strong>
                    <ul className="list-disc pl-6 mt-2 text-gray-700">
                      {guidelines.attachments.map((a, i) => (
                        <li key={i}><a href={a.url} target="_blank" rel="noreferrer" className="underline">{a.name ?? `Attachment ${i+1}`}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500">Guidelines are not available at the moment.</p>
            )}
          </div>
        </section>

        {/* About */}
        <section id="about">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="mb-4 text-xl font-bold text-[#1b5e20]">About Us</h2>
            {aboutUs ? (
              <div className="space-y-3 text-gray-700">
                <div className="text-sm text-gray-500">Last updated: {fmtDate(aboutUs.lastUpdated)}</div>
                {aboutUs.organizationName && <h3 className="text-lg font-semibold">{aboutUs.organizationName}</h3>}
                {aboutUs.history && <p className="whitespace-pre-line">{aboutUs.history}</p>}
                {aboutUs.mission && <p><strong>Mission:</strong> {aboutUs.mission}</p>}
                {aboutUs.vision && <p><strong>Vision:</strong> {aboutUs.vision}</p>}

                {Array.isArray(aboutUs.achievements) && aboutUs.achievements.length > 0 && (
                  <div>
                    <strong>Achievements</strong>
                    <ul className="list-disc pl-6 mt-2 text-gray-700">
                      {aboutUs.achievements.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}

                {Array.isArray(aboutUs.team) && aboutUs.team.length > 0 && (
                  <div>
                    <strong>Team</strong>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {aboutUs.team.map((m, i) => (
                        <div key={i} className="p-3 border rounded bg-gray-50">
                          {m.photo && <img src={m.photo} alt={m.name} className="h-20 w-20 object-cover rounded-full mb-2" />}
                          <div className="font-medium">{m.name}</div>
                          <div className="text-sm text-gray-600">{m.designation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">About information is not available right now.</p>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <FaqSection faq={faq} />
        </section>

        {/* Contact */}
        <ContactSection contact={contact} />
      </main>

      {/* Footer */}
      <Footer contact={contact} />
    </div>
  );
}
