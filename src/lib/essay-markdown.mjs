/**
 * The essay voice, as a Sätteri plugin. Essays stay plain markdown plus:
 *
 *   :::aside[phrase]   An aside written *before* the paragraph it annotates.
 *   ...                Where `phrase` occurs in that paragraph it is marked
 *   :::                (inverted), and mirrored as the aside's first line.
 *                      Asides stack: several may precede one paragraph.
 *
 *   :::notes           A section's own footnote block, kept at the end of
 *   † ...              its h2 section. Lines are labelled with daggers,
 *   :::                not numbers: † ‡ § ‖ ¶
 *
 *   ![alt](src "cap")  An image alone in its paragraph becomes a <figure>;
 *                      a quoted title becomes its <figcaption>, `_runs_`
 *                      in the title set italic.
 *
 *   † ‡ § ‖ ¶            Dagger marks in body text are set superscript.
 *
 *   :sc[text]          Set in etbook's true small capitals.
 *
 *   :::wide / :::full  Let the wrapped content span into the aside margin,
 *                      or bleed across the whole window.
 */

const DAGGERS = /([†‡§‖¶]+)/;

const sup = (value) => ({ type: 'emphasis', data: { hName: 'sup' }, children: [{ type: 'text', value }] });
const mark = (value) => ({ type: 'emphasis', data: { hName: 'mark' }, children: [{ type: 'text', value }] });

/** A title string's `_runs_` become emphasis; titles are never parsed as markdown. */
const caption = (title) =>
  title
    .split(/_([^_]+)_/)
    .flatMap((run, i) =>
      i % 2 ? [{ type: 'emphasis', children: [{ type: 'text', value: run }] }] : run ? [{ type: 'text', value: run }] : [],
    );

/** Split one text node into text/sup runs; returns null when no daggers. */
function splitDaggers(node) {
  if (node.type !== 'text' || !DAGGERS.test(node.value)) return null;
  return node.value
    .split(DAGGERS)
    .filter(Boolean)
    .map((run) => (DAGGERS.test(run) ? sup(run) : { type: 'text', value: run }));
}

export const essayMarkdown = () => {
  // Filled by the aside visitor; the paragraph that directly follows an
  // aside (found again by parent + position) carries the marked phrase.
  const anchors = [];

  return {
    name: 'essay-markdown',

    containerDirective(node, ctx) {
      if (node.name === 'notes') {
        ctx.setProperty(node, 'data', { hName: 'footer', hProperties: { class: 'notes' } });
        return;
      }
      if (node.name === 'wide' || node.name === 'full') {
        ctx.setProperty(node, 'data', { hName: 'div', hProperties: { class: node.name } });
        return;
      }
      if (node.name !== 'aside') return;
      ctx.setProperty(node, 'data', { hName: 'aside' });
      const label = node.children[0];
      if (label?.data?.directiveLabel) {
        ctx.setProperty(label, 'data', { hName: 'span', hProperties: { class: 'anchor' } });
        const parent = ctx.parent(node);
        const siblings = parent?.children ?? [];
        let index = ctx.indexOf(node) + 1;
        while (siblings[index]?.type === 'containerDirective' && siblings[index].name === 'aside') index += 1;
        anchors.push({ phrase: ctx.textContent(label), parent, index });
      }
    },

    paragraph(node, ctx) {
      if (node.data?.directiveLabel) return;
      const parent = ctx.parent(node);
      const inNotes = parent?.type === 'containerDirective' && parent.name === 'notes';
      const index = ctx.indexOf(node);
      const phrases = anchors.filter((a) => a.parent === parent && a.index === index).map((a) => a.phrase);

      let changed = phrases.length > 0;
      let out = node.children;
      for (const phrase of phrases) {
        out = out.flatMap((child) => {
          if (child.type !== 'text' || !child.value.includes(phrase)) return [child];
          const [before, ...rest] = child.value.split(phrase);
          return [{ type: 'text', value: before }, mark(phrase), { type: 'text', value: rest.join(phrase) }];
        });
      }
      out = out.flatMap((child) => {
        const runs = inNotes ? null : splitDaggers(child);
        if (runs) changed = true;
        return runs ?? [child];
      });
      if (changed) ctx.setProperty(node, 'children', out);
    },

    textDirective(node, ctx) {
      if (node.name === 'sc') ctx.setProperty(node, 'data', { hName: 'span', hProperties: { class: 'sc' } });
    },

    image(node, ctx) {
      const parent = ctx.parent(node);
      if (parent?.type !== 'paragraph' || parent.children.length !== 1) return;
      ctx.setProperty(parent, 'data', { hName: 'figure' });
      if (node.title) ctx.appendChild(parent, { type: 'emphasis', data: { hName: 'figcaption' }, children: caption(node.title) });
    },
  };
};
