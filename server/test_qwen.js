import OpenAI from "openai";

const alibabaKey = "";

const qwen = new OpenAI({
  apiKey: alibabaKey,
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
});

async function run() {
  try {
    console.log("Testing Alibaba Cloud Model Studio (Qwen)...");
    const completion = await qwen.chat.completions.create({
      model: "qwen-plus",
      messages: [
        { role: "user", content: "Say 'Hello from Qwen' in 3 words." }
      ]
    });
    console.log("SUCCESS! Qwen responded:", completion.choices[0].message.content);
  } catch (err) {
    console.error("ERROR running Qwen:", err.message);
  }
}

run();
