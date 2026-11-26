# mappingAS GEE 2.0.0

Preliminary IUCN Red List assessments in Google Earth Engine (EOO/AOO, land cover, habitat, threats,
climate, bioclimate model, protected areas, criteria A-E, IUCN documents). Earth Engine version of the
R package mappingAS.

## Repository structure

```
app.js                 main script: loads the modules and starts the app (run this one)
modules/config.js      defaults, built-in example, legends, land-cover products, IUCN reference tables
modules/rangecalc.js   AOO, EOO, locations, subpopulations, Criterion B, trends
modules/utils.js       formatting, palettes, tables, cards, small helpers
modules/layout.js      left panel and tabbed results panel
modules/records.js     reading the occurrence table; points added on the map
modules/run.js         statistics helpers and the step-by-step run of one species
modules/charts.js      charts, tables and MapBiomas-style cards
modules/tabs.js        Map, Time series, Conversion, Protected areas and Summary tabs
modules/downloads.js   CSV/GeoJSON links, map layers, export tasks
modules/batch.js       start-up state and the Batch tab
modules/habitat.js     habitat decline (Criterion A), fragmentation, pixel history, fire, deforestation
modules/climate.js     TerraClimate, ENSO, ERA5-Land, CMIP6 and climatic niche exposure
modules/rasters.js     GeoTIFF and extra vector downloads
modules/report.js      single-file HTML report and batch spatial layers
modules/iucn_calc.js   assessment settings, generation length, criteria A-E, plausible ranges
modules/iucn_coding.js IUCN data from Earth Engine and coded fields, narratives, checklist
modules/redlist.js     Red List tab
modules/sdm.js         bioclimate model (screening, Maxent, Random Forest, evaluation, projections)
modules/documents.js   Word supplementary information, SIS tables, IUCN attributes
modules/welcome.js     welcome screen
```

## How the modules talk to each other

Every module exports two functions:

* `define(ns)` registers its functions in the shared namespace `MAS`;
* `run()` builds its part of the interface and its state.

`app.js` first calls `define` on every module and then `run`, in the order listed, so any module can call
any function of another one as `MAS.name(...)`, and shared state (for example `MAS.APP.current`, the
species being assessed) is read and written in the same way. Functions used only inside a module are
called directly.

## Adding a feature

1. Create `modules/<name>.js`:

```js
var MAS = null;
exports.define = function (ns) { MAS = ns; MAS.myAnalysis = myAnalysis; };
exports.run = function () { /* widgets or tables created once, if any */ };

function myAnalysis(R) {
  // R = MAS.APP.current: records (R.recs), EOO (R.eooKm2), AOO (R.aoo), settings (R.cfg)...
  return MAS.fmt(R.eooKm2, 0);
}
```

2. Add `require('users/paleomapas/mappingAS-dev:modules/<name>.js')` to the list in `app.js`
   (before `welcome.js`).

## Development and publication

* `users/paleomapas/mappingAS-dev` (private): changes are made and tested here.
* `users/paleomapas/mappingAS` ("Anyone can read"): the public copy used by the App.

To publish a tested version, copy the files to the public repository and replace `mappingAS-dev` by
`mappingAS` in the `require` lines of `app.js` (the modules contain no paths). The public repository must
stay readable by everyone, otherwise other users and the App cannot load the modules.

## Copying the files with git

```
git clone https://earthengine.googlesource.com/users/paleomapas/mappingAS-dev
# copy app.js, README.md and the modules folder into the clone
cd mappingAS-dev
git add -A
git commit -m "mappingAS GEE 2.0.0"
git push origin master
```

The first push asks for credentials: generate them at https://earthengine.googlesource.com/new-password.
The same files can be pushed to GitHub.

## Citation

Barreira, L. (2026). mappingAS: preliminary IUCN Red List assessments in Google Earth Engine.
Version 2.0.0. https://github.com/lucasbarreirageo/mappingAS
