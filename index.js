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
    name:      get("ime") || get("name"),
    goal:      get("cilj") || get("goal"),
    calories:  get("kalorij") || get("calorie"),
    meals:     get("obrokov") || get("meal"),
    allergies: get("alergij") || get("allerg"),
    diet:      get("dieta") || get("diet"),
    weight:    get("teža") || get("weight"),
    height:    get("višina") || get("height"),
    age:       get("starost") || get("age"),
    activity:  get("aktivnost") || get("activity"),
  };
}

async function generateMealPlan(userData) {
  const prompt = `
Si strokovni nutricionistični asistent znamke Gal Remec Coaching.
Ustvari personaliziran tedenski načrt prehrane za stranko.

Ime: ${userData.name}
Cilj: ${userData.goal}
Kalorije: ${userData.calories} kcal
Obroki: ${userData.meals}
Alergije: ${userData.allergies}
Dieta: ${userData.diet}
Teža: ${userData.weight} kg
Višina: ${userData.height} cm
Starost: ${userData.age} let
Aktivnost: ${userData.activity}

Napiši praktičen tedenski načrt z gramažo sestavin, dnevnimi makrohranilci in 3 nasveti. Piši v slovenščini.
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
  return `Pozdravljeni, ${userData.name}! Prišlo je do tehnične težave. Naša ekipa vas bo kontaktirala v 24 urah z vašim personaliziranim načrtom. — Gal Remec Coaching 💪`;
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
  } catch (err) {
    console.error("❌ AI error:", err.response?.data || err.message);
    console.log("⚠️ Fallback:", fallbackMealPlan(userData));
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Port ${PORT} | Model: ${MODEL} | API key: ${ANTHROPIC_API_KEY ? "✅" : "❌"}`);
});
