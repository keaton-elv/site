/**
 * The essay voice, as a Sätteri plugin. Essays stay plain markdown plus:
 *
 *   :::aside[phrase]   An aside written *before* the paragraph it annotates.
 *   ...                Where `phrase` occurs in that paragraph it is marked
 *   :::                (inverted), and mirrored as the aside's first line.
 *
 *   :::notes           A section's own footnote block, kept at the end of
 *   † ...              its h2 section. Lines are labelled with daggers,
 *   :::                not numbers: † ‡ ‖ ¶
 *
 *   ![alt](src "cap")  An image with a quoted title becomes a <figure>
 *                      with the title as its <figcaption>.
 *
 *   † ‡ ‖ ¶            Dagger marks in body text are set superscript.
 *
 *   :sc[text]          Set in etbook's true small capitals.
 *
 *   :::wide / :::full  Let the wrapped content span into the aside margin,
 *                      or bleed across the whole window.
 */

const DAGGERS = /([†‡‖¶]+)/;

const sup = (value) => ({ type: 'emphasis', data: { hName: 'sup' }, children: [{ type: 'text', value }] });
const mark = (value) => ({ type: 'emphasis', data: { hName: 'mark' }, children: [{ type: 'text', value }] });

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
        anchors.push({ phrase: ctx.textContent(label), parent: ctx.parent(node), index: ctx.indexOf(node) + 1 });
      }
    },

    paragraph(node, ctx) {
      if (node.data?.directiveLabel) return;
      const parent = ctx.parent(node);
      const inNotes = parent?.type === 'containerDirective' && parent.name === 'notes';
      const phrase = anchors.find((a) => a.parent === parent && a.index === ctx.indexOf(node))?.phrase ?? null;

      let changed = Boolean(phrase);
      const out = node.children.flatMap((child) => {
        if (phrase && child.type === 'text' && child.value.includes(phrase)) {
          const [before, ...rest] = child.value.split(phrase);
          const head = { type: 'text', value: before };
          const tail = { type: 'text', value: rest.join(phrase) };
          return [...(splitDaggers(head) ?? [head]), mark(phrase), ...(splitDaggers(tail) ?? [tail])];
        }
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
      if (parent?.type !== 'paragraph' || !node.title) return;
      ctx.setProperty(parent, 'data', { hName: 'figure' });
      ctx.appendChild(parent, { type: 'emphasis', data: { hName: 'figcaption' }, children: [{ type: 'text', value: node.title }] });
    },
  };
};
