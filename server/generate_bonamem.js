import fs from "fs";
import path from "path";
import axios from "axios";
import OpenAI from "openai";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openaiKey = "";
const openai = new OpenAI({ apiKey: openaiKey });

async function run() {
  try {
    console.log("1. Đang nghiên cứu và tự động viết bài về Bonamem Waldent Biotech...");
    const writePrompt = `Hãy viết một bài viết giới thiệu sản phẩm màng collagen nha khoa Bonamem™ của hãng Waldent Biotech.
Yêu cầu cụ thể:
1. Viết bằng tiếng Việt, tông giọng chuyên nghiệp, thuyết phục cho nha sĩ.
2. Bài viết chi tiết, giải thích rõ Bonamem là gì (màng collagen sinh học từ màng tim lợn), độ bền cao, thời gian tiêu biến lên đến 6 tháng, ứng dụng trong cấy ghép implant và ghép xương răng (GBR/GTR).
3. Định dạng dưới dạng mã HTML sạch (không bao gồm các thẻ html/body/head, chỉ dùng h2, h3, p, strong, ul, li).
4. Đưa tiêu đề bài viết vào thẻ <h1> ở dòng đầu tiên.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert medical copywriter who writes SEO optimized blog posts in clean HTML format." },
        { role: "user", content: writePrompt }
      ]
    });

    const rawHtml = completion.choices[0].message.content;
    const articlePath = path.join(__dirname, "bonamem_article.html");
    fs.writeFileSync(articlePath, rawHtml, "utf8");
    console.log("✓ Đã lưu nội dung bài viết tại:", articlePath);

    console.log("2. Đang tạo hình ảnh sản phẩm chất lượng cao bằng DALL-E 3...");
    const imagePrompt = "A premium product rendering of a dental collagen membrane package named Bonamem, clean medical box with Waldent branding in green, modern white dental clinical background with soft blue lighting, 3d render, professional macro photography, no text on background, high resolution.";
    
    const imageGen = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024"
    });

    const tempImageUrl = imageGen.data[0].url;
    console.log("✓ Đã tạo ảnh minh họa. Đang tải ảnh về...");

    const imgResponse = await axios.get(tempImageUrl, { responseType: "arraybuffer" });
    const imagePath = path.join(__dirname, "bonamem_image.jpg");
    fs.writeFileSync(imagePath, Buffer.from(imgResponse.data));
    console.log("✓ Đã tải và lưu ảnh minh họa tại:", imagePath);

    console.log("\n==========================================");
    console.log("QUÁ TRÌNH TẠO NỘI DUNG HOÀN TẤT!");
    console.log("- Xem bài viết tại: bonamem_article.html");
    console.log("- Xem hình ảnh tại: bonamem_image.jpg");
    console.log("==========================================");

  } catch (err) {
    console.error("Lỗi trong quá trình tạo nội dung:", err.message);
  }
}

run();
