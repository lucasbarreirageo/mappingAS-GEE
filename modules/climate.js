/**** mappingAS GEE 2.0.0 - module "climate": climate and climatic niche exposure
 * Sections 18 and 18b: TerraClimate, ENSO, ERA5-Land, NEX-GDDP-CMIP6, climate flags and the niche exposure
 * of Trisos, Merow & Pigot (2020) with signal-to-noise (Hawkins & Sutton 2012).
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: habitat, run, layout, batch, tabs, rangecalc, utils, records, charts, sdm, config, iucn_coding
 * Shared state created here: TC_ID, ERA_ID, CMIP_ID, TC_SCALE, ERA_SCALE, CMIP_SCALE, CMIP_MODELS, CMIP_RUNS, CL_VARS, CL_INFO, ENSO_COL, MONTHS, ENSO, NICHE_B, NICHE_RUN, NICHE_MAXPTS, NICHE_VARS, NICHE_H
 ****/

// ============================================================================
// 18. CLIMATE: TerraClimate (1958-), ENSO (ONI), ERA5-Land (recent months), NEX-GDDP-CMIP6 (projections)
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.pad2 = pad2;
  MAS.ensoOf = ensoOf;
  MAS.oniAt = oniAt;
  MAS.ensoNow = ensoNow;
  MAS.tcColl = tcColl;
  MAS.monthThresholds = monthThresholds;
  MAS.tcYearImage = tcYearImage;
  MAS.tcClimatology = tcClimatology;
  MAS.climReduce = climReduce;
  MAS.climGeoms = climGeoms;
  MAS.runClimate = runClimate;
  MAS.eraMonths = eraMonths;
  MAS.eraImage = eraImage;
  MAS.cmipImage = cmipImage;
  MAS.climSeries = climSeries;
  MAS.meanOf = meanOf;
  MAS.climSummary = climSummary;
  MAS.climFlags = climFlags;
  MAS.ensoImpact = ensoImpact;
  MAS.dtRoles = dtRoles;
  MAS.signed = signed;
  MAS.pText = pText;
  MAS.climVarChart = climVarChart;
  MAS.chip = chip;
  MAS.renderClimateTab = renderClimateTab;
  MAS.cmipEnsemble = cmipEnsemble;
  MAS.climateLines = climateLines;
  MAS.nichePoints = nichePoints;
  MAS.nicheImage = nicheImage;
  MAS.nicheJobs = nicheJobs;
  MAS.seq = seq;
  MAS.nicheAdd = nicheAdd;
  MAS.nicheSummary = nicheSummary;
  MAS.nicheThreats = nicheThreats;
  MAS.nicheLine = nicheLine;
  MAS.nicheCard = nicheCard;
  MAS.nicheRows = nicheRows;
};

exports.run = function () {
  MAS.TC_ID = 'IDAHO_EPSCOR/TERRACLIMATE';
  MAS.ERA_ID = 'ECMWF/ERA5_LAND/MONTHLY_AGGR';
  MAS.CMIP_ID = 'NASA/GDDP-CMIP6';
  MAS.TC_SCALE = 4638.3;
  MAS.ERA_SCALE = 11132;
  MAS.CMIP_SCALE = 27830;
  MAS.CMIP_MODELS = ['ACCESS-CM2', 'MPI-ESM1-2-HR', 'MRI-ESM2-0', 'IPSL-CM6A-LR', 'EC-Earth3'];
  MAS.CMIP_RUNS = [['hist', 'historical', 1995, 2014], ['s245_mid', 'ssp245', 2041, 2060], ['s245_end', 'ssp245', 2081, 2100],
    ['s585_mid', 'ssp585', 2041, 2060], ['s585_end', 'ssp585', 2081, 2100]];
  MAS.CL_VARS = ['tmx', 'tmn', 'txx', 'pr', 'def', 'aet', 'pet', 'pdsi', 'vpd', 'hot', 'dry'];
  MAS.CL_INFO = {
    tmx: {name: 'Maximum temperature', unit: '°C', what: 'annual mean of monthly maxima', color: '#f4846e', d: 1},
    tmn: {name: 'Minimum temperature', unit: '°C', what: 'annual mean of monthly minima', color: '#8fb8de', d: 1},
    txx: {name: 'Hottest month', unit: '°C', what: 'maximum of the monthly maxima', color: '#d7301f', d: 1},
    pr: {name: 'Precipitation', unit: 'mm', what: 'annual total', color: '#5b8fd1', d: 0, pct: true},
    def: {name: 'Water deficit', unit: 'mm', what: 'climatic water deficit, PET - AET, annual total', color: '#e8c547', d: 0, pct: true},
    aet: {name: 'Actual evapotranspiration', unit: 'mm', what: 'annual total', color: '#4daf4a', d: 0, pct: true},
    pet: {name: 'Potential evapotranspiration', unit: 'mm', what: 'annual total', color: '#ff7f00', d: 0, pct: true},
    pdsi: {name: 'Palmer drought index (PDSI)', unit: '', what: 'annual mean; < -2 moderate, < -3 severe, < -4 extreme drought', color: '#a6611a', d: 2},
    vpd: {name: 'Vapour pressure deficit', unit: 'kPa', what: 'annual mean (atmospheric dryness)', color: '#c51b7d', d: 2, pct: true},
    hot: {name: 'Hot months', unit: 'months', what: 'months above the 90th percentile of the same calendar month in the baseline', color: '#d7301f', d: 1},
    dry: {name: 'Dry months', unit: 'months', what: 'months below the 10th percentile of precipitation of the same calendar month in the baseline', color: '#a6611a', d: 1}
  };
  MAS.ENSO_COL = {'El Niño': '#d7301f', 'La Niña': '#2b8cbe', 'Neutral': '#9e9e9e', 'El Niño → La Niña': '#b05fa8', 'La Niña → El Niño': '#b05fa8'};
  MAS.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // ---- ENSO from the ONI: El Niño / La Niña when |ONI| >= 0.5 for at least 5 consecutive overlapping seasons (NOAA CPC)
  MAS.ENSO = (function () {
    var seq = [];
    Object.keys(MAS.ONI).map(Number).sort(function (a, b) { return a - b; }).forEach(function (y) {
      MAS.ONI[y].forEach(function (v, m) { seq.push({y: y, m: m, v: v, ph: 0}); });
    });
    function mark(test, ph) {
      var i = 0;
      while (i < seq.length) {
        if (!test(seq[i].v)) { i++; continue; }
        var j = i;
        while (j < seq.length && test(seq[j].v)) j++;
        if (j - i >= 5) for (var k = i; k < j; k++) seq[k].ph = ph;
        i = j;
      }
    }
    mark(function (v) { return v >= 0.5; }, 1);
    mark(function (v) { return v <= -0.5; }, -1);
    var years = {};
    seq.forEach(function (s) {
      var o = years[s.y] || (years[s.y] = {nE: 0, nL: 0, n: 0, peakE: 0, peakL: 0, sum: 0, firstE: 99, firstL: 99});
      o.n++; o.sum += s.v;
      if (s.ph === 1) { o.nE++; o.peakE = Math.max(o.peakE, s.v); o.firstE = Math.min(o.firstE, s.m); }
      if (s.ph === -1) { o.nL++; o.peakL = Math.min(o.peakL, s.v); o.firstL = Math.min(o.firstL, s.m); }
    });
    function strength(a) { a = Math.abs(a); return a >= 2 ? 'very strong' : a >= 1.5 ? 'strong' : a >= 1 ? 'moderate' : 'weak'; }
    Object.keys(years).forEach(function (y) {
      var o = years[y];
      o.mean = o.sum / o.n;
      if (o.nE >= 3 && o.nL >= 3) o.phase = o.firstE < o.firstL ? 'El Niño → La Niña' : 'La Niña → El Niño';
      else if (o.nE >= 4 && o.nE >= o.nL) o.phase = 'El Niño';
      else if (o.nL >= 4) o.phase = 'La Niña';
      else o.phase = 'Neutral';
      o.pure = o.phase === 'El Niño' || o.phase === 'La Niña' || (o.phase === 'Neutral' && o.nE === 0 && o.nL === 0);
      o.strength = o.phase === 'El Niño' ? strength(o.peakE) : o.phase === 'La Niña' ? strength(o.peakL) :
        o.phase === 'Neutral' ? '' : strength(Math.max(o.peakE, -o.peakL));
      o.label = o.phase + (o.strength ? ' (' + o.strength + ')' : '');
      o.partial = o.n < 12;
    });
    var last = seq[seq.length - 1];
    return {seq: seq, years: years, last: last};
  })();
  // ============================================================================
  // 18b. CLIMATIC NICHE EXPOSURE (Trisos, Merow & Pigot 2020, Nature 580: 496-501): the realised niche limits of
  //   the species are the most extreme annual values met in any occupied cell during the baseline (1958-1990);
  //   a cell is exposed when its climate stays beyond those limits for >= 5 consecutive years. Exposure, not
  //   sensitivity: the realised niche of a narrow-range species is truncated, so exposure may be overstated.
  // ============================================================================
  MAS.NICHE_B = [1958, 1990];
  MAS.NICHE_RUN = 5;
  MAS.NICHE_MAXPTS = 300;
  MAS.NICHE_VARS = [['t', 'Annual mean Tmax', '°C', 1, 'upper'], ['p', 'Annual precipitation', 'mm', 0, 'lower'], ['d', 'Annual water deficit', 'mm', 0, 'upper']];
  MAS.NICHE_H = [['cell', 'number'], ['variable', 'string'], ['niche_limit', 'number'], ['last5_mean', 'number'], ['margin', 'number'], ['exposed', 'string'],
    ['first_exposure', 'number'], ['ongoing', 'string'], ['years_beyond_last10', 'number']];
};

function pad2(n) { return n < 10 ? '0' + n : String(n); }
function ensoOf(y) { return MAS.ENSO.years[y] || {phase: 'Neutral', label: 'no ONI', mean: NaN, pure: false}; }
function oniAt(y, m) { var a = MAS.ONI[y]; return a && a[m] !== undefined ? a[m] : null; }
function ensoNow() {
  var L = MAS.ENSO.last, ss = ['DJF', 'JFM', 'FMA', 'MAM', 'AMJ', 'MJJ', 'JJA', 'JAS', 'ASO', 'SON', 'OND', 'NDJ'];
  var st = L.v >= 0.5 ? 'El Niño conditions' : L.v <= -0.5 ? 'La Niña conditions' : 'neutral conditions';
  var s = L.v >= 2 ? ' (very strong)' : L.v >= 1.5 ? ' (strong)' : L.v >= 1 ? ' (moderate)' : '';
  return 'Latest ONI: ' + ss[L.m] + ' ' + L.y + ' = ' + (L.v > 0 ? '+' : '') + L.v.toFixed(2) + ' °C -> ' + st + (L.v <= -0.5 ? '' : s) + '.';
}
// ---- server-side images
function tcColl() { return ee.ImageCollection(MAS.TC_ID); }
function monthThresholds(b0, b1) {   // per calendar month: 90th percentile of Tmax and 10th of precipitation in the baseline
  var c = tcColl().filterDate(b0 + '-01-01', (b1 + 1) + '-01-01');
  return ee.List(MAS.MONTHS.map(function (n, i) {
    var cm = c.filter(ee.Filter.calendarRange(i + 1, i + 1, 'month'));
    return cm.select('tmmx').reduce(ee.Reducer.percentile([90])).rename('t90')
      .addBands(cm.select('pr').reduce(ee.Reducer.percentile([10])).rename('p10'));
  }));
}
function tcYearImage(y, thr) {
  var c = tcColl().filterDate(y + '-01-01', (y + 1) + '-01-01');
  var ext = c.map(function (im) {
    var t = ee.Image(thr.get(ee.Number(im.date().get('month')).subtract(1)));
    return im.select('tmmx').gt(t.select('t90')).rename('hot').addBands(im.select('pr').lt(t.select('p10')).rename('dry'));
  }).sum();
  var p = 'a' + y + '_';
  return ee.Image.cat([
    c.select('tmmx').mean().multiply(0.1).rename(p + 'tmx'), c.select('tmmn').mean().multiply(0.1).rename(p + 'tmn'),
    c.select('tmmx').max().multiply(0.1).rename(p + 'txx'), c.select('pr').sum().rename(p + 'pr'),
    c.select('def').sum().multiply(0.1).rename(p + 'def'), c.select('aet').sum().multiply(0.1).rename(p + 'aet'),
    c.select('pet').sum().multiply(0.1).rename(p + 'pet'), c.select('pdsi').mean().multiply(0.01).rename(p + 'pdsi'),
    c.select('vpd').mean().multiply(0.01).rename(p + 'vpd'), ext.select('hot').rename(p + 'hot'), ext.select('dry').rename(p + 'dry')]);
}
function tcClimatology(y0, y1, tag) {
  var c = tcColl().filterDate(y0 + '-01-01', (y1 + 1) + '-01-01');
  return ee.Image.cat(MAS.MONTHS.map(function (n, i) {
    var cm = c.filter(ee.Filter.calendarRange(i + 1, i + 1, 'month')), p = tag + pad2(i + 1) + '_';
    return ee.Image.cat([cm.select('pr').mean().rename(p + 'pr'), cm.select('tmmx').mean().multiply(0.1).rename(p + 'tmx'),
      cm.select('tmmn').mean().multiply(0.1).rename(p + 'tmn'), cm.select('def').mean().multiply(0.1).rename(p + 'def')]);
  }));
}
function climReduce(img, geom, scale, ts, kind) {
  return ee.Dictionary({climKind: kind, v: img.reduceRegion({reducer: ee.Reducer.mean(), geometry: geom, scale: scale, maxPixels: 1e13, tileScale: ts})});
}
function climGeoms(R) {
  var pts = R.aoo.cells.map(function (c) {
    var sx = 0, sy = 0, n = c.ring.length - 1;
    for (var i = 0; i < n; i++) { sx += c.ring[i][0]; sy += c.ring[i][1]; }
    return [sx / n, sy / n];
  });
  var out = {AOO: {geom: ee.Geometry.MultiPoint(pts), scale: MAS.TC_SCALE}};
  if (R.eooGeom) out.EOO = {geom: R.eooGeom, scale: MAS.autoScale(R.eooKm2, 4e5, MAS.TC_SCALE)};
  return out;
}
// ---- run
function runClimate(R, done) {
  if (!R.cfg.doClimate) { MAS.progSet('climate', 'skip', 'off'); done(); return; }
  var CL = R.CL = {A: {}, M: {}, E: {}, P: {}, scope: 'AOO', failed: []};
  var G2 = climGeoms(R);
  CL.scopes = Object.keys(G2);
  MAS.progSet('climate', 'run', 'checking dates');
  ee.Dictionary({climKind: 'meta', tc: tcColl().aggregate_max('system:time_start'),
    era: ee.ImageCollection(MAS.ERA_ID).aggregate_max('system:time_start')}).evaluate(function (meta, err) {
    if (MAS.stale(R)) return;
    if (err || !meta) { CL.failed.push('dates: ' + err); MAS.progSet('climate', 'fail', 'TerraClimate not reachable'); CL.done = true; MAS.renderOne(R, 'Climate', renderClimateTab); done(); return; }
    var tcEnd = new Date(meta.tc), eraEnd = new Date(meta.era);
    CL.tcLast = tcEnd.getUTCMonth() === 11 ? tcEnd.getUTCFullYear() : tcEnd.getUTCFullYear() - 1;
    CL.y0 = Math.max(1958, isFinite(R.cfg.climStart) && R.cfg.climStart > 1900 ? R.cfg.climStart : R.y0);
    CL.y1 = CL.tcLast;
    if (CL.y1 - CL.y0 < 9) CL.y0 = CL.y1 - 9;
    CL.n = Math.max(1, Math.min(R.cfg.climN, Math.floor((CL.y1 - CL.y0 + 1) / 2)));
    CL.b0 = Math.max(1958, Math.min(1991, CL.y1 - 29)); CL.b1 = Math.min(CL.b0 + 29, CL.y1);
    CL.years = [];
    for (var y = CL.y0; y <= CL.y1; y++) CL.years.push(y);
    CL.eraLast = {y: eraEnd.getUTCFullYear(), m: eraEnd.getUTCMonth() + 1};
    var thr = monthThresholds(CL.b0, CL.b1);
    var jobs = [];
    CL.scopes.forEach(function (s) {
      CL.A[s] = {};
      for (var i = 0; i < CL.years.length; i += 8) {
        (function (ys) {
          jobs.push({key: 'TerraClimate ' + s + ' ' + ys[0] + '-' + ys[ys.length - 1], scope: s, kind: 'annual', years: ys, make: function (ts) {
            return climReduce(ee.Image.cat(ys.map(function (yy) { return tcYearImage(yy, thr); })), G2[s].geom, G2[s].scale, ts, 'annual');
          }});
        })(CL.years.slice(i, i + 8));
      }
      jobs.push({key: 'climatology ' + s, scope: s, kind: 'monthly', make: function (ts) {
        return climReduce(tcClimatology(CL.b0, CL.b1, 'mb').addBands(tcClimatology(CL.y1 - CL.n + 1, CL.y1, 'mr')), G2[s].geom, G2[s].scale, ts, 'monthly');
      }});
      jobs.push({key: 'ERA5-Land ' + s, scope: s, kind: 'era', make: function (ts) {
        return climReduce(eraImage(CL), G2[s].geom, Math.max(MAS.ERA_SCALE, s === 'EOO' ? G2[s].scale : 0), ts, 'era');
      }});
    });
    jobs = jobs.concat(nicheJobs(R, CL));
    if (R.cfg.doCmip) CL.scopes.forEach(function (s) {
      MAS.CMIP_MODELS.forEach(function (mod) {
        jobs.push({key: 'CMIP6 ' + mod + ' ' + s, scope: s, kind: 'cmip', model: mod, make: function (ts) {
          return climReduce(cmipImage(mod), G2[s].geom, Math.max(MAS.CMIP_SCALE, s === 'EOO' ? G2[s].scale : 0), ts, 'cmip');
        }});
      });
    });
    MAS.progSet('climate', 'run', '0/' + jobs.length, 0);
    MAS.runJobs(R, jobs, function (job, res, i) {
      var v = res && res.v;
      if (v) {
        if (job.kind === 'annual') job.years.forEach(function (yy) {
          var o = {}, any = false;
          MAS.CL_VARS.forEach(function (k) { var x = v['a' + yy + '_' + k]; o[k] = (x === null || x === undefined) ? NaN : x; if (isFinite(o[k])) any = true; });
          if (any) CL.A[job.scope][yy] = o;
        });
        else if (job.kind === 'monthly') CL.M[job.scope] = v;
        else if (job.kind === 'era') CL.E[job.scope] = v;
        else if (job.kind === 'niche') nicheAdd(CL, v);
        else { CL.P[job.scope] = CL.P[job.scope] || {}; CL.P[job.scope][job.model] = v; }
      } else CL.failed.push(job.key);
      MAS.progSet('climate', 'run', (i + 1) + '/' + jobs.length, (i + 1) / jobs.length);
      if (job.kind === 'monthly' || (job.kind === 'cmip' && job.model === MAS.CMIP_MODELS[MAS.CMIP_MODELS.length - 1])) MAS.renderOne(R, 'Climate', renderClimateTab);
    }, function (failed) {
      CL.done = true;
      MAS.progSet('climate', failed.length ? 'fail' : 'ok', failed.length ? failed.length + ' request(s) failed' :
        'TerraClimate ' + CL.y0 + '-' + CL.y1 + ', ERA5-Land to ' + MAS.MONTHS[CL.eraLast.m - 1] + ' ' + CL.eraLast.y + (R.cfg.doCmip ? ', CMIP6 ' + MAS.CMIP_MODELS.length + ' models' : ''));
      MAS.renderOne(R, 'Climate', renderClimateTab);
      MAS.renderOne(R, 'Summary', MAS.renderAssessmentTab);
      done();
    });
  });
}
// ERA5-Land: last 24 months and the 1991-2020 normal of each calendar month
function eraMonths(CL) {
  var out = [], y = CL.eraLast.y, m = CL.eraLast.m;
  for (var i = 0; i < 24; i++) { out.unshift({y: y, m: m}); m--; if (m === 0) { m = 12; y--; } }
  return out;
}
function eraImage(CL) {
  var c = ee.ImageCollection(MAS.ERA_ID), bands = [];
  eraMonths(CL).forEach(function (o) {
    var im = ee.Image(c.filterDate(o.y + '-' + pad2(o.m) + '-01', (o.m === 12 ? o.y + 1 : o.y) + '-' + pad2(o.m === 12 ? 1 : o.m + 1) + '-01').first());
    var p = 'e' + o.y + pad2(o.m) + '_';
    bands.push(im.select('temperature_2m').subtract(273.15).rename(p + 't'), im.select('total_precipitation_sum').multiply(1000).rename(p + 'p'));
  });
  var base = c.filterDate('1991-01-01', '2021-01-01');
  MAS.MONTHS.forEach(function (n, i) {
    var cm = base.filter(ee.Filter.calendarRange(i + 1, i + 1, 'month')), p = 'n' + pad2(i + 1) + '_';
    bands.push(cm.select('temperature_2m').mean().subtract(273.15).rename(p + 't'), cm.select('total_precipitation_sum').mean().multiply(1000).rename(p + 'p'));
  });
  return ee.Image.cat(bands);
}
// NEX-GDDP-CMIP6: mean daily Tmax (°C) and annual precipitation (mm), days 1, 8, 15 and 22 of every month (4 of ~30 days)
function cmipImage(model) {
  var days = ee.Filter.or(ee.Filter.calendarRange(1, 1, 'day_of_month'), ee.Filter.calendarRange(8, 8, 'day_of_month'),
    ee.Filter.calendarRange(15, 15, 'day_of_month'), ee.Filter.calendarRange(22, 22, 'day_of_month'));
  var c = ee.ImageCollection(MAS.CMIP_ID).filter(ee.Filter.eq('model', model)).filter(days);
  return ee.Image.cat(MAS.CMIP_RUNS.map(function (r) {
    var cc = c.filter(ee.Filter.eq('scenario', r[1])).filterDate(r[2] + '-01-01', (r[3] + 1) + '-01-01').select(['tasmax', 'pr']).mean();
    return cc.select('tasmax').subtract(273.15).rename(r[0] + '_tx').addBands(cc.select('pr').multiply(86400 * 365.25).rename(r[0] + '_pr'));
  }));
}
// ---- summaries (client side)
function climSeries(CL, s, k) {
  var A = CL.A[s] || {};
  var ys = Object.keys(A).map(Number).filter(function (y) { return isFinite(A[y][k]); }).sort(function (a, b) { return a - b; });
  return {years: ys, vals: ys.map(function (y) { return A[y][k]; })};
}
function meanOf(a) { var s = 0, n = 0; a.forEach(function (x) { if (isFinite(x)) { s += x; n++; } }); return n ? s / n : NaN; }
function climSummary(CL, s, k) {
  var sr = climSeries(CL, s, k);
  if (sr.years.length < 6) return null;
  var n = CL.n, first = sr.vals.slice(0, n), last = sr.vals.slice(-n);
  var a = meanOf(first), b = meanOf(last), fit = MAS.ols(sr.years, sr.vals);
  // noise = sd of the detrended annual values (Hawkins & Sutton 2012): signal-to-noise = change / noise
  var res = fit ? sr.vals.map(function (v, i) { return v - fit.intercept - fit.slope * sr.years[i]; }) : [];
  var noise = res.length > 2 ? Math.sqrt(res.reduce(function (q, x) { return q + x * x; }, 0) / (res.length - 2)) : NaN;
  return {noise: noise, sn: noise > 0 ? (b - a) / noise : NaN, k: k, from: a, to: b, delta: b - a, pct: a !== 0 ? 100 * (b - a) / Math.abs(a) : NaN,
    slope10: fit ? fit.slope * 10 : NaN, p: fit ? fit.p : NaN, fit: fit, years: sr.years, vals: sr.vals,
    y0: sr.years[0], y1: sr.years[sr.years.length - 1], firstYears: sr.years.slice(0, n), lastYears: sr.years.slice(-n)};
}
function climFlags(CL, s) {
  var t = climSummary(CL, s, 'tmx'), p = climSummary(CL, s, 'pr'), d = climSummary(CL, s, 'def'), q = climSummary(CL, s, 'pdsi'), h = climSummary(CL, s, 'hot');
  if (!t || !p) return null;
  var f = {
    warming: t.delta >= 0.5 && t.slope10 > 0 && t.sn >= 1,
    drying: p.pct <= -10 && p.slope10 < 0 && p.sn <= -1,
    deficit: !!d && d.delta >= 20 && d.slope10 > 0 && d.sn >= 1,
    drought: !!q && q.to <= -2,
    extremes: !!h && h.to >= 2.4   // > 20% of months above the baseline 90th percentile (expected 10% = 1.2 months/yr)
  };
  f.stress = f.warming && (f.drying || f.deficit || f.drought);
  f.t = t; f.p = p; f.d = d; f.q = q; f.h = h;
  return f;
}
function ensoImpact(CL, s) {
  var groups = {'El Niño': [], 'La Niña': [], 'Neutral': []}, A = CL.A[s] || {};
  var base = {};
  ['pr', 'tmx', 'def', 'pdsi'].forEach(function (k) {   // detrended anomalies, so that the trend does not bias the comparison
    var sm = climSummary(CL, s, k);
    base[k] = sm;
  });
  Object.keys(A).map(Number).forEach(function (y) {
    var e = ensoOf(y);
    if (!e.pure || !groups[e.phase]) return;
    var o = {y: y};
    ['pr', 'tmx', 'def', 'pdsi'].forEach(function (k) {
      var sm = base[k];
      if (!sm || !sm.fit || !isFinite(A[y][k])) { o[k] = NaN; return; }
      var expv = sm.fit.intercept + sm.fit.slope * y;
      o[k] = k === 'pr' || k === 'def' ? (expv !== 0 ? 100 * (A[y][k] - expv) / Math.abs(expv) : NaN) : A[y][k] - expv;
      if (k === 'def') o.defmm = A[y][k] - expv;
    });
    groups[e.phase].push(o);
  });
  var out = {};
  Object.keys(groups).forEach(function (g) {
    var L = groups[g];
    out[g] = {n: L.length, years: L.map(function (o) { return o.y; }), pr: meanOf(L.map(function (o) { return o.pr; })),
      tmx: meanOf(L.map(function (o) { return o.tmx; })), def: meanOf(L.map(function (o) { return o.defmm; })), pdsi: meanOf(L.map(function (o) { return o.pdsi; }))};
  });
  return out;
}
// ---- charts with point / bar colours by ENSO phase
function dtRoles(cols, rows) {
  return {cols: cols.map(function (c) { var o = {label: c[0], type: c[1]}; if (c[2]) { o.role = c[2]; o.p = {role: c[2]}; } return o; }),
    rows: rows.map(function (r) { return {c: r.map(function (v) { return {v: v}; })}; })};
}
function signed(x, d, u) { return !isFinite(x) ? '-' : (x > 0 ? '+' : x < 0 ? '−' : '') + MAS.fmt(Math.abs(x), d) + (u ? ' ' + u : ''); }
function pText(p) { return !isFinite(p) ? '' : p < 0.05 ? 'significant, p = ' + MAS.fmt(p, 3) : 'not significant, p = ' + MAS.fmt(p, 2); }
function climVarChart(CL, s, k) {
  var I = MAS.CL_INFO[k], sm = climSummary(CL, s, k);
  if (!sm) return null;
  var c = MAS.TC();
  var rows = sm.years.map(function (y, i) {
    var e = ensoOf(y);
    return [String(y), MAS.round(sm.vals[i], 3), 'point {size: 5; fill-color: ' + (MAS.ENSO_COL[e.phase] || '#9e9e9e') + '}',
      String(y) + ': ' + MAS.fmt(sm.vals[i], I.d) + ' ' + I.unit + ' - ' + e.label + ' (mean ONI ' + signed(e.mean, 2) + ')',
      sm.fit ? MAS.round(sm.fit.intercept + sm.fit.slope * y, 3) : null];
  });
  var head = I.name + ' (' + I.what + ')\n' + MAS.fmt(sm.from, I.d) + ' → ' + MAS.fmt(sm.to, I.d) + (I.unit ? ' ' + I.unit : '') + '  ·  ' +
    signed(sm.delta, I.d, I.unit) + (I.pct ? '  ·  ' + signed(sm.pct, 1, '%') : '') +
    '\ntrend: ' + signed(sm.slope10, I.d + 1, I.unit) + ' per decade (' + pText(sm.p) + ')';
  var p = ui.Panel({style: {backgroundColor: c.bg, margin: '6px 0'}});
  p.add(ui.Label(head, {fontSize: '12px', color: c.text, backgroundColor: c.bg, whiteSpace: 'pre-wrap'}));
  p.add(MAS.mkChart(dtRoles([['Year', 'string'], [I.name, 'number'], ['', 'string', 'style'], ['', 'string', 'tooltip'], ['Linear trend', 'number']], rows),
    'LineChart', MAS.themed({colors: [I.color, '#bdbdbd'], pointSize: 5, height: 210, legend: {position: 'none'},
      series: {1: {lineDashStyle: [4, 4], pointSize: 0, lineWidth: 1.5}}, hAxis: {showTextEvery: 5}, vAxis: {title: I.unit}})));
  return p;
}
function chip(txt, on, c) {
  return ui.Label((on ? '● ' : '○ ') + txt, {fontSize: '12px', padding: '3px 8px', margin: '2px 4px',
    color: on ? '#ffffff' : c.text, backgroundColor: on ? '#a5281f' : '#2e5e3e', border: '1px solid ' + (on ? '#ff6b5b' : '#4d8f62')});
}
// ---- tab
function renderClimateTab(R) {
  var T = 'Climate';
  MAS.TABS[T].clear();
  MAS.tabHead(T, 'Climate - ' + R.cfg.species);
  if (!R.cfg.doClimate) { MAS.tabNote(T, 'Climate analysis is off (left panel, section 4c).'); return; }
  var CL = R.CL;
  if (!CL || !CL.years) { MAS.tabNote(T, 'Reading TerraClimate, ERA5-Land and CMIP6 dates...'); return; }
  if (!CL.done) MAS.tabNote(T, 'Loading in the background - this tab refreshes by itself.');
  var c = MAS.TC(), s = CL.scope;
  // scope selector (recreated each render)
  var sel = ui.Select({items: CL.scopes, value: s, onChange: function (v) { CL.scope = v; MAS.uiLater(function () { renderClimateTab(R); }); }});
  MAS.tabAdd(T, ui.Panel([ui.Label('Extent:', {fontSize: '12px'}), sel], ui.Panel.Layout.flow('horizontal')));
  var nPts = R.aoo.cells.length;
  MAS.tabAdd(T, nicheCard(R));
  // ---- card 1: stress + main variables
  var k1 = MAS.card('Regional climate change (context) • ' + CL.y0 + '-' + CL.y1 + ' • ' + (s === 'AOO' ? 'area of occupancy (' + nPts + ' cells, value at each cell centre)' : 'extent of occurrence') +
    ' • TerraClimate ~4.6 km');
  var F = climFlags(CL, s);
  if (!F) k1.add(MAS.cardLabel(CL.done ? 'No TerraClimate values for this extent (request failed or outside the land mask).' : 'Loading...'));
  else {
    k1.add(MAS.cardRow([chip(F.stress ? 'Climate stress' : 'No climate stress', F.stress, c), chip('Warming: ' + (F.warming ? 'yes' : 'no'), F.warming, c),
      chip('Drying: ' + (F.drying ? 'yes' : 'no'), F.drying, c), chip('Water deficit rising: ' + (F.deficit ? 'yes' : 'no'), F.deficit, c),
      chip('Drought (PDSI): ' + (F.drought ? 'yes' : 'no'), F.drought, c), chip('Hot extremes: ' + (F.extremes ? 'yes' : 'no'), F.extremes, c)]));
    k1.add(MAS.cardLabel('Context only - these regional signals are not coded as threats (exposure beyond the species\' niche is, card above). ' +
      'Climate stress = warming AND (drying OR rising water deficit OR drought). Warming: Tmax +0.5 °C or more, upward trend and signal-to-noise ≥ 1 ' +
      '(change ≥ 1 sd of the detrended year-to-year variation; Hawkins & Sutton 2012; S/N here ' + MAS.fmt(F.t.sn, 1) + '); ' +
      'drying: precipitation 10% lower or more, downward trend, S/N ≤ −1 (' + MAS.fmt(F.p.sn, 1) + '); deficit: +20 mm or more, upward trend, S/N ≥ 1; ' +
      'drought: PDSI ≤ −2 (Palmer 1965 moderate drought) in the last ' + CL.n +
      ' years; hot extremes: > 20% of months above the baseline 90th percentile (10% expected). Change = mean of ' + F.t.firstYears[0] + '-' +
      F.t.firstYears[F.t.firstYears.length - 1] + ' vs ' + F.t.lastYears[0] + '-' + F.t.lastYears[F.t.lastYears.length - 1] + '. Points are coloured by ENSO phase: ' +
      'red El Niño, blue La Niña, purple transition, grey neutral.'));
    ['tmx', 'pr', 'def', 'pdsi', 'tmn', 'vpd', 'aet', 'hot'].forEach(function (k) { var ch = climVarChart(CL, s, k); if (ch) k1.add(ch); });
  }
  MAS.tabAdd(T, k1);
  // ---- card 2: anomalies and ENSO
  if (F) {
    var k2 = MAS.card('Anomalies and ENSO (El Niño / La Niña)');
    var A = CL.A[s], yrs = Object.keys(A).map(Number).sort(function (a, b) { return a - b; });
    var pAvg = meanOf(yrs.map(function (y) { return A[y].pr; })), tAvg = meanOf(yrs.map(function (y) { return A[y].tmx; }));
    k2.add(MAS.mkChart(dtRoles([['Year', 'string'], ['Precipitation anomaly (%)', 'number'], ['', 'string', 'style'], ['', 'string', 'tooltip']],
      yrs.map(function (y) { var e = ensoOf(y), v = 100 * (A[y].pr - pAvg) / pAvg;
        return [String(y), MAS.round(v, 1), MAS.ENSO_COL[e.phase], y + ': ' + signed(v, 1, '%') + ' - ' + e.label]; })),
      'ColumnChart', MAS.themed({title: 'Precipitation anomaly vs the ' + yrs[0] + '-' + yrs[yrs.length - 1] + ' mean (%), bars coloured by ENSO phase',
        legend: {position: 'none'}, height: 230, hAxis: {showTextEvery: 5}, vAxis: {title: '%'}})));
    k2.add(MAS.mkChart(dtRoles([['Year', 'string'], ['Tmax anomaly (°C)', 'number'], ['', 'string', 'style'], ['', 'string', 'tooltip']],
      yrs.map(function (y) { var e = ensoOf(y), v = A[y].tmx - tAvg;
        return [String(y), MAS.round(v, 2), MAS.ENSO_COL[e.phase], y + ': ' + signed(v, 2, '°C') + ' - ' + e.label]; })),
      'ColumnChart', MAS.themed({title: 'Maximum temperature anomaly (°C), bars coloured by ENSO phase', legend: {position: 'none'}, height: 230,
        hAxis: {showTextEvery: 5}, vAxis: {title: '°C'}})));
    var ei = ensoImpact(CL, s);
    k2.add(MAS.cardLabel('Mean detrended anomaly by ENSO phase (years with a single phase only; the long-term trend is removed first):'));
    k2.add(MAS.tableChart([['Phase', 'string'], ['Years', 'number'], ['Precipitation %', 'number'], ['Tmax °C', 'number'], ['Water deficit mm', 'number'], ['PDSI', 'number'], ['Which years', 'string']],
      ['El Niño', 'La Niña', 'Neutral'].map(function (g) { var o = ei[g];
        return [g, o.n, MAS.round(o.pr, 1), MAS.round(o.tmx, 2), MAS.round(o.def, 0), MAS.round(o.pdsi, 2), o.years.join(', ')]; })));
    k2.add(MAS.mkChart(dtRoles([['Phase', 'string'], ['Precipitation anomaly (%)', 'number'], ['', 'string', 'style']],
      ['El Niño', 'La Niña', 'Neutral'].map(function (g) { var o = ei[g]; return [g + ' (' + o.n + ' yr)', MAS.round(o.pr, 1), MAS.ENSO_COL[g]]; })), 'ColumnChart',
      MAS.themed({title: 'Detrended precipitation anomaly by ENSO phase (%)', legend: {position: 'none'}, height: 200, vAxis: {title: '%'}})));
    var strong = yrs.filter(function (y) { var e = ensoOf(y); return e.phase !== 'Neutral' && (e.strength === 'strong' || e.strength === 'very strong'); });
    if (strong.length) k2.add(MAS.cardLabel('Strong and very strong ENSO years in the period: ' + strong.map(function (y) {
      var e = ensoOf(y);
      return y + ' ' + e.label + ': precipitation ' + signed(100 * (A[y].pr - pAvg) / pAvg, 0, '%') + ', Tmax ' + signed(A[y].tmx - tAvg, 1, '°C') +
        (isFinite(A[y].pdsi) ? ', PDSI ' + MAS.fmt(A[y].pdsi, 1) : '');
    }).join(' | ')));
    k2.add(MAS.cardLabel(ensoNow() + ' (' + MAS.ONI_SOURCE + ').'));
    MAS.tabAdd(T, k2);
  }
  // ---- card 3: climatology (climograph)
  var M = CL.M[s];
  if (M) {
    var k3 = MAS.card('Monthly climate • baseline ' + CL.b0 + '-' + CL.b1 + ' vs last ' + CL.n + ' years (' + (CL.y1 - CL.n + 1) + '-' + CL.y1 + ')');
    var rows = MAS.MONTHS.map(function (n, i) { var mm = pad2(i + 1);
      return [n, MAS.round(M['mb' + mm + '_pr'], 1), MAS.round(M['mr' + mm + '_pr'], 1), MAS.round(M['mb' + mm + '_tmx'], 2), MAS.round(M['mr' + mm + '_tmx'], 2)]; });
    k3.add(MAS.mkChart(MAS.dataTable([['Month', 'string'], ['Precipitation baseline (mm)', 'number'], ['Precipitation recent (mm)', 'number'],
      ['Tmax baseline (°C)', 'number'], ['Tmax recent (°C)', 'number']], rows), 'ComboChart',
      MAS.themed({title: 'Climograph', seriesType: 'bars', colors: ['#9ecae1', '#3182bd', '#fdae6b', '#e6550d'],
        series: {2: {type: 'line', targetAxisIndex: 1}, 3: {type: 'line', targetAxisIndex: 1}}, height: 260, legend: {position: 'bottom'},
        vAxes: {0: {title: 'mm'}, 1: {title: '°C'}}})));
    var dryB = 0, dryR = 0, defB = 0, defR = 0;
    MAS.MONTHS.forEach(function (n, i) { var mm = pad2(i + 1);
      var tB = (M['mb' + mm + '_tmx'] + M['mb' + mm + '_tmn']) / 2, tR = (M['mr' + mm + '_tmx'] + M['mr' + mm + '_tmn']) / 2;
      if (M['mb' + mm + '_pr'] < 2 * tB) dryB++; if (M['mr' + mm + '_pr'] < 2 * tR) dryR++;
      if (M['mb' + mm + '_def'] > 10) defB++; if (M['mr' + mm + '_def'] > 10) defR++; });
    k3.add(MAS.cardLabel('Dry months (Gaussen: P < 2 x mean temperature): ' + dryB + ' in the baseline → ' + dryR + ' recently. ' +
      'Months with water deficit > 10 mm: ' + defB + ' → ' + defR + '.'));
    k3.add(MAS.mkChart(MAS.dataTable([['Month', 'string'], ['Deficit baseline (mm)', 'number'], ['Deficit recent (mm)', 'number']],
      MAS.MONTHS.map(function (n, i) { var mm = pad2(i + 1); return [n, MAS.round(M['mb' + mm + '_def'], 1), MAS.round(M['mr' + mm + '_def'], 1)]; })),
      'ColumnChart', MAS.themed({title: 'Monthly water deficit (mm)', colors: ['#fee391', '#cc4c02'], height: 200, legend: {position: 'bottom'}})));
    MAS.tabAdd(T, k3);
  }
  // ---- card 4: last 24 months (ERA5-Land) with the ONI
  var E = CL.E[s];
  if (E) {
    var ms = eraMonths(CL);
    var k4 = MAS.card('Last 24 months • ERA5-Land (~11 km), until ' + MAS.MONTHS[CL.eraLast.m - 1] + ' ' + CL.eraLast.y + ' • anomalies vs 1991-2020');
    var er = ms.map(function (o) { var mm = pad2(o.m), kk = 'e' + o.y + mm + '_';
      var tA = E[kk + 't'] - E['n' + mm + '_t'], pA = E['n' + mm + '_p'] > 0 ? 100 * (E[kk + 'p'] - E['n' + mm + '_p']) / E['n' + mm + '_p'] : NaN;
      return {lab: MAS.MONTHS[o.m - 1] + ' ' + String(o.y).slice(2), tA: tA, pA: pA, oni: oniAt(o.y, o.m - 1), t: E[kk + 't'], p: E[kk + 'p'], pn: E['n' + mm + '_p']}; });
    k4.add(MAS.mkChart(MAS.dataTable([['Month', 'string'], ['Temperature anomaly (°C)', 'number'], ['ONI (°C)', 'number']],
      er.map(function (o) { return [o.lab, MAS.round(o.tA, 2), o.oni]; })), 'ComboChart',
      MAS.themed({title: 'Temperature anomaly and ONI', seriesType: 'bars', colors: ['#e6550d', '#6a51a3'], series: {1: {type: 'line', targetAxisIndex: 1, pointSize: 3}},
        vAxes: {0: {title: '°C (local)'}, 1: {title: 'ONI'}}, height: 230, legend: {position: 'bottom'}, hAxis: {slantedText: true, slantedTextAngle: 60}})));
    k4.add(MAS.mkChart(MAS.dataTable([['Month', 'string'], ['Precipitation anomaly (%)', 'number']], er.map(function (o) { return [o.lab, MAS.round(o.pA, 1)]; })),
      'ColumnChart', MAS.themed({title: 'Precipitation anomaly (%)', colors: ['#3182bd'], height: 200, legend: {position: 'none'}, hAxis: {slantedText: true, slantedTextAngle: 60}})));
    var last12 = er.slice(-12);
    k4.add(MAS.cardLabel('Last 12 months: temperature ' + signed(meanOf(last12.map(function (o) { return o.tA; })), 2, '°C') + ', precipitation ' +
      signed(100 * (meanOf(last12.map(function (o) { return o.p; })) / meanOf(last12.map(function (o) { return o.pn; })) - 1), 0, '%') +
      ' vs 1991-2020. ' + ensoNow()));
    MAS.tabAdd(T, k4);
  }
  // ---- card 5: projections
  if (R.cfg.doCmip) {
    var k5 = MAS.card('Projections • NEX-GDDP-CMIP6 (~25 km), ' + MAS.CMIP_MODELS.length + ' models, change vs 1995-2014');
    var P = CL.P[s];
    if (!P) k5.add(MAS.cardLabel(CL.done ? 'Projections not available (requests failed).' : 'Loading the models (slowest part)...'));
    else {
      var ce = cmipEnsemble(CL, s), ens = ce.ens;
      k5.add(MAS.mkChart(MAS.dataTable([['Scenario', 'string'], ['Tmax change (°C)', 'number']], ens.map(function (e) { return [e[0], e[1]]; })), 'ColumnChart',
        MAS.themed({title: 'Ensemble mean change in maximum temperature (°C)', colors: ['#d7301f'], legend: {position: 'none'}, height: 200})));
      k5.add(MAS.mkChart(MAS.dataTable([['Scenario', 'string'], ['Precipitation change (%)', 'number']], ens.map(function (e) { return [e[0], e[4]]; })), 'ColumnChart',
        MAS.themed({title: 'Ensemble mean change in precipitation (%)', colors: ['#3182bd'], legend: {position: 'none'}, height: 200})));
      k5.add(MAS.tableChart([['Scenario', 'string'], ['ΔTmax mean °C', 'number'], ['min', 'number'], ['max', 'number'], ['ΔP mean %', 'number'], ['min', 'number'], ['max', 'number'], ['Models drier', 'string']], ens));
      k5.add(MAS.cardLabel('Each model is compared with its own 1995-2014 historical run (delta method), so model biases cancel. Means use days 1, 8, 15 and 22 of every month ' +
        '(a 13% sample of days, ~960 days per 20-year period): fine for temperature, approximate (± a few %) for precipitation. "Models drier" = models projecting less rain.'));
    }
    MAS.tabAdd(T, k5);
  }
  // ---- map + downloads
  if (F) {
    MAS.tabAdd(T, ui.Button({label: 'Show change in Tmax and precipitation on the map (' + CL.y0 + '-' + (CL.y0 + CL.n - 1) + ' vs ' + (CL.y1 - CL.n + 1) + '-' + CL.y1 + ')', onClick: function () {
      var a = tcColl().filterDate(CL.y0 + '-01-01', (CL.y0 + CL.n) + '-01-01'), b = tcColl().filterDate((CL.y1 - CL.n + 1) + '-01-01', (CL.y1 + 1) + '-01-01');
      var dT = b.select('tmmx').mean().subtract(a.select('tmmx').mean()).multiply(0.1);
      var dP = b.select('pr').mean().subtract(a.select('pr').mean()).divide(a.select('pr').mean()).multiply(100);
      var g = R.eooGeom || R.cellsGeom.buffer(20000);
      Map.addLayer(dP.clip(g), {min: -20, max: 20, palette: ['8c510a', 'd8b365', 'f6e8c3', 'f5f5f5', 'c7eae5', '5ab4ac', '01665e']}, 'Precipitation change (%)', false);
      Map.addLayer(dT.clip(g), {min: -1, max: 2, palette: ['2166ac', 'f7f7f7', 'fddbc7', 'ef8a62', 'b2182b']}, 'Tmax change (°C)');
    }}));
  }
  MAS.tabHead(T, 'Downloads');
  var dl = ui.Panel(); MAS.tabAdd(T, dl);
  if (nicheSummary(R)) MAS.dlLink(dl, 'Climatic niche exposure per cell (CSV)', MAS.rowsFC(MAS.NICHE_H, nicheRows(R)), 'csv', MAS.safeName(R.cfg.species) + '_climate_niche', MAS.colsOf(MAS.NICHE_H));
  var H = [['extent', 'string'], ['year', 'number']].concat(MAS.CL_VARS.map(function (k) { return [k, 'number']; }))
    .concat([['oni_mean', 'number'], ['enso_phase', 'string'], ['enso_strength', 'string']]);
  var rows2 = [];
  CL.scopes.forEach(function (sc) { var A2 = CL.A[sc] || {};
    Object.keys(A2).map(Number).sort().forEach(function (y) { var e = ensoOf(y);
      rows2.push([sc, y].concat(MAS.CL_VARS.map(function (k) { return MAS.round(A2[y][k], 3); })).concat([MAS.round(e.mean, 2), e.phase, e.strength || ''])); }); });
  MAS.dlLink(dl, 'Annual climate + ENSO (CSV)', MAS.rowsFC(H, rows2), 'csv', MAS.safeName(R.cfg.species) + '_climate_annual', MAS.colsOf(H));
  var Hm = [['extent', 'string'], ['month', 'number'], ['period', 'string'], ['pr_mm', 'number'], ['tmax_c', 'number'], ['tmin_c', 'number'], ['deficit_mm', 'number']];
  var rm = [];
  CL.scopes.forEach(function (sc) { var M2 = CL.M[sc]; if (!M2) return;
    MAS.MONTHS.forEach(function (n, i) { var mm = pad2(i + 1);
      [['mb', CL.b0 + '-' + CL.b1], ['mr', (CL.y1 - CL.n + 1) + '-' + CL.y1]].forEach(function (t) {
        rm.push([sc, i + 1, t[1], MAS.round(M2[t[0] + mm + '_pr'], 2), MAS.round(M2[t[0] + mm + '_tmx'], 2), MAS.round(M2[t[0] + mm + '_tmn'], 2), MAS.round(M2[t[0] + mm + '_def'], 2)]); }); }); });
  MAS.dlLink(dl, 'Monthly climatology (CSV)', MAS.rowsFC(Hm, rm), 'csv', MAS.safeName(R.cfg.species) + '_climate_monthly', MAS.colsOf(Hm));
  var He = [['extent', 'string'], ['year', 'number'], ['month', 'number'], ['t2m_c', 'number'], ['t2m_normal_c', 'number'], ['precip_mm', 'number'], ['precip_normal_mm', 'number'], ['oni', 'number']];
  var re = [];
  CL.scopes.forEach(function (sc) { var E2 = CL.E[sc]; if (!E2) return;
    eraMonths(CL).forEach(function (o) { var mm = pad2(o.m), kk = 'e' + o.y + mm + '_';
      re.push([sc, o.y, o.m, MAS.round(E2[kk + 't'], 2), MAS.round(E2['n' + mm + '_t'], 2), MAS.round(E2[kk + 'p'], 1), MAS.round(E2['n' + mm + '_p'], 1), oniAt(o.y, o.m - 1)]); }); });
  MAS.dlLink(dl, 'Last 24 months, ERA5-Land (CSV)', MAS.rowsFC(He, re), 'csv', MAS.safeName(R.cfg.species) + '_climate_recent', MAS.colsOf(He));
  (CL.scopes || []).forEach(function (sc) { cmipEnsemble(CL, sc); });
  if (CL.cmipRows) {
    var Hc = [['extent', 'string'], ['model', 'string'], ['scenario', 'string'], ['period', 'string'], ['dTmax_c', 'number'], ['dPrecip_pct', 'number']], rc = [];
    Object.keys(CL.cmipRows).forEach(function (sc) { CL.cmipRows[sc].forEach(function (r) { rc.push([sc].concat(r)); }); });
    MAS.dlLink(dl, 'CMIP6 projections per model (CSV)', MAS.rowsFC(Hc, rc), 'csv', MAS.safeName(R.cfg.species) + '_climate_cmip6', MAS.colsOf(Hc));
  }
  var Ho = [['year', 'number'], ['season', 'number'], ['oni', 'number'], ['phase', 'string']];
  MAS.dlLink(dl, 'ONI and ENSO phase per month (CSV)', MAS.rowsFC(Ho, MAS.ENSO.seq.filter(function (o) { return o.y >= CL.y0; }).map(function (o) {
    return [o.y, o.m + 1, o.v, o.ph === 1 ? 'El Niño' : o.ph === -1 ? 'La Niña' : 'Neutral']; })), 'csv', 'ONI_ENSO_monthly', MAS.colsOf(Ho));
}
// ensemble summary of the CMIP6 models for one extent (rows per model and the ensemble table); cached in CL.ens / CL.cmipRows
function cmipEnsemble(CL, s) {
  var P = CL.P[s];
  if (!P) return null;
  var pr = [], sum = {};
  Object.keys(P).forEach(function (mod) {
    var v = P[mod];
    MAS.CMIP_RUNS.slice(1).forEach(function (r) {
      var dT = v[r[0] + '_tx'] - v.hist_tx, dP = v.hist_pr > 0 ? 100 * (v[r[0] + '_pr'] - v.hist_pr) / v.hist_pr : NaN;
      pr.push([mod, r[1].toUpperCase(), r[2] + '-' + r[3], MAS.round(dT, 2), MAS.round(dP, 1)]);
      (sum[r[0]] = sum[r[0]] || {t: [], p: []}).t.push(dT); sum[r[0]].p.push(dP);
    });
  });
  var lab = {s245_mid: 'SSP2-4.5 2041-2060', s245_end: 'SSP2-4.5 2081-2100', s585_mid: 'SSP5-8.5 2041-2060', s585_end: 'SSP5-8.5 2081-2100'};
  var ens = Object.keys(lab).filter(function (k) { return sum[k]; }).map(function (k) {
    var t = sum[k].t.filter(isFinite), p = sum[k].p.filter(isFinite);
    return [lab[k], MAS.round(meanOf(t), 2), MAS.round(Math.min.apply(null, t), 2), MAS.round(Math.max.apply(null, t), 2),
      MAS.round(meanOf(p), 1), MAS.round(Math.min.apply(null, p), 1), MAS.round(Math.max.apply(null, p), 1), p.filter(function (x) { return x < 0; }).length + '/' + p.length];
  });
  CL.ens = CL.ens || {}; CL.ens[s] = ens; CL.cmipRows = CL.cmipRows || {}; CL.cmipRows[s] = pr;
  return {ens: ens, rows: pr};
}
function climateLines(R) {
  var CL = R.CL;
  if (!CL || !CL.done) return [];
  var out = [], nl = nicheLine(R);
  if (nl) out.push(nl);
  (CL.scopes || []).forEach(function (s) {
    cmipEnsemble(CL, s);
    var F = climFlags(CL, s);
    if (!F) return;
    out.push(s + ' climate ' + F.t.firstYears[0] + '→' + CL.y1 + ': Tmax ' + signed(F.t.delta, 1, '°C') + ', precipitation ' + signed(F.p.pct, 1, '%') +
      (F.d ? ', water deficit ' + signed(F.d.delta, 0, 'mm') : '') + ' -> ' + (F.stress ? 'CLIMATE STRESS' : 'no climate stress') +
      (CL.ens && CL.ens[s] && CL.ens[s].length ? '; projected ' + CL.ens[s][CL.ens[s].length > 2 ? 2 : 0][0] + ': Tmax ' + signed(CL.ens[s][CL.ens[s].length > 2 ? 2 : 0][1], 1, '°C') +
        ', precipitation ' + signed(CL.ens[s][CL.ens[s].length > 2 ? 2 : 0][4], 0, '%') : ''));
  });
  return out;
}
function nichePoints(R) {
  var cells = R.aoo.cells, step = Math.max(1, Math.ceil(cells.length / MAS.NICHE_MAXPTS));
  var out = [];
  for (var i = 0; i < cells.length; i += step) {
    var c = cells[i], sx = 0, sy = 0, n = c.ring.length - 1;
    for (var j = 0; j < n; j++) { sx += c.ring[j][0]; sy += c.ring[j][1]; }
    out.push(ee.Feature(ee.Geometry.Point([sx / n, sy / n]), {cell: i + 1}));
  }
  return ee.FeatureCollection(out);
}
function nicheImage(ys) {
  return ee.Image.cat(ys.map(function (y) {
    var c = tcColl().filterDate(y + '-01-01', (y + 1) + '-01-01'), p = 'n' + y + '_';
    return ee.Image.cat([c.select('tmmx').mean().multiply(0.1).rename(p + 't'), c.select('pr').sum().rename(p + 'p'),
      c.select('def').sum().multiply(0.1).rename(p + 'd')]);
  }));
}
function nicheJobs(R, CL) {
  var pts = nichePoints(R), jobs = [];
  CL.NI = {};
  for (var y = MAS.NICHE_B[0]; y <= CL.y1; y += 10) {
    (function (ys) {
      jobs.push({key: 'niche ' + ys[0] + '-' + ys[ys.length - 1], kind: 'niche', make: function (ts) {
        return ee.Dictionary({climKind: 'niche', v: MAS.fcToDicts(nicheImage(ys).reduceRegions({collection: pts, reducer: ee.Reducer.first(), scale: MAS.TC_SCALE, tileScale: ts}))});
      }});
    })(seq(y, Math.min(y + 9, CL.y1)));
  }
  return jobs;
}
function seq(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }
function nicheAdd(CL, v) {
  MAS.propsList(v).forEach(function (p) {
    var c = CL.NI[p.cell] = CL.NI[p.cell] || {};
    Object.keys(p).forEach(function (k) {
      var m = /^n(\d{4})_([tpd])$/.exec(k);
      if (!m || p[k] === null || !isFinite(p[k])) return;
      (c[m[1]] = c[m[1]] || {})[m[2]] = p[k];
    });
  });
}
function nicheSummary(R) {
  var CL = R.CL;
  if (!CL || !CL.done || !CL.NI) return null;
  if (CL.NS) return CL.NS;
  var ids = Object.keys(CL.NI);
  if (!ids.length) return null;
  var out = {cells: ids.length, base: MAS.NICHE_B, last: CL.y1, v: {}};
  MAS.NICHE_VARS.forEach(function (V) {
    var k = V[0], up = V[4] === 'upper', lim = up ? -Infinity : Infinity, cellMeans = [];
    ids.forEach(function (id) {
      var s = 0, n = 0;
      for (var y = MAS.NICHE_B[0]; y <= MAS.NICHE_B[1]; y++) {
        var x = CL.NI[id][y] && CL.NI[id][y][k];
        if (!isFinite(x)) continue;
        lim = up ? Math.max(lim, x) : Math.min(lim, x); s += x; n++;
      }
      if (n) cellMeans.push(s / n);
    });
    if (!isFinite(lim)) return;
    var rows = [], exp = 0, ongoing = 0, first = Infinity, margins = [];
    ids.forEach(function (id) {
      var run = 0, start = null, ex = null, last5 = [], beyond10 = 0;
      for (var y = MAS.NICHE_B[1] + 1; y <= CL.y1; y++) {
        var x = CL.NI[id][y] && CL.NI[id][y][k];
        if (!isFinite(x)) { run = 0; continue; }
        var out2 = up ? x > lim : x < lim;
        if (out2) { if (!run) start = y; run++; if (run >= MAS.NICHE_RUN && ex === null) ex = start; } else run = 0;
        if (y > CL.y1 - 5) last5.push(x);
        if (y > CL.y1 - 10 && out2) beyond10++;
      }
      var cur = meanOf(last5), margin = up ? lim - cur : cur - lim, isOn = ex !== null && run >= MAS.NICHE_RUN;
      if (ex !== null) { exp++; first = Math.min(first, ex); }
      if (isOn) ongoing++;
      if (isFinite(margin)) margins.push(margin);
      rows.push({cell: Number(id), current: cur, margin: margin, exposed: ex !== null, first: ex, ongoing: isOn, beyond10: beyond10});
    });
    var span = cellMeans.length ? Math.max.apply(null, cellMeans) - Math.min.apply(null, cellMeans) : NaN;
    out.v[k] = {name: V[1], unit: V[2], d: V[3], side: V[4], limit: lim, rows: rows, exposed: exp, pct: 100 * exp / ids.length, ongoing: ongoing,
      first: isFinite(first) ? first : null, minMargin: margins.length ? Math.min.apply(null, margins) : NaN, medMargin: MAS.quantile(margins, 0.5), span: span};
  });
  var t = out.v.t;
  out.truncated = ids.length < 5 || (t && t.span < 1);
  CL.NS = out;
  return out;
}
function nicheThreats(R) {
  var N = nicheSummary(R), out = [];
  if (!N) return out;
  var t = N.v.t, p = N.v.p, d = N.v.d, cav = N.truncated ? '; few cells or narrow thermal range: realised niche truncated, exposure may be overstated' : '';
  if (t && t.exposed) out.push({code: '11.3', name: MAS.THREAT['11.3'][0], v4: MAS.THREAT['11.3'][1], timing: t.ongoing ? 'Ongoing' : 'Past, likely to return',
    scope: MAS.scopeLabel(t.pct), severity: 'Unknown', stresses: ['1.2', '2.1'], basis: 'Climate tab (niche exposure)',
    evidence: t.exposed + ' of ' + N.cells + ' occupied cells (' + MAS.fmt(t.pct, 0) + '%) with annual mean Tmax above the species\' ' + N.base[0] + '-' + N.base[1] +
      ' maximum (' + MAS.fmt(t.limit, 1) + ' °C) for ≥ ' + MAS.NICHE_RUN + ' consecutive years since ' + t.first + cav});
  var dry = [p, d].filter(function (x) { return x && x.exposed; });
  if (dry.length) {
    var w = dry.sort(function (a, b) { return b.pct - a.pct; })[0];
    out.push({code: '11.2', name: MAS.THREAT['11.2'][0], v4: MAS.THREAT['11.2'][1], timing: w.ongoing ? 'Ongoing' : 'Past, likely to return',
      scope: MAS.scopeLabel(w.pct), severity: 'Unknown', stresses: ['1.2', '2.1'], basis: 'Climate tab (niche exposure)',
      evidence: dry.map(function (x) { return x.exposed + ' of ' + N.cells + ' cells with ' + x.name.toLowerCase() + (x.side === 'upper' ? ' above ' : ' below ') +
        'the species\' ' + N.base[0] + '-' + N.base[1] + ' limit (' + MAS.fmt(x.limit, 0) + ' mm) for ≥ ' + MAS.NICHE_RUN + ' consecutive years'; }).join('; ') + cav});
  }
  return out;
}
function nicheLine(R) {
  var N = nicheSummary(R);
  if (!N) return null;
  return 'Climatic niche (' + N.cells + ' cells, limits ' + N.base[0] + '-' + N.base[1] + '): ' + MAS.NICHE_VARS.map(function (V) {
    var x = N.v[V[0]]; return x ? x.name + ' beyond the limit in ' + MAS.fmt(x.pct, 0) + '% of cells' : null; }).filter(String).join(', ') +
    (N.truncated ? ' (realised niche truncated: exposure may be overstated)' : '');
}
function nicheCard(R) {
  var c = MAS.TC(), N = nicheSummary(R), k = MAS.card('Species climatic niche • exposure beyond its own limits');
  if (!N) { k.add(MAS.cardLabel(R.CL && R.CL.done ? 'Niche data not available (request failed).' : 'Loading the 1958-today series of every occupied cell...')); return k; }
  k.add(MAS.cardRow(MAS.NICHE_VARS.map(function (V) { var x = N.v[V[0]]; return x ? chip(x.name + ': ' + MAS.fmt(x.pct, 0) + '% of cells exposed', x.exposed > 0, c) : null; })
    .filter(function (w) { return w; })));
  k.add(MAS.cardLabel('Niche limit = most extreme annual value met in any of the ' + N.cells + ' occupied cells in ' + N.base[0] + '-' + N.base[1] +
    ' (upper limit for Tmax and deficit, lower limit for precipitation). A cell is exposed when it stays beyond the limit for ≥ ' + MAS.NICHE_RUN +
    ' consecutive years (Trisos, Merow & Pigot 2020, Nature 580: 496-501). Margin = limit minus the mean of the last 5 years (positive = still inside). ' +
    'Only exposure is coded as an IUCN threat (Red List tab); regional trends below are context. Exposure is not impact: confirm sensitivity of the species.'));
  if (N.truncated) k.add(MAS.cardLabel('Caution: ' + (N.cells < 5 ? 'only ' + N.cells + ' cells' : 'the occupied cells span only ' + MAS.fmt(N.v.t.span, 1) + ' °C') +
    ' - the realised niche is probably narrower than the tolerance of the species, so exposure is likely overstated. Treat as "suspected".', {color: '#ff8a65'}));
  k.add(MAS.tableChart([['Variable', 'string'], ['Limit (' + N.base[0] + '-' + N.base[1] + ')', 'number'], ['Smallest margin', 'number'], ['Median margin', 'number'],
    ['Cells exposed', 'number'], ['% cells', 'number'], ['First exposure', 'number'], ['Still beyond (ongoing)', 'number']],
    MAS.NICHE_VARS.filter(function (V) { return N.v[V[0]]; }).map(function (V) { var x = N.v[V[0]];
      return [x.name + ' (' + x.unit + ')', MAS.round(x.limit, x.d), MAS.round(x.minMargin, x.d + 1), MAS.round(x.medMargin, x.d + 1), x.exposed, MAS.round(x.pct, 1), x.first, x.ongoing]; })));
  var t = N.v.t;
  if (t) {
    var ys = seq(N.base[0], N.last), ids = Object.keys(R.CL.NI);
    var rows = ys.map(function (y) {
      var v = ids.map(function (id) { return R.CL.NI[id][y] && R.CL.NI[id][y].t; }).filter(isFinite);
      return [String(y), v.length ? MAS.round(Math.max.apply(null, v), 2) : null, v.length ? MAS.round(meanOf(v), 2) : null, MAS.round(t.limit, 2)];
    });
    k.add(MAS.mkChart(dtRoles([['Year', 'string'], ['Hottest cell', 'number'], ['Mean of cells', 'number'], ['Niche limit', 'number']], rows), 'LineChart',
      MAS.themed({colors: ['#d73027', '#fc8d59', '#9e9e9e'], height: 220, pointSize: 3, hAxis: {showTextEvery: 6}, vAxis: {title: '°C'},
        series: {2: {lineDashStyle: [6, 4], pointSize: 0}}, title: 'Annual mean Tmax in the occupied cells vs the species\' upper limit'})));
  }
  return k;
}
function nicheRows(R) {
  var N = nicheSummary(R), rows = [];
  if (!N) return rows;
  MAS.NICHE_VARS.forEach(function (V) { var x = N.v[V[0]]; if (!x) return;
    x.rows.forEach(function (r) { rows.push([r.cell, x.name, MAS.round(x.limit, 2), MAS.round(r.current, 2), MAS.round(r.margin, 2), r.exposed ? 'yes' : 'no', r.first, r.ongoing ? 'yes' : 'no', r.beyond10]); }); });
  return rows;
}
