require("dotenv").config();
const express = require("express");

const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("TALLY DATA:", req.body);
  res.send("Webhook dela");
});

app.get("/", (req, res) => {
  res.send("Server dela");
});

app.listen(3000, () => console.log("running"));
