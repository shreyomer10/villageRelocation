/**
 * AIChatWidget.jsx
 *
 * Floating AI assistant widget. Drop into the root layout:
 *
 *   import AIChatWidget from "./AIChatWidget";
 *   <AIChatWidget />
 *
 * Required packages: recharts
 * Required env: VITE_API_BASE
 */

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

const API_URL = import.meta.env.VITE_API_BASE;
const LOGO_URL = "/images/logo.png";

// Earthy/green chart palette aligned with the Maati brand.
const COLORS = [
  "#2F6F3E", "#4A8B3A", "#7BA866", "#C8A876",
  "#8C6A3F", "#1F4F2A", "#A9C99A", "#5B8E55",
];

// Suggestion chips shown before the user asks anything.
const SUGGESTIONS = [
  "Show family distribution by relocation option",
  "Which villages have the most families?",
  "What is the overall construction progress?",
  "Give me a village-wise progress table",
];

// Claude-style rotating "thinking" verbs — cycle one at a time during loading.
const THINKING_PHRASES = [
  "Pondering", "Ruminating", "Mulling", "Reflecting", "Contemplating",
  "Considering", "Reasoning", "Deliberating", "Weighing options",
  "Examining", "Investigating", "Analyzing", "Inspecting", "Studying",
  "Surveying", "Reviewing", "Scanning", "Combing", "Sifting",
  "Filtering", "Sorting", "Parsing", "Decoding", "Interpreting",
  "Untangling", "Unpacking", "Unraveling", "Dissecting",
  "Cross-referencing", "Connecting dots", "Mapping it out", "Charting",
  "Tabulating", "Aggregating", "Crunching numbers", "Computing",
  "Synthesizing", "Composing", "Drafting", "Outlining", "Sketching",
  "Assembling", "Stitching together", "Weaving", "Threading",
  "Sprouting ideas", "Cultivating thoughts", "Tending the query",
  "Sowing logic", "Harvesting facts", "Tilling the data",
  "Watering the roots", "Planting context", "Pruning noise",
  "Foraging for clues", "Mining the records", "Unearthing details",
  "Surfacing patterns", "Uncovering insight",
  "Brewing", "Marinating", "Steeping", "Simmering",
  "Distilling", "Refining", "Polishing", "Sharpening", "Tuning",
  "Tracing the thread", "Following leads", "Hunting context",
  "Tracking signals", "Trailing references", "Reading between lines",
  "Looking deeper", "Peering into data", "Squinting at patterns",
  "Drawing conclusions", "Forming the answer", "Shaping the reply",
  "Stacking facts", "Arranging pieces",
  "Almost there", "Wrapping up", "Tidying up", "Finishing touches",
];

// ── Sub-renderers ──────────────────────────────────────────────────────────────

function BarChartView({ data, xKey, bars }) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DCE5D5" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "#3F5544" }} />
        <YAxis tick={{ fontSize: 10, fill: "#3F5544" }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #BCCFB1" }} />
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
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #BCCFB1" }} />
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
            <tr key={i} style={{ background: i % 2 === 0 ? "#FBF8F0" : "#fff" }}>
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

// Claude-style rotating-verb loading indicator (compact for the widget).
function ThinkingIndicator() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * THINKING_PHRASES.length));
  const [elapsed, setElapsed] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const phraseTimer = setInterval(() => {
      setIdx((i) => (i + 1) % THINKING_PHRASES.length);
      setPulseKey((k) => k + 1);
    }, 1700);
    const tickTimer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(phraseTimer);
      clearInterval(tickTimer);
    };
  }, []);

  return (
    <div style={s.thinkingRow}>
      <span style={s.thinkingAvatar}>
        <img src={LOGO_URL} alt="" style={s.thinkingAvatarImg} />
      </span>
      <span style={s.thinkingBubble}>
        <span
          key={pulseKey}
          style={{ ...s.thinkingText, animation: "ai-phrase-fade 0.6s ease-out" }}
        >
          {THINKING_PHRASES[idx]}
          <span style={s.thinkingDots}>
            <span style={{ ...s.dot, animationDelay: "0s" }}>.</span>
            <span style={{ ...s.dot, animationDelay: "0.2s" }}>.</span>
            <span style={{ ...s.dot, animationDelay: "0.4s" }}>.</span>
          </span>
        </span>
        <span style={s.thinkingTime}>{elapsed}s</span>
      </span>
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
    if (result || error || loading) {
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [result, error, loading]);

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
      {/* ── FAB (platform logo) ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ ...s.fab, background: open ? "linear-gradient(135deg, #1F4F2A 0%, #2F6F3E 100%)" : "#FBF8F0" }}
        aria-label="Toggle AI Assistant"
        title="AI Assistant"
      >
        {open ? (
          <span style={s.fabClose}>✕</span>
        ) : (
          <img src={LOGO_URL} alt="Maati" style={s.fabLogo} />
        )}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      {open && (
        <div style={s.panel}>

          {/* Header */}
          <div style={s.header}>
            <div style={s.headerLeft}>
              <span style={s.headerLogoWrap}>
                <img src={LOGO_URL} alt="" style={s.headerLogo} />
              </span>
              <div>
                <span style={s.headerTitle}>Maati Assistant</span>
                <span style={s.headerSub}>Ask anything about relocation data</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => navigate("/chat")} style={s.headerBtn} title="Open Full Chat">
                Full Chat
              </button>
              {(result || error) && (
                <button onClick={handleReset} style={s.headerBtn} title="Ask another question">
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
            {loading && <ThinkingIndicator />}

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
            <div style={s.inputWrap}>
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
            </div>
          </form>

        </div>
      )}
    </>
  );
}

// ── Styles (earthy/green palette, plain JS objects) ────────────────────────────
const s = {
  fab: {
    position:       "fixed",
    bottom:         24,
    left:           24,
    zIndex:         9999,
    color:          "#fff",
    border:         "2px solid #2F6F3E",
    borderRadius:   "50%",
    width:          58,
    height:         58,
    cursor:         "pointer",
    boxShadow:      "0 6px 20px rgba(47,111,62,0.40), 0 0 0 4px rgba(169,201,154,0.35)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        0,
    overflow:       "hidden",
    transition:     "transform 0.15s, box-shadow 0.2s",
  },
  fabLogo: {
    width:    "70%",
    height:   "70%",
    objectFit: "contain",
    display:  "block",
  },
  fabClose: {
    fontSize:   18,
    fontWeight: 700,
    color:      "#fff",
  },
  panel: {
    position:       "fixed",
    bottom:         96,
    left:           24,
    zIndex:         9998,
    width:          420,
    maxWidth:       "calc(100vw - 48px)",
    maxHeight:      "72vh",
    background:     "#FBF8F0",
    borderRadius:   18,
    boxShadow:      "0 24px 64px rgba(31,79,42,0.18)",
    display:        "flex",
    flexDirection:  "column",
    overflow:       "hidden",
    border:         "1px solid #DCE5D5",
    fontFamily:     "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  header: {
    padding:        "12px 14px",
    background:     "linear-gradient(135deg, #2F6F3E 0%, #4A8B3A 100%)",
    color:          "#fff",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            8,
  },
  headerLeft: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
    minWidth:   0,
  },
  headerLogoWrap: {
    width:          34,
    height:         34,
    borderRadius:   "50%",
    background:     "#FBF8F0",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    border:         "1.5px solid rgba(255,255,255,0.55)",
    overflow:       "hidden",
  },
  headerLogo: {
    width:     "78%",
    height:    "78%",
    objectFit: "contain",
    display:   "block",
  },
  headerTitle: {
    fontSize:    14,
    fontWeight:  700,
    display:     "block",
    lineHeight:  1.2,
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize:  11,
    opacity:   0.85,
    display:   "block",
    marginTop: 2,
  },
  headerBtn: {
    background:   "rgba(255,255,255,0.18)",
    border:       "1px solid rgba(255,255,255,0.35)",
    color:        "#fff",
    borderRadius: 16,
    padding:      "4px 10px",
    fontSize:     11,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    fontWeight:   500,
  },
  body: {
    flex:       1,
    overflowY:  "auto",
    padding:    "14px 16px",
    minHeight:  100,
    background: "linear-gradient(180deg, #F7F4EC 0%, #F1ECDD 100%)",
  },
  idleText: {
    fontSize:     12,
    fontWeight:   600,
    color:        "#3F5544",
    margin:       "0 0 8px",
  },
  chips: {
    display:       "flex",
    flexDirection: "column",
    gap:           6,
  },
  chip: {
    background:   "#EEF5E8",
    border:       "1px solid #BCCFB1",
    borderRadius: 10,
    padding:      "8px 12px",
    fontSize:     12,
    color:        "#1F4F2A",
    cursor:       "pointer",
    textAlign:    "left",
    lineHeight:   1.4,
    fontWeight:   500,
    transition:   "background 0.15s",
  },
  thinkingRow: {
    display:    "flex",
    alignItems: "flex-start",
    gap:        8,
    padding:    "6px 0",
  },
  thinkingAvatar: {
    width:          28,
    height:         28,
    borderRadius:   "50%",
    background:     "#fff",
    border:         "1px solid #BCCFB1",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    marginTop:      1,
    boxShadow:      "0 0 0 0 rgba(47,111,62,0.4)",
    animation:      "ai-leaf-pulse 1.6s ease-in-out infinite",
    overflow:       "hidden",
  },
  thinkingAvatarImg: {
    width:     "78%",
    height:    "78%",
    objectFit: "contain",
    display:   "block",
  },
  thinkingBubble: {
    background:    "#fff",
    border:        "1px solid #DCE5D5",
    borderRadius:  "14px 14px 14px 4px",
    padding:       "8px 12px",
    display:       "inline-flex",
    alignItems:    "center",
    gap:           8,
    fontSize:      12,
    color:         "#3F5544",
    boxShadow:     "0 1px 3px rgba(31,79,42,0.06)",
  },
  thinkingText: {
    fontWeight:    500,
    color:         "#2F6F3E",
    fontStyle:     "italic",
    display:       "inline-flex",
    alignItems:    "baseline",
  },
  thinkingDots: {
    display:    "inline-flex",
    marginLeft: 1,
  },
  dot: {
    animation: "ai-dot-bounce 1s ease-in-out infinite",
    color:     "#2F6F3E",
  },
  thinkingTime: {
    fontSize:           10,
    color:              "#9AAB9D",
    fontVariantNumeric: "tabular-nums",
    paddingLeft:        6,
    borderLeft:         "1px solid #E5EFDF",
  },
  errorBox: {
    background:   "#FCEEE8",
    color:        "#B5462C",
    padding:      "10px 14px",
    borderRadius: 10,
    fontSize:     12,
    border:       "1px solid #F2C9B8",
    lineHeight:   1.5,
  },
  resultBox: {
    fontSize:     12,
    background:   "#fff",
    border:       "1px solid #DCE5D5",
    borderRadius: 12,
    padding:      12,
    boxShadow:    "0 1px 3px rgba(31,79,42,0.05)",
  },
  chartTitle: {
    fontWeight:   600,
    fontSize:     13,
    color:        "#1F4F2A",
    margin:       "0 0 10px",
    lineHeight:   1.3,
  },
  summary: {
    fontSize:     12,
    color:        "#2C3E2F",
    lineHeight:   1.65,
    margin:       "10px 0 0",
    padding:      "9px 13px",
    background:   "#EEF5E8",
    borderRadius: 9,
    borderLeft:   "3px solid #2F6F3E",
    fontStyle:    "italic",
  },
  tableWrapper: {
    overflowX:    "auto",
    borderRadius: 9,
    border:       "1px solid #DCE5D5",
  },
  table: {
    width:           "100%",
    borderCollapse:  "collapse",
    fontSize:        11,
  },
  th: {
    background:    "#E5EFDF",
    padding:       "8px 10px",
    textAlign:     "left",
    fontWeight:    600,
    color:         "#1F4F2A",
    borderBottom:  "1px solid #BCCFB1",
    whiteSpace:    "nowrap",
  },
  td: {
    padding:       "7px 10px",
    color:         "#3F5544",
    borderBottom:  "1px solid #EEF2EA",
  },
  form: {
    padding:     "10px 14px 14px",
    borderTop:   "1px solid #DCE5D5",
    background:  "#FBF8F0",
  },
  inputWrap: {
    display:      "flex",
    alignItems:   "center",
    gap:          6,
    background:   "#fff",
    border:       "1.5px solid #BCCFB1",
    borderRadius: 24,
    padding:      "3px 4px 3px 14px",
    boxShadow:    "0 1px 3px rgba(31,79,42,0.05)",
  },
  input: {
    flex:         1,
    padding:      "8px 4px",
    border:       "none",
    outline:      "none",
    fontSize:     13,
    color:        "#1F2E22",
    background:   "transparent",
    minWidth:     0,
  },
  sendBtn: {
    width:          34,
    height:         34,
    borderRadius:   "50%",
    background:     "linear-gradient(135deg, #2F6F3E 0%, #4A8B3A 100%)",
    color:          "#fff",
    border:         "none",
    fontSize:       16,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    boxShadow:      "0 2px 6px rgba(47,111,62,0.25)",
  },
};

// Inject keyframes once.
if (typeof document !== "undefined" && !document.getElementById("ai-widget-style")) {
  const style = document.createElement("style");
  style.id = "ai-widget-style";
  style.textContent = `
    @keyframes ai-spin { to { transform: rotate(360deg); } }
    @keyframes ai-leaf-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(47,111,62,0.35); }
      70%  { box-shadow: 0 0 0 8px rgba(47,111,62,0); }
      100% { box-shadow: 0 0 0 0 rgba(47,111,62,0); }
    }
    @keyframes ai-phrase-fade {
      0%   { opacity: 0; transform: translateY(2px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes ai-dot-bounce {
      0%, 60%, 100% { opacity: 0.25; }
      30%           { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}
