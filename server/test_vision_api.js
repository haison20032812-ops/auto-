import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "config.json");

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
  });
  
  return response.choices[0].message.content.trim();
}

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("No config.json found");
    return;
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  
  if (!config.openaiKey) {
    console.error("OpenAI API Key is missing in configuration.");
    return;
  }

  const imagePath = path.join(__dirname, "../client/public/samples/electric_toothbrush.png");
  if (!fs.existsSync(imagePath)) {
    console.error(`Sample image not found at ${imagePath}`);
    return;
  }

  console.log(" Reading sample product image...");
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  console.log(" Calling GPT-4o Vision to analyze the image...");
  try {
    const description = await analyzeProductImage(base64Image, config.openaiKey);
    console.log(`\n[VISION DESCRIPTION RESULT]:\n"${description}"\n`);

    const currentTopic = "Cách chọn bàn chải điện tốt nhất cho răng nhạy cảm";
    const title = "Hướng Dẫn Chọn Bàn Chải Điện Cho Răng Nhạy Cảm Từ Chuyên Gia";
    
    console.log(` Generating DALL-E 3 Prompt using gpt-4o-mini...`);
    const openai = new OpenAI({ apiKey: config.openaiKey });
    const imagePromptUserContent = `Hãy viết một prompt tiếng Anh ngắn gọn, tập trung và miêu tả một bức ảnh nghệ thuật, chất lượng cao, hiện đại không chữ (no text), phù hợp làm ảnh đại diện cho bài viết có chủ đề: "${currentTopic}" và tiêu đề: "${title}".\n\nBẮT BUỘC: Bức ảnh phải chứa sản phẩm được mô tả dưới đây và đặt sản phẩm đó nằm tự nhiên, hài hòa trong ngữ cảnh bối cảnh bài viết: "${description}". Đảm bảo sản phẩm trông chân thật và phù hợp hoàn hảo với chủ đề bài viết.`;

    const imagePromptCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You write highly descriptive prompts for image generators like DALL-E 3. Return ONLY the description prompt." },
        { role: "user", content: imagePromptUserContent }
      ]
    });
    
    const imagePrompt = imagePromptCompletion.choices[0].message.content.trim();
    console.log(`\n[GENERATED DALL-E 3 PROMPT]:\n"${imagePrompt}"\n`);
    
    console.log(" Vision & Prompt Pipeline Test Completed Successfully!");
  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

main();
