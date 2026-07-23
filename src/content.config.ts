// the index (src/data/index.yaml) becomes the `artifacts` collection.
// a hand-rolled loader because each `medium: writing` entry pulls its
// body from src/archive/writing/<id>.md — plain markdown, no frontmatter;
// the index owns all metadata. `home` is the scanner bed's arrangement.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse } from 'yaml';

const artifacts = defineCollection({
  loader: {
    name: 'artifacts',
    load: async ({ store, parseData, renderMarkdown, watcher, config }) => {
      const index = fileURLToPath(new URL('src/data/index.yaml', config.root));
      const writing = new URL('src/archive/writing/', config.root);
      const sync = async () => {
        store.clear();
        for (const { id: filed, ...raw } of parse(await readFile(index, 'utf8'))) {
          // an entry's id — its address — is its file's basename;
          // filed explicitly only to pin an address to a renamed file
          const id =
            filed ?? (raw.video ?? raw.image).replace(/.*\/(.*)\.\w+$/, '$1');
          if (store.has(id)) throw new Error(`duplicate artifact id: ${id}`);
          // a video's still has a fixed address (see scripts/assets.mjs)
          if (raw.video && !raw.image)
            raw.image = raw.video.replace(/.*\/(.*)\.\w+$/, '../archive/stills/$1.avif');
          const body = new URL(`${id}.md`, writing);
          const rendered =
            raw.medium === 'writing'
              ? await renderMarkdown(await readFile(body, 'utf8'), { fileURL: body })
              : undefined;
          store.set({
            id,
            data: await parseData({ id, data: raw, filePath: index }),
            filePath: 'src/data/index.yaml',
            rendered,
            assetImports: rendered?.metadata?.imagePaths,
          });
        }
      };
      watcher?.add([index, fileURLToPath(writing)]);
      watcher?.on('change', (path) => {
        if (path === index || path.startsWith(fileURLToPath(writing))) sync();
      });
      await sync();
    },
  },
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      year: z.number(),
      medium: z.string(),
      dek: z.string().optional(),
      note: z.string().optional(),
      image: image(),
      crop: z.number().min(0).max(1).optional(),
      alt: z.string().optional(),
      video: z.string().optional(),
      device: z.string().optional(),
    }),
});

const home = defineCollection({
  loader: file('src/data/home.yaml', {
    parser: (text) =>
      (parse(text) as object[]).map((entry, at) => ({ ...entry, at })),
  }),
  schema: z.object({
    w: z.number().min(1).max(16),
    x: z.number().min(1).max(16),
    mt: z.number().default(0),
    at: z.number(),
  }),
});

export const collections = { artifacts, home };
