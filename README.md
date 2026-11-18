# ImPress project website

**ImPress: Imitation Learning from VR Human Demonstrations via Contact Pressure-Guided Retargeting**

A buildless GitHub Pages starter adapted from [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template). Bulma, the template stylesheet, and its academic page structure are retained, with ImPress styling in `static/css/impress.css`.

## Preview locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. No installation or build step is required.

## Update before release

- Replace disabled Paper, Code, and Dataset buttons with real links.
- Add the official citation and demonstration videos when available.
- Verify manuscript results before the public release. Current text and numbers come from the supplied draft abstract.
- Update metadata if the project URL or title changes.

## Assets

`overview.png`, `data-collection.png`, and `example-tasks.png` are web renderings of the supplied manuscript figures `front_v4.pdf`, `data_collection_v4.pdf`, and `example_tasks.pdf`. Replace these images as figures evolve. Source manuscript files are not needed to serve the site.

## GitHub Pages

Use Settings → Pages → Deploy from a branch → `main` → `/ (root)`. The `.nojekyll` file allows these static files to be served directly. Intended URL: https://vr-impress.github.io/.

## Attribution

Adapted from [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template), which also credits [Nerfies](https://nerfies.github.io/). The template and this website adaptation are licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Research text and figures remain the property of their respective authors. Bulma retains its upstream MIT license notice in its stylesheet.

## Video placeholders and research tabs

- The hero has four muted, looping video elements with still-image posters. Add local `src` paths to `.hero-mosaic video` in `index.html` and remove the coming-soon label when ready. Playback respects reduced-motion settings and pauses in background tabs.
- Replace `.video-placeholder` (between the teaser and abstract) with the project video player and captions.
- The three research tabs support clicks, Left/Right/Home/End keys, Previous/Next buttons, and horizontal swipes. Interaction code is in `static/js/impress.js`.
- The first three authors have equal-contribution markers. Affiliations 1 and 4 share the CMU logo.

## Palette and logo sources

Page accents and the policy chart use the supplied *Paper Colour Palettes.pdf*: indigo `#332288`, cyan `#88CCEE`, teal `#44AA99`, and rose `#CC6677`. Existing research figures and official institution logo colors are preserved.

Logos are stored locally from official sources:
- CMU: https://brand.cmu.edu/resources/downloads
- Illinois: https://cdn.brand.illinois.edu/logos/block-i.svg
- Berkeley: https://brand.berkeley.edu/visual-identity/logos/
- Bosch: the header SVG at https://www.bosch.com/

The retargeting image is rendered from `retargeting_output_one_demo_v2.pdf` in the supplied manuscript.
