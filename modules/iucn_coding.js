/**** mappingAS GEE 2.0.0 - module "iucn_coding": IUCN data from Earth Engine and coded fields
 * Sections 24-25: elevation, admin units, ecoregions, AOO upper bound; habitat/threat/country coding,
 * narratives and the documentation checklist.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: layout, batch, iucn_calc, run, rangecalc, habitat, utils, config, charts, climate
 * Shared state created here: DEM_ID, GAUL1_ID, GAUL2_ID, ECO_ID, REALM_IUCN, OUT_ELEV
 ****/

// ============================================================================
// 24. IUCN DATA FROM EARTH ENGINE: record elevation, admin units (sub-country occurrence),
//     ecoregions/biomes/realms, centroid checks; AOO upper bound (AOH within a 2 x 2 km grid);
//     land cover in every occupied AOO cell (threat scope, loss of occupied cells)
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.laeaWkt = laeaWkt;
  MAS.demImage = demImage;
  MAS.elevOutImage = elevOutImage;
  MAS.stepRecordInfo = stepRecordInfo;
  MAS.resolveElevation = resolveElevation;
  MAS.runIUCN = runIUCN;
  MAS.parseCells = parseCells;
  MAS.cellSummary = cellSummary;
  MAS.selOn = selOn;
  MAS.countryCoding = countryCoding;
  MAS.subCountry = subCountry;
  MAS.realmsBiomes = realmsBiomes;
  MAS.systemSuggest = systemSuggest;
  MAS.habitatCoding = habitatCoding;
  MAS.scopeLabel = scopeLabel;
  MAS.severityLabel = severityLabel;
  MAS.threatCoding = threatCoding;
  MAS.mostSeriousThreat = mostSeriousThreat;
  MAS.paFacts = paFacts;
  MAS.consInPlace = consInPlace;
  MAS.actionsNeeded = actionsNeeded;
  MAS.researchNeeded = researchNeeded;
  MAS.popTrend = popTrend;
  MAS.checklist = checklist;
  MAS.narratives = narratives;
  MAS.dataSources = dataSources;
};

exports.run = function () {
  MAS.DEM_ID = 'COPERNICUS/DEM/GLO30';
  MAS.GAUL1_ID = 'FAO/GAUL/2015/level1';
  MAS.GAUL2_ID = 'FAO/GAUL/2015/level2';
  MAS.ECO_ID = 'RESOLVE/ECOREGIONS/2017';
  MAS.REALM_IUCN = {Neotropic: 'Neotropical', Afrotropic: 'Afrotropical', Australasia: 'Australasian', Indomalayan: 'Indomalayan',
    Nearctic: 'Nearctic', Oceania: 'Oceanian', Palearctic: 'Palearctic', Antarctica: 'Antarctic'};
  MAS.OUT_ELEV = 999;
};

   // class code of pixels outside the elevation limits in the per-cell histograms
function laeaWkt(lat0, lon0) {
  return 'PROJCS["LAEA data centre",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],' +
    'UNIT["degree",0.0174532925199433]],PROJECTION["Lambert_Azimuthal_Equal_Area"],PARAMETER["latitude_of_center",' + lat0 + '],' +
    'PARAMETER["longitude_of_center",' + lon0 + '],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1]]';
}
function demImage() { return ee.ImageCollection(MAS.DEM_ID).select('DEM').mosaic().rename('elev'); }
function elevOutImage(R) {
  if (!R.elev) return null;
  var d = demImage();
  return d.lt(R.elev.min).or(d.gt(R.elev.max)).unmask(0).toInt().rename('eout');
}
function stepRecordInfo(R, next) {
  MAS.progSet('recinfo', 'run');
  var g1 = ee.FeatureCollection(MAS.GAUL1_ID), g2 = ee.FeatureCollection(MAS.GAUL2_ID), eco = ee.FeatureCollection(MAS.ECO_ID);
  var pts = ee.FeatureCollection(R.all.map(function (r) { return ee.Feature(ee.Geometry.Point([r.lon, r.lat]), {id: r.id}); }));
  var withE = demImage().reduceRegions({collection: pts, reducer: ee.Reducer.first().setOutputs(['elev']), scale: 30, tileScale: 4});
  var cent = R.all.length <= 800;   // centroid distances only for moderate tables (they cost one geometry operation per record)
  var info = withE.map(function (f) {
    var g = f.geometry(), a2 = g2.filterBounds(g), a1 = g1.filterBounds(g), e = eco.filterBounds(g), cn = MAS.lsib.filterBounds(g);
    var f2 = ee.Feature(a2.first()), f1 = ee.Feature(a1.first()), fe = ee.Feature(e.first()), fc = ee.Feature(cn.first());
    var h2 = a2.size().gt(0), h1 = a1.size().gt(0), he = e.size().gt(0), hc = cn.size().gt(0);
    return ee.Feature(null, {id: f.get('id'), elev: ee.Algorithms.If(ee.Algorithms.IsEqual(f.get('elev'), null), -9999, f.get('elev')),
      adm1: ee.Algorithms.If(h2, f2.get('ADM1_NAME'), ee.Algorithms.If(h1, f1.get('ADM1_NAME'), '')),
      adm2: ee.Algorithms.If(h2, f2.get('ADM2_NAME'), ''),
      d2: cent ? ee.Algorithms.If(h2, f2.geometry().centroid(100).distance(g, 10), -1) : -1,
      d1: cent ? ee.Algorithms.If(h1, f1.geometry().centroid(1000).distance(g, 10), -1) : -1,
      d0: cent ? ee.Algorithms.If(hc, fc.geometry().centroid(1000).distance(g, 10), -1) : -1,
      eco: ee.Algorithms.If(he, fe.get('ECO_NAME'), ''), biome: ee.Algorithms.If(he, fe.get('BIOME_NAME'), ''),
      realm: ee.Algorithms.If(he, fe.get('REALM'), '')});
  });
  ee.Dictionary({iucnKind: 'recinfo', v: MAS.fcToDicts(info)}).evaluate(function (res, err) {
    if (MAS.stale(R)) return;
    var byId = {};
    if (err || !res) { R.recInfoErr = String(err); R.warnings.push('Record information (elevation, admin units, ecoregions) failed: ' + err); }
    else MAS.propsList(res.v).forEach(function (p) { byId[p.id] = p; });
    R.all.forEach(function (r) {
      var p = byId[r.id] || {};
      r.elev = isFinite(p.elev) && p.elev > -9000 ? p.elev : NaN;
      r.adm1 = p.adm1 || ''; r.adm2 = p.adm2 || ''; r.eco = p.eco || ''; r.biome = p.biome || ''; r.realm = p.realm || '';
      r.d0 = isFinite(p.d0) ? p.d0 : NaN; r.d1 = isFinite(p.d1) ? p.d1 : NaN; r.d2 = isFinite(p.d2) ? p.d2 : NaN;
    });
    resolveElevation(R);
    MAS.progSet('recinfo', err ? 'fail' : 'ok', err ? String(err).slice(0, 90) :
      (isFinite(R.recElev.min) ? 'elevation ' + Math.round(R.recElev.min) + '-' + Math.round(R.recElev.max) + ' m' : 'no elevation') +
      (R.elev ? ' | AOH ' + Math.round(R.elev.min) + '-' + Math.round(R.elev.max) + ' m' : ''));
    next();
  });
}
function resolveElevation(R) {
  var es = R.recs.map(function (r) { return r.elev; }).filter(function (v) { return isFinite(v); });
  R.recElev = {min: es.length ? Math.min.apply(null, es) : NaN, max: es.length ? Math.max.apply(null, es) : NaN, n: es.length};
  var c = R.cfg, m = c.elevMode || 'NONE';
  R.elev = null;
  if (m === 'TYPED' && (isFinite(c.elevMin) || isFinite(c.elevMax)))
    R.elev = {min: isFinite(c.elevMin) ? c.elevMin : -500, max: isFinite(c.elevMax) ? c.elevMax : 9000, mode: 'typed limits'};
  if (m === 'RECORDS') {
    if (es.length) R.elev = {min: R.recElev.min - c.elevMargin, max: R.recElev.max + c.elevMargin, mode: 'records ± ' + c.elevMargin + ' m'};
    else R.warnings.push('Elevation limits from the records: no elevation available, AOH without elevation limits.');
  }
  R._suitList = null;
}
// ---- background step after the series: AOO upper bound, per-cell land cover, ecoregions and sub-country units in the EOO
function runIUCN(R, done) {
  if (MAS.stale(R)) return;
  MAS.progSet('iucn', 'run');
  R.IU = {done: false, cells: null, aooUpper: NaN, eco: [], adm1Eoo: []};
  var eo = elevOutImage(R), codes = MAS.suitList(R);
  function lulcE(y) { var l = MAS.lulcImage(R, y); return eo ? l.where(eo.eq(1), MAS.OUT_ELEV) : l; }
  var geom = R.eooGeom || R.cellsGeom;
  var jobs = [
    {key: 'cells', make: function (ts) {
      var red = ee.Reducer.frequencyHistogram();
      var fa = lulcE(R.yA).rename('h').reduceRegions({collection: R.cellsFC.select(['cell']), reducer: red, scale: R.scaleAoo, tileScale: ts});
      var fb = lulcE(R.y1).rename('h').reduceRegions({collection: R.cellsFC.select(['cell']), reducer: red, scale: R.scaleAoo, tileScale: ts});
      return ee.Dictionary({iucnKind: 'cells', a: MAS.fcToDicts(fa), b: MAS.fcToDicts(fb)});
    }},
    {key: 'upper', make: function (ts) {
      if (!R.eooGeom || !(R.eooKm2 <= 250000)) return ee.Dictionary({iucnKind: 'upper', n: -1});
      var s = MAS.lulcImage(R, R.year).remap(codes, codes.map(function () { return 1; }), 0);
      if (eo) s = s.and(eo.not());
      // equal-area grid: Lambert azimuthal equal-area centred on the records (the projection of the AOO grid)
      var C = MAS.dataCentre(R.recs), laea = ee.Projection(laeaWkt(C.lat0, C.lon0));
      var pc = ee.Image.pixelCoordinates(laea);
      var cid = pc.select('x').divide(2000).floor().multiply(100000).add(pc.select('y').divide(2000).floor()).rename('cid');
      var base = Math.min(1000, Math.max(R.scaleC || 30, MAS.autoScale(R.eooKm2, 2e7, 30)));
      return ee.Dictionary({iucnKind: 'upper', base: base, n: cid.updateMask(s.selfMask()).reduceRegion({reducer: ee.Reducer.countDistinct(),
        geometry: R.eooGeom, crs: laea, scale: base, maxPixels: 1e13, tileScale: ts}).get('cid')});
    }},
    {key: 'eco', make: function (ts) {
      var eco = ee.FeatureCollection(MAS.ECO_ID).filterBounds(geom), g1 = ee.FeatureCollection(MAS.GAUL1_ID).filterBounds(geom);
      var img = ee.Image(0).int().paint(eco, 'ECO_ID').selfMask();
      return ee.Dictionary({iucnKind: 'eco', id: eco.aggregate_array('ECO_ID'), name: eco.aggregate_array('ECO_NAME'),
        biome: eco.aggregate_array('BIOME_NAME'), realm: eco.aggregate_array('REALM'),
        area: MAS.areaByCode(img, geom, R.eooGeom ? R.scaleC : R.scaleAoo, ts), a1: g1.aggregate_array('ADM1_NAME'), a0: g1.aggregate_array('ADM0_NAME')});
    }}];
  var failed = [];
  MAS.runJobs(R, jobs, function (job, res) {
    if (!res) return;
    if (job.key === 'cells') R.IU.cells = parseCells(R, MAS.propsList(res.a), MAS.propsList(res.b));
    if (job.key === 'upper' && isFinite(res.n) && res.n >= 0) { R.IU.aooUpper = res.n * 4; R.IU.upperBase = res.base; }
    if (job.key === 'eco') {
      var ar = MAS.parseSimple(res.area), n = (res.id || []).length;
      for (var i = 0; i < n; i++) R.IU.eco.push({id: res.id[i], name: (res.name || [])[i] || '', biome: (res.biome || [])[i] || '',
        realm: (res.realm || [])[i] || '', km2: ar[Math.round(res.id[i])] || 0});
      var a1 = res.a1 || [], a0 = res.a0 || [];
      for (var j = 0; j < a1.length; j++) R.IU.adm1Eoo.push({adm0: a0[j] || '', adm1: a1[j]});
    }
  }, function (f) {
    if (MAS.stale(R)) return;
    failed = f;
    R.IU.done = true;
    MAS.progSet('iucn', failed.length ? 'fail' : 'ok', failed.length ? failed.join('; ').slice(0, 100) :
      (R.IU.cells ? R.IU.cells.length + ' cells' : '') + (isFinite(R.IU.aooUpper) ? ' | AOO upper ' + MAS.fmt(R.IU.aooUpper, 0) + ' km²' : ''));
    done();
  });
}
// per-cell histogram -> fractions of AOH, of each class and outside the elevation limits
function parseCells(R, a, b) {
  function one(h) {
    var o = {tot: 0, aoh: 0, cls: {}};
    if (!h) return o;
    for (var k in h) {
      if (!h.hasOwnProperty(k)) continue;
      var c = Number(k), n = h[k];
      if (c === 27 || c === 110) continue;    // not observed
      o.tot += n;
      if (c !== MAS.OUT_ELEV && MAS.isSuit(R, c)) o.aoh += n;
      o.cls[c] = (o.cls[c] || 0) + n;
    }
    return o;
  }
  var byCellB = {};
  b.forEach(function (p) { byCellB[p.cell] = one(p.histogram); });
  return a.map(function (p) {
    var A = one(p.histogram), B = byCellB[p.cell] || {tot: 0, aoh: 0, cls: {}};
    return {cell: p.cell, a: A, b: B, aohA: A.tot ? A.aoh / A.tot : NaN, aohB: B.tot ? B.aoh / B.tot : NaN};
  });
}
function cellSummary(R) {
  var C = R.IU && R.IU.cells;
  if (!C || !C.length) return null;
  var n = C.length, noHab = 0, lost = 0, lowHab = 0, meanA = 0, meanB = 0, k = 0;
  C.forEach(function (c) {
    if (!isFinite(c.aohB)) return;
    k++; meanA += isFinite(c.aohA) ? c.aohA : 0; meanB += c.aohB;
    if (c.aohB < 0.01) noHab++;
    if (c.aohB < 0.01 && c.aohA >= 0.05) lost++;
    if (c.aohB < 0.10) lowHab++;
  });
  return {n: n, valid: k, noHab: noHab, lost: lost, lowHab: lowHab, meanA: k ? 100 * meanA / k : NaN, meanB: k ? 100 * meanB / k : NaN};
}
// ============================================================================
// 25. IUCN CODED FIELDS AND DOCUMENTATION (Required and Recommended Supporting Information;
//     Documentation Standards 2.2-2.8 and 5): countries (presence/origin), sub-country units,
//     realms/biomes/ecoregions, elevation limits, system, habitats, threats (timing/scope/severity,
//     stresses), conservation actions, research needed, population trend, checklist, narratives
// ============================================================================
function selOn(R, key, dflt) { var s = MAS.RL(R).sel; return s.hasOwnProperty(key) ? !!s[key] : !!dflt; }
function countryCoding(R) {
  var since = MAS.RL(R).since, byId = {};
  (R.pts || []).forEach(function (p) { byId[p.id] = p; });
  var rows = R.recCountries.map(function (c) {
    var rs = R.recs.filter(function (r) { return r.country === c; });
    var dated = rs.filter(function (r) { return isFinite(r.year); }), ys = dated.map(function (r) { return r.year; });
    var last = ys.length ? Math.max.apply(null, ys) : NaN;
    var allOld = dated.length === rs.length && rs.length > 0 && last < since;
    var allConv = rs.every(function (r) { var p = byId[r.id]; return p && p.lulc_year !== undefined && p.lulc_year !== null && MAS.legOf(p.lulc_year).group === 'anthropic'; });
    var pres = !allOld ? 1 : allConv ? 4 : 6;
    return {country: c, presence: pres, origin: 1, seasonal: 1, n: rs.length, last: last,
      why: pres === 1 ? (ys.length ? 'records up to ' + last : 'records (undated)') :
        pres === 4 ? 'no record since ' + since + ' and every record is now in converted land' : 'no record since ' + since};
  });
  (R.possibly || []).forEach(function (c) {
    rows.push({country: c, presence: 3, origin: 1, seasonal: 1, n: 0, last: NaN, why: 'crossed by the EOO, no record (code only if suitable habitat exists)'});
  });
  return rows;
}
function subCountry(R) {
  var o = {};
  R.recs.forEach(function (r) { if (!r.adm1) return; var k = r.country + ' | ' + r.adm1; o[k] = o[k] || {country: r.country, adm1: r.adm1, n: 0, presence: 1}; o[k].n++; });
  ((R.IU && R.IU.adm1Eoo) || []).forEach(function (a) {
    var c = MAS.normCountry(a.adm0), k = c + ' | ' + a.adm1;
    if (!o[k]) o[k] = {country: c, adm1: a.adm1, n: 0, presence: 3};
  });
  return Object.keys(o).sort().map(function (k) { return o[k]; });
}
function realmsBiomes(R) {
  var realm = {}, biome = {}, eco = {};
  R.recs.forEach(function (r) {
    if (r.realm) realm[MAS.REALM_IUCN[r.realm] || r.realm] = (realm[MAS.REALM_IUCN[r.realm] || r.realm] || 0) + 1;
    if (r.biome) biome[r.biome] = (biome[r.biome] || 0) + 1;
    if (r.eco) eco[r.eco] = (eco[r.eco] || {n: 0, km2: 0, biome: r.biome}); if (r.eco) eco[r.eco].n++;
  });
  var tot = 0;
  ((R.IU && R.IU.eco) || []).forEach(function (e) { tot += e.km2; });
  ((R.IU && R.IU.eco) || []).forEach(function (e) {
    eco[e.name] = eco[e.name] || {n: 0, km2: 0, biome: e.biome};
    eco[e.name].km2 += e.km2; eco[e.name].pct = tot > 0 ? 100 * eco[e.name].km2 / tot : NaN;
    var rl = MAS.REALM_IUCN[e.realm] || e.realm; if (rl && !realm[rl]) realm[rl] = 0;
  });
  return {realm: realm, biome: biome, eco: Object.keys(eco).sort(function (a, b) { return (eco[b].n - eco[a].n) || ((eco[b].km2 || 0) - (eco[a].km2 || 0)); })
    .map(function (k) { return {name: k, n: eco[k].n, km2: eco[k].km2, pct: eco[k].pct, biome: eco[k].biome}; })};
}
function systemSuggest(R) {
  var byId = {}, w = 0, n = 0;
  (R.pts || []).forEach(function (p) { byId[p.id] = p; });
  R.recs.forEach(function (r) { var p = byId[r.id]; if (!p || p.lulc_year === undefined || p.lulc_year === null) return; n++;
    if (MAS.legOf(p.lulc_year).group === 'water' || [11, 6, 73, 82, 104].indexOf(Number(p.lulc_year)) >= 0) w++; });
  return {terrestrial: true, freshwater: n > 0 && w / n >= 0.3, pctWet: n ? 100 * w / n : NaN};
}
// ---- habitats: from the land cover at the records and the suitable classes of the AOH
function habitatCoding(R) {
  var byId = {}, out = {}, n = 0;
  (R.pts || []).forEach(function (p) { byId[p.id] = p; });
  R.recs.forEach(function (r) {
    var p = byId[r.id];
    if (!p || p.lulc_year === undefined || p.lulc_year === null) return;
    var code = MAS.habitatCodeFor(p.lulc_year, r.lat, r.elev), cls = MAS.legOf(p.lulc_year);
    n++;
    out[code] = out[code] || {code: code, name: MAS.HAB[code] || code, n: 0, classes: {}, suitable: false, anthropic: false};
    out[code].n++; out[code].classes[cls.name] = true;
    if (MAS.isSuit(R, p.lulc_year)) out[code].suitable = true;
    if (cls.group === 'anthropic') out[code].anthropic = true;
  });
  // suitable classes that cover >= 10% of the AOH in the EOO (habitat map), even without records
  var ser = R.hasB ? R.B.series[R.year] : R.A.series[R.year];
  if (ser) {
    var bc = MAS.byCode(ser, R.elev ? {e: 0} : null), tot = 0, lat = R.recs.length ? R.recs[0].lat : NaN, el = R.recElev ? (R.recElev.min + R.recElev.max) / 2 : NaN;
    Object.keys(bc).forEach(function (c) { if (MAS.isSuit(R, c)) tot += bc[c]; });
    Object.keys(bc).forEach(function (c) {
      if (!MAS.isSuit(R, c) || tot <= 0 || bc[c] / tot < 0.1) return;
      var code = MAS.habitatCodeFor(c, lat, el);
      out[code] = out[code] || {code: code, name: MAS.HAB[code] || code, n: 0, classes: {}, suitable: true, anthropic: false};
      out[code].suitable = true; out[code].classes[MAS.legOf(Number(c)).name] = true; out[code].aohPct = (out[code].aohPct || 0) + 100 * bc[c] / tot;
    });
  }
  var natN = 0;
  Object.keys(out).forEach(function (k) { if (out[k].suitable) natN += out[k].n; });
  return Object.keys(out).sort(function (a, b) { return out[b].n - out[a].n; }).map(function (k) {
    var h = out[k];
    h.suitability = h.suitable ? 'Suitable' : h.anthropic ? 'Marginal' : 'Possible';
    h.major = h.suitable && natN > 0 && h.n / natN >= 0.5 ? 'Yes' : h.suitable ? 'No' : '-';
    h.classList = Object.keys(h.classes).join(', ');
    h.key = 'hab:' + h.code;
    h.on = selOn(R, h.key, h.suitable || h.n >= 2);
    return h;
  });
}
// ---- threats (IUCN-CMP 3.3 codes used in SIS; impact scores suspended by IUCN since 2022-2)
function scopeLabel(p) { return !isFinite(p) ? 'Unknown' : p >= 90 ? 'Whole (>90%)' : p >= 50 ? 'Majority (50-90%)' : 'Minority (<50%)'; }
function severityLabel(d) { return !isFinite(d) ? 'Unknown' : d >= 30 ? 'Very rapid declines' : d >= 20 ? 'Rapid declines' : d >= 1 ? 'Slow, significant declines' : d > 0.1 ? 'Negligible declines' : 'No decline'; }
function threatCoding(R) {
  var out = [], W = R.yA !== undefined ? R.y1 - R.yA : 10, cells = R.IU && R.IU.cells, frag = R.assess && R.assess.frag;
  var groups = {};
  if (cells && cells.length) {
    var aoh0 = 0;
    cells.forEach(function (c) { aoh0 += isFinite(c.aohA) ? c.aohA : 0; });
    cells.forEach(function (c) {
      var seen = {};
      Object.keys(c.b.cls).forEach(function (k) {
        var t = MAS.threatCodeFor(k); if (!t) return;
        var fb = c.b.tot ? c.b.cls[k] / c.b.tot : 0, fa = c.a.tot ? (c.a.cls[k] || 0) / c.a.tot : 0;
        var g = groups[t] = groups[t] || {cells: 0, gain: 0, gainIn: 0, aohIn: 0, classes: {}, area: 0};
        g.gain += Math.max(0, fb - fa); g.area += fb; g.classes[MAS.legOf(Number(k)).name] = true;
        if (fb >= 0.05 && !seen[t]) { g.cells++; seen[t] = true; g.aohIn += isFinite(c.aohA) ? c.aohA : 0; }
        if (fb >= 0.05) g.gainIn += Math.max(0, fb - fa);
      });
    });
    Object.keys(groups).forEach(function (t) {
      // scope = share of the occupied cells affected; severity = AOH lost to the driver within the affected cells (SIS definitions)
      var g = groups[t], scope = 100 * g.cells / cells.length, sev = g.aohIn > 0 ? Math.min(100, 100 * g.gainIn / g.aohIn) : NaN;
      if (g.cells === 0 && g.gain <= 0) return;
      var timing = g.gain / cells.length > 0.005 ? 'Ongoing' : 'Past, likely to return';
      out.push({code: t, name: MAS.THREAT[t] ? MAS.THREAT[t][0] : t, v4: MAS.THREAT[t] ? MAS.THREAT[t][1] : '', timing: timing, scope: scopeLabel(scope),
        severity: timing === 'Ongoing' ? severityLabel(sev) : 'Unknown', stresses: ['1.1'].concat(frag ? ['1.3'] : []),
        evidence: 'present (≥ 5%) in ' + MAS.fmt(scope, 0) + '% of the occupied AOO cells in ' + R.y1 + '; in those cells it replaced ' + MAS.fmt(sev, 1) + '% of the AOH of ' + R.yA +
          ' in ' + W + ' years (' + Object.keys(g.classes).join(', ') + ')', basis: 'per-cell land cover'});
    });
  } else if (R.A && R.A.series[R.yA] && R.A.series[R.y1]) {
    var a0 = MAS.byCode(R.A.series[R.yA]), a1 = MAS.byCode(R.A.series[R.y1]), h0 = MAS.habOf(R, R.A.series[R.yA]);
    Object.keys(a1).forEach(function (k) {
      var t = MAS.threatCodeFor(k); if (!t) return;
      var g = groups[t] = groups[t] || {gain: 0, area: 0, classes: {}};
      g.gain += Math.max(0, a1[k] - (a0[k] || 0)); g.area += a1[k]; g.classes[MAS.legOf(Number(k)).name] = true;
    });
    Object.keys(groups).forEach(function (t) {
      var g = groups[t], sev = h0 > 0 ? 100 * g.gain / h0 : NaN;
      out.push({code: t, name: MAS.THREAT[t] ? MAS.THREAT[t][0] : t, v4: MAS.THREAT[t] ? MAS.THREAT[t][1] : '', timing: g.gain > 0 ? 'Ongoing' : 'Past, likely to return',
        scope: 'Unknown', severity: g.gain > 0 ? severityLabel(sev) : 'Unknown', stresses: ['1.1'].concat(frag ? ['1.3'] : []),
        evidence: MAS.fmt(g.area, 2) + ' km² in the AOO in ' + R.y1 + ', +' + MAS.fmt(g.gain, 2) + ' km² since ' + R.yA, basis: 'AOO land-cover totals'});
    });
  }
  ['EOO', 'AOO'].forEach(function (s) {
    if (out.some(function (x) { return x.code === '7.1.1'; })) return;
    var f = R.TH && R.TH.done ? MAS.fireStats(R, s) : null;
    if (f && f.natBurned10 > 0) out.push({code: '7.1.1', name: MAS.THREAT['7.1.1'][0], v4: MAS.THREAT['7.1'][1], timing: 'Ongoing', scope: 'Unknown',
      severity: 'Unknown', stresses: ['1.2', '2.1'], evidence: s + ': ' + MAS.fmtHa(f.natBurned10) + ' of natural vegetation burned in the last 10 years (' +
        MAS.fmt(f.pctHabitatPerYear, 2) + '%/yr; MapBiomas Fire)', basis: 'MapBiomas Fire'});
  });
  out = out.concat(MAS.nicheThreats(R));   // climate threats only from exposure beyond the species' own niche limits
  if (R.SDM && R.SDM.done && R.SDM.redBest >= 1) out.push({code: '11.1', name: MAS.THREAT['11.1'][0], v4: MAS.THREAT['11.1'][1], timing: 'Future', scope: 'Unknown',
    severity: severityLabel(R.SDM.redBest), stresses: ['1.2'], evidence: 'bioclimate model: summed suitability ' + MAS.signed(-R.SDM.redBest, 0, '%') +
      ' by ' + R.SDM.target + ' (range ' + MAS.signed(-R.SDM.redHi, 0, '%') + ' to ' + MAS.signed(-R.SDM.redLo, 0, '%') + ')', basis: 'Bioclimate model tab'});
  out.forEach(function (t) {
    t.major = t.timing === 'Ongoing' && (t.severity === 'Very rapid declines' || t.severity === 'Rapid declines') &&
      (t.scope.indexOf('Whole') === 0 || t.scope.indexOf('Majority') === 0);
    t.key = 'thr:' + t.code; t.on = selOn(R, t.key, true);
    t.stressNames = t.stresses.map(function (k) { return k + ' ' + MAS.STRESS[k]; }).join('; ');
  });
  return out.sort(function (a, b) { return (b.major ? 1 : 0) - (a.major ? 1 : 0) || (a.code < b.code ? -1 : 1); });
}
function mostSeriousThreat(R) {
  var t = threatCoding(R).filter(function (x) { return x.on; });
  return t.length ? t[0] : null;
}
// ---- conservation actions in place / needed, research needed
function paFacts(R) {
  if (!R.wdpa || !R.C || !R.C.recIn) return null;
  var nIn = R.C.recIn.filter(function (p) { return p.n > 0; }).length, cIn = R.C.cellIn.filter(function (p) { return p.n > 0; }).length;
  return {recIn: nIn, rec: R.C.recIn.length, recPct: R.C.recIn.length ? 100 * nIn / R.C.recIn.length : NaN,
    cellIn: cIn, cells: R.C.cellIn.length, cellPct: R.C.cellIn.length ? 100 * cIn / R.C.cellIn.length : NaN,
    names: MAS.uniq([].concat.apply([], R.C.recIn.map(function (p) { return p.names || []; })))};
}
function consInPlace(R) {
  var pa = paFacts(R);
  return [['Occurs in at least one protected area?', pa ? (pa.recIn > 0 ? 'Yes' : 'No') : 'Unknown (PA analysis off)'],
    ['Percentage of records inside protected areas', pa ? MAS.fmt(pa.recPct, 0) + '% (' + pa.recIn + ' of ' + pa.rec + ')' : '-'],
    ['Percentage of the AOO (cells) touching protected areas', pa ? MAS.fmt(pa.cellPct, 0) + '% (' + pa.cellIn + ' of ' + pa.cells + ' cells)' : '-'],
    ['Protected areas with records', pa && pa.names.length ? pa.names.slice(0, 12).join('; ') + (pa.names.length > 12 ? '...' : '') : '-'],
    ['Action recovery plan / area-based management plan / ex-situ / international legislation', 'Unknown - answer in SIS (not derivable from remote sensing)']];
}
function actionsNeeded(R, cat) {
  var pa = paFacts(R), ca = MAS.critA(R), thr = MAS.isThreatened(cat) || cat === 'NT', out = [];
  var plant = MAS.RL(R).kingdom === 'PLANTAE';
  if (pa && pa.cellPct < 50) out.push(['1.1', 'only ' + MAS.fmt(pa.cellPct, 0) + '% of the occupied cells touch a protected area']);
  if (pa && pa.recIn > 0 && thr) out.push(['2.1', 'records inside protected areas; management against the threats coded']);
  if (isFinite(ca.habReduction) && ca.habReduction >= 10) out.push(['2.3', 'AOH reduced ' + MAS.fmt(ca.habReduction, 0) + '% over ' + ca.window + ' years']);
  if (plant && thr) out.push(['3.4.2', 'threatened plant: seed / germplasm bank']);
  if (thr) out.push(['1.2', 'protect the remaining habitat at the occupied sites']);
  return out.map(function (a) { return {code: a[0], name: MAS.CONS_ACTION[a[0]], why: a[1], key: 'act:' + a[0], on: selOn(R, 'act:' + a[0], true)}; });
}
function researchNeeded(R, cat) {
  var r = MAS.RL(R), out = [], fl = MAS.recordFlags(R).filter(function (f) { return f.error; }).length;
  if (!isFinite(r.nBest)) out.push(['1.2', 'population size not known' + (R.recs.length < 10 ? '; only ' + R.recs.length + ' records' : '')]);
  else if (R.recs.length < 10) out.push(['1.2', 'only ' + R.recs.length + ' records']);
  if (!isFinite(MAS.genLength(R).gl)) out.push(['1.3', 'generation length not known (needed for A and C1)']);
  if (threatCoding(R).every(function (t) { return t.basis !== 'per-cell land cover' || t.scope === 'Unknown'; })) out.push(['1.5', 'threats inferred from land cover only']);
  if (fl) out.push(['1.2', fl + ' records with georeferencing problems']);
  if (MAS.isThreatened(cat) || cat === 'NT') { out.push(['3.1', 'baseline for future reassessments']); out.push(['3.4', 'habitat loss is the main evidence']); }
  var seen = {};
  return out.filter(function (a) { if (seen[a[0]]) return false; seen[a[0]] = true; return true; })
    .map(function (a) { return {code: a[0], name: MAS.RESEARCH[a[0]], why: a[1], key: 'res:' + a[0], on: selOn(R, 'res:' + a[0], true)}; });
}
function popTrend(R) {
  var r = MAS.RL(R);
  if (r.popTrend !== 'AUTO') return {trend: r.popTrend, qualifier: 'as stated by the assessor'};
  var t = R.trendEoo || R.trendAoo;
  if (t && t.declining) return {trend: 'Decreasing', qualifier: 'inferred (significant decline of the AOH, ' + MAS.fmt(t.slopePct, 2) + '%/yr)'};
  return {trend: 'Unknown', qualifier: 'no direct population data'};
}
// ---- pre-submission checks (Standards 5.1 and 5.2; Required Supporting Information Tables 1-2)
function checklist(R) {
  var r = MAS.RL(R), ov = MAS.rlCategories(R), cat = ov.category, nonLC = cat !== 'LC' && cat !== 'DD' && cat !== 'NA', out = [];
  function add(ok, txt) { out.push([ok === true ? '✔' : ok === false ? '✖' : '!', txt]); }
  var usesA = ov.met.some(function (m) { return /^A/.test(m); }) || (cat === 'NT' && ov.nearly.some(function (m) { return /^A/.test(m); }));
  var usesC1 = ov.met.some(function (m) { return /^C1|C1\+/.test(m); });
  var usesBa = ov.met.some(function (m) { return /^B.*a/.test(m); });
  add(/^[A-Z][a-z]+ [a-z\-]+/.test(R.cfg.species), 'Scientific name: ' + R.cfg.species);
  add(true, 'Red List category and criteria: ' + ov.code + (ov.low !== ov.high ? ' (plausible ' + ov.high + '-' + ov.low + ')' : ''));
  add(true, 'Rationale drafted with the actual estimates (EOO ' + MAS.fmt(R.eooKm2, 0) + ' km², AOO ' + MAS.fmt(R.aoo.areaKm2, 0) + ' km²) - edit in the Red List tab');
  add(true, 'Countries of occurrence with presence, origin and seasonality codes (' + R.recCountries.length + ' extant)');
  add(true, 'Georeferenced data and distribution map: records, EOO and AOO with IUCN attributes (Downloads)');
  var pt = popTrend(R);
  add(pt.trend !== 'Unknown' ? true : null, 'Current population trend: ' + pt.trend + ' (' + pt.qualifier + ')');
  add(r.sysT || r.sysF || r.sysM, 'System: ' + [r.sysT ? 'Terrestrial' : '', r.sysF ? 'Freshwater' : '', r.sysM ? 'Marine' : ''].filter(String).join(', '));
  var hc = habitatCoding(R).filter(function (h) { return h.on; });
  add(hc.length > 0, 'Habitats coded: ' + hc.map(function (h) { return h.code; }).join(', '));
  var tc = threatCoding(R).filter(function (t) { return t.on; });
  add(nonLC ? tc.length > 0 : true, 'Threats coded' + (nonLC ? ' (required for non-LC/DD)' : '') + ': ' + (tc.length ? tc.map(function (t) { return t.code + (t.major ? '*' : ''); }).join(', ') : 'none'));
  if (r.kingdom === 'PLANTAE') add(r.growthForm !== 'Unknown' && r.growthForm !== '(not a plant)', 'Plant growth form: ' + r.growthForm);
  if (usesA || usesC1) add(isFinite(MAS.genLength(R).gl), 'Generation length (criteria A/C1): ' + MAS.genLength(R).how);
  if (usesA) add(true, 'Reduction: ' + MAS.fmt(ov.A.reduction, 1) + '% over ' + ov.A.window + ' years (' + ov.A.from + '-' + ov.A.to + '), basis ' + ov.A.letters + ', qualifier ' + ov.A.qualifier);
  if (usesBa) add(null, 'Locations (' + R.loc.n + ') must be based on the most serious plausible threat (' + (mostSeriousThreat(R) ? mostSeriousThreat(R).code + ' ' + mostSeriousThreat(R).name : 'none coded') + '), not on collection sites');
  if (usesBa && R.assess.frag) add(null, 'Severe fragmentation used: justify (> 50% of the AOO in small isolated patches; Habitat tab)');
  if (ov.met.some(function (m) { return /D2/.test(m); })) add(r.d2threat, 'D2: plausible threat that could drive the taxon to CR or EX in a very short time');
  if (cat === 'NT') add(ov.nearly.length > 0, 'NT: criteria nearly met recorded (' + ov.nearly.join(', ') + ')');
  add(!(isFinite(R.eooKm2) && R.eooKm2 < R.aoo.areaKm2) || R.cat.eooAdj >= R.aoo.areaKm2, 'EOO ≥ AOO (EOO raised to the AOO when smaller, Guidelines 4.9)');
  if (nonLC) add(true, 'Narratives for geographic range, habitats and threats drafted; population narrative needs your data');
  add(MAS.trim(r.assessors) !== '', 'Assessor(s) named' + (r.assessors ? ': ' + r.assessors : ''));
  add(MAS.trim(r.reviewers) !== '' && MAS.trim(r.reviewers) !== MAS.trim(r.assessors), 'Reviewer(s) named and different from the assessors');
  add(true, 'Bibliography: data sources listed in the report and the supplementary information');
  add(isFinite(R.recElev && R.recElev.min), 'Elevation limits (recommended): ' + (isFinite(R.recElev && R.recElev.min) ? Math.round(R.recElev.min) + '-' + Math.round(R.recElev.max) + ' m' : 'not available'));
  add(Object.keys(realmsBiomes(R).realm).length > 0, 'Biogeographic realm (recommended): ' + Object.keys(realmsBiomes(R).realm).join(', '));
  var fl = MAS.recordFlags(R).filter(function (f) { return f.error && !f.rec.excluded; });
  add(fl.length === 0, fl.length ? fl.length + ' records used have georeferencing errors (ids ' + fl.map(function (f) { return f.id; }).join(', ') + ')' : 'No georeferencing error among the records used');
  return out;
}
// ---- narratives (Standards 2.2: actual estimates, qualifiers, no thresholds)
function narratives(R) {
  var r = MAS.RL(R), ov = MAS.rlCategories(R), ca = ov.A, per = MAS.recordPeriods(R), sp = R.cfg.species.split(' ').slice(0, 2).join(' ');
  var cc = countryCoding(R).filter(function (c) { return c.presence !== 3; }).map(function (c) { return c.country; });
  var adm = MAS.uniq(R.recs.map(function (r2) { return r2.adm1; }).filter(String));
  var th = threatCoding(R).filter(function (t) { return t.on; }), pa = paFacts(R), pt = popTrend(R);
  var hab = habitatCoding(R).filter(function (h) { return h.on && h.suitable; });
  var range = sp + ' is known from ' + R.recs.length + ' georeferenced records (' + R.subpop.nUnique + ' unique localities) in ' + cc.join(', ') +
    (adm.length ? ' (' + adm.join(', ') + ')' : '') + '. ' +
    'Its extent of occurrence (EOO) is ' + MAS.fmt(R.eooKm2, 0) + ' km² (minimum convex polygon around all known occurrences) and its area of occupancy (AOO) is ' +
    MAS.fmt(R.aoo.areaKm2, 0) + ' km² (' + R.aoo.n + ' cells of a ' + R.cfg.aooKm + ' x ' + R.cfg.aooKm + ' km grid). ' +
    'The AOO is a minimum estimate; the area of suitable habitat (' + MAS.aohLabel(R) + ') within the EOO bounds the AOO at ' + MAS.fmt(MAS.aooUpper(R), 0) + ' km². ' +
    (isFinite(R.recElev && R.recElev.min) ? 'Records lie between ' + Math.round(R.recElev.min) + ' and ' + Math.round(R.recElev.max) + ' m elevation. ' : '') +
    'The species is estimated to occur at ' + R.loc.n + ' locations' + (th.length ? ', defined by the most serious plausible threat (' + th[0].name.toLowerCase() + ')' : '') + '. ' +
    (isFinite(per.last) ? 'The most recent record is from ' + per.last + (per.historical.n ? '; ' + per.historical.n + (per.historical.n === 1 ? ' record is' : ' records are') + ' older than ' + per.since : '') + '. ' : '');
  var population = (isFinite(r.nBest) ? 'The population is estimated at ' + MAS.fmt(r.nBest, 0) + ' mature individuals' +
    (isFinite(r.nMin) || isFinite(r.nMax) ? ' (plausible range ' + MAS.fmt(r.nMin, 0) + '-' + MAS.fmt(r.nMax, 0) + ')' : '') + '. ' :
    'There is no information on population size. ') +
    'The current population trend is ' + pt.trend.toLowerCase() + ' (' + pt.qualifier + '). ' +
    (isFinite(ca.reduction) ? 'Based on the loss of its habitat (AOH), the population is ' + (ca.sub === 'A3' ? 'projected' : ca.qualifier) + ' to ' +
      (ca.sub === 'A3' ? 'decline' : 'have declined') + ' by ' + MAS.fmt(ca.reduction, 0) + '% (plausible ' + MAS.fmt(ca.redLow, 0) + '-' + MAS.fmt(ca.redHigh, 0) + '%) over ' +
      ca.window + ' years (' + ca.from + '-' + ca.to + (isFinite(MAS.genLength(R).gl) ? ', three generations of ' + MAS.fmt(MAS.genLength(R).gl, 1) + ' years' : '') + ').' : '');
  var habitat = 'The species occurs in ' + (hab.length ? hab.map(function (h) { return h.name.replace(/^[^-]+- /, '').toLowerCase() + ' (' + h.classList + ')'; }).join('; ') : 'natural vegetation') +
    '. Land cover at the records: ' + habitatCoding(R).map(function (h) { return h.n ? h.classList + ' (' + h.n + ')' : ''; }).filter(String).join(', ') + '.';
  var threats = th.length ? th.map(function (t) { return t.name + ' (' + t.timing.toLowerCase() + ', scope ' + t.scope.toLowerCase() + ', ' + t.severity.toLowerCase() + '): ' + t.evidence; }).join('. ') + '.' :
    'No threat could be inferred from land cover, fire or climate data.';
  if (isFinite(ca.habReduction)) threats += ' The AOH ' + (ca.habReduction >= 0 ? 'declined' : 'increased') + ' by ' + MAS.fmt(Math.abs(ca.habReduction), 1) + '% (' + ca.basis + ', ' + ca.from + '-' + ca.to + ').';
  var cons = pa ? (pa.recIn > 0 ? 'The species is recorded in ' + pa.names.length + ' protected areas (' + MAS.fmt(pa.recPct, 0) + '% of the records; ' + pa.names.slice(0, 6).join(', ') + ').' :
    'The species is not known from any protected area.') : 'Protected areas were not analysed.';
  var acts = actionsNeeded(R, ov.category).filter(function (a) { return a.on; });
  if (acts.length) cons += ' Actions needed: ' + acts.map(function (a) { return a.name.replace(/^[^-]+- /, '').toLowerCase(); }).join('; ') + '.';
  var res = researchNeeded(R, ov.category).filter(function (a) { return a.on; });
  if (res.length) cons += ' Research needed: ' + res.map(function (a) { return a.name.replace(/^[^-]+- /, '').toLowerCase(); }).join('; ') + '.';
  var rationale = sp + ' is ' + (MAS.IUCN_CAT_NAME[ov.category] || ov.category).toLowerCase() + ' (' + ov.code + '). ' +
    'Its EOO is ' + MAS.fmt(R.eooKm2, 0) + ' km² and AOO ' + MAS.fmt(R.aoo.areaKm2, 0) + ' km²' + (R.loc ? ', at ' + R.loc.n + ' locations' : '') + '. ' +
    (R.declineInferred ? 'A continuing decline in the area and quality of habitat is inferred from land-cover change. ' : '') +
    (isFinite(ca.reduction) ? 'The AOH-based reduction over ' + ca.window + ' years is ' + MAS.fmt(ca.reduction, 0) + '%. ' : '') +
    (ov.low !== ov.high ? 'Under uncertainty the plausible categories range from ' + ov.low + ' to ' + ov.high + '; ' +
      (r.attitude === 'PRECAUTIONARY' ? 'a precautionary attitude was adopted. ' : r.attitude === 'EVIDENTIARY' ? 'an evidentiary attitude was adopted. ' : 'the best estimate is used. ') : '') +
    (ov.rule ? ov.rule + ' ' : '') + (ov.category === 'NT' && ov.nearly.length ? 'Criteria nearly met: ' + ov.nearly.join(', ') + '. ' : '');
  var use = r.useTrade === MAS.USE_TRADE[1] ? 'The species is not known to be utilized.' : r.useTrade === MAS.USE_TRADE[2] ? 'The species is utilized (add the details).' : 'No information on use and trade.';
  return {range: range, population: population, habitat: habitat, threats: threats, conservation: cons, useTrade: use, rationale: rationale};
}
function dataSources(R) {
  var out = ['Occurrence records: ' + (R.cfg.kind === 'asset' ? R.cfg.assetId : R.cfg.kind === 'pasted' ? 'table supplied by the assessor' : MAS.EXAMPLE_NAME) + '.',
    'Land cover: ' + R.order.map(function (s) { return s.label + ' (' + s.id + ')'; }).join('; ') + '.',
    'Protected areas: UNEP-WCMC & IUCN, World Database on Protected Areas (WCMC/WDPA/current).',
    'Country boundaries: US Department of State, LSIB simplified 2017. Sub-national units: FAO GAUL 2015.',
    'Elevation: Copernicus GLO-30 DEM. Ecoregions: Dinerstein et al. 2017 (RESOLVE Ecoregions 2017).',
    'Climate: TerraClimate (Abatzoglou et al. 2018), ERA5-Land, NASA NEX-GDDP-CMIP6, NOAA ONI; WorldClim 1.4 (Hijmans et al. 2005).',
    'Climatic niche exposure: Trisos, C.H., Merow, C. & Pigot, A.L. 2020. The projected timing of abrupt ecological disruption from climate change. Nature 580: 496-501.',
    'Signal-to-noise of climate change: Hawkins, E. & Sutton, R. 2012. Time of emergence of climate signals. Geophysical Research Letters 39: L01702.',
    'IUCN. 2012. IUCN Red List Categories and Criteria: Version 3.1. Second edition. IUCN, Gland and Cambridge.',
    'IUCN Standards and Petitions Committee. Guidelines for Using the IUCN Red List Categories and Criteria (current version).',
    'IUCN. 2013. Documentation standards and consistency checks for IUCN Red List assessments and species accounts. Version 2.',
    'Brooks, T.M. et al. 2019. Measuring terrestrial Area of Habitat (AOH) and its utility for the IUCN Red List. Trends in Ecology & Evolution 34: 977-986.'];
  if (R.cfg.doThreats) out.splice(2, 0, 'Fire and deforestation: MapBiomas Fire and MapBiomas Deforestation and Secondary Vegetation collections.');
  return out;
}
