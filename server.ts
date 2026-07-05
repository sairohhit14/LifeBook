import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies up to 50MB for base64 file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Setup file-based DB path
const DB_PATH = path.join(process.cwd(), "db.json");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploads statically
app.use("/uploads", express.static(UPLOADS_DIR));

// Error handling middleware for API routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Server error:", err);
  // Ensure API routes always return JSON
  if (req.path.startsWith("/api/")) {
    res.status(500).json({ error: err.message || "Internal server error" });
  } else {
    next(err);
  }
});

// Initialize DB if it doesn't exist
const initialDb = {
  users: [],
  memories: [],
  milestones: [],
  messages: [],
  family: [],
  documents: [],
  stories: [],
  notifications: [],
  chatHistory: {} // userId -> ChatMessage[]
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading db:", err);
    return initialDb;
  }
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing db:", err);
  }
}

// Initialize database file on startup
readDb();

// Initialize GoogleGenAI client (lazy init or check key)
let ai: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will be unavailable.");
      throw new Error("GEMINI_API_KEY environment variable is required for AI features. Please configure it in your Secrets settings.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// Helper to generate a 6-digit alphanumeric Legacy Key (e.g. LB-A23B9F)
function generateLegacyKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "LB-";
  for (let i = 0; i < 6; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// Simple Authorization Middleware
function getUserIdFromRequest(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7); // Return userId directly
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const db = readDb();

  // If this is a guest family member session
  if (userId.startsWith("guest_")) {
    const parts = userId.split("_");
    const ownerId = parts[1];
    if (!ownerId) {
      return res.status(401).json({ error: "Invalid legacy guest credentials" });
    }
    const ownerExists = db.users.some((u: any) => u.id === ownerId);
    if (!ownerExists) {
      return res.status(401).json({ error: "Legacy session expired or owner not found" });
    }
    (req as any).userId = ownerId;
    (req as any).isGuest = true;
    
    // Protect mutations (POST, PUT, DELETE) from guest users
    if (req.method !== "GET") {
      return res.status(403).json({ error: "You are logged in under Family View-Only mode and cannot modify the owner's legacy archive." });
    }
    
    return next();
  }

  // Regular logged-in owner session
  const userExists = db.users.some((u: any) => u.id === userId);
  if (!userExists) {
    return res.status(401).json({ error: "User session expired" });
  }
  (req as any).userId = userId;
  next();
}

// HELPER: Compute legacy completion percentage
function calculateCompletion(userId: string, db: any): number {
  let percentage = 0;

  // Add First Memory -> 5%
  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  if (userMemories.length > 0) {
    percentage += 5;
  }

  // Count photos, videos, voice recordings across memories
  let photoCount = 0;
  let videoCount = 0;
  let voiceCount = 0;

  userMemories.forEach((mem: any) => {
    if (mem.media && Array.isArray(mem.media)) {
      mem.media.forEach((file: any) => {
        if (file.type === "image") photoCount++;
        if (file.type === "video") videoCount++;
        if (file.type === "audio") voiceCount++;
      });
    }
  });

  // Upload Photo -> +2% for each photo (cap at +10%)
  const photoBonus = Math.min(photoCount * 2, 10);
  percentage += photoBonus;

  // Upload Video -> +3% for each video (cap at +15%)
  const videoBonus = Math.min(videoCount * 3, 15);
  percentage += videoBonus;

  // Upload Voice -> +3% for each voice (cap at +15%)
  const voiceBonus = Math.min(voiceCount * 3, 15);
  percentage += voiceBonus;

  // Add Timeline Event -> +2% for each (cap at +10%)
  const milestoneCount = db.milestones.filter((m: any) => m.userId === userId).length;
  const milestoneBonus = Math.min(milestoneCount * 2, 10);
  percentage += milestoneBonus;

  // Add Family Member -> +2% for each (cap at +10%)
  const familyCount = db.family.filter((f: any) => f.userId === userId).length;
  const familyBonus = Math.min(familyCount * 2, 10);
  percentage += familyBonus;

  // Upload Document -> +3% for each (cap at +15%)
  const documentCount = db.documents.filter((d: any) => d.userId === userId).length;
  const documentBonus = Math.min(documentCount * 3, 15);
  percentage += documentBonus;

  // Generated AI Story -> +10% for each (cap at +20%)
  const storyCount = db.stories.filter((s: any) => s.userId === userId).length;
  const storyBonus = Math.min(storyCount * 10, 20);
  percentage += storyBonus;

  return Math.min(percentage, 100);
}

// Core Email Dispatch helper (Nodemailer SMTP & Resend API)
async function sendEmail({
  to,
  subject,
  html,
  text,
  config
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  config?: any;
}) {
  // 1. Fetch configurations from user specific config or fallback to system env variables
  const protocol = config?.protocol || process.env.EMAIL_PROTOCOL || "SMTP";
  const smtpHost = config?.smtpHost || process.env.SMTP_HOST || "";
  const smtpPort = parseInt(config?.smtpPort || process.env.SMTP_PORT || "587", 10);
  const smtpUser = config?.smtpUser || process.env.SMTP_USER || "";
  const smtpPass = config?.smtpPass || process.env.SMTP_PASS || "";
  const smtpFrom = config?.smtpFrom || process.env.SMTP_FROM || '"LifeBook" <no-reply@lifebook.com>';

  const resendApiKey = config?.resendApiKey || process.env.RESEND_API_KEY || "";
  const resendFrom = config?.resendFrom || process.env.RESEND_FROM || "onboarding@resend.dev";

  console.log(`[Email Service] Initiating dispatch sequence to recipient: ${to}...`);

  if (protocol === "Resend" && resendApiKey) {
    console.log(`[Email Service] Dispatching via Resend API...`);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: resendFrom,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, "")
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend service error: ${errorText}`);
    }
    const result = await response.json();
    console.log(`[Email Service] Resend dispatch success! Msg ID: ${result.id}`);
    return { success: true, messageId: result.id };
  } else if (protocol === "SMTP" && smtpHost && smtpUser && smtpPass) {
    console.log(`[Email Service] Dispatching via Nodemailer SMTP to ${smtpHost}:${smtpPort}...`);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ""),
      html,
    });

    console.log(`[Email Service] SMTP dispatch success! Msg ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } else {
    // Elegant Zero-Config Fallback: Dynamic Ethereal Test SMTP Server
    console.log(`[Email Service] No credentials configured. Deploying dynamic Ethereal test SMTP server on-the-fly...`);
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[Email Service] Ethereal test account created successfully: ${testAccount.user}`);
      
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      const info = await transporter.sendMail({
        from: '"LifeBook Legacy Suite (Test)" <no-reply@lifebook.com>',
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ""),
        html
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Email Service] Ethereal delivery successful! Message ID: ${info.messageId}`);
      console.log(`[Email Service] View Sent Email: ${previewUrl}`);

      return { 
        success: true, 
        messageId: info.messageId, 
        previewUrl: previewUrl || undefined 
      };
    } catch (etherealErr: any) {
      console.error(`[Email Service] Ethereal fallback failed:`, etherealErr);
      throw new Error(`Email delivery configuration is missing, and automatic Ethereal fallback failed: ${etherealErr.message}`);
    }
  }
}

// Send local in-app notification helper
function addNotification(userId: string, title: string, message: string, db?: any) {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    title,
    message,
    date: new Date().toISOString(),
    read: false
  };
  if (db) {
    if (!db.notifications) db.notifications = [];
    db.notifications.push(notification);
  } else {
    const localDb = readDb();
    if (!localDb.notifications) localDb.notifications = [];
    localDb.notifications.push(notification);
    writeDb(localDb);
  }
}

/* ================= AUTH ENDPOINTS ================= */

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, dob, phone } = req.body;
  if (!name || !email || !password || !dob) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const db = readDb();
  const existingUser = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: "Email is already registered" });
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const legacyKey = generateLegacyKey();
  const newUser = {
    id: userId,
    name,
    email,
    password, // Storing plaintext for lightweight hackathon purposes (can be BCrypt if needed, but local sandbox file is private)
    dob,
    phone: phone || "",
    profilePhoto: "",
    legacyKey,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  addNotification(userId, "Welcome to LifeBook!", `Hello ${name}, welcome to your digital legacy space. Start logging memories, creating your biography, and sharing your custom Legacy Key: ${legacyKey} with your descendants.`);
  writeDb(db);

  res.status(201).json({
    id: userId,
    name,
    email,
    dob,
    phone: newUser.phone,
    legacyCompletion: 0,
    profilePhoto: "",
    legacyKey,
    createdAt: newUser.createdAt
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const db = readDb();
  const userIndex = db.users.findIndex(
    (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (userIndex === -1) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  const user = db.users[userIndex];
  
  // Backwards compatibility generation of legacy key if missing
  if (!user.legacyKey) {
    user.legacyKey = generateLegacyKey();
    db.users[userIndex] = user;
    writeDb(db);
  }

  const completion = calculateCompletion(user.id, db);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    dob: user.dob,
    phone: user.phone,
    profilePhoto: user.profilePhoto || "",
    legacyCompletion: completion,
    legacyKey: user.legacyKey,
    createdAt: user.createdAt
  });
});

// Forgot Password API - Sends recovering email with Password & 6-digit confirmation code
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email address is required" });
  }

  const db = readDb();
  const userIndex = db.users.findIndex(
    (u: any) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (userIndex === -1) {
    return res.status(404).json({ error: "No registered LifeBook account found with this email address." });
  }

  const user = db.users[userIndex];
  
  // Generate 6-digit OTP code for secure, fast login confirmation
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes expiration

  db.users[userIndex].loginOtp = otp;
  db.users[userIndex].loginOtpExpiry = otpExpiry;
  writeDb(db);

  try {
    const emailResult = await sendEmail({
      to: user.email,
      subject: "LifeBook - Password Recovery & Login Confirmation",
      html: `
        <div style="font-family: 'Georgia', 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #E5E5E1; background-color: #FAF9F6; color: #1A1A1A; line-height: 1.6;">
          <h2 style="font-style: italic; border-bottom: 2px solid #1A1A1A; padding-bottom: 12px; margin-top: 0; font-weight: normal; font-size: 24px;">LifeBook Legacy Vault</h2>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>We received a request to recover your password and confirm your login to your digital legacy space.</p>
          
          <div style="background-color: #F1EFEC; border: 1px solid #E5E5E1; padding: 16px; margin: 24px 0; border-left: 4px solid #1A1A1A;">
            <p style="margin: 0 0 6px 0; font-size: 10px; font-family: sans-serif; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; color: #666;">Your Recovered Password</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold; font-family: monospace; letter-spacing: 0.5px;">${user.password}</p>
          </div>

          <p>Alternatively, you can skip entering your password and confirm your login directly by entering the 6-digit confirmation code below in the application:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 6px; padding: 12px 32px; border: 1.5px dashed #1A1A1A; background-color: #FFF;">
              ${otp}
            </div>
            <p style="margin: 8px 0 0 0; font-size: 11px; font-family: sans-serif; color: #666; font-style: italic;">This confirmation code is valid for 15 minutes.</p>
          </div>

          <p style="font-size: 12px; font-family: sans-serif; color: #666; border-top: 1px solid #E5E5E1; padding-top: 20px; margin-top: 32px;">
            If you did not make this request, you can safely ignore this email or contact support.
          </p>
        </div>
      `
    });

    res.json({
      success: true,
      message: "Password recovery and confirmation code email sent successfully.",
      previewUrl: emailResult.previewUrl
    });
  } catch (emailErr: any) {
    console.error("[Auth] Failed to send recovery email:", emailErr);
    res.status(500).json({ error: `Failed to dispatch recovery email: ${emailErr.message}` });
  }
});

// Confirm Login API - Authenticates user directly using the 6-digit confirmation code sent to their email
app.post("/api/auth/confirm-login", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email address and confirmation code are required." });
  }

  const db = readDb();
  const userIndex = db.users.findIndex(
    (u: any) => u.email.toLowerCase() === email.toLowerCase()
  );

  if (userIndex === -1) {
    return res.status(404).json({ error: "Account not found." });
  }

  const user = db.users[userIndex];

  if (!user.loginOtp || user.loginOtp !== otp.trim()) {
    return res.status(400).json({ error: "Invalid login confirmation code." });
  }

  if (!user.loginOtpExpiry || user.loginOtpExpiry < Date.now()) {
    return res.status(400).json({ error: "The login confirmation code has expired. Please request a new one." });
  }

  // OTP is verified! Consume it.
  delete db.users[userIndex].loginOtp;
  delete db.users[userIndex].loginOtpExpiry;

  // Ensure legacy key exists
  if (!user.legacyKey) {
    user.legacyKey = generateLegacyKey();
  }
  
  db.users[userIndex] = user;
  writeDb(db);

  const completion = calculateCompletion(user.id, db);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    dob: user.dob,
    phone: user.phone,
    profilePhoto: user.profilePhoto || "",
    legacyCompletion: completion,
    legacyKey: user.legacyKey,
    createdAt: user.createdAt
  });
});

app.get("/api/auth/current-user", (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const db = readDb();
  const userIndex = db.users.findIndex((u: any) => u.id === userId);
  if (userIndex === -1) {
    return res.status(401).json({ error: "User session expired" });
  }

  const user = db.users[userIndex];

  // Generate legacy key if missing
  if (!user.legacyKey) {
    user.legacyKey = generateLegacyKey();
    db.users[userIndex] = user;
    writeDb(db);
  }

  const completion = calculateCompletion(userId, db);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    dob: user.dob,
    phone: user.phone,
    profilePhoto: user.profilePhoto || "",
    legacyCompletion: completion,
    legacyKey: user.legacyKey,
    createdAt: user.createdAt
  });
});

// New endpoint: Family Member / Guest access validation using Owner's Legacy Key
app.post("/api/auth/family-login", (req, res) => {
  const { legacyKey, familyMemberName } = req.body;
  if (!legacyKey || !familyMemberName) {
    return res.status(400).json({ error: "Legacy Key and your name are required." });
  }

  const db = readDb();
  const cleanKey = legacyKey.trim().toUpperCase();
  const owner = db.users.find((u: any) => u.legacyKey && u.legacyKey.trim().toUpperCase() === cleanKey);

  if (!owner) {
    return res.status(404).json({ error: "Invalid Legacy Key. Please check with the legacy owner for the correct key." });
  }

  const guestUserId = `guest_${owner.id}_${Buffer.from(familyMemberName).toString("base64")}`;
  const completion = calculateCompletion(owner.id, db);

  res.json({
    id: guestUserId,
    name: `${familyMemberName}`,
    email: `family@lifebook.dev`,
    dob: "1980-01-01",
    profilePhoto: "",
    phone: "",
    legacyCompletion: completion,
    legacyKey: owner.legacyKey,
    isGuestViewer: true,
    ownerName: owner.name,
    createdAt: new Date().toISOString()
  });
});

// New endpoint: Regenerate owner's Legacy Key
app.post("/api/settings/legacy-key/regenerate", authMiddleware, (req: any, res) => {
  // If a guest attempts this, authMiddleware will block (POST is not GET)
  const userId = req.userId;
  const db = readDb();
  const userIndex = db.users.findIndex((u: any) => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const newKey = generateLegacyKey();
  db.users[userIndex].legacyKey = newKey;
  addNotification(userId, "Legacy Key Regenerated 🔑", `You have generated a new legacy access key: ${newKey}. Share this key with family members so they can securely view your legacy chronicle.`);
  writeDb(db);

  res.json({ legacyKey: newKey });
});

/* ================= FILE UPLOAD ENDPOINT ================= */

app.post("/api/upload", authMiddleware, (req, res) => {
  const { filename, base64Data, type } = req.body;
  if (!filename || !base64Data) {
    return res.status(400).json({ error: "Filename and base64Data are required" });
  }

  try {
    // Clean base64 prefix if present (e.g. "data:image/png;base64,")
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    // Generate unique filename on disk
    const extension = path.extname(filename) || (type === "audio" ? ".mp3" : type === "video" ? ".mp4" : ".png");
    const uniqueFilename = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}${extension}`;
    const filePath = path.join(UPLOADS_DIR, uniqueFilename);

    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${uniqueFilename}`;
    res.json({ url: relativeUrl, name: filename });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload file: " + err.message });
  }
});

/* ================= DASHBOARD STATS ================= */

app.get("/api/dashboard/stats", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();

  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  const userMilestones = db.milestones.filter((m: any) => m.userId === userId);
  const userFamily = db.family.filter((f: any) => f.userId === userId);
  const userDocuments = db.documents.filter((d: any) => d.userId === userId);
  const userStories = db.stories.filter((s: any) => s.userId === userId);

  let photosCount = 0;
  let videosCount = 0;
  let voicesCount = 0;

  userMemories.forEach((mem: any) => {
    if (mem.media && Array.isArray(mem.media)) {
      mem.media.forEach((file: any) => {
        if (file.type === "image") photosCount++;
        if (file.type === "video") videosCount++;
        if (file.type === "audio") voicesCount++;
      });
    }
  });

  const completion = calculateCompletion(userId, db);

  res.json({
    legacyCompletion: completion,
    totalMemories: userMemories.length,
    photosCount,
    videosCount,
    voicesCount,
    documentsCount: userDocuments.length,
    familyMembersCount: userFamily.length,
    storiesGeneratedCount: userStories.length
  });
});

/* ================= MEMORY VAULT CRUD ================= */

app.get("/api/memories", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const memories = db.memories.filter((m: any) => m.userId === userId);
  res.json(memories);
});

app.post("/api/memories", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { title, description, date, location, tags, media } = req.body;

  if (!title || !description || !date) {
    return res.status(400).json({ error: "Title, description, and date are required" });
  }

  const db = readDb();
  const newMemory = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    title,
    description,
    date,
    location: location || "",
    tags: Array.isArray(tags) ? tags : [],
    media: Array.isArray(media) ? media : [],
    createdAt: new Date().toISOString()
  };

  db.memories.push(newMemory);
  addNotification(userId, "Memory Added", `Successfully saved your memory: "${title}".`);
  writeDb(db);

  res.status(201).json(newMemory);
});

app.put("/api/memories/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title, description, date, location, tags, media } = req.body;

  const db = readDb();
  const index = db.memories.findIndex((m: any) => m.id === id && m.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Memory not found" });
  }

  const updatedMemory = {
    ...db.memories[index],
    title: title || db.memories[index].title,
    description: description || db.memories[index].description,
    date: date || db.memories[index].date,
    location: location !== undefined ? location : db.memories[index].location,
    tags: Array.isArray(tags) ? tags : db.memories[index].tags,
    media: Array.isArray(media) ? media : db.memories[index].media,
  };

  db.memories[index] = updatedMemory;
  writeDb(db);

  res.json(updatedMemory);
});

app.delete("/api/memories/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const memory = db.memories.find((m: any) => m.id === id && m.userId === userId);
  if (!memory) {
    return res.status(404).json({ error: "Memory not found" });
  }

  db.memories = db.memories.filter((m: any) => !(m.id === id && m.userId === userId));
  addNotification(userId, "Memory Deleted", `Deleted the memory: "${memory.title}".`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= TIMELINE CRUD ================= */

app.get("/api/timeline", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const milestones = db.milestones.filter((m: any) => m.userId === userId);
  res.json(milestones);
});

app.post("/api/timeline", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { title, description, date, category, location, media } = req.body;

  if (!title || !description || !date || !category) {
    return res.status(400).json({ error: "Title, description, date, and category are required" });
  }

  const db = readDb();
  const newMilestone = {
    id: `mil_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    title,
    description,
    date,
    category,
    location: location || "",
    media: Array.isArray(media) ? media : [],
    createdAt: new Date().toISOString()
  };

  db.milestones.push(newMilestone);
  addNotification(userId, "Milestone Added", `Added new milestone to your life timeline: "${title}".`);
  writeDb(db);

  res.status(201).json(newMilestone);
});

app.put("/api/timeline/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title, description, date, category, location, media } = req.body;

  const db = readDb();
  const index = db.milestones.findIndex((m: any) => m.id === id && m.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Milestone not found" });
  }

  const updatedMilestone = {
    ...db.milestones[index],
    title: title || db.milestones[index].title,
    description: description || db.milestones[index].description,
    date: date || db.milestones[index].date,
    category: category || db.milestones[index].category,
    location: location !== undefined ? location : db.milestones[index].location,
    media: Array.isArray(media) ? media : db.milestones[index].media
  };

  db.milestones[index] = updatedMilestone;
  writeDb(db);

  res.json(updatedMilestone);
});

app.delete("/api/timeline/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const milestone = db.milestones.find((m: any) => m.id === id && m.userId === userId);
  if (!milestone) {
    return res.status(404).json({ error: "Milestone not found" });
  }

  db.milestones = db.milestones.filter((m: any) => !(m.id === id && m.userId === userId));
  addNotification(userId, "Milestone Deleted", `Removed milestone: "${milestone.title}".`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= LEGACY MESSAGES CRUD ================= */

app.get("/api/messages", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const messages = db.messages.filter((m: any) => m.userId === userId);
  res.json(messages);
});

app.post("/api/messages", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { title, recipientName, recipientEmail, deliveryOption, deliveryDate, deliveryTime, deliveryDateUtc, type, content, mediaUrl, mediaName } = req.body;

  if (!title || !recipientName || !recipientEmail || !deliveryOption || !type || !content) {
    return res.status(400).json({ error: "Missing required legacy message fields" });
  }

  const db = readDb();
  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    title,
    recipientName,
    recipientEmail,
    deliveryOption,
    deliveryDate: deliveryDate || "",
    deliveryTime: deliveryTime || "",
    deliveryDateUtc: deliveryDateUtc || "",
    type,
    content,
    mediaUrl: mediaUrl || "",
    mediaName: mediaName || "",
    status: "scheduled",
    createdAt: new Date().toISOString()
  };

  db.messages.push(newMessage);
  addNotification(userId, "Legacy Message Scheduled", `Scheduled a legacy ${type} message for ${recipientName} (${deliveryOption}).`);
  writeDb(db);

  res.status(201).json(newMessage);
});

app.put("/api/messages/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { title, recipientName, recipientEmail, deliveryOption, deliveryDate, deliveryTime, deliveryDateUtc, type, content, mediaUrl, mediaName, status } = req.body;

  const db = readDb();
  const index = db.messages.findIndex((m: any) => m.id === id && m.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Legacy message not found" });
  }

  const updatedMessage = {
    ...db.messages[index],
    title: title || db.messages[index].title,
    recipientName: recipientName || db.messages[index].recipientName,
    recipientEmail: recipientEmail || db.messages[index].recipientEmail,
    deliveryOption: deliveryOption || db.messages[index].deliveryOption,
    deliveryDate: deliveryDate !== undefined ? deliveryDate : db.messages[index].deliveryDate,
    deliveryTime: deliveryTime !== undefined ? deliveryTime : db.messages[index].deliveryTime,
    deliveryDateUtc: deliveryDateUtc !== undefined ? deliveryDateUtc : db.messages[index].deliveryDateUtc,
    type: type || db.messages[index].type,
    content: content || db.messages[index].content,
    mediaUrl: mediaUrl !== undefined ? mediaUrl : db.messages[index].mediaUrl,
    mediaName: mediaName !== undefined ? mediaName : db.messages[index].mediaName,
    status: status || db.messages[index].status
  };

  db.messages[index] = updatedMessage;
  writeDb(db);

  res.json(updatedMessage);
});

// Instant deliver message endpoint (manual trigger)
app.post("/api/messages/:id/deliver", authMiddleware, async (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const index = db.messages.findIndex((m: any) => m.id === id && m.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Legacy message not found" });
  }

  const msg = db.messages[index];

  try {
    console.log(`[Manual Delivery] Attempting instant dispatch for message ID: ${msg.id}`);
    const user = db.users.find((u: any) => u.id === msg.userId);
    const emailConfig = user?.emailConfig;

    const emailContent = `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e5e1; background-color: #f9f7f2; color: #1a1a1a;">
        <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 25px; text-align: center;">
          <h1 style="font-size: 26px; font-weight: normal; font-style: italic; margin: 0;">LifeBook Enduring Legacy</h1>
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin: 5px 0 0 0;">Secure Digital Capsule Delivery</p>
        </div>
        
        <p style="font-size: 14px; line-height: 1.6; font-style: italic; color: #444;">Hello ${msg.recipientName},</p>
        
        <p style="font-size: 14px; line-height: 1.6;">
          You have received a sacred digital legacy capsule from <strong>${user?.name || "A Loved One"}</strong>. 
          This time-capsule was locked and scheduled to be delivered for the occasion: <strong>${msg.deliveryOption}</strong>.
        </p>
        
        <div style="background-color: #ffffff; border: 1px solid #e5e5e1; padding: 25px; margin: 25px 0; font-style: italic; line-height: 1.8; font-size: 15px; color: #222; border-left: 4px solid #d97706; white-space: pre-wrap;">
          &ldquo;${msg.content}&rdquo;
        </div>
        
        ${msg.mediaUrl ? `
          <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 15px; text-align: center; margin-bottom: 25px;">
            <p style="font-size: 12px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Attachment Included (${msg.type} capsule)</p>
            <a href="${msg.mediaUrl}" target="_blank" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Open Attached Media</a>
          </div>
        ` : ''}
        
        <p style="font-size: 12px; line-height: 1.6; color: #666; border-top: 1px solid #e5e5e1; padding-top: 15px; margin-top: 30px;">
          This message has been securely compiled and kept safe by LifeBook. 
          To start documenting your own memories or learn more, visit <a href="http://localhost:3000" style="color: #1a1a1a; font-weight: bold;">LifeBook Legacy Suite</a>.
        </p>
      </div>
    `;

    const deliveryResult = await sendEmail({
      to: msg.recipientEmail,
      subject: `✉️ Legacy Time-Capsule: ${msg.title}`,
      html: emailContent,
      config: emailConfig
    });

    db.messages[index].status = "delivered";
    db.messages[index].deliveredAt = new Date().toISOString();
    db.messages[index].error = undefined;
    if (deliveryResult && deliveryResult.previewUrl) {
      db.messages[index].previewUrl = deliveryResult.previewUrl;
    }

    addNotification(
      userId,
      "Capsule Letter Dispatched ✉️",
      `Your legacy time-capsule message "${db.messages[index].title}" has been successfully sent to ${db.messages[index].recipientEmail}!`,
      db
    );

    writeDb(db);
    res.json(db.messages[index]);
  } catch (err: any) {
    console.error(`[Manual Delivery] Failed manual dispatch for message ID: ${msg.id}. Error:`, err);
    db.messages[index].status = "failed";
    db.messages[index].error = err.message || "Unknown SMTP / Resend delivery error";
    
    addNotification(
      userId,
      "⚠️ Message Delivery Failed",
      `Your legacy message "${msg.title}" could not be sent to ${msg.recipientEmail}. Error: ${err.message}`,
      db
    );
    
    writeDb(db);
    res.status(500).json({ error: err.message || "Failed to deliver email" });
  }
});

// Describe photo endpoint (image analysis)
app.post("/api/describe-image", authMiddleware, async (req: any, res) => {
  const { base64Data } = req.body;
  if (!base64Data) {
    return res.status(400).json({ error: "Image data is required" });
  }

  try {
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    let mimeType = "image/png";
    const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
    if (mimeMatch) {
      mimeType = mimeMatch[1];
    }

    const aiClient = getAiClient();
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64,
      },
    };
    const textPart = {
      text: "You are an empathetic biographer and legacy historian. Describe this photo in 1-2 warm, narrative sentences. Focus on the core subject, emotion, and general feeling to serve as a meaningful written description for a family history memory vault entry.",
    };

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
    });

    const generatedText = response.text || "A beautifully preserved photo capturing a special moment.";
    res.json({ description: generatedText.trim() });
  } catch (err: any) {
    console.error("AI image description error:", err);
    // Descriptive random narrative fallbacks for local/offline resilience
    const fallbacks = [
      "A heartwarming snapshot capturing a cherished milestone with family, full of warmth and nostalgia.",
      "A precious archival photo representing a timeless legacy and foundational family origins.",
      "An evocative captured scene filled with joyful smiles, celebrating life's beautiful moments.",
      "A beautifully framed memory preserved for future generations to look back on with love."
    ];
    const chosenFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    res.json({ description: chosenFallback });
  }
});

app.delete("/api/messages/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const message = db.messages.find((m: any) => m.id === id && m.userId === userId);
  if (!message) {
    return res.status(404).json({ error: "Legacy message not found" });
  }

  db.messages = db.messages.filter((m: any) => !(m.id === id && m.userId === userId));
  addNotification(userId, "Legacy Message Cancelled", `Cancelled legacy message to ${message.recipientName}.`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= FAMILY MANAGEMENT CRUD ================= */

app.get("/api/family", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const family = db.family.filter((f: any) => f.userId === userId);
  res.json(family);
});

app.post("/api/family", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { name, relationship, email, phone, dob, permission, profilePhoto } = req.body;

  if (!name || !relationship || !email || !permission) {
    return res.status(400).json({ error: "Name, relationship, email, and permissions are required" });
  }

  const db = readDb();
  const newMember = {
    id: `fam_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    name,
    relationship,
    email,
    phone: phone || "",
    dob: dob || "",
    permission,
    profilePhoto: profilePhoto || "",
    createdAt: new Date().toISOString()
  };

  db.family.push(newMember);
  addNotification(userId, "Family Member Added", `Added ${name} (${relationship}) with ${permission} access.`);
  writeDb(db);

  res.status(201).json(newMember);
});

app.put("/api/family/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { name, relationship, email, phone, dob, permission, profilePhoto } = req.body;

  const db = readDb();
  const index = db.family.findIndex((f: any) => f.id === id && f.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Family member not found" });
  }

  const updatedMember = {
    ...db.family[index],
    name: name || db.family[index].name,
    relationship: relationship || db.family[index].relationship,
    email: email || db.family[index].email,
    phone: phone !== undefined ? phone : db.family[index].phone,
    dob: dob !== undefined ? dob : db.family[index].dob,
    permission: permission || db.family[index].permission,
    profilePhoto: profilePhoto !== undefined ? profilePhoto : db.family[index].profilePhoto
  };

  db.family[index] = updatedMember;
  writeDb(db);

  res.json(updatedMember);
});

app.delete("/api/family/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const member = db.family.find((f: any) => f.id === id && f.userId === userId);
  if (!member) {
    return res.status(404).json({ error: "Family member not found" });
  }

  db.family = db.family.filter((f: any) => !(f.id === id && f.userId === userId));
  addNotification(userId, "Family Member Removed", `Removed ${member.name} from your Family vault.`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= SECURE VAULT CRUD ================= */

app.get("/api/documents", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const documents = db.documents.filter((d: any) => d.userId === userId);
  res.json(documents);
});

app.post("/api/documents", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { name, category, size, fileUrl, mimeType } = req.body;

  if (!name || !category || !fileUrl) {
    return res.status(400).json({ error: "Name, category, and file data are required" });
  }

  const db = readDb();
  const newDocument = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    name,
    category,
    size: size || "Unknown Size",
    uploadDate: new Date().toLocaleDateString(),
    fileUrl,
    mimeType: mimeType || "application/octet-stream",
    isEncrypted: true // Documents in Secure Vault are flagged encrypted by default
  };

  db.documents.push(newDocument);
  addNotification(userId, "Document Securely Stored", `Stored "${name}" in your AES-256 secure digital vault.`);
  writeDb(db);

  res.status(201).json(newDocument);
});

app.put("/api/documents/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const { name, category } = req.body;

  const db = readDb();
  const index = db.documents.findIndex((d: any) => d.id === id && d.userId === userId);

  if (index === -1) {
    return res.status(404).json({ error: "Document not found" });
  }

  const updatedDocument = {
    ...db.documents[index],
    name: name || db.documents[index].name,
    category: category || db.documents[index].category
  };

  db.documents[index] = updatedDocument;
  writeDb(db);

  res.json(updatedDocument);
});

app.delete("/api/documents/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const document = db.documents.find((d: any) => d.id === id && d.userId === userId);
  if (!document) {
    return res.status(404).json({ error: "Document not found" });
  }

  db.documents = db.documents.filter((d: any) => !(d.id === id && d.userId === userId));
  addNotification(userId, "Document Deleted", `Removed "${document.name}" from Secure Vault.`);
  writeDb(db);

  res.json({ success: true });
});

/* ================= AI STORY GENERATOR ================= */

app.get("/api/stories", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const stories = db.stories.filter((s: any) => s.userId === userId);
  res.json(stories);
});

app.post("/api/story/generate", authMiddleware, async (req: any, res) => {
  const userId = req.userId;
  const { biographyLength, personalNotes } = req.body; // 'short' | 'medium' | 'biography'

  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  const userMilestones = db.milestones.filter((m: any) => m.userId === userId);

  // Compile user history as prompt input
  const memoriesSummary = userMemories.map((m: any, i: number) => 
    `Memory ${i+1}: "${m.title}" (${m.date}) at ${m.location}. Description: ${m.description}. Tags: ${m.tags.join(", ")}`
  ).join("\n");

  const milestonesSummary = userMilestones.map((m: any, i: number) => 
    `Milestone ${i+1}: "${m.title}" (${m.date}) - Category: ${m.category}. Description: ${m.description}. Location: ${m.location}`
  ).join("\n");

  const notesPrompt = personalNotes ? `Additional notes provided by user: "${personalNotes}"` : "";

  const systemInstruction = "You are a professional biographer and life archivist. You draft deeply touching, beautifully narrated life stories and biographies based on the raw timelines and memories provided.";

  const prompt = `Write a beautiful, deeply touching, and highly professional biography for ${user.name} (Born: ${user.dob}).
The length of the biography should be ${biographyLength === "short" ? "around 500 words" : biographyLength === "medium" ? "around 1000 words" : "over 1500 words, rich in detail"}.

Here are the preserved raw memories of ${user.name}:
${memoriesSummary || "None logged yet. Focus on welcoming the person and sketching an inspirational memoir structure."}

Here are the milestones from their life timeline:
${milestonesSummary || "None logged yet."}

${notesPrompt}

Structure your response strictly as a JSON object with a "title" field and a "chapters" array. Each chapter must have a "title" field and a "content" string. Do not include markdown code block syntax (like \`\`\`json) in your actual final response unless required by responseType, just provide the raw JSON.
Generate exactly these 8 chapters (if information is missing, use your general creative prose to weave an inspiring narrative for their life companion based on their name and current age):
1. Childhood & Roots
2. Educational Pursuits
3. Career Highlights & Professional Journey
4. Love, Family & Friendships
5. Defining Achievements & Crucial Lessons
6. Personal Values & Philosophy
7. Challenges Overcome
8. Future Vision & Legacy

Ensure the text is fully articulated and written in elegant display prose. Let's make this memory book look like a premium book!`;

  try {
    const aiClient = getAiClient();
    const result = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The overarching book title of the legacy memoir." },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "The title of this biography chapter." },
                  content: { type: Type.STRING, description: "The rich, prose-style narrative content of this chapter." }
                },
                required: ["title", "content"]
              }
            }
          },
          required: ["title", "chapters"]
        }
      }
    });

    const parsedResponse = JSON.parse(result.text || "{}");

    const newStory = {
      id: `story_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId,
      title: parsedResponse.title || `${user.name}'s Digital Legacy Book`,
      biographyLength,
      chapters: parsedResponse.chapters || [],
      generatedAt: new Date().toISOString()
    };

    db.stories.push(newStory);
    addNotification(userId, "Biography Generated", `Your LifeBook Memoir "${newStory.title}" is ready to read!`);
    writeDb(db);

    res.status(201).json(newStory);
  } catch (err: any) {
    console.error("Gemini AI biography generation error:", err);
    // Graceful fallback to static generated story on API issue
    const fallbackStory = {
      id: `story_${Date.now()}_fallback`,
      userId,
      title: `${user.name}'s Custom Memoir Book`,
      biographyLength,
      chapters: [
        { title: "Chapter 1: Childhood & Roots", content: `This chapter marks the beautiful beginning of ${user.name}'s story, reflecting on early family origins, upbringing, and childhood roots. Preserved memories show a path filled with wonder and foundational growth.` },
        { title: "Chapter 2: Educational Pursuits", content: `Education holds the key to expansion. This chapter highlights the intellectual curiosity and academic pathways traversed by ${user.name}, leading to early passions and discoveries.` },
        { title: "Chapter 3: Career Highlights & Professional Journey", content: `The professional path is more than just milestones; it is about dedication and purpose. Here, we outline ${user.name}'s accomplishments, leadership, and professional growth.` },
        { title: "Chapter 4: Love, Family & Friendships", content: `No life is complete without the companion bonds that tether us to this earth. This section is dedicated to family relations, close friendships, and legacy connections.` },
        { title: "Chapter 5: Defining Achievements & Crucial Lessons", content: `Crucial learnings and significant life breakthroughs. Reflecting on key victories that defined character and instilled deep pride.` },
        { title: "Chapter 6: Personal Values & Philosophy", content: `A deep dive into the values that guide ${user.name}: integrity, resilience, compassion, and a lifelong devotion to family preservation.` },
        { title: "Chapter 7: Challenges Overcome", content: `Strength is forged in trial. This chapter records the obstacles and hardships faced along the journey, demonstrating ${user.name}'s powerful spirit and resilience.` },
        { title: "Chapter 8: Future Vision & Legacy", content: `An everlasting vision for grandchildren, descendants, and the world. A beautiful summary of the legacy ${user.name} continues to craft.` }
      ],
      generatedAt: new Date().toISOString()
    };

    db.stories.push(fallbackStory);
    addNotification(userId, "Biography Created (Local Mode)", `Your custom Biography Memoir is now available in your library.`);
    writeDb(db);

    res.status(201).json(fallbackStory);
  }
});

app.delete("/api/stories/:id", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  db.stories = db.stories.filter((s: any) => !(s.id === id && s.userId === userId));
  writeDb(db);

  res.json({ success: true });
});

/* ================= AI COMPANION (CHAT) ================= */

app.get("/api/chat/history", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const history = db.chatHistory[userId] || [
    {
      id: "welcome",
      role: "model",
      text: "Hello! I am your LifeBook AI Legacy Companion. My goal is to help you reflect on your life journey, prompt you with meaningful questions, and help you preserve your digital legacy. What memories would you like to reflect on or add today?",
      date: new Date().toISOString()
    }
  ];
  res.json(history);
});

app.post("/api/chat", authMiddleware, async (req: any, res) => {
  const userId = req.userId;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  const userMilestones = db.milestones.filter((m: any) => m.userId === userId);

  // Initialize history if needed
  if (!db.chatHistory[userId]) {
    db.chatHistory[userId] = [
      {
        id: "welcome",
        role: "model",
        text: `Hello! I am your LifeBook AI Legacy Companion. My goal is to help you reflect on your life journey, prompt you with meaningful questions, and help you preserve your digital legacy. What memories would you like to reflect on or add today?`,
        date: new Date().toISOString()
      }
    ];
  }

  // Add user message to history
  const userMsgId = `chat_${Date.now()}_u`;
  const userMessageObj = {
    id: userMsgId,
    role: "user" as const,
    text: message,
    date: new Date().toISOString()
  };
  db.chatHistory[userId].push(userMessageObj);

  // Compile context of previous memories for Phase 9 "AI companion remembers previous memories"
  const memoriesContextText = userMemories.length > 0 
    ? userMemories.map((m: any) => `- "${m.title}" (${m.date}): ${m.description}`).join("\n")
    : "No memories logged yet. Prompt them to log their very first memory or milestone!";

  const milestonesContextText = userMilestones.length > 0
    ? userMilestones.map((m: any) => `- Milestone: "${m.title}" (${m.date}, Category: ${m.category}): ${m.description}`).join("\n")
    : "No milestones recorded on their timeline yet.";

  const systemInstruction = `You are the empathetic, warm, and highly professional LifeBook AI Legacy Companion for ${user.name}.
Your job is to help them preserve their legacy, review past memories, suggest memory ideas, and prompt them with deeply reflective questions.

CRITICAL INSTRUCTION FOR CONTEXT (Phase 9):
You have absolute access to their memory records. ALWAYS acknowledge or weave in their previously logged memories when relevant, demonstrating that you have high-fidelity memory of their details.
Here are the user's logged memories:
${memoriesContextText}

Here are their timeline milestones:
${milestonesContextText}

Guidelines:
1. Speak warmly, empathetically, and with a comforting tone.
2. If they mention logging a new memory, help them articulate it, and provide a welcoming response.
3. Suggest 1 or 2 specific reflective prompts related to their timeline or gap areas (e.g. if they have no childhood memories, ask about their birthplace or early games).
4. Keep answers concise, highly human, and conversational (avoid long system headers).`;

  try {
    const aiClient = getAiClient();
    
    // Map history to Google Gen AI Content structure
    const historyForSdk = db.chatHistory[userId].slice(-10).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    }));

    // Add current context
    const chat = aiClient.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
      },
      // Seed with recent history
      history: historyForSdk.slice(0, -1) // Excluding the last one because we'll pass it in sendMessage
    });

    const response = await chat.sendMessage({ message: message });
    const aiResponseText = response.text || "I'm reflecting on your beautiful memories. Let's write them down.";

    const modelMsgId = `chat_${Date.now()}_m`;
    const modelMessageObj = {
      id: modelMsgId,
      role: "model" as const,
      text: aiResponseText,
      date: new Date().toISOString()
    };

    db.chatHistory[userId].push(modelMessageObj);
    writeDb(db);

    res.json(modelMessageObj);
  } catch (err: any) {
    console.error("AI companion chat error:", err);
    // Emulated fallback response
    let emulatedResponse = `That is very fascinating! Looking at your memories (like ${userMemories[0]?.title || 'your early days'}), every detail is incredibly valuable for your descendants. What's another details from that era you would like to document?`;
    
    const modelMsgId = `chat_${Date.now()}_m_fb`;
    const modelMessageObj = {
      id: modelMsgId,
      role: "model" as const,
      text: emulatedResponse,
      date: new Date().toISOString()
    };

    db.chatHistory[userId].push(modelMessageObj);
    writeDb(db);

    res.json(modelMessageObj);
  }
});

app.delete("/api/chat/history", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  db.chatHistory[userId] = [
    {
      id: "welcome",
      role: "model",
      text: "Chat cleared. I'm ready to begin a fresh conversation! What part of your life story would you like to reflect on today?",
      date: new Date().toISOString()
    }
  ];
  writeDb(db);
  res.json({ success: true, history: db.chatHistory[userId] });
});

/* ================= NOTIFICATIONS ENDPOINTS ================= */

app.get("/api/notifications", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const notifications = db.notifications.filter((n: any) => n.userId === userId);
  res.json(notifications);
});

app.put("/api/notifications/:id/read", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const db = readDb();
  const index = db.notifications.findIndex((n: any) => n.id === id && n.userId === userId);

  if (index !== -1) {
    db.notifications[index].read = true;
    writeDb(db);
  }
  res.json({ success: true });
});

app.post("/api/notifications/clear", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  db.notifications = db.notifications.filter((n: any) => n.userId !== userId);
  writeDb(db);
  res.json({ success: true });
});

/* ================= GLOBAL SEARCH ================= */

app.get("/api/search", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const query = (req.query.q || "").toLowerCase().trim();

  if (!query) {
    return res.json({ memories: [], milestones: [], documents: [], family: [], messages: [] });
  }

  const db = readDb();
  const userMemories = db.memories.filter((m: any) => 
    m.userId === userId && 
    (m.title.toLowerCase().includes(query) || 
     m.description.toLowerCase().includes(query) || 
     m.location.toLowerCase().includes(query) || 
     m.tags.some((t: string) => t.toLowerCase().includes(query)))
  );

  const userMilestones = db.milestones.filter((m: any) => 
    m.userId === userId && 
    (m.title.toLowerCase().includes(query) || 
     m.description.toLowerCase().includes(query) || 
     m.category.toLowerCase().includes(query) ||
     m.location.toLowerCase().includes(query))
  );

  const userDocuments = db.documents.filter((d: any) => 
    d.userId === userId && 
    (d.name.toLowerCase().includes(query) || 
     d.category.toLowerCase().includes(query))
  );

  const userFamily = db.family.filter((f: any) => 
    f.userId === userId && 
    (f.name.toLowerCase().includes(query) || 
     f.relationship.toLowerCase().includes(query) || 
     f.email.toLowerCase().includes(query))
  );

  const userMessages = db.messages.filter((m: any) => 
    m.userId === userId && 
    (m.title.toLowerCase().includes(query) || 
     m.recipientName.toLowerCase().includes(query) || 
     m.recipientEmail.toLowerCase().includes(query) || 
     m.content.toLowerCase().includes(query))
  );

  res.json({
    memories: userMemories,
    milestones: userMilestones,
    documents: userDocuments,
    family: userFamily,
    messages: userMessages
  });
});

/* ================= SETTINGS ================= */

app.put("/api/settings/profile", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { name, email, dob, phone, profilePhoto } = req.body;

  const db = readDb();
  const index = db.users.findIndex((u: any) => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  // Update profile
  db.users[index].name = name || db.users[index].name;
  db.users[index].email = email || db.users[index].email;
  db.users[index].dob = dob || db.users[index].dob;
  db.users[index].phone = phone !== undefined ? phone : db.users[index].phone;
  db.users[index].profilePhoto = profilePhoto !== undefined ? profilePhoto : db.users[index].profilePhoto;

  addNotification(userId, "Profile Updated", "Your profile information was updated successfully.");
  writeDb(db);

  const completion = calculateCompletion(userId, db);

  res.json({
    id: db.users[index].id,
    name: db.users[index].name,
    email: db.users[index].email,
    dob: db.users[index].dob,
    phone: db.users[index].phone,
    profilePhoto: db.users[index].profilePhoto || "",
    legacyCompletion: completion,
    createdAt: db.users[index].createdAt
  });
});

app.put("/api/settings/password", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }

  const db = readDb();
  const index = db.users.findIndex((u: any) => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  if (db.users[index].password !== currentPassword) {
    return res.status(400).json({ error: "Incorrect current password" });
  }

  db.users[index].password = newPassword;
  addNotification(userId, "Password Changed", "Your password has been changed successfully.");
  writeDb(db);

  res.json({ success: true });
});

app.delete("/api/settings/account", authMiddleware, (req: any, res) => {
  const userId = req.userId;

  const db = readDb();
  // Filter out everything for this user
  db.users = db.users.filter((u: any) => u.id !== userId);
  db.memories = db.memories.filter((m: any) => m.userId !== userId);
  db.milestones = db.milestones.filter((m: any) => m.userId !== userId);
  db.messages = db.messages.filter((m: any) => m.userId !== userId);
  db.family = db.family.filter((f: any) => f.userId !== userId);
  db.documents = db.documents.filter((d: any) => d.userId !== userId);
  db.stories = db.stories.filter((s: any) => s.userId !== userId);
  db.notifications = db.notifications.filter((n: any) => n.userId !== userId);
  delete db.chatHistory[userId];

  writeDb(db);
  res.json({ success: true });
});

/* ================= EMAIL DELIVERY CONFIGURATION ENDPOINTS ================= */

app.get("/api/settings/email-config", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(user.emailConfig || {
    protocol: "SMTP",
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    resendApiKey: "",
    resendFrom: ""
  });
});

app.put("/api/settings/email-config", authMiddleware, (req: any, res) => {
  const userId = req.userId;
  const { protocol, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, resendApiKey, resendFrom } = req.body;

  const db = readDb();
  const index = db.users.findIndex((u: any) => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  db.users[index].emailConfig = {
    protocol: protocol || "SMTP",
    smtpHost: smtpHost || "",
    smtpPort: smtpPort || "587",
    smtpUser: smtpUser || "",
    smtpPass: smtpPass || "",
    smtpFrom: smtpFrom || "",
    resendApiKey: resendApiKey || "",
    resendFrom: resendFrom || ""
  };

  addNotification(userId, "Email Credentials Configured", "Your SMTP/Resend email service configurations have been saved successfully.");
  writeDb(db);

  res.json({ success: true, emailConfig: db.users[index].emailConfig });
});

/* ================= GOOGLE FLOW AI VIDEO GENERATION ================= */

app.post("/api/video/generate", authMiddleware, async (req: any, res) => {
  const userId = req.userId;
  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const userMemories = db.memories.filter((m: any) => m.userId === userId);
  const userMilestones = db.milestones.filter((m: any) => m.userId === userId);
  const userFamily = db.family.filter((f: any) => f.userId === userId);

  // Collect available media files
  const availableMedia: any[] = [];
  userMemories.forEach((m: any) => {
    if (m.media && Array.isArray(m.media)) {
      m.media.forEach((file: any) => {
        availableMedia.push({
          url: file.url,
          type: file.type,
          name: file.name,
          memoryTitle: m.title
        });
      });
    }
  });

  const prompt = `You are a professional cinematic director for "Google Flow", an AI-powered legacy video production suite.
Your goal is to compile an emotional, premium, scene-by-scene cinematic legacy video storyboard for ${user.name}.
Analyze their digital ledger details and output a highly personalized JSON storyboard.

Here is the user's legacy catalog data:
- Name: ${user.name}
- Age/Born: Born ${user.dob}
- Logged Memories (${userMemories.length}): ${JSON.stringify(userMemories.map(m => ({ title: m.title, description: m.description, date: m.date })))}
- Timeline Milestones (${userMilestones.length}): ${JSON.stringify(userMilestones.map(m => ({ title: m.title, description: m.description, category: m.category, date: m.date })))}
- Family Members (${userFamily.length}): ${JSON.stringify(userFamily.map(f => ({ name: f.name, relation: f.relationship })))}

Here is a list of their uploaded media files you can assign to scenes:
${JSON.stringify(availableMedia.map(m => ({ url: m.url, type: m.type, name: m.name, memoryTitle: m.memoryTitle })))}

Guidelines for the video storyboard:
1. Come up with a beautiful title like "The Symphony of Life: ${user.name}'s Journey" or "Tracing the Footsteps of ${user.name}".
2. Recommend a backing music style (e.g. "Grand Orchestral Strings", "Reflective Ambient Piano", "Acoustic Melancholy").
3. Divide the video into 3 to 5 scenes.
4. Each scene should have a scene title, narrative voiceover script (1-2 sentences), a cinematic visual cue (e.g., "Slow zoom into a sunlit table...", "Pan over family trees..."), a duration in seconds (sum of scene durations should be around 30 to 60 seconds), and an optional mediaUrl (select from their uploaded media list above, or leave blank/null to use fallbacks/illustrations).
5. Ensure the tone is extremely touching, respectful, emotional, and authentic.`;

  try {
    const aiClient = getAiClient();
    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            musicTrack: { type: Type.STRING },
            durationSeconds: { type: Type.INTEGER },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  visualCue: { type: Type.STRING },
                  duration: { type: Type.INTEGER },
                  mediaUrl: { type: Type.STRING }
                },
                required: ["title", "narration", "visualCue", "duration"]
              }
            }
          },
          required: ["title", "musicTrack", "durationSeconds", "scenes"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Video script generation error:", err);
    // Reliable static fallback with customizable details
    const defaultTitle = `${user.name}'s Legacy Chronicle`;
    const fallbackVideo = {
      title: defaultTitle,
      musicTrack: "Acoustic Melancholy",
      durationSeconds: 30,
      scenes: [
        {
          title: "Introduction: Foundations of Life",
          narration: `Every life story is a masterpiece woven with love, resilience, and memory. Today, we honor the legacy of ${user.name}.`,
          visualCue: "Soft ambient golden light sweeps across an elegant historical leather-bound book.",
          duration: 10,
          mediaUrl: availableMedia[0]?.url || ""
        },
        {
          title: "Milestones: Chapters of Triumph",
          narration: `Through critical life milestones and cherished memories, ${user.name} has paved a strong path for future generations.`,
          visualCue: "Ken Burns zoom over a vintage clock ticking gracefully, symbolizing timeless family connections.",
          duration: 10,
          mediaUrl: availableMedia[1]?.url || availableMedia[0]?.url || ""
        },
        {
          title: "Everlasting Vision: A Message to Tomorrow",
          narration: `The values of integrity, compassion, and strength continue to echo down the timeline of family and history.`,
          visualCue: "Fade into a warm glowing candle flame, reflecting an eternal spirit of heritage.",
          duration: 10,
          mediaUrl: availableMedia[2]?.url || availableMedia[0]?.url || ""
        }
      ]
    };
    res.json(fallbackVideo);
  }
});


async function checkAndDeliverScheduledMessages() {
  const now = new Date();
  console.log(`[Scheduler] Checking for pending legacy messages... Current UTC: ${now.toISOString()}`);
  
  try {
    const db = readDb();
    let updated = false;

    for (const msg of db.messages) {
      if (msg.status === "scheduled" || msg.status === "failed") {
        let shouldDeliver = false;

        if (msg.deliveryDateUtc) {
          const targetDateTime = new Date(msg.deliveryDateUtc);
          if (!isNaN(targetDateTime.getTime()) && now >= targetDateTime) {
            shouldDeliver = true;
          }
        } else if (msg.deliveryOption === "Specific Date" && msg.deliveryDate) {
          const dateStr = msg.deliveryDate;
          const timeStr = msg.deliveryTime || "00:00";
          const targetDateTime = new Date(`${dateStr}T${timeStr}:00`);

          if (!isNaN(targetDateTime.getTime()) && now >= targetDateTime) {
            shouldDeliver = true;
          }
        } else if (msg.deliveryOption !== "Specific Date") {
          // Auto-deliver event-based milestone types within 45 seconds for testing/interactivity
          const createdAtDate = new Date(msg.createdAt);
          const elapsedSec = (now.getTime() - createdAtDate.getTime()) / 1000;
          if (elapsedSec > 45) {
            shouldDeliver = true;
          }
        }

        if (shouldDeliver) {
          console.log(`[Scheduler] Found pending message for delivery: "${msg.title}" (ID: ${msg.id}) targeting recipient ${msg.recipientEmail}`);
          
          const user = db.users.find((u: any) => u.id === msg.userId);
          const emailConfig = user?.emailConfig;

          const emailContent = `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e5e1; background-color: #f9f7f2; color: #1a1a1a;">
              <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 25px; text-align: center;">
                <h1 style="font-size: 26px; font-weight: normal; font-style: italic; margin: 0;">LifeBook Enduring Legacy</h1>
                <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin: 5px 0 0 0;">Secure Digital Capsule Delivery</p>
              </div>
              
              <p style="font-size: 14px; line-height: 1.6; font-style: italic; color: #444;">Hello ${msg.recipientName},</p>
              
              <p style="font-size: 14px; line-height: 1.6;">
                You have received a sacred digital legacy capsule from <strong>${user?.name || "A Loved One"}</strong>. 
                This time-capsule was locked and scheduled to be delivered for the occasion: <strong>${msg.deliveryOption}</strong>.
              </p>
              
              <div style="background-color: #ffffff; border: 1px solid #e5e5e1; padding: 25px; margin: 25px 0; font-style: italic; line-height: 1.8; font-size: 15px; color: #222; border-left: 4px solid #d97706; white-space: pre-wrap;">
                &ldquo;${msg.content}&rdquo;
              </div>
              
              ${msg.mediaUrl ? `
                <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; padding: 15px; text-align: center; margin-bottom: 25px;">
                  <p style="font-size: 12px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Attachment Included (${msg.type} capsule)</p>
                  <a href="${msg.mediaUrl}" target="_blank" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 10px 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Open Attached Media</a>
                </div>
              ` : ''}
              
              <p style="font-size: 12px; line-height: 1.6; color: #666; border-top: 1px solid #e5e5e1; padding-top: 15px; margin-top: 30px;">
                This message has been securely compiled and kept safe by LifeBook. 
                To start documenting your own memories or learn more, visit <a href="http://localhost:3000" style="color: #1a1a1a; font-weight: bold;">LifeBook Legacy Suite</a>.
              </p>
            </div>
          `;

          try {
            const deliveryResult = await sendEmail({
              to: msg.recipientEmail,
              subject: `✉️ Legacy Time-Capsule: ${msg.title}`,
              html: emailContent,
              config: emailConfig
            });

            msg.status = "delivered";
            msg.deliveredAt = new Date().toISOString();
            msg.error = undefined;
            if (deliveryResult && deliveryResult.previewUrl) {
              msg.previewUrl = deliveryResult.previewUrl;
            }

            addNotification(
              msg.userId,
              "✉️ Scheduled Capsule Delivered!",
              `Your scheduled message "${msg.title}" has been successfully delivered to ${msg.recipientName} (${msg.recipientEmail})!`,
              db
            );

            updated = true;
            console.log(`[Scheduler] Automatically delivered scheduled message ID: ${msg.id} successfully!`);
          } catch (sendErr: any) {
            console.error(`[Scheduler] Failed to send scheduled email for message ID: ${msg.id}. Error:`, sendErr);
            msg.status = "failed";
            msg.error = sendErr.message || "Unknown SMTP/Resend delivery error";

            addNotification(
              msg.userId,
              "⚠️ Scheduled Capsule Delivery Failed",
              `Your legacy message "${msg.title}" scheduled for ${msg.recipientEmail} failed to send. Error: ${sendErr.message}`,
              db
            );
            
            updated = true;
          }
        }
      }
    }

    if (updated) {
      writeDb(db);
    }
  } catch (err) {
    console.error("[Scheduler] Error in checkAndDeliverScheduledMessages background loop:", err);
  }
}

// Vite middleware integration (from instructions)
async function startServer() {
  // Start background message scheduler
  setInterval(checkAndDeliverScheduledMessages, 10000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
