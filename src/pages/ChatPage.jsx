// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef } from "react";
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

// ── Sub-renderers (same as in AIChatWidget) ──────────────────────────────

function BarChartView({ data, xKey, bars }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
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

// Backend persists assistant messages as raw model output (a JSON string like
// '{"final":{...}}'), while live responses arrive as already-parsed objects.
// Returns one of:
//   { kind: "result", value: <renderable result object> }
//   { kind: "text",   value: <plain string>           }
//   { kind: "skip" }   — internal tool-call planning, not user-visible
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

// Tool-result echoes that the backend stores under role:"user" (e.g.
// `Tool 'get_village_overview' returned: ...`). Hide them from the chat UI.
function isInternalUserMessage(msg) {
  return (
    msg.role === "user" &&
    typeof msg.content === "string" &&
    /^Tool '[^']+' returned:/.test(msg.content)
  );
}

function Message({ msg, onShowTrace }) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div style={{ ...s.message, ...s.userMessage }}>
        <div style={s.messageContent}>
          <p style={s.messageText}>{msg.content}</p>
        </div>
      </div>
    );
  }

  const parsed = parseAssistantContent(msg.content);
  if (parsed.kind === "skip") return null;

  const hasTrace = Array.isArray(msg.trace) && msg.trace.length > 0;

  return (
    <div style={{ ...s.message, ...s.assistantMessage }}>
      <div style={s.messageContent}>
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
                  {entry.attempts > 1 && (
                    <span style={s.traceAttempts}>{entry.attempts} attempts</span>
                  )}
                </div>

                <div style={s.traceField}>
                  <div style={s.traceFieldLabel}>Pseudo-query</div>
                  <pre style={s.traceJson}>{JSON.stringify(entry.pseudo, null, 2)}</pre>
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
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTrace, setActiveTrace] = useState(null);
  const messagesEndRef = useRef(null);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchSessions() {
    try {
      const res = await fetch(`${API_URL}/ai/chat-sessions`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json();
      if (json.error) {
        console.error(json.message);
      } else {
        setSessions(json.result || []);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
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

  return (
    <div style={s.container}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <h3>Chat Sessions</h3>
            <button onClick={createNewChat} style={s.newChatBtn}>+ New Chat</button>
          </div>
          <div style={s.sessionList}>
            {sessions.map((session) => (
              <div
                key={session.id}
                style={{
                  ...s.sessionItem,
                  background: currentSession && currentSession.id === session.id ? "#E0E7FF" : "#fff",
                }}
                onClick={() => loadSession(session.id)}
              >
                <span style={s.sessionTitle}>{session.title || "Untitled Chat"}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }} style={s.deleteBtn}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div style={s.main}>
        <div style={s.header}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={s.toggleSidebar}>☰</button>
          <h2>{currentSession ? (currentSession.title || "Chat") : "New Chat"}</h2>
          <button onClick={() => navigate(-1)} style={s.backBtn}>← Back</button>
        </div>

        <div style={s.messages}>
          {messages
            .filter((msg) => !isInternalUserMessage(msg))
            .map((msg, i) => (
              <Message key={i} msg={msg} onShowTrace={setActiveTrace} />
            ))}
          {loading && (
            <div style={s.loading}>
              <span style={s.spinner} />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={s.inputArea}>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            style={s.input}
            disabled={loading}
          />
          <button onClick={sendMessage} disabled={loading || !prompt.trim()} style={s.sendBtn}>
            Send
          </button>
        </div>
      </div>

      <TraceDrawer trace={activeTrace} onClose={() => setActiveTrace(null)} />
    </div>
  );
}

// ── Styles ───────────────────────────
const s = {
  container: {
    display: "flex",
    height: "100vh",
    background: "#f5f5f5",
  },
  sidebar: {
    width: "300px",
    background: "#fff",
    borderRight: "1px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
  },
  sidebarHeader: {
    padding: "20px",
    borderBottom: "1px solid #e0e0e0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  newChatBtn: {
    background: "#4F46E5",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    padding: "8px 12px",
    cursor: "pointer",
  },
  sessionList: {
    flex: 1,
    overflowY: "auto",
  },
  sessionItem: {
    padding: "15px 20px",
    borderBottom: "1px solid #f0f0f0",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionTitle: {
    flex: 1,
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#999",
    cursor: "pointer",
    fontSize: "18px",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "20px",
    background: "#fff",
    borderBottom: "1px solid #e0e0e0",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  toggleSidebar: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
  },
  backBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
  },
  message: {
    marginBottom: "20px",
    display: "flex",
  },
  userMessage: {
    justifyContent: "flex-end",
  },
  assistantMessage: {
    justifyContent: "flex-start",
  },
  messageContent: {
    maxWidth: "70%",
    padding: "10px 15px",
    borderRadius: "10px",
  },
  messageText: {
    margin: 0,
    background: "#007bff",
    color: "#fff",
    borderRadius: "10px",
    padding: "10px 15px",
  },
  assistantText: {
    margin: 0,
    background: "#fff",
    color: "#111",
    border: "1px solid #e0e0e0",
    borderRadius: "10px",
    padding: "10px 15px",
    whiteSpace: "pre-wrap",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid #e0e0e0",
    borderTop: "2px solid #4F46E5",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  inputArea: {
    padding: "20px",
    background: "#fff",
    borderTop: "1px solid #e0e0e0",
    display: "flex",
    gap: "10px",
  },
  input: {
    flex: 1,
    padding: "10px",
    border: "1px solid #e0e0e0",
    borderRadius: "5px",
  },
  sendBtn: {
    padding: "10px 20px",
    background: "#4F46E5",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  resultBox: {
    background: "#f9f9f9",
    padding: "15px",
    borderRadius: "10px",
    border: "1px solid #e0e0e0",
  },
  chartTitle: {
    fontWeight: "bold",
    marginBottom: "10px",
  },
  summary: {
    marginTop: "10px",
    fontStyle: "italic",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    background: "#f0f0f0",
    padding: "8px",
    textAlign: "left",
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #e0e0e0",
  },
  traceBtn: {
    marginTop: "8px",
    background: "transparent",
    border: "1px solid #DDD6FE",
    color: "#4F46E5",
    borderRadius: "16px",
    padding: "4px 10px",
    fontSize: "11px",
    cursor: "pointer",
    fontWeight: 500,
  },
  drawerBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.25)",
    zIndex: 9990,
  },
  drawer: {
    position: "fixed",
    top: 0,
    right: 0,
    width: "min(560px, 90vw)",
    height: "100vh",
    background: "#fff",
    boxShadow: "-8px 0 24px rgba(0,0,0,0.15)",
    zIndex: 9991,
    display: "flex",
    flexDirection: "column",
  },
  drawerHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
    color: "#fff",
  },
  drawerTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 600,
  },
  drawerCloseBtn: {
    background: "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.35)",
    color: "#fff",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    fontSize: "18px",
    cursor: "pointer",
    lineHeight: 1,
  },
  drawerBody: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
  },
  traceEntry: {
    marginBottom: "18px",
    padding: "12px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: "#fafafa",
  },
  traceEntryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  traceIdx: {
    fontSize: "11px",
    color: "#6B7280",
    fontWeight: 700,
  },
  traceIntent: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#111827",
    flex: 1,
  },
  traceAttempts: {
    fontSize: "10px",
    padding: "2px 6px",
    background: "#FEF3C7",
    color: "#92400E",
    borderRadius: "10px",
  },
  traceField: {
    marginTop: "8px",
  },
  traceFieldLabel: {
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#6B7280",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  traceJson: {
    margin: 0,
    padding: "8px 10px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "5px",
    fontSize: "11px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    maxHeight: "180px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  traceJsonSmall: {
    margin: "6px 0 0",
    padding: "6px 8px",
    background: "#F9FAFB",
    border: "1px dashed #e5e7eb",
    borderRadius: "5px",
    fontSize: "10px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    maxHeight: "140px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#374151",
  },
  traceOutcomeOk: {
    fontSize: "12px",
    color: "#059669",
    fontWeight: 500,
  },
  traceOutcomeErr: {
    fontSize: "12px",
    color: "#DC2626",
    fontWeight: 500,
  },
};

// Inject spinner keyframe
if (typeof document !== "undefined" && !document.getElementById("chat-page-style")) {
  const style = document.createElement("style");
  style.id = "chat-page-style";
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}