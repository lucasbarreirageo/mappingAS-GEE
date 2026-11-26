/**** mappingAS GEE 2.0.0 - module "documents": IUCN documents and files
 * Section 27: Word supplementary information, SIS coded tables, IUCN point and polygon attributes.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: utils, layout, iucn_calc, rangecalc, config, iucn_coding, report, tabs, sdm
 * Shared state created here: IUCN_POINT_COLS, SDM_REFS
 ****/

// ============================================================================
// 27. IUCN DOCUMENTS AND FILES (client side): Word supplementary information following the IUCN
//     templates (Arial 12 headings, Arial 11 text, "Table xx." captions, title "Common Name (Genus
//     species)"), SIS-style coded tables (CSV), points and range polygons with the IUCN attributes
//     (Standards Annex 1 and the point-data fields)
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.b64 = b64;
  MAS.fileLink = fileLink;
  MAS.docDownload = docDownload;
  MAS.csvCell = csvCell;
  MAS.csvOf = csvOf;
  MAS.iucnBase = iucnBase;
  MAS.iucnPointRows = iucnPointRows;
  MAS.iucnGeoJSON = iucnGeoJSON;
  MAS.sisCSV = sisCSV;
  MAS.wordShell = wordShell;
  MAS.wtable = wtable;
  MAS.titleTable = titleTable;
  MAS.supplementaryDoc = supplementaryDoc;
  MAS.bioclimateDoc = bioclimateDoc;
};

exports.run = function () {
  MAS.IUCN_POINT_COLS = ['sci_name', 'presence', 'origin', 'seasonal', 'compiler', 'yrcompiled', 'citation', 'dec_lat', 'dec_long', 'spatialref',
    'event_year', 'basisofrec', 'catalog_no', 'recordedby', 'recordno', 'source', 'country', 'adm1', 'elev_m', 'excluded', 'flags', 'record_id'];
  MAS.SDM_REFS = ['Aiello-Lammens, M.E. et al. 2015. spThin: an R package for spatial thinning of species occurrence records. Ecography 38: 541-545.',
    'Allouche, O., Tsoar, A. & Kadmon, R. 2006. Assessing the accuracy of species distribution models: prevalence, kappa and the true skill statistic (TSS). Journal of Applied Ecology 43: 1223-1232.',
    'Barbet-Massin, M., Jiguet, F., Albert, C.H. & Thuiller, W. 2012. Selecting pseudo-absences for species distribution models: how, where and how many? Methods in Ecology and Evolution 3: 327-338.',
    'Barve, N. et al. 2011. The crucial role of the accessible area in ecological niche modeling and species distribution modeling. Ecological Modelling 222: 1810-1819.',
    'Dormann, C.F. et al. 2013. Collinearity: a review of methods to deal with it and a simulation study evaluating their performance. Ecography 36: 27-46.',
    'Hirzel, A.H., Le Lay, G., Helfer, V., Randin, C. & Guisan, A. 2006. Evaluating the ability of habitat suitability models to predict species presences. Ecological Modelling 199: 142-152.',
    'Leroy, B. et al. 2018. Without quality presence-absence data, discrimination metrics such as TSS can be misleading measures of model performance. Journal of Biogeography 45: 1994-2002.',
    'Liu, C., White, M. & Newell, G. 2013. Selecting thresholds for the prediction of species occurrence with presence-only data. Journal of Biogeography 40: 778-789.',
    'Pearson, R.G., Raxworthy, C.J., Nakamura, M. & Peterson, A.T. 2007. Predicting species distributions from small numbers of occurrence records. Journal of Biogeography 34: 102-117.',
    'Phillips, S.J. & Dudík, M. 2008. Modeling of species distributions with Maxent: new extensions and a comprehensive evaluation. Ecography 31: 161-175.',
    'Roberts, D.R. et al. 2017. Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure. Ecography 40: 913-929.',
    'Valavi, R., Elith, J., Lahoz-Monfort, J.J. & Guillera-Arroita, G. 2019. blockCV: an R package for generating spatially or environmentally separated folds for k-fold cross-validation of species distribution models. Methods in Ecology and Evolution 10: 225-232.',
    'Valavi, R., Elith, J., Lahoz-Monfort, J.J. & Guillera-Arroita, G. 2021. Modelling species presence-only data with random forests. Ecography 44: 1731-1742.',
    'Valavi, R., Guillera-Arroita, G., Lahoz-Monfort, J.J. & Elith, J. 2022. Predictive performance of presence-only species distribution models: a benchmark study with reproducible code. Ecological Monographs 92: e01486.',
    'VanDerWal, J., Shoo, L.P., Graham, C. & Williams, S.E. 2009. Selecting pseudo-absence data for presence-only distribution modeling: how far should you stray from what you know? Ecological Modelling 220: 589-594.'];
};

function b64(txt) { return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(txt))) : null; }
function fileLink(panel, name, text, mime, note) {
  panel.clear();
  var l = ui.Label('⬇ ' + name + ' (' + MAS.fmt(text.length / 1024, 0) + ' KB)', {color: '#1a5fb4', fontSize: '13px', fontWeight: 'bold'});
  var e = b64(text);
  if (e) l.setUrl('data:' + (mime || 'application/octet-stream') + ';base64,' + e);
  panel.add(l);
  panel.add(ui.Label((note ? note + ' ' : '') + 'If the link does not open, copy the box below into a text file with this name.', MAS.S.small));
  panel.add(ui.Textbox({value: text, style: {stretch: 'horizontal'}}));
}
function docDownload(panel, name, html) { try { fileLink(panel, name, html, 'application/msword', 'Opens in Word (saved as a web-format .doc; use "Save as .docx").'); } catch (e) { panel.add(ui.Label('Error: ' + e.message, {color: '#b30000'})); } }
function csvCell(v) {
  if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return '';
  var s = String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvOf(header, rows) { return [header.join(',')].concat(rows.map(function (r) { return r.map(csvCell).join(','); })).join('\n'); }
// ---- IUCN point and polygon attributes
function iucnBase(R) {
  var r = MAS.RL(R);
  return {sci_name: R.cfg.species.split(' ').slice(0, 2).join(' '), compiler: r.compiler || r.assessors || '', yrcompiled: MAS.THIS_YEAR,
    citation: r.citation || r.assessors || '', origin: 1, seasonal: 1, data_sens: 0};
}
function iucnPointRows(R) {
  var b = iucnBase(R), since = MAS.RL(R).since, fl = {};
  MAS.recordFlags(R).forEach(function (f) { fl[f.id] = f; });
  return R.all.map(function (r) {
    var pres = !isFinite(r.year) || r.year >= since ? 1 : 6;
    return [b.sci_name, pres, b.origin, b.seasonal, b.compiler, b.yrcompiled, b.citation, MAS.round(r.lat, 6), MAS.round(r.lon, 6), 'WGS84',
      isFinite(r.year) ? r.year : '', r.basis || (r.source === 'added point' ? 'HumanObservation' : 'PreservedSpecimen'), r.catalog || '',
      r.collector || '', r.number || '', r.source, r.country || '', r.adm1 || '', isFinite(r.elev) ? Math.round(r.elev) : '', r.excluded ? 1 : 0,
      fl[r.id] ? fl[r.id].flags.join('; ') : '', r.id];
  });
}
function iucnGeoJSON(R) {
  var b = iucnBase(R), feats = [];
  var att = function (extra) { return MAS.merge({ID_NO: null, BINOMIAL: b.sci_name, PRESENCE: 1, ORIGIN: 1, SEASONAL: 1, COMPILER: b.compiler, YEAR: MAS.THIS_YEAR,
    CITATION: b.citation, SOURCE: 'mappingAS Earth Engine', DIST_COMM: '', DATA_SENS: 0}, extra); };
  if (R.hull && R.hull.ring) feats.push({type: 'Feature', geometry: {type: 'Polygon', coordinates: [MAS.densifyRing(R.hull.ring, MAS.EOO_SEGMENT_KM)]},
    properties: att({LAYER: 'EOO', AREA_KM2: MAS.round(R.eooKm2, 2), DIST_COMM: 'Minimum convex polygon of ' + R.recs.length + ' records, for the EOO value only - not a range map (draw the range from the AOH and the records)'})});
  R.aoo.cells.forEach(function (c, i) {
    feats.push({type: 'Feature', geometry: {type: 'Polygon', coordinates: [c.ring]},
      properties: att({LAYER: 'AOO cell', CELL: i + 1, AREA_KM2: R.cfg.aooKm * R.cfg.aooKm, N_RECORDS: c.recs.length, DIST_COMM: R.cfg.aooKm + ' km AOO cell'})});
  });
  iucnPointRows(R).forEach(function (row) {
    var p = {}; MAS.IUCN_POINT_COLS.forEach(function (k, j) { p[k] = row[j]; }); p.LAYER = 'record';
    feats.push({type: 'Feature', geometry: {type: 'Point', coordinates: [row[8], row[7]]}, properties: p});
  });
  return JSON.stringify({type: 'FeatureCollection', features: feats});
}
// ---- SIS-style coded tables (one long CSV)
function sisCSV(R) {
  var ov = MAS.rlCategories(R), r = MAS.RL(R), rows = [], pt = MAS.popTrend(R), gl = MAS.genLength(R);
  function add(sec, code, name, a, b2, c2, d) { rows.push([R.cfg.species, sec, code, name, a, b2, c2, d]); }
  add('Assessment', ov.category, MAS.IUCN_CAT_NAME[ov.category] || '', ov.code, 'plausible ' + ov.high + '-' + ov.low, 'attitude ' + r.attitude, ov.rule);
  ov.crit.forEach(function (c) { add('Criterion', c.k, c.code, 'best ' + c.best, 'low ' + c.low, 'high ' + c.high, ''); });
  add('Scope', r.scope, '', '', '', '', '');
  add('Data field', 'EOO', 'Extent of occurrence (km2)', MAS.round(R.eooKm2, 1), '', '', 'minimum convex polygon');
  add('Data field', 'AOO', 'Area of occupancy (km2)', R.aoo.areaKm2 + '-' + MAS.round(MAS.aooUpper(R), 0), R.aoo.areaKm2, '', 'best = records on a ' + R.cfg.aooKm + ' km grid; upper = AOH within the grid');
  add('Data field', 'LOC', 'Number of locations', R.loc.n, '', '', R.loc.method);
  add('Data field', 'SF', 'Severely fragmented', R.assess.frag ? 'Yes' : 'No', '', '', '');
  add('Data field', 'GL', 'Generation length (years)', MAS.round(gl.gl, 2), '', '', gl.how);
  add('Data field', 'RED', 'Population reduction (%)', MAS.round(ov.A.reduction, 1), MAS.round(ov.A.redLow, 1) + '-' + MAS.round(ov.A.redHigh, 1), ov.A.from + '-' + ov.A.to, ov.A.sub + ov.A.letters + ' ' + ov.A.qualifier);
  add('Data field', 'POP', 'Number of mature individuals', isFinite(r.nBest) ? r.nBest : '', isFinite(r.nMin) ? r.nMin + '-' + r.nMax : '', '', '');
  add('Data field', 'TREND', 'Current population trend', pt.trend, pt.qualifier, '', '');
  add('Data field', 'ELEV', 'Elevation limits (m)', R.recElev ? Math.round(R.recElev.min) : '', R.recElev ? Math.round(R.recElev.max) : '', '', 'Copernicus DEM at the records');
  add('System', r.sysT ? 'Terrestrial' : '', r.sysF ? 'Freshwater' : '', r.sysM ? 'Marine' : '', '', '', '');
  if (r.kingdom === 'PLANTAE') add('Plant growth form', r.growthForm, '', '', '', '', '');
  MAS.countryCoding(R).forEach(function (c) { add('Country', c.country, MAS.PRESENCE[c.presence], c.presence, MAS.ORIGIN[c.origin], MAS.SEASONAL[c.seasonal], c.why); });
  MAS.subCountry(R).forEach(function (s) { add('Sub-country', s.adm1, s.country, MAS.PRESENCE[s.presence], s.n, '', ''); });
  var rb = MAS.realmsBiomes(R);
  Object.keys(rb.realm).forEach(function (k) { add('Biogeographic realm', k, '', rb.realm[k], '', '', ''); });
  rb.eco.forEach(function (e) { add('Ecoregion', e.name, e.biome, e.n, MAS.round(e.km2, 1), MAS.round(e.pct, 1), ''); });
  MAS.habitatCoding(R).filter(function (h) { return h.on; }).forEach(function (h) { add('Habitat', h.code, h.name, h.suitability, 'major importance: ' + h.major, h.n, h.classList); });
  MAS.threatCoding(R).filter(function (t) { return t.on; }).forEach(function (t) { add('Threat', t.code, t.name, t.timing, t.scope, t.severity, (t.major ? 'MAJOR; ' : '') + 'stresses ' + t.stressNames + '; ' + t.evidence); });
  MAS.consInPlace(R).forEach(function (q) { add('Conservation in place', '', q[0], q[1], '', '', ''); });
  MAS.actionsNeeded(R, ov.category).filter(function (a) { return a.on; }).forEach(function (a) { add('Conservation needed', a.code, a.name, a.why, '', '', ''); });
  MAS.researchNeeded(R, ov.category).filter(function (a) { return a.on; }).forEach(function (a) { add('Research needed', a.code, a.name, a.why, '', '', ''); });
  add('Use and trade', r.useTrade, '', '', '', '', '');
  var N = MAS.narratives(R);
  ['range', 'population', 'habitat', 'threats', 'conservation', 'useTrade', 'rationale'].forEach(function (k) { add('Narrative', k, N[k], '', '', '', ''); });
  return csvOf(['species', 'section', 'code', 'name', 'value_1', 'value_2', 'value_3', 'note'], rows);
}
// ---- Word documents
function wordShell(title, body) {
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><title>' + MAS.esc(title) + '</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->' +
    '<style>@page Section1{size:8.5in 11.0in;margin:1.0in 1.25in 1.0in 1.25in;} div.Section1{page:Section1;}' +
    'body{font-family:Arial;font-size:11pt;} h1{font-family:Arial;font-size:14pt;} h2{font-family:Arial;font-size:12pt;margin-top:14pt;} h3{font-family:Arial;font-size:11pt;font-style:italic;}' +
    'p,li,td,th{font-family:Arial;font-size:11pt;} table{border-collapse:collapse;margin:4pt 0;} td,th{border:1px solid #888;padding:2pt 4pt;vertical-align:top;}' +
    'th{background:#e8e8e8;} .cap{font-family:Arial;font-size:11pt;font-weight:bold;margin-top:6pt;} .note{font-size:9pt;color:#555;}</style></head>' +
    '<body><div class="Section1">' + body + '</div></body></html>';
}
function wtable(cap, header, rows) {
  return '<p class="cap">' + MAS.esc(cap) + '</p><table><tr>' + header.map(function (h) { return '<th>' + MAS.esc(h) + '</th>'; }).join('') + '</tr>' +
    rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + MAS.esc(c === null || c === undefined || (typeof c === 'number' && !isFinite(c)) ? '' : c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
}
function titleTable(R) {
  var r = MAS.RL(R), parts = R.cfg.species.split(' ');
  return '<table style="width:100%"><tr><td style="font-size:12pt;font-weight:bold;">' + MAS.esc(r.commonName || 'Common Name') + ' (<i>' + MAS.esc(parts.slice(0, 2).join(' ')) + '</i>' +
    (parts.length > 2 ? ' ' + MAS.esc(parts.slice(2).join(' ')) : '') + ')</td></tr></table>';
}
function supplementaryDoc(R) {
  var r = MAS.RL(R), ov = MAS.rlCategories(R), N = MAS.narratives(R), ca = ov.A, per = MAS.recordPeriods(R), sc = MAS.aooScales(R), ah = MAS.alphaHull(R, 2), t = 0, tb = function () { t++; return 'Table ' + t + '. '; };
  var cs = MAS.cellSummary(R), html = '<p style="font-size:12pt;font-weight:bold;">Supplementary information</p>' + titleTable(R);
  html += '<h2>1. Red List assessment</h2><p><b>' + MAS.esc(MAS.IUCN_CAT_NAME[ov.category] || ov.category) + ' - ' + MAS.esc(ov.code) + '</b>' +
    (ov.low !== ov.high ? ' (plausible range ' + MAS.esc(ov.high) + '-' + MAS.esc(ov.low) + ', notation ' + MAS.esc(ov.notation) + ')' : '') + '. Scope: ' + MAS.esc(r.scope) + '.</p>' +
    '<p>' + MAS.esc(N.rationale) + '</p>';
  html += wtable(tb() + 'Criteria evaluated, with best estimates and plausible categories.', ['Criterion', 'Result', 'Best', 'Lowest plausible', 'Highest plausible'],
    ov.crit.map(function (c) { return [c.k, c.code, c.best, c.low, c.high]; }));
  html += '<h2>2. Methods</h2><p>' + MAS.esc(MAS.methodsLines(R).concat(['Generation length: ' + MAS.genLength(R).how + '.']).join(' ')) + '</p>';
  html += '<h2>3. Distribution</h2><p>' + MAS.esc(N.range) + '</p>';
  html += wtable(tb() + 'Range parameters.', ['Parameter', 'Value', 'Note'], [
    ['EOO (km²)', MAS.fmt(R.eooKm2, 1), 'minimum convex polygon'], ['AOO (km²)', R.aoo.areaKm2, R.aoo.n + ' cells of ' + R.cfg.aooKm + ' km'],
    ['AOO upper bound (km²)', MAS.fmt(MAS.aooUpper(R), 0), 'AOH within the EOO on a 2 x 2 km grid (Guidelines 4.10.8)'], ['Alpha hull, α = 2 (km²)', MAS.fmt(ah.area, 1), 'for trends only, not for B1'],
    ['Locations', R.loc.n, R.loc.method], ['Subpopulations', R.subpop.n, 'circular buffers ' + MAS.fmt(R.subpop.radiusKm, 1) + ' km'],
    ['Elevation of the records (m)', R.recElev && isFinite(R.recElev.min) ? Math.round(R.recElev.min) + '-' + Math.round(R.recElev.max) : '', 'Copernicus GLO-30'],
    ['Occupied cells without AOH in ' + R.y1, cs ? cs.noHab + ' of ' + cs.n : '', cs ? cs.lost + ' lost since ' + R.yA : '']]);
  html += wtable(tb() + 'AOO at different grid sizes (area-area relationship, Guidelines 4.10).', ['Cell (km)', 'Cells', 'AOO (km²)'], sc.map(function (s) { return [s.km, s.n, s.area]; }));
  html += wtable(tb() + 'Current and historical records (current = since ' + per.since + ').', ['Records', 'N', 'EOO (km²)', 'AOO (km²)'],
    [['All', per.all.n, MAS.fmt(per.all.eoo, 0), per.all.aoo], ['Current + undated', per.current.n, MAS.fmt(per.current.eoo, 0), per.current.aoo],
     ['Current (dated only)', per.currentDated.n, MAS.fmt(per.currentDated.eoo, 0), per.currentDated.aoo], ['Historical', per.historical.n, MAS.fmt(per.historical.eoo, 0), per.historical.aoo]]);
  html += wtable(tb() + 'Countries of occurrence.', ['Country', 'Presence', 'Origin', 'Seasonality', 'Records', 'Last record', 'Basis'],
    MAS.countryCoding(R).map(function (c) { return [c.country, MAS.PRESENCE[c.presence], MAS.ORIGIN[c.origin], MAS.SEASONAL[c.seasonal], c.n, isFinite(c.last) ? c.last : '', c.why]; }));
  var sub = MAS.subCountry(R);
  if (sub.length) html += wtable(tb() + 'Sub-country occurrence (FAO GAUL level 1).', ['Country', 'Unit', 'Presence', 'Records'], sub.map(function (s) { return [s.country, s.adm1, MAS.PRESENCE[s.presence], s.n]; }));
  var rb = MAS.realmsBiomes(R);
  html += wtable(tb() + 'Biogeographic realms, biomes and ecoregions (RESOLVE 2017).', ['Ecoregion', 'Biome', 'Records', 'Area in the range (km²)', '%'],
    rb.eco.map(function (e) { return [e.name, e.biome, e.n, MAS.fmt(e.km2, 0), MAS.fmt(e.pct, 1)]; }));
  html += '<h2>4. Population</h2><p>' + MAS.esc(N.population) + '</p>';
  if (isFinite(ca.reduction)) html += wtable(tb() + 'Criterion ' + ca.sub + ': habitat (AOH) reduction over ' + ca.window + ' years (' + ca.from + '-' + ca.to + ').',
    ['Extent', 'Observed %', 'Exponential %', 'Linear %', 'Best habitat %', 'Population % (z = ' + ca.z + ')'],
    [ca.E, ca.A].filter(function (x) { return x; }).map(function (m) { return [m.scope, MAS.round(m.obs, 1), MAS.round(m.exp, 1), MAS.round(m.lin, 1), MAS.round(m.best, 1), MAS.round(MAS.popRed(m.best, ca.z), 1)]; }));
  html += '<h2>5. Habitats and ecology</h2><p>' + MAS.esc(N.habitat) + '</p>';
  html += wtable(tb() + 'Habitats (IUCN Habitats Classification Scheme 3.1).', ['Code', 'Habitat', 'Suitability', 'Major importance', 'Records', 'Land-cover classes'],
    MAS.habitatCoding(R).filter(function (h) { return h.on; }).map(function (h) { return [h.code, h.name, h.suitability, h.major, h.n, h.classList]; }));
  html += '<h2>6. Threats</h2><p>' + MAS.esc(N.threats) + '</p>';
  html += wtable(tb() + 'Threats (IUCN-CMP Threats Classification 3.3; v4.0 name where it changed). * = major threat.',
    ['Code', 'Threat', 'Timing', 'Scope', 'Severity', 'Stresses', 'Evidence'],
    MAS.threatCoding(R).filter(function (x) { return x.on; }).map(function (x) { return [x.code + (x.major ? '*' : ''), x.name + (x.v4 ? ' (v4.0: ' + x.v4 + ')' : ''), x.timing, x.scope, x.severity, x.stressNames, x.evidence]; }));
  html += '<h2>7. Conservation</h2><p>' + MAS.esc(N.conservation) + '</p>';
  html += wtable(tb() + 'Conservation actions in place.', ['Question', 'Answer'], MAS.consInPlace(R));
  html += wtable(tb() + 'Conservation actions and research needed.', ['Scheme', 'Code', 'Action', 'Reason'],
    MAS.actionsNeeded(R, ov.category).filter(function (a) { return a.on; }).map(function (a) { return ['Conservation Actions Needed', a.code, a.name, a.why]; })
      .concat(MAS.researchNeeded(R, ov.category).filter(function (a) { return a.on; }).map(function (a) { return ['Research Needed', a.code, a.name, a.why]; })));
  html += '<p>Use and trade: ' + MAS.esc(N.useTrade) + '</p>';
  html += wtable(tb() + 'Record checks.', ['Record', 'Flags'], MAS.recordFlags(R).filter(function (f) { return f.flags.length; }).map(function (f) { return [f.id, f.flags.join('; ')]; }));
  html += wtable(tb() + 'Pre-submission checklist (Documentation Standards, section 5).', ['', 'Item'], MAS.checklist(R));
  html += '<h2>8. References</h2>' + MAS.dataSources(R).map(function (s) { return '<p>' + MAS.esc(s) + '</p>'; }).join('');
  html += '<p class="note">Assessor(s): ' + MAS.esc(r.assessors || '-') + '. Reviewer(s): ' + MAS.esc(r.reviewers || '-') + '. Contributors: ' + MAS.esc(r.contributors || '-') +
    '. Generated by mappingAS Earth Engine on ' + new Date().toISOString().slice(0, 10) + '.</p>';
  return wordShell('Supplementary information - ' + R.cfg.species, html);
}
function bioclimateDoc(R) {
  var S = R.SDM, r = MAS.RL(R), t = 0, tb = function () { t++; return 'Table ' + t + '. '; };
  if (!S || !S.done) return wordShell('Bioclimate model', '<p>Run the bioclimate model first.</p>');
  var c = S.cfg, per = MAS.recordPeriods(R), ys = R.recs.map(function (x) { return x.year; }).filter(isFinite);
  var types = {}; R.recs.forEach(function (x) { var k = x.basis || 'not given'; types[k] = (types[k] || 0) + 1; });
  var tech = S.techs.map(function (x) { return x === 'MX' ? 'Maxent (Phillips et al. 2006; Earth Engine ee.Classifier.amnhMaxent, cloglog output, automatic feature classes by sample size and default ' +
    'regularization multiplier 1 as tuned by Phillips & Dudík 2008, clamping on)' : 'Random Forest (Breiman 2001; ee.Classifier.smileRandomForest, probability output), down-sampled to balance presences and ' +
    'background (Valavi et al. 2021, 2022): ' + S.M + ' forests of 100 trees, each fitted to all presences and an equal number of random background points, predictions averaged (Barbet-Massin et al. 2012)'; });
  var h = '<p style="font-size:12pt;font-weight:bold;">Supplementary Information for Bioclimate Models</p>' + titleTable(R);
  h += '<h2>1. General information</h2><p>a. Taxon: <i>' + MAS.esc(R.cfg.species) + '</i></p><p>b. Red List assessment scope: ' + MAS.esc(r.scope) + '</p>' +
    '<p>c. Authors: ' + MAS.esc(r.assessors || '-') + '</p><p>d. Date: ' + new Date(S.finished).toISOString().slice(0, 10) + '</p>' +
    '<p>e. Other: model run in Google Earth Engine with the mappingAS app; all settings are listed below and the app reproduces the run.</p>';
  h += '<h2>2. Species data (the response variable)</h2><p>a. Type: presence-background.</p><p>b. Species occurrence data</p>' +
    '<p>(i) Source: ' + MAS.esc(MAS.dataSources(R)[0]) + '</p><p>(ii) Record types: ' + Object.keys(types).map(function (k) { return k + ' ' + MAS.fmt(100 * types[k] / R.recs.length, 0) + '%'; }).join(', ') + '.</p>' +
    '<p>(iii) Geographic extent: all records retained after the checks (' + R.recCountries.join(', ') + '; EOO ' + MAS.fmt(R.eooKm2, 0) + ' km²), covering the known range.</p>' +
    '<p>(iv) Temporal extent: ' + (ys.length ? Math.min.apply(null, ys) + '-' + Math.max.apply(null, ys) : 'dates not available') + ' (' + per.nUndated + ' undated records).</p>' +
    '<p>(v) Bias reduction: records with georeferencing errors excluded by the assessor (ids ' + (R.cfg.exclude.join(', ') || 'none') + '); duplicates removed; spatial thinning at ' +
      c.thinKm + ' km (one record per ' + c.thinKm + ' km, at least the 1 km resolution of the predictors; Aiello-Lammens et al. 2015).</p><p>(vi) Sample size: ' + S.nP + ' presences.</p>' +
    '<p>c. Background data</p><p>(i) Sample size: ' + S.nB + ' points (a large number, e.g. 10,000, is recommended for Maxent and regression methods; Barbet-Massin et al. 2012, Phillips & Dudík 2008).</p><p>(ii) Geographic extent: ' + (c.bgMode === 'ECO' ? 'RESOLVE 2017 ecoregions containing the records, within ' : 'a buffer of ') +
      c.bufKm + ' km of the records (' + MAS.fmt(S.areaKm2, 0) + ' km²), approximating the area accessible to the species (Barve et al. 2011); intermediate extents perform better than very restricted or very broad ones (VanDerWal et al. 2009).</p><p>(iii) Selection method: Random.</p>';
  h += '<h2>3. Environmental variables (the predictor variables)</h2><p>a. Climatic variables: ' + S.vars.map(function (v) { return v + ' (' + MAS.BIO_NAMES[v] + ')'; }).join('; ') +
    '. [Justify each variable in terms of the biology of the species.]' + (R.SDMscreen ? ' Variables screened before the run by univariate AUC and pairwise correlation at the background (|r| < 0.7, as "select07" in Dormann et al. 2013), with variance inflation factors.' : '') + (S.cor.length ? ' Correlated pairs (|r| ≥ 0.7): ' + S.cor.map(function (x) { return x[0] + '-' + x[1] + ' ' + x[2]; }).join('; ') + '.' : ' No pair with |r| ≥ 0.7.') + '</p>' +
    '<p>b. Climate scenarios: ' + S.ssps.map(function (s) { return s.toUpperCase(); }).join(' and ') + ' (intermediate and high emissions), projected separately.</p>' +
    '<p>c. Climate models: ' + S.gcms.join(', ') + ' from NASA NEX-GDDP-CMIP6 (bias-corrected, 0.25°), projected separately (no ensemble-mean climate).</p>' +
    '<p>d. Time points: baseline WorldClim 1.4 (1960-1990); recent 1995-2014 and future ' + S.fut[0] + '-' + S.fut[1] + ' (centred on ' + S.target +
      ' = now + max(10 years, 3 generations)) built with the delta method: monthly GCM changes relative to 1961-1990 (temperature additive, precipitation ratio bounded 0.1-10) ' +
      'added to the WorldClim monthly climatology, then the bioclimatic variables computed from the 12 months in the same way for every time point.</p>' +
    '<p>e. Non-climatic variables: none as predictors (no elevation, latitude or longitude). Land use was used as an exclusion: ' + (c.landMask ? 'suitability weighted by the fraction of the AOH land-cover classes in ' + R.year + ' (current land use kept in the future).' : 'not applied.') + '</p>';
  h += '<h2>4. Model Building and Evaluation</h2><p>a. Modeling approaches: ' + tech.join('; ') + '.</p>' +
    '<p>b. Model complexity: ' + S.vars.length + ' variables for ' + S.nP + ' presences' + (S.techs.indexOf('RF') >= 0 && S.vars.length > Math.floor(S.nP / 5) ? ' (more than one per five records for Random Forest: interpret with care)' : '') +
      ' (Guidelines: at most one variable per five records; not binding for Maxent, which selects features by regularization); response beyond the calibrated range: last value (clamping in Maxent; ' +
      'constant beyond the data in Random Forest; Guidelines Fig. 12.2 (b)).</p>' +
    '<p>c. Model evaluation: ' + (S.ev === 'JK' ? 'n-1 jackknife (' + S.k + ' models per technique, fewer than 25 presences; Pearson et al. 2007): omission of the left-out presence at the lowest presence threshold of the remaining ones and the p-value of the number of successes, plus AUC and TSS against the background' :
      S.k + '-fold cross-validation with ' + (S.randomFolds ? 'random folds (all records in one spatial block)' : 'spatial blocks of ' + S.blockKm + ' km assigned to folds to balance presences (Roberts et al. 2017; Valavi et al. 2019; block size from the autocorrelation range of the predictors when screened)') +
      '; AUC, TSS (Allouche et al. 2006) at the threshold estimated on the training folds, maximum TSS and the continuous Boyce index (Hirzel et al. 2006) on the held-out folds') +
      '. AUC and TSS computed with background points rank models but are not absolute accuracies (Leroy et al. 2018).</p>' +
    '<p>Thresholds: ' + S.techs.map(function (x) { return (x === 'MX' ? 'Maxent ' : 'RF ') + S.thr[x].mode + ' = ' + MAS.fmt(S.thr[x].value, 4); }).join('; ') +
      ' (LPT, lowest presence threshold, for fewer than 25 records, Pearson et al. 2007; otherwise the maximum sum of sensitivity and specificity, Liu et al. 2013, as the Guidelines advise balancing both with more records).</p>' +
    '<p>d. Uncertainties: ' + S.techs.length + ' techniques x ' + S.gcms.length + ' GCMs x ' + S.ssps.length + ' scenarios, each projected separately; the median is the best estimate and the range the plausible values (Guidelines 4.5.2); dispersal scenarios reported as a sensitivity analysis.</p>' +
    '<p>e. Exclusions: ' + (c.landMask ? 'land use (AOH classes); ' : '') + (c.disp === 'NONE' ? 'no dispersal (future suitability counted only where suitable now)' :
      S.dm === 'L' ? 'dispersal limited to ' + S.dispKm + ' km from the currently suitable area (dispersal distance x years to the target / age at first reproduction; Guidelines 12.1.12.4)' : 'unlimited dispersal within the background extent') +
      (S.dispFallback ? ' - dispersal distance not available, no dispersal used as a precautionary assumption' : '') + '.</p>';
  h += '<h2>5. Results</h2><p>a. Calculation of Red List parameters: relative change in summed suitability between 1995-2014 and ' + S.fut[0] + '-' + S.fut[1] +
    ' within the exclusions, used as the projected population reduction for Criterion A3 (Guidelines 12.1.12.4).</p>';
  h += wtable(tb() + 'Model evaluation and thresholds.', MAS.EVAL_H, MAS.evalRows(S));
  h += wtable(tb() + 'Projected reduction by dispersal assumption (median and range across techniques, GCMs and scenarios).', ['Dispersal', 'Median %', 'Min %', 'Max %', 'Category'], MAS.dispRows(S));
  h += wtable(tb() + 'Summed suitability and suitable area by technique and climate.', ['Technique', 'Climate', 'Summed suitability', 'Suitable km²', 'Change vs 1995-2014 %'],
    S.rows.map(function (x) { return [x.t === 'MX' ? 'Maxent' : 'RF', x.p.label, MAS.fmt(x.sum, 1), MAS.fmt(x.area, 1), isFinite(x.redFromRecent) ? MAS.fmt(-x.redFromRecent, 1) : '']; }));
  h += '<p>b. Model results: projected reduction median ' + MAS.fmt(S.redBest, 1) + '% (range ' + MAS.fmt(S.redLo, 1) + ' to ' + MAS.fmt(S.redHi, 1) + '%), Criterion A3c ' + MAS.catOfRed('A3', S.redBest) + '.</p>';
  h += '<h2>6. References</h2>' + MAS.SDM_REFS.map(function (x) { return '<p>' + MAS.esc(x) + '</p>'; }).join('') + '<p>Breiman, L. 2001. Random forests. Machine Learning 45: 5-32.</p><p>Hijmans, R.J. et al. 2005. Very high resolution interpolated climate surfaces for global land areas. International Journal of Climatology 25: 1965-1978.</p>' +
    '<p>Phillips, S.J., Anderson, R.P. & Schapire, R.E. 2006. Maximum entropy modeling of species geographic distributions. Ecological Modelling 190: 231-259.</p>' +
    '<p>Thrasher, B. et al. 2022. NASA Global Daily Downscaled Projections, CMIP6. Scientific Data 9: 262.</p><p>Dinerstein, E. et al. 2017. An ecoregion-based approach to protecting half the terrestrial realm. BioScience 67: 534-545.</p>' +
    '<p>IUCN Standards and Petitions Committee. Guidelines for Using the IUCN Red List Categories and Criteria (section 12.1).</p>';
  return wordShell('Bioclimate model - ' + R.cfg.species, h);
}
