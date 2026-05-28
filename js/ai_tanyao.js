class TanyaoAI extends MahjongAI {
  chooseDiscard(game, playerIdx) {
    const p = game.players[playerIdx];
    const hand = p.hand;
    const yaoIndices = [];

    for (let i = 0; i < hand.length; i++) {
      const t = hand[i];
      if (t.isTerminal || t.isHonor) yaoIndices.push({ idx: i, tile: t });
    }

    if (yaoIndices.length > 0) {
      const counts = getCounts(hand);
      let best = null;

      for (const { idx, tile } of yaoIndices) {
        const cnt = counts[tile.key()] || 0;
        const isolated = cnt === 1 && this.isIsolated(hand, tile);
        let priority = 0;
        if (tile.isHonor && isolated) priority = 4;
        else if (tile.isTerminal && isolated) priority = 3;
        else if (tile.isHonor) priority = 2;
        else priority = 1;

        if (!best || priority > best.priority ||
            (priority === best.priority && idx > best.idx)) {
          best = { idx, priority };
        }
      }

      return best.idx;
    }

    // No yao tiles — shanten-aware discard
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

      let val = (this.isIsolated(hand, tile) ? 100 : 0)
              + (waits.length > 0 ? Math.min(waits.length, 9) * 10 : 0)
              + (indices.length >= 2 ? 50 : 0);

      if (shanten > 0) val += this.countImprovingTiles(testHand, p.melds) * 5;

      evals.push({ idx: indices[0], val, shanten, isolated });
    }

    evals.sort((a, b) => a.shanten - b.shanten || a.isolated - b.isolated || b.val - a.val);
    return evals[0].idx;
  }

  decideCall(game, availableCalls) {
    const ron = availableCalls.find(c => c.type === 'ron');
    if (ron) return ron;

    const call = availableCalls[0];
    const p = game.players[call.playerIdx];
    const hand = p.hand;

    let hasYao = false;
    for (const t of hand) {
      if (t.isTerminal || t.isHonor) { hasYao = true; break; }
    }

    for (const c of availableCalls) {
      if (c.type === 'pon' || c.type === 'chi' || c.type === 'kan') {
        if (c.tile.isTerminal || c.tile.isHonor) continue;

        if (hasYao) {
          // Rule 2a: call to discard more yao tiles regardless of shanten
          if (c.type === 'chi') {
            for (let ci = 0; ci < c.chiSets.length; ci++) {
              const set = c.chiSets[ci];
              const handTiles = set.filter(t => t.key() !== c.tile.key());
              if (handTiles.some(t => t.isTerminal || t.isHonor)) continue;
              return { ...c, chosenChiSet: ci };
            }
            continue;
          }
          return c;
        }

        // Rule 2b: normal shanten-reducing call
        const shantenBefore = this.estimateShanten(hand, p.melds);
        let handAfter;

        if (c.type === 'pon') {
          handAfter = removeTiles(hand, c.tile.key(), 2);
          if (this.estimateShanten(handAfter, [...p.melds, { type: 'pon' }]) < shantenBefore) {
            return c;
          }
        } else if (c.type === 'kan') {
          handAfter = removeTiles(hand, c.tile.key(), 3);
          if (this.estimateShanten(handAfter, [...p.melds, { type: 'kan' }]) < shantenBefore) {
            return c;
          }
        } else {
          for (let ci = 0; ci < c.chiSets.length; ci++) {
            const set = c.chiSets[ci];
            const handTiles = set.filter(t => t.key() !== c.tile.key());
            if (handTiles.some(t => t.isTerminal || t.isHonor)) continue;

            let testHand = [...hand];
            for (const ct of set) {
              if (ct.key() !== c.tile.key()) {
                testHand = removeTiles(testHand, ct.key(), 1);
              }
            }
            if (this.estimateShanten(testHand, [...p.melds, { type: 'chi' }]) < shantenBefore) {
              return { ...c, chosenChiSet: ci };
            }
          }
        }
      }
    }

    return null;
  }

  decideRiichi(game, playerIdx) {
    const p = game.players[playerIdx];
    for (const t of p.hand) {
      if (t.isTerminal || t.isHonor) return false;
    }
    for (const m of p.melds) {
      for (const t of m.tiles) {
        if (t.isTerminal || t.isHonor) return false;
      }
    }
    return getWaitingTiles(p.hand, p.melds).length > 0;
  }

  decideKan(game, playerIdx) {
    return false;
  }

  decideKyuushu(game, playerIdx) {
    return false;
  }
}
