import OpenAI from "openai";

/**
 * Normalizes Vietnamese string to SEO-friendly slug
 */
export function slugify(text) {
  if (!text) return "";
  let str = text.toLowerCase();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/[^a-z0-9\s-]/g, ""); // Remove spec chars
  str = str.replace(/[\s-]+/g, "-");     // Collapse spaces and dashes
  str = str.trim().replace(/^-+|-+$/g, "");
  return str;
}

/**
 * Calculates recommended images and links based on word count
 */
export function calculateSEORecommendations(wordCount) {
  if (wordCount < 800) {
    return { images: 2, links: 1 };
  } else if (wordCount <= 1500) {
    return { images: 3, links: 2 };
  } else if (wordCount <= 2500) {
    return { images: 4, links: 3 };
  } else {
    return { images: 6, links: 4 };
  }
}

/**
 * Calls OpenAI or Qwen to optimize the article, chèn backlinks, and insert image placeholders.
 */
export async function optimizeArticleWithAI({
  title,
  content,
  keywords,
  category,
  backlinks = [],
  numImages = "auto",
  openaiKey,
  alibabaKey,
  model = "qwen",
  includeImages = true
}) {
  // 1. Calculate length and recommendations
  const cleanText = (content || "").replace(/<[^>]*>/g, " ").trim();
  const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;
  const recs = calculateSEORecommendations(wordCount);

  const targetImagesCount = includeImages ? (numImages === "auto" ? recs.images : parseInt(numImages) || 2) : 0;
  const targetLinksCount = Math.min(recs.links, backlinks.length);

  console.log(`Optimizing article: "${title}". Words: ${wordCount}. Targets: ${targetImagesCount} images, ${targetLinksCount} backlinks.`);

  // If no content, write a sample default content so we don't crash
  let currentContent = content || "";
  if (!currentContent.trim()) {
    currentContent = `<h1>${title}</h1><p>Bài viết đang được chuẩn bị nội dung nha khoa tự động cho chuyên mục ${category}...</p>`;
  }

  // 2. Build AI Prompt
  let promptInstructions = "";
  if (targetImagesCount > 0) {
    promptInstructions = `2. Xác định các vị trí tốt nhất để đặt ${targetImagesCount} hình ảnh minh họa bài viết. Hãy chèn các thẻ placeholder hình ảnh có cấu trúc dạng: <img class="seo-ill" data-idx="0" src="" alt="Alt text của ảnh" />.`;
  } else {
    promptInstructions = `2. KHÔNG ĐƯỢC chèn bất kỳ thẻ hình ảnh <img> hay bất kỳ placeholder hình ảnh nào vào bài viết. Hãy giữ nội dung bài viết chỉ có văn bản và các backlinks.`;
  }

  let imageInstructions = "";
  if (targetImagesCount > 0) {
    imageInstructions = `
Nguyên tắc chèn ảnh và sinh DALL-E prompt:
- Thẻ đầu tiên (data-idx="0") là ảnh đại diện (Hero/Thumbnail), đặt ngay dưới tiêu đề H1 hoặc sau đoạn mở đầu.
- Các thẻ tiếp theo (data-idx từ 1 đến ${targetImagesCount - 1}) là ảnh giữa bài (minh họa kỹ thuật, lợi ích) hoặc ảnh Infographic (đặt ở bảng so sánh, quy trình).
- Ảnh cuối bài đặt gần phần CTA kết bài.
- Hãy viết mô tả DALL-E prompt tiếng Anh cho từng ảnh, tên file SEO (không dấu, dùng dấu gạch ngang, kết thúc bằng .webp), alt text (mô tả đúng hình ảnh, chứa từ khóa tự nhiên), và chú thích caption tiếng Việt.
- YÊU CẦU ĐẶC BIỆT CHO DALL-E PROMPT:
  1. Mô tả DALL-E prompt phải chi tiết bằng tiếng Anh, theo phong cách "marketing nha khoa cao cấp, y khoa chuyên nghiệp" (premium dental marketing, professional medical clean style, warm soft ambient lighting, macro dental photography, clean clinic environment). Tránh các hình vẽ hoạt họa rẻ tiền, tranh màu nước hay hình ảnh phẫu thuật đáng sợ.
  2. Bố cục nền: DALL-E prompt phải thiết kế chừa sẵn một khoảng trống ở góc trái (left third of the layout) hoặc góc phải để ghép sản phẩm vào (layout should have clear copy space on the left side or right side for product overlay).
  3. Tính phù hợp của nền và KHÔNG CHỨA KHUÔN MẶT CON NGƯỜI:
     - TUYỆT ĐỐI KHÔNG chứa khuôn mặt con người, không chứa người mẫu nam/nữ, không chứa bối cảnh spa, dưỡng da hay chăm sóc sắc đẹp thẩm mỹ.
     - Nếu bài viết nhắc đến "màng collagen" (collagen membrane), đây là màng sinh học nha khoa dùng trong phẫu thuật tái tạo xương (GBR), nghiêm cấm tạo hình ảnh liên quan đến mặt nạ dưỡng da collagen, mỹ phẩm hay khuôn mặt người mẫu.
     - Nếu bài viết nói về "implant", "trụ implant", "ren implant" -> Nền phải là mô phỏng 3D xương hàm (3D jawbone structure simulation), implant trong xương hàm hoặc cận cảnh ren, osseointegration, hoặc không gian phòng khám nha khoa hiện đại (clean, sterile dental treatment room, modern dental chair, medical cabinets), mô hình răng sứ cao cấp. KHÔNG ĐƯỢC dùng hình ảnh bột xương/hạt vật liệu (bone graft powder) trừ khi bài viết chính xác nói về ghép xương bột xương.
     - Nếu bài viết nói về "bột xương", "ghép xương", "GBR", "màng collagen" -> Nền mới được phép hiển thị bột sinh học nha khoa, hạt xương nhân tạo, màng sinh học phòng phẫu thuật y khoa vô trùng, hoặc bối cảnh phòng nha điều trị sạch sẽ.
  4. Tránh lặp lại: Đảm bảo prompt DALL-E của mỗi ảnh trong cùng một bài viết (và giữa các bài viết khác nhau) là hoàn toàn khác biệt về góc chụp, màu sắc, bối cảnh nền và góc độ để tránh trùng lặp hình ảnh.`;
  } else {
    imageInstructions = `
Vì số lượng ảnh yêu cầu là 0, mảng "images" trong kết quả JSON trả về phải là mảng RỖNG []. Không sinh bất kỳ prompt hay thông tin ảnh nào.`;
  }

  const prompt = `Bạn là một chuyên gia SEO Nha khoa hàng đầu. 
Hãy tối ưu bài viết dưới đây bằng cách:
1. Chèn tự nhiên đúng ${targetLinksCount} Backlinks vào bài viết ở các câu văn phù hợp ngữ cảnh nhất.
${promptInstructions}

Danh sách backlinks cần chèn (chọn tối đa ${targetLinksCount} link khác nhau để chèn, mỗi link chèn đúng 1 lần, KHÔNG chèn trùng lặp anchor text):
${JSON.stringify(backlinks.slice(0, targetLinksCount), null, 2)}
${imageInstructions}

Nội dung bài viết gốc cần xử lý:
---
${currentContent}
---

Hãy trả về kết quả ở định dạng JSON chuẩn. KHÔNG TRẢ VỀ code block markdown, chỉ trả về chuỗi JSON thô có cấu trúc như sau:
{
  "optimizedHtml": "Nội dung bài viết hoàn chỉnh (HTML) đã được chèn backlinks dạng <a href='url'>anchor text</a> và thẻ ảnh <img class='seo-ill' data-idx='X' src='' alt='...' /> ở vị trí thích hợp.",
  "images": [
    {
      "idx": 0,
      "type": "hero",
      "dallePrompt": "DALL-E 3 English descriptive prompt here...",
      "filename": "ten-file-anh-viet-thuong-khong-dau.webp",
      "altText": "Alt text mô tả ảnh chi tiết chuẩn SEO bằng tiếng Việt...",
      "caption": "Chú thích ngắn dưới ảnh bằng tiếng Việt (nếu có)..."
    }
  ],
  "insertedLinks": [
    {
      "url": "https://...",
      "anchorText": "...",
      "context": "Câu văn chứa link trong bài..."
    }
  ],
}`;

  let aiResponse = "";
  
  // Try Qwen if selected and key available
  if (model === "qwen" && alibabaKey) {
    try {
      console.log("Using Alibaba Qwen to optimize article structure...");
      const qwen = new OpenAI({
        apiKey: alibabaKey,
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      });
      const completion = await qwen.chat.completions.create({
        model: "qwen-plus",
        messages: [
          { role: "system", content: "You are an SEO optimizing assistant that returns strict JSON format." },
          { role: "user", content: prompt }
        ]
      }, { timeout: 90000 });
      aiResponse = completion.choices[0].message.content;
    } catch (err) {
      console.warn("Qwen optimize failed:", err.message);
    }
  }

  // Fallback to OpenAI
  if (!aiResponse && openaiKey) {
    try {
      console.log("Using OpenAI GPT-4o-mini to optimize article structure...");
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are an SEO optimizing assistant that returns strict JSON format." },
          { role: "user", content: prompt }
        ]
      }, { timeout: 90000 });
      aiResponse = completion.choices[0].message.content;
    } catch (err) {
      console.error("OpenAI optimize failed:", err.message);
      throw new Error(`Tối ưu bài viết bằng AI thất bại: ${err.message}`);
    }
  }

  if (!aiResponse) {
    throw new Error("Không thể gọi AI tối ưu bài viết. Hãy cấu hình API Key.");
  }

  // Clean JSON string
  const cleanJson = aiResponse.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  const result = JSON.parse(cleanJson);

  // Post-process audits & warnings
  if (!result.warnings) result.warnings = [];

  // Check link density
  const actualLinks = (result.optimizedHtml.match(/<a\s+[^>]*href=/g) || []).length;
  if (actualLinks > backlinks.length) {
    result.warnings.push(`CẢNH BÁO: Số lượng backlink thực tế trong bài (${actualLinks}) vượt quá cấu hình của bạn.`);
  }

  // Check anchor duplication
  const anchors = [];
  const anchorRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(result.optimizedHtml)) !== null) {
    anchors.push(match[1].toLowerCase().trim());
  }
  const uniqueAnchors = new Set(anchors);
  if (anchors.length > uniqueAnchors.size) {
    result.warnings.push("CẢNH BÁO: Có sự trùng lặp Anchor Text trong bài viết. Nên đa dạng hóa từ khóa neo.");
  }

  return {
    ...result,
    wordCount,
    recommendedImages: recs.images,
    recommendedLinks: recs.links
  };
}
