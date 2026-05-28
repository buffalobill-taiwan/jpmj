class MenzenAI extends MahjongAI {
  chooseDiscard(game, playerIdx) {
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
      const tile = hand[indices[0]];
      const shantenEst = this.estimateShanten(testHand, p.melds);
      const waits = shantenEst >= 2 ? [] : getWaitingTiles(testHand, p.melds);
      const shanten = waits.length > 0 ? 0 : shantenEst;
      const isolated = this.countBlocks(testHand).isolated;

      let val = (this.isIsolated(hand, tile) ? (tile.isHonor ? 400 : tile.isTerminal ? 200 : 100) : 0)
              + (waits.length > 0 ? Math.min(waits.length, 9) * 10 : 0)
              + (indices.length >= 2 ? 50 : 0);

      if (shanten > 0) val += this.countImprovingTiles(testHand, p.melds) * 5;

      const hasThreat = game.players.some(pl => pl.isRiichi || pl.melds.length > 0);
      if (hasThreat) {
        const danger = this.tileDangerLevel(game, tile, true);
        val -= danger * 10;
      }

      evals.push({ idx: indices[0], val, shanten, isolated });
    }

    evals.sort((a, b) => a.shanten - b.shanten || a.isolated - b.isolated || b.val - a.val);
    const candidates = evals.filter(e => e.shanten === evals[0].shanten && e.isolated === evals[0].isolated && e.val === evals[0].val);
    return candidates[Math.floor(Math.random() * candidates.length)].idx;
  }

  decideCall(game, availableCalls) {
    const ron = availableCalls.find(c => c.type === 'ron');
    if (ron) return ron;
    return null;
  }

  decideRiichi(game, playerIdx) {
    const p = game.players[playerIdx];
    if (p.score < 1000) return false;
    return Math.random() < 0.85;
  }

  decideKan(game, playerIdx) {
    return false;
  }

  decideKyuushu(game, playerIdx) {
    return true;
  }
}
