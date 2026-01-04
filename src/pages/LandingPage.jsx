// src/pages/LandingPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { API_BASE } from "../config/Api.js";

/*
  Landing page — header fixed to top, hero image fills remaining viewport (not covered by header).
  Sections:
    - Slideshow hero
    - About (/about-us)
    - Guidelines (/guidelines)
    - FAQ (/faq)
    - Contact (/contact-us)
    - Privacy Policy (/privacy-policy)
*/

function ChevronLeftIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRightIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

/* Small utility to render HTML answers while removing duplicate images with same src */
function AnswerRenderer({ html }) {
  const processed = useMemo(() => {
    if (!html) return "";
    // Use DOMParser (runs in browser) to safely manipulate the fragment
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const seen = new Set();
      const imgs = doc.querySelectorAll("img");
      imgs.forEach((img) => {
        const src = img.getAttribute("src") || img.getAttribute("data-src") || img.src || "";
        if (!src) {
          // If image has no src, remove it
          img.remove();
          return;
        }
        if (seen.has(src)) {
          img.remove(); // remove duplicate image with same src
        } else {
          seen.add(src);
          // force responsive utilities & friendly styling
          const prev = img.getAttribute("class") || "";
          img.setAttribute(
            "class",
            `${prev} max-w-full h-auto rounded-md shadow-sm border border-gray-100 block my-3`.trim()
          );
          // ensure alt exists
          if (!img.getAttribute("alt")) img.setAttribute("alt", "");
        }
      });

      // Optionally, make iframes responsive (wrap)
      const iframes = doc.querySelectorAll("iframe");
      iframes.forEach((frame) => {
        const wrapper = doc.createElement("div");
        wrapper.setAttribute("class", "iframe-wrap my-4");
        frame.replaceWith(wrapper);
        wrapper.appendChild(frame);
      });

      // Return processed innerHTML
      return doc.body.innerHTML;
    } catch (e) {
      // fallback: return original string (will still be displayed)
      return html;
    }
  }, [html]);

  return <div className="prose max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: processed }} />;
}

/* Slideshow (slightly restyled) */
function Slideshow({ slides = [], intervalMs = 4000, className = "", showControlsOnHover = true }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (!slides || slides.length < 2) return;
    const id = setInterval(() => {
      if (!hovering) setCurrentIndex((p) => (p + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [slides, hovering, intervalMs]);

  if (!slides || slides.length === 0) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-100 text-gray-500`}
        style={{ height: "calc(100vh - 64px)" }}
      >
        No slides
      </div>
    );
  }

  const showControls = showControlsOnHover ? hovering : true;
  const heroStyle = { height: "calc(100vh - 64px)" };

  return (
    <div
      className={`${className} relative overflow-hidden`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={heroStyle}
    >
      {/* slide strip */}
      <div
        className="w-full h-full flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div key={i} className="w-full h-full flex-shrink-0 relative">
            <img src={s.src} alt={s.alt ?? `slide-${i + 1}`} className="w-full h-full object-cover" draggable={false} />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"
              aria-hidden
            />
            {s.caption && (
              <div className="absolute left-6 bottom-8 md:left-12 md:bottom-12 rounded px-4 py-3 text-white max-w-xl backdrop-blur-sm bg-black/30">
                <h3 className="text-lg md:text-3xl font-extrabold tracking-wide">{s.caption.title}</h3>
                {s.caption.subtitle && <p className="text-sm md:text-base mt-1 opacity-90">{s.caption.subtitle}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* controls */}
      {showControls && (
        <>
          <button
            onClick={() => setCurrentIndex((p) => (p - 1 + slides.length) % slides.length)}
            aria-label="Previous"
            className="absolute top-1/2 left-4 -translate-y-1/2 bg-black/30 text-white rounded-full p-3 z-30 hover:scale-105 transition-transform"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={() => setCurrentIndex((p) => (p + 1) % slides.length)}
            aria-label="Next"
            className="absolute top-1/2 right-4 -translate-y-1/2 bg-black/30 text-white rounded-full p-3 z-30 hover:scale-105 transition-transform"
          >
            <ChevronRightIcon />
          </button>
        </>
      )}

      {/* indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`w-3 h-3 rounded-full ${i === currentIndex ? "bg-white" : "bg-gray-400/60"}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* About section */
function AboutSection() {
  const [data, setData] = useState({ title: "", content: "", image: null, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadAbout() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/about-us`, { signal: controller.signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to fetch About: ${res.status} ${res.statusText} ${txt ? `- ${txt}` : ""}`);
        }
        const json = await res.json();
        const result = json?.result ?? {};
        if (mounted) {
          setData({
            title: result.title || "About",
            content: result.content || "",
            image: result.image || null,
            updatedAt: result.updatedAt || null,
          });
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load About");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAbout();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <section id="about" className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-800">{data.title}</h2>
        {data.updatedAt && <div className="text-sm text-gray-500">Updated: {data.updatedAt}</div>}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-emerald-50 overflow-hidden p-6">
        {loading ? (
          <div className="text-gray-600">Loading about information…</div>
        ) : error ? (
          <div className="text-red-600">Error loading about information: {error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {data.image && (
              <div className="md:col-span-1 flex items-center justify-center">
                <img src={data.image} alt={data.title || "About image"} className="max-h-56 w-full object-cover rounded-lg shadow-sm" />
              </div>
            )}

            <div className={`md:col-span-2 ${data.image ? "" : "md:col-span-3"}`}>
              <div className="prose max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: data.content }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* Guidelines component */
function GuidelinesSection() {
  const [points, setPoints] = useState([]);
  const [pdfLink, setPdfLink] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadGuidelines() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/guidelines`, { signal: controller.signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to fetch guidelines: ${res.status} ${res.statusText} ${txt ? `- ${txt}` : ""}`);
        }
        const json = await res.json();
        const result = json?.result ?? {};
        if (mounted) {
          setPdfLink(result.pdfLink || null);
          setPoints(Array.isArray(result.points) ? result.points : []);
          setUpdatedAt(result.updatedAt || null);
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load guidelines");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadGuidelines();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <section id="guidelines" className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-800">Guidelines</h2>
        {updatedAt && <div className="text-sm text-gray-500">Updated: {updatedAt}</div>}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-emerald-50 overflow-hidden p-6">
        {loading ? (
          <div className="text-gray-600">Loading guidelines…</div>
        ) : error ? (
          <div className="text-red-600">Error loading guidelines: {error}</div>
        ) : (
          <div className="space-y-4">
            {pdfLink && (
              <div>
                <a
                  href={pdfLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-800 text-white text-sm hover:bg-emerald-700 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path d="M12 3v12" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 7h8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 21H3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  View Guidelines (PDF)
                </a>
              </div>
            )}

            {points && points.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                {points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            ) : (
              <div className="text-gray-600">No guideline points available.</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* FAQ component — uses AnswerRenderer to avoid duplicate images */
function FAQSection() {
  const [items, setItems] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadFaq() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/faq`, { signal: controller.signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to fetch FAQs: ${res.status} ${res.statusText} ${txt ? `- ${txt}` : ""}`);
        }
        const json = await res.json();
        const result = json?.result ?? {};
        if (mounted) {
          setItems(Array.isArray(result.items) ? result.items : []);
          setUpdatedAt(result.updatedAt || null);
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load FAQs");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFaq();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <section id="faqs" className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-800">Frequently Asked Questions</h2>
        {updatedAt && <div className="text-sm text-gray-500">Updated: {updatedAt}</div>}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-emerald-50 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading FAQs…</div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">Error loading FAQs: {error}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No FAQs available at the moment.</div>
        ) : (
          <div className="divide-y">
            {items.map((it, idx) => (
              <details
                key={idx}
                className="group"
                role="listitem"
                style={{ willChange: "transform, opacity" }}
              >
                <summary className="cursor-pointer select-none list-none px-6 py-4 md:px-8 md:py-6 flex items-center justify-between">
                  <div className="text-left">
                    <div className="text-sm md:text-base font-medium text-gray-800">{it.question}</div>
                  </div>
                  <span className="ml-4 transform transition-transform duration-200 group-open:rotate-180" aria-hidden>
                    <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden>
                      <path d="M6 8l4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </summary>

                <div className="px-6 pb-6 md:px-8 md:pb-8 text-sm md:text-base text-gray-700">
                  {/* Use AnswerRenderer to remove duplicated images and style them */}
                  {typeof it.answer === "string" ? (
                    <AnswerRenderer html={it.answer} />
                  ) : (
                    <div className="text-gray-700">{String(it.answer)}</div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* Contact section */
function ContactSection() {
  const [data, setData] = useState({ address: "", email: "", phone: "", image: null, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadContact() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/contact-us`, { signal: controller.signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to fetch contact: ${res.status} ${res.statusText} ${txt ? `- ${txt}` : ""}`);
        }
        const json = await res.json();
        const result = json?.result ?? {};
        if (mounted) {
          setData({
            address: result.address || "",
            email: result.email || "",
            phone: result.phone || "",
            image: result.image || null,
            updatedAt: result.updatedAt || null,
          });
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load contact info");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadContact();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <section id="contact" className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-800">Contact Us</h2>
        {data.updatedAt && <div className="text-sm text-gray-500">Updated: {data.updatedAt}</div>}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-emerald-50 overflow-hidden p-6">
        {loading ? (
          <div className="text-gray-600">Loading contact information…</div>
        ) : error ? (
          <div className="text-red-600">Error loading contact information: {error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {data.image && (
              <div className="md:col-span-1 flex items-center justify-center">
                <img src={data.image} alt="Contact" className="max-h-48 w-full object-cover rounded-lg shadow-sm" />
              </div>
            )}

            <div className="md:col-span-2 space-y-3">
              {data.address && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Address</h3>
                  <div className="text-gray-800">{data.address}</div>
                </div>
              )}

              {data.email && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Email</h3>
                  <div>
                    <a href={`mailto:${data.email}`} className="text-emerald-700 hover:underline">{data.email}</a>
                  </div>
                </div>
              )}

              {data.phone && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Phone</h3>
                  <div>
                    <a href={`tel:${data.phone}`} className="text-emerald-700 hover:underline">{data.phone}</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* Privacy Policy section */
function PrivacySection() {
  const [data, setData] = useState({ title: "", content: "", updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadPrivacy() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/privacy-policy`, { signal: controller.signal });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Failed to fetch privacy policy: ${res.status} ${res.statusText} ${txt ? `- ${txt}` : ""}`);
        }
        const json = await res.json();
        const result = json?.result ?? {};
        if (mounted) {
          setData({
            title: result.title || "Privacy Policy",
            content: result.content || "",
            updatedAt: result.updatedAt || null,
          });
        }
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load privacy policy");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPrivacy();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <section id="privacy" className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-800">{data.title}</h2>
        {data.updatedAt && <div className="text-sm text-gray-500">Updated: {data.updatedAt}</div>}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-emerald-50 overflow-hidden p-6">
        {loading ? (
          <div className="text-gray-600">Loading privacy policy…</div>
        ) : error ? (
          <div className="text-red-600">Error loading privacy policy: {error}</div>
        ) : (
          <div className="prose max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: data.content }} />
        )}
      </div>
    </section>
  );
}

/* Inlined Footer component (adapted) */
function Footer() {
  return (
    <footer className="bg-[#064f3b] text-white mt-10">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Left column: logo + description */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/images/logo.png"
                alt="Village Relocation Authority logo"
                className="h-12 w-12 rounded-full border border-white/20"
              />
              <div>
                <div className="font-semibold">Forest Department</div>
                <div className="text-xs opacity-80">Wildlife Damage Compensation</div>
              </div>
            </div>

            <p className="text-sm text-white/85 max-w-sm">
              Providing support and compensation to communities affected by wildlife
              damage since 1995.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="/" className="hover:underline">Home</a></li>
              <li><a href="/login" className="hover:underline">Login</a></li>
              <li><a href="#guidelines" className="hover:underline">File a Complaint</a></li>
              <li><a href="#contact" className="hover:underline">Contact Us</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="#guidelines" className="hover:underline">Wildlife Protection Act</a></li>
              <li><a href="#guidelines" className="hover:underline">Compensation Guidelines</a></li>
              <li><a href="#about" className="hover:underline">Documentation Checklist</a></li>
              <li><a href="#faqs" className="hover:underline">Research Publications</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-white/90">
              <li><a href="#faqs" className="hover:underline">FAQ</a></li>
              <li><a href="#contact" className="hover:underline">Help Center</a></li>
              <li><a href="#contact" className="hover:underline">Emergency Contacts</a></li>
              <li><a href="#contact" className="hover:underline">Feedback</a></li>
            </ul>
          </div>
        </div>

        <hr className="my-6 border-white/10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-white/80">
            © {new Date().getFullYear()} Forest Department, Government of Chhattisgarh. All rights reserved.
          </div>

          <div className="flex items-center gap-4 text-sm text-white/80">
            <a href="#privacy" className="hover:underline">Privacy Policy</a>
            <a href="/terms" className="hover:underline">Terms of Use</a>
            <a href="/accessibility" className="hover:underline">Accessibility</a>
            <a href="/sitemap" className="hover:underline">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* Landing page (no login modal) */
export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const slides = [
    { src: "/images/Img1.jpg", alt: "Village landscape", caption: { title: "Sustainable Relocation", subtitle: "Planned, fair and transparent" } },
    { src: "/images/Img2.jpg", alt: "Community development", caption: { title: "Community First", subtitle: "People and livelihoods protected" } },
    { src: "/images/Img3.jpg", alt: "New homes", caption: { title: "Better Living", subtitle: "Infrastructure & services" } },
  ];

  return (
    <div className="bg-gradient-to-b from-[#fff8e1] to-white min-h-screen antialiased">
      {/* Header (fixed) */}
      <header className="fixed top-0 left-0 w-full h-16 bg-white/60 backdrop-blur-sm p-4 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-3 px-6">
          <img src="/images/logo.png" alt="logo" className="h-10 w-10 rounded shadow" />
          <div>
            <div className="text-lg font-bold text-[#1b5e20]">Village Relocation Authority</div>
            <div className="text-xs text-gray-700">Village Relocation Monitoring</div>
          </div>
        </div>

        <nav className="hidden md:flex gap-6 items-center mr-6">
          <a href="#guidelines" className="text-sm text-gray-700 hover:text-emerald-800 transition">Guidelines</a>
          <a href="#about" className="text-sm text-gray-700 hover:text-emerald-800 transition">About</a>
          <a href="#faqs" className="text-sm text-gray-700 hover:text-emerald-800 transition">FAQs</a>
          <a href="#contact" className="text-sm text-gray-700 hover:text-emerald-800 transition">Contact</a>
          <a href="#privacy" className="text-sm text-gray-700 hover:text-emerald-800 transition">Privacy</a>
        </nav>

        {/* mobile nav toggle (compact) */}
        <div className="md:hidden pr-4">
          <button
            onClick={() => setMobileNavOpen((s) => !s)}
            aria-expanded={mobileNavOpen}
            className="p-2 rounded bg-white/80 shadow"
          >
            <span className="sr-only">Toggle menu</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content — reserve header height with padding-top */}
      <main className="w-full pt-16">
        <div className="relative">
          <div className="relative z-10">
            <Slideshow className="w-full" slides={slides} intervalMs={4000} showControlsOnHover={true} />
          </div>
        </div>

        {/* Page sections */}
        <AboutSection />
        <GuidelinesSection />
        <FAQSection />
        <ContactSection />
        <PrivacySection />

        {/* Footer */}
        <Footer />
      </main>

      {/* Mobile floating nav (simple) */}
      {mobileNavOpen && (
        <div className="md:hidden fixed top-16 right-4 z-50 bg-white rounded-lg shadow-lg p-4 w-56">
          <nav className="flex flex-col gap-3">
            <a href="#guidelines" className="text-sm text-gray-700 hover:text-emerald-800">Guidelines</a>
            <a href="#about" className="text-sm text-gray-700 hover:text-emerald-800">About</a>
            <a href="#faqs" className="text-sm text-gray-700 hover:text-emerald-800">FAQs</a>
            <a href="#contact" className="text-sm text-gray-700 hover:text-emerald-800">Contact</a>
            <a href="#privacy" className="text-sm text-gray-700 hover:text-emerald-800">Privacy</a>
          </nav>
        </div>
      )}
    </div>
  );
}
