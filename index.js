require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server dela");
});

app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    console.log("TALLY DATA:", data);

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-haiku-latest",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Naredi meal plan: ${JSON.stringify(data)}`
          }
        ]
      },
      {
        headers: {
          "x-api-key": process.env.CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        }
      }
    );

    const result = response.data.content[0].text;

    console.log("MEAL PLAN:", result);

    res.send("OK");

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.status(500).send("error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Running on port " + PORT);
});
