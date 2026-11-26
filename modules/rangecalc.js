/**** mappingAS GEE 2.0.0 - module "rangecalc": range calculations
 * Section 5: AOO grids, EOO (minimum convex polygon), locations, subpopulations, Criterion B and trends.
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: -
 * Shared state created here: WGS84_A, WGS84_E2, WGS84_E, DEG
 ****/

// ============================================================================
// 5. MATH CORE (AOO, EOO, locations, subpopulations, Criterion B, trends) -
//    tested against pyproj/shapely/numpy: identical AOO, EOO within 0.01%
// ============================================================================
// ===================== CLIENT-SIDE MATH CORE (no ee calls) =====================
// Lambert Azimuthal Equal-Area projection (WGS84 ellipsoid; Snyder 1987, pp. 187-190)

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.laeaQ = laeaQ;
  MAS.laeaParams = laeaParams;
  MAS.laeaFwd = laeaFwd;
  MAS.laeaInv = laeaInv;
  MAS.dataCentre = dataCentre;
  MAS.aooGrid = aooGrid;
  MAS.convexHull = convexHull;
  MAS.gcInterp = gcInterp;
  MAS.densifyRing = densifyRing;
  MAS.eooAreaKm2 = eooAreaKm2;
  MAS.bSize = bSize;
  MAS.bRank = bRank;
  MAS.iucnB = iucnB;
  MAS.aooBounds = aooBounds;
  MAS.lnGamma = lnGamma;
  MAS.betacf = betacf;
  MAS.betai = betai;
  MAS.tTwoSidedP = tTwoSidedP;
  MAS.ols = ols;
  MAS.trendYears = trendYears;
  MAS.gcDistKm = gcDistKm;
  MAS.uniqueCoords = uniqueCoords;
  MAS.maxInterpointKm = maxInterpointKm;
  MAS.calcSubpop = calcSubpop;
  MAS.calcLocations = calcLocations;
  MAS.uniqArr = uniqArr;
  MAS.iucnCriterionB = iucnCriterionB;
  MAS.locCategory = locCategory;
  MAS.solve3 = solve3;
  MAS.fPvalue = fPvalue;
  MAS.fitModel = fitModel;
  MAS.utmToLonLat = utmToLonLat;
};

exports.run = function () {
  MAS.WGS84_A = 6378137.0;
  var WGS84_F = 1 / 298.257223563;
  MAS.WGS84_E2 = WGS84_F * (2 - WGS84_F);
  MAS.WGS84_E = Math.sqrt(MAS.WGS84_E2);
  MAS.DEG = Math.PI / 180;
};

function laeaQ(phi) {
  var s = Math.sin(phi);
  return (1 - MAS.WGS84_E2) * (s / (1 - MAS.WGS84_E2 * s * s) -
    (1 / (2 * MAS.WGS84_E)) * Math.log((1 - MAS.WGS84_E * s) / (1 + MAS.WGS84_E * s)));
}
function laeaParams(lat0, lon0) {
  var phi1 = lat0 * MAS.DEG;
  var qp = laeaQ(Math.PI / 2);
  var q1 = laeaQ(phi1);
  var beta1 = Math.asin(q1 / qp);
  var Rq = MAS.WGS84_A * Math.sqrt(qp / 2);
  var m1 = Math.cos(phi1) / Math.sqrt(1 - MAS.WGS84_E2 * Math.sin(phi1) * Math.sin(phi1));
  var D = MAS.WGS84_A * m1 / (Rq * Math.cos(beta1));
  return {lat0: lat0, lon0: lon0, qp: qp, beta1: beta1, Rq: Rq, D: D};
}
function laeaFwd(P, lon, lat) {
  var phi = lat * MAS.DEG;
  var dl = (lon - P.lon0) * MAS.DEG;
  var beta = Math.asin(laeaQ(phi) / P.qp);
  var B = P.Rq * Math.sqrt(2 / (1 + Math.sin(P.beta1) * Math.sin(beta) +
    Math.cos(P.beta1) * Math.cos(beta) * Math.cos(dl)));
  var x = B * P.D * Math.cos(beta) * Math.sin(dl);
  var y = (B / P.D) * (Math.cos(P.beta1) * Math.sin(beta) -
    Math.sin(P.beta1) * Math.cos(beta) * Math.cos(dl));
  return [x, y];
}
function laeaInv(P, x, y) {
  var rho = Math.sqrt(Math.pow(x / P.D, 2) + Math.pow(P.D * y, 2));
  if (rho < 1e-9) return [P.lon0, P.lat0];
  var ce = 2 * Math.asin(rho / (2 * P.Rq));
  var q = P.qp * (Math.cos(ce) * Math.sin(P.beta1) +
    (P.D * y * Math.sin(ce) * Math.cos(P.beta1)) / rho);
  var beta = Math.asin(Math.max(-1, Math.min(1, q / P.qp)));
  var e2 = MAS.WGS84_E2, e4 = e2 * e2, e6 = e4 * e2;
  var phi = beta + (e2 / 3 + 31 * e4 / 180 + 517 * e6 / 5040) * Math.sin(2 * beta) +
    (23 * e4 / 360 + 251 * e6 / 3780) * Math.sin(4 * beta) +
    (761 * e6 / 45360) * Math.sin(6 * beta);
  var lam = Math.atan2(x * Math.sin(ce),
    P.D * rho * Math.cos(P.beta1) * Math.cos(ce) -
    P.D * P.D * y * Math.sin(P.beta1) * Math.sin(ce));
  return [P.lon0 + lam / MAS.DEG, phi / MAS.DEG];
}
// Projection centre as in mappingAS::laea_crs(): mean latitude and circular
// mean longitude of ALL records (duplicates included).
function dataCentre(recs) {
  var ss = 0, cc = 0, la = 0;
  for (var i = 0; i < recs.length; i++) {
    ss += Math.sin(recs[i].lon * MAS.DEG); cc += Math.cos(recs[i].lon * MAS.DEG); la += recs[i].lat;
  }
  var lat0 = la / recs.length, lon0 = Math.atan2(ss / recs.length, cc / recs.length) / MAS.DEG;
  return {lat0: Math.round(lat0 * 1e6) / 1e6, lon0: Math.round(lon0 * 1e6) / 1e6};
}
// AOO: cellKm x cellKm grid in a data-centred LAEA; tries nRep shifted grids
// (deterministic Fibonacci lattice) and keeps the one with the fewest occupied
// cells - same rule as mappingAS / ConR.
function aooGrid(recs, cellKm, nRep, P) {
  var size = cellKm * 1000;
  var xy = [];
  for (var i = 0; i < recs.length; i++) xy.push(laeaFwd(P, recs[i].lon, recs[i].lat));
  var best = null;
  var n = Math.max(1, Math.floor(nRep));
  for (var h = 0; h < n; h++) {
    var ox = (h / n) * size;
    var oy = ((h * 0.6180339887498949) % 1) * size;
    var cells = {};
    var nc = 0;
    for (var j = 0; j < xy.length; j++) {
      var key = Math.floor((xy[j][0] - ox) / size) + '_' + Math.floor((xy[j][1] - oy) / size);
      if (!cells[key]) { cells[key] = []; nc++; }
      cells[key].push(j);
    }
    if (best === null || nc < best.n) best = {n: nc, ox: ox, oy: oy, cells: cells};
    if (nc === 1) break;
  }
  var out = [];
  for (var k in best.cells) {
    if (!best.cells.hasOwnProperty(k)) continue;
    var ij = k.split('_');
    var x0 = best.ox + Number(ij[0]) * size, y0 = best.oy + Number(ij[1]) * size;
    var corners = [[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size], [x0, y0]];
    var ring = [];
    for (var c = 0; c < corners.length; c++) ring.push(laeaInv(P, corners[c][0], corners[c][1]));
    var members = [];
    for (var m = 0; m < best.cells[k].length; m++) members.push(recs[best.cells[k][m]]);
    out.push({key: k, ring: ring, recs: members});
  }
  return {n: best.n, areaKm2: best.n * cellKm * cellKm, ox: best.ox, oy: best.oy, cells: out};
}
// Convex hull (monotone chain) in lon/lat, like grDevices::chull in mappingAS.
// Returns the closed ring, counter-clockwise.
function convexHull(points) {
  var seen = {}, p = [];
  for (var i = 0; i < points.length; i++) {
    var lo = Math.round(points[i][0] * 1e8) / 1e8, la = Math.round(points[i][1] * 1e8) / 1e8;
    var k = lo + ',' + la;
    if (!seen[k]) { seen[k] = true; p.push([lo, la]); }
  }
  var nUnique = p.length;
  if (nUnique < 3) return {ring: null, nUnique: nUnique, collinear: false};
  p.sort(function (a, b) { return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]; });
  function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  var lower = [], upper = [];
  for (var j = 0; j < p.length; j++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p[j]) <= 0) lower.pop();
    lower.push(p[j]);
  }
  for (var r = p.length - 1; r >= 0; r--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p[r]) <= 0) upper.pop();
    upper.push(p[r]);
  }
  upper.pop(); lower.pop();
  var hull = lower.concat(upper);
  if (hull.length < 3) return {ring: null, nUnique: nUnique, collinear: true};
  hull.push(hull[0]);
  return {ring: hull, nUnique: nUnique, collinear: false};
}
// EOO: area of the convex hull with edges densified along great circles
// (every segKm, like st_segmentize in mappingAS) and measured in the LAEA
// (equal-area projection: planar area = ellipsoidal area).
function gcInterp(a, b, f) {
  var la1 = a[1] * MAS.DEG, lo1 = a[0] * MAS.DEG, la2 = b[1] * MAS.DEG, lo2 = b[0] * MAS.DEG;
  var v1 = [Math.cos(la1) * Math.cos(lo1), Math.cos(la1) * Math.sin(lo1), Math.sin(la1)];
  var v2 = [Math.cos(la2) * Math.cos(lo2), Math.cos(la2) * Math.sin(lo2), Math.sin(la2)];
  var dot = Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  var om = Math.acos(dot);
  if (om < 1e-12) return [a[0], a[1]];
  var s1 = Math.sin((1 - f) * om) / Math.sin(om), s2 = Math.sin(f * om) / Math.sin(om);
  var v = [s1 * v1[0] + s2 * v2[0], s1 * v1[1] + s2 * v2[1], s1 * v1[2] + s2 * v2[2]];
  return [Math.atan2(v[1], v[0]) / MAS.DEG, Math.atan2(v[2], Math.sqrt(v[0] * v[0] + v[1] * v[1])) / MAS.DEG];
}
function densifyRing(ring, segKm) {
  var out = [];
  for (var i = 0; i < ring.length - 1; i++) {
    var a = ring[i], b = ring[i + 1];
    var m = gcInterp(a, b, 0.5);
    var la1 = a[1] * MAS.DEG, la2 = b[1] * MAS.DEG, dlo = (b[0] - a[0]) * MAS.DEG;
    var ang = Math.acos(Math.max(-1, Math.min(1, Math.sin(la1) * Math.sin(la2) +
      Math.cos(la1) * Math.cos(la2) * Math.cos(dlo))));
    var nseg = Math.max(1, Math.ceil(ang * 6371.0088 / segKm));
    for (var k = 0; k < nseg; k++) out.push(k === 0 ? a : gcInterp(a, b, k / nseg));
  }
  out.push(ring[ring.length - 1]);
  return out;
}
function eooAreaKm2(ring, segKm) {
  if (!ring) return NaN;
  var dens = densifyRing(ring, segKm);
  var pts = [];
  for (var i = 0; i < dens.length; i++) pts.push({lon: dens[i][0], lat: dens[i][1]});
  var c = dataCentre(pts), P = laeaParams(c.lat0, c.lon0);
  var A = 0, prev = laeaFwd(P, dens[0][0], dens[0][1]);
  for (var j = 1; j < dens.length; j++) {
    var cur = laeaFwd(P, dens[j][0], dens[j][1]);
    A += prev[0] * cur[1] - cur[0] * prev[1];
    prev = cur;
  }
  return Math.abs(A) / 2 / 1e6;
}
// Criterion B size thresholds (IUCN; strict "<", as in mappingAS)
function bSize(x, breaks) {
  if (x === null || x === undefined || isNaN(x)) return 'NA';
  var labs = ['CR', 'EN', 'VU', 'LC/NT'];
  var k = 0;
  for (var i = 0; i < breaks.length; i++) if (x >= breaks[i]) k++;
  return labs[k];
}
function bRank(c) { return {CR: 3, EN: 2, VU: 1}[c] || 0; }
function iucnB(eoo, aoo) {
  var e = eoo;
  if (isFinite(eoo) && isFinite(aoo) && eoo < aoo) e = aoo;  // IUCN Guidelines 4.10
  var cE = bSize(e, [100, 5000, 20000]);
  var cA = bSize(aoo, [10, 500, 2000]);
  var comb = (cA === 'NA' || (cE !== 'NA' && bRank(cE) >= bRank(cA))) ? cE : cA;
  return {eooAdj: e, b1: cE, b2: cA, combined: comb};
}
// Lower/upper AOO bounds (mappingAS::aoo_bounds; sRedList)
function aooBounds(lo, aoh, eoo) {
  var up = isFinite(aoh) ? aoh : lo;
  if (isFinite(up) && isFinite(lo)) up = Math.max(up, lo);
  if (isFinite(up) && isFinite(eoo)) up = Math.min(up, eoo);
  var cl = bSize(lo, [10, 500, 2000]), cu = bSize(up, [10, 500, 2000]);
  return {lower: lo, upper: up, catLower: cl, catUpper: cu,
          range: cl === cu ? cl : cl + '-' + cu};
}
// Linear regression + two-sided p-value (Student t)
function lnGamma(z) {
  var g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  var x = z, y = z, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  var ser = 1.000000000190015;
  for (var j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  var MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  var h = d;
  for (var m = 1; m <= MAXIT; m++) {
    var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    var del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  var bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return (x < (a + 1) / (a + b + 2)) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
function tTwoSidedP(t, df) { return betai(df / 2, 0.5, df / (df + t * t)); }
function ols(xs, ys) {
  var n = xs.length;
  if (n < 3) return null;
  var mx = 0, my = 0;
  for (var i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  var sxx = 0, sxy = 0, syy = 0;
  for (var j = 0; j < n; j++) {
    sxx += (xs[j] - mx) * (xs[j] - mx);
    sxy += (xs[j] - mx) * (ys[j] - my);
    syy += (ys[j] - my) * (ys[j] - my);
  }
  if (sxx === 0) return null;
  var b = sxy / sxx, a = my - b * mx;
  if (syy === 0) return {slope: 0, intercept: a, r2: 0, p: 1, mean: my};
  var sse = Math.max(0, syy - b * sxy);
  var r2 = 1 - sse / syy;
  var se = Math.sqrt(sse / (n - 2) / sxx);
  var p = se === 0 ? 0 : tTwoSidedP(b / se, n - 2);
  return {slope: b, intercept: a, r2: r2, p: p, mean: my};
}
// Years used in the continuing-decline test (mappingAS:::.habitat_trend)
function trendYears(available, endYear, span, n) {
  var minY = Math.min.apply(null, available);
  var start = Math.max(minY, endYear - span);
  var out = [];
  for (var i = 0; i < n; i++) {
    var y = Math.round(start + (endYear - start) * (n === 1 ? 1 : i / (n - 1)));
    if (out.indexOf(y) < 0 && available.indexOf(y) >= 0) out.push(y);
  }
  return out;
}
// Great-circle distance (km) on the mean-radius sphere
function gcDistKm(a, b) {
  var la1 = a[1] * MAS.DEG, la2 = b[1] * MAS.DEG, dla = la2 - la1, dlo = (b[0] - a[0]) * MAS.DEG;
  var h = Math.sin(dla / 2) * Math.sin(dla / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function uniqueCoords(recs) {
  var seen = {}, out = [];
  for (var i = 0; i < recs.length; i++) {
    var lo = Math.round(recs[i].lon * 1e8) / 1e8, la = Math.round(recs[i].lat * 1e8) / 1e8, k = lo + ',' + la;
    if (!seen[k]) { seen[k] = true; out.push([lo, la]); }
  }
  return out;
}
// Maximum distance between occurrences (over hull vertices), as in mappingAS
function maxInterpointKm(co) {
  if (co.length < 2) return NaN;
  var h = co.length >= 3 ? convexHull(co) : null;
  var v = h && h.ring ? h.ring.slice(0, h.ring.length - 1) : co;
  var m = 0;
  for (var i = 0; i < v.length; i++) for (var j = i + 1; j < v.length; j++) m = Math.max(m, gcDistKm(v[i], v[j]));
  return m;
}
// Subpopulations: circular-buffer method (Rivers et al. 2010), radius = 1/10 of
// the maximum inter-point distance unless given; buffers that overlap merge.
function calcSubpop(recs, radiusKm) {
  var co = uniqueCoords(recs);
  if (co.length === 0) return {n: NaN, radiusKm: NaN, nUnique: 0};
  if (co.length === 1) return {n: 1, radiusKm: radiusKm || NaN, nUnique: 1};
  var r = isFinite(radiusKm) && radiusKm > 0 ? radiusKm : maxInterpointKm(co) / 10;
  var parent = [];
  for (var i = 0; i < co.length; i++) parent.push(i);
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  for (var a = 0; a < co.length; a++) {
    for (var b = a + 1; b < co.length; b++) {
      if (gcDistKm(co[a], co[b]) <= 2 * r) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    }
  }
  var roots = {}, n = 0;
  for (var k = 0; k < co.length; k++) { var rt = find(k); if (!roots[rt]) { roots[rt] = true; n++; } }
  return {n: n, radiusKm: r, nUnique: co.length};
}
// Number of locations (mappingAS::calc_locations).
//   gridKm grid, minimum of nRep shifted grids, data-centred LAEA.
//   paHits (optional): for each record, the list of protected-area ids containing it.
//   method 'ONE_PER_PA' : each protected area with >= 1 record is one location
//                         (smallest covering set); records outside are gridded.
//   method 'GRID_SPLIT' : records inside and outside protected areas gridded separately.
function calcLocations(recs, gridKm, nRep, paHits, method) {
  function gridN(sub) {
    if (!sub.length) return {n: 0, cells: []};
    var c = dataCentre(sub);
    return aooGrid(sub, gridKm, nRep, laeaParams(c.lat0, c.lon0));
  }
  if (!paHits) {
    var g = gridN(recs);
    return {n: g.n, method: 'grid', gridKm: gridKm, nOut: g.n, nIn: null, cells: g.cells};
  }
  var inside = [], outside = [], hits = [];
  recs.forEach(function (r, i) {
    var h = paHits[i] || [];
    if (h.length) { inside.push(r); hits.push(h); } else outside.push(r);
  });
  var gOut = gridN(outside);
  var nIn = 0, cellsIn = [], paIds = [];
  if (inside.length) {
    if (method === 'GRID_SPLIT') {
      var gIn = gridN(inside); nIn = gIn.n; cellsIn = gIn.cells;
    } else {
      var rest = hits.slice();
      while (rest.length) {   // greedy smallest cover: most-hit protected area first
        var cnt = {}, best = null;
        rest.forEach(function (h) { uniqArr(h).forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; }); });
        for (var id in cnt) if (cnt.hasOwnProperty(id) && (best === null || cnt[id] > cnt[best])) best = id;
        paIds.push(best);
        rest = rest.filter(function (h) { return h.map(String).indexOf(String(best)) < 0; });
      }
      nIn = paIds.length;
    }
  }
  return {n: gOut.n + nIn, method: method === 'GRID_SPLIT' ? 'grid inside/outside PAs' : 'one location per PA',
          gridKm: gridKm, nOut: gOut.n, nIn: nIn, cells: gOut.cells.concat(cellsIn), paIds: paIds};
}
function uniqArr(a) { var o = [], s = {}; for (var i = 0; i < a.length; i++) { var k = String(a[i]); if (!s[k]) { s[k] = true; o.push(a[i]); } } return o; }
// IUCN Criterion B with sub-criteria (mappingAS::iucn_criterion_B).
// b = continuing decline (true/false), c = extreme fluctuation, frag = severely fragmented.
function iucnCriterionB(eoo, aoo, nLoc, frag, b, c, declineDetail) {
  var levels = [['CR', 100, 10, 1], ['EN', 5000, 500, 5], ['VU', 20000, 2000, 10]];
  var e = (isFinite(eoo) && isFinite(aoo) && eoo < aoo) ? aoo : eoo;
  for (var i = 0; i < levels.length; i++) {
    var lv = levels[i];
    var s1 = isFinite(e) && e < lv[1], s2 = isFinite(aoo) && aoo < lv[2];
    if (!s1 && !s2) continue;
    var a = !!frag || (isFinite(nLoc) && nLoc <= lv[3]);
    if ((a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0) >= 2) {
      var lett = (a ? 'a' : '') + (b ? 'b' + (declineDetail ? '(' + declineDetail + ')' : '') : '') + (c ? 'c' : '');
      var axes = [];
      if (s1) axes.push('1' + lett);
      if (s2) axes.push('2' + lett);
      return {category: lv[0], code: lv[0] + ' B' + axes.join('+'), a: a, b: !!b, c: !!c};
    }
  }
  var aVU = !!frag || (isFinite(nLoc) && nLoc <= 10);
  if ((isFinite(e) && e < 20000) || (isFinite(aoo) && aoo < 2000)) {
    return {category: 'NT', code: 'NT (meets B size only)', a: aVU, b: !!b, c: !!c};
  }
  if (!isFinite(e) && !isFinite(aoo)) return {category: 'NA', code: 'NA', a: aVU, b: !!b, c: !!c};
  return {category: 'LC', code: 'LC', a: aVU, b: !!b, c: !!c};
}
function locCategory(n) {
  if (!isFinite(n)) return 'NA';
  return n <= 1 ? 'CR' : n <= 5 ? 'EN' : n <= 10 ? 'VU' : '> 10 (not threatened)';
}
// ---------------- regression models for the time-series trend (basicTrendline names)
function solve3(A, y) {   // Gaussian elimination, small dense system
  var n = y.length, M = [];
  for (var i = 0; i < n; i++) M.push(A[i].concat([y[i]]));
  for (var c = 0; c < n; c++) {
    var p = c;
    for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    var t = M[c]; M[c] = M[p]; M[p] = t;
    if (Math.abs(M[c][c]) < 1e-14) return null;
    for (var r2 = 0; r2 < n; r2++) {
      if (r2 === c) continue;
      var f = M[r2][c] / M[c][c];
      for (var k = c; k <= n; k++) M[r2][k] -= f * M[c][k];
    }
  }
  var out = [];
  for (var q = 0; q < n; q++) out.push(M[q][n] / M[q][q]);
  return out;
}
function fPvalue(F, d1, d2) { if (!isFinite(F) || F <= 0) return 1; return betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F)); }
// x = years; models use t = year - firstYear + 1 so that log/power are defined.
function fitModel(years, ys, model) {
  var pts = [];
  for (var i = 0; i < years.length; i++) if (isFinite(ys[i])) pts.push([years[i], ys[i]]);
  if (pts.length < 3) return null;
  var y0 = pts[0][0];
  var t = pts.map(function (p) { return p[0] - y0 + 1; }), y = pts.map(function (p) { return p[1]; });
  var n = y.length, my = 0;
  y.forEach(function (v) { my += v; }); my /= n;
  var sst = 0; y.forEach(function (v) { sst += (v - my) * (v - my); });
  var pred, eq, p, params;
  if (model === 'line3P') {
    var s = [0, 0, 0, 0, 0], sy = [0, 0, 0];
    for (var j = 0; j < n; j++) {
      for (var k = 0; k <= 4; k++) s[k] += Math.pow(t[j], k);
      for (var m = 0; m <= 2; m++) sy[m] += y[j] * Math.pow(t[j], m);
    }
    var c = solve3([[s[0], s[1], s[2]], [s[1], s[2], s[3]], [s[2], s[3], s[4]]], sy);
    if (!c || n < 4) return null;
    pred = function (tt) { return c[0] + c[1] * tt + c[2] * tt * tt; };
    eq = 'y = ' + c[2].toPrecision(4) + ' t² + ' + c[1].toPrecision(4) + ' t + ' + c[0].toPrecision(4);
    var sse3 = 0; for (var q = 0; q < n; q++) sse3 += Math.pow(y[q] - pred(t[q]), 2);
    p = sst > 0 ? fPvalue(((sst - sse3) / 2) / (sse3 / (n - 3)), 2, n - 3) : 1;
    params = c;
  } else {
    var X, Y, back;
    if (model === 'log2P') { X = t.map(Math.log); Y = y; back = 'lin'; }
    else if (model === 'exp2P') { if (y.some(function (v) { return v <= 0; })) return null; X = t; Y = y.map(Math.log); back = 'exp'; }
    else if (model === 'power2P') { if (y.some(function (v) { return v <= 0; })) return null; X = t.map(Math.log); Y = y.map(Math.log); back = 'exp'; }
    else { X = t; Y = y; back = 'lin'; }
    var f = ols(X, Y);
    if (!f) return null;
    var a = f.intercept, b = f.slope;
    if (model === 'log2P') { pred = function (tt) { return a + b * Math.log(tt); }; eq = 'y = ' + b.toPrecision(4) + ' ln(t) + ' + a.toPrecision(4); }
    else if (model === 'exp2P') { pred = function (tt) { return Math.exp(a) * Math.exp(b * tt); }; eq = 'y = ' + Math.exp(a).toPrecision(4) + ' e^(' + b.toPrecision(4) + ' t)'; }
    else if (model === 'power2P') { pred = function (tt) { return Math.exp(a) * Math.pow(tt, b); }; eq = 'y = ' + Math.exp(a).toPrecision(4) + ' t^' + b.toPrecision(4); }
    else { pred = function (tt) { return a + b * tt; }; eq = 'y = ' + b.toPrecision(4) + ' t + ' + a.toPrecision(4); }
    p = f.p;
    params = [a, b];
  }
  var sse = 0;
  for (var z = 0; z < n; z++) sse += Math.pow(y[z] - pred(t[z]), 2);
  return {model: model, equation: eq + '   (t = year - ' + (y0 - 1) + ')', r2: sst > 0 ? 1 - sse / sst : 0, p: p,
          predict: function (year) { return pred(year - y0 + 1); }, params: params};
}
// UTM (WGS84) -> lon/lat (Snyder / USGS series)
function utmToLonLat(easting, northing, zone, south) {
  var a = MAS.WGS84_A, e2 = MAS.WGS84_E2, k0 = 0.9996;
  var ep2 = e2 / (1 - e2);
  var x = easting - 500000, y = south ? northing - 10000000 : northing;
  var lon0 = ((zone - 1) * 6 - 180 + 3) * MAS.DEG;
  var M = y / k0;
  var mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
  var e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  var phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) +
    (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) +
    (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu) + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
  var C1 = ep2 * Math.pow(Math.cos(phi1), 2), T1 = Math.pow(Math.tan(phi1), 2);
  var N1 = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(phi1), 2));
  var R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.pow(Math.sin(phi1), 2), 1.5);
  var D = x / (N1 * k0);
  var lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24 +
    (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);
  var lon = lon0 + (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 +
    (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(phi1);
  return [lon / MAS.DEG, lat / MAS.DEG];
}
