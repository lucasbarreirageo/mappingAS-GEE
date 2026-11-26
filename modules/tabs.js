/**** mappingAS GEE 2.0.0 - module "tabs": result tabs
 * Section 13: Map, Time series, Conversion, Protected areas and Summary tabs.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: layout, run, utils, downloads, report, rasters, charts, records, config, iucn_calc, rangecalc, habitat, climate
 * Shared state created here: -
 ****/

// ============================================================================
// 13. TABS
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.renderMapTab = renderMapTab;
  MAS.renderConversionTab = renderConversionTab;
  MAS.renderPATab = renderPATab;
  MAS.renderTimeSeriesTab = renderTimeSeriesTab;
  MAS.recalcSeries = recalcSeries;
  MAS.applied = applied;
  MAS.methodsLines = methodsLines;
  MAS.renderAssessmentTab = renderAssessmentTab;
};

exports.run = function () {

};

function renderMapTab(R) {
  var T = 'Map';
  MAS.TABS[T].clear();
  MAS.tabHead(T, R.cfg.species);
  MAS.tabNote(T, 'Land cover ' + R.year + ' - ' + R.productLabel + '. The map shows land cover only inside the EOO and/or AOO.');
  var clipSel = ui.Select({items: ['EOO', 'AOO', 'Both'], value: R.clip || 'EOO', onChange: function (v) { MAS.drawMap(R, v); }});
  MAS.tabAdd(T, ui.Panel([ui.Label('Raster clipped to', MAS.S.small), clipSel], ui.Panel.Layout.flow('horizontal')));
  var ap = applied(R);
  MAS.tabNote(T, 'EOO ' + MAS.fmt(R.eooKm2, 0) + ' km² | AOO ' + MAS.fmt(R.aoo.areaKm2, 0) + ' km² | locations ' + R.loc.n +
    ' | subpopulations ' + R.subpop.n + '\nCriterion B: ' + ap.code);
  var parsed = R.hasB ? R.B.series[R.year] : R.A.series[R.year];
  var bc = MAS.byCode(parsed), tot = 0;
  for (var k in bc) if (bc.hasOwnProperty(k)) tot += bc[k];
  var lp = ui.Panel();
  Object.keys(bc).map(Number).sort(function (a, b) { return bc[b] - bc[a]; }).forEach(function (c) {
    lp.add(ui.Panel([ui.Label('', {backgroundColor: MAS.legOf(c).hex, padding: '7px', margin: '2px 6px 2px 0'}),
      ui.Label(MAS.legOf(c).name + ' - ' + MAS.fmt(100 * bc[c] / tot, 1) + '%', {fontSize: '11px', margin: '2px 0'})], ui.Panel.Layout.flow('horizontal')));
  });
  MAS.tabNote(T, 'Legend (classes in the ' + (R.hasB ? 'EOO' : 'AOO') + ', ' + R.year + '):');
  MAS.tabAdd(T, lp);
  MAS.tabHead(T, 'Map downloads');
  var dl = ui.Panel();
  MAS.tabAdd(T, ui.Button({label: 'Publishable map (PNG)', onClick: function () { MAS.mapPng(R, dl); }}));
  MAS.tabAdd(T, ui.Button({label: 'Download map (HTML)', onClick: function () { MAS.mapHtml(R, dl); }}));
  MAS.tabAdd(T, ui.Button({label: 'Full report (HTML, all tabs, printable to PDF)', onClick: function () { MAS.reportDownload(R, dl); }}));
  MAS.tabAdd(T, dl);
  MAS.tabNote(T, 'EOO/AOO, records, locations, subpopulations and protected areas as vector layers: use "Download EOO/AOO (spatial)" in the left panel.');
  MAS.tabAdd(T, MAS.rasterPanel(R));
}
function renderConversionTab(R) {
  var T = 'Conversion', y = R.year;
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'Land-cover conversion in ' + y);
  var lines = [];
  [['EOO', R.hasB ? R.B : null], ['AOO', R.A]].forEach(function (e) {
    if (!e[1]) { lines.push(e[0] + ': not available'); return; }
    var g = MAS.G(e[1].series[y]);
    lines.push(e[0] + ': natural ' + MAS.fmt(g.natPct) + '% | converted (anthropic) ' + MAS.fmt(g.convPct) + '% of the terrestrial area' +
      ' | natural ' + MAS.fmt(g.habitat, 1) + ' km², anthropic ' + MAS.fmt(g.anthropic, 1) + ' km², water ' + MAS.fmt(g.water, 1) +
      ' km², other ' + MAS.fmt(g.other, 1) + ' km²');
  });
  MAS.tabNote(T, lines.join('\n') + (MAS.WATER_DENOM ? '\nWater counted as natural in the denominator.' : ''));
  if (R.hasB) MAS.tabAdd(T, MAS.donutCard(R, 'EOO', R.B.series[y], y));
  MAS.tabAdd(T, MAS.donutCard(R, 'AOO', R.A.series[y], y));
  MAS.tabNote(T, 'Every chart below can be downloaded as PNG, SVG or CSV from its expand icon (⤢).');
  var detail = ui.Select({items: ['Group', 'Class'], value: 'Group'});
  var donuts = ui.Panel();
  function drawDonuts() {
    donuts.clear();
    if (R.hasB) donuts.add(MAS.donutChart(R.B.series[y], detail.getValue(), 'EOO - land-cover composition ' + y));
    donuts.add(MAS.donutChart(R.A.series[y], detail.getValue(), 'AOO - land-cover composition ' + y));
  }
  detail.onChange(drawDonuts);
  MAS.tabAdd(T, ui.Panel([ui.Label('Donut detail', MAS.S.small), detail], ui.Panel.Layout.flow('horizontal')));
  MAS.tabAdd(T, donuts); drawDonuts();
  MAS.tabHead(T, 'Classes');
  if (R.hasB) { MAS.tabNote(T, 'EOO ' + y + ':'); MAS.tabAdd(T, MAS.classTable(R.B.series[y])); }
  MAS.tabNote(T, 'AOO ' + y + ':'); MAS.tabAdd(T, MAS.classTable(R.A.series[y]));
  MAS.tabHead(T, 'By country');
  if (R.hasB) { MAS.tabNote(T, 'EOO (' + R.y0 + ' → ' + y + '):'); MAS.tabAdd(T, MAS.tableChart(MAS.COMPARISON_HEADER, MAS.countryComparison(R, R.B.series, R.B.trans[R.periods.length - 1], y))); }
  MAS.tabNote(T, 'AOO (' + R.y0 + ' → ' + y + '):'); MAS.tabAdd(T, MAS.tableChart(MAS.COMPARISON_HEADER, MAS.countryComparison(R, R.A.series, R.A.trans[R.periods.length - 1], y)));
  MAS.tabHead(T, 'Transitions');
  R.periods.forEach(function (p, i) {
    if (R.hasB) { MAS.tabNote(T, 'EOO ' + p[0] + ' → ' + p[1] + ':'); MAS.tabAdd(T, MAS.transTable(MAS.transGroups(R.B.trans[i]))); }
    MAS.tabNote(T, 'AOO ' + p[0] + ' → ' + p[1] + ':'); MAS.tabAdd(T, MAS.transTable(MAS.transGroups(R.A.trans[i])));
  });
  if (R.hasB) MAS.tabAdd(T, MAS.lossGainChart(R, R.B.trans, 'EOO - loss and gain of natural vegetation (km²)'));
  MAS.tabAdd(T, MAS.lossGainChart(R, R.A.trans, 'AOO - loss and gain of natural vegetation (km²)'));
  MAS.tabHead(T, 'Downloads');
  var dl = ui.Panel(); MAS.tabAdd(T, dl);
  var crow = [];
  [['EOO', R.hasB ? R.B : null], ['AOO', R.A]].forEach(function (e) {
    if (!e[1]) return;
    var bc = MAS.byCode(e[1].series[y]), tot = 0;
    for (var c in bc) if (bc.hasOwnProperty(c)) tot += bc[c];
    Object.keys(bc).map(Number).forEach(function (c) {
      crow.push([e[0], y, c > 100 ? c - 100 : c, MAS.legOf(c).name, MAS.legOf(c).group, MAS.round(bc[c], 4), MAS.round(100 * bc[c] / tot, 4)]);
    });
  });
  var CH = [['Extent', 'string'], ['Year', 'number'], ['Code', 'number'], ['Class', 'string'], ['Group', 'string'], ['km2', 'number'], ['Percent', 'number']];
  MAS.dlLink(dl, 'Classes ' + y + ' (CSV)', MAS.rowsFC(CH, crow), 'csv', MAS.safeName(R.cfg.species) + '_classes_' + y, MAS.colsOf(CH));
  MAS.dlLink(dl, 'Transitions by country and protection (CSV)', MAS.transTableFC(R, R.scaleC), 'csv', MAS.safeName(R.cfg.species) + '_transitions', MAS.TRANS_COLS);
}
function renderPATab(R) {
  var T = 'Protected areas';
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'Protected areas (WDPA)');
  if (!R.wdpa) { MAS.tabNote(T, 'Protected-area analysis is off (option 4 in the left panel).'); return; }
  if (!R.hasC) { MAS.tabNote(T, 'Protected-area analysis failed: ' + R.errC); return; }
  var C = R.C, y = R.year;
  var nRecIn = C.recIn.filter(function (p) { return p.n > 0; }).length, nRec = C.recIn.length;
  var nCellIn = C.cellIn.filter(function (p) { return p.n > 0; }).length, nCell = C.cellIn.length;
  function inPA(D) {
    if (!D) return {};
    var gAll = MAS.G(D.series[y]), gi = MAS.G(D.series[y], {p: MAS.PA_IN});
    return {pct: gAll.total > 0 ? 100 * gi.total / gAll.total : NaN, natTot: gAll.terr > 0 ? 100 * gi.habitat / gAll.terr : NaN,
      altTot: gAll.terr > 0 ? 100 * gi.anthropic / gAll.terr : NaN, natIn: gi.natPct, all: gAll, inn: gi};
  }
  var e = inPA(R.hasB ? R.B : null), a = inPA(R.A);
  R.paSummary = {nRecIn: nRecIn, nRec: nRec, occPct: nRec ? 100 * nRecIn / nRec : NaN, cellsIn: nCellIn,
    aooPct: nCell ? 100 * nCellIn / nCell : NaN, aooKm2: nCellIn * R.cfg.aooKm * R.cfg.aooKm, eooPct: e.pct,
    eooKm2: isFinite(e.pct) ? R.eooKm2 * e.pct / 100 : NaN, nEoo: C.nEoo, natEoo: e.natTot, natAoo: a.natTot};
  MAS.tabNote(T, [
    'Records inside PAs: ' + nRecIn + ' of ' + nRec + ' (' + MAS.fmt(R.paSummary.occPct) + '%)',
    'AOO in PAs: ' + nCellIn + ' of ' + nCell + ' cells touch a PA (' + MAS.fmt(R.paSummary.aooPct) + '%, ' + MAS.fmt(R.paSummary.aooKm2, 0) + ' km²)',
    'EOO in PAs: ' + MAS.fmt(e.pct) + '% (' + MAS.fmt(R.paSummary.eooKm2, 0) + ' km²); ' + C.nEoo + ' PAs touch the EOO',
    'Natural habitat protected in ' + y + ' (% of the terrestrial range): EOO ' + MAS.fmt(e.natTot) + '% | AOO ' + MAS.fmt(a.natTot) + '%',
    'Anthropic land inside PAs (% of the terrestrial range): EOO ' + MAS.fmt(e.altTot) + '% | AOO ' + MAS.fmt(a.altTot) + '%',
    'Natural cover within the PAs themselves: EOO ' + MAS.fmt(e.natIn) + '% | AOO ' + MAS.fmt(a.natIn) + '%',
    'A record or cell is protected when it touches any PA (vector, as mappingAS); areas come from the raster at the analysis scale.'
  ].join('\n'));
  var rows = [];
  [['EOO', e], ['AOO', a]].forEach(function (x) {
    if (!x[1].all) return;
    var t = x[1].all.total || 1, inn = x[1].inn;
    rows.push([x[0], 100 * inn.habitat / t, 100 * inn.anthropic / t, 100 * (inn.total - inn.habitat - inn.anthropic) / t, 100 * (x[1].all.total - inn.total) / t]);
  });
  MAS.tabAdd(T, MAS.mkChart(MAS.dataTable([['Extent', 'string'], ['Inside PAs - natural', 'number'], ['Inside PAs - anthropic', 'number'],
    ['Inside PAs - water/other', 'number'], ['Outside PAs', 'number']], rows), 'BarChart', {
    title: 'Protection of the range in ' + y + ' (% of area)', isStacked: true,
    colors: ['#006d2c', '#e8a33d', '#9ecae1', '#dddddd'], hAxis: {title: '%', viewWindow: {min: 0, max: 100}}}));
  var zrows = [];
  [['EOO', R.hasB ? R.B : null], ['AOO', R.A]].forEach(function (x) {
    if (!x[1]) return;
    var all = MAS.G(x[1].series[y]);
    MAS.PA_ZONES.forEach(function (z) {
      var g = MAS.G(x[1].series[y], {p: [z]});
      zrows.push([x[0], MAS.PA_LABEL[z], MAS.round(g.total, 2), MAS.round(all.total > 0 ? 100 * g.total / all.total : NaN, 2), MAS.round(g.natPct, 1)]);
    });
  });
  MAS.tabAdd(T, MAS.tableChart([['Extent', 'string'], ['Protection', 'string'], ['km²', 'number'], ['% of extent', 'number'], ['% natural', 'number']], zrows));
  if (R.hasB) MAS.tabAdd(T, MAS.protectionChart(R.B.series, R.tsYears, 'EOO - natural cover inside vs outside PAs'));
  MAS.tabAdd(T, MAS.protectionChart(R.A.series, R.years, 'AOO - natural cover inside vs outside PAs'));
  var pl = C.list.slice()
    .sort(function (p, q) { return (q.n_records - p.n_records) || (q.aoo_cells - p.aoo_cells); });
  MAS.tabHead(T, 'Protected areas with records or AOO cells (' + pl.length + ')');
  if (pl.length) {
    MAS.tabAdd(T, MAS.tableChart([['Protected area', 'string'], ['Designation', 'string'], ['IUCN', 'string'], ['Group', 'string'],
      ['ISO3', 'string'], ['Year', 'number'], ['Records', 'number'], ['AOO cells', 'number'], ['EOO overlap km²', 'number']],
      pl.map(function (p) {
        return [String(p.name), String(p.designation), String(p.iucn_cat), MAS.PA_LABEL[MAS.paGroupOf(p.iucn_cat)], String(p.iso3),
          MAS.toNum(p.status_year) || null, p.n_records, p.aoo_cells, MAS.round(p.overlap_eoo_km2, 1)];
      })));
  }
  var recRows = C.recIn.filter(function (p) { return p.n > 0; }).map(function (p) {
    return [p.id, MAS.uniq((p.names || []).map(String)).join('; ')];
  });
  if (recRows.length) { MAS.tabNote(T, 'Records inside protected areas:'); MAS.tabAdd(T, MAS.tableChart([['id', 'number'], ['Protected area(s)', 'string']], recRows)); }
  MAS.tabHead(T, 'Downloads');
  var dl = ui.Panel(); MAS.tabAdd(T, dl);
  MAS.dlLink(dl, 'Protected-area list for the whole EOO (CSV)', MAS.paListFC(R, R.eooGeom || R.cellsGeom), 'csv', MAS.safeName(R.cfg.species) + '_protected_areas', MAS.PA_COLS);
}
function renderTimeSeriesTab(R) {
  var T = 'Time series';
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'Time series ' + R.y0 + '-' + R.y1 + ' (' + R.productLabel + ')');
  var stepBox = ui.Textbox({value: String(R.tsStep), style: {width: '60px'}});
  var detailSel = ui.Select({items: ['Group', 'Class'], value: R.tsDetail || 'Group'});
  var runTs = ui.Button({label: 'Apply step', onClick: function () {
    var st = Math.max(1, Math.round(MAS.toNum(stepBox.getValue()) || 1));
    R.tsDetail = detailSel.getValue();
    recalcSeries(R, st);
  }});
  MAS.tabAdd(T, ui.Panel([ui.Label('Step (years)', MAS.S.small), stepBox, ui.Label('Detail', MAS.S.small), detailSel, runTs], ui.Panel.Layout.flow('horizontal')));
  var aYears = R.tsYears.filter(function (y) { return R.A.series[y]; });
  var eYears = R.tsYears.filter(function (y) { return R.hasB && R.B.series[y]; });
  MAS.tabNote(T, 'EOO at ' + R.scaleC + ' m, AOO at ' + R.scaleAoo + ' m. Charts: expand icon (⤢) to download PNG, SVG or CSV.' +
    '\nSeries every ' + R.tsStep + ' year(s): AOO ' + aYears.length + ' and EOO ' + eYears.length + ' of ' + R.tsYears.length + ' years ready' +
    (R.restDone ? '.' : ' - the remaining years load in the background and this tab refreshes by itself.'));
  var stackMode = ui.Select({items: ['Class', 'Level 1'], value: R.stackMode || 'Class', onChange: function (v) {
    R.stackMode = v; MAS.uiLater(function () { MAS.renderOne(R, 'Time series', renderTimeSeriesTab); }); }});
  MAS.tabAdd(T, ui.Panel([ui.Label('Columns by', MAS.S.small), stackMode], ui.Panel.Layout.flow('horizontal')));
  if (R.hasB) MAS.tabAdd(T, MAS.stackedCard(R, 'EOO', R.B.series, eYears, R.stackMode || 'Class'));
  MAS.tabAdd(T, MAS.stackedCard(R, 'AOO', R.A.series, aYears, R.stackMode || 'Class'));
  if (R.hasB) MAS.tabAdd(T, MAS.compositionChart(R.B.series, eYears, R.tsDetail || 'Group', 'EOO - Extent of Occurrence'));
  MAS.tabAdd(T, MAS.compositionChart(R.A.series, aYears, R.tsDetail || 'Group', 'AOO - Area of Occupancy'));

  MAS.tabHead(T, 'Habitat decline');
  MAS.tabAdd(T, MAS.tableChart(MAS.DECLINE_HEADER, [R.hasB ? MAS.declineRow(R, R.B.series, eYears, 'EOO', R.trendEoo) : null,
    MAS.declineRow(R, R.A.series, aYears, 'AOO', R.trendAoo)].filter(function (r) { return r; })));
  MAS.tabNote(T, 'Natural habitat = natural classes' + (MAS.WATER_DENOM ? ' + water' : '') + '. Trend: linear regression of natural area on ' +
    MAS.TREND_N + ' years over the last ' + MAS.TREND_SPAN + ' (as mappingAS); a negative trend with p < ' + MAS.TREND_ALPHA +
    ' infers continuing decline b(iii).');
  if (R.hasB) MAS.tabAdd(T, MAS.habitatChart(R.B.series, eYears, 'EOO - natural habitat'));
  MAS.tabAdd(T, MAS.habitatChart(R.A.series, aYears, 'AOO - natural habitat'));
  if (R.wdpa) {
    if (R.hasB) MAS.tabAdd(T, MAS.protectionChart(R.B.series, eYears, 'EOO - natural cover inside vs outside PAs'));
    MAS.tabAdd(T, MAS.protectionChart(R.A.series, aYears, 'AOO - natural cover inside vs outside PAs'));
  }
  if (R.hasB) MAS.tabAdd(T, MAS.naturalByCountryChart(R, R.B.series, eYears, 'EOO - natural cover by country'));
  MAS.tabAdd(T, MAS.naturalByCountryChart(R, R.A.series, aYears, 'AOO - natural cover by country'));

  MAS.tabHead(T, 'Composition (%) by year');
  var comp = [];
  [['EOO', R.hasB ? R.B : null, eYears], ['AOO', R.A, aYears]].forEach(function (e) {
    if (!e[1]) return;
    e[2].forEach(function (y) {
      var g = MAS.G(e[1].series[y]), d = g.mapped || 1;
      comp.push([e[0], y, MAS.round(100 * g.natural / d, 2), MAS.round(100 * g.anthropic / d, 2), MAS.round(100 * g.water / d, 2),
                 MAS.round(100 * g.other / d, 2), MAS.round(g.natural, 2), MAS.round(g.anthropic, 2)]);
    });
  });
  var COMP_H = [['Extent', 'string'], ['Year', 'number'], ['Natural %', 'number'], ['Anthropic %', 'number'], ['Water %', 'number'],
    ['Other %', 'number'], ['Natural km2', 'number'], ['Anthropic km2', 'number']];
  MAS.tabAdd(T, MAS.tableChart(COMP_H, comp));

  MAS.tabHead(T, 'Trend analysis');
  var keys = ['group:natural', 'group:anthropic', 'group:water', 'group:other']
    .concat(MAS.presentCodes(R.A.series, aYears, null).concat(R.hasB ? MAS.presentCodes(R.B.series, eYears, null) : [])
      .filter(function (c, i, a) { return a.indexOf(c) === i; }).map(function (c) { return 'class:' + c; }));
  var classSel = ui.Select({items: keys.map(function (k) { return {label: MAS.keyLabel(k), value: k}; }), value: 'group:natural'});
  var modelSel = ui.Select({items: [{label: 'Linear (line2P)', value: 'line2P'}, {label: 'Quadratic (line3P)', value: 'line3P'},
    {label: 'Logarithmic (log2P)', value: 'log2P'}, {label: 'Exponential (exp2P)', value: 'exp2P'},
    {label: 'Power (power2P)', value: 'power2P'}], value: 'line2P'});
  var trendPanel = ui.Panel();
  function drawTrend() {
    trendPanel.clear();
    [['EOO', R.hasB ? R.B : null, eYears], ['AOO', R.A, aYears]].forEach(function (e) {
      if (!e[1]) return;
      var t = MAS.trendChart(e[1].series, e[2], classSel.getValue(), modelSel.getValue(), e[0] + ' - ' + MAS.keyLabel(classSel.getValue()));
      trendPanel.add(t.chart);
      trendPanel.add(ui.Label(t.text, {fontSize: '12px', whiteSpace: 'pre-wrap'}));
    });
  }
  classSel.onChange(drawTrend); modelSel.onChange(drawTrend);
  MAS.tabAdd(T, ui.Panel([ui.Label('Class / group', MAS.S.small), classSel], ui.Panel.Layout.flow('horizontal')));
  MAS.tabAdd(T, ui.Panel([ui.Label('Regression model', MAS.S.small), modelSel], ui.Panel.Layout.flow('horizontal')));
  MAS.tabAdd(T, trendPanel); drawTrend();
  MAS.tabNote(T, 'Linear trend per class and group (percentage points per year):');
  var tr = (R.hasB ? MAS.trendRows(R.B.series, eYears, 'EOO') : []).concat(MAS.trendRows(R.A.series, aYears, 'AOO'));
  MAS.tabAdd(T, MAS.tableChart(MAS.TREND_HEADER, tr));
  MAS.tabHead(T, 'Downloads');
  var dl = ui.Panel(); MAS.tabAdd(T, dl);
  MAS.dlLink(dl, 'Composition by year (CSV)', MAS.rowsFC(COMP_H, comp), 'csv', MAS.safeName(R.cfg.species) + '_series', MAS.colsOf(COMP_H));
  MAS.dlLink(dl, 'Trend table (CSV)', MAS.rowsFC(MAS.TREND_HEADER, tr), 'csv', MAS.safeName(R.cfg.species) + '_trends', MAS.colsOf(MAS.TREND_HEADER));
  MAS.dlLink(dl, 'Annual land cover by country and protection, all classes (CSV)', MAS.lulcTable(R, R.scaleC, R.tsYears), 'csv',
    MAS.safeName(R.cfg.species) + '_land_cover_series', MAS.LULC_COLS);
}
function recalcSeries(R, step) {
  R.tsStep = step; R.tsYears = MAS.seriesYears(R, step);
  MAS.stepBox.setValue(String(step));
  MAS.renderOne(R, 'Time series', renderTimeSeriesTab); MAS.showTab('Time series');
  MAS.setStatus('Loading the series every ' + step + ' year(s)...');
  MAS.PROG.running = true;
  if (MAS.PROG.timer === null && ui.util && ui.util.setInterval) MAS.PROG.timer = ui.util.setInterval(MAS.progTick, 500);
  MAS.loadRest(R);
}
function applied(R) { return MAS.critB(R); }
   // Criterion B with the sub-criteria chosen here and in the Red List tab
function methodsLines(R) {
  return [
    'Data: ' + R.recs.length + ' records of ' + R.cfg.species + ' (' + (R.cfg.kind === 'asset' ? R.cfg.assetId : R.cfg.kind === 'pasted' ? 'pasted table' : 'built-in example') + ')' +
      (MAS.APP.manual.filter(function (m) { return m.species === R.cfg.species; }).length ? ' including added points' : ''),
    'AOO: ' + R.cfg.aooKm + ' km grid in a data-centred Lambert azimuthal equal-area projection; minimum of ' + MAS.AOO_N_GRIDS + ' shifted grids.',
    'EOO: minimum convex polygon with great-circle edges (' + MAS.EOO_SEGMENT_KM + ' km), area in the equal-area projection.',
    'Locations: ' + R.cfg.locKm + ' km grid (minimum of ' + MAS.AOO_N_GRIDS + ' grids)' + (R.wdpa ? '; ' + R.loc.method : '') + '.',
    'Subpopulations: circular buffers of 1/10 of the maximum inter-record distance.',
    'Land cover: ' + R.productLabel + ', ' + R.y0 + '-' + R.y1 + ' (map/conversion year ' + R.year + '); AOO at ' + R.scaleAoo +
      ' m, EOO at ' + R.scaleC + ' m; areas from pixel areas on the ellipsoid.',
    'Continuing decline: linear trend of the AOH on ' + MAS.TREND_N + ' years in the last ' + MAS.TREND_SPAN + ' (p < ' + MAS.TREND_ALPHA +
      ') -> ' + R.declineBasis + '.',
    'Protected areas: ' + (R.wdpa ? 'WDPA (' + R.cfg.wdpaMode + '), groups Ia-III / IV-VI / not reported' : 'not analysed') + '.',
    'Criterion B: IUCN thresholds (CR 100/10 km², EN 5,000/500 km², VU 20,000/2,000 km²; locations 1/5/10) with two of (a), (b), (c).',
    'Area of habitat (AOH): ' + MAS.aohLabel(R) + '; it is the habitat used for Criterion A, the continuing decline and the AOO upper bound.',
    'Criterion ' + MAS.critA(R).sub + ': ' + (MAS.RL(R).aPattern === 'LIN' ? 'linear' : 'exponential') + ' model fitted to the AOH series of the EOO (AOO if no EOO), window ' +
      MAS.critA(R).window + ' years (' + MAS.critA(R).from + '-' + MAS.critA(R).to + '), population response z = ' + MAS.critA(R).z + '.',
    'Uncertainty: plausible categories from the AOO bounds, the Criterion A models and the population range; attitude ' + MAS.RL(R).attitude.toLowerCase() + ' (Guidelines 3.2).',
    'Habitat: ' + (R.cfg.doHabitat ? 'fragmentation in the AOO at 30 m (edge distance, patches by 8-connectivity up to 1024 pixels, isolation ' +
      R.cfg.isoM + ' m, small < ' + R.cfg.patchHa + ' ha); pixel history of every year ' + R.y0 + '-' + R.y1 : 'not analysed') + '.',
    'Threats: ' + (R.cfg.doThreats ? 'MapBiomas Fire (annual burned area) and MapBiomas Deforestation and Secondary Vegetation, where available' : 'not analysed') + '.',
    'Climate: ' + (R.cfg.doClimate ? 'TerraClimate (annual and monthly, ~4.6 km), ENSO phases from the NOAA ONI, ERA5-Land for the last 24 months' +
      (R.cfg.doCmip ? ', NEX-GDDP-CMIP6 projections (5 models, SSP2-4.5 and SSP5-8.5)' : '') : 'not analysed') + '.'
  ];
}
function renderAssessmentTab(R) {   // the "Summary" tab: read-only; every decision is made in the Red List tab
  var T = 'Summary';
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'Summary - ' + R.cfg.species);
  var ov = MAS.rlCategories(R), ap = applied(R), ca = ov.A;
  var col = MAS.IUCN_COLORS[ov.category] || '#cccccc';
  MAS.tabAdd(T, ui.Label(ov.category + ' - ' + (MAS.IUCN_CAT_NAME[ov.category] || ''), {fontSize: '20px', fontWeight: 'bold',
    color: ov.category === 'CR' || ov.category === 'EN' ? '#ffffff' : '#000000', backgroundColor: col, padding: '6px 12px', margin: '4px 8px'}));
  MAS.tabAdd(T, ui.Label(ov.code + (ov.low !== ov.high ? '   [' + ov.notation + ']' : ''), {fontSize: '15px', fontWeight: 'bold', color: '#222', margin: '2px 8px'}));
  MAS.tabNote(T, ov.crit.map(function (c) { return 'Criterion ' + c.k + ': ' + c.code + (c.low !== c.high ? ' (plausible ' + c.low + '-' + c.high + ')' : ''); }).join('\n') +
    (ov.rule ? '\n' + ov.rule : '') + '\nThe category is the highest reached by any criterion (Guidelines 2.2).');
  MAS.tabAdd(T, ui.Button({label: 'Change settings, sub-criteria, population data or coding in the Red List tab →', style: {color: '#1a5fb4'},
    onClick: function () { MAS.uiLater(function () { MAS.showTab('Red List'); }); }}));

  MAS.tabHead(T, 'Key figures');
  MAS.tabNote(T, [
    'Records used: ' + R.recs.length + ' (' + R.subpop.nUnique + ' unique localities; ' + R.data.noGeom.length +
      ' without valid coordinates; ' + (R.all.length - R.recs.length) + ' excluded)',
    'EOO: ' + MAS.fmt(R.eooKm2, 0) + ' km²' + (isFinite(R.eooKm2) && R.cat.eooAdj !== R.eooKm2 ? ' (raised to the AOO, ' + MAS.fmt(R.cat.eooAdj, 0) + ')' : '') +
      ' -> B1 size ' + R.cat.b1,
    'AOO: ' + MAS.fmt(R.aoo.areaKm2, 0) + ' km² (' + R.aoo.n + ' cells of ' + R.cfg.aooKm + ' km) -> B2 size ' + R.cat.b2 + '; upper bound ' + MAS.fmt(MAS.aooUpper(R), 0) + ' km²',
    'Locations: ' + R.loc.n + ' (' + R.loc.method + ', ' + R.cfg.locKm + ' km grid' +
      (R.loc.nIn !== null && R.loc.nIn !== undefined ? '; ' + R.loc.nIn + ' in PAs + ' + R.loc.nOut + ' outside' : '') + ') -> ' + MAS.locCategory(R.loc.n),
    'Subpopulations: ' + R.subpop.n + ' (circular buffers of ' + MAS.fmt(R.subpop.radiusKm, 1) + ' km)',
    'Area of habitat (AOH): ' + MAS.aohLabel(R),
    'Countries with records (Extant): ' + R.recCountries.join(', '),
    'Countries crossed by the EOO only (Possibly Extant): ' + (R.possibly.length ? R.possibly.join(', ') : 'none')
  ].join('\n'));

  MAS.tabHead(T, 'Criterion B');
  MAS.tabAdd(T, ui.Label(ap.code, {fontSize: '15px', fontWeight: 'bold', color: '#7a1f00'}));
  MAS.tabNote(T, '(a) ' + (ap.a ? 'met' : 'not met') + ' - ' + R.loc.n + ' locations' + (R.assess.frag ? ', severely fragmented' : '') +
    '\n(b) ' + (R.assess.decline ? 'met - b(' + MAS.bDecDetail(R) + '); ' + R.declineBasis : 'not met') +
    '\n(c) ' + (R.assess.fluct ? 'met - c(' + (MAS.bFlDetail(R) || '-') + ')' : 'not met') +
    '\nAOO lower bound (occupied cells) ' + MAS.fmt(R.aoo.areaKm2, 0) + ' km² -> ' + ap.code + '; upper bound (AOH within the EOO) ' + MAS.fmt(MAS.aooUpper(R), 0) +
    ' km² -> ' + ov.Bup.code + '.');
  var thr = MAS.threatLines(R).concat(MAS.climateLines(R).map(function (l) { return l + ' (Climate tab; IUCN threat 11)'; }));
  if (thr.length) MAS.tabAdd(T, ui.Label('Threat evidence (Threats and Climate tabs):\n' + thr.join('\n'), {fontSize: '12px', color: '#6a3d00', whiteSpace: 'pre-wrap'}));
  if (R.cfg.doHabitat) MAS.tabAdd(T, ui.Label(MAS.fragEvidence(R), {fontSize: '12px', color: '#6a3d00', whiteSpace: 'pre-wrap'}));

  MAS.tabHead(T, 'Criterion ' + ca.sub + ' - reduction of the area of habitat (AOH)');
  if (ca.E || ca.A) MAS.tabAdd(T, MAS.tableChart([['Extent', 'string'], ['Observed %', 'number'], ['Exponential %', 'number'], ['Linear %', 'number'], ['Best habitat %', 'number']],
    [ca.E, ca.A].filter(function (x) { return x; }).map(function (m) { return [m.scope, isFinite(m.obs) ? MAS.round(m.obs, 2) : null, isFinite(m.exp) ? MAS.round(m.exp, 2) : null,
      isFinite(m.lin) ? MAS.round(m.lin, 2) : null, isFinite(m.best) ? MAS.round(m.best, 2) : null]; })));
  MAS.tabAdd(T, ui.Label('Criterion A: ' + ca.code + '  (' + (!isFinite(ca.reduction) ? 'not computed' : ca.reduction >= 0 ? MAS.fmt(ca.reduction, 1) + '% population reduction (' + ca.qualifier + ') from ' + ca.basis : 'no reduction: ' + ca.basis + ' grew ' + MAS.fmt(-ca.reduction, 1) + '%') +
    ', ' + ca.from + '-' + ca.to + ', window ' + ca.window + ' years' + (isFinite(MAS.genLength(R).gl) ? ' = 3 x ' + MAS.fmt(MAS.genLength(R).gl, 1) + ' yr generations' : ' (no generation length given)') + ')' +
    (ca.short ? '\nThe window is longer than the land-cover series: the fitted pattern is extrapolated (Guidelines 4.5.1).' : ''),
    {fontSize: '13px', fontWeight: 'bold', color: '#7a1f00', whiteSpace: 'pre-wrap'}));

  MAS.tabHead(T, 'By country (national assessment)');
  MAS.tabAdd(T, MAS.tableChart([['Country', 'string'], ['Records', 'number'], ['Unique', 'number'], ['AOO km²', 'number'], ['EOO km²', 'number'],
    ['Locations', 'number'], ['B2', 'string'], ['B1', 'string']], R.national.map(function (n) {
    return [n.country, n.n, n.nUnique, n.aoo, isFinite(n.eoo) ? MAS.round(n.eoo, 0) : null, n.loc, n.cat.b2, n.cat.b1];
  })));
  MAS.tabHead(T, 'Records');
  var ptsById = {};
  (R.pts || []).forEach(function (p) { ptsById[p.id] = p; });
  MAS.tabAdd(T, MAS.tableChart([['id', 'number'], ['Collector', 'string'], ['Number', 'string'], ['Declared', 'string'], ['By coordinate', 'string'],
    ['Used', 'string'], ['Excluded', 'string'], ['Class ' + R.year, 'string'], ['Protection', 'string']], R.all.map(function (r) {
    var p = ptsById[r.id] || {};
    return [r.id, r.collector, r.number, r.declaredN, r.coordC, r.country, r.excluded ? 'yes' : '',
      p.lulc_year !== undefined && p.lulc_year !== null ? MAS.legOf(p.lulc_year).name : 'no data', R.wdpa ? MAS.PA_LABEL[p.protection || 0] : ''];
  })));
  MAS.tabHead(T, 'Land-cover products');
  MAS.tabAdd(T, MAS.tableChart([['Product', 'string'], ['Asset', 'string'], ['Years', 'string']], R.order.slice().reverse().map(function (s) {
    return [s.label + (s.fallback ? ' (fallback version)' : ''), s.id, s.years[0] + '-' + s.years[s.years.length - 1]];
  })));
  if (R.warnings.length || R.noProduct.length) {
    MAS.tabNote(T, 'Notes:\n  ' + R.warnings.concat(R.noProduct.length ? ['No national MapBiomas collection: ' + R.noProduct.join(', ')] : []).join('\n  '));
  }
  MAS.tabHead(T, 'Downloads');
  var dl = ui.Panel(); MAS.tabAdd(T, dl);
  MAS.dlLink(dl, 'Results (CSV)', MAS.summaryFC(R), 'csv', MAS.safeName(R.cfg.species) + '_results', MAS.SUMMARY_COLS);
  MAS.dlLink(dl, 'Records with class, product and protection (CSV)', R.recsSampled.select(MAS.REC_COLS), 'csv', MAS.safeName(R.cfg.species) + '_records', MAS.REC_COLS);
  var rp = ui.Panel();
  MAS.tabAdd(T, ui.Button({label: 'Full report (HTML, all tabs, printable to PDF)', onClick: function () { MAS.reportDownload(R, rp); }}));
  MAS.tabAdd(T, rp);
  MAS.tabNote(T, 'IUCN files (supplementary information in Word, SIS coded tables, points and polygons with IUCN attributes): Red List tab.');

  MAS.tabHead(T, 'How this assessment was made');
  MAS.tabNote(T, methodsLines(R).join('\n'));
  MAS.tabNote(T, 'Assessment log (time since start):');
  MAS.APP.logPanel = ui.Panel();
  (MAS.PROG.log || []).forEach(function (l) { MAS.APP.logPanel.add(ui.Label(l[0] + '  ' + l[1] + ' - ' + l[2], {fontSize: '12px'})); });
  MAS.tabAdd(T, MAS.APP.logPanel);
}
