import React, { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext"; // adjust path as needed

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin"); // role is required
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const mountedRef = useRef(false);
  const navigate = useNavigate();

  const auth = useContext(AuthContext);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleSubmit() {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !role) {
      setError("Please enter email, password, and role.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        "https://villagerelocation.onrender.com/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // important for cookie-based login (web)
          body: JSON.stringify({
            email: trimmedEmail,
            password,
            role, // required by API
            is_app: false, // mark this as web login
          }),
        }
      );

      if (!mountedRef.current) return;

      const payload = await res.json();

      if (!res.ok || payload.error) {
        throw new Error(payload?.message || "Login failed.");
      }

      // Handle both web and app style responses
      const user = payload?.user;
      const token =
        payload?.token || // app-style
        payload?.cookies?.token; // web-style (cookie in response body)
      if (!user || !user.name) {
        throw new Error("Invalid server response.");
      }

      // Call AuthContext.login with full info (name, role, email, token and expiry metadata)
      await auth.login({
        name: user.name,
        role: user.role,
        email: user.email,
        token, // may be undefined if server only sets cookie
        expiresIn: payload.expiresIn,
        expiresAt: payload.expiresAt,
        refreshToken: payload.refreshToken,
      });

      // navigation after login
      navigate("/dashboard");
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.message || "Login failed.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function fillTest() {
    setEmail("admin@example.com");
    setPassword("Admin@123");
    setRole("Admin");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f7f2e7]">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-md text-center">
        {/* Logo */}
        <div className="mb-6">
          <img
            src="images/logo.png"
            alt="Logo"
            className="mx-auto w-24 h-24 object-contain"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 text-sm text-red-600" role="alert">
            {error}
          </div>
        )}

        {/* Email */}
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

        {/* Password */}
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

        {/* Role Selection */}
        <div className="mb-4">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="Admin">Admin</option>
            <option value="User">User</option>
            {/* Add other roles if needed */}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        <button
          onClick={fillTest}
          className="mt-3 text-sm text-gray-600 underline"
        >
          Fill test credentials
        </button>

        {/* Branding */}
        <div className="mt-8">
          <h1 className="text-3xl font-bold text-gray-800">माटी</h1>
          <p className="text-m font-bold text-gray-600 tracking-wide">MAATI</p>
        </div>
      </div>
    </div>
  );
}