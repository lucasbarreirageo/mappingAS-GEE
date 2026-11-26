/**** mappingAS GEE 2.0.0 - module "iucn_calc": IUCN calculations
 * Section 23: assessment settings, generation length, criteria A-E, plausible ranges, NT/DD rules.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: config, run, rangecalc, utils, iucn_coding
 * Shared state created here: THIS_YEAR, CAT_RANK, GL_METHODS
 ****/

// ============================================================================
// 23. IUCN CALCULATIONS (client side, instant): assessment settings, generation length,
//     criteria A-E with plausible ranges, attitude to uncertainty, NT and DD rules,
//     record checks, AOO scale, alpha hull, current vs historical records
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.maxCat = maxCat;
  MAS.minCat = minCat;
  MAS.rlDefaults = rlDefaults;
  MAS.RL = RL;
  MAS.genLength = genLength;
  MAS.windowYears = windowYears;
  MAS.suitList = suitList;
  MAS.isSuit = isSuit;
  MAS.habOf = habOf;
  MAS.aohLabel = aohLabel;
  MAS.habSeries = habSeries;
  MAS.fitSeries = fitSeries;
  MAS.predict = predict;
  MAS.redBetween = redBetween;
  MAS.redText = redText;
  MAS.popRed = popRed;
  MAS.catOfRed = catOfRed;
  MAS.aLetters = aLetters;
  MAS.critA = critA;
  MAS.bDecDetail = bDecDetail;
  MAS.bFlDetail = bFlDetail;
  MAS.aooUpper = aooUpper;
  MAS.critB = critB;
  MAS.catN = catN;
  MAS.critC = critC;
  MAS.critD = critD;
  MAS.critE = critE;
  MAS.anyThreatEvidence = anyThreatEvidence;
  MAS.rlCategories = rlCategories;
  MAS.overallCategory = overallCategory;
  MAS.decimals = decimals;
  MAS.recordFlags = recordFlags;
  MAS.aooScales = aooScales;
  MAS.delaunay = delaunay;
  MAS.alphaHull = alphaHull;
  MAS.rangeOf = rangeOf;
  MAS.recordPeriods = recordPeriods;
};

exports.run = function () {
  MAS.THIS_YEAR = new Date().getFullYear();
  MAS.CAT_RANK = {CR: 5, EN: 4, VU: 3, NT: 2, LC: 1, DD: 0, NA: 0};
  var RANK_CAT = ['NA', 'LC', 'NT', 'VU', 'EN', 'CR'];
  // ---- generation length (Guidelines 4.4)
  MAS.GL_METHODS = [{label: 'Generation length typed directly', value: 'DIRECT'},
    {label: '1 / adult mortality + age at first reproduction', value: 'MORT'},
    {label: 'Age at first reproduction + z x reproductive lifespan', value: 'REPRO'},
    {label: 'Plants with seed bank: juvenile period + seed-bank half-life', value: 'SEED'}];
};

function maxCat(a, b) { return (MAS.CAT_RANK[a] || 0) >= (MAS.CAT_RANK[b] || 0) ? a : b; }
function minCat(a, b) { return (MAS.CAT_RANK[a] || 0) <= (MAS.CAT_RANK[b] || 0) ? a : b; }
function rlDefaults(R) {
  var gl = R.cfg && isFinite(R.cfg.genLen) && R.cfg.genLen > 0 ? R.cfg.genLen : NaN;
  return {scope: 'Global', kingdom: 'PLANTAE', growthForm: 'Unknown', sysT: true, sysF: false, sysM: false,
    glMethod: 'DIRECT', glDirect: gl, glAfr: NaN, glMort: NaN, glRepro: NaN, glZ: 0.29, glJuv: NaN, glSeed: NaN,
    attitude: 'BEST', ddRule: true,
    aSub: 'A2', a1rev: false, a1und: false, a1ceased: false, aPattern: 'EXP', aZ: 1, aQual: 'inferred', a4Back: NaN,
    aBasis: {a: false, b: false, c: true, d: false, e: false},
    nBest: NaN, nMin: NaN, nMax: NaN, c1g1: NaN, c1g2: NaN, c1g3: NaN, c2decline: false, c2ai: NaN, c2aii: NaN, c2b: false,
    d2threat: false, pE3: NaN, pE5: NaN, pE100: NaN,
    bDec: {i: false, ii: false, iii: !!(R.assess ? R.assess.decline : R.declineInferred), iv: false, v: false}, bFl: {i: false, ii: false, iii: false, iv: false},
    bCertain: false, popTrend: 'AUTO', useTrade: MAS.USE_TRADE[0], since: MAS.THIS_YEAR - 30, sdmA3: true,
    assessors: '', reviewers: '', contributors: '', compiler: '', citation: '', commonName: '', sel: {}};
}
function RL(R) { if (!R.RL) R.RL = rlDefaults(R); return R.RL; }
function genLength(R) {
  var r = RL(R), m = r.glMethod, gl = NaN, how = 'not given';
  if (m === 'DIRECT' && r.glDirect > 0) { gl = r.glDirect; how = 'given directly (' + r.glDirect + ' years)'; }
  if (m === 'MORT' && r.glAfr >= 0 && r.glMort > 0 && r.glMort <= 1) {
    gl = r.glAfr + 1 / r.glMort; how = 'age at first reproduction (' + r.glAfr + ' yr) + 1 / adult annual mortality (' + r.glMort + ')';
  }
  if (m === 'REPRO' && r.glAfr >= 0 && r.glRepro > 0) {
    gl = r.glAfr + r.glZ * r.glRepro; how = 'age at first reproduction (' + r.glAfr + ' yr) + ' + r.glZ + ' x reproductive lifespan (' + r.glRepro + ' yr)';
  }
  if (m === 'SEED' && r.glJuv >= 0 && r.glSeed >= 0) {
    gl = r.glJuv + r.glSeed; how = 'juvenile period (' + r.glJuv + ' yr) + seed-bank half-life (' + r.glSeed + ' yr)';
  }
  return {gl: isFinite(gl) && gl > 0 ? gl : NaN, how: how};
}
function windowYears(R) { var g = genLength(R).gl; return isFinite(g) ? Math.max(10, Math.round(3 * g)) : 10; }
// ---- species habitat (AOH): suitable classes within the elevation limits
function suitList(R) {
  if (R._suitList) return R._suitList;
  var p = (R.cfg && R.cfg.suit) || 'NATURAL', codes = null;
  if (p === 'CUSTOM' && R.cfg.suitCodes && R.cfg.suitCodes.length) codes = R.cfg.suitCodes.slice();
  else if (MAS.SUIT_PRESETS[p] && MAS.SUIT_PRESETS[p].codes) codes = MAS.SUIT_PRESETS[p].codes.slice();
  if (!codes) codes = MAS.LEGEND.filter(function (l) { return l[3] === 'natural' || (MAS.WATER_DENOM && l[3] === 'water'); }).map(function (l) { return l[0]; });
  R._suitList = codes;
  R._suit = {}; codes.forEach(function (c) { R._suit[c] = true; });
  return codes;
}
function isSuit(R, code) { suitList(R); return !!R._suit[Number(code)]; }
function habOf(R, parsed, sel) {
  if (!parsed) return NaN;
  suitList(R);
  var tot = 0, useE = !!R.elev;
  for (var z in parsed) {
    if (!parsed.hasOwnProperty(z)) continue;
    var zn = Number(z);
    if (!MAS.zoneOk(zn, sel) || (useE && zn >= MAS.ZONE_ELEV)) continue;
    for (var code in parsed[z]) if (parsed[z].hasOwnProperty(code) && R._suit[Number(code)]) tot += parsed[z][code];
  }
  return tot;
}
function aohLabel(R) {
  var p = (R.cfg && R.cfg.suit) || 'NATURAL';
  return (MAS.SUIT_PRESETS[p] ? MAS.SUIT_PRESETS[p].label : 'natural classes') + (p === 'CUSTOM' ? ' (' + suitList(R).join(', ') + ')' : '') +
    (R.elev ? '; elevation ' + Math.round(R.elev.min) + '-' + Math.round(R.elev.max) + ' m (' + R.elev.mode + ')' : '; no elevation limit');
}
function habSeries(R, scope) {
  var ser = scope === 'EOO' ? (R.hasB ? R.B.series : null) : (R.A ? R.A.series : null);
  if (!ser) return null;
  var ys = Object.keys(ser).map(Number).filter(function (y) { return !!ser[y]; }).sort(function (a, b) { return a - b; });
  var out = {years: [], vals: []};
  ys.forEach(function (y) { var v = habOf(R, ser[y]); if (isFinite(v)) { out.years.push(y); out.vals.push(v); } });
  return out.years.length ? out : null;
}
// ---- Criterion A (Guidelines 4.5 and 5): fitted models, extrapolation, A1-A4, population response
function fitSeries(S, a, b) {
  var xs = [], ys = [], i;
  for (i = 0; i < S.years.length; i++) if (S.years[i] >= a && S.years[i] <= b) { xs.push(S.years[i]); ys.push(S.vals[i]); }
  if (xs.length < 3) { xs = S.years.slice(); ys = S.vals.slice(); }
  var lin = MAS.ols(xs, ys), pos = ys.every(function (v) { return v > 0; });
  var ex = pos ? MAS.ols(xs, ys.map(Math.log)) : null;
  return {lin: lin, exp: ex, from: xs[0], to: xs[xs.length - 1], n: xs.length};
}
function predict(f, model, t) {
  if (model === 'EXP') return f.exp ? Math.exp(f.exp.intercept + f.exp.slope * t) : NaN;
  return f.lin ? f.lin.intercept + f.lin.slope * t : NaN;
}
function redBetween(f, model, t0, t1) {
  var v0 = predict(f, model, t0), v1 = predict(f, model, t1);
  if (!isFinite(v0) || !isFinite(v1)) return NaN;
  if (v0 <= 0) return v1 <= 0 ? NaN : -100;
  return Math.max(-999, Math.min(100, 100 * (1 - Math.max(0, v1) / v0)));
}
function redText(v, d) { return !isFinite(v) ? '-' : v < 0 ? 'no reduction (+' + MAS.fmt(-v, d === undefined ? 1 : d) + '%)' : MAS.fmt(v, d === undefined ? 1 : d) + '%'; }
function popRed(h, z) { if (!isFinite(h)) return NaN; if (h >= 100) return 100; if (h <= -999) return h; return 100 * (1 - Math.pow(1 - h / 100, z)); }
function catOfRed(sub, red) {
  var t = MAS.THR[sub] || MAS.THR.A2;
  if (!isFinite(red)) return 'NA';
  return red >= t.CR ? 'CR' : red >= t.EN ? 'EN' : red >= t.VU ? 'VU' : red >= t.NT ? 'NT' : 'LC';
}
function aLetters(R) { var b = RL(R).aBasis; return ['a', 'b', 'c', 'd', 'e'].filter(function (k) { return b[k]; }).join('') || 'c'; }
function critA(R) {
  var r = RL(R), W = windowYears(R), z = r.aZ > 0 ? r.aZ : 1;
  var sub = r.aSub || 'A2', a1ok = r.a1rev && r.a1und && r.a1ceased, note = '';
  if (sub === 'A1' && !a1ok) { note = 'A1 needs causes reversible AND understood AND ceased: A2 thresholds used.'; }
  var thrSub = sub === 'A1' && !a1ok ? 'A2' : sub;
  var y1 = Math.max(R.y1, MAS.THIS_YEAR), t0, t1, past = true;   // the window ends now (Guidelines 4.5: the most recent 10 years / 3 generations)
  if (sub === 'A3') { t0 = y1; t1 = y1 + Math.min(W, 100); past = false; }
  else if (sub === 'A4') { var back = isFinite(r.a4Back) && r.a4Back >= 0 ? Math.min(r.a4Back, W) : Math.round(W / 2); t0 = y1 - back; t1 = t0 + W; if (t1 > y1 + 100) t1 = y1 + 100; }
  else { t0 = y1 - W; t1 = y1; }
  function one(scope) {
    var S = habSeries(R, scope);
    if (!S || S.years.length < 2) return null;
    var f = fitSeries(S, sub === 'A3' ? y1 - W : t0, y1);   // fitted on the data inside the window, projected to the present when the series stops earlier
    var exp = redBetween(f, 'EXP', t0, t1), lin = redBetween(f, 'LIN', t0, t1), obs = NaN, obsFrom = null;
    if (past) {
      var i0 = -1;
      for (var i = 0; i < S.years.length; i++) if (S.years[i] >= t0) { i0 = i; break; }
      var iL = S.years.length - 1;
      if (i0 >= 0 && iL > i0 && S.vals[i0] > 0) { obs = 100 * (1 - S.vals[iL] / S.vals[i0]); obsFrom = S.years[i0]; }
    }
    var best = r.aPattern === 'LIN' ? lin : exp;
    if (!isFinite(best)) best = isFinite(exp) ? exp : isFinite(lin) ? lin : obs;
    var vals = [exp, lin, obs].filter(function (v) { return isFinite(v); });
    return {scope: scope, S: S, fit: f, exp: exp, lin: lin, obs: obs, obsFrom: obsFrom, best: best,
      lo: vals.length ? Math.min.apply(null, vals) : NaN, hi: vals.length ? Math.max.apply(null, vals) : NaN,
      extrap: t0 < S.years[0] || t1 > S.years[S.years.length - 1]};
  }
  var E = R.hasB ? one('EOO') : null, A = one('AOO');
  var M = E || A;
  var out = {sub: sub, thrSub: thrSub, window: W, from: t0, to: t1, z: z, note: note, letters: aLetters(R), qualifier: past ? r.aQual : 'projected',
    reductionEoo: E ? E.best : NaN, reductionAoo: A ? A.best : NaN, E: E, A: A, basis: E ? 'EOO habitat (AOH)' : 'AOO habitat (AOH)'};
  if (!M) { out.reduction = NaN; out.category = 'NA'; out.catLow = 'NA'; out.catHigh = 'NA'; out.code = 'NA (no habitat series)'; return out; }
  out.habReduction = M.best;
  out.reduction = popRed(M.best, z); out.redLow = popRed(M.lo, z); out.redHigh = popRed(M.hi, z);
  out.short = M.extrap;
  // SDM-based A3 (Guidelines 12.1.12.4: relative change in summed suitability)
  if (sub === 'A3' && r.sdmA3 && R.SDM && R.SDM.done && isFinite(R.SDM.redBest)) {
    // land-use trend and climate (bioclimate model) combined as independent causes: 1 - (1 - a)(1 - b)
    var comb = function (a, b) { a = isFinite(a) ? Math.max(0, a) : 0; b = isFinite(b) ? Math.max(0, b) : 0; return 100 * (1 - (1 - a / 100) * (1 - b / 100)); };
    out.sdm = {best: R.SDM.redBest, lo: R.SDM.redLo, hi: R.SDM.redHi};
    out.reduction = comb(out.reduction, R.SDM.redBest); out.redLow = comb(out.redLow, R.SDM.redLo); out.redHigh = comb(out.redHigh, R.SDM.redHi);
    out.letters = out.letters.indexOf('c') >= 0 ? out.letters : out.letters + 'c';
  }
  out.category = catOfRed(thrSub, out.reduction);
  out.catLow = catOfRed(thrSub, out.redLow); out.catHigh = catOfRed(thrSub, out.redHigh);
  var lab = sub + out.letters;
  out.code = MAS.isThreatened(out.category) ? out.category + ' ' + lab : out.category === 'NT' ? 'NT (nearly meets ' + lab + ')' : out.category;
  out.label = lab;
  return out;
}
// ---- Criterion B with sub-criteria detail, AOO bounds and the NT rules of Guidelines 10.1
function bDecDetail(R) {
  var r = RL(R), d = ['i', 'ii', 'iii', 'iv', 'v'].filter(function (k) { return r.bDec[k]; });
  if (!d.length) d = ['iii'];   // the land-cover evidence is about habitat; an assumed decline is also coded (iii)
  return d.join(',');
}
function bFlDetail(R) { var r = RL(R); return ['i', 'ii', 'iii', 'iv'].filter(function (k) { return r.bFl[k]; }).join(','); }
function aooUpper(R) {
  var lo = R.aoo.areaKm2, up = R.IU && isFinite(R.IU.aooUpper) ? R.IU.aooUpper : (R.bounds ? R.bounds.upper : NaN);
  if (!isFinite(up)) return lo;
  up = Math.max(up, lo);
  var e = R.cat ? R.cat.eooAdj : R.eooKm2;
  return isFinite(e) && e > 0 ? Math.min(up, Math.max(e, lo)) : up;
}
function critB(R, aooVal) {
  var r = RL(R), as = R.assess || {decline: false, fluct: false, frag: false};
  var aoo = aooVal !== undefined ? aooVal : R.aoo.areaKm2;
  var eoo = isFinite(R.eooKm2) && isFinite(aoo) && R.eooKm2 < aoo ? aoo : R.eooKm2;
  var nLoc = R.loc ? R.loc.n : NaN, frag = !!as.frag, b = !!as.decline, c = !!as.fluct;
  var bd = b ? bDecDetail(R) : '', cd = c ? bFlDetail(R) : '';
  var levels = ['CR', 'EN', 'VU'];
  for (var i = 0; i < levels.length; i++) {
    var L = levels[i], s1 = isFinite(eoo) && eoo < MAS.THR.B1[L], s2 = isFinite(aoo) && aoo < MAS.THR.B2[L];
    if (!s1 && !s2) continue;
    var a = frag || (isFinite(nLoc) && nLoc <= MAS.THR.Bloc[L]);
    if ((a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0) >= 2) {
      var lett = (a ? 'a' : '') + (b ? 'b' + (bd ? '(' + bd + ')' : '') : '') + (c ? 'c' + (cd ? '(' + cd + ')' : '') : '');
      var axes = [];
      if (s1) axes.push('1' + lett);
      if (s2) axes.push('2' + lett);
      return {category: L, code: L + ' B' + axes.join('+'), a: a, b: b, c: c, aoo: aoo, eoo: eoo, label: 'B' + axes.join('+')};
    }
  }
  var aVU = frag || (isFinite(nLoc) && nLoc <= 10), n = (aVU ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0);
  var sizeVU = (isFinite(eoo) && eoo < MAS.THR.B1.VU) || (isFinite(aoo) && aoo < MAS.THR.B2.VU);
  var base = {a: aVU, b: b, c: c, aoo: aoo, eoo: eoo};
  if (!isFinite(eoo) && !isFinite(aoo)) return MAS.merge(base, {category: 'NA', code: 'NA'});
  if (sizeVU && n === 1) return MAS.merge(base, {category: 'NT', code: 'NT (nearly meets B: area thresholds met with one sub-criterion)', label: 'B' + ((isFinite(eoo) && eoo < MAS.THR.B1.VU) ? '1' : '2')});
  if (sizeVU) return MAS.merge(base, {category: 'LC', code: 'LC (B area thresholds met, no sub-criterion: not NT on this basis, Guidelines 10.1)', sizeOnly: true});
  var lim = r.bCertain ? [22000, 2200] : [30000, 3000];
  if (n >= 2 && ((isFinite(eoo) && eoo < lim[0]) || (isFinite(aoo) && aoo < lim[1])))
    return MAS.merge(base, {category: 'NT', code: 'NT (close to the B thresholds: EOO ' + MAS.fmt(eoo, 0) + ' / AOO ' + MAS.fmt(aoo, 0) + ' km² with two sub-criteria)', label: 'B'});
  return MAS.merge(base, {category: 'LC', code: 'LC'});
}
// ---- Criteria C, D, E (population data typed by the assessor)
function catN(N, t) { return !isFinite(N) ? 'NA' : N < t.CR ? 'CR' : N < t.EN ? 'EN' : N < t.VU ? 'VU' : 'LC'; }
function critC(R, Nv) {
  var r = RL(R), N = Nv !== undefined ? Nv : r.nBest;
  if (!isFinite(N)) return {category: 'NA', code: 'not assessed (population size not given)'};
  var dec = r.c2decline || r.bDec.v, c1v = {CR: r.c1g1, EN: r.c1g2, VU: r.c1g3};
  var levels = ['CR', 'EN', 'VU'];
  for (var i = 0; i < levels.length; i++) {
    var L = levels[i];
    if (!(N < MAS.THR.C[L])) continue;
    var c1 = isFinite(c1v[L]) && c1v[L] >= MAS.THR.C1[L][0];
    var ai = isFinite(r.c2ai) && r.c2ai <= MAS.THR.C2ai[L], aii = isFinite(r.c2aii) && r.c2aii >= MAS.THR.C2aii[L];
    var c2 = dec && (ai || aii || r.c2b);
    if (c1 || c2) {
      var parts = [];
      if (c1) parts.push('1');
      if (c2) parts.push('2' + (ai || aii ? 'a(' + (ai ? 'i' : '') + (ai && aii ? ',' : '') + (aii ? 'ii' : '') + ')' : '') + (r.c2b ? 'b' : ''));
      return {category: L, code: L + ' C' + parts.join('+'), label: 'C' + parts.join('+')};
    }
  }
  if (N < 15000 && (dec || (isFinite(r.c1g3) && r.c1g3 >= 10))) return {category: 'NT', code: 'NT (nearly meets C: about ' + MAS.fmt(N, 0) + ' mature individuals and declining)', label: 'C'};
  return {category: 'LC', code: 'LC'};
}
function critD(R, Nv) {
  var r = RL(R), N = Nv !== undefined ? Nv : r.nBest;
  var aoo = R.aoo ? R.aoo.areaKm2 : NaN, nLoc = R.loc ? R.loc.n : NaN;
  var small = (isFinite(aoo) && aoo < MAS.THR.D2.aoo) || (isFinite(nLoc) && nLoc <= MAS.THR.D2.loc);
  var cat = 'NA', code = 'not assessed (population size not given)', label = null;
  if (isFinite(N)) {
    if (N < MAS.THR.D.CR) { cat = 'CR'; code = 'CR D'; label = 'D'; }
    else if (N < MAS.THR.D.EN) { cat = 'EN'; code = 'EN D'; label = 'D'; }
    else if (N < MAS.THR.D.VU) { cat = 'VU'; code = 'VU D1'; label = 'D1'; }
    else if (N < 2000) { cat = 'NT'; code = 'NT (nearly meets D1: about ' + MAS.fmt(N, 0) + ' mature individuals)'; label = 'D1'; }
    else { cat = 'LC'; code = 'LC'; }
  }
  if (small && r.d2threat) {
    if (label === 'D1') { code = 'VU D1+2'; label = 'D1+2'; }
    else if ((MAS.CAT_RANK[cat] || 0) < MAS.CAT_RANK.VU) { cat = 'VU'; code = 'VU D2'; label = 'D2'; }
  } else if (small && (MAS.CAT_RANK[cat] || 0) < MAS.CAT_RANK.NT && anyThreatEvidence(R)) {
    cat = 'NT'; label = 'D2';
    code = 'NT (nearly meets D2: AOO ' + MAS.fmt(aoo, 0) + ' km², ' + nLoc + ' locations; threats not expected to cause CR/EX in a very short time)';
  } else if (small && cat === 'NA') code += '; D2 possible (AOO < 20 km² or ≤ 5 locations): tick "plausible threat" if it applies';
  return {category: cat, code: code, label: label, d2Possible: small};
}
function critE(R) {
  var r = RL(R);
  if (!isFinite(r.pE3) && !isFinite(r.pE5) && !isFinite(r.pE100)) return {category: 'NA', code: 'not assessed (no quantitative model)'};
  if (r.pE3 >= 50) return {category: 'CR', code: 'CR E', label: 'E'};
  if (r.pE5 >= 20) return {category: 'EN', code: 'EN E', label: 'E'};
  if (r.pE100 >= 10) return {category: 'VU', code: 'VU E', label: 'E'};
  return {category: 'LC', code: 'LC (E)'};
}
function anyThreatEvidence(R) {
  if (R.declineInferred) return true;
  var t = MAS.threatCoding(R);
  return t.some(function (x) { return x.timing === 'Ongoing' || x.timing === 'Future'; });
}
// ---- all criteria, plausible range, attitude to uncertainty (Guidelines 3.2; Standards 2.6), NT and DD rules
function rlCategories(R) {
  var r = RL(R);
  var A = critA(R), B = critB(R), Bup = critB(R, aooUpper(R));
  var C = critC(R), Clo = isFinite(r.nMax) ? critC(R, r.nMax) : C, Chi = isFinite(r.nMin) ? critC(R, r.nMin) : C;
  var D = critD(R), Dlo = isFinite(r.nMax) ? critD(R, r.nMax) : D, Dhi = isFinite(r.nMin) ? critD(R, r.nMin) : D;
  var E = critE(R);
  var crit = [
    {k: 'A', best: A.category, low: minCat(A.catLow, A.category), high: maxCat(A.catHigh, A.category), code: A.code, label: A.label},
    {k: 'B', best: B.category, low: minCat(Bup.category, B.category), high: B.category, code: B.code, label: B.label},
    {k: 'C', best: C.category, low: minCat(Clo.category, C.category), high: maxCat(Chi.category, C.category), code: C.code, label: C.label},
    {k: 'D', best: D.category, low: minCat(Dlo.category, D.category), high: maxCat(Dhi.category, D.category), code: D.code, label: D.label},
    {k: 'E', best: E.category, low: E.category, high: E.category, code: E.code, label: E.label}];
  var best = 'NA', low = 'NA', high = 'NA';
  crit.forEach(function (c) { best = maxCat(best, c.best); low = maxCat(low, c.low); high = maxCat(high, c.high); });
  if (best === 'NA') best = 'LC';
  if (low === 'NA') low = best;
  if (high === 'NA') high = best;
  var chosen = r.attitude === 'PRECAUTIONARY' ? high : r.attitude === 'EVIDENTIARY' ? low : best;
  var rule = '';
  if ((chosen === 'LC') && MAS.isThreatened(high)) { chosen = 'NT'; rule = 'Best estimate LC but the plausible range reaches ' + high + ': NT (Guidelines 10.1; Standards 2.6).'; }
  var dd = low === 'LC' && high === 'CR';
  if (dd && r.ddRule) { rule = 'Every category from LC to CR is plausible: Data Deficient (Guidelines 4.10.8 and 10.1).'; }
  var final = dd && r.ddRule ? 'DD' : chosen;
  // criteria met at the final category (all of them are listed, Guidelines 2.2)
  var met = crit.filter(function (c) { return c.best === final && c.label && MAS.isThreatened(final); }).map(function (c) { return c.label; });
  if (!met.length && MAS.isThreatened(final)) met = crit.filter(function (c) { return (r.attitude === 'PRECAUTIONARY' ? c.high : c.low) === final && c.label; }).map(function (c) { return c.label; });
  var nearly = crit.filter(function (c) { return (c.best === 'NT' || (final === 'NT' && MAS.isThreatened(c.high))) && c.label; }).map(function (c) { return c.label; });
  var code = MAS.isThreatened(final) ? final + ' ' + MAS.uniq(met).join('; ') : final === 'NT' ? 'NT' + (nearly.length ? ' (nearly met: ' + MAS.uniq(nearly).join(', ') + ')' : '') : final;
  var star = r.attitude === 'PRECAUTIONARY' && final === high && high !== best ? '*' : '';
  var notation = final + star + (low !== high ? ' (' + high + '-' + low + ')' : '');
  return {crit: crit, A: A, B: B, Bup: Bup, C: C, D: D, E: E, best: best, low: low, high: high, chosen: chosen,
    category: final, code: code, notation: notation, rule: rule, dd: dd, met: met, nearly: nearly};
}
function overallCategory(R) {
  var c = rlCategories(R);
  return {category: c.category, code: c.code, from: c.met.length ? c.met.join('+') : 'A-E', notation: c.notation, low: c.low, high: c.high, best: c.best};
}
// ---- record checks (Required info: georeferenced data; Standards 5: consistency)
function decimals(x) { var s = String(Math.abs(x)); var i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }
function recordFlags(R) {
  var byId = {}, seen = {}, out = [];
  (R.pts || []).forEach(function (p) { byId[p.id] = p; });
  (R.all || []).forEach(function (r) {
    var f = [], err = false, p = byId[r.id] || {}, k = r.lon + ',' + r.lat, cls = p.lulc_year;
    if (r.lon === r.lat) { f.push('longitude = latitude'); err = true; }
    if (decimals(r.lon) <= 1 && decimals(r.lat) <= 1) { f.push('low precision (≤ 1 decimal)'); err = true; }
    else if (decimals(r.lon) <= 2 && decimals(r.lat) <= 2) f.push('low precision (2 decimals, ~1 km)');
    if (seen[k]) f.push('duplicate of id ' + seen[k]); else seen[k] = r.id;
    if (r.coordC === '') { f.push('outside land (LSIB)'); err = true; }
    if (r.mismatch) f.push('outside the declared country');
    if (isFinite(r.d0) && r.d0 >= 0 && r.d0 < 5000) { f.push('within 5 km of the country centroid'); err = true; }
    if (isFinite(r.d1) && r.d1 >= 0 && r.d1 < 1000) { f.push('within 1 km of a state/province centroid'); err = true; }
    if (isFinite(r.d2) && r.d2 >= 0 && r.d2 < 1000) { f.push('within 1 km of a municipality centroid'); err = true; }
    if (/centroid|tgn|gazetteer|google earth/i.test(r.georef || '')) f.push('georeference: ' + r.georef);
    if (cls !== undefined && cls !== null) {
      if (MAS.legOf(cls).group === 'water') f.push('in water (' + MAS.legOf(cls).name + ')');
      if (cls === 24 || cls === 107) f.push('in urban area');
      if (MAS.legOf(cls).group === 'anthropic') f.push('in converted land now (' + MAS.legOf(cls).name + ')');
    }
    if (isFinite(r.year) && r.year < RL(R).since) f.push('historical (' + r.year + ' < ' + RL(R).since + ')');
    if (!isFinite(r.year)) f.push('no date');
    out.push({id: r.id, flags: f, error: err, rec: r});
  });
  return out;
}
// ---- AOO at several grid sizes (Guidelines 4.10: scale; reference 2 x 2 km)
function aooScales(R) {
  var C = MAS.dataCentre(R.recs), P = MAS.laeaParams(C.lat0, C.lon0);
  return [1, 2, 4, 8, 16].map(function (k) { var g = MAS.aooGrid(R.recs, k, MAS.AOO_N_GRIDS, P); return {km: k, n: g.n, area: g.areaKm2}; });
}
// ---- alpha hull (alpha = 2; Burgman & Fox 2003; Guidelines 4.9: for EOO trends, not for B1)
function delaunay(pts) {
  var n = pts.length, i, j;
  if (n < 3) return [];
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(function (p) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
  var d = Math.max(maxX - minX, maxY - minY) || 1, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  var P = pts.concat([[mx - 1e4 * d, my - 1e4 * d], [mx, my + 1e4 * d], [mx + 1e4 * d, my - 1e4 * d]]);
  function circ(a, b, c) {
    var ax = P[a][0], ay = P[a][1], bx = P[b][0], by = P[b][1], cx = P[c][0], cy = P[c][1];
    var D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(D) < 1e-12) return {x: 0, y: 0, r2: Infinity};
    var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
    var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
    return {x: ux, y: uy, r2: (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy)};
  }
  var tris = [[n, n + 1, n + 2, circ(n, n + 1, n + 2)]];
  for (i = 0; i < n; i++) {
    var px = P[i][0], py = P[i][1], bad = [], keep = [];
    tris.forEach(function (t) { var c = t[3], dx = px - c.x, dy = py - c.y; if (dx * dx + dy * dy <= c.r2 * (1 + 1e-12)) bad.push(t); else keep.push(t); });
    var edges = {};
    bad.forEach(function (t) {
      [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(function (e) {
        var k = Math.min(e[0], e[1]) + '_' + Math.max(e[0], e[1]);
        edges[k] = edges[k] ? null : e;
      });
    });
    for (var k in edges) if (edges.hasOwnProperty(k) && edges[k]) keep.push([edges[k][0], edges[k][1], i, circ(edges[k][0], edges[k][1], i)]);
    tris = keep;
  }
  return tris.filter(function (t) { return t[0] < n && t[1] < n && t[2] < n; }).map(function (t) { return [t[0], t[1], t[2]]; });
}
function alphaHull(R, alpha) {
  var co = MAS.uniqueCoords(R.recs);
  if (co.length < 3 || co.length > 3000) return {area: NaN, nTri: 0, nAll: 0, skipped: co.length > 3000};
  if (R._alpha && R._alpha.n === co.length) return R._alpha.res;
  var C = MAS.dataCentre(R.recs), P = MAS.laeaParams(C.lat0, C.lon0);
  var xy = co.map(function (c) { var q = MAS.laeaFwd(P, c[0], c[1]); return [q[0] / 1000, q[1] / 1000]; });
  var tris = delaunay(xy);
  if (!tris.length) return {area: NaN, nTri: 0};
  var L = function (a, b) { return Math.sqrt(Math.pow(xy[a][0] - xy[b][0], 2) + Math.pow(xy[a][1] - xy[b][1], 2)); };
  var seen = {}, sum = 0, ne = 0;
  tris.forEach(function (t) { [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(function (e) {
    var k = Math.min(e[0], e[1]) + '_' + Math.max(e[0], e[1]); if (!seen[k]) { seen[k] = true; sum += L(e[0], e[1]); ne++; } }); });
  var lim = (alpha || 2) * sum / ne, area = 0, kept = 0;
  tris.forEach(function (t) {
    if (L(t[0], t[1]) > lim || L(t[1], t[2]) > lim || L(t[2], t[0]) > lim) return;
    area += Math.abs((xy[t[1]][0] - xy[t[0]][0]) * (xy[t[2]][1] - xy[t[0]][1]) - (xy[t[2]][0] - xy[t[0]][0]) * (xy[t[1]][1] - xy[t[0]][1])) / 2;
    kept++;
  });
  var res = {area: area, nTri: kept, nAll: tris.length, meanEdge: sum / ne};
  R._alpha = {n: co.length, res: res};
  return res;
}
// ---- current vs historical records (Guidelines 4.9-4.10: EOO and AOO from current occurrences)
function rangeOf(recs, cellKm) {
  if (!recs.length) return {n: 0, eoo: NaN, aoo: NaN};
  var C = MAS.dataCentre(recs), g = MAS.aooGrid(recs, cellKm, MAS.AOO_N_GRIDS, MAS.laeaParams(C.lat0, C.lon0));
  var h = MAS.convexHull(recs.map(function (r) { return [r.lon, r.lat]; }));
  return {n: recs.length, eoo: h.ring ? MAS.eooAreaKm2(h.ring, MAS.EOO_SEGMENT_KM) : 0, aoo: g.areaKm2};
}
function recordPeriods(R) {
  var since = RL(R).since, dated = R.recs.filter(function (r) { return isFinite(r.year); });
  var cur = dated.filter(function (r) { return r.year >= since; }), old = dated.filter(function (r) { return r.year < since; });
  var ys = dated.map(function (r) { return r.year; });
  return {since: since, nDated: dated.length, nUndated: R.recs.length - dated.length,
    last: ys.length ? Math.max.apply(null, ys) : NaN, first: ys.length ? Math.min.apply(null, ys) : NaN,
    all: rangeOf(R.recs, R.cfg.aooKm), current: rangeOf(cur.concat(R.recs.filter(function (r) { return !isFinite(r.year); })), R.cfg.aooKm),
    currentDated: rangeOf(cur, R.cfg.aooKm), historical: rangeOf(old, R.cfg.aooKm)};
}
