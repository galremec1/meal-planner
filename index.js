import express from "express";
import axios from "axios";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
const MODEL = "claude-sonnet-4-6";
const PORT = process.env.PORT || 3000;

if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

function parseTallyData(body) {
  const fields = body?.data?.fields ?? [];
  const get = (label) =>
    fields.find((f) => f.label?.toLowerCase().includes(label.toLowerCase()))?.value ?? "ni podatka";

  const getChoice = (label) => {
    const field = fields.find((f) => f.label?.toLowerCase().includes(label.toLowerCase()));
    if (!field) return "ni podatka";
    const options = field.options ?? [];
    const selected = Array.isArray(field.value) ? field.value : [field.value];
    const matched = options.filter((o) => selected.includes(o.id)).map((o) => o.text);
    return matched.length > 0 ? matched.join(", ") : "ni podatka";
  };

  return {
    age:       get("starost"),
    weight:    get("teža"),
    height:    get("višina"),
    goal:      get("cilj"),
    likes:     get("kaj rad"),
    dislikes:  get("ne maraš"),
    meals:     get("koliko obrokov"),
    allergies: get("alergije") || get("dodaj še"),
    activity:  getChoice("korakov"),
  };
}

async function generateMealPlan(userData) {
  const prompt = `
Si nutricionistični asistent Gal Remec Coaching. Ustvari 3-dnevni načrt prehrane.

Starost: ${userData.age} let | Teža: ${userData.weight} kg | Višina: ${userData.height} cm
Cilj: ${userData.goal} | Obroki/dan: ${userData.meals}
Rad je: ${userData.likes} | Ne mara: ${userData.dislikes}
Alergije: ${userData.allergies} | Aktivnost: ${userData.activity} korakov/dan

Napiši konkreten 3-dnevni načrt z gramažo, dnevnimi makri in 2 nasveta. Slovenščina, motivacijski ton.
`.trim();

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      timeout: 120000,
    }
  );

  const textBlock = response.data?.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Anthropic vrnil prazen odgovor.");
  return textBlock.text;
}

async function sendEmail(userData, mealPlan) {
  await transporter.sendMail({
    from: GMAIL_USER,
    to: NOTIFY_EMAIL,
    subject: `🥗 Nov načrt prehrane — ${userData.goal} | ${userData.weight}kg | ${userData.age}let`,
    text: `
PODATKI STRANKE:
Starost: ${userData.age} let
Teža: ${userData.weight} kg
Višina: ${userData.height} cm
Cilj: ${userData.goal}
Rad je: ${userData.likes}
Ne mara: ${userData.dislikes}
Obroki/dan: ${userData.meals}
Alergije: ${userData.allergies}
Aktivnost: ${userData.activity} korakov/dan

---

NAČRT PREHRANE:

${mealPlan}
    `.trim(),
  });
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", model: MODEL });
});

app.post("/webhook", async (req, res) => {
  console.log("📥 Webhook received:", JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });

  const userData = parseTallyData(req.body);
  console.log("👤 User data:", userData);

  try {
    const mealPlan = await generateMealPlan(userData);
    console.log("✅ Meal plan generated:", mealPlan.slice(0, 300));

    await sendEmail(userData, mealPlan);
    console.log("📧 Email sent to:", NOTIFY_EMAIL);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Port ${PORT} | Model: ${MODEL} | API key: ${ANTHROPIC_API_KEY ? "✅" : "❌"}`);
});
