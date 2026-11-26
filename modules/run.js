/**** mappingAS GEE 2.0.0 - module "run": statistics and the main run
 * Sections 10-11: server-side statistics helpers, parsing of the results and the step-by-step run of one species.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: rangecalc, config, utils, iucn_calc, records, layout, batch, iucn_coding, habitat, tabs, climate, redlist, sdm
 * Shared state created here: ZONE_ELEV, WATER_DENOM
 ****/

// ============================================================================
// 10. STATISTICS: server-side helpers and client-side parsing
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.lulcImage = lulcImage;
  MAS.eooPolygon = eooPolygon;
  MAS.eooOutline = eooOutline;
  MAS.groupImage = groupImage;
  MAS.transImage = transImage;
  MAS.sourceIndexImage = sourceIndexImage;
  MAS.areaStats = areaStats;
  MAS.autoScale = autoScale;
  MAS.parseStats = parseStats;
  MAS.zoneOk = zoneOk;
  MAS.byCode = byCode;
  MAS.groupTotals = groupTotals;
  MAS.G = G;
  MAS.transGroups = transGroups;
  MAS.countriesIn = countriesIn;
  MAS.trendOf = trendOf;
  MAS.gatherConfig = gatherConfig;
  MAS.startRun = startRun;
  MAS.copySettings = copySettings;
  MAS.carrySettings = carrySettings;
  MAS.failStep = failStep;
  MAS.runDone = runDone;
  MAS.mapNotice = mapNotice;
  MAS.stepCoordinates = stepCoordinates;
  MAS.stepRange = stepRange;
  MAS.sourceKeyFor = sourceKeyFor;
  MAS.resolveMB = resolveMB;
  MAS.stepMapBiomas = stepMapBiomas;
  MAS.stepEsri = stepEsri;
  MAS.stepImages = stepImages;
  MAS.seriesYears = seriesYears;
  MAS.drawMap = drawMap;
  MAS.seriesRequest = seriesRequest;
  MAS.loadYears = loadYears;
  MAS.loadTransitions = loadTransitions;
  MAS.launchStats = launchStats;
  MAS.paListFC = paListFC;
  MAS.renderAll = renderAll;
  MAS.renderOne = renderOne;
  MAS.loadRest = loadRest;
  MAS.finish = finish;
};

exports.run = function () {
  // zone = elevation flag * ZONE_ELEV + country * 10 + protection (flag 1 = outside the species' elevation limits)
  MAS.ZONE_ELEV = 100000;
  MAS.WATER_DENOM = false;
  MAS.runBtn.onClick(startRun);
};

function lulcImage(R, y) {
  var imgs = [];
  R.order.forEach(function (s) { if (s.years.indexOf(y) >= 0) imgs.push(s.image(y)); });
  if (!imgs.length) return ee.Image.constant(0).toInt16().rename('lulc').updateMask(0);
  return ee.ImageCollection(imgs).mosaic().rename('lulc');
}
// EOO geometry for Earth Engine: the hull densified along great circles (every EOO_SEGMENT_KM km) as a planar
// polygon. Same shape as a geodesic polygon, but much lighter for map tiles, clipping and statistics.
function eooPolygon(ring) { return ee.Geometry.Polygon([MAS.densifyRing(ring, MAS.EOO_SEGMENT_KM)], null, false); }
function eooOutline(ring) { return ee.FeatureCollection([ee.Feature(ee.Geometry.LineString(MAS.densifyRing(ring, MAS.EOO_SEGMENT_KM), null, false))]); }
function groupImage(lulc) { return lulc.remap(MAS.CODES, MAS.CODE_GROUP, 4).rename('group'); }
function transImage(R, y0, y1) { return lulcImage(R, y0).multiply(MAS.TCODE).add(lulcImage(R, y1)).rename('lulc'); }
function sourceIndexImage(R, y) {
  var imgs = [];
  R.order.forEach(function (s, i) {
    if (s.years.indexOf(y) >= 0) imgs.push(ee.Image.constant(i + 1).toInt8().rename('source').updateMask(s.image(y).mask()));
  });
  if (!imgs.length) return ee.Image.constant(0).toInt8().rename('source').updateMask(0);
  return ee.ImageCollection(imgs).mosaic().rename('source');
}
// Area (km2) by zone (country * 10 + protection) and class
function areaStats(lulc, zoneImg, geom, scale, tileScale) {
  return ee.Image.pixelArea().divide(1e6).rename('area').addBands(lulc).addBands(zoneImg).reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'code'}).group({groupField: 2, groupName: 'zone'}),
    geometry: geom, scale: scale, maxPixels: 1e13, tileScale: tileScale || 4});
}
function autoScale(areaKm2, target, minScale) {
  if (!isFinite(areaKm2) || areaKm2 <= 0) return minScale;
  return Math.max(minScale, Math.ceil(Math.sqrt(areaKm2 * 1e6 / target) / 10) * 10);
}
function parseStats(d) {
  var o = {};
  var gs = (d && d.groups) || [];
  for (var i = 0; i < gs.length; i++) {
    var z = Math.round(gs[i].zone);
    o[z] = o[z] || {};
    var inner = gs[i].groups || [];
    for (var j = 0; j < inner.length; j++) {
      var code = Math.round(inner[j].code);
      o[z][code] = (o[z][code] || 0) + inner[j].sum;
    }
  }
  return o;
}
function zoneOk(z, sel) {   // sel = {c: [country idx] | null, p: [protection zone] | null, e: 0/1 | undefined}
  if (!sel) return true;
  var zz = z % MAS.ZONE_ELEV, c = Math.floor(zz / 10), p = zz % 10;
  if (sel.c && sel.c.indexOf(c) < 0) return false;
  if (sel.p && sel.p.indexOf(p) < 0) return false;
  if (sel.e !== undefined && sel.e !== null && (z >= MAS.ZONE_ELEV ? 1 : 0) !== sel.e) return false;
  return true;
}
function byCode(parsed, sel) {
  var o = {};
  if (!parsed) return o;
  for (var z in parsed) {
    if (!parsed.hasOwnProperty(z) || !zoneOk(Number(z), sel)) continue;
    for (var code in parsed[z]) if (parsed[z].hasOwnProperty(code)) o[code] = (o[code] || 0) + parsed[z][code];
  }
  return o;
}
function groupTotals(bc) {
  var g = {natural: 0, anthropic: 0, water: 0, other: 0, not_observed: 0};
  for (var code in bc) if (bc.hasOwnProperty(code)) g[MAS.legOf(Number(code)).group] += bc[code];
  g.total = g.natural + g.anthropic + g.water + g.other + g.not_observed;
  g.mapped = g.total - g.not_observed;
  g.habitat = g.natural + (MAS.WATER_DENOM ? g.water : 0);
  g.terr = g.habitat + g.anthropic;
  g.natPct = g.terr > 0 ? 100 * g.habitat / g.terr : NaN;
  g.convPct = g.terr > 0 ? 100 * g.anthropic / g.terr : NaN;
  return g;
}
function G(parsed, sel) { return groupTotals(byCode(parsed, sel)); }
function transGroups(parsedTrans, sel) {
  var bc = byCode(parsedTrans, sel), m = {};
  MAS.GROUPS.forEach(function (a) { m[a] = {}; MAS.GROUPS.forEach(function (b) { m[a][b] = 0; }); });
  for (var code in bc) {
    if (!bc.hasOwnProperty(code)) continue;
    m[MAS.legOf(Math.floor(Number(code) / MAS.TCODE)).group][MAS.legOf(Number(code) % MAS.TCODE).group] += bc[code];
  }
  return m;
}
function countriesIn(R, parsed) {
  var cs = [];
  for (var z in parsed) {
    if (!parsed.hasOwnProperty(z)) continue;
    var c = Math.floor((Number(z) % MAS.ZONE_ELEV) / 10);
    if (c > 0 && cs.indexOf(c) < 0) cs.push(c);
  }
  return cs.sort(function (a, b) { return R.cname[a] < R.cname[b] ? -1 : 1; });
}
function trendOf(R, series, years, sel) {
  var ty = MAS.trendYears(years, R.y1, MAS.TREND_SPAN, MAS.TREND_N).filter(function (y) { return series[y]; });
  var nat = ty.map(function (y) { return MAS.habOf(R, series[y], sel); });
  var fit = MAS.ols(ty, nat);
  if (!fit || fit.mean <= 0) return {years: ty, slopePct: NaN, p: NaN, declining: false};
  return {years: ty, slopePct: 100 * fit.slope / fit.mean, p: fit.p, declining: fit.slope < 0 && fit.p < MAS.TREND_ALPHA};
}
// ============================================================================
// 11. RUN
// ============================================================================
function gatherConfig() {
  // the last data actually read wins (no need to switch the source menu by hand)
  var kind = MAS.TABLE.kind || (MAS.srcSelect.getValue() === MAS.SRC_ASSET ? 'asset' : MAS.srcSelect.getValue() === MAS.SRC_PASTE ? 'pasted' : 'example');
  var countryCol = MAS.colCountry.getValue();
  var scaleTxt = MAS.trim(MAS.scaleBox.getValue() || 'auto');
  return {kind: kind, assetId: MAS.TABLE.assetId, speciesCol: MAS.colSpecies.getValue(), lonCol: MAS.colLon.getValue(),
    latCol: MAS.colLat.getValue(), countryCol: countryCol && countryCol !== MAS.NO_COUNTRY ? countryCol : null,
    species: MAS.speciesSelect.getValue(), exclude: MAS.parseIds(MAS.excludeBox.getValue()),
    countryMode: MAS.countryModeSel.getValue(), product: MAS.productSel.getValue(), strategy: MAS.strategySel.getValue(),
    year: MAS.toNum(MAS.yearBox.getValue()), startYear: MAS.toNum(MAS.startBox.getValue()), endYear: MAS.toNum(MAS.endBox.getValue()),
    periods: MAS.parsePeriods(MAS.transBox.getValue()), wdpaMode: MAS.wdpaSel.getValue(), waterDenom: MAS.waterChk.getValue(),
    aooKm: MAS.toNum(MAS.aooBox.getValue()) > 0 ? MAS.toNum(MAS.aooBox.getValue()) : 2,
    locKm: MAS.toNum(MAS.locBox.getValue()) > 0 ? MAS.toNum(MAS.locBox.getValue()) : 10, locMethod: MAS.locMethodSel.getValue(),
    scaleEoo: scaleTxt === 'auto' || scaleTxt === '' ? 'auto' : MAS.toNum(scaleTxt),
    step: Math.max(1, Math.round(MAS.toNum(MAS.stepBox.getValue()) || 5)),
    genLen: MAS.toNum(MAS.genLenBox.getValue()), doHabitat: MAS.habChk.getValue(), doThreats: MAS.threatChk.getValue(),
    patchHa: Number(MAS.patchSel.getValue()), isoM: MAS.toNum(MAS.isoBox.getValue()) > 0 ? MAS.toNum(MAS.isoBox.getValue()) : 1000,
    doClimate: MAS.climChk.getValue(), climStart: Math.round(MAS.toNum(MAS.climStartBox.getValue())), climN: Math.max(1, Math.round(MAS.toNum(MAS.climNBox.getValue()) || 5)),
    doCmip: MAS.climChk.getValue() && MAS.cmipChk.getValue(),
    yearCol: MAS.colYear && MAS.colYear.getValue() && MAS.colYear.getValue() !== MAS.NO_YEAR ? MAS.colYear.getValue() : null,
    suit: MAS.suitSel.getValue(), suitCodes: MAS.parseIds(MAS.suitBox.getValue()), elevMode: MAS.elevModeSel.getValue(),
    elevMin: MAS.toNum(MAS.elevMinBox.getValue()), elevMax: MAS.toNum(MAS.elevMaxBox.getValue()),
    elevMargin: isFinite(MAS.toNum(MAS.elevMarginBox.getValue())) ? MAS.toNum(MAS.elevMarginBox.getValue()) : 100};
}
function startRun() {
  var cfg = gatherConfig();
  if (cfg.kind === 'asset' && MAS.TABLE.kind !== 'asset') { MAS.setStatus('Read the asset columns first.', true); return; }
  if (cfg.kind === 'pasted' && MAS.TABLE.kind !== 'pasted') { MAS.setStatus('Paste the table and press "Read pasted data" first.', true); return; }
  if (!cfg.species || !cfg.lonCol || !cfg.latCol) { MAS.setStatus('Pick species, longitude and latitude columns.', true); return; }
  if (!cfg.countryCol) cfg.countryMode = 'COORDINATES';
  MAS.WATER_DENOM = cfg.waterDenom;
  MAS.APP.runId++;
  var R = {run: MAS.APP.runId, cfg: cfg, wdpa: cfg.wdpaMode !== 'NONE', done: {}, warnings: []};
  carrySettings(MAS.APP.current, R);
  MAS.APP.current = R;
  MAS.APP.logPanel = null;
  ['Map', 'Conversion', 'Protected areas', 'Time series', 'Habitat', 'Threats', 'Climate', 'Summary', 'Red List', 'Bioclimate model'].forEach(function (t) {
    MAS.placeholder(t, 'The assessment is running - follow the steps in the left panel.');
  });
  MAS.spatialLinks.clear(); MAS.spatialBtn.setDisabled(true); MAS.exportBtn.setDisabled(true);
  MAS.progStart([['records', 'Read occurrence records'], ['countries', 'Check countries (LSIB)'], ['recinfo', 'Elevation, admin units, ecoregions, record checks'],
    ['range', 'EOO, AOO, locations, subpopulations'], ['product', 'Land-cover product and years'],
    ['aoo', 'AOO land cover, key years'], ['eoo', 'EOO land cover, key years'], ['pa', 'Protected areas (WDPA)'],
    ['assess', 'Criteria A and B assessment'], ['series', 'Time series, remaining years'],
    ['habitat', 'Habitat: fragmentation and history'], ['threats', 'Threats: fire and deforestation'], ['climate', 'Climate: TerraClimate, ENSO, ERA5, CMIP6'], ['iucn', 'IUCN coding: AOH bound, cells, ecoregions']]);
  if (!R.wdpa) MAS.progSet('pa', 'skip', 'off');
  mapNotice('Assessing ' + cfg.species + '... follow the progress in the left panel.');
  MAS.setStatus('Assessing ' + cfg.species + '...');
  MAS.progSet('records', 'run');
  MAS.loadRecords(cfg, function (data, err) {
    if (MAS.stale(R)) return;
    if (err) { failStep('records', 'Error reading records: ' + err); return; }
    if (!data.recs.length) { failStep('records', 'No record with valid coordinates for ' + cfg.species + '.'); return; }
    R.data = data;
    MAS.progSet('records', 'ok', data.recs.length + ' with coordinates, ' + data.noGeom.length + ' without');
    stepCoordinates(R);
  });
}
// settings typed in the Red List and Bioclimate model tabs survive a new run of the same species
function copySettings(o) {
  var c = {};
  for (var k in o) if (o.hasOwnProperty(k)) { var v = o[k]; c[k] = v && typeof v === 'object' && !Array.isArray(v) ? MAS.merge({}, v) : v; }
  return c;
}
function carrySettings(prev, R) {
  if (!prev || !prev.cfg || prev.cfg.species !== R.cfg.species) return;
  if (prev.RL) {
    R.RL = copySettings(prev.RL);
    if (R.cfg.genLen > 0 && R.RL.glMethod === 'DIRECT') R.RL.glDirect = R.cfg.genLen;   // the left panel wins when it changed
  }
  if (prev.SDMcfg) R.SDMcfg = copySettings(prev.SDMcfg);
  if (prev.assess) R.carriedAssess = MAS.merge({}, prev.assess);
}
function failStep(key, msg) { MAS.progSet(key, 'fail', msg); MAS.setStatus(msg, true); mapNotice(null); if (MAS.APP.current) runDone(MAS.APP.current, msg); }
// called once per run, when every background step has finished or the run stopped (used by the complete batch)
function runDone(R, err) {
  if (R.allDone) return;
  R.allDone = true; R.failMsg = err || null;
  if (MAS.APP.onDone) { var f = MAS.APP.onDone; MAS.APP.onDone = null; f(R, err); }
}
function mapNotice(txt) {
  if (MAS.APP.notice) { try { Map.remove(MAS.APP.notice); } catch (e) {} MAS.APP.notice = null; }
  if (txt) {
    MAS.APP.notice = ui.Label(txt, {position: 'top-center', fontSize: '13px', fontWeight: 'bold', color: '#ffffff',
      backgroundColor: '#1f5f3a', padding: '6px 10px'});
    Map.add(MAS.APP.notice);
  }
}
// ---- step 2: country of each coordinate (LSIB)
function stepCoordinates(R) {
  MAS.progSet('countries', 'run');
  var pts = ee.FeatureCollection(R.data.recs.map(function (r) { return ee.Feature(ee.Geometry.Point([r.lon, r.lat]), {id: r.id}); }));
  pts.map(function (f) {
    var hit = MAS.lsib.filterBounds(f.geometry());
    return f.set('pc', ee.Algorithms.If(hit.size().gt(0), hit.first().get('country_na'), ''));
  }).aggregate_array('pc').evaluate(function (coordRaw, err) {
    if (MAS.stale(R)) return;
    if (err) { failStep('countries', 'Error (LSIB): ' + err); return; }
    R.lsibRawFor = {};
    R.data.recs.forEach(function (r, i) {
      r.declaredN = MAS.normCountry(r.declared);
      r.coordC = MAS.normCountry(coordRaw[i]);
      if (coordRaw[i]) R.lsibRawFor[r.coordC] = coordRaw[i];
      r.mismatch = r.coordC !== '' && r.declaredN !== '' && r.coordC !== r.declaredN;
      r.excluded = R.cfg.exclude.indexOf(r.id) >= 0;
      r.country = R.cfg.countryMode === 'COORDINATES' ? (r.coordC || r.declaredN || 'No country') : (r.declaredN || r.coordC || 'No country');
    });
    R.all = R.data.recs;
    R.recs = R.all.filter(function (r) { return !r.excluded; });
    if (!R.recs.length) { failStep('countries', 'All records were excluded.'); return; }
    MAS.progSet('countries', 'ok', R.all.filter(function (r) { return r.mismatch; }).length + ' country mismatches');
    MAS.stepRecordInfo(R, function () { stepRange(R); });
  });
}
// ---- step 3: EOO/AOO/subpopulations/locations (client) and countries crossed by the EOO
function stepRange(R) {
  var recs = R.recs, cfg = R.cfg;
  var C = MAS.dataCentre(recs);
  R.aoo = MAS.aooGrid(recs, cfg.aooKm, MAS.AOO_N_GRIDS, MAS.laeaParams(C.lat0, C.lon0));
  R.hull = MAS.convexHull(recs.map(function (r) { return [r.lon, r.lat]; }));
  R.eooKm2 = R.hull.ring ? MAS.eooAreaKm2(R.hull.ring, MAS.EOO_SEGMENT_KM) : (R.hull.collinear ? 0 : NaN);
  R.cat = MAS.iucnB(R.eooKm2, R.aoo.areaKm2);
  R.subpop = MAS.calcSubpop(recs);
  R.loc = MAS.calcLocations(recs, cfg.locKm, MAS.AOO_N_GRIDS);
  R.recCountries = MAS.uniq(recs.map(function (r) { return r.country; })).sort();
  R.national = R.recCountries.map(function (c) {
    var sub = recs.filter(function (r) { return r.country === c; });
    var ce = MAS.dataCentre(sub);
    var a = MAS.aooGrid(sub, cfg.aooKm, MAS.AOO_N_GRIDS, MAS.laeaParams(ce.lat0, ce.lon0));
    var h = MAS.convexHull(sub.map(function (r) { return [r.lon, r.lat]; }));
    var e = h.ring ? MAS.eooAreaKm2(h.ring, MAS.EOO_SEGMENT_KM) : (h.collinear ? 0 : NaN);
    return {country: c, n: sub.length, nUnique: h.nUnique, aoo: a.areaKm2, cells: a.n, eoo: e, ring: h.ring,
            cat: MAS.iucnB(e, a.areaKm2), loc: MAS.calcLocations(sub, cfg.locKm, MAS.AOO_N_GRIDS).n};
  });
  R.eooGeom = R.hull.ring ? eooPolygon(R.hull.ring) : null;
  R.eooLine = R.hull.ring ? eooOutline(R.hull.ring) : null;
  R.aoo.cells.forEach(function (c) {
    var cnt = {};
    c.recs.forEach(function (r) { cnt[r.country] = (cnt[r.country] || 0) + 1; });
    var ks = Object.keys(cnt).sort(), best = ks[0];
    ks.forEach(function (k) { if (cnt[k] > cnt[best]) best = k; });
    c.country = best; c.countries = ks;
  });
  var tmp = ee.FeatureCollection(R.aoo.cells.map(function (c) { return ee.Feature(ee.Geometry.Polygon([c.ring], null, false)); }));
  R.studyGeom = R.eooGeom || tmp.geometry().bounds();
  var inSA = recs.filter(function (r) { return r.lon >= -82 && r.lon <= -34 && r.lat >= -56 && r.lat <= 13; }).length;
  R.productKey = cfg.product === 'AUTO' ? (inSA / recs.length >= 0.5 ? 'MAPBIOMAS' : 'ESRI') : cfg.product;
  MAS.progSet('range', 'ok', 'EOO ' + MAS.fmt(R.eooKm2, 0) + ' km², AOO ' + MAS.fmt(R.aoo.areaKm2, 0) + ' km², ' + R.loc.n +
    ' locations, ' + R.subpop.n + ' subpopulations');
  MAS.progSet('product', 'run');
  MAS.lsib.filterBounds(R.studyGeom).aggregate_array('country_na').distinct().evaluate(function (eooRaw, err) {
    if (MAS.stale(R)) return;
    if (err) { failStep('product', 'Error (EOO countries): ' + err); return; }
    R.eooCountries = [];
    eooRaw.forEach(function (n) { var c = MAS.normCountry(n); R.lsibRawFor[c] = n; R.eooCountries.push(c); });
    R.allCountries = MAS.uniq(R.recCountries.concat(R.eooCountries)
      .concat(R.recs.map(function (r) { return r.coordC; }).filter(function (c) { return c !== ''; }))).sort();
    R.cidx = {}; R.cname = {0: 'Outside listed countries'};
    R.allCountries.forEach(function (c, i) { R.cidx[c] = i + 1; R.cname[i + 1] = c; });
    if (R.productKey === 'ESRI') stepEsri(R); else stepMapBiomas(R);
  });
}
// ---- step 4a: MapBiomas collections (ids tried in order, asynchronously)
function sourceKeyFor(c) {
  for (var k in MAS.MB_SOURCES) if (MAS.MB_SOURCES.hasOwnProperty(k) && MAS.MB_SOURCES[k].countries.indexOf(c) >= 0) return k;
  return null;
}
function resolveMB(key, cb, warn) {
  var s = MAS.MB_SOURCES[key];
  function tryId(i) {
    if (i >= s.ids.length) { cb(null); return; }
    ee.Image(s.ids[i]).bandNames().evaluate(function (bands, err) {
      if (err || !bands) { warn(s.label + ': ' + s.ids[i] + ' unavailable'); tryId(i + 1); return; }
      var yrs = [];
      bands.forEach(function (b) { var m = /^classification_(\d{4})$/.exec(b); if (m) yrs.push(Number(m[1])); });
      if (!yrs.length) { tryId(i + 1); return; }
      yrs.sort(function (a, b) { return a - b; });
      var img = ee.Image(s.ids[i]);
      cb({key: key, label: s.label, id: s.ids[i], years: yrs, fallback: i > 0, nativeScale: 30,
          image: function (y) { return img.select('classification_' + y).toInt16().rename('lulc').selfMask(); }});
    });
  }
  tryId(0);
}
function stepMapBiomas(R) {

  var keys = [], needAmazon = R.cfg.strategy === 'REGIONAL_FIRST';
  R.noProduct = [];
  R.allCountries.forEach(function (c) {
    var k = sourceKeyFor(c);
    if (k === null) { R.noProduct.push(c); needAmazon = true; return; }
    if (k === 'amazon') needAmazon = true; else if (keys.indexOf(k) < 0) keys.push(k);
  });
  if (needAmazon) keys.push('amazon');
  var found = {};
  function next(i) {
    if (MAS.stale(R)) return;
    if (i >= keys.length) {
      var nat = keys.filter(function (k) { return k !== 'amazon' && found[k]; }).map(function (k) { return found[k]; });
      var am = found.amazon ? [found.amazon] : [];
      R.order = R.cfg.strategy === 'REGIONAL_FIRST' ? nat.concat(am) : am.concat(nat);
      if (!R.order.length) { failStep('product', 'No MapBiomas collection available for this area. Try Sentinel-2.'); return; }
      R.productLabel = 'MapBiomas (' + (R.cfg.strategy === 'NATIONAL_FIRST' ? 'national collections first' : 'Amazonia first') + ')';
      stepImages(R);
      return;
    }
    resolveMB(keys[i], function (s) { if (s) found[keys[i]] = s; next(i + 1); }, function (w) { R.warnings.push(w); });
  }
  next(0);
}
// ---- step 4b: Sentinel-2 / Esri 10 m
function stepEsri(R) {

  R.noProduct = [];
  ee.Dictionary.fromLists(MAS.ESRI_YEARS_TRY.map(String), MAS.ESRI_YEARS_TRY.map(function (y) {
    return MAS.ESRI_IC.filterDate(y + '-01-01', (y + 1) + '-01-01').filterBounds(R.studyGeom).size();
  })).evaluate(function (d, err) {
    if (MAS.stale(R)) return;
    if (err) { failStep('product', 'Sentinel-2 / Esri collection unavailable: ' + err); return; }
    var yrs = MAS.ESRI_YEARS_TRY.filter(function (y) { return d[String(y)] > 0; });
    if (!yrs.length) { failStep('product', 'No Sentinel-2 / Esri images over this area.'); return; }
    R.order = [{key: 'esri', label: 'Sentinel-2 / Esri 10 m LULC (Impact Observatory)', id: MAS.ESRI_ID, years: yrs, fallback: false,
      nativeScale: 10, image: function (y) {
        return MAS.ESRI_IC.filterDate(y + '-01-01', (y + 1) + '-01-01').mosaic().toInt16().selfMask().add(100).rename('lulc');
      }}];
    R.productLabel = 'Sentinel-2 / Esri 10 m';
    stepImages(R);
  });
}
// ---- step 5: period, images, map and statistics
function stepImages(R) {
  var cfg = R.cfg;
  var common = R.order[0].years.slice(), union = [];
  R.order.forEach(function (s) {
    common = common.filter(function (y) { return s.years.indexOf(y) >= 0; });
    union = MAS.uniq(union.concat(s.years));
  });
  union.sort(function (a, b) { return a - b; });
  if (!common.length) common = union;
  R.common = common;
  var ys = isFinite(cfg.startYear) ? cfg.startYear : common[0];
  var ye = isFinite(cfg.endYear) ? cfg.endYear : common[common.length - 1];
  R.years = union.filter(function (y) { return y >= ys && y <= ye; });
  if (!R.years.length) { failStep('product', 'No land-cover data in this period.'); return; }
  MAS.progSet('product', 'ok', R.productLabel + ', ' + R.years[0] + '-' + R.years[R.years.length - 1]);
  R.y0 = R.years[0]; R.y1 = R.years[R.years.length - 1];
  R.year = isFinite(cfg.year) && R.years.indexOf(cfg.year) >= 0 ? cfg.year : R.y1;
  MAS.setWindowA(R);
  if (isFinite(cfg.year) && R.year !== cfg.year) R.warnings.push('Land-cover year ' + cfg.year + ' unavailable; using ' + R.year + '.');
  var pin = cfg.periods || [[R.y0, R.y1]];
  R.periods = pin.filter(function (p) { return R.years.indexOf(p[0]) >= 0 && R.years.indexOf(p[1]) >= 0 && p[0] < p[1]; });
  if (R.periods.length < pin.length) R.warnings.push('Transition periods outside ' + R.y0 + '-' + R.y1 + ' were ignored.');
  if (!R.periods.length) R.periods = [[R.y0, R.y1]];
  R.scaleAoo = Math.min.apply(null, R.order.map(function (s) { return s.nativeScale; }));
  R.scaleC = cfg.scaleEoo === 'auto' || !isFinite(cfg.scaleEoo) ? autoScale(R.eooKm2, MAS.CHART_MAX_PIXELS, R.scaleAoo) : cfg.scaleEoo;
  R.scaleX = cfg.scaleEoo === 'auto' || !isFinite(cfg.scaleEoo) ? autoScale(R.eooKm2, MAS.EXPORT_MAX_PIXELS, R.scaleAoo) : cfg.scaleEoo;
  R.tsStep = cfg.step;
  R.tsYears = seriesYears(R, cfg.step);
  R.order.forEach(function (s) {
    var miss = R.years.filter(function (y) { return s.years.indexOf(y) < 0; });
    if (miss.length) R.warnings.push(s.label + ' has no ' + miss.join(', ') + ' (its area has no data in those years).');
  });

  // geometries
  R.cellsFC = ee.FeatureCollection(R.aoo.cells.map(function (c, i) {
    return ee.Feature(ee.Geometry.Polygon([c.ring], null, false), {cell: i + 1, n_records: c.recs.length, country: c.country,
      countries: c.countries.join(';'), cidx: R.cidx[c.country], ids: c.recs.map(function (r) { return r.id; }).join(';')});
  }));
  R.cellsGeom = R.cellsFC.geometry();
  R.recsFC = ee.FeatureCollection(R.all.map(function (r) {
    return ee.Feature(ee.Geometry.Point([r.lon, r.lat]), {id: r.id, collector: r.collector, number: r.number,
      country_declared: r.declaredN, country_coord: r.coordC, country: r.country, mismatch: r.mismatch ? 1 : 0,
      excluded: r.excluded ? 1 : 0, source: r.source,
      style: {color: r.excluded ? '9e9e9e' : (r.source === 'added point' ? '00bcd4' : (r.mismatch ? 'ff8c00' : '000000')), pointSize: 4, width: 1}});
  }));
  R.recsInFC = R.recsFC.filter(ee.Filter.eq('excluded', 0));
  R.natHulls = ee.FeatureCollection(R.national.filter(function (n) { return n.ring; }).map(function (n) {
    return ee.Feature(eooPolygon(n.ring), {scope: 'National EOO', country: n.country, eoo_km2: MAS.round(n.eoo, 1)});
  }));
  R.hullsFC = R.eooGeom ? ee.FeatureCollection([ee.Feature(R.eooGeom, {scope: 'EOO', country: 'TOTAL', eoo_km2: MAS.round(R.eooKm2, 1)})]).merge(R.natHulls) : R.natHulls;
  var lsibIdx = {};
  R.allCountries.forEach(function (c) { if (R.lsibRawFor[c]) lsibIdx[R.lsibRawFor[c]] = R.cidx[c]; });
  R.lsibSel = MAS.lsib.filter(ee.Filter.inList('country_na', Object.keys(lsibIdx))).map(function (f) {
    return f.set('cidx', ee.Dictionary(lsibIdx).get(f.get('country_na')));
  });

  // protected areas
  if (R.wdpa) {
    var w = MAS.WDPA_ALL;
    if (cfg.wdpaMode === 'PROTECTED_PLANET') {
      w = w.filter(ee.Filter.inList('STATUS', ['Proposed', 'Not Reported']).not())
           .filter(ee.Filter.neq('DESIG_ENG', 'UNESCO-MAB Biosphere Reserve'));
    }
    if (cfg.wdpaMode === 'TERRESTRIAL') w = w.filter(ee.Filter.neq('MARINE', '2'));
    R.wdpaFC = w.filterBounds(R.studyGeom);
    var strict = R.wdpaFC.filter(ee.Filter.inList('IUCN_CAT', MAS.IUCN_STRICT));
    var sust = R.wdpaFC.filter(ee.Filter.inList('IUCN_CAT', MAS.IUCN_SUST));
    var other = R.wdpaFC.filter(ee.Filter.inList('IUCN_CAT', MAS.IUCN_STRICT.concat(MAS.IUCN_SUST)).not());
    R.paImg = ee.Image(0).int().paint(other, 3).paint(sust, 2).paint(strict, 1).rename('pa');
    var c3 = other.filterBounds(R.cellsGeom), c2 = sust.filterBounds(R.cellsGeom), c1 = strict.filterBounds(R.cellsGeom);
    R.paImgAOO = ee.Image(0).int().paint(c3, 3).paint(c2, 2).paint(c1, 1).rename('pa');
  } else {
    R.paImg = ee.Image(0).int().rename('pa');
    R.paImgAOO = R.paImg;
  }
  R.zoneAOO = ee.Image(0).int().paint(R.cellsFC, 'cidx').multiply(10).add(R.paImgAOO).rename('zone');
  R.zoneEOO = ee.Image(0).int().paint(R.lsibSel, 'cidx').multiply(10).add(R.paImg).rename('zone');
  var eo = MAS.elevOutImage(R);
  if (eo) { R.zoneAOO = R.zoneAOO.add(eo.multiply(MAS.ZONE_ELEV)).rename('zone'); R.zoneEOO = R.zoneEOO.add(eo.multiply(MAS.ZONE_ELEV)).rename('zone'); }

  drawMap(R, 'EOO');
  launchStats(R);
}
// years of a series with a given step (always includes start, end, map year, trend and transition years)
function seriesYears(R, step) {
  return MAS.uniq(R.years.filter(function (y) { return (y - R.y0) % step === 0; })
    .concat([R.y1, R.year]).concat(R.yA ? [R.yA] : []).concat(MAS.trendYears(R.years, R.y1, MAS.TREND_SPAN, MAS.TREND_N))
    .concat(R.periods.map(function (p) { return p[0]; })).concat(R.periods.map(function (p) { return p[1]; })))
    .sort(function (a, b) { return a - b; });
}
// ---- map: only land cover clipped to the EOO / AOO, plus outlines and records
function drawMap(R, clip) {
  R.clip = clip;
  Map.layers().reset();
  if (MAS.APP.legend) { try { Map.remove(MAS.APP.legend); } catch (e) {} MAS.APP.legend = null; }
  var lulc = lulcImage(R, R.year);
  if ((clip === 'EOO' || clip === 'Both') && R.eooGeom) Map.addLayer(lulc.clip(R.eooGeom), MAS.VIS, 'Land cover ' + R.year + ' (EOO)');
  if (clip === 'AOO' || clip === 'Both' || !R.eooGeom) Map.addLayer(lulc.clipToCollection(R.cellsFC), MAS.VIS, 'Land cover ' + R.year + ' (AOO)');
  if (R.wdpa) Map.addLayer(ee.Image().byte().paint({featureCollection: R.wdpaFC, color: 1, width: 1}), {palette: ['006d2c']}, 'Protected areas (WDPA)', false);
  if (R.eooLine) Map.addLayer(R.eooLine.style({color: '000000', width: 2}), {}, 'EOO');
  Map.addLayer(R.natHulls.style({color: '0000ff', fillColor: '00000000', width: 1}), {}, 'National EOOs', false);
  Map.addLayer(R.cellsFC.style({color: 'c51b7d', fillColor: '00000000', width: 1}), {}, 'AOO cells');
  if (R.loc && R.loc.cells && R.loc.cells.length) {
    var lc = ee.FeatureCollection(R.loc.cells.map(function (c) { return ee.Feature(ee.Geometry.Polygon([c.ring], null, false)); }));
    Map.addLayer(lc.style({color: 'ff7f00', fillColor: '00000000', width: 1}), {}, 'Location cells (' + R.cfg.locKm + ' km)', false);
  }
  Map.addLayer(R.recsFC.style({styleProperty: 'style'}), {}, 'Records');
  if (MAS.APP.notice) { try { Map.remove(MAS.APP.notice); Map.add(MAS.APP.notice); } catch (e) {} }
  if (MAS.APP.manual.length) {
    MAS.APP.manualLayer = ui.Map.Layer(MAS.manualFC().style({color: '00bcd4', pointSize: 6, width: 2}), {}, 'Added points');
    Map.layers().add(MAS.APP.manualLayer);
  }
  if (!R.centered) { Map.centerObject(R.eooGeom || R.cellsFC, 4); R.centered = true; }
  var lp = ui.Panel({style: {position: 'bottom-left', padding: '6px 8px'}});
  lp.add(ui.Label(R.cfg.species, {fontWeight: 'bold', fontSize: '12px', fontStyle: 'italic'}));
  [['000000', 'EOO / records'], ['c51b7d', 'AOO cells'], ['ff8c00', 'Country mismatch'], ['00bcd4', 'Added point'],
   ['9e9e9e', 'Excluded']].forEach(function (it) {
    lp.add(ui.Panel([ui.Label('', {backgroundColor: '#' + it[0], padding: '7px', margin: '2px 6px 2px 0'}),
      ui.Label(it[1], {fontSize: '11px', margin: '2px 0'})], ui.Panel.Layout.flow('horizontal')));
  });
  MAS.APP.legend = lp;
  Map.add(lp);
}
function seriesRequest(R, years, scope, tileScale) {
  var geom = scope === 'AOO' ? R.cellsGeom : R.eooGeom;
  var zone = scope === 'AOO' ? R.zoneAOO : R.zoneEOO;
  var scale = scope === 'AOO' ? R.scaleAoo : R.scaleC;
  return years.map(function (y) { return areaStats(lulcImage(R, y), zone, geom, scale, tileScale || 4); });
}
// Loads land-cover statistics for a list of years in small batches (one request per batch,
// one retry with a larger tileScale), so no single request hits Earth Engine's time limit.
function loadYears(R, scope, years, onStep, done) {
  var store = scope === 'AOO' ? R.A.series : R.B.series;
  var todo = years.filter(function (y) { return !store[y]; });
  var size = scope === 'AOO' ? 3 : 2, chunks = [], failed = [], n = 0;
  for (var i = 0; i < todo.length; i += size) chunks.push(todo.slice(i, i + size));
  function run(k, retry) {
    if (MAS.stale(R)) return;
    if (k >= chunks.length) { done(failed); return; }
    ee.List(seriesRequest(R, chunks[k], scope, retry ? 16 : 4)).evaluate(function (res, err) {
      if (MAS.stale(R)) return;
      if (err || !res) {
        if (!retry) { run(k, true); return; }
        failed = failed.concat(chunks[k]);
      } else {
        chunks[k].forEach(function (y, j) { store[y] = parseStats(res[j]); });
      }
      n += chunks[k].length;
      onStep(n, todo.length);
      run(k + 1, false);
    });
  }
  run(0, false);
}
function loadTransitions(R, scope, done) {
  var geom = scope === 'AOO' ? R.cellsGeom : R.eooGeom, zone = scope === 'AOO' ? R.zoneAOO : R.zoneEOO;
  var scale = scope === 'AOO' ? R.scaleAoo : R.scaleC, out = scope === 'AOO' ? R.A.trans : R.B.trans;
  function run(k) {
    if (MAS.stale(R)) return;
    if (k >= R.periods.length) { done(); return; }
    var p = R.periods[k];
    areaStats(transImage(R, p[0], p[1]), zone, geom, scale, 8).evaluate(function (res, err) {
      if (MAS.stale(R)) return;
      out[k] = err ? {} : parseStats(res);
      if (err) R.warnings.push(scope + ' transitions ' + p[0] + '-' + p[1] + ' failed: ' + err);
      run(k + 1);
    });
  }
  run(0);
}
function launchStats(R) {
  var sampleImg = lulcImage(R, R.y0).rename('lulc_start').addBands(lulcImage(R, R.year).rename('lulc_year'))
    .addBands(sourceIndexImage(R, R.year).rename('product')).addBands(R.paImgAOO.rename('protection'));
  R.recsSampled = sampleImg.reduceRegions({collection: R.recsFC, reducer: ee.Reducer.first(), scale: R.scaleAoo});
  R.A = {series: {}, trans: []}; R.B = {series: {}, trans: []};
  // key years first (start, map year, end, trend and transition years); the rest of the series afterwards
  R.essYears = MAS.uniq([R.y0, R.year, R.y1].concat(R.yA ? [R.yA] : []).concat(MAS.trendYears(R.years, R.y1, MAS.TREND_SPAN, MAS.TREND_N))
    .concat(R.periods.map(function (p) { return p[0]; })).concat(R.periods.map(function (p) { return p[1]; })))
    .sort(function (a, b) { return a - b; });
  R.pending = 0;
  function task() { R.pending++; var used = false; return function () { if (used) return; used = true; R.pending--; finish(R); }; }

  // AOO: key years, then transitions
  var endA = task();
  MAS.progSet('aoo', 'run', '0/' + R.essYears.length + ' years at ' + R.scaleAoo + ' m', 0);
  loadYears(R, 'AOO', R.essYears, function (k, n) { MAS.progSet('aoo', 'run', k + '/' + n + ' years at ' + R.scaleAoo + ' m', k / n); },
    function (failed) {
      if (failed.length === R.essYears.length) { R.errA = 'every request failed'; R.done.A = 'fail'; MAS.progSet('aoo', 'fail', R.errA); endA(); return; }
      R.done.A = 'ok';
      MAS.progSet('aoo', failed.length ? 'fail' : 'ok', failed.length ? 'missing ' + failed.join(', ') : R.essYears.join(', '));
      loadTransitions(R, 'AOO', endA);
    });

  // records: class, product and protection at each point; geodesic EOO area check
  var endP = task();
  ee.Dictionary({pts: MAS.fcToDicts(R.recsSampled.select(['id', 'lulc_start', 'lulc_year', 'product', 'protection'], null, false)),
    eooGee: R.eooGeom ? R.eooGeom.area(100).divide(1e6) : -1}).evaluate(function (res, err) {
    if (MAS.stale(R)) return;
    if (err) R.warnings.push('Record sampling failed: ' + err);
    R.pts = err ? [] : MAS.propsList(res.pts);
    R.eooGee = err ? -1 : res.eooGee;
    endP();
  });

  // EOO: key years, then transitions
  if (R.eooGeom) {
    var endB = task();
    MAS.progSet('eoo', 'run', '0/' + R.essYears.length + ' years at ' + R.scaleC + ' m', 0);
    loadYears(R, 'EOO', R.essYears, function (k, n) { MAS.progSet('eoo', 'run', k + '/' + n + ' years at ' + R.scaleC + ' m', k / n); },
      function (failed) {
        if (failed.length === R.essYears.length) { R.errB = 'every request failed - raise the EOO scale'; R.done.B = 'fail'; MAS.progSet('eoo', 'fail', R.errB); endB(); return; }
        R.done.B = 'ok';
        MAS.progSet('eoo', failed.length ? 'fail' : 'ok', failed.length ? 'missing ' + failed.join(', ') : R.essYears.join(', '));
        loadTransitions(R, 'EOO', endB);
      });
  } else { R.done.B = 'none'; MAS.progSet('eoo', 'skip', 'no EOO'); }

  // protected areas (vector metrics, as mappingAS)
  if (R.wdpa) {
    var endC = task();
    MAS.progSet('pa', 'run');
    var w = R.wdpaFC, recsC = R.recsInFC, cellsC = R.cellsFC, eoo = R.eooGeom;
    ee.Dictionary({
      recIn: MAS.fcToDicts(recsC.map(function (f) {
        var hit = w.filterBounds(f.geometry());
        return ee.Feature(null, {id: f.get('id'), n: hit.size(), names: hit.aggregate_array('NAME'), ids: hit.aggregate_array('WDPAID')});
      })),
      cellIn: MAS.fcToDicts(cellsC.map(function (f) { return ee.Feature(null, {cell: f.get('cell'), n: w.filterBounds(f.geometry()).size()}); })),
      list: MAS.fcToDicts(paListFC(R, R.cellsGeom)),
      nEoo: eoo ? w.filterBounds(eoo).size() : 0
    }).evaluate(function (res, err) {
      if (MAS.stale(R)) return;
      if (err) { R.errC = String(err); R.done.C = 'fail'; MAS.progSet('pa', 'fail', R.errC); endC(); return; }
      MAS.safeRun('protected areas', function () {
        R.C = {recIn: MAS.propsList(res.recIn), cellIn: MAS.propsList(res.cellIn), list: MAS.propsList(res.list), nEoo: res.nEoo};
        var byId = {};
        R.C.recIn.forEach(function (p) { byId[p.id] = p.ids || []; });
        R.locPlain = R.loc;
        R.loc = MAS.calcLocations(R.recs, R.cfg.locKm, MAS.AOO_N_GRIDS, R.recs.map(function (r) { return byId[r.id] || []; }), R.cfg.locMethod);
        R.done.C = 'ok';
      });
      if (R.done.C !== 'ok') { R.errC = 'could not read the protected-area results'; R.done.C = 'fail'; MAS.progSet('pa', 'fail', R.errC); }
      else MAS.progSet('pa', 'ok', R.C.recIn.filter(function (p) { return p.n > 0; }).length + ' records and ' + R.C.nEoo + ' PAs in the EOO');
      endC();
    });
  } else { R.done.C = 'none'; }
}
function paListFC(R, within) {
  var recsC = R.recsInFC, cellsC = R.cellsFC, eoo = R.eooGeom;
  return R.wdpaFC.filterBounds(within).map(function (f) {
    var g = f.geometry();
    return ee.Feature(null, {name: f.get('NAME'), designation: f.get('DESIG_ENG'), iucn_cat: f.get('IUCN_CAT'),
      status: f.get('STATUS'), status_year: f.get('STATUS_YR'), iso3: f.get('ISO3'), wdpaid: f.get('WDPAID'),
      marine: f.get('MARINE'), n_records: recsC.filterBounds(g).size(), aoo_cells: cellsC.filterBounds(g).size(),
      overlap_eoo_km2: eoo ? g.intersection(eoo, ee.ErrorMargin(100)).area(100).divide(1e6) : null});
  });
}
function renderAll(R) {
  [['Map', MAS.renderMapTab], ['Conversion', MAS.renderConversionTab], ['Protected areas', MAS.renderPATab],
   ['Time series', MAS.renderTimeSeriesTab], ['Habitat', MAS.renderHabitatTab], ['Threats', MAS.renderThreatsTab], ['Climate', MAS.renderClimateTab], ['Summary', MAS.renderAssessmentTab],
   ['Red List', MAS.renderRedListTab], ['Bioclimate model', MAS.renderSdmTab]].forEach(function (t) { renderOne(R, t[0], t[1]); });
}
// A hidden tab is not in the page, so it is rebuilt at once. The tab on screen is rebuilt a moment later, outside
// any widget event: replacing widgets while the browser is still handling a click or an open drop-down is what
// raises the Code Editor error "Cannot read properties of null (reading 'classList')".
function renderOne(R, name, fn) {
  var run = function () {
    if (MAS.stale(R)) return;
    try { fn(R); } catch (e) { MAS.placeholder(name, 'Error while drawing this tab: ' + (e && e.message ? e.message : e) + '\nPlease report this message.'); }
  };
  if (name === MAS.CURRENT_TAB) MAS.uiLater(run); else run();
}
// remaining years of the series (at the chosen step), AOO and EOO, after the results are on screen
function loadRest(R) {
  var years = seriesYears(R, R.tsStep);
  var needA = years.filter(function (y) { return !R.A.series[y]; });
  var needB = R.hasB ? years.filter(function (y) { return !R.B.series[y]; }) : [];
  var total = needA.length + needB.length;
  R.restDone = false;
  if (!total) {
    R.restDone = true;
    MAS.progSet('series', 'ok', years.length + ' years (step ' + R.tsStep + ')');
    renderOne(R, 'Time series', MAS.renderTimeSeriesTab);
    MAS.setStatus('Assessment complete - series every ' + R.tsStep + ' year(s) loaded.');
    MAS.runExtras(R);
    return;
  }
  var a = 0, b = 0, lost = [];
  var upd = function () { MAS.progSet('series', 'run', (a + b) + '/' + total + ' (step ' + R.tsStep + ')', (a + b) / total); };
  upd();
  loadYears(R, 'AOO', needA, function (k) { a = k; upd(); if (k % 6 === 0) renderOne(R, 'Time series', MAS.renderTimeSeriesTab); }, function (fa) {
    lost = lost.concat(fa.map(function (y) { return 'AOO ' + y; }));
    loadYears(R, 'EOO', needB, function (k) { b = k; upd(); if (k % 6 === 0) renderOne(R, 'Time series', MAS.renderTimeSeriesTab); }, function (fb) {
      lost = lost.concat(fb.map(function (y) { return 'EOO ' + y; }));
      R.restDone = true;
      MAS.progSet('series', lost.length ? 'fail' : 'ok', lost.length ? 'missing ' + lost.join(', ') : years.length + ' years (step ' + R.tsStep + ')');
      renderOne(R, 'Time series', MAS.renderTimeSeriesTab);
      MAS.setStatus('Assessment complete - series every ' + R.tsStep + ' year(s) loaded.');
      MAS.runExtras(R);
    });
  });
}
// ---- all parts ready: decline inference, assessment and tab rendering
function finish(R) {
  if (R.pending > 0 || R.finished) return;
  R.finished = true;
  if (R.done.A !== 'ok') { failStep('assess', 'AOO statistics failed: ' + R.errA); return; }
  MAS.progSet('assess', 'run');
  R.hasB = R.done.B === 'ok'; R.hasC = R.done.C === 'ok';
  // continuing decline (b): significant recent decline of natural habitat in the EOO (AOO if no EOO)
  R.trendEoo = R.hasB ? trendOf(R, R.B.series, R.years, null) : null;
  R.trendAoo = trendOf(R, R.A.series, R.years, null);
  var t = R.trendEoo || R.trendAoo;
  R.declineInferred = !!(t && t.declining);
  R.declineBasis = R.declineInferred ? 'inferred (significant decline of the AOH, p < ' + MAS.TREND_ALPHA + ')' : 'not met by default: no significant AOH decline measured (tick it in the Red List tab only with evidence)';
  R.aoh = R.hasB && R.B.series[R.year] ? MAS.habOf(R, R.B.series[R.year]) : NaN;
  R.bounds = MAS.aooBounds(R.aoo.areaKm2, R.aoh, R.cat.eooAdj);
  R.possibly = R.eooCountries.filter(function (c) { return R.recCountries.indexOf(c) < 0; });
  R.assess = R.carriedAssess || {decline: !!R.declineInferred, fluct: false, frag: false};   // IUCN: continuing decline must be observed, estimated, inferred or projected, never assumed
  MAS.progSet('assess', 'ok', MAS.overallCategory(R).code);
  renderAll(R);
  R.rendered = true;
  mapNotice(null);
  MAS.spatialBtn.setDisabled(false); MAS.exportBtn.setDisabled(false);
  MAS.showTab(MAS.CURRENT_TAB === 'Add points' ? 'Add points' : MAS.CURRENT_TAB);
  var msg = 'Done. ' + R.recs.length + ' records, ' + R.productLabel + ', ' + R.y0 + '-' + R.y1 + '.';
  if (!R.hasB && R.eooGeom) msg += '\nEOO statistics failed (' + R.errB + '): raise the EOO scale.';
  if (R.done.C === 'fail') msg += '\nProtected-area analysis failed: ' + R.errC;
  MAS.setStatus(msg, !R.hasB && !!R.eooGeom);
  loadRest(R);
}
