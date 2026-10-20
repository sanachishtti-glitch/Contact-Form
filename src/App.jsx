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
      `Server ne JSON response nahi diya. HTTP status: ${response.status}. Backend aur API URL check karein.`
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
        // Agar token invalid/expired ho toh clear storage and redirect to login
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
          message: result.message || "Account successfully ban gaya! Ab Sign In karein.",
        });
        setIsSignUp(false);
      } else {
        if (!result.token) {
          throw new Error("Login token nahi mila.");
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
        message: error.message || "Operation failed. Dobara try karein.",
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
        message: result.message || "Verification code aapki email par bhej diya gaya hai.",
      });
    } catch (error) {
      // Bug 2 Fix: Relying on preserved status code instead of string includes
      if (error.status === 401) {
        handleLogout();
        setStatus({ type: "error", message: "Session expire ho gaya hai. Please dubara login karein." });
      } else {
        setStatus({ type: "error", message: error.message || "Backend server check karein." });
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
        message: result.message || "Email verified! Message successfully send ho gaya.",
      });
      setFormData({ name: "", email: formData.email, subject: "", message: "" });
      setOtp("");
      setOtpStep(false);
    } catch (error) {
      // Bug 2 Fix: Reliable 401 status check
      if (error.status === 401) {
        handleLogout();
        setStatus({ type: "error", message: "Session expire ho gaya hai. Please dubara login karein." });
      } else {
        setStatus({ type: "error", message: error.message || "OTP verify nahi ho saka." });
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
      setStatus({ type: "success", message: result.message || "Naya OTP bhej diya gaya hai." });
    } catch (error) {
      if (error.status === 401) {
        handleLogout();
        setStatus({ type: "error", message: "Session expire ho gaya hai. Please dubara login karein." });
      } else {
        setStatus({ type: "error", message: error.message || "OTP resend nahi ho saka." });
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







// import { useState } from "react";

// async function readApiResponse(response) {
//   const text = await response.text();

//   let result;
//   try {
//     result = JSON.parse(text);
//   } catch {
//     throw new Error(
//       `Server ne JSON response nahi diya. HTTP status: ${response.status}. Backend aur API URL check karein.`
//     );
//   }

//   if (!response.ok || result.success === false) {
//     throw new Error(result.message || "Request failed.");
//   }

//   return result;
// }

// export default function App() {
//   // Authentication states
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [isSignUp, setIsSignUp] = useState(false);
//   const [authData, setAuthData] = useState({ email: "", password: "" });

//   // Contact form states
//   const [formData, setFormData] = useState({
//     name: "",
//     email: "",
//     subject: "",
//     message: "",
//   });

//   const [loading, setLoading] = useState(false);
//   const [otpStep, setOtpStep] = useState(false);
//   const [otp, setOtp] = useState("");

//   const [status, setStatus] = useState({
//     type: "",
//     message: "",
//   });

//   // Handlers for Auth
//   const handleAuthChange = (e) => {
//     const { name, value } = e.target;
//     setAuthData((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleAuthSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setStatus({ type: "", message: "" });

//     const endpoint = isSignUp
//       ? "http://localhost:5000/api/auth/signup"
//       : "http://localhost:5000/api/auth/login";

//     try {
//       const response = await fetch(endpoint, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(authData),
//       });

//       const result = await readApiResponse(response);

//       if (!isSignUp && result.token) {
//         localStorage.setItem("authToken", result.token);
//       }

//       setStatus({
//         type: "success",
//         message: result.message || (isSignUp ? "Account successfully ban gaya! Ab Sign In karein." : "Login successful!"),
//       });

//       if (isSignUp) {
//         setIsSignUp(false);
//       } else {
//         // Auto fill email in contact form and switch view
//         setFormData((prev) => ({ ...prev, email: authData.email }));
//         setIsAuthenticated(true);
//       }

//       setAuthData({ email: "", password: "" });
//     } catch (error) {
//       setStatus({
//         type: "error",
//         message: error.message || "Operation failed. Dobara try karein.",
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handlers for Contact Form
//   const handleContactChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({
//       ...prev,
//       [name]: value,
//     }));
//   };

//   const handleSendOtp = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setStatus({ type: "", message: "" });
//     try {
//       const response = await fetch("http://localhost:5000/api/contact/send-otp", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(formData),
//       });

//       const result = await readApiResponse(response);
//       setOtpStep(true);
//       setStatus({
//         type: "success",
//         message: result.message || "Verification code aapki email par bhej diya gaya hai.",
//       });
//     } catch (error) {
//       setStatus({ type: "error", message: error.message || "Backend server check karein." });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleVerifyOtp = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setStatus({ type: "", message: "" });
//     try {
//       const response = await fetch("http://localhost:5000/api/contact/verify-otp", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email: formData.email, otp }),
//       });
//       const result = await readApiResponse(response);
//       setStatus({
//         type: "success",
//         message: result.message || "Email verified! Message successfully send ho gaya.",
//       });
//       setFormData({ name: "", email: formData.email, subject: "", message: "" });
//       setOtp("");
//       setOtpStep(false);
//     } catch (error) {
//       setStatus({ type: "error", message: error.message || "OTP verify nahi ho saka." });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleResendOtp = async () => {
//     setLoading(true);
//     setStatus({ type: "", message: "" });
//     try {
//       const response = await fetch("http://localhost:5000/api/contact/send-otp", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(formData),
//       });
//       const result = await readApiResponse(response);
//       setStatus({ type: "success", message: result.message || "Naya OTP bhej diya gaya hai." });
//     } catch (error) {
//       setStatus({ type: "error", message: error.message || "OTP resend nahi ho saka." });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleLogout = () => {
//     localStorage.removeItem("authToken");
//     setIsAuthenticated(false);
//     setOtpStep(false);
//     setStatus({ type: "", message: "" });
//   };

//   return (
//     <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 px-4 py-8">
//       {/* Animated Floating Spheres Background */}
//       <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
//         <div className="absolute left-0 top-[10%] animate-[sphere1_12s_ease-in-out_infinite]">
//           <div className="h-16 w-16 rounded-full border border-white/30 bg-gradient-to-br from-pink-300/70 via-purple-500/50 to-indigo-700/70 shadow-[inset_-8px_-8px_18px_rgba(0,0,0,0.3),0_0_35px_rgba(168,85,247,0.4)] backdrop-blur-sm" />
//         </div>
//         <div className="absolute right-0 top-[25%] animate-[sphere2_15s_ease-in-out_infinite]">
//           <div className="h-12 w-12 rounded-full border border-white/30 bg-gradient-to-br from-cyan-200/80 via-blue-500/50 to-indigo-800/70 shadow-[inset_-6px_-6px_14px_rgba(0,0,0,0.3),0_0_30px_rgba(34,211,238,0.4)]" />
//         </div>
//         <div className="absolute left-[20%] top-[45%] animate-[sphere3_11s_ease-in-out_infinite]">
//           <div className="h-10 w-10 rounded-full border border-white/30 bg-gradient-to-br from-fuchsia-200/80 to-purple-700/70 shadow-[inset_-5px_-5px_12px_rgba(0,0,0,0.3),0_0_25px_rgba(217,70,239,0.4)]" />
//         </div>
//         <div className="absolute right-[15%] bottom-[10%] animate-[sphere4_14s_ease-in-out_infinite]">
//           <div className="h-20 w-20 rounded-full border border-white/20 bg-gradient-to-br from-violet-200/70 via-indigo-500/50 to-purple-900/70 shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.35),0_0_40px_rgba(99,102,241,0.35)]" />
//         </div>
//         <div className="absolute left-[45%] top-[5%] animate-[sphere5_13s_ease-in-out_infinite]">
//           <div className="h-8 w-8 rounded-full border border-white/40 bg-gradient-to-br from-rose-200/80 to-red-600/70 shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.3),0_0_25px_rgba(244,63,94,0.4)]" />
//         </div>
//         <div className="absolute right-[30%] top-[60%] animate-[sphere6_17s_ease-in-out_infinite]">
//           <div className="h-14 w-14 rounded-full border border-white/30 bg-gradient-to-br from-emerald-200/70 via-teal-500/50 to-blue-800/70 shadow-[inset_-7px_-7px_15px_rgba(0,0,0,0.3),0_0_30px_rgba(45,212,191,0.3)]" />
//         </div>
//         <div className="absolute left-[65%] bottom-[5%] animate-[sphere7_9s_ease-in-out_infinite]">
//           <div className="h-6 w-6 rounded-full border border-white/40 bg-gradient-to-br from-amber-200/80 to-orange-600/70 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.3),0_0_22px_rgba(251,146,60,0.5)]" />
//         </div>
//       </div>

//       {/* Main Card Container */}
//       <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-7">
//         {/* Logout button (When Authenticated) */}
//         {isAuthenticated && (
//           <div className="mb-2 flex justify-end">
//             <button
//               onClick={handleLogout}
//               className="text-xs font-medium text-indigo-200/80 hover:text-white underline underline-offset-4"
//             >
//               Sign Out
//             </button>
//           </div>
//         )}

//         {/* --- STEP 1: AUTHENTICATION (Login / Signup) --- */}
//         {!isAuthenticated ? (
//           <>
//             <div className="mb-6 text-center">
//               <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
//                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
//                   <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
//                   <polyline points="10 17 15 12 10 7" />
//                   <line x1="15" y1="12" x2="3" y2="12" />
//                 </svg>
//               </div>
//               <h1 className="!my-0 text-2xl font-bold tracking-tight text-white sm:text-3xl">
//                 {isSignUp ? "Create Account" : "Welcome Back"}
//               </h1>
//               <p className="mt-2 text-sm text-indigo-100/70">
//                 {isSignUp ? "Sign up to send messages." : "Sign in to access the contact form."}
//               </p>
//             </div>

//             <form onSubmit={handleAuthSubmit} className="space-y-4">
//               <div>
//                 <label className="mb-1.5 block text-sm font-medium text-indigo-50">Email Address</label>
//                 <input
//                   name="email"
//                   type="email"
//                   value={authData.email}
//                   onChange={handleAuthChange}
//                   placeholder="you@example.com"
//                   required
//                   className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//                 />
//               </div>

//               <div>
//                 <label className="mb-1.5 block text-sm font-medium text-indigo-50">Password</label>
//                 <input
//                   name="password"
//                   type="password"
//                   value={authData.password}
//                   onChange={handleAuthChange}
//                   placeholder="••••••••"
//                   required
//                   className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//                 />
//               </div>

//               <button
//                 type="submit"
//                 disabled={loading}
//                 className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
//               >
//                 {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
//               </button>
//             </form>

//             <div className="mt-4 text-center text-sm text-indigo-100/70">
//               {isSignUp ? (
//                 <p>
//                   Already have an account?{" "}
//                   <button
//                     type="button"
//                     onClick={() => { setIsSignUp(false); setStatus({ type: "", message: "" }); }}
//                     className="font-semibold text-violet-300 underline"
//                   >
//                     Sign In
//                   </button>
//                 </p>
//               ) : (
//                 <p>
//                   Don't have an account?{" "}
//                   <button
//                     type="button"
//                     onClick={() => { setIsSignUp(true); setStatus({ type: "", message: "" }); }}
//                     className="font-semibold text-violet-300 underline"
//                   >
//                     Sign Up
//                   </button>
//                 </p>
//               )}
//             </div>
//           </>
//         ) : (
//           /* --- STEP 2: CONTACT FORM & OTP --- */
//           <>
//             <div className="mb-6 text-center">
//               <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
//                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
//                   <rect x="3" y="5" width="18" height="14" rx="3" />
//                   <path d="m4 7 8 6 8-6" />
//                 </svg>
//               </div>
//               <h1 className="!my-0 text-2xl font-bold tracking-tight text-white sm:text-3xl">Get in Touch</h1>
//               <p className="mt-2 text-sm text-indigo-100/70">We'd love to hear from you.</p>
//             </div>

//             {!otpStep ? (
//               <form onSubmit={handleSendOtp} className="space-y-3.5">
//                 <div>
//                   <label className="mb-1.5 block text-sm font-medium text-indigo-50">Full Name</label>
//                   <input
//                     name="name"
//                     type="text"
//                     value={formData.name}
//                     onChange={handleContactChange}
//                     placeholder="Your full name"
//                     required
//                     className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//                   />
//                 </div>

//                 <div>
//                   <label className="mb-1.5 block text-sm font-medium text-indigo-50">Email Address</label>
//                   <input
//                     name="email"
//                     type="email"
//                     value={formData.email}
//                     onChange={handleContactChange}
//                     placeholder="you@example.com"
//                     required
//                     className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//                   />
//                 </div>

//                 <div>
//                   <label className="mb-1.5 block text-sm font-medium text-indigo-50">Subject</label>
//                   <input
//                     name="subject"
//                     type="text"
//                     value={formData.subject}
//                     onChange={handleContactChange}
//                     placeholder="How can we help?"
//                     className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//                   />
//                 </div>

//                 <div>
//                   <label className="mb-1.5 block text-sm font-medium text-indigo-50">Your Message</label>
//                   <textarea
//                     name="message"
//                     value={formData.message}
//                     onChange={handleContactChange}
//                     placeholder="Write your message..."
//                     rows={3}
//                     required
//                     className="w-full resize-y rounded-xl border border-white/15 bg-slate-950/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//                   />
//                 </div>

//                 <button
//                   type="submit"
//                   disabled={loading}
//                   className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
//                 >
//                   {loading ? "Sending OTP..." : "Send Verification Code"}
//                 </button>
//               </form>
//             ) : (
//               <form onSubmit={handleVerifyOtp} className="space-y-4">
//                 <div className="text-center">
//                   <h2 className="text-lg font-semibold text-white">Verify your email</h2>
//                   <p className="mt-2 text-sm text-indigo-100/70">
//                     6-digit code sent to {formData.email}.
//                   </p>
//                 </div>
//                 <div>
//                   <input
//                     type="text"
//                     maxLength={6}
//                     value={otp}
//                     onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
//                     placeholder="Enter 6-digit OTP"
//                     required
//                     className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//                   />
//                 </div>
//                 <button
//                   type="submit"
//                   disabled={loading || otp.length !== 6}
//                   className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
//                 >
//                   {loading ? "Verifying..." : "Verify & Send Message"}
//                 </button>
//                 <button
//                   type="button"
//                   onClick={handleResendOtp}
//                   disabled={loading}
//                   className="w-full rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-indigo-100 hover:bg-white/10 disabled:opacity-60"
//                 >
//                   Resend OTP
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => { setOtpStep(false); setOtp(""); setStatus({ type: "", message: "" }); }}
//                   disabled={loading}
//                   className="w-full text-sm text-indigo-200/70 underline underline-offset-4"
//                 >
//                   Back to contact form
//                 </button>
//               </form>
//             )}
//           </>
//         )}

//         {/* Status Message */}
//         {status.message && (
//           <p
//             role="status"
//             aria-live="polite"
//             className={`mt-3 rounded-lg px-3 py-2 text-xs ${
//               status.type === "success" ? "bg-green-400/10 text-green-300" : "bg-red-400/10 text-red-300"
//             }`}
//           >
//             {status.message}
//           </p>
//         )}

//         <p className="mt-5 text-center text-xs text-indigo-100/50">
//           <span className="mr-1">✦</span> Secure authentication system.
//         </p>
//       </section>

//       {/* Sphere Animations Style */}
//       <style>{`
//         @keyframes sphere1 { 0% { transform: translate(0, 0); } 25% { transform: translate(25vw, 20vh); } 50% { transform: translate(60vw, 5vh); } 75% { transform: translate(75vw, 55vh); } 100% { transform: translate(0, 0); } }
//         @keyframes sphere2 { 0% { transform: translate(0, 0); } 25% { transform: translate(-30vw, 20vh); } 50% { transform: translate(-65vw, 40vh); } 75% { transform: translate(-25vw, 60vh); } 100% { transform: translate(0, 0); } }
//         @keyframes sphere3 { 0% { transform: translate(0, 0); } 25% { transform: translate(25vw, -20vh); } 50% { transform: translate(55vw, 10vh); } 75% { transform: translate(20vw, 35vh); } 100% { transform: translate(0, 0); } }
//         @keyframes sphere4 { 0% { transform: translate(0, 0); } 25% { transform: translate(-30vw, -25vh); } 50% { transform: translate(-65vw, -45vh); } 75% { transform: translate(-20vw, -20vh); } 100% { transform: translate(0, 0); } }
//         @keyframes sphere5 { 0% { transform: translate(0, 0); } 25% { transform: translate(30vw, 30vh); } 50% { transform: translate(-15vw, 55vh); } 75% { transform: translate(35vw, 65vh); } 100% { transform: translate(0, 0); } }
//         @keyframes sphere6 { 0% { transform: translate(0, 0); } 25% { transform: translate(-35vw, -15vh); } 50% { transform: translate(15vw, -45vh); } 75% { transform: translate(-45vw, -25vh); } 100% { transform: translate(0, 0); } }
//         @keyframes sphere7 { 0% { transform: translate(0, 0); } 25% { transform: translate(-45vw, -35vh); } 50% { transform: translate(-15vw, -65vh); } 75% { transform: translate(-60vw, -20vh); } 100% { transform: translate(0, 0); } }
//       `}</style>
//     </main>
//   );
// }

// upr wala  code bugs wala







// import { useState as useReactState } from "react";

// async function readApiResponse(response) {
//   const text = await response.text();

//   let result;
//   try {
//     result = JSON.parse(text);
//   } catch {
//     throw new Error(
//       `Server ne JSON response nahi diya. HTTP status: ${response.status}. Backend aur API URL check karein.`
//     );
//   }

//   if (!response.ok || result.success === false) {
//     throw new Error(result.message || "Request failed.");
//   }

//   return result;
// }

// export default function App() {
//   const [isSignUp, setIsSignUp] = useReactState(false); // Toggle between Login & Signup
//   const [formData, setFormData] = useReactState({
//     email: "",
//     password: "",
//   });

//   const [loading, setLoading] = useReactState(false);
//   const [status, setStatus] = useReactState({
//     type: "",
//     message: "",
//   });

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({
//       ...prev,
//       [name]: value,
//     }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setStatus({ type: "", message: "" });

//     // Endpoint decide karein ki Sign In hai ya Sign Up
//     const endpoint = isSignUp 
//       ? "http://localhost:5000/api/auth/signup" 
//       : "http://localhost:5000/api/auth/login";

//     try {
//       const response = await fetch(endpoint, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(formData),
//       });

//       const result = await readApiResponse(response);
      
//       // Agar login hai aur token mila hai toh save karein
//       if (!isSignUp && result.token) {
//         localStorage.setItem("authToken", result.token);
//       }

//       setStatus({ 
//         type: "success", 
//         message: result.message || (isSignUp ? "Account successfully ban gaya!" : "Login successful!") 
//       });
      
//       // Agar signup successful ho jaye toh user ko login par switch kar sakte hain
//       if (isSignUp) {
//         setIsSignUp(false);
//       }
      
//       setFormData({ email: "", password: "" });
//     } catch (error) {
//       setStatus({ 
//         type: "error", 
//         message: error.message || "Operation fail ho gaya. Dobara koshish karein." 
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 px-4 py-8">

//       {/* Animated Floating Spheres Background */}
//       <div
//         className="pointer-events-none absolute inset-0 overflow-hidden"
//         aria-hidden="true"
//       >
//         <div className="absolute left-0 top-[10%] animate-[sphere1_12s_ease-in-out_infinite]">
//           <div className="h-16 w-16 rounded-full border border-white/30 bg-gradient-to-br from-pink-300/70 via-purple-500/50 to-indigo-700/70 shadow-[inset_-8px_-8px_18px_rgba(0,0,0,0.3),0_0_35px_rgba(168,85,247,0.4)] backdrop-blur-sm" />
//         </div>
//         <div className="absolute right-0 top-[25%] animate-[sphere2_15s_ease-in-out_infinite]">
//           <div className="h-12 w-12 rounded-full border border-white/30 bg-gradient-to-br from-cyan-200/80 via-blue-500/50 to-indigo-800/70 shadow-[inset_-6px_-6px_14px_rgba(0,0,0,0.3),0_0_30px_rgba(34,211,238,0.4)]" />
//         </div>
//         <div className="absolute left-[20%] top-[45%] animate-[sphere3_11s_ease-in-out_infinite]">
//           <div className="h-10 w-10 rounded-full border border-white/30 bg-gradient-to-br from-fuchsia-200/80 to-purple-700/70 shadow-[inset_-5px_-5px_12px_rgba(0,0,0,0.3),0_0_25px_rgba(217,70,239,0.4)]" />
//         </div>
//         <div className="absolute right-[15%] bottom-[10%] animate-[sphere4_14s_ease-in-out_infinite]">
//           <div className="h-20 w-20 rounded-full border border-white/20 bg-gradient-to-br from-violet-200/70 via-indigo-500/50 to-purple-900/70 shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.35),0_0_40px_rgba(99,102,241,0.35)]" />
//         </div>
//         <div className="absolute left-[45%] top-[5%] animate-[sphere5_13s_ease-in-out_infinite]">
//           <div className="h-8 w-8 rounded-full border border-white/40 bg-gradient-to-br from-rose-200/80 to-red-600/70 shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.3),0_0_25px_rgba(244,63,94,0.4)]" />
//         </div>
//         <div className="absolute right-[30%] top-[60%] animate-[sphere6_17s_ease-in-out_infinite]">
//           <div className="h-14 w-14 rounded-full border border-white/30 bg-gradient-to-br from-emerald-200/70 via-teal-500/50 to-blue-800/70 shadow-[inset_-7px_-7px_15px_rgba(0,0,0,0.3),0_0_30px_rgba(45,212,191,0.3)]" />
//         </div>
//         <div className="absolute left-[65%] bottom-[5%] animate-[sphere7_9s_ease-in-out_infinite]">
//           <div className="h-6 w-6 rounded-full border border-white/40 bg-gradient-to-br from-amber-200/80 to-orange-600/70 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.3),0_0_22px_rgba(251,146,60,0.5)]" />
//         </div>
//       </div>

//       {/* Auth Card */}
//       <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-7">

//         {/* Header */}
//         <div className="mb-6 text-center">
//           <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
//             <svg
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="1.7"
//               className="h-6 w-6"
//               aria-hidden="true"
//             >
//               <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
//               <polyline points="10 17 15 12 10 7" />
//               <line x1="15" y1="12" x2="3" y2="12" />
//             </svg>
//           </div>

//           <h1 className="!my-0 text-2xl font-bold tracking-tight text-white sm:text-3xl">
//             {isSignUp ? "Create Account" : "Welcome Back"}
//           </h1>

//           <p className="mt-2 text-sm text-indigo-100/70">
//             {isSignUp ? "Sign up to get started." : "Please enter your details to sign in."}
//           </p>
//         </div>

//         {/* Form */}
//         <form onSubmit={handleSubmit} className="space-y-4">

//           {/* Email */}
//           <div>
//             <label
//               htmlFor="email"
//               className="mb-1.5 block text-sm font-medium text-indigo-50"
//             >
//               Email Address
//             </label>
//             <input
//               id="email"
//               name="email"
//               type="email"
//               value={formData.email}
//               onChange={handleChange}
//               placeholder="you@example.com"
//               required
//               maxLength={254}
//               autoComplete="email"
//               className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//             />
//           </div>

//           {/* Password */}
//           <div>
//             <label
//               htmlFor="password"
//               className="mb-1.5 block text-sm font-medium text-indigo-50"
//             >
//               Password
//             </label>
//             <input
//               id="password"
//               name="password"
//               type="password"
//               value={formData.password}
//               onChange={handleChange}
//               placeholder="••••••••"
//               required
//               maxLength={128}
//               autoComplete={isSignUp ? "new-password" : "current-password"}
//               className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//             />
//           </div>

//           {/* Submit Button */}
//           <button
//             type="submit"
//             disabled={loading}
//             className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition duration-300 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
//           >
//             {loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Sign Up" : "Sign In")}

//             {!loading && (
//               <svg
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="1.8"
//                 className="h-4 w-4"
//                 aria-hidden="true"
//               >
//                 <path d="M5 12h14" />
//                 <path d="m12 5 7 7-7 7" />
//               </svg>
//             )}
//           </button>

//         </form>

//         {/* Toggle between Login and Signup */}
//         <div className="mt-4 text-center text-sm text-indigo-100/70">
//           {isSignUp ? (
//             <p>
//               Already have an account?{" "}
//               <button
//                 type="button"
//                 onClick={() => { setIsSignUp(false); setStatus({ type: "", message: "" }); }}
//                 className="font-semibold text-violet-300 underline hover:text-violet-200"
//               >
//                 Sign In
//               </button>
//             </p>
//           ) : (
//             <p>
//               Don't have an account?{" "}
//               <button
//                 type="button"
//                 onClick={() => { setIsSignUp(true); setStatus({ type: "", message: "" }); }}
//                 className="font-semibold text-violet-300 underline hover:text-violet-200"
//               >
//                 Sign Up
//               </button>
//             </p>
//           )}
//         </div>

//         {status.message && (
//           <p role="status" aria-live="polite"
//             className={`mt-3 rounded-lg px-3 py-2 text-xs ${
//               status.type === "success" ? "bg-green-400/10 text-green-300" : "bg-red-400/10 text-red-300"
//             }`}>
//             {status.message}
//           </p>
//         )}

//         <p className="mt-5 text-center text-xs text-indigo-100/50">
//           <span className="mr-1">✦</span>
//           Secure authentication system.
//         </p>
//       </section>

//       {/* Floating Sphere Animations CSS */}
//       <style>{`
//         @keyframes sphere1 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(25vw, 20vh); }
//           50% { transform: translate(60vw, 5vh); }
//           75% { transform: translate(75vw, 55vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere2 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-30vw, 20vh); }
//           50% { transform: translate(-65vw, 40vh); }
//           75% { transform: translate(-25vw, 60vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere3 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(25vw, -20vh); }
//           50% { transform: translate(55vw, 10vh); }
//           75% { transform: translate(20vw, 35vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere4 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-30vw, -25vh); }
//           50% { transform: translate(-65vw, -45vh); }
//           75% { transform: translate(-20vw, -20vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere5 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(30vw, 30vh); }
//           50% { transform: translate(-15vw, 55vh); }
//           75% { transform: translate(35vw, 65vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere6 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-35vw, -15vh); }
//           50% { transform: translate(15vw, -45vh); }
//           75% { transform: translate(-45vw, -25vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere7 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-45vw, -35vh); }
//           50% { transform: translate(-15vw, -65vh); }
//           75% { transform: translate(-60vw, -20vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @media (prefers-reduced-motion: reduce) {
//           .animate-\\[sphere1_12s_ease-in-out_infinite\\],
//           .animate-\\[sphere2_15s_ease-in-out_infinite\\],
//           .animate-\\[sphere3_11s_ease-in-out_infinite\\],
//           .animate-\\[sphere4_14s_ease-in-out_infinite\\],
//           .animate-\\[sphere5_13s_ease-in-out_infinite\\],
//           .animate-\\[sphere6_17s_ease-in-out_infinite\\],
//           .animate-\\[sphere7_9s_ease-in-out_infinite\\] {
//             animation: none;
//           }
//         }
//       `}</style>
//     </main>
//   );
// }















// nichy wala purana form msg 
// wala code upr wala login wala code 



// import { useState } from "react";

// async function readApiResponse(response) {
//   const text = await response.text();

//   let result;
//   try {
//     result = JSON.parse(text);
//   } catch {
//     throw new Error(
//       `Server ne JSON response nahi diya. HTTP status: ${response.status}. Backend aur API URL check karein.`
//     );
//   }

//   if (!response.ok || result.success === false) {
//     throw new Error(result.message || "Request failed.");
//   }

//   return result;
// }

// export default function App() {
//   const [formData, setFormData] = useState({
//     name: "",
//     email: "",
//     subject: "",
//     message: "",
//   });

//   const [loading, setLoading] = useState(false);
//   const [otpStep, setOtpStep] = useState(false);
//   const [otp, setOtp] = useState("");

//   const [status, setStatus] = useState({
//     type: "",
//     message: "",
//   });

//   const handleChange = (e) => {
//     const { name, value } = e.target;

//     setFormData((prev) => ({
//       ...prev,
//       [name]: value,
//     }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setStatus({ type: "", message: "" });
//     try {
//       const response = await fetch("http://localhost:5000/api/contact/send-otp", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(formData),
//       });
 
//         const result = await readApiResponse(response);
//       setOtpStep(true);
//       setStatus({ type: "success", message: result.message || "Verification code aapki email par bhej diya gaya hai." });
//     } catch (error) {
//       setStatus({ type: "error", message: error.message || "Backend server check karein." });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleVerifyOtp = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setStatus({ type: "", message: "" });
//     try {
//       const response = await fetch("http://localhost:5000/api/contact/verify-otp", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email: formData.email, otp }),
//       });
//       const result = await response.json();
//       if (!response.ok || result.success === false) throw new Error(result.message || "OTP verify nahi ho saka.");
//       setStatus({ type: "success", message: result.message || "Email verified! Message successfully send ho gaya." });
//       setFormData({ name: "", email: "", subject: "", message: "" });
//       setOtp("");
//       setOtpStep(false);
//     } catch (error) {
//       setStatus({ type: "error", message: error.message || "OTP verify nahi ho saka." });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleResendOtp = async () => {
//     setLoading(true);
//     setStatus({ type: "", message: "" });
//     try {
//       const response = await fetch("http://localhost:5000/api/contact/send-otp", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(formData),
//       });
//       const result = await response.json();
//       if (!response.ok || result.success === false) throw new Error(result.message || "OTP resend nahi ho saka.");
//       setStatus({ type: "success", message: result.message || "Naya OTP bhej diya gaya hai." });
//     } catch (error) {
//       setStatus({ type: "error", message: error.message || "OTP resend nahi ho saka." });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 px-4 py-8">

//       {/* Animated Floating Spheres Background */}
//       <div
//         className="pointer-events-none absolute inset-0 overflow-hidden"
//         aria-hidden="true"
//       >
//         {/* Sphere 1 */}
//         <div className="absolute left-0 top-[10%] animate-[sphere1_12s_ease-in-out_infinite]">
//           <div className="h-16 w-16 rounded-full border border-white/30 bg-gradient-to-br from-pink-300/70 via-purple-500/50 to-indigo-700/70 shadow-[inset_-8px_-8px_18px_rgba(0,0,0,0.3),0_0_35px_rgba(168,85,247,0.4)] backdrop-blur-sm" />
//         </div>

//         {/* Sphere 2 */}
//         <div className="absolute right-0 top-[25%] animate-[sphere2_15s_ease-in-out_infinite]">
//           <div className="h-12 w-12 rounded-full border border-white/30 bg-gradient-to-br from-cyan-200/80 via-blue-500/50 to-indigo-800/70 shadow-[inset_-6px_-6px_14px_rgba(0,0,0,0.3),0_0_30px_rgba(34,211,238,0.4)]" />
//         </div>

//         {/* Sphere 3 */}
//         <div className="absolute left-[20%] top-[45%] animate-[sphere3_11s_ease-in-out_infinite]">
//           <div className="h-10 w-10 rounded-full border border-white/30 bg-gradient-to-br from-fuchsia-200/80 to-purple-700/70 shadow-[inset_-5px_-5px_12px_rgba(0,0,0,0.3),0_0_25px_rgba(217,70,239,0.4)]" />
//         </div>

//         {/* Sphere 4 */}
//         <div className="absolute right-[15%] bottom-[10%] animate-[sphere4_14s_ease-in-out_infinite]">
//           <div className="h-20 w-20 rounded-full border border-white/20 bg-gradient-to-br from-violet-200/70 via-indigo-500/50 to-purple-900/70 shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.35),0_0_40px_rgba(99,102,241,0.35)]" />
//         </div>

//         {/* Sphere 5 */}
//         <div className="absolute left-[45%] top-[5%] animate-[sphere5_13s_ease-in-out_infinite]">
//           <div className="h-8 w-8 rounded-full border border-white/40 bg-gradient-to-br from-rose-200/80 to-red-600/70 shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.3),0_0_25px_rgba(244,63,94,0.4)]" />
//         </div>

//         {/* Sphere 6 */}
//         <div className="absolute right-[30%] top-[60%] animate-[sphere6_17s_ease-in-out_infinite]">
//           <div className="h-14 w-14 rounded-full border border-white/30 bg-gradient-to-br from-emerald-200/70 via-teal-500/50 to-blue-800/70 shadow-[inset_-7px_-7px_15px_rgba(0,0,0,0.3),0_0_30px_rgba(45,212,191,0.3)]" />
//         </div>

//         {/* Sphere 7 */}
//         <div className="absolute left-[65%] bottom-[5%] animate-[sphere7_9s_ease-in-out_infinite]">
//           <div className="h-6 w-6 rounded-full border border-white/40 bg-gradient-to-br from-amber-200/80 to-orange-600/70 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.3),0_0_22px_rgba(251,146,60,0.5)]" />
//         </div>
//       </div>

//       {/* Contact Card */}
//       <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-7">

//         {/* Header */}
//         <div className="mb-6 text-center">
//           <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
//             <svg
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="1.7"
//               className="h-6 w-6"
//               aria-hidden="true"
//             >
//               <rect x="3" y="5" width="18" height="14" rx="3" />
//               <path d="m4 7 8 6 8-6" />
//             </svg>
//           </div>

//           <h1 className="!my-0 text-2xl font-bold tracking-tight text-white sm:text-3xl">
//             Get in Touch
//           </h1>

//           <p className="mt-2 text-sm text-indigo-100/70">
//             We'd love to hear from you.
//           </p>
//         </div>

//         {/* Contact Form */}
//         {!otpStep ? (
//         <form onSubmit={handleSubmit} className="space-y-3.5">

//           {/* Name */}
//           <div>
//             <label
//               htmlFor="name"
//               className="mb-1.5 block text-sm font-medium text-indigo-50"
//             >
//               Full Name
//             </label>

//             <input
//               id="name"
//               name="name"
//               type="text"
//               value={formData.name}
//               onChange={handleChange}
//               placeholder="Your full name"
//               required
//               maxLength={100}
//               autoComplete="name"
//               className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//             />
//           </div>

//           {/* Email */}
//           <div>
//             <label
//               htmlFor="email"
//               className="mb-1.5 block text-sm font-medium text-indigo-50"
//             >
//               Email Address
//             </label>

//             <input
//               id="email"
//               name="email"
//               type="email"
//               value={formData.email}
//               onChange={handleChange}
//               placeholder="you@example.com"
//               required
//               maxLength={254}
//               autoComplete="off"
//               className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//             />
//           </div>

//           {/* Subject */}
//           <div>
//             <label
//               htmlFor="subject"
//               className="mb-1.5 block text-sm font-medium text-indigo-50"
//             >
//               Subject
//             </label>

//             <input
//               id="subject"
//               name="subject"
//               type="text"
//               value={formData.subject}
//               onChange={handleChange}
//               placeholder="How can we help?"
//               maxLength={150}
//               className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//             />
//           </div>

//           {/* Message */}
//           <div>
//             <label
//               htmlFor="message"
//               className="mb-1.5 block text-sm font-medium text-indigo-50"
//             >
//               Your Message
//             </label>

//             <textarea
//               id="message"
//               name="message"
//               value={formData.message}
//               onChange={handleChange}
//               placeholder="Write your message..."
//               rows={3}
//               required
//               maxLength={5000}
//               className="w-full resize-y rounded-xl border border-white/15 bg-slate-950/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//             />
//           </div>

//           {/* Submit Button */}
//           <button
//             type="submit"
//             disabled={loading}
//             className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition duration-300 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
//           >
//            {loading ? "Sending OTP..." : "Send Verification Code"}

//             {!loading && (
//               <svg
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="1.8"
//                 className="h-4 w-4"
//                 aria-hidden="true"
//               >
//                 <path d="M22 2 11 13" />
//                 <path d="m22 2-7 20-4-9-9-4Z" />
//               </svg>
//             )}
//           </button>

//         </form>
//         ) : (
//           <form onSubmit={handleVerifyOtp} className="space-y-4">
//             <div className="text-center">
//               <h2 className="text-lg font-semibold text-white">Verify your email</h2>
//               <p className="mt-2 text-sm text-indigo-100/70">
//                 6-digit code sent to {formData.email}. Code 5 minutes tak valid hai.
//               </p>
//             </div>
//             <div>
//               <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-indigo-50">
//                 Verification code
//               </label>
//               <input
//                 id="otp"
//                 name="otp"
//                 type="text"
//                 inputMode="numeric"
//                 autoComplete="one-time-code"
//                 pattern="[0-9]{6}"
//                 maxLength={6}
//                 value={otp}
//                 onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
//                 placeholder="Enter 6-digit OTP"
//                 required
//                 className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//               />
//             </div>
//             <button type="submit" disabled={loading || otp.length !== 6}
//               className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
//               {loading ? "Verifying..." : "Verify & Send Message"}
//             </button>
//             <button type="button" onClick={handleResendOtp} disabled={loading}
//               className="w-full rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-indigo-100 transition hover:bg-white/10 disabled:opacity-60">
//               Resend OTP
//             </button>
//             <button type="button"
//               onClick={() => { setOtpStep(false); setOtp(""); setStatus({ type: "", message: "" }); }}
//               disabled={loading}
//               className="w-full text-sm text-indigo-200/70 underline underline-offset-4">
//               Back to contact form
//             </button>
//           </form>
//         )}

//         {status.message && (
//           <p role="status" aria-live="polite"
//             className={`mt-3 rounded-lg px-3 py-2 text-xs ${
//               status.type === "success" ? "bg-green-400/10 text-green-300" : "bg-red-400/10 text-red-300"
//             }`}>
//             {status.message}
//           </p>
//         )}

//         <p className="mt-5 text-center text-xs text-indigo-100/50">
//           <span className="mr-1">✦</span>
//           Your message matters to us.
//         </p>
//       </section>

//       {/* Floating Sphere Animations */}
//       <style>{`
//         @keyframes sphere1 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(25vw, 20vh); }
//           50% { transform: translate(60vw, 5vh); }
//           75% { transform: translate(75vw, 55vh); }
//           100% { transform: translate(0, 0); }
//         }

//         @keyframes sphere2 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-30vw, 20vh); }
//           50% { transform: translate(-65vw, 40vh); }
//           75% { transform: translate(-25vw, 60vh); }
//           100% { transform: translate(0, 0); }
//         }

//         @keyframes sphere3 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(25vw, -20vh); }
//           50% { transform: translate(55vw, 10vh); }
//           75% { transform: translate(20vw, 35vh); }
//           100% { transform: translate(0, 0); }
//         }

//         @keyframes sphere4 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-30vw, -25vh); }
//           50% { transform: translate(-65vw, -45vh); }
//           75% { transform: translate(-20vw, -20vh); }
//           100% { transform: translate(0, 0); }
//         }

//         @keyframes sphere5 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(30vw, 30vh); }
//           50% { transform: translate(-15vw, 55vh); }
//           75% { transform: translate(35vw, 65vh); }
//           100% { transform: translate(0, 0); }
//         }

//         @keyframes sphere6 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-35vw, -15vh); }
//           50% { transform: translate(15vw, -45vh); }
//           75% { transform: translate(-45vw, -25vh); }
//           100% { transform: translate(0, 0); }
//         }

//         @keyframes sphere7 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-45vw, -35vh); }
//           50% { transform: translate(-15vw, -65vh); }
//           75% { transform: translate(-60vw, -20vh); }
//           100% { transform: translate(0, 0); }
//         }

//         @media (prefers-reduced-motion: reduce) {
//           .animate-\\[sphere1_12s_ease-in-out_infinite\\],
//           .animate-\\[sphere2_15s_ease-in-out_infinite\\],
//           .animate-\\[sphere3_11s_ease-in-out_infinite\\],
//           .animate-\\[sphere4_14s_ease-in-out_infinite\\],
//           .animate-\\[sphere5_13s_ease-in-out_infinite\\],
//           .animate-\\[sphere6_17s_ease-in-out_infinite\\],
//           .animate-\\[sphere7_9s_ease-in-out_infinite\\] {
//             animation: none;
//           }
//         }
//       `}</style>
//     </main>
//   );
// }


// dusra code hooooooooooooooo

// import { useState } from "react";

// async function readApiResponse(response) {
//   const text = await response.text();

//   let result;
//   try {
//     result = JSON.parse(text);
//   } catch {
//     throw new Error(
//       `Server ne JSON response nahi diya. HTTP status: ${response.status}. Backend aur API URL check karein.`
//     );
//   }

//   if (!response.ok || result.success === false) {
//     throw new Error(result.message || "Request failed.");
//   }

//   return result;
// }

// export default function App() {
//   const [formData, setFormData] = useState({
//     email: "",
//     password: "",
//   });

//   const [loading, setLoading] = useState(false);
//   const [status, setStatus] = useState({
//     type: "",
//     message: "",
//   });

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({
//       ...prev,
//       [name]: value,
//     }));
//   };

//   const handleLogin = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setStatus({ type: "", message: "" });

//     try {
//       const response = await fetch("http://localhost:5000/api/auth/login", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(formData),
//       });

//       const result = await readApiResponse(response);
      
//       // Token ya user data ko localStorage mein save kar sakte hain
//       if (result.token) {
//         localStorage.setItem("authToken", result.token);
//       }

//       setStatus({ 
//         type: "success", 
//         message: result.message || "Login successful! Welcome back." 
//       });
      
//       // Form reset
//       setFormData({ email: "", password: "" });
//     } catch (error) {
//       setStatus({ 
//         type: "error", 
//         message: error.message || "Login fail ho gaya. Credentials check karein." 
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 px-4 py-8">

//       {/* Animated Floating Spheres Background */}
//       <div
//         className="pointer-events-none absolute inset-0 overflow-hidden"
//         aria-hidden="true"
//       >
//         <div className="absolute left-0 top-[10%] animate-[sphere1_12s_ease-in-out_infinite]">
//           <div className="h-16 w-16 rounded-full border border-white/30 bg-gradient-to-br from-pink-300/70 via-purple-500/50 to-indigo-700/70 shadow-[inset_-8px_-8px_18px_rgba(0,0,0,0.3),0_0_35px_rgba(168,85,247,0.4)] backdrop-blur-sm" />
//         </div>
//         <div className="absolute right-0 top-[25%] animate-[sphere2_15s_ease-in-out_infinite]">
//           <div className="h-12 w-12 rounded-full border border-white/30 bg-gradient-to-br from-cyan-200/80 via-blue-500/50 to-indigo-800/70 shadow-[inset_-6px_-6px_14px_rgba(0,0,0,0.3),0_0_30px_rgba(34,211,238,0.4)]" />
//         </div>
//         <div className="absolute left-[20%] top-[45%] animate-[sphere3_11s_ease-in-out_infinite]">
//           <div className="h-10 w-10 rounded-full border border-white/30 bg-gradient-to-br from-fuchsia-200/80 to-purple-700/70 shadow-[inset_-5px_-5px_12px_rgba(0,0,0,0.3),0_0_25px_rgba(217,70,239,0.4)]" />
//         </div>
//         <div className="absolute right-[15%] bottom-[10%] animate-[sphere4_14s_ease-in-out_infinite]">
//           <div className="h-20 w-20 rounded-full border border-white/20 bg-gradient-to-br from-violet-200/70 via-indigo-500/50 to-purple-900/70 shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.35),0_0_40px_rgba(99,102,241,0.35)]" />
//         </div>
//         <div className="absolute left-[45%] top-[5%] animate-[sphere5_13s_ease-in-out_infinite]">
//           <div className="h-8 w-8 rounded-full border border-white/40 bg-gradient-to-br from-rose-200/80 to-red-600/70 shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.3),0_0_25px_rgba(244,63,94,0.4)]" />
//         </div>
//         <div className="absolute right-[30%] top-[60%] animate-[sphere6_17s_ease-in-out_infinite]">
//           <div className="h-14 w-14 rounded-full border border-white/30 bg-gradient-to-br from-emerald-200/70 via-teal-500/50 to-blue-800/70 shadow-[inset_-7px_-7px_15px_rgba(0,0,0,0.3),0_0_30px_rgba(45,212,191,0.3)]" />
//         </div>
//         <div className="absolute left-[65%] bottom-[5%] animate-[sphere7_9s_ease-in-out_infinite]">
//           <div className="h-6 w-6 rounded-full border border-white/40 bg-gradient-to-br from-amber-200/80 to-orange-600/70 shadow-[inset_-3px_-3px_8px_rgba(0,0,0,0.3),0_0_22px_rgba(251,146,60,0.5)]" />
//         </div>
//       </div>

//       {/* Login Card */}
//       <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-7">

//         {/* Header */}
//         <div className="mb-6 text-center">
//           <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
//             <svg
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="1.7"
//               className="h-6 w-6"
//               aria-hidden="true"
//             >
//               <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
//               <polyline points="10 17 15 12 10 7" />
//               <line x1="15" y1="12" x2="3" y2="12" />
//             </svg>
//           </div>

//           <h1 className="!my-0 text-2xl font-bold tracking-tight text-white sm:text-3xl">
//             Welcome Back
//           </h1>

//           <p className="mt-2 text-sm text-indigo-100/70">
//             Please enter your details to sign in.
//           </p>
//         </div>

//         {/* Login Form */}
//         <form onSubmit={handleLogin} className="space-y-4">

//           {/* Email */}
//           <div>
//             <label
//               htmlFor="email"
//               className="mb-1.5 block text-sm font-medium text-indigo-50"
//             >
//               Email Address
//             </label>
//             <input
//               id="email"
//               name="email"
//               type="email"
//               value={formData.email}
//               onChange={handleChange}
//               placeholder="you@example.com"
//               required
//               maxLength={254}
//               autoComplete="email"
//               className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//             />
//           </div>

//           {/* Password */}
//           <div>
//             <label
//               htmlFor="password"
//               className="mb-1.5 block text-sm font-medium text-indigo-50"
//             >
//               Password
//             </label>
//             <input
//               id="password"
//               name="password"
//               type="password"
//               value={formData.password}
//               onChange={handleChange}
//               placeholder="••••••••"
//               required
//               maxLength={128}
//               autoComplete="current-password"
//               className="w-full rounded-xl border border-white/15 bg-slate-950/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-indigo-100/40 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
//             />
//           </div>

//           {/* Submit Button */}
//           <button
//             type="submit"
//             disabled={loading}
//             className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition duration-300 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
//           >
//             {loading ? "Signing in..." : "Sign In"}

//             {!loading && (
//               <svg
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="1.8"
//                 className="h-4 w-4"
//                 aria-hidden="true"
//               >
//                 <path d="M5 12h14" />
//                 <path d="m12 5 7 7-7 7" />
//               </svg>
//             )}
//           </button>

//         </form>

//         {status.message && (
//           <p role="status" aria-live="polite"
//             className={`mt-3 rounded-lg px-3 py-2 text-xs ${
//               status.type === "success" ? "bg-green-400/10 text-green-300" : "bg-red-400/10 text-red-300"
//             }`}>
//             {status.message}
//           </p>
//         )}

//         <p className="mt-5 text-center text-xs text-indigo-100/50">
//           <span className="mr-1">✦</span>
//           Secure authentication system.
//         </p>
//       </section>

//       {/* Floating Sphere Animations CSS */}
//       <style>{`
//         @keyframes sphere1 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(25vw, 20vh); }
//           50% { transform: translate(60vw, 5vh); }
//           75% { transform: translate(75vw, 55vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere2 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-30vw, 20vh); }
//           50% { transform: translate(-65vw, 40vh); }
//           75% { transform: translate(-25vw, 60vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere3 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(25vw, -20vh); }
//           50% { transform: translate(55vw, 10vh); }
//           75% { transform: translate(20vw, 35vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere4 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-30vw, -25vh); }
//           50% { transform: translate(-65vw, -45vh); }
//           75% { transform: translate(-20vw, -20vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere5 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(30vw, 30vh); }
//           50% { transform: translate(-15vw, 55vh); }
//           75% { transform: translate(35vw, 65vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere6 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-35vw, -15vh); }
//           50% { transform: translate(15vw, -45vh); }
//           75% { transform: translate(-45vw, -25vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @keyframes sphere7 {
//           0% { transform: translate(0, 0); }
//           25% { transform: translate(-45vw, -35vh); }
//           50% { transform: translate(-15vw, -65vh); }
//           75% { transform: translate(-60vw, -20vh); }
//           100% { transform: translate(0, 0); }
//         }
//         @media (prefers-reduced-motion: reduce) {
//           .animate-\\[sphere1_12s_ease-in-out_infinite\\],
//           .animate-\\[sphere2_15s_ease-in-out_infinite\\],
//           .animate-\\[sphere3_11s_ease-in-out_infinite\\],
//           .animate-\\[sphere4_14s_ease-in-out_infinite\\],
//           .animate-\\[sphere5_13s_ease-in-out_infinite\\],
//           .animate-\\[sphere6_17s_ease-in-out_infinite\\],
//           .animate-\\[sphere7_9s_ease-in-out_infinite\\] {
//             animation: none;
//           }
//         }
//       `}</style>
//     </main>
//   );
// }
