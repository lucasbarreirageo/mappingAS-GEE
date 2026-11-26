/**** mappingAS GEE 2.0.0 - module "downloads": downloads, map exports and export tasks
 * Section 14: CSV/GeoJSON links, map layers and Code Editor export tasks.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: tabs, run, utils, config, layout, charts, rasters, rangecalc, habitat
 * Shared state created here: SUMMARY_COLS, LULC_COLS, TRANS_COLS, REC_COLS, PA_COLS
 ****/

// ============================================================================
// 14. DOWNLOADS, MAP EXPORTS AND EXPORT TASKS
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.summaryFC = summaryFC;
  MAS.codeProps = codeProps;
  MAS.serverDicts = serverDicts;
  MAS.statsRows = statsRows;
  MAS.lulcTable = lulcTable;
  MAS.transTableFC = transTableFC;
  MAS.locCellsFC = locCellsFC;
  MAS.clippedLulc = clippedLulc;
  MAS.bboxOf = bboxOf;
  MAS.mapPng = mapPng;
  MAS.mapHtml = mapHtml;
  MAS.buildHtml = buildHtml;
};

exports.run = function () {
  MAS.SUMMARY_COLS = ['species', 'scope', 'country', 'n_records', 'n_unique', 'eoo_km2', 'eoo_part_km2', 'aoo_km2', 'aoo_cells',
    'aoo_cell_km', 'n_locations', 'locations_method', 'loc_grid_km', 'n_subpop', 'subpop_radius_km', 'b1_eoo', 'b2_aoo',
    'size_category', 'category_B', 'code_B', 'subcrit_a', 'subcrit_b', 'subcrit_c', 'decline_basis', 'aoh_km2', 'aoo_upper_km2',
    'b2_range', 'natural_pct_start', 'natural_pct_year', 'natural_pct_eoo_start', 'natural_pct_eoo_year',
    'habitat_trend_eoo_pct_yr', 'habitat_trend_eoo_p', 'habitat_trend_aoo_pct_yr', 'habitat_trend_aoo_p',
    'pa_records_pct', 'pa_aoo_cells', 'pa_aoo_pct', 'pa_eoo_pct', 'pa_eoo_km2', 'pa_natural_eoo_pct', 'pa_n_eoo',
    'year_start', 'year_end', 'year_land_cover', 'product', 'eoo_scale_m', 'wdpa', 'country_mode'];
  MAS.LULC_COLS = ['scope', 'country', 'protection', 'year', 'code', 'class', 'group', 'area_km2', 'area_ha', 'scale_m'];
  MAS.TRANS_COLS = ['scope', 'country', 'protection', 'year_start', 'year_end', 'from_code', 'from_class', 'from_group',
    'to_code', 'to_class', 'to_group', 'area_km2', 'area_ha', 'scale_m'];
  MAS.REC_COLS = ['id', 'collector', 'number', 'country_declared', 'country_coord', 'country', 'mismatch', 'excluded', 'source',
    'lulc_start', 'lulc_year', 'product', 'protection'];
  MAS.PA_COLS = ['name', 'designation', 'iucn_cat', 'status', 'status_year', 'iso3', 'wdpaid', 'marine', 'n_records',
    'aoo_cells', 'overlap_eoo_km2'];
  // ---- EOO/AOO spatial downloads (left panel)
  MAS.spatialBtn.onClick(function () {
    var R = MAS.APP.current;
    if (!R || !R.cellsFC) return;
    var f = MAS.spatialFmtSel.getValue(), pre = MAS.safeName(R.cfg.species), ext = f.toUpperCase();
    MAS.spatialLinks.clear();
    MAS.dlLink(MAS.spatialLinks, 'EOO, total and national (' + ext + ')', R.hullsFC, f, pre + '_EOO');
    MAS.dlLink(MAS.spatialLinks, 'AOO cells (' + ext + ')', R.cellsFC, f, pre + '_AOO_cells');
    if (R.loc.cells && R.loc.cells.length) MAS.dlLink(MAS.spatialLinks, 'Location cells (' + ext + ')', locCellsFC(R), f, pre + '_location_cells');
    MAS.dlLink(MAS.spatialLinks, 'Records (' + ext + ')', R.recsFC.select(['id', 'collector', 'number', 'country_declared', 'country_coord',
      'country', 'mismatch', 'excluded', 'source']), f, pre + '_records');
    var sp = MAS.subpopFC(R);
    if (sp) MAS.dlLink(MAS.spatialLinks, 'Subpopulations, circles of ' + MAS.fmt(R.subpop.radiusKm, 1) + ' km merged (' + ext + ')', sp, f, pre + '_subpopulations');
    if (R.wdpaFC) MAS.dlLink(MAS.spatialLinks, 'Protected areas intersecting the ' + (R.eooGeom ? 'EOO' : 'AOO') + ' (' + ext + ', simplified 50 m)', MAS.paPolygonsFC(R), f, pre + '_protected_areas');
  });
  // ---- export tasks (Code Editor only)
  MAS.exportBtn.onClick(function () {
    var R = MAS.APP.current;
    if (!R || !R.cellsFC) return;
    var pre = MAS.safeName(R.cfg.species);
    function tbl(fc, name, f, cols) {
      var o = {collection: fc, description: MAS.safeName(pre + '_' + name), folder: MAS.EXPORT_FOLDER, fileNamePrefix: MAS.safeName(pre + '_' + name), fileFormat: f};
      if (cols) o.selectors = cols;
      Export.table.toDrive(o);
    }
    try {
      tbl(summaryFC(R), 'results', 'CSV', MAS.SUMMARY_COLS);
      tbl(R.recsSampled, 'records', 'CSV', MAS.REC_COLS);
      tbl(lulcTable(R, R.scaleX, R.years), 'land_cover_annual', 'CSV', MAS.LULC_COLS);
      tbl(transTableFC(R, R.scaleX), 'transitions', 'CSV', MAS.TRANS_COLS);
      if (R.wdpa) tbl(MAS.paListFC(R, R.eooGeom || R.cellsGeom), 'protected_areas', 'CSV', MAS.PA_COLS);
      tbl(R.cellsFC, 'AOO_cells', 'SHP');
      tbl(R.hullsFC, 'EOO', 'SHP');
      if (R.loc.cells && R.loc.cells.length) tbl(locCellsFC(R), 'location_cells', 'SHP');
      tbl(R.recsFC.select(['id', 'collector', 'number', 'country_declared', 'country_coord', 'country', 'mismatch', 'excluded', 'source']), 'records_points', 'SHP');
      var lulcY = MAS.lulcImage(R, R.year).toUint8();
      MAS.uniq(R.aoo.cells.map(function (c) { return c.country; })).forEach(function (c) {
        var fc = R.cellsFC.filter(ee.Filter.eq('country', c));
        Export.image.toDrive({image: lulcY.clipToCollection(fc), description: MAS.safeName(pre + '_AOO_land_cover_' + R.year + '_' + c),
          folder: MAS.EXPORT_FOLDER, fileNamePrefix: MAS.safeName(pre + '_AOO_land_cover_' + R.year + '_' + c), region: fc.geometry().bounds(),
          scale: R.scaleAoo, crs: 'EPSG:4326', maxPixels: 1e13});
      });
      if (R.eooGeom) {
        Export.image.toDrive({image: lulcY.clip(R.eooGeom), description: MAS.safeName(pre + '_EOO_land_cover_' + R.year),
          folder: MAS.EXPORT_FOLDER, fileNamePrefix: MAS.safeName(pre + '_EOO_land_cover_' + R.year), region: R.eooGeom.bounds(),
          scale: R.scaleX, crs: 'EPSG:4326', maxPixels: 1e13});
      }
      if (R.TH && R.TH.fireSrc && (R.TH.fireYears.length || R.TH.defYears.length)) tbl(MAS.threatsExportFC(R, R.scaleX), 'threats_fire_deforestation', 'CSV', MAS.THREAT_COLS);
      MAS.setStatus('Export tasks created: open the Tasks tab and press Run on each one.');
    } catch (e) {
      MAS.setStatus('Export tasks are not available here (use the download links): ' + (e.message || e), true);
    }
  });
};

function summaryFC(R) {
  var ap = MAS.applied(R);
  var gA0 = MAS.G(R.A.series[R.y0]), gA1 = MAS.G(R.A.series[R.year]);
  var gB0 = R.hasB ? MAS.G(R.B.series[R.y0]) : null, gB1 = R.hasB ? MAS.G(R.B.series[R.year]) : null;
  var pa = R.paSummary || {};
  var base = {species: R.cfg.species, year_start: R.y0, year_end: R.y1, year_land_cover: R.year, product: R.productLabel,
    eoo_scale_m: R.scaleC, wdpa: R.cfg.wdpaMode, country_mode: R.cfg.countryMode, aoo_cell_km: R.cfg.aooKm, loc_grid_km: R.cfg.locKm};
  var rows = [MAS.merge(base, {scope: 'TOTAL', country: 'TOTAL', n_records: R.recs.length, n_unique: R.subpop.nUnique,
    eoo_km2: MAS.round(R.eooKm2, 1), aoo_km2: R.aoo.areaKm2, aoo_cells: R.aoo.n, n_locations: R.loc.n, locations_method: R.loc.method,
    n_subpop: R.subpop.n, subpop_radius_km: MAS.round(R.subpop.radiusKm, 2), b1_eoo: R.cat.b1, b2_aoo: R.cat.b2,
    size_category: R.cat.combined, category_B: ap.category, code_B: ap.code, subcrit_a: ap.a ? 1 : 0, subcrit_b: ap.b ? 1 : 0,
    subcrit_c: ap.c ? 1 : 0, decline_basis: R.assess.decline ? R.declineBasis : 'unchecked',
    aoh_km2: MAS.round(R.aoh, 2), aoo_upper_km2: MAS.round(R.bounds.upper, 2), b2_range: R.bounds.range,
    natural_pct_start: MAS.round(gA0.natPct, 2), natural_pct_year: MAS.round(gA1.natPct, 2),
    natural_pct_eoo_start: gB0 ? MAS.round(gB0.natPct, 2) : null, natural_pct_eoo_year: gB1 ? MAS.round(gB1.natPct, 2) : null,
    habitat_trend_eoo_pct_yr: R.trendEoo ? MAS.round(R.trendEoo.slopePct, 4) : null, habitat_trend_eoo_p: R.trendEoo ? MAS.round(R.trendEoo.p, 5) : null,
    habitat_trend_aoo_pct_yr: R.trendAoo ? MAS.round(R.trendAoo.slopePct, 4) : null, habitat_trend_aoo_p: R.trendAoo ? MAS.round(R.trendAoo.p, 5) : null,
    pa_records_pct: MAS.round(pa.occPct, 2), pa_aoo_cells: isFinite(pa.cellsIn) ? pa.cellsIn : null, pa_aoo_pct: MAS.round(pa.aooPct, 2),
    pa_eoo_pct: MAS.round(pa.eooPct, 2), pa_eoo_km2: MAS.round(pa.eooKm2, 1), pa_natural_eoo_pct: MAS.round(pa.natEoo, 2),
    pa_n_eoo: isFinite(pa.nEoo) ? pa.nEoo : null})];
  R.national.forEach(function (n) {
    var c = [R.cidx[n.country]];
    var a0 = MAS.G(R.A.series[R.y0], {c: c}), a1 = MAS.G(R.A.series[R.year], {c: c});
    var e0 = R.hasB ? MAS.G(R.B.series[R.y0], {c: c}) : null, e1 = R.hasB ? MAS.G(R.B.series[R.year], {c: c}) : null;
    var ein = R.hasB ? MAS.G(R.B.series[R.year], {c: c, p: MAS.PA_IN}) : null;
    rows.push(MAS.merge(base, {scope: 'COUNTRY', country: n.country, n_records: n.n, n_unique: n.nUnique,
      eoo_km2: isFinite(n.eoo) ? MAS.round(n.eoo, 1) : null, eoo_part_km2: e1 ? MAS.round(e1.total, 1) : null, aoo_km2: n.aoo,
      aoo_cells: n.cells, n_locations: n.loc, locations_method: 'grid', b1_eoo: n.cat.b1, b2_aoo: n.cat.b2, size_category: n.cat.combined,
      natural_pct_start: MAS.round(a0.natPct, 2), natural_pct_year: MAS.round(a1.natPct, 2),
      natural_pct_eoo_start: e0 ? MAS.round(e0.natPct, 2) : null, natural_pct_eoo_year: e1 ? MAS.round(e1.natPct, 2) : null,
      pa_eoo_pct: R.wdpa && e1 && e1.total > 0 ? MAS.round(100 * ein.total / e1.total, 2) : null}));
  });
  return ee.FeatureCollection(rows.map(function (r) { return ee.Feature(null, r); }));
}
// ---- long tables (server side): scope x country x protection x year x class
function codeProps(code, prefix, D) {
  var k = ee.Number(code).int().format('%d'), o = {};
  o[prefix + 'code'] = ee.Number(code).int();
  o[prefix + 'class'] = D.LN.get(k, ee.String('Class ').cat(k));
  o[prefix + 'group'] = D.LG.get(k, 'other');
  return o;
}
function serverDicts(R) {
  var ln = {}, lg = {}, cn = {}, pl = {};
  MAS.LEGEND.forEach(function (l) { ln[String(l[0])] = l[1]; lg[String(l[0])] = l[3]; });
  for (var c in R.cname) if (R.cname.hasOwnProperty(c)) cn[String(c)] = R.cname[c];
  MAS.PA_ZONES.forEach(function (z) { pl[String(z)] = MAS.PA_LABEL[z]; });
  return {LN: ee.Dictionary(ln), LG: ee.Dictionary(lg), CN: ee.Dictionary(cn), PL: ee.Dictionary(pl)};
}
function statsRows(D, stats, base, isTrans) {
  function props(code) {
    return isTrans ? ee.Dictionary(codeProps(code.divide(MAS.TCODE).floor(), 'from_', D)).combine(codeProps(code.mod(MAS.TCODE), 'to_', D))
                   : ee.Dictionary(codeProps(code, '', D));
  }
  var groups = ee.List(ee.Dictionary(stats).get('groups'));
  var rows = ee.FeatureCollection(groups.map(function (g) {
    g = ee.Dictionary(g);
    var zone = ee.Number(g.get('zone')).int();
    var zz = zone.mod(MAS.ZONE_ELEV), cidx = zz.divide(10).floor().int(), pz = zz.mod(10).int();
    return ee.FeatureCollection(ee.List(g.get('groups')).map(function (x) {
      x = ee.Dictionary(x);
      var code = ee.Number(x.get('code')).int();
      return ee.Feature(null, ee.Dictionary(base).combine(props(code)).combine({
        country: D.CN.get(cidx.format('%d'), 'Other'), protection: D.PL.get(pz.format('%d'), ''),
        area_km2: x.get('sum'), area_ha: ee.Number(x.get('sum')).multiply(100)})).set('cod', code, 'cpz', code.multiply(10).add(pz));
    }));
  })).flatten();
  function totals(field, make) {
    var gs = ee.List(rows.reduceColumns(ee.Reducer.sum().group({groupField: 1, groupName: 'k'}), ['area_km2', field]).get('groups'));
    return ee.FeatureCollection(gs.map(function (t) { t = ee.Dictionary(t); return make(ee.Number(t.get('k')).int(), t.get('sum')); }));
  }
  var totAll = totals('cod', function (code, a) {
    return ee.Feature(null, ee.Dictionary(base).combine(props(code)).combine({country: 'TOTAL', protection: 'all', area_km2: a, area_ha: ee.Number(a).multiply(100)}));
  });
  var totPa = totals('cpz', function (k, a) {
    return ee.Feature(null, ee.Dictionary(base).combine(props(k.divide(10).floor().int())).combine({country: 'TOTAL',
      protection: D.PL.get(k.mod(10).int().format('%d'), ''), area_km2: a, area_ha: ee.Number(a).multiply(100)}));
  });
  return rows.merge(totPa).merge(totAll);
}
function lulcTable(R, eooScale, years) {
  var D = serverDicts(R), parts = [];
  (years || R.years).forEach(function (y) {
    parts.push(statsRows(D, MAS.areaStats(MAS.lulcImage(R, y), R.zoneAOO, R.cellsGeom, R.scaleAoo, 4), {scope: 'AOO', year: y, scale_m: R.scaleAoo}, false));
    if (R.eooGeom) parts.push(statsRows(D, MAS.areaStats(MAS.lulcImage(R, y), R.zoneEOO, R.eooGeom, eooScale, 8), {scope: 'EOO', year: y, scale_m: eooScale}, false));
  });
  return ee.FeatureCollection(ee.List(parts)).flatten();
}
function transTableFC(R, eooScale) {
  var D = serverDicts(R), parts = [];
  R.periods.forEach(function (p) {
    var b = {year_start: p[0], year_end: p[1]};
    parts.push(statsRows(D, MAS.areaStats(MAS.transImage(R, p[0], p[1]), R.zoneAOO, R.cellsGeom, R.scaleAoo, 4), MAS.merge(b, {scope: 'AOO', scale_m: R.scaleAoo}), true));
    if (R.eooGeom) parts.push(statsRows(D, MAS.areaStats(MAS.transImage(R, p[0], p[1]), R.zoneEOO, R.eooGeom, eooScale, 8), MAS.merge(b, {scope: 'EOO', scale_m: eooScale}), true));
  });
  return ee.FeatureCollection(ee.List(parts)).flatten();
}
function locCellsFC(R) {
  return ee.FeatureCollection((R.loc.cells || []).map(function (c, i) {
    return ee.Feature(ee.Geometry.Polygon([c.ring], null, false), {location_cell: i + 1, n_records: c.recs.length, grid_km: R.cfg.locKm});
  }));
}
// ---- publishable map (PNG)
function clippedLulc(R) {
  var l = MAS.lulcImage(R, R.year);
  if (R.clip === 'AOO' || !R.eooGeom) return l.clipToCollection(R.cellsFC);
  return l.clip(R.eooGeom);
}
function bboxOf(R) {
  var pts = [];
  if (R.hull.ring) pts = MAS.densifyRing(R.hull.ring, 50);
  R.aoo.cells.forEach(function (c) { pts = pts.concat(c.ring); });
  var w = 180, s = 90, e = -180, n = -90;
  pts.forEach(function (p) { w = Math.min(w, p[0]); e = Math.max(e, p[0]); s = Math.min(s, p[1]); n = Math.max(n, p[1]); });
  var dx = Math.max(0.05, (e - w) * 0.04), dy = Math.max(0.05, (n - s) * 0.04);
  return [w - dx, s - dy, e + dx, n + dy];
}
function mapPng(R, panel) {
  panel.clear();
  var b = bboxOf(R), region = ee.Geometry.Rectangle(b, null, false);
  var layers = [ee.Image.constant(1).visualize({palette: ['f4f4f4']}),
    ee.Image().byte().paint(MAS.lsib.filterBounds(region), 1, 1).visualize({palette: ['9e9e9e']}),
    clippedLulc(R).visualize(MAS.VIS)];
  if (R.eooLine) layers.push(R.eooLine.style({color: '000000', width: 2}));
  layers.push(ee.Image().byte().paint(R.cellsFC, 1, 1).visualize({palette: ['c51b7d']}));
  layers.push(R.recsInFC.draw({color: '000000', pointRadius: 3, strokeWidth: 1}));
  var l = ui.Label('preparing PNG...', {fontSize: '13px'}); panel.add(l);
  ee.ImageCollection(layers).mosaic().getThumbURL({region: region, dimensions: 1600, format: 'png', crs: 'EPSG:3857'}, function (url, err) {
    if (url) { l.setValue('Publishable map (PNG) - ' + R.cfg.species + ', land cover ' + R.year); l.setUrl(url); }
    else l.setValue('PNG error: ' + err);
  });
}
// ---- interactive map (HTML, Leaflet): vectors embedded, land-cover overlay from an Earth Engine thumbnail
function mapHtml(R, panel) {
  panel.clear();
  var b = bboxOf(R), region = ee.Geometry.Rectangle(b, null, false);
  var l = ui.Label('preparing HTML...', {fontSize: '13px'}); panel.add(l);
  clippedLulc(R).visualize(MAS.VIS).getThumbURL({region: region, dimensions: 2048, format: 'png', crs: 'EPSG:3857'}, function (url, err) {
    if (!url) { l.setValue('HTML error: ' + err); return; }
    var parsed = R.hasB && R.clip !== 'AOO' ? R.B.series[R.year] : R.A.series[R.year];
    var bc = MAS.byCode(parsed), tot = 0;
    for (var k in bc) if (bc.hasOwnProperty(k)) tot += bc[k];
    var legend = Object.keys(bc).map(Number).sort(function (x, y) { return bc[y] - bc[x]; }).map(function (c) {
      return [MAS.legOf(c).hex, MAS.legOf(c).name, MAS.round(100 * bc[c] / tot, 1)];
    });
    var data = {
      species: R.cfg.species, year: R.year, product: R.productLabel, lulcUrl: url, bounds: [[b[1], b[0]], [b[3], b[2]]],
      eoo: R.hull.ring ? MAS.densifyRing(R.hull.ring, 20).map(function (p) { return [MAS.round(p[1], 6), MAS.round(p[0], 6)]; }) : null,
      cells: R.aoo.cells.map(function (c) { return c.ring.map(function (p) { return [MAS.round(p[1], 6), MAS.round(p[0], 6)]; }); }),
      records: R.all.map(function (r) { return [MAS.round(r.lat, 6), MAS.round(r.lon, 6), r.id, r.collector + ' ' + r.number, r.country, r.excluded ? 1 : 0, r.source]; }),
      legend: legend,
      summary: 'EOO ' + MAS.fmt(R.eooKm2, 0) + ' km² | AOO ' + MAS.fmt(R.aoo.areaKm2, 0) + ' km² | locations ' + R.loc.n + ' | ' + MAS.applied(R).code
    };
    var html = buildHtml(data);
    l.setValue('Download map (HTML) - interactive Leaflet map');
    var b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(html))) : null;
    if (b64) l.setUrl('data:application/octet-stream;base64,' + b64);
    panel.add(ui.Label('If your browser saves the file as "download", rename it to map.html. If the link does not download, ' +
      'copy everything in the box below and save it as a .html file. Records, EOO, AOO cells and legend are embedded; the ' +
      'land-cover image is an Earth Engine link that expires after some hours.', MAS.S.small));
    panel.add(ui.Textbox({value: html, style: {stretch: 'horizontal'}}));
  });
}
function buildHtml(d) {
  var json = JSON.stringify(d).replace(/</g, '\\u003c');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + d.species.replace(/</g, '') + ' - mappingAS GEE</title>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>' +
    '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>' +
    '<style>html,body,#map{height:100%;margin:0}.box{background:#fff;padding:6px 9px;font:12px Arial,sans-serif;border-radius:4px;' +
    'box-shadow:0 0 4px #888;max-height:55vh;overflow:auto}.sw{display:inline-block;width:12px;height:12px;margin-right:5px;' +
    'vertical-align:middle;border:1px solid #999}h4{margin:0 0 4px 0;font-style:italic}</style></head><body><div id="map"></div><script>' +
    'var D=' + json + ';' +
    'var map=L.map("map");' +
    'var osm=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"&copy; OpenStreetMap"}).addTo(map);' +
    'var sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{attribution:"Esri"});' +
    'var lulc=L.imageOverlay(D.lulcUrl,D.bounds,{opacity:0.85}).addTo(map);' +
    'var ov={};ov["Land cover "+D.year]=lulc;' +
    'if(D.eoo){ov["EOO"]=L.polygon(D.eoo,{color:"#000",weight:2,fill:false}).addTo(map);}' +
    'ov["AOO cells"]=L.featureGroup(D.cells.map(function(c){return L.polygon(c,{color:"#c51b7d",weight:1,fillOpacity:0});})).addTo(map);' +
    'ov["Records"]=L.featureGroup(D.records.map(function(r){return L.circleMarker([r[0],r[1]],{radius:4,color:r[5]?"#9e9e9e":(r[6]=="added point"?"#00bcd4":"#000"),' +
    'weight:1,fillOpacity:0.9}).bindPopup("id "+r[2]+"<br>"+r[3]+"<br>"+r[4]+(r[5]?"<br>(excluded)":""));})).addTo(map);' +
    'L.control.layers({"OpenStreetMap":osm,"Esri imagery":sat},ov,{collapsed:false}).addTo(map);' +
    'map.fitBounds(D.bounds);L.control.scale().addTo(map);' +
    'var lg=L.control({position:"bottomleft"});lg.onAdd=function(){var d=L.DomUtil.create("div","box");' +
    'd.innerHTML="<h4>"+D.species+"</h4>"+D.summary+"<br><b>"+D.product+", "+D.year+"</b><br>"+' +
    'D.legend.map(function(x){return "<span class=sw style=background:"+x[0]+"></span>"+x[1]+" ("+x[2]+"%)";}).join("<br>");return d;};lg.addTo(map);' +
    '</script></body></html>';
}
