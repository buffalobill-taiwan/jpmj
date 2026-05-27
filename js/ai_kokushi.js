class KokushiAI extends MahjongAI {
  constructor() {
    super();
    this.yaoKeys = new Set();
    for (const s of ['man','pin','sou']) {
      this.yaoKeys.add(key(s, 1));
      this.yaoKeys.add(key(s, 9));
    }
    for (let v = 1; v <= 7; v++) this.yaoKeys.add(key('honor', v));
  }

  chooseDiscard(game, playerIdx) {
    const p = game.players[playerIdx];
    const hand = p.hand;

    const nonYaoIndices = [];
    const yaoCounts = {};
    const yaoFirstIdx = {};

    for (let i = 0; i < hand.length; i++) {
      const k = hand[i].key();
      if (this.yaoKeys.has(k)) {
        yaoCounts[k] = (yaoCounts[k] || 0) + 1;
        if (yaoFirstIdx[k] === undefined) yaoFirstIdx[k] = i;
      } else {
        nonYaoIndices.push({ idx: i, tile: hand[i] });
      }
    }

    // Priority 1: discard non-yao tiles (prefer center tiles 4/5/6)
    if (nonYaoIndices.length > 0) {
      nonYaoIndices.sort((a, b) => {
        const aCenter = Math.abs(a.tile.value - 5);
        const bCenter = Math.abs(b.tile.value - 5);
        if (aCenter !== bCenter) return bCenter - aCenter;
        return a.idx - b.idx;
      });
      return nonYaoIndices[0].idx;
    }

    // All tiles are yao. Find the tile type with the most copies and discard one.
    let maxCount = 0;
    let maxKey = null;
    for (const [k, c] of Object.entries(yaoCounts)) {
      if (c > maxCount) { maxCount = c; maxKey = k; }
    }

    if (maxKey && maxCount >= 2) {
      // Discard the second occurrence of the most abundant tile
      for (let i = 0; i < hand.length; i++) {
        if (hand[i].key() === maxKey && i !== yaoFirstIdx[maxKey]) return i;
      }
    }

    // Fallback (shouldn't reach here with 14 tiles)
    return hand.length - 1;
  }

  decideCall(game, availableCalls) {
    for (const call of availableCalls) {
      if (call.type === 'ron') {
        const p = game.players[call.playerIdx];
        const result = evaluateHand(
          p.hand, p.melds, call.tile, 'ron',
          game.getGameState(call.playerIdx, call.tile, 'ron')
        );
        if (result && result.yaku.some(y => y.name === '国士無双')) return call;
      }
    }
    return null;
  }

  decideRiichi(game, playerIdx) {
    const p = game.players[playerIdx];
    const waits = getWaitingTiles(p.hand, p.melds);
    if (waits.length === 0) return false;
    // Only riichi if waiting for a yao tile (kokushi tenpai)
    return waits.some(t => this.yaoKeys.has(t.key()));
  }

  decideKan(game, playerIdx) {
    return false;
  }

  decideKyuushu(game, playerIdx) {
    return false;
  }

  decideTsumo(game, playerIdx) {
    const p = game.players[playerIdx];
    if (!p.lastDraw) return false;
    const handMinusDraw = removeTiles(p.hand, p.lastDraw.key(), 1);
    const result = evaluateHand(
      handMinusDraw, p.melds, p.lastDraw, 'tsumo',
      game.getGameState(playerIdx, p.lastDraw, 'tsumo')
    );
    return result !== null && result.yaku.some(y => y.name === '国士無双');
  }
}
