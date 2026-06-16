import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import axios from "axios";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Curated high-quality dental stock backgrounds categorized by topic
const DENTAL_BACKGROUNDS_IMPLANT = [
  "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1616391182219-e080b4d1043a?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1551843073-4a9a5b6fcd5f?w=1200&h=800&fit=crop"
];

const DENTAL_BACKGROUNDS_BONE = [
  "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1616391182219-e080b4d1043a?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1551843073-4a9a5b6fcd5f?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1629909615184-74f495363b67?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1200&h=800&fit=crop"
];

const DENTAL_BACKGROUNDS_GENERAL = [
  "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1616391182219-e080b4d1043a?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1631248055158-edec7a3c072b?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1551843073-4a9a5b6fcd5f?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=1200&h=800&fit=crop",
  "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=1200&h=800&fit=crop"
];

// Helper to convert base64 to buffer
function base64ToBuffer(base64Str) {
  if (!base64Str) return null;
  const cleanBase64 = base64Str.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(cleanBase64, "base64");
}

/**
 * Removes white/light gray background from an image using a queue-based flood fill algorithm
 * starting from the boundaries. Preserves shiny white highlights in the interior.
 */
async function removeWhiteBackground(imageBuffer) {
  try {
    const sharpImg = sharp(imageBuffer);
    const { data, info } = await sharpImg.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    
    const visited = new Uint8Array(width * height);
    const queue = [];
    
    // Check if pixel is light (background candidate)
    const isLight = (x, y) => {
      const idx = (y * width + x) * 4;
      if (idx >= data.length) return false;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      return r > 220 && g > 220 && b > 220;
    };
    
    // Push all border pixels to queue if they are light
    for (let x = 0; x < width; x++) {
      if (isLight(x, 0)) {
        queue.push([x, 0]);
        visited[x] = 1;
      }
      const yBottom = height - 1;
      if (isLight(x, yBottom)) {
        queue.push([x, yBottom]);
        visited[yBottom * width + x] = 1;
      }
    }
    for (let y = 1; y < height - 1; y++) {
      if (isLight(0, y)) {
        queue.push([0, y]);
        visited[y * width] = 1;
      }
      const xRight = width - 1;
      if (isLight(xRight, y)) {
        queue.push([xRight, y]);
        visited[y * width + xRight] = 1;
      }
    }
    
    // Flood fill
    let head = 0;
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      const idx = (cy * width + cx) * 4;
      data[idx + 3] = 0; // Transparent
      
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && isLight(nx, ny)) {
            visited[nIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
    
    // Edge feathering to prevent pixelated outlines
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const nIdx = y * width + x;
        if (visited[nIdx]) continue;
        
        let nearTransparent = false;
        for (const [dx, dy] of dirs) {
          if (visited[(y + dy) * width + (x + dx)]) {
            nearTransparent = true;
            break;
          }
        }
        
        if (nearTransparent) {
          const idx = nIdx * 4;
          const r = data[idx];
          const g = data[idx+1];
          const b = data[idx+2];
          const minVal = Math.min(r, g, b);
          if (minVal > 180) {
            const alphaFactor = (255 - minVal) / (255 - 180);
            data[idx + 3] = Math.round(255 * Math.max(0.1, alphaFactor));
          }
        }
      }
    }
    
    return await sharp(data, {
      raw: {
        width,
        height,
        channels: 4
      }
    }).png().toBuffer();
  } catch (err) {
    console.error("Failed to remove white background, falling back to original:", err);
    return imageBuffer;
  }
}

/**
 * Returns a contextual curated Unsplash background URL based on prompt keywords, avoiding duplicates.
 */
export function getCuratedBackground(promptText = "", excludeUrls = []) {
  const text = (promptText || "").toLowerCase();
  
  const boneKeywords = ["bột xương", "ghép xương", "bone graft", "graft", "collagen", "màng", "bone powder", "biomaterial", "material", "gbr"];
  const implantKeywords = ["implant", "trụ", "ren", "thread", "jawbone", "khớp nối", "abutment", "fixture", "răng", "tooth", "teeth"];
  
  const hasBone = boneKeywords.some(kw => text.includes(kw));
  const hasImplant = implantKeywords.some(kw => text.includes(kw));
  
  let list = [];
  let categoryName = "";
  
  if (hasBone) {
    categoryName = "Bone Graft / GBR";
    list = DENTAL_BACKGROUNDS_BONE;
  } else if (hasImplant) {
    categoryName = "Dental Implant";
    list = DENTAL_BACKGROUNDS_IMPLANT;
  } else {
    categoryName = "General Dental Clinic";
    list = DENTAL_BACKGROUNDS_GENERAL;
  }
  
  // Filter out already used backgrounds
  const excludeList = Array.isArray(excludeUrls) ? excludeUrls : [];
  let available = list.filter(url => !excludeList.includes(url));
  
  // Fallback if all are used
  if (available.length === 0) {
    console.log(`[ImageComposer] All background URLs in category '${categoryName}' were already used. Resetting exclusions.`);
    available = list;
  }
  
  const selectedUrl = available[Math.floor(Math.random() * available.length)];
  console.log(`[ImageComposer] Selected background for prompt "${promptText.substring(0, 50)}...": ${selectedUrl} (Category: ${categoryName})`);
  return selectedUrl;
}

/**
 * Generates background using DALL-E (or fallback stock image) and composites it with product image and logo overlays.
 */
export async function generateAndCompositeImage({
  openaiKey,
  leonardoKey,
  imageModel = "unsplash",
  prompt,
  productImage, // Base64
  logo1,        // Base64
  logo2,        // Base64
  width = 1200,
  height = 800,
  logoPosition = "bottom-right",
  logoScale = 15,
  logo1Position = "top-left",
  logo1Scale = 12,
  logo2Position = "bottom-right",
  logo2Scale = 15,
  hasLogos = true,
  filename = "dental-illustration.webp",
  excludeUrls = []
}) {
  let bgBuffer = null;

  if (imageModel === "leonardo") {
    if (!leonardoKey || leonardoKey.trim() === "") {
      throw new Error("Khóa API Leonardo.ai trống hoặc chưa được cấu hình.");
    }
    try {
      console.log(`[ImageComposer] Calling Leonardo.ai to generate background for prompt: "${prompt}"`);
      const modelId = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3"; // Phoenix 1.0 default
      let leoWidth = 1024;
      let leoHeight = 768;
      if (width === height) {
        leoWidth = 1024;
        leoHeight = 1024;
      } else if (height > width) {
        leoWidth = 768;
        leoHeight = 1024;
      }

      const postRes = await axios.post("https://cloud.leonardo.ai/api/rest/v1/generations", {
        prompt: prompt,
        modelId: modelId,
        width: leoWidth,
        height: leoHeight,
        num_images: 1
      }, {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${leonardoKey}`
        },
        timeout: 20000
      });

      if (postRes.data && postRes.data.sdGenerationJob && postRes.data.sdGenerationJob.generationId) {
        const genId = postRes.data.sdGenerationJob.generationId;
        console.log(`[ImageComposer] Leonardo generation started. Job ID: ${genId}. Polling status...`);

        let status = "PENDING";
        let imageUrl = null;
        let attempts = 0;

        while (status !== "COMPLETE" && attempts < 30) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));

          const pollRes = await axios.get(`https://cloud.leonardo.ai/api/rest/v1/generations/${genId}`, {
            headers: {
              accept: "application/json",
              authorization: `Bearer ${leonardoKey}`
            },
            timeout: 10000
          });

          const job = pollRes.data?.generations_by_pk;
          status = job?.status;
          console.log(`[ImageComposer] Polling Leonardo job ${genId} (Attempt ${attempts}): ${status}`);

          if (status === "COMPLETE") {
            if (job.generated_images && job.generated_images.length > 0) {
              imageUrl = job.generated_images[0].url;
            }
            break;
          } else if (status === "FAILED") {
            throw new Error("Leonardo status returned FAILED");
          }
        }

        if (imageUrl) {
          console.log(`[ImageComposer] Downloading image from Leonardo URL: ${imageUrl}`);
          const downloadResponse = await axios.get(imageUrl, { 
            responseType: "arraybuffer",
            timeout: 20000
          });
          bgBuffer = Buffer.from(downloadResponse.data);
          console.log("[ImageComposer] Leonardo image loaded successfully!");
        } else {
          throw new Error("Leonardo image URL was empty");
        }
      } else {
        throw new Error(`Leonardo response did not contain sdGenerationJob: ${JSON.stringify(postRes.data)}`);
      }
    } catch (leoErr) {
      const errMsg = leoErr.response?.data?.error || leoErr.message;
      throw new Error(`Tạo ảnh Leonardo.ai thất bại: ${errMsg}`);
    }
  } else if (imageModel === "dalle3") {
    if (!openaiKey || openaiKey.trim() === "") {
      throw new Error("Khóa API OpenAI trống hoặc chưa được cấu hình.");
    }
    try {
      console.log(`[ImageComposer] Calling OpenAI DALL-E 3 to generate background for prompt: "${prompt}"`);
      const openai = new OpenAI({ apiKey: openaiKey });
      
      let dalleSize = "1024x1024";
      if (width > height) {
        dalleSize = "1792x1024";
      } else if (height > width) {
        dalleSize = "1024x1792";
      }

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: dalleSize,
        response_format: "b64_json"
      });
      
      if (response && response.data && response.data[0] && response.data[0].b64_json) {
        bgBuffer = Buffer.from(response.data[0].b64_json, "base64");
        console.log("[ImageComposer] DALL-E 3 background generated successfully!");
      } else {
        throw new Error("OpenAI DALL-E response did not contain image data");
      }
    } catch (dalleErr) {
      throw new Error(`Tạo ảnh DALL-E 3 thất bại: ${dalleErr.message}`);
    }
  } else {
    // Unsplash
    const selectedBackgroundUrl = getCuratedBackground(prompt, excludeUrls);
    if (excludeUrls && Array.isArray(excludeUrls)) {
      excludeUrls.push(selectedBackgroundUrl);
    }
    console.log("Downloading curated dental stock background image:", selectedBackgroundUrl);
    const downloadResponse = await axios.get(selectedBackgroundUrl, { 
      responseType: "arraybuffer",
      timeout: 20000
    });
    bgBuffer = Buffer.from(downloadResponse.data);
  }

  // 2. Setup Sharp Compositor with target width and height
  let image = sharp(bgBuffer).resize(width, height, { fit: "cover" });
  const composites = [];

  // 3. Composite Product Image (Background-removed with soft drop shadow for natural blending)
  const productBuf = base64ToBuffer(productImage);
  if (productBuf) {
    try {
      console.log("Compositing background-removed product image onto background...");
      // 3.1. Resize original to target composition size (roughly 55% of canvas height)
      const targetHeight = Math.round(height * 0.55);
      const resizedOriginal = await sharp(productBuf)
        .resize({ height: targetHeight, fit: "contain" })
        .toBuffer();

      // 3.2. Run flood-fill transparent background removal
      const transparentProduct = await removeWhiteBackground(resizedOriginal);

      // 3.3. Extract dimensions of transparent product
      const productMeta = await sharp(transparentProduct).metadata();
      const prodW = productMeta.width;
      const prodH = productMeta.height;

      // 3.4. Generate soft drop shadow matching the product contour
      const shadowMask = await sharp(transparentProduct)
        .extractChannel('alpha')
        .toBuffer();

      const blackImage = await sharp({
        create: {
          width: prodW,
          height: prodH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
      })
      .composite([{ input: shadowMask, blend: 'dest-in' }])
      .png()
      .toBuffer();

      const blurredShadow = await sharp(blackImage)
        .blur(10)
        .png()
        .toBuffer();

      // 3.5. Position naturally on the left third of the canvas, vertically centered
      const left = Math.round(width * 0.12);
      const top = Math.round((height - prodH) / 2);

      // Push shadow first with slight offset
      composites.push({
        input: blurredShadow,
        left: left + 12,
        top: top + 15
      });

      // Push product image on top
      composites.push({
        input: transparentProduct,
        left: left,
        top: top
      });
    } catch (err) {
      console.error("Failed to composite background-removed product, falling back to original card layout:", err);
      // Fallback: draw inside white box if anything fails
      const cardWidth = Math.round(width * 0.32);
      const cardHeight = Math.round(height * 0.52);
      const innerPadding = 16;
      const prodImgWidth = cardWidth - innerPadding * 2;
      const prodImgHeight = cardHeight - innerPadding * 2;
      const resizedProduct = await sharp(productBuf)
        .resize(prodImgWidth, prodImgHeight, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .toBuffer();
      const cardSvg = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}"><rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" rx="12" ry="12" fill="white" fill-opacity="0.92" stroke="#e2e8f0" stroke-width="1.5" /></svg>`);
      const cardComposite = await sharp(cardSvg).composite([{ input: resizedProduct, left: innerPadding, top: innerPadding }]).toBuffer();
      composites.push({
        input: cardComposite,
        left: Math.round(width * 0.05),
        top: Math.round(height * 0.43)
      });
    }
  }

  // 4. Composite Logo(s) with scaling and custom position
  if (hasLogos) {
    const logo1Buf = base64ToBuffer(logo1);
    const logo2Buf = base64ToBuffer(logo2);

    const pos1 = logo1Position || logoPosition || "top-left";
    const scale1 = logo1Scale !== undefined ? logo1Scale : logoScale || 12;
    const pos2 = logo2Position || logoPosition || "bottom-right";
    const scale2 = logo2Scale !== undefined ? logo2Scale : logoScale || 15;

    let logo1WidthActual = 0;

    // Logo 1
    if (logo1Buf) {
      console.log(`Compositing logo 1 onto canvas at position: ${pos1}...`);
      const targetLogoWidth = Math.round(width * (scale1 / 100));
      const resizedLogo = await sharp(logo1Buf).resize({ width: targetLogoWidth }).toBuffer();
      const metadata = await sharp(resizedLogo).metadata();
      const logoW = metadata.width;
      const logoH = metadata.height;
      logo1WidthActual = logoW;

      let left = 24, top = 24;
      if (pos1 === "top-left") { left = 24; top = 24; }
      else if (pos1 === "top-right") { left = width - logoW - 24; top = 24; }
      else if (pos1 === "bottom-left") { left = 24; top = height - logoH - 24; }
      else if (pos1 === "bottom-right") { left = width - logoW - 24; top = height - logoH - 24; }
      else if (pos1 === "center-footer") { left = Math.round((width - logoW) / 2); top = height - logoH - 24; }

      composites.push({ input: resizedLogo, left, top });
    }

    // Logo 2
    if (logo2Buf) {
      console.log(`Compositing logo 2 onto canvas at position: ${pos2}...`);
      const targetLogoWidth = Math.round(width * (scale2 / 100));
      const resizedLogo = await sharp(logo2Buf).resize({ width: targetLogoWidth }).toBuffer();
      const metadata = await sharp(resizedLogo).metadata();
      const logoW = metadata.width;
      const logoH = metadata.height;

      let left = 24, top = 24;
      if (pos2 === "top-left") { left = 24; top = 24; }
      else if (pos2 === "top-right") { left = width - logoW - 24; top = 24; }
      else if (pos2 === "bottom-left") { left = 24; top = height - logoH - 24; }
      else if (pos2 === "bottom-right") { left = width - logoW - 24; top = height - logoH - 24; }
      else if (pos2 === "center-footer") { left = Math.round((width - logoW) / 2); top = height - logoH - 24; }

      // Stacking logic if both logos occupy exactly the same position
      if (logo1Buf && pos1 === pos2) {
        if (pos2.includes("right")) {
          // Shift Logo 2 to the left of Logo 1
          left = left - logo1WidthActual - 16;
        } else {
          // Shift Logo 2 to the right of Logo 1
          left = left + logo1WidthActual + 16;
        }
      }

      composites.push({ input: resizedLogo, left, top });
    }
  }

  // Apply all overlays
  if (composites.length > 0) {
    image = image.composite(composites);
  }

  // 5. Save final WebP output
  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const outputPath = path.join(uploadsDir, filename);
  await image.webp({ quality: 85 }).toFile(outputPath);
  console.log(`Successfully designed & saved branded image to ${outputPath}`);

  // Return the public relative URL
  return `/uploads/${filename}`;
}
