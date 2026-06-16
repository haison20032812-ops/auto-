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

  // Check if we have sample images
  const sampleProductPath = path.join(__dirname, "../client/public/samples/electric_toothbrush.png");
  if (!fs.existsSync(sampleProductPath)) {
    console.error(`Sample product image not found at ${sampleProductPath}`);
    return;
  }

  console.log("Loading product image and generating mock logo...");
  const productBase64 = fs.readFileSync(sampleProductPath).toString("base64");
  
  // Create a simple mock logo base64 (a transparent 10x10 PNG or just using the toothbrush image as mock logo)
  const logoBase64 = productBase64; 

  console.log("Triggering /api/optimize-post test...");

  const payload = {
    title: "Quy trình trồng răng Implant và những lưu ý quan trọng",
    content: "<h2>Trồng răng Implant là gì?</h2><p>Trồng răng Implant là phương pháp phục hình răng đã mất hiệu quả nhất hiện nay. Trụ Implant được cấy trực tiếp vào xương hàm.</p><h2>Ưu điểm của Implant?</h2><p>Implant giúp khôi phục chức năng nhai 99% và tính thẩm mỹ tuyệt vời. Bạn nên tham khảo bảng giá dịch vụ để biết thêm chi tiết.</p>",
    keywords: "trồng răng implant, quy trình implant, nha khoa maxdent",
    category: "Kiến thức Nha khoa",
    productImage: productBase64,
    logo1: logoBase64,
    logo2: logoBase64,
    backlinks: [
      { url: "https://maxdent.vn", anchorText: "Nha khoa MaxDent", linkType: "brand" },
      { url: "https://maxdent.vn/bang-gia", anchorText: "bảng giá dịch vụ", linkType: "keyword_sub" }
    ],
    logoPosition: "bottom-right",
    logoScale: 12,
    hasLogos: true,
    imageSize: "1200x800",
    numImages: "2",
    model: "qwen", // Try Qwen first
    openaiKey: config.openaiKey,
    alibabaKey: config.alibabaKey
  };

  try {
    const res = await axios.post("http://localhost:5000/api/optimize-post", payload, {
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024
    });

    console.log("\n[TEST COMPLETED SUCCESSFULLY!]");
    console.log(`Word Count: ${res.data.wordCount}`);
    console.log(`Images Generated: ${res.data.images?.length}`);
    res.data.images?.forEach((img, idx) => {
      console.log(`  -> Image ${idx + 1}: ${img.url} (Alt: ${img.altText})`);
    });
    console.log(`Backlinks Inserted: ${res.data.insertedLinks?.length}`);
    res.data.insertedLinks?.forEach((link, idx) => {
      console.log(`  -> Link ${idx + 1}: ${link.url} with anchor "${link.anchorText}"`);
    });
    console.log(`Warnings reported: ${res.data.warnings?.length || 0}`);
    res.data.warnings?.forEach(w => console.log(`  -> WARNING: ${w}`));

  } catch (error) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

main();
