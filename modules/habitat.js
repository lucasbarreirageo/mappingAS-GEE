/**** mappingAS GEE 2.0.0 - module "habitat": habitat quality, Criterion A and threats
 * Section 17: habitat decline for Criterion A, fragmentation, pixel history, fire and deforestation.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: batch, run, layout, utils, tabs, charts, config, redlist, iucn_coding, climate
 * Shared state created here: FIRE_SOURCES, FIRE_PREFIX, DEF_SOURCES, DEF_PREFIX, DEF_CLASSES, THEMATIC_CACHE, EDGE_BINS, PATCH_BINS, PATCH_THRESH, STATUS, AGE_BINS, CHANGE_BINS, THREAT_COLS, ONI, ONI_SOURCE
 ****/

// ============================================================================
// 17. HABITAT QUALITY, CRITERION A AND THREATS
//   Habitat : fragmentation of natural habitat inside the AOO (edge distance, patch size,
//             isolation; 30 m) and pixel history in the EOO/AOO (stable natural habitat,
//             regrowth, conversion, age of natural vegetation, number of changes),
//             following mapbiomas/platform-analysis and mapbiomas/brazil-degradation.
//   Criterion A: A2c - reduction of natural habitat over max(10 years, 3 generations).
//   Threats : MapBiomas Fire (annual burned area, frequency) and MapBiomas Deforestation
//             and Secondary Vegetation, for the countries where they exist.
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.areaByCode = areaByCode;
  MAS.parseSimple = parseSimple;
  MAS.sumWhere = sumWhere;
  MAS.runJobs = runJobs;
  MAS.setWindowA = setWindowA;
  MAS.fragImage = fragImage;
  MAS.historyImage = historyImage;
  MAS.runHabitat = runHabitat;
  MAS.fragSummary = fragSummary;
  MAS.histSummary = histSummary;
  MAS.renderHabitatTab = renderHabitatTab;
  MAS.resolveThematic = resolveThematic;
  MAS.thematicFor = thematicFor;
  MAS.fireImage = fireImage;
  MAS.defImage = defImage;
  MAS.coveragePct = coveragePct;
  MAS.countryMask = countryMask;
  MAS.runThreats = runThreats;
  MAS.fireStats = fireStats;
  MAS.defStats = defStats;
  MAS.renderThreatsTab = renderThreatsTab;
  MAS.threatLines = threatLines;
  MAS.runExtras = runExtras;
  MAS.fragEvidence = fragEvidence;
  MAS.threatsExportFC = threatsExportFC;
};

exports.run = function () {
  var MBP = 'projects/mapbiomas-public/assets/';
  MAS.FIRE_SOURCES = {
    brazil: {label: 'MapBiomas Fire Brazil', countries: ['Brazil'], ids: [
      MBP + 'brazil/fire/collection5_1/mapbiomas_fire_collection51_annual_burned_v1',
      MBP + 'brazil/fire/collection5/mapbiomas_fire_collection5_annual_burned_v1',
      MBP + 'brazil/fire/collection4_1/mapbiomas_fire_collection41_annual_burned_v1']},
    bolivia: {label: 'MapBiomas Fire Bolivia', countries: ['Bolivia'], ids: [MBP + 'bolivia/fire/collection1/mapbiomas_bolivia_fire_collection1_annual_burned_v1']},
    colombia: {label: 'MapBiomas Fire Colombia', countries: ['Colombia'], ids: [MBP + 'colombia/fire/collection1/mapbiomas_colombia_fire_collection1_annual_burned_v1']},
    peru: {label: 'MapBiomas Fire Peru', countries: ['Peru'], ids: [MBP + 'peru/fire/collection2/mapbiomas_peru_fire_collection2_annual_burned_v1',
      'projects/mapbiomas-peru/assets/FIRE/COLLECTION1/FINAL_PRODUCTS/mapbiomas_peru_fire_collection1_annual_burned_v1']},
    paraguay: {label: 'MapBiomas Fire Paraguay', countries: ['Paraguay'], ids: [MBP + 'paraguay/fire/collection1/mapbiomas_paraguay_fire_collection1_annual_burned_v1']},
    argentina: {label: 'MapBiomas Fire Argentina', countries: ['Argentina'], ids: [MBP + 'argentina/fire/collection1/mapbiomas_argentina_fire_collection1_annual_burned_v1']},
    chile: {label: 'MapBiomas Fire Chile', countries: ['Chile'], ids: [MBP + 'chile/fire/collection1/mapbiomas_chile_fire_collection1_annual_burned_v1']}
  };
  MAS.FIRE_PREFIX = 'burned_area_';
  MAS.DEF_SOURCES = {
    brazil: {label: 'MapBiomas Deforestation Brazil', countries: ['Brazil'], ids: [
      MBP + 'brazil/lulc/collection11/mapbiomas_brazil_collection11_deforestation_secondary_vegetation_v5',
      MBP + 'brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_deforestation_secondary_vegetation_v3']},
    peru: {label: 'MapBiomas Deforestation Peru', countries: ['Peru'], ids: [
      MBP + 'peru/collection4/mapbiomas_peru_collection4_deforestation_secondary_vegetation_v2',
      MBP + 'peru/collection3/mapbiomas_peru_collection3_deforestation_secondary_vegetation_v4']},
    bolivia: {label: 'MapBiomas Deforestation Bolivia', countries: ['Bolivia'], ids: [MBP + 'bolivia/lulc/collection3/mapbiomas_bolivia_collection3_deforestation_secondary_vegetation_v1']},
    colombia: {label: 'MapBiomas Deforestation Colombia', countries: ['Colombia'], ids: [MBP + 'colombia/collection2/mapbiomas_colombia_collection2_deforestation_secondary_vegetation_v1']},
    paraguay: {label: 'MapBiomas Deforestation Paraguay', countries: ['Paraguay'], ids: [MBP + 'paraguay/lulc/collection3/mapbiomas_paraguay_collection3_deforestation_secondary_vegetation_v1']},
    uruguay: {label: 'MapBiomas Deforestation Uruguay', countries: ['Uruguay'], ids: [MBP + 'uruguay/lulc/collection3/mapbiomas_uruguay_collection3_deforestation_secondary_vegetation_v1']},
    argentina: {label: 'MapBiomas Deforestation Argentina', countries: ['Argentina'], ids: [MBP + 'argentina/lulc/collection2/mapbiomas_argentina_collection2_deforestation_secondary_vegetation_v1']}
  };
  MAS.DEF_PREFIX = 'classification_';
  MAS.DEF_CLASSES = {1: ['Anthropic', '#fffbc2'], 2: ['Primary vegetation', '#09611f'], 3: ['Secondary vegetation', '#4ea376'],
    4: ['Deforestation of primary vegetation', '#e31a1c'], 5: ['Secondary vegetation regrowth', '#94fc03'],
    6: ['Deforestation of secondary vegetation', '#ffa500']};
  MAS.THEMATIC_CACHE = {};
  // critA and overallCategory: see section 23 (IUCN calculations)

  // ============================================================================
  // 17b. HABITAT: fragmentation (AOO, 30 m) and pixel history (EOO and AOO)
  // ============================================================================
  MAS.EDGE_BINS = [[1, '≤ 30 m'], [2, '30-90 m'], [3, '90-300 m'], [4, '300-1000 m'], [0, '> 1000 m (interior)']];
  MAS.PATCH_BINS = [[1, '< 3 ha'], [2, '3-5 ha'], [3, '5-10 ha'], [4, '10-25 ha'], [5, '25-50 ha'], [6, '50-75 ha'], [7, '75-92 ha'], [0, '≥ 92 ha (large)']];
  MAS.PATCH_THRESH = [3, 5, 10, 25, 50, 75];
  MAS.STATUS = {1: ['Stable natural (natural every year)', '#1f8d49'], 2: ['Regrown natural (anthropic at some time, natural now)', '#94fc03'],
    3: ['Other natural (natural now, not every year)', '#7dc975'], 4: ['Converted during the period', '#e31a1c'],
    5: ['Anthropic since the start', '#ffefc3'], 0: ['Water, other or no data', '#9e9e9e']};
  MAS.AGE_BINS = [[0, '< 5 years'], [1, '5-10 years'], [2, '10-20 years'], [3, '20-30 years'], [4, '≥ 30 years'], [5, 'whole period']];
  MAS.CHANGE_BINS = [[0, 'no change'], [1, '1 change'], [2, '2 changes'], [3, '3 or more']];
  // Code Editor export task: fire and deforestation per year in the EOO at the export scale (finer than in-app)
  MAS.THREAT_COLS = ['product', 'extent', 'year', 'code', 'class', 'area_km2', 'area_ha', 'scale_m'];
  // NOAA CPC Oceanic Nino Index (ONI v5, ERSSTv5, 3-month running mean anomaly in Nino 3.4, degC).
  // Source: https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt (DJF ... NDJ, value i = season centred on month i+1), 1958 - JAS 2026.
  MAS.ONI = {
    '1958': [1.69, 1.59, 1.17, 0.84, 0.57, 0.49, 0.43, 0.32, 0.28, 0.3, 0.36, 0.56],
    '1959': [0.6, 0.64, 0.48, 0.39, 0.24, 0.02, -0.19, -0.23, -0.04, 0.11, 0.23, 0.14],
    '1960': [0.02, 0.03, 0.06, 0.17, 0.04, 0, 0.01, 0.15, 0.19, 0.08, -0.07, -0.07],
    '1961': [0, 0.03, 0.01, 0.05, 0.22, 0.22, 0.08, -0.2, -0.32, -0.22, -0.11, -0.05],
    '1962': [-0.16, -0.17, -0.15, -0.2, -0.19, -0.13, 0, -0.1, -0.16, -0.25, -0.25, -0.32],
    '1963': [-0.33, -0.17, 0.01, 0.13, 0.12, 0.45, 0.76, 1.09, 1.09, 1.13, 1.19, 1.13],
    '1964': [0.95, 0.52, 0.06, -0.35, -0.6, -0.66, -0.67, -0.7, -0.72, -0.8, -0.79, -0.75],
    '1965': [-0.51, -0.25, -0.04, 0.16, 0.47, 0.79, 1.1, 1.27, 1.55, 1.7, 1.82, 1.6],
    '1966': [1.24, 0.95, 0.76, 0.43, 0.24, 0.18, 0.25, 0.13, -0.09, -0.12, -0.23, -0.35],
    '1967': [-0.46, -0.48, -0.5, -0.37, -0.15, 0.05, -0.02, -0.26, -0.4, -0.4, -0.36, -0.42],
    '1968': [-0.62, -0.73, -0.63, -0.48, -0.1, 0.17, 0.44, 0.38, 0.34, 0.5, 0.66, 0.93],
    '1969': [0.98, 0.98, 0.77, 0.69, 0.62, 0.48, 0.37, 0.41, 0.61, 0.71, 0.81, 0.71],
    '1970': [0.46, 0.23, 0.23, 0.28, 0.11, -0.26, -0.55, -0.72, -0.69, -0.72, -0.78, -1.1],
    '1971': [-1.29, -1.36, -1.08, -0.81, -0.72, -0.69, -0.68, -0.6, -0.68, -0.78, -0.86, -0.78],
    '1972': [-0.57, -0.27, 0.04, 0.25, 0.48, 0.7, 1.0, 1.26, 1.49, 1.69, 1.84, 1.77],
    '1973': [1.55, 1.13, 0.56, -0.03, -0.51, -0.8, -0.99, -1.11, -1.26, -1.58, -1.89, -2.04],
    '1974': [-1.87, -1.59, -1.24, -0.99, -0.71, -0.64, -0.46, -0.4, -0.47, -0.69, -0.88, -0.71],
    '1975': [-0.56, -0.55, -0.61, -0.66, -0.8, -0.92, -1.08, -1.12, -1.29, -1.32, -1.47, -1.58],
    '1976': [-1.49, -1.11, -0.65, -0.45, -0.23, 0, 0.23, 0.4, 0.6, 0.79, 0.81, 0.84],
    '1977': [0.71, 0.66, 0.33, 0.26, 0.26, 0.46, 0.39, 0.35, 0.45, 0.68, 0.84, 0.82],
    '1978': [0.71, 0.52, 0.17, -0.06, -0.28, -0.24, -0.37, -0.37, -0.44, -0.27, -0.07, 0.11],
    '1979': [0.19, 0.21, 0.29, 0.32, 0.29, 0.14, 0.09, 0.22, 0.34, 0.47, 0.5, 0.64],
    '1980': [0.62, 0.47, 0.35, 0.34, 0.45, 0.4, 0.18, -0.06, -0.17, -0.07, 0.08, -0.05],
    '1981': [-0.27, -0.42, -0.41, -0.27, -0.28, -0.27, -0.28, -0.23, -0.08, -0.16, -0.19, -0.14],
    '1982': [-0.05, 0.02, 0.07, 0.34, 0.65, 0.73, 0.78, 0.99, 1.45, 1.82, 2.03, 2.12],
    '1983': [2.14, 1.91, 1.52, 1.23, 0.95, 0.62, 0.25, -0.06, -0.43, -0.76, -0.96, -0.89],
    '1984': [-0.63, -0.51, -0.38, -0.47, -0.55, -0.52, -0.39, -0.22, -0.32, -0.62, -0.95, -1.06],
    '1985': [-1.01, -0.86, -0.85, -0.8, -0.79, -0.6, -0.44, -0.33, -0.31, -0.3, -0.28, -0.36],
    '1986': [-0.4, -0.38, -0.25, -0.17, -0.09, 0.02, 0.24, 0.46, 0.64, 0.86, 1.06, 1.21],
    '1987': [1.18, 1.13, 1.02, 0.94, 0.95, 1.11, 1.3, 1.46, 1.49, 1.41, 1.2, 1.0],
    '1988': [0.63, 0.37, -0.03, -0.45, -0.99, -1.3, -1.3, -1.14, -1.27, -1.54, -1.81, -1.85],
    '1989': [-1.64, -1.38, -1.09, -0.85, -0.61, -0.4, -0.37, -0.36, -0.33, -0.25, -0.12, -0.04],
    '1990': [0.18, 0.19, 0.3, 0.27, 0.25, 0.25, 0.26, 0.32, 0.31, 0.27, 0.31, 0.34],
    '1991': [0.35, 0.26, 0.23, 0.29, 0.49, 0.63, 0.77, 0.67, 0.72, 0.83, 1.18, 1.43],
    '1992': [1.54, 1.5, 1.4, 1.3, 1.08, 0.72, 0.35, 0.08, -0.15, -0.22, -0.24, -0.05],
    '1993': [0.13, 0.31, 0.5, 0.73, 0.76, 0.56, 0.28, 0.22, 0.2, 0.2, 0.2, 0.19],
    '1994': [0.07, 0, 0.04, 0.17, 0.25, 0.23, 0.3, 0.3, 0.47, 0.66, 0.93, 0.97],
    '1995': [0.88, 0.65, 0.46, 0.19, 0.03, -0.11, -0.3, -0.55, -0.81, -0.97, -1.05, -1.01],
    '1996': [-0.88, -0.7, -0.52, -0.36, -0.25, -0.24, -0.22, -0.27, -0.3, -0.33, -0.39, -0.41],
    '1997': [-0.41, -0.26, -0.03, 0.3, 0.71, 1.13, 1.48, 1.79, 2.04, 2.24, 2.34, 2.37],
    '1998': [2.22, 1.91, 1.4, 1.03, 0.4, -0.08, -0.63, -0.83, -1.02, -1.12, -1.31, -1.47],
    '1999': [-1.51, -1.25, -0.93, -0.8, -0.79, -0.84, -0.9, -0.94, -1.0, -1.13, -1.35, -1.53],
    '2000': [-1.47, -1.26, -0.98, -0.81, -0.67, -0.62, -0.48, -0.4, -0.42, -0.54, -0.76, -0.78],
    '2001': [-0.76, -0.54, -0.43, -0.29, -0.19, -0.08, -0.05, -0.13, -0.15, -0.26, -0.33, -0.32],
    '2002': [-0.15, 0.07, 0.11, 0.15, 0.3, 0.45, 0.57, 0.63, 0.78, 0.99, 1.19, 1.08],
    '2003': [0.9, 0.59, 0.38, -0.01, -0.18, -0.13, 0.09, 0.14, 0.23, 0.23, 0.29, 0.29],
    '2004': [0.34, 0.27, 0.19, 0.1, 0.12, 0.22, 0.39, 0.54, 0.58, 0.61, 0.64, 0.71],
    '2005': [0.62, 0.55, 0.4, 0.37, 0.27, 0.09, -0.04, -0.14, -0.11, -0.27, -0.57, -0.82],
    '2006': [-0.86, -0.8, -0.63, -0.45, -0.19, -0.05, 0.12, 0.33, 0.54, 0.71, 0.88, 0.88],
    '2007': [0.62, 0.19, -0.12, -0.32, -0.34, -0.41, -0.49, -0.77, -1.05, -1.38, -1.57, -1.72],
    '2008': [-1.76, -1.61, -1.37, -1.05, -0.85, -0.56, -0.33, -0.2, -0.25, -0.36, -0.57, -0.79],
    '2009': [-0.89, -0.84, -0.63, -0.35, 0.03, 0.34, 0.5, 0.56, 0.66, 0.92, 1.31, 1.5],
    '2010': [1.47, 1.21, 0.88, 0.38, -0.16, -0.66, -0.98, -1.24, -1.43, -1.54, -1.57, -1.48],
    '2011': [-1.29, -1.06, -0.85, -0.68, -0.5, -0.34, -0.37, -0.5, -0.76, -0.94, -1.02, -0.92],
    '2012': [-0.71, -0.56, -0.44, -0.35, -0.18, 0.03, 0.28, 0.39, 0.37, 0.28, 0.13, -0.03],
    '2013': [-0.24, -0.28, -0.23, -0.2, -0.3, -0.38, -0.45, -0.34, -0.32, -0.14, -0.12, -0.11],
    '2014': [-0.24, -0.21, -0.02, 0.25, 0.35, 0.22, 0.07, 0.07, 0.24, 0.51, 0.7, 0.8],
    '2015': [0.73, 0.65, 0.72, 0.86, 1.04, 1.19, 1.44, 1.73, 2.02, 2.28, 2.45, 2.59],
    '2016': [2.5, 2.21, 1.69, 1.11, 0.57, 0.09, -0.19, -0.34, -0.42, -0.51, -0.49, -0.37],
    '2017': [-0.08, 0.08, 0.27, 0.32, 0.35, 0.32, 0.14, -0.07, -0.23, -0.44, -0.61, -0.76],
    '2018': [-0.71, -0.67, -0.55, -0.35, -0.07, 0.13, 0.2, 0.3, 0.52, 0.82, 1.04, 1.05],
    '2019': [0.99, 0.94, 0.87, 0.82, 0.71, 0.59, 0.38, 0.2, 0.31, 0.51, 0.72, 0.75],
    '2020': [0.71, 0.66, 0.57, 0.33, 0.04, -0.18, -0.29, -0.43, -0.77, -1.0, -1.11, -1.06],
    '2021': [-0.99, -0.85, -0.74, -0.56, -0.4, -0.31, -0.35, -0.46, -0.64, -0.77, -0.91, -0.83],
    '2022': [-0.76, -0.68, -0.77, -0.86, -0.83, -0.73, -0.7, -0.78, -0.87, -0.89, -0.82, -0.7],
    '2023': [-0.55, -0.33, -0.11, 0.19, 0.46, 0.73, 1.0, 1.25, 1.5, 1.74, 1.9, 1.99],
    '2024': [1.84, 1.53, 1.18, 0.77, 0.43, 0.18, 0.06, -0.04, -0.12, -0.19, -0.29, -0.43],
    '2025': [-0.46, -0.22, -0.08, 0.02, -0.04, -0.02, -0.11, -0.26, -0.43, -0.57, -0.61, -0.6],
    '2026': [-0.39, -0.21, 0.11, 0.46, 0.95, 1.39, 1.8, 2.16]
  };
  MAS.ONI_SOURCE = 'NOAA CPC ONI v5 (through JAS 2026)';
};

// ---- generic helpers
function areaByCode(img, geom, scale, tileScale, crs) {
  var o = {reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'code'}), geometry: geom, scale: scale,
    maxPixels: 1e13, tileScale: tileScale || 4};
  if (crs) o.crs = crs;
  return ee.Image.pixelArea().divide(1e6).rename('area').addBands(img.rename('code')).reduceRegion(o);
}
function parseSimple(d) {
  var o = {};
  ((d && d.groups) || []).forEach(function (g) { var c = Math.round(g.code); o[c] = (o[c] || 0) + g.sum; });
  return o;
}
function sumWhere(o, test) { var s = 0; for (var k in o) if (o.hasOwnProperty(k) && test(Number(k))) s += o[k]; return s; }
// Sequential requests with one retry (larger tileScale). jobs: [{key, make: function (tileScale) -> ee object}]
function runJobs(R, jobs, onEach, done) {
  var failed = [];
  (function next(i, retry) {
    if (MAS.stale(R)) return;
    if (i >= jobs.length) { done(failed); return; }
    jobs[i].make(retry ? 16 : 8).evaluate(function (res, err) {
      if (MAS.stale(R)) return;
      if (err || res === null || res === undefined) {
        if (!retry) { next(i, true); return; }
        failed.push(jobs[i].key + ': ' + err); onEach(jobs[i], null, i);
      } else onEach(jobs[i], res, i);
      next(i + 1, false);
    });
  })(0, false);
}
// ============================================================================
// 17a. CRITERION A (A2c) from habitat decline
// ============================================================================
function setWindowA(R) {
  var gl = R.cfg.genLen;
  R.windowA = isFinite(gl) && gl > 0 ? Math.max(10, Math.round(3 * gl)) : 10;
  var target = R.y1 - R.windowA;
  var cands = R.years.filter(function (y) { return y >= target; });
  R.yA = cands.length ? cands[0] : R.y0;
  R.windowShort = target < R.y0;
}
function fragImage(R, y) {
  var proj = ee.Projection('EPSG:4326').atScale(30);
  var g = MAS.groupImage(MAS.lulcImage(R, y)).unmask(0);
  var nat = g.eq(1).reproject(proj), ant = g.eq(2).reproject(proj);
  var dEdge = ant.fastDistanceTransform(36, 'pixels', 'squared_euclidean').sqrt().multiply(30).unmask(1e6).reproject(proj);
  var edgeBin = ee.Image(0).where(dEdge.lte(1000), 4).where(dEdge.lte(300), 3).where(dEdge.lte(90), 2).where(dEdge.lte(30), 1);
  var cnt = nat.selfMask().connectedPixelCount(1024, true).reproject(proj);
  var ha = cnt.multiply(ee.Image.pixelArea().divide(1e4));
  var large = cnt.gte(1024);
  var patchBin = ee.Image(7).where(ha.lt(75), 6).where(ha.lt(50), 5).where(ha.lt(25), 4).where(ha.lt(10), 3)
    .where(ha.lt(5), 2).where(ha.lt(3), 1).where(large, 0);
  var dPx = Math.ceil(R.cfg.isoM / 30) + 2;
  var dLarge = large.unmask(0).fastDistanceTransform(dPx, 'pixels', 'squared_euclidean').sqrt().multiply(30).unmask(1e6).reproject(proj);
  var isolated = ha.lt(R.cfg.patchHa).and(large.not()).and(dLarge.gt(R.cfg.isoM));
  return edgeBin.multiply(100).add(patchBin.multiply(10)).add(isolated.unmask(0)).updateMask(nat).toInt();
}
function historyImage(R, years) {
  var age = ee.Image(0), seen = ee.Image(0), everA = ee.Image(0), stable = ee.Image(1), changes = ee.Image(0);
  var prev = null, prevY = null, lastN = null, lastA = null;
  years.forEach(function (y) {
    var l = MAS.lulcImage(R, y).unmask(0);
    var g = MAS.groupImage(MAS.lulcImage(R, y)).unmask(0);
    var n = g.eq(1), a = g.eq(2);
    age = n.multiply(age.add(prevY === null ? 1 : y - prevY));
    everA = everA.or(a);
    seen = seen.or(n);
    stable = stable.and(n);
    if (prev !== null) changes = changes.add(l.neq(prev).and(l.gt(0)).and(prev.gt(0)));
    prev = l; prevY = y; lastN = n; lastA = a;
  });
  var span = years[years.length - 1] - years[0] + 1;
  var status = ee.Image(0).where(lastN.and(stable.not()), 3).where(lastN.and(everA), 2)
    .where(lastN.and(stable), 1).where(lastA.and(seen), 4).where(lastA.and(seen.not()), 5);
  var ageBin = ee.Image(0).where(age.gte(5), 1).where(age.gte(10), 2).where(age.gte(20), 3).where(age.gte(30), 4).where(age.gte(span), 5);
  var chBin = changes.min(3);
  return status.multiply(100).add(ageBin.multiply(10)).add(chBin).toInt();
}
function runHabitat(R, done) {
  if (!R.cfg.doHabitat) { MAS.progSet('habitat', 'skip', 'off'); done(); return; }
  R.H = {frag: {}, hist: {}, histYears: {}};
  var fy = MAS.uniq([R.y0, R.year]);
  var jobs = fy.map(function (y) {
    return {key: 'frag ' + y, kind: 'frag', year: y, make: function (ts) { return areaByCode(fragImage(R, y), R.cellsGeom, 30, ts, 'EPSG:4326'); }};
  });
  jobs.push({key: 'history AOO', kind: 'hist', scope: 'AOO', make: function (ts) { return areaByCode(historyImage(R, R.years), R.cellsGeom, R.scaleAoo, ts); }});
  if (R.eooGeom) jobs.push({key: 'history EOO', kind: 'hist', scope: 'EOO', make: function (ts) { return areaByCode(historyImage(R, R.years), R.eooGeom, R.scaleC, ts); }});
  MAS.progSet('habitat', 'run', '0/' + jobs.length, 0);
  runJobs(R, jobs, function (job, res, i) {
    if (res) {
      if (job.kind === 'frag') R.H.frag[job.year] = parseSimple(res);
      else { R.H.hist[job.scope] = parseSimple(res); R.H.histYears[job.scope] = R.years; }
    }
    MAS.progSet('habitat', 'run', (i + 1) + '/' + jobs.length, (i + 1) / jobs.length);
  }, function (failed) {
    // history of the EOO failed: retry once with the series years only (lighter)
    if (R.eooGeom && !R.H.hist.EOO && R.tsYears.length < R.years.length) {
      var yrs = R.tsYears.filter(function (y) { return y >= R.y0 && y <= R.y1; });
      runJobs(R, [{key: 'history EOO (series years)', make: function (ts) { return areaByCode(historyImage(R, yrs), R.eooGeom, R.scaleC, ts); }}],
        function (job, res) { if (res) { R.H.hist.EOO = parseSimple(res); R.H.histYears.EOO = yrs; } }, function (f2) { finishHab(failed.concat(f2)); });
    } else finishHab(failed);
  });
  function finishHab(failed) {
    R.H.done = true;
    MAS.progSet('habitat', failed.length ? 'fail' : 'ok', failed.length ? 'missing: ' + failed.map(function (f) { return f.split(':')[0]; }).join(', ') :
      'fragmentation ' + fy.join(' and ') + '; habitat history');
    MAS.renderOne(R, 'Habitat', renderHabitatTab);
    MAS.renderOne(R, 'Summary', MAS.renderAssessmentTab);
    done();
  }
}
function fragSummary(R, y) {
  var f = R.H && R.H.frag[y];
  if (!f) return null;
  var tot = sumWhere(f, function () { return true; });
  if (tot <= 0) return {total: 0};
  var edge = {}, patch = {};
  MAS.EDGE_BINS.forEach(function (b) { edge[b[0]] = sumWhere(f, function (c) { return Math.floor(c / 100) === b[0]; }); });
  MAS.PATCH_BINS.forEach(function (b) { patch[b[0]] = sumWhere(f, function (c) { return Math.floor(c / 10) % 10 === b[0]; }); });
  var k = MAS.PATCH_THRESH.indexOf(R.cfg.patchHa) + 1;
  var small = sumWhere(f, function (c) { var p = Math.floor(c / 10) % 10; return p >= 1 && p <= k; });
  var iso = sumWhere(f, function (c) { return c % 10 === 1; });
  return {total: tot, edge: edge, patch: patch, smallPct: 100 * small / tot, isoPct: 100 * iso / tot,
    edge90Pct: 100 * (edge[1] + edge[2]) / tot, edge300Pct: 100 * (edge[1] + edge[2] + edge[3]) / tot};
}
function histSummary(R, scope) {
  var h = R.H && R.H.hist[scope];
  if (!h) return null;
  var st = {}, age = {}, ch = {};
  Object.keys(MAS.STATUS).forEach(function (s) { st[s] = sumWhere(h, function (c) { return Math.floor(c / 100) === Number(s); }); });
  MAS.AGE_BINS.forEach(function (b) { age[b[0]] = sumWhere(h, function (c) { var s = Math.floor(c / 100); return s >= 1 && s <= 3 && Math.floor(c / 10) % 10 === b[0]; }); });
  MAS.CHANGE_BINS.forEach(function (b) { ch[b[0]] = sumWhere(h, function (c) { var s = Math.floor(c / 100); return s >= 1 && s <= 5 && c % 10 === b[0]; }); });
  var natNow = st[1] + st[2] + st[3], everNat = natNow + st[4];
  return {status: st, age: age, changes: ch, natNow: natNow, stablePct: natNow > 0 ? 100 * st[1] / natNow : NaN,
    regrownPct: natNow > 0 ? 100 * st[2] / natNow : NaN, convertedPct: everNat > 0 ? 100 * (st[2] + st[4]) / everNat : NaN,
    lostPct: everNat > 0 ? 100 * st[4] / everNat : NaN, years: R.H.histYears[scope]};
}
function renderHabitatTab(R) {
  var T = 'Habitat';
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'Habitat quality - ' + R.cfg.species);
  if (!R.cfg.doHabitat) { MAS.tabNote(T, 'Habitat analysis is off (left panel, section 4b).'); return; }
  if (!R.H || !R.H.done) { MAS.tabNote(T, 'Computing fragmentation and habitat history in the background - see the progress panel.'); return; }
  var c = MAS.TC();
  // ---- habitat history
  var hk = MAS.card('Habitat history • ' + R.y0 + ' - ' + R.y1);
  var rows = [], hs = {};
  ['EOO', 'AOO'].forEach(function (s) {
    hs[s] = histSummary(R, s);
    if (!hs[s]) return;
    var t = sumWhere(hs[s].status, function () { return true; }) || 1;
    rows.push([s].concat([1, 2, 3, 4, 5].map(function (k) { return 100 * hs[s].status[k] / t; })));
  });
  if (rows.length) {
    hk.add(MAS.mkChart(MAS.dataTable([['Extent', 'string']].concat([1, 2, 3, 4, 5].map(function (k) { return [MAS.STATUS[k][0], 'number']; })), rows),
      'BarChart', MAS.themed({isStacked: true, colors: [1, 2, 3, 4, 5].map(function (k) { return MAS.STATUS[k][1]; }), height: 220,
        hAxis: {title: '% of the area', viewWindow: {min: 0, max: 100}}, legend: {position: 'bottom', maxLines: 3}})));
    ['EOO', 'AOO'].forEach(function (s) {
      var h = hs[s];
      if (!h) return;
      hk.add(MAS.cardLabel(s + ': natural habitat now ' + MAS.fmtHa(h.natNow) + ' - stable since ' + h.years[0] + ': ' + MAS.fmt(h.stablePct) +
        '%, regrown: ' + MAS.fmt(h.regrownPct) + '%. Accumulated loss: ' + MAS.fmt(h.lostPct) +
        '% of the area that was natural at some time is anthropic in ' + R.y1 + '.' +
        (h.years.length < R.years.length ? ' (computed with the series years only)' : '')));
    });
    var ageRows = MAS.AGE_BINS.map(function (b) { return [b[1]].concat(['EOO', 'AOO'].map(function (s) { return hs[s] ? 100 * hs[s].age[b[0]] / (hs[s].natNow || 1) : null; })); });
    hk.add(MAS.mkChart(MAS.dataTable([['Age of natural vegetation', 'string'], ['EOO', 'number'], ['AOO', 'number']], ageRows), 'ColumnChart',
      MAS.themed({title: 'Age of the natural vegetation in ' + R.y1 + ' (% of natural habitat)', colors: ['#1f8d49', '#c51b7d'], vAxis: {title: '%'}})));
    var chRows = MAS.CHANGE_BINS.map(function (b) { return [b[1]].concat(['EOO', 'AOO'].map(function (s) {
      if (!hs[s]) return null;
      var t = sumWhere(hs[s].changes, function () { return true; }) || 1;
      return 100 * hs[s].changes[b[0]] / t;
    })); });
    hk.add(MAS.mkChart(MAS.dataTable([['Class changes per pixel', 'string'], ['EOO', 'number'], ['AOO', 'number']], chRows), 'ColumnChart',
      MAS.themed({title: 'Number of land-cover changes ' + R.y0 + '-' + R.y1 + ' (% of mapped area)', colors: ['#1f8d49', '#c51b7d'], vAxis: {title: '%'}})));
    hk.add(ui.Button({label: 'Show habitat history on the map (EOO)', onClick: function () {
      var img = historyImage(R, R.tsYears.filter(function (y) { return y >= R.y0 && y <= R.y1; }));   // series years: lighter for map tiles
      var st = img.divide(100).floor();
      Map.addLayer(st.updateMask(st.gt(0)).clip(R.eooGeom || R.cellsGeom), {min: 1, max: 5,
        palette: [1, 2, 3, 4, 5].map(function (k) { return MAS.STATUS[k][1].replace('#', ''); })}, 'Habitat history ' + R.y0 + '-' + R.y1);
    }}));
  } else hk.add(MAS.cardLabel('Habitat history not available (request failed).'));
  MAS.tabAdd(T, hk);
  // ---- fragmentation
  var fk = MAS.card('Fragmentation of natural habitat in the AOO (30 m)');
  var f0 = fragSummary(R, R.y0), f1 = fragSummary(R, R.year);
  if (f1 && f1.total > 0) {
    fk.add(MAS.cardLabel('Natural habitat in the AOO in ' + R.year + ': ' + MAS.fmtHa(f1.total) + '.\n' +
      'Within 90 m of anthropic land (edge): ' + MAS.fmt(f1.edge90Pct) + '% | within 300 m: ' + MAS.fmt(f1.edge300Pct) + '%.\n' +
      'In patches smaller than ' + R.cfg.patchHa + ' ha: ' + MAS.fmt(f1.smallPct) + '% | small AND farther than ' + R.cfg.isoM +
      ' m from a large patch (≥ 92 ha): ' + MAS.fmt(f1.isoPct) + '%.' +
      (f0 && f0.total > 0 && R.y0 !== R.year ? '\nIn ' + R.y0 + ': edge ≤ 90 m ' + MAS.fmt(f0.edge90Pct) + '%, small patches ' + MAS.fmt(f0.smallPct) +
        '%, small isolated ' + MAS.fmt(f0.isoPct) + '%.' : '')));
    var yrs = MAS.uniq([R.y0, R.year]);
    fk.add(MAS.mkChart(MAS.dataTable([['Distance to anthropic land', 'string']].concat(yrs.map(function (y) { return [String(y), 'number']; })),
      MAS.EDGE_BINS.map(function (b) { return [b[1]].concat(yrs.map(function (y) { var s = fragSummary(R, y); return s && s.total ? 100 * s.edge[b[0]] / s.total : null; })); })),
      'ColumnChart', MAS.themed({title: 'Edge effect: natural habitat by distance to anthropic land (%)', colors: ['#9e9e9e', '#e8a33d'], vAxis: {title: '%'}})));
    fk.add(MAS.mkChart(MAS.dataTable([['Patch size', 'string']].concat(yrs.map(function (y) { return [String(y), 'number']; })),
      MAS.PATCH_BINS.map(function (b) { return [b[1]].concat(yrs.map(function (y) { var s = fragSummary(R, y); return s && s.total ? 100 * s.patch[b[0]] / s.total : null; })); })),
      'ColumnChart', MAS.themed({title: 'Natural habitat by patch size (%)', colors: ['#9e9e9e', '#1f8d49'], vAxis: {title: '%'}})));
    fk.add(MAS.cardLabel('Severe fragmentation (IUCN): most (> 50%) of the AOO in small and isolated patches. Here ' + MAS.fmt(f1.isoPct) +
      '% of the habitat in the AOO is in patches < ' + R.cfg.patchHa + ' ha farther than ' + R.cfg.isoM + ' m from a large patch -> ' +
      (f1.isoPct > 50 ? 'SUGGESTS severe fragmentation.' : 'does not suggest severe fragmentation.') +
      ' Patch size and distance thresholds are set in the left panel; judge them against the species\' dispersal.'));
    fk.add(ui.Button({label: 'Show edge distance on the map (AOO)', onClick: function () {
      Map.addLayer(fragImage(R, R.year).divide(100).floor().clipToCollection(R.cellsFC), {min: 0, max: 4,
        palette: ['1f8d49', 'd7191c', 'fc8d59', 'fee08b', 'd9ef8b']}, 'Edge distance class ' + R.year + ' (AOO)');
    }}));
  } else fk.add(MAS.cardLabel('Fragmentation not available (no natural habitat in the AOO or the request failed).'));
  MAS.tabAdd(T, fk);
  // ---- downloads
  MAS.tabHead(T, 'Downloads');
  var dl = ui.Panel(); MAS.tabAdd(T, dl);
  var H1 = [['Extent', 'string'], ['Status', 'string'], ['Age', 'string'], ['Changes', 'string'], ['Hectares', 'number']];
  var r1 = [];
  ['EOO', 'AOO'].forEach(function (s) {
    var h = R.H.hist[s];
    if (!h) return;
    Object.keys(h).forEach(function (k) {
      var code = Number(k), st = Math.floor(code / 100);
      var ab = MAS.AGE_BINS.filter(function (b) { return b[0] === Math.floor(code / 10) % 10; })[0];
      r1.push([s, (MAS.STATUS[st] || ['?'])[0], st >= 1 && st <= 3 && ab ? ab[1] : '', MAS.CHANGE_BINS[code % 10] ? MAS.CHANGE_BINS[code % 10][1] : '', MAS.round(h[k] * MAS.HA, 2)]);
    });
  });
  MAS.dlLink(dl, 'Habitat history (CSV)', MAS.rowsFC(H1, r1), 'csv', MAS.safeName(R.cfg.species) + '_habitat_history', MAS.colsOf(H1));
  var H2 = [['Year', 'number'], ['Edge class', 'string'], ['Patch class', 'string'], ['Small and isolated', 'number'], ['Hectares', 'number']];
  var r2 = [];
  Object.keys(R.H.frag).forEach(function (y) {
    var f = R.H.frag[y];
    Object.keys(f).forEach(function (k) {
      var code = Number(k);
      var e = MAS.EDGE_BINS.filter(function (b) { return b[0] === Math.floor(code / 100); })[0], p = MAS.PATCH_BINS.filter(function (b) { return b[0] === Math.floor(code / 10) % 10; })[0];
      r2.push([Number(y), e ? e[1] : '', p ? p[1] : '', code % 10, MAS.round(f[k] * MAS.HA, 2)]);
    });
  });
  MAS.dlLink(dl, 'Fragmentation in the AOO (CSV)', MAS.rowsFC(H2, r2), 'csv', MAS.safeName(R.cfg.species) + '_fragmentation', MAS.colsOf(H2));
}
// ============================================================================
// 17c. THREATS: fire and deforestation / secondary vegetation
// ============================================================================
function resolveThematic(reg, regName, key, prefix, cb) {
  var ck = regName + ':' + key;
  if (MAS.THEMATIC_CACHE.hasOwnProperty(ck)) { cb(MAS.THEMATIC_CACHE[ck]); return; }
  var s = reg[key];
  (function tryId(i) {
    if (i >= s.ids.length) { MAS.THEMATIC_CACHE[ck] = null; cb(null); return; }
    ee.Image(s.ids[i]).bandNames().evaluate(function (bands, err) {
      if (err || !bands) { tryId(i + 1); return; }
      var yrs = [];
      bands.forEach(function (b) { var m = new RegExp('^' + prefix + '(\\d{4})$').exec(b); if (m) yrs.push(Number(m[1])); });
      if (!yrs.length) { tryId(i + 1); return; }
      yrs.sort(function (a, b) { return a - b; });
      var out = {key: key, label: s.label, id: s.ids[i], years: yrs, img: ee.Image(s.ids[i]), countries: s.countries};
      MAS.THEMATIC_CACHE[ck] = out; cb(out);
    });
  })(0);
}
function thematicFor(R, reg, regName, prefix, cb) {
  var keys = [];
  R.allCountries.forEach(function (c) {
    for (var k in reg) if (reg.hasOwnProperty(k) && reg[k].countries.indexOf(c) >= 0 && keys.indexOf(k) < 0) keys.push(k);
  });
  var out = [];
  (function next(i) {
    if (i >= keys.length) { cb(out); return; }
    resolveThematic(reg, regName, keys[i], prefix, function (s) { if (s) out.push(s); next(i + 1); });
  })(0);
}
function fireImage(srcs, y) {
  var imgs = srcs.filter(function (s) { return s.years.indexOf(y) >= 0; })
    .map(function (s) { return s.img.select(MAS.FIRE_PREFIX + y).gt(0).selfMask().rename('b'); });
  return imgs.length ? ee.ImageCollection(imgs).mosaic() : ee.Image(0).selfMask().rename('b');
}
function defImage(srcs, y) {
  var imgs = srcs.filter(function (s) { return s.years.indexOf(y) >= 0; }).map(function (s) {
    var d = s.img.select(MAS.DEF_PREFIX + y);
    return d.where(d.gt(7), d.divide(100).floor()).toInt().selfMask().rename('d');   // 'x100' assets store class * 100 + cover
  });
  return imgs.length ? ee.ImageCollection(imgs).mosaic() : ee.Image(0).selfMask().rename('d');
}
// share of each extent covered by the countries of a product (from the land-cover zones already computed)
function coveragePct(R, srcs, scope) {
  var series = scope === 'EOO' ? (R.hasB ? R.B.series[R.year] : null) : R.A.series[R.year];
  if (!series) return NaN;
  var cs = [];
  srcs.forEach(function (s) { s.countries.forEach(function (c) { if (R.cidx[c]) cs.push(R.cidx[c]); }); });
  var t = MAS.G(series).total, cv = MAS.G(series, {c: cs}).total;
  return t > 0 ? 100 * cv / t : NaN;
}
// country mask (1 where the country has the product), from the LSIB polygons used for the zones
function countryMask(R, srcs) {
  var cs = [];
  srcs.forEach(function (s) { s.countries.forEach(function (c) { if (R.cidx[c]) cs.push(R.cidx[c]); }); });
  return ee.Image(0).int().paint(R.lsibSel, 'cidx').remap(cs.length ? cs : [-1], cs.length ? cs.map(function () { return 1; }) : [1], 0).selfMask();
}
function runThreats(R, done) {
  if (!R.cfg.doThreats) { MAS.progSet('threats', 'skip', 'off'); done(); return; }
  R.TH = {fire: {EOO: {}, AOO: {}}, def: {EOO: {}, AOO: {}}, freq: {}};
  MAS.progSet('threats', 'run', 'checking products');
  thematicFor(R, MAS.FIRE_SOURCES, 'fire', MAS.FIRE_PREFIX, function (fs) {
    thematicFor(R, MAS.DEF_SOURCES, 'def', MAS.DEF_PREFIX, function (ds) {
      if (MAS.stale(R)) return;
      R.TH.fireSrc = fs; R.TH.defSrc = ds;
      var inRange = function (srcs) {
        var u = [];
        srcs.forEach(function (s) { u = MAS.uniq(u.concat(s.years)); });
        return u.filter(function (y) { return y >= R.y0 && y <= R.y1; }).sort(function (a, b) { return a - b; });
      };
      R.TH.fireYears = inRange(fs); R.TH.defYears = inRange(ds);
      var scopes = R.eooGeom ? ['AOO', 'EOO'] : ['AOO'];
      var jobs = [];
      scopes.forEach(function (sc) {
        var geom = sc === 'AOO' ? R.cellsGeom : R.eooGeom, scale = sc === 'AOO' ? R.scaleAoo : R.scaleC;
        for (var i = 0; i < R.TH.fireYears.length; i += 4) {
          (function (ys) {
            jobs.push({key: 'fire ' + sc + ' ' + ys.join(','), kind: 'fire', scope: sc, years: ys, make: function (ts) {
              return ee.List(ys.map(function (y) {
                return areaByCode(MAS.groupImage(MAS.lulcImage(R, y)).unmask(4).updateMask(fireImage(fs, y)), geom, scale, ts);
              }));
            }});
          })(R.TH.fireYears.slice(i, i + 4));
        }
        if (R.TH.fireYears.length) {
          jobs.push({key: 'fire frequency ' + sc, kind: 'freq', scope: sc, make: function (ts) {
            var freq = ee.ImageCollection(R.TH.fireYears.map(function (y) { return fireImage(fs, y).unmask(0).toInt(); })).sum();
            var fb = ee.Image(0).where(freq.gte(1), 1).where(freq.gte(2), 2).where(freq.gte(3), 3).where(freq.gte(6), 4).where(freq.gte(11), 5);
            var natNow = MAS.groupImage(MAS.lulcImage(R, R.year)).eq(1).unmask(0);
            return areaByCode(fb.multiply(10).add(natNow).updateMask(countryMask(R, fs)), geom, scale, ts);
          }});
        }
        for (var j = 0; j < R.TH.defYears.length; j += 4) {
          (function (ys) {
            jobs.push({key: 'deforestation ' + sc + ' ' + ys.join(','), kind: 'def', scope: sc, years: ys, make: function (ts) {
              return ee.List(ys.map(function (y) { return areaByCode(defImage(ds, y), geom, scale, ts); }));
            }});
          })(R.TH.defYears.slice(j, j + 4));
        }
      });
      if (!jobs.length) { R.TH.done = true; MAS.progSet('threats', 'ok', 'no fire or deforestation product for these countries'); MAS.renderOne(R, 'Threats', renderThreatsTab); done(); return; }
      MAS.progSet('threats', 'run', '0/' + jobs.length, 0);
      runJobs(R, jobs, function (job, res, i) {
        if (res) {
          if (job.kind === 'fire') job.years.forEach(function (y, k) { R.TH.fire[job.scope][y] = parseSimple(res[k]); });
          else if (job.kind === 'def') job.years.forEach(function (y, k) { R.TH.def[job.scope][y] = parseSimple(res[k]); });
          else R.TH.freq[job.scope] = parseSimple(res);
        }
        MAS.progSet('threats', 'run', (i + 1) + '/' + jobs.length, (i + 1) / jobs.length);
        if ((i + 1) % 8 === 0) MAS.renderOne(R, 'Threats', renderThreatsTab);
      }, function (failed) {
        R.TH.done = true;
        MAS.progSet('threats', failed.length ? 'fail' : 'ok', failed.length ? failed.length + ' request(s) failed' :
          'fire ' + (R.TH.fireYears.length ? R.TH.fireYears[0] + '-' + R.TH.fireYears[R.TH.fireYears.length - 1] : 'none') +
          ', deforestation ' + (R.TH.defYears.length ? R.TH.defYears[0] + '-' + R.TH.defYears[R.TH.defYears.length - 1] : 'none'));
        MAS.renderOne(R, 'Threats', renderThreatsTab);
        MAS.renderOne(R, 'Summary', MAS.renderAssessmentTab);
        done();
      });
    });
  });
}
function fireStats(R, scope) {
  var F = R.TH && R.TH.fire[scope];
  if (!F) return null;
  var ys = Object.keys(F).map(Number).sort(function (a, b) { return a - b; });
  if (!ys.length) return null;
  var last10 = ys.filter(function (y) { return y > R.y1 - 10; });
  var natBurn = function (y) { return (F[y] && F[y][1]) || 0; };
  var tot10 = 0; last10.forEach(function (y) { tot10 += natBurn(y); });
  var series = scope === 'EOO' ? (R.hasB ? R.B.series : {}) : R.A.series;
  var hab = series[R.year] ? MAS.G(series[R.year]).natural : NaN;
  var maxY = ys.reduce(function (a, y) { return natBurn(y) > natBurn(a) ? y : a; }, ys[0]);
  return {years: ys, last10: last10, natBurned10: tot10, meanNat10: last10.length ? tot10 / last10.length : NaN,
    pctHabitatPerYear: isFinite(hab) && hab > 0 && last10.length ? 100 * tot10 / last10.length / hab : NaN, maxYear: maxY};
}
function defStats(R, scope) {
  var D = R.TH && R.TH.def[scope];
  if (!D) return null;
  var ys = Object.keys(D).map(Number).sort(function (a, b) { return a - b; });
  if (!ys.length) return null;
  var last10 = ys.filter(function (y) { return y > R.y1 - 10; });
  var sum = function (cls, list) { var s = 0; list.forEach(function (y) { s += (D[y] && D[y][cls]) || 0; }); return s; };
  var y0 = last10.length ? last10[0] : ys[0];
  var prim0 = (D[y0] && (D[y0][2] || 0) + (D[y0][4] || 0)) || 0;
  return {years: ys, defPrim10: sum(4, last10), defSec10: sum(6, last10), regrow10: sum(5, last10),
    defPrimAll: sum(4, ys), pctPrim10: prim0 > 0 ? 100 * sum(4, last10) / prim0 : NaN, last10: last10,
    primEnd: (D[ys[ys.length - 1]] && D[ys[ys.length - 1]][2]) || 0, secEnd: (D[ys[ys.length - 1]] && D[ys[ys.length - 1]][3]) || 0};
}
function renderThreatsTab(R) {
  var T = 'Threats';
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'Threats - fire and deforestation');
  if (!R.cfg.doThreats) { MAS.tabNote(T, 'Threat analysis is off (left panel, section 4b).'); return; }
  if (!R.TH || !R.TH.fireSrc) { MAS.tabNote(T, 'Checking the MapBiomas Fire and Deforestation products for these countries...'); return; }
  if (!R.TH.done) MAS.tabNote(T, 'Still loading years in the background - this tab refreshes by itself.');
  var scopes = R.eooGeom ? ['EOO', 'AOO'] : ['AOO'];
  // ---- fire
  var fk = MAS.card('Fire • burned area per year (MapBiomas Fire)');
  if (!R.TH.fireSrc.length) fk.add(MAS.cardLabel('No MapBiomas Fire product for ' + R.allCountries.join(', ') + '.'));
  else {
    fk.add(MAS.cardLabel('Products: ' + R.TH.fireSrc.map(function (s) { return s.label + ' (' + s.years[0] + '-' + s.years[s.years.length - 1] + ')'; }).join('; ') +
      '\nCoverage: ' + scopes.map(function (s) { return s + ' ' + MAS.fmt(coveragePct(R, R.TH.fireSrc, s)) + '%'; }).join(' | ') +
      ' of the area lies in countries with fire data. AOO at ' + R.scaleAoo + ' m; EOO at ' + R.scaleC +
      ' m (approximate for small burn scars - the export task in section 6 recomputes the EOO at ' + R.scaleX + ' m).'));
    scopes.forEach(function (s) {
      var F = R.TH.fire[s], ys = Object.keys(F).map(Number).sort(function (a, b) { return a - b; });
      if (!ys.length) return;
      fk.add(MAS.mkChart(MAS.dataTable([['Year', 'string'], ['Natural burned', 'number'], ['Anthropic burned', 'number'], ['Other burned', 'number']],
        ys.map(function (y) { var o = F[y] || {}; return [String(y), (o[1] || 0) * MAS.HA, (o[2] || 0) * MAS.HA, ((o[3] || 0) + (o[4] || 0) + (o[5] || 0)) * MAS.HA]; })),
        'ColumnChart', MAS.themed({title: s + ' - burned area (ha)', isStacked: true, colors: ['#d7191c', '#fdae61', '#9e9e9e'],
          vAxis: {title: 'Hectares', format: 'short'}, hAxis: {slantedText: true, slantedTextAngle: 90, showTextEvery: ys.length > 20 ? 5 : 1},
          legend: {position: 'bottom'}, height: 300})));
      var st = fireStats(R, s);
      if (st) fk.add(MAS.cardLabel(s + ': natural vegetation burned in the last 10 years (' + st.last10.join(', ') + '): ' + MAS.fmtHa(st.natBurned10) +
        ' (mean ' + MAS.fmtHa(st.meanNat10) + '/yr = ' + MAS.fmt(st.pctHabitatPerYear, 2) + '% of the natural habitat per year); worst year ' + st.maxYear + '.'));
      var fq = R.TH.freq[s];
      if (fq) {
        var labels = ['never burned', '1 time', '2 times', '3-5 times', '6-10 times', '> 10 times'];
        var natTot = sumWhere(fq, function (c) { return c % 10 === 1; }) || 1;
        fk.add(MAS.mkChart(MAS.dataTable([['Fire frequency', 'string'], ['% of natural habitat (' + R.year + ')', 'number']],
          labels.map(function (lab, k) { return [lab, 100 * sumWhere(fq, function (c) { return Math.floor(c / 10) === k && c % 10 === 1; }) / natTot]; })),
          'ColumnChart', MAS.themed({title: s + ' - fire frequency in the natural habitat (' + R.TH.fireYears[0] + '-' + R.TH.fireYears[R.TH.fireYears.length - 1] + ')',
            colors: ['#d7191c'], vAxis: {title: '%'}, legend: {position: 'none'}})));
      }
    });
    fk.add(ui.Button({label: 'Show fire frequency on the map (EOO)', onClick: function () {
      var freq = ee.ImageCollection(R.TH.fireYears.map(function (y) { return fireImage(R.TH.fireSrc, y).unmask(0).toInt(); })).sum();
      Map.addLayer(freq.selfMask().clip(R.eooGeom || R.cellsGeom), {min: 1, max: 10, palette: ['ffffb2', 'fecc5c', 'fd8d3c', 'f03b20', 'bd0026']},
        'Fire frequency ' + R.TH.fireYears[0] + '-' + R.TH.fireYears[R.TH.fireYears.length - 1]);
    }}));
  }
  MAS.tabAdd(T, fk);
  // ---- deforestation / secondary vegetation
  var dk = MAS.card('Deforestation and secondary vegetation (MapBiomas)');
  if (!R.TH.defSrc.length) dk.add(MAS.cardLabel('No MapBiomas Deforestation product for ' + R.allCountries.join(', ') + '.'));
  else {
    dk.add(MAS.cardLabel('Products: ' + R.TH.defSrc.map(function (s) { return s.label + ' (' + s.years[0] + '-' + s.years[s.years.length - 1] + ')'; }).join('; ') +
      '\nCoverage: ' + scopes.map(function (s) { return s + ' ' + MAS.fmt(coveragePct(R, R.TH.defSrc, s)) + '%'; }).join(' | ') +
      ' of the area lies in countries with this product. AOO at ' + R.scaleAoo + ' m; EOO at ' + R.scaleC + ' m (approximate; export task at ' + R.scaleX + ' m).'));
    scopes.forEach(function (s) {
      var D = R.TH.def[s], ys = Object.keys(D).map(Number).sort(function (a, b) { return a - b; });
      if (!ys.length) return;
      dk.add(MAS.mkChart(MAS.dataTable([['Year', 'string'], [MAS.DEF_CLASSES[4][0], 'number'], [MAS.DEF_CLASSES[6][0], 'number'], [MAS.DEF_CLASSES[5][0], 'number']],
        ys.map(function (y) { var o = D[y] || {}; return [String(y), (o[4] || 0) * MAS.HA, (o[6] || 0) * MAS.HA, (o[5] || 0) * MAS.HA]; })),
        'ColumnChart', MAS.themed({title: s + ' - deforestation and regrowth per year (ha)', colors: [MAS.DEF_CLASSES[4][1], MAS.DEF_CLASSES[6][1], MAS.DEF_CLASSES[5][1]],
          vAxis: {title: 'Hectares', format: 'short'}, hAxis: {slantedText: true, slantedTextAngle: 90, showTextEvery: ys.length > 20 ? 5 : 1},
          legend: {position: 'bottom'}, height: 300})));
      var st = defStats(R, s);
      if (st) dk.add(MAS.cardLabel(s + ': deforestation of primary vegetation in the last 10 years ' + MAS.fmtHa(st.defPrim10) + ' (' + MAS.fmt(st.pctPrim10, 2) +
        '% of the primary vegetation), of secondary vegetation ' + MAS.fmtHa(st.defSec10) + ', regrowth ' + MAS.fmtHa(st.regrow10) +
        '. In ' + st.years[st.years.length - 1] + ': primary ' + MAS.fmtHa(st.primEnd) + ', secondary ' + MAS.fmtHa(st.secEnd) + '.'));
    });
    dk.add(ui.Button({label: 'Show deforestation of primary vegetation on the map (EOO)', onClick: function () {
      var any = ee.ImageCollection(R.TH.defYears.map(function (y) { return defImage(R.TH.defSrc, y).eq(4).unmask(0).multiply(y).toInt(); })).max();
      Map.addLayer(any.selfMask().clip(R.eooGeom || R.cellsGeom), {min: R.TH.defYears[0], max: R.TH.defYears[R.TH.defYears.length - 1],
        palette: ['fee5d9', 'fcae91', 'fb6a4a', 'de2d26', 'a50f15']}, 'Year of deforestation of primary vegetation');
    }}));
  }
  MAS.tabAdd(T, dk);
  MAS.tabHead(T, 'Downloads');
  var dl = ui.Panel(); MAS.tabAdd(T, dl);
  var H = [['Product', 'string'], ['Extent', 'string'], ['Year', 'number'], ['Class', 'string'], ['Hectares', 'number']];
  var rows = [];
  scopes.forEach(function (s) {
    Object.keys(R.TH.fire[s]).forEach(function (y) { var o = R.TH.fire[s][y]; Object.keys(o).forEach(function (k) {
      rows.push(['fire', s, Number(y), 'burned ' + (MAS.GROUPS[Number(k) - 1] || 'other'), MAS.round(o[k] * MAS.HA, 2)]); }); });
    Object.keys(R.TH.def[s]).forEach(function (y) { var o = R.TH.def[s][y]; Object.keys(o).forEach(function (k) {
      rows.push(['deforestation', s, Number(y), (MAS.DEF_CLASSES[k] || ['class ' + k])[0], MAS.round(o[k] * MAS.HA, 2)]); }); });
  });
  MAS.dlLink(dl, 'Fire and deforestation per year (CSV)', MAS.rowsFC(H, rows), 'csv', MAS.safeName(R.cfg.species) + '_threats', MAS.colsOf(H));
}
function threatLines(R) {
  var out = [];
  if (!R.TH || !R.TH.done) return out;
  ['EOO', 'AOO'].forEach(function (s) {
    var f = fireStats(R, s), d = defStats(R, s);
    if (f) out.push(s + ' fire: ' + MAS.fmtHa(f.natBurned10) + ' of natural vegetation burned in the last 10 years (' + MAS.fmt(f.pctHabitatPerYear, 2) + '%/yr)');
    if (d) out.push(s + ' deforestation of primary vegetation in the last 10 years: ' + MAS.fmtHa(d.defPrim10) + ' (' + MAS.fmt(d.pctPrim10, 2) + '%)');
  });
  return out;
}
// habitat and threats run after the time series, one after the other (lighter on the server)
function runExtras(R) {
  if (R.extrasStarted || MAS.stale(R)) return;
  R.extrasStarted = true;
  MAS.PROG.running = true;
  if (MAS.PROG.timer === null && ui.util && ui.util.setInterval) MAS.PROG.timer = ui.util.setInterval(MAS.progTick, 500);
  var parts = [].concat(R.cfg.doHabitat ? ['habitat quality'] : []).concat(R.cfg.doThreats ? ['threats'] : []).concat(R.cfg.doClimate ? ['climate'] : []);
  var left = 3;
  function one() {
    if (MAS.stale(R)) return;
    MAS.refreshRedList(R);
    if (--left > 0) return;
    MAS.runDone(R, null);
    MAS.setStatus('Assessment complete - series' + (parts.length ? ', ' + parts.join(', ') : '') + ' and IUCN coding loaded.');
  }
  MAS.setStatus('Assessment complete. Computing ' + parts.concat(['IUCN coding']).join(', ') + ' in the background...');
  MAS.runIUCN(R, one);                                      // AOH upper bound, per-cell land cover, ecoregions
  if (!parts.length) { MAS.progSet('habitat', 'skip', 'off'); MAS.progSet('threats', 'skip', 'off'); MAS.progSet('climate', 'skip', 'off'); left = 1; return; }
  runHabitat(R, function () { runThreats(R, one); });   // land-cover based, one after the other
  MAS.runClimate(R, one);                                   // other datasets: in parallel
}
function fragEvidence(R) {
  if (!R.cfg.doHabitat) return '';
  if (!R.H || !R.H.done) return 'Fragmentation evidence: still computing (Habitat tab).';
  var f = fragSummary(R, R.year);
  if (!f || !f.total) return 'Fragmentation evidence: not available.';
  return 'Fragmentation evidence (Habitat tab): ' + MAS.fmt(f.isoPct) + '% of the habitat in the AOO is in patches < ' + R.cfg.patchHa +
    ' ha farther than ' + R.cfg.isoM + ' m from a large patch -> ' + (f.isoPct > 50 ? 'suggests' : 'does not suggest') +
    ' severe fragmentation (> 50%). Edge (≤ 90 m from anthropic land): ' + MAS.fmt(f.edge90Pct) + '%.';
}
function threatsExportFC(R, scale) {
  var geom = R.eooGeom || R.cellsGeom, ext = R.eooGeom ? 'EOO' : 'AOO', fcs = [];
  var fireNames = ee.Dictionary({'1': 'burned natural', '2': 'burned anthropic', '3': 'burned water', '4': 'burned other', '5': 'burned not observed'});
  var defNames = ee.Dictionary({'1': 'anthropic', '2': 'primary vegetation', '3': 'secondary vegetation', '4': 'deforestation of primary vegetation',
    '5': 'secondary vegetation regrowth', '6': 'deforestation of secondary vegetation', '7': 'not applied'});
  function rows(stats, product, y, names) {
    return ee.FeatureCollection(ee.List(ee.Dictionary(stats).get('groups')).map(function (g) {
      g = ee.Dictionary(g);
      var code = ee.Number(g.get('code')).int();
      return ee.Feature(null, {product: product, extent: ext, year: y, code: code, 'class': names.get(code.format(), 'class'),
        area_km2: g.get('sum'), area_ha: ee.Number(g.get('sum')).multiply(100), scale_m: scale});
    }));
  }
  (R.TH.fireYears || []).forEach(function (y) {
    fcs.push(rows(areaByCode(MAS.groupImage(MAS.lulcImage(R, y)).unmask(4).updateMask(fireImage(R.TH.fireSrc, y)), geom, scale, 16), 'fire', y, fireNames));
  });
  (R.TH.defYears || []).forEach(function (y) { fcs.push(rows(areaByCode(defImage(R.TH.defSrc, y), geom, scale, 16), 'deforestation', y, defNames)); });
  return ee.FeatureCollection(fcs).flatten();
}
