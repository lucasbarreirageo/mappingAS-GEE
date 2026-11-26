/**** mappingAS GEE 2.0.0 - module "layout": user interface layout
 * Section 7: left panel (data, options, run button) and the tabbed results panel.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: config, utils, records
 * Shared state created here: lsib, WDPA_ALL, ESRI_IC, S, controls, mainPanel, SRC_PASTE, SRC_ASSET, srcSelect, pasteBox, pasteBtn, assetBox, readBtn, holdSpeciesCol, holdLon, holdLat, holdCountry, holdYear, holdSpecies, colSpecies, colLon, colLat, colCountry, colYear, speciesSelect, dataInfo, productSel, strategySel, yearBox, startBox, endBox, transBox, stepBox, waterChk, aooBox, locBox, locMethodSel, excludeBox, countryModeSel, wdpaSel, scaleBox, genLenBox, habChk, patchSel, isoBox, threatChk, climChk, climStartBox, climNBox, cmipChk, suitSel, suitBox, elevModeSel, elevMinBox, elevMaxBox, elevMarginBox, runBtn, statusLabel, PROG, progSpin, progFill, progList, STEP_ICON, STEP_COLOR, spatialFmtSel, spatialBtn, spatialLinks, exportBtn, TAB_NAMES, TABS, tabButtons, tabContent, CURRENT_TAB, APP
 ****/

// ============================================================================
// 7. USER INTERFACE: sidebar + tabbed results panel
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.progStart = progStart;
  MAS.elapsed = elapsed;
  MAS.progTick = progTick;
  MAS.progSet = progSet;
  MAS.progDraw = progDraw;
  MAS.setStatus = setStatus;
  MAS.showTab = showTab;
  MAS.tabHead = tabHead;
  MAS.tabNote = tabNote;
  MAS.tabAdd = tabAdd;
  MAS.placeholder = placeholder;
  MAS.fcToDicts = fcToDicts;
  MAS.propsList = propsList;
  MAS.safeRun = safeRun;
};

exports.run = function () {
  MAS.lsib = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
  MAS.WDPA_ALL = ee.FeatureCollection('WCMC/WDPA/current/polygons');
  MAS.ESRI_IC = ee.ImageCollection(MAS.ESRI_ID);
  MAS.S = {small: {fontSize: '12px', color: '#555'}, h: {fontWeight: 'bold', fontSize: '14px', margin: '12px 8px 2px 8px'},
           stretch: {stretch: 'horizontal'}};
  MAS.controls = ui.Panel({style: {width: '340px', padding: '6px'}});
  MAS.mainPanel = ui.Panel({style: {width: '580px', padding: '4px'}});
  ui.root.insert(0, MAS.controls);
  ui.root.add(MAS.mainPanel);
  MAS.controls.add(ui.Label('mappingAS · Earth Engine', {fontWeight: 'bold', fontSize: '20px', color: '#1f5f3a'}));
  MAS.controls.add(ui.Label('EOO/AOO, locations, land cover, time series, protected areas and IUCN Criterion B ' +
    'for species in one or more countries.', MAS.S.small));
  MAS.controls.add(ui.Label('1. Occurrence data', MAS.S.h));
  MAS.SRC_PASTE = 'Paste CSV / GeoJSON (no asset)';
  MAS.SRC_ASSET = 'Asset table (CSV)';
  var SRC_EXAMPLE = 'Example: Prepusa connata, P. hookeriana';
  MAS.srcSelect = ui.Select({items: [MAS.SRC_PASTE, MAS.SRC_ASSET, SRC_EXAMPLE], value: MAS.DEFAULTS.asset ? MAS.SRC_ASSET : SRC_EXAMPLE, style: MAS.S.stretch});
  MAS.pasteBox = ui.Textbox({placeholder: 'Paste the table here: CSV / TSV copied from Excel (header in the first row) or a GeoJSON', style: MAS.S.stretch});
  MAS.pasteBtn = ui.Button({label: 'Read pasted data', style: MAS.S.stretch});
  MAS.assetBox = ui.Textbox({placeholder: 'projects/my-project/assets/occurrences', value: MAS.DEFAULTS.asset, style: MAS.S.stretch});
  MAS.readBtn = ui.Button({label: 'Read asset columns', style: MAS.S.stretch});
  // Drop-downs whose options change are re-created inside these holders (safer than items().reset()).
  MAS.holdSpeciesCol = ui.Panel();
  MAS.holdLon = ui.Panel();
  MAS.holdLat = ui.Panel();
  MAS.holdCountry = ui.Panel();
  MAS.holdYear = ui.Panel();
  MAS.holdSpecies = ui.Panel();
  MAS.colSpecies = null;
  MAS.colLon = null;
  MAS.colLat = null;
  MAS.colCountry = null;
  MAS.colYear = null;
  MAS.speciesSelect = null;
  MAS.dataInfo = ui.Label('', MAS.S.small);
  [MAS.srcSelect, ui.Label('Pasted data (only for "Paste"): stays in your browser, no asset needed', MAS.S.small), MAS.pasteBox, MAS.pasteBtn,
   ui.Label('Asset id (only for "Asset table")', MAS.S.small), MAS.assetBox, MAS.readBtn,
   ui.Label('Species column', MAS.S.small), MAS.holdSpeciesCol, ui.Label('Longitude column', MAS.S.small), MAS.holdLon,
   ui.Label('Latitude column', MAS.S.small), MAS.holdLat, ui.Label('Country column (optional)', MAS.S.small), MAS.holdCountry,
   ui.Label('Year or date of the record (optional: date last recorded, current vs historical records)', MAS.S.small), MAS.holdYear,
   ui.Label('Species', MAS.S.small), MAS.holdSpecies, MAS.dataInfo]
    .forEach(function (w) { MAS.controls.add(w); });
  MAS.controls.add(ui.Label('2. Land cover', MAS.S.h));
  MAS.productSel = ui.Select({items: [
    {label: 'Auto (MapBiomas in South America, Sentinel-2 elsewhere)', value: 'AUTO'},
    {label: 'MapBiomas (each country its own collection)', value: 'MAPBIOMAS'},
    {label: 'Sentinel-2 / Esri global 10 m (2017 onwards)', value: 'ESRI'}], value: MAS.DEFAULTS.product, style: MAS.S.stretch});
  MAS.strategySel = ui.Select({items: [
    {label: 'MapBiomas: national collections first (Amazonia only where missing)', value: 'NATIONAL_FIRST'},
    {label: 'MapBiomas: Amazonia first, national collections outside it', value: 'REGIONAL_FIRST'}],
    value: MAS.DEFAULTS.strategy, style: MAS.S.stretch});
  MAS.yearBox = ui.Textbox({placeholder: 'land-cover year for map/conversion (blank = latest)', style: MAS.S.stretch});
  MAS.startBox = ui.Textbox({placeholder: 'series start year (blank = automatic)', style: MAS.S.stretch});
  MAS.endBox = ui.Textbox({placeholder: 'series end year (blank = automatic)', style: MAS.S.stretch});
  MAS.transBox = ui.Textbox({placeholder: 'transitions, e.g. 1985-2000, 2000-2023 (blank = start-end)', style: MAS.S.stretch});
  MAS.stepBox = ui.Textbox({placeholder: 'years between series points (1 = every year)', value: '5', style: MAS.S.stretch});
  MAS.waterChk = ui.Checkbox({label: 'Include water as natural in the denominator', value: false});
  [MAS.productSel, MAS.strategySel, MAS.yearBox, MAS.startBox, MAS.endBox, MAS.transBox, ui.Label('Time-series step (years): 1 = every year, 5, 10... ' +
    'Start, end, land-cover year, trend and transition years are always included.', MAS.S.small), MAS.stepBox, MAS.waterChk]
    .forEach(function (w) { MAS.controls.add(w); });
  MAS.controls.add(ui.Label('3. Range, locations and records', MAS.S.h));
  MAS.aooBox = ui.Textbox({placeholder: 'AOO cell (km)', value: String(MAS.DEFAULTS.aooKm), style: MAS.S.stretch});
  MAS.locBox = ui.Textbox({placeholder: 'Locations grid (km)', value: String(MAS.DEFAULTS.locKm), style: MAS.S.stretch});
  MAS.locMethodSel = ui.Select({items: [
    {label: 'Locations: one per protected area with records', value: 'ONE_PER_PA'},
    {label: 'Locations: grid inside/outside PAs separately', value: 'GRID_SPLIT'}], value: MAS.DEFAULTS.locMethod, style: MAS.S.stretch});
  MAS.excludeBox = ui.Textbox({placeholder: 'record ids to exclude, e.g. 73 or 10-12', style: MAS.S.stretch});
  MAS.countryModeSel = ui.Select({items: [{label: 'Country: as declared in the table', value: 'DECLARED'},
    {label: 'Country: where the coordinate falls', value: 'COORDINATES'}], value: MAS.DEFAULTS.countryMode, style: MAS.S.stretch});
  [ui.Label('AOO cell (km)', MAS.S.small), MAS.aooBox, ui.Label('Locations grid (km)', MAS.S.small), MAS.locBox, MAS.locMethodSel,
   ui.Label('Exclude records', MAS.S.small), MAS.excludeBox, MAS.countryModeSel].forEach(function (w) { MAS.controls.add(w); });
  MAS.controls.add(ui.Label('4. Protected areas', MAS.S.h));
  MAS.wdpaSel = ui.Select({items: [
    {label: 'WDPA: all protected areas (as mappingAS)', value: 'MAPPINGAS'},
    {label: 'WDPA: no proposed sites, no Biosphere Reserves (Protected Planet)', value: 'PROTECTED_PLANET'},
    {label: 'WDPA: terrestrial and coastal only', value: 'TERRESTRIAL'},
    {label: 'No protected-area analysis', value: 'NONE'}], value: MAS.DEFAULTS.wdpa, style: MAS.S.stretch});
  MAS.scaleBox = ui.Textbox({placeholder: 'EOO statistics scale in m (auto)', value: MAS.DEFAULTS.scaleEoo, style: MAS.S.stretch});
  [MAS.wdpaSel, ui.Label('EOO statistics scale (m)', MAS.S.small), MAS.scaleBox].forEach(function (w) { MAS.controls.add(w); });
  MAS.controls.add(ui.Label('4b. Criterion A, habitat and threats', MAS.S.h));
  MAS.genLenBox = ui.Textbox({placeholder: 'generation length in years (blank = 10-year window)', style: MAS.S.stretch});
  MAS.habChk = ui.Checkbox({label: 'Habitat: fragmentation in the AOO and habitat history', value: true});
  MAS.patchSel = ui.Select({items: ['3', '5', '10', '25', '50', '75'], value: '10', style: MAS.S.stretch});
  MAS.isoBox = ui.Textbox({placeholder: 'isolation distance (m)', value: '1000', style: MAS.S.stretch});
  MAS.threatChk = ui.Checkbox({label: 'Threats: MapBiomas Fire and Deforestation (where available)', value: true});
  [ui.Label('Generation length (years). Criterion A window = max(10 years, 3 generations), ending in the last year. A calculator (Guidelines 4.4) is in the Red List tab.', MAS.S.small), MAS.genLenBox,
   MAS.habChk, ui.Label('Small patch (ha) and isolation distance (m) for the severe-fragmentation test', MAS.S.small), MAS.patchSel, MAS.isoBox, MAS.threatChk]
    .forEach(function (w) { MAS.controls.add(w); });
  MAS.controls.add(ui.Label('4c. Climate', MAS.S.h));
  MAS.climChk = ui.Checkbox({label: 'Climate: TerraClimate, ENSO (El Niño / La Niña), ERA5-Land', value: true});
  MAS.climStartBox = ui.Textbox({placeholder: 'first year (blank = land-cover start)', value: '1985', style: MAS.S.stretch});
  MAS.climNBox = ui.Textbox({placeholder: 'years averaged at each end', value: '5', style: MAS.S.stretch});
  MAS.cmipChk = ui.Checkbox({label: 'Projections: NEX-GDDP-CMIP6, 5 models (slower)', value: true});
  [MAS.climChk, ui.Label('Climate series from (TerraClimate starts in 1958)', MAS.S.small), MAS.climStartBox,
   ui.Label('Years averaged at the start and the end of the series (change = last - first)', MAS.S.small), MAS.climNBox, MAS.cmipChk]
    .forEach(function (w) { MAS.controls.add(w); });
  MAS.controls.add(ui.Label('4d. Species habitat (area of habitat, AOH)', MAS.S.h));
  MAS.suitSel = ui.Select({items: Object.keys(MAS.SUIT_PRESETS).map(function (k) { return {label: MAS.SUIT_PRESETS[k].label, value: k}; }),
    value: 'NATURAL', style: MAS.S.stretch});
  MAS.suitBox = ui.Textbox({placeholder: 'codes for "Custom", e.g. 3, 4, 12, 29 (legend in the Map tab)', style: MAS.S.stretch});
  MAS.elevModeSel = ui.Select({items: [{label: 'Elevation: no limit', value: 'NONE'},
    {label: 'Elevation: range of the records ± margin', value: 'RECORDS'}, {label: 'Elevation: typed limits', value: 'TYPED'}],
    value: 'NONE', style: MAS.S.stretch});
  MAS.elevMinBox = ui.Textbox({placeholder: 'lower limit (m)', style: MAS.S.stretch});
  MAS.elevMaxBox = ui.Textbox({placeholder: 'upper limit (m)', style: MAS.S.stretch});
  MAS.elevMarginBox = ui.Textbox({placeholder: 'margin (m)', value: '100', style: MAS.S.stretch});
  [ui.Label('AOH = suitable land-cover classes within the elevation limits (Guidelines 4.6 and 4.10.7; Brooks et al. 2019). ' +
    'It replaces "natural habitat" in Criterion A, the continuing decline (b iii) and the AOO upper bound.', MAS.S.small), MAS.suitSel, MAS.suitBox,
   MAS.elevModeSel, MAS.cardRow([MAS.elevMinBox, MAS.elevMaxBox]), ui.Label('Margin added to the elevation range of the records (m)', MAS.S.small), MAS.elevMarginBox]
    .forEach(function (w) { MAS.controls.add(w); });
  MAS.runBtn = ui.Button({label: 'Assess', style: {stretch: 'horizontal', fontWeight: 'bold'}});
  MAS.statusLabel = ui.Label('', {fontSize: '12px', color: '#1f5f3a', whiteSpace: 'pre-wrap'});
  MAS.controls.add(ui.Label('5. Run', MAS.S.h));
  MAS.controls.add(MAS.runBtn);
  MAS.controls.add(MAS.statusLabel);
  // ---- progress tracker: shows that the assessment is running, step by step
  MAS.PROG = {steps: [], state: {}, detail: {}, t0: 0, timer: null, frame: 0, frac: {}, running: false};
  MAS.progSpin = ui.Label('', {fontSize: '13px', fontWeight: 'bold', color: '#1f5f3a'});
  MAS.progFill = ui.Label('', {backgroundColor: '#1f8d49', height: '10px', width: '0px', margin: '0', padding: '0'});
  var progTrack = ui.Panel([MAS.progFill], null, {backgroundColor: '#e0e0e0', height: '10px', width: '300px', padding: '0', margin: '2px 8px'});
  MAS.progList = ui.Panel();
  MAS.controls.add(MAS.progSpin);
  MAS.controls.add(progTrack);
  MAS.controls.add(MAS.progList);
  MAS.STEP_ICON = {wait: '○', run: '►', ok: '✔', fail: '✖', skip: '–'};
  MAS.STEP_COLOR = {wait: '#999999', run: '#1f5f3a', ok: '#1f8d49', fail: '#b30000', skip: '#999999'};
  MAS.controls.add(ui.Label('6. EOO/AOO maps (spatial)', MAS.S.h));
  MAS.spatialFmtSel = ui.Select({items: [{label: 'GeoJSON', value: 'geojson'}, {label: 'KML', value: 'kml'},
    {label: 'KMZ', value: 'kmz'}], value: 'geojson', style: MAS.S.stretch});
  MAS.spatialBtn = ui.Button({label: 'Download EOO/AOO (spatial)', style: MAS.S.stretch, disabled: true});
  MAS.spatialLinks = ui.Panel();
  MAS.exportBtn = ui.Button({label: 'Create export tasks (Code Editor only)', style: MAS.S.stretch, disabled: true});
  [MAS.spatialFmtSel, MAS.spatialBtn, MAS.spatialLinks, MAS.exportBtn,
   ui.Label('Export tasks only work in the Code Editor; in the App use the download links.', MAS.S.small)]
    .forEach(function (w) { MAS.controls.add(w); });
  // ---- tabs
  MAS.TAB_NAMES = ['Map', 'Add points', 'Time series', 'Conversion', 'Habitat', 'Threats', 'Climate', 'Bioclimate model', 'Protected areas', 'Red List', 'Summary', 'Batch'];
  MAS.TABS = {};
  MAS.tabButtons = {};
  var tabBar = ui.Panel({layout: ui.Panel.Layout.flow('horizontal', true)});
  MAS.tabContent = ui.Panel();
  MAS.mainPanel.add(tabBar);
  MAS.mainPanel.add(MAS.tabContent);
  MAS.TAB_NAMES.forEach(function (n) {
    MAS.TABS[n] = ui.Panel();
    MAS.tabButtons[n] = ui.Button({label: n, onClick: function () { showTab(n); }});
    tabBar.add(MAS.tabButtons[n]);
  });
  MAS.CURRENT_TAB = 'Map';
  MAS.APP = {manual: [], addMode: false, runId: 0, current: null, legend: null, manualLayer: null};
};

function progStart(steps) {
  MAS.PROG.steps = steps; MAS.PROG.state = {}; MAS.PROG.detail = {}; MAS.PROG.frac = {}; MAS.PROG.t0 = Date.now(); MAS.PROG.running = true; MAS.PROG.log = [];
  steps.forEach(function (s) { MAS.PROG.state[s[0]] = 'wait'; });
  progDraw();
  if (MAS.PROG.timer !== null && ui.util && ui.util.clear) ui.util.clear(MAS.PROG.timer);
  MAS.PROG.timer = (ui.util && ui.util.setInterval) ? ui.util.setInterval(progTick, 500) : null;
}
function elapsed() { var s = Math.round((Date.now() - MAS.PROG.t0) / 1000); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
function progTick() {
  MAS.PROG.frame = (MAS.PROG.frame + 1) % 4;
  var cur = MAS.PROG.steps.filter(function (s) { return MAS.PROG.state[s[0]] === 'run'; }).map(function (s) { return s[1]; });
  MAS.progSpin.setValue(MAS.PROG.running ? ['◐', '◓', '◑', '◒'][MAS.PROG.frame] + ' Running · ' + elapsed() + (cur.length ? ' · ' + cur[0] : '')
                                 : 'Finished in ' + elapsed());
}
function progSet(key, state, detail, frac) {
  MAS.PROG.state[key] = state;
  if (detail !== undefined) MAS.PROG.detail[key] = detail;
  if (frac !== undefined) MAS.PROG.frac[key] = frac;
  var lab = (MAS.PROG.steps.filter(function (s) { return s[0] === key; })[0] || [key, key])[1];
  if (state === 'ok' || state === 'fail') {
    MAS.PROG.log.push([elapsed(), lab, (state === 'ok' ? 'done' : 'FAILED') + (detail ? ' - ' + detail : '')]);
    if (MAS.APP.logPanel) MAS.APP.logPanel.add(ui.Label(elapsed() + '  ' + MAS.STEP_ICON[state] + ' ' + lab + (detail ? ' - ' + detail : ''), {fontSize: '12px'}));
  }
  var open = MAS.PROG.steps.filter(function (s) { return MAS.PROG.state[s[0]] === 'wait' || MAS.PROG.state[s[0]] === 'run'; }).length;
  if (!open || state === 'fail' && key !== 'series' && key !== 'pa' && key !== 'aoo' && key !== 'eoo' && key !== 'habitat' && key !== 'threats' && key !== 'climate' && key !== 'recinfo' && key !== 'iucn') { MAS.PROG.running = false; }
  progDraw(); progTick();
  if (!MAS.PROG.running && MAS.PROG.timer !== null && ui.util && ui.util.clear) { ui.util.clear(MAS.PROG.timer); MAS.PROG.timer = null; }
}
function progDraw() {
  MAS.progList.clear();
  var done = 0;
  MAS.PROG.steps.forEach(function (s) {
    var st = MAS.PROG.state[s[0]];
    done += st === 'ok' || st === 'fail' || st === 'skip' ? 1 : (st === 'run' && MAS.PROG.frac[s[0]] ? MAS.PROG.frac[s[0]] : 0);
    MAS.progList.add(ui.Label(MAS.STEP_ICON[st] + ' ' + s[1] + (MAS.PROG.detail[s[0]] ? ' - ' + MAS.PROG.detail[s[0]] : ''),
      {fontSize: '12px', color: MAS.STEP_COLOR[st], margin: '1px 8px'}));
  });
  MAS.progFill.style().set('width', Math.round(300 * done / Math.max(1, MAS.PROG.steps.length)) + 'px');
}
function setStatus(t, err) { MAS.statusLabel.setValue(t); MAS.statusLabel.style().set('color', err ? '#b30000' : '#1f5f3a'); }
function showTab(n) {
  MAS.CURRENT_TAB = n;
  MAS.tabContent.clear();
  MAS.tabContent.add(MAS.TABS[n]);
  MAS.TAB_NAMES.forEach(function (k) { MAS.tabButtons[k].setLabel(k === n ? '[ ' + k + ' ]' : k); });
  MAS.APP.addMode = n === 'Add points' && !!MAS.addChk.getValue();
}
function tabHead(tab, t) { var l = ui.Label(t, {fontWeight: 'bold', fontSize: '15px', margin: '12px 8px 4px 8px'}); MAS.TABS[tab].add(l); return l; }
function tabNote(tab, t) { var l = ui.Label(t, {fontSize: '12px', color: '#444', whiteSpace: 'pre-wrap'}); MAS.TABS[tab].add(l); return l; }
function tabAdd(tab, w) { MAS.TABS[tab].add(w); return w; }
function placeholder(tab, txt) { MAS.TABS[tab].clear(); tabNote(tab, txt); }
// Feature collections sent to the client are converted to plain lists of dictionaries
function fcToDicts(fc) { return fc.toList(20000).map(function (f) { return ee.Feature(f).toDictionary(); }); }
// Accepts a list of dictionaries, a GeoJSON-like FeatureCollection or a list of features
function propsList(x) {
  if (!x) return [];
  var arr = Array.isArray(x) ? x : (x.features || []);
  return arr.map(function (f) { return f && f.properties ? f.properties : (f || {}); });
}
function safeRun(label, fn) {
  try { fn(); } catch (e) { setStatus('Error in ' + label + ': ' + (e && e.message ? e.message : e), true); }
}
