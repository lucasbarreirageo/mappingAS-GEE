/******************************************************************************
 * mappingAS for Google Earth Engine  |  Earth Engine App  |  version 2.0.0 (main script)
 * EOO / AOO, locations, land-use/land-cover (MapBiomas or Sentinel-2/Esri),
 * time series, protected areas (WDPA) and IUCN Criterion B assessment, for
 * species occurring in one or several countries.
 *
 * Re-implements in Earth Engine the logic of the R package mappingAS (v1.15.0)
 * and the tabs of its Shiny app:
 *   Map | Add points | Time series | Conversion | Habitat | Threats | Climate | Bioclimate model |
 *   Protected areas | Red List | Summary | Batch
 *   (data and range -> habitat evidence -> threats and climate -> protection -> decision -> summary)
 *   - AOO: 2 x 2 km grid in a data-centred LAEA; minimum over 100 shifted grids.
 *   - EOO: minimum convex polygon (great-circle edges).
 *   - Locations: 10 km grid (minimum over 100 grids); with protected areas,
 *     each protected area holding records counts as one location (or the
 *     records inside/outside are gridded separately).
 *   - Subpopulations: circular-buffer method (radius = 1/10 of max distance).
 *   - Criterion B: size thresholds + sub-criteria (a) locations/fragmentation,
 *     (b) continuing decline (inferred from a significant recent decline of
 *     natural habitat, or assumed), (c) extreme fluctuation; AOO bounds
 *     (lower = occupied cells, upper = AOH within the EOO).
 *   - Protected areas as in summarise_protected(): records in PAs, % of EOO in
 *     PAs, AOO cells touching PAs, natural/anthropic inside PAs, PA list;
 *     groups IUCN Ia-III (strict), IV-VI (sustainable use), not reported.
 * Habitat tab: fragmentation of natural habitat in the AOO at 30 m (edge distance, patch size,
 * isolation of small patches - evidence for 'severely fragmented') and pixel history in the
 * EOO/AOO (stable natural habitat, regrowth, accumulated loss, age of vegetation, changes).
 * Threats tab: MapBiomas Fire (annual burned area, frequency) and MapBiomas Deforestation and
 * Secondary Vegetation, per country where the products exist.
 * Climate tab: TerraClimate 1958- (Tmax, Tmin, precipitation, water deficit, PDSI, VPD, AET, hot and
 * dry months), climate-stress flags, anomalies coloured by ENSO phase (NOAA ONI), climograph,
 * last 24 months from ERA5-Land and NEX-GDDP-CMIP6 projections (SSP2-4.5, SSP5-8.5).
 * Area of habitat (AOH, Brooks et al. 2019): suitable land-cover classes within the species'
 * elevation limits (left panel 4d); used for Criterion A, continuing decline and the AOO upper bound.
 * Red List tab (IUCN documents: Categories & Criteria 3.1, Guidelines, Required/Recommended Supporting
 * Information, Documentation Standards, Habitats 3.1, Threats 3.3/4.0, Stresses, Conservation Actions,
 * Research Needed, Use & Trade, Colour Chart): generation length calculator (Guidelines 4.4),
 * Criterion A1-A4 with fitted models and extrapolation (4.5), population response to habitat loss,
 * criteria B (sub-criteria detail), C, D (D2), E, plausible ranges and attitude to uncertainty (3.2),
 * NT and DD rules (10.1), record checks (centroids, precision, sea, urban), current vs historical
 * records, AOO at several scales, alpha hull, AOO upper bound on a 2 x 2 km grid (4.10.8), countries
 * and sub-country units with presence/origin codes, realms/biomes/ecoregions, elevation limits,
 * habitat and threat coding (timing/scope/severity/stresses), conservation actions and research
 * needed, pre-submission checklist, SIS narrative drafts, Word supplementary information and
 * files with the IUCN spatial attributes.
 * Bioclimate model tab (Guidelines 12.1.12 and the IUCN template): Maxent + Random Forest, thinned
 * presences, random background in ecoregions + buffer, WorldClim-type variables, >= 2 GCMs x 2 SSPs
 * (NEX-GDDP-CMIP6, delta method), spatially blocked cross-validation, thresholds, land-use and
 * dispersal exclusions, change in summed suitability for A3, Word supplementary information.
 * Batch tab: assesses every species of the table in sequence - Quick (range and
 * Criterion B, seconds per species) or Full (adds land cover, measured habitat decline
 * and protected areas, minutes per species) - plus a Code Editor export task that
 * computes the land cover of all species on Google's servers.
 * Beyond mappingAS: every country is read from its own MapBiomas collection
 * (one mosaic per year), and the series is split by country and inside/outside
 * protected areas.
 *
 * INPUT (as mappingAS::read_occurrences)
 *   One row per record with species, longitude and latitude columns (country
 *   is optional). Recognised names: species/scientificName/taxon/binomial...,
 *   decimalLongitude/longitude/lon/x..., decimalLatitude/latitude/lat/y...,
 *   country/countryCode (ISO2/ISO3 accepted).
 *   Three ways to give the data:
 *   - Paste: copy the table from Excel / a CSV file (header in the first row) or a
 *     whole GeoJSON and paste it in the box; nothing is uploaded and no asset is
 *     needed. If the browser removes the line breaks, separate records with " | ".
 *   - Asset: upload the CSV in Assets > NEW > CSV file (.csv) and paste the asset
 *     id. For a published App, share the asset as "Anyone can read".
 *   - Built-in example: Prepusa connata and P. hookeriana (GBIF, TESTE2.geojson).
 *
 * USE
 *   Code Editor: open this script (app.js) and press Run (the panels appear).
 *   App: Apps > NEW APP, choose this script and publish.
 *   Apps cannot create export tasks: results are delivered as download links.
 *   In the Code Editor, "Create export tasks" also writes shapefiles and GeoTIFFs.
 *
 * STRUCTURE (version 2.0.0): this main script only loads the modules of the repository and starts
 * the app. Each module is a file in the folder modules/ with two functions:
 *   define(ns)  registers the functions of the module in the shared namespace MAS;
 *   run()       creates the interface, tables and state of the module.
 * All modules are defined first and then run in a fixed order, so a module can call any function of
 * another one as MAS.name(...). To add a feature: create modules/<name>.js with define/run, add one
 * require line below (before "welcome"), and reach the existing functions as MAS.name.
 * The repository must be readable by everyone ("Anyone can read") for other users and for the App.
 * Development copy: users/paleomapas/mappingAS-dev (private); public copy: users/paleomapas/mappingAS.
 * To publish a tested version, copy the files and replace "mappingAS-dev" by "mappingAS" in the
 * require lines of this script (the modules themselves have no paths).
 *
 * MODULES
 *   config       defaults, built-in example, legends, land-cover products and IUCN reference tables
 *   rangecalc    range calculations
 *   utils        client utilities
 *   layout       user interface layout
 *   records      occurrence data and added points
 *   run          statistics and the main run
 *   charts       charts, tables and MapBiomas-style cards
 *   tabs         result tabs
 *   downloads    downloads, map exports and export tasks
 *   batch        start-up and batch mode
 *   habitat      habitat quality, Criterion A and threats
 *   climate      climate and climatic niche exposure
 *   rasters      raster and extra vector downloads
 *   report       full report and batch spatial layers
 *   iucn_calc    IUCN calculations
 *   iucn_coding  IUCN data from Earth Engine and coded fields
 *   redlist      Red List tab
 *   sdm          bioclimate model
 *   documents    IUCN documents and files
 *   welcome      welcome screen
 *
 * VERSIONS
 *   2.0.0  split into modules (no change in the results); bioclimate model with TSS, Boyce index,
 *          jackknife for < 25 records, down-sampled Random Forest, 10,000 background points,
 *          max-SSS thresholds, block size from spatial autocorrelation and dispersal scenarios.
 *
 * Data: MapBiomas (national collections and MapBiomas Amazonia/RAISG),
 * Esri / Impact Observatory 10 m LULC (Karra et al. 2021, CC BY 4.0),
 * UNEP-WCMC & IUCN - WDPA (WCMC/WDPA/current/polygons), USDOS/LSIB_SIMPLE/2017.
 ******************************************************************************/


// Modules in the order they run (the order of the original single-file app). Paths must be literal strings.
var MODULES = [
  require('users/paleomapas/mappingAS-dev:modules/config.js'),
  require('users/paleomapas/mappingAS-dev:modules/rangecalc.js'),
  require('users/paleomapas/mappingAS-dev:modules/utils.js'),
  require('users/paleomapas/mappingAS-dev:modules/layout.js'),
  require('users/paleomapas/mappingAS-dev:modules/records.js'),
  require('users/paleomapas/mappingAS-dev:modules/run.js'),
  require('users/paleomapas/mappingAS-dev:modules/charts.js'),
  require('users/paleomapas/mappingAS-dev:modules/tabs.js'),
  require('users/paleomapas/mappingAS-dev:modules/downloads.js'),
  require('users/paleomapas/mappingAS-dev:modules/batch.js'),
  require('users/paleomapas/mappingAS-dev:modules/habitat.js'),
  require('users/paleomapas/mappingAS-dev:modules/climate.js'),
  require('users/paleomapas/mappingAS-dev:modules/rasters.js'),
  require('users/paleomapas/mappingAS-dev:modules/report.js'),
  require('users/paleomapas/mappingAS-dev:modules/iucn_calc.js'),
  require('users/paleomapas/mappingAS-dev:modules/iucn_coding.js'),
  require('users/paleomapas/mappingAS-dev:modules/redlist.js'),
  require('users/paleomapas/mappingAS-dev:modules/sdm.js'),
  require('users/paleomapas/mappingAS-dev:modules/documents.js'),
  require('users/paleomapas/mappingAS-dev:modules/welcome.js')
];

// Shared namespace: every module registers its functions here (define), then builds its part of the app (run).
var MAS = {};
MODULES.forEach(function (m) { m.define(MAS); });
MODULES.forEach(function (m) { m.run(); });

// Welcome screen unless the link has ?intro=0
var SKIP_INTRO = false;
try { SKIP_INTRO = ui.url.get('intro', '1') === '0'; } catch (e) { SKIP_INTRO = false; }
if (!SKIP_INTRO) MAS.showWelcome();
