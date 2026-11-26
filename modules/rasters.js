/**** mappingAS GEE 2.0.0 - module "rasters": raster and extra vector downloads
 * Section 19: GeoTIFF downloads and additional vector files.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: climate, run, habitat, utils, config, layout, charts, rangecalc
 * Shared state created here: RASTER_MAX_BYTES, RASTER_MAX_SIDE
 ****/

// ============================================================================
// 19. RASTER DOWNLOADS (GeoTIFF) and extra vector downloads
//   Direct links (Code Editor and App): ee.Image.getDownloadURL - max 32 MB per request and
//   10000 pixels per side, so the scale is coarsened automatically when the extent is large.
//   Native resolution: Export.image.toDrive task (Code Editor only).
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.rasterProducts = rasterProducts;
  MAS.rasterNotReady = rasterNotReady;
  MAS.rasterSpec = rasterSpec;
  MAS.legendRows = legendRows;
  MAS.extentBox = extentBox;
  MAS.downloadScale = downloadScale;
  MAS.rasterJob = rasterJob;
  MAS.rasterPanel = rasterPanel;
  MAS.subpopFC = subpopFC;
  MAS.paPolygonsFC = paPolygonsFC;
};

exports.run = function () {
  MAS.RASTER_MAX_BYTES = 30e6;
  MAS.RASTER_MAX_SIDE = 9500;
};

function rasterProducts(R) {
  var p = [
    ['lulc', 'Land cover (classes) - one year'],
    ['lulc_all', 'Land cover - all series years (one band per year)'],
    ['group', 'Natural / anthropic / water / other - one year'],
    ['aoh', 'Natural habitat (1/0) - one year (area of habitat)'],
    ['trans', 'Transition ' + R.y0 + ' → ' + R.y1 + ' (natural/anthropic, code = from x 10 + to)'],
    ['pa', 'Protected areas (1 strict Ia-III, 2 sustainable IV-VI, 3 not reported)']
  ];
  // fixed list (the panel is never rebuilt); products that depend on a background step are checked on click
  p.push(['hist', 'Habitat history ' + R.y0 + '-' + R.y1 + ' (status, age class, number of changes)'],
    ['frag', 'Fragmentation, AOO only (edge class, patch class, small-isolated) - one year'],
    ['fire_freq', 'Fire frequency and last year burned (MapBiomas Fire)'],
    ['def_year', 'Year of deforestation of primary vegetation (MapBiomas)'],
    ['clim', 'Climate change (ΔTmax °C, Δprecipitation %, TerraClimate)']);
  p.push(['norm_pr', 'Climate normals 1991-2020: precipitation (12 months + annual, mm)'],
    ['norm_tmx', 'Climate normals 1991-2020: maximum temperature (12 months + annual, °C)'],
    ['norm_tmn', 'Climate normals 1991-2020: minimum temperature (12 months + annual, °C)'],
    ['norm_def', 'Climate normals 1991-2020: water deficit (12 months + annual, mm)'],
    ['cmip', 'CMIP6 projections: ensemble change in Tmax and precipitation (4 scenario-periods, ' + MAS.CMIP_MODELS.length + ' models)']);
  return p;
}
// {img, native (m), bytes per band, bands, nodata, legend rows or null, needsYear}
function rasterNotReady(R, key) {
  if (key === 'fire_freq' || key === 'def_year') {
    if (!R.cfg.doThreats) return 'Turn on "Threats" (left panel, 4b) and run again.';
    if (!R.TH || !R.TH.fireSrc) return 'The threat products are still being checked - try again when the progress panel finishes.';
    if (key === 'fire_freq' && !R.TH.fireSrc.length) return 'No MapBiomas Fire product for ' + R.allCountries.join(', ') + '.';
    if (key === 'def_year' && !R.TH.defSrc.length) return 'No MapBiomas Deforestation product for ' + R.allCountries.join(', ') + '.';
  }
  if (key === 'clim' && !(R.CL && R.CL.years)) return R.cfg.doClimate ? 'Climate is still loading - try again in a moment.' : 'Turn on "Climate" (left panel, 4c) and run again.';
  return null;
}
function rasterSpec(R, key, y) {
  var native = R.scaleAoo;
  var cat = function (img) { return img.unmask(0).toUint8(); };
  if (key === 'lulc') return {img: cat(MAS.lulcImage(R, y)).rename('lulc_' + y), native: native, bytes: 1, nb: 1, nodata: 0, legend: 'lulc', year: true};
  if (key === 'lulc_all') {
    var ys = R.tsYears.filter(function (yy) { return yy >= R.y0 && yy <= R.y1; });
    return {img: ee.Image.cat(ys.map(function (yy) { return cat(MAS.lulcImage(R, yy)).rename('lulc_' + yy); })), native: native, bytes: 1, nb: ys.length,
      nodata: 0, legend: 'lulc', note: ys.length + ' bands (' + ys[0] + '-' + ys[ys.length - 1] + ', series step)'};
  }
  if (key === 'group') return {img: cat(MAS.groupImage(MAS.lulcImage(R, y))).rename('group_' + y), native: native, bytes: 1, nb: 1, nodata: 0, legend: 'group', year: true};
  if (key === 'aoh') return {img: MAS.groupImage(MAS.lulcImage(R, y)).eq(1).unmask(255).toUint8().rename('natural_' + y), native: native, bytes: 1, nb: 1, nodata: 255,
    legend: [[1, 'natural habitat'], [0, 'not natural'], [255, 'no data']], year: true};
  if (key === 'trans') {
    var g0 = MAS.groupImage(MAS.lulcImage(R, R.y0)), g1 = MAS.groupImage(MAS.lulcImage(R, R.y1));
    return {img: g0.multiply(10).add(g1).unmask(0).toUint8().rename('transition_' + R.y0 + '_' + R.y1), native: native, bytes: 1, nb: 1, nodata: 0, legend: 'trans'};
  }
  if (key === 'pa') return {img: R.paImg.unmask(0).toUint8().rename('protected'), native: 30, bytes: 1, nb: 1, nodata: 0,
    legend: [[0, 'outside protected areas'], [1, 'strict protection (IUCN Ia-III)'], [2, 'sustainable use (IUCN IV-VI)'], [3, 'category not reported']]};
  if (key === 'hist') {
    var h = MAS.historyImage(R, R.years);
    return {img: ee.Image.cat([h.divide(100).floor().rename('status'), h.divide(10).floor().mod(10).rename('age_class'), h.mod(10).rename('changes')])
      .unmask(255).toUint8(), native: native, bytes: 1, nb: 3, nodata: 255, legend: 'hist'};
  }
  if (key === 'frag') {
    var f = MAS.fragImage(R, y);
    return {img: ee.Image.cat([f.divide(100).floor().rename('edge_class'), f.divide(10).floor().mod(10).rename('patch_class'), f.mod(10).rename('small_isolated')])
      .unmask(255).toUint8(), native: 30, bytes: 1, nb: 3, nodata: 255, legend: 'frag', year: true, aooOnly: true};
  }
  if (key === 'fire_freq') {
    var fy = R.TH.fireYears;
    var freq = ee.ImageCollection(fy.map(function (yy) { return MAS.fireImage(R.TH.fireSrc, yy).unmask(0).toUint16(); })).sum();
    var last = ee.ImageCollection(fy.map(function (yy) { return MAS.fireImage(R.TH.fireSrc, yy).unmask(0).multiply(yy).toUint16(); })).max();
    return {img: ee.Image.cat([freq.rename('times_burned'), last.rename('last_year_burned')]).updateMask(MAS.countryMask(R, R.TH.fireSrc)).unmask(65535).toUint16(),
      native: 30, bytes: 2, nb: 2, nodata: 65535, legend: [[0, 'never burned / year 0 = never'], [65535, 'no data (country without MapBiomas Fire)']],
      note: 'fire years ' + fy[0] + '-' + fy[fy.length - 1]};
  }
  if (key === 'def_year') {
    var dy = R.TH.defYears;
    var yr = ee.ImageCollection(dy.map(function (yy) { return MAS.defImage(R.TH.defSrc, yy).eq(4).unmask(0).multiply(yy).toUint16(); })).max();
    return {img: yr.updateMask(MAS.countryMask(R, R.TH.defSrc)).unmask(65535).toUint16().rename('year_deforestation_primary'), native: 30, bytes: 2, nb: 1, nodata: 65535,
      legend: [[0, 'no deforestation of primary vegetation'], [65535, 'no data (country without the product)']], note: 'years ' + dy[0] + '-' + dy[dy.length - 1]};
  }
  if (key === 'clim') {
    var CL = R.CL, a = MAS.tcColl().filterDate(CL.y0 + '-01-01', (CL.y0 + CL.n) + '-01-01'), b = MAS.tcColl().filterDate((CL.y1 - CL.n + 1) + '-01-01', (CL.y1 + 1) + '-01-01');
    var dT = b.select('tmmx').mean().subtract(a.select('tmmx').mean()).multiply(0.1).rename('dTmax_C');
    var dP = b.select('pr').mean().subtract(a.select('pr').mean()).divide(a.select('pr').mean()).multiply(100).rename('dPrecip_pct');
    var dD = b.select('def').mean().subtract(a.select('def').mean()).multiply(1.2).rename('dDeficit_mm_yr');   // monthly mean x 12 x 0.1
    return {img: ee.Image.cat([dT, dP, dD]).unmask(-9999).toFloat(), native: MAS.TC_SCALE, bytes: 4, nb: 3, nodata: -9999, legend: null,
      note: CL.y0 + '-' + (CL.y0 + CL.n - 1) + ' vs ' + (CL.y1 - CL.n + 1) + '-' + CL.y1};
  }
  if (key.indexOf('norm_') === 0) {
    var v = key.slice(5), band = {pr: 'pr', tmx: 'tmmx', tmn: 'tmmn', def: 'def'}[v], mul = v === 'pr' ? 1 : 0.1;
    var nc = MAS.tcColl().filterDate('1991-01-01', '2021-01-01').select(band);
    var months = MAS.MONTHS.map(function (n, i) { return nc.filter(ee.Filter.calendarRange(i + 1, i + 1, 'month')).mean().multiply(mul).rename(v + '_' + MAS.pad2(i + 1)); });
    var annual = (v === 'pr' || v === 'def') ? ee.ImageCollection(months).sum() : ee.ImageCollection(months).mean();
    return {img: ee.Image.cat(months.concat([annual.rename(v + '_annual')])).unmask(-9999).toFloat(), native: MAS.TC_SCALE, bytes: 4, nb: 13, nodata: -9999, legend: null,
      note: 'TerraClimate 1991-2020, bands ' + v + '_01 ... ' + v + '_12 and ' + v + '_annual'};
  }
  if (key === 'cmip') {
    var runs = MAS.CMIP_RUNS.slice(1).map(function (r) { return r[0]; });
    var per = MAS.CMIP_MODELS.map(function (m) {
      var im = MAS.cmipImage(m);
      return ee.Image.cat(runs.map(function (r) {
        return ee.Image.cat([im.select(r + '_tx').subtract(im.select('hist_tx')).rename('dTmax_' + r),
          im.select(r + '_pr').subtract(im.select('hist_pr')).divide(im.select('hist_pr')).multiply(100).rename('dPr_' + r)]);
      }));
    });
    var ens = ee.ImageCollection(per).mean();
    var drier = ee.ImageCollection(per.map(function (im) { return im.select(runs.map(function (r) { return 'dPr_' + r; })).lt(0).toFloat(); })).sum()
      .rename(runs.map(function (r) { return 'nDrier_' + r; }));
    return {img: ens.addBands(drier).unmask(-9999).toFloat(), native: MAS.CMIP_SCALE, bytes: 4, nb: 12, nodata: -9999, legend: null,
      note: 'NEX-GDDP-CMIP6 vs 1995-2014; bands dTmax_ (°C), dPr_ (%), nDrier_ (models drier) for s245_mid, s245_end, s585_mid, s585_end (mid = 2041-2060, end = 2081-2100); slow'};
  }
  return null;
}
function legendRows(R, spec) {
  if (!spec.legend) return null;
  if (spec.legend === 'lulc') return Object.keys(MAS.LEG).map(Number).sort(function (a, b) { return a - b; }).map(function (c) { return [c, MAS.LEG[c].name, MAS.LEG[c].hex]; }).concat([[0, 'no data', '']]);
  if (spec.legend === 'group') return MAS.GROUPS.map(function (g, i) { return [i + 1, g, '']; }).concat([[0, 'no data', '']]);
  if (spec.legend === 'trans') {
    var out = [];
    MAS.GROUPS.forEach(function (a, i) { MAS.GROUPS.forEach(function (b, j) { out.push([(i + 1) * 10 + j + 1, a + ' → ' + b, '']); }); });
    return out.concat([[0, 'no data', '']]);
  }
  if (spec.legend === 'hist') return [1, 2, 3, 4, 5, 0].map(function (k) { return [k, 'status: ' + MAS.STATUS[k][0], MAS.STATUS[k][1]]; })
    .concat(MAS.AGE_BINS.map(function (b) { return [b[0], 'age_class: ' + b[1], '']; })).concat(MAS.CHANGE_BINS.map(function (b) { return [b[0], 'changes: ' + b[1], '']; }))
    .concat([[255, 'no data', '']]);
  if (spec.legend === 'frag') return MAS.EDGE_BINS.map(function (b) { return [b[0], 'edge_class: ' + b[1], '']; })
    .concat(MAS.PATCH_BINS.map(function (b) { return [b[0], 'patch_class: ' + b[1], '']; }))
    .concat([[1, 'small_isolated: patch < ' + R.cfg.patchHa + ' ha and > ' + R.cfg.isoM + ' m from a large patch', ''], [0, 'small_isolated: no', ''], [255, 'no data / not natural', '']]);
  return spec.legend.map(function (r) { return [r[0], r[1], '']; });
}
function extentBox(R, ext) {
  var pts = [];
  if (ext === 'EOO' && R.hull && R.hull.ring) pts = R.hull.ring;
  else R.aoo.cells.forEach(function (c) { pts = pts.concat(c.ring); });
  var x0 = 180, x1 = -180, y0 = 90, y1 = -90;
  pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  var pad = 0.01;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  var wKm = (x1 - x0) * 111.32 * Math.cos((y0 + y1) / 2 * Math.PI / 180), hKm = (y1 - y0) * 110.57;
  return {box: [x0, y0, x1, y1], wKm: wKm, hKm: hKm};
}
function downloadScale(spec, b) {
  var s = Math.max(spec.native, b.wKm * 1000 / MAS.RASTER_MAX_SIDE, b.hKm * 1000 / MAS.RASTER_MAX_SIDE,
    Math.sqrt(b.wKm * b.hKm * 1e6 * spec.bytes * spec.nb / MAS.RASTER_MAX_BYTES));
  return s <= spec.native * 1.0001 ? spec.native : Math.ceil(s / 10) * 10;
}
function rasterJob(R, key, y, ext) {
  var nr = rasterNotReady(R, key);
  if (nr) throw new Error(nr);
  if (key === 'frag') ext = 'AOO cells';
  var spec = rasterSpec(R, key, y);
  var b = extentBox(R, ext === 'EOO' ? 'EOO' : 'AOO');
  // coarse climate pixels (4.6 km) are larger than the 2 km AOO cells: keep the whole box instead of clipping to the cells
  var coarse = key === 'clim' || key === 'cmip' || key.indexOf('norm_') === 0;
  var img = ext === 'EOO' ? spec.img.clip(R.eooGeom) : coarse ? spec.img : spec.img.clipToCollection(R.cellsFC);
  img = img.unmask(spec.nodata);
  if (spec.bytes === 1) img = img.toUint8(); else if (spec.bytes === 2) img = img.toUint16(); else img = img.toFloat();
  var name = MAS.safeName(R.cfg.species + '_' + key + (spec.year ? '_' + y : '') + '_' + (ext === 'EOO' ? 'EOO' : 'AOO'));
  return {key: key, y: y, ext: ext, spec: spec, b: b, img: img, name: name};
}
function rasterPanel(R) {
  var c = MAS.TC(), k = MAS.card('Raster downloads (GeoTIFF)');
  var prods = rasterProducts(R);
  var labels = prods.map(function (p) { return p[1]; });
  var prodSel = ui.Select({items: labels, value: labels[0], style: MAS.S.stretch});
  var yrs = MAS.uniq(R.years.concat(R.tsYears)).filter(function (y) { return y >= R.y0 && y <= R.y1; }).sort(function (a, b) { return a - b; }).map(String);
  var yearSel = ui.Select({items: yrs, value: String(R.year), style: {width: '90px'}});
  var exts = (R.eooGeom ? ['EOO'] : []).concat(['AOO cells']);
  var extSel = ui.Select({items: exts, value: exts[0], style: {width: '110px'}});
  var out = ui.Panel();
  function current() { return rasterJob(R, prods[labels.indexOf(prodSel.getValue())][0], Number(yearSel.getValue()), extSel.getValue()); }
  var linkBtn = ui.Button({label: 'Get GeoTIFF link', onClick: function () {
    var q;
    try { q = current(); } catch (e) { out.clear(); out.add(ui.Label('Not available: ' + e.message, {color: '#b30000', fontSize: '12px'})); return; }
    var sc = downloadScale(q.spec, q.b);
    if (q.key === 'frag' && sc > 30) { out.clear(); out.add(ui.Label('The AOO cells are spread over ' + MAS.fmt(q.b.wKm, 0) + ' x ' + MAS.fmt(q.b.hKm, 0) +
      ' km: fragmentation needs 30 m. Use "Export at native resolution" (Code Editor).', {color: '#b30000', fontSize: '12px', whiteSpace: 'pre-wrap'})); return; }
    out.clear();
    var info = ui.Label('Preparing ' + q.name + '.tif at ' + MAS.fmt(sc, 0) + ' m' + (sc > q.spec.native ? ' (native ' + MAS.fmt(q.spec.native, 0) +
      ' m; coarsened so the file stays under the 32 MB limit of direct downloads)' : ' (native resolution)') + '...', {fontSize: '12px', whiteSpace: 'pre-wrap'});
    out.add(info);
    q.img.getDownloadURL({name: q.name, scale: sc, crs: 'EPSG:4326', region: ee.Geometry.Rectangle(q.b.box, null, false), format: 'GEO_TIFF'}, function (url, err) {
      if (err || !url) { info.setValue('Download failed: ' + err + '\nTry the AOO extent or the native-resolution export.'); info.style().set('color', '#b30000'); return; }
      info.setValue(q.name + '.tif - ' + MAS.fmt(sc, 0) + ' m, EPSG:4326, ' + q.spec.nb + ' band(s), no data = ' + q.spec.nodata +
        (q.spec.note ? ', ' + q.spec.note : '') + ((q.key === 'clim' || q.key === 'cmip' || q.key.indexOf('norm_') === 0) && q.ext !== 'EOO' ? '. Whole box around the AOO cells.' : '. Outside the ' + (q.ext === 'EOO' ? 'EOO' : 'AOO cells') + ' = no data.'));
      out.add(ui.Label('⬇ Download ' + q.name + '.tif', {color: '#1a5fb4', fontSize: '12px', fontWeight: 'bold'}, url));
      var lr = legendRows(R, q.spec);
      if (lr) MAS.dlLink(out, 'Legend of the codes (CSV)', MAS.rowsFC([['code', 'number'], ['class', 'string'], ['color', 'string']], lr), 'csv', q.name + '_legend', ['code', 'class', 'color']);
    });
  }});
  var expBtn = ui.Button({label: 'Export at native resolution (Drive)', onClick: function () {
    var q;
    try { q = current(); } catch (e) { MAS.setStatus('Not available: ' + e.message, true); return; }
    try {
      Export.image.toDrive({image: q.img, description: q.name, folder: MAS.EXPORT_FOLDER, fileNamePrefix: q.name, region: ee.Geometry.Rectangle(q.b.box, null, false),
        scale: q.spec.native, crs: 'EPSG:4326', maxPixels: 1e13, fileFormat: 'GeoTIFF'});
      out.clear();
      out.add(ui.Label('Export task "' + q.name + '" created at ' + MAS.fmt(q.spec.native, 0) + ' m: open the Tasks tab (top right) and press Run.', {fontSize: '12px', whiteSpace: 'pre-wrap'}));
    } catch (e2) {
      out.clear();
      out.add(ui.Label('Export tasks only work in the Code Editor (not in a published App).', {color: '#b30000', fontSize: '12px'}));
    }
  }});
  k.add(MAS.cardLabel('Product'));
  k.add(prodSel);
  k.add(ui.Panel([ui.Label('Year', MAS.S.small), yearSel, ui.Label('Extent', MAS.S.small), extSel], ui.Panel.Layout.flow('horizontal')));
  k.add(ui.Panel([linkBtn, expBtn], ui.Panel.Layout.flow('horizontal', true)));
  k.add(MAS.cardLabel('Direct links: GeoTIFF in EPSG:4326, coarsened automatically when the extent is large (limit of 32 MB per file). ' +
    'The Drive export keeps the native resolution (30 m MapBiomas, 10 m Esri, 4.6 km TerraClimate). Each categorical raster comes with a legend CSV. ' +
    'Year is ignored by products that cover the whole period.'));
  k.add(out);
  return k;
}
// ---- extra vectors: subpopulations and protected areas intersecting the EOO
function subpopFC(R) {
  var r = R.subpop && R.subpop.radiusKm;
  if (!isFinite(r) || !(r > 0)) return null;
  var circles = ee.FeatureCollection(MAS.uniqueCoords(R.recs).map(function (p) { return ee.Feature(ee.Geometry.Point(p).buffer(r * 1000, 100)); }));
  var merged = circles.union(100).geometry();
  return ee.FeatureCollection(merged.geometries().map(function (g) {
    var geo = ee.Geometry(g);
    return ee.Feature(geo, {radius_km: r, area_km2: geo.area(100).divide(1e6)});
  })).map(function (f) {
    return f.set('n_records', ee.FeatureCollection(R.recsFC).filterBounds(f.geometry()).size());
  });
}
function paPolygonsFC(R) {
  var within = R.eooGeom || R.cellsGeom;
  return R.wdpaFC.filterBounds(within).map(function (f) {
    return ee.Feature(f.geometry().simplify(50), {name: f.get('NAME'), designation: f.get('DESIG_ENG'), iucn_cat: f.get('IUCN_CAT'),
      status: f.get('STATUS'), status_year: f.get('STATUS_YR'), iso3: f.get('ISO3'), wdpaid: f.get('WDPAID')});
  });
}
