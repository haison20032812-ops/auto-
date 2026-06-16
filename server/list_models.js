import axios from "axios";

const key = "";

async function run() {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    console.log("Models list:");
    res.data.models.forEach(m => console.log(m.name));
  } catch (err) {
    console.error("Error listing models:", err.response ? err.response.data : err.message);
  }
}

run();
