# design

the site is a backdrop for an accumulation of artifacts. it stays out of the
way; all color, texture, and aliveness comes from what is on display.

## the two grounds

dark mode is a scanner bed: a void the artifacts float in. light mode is an
archive light table: an even glow they rest on. both are neutral chroma —
the site itself has no color, ever.

| token    | light table | scanner bed |
| -------- | ----------- | ----------- |
| `--bg`   | `#f8f8f8`   | `#0f0f0f`   |
| `--ink`  | `#101010`   | `#f0f0f0`   |
| `--dim`  | `#707070`   | `#909090`   |
| `--line` | `#d7d7d7`   | `#2b2b2b`   |

defined once in `src/styles/global.css`. themes follow the system, overridable
from the panel (stored in `localStorage.theme`).

## three voices

- **mono — pp neue montreal mono.** the default voice: ui, captions, metadata,
  asides, footnotes, daggers, the index. this is the archive's registrar tone.
- **serif — etbook.** the essay voice: body and headings. `:sc[text]` in markdown 
  sets true smallcaps. never use outside of main text.
- **sans — pp neue montreal.** for special occasions: the 404's giant numerals, 
  essay anchor asides, the search box in the nav panel.

see astro.config.mjs for the weights currently in use.

## style

no border-radius anywhere. no shadows, no gradients, no blur. emphasis
is inversion: anchored/highlighted text renders `--ink` on `--bg` flipped —
but inversion means *selection*, so it is reserved for selected things:
`::selection`, `<mark>` anchor phrases in body text, the active/hovered
panel row. links do not invert; their underline fades on hover (120ms).
buttons (the nav button, the §) shift brightness instead: `--dim` at rest,
`--ink` on hover. the nav button inverts whatever passes beneath it. hairlines
(`1px --line`) are the only ornament: under section notes, beside
blockquotes, ruling the panel's sections.

## invisible ui

pages are only arranged content plus one quiet corner: glyph, top-right.
the site has no center, and the panel this opens indexes everything.
⌘K is the only shortcut the site will ever claim (esc also closes,
unadvertised). the site is a non-brand; the glyph stands where a logo would.

## the index

`src/data/index.yaml` is the single source of truth: every artifact is
one entry, and its id is its address — each artifact lives at /<id>, at the
root, no section prefixes, one namespace. everything is an artifact; medium
alone decides the display. `medium: writing` renders the essay itself — its
body is plain markdown at `src/archive/writing/<id>.md`, no frontmatter,
all metadata (`dek` included) in the index; anything else gets a
vitrine — centered, no scroll, media sized by the rules under *images &
video*. publishing an essay is just filing
it — an entry under the essay's id (`medium: writing`, optionally an
`image` so arrangements can place it); an unfiled essay is just a draft.

pages are rooms listed in the panel's pages group as they're built. 

the home scanner-bed is art-directed w/ deliberate spacing in `src/data/home.yaml`

## the essay apparatus

- spreads mirror per h2 like turned pages: verso (text left, asides right),
  then recto (the mirror). the essay opens verso and sits left of center.
- three citation forms, none numbered:
  - **figcaption** — mono, under an image in the text column
  - **aside** — anchored on a phrase in the body, inverted there, answered
    uninverted at the aside's head, hanging in the margin
  - **section notes** — daggers († ‡ ‖ ¶), restarting every h2, resolved
    under a hairline at that section's end
- headings stop at h2 — a title and its sections, nothing deeper. h2s carry
  an invisible § that appears on hover and anchors the section.
- figures sit in the text column by default; `:::wide` lets one span into
  the aside margin, `:::full` hands it the whole window. the same blocks
  will carry widgets and interactive pieces when they arrive.
- authoring syntax lives in `src/lib/essay-markdown.mjs`; essays are plain
  markdown plus `:::aside[phrase]` and `:::notes`.

## media

artifacts arrive as-shot: native aspect ratios, never cropped, never framed.
videos are silent loops; each carries a still whose dimensions size its box,
and under reduced motion the still is all there is. anything longer than
a loop lives on vimeo, embedded. the serving rules are under *images &
video*, in the development half.

## voice

lowercase mostly, including titles. em dashes, not colons. understatement
over announcement — the 404 just says "nothing was filed here :^/". 

# development

when starting the dev server, use background mode:

```
pnpm dev --background
```

manage the background server with `pnpm dev stop`, `pnpm dev status`, and `pnpm dev logs`.

after editing `src/lib/essay-markdown.mjs`, restart the dev server — modules
imported by the Astro config don't hot-reload. 

## images & video

the priority order, when these conflict: **resolution served > bytes
served > repo size.** repo size comes last on purpose — github is fine to
about 5gb, and no individual file here comes close.

### mastering

export at full quality **in srgb** (png/jpg/tiff from photoshop/affinity,
prores .mov from resolve) — always srgb, the pipeline assumes it and
wide-gamut exports risk color shifts. drop the file where it belongs
(`src/archive/...` for images, `public/media/` for loops), then run
`pnpm assets` (needs ffmpeg). it masters everything in place, deletes the
sources, and derives each video's still (`src/archive/stills/<name>.avif`)
from its first frame, regenerating it when the video changes. masters are
committed; builds never need ffmpeg.

export generously. a master is a ceiling, not a payload — astro re-encodes
per slot at build, so master size costs repo bytes and nothing else.

### how images reach a browser

astro derives the variants; the browser picks one. two things decide
whether it picks well, and both are ours to get wrong.

**the ladder.** astro's built-in breakpoints for `constrained` are
`640…2560` — they stop at 2560 and skip 960 and 1920, so a 4k master is
silently unreachable and the gaps cost a rung on every pick.
`image.breakpoints` in astro.config widens and fills it.

**`sizes`.** the browser trusts it completely, so a `sizes` that overstates
the box wastes a rung or two on every load. every `sizes` here restates
that page's real css box — *including limits that aren't widths*, which is
the easy thing to miss:

| page | what actually binds |
| ------- | ------------------------------------------------------------ |
| vitrine | window **height** (`100svh` less chrome), nearly always — the box is centred and artifacts are tall |
| home | the 16-column bed, which stops growing at `100rem`; past that a column is fixed px, not a fraction of the viewport |

delivery is avif — about a quarter smaller than webp at matched quality,
and near-idempotent from an avif master where webp pays a cross-codec
generation. astro has no global format setting (`DEFAULT_OUTPUT_FORMAT` is
hardcoded), so every `<Image>` and `getImage()` passes `format="avif"` by
hand. there is no way to hoist it; don't go looking again.

### how video reaches a browser

none of the above. one encoded mp4 ships to every device and dpr — no
variants, no picking — which is why only short silent loops are self-hosted
and anything longer lives on vimeo.

so its resolution is a single global compromise, and it matters less than
it looks: `yuv420p` stores chroma at half resolution already, crf quantises
away exactly the fine detail retina buys, and motion masks the rest. past
roughly 1.5× the resolution is nominal. keep whatever came out of resolve
and spend the budget on **duration** — the only lever that is both linear
and free. fps is not one: 30→24 measured no saving at all.

the poster takes no srcset either, so it is sized once to 2× the widest box
it appears in. under reduced motion it is not a placeholder — `Layout.astro`
pauses the video and the poster becomes the whole artifact — so it is never
the place to economise.

### the knobs

| knob | value | lives in |
| ------------------ | ------------------------------ | ------------------------------- |
| master ceiling | 3840px, avif q88 | `IMAGE_MAX` / `AVIF`, assets.mjs |
| video encode | native resolution, h264 crf28 | `VIDEO_CRF`, assets.mjs |
| variant ladder | 640…3840 | `image.breakpoints`, astro.config |
| vitrine sharpness | `CAP = 1.5` | Vitrine.astro |
| home bed | 16 columns, max 1600px | `COLUMNS` / `BED`, index.astro |

`CAP` is the vitrine's whole sharpness contract: an artifact never renders
larger than 1/CAP of its native pixels, so a 2× screen gets at least 1.5
device pixels per css pixel. it is the only knob that moves sharpness — a
bigger master buys a bigger box, never a sharper one. the css and the
`sizes` string are both derived from it and have to stay in step.

## deferred upgrades

- `typescript` is pinned to 6.x: TS 7's native compiler does not yet expose the
  programmatic API `astro check` needs (withastro/roadmap#1321). Bump to 7 once
  `astro check` supports it.
- SolidJS is not installed — nothing has needed framework interactivity yet.
  When something does, add `@astrojs/solid-js` and wait for/prefer SolidJS 2.

consult these guides before working on related tasks:

- [Typescript](https://docs.astro.build/en/guides/typescript/)
- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Scripts](https://docs.astro.build/en/guides/client-side-scripts/)
- [Prefetch](https://docs.astro.build/en/guides/prefetch/)
- [Markdown](https://docs.astro.build/en/guides/markdown-content/)
- [Images](https://docs.astro.build/en/guides/images/)
