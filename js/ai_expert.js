class ExpertAI extends MahjongAI {
  chooseDiscard(game, playerIdx) {
    const p = game.players[playerIdx];
    const hand = p.hand;
    const targets = this.evaluateTargets(game, playerIdx, 'expert');
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
      const shanten = waits.length > 0 ? 0 : this.estimateShanten(testHand, p.melds);

      let val = 0;
      if (targets.survival) {
        val = -this.tileDangerLevel(game, tile, true) * 10000 + this.discardPriority(tile) * 100;
      } else {
        if (waits.length > 0) {
          const wq = this.getWaitQuality(game, testHand, p.melds);
          val = 100000 - shanten * 10000 + wq.quality * 10 + wq.count * 50;
        } else {
          val = -shanten * 100000 + this.countImprovingTiles(testHand, p.melds) * 8;
        }

        val -= this.countBlocks(testHand).isolated * 200;

        if (targets.kokushi && (tile.isTerminal || tile.isHonor)) val -= 50000;
        if (targets.tanyao && (tile.isTerminal || tile.isHonor)) val += 30000;
        if (targets.honitsu) {
          const hSuit = Object.keys(getCounts(hand)).find(sk => sk.startsWith('man') || sk.startsWith('pin') || sk.startsWith('sou'))?.slice(0, 3);
          if (tile.suit !== hSuit && !tile.isHonor) val += 20000;
        }

        const hasThreat = game.players.some(pl => pl.isRiichi || pl.melds.length > 0);
        if (hasThreat) {
          val -= this.tileDangerLevel(game, tile, true) * 2 * 15;
        }

        if (indices.length >= 2 && !targets.kokushi) val += 50;
        if (indices.length >= 2 && tile.isHonor) {
          if (tile.isSangen) val -= 300;
          else if (tile.value === game.seatWind || tile.value === game.roundWind) val -= 200;
        }
        if (this.isIsolated(hand, tile)) {
          if (tile.isHonor) val += 500;
          else if (tile.isTerminal) val += 300;
          else val += 100;
        }
        val += this.discardPriority(tile) * 5;
      }

      if (val > bestVal) { bestVal = val; bestIdx = indices[0]; }
    }
    return bestIdx;
  }

  decideCall(game, availableCalls) {
    const ron = availableCalls.find(c => c.type === 'ron');
    if (ron) return ron;

    const pIdx = availableCalls[0].playerIdx;
    const player = game.players[pIdx];
    const shantenBefore = this.estimateShanten(player.hand, player.melds);
    const targets = this.evaluateTargets(game, pIdx, 'expert');

    if (targets.kokushi || targets.chiitoitsu || (targets.riichi && shantenBefore <= 1)) return null;

    let bestCall = null;
    let bestWeight = -1;

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
            let weightMult = 1.0;
            if ((call.type==='pon'||call.type==='kan') && call.tile.isHonor && (call.tile.isSangen || call.tile.value === game.roundWind+1 || call.tile.value === player.seatWind)) weightMult = 1.5;
            else if (targets.tanyao) weightMult = (call.tile.isTerminal || call.tile.isHonor) ? 0.1 : 1.2;
            else if (targets.honitsu) {
              const hSuit = Object.keys(getCounts(player.hand)).find(sk => sk.startsWith('man') || sk.startsWith('pin') || sk.startsWith('sou'))?.slice(0, 3);
              weightMult = (call.tile.suit === hSuit || call.tile.isHonor) ? 1.3 : 0.1;
            } else weightMult = game.wall.getRemainingCount() > 40 ? 0.5 : 0.8;

            const weight = 75 * weightMult * 100;
            if (weight > bestWeight) { bestWeight = weight; bestCall = call.type === 'chi' ? { ...call, chosenChiSet: ci } : call; }
          }
        }
      }
    }
    if (bestCall && Math.random() * 100 < Math.min(95, bestWeight)) return bestCall;
    return null;
  }

  decideRiichi(game, playerIdx) {
    return Math.random() < 0.8;
  }

  decideKan(game, playerIdx) {
    const p = game.players[playerIdx];
    const shantenBefore = this.estimateShanten(p.hand, p.melds);
    const targets = this.evaluateTargets(game, playerIdx, 'expert');
    if (targets.kokushi || targets.chiitoitsu || targets.riichi) return false;

    const counts = getCounts(p.hand);
    for (const [k, c] of Object.entries(counts)) {
      if (c === 4) {
        if (this.estimateShanten(removeTiles(p.hand, k, 4), [...p.melds, {type:'kan'}]) <= shantenBefore) return true;
      }
    }
    return false;
  }
}
