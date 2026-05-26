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
    callRate: 0.7,
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
    const suitCounts = [];
    for (let v = 1; v <= 9; v++) {
      suitCounts.push(counts[suit + v] || 0);
    }
    const result = solveSuitDP(suitCounts);
    melds += result.melds;
    pairs += result.pairs;
    partials += result.partials;
    isolated += result.isolated;
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

function solveSuitDP(counts) {
  const memo = new Map();
  const keyBuf = [];

  function dp(pos, c) {
    if (pos >= 9) return { melds: 0, pairs: 0, partials: 0, isolated: 0 };

    keyBuf.length = 0;
    keyBuf.push(pos);
    for (let i = pos; i < 9; i++) { keyBuf.push(c[i]); }
    const key = keyBuf.join(',');
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const cnt = c[pos];
    let best = null;

    if (cnt === 0) {
      best = dp(pos + 1, c);
    } else {
      let r;

      // All isolated at this position
      const skipC = c.slice();
      skipC[pos] = 0;
      best = addResult({ melds: 0, pairs: 0, partials: 0, isolated: cnt }, dp(pos + 1, skipC));

      // Pair
      if (cnt >= 2) {
        const nc = c.slice();
        nc[pos] -= 2;
        r = addResult({ melds: 0, pairs: 1, partials: 0, isolated: 0 }, dp(pos, nc));
        if (isBetter(r, best)) best = r;
      }

      // Triplet
      if (cnt >= 3) {
        const nc = c.slice();
        nc[pos] -= 3;
        r = addResult({ melds: 1, pairs: 0, partials: 0, isolated: 0 }, dp(pos, nc));
        if (isBetter(r, best)) best = r;
      }

      // Sequence
      if (pos <= 6 && cnt >= 1 && c[pos + 1] >= 1 && c[pos + 2] >= 1) {
        const nc = c.slice();
        nc[pos] -= 1; nc[pos + 1] -= 1; nc[pos + 2] -= 1;
        r = addResult({ melds: 1, pairs: 0, partials: 0, isolated: 0 }, dp(pos, nc));
        if (isBetter(r, best)) best = r;
      }

      // Partial adjacent
      if (pos <= 7 && cnt >= 1 && c[pos + 1] >= 1) {
        const nc = c.slice();
        nc[pos] -= 1; nc[pos + 1] -= 1;
        r = addResult({ melds: 0, pairs: 0, partials: 1, isolated: 0 }, dp(pos, nc));
        if (isBetter(r, best)) best = r;
      }

      // Partial gap
      if (pos <= 6 && cnt >= 1 && c[pos + 2] >= 1) {
        const nc = c.slice();
        nc[pos] -= 1; nc[pos + 2] -= 1;
        r = addResult({ melds: 0, pairs: 0, partials: 1, isolated: 0 }, dp(pos, nc));
        if (isBetter(r, best)) best = r;
      }
    }

    memo.set(key, best);
    return best;
  }

  return dp(0, counts);
}

function addResult(a, b) {
  return {
    melds: a.melds + b.melds,
    pairs: a.pairs + b.pairs,
    partials: a.partials + b.partials,
    isolated: a.isolated + b.isolated,
  };
}

function isBetter(a, b) {
  const sa = a.melds * 20 + Math.min(a.pairs, 1) * 20 + a.partials * 10 - a.isolated;
  const sb = b.melds * 20 + Math.min(b.pairs, 1) * 20 + b.partials * 10 - b.isolated;
  return sa > sb;
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

function getWaitQuality(game, hand, melds) {
  const waits = getWaitingTiles(hand, melds);
  if (waits.length === 0) return { count: 0, quality: 0, tiles: [] };

  let quality = 0;
  let totalRemaining = 0;
  for (const t of waits) {
    const remaining = 4 - countVisibleTiles(game, t);
    totalRemaining += remaining;
    quality += remaining * 2;
  }
  return { count: waits.length, quality, tiles: waits, totalRemaining };
}

function countVisibleTiles(game, tile) {
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

// ===== Isolated Tile Detection =====

function discardPriority(tile) {
  if (tile.isHonor) return 4;
  if (tile.isTerminal) return 3;
  const v = tile.value;
  if (v === 2 || v === 8) return 2;
  return 1;
}

function isIsolated(hand, tile) {
  const counts = getCounts(hand);
  if ((counts[tile.key()] || 0) !== 1) return false;
  if (tile.isHonor) return true;
  const s = tile.suit;
  const v = tile.value;
  for (let d = -2; d <= 2; d++) {
    if (d === 0) continue;
    const adj = v + d;
    if (adj < 1 || adj > 9) continue;
    if ((counts[s + adj] || 0) > 0) return false;
  }
  return true;
}

function aiEvaluateTargets(game, playerIdx) {
  const p = game.players[playerIdx];
  const hand = p.hand;
  const melds = p.melds;
  const counts = getCounts(hand);
  const diff = p.difficulty;
  
  const targets = {};
  const isMenzen = melds.length === 0;
  const shanten = estimateShanten(hand, melds);
  
  // Tanyao (斷幺九) - All difficulties
  let nonTanyaoCount = 0;
  for (const t of hand) {
    if (t.isTerminal || t.isHonor) nonTanyaoCount++;
  }
  for (const m of melds) {
    for (const t of m.tiles) {
      if (t.isTerminal || t.isHonor) { nonTanyaoCount = 999; break; }
    }
  }
  if (nonTanyaoCount < 5) {
    targets.tanyao = (5 - nonTanyaoCount) * 20;
  }

  // Yakuhai (役牌) - All difficulties
  let yakuhaiCount = 0;
  for (let v = 1; v <= 7; v++) {
    const key = 'honor' + v;
    const c = counts[key] || 0;
    let isYaku = false;
    if (v >= 5) isYaku = true; // Sangen
    else if (v === game.roundWind + 1 || v === p.seatWind) isYaku = true;
    
    if (isYaku) {
      if (c >= 2) yakuhaiCount += (c >= 3 ? 100 : 50);
      for (const m of melds) {
        if ((m.type === 'triplet' || m.type === 'kan') && m.tiles[0].key() === key) {
          yakuhaiCount += 100;
        }
      }
    }
  }
  if (yakuhaiCount > 0) targets.yakuhai = yakuhaiCount;

  if (diff === 'normal' || diff === 'expert') {
    // Honitsu (混一色)
    for (const suit of ['man', 'pin', 'sou']) {
      let suitCount = 0;
      let otherSuitCount = 0;
      for (const t of hand) {
        if (t.suit === suit || t.isHonor) suitCount++;
        else otherSuitCount++;
      }
      for (const m of melds) {
        for (const t of m.tiles) {
          if (t.suit === suit || t.isHonor) suitCount++;
          else { otherSuitCount = 999; break; }
        }
      }
      if (suitCount >= 8 && otherSuitCount < 4) {
        targets.honitsu = (suitCount - 7) * 20;
      }
    }

    // Toitoi (對對和)
    const blocks = countBlocks(hand);
    let triplets = blocks.melds;
    let pairs = blocks.pairs;
    for (const m of melds) {
      if (m.type === 'triplet' || m.type === 'kan') triplets++;
    }
    if (triplets + pairs >= 4) {
      targets.toitoi = (triplets * 30) + (pairs * 10);
    }
    
    // Riichi (立直)
    if (isMenzen && shanten <= 3) {
      targets.riichi = (4 - shanten) * 25;
    }
  }

  if (diff === 'expert') {
    // Kokushi (國士無雙)
    if (isMenzen) {
      const orphans = new Set();
      for (const t of hand) {
        if (t.isTerminal || t.isHonor) orphans.add(t.key());
      }
      if (orphans.size >= 8) {
        targets.kokushi = orphans.size * 20;
      }
    }

    // Chiitoitsu (七對子)
    if (isMenzen) {
      let pairCount = 0;
      for (const c of Object.values(counts)) {
        if (c >= 2) pairCount++;
      }
      if (pairCount >= 4) {
        targets.chiitoitsu = pairCount * 25;
      }
    }

    // Survival Mode (存活模式) - Expert only
    const remaining = game.wall.getRemainingCount();
    const hasRiichiThreat = game.players.some((pl, idx) => idx !== playerIdx && pl.isRiichi);
    if (remaining <= 16 && shanten > 0 && hasRiichiThreat) {
      targets.survival = 1000;
    }
  }

  return targets;
}

// ===== Discard Selection =====

function expertDiscard(game, playerIdx) {
  const p = game.players[playerIdx];
  const hand = p.hand;
  const targets = aiEvaluateTargets(game, playerIdx);
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

    if (targets.survival) {
      // In survival mode, efficiency and yaku don't matter. Only safety.
      const danger = tileDangerLevel(game, tile, true);
      val = -danger * 10000;
      // If same danger, prefer higher discard priority (e.g. keep middle tiles for later)
      val += discardPriority(tile) * 100;
    } else {
      if (waits.length > 0) {
        const wq = getWaitQuality(game, testHand, p.melds);
        val = 100000 - shanten * 10000 + wq.quality * 10 + wq.count * 50;
      } else {
        const improve = countImprovingTiles(testHand, p.melds);
        val = -shanten * 100000 + improve * 8;
      }

      const resultIsolated = countBlocks(testHand).isolated;
      val -= resultIsolated * 200;

      // Yaku-aware scoring
      if (targets.kokushi && (tile.isTerminal || tile.isHonor)) val -= 50000;
      if (targets.tanyao && (tile.isTerminal || tile.isHonor)) val += 30000;
      if (targets.honitsu) {
        const hSuit = Object.keys(getCounts(hand)).find(sk => sk.startsWith('man') || sk.startsWith('pin') || sk.startsWith('sou'))?.slice(0, 3);
        if (tile.suit !== hSuit && !tile.isHonor) val += 20000;
      }

      const hasThreat = game.players.some(pl => pl.isRiichi || pl.melds.length > 0);
      if (hasThreat) {
        const cfg = AI_DIFFICULTY[p.difficulty];
        const danger = tileDangerLevel(game, tile, cfg.defenseLevel >= 2);
        val -= danger * cfg.defenseLevel * 15;
      }

      if (indices.length >= 2 && !targets.kokushi) val += 50; // keep pairs

      // Yaku pair value (negative = want to keep)
      if (indices.length >= 2 && tile.isHonor) {
        if (tile.isSangen) val -= 300;
        else if (tile.value === game.seatWind || tile.value === game.roundWind) val -= 200;
      }

      if (isIsolated(hand, tile)) {
        if (tile.isHonor) val += 500;
        else if (tile.isTerminal) val += 300;
        else val += 100;
      }

      val += discardPriority(tile) * 5;
    }

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
  const targets = aiEvaluateTargets(game, playerIdx);
  const uniq = {};
  for (let i = 0; i < hand.length; i++) {
    const k = hand[i].key();
    if (!uniq[k]) uniq[k] = [];
    uniq[k].push(i);
  }

  const evals = [];

  for (const [k, indices] of Object.entries(uniq)) {
    const testHand = removeTiles(hand, k, 1);
    const tile = hand[indices[0]];
    const shantenEst = estimateShanten(testHand, p.melds);
    const waits = shantenEst >= 2 ? [] : getWaitingTiles(testHand, p.melds);
    const shanten = waits.length > 0 ? 0 : shantenEst;
    const isolated = countBlocks(testHand).isolated;

    let val = (isIsolated(hand, tile)
      ? (tile.isHonor ? 500 : tile.isTerminal ? 300 : 100)
      : 0)
      + (waits.length > 0 ? Math.min(waits.length, 9) * 10 : 0)
      + (indices.length >= 2 ? 50 : 0);

    // Acceptance evaluation for non-tenpai
    if (shanten > 0) {
      const improve = countImprovingTiles(testHand, p.melds);
      val += improve * 5;
    }

    // Yaku-aware
    if (targets.tanyao && (tile.isTerminal || tile.isHonor)) val += 500;
    if (targets.honitsu) {
      const suitCounts = {man:0, pin:0, sou:0};
      for(const t of hand) if(t.suit!=='honor') suitCounts[t.suit]++;
      const bestSuit = Object.entries(suitCounts).sort((a,b)=>b[1]-a[1])[0][0];
      if (tile.suit !== bestSuit && !tile.isHonor) val += 400;
    }

    // Yaku pair value
    if (indices.length >= 2 && tile.isHonor) {
      if (tile.isSangen) val += 300;
      else if (tile.value === game.seatWind || tile.value === game.roundWind) val += 200;
    }

    const hasThreat = game.players.some(pl => pl.isRiichi || pl.melds.length > 0);
    if (hasThreat && AI_DIFFICULTY[p.difficulty].defenseLevel > 0) {
      const danger = tileDangerLevel(game, tile, false);
      val -= danger * AI_DIFFICULTY[p.difficulty].defenseLevel * 10;
    }

    val += discardPriority(tile);

    evals.push({ idx: indices[0], val, shanten, isolated });
  }

  evals.sort((a, b) =>
    a.shanten - b.shanten ||
    a.isolated - b.isolated ||
    b.val - a.val
  );
  const bestShanten = evals[0].shanten;
  const shantenCandidates = evals.filter(e => e.shanten === bestShanten);
  const bestIsolated = shantenCandidates[0].isolated;
  const isoCandidates = shantenCandidates.filter(e => e.isolated === bestIsolated);
  const bestVal = isoCandidates[0].val;
  const candidates = isoCandidates.filter(e => e.val === bestVal);
  return candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)].idx
    : evals[0].idx;
}

function beginnerDiscard(game, playerIdx) {
  const p = game.players[playerIdx];
  const hand = p.hand;
  const counts = getCounts(hand);
  const targets = aiEvaluateTargets(game, playerIdx);

  const honors = [];
  const terminals = [];
  const others = [];

  for (let i = 0; i < hand.length; i++) {
    const t = hand[i];
    if (t.isHonor && counts[t.key()] < 2) honors.push(i);
    else if (t.isTerminal && !t.isHonor) terminals.push(i);
    else others.push(i);
  }

  // Tanyao aware for beginner
  if (targets.tanyao) {
    const pool = [...honors, ...terminals];
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
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

function aiDecideCall(game, availableCalls, forceDifficulty = null) {
  if (availableCalls.length === 0) return null;

  const ronCall = availableCalls.find(c => c.type === 'ron');
  if (ronCall) return ronCall;

  const humanCall = availableCalls.find(c => game.players[c.playerIdx].isHuman);
  if (humanCall && !forceDifficulty) return null;

  const callsByPlayer = {};
  for (const call of availableCalls) {
    if (!callsByPlayer[call.playerIdx]) callsByPlayer[call.playerIdx] = [];
    callsByPlayer[call.playerIdx].push(call);
  }

  let bestCall = null;
  let bestWeight = -1;

  for (const [pIdxStr, calls] of Object.entries(callsByPlayer)) {
    const pIdx = parseInt(pIdxStr);
    const player = game.players[pIdx];
    const diff = forceDifficulty || player.difficulty;
    const cfg = AI_DIFFICULTY[diff];
    const shantenBefore = estimateShanten(player.hand, player.melds);
    const targets = aiEvaluateTargets(game, pIdx);

    for (const call of calls) {
      // Strategy Check
      if (targets.kokushi || targets.chiitoitsu || (targets.riichi && shantenBefore <= 1)) {
        if (call.type !== 'ron') continue;
      }

      if (call.type === 'pon' || call.type === 'chi' || call.type === 'kan') {
        const testChiSets = call.type === 'chi' ? call.chiSets : [null];
        
        for (let ci = 0; ci < testChiSets.length; ci++) {
          let handAfter;
          if (call.type === 'pon') {
            handAfter = removeTiles(player.hand, call.tile.key(), 2);
          } else if (call.type === 'kan') {
            handAfter = removeTiles(player.hand, call.tile.key(), 3);
          } else {
            handAfter = [...player.hand];
            for (const ct of testChiSets[ci]) {
              if (ct.key() === call.tile.key()) continue;
              handAfter = removeTiles(handAfter, ct.key(), 1);
            }
          }
          const meldsAfter = [...player.melds, { type: call.type }];
          const shantenAfter = estimateShanten(handAfter, meldsAfter);
          
          if (shantenAfter >= shantenBefore) continue;

          // Yaku potential check
          let weightMultiplier = 1.0;
          const isYakuhai = (call.type === 'pon' || call.type === 'kan') && 
                           call.tile.isHonor && 
                           (call.tile.isSangen || call.tile.value === game.roundWind + 1 || call.tile.value === player.seatWind);
          
          if (isYakuhai) {
            weightMultiplier = 1.5;
          } else if (targets.tanyao) {
            if (call.tile.isTerminal || call.tile.isHonor) weightMultiplier = 0.1;
            else weightMultiplier = 1.2;
          } else if (targets.honitsu) {
            const suitCounts = {man:0, pin:0, sou:0};
            for(const t of player.hand) if(t.suit!=='honor') suitCounts[t.suit]++;
            const bestSuit = Object.entries(suitCounts).sort((a,b)=>b[1]-a[1])[0][0];
            if (call.tile.suit === bestSuit || call.tile.isHonor) weightMultiplier = 1.3;
            else weightMultiplier = 0.1;
          } else {
            if (game.wall.getRemainingCount() > 40) weightMultiplier = 0.5;
            else weightMultiplier = 0.8;
          }

          let baseRate = cfg.callRate;
          if (call.type === 'chi') baseRate *= 0.7;
          const weight = baseRate * weightMultiplier * 100;

          if (weight > bestWeight) {
            bestWeight = weight;
            bestCall = call.type === 'chi' ? { ...call, chosenChiSet: ci } : call;
          }
        }
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
  if (!p.hand.some((_, i) => {
    const testHand = p.hand.filter((__, j) => j !== i);
    return checkTenpai(testHand, p.melds);
  })) return false;

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
  const shantenBefore = estimateShanten(p.hand, p.melds);
  const targets = aiEvaluateTargets(game, playerIdx);

  // Strategy Check
  if (targets.kokushi || targets.chiitoitsu || targets.riichi) return false;

  for (const [k, c] of Object.entries(counts)) {
    if (c === 4) {
      const handAfter = removeTiles(p.hand, k, 4);
      const meldsAfter = [...p.melds, { type: 'kan' }];
      const shantenAfter = estimateShanten(handAfter, meldsAfter);
      
      if (shantenAfter <= shantenBefore) {
        // Tanyao awareness
        if (targets.tanyao) {
          const tile = Tile.fromString(k[0] + k.slice(1));
          if (tile.isTerminal || tile.isHonor) continue;
        }
        return true;
      }
    }
  }
  return false;
}
