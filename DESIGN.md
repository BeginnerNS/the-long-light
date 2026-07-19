# Design

## Theme
Warm cinematic dark. A near-black, faintly warm canvas that behaves like a darkened gallery room: the photographs are lit, the interface is not. Warmth is carried by an ember/amber accent, warm off-white text, and the light inside the images — never by a bright surface.

## Color
Authored in OKLCH.

- `--bg`: `oklch(0.14 0.010 60)` — near-black, faint warm. Page canvas.
- `--bg-deep`: `oklch(0.10 0.008 60)` — deepest sections, footer.
- `--surface`: `oklch(0.18 0.012 58)` — nav, cards, lightbox chrome.
- `--ink`: `oklch(0.95 0.010 75)` — warm off-white body/heading text.
- `--muted`: `oklch(0.74 0.014 70)` — secondary text, captions, meta.
- `--accent`: `oklch(0.74 0.150 62)` — ember/amber. Links, active states, key rules, primary CTA fill.
- `--accent-strong`: `oklch(0.66 0.160 48)` — hover/active accent.
- `--line`: `oklch(1 0 0 / 0.10)` — hairline borders on dark.

Strategy: **Committed dark** — a single warm accent carries identity against a disciplined near-black. Text on the amber CTA is near-black (`--bg-deep`), the conventional readable pairing for a yellow-amber fill.

## Typography
Three voices on clear contrast axes, all distinctive (no Inter/Roboto/system defaults).

- Hero wordmark: **Foglihten No07** (`--font-title`, 400). An engraved didone, self-hosted and subset to "The Long Light" only. Reserved for the hero — a gallery-plaque signature.
- Section headings / nav / UI / labels / buttons: **Schibsted Grotesk** (`--font-display`, 400–700). A crafted editorial grotesque; crisp and quiet so the interface recedes and the images lead.
- Body / story / tagline / captions: **Literata** (`--font-body`, 400/500 + 400 italic). A warm literary serif carrying the first-person, human voice; italic for taglines and ledes.
- Film-edge micro-labels: a system monospace (`--font-edge`) — thematic film-rebate codes only, not body text.
- Fluid `clamp()` for display (hero ≤ 6rem, section ≤ 4rem); fixed rem for body (1–1.125rem). Rendered scale runs 61 → 38 → 19 → 12px. Light-on-dark line-height nudged up ~0.05.

## Components
- Fixed top nav, transparent over the hero, condensing to a `--surface` bar with a hairline once scrolled.
- Full-bleed hero image with a bottom-weighted dark scrim for legibility, overlaid wordmark, tagline, and a scroll cue.
- Filterable gallery (All / Landscape / Street) rendered as a responsive masonry (CSS columns) of varied aspect ratios. Figures reveal on scroll (progressive enhancement; visible without JS). Hover lifts the image and reveals a caption.
- Full-screen lightbox: keyboard-navigable (←/→/Esc), focus-managed, caption + counter, prev/next within the active filter.
- About: warm first-person prose beside a portrait, with an ember rule.
- Contact: a single confident "Get in touch" mailto CTA plus social links.

## Layout
Full-bleed imagery, generous fluid `clamp()` spacing that breathes on large viewports, tight groupings for meta. Sections alternate `--bg` and `--bg-deep` for cinematic pacing. Content width capped for prose (~65ch); imagery goes edge to edge.

## Motion
Ease-out-expo curves. A single orchestrated hero entrance on load (wordmark and tagline rise + fade, staggered). Gallery figures rise gently as they enter the viewport (IntersectionObserver, staggered per column). Lightbox cross-fades. A faint film-grain overlay adds cinematic texture. All motion has a `prefers-reduced-motion: reduce` path that resolves to instant/crossfade, and reveals enhance an already-visible default.
