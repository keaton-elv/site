// warm a page ahead of navigation: fetch its html and cue the vitrine
// hero through a detached <img> wearing the hero's own srcset/sizes —
// the browser fetches the exact variant it will pick on arrival. a
// video warms its poster; pages without a vitrine stop at the html.
const warmed = new Set<string>();
const held: HTMLImageElement[] = []; // gc may abort a dropped fetch

export async function warm(url: string) {
    if (warmed.has(url)) return;
    warmed.add(url);
    try {
        const res = await fetch(url);
        if (!res.ok) return;
        const doc = new DOMParser().parseFromString(
            await res.text(),
            "text/html",
        );
        const hero = doc.querySelector(".vitrine :is(img, video)");
        if (!hero) return;
        const img = new Image();
        img.fetchPriority = "low";
        if (hero instanceof HTMLVideoElement) {
            img.src = hero.getAttribute("poster") ?? "";
        } else {
            img.sizes = hero.getAttribute("sizes") ?? "";
            img.srcset = hero.getAttribute("srcset") ?? "";
            img.src = hero.getAttribute("src") ?? "";
        }
        held.push(img);
    } catch {
        warmed.delete(url); // may retry
    }
}
