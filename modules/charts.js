/**** mappingAS GEE 2.0.0 - module "charts": charts, tables and MapBiomas-style cards
 * Sections 12 and 12b: chart and table builders, donut cards.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: run, utils, config, rangecalc
 * Shared state created here: COMPARISON_HEADER, TREND_HEADER, DECLINE_HEADER, RF_LAST, COLLECT, HA
 ****/

// ============================================================================
// 12. CHART AND TABLE BUILDERS
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.presentCodes = presentCodes;
  MAS.compositionChart = compositionChart;
  MAS.donutChart = donutChart;
  MAS.classTable = classTable;
  MAS.transTable = transTable;
  MAS.countryComparison = countryComparison;
  MAS.lossGainChart = lossGainChart;
  MAS.protectionChart = protectionChart;
  MAS.naturalByCountryChart = naturalByCountryChart;
  MAS.seriesValue = seriesValue;
  MAS.keyLabel = keyLabel;
  MAS.trendChart = trendChart;
  MAS.trendRows = trendRows;
  MAS.declineRow = declineRow;
  MAS.habitatChart = habitatChart;
  MAS.dlLink = dlLink;
  MAS.rowsFC = rowsFC;
  MAS.colsOf = colsOf;
  MAS.fmtHa = fmtHa;
  MAS.donutData = donutData;
  MAS.donutImage = donutImage;
  MAS.legendGrid = legendGrid;
  MAS.donutCard = donutCard;
  MAS.stackedCard = stackedCard;
};

exports.run = function () {
  MAS.COMPARISON_HEADER = [['Country', 'string'], ['Mapped km²', 'number'], ['% natural', 'number'], ['% converted', 'number'],
    ['Δ natural (pp)', 'number'], ['Loss natural→anthropic km²', 'number'], ['Gain anthropic→natural km²', 'number'], ['% in PAs', 'number']];
  MAS.TREND_HEADER = [['Extent', 'string'], ['Class / group', 'string'], ['Slope (pp/yr)', 'number'], ['R²', 'number'],
    ['p', 'number'], ['First %', 'number'], ['Last %', 'number'], ['Δ (pp)', 'number']];
  MAS.DECLINE_HEADER = [['Extent', 'string'], ['Natural km² (first year)', 'number'], ['Natural km² (last year)', 'number'],
    ['Change (%)', 'number'], ['Change last 10 yr (%)', 'string'], ['Trend (%/yr)', 'number'], ['p', 'number'],
    ['Test years', 'string'], ['Significant decline', 'string']];
  MAS.RF_LAST = null;
  MAS.COLLECT = null;
  // ============================================================================
  // 12b. MAPBIOMAS-STYLE CARDS: two-ring donut (level 1 inside, classes outside) and
  //      stacked columns in hectares. The donut is drawn by Earth Engine as an image.
  // ============================================================================
  MAS.HA = 100;
};

function presentCodes(series, years, sel) {
  var codes = {};
  years.forEach(function (y) {
    if (!series[y]) return;
    var bc = MAS.byCode(series[y], sel);
    for (var c in bc) if (bc.hasOwnProperty(c) && MAS.legOf(Number(c)).group !== 'not_observed' && bc[c] > 0) codes[c] = true;
  });
  return Object.keys(codes).map(Number).sort(function (a, b) { return MAS.CODES.indexOf(a) - MAS.CODES.indexOf(b); });
}
function compositionChart(series, years, detail, title) {
  years = years.filter(function (y) { return series[y]; });
  var header = [['Year', 'string']], rows, colors;
  if (detail === 'Class') {
    var cl = presentCodes(series, years, null);
    header = header.concat(cl.map(function (c) { return [MAS.legOf(c).name, 'number']; }));
    colors = cl.map(function (c) { return MAS.legOf(c).hex; });
    rows = years.map(function (y) {
      var bc = MAS.byCode(series[y]), tot = 0;
      cl.forEach(function (c) { tot += bc[c] || 0; });
      return [String(y)].concat(cl.map(function (c) { return tot > 0 ? 100 * (bc[c] || 0) / tot : 0; }));
    });
  } else {
    var gs = ['natural', 'anthropic', 'water', 'other'];
    header = header.concat(gs.map(function (g) { return [MAS.GROUP_LABEL[g], 'number']; }));
    colors = gs.map(function (g) { return MAS.GROUP_COLOR[g]; });
    rows = years.map(function (y) {
      var g = MAS.G(series[y]), den = g.mapped > 0 ? g.mapped : 1;
      return [String(y)].concat(gs.map(function (k) { return 100 * g[k] / den; }));
    });
  }
  return MAS.mkChart(MAS.dataTable(header, rows), 'AreaChart', {title: title, isStacked: true, lineWidth: 0, areaOpacity: 0.9,
    colors: colors, vAxis: {title: '% of mapped area', viewWindow: {min: 0, max: 100}}, hAxis: {title: 'Year'}, legend: {position: 'right'}});
}
function donutChart(parsed, detail, title) {
  var bc = MAS.byCode(parsed), rows = [], colors = [];
  if (detail === 'Class') {
    Object.keys(bc).map(Number).filter(function (c) { return bc[c] > 0 && MAS.legOf(c).group !== 'not_observed'; })
      .sort(function (a, b) { return bc[b] - bc[a]; }).forEach(function (c) { rows.push([MAS.legOf(c).name, MAS.round(bc[c], 3)]); colors.push(MAS.legOf(c).hex); });
  } else {
    var g = MAS.G(parsed);
    ['natural', 'anthropic', 'water', 'other'].forEach(function (k) { if (g[k] > 0) { rows.push([MAS.GROUP_LABEL[k], MAS.round(g[k], 3)]); colors.push(MAS.GROUP_COLOR[k]); } });
  }
  return MAS.mkChart(MAS.dataTable([['Class', 'string'], ['km²', 'number']], rows), 'PieChart',
    {title: title, pieHole: 0.45, colors: colors, legend: {position: 'right'}, sliceVisibilityThreshold: 0.005});
}
function classTable(parsed) {
  var bc = MAS.byCode(parsed), tot = 0;
  for (var c in bc) if (bc.hasOwnProperty(c)) tot += bc[c];
  return MAS.tableChart([['Code', 'number'], ['Class', 'string'], ['Group', 'string'], ['km²', 'number'], ['%', 'number']],
    Object.keys(bc).map(Number).sort(function (a, b) { return bc[b] - bc[a]; }).map(function (c) {
      return [c > 100 ? c - 100 : c, MAS.legOf(c).name, MAS.GROUP_LABEL[MAS.legOf(c).group], MAS.round(bc[c], 2), MAS.round(100 * bc[c] / tot, 2)];
    }));
}
function transTable(m) {
  var rows = MAS.GROUPS.filter(function (a) { var s = 0; MAS.GROUPS.forEach(function (b) { s += m[a][b]; }); return s > 0; })
    .map(function (a) { return [MAS.GROUP_LABEL[a]].concat(MAS.GROUPS.map(function (b) { return MAS.round(m[a][b], 2); })); });
  return MAS.tableChart([['From \\ To (km²)', 'string']].concat(MAS.GROUPS.map(function (b) { return [MAS.GROUP_LABEL[b], 'number']; })), rows);
}
function countryComparison(R, series, trans, year) {
  var cs = MAS.uniq(MAS.countriesIn(R, series[year] || {}).concat(MAS.countriesIn(R, series[R.y0] || {})));
  return cs.map(function (c) {
    var g0 = MAS.G(series[R.y0], {c: [c]}), g1 = MAS.G(series[year], {c: [c]}), gin = MAS.G(series[year], {c: [c], p: MAS.PA_IN});
    var m = trans ? MAS.transGroups(trans, {c: [c]}) : null;
    return [R.cname[c], MAS.round(g1.mapped, 1), MAS.round(g1.natPct, 1), MAS.round(g1.convPct, 1), MAS.round(g1.natPct - g0.natPct, 2),
      m ? MAS.round(m.natural.anthropic, 2) : null, m ? MAS.round(m.anthropic.natural, 2) : null,
      R.wdpa ? MAS.round(g1.total > 0 ? 100 * gin.total / g1.total : NaN, 1) : null];
  });
}
function lossGainChart(R, trans, title) {
  var rows = [];
  R.periods.forEach(function (p, i) {
    MAS.countriesIn(R, trans[i]).forEach(function (c) {
      var m = MAS.transGroups(trans[i], {c: [c]});
      rows.push([R.cname[c] + ' ' + p[0] + '-' + p[1], m.natural.anthropic, m.anthropic.natural]);
    });
  });
  return MAS.mkChart(MAS.dataTable([['Country and period', 'string'], ['Loss (natural→anthropic)', 'number'],
    ['Gain (anthropic→natural)', 'number']], rows), 'BarChart', {title: title, colors: ['#d7191c', '#1a9641'], hAxis: {title: 'km²'}});
}
function protectionChart(series, years, title) {
  var rows = years.filter(function (y) { return series[y]; }).map(function (y) {
    var gi = MAS.G(series[y], {p: MAS.PA_IN}), go = MAS.G(series[y], {p: MAS.PA_OUT});
    return [String(y), isFinite(gi.natPct) ? gi.natPct : null, isFinite(go.natPct) ? go.natPct : null];
  });
  return MAS.mkChart(MAS.dataTable([['Year', 'string'], ['Inside PAs', 'number'], ['Outside PAs', 'number']], rows), 'LineChart',
    {title: title, colors: ['#006d2c', '#e8a33d'], pointSize: 3, lineWidth: 2, vAxis: {title: '% natural'}, hAxis: {title: 'Year'}});
}
function naturalByCountryChart(R, series, years, title) {
  var cs = [];
  years.forEach(function (y) { if (series[y]) cs = MAS.uniq(cs.concat(MAS.countriesIn(R, series[y]))); });
  var rows = years.filter(function (y) { return series[y]; }).map(function (y) {
    return [String(y)].concat(cs.map(function (c) { var g = MAS.G(series[y], {c: [c]}); return isFinite(g.natPct) ? g.natPct : null; }));
  });
  return MAS.mkChart(MAS.dataTable([['Year', 'string']].concat(cs.map(function (c) { return [R.cname[c], 'number']; })), rows), 'LineChart',
    {title: title, vAxis: {title: '% natural'}, hAxis: {title: 'Year'}, pointSize: 3, lineWidth: 2});
}
function seriesValue(series, y, key) {   // key: 'group:natural' or 'class:3', as % of mapped area
  if (!series[y]) return NaN;
  var bc = MAS.byCode(series[y]), g = MAS.groupTotals(bc);
  if (g.mapped <= 0) return NaN;
  var parts = key.split(':');
  if (parts[0] === 'group') return 100 * g[parts[1]] / g.mapped;
  return 100 * (bc[parts[1]] || 0) / g.mapped;
}
function keyLabel(key) { var p = key.split(':'); return p[0] === 'group' ? MAS.GROUP_LABEL[p[1]] : MAS.legOf(Number(p[1])).name; }
function trendChart(series, years, key, model, title) {
  years = years.filter(function (y) { return series[y]; });
  var ys = years.map(function (y) { return seriesValue(series, y, key); });
  var fit = MAS.fitModel(years, ys, model);
  var rows = years.map(function (y, i) { return [y, isFinite(ys[i]) ? ys[i] : null, fit ? fit.predict(y) : null]; });
  var chart = MAS.mkChart(MAS.dataTable([['Year', 'number'], [keyLabel(key) + ' (%)', 'number'], ['Fitted', 'number']], rows), 'LineChart', {
    title: title, colors: ['#333333', '#d7191c'], hAxis: {title: 'Year', format: '####'}, vAxis: {title: '% of mapped area'},
    series: {0: {lineWidth: 0, pointSize: 5}, 1: {lineWidth: 2, pointSize: 0}}});
  var txt = fit ? fit.equation + '\nR² = ' + fit.r2.toFixed(3) + ', p = ' + fit.p.toPrecision(3) : 'Model could not be fitted (needs ≥ 3 years; exp/power need values > 0).';
  return {chart: chart, text: txt};
}
function trendRows(series, years, extent) {
  years = years.filter(function (y) { return series[y]; });
  var keys = ['group:natural', 'group:anthropic', 'group:water', 'group:other']
    .concat(presentCodes(series, years, null).map(function (c) { return 'class:' + c; }));
  return keys.map(function (k) {
    var ys = years.map(function (y) { return seriesValue(series, y, k); });
    var f = MAS.ols(years.filter(function (y, i) { return isFinite(ys[i]); }), ys.filter(function (v) { return isFinite(v); }));
    return [extent, keyLabel(k), f ? MAS.round(f.slope, 4) : null, f ? MAS.round(f.r2, 3) : null, f ? MAS.round(f.p, 5) : null,
            MAS.round(ys[0], 2), MAS.round(ys[ys.length - 1], 2), MAS.round(ys[ys.length - 1] - ys[0], 2)];
  }).filter(function (r) { return r[5] !== null || r[6] !== null; });
}
// habitat decline numbers shown in the time-series tab
function declineRow(R, series, years, extent, trend) {
  years = years.filter(function (y) { return series[y]; });
  if (!years.length) return [extent, null, null, null, null, null, null, null, 'NA'];
  var first = years[0], last = years[years.length - 1];
  var ref10 = years.filter(function (y) { return y <= last - 10; });
  var y10 = ref10.length ? ref10[ref10.length - 1] : first;
  var h0 = MAS.G(series[first]).habitat, h1 = MAS.G(series[last]).habitat, h10 = MAS.G(series[y10]).habitat;
  return [extent, MAS.round(h0, 2), MAS.round(h1, 2), MAS.round(h0 > 0 ? 100 * (h1 - h0) / h0 : NaN, 2),
    MAS.round(h10 > 0 ? 100 * (h1 - h10) / h10 : NaN, 2) + ' (' + y10 + '-' + last + ')',
    trend ? MAS.round(trend.slopePct, 3) : null, trend ? MAS.round(trend.p, 4) : null, trend ? trend.years.join(', ') : '',
    trend && trend.declining ? 'YES - b(iii)' : 'no'];
}
function habitatChart(series, years, title) {
  years = years.filter(function (y) { return series[y]; });
  var rows = years.map(function (y) { return [String(y), MAS.G(series[y]).habitat]; });
  var h0 = rows.length ? rows[0][1] : NaN, h1 = rows.length ? rows[rows.length - 1][1] : NaN;
  return MAS.mkChart(MAS.dataTable([['Year', 'string'], ['Natural habitat (km²)', 'number']], rows), 'LineChart', {
    title: title + ' - change ' + MAS.fmt(h0 > 0 ? 100 * (h1 - h0) / h0 : NaN, 2) + '%', colors: ['#1f8d49'],
    pointSize: 4, lineWidth: 2, vAxis: {title: 'km²'}, hAxis: {title: 'Year'}});
}
   // complete batch: tables of every tab are collected here instead of creating links
function dlLink(panel, label, fc, format, name, cols) {
  if (MAS.COLLECT) { MAS.COLLECT.push({label: label, name: name, fc: fc, cols: cols, rows: MAS.RF_LAST && MAS.RF_LAST.fc === fc ? MAS.RF_LAST : null}); return; }
  var l = ui.Label('preparing link: ' + label, {fontSize: '13px'}); panel.add(l);
  fc.getDownloadURL(format, cols || null, name, function (url, err) {
    if (url) { l.setValue(label); l.setUrl(url); } else l.setValue(label + ' - error: ' + err);
  });
}
function rowsFC(header, rows) {
  var fc = ee.FeatureCollection(rows.map(function (r) {
    var o = {};
    header.forEach(function (h, i) { o[MAS.safeName(h[0]).toLowerCase()] = r[i]; });
    return ee.Feature(null, o);
  }));
  MAS.RF_LAST = {fc: fc, H: header, rows: rows};
  return fc;
}
function colsOf(header) { return header.map(function (h) { return MAS.safeName(h[0]).toLowerCase(); }); }
   // km2 -> ha
function fmtHa(km2) { return MAS.fmt(km2 * MAS.HA, 0) + ' ha'; }
function donutData(parsed) {
  var bc = MAS.byCode(parsed), tot = 0, lv = {};
  for (var c in bc) if (bc.hasOwnProperty(c) && bc[c] > 0) { tot += bc[c]; var l = MAS.level1Of(Number(c)); lv[l] = (lv[l] || 0) + bc[c]; }
  var inner = Object.keys(lv).sort(function (a, b) { return lv[b] - lv[a]; });
  var outer = [];
  inner.forEach(function (l) {
    Object.keys(bc).map(Number).filter(function (c) { return bc[c] > 0 && MAS.level1Of(c) === l; })
      .sort(function (a, b) { return bc[b] - bc[a]; }).forEach(function (c) { outer.push(c); });
  });
  return {total: tot, level: lv, inner: inner, outer: outer, bc: bc};
}
function donutImage(d) {
  var TWO_PI = 2 * Math.PI;
  var xy = ee.Image.pixelLonLat(), x = xy.select('longitude'), y = xy.select('latitude');
  var r = x.hypot(y), th = x.atan2(y);
  th = th.where(th.lt(0), th.add(TWO_PI));
  function ring(fracs, hexes, r0, r1) {
    var idx = ee.Image.constant(0), acc = 0, sep = ee.Image.constant(0);
    for (var i = 0; i < fracs.length - 1; i++) {
      acc += fracs[i];
      idx = idx.add(th.gte(acc * TWO_PI));
      sep = sep.or(th.subtract(acc * TWO_PI).abs().multiply(r).lt(0.008));
    }
    if (fracs.length > 1) sep = sep.or(th.multiply(r).lt(0.008)).or(th.subtract(TWO_PI).abs().multiply(r).lt(0.008));
    var pal = hexes.map(function (h) { return h.replace('#', ''); });
    if (pal.length === 1) pal = [pal[0], pal[0]];
    return idx.updateMask(r.gte(r0).and(r.lt(r1)).and(sep.not())).visualize({min: 0, max: pal.length - 1, palette: pal});
  }
  var inner = ring(d.inner.map(function (l) { return d.level[l] / d.total; }), d.inner.map(function (l) { return MAS.LEVEL1[l].hex; }), 0.30, 0.60);
  var outer = ring(d.outer.map(function (c) { return d.bc[c] / d.total; }), d.outer.map(function (c) { return MAS.legOf(c).hex; }), 0.63, 0.98);
  return {image: ee.ImageCollection([inner, outer]).mosaic(),
          params: {region: ee.Geometry.Rectangle([-1, -1, 1, 1], null, false), dimensions: 320, format: 'png', crs: 'EPSG:4326'}};
}
function legendGrid(items) {   // items: [hex, value text, name]
  var c = MAS.TC();
  var grid = ui.Panel([], ui.Panel.Layout.flow('horizontal', true), {backgroundColor: c.bg});
  items.forEach(function (it) {
    var dot = ui.Label('', {backgroundColor: it[0], padding: '6px', margin: '4px 6px 0 0', border: '1px solid ' + c.border});
    var val = ui.Label(it[1], {fontWeight: 'bold', fontSize: '12px', color: c.text, backgroundColor: c.bg, margin: '2px 0 0 0'});
    var nm = ui.Label(it[2], {fontSize: '11px', color: c.sub, backgroundColor: c.bg, margin: '0 0 0 22px'});
    grid.add(ui.Panel([ui.Panel([dot, val], ui.Panel.Layout.flow('horizontal'), {backgroundColor: c.bg}), nm], null,
      {width: '250px', backgroundColor: c.bg, margin: '2px 0'}));
  });
  return grid;
}
function donutCard(R, scope, parsed, year) {
  var c = MAS.TC();
  var k = MAS.card('Coverage by class • ' + scope + ' • ' + year);
  if (!parsed) { k.add(MAS.cardLabel('Not available.')); return k; }
  var d = donutData(parsed);
  k.add(MAS.cardRow([ui.Button({label: 'Show on map', onClick: function () { MAS.drawMap(R, scope); }}),
    MAS.cardLabel(R.productLabel + ' · ' + (scope === 'AOO' ? R.scaleAoo : R.scaleC) + ' m')]));
  var dimg = donutImage(d);
  k.add(ui.Thumbnail({image: dimg.image, params: dimg.params, style: {width: '300px', height: '300px', backgroundColor: c.bg, margin: '0 auto'}}));
  k.add(legendGrid(d.inner.map(function (l) {
    return [MAS.LEVEL1[l].hex, fmtHa(d.level[l]) + ' (' + MAS.fmt(100 * d.level[l] / d.total, 1) + '%)', MAS.LEVEL1[l].name];
  })));
  var classes = ui.Panel([], null, {backgroundColor: c.bg});
  k.add(ui.Checkbox({label: 'Show classes (outer ring)', value: false, style: {backgroundColor: c.bg, color: c.sub},
    onChange: function (v) {
      classes.clear();
      if (v) classes.add(legendGrid(d.outer.map(function (cc) {
        return [MAS.legOf(cc).hex, fmtHa(d.bc[cc]) + ' (' + MAS.fmt(100 * d.bc[cc] / d.total, 1) + '%)', MAS.legOf(cc).name];
      })));
    }}));
  k.add(classes);
  var dl = ui.Panel([], null, {backgroundColor: c.bg});
  k.add(dl);
  var pre = MAS.safeName(R.cfg.species) + '_' + scope + '_' + year;
  var li = MAS.cardLabel('preparing image link...'); dl.add(li);
  dimg.image.getThumbURL(dimg.params, function (url, err) {
    if (url) { li.setValue('⬇ Donut image (PNG)'); li.setUrl(url); } else li.setValue('Image error: ' + err);
  });
  var H = [['Level 1', 'string'], ['Class', 'string'], ['Code', 'number'], ['Hectares', 'number'], ['Percent', 'number']];
  var rows = d.outer.map(function (cc) { return [MAS.LEVEL1[MAS.level1Of(cc)].name, MAS.legOf(cc).name, cc > 100 ? cc - 100 : cc, MAS.round(d.bc[cc] * MAS.HA, 2), MAS.round(100 * d.bc[cc] / d.total, 4)]; });
  var ld = MAS.cardLabel('preparing data link...'); dl.add(ld);
  rowsFC(H, rows).getDownloadURL('csv', colsOf(H), pre + '_coverage', function (url, err) {
    if (url) { ld.setValue('⬇ Data (CSV)'); ld.setUrl(url); } else ld.setValue('Data error: ' + err);
  });
  return k;
}
function stackedCard(R, scope, series, years, mode) {
  var c = MAS.TC();
  years = years.filter(function (y) { return series[y]; });
  var k = MAS.card('Coverage time series by class • ' + scope + ' • ' + (years.length ? years[0] + ' - ' + years[years.length - 1] : ''));
  var keys = [], label = {}, color = {};
  if (mode === 'Level 1') {
    Object.keys(MAS.LEVEL1).forEach(function (l) { keys.push(l); label[l] = MAS.LEVEL1[l].name; color[l] = MAS.LEVEL1[l].hex; });
  } else {
    presentCodes(series, years, null).forEach(function (cc) { keys.push(String(cc)); label[cc] = MAS.legOf(cc).name; color[cc] = MAS.legOf(cc).hex; });
  }
  var val = function (bc, key) {
    if (mode !== 'Level 1') return (bc[key] || 0) * MAS.HA;
    var s = 0; for (var cc in bc) if (bc.hasOwnProperty(cc) && MAS.level1Of(Number(cc)) === key) s += bc[cc];
    return s * MAS.HA;
  };
  keys = keys.filter(function (key) { return years.some(function (y) { return val(MAS.byCode(series[y]), key) > 0; }); });
  var rows = years.map(function (y) { var bc = MAS.byCode(series[y]); return [String(y)].concat(keys.map(function (key) { return val(bc, key); })); });
  k.add(MAS.mkChart(MAS.dataTable([['Year', 'string']].concat(keys.map(function (key) { return [label[key], 'number']; })), rows), 'ColumnChart',
    MAS.themed({isStacked: true, bar: {groupWidth: '80%'}, colors: keys.map(function (key) { return color[key]; }), height: 380,
      vAxis: {title: 'Hectares', format: 'short'}, hAxis: {slantedText: true, slantedTextAngle: 90, showTextEvery: years.length > 20 ? 5 : 1},
      legend: {position: 'bottom', maxLines: 5}, chartArea: {left: 60, right: 10, top: 20, bottom: 110}})));
  k.add(MAS.cardLabel('Click the expand icon (⤢) on the chart to download it as PNG, SVG or CSV.'));
  var H = [['Year', 'number'], ['Class', 'string'], ['Level 1', 'string'], ['Group', 'string'], ['Hectares', 'number'], ['Percent', 'number']];
  var out = [];
  years.forEach(function (y) {
    var bc = MAS.byCode(series[y]), tot = 0;
    for (var cc in bc) if (bc.hasOwnProperty(cc)) tot += bc[cc];
    Object.keys(bc).map(Number).forEach(function (cc) {
      out.push([y, MAS.legOf(cc).name, MAS.LEVEL1[MAS.level1Of(cc)].name, MAS.legOf(cc).group, MAS.round(bc[cc] * MAS.HA, 2), MAS.round(100 * bc[cc] / tot, 4)]);
    });
  });
  var ld = MAS.cardLabel('preparing data link...'); k.add(ld);
  rowsFC(H, out).getDownloadURL('csv', colsOf(H), MAS.safeName(R.cfg.species) + '_' + scope + '_coverage_series', function (url, err) {
    if (url) { ld.setValue('⬇ Data (CSV, hectares by class and year)'); ld.setUrl(url); } else ld.setValue('Data error: ' + err);
  });
  return k;
}
