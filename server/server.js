import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateAndCompositeImage, getCuratedBackground } from "./imageComposer.js";
import { optimizeArticleWithAI, slugify } from "./seoEngine.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "config.json");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// In-memory tasks store
const tasks = {};

// Default config
let config = {
  geminiKey: "",
  openaiKey: "",
  alibabaKey: "",
  leonardoKey: "",
  websites: [],
  customSystemPrompt: "",
  logo1: "",
  logo2: "",
  logoPosition: "top-left",
  logoScale: 15,
  logo1Position: "top-left",
  logo1Scale: 12,
  logo2Position: "top-right",
  logo2Scale: 15,
  imageSize: "1200x800",
  hasLogos: true,
  backlinks: [],
  smtpEmail: "",
  smtpPassword: ""
};

// MongoDB Schemas & Models
const userSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, default: "pending" },
  activationCode: { type: String },
  role: { type: String, default: "user" },
  createdAt: { type: String }
});
const User = mongoose.model("User", userSchema);

const configSchema = new mongoose.Schema({
  geminiKey: { type: String, default: "" },
  openaiKey: { type: String, default: "" },
  alibabaKey: { type: String, default: "" },
  leonardoKey: { type: String, default: "" },
  websites: { type: Array, default: [] },
  customSystemPrompt: { type: String, default: "" },
  logo1: { type: String, default: "" },
  logo2: { type: String, default: "" },
  logoPosition: { type: String, default: "top-left" },
  logoScale: { type: Number, default: 15 },
  logo1Position: { type: String, default: "top-left" },
  logo1Scale: { type: Number, default: 12 },
  logo2Position: { type: String, default: "top-right" },
  logo2Scale: { type: Number, default: 15 },
  imageSize: { type: String, default: "1200x800" },
  hasLogos: { type: Boolean, default: true },
  backlinks: { type: Array, default: [] },
  smtpEmail: { type: String, default: "" },
  smtpPassword: { type: String, default: "" }
}, { strict: false });
const Config = mongoose.model("Config", configSchema);

const historySchema = new mongoose.Schema({
  taskId: { type: String, required: true },
  title: { type: String, required: true },
  link: { type: String, required: true },
  imageUrl: { type: String },
  topic: { type: String },
  websiteName: { type: String },
  websiteUrl: { type: String },
  timestamp: { type: String }
});
const History = mongoose.model("History", historySchema);

async function initializeConfig() {
  try {
    if (mongoose.connection.readyState === 1) {
      let dbConfig = await Config.findOne({});
      if (!dbConfig) {
        let initialConfig = { ...config };
        if (fs.existsSync(CONFIG_PATH)) {
          try {
            const raw = fs.readFileSync(CONFIG_PATH, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed.wpUrl && parsed.wpUrl.trim() !== "") {
              if (!parsed.websites) parsed.websites = [];
              const alreadyMigrated = parsed.websites.some(w => w.url === parsed.wpUrl);
              if (!alreadyMigrated) {
                parsed.websites.push({
                  id: "site_" + Date.now(),
                  name: "MaxDent",
                  url: parsed.wpUrl,
                  user: parsed.wpUser || "",
                  password: parsed.wpAppPassword || ""
                });
              }
              delete parsed.wpUrl;
              delete parsed.wpUser;
              delete parsed.wpAppPassword;
            }
            initialConfig = { ...initialConfig, ...parsed };
          } catch (e) {
            console.error("Failed to migrate config.json to MongoDB:", e);
          }
        }
        dbConfig = new Config(initialConfig);
        await dbConfig.save();
        console.log("Config initialized in MongoDB Atlas!");
      }
      config = dbConfig.toObject();
      console.log("Config loaded from MongoDB Atlas.");
    } else {
      if (fs.existsSync(CONFIG_PATH)) {
        try {
          const raw = fs.readFileSync(CONFIG_PATH, "utf8");
          const parsed = JSON.parse(raw);
          if (!parsed.websites) parsed.websites = [];
          if (parsed.wpUrl && parsed.wpUrl.trim() !== "") {
            const alreadyMigrated = parsed.websites.some(w => w.url === parsed.wpUrl);
            if (!alreadyMigrated) {
              parsed.websites.push({
                id: "site_" + Date.now(),
                name: "MaxDent",
                url: parsed.wpUrl,
                user: parsed.wpUser || "",
                password: parsed.wpAppPassword || ""
              });
            }
            delete parsed.wpUrl;
            delete parsed.wpUser;
            delete parsed.wpAppPassword;
          }
          config = { ...config, ...parsed };
          console.log("Config loaded & migrated from config.json");
        } catch (err) {
          console.error("Failed to parse config.json, using defaults:", err);
        }
      }
    }
  } catch (err) {
    console.error("Error in initializeConfig:", err);
  }
}

const USERS_PATH = path.join(__dirname, "users.json");

const readUsers = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return await User.find({}).lean();
    }
    if (!fs.existsSync(USERS_PATH)) {
      fs.writeFileSync(USERS_PATH, "[]", "utf8");
      return [];
    }
    const data = fs.readFileSync(USERS_PATH, "utf8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("Failed to read users:", err);
    return [];
  }
};

const writeUsers = async (users) => {
  try {
    if (mongoose.connection.readyState === 1) {
      for (const u of users) {
        await User.findOneAndUpdate({ id: u.id }, u, { upsert: true, new: true });
      }
      return true;
    }
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write users:", err);
    return false;
  }
};

const JWT_SECRET = "WP_PUBLISHER_SECRET_KEY_2026";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Không tìm thấy token xác thực. Vui lòng đăng nhập!" });
    }
    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại!" });
    }
    
    const users = await readUsers();
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "Người dùng không tồn tại trong hệ thống." });
    }
    
    if (user.status === "suspended") {
      return res.status(403).json({ error: "Tài khoản của bạn đã bị khóa bởi Quản trị viên." });
    }

    
    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: "Lỗi hệ thống xác thực: " + err.message });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === "admin" && req.user.email === "haison20032812@gmail.com") {
    next();
  } else {
    res.status(403).json({ error: "Quyền truy cập bị từ chối. Chỉ dành cho Quản trị viên chính!" });
  }
};

const sendActivationEmail = async (email, username, code) => {
  const { smtpEmail, smtpPassword } = config;
  if (!smtpEmail || !smtpPassword || smtpEmail.trim() === "" || smtpPassword.trim() === "") {
    console.warn("[Email] SMTP is not configured. Verification code is:", code);
    return false;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    const mailOptions = {
      from: `"WP Auto-Publisher" <${smtpEmail}>`,
      to: email,
      subject: "Mã kích hoạt tài khoản WP Auto-Publisher",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">Kích hoạt tài khoản WP Auto-Publisher</h2>
          <p>Xin chào <strong>${username}</strong>,</p>
          <p>Cảm ơn bạn đã đăng ký tài khoản trên hệ thống WP Auto-Publisher Pro. Dưới đây là mã xác thực để kích hoạt tài khoản của bạn:</p>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #4f46e5; margin: 20px 0; border-radius: 6px; border: 1px solid #cbd5e1;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 13px;">Mã này chỉ có hiệu lực một lần để kích hoạt. Vui lòng nhập mã này vào ô xác thực trên giao diện ứng dụng để bắt đầu sử dụng.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center;">Đây là email tự động từ hệ thống của bạn, vui lòng không trả lời.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] Verification code email sent successfully to ${email}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send verification email:", err.message);
    return false;
  }
};

const sendAdminNotificationEmail = async (newUser) => {
  const { smtpEmail, smtpPassword } = config;
  const adminEmail = "haison20032812@gmail.com";
  
  if (!smtpEmail || !smtpPassword || smtpEmail.trim() === "" || smtpPassword.trim() === "") {
    console.warn("[Email] SMTP is not configured. Cannot send admin notification for registration.");
    return false;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    const mailOptions = {
      from: `"WP Auto-Publisher System" <${smtpEmail}>`,
      to: adminEmail,
      subject: `[Thông báo] Thành viên mới đăng ký: ${newUser.username}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">Thông báo đăng ký tài khoản mới</h2>
          <p>Chào Admin,</p>
          <p>Hệ thống ghi nhận có tài khoản mới vừa được đăng ký trên WP Auto-Publisher:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; width: 150px;">Tên đăng nhập:</td>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${newUser.username}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Địa chỉ Email:</td>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${newUser.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Mã kích hoạt (Code):</td>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #4f46e5; font-size: 1.1rem;">${newUser.activationCode}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Thời gian đăng ký:</td>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${new Date(newUser.createdAt).toLocaleString("vi-VN")}</td>
            </tr>
          </table>
          <p>Bạn có thể đăng nhập vào trang quản trị để quản lý, phê duyệt hoặc khóa tài khoản này nếu cần thiết.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center;">Hệ thống thông báo tự động từ phần mềm của bạn.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] Admin notification email sent successfully to ${adminEmail}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send admin notification email:", err.message);
    return false;
  }
};

// Global authentication interceptor middleware for API routes
app.use((req, res, next) => {
  const publicPaths = [
    "/api/auth/login",
    "/api/auth/register"
  ];
  
  if (req.path.startsWith("/api/") && !publicPaths.includes(req.path)) {
    return authMiddleware(req, res, next);
  }
  next();
});

// Authentication Routes
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password || username.trim() === "" || email.trim() === "" || password.trim() === "") {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin đăng ký (Tên đăng nhập, Email, Mật khẩu)!" });
  }

  try {
    const users = await readUsers();
    const duplicateUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (duplicateUser) {
      return res.status(400).json({ error: "Tên đăng nhập đã tồn tại trong hệ thống!" });
    }
    const duplicateEmail = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (duplicateEmail) {
      return res.status(400).json({ error: "Địa chỉ email này đã được đăng ký!" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const isFirstUser = users.length === 0;
    const role = isFirstUser ? "admin" : "user";
    const status = "active"; // Always active, no activation screen
    
    const newUser = {
      id: "usr_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      username,
      email,
      password: hashedPassword,
      status,
      role,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    await writeUsers(users);
    
    // Gửi thông báo đăng ký tới email của Admin
    await sendAdminNotificationEmail(newUser);
    
    res.json({
      success: true,
      message: isFirstUser 
        ? "Đăng ký tài khoản Admin thành công! Tài khoản đã sẵn sàng sử dụng." 
        : "Đăng ký thành công! Bạn đã có thể đăng nhập để sử dụng phần mềm ngay lập tức."
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đăng ký tài khoản: " + err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password || usernameOrEmail.trim() === "" || password.trim() === "") {
    return res.status(400).json({ error: "Vui lòng nhập Tên đăng nhập/Email và Mật khẩu!" });
  }
  
  try {
    const users = await readUsers();
    const user = users.find(u => 
      u.username.toLowerCase() === usernameOrEmail.toLowerCase() || 
      u.email.toLowerCase() === usernameOrEmail.toLowerCase()
    );
    
    if (!user) {
      return res.status(400).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng!" });
    }
    
    if (user.status === "suspended") {
      return res.status(403).json({ error: "Tài khoản của bạn đã bị khóa bởi Quản trị viên." });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng!" });
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đăng nhập: " + err.message });
  }
});

app.post("/api/auth/activate", authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code || code.trim() === "") {
    return res.status(400).json({ error: "Vui lòng nhập mã kích hoạt!" });
  }
  
  try {
    const users = await readUsers();
    const userIdx = users.findIndex(u => u.id === req.user.id);
    if (userIdx === -1) {
      return res.status(400).json({ error: "Không tìm thấy thông tin tài khoản." });
    }
    
    const user = users[userIdx];
    if (user.status === "active") {
      return res.json({ success: true, message: "Tài khoản của bạn đã được kích hoạt!" });
    }
    
    if (user.activationCode !== code.trim()) {
      return res.status(400).json({ error: "Mã kích hoạt không đúng. Vui lòng kiểm tra lại!" });
    }
    
    users[userIdx].status = "active";
    users[userIdx].activationCode = "";
    await writeUsers(users);
    
    res.json({
      success: true,
      message: "Tài khoản của bạn đã được kích hoạt thành công!"
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi kích hoạt tài khoản: " + err.message });
  }
});

app.post("/api/auth/resend-code", authMiddleware, async (req, res) => {
  try {
    const users = await readUsers();
    const userIdx = users.findIndex(u => u.id === req.user.id);
    if (userIdx === -1) {
      return res.status(400).json({ error: "Không tìm thấy thông tin tài khoản." });
    }
    
    const user = users[userIdx];
    if (user.status === "active") {
      return res.status(400).json({ error: "Tài khoản đã được kích hoạt." });
    }
    
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    users[userIdx].activationCode = newCode;
    await writeUsers(users);
    
    const emailSent = await sendActivationEmail(user.email, user.username, newCode);
    
    res.json({
      success: true,
      message: emailSent 
        ? "Mã kích hoạt mới đã được gửi về email của bạn." 
        : `Gửi lại mã thành công! Mã xác thực mới là: ${newCode} (Vui lòng kiểm tra trong log server/users.json do chưa cấu hình SMTP).`
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi gửi lại mã kích hoạt: " + err.message });
  }
});

// Admin Control Panel Routes
app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await readUsers();
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      status: u.status,
      role: u.role,
      createdAt: u.createdAt
    }));
    res.json(sanitizedUsers);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách thành viên: " + err.message });
  }
});

app.post("/api/admin/users/:id/status", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ!" });
  }
  
  try {
    const users = await readUsers();
    const userIdx = users.findIndex(u => u.id === id);
    if (userIdx === -1) {
      return res.status(404).json({ error: "Không tìm thấy thành viên." });
    }
    if (users[userIdx].id === req.user.id) {
      return res.status(400).json({ error: "Bạn không thể tự khóa tài khoản của chính mình!" });
    }
    
    users[userIdx].status = status;
    await writeUsers(users);
    res.json({
      success: true,
      message: `Đã cập nhật trạng thái tài khoản thành công sang: ${status === "active" ? "Cho phép sử dụng" : "Khóa tài khoản"}`
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật trạng thái thành viên: " + err.message });
  }
});

app.post("/api/admin/smtp", authMiddleware, adminMiddleware, async (req, res) => {
  const { smtpEmail, smtpPassword } = req.body;
  if (!smtpEmail || smtpEmail.trim() === "" || !smtpPassword || smtpPassword.trim() === "") {
    return res.status(400).json({ error: "Vui lòng nhập Email và Mật khẩu ứng dụng SMTP!" });
  }
  
  try {
    config.smtpEmail = smtpEmail.trim();
    config.smtpPassword = smtpPassword.trim();
    if (mongoose.connection.readyState === 1) {
      let dbConfig = await Config.findOne({});
      if (dbConfig) {
        dbConfig.smtpEmail = config.smtpEmail;
        dbConfig.smtpPassword = config.smtpPassword;
        await dbConfig.save();
      } else {
        dbConfig = new Config(config);
        await dbConfig.save();
      }
      config = dbConfig.toObject();
    } else {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    }
    res.json({ success: true, message: "Đã cập nhật cấu hình gửi mail SMTP thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lưu cấu hình SMTP: " + err.message });
  }
});

// Get config
app.get("/api/config", (req, res) => {
  const userConfig = { ...config };
  userConfig.websites = (config.websites || []).filter(w => {
    if (w.addedBy === req.user.id) return true;
    if (req.user.role === 'admin' && (w.addedBy === 'admin' || !w.addedBy)) return true;
    return false;
  });
  res.json(userConfig);
});

// Update config
app.post("/api/config", async (req, res) => {
  try {
    let incomingConfig = { ...req.body };
    
    let dbConfig = null;
    if (mongoose.connection.readyState === 1) {
      dbConfig = await Config.findOne({});
    }
    const currentWebsites = dbConfig ? (dbConfig.websites || []) : (config.websites || []);

    if (incomingConfig.websites && Array.isArray(incomingConfig.websites)) {
      // 1. Tag incoming websites with current user's ID
      const incomingWebsites = incomingConfig.websites.map(w => ({
        ...w,
        addedBy: w.addedBy || req.user.id
      }));

      // 2. Keep websites belonging to other users
      const otherUsersWebsites = currentWebsites.filter(w => {
        if (w.addedBy === req.user.id) return false;
        if (req.user.role === 'admin' && (w.addedBy === 'admin' || !w.addedBy)) return false;
        return true;
      });

      // 3. Merge websites
      incomingConfig.websites = [...otherUsersWebsites, ...incomingWebsites];
    } else {
      incomingConfig.websites = currentWebsites;
    }

    config = { ...config, ...incomingConfig };
    
    if (mongoose.connection.readyState === 1) {
      if (dbConfig) {
        Object.assign(dbConfig, incomingConfig);
        await dbConfig.save();
      } else {
        dbConfig = new Config(config);
        await dbConfig.save();
      }
      config = dbConfig.toObject();
    } else {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    }

    // Filter websites returned in response
    const responseConfig = { ...config };
    responseConfig.websites = (config.websites || []).filter(w => {
      if (w.addedBy === req.user.id) return true;
      if (req.user.role === 'admin' && (w.addedBy === 'admin' || !w.addedBy)) return true;
      return false;
    });

    res.json({ success: true, message: "Configuration saved successfully!", config: responseConfig });
  } catch (err) {
    res.status(500).json({ error: "Failed to save configuration: " + err.message });
  }
});

// Test LLM & DALL-E API keys connection
app.post("/api/test-api-keys", async (req, res) => {
  const { geminiKey, openaiKey, alibabaKey, leonardoKey } = req.body;
  const results = {
    gemini: { success: false, message: "" },
    openai: { success: false, message: "" },
    alibaba: { success: false, message: "" },
    leonardo: { success: false, message: "" }
  };

  if (geminiKey && geminiKey.trim() !== "") {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      await model.generateContent({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 5 }
      });
      results.gemini.success = true;
      results.gemini.message = "Kết nối thành công (Model: gemini-1.5-flash).";
    } catch (err) {
      results.gemini.success = false;
      results.gemini.message = `Thất bại: ${err.message}`;
    }
  } else {
    results.gemini.message = "Không có khoá nào được nhập.";
  }

  if (openaiKey && openaiKey.trim() !== "") {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5
      }, { timeout: 10000 });
      results.openai.success = true;
      results.openai.message = "Kết nối thành công (Model: gpt-4o-mini).";
    } catch (err) {
      results.openai.success = false;
      results.openai.message = `Thất bại: ${err.message}`;
    }
  } else {
    results.openai.message = "Không có khoá nào được nhập.";
  }

  if (alibabaKey && alibabaKey.trim() !== "") {
    try {
      const qwen = new OpenAI({
        apiKey: alibabaKey,
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      });
      await qwen.chat.completions.create({
        model: "qwen-plus",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5
      }, { timeout: 10000 });
      results.alibaba.success = true;
      results.alibaba.message = "Kết nối thành công (Model: qwen-plus).";
    } catch (err) {
      results.alibaba.success = false;
      results.alibaba.message = `Thất bại: ${err.message}`;
    }
  } else {
    results.alibaba.message = "Không có khoá nào được nhập.";
  }

  if (leonardoKey && leonardoKey.trim() !== "") {
    try {
      await axios.get("https://cloud.leonardo.ai/api/rest/v1/platformModels", {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${leonardoKey}`
        },
        timeout: 10000
      });
      results.leonardo.success = true;
      results.leonardo.message = "Kết nối thành công (Leonardo.ai).";
    } catch (err) {
      results.leonardo.success = false;
      results.leonardo.message = `Thất bại: ${err.response?.data?.error || err.message}`;
    }
  } else {
    results.leonardo.message = "Không có khoá nào được nhập.";
  }

  res.json(results);
});

// Helper to log steps for a task
function logStep(taskId, message, type = "info") {
  if (!tasks[taskId]) return;
  const timestamp = new Date().toLocaleTimeString();
  tasks[taskId].steps.push({ timestamp, message, type });
  console.log(`[Task ${taskId}] [${type.toUpperCase()}] ${message}`);
}

// Save history helper
async function saveToHistory(postData) {
  try {
    if (mongoose.connection.readyState === 1) {
      const historyItem = new History(postData);
      await historyItem.save();
      console.log("Saved post to MongoDB History successfully!");
      return;
    }
    const historyPath = path.join(__dirname, "history.json");
    let history = [];
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
      } catch (e) {
        history = [];
      }
    }
    history.unshift(postData);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save history:", err);
  }
}

// Get history
app.get("/api/history", async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const history = await History.find({}).sort({ _id: -1 }).lean();
      return res.json(history);
    }
    const historyPath = path.join(__dirname, "history.json");
    if (fs.existsSync(historyPath)) {
      try {
        const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
        return res.json(history);
      } catch (e) {
        return res.json([]);
      }
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy lịch sử: " + err.message });
  }
});

// Helper to analyze product image using GPT-4o Vision (gpt-4o-mini)
async function analyzeProductImage(base64Image, openaiKey) {
  if (!openaiKey || !base64Image) return "";
  
  let dataUrl = base64Image;
  if (!dataUrl.startsWith("data:image/")) {
    dataUrl = `data:image/jpeg;base64,${base64Image}`;
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this product in detail, focusing on its visual characteristics (type of item, shape, colors, materials, labels/text visible, key features). Provide a concise but rich description in English (around 2-3 sentences) suitable for embedding into a DALL-E 3 image generation prompt."
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl
            }
          }
        ]
      }
    ]
  }, { timeout: 90000 });
  
  return response.choices[0].message.content.trim();
}

// Perform Bulk AI content generation & publishing workflow
async function runBulkPublishWorkflow(taskId, params) {
  const {
    topics: rawTopics,
    topic,
    keywords,
    tone,
    language,
    postStatus,
    researchModel = "qwen",
    writingModel = "qwen",
    imageModel = "unsplash",
    cooldown = 15, // seconds
    productImage,
    category,
    useMultiSiteVariation = false,
    includeImages = true
  } = params;

  // Use keys from request or saved config
  const openaiKey = params.openaiKey || config.openaiKey;
  const alibabaKey = params.alibabaKey || config.alibabaKey;
  const leonardoKey = params.leonardoKey || config.leonardoKey;
  const customSystemPrompt = params.customSystemPrompt !== undefined ? params.customSystemPrompt : config.customSystemPrompt;
  
  // Resolve websites to write to
  let selectedWebsites = params.selectedWebsites || params.websites || [];
  if (selectedWebsites.length === 0) {
    if (params.wpUrl || config.wpUrl) {
      selectedWebsites = [{
        id: "site_default",
        name: "Website mặc định",
        url: params.wpUrl || config.wpUrl,
        user: params.wpUser || config.wpUser,
        password: params.wpAppPassword || config.wpAppPassword
      }];
    }
  }

  // Resolve topics
  let topics = [];
  if (rawTopics && Array.isArray(rawTopics)) {
    topics = rawTopics.filter(t => t.trim() !== "");
  } else if (typeof rawTopics === "string") {
    topics = rawTopics.split("\n").map(t => t.trim()).filter(t => t !== "");
  } else if (topic && topic.trim() !== "") {
    topics = [topic.trim()];
  }

  if (topics.length === 0) {
    logStep(taskId, "LỖI TRIỂN KHAI: Không tìm thấy chủ đề hợp lệ để xử lý.", "error");
    tasks[taskId].status = "failed";
    tasks[taskId].error = "Không có chủ đề nào được cung cấp.";
    return;
  }

  if (selectedWebsites.length === 0) {
    logStep(taskId, "LỖI TRIỂN KHAI: Chưa chọn website nào để đăng tải.", "error");
    tasks[taskId].status = "failed";
    tasks[taskId].error = "Chưa chọn website nào.";
    return;
  }

  logStep(taskId, `Bắt đầu xử lý hàng loạt: ${topics.length} chủ đề và đăng lên ${selectedWebsites.length} website.`, "info");

  let productDescription = "";
  if (productImage && productImage.trim() !== "") {
    try {
      logStep(taskId, "Đang sử dụng GPT-4o Vision để phân tích hình ảnh sản phẩm tải lên...", "info");
      productDescription = await analyzeProductImage(productImage, openaiKey);
      logStep(taskId, `Phân tích sản phẩm thành công! Đặc trưng sản phẩm: "${productDescription}"`, "success");
    } catch (visionErr) {
      logStep(taskId, `CẢNH BÁO: Phân tích ảnh sản phẩm thất bại (${visionErr.message}). Sẽ tiến hành tạo ảnh bối cảnh chung.`, "warning");
    }
  }

  const excludeUrls = []; // Track used backgrounds across the entire campaign to prevent repetition

  try {
    for (let tIdx = 0; tIdx < topics.length; tIdx++) {
      const currentTopic = topics[tIdx];
      const displayTopicNum = `[Chủ đề ${tIdx + 1}/${topics.length}]`;
      
      logStep(taskId, `--- Đang xử lý ${displayTopicNum}: "${currentTopic}" ---`, "info");

      let outline = "";
      let articleHtml = "";
      let title = currentTopic;
      let finalArticleHtml = "";
      let finalImages = [];
      let useAdvancedSeo = params.useAdvancedSeo !== undefined ? params.useAdvancedSeo : true;

      if (!useMultiSiteVariation) {
        // ----------------------------------------------------
        // STEP 1: Research and Outline
        // ----------------------------------------------------
        logStep(taskId, `${displayTopicNum} Đang nghiên cứu chủ đề và lập dàn bài...`, "info");
        
        let researchCompleted = false;
        let outlinePrompt = `Bạn là một chuyên gia nghiên cứu từ khóa và lập dàn bài SEO chuyên nghiệp. 
Hãy nghiên cứu chủ đề: "${currentTopic}".
Từ khóa chính và phụ cần đưa vào: "${keywords || "tự động lựa chọn liên quan đến " + currentTopic}".
Tông giọng viết: ${tone || "Chuyên nghiệp"}.
Ngôn ngữ: ${language || "Tiếng Việt"}.

Nhiệm vụ của bạn:
1. Tìm hiểu các ý chính quan trọng nhất cần viết cho chủ đề này.
2. Tạo ra một dàn bài viết chi tiết (Outline) có cấu trúc phân cấp Heading rõ ràng (H1, H2, H3).
3. Đưa ra danh sách từ khóa tối ưu hóa SEO.

Hãy trả về kết quả dưới dạng văn bản cấu trúc rõ ràng.`;

      if (customSystemPrompt && customSystemPrompt.trim() !== "") {
        outlinePrompt += `\n\n--- YÊU CẦU ĐẶC BIỆT CỦA NGƯỜI DÙNG ---\nBạn phải tuân thủ yêu cầu sau trong quá trình lập dàn bài:\n${customSystemPrompt}`;
      }

      // Try Qwen for Outline
      if (researchModel === "qwen" && alibabaKey && alibabaKey.trim() !== "") {
        try {
          logStep(taskId, `${displayTopicNum} Đang lập dàn ý nghiên cứu bằng Alibaba Qwen (qwen-plus)...`, "info");
          const qwen = new OpenAI({
            apiKey: alibabaKey,
            baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
          });
          const completion = await qwen.chat.completions.create({
            model: "qwen-plus",
            messages: [
              { role: "system", content: "You are an SEO research expert." },
              { role: "user", content: outlinePrompt }
            ]
          }, { timeout: 90000 });
          outline = completion.choices[0].message.content;
          researchCompleted = true;
          logStep(taskId, `${displayTopicNum} Hoàn thành nghiên cứu bằng Qwen.`, "success");
        } catch (err) {
          logStep(taskId, `${displayTopicNum} Lỗi khi dùng Qwen nghiên cứu: ${err.message}. Thử chuyển sang model dự phòng...`, "warning");
        }
      }

      // Try OpenAI if Qwen failed or OpenAI selected
      if (!researchCompleted && openaiKey && openaiKey.trim() !== "") {
        try {
          logStep(taskId, `${displayTopicNum} Đang lập dàn ý nghiên cứu bằng OpenAI ChatGPT (gpt-4o-mini)...`, "info");
          const openai = new OpenAI({ apiKey: openaiKey });
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are an SEO research expert." },
              { role: "user", content: outlinePrompt }
            ]
          }, { timeout: 90000 });
          outline = completion.choices[0].message.content;
          researchCompleted = true;
          logStep(taskId, `${displayTopicNum} Hoàn thành nghiên cứu bằng OpenAI (ChatGPT).`, "success");
        } catch (err) {
          logStep(taskId, `${displayTopicNum} Lỗi khi dùng OpenAI nghiên cứu: ${err.message}.`, "warning");
        }
      }

      // Fallback: If OpenAI failed but Qwen key is available
      if (!researchCompleted && alibabaKey && alibabaKey.trim() !== "") {
        try {
          logStep(taskId, `${displayTopicNum} Thử lại lập dàn ý bằng Alibaba Qwen dự phòng...`, "info");
          const qwen = new OpenAI({
            apiKey: alibabaKey,
            baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
          });
          const completion = await qwen.chat.completions.create({
            model: "qwen-plus",
            messages: [
              { role: "system", content: "You are an SEO research expert." },
              { role: "user", content: outlinePrompt }
            ]
          }, { timeout: 90000 });
          outline = completion.choices[0].message.content;
          researchCompleted = true;
          logStep(taskId, `${displayTopicNum} Hoàn thành nghiên cứu bằng Qwen dự phòng.`, "success");
        } catch (err) {
          logStep(taskId, `${displayTopicNum} Cả OpenAI và Qwen đều lỗi lập dàn ý: ${err.message}`, "error");
        }
      }

      if (!researchCompleted) {
        throw new Error(`Không thể lập dàn ý nghiên cứu cho chủ đề "${currentTopic}". Vui lòng kiểm tra lại cấu hình API Keys.`);
      }

      // ----------------------------------------------------
      // STEP 2: Generate Content
      // ----------------------------------------------------
      let articleHtml = "";
      let title = currentTopic;
      let articleGenerated = false;

      let writePrompt = `Dưới đây là dàn ý bài viết và các yêu cầu SEO:
${outline}

Hãy viết một bài viết hoàn chỉnh, chuyên sâu, cuốn hút và chuẩn SEO dựa trên dàn ý này.
Yêu cầu cụ thể:
1. Viết bằng ngôn ngữ: ${language || "Tiếng Việt"}.
2. Tông giọng: ${tone || "Chuyên nghiệp"}.
3. Bài viết phải dài ít nhất 1000 - 1500 từ, chi tiết, không sáo rỗng.
4. Trả về bài viết dưới định dạng HTML (CHỈ TRẢ VỀ mã HTML bên trong thẻ body, không cần các thẻ <html>, <head>, <body>). Hãy sử dụng các thẻ <h2>, <h3>, <p>, <strong>, <ul>, <li> để cấu trúc bài viết thật đẹp mắt. Không sử dụng định dạng markdown trong câu trả lời, chỉ dùng thẻ HTML chuẩn.
5. Viết tiêu đề bài viết trong thẻ <h1> ở dòng đầu tiên.
6. HÃY CHÈN TỪ 2 ĐẾN 3 THẺ <img> ở các vị trí thích hợp giữa các đoạn văn để minh họa trực quan.
Sử dụng các URL ảnh nha khoa chất lượng cao từ Unsplash làm thuộc tính 'src' của thẻ <img>. 
Ví dụ chèn:
<img src="https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=800" alt="Minh họa Implant nha khoa" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" />
Hoặc:
<img src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800" alt="Quy trình cấy ghép Implant" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" />
Hãy chọn các từ khóa tìm kiếm ảnh phù hợp như 'dentist', 'dental', 'teeth', 'implant', 'clinic' để chèn các link ảnh thực tế từ Unsplash.`;

      if (customSystemPrompt && customSystemPrompt.trim() !== "") {
        writePrompt += `\n\n--- YÊU CẦU ĐẶC BIỆT CỦA NGƯỜI DÙNG ---\nBạn phải tuân thủ nghiêm ngặt yêu cầu sau đây của người dùng khi viết bài viết:\n${customSystemPrompt}`;
      }

      let systemMessage = "You are an expert copywriter who writes SEO optimized blog posts in clean HTML format.";
      if (customSystemPrompt && customSystemPrompt.trim() !== "") {
        systemMessage += `\n\nAdditional instructions that you MUST follow:\n${customSystemPrompt}`;
      }

      // Try Qwen
      if (writingModel === "qwen" && alibabaKey && alibabaKey.trim() !== "") {
        try {
          logStep(taskId, `${displayTopicNum} Đang viết bài viết chi tiết bằng Alibaba Qwen (qwen-plus)...`, "info");
          const qwen = new OpenAI({
            apiKey: alibabaKey,
            baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
          });
          const contentCompletion = await qwen.chat.completions.create({
            model: "qwen-plus",
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: writePrompt }
            ]
          }, { timeout: 120000 });

          const rawHtml = contentCompletion.choices[0].message.content;
          const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          if (h1Match) {
            title = h1Match[1].trim();
            articleHtml = rawHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "");
          } else {
            articleHtml = rawHtml;
          }
          articleGenerated = true;
          logStep(taskId, `${displayTopicNum} Viết bài hoàn tất bằng Qwen. Tiêu đề: "${title}"`, "success");
        } catch (err) {
          logStep(taskId, `${displayTopicNum} Lỗi khi dùng Qwen viết bài: ${err.message}. Thử chuyển sang dự phòng...`, "warning");
        }
      }

      // Try OpenAI if writingModel is openai or if Qwen failed
      if (!articleGenerated && openaiKey && openaiKey.trim() !== "") {
        try {
          logStep(taskId, `${displayTopicNum} Đang viết bài viết chi tiết bằng OpenAI ChatGPT (gpt-4o)...`, "info");
          const openai = new OpenAI({ apiKey: openaiKey });
          const contentCompletion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: writePrompt }
            ],
            temperature: 0.7
          }, { timeout: 120000 });

          const rawHtml = contentCompletion.choices[0].message.content;
          const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          if (h1Match) {
            title = h1Match[1].trim();
            articleHtml = rawHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "");
          } else {
            articleHtml = rawHtml;
          }
          articleGenerated = true;
          logStep(taskId, `${displayTopicNum} Viết bài hoàn tất bằng OpenAI. Tiêu đề: "${title}"`, "success");
        } catch (err) {
          logStep(taskId, `${displayTopicNum} Lỗi khi dùng OpenAI viết bài: ${err.message}.`, "warning");
        }
      }

      // Fallback to Qwen if OpenAI failed
      if (!articleGenerated && alibabaKey && alibabaKey.trim() !== "") {
        try {
          logStep(taskId, `${displayTopicNum} Thử viết bài bằng Alibaba Qwen dự phòng...`, "info");
          const qwen = new OpenAI({
            apiKey: alibabaKey,
            baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
          });
          const contentCompletion = await qwen.chat.completions.create({
            model: "qwen-plus",
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: writePrompt }
            ]
          }, { timeout: 120000 });
          const rawHtml = contentCompletion.choices[0].message.content;
          const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          if (h1Match) {
            title = h1Match[1].trim();
            articleHtml = rawHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "");
          } else {
            articleHtml = rawHtml;
          }
          articleGenerated = true;
          logStep(taskId, `${displayTopicNum} Viết bài hoàn tất bằng Qwen dự phòng. Tiêu đề: "${title}"`, "success");
        } catch (err) {
          logStep(taskId, `${displayTopicNum} Lỗi khi dùng Qwen dự phòng viết bài: ${err.message}.`, "warning");
        }
      }

      if (!articleGenerated) {
        throw new Error(`Không thể viết bài viết cho chủ đề "${currentTopic}". Vui lòng kiểm tra lại cấu hình API Keys.`);
      }

      // ----------------------------------------------------
      // STEP 3: Handle Images & Backlinks
      // ----------------------------------------------------
      let useAdvancedSeo = params.useAdvancedSeo !== undefined ? params.useAdvancedSeo : true;
      let finalArticleHtml = articleHtml;
      let finalImages = [];

      if (useAdvancedSeo) {
        logStep(taskId, `${displayTopicNum} Khởi chạy tối ưu hóa SEO & thương hiệu nâng cao...`, "info");
        try {
          const globalBacklinks = params.backlinks || config.backlinks || [];
          const globalLogo1 = params.logo1 || config.logo1 || "";
          const globalLogo2 = params.logo2 || config.logo2 || "";
          const globalLogoPosition = params.logoPosition || config.logoPosition || "top-left";
          const globalLogoScale = params.logoScale || config.logoScale || 15;
          const globalLogo1Position = params.logo1Position || config.logo1Position || config.logoPosition || "top-left";
          const globalLogo1Scale = params.logo1Scale !== undefined ? params.logo1Scale : (config.logo1Scale !== undefined ? config.logo1Scale : (config.logoScale !== undefined ? config.logoScale : 12));
          const globalLogo2Position = params.logo2Position || config.logo2Position || config.logoPosition || "top-right";
          const globalLogo2Scale = params.logo2Scale !== undefined ? params.logo2Scale : (config.logo2Scale !== undefined ? config.logo2Scale : (config.logoScale !== undefined ? config.logoScale : 15));
          const globalImageSize = params.imageSize || config.imageSize || "1200x800";
          const globalHasLogos = params.hasLogos !== undefined ? params.hasLogos : (config.hasLogos !== undefined ? config.hasLogos : true);

          // 1. Run AI SEO Engine to insert placeholders & backlinks
          const seoResult = await optimizeArticleWithAI({
            title: title,
            content: articleHtml,
            keywords: keywords,
            category: category || "Tin tức",
            backlinks: globalBacklinks,
            numImages: "auto",
            openaiKey,
            alibabaKey,
            model: writingModel,
            includeImages
          });

          logStep(taskId, `${displayTopicNum} Tối ưu nội dung AI hoàn tất. Từ khóa & Link đã chèn.`, "success");
          finalArticleHtml = seoResult.optimizedHtml;
          if (seoResult.warnings && seoResult.warnings.length > 0) {
            seoResult.warnings.forEach(w => logStep(taskId, `CẢNH BÁO SEO: ${w}`, "warning"));
          }

          // Parse target size
          let width = 1200;
          let height = 800;
          if (globalImageSize && globalImageSize.includes("x")) {
            const parts = globalImageSize.split("x");
            width = parseInt(parts[0]) || 1200;
            height = parseInt(parts[1]) || 800;
          }

          // 2. Composite WebP images
          for (let i = 0; i < seoResult.images.length; i++) {
            const imgData = seoResult.images[i];
            logStep(taskId, `${displayTopicNum} Đang thiết kế ảnh ${i + 1}/${seoResult.images.length}: "${imgData.filename}"...`, "info");

            const baseName = imgData.filename.replace(/\.[^/.]+$/, "");
            const seoName = `${slugify(baseName)}-${Date.now()}.webp`;

            try {
              const relativeUrl = await generateAndCompositeImage({
                openaiKey,
                leonardoKey,
                imageModel,
                prompt: imgData.dallePrompt,
                productImage,
                logo1: globalLogo1,
                logo2: globalLogo2,
                width,
                height,
                logoPosition: globalLogoPosition,
                logoScale: globalLogoScale,
                logo1Position: globalLogo1Position,
                logo1Scale: globalLogo1Scale,
                logo2Position: globalLogo2Position,
                logo2Scale: globalLogo2Scale,
                hasLogos: globalHasLogos,
                filename: seoName,
                excludeUrls
              });

              const serverHost = "localhost:5000"; 
              const fullUrl = `http://${serverHost}${relativeUrl}`;

              const imgTagPattern = new RegExp(`<img[^>]*class=["']seo-ill["'][^>]*data-idx=["']${imgData.idx}["'][^>]*src=["']["'][^>]*>`, 'i');
              const replacementTag = `<img src="${fullUrl}" alt="${imgData.altText || title}" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" class="seo-ill" />`;
              
              if (finalArticleHtml.match(imgTagPattern)) {
                finalArticleHtml = finalArticleHtml.replace(imgTagPattern, replacementTag);
              } else {
                const genericPattern = new RegExp(`<img[^>]*data-idx=["']${imgData.idx}["'][^>]*src=["']["'][^>]*>`, 'i');
                finalArticleHtml = finalArticleHtml.replace(genericPattern, `<img src="${fullUrl}" alt="${imgData.altText || title}" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" class="seo-ill" />`);
              }

              finalImages.push({
                ...imgData,
                filename: seoName,
                url: fullUrl
              });
              logStep(taskId, `${displayTopicNum} Đã thiết kế xong ảnh ${i + 1}.`, "success");
            } catch (imgComposeErr) {
              logStep(taskId, `CẢNH BÁO: Không thể thiết kế ảnh ${imgData.filename} (${imgComposeErr.message}). Sẽ dùng ảnh nha khoa Unsplash dự phòng.`, "warning");
              const fallbackUrl = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800";
              const fallbackTag = `<img src="${fallbackUrl}" alt="Dental Image" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" />`;
              
              const imgTagPattern = new RegExp(`<img[^>]*data-idx=["']${imgData.idx}["'][^>]*>`, 'i');
              finalArticleHtml = finalArticleHtml.replace(imgTagPattern, fallbackTag);

              finalImages.push({
                ...imgData,
                url: fallbackUrl,
                error: imgComposeErr.message
              });
            }
          }

        } catch (seoErr) {
          logStep(taskId, `CẢNH BÁO: Tối ưu hóa SEO thương hiệu lỗi (${seoErr.message}). Chuyển sang đăng bài viết thô gốc.`, "warning");
          useAdvancedSeo = false;
        }
      }

      } // Ends if (!useMultiSiteVariation)

      // ----------------------------------------------------
      // STEP 4: Loop Through Selected Websites to Upload & Publish
      // ----------------------------------------------------
      for (let sIdx = 0; sIdx < selectedWebsites.length; sIdx++) {
        const site = selectedWebsites[sIdx];
        const progressKey = `${tIdx}_${site.id}`;
        
        if (tasks[taskId] && tasks[taskId].progress[progressKey]) {
          tasks[taskId].progress[progressKey].status = "running";
        }
        
        const siteLabel = `[Chủ đề ${tIdx + 1} -> ${site.name}]`;
        logStep(taskId, `${siteLabel} Bắt đầu đăng tải lên website: ${site.url}...`, "info");

        try {
          let siteTopic = currentTopic;
          let siteTitle = title;
          let siteArticle = finalArticleHtml;
          let siteFinalImages = finalImages;

          if (useMultiSiteVariation) {
            logStep(taskId, `${siteLabel} Đang tự động tạo biến thể chủ đề & tiêu đề độc bản cho website...`, "info");
            
            let titlePrompt = `Hãy viết 1 tiêu đề bài viết độc đáo, khác biệt hoàn toàn và chuẩn SEO dựa trên chủ đề gốc: "${currentTopic}". Tiêu đề này dành riêng cho trang tin tức của website nha khoa: "${site.name}".
CHÚ Ý QUAN TRỌNG: Bạn chỉ được trả về DUY NHẤT tiêu đề bài viết thô (một dòng duy nhất), KHÔNG có phần giải thích, KHÔNG có dấu ngoặc kép bọc ngoài, KHÔNG có thêm lời nhắn hay bất cứ ký tự nào khác.`;
            let variantTitle = "";
            let systemMessageTitle = "Bạn là một chuyên gia viết tiêu đề chuẩn SEO trong lĩnh vực nha khoa (răng hàm mặt, cấy ghép implant). Mọi tiêu đề phải phản ánh đúng chủ môn nha khoa y tế. Tuyệt đối KHÔNG viết về chủ đề di trú, định cư, visa hay kiểm tra nhân thân, ngay cả khi tên website có chứa từ 'Di trú'.";

            const tryQwenTitle = async () => {
              if (!alibabaKey) throw new Error("Chưa cấu hình API Key Alibaba.");
              const qwen = new OpenAI({ apiKey: alibabaKey, baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" });
              const comp = await qwen.chat.completions.create({
                model: "qwen-plus",
                messages: [
                  { role: "system", content: systemMessageTitle },
                  { role: "user", content: titlePrompt }
                ]
              }, { timeout: 60000 });
              return comp.choices[0].message.content.trim();
            };

            const tryOpenAiTitle = async () => {
              if (!openaiKey) throw new Error("Chưa cấu hình API Key OpenAI.");
              const openai = new OpenAI({ apiKey: openaiKey });
              const comp = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: systemMessageTitle },
                  { role: "user", content: titlePrompt }
                ]
              }, { timeout: 60000 });
              return comp.choices[0].message.content.trim();
            };

            try {
              if (researchModel === "qwen") {
                try {
                  variantTitle = await tryQwenTitle();
                } catch (qwenErr) {
                  logStep(taskId, `${siteLabel} Lỗi tạo tiêu đề bằng Qwen: ${qwenErr.message}. Thử chuyển sang OpenAI...`, "warning");
                  variantTitle = await tryOpenAiTitle();
                }
              } else {
                try {
                  variantTitle = await tryOpenAiTitle();
                } catch (openaiErr) {
                  logStep(taskId, `${siteLabel} Lỗi tạo tiêu đề bằng OpenAI: ${openaiErr.message}. Thử chuyển sang Qwen...`, "warning");
                  variantTitle = await tryQwenTitle();
                }
              }
              
              if (variantTitle) {
                siteTopic = variantTitle.replace(/^"|"$/g, "").trim();
                logStep(taskId, `${siteLabel} Tiêu đề độc bản mới: "${siteTopic}"`, "success");
              }
            } catch (titleErr) {
              logStep(taskId, `${siteLabel} Cảnh báo: Lỗi tạo biến thể tiêu đề (${titleErr.message}). Sẽ dùng chủ đề gốc.`, "warning");
            }

            siteTitle = siteTopic;

            // Generate outline for siteTopic
            logStep(taskId, `${siteLabel} Đang nghiên cứu lập dàn bài độc bản...`, "info");
            let siteOutline = "";
            let outlinePrompt = `Bạn là một chuyên gia nghiên cứu từ khóa và lập dàn bài SEO chuyên nghiệp. 
Hãy nghiên cứu chủ đề: "${siteTopic}".
Từ khóa chính và phụ cần đưa vào: "${keywords || "tự động lựa chọn liên quan đến " + siteTopic}".
Tông giọng viết: ${tone || "Chuyên nghiệp"}.
Ngôn ngữ: ${language || "Tiếng Việt"}.

Nhiệm vụ của bạn:
1. Tìm hiểu các ý chính quan trọng nhất cần viết cho chủ đề này.
2. Tạo ra một dàn bài viết chi tiết (Outline) có cấu trúc Heading rõ ràng (H1, H2, H3).
3. Đưa ra danh sách từ khóa tối ưu hóa SEO.`;

            if (customSystemPrompt && customSystemPrompt.trim() !== "") {
              outlinePrompt += `\n\n--- YÊU CẦU ĐẶC BIỆT CỦA NGƯỜI DÙNG ---\nBạn phải tuân thủ yêu cầu sau trong quá trình lập dàn bài:\n${customSystemPrompt}`;
            }

            const tryQwenOutline = async () => {
              if (!alibabaKey) throw new Error("Chưa cấu hình API Key Alibaba.");
              const qwen = new OpenAI({ apiKey: alibabaKey, baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" });
              const comp = await qwen.chat.completions.create({
                model: "qwen-plus",
                messages: [{ role: "user", content: outlinePrompt }]
              }, { timeout: 90000 });
              return comp.choices[0].message.content;
            };

            const tryOpenAiOutline = async () => {
              if (!openaiKey) throw new Error("Chưa cấu hình API Key OpenAI.");
              const openai = new OpenAI({ apiKey: openaiKey });
              const comp = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: outlinePrompt }]
              }, { timeout: 90000 });
              return comp.choices[0].message.content;
            };

            try {
              if (researchModel === "qwen") {
                try {
                  siteOutline = await tryQwenOutline();
                } catch (qwenErr1) {
                  logStep(taskId, `${siteLabel} Thử dàn bài bằng Qwen thất bại: ${qwenErr1.message}. Thử chuyển sang OpenAI...`, "warning");
                  try {
                    siteOutline = await tryOpenAiOutline();
                  } catch (openaiErr) {
                    logStep(taskId, `${siteLabel} Thử dàn bài bằng OpenAI thất bại: ${openaiErr.message}. Thử lại bằng Qwen lần cuối...`, "warning");
                    siteOutline = await tryQwenOutline();
                  }
                }
              } else {
                try {
                  siteOutline = await tryOpenAiOutline();
                } catch (openaiErr1) {
                  logStep(taskId, `${siteLabel} Thử dàn bài bằng OpenAI thất bại: ${openaiErr1.message}. Thử chuyển sang Qwen...`, "warning");
                  try {
                    siteOutline = await tryQwenOutline();
                  } catch (qwenErr) {
                    logStep(taskId, `${siteLabel} Thử dàn bài bằng Qwen thất bại: ${qwenErr.message}. Thử lại bằng OpenAI lần cuối...`, "warning");
                    siteOutline = await tryOpenAiOutline();
                  }
                }
              }
              logStep(taskId, `${siteLabel} Đã hoàn thành dàn bài độc bản.`, "success");
            } catch (err) {
              logStep(taskId, `${siteLabel} Lỗi lập dàn bài độc bản sau nhiều lần thử: ${err.message}`, "error");
              throw err;
            }

            // Generate content for siteTopic
            logStep(taskId, `${siteLabel} Đang viết nội dung chi tiết độc bản chuẩn SEO...`, "info");
            let writePrompt = `Dưới đây là dàn ý bài viết và các yêu cầu SEO:
${siteOutline}

Hãy viết một bài viết hoàn chỉnh, chuyên sâu, cuốn hút và chuẩn SEO dựa trên dàn ý này.
Yêu cầu cụ thể:
1. Viết bằng ngôn ngữ: ${language || "Tiếng Việt"}.
2. Tông giọng: ${tone || "Chuyên nghiệp"}.
3. Bài viết phải dài ít nhất 1000 - 1500 từ, chi tiết, không sáo rỗng.
4. Trả về bài viết dưới định dạng HTML (CHỈ TRẢ VỀ mã HTML bên trong thẻ body, không cần các thẻ <html>, <head>, <body>). Hãy sử dụng các thẻ <h2>, <h3>, <p>, <strong>, <ul>, <li> để cấu trúc bài viết thật đẹp mắt.
5. Viết tiêu đề bài viết trong thẻ <h1> ở dòng đầu tiên.
6. HÃY CHÈN TỪ 2 ĐẾN 3 THẺ <img> ở các vị trí thích hợp giữa các đoạn văn để minh họa trực quan.
Sử dụng các URL ảnh nha khoa chất lượng cao từ Unsplash làm thuộc tính 'src' của thẻ <img>.`;

            if (customSystemPrompt && customSystemPrompt.trim() !== "") {
              writePrompt += `\n\n--- YÊU CẦU ĐẶC BIỆT CỦA NGƯỜI DÙNG ---\nBạn phải tuân thủ nghiêm ngặt yêu cầu sau đây của người dùng khi viết bài viết:\n${customSystemPrompt}`;
            }

            let systemMessage = "You are an expert copywriter who writes SEO optimized blog posts in clean HTML format.";
            if (customSystemPrompt && customSystemPrompt.trim() !== "") {
              systemMessage += `\n\nAdditional instructions that you MUST follow:\n${customSystemPrompt}`;
            }

            const tryQwenContent = async () => {
              if (!alibabaKey) throw new Error("Chưa cấu hình API Key Alibaba.");
              const qwen = new OpenAI({ apiKey: alibabaKey, baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" });
              const comp = await qwen.chat.completions.create({
                model: "qwen-plus",
                messages: [
                  { role: "system", content: systemMessage },
                  { role: "user", content: writePrompt }
                ]
              }, { timeout: 120000 });
              return comp.choices[0].message.content;
            };

            const tryOpenAiContent = async () => {
              if (!openaiKey) throw new Error("Chưa cấu hình API Key OpenAI.");
              const openai = new OpenAI({ apiKey: openaiKey });
              const comp = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { role: "system", content: systemMessage },
                  { role: "user", content: writePrompt }
                ]
              }, { timeout: 120000 });
              return comp.choices[0].message.content;
            };

            let rawHtml = "";
            try {
              if (writingModel === "qwen") {
                try {
                  rawHtml = await tryQwenContent();
                } catch (qwenErr1) {
                  logStep(taskId, `${siteLabel} Thử viết nội dung bằng Qwen thất bại: ${qwenErr1.message}. Thử chuyển sang OpenAI...`, "warning");
                  try {
                    rawHtml = await tryOpenAiContent();
                  } catch (openaiErr) {
                    logStep(taskId, `${siteLabel} Thử viết nội dung bằng OpenAI thất bại: ${openaiErr.message}. Thử lại bằng Qwen lần cuối...`, "warning");
                    rawHtml = await tryQwenContent();
                  }
                }
              } else {
                try {
                  rawHtml = await tryOpenAiContent();
                } catch (openaiErr1) {
                  logStep(taskId, `${siteLabel} Thử viết nội dung bằng OpenAI thất bại: ${openaiErr1.message}. Thử chuyển sang Qwen...`, "warning");
                  try {
                    rawHtml = await tryQwenContent();
                  } catch (qwenErr) {
                    logStep(taskId, `${siteLabel} Thử viết nội dung bằng Qwen thất bại: ${qwenErr.message}. Thử lại bằng OpenAI lần cuối...`, "warning");
                    rawHtml = await tryOpenAiContent();
                  }
                }
              }

              const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
              let siteRawContent = "";
              if (h1Match) {
                siteTitle = h1Match[1].trim();
                siteRawContent = rawHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "");
              } else {
                siteRawContent = rawHtml;
              }
              siteArticle = siteRawContent.replace(/^```html\s*/i, "").replace(/```\s*$/, "");
              logStep(taskId, `${siteLabel} Đã viết xong nội dung độc bản. Tiêu đề: "${siteTitle}"`, "success");
            } catch (err) {
              logStep(taskId, `${siteLabel} Lỗi viết nội dung độc bản sau nhiều lần thử: ${err.message}`, "error");
              throw err;
            }

            // Optimize SEO & Images
            if (useAdvancedSeo) {
              logStep(taskId, `${siteLabel} Đang tối ưu hóa SEO và thiết kế ảnh thương hiệu riêng biệt...`, "info");
              try {
                const globalBacklinks = params.backlinks || config.backlinks || [];
                const globalLogo1 = params.logo1 || config.logo1 || "";
                const globalLogo2 = params.logo2 || config.logo2 || "";
                const globalLogoPosition = params.logoPosition || config.logoPosition || "top-left";
                const globalLogoScale = params.logoScale || config.logoScale || 15;
                const globalLogo1Position = params.logo1Position || config.logo1Position || config.logoPosition || "top-left";
                const globalLogo1Scale = params.logo1Scale !== undefined ? params.logo1Scale : (config.logo1Scale !== undefined ? config.logo1Scale : (config.logoScale !== undefined ? config.logoScale : 12));
                const globalLogo2Position = params.logo2Position || config.logo2Position || config.logoPosition || "top-right";
                const globalLogo2Scale = params.logo2Scale !== undefined ? params.logo2Scale : (config.logo2Scale !== undefined ? config.logo2Scale : (config.logoScale !== undefined ? config.logoScale : 15));
                const globalImageSize = params.imageSize || config.imageSize || "1200x800";
                const globalHasLogos = params.hasLogos !== undefined ? params.hasLogos : (config.hasLogos !== undefined ? config.hasLogos : true);

                const seoResult = await optimizeArticleWithAI({
                  title: siteTitle,
                  content: siteArticle,
                  keywords: keywords,
                  category: category || "Tin tức",
                  backlinks: globalBacklinks,
                  numImages: "auto",
                  openaiKey,
                  alibabaKey,
                  model: writingModel,
                  includeImages
                });

                siteArticle = seoResult.optimizedHtml;
                if (seoResult.warnings && seoResult.warnings.length > 0) {
                  seoResult.warnings.forEach(w => logStep(taskId, `${siteLabel} CẢNH BÁO SEO: ${w}`, "warning"));
                }

                let width = 1200, height = 800;
                if (globalImageSize && globalImageSize.includes("x")) {
                  const parts = globalImageSize.split("x");
                  width = parseInt(parts[0]) || 1200;
                  height = parseInt(parts[1]) || 800;
                }

                siteFinalImages = []; // Clear and rebuild images uniquely for this website!
                for (let i = 0; i < seoResult.images.length; i++) {
                  const imgData = seoResult.images[i];
                  logStep(taskId, `${siteLabel} Đang thiết kế ảnh ${i + 1}/${seoResult.images.length}...`, "info");
                  const baseName = imgData.filename.replace(/\.[^/.]+$/, "");
                  const seoName = `${slugify(baseName)}-${Date.now()}.webp`;

                  try {
                    const relativeUrl = await generateAndCompositeImage({
                      openaiKey,
                      leonardoKey,
                      imageModel,
                      prompt: imgData.dallePrompt,
                      productImage,
                      logo1: globalLogo1,
                      logo2: globalLogo2,
                      width,
                      height,
                      logoPosition: globalLogoPosition,
                      logoScale: globalLogoScale,
                      logo1Position: globalLogo1Position,
                      logo1Scale: globalLogo1Scale,
                      logo2Position: globalLogo2Position,
                      logo2Scale: globalLogo2Scale,
                      hasLogos: globalHasLogos,
                      filename: seoName,
                      excludeUrls
                    });

                    const serverHost = "localhost:5000"; 
                    const fullUrl = `http://${serverHost}${relativeUrl}`;

                    const imgTagPattern = new RegExp(`<img[^>]*class=["']seo-ill["'][^>]*data-idx=["']${imgData.idx}["'][^>]*src=["']["'][^>]*>`, 'i');
                    const replacementTag = `<img src="${fullUrl}" alt="${imgData.altText || siteTitle}" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" class="seo-ill" />`;
                    
                    if (siteArticle.match(imgTagPattern)) {
                      siteArticle = siteArticle.replace(imgTagPattern, replacementTag);
                    } else {
                      const genericPattern = new RegExp(`<img[^>]*data-idx=["']${imgData.idx}["'][^>]*src=["']["'][^>]*>`, 'i');
                      siteArticle = siteArticle.replace(genericPattern, `<img src="${fullUrl}" alt="${imgData.altText || siteTitle}" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" class="seo-ill" />`);
                    }

                    siteFinalImages.push({ ...imgData, filename: seoName, url: fullUrl });
                    logStep(taskId, `${siteLabel} Đã thiết kế xong ảnh ${i + 1}.`, "success");
                  } catch (imgComposeErr) {
                    logStep(taskId, `${siteLabel} Cảnh báo thiết kế ảnh thất bại: ${imgComposeErr.message}. Dùng ảnh dự phòng.`, "warning");
                    const fallbackUrl = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800";
                    const fallbackTag = `<img src="${fallbackUrl}" alt="Dental" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" />`;
                    const imgTagPattern = new RegExp(`<img[^>]*data-idx=["']${imgData.idx}["'][^>]*>`, 'i');
                    siteArticle = siteArticle.replace(imgTagPattern, fallbackTag);
                    siteFinalImages.push({ ...imgData, url: fallbackUrl, error: imgComposeErr.message });
                  }
                }
              } catch (seoErr) {
                logStep(taskId, `${siteLabel} Cảnh báo tối ưu hóa SEO thất bại (${seoErr.message}).`, "warning");
              }
            }
          }

          const cleanWpUrl = site.url.replace(/\/$/, "");
          const authHeader = `Basic ${Buffer.from(`${site.user}:${site.password}`).toString("base64")}`;

          let featuredMediaId = null;
          let siteUploadedImgUrl = "";
          let siteArticleHtml = siteArticle;

          if (useAdvancedSeo) {
            const heroImg = siteFinalImages.find(img => img.type === "hero" || img.idx === 0);
            if (heroImg && heroImg.filename) {
              const localPath = path.join(__dirname, "uploads", heroImg.filename);
              if (fs.existsSync(localPath)) {
                try {
                  logStep(taskId, `${siteLabel} Đang upload ảnh đại diện đã thiết kế lên website...`, "info");
                  const imgBuffer = fs.readFileSync(localPath);
                  const uploadResponse = await axios.post(
                    `${cleanWpUrl}/wp-json/wp/v2/media`,
                    imgBuffer,
                    {
                      headers: {
                        "Content-Type": "image/jpeg",
                        "Content-Disposition": `attachment; filename="${heroImg.filename}"`,
                        Authorization: authHeader
                      }
                    }
                  );
                  featuredMediaId = uploadResponse.data.id;
                  siteUploadedImgUrl = uploadResponse.data.source_url;
                  logStep(taskId, `${siteLabel} Đã upload ảnh đại diện lên web thành công. ID: ${featuredMediaId}`, "success");
                } catch (upErr) {
                  logStep(taskId, `${siteLabel} Cảnh báo: Lỗi upload ảnh đại diện lên web (${upErr.message}).`, "warning");
                }
              }
            }

            for (let img of siteFinalImages) {
              const localPath = path.join(__dirname, "uploads", img.filename);
              if (fs.existsSync(localPath)) {
                try {
                  logStep(taskId, `${siteLabel} Đang upload và thay thế ảnh minh họa ${img.filename} vào bài viết...`, "info");
                  const imgBuffer = fs.readFileSync(localPath);
                  const uploadResponse = await axios.post(
                    `${cleanWpUrl}/wp-json/wp/v2/media`,
                    imgBuffer,
                    {
                      headers: {
                        "Content-Type": "image/jpeg",
                        "Content-Disposition": `attachment; filename="${img.filename}"`,
                        Authorization: authHeader
                      }
                    }
                  );
                  const wpImgUrl = uploadResponse.data.source_url;
                  const localUrlPattern = new RegExp(`https?:\\/\\/[^/]+\\/uploads\\/${img.filename.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'gi');
                  siteArticleHtml = siteArticleHtml.replace(localUrlPattern, wpImgUrl);
                } catch (upInlineErr) {
                  logStep(taskId, `${siteLabel} Cảnh báo: Không thể upload ảnh minh họa ${img.filename} (${upInlineErr.message}). Giữ nguyên link ngoài.`, "warning");
                }
              }
            }

          } else {
            let imgBuffer = null;
            try {
              // Directly select a curated background based on topic (OpenAI DALL-E discarded)
              const fallbackUrl = getCuratedBackground(title || currentTopic, excludeUrls);
              logStep(taskId, `${displayTopicNum} Đang tải ảnh nha khoa từ bộ sưu tập Unsplash: ${fallbackUrl}...`, "info");
              const imgResponse = await axios.get(fallbackUrl, { responseType: "arraybuffer" });
              imgBuffer = Buffer.from(imgResponse.data);
              logStep(taskId, `${displayTopicNum} Ảnh đại diện Unsplash đã sẵn sàng.`, "success");
            } catch (fallbackErr) {
              logStep(taskId, `${displayTopicNum} Cảnh báo: Không thể chuẩn bị ảnh đại diện dự phòng (${fallbackErr.message}).`, "warning");
            }

            if (imgBuffer) {
              try {
                logStep(taskId, `${siteLabel} Đang upload ảnh đại diện lên website...`, "info");
                const filename = `ai-post-featured-${Date.now()}.jpg`;
                const uploadResponse = await axios.post(
                  `${cleanWpUrl}/wp-json/wp/v2/media`,
                  imgBuffer,
                  {
                    headers: {
                      "Content-Type": "image/jpeg",
                      "Content-Disposition": `attachment; filename="${filename}"`,
                      Authorization: authHeader
                    }
                  }
                );
                featuredMediaId = uploadResponse.data.id;
                siteUploadedImgUrl = uploadResponse.data.source_url;
                logStep(taskId, `${siteLabel} Đã tải ảnh đại diện lên web thành công. ID: ${featuredMediaId}`, "success");
              } catch (upErr) {
                logStep(taskId, `${siteLabel} Cảnh báo: Lỗi upload ảnh đại diện lên web (${upErr.message}).`, "warning");
              }
            }
          }

          // 4.3 Find or Create "Tin tức" category
          let siteCategoryId = null;
          try {
            logStep(taskId, `${siteLabel} Đang quét danh sách chuyên mục...`, "info");
            const categoriesResponse = await axios.get(
              `${cleanWpUrl}/wp-json/wp/v2/categories?per_page=100`,
              { headers: { Authorization: authHeader } }
            );

            const categories = categoriesResponse.data;
            const targetCategory = categories.find(cat => 
              cat.name.toLowerCase().includes("tin tức") || 
              cat.slug.toLowerCase() === "tin-tuc" ||
              cat.name.toLowerCase().includes("news")
            );

            if (targetCategory) {
              siteCategoryId = targetCategory.id;
              logStep(taskId, `${siteLabel} Đã tìm thấy chuyên mục "${targetCategory.name}" (ID: ${siteCategoryId})`, "success");
            } else {
              logStep(taskId, `${siteLabel} Không tìm thấy chuyên mục "Tin tức". Tiến hành tạo mới...`, "info");
              const createCatResponse = await axios.post(
                `${cleanWpUrl}/wp-json/wp/v2/categories`,
                { name: "Tin tức", slug: "tin-tuc" },
                { headers: { Authorization: authHeader } }
              );
              siteCategoryId = createCatResponse.data.id;
              logStep(taskId, `${siteLabel} Đã tạo thành công chuyên mục "Tin tức" (ID: ${siteCategoryId})`, "success");
            }
          } catch (catErr) {
            logStep(taskId, `${siteLabel} Cảnh báo: Không lấy được chuyên mục "Tin tức" (${catErr.message}). Sẽ sử dụng chuyên mục mặc định.`, "warning");
          }

          // 4.4 Publish Post
          logStep(taskId, `${siteLabel} Đang đăng bài viết dưới dạng "${postStatus || "draft"}"...`, "info");
          const postBody = {
            title: siteTitle,
            content: siteArticleHtml,
            status: postStatus || "draft"
          };

          if (featuredMediaId) {
            postBody.featured_media = featuredMediaId;
          }
          if (siteCategoryId) {
            postBody.categories = [siteCategoryId];
          }

          const postResponse = await axios.post(
            `${cleanWpUrl}/wp-json/wp/v2/posts`,
            postBody,
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader
              }
            }
          );

          const postLink = postResponse.data.link;
          logStep(taskId, `${siteLabel} ĐĂNG BÀI THÀNH CÔNG! Link bài: ${postLink}`, "success");

          if (tasks[taskId] && tasks[taskId].progress[progressKey]) {
            tasks[taskId].progress[progressKey] = {
              status: "completed",
              result: {
                title: siteTitle,
                link: postLink,
                imageUrl: siteUploadedImgUrl || "https://placehold.co/100x100?text=No+Image",
                wpPostId: postResponse.data.id
              },
              error: null
            };
          }

          await saveToHistory({
            taskId: taskId + "_" + site.id,
            title: siteTitle,
            link: postLink,
            imageUrl: siteUploadedImgUrl,
            topic: currentTopic,
            websiteName: site.name,
            websiteUrl: site.url,
            timestamp: new Date().toLocaleString()
          });

        } catch (siteErr) {
          let errMsg = siteErr.message;
          if (siteErr.response && siteErr.response.data) {
            errMsg += ` - ${JSON.stringify(siteErr.response.data)}`;
          }
          logStep(taskId, `${siteLabel} Đăng tải thất bại: ${errMsg}`, "error");
          if (tasks[taskId] && tasks[taskId].progress[progressKey]) {
            tasks[taskId].progress[progressKey] = {
              status: "failed",
              result: null,
              error: errMsg
            };
          }
        }
      }

      // Cooldown between topics
      if (tIdx < topics.length - 1 && cooldown > 0) {
        logStep(taskId, `Chờ giãn cách ${cooldown} giây trước khi viết bài tiếp theo để tránh quá tải...`, "info");
        await new Promise(resolve => setTimeout(resolve, cooldown * 1000));
      }
    }

    logStep(taskId, "=== HOÀN TẤT TOÀN BỘ TIẾN TRÌNH ĐĂNG BÀI HÀNG LOẠT! ===", "success");
    if (tasks[taskId]) {
      tasks[taskId].status = "completed";
      
      const allResults = Object.values(tasks[taskId].progress)
        .filter(p => p.status === "completed")
        .map(p => p.result);

      tasks[taskId].result = {
        message: `Đã hoàn thành toàn bộ tác vụ. Thành công ${allResults.length} bài đăng.`,
        allResults
      };
    }

  } catch (error) {
    logStep(taskId, `LỖI TỔNG QUAN CHẠY BATCH: ${error.message}`, "error");
    if (tasks[taskId]) {
      tasks[taskId].status = "failed";
      tasks[taskId].error = error.message;
    }
  }
}

// Trigger publishing
app.post("/api/publish", (req, res) => {
  const taskId = `task_${Date.now()}`;
  const params = req.body;
  
  // Resolve topics to initialize task correctly
  let topics = [];
  if (params.topics && Array.isArray(params.topics)) {
    topics = params.topics.filter(t => t.trim() !== "");
  } else if (typeof params.topics === "string") {
    topics = params.topics.split("\n").map(t => t.trim()).filter(t => t !== "");
  } else if (params.topic && params.topic.trim() !== "") {
    topics = [params.topic.trim()];
  }
  
  let selectedWebsites = params.selectedWebsites || params.websites || [];
  if (selectedWebsites.length === 0) {
    if (params.wpUrl || config.wpUrl) {
      selectedWebsites = [{
        id: "site_default",
        name: "Website mặc định",
        url: params.wpUrl || config.wpUrl,
        user: params.wpUser || config.wpUser,
        password: params.wpAppPassword || config.wpAppPassword
      }];
    }
  }

  tasks[taskId] = {
    status: "running",
    steps: [],
    topics: topics,
    websites: selectedWebsites.map(w => ({ id: w.id, name: w.name, url: w.url })),
    progress: {},
    result: null,
    error: null
  };

  // Initialize progress state
  topics.forEach((topic, tIdx) => {
    selectedWebsites.forEach(site => {
      tasks[taskId].progress[`${tIdx}_${site.id}`] = {
        status: "pending",
        result: null,
        error: null
      };
    });
  });

  // Start workflow asynchronously
  runBulkPublishWorkflow(taskId, params);

  res.json({ taskId });
});

// Check status of a task
app.get("/api/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const task = tasks[taskId];
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.json(task);
});

// Test connection endpoint
app.post("/api/test-connection", async (req, res) => {
  const { wpUrl, wpUser, wpAppPassword, url, user, password } = req.body;
  
  const targetUrl = url || wpUrl;
  const targetUser = user || wpUser;
  const targetPassword = password || wpAppPassword;

  if (!targetUrl || !targetUser || !targetPassword) {
    return res.status(400).json({ error: "Thiếu thông tin kết nối WordPress." });
  }

  try {
    const cleanUrl = targetUrl.replace(/\/$/, "");
    const authHeader = `Basic ${Buffer.from(`${targetUser}:${targetPassword}`).toString("base64")}`;
    
    // Call user endpoint to test credentials
    const response = await axios.get(`${cleanUrl}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: authHeader }
    });
    
    res.json({ success: true, message: `Kết nối thành công! Đăng nhập dưới tên: ${response.data.name}` });
  } catch (error) {
    let msg = error.message;
    if (error.response && error.response.data) {
      msg = `${error.response.data.message || error.message} (Mã lỗi: ${error.response.data.code || "unknown"})`;
    }
    res.status(400).json({ error: `Kết nối WordPress thất bại: ${msg}` });
  }
});

// Route: Generate a fresh SEO dental article using AI
app.post("/api/generate-seo-article", async (req, res) => {
  const { title, keywords, category, model = "qwen" } = req.body;
  const openaiKey = req.body.openaiKey || config.openaiKey;
  const alibabaKey = req.body.alibabaKey || config.alibabaKey;
  const customSystemPrompt = config.customSystemPrompt;

  let systemMessage = "Bạn là một chuyên gia viết bài blog chuẩn SEO chuyên nghiệp trong lĩnh vực nha khoa.";
  if (customSystemPrompt) {
    systemMessage += `\n\nChỉ thị viết bài bắt buộc phải tuân theo:\n${customSystemPrompt}`;
  }

  const prompt = `Hãy viết một bài viết chuẩn SEO chuyên sâu và cuốn hút về chủ đề: "${title}".
Từ khóa cần chèn tự nhiên: "${keywords || "liên quan đến " + title}".
Chuyên mục bài viết: "${category || "Tin tức"}".

Yêu cầu bài viết:
1. Viết bằng tiếng Việt, giọng văn chuyên nghiệp chuẩn y khoa, dài từ 1000 - 1500 từ.
2. Trả về định dạng HTML thô (CHỈ chứa mã HTML nằm trong thẻ body như H2, H3, p, strong, ul, li, table, KHÔNG có thẻ html/head/body).
3. Đặt Tiêu đề H1 ở dòng đầu tiên.
4. Bài viết bắt buộc phải có:
   - Các heading H2, H3 dạng câu hỏi.
   - Trả lời trực tiếp ngắn gọn 2-4 câu ngay dưới mỗi heading.
   - Ít nhất 1 bảng so sánh chi tiết.
   - Ít nhất 1 danh sách dấu đầu dòng (bullet point).
   - Phần FAQ cuối bài với 5 câu hỏi thường gặp.
5. KHÔNG chèn thẻ <img> hay link trong bài này (chúng ta sẽ chèn chúng ở bước tối ưu tiếp theo).`;

  let content = "";
  if (model === "qwen" && alibabaKey) {
    try {
      console.log("Using Alibaba Qwen to write article...");
      const qwen = new OpenAI({
        apiKey: alibabaKey,
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      });
      const completion = await qwen.chat.completions.create({
        model: "qwen-plus",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ]
      }, { timeout: 120000 });
      content = completion.choices[0].message.content;
    } catch (err) {
      console.error("Qwen article generation failed:", err.message);
    }
  }

  if (!content && openaiKey) {
    try {
      console.log("Using OpenAI GPT-4o to write article...");
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ]
      }, { timeout: 120000 });
      content = completion.choices[0].message.content;
    } catch (err) {
      console.error("OpenAI article generation failed:", err.message);
    }
  }

  if (!content) {
    return res.status(500).json({ error: "Không thể tự sinh bài viết bằng AI. Vui lòng kiểm tra lại cấu hình API Keys." });
  }

  content = content.replace(/^```html\s*/i, "").replace(/```\s*$/, "");
  res.json({ content });
});

// Route: Optimize an existing or generated post by inserting backlinks, image tags, and compositing branded WebPs
app.post("/api/optimize-post", async (req, res) => {
  try {
    const params = req.body;
    const {
      title,
      content,
      keywords,
      category,
      productImage,
      logo1,
      logo2,
      backlinks = [],
      logoPosition = "top-left",
      logoScale = 15,
      logo1Position,
      logo1Scale,
      logo2Position,
      logo2Scale,
      hasLogos = true,
      imageSize = "1200x800",
      numImages = "auto",
      model = "qwen",
      imageModel = "unsplash",
      includeImages = true
    } = params;

    const openaiKey = params.openaiKey || config.openaiKey;
    const alibabaKey = params.alibabaKey || config.alibabaKey;
    const leonardoKey = params.leonardoKey || config.leonardoKey;

    const finalLogo1Pos = logo1Position || config.logo1Position || logoPosition || "top-left";
    const finalLogo1Scale = logo1Scale !== undefined ? logo1Scale : (config.logo1Scale !== undefined ? config.logo1Scale : logoScale);
    const finalLogo2Pos = logo2Position || config.logo2Position || logoPosition || "top-right";
    const finalLogo2Scale = logo2Scale !== undefined ? logo2Scale : (config.logo2Scale !== undefined ? config.logo2Scale : logoScale);

    let width = 1200;
    let height = 800;
    if (imageSize && imageSize.includes("x")) {
      const parts = imageSize.split("x");
      width = parseInt(parts[0]) || 1200;
      height = parseInt(parts[1]) || 800;
    }

    // 1. Run AI SEO Engine to insert placeholders
    const seoResult = await optimizeArticleWithAI({
      title,
      content,
      keywords,
      category,
      backlinks,
      numImages,
      openaiKey,
      alibabaKey,
      model,
      includeImages
    });

    // 2. Generate and composite each image
    const processedImages = [];
    let finalHtml = seoResult.optimizedHtml;
    const excludeUrls = []; // Track backgrounds used in this article to prevent repetition

    for (let i = 0; i < seoResult.images.length; i++) {
      const imgData = seoResult.images[i];
      console.log(`Processing image ${i + 1}/${seoResult.images.length}: ${imgData.filename}`);

      const baseName = imgData.filename.replace(/\.[^/.]+$/, "");
      const seoName = `${slugify(baseName)}-${Date.now()}.webp`;

      try {
        const relativeUrl = await generateAndCompositeImage({
          openaiKey,
          leonardoKey,
          imageModel,
          prompt: imgData.dallePrompt,
          productImage,
          logo1,
          logo2,
          width,
          height,
          logoPosition,
          logoScale,
          logo1Position: finalLogo1Pos,
          logo1Scale: finalLogo1Scale,
          logo2Position: finalLogo2Pos,
          logo2Scale: finalLogo2Scale,
          hasLogos,
          filename: seoName,
          excludeUrls
        });

        const fullUrl = `http://${req.headers.host}${relativeUrl}`;
        
        // Replace placeholder src in HTML
        const imgTagPattern = new RegExp(`<img[^>]*class=["']seo-ill["'][^>]*data-idx=["']${imgData.idx}["'][^>]*src=["']["'][^>]*>`, 'i');
        const replacementTag = `<img src="${fullUrl}" alt="${imgData.altText || title}" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" class="seo-ill" />`;
        
        if (finalHtml.match(imgTagPattern)) {
          finalHtml = finalHtml.replace(imgTagPattern, replacementTag);
        } else {
          const genericPattern = new RegExp(`<img[^>]*data-idx=["']${imgData.idx}["'][^>]*src=["']["'][^>]*>`, 'i');
          finalHtml = finalHtml.replace(genericPattern, `<img src="${fullUrl}" alt="${imgData.altText || title}" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" class="seo-ill" />`);
        }

        processedImages.push({
          ...imgData,
          filename: seoName,
          url: fullUrl
        });
      } catch (imgComposeErr) {
        console.error(`Failed to process image ${imgData.filename}:`, imgComposeErr.message);
        const fallbackUrl = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800";
        const fallbackTag = `<img src="${fallbackUrl}" alt="Dental Image" style="display:block; margin:20px auto; max-width:100%; border-radius:8px;" />`;
        
        const imgTagPattern = new RegExp(`<img[^>]*data-idx=["']${imgData.idx}["'][^>]*>`, 'i');
        finalHtml = finalHtml.replace(imgTagPattern, fallbackTag);
        
        processedImages.push({
          ...imgData,
          url: fallbackUrl,
          error: imgComposeErr.message
        });
      }
    }

    res.json({
      optimizedHtml: finalHtml,
      images: processedImages,
      insertedLinks: seoResult.insertedLinks,
      warnings: seoResult.warnings,
      wordCount: seoResult.wordCount
    });
  } catch (err) {
    console.error("Optimize route failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route: Publish optimized single post to selected WordPress websites
app.post("/api/publish-single", async (req, res) => {
  const { title, content, postStatus, selectedWebsites = [], images = [] } = req.body;

  if (selectedWebsites.length === 0) {
    return res.status(400).json({ error: "Chưa chọn website nào để đăng tải." });
  }

  const results = [];
  const taskId = `task_single_${Date.now()}`;

  console.log(`Starting single post publishing for "${title}" to ${selectedWebsites.length} sites.`);

  for (let site of selectedWebsites) {
    try {
      const cleanWpUrl = site.url.replace(/\/$/, "");
      const authHeader = `Basic ${Buffer.from(`${site.user}:${site.password}`).toString("base64")}`;

      // 1. Upload Featured Image
      let featuredMediaId = null;
      let uploadedFeaturedUrl = "";

      const heroImg = images.find(img => img.type === "hero" || img.idx === 0);
      if (heroImg && heroImg.filename) {
        const localPath = path.join(__dirname, "uploads", heroImg.filename);
        if (fs.existsSync(localPath)) {
          try {
            console.log(`Uploading local featured image ${heroImg.filename} to ${site.name}...`);
            const imgBuffer = fs.readFileSync(localPath);
            const uploadResponse = await axios.post(
              `${cleanWpUrl}/wp-json/wp/v2/media`,
              imgBuffer,
              {
                headers: {
                  "Content-Type": "image/jpeg",
                  "Content-Disposition": `attachment; filename="${heroImg.filename}"`,
                  Authorization: authHeader
                }
              }
            );
            featuredMediaId = uploadResponse.data.id;
            uploadedFeaturedUrl = uploadResponse.data.source_url;
            console.log(`Uploaded featured image. ID: ${featuredMediaId}`);
          } catch (upErr) {
            console.error(`Failed to upload featured image to ${site.name}:`, upErr.message);
          }
        }
      }

      // 2. Upload inline images and replace localhost URLs in siteContent
      let siteContent = content;
      for (let img of images) {
        const localPath = path.join(__dirname, "uploads", img.filename);
        if (fs.existsSync(localPath)) {
          try {
            console.log(`Uploading inline image ${img.filename} to ${site.name}...`);
            const imgBuffer = fs.readFileSync(localPath);
            const uploadResponse = await axios.post(
              `${cleanWpUrl}/wp-json/wp/v2/media`,
              imgBuffer,
              {
                headers: {
                  "Content-Type": "image/jpeg",
                  "Content-Disposition": `attachment; filename="${img.filename}"`,
                  Authorization: authHeader
                }
              }
            );
            const wpImgUrl = uploadResponse.data.source_url;
            
            // Replace localhost uploads path with wpImgUrl in the content
            const localUrlPattern = new RegExp(`https?:\\/\\/[^/]+\\/uploads\\/${img.filename.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'gi');
            siteContent = siteContent.replace(localUrlPattern, wpImgUrl);
            console.log(`Replaced inline image url: ${img.filename} -> ${wpImgUrl}`);
          } catch (upInlineErr) {
            console.error(`Failed to upload inline image ${img.filename} to ${site.name}:`, upInlineErr.message);
          }
        }
      }

      // 3. Find or Create "Tin tức" category
      let siteCategoryId = null;
      try {
        const categoriesResponse = await axios.get(
          `${cleanWpUrl}/wp-json/wp/v2/categories?per_page=100`,
          { headers: { Authorization: authHeader } }
        );
        const categories = categoriesResponse.data;
        const targetCategory = categories.find(cat => 
          cat.name.toLowerCase().includes("tin tức") || 
          cat.slug.toLowerCase() === "tin-tuc" ||
          cat.name.toLowerCase().includes("news")
        );

        if (targetCategory) {
          siteCategoryId = targetCategory.id;
        } else {
          const createCatResponse = await axios.post(
            `${cleanWpUrl}/wp-json/wp/v2/categories`,
            { name: "Tin tức", slug: "tin-tuc" },
            { headers: { Authorization: authHeader } }
          );
          siteCategoryId = createCatResponse.data.id;
        }
      } catch (catErr) {
        console.warn(`Could not fetch/create category on ${site.name}:`, catErr.message);
      }

      // 4. Publish Post
      const postBody = {
        title: title,
        content: siteContent,
        status: postStatus || "draft"
      };

      if (featuredMediaId) {
        postBody.featured_media = featuredMediaId;
      }
      if (siteCategoryId) {
        postBody.categories = [siteCategoryId];
      }

      const postResponse = await axios.post(
        `${cleanWpUrl}/wp-json/wp/v2/posts`,
        postBody,
        { headers: { Authorization: authHeader } }
      );

      const postLink = postResponse.data.link;
      console.log(`Successfully published single post to ${site.name}: ${postLink}`);

      results.push({
        siteId: site.id,
        siteName: site.name,
        success: true,
        link: postLink
      });

      // Save to history
      await saveToHistory({
        taskId: `${taskId}_${site.id}`,
        title: title,
        link: postLink,
        imageUrl: uploadedFeaturedUrl || "https://placehold.co/100x100?text=No+Image",
        topic: title,
        websiteName: site.name,
        websiteUrl: site.url,
        timestamp: new Date().toLocaleString()
      });

    } catch (err) {
      let errMsg = err.message;
      if (err.response && err.response.data) {
        errMsg += ` - ${JSON.stringify(err.response.data)}`;
      }
      console.error(`Failed to publish single post to ${site.name}:`, errMsg);
      results.push({
        siteId: site.id,
        siteName: site.name,
        success: false,
        error: errMsg
      });
    }
  }

  res.json({ success: true, results });
});

// Route: Run the 4-step RSS automation scenario
app.post("/api/run-rss-scenario", async (req, res) => {
  const { rssUrl, websiteId } = req.body;
  
  const steps = {
    step1: { name: "Lấy tin tức/RSS", success: false, data: null, error: null },
    step2: { name: "Lọc sạch HTML (Text Parser)", success: false, data: null, error: null },
    step3: { name: "AI viết lại & chèn backlink", success: false, data: null, error: null },
    step4: { name: "Đăng lên WordPress ở chế độ Draft", success: false, data: null, error: null }
  };

  if (!rssUrl || rssUrl.trim() === "") {
    return res.status(400).json({
      success: false,
      error: "Đường dẫn bài viết hoặc nguồn RSS không được để trống!",
      steps
    });
  }

  const geminiKey = req.body.geminiKey || config.geminiKey;
  const alibabaKey = req.body.alibabaKey || config.alibabaKey;
  const openaiKey = req.body.openaiKey || config.openaiKey;

  try {
    // --- STEP 1: Fetch RSS Feed or HTML Article ---
    console.log(`[Scenario] Step 1: Fetching content from ${rssUrl}`);
    let xml = "";
    try {
      const rssResponse = await axios.get(rssUrl, { 
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      xml = rssResponse.data;
    } catch (err) {
      throw new Error(`Không thể lấy dữ liệu từ liên kết: ${err.message}`);
    }

    let title = "Tin tức tự động";
    let link = rssUrl;
    let rawDescription = "";

    const itemRegex = /<item>([\s\S]*?)<\/item>/;
    const match = xml.match(itemRegex);
    if (match) {
      // Detected RSS Feed format!
      console.log("[Scenario] Detected RSS Feed format");
      const itemContent = match[1];
      const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemContent.match(/<title>(.*?)<\/title>/);
      const linkMatch = itemContent.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) || itemContent.match(/<link>(.*?)<\/link>/);
      const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemContent.match(/<description>(.*?)<\/description>/);

      title = titleMatch ? titleMatch[1].trim() : "Tin tức tự động";
      link = linkMatch ? linkMatch[1].trim() : rssUrl;
      rawDescription = descMatch ? descMatch[1].trim() : "";
    } else {
      // Detected direct web page format!
      console.log("[Scenario] Detected direct web page format, parsing HTML...");
      
      // Extract title
      const titleMatch = xml.match(/<title>([\s\S]*?)<\/title>/i) || xml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (titleMatch) {
        title = titleMatch[1]
          .replace(/ - VnExpress.*/i, "")
          .replace(/ - Nha khoa.*/i, "")
          .replace(/<[^>]*>/g, "")
          .trim();
      }

      // Extract raw description/content
      // Clean scripts, styles, metadata
      let htmlClean = xml
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<head[\s\S]*?<\/head>/gi, "");

      // Look for main article tags first to get clean content
      const articleMatch = htmlClean.match(/<article[^>]*>([\s\S]*?)<\/article>/i) || htmlClean.match(/<div class="content[\s\S]*?">([\s\S]*?)<\/div>/i);
      if (articleMatch) {
        rawDescription = articleMatch[1];
      } else {
        // Fallback to body
        const bodyMatch = htmlClean.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        rawDescription = bodyMatch ? bodyMatch[1] : htmlClean;
      }
    }

    steps.step1.success = true;
    steps.step1.data = { title, link, rawDescription };

    // --- STEP 2: Text Parser to Clean HTML ---
    console.log("[Scenario] Step 2: Cleaning HTML from description");
    let cleaned = rawDescription.replace(/<[^>]*>/g, " ");
    cleaned = cleaned
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    // If cleaned text is very long (since it parsed a whole webpage), truncate to 5000 chars to pass more rich context to AI
    if (cleaned.length > 5000) {
      cleaned = cleaned.slice(0, 5000) + "...";
    }

    steps.step2.success = true;
    steps.step2.data = { cleanedText: cleaned };

    // --- STEP 3: AI Rewrite and Backlink Injection ---
    console.log("[Scenario] Step 3: Rewriting article with AI");
    const randomBacklink = Math.random() > 0.5 ? "https://maxdent.vn" : "http://ddd.vn";
    const anchorText = randomBacklink.includes("maxdent") ? "Nha khoa MaxDent" : "Kiến thức nha khoa";

    const aiPrompt = `Hãy đóng vai là một nhà viết bài blog chuẩn SEO chuyên nghiệp. Hãy viết lại bài viết dưới đây thành một bài viết hướng dẫn chuyên sâu, chi tiết và dài hạn bằng Tiếng Việt.
YÊU CẦU ĐỘ DÀI: Bài viết mới BẮT BUỘC phải có độ dài từ 1500 đến 2000 từ. 
Để đạt được độ dài tối thiểu 1500 từ, hãy phân tích kỹ lưỡng các khía cạnh liên quan, giải thích sâu các thuật ngữ nha khoa, mô tả chi tiết từng bước quy trình điều trị/chăm sóc, phân tích ưu nhược điểm, đưa ra lời khuyên từ bác sĩ chuyên gia, và thêm phần Các câu hỏi thường gặp (FAQ) có giải thích chi tiết ở cuối bài.
BẮT BUỘC chèn đúng một liên kết (backlink) trỏ về địa chỉ sau vào vị trí phù hợp nhất trong văn cảnh bài viết:
- URL: ${randomBacklink}
- Anchor text: ${anchorText}

Nội dung đầu ra CHỈ trả về mã HTML sạch chứa bài viết mới (bao gồm các thẻ p, h2, h3, ul, li, strong, a). Không thêm bất kỳ lời dẫn giải thích hay định dạng markdown nào khác ngoài HTML.

Bài viết gốc:
Tiêu đề: ${title}
Nội dung tóm tắt: ${cleaned}`;

    let rewrittenHtml = "";
    let modelUsed = "";

    // Strict Alibaba (Qwen) Only
    if (!alibabaKey || alibabaKey.trim() === "") {
      throw new Error("Vui lòng cấu hình API Key cho Alibaba Cloud trong cài đặt để sử dụng kịch bản RSS này.");
    }

    try {
      console.log("[Scenario] Attempting Alibaba Qwen rewrite...");
      const qwen = new OpenAI({
        apiKey: alibabaKey,
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      });
      const completion = await qwen.chat.completions.create({
        model: "qwen-plus",
        messages: [
          { role: "system", content: "You are a professional copywriter who returns pure HTML format and writes extensive, detailed articles." },
          { role: "user", content: aiPrompt }
        ],
        max_tokens: 4000
      });
      rewrittenHtml = completion.choices[0].message.content;
      modelUsed = "Qwen Plus";
    } catch (err) {
      console.error("[Scenario] Qwen failed:", err.message);
      throw new Error(`Alibaba Qwen rewrite failed: ${err.message}`);
    }

    // Clean up markdown block characters if AI returned them
    rewrittenHtml = rewrittenHtml.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim();

    steps.step3.success = true;
    steps.step3.data = { modelUsed, rewrittenHtml, backlink: randomBacklink, anchorText };

    // --- STEP 4: Push to WordPress (Draft Mode Mandatory) ---
    console.log("[Scenario] Step 4: Pushing post to WordPress");
    let site = null;
    if (websiteId) {
      site = (config.websites || []).find(w => w.id === websiteId);
    } else {
      site = config.websites && config.websites[0];
    }

    if (!site) {
      throw new Error("Không có website vệ tinh nào được cấu hình trong hệ thống.");
    }

    const cleanWpUrl = site.url.replace(/\/+$/, "");
    const apiEndpoint = `${cleanWpUrl}/wp-json/wp/v2/posts`;
    const authHeader = `Basic ${Buffer.from(`${site.user}:${site.password}`).toString("base64")}`;

    let postResponse;
    try {
      postResponse = await axios.post(apiEndpoint, {
        title: `[Tái bản Scenario] ${title}`,
        content: rewrittenHtml,
        status: "draft" // Draft mode is MANDATORY
      }, {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json"
        },
        timeout: 30000
      });
    } catch (err) {
      let wpErr = err.message;
      if (err.response && err.response.data) {
        wpErr += ` - ${JSON.stringify(err.response.data)}`;
      }
      throw new Error(`WordPress error: ${wpErr}`);
    }

    steps.step4.success = true;
    steps.step4.data = {
      postId: postResponse.data.id,
      postLink: postResponse.data.link,
      siteName: site.name,
      siteUrl: site.url,
      status: "draft"
    };

    res.json({ success: true, steps });

  } catch (err) {
    console.error("[Scenario] Scenario failed:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      steps
    });
  }
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log("Connected to MongoDB Atlas successfully!");
    } catch (err) {
      console.error("Failed to connect to MongoDB Atlas, falling back to local storage:", err.message);
    }
  } else {
    console.warn("MONGODB_URI environment variable is missing. Falling back to local storage.");
  }
  
  await initializeConfig();

  // Activate all existing users to ensure no lock screen for anyone
  if (mongoose.connection.readyState === 1) {
    try {
      await User.updateMany({ status: "pending" }, { status: "active" });
      console.log("All pending users have been activated in MongoDB Atlas.");
    } catch (err) {
      console.error("Failed to activate existing users in MongoDB:", err.message);
    }
  } else {
    try {
      const users = await readUsers();
      let modified = false;
      users.forEach(u => {
        if (u.status === "pending") {
          u.status = "active";
          modified = true;
        }
      });
      if (modified) {
        await writeUsers(users);
        console.log("All pending local users have been activated.");
      }
    } catch (err) {
      console.error("Failed to activate existing local users:", err.message);
    }
  }
  
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
