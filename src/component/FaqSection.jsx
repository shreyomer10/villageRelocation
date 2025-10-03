// src/components/FaqSection.jsx
import React, { useState } from "react";

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

export default function FaqSection({ faq }) {
  // Build a flat list of items: each item { id, question, answer, category }
  const items = [];

  if (faq) {
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

  // if no items, show some sensible defaults
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
        </div>

        <div className="mt-4">
          {/* white inner container */}
          <div className="bg-white rounded-lg p-4 md:p-6 space-y-3">
            {!hasItems ? (
              <div className="text-gray-600 p-6 text-center">
                No FAQs available at the moment.
              </div>
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
                      {it.category && (
                        <div className="text-xs text-emerald-800 font-semibold">{it.category}</div>
                      )}
                      <div className="text-sm md:text-base text-gray-800 font-medium">
                        {it.question}
                      </div>
                    </div>

                    <div className="flex items-center">
                      <Chevron open={openIndex === idx} />
                    </div>
                  </button>

                  {/* Panel */}
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
