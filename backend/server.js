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
app.set("trust proxy", 1);
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
// Bug 1 Fix: Database Connection First, Then app.listen()

// MongoDB connection for Vercel serverless
let mongoConnectionPromise = null;

app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (!mongoConnectionPromise) {
        mongoConnectionPromise = mongoose
          .connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
          })
          .catch((err) => {
            mongoConnectionPromise = null;
            throw err;
          });
      }

      await mongoConnectionPromise;
    }

    next();
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);

    return res.status(503).json({
      success: false,
      message: "Database connection failed. Please try again.",
    });
  }
});


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

module.exports = app;

// // Bug 1 Fix: Database Connection First, Then app.listen()

// // MongoDB connection for Vercel serverless
// let mongoConnectionPromise = null;

// app.use(async (req, res, next) => {
//   try {
//     if (mongoose.connection.readyState !== 1) {
//       if (!mongoConnectionPromise) {
//         mongoConnectionPromise = mongoose
//           .connect(MONGO_URI, {
//             serverSelectionTimeoutMS: 10000,
//           })
//           .catch((err) => {
//             mongoConnectionPromise = null;
//             throw err;
//           });
//       }

//       await mongoConnectionPromise;
//     }

//     next();
//   } catch (err) {
//     console.error("MongoDB Connection Error:", err.message);

//     return res.status(503).json({
//       success: false,
//       message: "Database connection failed. Please try again.",
//     });
//   }
// });

// module.exports = app;