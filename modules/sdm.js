/**** mappingAS GEE 2.0.0 - module "sdm": bioclimate model
 * Section 26: variable screening, Maxent and down-sampled Random Forest, spatial block CV or jackknife
 * (AUC, TSS, Boyce), thresholds, projections per GCM x SSP, dispersal scenarios and Criterion A3.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: rangecalc, iucn_calc, climate, utils, iucn_coding, habitat, batch, run, redlist, layout, records, documents
 * Shared state created here: WC_MONTHLY, BIO_NAMES, BIO_KEYS, SDM_BASE, SDM_RECENT, DISP_NAMES, EVAL_H
 ****/

// ============================================================================
// 26. BIOCLIMATE MODEL (Guidelines 12.1.12; IUCN template "Supplementary Information for
//     Bioclimate Models"): presence-background, thinned records, random background within the
//     ecoregions of the records and a buffer, WorldClim-type variables computed from monthly
//     climatologies (current and future in the same way), at least two GCMs and two SSPs projected
//     one by one (no ensemble mean), two techniques (Maxent, Random Forest), spatially blocked
//     k-fold cross-validation or an n-1 jackknife for < 25 records (AUC, TSS, continuous Boyce index),
//     thresholds (lowest presence / max sensitivity + specificity), land-use exclusion, dispersal
//     scenarios, and the relative change in summed suitability as a proxy for the future reduction (A3).
//     The literature behind each default is listed in SDM_REFS and in the Word supplementary information.
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.sdmDefaults = sdmDefaults;
  MAS.SC = SC;
  MAS.sdmTarget = sdmTarget;
  MAS.bioFromMonthly = bioFromMonthly;
  MAS.wcMonth = wcMonth;
  MAS.bioBaseline = bioBaseline;
  MAS.gddpMonthly = gddpMonthly;
  MAS.bioProjected = bioProjected;
  MAS.thinPoints = thinPoints;
  MAS.foldOf = foldOf;
  MAS.aucOf = aucOf;
  MAS.quantile = quantile;
  MAS.corr = corr;
  MAS.sdmFit = sdmFit;
  MAS.sdmPred = sdmPred;
  MAS.suitImage = suitImage;
  MAS.sdmImg = sdmImg;
  MAS.predArr = predArr;
  MAS.minOf = minOf;
  MAS.maxOf = maxOf;
  MAS.sdOf = sdOf;
  MAS.fracGE = fracGE;
  MAS.tssAt = tssAt;
  MAS.bestTss = bestTss;
  MAS.ranks = ranks;
  MAS.boyce = boyce;
  MAS.thrMode = thrMode;
  MAS.thrOf = thrOf;
  MAS.pbTail = pbTail;
  MAS.cvMode = cvMode;
  MAS.blockFolds = blockFolds;
  MAS.dispKmOf = dispKmOf;
  MAS.runSdm = runSdm;
  MAS.sdmProject = sdmProject;
  MAS.invMatrix = invMatrix;
  MAS.vifOf = vifOf;
  MAS.varCap = varCap;
  MAS.vgPairs = vgPairs;
  MAS.vgRange = vgRange;
  MAS.suggestBlock = suggestBlock;
  MAS.screenVars = screenVars;
  MAS.screenPanel = screenPanel;
  MAS.renderSdmTab = renderSdmTab;
  MAS.evalRows = evalRows;
  MAS.dispRows = dispRows;
  MAS.renderSdmResults = renderSdmResults;
};

exports.run = function () {
  MAS.WC_MONTHLY = 'WORLDCLIM/V1/MONTHLY';
  MAS.BIO_NAMES = {bio01: 'Annual mean temperature', bio02: 'Mean diurnal range', bio03: 'Isothermality', bio04: 'Temperature seasonality (sd x 100)',
    bio05: 'Max temperature of the warmest month', bio06: 'Min temperature of the coldest month', bio07: 'Temperature annual range',
    bio08: 'Mean temperature of the wettest quarter', bio09: 'Mean temperature of the driest quarter', bio10: 'Mean temperature of the warmest quarter',
    bio11: 'Mean temperature of the coldest quarter', bio12: 'Annual precipitation', bio13: 'Precipitation of the wettest month',
    bio14: 'Precipitation of the driest month', bio15: 'Precipitation seasonality (CV)', bio16: 'Precipitation of the wettest quarter',
    bio17: 'Precipitation of the driest quarter', bio18: 'Precipitation of the warmest quarter', bio19: 'Precipitation of the coldest quarter'};
  MAS.BIO_KEYS = Object.keys(MAS.BIO_NAMES);
  MAS.SDM_BASE = [1961, 1990];
  MAS.SDM_RECENT = [1995, 2014];
  MAS.DISP_NAMES = {N: 'no dispersal', L: 'limited dispersal', F: 'full dispersal'};
  MAS.EVAL_H = ['Technique', 'Evaluation', 'AUC', 'AUC sd', 'TSS', 'TSS sd', 'max TSS', 'Boyce', 'Folds / models', 'Omission', 'p (Pearson)', 'Threshold', 'Value'];
};

function sdmDefaults(R) {
  var mx = MAS.maxInterpointKm(MAS.uniqueCoords(R.recs));
  return {vars: {bio01: true, bio04: true, bio12: true, bio15: true}, thinKm: Math.max(1, R.cfg.aooKm), bufKm: 200, bgMode: 'ECO',
    bgN: 10000, k: 5, cv: 'AUTO', blockKm: Math.round(Math.max(5, Math.min(100, (isFinite(mx) ? mx : 50) / 3))), thr: 'AUTO', mx: true, rf: true, rfM: 10,
    gcms: {'ACCESS-CM2': true, 'MPI-ESM1-2-HR': true}, ssp245: true, ssp585: true, target: NaN, disp: 'LIMITED', dispEv: NaN, afr: NaN, landMask: true};
}
function SC(R) { if (!R.SDMcfg) R.SDMcfg = sdmDefaults(R); return R.SDMcfg; }
function sdmTarget(R) { var c = SC(R); return isFinite(c.target) ? c.target : Math.min(2090, MAS.THIS_YEAR + MAS.windowYears(R)); }
// ---- bioclimatic variables from 12 monthly images (tmax, tmin in °C, prec in mm), WorldClim definitions
function bioFromMonthly(tmx, tmn, pr) {
  var tav = [], i;
  for (i = 0; i < 12; i++) tav.push(tmx[i].add(tmn[i]).divide(2));
  var T = ee.ImageCollection(tav), TX = ee.ImageCollection(tmx), TN = ee.ImageCollection(tmn), P = ee.ImageCollection(pr);
  var dr = ee.ImageCollection(tmx.map(function (x, k) { return x.subtract(tmn[k]); })).mean();
  var b5 = TX.max(), b6 = TN.min(), b7 = b5.subtract(b6);
  var q = [];
  for (i = 0; i < 12; i++) {
    var tq = tav[i].add(tav[(i + 1) % 12]).add(tav[(i + 2) % 12]).divide(3), pq = pr[i].add(pr[(i + 1) % 12]).add(pr[(i + 2) % 12]);
    q.push(tq.rename('tq').addBands(pq.rename('pq')).addBands(tq.multiply(-1).rename('ntq')).addBands(pq.multiply(-1).rename('npq')));
  }
  var Q = ee.ImageCollection(q);
  var pm = P.mean();
  return ee.Image.cat([T.mean().rename('bio01'), dr.rename('bio02'), dr.divide(b7.max(0.1)).multiply(100).rename('bio03'),
    T.reduce(ee.Reducer.stdDev()).multiply(100).rename('bio04'), b5.rename('bio05'), b6.rename('bio06'), b7.rename('bio07'),
    Q.qualityMosaic('pq').select('tq').rename('bio08'), Q.qualityMosaic('npq').select('tq').rename('bio09'),
    Q.select('tq').max().rename('bio10'), Q.select('tq').min().rename('bio11'), P.sum().rename('bio12'), P.max().rename('bio13'),
    P.min().rename('bio14'), P.reduce(ee.Reducer.stdDev()).divide(pm.add(1)).multiply(100).rename('bio15'),
    Q.select('pq').max().rename('bio16'), Q.select('pq').min().rename('bio17'),
    Q.qualityMosaic('tq').select('pq').rename('bio18'), Q.qualityMosaic('ntq').select('pq').rename('bio19')]).toFloat();
}
function wcMonth(m) { return ee.Image(ee.ImageCollection(MAS.WC_MONTHLY).filter(ee.Filter.eq('month', m)).first()); }
function bioBaseline() {
  var tx = [], tn = [], pr = [];
  for (var m = 1; m <= 12; m++) { var w = wcMonth(m); tx.push(w.select('tmax').multiply(0.1)); tn.push(w.select('tmin').multiply(0.1)); pr.push(w.select('prec').toFloat()); }
  return {tx: tx, tn: tn, pr: pr, bio: bioFromMonthly(tx, tn, pr)};
}
// GDDP monthly means (subsample: days 1 and 15, every other year), one model and scenario
function gddpMonthly(model, scenario, y0, y1) {
  var days = ee.Filter.or(ee.Filter.calendarRange(1, 1, 'day_of_month'), ee.Filter.calendarRange(15, 15, 'day_of_month'));
  var yrs = []; for (var y = y0; y <= y1; y += 2) yrs.push(y);
  var c = ee.ImageCollection(MAS.CMIP_ID).filter(ee.Filter.eq('model', model)).filter(ee.Filter.eq('scenario', scenario))
    .filter(ee.Filter.inList('year', yrs)).filter(days).select(['tasmax', 'tasmin', 'pr'])
    .map(function (i) { return i.resample('bilinear'); });   // smooth the 0.25° grid before averaging
  var out = [];
  for (var m = 1; m <= 12; m++) out.push(c.filter(ee.Filter.eq('month', m)).mean());
  return out;
}
// delta method: WorldClim + (GCM period - GCM 1961-1990); precipitation multiplied by the ratio (bounded 0.1-10)
function bioProjected(B, model, scenario, y0, y1) {
  var h = gddpMonthly(model, 'historical', MAS.SDM_BASE[0], MAS.SDM_BASE[1]), f = gddpMonthly(model, scenario, y0, y1);
  var tx = [], tn = [], pr = [];
  for (var m = 0; m < 12; m++) {
    tx.push(B.tx[m].add(f[m].select('tasmax').subtract(h[m].select('tasmax'))));
    tn.push(B.tn[m].add(f[m].select('tasmin').subtract(h[m].select('tasmin'))));
    pr.push(B.pr[m].multiply(f[m].select('pr').divide(h[m].select('pr').max(1e-7)).clamp(0.1, 10)));
  }
  return bioFromMonthly(tx, tn, pr);
}
// ---- data preparation (client): thinning, spatial blocks
function thinPoints(co, km) {
  var keep = [];
  co.forEach(function (p) { if (keep.every(function (q) { return MAS.gcDistKm(p, q) >= km; })) keep.push(p); });
  return keep;
}
function foldOf(lon, lat, blockDeg, k) {
  var bx = Math.floor(lon / blockDeg), by = Math.floor(lat / blockDeg);
  return (((bx * 7 + by * 13) % k) + k) % k;
}
function aucOf(obs, pred) {
  var pos = [], neg = [];
  for (var i = 0; i < obs.length; i++) { if (!isFinite(pred[i])) continue; if (obs[i] === 1) pos.push(pred[i]); else neg.push(pred[i]); }
  if (!pos.length || !neg.length) return NaN;
  var all = pos.map(function (v) { return [v, 1]; }).concat(neg.map(function (v) { return [v, 0]; })).sort(function (a, b) { return a[0] - b[0]; });
  var rank = 0, sumPos = 0, i2 = 0;
  while (i2 < all.length) {
    var j = i2; while (j + 1 < all.length && all[j + 1][0] === all[i2][0]) j++;
    var r = (i2 + j) / 2 + 1;
    for (var k2 = i2; k2 <= j; k2++) if (all[k2][1] === 1) sumPos += r;
    i2 = j + 1;
  }
  rank = sumPos - pos.length * (pos.length + 1) / 2;
  return rank / (pos.length * neg.length);
}
function quantile(a, q) { var s = a.filter(isFinite).slice().sort(function (x, y) { return x - y; }); if (!s.length) return NaN; var i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
function corr(x, y) {
  var n = Math.min(x.length, y.length), mx = 0, my = 0, i; if (n < 3) return NaN;
  for (i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n;
  var sxy = 0, sxx = 0, syy = 0;
  for (i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); syy += (y[i] - my) * (y[i] - my); }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}
// ---- models: Maxent; Random Forest down-sampled to balance presences and background (Valavi et al. 2021, 2022):
//      M forests, each fitted to all presences + an equal number of random background points (Barbet-Massin et al. 2012), averaged
function sdmFit(t, fc, vars, seed, M) {
  var tr = function (cl, f) { return cl.train({features: f, classProperty: 'presence', inputProperties: vars}); };
  if (t === 'MX') return [tr(ee.Classifier.amnhMaxent({outputFormat: 'cloglog', autoFeature: true, betaMultiplier: 1, doClamp: true, writeClampGrid: false, seed: seed}), fc)];
  var P = fc.filter(ee.Filter.eq('presence', 1)), B = fc.filter(ee.Filter.eq('presence', 0)), out = [];
  for (var i = 0; i < M; i++) out.push(tr(ee.Classifier.smileRandomForest({numberOfTrees: 100, seed: seed * 31 + i}).setOutputMode('PROBABILITY'),
    P.merge(B.randomColumn('rr', seed * 31 + i).sort('rr').limit(P.size()))));
  return out;
}
function sdmPred(ms, fc) {
  ms.forEach(function (cl, i) { var q = 'q' + i; fc = fc.classify(cl, q).map(function (f) { return f.set(q, ee.Algorithms.If(f.propertyNames().contains('probability'), f.get('probability'), f.get(q))); }); });
  return fc.map(function (f) { return f.set('pred', ee.List(ms.map(function (x, i) { return f.get('q' + i); })).reduce(ee.Reducer.mean())); });
}
function suitImage(cl, img) {
  var o = img.classify(cl);
  return ee.Image(ee.Algorithms.If(o.bandNames().contains('probability'), o.select('probability'), o.select(0))).rename('s');
}
function sdmImg(ms, img) { return ee.ImageCollection(ms.map(function (cl) { return suitImage(cl, img); })).mean().rename('s'); }
function predArr(ms, fc) { return sdmPred(ms, fc).aggregate_array('pred'); }
// ---- evaluation (client): TSS (Allouche et al. 2006), threshold of max sensitivity + specificity (Liu et al. 2013),
//      continuous Boyce index (Hirzel et al. 2006), jackknife test for few records (Pearson et al. 2007)
function minOf(a) { return a.reduce(function (m, v) { return v < m ? v : m; }, Infinity); }
function maxOf(a) { return a.reduce(function (m, v) { return v > m ? v : m; }, -Infinity); }
function sdOf(a) { var m = MAS.meanOf(a); return a.length > 1 ? Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)) : NaN; }
function fracGE(a, t) { return a.length ? a.filter(function (v) { return v >= t; }).length / a.length : NaN; }
function tssAt(pos, neg, t) { return fracGE(pos, t) - fracGE(neg, t); }
// sorted arrays + binary search keep the evaluation fast in the browser (thousands of background predictions)
function sortAsc(a) { return a.slice().sort(function (x, y) { return x - y; }); }
function firstGE(s, t) { var lo = 0, hi = s.length; while (lo < hi) { var m = (lo + hi) >> 1; if (s[m] >= t) hi = m; else lo = m + 1; } return lo; }
function firstGT(s, t) { var lo = 0, hi = s.length; while (lo < hi) { var m = (lo + hi) >> 1; if (s[m] > t) hi = m; else lo = m + 1; } return lo; }
function bestTss(pos, neg) {
  var sp = sortAsc(pos), sn = sortAsc(neg), b = {thr: NaN, tss: NaN};
  MAS.uniq(sp).forEach(function (t) { var s = (sp.length - firstGE(sp, t)) / sp.length - (sn.length - firstGE(sn, t)) / sn.length; if (!(s <= b.tss)) b = {thr: t, tss: s}; });
  return b;
}
function ranks(a) {
  var o = a.map(function (v, i) { return [v, i]; }).sort(function (p, q) { return p[0] - q[0]; }), r = [];
  for (var i = 0; i < o.length;) { var j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (var k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
function boyce(pos, neg) {   // ecospat defaults: window = 1/10 of the range, 101 positions, repeated P/E ratios removed
  var lo = Math.min(minOf(pos), minOf(neg)), hi = Math.max(maxOf(pos), maxOf(neg)), w = (hi - lo) / 10, x = [], y = [];
  if (!(w > 0) || pos.length < 2 || !neg.length) return NaN;
  var sp = sortAsc(pos), sn = sortAsc(neg);
  for (var i = 0; i <= 100; i++) {
    var a = lo + (hi - lo - w) * i / 100, b = a + w;
    var e = (firstGT(sn, b) - firstGE(sn, a)) / sn.length, r = e > 0 ? (firstGT(sp, b) - firstGE(sp, a)) / sp.length / e : NaN;
    if (isFinite(r) && r !== y[y.length - 1]) { x.push(a + w / 2); y.push(r); }
  }
  return x.length > 2 ? corr(ranks(x), ranks(y)) : NaN;
}
function thrMode(c, n) { return c.thr === 'AUTO' ? (n < 25 ? 'LPT' : 'MSS') : c.thr; }
function thrOf(mode, pres, bg) { return mode === 'LPT' ? minOf(pres) : mode === 'P10' ? quantile(pres, 0.1) : bestTss(pres, bg).thr; }
function pbTail(ps, s) {   // P(X >= s), X = number of successes of independent trials with probabilities ps (Pearson et al. 2007)
  var d = [1];
  ps.forEach(function (p) { var n = d.map(function (v) { return v * (1 - p); }); n.push(0); d.forEach(function (v, i) { n[i + 1] += v * p; }); d = n; });
  return d.slice(s).reduce(function (a, b) { return a + b; }, 0);
}
function cvMode(c, n) { return c.cv === 'AUTO' ? (n < 25 ? 'JK' : 'BLOCK') : c.cv; }
// spatial blocks; blocks with presences go to the fold with the fewest presences so far (balanced folds, as in blockCV)
function blockFolds(co, km, k) {
  var deg = km / 111.32, ids = co.map(function (p) { return Math.floor(p[0] / deg) + '_' + Math.floor(p[1] / deg); }), cnt = {}, map = {}, load = [], i;
  ids.forEach(function (b) { cnt[b] = (cnt[b] || 0) + 1; });
  var u = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); }), kk = Math.min(k, u.length);
  for (i = 0; i < kk; i++) load.push(0);
  u.forEach(function (b) { var f = load.indexOf(minOf(load)); map[b] = f; load[f] += cnt[b]; });
  return {deg: deg, k: kk, nBlocks: u.length, map: map, folds: ids.map(function (b) { return map[b]; })};
}
function dispKmOf(R, c) {   // Guidelines 12.1.12.4 (iii): dispersal distance x (projection period / age at first reproduction)
  var cyc = isFinite(c.afr) && c.afr > 0 ? c.afr : MAS.genLength(R).gl, yrs = sdmTarget(R) - MAS.THIS_YEAR;
  return isFinite(c.dispEv) && c.dispEv > 0 && cyc > 0 ? Math.round(c.dispEv * Math.max(1, yrs / cyc) * 10) / 10 : NaN;
}
// ---- run: one request per piece (counts and correlations; evaluation and full model per technique), then projections
function runSdm(R, out) {
  var c = SC(R), vars = MAS.BIO_KEYS.filter(function (k) { return c.vars[k]; });
  var techs = [].concat(c.mx ? ['MX'] : []).concat(c.rf ? ['RF'] : []);
  var gcms = MAS.CMIP_MODELS.filter(function (m) { return c.gcms[m]; }), ssps = [].concat(c.ssp245 ? ['ssp245'] : []).concat(c.ssp585 ? ['ssp585'] : []);
  var msg = function (t, e) { out.clear(); out.add(ui.Label(t, {fontSize: '12px', color: e ? '#b30000' : '#1f5f3a', whiteSpace: 'pre-wrap'})); };
  if (vars.length < 2) { msg('Choose at least two climatic variables.', true); return; }
  if (!techs.length) { msg('Choose at least one modelling technique (the Guidelines ask for two).', true); return; }
  if (!gcms.length || !ssps.length) { msg('Choose at least one GCM and one scenario (the Guidelines ask for two of each).', true); return; }
  var co = thinPoints(MAS.uniqueCoords(R.recs), c.thinKm);
  if (co.length < 5) { msg('Only ' + co.length + ' records after thinning at ' + c.thinKm + ' km: too few for a bioclimate model.', true); return; }
  var target = sdmTarget(R), fy0 = Math.max(2015, target - 10), fy1 = Math.min(2100, target + 9), M = Math.max(1, Math.round(c.rfM || 10));
  var ev = cvMode(c, co.length), bf = blockFolds(co, c.blockKm, Math.max(2, Math.round(c.k))), k = bf.k, randomFolds = ev === 'BLOCK' && k < 2;
  if (randomFolds) k = Math.max(2, Math.round(c.k));
  var presFolds = ev === 'JK' ? co.map(function () { return -1; }) : randomFolds ? co.map(function (p, i) { return i % k; }) : bf.folds;
  var dk = dispKmOf(R, c), dm = c.disp === 'FULL' ? 'F' : c.disp === 'LIMITED' && isFinite(dk) ? 'L' : 'N';
  var S = R.SDM = {done: false, running: true, vars: vars, techs: techs, gcms: gcms, ssps: ssps, nPres: co.length, nRecs: R.recs.length, ev: ev, M: M,
    target: target, fut: [fy0, fy1], blockKm: c.blockKm, k: ev === 'JK' ? co.length : k, nBlocks: bf.nBlocks, randomFolds: randomFolds, dispKm: dk, dm: dm,
    dispFallback: c.disp === 'LIMITED' && dm === 'N', cfg: JSON.parse(JSON.stringify(c)), started: Date.now()};
  var B = bioBaseline(), base = B.bio.select(vars);
  var presFC = ee.FeatureCollection(co.map(function (p, i) { return ee.Feature(ee.Geometry.Point(p), {presence: 1, fold: presFolds[i], jk: i}); }));
  var mp = ee.Geometry.MultiPoint(co), buf = mp.buffer(c.bufKm * 1000, 1000);
  var ecoMask = c.bgMode === 'ECO' ? ee.Image(0).paint(ee.FeatureCollection(MAS.ECO_ID).filterBounds(mp), 1).selfMask() : ee.Image(1);
  var rnd = ee.FeatureCollection.randomPoints({region: buf, points: Math.round(c.bgN * 1.3), seed: 11, maxError: 1000});
  var bgFC = base.updateMask(ecoMask).sampleRegions({collection: rnd, scale: 1000, geometries: true}).limit(c.bgN), bd = ee.Number(bf.deg), fmap = ee.Dictionary(bf.map);
  if (ev === 'JK' || randomFolds) bgFC = bgFC.randomColumn('r', 5).map(function (f) { return f.set({presence: 0, jk: -1, fold: ee.Number(f.get('r')).multiply(k).floor().min(k - 1)}); });
  else bgFC = bgFC.map(function (f) {   // background in a block with presences takes that block's fold; other blocks by a fixed hash
    var xy = f.geometry().coordinates(), bx = ee.Number(xy.get(0)).divide(bd).floor(), by = ee.Number(xy.get(1)).divide(bd).floor();
    return f.set({presence: 0, jk: -1, fold: fmap.get(bx.int().format('%d').cat('_').cat(by.int().format('%d')), bx.multiply(7).add(by.multiply(13)).mod(k).add(k).mod(k))});
  });
  var presS = base.sampleRegions({collection: presFC, scale: 1000, geometries: true}), train = presS.merge(bgFC);
  var isP = ee.Filter.eq('presence', 1), isB = ee.Filter.eq('presence', 0), bgCor = bgFC.limit(1000);
  S.models = {};
  var jobs = [{key: 'data', make: function () {
    var d = {iucnKind: 'sdmcv', part: 'data', nP: presS.size(), nB: bgFC.size(), area: buf.area(1000).divide(1e6)};
    vars.forEach(function (v) { d['cor_' + v] = bgCor.aggregate_array(v); d['pv_' + v] = presS.aggregate_array(v); });
    return ee.Dictionary(d);
  }}];
  techs.forEach(function (t) {
    jobs.push({key: t + '|eval', t: t, make: function () {
      var d = {iucnKind: 'sdmcv', part: 'eval', t: t, ev: ev}, i;
      if (ev === 'JK') for (i = 0; i < co.length; i++) {
        var ms = sdmFit(t, train.filter(ee.Filter.neq('jk', i)), vars, i + 1, M);
        d['x' + i] = predArr(ms, presS.filter(ee.Filter.eq('jk', i))); d['t' + i] = predArr(ms, presS.filter(ee.Filter.neq('jk', i))); d['b' + i] = predArr(ms, bgFC.limit(500));
      } else for (i = 0; i < k; i++) {
        var tr = train.filter(ee.Filter.neq('fold', i)), te = train.filter(ee.Filter.eq('fold', i)), m2 = sdmFit(t, tr, vars, i + 1, M);
        d['tp' + i] = predArr(m2, tr.filter(isP)); d['tb' + i] = predArr(m2, tr.filter(isB).limit(2000));
        d['ep' + i] = predArr(m2, te.filter(isP)); d['eb' + i] = predArr(m2, te.filter(isB).limit(3000));
      }
      return ee.Dictionary(d);
    }});
    jobs.push({key: t + '|full', t: t, make: function () {
      var ms = S.models[t] = sdmFit(t, train, vars, 99, M), d = {iucnKind: 'sdmcv', part: 'full', t: t, pres: predArr(ms, presS), bg: predArr(ms, bgFC.limit(3000))};
      if (t === 'RF') d.imp = ee.List(ms.map(function (cl) { return ee.Dictionary(cl.explain()).get('importance'); }));
      return ee.Dictionary(d);
    }});
  });
  msg('Bioclimate model: ' + (ev === 'JK' ? 'jackknife (n-1) test, ' + co.length + ' models per technique (< 25 presences; Pearson et al. 2007)' :
    k + '-fold cross-validation' + (randomFolds ? ' (random folds: the records fall in one spatial block)' : ' with ' + c.blockKm + ' km spatial blocks')) + '...');
  var res = {};
  MAS.runJobs(R, jobs, function (job, r) { res[job.key] = r; if (R.SDM === S) msg('Evaluation: ' + Object.keys(res).length + ' of ' + jobs.length + ' steps (' + job.key + ')...'); }, function (failed) {
    if (MAS.stale(R) || R.SDM !== S) return;
    var dt = res.data;
    if (!dt || failed.length) { S.running = false; msg('Model evaluation failed: ' + failed.join('; ') + '\nTry fewer background points, a smaller buffer, fewer variables or forests' + (ev === 'JK' ? ', or Evaluation: spatial blocks' : '') + '.', true); return; }
    S.nP = dt.nP; S.nB = dt.nB; S.areaKm2 = dt.area; S.cv = {}; S.thr = {}; S.presPred = {}; S.rfImp = null;
    techs.forEach(function (t) {
      var E = res[t + '|eval'], F = res[t + '|full'], fin = function (a) { return (a || []).filter(isFinite); }, i, mode = thrMode(c, co.length);
      var pp = fin(F.pres), bb = fin(F.bg);
      S.thr[t] = {mode: mode, value: thrOf(mode, pp, bb)}; S.presPred[t] = pp;
      var C = S.cv[t] = {ev: ev, aucs: [], tss: [], mtss: [], cbi: []};
      if (ev === 'JK') {
        var hit = 0, ps = [], spec = [];
        for (i = 0; i < co.length; i++) {
          var x = fin(E['x' + i]), tp = fin(E['t' + i]), b = fin(E['b' + i]);
          if (!x.length || !b.length) continue;
          var th = thrOf(mode, tp, b), f = fracGE(b, th);
          if (x[0] >= th) hit++;
          ps.push(f); spec.push(1 - f); C.aucs.push(aucOf([1].concat(b.map(function () { return 0; })), [x[0]].concat(b)));
        }
        C.n = ps.length; C.omission = ps.length ? 1 - hit / ps.length : NaN; C.p = ps.length ? pbTail(ps, hit) : NaN;
        C.tss = [1 - C.omission + MAS.meanOf(spec) - 1];
      } else for (i = 0; i < k; i++) {
        var ep = fin(E['ep' + i]), eb = fin(E['eb' + i]);
        if (!ep.length || !eb.length) continue;
        C.aucs.push(aucOf(ep.map(function () { return 1; }).concat(eb.map(function () { return 0; })), ep.concat(eb)));
        C.tss.push(tssAt(ep, eb, thrOf(mode, fin(E['tp' + i]), fin(E['tb' + i])))); C.mtss.push(bestTss(ep, eb).tss); C.cbi.push(boyce(ep, eb));
      }
      C.mean = MAS.meanOf(C.aucs); C.sd = sdOf(C.aucs); C.tssMean = MAS.meanOf(C.tss); C.tssSd = sdOf(C.tss); C.mtssMean = MAS.meanOf(C.mtss); C.cbiMean = MAS.meanOf(C.cbi.filter(isFinite));
      if (ev !== 'JK') C.n = C.aucs.length;
      if (t === 'RF' && F.imp && F.imp.length) { S.rfImp = {}; vars.forEach(function (v) { S.rfImp[v] = MAS.meanOf(F.imp.map(function (o) { return o ? o[v] : NaN; })); }); }
    });
    S.cor = [];
    for (var i = 0; i < vars.length; i++) for (var j = i + 1; j < vars.length; j++) {
      var r = corr(dt['cor_' + vars[i]] || [], dt['cor_' + vars[j]] || []);
      if (Math.abs(r) >= 0.7) S.cor.push([vars[i], vars[j], MAS.round(r, 2)]);
    }
    S.presVals = {}; vars.forEach(function (v) { S.presVals[v] = dt['pv_' + v] || []; });
    msg('Evaluation done (' + techs.map(function (t) { return t + ' AUC ' + MAS.fmt(S.cv[t].mean, 2) + ', TSS ' + MAS.fmt(S.cv[t].tssMean, 2); }).join('; ') + '). Projecting ' +
      gcms.length + ' GCM(s) x ' + ssps.length + ' scenario(s) to ' + fy0 + '-' + fy1 + '...');
    sdmProject(R, S, B, buf, ecoMask, msg, out);
  });
}
function sdmProject(R, S, B, buf, ecoMask, msg, out) {
  var c = S.cfg, vars = S.vars, scale = MAS.autoScale(S.areaKm2, 3e6, 1000), dms = ['N', 'F'].concat(isFinite(S.dispKm) ? ['L'] : []);
  S.scale = scale; S.dms = dms;
  var land = ee.Image(1);
  if (c.landMask) {
    var codes = MAS.suitList(R), s = MAS.lulcImage(R, R.year).remap(codes, codes.map(function () { return 1; }), 0).unmask(0);
    land = s.setDefaultProjection(ee.Projection('EPSG:4326').atScale(30)).reduceResolution({reducer: ee.Reducer.mean(), maxPixels: 4096, bestEffort: true})
      .reproject(ee.Projection('EPSG:4326').atScale(scale)).unmask(0);
  }
  var px = ee.Image.pixelArea().divide(1e6);
  var projs = [{key: 'base', label: 'Baseline (WorldClim 1960-1990)'}];
  S.gcms.forEach(function (g) {
    projs.push({key: g + '|recent', gcm: g, ssp: 'historical', y: MAS.SDM_RECENT, label: g + ' 1995-2014'});
    S.ssps.forEach(function (p) { projs.push({key: g + '|' + p, gcm: g, ssp: p, y: S.fut, label: g + ' ' + p.toUpperCase() + ' ' + S.fut[0] + '-' + S.fut[1]}); });
  });
  S.projs = projs; S.maps = {};
  S.techs.forEach(function (t) {
    var thr = isFinite(S.thr[t].value) ? S.thr[t].value : 0.5;
    S.maps[t] = {ms: S.models[t], thr: thr, cur: sdmImg(S.models[t], B.bio.select(vars)).updateMask(ecoMask)};
  });
  var jobs = projs.map(function (p) {
    return {key: p.key, make: function (ts) {
      var img = p.key === 'base' ? B.bio.select(vars) : bioProjected(B, p.gcm, p.ssp, p.y[0], p.y[1]).select(vars), bands = [];
      S.techs.forEach(function (t) {
        var m = S.maps[t], su = sdmImg(m.ms, img).updateMask(ecoMask).multiply(land), now = m.cur.gte(m.thr).unmask(0), keep = {F: ee.Image(1)};
        keep.N = p.key === 'base' ? keep.F : now;
        if (isFinite(S.dispKm)) keep.L = p.key === 'base' ? keep.F : now.focal_max({radius: S.dispKm * 1000, units: 'meters'});
        dms.forEach(function (d) { bands.push(su.multiply(keep[d]).rename(t + '_s' + d)); });
        bands.push(su.gte(m.thr).multiply(keep[S.dm]).multiply(px).rename(t + '_area'));
      });
      return ee.Dictionary({iucnKind: 'sdmproj', v: ee.Image.cat(bands).reduceRegion({reducer: ee.Reducer.sum(), geometry: buf, scale: scale, maxPixels: 1e13, tileScale: ts})});
    }};
  });
  var rows = {}, k = 0;
  MAS.runJobs(R, jobs, function (job, res) {
    k++;
    var p = projs.filter(function (q) { return q.key === job.key; })[0];
    S.techs.forEach(function (t) { var s = {}; dms.forEach(function (d) { s[d] = res && res.v ? res.v[t + '_s' + d] : NaN; });
      rows[t + '|' + p.key] = {t: t, p: p, s: s, sum: s[S.dm], area: res && res.v ? res.v[t + '_area'] : NaN}; });
    if (R.SDM === S) msg('Projections: ' + k + ' of ' + projs.length + ' climates (' + p.label + ')...');
  }, function (failed) {
    if (MAS.stale(R) || R.SDM !== S) return;
    S.running = false;
    if (failed.length === projs.length) { msg('Projections failed: ' + failed[0] + '\nTry fewer variables or GCMs, or a smaller buffer.', true); return; }
    S.failed = failed;
    S.rows = Object.keys(rows).map(function (id) { return rows[id]; });
    var by = {}; dms.forEach(function (d) { by[d] = []; });
    S.rows.forEach(function (r) {
      var base = rows[r.t + '|base'], rec = r.p.gcm ? rows[r.t + '|' + r.p.gcm + '|recent'] : null;
      r.redSum = base && base.sum > 0 && r.p.key !== 'base' ? 100 * (1 - r.sum / base.sum) : NaN;
      r.areaChange = base && base.area > 0 && r.p.key !== 'base' ? 100 * (r.area / base.area - 1) : NaN;
      if (r.p.ssp && r.p.ssp !== 'historical') {
        r.redFromRecent = rec && rec.sum > 0 ? 100 * (1 - r.sum / rec.sum) : NaN;
        dms.forEach(function (d) { var v = rec && rec.s[d] > 0 ? 100 * (1 - r.s[d] / rec.s[d]) : base && base.s[d] > 0 ? 100 * (1 - r.s[d] / base.s[d]) : NaN; if (isFinite(v)) by[d].push(v); });
      }
    });
    S.redsBy = by; S.reds = by[S.dm];
    S.redBest = quantile(S.reds, 0.5); S.redLo = S.reds.length ? minOf(S.reds) : NaN; S.redHi = S.reds.length ? maxOf(S.reds) : NaN;
    S.done = true; S.finished = Date.now();
    MAS.refreshRedList(R);
    renderSdmResults(R, out);
  });
}
// ---- tab
// ---- variable screening before the model (Dormann et al. 2013: |r| >= 0.7; VIF; Guidelines 12.1.12: <= 1 variable per 5 records)
function invMatrix(A) {
  var n = A.length, M = A.map(function (r, i) { return r.concat(A.map(function (x, j) { return i === j ? 1 : 0; })); }), i, j, k;
  for (i = 0; i < n; i++) {
    var piv = i;
    for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    if (Math.abs(M[piv][i]) < 1e-12) return null;
    var tmp = M[i]; M[i] = M[piv]; M[piv] = tmp;
    var d = M[i][i];
    for (j = 0; j < 2 * n; j++) M[i][j] /= d;
    for (k = 0; k < n; k++) if (k !== i) { var f = M[k][i]; for (j = 0; j < 2 * n; j++) M[k][j] -= f * M[i][j]; }
  }
  return M.map(function (r) { return r.slice(n); });
}
function vifOf(V, set) {   // VIF_j = j-th diagonal element of the inverse correlation matrix
  if (set.length < 2) return set.map(function () { return 1; });
  var inv = invMatrix(set.map(function (a) { return set.map(function (b) { return a === b ? 1 : V.cor[a][b]; }); }));
  return set.map(function (a, i) { return inv ? inv[i][i] : Infinity; });
}
function varCap(R, c, nP) { return Math.max(2, Math.floor(nP / 5)); }
   // Guidelines 12.1.12.2: <= 1 variable per 5 records (not binding for Maxent)
// practical range of the empirical semivariogram: first lag where it reaches 95% of the sample variance (Valavi et al. 2019 use the
// median range of the covariates as the block size); pairs are binned once and reused for every variable
var VG_N = 300;   // background points used for the semivariograms (300 points = 44,850 pairs)
function vgPairs(xy) {   // pairs and their distance bins, kept in typed arrays (light on the browser)
  var n = xy.length, cl = Math.cos(MAS.meanOf(xy.map(function (p) { return p[1]; })) * Math.PI / 180), np = n * (n - 1) / 2;
  var I = new Int32Array(np), J = new Int32Array(np), D = new Float64Array(np), mx = 0, i, j, q = 0;
  for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
    var dx = (xy[i][0] - xy[j][0]) * 111.32 * cl, dy = (xy[i][1] - xy[j][1]) * 110.57, h = Math.sqrt(dx * dx + dy * dy);
    I[q] = i; J[q] = j; D[q] = h; q++; if (h > mx) mx = h;
  }
  var lag = mx / 2 / 15, B = new Uint8Array(np);
  for (q = 0; q < np; q++) B[q] = lag > 0 ? Math.min(15, Math.floor(D[q] / lag)) : 15;
  return {I: I, J: J, B: B, n: np, lag: lag};
}
function vgRange(G, z) {
  var m = MAS.meanOf(z), s2 = z.reduce(function (a, v) { return a + (v - m) * (v - m); }, 0) / (z.length - 1), sum = [], n = [], b, q;
  if (!(s2 > 0) || !(G.lag > 0)) return NaN;
  for (b = 0; b < 15; b++) { sum.push(0); n.push(0); }
  for (q = 0; q < G.n; q++) { b = G.B[q]; if (b < 15) { var d = z[G.I[q]] - z[G.J[q]]; sum[b] += d * d / 2; n[b]++; } }
  for (b = 0; b < 15; b++) if (n[b] && sum[b] / n[b] >= 0.95 * s2) return (b + 0.5) * G.lag;
  return 15 * G.lag;
}
// runs fn over the items one per browser turn, so the page stays responsive during long client-side work
function stepsLater(R, items, fn, done) {
  var i = 0;
  (function next() {
    if (MAS.stale(R)) return;
    if (i >= items.length) { done(); return; }
    fn(items[i], i); i++;
    ui.util.setTimeout(next, 0);
  })();
}
function suggestBlock(R, V, set) {
  var c = SC(R), co = thinPoints(MAS.uniqueCoords(R.recs), c.thinKm), km = quantile(set.map(function (k) { return V.range[k]; }), 0.5), k = Math.max(2, Math.round(c.k));
  if (!isFinite(km)) return NaN;
  while (km > 5 && blockFolds(co, km, k).nBlocks < k) km *= 0.8;   // keep at least k blocks with presences
  return Math.max(5, Math.round(km));
}
function screenVars(R, out, done) {
  var c = SC(R), co = thinPoints(MAS.uniqueCoords(R.recs), c.thinKm);
  out.clear();
  if (co.length < 5) { out.add(ui.Label('Only ' + co.length + ' records after thinning: too few for a bioclimate model.', {color: '#b30000', fontSize: '12px'})); return; }
  out.add(ui.Label('Sampling the 19 variables at ' + co.length + ' presences and ' + Math.min(c.bgN, 2000) + ' background points...', MAS.S.small));
  var B = bioBaseline(), mp = ee.Geometry.MultiPoint(co), buf = mp.buffer(c.bufKm * 1000, 1000);
  var eco = c.bgMode === 'ECO' ? ee.Image(0).paint(ee.FeatureCollection(MAS.ECO_ID).filterBounds(mp), 1).selfMask() : ee.Image(1);
  var bg = B.bio.updateMask(eco).sampleRegions({collection: ee.FeatureCollection.randomPoints({region: buf, points: Math.round(Math.min(c.bgN, 2000) * 1.3), seed: 11, maxError: 1000}),
    scale: 1000, geometries: true}).limit(Math.min(c.bgN, 2000)).map(function (f) { var g = f.geometry().coordinates(); return f.set({x: g.get(0), y: g.get(1)}); });
  var pr = B.bio.sampleRegions({collection: ee.FeatureCollection(co.map(function (p) { return ee.Feature(ee.Geometry.Point(p)); })), scale: 1000});
  var d = {iucnKind: 'sdmscreen', bx: bg.aggregate_array('x'), by: bg.aggregate_array('y')};
  MAS.BIO_KEYS.forEach(function (k) { d['p_' + k] = pr.aggregate_array(k); d['b_' + k] = bg.aggregate_array(k); });
  ee.Dictionary(d).evaluate(function (res, err) {
    if (MAS.stale(R)) return;
    if (err || !res) { out.clear(); out.add(ui.Label('Screening failed: ' + err, {color: '#b30000', fontSize: '12px'})); return; }
    var V = {nP: (res['p_bio01'] || []).length, nB: (res['b_bio01'] || []).length, auc: {}, cor: {}, pm: {}, bm: {}, prng: {}, brng: {}, range: {}};
    var nv = Math.min(VG_N, (res.bx || []).length), G = vgPairs((res.bx || []).slice(0, nv).map(function (x, i) { return [x, res.by[i]]; }));
    var lab = ui.Label('', MAS.S.small); out.clear(); out.add(lab);
    stepsLater(R, MAS.BIO_KEYS, function (k, i) {   // one variable per step: discrimination, correlations with the previous ones, autocorrelation range
      lab.setValue('Screening ' + k + ' (' + (i + 1) + ' of ' + MAS.BIO_KEYS.length + ')...');
      var p = (res['p_' + k] || []).filter(isFinite), b = (res['b_' + k] || []).filter(isFinite), a = aucOf(p.map(function () { return 1; }).concat(b.map(function () { return 0; })), p.concat(b));
      V.auc[k] = isFinite(a) ? Math.max(a, 1 - a) : NaN;   // direction-free discrimination of presences from the background
      V.pm[k] = MAS.meanOf(p); V.bm[k] = MAS.meanOf(b);
      V.prng[k] = p.length ? [Math.min.apply(null, p), Math.max.apply(null, p)] : [NaN, NaN];
      V.brng[k] = b.length ? [quantile(b, 0.05), quantile(b, 0.95)] : [NaN, NaN];
      V.cor[k] = {}; V.cor[k][k] = 1;
      MAS.BIO_KEYS.slice(0, i).forEach(function (o) { var r = corr(res['b_' + k] || [], res['b_' + o] || []); V.cor[k][o] = r; V.cor[o][k] = r; });
      V.range[k] = nv > 30 ? vgRange(G, (res['b_' + k] || []).slice(0, nv)) : NaN;
    }, function () {
    var cap = varCap(R, c, co.length), order = MAS.BIO_KEYS.filter(function (k) { return isFinite(V.auc[k]); }).sort(function (a, b) { return V.auc[b] - V.auc[a]; }), sug = [];
    order.forEach(function (k) { if (sug.length < cap && sug.every(function (s) { return Math.abs(V.cor[k][s]) < 0.7; })) sug.push(k); });
    V.order = order; V.sug = sug; V.cap = cap; V.nThin = co.length;
    R.SDMscreen = V; V.block = suggestBlock(R, V, sug);
    done();
    });
  });
}
function screenPanel(R) {
  var V = R.SDMscreen, c = SC(R), p = ui.Panel();
  if (!V) return p;
  var cur = MAS.BIO_KEYS.filter(function (k) { return c.vars[k]; }), vifS = vifOf(V, V.sug), vifC = vifOf(V, cur);
  p.add(ui.Label('Screening: ' + V.nP + ' presences (thinned at ' + c.thinKm + ' km) vs ' + V.nB + ' background points. Limit: ' + V.nThin + '/5 = ' + V.cap +
    ' variables (Guidelines 12.1.12.2' + (c.rf ? '' : '; not binding for Maxent alone') + '). Suggested (highest univariate AUC, all pairs |r| < 0.7, as "select07" in Dormann et al. 2013): ' +
    V.sug.join(', ') + '. Spatial block from the autocorrelation range of these variables (Valavi et al. 2019): ' + MAS.fmt(V.block, 0) + ' km.', {fontSize: '12px', fontWeight: 'bold', whiteSpace: 'pre-wrap'}));
  p.add(MAS.tableChart([['Variable', 'string'], ['Definition', 'string'], ['Univariate AUC', 'number'], ['Presences min-max', 'string'], ['Background 5-95%', 'string'],
    ['Strongest |r| with a better-ranked variable', 'string'], ['Autocorrelation range (km)', 'number'], ['Suggested', 'string'], ['Selected now', 'string']],
    V.order.map(function (k, i) {
      var best = null;
      V.order.slice(0, i).forEach(function (o) { if (!best || Math.abs(V.cor[k][o]) > Math.abs(V.cor[k][best])) best = o; });
      return [k, MAS.BIO_NAMES[k], MAS.round(V.auc[k], 3), MAS.fmt(V.prng[k][0], 1) + ' - ' + MAS.fmt(V.prng[k][1], 1), MAS.fmt(V.brng[k][0], 1) + ' - ' + MAS.fmt(V.brng[k][1], 1),
        best ? best + ' ' + MAS.fmt(V.cor[k][best], 2) : '-', isFinite(V.range[k]) ? Math.round(V.range[k]) : null, V.sug.indexOf(k) >= 0 ? 'yes (VIF ' + MAS.fmt(vifS[V.sug.indexOf(k)], 1) + ')' : '', c.vars[k] ? 'yes' : ''];
    })));
  if (cur.length > 1) {
    var bad = [];
    cur.forEach(function (a, i) { cur.slice(i + 1).forEach(function (b) { if (Math.abs(V.cor[a][b]) >= 0.7) bad.push(a + '-' + b + ' r=' + MAS.fmt(V.cor[a][b], 2)); }); });
    p.add(ui.Label('Selected now (' + cur.join(', ') + '): ' + (bad.length ? 'correlated pairs ' + bad.join('; ') : 'no pair with |r| ≥ 0.7') + '; VIF ' +
      cur.map(function (k, i) { return k + ' ' + MAS.fmt(vifC[i], 1); }).join(', ') + (vifC.some(function (v) { return v > 10; }) ? ' (VIF > 10: severe collinearity, Dormann et al. 2013)' : vifC.some(function (v) { return v > 5; }) ? ' (VIF > 5: moderate collinearity)' : '') +
      (cur.length > V.cap ? '; more variables than the limit (' + V.cap + ')' : '') + '.', {fontSize: '12px', color: bad.length || cur.length > V.cap ? '#b30000' : '#1f6b2f', whiteSpace: 'pre-wrap'}));
    p.add(MAS.tableChart([['r', 'string']].concat(cur.map(function (k) { return [k, 'number']; })), cur.map(function (a) { return [a].concat(cur.map(function (b) { return MAS.round(V.cor[a][b], 2); })); })));
  }
  p.add(ui.Button({label: 'Use the suggested set (' + V.sug.join(', ') + ') and block size (' + MAS.fmt(V.block, 0) + ' km)', onClick: function () {
    MAS.BIO_KEYS.forEach(function (k) { c.vars[k] = V.sug.indexOf(k) >= 0; });
    if (isFinite(V.block)) c.blockKm = V.block;
    MAS.uiLater(function () { renderSdmTab(R); });
  }}));
  p.add(ui.Label('Univariate AUC measures how well one variable alone separates the presences from the background (0.5 = no separation); it depends on ' +
    'the background extent. Correlation is measured at the background points (the study area). The suggestion is statistical only: the IUCN Guidelines ' +
    '(12.1.12) ask for variables with a plausible direct effect on the species - swap a suggested variable for a correlated one that makes more biological sense. ' +
    'Autocorrelation range: distance at which the empirical semivariogram of the variable at the background points reaches 95% of its variance; the block size is their median, ' +
    'reduced if needed to keep at least as many blocks with presences as folds.',
    {fontSize: '11px', color: '#555', whiteSpace: 'pre-wrap'}));
  return p;
}
function renderSdmTab(R) {
  var T = 'Bioclimate model', c = SC(R);
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'Bioclimate model (species distribution model) - ' + R.cfg.species);
  MAS.tabNote(T, 'Follows the Red List Guidelines 12.1.12: presence-background data (thinned records, random background), variables with direct ' +
    'physiological effects, no elevation or coordinates as predictors, ≥ 2 GCMs and ≥ 2 SSPs projected one by one (never an ensemble-mean climate), ' +
    '≥ 2 modelling techniques, spatially blocked k-fold cross-validation or an n-1 jackknife for very few records (AUC, TSS, Boyce index), thresholds ' +
    '(lowest presence threshold for few records, else balancing sensitivity and specificity), land-use and dispersal exclusions, and the relative change in ' +
    'summed suitability for Criterion A3 (12.1.12.4). The settings below are defaults from the literature cited in the Word supplementary information. Current and future variables are computed the ' +
    'same way from monthly climatologies (WorldClim 1.4 + GCM changes from NASA NEX-GDDP-CMIP6, delta method). Runs only when you press the button.');
  var nRec = thinPoints(MAS.uniqueCoords(R.recs), c.thinKm).length, nVar = MAS.BIO_KEYS.filter(function (k) { return c.vars[k]; }).length;
  var varPanel = ui.Panel(null, ui.Panel.Layout.flow('horizontal', true));
  var varNote = ui.Label('', {fontSize: '12px', color: '#6a3d00', whiteSpace: 'pre-wrap'});
  function upd() {
    var n = MAS.BIO_KEYS.filter(function (k) { return c.vars[k]; }).length;
    varNote.setValue(n + ' variables; ' + nRec + ' presences after thinning -> rule of thumb ≤ 1 variable per 5 records for non-Maxent methods: ' +
      Math.max(1, Math.floor(nRec / 5)) + (n > Math.max(1, Math.floor(nRec / 5)) && c.rf ? ' (too many for Random Forest: reduce or justify)' : '') +
      '. Choose variables with a direct effect on the species and avoid pairs with |r| ≥ 0.7: press "Screen variables" to test them before the run.');
  }
  MAS.BIO_KEYS.forEach(function (k) {
    varPanel.add(ui.Checkbox({label: k, value: !!c.vars[k], style: {width: '78px', fontSize: '11px'}, onChange: function (v) { c.vars[k] = v; upd(); }}));
  });
  MAS.tabAdd(T, ui.Label('Climatic variables (hover the names in the table below)', {fontWeight: 'bold', fontSize: '13px'}));
  MAS.tabAdd(T, varPanel); MAS.tabAdd(T, varNote); upd();
  var scr = ui.Panel();
  MAS.tabAdd(T, ui.Button({label: 'Screen variables (relevance and collinearity, before the run)', onClick: function () {
    MAS.uiLater(function () { screenVars(R, scr, function () { MAS.uiLater(function () { renderSdmTab(R); }); }); });
  }}));
  scr.add(screenPanel(R));
  MAS.tabAdd(T, scr);
  MAS.tabAdd(T, MAS.tableChart([['Variable', 'string'], ['Definition (WorldClim)', 'string']], MAS.BIO_KEYS.map(function (k) { return [k, MAS.BIO_NAMES[k]]; })));
  function nb(key, ph) { return ui.Textbox({placeholder: ph, value: isFinite(c[key]) ? String(c[key]) : '', style: {width: '110px'}, onChange: function (v) { c[key] = MAS.toNum(v); }}); }
  MAS.tabAdd(T, ui.Label('Species data and background', {fontWeight: 'bold', fontSize: '13px'}));
  MAS.tabAdd(T, MAS.cardRow([ui.Label('Thinning distance (km)', MAS.S.small), nb('thinKm', 'km'), ui.Label('Background points (10,000: Barbet-Massin et al. 2012)', MAS.S.small), nb('bgN', 'n')]));
  MAS.tabAdd(T, MAS.cardRow([ui.Label('Background buffer around the records (km)', MAS.S.small), nb('bufKm', 'km'),
    ui.Select({items: [{label: 'within the ecoregions of the records', value: 'ECO'}, {label: 'whole buffer', value: 'BUFFER'}], value: c.bgMode,
      onChange: function (v) { c.bgMode = v; }})]));
  MAS.tabAdd(T, ui.Label('Model building and evaluation', {fontWeight: 'bold', fontSize: '13px'}));
  MAS.tabAdd(T, MAS.cardRow([ui.Checkbox({label: 'Maxent (cloglog, auto features)', value: c.mx, onChange: function (v) { c.mx = v; }}),
    ui.Checkbox({label: 'Random Forest, down-sampled (forests of 100 trees on equal numbers of presences and background)', value: c.rf, onChange: function (v) { c.rf = v; upd(); }}),
    ui.Label('Forests', MAS.S.small), nb('rfM', 'n')]));
  MAS.tabAdd(T, MAS.cardRow([ui.Select({items: [{label: 'Evaluation: automatic (jackknife < 25 presences, else spatial blocks)', value: 'AUTO'},
    {label: 'Spatial block cross-validation', value: 'BLOCK'}, {label: 'Jackknife (n-1)', value: 'JK'}], value: c.cv, onChange: function (v) { c.cv = v; }}),
    ui.Label('Folds', MAS.S.small), nb('k', 'k'), ui.Label('Spatial block (km)', MAS.S.small), nb('blockKm', 'km')]));
  MAS.tabAdd(T, ui.Select({items: [{label: 'Threshold: automatic (lowest presence < 25 records, else max sensitivity + specificity)', value: 'AUTO'}, {label: 'Lowest presence threshold', value: 'LPT'},
    {label: '10th percentile training presence', value: 'P10'}, {label: 'Max sensitivity + specificity (max TSS)', value: 'MSS'}], value: c.thr, onChange: function (v) { c.thr = v; }}));
  MAS.tabAdd(T, ui.Label('Climate models, scenarios and time points', {fontWeight: 'bold', fontSize: '13px'}));
  var gp = ui.Panel(null, ui.Panel.Layout.flow('horizontal', true));
  MAS.CMIP_MODELS.forEach(function (m) { gp.add(ui.Checkbox({label: m, value: !!c.gcms[m], onChange: function (v) { c.gcms[m] = v; }})); });
  MAS.tabAdd(T, gp);
  MAS.tabAdd(T, MAS.cardRow([ui.Checkbox({label: 'SSP2-4.5', value: c.ssp245, onChange: function (v) { c.ssp245 = v; }}),
    ui.Checkbox({label: 'SSP5-8.5', value: c.ssp585, onChange: function (v) { c.ssp585 = v; }}),
    ui.Label('Target year (blank = now + max(10 y, 3 generations) = ' + sdmTarget(R) + ')', MAS.S.small), nb('target', 'year')]));
  MAS.tabAdd(T, ui.Label('Exclusions', {fontWeight: 'bold', fontSize: '13px'}));
  MAS.tabAdd(T, MAS.cardRow([ui.Checkbox({label: 'Land use: weight by the AOH classes of ' + R.year, value: c.landMask, onChange: function (v) { c.landMask = v; }}),
    ui.Select({items: [{label: 'Dispersal: limited (recommended)', value: 'LIMITED'}, {label: 'Dispersal: none (future only where suitable now)', value: 'NONE'},
      {label: 'Dispersal: unlimited (within the buffer)', value: 'FULL'}], value: c.disp, onChange: function (v) { c.disp = v; }})]));
  var dl = ui.Label('', {fontSize: '12px', color: '#6a3d00', whiteSpace: 'pre-wrap'}), dup = function () { var d = dispKmOf(R, c);
    dl.setValue(isFinite(d) ? 'Dispersal distance until ' + sdmTarget(R) + ': ' + d + ' km.' : 'Enter the dispersal distance: without it the run falls back to no dispersal, which the Guidelines call overly pessimistic unless justified; both extremes are always reported.'); };
  function nd(key, ph) { return ui.Textbox({placeholder: ph, value: isFinite(c[key]) ? String(c[key]) : '', style: {width: '110px'}, onChange: function (v) { c[key] = MAS.toNum(v); dup(); }}); }
  MAS.tabAdd(T, MAS.cardRow([ui.Label('Dispersal distance per reproductive cycle (km)', MAS.S.small), nd('dispEv', 'km'), ui.Label('Age at first reproduction (years; blank = generation length)', MAS.S.small), nd('afr', 'years')]));
  MAS.tabAdd(T, dl); dup();
  MAS.tabNote(T, 'Guidelines 12.1.12.4 (iii): distance = dispersal distance x (years to the target / age at first reproduction), e.g. 4 km x 30/5 = 24 km. ' +
    '"No dispersal" and "full dispersal" are not recommended unless justified (overly pessimistic and optimistic): the results show both as a sensitivity check.');
  var out = ui.Panel();
  MAS.tabAdd(T, ui.Button({label: 'Run bioclimate model', style: {fontWeight: 'bold'}, onClick: function () { MAS.uiLater(function () { runSdm(R, out); }); }}));
  MAS.tabAdd(T, out);
  if (R.SDM && R.SDM.done) renderSdmResults(R, out);
  else if (R.SDM && R.SDM.running) out.add(ui.Label('Running...', MAS.S.small));
}
function evalRows(S) {
  return S.techs.map(function (t) { var C = S.cv[t], r = function (v) { return MAS.round(v, 3); };
    return [t === 'MX' ? 'Maxent' : 'Random Forest', C.ev === 'JK' ? 'jackknife n-1' : S.randomFolds ? 'random folds' : 'spatial blocks ' + S.blockKm + ' km', r(C.mean), r(C.sd), r(C.tssMean), r(C.tssSd),
      r(C.mtssMean), r(C.cbiMean), C.n, r(C.omission), C.ev === 'JK' ? MAS.round(C.p, 4) : NaN, S.thr[t].mode, MAS.round(S.thr[t].value, 4)]; });
}
function dispRows(S) { return S.dms.map(function (d) { var a = S.redsBy[d], m = quantile(a, 0.5), f = function (v) { return isFinite(v) ? MAS.round(v, 1) : null; };
  return [MAS.DISP_NAMES[d] + (d === 'L' ? ' (' + S.dispKm + ' km)' : '') + (d === S.dm ? ' - used' : ''), f(m), f(minOf(a)), f(maxOf(a)), isFinite(m) ? MAS.catOfRed('A3', m) : '']; }); }
function renderSdmResults(R, out) {
  var S = R.SDM;
  out.clear();
  if (!S || !S.done) return;
  out.add(ui.Label('Results (' + MAS.fmt((S.finished - S.started) / 1000, 0) + ' s): ' + S.nP + ' presences (of ' + S.nRecs + ' records, thinned at ' + S.cfg.thinKm +
    ' km), ' + S.nB + ' background points in ' + MAS.fmt(S.areaKm2, 0) + ' km²; ' + (S.ev === 'JK' ? 'jackknife with ' + S.k + ' models' : S.k + ' folds' + (S.randomFolds ? ' (random: the records fall in one ' + S.blockKm + ' km block)' : ' in ' + S.blockKm + ' km spatial blocks (' + S.nBlocks + ' with presences)')) +
    '; projections at ' + S.scale + ' m.', {fontSize: '12px', whiteSpace: 'pre-wrap'}));
  out.add(MAS.tableChart(MAS.EVAL_H.map(function (h, i) { return [h, i < 2 || i === 11 ? 'string' : 'number']; }), evalRows(S).map(function (r) { return r.map(function (v) { return typeof v === 'number' && !isFinite(v) ? null : v; }); })));
  out.add(ui.Label(S.ev === 'JK' ? 'Jackknife (Pearson et al. 2007): each presence is left out once; success = predicted ≥ threshold of the remaining presences; p = probability of as many ' +
    'successes by chance given the fraction of the background predicted suitable by each model (p < 0.05: significant). TSS = sensitivity + specificity - 1 with the background as pseudo-absences.' :
    'AUC and TSS on the held-out blocks; TSS at the threshold estimated on the training folds (max TSS: the optimistic best threshold on the test fold). With background instead of true absences ' +
    'AUC and TSS rank models but their absolute values are not accuracies (Leroy et al. 2018); the continuous Boyce index (Hirzel et al. 2006; > 0 = better than random, close to 1 = good) ' +
    'uses presences only.', {fontSize: '11px', color: '#555', whiteSpace: 'pre-wrap'}));
  if (S.failed && S.failed.length) out.add(ui.Label('Climates that failed (not used): ' + S.failed.join('; '), {fontSize: '12px', color: '#b30000', whiteSpace: 'pre-wrap'}));
  if (S.cor.length) out.add(ui.Label('Correlated predictors (|r| ≥ 0.7 at the background): ' + S.cor.map(function (x) { return x[0] + '-' + x[1] + ' r=' + x[2]; }).join('; ') +
    ' - consider dropping one of each pair.', {fontSize: '12px', color: '#b30000', whiteSpace: 'pre-wrap'}));
  if (S.rfImp) out.add(ui.Label('Random Forest variable importance (mean of ' + S.M + ' forests): ' + Object.keys(S.rfImp).sort(function (a, b) { return S.rfImp[b] - S.rfImp[a]; })
    .map(function (k) { return k + ' ' + MAS.fmt(S.rfImp[k], 1); }).join(', '), {fontSize: '12px'}));
  out.add(MAS.tableChart([['Technique', 'string'], ['Climate', 'string'], ['Summed suitability', 'number'], ['Suitable km²', 'number'],
    ['Change in summed suitability % (vs baseline)', 'number'], ['Change vs 1995-2014 %', 'number'], ['Suitable area change %', 'number']],
    S.rows.map(function (r) { return [r.t === 'MX' ? 'Maxent' : 'RF', r.p.label, MAS.round(r.sum, 1), MAS.round(r.area, 1), isFinite(r.redSum) ? MAS.round(-r.redSum, 1) : null,
      isFinite(r.redFromRecent) ? MAS.round(-r.redFromRecent, 1) : null, isFinite(r.areaChange) ? MAS.round(r.areaChange, 1) : null]; })));
  var cat = MAS.catOfRed('A3', S.redBest), lo = MAS.catOfRed('A3', S.redLo), hi = MAS.catOfRed('A3', S.redHi);
  out.add(ui.Label('Projected reduction (relative change in summed suitability, ' + S.fut[0] + '-' + S.fut[1] + ' vs 1995-2014, ' + S.reds.length +
    ' technique x GCM x SSP combinations): median ' + MAS.fmt(S.redBest, 1) + '% (range ' + MAS.fmt(S.redLo, 1) + ' to ' + MAS.fmt(S.redHi, 1) + '%) -> A3c ' + cat +
    (lo !== hi ? ' (plausible ' + lo + ' to ' + hi + ')' : '') + ', ' + MAS.DISP_NAMES[S.dm] + (S.dm === 'L' ? ' (' + S.dispKm + ' km)' : '') + '. Median as best estimate (Guidelines 4.5.2). Used in the Red List tab when the sub-criterion is A3.',
    {fontSize: '13px', fontWeight: 'bold', color: '#7a1f00', whiteSpace: 'pre-wrap'}));
  out.add(MAS.tableChart([['Dispersal', 'string'], ['Median reduction %', 'number'], ['Min %', 'number'], ['Max %', 'number'], ['Category (median)', 'string']], dispRows(S)));
  if (S.dispFallback) out.add(ui.Label('No dispersal distance was given, so the best estimate uses no dispersal (precautionary): enter the distance for a limited-dispersal estimate.', {fontSize: '12px', color: '#b30000', whiteSpace: 'pre-wrap'}));
  var mapSel = ui.Select({items: S.techs.map(function (t) { return {label: (t === 'MX' ? 'Maxent' : 'Random Forest') + ' - baseline suitability', value: t}; }),
    value: S.techs[0]});
  out.add(MAS.cardRow([mapSel, ui.Button({label: 'Show on the map', onClick: function () {
    var m = S.maps[mapSel.getValue()];
    Map.addLayer(m.cur, {min: 0, max: 1, palette: ['#f7fcf5', '#c7e9c0', '#74c476', '#238b45', '#00441b']}, 'Suitability ' + mapSel.getValue(), true, 0.8);
    Map.addLayer(m.cur.gte(m.thr).selfMask(), {palette: ['#d81e05']}, 'Suitable (≥ threshold) ' + mapSel.getValue(), false);
  }})]));
  var dp = ui.Panel();
  out.add(ui.Button({label: 'Supplementary Information for Bioclimate Models (Word)', onClick: function () { MAS.docDownload(dp, MAS.safeName(R.cfg.species) + '_bioclimate_SI.doc', MAS.bioclimateDoc(R)); }}));
  out.add(dp);
}

