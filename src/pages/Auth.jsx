// src/pages/Auth.jsx
import React, { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext"; // adjust path if needed

/* small JWT payload decoder to read `exp` */
function base64UrlDecode(str) {
  if (!str) return null;
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  try {
    return atob(str);
  } catch {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch {
      return null;
    }
  }
}
function parseJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = base64UrlDecode(parts[1]);
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const mountedRef = useRef(false);
  const navigate = useNavigate();
  const { login: contextLogin } = useContext(AuthContext);

  useEffect(() => {
    mountedRef.current = true;
    return () => (mountedRef.current = false);
  }, []);

  async function handleSubmit() {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      // For web usage we set is_app: false so backend will use cookie-based response
      const res = await fetch("https://villagerelocation.onrender.com/auth/login", {
        method: "POST",
        credentials: "include", // allow server to set httpOnly cookie for web flow
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password, is_app: false }),
      });

      if (!mountedRef.current) return;

      if (!res.ok) {
        let errMsg = "Login failed.";
        try {
          const payload = await res.json();
          if (payload && (payload.error || payload.message)) {
            errMsg = payload.error ?? payload.message;
          }
        } catch {
          // ignore parse errors
        }
        throw new Error(errMsg);
      }

      const payload = await res.json();

      // support both response shapes:
      // app flow: { token, user }
      // web flow: { user, cookies: { token } }
      const user = payload?.user;
      if (!user || !user.name) {
        throw new Error("Invalid server response: missing user");
      }

      // prefer cookies.token (web) then payload.token (app)
      const token = payload?.cookies?.token ?? payload?.token ?? null;

      // attempt to extract expiry from token (if present)
      let tokenExpiryMs = null;
      if (token) {
        const decoded = parseJwt(token);
        if (decoded && decoded.exp) tokenExpiryMs = Number(decoded.exp) * 1000;
      }

      // handoff to AuthContext so it manages timers/state/persistence
      try {
        // context.login expects { name, token, tokenExpiry }
        contextLogin({ name: user.name, token, tokenExpiry: tokenExpiryMs });
      } catch (e) {
        // fallback if context not available for some reason
        try {
          localStorage.setItem("user", JSON.stringify({ name: user.name }));
          if (token) localStorage.setItem("token", token);
          if (tokenExpiryMs) localStorage.setItem("tokenExpiry", tokenExpiryMs.toString());
        } catch {}
      }

      navigate("/dashboard");
    } catch (err) {
      if (mountedRef.current) setError(err?.message ?? "Login failed.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function fillTest() {
    setEmail("admin@example.com");
    setPassword("Admin@123");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f7f2e7]">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-md text-center">
        <div className="mb-6">
          <img src="/images/logo.png" alt="Logo" className="mx-auto w-24 h-24 object-contain" />
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600" role="alert">
            {error}
          </div>
        )}

        <div className="mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full px-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="mb-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full px-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        <button onClick={fillTest} className="mt-3 text-sm text-gray-600 underline">
          Fill test credentials
        </button>

        <div className="mt-8">
          <h1 className="text-3xl font-bold text-gray-800">माटी</h1>
          <p className="text-m font-bold text-gray-600 tracking-wide">MAATI</p>
        </div>
      </div>
    </div>
  );
}
