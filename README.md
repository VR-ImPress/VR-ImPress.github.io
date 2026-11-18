# ImPress project website

**ImPress: Imitation Learning from VR Human Demonstrations via Contact Pressure-Guided Retargeting**

A buildless GitHub Pages starter adapted from [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template). Bulma, the template stylesheet, and its academic page structure are retained, with ImPress styling in `static/css/impress.css`.

## Preview locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. No installation or build step is required.

## Update before release

- Edit `index.html` to add confirmed authors and affiliations.
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
