import { useState, useEffect } from "react";


const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

async function readApiResponse(response) {
  const text = await response.text();

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    const error = new Error(
      `Server ne JSON response nahi diya. HTTP status: ${response.status}. Please check the backend server and API URL.`
    );
    error.status = response.status;
    throw error;
  }

  if (!response.ok || result.success === false) {
    const error = new Error(result.message || "Request failed.");
    error.status = response.status; // Preserve exact HTTP status code
    throw error;
  }

  return result;
}

export default function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authData, setAuthData] = useState({ email: "", password: "" });
const [checkingAuth, setCheckingAuth] = useState(true);


  // Contact form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");

  const [status, setStatus] = useState({
    type: "",
    message: "",
  });

  // Bug 1 Fix: Verify token with backend on page load/refresh
  useEffect(() => {
    const verifyTokenOnLoad = async () => {
      const token = localStorage.getItem("authToken");
     if (!token) {
  setIsAuthenticated(false);
  setCheckingAuth(false);
  return;
}

      try {
  
const response = await fetch(`${API_URL}/api/auth/verify`, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${token}`,
  },


});

        const result = await readApiResponse(response);
        if (result.success && result.user) {
          setIsAuthenticated(true);
          setFormData((prev) => ({ ...prev, email: result.user.email }));
        }
      } catch (error) {
        
        handleLogout();
      } finally {
  setCheckingAuth(false);
}
    };

    verifyTokenOnLoad();
  }, []);

  // Handlers for Auth
  const handleAuthChange = (e) => {
    const { name, value } = e.target;
    setAuthData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });

 
const endpoint = isSignUp
  ? `${API_URL}/api/auth/signup`
  : `${API_URL}/api/auth/login`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authData),
      });

      const result = await readApiResponse(response);

      if (isSignUp) {
        setStatus({
          type: "success",
          message: result.message || "Your account has been created successfully! Please sign in.",
        });
        setIsSignUp(false);
      } else {
        if (!result.token) {
          throw new Error("Login token not found.");
        }

        localStorage.setItem("authToken", result.token);
        setIsAuthenticated(true);
        setFormData((prev) => ({ ...prev, email: authData.email }));
        setStatus({
          type: "success",
          message: result.message || "Login successful!",
        });
      }

      setAuthData({ email: "", password: "" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Operation failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handlers for Contact Form
  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch
      (`${API_URL}/api/contact/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await readApiResponse(response);
      setOtpStep(true);
      setStatus({
        type: "success",
        message: result.message || "A verification code has been sent to your email address.",
      });
    } catch (error) {
      // Bug 2 Fix: Relying on preserved status code instead of string includes
      if (error.status === 401) {
        handleLogout();
        setStatus({ type: "error", message: "Your session has expired. Please log in again." });
      } else {
        setStatus({ type: "error", message: error.message || "Please check the backend server." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/contact/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: formData.email, otp }),
      });
      const result = await readApiResponse(response);
      setStatus({
        type: "success",
        message: result.message || "Email verified! Your message has been sent successfully.",
      });
      setFormData({ name: "", email: formData.email, subject: "", message: "" });
      setOtp("");
      setOtpStep(false);
    } catch (error) {
      // Bug 2 Fix: Reliable 401 status check
      if (error.status === 401) {
        handleLogout();
        setStatus({ type: "error", message: "Your session has expired. Please log in again." });
      } else {
        setStatus({ type: "error", message: error.message || "OTP verification failed." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/api/contact/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const result = await readApiResponse(response);
      setStatus({ type: "success", message: result.message || "A new OTP has been sent" });
    } catch (error) {
      if (error.status === 401) {
        handleLogout();
        setStatus({ type: "error", message: "Your session has expired. Please log in again." });
      } else {
        setStatus({ type: "error", message: error.message || "OTP could not be resent." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setIsAuthenticated(false);
    setOtpStep(false);
    setStatus({ type: "", message: "" });
  };
if (checkingAuth) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      Checking your session...
    </main>
  );
}
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 px-4 py-8">
      {/* Animated Floating Spheres Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-0 top-[10%] animate-[sphere1_12s_ease-in-out_infinite]">
          <div className="h-16 w-16 rounded-full border border-white/30 bg-gradient-to-br from-pink-300/70 via-purple-500/50 to-indigo-700/70 shadow-[inset_-8px_-8px_18px_rgba(0,0,0,0.3),0_0_35px_rgba(168,85,247,0.4)] backdrop-blur-sm" />
        </div>
        <div className="absolute right-0 top-[25%] animate-[sphere2_15s_ease-in-out_infinite]">
          <div className="h-12 w-12 rounded-full border border-white/30 bg-gradient-to-br from-cyan-200/80 via-blue-500/50 to-indigo-800/70 shadow-[inset_-6px_-6px_14px_rgba(0,0,0,0.3),0_0_30px_rgba(34,211,238,0.4)]" />
        </div>
        <div className="absolute left-[20%] top-[45%] animate-[sphere3_11s_ease-in-out_infinite]">
          <div className="h-10 w-10 rounded-full border border-white/30 bg-gradient-to-br from-fuchsia-200/80 to-purple-700/70 shadow-[inset_-5px_-5px_12px_rgba(0,0,0,0.3),0_0_25px_rgba(217,70,239,0.4)]" />
        </div>
        <div className="absolute right-[15%] bottom-[10%] animate-[sphere4_14s_ease-in-out_infinite]">
          <div className="h-20 w-20 rounded-full border border-white/20 bg-gradient-to-br from-violet-200/70 via-indigo-500/50 to-purple-900/70 shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.35),0_0_40px_rgba(99,102,241,0.35)]" />
        </div>
        <div className="absolute left-[45%] top-[5%] animate-[sphere5_13s_ease-in-out_infinite]">
          <div className="h-8 w-8 rounded-full border border-white/40 bg-gradient-to-br from-rose-200/80 to-red-600/70 shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.3),0_0_25px_rgba(244,63,94,0.4)]" />
        </div>
        <div className="absolute right-[30%] top-[60%] animate-[sphere6_17s_ease-in-out_infinite]">
          <div className="h-14 w-14 rounded-full border border-white/30 bg-gradient-to-br from-emerald-200/70 via-teal-500/50 to-blue-800/70 shadow-[inset_-7px_-7px_15px_rgba(0,0,0,0.3),0_0_30px_rgba(45,212,191,0.3)]" />
        </div>
        <div className="absolute left-[65%] bottom-[5%] animate-[sphere7_9s_ease-in-out_infinite]">
          <div className="h-6 w-6 rounded-full border border-white/40 bg-gradient-to-br from-amber-200/80 to-orange-600/70 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.3),0_0_22px_rgba(251,146,60,0.5)]" />
        </div>
      </div>

      {/* Main Card Container */}
      <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-7">
        {/* Logout button (When Authenticated) */}
        {isAuthenticated && (
          <div className="mb-2 flex justify-end">
            <button
              onClick={handleLogout}
              className="text-xs font-medium text-indigo-200/80 hover:text-white underline underline-offset-4"
            >
              Sign Out
            </button>
          </div>
        )}

        {/* --- STEP 1: AUTHENTICATION (Login / Signup) --- */}
        {!isAuthenticated ? (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <h1 className="!my-0 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </h1>
              <p className="mt-2 text-sm text-indigo-100/70">
                {isSignUp ? "Sign up to send messages." : "Sign in to access the contact form."}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-indigo-50">Email Address</label>
                <input
                  name="email"
                  type="email"
                  value={authData.email}
                  onChange={handleAuthChange}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-indigo-50">Password</label>
                <input
                  name="password"
                  type="password"
                  value={authData.password}
                  onChange={handleAuthChange}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
              >
                {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
              </button>
            </form>

            <div className="mt-4 text-center text-sm text-indigo-100/70">
              {isSignUp ? (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(false); setStatus({ type: "", message: "" }); }}
                    className="font-semibold text-violet-300 underline"
                  >
                    Sign In
                  </button>
                </p>
              ) : (
                <p>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(true); setStatus({ type: "", message: "" }); }}
                    className="font-semibold text-violet-300 underline"
                  >
                    Sign Up
                  </button>
                </p>
              )}
            </div>
          </>
        ) : (
          /* --- STEP 2: CONTACT FORM & OTP --- */
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              </div>
              <h1 className="!my-0 text-2xl font-bold tracking-tight text-white sm:text-3xl">Get in Touch</h1>
              <p className="mt-2 text-sm text-indigo-100/70">We'd love to hear from you.</p>
            </div>

            {!otpStep ? (
              <form onSubmit={handleSendOtp} className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-indigo-50">Full Name</label>
                  <input
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleContactChange}
                    placeholder="Your full name"
                    required
                    className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-indigo-50">Email Address</label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleContactChange}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-indigo-50">Subject</label>
                  <input
                    name="subject"
                    type="text"
                    value={formData.subject}
                    onChange={handleContactChange}
                    placeholder="How can we help?"
                    className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-indigo-50">Your Message</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleContactChange}
                    placeholder="Write your message..."
                    rows={3}
                    required
                    className="w-full resize-y rounded-xl border border-white/15 bg-slate-950/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
                >
                  {loading ? "Sending OTP..." : "Send Verification Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-white">Verify your email</h2>
                  <p className="mt-2 text-sm text-indigo-100/70">
                    6-digit code sent to {formData.email}.
                  </p>
                </div>
                <div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    required
                    className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Verify & Send Message"}
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="w-full rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-indigo-100 hover:bg-white/10 disabled:opacity-60"
                >
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => { setOtpStep(false); setOtp(""); setStatus({ type: "", message: "" }); }}
                  disabled={loading}
                  className="w-full text-sm text-indigo-200/70 underline underline-offset-4"
                >
                  Back to contact form
                </button>
              </form>
            )}
          </>
        )}

        {/* Status Message */}
        {status.message && (
          <p
            role="status"
            aria-live="polite"
            className={`mt-3 rounded-lg px-3 py-2 text-xs ${
              status.type === "success" ? "bg-green-400/10 text-green-300" : "bg-red-400/10 text-red-300"
            }`}
          >
            {status.message}
          </p>
        )}

        <p className="mt-5 text-center text-xs text-indigo-100/50">
          <span className="mr-1">✦</span> Secure authentication system.
        </p>
      </section>

      {/* Sphere Animations Style */}
      <style>{`
        @keyframes sphere1 { 0% { transform: translate(0, 0); } 25% { transform: translate(25vw, 20vh); } 50% { transform: translate(60vw, 5vh); } 75% { transform: translate(75vw, 55vh); } 100% { transform: translate(0, 0); } }
        @keyframes sphere2 { 0% { transform: translate(0, 0); } 25% { transform: translate(-30vw, 20vh); } 50% { transform: translate(-65vw, 40vh); } 75% { transform: translate(-25vw, 60vh); } 100% { transform: translate(0, 0); } }
        @keyframes sphere3 { 0% { transform: translate(0, 0); } 25% { transform: translate(25vw, -20vh); } 50% { transform: translate(55vw, 10vh); } 75% { transform: translate(20vw, 35vh); } 100% { transform: translate(0, 0); } }
        @keyframes sphere4 { 0% { transform: translate(0, 0); } 25% { transform: translate(-30vw, -25vh); } 50% { transform: translate(-65vw, -45vh); } 75% { transform: translate(-20vw, -20vh); } 100% { transform: translate(0, 0); } }
        @keyframes sphere5 { 0% { transform: translate(0, 0); } 25% { transform: translate(30vw, 30vh); } 50% { transform: translate(-15vw, 55vh); } 75% { transform: translate(35vw, 65vh); } 100% { transform: translate(0, 0); } }
        @keyframes sphere6 { 0% { transform: translate(0, 0); } 25% { transform: translate(-35vw, -15vh); } 50% { transform: translate(15vw, -45vh); } 75% { transform: translate(-45vw, -25vh); } 100% { transform: translate(0, 0); } }
        @keyframes sphere7 { 0% { transform: translate(0, 0); } 25% { transform: translate(-45vw, -35vh); } 50% { transform: translate(-15vw, -65vh); } 75% { transform: translate(-60vw, -20vh); } 100% { transform: translate(0, 0); } }
      `}</style>
    </main>
  );
}


