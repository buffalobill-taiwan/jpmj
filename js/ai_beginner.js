class BeginnerAI extends MahjongAI {
  chooseDiscard(game, playerIdx) {
    const p = game.players[playerIdx];
    const hand = p.hand;
    const counts = getCounts(hand);
    const targets = this.evaluateTargets(game, playerIdx, 'beginner');

    const honors = [];
    const terminals = [];
    const others = [];

    for (let i = 0; i < hand.length; i++) {
      const t = hand[i];
      if (t.isHonor && counts[t.key()] < 2) honors.push(i);
      else if (t.isTerminal && !t.isHonor) terminals.push(i);
      else others.push(i);
    }

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

  decideCall(game, availableCalls) {
    const ron = availableCalls.find(c => c.type === 'ron');
    if (ron) return ron;

    if (Math.random() > 0.8) {
      const call = availableCalls.find(c => ['pon', 'chi', 'kan'].includes(c.type));
      if (call) {
        if (call.type === 'chi') return { ...call, chosenChiSet: 0 };
        return call;
      }
    }
    return null;
  }

  decideRiichi(game, playerIdx) {
    return Math.random() < 0.2;
  }

  decideKyuushu(game, playerIdx) {
    return true;
  }
}
