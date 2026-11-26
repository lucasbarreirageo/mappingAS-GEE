/**** mappingAS GEE 2.0.0 - module "utils": client utilities
 * Section 6: number formatting, palettes, data tables, cards and small helpers used by every module.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: config
 * Shared state created here: COLUMN_CANDIDATES, NO_YEAR, GEOM_OPTION, NO_COUNTRY, MANUAL_ID0, LEG, CODES, CODE_GROUP, VIS, TCODE, PA_ZONES, PA_LABEL, PA_IN, PA_OUT, IUCN_STRICT, IUCN_SUST, CODE_LEVEL1, LEVEL1, THEME
 ****/

// ===================== END OF MATH CORE =====================

// ============================================================================
// 6. CLIENT UTILITIES
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.stripAccents = stripAccents;
  MAS.trim = trim;
  MAS.normCountry = normCountry;
  MAS.uniq = uniq;
  MAS.fmt = fmt;
  MAS.round = round;
  MAS.safeName = safeName;
  MAS.toNum = toNum;
  MAS.detectColumn = detectColumn;
  MAS.parseIds = parseIds;
  MAS.parsePeriods = parsePeriods;
  MAS.merge = merge;
  MAS.legOf = legOf;
  MAS.paGroupOf = paGroupOf;
  MAS.dataTable = dataTable;
  MAS.tableChart = tableChart;
  MAS.mkChart = mkChart;
  MAS.level1Of = level1Of;
  MAS.TC = TC;
  MAS.themed = themed;
  MAS.card = card;
  MAS.cardLabel = cardLabel;
  MAS.cardRow = cardRow;
};

exports.run = function () {
  MAS.COLUMN_CANDIDATES = {
    species: ['species', 'scientificName', 'scientific_name', 'taxon', 'taxon_name', 'binomial', 'sp',
              'especie', 'nome_cientifico', 'name', 'Species', 'sp_id'],
    lon: ['decimalLongitude', 'decimal_longitude', 'lon_corrig', 'decimalLon', 'longitude', 'long', 'lon', 'lng', 'x', 'coord_x',
          'x_coord', 'xcoord', 'easting'],
    lat: ['decimalLatitude', 'decimal_latitude', 'lat_corrig', 'decimalLat', 'latitude', 'lat', 'y', 'coord_y', 'y_coord', 'ycoord', 'northing'],
    country: ['country', 'Country', 'pais', 'countryCode', 'country_code', 'iso2', 'iso3', 'iso_a3', 'nation'],
    year: ['year', 'Year', 'ano', 'eventDate', 'event_date', 'yearCollected', 'collectionYear', 'data_coleta', 'date', 'dateIdentified', 'dateIdenti']
  };
  MAS.NO_YEAR = '(none: dates unknown)';
  MAS.GEOM_OPTION = '(asset geometry)';
  MAS.NO_COUNTRY = '(none: use the coordinate)';
  MAS.MANUAL_ID0 = 100000;
  MAS.LEG = {};
  MAS.LEGEND.forEach(function (l) { MAS.LEG[l[0]] = {name: l[1], hex: l[2], group: l[3]}; });
  MAS.CODES = MAS.LEGEND.map(function (l) { return l[0]; });
  var GROUP_IDX = {natural: 1, anthropic: 2, water: 3, other: 4, not_observed: 5};
  MAS.CODE_GROUP = MAS.LEGEND.map(function (l) { return GROUP_IDX[l[3]]; });
  var MAXC = 0;
  MAS.LEGEND.forEach(function (l) { if (l[0] > MAXC) MAXC = l[0]; });
  var PALETTE = [];
  for (var pc = 0; pc <= MAXC; pc++) PALETTE.push(MAS.LEG[pc] ? MAS.LEG[pc].hex.replace('#', '') : 'bdbdbd');
  MAS.VIS = {min: 0, max: MAXC, palette: PALETTE};
  MAS.TCODE = 1000;
     // transition code = from * 1000 + to

  // Protection zones (WDPA). Priority where PAs overlap: strict > sustainable > other.
  MAS.PA_ZONES = [0, 1, 2, 3];
  MAS.PA_LABEL = {0: 'Outside PAs', 1: 'Strict protection (IUCN Ia-III)', 2: 'Sustainable use (IUCN IV-VI)',
                  3: 'Not reported / not applicable'};
  MAS.PA_IN = [1, 2, 3];
  MAS.PA_OUT = [0];
  MAS.IUCN_STRICT = ['Ia', 'Ib', 'II', 'III', 'IA', 'IB'];
  MAS.IUCN_SUST = ['IV', 'V', 'VI'];
  // MapBiomas level-1 classes (mappingAS mb_legend()$level1) for the two-ring donut
  MAS.CODE_LEVEL1 = {1: 'Forest', 3: 'Forest', 4: 'Forest', 5: 'Forest', 6: 'Forest', 9: 'Farming', 10: 'Herbaceous/Shrubby', 11: 'Herbaceous/Shrubby', 12: 'Herbaceous/Shrubby', 13: 'Herbaceous/Shrubby', 14: 'Farming', 15: 'Farming', 18: 'Farming', 19: 'Farming', 20: 'Farming', 21: 'Farming', 22: 'NonVegetated', 23: 'Herbaceous/Shrubby', 24: 'NonVegetated', 25: 'NonVegetated', 26: 'Water', 27: 'NotObserved', 29: 'Herbaceous/Shrubby', 30: 'NonVegetated', 31: 'Water', 32: 'Herbaceous/Shrubby', 33: 'Water', 34: 'Water', 35: 'Farming', 36: 'Farming', 39: 'Farming', 40: 'Farming', 41: 'Farming', 46: 'Farming', 47: 'Farming', 48: 'Farming', 49: 'Forest', 50: 'Herbaceous/Shrubby', 59: 'Forest', 60: 'Forest', 61: 'NonVegetated', 62: 'Farming', 63: 'Herbaceous/Shrubby', 66: 'Herbaceous/Shrubby', 67: 'Forest', 68: 'NonVegetated', 69: 'Water', 70: 'Herbaceous/Shrubby', 72: 'Farming', 73: 'Herbaceous/Shrubby', 74: 'Farming', 75: 'NonVegetated', 77: 'Herbaceous/Shrubby', 79: 'Farming', 80: 'Farming', 81: 'Herbaceous/Shrubby', 82: 'Herbaceous/Shrubby', 83: 'Farming', 101: 'Water', 102: 'Forest', 104: 'Herbaceous/Shrubby', 105: 'Farming', 107: 'NonVegetated', 108: 'NonVegetated', 109: 'Water', 110: 'NotObserved', 111: 'Herbaceous/Shrubby'};
  MAS.LEVEL1 = {Forest: {name: 'Forest', hex: '#1f8d49'}, 'Herbaceous/Shrubby': {name: 'Herbaceous and Shrubby Vegetation', hex: '#d6bc74'},
    Farming: {name: 'Farming', hex: '#ffefc3'}, NonVegetated: {name: 'Non vegetated area', hex: '#d4271e'},
    Water: {name: 'Water', hex: '#2532e4'}, NotObserved: {name: 'Not Observed', hex: '#ffffff'}};
  // ---- card theme (MapBiomas-like dark cards, or light)
  MAS.THEME = {dark: false};
};

function stripAccents(s) {
  var map = {'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'é': 'e', 'ê': 'e', 'è': 'e',
    'í': 'i', 'ì': 'i', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ò': 'o', 'ú': 'u', 'ü': 'u', 'ç': 'c', 'ñ': 'n'};
  return String(s).toLowerCase().replace(/[^\u0000-~]/g, function (c) { return map[c] || c; });
}
function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
function normCountry(s) {
  if (s === null || s === undefined || trim(s) === '') return '';
  var k = trim(stripAccents(s));
  return MAS.COUNTRY_ALIASES[k] || trim(s);
}
function uniq(a) {
  var o = [], seen = {};
  for (var i = 0; i < a.length; i++) if (!seen[a[i]]) { seen[a[i]] = true; o.push(a[i]); }
  return o;
}
function fmt(x, d) {
  if (x === null || x === undefined || !isFinite(x)) return 'NA';
  var s = Number(x).toFixed(d === undefined ? 1 : d);
  var parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
}
function round(x, d) { if (x === null || x === undefined || !isFinite(x)) return null; var f = Math.pow(10, d); return Math.round(x * f) / f; }
function safeName(s) { return stripAccents(String(s)).replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').substring(0, 90); }
function toNum(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  var s = trim(String(v)).replace(',', '.');
  return s === '' ? NaN : Number(s);
}
function detectColumn(cols, kind) {
  var cand = MAS.COLUMN_CANDIDATES[kind];
  for (var i = 0; i < cand.length; i++) if (cols.indexOf(cand[i]) >= 0) return cand[i];
  var low = cols.map(function (c) { return stripAccents(c); });
  for (var j = 0; j < cand.length; j++) { var k = low.indexOf(stripAccents(cand[j])); if (k >= 0) return cols[k]; }
  return null;
}
function parseIds(txt) {
  var out = [];
  String(txt || '').split(/[,;\s]+/).forEach(function (t) {
    var m = /^(\d+)-(\d+)$/.exec(t);
    if (m) { for (var i = Number(m[1]); i <= Number(m[2]); i++) out.push(i); } else if (/^\d+$/.test(t)) out.push(Number(t));
  });
  return out;
}
function parsePeriods(txt) {
  var out = [];
  String(txt || '').split(/[,;]+/).forEach(function (t) {
    var m = /(\d{4})\s*-\s*(\d{4})/.exec(t);
    if (m) out.push([Number(m[1]), Number(m[2])]);
  });
  return out.length ? out : null;
}
function merge(a, b) { var o = {}, k; for (k in a) if (a.hasOwnProperty(k)) o[k] = a[k]; for (k in b) if (b.hasOwnProperty(k)) o[k] = b[k]; return o; }
function legOf(code) { return MAS.LEG[code] || {name: 'Class ' + code, hex: '#bdbdbd', group: 'other'}; }
function paGroupOf(iucn) {
  var u = String(iucn || '').toUpperCase();
  if (['IA', 'IB', 'II', 'III'].indexOf(u) >= 0) return 1;
  if (MAS.IUCN_SUST.indexOf(u) >= 0) return 2;
  return 3;
}
function dataTable(header, rows) {
  var cols = [], out = [];
  for (var i = 0; i < header.length; i++) cols.push({label: header[i][0], type: header[i][1]});
  for (var r = 0; r < rows.length; r++) {
    var c = [];
    for (var j = 0; j < rows[r].length; j++) c.push({v: rows[r][j]});
    out.push({c: c});
  }
  return {cols: cols, rows: out};
}
function tableChart(header, rows) { return ui.Chart(dataTable(header, rows), 'Table', {pageSize: 40}, undefined, true); }
// Every chart is downloadable: the expand icon opens it with PNG / SVG / CSV download buttons.
function mkChart(dt, type, opts) { return ui.Chart(dt, type, opts, undefined, true); }
function level1Of(code) { return MAS.CODE_LEVEL1[code] || 'NonVegetated'; }
function TC() {
  return MAS.THEME.dark ? {bg: '#16181b', border: '#2c2f33', text: '#f2f2f2', sub: '#bdbdbd', grid: '#2c2f33', chip: '#22313a'}
                    : {bg: '#ffffff', border: '#dddddd', text: '#222222', sub: '#555555', grid: '#e5e5e5', chip: '#e8f1ec'};
}
function themed(opts) {
  var c = TC();
  var ax = function (a) { return merge(a || {}, {textStyle: {color: c.sub}, titleTextStyle: {color: c.sub}, gridlines: {color: c.grid}, baselineColor: c.grid}); };
  return merge(opts, {backgroundColor: c.bg, titleTextStyle: {color: c.text, fontSize: 14},
    legend: merge(opts.legend || {}, {textStyle: {color: c.sub}}), hAxis: ax(opts.hAxis), vAxis: ax(opts.vAxis)});
}
function card(title) {
  var c = TC();
  var p = ui.Panel({style: {backgroundColor: c.bg, border: '1px solid ' + c.border, padding: '8px', margin: '8px 4px'}});
  p.add(ui.Label(title, {fontWeight: 'bold', fontSize: '16px', color: c.text, backgroundColor: c.bg}));
  return p;
}
function cardLabel(txt, extra) { var c = TC(); return ui.Label(txt, merge({fontSize: '12px', color: c.sub, backgroundColor: c.bg, whiteSpace: 'pre-wrap'}, extra || {})); }
function cardRow(widgets) { var c = TC(); return ui.Panel(widgets, ui.Panel.Layout.flow('horizontal', true), {backgroundColor: c.bg}); }
