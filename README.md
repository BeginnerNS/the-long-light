# The Long Light — photography portfolio

A fast, static, warm-cinematic portfolio for landscape & street photography.
No build step, no dependencies — just HTML, CSS, and a little JavaScript.

```
index.html            ← the whole page (edit text + photos here)
assets/css/styles.css ← the design system (colors, type, layout)
assets/js/main.js      ← filtering + lightbox (progressive enhancement)
.nojekyll              ← tells GitHub Pages to serve the assets/ folder as-is
PRODUCT.md / DESIGN.md ← the strategy + design notes behind the site
```

---

## 1. What's already set up

- Name (**Nisargi Shah**), city (**Mumbai**), and contact email (**nisargi3112@gmail.com**) are already in `index.html`.
- Your 11 photos are wired in: 1 hero, 9 in the gallery, 1 in the About section.
- They've been optimised for the web (long edge 1800px, ~80% quality) and live in `assets/img/`.
- Your **full-resolution originals** are safely backed up in the `_originals/` folder (this folder is just a backup; you don't need to upload it).

Still optional, all in `index.html`:

| Find | Replace with |
|------|--------------|
| `The Long Light` | A different site name, if you'd like (nav, hero, footer) |
| `Landscapes, streets, and the hour between.` | A different tagline |
| `https://instagram.com/` | Your real Instagram link |

The contact button is a `mailto:` link, so clicking it opens the visitor's email app. No server needed.

## 2. Adding, replacing, or reordering photos

Each photo in the gallery is one `<figure class="shot ...">` block in `index.html`:

```html
<figure class="shot reveal" data-cat="landscape">
  <button class="shot__btn" type="button" aria-label="Open image: Your title">
    <img src="assets/img/your-photo.jpg" data-full="assets/img/your-photo.jpg"
         alt="Describe the photo, this matters for accessibility and SEO"
         loading="lazy" width="1350" height="1800">
  </button>
  <figcaption class="shot__cap"><span class="shot__title">Your title</span><span class="shot__cat">Landscape</span></figcaption>
</figure>
```

- `data-cat` must be `landscape` or `street` so the filter buttons work (change the `shot__cat` label to match).
- To **add** a photo: drop the file in `assets/img/` and copy a `<figure>` block, updating the paths and text. To **remove** one: delete its block. To **reorder**: move blocks up or down.
- The **hero** image is the `<img>` inside `<section class="hero">`; the **About** image is inside `<div class="about__portrait">`.
- **Keep files light** (aim under ~600 KB). To re-optimise a new full-size photo on Windows, you can reuse the same resize approach, or any image tool, targeting ~1800px on the long edge.

## 3. Publish free on GitHub Pages

You'll need a free [GitHub](https://github.com) account.

**Option A — browser only (no git):**
1. Create a new repository, e.g. `the-long-light` (set it to **Public**).
2. On the repo page click **Add file → Upload files**, then drag in
   `index.html`, the `assets` folder, and `.nojekyll`. Commit.
3. Go to **Settings → Pages**. Under *Build and deployment*, set
   **Source: Deploy from a branch**, **Branch: `main` / `root`**, and Save.
4. Wait ~1 minute. Your site is live at
   `https://<your-username>.github.io/the-long-light/`.

**Option B — with git (from this folder):**
```bash
git init
git add .
git commit -m "The Long Light — initial site"
git branch -M main
git remote add origin https://github.com/<your-username>/the-long-light.git
git push -u origin main
```
Then do step 3 above (Settings → Pages).

> **Tip:** if you name the repo `<your-username>.github.io`, the site publishes at
> `https://<your-username>.github.io/` with no subpath.

### Custom domain (optional, later)
If you buy a domain (e.g. `thelonglight.com`), add it under **Settings → Pages → Custom domain**
and point your domain's DNS at GitHub. HTTPS is issued automatically and free.

## 4. Preview locally before publishing
Because the browser loads files from `assets/`, open it through a tiny local server
rather than double-clicking (some browsers block `file://` asset loading):
```bash
# from this folder — pick whichever you have
python -m http.server 8000       # then open http://localhost:8000
npx serve .                       # Node alternative
```

---

Built with the impeccable design system. Design register: **brand** · Platform: **web**.
