import { GoogleGenerativeAI } from "@google/generative-ai";

const key = "";
const genAI = new GoogleGenerativeAI(key);

const modelsToTest = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash"
];

async function test() {
  for (const m of modelsToTest) {
    try {
      console.log(`Testing model: ${m}...`);
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("Say 'hello' in 1 word.");
      console.log(`SUCCESS with model ${m}:`, result.response.text().trim());
      return m;
    } catch (err) {
      console.log(`FAILED with model ${m}:`, err.message);
    }
  }
  console.log("All models failed.");
  return null;
}

test();
