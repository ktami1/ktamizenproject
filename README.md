# Slidemine

Inserisci un profilo Instagram pubblico. Slidemine recupera tutti i post (reel esclusi), legge il testo dentro ogni immagine e ti restituisce i post **ordinati per popolarità**:

- **carousel** → il gruppo di frasi, slide per slide
- **post singolo** → la frase
- like e commenti, quando disponibili

Il processo può durare anche un'ora: gira da solo su GitHub, e tu puoi chiudere la pagina.

## Perché è gratis e senza rischi per il tuo account

| | |
|---|---|
| **Account Meta** | Non viene mai usato: niente login, cookie o sessioni. I post li recupera [Apify](https://apify.com) dai suoi server. |
| **Costo** | GitHub Actions è gratis sui repo pubblici. Il piano gratuito di Apify dà 5$ di crediti al mese, cioè qualche profilo da 300 post al mese. |
| **Privacy** | Il repo è pubblico, quindi ogni dato (username, testi, anteprime) viene cifrato con AES-256-GCM prima di finire su GitHub. La chiave la conosci solo tu. Nei log pubblici non compaiono username né testi. |

## Come funziona

```
 Web app (Netlify, statica)            Branch ig-data (cifrato)             GitHub Actions (gratis)
 ─────────────────────────             ────────────────────────             ───────────────────────
 @profilo ──► queue/<id>.json  ──push──►  trigger worker  ──────────────►  1. Apify: post + like/commenti
                                                                            2. scarica ogni slide
 risultati ◄── jobs/<id>/*.json ◄─────────────────────────── commit ◄────  3. OCR (RapidOCR PP-OCRv6)
 (decifrati nel browser)                                                    4. ordina, cifra, salva
```

### OCR: perché legge anche le scritte "grafiche"

Vision e Tesseract sbagliano sui font decorativi, sul testo bianco sopra le foto e sulle lettere accentate. Il worker invece:

1. usa **RapidOCR con modelli PP-OCRv6** (inclusi nel pacchetto pip, multilingua, accenti italiani compresi);
2. legge ogni immagine in **2 o 3 varianti** (originale, ingrandita, filtrata);
3. per ogni riga sceglie la lettura migliore combinando la **confidenza** dell'OCR con un **controllo dizionario italiano/inglese** (`wordfreq`), e separa le parole incollate (es. "diventicapace" → "diventi capace");
4. elimina il rumore: @handle, contatori tipo `2/7`, frecce, "swipe";
5. ricompone righe e paragrafi nell'ordine di lettura e tiene separati i punti degli elenchi.

Sul set di prova (script, handwriting, serif corsivo, maiuscolo condensato, testo ruotato, basso contrasto) l'estrazione è corretta su 12 immagini su 13, a circa 2 secondi per immagine.

I post vengono letti **dal più popolare in giù**: se il tempo finisce (limite di circa 5 ore e mezza), i migliori sono già pronti, e "Continua lettura" riprende da dove si era fermato senza spendere altri crediti Apify.

## Setup (una volta sola, ~5 minuti)

### 1. Pubblica la web app
Su [Netlify](https://app.netlify.com): **Add new site → Import from Git** → questo repo → branch `claude/instagram-scraping-ocr-0yhj79`. Il file `netlify.toml` configura tutto da solo.
(In alternativa, in locale: `cd web && npm install && npm run dev`.)

### 2. Crea i token
- **GitHub**: [nuovo token fine-grained](https://github.com/settings/personal-access-tokens/new), con accesso *solo* a questo repo e questi permessi:
  `Contents: Read and write` · `Workflows: Read and write` · `Secrets: Read and write` · `Actions: Read-only`
- **Apify**: [crea un account gratuito](https://console.apify.com/sign-up), poi copia il token da [Settings → API & Integrations](https://console.apify.com/settings/integrations).

### 3. Configura dall'app
Apri il sito, incolla i due token e **salva la chiave privata** che l'app genera (in un password manager). Con un clic l'app:
- crea il branch `ig-data` con il worker;
- salva i segreti `SLIDEMINE_VAULT_KEY` e `SLIDEMINE_APIFY_TOKEN` nel repo (cifrati da GitHub).

Da un altro dispositivo: **"Ho già configurato"** → token GitHub + chiave privata.

## Uso
1. Scrivi `@profilo` (o incolla il link) e premi **Avvia**.
2. Il worker parte entro 1–2 minuti. Recuperare 300 post con Apify richiede qualche minuto, poi la lettura procede a circa 2 secondi per immagine.
3. I risultati compaiono mentre procede. Hai filtri (Carousel/Singoli), ricerca nel testo, ordinamento (popolari, like, commenti, recenti) e vista Griglia o Lista.
4. **Esporta**: copia tutto, Markdown (da incollare in Notion), CSV (Excel/Sheets), JSON.

## Struttura

```
web/      app React + Vite (design: DESIGN.md)
worker/   Python: Apify, OCR, cifratura, job runner
DESIGN.md sistema di design (Vercel × Pinterest × Notion)
```

## Limiti onesti
- Funziona solo con **profili pubblici**.
- I like **nascosti** dall'autore non sono disponibili. Per ordinarli, l'app li stima dal rapporto like/commenti del profilo e li mostra come "nascosti".
- Apify gratuito: quando finiscono i crediti del mese, l'app te lo dice chiaramente. Si rinnovano ogni mese.
- Le testate delle immagini molto rumorose, con testo chiaro senza ombra sopra una foto piena di dettagli, possono avere qualche lettera sbagliata. Queste righe sono sottolineate come "lettura incerta".

## Sviluppo
```bash
# web
cd web && npm install && npm run dev      # typecheck: npm run typecheck
# worker (locale, senza push)
pip install -r worker/requirements.txt
DATA_DIR=/percorso/checkout-ig-data VAULT_KEY=... APIFY_TOKEN=... NO_PUSH=1 python worker/run.py
```
