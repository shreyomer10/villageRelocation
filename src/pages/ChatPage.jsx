// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef } from "react";
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

// Claude-style rotating "thinking" verbs — cycle one at a time during loading.
const THINKING_PHRASES = [
  "Pondering", "Ruminating", "Mulling", "Reflecting", "Contemplating",
  "Considering", "Reasoning", "Deliberating", "Thinking it over", "Weighing options",
  "Examining", "Investigating", "Analyzing", "Inspecting", "Studying",
  "Surveying", "Reviewing", "Scanning", "Combing", "Sifting",
  "Filtering", "Sorting", "Parsing", "Decoding", "Interpreting",
  "Untangling", "Unpacking", "Unraveling", "Dissecting", "Picking apart",
  "Cross-referencing", "Connecting dots", "Mapping it out", "Charting", "Plotting",
  "Tabulating", "Aggregating", "Crunching numbers", "Computing", "Calculating",
  "Synthesizing", "Composing", "Drafting", "Outlining", "Sketching",
  "Assembling", "Stitching together", "Weaving", "Threading", "Braiding",
  "Sprouting ideas", "Cultivating thoughts", "Tending the query", "Sowing logic", "Harvesting facts",
  "Tilling the data", "Watering the roots", "Planting context", "Pruning noise", "Gathering grains",
  "Foraging for clues", "Mining the records", "Unearthing details", "Surfacing patterns", "Uncovering insight",
  "Brewing", "Marinating", "Steeping", "Simmering", "Letting it brew",
  "Distilling", "Refining", "Polishing", "Sharpening", "Tuning",
  "Tracing the thread", "Following leads", "Hunting context", "Tracking signals", "Trailing references",
  "Reading between lines", "Listening closely", "Looking deeper", "Peering into data", "Squinting at patterns",
  "Drawing conclusions", "Forming the answer", "Shaping the reply", "Stacking facts", "Arranging pieces",
  "Almost there", "Wrapping up", "Tidying up", "Finishing touches",
];

// ── Sub-renderers ────────────────────────────────────────────────────────

function BarChartView({ data, xKey, bars }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DCE5D5" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "#3F5544" }} />
        <YAxis tick={{ fontSize: 12, fill: "#3F5544" }} allowDecimals={false} />
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
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
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

// Backend persists assistant messages as raw model output (a JSON string like
// '{"final":{...}}'), while live responses arrive as already-parsed objects.
function parseAssistantContent(content) {
  if (content && typeof content === "object") {
    return { kind: "result", value: content };
  }
  if (typeof content !== "string") {
    return { kind: "text", value: "" };
  }

  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence) text = fence[1].trim();

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      if (parsed.final) return { kind: "result", value: parsed.final };
      if (parsed.action) return { kind: "skip" };
      return { kind: "result", value: parsed };
    }
  } catch {
    // not JSON — fall through to plain-text rendering
  }
  return { kind: "text", value: content };
}

function isInternalUserMessage(msg) {
  return (
    msg.role === "user" &&
    typeof msg.content === "string" &&
    /^Tool '[^']+' returned:/.test(msg.content)
  );
}

// Maati platform logo. `spin` adds a gentle sway used by the loading mascot.
function LeafIcon({ size = 18, spin = false }) {
  return (
    <img
      src={LOGO_URL}
      alt="Maati"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        animation: spin ? "leaf-sway 2.4s ease-in-out infinite" : undefined,
      }}
    />
  );
}

function Message({ msg, onShowTrace }) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div style={{ ...s.message, ...s.userMessage }}>
        <div style={s.userBubble}>
          <p style={s.userText}>{msg.content}</p>
        </div>
      </div>
    );
  }

  const parsed = parseAssistantContent(msg.content);
  if (parsed.kind === "skip") return null;

  const hasTrace = Array.isArray(msg.trace) && msg.trace.length > 0;

  return (
    <div style={{ ...s.message, ...s.assistantMessage }}>
      <div style={s.assistantAvatar}>
        <LeafIcon size={16} />
      </div>
      <div style={s.assistantBubble}>
        {parsed.kind === "result" ? (
          <ResponseRenderer result={parsed.value} />
        ) : (
          <p style={s.assistantText}>{parsed.value}</p>
        )}
        {hasTrace && (
          <button
            type="button"
            onClick={() => onShowTrace(msg.trace)}
            style={s.traceBtn}
            title="Show how the AI built this answer"
          >
            ⓘ Show traces ({msg.trace.length})
          </button>
        )}
      </div>
    </div>
  );
}

// Claude-style rotating-verb loading indicator.
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
      <div style={s.thinkingAvatar}>
        <LeafIcon size={16} spin />
      </div>
      <div style={s.thinkingBubble}>
        <span
          key={pulseKey}
          style={{ ...s.thinkingText, animation: "phrase-fade 0.6s ease-out" }}
        >
          {THINKING_PHRASES[idx]}
          <span style={s.thinkingDots}>
            <span style={{ ...s.dot, animationDelay: "0s" }}>.</span>
            <span style={{ ...s.dot, animationDelay: "0.2s" }}>.</span>
            <span style={{ ...s.dot, animationDelay: "0.4s" }}>.</span>
          </span>
        </span>
        <span style={s.thinkingTime}>{elapsed}s</span>
      </div>
    </div>
  );
}

function TraceDrawer({ trace, onClose }) {
  if (!trace) return null;
  return (
    <>
      <div style={s.drawerBackdrop} onClick={onClose} />
      <aside style={s.drawer}>
        <div style={s.drawerHeader}>
          <h3 style={s.drawerTitle}>Trace ({trace.length} step{trace.length === 1 ? "" : "s"})</h3>
          <button onClick={onClose} style={s.drawerCloseBtn}>×</button>
        </div>
        <div style={s.drawerBody}>
          {trace.map((entry, i) => {
            const outcome = entry.outcome || {};
            const ok = outcome.ok;
            const data = outcome.data || [];
            const preview = ok ? data.slice(0, 2) : null;
            return (
              <div key={i} style={s.traceEntry}>
                <div style={s.traceEntryHeader}>
                  <span style={s.traceIdx}>#{i + 1}</span>
                  <span style={s.traceIntent}>{entry.intent || "(no intent)"}</span>
                </div>

                <div style={s.traceField}>
                  <div style={s.traceFieldLabel}>Executed Mongo query</div>
                  <pre style={s.traceJson}>{JSON.stringify(entry.real, null, 2)}</pre>
                </div>

                <div style={s.traceField}>
                  <div style={s.traceFieldLabel}>Outcome</div>
                  {ok ? (
                    <div style={s.traceOutcomeOk}>ok — {data.length} doc{data.length === 1 ? "" : "s"}</div>
                  ) : (
                    <div style={s.traceOutcomeErr}>error — {outcome.error || "unknown"}</div>
                  )}
                  {preview && preview.length > 0 && (
                    <pre style={s.traceJsonSmall}>{JSON.stringify(preview, null, 2)}</pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTrace, setActiveTrace] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function fetchSessions() {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await fetch(`${API_URL}/ai/chat-sessions`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const detail = res.status === 401 || res.status === 403
          ? "You're not signed in — log in to see your previous chats."
          : `Server returned ${res.status}`;
        console.error("[ChatPage] fetchSessions HTTP error:", res.status);
        setSessionsError(detail);
        setSessions([]);
        return;
      }
      const json = await res.json();
      console.log("[ChatPage] fetchSessions response:", json);
      if (json.error) {
        setSessionsError(json.message || "Could not load chats.");
        setSessions([]);
      } else {
        setSessions(Array.isArray(json.result) ? json.result : []);
      }
    } catch (err) {
      console.error("[ChatPage] fetchSessions failed:", err);
      setSessionsError("Could not reach the server.");
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadSession(chatId) {
    try {
      const res = await fetch(`${API_URL}/ai/chat-sessions/${chatId}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json();
      if (json.error) {
        console.error(json.message);
      } else {
        const session = json.result;
        setCurrentSession(session);
        setMessages(session?.messages || []);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  }

  async function createNewChat() {
    try {
      const res = await fetch(`${API_URL}/ai/chat-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "New Chat" }),
      });
      const json = await res.json();
      if (json.error) {
        console.error(json.message);
      } else {
        setCurrentSession(json.result);
        setMessages([]);
        setSessions((prev) => [json.result, ...prev]);
      }
    } catch (err) {
      console.error("Failed to create new chat:", err);
    }
  }

  async function deleteSession(chatId) {
    try {
      const res = await fetch(`${API_URL}/ai/chat-sessions/${chatId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((sess) => sess.id !== chatId));
        if (currentSession && currentSession.id === chatId) {
          setCurrentSession(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }

  async function sendMessage() {
    if (!prompt.trim() || loading) return;

    const userMsg = { role: "user", content: prompt.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setPrompt("");
    setLoading(true);

    const isNewChat = !currentSession;

    try {
      const res = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: newMessages,
          chat_id: currentSession ? currentSession.id : null,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setMessages([...newMessages, { role: "assistant", content: { type: "text", summary: json.message } }]);
      } else {
        const assistantMsg = {
          role: "assistant",
          content: json.result,
          trace: json.result?.trace,
        };
        setMessages([...newMessages, assistantMsg]);

        if (json.result?.sessionId && isNewChat) {
          setCurrentSession({
            id: json.result.sessionId,
            title: json.result.sessionTitle || "New chat",
          });
          await fetchSessions();
        }
      }
    } catch (err) {
      setMessages([...newMessages, { role: "assistant", content: { type: "text", summary: "Could not reach the AI service." } }]);
    } finally {
      setLoading(false);
    }
  }

  const visibleMessages = messages.filter((msg) => !isInternalUserMessage(msg));
  const isEmpty = visibleMessages.length === 0 && !loading;

  return (
    <div style={s.container}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <div style={s.brandRow}>
              <LeafIcon size={20} />
              <h3 style={s.brandText}>Maati Chat</h3>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={fetchSessions}
                style={s.refreshBtn}
                title="Refresh chat list"
                disabled={sessionsLoading}
              >
                ↻
              </button>
              <button onClick={createNewChat} style={s.newChatBtn}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New
              </button>
            </div>
          </div>
          <div style={s.sessionList}>
            {sessionsLoading && (
              <p style={s.emptyHint}>Loading chats…</p>
            )}
            {!sessionsLoading && sessionsError && (
              <div style={s.sidebarError}>
                <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Couldn't load chats</p>
                <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5 }}>{sessionsError}</p>
                <button onClick={fetchSessions} style={s.retryBtn}>Retry</button>
              </div>
            )}
            {!sessionsLoading && !sessionsError && sessions.length === 0 && (
              <p style={s.emptyHint}>No previous chats yet — start one above.</p>
            )}
            {sessions.map((session) => {
              const active = currentSession && currentSession.id === session.id;
              return (
                <div
                  key={session.id}
                  style={{
                    ...s.sessionItem,
                    background: active ? "#E5EFDF" : "transparent",
                    borderLeft: active ? "3px solid #2F6F3E" : "3px solid transparent",
                  }}
                  onClick={() => loadSession(session.id)}
                >
                  <span style={s.sessionTitle}>{session.title || "Untitled Chat"}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                    style={s.deleteBtn}
                    title="Delete chat"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div style={s.main}>
        <div style={s.header}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={s.toggleSidebar} title="Toggle sidebar">
            ☰
          </button>
          <div style={s.headerTitleWrap}>
            <LeafIcon size={18} />
            <h2 style={s.headerTitle}>
              {currentSession ? (currentSession.title || "Chat") : "New Chat"}
            </h2>
          </div>
          <button onClick={() => navigate(-1)} style={s.backBtn}>← Back</button>
        </div>

        <div style={s.messages}>
          {isEmpty && (
            <div style={s.emptyState}>
              <div style={s.emptyLeaf}>
                <LeafIcon size={42} />
              </div>
              <h3 style={s.emptyTitle}>Ask anything about your village data</h3>
              <p style={s.emptySub}>
                Family distributions, construction progress, plot allocations — Maati will dig into the records.
              </p>
            </div>
          )}

          {visibleMessages.map((msg, i) => (
            <Message key={i} msg={msg} onShowTrace={setActiveTrace} />
          ))}

          {loading && <ThinkingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        <div style={s.inputArea}>
          <div style={s.inputWrap}>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask Maati anything…"
              style={s.input}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !prompt.trim()}
              style={{
                ...s.sendBtn,
                opacity: loading || !prompt.trim() ? 0.45 : 1,
                cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
              }}
              title="Send"
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      <TraceDrawer trace={activeTrace} onClose={() => setActiveTrace(null)} />
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────
// Earthy/green palette — warm cream backgrounds, deep-forest accents.
const s = {
  container: {
    display: "flex",
    height: "100vh",
    background: "linear-gradient(180deg, #F5F1E8 0%, #EFEBDD 100%)",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "#1F2E22",
  },
  sidebar: {
    width: "280px",
    background: "#FBF8F0",
    borderRight: "1px solid #DCE5D5",
    display: "flex",
    flexDirection: "column",
    boxShadow: "1px 0 0 rgba(47,111,62,0.04)",
  },
  sidebarHeader: {
    padding: "18px 18px 14px",
    borderBottom: "1px solid #E5EFDF",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandText: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "#1F4F2A",
    letterSpacing: 0.2,
  },
  newChatBtn: {
    background: "#2F6F3E",
    color: "#fff",
    border: "none",
    borderRadius: 18,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    boxShadow: "0 2px 6px rgba(47,111,62,0.25)",
  },
  refreshBtn: {
    background: "transparent",
    border: "1px solid #BCCFB1",
    color: "#2F6F3E",
    borderRadius: "50%",
    width: 26,
    height: 26,
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarError: {
    margin: "10px 14px",
    padding: "10px 12px",
    background: "#FCEEE8",
    border: "1px solid #F2C9B8",
    borderRadius: 8,
    color: "#B5462C",
    fontSize: 12,
  },
  retryBtn: {
    marginTop: 8,
    background: "#fff",
    border: "1px solid #B5462C",
    color: "#B5462C",
    borderRadius: 14,
    padding: "3px 10px",
    fontSize: 11,
    cursor: "pointer",
    fontWeight: 500,
  },
  sessionList: {
    flex: 1,
    overflowY: "auto",
    padding: "6px 0",
  },
  emptyHint: {
    padding: "12px 18px",
    fontSize: 12,
    color: "#7A8A7E",
    fontStyle: "italic",
    margin: 0,
  },
  sessionItem: {
    padding: "11px 16px 11px 13px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "background 0.15s",
    fontSize: 13,
  },
  sessionTitle: {
    flex: 1,
    color: "#2C3E2F",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    paddingRight: 6,
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    color: "#9AAB9D",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: "0 4px",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  header: {
    padding: "14px 22px",
    background: "#FBF8F0",
    borderBottom: "1px solid #DCE5D5",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  toggleSidebar: {
    background: "transparent",
    border: "none",
    fontSize: 20,
    cursor: "pointer",
    color: "#2F6F3E",
    padding: "2px 6px",
  },
  headerTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: "#1F4F2A",
  },
  backBtn: {
    marginLeft: "auto",
    background: "transparent",
    border: "1px solid #BCCFB1",
    borderRadius: 18,
    padding: "5px 12px",
    cursor: "pointer",
    color: "#2F6F3E",
    fontSize: 12,
    fontWeight: 500,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 22px 16px",
    background: "linear-gradient(180deg, #F7F4EC 0%, #F1ECDD 100%)",
  },
  emptyState: {
    maxWidth: 460,
    margin: "60px auto 0",
    textAlign: "center",
    padding: "32px 24px",
    background: "rgba(255,255,255,0.55)",
    border: "1px solid #DCE5D5",
    borderRadius: 18,
  },
  emptyLeaf: {
    display: "inline-flex",
    padding: 14,
    borderRadius: "50%",
    background: "#E5EFDF",
    marginBottom: 14,
  },
  emptyTitle: {
    margin: "0 0 8px",
    fontSize: 17,
    fontWeight: 600,
    color: "#1F4F2A",
  },
  emptySub: {
    margin: 0,
    fontSize: 13,
    color: "#5A6B5E",
    lineHeight: 1.55,
  },
  message: {
    marginBottom: 16,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  userMessage: {
    justifyContent: "flex-end",
  },
  assistantMessage: {
    justifyContent: "flex-start",
  },
  assistantAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "#E5EFDF",
    border: "1px solid #BCCFB1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  userBubble: {
    maxWidth: "70%",
    background: "linear-gradient(135deg, #2F6F3E 0%, #4A8B3A 100%)",
    color: "#fff",
    padding: "10px 15px",
    borderRadius: "16px 16px 4px 16px",
    boxShadow: "0 2px 8px rgba(47,111,62,0.18)",
  },
  userText: {
    margin: 0,
    color: "#fff",
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  assistantBubble: {
    maxWidth: "75%",
    background: "#fff",
    color: "#1F2E22",
    border: "1px solid #DCE5D5",
    borderRadius: "16px 16px 16px 4px",
    padding: "12px 16px",
    boxShadow: "0 1px 3px rgba(31,79,42,0.06)",
  },
  assistantText: {
    margin: 0,
    color: "#1F2E22",
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  thinkingRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  thinkingAvatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "#E5EFDF",
    border: "1px solid #BCCFB1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
    boxShadow: "0 0 0 0 rgba(47,111,62,0.4)",
    animation: "leaf-pulse 1.6s ease-in-out infinite",
  },
  thinkingBubble: {
    background: "#fff",
    border: "1px solid #DCE5D5",
    borderRadius: "16px 16px 16px 4px",
    padding: "10px 14px",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#3F5544",
    boxShadow: "0 1px 3px rgba(31,79,42,0.06)",
  },
  thinkingText: {
    fontWeight: 500,
    color: "#2F6F3E",
    fontStyle: "italic",
    display: "inline-flex",
    alignItems: "baseline",
  },
  thinkingDots: {
    display: "inline-flex",
    marginLeft: 1,
  },
  dot: {
    animation: "dot-bounce 1s ease-in-out infinite",
    color: "#2F6F3E",
  },
  thinkingTime: {
    fontSize: 11,
    color: "#9AAB9D",
    fontVariantNumeric: "tabular-nums",
    paddingLeft: 6,
    borderLeft: "1px solid #E5EFDF",
  },
  inputArea: {
    padding: "14px 22px 18px",
    background: "#FBF8F0",
    borderTop: "1px solid #DCE5D5",
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#fff",
    border: "1.5px solid #BCCFB1",
    borderRadius: 26,
    padding: "4px 4px 4px 16px",
    boxShadow: "0 1px 3px rgba(31,79,42,0.05)",
    transition: "border-color 0.2s",
  },
  input: {
    flex: 1,
    padding: "10px 4px",
    border: "none",
    outline: "none",
    fontSize: 14,
    background: "transparent",
    color: "#1F2E22",
    minWidth: 0,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2F6F3E 0%, #4A8B3A 100%)",
    color: "#fff",
    border: "none",
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 2px 6px rgba(47,111,62,0.25)",
  },
  resultBox: {
    background: "#FBF8F0",
    padding: 14,
    borderRadius: 12,
    border: "1px solid #E5EFDF",
  },
  chartTitle: {
    fontWeight: 600,
    marginBottom: 10,
    margin: "0 0 10px",
    color: "#1F4F2A",
    fontSize: 14,
  },
  summary: {
    marginTop: 12,
    margin: "12px 0 0",
    padding: "9px 13px",
    background: "#EEF5E8",
    color: "#2C3E2F",
    borderRadius: 9,
    borderLeft: "3px solid #2F6F3E",
    fontSize: 13,
    lineHeight: 1.6,
    fontStyle: "italic",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: 9,
    border: "1px solid #DCE5D5",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  th: {
    background: "#E5EFDF",
    padding: "9px 11px",
    textAlign: "left",
    fontWeight: 600,
    color: "#1F4F2A",
    borderBottom: "1px solid #BCCFB1",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 11px",
    color: "#3F5544",
    borderBottom: "1px solid #EEF2EA",
  },
  traceBtn: {
    marginTop: 10,
    background: "transparent",
    border: "1px solid #BCCFB1",
    color: "#2F6F3E",
    borderRadius: 16,
    padding: "4px 10px",
    fontSize: 11,
    cursor: "pointer",
    fontWeight: 500,
  },
  drawerBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(31,47,34,0.32)",
    zIndex: 9990,
  },
  drawer: {
    position: "fixed",
    top: 0,
    right: 0,
    width: "min(560px, 90vw)",
    height: "100vh",
    background: "#FBF8F0",
    boxShadow: "-8px 0 24px rgba(31,79,42,0.18)",
    zIndex: 9991,
    display: "flex",
    flexDirection: "column",
  },
  drawerHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #DCE5D5",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "linear-gradient(135deg, #2F6F3E 0%, #4A8B3A 100%)",
    color: "#fff",
  },
  drawerTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
  },
  drawerCloseBtn: {
    background: "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.35)",
    color: "#fff",
    width: 28,
    height: 28,
    borderRadius: "50%",
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
  },
  drawerBody: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
  },
  traceEntry: {
    marginBottom: 18,
    padding: "12px 14px",
    border: "1px solid #DCE5D5",
    borderRadius: 8,
    background: "#fff",
  },
  traceEntryHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  traceIdx: {
    fontSize: 11,
    color: "#7A8A7E",
    fontWeight: 700,
  },
  traceIntent: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1F4F2A",
    flex: 1,
  },
  traceAttempts: {
    fontSize: 10,
    padding: "2px 6px",
    background: "#FEF3C7",
    color: "#92400E",
    borderRadius: 10,
  },
  traceField: {
    marginTop: 8,
  },
  traceFieldLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#7A8A7E",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  traceJson: {
    margin: 0,
    padding: "8px 10px",
    background: "#FBF8F0",
    border: "1px solid #DCE5D5",
    borderRadius: 5,
    fontSize: 11,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    maxHeight: 180,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#2C3E2F",
  },
  traceJsonSmall: {
    margin: "6px 0 0",
    padding: "6px 8px",
    background: "#F7F4EC",
    border: "1px dashed #DCE5D5",
    borderRadius: 5,
    fontSize: 10,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    maxHeight: 140,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#3F5544",
  },
  traceOutcomeOk: {
    fontSize: 12,
    color: "#2F6F3E",
    fontWeight: 600,
  },
  traceOutcomeErr: {
    fontSize: 12,
    color: "#B5462C",
    fontWeight: 600,
  },
};

// Inject keyframes (spinner kept for back-compat; new ones for thinking indicator).
if (typeof document !== "undefined" && !document.getElementById("chat-page-style")) {
  const style = document.createElement("style");
  style.id = "chat-page-style";
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes leaf-sway {
      0%, 100% { transform: rotate(-6deg); }
      50%      { transform: rotate(6deg); }
    }
    @keyframes leaf-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(47,111,62,0.35); }
      70%  { box-shadow: 0 0 0 10px rgba(47,111,62,0); }
      100% { box-shadow: 0 0 0 0 rgba(47,111,62,0); }
    }
    @keyframes phrase-fade {
      0%   { opacity: 0; transform: translateY(3px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes dot-bounce {
      0%, 60%, 100% { opacity: 0.25; }
      30%           { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}
