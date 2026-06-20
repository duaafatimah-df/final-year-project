const axios = require('axios');

async function run() {
  try {
    console.log("Sending GET request to http://localhost:5000/api/ai/demand-forecast...");
    const res = await axios.get('http://localhost:5000/api/ai/demand-forecast');
    console.log("STATUS:", res.status);
    console.log("BODY:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("REQUEST FAILED!");
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error("Error Message:", err.message);
    }
  }
}

run();
