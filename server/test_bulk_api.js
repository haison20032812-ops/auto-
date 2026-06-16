import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "config.json");

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("No config.json found");
    return;
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  
  if (!config.websites || config.websites.length === 0) {
    console.error("No websites found in configuration.");
    return;
  }

  console.log("Triggering bulk publish API test...");
  
  const payload = {
    topics: [
      "Kiểm thử hệ thống tự động hóa - Chủ đề 1",
      "Kiểm thử hệ thống tự động hóa - Chủ đề 2"
    ],
    selectedWebsites: [config.websites[0]],
    openaiKey: config.openaiKey,
    alibabaKey: config.alibabaKey,
    postStatus: "draft",
    tone: "Chuyên nghiệp",
    language: "Tiếng Việt",
    researchModel: "qwen",
    writingModel: "qwen",
    cooldown: 5 // 5 seconds for fast test
  };

  try {
    const res = await axios.post("http://localhost:5000/api/publish", payload);
    const taskId = res.data.taskId;
    console.log(`Task triggered successfully! Task ID: ${taskId}`);
    
    // Poll status
    const interval = setInterval(async () => {
      try {
        const statusRes = await axios.get(`http://localhost:5000/api/tasks/${taskId}`);
        const task = statusRes.data;
        console.log(`[Task Status] ${task.status}`);
        
        // Print last step
        if (task.steps && task.steps.length > 0) {
          const lastStep = task.steps[task.steps.length - 1];
          console.log(` -> Last Log: [${lastStep.type.toUpperCase()}] ${lastStep.message}`);
        }
        
        if (task.status === "completed" || task.status === "failed") {
          clearInterval(interval);
          console.log("Task Finished!");
          console.log("Result:", JSON.stringify(task.result, null, 2));
          if (task.error) console.error("Error details:", task.error);
        }
      } catch (err) {
        console.error("Polling error:", err.message);
        clearInterval(interval);
      }
    }, 2000);

  } catch (error) {
    console.error("Failed to trigger publish:", error.response?.data || error.message);
  }
}

main();
