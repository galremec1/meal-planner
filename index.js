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

// ── Colors ────────────────────────────────────────────────────────────────────
const DARK_BG   = "#111111";
const DARK_CARD = "#1A1A1A";
const DARK_ROW  = "#161616";
const RED       = "#CC1F1F";
const WHITE     = "#FFFFFF";
const GRAY      = "#888888";
const LIGHT     = "#CCCCCC";

// ══════════════════════════════════════════════════════════════════════════════
// MEAL PLAN
// ══════════════════════════════════════════════════════════════════════════════

const FOOD_DB = `
MESO IN PERUTNINA (na 100g surovo):
Piščančja prsa: 110kcal, 23g B | Piščančja stegna (brez kosti): 160kcal, 19g B | Puranja prsa: 114kcal, 24g B | Goveji zrezek (pusto): 150kcal, 22g B | Goveje meso mleto 5%: 135kcal, 21g B | Goveje meso mleto 20%: 250kcal, 17g B | Svinjski file: 143kcal, 21g B | Svinjski zrezek: 145kcal, 21g B | Teletina: 110kcal, 20g B | Jagnjetina pusto: 200kcal, 20g B | Srna: 120kcal, 22g B | Jelenjad: 125kcal, 22g B | Raca prsa brez kože: 130kcal, 20g B

MESNI IZDELKI (na 100g):
Kuhan pršut/šunka: 110kcal, 18g B | Puranja šunka: 90kcal, 17g B | Piščančja prsa v ovitku: 85kcal, 16g B | Kraški pršut: 260kcal, 26g B | Hrenovka: 280kcal, 12g B | Piščančja hrenovka: 220kcal, 13g B | Čevapčiči surovi: 250kcal, 15g B | Pleskavica: 240kcal, 16g B

RIBE IN MORSKI SADEŽI (na 100g):
Losos svež: 208kcal, 20g B | Tuna svež: 130kcal, 29g B | Tuna v lastnem soku: 116kcal, 25g B | Tuna v olju odcejena: 198kcal, 24g B | Skuša sveža: 305kcal, 19g B | Oslić: 90kcal, 17g B | Postrv: 148kcal, 21g B | Brancin: 97kcal, 18g B | Sardine v olju: 208kcal, 24g B | Tilapija: 128kcal, 26g B | Trska: 82kcal, 18g B | Kozice: 99kcal, 24g B | Losos prekajen: 117kcal, 23g B

MLEČNI IZDELKI (na 100g):
Mleko 3.5%: 64kcal, 3.3g B | Mleko 1.5%: 47kcal, 3.4g B | Grški jogurt 0%: 59kcal, 10g B | Grški jogurt 2%: 75kcal, 9.5g B | Skyr: 65kcal, 11g B | Pusta skuta: 72kcal, 12g B | Sir Cottage light: 70kcal, 12g B | Sir Cottage: 98kcal, 11g B | Mozzarella light: 165kcal, 20g B | Mozzarella polnomastna: 280kcal, 20g B | Parmezan: 431kcal, 38g B | Feta: 264kcal, 14g B | Sojin jogurt: 50kcal, 4g B | Ovseni napitek: 42kcal, 1g B | Mandljev napitek: 13kcal, 0.4g B | Sojin napitek: 33kcal, 3.3g B | Kefir: 62kcal, 3.3g B

JAJCA (na 100g):
Kokošje jajce celo: 155kcal, 13g B | Jajčni beljak: 52kcal, 11g B | Jajčni rumenjak: 322kcal, 16g B

ZELENJAVA (na 100g surovo):
Brokoli: 34kcal, 2.8g B | Špinača: 23kcal, 2.9g B | Paprika rdeča: 31kcal, 1g B | Paprika zelena: 20kcal, 0.9g B | Kumara: 15kcal, 0.7g B | Paradižnik: 18kcal, 0.9g B | Korenje: 41kcal, 0.9g B | Zelje belo: 25kcal, 1.3g B | Rukola: 25kcal, 2.6g B | Cvetača: 25kcal, 1.9g B | Bučka: 17kcal, 1.2g B | Stročji fižol: 31kcal, 1.8g B | Grah zelen: 81kcal, 5.4g B | Šparglji: 20kcal, 2.2g B | Šampinjoni: 22kcal, 3.1g B | Čebula: 40kcal, 1.1g B | Sladki krompir surovi: 86kcal, 1.6g B | Rdeča pesa: 43kcal, 1.6g B | Koruza sladka: 86kcal, 3.2g B | Ledenka solata: 14kcal, 0.9g B | Zelena solata: 14kcal, 1.2g B

STROČNICE (na 100g):
Fižol kuhan: 127kcal, 8.7g B | Čičerika kuhana: 164kcal, 8.9g B | Leča kuhana: 116kcal, 9g B | Tofu trd: 144kcal, 15g B | Tempeh: 192kcal, 19g B | Edamame kuhana: 121kcal, 11.9g B | Humus: 300kcal, 7g B | Sojini koščki: 330kcal, 50g B

SADJE (na 100g):
Banana: 89kcal, 1.1g B | Jabolko: 52kcal, 0.3g B | Hruška: 57kcal, 0.4g B | Jagode: 32kcal, 0.7g B | Borovnice: 57kcal, 0.7g B | Maline: 52kcal, 1.2g B | Pomaranča: 47kcal, 0.9g B | Avokado: 160kcal, 2g B | Mango: 60kcal, 0.8g B | Kivi: 61kcal, 1.1g B | Grozdje: 69kcal, 0.7g B | Breskev: 39kcal, 0.9g B | Lubenica: 30kcal, 0.6g B

ŽITA IN OGLJIKOVI HIDRATI (na 100g suho/surovo):
Beli riž: 360kcal, 7g B | Rjavi riž: 367kcal, 7.5g B | Basmati riž: 345kcal, 8.5g B | Ovseni kosmiči: 389kcal, 13.5g B | Testenine bele: 350kcal, 12g B | Polnozrnate testenine: 340kcal, 14g B | Krompir surovi: 77kcal, 2g B | Kvinoja: 368kcal, 14g B | Ajdova kaša: 343kcal, 13g B | Kuskus: 376kcal, 12.8g B | Bulgur: 342kcal, 12.3g B | Polenta: 362kcal, 7.5g B

KRUH IN PECIVO (na 100g):
Beli kruh: 266kcal, 8.8g B | Polnozrnati kruh: 250kcal, 9.7g B | Rženi kruh: 259kcal, 8.5g B | Toast beli: 285kcal, 8.3g B | Toast polnozrnat: 260kcal, 9g B | Tortilja pšenična: 310kcal, 8g B | Riževi vaflji: 385kcal, 8g B

OREŠČKI IN SEMENA (na 100g):
Mandlji: 579kcal, 21g B | Orehi: 654kcal, 15g B | Arašidi praženi: 587kcal, 26g B | Indijski oreščki: 553kcal, 18g B | Arašidovo maslo: 588kcal, 25g B | Chia semena: 486kcal, 17g B | Lanena semena: 534kcal, 18g B | Sončnična semena: 584kcal, 21g B | Bučna semena: 559kcal, 30g B

OLJA IN MAŠČOBE (na 100g):
Oljčno olje: 884kcal, 0g B | Maslo: 717kcal, 0.8g B | Kokosovo olje: 862kcal, 0g B

DODATKI (na 100g):
Med: 304kcal, 0.3g B | Gorčica: 66kcal, 4g B | Sojina omaka: 53kcal, 8g B | Whey protein: 380kcal, 80g B | Veganski protein: 370kcal, 75g B | Kakav grenki: 380kcal, 20g B
`;

const MEAL_SYSTEM_PROMPT = `Si Gal Remec, slovenski online fitnes trener z 500+ uspešnimi transformacijami. Pišeš jedilnike TOČNO v svojem stilu.

=== SLOG PISANJA — STROGA PRAVILA ===

JEZIK:
- Piši izključno v knjižni slovenščini s pravilnimi šumniki (č, š, ž, ć itd.)
- Brez anglicizmov, brez pogovornih izrazov, brez slenga
- Pravilna ločila: vejice, pike, pomišljaji
- Številke: "114 g" (s presledkom), "0,5 kg" (z vejico), "10–15 tisoč korakov" (z dolgim pomišljajem)
- Brez emojijev — nikoli, nobenih

TON:
- Strokoven, direkten, oseben
- Naslavljaj stranko z imenom in z "ti"
- Brez pretiranega hvaljenja, brez marketinškega jezika
- Povedi so polne in slovnično pravilne

STRUKTURA "adaptations" (3–5 povedi):
- Razloži na podlagi katerih podatkov je plan sestavljen
- Omeni izračunane kalorije, TDEE in deficit
- Omeni ciljni vnos beljakovin in zakaj
- Omeni upoštevane preference in omejitve

STRUKTURA "intro" (4–6 povedi):
- Pojasni strategijo in pristop
- Omeni pomen beljakovin in kalorijskega deficita
- Postavi realna pričakovanja
- Zaključi z navodilom o sledenju in doslednosti

=== VSEBINSKA NAČELA ===
- Kalorijski deficit = EDINI dokazani mehanizem izgube telesne maščobe
- Optimalni deficit: 500 kcal/dan → približno 0,5 kg izgube na teden
- Beljakovine: 1,8–2,2 g na kilogram telesne mase
- Proteini enakomerno razporejeni čez dan: 25–40 g na obrok
- Ne vključuj živil, ki jih stranka ne mara ali nanje ni alergična`;

function parseMealTallyData(body) {
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
    name:      get("ime in priimek") || get("ime"),
    age:       get("starost"),
    weight:    get("teža"),
    height:    get("višina"),
    goal:      get("cilj"),
    likes:     get("kaj rad") || get("čim več podatkov, ker bo jedilnik"),
    dislikes:  get("ne maraš") || get("katere hrane"),
    meals:     get("koliko obrokov"),
    allergies: get("alergije") || get("dodaj še"),
    activity:  getChoice("korakov"),
  };
}

async function generateMealPlan(userData) {
  const mealsCount = parseInt(userData.meals) || 4;
  const weight     = parseFloat(userData.weight) || 80;
  const height     = parseFloat(userData.height) || 175;
  const age        = parseFloat(userData.age) || 25;
  const name       = userData.name !== "ni podatka" ? userData.name : "stranka";

  const bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;

  let activityMultiplier = 1.375;
  if      (userData.activity.includes("0-3k"))   activityMultiplier = 1.2;
  else if (userData.activity.includes("3-5k"))   activityMultiplier = 1.375;
  else if (userData.activity.includes("5-7k"))   activityMultiplier = 1.375;
  else if (userData.activity.includes("7-10k"))  activityMultiplier = 1.55;
  else if (userData.activity.includes("10-15k")) activityMultiplier = 1.55;
  else if (userData.activity.includes("20k"))    activityMultiplier = 1.725;

  const tdee = Math.round(bmr * activityMultiplier);

  const goalLower = userData.goal.toLowerCase();
  let targetCalories, planType;
  if (goalLower.includes("huj") || goalLower.includes("cut") || goalLower.includes("izgub")) {
    targetCalories = tdee - 500;
    planType = "CUT";
  } else if (goalLower.includes("masa") || goalLower.includes("bulk") || goalLower.includes("pridobi")) {
    targetCalories = tdee + 300;
    planType = "BULK";
  } else {
    targetCalories = tdee;
    planType = "MAINTAIN";
  }

  const targetProtein = Math.round(weight * 2.0);

  const prompt = `Ustvari 3-dnevni prehranski načrt za stranko. Vrni SAMO čisti JSON brez kakršnegakoli besedila pred ali za njim.

BAZA ŽIVIL — uporabi te vrednosti za izračun kalorij in beljakovin:
${FOOD_DB}

ŽE IZRAČUNANI PODATKI (Mifflin-St Jeor):
- BMR: ${Math.round(bmr)} kcal
- TDEE: ${tdee} kcal
- Cilj kalorije: ${targetCalories} kcal/dan (${planType}, deficit ${tdee - targetCalories} kcal)
- Cilj beljakovine: ${targetProtein} g/dan (2,0 g × ${weight} kg)
- Število obrokov: ${mealsCount} na dan

PODATKI STRANKE:
- Ime: ${name}
- Starost: ${age} let | Teža: ${weight} kg | Višina: ${height} cm
- Cilj: ${userData.goal}
- Rad/a je: ${userData.likes}
- Ne mara: ${userData.dislikes}
- Alergije/preference: ${userData.allergies}
- Dnevna aktivnost: ${userData.activity} korakov na dan

Vrni TOČNO to JSON strukturo:
{
  "summary": {
    "calories_per_day": ${targetCalories},
    "protein_per_day": ${targetProtein},
    "meals_per_day": ${mealsCount},
    "goal": "${userData.goal}",
    "plan_type": "${planType}"
  },
  "adaptations": "3–5 povedi v knjižni slovenščini s šumniki. Brez emojijev. Omeni ${targetCalories} kcal, TDEE ${tdee} kcal, deficit, ${targetProtein} g beljakovin, aktivnost, preference. Naslavljaj ${name} z imenom.",
  "intro": "4–6 povedi v knjižni slovenščini s šumniki. Brez emojijev. Pomen beljakovin, kalorijski deficit, realna pričakovanja (0,5 kg na teden), doslednost.",
  "days": [
    {
      "day": 1,
      "calories": ${targetCalories},
      "protein": ${targetProtein},
      "meals": [
        {
          "number": 1,
          "name": "ZAJTRK",
          "calories": 500,
          "protein": 35,
          "ingredients": ["100 g ovsenih kosmičev (389 kcal, 13,5 g B)", "2 jajci (171 kcal, 14,3 g B)"]
        }
      ]
    }
  ]
}

PRAVILA:
- Vsak dan TOČNO ${mealsCount} obrokov
- Obroki: ZAJTRK, DOPOLDANSKA MALICA, KOSILO, POPOLDANSKA MALICA, VEČERJA, POZNA VEČERJA
- 3–6 sestavin z gramažo in kalorijami v oklepaju
- Skupne kalorije: ${targetCalories} kcal (±50)
- Skupne beljakovine: ${targetProtein} g (±10)
- NE vključuj: ${userData.dislikes} in ${userData.allergies}
- Vrni SAMO JSON`;

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: MODEL,
      max_tokens: 4096,
      system: MEAL_SYSTEM_PROMPT,
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

function generateMealPDF(userData, plan) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 40, left: 40, right: 40 }, bufferPages: true });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const W = doc.page.width, H = doc.page.height, M = 40, CW = W - M * 2;
    const RB = FONTS.regular, BD = FONTS.bold;
    const fillBg = () => doc.rect(0, 0, W, H).fill(DARK_BG);

    fillBg();
    doc.rect(0, 0, W, 6).fill(RED);

    let y = 50;
    doc.fontSize(11).fillColor(RED).font(BD).text("GAL REMEC COACHING", M, y, { align: "center", width: CW, characterSpacing: 3 });
    y += 28;
    doc.fontSize(52).fillColor(WHITE).font(BD).text("MEAL", M, y, { align: "center", width: CW });
    y += 55;
    doc.fontSize(52).fillColor(WHITE).font(BD).text("PLAN", M, y, { align: "center", width: CW });
    y += 70;

    const displayName = userData.name !== "ni podatka" ? userData.name.toUpperCase() : "";
    if (displayName) {
      doc.fontSize(16).fillColor(RED).font(BD).text(displayName, M, y, { align: "center", width: CW, characterSpacing: 2 });
      y += 32;
    }

    doc.fontSize(11).fillColor(GRAY).font(RB).text(`${plan.summary.plan_type} · ${plan.summary.meals_per_day}x OBROK`, M, y, { align: "center", width: CW, characterSpacing: 2 });
    y += 30;
    doc.rect(M, y, CW, 2).fill(RED);
    y += 18;

    const boxW = (CW - 15) / 2;
    doc.rect(M, y, boxW, 75).fill(DARK_CARD);
    doc.fontSize(34).fillColor(WHITE).font(BD).text(String(plan.summary.calories_per_day), M, y + 10, { width: boxW, align: "center" });
    doc.fontSize(9).fillColor(GRAY).font(RB).text("KALORIJ NA DAN", M, y + 52, { width: boxW, align: "center", characterSpacing: 1 });

    const box2X = M + boxW + 15;
    doc.rect(box2X, y, boxW, 75).fill(DARK_CARD);
    doc.fontSize(34).fillColor(WHITE).font(BD).text(`${plan.summary.protein_per_day} g`, box2X, y + 10, { width: boxW, align: "center" });
    doc.fontSize(9).fillColor(GRAY).font(RB).text("BELJAKOVIN NA DAN", box2X, y + 52, { width: boxW, align: "center", characterSpacing: 1 });

    y += 93;
    doc.rect(M, y, CW, 1).fill(RED);
    y += 14;
    doc.fontSize(10).fillColor(RED).font(BD).text("PRILAGODITVE JEDILNIKA", M, y, { characterSpacing: 1 });
    y += 18;
    doc.fontSize(10).fillColor(LIGHT).font(RB).text(plan.adaptations, M, y, { width: CW, lineGap: 4 });
    y += doc.heightOfString(plan.adaptations, { width: CW, lineGap: 4 }) + 18;

    doc.rect(M, y, CW, 1).fill(GRAY);
    y += 14;
    doc.fontSize(10).fillColor(LIGHT).font(RB).text(plan.intro, M, y, { width: CW, lineGap: 4 });
    y += doc.heightOfString(plan.intro, { width: CW, lineGap: 4 }) + 18;

    doc.rect(M, y, CW, 1).fill(GRAY);
    y += 14;
    doc.fontSize(10).fillColor(WHITE).font(BD).text(`${plan.days.length} DNI  ·  ${plan.days.length * plan.summary.meals_per_day} OBROKOV  ·  POPOLN JEDILNIK`, M, y, { align: "center", width: CW, characterSpacing: 1 });
    doc.rect(0, H - 6, W, 6).fill(RED);

    plan.days.forEach((day) => {
      doc.addPage();
      fillBg();
      doc.rect(0, 0, W, 6).fill(RED);
      doc.rect(0, H - 6, W, 6).fill(RED);

      let dy = 25;
      doc.rect(M, dy, CW, 42).fill(RED);
      doc.fontSize(13).fillColor(WHITE).font(BD).text(`DAN ${day.day}`, M + 12, dy + 8);
      doc.fontSize(10).fillColor(WHITE).font(RB).text(`${day.calories} kcal  ·  ${day.protein} g beljakovin  ·  ${day.meals.length} obroki`, M + 12, dy + 26);
      doc.fontSize(9).fillColor(WHITE).font(BD).text("STRENGTH AND HONOR", M, dy + 17, { width: CW - 12, align: "right", characterSpacing: 1 });
      dy += 52;

      day.meals.forEach((meal, i) => {
        const mealH = Math.max(85, 28 + meal.ingredients.length * 18 + 16);
        if (dy + mealH > H - 50) {
          doc.addPage(); fillBg();
          doc.rect(0, 0, W, 6).fill(RED);
          doc.rect(0, H - 6, W, 6).fill(RED);
          dy = 30;
        }
        const bg = i % 2 === 0 ? DARK_CARD : DARK_ROW;
        doc.rect(M, dy, CW, mealH).fill(bg);
        doc.rect(M, dy, 4, mealH).fill(RED);
        doc.fontSize(20).fillColor(RED).font(BD).text(String(meal.number).padStart(2, "0"), M + 14, dy + 8);
        doc.fontSize(10).fillColor(WHITE).font(BD).text(meal.name, M + 14, dy + 34);
        doc.fontSize(9).fillColor(GRAY).font(RB).text(`${meal.calories} kcal  |  ${meal.protein} g beljakovin`, M + 14, dy + 50);
        const divX = M + 140;
        doc.rect(divX, dy + 10, 1, mealH - 20).fill(RED);
        meal.ingredients.forEach((ing, idx) => {
          doc.fontSize(10).fillColor(LIGHT).font(RB).text(`• ${ing}`, divX + 14, dy + 12 + idx * 18, { width: CW - 160 });
        });
        dy += mealH + 6;
      });
    });

    doc.end();
  });
}

async function sendMealEmail(userData, pdfBuffer) {
  const name = userData.name !== "ni podatka" ? userData.name : "stranka";
  await axios.post("https://api.resend.com/emails", {
    from: "Meal Planner <onboarding@resend.dev>",
    to: NOTIFY_EMAIL,
    subject: `🥗 ${name} — nov načrt prehrane | ${userData.goal} | ${userData.weight} kg`,
    html: `<div style="font-family:Arial,sans-serif;background:#111;color:#fff;padding:30px;border-radius:8px;"><h2 style="color:#CC1F1F;">GAL REMEC COACHING</h2><p>Nov načrt prehrane za <strong>${name}</strong> je pripravljen. PDF je v priponki.</p></div>`,
    attachments: [{ filename: `meal-plan-${name.replace(/ /g, "-")}.pdf`, content: pdfBuffer.toString("base64") }],
  }, { headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" } });
}

// ══════════════════════════════════════════════════════════════════════════════
// TRAINING PLAN
// ══════════════════════════════════════════════════════════════════════════════

const TRAINING_SYSTEM_PROMPT = `Si Gal Remec, slovenski online fitnes trener z 500+ uspešnimi transformacijami. Pišeš personaliziran trening program za stranko.

=== SLOG PISANJA — STROGA PRAVILA ===
- Piši izključno v knjižni slovenščini s pravilnimi šumniki (č, š, ž itd.)
- Nazivi vaj so lahko v angleščini
- Brez emojijev — nikoli, nobenih
- Strokoven, direkten, oseben — naslavljaj z imenom in "ti"

STRUKTURA "intro" (8–12 povedi) — POSNEMAJ TA SLOG:
"Ta trening program je pripravljen glede na tvojo starost, telesno maso, trenutno stopnjo aktivnosti in cilje, ki si jih navedel."
"Program je razdeljen na [X] ločene enote..."
"Pred vsakim treningom si vzemi 5 do 10 minut za ogrevanje."
"Vsaka delovna serija mora biti resna serija. Teža mora biti izbrana tako, da zadnjo ponovitev v predpisanem razponu dosežeš blizu tehnične odpovedi."
"Počitek med serijami naj bo dovolj dolg..."
"Progresivna obremenitev je edini način za dolgoročen napredek."
"Na koncu je najpomembnejša doslednost."

=== VSEBINSKO ZNANJE ===
- 1–2 delovni seriji do čiste mišične odpovedi zadoščata
- 6–10 ponovitev za večje vaje, 10–15 za izolacijske
- Počitek 2–3 minute pri večjih vajah, 60–90 sekund pri izolacijskih
- Progresivna obremenitev = edini način za napredek
- Tehnika > teža vedno
- 3x/teden: PUSH/PULL/LEGS | 4x: UPPER/LOWER | 5x: UPPER/LOWER/ARMS+SHOULDERS
- Za dom: push-ups variacije, pull-ups, dips, pistol squats, Bulgarian split squats`;

function parseTrainingTallyData(body) {
  const fields = body?.data?.fields ?? [];
  const get = (label) =>
    fields.find((f) => f.label?.toLowerCase().includes(label.toLowerCase()))?.value ?? "ni podatka";

  return {
    name:      get("ime in priimek") || get("ime"),
    location:  get("kje želiš trenirati") || get("kje"),
    equipment: get("opremo imaš") || get("oprema"),
    dislikes:  get("ne maraš") || get("katerih vaj"),
    likes:     get("imaš rad") || get("katere vaje imaš"),
    frequency: get("kolikokrat") || get("dni"),
    injuries:  get("poškodbe") || get("zdravje"),
  };
}

async function generateTrainingPlan(userData) {
  const name = userData.name !== "ni podatka" ? userData.name : "stranka";
  const days = parseInt(userData.frequency) || 3;

  let splitType, splitDesc;
  if (days <= 3) { splitType = "PUSH / PULL / LEGS"; splitDesc = "3 dni na teden"; }
  else if (days === 4) { splitType = "UPPER / LOWER"; splitDesc = "4 dni na teden"; }
  else { splitType = "UPPER / LOWER / ARMS + SHOULDERS"; splitDesc = "5 dni na teden"; }

  const prompt = `Ustvari personaliziran trening program. Vrni SAMO čisti JSON brez besedila pred ali za njim.

PODATKI STRANKE:
- Ime: ${name}
- Lokacija: ${userData.location}
- Oprema: ${userData.equipment}
- Ne mara vaj: ${userData.dislikes}
- Ima rad/a vaje: ${userData.likes}
- Treningov na teden: ${days}
- Poškodbe: ${userData.injuries}

SPLIT: ${splitType} (${splitDesc})

Vrni TOČNO to JSON strukturo:
{
  "summary": { "name": "${name}", "days_per_week": ${days}, "split": "${splitType}", "split_desc": "${splitDesc}", "location": "${userData.location}" },
  "intro": "8–12 povedi v knjižni slovenščini s šumniki. Brez emojijev. Začni z 'Ta trening program je pripravljen glede na...' Razloži split, ogrevanje, intenzivnost, počitek, progresijo, poškodbe če obstajajo. Zaključi z doslednostjo.",
  "schedule": [
    { "day": "Ponedeljek", "workout": "PUSH" },
    { "day": "Torek", "workout": "Počitek" },
    { "day": "Sreda", "workout": "PULL" },
    { "day": "Četrtek", "workout": "Počitek" },
    { "day": "Petek", "workout": "LEGS" },
    { "day": "Sobota", "workout": "Počitek" },
    { "day": "Nedelja", "workout": "Počitek" }
  ],
  "workouts": [
    {
      "name": "PUSH",
      "exercises": [
        { "name": "Smith machine bench press", "sets_reps": "2 × 6–10", "note": "Kontroliran spust, stabilna izvedba." }
      ]
    }
  ]
}

PRAVILA:
- Prilagodi glede na lokacijo: doma = brez naprav, fitnes = naprave + uteži
- NE vključuj: ${userData.dislikes}
- Vključi: ${userData.likes}
- Prilagodi poškodbe: ${userData.injuries}
- 4–6 vaj na trening dan
- schedule vsebuje vseh 7 dni
- Vrni SAMO JSON`;

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: MODEL,
      max_tokens: 4096,
      system: TRAINING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      timeout: 120000,
    }
  );

  const textBlock = response.data?.content?.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Anthropic vrnil prazen odgovor.");
  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function generateTrainingPDF(userData, plan) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 40, left: 40, right: 40 }, bufferPages: true });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const W = doc.page.width, H = doc.page.height, M = 40, CW = W - M * 2;
    const RB = FONTS.regular, BD = FONTS.bold;
    const fillBg = () => doc.rect(0, 0, W, H).fill(DARK_BG);

    fillBg();
    doc.rect(0, 0, W, 6).fill(RED);

    let y = 50;
    doc.fontSize(11).fillColor(RED).font(BD).text("GAL REMEC COACHING", M, y, { align: "center", width: CW, characterSpacing: 3 });
    y += 28;
    doc.fontSize(52).fillColor(WHITE).font(BD).text("TRENING", M, y, { align: "center", width: CW });
    y += 55;
    doc.fontSize(52).fillColor(WHITE).font(BD).text("PROGRAM", M, y, { align: "center", width: CW });
    y += 70;

    const displayName = userData.name !== "ni podatka" ? userData.name.toUpperCase() : "";
    if (displayName) {
      doc.fontSize(16).fillColor(RED).font(BD).text(displayName, M, y, { align: "center", width: CW, characterSpacing: 2 });
      y += 32;
    }

    doc.fontSize(11).fillColor(GRAY).font(RB).text(`${plan.summary.split}  ·  ${plan.summary.split_desc.toUpperCase()}`, M, y, { align: "center", width: CW, characterSpacing: 2 });
    y += 30;
    doc.rect(M, y, CW, 2).fill(RED);
    y += 18;

    const boxW = (CW - 15) / 2;
    doc.rect(M, y, boxW, 75).fill(DARK_CARD);
    doc.fontSize(34).fillColor(WHITE).font(BD).text(String(plan.summary.days_per_week), M, y + 10, { width: boxW, align: "center" });
    doc.fontSize(9).fillColor(GRAY).font(RB).text("TRENINGOV NA TEDEN", M, y + 52, { width: boxW, align: "center", characterSpacing: 1 });

    const box2X = M + boxW + 15;
    doc.rect(box2X, y, boxW, 75).fill(DARK_CARD);
    doc.fontSize(14).fillColor(WHITE).font(BD).text(plan.summary.location.toUpperCase(), box2X, y + 25, { width: boxW, align: "center" });
    doc.fontSize(9).fillColor(GRAY).font(RB).text("LOKACIJA", box2X, y + 52, { width: boxW, align: "center", characterSpacing: 1 });

    y += 93;
    doc.rect(M, y, CW, 1).fill(RED);
    y += 14;
    doc.fontSize(10).fillColor(LIGHT).font(RB).text(plan.intro, M, y, { width: CW, lineGap: 4 });
    y += doc.heightOfString(plan.intro, { width: CW, lineGap: 4 }) + 18;

    if (y + 200 > H - 50) {
      doc.addPage(); fillBg();
      doc.rect(0, 0, W, 6).fill(RED);
      doc.rect(0, H - 6, W, 6).fill(RED);
      y = 30;
    }

    doc.rect(M, y, CW, 1).fill(GRAY);
    y += 14;
    doc.fontSize(10).fillColor(RED).font(BD).text("PRIMER TEDENSKEGA RAZPOREDA", M, y, { characterSpacing: 1 });
    y += 16;

    plan.schedule.forEach((item, i) => {
      const isRest = item.workout.toLowerCase().includes("počitek");
      doc.rect(M, y, CW, 26).fill(i % 2 === 0 ? DARK_CARD : DARK_ROW);
      doc.rect(M, y, 4, 26).fill(isRest ? GRAY : RED);
      doc.fontSize(9).fillColor(WHITE).font(BD).text(item.day.toUpperCase(), M + 14, y + 8, { width: 100 });
      doc.fontSize(9).fillColor(isRest ? GRAY : LIGHT).font(RB).text(item.workout, M + 120, y + 8, { width: CW - 130 });
      y += 28;
    });

    y += 10;
    doc.fontSize(10).fillColor(WHITE).font(BD).text("STRENGTH AND HONOR", M, y, { align: "center", width: CW, characterSpacing: 2 });
    doc.rect(0, H - 6, W, 6).fill(RED);

    plan.workouts.forEach((workout) => {
      doc.addPage(); fillBg();
      doc.rect(0, 0, W, 6).fill(RED);
      doc.rect(0, H - 6, W, 6).fill(RED);

      let dy = 25;
      doc.rect(M, dy, CW, 44).fill(RED);
      doc.fontSize(22).fillColor(WHITE).font(BD).text(workout.name, M + 12, dy + 11);
      doc.fontSize(9).fillColor(WHITE).font(BD).text("STRENGTH AND HONOR", M, dy + 17, { width: CW - 12, align: "right", characterSpacing: 1 });
      dy += 54;

      workout.exercises.forEach((ex, i) => {
        const noteH = ex.note ? doc.heightOfString(ex.note, { width: CW - 175, lineGap: 3 }) + 8 : 0;
        const exH = Math.max(72, 44 + noteH);

        if (dy + exH > H - 50) {
          doc.addPage(); fillBg();
          doc.rect(0, 0, W, 6).fill(RED);
          doc.rect(0, H - 6, W, 6).fill(RED);
          dy = 30;
        }

        doc.rect(M, dy, CW, exH).fill(i % 2 === 0 ? DARK_CARD : DARK_ROW);
        doc.rect(M, dy, 4, exH).fill(RED);
        doc.fontSize(18).fillColor(RED).font(BD).text(String(i + 1).padStart(2, "0"), M + 12, dy + 8);
        doc.fontSize(11).fillColor(WHITE).font(BD).text(ex.name, M + 12, dy + 32, { width: 140 });
        const divX = M + 158;
        doc.rect(divX, dy + 8, 1, exH - 16).fill(RED);
        doc.fontSize(17).fillColor(WHITE).font(BD).text(ex.sets_reps, divX + 14, dy + 8, { width: CW - 175 });
        if (ex.note) {
          doc.fontSize(9).fillColor(GRAY).font(RB).text(ex.note, divX + 14, dy + 36, { width: CW - 175, lineGap: 3 });
        }
        dy += exH + 6;
      });
    });

    doc.end();
  });
}

async function sendTrainingEmail(userData, pdfBuffer) {
  const name = userData.name !== "ni podatka" ? userData.name : "stranka";
  await axios.post("https://api.resend.com/emails", {
    from: "Training Planner <onboarding@resend.dev>",
    to: NOTIFY_EMAIL,
    subject: `💪 ${name} — nov trening program | ${userData.frequency}x na teden | ${userData.location}`,
    html: `<div style="font-family:Arial,sans-serif;background:#111;color:#fff;padding:30px;border-radius:8px;"><h2 style="color:#CC1F1F;">GAL REMEC COACHING</h2><p>Nov trening program za <strong>${name}</strong> je pripravljen. PDF je v priponki.</p></div>`,
    attachments: [{ filename: `trening-program-${name.replace(/ /g, "-")}.pdf`, content: pdfBuffer.toString("base64") }],
  }, { headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" } });
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.get("/health", (req, res) => {
  res.json({ status: "ok", model: MODEL, endpoints: ["/webhook", "/webhook-training"] });
});

app.post("/webhook", async (req, res) => {
  console.log("📥 Meal webhook received");
  res.status(200).json({ received: true });
  const userData = parseMealTallyData(req.body);
  console.log("👤 Meal user data:", userData);
  try {
    const plan = await generateMealPlan(userData);
    console.log("✅ Meal plan generated:", plan.summary);
    const pdfBuffer = await generateMealPDF(userData, plan);
    console.log("✅ Meal PDF generated:", pdfBuffer.length, "bytes");
    await sendMealEmail(userData, pdfBuffer);
    console.log("📧 Meal email sent to:", NOTIFY_EMAIL);
  } catch (err) {
    console.error("❌ Meal error:", err.response?.data || err.message);
  }
});

app.post("/webhook-training", async (req, res) => {
  console.log("📥 Training webhook received");
  res.status(200).json({ received: true });
  const userData = parseTrainingTallyData(req.body);
  console.log("👤 Training user data:", userData);
  try {
    const plan = await generateTrainingPlan(userData);
    console.log("✅ Training plan generated:", plan.summary);
    const pdfBuffer = await generateTrainingPDF(userData, plan);
    console.log("✅ Training PDF generated:", pdfBuffer.length, "bytes");
    await sendTrainingEmail(userData, pdfBuffer);
    console.log("📧 Training email sent to:", NOTIFY_EMAIL);
  } catch (err) {
    console.error("❌ Training error:", err.response?.data || err.message);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════════════════

downloadFonts().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Port ${PORT} | Model: ${MODEL} | API key: ${ANTHROPIC_API_KEY ? "✅" : "❌"}`);
    console.log(`📍 Endpoints: /webhook (meal) | /webhook-training (trening)`);
  });
}).catch((err) => {
  console.error("❌ Font download failed:", err.message);
  process.exit(1);
});
