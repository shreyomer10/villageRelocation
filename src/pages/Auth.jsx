import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const mountedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
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
      const res = await fetch(
        "https://villagerelocation.onrender.com/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: trimmedEmail,
            password,
          }),
        }
      );

      if (!mountedRef.current) return;

      if (!res.ok) {
        let errMsg = "Login failed.";
        try {
          const payload = await res.json();
          if (payload && payload.error) errMsg = payload.error;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(errMsg);
      }

      const payload = await res.json();
      const user = payload?.user;
      if (!user || !user.name) {
        throw new Error("Invalid server response.");
      }

      // Save user info to localStorage
      localStorage.setItem("user", JSON.stringify({ name: user.name }));

      // Save token if you want to use it later for authenticated API calls
      // localStorage.setItem("token", payload.token);

      // ✅ Navigate using React Router (no reload, no 404)
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
