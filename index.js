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
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

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
      const res = await axios.get(url, { responseType: "arraybuffer" });
      fs.writeFileSync(FONTS[key], Buffer.from(res.data));
      console.log("Font saved: " + key);
    }
  }
}

const DARK_BG   = "#111111";
const DARK_CARD = "#1A1A1A";
const DARK_ROW  = "#161616";
const RED       = "#CC1F1F";
const WHITE     = "#FFFFFF";
const GRAY      = "#888888";
const LIGHT     = "#CCCCCC";

const FOOD_DB = `
MESO IN PERUTNINA (na 100g surovo):
Piscancja prsa: 110kcal, 23g B | Piscancja stegna (brez kosti): 160kcal, 19g B | Puranja prsa: 114kcal, 24g B | Goveji zrezek (pusto): 150kcal, 22g B | Goveje meso mleto 5%: 135kcal, 21g B | Goveje meso mleto 20%: 250kcal, 17g B | Svinjski file: 143kcal, 21g B | Teletina: 110kcal, 20g B | Srna: 120kcal, 22g B | Jelenjad: 125kcal, 22g B

MESNI IZDELKI (na 100g):
Kuhan prsut/sunka: 110kcal, 18g B | Puranja sunka: 90kcal, 17g B | Piscancja prsa v ovitku: 85kcal, 16g B | Kraski prsut: 260kcal, 26g B | Hrenovka: 280kcal, 12g B | Cevapci surovi: 250kcal, 15g B

RIBE (na 100g):
Losos svez: 208kcal, 20g B | Tuna v lastnem soku: 116kcal, 25g B | Tuna v olju: 198kcal, 24g B | Skusa sveza: 305kcal, 19g B | Oslic: 90kcal, 17g B | Postrv: 148kcal, 21g B | Sardine v olju: 208kcal, 24g B | Tilapija: 128kcal, 26g B | Trska: 82kcal, 18g B | Kozice: 99kcal, 24g B

MLECNI IZDELKI (na 100g):
Mleko 3.5%: 64kcal, 3.3g B | Grski jogurt 0%: 59kcal, 10g B | Grski jogurt 2%: 75kcal, 9.5g B | Skyr: 65kcal, 11g B | Pusta skuta: 72kcal, 12g B | Sir Cottage light: 70kcal, 12g B | Mozzarella light: 165kcal, 20g B | Parmezan: 431kcal, 38g B | Feta: 264kcal, 14g B | Ovseni napitek: 42kcal, 1g B | Mandljev napitek: 13kcal, 0.4g B | Kefir: 62kcal, 3.3g B

JAJCA (na 100g):
Kokonje jajce celo: 155kcal, 13g B | Jajcni beljak: 52kcal, 11g B

ZELENJAVA (na 100g surovo):
Brokoli: 34kcal, 2.8g B | Spinaca: 23kcal, 2.9g B | Paprika rdeca: 31kcal, 1g B | Kumara: 15kcal, 0.7g B | Paradiznik: 18kcal, 0.9g B | Korenje: 41kcal, 0.9g B | Rukola: 25kcal, 2.6g B | Cvetaca: 25kcal, 1.9g B | Bucka: 17kcal, 1.2g B | Sampinjoni: 22kcal, 3.1g B | Cebula: 40kcal, 1.1g B | Sladki krompir: 86kcal, 1.6g B | Koruza sladka: 86kcal, 3.2g B | Sparglji: 20kcal, 2.2g B

STROCNICE (na 100g):
Fizol kuhan: 127kcal, 8.7g B | Cicerika kuhana: 164kcal, 8.9g B | Leca kuhana: 116kcal, 9g B

SADJE (na 100g):
Banana: 89kcal, 1.1g B | Jabolko: 52kcal, 0.3g B | Jagode: 32kcal, 0.7g B | Borovnice: 57kcal, 0.7g B | Avokado: 160kcal, 2g B | Pomaranca: 47kcal, 0.9g B | Kivi: 61kcal, 1.1g B

ZITA (na 100g suho):
Beli riz: 360kcal, 7g B | Basmati riz: 345kcal, 8.5g B | Ovseni kosmici: 389kcal, 13.5g B | Testenine bele: 350kcal, 12g B | Polnozrnate testenine: 340kcal, 14g B | Krompir surovi: 77kcal, 2g B | Kvinoja: 368kcal, 14g B | Ajdova kasa: 343kcal, 13g B

KRUH (na 100g):
Polnozrnati kruh: 250kcal, 9.7g B | Toast polnozrnat: 260kcal, 9g B | Toast beli: 285kcal, 8.3g B | Tortilja psenicna: 310kcal, 8g B

ORESKI (na 100g):
Mandlji: 579kcal, 21g B | Orehi: 654kcal, 15g B | Arasidovo maslo: 588kcal, 25g B | Chia semena: 486kcal, 17g B | Soncnicna semena: 584kcal, 21g B

OLJA (na 100g):
Oljcno olje: 884kcal, 0g B | Maslo: 717kcal, 0.8g B

DODATKI (na 100g):
Med: 304kcal, 0.3g B | Sojina omaka: 53kcal, 8g B | Whey protein: 380kcal, 80g B | Veganski protein: 370kcal, 75g B
`;

const MEAL_SYSTEM_PROMPT = `Si Gal Remec, slovenski online fitnes trener z 500+ uspesnimi transformacijami. Pises jedilnike v svojem stilu.

JEZIK: Knjizna slovenscina s sumniki. Brez emojijev. Pravilna locila. Stevilke s presledkom (114 g). Brez anglicizmov.
TON: Strokoven, direkten, oseben. Naslavlja z imenom in "ti".

ADAPTATIONS (3-5 povedi): Razlozi podatke, kalorije, TDEE, deficit, beljakovine, preference.
INTRO (4-6 povedi): Strategija, pomen beljakovin, deficit, realna pricakovanja, doslednost.

NACELA: Deficit 500 kcal = 0,5 kg/teden. Beljakovine 1,8-2,2 g/kg. 25-40 g na obrok.

PREPOVEDANA ZIVILA: Nikoli ne vkljuci humusa, soje in sojinih izdelkov (sojin jogurt, sojin napitek, sojini koscki, tofu, tempeh, edamame). To velja za VSE stranke brez izjeme.`;

const TRAINING_SYSTEM_PROMPT = `Si Gal Remec, slovenski online fitnes trener z 500+ uspesnimi transformacijami. Pises trening programe v svojem stilu.

JEZIK: Knjizna slovenscina s sumniki. Nazivi vaj v anglescini. Brez emojijev.
TON: Strokoven, direkten - naslavlja z imenom in "ti".

INTRO (8-12 povedi): Zacni z "Ta trening program je pripravljen glede na..." Razlozi split, ogrevanje, intenzivnost (blizu tehnicne odpovedi), pocitek 3-5 minut za VSE vaje brez izjeme, progresivno obremenitev, poskodbe. Zakljuci z doslednostjo.

NACELA: 1-2 seriji do odpovedi zadoscata. 6-10 reps vecje vaje, 10-15 izolacijske. Tehnika > teza.
POCITEK: 3-5 minut za VSE vaje - tako vecje kot izolacijske. Nikoli manj.
KARDIO NAVODILA (za kardio dneve):
- Kardio dan mora biti napisan kot workout z vajami (naprava, cas, kcal)
- Opcije: Sobno kolo (30-45 min, 250-400 kcal, intenzivnost zmerna-visoka), Tek na tekoci stezi (25-40 min, 250-400 kcal, 8-11 km/h), Elipticni trenazjer (30-45 min, 280-400 kcal), Veslarski ergometer (20-30 min, 250-350 kcal), Stairmaster (25-35 min, 300-400 kcal), Hoja na nagnjeni tekoci stezi (35-50 min, 200-300 kcal, naklon MINIMALNO 10%, nikoli manj, hitrost 5-6 km/h)
- Za kardio dan naredi workout z 2-3 napravami, vsaka ima: ime naprave, cas in priblizni kcal, navodila za intenzivnost
- Hoja na tekoci stezi: naklon VEDNO minimalno 10%, nikoli manj
SPLITI: 3x=PPL, 4x=UPPER/LOWER, 5x=UPPER/LOWER/ARMS+SHOULDERS.`;

// Normalizira sumniki: ce -> c, se -> s, ze -> z itd.
function norm(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseCombinedTallyData(body) {
  const fields = body?.data?.fields ?? [];

  const get = (label) => {
    const f = fields.find((f) => norm(f.label || "").includes(norm(label)));
    return f?.value ?? "ni podatka";
  };

  const getChoice = (label) => {
    const field = fields.find((f) => norm(f.label || "").includes(norm(label)));
    if (!field) return "ni podatka";
    const options = field.options ?? [];
    const selected = Array.isArray(field.value) ? field.value : [field.value];
    const matched = options.filter((o) => selected.includes(o.id)).map((o) => o.text);
    return matched.length > 0 ? matched.join(", ") : "ni podatka";
  };

  const data = {
    name:          get("ime in priimek") || get("ime"),
    age:           get("starost"),
    weight:        get("teza"),
    height:        get("visina"),
    goal:          get("cilj"),
    activity:      getChoice("korakov dela") || getChoice("korakov naredi") || get("korakov"),
    likes:         get("kaj rad") || get("jedilnik na podlagi"),
    dislikes:      get("hrane ne maras") || get("ne maras"),
    meals:         get("koliko obrokov"),
    allergies:     get("alergije") || get("jedilnika"),
    location:      get("kje zelis trenirati") || get("kje"),
    equipment:     get("od doma napisi") || get("opremo imas"),
    exDislikes:    get("katerih vaj ne maras") || get("vaj ne"),
    exLikes:       get("vaje imas rad") || get("vaje rad"),
    frequency:     get("kolikokrat"),
    injuries:      get("poskodbe") || get("zdravjem"),
    trainingNotes: get("sestave treninga"),
  };

  console.log("Parsed:", JSON.stringify(data));
  return data;
}

async function generateMealPlan(userData) {
  const mealsCount = parseInt(userData.meals) || 4;
  const weight     = parseFloat(userData.weight) || 80;
  const height     = parseFloat(userData.height) || 175;
  const age        = parseFloat(userData.age) || 25;
  const name       = userData.name !== "ni podatka" ? userData.name : "stranka";

  const bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;

  let activityMultiplier = 1.375;
  const act = norm(userData.activity);
  if (act.includes("0-3k") || act.includes("malo")) activityMultiplier = 1.2;
  else if (act.includes("3-5k")) activityMultiplier = 1.375;
  else if (act.includes("5-7k") || act.includes("srednje")) activityMultiplier = 1.375;
  else if (act.includes("7-10k") || act.includes("veliko")) activityMultiplier = 1.55;
  else if (act.includes("10-15k") || act.includes("zelo veliko")) activityMultiplier = 1.55;
  else if (act.includes("20k")) activityMultiplier = 1.725;

  const tdee = Math.round(bmr * activityMultiplier);

  const goalLower = norm(userData.goal);
  let targetCalories, planType;
  if (goalLower.includes("huj") || goalLower.includes("cut") || goalLower.includes("izgub")) {
    targetCalories = tdee - 500; planType = "CUT";
  } else if (goalLower.includes("masa") || goalLower.includes("bulk") || goalLower.includes("pridobi")) {
    targetCalories = tdee + 300; planType = "BULK";
  } else {
    targetCalories = tdee; planType = "MAINTAIN";
  }

  const targetProtein = Math.round(weight * 2.0);

  const prompt = `Ustvari 3-dnevni prehranski nacrt. Vrni SAMO cisti JSON.

BAZA ZIVIL:
${FOOD_DB}

IZRACUNANI PODATKI:
- BMR: ${Math.round(bmr)} kcal | TDEE: ${tdee} kcal | Cilj: ${targetCalories} kcal (${planType}) | Beljakovine: ${targetProtein} g

STRANKA: ${name}, ${age} let, ${weight} kg, ${height} cm, cilj: ${userData.goal}
Rad je: ${userData.likes} | Ne mara: ${userData.dislikes} | Obroki: ${mealsCount} | Alergije: ${userData.allergies}

JSON struktura:
{
  "summary": { "calories_per_day": ${targetCalories}, "protein_per_day": ${targetProtein}, "meals_per_day": ${mealsCount}, "plan_type": "${planType}" },
  "adaptations": "3-5 povedi, knjizna slovenscina, sumniki, brez emojijev, naslavlja ${name}",
  "intro": "4-6 povedi, knjizna slovenscina, sumniki, brez emojijev",
  "days": [{ "day": 1, "calories": ${targetCalories}, "protein": ${targetProtein}, "meals": [{ "number": 1, "name": "ZAJTRK", "calories": 500, "protein": 35, "ingredients": ["100 g ovsenih kosmiccev (389 kcal, 13,5 g B)"] }] }]
}

PRAVILA: ${mealsCount} obrokov/dan, 3-6 sestavin z gramayo in kcal v oklepaju, NE vkljuci: ${userData.dislikes}, ${userData.allergies}, humus, soja, sojini izdelki, tofu, tempeh, edamame. SAMO JSON.`;

  const response = await axios.post("https://api.anthropic.com/v1/messages", {
    model: MODEL, max_tokens: 4096,
    system: MEAL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  }, {
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    timeout: 120000,
  });

  const text = response.data?.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Prazen odgovor");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function generateTrainingPlan(userData) {
  const name = userData.name !== "ni podatka" ? userData.name : "stranka";
  const days = parseInt(userData.frequency) || 3;

  let splitType, splitDesc;
  if (days <= 3) { splitType = "PUSH / PULL / LEGS"; splitDesc = "3 dni na teden"; }
  else if (days === 4) { splitType = "UPPER / LOWER"; splitDesc = "4 dni na teden"; }
  else { splitType = "UPPER / LOWER / ARMS + SHOULDERS"; splitDesc = "5 dni na teden"; }

  const prompt = `Ustvari personaliziran trening program. Vrni SAMO cisti JSON.

STRANKA: ${name}, lokacija: ${userData.location}, oprema: ${userData.equipment}
Ne mara vaj: ${userData.exDislikes} | Ima rad: ${userData.exLikes}
Treningov/teden: ${days} | Poskodbe: ${userData.injuries} | Opombe: ${userData.trainingNotes}
SPLIT: ${splitType}

JSON struktura:
{
  "summary": { "name": "${name}", "days_per_week": ${days}, "split": "${splitType}", "split_desc": "${splitDesc}", "location": "${userData.location}" },
  "intro": "8-12 povedi, knjizna slovenscina, sumniki, brez emojijev. Zacni z 'Ta trening program je pripravljen glede na...'",
  "schedule": [{ "day": "Ponedeljek", "workout": "PUSH" }, { "day": "Torek", "workout": "Pocitek" }, { "day": "Sreda", "workout": "PULL" }, { "day": "Cetrtek", "workout": "Pocitek" }, { "day": "Petek", "workout": "LEGS" }, { "day": "Sobota", "workout": "Pocitek" }, { "day": "Nedelja", "workout": "Pocitek" }],
  "workouts": [{ "name": "PUSH", "exercises": [{ "name": "Smith machine bench press", "sets_reps": "2 x 6-10", "note": "Kontroliran spust." }] }]
}

POZOR: Ce stranka v opombah specificira tocno strukturo treninga (npr. "2x noge, 3x kardio", "samo kardio", "samo noge"), IGNORIRAJ standardni split in naredi TOCNO to kar stranka zahteva v opombah.
PRAVILA:
- 4-6 vaj/dan za trening dneve
- Kardio dnevi = workout z 2-3 kardio napravami (naprava, cas, kcal, intenzivnost)
- Hoja na tekoci stezi: naklon VEDNO min 10%, nikoli manj
- Pocitek med serijami: 3-5 minut za VSE vaje
- OPREMA - STROGO PRAVILO: Sestavi program IZKLJUCNO iz opreme ki jo je stranka eksplicitno navedla. Ne predpostavljaj NICESAR kar ni omenjeno. Ce stranka napise samo "dumbbell" ali "utezi" ali "utez" - program vsebuje SAMO vaje z dumbbelli/utezmi. Brez pull-up bara, brez kablov, brez naprav, brez klopi, brez vrat - razen ce je eksplicitno napisano. Dvomis? Izpusti vajo.
- Prilagodi lokaciji (doma=brez naprav razen kar je navedeno, fitnes=naprave+utezi)
- NE vkljuci: ${userData.exDislikes}
- Prilagodi poskodbe: ${userData.injuries}
- Za kardio dneve v schedule napisi "Kardio"
- workouts seznam mora vsebovati KARDIO kot workout dan z vajami
- SAMO JSON`;

  const response = await axios.post("https://api.anthropic.com/v1/messages", {
    model: MODEL, max_tokens: 4096,
    system: TRAINING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  }, {
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    timeout: 120000,
  });

  const text = response.data?.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Prazen odgovor");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
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

    doc.fontSize(11).fillColor(GRAY).font(RB).text(plan.summary.plan_type + " - " + plan.summary.meals_per_day + "x OBROK", M, y, { align: "center", width: CW, characterSpacing: 2 });
    y += 30;
    doc.rect(M, y, CW, 2).fill(RED);
    y += 18;

    const boxW = (CW - 15) / 2;
    doc.rect(M, y, boxW, 75).fill(DARK_CARD);
    doc.fontSize(34).fillColor(WHITE).font(BD).text(String(plan.summary.calories_per_day), M, y + 10, { width: boxW, align: "center" });
    doc.fontSize(9).fillColor(GRAY).font(RB).text("KALORIJ NA DAN", M, y + 52, { width: boxW, align: "center", characterSpacing: 1 });

    const box2X = M + boxW + 15;
    doc.rect(box2X, y, boxW, 75).fill(DARK_CARD);
    doc.fontSize(34).fillColor(WHITE).font(BD).text(plan.summary.protein_per_day + " g", box2X, y + 10, { width: boxW, align: "center" });
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
    doc.fontSize(10).fillColor(WHITE).font(BD).text(plan.days.length + " DNI  -  " + (plan.days.length * plan.summary.meals_per_day) + " OBROKOV  -  POPOLN JEDILNIK", M, y, { align: "center", width: CW, characterSpacing: 1 });
    doc.rect(0, H - 6, W, 6).fill(RED);

    plan.days.forEach((day) => {
      doc.addPage(); fillBg();
      doc.rect(0, 0, W, 6).fill(RED);
      doc.rect(0, H - 6, W, 6).fill(RED);

      let dy = 25;
      doc.rect(M, dy, CW, 42).fill(RED);
      doc.fontSize(13).fillColor(WHITE).font(BD).text("DAN " + day.day, M + 12, dy + 8);
      doc.fontSize(10).fillColor(WHITE).font(RB).text(day.calories + " kcal  -  " + day.protein + " g beljakovin  -  " + day.meals.length + " obroki", M + 12, dy + 26);
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
        doc.rect(M, dy, CW, mealH).fill(i % 2 === 0 ? DARK_CARD : DARK_ROW);
        doc.rect(M, dy, 4, mealH).fill(RED);
        doc.fontSize(20).fillColor(RED).font(BD).text(String(meal.number).padStart(2, "0"), M + 14, dy + 8);
        doc.fontSize(10).fillColor(WHITE).font(BD).text(meal.name, M + 14, dy + 34);
        doc.fontSize(9).fillColor(GRAY).font(RB).text(meal.calories + " kcal  |  " + meal.protein + " g beljakovin", M + 14, dy + 50);
        const divX = M + 140;
        doc.rect(divX, dy + 10, 1, mealH - 20).fill(RED);
        meal.ingredients.forEach((ing, idx) => {
          doc.fontSize(10).fillColor(LIGHT).font(RB).text("- " + ing, divX + 14, dy + 12 + idx * 18, { width: CW - 160 });
        });
        dy += mealH + 6;
      });
    });

    doc.end();
  });
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

    doc.fontSize(11).fillColor(GRAY).font(RB).text(plan.summary.split + "  -  " + plan.summary.split_desc.toUpperCase(), M, y, { align: "center", width: CW, characterSpacing: 2 });
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
      const isRest = item.workout.toLowerCase().includes("poc");
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

async function sendCombinedEmail(userData, mealPDF, trainingPDF) {
  const name = userData.name !== "ni podatka" ? userData.name : "stranka";
  await axios.post("https://api.resend.com/emails", {
    from: "Plan Generator <onboarding@resend.dev>",
    to: NOTIFY_EMAIL,
    subject: name + " - jedilnik + trening program",
    html: "<div style='font-family:Arial,sans-serif;background:#111;color:#fff;padding:30px;border-radius:8px;'><h2 style='color:#CC1F1F;'>GAL REMEC COACHING</h2><p>Jedilnik in trening program za <strong>" + name + "</strong> sta pripravljena.</p><table style='margin-top:16px;'><tr><td style='color:#888;padding:4px 12px 4px 0'>Ime:</td><td>" + name + "</td></tr><tr><td style='color:#888;padding:4px 12px 4px 0'>Cilj:</td><td>" + userData.goal + "</td></tr><tr><td style='color:#888;padding:4px 12px 4px 0'>Teza:</td><td>" + userData.weight + " kg</td></tr><tr><td style='color:#888;padding:4px 12px 4px 0'>Lokacija:</td><td>" + userData.location + "</td></tr></table></div>",
    attachments: [
      { filename: "jedilnik-" + name.replace(/ /g, "-") + ".pdf", content: mealPDF.toString("base64") },
      { filename: "trening-" + name.replace(/ /g, "-") + ".pdf", content: trainingPDF.toString("base64") },
    ],
  }, { headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" } });
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", model: MODEL });
});

app.post("/webhook-combined", async (req, res) => {
  console.log("Webhook combined received");
  res.status(200).json({ received: true });
  const userData = parseCombinedTallyData(req.body);
  try {
    console.log("Generating meal plan...");
    const mealPlan = await generateMealPlan(userData);
    console.log("Meal plan done");
    console.log("Generating training plan...");
    const trainingPlan = await generateTrainingPlan(userData);
    console.log("Training plan done");
    console.log("Generating PDFs...");
    const mealPDF = await generateMealPDF(userData, mealPlan);
    const trainingPDF = await generateTrainingPDF(userData, trainingPlan);
    console.log("PDFs done");
    await sendCombinedEmail(userData, mealPDF, trainingPDF);
    console.log("Email sent to:", NOTIFY_EMAIL);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
});

downloadFonts().then(() => {
  app.listen(PORT, () => {
    console.log("Port " + PORT + " | Model: " + MODEL + " | API key: " + (ANTHROPIC_API_KEY ? "OK" : "MISSING"));
  });
}).catch((err) => {
  console.error("Font download failed:", err.message);
  process.exit(1);
});

