import React, { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [empId, setEmpId] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [role, setRole] = useState("Admin");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [registerStep, setRegisterStep] = useState("init");
  const [forgotStep, setForgotStep] = useState("init");

  const mountedRef = useRef(false);
  const navigate = useNavigate();
  const auth = useContext(AuthContext);

  const API_BASE = "https://villagerelocation.onrender.com";
  const ENDPOINTS = {
    login: `${API_BASE}/login`,
    sendOtp: `${API_BASE}/sendOtp`,
    verifyOtp: `${API_BASE}/verifyOtp`,
    register: `${API_BASE}/register`,
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
      return { ok: res.ok, status: res.status, json, text };
    } catch (err) {
      return { ok: false, status: 0, json: null, text: String(err) };
    }
  }

  // LOGIN
  async function handleLogin() {
    resetMessages();
    const trimmedId = empId.trim();
    if (!trimmedId || !mobileNumber.trim() || !password || !role) {
      setError("Please provide emp_id, mobile number, role and password.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        emp_id: trimmedId,
        mobile_number: mobileNumber.trim(),
        role,
        password,
        is_app: false, // web uses cookie-based token by default per API docs
      };

      const { ok, status, json, text } = await safeFetch(ENDPOINTS.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!mountedRef.current) return;

      if (!ok) {
        const msg = (json && (json.message || json.error)) || text || `Login failed (status ${status})`;
        throw new Error(msg);
      }

      const payload = json ?? {};
      // expected shapes:
      // is_app=true -> { token, user }
      // is_app=false -> cookie set, body contains user
      // pass full payload to auth.login which sanitizes villageID etc.
      const okLogin = await auth.login(payload);
      if (!okLogin) {
        setError("Login succeeded but client could not process server response.");
        return;
      }
      navigate("/dashboard");
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Login failed.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // send OTP (register or forgot)
  async function sendOtp(purpose = "register") {
    resetMessages();
    const trimmedId = empId.trim();
    if (!trimmedId || !mobileNumber.trim() || !role) {
      setError("Please provide emp_id, mobile number and role.");
      return null;
    }
    setLoading(true);
    try {
      const body = { emp_id: trimmedId, mobile_number: mobileNumber.trim(), role, purpose };
      const { ok, status, json, text } = await safeFetch(ENDPOINTS.sendOtp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!mountedRef.current) return null;
      if (!ok) {
        const msg = (json && (json.message || json.error)) || text || `Failed to send OTP (status ${status})`;
        throw new Error(msg);
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

  // verify OTP
  async function verifyOtp(action = "register") {
    resetMessages();
    if (!otp.trim()) {
      setError("Please enter OTP.");
      return false;
    }
    setLoading(true);
    try {
      const body = {
        emp_Id: empId.trim(),
        emp_id: empId.trim(),
        mobile_number: mobileNumber.trim(),
        role,
        otp: otp.trim(),
        purpose: action,
      };
      const { ok, status, json, text } = await safeFetch(ENDPOINTS.verifyOtp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!mountedRef.current) return false;
      if (!ok) {
        const msg = (json && (json.message || json.error)) || text || `OTP verification failed (status ${status})`;
        throw new Error(msg);
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

  // complete registration
  async function completeRegistration() {
    resetMessages();
    const trimmedId = empId.trim();
    if (!trimmedId || !mobileNumber.trim() || !role || !password) {
      setError("Please provide emp_id, mobile_number, role and password.");
      return;
    }
    setLoading(true);
    try {
      const body = { emp_id: trimmedId, mobile_number: mobileNumber.trim(), role, password };
      const { ok, status, json, text } = await safeFetch(ENDPOINTS.register, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!mountedRef.current) return;
      if (!ok) {
        const msg = (json && (json.message || json.error)) || text || `Registration failed (status ${status})`;
        throw new Error(msg);
      }

      setInfo("Registration successful. Attempting to sign in...");

      // many backends return user & token on register; otherwise fall back to login attempt
      if (json && (json.user || json.token)) {
        await auth.login(json);
        navigate("/dashboard");
      } else {
        // fallback to login
        await handleAutoLoginAfterRegister(trimmedId, mobileNumber.trim(), role, password);
      }
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Registration failed.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function handleAutoLoginAfterRegister(emp_id, mobile_number, roleVal, pwd) {
    try {
      const { ok, status, json, text } = await safeFetch(ENDPOINTS.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emp_id, mobile_number, role: roleVal, password: pwd, is_app: false }),
      });
      if (!mountedRef.current) return;
      if (!ok) {
        setInfo("Registered — please sign in.");
        setMode("login");
        return;
      }
      await auth.login(json ?? {});
      navigate("/dashboard");
    } catch (err) {
      setMode("login");
      setInfo("Registered — please sign in.");
    }
  }

  // forgot flows
  async function handleForgotSendOtp() {
    const p = await sendOtp("forgot");
    if (p) setForgotStep("otpSent");
  }

  async function handleForgotVerifyOtp() {
    const ok = await verifyOtp("forgot");
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
      const body = { emp_id: empId.trim(), mobile_number: mobileNumber.trim(), role, password };
      const { ok, status, json, text } = await safeFetch(ENDPOINTS.updatePassword, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!mountedRef.current) return;
      if (!ok) {
        const msg = (json && (json.message || json.error)) || text || `Password update failed (status ${status})`;
        throw new Error(msg);
      }
      setInfo("Password updated. Signing in...");
      await handleAutoLoginAfterRegister(empId.trim(), mobileNumber.trim(), role, password);
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Password update failed.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // helpers for register steps
  async function handleRegisterSendOtp() {
    const p = await sendOtp("register");
    if (p) setRegisterStep("otpSent");
  }
  async function handleRegisterVerifyOtpAndProceed() {
    const ok = await verifyOtp("register");
    if (ok) {
      setRegisterStep("verified");
      setInfo("OTP verified. Please set password to complete registration.");
    }
  }

  function fillTest() {
    setEmpId("UID_4");
    setMobileNumber("9876543210");
    setRole("fg");
    setPassword("User@1234");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f7f2e7]">
      <header className="fixed top-0 left-0 w-full bg-[#c8e6c9]/95 backdrop-blur-sm p-4 flex items-center justify-between shadow z-50">
        <div className="flex items-center px-10 gap-2">
          <img src="/images/logo.png" alt="logo" className="h-14 w-20 rounded" />
          <div>
            <h1 className="text-lg font-bold text-[#1b5e20]">MAATI</h1>
            <p className="text-xs text-gray-700">Village Relocation Monitoring</p>
          </div>
        </div>
        <nav className="hidden md:flex gap-6 text-sm px-40 items-center">
          <a href="/" className="hover:text-[#1b5e20]">home</a>
        </nav>
      </header>

      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-md text-center mt-24">
        <div className="flex text-lg font-bold text-[#1b5e20] justify-center py-4">
          <h1 className="text-3xl font-extrabold tracking-wide drop-shadow-sm">
            {mode === "login" ? "Log in" : mode === "register" ? "Register" : "Forgot password"}
          </h1>
        </div>

        {error && <div className="mb-4 text-sm text-red-600" role="alert">{error}</div>}
        {info && <div className="mb-4 text-sm text-green-700">{info}</div>}

        <div className="mb-3">
          <input
            type="text"
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            placeholder="Employee ID (emp_id)"
            className="w-full px-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="mb-3">
          <input
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="Mobile number (mobile_number)"
            className="w-full px-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="mb-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="Admin">Admin</option>
            <option value="fg">fg</option>
            <option value="ra">ra</option>
            <option value="ro">ro</option>
            <option value="ab">ab</option>
            <option value="dd">dd</option>
          </select>
        </div>

        {mode === "login" && (
          <div className="mb-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}

        {mode === "register" && registerStep === "verified" && (
          <div className="mb-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a password to complete registration"
              className="w-full px-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}

        {mode === "forgot" && forgotStep === "verified" && (
          <div className="mb-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full px-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}

        {((mode === "register" && registerStep === "otpSent") ||
          (mode === "forgot" && (forgotStep === "otpSent" || forgotStep === "verified"))) && (
          <div className="mb-3">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="OTP"
              className="w-full px-4 py-2 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {mode === "login" && (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          )}

          {mode === "register" && registerStep === "init" && (
            <button onClick={handleRegisterSendOtp} disabled={loading} className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          )}
          {mode === "register" && registerStep === "otpSent" && (
            <button onClick={handleRegisterVerifyOtpAndProceed} disabled={loading} className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
              {loading ? "Verifying OTP..." : "Verify OTP"}
            </button>
          )}
          {mode === "register" && registerStep === "verified" && (
            <button onClick={completeRegistration} disabled={loading} className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
              {loading ? "Completing..." : "Complete Registration"}
            </button>
          )}

          {mode === "forgot" && forgotStep === "init" && (
            <button onClick={handleForgotSendOtp} disabled={loading} className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          )}
          {mode === "forgot" && forgotStep === "otpSent" && (
            <button onClick={handleForgotVerifyOtp} disabled={loading} className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
              {loading ? "Verifying OTP..." : "Verify OTP"}
            </button>
          )}
          {mode === "forgot" && forgotStep === "verified" && (
            <button onClick={handleForgotResetPassword} disabled={loading} className="w-full py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          )}
        </div>

        <div className="mt-3 flex justify-between text-sm">
          {mode !== "register" ? (
            <button onClick={() => { resetMessages(); setMode("register"); setRegisterStep("init"); setOtp(""); setPassword(""); }} className="text-gray-600 underline">Register</button>
          ) : (
            <button onClick={() => { resetMessages(); setMode("login"); setRegisterStep("init"); setOtp(""); setPassword(""); }} className="text-gray-600 underline">Back to login</button>
          )}

          {mode !== "forgot" ? (
            <button onClick={() => { resetMessages(); setMode("forgot"); setForgotStep("init"); setOtp(""); setPassword(""); }} className="text-gray-600 underline">Forgot password?</button>
          ) : (
            <button onClick={() => { resetMessages(); setMode("login"); setForgotStep("init"); setOtp(""); setPassword(""); }} className="text-gray-600 underline">Back to login</button>
          )}
        </div>

        <button onClick={fillTest} className="mt-3 text-sm text-gray-600 underline">Fill test credentials</button>

        <div className="mt-8">
          <h1 className="text-3xl font-bold text-gray-800">माटी</h1>
          <p className="text-m font-bold text-gray-600 tracking-wide">MAATI</p>
        </div>
      </div>
    </div>
  );
}
