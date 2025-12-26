import React, { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/Api";
import { Menu, X, User, Lock, Phone, Key, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  // modes: "login" | "forgot"
  const [mode, setMode] = useState("login");

  // hidden, fixed values required by backend
  const [empId] = useState("UID_18");
  const [role] = useState("dd");

  // editable fields
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  // forgot steps: "init" | "otpSent" | "verified"
  const [forgotStep, setForgotStep] = useState("init");

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const mountedRef = useRef(false);
  const navigate = useNavigate();
  const auth = useContext(AuthContext);

  const ENDPOINTS = {
    login: `${API_BASE}/login`,
    sendOtp: `${API_BASE}/sendOtp`,
    verifyOtp: `${API_BASE}/verifyOtp`,
    updatePassword: `${API_BASE}/updatePassword`,
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function resetMessages() {
    setError(null);
    setInfo(null);
  }

  // robust safeFetch (handles non-JSON responses)
  async function safeFetch(url, options = {}) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        json = null;
      }
      return { ok: res.ok, status: res.status, json, text, res };
    } catch (err) {
      return { ok: false, status: 0, json: null, text: String(err) };
    }
  }

  // helper to interpret backend's "success" shape
  function isBackendSuccess({ ok, status, json, text }) {
    if (ok && status >= 200 && status < 300) return true;
    if (json && (json.error === false || json.error === "False" || json.error === 0)) return true;
    if (status === 200 && json && typeof json.message === "string" && /success|sent|verified|login/i.test(json.message)) return true;
    return false;
  }

  /* ------------------ LOGIN ------------------ */
  async function handleLogin() {
    resetMessages();
    const trimmedMobile = mobileNumber.trim();
    if (!empId || !trimmedMobile || !password || !role) {
      setError("Please provide mobile number and password.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        emp_id: empId, // hidden fixed value
        mobile_number: trimmedMobile,
        role, // hidden fixed 'dd'
        password,
        is_app: false,
      };

      const { ok, status, json, text } = await safeFetch(ENDPOINTS.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!mountedRef.current) return;

      if (!isBackendSuccess({ ok, status, json, text })) {
        const msg = (json && (json.message || json.error)) || text || `Login failed (status ${status})`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      const payload = json ?? {};

      try {
        localStorage.setItem("auth_payload", JSON.stringify(payload));
      } catch {}

      const okLogin = await auth.login(payload);
      if (!okLogin) {
        setError("Login succeeded but client could not process server response.");
        return;
      }

      const providedToken = payload.token ?? payload.accessToken ?? payload.access_token ?? null;
      const providedExpiry =
        payload.expiresIn ?? payload.expires_in ?? payload.expiresAt ?? payload.expires_at ?? null;
      if (!providedToken && !providedExpiry) {
        try {
          auth.setToken(null, { expiresIn: 2 * 3600 });
        } catch {}
      }

      navigate("/dashboard");
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Login failed.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  /* ------------------ FORGOT (OTP -> reset) ------------------ */
  async function sendOtp() {
    resetMessages();
    const trimmedMobile = mobileNumber.trim();
    if (!empId || !trimmedMobile || !role) {
      setError("Missing required values.");
      return null;
    }
    setLoading(true);
    try {
      const body = { emp_id: empId, mobile_number: trimmedMobile, role, purpose: "forgot" };
      const { ok, status, json, text } = await safeFetch(ENDPOINTS.sendOtp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!mountedRef.current) return null;
      if (!isBackendSuccess({ ok, status, json, text })) {
        const msg = (json && (json.message || json.error)) || text || `Failed to send OTP (status ${status})`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
      setInfo("OTP sent to the provided mobile number.");
      return json ?? {};
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Failed to send OTP.");
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function verifyOtp() {
    resetMessages();
    if (!otp.trim()) {
      setError("Please enter OTP.");
      return false;
    }
    setLoading(true);
    try {
      const body = {
        emp_id: empId,
        mobile_number: mobileNumber.trim(),
        role,
        otp: otp.trim(),
      };
      const { ok, status, json, text } = await safeFetch(ENDPOINTS.verifyOtp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!mountedRef.current) return false;
      if (!isBackendSuccess({ ok, status, json, text })) {
        const msg = (json && (json.message || json.error)) || text || `OTP verification failed (status ${status})`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
      setInfo("OTP verified.");
      return true;
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "OTP verification failed.");
      return false;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function handleForgotSendOtp() {
    const p = await sendOtp();
    if (p) setForgotStep("otpSent");
  }

  async function handleForgotVerifyOtp() {
    const ok = await verifyOtp();
    if (ok) {
      setForgotStep("verified");
      setInfo("OTP verified — set your new password below.");
    }
  }

  async function handleForgotResetPassword() {
    resetMessages();
    if (!password || password.length < 6) {
      setError("Provide a new password at least 6 chars long.");
      return;
    }
    setLoading(true);
    try {
      const body = { emp_id: empId, mobile_number: mobileNumber.trim(), role, password };
      const { ok, status, json, text } = await safeFetch(ENDPOINTS.updatePassword, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!mountedRef.current) return;

      if (!isBackendSuccess({ ok, status, json, text })) {
        const msg = (json && (json.message || json.error)) || text || `Password update failed (status ${status})`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      setInfo("Password updated. Attempting to sign in...");

      try {
        const { ok: lOk, status: lStatus, json: lJson, text: lText } = await safeFetch(ENDPOINTS.login, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ emp_id: empId, mobile_number: mobileNumber.trim(), role, password, is_app: false }),
        });

        if (!mountedRef.current) return;

        if (!isBackendSuccess({ ok: lOk, status: lStatus, json: lJson, text: lText })) {
          setInfo("Password updated — please sign in.");
          setMode("login");
          setForgotStep("init");
          return;
        }

        try {
          localStorage.setItem("auth_payload", JSON.stringify(lJson ?? {}));
        } catch {}

        await auth.login(lJson ?? {});
        const payload = lJson ?? {};
        const providedToken = payload.token ?? payload.accessToken ?? payload.access_token ?? null;
        const providedExpiry =
          payload.expiresIn ?? payload.expires_in ?? payload.expiresAt ?? payload.expires_at ?? null;
        if (!providedToken && !providedExpiry) {
          try {
            auth.setToken(null, { expiresIn: 2 * 3600 });
          } catch {}
        }

        navigate("/dashboard");
      } catch {
        setMode("login");
        setInfo("Password updated — please sign in.");
      }
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Password update failed.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function fillTest() {
    setMobileNumber("3333333333");
    setPassword("dddd");
    setOtp("");
    resetMessages();
  }

  // small presentational helpers
  const primaryBtn = "w-full py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2";

  return (
    <div className="min-h-screen bg-[#f8f0dc] flex flex-col">
      <header className="w-full bg-[#a7dec0] p-3 md:p-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3 pl-4 md:pl-10">
          <img src="/images/logo.png" alt="logo" className="h-12 w-16 rounded" />
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-[#1b5e20]">MAATI</h1>
            <p className="text-xs text-gray-700">Village Relocation Monitoring</p>
          </div>
        </div>

        <nav className="flex items-center gap-4 pr-4 md:pr-10">
          <div className="hidden md:flex gap-6 text-sm items-center">
            <button onClick={() => navigate("/landingpage")}>home</button>
          </div>

          <button
            className="md:hidden p-2 rounded-md hover:bg-white/60"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((s) => !s)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
      </header>

      {mobileOpen && (
        <div className="md:hidden bg-white/90 shadow p-3">
          <a href="/" className="block py-2">Home</a>
        </div>
      )}

      <main className="flex-1 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-xl shadow-md text-center transition-transform transform sm:scale-100 md:scale-100">
          <div className="flex flex-col items-center">
            <h2 className="text-3xl font-extrabold text-[#1b5e20] tracking-tight">{mode === "login" ? "Log in" : "Forgot password"}</h2>
            <p className="text-sm text-gray-600 mt-4">{mode === "login" ? "Official" : "Reset your account password"}</p>

            {/* progress / step indicator for forgot flow (small) */}
            {mode === "forgot" && (
              <div className="w-full mt-4 text-left">
                <div className="text-xs text-gray-500">Step</div>
                <div className="relative h-2 bg-gray-200 rounded-full mt-1">
                  <div
                    className={`absolute h-2 rounded-full bg-green-600 transition-all`} 
                    style={{ width: forgotStep === "init" ? "20%" : forgotStep === "otpSent" ? "60%" : "100%" }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                  <span>Request</span>
                  <span>Verify</span>
                  <span>Reset</span>
                </div>
              </div>
            )}

            {error && <div className="w-full mt-4 text-sm text-red-600" role="alert">{error}</div>}
            {info && <div className="w-full mt-4 text-sm text-green-700">{info}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (mode === "login") handleLogin();
                else if (mode === "forgot") {
                  if (forgotStep === "init") handleForgotSendOtp();
                  else if (forgotStep === "otpSent") handleForgotVerifyOtp();
                  else if (forgotStep === "verified") handleForgotResetPassword();
                }
              }}
              className="w-full mt-4"
            >
              <label className="sr-only">Mobile number</label>
              <div className="mb-3 relative">
                <Phone className="absolute left-3 top-3 text-gray-400" size={16} />
                <input
                  inputMode="tel"
                  pattern="[0-9]*"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="Mobile number"
                  className="w-full pl-10 pr-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {mode === "login" && (
                <div className="mb-3 relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-10 pr-10 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    aria-label="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-2.5"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}

              {mode === "forgot" && (forgotStep === "otpSent" || forgotStep === "verified") && (
                <div className="mb-3 relative">
                  <Key className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="OTP"
                    className="w-full pl-10 pr-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    inputMode="numeric"
                    aria-label="OTP"
                  />
                </div>
              )}

              {mode === "forgot" && forgotStep === "verified" && (
                <div className="mb-3 relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full pl-10 pr-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div className="mt-4">
                {mode === "login" && (
                  <button type="submit" disabled={loading} className={primaryBtn}>
                    {loading ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                    ) : null}
                    <span>{loading ? "Signing in..." : "Sign in"}</span>
                  </button>
                )}

                {mode === "forgot" && forgotStep === "init" && (
                  <button type="submit" disabled={loading} className={primaryBtn}>
                    <span>{loading ? "Sending OTP..." : "Send OTP"}</span>
                  </button>
                )}

                {mode === "forgot" && forgotStep === "otpSent" && (
                  <button type="submit" disabled={loading} className={primaryBtn}>
                    <span>{loading ? "Verifying OTP..." : "Verify OTP"}</span>
                  </button>
                )}

                {mode === "forgot" && forgotStep === "verified" && (
                  <button type="submit" disabled={loading} className={primaryBtn}>
                    <span>{loading ? "Resetting..." : "Reset Password"}</span>
                  </button>
                )}
              </div>
            </form>

            <div className="mt-3 w-full flex items-center justify-between text-sm">
              {mode !== "forgot" ? (
                <button
                  onClick={() => {
                    resetMessages();
                    setMode("forgot");
                    setForgotStep("init");
                    setOtp("");
                    setPassword("");
                  }}
                  className="text-gray-600 underline"
                >
                  Forgot password?
                </button>
              ) : (
                <button
                  onClick={() => {
                    resetMessages();
                    setMode("login");
                    setForgotStep("init");
                    setOtp("");
                    setPassword("");
                  }}
                  className="text-gray-600 underline"
                >
                  Back to login
                </button>
              )}

              <button onClick={fillTest} className="text-sm text-gray-600 underline">
                Fill test credentials
              </button>
            </div>

            <div className="mt-6 text-center">
              <h3 className="text-2xl font-bold text-gray-800">माटी</h3>
              <p className="text-sm font-bold text-gray-600 tracking-wide">MAATI</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full text-center py-4 text-xs text-gray-500">
        © {new Date().getFullYear()} MAATI — Village Relocation Monitoring
      </footer>
    </div>
  );
}
