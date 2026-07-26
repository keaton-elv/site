/**
 * The essay voice, as a Sätteri plugin. Essays stay plain markdown plus:
 *
 *   :::aside[phrase]   An aside written *after* the paragraph it annotates
 *   ...                (asides stack: a run of them may follow one
 *   :::                paragraph). Where `phrase` occurs in that paragraph
 *                      it is marked (inverted), and mirrored as the aside's
 *                      first line. The paragraph and its run are rebuilt as
 *                      `.annotated` (paragraph, then `.asides`) so one DOM
 *                      order serves both the margin hang and the phone's
 *                      in-flow below-the-paragraph reading.
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

/** Deep-copy a subtree into plain nodes: forces lazy children, drops positions. */
const clone = (node) => {
  const out = {};
  for (const key of Object.keys(node)) if (key !== 'position') out[key] = node[key];
  if (node.children) out.children = node.children.map(clone);
  return out;
};

const textOf = (node) => node.value ?? (node.children ?? []).map(textOf).join('');

const isAside = (node) => node?.type === 'containerDirective' && node.name === 'aside';

const div = (className, children) => ({
  type: 'containerDirective',
  name: className,
  data: { hName: 'div', hProperties: { class: className } },
  children,
});

export const essayMarkdown = () => ({
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

    const parent = ctx.parent(node);
    const siblings = parent?.children ?? [];
    const at = ctx.indexOf(node);
    const target = siblings[at - 1];

    // A run of consecutive asides is handled once, from its head.
    if (isAside(target)) return;
    const run = [];
    for (let i = at; isAside(siblings[i]); i++) run.push(siblings[i]);

    // The originals are removed below; clones are re-filed inside the wrapper.
    const phrases = [];
    const asides = run.map((a) => {
      const copy = clone(a);
      copy.data = { hName: 'aside' };
      const label = copy.children[0];
      if (label?.data?.directiveLabel) {
        phrases.push(textOf(label));
        label.data = { hName: 'span', hProperties: { class: 'anchor' } };
      }
      return copy;
    });

    // Nothing to hang from: render the asides where they stand.
    if (target?.type !== 'paragraph') {
      run.forEach((a, i) => ctx.replaceNode(a, asides[i]));
      return;
    }

    // Mark each phrase in the paragraph; daggers are redone since this
    // children rewrite supersedes the paragraph visitor's earlier one.
    const found = phrases.filter((p) => target.children.some((ch) => ch.type === 'text' && ch.value.includes(p)));
    if (found.length) {
      let out = target.children.map(clone);
      for (const phrase of found) {
        out = out.flatMap((child) => {
          if (child.type !== 'text' || !child.value.includes(phrase)) return [child];
          const [before, ...rest] = child.value.split(phrase);
          return [{ type: 'text', value: before }, mark(phrase), { type: 'text', value: rest.join(phrase) }];
        });
      }
      out = out.flatMap((child) => splitDaggers(child) ?? [child]);
      ctx.setProperty(target, 'children', out);
    }

    ctx.wrapNode(target, div('annotated', [div('asides', asides)]));
    run.forEach((a) => ctx.removeNode(a));
  },

  paragraph(node, ctx) {
    if (node.data?.directiveLabel) return;
    const parent = ctx.parent(node);
    if (parent?.type === 'containerDirective' && parent.name === 'notes') return;
    let changed = false;
    const out = node.children.flatMap((child) => {
      const runs = splitDaggers(child);
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
});
