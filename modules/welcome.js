/**** mappingAS GEE 2.0.0 - module "welcome": welcome screen
 * Section 16 (welcome): instructions, step-by-step, categories and criteria, citation.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: report, config, utils, records, layout, run
 * Shared state created here: APP_CITE, APP_CONTACT, W, STEPS, CATS, CRIT_ROWS, CRIT_NOTES, DATA_CITES, WELCOME, ROOT_KIDS
 ****/

// ============================================================================
// 16. WELCOME SCREEN: basic instructions, step-by-step, IUCN categories and criteria, citation.
//     Shown at start (skip it with #intro=0 at the end of the App link); reopened from the left panel.
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.wl = wl;
  MAS.catChip = catChip;
  MAS.welcomeDetails = welcomeDetails;
  MAS.welcomePanel = welcomePanel;
  MAS.showWelcome = showWelcome;
  MAS.enterApp = enterApp;
};

exports.run = function () {
  MAS.APP_CITE = 'Barreira, L. (2026). mappingAS: preliminary IUCN Red List assessments in Google Earth Engine. Version ' +
    MAS.APP_VERSION.replace(/^.* /, '') + '. https://github.com/lucasbarreirageo/mappingAS';
  MAS.APP_CONTACT = 'https://github.com/lucasbarreirageo/mappingAS/issues';
  MAS.W = {p: {fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap', margin: '2px 8px'},
    h: {fontSize: '16px', fontWeight: 'bold', color: '#1f5f3a', margin: '16px 8px 4px 8px'},
    card: {border: '1px solid #b7c9bd', padding: '6px', margin: '4px', width: '175px', backgroundColor: '#f6faf7'}};
  MAS.STEPS = [
    ['Load the records', 'Panel 1. Paste the table or type the asset id; choose the species and check the columns.'],
    ['Choose the data', 'Panels 2-4d. Land cover and years, AOO cell (2 km), protected areas, generation length, species habitat (classes, elevation).'],
    ['Press Assess', 'Panel 5. The progress list shows each step; large ranges take a few minutes.'],
    ['Check the records', 'Red List tab, section 8. Exclude records with errors or historical records, then press Assess again.'],
    ['Read the evidence', 'Map, Time series, Conversion, Habitat, Threats, Climate and Protected areas tabs.'],
    ['Decide', 'Red List tab: generation length, sub-criteria, population data, uncertainty; confirm habitat and threat codes.'],
    ['Export', 'Summary tab: HTML report and CSV. Red List tab: Word supplementary information, SIS tables, IUCN map files.']];
  MAS.CATS = [['EX', 'Extinct', 'No reasonable doubt that the last individual has died.'],
    ['EW', 'Extinct in the Wild', 'Survives only in cultivation, captivity or naturalized populations well outside its past range.'],
    ['CR', 'Critically Endangered', 'Extremely high risk of extinction in the wild: meets any criterion A-E at the CR level.'],
    ['EN', 'Endangered', 'Very high risk of extinction in the wild: meets any criterion at the EN level.'],
    ['VU', 'Vulnerable', 'High risk of extinction in the wild: meets any criterion at the VU level.'],
    ['NT', 'Near Threatened', 'Close to qualifying for a threatened category, or likely to qualify in the near future.'],
    ['LC', 'Least Concern', 'Evaluated and does not qualify for CR, EN, VU or NT.'],
    ['DD', 'Data Deficient', 'Not enough information to assess the risk; all categories from LC to CR remain plausible.'],
    ['NE', 'Not Evaluated', 'Not yet assessed against the criteria.']];
  MAS.CRIT_ROWS = [
    ['A1 reduction (causes reversible, understood and ceased)', '≥ 90%', '≥ 70%', '≥ 50%'],
    ['A2, A3, A4 reduction (past, future, past + future)', '≥ 80%', '≥ 50%', '≥ 30%'],
    ['   window for A', '10 years or 3 generations, whichever is longer (A3/A4: up to 100 years ahead)', '', ''],
    ['B1 extent of occurrence (EOO)', '< 100 km²', '< 5,000 km²', '< 20,000 km²'],
    ['B2 area of occupancy (AOO)', '< 10 km²', '< 500 km²', '< 2,000 km²'],
    ['   plus at least 2 of: (a) locations or severe fragmentation', '= 1', '≤ 5', '≤ 10'],
    ['   (b) continuing decline, (c) extreme fluctuations', 'any', 'any', 'any'],
    ['C mature individuals', '< 250', '< 2,500', '< 10,000'],
    ['   C1 continuing decline', '25% in 3 yr / 1 gen', '20% in 5 yr / 2 gen', '10% in 10 yr / 3 gen'],
    ['   C2a(i) largest subpopulation', '≤ 50', '≤ 250', '≤ 1,000'],
    ['   C2a(ii) % of individuals in one subpopulation', '90-100%', '95-100%', '100%'],
    ['D mature individuals', '< 50', '< 250', '< 1,000 (D1)'],
    ['   D2 AOO or locations, with a plausible threat', '-', '-', 'AOO < 20 km² or ≤ 5 locations'],
    ['E probability of extinction', '≥ 50% in 10 yr / 3 gen', '≥ 20% in 20 yr / 5 gen', '≥ 10% in 100 yr']];
  MAS.CRIT_NOTES = [
    'Criterion A - basis of the reduction: (a) direct observation, (b) index of abundance, (c) decline in AOO, EOO and/or habitat quality, ' +
      '(d) levels of exploitation, (e) introduced taxa, hybridization, pathogens, pollutants, competitors or parasites. The app uses (c): the loss of ' +
      'the area of habitat (AOH) over the window, from land-cover time series.',
    'Criterion B - sub-criteria: (a) severely fragmented or few locations; (b) continuing decline in (i) EOO, (ii) AOO, (iii) area, extent or quality ' +
      'of habitat, (iv) locations or subpopulations, (v) mature individuals; (c) extreme fluctuations (≥ 10-fold) in (i)-(iv). The app computes EOO, ' +
      'AOO and locations from the records and infers (b iii) only from a significant decline of habitat.',
    'Criteria C, D and E need population data (number of mature individuals, subpopulations, extinction models) that satellite data cannot give: ' +
      'type them in the Red List tab.',
    'Key terms: generation length = average age of parents of the current cohort; location = area where a single threatening event can rapidly affect ' +
      'all individuals (defined by the most serious threat, not by collection sites); EOO = minimum convex polygon around the current occurrences; ' +
      'AOO = occupied cells of a 2 x 2 km grid; continuing decline = observed, estimated, inferred or projected, never assumed.',
    'Category rules: the category is the highest reached by any criterion, and every criterion met at that level is listed (e.g. EN B1ab(iii)+2ab(iii)). ' +
      'NT: close to a threshold (e.g. a 20-30% reduction, or the B area met with only one sub-criterion). Uncertainty: the app shows the plausible range of ' +
      'categories (e.g. EN (CR-VU)); if the best estimate is LC but VU or higher is plausible the taxon is NT; if every category from LC to CR is plausible, DD.'];
  MAS.DATA_CITES = ['IUCN (2012). IUCN Red List Categories and Criteria: Version 3.1. Second edition. Gland and Cambridge: IUCN.',
    'IUCN Standards and Petitions Committee (2024). Guidelines for Using the IUCN Red List Categories and Criteria. Version 16.',
    'Data: MapBiomas collections; Esri/Impact Observatory Sentinel-2 land cover; UNEP-WCMC & IUCN World Database on Protected Areas; US DoS LSIB; ' +
      'FAO GAUL; Copernicus GLO-30 DEM; RESOLVE Ecoregions 2017; TerraClimate; ERA5-Land; NASA NEX-GDDP-CMIP6; WorldClim 1.4; NOAA ONI.'];
  MAS.WELCOME = null;
  // the Code Editor's global Map is not a ui.Widget: keep the root's real widgets and put them back
  MAS.ROOT_KIDS = null;
  MAS.controls.insert(2, ui.Button({label: 'ⓘ Instructions and IUCN criteria', style: {stretch: 'horizontal'}, onClick: showWelcome}));
};

function wl(t, st) { return ui.Label(t, st || MAS.W.p); }
function catChip(c) {
  return ui.Label(c, {backgroundColor: MAS.IUCN_COLORS[c] || '#ffffff', color: ['EX', 'EW', 'CR', 'EN'].indexOf(c) >= 0 ? '#ffffff' : '#000000',
    fontWeight: 'bold', padding: '4px 0', width: '40px', textAlign: 'center', margin: '3px 8px', border: '1px solid #999'});
}
function welcomeDetails() {
  var d = ui.Panel();
  d.add(wl('IUCN Red List categories', MAS.W.h));
  MAS.CATS.forEach(function (c) {
    d.add(ui.Panel([catChip(c[0]), wl(c[1] + ' - ' + c[2], {fontSize: '13px', color: '#333', margin: '6px 4px', width: '640px', whiteSpace: 'pre-wrap'})],
      ui.Panel.Layout.flow('horizontal')));
  });
  d.add(wl('CR, EN and VU are the threatened categories. A taxon is listed in the highest category for which it meets any criterion.'));
  d.add(wl('Criteria and thresholds', MAS.W.h));
  d.add(MAS.tableChart([['Criterion', 'string'], ['CR', 'string'], ['EN', 'string'], ['VU', 'string']], MAS.CRIT_ROWS));
  MAS.CRIT_NOTES.forEach(function (n) { d.add(wl('• ' + n)); });
  return d;
}
function welcomePanel() {
  var P = ui.Panel({style: {stretch: 'both', padding: '12px 24px'}});
  P.add(ui.Label('mappingAS · Earth Engine', {fontWeight: 'bold', fontSize: '26px', color: '#1f5f3a', margin: '4px 8px 0 8px'}));
  P.add(wl('Preliminary IUCN Red List assessment of a species from its occurrence records and global land-cover, protected-area and climate data, ' +
    'following the IUCN Red List Categories and Criteria 3.1 and the Guidelines.', {fontSize: '14px', color: '#333', margin: '2px 8px', whiteSpace: 'pre-wrap'}));
  P.add(wl('What you need', MAS.W.h));
  P.add(wl('• A table of occurrence records: species name, longitude and latitude in decimal degrees (WGS84). Country and year/date are optional but recommended.\n' +
    '• Paste it (CSV, TSV or GeoJSON) or read it from an Earth Engine asset shared as "Anyone can read". A built-in example is available.'));
  P.add(wl('Step by step', MAS.W.h));
  var flow = ui.Panel(null, ui.Panel.Layout.flow('horizontal', true));
  MAS.STEPS.forEach(function (s, i) {
    flow.add(ui.Panel([ui.Label(String(i + 1), {fontSize: '20px', fontWeight: 'bold', color: '#ffffff', backgroundColor: '#1f5f3a', padding: '2px 10px', margin: '2px'}),
      ui.Label(s[0], {fontWeight: 'bold', fontSize: '13px', margin: '4px 2px', color: '#1f3a5f'}),
      ui.Label(s[1], {fontSize: '12px', color: '#444', margin: '2px', whiteSpace: 'pre-wrap'})], null, MAS.W.card));
    if (i < MAS.STEPS.length - 1) flow.add(ui.Label('→', {fontSize: '22px', color: '#1f5f3a', margin: '40px 0 0 0'}));
  });
  P.add(flow);
  P.add(wl('Optional: Bioclimate model tab - future reduction under climate change (Criterion A3), with Maxent and Random Forest.', {fontSize: '12px', color: '#555', margin: '2px 8px'}));
  P.add(wl('Before you start', MAS.W.h));
  P.add(wl('• The results are a preliminary assessment, not an official Red List category. Every code and suggestion must be confirmed by the assessor before it is entered in SIS.\n' +
    '• IUCN rules the app follows: continuing decline is observed, estimated, inferred or projected, never assumed; locations are defined by the most serious threat; EOO and AOO use current occurrences.\n' +
    '• Satellite land cover tracks habitat, not individuals: criteria C, D and E need population data that only you can provide.\n' +
    '• Your data are processed in Earth Engine and not stored by the app.'));
  var det = ui.Panel(), open = false;
  var detBtn = ui.Button({label: 'More details: IUCN categories and criteria ▾', onClick: function () {
    MAS.uiLater(function () {
      open = !open;
      det.clear();
      if (open) det.add(welcomeDetails());
      detBtn.setLabel(open ? 'Hide details ▴' : 'More details: IUCN categories and criteria ▾');
    });
  }});
  P.add(detBtn); P.add(det);
  P.add(wl('How to cite', MAS.W.h));
  P.add(wl(MAS.APP_CITE + '\n' + MAS.DATA_CITES.join('\n') + '\nQuestions and bug reports: ' + MAS.APP_CONTACT));
  var start = ui.Button({label: 'Start', disabled: true, style: {fontWeight: 'bold'}, onClick: function () { enterApp(false); }});
  var demo = ui.Button({label: 'Try the example (Prepusa hookeriana)', disabled: true, onClick: function () { enterApp(true); }});
  var ok = ui.Checkbox({label: 'I have read the instructions and understand that the results are a preliminary assessment.',
    style: {fontSize: '13px', fontWeight: 'bold', margin: '16px 8px 4px 8px'},
    onChange: function (v) { start.setDisabled(!v); demo.setDisabled(!v); }});
  start.setDisabled(true); demo.setDisabled(true);
  P.add(ok);
  P.add(ui.Panel([start, demo], ui.Panel.Layout.flow('horizontal')));
  return P;
}
function showWelcome() {
  MAS.uiLater(function () {
    if (!MAS.WELCOME) MAS.WELCOME = welcomePanel();
    var w = ui.root.widgets(), kids = [];
    for (var i = 0; i < w.length(); i++) if (w.get(i) !== MAS.WELCOME) kids.push(w.get(i));
    if (kids.length) MAS.ROOT_KIDS = kids;
    ui.root.clear();
    ui.root.add(MAS.WELCOME);
  });
}
function enterApp(example) {
  MAS.uiLater(function () {
    ui.root.clear();
    (MAS.ROOT_KIDS || [MAS.controls, MAS.mainPanel]).forEach(function (k) { ui.root.add(k); });
    if (!example) return;
    MAS.uiLater(function () {
      if (MAS.TABLE.kind !== 'example') MAS.loadExample();
      if (MAS.speciesSelect) MAS.speciesSelect.setValue('Prepusa hookeriana Gardner');
      MAS.setStatus('Running the built-in example (Prepusa hookeriana)...');
      MAS.startRun();
    });
  });
}

