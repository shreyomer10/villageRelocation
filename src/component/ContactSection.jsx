// src/components/ContactSection.jsx
import React from "react";

/**
 * Props:
 *  - contact: object (the same structure you fetch in LandingPage)
 *
 * Example contact shape (what your LandingPage already sets):
 * {
 *   emergencyContact: { description, number },
 *   headquarters: { address, email, phone, fax },
 *   regionalOffices: [{ region, address, email, phone }, ...],
 *   socialMedia: { website, facebook, twitter },
 *   workingHours: "Mon-Fri: 10:00 - 17:30"
 * }
 */

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

export default function ContactSection({ contact }) {
  const fallback = {
    emergencyContact: null,
    headquarters: null,
    regionalOffices: [],
    workingHours: "",
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
            <p className="text-sm text-white/90 mb-6 max-w-prose">
              Our dedicated support team is here to help with your wildlife damage
              compensation inquiries and claims.
            </p>

            <div className="space-y-5">
              {/* Helpline */}
              {c.emergencyContact && (
                <div className="flex gap-4">
                  <div className="pt-1 text-emerald-100">
                    <IconPhone />
                  </div>
                  <div>
                    <div className="font-medium">Helpline</div>
                    <div className="text-sm text-white/90">
                      {c.emergencyContact.description ?? ""}
                    </div>
                    <div className="text-sm mt-1">
                      <a href={`tel:${c.emergencyContact.number}`} className="underline">
                        {c.emergencyContact.number}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Email */}
              {c.headquarters?.email || c.headquarters?.email2 ? (
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
              ) : null}

              {/* Head Office */}
              {c.headquarters && (
                <div className="flex gap-4">
                  <div className="pt-1 text-emerald-100">
                    <IconPin />
                  </div>
                  <div>
                    <div className="font-medium">Head Office</div>
                    <div className="text-sm text-white/90 mt-1 whitespace-pre-line">
                      {c.headquarters.address ?? "-"}
                    </div>
                    {c.headquarters.phone && (
                      <div className="text-sm mt-2">
                        Phone: <a href={`tel:${c.headquarters.phone}`} className="underline">{c.headquarters.phone}</a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Office Hours */}
              {c.workingHours && (
                <div className="flex gap-4">
                  <div className="pt-1 text-emerald-100">
                    <IconClock />
                  </div>
                  <div>
                    <div className="font-medium">Office Hours</div>
                    <div className="text-sm text-white/90 mt-1">
                      {c.workingHours}
                    </div>
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
                    <div className="text-sm font-semibold text-emerald-800 mb-1">
                      {r.region ?? "Region"}
                    </div>
                    <div className="text-sm text-gray-700">
                      {r.address ?? ""}
                    </div>
                    {r.phone && (
                      <div className="text-sm text-gray-600 mt-1">
                        Phone: <a href={`tel:${r.phone}`} className="underline">{r.phone}</a>
                      </div>
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
