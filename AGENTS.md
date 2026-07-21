# design

the site is a backdrop for an accumulation of artifacts. it stays out of the
way; all color, texture, and aliveness comes from what is on display.

## the two grounds

dark mode is a scanner bed: a void the artifacts float in. light mode is an
archive light table: an even glow they rest on. both are neutral chroma.

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

see astro.config.mjs for the subset of weights in use

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

the site has no center. pages are arranged content plus the panel button.
glyph is an asterism: "untitled", rendered from svg.

## the index

`src/data/index.yaml` is the single source of truth: every artifact is
an entry, and its id is its address — it lives at /<id>, at the root. 
everything is an artifact; `medium: writing` renders the essay itself — its
body is plain markdown at `src/archive/writing/<id>.md`, no frontmatter,
all metadata (`dek` included) in the index; anything else gets a
vitrine — centered, no scroll, media sized per *images & video*.
every entry carries an `image` — it is required; a video's `image` is its
still. publishing an essay is just filing it — an entry under the essay's
id (`medium: writing`, with an `image` so arrangements can place it).
an unfiled essay is just a draft. pages are rooms listed in the panel's pages 
group as they're built. the home scanner-bed is art-directed w/ deliberate 
spacing in `src/data/home.yaml`

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
videos are silent loops; each carries a still (filed as its `image`) whose
dimensions size its box, and under reduced motion the still is all there
is. anything longer than a loop lives on vimeo, embedded. serving rules:
*images & video*.

# development

when starting the dev server, use background mode:

```
pnpm dev --background
```

manage the background server with `pnpm dev stop`, `pnpm dev status`, and `pnpm dev logs`.

after editing `src/lib/essay-markdown.mjs`, restart the dev server — modules
imported by the Astro config don't hot-reload. 

## images & video

when these conflict: resolution served > bytes served > repo size.

### mastering

export at full quality in **srgb** — the pipeline assumes it, wide-gamut
shifts color. drop the file where it belongs (`src/archive/...` for images,
`public/media/` for loops) and run `pnpm assets` (needs ffmpeg): it masters
in place, deletes the source, and derives each video's still
(`src/archive/stills/<name>.avif`) from its first frame. mastered video
carries a comment tag; unmarked video is re-encoded. masters are committed,
so builds never need ffmpeg.

export generously — a master is a ceiling, not a payload. astro re-encodes
per slot, so its size costs repo bytes only.

### images

astro derives the variants, the browser picks one. two things have to hold:

- **the ladder.** astro's `constrained` breakpoints stop at 2560 and skip
  960/1920, so a 4k master would be unreachable. `image.breakpoints` in
  astro.config widens and fills it.
- **`sizes`.** must restate that page's real css box, *including limits
  that aren't widths* — the vitrine is bound by window height (`100svh`
  less `--chrome`), home by the 16-column bed that stops growing at
  `100rem`.

delivery is avif: ~25% smaller than webp at matched quality, and no
cross-codec generation off an avif master. astro has no global format
option, so every `<Image>` and `getImage()` passes `format="avif"`.

### video

no variants — one mp4 for every device and dpr. resolution is whatever came
out of resolve; past ~1.5× it is nominal anyway, since bitrate reads as
sharpness more than pixels do. **duration** is the lever worth pulling, fps
is not. anything longer than a few seconds goes to vimeo.

the poster takes no srcset, so it is sized once to 2× the widest box it
appears in. under reduced motion `Layout.astro` pauses the video and the
poster becomes the artifact — never economise there.

### the knobs

| knob | value | lives in |
| ----------------- | ----------------------------- | --------------------------------- |
| master ceiling | 3840px, avif q88 | `IMAGE_MAX` / `AVIF`, assets.mjs |
| video encode | native resolution, h264 crf28 | `VIDEO_CRF`, assets.mjs |
| variant ladder | 640…3840 | `image.breakpoints`, astro.config |
| vitrine sharpness | `CAP = 1.5` | Vitrine.astro |
| home bed | 16 columns, max 1600px | `COLUMNS` / `BED`, index.astro |

`CAP` is the vitrine's sharpness contract: an artifact renders at most
1/CAP of its native pixels, so a 2× screen gets ≥1.5 device px per css px.
it is the only knob that moves sharpness — a bigger master buys a bigger
box, not a sharper one. the css and the `sizes` string derive from it
together and have to stay in step.

## deferred upgrades

- `typescript` is pinned to 6.x: TS 7's native compiler does not yet expose the
  programmatic API `astro check` needs (withastro/roadmap#1321). Bump to 7 once
  `astro check` supports it.
- SolidJS is not installed — nothing has needed framework interactivity yet.
  When something does, add `@astrojs/solid-js` and wait for/prefer SolidJS 2.
