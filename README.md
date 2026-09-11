# The Shape of Computation

An interactive visual essay about why CPU, GPU, memory, and neural-processor regions develop different physical geometries on a system-on-chip.

The site is dependency-free: plain HTML, CSS, Canvas, and JavaScript.

- `index.html` — complete article and accessible controls.
- `styles.css` — layout and presentation.
- `app.js` — interactive canvas diagrams.
- `assets/` — original media, tracked with Git LFS.

## Run locally

Install Git LFS before cloning, or run `git lfs install` and `git lfs pull`
in an existing clone to download the image. All files added under `assets/`
are automatically tracked with Git LFS.

Open `index.html` directly in a browser, or run `python3 -m http.server 8000`
and visit `http://localhost:8000`.

## GitHub Pages

In the repository's Settings → Pages, select **GitHub Actions** as the source.
The deployment workflow runs on pushes to `main`, downloads LFS assets, and
uploads only the site files from a temporary `_site/` directory. No build or
JavaScript dependencies are required.

Published URL:

`https://osdouglas.github.io/learn-soc/`
