/**** mappingAS GEE 2.0.0 - module "report": full report and batch spatial layers
 * Sections 20-21: single-file HTML report and the EOO/AOO/records layers of all species in a batch.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: utils, rangecalc, run, tabs, iucn_calc, config, habitat, climate, iucn_coding, charts, layout, batch
 * Shared state created here: APP_VERSION, GROUP_COLORS
 ****/

// ============================================================================
// 20. FULL REPORT (single self-contained HTML file: numbers of every tab, criteria, SVG figures)
//     Everything is built in the browser from results already computed; no Earth Engine request.
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.esc = esc;
  MAS.nf = nf;
  MAS.htmlTable = htmlTable;
  MAS.niceStep = niceStep;
  MAS.legendHtml = legendHtml;
  MAS.svgChart = svgChart;
  MAS.svgDonut = svgDonut;
  MAS.svgMap = svgMap;
  MAS.groupItems = groupItems;
  MAS.classRows = classRows;
  MAS.section = section;
  MAS.safeSection = safeSection;
  MAS.buildReport = buildReport;
  MAS.reportDownload = reportDownload;
  MAS.batchGeoFeatures = batchGeoFeatures;
  MAS.batchSpatialFC = batchSpatialFC;
  MAS.batchSpatial = batchSpatial;
};

exports.run = function () {
  MAS.APP_VERSION = 'mappingAS GEE 2.0.0';
  MAS.GROUP_COLORS = {natural: '#1f8d49', anthropic: '#ffd966', water: '#2532e4', other: '#d4271e'};
};

function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function nf(x, d) { return isFinite(x) ? MAS.fmt(x, d === undefined ? 1 : d) : '–'; }
function htmlTable(head, rows, cls) {
  return '<table class="' + (cls || '') + '"><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + (c && c.html ? c.html : esc(c)) + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table>';
}
function niceStep(range, n) {
  var raw = range / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}
function legendHtml(items) {   // [color, label]
  return '<div class="lg">' + items.map(function (i) { return '<span><i style="background:' + i[0] + '"></i>' + esc(i[1]) + '</span>'; }).join('') + '</div>';
}
// o: {title, labels: [...], series: [{name, color, vals, dash, pointColors}], type: 'line'|'bar'|'stack', yTitle, w, h, zero}
function svgChart(o) {
  var W = o.w || 680, H = o.h || 250, L = 58, Rm = 12, T = 14, B = 42, n = o.labels.length;
  if (!n) return '';
  var lo = Infinity, hi = -Infinity;
  if (o.type === 'stack') { lo = 0; for (var i = 0; i < n; i++) { var sm = 0; o.series.forEach(function (s) { if (isFinite(s.vals[i]) && s.vals[i] > 0) sm += s.vals[i]; }); hi = Math.max(hi, sm); } }
  else o.series.forEach(function (s) { s.vals.forEach(function (v) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
  if (o.type === 'bar' || o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (!isFinite(lo) || !isFinite(hi)) return '';
  if (hi === lo) { hi += 1; lo -= o.type === 'stack' ? 0 : 1; }
  var st = niceStep(hi - lo, 5); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
  var pw = W - L - Rm, ph = H - T - B, band = pw / n;
  var X = function (i) { return L + band * (i + 0.5); }, Y = function (v) { return T + ph * (1 - (v - lo) / (hi - lo)); };
  var g = [];
  for (var t = lo; t <= hi + st / 2; t += st) {
    g.push('<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" class="gr"/>');
    g.push('<text x="' + (L - 6) + '" y="' + (Y(t) + 4).toFixed(1) + '" class="yt">' + esc(MAS.fmt(t, st < 1 ? (st < 0.1 ? 2 : 1) : 0)) + '</text>');
  }
  if (lo < 0 && hi > 0) g.push('<line x1="' + L + '" x2="' + (W - Rm) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="z"/>');
  var every = Math.ceil(n / 14);
  o.labels.forEach(function (lab, i) { if (i % every === 0) g.push('<text x="' + X(i).toFixed(1) + '" y="' + (H - B + 16) + '" class="xt">' + esc(lab) + '</text>'); });
  if (o.yTitle) g.push('<text x="14" y="' + (T + ph / 2) + '" class="ya" transform="rotate(-90 14 ' + (T + ph / 2) + ')">' + esc(o.yTitle) + '</text>');
  if (o.type === 'stack') {
    for (var k = 0; k < n; k++) {
      var base = 0;
      o.series.forEach(function (s) { var v = s.vals[k]; if (!isFinite(v) || v <= 0) return;
        g.push('<rect x="' + (X(k) - band * 0.38).toFixed(1) + '" width="' + (band * 0.76).toFixed(1) + '" y="' + Y(base + v).toFixed(1) + '" height="' +
          (Y(base) - Y(base + v)).toFixed(1) + '" fill="' + s.color + '"><title>' + esc(o.labels[k] + ' ' + s.name + ': ' + MAS.fmt(v, 1)) + '</title></rect>'); base += v; });
    }
  } else if (o.type === 'bar') {
    var m = o.series.length, bw = band * 0.8 / m;
    o.series.forEach(function (s, j) { s.vals.forEach(function (v, i2) { if (!isFinite(v)) return;
      var c = s.pointColors && s.pointColors[i2] ? s.pointColors[i2] : s.color;
      g.push('<rect x="' + (X(i2) - band * 0.4 + j * bw).toFixed(1) + '" width="' + bw.toFixed(1) + '" y="' + Math.min(Y(v), Y(0)).toFixed(1) +
        '" height="' + Math.abs(Y(v) - Y(0)).toFixed(1) + '" fill="' + c + '"><title>' + esc(o.labels[i2] + ' ' + s.name + ': ' + MAS.fmt(v, 2)) + '</title></rect>'); }); });
  } else {
    o.series.forEach(function (s) {
      var pts = [];
      s.vals.forEach(function (v, i3) { if (isFinite(v)) pts.push(X(i3).toFixed(1) + ',' + Y(v).toFixed(1)); });
      g.push('<polyline fill="none" stroke="' + s.color + '" stroke-width="' + (s.dash ? 1.4 : 2) + '"' + (s.dash ? ' stroke-dasharray="5 4"' : '') + ' points="' + pts.join(' ') + '"/>');
      if (!s.dash) s.vals.forEach(function (v, i4) { if (isFinite(v)) g.push('<circle cx="' + X(i4).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3.2" fill="' +
        (s.pointColors && s.pointColors[i4] ? s.pointColors[i4] : s.color) + '"><title>' + esc(o.labels[i4] + ': ' + MAS.fmt(v, 2)) + '</title></circle>'); });
    });
  }
  var leg = o.legend || o.series.filter(function (s) { return s.name; }).map(function (s) { return [s.color, s.name]; });
  return '<figure><figcaption>' + esc(o.title) + '</figcaption><svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' +
    g.join('') + '</svg>' + (leg.length > 1 || o.legend ? legendHtml(leg) : '') + '</figure>';
}
function svgDonut(items, title, centre) {   // items: [value, color, label]
  var tot = 0; items.forEach(function (i) { tot += i[0] > 0 ? i[0] : 0; });
  if (!(tot > 0)) return '';
  var cx = 110, cy = 110, r1 = 100, r0 = 58, a = -Math.PI / 2, g = [];
  items.forEach(function (i) {
    if (!(i[0] > 0)) return;
    var da = 2 * Math.PI * i[0] / tot, a2 = a + da, big = da > Math.PI ? 1 : 0;
    if (da >= 2 * Math.PI - 1e-6) { g.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + ((r1 + r0) / 2) + '" fill="none" stroke="' + i[1] + '" stroke-width="' + (r1 - r0) + '"/>'); a = a2; return; }
    var p = function (rr, aa) { return (cx + rr * Math.cos(aa)).toFixed(2) + ' ' + (cy + rr * Math.sin(aa)).toFixed(2); };
    g.push('<path d="M ' + p(r1, a) + ' A ' + r1 + ' ' + r1 + ' 0 ' + big + ' 1 ' + p(r1, a2) + ' L ' + p(r0, a2) + ' A ' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + p(r0, a) +
      ' Z" fill="' + i[1] + '" stroke="#fff" stroke-width="1"><title>' + esc(i[2] + ': ' + MAS.fmt(100 * i[0] / tot, 1) + '%') + '</title></path>');
    a = a2;
  });
  g.push('<text x="' + cx + '" y="' + (cy + 5) + '" class="dc">' + esc(centre || '') + '</text>');
  return '<figure class="donut"><figcaption>' + esc(title) + '</figcaption><svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">' + g.join('') + '</svg>' +
    legendHtml(items.filter(function (i) { return i[0] > 0; }).map(function (i) { return [i[1], i[2] + ' ' + MAS.fmt(100 * i[0] / tot, 1) + '%']; })) + '</figure>';
}
function svgMap(R) {
  var used = R.recs.map(function (r) { return [r.lon, r.lat]; }), all = R.all.filter(function (r) { return isFinite(r.lon) && isFinite(r.lat); });
  var pts = all.map(function (r) { return [r.lon, r.lat]; });
  var ring = R.hull && R.hull.ring ? MAS.densifyRing(R.hull.ring, 20) : [];
  var cells = R.aoo.cells.map(function (c) { return c.ring; });
  var allP = pts.concat(ring); cells.forEach(function (c) { allP = allP.concat(c); });
  if (!allP.length) return '';
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  allP.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  var padX = Math.max((x1 - x0) * 0.08, 0.02), padY = Math.max((y1 - y0) * 0.08, 0.02);
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  var k = Math.cos((y0 + y1) / 2 * Math.PI / 180), W = 680, Hh = Math.min(620, Math.max(260, W * (y1 - y0) / ((x1 - x0) * k)));
  var sx = W / ((x1 - x0) * k), sy = Hh / (y1 - y0), s = Math.min(sx, sy);
  var ox = (W - (x1 - x0) * k * s) / 2, oy = (Hh - (y1 - y0) * s) / 2;
  var P = function (p) { return [(ox + (p[0] - x0) * k * s).toFixed(1), (oy + (y1 - p[1]) * s).toFixed(1)]; };
  var g = ['<rect width="' + W + '" height="' + Hh.toFixed(0) + '" fill="#f6f8f6"/>'];
  var gs = niceStep(Math.max(x1 - x0, y1 - y0), 5);
  for (var gx = Math.ceil(x0 / gs) * gs; gx <= x1; gx += gs) { var a1 = P([gx, y0]), a2 = P([gx, y1]);
    g.push('<line x1="' + a1[0] + '" y1="' + a1[1] + '" x2="' + a2[0] + '" y2="' + a2[1] + '" class="gr"/><text x="' + a1[0] + '" y="' + (Number(a1[1]) - 3) + '" class="xt">' + MAS.fmt(gx, 2) + '°</text>'); }
  for (var gy = Math.ceil(y0 / gs) * gs; gy <= y1; gy += gs) { var b1 = P([x0, gy]), b2 = P([x1, gy]);
    g.push('<line x1="' + b1[0] + '" y1="' + b1[1] + '" x2="' + b2[0] + '" y2="' + b2[1] + '" class="gr"/><text x="' + (Number(b1[0]) + 3) + '" y="' + (Number(b1[1]) - 3) + '" class="mt">' + MAS.fmt(gy, 2) + '°</text>'); }
  if (ring.length) g.push('<polygon points="' + ring.map(function (p) { return P(p).join(','); }).join(' ') + '" fill="#e8a33d" fill-opacity="0.18" stroke="#b5651d" stroke-width="1.5"><title>EOO ' + esc(MAS.fmt(R.eooKm2, 0)) + ' km²</title></polygon>');
  cells.forEach(function (c) { g.push('<polygon points="' + c.map(function (p) { return P(p).join(','); }).join(' ') + '" fill="#c51b7d" fill-opacity="0.35" stroke="#7a0f4d" stroke-width="0.8"/>'); });
  all.forEach(function (r) { var q = P([r.lon, r.lat]);
    g.push('<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3.6" fill="' + (r.excluded ? '#ffffff' : '#111111') + '" stroke="' + (r.excluded ? '#d7191c' : '#ffffff') + '" stroke-width="1.2"><title>#' +
      esc(r.id + ' ' + (r.collector || '') + ' ' + (r.number || '') + ' (' + MAS.fmt(r.lat, 5) + ', ' + MAS.fmt(r.lon, 5) + ')' + (r.excluded ? ' - excluded' : '')) + '</title></circle>'); });
  var kmW = (x1 - x0) * 111.32 * k, sb = niceStep(kmW / 4, 1), sbPx = sb / kmW * (x1 - x0) * k * s;
  g.push('<rect x="14" y="' + (Hh - 26).toFixed(0) + '" width="' + sbPx.toFixed(1) + '" height="5" fill="#333"/><text x="' + (14 + sbPx / 2).toFixed(1) + '" y="' + (Hh - 30).toFixed(0) + '" class="xt">' + MAS.fmt(sb, sb < 1 ? 1 : 0) + ' km</text>');
  g.push('<text x="' + (W - 20) + '" y="28" class="na">N</text><path d="M ' + (W - 20) + ' 32 l -6 16 l 6 -4 l 6 4 z" fill="#333"/>');
  return '<figure><figcaption>Records, EOO (orange) and AOO cells (purple). Black = used, red circle = excluded. Plate carrée, WGS84.</figcaption>' +
    '<svg viewBox="0 0 ' + W + ' ' + Hh.toFixed(0) + '" xmlns="http://www.w3.org/2000/svg">' + g.join('') + '</svg></figure>';
}
function groupItems(parsed) {
  var g = MAS.G(parsed);
  return [[g.natural, MAS.GROUP_COLORS.natural, 'Natural'], [g.anthropic, MAS.GROUP_COLORS.anthropic, 'Anthropic'], [g.water, MAS.GROUP_COLORS.water, 'Water'], [g.other + g.not_observed, MAS.GROUP_COLORS.other, 'Other / not observed']];
}
function classRows(parsed, top) {
  var bc = MAS.byCode(parsed), tot = 0;
  for (var k in bc) if (bc.hasOwnProperty(k)) tot += bc[k];
  return Object.keys(bc).map(Number).sort(function (a, b) { return bc[b] - bc[a]; }).slice(0, top || 12).map(function (c) {
    return [{html: '<i class="sw" style="background:' + MAS.legOf(c).hex + '"></i>' + esc(MAS.legOf(c).name)}, nf(bc[c], 2), nf(100 * bc[c] / tot, 1)];
  });
}
function section(id, title, body) { return '<section id="' + id + '"><h2>' + esc(title) + '</h2>' + body + '</section>'; }
function safeSection(id, title, fn) {
  try { var b = fn(); return b ? section(id, title, b) : ''; }
  catch (e) { return section(id, title, '<p class="warn">This section could not be built: ' + esc(e.message) + '</p>'); }
}
function buildReport(R) {
  var ap = MAS.applied(R), ca = MAS.critA(R), ov = MAS.overallCategory(R), now = new Date();
  var catCol = MAS.IUCN_COLORS[ov.category] || '#ccc';
  var lowCat = MAS.iucnCriterionB(R.eooKm2, R.bounds.lower, R.loc.n, R.assess.frag, R.assess.decline, R.assess.fluct);
  var upCat = MAS.iucnCriterionB(R.eooKm2, R.bounds.upper, R.loc.n, R.assess.frag, R.assess.decline, R.assess.fluct);
  var parts = [];
  // ---- summary
  parts.push('<header><div><h1><em>' + esc(R.cfg.species) + '</em></h1><p>Extinction-risk assessment report (IUCN Red List Criteria A-E) - ' +
    esc(now.toISOString().slice(0, 10)) + ' - ' + esc(MAS.APP_VERSION) + '</p></div><div class="cat" style="background:' + catCol + '"><b>' + esc(ov.category) +
    '</b><span>' + esc(ov.code) + (ov.low !== ov.high ? ' [' + esc(ov.notation) + ']' : '') + '</span></div></header>');
  parts.push('<div class="kpis">' + [
    ['EOO', nf(R.eooKm2, 0) + ' km²', 'B1 ' + R.cat.b1], ['AOO', nf(R.aoo.areaKm2, 0) + ' km²', 'B2 ' + R.cat.b2], ['Locations', R.loc.n, MAS.locCategory(R.loc.n)],
    ['Subpopulations', R.subpop.n, nf(R.subpop.radiusKm, 1) + ' km buffers'], ['Records', R.recs.length, R.subpop.nUnique + ' unique localities'],
    ['Habitat change ' + ca.from + '-' + ca.to, isFinite(ca.reduction) ? (ca.reduction > 0 ? '−' : '+') + nf(Math.abs(ca.reduction), 1) + '%' : '–', 'Criterion A: ' + ca.code]
  ].map(function (k) { return '<div><small>' + esc(k[0]) + '</small><b>' + esc(k[1]) + '</b><span>' + esc(k[2]) + '</span></div>'; }).join('') + '</div>');
  parts.push('<nav>' + [['map', 'Map'], ['crit', 'Criteria'], ['rl', 'Red List coding'], ['nat', 'Countries'], ['lc', 'Land cover'], ['ts', 'Time series'], ['pa', 'Protected areas'],
    ['hab', 'Habitat'], ['thr', 'Threats'], ['clim', 'Climate'], ['rec', 'Records'], ['met', 'Methods']].map(function (n) { return '<a href="#' + n[0] + '">' + n[1] + '</a>'; }).join('') + '</nav>');
  parts.push(safeSection('map', 'Distribution', function () {
    return svgMap(R) + '<p>Countries with records (Extant): ' + esc(R.recCountries.join(', ')) + '. Countries crossed only by the EOO (Possibly Extant): ' +
      esc(R.possibly.length ? R.possibly.join(', ') : 'none') + '.</p>';
  }));
  // ---- criteria
  parts.push(safeSection('crit', 'IUCN criteria', function () {
    var h = '<h3>Criterion B - geographic range</h3>' + htmlTable(['Item', 'Value', 'Result'], [
      ['EOO (B1)', nf(R.eooKm2, 1) + ' km²' + (isFinite(R.eooKm2) && R.cat.eooAdj !== R.eooKm2 ? ' (raised to the AOO: ' + nf(R.cat.eooAdj, 0) + ')' : ''), R.cat.b1],
      ['AOO (B2)', nf(R.aoo.areaKm2, 0) + ' km² (' + R.aoo.n + ' cells of ' + R.cfg.aooKm + ' km)', R.cat.b2],
      ['(a) locations / severe fragmentation', R.loc.n + ' locations (' + R.loc.method + ', ' + R.cfg.locKm + ' km)' + (R.assess.frag ? '; severely fragmented' : ''), ap.a ? 'met' : 'not met'],
      ['(b) continuing decline', R.assess.decline ? R.declineBasis : 'not applied', R.assess.decline ? 'met' : 'not met'],
      ['(c) extreme fluctuations', R.assess.fluct ? 'applied' : 'not applied', R.assess.fluct ? 'met' : 'not met'],
      [{html: '<b>Criterion B</b>'}, '', {html: '<b>' + esc(ap.code) + '</b>'}]]);
    h += '<p>Uncertainty in the AOO: lower bound (occupied cells) ' + nf(R.bounds.lower, 0) + ' km² → ' + esc(R.bounds.catLower) + '; upper bound (area of natural habitat in the EOO, ' +
      R.year + ') ' + nf(R.bounds.upper, 0) + ' km² → ' + esc(R.bounds.catUpper) + '. Plausible category: <b>' +
      esc(lowCat.category === upCat.category ? lowCat.category : lowCat.category + ' to ' + upCat.category) + '</b>.</p>';
    var fe = R.cfg.doHabitat ? MAS.fragEvidence(R) : '';
    if (fe) h += '<p class="note">' + esc(fe) + '</p>';
    h += '<h3>Criterion ' + esc(ca.sub) + ' - reduction of the area of habitat (AOH)</h3>' + htmlTable(['Extent', 'Years in the fit', 'Observed (%)', 'Exponential (%)', 'Linear (%)', 'Best habitat (%)'],
      [ca.E, ca.A].filter(function (x) { return x; }).map(function (m) { return [m.scope, m.fit.from + '-' + m.fit.to + ' (' + m.fit.n + ' years)', nf(m.obs, 2), nf(m.exp, 2), nf(m.lin, 2), nf(m.best, 2)]; })) +
      '<p>AOH: ' + esc(MAS.aohLabel(R)) + '. Window ' + ca.window + ' years, ' + ca.from + '-' + ca.to + (isFinite(MAS.genLength(R).gl) ? ' (3 generations of ' + nf(MAS.genLength(R).gl, 1) + ' years: ' + esc(MAS.genLength(R).how) + ')' : ' (no generation length given)') +
      (ca.short ? '; the fitted pattern is extrapolated beyond the series' : '') + '. Population reduction (z = ' + ca.z + '): <b>' + nf(ca.reduction, 1) + '%</b> (plausible ' + nf(ca.redLow, 1) + ' to ' + nf(ca.redHigh, 1) +
      '%). Criterion A: <b>' + esc(ca.code) + '</b>.</p>';
    var rc = MAS.rlCategories(R);
    h += '<h3>Criteria A-E and uncertainty</h3>' + htmlTable(['Criterion', 'Result', 'Best', 'Lowest plausible', 'Highest plausible'], rc.crit.map(function (c) { return [c.k, c.code, c.best, c.low, c.high]; })) +
      '<p>Attitude to uncertainty: ' + esc(MAS.RL(R).attitude.toLowerCase()) + '. ' + esc(rc.rule) + '</p>';
    h += '<h3>Overall</h3><p class="big">' + esc(ov.code) + '</p><p>The overall category is the highest category met by any criterion.</p>';
    var thr = MAS.threatLines(R).concat(MAS.climateLines(R));
    if (thr.length) h += '<h3>Threat evidence</h3><ul>' + thr.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
    return h;
  }));
  parts.push(safeSection('rl', 'IUCN Red List coding, checklist and narratives', function () {
    var rc = MAS.rlCategories(R), N = MAS.narratives(R), h = '';
    h += '<h3>Countries and sub-country units</h3>' + htmlTable(['Country', 'Presence', 'Origin', 'Seasonality', 'Records', 'Last record', 'Basis'],
      MAS.countryCoding(R).map(function (c) { return [c.country, MAS.PRESENCE[c.presence], MAS.ORIGIN[c.origin], MAS.SEASONAL[c.seasonal], c.n, isFinite(c.last) ? c.last : '', c.why]; }));
    var sub = MAS.subCountry(R);
    if (sub.length) h += htmlTable(['Country', 'Unit (GAUL 1)', 'Presence', 'Records'], sub.map(function (x) { return [x.country, x.adm1, MAS.PRESENCE[x.presence], x.n]; }));
    var rb = MAS.realmsBiomes(R);
    h += '<p>Biogeographic realm: ' + esc(Object.keys(rb.realm).join(', ') || '–') + '. Elevation of the records: ' + (R.recElev && isFinite(R.recElev.min) ? Math.round(R.recElev.min) + '-' + Math.round(R.recElev.max) + ' m' : '–') +
      '. Population trend: ' + esc(MAS.popTrend(R).trend + ' (' + MAS.popTrend(R).qualifier + ')') + '.</p>';
    if (rb.eco.length) h += htmlTable(['Ecoregion', 'Biome', 'Records', 'km² in the range', '%'], rb.eco.map(function (e) { return [e.name, e.biome || '', e.n, nf(e.km2, 0), nf(e.pct, 1)]; }));
    h += '<h3>Habitats (IUCN 3.1)</h3>' + htmlTable(['Code', 'Habitat', 'Suitability', 'Major importance', 'Records', 'Land-cover classes'],
      MAS.habitatCoding(R).filter(function (x) { return x.on; }).map(function (x) { return [x.code, x.name, x.suitability, x.major, x.n, x.classList]; }));
    h += '<h3>Threats (IUCN-CMP 3.3)</h3>' + htmlTable(['Code', 'Threat', 'Timing', 'Scope', 'Severity', 'Major', 'Stresses', 'Evidence'],
      MAS.threatCoding(R).filter(function (x) { return x.on; }).map(function (x) { return [x.code, x.name, x.timing, x.scope, x.severity, x.major ? 'yes' : '', x.stressNames, x.evidence]; }));
    h += '<h3>Conservation</h3>' + htmlTable(['Actions in place', 'Answer'], MAS.consInPlace(R)) +
      htmlTable(['Scheme', 'Code', 'Needed', 'Reason'], MAS.actionsNeeded(R, rc.category).filter(function (a) { return a.on; }).map(function (a) { return ['Conservation action', a.code, a.name, a.why]; })
        .concat(MAS.researchNeeded(R, rc.category).filter(function (a) { return a.on; }).map(function (a) { return ['Research', a.code, a.name, a.why]; })));
    h += '<h3>Record checks</h3>' + htmlTable(['Record', 'Error', 'Flags'], MAS.recordFlags(R).filter(function (f) { return f.flags.length; }).map(function (f) { return [f.id, f.error ? 'yes' : '', f.flags.join('; ')]; }));
    h += '<h3>Pre-submission checklist</h3>' + htmlTable(['', 'Item'], MAS.checklist(R));
    h += '<h3>Narrative drafts (SIS)</h3>' + [['Geographic range', N.range], ['Population', N.population], ['Habitats and ecology', N.habitat], ['Threats', N.threats],
      ['Conservation actions', N.conservation], ['Use and trade', N.useTrade], ['Rationale', N.rationale]].map(function (x) { return '<p><b>' + esc(x[0]) + '.</b> ' + esc(x[1]) + '</p>'; }).join('');
    if (R.SDM && R.SDM.done) h += '<h3>Bioclimate model</h3><p>' + R.SDM.techs.map(function (t) { return (t === 'MX' ? 'Maxent' : 'Random Forest') + ' AUC ' + nf(R.SDM.cv[t].mean, 3) + ', TSS ' + nf(R.SDM.cv[t].tssMean, 3); }).join('; ') +
      '. Change in summed suitability by ' + R.SDM.fut[0] + '-' + R.SDM.fut[1] + ': median ' + nf(-R.SDM.redBest, 1) + '% (' + nf(-R.SDM.redHi, 1) + ' to ' + nf(-R.SDM.redLo, 1) + '%).</p>';
    return h;
  }));
  parts.push(safeSection('nat', 'National assessments', function () {
    return htmlTable(['Country', 'Records', 'Unique', 'AOO km²', 'EOO km²', 'Locations', 'B2', 'B1'], R.national.map(function (n) {
      return [n.country, n.n, n.nUnique, n.aoo, nf(n.eoo, 0), n.loc, n.cat.b2, n.cat.b1]; }));
  }));
  // ---- land cover
  parts.push(safeSection('lc', 'Land cover ' + R.year + ' (' + R.productLabel + ')', function () {
    var h = '<div class="row">';
    var natShare = function (p) { var g = MAS.G(p); return g.total > 0 ? nf(100 * g.natural / g.total, 0) + '% natural' : ''; };
    if (R.hasB) h += svgDonut(groupItems(R.B.series[R.year]), 'EOO', natShare(R.B.series[R.year]));
    h += svgDonut(groupItems(R.A.series[R.year]), 'AOO', natShare(R.A.series[R.year])) + '</div>';
    [['EOO', R.hasB ? R.B.series[R.year] : null], ['AOO', R.A.series[R.year]]].forEach(function (e) {
      if (!e[1]) return;
      var g = MAS.G(e[1]);
      h += '<h3>' + e[0] + '</h3><p>Natural ' + nf(g.natPct) + '% | anthropic ' + nf(g.convPct) + '% of the terrestrial area; natural ' + nf(g.habitat, 1) + ' km², anthropic ' + nf(g.anthropic, 1) + ' km².</p>' +
        htmlTable(['Class', 'km²', '%'], classRows(e[1], 12));
    });
    return h;
  }));
  parts.push(safeSection('ts', 'Time series ' + R.y0 + '-' + R.y1, function () {
    var h = '';
    [['EOO', R.hasB ? R.B.series : null, R.trendEoo], ['AOO', R.A.series, R.trendAoo]].forEach(function (e) {
      if (!e[1]) return;
      var ys = R.tsYears.filter(function (y) { return e[1][y]; });
      if (!ys.length) return;
      var gg = ys.map(function (y) { return MAS.G(e[1][y]); });
      h += svgChart({title: e[0] + ' - area by group (km²)', labels: ys.map(String), type: 'stack', yTitle: 'km²', series: [
        {name: 'Natural', color: MAS.GROUP_COLORS.natural, vals: gg.map(function (g) { return g.natural; })},
        {name: 'Anthropic', color: MAS.GROUP_COLORS.anthropic, vals: gg.map(function (g) { return g.anthropic; })},
        {name: 'Water', color: MAS.GROUP_COLORS.water, vals: gg.map(function (g) { return g.water; })},
        {name: 'Other / not observed', color: MAS.GROUP_COLORS.other, vals: gg.map(function (g) { return g.other + g.not_observed; })}]});
      h += svgChart({title: e[0] + ' - natural habitat (km²)', labels: ys.map(String), type: 'line', yTitle: 'km²', series: [{name: 'Natural habitat', color: '#1f8d49', vals: gg.map(function (g) { return g.habitat; })}]});
    });
    h += '<h3>Habitat decline</h3>' + htmlTable(MAS.DECLINE_HEADER.map(function (x) { return x[0]; }), [R.hasB ? MAS.declineRow(R, R.B.series, R.tsYears, 'EOO', R.trendEoo) : null,
      MAS.declineRow(R, R.A.series, R.tsYears, 'AOO', R.trendAoo)].filter(function (r) { return r; }).map(function (r) { return r.map(function (v) { return v === null ? '–' : typeof v === 'number' ? nf(v, 3) : v; }); }));
    return h;
  }));
  parts.push(safeSection('pa', 'Protected areas (WDPA)', function () {
    if (!R.wdpa) return '<p>Not analysed.</p>';
    if (!R.hasC || !R.paSummary) return '<p>Not available.</p>';
    var p = R.paSummary;
    var h = '<ul><li>Records inside protected areas: ' + p.nRecIn + ' of ' + p.nRec + ' (' + nf(p.occPct) + '%)</li><li>AOO cells touching protected areas: ' + p.cellsIn +
      ' (' + nf(p.aooPct) + '%, ' + nf(p.aooKm2, 0) + ' km²)</li><li>EOO inside protected areas: ' + nf(p.eooPct) + '% (' + nf(p.eooKm2, 0) + ' km²); ' + p.nEoo +
      ' protected areas touch the EOO</li><li>Natural habitat protected (% of the range): EOO ' + nf(p.natEoo) + '%, AOO ' + nf(p.natAoo) + '%</li></ul>';
    var L = (R.C.list || []).slice().sort(function (a, b) { return (b.n_records || 0) - (a.n_records || 0); });
    if (L.length) h += '<h3>Protected areas with records or AOO cells</h3>' + htmlTable(['Name', 'Designation', 'IUCN cat.', 'Year', 'ISO3', 'Records', 'AOO cells'],
      L.map(function (x) { return [x.name, x.designation, x.iucn_cat, x.status_year, x.iso3, x.n_records, x.aoo_cells]; }));
    return h;
  }));
  parts.push(safeSection('hab', 'Habitat quality', function () {
    if (!R.cfg.doHabitat) return '<p>Not analysed.</p>';
    if (!R.H || !R.H.done) return '<p>Still computing when the report was generated.</p>';
    var h = '';
    var rows = [];
    ['EOO', 'AOO'].forEach(function (s) { var x = MAS.histSummary(R, s); if (x) rows.push([s, nf(x.natNow, 1), nf(x.stablePct), nf(x.regrownPct), nf(x.lostPct)]); });
    if (rows.length) h += '<h3>Habitat history ' + R.y0 + '-' + R.y1 + '</h3>' + htmlTable(['Extent', 'Natural now (km²)', 'Stable (% of natural)', 'Regrown (%)', 'Accumulated loss (% of ever natural)'], rows);
    var f = MAS.fragSummary(R, R.year);
    if (f && f.total) {
      h += '<h3>Fragmentation in the AOO (' + R.year + ', 30 m)</h3><p>Within 90 m of anthropic land: ' + nf(f.edge90Pct) + '% | within 300 m: ' + nf(f.edge300Pct) +
        '% | patches < ' + R.cfg.patchHa + ' ha: ' + nf(f.smallPct) + '% | small and isolated (> ' + R.cfg.isoM + ' m from a large patch): ' + nf(f.isoPct) + '%.</p>';
      h += svgChart({title: 'Natural habitat by distance to anthropic land (%)', labels: MAS.EDGE_BINS.map(function (b) { return b[1]; }), type: 'bar', yTitle: '%',
        series: [{name: String(R.year), color: '#e8a33d', vals: MAS.EDGE_BINS.map(function (b) { return 100 * f.edge[b[0]] / f.total; })}], h: 220});
      h += svgChart({title: 'Natural habitat by patch size (%)', labels: MAS.PATCH_BINS.map(function (b) { return b[1]; }), type: 'bar', yTitle: '%',
        series: [{name: String(R.year), color: '#1f8d49', vals: MAS.PATCH_BINS.map(function (b) { return 100 * f.patch[b[0]] / f.total; })}], h: 220});
    }
    return h;
  }));
  parts.push(safeSection('thr', 'Threats - fire and deforestation (MapBiomas)', function () {
    if (!R.cfg.doThreats) return '<p>Not analysed.</p>';
    if (!R.TH || !R.TH.done) return '<p>Still computing when the report was generated.</p>';
    var h = '';
    ['EOO', 'AOO'].forEach(function (s) {
      var F = R.TH.fire[s], ys = F ? Object.keys(F).map(Number).sort(function (a, b) { return a - b; }) : [];
      if (ys.length) h += svgChart({title: s + ' - burned area per year (ha)', labels: ys.map(String), type: 'stack', yTitle: 'ha', series: [
        {name: 'Natural', color: '#d7191c', vals: ys.map(function (y) { return ((F[y] || {})[1] || 0) * MAS.HA; })},
        {name: 'Anthropic', color: '#fdae61', vals: ys.map(function (y) { return ((F[y] || {})[2] || 0) * MAS.HA; })}]});
      var D = R.TH.def[s], dy = D ? Object.keys(D).map(Number).sort(function (a, b) { return a - b; }) : [];
      if (dy.length) h += svgChart({title: s + ' - deforestation and regrowth per year (ha)', labels: dy.map(String), type: 'bar', yTitle: 'ha', series: [
        {name: MAS.DEF_CLASSES[4][0], color: MAS.DEF_CLASSES[4][1], vals: dy.map(function (y) { return ((D[y] || {})[4] || 0) * MAS.HA; })},
        {name: MAS.DEF_CLASSES[5][0], color: MAS.DEF_CLASSES[5][1], vals: dy.map(function (y) { return ((D[y] || {})[5] || 0) * MAS.HA; })}]});
    });
    var tl = MAS.threatLines(R);
    if (tl.length) h += '<ul>' + tl.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
    if (!h) h = '<p>No MapBiomas Fire or Deforestation product for ' + esc(R.allCountries.join(', ')) + '.</p>';
    return h;
  }));
  parts.push(safeSection('clim', 'Climate', function () {
    if (!R.cfg.doClimate) return '<p>Not analysed.</p>';
    var CL = R.CL;
    if (!CL || !CL.done) return '<p>Still computing when the report was generated.</p>';
    var h = '';
    (CL.scopes || []).forEach(function (s) {
      var F = MAS.climFlags(CL, s);
      if (!F) return;
      h += '<h3>' + s + ' - TerraClimate ' + CL.y0 + '-' + CL.y1 + '</h3><p class="chips">' + [['Climate stress', F.stress], ['Warming', F.warming], ['Drying', F.drying],
        ['Water deficit rising', F.deficit], ['Drought (PDSI)', F.drought], ['Hot extremes', F.extremes]].map(function (c) {
        return '<span class="' + (c[1] ? 'on' : 'off') + '">' + esc(c[0]) + ': ' + (c[1] ? 'yes' : 'no') + '</span>'; }).join('') + '</p>';
      h += htmlTable(['Variable', 'First ' + CL.n + ' yr', 'Last ' + CL.n + ' yr', 'Change', 'Change %', 'Trend / decade', 'p'], ['tmx', 'tmn', 'pr', 'def', 'pdsi', 'vpd', 'aet', 'hot'].map(function (k) {
        var m = MAS.climSummary(CL, s, k), I = MAS.CL_INFO[k];
        return m ? [I.name + (I.unit ? ' (' + I.unit + ')' : ''), nf(m.from, I.d), nf(m.to, I.d), MAS.signed(m.delta, I.d), I.pct ? MAS.signed(m.pct, 1) : '', MAS.signed(m.slope10, I.d + 1), nf(m.p, 3)] : null;
      }).filter(function (r) { return r; }));
      ['tmx', 'pr', 'def'].forEach(function (k) {
        var m = MAS.climSummary(CL, s, k);
        if (!m) return;
        h += svgChart({title: s + ' - ' + MAS.CL_INFO[k].name + ' (' + MAS.CL_INFO[k].unit + '), points coloured by ENSO phase', labels: m.years.map(String), type: 'line', yTitle: MAS.CL_INFO[k].unit,
          series: [{name: MAS.CL_INFO[k].name, color: MAS.CL_INFO[k].color, vals: m.vals, pointColors: m.years.map(function (y) { return MAS.ENSO_COL[MAS.ensoOf(y).phase]; })},
            {name: 'Trend', color: '#999', dash: true, vals: m.years.map(function (y) { return m.fit ? m.fit.intercept + m.fit.slope * y : NaN; })}],
          legend: [[MAS.ENSO_COL['El Niño'], 'El Niño'], [MAS.ENSO_COL['La Niña'], 'La Niña'], [MAS.ENSO_COL['El Niño → La Niña'], 'transition'], [MAS.ENSO_COL.Neutral, 'neutral']], h: 230});
      });
      var ei = MAS.ensoImpact(CL, s);
      h += '<p>Detrended anomaly by ENSO phase:</p>' + htmlTable(['Phase', 'Years', 'Precipitation %', 'Tmax °C', 'Deficit mm', 'PDSI'], ['El Niño', 'La Niña', 'Neutral'].map(function (g) {
        var o = ei[g]; return [g, o.n, MAS.signed(o.pr, 1), MAS.signed(o.tmx, 2), MAS.signed(o.def, 0), MAS.signed(o.pdsi, 2)]; }));
      MAS.cmipEnsemble(CL, s);
      if (CL.ens && CL.ens[s]) h += '<p>Projections (NEX-GDDP-CMIP6, ' + MAS.CMIP_MODELS.length + ' models, change vs 1995-2014):</p>' +
        htmlTable(['Scenario', 'ΔTmax mean °C', 'min', 'max', 'ΔP mean %', 'min', 'max', 'Models drier'], CL.ens[s].map(function (e) { return e.map(function (v) { return typeof v === 'number' ? nf(v, 2) : v; }); }));
    });
    h += '<p>' + esc(MAS.ensoNow()) + ' (' + esc(MAS.ONI_SOURCE) + ').</p>';
    return h;
  }));
  parts.push(safeSection('rec', 'Records', function () {
    var byId = {}; (R.pts || []).forEach(function (p) { byId[p.id] = p; });
    return htmlTable(['id', 'Collector', 'Number', 'Longitude', 'Latitude', 'Country', 'Excluded', 'Class ' + R.year, 'Protection'], R.all.map(function (r) {
      var p = byId[r.id] || {};
      return [r.id, r.collector, r.number, nf(r.lon, 5), nf(r.lat, 5), r.country, r.excluded ? 'yes' : '', p.lulc_year !== undefined && p.lulc_year !== null ? MAS.legOf(p.lulc_year).name : '',
        R.wdpa ? MAS.PA_LABEL[p.protection || 0] : ''];
    }), 'small');
  }));
  parts.push(safeSection('met', 'Methods and data sources', function () {
    return '<ul>' + MAS.methodsLines(R).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      '<h3>Land-cover products</h3>' + htmlTable(['Product', 'Asset', 'Years'], R.order.slice().reverse().map(function (s) { return [s.label, s.id, s.years[0] + '-' + s.years[s.years.length - 1]]; })) +
      (R.warnings.length ? '<h3>Notes</h3><ul>' + R.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
      '<h3>References</h3><ul><li>IUCN Standards and Petitions Committee. Guidelines for Using the IUCN Red List Categories and Criteria.</li>' +
      '<li>mappingAS R package (EOO, AOO, locations, land-cover methods replicated here).</li><li>MapBiomas Project - land-cover, fire and deforestation collections.</li>' +
      '<li>Karra et al. Esri 10 m Annual Land Use Land Cover (Sentinel-2).</li><li>UNEP-WCMC & IUCN. World Database on Protected Areas (WDPA).</li>' +
      '<li>Abatzoglou et al. (2018) TerraClimate. Scientific Data 5: 170191.</li><li>Muñoz Sabater et al. (2021) ERA5-Land. Earth System Science Data 13: 4349-4383.</li>' +
      '<li>Thrasher et al. (2022) NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6). Scientific Data 9: 262.</li>' +
      '<li>NOAA Climate Prediction Center - Oceanic Niño Index (ONI).</li></ul>' +
      '<p class="note">Generated in Google Earth Engine. Automated results support, and do not replace, expert judgement in the assessment.</p>';
  }));
  var css = 'body{font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d2a22;max-width:900px;margin:24px auto;padding:0 18px}' +
    'header{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:3px solid #1f5f3a;padding-bottom:10px}h1{margin:0;font-size:26px}' +
    'header p{margin:4px 0;color:#555}.cat{min-width:120px;text-align:center;border-radius:8px;padding:8px 12px;color:#111}.cat b{display:block;font-size:34px}.cat span{font-size:12px}' +
    '.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.kpis div{background:#eef4ef;border-radius:6px;padding:8px 10px}.kpis small{display:block;color:#557}' +
    '.kpis b{font-size:20px;display:block}.kpis span{font-size:12px;color:#444}nav{margin:6px 0 10px}nav a{margin-right:10px;color:#1f5f3a;font-size:13px}' +
    'h2{border-bottom:1px solid #cfdcd2;padding-bottom:4px;margin-top:28px;color:#1f5f3a}h3{margin:16px 0 6px;font-size:15px}' +
    'table{border-collapse:collapse;width:100%;margin:6px 0 10px;font-size:13px}th,td{border:1px solid #d5e0d8;padding:4px 6px;text-align:left;vertical-align:top}' +
    'th{background:#eef4ef}table.small{font-size:11.5px}figure{margin:10px 0}figcaption{font-weight:600;font-size:13px;margin-bottom:4px}svg{width:100%;height:auto}' +
    '.row{display:flex;gap:18px;flex-wrap:wrap}.donut{width:300px}.gr{stroke:#e2e8e4;stroke-width:1}.z{stroke:#888;stroke-width:1}' +
    '.yt{font-size:10px;text-anchor:end;fill:#555}.xt{font-size:10px;text-anchor:middle;fill:#555}.mt{font-size:10px;fill:#555}.ya{font-size:11px;text-anchor:middle;fill:#555}' +
    '.na{font-size:14px;font-weight:700;text-anchor:middle}.dc{font-size:15px;font-weight:700;text-anchor:middle}.lg{font-size:12px;display:flex;flex-wrap:wrap;gap:4px 12px}' +
    '.lg i,.sw{display:inline-block;width:11px;height:11px;margin-right:4px;vertical-align:-1px;border:1px solid #9994}.note{color:#6a3d00}.warn{color:#b30000}.big{font-size:20px;font-weight:700}' +
    '.chips span{display:inline-block;border-radius:12px;padding:2px 9px;margin:2px;font-size:12px}.chips .on{background:#a5281f;color:#fff}.chips .off{background:#e3eee6}' +
    '@media print{nav{display:none}section{break-inside:avoid-page}body{margin:0}h2{break-after:avoid}}';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(R.cfg.species) +
    ' - assessment report</title><style>' + css + '</style></head><body>' + parts.join('') + '</body></html>';
}
function reportDownload(R, panel) {
  panel.clear();
  if (!R || !R.finished) { panel.add(ui.Label('Run an assessment first.', {color: '#b30000', fontSize: '12px'})); return; }
  var pend = [];
  if (R.cfg.doHabitat && !(R.H && R.H.done)) pend.push('habitat');
  if (R.cfg.doThreats && !(R.TH && R.TH.done)) pend.push('threats');
  if (R.cfg.doClimate && !(R.CL && R.CL.done)) pend.push('climate');
  var html;
  try { html = buildReport(R); } catch (e) { panel.add(ui.Label('Report error: ' + e.message, {color: '#b30000', fontSize: '12px'})); return; }
  var name = MAS.safeName(R.cfg.species) + '_report.html';
  var l = ui.Label('⬇ ' + name + ' (' + MAS.fmt(html.length / 1024, 0) + ' KB)', {color: '#1a5fb4', fontSize: '13px', fontWeight: 'bold'});
  var b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(html))) : null;
  if (b64) l.setUrl('data:application/octet-stream;base64,' + b64);
  panel.add(l);
  panel.add(ui.Label((pend.length ? 'Still loading: ' + pend.join(', ') + ' - those sections will say so; generate again when the progress panel finishes. ' : '') +
    'Open the file in a browser; print it to PDF (Ctrl+P) to attach it to the assessment. If the browser saves it as "download", rename it to .html. ' +
    'If the link does not work, copy everything in the box below into a text file and save it as .html.', MAS.S.small));
  panel.add(ui.Textbox({value: html, style: {stretch: 'horizontal'}}));
}
// ============================================================================
// 21. BATCH SPATIAL: EOO, AOO cells and records of every species in one layer set
// ============================================================================
function batchGeoFeatures() {   // client-side GeoJSON features
  var feats = [], byName = {};
  MAS.BATCH.rows.forEach(function (r) { byName[r.species] = r; });
  Object.keys(MAS.BATCH.items).forEach(function (sp) {
    var R = MAS.BATCH.items[sp], row = byName[sp] || {};
    if (!R || !R.aoo || !R.recs) return;
    var base = {species: sp, n_records: R.recs.length, eoo_km2: MAS.round(R.eooKm2, 2), aoo_km2: R.aoo.areaKm2, n_locations: R.loc ? R.loc.n : null,
      category: row.category_overall || row.category_B || row.category_decline_assumed || ''};
    if (R.hull && R.hull.ring) feats.push({type: 'Feature', properties: MAS.merge(base, {layer: 'EOO'}),
      geometry: {type: 'Polygon', coordinates: [MAS.densifyRing(R.hull.ring, MAS.EOO_SEGMENT_KM).map(function (p) { return [MAS.round(p[0], 6), MAS.round(p[1], 6)]; })]}});
    R.aoo.cells.forEach(function (c, i) { feats.push({type: 'Feature', properties: MAS.merge(base, {layer: 'AOO cell', cell: i + 1, cell_records: c.recs.length}),
      geometry: {type: 'Polygon', coordinates: [c.ring.map(function (p) { return [MAS.round(p[0], 6), MAS.round(p[1], 6)]; })]}}); });
    R.recs.forEach(function (rc) { feats.push({type: 'Feature', properties: MAS.merge(base, {layer: 'record', record_id: rc.id, collector: rc.collector || '', number: rc.number || '', country: rc.country || ''}),
      geometry: {type: 'Point', coordinates: [MAS.round(rc.lon, 6), MAS.round(rc.lat, 6)]}}); });
  });
  return feats;
}
function batchSpatialFC(layer) {   // server-side FeatureCollection of one layer (for KML/KMZ links and SHP export)
  return ee.FeatureCollection(batchGeoFeatures().filter(function (f) { return !layer || f.properties.layer === layer; }).map(function (f) {
    var g = f.geometry.type === 'Point' ? ee.Geometry.Point(f.geometry.coordinates) : ee.Geometry.Polygon(f.geometry.coordinates, null, false);
    var pr = {};
    Object.keys(f.properties).forEach(function (k) { var v = f.properties[k]; if (v !== null && v !== undefined && !(typeof v === 'number' && !isFinite(v))) pr[k] = v; });
    return ee.Feature(g, pr);
  }));
}
function batchSpatial(panel) {
  panel.clear();
  var feats = batchGeoFeatures();
  if (!feats.length) { panel.add(ui.Label('Run a batch first.', MAS.S.small)); return; }
  var nsp = Object.keys(MAS.BATCH.items).length;
  var gj = JSON.stringify({type: 'FeatureCollection', name: 'batch_' + nsp + '_species', features: feats});
  var l = ui.Label('⬇ All species: EOO + AOO cells + records (GeoJSON, ' + feats.length + ' features, ' + MAS.fmt(gj.length / 1024, 0) + ' KB)',
    {color: '#1a5fb4', fontSize: '13px', fontWeight: 'bold'});
  if (typeof btoa === 'function') l.setUrl('data:application/geo+json;base64,' + btoa(unescape(encodeURIComponent(gj))));
  panel.add(l);
  panel.add(ui.Label('One file with the property "layer" = EOO, AOO cell or record (filter by it in QGIS/ArcGIS). Built in the browser: rename to .geojson if needed.', MAS.S.small));
  ['EOO', 'AOO cell', 'record'].forEach(function (lay) {
    MAS.dlLink(panel, lay + ' layer, all species (KML)', batchSpatialFC(lay), 'kml', 'batch_' + MAS.safeName(lay));
  });
  panel.add(ui.Button({label: 'Shapefiles (3 layers) - export tasks, Code Editor only', onClick: function () {
    try {
      ['EOO', 'AOO cell', 'record'].forEach(function (lay) {
        Export.table.toDrive({collection: batchSpatialFC(lay), description: 'batch_' + MAS.safeName(lay) + '_' + nsp + '_species', folder: MAS.EXPORT_FOLDER,
          fileNamePrefix: 'batch_' + MAS.safeName(lay), fileFormat: 'SHP'});
      });
      panel.add(ui.Label('3 export tasks created (Tasks tab → Run).', MAS.S.small));
    } catch (e) { panel.add(ui.Label('Export tasks only work in the Code Editor.', {color: '#b30000', fontSize: '12px'})); }
  }}));
}
