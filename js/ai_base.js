/**
 * MahjongAI - Base class for all AI difficulties.
 * Contains shared utility methods for shanten estimation, tile danger assessment, etc.
 */
class MahjongAI {
  constructor() {
    this.targetYaku = null; // Potential for future "Target Locking"
  }

  // --- Core Decision Methods (to be overridden) ---

  chooseDiscard(game, playerIdx) {
    throw new Error("chooseDiscard not implemented");
  }

  decideCall(game, availableCalls) {
    // Default: Always Ron, otherwise Pass
    const ron = availableCalls.find(c => c.type === 'ron');
    if (ron) return ron;
    return null;
  }

  decideRiichi(game, playerIdx) {
    return false;
  }

  decideTsumo(game, playerIdx) {
    return true;
  }

  decideKan(game, playerIdx) {
    return false;
  }

  decideKyuushu(game, playerIdx) {
    return false;
  }

  // --- Shared Utility Methods (Heuristics) ---

  /**
   * Estimates how many tiles away from a complete hand (4 melds + 1 pair).
   */
  estimateShanten(hand, melds) {
    const calledMelds = melds.length;
    const result = this.countBlocks(hand);
    const totalMelds = result.melds + calledMelds;

    if (totalMelds >= 4) {
      return result.pairs > 0 ? 0 : 1;
    }

    const partialBlocks = result.partials + Math.min(result.pairs, 1);
    const maxPartials = Math.max(0, 4 - totalMelds);
    const effectivePartials = Math.min(partialBlocks, maxPartials);
    const shanten = (4 - totalMelds) * 2 - effectivePartials - Math.min(result.pairs, 1);
    return Math.max(0, shanten);
  }

  countBlocks(hand) {
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
      const result = this.solveSuitDP(suitCounts);
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

  solveSuitDP(counts) {
    const memo = new Map();
    const keyBuf = [];

    const dp = (pos, c) => {
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
        const skipC = [...c];
        skipC[pos] = 0;
        best = this.addResult({ melds: 0, pairs: 0, partials: 0, isolated: cnt }, dp(pos + 1, skipC));

        // Pair
        if (cnt >= 2) {
          const nc = [...c];
          nc[pos] -= 2;
          r = this.addResult({ melds: 0, pairs: 1, partials: 0, isolated: 0 }, dp(pos, nc));
          if (this.isBetter(r, best)) best = r;
        }

        // Triplet
        if (cnt >= 3) {
          const nc = [...c];
          nc[pos] -= 3;
          r = this.addResult({ melds: 1, pairs: 0, partials: 0, isolated: 0 }, dp(pos, nc));
          if (this.isBetter(r, best)) best = r;
        }

        // Sequence
        if (pos <= 6 && cnt >= 1 && c[pos + 1] >= 1 && c[pos + 2] >= 1) {
          const nc = [...c];
          nc[pos] -= 1; nc[pos + 1] -= 1; nc[pos + 2] -= 1;
          r = this.addResult({ melds: 1, pairs: 0, partials: 0, isolated: 0 }, dp(pos, nc));
          if (this.isBetter(r, best)) best = r;
        }

        // Partial adjacent
        if (pos <= 7 && cnt >= 1 && c[pos + 1] >= 1) {
          const nc = [...c];
          nc[pos] -= 1; nc[pos + 1] -= 1;
          r = this.addResult({ melds: 0, pairs: 0, partials: 1, isolated: 0 }, dp(pos, nc));
          if (this.isBetter(r, best)) best = r;
        }

        // Partial gap
        if (pos <= 6 && cnt >= 1 && c[pos + 2] >= 1) {
          const nc = [...c];
          nc[pos] -= 1; nc[pos + 2] -= 1;
          r = this.addResult({ melds: 0, pairs: 0, partials: 1, isolated: 0 }, dp(pos, nc));
          if (this.isBetter(r, best)) best = r;
        }
      }

      memo.set(key, best);
      return best;
    };

    return dp(0, counts);
  }

  addResult(a, b) {
    return {
      melds: a.melds + b.melds,
      pairs: a.pairs + b.pairs,
      partials: a.partials + b.partials,
      isolated: a.isolated + b.isolated,
    };
  }

  isBetter(a, b) {
    const sa = a.melds * 20 + Math.min(a.pairs, 1) * 20 + a.partials * 10 - a.isolated;
    const sb = b.melds * 20 + Math.min(b.pairs, 1) * 20 + b.partials * 10 - b.isolated;
    return sa > sb;
  }

  countImprovingTiles(hand, melds) {
    let count = 0;
    const curShanten = this.estimateShanten(hand, melds);
    if (curShanten === 0) return 0;
    for (let v = 1; v <= 34; v++) {
      const tile = this.valueToTile(v);
      const testHand = [...hand, tile];
      const newShanten = this.estimateShanten(testHand, melds);
      if (newShanten < curShanten) count++;
    }
    return count;
  }

  valueToTile(v) {
    if (v <= 9) return new Tile('man', v);
    if (v <= 18) return new Tile('pin', v - 9);
    if (v <= 27) return new Tile('sou', v - 18);
    return new Tile('honor', v - 27);
  }

  // --- Defense ---

  tileDangerLevel(game, tile, useSuji) {
    let danger = 0;
    for (let i = 0; i < 4; i++) {
      if (i === game.currentPlayer) continue;
      const p = game.players[i];
      if (!p.isRiichi && p.melds.length === 0) continue;

      if (this.isGenbutsu(game, i, tile)) continue;

      if (useSuji && this.isSuji(game, i, tile)) {
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

  isGenbutsu(game, playerIdx, tile) {
    const p = game.players[playerIdx];
    return p.discards.some(d => d.key() === tile.key());
  }

  isSuji(game, playerIdx, tile) {
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

  // --- Tile Utils ---

  discardPriority(tile) {
    if (tile.isHonor) return 4;
    if (tile.isTerminal) return 3;
    const v = tile.value;
    if (v === 2 || v === 8) return 2;
    return 1;
  }

  isIsolated(hand, tile) {
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

  getWaitQuality(game, hand, melds) {
    const waits = getWaitingTiles(hand, melds);
    if (waits.length === 0) return { count: 0, quality: 0, tiles: [] };

    let quality = 0;
    let totalRemaining = 0;
    for (const t of waits) {
      const remaining = 4 - this.countVisibleTiles(game, t);
      totalRemaining += remaining;
      quality += remaining * 2;
    }
    return { count: waits.length, quality, tiles: waits, totalRemaining };
  }

  countVisibleTiles(game, tile) {
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

  // --- Yaku Awareness ---

  evaluateTargets(game, playerIdx, difficulty) {
    const p = game.players[playerIdx];
    const hand = p.hand;
    const melds = p.melds;
    const counts = getCounts(hand);
    const targets = {};
    const shanten = this.estimateShanten(hand, melds);
    const isMenzen = melds.length === 0;

    // Tanyao
    let nonTanyaoCount = 0;
    for (const t of hand) if (t.isTerminal || t.isHonor) nonTanyaoCount++;
    for (const m of melds) {
      for (const t of m.tiles) if (t.isTerminal || t.isHonor) { nonTanyaoCount = 999; break; }
    }
    if (nonTanyaoCount < 5) targets.tanyao = (5 - nonTanyaoCount) * 20;

    // Yakuhai
    let yakuhaiCount = 0;
    for (let v = 1; v <= 7; v++) {
      const key = 'honor' + v;
      const c = counts[key] || 0;
      let isYaku = (v >= 5) || (v === game.roundWind + 1) || (v === p.seatWind);
      if (isYaku) {
        if (c >= 2) yakuhaiCount += (c >= 3 ? 100 : 50);
        for (const m of melds) if ((m.type === 'triplet' || m.type === 'kan') && m.tiles[0].key() === key) yakuhaiCount += 100;
      }
    }
    if (yakuhaiCount > 0) targets.yakuhai = yakuhaiCount;

    if (difficulty === 'normal' || difficulty === 'expert') {
      // Honitsu
      for (const suit of ['man', 'pin', 'sou']) {
        let suitCount = 0; let otherSuitCount = 0;
        for (const t of hand) if (t.suit === suit || t.isHonor) suitCount++; else otherSuitCount++;
        for (const m of melds) for (const t of m.tiles) if (t.suit === suit || t.isHonor) suitCount++; else { otherSuitCount = 999; break; }
        if (suitCount >= 8 && otherSuitCount < 4) targets.honitsu = (suitCount - 7) * 20;
      }
      // Toitoi
      const blocks = this.countBlocks(hand);
      let triplets = blocks.melds; let pairs = blocks.pairs;
      for (const m of melds) if (m.type === 'triplet' || m.type === 'kan') triplets++;
      if (triplets + pairs >= 4) targets.toitoi = (triplets * 30) + (pairs * 10);
      // Riichi
      if (isMenzen && shanten <= 3) targets.riichi = (4 - shanten) * 25;
    }

    if (difficulty === 'expert') {
      // Kokushi
      if (isMenzen) {
        const orphans = new Set();
        for (const t of hand) if (t.isTerminal || t.isHonor) orphans.add(t.key());
        if (orphans.size >= 8) targets.kokushi = orphans.size * 20;
      }
      // Chiitoitsu
      if (isMenzen) {
        let pairCount = 0;
        for (const c of Object.values(counts)) if (c >= 2) pairCount++;
        if (pairCount >= 4) targets.chiitoitsu = pairCount * 25;
      }
      // Survival
      const remaining = game.wall.getRemainingCount();
      const hasRiichiThreat = game.players.some((pl, idx) => idx !== playerIdx && pl.isRiichi);
      if (remaining <= 16 && shanten > 0 && hasRiichiThreat) targets.survival = 1000;
    }

    return targets;
  }
}
