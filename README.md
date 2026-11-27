# ImPress project website

**ImPress: Imitation Learning from VR Human Demonstrations via Contact Pressure-Guided Retargeting**

A buildless GitHub Pages starter adapted from [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template). Bulma, the template stylesheet, and its academic page structure are retained, with ImPress styling in `static/css/impress.css`.

## Preview locally

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:8000/#demos). Serve the site over HTTP so the browser can load the 3D models. No installation or build step is required.

## Update before release

- Replace disabled Paper and Code buttons with real links.
- Add the official citation and demonstration videos when available.
- Verify manuscript results before the public release. Current text and numbers come from the supplied draft abstract.
- Update metadata if the project URL or title changes.

## Assets

`overview.png`, `data-collection.png`, and `example-tasks.png` are web renderings of the supplied manuscript figures `front_v4.pdf`, `data_collection_v4.pdf`, and `example_tasks.pdf`. Replace these images as figures evolve. Source manuscript files are not needed to serve the site.

## GitHub Pages

GitHub Pages deploys from `develop` at `/ (root)`. The `.nojekyll` file allows these static files to be served directly. Intended URL: https://vr-impress.github.io/.

## Attribution

Adapted from [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template), which also credits [Nerfies](https://nerfies.github.io/). The template and this website adaptation are licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Research text and figures remain the property of their respective authors. Bulma retains its upstream MIT license notice in its stylesheet.

## Videos and research sections

- The hero uses `static/videos/dataset-mosaic.mp4`, an 8×8 tiled loop that shows all 71 supplied renders over 12 seconds. Automatic playback respects reduced motion and pauses when the video scrolls offscreen.
- The overview and dataset preview videos start muted when visible and respect reduced-motion preferences. The overview uses `static/videos/impress-supplementary.mp4`.
- The homepage stacks the research cards vertically and uses sticky stage titles with native scroll snapping. Add cards inside the corresponding `.v-cards` in `index.html`. The layout and stage navigation use `static/css/research-vertical.css` and `static/js/research-vertical.js`.
- Layout prototypes for comparison (temporary):
  - `research-vertical.html`: the standalone prototype for the homepage's research layout.
  - `research-carousel.html`: the earlier three-panel carousel with edge previews, from commit 42483a6 (`static/css/impress-carousel.css`, `static/js/impress-carousel.js`).
- The first three authors have equal-contribution markers. All CMU authors share affiliation 1; Bosch is affiliation 4.

## Palette and logo sources

The main accent is `#72A3FE` from the supplied *Paper Colour Palettes.pdf*, with cyan `#88CCEE`, teal `#44AA99`, and rose `#CC6677` as secondary colors. Existing research figures and official institution logo colors are preserved.

Logos are stored locally from official sources:
- CMU: user-supplied square university logo (`cmu-square.png`).
- Illinois: https://cdn.brand.illinois.edu/logos/block-i.svg
- Berkeley: https://brand.berkeley.edu/visual-identity/logos/
- Bosch: the header SVG at https://www.bosch.com/

The retargeting image is rendered from `retargeting_output_one_demo_v2.pdf` in the supplied manuscript.

## Interactive demos

The three featured GLBs in `static/demos/` replay the recorded Newton body poses and deform the visual hand surfaces from `meta/rig/*/skin.npz`. Motion is sampled at about 60 Hz and includes the final recorded pose. The raw `demos/` folder is ignored by Git.

The exporter also writes an optional `.contacts.gz` sidecar from the recorded hand–object triangles. The viewer loads it when the visitor enables **Contact patches**. Patches are sampled at about 60 Hz, with extra samples at the original contact start and end times. While the overlay is visible, the hand and object poses advance with the selected contact sample. Patches are rendered through surfaces so they can be inspected while scrubbing or orbiting. Color encodes penetration depth, with the darkest color at 0.25 mm and beyond.

Export another recording with Python, NumPy, and Pillow:

```sh
python3 tools/export-demo.py /path/to/recorded_task 0 /tmp/task-episode-0.glb
```

To add demos without growing the GitHub Pages site, upload their GLBs and a separate catalog JSON to a public Hugging Face dataset repository or another static asset host. Include any matching contact sidecars. Serve the catalog, GLBs, and sidecars over HTTPS with cross-origin access enabled for the project website. Set `data-external-catalog` on the `.demo-panel` in `index.html` to the hosted catalog URL, for example `https://huggingface.co/datasets/ORG/REPO/resolve/main/catalog.json`. Once configured, publish future catalog updates on that host. Both catalogs use this format:

```json
{
  "demos": [
    {
      "id": "task-episode-0",
      "title": "Task name",
      "model": "task-episode-0.glb",
      "contacts": "task-episode-0.contacts.gz",
      "cameraTarget": "0.45m 1.1m 0.2m",
      "cameraOrbit": "-55deg 65deg 1.1m",
      "keyTime": 4
    }
  ]
}
```

Use a distinct `id` for each entry. Model and optional contact paths are relative to the catalog URL or absolute HTTPS URLs. The camera fields and `keyTime` (seconds) are optional. The three bundled entries are in `static/demos/catalog.json`.

The dataset section plays the supplied renders in a single video player. The 960-pixel-wide MP4 previews are in `static/videos/renders/` and the player requests the selected clip on demand.

The existing Hugging Face dataset repository gates raw recordings and the render archive. For anonymous playback from GitHub Pages, place approved preview GLBs, contact sidecars, and the catalog in a separate public, ungated Hugging Face repository. Use its `resolve/main/` URLs. The site has no server-side credential store, so keep access tokens out of the catalog and browser code.

The task browser reads `static/demos/tasks.json`. Its categories use the **Skill** column of the [dataset card’s Task classification table](https://huggingface.co/datasets/vrmanipulation/vr_dataset#task-classification). The `video` field accepts paths relative to the catalog or absolute HTTPS media URLs. Keep the `sourceRevision` and entries current when the release changes.
