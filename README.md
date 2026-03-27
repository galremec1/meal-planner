# 🔥 GAL REMEC COACHING — AI Jedilnik Generator
## Navodila za deploy na Vercel (brezplačno)

---

## KAJ RABIŠ:
- GitHub račun (brezplačno) → github.com
- Vercel račun (brezplačno) → vercel.com
- Anthropic API ključ → console.anthropic.com

---

## KORAKI (10 minut):

### 1. NALOŽI NA GITHUB
1. Odpri github.com → klikni "New repository"
2. Ime: `gal-meal-planner`
3. Public ali Private → Create repository
4. Naloži vse fajle iz te mape v repozitorij

### 2. POVEŽI Z VERCEL
1. Odpri vercel.com → "Add New Project"
2. Poveži GitHub račun → izberi `gal-meal-planner`
3. Framework: Next.js (Vercel ga zazna sam)
4. **PREDEN klikneš Deploy** → pojdi na "Environment Variables"

### 3. DODAJ API KLJUČ (OBVEZNO!)
V Vercel → Environment Variables dodaj:
```
Name:  ANTHROPIC_API_KEY
Value: sk-ant-xxxxxxxxxxxx  ← tvoj ključ iz console.anthropic.com
```

### 4. DEPLOY
- Klikni "Deploy"
- Vercel zgradi app (~2 min)
- Dobiš link: `gal-meal-planner.vercel.app`

---

## CUSTOM DOMENA (opcijsko)
Če imaš lastno domeno (npr. jedilnik.galremec.si):
1. Vercel → Settings → Domains
2. Dodaj svojo domeno
3. Nastavi DNS pri registrarju

---

## KJE DOBITI ANTHROPIC API KLJUČ:
1. Odpri console.anthropic.com
2. API Keys → Create Key
3. Kopiraj ključ (začne se s `sk-ant-`)
4. Dodaj v Vercel Environment Variables

---

## CENA:
- Vercel hosting: BREZPLAČNO (do 100GB bandwidth/mesec)
- Anthropic API: ~$0.003 po jedilniku (3x jedilniki ≈ $0.01 na uporabnika)
  → 1000 uporabnikov/mesec ≈ $10

---

## PODPORA:
Instagram: @galremec
