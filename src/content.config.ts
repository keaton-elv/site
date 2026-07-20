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
        for (const { id, ...raw } of parse(await readFile(index, 'utf8'))) {
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
      image: image().optional(),
      alt: z.string().optional(),
      video: z.string().optional(),
      still: image().optional(),
      device: z.string().optional(),
    })
    .refine((a) => !a.video || a.still, { message: 'videos need a still' }),
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
