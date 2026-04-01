import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ── Config ──────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6"; // ✅ Current working model (2026)
const PORT = process.env.PORT || 3000;

// Guard: crash early if no API key
if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY is not set. Check Railway environment variables.");
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract relevant fields from Tally webhook payload.
 * Tally sends fields as an array of { label, value } objects.
 */
function parseTallyData(body) {
  const fields = body?.data?.fields ?? [];
  const get = (label) =>
    fields.find((f) => f.label?.toLowerCase().includes(label.toLowerCase()))?.value ?? "ni podatka";

  return {
    name:       get("ime") || get("name"),
    goal:       get("cilj") || get("goal"),
    calories:   get("kalorij") || get("calorie"),
    meals:      get("obrokov") || get("meal"),
    allergies:  get("alergij") || get("allerg"),
    diet:       get("dieta") || get("diet"),
    weight:     get("teža") || get("weight"),
    height:     get("višina") || get("height"),
    age:        get("starost") || get("age"),
    activity:   get("aktivnost") || get("activity"),
  };
}

/**
 * Call Anthropic API with a built prompt.
 * Returns the AI response text or throws.
 */
async function generateMealPlan(userData) {
  const prompt = `
Si strokovni nutricionistični asistent znamke Gal Remec Coaching ("Strength and Honor").
Ustvari PERSONALIZIRAN tedenski načrt prehrane za stranko.

PODATKI STRANKE:
- Ime: ${userData.name}
- Cilj: ${userData.goal}
- Kalorije na dan: ${userData.calories} kcal
- Število obrokov: ${userData.meals}
- Alergije/intoleracije: ${userData.allergies}
- Tip diete: ${userData.diet}
- Teža: ${userData.weight} kg
- Višina: ${userData.height} cm
- Starost: ${userData.age} let
- Aktivnost: ${userData.activity}

NAVODILA:
- Načrt mora biti praktičen, enostaven za sledenje in uravnotežen.
- Za vsak dan navedi vse obroke z gramažo sestavin.
- Dodaj dnevne makrohranilce (beljakovine, ogljikovi hidrati, maščobe).
- Na koncu dodaj 3 ključne prehranske nasvete za ta profil.
- Piši v slovenščini, v tonu motivatorja in strokovnjaka.
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
      timeout: 60000, // 60s timeout
    }
  );

  // Extract text from response
  const textBlock = response.data?.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Anthropic returned no text content.");
  return textBlock.text;
}

/** Fallback meal plan if AI fails */
function fallbackMealPlan(userData) {
  return `
Pozdravljeni, ${userData.name}!

Žal je prišlo do tehnične težave pri generiranju vašega personaliziranega načrta.

Vaš cilj (${userData.goal}) je dosegljiv! Medtem priporočamo:
1. Zajtrk: ovseni kosmiči + beljakovinski shake
2. Kosilo: piščančje prsi + riž + zelenjava
3. Večerja: jajca + zelena solata

Naša ekipa vas bo kontaktirala v 24 urah z vašim personaliziranim načrtom.

— Ekipa Gal Remec Coaching 💪
`.trim();
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "ok", model: MODEL, timestamp: new Date().toISOString() });
});

app.post("/webhook", async (req, res) => {
  console.log("📥 Webhook received:", JSON.stringify(req.body, null, 2));

  // Always respond 200 to Tally immediately (prevents retries)
  res.status(200).json({ received: true });

  // Parse user data from Tally payload
  const userData = parseTallyData(req.body);
  console.log("👤 Parsed user data:", userData);

  try {
    console.log(`🤖 Calling Anthropic API (model: ${MODEL})...`);
    const mealPlan = await generateMealPlan(userData);
    console.log("✅ Meal plan generated successfully.");
    console.log("📋 Result (first 300 chars):", mealPlan.slice(0, 300));

    // TODO: send mealPlan via email / WhatsApp / save to DB
    // e.g. await sendEmail(userData.email, mealPlan);

  } catch (err) {
    // Log the full Anthropic error details
    if (err.response) {
      console.error("❌ Anthropic API error:", {
        status:  err.response.status,
        data:    err.response.data,
      });
    } else {
      console.error("❌ Unexpected error:", err.message);
    }

    const fallback = fallbackMealPlan(userData);
    console.log("⚠️ Using fallback meal plan.");
    console.log(fallback);

    // TODO: send fallback via email / WhatsApp
  }
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Model: ${MODEL}`);
  console.log(`🔑 API key: ${ANTHROPIC_API_KEY ? "✅ set" : "❌ MISSING"}`);
});
```

---

**Key fixes vs. your old code:**

| Problem | Fix |
|---|---|
| `not_found_error` | Use `claude-sonnet-4-6` — correct 2026 model string |
| Server crashes on AI error | `try/catch` + fallback, and `res.json()` fires **before** the AI call |
| Tally webhook retries | `res.status(200)` sent immediately, AI runs async after |
| API key not validated | `process.exit(1)` at startup if key is missing |
| Timeout hanging | `timeout: 60000` on axios call |

**Railway env variable to set:**
```
ANTHROPIC_API_KEY=sk-ant-...
