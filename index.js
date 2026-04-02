import express from "express";
import axios from "axios";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
const MODEL = "claude-sonnet-4-6";
const PORT = process.env.PORT || 3000;

if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

// ── Fonts ─────────────────────────────────────────────────────────────────────
const FONT_DIR = "/tmp/fonts";
const FONTS = {
  regular: path.join(FONT_DIR, "Roboto-Regular.ttf"),
  bold:    path.join(FONT_DIR, "Roboto-Bold.ttf"),
};

async function downloadFonts() {
  if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });
  const urls = {
    regular: "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf",
    bold:    "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf",
  };
  for (const [key, url] of Object.entries(urls)) {
    if (!fs.existsSync(FONTS[key])) {
      console.log(`⬇️ Downloading font: ${key}`);
      const res = await axios.get(url, { responseType: "arraybuffer" });
      fs.writeFileSync(FONTS[key], Buffer.from(res.data));
      console.log(`✅ Font saved: ${key}`);
    }
  }
}

// ── Parse Tally ───────────────────────────────────────────────────────────────
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

// ── AI Generation ─────────────────────────────────────────────────────────────
async function generateMealPlan(userData) {
  const mealsCount = parseInt(userData.meals) || 4;

  const prompt = `
Si strokovni nutricionistični asistent Gal Remec Coaching.
Ustvari 3-dnevni načrt prehrane in vrni SAMO čisti JSON brez kakršnegakoli besedila pred ali za njim.

Podatki stranke:
- Starost: ${userData.age} let
- Teža: ${userData.weight} kg
- Višina: ${userData.height} cm
- Cilj: ${userData.goal}
- Hrana ki jo rad/a je: ${userData.likes}
- Hrana ki je ne mara: ${userData.dislikes}
- Alergije/preference: ${userData.allergies}
- Število obrokov na dan: ${mealsCount}
- Dnevna aktivnost: ${userData.activity} korakov/dan

Vrni TOČNO to strukturo JSON (brez markdown, brez backtick, samo čisti JSON):
{
  "summary": {
    "calories_per_day": 2100,
    "protein_per_day": 170,
    "meals_per_day": ${mealsCount},
    "goal": "${userData.goal}",
    "plan_type": "CUT"
  },
  "adaptations": "Kratek odstavek (3-5 povedi) kaj si upošteval pri sestavi jedilnika: alergije, preference, cilj, aktivnost, starost, teža, višina. Piši v slovenščini, direktno naslavljaj stranko.",
  "intro": "Motivacijski odstavek (4-6 povedi) o pristopu, strategiji in kaj naj stranka pričakuje. Piši v slovenščini.",
  "days": [
    {
      "day": 1,
      "calories": 2100,
      "protein": 170,
      "meals": [
        {
          "number": 1,
          "name": "ZAJTRK",
          "calories": 600,
          "protein": 40,
          "ingredients": ["100 g ovsenih kosmičev", "2 jajci", "1 banana", "200 ml rastlinskega mleka"]
        }
      ]
    }
  ]
}

PRAVILA:
- Vsak dan mora imeti TOČNO ${mealsCount} obrokov
- Imena obrokov: ZAJTRK, DOPOLDANSKA MALICA, KOSILO, POPOLDANSKA MALICA, VEČERJA, POZNA VEČERJA (glede na število)
- Vsak obrok naj ima 3-6 sestavin z gramažo
- Upoštevaj alergije in preference (ne vključuj živil ki jih stranka ne mara)
- plan_type: "CUT" za hujšanje, "BULK" za pridobivanje, "MAINTAIN" za vzdrževanje
- Vrni SAMO JSON, nič drugega
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
      timeout: 120000,
    }
  );

  const textBlock = response.data?.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Anthropic vrnil prazen odgovor.");
  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── PDF Generation ────────────────────────────────────────────────────────────
const DARK_BG   = "#111111";
const DARK_CARD = "#1A1A1A";
const DARK_ROW  = "#161616";
const RED       = "#CC1F1F";
const WHITE     = "#FFFFFF";
const GRAY      = "#888888";
const LIGHT     = "#CCCCCC";

function generatePDF(userData, plan) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true,
    });

    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const W  = doc.page.width;
    const H  = doc.page.height;
    const M  = 40;
    const CW = W - M * 2;

    const fillBg = () => doc.rect(0, 0, W, H).fill(DARK_BG);
    const RB = FONTS.regular;
    const BD = FONTS.bold;

    // ── PAGE 1: Cover ──────────────────────────────────────────────────────
    fillBg();
    doc.rect(0, 0, W, 6).fill(RED);

    let y = 50;
    doc.fontSize(11).fillColor(RED).font(BD)
       .text("GAL REMEC COACHING", M, y, { align: "center", width: CW, characterSpacing: 3 });

    y += 28;
    doc.fontSize(52).fillColor(WHITE).font(BD)
       .text("MEAL", M, y, { align: "center", width: CW });
    y += 55;
    doc.fontSize(52).fillColor(WHITE).font(BD)
       .text("PLAN", M, y, { align: "center", width: CW });

    y += 58;
    const planType = `${plan.summary.plan_type} · ${plan.summary.meals_per_day}x OBROK`;
    doc.fontSize(11).fillColor(GRAY).font(RB)
       .text(planType, M, y, { align: "center", width: CW, characterSpacing: 2 });

    y += 25;
    doc.rect(M, y, CW, 2).fill(RED);

    y += 18;
    const boxW = (CW - 15) / 2;

    doc.rect(M, y, boxW, 75).fill(DARK_CARD);
    doc.fontSize(34).fillColor(WHITE).font(BD)
       .text(String(plan.summary.calories_per_day), M, y + 10, { width: boxW, align: "center" });
    doc.fontSize(9).fillColor(GRAY).font(RB)
       .text("KALORIJ NA DAN", M, y + 52, { width: boxW, align: "center", characterSpacing: 1 });

    const box2X = M + boxW + 15;
    doc.rect(box2X, y, boxW, 75).fill(DARK_CARD);
    doc.fontSize(34).fillColor(WHITE).font(BD)
       .text(`${plan.summary.protein_per_day} g`, box2X, y + 10, { width: boxW, align: "center" });
    doc.fontSize(9).fillColor(GRAY).font(RB)
       .text("BELJAKOVIN NA DAN", box2X, y + 52, { width: boxW, align: "center", characterSpacing: 1 });

    y += 93;
    doc.rect(M, y, CW, 1).fill(RED);
    y += 14;
    doc.fontSize(10).fillColor(RED).font(BD)
       .text("PRILAGODITVE JEDILNIKA", M, y, { characterSpacing: 1 });
    y += 18;
    doc.fontSize(10).fillColor(LIGHT).font(RB)
       .text(plan.adaptations, M, y, { width: CW, lineGap: 4 });
    y += doc.heightOfString(plan.adaptations, { width: CW, lineGap: 4 }) + 18;

    doc.rect(M, y, CW, 1).fill(GRAY);
    y += 14;
    doc.fontSize(10).fillColor(LIGHT).font(RB)
       .text(plan.intro, M, y, { width: CW, lineGap: 4 });
    y += doc.heightOfString(plan.intro, { width: CW, lineGap: 4 }) + 18;

    doc.rect(M, y, CW, 1).fill(GRAY);
    y += 14;
    const daysLabel = `${plan.days.length} DNI  ·  ${plan.days.length * plan.summary.meals_per_day} OBROKOV  ·  POPOLN JEDILNIK`;
    doc.fontSize(10).fillColor(WHITE).font(BD)
       .text(daysLabel, M, y, { align: "center", width: CW, characterSpacing: 1 });

    doc.rect(0, H - 6, W, 6).fill(RED);

    // ── PAGES 2+: Daily meals ──────────────────────────────────────────────
    plan.days.forEach((day) => {
      doc.addPage();
      fillBg();
      doc.rect(0, 0, W, 6).fill(RED);
      doc.rect(0, H - 6, W, 6).fill(RED);

      let dy = 25;

      doc.rect(M, dy, CW, 42).fill(RED);
      doc.fontSize(13).fillColor(WHITE).font(BD)
         .text(`DAN ${day.day}`, M + 12, dy + 8);
      doc.fontSize(10).fillColor(WHITE).font(RB)
         .text(`${day.calories} kcal  ·  ${day.protein} g beljakovin  ·  ${day.meals.length} obroki`, M + 12, dy + 26);
      doc.fontSize(9).fillColor(WHITE).font(BD)
         .text("STRENGTH AND HONOR", M, dy + 17, { width: CW - 12, align: "right", characterSpacing: 1 });

      dy += 52;

      day.meals.forEach((meal, i) => {
        const ingLines = meal.ingredients.length;
        const mealH = Math.max(85, 28 + ingLines * 18 + 16);

        if (dy + mealH > H - 50) {
          doc.addPage();
          fillBg();
          doc.rect(0, 0, W, 6).fill(RED);
          doc.rect(0, H - 6, W, 6).fill(RED);
          dy = 30;
        }

        const bg = i % 2 === 0 ? DARK_CARD : DARK_ROW;
        doc.rect(M, dy, CW, mealH).fill(bg);
        doc.rect(M, dy, 4, mealH).fill(RED);

        doc.fontSize(20).fillColor(RED).font(BD)
           .text(String(meal.number).padStart(2, "0"), M + 14, dy + 8);
        doc.fontSize(10).fillColor(WHITE).font(BD)
           .text(meal.name, M + 14, dy + 34);
        doc.fontSize(9).fillColor(GRAY).font(RB)
           .text(`${meal.calories} kcal  |  ${meal.protein} g beljakovin`, M + 14, dy + 50);

        const divX = M + 140;
        doc.rect(divX, dy + 10, 1, mealH - 20).fill(RED);

        const ingX = divX + 14;
        const ingW = CW - 140 - 20;
        meal.ingredients.forEach((ing, idx) => {
          doc.fontSize(10).fillColor(LIGHT).font(RB)
             .text(`• ${ing}`, ingX, dy + 12 + idx * 18, { width: ingW });
        });

        dy += mealH + 6;
      });
    });

    doc.end();
  });
}

// ── Send Email ────────────────────────────────────────────────────────────────
async function sendEmail(userData, pdfBuffer) {
  const base64PDF = pdfBuffer.toString("base64");
  await axios.post(
    "https://api.resend.com/emails",
    {
      from: "Meal Planner <onboarding@resend.dev>",
      to: NOTIFY_EMAIL,
      subject: `🥗 Nov načrt prehrane — ${userData.goal} | ${userData.weight}kg | ${userData.age}let`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#111;color:#fff;padding:30px;border-radius:8px;">
          <h2 style="color:#CC1F1F;">GAL REMEC COACHING</h2>
          <p>Nov načrt prehrane je pripravljen. Najdeš ga v priponki.</p>
          <table style="margin-top:16px;">
            <tr><td style="color:#888;padding:4px 12px 4px 0">Cilj:</td><td>${userData.goal}</td></tr>
            <tr><td style="color:#888;padding:4px 12px 4px 0">Teža:</td><td>${userData.weight} kg</td></tr>
            <tr><td style="color:#888;padding:4px 12px 4px 0">Višina:</td><td>${userData.height} cm</td></tr>
            <tr><td style="color:#888;padding:4px 12px 4px 0">Starost:</td><td>${userData.age} let</td></tr>
            <tr><td style="color:#888;padding:4px 12px 4px 0">Obroki:</td><td>${userData.meals}x na dan</td></tr>
            <tr><td style="color:#888;padding:4px 12px 4px 0">Aktivnost:</td><td>${userData.activity}</td></tr>
          </table>
        </div>
      `,
      attachments: [
        {
          filename: `meal-plan-${userData.goal}-${userData.weight}kg.pdf`,
          content: base64PDF,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", model: MODEL });
});

app.post("/webhook", async (req, res) => {
  console.log("📥 Webhook received");
  res.status(200).json({ received: true });

  const userData = parseTallyData(req.body);
  console.log("👤 User data:", userData);

  try {
    console.log("🤖 Generating meal plan...");
    const plan = await generateMealPlan(userData);
    console.log("✅ Meal plan generated:", plan.summary);

    console.log("📄 Generating PDF...");
    const pdfBuffer = await generatePDF(userData, plan);
    console.log("✅ PDF generated:", pdfBuffer.length, "bytes");

    await sendEmail(userData, pdfBuffer);
    console.log("📧 Email sent to:", NOTIFY_EMAIL);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
downloadFonts().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Port ${PORT} | Model: ${MODEL} | API key: ${ANTHROPIC_API_KEY ? "✅" : "❌"}`);
  });
}).catch((err) => {
  console.error("❌ Font download failed:", err.message);
  process.exit(1);
});
