# mappingAS GEE

**Preliminary IUCN Red List assessments in Google Earth Engine**

Version 2.0.0 · JavaScript (Earth Engine Code Editor / Earth Engine Apps) · Earth Engine version of the R package [mappingAS](https://github.com/lucasbarreirageo/mappingAS)

mappingAS GEE turns a table of occurrence records into a documented, preliminary IUCN Red List assessment. It
computes the range parameters of Criterion B, measures habitat loss and fragmentation from annual land-cover
maps, describes fire, deforestation and climate threats, fits a bioclimate model for Criterion A3, checks
protected-area coverage, evaluates criteria A to E with plausible ranges, and writes the IUCN supporting
documents (Word supplementary information, SIS coded tables, point and polygon files with IUCN attributes).
It runs entirely on Google's servers: nothing needs to be installed, and species occurring in several countries
are handled with the land-cover collection of each country.

> The results are **preliminary**. They support, but do not replace, an assessment by experts on the species
> following the IUCN Red List Categories and Criteria, the Guidelines and the Documentation Standards. Every
> code and value must be checked by the assessor before submission to the IUCN Red List (SIS).

---

## Contents

1. [Quick start](#1-quick-start)
2. [Input data](#2-input-data)
3. [Workflow and tabs](#3-workflow-and-tabs)
4. [Methods](#4-methods)
5. [Outputs](#5-outputs)
6. [Datasets](#6-datasets)
7. [Repository structure and architecture](#7-repository-structure-and-architecture)
8. [Development and contributing](#8-development-and-contributing)
9. [Limitations](#9-limitations)
10. [Versions](#10-versions)
11. [How to cite](#11-how-to-cite)
12. [References](#12-references)
13. [License and contact](#13-license-and-contact)

---

## 1. Quick start

**In the Earth Engine Code Editor** (requires an Earth Engine account and a Cloud project registered for Earth Engine):

1. Add the repository to your Code Editor:
   `https://code.earthengine.google.com/?accept_repo=users/paleomapas/mappingAS`
2. Open `users/paleomapas/mappingAS:app.js` and press **Run**.
3. Read the welcome screen, tick *I have read the instructions* and press **Start**, or **Try the example**
   (*Prepusa hookeriana*, Gentianaceae, GBIF records).

**As an Earth Engine App**: the public App link will be listed here once published. Apps work in any browser
without an Earth Engine account, but cannot create export tasks (all results are delivered as download links).

**Step by step (as shown in the app)**

| Step | What to do |
|---|---|
| 1. Load the records | Panel 1: paste the table or type the asset id; choose the species and check the columns. |
| 2. Choose the data | Panels 2–4d: land cover and years, AOO cell (2 km), protected areas, generation length, species habitat (classes, elevation). |
| 3. Press Assess | Panel 5: the progress list shows each step; large ranges take a few minutes. |
| 4. Check the records | Red List tab, section 8: exclude records with errors or historical records, then press Assess again. |
| 5. Read the evidence | Map, Time series, Conversion, Habitat, Threats, Climate and Protected areas tabs. |
| 6. Decide | Red List tab: generation length, sub-criteria, population data, uncertainty; confirm habitat and threat codes. |
| 7. Export | Summary tab: HTML report and CSV. Red List tab: Word supplementary information, SIS tables, IUCN map files. |

Adding `?intro=0` to the link skips the welcome screen.

---

## 2. Input data

One row per record, with species, longitude and latitude (country is optional), as in `mappingAS::read_occurrences()`.

| Field | Recognised column names (examples) |
|---|---|
| Species | `species`, `scientificName`, `taxon`, `binomial` |
| Longitude | `decimalLongitude`, `longitude`, `lon`, `x` |
| Latitude | `decimalLatitude`, `latitude`, `lat`, `y` |
| Country (optional) | `country`, `countryCode` (ISO2 or ISO3 accepted) |
| Optional fields used in the checks and IUCN files | year, basis of record, catalogue number, collector, collector number |

Three ways to give the data:

* **Paste** a table copied from Excel or a CSV file (header in the first row) or a whole GeoJSON. Nothing is
  uploaded. If the browser removes line breaks, separate records with ` | `.
* **Asset**: upload the CSV in *Assets → NEW → CSV file* and paste the asset id. For a published App, share the
  asset as *Anyone can read*.
* **Built-in example**: *Prepusa connata* and *P. hookeriana* (GBIF).

Points can also be added by clicking on the map or typing longitude/latitude or UTM coordinates (*Add points* tab).

---

## 3. Workflow and tabs

The tabs follow the order of an assessment: data and range → habitat evidence → threats and climate →
protection → decision → summary.

| Tab | Content |
|---|---|
| **Map** | Records, EOO, AOO cells, locations, subpopulations, land cover, protected areas; layers can be switched on and off. |
| **Add points** | Records added by clicking on the map or typing coordinates. |
| **Time series** | Annual land-cover composition in the EOO and AOO, by country and inside/outside protected areas; trend of natural habitat. |
| **Conversion** | Transitions between land-cover classes (what replaced natural habitat). |
| **Habitat** | Area of habitat (AOH), fragmentation at 30 m (edge distance, patch size, isolation), pixel history (stable habitat, regrowth, accumulated loss, age of vegetation). |
| **Threats** | Burned area and fire frequency (MapBiomas Fire); deforestation and secondary vegetation (MapBiomas). |
| **Climate** | TerraClimate series since 1958, climatic niche exposure, signal-to-noise, ENSO phases, climograph, last 24 months (ERA5-Land), CMIP6 projections. |
| **Bioclimate model** | Species distribution model following Guidelines 12.1.12: variable screening, two techniques, evaluation, projections for Criterion A3. |
| **Protected areas** | Records, EOO and AOO cells in protected areas (WDPA), by IUCN management category; list of protected areas. |
| **Red List** | Assessment settings, generation length, criteria A–E with plausible ranges, NT and DD rules, record checks, coded fields, narratives, checklist, documents. |
| **Summary** | Overview of the assessment, HTML report and CSV. |
| **Batch** | Many species in sequence (Quick, Full or Complete), with tables, charts and rasters for all species. |

---

## 4. Methods

### 4.1 Range parameters (Criterion B)

* **AOO**: 2 × 2 km grid (the IUCN reference scale) in a Lambert azimuthal equal-area projection centred on the
  data; the minimum number of occupied cells over 100 shifted grids. AOO is also reported at other cell sizes
  (area–area relationship, Guidelines 4.10). **Upper bound**: AOH within the EOO on the 2 × 2 km grid
  (Guidelines 4.10.8).
* **EOO**: minimum convex polygon with great-circle edges (densified every 20 km). The polygon is used for the
  EOO value only and is not a range map. An alpha hull (α = 2; Burgman & Fox 2003) is given for trends only.
* **Locations**: 10 km grid (minimum over 100 grids). With protected areas, each protected area holding records
  can count as one location, or records inside and outside are gridded separately.
* **Subpopulations**: circular-buffer method, radius = 1/10 of the maximum distance between records (Rivers et al. 2010).
* **Criterion B**: B1/B2 thresholds and sub-criteria (a) number of locations or severe fragmentation,
  (b) continuing decline, inferred only from a significant recent decline of natural habitat (AOH), and
  (c) extreme fluctuations.
* **Current and historical records**: records before a chosen year can be treated as historical; EOO and AOO are
  reported for all, current and historical records.

### 4.2 Area of habitat and Criterion A

* **AOH** (Brooks et al. 2019): land-cover classes suitable for the species within its elevation limits
  (Copernicus GLO-30 DEM); the classes and limits are set by the assessor.
* **Habitat decline** over max(10 years, 3 generations) fitted with observed, exponential and linear models;
  extrapolation is flagged. Population reduction is derived from habitat loss with an assessor-defined response
  (z exponent). Sub-criteria A1–A4 are available.
* **Generation length** calculator following Guidelines 4.4 (direct value, age at first reproduction and
  reproductive lifespan, or seed-bank methods for plants).
* **A3 from the bioclimate model**: relative change in summed suitability (section 4.5), combined with the
  projected habitat trend as successive proportional losses, 1 − (1 − a)(1 − b).

### 4.3 Threats and habitat quality

* **Fire**: annual burned area and frequency in the EOO and AOO (MapBiomas Fire, where available).
* **Deforestation and secondary vegetation**: annual loss and regrowth (MapBiomas, where available).
* **Fragmentation** of natural habitat in the AOO at 30 m: distance to edge, patch sizes, isolation of small
  patches, as evidence for *severely fragmented*.
* Threats are coded with the IUCN-CMP Threats Classification 3.3 (with the v4.0 names where they changed),
  including timing, scope, severity and stresses.

### 4.4 Climate

* **Regional climate change (context)**: TerraClimate annual series since 1958 (Tmax, Tmin, precipitation,
  climatic water deficit, PDSI, VPD, AET, hot and dry months), anomalies coloured by ENSO phase (NOAA ONI),
  climograph, last 24 months from ERA5-Land, CMIP6 projections (SSP2-4.5 and SSP5-8.5).
* **Signal-to-noise**: change divided by the standard deviation of detrended annual values (Hawkins & Sutton
  2012); climate flags require |S/N| ≥ 1. Drought uses PDSI ≤ −2 (Palmer 1965).
* **Climatic niche exposure** (Trisos, Merow & Pigot 2020): the realised niche limits are the most extreme annual
  values across the occupied cells in 1958–1990 (maximum Tmax and water deficit, minimum precipitation); a cell
  is exposed when it goes beyond the limit for at least 5 consecutive years. A warning is shown when the niche
  is truncated (fewer than 5 cells or a Tmax span below 1 °C). Exposure is coded as threat 11.3 (thermal) or
  11.2 (drought), with timing and scope.

### 4.5 Bioclimate model (Guidelines 12.1.12)

| Step | Method | Basis |
|---|---|---|
| Records | Duplicates removed; spatial thinning (default: AOO cell size, ≥ 1 km predictor resolution) | Aiello-Lammens et al. 2015 |
| Background | 10,000 random points in the ecoregions of the records within a 200 km buffer | Barbet-Massin et al. 2012; Phillips & Dudík 2008; VanDerWal et al. 2009; Barve et al. 2011 |
| Predictors | 19 WorldClim-type variables computed from monthly climatologies; no elevation or coordinates | Guidelines 12.1.12.2; Hijmans et al. 2005 |
| Variable screening | Univariate AUC, pairwise correlation at the background (\|r\| < 0.7, as *select07*), VIF; ≤ 1 variable per 5 records | Dormann et al. 2013; Guidelines 12.1.12.2 |
| Techniques | Maxent (cloglog, automatic features, regularization 1, clamping) and Random Forest down-sampled to balance presences and background (10 forests × 100 trees, averaged) | Phillips et al. 2006; Phillips & Dudík 2008; Breiman 2001; Valavi et al. 2021, 2022 |
| Evaluation | Spatial block k-fold cross-validation (5 folds, blocks balanced by presences; block size from the autocorrelation range of the predictors), or n−1 jackknife with < 25 presences | Roberts et al. 2017; Valavi et al. 2019; Pearson et al. 2007; Guidelines 12.1.12.3 |
| Metrics | AUC, TSS at the training threshold, maximum TSS, continuous Boyce index; for the jackknife, omission rate and p-value | Allouche et al. 2006; Hirzel et al. 2006; Leroy et al. 2018; Pearson et al. 2007 |
| Thresholds | Lowest presence threshold with < 25 records, otherwise maximum sensitivity + specificity | Pearson et al. 2007; Liu et al. 2013; Guidelines 12.1.12.4 |
| Climate projections | ≥ 2 GCMs × 2 SSPs from NASA NEX-GDDP-CMIP6, each projected separately (no ensemble-mean climate), delta method on WorldClim 1961–1990 | Guidelines 12.1.12.2; Thrasher et al. 2022 |
| Time points | Recent 1995–2014 and a future window centred on now + max(10 years, 3 generations) | Guidelines 12.1.12.2 |
| Exclusions | Current land use (AOH classes); dispersal limited to dispersal distance × (years / age at first reproduction); no and full dispersal reported as sensitivity | Guidelines 12.1.12.4 |
| Red List parameter | Relative change in summed suitability; median across technique × GCM × SSP as the best estimate, range as plausible values | Guidelines 4.5.2 and 12.1.12.4 |

The Word *Supplementary Information for Bioclimate Models* follows the IUCN template and lists all settings,
results and references.

### 4.6 Protected areas

As `summarise_protected()` in mappingAS: records in protected areas, percentage of the EOO protected, AOO cells
touching protected areas, natural and anthropic cover inside them, and the list of protected areas, grouped by
IUCN management category (Ia–III strict, IV–VI sustainable use, not reported). Sources: WDPA polygons, with the
mappingAS, Protected Planet or terrestrial-only filters.

### 4.7 IUCN Red List tab

* Criteria A–E with best estimates and plausible ranges; attitude to uncertainty (Guidelines 3.2); NT and DD
  rules (Guidelines 10.1); the category is the highest met by any criterion.
* **Record checks**: country centroids, coordinate precision, records at sea or in urban areas, duplicates,
  historical records.
* **Coded fields**: countries and sub-country units (FAO GAUL) with presence, origin and seasonality;
  biogeographic realms, biomes and ecoregions (RESOLVE 2017); elevation limits; habitats (Habitats
  Classification Scheme 3.1); threats and stresses; conservation actions and research needed; use and trade.
* **Narratives**: SIS drafts for range, population, habitat, threats, conservation, use and trade, and the
  rationale.
* **Checklist**: Documentation Standards, section 5.

---

## 5. Outputs

| Output | Where |
|---|---|
| HTML report (all tabs, criteria and figures in one file) | Summary tab |
| CSV tables of every tab (series, transitions, habitat, threats, climate, protected areas, records) | Each tab |
| Word supplementary information (IUCN format) | Red List tab |
| SIS coded tables (CSV) | Red List tab |
| Records with the IUCN point attributes (CSV) and EOO, AOO cells and records (GeoJSON) | Red List tab |
| Word Supplementary Information for Bioclimate Models | Bioclimate model tab |
| GeoTIFF rasters (land cover, AOH, habitat and threat layers) | Each tab (download links) |
| Shapefiles and GeoTIFFs as Drive export tasks | Code Editor only |
| Batch tables, charts, reports and rasters for all species | Batch tab |

---

## 6. Datasets

| Data | Earth Engine id / source | Reference |
|---|---|---|
| Land cover (South America) | MapBiomas national collections (Brazil, Bolivia, Colombia, Ecuador, Peru, Venezuela, Paraguay, Argentina, Chile, Uruguay) and MapBiomas Amazonia (RAISG), `projects/mapbiomas-public/...`, `projects/mapbiomas-raisg/...` | Souza et al. 2020; MapBiomas Project |
| Land cover (elsewhere) | Esri / Impact Observatory 10 m LULC, `projects/sat-io/open-datasets/landcover/ESRI_Global-LULC_10m_TS` | Karra et al. 2021 (CC BY 4.0) |
| Fire | MapBiomas Fire collections | MapBiomas Project |
| Deforestation and secondary vegetation | MapBiomas collections | MapBiomas Project |
| Protected areas | `WCMC/WDPA/current/polygons` | UNEP-WCMC & IUCN, Protected Planet |
| Country boundaries | `USDOS/LSIB_SIMPLE/2017` | US Department of State |
| Sub-national units | `FAO/GAUL/2015/level1`, `level2` | FAO GAUL 2015 |
| Elevation | `COPERNICUS/DEM/GLO30` | Copernicus GLO-30 DEM |
| Ecoregions, biomes, realms | `RESOLVE/ECOREGIONS/2017` | Dinerstein et al. 2017 |
| Climate (monthly, 1958–) | `IDAHO_EPSCOR/TERRACLIMATE` | Abatzoglou et al. 2018 |
| Climate (recent months) | `ECMWF/ERA5_LAND/MONTHLY_AGGR` | Muñoz-Sabater et al. 2021 |
| Climate projections | `NASA/GDDP-CMIP6` (ACCESS-CM2, MPI-ESM1-2-HR, MRI-ESM2-0, IPSL-CM6A-LR, EC-Earth3) | Thrasher et al. 2022 |
| Baseline climatology | `WORLDCLIM/V1/MONTHLY` | Hijmans et al. 2005 |
| ENSO | NOAA CPC Oceanic Niño Index v5 (table in the code) | NOAA Climate Prediction Center |

Each dataset keeps its own license and citation; cite the datasets used in your assessment (they are listed in
the Word documents and the report).

---

## 7. Repository structure and architecture

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
modules/iucn_calc.js   assessment settings, generation length, criteria A–E, plausible ranges
modules/iucn_coding.js IUCN data from Earth Engine and coded fields, narratives, checklist
modules/redlist.js     Red List tab
modules/sdm.js         bioclimate model (screening, Maxent, Random Forest, evaluation, projections)
modules/documents.js   Word supplementary information, SIS tables, IUCN attributes
modules/welcome.js     welcome screen
```

**How the modules talk to each other.** Every module exports two functions:

* `define(ns)` registers its functions in the shared namespace `MAS`;
* `run()` builds its part of the interface and its state.

`app.js` first calls `define` on every module and then `run`, in the order listed, so any module can call any
function of another one as `MAS.name(...)`, and shared state (for example `MAS.APP.current`, the species being
assessed) is read and written the same way. Functions used only inside a module are called directly. Each
module starts with a header listing its content, the modules it uses and the shared state it creates.

---

## 8. Development and contributing

**Adding a feature**

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

2. Add `require('users/paleomapas/mappingAS-dev:modules/<name>.js')` to the list in `app.js` (before `welcome.js`).

**Code conventions**: ES5 JavaScript (the Code Editor does not accept newer syntax); server-side work with `ee`
objects and asynchronous `evaluate`, never `getInfo`; interface changes deferred with `ui.util.setTimeout`;
each file under the 512 KB limit of the Code Editor.

**Development and publication**

* `users/paleomapas/mappingAS-dev` (private): changes are made and tested here.
* `users/paleomapas/mappingAS` (*Anyone can read*): the public copy used by the App.
* This GitHub repository: version history, issues and releases.

To publish a tested version, copy the files to the public Earth Engine repository and replace `mappingAS-dev`
by `mappingAS` in the `require` lines of `app.js` (the modules contain no paths). The public repository must stay
readable by everyone, otherwise other users and the App cannot load the modules.

**Reporting problems**: open an [issue](https://github.com/lucasbarreirageo/mappingAS-GEE/issues) with the
species (or a sample of the table), the settings, the tab and the message shown.

---

## 9. Limitations

* **Preliminary assessments**: inputs that satellite data cannot give (population size, generation length,
  dispersal, fluctuations, threats not visible from space) must come from the assessor.
* **Records**: results depend on the quality and coverage of the occurrence data; check the records before
  deciding (Red List tab, section 8).
* **Land cover**: MapBiomas classes and years differ between countries; outside South America the Esri product
  starts in 2017. Habitat loss is a proxy for population reduction only under the response chosen by the assessor.
* **Climate**: TerraClimate (~4 km) and GDDP (0.25°) may miss microclimates; niche limits from few cells are
  truncated and flagged.
* **Bioclimate model**: AUC and TSS computed with background points rank models but are not absolute accuracies;
  projections assume niche conservatism and equilibrium with climate; check response curves and maps against
  the biology of the species (Guidelines 12.1.12.3).
* **Computation**: very large ranges or many years can hit Earth Engine time or memory limits; the app retries
  and reports the steps that failed. Apps cannot create export tasks.

---

## 10. Versions

| Version | Changes |
|---|---|
| **2.0.0** | Split into modules (`app.js` + `modules/`), same results as the single-file version. Bioclimate model: TSS, continuous Boyce index, jackknife for < 25 records, down-sampled Random Forest, 10,000 background points, maximum sensitivity + specificity threshold, block size from spatial autocorrelation, limited dispersal with no/full dispersal as sensitivity, variable screening (univariate AUC, correlation, VIF). |
| 1.x | Single-file app: range parameters, land cover, habitat, threats, climate and climatic niche exposure, protected areas, Red List tab, IUCN documents, welcome screen, batch mode with tables, charts and rasters for all species. |

---

## 11. How to cite

Barreira, L. (2026). *mappingAS: preliminary IUCN Red List assessments in Google Earth Engine*. Version 2.0.0.
https://github.com/lucasbarreirageo/mappingAS-GEE

Please also cite the R package mappingAS (https://github.com/lucasbarreirageo/mappingAS), the IUCN documents
and the datasets used.

---

## 12. References

**IUCN**

* IUCN (2012). *IUCN Red List Categories and Criteria: Version 3.1*. Second edition. Gland and Cambridge: IUCN.
* IUCN Standards and Petitions Committee (2024). *Guidelines for Using the IUCN Red List Categories and Criteria*. Version 16.
* IUCN (2013). *Documentation standards and consistency checks for IUCN Red List assessments and species accounts*. Version 2.

**Range, habitat and assessments**

* Brooks, T.M. et al. (2019). Measuring terrestrial Area of Habitat (AOH) and its utility for the IUCN Red List. *Trends in Ecology & Evolution* 34: 977–986.
* Burgman, M.A. & Fox, J.C. (2003). Bias in species range estimates from minimum convex polygons: implications for conservation and options for improved planning. *Animal Conservation* 6: 19–28.
* Dauby, G. et al. (2017). ConR: An R package to assist large-scale multispecies preliminary conservation assessments using distribution data. *Ecology and Evolution* 7: 11292–11303.
* Rivers, M.C., Bachman, S.P., Meagher, T.R., Nic Lughadha, E. & Brummitt, N.A. (2010). Subpopulations, locations and fragmentation: applying IUCN red list criteria to herbarium specimen data. *Biodiversity and Conservation* 19: 2071–2085.

**Climate**

* Hawkins, E. & Sutton, R. (2012). Time of emergence of climate signals. *Geophysical Research Letters* 39: L01702.
* Palmer, W.C. (1965). *Meteorological drought*. Research Paper 45. US Weather Bureau, Washington, DC.
* Trisos, C.H., Merow, C. & Pigot, A.L. (2020). The projected timing of abrupt ecological disruption from climate change. *Nature* 580: 496–501.

**Bioclimate model**

* Aiello-Lammens, M.E. et al. (2015). spThin: an R package for spatial thinning of species occurrence records for use in ecological niche models. *Ecography* 38: 541–545.
* Allouche, O., Tsoar, A. & Kadmon, R. (2006). Assessing the accuracy of species distribution models: prevalence, kappa and the true skill statistic (TSS). *Journal of Applied Ecology* 43: 1223–1232.
* Barbet-Massin, M., Jiguet, F., Albert, C.H. & Thuiller, W. (2012). Selecting pseudo-absences for species distribution models: how, where and how many? *Methods in Ecology and Evolution* 3: 327–338.
* Barve, N. et al. (2011). The crucial role of the accessible area in ecological niche modeling and species distribution modeling. *Ecological Modelling* 222: 1810–1819.
* Breiman, L. (2001). Random forests. *Machine Learning* 45: 5–32.
* Dormann, C.F. et al. (2013). Collinearity: a review of methods to deal with it and a simulation study evaluating their performance. *Ecography* 36: 27–46.
* Hirzel, A.H., Le Lay, G., Helfer, V., Randin, C. & Guisan, A. (2006). Evaluating the ability of habitat suitability models to predict species presences. *Ecological Modelling* 199: 142–152.
* Leroy, B. et al. (2018). Without quality presence–absence data, discrimination metrics such as TSS can be misleading measures of model performance. *Journal of Biogeography* 45: 1994–2002.
* Liu, C., White, M. & Newell, G. (2013). Selecting thresholds for the prediction of species occurrence with presence-only data. *Journal of Biogeography* 40: 778–789.
* Pearson, R.G., Raxworthy, C.J., Nakamura, M. & Peterson, A.T. (2007). Predicting species distributions from small numbers of occurrence records: a test case using cryptic geckos in Madagascar. *Journal of Biogeography* 34: 102–117.
* Phillips, S.J., Anderson, R.P. & Schapire, R.E. (2006). Maximum entropy modeling of species geographic distributions. *Ecological Modelling* 190: 231–259.
* Phillips, S.J. & Dudík, M. (2008). Modeling of species distributions with Maxent: new extensions and a comprehensive evaluation. *Ecography* 31: 161–175.
* Roberts, D.R. et al. (2017). Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure. *Ecography* 40: 913–929.
* Valavi, R., Elith, J., Lahoz-Monfort, J.J. & Guillera-Arroita, G. (2019). blockCV: an R package for generating spatially or environmentally separated folds for k-fold cross-validation of species distribution models. *Methods in Ecology and Evolution* 10: 225–232.
* Valavi, R., Elith, J., Lahoz-Monfort, J.J. & Guillera-Arroita, G. (2021). Modelling species presence-only data with random forests. *Ecography* 44: 1731–1742.
* Valavi, R., Guillera-Arroita, G., Lahoz-Monfort, J.J. & Elith, J. (2022). Predictive performance of presence-only species distribution models: a benchmark study with reproducible code. *Ecological Monographs* 92: e01486.
* VanDerWal, J., Shoo, L.P., Graham, C. & Williams, S.E. (2009). Selecting pseudo-absence data for presence-only distribution modeling: how far should you stray from what you know? *Ecological Modelling* 220: 589–594.

**Datasets**

* Abatzoglou, J.T., Dobrowski, S.Z., Parks, S.A. & Hegewisch, K.C. (2018). TerraClimate, a high-resolution global dataset of monthly climate and climatic water balance from 1958–2015. *Scientific Data* 5: 170191.
* Dinerstein, E. et al. (2017). An ecoregion-based approach to protecting half the terrestrial realm. *BioScience* 67: 534–545.
* Hijmans, R.J., Cameron, S.E., Parra, J.L., Jones, P.G. & Jarvis, A. (2005). Very high resolution interpolated climate surfaces for global land areas. *International Journal of Climatology* 25: 1965–1978.
* Karra, K. et al. (2021). Global land use/land cover with Sentinel 2 and deep learning. *IGARSS 2021*: 4704–4707.
* Muñoz-Sabater, J. et al. (2021). ERA5-Land: a state-of-the-art global reanalysis dataset for land applications. *Earth System Science Data* 13: 4349–4383.
* Souza, C.M. Jr. et al. (2020). Reconstructing three decades of land use and land cover changes in Brazilian biomes with Landsat archive and Earth Engine. *Remote Sensing* 12: 2735.
* Thrasher, B. et al. (2022). NASA Global Daily Downscaled Projections, CMIP6. *Scientific Data* 9: 262.
* UNEP-WCMC & IUCN. *Protected Planet: The World Database on Protected Areas (WDPA)*. Cambridge, UK. www.protectedplanet.net

---

## 13. License and contact

See the [LICENSE](LICENSE) file. The datasets keep their own licenses.

Questions, problems and suggestions: [issues](https://github.com/lucasbarreirageo/mappingAS-GEE/issues).

---

### Resumo em português

O mappingAS GEE faz avaliações preliminares da Lista Vermelha da IUCN no Google Earth Engine a partir de uma
tabela de registros de ocorrência: EOO, AOO, localizações e subpopulações (Critério B), perda e fragmentação de
habitat com MapBiomas ou Esri (Critério A), fogo, desmatamento, clima e exposição do nicho climático, modelo
bioclimático para o Critério A3, áreas protegidas, critérios A–E com faixas plausíveis e os documentos de apoio da
IUCN (Word, tabelas do SIS, arquivos espaciais). Funciona no navegador, sem instalar nada, para espécies de um ou
vários países. Os resultados são preliminares e precisam ser revisados por especialistas na espécie.


```

The first push asks for credentials: generate them at https://earthengine.googlesource.com/new-password.
The same files can be pushed to GitHub.

## Citation

Barreira, L. (2026). mappingAS: preliminary IUCN Red List assessments in Google Earth Engine.
Version 2.0.0. https://github.com/lucasbarreirageo/mappingAS
