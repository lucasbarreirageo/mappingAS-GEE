/**** mappingAS GEE 2.0.0 - module "records": occurrence data and added points
 * Sections 8-9: reading pasted tables, GeoJSON, assets and the example; column detection; points added on the map.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: layout, utils, config, rangecalc
 * Shared state created here: TABLE, BINOMIAL, ASSET_ID_RE, addChk, manualTablePanel
 ****/

// ============================================================================
// 8. READING THE OCCURRENCE TABLE
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.makeSelect = makeSelect;
  MAS.setColumns = setColumns;
  MAS.parseYear = parseYear;
  MAS.setSpecies = setSpecies;
  MAS.loadExample = loadExample;
  MAS.readAsset = readAsset;
  MAS.loadSpeciesList = loadSpeciesList;
  MAS.parseDelimited = parseDelimited;
  MAS.parsePasted = parsePasted;
  MAS.unq = unq;
  MAS.rebuildRows = rebuildRows;
  MAS.uiLater = uiLater;
  MAS.readPasted = readPasted;
  MAS.applyPasted = applyPasted;
  MAS.pastedSpecies = pastedSpecies;
  MAS.loadRecords = loadRecords;
  MAS.manualFC = manualFC;
  MAS.addPoint = addPoint;
  MAS.refreshManual = refreshManual;
};

exports.run = function () {
  MAS.TABLE = {kind: null, columns: [], species: []};
  MAS.srcSelect.onChange(function (v) {
    if (v === MAS.SRC_ASSET) { MAS.TABLE.kind = null; MAS.dataInfo.setValue('Paste the asset id above and press "Read asset columns".'); }
    else if (v === MAS.SRC_PASTE) { MAS.TABLE.kind = null; MAS.dataInfo.setValue('Paste a CSV / TSV (with a header row) or a GeoJSON in the box above and press "Read pasted data".'); }
    else loadExample();
  });
  MAS.readBtn.onClick(readAsset);
  MAS.pasteBtn.onClick(readPasted);
  // Rows glued together when a single-line text box drops the line breaks ("...last field<space>first field...").
  // Every row has the same number of separators, so the column count N gives the row boundaries; each boundary
  // field is split back in two (at the last / first space, the most frequent suffix, or trailing digits).
  // The best split is the one where most rows get valid longitude and latitude.
  MAS.BINOMIAL = /^[A-Z][a-zë-]+ (× ?)?[a-z][a-zë-]+/;
  MAS.ASSET_ID_RE = /^(projects\/[^\s,;\t]+\/assets\/|users\/)[^\s,;\t]+$/;
  // ============================================================================
  // 9. ADD POINTS TAB (map clicks, typed lon/lat or UTM)
  // ============================================================================
  var addTab = MAS.TABS['Add points'];
  addTab.add(ui.Label('Add points', {fontWeight: 'bold', fontSize: '15px', margin: '12px 8px 4px 8px'}));
  addTab.add(ui.Label('Add occurrences that are missing from the table, by clicking on the map or by typing ' +
    'coordinates. Added points join the selected species when you press "Assess" again.', MAS.S.small));
  MAS.addChk = ui.Checkbox({label: 'Add points by clicking on the map (while this tab is open)', value: false,
    onChange: function (v) { MAS.APP.addMode = v && MAS.CURRENT_TAB === 'Add points'; Map.style().set('cursor', v ? 'crosshair' : 'hand'); }});
  addTab.add(MAS.addChk);
  var lonBox = ui.Textbox({placeholder: 'Longitude (decimal degrees)', style: MAS.S.stretch});
  var latBox = ui.Textbox({placeholder: 'Latitude (decimal degrees)', style: MAS.S.stretch});
  addTab.add(ui.Label('Typed coordinates (WGS84)', MAS.S.small));
  addTab.add(ui.Panel([lonBox, latBox], ui.Panel.Layout.flow('horizontal')));
  addTab.add(ui.Button({label: 'Add typed point', onClick: function () {
    addPoint(MAS.toNum(lonBox.getValue()), MAS.toNum(latBox.getValue()), 'typed lon/lat');
  }}));
  var eBox = ui.Textbox({placeholder: 'Easting X (m)'}), nBox = ui.Textbox({placeholder: 'Northing Y (m)'});
  var zBox = ui.Textbox({placeholder: 'UTM zone (1-60)'});
  var hemiSel = ui.Select({items: ['South', 'North'], value: 'South'});
  addTab.add(ui.Label('UTM coordinates (WGS84)', MAS.S.small));
  addTab.add(ui.Panel([eBox, nBox], ui.Panel.Layout.flow('horizontal')));
  addTab.add(ui.Panel([zBox, hemiSel], ui.Panel.Layout.flow('horizontal')));
  addTab.add(ui.Button({label: 'Add UTM point', onClick: function () {
    var z = MAS.toNum(zBox.getValue());
    if (!isFinite(z) || z < 1 || z > 60) { MAS.setStatus('UTM zone must be 1-60.', true); return; }
    var ll = MAS.utmToLonLat(MAS.toNum(eBox.getValue()), MAS.toNum(nBox.getValue()), z, hemiSel.getValue() === 'South');
    addPoint(ll[0], ll[1], 'typed UTM');
  }}));
  addTab.add(ui.Panel([
    ui.Button({label: 'Undo last', onClick: function () { MAS.APP.manual.pop(); refreshManual(); }}),
    ui.Button({label: 'Clear all', onClick: function () { MAS.APP.manual = []; refreshManual(); }})
  ], ui.Panel.Layout.flow('horizontal')));
  MAS.manualTablePanel = ui.Panel();
  var manualDl = ui.Panel();
  addTab.add(MAS.manualTablePanel);
  addTab.add(ui.Button({label: 'Download added points (CSV)', onClick: function () {
    manualDl.clear();
    if (!MAS.APP.manual.length) { manualDl.add(ui.Label('No added points.', MAS.S.small)); return; }
    var l = ui.Label('preparing link...', MAS.S.small); manualDl.add(l);
    manualFC().getDownloadURL('csv', ['id', 'species', 'lon', 'lat', 'how'], 'added_points', function (url, err) {
      if (url) { l.setValue('added_points.csv'); l.setUrl(url); } else l.setValue('Error: ' + err);
    });
  }}));
  addTab.add(manualDl);
  Map.onClick(function (c) { if (MAS.APP.addMode) addPoint(c.lon, c.lat, 'map click'); });
  refreshManual();
};

function makeSelect(holder, items, value, placeholderTxt, onChange) {
  holder.clear();
  items = (items || []).map(String);
  var o = {items: items, placeholder: placeholderTxt, style: MAS.S.stretch};
  if (value !== null && value !== undefined && items.indexOf(String(value)) >= 0) o.value = String(value);
  if (onChange) o.onChange = onChange;
  var sel = ui.Select(o);
  holder.add(sel);
  return sel;
}
function setColumns(cols, allowGeom) {
  MAS.TABLE.columns = cols;
  var coordItems = cols.concat(allowGeom ? [MAS.GEOM_OPTION] : []);
  MAS.colSpecies = makeSelect(MAS.holdSpeciesCol, cols, MAS.detectColumn(cols, 'species'), 'species column',
    function () { if (MAS.TABLE.kind === 'asset') loadSpeciesList(); else if (MAS.TABLE.kind === 'pasted') pastedSpecies(); });
  var preferGeom = allowGeom === 'prefer';
  MAS.colLon = makeSelect(MAS.holdLon, coordItems, preferGeom ? MAS.GEOM_OPTION : MAS.detectColumn(cols, 'lon') || (allowGeom ? MAS.GEOM_OPTION : null), 'longitude column');
  MAS.colLat = makeSelect(MAS.holdLat, coordItems, preferGeom ? MAS.GEOM_OPTION : MAS.detectColumn(cols, 'lat') || (allowGeom ? MAS.GEOM_OPTION : null), 'latitude column');
  MAS.colCountry = makeSelect(MAS.holdCountry, [MAS.NO_COUNTRY].concat(cols), MAS.detectColumn(cols, 'country') || MAS.NO_COUNTRY, 'country column');
  MAS.colYear = makeSelect(MAS.holdYear, [MAS.NO_YEAR].concat(cols), MAS.detectColumn(cols, 'year') || MAS.NO_YEAR, 'year column');
}
// year of a record from a year or a date value (1700-2100); NaN when unknown
function parseYear(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v >= 1700 && v <= 2100 ? Math.round(v) : (v > 1e11 ? new Date(v).getUTCFullYear() : NaN);
  var m = /(1[7-9]\d\d|20\d\d|2100)/.exec(String(v));
  return m ? Number(m[1]) : NaN;
}
function setSpecies(list) { MAS.speciesSelect = makeSelect(MAS.holdSpecies, list, list[0], 'species'); }
function loadExample() {
  MAS.TABLE.kind = 'example';
  setColumns(MAS.EXAMPLE_COLUMNS, false);
  setSpecies(MAS.uniq(MAS.EXAMPLE_ROWS.map(function (r) { return r[0]; })));
  MAS.dataInfo.setValue('Built-in example: ' + MAS.EXAMPLE_ROWS.length + ' rows - ' + MAS.EXAMPLE_NAME + '.');
}
function readAsset() {
  var id = MAS.trim(MAS.assetBox.getValue() || '').replace(/^['"]|['"]$/g, '');
  if (!id) { MAS.setStatus('Enter the asset id.', true); return; }
  if (!/^[^\s,;\t]+\/[^\s,;\t]+$/.test(id)) { MAS.setStatus('This does not look like an asset id (projects/<project>/assets/<name> or users/<user>/<name>).', true); return; }
  MAS.TABLE.assetId = id;
  MAS.setStatus('Reading the asset...');
  var fc = ee.FeatureCollection(id);
  ee.Dictionary({cols: fc.first().propertyNames(), n: fc.size()}).evaluate(function (r, err) {
    if (err) { MAS.setStatus('Could not read the asset: ' + err + '\nCheck the id and sharing ("Anyone can read").', true); return; }
    var cols = (r && r.cols ? r.cols : []).map(String).filter(function (c) { return c.indexOf('system:') !== 0; }).sort();
    if (!cols.length) { MAS.setStatus('The asset has no columns (is it an empty table?).', true); return; }
    uiLater(function () {
      MAS.TABLE.kind = 'asset'; MAS.TABLE.rows = null;
      setColumns(cols, true);
      MAS.dataInfo.setValue('Asset with ' + r.n + ' rows and ' + cols.length + ' columns.');
      MAS.setStatus('Columns read. Check the columns and pick the species.');
      loadSpeciesList();
    });
  });
}
function loadSpeciesList() {
  if (MAS.TABLE.kind !== 'asset') return;
  var col = MAS.colSpecies.getValue();
  if (!col) return;
  ee.FeatureCollection(MAS.TABLE.assetId).aggregate_array(col).distinct().sort().evaluate(function (sp, err) {
    if (err) { MAS.setStatus('Error listing species: ' + err, true); return; }
    sp = (sp || []).filter(function (s) { return s !== null && MAS.trim(s) !== ''; }).map(String);
    MAS.TABLE.species = sp;
    uiLater(function () { setSpecies(sp); });
    MAS.dataInfo.setValue(MAS.dataInfo.getValue().replace(/ \| .*$/, '') + ' | ' + sp.length + ' species.');
  });
}
// ---- pasted data (CSV, TSV or GeoJSON), parsed in the browser: no asset, nothing uploaded
function parseDelimited(text, sep) {   // RFC 4180: quoted fields, "" escapes, line breaks inside quotes
  var rows = [], row = [], f = '', q = false, i, ch;
  for (i = 0; i < text.length; i++) {
    ch = text.charAt(i);
    if (q) {
      if (ch === '"') { if (text.charAt(i + 1) === '"') { f += '"'; i++; } else q = false; }
      else f += ch;
    } else if (ch === '"' && f === '') q = true;
    else if (ch === sep) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
      row.push(f); f = ''; rows.push(row); row = [];
    } else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(function (r) { return r.length > 1 || MAS.trim(r[0] || '') !== ''; });
}
function parsePasted(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  var t = MAS.trim(text);
  if (!t) return {error: 'The box is empty.'};
  if (t.charAt(0) === '{' || t.charAt(0) === '[') {   // GeoJSON (line breaks do not matter)
    var js;
    try { js = JSON.parse(t); } catch (e) { return {error: 'This looks like JSON but could not be read: ' + e.message}; }
    var feats = js.type === 'FeatureCollection' ? js.features : js.type === 'Feature' ? [js] : Array.isArray(js) ? js : null;
    if (!feats) return {error: 'GeoJSON without features.'};
    var cols = {}, rows = [];
    feats.forEach(function (f, i) {
      var p = (f && f.properties) || (f && !f.type ? f : {}), pr = {};
      Object.keys(p).forEach(function (k) { var v = p[k]; pr[k] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v; cols[k] = true; });
      var g = f && f.geometry && f.geometry.type === 'Point' ? f.geometry.coordinates : null;
      var own = MAS.toNum(pr.id !== undefined ? pr.id : pr.ID);
      rows.push({id: isFinite(own) ? own : i + 1, props: pr, geom: g});
    });
    return {kind: 'GeoJSON', columns: Object.keys(cols), rows: rows, hasGeom: rows.some(function (r) { return r.geom; })};
  }
  var nl = /[\r\n]/.test(t);
  var body = t;
  if (!nl) {   // the text box removed the line breaks: rebuild the rows, or accept " | " between records
    if (t.indexOf('|') >= 0 && /\s\|\s/.test(t)) body = t.split('|').map(MAS.trim).join('\n');
    else {
      var rec = rebuildRows(t);
      if (!rec) return {error: 'The line breaks were removed when pasting and the rows could not be rebuilt. ' +
        'Keep an "id" column first and the longitude/latitude columns with recognisable names, paste a GeoJSON, ' +
        'or put " | " between records (e.g. species,lon,lat | Prepusa connata,-43.27,-22.42 | ...).'};
      return rec;
    }
  }
  var first = body.split(/\r?\n/)[0];
  var counts = {'\t': first.split('\t').length, ';': first.split(';').length, ',': first.split(',').length};
  var sep = counts['\t'] > 1 ? '\t' : counts[';'] > counts[','] ? ';' : ',';
  var all = parseDelimited(body, sep);
  if (all.length < 2) return {error: 'Need a header row and at least one data row.'};
  var head = all[0].map(function (h, j) { h = MAS.trim(h); return h || 'col' + (j + 1); });
  var rowsC = all.slice(1).map(function (r, i) {
    var pr = {};
    head.forEach(function (h, j) { pr[h] = r[j] === undefined ? '' : MAS.trim(r[j]); });
    var own = MAS.toNum(pr.id !== undefined ? pr.id : pr.ID);
    return {id: isFinite(own) ? own : i + 1, props: pr, geom: null};
  });
  return {kind: sep === '\t' ? 'TSV' : 'CSV (' + sep + ')', columns: head, rows: rowsC, hasGeom: false};
}
function unq(v) { v = MAS.trim(v); return v.length > 1 && v.charAt(0) === '"' && v.charAt(v.length - 1) === '"' ? v.slice(1, -1).replace(/""/g, '"') : v.replace(/^"|"$/g, ''); }
function rebuildRows(t) {
  var best = null;
  ['\t', ';', ','].forEach(function (sep) {
    if (t.indexOf(sep) < 0) return;
    var tok = (parseDelimited(t, sep)[0] || []);
    var T = tok.length;
    for (var N = 3; N <= Math.min(300, T); N++) {
      if ((T - N) % (N - 1) !== 0 || (T - N) / (N - 1) < 1) continue;
      var nRows = (T - N) / (N - 1), bounds = [];
      for (var b = 1; b <= nRows; b++) bounds.push(b * (N - 1));
      var freq = {};
      bounds.forEach(function (bi) { var w = tok[bi].split(' '); for (var k = 1; k < w.length; k++) { var suf = w.slice(k).join(' '); freq[suf] = (freq[suf] || 0) + 1; } });
      ['last', 'binomial', 'freq', 'first', 'digits'].forEach(function (mode) {
        var split = function (x) {
          var i;
          if (mode === 'last') { i = x.lastIndexOf(' '); return i < 0 ? null : [x.slice(0, i), x.slice(i + 1)]; }
          if (mode === 'first') { i = x.indexOf(' '); return i < 0 ? null : [x.slice(0, i), x.slice(i + 1)]; }
          if (mode === 'digits') { var m = /^([\s\S]*?)(\d+)$/.exec(x); return m ? [m[1], m[2]] : null; }
          if (mode === 'binomial') {   // the shortest suffix that starts like "Genus epithet" (also glued: "BaezPrepusa ...")
            for (var q = x.length - 3; q >= 0; q--) {
              var c0 = x.charAt(q);
              if (c0 >= 'A' && c0 <= 'Z' && MAS.BINOMIAL.test(x.slice(q).replace(/"/g, ''))) return [x.slice(0, q), x.slice(q)];
            }
            return null;
          }
          var w = x.split(' '), bestK = -1, bestF = 0;
          for (var k = 1; k < w.length; k++) { var f = freq[w.slice(k).join(' ')] || 0; if (f > bestF) { bestF = f; bestK = k; } }
          return bestK < 0 ? null : [w.slice(0, bestK).join(' '), w.slice(bestK).join(' ')];
        };
        var cells = tok.slice(), ok = true;
        var lines = [], cur = [];
        for (var i = 0; i < T; i++) {
          var isB = i > 0 && i < T - 1 && i % (N - 1) === 0 && i <= nRows * (N - 1);
          if (!isB) { cur.push(cells[i]); continue; }
          var sp = split(cells[i]);
          if (!sp) { ok = false; break; }
          cur.push(unq(sp[0])); lines.push(cur); cur = [unq(sp[1])];
        }
        if (!ok) return;
        lines.push(cur);
        if (!lines.every(function (l) { return l.length === N; })) return;
        var head = lines[0].map(MAS.trim), lonC = MAS.detectColumn(head, 'lon'), latC = MAS.detectColumn(head, 'lat');
        if (!lonC || !latC) return;
        var iLon = head.indexOf(lonC), iLat = head.indexOf(latC), good = 0;
        lines.slice(1).forEach(function (l) { var x = MAS.toNum(l[iLon]), y = MAS.toNum(l[iLat]); if (isFinite(x) && isFinite(y) && Math.abs(x) <= 180 && Math.abs(y) <= 90) good++; });
        var spC = MAS.detectColumn(head, 'species'), bin = 0;
        if (spC) { var iSp = head.indexOf(spC); lines.slice(1).forEach(function (l) { if (MAS.BINOMIAL.test(l[iSp] || '')) bin++; }); }
        var score = good / nRows + 0.5 * bin / nRows + (mode === 'last' ? 0.004 : mode === 'binomial' ? 0.003 : mode === 'freq' ? 0.002 : mode === 'first' ? 0.001 : 0);
        if (good > 0 && (!best || score > best.score)) best = {score: score, sep: sep, head: head, lines: lines.slice(1), mode: mode};
      });
    }
  });
  if (!best || best.score < 0.5) return null;   // fewer than half of the rows with coordinates: give up
  var rows = best.lines.map(function (l, i) {
    var pr = {};
    best.head.forEach(function (h, j) { pr[h] = l[j]; });
    var own = MAS.toNum(pr.id !== undefined ? pr.id : pr.ID);
    return {id: isFinite(own) ? own : i + 1, props: pr, geom: null};
  });
  return {kind: (best.sep === '\t' ? 'TSV' : 'CSV (' + best.sep + ')') + ', rows rebuilt because the line breaks were lost', columns: best.head, rows: rows, hasGeom: false};
}
// Rebuilding the drop-downs inside a click handler can collide with the browser's own focus/blur events on
// the widgets being replaced (Code Editor error "Cannot read properties of null (reading 'classList')").
// So the panel is rebuilt a moment later, after the click has finished.
function uiLater(fn) {
  var run = function () { try { fn(); } catch (e) { MAS.setStatus('Interface error: ' + e.message + '. Press the button again.', true); } };
  if (ui.util && ui.util.setTimeout) ui.util.setTimeout(run, 50); else run();
}
function readPasted() {
  var txt = MAS.trim(MAS.pasteBox.getValue() || ''), res;
  if (MAS.ASSET_ID_RE.test(txt)) {   // an asset id pasted in the wrong box: read it as an asset
    MAS.assetBox.setValue(txt);
    MAS.setStatus('That is an asset id - reading it as an asset table.');
    readAsset();
    return;
  }
  try { res = parsePasted(txt); } catch (e) { MAS.setStatus('Could not read the pasted text: ' + e.message, true); return; }
  if (res.error) { MAS.setStatus(res.error, true); return; }
  MAS.setStatus('Reading ' + res.rows.length + ' pasted rows...');
  uiLater(function () { applyPasted(res); });
}
function applyPasted(res) {
  MAS.TABLE.kind = 'pasted'; MAS.TABLE.rows = res.rows;
  setColumns(res.columns, res.hasGeom ? 'prefer' : false);
  MAS.dataInfo.setValue('Pasted ' + res.kind + ': ' + res.rows.length + ' rows, ' + res.columns.length + ' columns' +
    (res.hasGeom ? ' (point geometry found and used for the coordinates)' : '') + '.');
  pastedSpecies();
  var show = function (r) { return '#' + r.id + ' ' + [MAS.colSpecies.getValue(), MAS.colLon.getValue(), MAS.colLat.getValue()].map(function (c) {
    return c === MAS.GEOM_OPTION ? (r.geom ? r.geom.join(', ') : '-') : String(r.props[c]); }).join(' | '); };
  MAS.setStatus('Pasted data read. Check the columns and pick the species.\nFirst row: ' + show(res.rows[0]) +
    '\nLast row: ' + show(res.rows[res.rows.length - 1]));
}
function pastedSpecies() {
  var col = MAS.colSpecies && MAS.colSpecies.getValue();
  if (!col || MAS.TABLE.kind !== 'pasted') return;
  var sp = MAS.uniq(MAS.TABLE.rows.map(function (r) { var v = r.props[col]; return v === null || v === undefined ? '' : MAS.trim(String(v)); })
    .filter(function (v) { return v !== '' && v !== 'NA'; })).sort();
  MAS.TABLE.species = sp;
  setSpecies(sp);
  MAS.dataInfo.setValue(MAS.dataInfo.getValue().replace(/ \| .*$/, '') + ' | ' + sp.length + ' species.');
}
// Returns {recs, noGeom, totalRows}
function loadRecords(cfg, cb) {
  function build(rows) {
    var recs = [], noGeom = [];
    rows.forEach(function (r) {
      var p = r.props;
      var lon = cfg.lonCol === MAS.GEOM_OPTION ? (r.geom ? r.geom[0] : NaN) : MAS.toNum(p[cfg.lonCol]);
      var lat = cfg.latCol === MAS.GEOM_OPTION ? (r.geom ? r.geom[1] : NaN) : MAS.toNum(p[cfg.latCol]);
      var declared = cfg.countryCol ? p[cfg.countryCol] : '';
      var rec = {id: r.id, declared: declared === null || declared === undefined ? '' : String(declared),
        collector: String(p.recordedBy || p.collector || ''), number: String(p.recordNumber || p.recordNumb || p.collectornumber || ''),
        source: r.manual ? 'added point' : 'table', year: cfg.yearCol ? parseYear(p[cfg.yearCol]) : NaN,
        basis: String(p.basisOfRecord || p.basisOfRec || ''), georef: String(p.georeferenceSources || p.georefer_2 || p.georeferen || ''),
        catalog: String(p.catalogNumber || p.catalogNum || '')};
      if (!isFinite(lon) || !isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lon === 0 && lat === 0)) {
        noGeom.push(rec); return;
      }
      rec.lon = lon; rec.lat = lat;
      recs.push(rec);
    });
    MAS.APP.manual.filter(function (m) { return m.species === cfg.species; }).forEach(function (m) {
      recs.push({id: m.id, lon: m.lon, lat: m.lat, declared: '', collector: 'added point', number: '', source: 'added point', year: NaN, basis: 'added point', georef: '', catalog: ''});
    });
    cb({recs: recs, noGeom: noGeom, totalRows: rows.length}, null);
  }
  if (cfg.kind === 'pasted') {
    build((MAS.TABLE.rows || []).filter(function (r) { var v = r.props[cfg.speciesCol]; return v !== null && v !== undefined && MAS.trim(String(v)) === cfg.species; }));
    return;
  }
  if (cfg.kind === 'example') {
    var rows = [];
    MAS.EXAMPLE_ROWS.forEach(function (r, i) {
      if (r[0] !== cfg.species) return;
      var props = {};
      MAS.EXAMPLE_COLUMNS.forEach(function (c, j) { props[c] = r[j]; });
      rows.push({id: i + 1, props: props, geom: null});
    });
    build(rows);
    return;
  }
  ee.FeatureCollection(cfg.assetId).filter(ee.Filter.eq(cfg.speciesCol, cfg.species)).limit(20000)
    .evaluate(function (fc, err) {
      if (err) { cb(null, err); return; }
      build(((fc && fc.features) || []).map(function (f, i) {
        var pr = f.properties || {};
        var own = MAS.toNum(pr.id !== undefined ? pr.id : pr.ID);
        var n = Number(f.id);
        return {id: isFinite(own) ? own : (isFinite(n) ? n + 1 : i + 1), props: pr,
                geom: f.geometry && f.geometry.type === 'Point' ? f.geometry.coordinates : null};
      }));
    });
}
function manualFC() {
  return ee.FeatureCollection(MAS.APP.manual.map(function (m) {
    return ee.Feature(ee.Geometry.Point([m.lon, m.lat]), {id: m.id, species: m.species, lon: m.lon, lat: m.lat, how: m.how});
  }));
}
function addPoint(lon, lat, how) {
  if (!isFinite(lon) || !isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { MAS.setStatus('Invalid coordinates.', true); return; }
  var sp = MAS.speciesSelect.getValue() || 'species';
  MAS.APP.manual.push({id: MAS.MANUAL_ID0 + MAS.APP.manual.length + 1, species: sp, lon: MAS.round(lon, 6), lat: MAS.round(lat, 6), how: how});
  refreshManual();
  MAS.setStatus('Point added (' + MAS.fmt(lon, 5) + ', ' + MAS.fmt(lat, 5) + '). Press "Assess" to include it.');
}
function refreshManual() {
  MAS.APP.manual.forEach(function (m, i) { m.id = MAS.MANUAL_ID0 + i + 1; });
  MAS.manualTablePanel.clear();
  MAS.manualTablePanel.add(ui.Label(MAS.APP.manual.length + ' added point(s)', MAS.S.small));
  if (MAS.APP.manual.length) {
    MAS.manualTablePanel.add(MAS.tableChart([['id', 'number'], ['Species', 'string'], ['Longitude', 'number'], ['Latitude', 'number'], ['How', 'string']],
      MAS.APP.manual.map(function (m) { return [m.id, m.species, m.lon, m.lat, m.how]; })));
  }
  if (MAS.APP.manualLayer) { try { Map.layers().remove(MAS.APP.manualLayer); } catch (e) {} MAS.APP.manualLayer = null; }
  if (MAS.APP.manual.length) {
    MAS.APP.manualLayer = ui.Map.Layer(manualFC().style({color: '00bcd4', pointSize: 6, width: 2}), {}, 'Added points');
    Map.layers().add(MAS.APP.manualLayer);
  }
}
