// ===== Helper Functions =====

function getCounts(tiles) {
  const m = {};
  for (const t of tiles) m[t.key()] = (m[t.key()] || 0) + 1;
  return m;
}

function removeTiles(tiles, key, n) {
  const r = [];
  let rem = n;
  for (const t of tiles) {
    if (rem > 0 && t.key() === key) { rem--; }
    else { r.push(t); }
  }
  return r;
}

function key(suit, value) {
  return suit + value;
}

function findTile(tiles, suit, value) {
  for (const t of tiles) {
    if (t.suit === suit && t.value === value) return t;
  }
  return null;
}

function hasTile(counts, suit, value) {
  return (counts[key(suit, value)] || 0) > 0;
}

// ===== Dora =====

function nextDoraTile(tile) {
  if (tile.suit === 'man' || tile.suit === 'pin' || tile.suit === 'sou') {
    return new Tile(tile.suit, tile.value === 9 ? 1 : tile.value + 1);
  }
  if (tile.value <= 4) {
    return new Tile('honor', tile.value === 4 ? 1 : tile.value + 1);
  }
  const d = { 5:6, 6:7, 7:5 };
  return new Tile('honor', d[tile.value]);
}

function countDora(tiles, doraIndicators) {
  if (!doraIndicators || doraIndicators.length === 0) return 0;
  const counts = getCounts(tiles);
  let dora = 0;
  for (const ind of doraIndicators) {
    const doraT = nextDoraTile(ind);
    dora += counts[doraT.key()] || 0;
  }
  return dora;
}

// ===== Hand Decomposition =====

function decomposeMelds(tiles, numMelds) {
  if (numMelds === 0) return tiles.length === 0 ? [[]] : [];
  if (tiles.length < numMelds * 3) return [];

  const results = [];
  const first = tiles[0];
  if (!first) return [];
  const counts = getCounts(tiles);
  const fk = first.key();

  if ((counts[fk] || 0) >= 3) {
    const rem = removeTiles(removeTiles(removeTiles(tiles, fk, 1), fk, 1), fk, 1);
    for (const sub of decomposeMelds(rem, numMelds - 1)) {
      results.push([{ type:'triplet', tiles:[first, first, first], open:false }, ...sub]);
    }
  }

  if (first.suit !== 'honor' && first.value <= 7) {
    const v = first.value;
    const k2 = key(first.suit, v + 1);
    const k3 = key(first.suit, v + 2);
    if ((counts[k2] || 0) > 0 && (counts[k3] || 0) > 0) {
      let r = removeTiles(tiles, fk, 1);
      r = removeTiles(r, k2, 1);
      r = removeTiles(r, k3, 1);
      const seq = [first, new Tile(first.suit, v+1), new Tile(first.suit, v+2)];
      for (const sub of decomposeMelds(r, numMelds - 1)) {
        results.push([{ type:'sequence', tiles:seq, open:false }, ...sub]);
      }
    }
  }

  return results;
}

function findAllDecompositions(tiles) {
  const counts = getCounts(tiles);
  const results = [];
  const tried = {};

  for (const [k, c] of Object.entries(counts)) {
    if (c < 2 || tried[k]) continue;
    tried[k] = true;

    const pairTile = Tile.fromString(k[0] + k.slice(1));
    const rem = removeTiles(removeTiles(tiles, k, 1), k, 1);
    const meldSets = decomposeMelds(rem, 4);
    for (const melds of meldSets) {
      results.push({ melds, pair: pairTile });
    }
  }

  return results;
}

function findDecompositionsWithOpen(tiles, openMelds) {
  if (openMelds.length === 0) return findAllDecompositions(tiles);
  const openTiles = [];
  for (const m of openMelds) {
    for (const t of m.tiles) openTiles.push(t);
  }
  const closedOnly = [];
  const openCounts = getCounts(openTiles);
  for (const t of tiles) {
    const k = t.key();
    if ((openCounts[k] || 0) > 0) {
      openCounts[k]--;
    } else {
      closedOnly.push(t);
    }
  }
  const neededMelds = 4 - openMelds.length;
  if (neededMelds < 0) return [];
  const counts = getCounts(closedOnly);
  const results = [];
  const tried = {};
  for (const [k, c] of Object.entries(counts)) {
    if (c < 2 || tried[k]) continue;
    tried[k] = true;
    const pairTile = Tile.fromString(k[0] + k.slice(1));
    const rem = removeTiles(removeTiles(closedOnly, k, 1), k, 1);
    const meldSets = decomposeMelds(rem, neededMelds);
    for (const melds of meldSets) {
      results.push({ melds: openMelds.concat(melds), pair: pairTile });
    }
  }
  return results;
}

// ===== Wait Type Detection =====

function detectWaitType(hand, melds, pair, winTile, winType) {
  let winInMeld = null;
  let winIsPair = false;

  if (pair.equals(winTile)) {
    winIsPair = true;
  } else {
    for (const m of melds) {
      for (const t of m.tiles) {
        if (t.equals(winTile)) {
          winInMeld = m;
          break;
        }
      }
      if (winInMeld) break;
    }
  }

  if (winIsPair) return 'tanki';
  if (!winInMeld) return 'unknown';

  if (winInMeld.type === 'triplet') return 'shanpon';

  const seq = winInMeld.tiles;
  const pos = seq.findIndex(t => t.equals(winTile));
  const v = seq[0].value;

  if (pos === 0) return (v === 1 || v === 2) ? 'penchan' : 'ryanmen';
  if (pos === 1) return 'kanchan';
  if (pos === 2) return (v === 7 || v === 8) ? 'penchan' : 'ryanmen';
  return 'unknown';
}

function detectWaitTypeSimple(hand, melds, pair, winTile) {
  if (pair.equals(winTile)) return 'tanki';
  for (const m of melds) {
    if (m.type === 'triplet' && m.tiles[0].equals(winTile)) {
      return 'shanpon';
    }
    if (m.type === 'sequence') {
      const idx = m.tiles.findIndex(t => t.equals(winTile));
      if (idx >= 0) {
        const v = m.tiles[0].value;
        if (idx === 0) {
          if (v === 1) return 'penchan';
          if (v === 2) return 'penchan';
          return 'ryanmen';
        } else if (idx === 1) {
          return 'kanchan';
        } else {
          if (v === 7) return 'penchan';
          if (v === 8) return 'penchan';
          return 'ryanmen';
        }
      }
    }
  }
  return 'unknown';
}

// ===== Special Decompositions =====

function checkChiitoitsuDecomp(tiles) {
  const counts = getCounts(tiles);
  const keys = Object.keys(counts);
  if (keys.length !== 7) return null;
  for (const c of Object.values(counts)) {
    if (c !== 2) return null;
  }
  return { melds: [], pair: null, isChiitoitsu: true };
}

function checkKokushiDecomp(tiles) {
  const honors = [1,2,3,4,5,6,7].map(v => key('honor', v));
  const terminals = [];
  for (const s of ['man','pin','sou']) {
    terminals.push(key(s, 1));
    terminals.push(key(s, 9));
  }
  const allOrphans = [...terminals, ...honors];
  const counts = getCounts(tiles);
  const keys = Object.keys(counts);
  if (keys.length !== allOrphans.length) {
    const missing = allOrphans.filter(k => !counts[k]);
    const extra = keys.filter(k => !allOrphans.includes(k));
    if (extra.length > 0) return null;
    if (missing.length === 1 && keys.length === allOrphans.length - 1) {
      const dupTile = keys.find(k => counts[k] === 2);
      if (!dupTile) return null;
      for (const k of keys) {
        if (k !== dupTile && (!allOrphans.includes(k) || counts[k] !== 1)) return null;
      }
      return { melds: [], pair: Tile.fromString(dupTile[0] + dupTile.slice(1)), isKokushi: true };
    }
    if (missing.length === 0) {
      const dupTile = keys.find(k => counts[k] === 2);
      if (!dupTile) return null;
      if (keys.length !== allOrphans.length) return null;
      for (const k of allOrphans) {
        if (!counts[k] || counts[k] < 1 || counts[k] > 2) return null;
      }
      let dupCount = 0;
      for (const k of allOrphans) {
        if (counts[k] === 2) dupCount++;
      }
      if (dupCount !== 1) return null;
      return { melds: [], pair: Tile.fromString(dupTile[0] + dupTile.slice(1)), isKokushi: true };
    }
  } else {
    const dupTile = keys.find(k => counts[k] === 2);
    if (!dupTile) return null;
    for (const k of allOrphans) {
      if (!counts[k]) return null;
    }
    return { melds: [], pair: Tile.fromString(dupTile[0] + dupTile.slice(1)), isKokushi: true };
  }
  return null;
}

// ===== Yaku Checkers =====

function isMenzen(melds) {
  return melds.every(m => !m.open);
}

function checkRiichi(handInfo, gameState) {
  return (gameState && gameState.isRiichi) ? [{ name:'立直', han:1 }] : [];
}

function checkIppatsu(handInfo, gameState) {
  return (gameState && gameState.isIppatsu) ? [{ name:'一発', han:1 }] : [];
}

function checkMenzenTsumo(handInfo, gameState) {
  if (gameState && gameState.winType === 'tsumo' && isMenzen(handInfo.melds)) {
    return [{ name:'門前清自摸和', han:1 }];
  }
  return [];
}

function checkPinfu(handInfo, gameState) {
  const { melds } = handInfo;
  if (!isMenzen(melds)) return [];
  for (const m of melds) {
    if (m.type !== 'sequence') return [];
  }
  const pair = handInfo.pair;
  if (!pair) return [];
  if (pair.isWind || pair.isSangen) {
    if (gameState) {
      if (pair.value === (gameState.seatWind || 0)) return [];
      if (pair.value === (gameState.roundWind || 0)) return [];
    } else {
      return [];
    }
  }
  const waitType = detectWaitTypeSimple(handInfo.hand, melds, pair, gameState ? gameState.winTile : null);
  if (waitType !== 'ryanmen') return [];
  return [{ name:'平和', han:1 }];
}

function checkTanyao(handInfo, gameState) {
  for (const m of handInfo.melds) {
    for (const t of m.tiles) {
      if (t.isTerminal) return [];
    }
  }
  if (handInfo.pair && handInfo.pair.isTerminal) return [];
  if (handInfo.pair === null && handInfo.isChiitoitsu) return [];
  return [{ name:'断幺九', han:1 }];
}

function checkIipeikou(handInfo, gameState) {
  if (!isMenzen(handInfo.melds)) return [];
  const seqs = handInfo.melds.filter(m => m.type === 'sequence');
  if (seqs.length < 2) return [];
  for (let i = 0; i < seqs.length; i++) {
    for (let j = i + 1; j < seqs.length; j++) {
      const a = seqs[i].tiles;
      const b = seqs[j].tiles;
      if (a[0].equals(b[0]) && a[1].equals(b[1]) && a[2].equals(b[2])) {
        return [{ name:'一盃口', han:1 }];
      }
    }
  }
  return [];
}

function checkRyanpeikou(handInfo, gameState) {
  if (!isMenzen(handInfo.melds)) return [];
  const seqs = handInfo.melds.filter(m => m.type === 'sequence');
  if (seqs.length < 4) return [];
  const used = new Array(seqs.length).fill(false);
  let pairs = 0;
  for (let i = 0; i < seqs.length; i++) {
    if (used[i]) continue;
    for (let j = i + 1; j < seqs.length; j++) {
      if (used[j]) continue;
      const a = seqs[i].tiles;
      const b = seqs[j].tiles;
      if (a[0].equals(b[0]) && a[1].equals(b[1]) && a[2].equals(b[2])) {
        used[i] = used[j] = true;
        pairs++;
        break;
      }
    }
  }
  return pairs === 2 ? [{ name:'二盃口', han:3 }] : [];
}

function checkYakuhai(handInfo, gameState) {
  const yaku = [];
  for (const m of handInfo.melds) {
    if (m.type !== 'triplet' && m.type !== 'kan') continue;
    const t = m.tiles[0];
    if (!t.isHonor) continue;
    if (t.isSangen) {
      yaku.push({ name: t.name + ' (役牌)', han:1 });
    } else if (t.isWind) {
      if (t.value === (gameState ? gameState.seatWind : 0) ||
          t.value === (gameState ? gameState.roundWind : 0)) {
        yaku.push({ name: t.name + ' (役牌)', han:1 });
      }
    }
  }
  return yaku;
}

function checkSanshokuDoujun(handInfo, gameState) {
  for (let i = 0; i < handInfo.melds.length; i++) {
    if (handInfo.melds[i].type !== 'sequence') continue;
    const v = handInfo.melds[i].tiles[0].value;
    const suits = {};
    suits[handInfo.melds[i].tiles[0].suit] = true;
    for (let j = 0; j < handInfo.melds.length; j++) {
      if (i === j || handInfo.melds[j].type !== 'sequence') continue;
      if (handInfo.melds[j].tiles[0].value === v) {
        suits[handInfo.melds[j].tiles[0].suit] = true;
      }
    }
    if (suits.man && suits.pin && suits.sou) {
      const han = isMenzen(handInfo.melds) ? 2 : 1;
      return [{ name:'三色同順', han }];
    }
  }
  return [];
}

function checkSanshokuDoukou(handInfo, gameState) {
  for (let i = 0; i < handInfo.melds.length; i++) {
    if (handInfo.melds[i].type !== 'triplet') continue;
    const v = handInfo.melds[i].tiles[0].value;
    const suits = {};
    suits[handInfo.melds[i].tiles[0].suit] = true;
    for (let j = 0; j < handInfo.melds.length; j++) {
      if (i === j || handInfo.melds[j].type !== 'triplet') continue;
      if (handInfo.melds[j].tiles[0].value === v) {
        suits[handInfo.melds[j].tiles[0].suit] = true;
      }
    }
    if (suits.man && suits.pin && suits.sou) {
      return [{ name:'三色同刻', han:2 }];
    }
  }
  return [];
}

function checkIttsuu(handInfo, gameState) {
  for (const s of ['man','pin','sou']) {
    const seqs = handInfo.melds.filter(
      m => m.type === 'sequence' && m.tiles[0].suit === s
    );
    if (seqs.length < 3) continue;
    const vals = seqs.map(m => m.tiles[0].value);
    if (vals.includes(1) && vals.includes(4) && vals.includes(7)) {
      const han = isMenzen(handInfo.melds) ? 2 : 1;
      return [{ name:'一気通貫', han }];
    }
  }
  return [];
}

function checkChanta(handInfo, gameState) {
  for (const m of handInfo.melds) {
    let hasTerminal = false;
    for (const t of m.tiles) {
      if (t.isTerminal) { hasTerminal = true; break; }
    }
    if (!hasTerminal) return [];
  }
  if (!handInfo.pair || !handInfo.pair.isTerminal) return [];
  const han = isMenzen(handInfo.melds) ? 2 : 1;
  return [{ name:'混全帯么九', han }];
}

function checkJunchan(handInfo, gameState) {
  for (const m of handInfo.melds) {
    let hasTerm = false;
    for (const t of m.tiles) {
      if (t.isTerminal) { hasTerm = true; break; }
    }
    if (!hasTerm) return [];
    for (const t of m.tiles) {
      if (t.isHonor) return [];
    }
  }
  if (!handInfo.pair || handInfo.pair.isHonor || !handInfo.pair.isTerminal) return [];
  const han = isMenzen(handInfo.melds) ? 3 : 2;
  return [{ name:'純全帯么九', han }];
}

function checkToitoi(handInfo, gameState) {
  for (const m of handInfo.melds) {
    if (m.type !== 'triplet' && m.type !== 'kan') return [];
  }
  return [{ name:'対々和', han:2 }];
}

function checkSanankou(handInfo, gameState) {
  let closedTriplets = 0;
  for (const m of handInfo.melds) {
    if ((m.type === 'triplet' || m.type === 'kan') && !m.open) closedTriplets++;
  }
  if (handInfo.isKokushi || handInfo.isChiitoitsu) return [];
  return closedTriplets >= 3 ? [{ name:'三暗刻', han:2 }] : [];
}

function checkHonroutou(handInfo, gameState) {
  for (const m of handInfo.melds) {
    if (m.type === 'sequence') return [];
    for (const t of m.tiles) {
      if (!t.isTerminal) return [];
    }
  }
  if (handInfo.pair && !handInfo.pair.isTerminal) return [];
  return [{ name:'混老頭', han:2 }];
}

function checkShousangen(handInfo, gameState) {
  let dragonTriplets = 0;
  let dragonPair = false;
  for (const m of handInfo.melds) {
    if ((m.type === 'triplet' || m.type === 'kan') && m.tiles[0].isSangen) {
      dragonTriplets++;
    }
  }
  if (handInfo.pair && handInfo.pair.isSangen) dragonPair = true;
  if (dragonTriplets === 2 && dragonPair) {
    return [{ name:'小三元', han:2 }];
  }
  return [];
}

function checkSanshokuDoukou(handInfo, gameState) {
  for (let i = 0; i < handInfo.melds.length; i++) {
    if (handInfo.melds[i].type !== 'triplet' && handInfo.melds[i].type !== 'kan') continue;
    const v = handInfo.melds[i].tiles[0].value;
    const suits = {};
    suits[handInfo.melds[i].tiles[0].suit] = true;
    for (let j = 0; j < handInfo.melds.length; j++) {
      if (i === j || (handInfo.melds[j].type !== 'triplet' && handInfo.melds[j].type !== 'kan')) continue;
      if (handInfo.melds[j].tiles[0].value === v) {
        suits[handInfo.melds[j].tiles[0].suit] = true;
      }
    }
    if (suits.man && suits.pin && suits.sou) {
      return [{ name:'三色同刻', han:2 }];
    }
  }
  return [];
}

function checkSankantsu(handInfo, gameState) {
  let kans = 0;
  for (const m of handInfo.melds) {
    if (m.type === 'kan' || m.type === 'chakan' || m.type === 'ankan') kans++;
  }
  return kans >= 3 ? [{ name:'三槓子', han:2 }] : [];
}

function checkChiitoitsu(handInfo, gameState) {
  if (handInfo.isChiitoitsu) {
    return [{ name:'七対子', han:2 }];
  }
  return [];
}

function checkHonitsu(handInfo, gameState) {
  const suits = {};
  const allTiles = [...(handInfo.hand || handInfo.tiles), ...handInfo.melds.flatMap(m => m.tiles)];
  for (const t of allTiles) {
    if (t.suit !== 'honor') suits[t.suit] = true;
  }
  if (Object.keys(suits).length === 1) {
    const hasHonors = allTiles.some(t => t.isHonor);
    if (hasHonors) {
      const han = isMenzen(handInfo.melds) ? 3 : 2;
      return [{ name:'混一色', han }];
    }
  }
  return [];
}

function checkChinitsu(handInfo, gameState) {
  const suits = {};
  const allTiles = [...(handInfo.hand || handInfo.tiles), ...handInfo.melds.flatMap(m => m.tiles)];
  for (const t of allTiles) {
    suits[t.suit] = true;
  }
  if (Object.keys(suits).length === 1 && !suits.honor) {
    const han = isMenzen(handInfo.melds) ? 6 : 5;
    return [{ name:'清一色', han }];
  }
  return [];
}

function checkTenhou(handInfo, gameState) {
  if (gameState && gameState.isTenhou) {
    return [{ name:'天和', han:13, isYakuman:true }];
  }
  return [];
}

function checkChiihou(handInfo, gameState) {
  if (gameState && gameState.isChiihou) {
    return [{ name:'地和', han:13, isYakuman:true }];
  }
  return [];
}

function checkRenhou(handInfo, gameState) {
  if (gameState && gameState.isRenhou) {
    return [{ name:'人和', han:13, isYakuman:true }];
  }
  return [];
}

function checkKokushi(handInfo, gameState) {
  if (handInfo.isKokushi) {
    return [{ name:'国士無双', han:13, isYakuman:true }];
  }
  return [];
}

const YAKU_CHECKERS = [
  checkTenhou, checkChiihou, checkRenhou,
  checkKokushi, checkChiitoitsu,
  checkRiichi, checkIppatsu, checkMenzenTsumo,
  checkPinfu, checkTanyao, checkIipeikou, checkRyanpeikou,
  checkYakuhai,
  checkSanshokuDoujun, checkSanshokuDoukou, checkIttsuu,
  checkChanta, checkJunchan,
  checkToitoi, checkSanankou, checkHonroutou,
  checkShousangen, checkSankantsu,
  checkHonitsu, checkChinitsu,
];

function checkAllYaku(handInfo, gameState) {
  const yaku = [];
  for (const checker of YAKU_CHECKERS) {
    const result = checker(handInfo, gameState);
    for (const y of result) yaku.push(y);
  }
  return yaku;
}

// ===== Fu Calculation =====

function calculateFu(handInfo, gameState) {
  if (handInfo.isChiitoitsu) return 25;

  const { melds, pair } = handInfo;
  const isOpen = !isMenzen(melds);
  const winType = gameState ? gameState.winType : 'ron';
  const winTile = gameState ? gameState.winTile : null;

  let fu = 20;

  if (winType === 'ron' && !isOpen) {
    fu += 10;
  }

  if (winType === 'tsumo') {
    const isPinfuCheck = (() => {
      if (isOpen) return false;
      for (const m of melds) if (m.type !== 'sequence') return false;
      if (pair.isWind || pair.isSangen) return false;
      if (gameState) {
        if (pair.value === (gameState.seatWind || 0) || pair.value === (gameState.roundWind || 0)) return false;
      }
      return true;
    })();
    if (!isPinfuCheck) {
      fu += 2;
    }
  }

  if (pair) {
    if (pair.isSangen) {
      fu += 2;
    } else if (pair.isWind) {
      let windBonus = 0;
      if (gameState && pair.value === gameState.seatWind) windBonus += 2;
      if (gameState && pair.value === gameState.roundWind) windBonus += 2;
      fu += windBonus;
    }
  }

  for (const m of melds) {
    if (m.type === 'sequence') continue;
    const t = m.tiles[0];
    const isTerminal = t.isTerminal;
    const closed = !m.open;

    if (m.type === 'triplet') {
      if (closed && isTerminal) fu += 8;
      else if (closed) fu += 4;
      else if (isTerminal) fu += 4;
      else fu += 2;
    } else if (m.type === 'kan') {
      if (closed && isTerminal) fu += 32;
      else if (closed) fu += 16;
      else if (isTerminal) fu += 16;
      else fu += 8;
    }
  }

  if (winTile) {
    const waitType = detectWaitTypeSimple(handInfo.hand || [], melds, pair, winTile);
    if (waitType === 'tanki' || waitType === 'kanchan' || waitType === 'penchan') {
      fu += 2;
    }
  }

  fu = Math.ceil(fu / 10) * 10;
  return Math.max(fu, 20);
}

// ===== Scoring =====

function calculateBaseScore(han, fu) {
  if (han >= 5) {
    if (han >= 13) return 8000;
    if (han >= 11) return 6000;
    if (han >= 8) return 4000;
    if (han >= 6) return 3000;
    return 2000;
  }
  let base = fu * Math.pow(2, 2 + han);
  if (base > 2000) base = 2000;
  return base;
}

function ceil100(n) {
  return Math.ceil(n / 100) * 100;
}

function calculatePayments(handInfo, gameState) {
  const han = handInfo.totalHan;
  const fu = handInfo.fu;
  const isDealer = gameState && gameState.isDealer;
  const isTsumo = gameState && gameState.winType === 'tsumo';
  const isYakuman = handInfo.yaku.some(y => y.isYakuman);

  let base;
  if (isYakuman) {
    const yakumanCount = handInfo.yaku.filter(y => y.isYakuman).length;
    base = 8000 * yakumanCount;
  } else {
    base = calculateBaseScore(han, fu);
  }

  if (isDealer) {
    if (isTsumo) {
      const pp = ceil100(base * 2);
      return {
        type: 'tsumo',
        total: pp * 3,
        dealerPayment: pp,
        childPayment: pp,
      };
    } else {
      const payment = ceil100(base * 6);
      return {
        type: 'ron',
        total: payment,
        discarderPayment: payment,
      };
    }
  } else {
    if (isTsumo) {
      const dp = ceil100(base * 2);
      const cp = ceil100(base);
      return {
        type: 'tsumo',
        total: dp + cp * 2,
        dealerPayment: dp,
        childPayment: cp,
      };
    } else {
      const payment = ceil100(base * 4);
      return {
        type: 'ron',
        total: payment,
        discarderPayment: payment,
      };
    }
  }
}

// ===== Main Evaluation =====

function evaluateHand(hand, openMelds, winTile, winType, gameState) {
  let allTiles;
  if (winTile) {
    allTiles = hand.concat([winTile]);
  } else {
    allTiles = hand.slice();
  }
  allTiles = Tile.sortTiles(allTiles);

  const candidates = [];

  const chiitoitsu = checkChiitoitsuDecomp(allTiles);
  if (chiitoitsu && openMelds.length === 0) {
    const handInfo = {
      melds: [],
      pair: null,
      hand: allTiles,
      tiles: allTiles,
      isChiitoitsu: true,
      isKokushi: false,
    };
    const yaku = checkAllYaku(handInfo, { ...gameState, winType, winTile });
    const fu = 25;
    const doraHan = gameState && gameState.doraIndicators ? countDora(allTiles, gameState.doraIndicators) : 0;
    const totalHan = yaku.reduce((s, y) => s + y.han, 0) + doraHan;
    handInfo.yaku = yaku;
    handInfo.fu = fu;
    handInfo.totalHan = totalHan;
    handInfo.doraHan = doraHan;
    candidates.push(handInfo);
  }

  const kokushi = checkKokushiDecomp(allTiles);
  if (kokushi && openMelds.length === 0) {
    const handInfo = {
      melds: [],
      pair: kokushi.pair,
      hand: allTiles,
      tiles: allTiles,
      isChiitoitsu: false,
      isKokushi: true,
    };
    const yaku = checkAllYaku(handInfo, { ...gameState, winType, winTile });
    const fu = 20;
    const doraHan = 0;
    const totalHan = yaku.reduce((s, y) => s + y.han, 0) + doraHan;
    handInfo.yaku = yaku;
    handInfo.fu = fu;
    handInfo.totalHan = totalHan;
    handInfo.doraHan = doraHan;
    candidates.push(handInfo);
  }

  const decomps = findDecompositionsWithOpen(allTiles, openMelds);
  for (const decomp of decomps) {
    const handInfo = {
      melds: decomp.melds,
      pair: decomp.pair,
      hand: allTiles,
      tiles: allTiles,
      isChiitoitsu: false,
      isKokushi: false,
    };
    const yaku = checkAllYaku(handInfo, { ...gameState, winType, winTile });
    const fu = calculateFu(handInfo, { ...gameState, winType, winTile });
    const doraHan = gameState && gameState.doraIndicators ? countDora(allTiles, gameState.doraIndicators) : 0;
    const totalHan = yaku.reduce((s, y) => s + y.han, 0) + doraHan;
    handInfo.yaku = yaku;
    handInfo.fu = fu;
    handInfo.totalHan = totalHan;
    handInfo.doraHan = doraHan;
    candidates.push(handInfo);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.totalHan !== b.totalHan) return b.totalHan - a.totalHan;
    return b.fu - a.fu;
  });

  const best = candidates[0];
  const payments = calculatePayments(best, { ...gameState, winType, winTile });
  const isYakuman = best.yaku.some(y => y.isYakuman);

  return {
    yaku: best.yaku,
    totalHan: best.totalHan,
    fu: best.fu,
    melds: best.melds,
    pair: best.pair,
    payments,
    isYakuman,
    doraHan: best.doraHan,
  };
}

function isWinningHand(hand, openMelds) {
  const allTiles = Tile.sortTiles(hand);
  if (openMelds.length === 0) {
    const c = checkChiitoitsuDecomp(allTiles);
    if (c) return true;
    const k = checkKokushiDecomp(allTiles);
    if (k) return true;
  }
  const decomps = findDecompositionsWithOpen(allTiles, openMelds);
  return decomps.length > 0;
}

function getWaitingTiles(hand, openMelds) {
  const waits = [];
  const checked = {};
  for (const suit of ['man','pin','sou','honor']) {
    const max = suit === 'honor' ? 7 : 9;
    for (let v = 1; v <= max; v++) {
      const testTile = new Tile(suit, v);
      const k = testTile.key();
      if (checked[k]) continue;
      checked[k] = true;
      const testHand = hand.concat([testTile]);
      if (isWinningHand(Tile.sortTiles(testHand), openMelds)) {
        waits.push(testTile);
      }
    }
  }
  return waits;
}

function checkTenpai(hand, openMelds) {
  return getWaitingTiles(hand, openMelds).length > 0;
}

function getDoraCount(tiles, doraIndicators) {
  return countDora(tiles, doraIndicators);
}
