class NormalAI extends MahjongAI {
  chooseDiscard(game, playerIdx) {
    const p = game.players[playerIdx];
    const hand = p.hand;
    const targets = this.evaluateTargets(game, playerIdx, 'normal');
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

      let val = (this.isIsolated(hand, tile) ? (tile.isHonor ? 500 : tile.isTerminal ? 300 : 100) : 0)
              + (waits.length > 0 ? Math.min(waits.length, 9) * 10 : 0)
              + (indices.length >= 2 ? 50 : 0);

      if (shanten > 0) val += this.countImprovingTiles(testHand, p.melds) * 5;

      if (targets.tanyao && (tile.isTerminal || tile.isHonor)) val += 500;
      if (targets.honitsu) {
        const suitCounts = {man:0, pin:0, sou:0};
        for(const t of hand) if(t.suit!=='honor') suitCounts[t.suit]++;
        const bestSuit = Object.entries(suitCounts).sort((a,b)=>b[1]-a[1])[0][0];
        if (tile.suit !== bestSuit && !tile.isHonor) val += 400;
      }
      if (indices.length >= 2 && tile.isHonor) {
        if (tile.isSangen) val += 300;
        else if (tile.value === game.seatWind || tile.value === game.roundWind) val += 200;
      }

      const hasThreat = game.players.some(pl => pl.isRiichi || pl.melds.length > 0);
      if (hasThreat) {
        const danger = this.tileDangerLevel(game, tile, false);
        val -= danger * 10;
      }

      val += this.discardPriority(tile);
      evals.push({ idx: indices[0], val, shanten, isolated });
    }

    evals.sort((a, b) => a.shanten - b.shanten || a.isolated - b.isolated || b.val - a.val);
    const candidates = evals.filter(e => e.shanten === evals[0].shanten && e.isolated === evals[0].isolated && e.val === evals[0].val);
    return candidates[Math.floor(Math.random() * candidates.length)].idx;
  }

  decideCall(game, availableCalls) {
    const ron = availableCalls.find(c => c.type === 'ron');
    if (ron) return ron;

    const pIdx = availableCalls[0].playerIdx;
    const player = game.players[pIdx];
    const shantenBefore = this.estimateShanten(player.hand, player.melds);
    const targets = this.evaluateTargets(game, pIdx, 'normal');

    for (const call of availableCalls) {
      if (['pon', 'chi', 'kan'].includes(call.type)) {
        const testSets = call.type === 'chi' ? call.chiSets : [null];
        for (let ci = 0; ci < testSets.length; ci++) {
          let handAfter = [...player.hand];
          if (call.type === 'pon') handAfter = removeTiles(player.hand, call.tile.key(), 2);
          else if (call.type === 'kan') handAfter = removeTiles(player.hand, call.tile.key(), 3);
          else {
            for (const ct of testSets[ci]) if (ct.key() !== call.tile.key()) handAfter = removeTiles(handAfter, ct.key(), 1);
          }
          if (this.estimateShanten(handAfter, [...player.melds, {type:call.type}]) < shantenBefore) {
            let weight = 70;
            if ((call.type==='pon'||call.type==='kan') && call.tile.isHonor && (call.tile.isSangen || call.tile.value === game.roundWind+1 || call.tile.value === player.seatWind)) weight *= 1.5;
            if (Math.random() * 100 < weight) return call.type === 'chi' ? { ...call, chosenChiSet: ci } : call;
          }
        }
      }
    }
    return null;
  }

  decideRiichi(game, playerIdx) {
    return Math.random() < 0.5;
  }

  decideKyuushu(game, playerIdx) {
    return true;
  }
}
