// ===== Difficulty Config =====

const AI_DIFFICULTY = {
  expert: {
    name: '高手',
    callRate: 0.75,
    riichiRate: 0.8,
    defenseLevel: 2,
  },
  normal: {
    name: '一般人',
    callRate: 0.65,
    riichiRate: 0.5,
    defenseLevel: 1,
  },
  beginner: {
    name: '初學者',
    callRate: 0.8,
    riichiRate: 0.2,
    defenseLevel: 0,
  },
};

// ===== Block Counting — Shanten Estimation =====

function countBlocks(hand) {
  const counts = getCounts(hand);
  const suitTiles = { man:[], pin:[], sou:[] };
  const honorCounts = {};

  for (const [k, c] of Object.entries(counts)) {
    let suit, val;
    if (k.startsWith('man')) { suit='man'; val=parseInt(k.slice(3)); }
    else if (k.startsWith('pin')) { suit='pin'; val=parseInt(k.slice(3)); }
    else if (k.startsWith('sou')) { suit='sou'; val=parseInt(k.slice(3)); }
    else { suit='honor'; val=parseInt(k.slice(5)); }

    if (suit === 'honor') {
      honorCounts[val] = c;
    } else {
      for (let i = 0; i < c; i++) suitTiles[suit].push(val);
    }
  }

  let blocks = 0;
  let pairs = 0;

  for (const s of ['man','pin','sou']) {
    const vals = suitTiles[s].sort((a, b) => a - b);
    const used = new Array(vals.length).fill(false);

    for (let i = 0; i < vals.length; i++) {
      if (used[i]) continue;
      if (i + 2 < vals.length && vals[i] === vals[i+1] && vals[i] === vals[i+2]) {
        used[i] = used[i+1] = used[i+2] = true;
        blocks++;
        continue;
      }
    }

    for (let i = 0; i < vals.length; i++) {
      if (used[i]) continue;
      if (i + 1 < vals.length && vals[i] === vals[i+1]) {
        used[i] = used[i+1] = true;
        pairs++;
        continue;
      }
    }

    for (let i = 0; i < vals.length; i++) {
      if (used[i]) continue;
      const v = vals[i];
      let foundSeq = false;
      for (let j = i + 1; j < vals.length; j++) {
        if (used[j] || vals[j] !== v + 1) continue;
        for (let k = j + 1; k < vals.length; k++) {
          if (used[k] || vals[k] !== v + 2) continue;
          used[i] = used[j] = used[k] = true;
          blocks++;
          foundSeq = true;
          break;
        }
        if (foundSeq) break;
      }
    }

    for (let i = 0; i < vals.length; i++) {
      if (used[i]) continue;
      for (let j = i + 1; j < vals.length; j++) {
        if (used[j]) continue;
        if (vals[j] === vals[i] + 1 || vals[j] === vals[i] + 2) {
          used[i] = used[j] = true;
          blocks++;
          break;
        }
      }
    }

    for (let i = 0; i < vals.length; i++) {
      if (!used[i]) blocks++;
    }
  }

  for (const [val, c] of Object.entries(honorCounts)) {
    if (c >= 3) blocks++;
    else if (c === 2) pairs++;
    else blocks++;
  }

  blocks += Math.floor(pairs / 2);
  pairs = pairs % 2;

  return { blocks, hasPair: pairs > 0 };
}

function estimateShanten(hand, melds) {
  const meldCount = melds.length;
  const result = countBlocks(hand);
  const effectiveBlocks = result.blocks + meldCount;
  const shanten = 8 - effectiveBlocks * 2 - (result.hasPair ? 1 : 0) - meldCount;
  return Math.max(0, shanten);
}

// ===== Tile Danger Assessment =====

function isGenbutsu(game, playerIdx, tile) {
  const p = game.players[playerIdx];
  return p.discards.some(d => d.key() === tile.key());
}

function tileDangerLevel(game, tile) {
  let danger = 0;

  for (let i = 0; i < 4; i++) {
    if (i === game.currentPlayer) continue;
    const p = game.players[i];
    if (!p.isRiichi && p.melds.length === 0) continue;

    if (isGenbutsu(game, i, tile)) continue;

    danger += p.isRiichi ? 3 : 1;
    if (p.melds.length >= 2) danger += 1;
    if (tile.isHonor) danger += 1;
    if (tile.isTerminal && !tile.isHonor) danger += 0.5;
  }

  return danger;
}

function safeDiscards(game, playerIdx) {
  const safe = [];
  const p = game.players[playerIdx];
  const counts = getCounts(p.hand);
  for (const k of Object.keys(counts)) {
    let shortKey;
    if (k.startsWith('man')) shortKey = 'm' + k.slice(3);
    else if (k.startsWith('pin')) shortKey = 'p' + k.slice(3);
    else if (k.startsWith('sou')) shortKey = 's' + k.slice(3);
    else shortKey = 'z' + k.slice(5);
    const tile = Tile.fromString(shortKey);
    let isSafe = true;
    for (let i = 0; i < 4; i++) {
      if (i === playerIdx) continue;
      const other = game.players[i];
      if (other.isRiichi || other.melds.length > 0) {
        if (!isGenbutsu(game, i, tile)) {
          isSafe = false;
          break;
        }
      }
    }
    if (isSafe) safe.push(k);
  }
  return safe;
}

// ===== Discard Selection =====

function evaluateDiscard(game, playerIdx, tileIdx) {
  const p = game.players[playerIdx];
  const hand = p.hand;
  const tile = hand[tileIdx];
  const testHand = hand.filter((_, i) => i !== tileIdx);

  const waits = getWaitingTiles(testHand, p.melds);
  const shanten = waits.length > 0 ? 0 : estimateShanten(testHand, p.melds);
  const danger = tileDangerLevel(game, tile);
  const isRiichiOrMeld = game.players.some(pl => pl.isRiichi || pl.melds.length > 0);
  const waitCount = waits.length;

  let value = 0;
  value -= shanten * 100;
  value += waitCount * 2;
  if (isRiichiOrMeld) value -= danger * 10;
  if (tile.isHonor || tile.isTerminal) value -= 1;

  return { idx: tileIdx, shanten, waitCount, danger, value, waits };
}

function expertDiscard(game, playerIdx) {
  const p = game.players[playerIdx];
  const hand = p.hand;
  const uniq = {};
  for (let i = 0; i < hand.length; i++) {
    const k = hand[i].key();
    if (!uniq[k]) uniq[k] = [];
    uniq[k].push(i);
  }

  const evals = [];
  for (const [k, indices] of Object.entries(uniq)) {
    const testHand = removeTiles(hand, k, 1);
    const waits = getWaitingTiles(testHand, p.melds);
    const shanten = waits.length > 0 ? 0 : estimateShanten(testHand, p.melds);
    const tile = hand[indices[0]];
    const danger = tileDangerLevel(game, tile);

    let safetyBonus = 0;
    if (danger === 0) safetyBonus = 100;

    const value = -shanten * 1000 + waits.length * 20 - danger * 50 + safetyBonus;
    evals.push({ idx: indices[0], value, shanten, waits });
  }

  evals.sort((a, b) => b.value - a.value);
  return evals[0].idx;
}

function normalDiscard(game, playerIdx) {
  const p = game.players[playerIdx];
  const hand = p.hand;
  const uniq = {};
  for (let i = 0; i < hand.length; i++) {
    const k = hand[i].key();
    if (!uniq[k]) uniq[k] = [];
    uniq[k].push(i);
  }

  const evals = [];
  const hasThreat = game.players.some(pl => pl.isRiichi || pl.melds.length > 0);
  for (const [k, indices] of Object.entries(uniq)) {
    const testHand = removeTiles(hand, k, 1);
    const waits = getWaitingTiles(testHand, p.melds);
    const shanten = waits.length > 0 ? 0 : estimateShanten(testHand, p.melds);
    let value = -shanten * 100 + waits.length * 3;
    if (hasThreat) {
      const danger = tileDangerLevel(game, hand[indices[0]]);
      value -= danger * 20;
    }
    evals.push({ idx: indices[0], value, shanten, waits });
  }

  evals.sort((a, b) => b.value - a.value);
  const bestShanten = evals[0].shanten;
  const best = evals.filter(e => e.shanten === bestShanten);
  return best[Math.floor(Math.random() * best.length)].idx;
}

function beginnerDiscard(game, playerIdx) {
  const p = game.players[playerIdx];
  const hand = p.hand;
  const counts = getCounts(hand);

  const honors = [];
  const terminals = [];
  const others = [];

  for (let i = 0; i < hand.length; i++) {
    const t = hand[i];
    if (t.isHonor && counts[t.key()] < 2) honors.push(i);
    else if (t.isTerminal && !t.isHonor) terminals.push(i);
    else others.push(i);
  }

  const pool = [];
  if (honors.length > 0) pool.push(...honors);
  if (terminals.length > 0) pool.push(...terminals);
  if (others.length > 0) pool.push(...others);
  if (pool.length === 0) {
    for (let i = 0; i < hand.length; i++) pool.push(i);
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function aiChooseDiscard(game, playerIdx) {
  const p = game.players[playerIdx];
  const diff = p.difficulty;
  if (diff === 'expert') return expertDiscard(game, playerIdx);
  if (diff === 'normal') return normalDiscard(game, playerIdx);
  return beginnerDiscard(game, playerIdx);
}

// ===== Call Decision =====

function aiDecideCall(game, availableCalls) {
  if (availableCalls.length === 0) return null;

  const ronCall = availableCalls.find(c => c.type === 'ron');
  if (ronCall) return ronCall;

  const humanCall = availableCalls.find(c => game.players[c.playerIdx].isHuman);
  if (humanCall) return null;

  const callsByPlayer = {};
  for (const call of availableCalls) {
    if (!callsByPlayer[call.playerIdx]) callsByPlayer[call.playerIdx] = [];
    callsByPlayer[call.playerIdx].push(call);
  }

  let bestCall = null;
  let bestWeight = -1;

  for (const [pIdx, calls] of Object.entries(callsByPlayer)) {
    const player = game.players[pIdx];
    const cfg = AI_DIFFICULTY[player.difficulty];
    const shantenBefore = estimateShanten(player.hand, player.melds);

    for (const call of calls) {
      if (call.type === 'pon' || call.type === 'chi') {
        let handAfter;
        if (call.type === 'pon') {
          handAfter = removeTiles(player.hand, call.tile.key(), 2);
        } else {
          handAfter = removeTiles(player.hand, call.chiSets[0][0].key(), 1);
          handAfter = removeTiles(handAfter, call.chiSets[0][1].key(), 1);
        }
        const shantenAfter = estimateShanten(handAfter, player.melds);
        if (shantenAfter >= shantenBefore) continue;
      }

      let baseRate = cfg.callRate;
      if (call.type === 'chi') baseRate *= 0.7;
      const weight = baseRate * 100;

      if (weight > bestWeight) {
        bestWeight = weight;
        bestCall = call;
      }
    }
  }

  if (bestCall && Math.random() * 100 < bestWeight) return bestCall;
  return null;
}

// ===== Riichi Decision =====

function aiDecideRiichi(game, playerIdx) {
  const p = game.players[playerIdx];
  if (p.isRiichi) return false;
  if (p.melds.length > 0) return false;
  if (game.wall.getRemainingCount() < 4) return false;
  if (!checkTenpai(p.hand, p.melds)) return false;

  const cfg = AI_DIFFICULTY[p.difficulty];
  if (Math.random() < cfg.riichiRate) return true;
  return false;
}

// ===== Tsumo Decision =====

function aiDecideTsumo(game, playerIdx) {
  return true;
}

// ===== Kan Decision =====

function aiDecideKan(game, playerIdx) {
  const p = game.players[playerIdx];
  if (p.isRiichi) return false;

  const counts = getCounts(p.hand);
  for (const [k, c] of Object.entries(counts)) {
    if (c === 4) return Math.random() < 0.5;
  }
  return false;
}
