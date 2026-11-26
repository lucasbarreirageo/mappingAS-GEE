/**** mappingAS GEE 2.0.0 - module "config": defaults, built-in example, legends, land-cover products and IUCN reference tables
 * Sections 1-4 and 22: default settings, the Prepusa example records, MapBiomas/Esri legends,
 * the land-cover products per country and the IUCN tables (categories, habitats, threats, stresses, actions).
 * Loaded by the main script (app): define() registers the functions of this module in the shared namespace MAS,
 * run() executes its statements (interface widgets, tables, state) after every module has been defined, in the
 * original order of the app. Functions of other modules and shared state are reached as MAS.name.
 * Uses: -
 * Shared state created here: DEFAULTS, AOO_N_GRIDS, EOO_SEGMENT_KM, CHART_MAX_PIXELS, EXPORT_MAX_PIXELS, TREND_SPAN, TREND_N, TREND_ALPHA, EXPORT_FOLDER, EXAMPLE_NAME, EXAMPLE_COLUMNS, EXAMPLE_ROWS, LEGEND, GROUPS, GROUP_LABEL, GROUP_COLOR, MB_SOURCES, ESRI_ID, ESRI_YEARS_TRY, COUNTRY_ALIASES, IUCN_COLORS, IUCN_CAT_NAME, THREATENED, THR, PRESENCE, ORIGIN, SEASONAL, PLANT_FORMS, HAB, THREAT, STRESS, CONS_ACTION, RESEARCH, USE_TRADE, SUIT_PRESETS
 ****/

// ============================================================================
// 1. DEFAULTS
// ============================================================================

var MAS = null;   // shared namespace, set by define()

exports.define = function (ns) {
  MAS = ns;
  MAS.isThreatened = isThreatened;
  MAS.habitatCodeFor = habitatCodeFor;
  MAS.threatCodeFor = threatCodeFor;
};

exports.run = function () {
  MAS.DEFAULTS = {
    asset: '',                  // e.g. 'projects/my-project/assets/occurrences'
    product: 'AUTO',            // 'AUTO', 'MAPBIOMAS', 'ESRI'
    strategy: 'NATIONAL_FIRST', // 'NATIONAL_FIRST' or 'REGIONAL_FIRST'
    countryMode: 'DECLARED',    // 'DECLARED' or 'COORDINATES'
    wdpa: 'MAPPINGAS',          // 'MAPPINGAS', 'PROTECTED_PLANET', 'TERRESTRIAL', 'NONE'
    locMethod: 'ONE_PER_PA',    // 'ONE_PER_PA' or 'GRID_SPLIT'
    aooKm: 2,
    locKm: 10,
    scaleEoo: 'auto'
  };
  MAS.AOO_N_GRIDS = 100;
  MAS.EOO_SEGMENT_KM = 20;
  MAS.CHART_MAX_PIXELS = 4e6;
     // target pixels per year in the EOO (in-app results)
  MAS.EXPORT_MAX_PIXELS = 5e8;
    // target pixels per year in the EOO (export tasks)
  var DEFAULT_TS_STEP = 5;
  MAS.TREND_SPAN = 10;
  MAS.TREND_N = 6;
  MAS.TREND_ALPHA = 0.05;
  MAS.EXPORT_FOLDER = 'mappingAS_GEE';
  // ============================================================================
  // 2. BUILT-IN EXAMPLE: TESTE2.geojson - Prepusa connata (5) and Prepusa hookeriana (21), GBIF records
  //    (the 3 Worsleya procera rows of the file are not included; id = row number below)
  // ============================================================================
  MAS.EXAMPLE_NAME = 'Prepusa connata and P. hookeriana (TESTE2.geojson)';
  MAS.EXAMPLE_COLUMNS = ['scientificName', 'decimalLongitude', 'decimalLatitude', 'country', 'recordedBy', 'recordNumber', 'year', 'locality', 'catalogNumber', 'georeferenceSources'];
  MAS.EXAMPLE_ROWS = [
    ['Prepusa connata Gardner', -43.269167, -22.416111, 'Brazil', 'Adriana Charnaux', '1', '2023', 'Morro do Cuca.  Vale das Videiras. Monumento Natural Estadual da Serra da Maria Comprida. ', 'RB01502190', ''],
    ['Prepusa connata Gardner', -43.265, -22.415, 'Brazil', 'G. Martinelli', '16216', '2008', 'Município de Petrópolis, entre Araras e Vale das Videiras, Morro do Cuca, vertente NE. APA', 'RB00555578', ''],
    ['Prepusa connata Gardner', -42.5, -22.0, 'Brazil', 'G. Martinelli', '240', '1974', 'Rio de Janeiro', 'V0257791F', 'TGN - Centroid'],
    ['Prepusa connata Gardner', -42.64735, -22.531489, 'Brazil', 'Hb Gardner', '541', '', '', 'BM000812138', 'Google Earth'],
    ['Prepusa connata Gardner', -43.155278, -22.245278, 'Brazil', 'Martinelli, G', '16216', '2008', 'APA da Região Serrana de Petrópolis', 'SPF00190656', ''],
    ['Prepusa hookeriana Gardner', -43.02779, -22.45943, 'Brazil', 'Almeda, F.; Martins, A. B.; Fritsch, P. W.; Aranha Filho, J. L.M.; Bush, C.; Belinello, R.', '9776', '2009', 'Municipio Teresópolis. Parque Nacional da Serra dos Orgãos. Trail to Pedra do Sino.', '410655', ''],
    ['Prepusa hookeriana Gardner', -42.760556, -22.354167, 'Brazil', 'Baez, C;Lima, T.,Fernandez, E.,Baez, C.,Lima, T,Fernandez, E', '224', '2015', 'Proteção Integral. Parque Estadual dos Três Picos. Trilha para o cume da Branca de Neve.', 'MBM410266', ''],
    ['Prepusa hookeriana Gardner', -43.035278, -22.4625, 'Brazil', 'Brotto, M.L.; Völtz, R.R.', '5551', '2023', 'Parque Nacional da Serra dos Órgãos. trilha para a Pedra da Baleia.', '444572', ''],
    ['Prepusa hookeriana Gardner', -42.725833, -22.342778, 'Brazil', 'C. Baez', '271', '2015', 'Parque Estadual dos Três Picos. Cume Pico Médio. Proteção Integral', '02707646', ''],
    ['Prepusa hookeriana Gardner', -42.724722, -22.343611, 'Brazil', 'C. Baez; C. Vianna, G. Tisi', '96', '2014', 'Parque Estadual dos Três Picos. Cume Pico Menor. Proteção Integral', 'RB00932030', ''],
    ['Prepusa hookeriana Gardner', -43.031111, -22.461944, 'Brazil', 'C. Baez; T. Lima, E. Fernandez', '318', '2014', 'Parque Nacional da Serra dos Órgãos. Pedra do Sino. PARNASO', 'RB01057574', ''],
    ['Prepusa hookeriana Gardner', -43.1784661, -22.5088535, 'Brazil', 'C. Farney', '795', '1985', 'Correias, Picada pra o Açú, Campos de Altitude em direçao ao Morro da Bandeira', '644251', 'Other source'],
    ['Prepusa hookeriana Gardner', -43.000278, -22.270556, 'Brazil', 'Costa, CB', '508', '2001', 'Parque Nacional da Serra dos Órgãos', 'SPF00162077', ''],
    ['Prepusa hookeriana Gardner', -43.001111, -22.451667, 'Brazil', 'Costa, CB; et al.', '508', '2001', 'Parque Nacional da Serra dos Órgãos, trilha para a Pedra do Sino', '348998', ''],
    ['Prepusa hookeriana Gardner', -42.5, -22.0, 'Brazil', 'G. Gardner', '5823', '', 'Rio de Janeiro', 'V0257788F', 'TGN - Centroid'],
    ['Prepusa hookeriana Gardner', -43.028192, -22.460042, 'Brazil', 'Gonzatti, F; Abreu, FP', '9308', '2026', 'Parque Nacional da Serra dos Órgãos, Trilha para a Pedra do Sino, da barragem até o Abrigo', '61624', ''],
    ['Prepusa hookeriana Gardner', -42.64735, -22.531489, 'Brazil', 'Hb Gardner', '5823', '', '', 'BM000812137', 'Google Earth'],
    ['Prepusa hookeriana Gardner', -42.9657513, -22.4160522, 'Brazil', 'J. E. Simonis', '26', '1983', 'Serra dos Orgaos, Teresópolis, Campo das Antas', '644253', 'Other source'],
    ['Prepusa hookeriana Gardner', -43.01, -22.486667, 'Brazil', 'L.N.Gonçalves & P.Duffles', '1060', '2021', 'Parque Nacional Serra dos Orgãos.', '58149', ''],
    ['Prepusa hookeriana Gardner', -42.995278, -22.425556, 'Brazil', 'Lombardi, J.A.', '8227', '2011', 'Parque Nacional da Serra dos Órgãos, trilha para o Alojamento 04 e a Pedra do Sino.', '75645', ''],
    ['Prepusa hookeriana Gardner', -43.033611, -22.461389, 'Brazil', 'M. Nadruz ; D. Costa, A. Alves & C. Cronemberg', '1735', '2007', 'Trilha da Travessia, no caminho da pedra da Pipoca.', 'RB00473019', ''],
    ['Prepusa hookeriana Gardner', -43.035611, -22.466167, 'Brazil', 'Matsumoto, K; Gonçalves, APS; Belinello, R', '790', '2002', 'Serra dos Orgãos. Trilha da Pedra do Sino.', '157811', ''],
    ['Prepusa hookeriana Gardner', -43.02, -22.274167, 'Brazil', 'Nadruz, MA', '1735', '2007', '', 'SPF00196894', ''],
    ['Prepusa hookeriana Gardner', -43.016667, -22.45, 'Brazil', 'P. B. Schwartsburd; J. B. S. Pereira', '2314', '2011', 'Parque Nacional da Serra dos Órgãos. Próximo à Pedra do Sino.', 'RB00803845', ''],
    ['Prepusa hookeriana Gardner', -43.073169, -22.496706, 'Brazil', 'P. von Luetzelburg', 's.n.', '1910', 'Serra dos Orgaos', '644254', 'Georeferencing Quick Reference Guide, Version 2012'],
    ['Prepusa hookeriana Gardner', -42.725278, -22.344167, 'Brazil', 'Völtz, R.R.; Brotto, M.L.', '2960', '2023', 'Parque Estadual dos Três Picos. Trilha para o Pico Menor.', '446519', '']
  ];
  // ============================================================================
  // 3. LEGENDS (mappingAS standardised MapBiomas legend + Esri/Impact Observatory
  //    9-class legend; Esri codes are stored as 100 + code to keep them unique)
  //    [code, class, colour, group]
  //    natural = remaining habitat; anthropic = converted habitat; water, other and
  //    not_observed stay out of the conversion denominator.
  // ============================================================================
  var LEGEND_MB = [
    [1, 'Forest', '#1f8d49', 'natural'],
    [3, 'Forest Formation', '#1f8d49', 'natural'],
    [4, 'Savanna Formation', '#7dc975', 'natural'],
    [5, 'Mangrove', '#04381d', 'natural'],
    [6, 'Floodable Forest', '#007785', 'natural'],
    [49, 'Wooded Sandbank Vegetation', '#02d659', 'natural'],
    [59, 'Primary Forest', '#1f8d49', 'natural'],
    [60, 'Secondary Forest', '#5cb85d', 'natural'],
    [67, 'Dwarf Forest', '#c8ffb4', 'natural'],
    [10, 'Herbaceous and Shrubby Vegetation', '#d6bc74', 'natural'],
    [11, 'Wetland', '#519799', 'natural'],
    [12, 'Grassland', '#d6bc74', 'natural'],
    [32, 'Hypersaline Tidal Flat', '#fc8114', 'natural'],
    [29, 'Rocky Outcrop', '#ffaa5f', 'natural'],
    [50, 'Herbaceous Sandbank Vegetation', '#ad5100', 'natural'],
    [13, 'Other Non Forest Formation', '#d89f5c', 'natural'],
    [23, 'Beach, Dune and Sand Spot', '#ffa07a', 'natural'],
    [81, 'Andinean Herbaceous and Shrubby Vegetation', '#dfeb62', 'natural'],
    [82, 'Flooded Andinean Herbaceous and Shrubby Vegetation', '#6fc179', 'natural'],
    [66, 'Scrubland', '#a89358', 'natural'],
    [77, 'Open Shrublands', '#86b074', 'natural'],
    [63, 'Steppe', '#c7e0ab', 'natural'],
    [70, 'Fog Oasis', '#be9e00', 'natural'],
    [73, 'Peatlands', '#6fc179', 'natural'],
    [14, 'Farming', '#ffefc3', 'anthropic'],
    [9, 'Forest Plantation', '#7a5900', 'anthropic'],
    [15, 'Pasture', '#edde8e', 'anthropic'],
    [18, 'Agriculture', '#E974ED', 'anthropic'],
    [19, 'Temporary Crop', '#C27BA0', 'anthropic'],
    [39, 'Soybean', '#f5b3c8', 'anthropic'],
    [20, 'Sugar cane', '#db7093', 'anthropic'],
    [40, 'Rice', '#c71585', 'anthropic'],
    [62, 'Cotton (beta)', '#ff69b4', 'anthropic'],
    [41, 'Other Temporary Crops', '#f54ca9', 'anthropic'],
    [36, 'Perennial Crop', '#d082de', 'anthropic'],
    [46, 'Coffee', '#d68fe2', 'anthropic'],
    [47, 'Citrus', '#9932cc', 'anthropic'],
    [35, 'Palm Oil', '#9065d0', 'anthropic'],
    [48, 'Other Perennial Crops', '#e6ccff', 'anthropic'],
    [21, 'Mosaic of Uses', '#ffefc3', 'anthropic'],
    [74, 'Banana (beta)', '#be83f7', 'anthropic'],
    [72, 'Other Crops', '#910046', 'anthropic'],
    [79, 'Pinus Plantation', '#67671c', 'anthropic'],
    [80, 'Eucalyptus Plantation', '#886827', 'anthropic'],
    [83, 'Other Types of Forest Plantation', '#ab8231', 'anthropic'],
    [24, 'Urban Area', '#d4271e', 'anthropic'],
    [30, 'Mining', '#9c0027', 'anthropic'],
    [75, 'Photovoltaic Power Plant (beta)', '#c12100', 'anthropic'],
    [31, 'Aquaculture', '#091077', 'anthropic'],
    [22, 'Non Vegetated Area', '#d4271e', 'other'],
    [25, 'Other non Vegetated Areas', '#db4d4f', 'other'],
    [68, 'Other Natural Non-Vegetated Area', '#e97a7a', 'other'],
    [61, 'Salt Flat', '#f5d5d5', 'other'],
    [26, 'Water', '#2532e4', 'water'],
    [33, 'River, Lake and Ocean', '#2532e4', 'water'],
    [34, 'Glacier', '#93dfe6', 'water'],
    [69, 'Coral Reef', '#0fffe3', 'water'],
    [27, 'Not Observed', '#ffffff', 'not_observed']
  ];
  var LEGEND_ESRI = [
    [101, 'Water (Esri)', '#1A5BAB', 'water'],
    [102, 'Trees (Esri)', '#358221', 'natural'],
    [104, 'Flooded Vegetation (Esri)', '#87D19E', 'natural'],
    [105, 'Crops (Esri)', '#FFDB5C', 'anthropic'],
    [107, 'Built Area (Esri)', '#ED022A', 'anthropic'],
    [108, 'Bare Ground (Esri)', '#EDE9E4', 'other'],
    [109, 'Snow/Ice (Esri)', '#F2FAFF', 'other'],
    [110, 'Clouds (Esri)', '#C8C8C8', 'not_observed'],
    [111, 'Rangeland (Esri)', '#C6AD8D', 'natural']
  ];
  MAS.LEGEND = LEGEND_MB.concat(LEGEND_ESRI);
  MAS.GROUPS = ['natural', 'anthropic', 'water', 'other', 'not_observed'];
  MAS.GROUP_LABEL = {natural: 'Natural', anthropic: 'Anthropic (converted)', water: 'Water', other: 'Other',
                     not_observed: 'Not observed'};
  MAS.GROUP_COLOR = {natural: '#1f8d49', anthropic: '#e8a33d', water: '#2532e4', other: '#9e9e9e', not_observed: '#dddddd'};
  // ============================================================================
  // 4. LAND-COVER PRODUCTS
  //    MapBiomas: official list of the MapBiomas user-toolkit (data/collections-lulc.js);
  //    each image has bands classification_YYYY; ids are tried in order.
  //    Sentinel-2: Esri / Impact Observatory 10 m annual LULC (awesome-gee-community-catalog).
  // ============================================================================
  var MB = 'projects/mapbiomas-public/assets/';
  MAS.MB_SOURCES = {
    brazil: {label: 'MapBiomas Brazil', countries: ['Brazil'], ids: [
      MB + 'brazil/lulc/collection11/mapbiomas_brazil_collection11_coverage_v3',
      MB + 'brazil/lulc/collection10_1/mapbiomas_brazil_collection10_1_coverage_v1',
      MB + 'brazil/lulc/collection9/mapbiomas_collection90_integration_v1']},
    bolivia: {label: 'MapBiomas Bolivia', countries: ['Bolivia'], ids: [
      MB + 'bolivia/lulc/collection3/mapbiomas_bolivia_collection3_integration_v1',
      MB + 'bolivia/collection2/mapbiomas_bolivia_collection2_integration_v1']},
    colombia: {label: 'MapBiomas Colombia', countries: ['Colombia'], ids: [
      MB + 'colombia/lulc/collection3/mapbiomas_colombia_collection3_coverage_v2',
      MB + 'colombia/collection2/mapbiomas_colombia_collection2_integration_v1']},
    ecuador: {label: 'MapBiomas Ecuador', countries: ['Ecuador'], ids: [
      MB + 'ecuador/lulc/collection3/mapbiomas_ecuador_collection3_coverage_v3',
      MB + 'ecuador/collection2/mapbiomas_ecuador_collection2_integration_v1']},
    peru: {label: 'MapBiomas Peru', countries: ['Peru'], ids: [
      MB + 'peru/collection4/mapbiomas_peru_collection4_coverage_v1',
      MB + 'peru/collection3/mapbiomas_peru_collection3_integration_v1']},
    venezuela: {label: 'MapBiomas Venezuela', countries: ['Venezuela'], ids: [
      MB + 'venezuela/lulc/collection3/mapbiomas_venezuela_collection3_coverage_v1',
      MB + 'venezuela/collection2/mapbiomas_venezuela_collection2_integration_v1']},
    paraguay: {label: 'MapBiomas Paraguay', countries: ['Paraguay'], ids: [
      MB + 'paraguay/lulc/collection3/mapbiomas_paraguay_collection3_coverage_v1',
      MB + 'paraguay/collection2/mapbiomas_paraguay_collection2_integration_v1']},
    argentina: {label: 'MapBiomas Argentina', countries: ['Argentina'], ids: [
      MB + 'argentina/lulc/collection3/mapbiomas_argentina_collection3_coverage_v1',
      MB + 'argentina/lulc/collection2/mapbiomas_argentina_collection2_integration_v3']},
    chile: {label: 'MapBiomas Chile', countries: ['Chile'], ids: [
      MB + 'chile/lulc/collection2/mapbiomas_chile_collection2_coverage_v2',
      MB + 'chile/collection1/mapbiomas_chile_collection1_integration_v1']},
    uruguay: {label: 'MapBiomas Uruguay', countries: ['Uruguay'], ids: [
      MB + 'uruguay/lulc/collection3/mapbiomas_uruguay_collection3_coverage_v1',
      MB + 'uruguay/collection2/mapbiomas_uruguay_collection2_integration_v1']},
    amazon: {label: 'MapBiomas Amazonia (RAISG)', regional: true,
      countries: ['Guyana', 'Suriname', 'French Guiana'], ids: [
      MB + 'amazon/lulc/collection6/mapbiomas_collection60_integration_v1',
      'projects/mapbiomas-raisg/public/collection5/mapbiomas_raisg_panamazonia_collection5_integration_v1']}
  };
  MAS.ESRI_ID = 'projects/sat-io/open-datasets/landcover/ESRI_Global-LULC_10m_TS';
  MAS.ESRI_YEARS_TRY = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  // Country-name standardisation (pt/es/en/ISO -> LSIB name)
  MAS.COUNTRY_ALIASES = {
    'br': 'Brazil', 'bra': 'Brazil', 'bo': 'Bolivia', 'bol': 'Bolivia', 'co': 'Colombia', 'col': 'Colombia',
    'ec': 'Ecuador', 'ecu': 'Ecuador', 'pe': 'Peru', 'per': 'Peru', 've': 'Venezuela', 'ven': 'Venezuela',
    'gy': 'Guyana', 'guy': 'Guyana', 'sr': 'Suriname', 'sur': 'Suriname', 'gf': 'French Guiana', 'guf': 'French Guiana',
    'py': 'Paraguay', 'pry': 'Paraguay', 'ar': 'Argentina', 'arg': 'Argentina', 'cl': 'Chile', 'chl': 'Chile',
    'uy': 'Uruguay', 'ury': 'Uruguay', 'peru (peru)': 'Peru', 'bresil': 'Brazil', 'colombie': 'Colombia',
    'equador': 'Ecuador', 'ecuador': 'Ecuador', 'brasil': 'Brazil', 'brazil': 'Brazil',
    'colombia': 'Colombia', 'peru': 'Peru', 'bolivia': 'Bolivia', 'venezuela': 'Venezuela',
    'guyana': 'Guyana', 'guiana': 'Guyana', 'suriname': 'Suriname', 'surinam': 'Suriname',
    'guiana francesa': 'French Guiana', 'french guiana': 'French Guiana',
    'guyane': 'French Guiana', 'paraguai': 'Paraguay', 'paraguay': 'Paraguay',
    'argentina': 'Argentina', 'chile': 'Chile', 'uruguai': 'Uruguay', 'uruguay': 'Uruguay'
  };
  // ============================================================================
  // 22. IUCN REFERENCE TABLES (documents supplied by IUCN, read in full):
  //     Red List Categories & Criteria 3.1 summary sheet, Guidelines v16, Category Colour Chart,
  //     Required and Recommended Supporting Information, Documentation Standards and Consistency
  //     Checks (incl. Annex 1 spatial attributes), Habitats 3.1, Threats 3.3 (Dec 2022) and the
  //     IUCN-CMP Direct Threats 4.0, Stresses 1.1, Conservation Actions 2.0, Research Needed 2.0,
  //     General Use and Trade 1.0, Bioclimate-model supplementary information template.
  // ============================================================================
  MAS.IUCN_COLORS = {EX: '#000000', EW: '#542344', RE: '#9B4F96', CR: '#D81E05', EN: '#FC7F3F', VU: '#F9E814',
    NT: '#CCE226', LC: '#60C659', DD: '#D1D1C6', NE: '#FFFFFF', NA: '#C1B5A5'};
  MAS.IUCN_CAT_NAME = {CR: 'Critically Endangered', EN: 'Endangered', VU: 'Vulnerable', NT: 'Near Threatened',
    LC: 'Least Concern', DD: 'Data Deficient', NA: 'Not Applicable', NE: 'Not Evaluated'};
  MAS.THREATENED = ['CR', 'EN', 'VU'];
  // ---- criteria thresholds (summary sheet)
  MAS.THR = {
    A1: {CR: 90, EN: 70, VU: 50, NT: 40}, A2: {CR: 80, EN: 50, VU: 30, NT: 20}, A3: {CR: 80, EN: 50, VU: 30, NT: 20},
    A4: {CR: 80, EN: 50, VU: 30, NT: 20},
    B1: {CR: 100, EN: 5000, VU: 20000}, B2: {CR: 10, EN: 500, VU: 2000}, Bloc: {CR: 1, EN: 5, VU: 10},
    C: {CR: 250, EN: 2500, VU: 10000},
    C1: {CR: [25, 3, 1], EN: [20, 5, 2], VU: [10, 10, 3]},            // % decline, years, generations (longer, max 100 y)
    C2ai: {CR: 50, EN: 250, VU: 1000}, C2aii: {CR: 90, EN: 95, VU: 100},
    D: {CR: 50, EN: 250, VU: 1000}, D2: {aoo: 20, loc: 5},
    E: {CR: [50, 10, 3], EN: [20, 20, 5], VU: [10, 100, 0]}          // % probability, years, generations
  };
  // ---- presence / origin / seasonality (Standards, Annex 1, Tables 2a-2c)
  MAS.PRESENCE = {1: 'Extant', 2: 'Probably Extant', 3: 'Possibly Extant', 4: 'Possibly Extinct', 5: 'Extinct', 6: 'Presence Uncertain'};
  MAS.ORIGIN = {1: 'Native', 2: 'Reintroduced', 3: 'Introduced', 4: 'Vagrant', 5: 'Origin Uncertain'};
  MAS.SEASONAL = {1: 'Resident', 2: 'Breeding Season', 3: 'Non-breeding Season', 4: 'Passage', 5: 'Seasonal Occurrence Uncertain'};
  // ---- plant growth forms (required for all plants)
  MAS.PLANT_FORMS = ['(not a plant)', 'Annual', 'Bryophyte', 'Epiphyte', 'Fern', 'Forb or Herb', 'Geophyte', 'Graminoid', 'Hydrophyte',
    'Lichen', 'Lithophyte', 'Parasite', 'Shrub - large', 'Shrub - small', 'Shrub - size unknown', 'Succulent - form unknown',
    'Succulent - shrub', 'Succulent - tree', 'Tree - large', 'Tree - small', 'Tree - size unknown', 'Vine', 'Unknown'];
  // ---- IUCN Habitats Classification Scheme 3.1 (terrestrial, freshwater, coastal and artificial codes)
  MAS.HAB = {
    '1': 'Forest', '1.1': 'Forest - Boreal', '1.2': 'Forest - Subarctic', '1.3': 'Forest - Subantarctic', '1.4': 'Forest - Temperate',
    '1.5': 'Forest - Subtropical/Tropical Dry', '1.6': 'Forest - Subtropical/Tropical Moist Lowland', '1.7': 'Forest - Subtropical/Tropical Mangrove Vegetation Above High Tide Level',
    '1.8': 'Forest - Subtropical/Tropical Swamp', '1.9': 'Forest - Subtropical/Tropical Moist Montane',
    '2': 'Savanna', '2.1': 'Savanna - Dry', '2.2': 'Savanna - Moist',
    '3': 'Shrubland', '3.4': 'Shrubland - Temperate', '3.5': 'Shrubland - Subtropical/Tropical Dry', '3.6': 'Shrubland - Subtropical/Tropical Moist',
    '3.7': 'Shrubland - Subtropical/Tropical High Altitude', '3.8': 'Shrubland - Mediterranean-type Shrubby Vegetation',
    '4': 'Grassland', '4.4': 'Grassland - Temperate', '4.5': 'Grassland - Subtropical/Tropical Dry', '4.6': 'Grassland - Subtropical/Tropical Seasonally Wet/Flooded',
    '4.7': 'Grassland - Subtropical/Tropical High Altitude',
    '5': 'Wetlands (inland)', '5.1': 'Wetlands - Permanent Rivers/Streams/Creeks', '5.4': 'Wetlands - Bogs, Marshes, Swamps, Fens, Peatlands',
    '5.5': 'Wetlands - Permanent Freshwater Lakes', '5.7': 'Wetlands - Permanent Freshwater Marshes/Pools', '5.11': 'Wetlands - Alpine Wetlands',
    '5.17': 'Wetlands - Seasonal/Intermittent Saline, Brackish or Alkaline Marshes/Pools',
    '6': 'Rocky Areas (e.g. inland cliffs, mountain peaks)', '7': 'Caves and Subterranean Habitats (non-aquatic)', '8': 'Desert',
    '12.4': 'Marine Intertidal - Mud Flats and Salt Flats', '13.3': 'Marine Coastal/Supratidal - Coastal Sand Dunes',
    '14.1': 'Artificial/Terrestrial - Arable Land', '14.2': 'Artificial/Terrestrial - Pastureland', '14.3': 'Artificial/Terrestrial - Plantations',
    '14.4': 'Artificial/Terrestrial - Rural Gardens', '14.5': 'Artificial/Terrestrial - Urban Areas',
    '14.6': 'Artificial/Terrestrial - Subtropical/Tropical Heavily Degraded Former Forest',
    '15.3': 'Artificial/Aquatic - Aquaculture Ponds', '15.5': 'Artificial/Aquatic - Excavations (open)', '16': 'Introduced vegetation',
    '17': 'Other', '18': 'Unknown'};
  // ---- IUCN-CMP Threats (v3.3, the codes used in SIS; v4.0 names noted where they changed)
  MAS.THREAT = {
    '1.1': ['Housing & urban areas', '1.1 Residential Areas'], '1.2': ['Commercial & industrial areas', ''], '1.3': ['Tourism & recreation areas', '1.3 Recreation & Tourism Areas'],
    '2.1': ['Annual & perennial non-timber crops', ''], '2.1.3': ['Agro-industry farming', ''], '2.1.4': ['Scale unknown/unrecorded', ''],
    '2.2': ['Wood & pulp plantations', ''], '2.2.3': ['Scale unknown/unrecorded', ''],
    '2.3': ['Livestock farming & ranching', '2.3 Terrestrial Animal Farming, Ranching & Herding'], '2.3.4': ['Scale unknown/unrecorded', ''],
    '2.4': ['Marine & freshwater aquaculture', ''], '3.2': ['Mining & quarrying', ''], '3.3': ['Renewable energy', ''],
    '4.1': ['Roads & railroads', '4.1 Roads, Trails & Railroads'], '5.2': ['Gathering terrestrial plants', '5.2 Gathering, Harvesting & Controlling Terrestrial Plants & Fungi'],
    '5.3': ['Logging & wood harvesting', '5.3 Logging, Harvesting & Controlling Trees'],
    '7.1': ['Fire & fire suppression', '7.1 Fire & Fire Management'], '7.1.1': ['Increase in fire frequency/intensity', ''],
    '7.1.3': ['Trend unknown/unrecorded', ''], '7.2': ['Dams & water management/use', ''], '7.3': ['Other ecosystem modifications', '7.3-7.5 (split in v4.0)'],
    '8.1': ['Invasive non-native/alien species/diseases', ''], '9.3': ['Agricultural & forestry effluents', '9.1 Water-Borne & Other Effluent Pollution'],
    '11.1': ['Habitat shifting & alteration', '11.1 (v3.3) / ecosystem encroachment removed in v4.0'],
    '11.2': ['Droughts', '11.3 Changes in Precipitation & Hydrological Regimes'], '11.3': ['Temperature extremes', '11.2 Changes in Temperature Regimes'],
    '11.4': ['Storms & flooding', '10.2 Severe Weather Events'], '11.5': ['Other impacts (climate change)', '11.2 Changes in Temperature Regimes'], '12.1': ['Other threat', '']};
  MAS.STRESS = {'1.1': 'Ecosystem conversion', '1.2': 'Ecosystem degradation', '1.3': 'Indirect ecosystem effects',
    '2.1': 'Species mortality', '2.2': 'Species disturbance', '2.3.2': 'Competition', '2.3.5': 'Inbreeding', '2.3.7': 'Reduced reproductive success'};
  // SIS scope / severity / timing vocabularies (impact scores suspended by IUCN since Red List 2022-2)
  var SCOPE = ['Whole (>90%)', 'Majority (50-90%)', 'Minority (<50%)', 'Unknown'];
  var SEVERITY = ['Very rapid declines', 'Rapid declines', 'Slow, significant declines', 'Causing/could cause fluctuations',
    'Negligible declines', 'No decline', 'Unknown'];
  var TIMING = ['Past, unlikely to return', 'Past, likely to return', 'Ongoing', 'Future', 'Unknown'];
  MAS.CONS_ACTION = {'1.1': 'Land/water protection - Site/area protection', '1.2': 'Land/water protection - Resource & habitat protection',
    '2.1': 'Land/water management - Site/area management', '2.2': 'Land/water management - Invasive/problematic species control',
    '2.3': 'Land/water management - Habitat & natural process restoration', '3.1': 'Species management - Species management',
    '3.2': 'Species management - Species recovery', '3.3': 'Species management - Species re-introduction',
    '3.4.1': 'Ex-situ conservation - Captive breeding/artificial propagation', '3.4.2': 'Ex-situ conservation - Genome resource bank',
    '4.3': 'Education & awareness - Awareness & communications', '5.1.2': 'Law & policy - Legislation (national level)',
    '5.4': 'Law & policy - Compliance and enforcement'};
  MAS.RESEARCH = {'1.1': 'Research - Taxonomy', '1.2': 'Research - Population size, distribution & trends', '1.3': 'Research - Life history & ecology',
    '1.5': 'Research - Threats', '1.6': 'Research - Actions', '2.1': 'Conservation planning - Species action/recovery plan',
    '2.2': 'Conservation planning - Area-based management plan', '3.1': 'Monitoring - Population trends', '3.4': 'Monitoring - Habitat trends'};
  MAS.USE_TRADE = ['Unknown (not assessed here)', 'Species not utilized', 'Utilized - details in the narrative', 'No use/trade information'];
  // ---- suitable classes for the area of habitat (AOH): presets
  MAS.SUIT_PRESETS = {
    NATURAL: {label: 'All natural classes (default)', codes: null},
    FOREST: {label: 'Forest formations only', codes: [1, 3, 5, 6, 49, 59, 60, 67, 102]},
    NONFOREST: {label: 'Non-forest natural formations', codes: [4, 10, 11, 12, 13, 23, 29, 32, 50, 63, 66, 70, 73, 77, 81, 82, 104, 111]},
    OPEN_ROCK: {label: 'Grassland, rocky outcrop and high-altitude vegetation', codes: [12, 29, 81, 82, 63, 111]},
    CUSTOM: {label: 'Custom list of land-cover codes', codes: null}};
};

function isThreatened(c) { return MAS.THREATENED.indexOf(c) >= 0; }
// ---- land-cover class -> IUCN habitat code (climate zone from latitude, montane from elevation)
// Guidelines: forest 1.6 lowland generally below c. 1,200 m, 1.9 montane above; temperate types beyond c. 35 degrees.
function habitatCodeFor(code, lat, elev) {
  var temperate = isFinite(lat) && Math.abs(lat) > 35, montane = isFinite(elev) && elev >= 1200;
  var c = Number(code);
  if ([1, 3, 59, 60, 102].indexOf(c) >= 0) return temperate ? '1.4' : montane ? '1.9' : '1.6';
  if (c === 67) return temperate ? '3.4' : montane ? '3.7' : '1.6';
  if (c === 6) return temperate ? '1.4' : '1.8';
  if (c === 5) return '1.7';
  if (c === 4) return '2.1';
  if (c === 49) return '3.5';                                     // restinga (coastal scrub in Brazil)
  if ([10, 13, 66, 77].indexOf(c) >= 0) return temperate ? '3.4' : montane ? '3.7' : '3.5';
  if (c === 81) return '3.7';
  if (c === 82 || c === 73) return montane ? '5.11' : '5.4';
  if (c === 11 || c === 104) return '5.4';
  if ([12, 111].indexOf(c) >= 0) return temperate ? '4.4' : montane ? '4.7' : '4.5';
  if (c === 63) return '4.4';
  if (c === 29) return '6';
  if (c === 50 || c === 23) return '13.3';
  if (c === 32) return '12.4';
  if (c === 70) return '8';
  if ([26, 33, 101].indexOf(c) >= 0) return '5.1';
  if ([18, 19, 39, 20, 40, 62, 41, 36, 46, 47, 48, 72, 74, 105, 14].indexOf(c) >= 0) return '14.1';
  if (c === 15) return '14.2';
  if ([9, 79, 80, 83, 35].indexOf(c) >= 0) return '14.3';
  if (c === 21) return '14.6';
  if (c === 24 || c === 107) return '14.5';
  if (c === 30) return '15.5';
  if (c === 31) return '15.3';
  return '18';
}
// ---- land-cover class -> IUCN threat (proximate driver of conversion)
function threatCodeFor(code) {
  var c = Number(code);
  if ([18, 19, 39, 20, 40, 62, 41, 36, 46, 47, 48, 72, 74, 35, 105, 14].indexOf(c) >= 0) return '2.1';
  if ([9, 79, 80, 83].indexOf(c) >= 0) return '2.2';
  if (c === 15) return '2.3';
  if (c === 21) return '2.3';                                     // mosaic of uses: mostly pasture with crops (code 2.1 too if crops dominate)
  if (c === 24 || c === 107) return '1.1';
  if (c === 30) return '3.2';
  if (c === 75) return '3.3';
  if (c === 31) return '2.4';
  return null;
}
