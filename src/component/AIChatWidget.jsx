/**
 * AIChatWidget.jsx
 *
 * Drop this file anywhere in your React/Vite frontend src/ folder.
 * Then import and render it inside your root layout (e.g. App.jsx):
 *
 *   import AIChatWidget from "./AIChatWidget";
 *   ...
 *   return (
 *     <>
 *       <YourExistingLayout />
 *       <AIChatWidget />
 *     </>
 *   );
 *
 * Required packages (install once in your frontend):
 *   npm install recharts
 *
 * Required .env variable (in your frontend .env file):
 *   VITE_API_URL=http://localhost:5000
 */

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

const API_URL = import.meta.env.VITE_API_BASE;

const COLORS = [
  "#4F46E5", "#7C3AED", "#2563EB", "#0891B2",
  "#059669", "#D97706", "#DC2626", "#9333EA",
];

// ── Suggestion chips shown before the user asks anything ──────────────────────
const SUGGESTIONS = [
  "Show family distribution by relocation option",
  "Which villages have the most families?",
  "What is the overall construction progress?",
  "Give me a village-wise progress table",
];

// ── Sub-renderers ──────────────────────────────────────────────────────────────

function BarChartView({ data, xKey, bars }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label || b.key}
            fill={b.color || COLORS[i % COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={72}
          label={({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TableView({ columns, rows }) {
  return (
    <div style={s.tableWrapper}>
      <table style={s.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={s.th}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#F9FAFB" : "#fff" }}>
              {columns.map((col) => (
                <td key={col.key} style={s.td}>{row[col.key] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResponseRenderer({ result }) {
  if (!result) return null;
  const { type, title, summary, data, xKey, bars, columns, rows } = result;

  return (
    <div style={s.resultBox}>
      {title && <p style={s.chartTitle}>{title}</p>}

      {type === "bar_chart" && data?.length > 0 && (
        <BarChartView
          data={data}
          xKey={xKey || "name"}
          bars={bars?.length ? bars : [{ key: "value", color: COLORS[0], label: "Count" }]}
        />
      )}

      {type === "pie_chart" && data?.length > 0 && (
        <PieChartView data={data} />
      )}

      {type === "table" && columns?.length > 0 && rows?.length > 0 && (
        <TableView columns={columns} rows={rows} />
      )}

      {summary && (
        <p style={s.summary}>{summary}</p>
      )}
    </div>
  );
}

// ── Main widget ────────────────────────────────────────────────────────────────

export default function AIChatWidget() {
  const navigate = useNavigate();
  const [open,    setOpen]    = useState(false);
  const [prompt,  setPrompt]  = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const inputRef = useRef(null);
  const bodyRef  = useRef(null);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Scroll to bottom when new content arrives
  useEffect(() => {
    if (result || error) {
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [result, error]);

  async function sendPrompt(text) {
    if (!text.trim() || loading) return;
    setPrompt(text);
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res  = await fetch(`${API_URL}/ai/chat`, {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body:        JSON.stringify({ messages: [{ role: "user", content: text.trim() }] }),
      });
      const json = await res.json();
      if (json.error) setError(json.message || "Something went wrong.");
      else            setResult(json.final);
    } catch {
      setError("Could not reach the AI service. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendPrompt(prompt);
  }

  function handleSuggestion(text) {
    sendPrompt(text);
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setPrompt("");
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={s.fab}
        aria-label="Toggle AI Assistant"
        title="AI Assistant"

      >
        {open ? "✕" : "✦ AI"}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      {open && (
        <div style={s.panel}>

          {/* Header */}
          <div style={s.header}>
            <div>
              <span style={s.headerTitle}>✦ AI Assistant</span>
              <span style={s.headerSub}>Ask anything about relocation data</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => navigate("/chat")} style={s.fullChatBtn} title="Open Full Chat">
                Full Chat
              </button>
              {(result || error) && (
                <button onClick={handleReset} style={s.resetBtn} title="Ask another question">
                  ↩ New
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div ref={bodyRef} style={s.body}>

            {/* Idle state — show suggestion chips */}
            {!result && !loading && !error && (
              <div>
                <p style={s.idleText}>Try asking:</p>
                <div style={s.chips}>
                  {SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      onClick={() => handleSuggestion(sug)}
                      style={s.chip}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={s.loadingRow}>
                <span style={s.spinner} />
                <span style={{ fontSize: 12, color: "#6B7280" }}>
                  Fetching data&hellip;
                </span>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div style={s.errorBox}>{error}</div>
            )}

            {/* Result */}
            {result && !loading && (
              <ResponseRenderer result={result} />
            )}
          </div>

          {/* Input bar */}
          <form onSubmit={handleSubmit} style={s.form}>
            <input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask a question about the data…"
              style={s.input}
              disabled={loading}
            />
            <button
              type="submit"
              style={{
                ...s.sendBtn,
                opacity: loading || !prompt.trim() ? 0.45 : 1,
                cursor:  loading || !prompt.trim() ? "not-allowed" : "pointer",
              }}
              disabled={loading || !prompt.trim()}
            >
              ↑
            </button>
          </form>

        </div>
      )}
    </>
  );
}

// ── Styles (plain JS objects — no Tailwind required) ───────────────────────────
const s = {
  fab: {
    position:       "fixed",
    bottom:         24,
    left:           24,
    zIndex:         9999,
    background:     "linear-gradient(135deg, #4F46E5, #7C3AED)",
    color:          "#fff",
    border:         "none",
    borderRadius:   50,
    width:          58,
    height:         58,
    fontSize:       16,
    fontWeight:     700,
    letterSpacing:  0.5,
    cursor:         "pointer",
    boxShadow:      "0 4px 20px rgba(79,70,229,0.45)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    transition:     "transform 0.15s",
  },
  panel: {
    position:       "fixed",
    bottom:         96,
    left:           24,
    zIndex:         9998,
    width:          420,
    maxWidth:       "calc(100vw - 48px)",
    maxHeight:      "72vh",
    background:     "#fff",
    borderRadius:   18,
    boxShadow:      "0 24px 64px rgba(0,0,0,0.14)",
    display:        "flex",
    flexDirection:  "column",
    overflow:       "hidden",
    border:         "1px solid #E5E7EB",
  },
  header: {
    padding:        "14px 18px 12px",
    background:     "linear-gradient(135deg, #4F46E5, #7C3AED)",
    color:          "#fff",
    display:        "flex",
    alignItems:     "flex-start",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize:    15,
    fontWeight:  700,
    display:     "block",
    lineHeight:  1.2,
  },
  headerSub: {
    fontSize:  11,
    opacity:   0.82,
    display:   "block",
    marginTop: 3,
  },
  resetBtn: {
    background:   "rgba(255,255,255,0.18)",
    border:       "1px solid rgba(255,255,255,0.35)",
    color:        "#fff",
    borderRadius: 20,
    padding:      "4px 10px",
    fontSize:     11,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    marginTop:    2,
  },
  fullChatBtn: {
    background:   "rgba(255,255,255,0.18)",
    border:       "1px solid rgba(255,255,255,0.35)",
    color:        "#fff",
    borderRadius: 20,
    padding:      "4px 10px",
    fontSize:     11,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    marginTop:    2,
  },
  body: {
    flex:       1,
    overflowY:  "auto",
    padding:    "14px 16px",
    minHeight:  100,
  },
  idleText: {
    fontSize:     12,
    fontWeight:   600,
    color:        "#6B7280",
    marginBottom: 8,
    margin:       "0 0 8px",
  },
  chips: {
    display:       "flex",
    flexDirection: "column",
    gap:           6,
  },
  chip: {
    background:   "#F5F3FF",
    border:       "1px solid #DDD6FE",
    borderRadius: 10,
    padding:      "7px 12px",
    fontSize:     12,
    color:        "#4F46E5",
    cursor:       "pointer",
    textAlign:    "left",
    lineHeight:   1.4,
  },
  loadingRow: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
    padding:    "14px 0",
  },
  spinner: {
    width:          14,
    height:         14,
    border:         "2px solid #E5E7EB",
    borderTop:      "2px solid #4F46E5",
    borderRadius:   "50%",
    display:        "inline-block",
    animation:      "ai-spin 0.8s linear infinite",
  },
  errorBox: {
    background:   "#FEF2F2",
    color:        "#DC2626",
    padding:      "10px 14px",
    borderRadius: 10,
    fontSize:     12,
    border:       "1px solid #FECACA",
    lineHeight:   1.5,
  },
  resultBox: {
    fontSize: 12,
  },
  chartTitle: {
    fontWeight:   600,
    fontSize:     13,
    color:        "#111827",
    margin:       "0 0 10px",
    lineHeight:   1.3,
  },
  summary: {
    fontSize:     12,
    color:        "#374151",
    lineHeight:   1.65,
    margin:       "10px 0 0",
    padding:      "9px 13px",
    background:   "#F5F3FF",
    borderRadius: 9,
    borderLeft:   "3px solid #4F46E5",
  },
  tableWrapper: {
    overflowX:    "auto",
    borderRadius: 9,
    border:       "1px solid #E5E7EB",
  },
  table: {
    width:           "100%",
    borderCollapse:  "collapse",
    fontSize:        11,
  },
  th: {
    background:    "#F3F4F6",
    padding:       "8px 10px",
    textAlign:     "left",
    fontWeight:    600,
    color:         "#374151",
    borderBottom:  "1px solid #E5E7EB",
    whiteSpace:    "nowrap",
  },
  td: {
    padding:       "7px 10px",
    color:         "#4B5563",
    borderBottom:  "1px solid #F3F4F6",
  },
  form: {
    display:     "flex",
    gap:         8,
    padding:     "10px 14px 14px",
    borderTop:   "1px solid #F3F4F6",
    background:  "#fff",
  },
  input: {
    flex:         1,
    padding:      "9px 14px",
    borderRadius: 24,
    border:       "1.5px solid #E5E7EB",
    fontSize:     13,
    outline:      "none",
    color:        "#111827",
    background:   "#F9FAFB",
    minWidth:     0,
  },
  sendBtn: {
    width:          36,
    height:         36,
    borderRadius:   "50%",
    background:     "#4F46E5",
    color:          "#fff",
    border:         "none",
    fontSize:       17,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
};

// Inject spinner keyframe once (avoids a CSS file dependency)
if (typeof document !== "undefined" && !document.getElementById("ai-widget-style")) {
  const style = document.createElement("style");
  style.id = "ai-widget-style";
  style.textContent = `@keyframes ai-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
