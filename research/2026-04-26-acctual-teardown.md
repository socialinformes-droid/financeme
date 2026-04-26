# Site Teardown: Acctual

**URL:** https://www.acctual.com/
**Built by:** No-code (Framer)
**Platform:** Framer (generator: `Framer b135809`)
**Date analyzed:** 2026-04-26

## Tech Stack (Confirmed from Source)

| Technology | Evidence | Purpose |
|---|---|---|
| Framer | `<meta name="generator" content="Framer b135809">` | No-code site builder; gera HTML estático + JS bundle |
| Framer Motion (embed) | bundle `script_main.CEmBYEYS.mjs` em `framerusercontent.com` | Animações de entrada, parallax, scroll effects |
| Google Tag Manager | `gtag/js?id=G-D9S8DRD5GD` | Analytics |
| Framer Events | `events.framer.com/script?v=2` | Telemetria do Framer |

## Design System

### Colors

| Name/Usage | Value |
|---|---|
| **Background base** | `#fafafa` (paper-cream off-white) |
| **Background sections** | `#fff` (pure white) |
| **Foreground / ink** | `#1e1e1e` (near-black) |
| **Accent — blue (CTA primary)** | `rgb(0, 153, 255)` / `#0099ff` |
| **Accent — neon-green (success)** | `#00F23D` (electric green) |
| **Accent — magenta** | `#f200ca` |
| **Accent — purple** | `#6c56fc` |
| **Accent — coral** | `#ff6363` |
| **Soft fills (10-15% alpha)** | `#0098f229`, `#f200c929`, `#6c55fc29`, `#ff636329` |
| **Subtle gray fill** | `#f0f0f0`, `#eeeeee` |
| **Muted text** | `rgb(141, 141, 141)`, `rgb(102, 102, 102)` |
| **Soft borders** | `#d8d8d8` |

**Insight**: paleta dominantemente neutra (cream/white/dark) com acentos fortes saturados em quantidade pequena — crash de "feel SaaS" alegre sobre fundo limpo.

### Typography

| Role | Font Family | Notes |
|---|---|---|
| Headings (large) | **Geist** | Clean modern sans — display |
| Body | **Inter** (fallback "Inter Placeholder") | Default neutro |
| Handwritten / annotations | **Caveat** | Rotacionada, em destaques de margem |
| Monospace / numbers | **Fragment Mono** | Pra números, tags, código |

**Font files**: hospedados em `framerusercontent.com/assets/*.woff2`

### Spacing & Radius

- **Border-radius generoso**: `20px` em cards (10×), `32px` em containers (4×), `16px` em buttons (6×)
- **Pills extremas**: `1250px` (full rounded em CTAs/tags) — 7×
- Pequenos elementos: `12px`

### Decorative transforms (handwritten feel)

```
transform: rotate(-15deg)
transform: rotate(-4deg)
transform: rotate(11deg)
transform: rotate(3.5deg)
```

Anotações handwritten são **rotacionadas levemente** pra parecer escritas à mão. Setas SVG e textos Caveat usam estes ângulos.

## Effects Breakdown

| Effect | Implementation | Complexity | Cloneable? |
|---|---|---|---|
| Hero handwritten annotations | Texto em Caveat com `rotate(Xdeg)` + setas SVG decorativas | Low | Yes |
| Cards de feature | `border-radius: 20-32px` + sombra suave + accent border colorido | Low | Yes |
| Pills CTAs | `border-radius: 1250px` (= round full) + accent fill | Low | Yes |
| Color tags | Fundo `accent-color/15%` + texto `accent-color` (e.g. `#0098f229` bg + `#0098ff` text) | Low | Yes |
| Soft scroll reveals | Framer Motion fade-in + slight Y translate (~16px) | Low | Yes |
| Mockup dashboards inline | Imagens PNG dos próprios dashboards do produto | Low | Yes |

## Implementation Details

### Anotações handwritten (Caveat + rotate)

```css
.handwritten {
  font-family: 'Caveat', cursive;
  font-size: 1.5rem;
  color: var(--accent-blue);
  transform: rotate(-3deg);
  white-space: nowrap;
}

/* Variantes pra parecer "natural": */
.handwritten--rotated-pos { transform: rotate(11deg); }
.handwritten--rotated-neg { transform: rotate(-15deg); }
```

Texto curto explicando ou destacando elementos próximos (tipo "← grátis pra sempre"). Tipicamente acompanhado de uma seta SVG curva também rotacionada.

### Color tags (soft accent fills)

```css
.tag {
  background: rgba(0, 152, 242, 0.16); /* accent + 16% alpha */
  color: rgb(0, 153, 255);
  border-radius: 1250px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
}
```

Pattern repetido com 4-5 accent colors (blue, green, magenta, purple, coral). Cada feature/categoria tem sua própria cor de tag.

### CTAs (pills com gradient/solid + sombra)

```css
.cta {
  background: rgb(0, 153, 255);
  color: white;
  border-radius: 1250px;
  padding: 12px 24px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.1);
  font-weight: 500;
}
```

## Build Plan — Adaptação pro Financeme

### Filosofia da adaptação

Acctual = SaaS modern alegre com cream + acentos vivos + handwritten.
Financeme = editorial newspaper com cream + ink + handwritten Caveat já cabe.

**Mantém:**
- Paleta editorial cream/navy/terracota (essência do projeto)
- Fraunces serif (display) — substitui o Geist do acctual com mais personalidade
- JetBrains Mono — substitui Fragment Mono
- Estética jornal (eyebrow, headlines, ornament)

**Adiciona do Acctual:**
- **Caveat font** pra anotações handwritten rotacionadas (—> casa com estética de almanaque/diário pessoal)
- **Color tags** com soft fills (accent + 15-20% alpha) pra categorias/features
- **Border-radius generoso** em cards (24-32px)
- **CTAs em pills full-rounded** (`border-radius: 9999px`)
- **Mockup do produto inline** na landing (screenshot do dashboard real)
- **Subtle scroll reveals** (já temos noise+fade — pode adicionar slide-in suave)

### Mudanças concretas no Financeme

**A. Tokens novos em globals.css**:
- Adicionar `--font-handwritten: 'Caveat', cursive;`
- Adicionar accent semantic colors: `--accent-blue`, `--accent-green-neon`, etc.
- Helper class `.handwritten` com rotate variants

**B. Landing page repaginada**:
- Hero com annotation Caveat ao redor (ex: setinha "← grátis" perto do CTA)
- Mockup do dashboard real abaixo do hero (screenshot ou iframe live)
- Features cards com tag colorida + border-radius 24px
- CTA principal em pill full-rounded

**C. Annotations no dashboard**:
- Setinhas Caveat decorativas em primeira sessão (e.g. apontando pro Year switcher: "← seus volumes anuais")

## Notes

- Framer dá HTML estático já-otimizado; replicar no Next.js demanda mais código mas dá resultado idêntico
- Não precisa de animation library além do que já temos (Tailwind anim + tw-animate-css disponíveis)
- Caveat já está disponível via Google Fonts — gratuito
