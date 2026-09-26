# DESIGN.md — Slidemine

Uno strumento, non un sito. Tre riferimenti, ognuno con un ruolo preciso:

| Riferimento | Cosa prendiamo | Dove si vede |
|---|---|---|
| **Vercel** | Rigore: nero/bianco, bordi da 1px, tipografia Geist, stati chiari, zero decorazione | Barra comandi, pulsanti, stati dei job, progress |
| **Pinterest** | Griglia a colonne (masonry), card con immagine in alto, ritmo visivo | Vista risultati "Griglia" |
| **Notion** | Testo leggibile, gerarchia calma, righe pulite, tutto copiabile | Testo estratto, vista "Lista", impostazioni |

Principi:
1. **Il contenuto è il protagonista.** Il testo estratto ha la tipografia più curata della pagina. L'interfaccia intorno sta in grigio.
2. **Un solo colore d'accento.** L'accento è il testo principale (nero in chiaro, bianco in scuro). Il rosso Pinterest `--pin` compare solo per il podio (#1–#3) e per lo stato "live".
3. **Ogni stato è visibile.** In coda, recupero, lettura, completato, parziale ed errore hanno ognuno un'etichetta, un colore e una frase in italiano che dice cosa sta succedendo.
4. **Niente vicoli ciechi.** Ogni errore dice cosa fare dopo (Riprova, Impostazioni, link al log).

## Token

Definiti in `web/src/styles.css` su `:root`, con override per il tema scuro (`prefers-color-scheme` e `[data-theme]`).

### Colore

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--bg` | `#fafafa` | `#0a0a0a` | Sfondo pagina |
| `--surface` | `#ffffff` | `#111111` | Card, input, pannelli |
| `--subtle` | `#f4f4f5` | `#1a1a1a` | Hover, zone secondarie, chip |
| `--border` | `#eaeaea` | `#262626` | Tutti i bordi da 1px |
| `--border-strong` | `#d4d4d4` | `#3a3a3a` | Focus/hover dei bordi |
| `--text` | `#0a0a0a` | `#ededed` | Testo principale e accento |
| `--muted` | `#666666` | `#a1a1a1` | Testo secondario |
| `--faint` | `#a3a3a3` | `#6b6b6b` | Metadati, numeri di slide |
| `--pin` | `#e60023` | `#ff3355` | Podio e indicatore live, mai altro |
| `--ok` | `#0a7c42` | `#3ecf8e` | Completato |
| `--warn` | `#b25c00` | `#f5a524` | Parziale |
| `--err` | `#c50f1f` | `#ff6369` | Errore |
| `--info` | `#0060df` | `#52a8ff` | In corso |

### Tipografia

- **Geist** per l'interfaccia, **Geist Mono** per numeri, metriche, ID, contatori di slide.
- Scala: 12 / 13 / 14 (base UI) / 15 (testo estratto) / 18 / 24 / 32 / 44 (hero).
- Testo estratto: 15px, interlinea 1.6, peso 450: è la parte da leggere.
- Titoli: peso 600, `letter-spacing: -0.02em` (alla Vercel).
- Numeri: sempre `font-variant-numeric: tabular-nums`.

### Spazio, forme, profondità

- Griglia da 4px: 4, 8, 12, 16, 24, 32, 48, 64.
- Raggi: 6 (chip), 8 (input, pulsanti), 12 (card), 16 (pannelli grandi).
- Ombre quasi assenti: `--shadow-sm` solo sulle card in hover, `--shadow-lg` solo su toast e menu.
- Larghezza massima del contenuto: 1200px. Gutter 16px su mobile, 24px da tablet in su.

### Movimento

- 150ms `ease` per hover e focus. 250ms per aprire e chiudere.
- La barra di progresso ha una sola striscia animata mentre il job è attivo.
- Rispettare `prefers-reduced-motion`: niente animazioni.

## Componenti

- **Command bar** (home): input grande con prefisso `instagram.com/`, pulsante nero "Avvia". Si incolla anche un URL completo o `@nome`.
- **Status pill**: puntino colorato + etichetta. Il puntino pulsa solo negli stati attivi.
- **Job row**: avatar con l'iniziale, @username, stato, barra di progresso sottile, tempo relativo.
- **Post card (griglia)**: anteprima 4:5, badge rank in alto a sinistra (rosso per il podio), chip "Carousel · 6" in alto a destra; sotto le metriche in mono e il testo per slide (numero `01` in `--faint` + frasi). Azioni: Copia, Apri.
- **Post row (lista)**: stile riga di un database Notion: rank, miniatura 48px, testo, metriche allineate a destra.
- **Toolbar risultati** (sticky): filtro segmentato Tutti/Carousel/Singoli, ricerca, ordinamento, vista Griglia/Lista, menu Esporta.
- **Toast**: in basso al centro, scuro, 2.5s.

## Tono dei testi

Italiano, diretto, frasi corte. Si dice cosa succede e cosa fare dopo. Niente gergo tecnico nell'interfaccia; i dettagli tecnici restano nel README.
