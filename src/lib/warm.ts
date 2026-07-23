// warm a page ahead of navigation: fetch its html and cue what paints
// there — a vitrine's hero through a detached <img> wearing the hero's
// own srcset/sizes (the browser fetches the exact variant it will pick
// on arrival), a video's poster, an essay's voice.
const warmed = new Set<string>();
const held: HTMLImageElement[] = []; // gc may abort a dropped fetch

// family names are hashed — resolve them from the voice variables
const voice = (spec: string, name: string) => {
    const family = getComputedStyle(
        document.documentElement,
    ).getPropertyValue(name);
    if (family) document.fonts.load(`${spec} 1rem ${family}`).catch(() => {});
};

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
        if (doc.querySelector(".essay")) {
            voice("", "--font-serif");
            voice("italic", "--font-serif");
            if (doc.querySelector("aside")) voice("600", "--font-sans");
            return;
        }
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
