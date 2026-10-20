require("dotenv").config();
const dns = require("dns").promises;
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit"); // Rate limiting ke liye

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL;

// 1. Essential Environment Variables Validation (RECEIVER_EMAIL included)
if (!JWT_SECRET || !MONGO_URI || !process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD || !RECEIVER_EMAIL) {
  console.error("CRITICAL ERROR: Zaroori environment variables (.env file mein) missing hain!");
  process.exit(1);
}

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "20kb" }));

// Rate Limiters (Bug 4 Fix)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 requests per window
  message: { success: false, message: "Bohot zyada requests hain, thori der baad koshish karein." },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Max 5 OTP requests per window
  message: { success: false, message: "Bohot zyada OTP requests hain, 15 minute baad try karein." },
  standardHeaders: true,
  legacyHeaders: false,
});

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

// OTP Schema
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  lastSentAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  form: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, default: "" },
    message: { type: String, required: true },
  },
});
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const OtpRecord = mongoose.model("OtpRecord", otpSchema);

// Constants & Utilities
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
const RESEND_WAIT = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Email format validation helper (Bug 5 Fix)
const isValidEmailFormat = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

// Secure JWT Authenticate Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token || token === "undefined" || token === "null") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized access! Token absent or invalid.",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token! Please login again.",
      });
    }

    req.user = decoded;
    req.email = decoded.email;
    next();
  });
};

// Root route
app.get("/", (req, res) => {
  res.send("Backend server is running successfully!");
});

// Route 0: Token Verification on Page Load
app.get("/api/auth/verify", authenticateToken, (req, res) => {
  return res.json({
    success: true,
    message: "Token valid hai.",
    user: { email: req.email || "" },
  });
});

// Route 1: Auth - Signup (Bug 5 & Bug 7 Fixes)
app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email aur password zaroori hain." });
    }

    const cleanEmail = normalizeEmail(email);

    // Email format validation
    if (!isValidEmailFormat(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Ghalat email format hai." });
    }

    // Password length validation
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password kam az kam 6 characters ka hona chahiye." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await User.create({ email: cleanEmail, passwordHash });

    return res.json({ success: true, message: "Account successfully ban gaya! Ab login karein." });
  } catch (error) {
    // Duplicate email handling (MongoDB E11000 Error - Bug 7 Fix)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Yeh email pehle se registered hai." });
    }
    console.error("Signup error:", error.message);
    return res.status(500).json({ success: false, message: "Signup fail ho gaya." });
  }
});

// Route 2: Auth - Login (Bug 4 Fix)
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email aur password zaroori hain." });
    }

    const cleanEmail = normalizeEmail(email);
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid email ya password." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid email ya password." });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Login successful!",
      token: token,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, message: "Login fail ho gaya." });
  }
});

// Route 3: Contact - Send OTP (Bug 3 & Bug 5 Fixes with Atomic Upsert)
app.post("/api/contact/send-otp", authenticateToken, otpLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!name || !cleanEmail || !message) {
      return res.status(400).json({ success: false, message: "Sari required fields bharein." });
    }

    // Email format validation
    if (!isValidEmailFormat(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Ghalat email format hai." });
    }

    // MX Domain check
    const domain = cleanEmail.split("@")[1];
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return res.status(400).json({ success: false, message: "Email domain exist nahi karta." });
      }
    } catch {
      return res.status(400).json({ success: false, message: "Invalid email domain." });
    }

  
const now = Date.now();
const otp = crypto.randomInt(100000, 1000000).toString();

const otpHash = hashOtp(otp);
const expiresAt = new Date(now + OTP_EXPIRY);
const lastSentAt = new Date(now);
const resendCutoff = new Date(now - RESEND_WAIT);

const otpUpdate = {
  otpHash,
  expiresAt,
  lastSentAt,
  attempts: 0,
  form: {
    name,
    email: cleanEmail,
    subject: subject || "",
    message,
  },
};

let reservedRecord;

// Check whether an OTP record already exists.
const existingRecord = await OtpRecord.findOne({
  email: cleanEmail,
});

if (existingRecord) {
  // Atomically update only if the resend wait has passed.
  reservedRecord = await OtpRecord.findOneAndUpdate(
    {
      email: cleanEmail,
      lastSentAt: { $lte: resendCutoff },
    },
    { $set: otpUpdate },
    { new: true }
  );

  if (!reservedRecord) {
    return res.status(429).json({
      success: false,
      message: "Please 60 seconds wait karein.",
    });
  }
} else {
  // First OTP request: unique index prevents duplicate records.
  try {
    reservedRecord = await OtpRecord.create({
      email: cleanEmail,
      ...otpUpdate,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(429).json({
        success: false,
        message: "OTP request process ho rahi hai. Dobara try karein.",
      });
    }
    throw error;
  }
}

// Send OTP only after reserving the database record.
try {
  await transporter.sendMail({
    from: `"Verification" <${process.env.EMAIL_USER}>`,
    to: cleanEmail,
    subject: "Your Email Verification Code",
    text: `Your OTP is ${otp}. Valid for 5 minutes.`,
  });
} catch (mailError) {
  console.error("Nodemailer sendMail Error:", mailError.message);

  // Remove only the OTP reservation made by this request.
  await OtpRecord.deleteOne({
    _id: reservedRecord._id,
    otpHash,
  }).catch((cleanupError) => {
    console.error("OTP cleanup error:", cleanupError.message);
  });

  return res.status(500).json({
    success: false,
    message: "Email send nahi ho saki. Dobara try karein.",
  });
}

return res.json({
  success: true,
  message: "OTP aapki email par bhej diya gaya hai.",
});


  } catch (error) {
    console.error("OTP send error:", error.message);
    return res.status(500).json({ success: false, message: "OTP send nahi ho saka." });
  }
});

// Route 4: Contact - Verify OTP (Protected)
app.post("/api/contact/verify-otp", authenticateToken, otpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();

    const record = await OtpRecord.findOne({ email });
    if (!record) {
      return res.status(400).json({ success: false, message: "OTP not found." });
    }

    if (Date.now() > new Date(record.expiresAt).getTime()) {
      await OtpRecord.deleteOne({ email });
      return res.status(400).json({ success: false, message: "OTP expired." });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await OtpRecord.deleteOne({ email });
      return res.status(429).json({ success: false, message: "Bohot zyada wrong attempts. Naya OTP request karein." });
    }

    if (hashOtp(otp) !== record.otpHash) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ success: false, message: "Incorrect OTP. Dubara try karein." });
    }

    const { name, subject, message } = record.form;

    try {
      await transporter.sendMail({
        from: `"Website Contact Form" <${process.env.EMAIL_USER}>`,
        to: RECEIVER_EMAIL,
        replyTo: email,
        subject: `Contact Form: ${subject || "New Message"}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      });
    } catch (mailError) {
      console.error("Contact Email Dispatch Error:", mailError.message);
      return res.status(500).json({ success: false, message: "Receiver ko message deliver nahi ho saka." });
    }

    await OtpRecord.deleteOne({ email });

    return res.json({ success: true, message: "Message successfully send ho gaya!" });
  } catch (error) {
    console.error("OTP verification error:", error.message);
    return res.status(500).json({ success: false, message: "Message send karne mein masla hua." });
  }
});

// Bug 1 Fix: Database Connection First, Then app.listen()
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully!");
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
    process.exit(1); // Server start nahi hoga agar DB connect na ho
  });

// require("dotenv").config();
// const dns = require("dns").promises;
// const express = require("express");
// const cors = require("cors");
// const nodemailer = require("nodemailer");
// const crypto = require("crypto");
// const bcrypt = require("bcryptjs");

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(
//   cors({
//     origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
//   })
// );

// app.use(express.json({ limit: "20kb" }));

// // In-Memory Storage
// const users = []; // Temporary user store
// const pendingOtps = new Map(); // Temporary OTP store

// const OTP_EXPIRY = 5 * 60 * 1000;
// const RESEND_WAIT = 60 * 1000;
// const MAX_ATTEMPTS = 5;

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_APP_PASSWORD,
//   },
// });

// const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
// const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

// function escapeHtml(value) {
//   return String(value).replace(/[&<>"']/g, (char) => ({
//     "&": "&amp;",
//     "<": "&lt;",
//     ">": "&gt;",
//     '"': "&quot;",
//     "'": "&#39;",
//   })[char]);
// }

// // Route 1: Auth - Signup
// app.post("/api/auth/signup", async (req, res) => {
//   try {
//     const { email, password } = req.body || {};
//     if (!email || !password) {
//       return res.status(400).json({ success: false, message: "Email aur password zaroori hain." });
//     }

//     const cleanEmail = normalizeEmail(email);
//     if (users.find((u) => u.email === cleanEmail)) {
//       return res.status(400).json({ success: false, message: "Yeh email pehle se registered hai." });
//     }

//     const salt = await bcrypt.genSalt(10);
//     const passwordHash = await bcrypt.hash(password, salt);

//     users.push({ email: cleanEmail, passwordHash });
//     return res.json({ success: true, message: "Account successfully ban gaya! Ab login karein." });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Signup fail ho gaya." });
//   }
// });

// // Route 2: Auth - Login
// app.post("/api/auth/login", async (req, res) => {
//   try {
//     const { email, password } = req.body || {};
//     if (!email || !password) {
//       return res.status(400).json({ success: false, message: "Email aur password zaroori hain." });
//     }

//     const cleanEmail = normalizeEmail(email);
//     const user = users.find((u) => u.email === cleanEmail);

//     if (!user) {
//       return res.status(400).json({ success: false, message: "Invalid email ya password." });
//     }

//     const isMatch = await bcrypt.compare(password, user.passwordHash);
//     if (!isMatch) {
//       return res.status(400).json({ success: false, message: "Invalid email ya password." });
//     }

//     return res.json({
//       success: true,
//       message: "Login successful!",
//       token: "sample-jwt-token-12345",
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Login fail ho gaya." });
//   }
// });

// // Route 3: Contact - Send OTP
// app.post("/api/contact/send-otp", async (req, res) => {
//   try {
//     const { name, email, subject, message } = req.body || {};
//     const cleanEmail = normalizeEmail(email);

//     if (!name || !cleanEmail || !message) {
//       return res.status(400).json({ success: false, message: "Sari required fields bharein." });
//     }

//     // MX Domain check
//     const domain = cleanEmail.split("@")[1];
//     try {
//       const mxRecords = await dns.resolveMx(domain);
//       if (!mxRecords || mxRecords.length === 0) {
//         return res.status(400).json({ success: false, message: "Email domain exist nahi karta." });
//       }
//     } catch {
//       return res.status(400).json({ success: false, message: "Invalid email domain." });
//     }

//     const now = Date.now();
//     const existing = pendingOtps.get(cleanEmail);
//     if (existing && now - existing.lastSentAt < RESEND_WAIT) {
//       return res.status(429).json({ success: false, message: "Please 60 seconds wait karein." });
//     }

//     const otp = crypto.randomInt(100000, 1000000).toString();

//     await transporter.sendMail({
//       from: `"Verification" <${process.env.EMAIL_USER}>`,
//       to: cleanEmail,
//       subject: "Your Email Verification Code",
//       text: `Your OTP is ${otp}. Valid for 5 minutes.`,
//     });

//     pendingOtps.set(cleanEmail, {
//       otpHash: hashOtp(otp),
//       expiresAt: now + OTP_EXPIRY,
//       lastSentAt: now,
//       attempts: 0,
//       form: { name, email: cleanEmail, subject, message },
//     });

//     return res.json({ success: true, message: "OTP aapki email par bhej diya gaya hai." });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "OTP send nahi ho saka." });
//   }
// });

// // Route 4: Contact - Verify OTP
// app.post("/api/contact/verify-otp", async (req, res) => {
//   try {
//     const email = normalizeEmail(req.body?.email);
//     const otp = String(req.body?.otp || "").trim();

//     const record = pendingOtps.get(email);
//     if (!record) {
//       return res.status(400).json({ success: false, message: "OTP not found." });
//     }

//     if (Date.now() > record.expiresAt) {
//       pendingOtps.delete(email);
//       return res.status(400).json({ success: false, message: "OTP expired." });
//     }

//     if (hashOtp(otp) !== record.otpHash) {
//       return res.status(400).json({ success: false, message: "Incorrect OTP." });
//     }

//     const { name, subject, message } = record.form;

//     await transporter.sendMail({
//       from: `"Website Contact Form" <${process.env.EMAIL_USER}>`,
//       to: process.env.RECEIVER_EMAIL,
//       replyTo: email,
//       subject: `Contact Form: ${subject || "New Message"}`,
//       text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
//     });

//     pendingOtps.delete(email);
//     return res.json({ success: true, message: "Message successfully send ho gaya!" });
//   } catch (error) {
//     return res.status(500).json({ success: false, message: "Message send karne mein masla hua." });
//   }
// });
// // Root test route
// app.get("/", (req, res) => {
//   res.send("Backend server is running successfully!");
// });
// app.listen(PORT, () => {
//   console.log(`Backend running on http://localhost:${PORT}`);
// });

// bugs wala code 






// require("dotenv").config();
// const dns = require("dns").promises;

// const express = require("express");
// const cors = require("cors");
// const nodemailer = require("nodemailer");
// const crypto = require("crypto");

// const app = express();
// const PORT = process.env.PORT || 5000;
// app.use(
//   cors({
//     origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
//   })
// );

// app.use(express.json({ limit: "20kb" }));

// // Gmail transporter
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_APP_PASSWORD,
//   },
// });

// // Temporary OTP storage
// const pendingOtps = new Map();

// const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
// const RESEND_WAIT = 60 * 1000; // 60 seconds
// const MAX_ATTEMPTS = 5;

// const normalizeEmail = (email) =>
//   String(email || "").trim().toLowerCase();

// const hashOtp = (otp) =>
//   crypto.createHash("sha256").update(otp).digest("hex");

// function escapeHtml(value) {
//   return String(value).replace(/[&<>"']/g, (char) => ({
//     "&": "&amp;",
//     "<": "&lt;",
//     ">": "&gt;",
//     '"': "&quot;",
//     "'": "&#39;",
//   })[char]);
// }

// // Backend test
// app.get("/", (req, res) => {
//   res.send("Contact Form Backend is running!");
// });

// // STEP 1: Send OTP to user's email
// app.post("/api/contact/send-otp", async (req, res) => {
//   try {
//     const { name, email, subject, message } = req.body || {};

//     if (
//       typeof name !== "string" ||
//       typeof email !== "string" ||
//       typeof subject !== "string" ||
//       typeof message !== "string"
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Please enter valid form details.",
//       });
//     }

//     const cleanName = name.trim();
//     const cleanEmail = normalizeEmail(email);
//     const cleanSubject = subject.trim();
//     const cleanMessage = message.trim();

//     if (
//       !cleanName ||
//       cleanName.length > 100 ||
// !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
//       cleanEmail.length > 254 ||
//       cleanSubject.length > 150 ||
//       !cleanMessage ||
//       cleanMessage.length > 5000
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Please check your form details.",
//       });
//     }
// // --- NEW: Check if email domain actually exists (MX Record Check) ---
//     const domain = cleanEmail.split("@")[1];
//     try {
//       const mxRecords = await dns.resolveMx(domain);
//       if (!mxRecords || mxRecords.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: "Yeh email domain mojood nahi hai. Please valid email enter karein.",
//         });
//       }
//     } catch (dnsError) {
//       return res.status(400).json({
//         success: false,
//         message: "Is email address ka domain exist nahi karta.",
//       });
//     }
//     const now = Date.now();
//     const existing = pendingOtps.get(cleanEmail);

//     // Prevent rapid OTP resending
//     if (existing && now - existing.lastSentAt < RESEND_WAIT) {
//       return res.status(429).json({
//         success: false,
//         message: "Please wait 60 seconds before requesting another OTP.",
//       });
//     }

//     const otp = crypto.randomInt(100000, 1000000).toString();
//     console.log("OTP recipient:", cleanEmail);
// await transporter.sendMail({
//   from: `"Contact Form Verification" <${process.env.EMAIL_USER}>`,
//   to: cleanEmail,
//   subject: "Your Email Verification Code",
//   text: `Your verification code is ${otp}. It expires in 5 minutes.`,
// });
  
//     pendingOtps.set(cleanEmail, {
//       otpHash: hashOtp(otp),
//       expiresAt: now + OTP_EXPIRY,
//       lastSentAt: now,
//       attempts: 0,
//       form: {
//         name: cleanName,
//         email: cleanEmail,
//         subject: cleanSubject,
//         message: cleanMessage,
//       },
//     });

//    return res.json({
//   success: true,
//   message:
//     "If this email address can receive messages, your verification code should arrive shortly. Please check your inbox and spam folder.",
// });
//   } catch (error) {
//     console.error("OTP sending failed:", error.message);

//     return res.status(500).json({
//       success: false,
//       message: "OTP could not be sent. Please try again later.",
//     });
//   }
// });

// // STEP 2: Verify OTP and send contact message
// app.post("/api/contact/verify-otp", async (req, res) => {
//   try {
//     const email = normalizeEmail(req.body?.email);
//     const otp = String(req.body?.otp || "").trim();

//     if (!email || !/^\d{6}$/.test(otp)) {
//       return res.status(400).json({
//         success: false,
//         message: "Please enter a valid 6-digit OTP.",
//       });
//     }

//     const record = pendingOtps.get(email);

//     if (!record) {
//       return res.status(400).json({
//         success: false,
//         message: "OTP not found. Please request a new OTP.",
//       });
//     }

//     if (Date.now() > record.expiresAt) {
//       pendingOtps.delete(email);

//       return res.status(400).json({
//         success: false,
//         message: "OTP expired. Please request a new OTP.",
//       });
//     }

//     if (record.attempts >= MAX_ATTEMPTS) {
//       pendingOtps.delete(email);

//       return res.status(429).json({
//         success: false,
//         message: "Too many incorrect attempts. Please request a new OTP.",
//       });
//     }

//     if (hashOtp(otp) !== record.otpHash) {
//       record.attempts += 1;

//       return res.status(400).json({
//         success: false,
//         message: "Incorrect OTP. Please try again.",
//       });
//     }

//     // Send message to your receiving email
//     const { name, subject, message } = record.form;

//     await transporter.sendMail({
//       from: `"Website Contact Form" <${process.env.EMAIL_USER}>`,
//       to: process.env.RECEIVER_EMAIL,
//       replyTo: email,
//       subject: `Contact Form: ${subject || "New Message"}`,
//       text: [
//         `Name: ${name}`,
//         `Email: ${email}`,
//         `Subject: ${subject || "Not provided"}`,
//         "",
//         "Message:",
//         message,
//       ].join("\n"),
//       html: `
//         <h2>New Verified Contact Form Message</h2>
//         <p><b>Name:</b> ${escapeHtml(name)}</p>
//         <p><b>Email:</b> ${escapeHtml(email)}</p>
//         <p><b>Subject:</b> ${escapeHtml(subject || "Not provided")}</p>
//         <p><b>Message:</b><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
//       `,
//     });

//     // OTP can no longer be reused
//     pendingOtps.delete(email);

//     return res.json({
//       success: true,
//       message: "Email verified! Your message has been sent successfully.",
//     });
//   } catch (error) {
//     console.error("Contact email sending failed:", error.message);

//     return res.status(500).json({
//       success: false,
//       message: "Message could not be sent. Please try again later.",
//     });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Backend running at http://localhost:${PORT}`);
// });

// new codeeeeeeeeeeeeeeee

// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const bcrypt = require("bcryptjs"); // Make sure installed: npm install bcryptjs

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(
//   cors({
//     origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
//   })
// );

// app.use(express.json({ limit: "20kb" }));

// // Temporary in-memory database (Array) for storing registered users
// // (Production mein aap MongoDB ya PostgreSQL use karenge)
// const users = [];

// // Backend test route
// app.get("/", (req, res) => {
//   res.send("Auth Backend is running!");
// });

// // 1. SIGNUP ROUTE (Naye user ko register karne ke liye)
// app.post("/api/auth/signup", async (req, res) => {
//   try {
//     const { email, password } = req.body || {};

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Email aur password dono zaroori hain.",
//       });
//     }

//     const cleanEmail = String(email).trim().toLowerCase();

//     // Check karein kya yeh email pehle se registered hai
//     const existingUser = users.find((u) => u.email === cleanEmail);
//     if (existingUser) {
//       return res.status(400).json({
//         success: false,
//         message: "Yeh email pehle se registered hai. Please sign in karein.",
//       });
//     }

//     // Password ko secure hash banayein (bcryptjs se)
//     const salt = await bcrypt.genSalt(10);
//     const passwordHash = await bcrypt.hash(password, salt);

//     // User ko array mein save kar dein
//     users.push({
//       email: cleanEmail,
//       passwordHash: passwordHash,
//     });

//     return res.json({
//       success: true,
//       message: "Account successfully ban gaya! Ab aap login kar sakte hain.",
//     });

//   } catch (error) {
//     console.error("Signup error:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Server error ho gaya. Please baad mein try karein.",
//     });
//   }
// });

// // 2. LOGIN ROUTE (User ko authenticate karne ke liye)
// app.post("/api/auth/login", async (req, res) => {
//   try {
//     const { email, password } = req.body || {};

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Email aur password dono zaroori hain.",
//       });
//     }

//     const cleanEmail = String(email).trim().toLowerCase();

//     // User ko array mein talash karein
//     const user = users.find((u) => u.email === cleanEmail);

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid email ya password.",
//       });
//     }

//     // Password match check karein (hashed password ke sath)
//     const isMatch = await bcrypt.compare(password, user.passwordHash);

//     if (!isMatch) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid email ya password.",
//       });
//     }

//     return res.json({
//       success: true,
//       message: "Login successful! Welcome back.",
//       token: "sample-jwt-token-xyz123",
//     });

//   } catch (error) {
//     console.error("Login error:", error.message);
//     return res.status(500).json({
//       success: false,
//       message: "Server error ho gaya. Please baad mein try karein.",
//     });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Backend running at http://localhost:${PORT}`);
// });



