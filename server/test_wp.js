import axios from "axios";

const wpUrl = "https://maxdent.vn";
const wpUser = "haison45";
const wpAppPassword = "HaiSon@Maxdent_TD45";

const authHeader = `Basic ${Buffer.from(`${wpUser}:${wpAppPassword}`).toString("base64")}`;

async function test() {
  try {
    console.log("Testing connection to WordPress at:", wpUrl);
    const response = await axios.get(`${wpUrl}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: authHeader }
    });
    console.log("SUCCESS! Connected as user:", response.data.name);
  } catch (error) {
    console.error("ERROR connection failed!");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Message:", error.message);
    }
  }
}

test();
