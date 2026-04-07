import express from &quot;express&quot;;
import axios from &quot;axios&quot;;
import {
Document, Packer, Paragraph, TextRun,
Table, TableRow, TableCell,
AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
Header, Footer, PageBreak, TabStopType,
} from &quot;docx&quot;;
const app = express();
app.use(express.json());
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
const MODEL = &quot;claude-sonnet-4-6&quot;;
const PORT = process.env.PORT || 3000;
if (!ANTHROPIC_API_KEY) {
console.error(&quot;ANTHROPIC_API_KEY is not set.&quot;);
process.exit(1);
}
// -- Design palette (hex without #, matching original PDF) -------------
-------
const DARK_BG = &quot;111111&quot;;
const DARK_CARD = &quot;1A1A1A&quot;;
const DARK_ROW = &quot;161616&quot;;
const RED = &quot;CC1F1F&quot;;
const WHITE = &quot;FFFFFF&quot;;
const GRAY = &quot;888888&quot;;
const LIGHT = &quot;CCCCCC&quot;;
// -- Page geometry (DXA units, A4: 1440 DXA = 1 inch) ------------------
------
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 800; // ~40 pt, matching original PDF margins
const CW = PAGE_W - MARGIN * 2; // 10306 DXA usable content width
// -- Border / shading helpers ------------------------------------------
-------
const nb = { style: BorderStyle.NONE, size: 0, color: &quot;auto&quot; };
const rb = (sz = 8) =&gt; ({ style: BorderStyle.SINGLE, size: sz, color: RED
});
const tableBorders = {
top: nb, bottom: nb, left: nb, right: nb,
insideHorizontal: nb, insideVertical: nb,
};
const cellBorders = { top: nb, bottom: nb, left: nb, right: nb };
// Spacer paragraph (spacing.after in twips: 240 twips = 12 pt)
const sp = (after = 120) =&gt; new Paragraph({ children: [], spacing: {
before: 0, after } });
// -- FOOD_DB -----------------------------------------------------------
-------
const FOOD_DB = `

MESO IN PERUTNINA (na 100g surovo):
Piščančja prsa: 110kcal, 23g B | Piščančja stegna (brez kosti): 160kcal,
19g B | Puranja prsa: 114kcal, 24g B | Goveji zrezek (pusto): 150kcal,
22g B | Goveje meso mleto 5%: 135kcal, 21g B | Goveje meso mleto 20%:
250kcal, 17g B | Svinjski file: 143kcal, 21g B | Teletina: 110kcal, 20g B
| Srna: 120kcal, 22g B | Jelenjad: 125kcal, 22g B
MESNI IZDELKI (na 100g):
Kuhan pršut/šunka: 110kcal, 18g B | Puranja šunka: 90kcal, 17g B |
Piščančja prsa v ovitku: 85kcal, 16g B | Kraški pršut: 260kcal, 26g B |
Hrenovka: 280kcal, 12g B | Čevapčiči surovi: 250kcal, 15g B
RIBE (na 100g):
Losos svež: 208kcal, 20g B | Tuna v lastnem soku: 116kcal, 25g B | Tuna v
olju: 198kcal, 24g B | Skuša sveža: 305kcal, 19g B | Oslič: 90kcal, 17g B
| Postrv: 148kcal, 21g B | Sardine v olju: 208kcal, 24g B | Tilapija:
128kcal, 26g B | Trska: 82kcal, 18g B | Kozice: 99kcal, 24g B
MLEČNI IZDELKI (na 100g):
Mleko 3.5%: 64kcal, 3.3g B | Grški jogurt 0%: 59kcal, 10g B | Grški
jogurt 2%: 75kcal, 9.5g B | Skyr: 65kcal, 11g B | Pusta skuta: 72kcal,
12g B | Sir Cottage light: 70kcal, 12g B | Mozzarella light: 165kcal, 20g
B | Parmezan: 431kcal, 38g B | Feta: 264kcal, 14g B | Ovseni napitek:
42kcal, 1g B | Mandljev napitek: 13kcal, 0.4g B | Kefir: 62kcal, 3.3g B
JAJCA (na 100g):
Kokošje jajce celo: 155kcal, 13g B | Jajčni beljak: 52kcal, 11g B
ZELENJAVA (na 100g surovo):
Brokoli: 34kcal, 2.8g B | Špinača: 23kcal, 2.9g B | Paprika rdeča:
31kcal, 1g B | Kumara: 15kcal, 0.7g B | Paradižnik: 18kcal, 0.9g B |
Korenje: 41kcal, 0.9g B | Rukola: 25kcal, 2.6g B | Cvetača: 25kcal, 1.9g
B | Bučka: 17kcal, 1.2g B | Šampinjoni: 22kcal, 3.1g B | Čebula: 40kcal,
1.1g B | Sladki krompir: 86kcal, 1.6g B | Koruza sladka: 86kcal, 3.2g B |
Šparglji: 20kcal, 2.2g B
STROČNICE (na 100g):
Fižol kuhan: 127kcal, 8.7g B | Čičerika kuhana: 164kcal, 8.9g B | Leča
kuhana: 116kcal, 9g B
SADJE (na 100g):
Banana: 89kcal, 1.1g B | Jabolko: 52kcal, 0.3g B | Jagode: 32kcal, 0.7g B
| Borovnice: 57kcal, 0.7g B | Avokado: 160kcal, 2g B | Pomaranča: 47kcal,
0.9g B | Kivi: 61kcal, 1.1g B
ŽITA (na 100g suho):
Beli riž: 360kcal, 7g B | Basmati riž: 345kcal, 8.5g B | Ovseni kosmiči:
389kcal, 13.5g B | Testenine bele: 350kcal, 12g B | Polnozrnate
testenine: 340kcal, 14g B | Krompir surovi: 77kcal, 2g B | Kvinoja:
368kcal, 14g B | Ajdova kaša: 343kcal, 13g B
KRUH (na 100g):
Polnozrnati kruh: 250kcal, 9.7g B | Toast polnozrnat: 260kcal, 9g B |
Toast beli: 285kcal, 8.3g B | Tortilja pšenična: 310kcal, 8g B
OREŠKI (na 100g):
Mandlji: 579kcal, 21g B | Orehi: 654kcal, 15g B | Arašidovo maslo:
588kcal, 25g B | Chia semena: 486kcal, 17g B | Sončnična semena: 584kcal,
21g B
OLJA (na 100g):
Oljčno olje: 884kcal, 0g B | Maslo: 717kcal, 0.8g B
DODATKI (na 100g):
Med: 304kcal, 0.3g B | Sojina omaka: 53kcal, 8g B | Whey protein:
380kcal, 80g B | Veganski protein: 370kcal, 75g B
`;
// -- System prompts ----------------------------------------------------
-------

const MEAL_SYSTEM_PROMPT = `Si Gal Remec, slovenski online fitnes trener
z 500+ uspešnimi transformacijami. Pišeš jedilnike v svojem stilu.
JEZIK: Knjižna slovenščina s šumniki. Brez emojijev. Pravilna ločila.
Številke s presledkom (114 g). Brez anglicizmov.
TON: Strokoven, direkten, oseben, človeški. Naslavljaj z imenom in &quot;ti&quot;.
Piši tekoče, kot bi se pogovarjal z osebo – brez oklepajev, vezajev kot
seznamov, dvopičij kot uvoda v podatke. Nikoli ne uporabi alinej ali
bullet točk v uvodnih tekstih – samo tekoči odstavki.
ADAPTATIONS (8–12 povedi v tekočih odstavkih): Piši človeško in tekoče.
Obvezno vključi:
- Kontekst: na podlagi katerih podatkov je plan sestavljen (telesna masa,
višina, aktivnost, cilj)
- Razlaga kaloričnega okvirja in zakaj je tak nastav – prevelik deficit
vodi v lakoto in izgubo mišične mase, premajhen v stagnacijo
- Pomen beljakovin: mišična masa, sitost, regeneracija – specifično za
cilj stranke
- Katere beljakovinske vire si vključil glede na preference stranke
- Ogljikovi hidrati: vloga glede na aktivnost, ne omejuj agresivno ker
vplivajo na trening performans
- Maščobe: zmerne, kontrolirane, tehtanje ključno pri kalorično gostih
živilih
- Prilagodljivost jedilnikov: niso toga pravila ampak strukturiran okvir
– zamenjave so dovoljene in priporočene dokler okvir ostane stabilen
- Štetje kalorij: nujnost tehtanja hrane in vnašanja v aplikacijo
(MyFitnessPal), fokus na kalorije in beljakovine
- Nasvet za zamenjave živil – piščančja prsa zamenjaj s puranjimi, riž s
krompirjem itd, dokler so kalorije in beljakovine znotraj okvirja
Brez navajanja TDEE, BMR ali deficita kot številk. Brez ponavljanja
podatkov iz vprašalnika. Brez oklepajev, vezajev in dvopičij kot
seznamov.
INTRO (4–6 povedi): Zaključni motivacijski del. Kako meriti napredek –
tedensko povprečje telesne teže, ne dnevne meritve, ogledalo, performans
na treningu. Tehtnica lahko niha 1–2 kg na dan. Doslednost – napredek ni
rezultat enega dobrega tedna ampak mesecev konsistentnega dela. Človeško,
toplo, brez številk.
NAČELA:
- Deficit 500 kcal = 0,5 kg/teden za hujšanje. Prevelik deficit vodi v
lakoto, slabšo regeneracijo in izgubo mišične mase.
- Beljakovine 1,8–2,2 g/kg. Jasen vir beljakovin v VSAKEM obroku – to je
ne-negotiable pravilo.
- 25–40 g beljakovin na obrok.
- Ogljikovi hidrati: ne omejuj agresivno, vplivajo na trening performans.
- Maščobe: zmerne, kontrolirane. Problem pri maščobah je kalorična
gostota, zato je tehtanje ključno.
- Obroki: enostavni, hitri za pripravo, smiselni, okusni, ponovljivi.
Brez eksotike in kompliciranja.
- Zelenjava: VEDNO v obliki &quot;150 g zelenjave po izbiri&quot; ali podobno –
nikoli specifično določena zelenjava razen če jo stranka posebej omeji
ali prosi. Uporabljaj zelenjavo za volumen pri hujšanju – ne z
makrohranili.
- Vsa živila se tehtajo surova. Riž, testenine in krompir se tehtajo
kuhani (100 g surovega riža = 300 g kuhanega, 100 g surovih testenin =
250 g kuhanih, 100 g surovega krompirja = 87 g kuhanega). V adaptations
omeni ta merila.

- Personalizacija je absolutna prioriteta – strankine želje, preference
in omejitve so zakon.
RAZNOLIKOST MED DNEVI: Vsak dan mora imeti drugačne obroke kot ostala dva
dni. Nikoli ne ponovi istega obroka (ali skoraj identičnega obroka) na
isti poziciji v različnih dneh. Če je dan 1 zajtrk ovsena kaša z
jogurtom, dan 2 in dan 3 ne smeta imeti ovsene kaše z jogurtom za zajtrk.
Vsak obrok mora biti vsebinsko različen – različna živila, različna
kombinacija, različen stil priprave. Isto živilo (npr. piščanec) je
dovoljeno v različnih dneh, ampak v drugačni obliki ali kombinaciji (npr.
dan 1 piščanec z rižem, dan 3 piščanec s kruhom/sendvič). Brez copy-paste
obrokov med dnevi.
LOGIKA SESTAVE OBROKOV: Vsak obrok mora biti kulinarično in praktično
smiseln – takšen kot ga nekdo dejansko pripravi in poje v enem obroku. V
vsakem obroku je EN jasen protein vir. Ne mešaj nekompatibilnih živil
samo zato da ustrežeš makrotom.
Dobre kombinacije:
- Whey/skyr/jogurt/skuta + ovseni kosmiči/sadje/oreščki/arašidovo maslo
- Jajca + kruh/toast + zelenjava ali sir ali šunka
- Piščanec/govedina/riba/tuna + riž/krompir/testenine + zelenjava
- Skuta/jogurt + sadje + oreščki (snack obrok)
- Tuna/piščanec + kruh = sendvič stil
Prepovedane kombinacije v istem obroku:
- Whey protein skupaj z jajci ali mesom – ne sodijo skupaj
- Piščanec ali riba z ovsenimi kosmiči – kulinarično nesmiselno
- Dva vira mesa ali dva proteinska praška v istem obroku
- Več kot en &quot;težek&quot; protein v istem obroku (npr. jajca + piščanec +
whey)
Pravilo: Whey/proteinsko mleko/jogurt → brez jajc in mesa v tem obroku.
Jajca ali meso → brez wheya v tem obroku.
DOVOLJENI VIRI HRANIL:
Beljakovine: piščančje prsi, puranja prsa, govedina (pusta 5%), bele ribe
(oslič, tilapija, brancin), losos, tuna, grški jogurt (0%, 5%, 10%),
jajca, skyr, whey protein, proteinsko mleko, zrnati sir, skuta
Ogljikovi hidrati: ovseni kosmiči, basmati riž, beli riž, polnozrnate
testenine, bele testenine, krompir, sladki krompir, polnozrnat kruh, beli
kruh, sadje (banana, jabolko, hruška, jagode, borovnice, maline, mango
itd.)
Maščobe: oreščki (mandlji, orehi, arašidi itd.), avokado, olivno olje,
maslo, arašidovo maslo, temna čokolada, losos, jajca
JUNK FOOD PRAVILO: Če stranka v preferencah navede da želi imeti hitro
hrano, junk food ali specifičen junk food izdelek (npr. Big Mac, pizza,
čips, burger itd.), ga OBVEZNO vključi v jedilnik – to je njena
preferenca in jo moraš spoštovati. STROGO PRAVILO: Junk food nikoli ne
sme preseči 20% dnevnih kalorij. Preostalih 80% kalorij mora priti iz
zdravih, polnovrednih virov. Junk food vključi v en obrok na dan (tipično
večer ali popoldne), nikoli ne razporediti čez cel dan. V adaptations
omeni da si upošteval to željo in poudariti 20% pravilo.
PREPOVEDANA ŽIVILA: Nikoli ne vključi humusa, soje in sojinih izdelkov
(sojin jogurt, sojin napitek, sojini koščki, tofu, tempeh, edamame). To
velja za VSE stranke brez izjeme.`;

const TRAINING_SYSTEM_PROMPT = `Si Gal Remec, slovenski online fitnes
trener z 500+ uspešnimi transformacijami. Pišeš trening programe v svojem
stilu.
JEZIK: Knjižna slovenščina s šumniki. Nazivi vaj v angleščini. Brez
emojijev.
TON: Strokoven, direkten, človeški – naslavljaj z imenom in &quot;ti&quot;. Piši
tekoče, brez oklepajev in vezajev. Nikoli ne uporabi alinej ali bullet
točk v uvodnem tekstu – samo tekoči odstavki.
INTRO (12–16 povedi v tekočih odstavkih): Začni z &quot;Ta trening program je
pripravljen glede na...&quot;. Obvezno vključi:
- Kontekst: starost, telesna masa, aktivnost, cilj
- Opis strukture programa (koliko dni, kakšne enote, zakaj ta
razporeditev)
- Ogrevanje: specifično za vsak tip dneva (upper/lower/itd.), 5–10 minut
dinamičnega ogrevanja, 1–2 pripravljalni seriji z nižjo težo za prvo vajo
- Intenzivnost: vsaka delovna serija je resna serija, blizu odpovedi, 1–2
ponovitvi v rezervi
- Tehnika: absolutna prioriteta, kontroliran spust, poln obseg giba, brez
sunkov – specifični nasveti za ključne vaje programa
- Počitek med serijami: 2–3 minute pri compound vajah, 60–90 sekund pri
izolacijah – ne štopaj, poslušaj telo
- Progresivna obremenitev: ko v obeh delovnih serijah dosežeš zgornjo
mejo razpona ponovitev s čisto izvedbo, naslednji trening rahlo povečaj
težo ali dodaj ponovitev – to je edini način za dolgoročen napredek
- Fokus med izvedbo: miselna povezava z mišico, telefon stran, brez
pogovarjanja med vajami
- Poslušanje telesa: mišična utrujenost je normalna, ostra bolečina v
sklepu ni – prilagoditev ni korak nazaj
- Poškodbe (če obstajajo): specifični napotki za vsako poškodbo ali
omejitev
- Regeneracija: spanje, prehrana, stabilen ritem
- Zadnji odstavek vedno o doslednosti kot ključu do rezultatov
NAČELA:
- 2 delovni seriji na vajo. Nikoli več razen če je eksplicitno
utemeljeno.
- Maksimalno 6 vaj na trening.
- Razpon ponovitev: Moč 4–6 ali 5–8, Hipertrofija 6–12 ali 8–12,
Izolacija 12–15 ali 15–20.
- Vsaka delovna serija blizu tehnične odpovedi – 1–2 ponovitvi v rezervi.
- Compound vaje VEDNO na začetku, izolacijske na koncu. Brez izjem.
- Počitek: 2–3 minute za compound, 60–90 sekund za izolacije.
STRUKTURA GLEDE NA FREKVENCO:
2x/teden → Full Body
3x/teden → Upper/Upper/Lower ali Lower/Lower/Upper ali Push/Pull/Legs (v
fitnesu). Odvisno od spola, ciljev in opreme.
4x/teden → Upper/Lower/Upper/Lower ali Push/Pull/Legs + Arms &amp; Shoulders
ali Upper/Lower/Core+Cardio/Upper ali Lower
5x/teden → Upper/Lower/Arms+Shoulders/Upper/Lower ali
Push/Pull/Legs/Upper/Lower ali Push/Pull/Legs/Arms+Shoulders/Core+Cardio
6x/teden → Push/Pull/Legs/Push/Pull/Legs ali
Upper/Lower/Posterior/Anterior/Arms+Shoulders/Core+Cardio
To ni fiksno – je izhodišče za logično presojo glede na cilj, nivo in
opremo. Končna odločitev vedno upošteva cilj stranke.

RAZPORED POČITKA:
Po vsakem treningu mora biti vsaj vsak 2. dan počitek ali 2 zaporedna
treninga in nato počitek. Pri 5 treningih: 2 treningi, počitek, 3
treningi (3. je lažji in manj izčrpavajoč), počitek. Pri 6 treningih:
PPL, počitek, PPL, počitek.
POUDARKI GLEDE NA SPOL:
Ženske: poudarek na nogah, zadnjici, coru in trebuhu. Zgornji del ni
poglavitni fokus – prisoten je za uravnotežen razvoj, ne dominira.
Moški: uravnotežen razvoj, poudarek na prsi, hrbtu, ramenih, rokah in
nogah glede na cilj.
CARDIO: Dodaj SAMO če posameznik ni aktiven (pod 5000 korakov/dan) ali je
v slabi fizični formi. Aktivnim strankam cardio ni potreben razen če
specifično zahtevano ali v opombah navedeno.
KARDIO NAVODILA (za kardio dneve):
- Kardio dan mora biti napisan kot workout z vajami (naprava, čas, kcal)
- Opcije: Sobno kolo (30–45 min, 250–400 kcal), Tek na tekoči stezi
(25–40 min, 250–400 kcal, 8–11 km/h), Eliptični trenažer (30–45 min,
280–400 kcal), Veslarski ergometer (20–30 min, 250–350 kcal), Stairmaster
(25–35 min, 300–400 kcal), Hoja na nagnjeni tekoči stezi (35–50 min,
200–300 kcal, naklon MINIMALNO 10%, nikoli manj, hitrost 5–6 km/h)
- Za kardio dan naredi workout z 2–3 napravami, vsaka ima: ime naprave,
čas in približni kcal, navodila za intenzivnost
SCHEDULE PRAVILO: V polju &quot;workout&quot; v razporedu napiši SAMO ime treninga
brez oklepajev, razlag ali mišičnih skupin. Primer: &quot;UPPER A&quot; ne &quot;UPPER A
(prsi, ramena, triceps)&quot;. &quot;Počitek&quot; ne &quot;Počitek (regeneracija)&quot;.
DOVOLJENE VAJE DOMA (samo z opremo ki jo stranka ima):
Zgornji del: Push-up (wide grip, close grip, diamond, weighted, na
kolenih), floor press, dumbbell floor press, bent-over barbell/dumbbell
row, single-arm dumbbell row (opora na klopi ali stolu), biceps curl,
hammer curl, overhead triceps extension, chair dips, lateral raises,
bent-over rear delt fly, face pull z elastiko, chest fly z elastiko,
pullover z elastiko, straight bar curl, EZ bar curl
Jedro: Dead bug, bird dog, plank, side plank, leg raises, hanging leg
raises (če ima palico), cable crunch z elastiko, Pallof press z elastiko,
Russian twist, trebušnjaki, ab wheel
Noge: Goblet squat, barbell squat, Romanian deadlift, walking lunges,
reverse lunge, Bulgarian split squat, glute bridge, standing calf raises,
abdukcije z elastiko, step-up (na klop ali stol)
DOVOLJENE VAJE V FITNESU:
Prsi: machine chest press, dumbbell bench press, incline dumbbell press,
incline smith machine press, cable chest press, flat dumbbell press, pec
deck fly, cable fly, dips
Hrbet: lat pulldown (wide/close grip), seated cable row, close grip cable
row, chest-supported row, barbell row, dumbbell row, single-arm row,
straight-arm pulldown, face pull, pull-up, assisted pull-up, machine row
Ramena: dumbbell shoulder press, machine shoulder press, seated dumbbell
press, lateral raises, cable lateral raise, rear delt fly
(naprava/ročke), face pull, shrug
Roke: EZ bar curl, dumbbell biceps curl, cable curl, straight bar curl,
hammer curl, incline dumbbell curl, overhead triceps extension (vse
variacije), cable triceps pushdown, skull crusher, dips, close-grip bench
press

Noge: back squat, hack squat, goblet squat, smith machine squat, pendulum
squat, leg press, leg extension, leg curl (leže/sede), Romanian deadlift,
hip thrust (barbell/mašina), glute bridge, Bulgarian split squat, walking
lunges, reverse lunge, step-up, cable kickback, abduction machine,
adduction machine, standing/seated calf raises, back extension
Jedro: hanging leg raises, cable crunch, ab wheel, dead bug, plank, side
plank, Pallof press, Russian twist
OPREMA – STROGO PRAVILO: Sestavi program IZKLJUČNO iz opreme ki jo je
stranka eksplicitno navedla. Ne predpostavljaj NIČESAR kar ni omenjeno.
Če stranka napiše samo &quot;dumbbell&quot; ali &quot;uteži&quot; ali &quot;utež&quot; – program
vsebuje SAMO vaje z dumbbelli/utežmi. Brez pull-up bara, brez kablov,
brez naprav, brez klopi, brez vrat – razen če je eksplicitno napisano.
Dvomiš? Izpusti vajo.`;
// -- Utility functions -------------------------------------------------
-------
function norm(str) {
return (str || &quot;&quot;)
.normalize(&quot;NFD&quot;)
.replace(/[\u0300-\u036f]/g, &quot;&quot;)
.toLowerCase();
}
function parseCombinedTallyData(body) {
const fields = body?.data?.fields ?? [];
const get = (label) =&gt; {
const f = fields.find((f) =&gt; norm(f.label ||
&quot;&quot;).includes(norm(label)));
return f?.value ?? &quot;ni podatka&quot;;
};
const getChoice = (label) =&gt; {
const field = fields.find((f) =&gt; norm(f.label ||
&quot;&quot;).includes(norm(label)));
if (!field) return &quot;ni podatka&quot;;
const options = field.options ?? [];
const selected = Array.isArray(field.value) ? field.value :
[field.value];
const matched = options.filter((o) =&gt;
selected.includes(o.id)).map((o) =&gt; o.text);
return matched.length &gt; 0 ? matched.join(&quot;, &quot;) : &quot;ni podatka&quot;;
};
const data = {
name: get(&quot;ime in priimek&quot;) || get(&quot;ime&quot;),
age: get(&quot;starost&quot;),
weight: get(&quot;teza&quot;),
height: get(&quot;visina&quot;),
goal: get(&quot;cilj&quot;),
activity: getChoice(&quot;korakov dela&quot;) || getChoice(&quot;korakov naredi&quot;) ||
get(&quot;korakov&quot;),
likes: get(&quot;kaj rad&quot;) || get(&quot;jedilnik na podlagi&quot;),
dislikes: get(&quot;hrane ne maras&quot;) || get(&quot;ne maras&quot;),
meals: get(&quot;koliko obrokov&quot;),
allergies: get(&quot;alergije&quot;) || get(&quot;jedilnika&quot;),
location: get(&quot;kje zelis trenirati&quot;) || get(&quot;kje&quot;),
equipment: get(&quot;od doma napisi&quot;) || get(&quot;opremo imas&quot;),
exDislikes: get(&quot;katerih vaj ne maras&quot;) || get(&quot;vaj ne&quot;),
exLikes: get(&quot;vaje imas rad&quot;) || get(&quot;vaje rad&quot;),

frequency: get(&quot;kolikokrat&quot;),
injuries: get(&quot;poskodbe&quot;) || get(&quot;zdravjem&quot;),
trainingNotes: get(&quot;sestave treninga&quot;),
};
console.log(&quot;Parsed:&quot;, JSON.stringify(data));
return data;
}
async function generateMealPlan(userData) {
const mealsCount = parseInt(userData.meals) || 4;
const weight = parseFloat(userData.weight) || 80;
const height = parseFloat(userData.height) || 175;
const age = parseFloat(userData.age) || 25;
const name = userData.name !== &quot;ni podatka&quot; ? userData.name :
&quot;stranka&quot;;
const bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
let activityMultiplier = 1.375;
const act = norm(userData.activity);
if (act.includes(&quot;0-3k&quot;) || act.includes(&quot;malo&quot;)) activityMultiplier =
1.2;
else if (act.includes(&quot;3-5k&quot;)) activityMultiplier = 1.375;
else if (act.includes(&quot;5-7k&quot;) || act.includes(&quot;srednje&quot;))
activityMultiplier = 1.375;
else if (act.includes(&quot;7-10k&quot;) || act.includes(&quot;veliko&quot;))
activityMultiplier = 1.55;
else if (act.includes(&quot;10-15k&quot;)|| act.includes(&quot;zelo veliko&quot;))
activityMultiplier = 1.55;
else if (act.includes(&quot;20k&quot;)) activityMultiplier = 1.725;
const tdee = Math.round(bmr * activityMultiplier);
const goalLower = norm(userData.goal);
let targetCalories, planType;
if (goalLower.includes(&quot;huj&quot;) || goalLower.includes(&quot;cut&quot;) ||
goalLower.includes(&quot;izgub&quot;)) { targetCalories = tdee - 500; planType =
&quot;CUT&quot;; }
else if (goalLower.includes(&quot;masa&quot;)|| goalLower.includes(&quot;bulk&quot;) ||
goalLower.includes(&quot;pridobi&quot;)){ targetCalories = tdee + 300; planType =
&quot;BULK&quot;; }
else { targetCalories = tdee; planType = &quot;MAINTAIN&quot;; }
const targetProtein = Math.round(weight * 2.0);
// Display ranges (rounded to nearest 50 kcal ±50, nearest 10g protein
±10)
const calBase = Math.round(targetCalories / 50) * 50;
const calRange = `${calBase - 50}–${calBase + 50}`;
const protBase = Math.round(targetProtein / 10) * 10;
const protRange = `${protBase - 10}–${protBase + 10}`;
const prompt = `Ustvari 3-dnevni prehranski načrt. Vrni SAMO čisti
JSON.
BAZA ŽIVIL:
${FOOD_DB}
IZRAČUNANI PODATKI (za interno izračunavanje obrokov):
- Cilj: ${targetCalories} kcal (${planType}) | Beljakovine:
${targetProtein} g
PRIKAZ V DOKUMENTU (uporabi te razpone v JSON poljih calories_per_day,
protein_per_day in v vsakem dnevu):
- Kalorije: &quot;${calRange}&quot; | Beljakovine: &quot;${protRange} g&quot;
STRANKA: ${name}, ${age} let, ${weight} kg, ${height} cm, cilj:
${userData.goal}

Rad je: ${userData.likes} | Ne mara: ${userData.dislikes} | Obroki:
${mealsCount} | Alergije: ${userData.allergies}
JSON struktura:
{
&quot;summary&quot;: { &quot;calories_per_day&quot;: &quot;${calRange}&quot;, &quot;protein_per_day&quot;:
&quot;${protRange} g&quot;, &quot;meals_per_day&quot;: ${mealsCount}, &quot;plan_type&quot;:
&quot;${planType}&quot; },
&quot;adaptations&quot;: &quot;UVODNI DEL (8-12 povedi) v knjižni slovenščini s
šumniki, brez emojijev, v tekočih odstavkih brez alinej. Naslavljaj
${name} z &#39;ti&#39;. Vsebuje: 1) Kontekst – na podlagi katerih podatkov je
plan sestavljen (telesna masa, višina, aktivnost, cilj). 2) Razlaga
kaloričnega okvirja – zakaj je tak nastav smiseln za strankin cilj, kaj
to pomeni v praksi. Navedi kalorični razpon ${calRange} kcal. 3) Pomen
beljakovin (${protRange} g) – ohranitev mišic, sitost, regeneracija. 4)
Katere beljakovinske vire si vključil glede na preference stranke. 5)
Ogljikovi hidrati – kateri viri, vloga glede na aktivnost, ne omejuj
agresivno. 6) Maščobe – zmerno, tehtanje ključno pri kalorično gostih
živilih. 7) Prilagodljivost jedilnikov – niso toga pravila ampak okvir,
zamenjave dovoljene dokler kalorije in beljakovine ostanejo znotraj
okvirja. 8) Štetje kalorij – nujnost tehtanja in vnašanja v MyFitnessPal,
fokus na kalorije in beljakovine. 9) Merila za kuhanje: riž 100 g
surovega = 300 g kuhanega, testenine 100 g surovih = 250 g kuhanih,
krompir 100 g surovega = 87 g kuhanega, vsa živila se tehtajo surova
razen riž testenine in krompir ki se tehtajo kuhani. Brez navajanja TDEE
ali BMR kot številk. Brez oklepajev in vezajev.&quot;,
&quot;intro&quot;: &quot;ZAKLJUČNI DEL (4-6 povedi) v knjižni slovenščini s šumniki,
brez emojijev. Vsebuje: 1) Napredek – kako ga meriti: tedensko povprečje
telesne teže (ne dnevne meritve, tehtnica niha 1-2 kg na dan), ogledalo,
performans na treningu. 2) Doslednost – napredek ni rezultat enega
dobrega tedna ampak mesecev konsistentnega dela. 3) Motivacijski
zaključek. Brez oklepajev in vezajev.&quot;,
&quot;days&quot;: [{ &quot;day&quot;: 1, &quot;calories&quot;: &quot;${calRange}&quot;, &quot;protein&quot;:
&quot;${protRange} g&quot;, &quot;meals&quot;: [{ &quot;number&quot;: 1, &quot;name&quot;: &quot;ZAJTRK&quot;, &quot;calories&quot;:
500, &quot;protein&quot;: 35, &quot;ingredients&quot;: [&quot;100 g ovsenih kosmičev (389 kcal,
13,5 g B)&quot;] }] }]
}
PRAVILA:
- ${mealsCount} obrokov/dan, 3–6 sestavin z gramažo in kcal v oklepaju
- Vsak obrok ima jasen vir beljakovin, ogljikovih hidratov in zdravih
maščob
- Zelenjava VEDNO kot &quot;150 g zelenjave po izbiri&quot; ali podobno – nikoli
specifično določena zelenjava
- Vsa živila se tehtajo surova. Riž, testenine in krompir se tehtajo
KUHANI (100 g surovega riža = 300 g kuhanega, 100 g surovih testenin =
250 g kuhanih)
- Pri hujšanju dodajaj volumen z zelenjavo, ne z makrohranili
- Enostavni, hitri za pripravo, smiselni, okusni obroki – brez eksotike
in kompliciranja
- Vsak obrok ima EN protein vir. NE mešaj whey + jajca, NE mešaj piščanca
z ovsenimi kosmiči – samo kulinarično logične kombinacije
- RAZNOLIKOST: Vsak dan mora imeti drugačne obroke. Ne ponavljaj istega
obroka na isti poziciji v različnih dneh (npr. isti zajtrk dan 1 in dan 3
je prepovedano)
- Če stranka želi junk food (navedeno v preferencah), ga OBVEZNO vključi
v en obrok na dan – MAKSIMALNO 20% dnevnih kalorij (= max
${Math.round(targetCalories * 0.2)} kcal) iz junk fooda, preostalih 80%
iz zdravih virov

- NE vključi: ${userData.dislikes}, ${userData.allergies}, humus, soja,
sojini izdelki, tofu, tempeh, edamame
- SAMO JSON.`;
const response = await
axios.post(&quot;https://api.anthropic.com/v1/messages&quot;, {
model: MODEL, max_tokens: 4096,
system: MEAL_SYSTEM_PROMPT,
messages: [{ role: &quot;user&quot;, content: prompt }],
}, {
headers: { &quot;x-api-key&quot;: ANTHROPIC_API_KEY, &quot;anthropic-version&quot;:
&quot;2023-06-01&quot;, &quot;content-type&quot;: &quot;application/json&quot; },
timeout: 120000,
});
const text = response.data?.content?.find((b) =&gt; b.type ===
&quot;text&quot;)?.text;
if (!text) throw new Error(&quot;Prazen odgovor&quot;);
return JSON.parse(text.replace(/```json|```/g, &quot;&quot;).trim());
}
async function generateTrainingPlan(userData) {
const name = userData.name !== &quot;ni podatka&quot; ? userData.name :
&quot;stranka&quot;;
const days = parseInt(userData.frequency) || 3;
let splitType, splitDesc;
if (days &lt;= 2) { splitType = &quot;FULL BODY&quot;; splitDesc = &quot;2 dni na teden&quot;;
}
else if (days === 3) { splitType = &quot;PUSH / PULL / LEGS&quot;; splitDesc = &quot;3
dni na teden&quot;; }
else if (days === 4) { splitType = &quot;UPPER / LOWER&quot;; splitDesc = &quot;4 dni
na teden&quot;; }
else if (days === 5) { splitType = &quot;UPPER / LOWER / ARMS + SHOULDERS&quot;;
splitDesc = &quot;5 dni na teden&quot;; }
else { splitType = &quot;PUSH / PULL / LEGS&quot;; splitDesc = days + &quot; dni na
teden&quot;; }
const prompt = `Ustvari personaliziran trening program. Vrni SAMO čisti
JSON.
STRANKA: ${name}, ${userData.age} let, ${userData.weight} kg, aktivnost:
${userData.activity}, cilj: ${userData.goal}, lokacija:
${userData.location}, oprema: ${userData.equipment}
Ne mara vaj: ${userData.exDislikes} | Ima rad: ${userData.exLikes}
Treningov/teden: ${days} | Poškodbe: ${userData.injuries} | Opombe:
${userData.trainingNotes}
PREDLAGAN SPLIT: ${splitType} (prilagodi glede na cilj, nivo, opremo in
opombe stranke po pravilih iz sistema)
JSON struktura:
{
&quot;summary&quot;: { &quot;name&quot;: &quot;${name}&quot;, &quot;days_per_week&quot;: ${days}, &quot;split&quot;:
&quot;${splitType}&quot;, &quot;split_desc&quot;: &quot;${splitDesc}&quot;, &quot;location&quot;:
&quot;${userData.location}&quot; },
&quot;intro&quot;: &quot;12-16 povedi v tekočih odstavkih, knjižna slovenščina,
šumniki, brez emojijev, brez alinej ali bullet točk. Začni z &#39;Ta trening
program je pripravljen glede na...&#39;&quot;,
&quot;schedule&quot;: [{ &quot;day&quot;: &quot;Ponedeljek&quot;, &quot;workout&quot;: &quot;PUSH&quot; }, { &quot;day&quot;:
&quot;Torek&quot;, &quot;workout&quot;: &quot;Počitek&quot; }, { &quot;day&quot;: &quot;Sreda&quot;, &quot;workout&quot;: &quot;PULL&quot; }, {
&quot;day&quot;: &quot;Četrtek&quot;, &quot;workout&quot;: &quot;Počitek&quot; }, { &quot;day&quot;: &quot;Petek&quot;, &quot;workout&quot;:
&quot;LEGS&quot; }, { &quot;day&quot;: &quot;Sobota&quot;, &quot;workout&quot;: &quot;Počitek&quot; }, { &quot;day&quot;: &quot;Nedelja&quot;,
&quot;workout&quot;: &quot;Počitek&quot; }],

&quot;workouts&quot;: [{ &quot;name&quot;: &quot;PUSH&quot;, &quot;exercises&quot;: [{ &quot;name&quot;: &quot;Smith machine
bench press&quot;, &quot;sets_reps&quot;: &quot;2 x 6-10&quot;, &quot;note&quot;: &quot;Kontroliran spust.&quot; }] }]
}
POZOR: Če stranka v opombah specificira točno strukturo treninga (npr.
&quot;2x noge, 3x kardio&quot;, &quot;samo kardio&quot;, &quot;samo noge&quot;), IGNORIRAJ standardni
split in naredi TOČNO to kar stranka zahteva v opombah.
PRAVILA:
- 2 delovni seriji na vajo (format &quot;2 x 6-10&quot;), maksimalno 6 vaj na
trening dan
- Compound vaje na začetku, izolacijske na koncu – vedno, brez izjem
- Razpon ponovitev: compound 5-8 ali 6-10, izolacija 10-15 ali 12-15
- Počitek: 2-3 minute za compound, 60-90 sekund za izolacije
- Kardio dnevi = workout z 2-3 kardio napravami (naprava, čas, kcal,
intenzivnost)
- Hoja na tekoči stezi: naklon VEDNO min 10%, nikoli manj
- Cardio dodaj SAMO če stranka ni aktivna (pod 5000 korakov/dan) ali je v
opombah zahtevano
- Za kardio dneve v schedule napiši &quot;Kardio&quot;
- workouts seznam mora vsebovati KARDIO kot workout dan z vajami (če je
kardio v schedule)
- OPREMA – STROGO PRAVILO: Sestavi program IZKLJUČNO iz opreme ki jo je
stranka eksplicitno navedla. Ne predpostavljaj NIČESAR kar ni omenjeno.
Če stranka napiše samo &quot;dumbbell&quot; ali &quot;uteži&quot; – program vsebuje SAMO vaje
z dumbbelli/utežmi. Brez pull-up bara, brez kablov, brez naprav, brez
klopi, brez vrat – razen če je eksplicitno napisano. Dvomiš? Izpusti
vajo.
- Prilagodi lokaciji (doma = brez naprav razen kar je navedeno, fitnes =
naprave + uteži)
- NE vključi: ${userData.exDislikes}
- Prilagodi poškodbe: ${userData.injuries}
- SAMO JSON`;
const response = await
axios.post(&quot;https://api.anthropic.com/v1/messages&quot;, {
model: MODEL, max_tokens: 4096,
system: TRAINING_SYSTEM_PROMPT,
messages: [{ role: &quot;user&quot;, content: prompt }],
}, {
headers: { &quot;x-api-key&quot;: ANTHROPIC_API_KEY, &quot;anthropic-version&quot;:
&quot;2023-06-01&quot;, &quot;content-type&quot;: &quot;application/json&quot; },
timeout: 120000,
});
const text = response.data?.content?.find((b) =&gt; b.type ===
&quot;text&quot;)?.text;
if (!text) throw new Error(&quot;Prazen odgovor&quot;);
return JSON.parse(text.replace(/```json|```/g, &quot;&quot;).trim());
}
// -- Document design helpers -------------------------------------------
-------
// Shared header: thin red line at top of every page
function makeDocHeader() {
return new Header({
children: [new Paragraph({
children: [],
spacing: { before: 0, after: 0 },
border: { bottom: { style: BorderStyle.SINGLE, size: 48, color:
RED, space: 1 } },

})],
});
}
// Shared footer: red line + brand name at bottom of every page
function makeDocFooter() {
return new Footer({
children: [new Paragraph({
alignment: AlignmentType.CENTER,
children: [new TextRun({ text: &quot;\u00A9 GAL REMEC COACHING&quot;, size:
16, color: GRAY, font: &quot;Arial&quot;, characterSpacing: 40 })],
spacing: { before: 120, after: 0 },
border: { top: { style: BorderStyle.SINGLE, size: 48, color: RED,
space: 6 } },
})],
});
}
// Assemble final Document with dark background + header/footer
function buildDoc(children) {
return new Document({
background: { color: DARK_BG },
sections: [{
properties: {
page: {
size: { width: PAGE_W, height: PAGE_H },
margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right:
MARGIN },
},
},
headers: { default: makeDocHeader() },
footers: { default: makeDocFooter() },
children,
}],
});
}
// Cover page brand block: &quot;GAL REMEC COACHING&quot; + two big title words
function coverBrand(word1, word2) {
return [
new Paragraph({
alignment: AlignmentType.CENTER,
spacing: { before: 800, after: 560 },
children: [new TextRun({ text: &quot;GAL REMEC COACHING&quot;, bold: true,
size: 22, color: RED, font: &quot;Arial&quot;, characterSpacing: 60 })],
}),
new Paragraph({
alignment: AlignmentType.CENTER,
spacing: { before: 0, after: 0 },
children: [new TextRun({ text: word1, bold: true, size: 104, color:
WHITE, font: &quot;Arial&quot; })],
}),
new Paragraph({
alignment: AlignmentType.CENTER,
spacing: { before: 0, after: 560 },
children: [new TextRun({ text: word2, bold: true, size: 104, color:
WHITE, font: &quot;Arial&quot; })],
}),

];
}
// Red horizontal rule paragraph
function redRule(size = 12, after = 280) {
return new Paragraph({
children: [],
spacing: { before: 0, after },
border: { bottom: { style: BorderStyle.SINGLE, size, color: RED,
space: 1 } },
});
}
// Stats boxes: two dark cards side by side (with dark spacer column
between)
function statsTable(leftVal, leftLabel, rightVal, rightLabel) {
const bw = Math.floor((CW - 300) / 2); // each box width
const boxCell = (val, label, w) =&gt; new TableCell({
width: { size: w, type: WidthType.DXA },
shading: { fill: DARK_CARD, type: ShadingType.CLEAR },
borders: cellBorders,
margins: { top: 200, bottom: 200, left: 200, right: 200 },
verticalAlign: VerticalAlign.CENTER,
children: [
new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before:
0, after: 100 }, children: [new TextRun({ text: String(val), bold: true,
size: 68, color: WHITE, font: &quot;Arial&quot; })] }),
new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before:
0, after: 0 }, children: [new TextRun({ text: label, size: 18, color:
GRAY, font: &quot;Arial&quot;, characterSpacing: 20 })] }),
],
});
const gapCell = new TableCell({
width: { size: 300, type: WidthType.DXA },
shading: { fill: DARK_BG, type: ShadingType.CLEAR },
borders: cellBorders,
children: [new Paragraph({ children: [] })],
});
return new Table({
width: { size: CW, type: WidthType.DXA },
columnWidths: [bw, 300, bw],
borders: tableBorders,
rows: [
new TableRow({
height: { value: 1500, rule: &quot;atLeast&quot; },
children: [boxCell(leftVal, leftLabel, bw), gapCell,
boxCell(rightVal, rightLabel, bw)],
}),
],
});
}
// Full-width red header bar (used for day/workout titles)
function headerBar(leftLines, rightText) {
const lW = CW - 3200;

return new Table({
width: { size: CW, type: WidthType.DXA },
columnWidths: [lW, 3200],
borders: tableBorders,
rows: [
new TableRow({
height: { value: 880, rule: &quot;atLeast&quot; },
children: [
new TableCell({
width: { size: lW, type: WidthType.DXA },
shading: { fill: RED, type: ShadingType.CLEAR },
borders: cellBorders,
margins: { top: 120, bottom: 80, left: 240, right: 80 },
verticalAlign: VerticalAlign.CENTER,
children: leftLines.map((line, i) =&gt;
new Paragraph({
spacing: { before: 0, after: i &lt; leftLines.length - 1 ?
60 : 0 },
children: [new TextRun({ text: line.text, bold: line.bold
!== false, size: line.size, color: line.color || WHITE, font: &quot;Arial&quot;
})],
})
),
}),
new TableCell({
width: { size: 3200, type: WidthType.DXA },
shading: { fill: RED, type: ShadingType.CLEAR },
borders: cellBorders,
margins: { top: 80, bottom: 80, left: 80, right: 240 },
verticalAlign: VerticalAlign.CENTER,
children: [
new Paragraph({
alignment: AlignmentType.RIGHT,
children: [new TextRun({ text: rightText, bold: true,
size: 18, color: WHITE, font: &quot;Arial&quot;, characterSpacing: 20 })],
}),
],
}),
],
}),
],
});
}
// Split &quot;80 g ovsenih kosmičev (311 kcal, 10,8 g B)&quot; → { name, info }
function splitIngredient(ing) {
const match = ing.match(/^(.*?)\s*(\([^)]+\))\s*$/);
return match ? { name: match[1], info: match[2] } : { name: ing, info:
&quot;&quot; };
}
// Meal card: dark card with left red accent, number/name/kcal left,
ingredients right
function mealCard(meal, idx) {
const bg = idx % 2 === 0 ? DARK_CARD : DARK_ROW;
const lW = 2800, rW = CW - lW;
return new Table({
width: { size: CW, type: WidthType.DXA },

columnWidths: [lW, rW],
borders: tableBorders,
rows: [
new TableRow({
children: [
new TableCell({
width: { size: lW, type: WidthType.DXA },
shading: { fill: bg, type: ShadingType.CLEAR },
borders: { top: nb, bottom: nb, left: rb(16), right: rb(6) },
margins: { top: 120, bottom: 120, left: 200, right: 160 },
children: [
new Paragraph({ spacing: { before: 0, after: 60 },
children: [new TextRun({ text: String(meal.number).padStart(2, &quot;0&quot;),
bold: true, size: 40, color: RED, font: &quot;Arial&quot; })] }),
new Paragraph({ spacing: { before: 0, after: 40 },
children: [new TextRun({ text: meal.name, bold: true, size: 20, color:
WHITE, font: &quot;Arial&quot; })] }),
new Paragraph({ spacing: { before: 0, after: 0 }, children:
[new TextRun({ text: meal.calories + &quot; kcal | &quot; + meal.protein + &quot; g
beljakovin&quot;, size: 18, color: GRAY, font: &quot;Arial&quot; })] }),
],
}),
new TableCell({
width: { size: rW, type: WidthType.DXA },
shading: { fill: bg, type: ShadingType.CLEAR },
borders: cellBorders,
margins: { top: 100, bottom: 100, left: 160, right: 160 },
children: meal.ingredients.map((ing) =&gt; {
const { name } = splitIngredient(ing);
return new Paragraph({
spacing: { before: 40, after: 40 },
children: [new TextRun({ text: name, size: 20, color:
LIGHT, font: &quot;Arial&quot; })],
});
}),
}),
],
}),
],
});
}
// Exercise card: dark card with left red accent, number/name left,
sets_reps/note right
function exerciseCard(ex, idx) {
const bg = idx % 2 === 0 ? DARK_CARD : DARK_ROW;
const lW = 2800, rW = CW - lW;
const rightChildren = [
new Paragraph({ spacing: { before: 0, after: ex.note ? 80 : 0 },
children: [new TextRun({ text: ex.sets_reps, bold: true, size: 34, color:
WHITE, font: &quot;Arial&quot; })] }),
];
if (ex.note) {
rightChildren.push(new Paragraph({ spacing: { before: 0, after: 0 },
children: [new TextRun({ text: ex.note, size: 18, color: GRAY, font:
&quot;Arial&quot; })] }));
}
return new Table({

width: { size: CW, type: WidthType.DXA },
columnWidths: [lW, rW],
borders: tableBorders,
rows: [
new TableRow({
children: [
new TableCell({
width: { size: lW, type: WidthType.DXA },
shading: { fill: bg, type: ShadingType.CLEAR },
borders: { top: nb, bottom: nb, left: rb(16), right: rb(6) },
margins: { top: 120, bottom: 120, left: 200, right: 160 },
children: [
new Paragraph({ spacing: { before: 0, after: 60 },
children: [new TextRun({ text: String(idx + 1).padStart(2, &quot;0&quot;), bold:
true, size: 36, color: RED, font: &quot;Arial&quot; })] }),
new Paragraph({ spacing: { before: 0, after: 0 }, children:
[new TextRun({ text: ex.name, bold: true, size: 22, color: WHITE, font:
&quot;Arial&quot; })] }),
],
}),
new TableCell({
width: { size: rW, type: WidthType.DXA },
shading: { fill: bg, type: ShadingType.CLEAR },
borders: cellBorders,
margins: { top: 120, bottom: 120, left: 200, right: 200 },
children: rightChildren,
}),
],
}),
],
});
}
// -- Meal plan DOCX generator ------------------------------------------
-------
function generateMealDocx(userData, plan) {
const displayName = userData.name !== &quot;ni podatka&quot; ?
userData.name.toUpperCase() : &quot;&quot;;
const children = [];
// Cover page
children.push(...coverBrand(&quot;MEAL&quot;, &quot;PLAN&quot;));
if (displayName) {
children.push(new Paragraph({
alignment: AlignmentType.CENTER,
spacing: { before: 0, after: 320 },
children: [new TextRun({ text: displayName, bold: true, size: 32,
color: RED, font: &quot;Arial&quot;, characterSpacing: 40 })],
}));
}
children.push(new Paragraph({
alignment: AlignmentType.CENTER,
spacing: { before: 0, after: 200 },
children: [new TextRun({ text: plan.summary.plan_type + &quot; - &quot; +
plan.summary.meals_per_day + &quot;x OBROK&quot;, size: 22, color: GRAY, font:
&quot;Arial&quot;, characterSpacing: 40 })],

}));
children.push(redRule(12, 280));
children.push(statsTable(
plan.summary.calories_per_day, &quot;KALORIJ NA DAN&quot;,
plan.summary.protein_per_day + &quot; g&quot;, &quot;BELJAKOVIN NA DAN&quot;
));
children.push(sp(280));
children.push(redRule(4, 200));
children.push(new Paragraph({
spacing: { before: 200, after: 180 },
children: [new TextRun({ text: &quot;PRILAGODITVE JEDILNIKA&quot;, bold: true,
size: 20, color: RED, font: &quot;Arial&quot;, characterSpacing: 20 })],
}));
children.push(new Paragraph({
spacing: { before: 0, after: 200 },
children: [new TextRun({ text: plan.adaptations, size: 20, color:
LIGHT, font: &quot;Arial&quot; })],
}));
// Intro page
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({
spacing: { before: 0, after: 200 },
children: [new TextRun({ text: plan.intro, size: 20, color: LIGHT,
font: &quot;Arial&quot; })],
}));
// Day pages
plan.days.forEach((day) =&gt; {
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(headerBar(
[
{ text: &quot;DAN &quot; + day.day, bold: true, size: 26 },
{ text: day.calories + &quot; kcal \u2013 &quot; + day.protein + &quot; g
beljakovin&quot;, bold: false, size: 20, color: &quot;E8B8B8&quot; },
],
&quot;STRENGTH AND HONOR&quot;
));
children.push(sp(120));
day.meals.forEach((meal, i) =&gt; {
children.push(mealCard(meal, i));
children.push(sp(80));
});
});
return Packer.toBuffer(buildDoc(children));
}
// -- Training plan DOCX generator --------------------------------------
-------
function generateTrainingDocx(userData, plan) {
const displayName = userData.name !== &quot;ni podatka&quot; ?
userData.name.toUpperCase() : &quot;&quot;;

const location = (plan.summary.location || &quot;&quot;).toUpperCase();
const children = [];
// Cover page
children.push(...coverBrand(&quot;TRENING&quot;, &quot;PROGRAM&quot;));
if (displayName) {
children.push(new Paragraph({
alignment: AlignmentType.CENTER,
spacing: { before: 0, after: 320 },
children: [new TextRun({ text: displayName, bold: true, size: 32,
color: RED, font: &quot;Arial&quot;, characterSpacing: 40 })],
}));
}
children.push(new Paragraph({
alignment: AlignmentType.CENTER,
spacing: { before: 0, after: 200 },
children: [new TextRun({ text: plan.summary.split + &quot; - &quot; +
(plan.summary.split_desc || &quot;&quot;).toUpperCase(), size: 22, color: GRAY,
font: &quot;Arial&quot;, characterSpacing: 40 })],
}));
children.push(redRule(12, 280));
children.push(statsTable(
String(plan.summary.days_per_week), &quot;TRENINGOV NA TEDEN&quot;,
location || &quot;GYM&quot;, &quot;LOKACIJA&quot;
));
children.push(sp(280));
children.push(redRule(4, 200));
// Intro text
children.push(new Paragraph({
spacing: { before: 200, after: 200 },
children: [new TextRun({ text: plan.intro, size: 20, color: LIGHT,
font: &quot;Arial&quot; })],
}));
// Gray divider
children.push(new Paragraph({
spacing: { before: 0, after: 200 },
border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY,
space: 1 } },
children: [],
}));
// Schedule section header
children.push(new Paragraph({
spacing: { before: 200, after: 160 },
children: [new TextRun({ text: &quot;PRIMER TEDENSKEGA RAZPOREDA&quot;, bold:
true, size: 20, color: RED, font: &quot;Arial&quot;, characterSpacing: 20 })],
}));
// Schedule rows
plan.schedule.forEach((item, i) =&gt; {
const isRest = norm(item.workout).includes(&quot;poc&quot;) ||
norm(item.workout).includes(&quot;rest&quot;);
const bg = i % 2 === 0 ? DARK_CARD : DARK_ROW;

const accentColor = isRest ? GRAY : RED;
const textColor = isRest ? GRAY : LIGHT;
children.push(new Table({
width: { size: CW, type: WidthType.DXA },
columnWidths: [CW - 4000, 4000],
borders: tableBorders,
rows: [
new TableRow({
height: { value: 480, rule: &quot;atLeast&quot; },
children: [
new TableCell({
width: { size: CW - 4000, type: WidthType.DXA },
shading: { fill: bg, type: ShadingType.CLEAR },
borders: { top: nb, bottom: nb, left: { style:
BorderStyle.SINGLE, size: 12, color: accentColor }, right: nb },
margins: { top: 60, bottom: 60, left: 200, right: 80 },
verticalAlign: VerticalAlign.CENTER,
children: [new Paragraph({ children: [new TextRun({ text:
item.day.toUpperCase(), bold: true, size: 18, color: WHITE, font: &quot;Arial&quot;
})] })],
}),
new TableCell({
width: { size: 4000, type: WidthType.DXA },
shading: { fill: bg, type: ShadingType.CLEAR },
borders: cellBorders,
margins: { top: 60, bottom: 60, left: 80, right: 200 },
verticalAlign: VerticalAlign.CENTER,
children: [new Paragraph({ children: [new TextRun({ text:
item.workout, size: 18, color: textColor, font: &quot;Arial&quot; })] })],
}),
],
}),
],
}));
children.push(sp(40));
});
// &quot;STRENGTH AND HONOR&quot; footer on schedule page
children.push(sp(200));
children.push(new Paragraph({
alignment: AlignmentType.CENTER,
spacing: { before: 0, after: 0 },
children: [new TextRun({ text: &quot;STRENGTH AND HONOR&quot;, bold: true,
size: 20, color: WHITE, font: &quot;Arial&quot;, characterSpacing: 40 })],
}));
// Workout pages
plan.workouts.forEach((workout) =&gt; {
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(headerBar(
[{ text: workout.name, bold: true, size: 44 }],
&quot;STRENGTH AND HONOR&quot;
));
children.push(sp(120));
workout.exercises.forEach((ex, i) =&gt; {

children.push(exerciseCard(ex, i));
children.push(sp(80));
});
});
return Packer.toBuffer(buildDoc(children));
}
// -- Email sender (filenames .docx) ------------------------------------
-------
async function sendCombinedEmail(userData, mealBuffer, trainingBuffer) {
const name = userData.name !== &quot;ni podatka&quot; ? userData.name :
&quot;stranka&quot;;
await axios.post(&quot;https://api.resend.com/emails&quot;, {
from: &quot;Plan Generator &lt;onboarding@resend.dev&gt;&quot;,
to: NOTIFY_EMAIL,
subject: name + &quot; - jedilnik + trening program&quot;,
html: &quot;&lt;div style=&#39;font-family:Arial,sans-
serif;background:#111;color:#fff;padding:30px;border-radius:8px;&#39;&gt;&lt;h2
style=&#39;color:#CC1F1F;&#39;&gt;GAL REMEC COACHING&lt;/h2&gt;&lt;p&gt;Jedilnik in trening
program za &lt;strong&gt;&quot; + name + &quot;&lt;/strong&gt; sta pripravljena.&lt;/p&gt;&lt;table
style=&#39;margin-top:16px;&#39;&gt;&lt;tr&gt;&lt;td style=&#39;color:#888;padding:4px 12px 4px
0&#39;&gt;Ime:&lt;/td&gt;&lt;td&gt;&quot; + name + &quot;&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td
style=&#39;color:#888;padding:4px 12px 4px 0&#39;&gt;Cilj:&lt;/td&gt;&lt;td&gt;&quot; + userData.goal
+ &quot;&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td style=&#39;color:#888;padding:4px 12px 4px
0&#39;&gt;Teza:&lt;/td&gt;&lt;td&gt;&quot; + userData.weight + &quot; kg&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td
style=&#39;color:#888;padding:4px 12px 4px 0&#39;&gt;Lokacija:&lt;/td&gt;&lt;td&gt;&quot; +
userData.location + &quot;&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;&lt;/div&gt;&quot;,
attachments: [
{ filename: &quot;jedilnik-&quot; + name.replace(/ /g, &quot;-&quot;) + &quot;.docx&quot;,
content: mealBuffer.toString(&quot;base64&quot;) },
{ filename: &quot;trening-&quot; + name.replace(/ /g, &quot;-&quot;) + &quot;.docx&quot;,
content: trainingBuffer.toString(&quot;base64&quot;) },
],
}, { headers: { Authorization: &quot;Bearer &quot; + RESEND_API_KEY, &quot;Content-
Type&quot;: &quot;application/json&quot; } });
}
// -- Routes ------------------------------------------------------------
-------
app.get(&quot;/health&quot;, (req, res) =&gt; {
res.json({ status: &quot;ok&quot;, model: MODEL });
});
app.post(&quot;/webhook-combined&quot;, async (req, res) =&gt; {
console.log(&quot;Webhook combined received&quot;);
res.status(200).json({ received: true });
const userData = parseCombinedTallyData(req.body);
try {
console.log(&quot;Generating meal plan...&quot;);
const mealPlan = await generateMealPlan(userData);
console.log(&quot;Meal plan done&quot;);
console.log(&quot;Generating training plan...&quot;);
const trainingPlan = await generateTrainingPlan(userData);
console.log(&quot;Training plan done&quot;);
console.log(&quot;Generating documents...&quot;);
const mealBuffer = await generateMealDocx(userData, mealPlan);

const trainingBuffer = await generateTrainingDocx(userData,
trainingPlan);
console.log(&quot;Documents done&quot;);
await sendCombinedEmail(userData, mealBuffer, trainingBuffer);
console.log(&quot;Email sent to:&quot;, NOTIFY_EMAIL);
} catch (err) {
console.error(&quot;Error:&quot;, err.response?.data || err.message);
}
});
app.listen(PORT, () =&gt; {
console.log(&quot;Port &quot; + PORT + &quot; | Model: &quot; + MODEL + &quot; | API key: &quot; +
(ANTHROPIC_API_KEY ? &quot;OK&quot; : &quot;MISSING&quot;));
});
