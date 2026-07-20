// Masters the site's media in place. Export at full quality,
// drop the file where it belongs, then `pnpm assets`:
//
//   src/archive/**   png/jpg/tiff/oversized avif → avif master, ≤3840px q88
//   public/media/**  mov/unmarked mp4 → h264 loop at the export's own
//                    resolution, crf28, silent, faststart, metadata stripped
//   stills           src/archive/stills/<name>.avif is derived from each
//                    video's first frame, regenerated when the video changes
//
// Video carries a comment tag once mastered; unmarked video is encoded
// once and marked. Sources must be exported in sRGB, and longer non-loop
// video belongs on vimeo. Astro takes it from here — see AGENTS.md,
// "images & video", for how masters become what a browser downloads.

import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const IMAGES = path.join(ROOT, 'src', 'archive');
const VIDEOS = path.join(ROOT, 'public', 'media');
const STILLS = path.join(IMAGES, 'stills');

const IMAGE_SOURCES = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.avif']);
const IMAGE_MAX = 3840;
const AVIF = { quality: 88, effort: 7 };

const VIDEO_SOURCES = new Set(['.mov', '.mp4']);
const VIDEO_CRF = 28;
const MARK = 'site-optimized-v1';

function* walk(dir, sources) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(file, sources);
    else if (sources.has(path.extname(entry.name).toLowerCase())) yield file;
  }
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `${command} exited with ${result.status}`);
  }
  return result.stdout;
}

const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

// --- images ---------------------------------------------------------------

for (const file of walk(IMAGES, IMAGE_SOURCES)) {
  const ext = path.extname(file);
  const out = path.join(path.dirname(file), `${path.basename(file, ext)}.avif`);

  const image = sharp(readFileSync(file), { autoOrient: true });
  const meta = await image.metadata();
  const size = meta.autoOrient ?? meta;

  if (out === file && size.width <= IMAGE_MAX) continue;

  const temp = `${out}.tmp-${process.pid}.avif`;
  try {
    const { width, height } = await image
      .resize({ width: IMAGE_MAX, withoutEnlargement: true })
      .avif(AVIF)
      .toFile(temp);
    renameSync(temp, out);
    if (out !== file) unlinkSync(file);

    const from = `${size.width}×${size.height}`;
    const to = `${width}×${height}`;
    console.log(`✓ ${path.relative(ROOT, out)}  ${from}${from === to ? '' : ` → ${to}`}`);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}

// --- videos ---------------------------------------------------------------

function inspect(file) {
  const data = JSON.parse(
    run(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format_tags=comment:stream=codec_type,codec_name,pix_fmt,width,height', '-of', 'json', file],
      true,
    ),
  );
  const video = data.streams.find((stream) => stream.codec_type === 'video');
  if (!video) throw new Error(`No video stream found in ${file}`);
  return { ...video, optimized: data.format.tags?.comment === MARK };
}

for (const file of walk(VIDEOS, VIDEO_SOURCES)) {
  const ext = path.extname(file).toLowerCase();
  const meta = inspect(file);
  const mastered =
    ext === '.mp4' && meta.codec_name === 'h264' && meta.pix_fmt === 'yuv420p' && meta.optimized;

  if (mastered) continue;

  const out = path.join(path.dirname(file), `${path.basename(file, ext)}.mp4`);
  const temp = `${out}.tmp-${process.pid}.mp4`;
  const before = statSync(file).size;

  try {
    run('ffmpeg', [
      '-y', '-v', 'error',
      '-i', file,
      '-map', '0:v:0',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', String(VIDEO_CRF),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an', '-dn',
      '-map_metadata', '-1',
      '-metadata', `comment=${MARK}`,
      temp,
    ]);
    const after = statSync(temp).size;
    renameSync(temp, out);
    if (out !== file) unlinkSync(file);
    console.log(`✓ ${path.relative(ROOT, out)}  ${mib(before)} → ${mib(after)}`);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}

// --- stills ---------------------------------------------------------------

for (const file of walk(VIDEOS, new Set(['.mp4']))) {
  const still = path.join(STILLS, `${path.basename(file, '.mp4')}.avif`);
  if (existsSync(still) && statSync(still).mtimeMs >= statSync(file).mtimeMs) continue;

  mkdirSync(STILLS, { recursive: true });
  const temp = `${still}.tmp-${process.pid}.png`;
  try {
    run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-frames:v', '1', temp]);
    await sharp(temp).resize({ width: IMAGE_MAX, withoutEnlargement: true }).avif(AVIF).toFile(still);
    console.log(`✓ ${path.relative(ROOT, still)}  first frame`);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
}
