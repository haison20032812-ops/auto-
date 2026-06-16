import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "config.json");

if (!fs.existsSync(CONFIG_PATH)) {
  console.error("config.json not found!");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

// 1. Fetch RSS Feed
async function fetchLatestRSSItem() {
  console.log("Step 1: Fetching RSS Feed from VnExpress...");
  // VnExpress business/business news RSS feed
  const rssUrl = "https://vnexpress.net/rss/kinh-doanh.rss";
  const response = await axios.get(rssUrl, { timeout: 15000 });
  const xml = response.data;

  // Simple XML parsing using regex to extract the first item
  const itemRegex = /<item>([\s\S]*?)<\/item>/;
  const match = xml.match(itemRegex);
  if (!match) {
    throw new Error("No <item> found in RSS XML");
  }

  const itemContent = match[1];

  const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemContent.match(/<title>(.*?)<\/title>/);
  const linkMatch = itemContent.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) || itemContent.match(/<link>(.*?)<\/link>/);
  const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemContent.match(/<description>(.*?)<\/description>/);

  const title = titleMatch ? titleMatch[1].trim() : "Tin tức mới";
  const link = linkMatch ? linkMatch[1].trim() : "";
  const rawDescription = descMatch ? descMatch[1].trim() : "";

  console.log(`Successfully fetched RSS Item: "${title}"`);
  return { title, link, rawDescription };
}

// 2. Text Parser to clean HTML
function cleanHtmlText(rawHtml) {
  console.log("Step 2: Parsing text and filtering HTML tags...");
  // Strip HTML tags using regex
  let cleaned = rawHtml.replace(/<[^>]*>/g, " ");
  // Unescape common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Clean double spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

// 3. Call AI API (Gemini, Qwen, or OpenAI) to rewrite article and insert backlink
async function rewriteArticle(title, description) {
  console.log("Step 3: Rewriting article with AI and inserting backlink...");
  const randomBacklink = Math.random() > 0.5 ? "https://maxdent.vn" : "http://ddd.vn";
  const anchorText = randomBacklink.includes("maxdent") ? "Nha khoa MaxDent" : "Kiến thức nha khoa";
  
  const aiPrompt = `Hãy đóng vai là một nhà báo chuyên nghiệp. Hãy viết lại bài viết dưới đây thành một bài viết hướng dẫn chuyên sâu, chi tiết và dài hạn bằng Tiếng Việt.
YÊU CẦU ĐỘ DÀI: Bài viết mới BẮT BUỘC phải có độ dài từ 1500 đến 2000 từ. 
Để đạt được độ dài tối thiểu 1500 từ, hãy phân tích kỹ lưỡng các khía cạnh liên quan, giải thích sâu các thuật ngữ nha khoa, mô tả chi tiết từng bước quy trình điều trị/chăm sóc, phân tích ưu nhược điểm, đưa ra lời khuyên từ bác sĩ chuyên gia, và thêm phần Các câu hỏi thường gặp (FAQ) có giải thích chi tiết ở cuối bài.
BẮT BUỘC chèn đúng một liên kết (backlink) trỏ về địa chỉ sau vào câu văn hợp lý nhất:
- URL: ${randomBacklink}
- Anchor text: ${anchorText}

Nội dung đầu ra CHỈ trả về mã HTML sạch chứa bài viết mới (bao gồm các thẻ p, h2, h3, ul, li, strong, a). Không thêm bất kỳ lời dẫn giải thích hay định dạng markdown nào khác ngoài HTML.

Bài viết gốc:
Tiêu đề: ${title}
Nội dung tóm tắt: ${description}`;

  const alibabaKey = config.alibabaKey;
  const geminiKey = process.argv[2] || config.geminiKey || process.env.GEMINI_API_KEY;

  // Strict Qwen (Alibaba) Only
  if (!alibabaKey || alibabaKey.trim() === "") {
    throw new Error("Alibaba Cloud API Key is missing in config.json. Please add it to use this script.");
  }

  try {
    console.log("Using Alibaba Qwen API for rewriting...");
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
    const text = completion.choices[0].message.content;
    return text.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim();
  } catch (err) {
    console.error("Qwen rewrite failed:", err.message);
    throw new Error(`Qwen rewrite failed: ${err.message}`);
  }
}

// 4. Push to WordPress as Draft
async function pushToWordPress(title, content) {
  console.log("Step 4: Push rewritten article to WordPress satellite site as Draft...");
  const site = config.websites && config.websites[0];
  if (!site) {
    throw new Error("No website configured in config.json");
  }

  const cleanWpUrl = site.url.replace(/\/+$/, "");
  const apiEndpoint = `${cleanWpUrl}/wp-json/wp/v2/posts`;
  const auth = Buffer.from(`${site.user}:${site.password}`).toString("base64");

  console.log(`Connecting to WordPress site: ${site.name} (${cleanWpUrl})...`);
  
  const postResponse = await axios.post(apiEndpoint, {
    title: `[Tái bản] ${title}`,
    content: content,
    status: "draft" // Draft mode is MANDATORY
  }, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });

  console.log(`Successfully published draft to WordPress! Post ID: ${postResponse.data.id}`);
  console.log(`View link: ${postResponse.data.link}`);
  return postResponse.data;
}

// Execute Scenario
async function run() {
  console.log("=== STARTING 4-STEP AUTOMATION SCENARIO ===");
  try {
    const rssItem = await fetchLatestRSSItem();
    const cleanText = cleanHtmlText(rssItem.rawDescription);
    const rewrittenHtml = await rewriteArticle(rssItem.title, cleanText);
    const result = await pushToWordPress(rssItem.title, rewrittenHtml);
    console.log("=== SCENARIO EXECUTED SUCCESSFULLY ===");
  } catch (err) {
    console.error("=== SCENARIO FAILED ===");
    console.error(err.response ? err.response.data : err.message);
  }
}

run();
