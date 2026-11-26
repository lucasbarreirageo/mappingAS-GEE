/**** mappingAS GEE 2.0.0 - module "redlist": Red List tab
 * Section 28: assessment settings, species data and all criteria with instant recalculation.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: batch, layout, run, tabs, records, iucn_calc, utils, iucn_coding, config, habitat, documents
 * Shared state created here: -
 ****/

// ============================================================================
// 28. RED LIST TAB: assessment settings and species data (instant recalculation), all criteria
//     with plausible ranges, record checks, IUCN coded fields, checklist, narratives and files
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.refreshRedList = refreshRedList;
  MAS.rlHead = rlHead;
  MAS.rlSmall = rlSmall;
  MAS.renderRedListTab = renderRedListTab;
};

exports.run = function () {

};

function refreshRedList(R) {
  if (MAS.stale(R) || !R.rendered) return;
  if (MAS.CURRENT_TAB !== 'Red List') { MAS.renderOne(R, 'Red List', renderRedListTab); MAS.renderOne(R, 'Summary', MAS.renderAssessmentTab); return; }
  if (R.rlBanner) MAS.uiLater(function () {
    R.rlBanner.clear();
    R.rlBanner.add(ui.Button({label: '↻ New evidence loaded (habitat, threats, climate, IUCN coding or model) - refresh this tab',
      style: {color: '#1a5fb4'}, onClick: function () { MAS.uiLater(function () { renderRedListTab(R); }); }}));
  });
}
function rlHead(T, t) { return MAS.tabAdd(T, ui.Label(t, {fontWeight: 'bold', fontSize: '14px', margin: '14px 8px 2px 8px', color: '#1f3a5f'})); }
function rlSmall(t, col) { return ui.Label(t, {fontSize: '12px', color: col || '#444', whiteSpace: 'pre-wrap'}); }
function renderRedListTab(R) {
  var T = 'Red List', r = MAS.RL(R);
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'IUCN Red List assessment - ' + R.cfg.species);
  R.rlBanner = ui.Panel(); MAS.tabAdd(T, R.rlBanner);
  MAS.tabNote(T, 'Everything here recalculates at once (no new run). Parameters follow the IUCN Red List Categories and Criteria 3.1, the Guidelines ' +
    '(sections 3-12), the Required and Recommended Supporting Information and the Documentation Standards. Inputs that the satellite data cannot ' +
    'give (population size, generation length, dispersal...) are yours to type. Codes are suggestions: confirm each before entering it in SIS.');
  var OUT = {sum: ui.Panel(), A: ui.Panel(), B: ui.Panel(), CDE: ui.Panel(), gl: ui.Panel(), coded: ui.Panel(), check: ui.Panel(), narr: ui.Panel(), recs: ui.Panel()};
  var pending = false;
  function changed() {
    if (pending) return;
    pending = true;
    MAS.uiLater(function () { pending = false; fill(); if (MAS.CURRENT_TAB === 'Red List') MAS.renderOne(R, 'Summary', MAS.renderAssessmentTab); });
  }
  function nbox(key, ph, w) {
    return ui.Textbox({placeholder: ph, value: isFinite(r[key]) ? String(r[key]) : '', style: {width: w || '90px'},
      onChange: function (v) { r[key] = MAS.toNum(v); changed(); }});
  }
  function tbox(key, ph, w) { return ui.Textbox({placeholder: ph, value: r[key] || '', style: {width: w || '200px'}, onChange: function (v) { r[key] = v; changed(); }}); }
  function chk(obj, key, label, after) {
    return ui.Checkbox({label: label, value: !!obj[key], style: {fontSize: '12px'}, onChange: function (v) { obj[key] = v; if (after) after(v); changed(); }});
  }
  function sel(key, items, w) { return ui.Select({items: items, value: r[key], style: {width: w || '260px'}, onChange: function (v) { r[key] = v; changed(); }}); }
  function lab(t) { return ui.Label(t, {fontSize: '12px', color: '#333', margin: '6px 4px 0 8px'}); }

  // ---------------- result
  rlHead(T, '1. Category - all criteria, best estimate and plausible range');
  MAS.tabAdd(T, OUT.sum);

  // ---------------- settings
  rlHead(T, '2. Assessment settings');
  MAS.tabAdd(T, MAS.cardRow([lab('Scope'), sel('scope', ['Global', 'Regional', 'Subpopulation'], '120px'), lab('Attitude to uncertainty'),
    sel('attitude', [{label: 'Best estimate (mid-point)', value: 'BEST'}, {label: 'Precautionary (highest plausible)', value: 'PRECAUTIONARY'},
      {label: 'Evidentiary (lowest plausible)', value: 'EVIDENTIARY'}], '230px')]));
  MAS.tabAdd(T, MAS.cardRow([chk(r, 'ddRule', 'Data Deficient when every category from LC to CR is plausible (Guidelines 4.10.8, 10.1)')]));
  MAS.tabAdd(T, rlSmall('Guidelines 3.2: use plausible ranges; a precautionary but realistic attitude is recommended. RAMAS notation: EN (CR-VU) = ' +
    'best estimate with its plausible range; CR* (CR-VU) = highest category chosen by precaution. If the best estimate is LC but the range ' +
    'reaches a threatened category the taxon is NT.'));
  MAS.tabAdd(T, MAS.cardRow([lab('Assessor(s)'), tbox('assessors', 'Surname, I.'), lab('Reviewer(s)'), tbox('reviewers', 'Surname, I.')]));
  MAS.tabAdd(T, MAS.cardRow([lab('Contributors'), tbox('contributors', ''), lab('Compiler / map citation'), tbox('compiler', 'name or institution')]));
  MAS.tabAdd(T, MAS.cardRow([lab('Common name'), tbox('commonName', 'English common name', '180px')]));

  // ---------------- taxon
  rlHead(T, '3. Taxon, system and use');
  var sys = MAS.systemSuggest(R);
  MAS.tabAdd(T, MAS.cardRow([lab('Kingdom'), sel('kingdom', [{label: 'Plantae', value: 'PLANTAE'}, {label: 'Animalia', value: 'ANIMALIA'}, {label: 'Fungi', value: 'FUNGI'}], '110px'),
    lab('Plant growth form (required for plants)'), sel('growthForm', MAS.PLANT_FORMS, '190px')]));
  MAS.tabAdd(T, MAS.cardRow([lab('System'), chk(r, 'sysT', 'Terrestrial'), chk(r, 'sysF', 'Freshwater (inland waters)'), chk(r, 'sysM', 'Marine')]));
  MAS.tabAdd(T, rlSmall('Suggestion: ' + (sys.freshwater ? 'Freshwater too - ' + MAS.fmt(sys.pctWet, 0) + '% of the records in water, wetland or flooded classes.' :
    'Terrestrial (' + MAS.fmt(sys.pctWet, 0) + '% of the records in water, wetland or flooded classes).')));
  MAS.tabAdd(T, MAS.cardRow([lab('Use and trade (General Use and Trade 1.0)'), sel('useTrade', MAS.USE_TRADE, '260px')]));
  MAS.tabAdd(T, rlSmall('Use and trade cannot be read from satellite data: record end uses and scale (subsistence, national, international) in SIS.'));

  // ---------------- generation length
  rlHead(T, '4. Generation length (Guidelines 4.4) and time windows');
  MAS.tabAdd(T, MAS.cardRow([sel('glMethod', MAS.GL_METHODS, '360px')]));
  MAS.tabAdd(T, MAS.cardRow([lab('GL (yr)'), nbox('glDirect', 'years', '70px'), lab('Age 1st repr.'), nbox('glAfr', 'years', '70px'),
    lab('Adult mortality /yr'), nbox('glMort', '0-1', '60px')]));
  MAS.tabAdd(T, MAS.cardRow([lab('Reproductive lifespan'), nbox('glRepro', 'years', '70px'), lab('z'), nbox('glZ', '0.29', '50px'),
    lab('Juvenile period'), nbox('glJuv', 'years', '60px'), lab('Seed-bank half-life'), nbox('glSeed', 'years', '60px')]));
  MAS.tabAdd(T, OUT.gl);

  // ---------------- Criterion A
  rlHead(T, '5. Criterion A - population reduction');
  MAS.tabAdd(T, MAS.cardRow([lab('Sub-criterion'), sel('aSub', [{label: 'A2 past, causes may not have ceased', value: 'A2'}, {label: 'A1 past, reversible + understood + ceased', value: 'A1'},
    {label: 'A3 future (projected)', value: 'A3'}, {label: 'A4 window past + future', value: 'A4'}], '270px'),
    lab('A4: years before now'), nbox('a4Back', 'W/2', '60px')]));
  MAS.tabAdd(T, MAS.cardRow([lab('A1 needs:'), chk(r, 'a1rev', 'reversible'), chk(r, 'a1und', 'understood'), chk(r, 'a1ceased', 'ceased')]));
  MAS.tabAdd(T, MAS.cardRow([lab('Pattern of decline'), sel('aPattern', [{label: 'Exponential (default)', value: 'EXP'}, {label: 'Linear', value: 'LIN'}], '170px'),
    lab('Population response z (N ∝ AOH^z)'), nbox('aZ', '1', '50px'), lab('Qualifier'),
    sel('aQual', ['observed', 'estimated', 'inferred', 'suspected'], '110px')]));
  MAS.tabAdd(T, MAS.cardRow([lab('Basis:'), chk(r.aBasis, 'a', '(a) direct observation'), chk(r.aBasis, 'b', '(b) index of abundance'),
    chk(r.aBasis, 'c', '(c) decline in AOO, EOO and/or habitat'), chk(r.aBasis, 'd', '(d) exploitation'), chk(r.aBasis, 'e', '(e) introduced taxa, pathogens...')]));
  MAS.tabAdd(T, MAS.cardRow([chk(r, 'sdmA3', 'A3: also use the bioclimate model (Bioclimate model tab) when it has run')]));
  MAS.tabAdd(T, rlSmall('Guidelines 4.5: a model is fitted to every habitat value in the window (not only the end points); when the window is longer ' +
    'than the data the fitted pattern is extrapolated. Guidelines 5.8: population may not decline in proportion to habitat - z < 1 when the species ' +
    'persists in degraded land, z > 1 when it needs large or interior patches.'));
  MAS.tabAdd(T, OUT.A);

  // ---------------- Criterion B sub-criteria
  rlHead(T, '6. Criterion B - sub-criteria (a), (b), (c)');
  var cs = MAS.cellSummary(R), per = MAS.recordPeriods(R);
  var sugg = ['(b iii) ' + (R.declineInferred ? 'SUGGESTED: significant recent decline of the AOH (' + R.declineBasis + ')' : 'no significant AOH decline measured'),
    '(b ii) / (b iv) ' + (cs ? (cs.lost ? 'SUGGESTED: ' + cs.lost + ' occupied cells lost their habitat since ' + R.yA + '; ' : '') + cs.noHab + ' of ' + cs.n + ' occupied cells have no AOH in ' + R.y1 : 'per-cell land cover still loading'),
    '(b i) ' + (per.historical.n && isFinite(per.current.eoo) && per.all.eoo > 0 ? 'EOO of current records is ' + MAS.fmt(100 * per.current.eoo / per.all.eoo, 0) + '% of the EOO of all records' : 'no dated historical records to compare'),
    '(b v) only from population data (see 7)'];
  var ongoing = MAS.threatCoding(R).filter(function (t) { return t.timing === 'Ongoing' && /declines/.test(t.severity) && !/Negligible/.test(t.severity); });
  if (!R.declineInferred && ongoing.length) sugg.splice(1, 0, '(b iii) POSSIBLE: ongoing threat causing declines in the occupied cells (' +
    ongoing.map(function (t) { return t.code + ' ' + t.name; }).join('; ') + ') - tick (iii) as "inferred" if you judge the decline will continue');
  MAS.tabAdd(T, rlSmall(sugg.join('\n'), '#6a3d00'));
  function syncDecl() { R.assess.decline = ['i', 'ii', 'iii', 'iv', 'v'].some(function (k) { return r.bDec[k]; }); }
  function syncFl() { R.assess.fluct = ['i', 'ii', 'iii', 'iv'].some(function (k) { return r.bFl[k]; }); }
  MAS.tabAdd(T, MAS.cardRow([lab('(b) continuing decline in:'), chk(r.bDec, 'i', '(i) EOO', syncDecl), chk(r.bDec, 'ii', '(ii) AOO', syncDecl),
    chk(r.bDec, 'iii', '(iii) area/extent/quality of habitat', syncDecl), chk(r.bDec, 'iv', '(iv) locations/subpopulations', syncDecl), chk(r.bDec, 'v', '(v) mature individuals', syncDecl)]));
  MAS.tabAdd(T, MAS.cardRow([lab('(c) extreme fluctuations (≥ 10-fold) in:'), chk(r.bFl, 'i', '(i) EOO', syncFl), chk(r.bFl, 'ii', '(ii) AOO', syncFl),
    chk(r.bFl, 'iii', '(iii) locations', syncFl), chk(r.bFl, 'iv', '(iv) mature individuals', syncFl)]));
  MAS.tabAdd(T, MAS.cardRow([chk(R.assess, 'frag', 'Severely fragmented (a): > 50% of the AOO in small, isolated patches (Guidelines 4.8)'),
    chk(r, 'bCertain', 'EOO/AOO estimates are highly certain (NT margin 10% instead of 50%)')]));
  if (R.cfg.doHabitat) MAS.tabAdd(T, rlSmall(MAS.fragEvidence(R), '#6a3d00'));
  MAS.tabAdd(T, OUT.B);

  // ---------------- C, D, E
  rlHead(T, '7. Criteria C, D and E - population data');
  MAS.tabAdd(T, MAS.cardRow([lab('Mature individuals: best'), nbox('nBest', 'N'), lab('min'), nbox('nMin', 'N'), lab('max'), nbox('nMax', 'N')]));
  MAS.tabAdd(T, MAS.cardRow([lab('C1 continuing decline (%): 3 yr/1 gen'), nbox('c1g1', '%', '55px'), lab('5 yr/2 gen'), nbox('c1g2', '%', '55px'),
    lab('10 yr/3 gen'), nbox('c1g3', '%', '55px')]));
  MAS.tabAdd(T, MAS.cardRow([chk(r, 'c2decline', 'C2 continuing decline in mature individuals'), lab('largest subpop.'), nbox('c2ai', 'N', '70px'),
    lab('% in one subpop.'), nbox('c2aii', '%', '55px'), chk(r, 'c2b', 'extreme fluctuations')]));
  MAS.tabAdd(T, MAS.cardRow([chk(r, 'd2threat', 'D2: a plausible threat could drive the taxon to CR or EX in a very short time (1-2 generations)')]));
  MAS.tabAdd(T, MAS.cardRow([lab('E: probability of extinction (%) in 10 yr/3 gen'), nbox('pE3', '%', '55px'), lab('20 yr/5 gen'), nbox('pE5', '%', '55px'),
    lab('100 yr'), nbox('pE100', '%', '55px')]));
  MAS.tabAdd(T, rlSmall('Criterion E needs a quantitative model (PVA); the Records and Surveys / Threats models for Possibly Extinct (Guidelines 11.3) ' +
    'need survey data and are not computed here.'));
  MAS.tabAdd(T, OUT.CDE);

  // ---------------- records
  rlHead(T, '8. Records - checks and dates');
  MAS.tabAdd(T, MAS.cardRow([lab('Current records = since year'), nbox('since', String(MAS.THIS_YEAR - 30), '70px'),
    ui.Button({label: 'Put records with errors in "Exclude records" (then press Assess)', onClick: function () {
      var ids = MAS.recordFlags(R).filter(function (f) { return f.error; }).map(function (f) { return f.id; });
      var cur = MAS.parseIds(MAS.excludeBox.getValue());
      MAS.excludeBox.setValue(MAS.uniq(cur.concat(ids)).sort(function (a, b) { return a - b; }).join(', '));
      MAS.setStatus(ids.length ? 'Records ' + ids.join(', ') + ' added to "Exclude records". Press Assess to recompute.' : 'No record with errors.');
    }})]));
  MAS.tabAdd(T, MAS.cardRow([ui.Button({label: 'Put historical records (before the year above) in "Exclude records"', onClick: function () {
    var ids = R.all.filter(function (x) { return isFinite(x.year) && x.year < r.since; }).map(function (x) { return x.id; });
    MAS.excludeBox.setValue(MAS.uniq(MAS.parseIds(MAS.excludeBox.getValue()).concat(ids)).sort(function (a, b) { return a - b; }).join(', '));
    MAS.setStatus(ids.length ? 'Historical records ' + ids.join(', ') + ' added to "Exclude records" (EOO and AOO from current occurrences, Guidelines 4.9-4.10). Press Assess.' : 'No dated record before ' + r.since + '.');
  }})]));
  MAS.tabAdd(T, OUT.recs);

  // ---------------- coded fields
  rlHead(T, '9. IUCN coded fields (classification schemes)');
  MAS.tabAdd(T, OUT.coded);
  var incl = ui.Panel();
  MAS.tabAdd(T, rlSmall('Include in the files (habitats, threats, actions):'));
  MAS.tabAdd(T, incl);
  var ovNow = MAS.rlCategories(R);
  var inclRow = function (items, title) {
    if (!items.length) return;
    var p = ui.Panel(null, ui.Panel.Layout.flow('horizontal', true));
    p.add(ui.Label(title, {fontSize: '12px', fontWeight: 'bold', margin: '6px 4px 0 8px'}));
    items.forEach(function (it) {
      p.add(ui.Checkbox({label: it.code, value: it.on, style: {fontSize: '12px'}, onChange: function (v) { r.sel[it.key] = v; changed(); }}));
    });
    incl.add(p);
  };
  inclRow(MAS.habitatCoding(R), 'Habitats');
  inclRow(MAS.threatCoding(R), 'Threats');
  inclRow(MAS.actionsNeeded(R, ovNow.category), 'Actions needed');
  inclRow(MAS.researchNeeded(R, ovNow.category), 'Research needed');
  MAS.tabAdd(T, MAS.cardRow([lab('Current population trend'), sel('popTrend', [{label: 'Automatic (from the AOH trend)', value: 'AUTO'}, {label: 'Increasing', value: 'Increasing'}, {label: 'Decreasing', value: 'Decreasing'}, {label: 'Stable', value: 'Stable'}, {label: 'Unknown', value: 'Unknown'}], '220px')]));

  // ---------------- checklist and narratives
  rlHead(T, '10. Pre-submission checklist (Documentation Standards 5)');
  MAS.tabAdd(T, OUT.check);
  rlHead(T, '11. Narrative drafts for SIS (English; actual estimates, not thresholds)');
  MAS.tabAdd(T, OUT.narr);

  // ---------------- files
  rlHead(T, '12. Files');
  var fp = ui.Panel();
  MAS.tabAdd(T, MAS.cardRow([
    ui.Button({label: 'Supplementary information (Word)', onClick: function () { MAS.docDownload(fp, MAS.safeName(R.cfg.species) + '_supplementary_information.doc', MAS.supplementaryDoc(R)); }}),
    ui.Button({label: 'SIS coded tables (CSV)', onClick: function () { MAS.fileLink(fp, MAS.safeName(R.cfg.species) + '_SIS_coding.csv', MAS.sisCSV(R), 'text/csv'); }})]));
  MAS.tabAdd(T, MAS.cardRow([
    ui.Button({label: 'Records with IUCN point attributes (CSV)', onClick: function () { MAS.fileLink(fp, MAS.safeName(R.cfg.species) + '_IUCN_points.csv', MAS.csvOf(MAS.IUCN_POINT_COLS, MAS.iucnPointRows(R)), 'text/csv'); }}),
    ui.Button({label: 'EOO, AOO cells and records with IUCN attributes (GeoJSON)', onClick: function () { MAS.fileLink(fp, MAS.safeName(R.cfg.species) + '_IUCN_map.geojson', MAS.iucnGeoJSON(R), 'application/geo+json', 'Open in QGIS and save as shapefile if SIS asks for one.'); }})]));
  MAS.tabAdd(T, fp);

  // ---------------- fill the output panels
  function fill() {
    var ov = MAS.rlCategories(R), gl = MAS.genLength(R);
    // summary
    OUT.sum.clear();
    var col = MAS.IUCN_COLORS[ov.category] || '#cccccc', dark = ['CR', 'EN', 'DD', 'NA'].indexOf(ov.category) < 0 ? '#000000' : '#ffffff';
    OUT.sum.add(ui.Label(ov.category + ' - ' + (MAS.IUCN_CAT_NAME[ov.category] || ''), {fontSize: '20px', fontWeight: 'bold', color: ov.category === 'CR' || ov.category === 'EN' ? '#ffffff' : '#000000',
      backgroundColor: col, padding: '6px 12px', margin: '4px 8px'}));
    OUT.sum.add(ui.Label(ov.code + '   |   notation ' + ov.notation, {fontSize: '14px', fontWeight: 'bold', color: '#222', margin: '2px 8px'}));
    if (ov.rule) OUT.sum.add(rlSmall(ov.rule, '#7a1f00'));
    if (ov.dd && !r.ddRule) OUT.sum.add(rlSmall('Every category from LC to CR is plausible: consider Data Deficient (Guidelines 10.3).', '#7a1f00'));
    OUT.sum.add(MAS.tableChart([['Criterion', 'string'], ['Result', 'string'], ['Best', 'string'], ['Lowest plausible', 'string'], ['Highest plausible', 'string']],
      ov.crit.map(function (c) { return [c.k, c.code, c.best, c.low, c.high]; })));
    OUT.sum.add(rlSmall('Best estimate ' + ov.best + ', plausible ' + ov.low + ' to ' + ov.high + ', attitude ' + r.attitude.toLowerCase() + ' -> ' + ov.category +
      '. The category is the highest reached by any criterion (Guidelines 2.2); all criteria met at that category are listed.' + (dark ? '' : '')));
    // generation length
    OUT.gl.clear();
    OUT.gl.add(rlSmall('Generation length: ' + (isFinite(gl.gl) ? MAS.fmt(gl.gl, 2) + ' years - ' + gl.how : 'not given (Criterion A uses the minimum 10-year window; C1 periods use years)') +
      '\nCriterion A window: ' + MAS.windowYears(R) + ' years (max of 10 years and 3 generations; future part at most 100 years).' +
      (R.cfg.genLen > 0 && isFinite(gl.gl) && Math.abs(gl.gl - R.cfg.genLen) > 1e-9 ? '\nThe run used ' + R.cfg.genLen + ' years (left panel 4b) for its key years; the window here is recomputed from the fitted series.' : '')));
    // A
    OUT.A.clear();
    var A = ov.A;
    if (A.E || A.A) {
      OUT.A.add(MAS.tableChart([['Extent', 'string'], ['Years in fit', 'string'], ['Observed %', 'number'], ['Exponential %', 'number'], ['Linear %', 'number'],
        ['Best habitat %', 'number'], ['Population % (z)', 'number']],
        [A.E, A.A].filter(function (x) { return x; }).map(function (m) {
          return [m.scope + ' AOH', m.fit.from + '-' + m.fit.to + ' (' + m.fit.n + ')', isFinite(m.obs) ? MAS.round(m.obs, 2) : null, isFinite(m.exp) ? MAS.round(m.exp, 2) : null,
            isFinite(m.lin) ? MAS.round(m.lin, 2) : null, isFinite(m.best) ? MAS.round(m.best, 2) : null, isFinite(MAS.popRed(m.best, A.z)) ? MAS.round(MAS.popRed(m.best, A.z), 2) : null]; })));
    }
    OUT.A.add(ui.Label('Criterion A: ' + A.code + ' - ' + (isFinite(A.reduction) ? MAS.redText(A.reduction) + ' (' + A.qualifier + '; plausible ' + MAS.redText(A.redLow) + ' to ' +
      MAS.redText(A.redHigh) + ')' : 'not computed') + ' over ' + A.window + ' years, ' + A.from + '-' + A.to + (A.short ? ' (extrapolated beyond the land-cover series)' : '') +
      (A.sdm ? '\nBioclimate model: ' + MAS.fmt(A.sdm.best, 1) + '% (range ' + MAS.fmt(A.sdm.lo, 1) + ' to ' + MAS.fmt(A.sdm.hi, 1) + '%)' : '') + (A.note ? '\n' + A.note : ''),
      {fontSize: '13px', fontWeight: 'bold', color: '#7a1f00', whiteSpace: 'pre-wrap'}));
    OUT.A.add(rlSmall('Thresholds ' + A.thrSub + ': CR ≥ ' + MAS.THR[A.thrSub].CR + '%, EN ≥ ' + MAS.THR[A.thrSub].EN + '%, VU ≥ ' + MAS.THR[A.thrSub].VU + '%; NT from ' +
      MAS.THR[A.thrSub].NT + '% (Guidelines 10.1 examples). AOH = ' + MAS.aohLabel(R) + '.'));
    // B
    OUT.B.clear();
    var Bup = ov.Bup, sc = MAS.aooScales(R), ah = MAS.alphaHull(R, 2);
    OUT.B.add(ui.Label('Criterion B: ' + ov.B.code + '  |  with the AOO upper bound (' + MAS.fmt(MAS.aooUpper(R), 0) + ' km²): ' + Bup.code,
      {fontSize: '13px', fontWeight: 'bold', color: '#7a1f00', whiteSpace: 'pre-wrap'}));
    OUT.B.add(rlSmall('AOO lower bound = occupied cells (' + R.aoo.areaKm2 + ' km²); upper bound = ' +
      (R.IU && isFinite(R.IU.aooUpper) ? 'AOH within the EOO counted on a 2 x 2 km grid (' + MAS.fmt(R.IU.aooUpper, 0) + ' km², Guidelines 4.10.8)' :
        'AOH area in the EOO (' + MAS.fmt(R.bounds ? R.bounds.upper : NaN, 0) + ' km²; 2-km grid count still loading or not available)') +
      '. Locations: ' + R.loc.n + ' (' + R.loc.method + ') - they must reflect the most serious plausible threat: ' +
      (MAS.mostSeriousThreat(R) ? MAS.mostSeriousThreat(R).code + ' ' + MAS.mostSeriousThreat(R).name : 'no threat coded yet') + ' (Guidelines 4.11).'));
    OUT.B.add(MAS.tableChart([['AOO grid cell (km)', 'number'], ['Occupied cells', 'number'], ['AOO (km²)', 'number']], sc.map(function (s) { return [s.km, s.n, s.area]; })));
    OUT.B.add(rlSmall('AOO must be measured on 2 x 2 km cells (Guidelines 4.10); other sizes show the scale dependence. Alpha hull (α = 2, for EOO trends only): ' +
      MAS.fmt(ah.area, 1) + ' km² (' + ah.nTri + ' of ' + (ah.nAll || 0) + ' Delaunay triangles kept) vs EOO ' + MAS.fmt(R.eooKm2, 1) + ' km².'));
    // CDE
    OUT.CDE.clear();
    OUT.CDE.add(ui.Label('C: ' + ov.C.code + '\nD: ' + ov.D.code + '\nE: ' + ov.E.code, {fontSize: '13px', fontWeight: 'bold', color: '#7a1f00', whiteSpace: 'pre-wrap'}));
    OUT.CDE.add(rlSmall('C: < 250 / 2,500 / 10,000 mature individuals with C1 (25% in 3 yr or 1 gen, 20% in 5 yr or 2 gen, 10% in 10 yr or 3 gen) or C2 (decline + ' +
      'largest subpopulation ≤ 50/250/1,000 or ≥ 90/95/100% in one, or extreme fluctuations). D: < 50 / 250 / 1,000; VU D2 = AOO < 20 km² or ≤ 5 locations ' +
      'with a plausible threat (here AOO ' + R.aoo.areaKm2 + ' km², ' + R.loc.n + ' locations -> ' + (ov.D.d2Possible ? 'D2 possible' : 'D2 not applicable') + ').'));
    // records
    OUT.recs.clear();
    var per2 = MAS.recordPeriods(R), fl = MAS.recordFlags(R);
    OUT.recs.add(MAS.tableChart([['Records', 'string'], ['N', 'number'], ['EOO km²', 'number'], ['AOO km²', 'number']],
      [['All used', per2.all.n, MAS.round(per2.all.eoo, 1), per2.all.aoo], ['Current (≥ ' + per2.since + ') + undated', per2.current.n, MAS.round(per2.current.eoo, 1), per2.current.aoo],
       ['Current, dated only', per2.currentDated.n, MAS.round(per2.currentDated.eoo, 1), per2.currentDated.aoo], ['Historical (< ' + per2.since + ')', per2.historical.n, MAS.round(per2.historical.eoo, 1), per2.historical.aoo]]));
    OUT.recs.add(rlSmall('Date last recorded: ' + (isFinite(per2.last) ? per2.last : 'unknown') + '; ' + per2.nUndated + ' undated records. EOO and AOO should use ' +
      'current occurrences only (Guidelines 4.9-4.10); the main run uses every record not excluded.'));
    OUT.recs.add(MAS.tableChart([['id', 'number'], ['Error', 'string'], ['Flags', 'string'], ['Elevation m', 'number'], ['Admin unit', 'string'], ['Ecoregion', 'string']],
      fl.map(function (f) { return [f.id, f.error ? 'YES' : '', f.flags.join('; '), isFinite(f.rec.elev) ? Math.round(f.rec.elev) : null, (f.rec.adm2 ? f.rec.adm2 + ', ' : '') + (f.rec.adm1 || ''), f.rec.eco || '']; })));
    // coded
    OUT.coded.clear();
    var cc = MAS.countryCoding(R);
    OUT.coded.add(MAS.tableChart([['Country', 'string'], ['Presence', 'string'], ['Origin', 'string'], ['Seasonality', 'string'], ['Records', 'number'], ['Last record', 'number'], ['Basis', 'string']],
      cc.map(function (c) { return [c.country, c.presence + ' ' + MAS.PRESENCE[c.presence], c.origin + ' ' + MAS.ORIGIN[c.origin], c.seasonal + ' ' + MAS.SEASONAL[c.seasonal], c.n, isFinite(c.last) ? c.last : null, c.why]; })));
    var sub = MAS.subCountry(R);
    if (sub.length) OUT.coded.add(MAS.tableChart([['Country', 'string'], ['Sub-country unit (GAUL 1)', 'string'], ['Presence', 'string'], ['Records', 'number']],
      sub.map(function (s) { return [s.country, s.adm1, MAS.PRESENCE[s.presence], s.n]; })));
    var rb = MAS.realmsBiomes(R);
    OUT.coded.add(rlSmall('Biogeographic realm(s): ' + (Object.keys(rb.realm).join(', ') || 'not available') + ' | Elevation limits (records, DEM): ' +
      (R.recElev && isFinite(R.recElev.min) ? Math.round(R.recElev.min) + '-' + Math.round(R.recElev.max) + ' m' : 'not available') +
      ' | System: ' + [r.sysT ? 'Terrestrial' : '', r.sysF ? 'Freshwater' : '', r.sysM ? 'Marine' : ''].filter(String).join(', ') +
      ' | Population trend: ' + MAS.popTrend(R).trend + ' (' + MAS.popTrend(R).qualifier + ')'));
    if (rb.eco.length) OUT.coded.add(MAS.tableChart([['Ecoregion (RESOLVE 2017)', 'string'], ['Biome', 'string'], ['Records', 'number'], ['km² in the range', 'number'], ['%', 'number']],
      rb.eco.map(function (e) { return [e.name, e.biome || '', e.n, isFinite(e.km2) ? MAS.round(e.km2, 1) : null, isFinite(e.pct) ? MAS.round(e.pct, 1) : null]; })));
    OUT.coded.add(MAS.tableChart([['Habitat code', 'string'], ['Habitat (IUCN 3.1)', 'string'], ['Suitability', 'string'], ['Major importance', 'string'], ['Records', 'number'], ['Land-cover classes', 'string'], ['Included', 'string']],
      MAS.habitatCoding(R).map(function (h) { return [h.code, h.name, h.suitability, h.major, h.n, h.classList, h.on ? 'yes' : 'no']; })));
    var th = MAS.threatCoding(R);
    OUT.coded.add(MAS.tableChart([['Threat code', 'string'], ['Threat (IUCN-CMP 3.3)', 'string'], ['Timing', 'string'], ['Scope', 'string'], ['Severity', 'string'], ['Major', 'string'], ['Stresses', 'string'], ['Evidence', 'string']],
      th.map(function (t) { return [t.code, t.name + (t.v4 ? ' [v4.0: ' + t.v4 + ']' : ''), t.timing, t.scope, t.severity, t.major ? 'YES' : '', t.stressNames, t.evidence + (t.on ? '' : ' (not included)')]; })));
    OUT.coded.add(rlSmall('Major threats = ongoing, rapid or very rapid declines, majority or whole of the population (Threats scheme note 1). Scope = share of ' +
      'occupied cells with the driver class; severity = AOH converted to it over the window. IUCN suspended the threat impact scores in 2022-2: scope and ' +
      'severity are optional fields; timing and stresses are recommended.'));
    OUT.coded.add(MAS.tableChart([['Conservation actions in place', 'string'], ['Answer', 'string']], MAS.consInPlace(R)));
    var an = MAS.actionsNeeded(R, ov.category).concat(MAS.researchNeeded(R, ov.category));
    if (an.length) OUT.coded.add(MAS.tableChart([['Code', 'string'], ['Action / research needed', 'string'], ['Reason', 'string'], ['Included', 'string']],
      an.map(function (a) { return [a.code, a.name, a.why, a.on ? 'yes' : 'no']; })));
    // checklist
    OUT.check.clear();
    MAS.checklist(R).forEach(function (c) {
      OUT.check.add(ui.Label(c[0] + '  ' + c[1], {fontSize: '12px', whiteSpace: 'pre-wrap', margin: '1px 8px',
        color: c[0] === '✔' ? '#1f6b2f' : c[0] === '✖' ? '#b30000' : '#8a5a00'}));
    });
    // narratives
    OUT.narr.clear();
    var N = MAS.narratives(R);
    [['Geographic range', N.range], ['Population', N.population], ['Habitats and ecology', N.habitat], ['Threats', N.threats],
     ['Conservation actions', N.conservation], ['Use and trade', N.useTrade], ['Assessment rationale', N.rationale]].forEach(function (x) {
      OUT.narr.add(ui.Label(x[0], {fontSize: '12px', fontWeight: 'bold', margin: '6px 8px 0 8px'}));
      OUT.narr.add(ui.Label(x[1], {fontSize: '12px', whiteSpace: 'pre-wrap', margin: '0 8px'}));
    });
  }
  fill();
}
