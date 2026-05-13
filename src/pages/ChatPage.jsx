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

function Message({ msg }) {
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

  return (
    <div style={{ ...s.message, ...s.assistantMessage }}>
      <div style={s.messageContent}>
        {parsed.kind === "result" ? (
          <ResponseRenderer result={parsed.value} />
        ) : (
          <p style={s.assistantText}>{parsed.value}</p>
        )}
      </div>
    </div>
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
        const assistantMsg = { role: "assistant", content: json.result };
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
              <Message key={i} msg={msg} />
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
};

// Inject spinner keyframe
if (typeof document !== "undefined" && !document.getElementById("chat-page-style")) {
  const style = document.createElement("style");
  style.id = "chat-page-style";
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}