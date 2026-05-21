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
  let melds = 0;
  let pairs = 0;
  let partials = 0;
  let isolated = 0;

  for (const suit of ['man', 'pin', 'sou']) {
    const vals = [];
    for (let v = 1; v <= 9; v++) {
      const c = counts[suit + v] || 0;
      for (let i = 0; i < c; i++) vals.push(v);
    }
    if (vals.length === 0) continue;

    const used = new Array(vals.length).fill(false);

    // Triplets
    for (let i = 0; i < vals.length - 2; i++) {
      if (used[i] || used[i+1] || used[i+2]) continue;
      if (vals[i] === vals[i+1] && vals[i] === vals[i+2]) {
        used[i] = used[i+1] = used[i+2] = true;
        melds++;
      }
    }

    // Sequences (low to high)
    for (let i = 0; i < vals.length - 2; i++) {
      if (used[i]) continue;
      for (let j = i+1; j < vals.length - 1; j++) {
        if (used[j] || vals[j] !== vals[i] + 1) continue;
        for (let k = j+1; k < vals.length; k++) {
          if (used[k] || vals[k] !== vals[i] + 2) continue;
          used[i] = used[j] = used[k] = true;
          melds++;
          break;
        }
        if (used[i]) break;
      }
    }

    // Pairs
    for (let i = 0; i < vals.length - 1; i++) {
      if (used[i]) continue;
      if (!used[i+1] && vals[i] === vals[i+1]) {
        used[i] = used[i+1] = true;
        pairs++;
      }
    }

    // Partials: adjacent (gap=1), then gap=2
    for (let gap = 1; gap <= 2; gap++) {
      for (let i = 0; i < vals.length - 1; i++) {
        if (used[i]) continue;
        for (let j = i+1; j < vals.length; j++) {
          if (used[j] || vals[j] !== vals[i] + gap) continue;
          used[i] = used[j] = true;
          partials++;
          break;
        }
      }
    }

    for (let i = 0; i < vals.length; i++) {
      if (!used[i]) isolated++;
    }
  }

  for (let v = 1; v <= 7; v++) {
    const c = counts['honor' + v] || 0;
    if (c >= 3) {
      melds += Math.floor(c / 3);
      const rem = c % 3;
      if (rem === 2) pairs++;
      else if (rem === 1) isolated++;
    } else if (c === 2) {
      pairs++;
    } else {
      isolated += c;
    }
  }

  return { melds, pairs, partials, isolated };
}

function estimateShanten(hand, melds) {
  const calledMelds = melds.length;
  const result = countBlocks(hand);
  const totalMelds = result.melds + calledMelds;

  // When 4+ melds already formed, only the pair matters
  if (totalMelds >= 4) {
    return result.pairs > 0 ? 0 : 1;
  }

  const partialBlocks = result.partials + Math.min(result.pairs, 1);
  const maxPartials = Math.max(0, 4 - totalMelds);
  const effectivePartials = Math.min(partialBlocks, maxPartials);
  const shanten = (4 - totalMelds) * 2 - effectivePartials - Math.min(result.pairs, 1);
  return Math.max(0, shanten);
}

function countImprovingTiles(hand, melds) {
  let count = 0;
  const curShanten = estimateShanten(hand, melds);
  if (curShanten === 0) return 0;
  for (let v = 1; v <= 34; v++) {
    const tile = valueToTile(v);
    const testHand = [...hand, tile];
    const newShanten = estimateShanten(testHand, melds);
    if (newShanten < curShanten) count++;
  }
  return count;
}

function valueToTile(v) {
  if (v <= 9) return new Tile('man', v);
  if (v <= 18) return new Tile('pin', v - 9);
  if (v <= 27) return new Tile('sou', v - 18);
  return new Tile('honor', v - 27);
}

// ===== Tile Danger Assessment =====

function isGenbutsu(game, playerIdx, tile) {
  const p = game.players[playerIdx];
  return p.discards.some(d => d.key() === tile.key());
}

function isSuji(game, playerIdx, tile) {
  const p = game.players[playerIdx];
  if (tile.suit === 'honor') return false;
  const v = tile.value;
  for (const sujiV of [v - 3, v + 3]) {
    if (sujiV < 1 || sujiV > 9) continue;
    const sujiTile = new Tile(tile.suit, sujiV);
    if (p.discards.some(d => d.key() === sujiTile.key())) return true;
  }
  return false;
}

function tileDangerLevel(game, tile, useSuji) {
  let danger = 0;

  for (let i = 0; i < 4; i++) {
    if (i === game.currentPlayer) continue;
    const p = game.players[i];
    if (!p.isRiichi && p.melds.length === 0) continue;

    if (isGenbutsu(game, i, tile)) continue;

    if (useSuji && isSuji(game, i, tile)) {
      danger += p.isRiichi ? 0.5 : 0.2;
      continue;
    }

    let tileDanger = p.isRiichi ? 4 : 1.5;
    if (p.melds.length >= 2) tileDanger += 1;
    if (tile.isHonor) tileDanger += 1;
    if (tile.isTerminal && !tile.isHonor) tileDanger += 0.5;
    danger += tileDanger;
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

// ===== Wait Quality =====

function getWaitQuality(hand, melds) {
  const waits = getWaitingTiles(hand, melds);
  if (waits.length === 0) return { count: 0, quality: 0, tiles: [] };

  let quality = 0;
  let totalRemaining = 0;
  for (const t of waits) {
    const remaining = 4 - countVisibleTiles(t);
    totalRemaining += remaining;
    quality += remaining * 2;
  }
  return { count: waits.length, quality, tiles: waits, totalRemaining };
}

function countVisibleTiles(tile) {
  let count = 0;
  for (const p of game.players) {
    for (const d of p.discards) { if (d.key() === tile.key()) count++; }
    for (const t of p.hand) { if (t.key() === tile.key()) count++; }
    for (const m of p.melds) {
      for (const t of m.tiles) { if (t.key() === tile.key()) count++; }
    }
  }
  return count;
}

// ===== Discard Selection =====

function expertDiscard(game, playerIdx) {
  const p = game.players[playerIdx];
  const hand = p.hand;
  const uniq = {};
  for (let i = 0; i < hand.length; i++) {
    const k = hand[i].key();
    if (!uniq[k]) uniq[k] = [];
    uniq[k].push(i);
  }

  let bestIdx = -1;
  let bestVal = -Infinity;

  for (const [k, indices] of Object.entries(uniq)) {
    const testHand = removeTiles(hand, k, 1);
    const tile = hand[indices[0]];
    const waits = getWaitingTiles(testHand, p.melds);
    const shanten = waits.length > 0 ? 0 : estimateShanten(testHand, p.melds);

    let val = 0;

    if (waits.length > 0) {
      const wq = getWaitQuality(testHand, p.melds);
      val = 100000 - shanten * 10000 + wq.quality * 10 + wq.count * 50;
    } else {
      const improve = countImprovingTiles(testHand, p.melds);
      val = -shanten * 10000 + improve * 8;
    }

    const hasThreat = game.players.some(pl => pl.isRiichi || pl.melds.length > 0);
    if (hasThreat) {
      const danger = tileDangerLevel(game, tile, true);
      val -= danger * 30;
    }

    if (indices.length >= 2) val += 50; // keep pairs

    if (val > bestVal) {
      bestVal = val;
      bestIdx = indices[0];
    }
  }

  return bestIdx;
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
    const tile = hand[indices[0]];
    const waits = getWaitingTiles(testHand, p.melds);
    const shanten = waits.length > 0 ? 0 : estimateShanten(testHand, p.melds);

    let val = -shanten * 100 + (waits.length > 0 ? waits.length * 5 : 0);

    if (hasThreat) {
      const danger = tileDangerLevel(game, tile, false);
      val -= danger * 15;
    }

    if (indices.length >= 2) val += 10;

    evals.push({ idx: indices[0], val, shanten });
  }

  evals.sort((a, b) => b.val - a.val);
  const bestShanten = evals[0].shanten;
  const candidates = evals.filter(e => e.shanten === bestShanten);
  return candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)].idx
    : evals[0].idx;
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
        const meldsAfter = [...player.melds, { type: call.type }];
        const shantenAfter = estimateShanten(handAfter, meldsAfter);
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
