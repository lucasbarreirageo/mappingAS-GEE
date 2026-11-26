/**** mappingAS GEE 2.0.0 - module "batch": start-up and batch mode
 * Sections 15-16: initial state of the interface and the Batch tab (Quick, Full and Complete modes).
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: layout, records, config, utils, run, habitat, rangecalc, iucn_calc, report, tabs, climate, charts, iucn_coding, documents, rasters, downloads
 * Shared state created here: BATCH, batchMode, batchSpeciesBox, batchMinBox, batchRun, batchStop, batchProg, batchFill, batchTable, batchDl, batchOpenPanel, BATCH_COLS, HARVEST_TABS
 ****/

// ============================================================================
// 15. START
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.stale = stale;
  MAS.batchSpeciesList = batchSpeciesList;
  MAS.getMBCached = getMBCached;
  MAS.getSources = getSources;
  MAS.prepImages = prepImages;
  MAS.batchSpecies = batchSpecies;
  MAS.quickMetrics = quickMetrics;
  MAS.fullStage = fullStage;
  MAS.drawBatchTable = drawBatchTable;
  MAS.batchDownloads = batchDownloads;
  MAS.batchOpen = batchOpen;
  MAS.runBatch = runBatch;
  MAS.pickSpecies = pickSpecies;
  MAS.harvest = harvest;
  MAS.completeSpecies = completeSpecies;
  MAS.completeRow = completeRow;
  MAS.viewSpecies = viewSpecies;
  MAS.completeDownloads = completeDownloads;
  MAS.batchRasters = batchRasters;
  MAS.batchServerExport = batchServerExport;
};

exports.run = function () {
  MAS.TAB_NAMES.forEach(function (n) { if (n !== 'Add points') MAS.placeholder(n, 'Press "Assess" in the left panel.'); });
  MAS.showTab('Map');
  MAS.loadExample();
  if (MAS.DEFAULTS.asset) { MAS.srcSelect.setValue('Asset table (CSV)', false); MAS.readAsset(); }
  MAS.setStatus('Choose the data and press "Assess".');
  // ============================================================================
  // 16. BATCH TAB: assess many species in sequence
  //   Quick : records, EOO, AOO, locations, subpopulations, B1/B2, Criterion B
  //           (decline assumed vs. no decline), countries. Seconds per species.
  //   Full  : Quick + land cover in the EOO/AOO (start and end years), measured
  //           habitat decline (b iii), AOH/AOO upper bound and protected areas.
  //           About 1-3 minutes per species.
  //   Server: (Code Editor) one export task with the land-cover table of every
  //           species, computed on Google's servers without keeping the page open.
  // ============================================================================
  MAS.BATCH = {id: 0, running: false, rows: [], items: {}, mode: 'QUICK', srcCache: {}, esriYears: null};
  var batchTab = MAS.TABS['Batch'];
  batchTab.clear();
  batchTab.add(ui.Label('Batch assessment', {fontWeight: 'bold', fontSize: '15px', margin: '12px 8px 4px 8px'}));
  batchTab.add(ui.Label('Assesses every species of the table in sequence with the options of the left panel ' +
    '(land-cover product, years, AOO cell, locations grid, protected areas, excluded ids, added points).\n' +
    'Quick: EOO, AOO, locations, subpopulations, B1/B2, Criterion B and countries - a few seconds per species.\n' +
    'Full: also land cover, measured habitat decline, AOH and protected areas - about 1-3 minutes per species ' +
    '(keep this page open).\nComplete: the same assessment as one species, with the options of the left panel (habitat, threats, climate), ' +
    'run species after species - about 3-10 minutes each; then every table, chart, report and raster is available for all species.\n' +
    'Server task (Code Editor only): land cover of every species computed on Google\'s servers.', MAS.S.small));
  MAS.batchMode = ui.Select({items: [{label: 'Quick (range and Criterion B)', value: 'QUICK'},
    {label: 'Full (adds land cover, habitat decline and protected areas)', value: 'FULL'},
    {label: 'Complete (every tab: time series, habitat, threats, climate, protected areas, Red List; charts and rasters)', value: 'COMPLETE'}],
    value: 'QUICK', style: MAS.S.stretch});
  MAS.batchSpeciesBox = ui.Textbox({placeholder: 'species to include, separated by ; (blank = all species of the table)', style: MAS.S.stretch});
  MAS.batchMinBox = ui.Textbox({placeholder: 'minimum records per species (default 1)', value: '1', style: MAS.S.stretch});
  MAS.batchRun = ui.Button({label: 'Run batch', style: {fontWeight: 'bold'}});
  MAS.batchStop = ui.Button({label: 'Stop', disabled: true});
  MAS.batchProg = ui.Label('', {fontSize: '12px', color: '#1f5f3a', whiteSpace: 'pre-wrap'});
  MAS.batchFill = ui.Label('', {backgroundColor: '#1f8d49', height: '10px', width: '0px', margin: '0', padding: '0'});
  var batchTrack = ui.Panel([MAS.batchFill], null, {backgroundColor: '#e0e0e0', height: '10px', width: '400px', padding: '0', margin: '2px 8px'});
  MAS.batchTable = ui.Panel();
  MAS.batchDl = ui.Panel();
  MAS.batchOpenPanel = ui.Panel();
  [MAS.batchMode, MAS.batchSpeciesBox, ui.Label('Minimum records per species', MAS.S.small), MAS.batchMinBox,
   ui.Panel([MAS.batchRun, MAS.batchStop], ui.Panel.Layout.flow('horizontal')), MAS.batchProg, batchTrack, MAS.batchTable, MAS.batchOpenPanel,
   ui.Label('Downloads', {fontWeight: 'bold', fontSize: '14px', margin: '10px 8px 2px 8px'}), MAS.batchDl]
    .forEach(function (w) { batchTab.add(w); });
  // ---- results table, progress and downloads
  MAS.BATCH_COLS = ['species', 'mode', 'status', 'n_rows', 'n_records', 'n_no_coords', 'n_mismatch', 'n_unique', 'eoo_km2', 'aoo_km2',
    'aoo_cells', 'n_locations', 'n_locations_pa', 'locations_method', 'n_subpop', 'b1_eoo', 'b2_aoo', 'size_category',
    'category_decline_assumed', 'category_no_decline', 'category_B', 'category_measured_decline', 'decline', 'countries',
    'possibly_extant', 'product', 'year_start', 'year_end', 'eoo_scale_m', 'natural_pct_eoo_start', 'natural_pct_eoo_end',
    'natural_change_eoo_pct', 'natural_pct_aoo_start', 'natural_pct_aoo_end', 'natural_change_aoo_pct', 'trend_eoo_pct_yr',
    'trend_eoo_p', 'trend_aoo_pct_yr', 'trend_aoo_p', 'aoh_km2', 'aoo_upper_km2', 'b2_range', 'pa_records_pct', 'pa_aoo_pct',
    'pa_eoo_pct', 'pa_natural_eoo_pct', 'pa_n_eoo', 'window_A', 'habitat_reduction_A_pct', 'category_A', 'category_overall', 'plausible',
    'threats', 'warnings', 'seconds'];
  MAS.batchRun.onClick(runBatch);
  MAS.batchStop.onClick(function () {
    MAS.BATCH.id++; MAS.BATCH.running = false;
    MAS.batchRun.setDisabled(false); MAS.batchStop.setDisabled(true);
    MAS.batchProg.setValue(MAS.batchProg.getValue() + '\nStopped - results so far are below.');
    drawBatchTable(); batchDownloads(false); batchOpen();
  });
  MAS.HARVEST_TABS = [['Conversion', MAS.renderConversionTab], ['Protected areas', MAS.renderPATab], ['Time series', MAS.renderTimeSeriesTab],
    ['Habitat', MAS.renderHabitatTab], ['Threats', MAS.renderThreatsTab], ['Climate', MAS.renderClimateTab], ['Summary', MAS.renderAssessmentTab]];
  drawBatchTable();
};

function stale(R) { return R.batch ? R.batchId !== MAS.BATCH.id : R.run !== MAS.APP.runId; }
function batchSpeciesList() {
  var all = MAS.TABLE.kind === 'example' ? MAS.uniq(MAS.EXAMPLE_ROWS.map(function (r) { return r[0]; })) : (MAS.TABLE.species || []);
  var want = MAS.trim(MAS.batchSpeciesBox.getValue() || '');
  if (!want) return all;
  var w = want.split(';').map(function (s) { return MAS.stripAccents(MAS.trim(s)); }).filter(function (s) { return s; });
  return all.filter(function (sp) { return w.some(function (x) { return MAS.stripAccents(sp).indexOf(x) >= 0; }); });
}
// ---- land-cover sources with a cache shared by all species
function getMBCached(key, cb) {
  if (MAS.BATCH.srcCache.hasOwnProperty(key)) { cb(MAS.BATCH.srcCache[key]); return; }
  MAS.resolveMB(key, function (s) { MAS.BATCH.srcCache[key] = s; cb(s); }, function () {});
}
function getSources(R, cb) {
  var cfg = R.cfg;
  var inSA = R.recs.filter(function (r) { return r.lon >= -82 && r.lon <= -34 && r.lat >= -56 && r.lat <= 13; }).length;
  R.productKey = cfg.product === 'AUTO' ? (inSA / R.recs.length >= 0.5 ? 'MAPBIOMAS' : 'ESRI') : cfg.product;
  if (R.productKey === 'ESRI') {
    var done = function (yrs) {
      if (!yrs.length) { cb('no Sentinel-2 / Esri years'); return; }
      R.order = [{key: 'esri', label: 'Sentinel-2 / Esri 10 m LULC (Impact Observatory)', id: MAS.ESRI_ID, years: yrs, fallback: false,
        nativeScale: 10, image: function (y) {
          return MAS.ESRI_IC.filterDate(y + '-01-01', (y + 1) + '-01-01').mosaic().toInt16().selfMask().add(100).rename('lulc');
        }}];
      R.productLabel = 'Sentinel-2 / Esri 10 m';
      cb(null);
    };
    if (MAS.BATCH.esriYears) { done(MAS.BATCH.esriYears); return; }
    ee.Dictionary.fromLists(MAS.ESRI_YEARS_TRY.map(String), MAS.ESRI_YEARS_TRY.map(function (y) {
      return MAS.ESRI_IC.filterDate(y + '-01-01', (y + 1) + '-01-01').limit(1).size();
    })).evaluate(function (d, err) {
      if (err) { cb('Sentinel-2 / Esri unavailable: ' + err); return; }
      MAS.BATCH.esriYears = MAS.ESRI_YEARS_TRY.filter(function (y) { return d[String(y)] > 0; });
      done(MAS.BATCH.esriYears);
    });
    return;
  }
  var keys = [], needAmazon = cfg.strategy === 'REGIONAL_FIRST';
  R.allCountries.forEach(function (c) {
    var k = MAS.sourceKeyFor(c);
    if (k === null || k === 'amazon') { needAmazon = true; return; }
    if (keys.indexOf(k) < 0) keys.push(k);
  });
  if (needAmazon) keys.push('amazon');
  var found = {};
  (function next(i) {
    if (i >= keys.length) {
      var nat = keys.filter(function (k) { return k !== 'amazon' && found[k]; }).map(function (k) { return found[k]; });
      var am = found.amazon ? [found.amazon] : [];
      R.order = cfg.strategy === 'REGIONAL_FIRST' ? nat.concat(am) : am.concat(nat);
      R.productLabel = 'MapBiomas';
      cb(R.order.length ? null : 'no MapBiomas collection for this area');
      return;
    }
    getMBCached(keys[i], function (s) { if (s) found[keys[i]] = s; next(i + 1); });
  })(0);
}
// ---- images and geometries of one species (no country split; protection zones only)
function prepImages(R) {
  var cfg = R.cfg;
  var common = R.order[0].years.slice(), union = [];
  R.order.forEach(function (s) {
    common = common.filter(function (y) { return s.years.indexOf(y) >= 0; });
    union = MAS.uniq(union.concat(s.years));
  });
  union.sort(function (a, b) { return a - b; });
  if (!common.length) common = union;
  var ys = isFinite(cfg.startYear) ? cfg.startYear : common[0];
  var ye = isFinite(cfg.endYear) ? cfg.endYear : common[common.length - 1];
  R.years = union.filter(function (y) { return y >= ys && y <= ye; });
  if (!R.years.length) return 'no land-cover years in the period';
  R.y0 = R.years[0]; R.y1 = R.years[R.years.length - 1];
  R.year = isFinite(cfg.year) && R.years.indexOf(cfg.year) >= 0 ? cfg.year : R.y1;
  R.periods = [[R.y0, R.y1]];
  MAS.setWindowA(R);
  R.scaleAoo = Math.min.apply(null, R.order.map(function (s) { return s.nativeScale; }));
  R.scaleC = cfg.scaleEoo === 'auto' || !isFinite(cfg.scaleEoo) ? MAS.autoScale(R.eooKm2, MAS.CHART_MAX_PIXELS, R.scaleAoo) : cfg.scaleEoo;
  R.scaleX = cfg.scaleEoo === 'auto' || !isFinite(cfg.scaleEoo) ? MAS.autoScale(R.eooKm2, MAS.EXPORT_MAX_PIXELS, R.scaleAoo) : cfg.scaleEoo;
  R.tsStep = cfg.step;
  R.essYears = MAS.uniq([R.y0, R.year, R.y1, R.yA].concat(MAS.trendYears(R.years, R.y1, MAS.TREND_SPAN, MAS.TREND_N))).sort(function (a, b) { return a - b; });
  R.cname = {0: 'all'};
  if (R.wdpa) {
    var w = MAS.WDPA_ALL;
    if (cfg.wdpaMode === 'PROTECTED_PLANET') {
      w = w.filter(ee.Filter.inList('STATUS', ['Proposed', 'Not Reported']).not()).filter(ee.Filter.neq('DESIG_ENG', 'UNESCO-MAB Biosphere Reserve'));
    }
    if (cfg.wdpaMode === 'TERRESTRIAL') w = w.filter(ee.Filter.neq('MARINE', '2'));
    R.wdpaFC = w.filterBounds(R.studyGeom);
    var strict = R.wdpaFC.filter(ee.Filter.inList('IUCN_CAT', MAS.IUCN_STRICT));
    var sust = R.wdpaFC.filter(ee.Filter.inList('IUCN_CAT', MAS.IUCN_SUST));
    var other = R.wdpaFC.filter(ee.Filter.inList('IUCN_CAT', MAS.IUCN_STRICT.concat(MAS.IUCN_SUST)).not());
    R.paImg = ee.Image(0).int().paint(other, 3).paint(sust, 2).paint(strict, 1).rename('zone');
    R.paImgAOO = ee.Image(0).int().paint(other.filterBounds(R.cellsGeom), 3).paint(sust.filterBounds(R.cellsGeom), 2)
      .paint(strict.filterBounds(R.cellsGeom), 1).rename('zone');
  } else {
    R.paImg = ee.Image(0).int().rename('zone'); R.paImgAOO = R.paImg;
  }
  R.zoneAOO = R.paImgAOO; R.zoneEOO = R.paImg;
  R.A = {series: {}, trans: []}; R.B = {series: {}, trans: []};
  return null;
}
// ---- one species
function batchSpecies(cfg, id, cb) {
  var R = {batch: true, batchId: id, cfg: cfg, wdpa: cfg.wdpaMode !== 'NONE' && MAS.BATCH.mode === 'FULL', warnings: []};
  var row = {species: cfg.species, mode: MAS.BATCH.mode};
  var t0 = Date.now();
  function end(status) { row.status = status; row.seconds = Math.round((Date.now() - t0) / 1000); cb(row, R); }
  MAS.loadRecords(cfg, function (data, err) {
    if (stale(R)) return;
    if (err) { end('error reading records: ' + err); return; }
    row.n_rows = data.totalRows; row.n_no_coords = data.noGeom.length;
    if (!data.recs.length) { end('no valid coordinates'); return; }
    var pts = ee.FeatureCollection(data.recs.map(function (r) { return ee.Feature(ee.Geometry.Point([r.lon, r.lat])); }));
    pts.map(function (f) {
      var hit = MAS.lsib.filterBounds(f.geometry());
      return f.set('pc', ee.Algorithms.If(hit.size().gt(0), hit.first().get('country_na'), ''));
    }).aggregate_array('pc').evaluate(function (coordRaw, err2) {
      if (stale(R)) return;
      if (err2) { end('error (LSIB): ' + err2); return; }
      data.recs.forEach(function (r, i) {
        r.declaredN = MAS.normCountry(r.declared); r.coordC = MAS.normCountry(coordRaw[i]);
        r.mismatch = r.coordC !== '' && r.declaredN !== '' && r.coordC !== r.declaredN;
        r.excluded = cfg.exclude.indexOf(r.id) >= 0;
        r.country = cfg.countryMode === 'COORDINATES' ? (r.coordC || r.declaredN || 'No country') : (r.declaredN || r.coordC || 'No country');
      });
      R.all = data.recs;
      R.recs = R.all.filter(function (r) { return !r.excluded; });
      row.n_records = R.recs.length;
      row.n_mismatch = R.all.filter(function (r) { return r.mismatch; }).length;
      if (R.recs.length < MAS.BATCH.minRecords) { end('skipped: fewer than ' + MAS.BATCH.minRecords + ' records'); return; }
      quickMetrics(R, row);
      MAS.lsib.filterBounds(R.studyGeom).aggregate_array('country_na').distinct().evaluate(function (eooRaw, err3) {
        if (stale(R)) return;
        R.eooCountries = (eooRaw || []).map(MAS.normCountry);
        R.allCountries = MAS.uniq(R.recCountries.concat(R.eooCountries)).sort();
        row.possibly_extant = R.eooCountries.filter(function (c) { return R.recCountries.indexOf(c) < 0; }).join('; ');
        if (MAS.BATCH.mode !== 'FULL') { end(err3 ? 'ok (EOO countries failed)' : 'ok'); return; }
        fullStage(R, row, end);
      });
    });
  });
}
function quickMetrics(R, row) {
  var recs = R.recs, cfg = R.cfg;
  var C = MAS.dataCentre(recs);
  R.aoo = MAS.aooGrid(recs, cfg.aooKm, MAS.AOO_N_GRIDS, MAS.laeaParams(C.lat0, C.lon0));
  R.hull = MAS.convexHull(recs.map(function (r) { return [r.lon, r.lat]; }));
  R.eooKm2 = R.hull.ring ? MAS.eooAreaKm2(R.hull.ring, MAS.EOO_SEGMENT_KM) : (R.hull.collinear ? 0 : NaN);
  R.cat = MAS.iucnB(R.eooKm2, R.aoo.areaKm2);
  R.subpop = MAS.calcSubpop(recs);
  R.loc = MAS.calcLocations(recs, cfg.locKm, MAS.AOO_N_GRIDS);
  R.recCountries = MAS.uniq(recs.map(function (r) { return r.country; })).sort();
  R.eooGeom = R.hull.ring ? MAS.eooPolygon(R.hull.ring) : null;
  R.eooLine = R.hull.ring ? MAS.eooOutline(R.hull.ring) : null;
  R.cellsFC = ee.FeatureCollection(R.aoo.cells.map(function (c, i) {
    return ee.Feature(ee.Geometry.Polygon([c.ring], null, false), {cell: i + 1, n_records: c.recs.length});
  }));
  R.cellsGeom = R.cellsFC.geometry();
  R.studyGeom = R.eooGeom || R.cellsFC.geometry().bounds();
  var withB = MAS.iucnCriterionB(R.eooKm2, R.aoo.areaKm2, R.loc.n, false, true, false);
  var noB = MAS.iucnCriterionB(R.eooKm2, R.aoo.areaKm2, R.loc.n, false, false, false);
  row.n_unique = R.subpop.nUnique;
  row.eoo_km2 = MAS.round(R.eooKm2, 1); row.aoo_km2 = R.aoo.areaKm2; row.aoo_cells = R.aoo.n;
  row.n_locations = R.loc.n; row.n_subpop = R.subpop.n; row.b1_eoo = R.cat.b1; row.b2_aoo = R.cat.b2;
  row.size_category = R.cat.combined;
  row.category_decline_assumed = withB.code; row.category_no_decline = noB.code;
  row.countries = R.recCountries.join('; ');
}
function fullStage(R, row, end) {
  getSources(R, function (err) {
    if (stale(R)) return;
    if (err) { end('ok (range only; land cover: ' + err + ')'); return; }
    var perr = prepImages(R);
    if (perr) { end('ok (range only; ' + perr + ')'); return; }
    var pending = 0, failedNotes = [];
    function task() { pending++; var used = false; return function () { if (used) return; used = true; pending--; if (!pending) complete(); }; }
    var eA = task();
    MAS.loadYears(R, 'AOO', R.essYears, function () {}, function (f) { if (f.length) failedNotes.push('AOO ' + f.join(',')); eA(); });
    if (R.eooGeom) {
      var eB = task();
      MAS.loadYears(R, 'EOO', R.essYears, function () {}, function (f) { if (f.length) failedNotes.push('EOO ' + f.join(',')); eB(); });
    }
    if (R.wdpa) {
      var eC = task();
      var w = R.wdpaFC;
      ee.Dictionary({
        recIn: MAS.fcToDicts(ee.FeatureCollection(R.recs.map(function (r) { return ee.Feature(ee.Geometry.Point([r.lon, r.lat]), {id: r.id}); }))
          .map(function (f) { var hit = w.filterBounds(f.geometry()); return ee.Feature(null, {id: f.get('id'), n: hit.size(), ids: hit.aggregate_array('WDPAID')}); })),
        cellIn: MAS.fcToDicts(R.cellsFC.map(function (f) { return ee.Feature(null, {n: w.filterBounds(f.geometry()).size()}); })),
        nEoo: R.eooGeom ? w.filterBounds(R.eooGeom).size() : 0
      }).evaluate(function (res, err2) {
        if (stale(R)) return;
        if (err2) failedNotes.push('protected areas: ' + err2); else R.C = {recIn: MAS.propsList(res.recIn), cellIn: MAS.propsList(res.cellIn), nEoo: res.nEoo};
        eC();
      });
    }
    function complete() {
      var A = R.A.series, B = R.B.series;
      var gA0 = MAS.G(A[R.y0]), gA1 = MAS.G(A[R.year]), gB0 = MAS.G(B[R.y0]), gB1 = MAS.G(B[R.year]);
      var tB = R.eooGeom && B[R.y1] ? MAS.trendOf(R, B, R.years, null) : null, tA = MAS.trendOf(R, A, R.years, null);
      var t = tB || tA, inferred = !!(t && t.declining);
      var aoh = B[R.year] ? gB1.habitat : NaN, bounds = MAS.aooBounds(R.aoo.areaKm2, aoh, R.cat.eooAdj);
      var locN = R.loc.n;
      if (R.C) {
        var byId = {};
        R.C.recIn.forEach(function (p) { byId[p.id] = p.ids || []; });
        var lp = MAS.calcLocations(R.recs, R.cfg.locKm, MAS.AOO_N_GRIDS, R.recs.map(function (r) { return byId[r.id] || []; }), R.cfg.locMethod);
        locN = lp.n; row.n_locations_pa = lp.n; row.locations_method = lp.method;
        var nIn = R.C.recIn.filter(function (p) { return p.n > 0; }).length, cIn = R.C.cellIn.filter(function (p) { return p.n > 0; }).length;
        row.pa_records_pct = MAS.round(R.C.recIn.length ? 100 * nIn / R.C.recIn.length : NaN, 1);
        row.pa_aoo_pct = MAS.round(R.C.cellIn.length ? 100 * cIn / R.C.cellIn.length : NaN, 1);
        row.pa_n_eoo = R.C.nEoo;
        var gin = MAS.G(B[R.year], {p: MAS.PA_IN});
        row.pa_eoo_pct = MAS.round(gB1.total > 0 ? 100 * gin.total / gB1.total : NaN, 2);
        row.pa_natural_eoo_pct = MAS.round(gB1.terr > 0 ? 100 * gin.habitat / gB1.terr : NaN, 2);
      }
      var cat = MAS.iucnCriterionB(R.eooKm2, R.aoo.areaKm2, locN, false, true, false, inferred ? 'iii' : null);
      var catM = MAS.iucnCriterionB(R.eooKm2, R.aoo.areaKm2, locN, false, inferred, false, inferred ? 'iii' : null);
      row.product = R.productLabel; row.year_start = R.y0; row.year_end = R.year; row.eoo_scale_m = R.scaleC;
      row.natural_pct_eoo_start = MAS.round(gB0.natPct, 2); row.natural_pct_eoo_end = MAS.round(gB1.natPct, 2);
      row.natural_change_eoo_pct = MAS.round(gB0.habitat > 0 && B[R.year] ? 100 * (gB1.habitat - gB0.habitat) / gB0.habitat : NaN, 2);
      row.natural_pct_aoo_start = MAS.round(gA0.natPct, 2); row.natural_pct_aoo_end = MAS.round(gA1.natPct, 2);
      row.natural_change_aoo_pct = MAS.round(gA0.habitat > 0 ? 100 * (gA1.habitat - gA0.habitat) / gA0.habitat : NaN, 2);
      row.trend_eoo_pct_yr = tB ? MAS.round(tB.slopePct, 4) : null; row.trend_eoo_p = tB ? MAS.round(tB.p, 5) : null;
      row.trend_aoo_pct_yr = MAS.round(tA.slopePct, 4); row.trend_aoo_p = MAS.round(tA.p, 5);
      row.decline = inferred ? 'inferred (b iii)' : 'not measured (assumed)';
      row.aoh_km2 = MAS.round(aoh, 1); row.aoo_upper_km2 = MAS.round(bounds.upper, 1); row.b2_range = bounds.range;
      row.category_B = cat.code; row.category_measured_decline = catM.code;
      R.hasB = !!(R.eooGeom && B[R.y1] && B[R.yA]);
      var ca = MAS.critA(R);
      row.window_A = R.yA + '-' + R.y1 + (R.windowShort ? ' (shorter than ' + R.windowA + ' yr)' : '');
      row.habitat_reduction_A_pct = MAS.round(ca.reduction, 2); row.category_A = ca.code;
      row.category_overall = (MAS.CAT_RANK[ca.category] || 0) > (MAS.CAT_RANK[cat.category] || 0) ? ca.code :
        (ca.category === cat.category && MAS.CAT_RANK[ca.category] >= 3 ? cat.category + ' ' + ca.code.replace(ca.category + ' ', '') + '; ' + cat.code.replace(cat.category + ' ', '') : cat.code);
      end(failedNotes.length ? 'ok (missing: ' + failedNotes.join('; ') + ')' : 'ok');
    }
    if (!pending) complete();
  });
}
function drawBatchTable() {
  MAS.batchTable.clear();
  if (!MAS.BATCH.rows.length) return;
  var full = MAS.BATCH.mode !== 'QUICK';
  var H = [['Species', 'string'], ['Records', 'number'], ['EOO km²', 'number'], ['AOO km²', 'number'], ['Locations', 'number'],
    ['Subpops', 'number'], ['B1', 'string'], ['B2', 'string'], [full ? 'Criterion B' : 'Criterion B (decline assumed)', 'string']];
  H = H.concat(full ? [['Decline', 'string'], ['% natural EOO', 'number'], ['Natural change EOO %', 'number'], ['Trend %/yr', 'number'],
    ['p', 'number'], ['% EOO in PAs', 'number'], ['% records in PAs', 'number'], ['Habitat reduction A %', 'number'], ['Criterion A', 'string'],
    ['Overall', 'string']] : [['Criterion B (no decline)', 'string'], ['Countries', 'string']]);
  H.push(['Status', 'string']);
  MAS.batchTable.add(MAS.tableChart(H, MAS.BATCH.rows.map(function (r) {
    var base = [r.species, r.n_records === undefined ? null : r.n_records, r.eoo_km2 === undefined ? null : r.eoo_km2,
      r.aoo_km2 === undefined ? null : r.aoo_km2, r.n_locations_pa || r.n_locations || null, r.n_subpop || null,
      r.b1_eoo || '', r.b2_aoo || '', (full ? r.category_B : r.category_decline_assumed) || r.category_decline_assumed || ''];
    base = base.concat(full ? [r.decline || '', r.natural_pct_eoo_end === undefined ? null : r.natural_pct_eoo_end,
      r.natural_change_eoo_pct === undefined ? null : r.natural_change_eoo_pct, r.trend_eoo_pct_yr === undefined ? null : r.trend_eoo_pct_yr,
      r.trend_eoo_p === undefined ? null : r.trend_eoo_p, r.pa_eoo_pct === undefined ? null : r.pa_eoo_pct,
      r.pa_records_pct === undefined ? null : r.pa_records_pct, r.habitat_reduction_A_pct === undefined ? null : r.habitat_reduction_A_pct,
      r.category_A || '', r.category_overall || ''] : [r.category_no_decline || '', r.countries || '']);
    base.push(r.status || '');
    return base.map(function (v) { return typeof v === 'number' && !isFinite(v) ? null : v; });
  })));
}
function batchDownloads(final) {
  MAS.batchDl.clear();
  if (!MAS.BATCH.rows.length) return;
  var l = ui.Label('preparing link...', {fontSize: '13px'});
  MAS.batchDl.add(l);
  var fc = ee.FeatureCollection(MAS.BATCH.rows.map(function (r) {
    var o = {};
    MAS.BATCH_COLS.forEach(function (k) { if (r[k] !== undefined && r[k] !== null && !(typeof r[k] === 'number' && !isFinite(r[k]))) o[k] = r[k]; });
    return ee.Feature(null, o);
  }));
  fc.getDownloadURL('csv', MAS.BATCH_COLS, 'batch_' + MAS.BATCH.mode.toLowerCase() + '_' + MAS.BATCH.rows.length + '_species', function (url, err) {
    if (url) { l.setValue('⬇ Batch results, ' + MAS.BATCH.rows.length + ' species (CSV)' + (final ? '' : ' - partial')); l.setUrl(url); }
    else l.setValue('Download error: ' + err);
  });
  var sp = ui.Panel();
  MAS.batchDl.add(ui.Button({label: 'Spatial layers of all species: EOO, AOO cells, records (GeoJSON / KML / SHP)', onClick: function () { MAS.batchSpatial(sp); }}));
  MAS.batchDl.add(sp);
  MAS.batchDl.add(ui.Button({label: 'Create server export task: land cover of all species (Code Editor only)', onClick: batchServerExport}));
  if (MAS.BATCH.mode === 'COMPLETE') completeDownloads(final);
}
function batchOpen() {
  MAS.batchOpenPanel.clear();
  var ok = MAS.BATCH.rows.filter(function (r) { return /^ok/.test(r.status || ''); }).map(function (r) { return r.species; });
  if (!ok.length) return;
  var sel = ui.Select({items: ok, placeholder: 'open one species in the full assessment'});
  MAS.batchOpenPanel.add(ui.Panel([sel, ui.Button({label: 'Open', onClick: function () {
    var sp = sel.getValue();
    if (!sp) return;
    if (MAS.BATCH.mode === 'COMPLETE' && MAS.BATCH.items[sp]) { if (!MAS.BATCH.running) viewSpecies(MAS.BATCH.items[sp]); return; }
    if (MAS.speciesSelect && MAS.speciesSelect.items) { try { MAS.speciesSelect.setValue(sp, false); } catch (e) {} }
    if (!MAS.speciesSelect || MAS.speciesSelect.getValue() !== sp) MAS.setSpecies([sp].concat((MAS.TABLE.species || []).filter(function (s) { return s !== sp; })));
    MAS.showTab('Map');
    MAS.startRun();
  }})], ui.Panel.Layout.flow('horizontal')));
}
function runBatch() {
  var base = MAS.gatherConfig();
  if (base.kind === 'asset' && MAS.TABLE.kind !== 'asset') { MAS.batchProg.setValue('Read the asset columns first (left panel).'); return; }
  if (base.kind === 'pasted' && MAS.TABLE.kind !== 'pasted') { MAS.batchProg.setValue('Paste the table and press "Read pasted data" first (left panel).'); return; }
  if (!base.lonCol || !base.latCol) { MAS.batchProg.setValue('Pick the longitude and latitude columns (left panel).'); return; }
  if (!base.countryCol) base.countryMode = 'COORDINATES';
  MAS.WATER_DENOM = base.waterDenom;
  var list = batchSpeciesList();
  if (!list.length) { MAS.batchProg.setValue('No species to assess (check the filter or read the asset columns).'); return; }
  MAS.BATCH.id++;
  var myId = MAS.BATCH.id;
  MAS.BATCH.mode = MAS.batchMode.getValue();
  MAS.BATCH.minRecords = Math.max(1, Math.round(MAS.toNum(MAS.batchMinBox.getValue()) || 1));
  MAS.BATCH.rows = []; MAS.BATCH.items = {}; MAS.BATCH.running = true; MAS.BATCH.harvest = {};
  MAS.batchRun.setDisabled(true); MAS.batchStop.setDisabled(false);
  MAS.batchTable.clear(); MAS.batchDl.clear(); MAS.batchOpenPanel.clear();
  var t0 = Date.now();
  function show(i, current) {
    var s = Math.round((Date.now() - t0) / 1000);
    var eta = i > 0 ? Math.round(s / i * (list.length - i)) : null;
    MAS.batchProg.setValue({FULL: 'Full', COMPLETE: 'Complete', QUICK: 'Quick'}[MAS.BATCH.mode] + ' batch: ' + i + ' of ' + list.length + ' species done' +
      (current ? ' - now: ' + current : '') + '\nElapsed ' + Math.floor(s / 60) + ' min ' + (s % 60) + ' s' +
      (eta !== null && i < list.length ? ' - about ' + Math.ceil(eta / 60) + ' min left' : ''));
    MAS.batchFill.style().set('width', Math.round(400 * i / list.length) + 'px');
  }
  (function next(i) {
    if (MAS.BATCH.id !== myId) return;
    if (i >= list.length) {
      MAS.BATCH.running = false; MAS.batchRun.setDisabled(false); MAS.batchStop.setDisabled(true);
      show(i, null);
      MAS.batchProg.setValue(MAS.batchProg.getValue() + '\nBatch complete.');
      drawBatchTable(); batchDownloads(true); batchOpen();
      return;
    }
    show(i, list[i]);
    if (MAS.BATCH.mode === 'COMPLETE') { completeSpecies(list[i], myId, function (row, R) {
      if (MAS.BATCH.id !== myId) return;
      MAS.BATCH.rows.push(row); if (R) MAS.BATCH.items[list[i]] = R;
      drawBatchTable(); MAS.uiLater(function () { next(i + 1); });
    }); return; }
    batchSpecies(MAS.merge(base, {species: list[i]}), myId, function (row, R) {
      if (MAS.BATCH.id !== myId) return;
      MAS.BATCH.rows.push(row); MAS.BATCH.items[list[i]] = R;
      drawBatchTable();
      if ((i + 1) % 10 === 0) batchDownloads(false);
      next(i + 1);
    });
  })(0);
}
// ---- complete batch: the single-species assessment run for each species, then every tab's tables collected
function pickSpecies(sp) {
  if (MAS.speciesSelect) { try { MAS.speciesSelect.setValue(sp, false); } catch (e) {} }
  if (!MAS.speciesSelect || MAS.speciesSelect.getValue() !== sp) MAS.setSpecies([sp].concat((MAS.TABLE.species || []).filter(function (s) { return s !== sp; })));
}
function harvest(R) {
  MAS.COLLECT = [];
  MAS.HARVEST_TABS.forEach(function (t) { try { t[1](R); } catch (e) { R.warnings.push('Batch tables of ' + t[0] + ': ' + e.message); } });
  var got = MAS.COLLECT; MAS.COLLECT = null;
  var pre = MAS.safeName(R.cfg.species) + '_';
  got.forEach(function (g) {
    var key = String(g.name || g.label).replace(pre, '').replace(/_\d{4}$/, '');
    var h = MAS.BATCH.harvest[key] = MAS.BATCH.harvest[key] || {label: g.label.replace(/ \d{4}/, ''), items: []};
    h.items.push({species: R.cfg.species, g: g});
  });
}
function completeSpecies(sp, myId, cb) {
  var prev = MAS.APP.current, t0 = Date.now(), sent = false;
  function back(R, err) {
    if (sent) return; sent = true;
    var row = {species: sp, mode: 'COMPLETE', status: err ? 'error: ' + err : 'ok', seconds: Math.round((Date.now() - t0) / 1000)};
    if (R && R.rendered) { try { row = completeRow(R, row); harvest(R); } catch (e) { row.status = 'ok (tables: ' + e.message + ')'; } }
    cb(row, R && R.rendered ? R : null);
  }
  MAS.APP.onDone = function (R, err) { if (MAS.BATCH.id === myId) back(R, err); };
  pickSpecies(sp);
  MAS.startRun();
  if (MAS.APP.current === prev) { MAS.APP.onDone = null; back(null, 'could not start (check the columns)'); return; }
  var R0 = MAS.APP.current;
  ui.util.setTimeout(function () { if (!R0.allDone && MAS.APP.current === R0) MAS.runDone(R0, 'stopped after 40 minutes'); }, 40 * 60000);
}
function completeRow(R, row) {
  var ov = MAS.rlCategories(R), ca = ov.A, B = R.B.series, A = R.A.series, pa = MAS.paFacts(R);
  var gB0 = MAS.G(B[R.y0]), gB1 = MAS.G(B[R.year]), gA0 = MAS.G(A[R.y0]), gA1 = MAS.G(A[R.year]), t = R.trendEoo || R.trendAoo;
  return MAS.merge(row, {n_rows: R.data.totalRows, n_records: R.recs.length, n_no_coords: R.data.noGeom.length, n_unique: R.subpop.nUnique,
    eoo_km2: MAS.round(R.eooKm2, 1), aoo_km2: R.aoo.areaKm2, aoo_cells: R.aoo.n, n_locations: R.loc.n, locations_method: R.loc.method,
    n_subpop: R.subpop.n, b1_eoo: R.cat.b1, b2_aoo: R.cat.b2, size_category: R.cat.combined, category_B: ov.B.code,
    decline: R.declineBasis, countries: R.recCountries.join('; '), possibly_extant: R.possibly.join('; '), product: R.productLabel,
    year_start: R.y0, year_end: R.year, eoo_scale_m: R.scaleC, natural_pct_eoo_start: MAS.round(gB0.natPct, 2), natural_pct_eoo_end: MAS.round(gB1.natPct, 2),
    natural_change_eoo_pct: MAS.round(gB0.habitat > 0 ? 100 * (gB1.habitat - gB0.habitat) / gB0.habitat : NaN, 2),
    natural_pct_aoo_start: MAS.round(gA0.natPct, 2), natural_pct_aoo_end: MAS.round(gA1.natPct, 2),
    trend_eoo_pct_yr: t ? MAS.round(t.slopePct, 4) : null, trend_eoo_p: t ? MAS.round(t.p, 5) : null, aoh_km2: MAS.round(R.aoh, 1),
    aoo_upper_km2: MAS.round(MAS.aooUpper(R), 1), pa_records_pct: pa ? MAS.round(pa.recPct, 1) : null, pa_aoo_pct: pa ? MAS.round(pa.cellPct, 1) : null,
    window_A: ca.from + '-' + ca.to, habitat_reduction_A_pct: MAS.round(ca.reduction, 2), category_A: ca.code, category_overall: ov.code,
    plausible: ov.notation, threats: MAS.threatCoding(R).map(function (x) { return x.code; }).join('; '),
    warnings: R.warnings.length ? R.warnings.join(' | ').slice(0, 400) : ''});
}
function viewSpecies(R) {
  MAS.APP.runId = R.run; MAS.APP.current = R;
  MAS.renderAll(R);
  MAS.showTab('Summary');
  MAS.setStatus('Showing ' + R.cfg.species + ' from the batch (charts can be downloaded from each chart, ⤢ button).');
}
function completeDownloads(final) {
  var items = MAS.BATCH.rows.filter(function (r) { return MAS.BATCH.items[r.species]; }).map(function (r) { return MAS.BATCH.items[r.species]; });
  if (!items.length) return;
  var p = ui.Panel(), out = ui.Panel();
  MAS.batchDl.add(ui.Label('Tables of every tab, all species' + (final ? '' : ' (so far)'), {fontWeight: 'bold', fontSize: '13px', margin: '10px 8px 2px 8px'}));
  Object.keys(MAS.BATCH.harvest).sort().forEach(function (key) {
    var h = MAS.BATCH.harvest[key], client = h.items[0].g.rows;
    p.add(ui.Button({label: h.label.replace(' (CSV)', '') + ' - ' + h.items.length + ' species' + (client ? '' : ' (computed on the server)'), onClick: function () {
      out.clear();
      if (client) {
        var H = ['species'].concat(client.H.map(function (x) { return MAS.safeName(x[0]).toLowerCase(); })), rows = [];
        h.items.forEach(function (it) { (it.g.rows ? it.g.rows.rows : []).forEach(function (r) { rows.push([it.species].concat(r)); }); });
        MAS.fileLink(out, 'batch_' + key + '.csv', MAS.csvOf(H, rows), 'text/csv');
      } else {
        var cols = ['species'].concat(h.items[0].g.cols || []);
        var fc = ee.FeatureCollection(h.items.map(function (it) { return it.g.fc.map(function (f) { return f.set('species', it.species); }); })).flatten();
        MAS.dlLink(out, 'batch_' + key + ' (CSV, ' + h.items.length + ' species)', fc, 'csv', 'batch_' + key, cols);
        out.add(ui.Button({label: 'Export this table to Drive instead (Code Editor)', onClick: function () {
          try { Export.table.toDrive({collection: fc, description: 'batch_' + key, folder: MAS.EXPORT_FOLDER, fileNamePrefix: 'batch_' + key, fileFormat: 'CSV', selectors: cols});
            MAS.setStatus('Export task "batch_' + key + '" created: Tasks tab, Run.'); } catch (e) { MAS.setStatus('Export tasks only work in the Code Editor.', true); }
        }}));
      }
    }}));
  });
  p.add(ui.Button({label: 'IUCN SIS coded tables - all species (CSV)', onClick: function () {
    out.clear(); MAS.fileLink(out, 'batch_SIS_coding.csv', items.map(function (R, i) { var t = MAS.sisCSV(R); return i ? t.split('\n').slice(1).join('\n') : t; }).join('\n'), 'text/csv');
  }}));
  MAS.batchDl.add(p); MAS.batchDl.add(out);
  // charts and reports of one species
  var names = items.map(function (R) { return R.cfg.species; }), spSel = ui.Select({items: names, value: names[0]}), rp = ui.Panel();
  var itemOf = function () { return items[names.indexOf(spSel.getValue())]; };
  MAS.batchDl.add(ui.Label('Charts and reports', {fontWeight: 'bold', fontSize: '13px', margin: '10px 8px 2px 8px'}));
  MAS.batchDl.add(ui.Panel([spSel, ui.Button({label: 'Show in the tabs (charts)', onClick: function () { if (!MAS.BATCH.running) MAS.uiLater(function () { viewSpecies(itemOf()); }); }}),
    ui.Button({label: 'HTML report', onClick: function () { MAS.reportDownload(itemOf(), rp); }}),
    ui.Button({label: 'Supplementary information (Word)', onClick: function () { var R = itemOf(); MAS.docDownload(rp, MAS.safeName(R.cfg.species) + '_supplementary_information.doc', MAS.supplementaryDoc(R)); }})],
    ui.Panel.Layout.flow('horizontal', true)));
  MAS.batchDl.add(rp);
  // rasters of every species
  var prods = MAS.rasterProducts(items[0]), labels = prods.map(function (q) { return q[1]; });
  var prodSel = ui.Select({items: labels, value: labels[0], style: MAS.S.stretch}), extSel = ui.Select({items: ['EOO', 'AOO cells'], value: 'EOO'}), ro = ui.Panel();
  MAS.batchDl.add(ui.Label('Rasters of every species (GeoTIFF, assessment year of each species)', {fontWeight: 'bold', fontSize: '13px', margin: '10px 8px 2px 8px'}));
  MAS.batchDl.add(prodSel);
  MAS.batchDl.add(ui.Panel([extSel, ui.Button({label: 'Links for all species', onClick: function () { batchRasters(items, prods[labels.indexOf(prodSel.getValue())][0], extSel.getValue(), ro, false); }}),
    ui.Button({label: 'Export all to Drive (native, Code Editor)', onClick: function () { batchRasters(items, prods[labels.indexOf(prodSel.getValue())][0], extSel.getValue(), ro, true); }})],
    ui.Panel.Layout.flow('horizontal', true)));
  MAS.batchDl.add(ro);
}
function batchRasters(items, key, ext, out, exp) {
  out.clear();
  items.forEach(function (R) {
    var q, l = ui.Label(R.cfg.species + ': preparing...', {fontSize: '12px'});
    out.add(l);
    try { q = MAS.rasterJob(R, key, R.year, R.eooGeom ? ext : 'AOO cells'); } catch (e) { l.setValue(R.cfg.species + ': not available - ' + e.message); return; }
    var region = ee.Geometry.Rectangle(q.b.box, null, false);
    if (exp) {
      try { Export.image.toDrive({image: q.img, description: q.name, folder: MAS.EXPORT_FOLDER, fileNamePrefix: q.name, region: region, scale: q.spec.native,
        crs: 'EPSG:4326', maxPixels: 1e13, fileFormat: 'GeoTIFF'}); l.setValue(R.cfg.species + ': export task "' + q.name + '" created (Tasks tab, Run).'); }
      catch (e2) { l.setValue('Export tasks only work in the Code Editor.'); }
      return;
    }
    var sc = MAS.downloadScale(q.spec, q.b);
    q.img.getDownloadURL({name: q.name, scale: sc, crs: 'EPSG:4326', region: region, format: 'GEO_TIFF'}, function (url, err) {
      if (url) { l.setValue('⬇ ' + q.name + '.tif (' + MAS.fmt(sc, 0) + ' m)'); l.setUrl(url); } else l.setValue(R.cfg.species + ': error - ' + err);
    });
  });
}
// ---- server export (Code Editor): land cover by year, scope and protection for every species
function batchServerExport() {
  var items = MAS.BATCH.rows.filter(function (r) { return /^ok/.test(r.status || '') && MAS.BATCH.items[r.species]; })
    .map(function (r) { return MAS.BATCH.items[r.species]; });
  if (!items.length) { MAS.batchProg.setValue('No assessed species to export.'); return; }
  MAS.batchProg.setValue('Preparing the export of ' + items.length + ' species...');
  var parts = [];
  (function next(i) {
    if (i >= items.length) {
      try {
        var cols = ['species'].concat(MAS.LULC_COLS);
        Export.table.toDrive({collection: ee.FeatureCollection(ee.List(parts)).flatten(), description: 'batch_land_cover_' + items.length + '_species',
          folder: MAS.EXPORT_FOLDER, fileNamePrefix: 'batch_land_cover_' + items.length + '_species', fileFormat: 'CSV', selectors: cols});
        Export.table.toDrive({collection: ee.FeatureCollection(MAS.BATCH.rows.map(function (r) {
          var o = {}; MAS.BATCH_COLS.forEach(function (k) { if (r[k] !== undefined && r[k] !== null && !(typeof r[k] === 'number' && !isFinite(r[k]))) o[k] = r[k]; });
          return ee.Feature(null, o); })), description: 'batch_results_' + items.length + '_species', folder: MAS.EXPORT_FOLDER,
          fileNamePrefix: 'batch_results_' + items.length + '_species', fileFormat: 'CSV', selectors: MAS.BATCH_COLS});
        MAS.batchProg.setValue('Export tasks created: open the Tasks tab and press Run. The land-cover table has one row per species x ' +
          'scope (EOO/AOO) x year x protection x class (series every ' + items[0].cfg.step + ' years, EOO at the export scale).');
      } catch (e) {
        MAS.batchProg.setValue('Export tasks are not available here (Code Editor only): ' + (e.message || e));
      }
      return;
    }
    var R = items[i];
    R.wdpa = R.cfg.wdpaMode !== 'NONE';
    R.batchId = MAS.BATCH.id;
    var build = function () {
      var perr = R.order ? (R.years ? null : prepImages(R)) : 'no sources';
      if (!perr) {
        var D = MAS.serverDicts(R);
        MAS.seriesYears(R, R.cfg.step).forEach(function (y) {
          var lulc = MAS.lulcImage(R, y);
          parts.push(MAS.statsRows(D, MAS.areaStats(lulc, R.zoneAOO.multiply(1), R.cellsGeom, R.scaleAoo, 4), {species: R.cfg.species, scope: 'AOO', year: y, scale_m: R.scaleAoo}, false));
          if (R.eooGeom) parts.push(MAS.statsRows(D, MAS.areaStats(lulc, R.zoneEOO, R.eooGeom, R.scaleX, 16), {species: R.cfg.species, scope: 'EOO', year: y, scale_m: R.scaleX}, false));
        });
      }
      MAS.batchProg.setValue('Preparing the export... ' + (i + 1) + ' of ' + items.length + ' species');
      next(i + 1);
    };
    if (R.order) build(); else getSources(R, function () { build(); });
  })(0);
}
