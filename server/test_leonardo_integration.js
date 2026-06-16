import { generateAndCompositeImage } from "./imageComposer.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "config.json");

if (!fs.existsSync(CONFIG_PATH)) {
  console.error("config.json not found!");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

async function test() {
  console.log("Testing Leonardo.ai Integration...");
  console.log("Using API Key from config:", config.leonardoKey ? "FOUND" : "NOT FOUND");
  
  try {
    const resultUrl = await generateAndCompositeImage({
      leonardoKey: config.leonardoKey,
      imageModel: "leonardo",
      prompt: "A beautiful dental clinic lobby with warm lighting, photorealistic, 8k",
      logo1: config.logo1 || "",
      logo2: config.logo2 || "",
      hasLogos: !!(config.logo1 || config.logo2),
      width: 1200,
      height: 800,
      filename: "test-leonardo-out.webp"
    });
    console.log("Image generation completed successfully! Result URL:", resultUrl);
  } catch (err) {
    console.error("Test failed:", err.message);
  }
}

test();
