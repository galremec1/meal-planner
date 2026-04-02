import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const PORT = process.env.PORT || 3000;

if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

function parseTallyData(body) {
  const fields = body?.data?.fields ?? [];
  const get = (label) =>
    fields.find((f) => f.label?.toLowerCase().includes(label.toLowerCase()))?.value ?? "ni podatka";

  return {
    age:       get("starost"),
    weight:    get("teža"),
    height:    get("višina"),
    goal:      get("cilj"),
    likes:     get("kaj rad"),
    dislikes:  get("ne maraš"),
    meals:     get("koliko obrokov"),
    allergies: get("alergije") || get("dodaj še"),
    activity:  get("korakov"),
  };
}

async function generateMealPlan(userData) {
  const prompt = `
Si strokovni nutricionistični asistent znamke Gal Remec Coaching (Strength and Honor).
Ustvari personaliziran tedenski načrt prehrane za stranko.

Starost: ${userData.age} let
Teža: ${userData.weight} kg
Višina: ${userData.height} cm
Cilj: ${userData.goal}
Hrana ki jo rad/a je: ${userData.likes}
Hrana ki je ne mara: ${userData.dislikes}
Število obrokov na dan: ${userData.meals}
Alergije/preference: ${userData.allergies}
Dnevna aktivnost (koraki): ${userData.activity}

Napiši praktičen tedenski načrt z gramažo sestavin, dnevnimi makrohranilci (beljakovine, OH, maščobe) in 3 ključnimi nasveti za ta profil. Piši v slovenščini, v motivacijskem tonu.
`.trim();

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      timeout: 60000,
    }
  );

  const textBlock = response.data?.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Anthropic vrnil prazen odgovor.");
  return textBlock.text;
}

function fallbackMealPlan(userData) {
  return `Pozdravljeni! Prišlo je do tehnične težave. Naša ekipa vas bo kontaktirala v 24 urah z vašim personaliziranim načrtom. — Gal Remec Coaching 💪`;
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
    // TODO: pošlji mealPlan po emailu ali WhatsApp
  } catch (err) {
    console.error("❌ AI error:", err.response?.data || err.message);
    console.log("⚠️ Fallback:", fallbackMealPlan(userData));
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Port ${PORT} | Model: ${MODEL} | API key: ${ANTHROPIC_API_KEY ? "✅" : "❌"}`);
});
