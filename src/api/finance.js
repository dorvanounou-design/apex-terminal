// src/api/finance.js

/* ═══ CACHE (5-min TTL) ═══ */
export const _c = new Map();
const TTL = 5 * 60 * 1000;
const cGet = k => { const e = _c.get(k); return e && Date.now() - e.t < TTL ? e.d : null; };
const cSet = (k, d) => _c.set(k, { d, t: Date.now() });

/* ═══ CRYPTO MAP (top 100) ═══ */
export const CM = {
  BTC:"bitcoin",ETH:"ethereum",SOL:"solana",BNB:"binancecoin",XRP:"ripple",ADA:"cardano",
  DOGE:"dogecoin",AVAX:"avalanche-2",DOT:"polkadot",LINK:"chainlink",MATIC:"matic-network",
  UNI:"uniswap",ATOM:"cosmos",LTC:"litecoin",BCH:"bitcoin-cash",NEAR:"near",APT:"aptos",
  OP:"optimism",ARB:"arbitrum",SUI:"sui",FIL:"filecoin",AAVE:"aave",MKR:"maker",GRT:"the-graph",
  INJ:"injective-protocol",ONDO:"ondo",RENDER:"render-token",FET:"fetch-ai",PEPE:"pepe",
  WIF:"dogwifcoin",JUP:"jupiter-exchange-solana",TIA:"celestia",SEI:"sei-network",STX:"blockstack",
  IMX:"immutable-x",SAND:"the-sandbox",MANA:"decentraland",AXS:"axie-infinity",CRV:"curve-dao-token",
  LDO:"lido-dao",RPL:"rocket-pool",COMP:"compound-governance-token",SNX:"havven",SUSHI:"sushi",
  YFI:"yearn-finance",BAL:"balancer",ALGO:"algorand",XLM:"stellar",VET:"vechain",
  HBAR:"hedera-hashgraph",EOS:"eos",XTZ:"tezos",FLOW:"flow",MINA:"mina-protocol",
  THETA:"theta-token",FTM:"fantom",KAVA:"kava",ONE:"harmony",ROSE:"oasis-network",
  ZEC:"zcash",DASH:"dash",XMR:"monero",ENS:"ethereum-name-service",BLUR:"blur",
  BONK:"bonk",FLOKI:"floki",SHIB:"shiba-inu",CRO:"crypto-com-chain",QNT:"quant-network",
  EGLD:"elrond-erd-2",KSM:"kusama",ZIL:"zilliqa",ENJ:"enjincoin",CHZ:"chiliz",GALA:"gala",
  ICP:"internet-computer",RUNE:"thorchain",AR:"arweave",KAS:"kaspa",TON:"the-open-network",
  TRX:"tron",WLD:"worldcoin-wld",PYTH:"pyth-network",JTO:"jito-governance-token",W:"wormhole",
  STRK:"starknet",ZK:"zksync",EIGEN:"eigenlayer",TAO:"bittensor",HNT:"helium",PENDLE:"pendle",
  ENA:"ethena",POPCAT:"popcat",MEW:"cat-in-a-dogs-world",JASMY:"jasmycoin",
};

export const isC = tk => !!CM[tk.toUpperCase()];

/* ═══ ENDPOINTS ═══ */
const YB = "/yf/v8/finance/chart/";
const YQ = "/yf2/v7/finance/quote?symbols=";
const YS = "/yf2/v10/finance/quoteSummary/";
const CG = "https://api.coingecko.com/api/v3";
const px = u => u;

/* ═══ TECHNICAL ANALYSIS HELPERS ═══ */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcMACD(closes) {
  if (closes.length < 26) return { macd: null, signal: null, histogram: null };
  const ema = (data, period) => {
    const k = 2 / (period + 1);
    let e = data[0];
    for (let i = 1; i < data.length; i++) e = data[i] * k + e * (1 - k);
    return e;
  };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12 - ema26;
  return { macd, signal: null, histogram: null };
}

function calcMomentum(closes, days) {
  if (closes.length < days + 1) return null;
  const old = closes[closes.length - days - 1];
  const cur = closes[closes.length - 1];
  return old > 0 ? ((cur - old) / old) * 100 : null;
}

/* ═══ VCP DETECTION (Minervini Volatility Contraction Pattern) ═══ */
function detectVCP(closes, volumes) {
  if (closes.length < 100) return null;

  // Minervini Trend Template: Price > SMA50 > SMA150 > SMA200, SMA200 rising
  const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const sma150 = closes.slice(-150).reduce((a, b) => a + b, 0) / Math.min(closes.length, 150);
  const sma200 = closes.length >= 200
    ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
    : closes.reduce((a, b) => a + b, 0) / closes.length;
  const sma200_30ago = closes.length >= 230
    ? closes.slice(-230, -30).reduce((a, b) => a + b, 0) / 200
    : null;

  const price = closes[closes.length - 1];
  const w52High = Math.max(...closes.slice(-252));
  const w52Low = Math.min(...closes.slice(-252));

  // Trend Template checks (Minervini Stage 2 criteria)
  const trendTemplate = {
    priceAboveSma50: price > sma50,
    priceAboveSma150: price > sma150,
    priceAboveSma200: price > sma200,
    sma50AboveSma150: sma50 > sma150,
    sma50AboveSma200: sma50 > sma200,
    sma150AboveSma200: sma150 > sma200,
    sma200Rising: sma200_30ago != null ? sma200 > sma200_30ago : null,
    within25OfHigh: w52High > 0 ? ((w52High - price) / w52High) < 0.25 : false,
    above30FromLow: w52Low > 0 ? ((price - w52Low) / w52Low) > 0.3 : false,
  };
  const ttPassed = Object.values(trendTemplate).filter(v => v === true).length;
  const ttTotal = Object.values(trendTemplate).filter(v => v !== null).length;
  const ttScore = ttTotal > 0 ? Math.round((ttPassed / ttTotal) * 100) : 0;

  // Detect contractions: find swing highs/lows, measure depth narrowing
  const contractions = [];
  const lookback = Math.min(closes.length, 120);
  const segment = closes.slice(-lookback);
  let swings = [];

  // Simple swing detection (5-bar pivots)
  for (let i = 5; i < segment.length - 5; i++) {
    const isHigh = segment[i] >= Math.max(...segment.slice(i - 5, i)) && segment[i] >= Math.max(...segment.slice(i + 1, i + 6));
    const isLow = segment[i] <= Math.min(...segment.slice(i - 5, i)) && segment[i] <= Math.min(...segment.slice(i + 1, i + 6));
    if (isHigh) swings.push({ type: 'H', price: segment[i], idx: i });
    else if (isLow) swings.push({ type: 'L', price: segment[i], idx: i });
  }

  // Find contraction depths (high-to-low ranges getting tighter)
  let lastHigh = null;
  for (const sw of swings) {
    if (sw.type === 'H') lastHigh = sw;
    else if (sw.type === 'L' && lastHigh) {
      const depth = ((lastHigh.price - sw.price) / lastHigh.price) * 100;
      contractions.push({ depth, highIdx: lastHigh.idx, lowIdx: sw.idx });
    }
  }

  // VCP: contractions should narrow (e.g., 25% → 15% → 8%)
  let vcpContracting = false;
  let vcpCount = 0;
  if (contractions.length >= 2) {
    vcpContracting = true;
    for (let i = 1; i < contractions.length; i++) {
      if (contractions[i].depth < contractions[i - 1].depth) vcpCount++;
      else vcpContracting = false;
    }
  }

  // Volume dry-up near pivot (last 5 days vs 50-day avg)
  const volRecent = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const vol50 = volumes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(volumes.length, 50);
  const volDryUp = vol50 > 0 ? volRecent / vol50 : 1;

  // Composite VCP score (0-100)
  let vcpScore = 0;
  vcpScore += ttScore * 0.25;                                // Trend template: 25%
  vcpScore += Math.min(vcpCount, 3) * 8.33;                 // Contraction quality: 25% (max 3 narrowing)
  vcpScore += volDryUp < 0.7 ? 20 : volDryUp < 0.9 ? 12 : 5; // Volume pattern: 20%
  const pivotDist = w52High > 0 ? ((w52High - price) / w52High) * 100 : 50;
  vcpScore += pivotDist < 5 ? 15 : pivotDist < 10 ? 10 : pivotDist < 15 ? 6 : 2; // Pivot proximity: 15%
  vcpScore += ttScore > 70 ? 15 : ttScore > 50 ? 10 : 5;   // RS proxy (trend strength): 15%
  vcpScore = Math.round(Math.min(vcpScore, 100));

  // Execution state
  let state = 'Developing';
  if (vcpScore >= 80 && pivotDist < 5) state = 'Breakout';
  else if (vcpScore >= 70 && pivotDist < 10) state = 'Pre-breakout';
  else if (pivotDist < 3 && vcpScore < 60) state = 'Extended';
  else if (ttScore < 40) state = 'Damaged';

  // Pattern classification
  let pattern = 'Weak';
  if (vcpScore >= 90) pattern = 'Textbook VCP';
  else if (vcpScore >= 80) pattern = 'Strong VCP';
  else if (vcpScore >= 70) pattern = 'Good VCP';
  else if (vcpScore >= 60) pattern = 'Developing';

  return {
    vcpScore, state, pattern,
    ttScore, ttPassed, ttTotal,
    contractions: contractions.length,
    narrowing: vcpCount,
    volDryUp: Math.round(volDryUp * 100) / 100,
    pivotDist: Math.round(pivotDist * 10) / 10,
    trendTemplate,
  };
}

/* ═══ RELATIVE STRENGTH (vs S&P 500) ═══ */
let _spxCache = null;
async function fetchSPXReturns() {
  if (_spxCache) return _spxCache;
  try {
    const r = await fetch(YB + "^GSPC?range=6mo&interval=1d");
    const j = await r.json();
    const closes = (j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(c => c != null);
    if (closes.length < 20) return null;
    _spxCache = {
      ret30d: closes.length >= 31 ? ((closes[closes.length - 1] - closes[closes.length - 31]) / closes[closes.length - 31]) * 100 : null,
      ret90d: closes.length >= 91 ? ((closes[closes.length - 1] - closes[closes.length - 91]) / closes[closes.length - 91]) * 100 : null,
      closes,
    };
    return _spxCache;
  } catch { return null; }
}

/* ═══ EARNINGS GAP SCORING (5-factor) ═══ */
function scoreEarningsGap(closes, volumes, price, sma50, sma200) {
  if (closes.length < 60 || volumes.length < 60) return null;

  // Detect recent gap (>3% overnight move in last 5 days)
  let gapSize = 0, gapDay = -1;
  for (let i = closes.length - 1; i >= closes.length - 5 && i > 0; i--) {
    const gap = ((closes[i] - closes[i - 1]) / closes[i - 1]) * 100;
    if (Math.abs(gap) > 3) {
      gapSize = gap;
      gapDay = i;
      break;
    }
  }
  if (gapDay < 0) return null; // No recent gap

  // Factor 1: Gap Size (25%)
  const absGap = Math.abs(gapSize);
  const gapScore = absGap >= 10 ? 100 : absGap >= 7 ? 85 : absGap >= 5 ? 70 : absGap >= 3 ? 55 : 35;

  // Factor 2: Pre-gap trend — 20d return before gap (30%)
  const preStart = Math.max(0, gapDay - 20);
  const preReturn = ((closes[gapDay - 1] - closes[preStart]) / closes[preStart]) * 100;
  const trendScore = preReturn >= 15 ? 100 : preReturn >= 10 ? 85 : preReturn >= 5 ? 70 : preReturn >= 0 ? 55 : preReturn >= -5 ? 35 : 15;

  // Factor 3: Volume trend — 20d/60d volume ratio (20%)
  const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const vol60 = volumes.slice(-60).reduce((a, b) => a + b, 0) / 60;
  const volRatio = vol60 > 0 ? vol20 / vol60 : 1;
  const volScore = volRatio >= 2.0 ? 100 : volRatio >= 1.5 ? 85 : volRatio >= 1.2 ? 70 : volRatio >= 1.0 ? 50 : 20;

  // Factor 4: MA200 position (15%)
  const ma200Dist = sma200 ? ((price - sma200) / sma200) * 100 : 0;
  const ma200Score = ma200Dist >= 20 ? 100 : ma200Dist >= 10 ? 85 : ma200Dist >= 5 ? 70 : ma200Dist >= 0 ? 55 : ma200Dist >= -5 ? 35 : 15;

  // Factor 5: MA50 position (10%)
  const ma50Dist = sma50 ? ((price - sma50) / sma50) * 100 : 0;
  const ma50Score = ma50Dist >= 10 ? 100 : ma50Dist >= 5 ? 85 : ma50Dist >= 0 ? 70 : ma50Dist >= -5 ? 50 : 15;

  const composite = gapScore * 0.25 + trendScore * 0.30 + volScore * 0.20 + ma200Score * 0.15 + ma50Score * 0.10;
  const grade = composite >= 85 ? 'A' : composite >= 70 ? 'B' : composite >= 55 ? 'C' : 'D';

  return {
    composite: Math.round(composite),
    grade,
    gapSize: Math.round(gapSize * 10) / 10,
    gapDirection: gapSize > 0 ? 'up' : 'down',
    factors: { gapScore, trendScore, volScore, ma200Score, ma50Score },
  };
}

/* ═══ MANIPULATION / ANOMALY DETECTION ═══ */
function detectAnomalies(closes, volumes, price, changePct, rsi, volRatio) {
  const flags = [];
  let riskScore = 0;

  // 1. Wash Trading: volume >300% avg but price change <1%
  if (volRatio != null && volRatio > 3.0 && Math.abs(changePct) < 1) {
    flags.push({ id: 'wash', severity: 'high', label: 'Wash Trading Signal',
      detail: `Volume is ${volRatio.toFixed(1)}x average but price moved only ${Math.abs(changePct).toFixed(2)}%. Non-organic volume pattern — possible tape painting.` });
    riskScore += 3;
  }

  // 2. Parabolic Trap: >15% daily gain with RSI >80
  if (changePct > 15 && rsi != null && rsi > 80) {
    flags.push({ id: 'parabolic', severity: 'high', label: 'Parabolic Trap',
      detail: `+${changePct.toFixed(1)}% daily move with RSI at ${rsi.toFixed(0)}. Classic exit-liquidity phase of a pump. Extreme caution.` });
    riskScore += 4;
  }

  // 3. Volume-Price Divergence: new highs on declining volume
  if (closes.length >= 20 && volumes.length >= 20) {
    const recent5 = closes.slice(-5);
    const prior15 = closes.slice(-20, -5);
    const recentHigher = Math.max(...recent5) > Math.max(...prior15);
    const vol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const vol15 = volumes.slice(-20, -5).reduce((a, b) => a + b, 0) / 15;
    if (recentHigher && vol5 < vol15 * 0.7) {
      flags.push({ id: 'vol_div', severity: 'medium', label: 'Volume-Price Divergence',
        detail: `Price hitting new highs but volume declining ${((1 - vol5 / vol15) * 100).toFixed(0)}%. Move lacks institutional conviction — potential blow-off top.` });
      riskScore += 2;
    }
  }

  // 4. Sudden volume spike (>500% avg) — could be news or manipulation
  if (volRatio != null && volRatio > 5.0) {
    flags.push({ id: 'vol_spike', severity: 'medium', label: 'Extreme Volume Spike',
      detail: `Volume is ${volRatio.toFixed(1)}x the 20-day average. Could be legitimate news or coordinated activity. Verify catalyst before acting.` });
    riskScore += 1;
  }

  // 5. Gap-and-fade: large gap up (>5%) that's fading (current price below open)
  if (closes.length >= 2) {
    const prevClose = closes[closes.length - 2];
    const gapPct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
    if (gapPct > 5 && changePct < gapPct * 0.3) {
      flags.push({ id: 'gap_fade', severity: 'low', label: 'Gap & Fade',
        detail: `Gapped up ${gapPct.toFixed(1)}% but fading — only ${changePct.toFixed(1)}% from prior close. Smart money may be distributing into retail buying.` });
      riskScore += 1;
    }
  }

  // 6. Micro-cap pump pattern: <$5 stock with >200% volume and >10% move
  if (price < 5 && volRatio != null && volRatio > 2.0 && Math.abs(changePct) > 10) {
    flags.push({ id: 'microcap_pump', severity: 'high', label: 'Micro-Cap Pump Alert',
      detail: `Sub-$5 stock with ${volRatio.toFixed(1)}x volume and ${changePct.toFixed(1)}% move. Penny stocks with these patterns are frequently pump-and-dump schemes.` });
    riskScore += 3;
  }

  // Cap at 10
  riskScore = Math.min(riskScore, 10);

  return { flags, riskScore };
}

/* ═══ APEX SCREENER UNIVERSE ═══ */
// Categories for heatmap grouping
export const UNIVERSE_CATEGORIES = {
  'US Mega Cap': ['AAPL','MSFT','GOOGL','AMZN','META','NVDA','TSLA','BRK-B','JPM','V','UNH','XOM','JNJ','PG','MA','HD','AVGO','MRK','COST','ABBV','WMT','PEP','KO','LLY','CRM','ADBE','NFLX','ORCL','ACN','CSCO'],
  'US Large Cap': ['AMD','INTC','QCOM','TXN','MU','AMAT','LRCX','KLAC','MRVL','SNPS','CDNS','PANW','FTNT','ZS','NOW','INTU','WDAY','VEEV','TEAM','DOCU','SHOP','SE','MELI','BABA','PDD','JD','BIDU'],
  'US Growth / Tech': ['PLTR','CRWD','NET','DDOG','SNOW','ABNB','UBER','SQ','COIN','DASH','RBLX','U','PINS','SNAP','TTD','ROKU','ZM','OKTA','MDB','CFLT','PATH','S','GTLB','IOT','AI','UPST','SOFI','HOOD','AFRM','OPEN'],
  'US Mid Cap': ['BAC','WFC','GS','MS','C','AXP','BLK','SCHW','USB','PNC','CME','ICE','MCO','SPGI','FIS','FISV','SYK','BSX','MDT','ISRG','DXCM','EW','ZTS','REGN','VRTX','MRNA','BIIB','GILD','AMGN'],
  'US Small / Micro': ['SMCI','IONQ','RGTI','QUBT','SOUN','BBAI','JOBY','LILM','LUNR','RKLB','ASTR','BWXT','ASTS','MNTS','VSAT','RDW','SPIR','SATL','MAXN','ARQQ','QBTS','DM','NNDM','MKFG','PRNT','BTBT','MARA','RIOT','CLSK','HUT','CIFR','BITF','WULF','IREN'],
  'US Energy / Commodities': ['XOM','CVX','OXY','COP','SLB','HAL','EOG','PXD','DVN','MPC','PSX','VLO','FANG','APA','KMI','WMB','ET','OKE','CTRA','EQT'],
  'US Defense / Aero': ['LMT','RTX','NOC','GD','BA','LHX','HII','TDG','HWM','AXON','TXT','KTOS','RCAT','AVAV'],
  'US Healthcare': ['PFE','BMY','TMO','DHR','ABT','BDX','BAX','CI','HCA','ELV','CNC','MOH','HUM','ALGN','HOLX','TECH','EXAS'],
  'US Consumer / Retail': ['AMZN','TGT','LOW','TJX','ROST','DG','DLTR','BURL','LULU','NKE','SBUX','MCD','CMG','DPZ','YUM','QSR','WING'],
  'US REITs / Financials': ['AMT','PLD','CCI','EQIX','O','SPG','AVB','EQR','VTR','WELL','DLR','PSA','BXP','ARE','PEAK'],
  'Tel Aviv 125': [
    // Banks
    'LUMI.TA','POLI.TA','DSCT.TA','FIBI.TA','MIZRAHI.TA',
    // Tech (TASE-listed)
    'CHKP','NICE','CYBR','MNDY','WIX','INMD','GLBE','TASE.TA','SILC.TA',
    // Insurance / Finance
    'HARL.TA','MGDL.TA','CLIS.TA','FNTS.TA','ALHE.TA','MZTF.TA',
    // Real Estate
    'AZRG.TA','AMOT.TA','GZIT.TA','BSEN.TA','MGDLT.TA','AFRE.TA','DLKR.TA',
    // Energy / Infra
    'ENLT.TA','DLEKG.TA','OPC.TA','NXTG.TA','ELCO.TA','KARE.TA',
    // Pharma / Bio
    'TEVA','KMDA.TA','PRTX.TA','CGEN.TA','PPBT.TA',
    // Telecom / Media
    'BEZQ.TA','CEL.TA','PTNR.TA','BCOM.TA',
    // Food / Consumer
    'STRS.TA','ORL.TA','SANO.TA','SHUFERSAL.TA','FXPO.TA',
    // Industrial / Defense
    'ESLT','ELBT.TA','RIT.TA','MTRX.TA','ORMP','KRNT',
    // Additional TA-125 members
    'ICL','DANEL.TA','SPEN.TA','RLCO.TA','MLSR.TA','ARPT.TA','FORTY.TA',
    'ALONY.TA','PTCH.TA','SPNS.TA','PHOE.TA','NAWI.TA','RAVD.TA',
    'BRMG.TA','ONE.TA','SLARL.TA','CMCT.TA','ISCD.TA','MSBI.TA',
  ],
};

// Flat array of all tickers (deduplicated)
export const APEX_UNIVERSE = [...new Set(Object.values(UNIVERSE_CATEGORIES).flat())];

// Reverse lookup: ticker → category
export const tickerCategory = (() => {
  const map = {};
  for (const [cat, tks] of Object.entries(UNIVERSE_CATEGORIES)) {
    for (const tk of tks) if (!map[tk]) map[tk] = cat;
  }
  return map;
})();

/* ═══ FETCH FUNCTIONS ═══ */
export async function fetchStockPrice(tk) {
  let d = cGet("sp_" + tk); if (d) return d;
  const attempt = async (n = 0) => {
    try {
      const r = await fetch(px(YB + tk + "?range=1d&interval=1d")); if (!r.ok) throw new Error(r.status);
      const j = await r.json(); const m = j?.chart?.result?.[0]?.meta; if (!m) throw new Error("no data");
      const prev = m.chartPreviousClose || m.previousClose || m.regularMarketPrice;
      d = { price: m.regularMarketPrice, prevClose: prev, change: m.regularMarketPrice - prev, changePct: ((m.regularMarketPrice - prev) / prev) * 100, name: m.shortName || m.symbol || tk };
      cSet("sp_" + tk, d); return d;
    } catch (e) {
      if (n < 2) { await new Promise(r => setTimeout(r, 1000)); return attempt(n + 1); }
      console.warn("Stock fetch failed:", tk, e); return null;
    }
  };
  return attempt();
}

export async function fetchCryptoPrice(tk) {
  const id = CM[tk.toUpperCase()]; if (!id) return null;
  let d = cGet("cp_" + tk); if (d) return d;
  try {
    const r = await fetch(`${CG}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`);
    if (!r.ok) throw 0; const j = await r.json(); const i = j[id]; if (!i) throw 0;
    d = { price: i.usd, changePct: i.usd_24h_change || 0, change: i.usd * (i.usd_24h_change || 0) / 100, marketCap: i.usd_market_cap, name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ") };
    cSet("cp_" + tk, d); return d;
  } catch { return null; }
}

export const fetchPrice = tk => isC(tk) ? fetchCryptoPrice(tk) : fetchStockPrice(tk);

export async function fetchStockDetail(tk) {
  let d = cGet("sd_" + tk); if (d) return d;
  const attempt = async (n = 0) => {
    try { const r = await fetch(px(YQ + tk)); if (!r.ok) throw new Error(r.status); const j = await r.json(); d = j?.quoteResponse?.result?.[0]; if (d) cSet("sd_" + tk, d); return d; }
    catch (e) { if (n < 2) { await new Promise(r => setTimeout(r, 1000)); return attempt(n + 1); } return null; }
  };
  return attempt();
}

export async function fetchCryptoDetail(tk) {
  const id = CM[tk.toUpperCase()]; if (!id) return null;
  let d = cGet("cd_" + tk); if (d) return d;
  try { const r = await fetch(`${CG}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`); if (!r.ok) throw 0; d = await r.json(); cSet("cd_" + tk, d); return d; } catch { return null; }
}

export async function fetchChart(tk, days = 30) {
  let d = cGet("ch_" + tk + days); if (d) return d;
  if (isC(tk)) {
    const id = CM[tk.toUpperCase()]; if (!id) return [];
    try { const r = await fetch(`${CG}/coins/${id}/market_chart?vs_currency=usd&days=${days}`); const j = await r.json(); d = (j.prices || []).map(([ts, p]) => ({ date: new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" }), price: +p.toFixed(2) })); cSet("ch_" + tk + days, d); return d; } catch { return []; }
  } else {
    const attempt = async (n = 0) => {
      try {
        const range = days <= 7 ? "5d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
        const r = await fetch(px(YB + tk + "?range=" + range + "&interval=1d")); const j = await r.json();
        const res = j?.chart?.result?.[0]; if (!res) throw new Error("no data");
        const ts = res.timestamp || []; const cl = res.indicators?.quote?.[0]?.close || [];
        d = ts.map((t, i) => ({ date: new Date(t * 1000).toLocaleDateString("en", { month: "short", day: "numeric" }), price: cl[i] ? +cl[i].toFixed(2) : null })).filter(x => x.price);
        cSet("ch_" + tk + days, d); return d;
      } catch (e) { if (n < 1) { await new Promise(r => setTimeout(r, 800)); return attempt(n + 1); } return []; }
    };
    return attempt();
  }
}

export async function fetchLiveIndices() {
  let d = cGet("idx"); if (d) return d;
  try {
    const [cr, sp, nd, vx] = await Promise.all([
      fetch(`${CG}/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true`).then(r => r.json()).catch(() => ({})),
      fetch(px(YB + "^GSPC?range=1d&interval=1d")).then(r => r.json()).catch(() => null),
      fetch(px(YB + "^IXIC?range=1d&interval=1d")).then(r => r.json()).catch(() => null),
      fetch(px(YB + "^VIX?range=1d&interval=1d")).then(r => r.json()).catch(() => null),
    ]);
    const ym = j => j?.chart?.result?.[0]?.meta;
    const yp = m => m ? { p: m.regularMarketPrice, c: ((m.regularMarketPrice - (m.chartPreviousClose || m.previousClose)) / (m.chartPreviousClose || m.previousClose)) * 100 } : null;
    const s = yp(ym(sp)), n = yp(ym(nd)), v = yp(ym(vx));
    d = [
      s && { n: "S&P 500", ...s }, n && { n: "NASDAQ", ...n },
      cr.bitcoin && { n: "BTC", p: cr.bitcoin.usd, c: cr.bitcoin.usd_24h_change },
      cr.ethereum && { n: "ETH", p: cr.ethereum.usd, c: cr.ethereum.usd_24h_change },
      cr.solana && { n: "SOL", p: cr.solana.usd, c: cr.solana.usd_24h_change },
      v && { n: "VIX", ...v },
    ].filter(Boolean);
    cSet("idx", d); return d;
  } catch { return []; }
}

export async function fetchTopMovers() {
  let d = cGet("movers"); if (d) return d;
  try {
    const r = await fetch(`${CG}/coins/markets?vs_currency=usd&order=volume_desc&per_page=25&page=1&sparkline=false&price_change_percentage=24h`);
    if (!r.ok) throw 0; const j = await r.json();
    d = j.map(c => ({ tk: c.symbol.toUpperCase(), nm: c.name, pr: c.current_price, ch: c.price_change_percentage_24h || 0, vol: c.total_volume, mc: c.market_cap, img: c.image, tp: "crypto" })).filter(c => Math.abs(c.ch) > 1.5).slice(0, 12);
    cSet("movers", d); return d;
  } catch { return []; }
}

/* ═══ APEX SCREENER ═══ */

// Analyze a single custom ticker (public API)
export async function fetchSingleAnalysis(tk) {
  const chart = await fetchTickerChart(tk.toUpperCase());
  if (!chart) return null;
  return analyzeStock(tk.toUpperCase(), chart);
}

// Fetch 6-month chart data for a single ticker (v8 — no auth needed)
async function fetchTickerChart(tk) {
  const ck = "sc8_" + tk;
  let d = cGet(ck); if (d) return d;
  const attempt = async (n = 0) => {
    try {
      const r = await fetch(YB + tk + "?range=6mo&interval=1d");
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      if (!res) throw new Error("no chart data");
      const meta = res.meta;
      const closes = (res.indicators?.quote?.[0]?.close || []).filter(c => c != null);
      const volumes = (res.indicators?.quote?.[0]?.volume || []).filter(v => v != null);
      d = { meta, closes, volumes };
      cSet(ck, d);
      return d;
    } catch (e) {
      if (n < 1) { await new Promise(r => setTimeout(r, 300)); return attempt(n + 1); }
      return null;
    }
  };
  return attempt();
}

function analyzeStock(tk, chartData) {
  const { meta, closes, volumes } = chartData;
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose || meta.previousClose || price;
  const change = price - prevClose;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const w52High = meta.fiftyTwoWeekHigh;
  const w52Low = meta.fiftyTwoWeekLow;
  const name = meta.shortName || meta.longName || tk;
  const currency = meta.currency || 'USD';

  // Technical indicators
  const rsi = calcRSI(closes);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const macd = calcMACD(closes);
  const mom30d = calcMomentum(closes, 30);
  const mom90d = calcMomentum(closes, 90);
  const avgVol = volumes.length > 20 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
  const latestVol = volumes.length > 0 ? volumes[volumes.length - 1] : null;
  const volRatio = avgVol && latestVol ? latestVol / avgVol : null;

  // 52-week position
  const w52Range = w52High - w52Low;
  const w52Position = w52Range > 0 ? ((price - w52Low) / w52Range) * 100 : 50;
  const distFromHigh = w52High > 0 ? ((price - w52High) / w52High) * 100 : 0;

  // Manipulation / anomaly detection
  const anomalies = detectAnomalies(closes, volumes, price, changePct, rsi, volRatio);

  // VCP (Minervini Volatility Contraction Pattern)
  const vcp = detectVCP(closes, volumes);

  // SMA 200 for earnings gap scoring
  const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200 : null;

  // Earnings gap detection
  const earningsGap = scoreEarningsGap(closes, volumes, price, sma50, sma200);

  // APEX TECHNICAL SCORE
  let score = 0;

  // RSI
  if (rsi != null) {
    if (rsi < 30) score += 3;
    else if (rsi < 40) score += 2;
    else if (rsi < 50) score += 1;
    else if (rsi > 70) score -= 2;
    else if (rsi > 60) score -= 0.5;
  }

  // MA crossover
  if (sma20 != null && sma50 != null) {
    if (price > sma20 && sma20 > sma50) score += 2;
    else if (price > sma50 && price < sma20) score += 0.5;
    else if (price < sma20 && sma20 < sma50) score -= 1;
  }

  // Value position
  if (w52Position < 30) score += 2;
  else if (w52Position < 50) score += 1;
  else if (w52Position > 90) score -= 1;

  // Momentum
  if (mom30d != null) {
    if (mom30d > 10) score += 2;
    else if (mom30d > 3) score += 1;
    else if (mom30d < -10) score -= 1;
  }

  // Volume confirmation
  if (volRatio != null && volRatio > 1.5 && volRatio < 3) score += 1;

  // VCP bonus: strong VCP patterns get a score boost
  if (vcp && vcp.vcpScore >= 70 && vcp.state !== 'Damaged') score += 2;
  else if (vcp && vcp.vcpScore >= 50 && vcp.state !== 'Damaged') score += 1;

  // Penalize for manipulation risk
  if (anomalies.riskScore >= 6) score -= 2;
  else if (anomalies.riskScore >= 3) score -= 1;

  let techRating = 'HOLD';
  if (score >= 6) techRating = 'STRONG BUY';
  else if (score >= 3) techRating = 'BUY';
  else if (score >= 0) techRating = 'HOLD';
  else if (score >= -3) techRating = 'SELL';
  else techRating = 'STRONG SELL';

  return {
    ticker: tk, name, price, change, changePct, currency,
    fiftyTwoWeekHigh: w52High, fiftyTwoWeekLow: w52Low,
    analystRating: techRating,
    rsi, sma20, sma50, sma200, macd: macd.macd,
    mom30d, mom90d, avgVol, volRatio,
    w52Position, distFromHigh,
    apexScore: Math.round(score * 10) / 10,
    category: tickerCategory[tk] || 'Custom',
    // Manipulation data
    riskScore: anomalies.riskScore,
    riskFlags: anomalies.flags,
    // VCP (Minervini)
    vcp,
    // Earnings gap
    earningsGap,
  };
}

// Fetch Yahoo Finance trending tickers (dynamic discovery)
export async function fetchTrending() {
  let d = cGet("trending"); if (d) return d;
  try {
    const r = await fetch("/yf2/v1/finance/trending/US?count=50");
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const symbols = (j?.finance?.result?.[0]?.quotes || []).map(q => q.symbol).filter(Boolean);
    cSet("trending", symbols);
    return symbols;
  } catch { return []; }
}

// Fetch Yahoo Finance most active / gainers / losers
export async function fetchMostActive() {
  let d = cGet("mostactive"); if (d) return d;
  try {
    const [actRes, gainRes, loseRes] = await Promise.allSettled([
      fetch("/yf2/v1/finance/screener/predefined/saved?scrIds=most_actives&count=25").then(r => r.json()),
      fetch("/yf2/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=15").then(r => r.json()),
      fetch("/yf2/v1/finance/screener/predefined/saved?scrIds=day_losers&count=10").then(r => r.json()),
    ]);
    const extract = (res) => {
      if (res.status !== 'fulfilled') return [];
      return (res.value?.finance?.result?.[0]?.quotes || []).map(q => q.symbol).filter(Boolean);
    };
    const symbols = [...new Set([...extract(actRes), ...extract(gainRes), ...extract(loseRes)])];
    cSet("mostactive", symbols);
    return symbols;
  } catch { return []; }
}

// Screener with progress callback for large universe
export async function fetchApexScreener(onProgress) {
  let d = cGet("apex_screener"); if (d) return d;

  // Fetch S&P 500 data for RS calculation
  const spxData = await fetchSPXReturns();

  // Merge dynamic discovery tickers with curated universe
  let dynamicTickers = [];
  try {
    const [trending, active] = await Promise.allSettled([fetchTrending(), fetchMostActive()]);
    if (trending.status === 'fulfilled') dynamicTickers.push(...trending.value);
    if (active.status === 'fulfilled') dynamicTickers.push(...active.value);
  } catch {}
  const fullUniverse = [...new Set([...APEX_UNIVERSE, ...dynamicTickers])];

  const BATCH = 12; // concurrent fetches per wave
  const DELAY = 200; // ms between waves
  const results = [];
  const total = fullUniverse.length;

  for (let i = 0; i < total; i += BATCH) {
    const batch = fullUniverse.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(batch.map(tk => fetchTickerChart(tk)));
    for (let j = 0; j < batch.length; j++) {
      const r = batchResults[j];
      if (r.status === 'fulfilled' && r.value) {
        const stock = analyzeStock(batch[j], r.value);
        // Calculate Relative Strength vs S&P 500
        if (spxData && stock.mom30d != null && spxData.ret30d != null) {
          stock.rs30d = stock.mom30d - spxData.ret30d;
          stock.rs90d = stock.mom90d != null && spxData.ret90d != null ? stock.mom90d - spxData.ret90d : null;
          stock.rsRating = stock.rs30d > 15 ? 99 : stock.rs30d > 8 ? 90 : stock.rs30d > 3 ? 75 : stock.rs30d > 0 ? 60 : stock.rs30d > -5 ? 40 : 20;
        }
        // Mark if from dynamic discovery
        if (!APEX_UNIVERSE.includes(batch[j])) stock._discovered = true;
        results.push(stock);
      }
    }
    if (onProgress) onProgress(Math.min(i + BATCH, total), total);
    if (i + BATCH < total) await new Promise(r => setTimeout(r, DELAY));
  }

  const stocks = results.filter(s => s.price != null);
  stocks.sort((a, b) => b.apexScore - a.apexScore);

  cSet("apex_screener", stocks);
  return stocks;
}
