class Game {
  constructor(options) {
    this.options = options;
    this.players = [];
    this.wall = null;
    this.roundNumber = 0;
    this.honba = 0;
    this.riichiSticks = 0;
    this.dealerIndex = 0;
    this.currentPlayer = 0;
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.phase = 'idle';
    this.turnCount = 0;
    this.availableActions = [];
    this.availableCalls = [];
    this.roundResult = null;
    this.gameOver = false;
    this.roundOver = false;
    this.riichiDeclaredThisTurn = false;
    this.lastActionWasRiichi = false;
    this.discardAfterRiichi = null;
    this.log = [];
  }

  get maxRounds() {
    return this.options.length === 'east' ? 4
         : this.options.length === 'half' ? 8 : 12;
  }

  get roundWind() {
    return Math.floor(this.roundNumber / 4);
  }

  get roundWindName() {
    return ['東','南','西','北'][this.roundWind];
  }

  get roundLabel() {
    return this.roundWindName + ((this.roundNumber % 4) + 1) + '局';
  }

  get doraIndicators() {
    return this.wall ? this.wall.getDoraIndicators() : [];
  }

  initGame() {
    this.players = [];
    for (let i = 0; i < 4; i++) {
      this.players.push({
        name: i === 0 ? 'あなた' : i === 1 ? 'CPU1' : i === 2 ? 'CPU2' : 'CPU3',
        isHuman: i === 0,
        difficulty: i === 0 ? null : this.options.difficulties[i - 1],
        hand: [],
        melds: [],
        discards: [],
        score: 25000,
        seatWind: 0,
        isRiichi: false,
        riichiBet: 0,
        isTenpai: false,
        ippatsuRound: -1,
        lastDraw: null,
      });
    }
    this.roundNumber = 0;
    this.honba = 0;
    this.riichiSticks = 0;
    this.dealerIndex = 0;
    this.gameOver = false;
    this.startNewRound();
  }

  startNewRound() {
    this.wall = new Wall();
    for (const p of this.players) {
      p.hand = [];
      p.melds = [];
      p.discards = [];
      p.isRiichi = false;
      p.riichiBet = 0;
      p.isTenpai = false;
      p.ippatsuRound = -1;
      p.lastDraw = null;
    }
    for (let i = 0; i < 4; i++) {
      this.players[i].seatWind = ((i - this.dealerIndex + 4) % 4) + 1;
    }

    this.wall.deal(this.players);
    for (const p of this.players) {
      p.hand = Tile.sortTiles(p.hand);
    }
    this.players[this.dealerIndex].lastDraw = this.wall.dealerExtraTile;
    this.currentPlayer = this.dealerIndex;
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.turnCount = 0;
    this.availableActions = [];
    this.availableCalls = [];
    this.roundResult = null;
    this.roundOver = false;
    this.riichiDeclaredThisTurn = false;
    this.lastActionWasRiichi = false;

    this.phase = 'dealer_first_discard';
  }

  // Called repeatedly by main.js to advance one step at a time.
  // Returns true if human input is needed (stop the game loop).
  advance() {
    if (this.gameOver || this.roundOver) return true;

    if (this.phase === 'dealer_first_discard') {
      if (this.players[this.currentPlayer].isHuman) {
        this.availableActions = ['discard'];
        return true;
      }
      const idx = aiChooseDiscard(this, this.currentPlayer);
      this.executeDiscard(this.currentPlayer, idx);
      return false;
    }

    if (this.phase === 'draw') {
      const tile = this.wall.draw();
      if (!tile) {
        this.handleExhaustiveDraw();
        return true;
      }
      const p = this.players[this.currentPlayer];
      p.hand.push(tile);
      p.hand = Tile.sortTiles(p.hand);
      p.lastDraw = tile;
      this.addLog(this.currentPlayer, '摸', tile.name);
      this.turnCount++;

      if (this.checkTsumo(this.currentPlayer)) {
        if (this.players[this.currentPlayer].isHuman) {
          this.availableActions = ['tsumo', 'pass'];
          return true;
        }
        if (aiDecideTsumo(this, this.currentPlayer)) {
          this.executeWin(this.currentPlayer, 'tsumo', tile);
          return true;
        }
      }

      if (p.isRiichi) {
        const drawnIdx = p.hand.findIndex(t => t.equals(tile));
        this.executeDiscard(this.currentPlayer, drawnIdx);
        return false;
      }

      this.phase = 'discard';
      return false;
    }

    if (this.phase === 'discard') {
      if (this.players[this.currentPlayer].isHuman) {
        this.availableActions = ['discard'];
        return true;
      }
      if (this.handleAIKan(this.currentPlayer)) {
        return false;
      }
      const idx = aiChooseDiscard(this, this.currentPlayer);
      this.executeDiscard(this.currentPlayer, idx);
      return false;
    }

    if (this.phase === 'call_pending') {
      const needHuman = this.processCallPhase();
      return needHuman;
    }

    if (this.phase === 'rinshan') {
      const tile = this.wall.drawRinshan();
      if (!tile) {
        this.handleExhaustiveDraw();
        return true;
      }
      const p = this.players[this.currentPlayer];
      p.hand.push(tile);
      p.lastDraw = tile;

      if (this.checkTsumo(this.currentPlayer)) {
        if (this.players[this.currentPlayer].isHuman) {
          this.availableActions = ['tsumo', 'pass'];
          return true;
        }
        if (aiDecideTsumo(this, this.currentPlayer)) {
          this.executeWin(this.currentPlayer, 'tsumo', tile);
          return true;
        }
      }

      this.phase = 'discard';
      return false;
    }

    return true;
  }

  // ===== Discard Flow =====

  humanDiscard(tileIdx) {
    if (!this.players[this.currentPlayer].isHuman) return;
    if (this.phase !== 'dealer_first_discard' && this.phase !== 'discard') return;
    this.executeDiscard(this.currentPlayer, tileIdx);
  }

  executeDiscard(playerIdx, tileIdx) {
    const p = this.players[playerIdx];
    const tile = p.hand.splice(tileIdx, 1)[0];
    if (!tile) return;
    p.discards.push(tile);
    this.lastDiscard = tile;
    this.lastDiscardPlayer = playerIdx;
    this.riichiDeclaredThisTurn = false;

    this.addLog(playerIdx, '打', tile.name + (p.isRiichi ? '（立直）' : ''));

    for (let i = 0; i < 4; i++) {
      if (this.players[i].ippatsuRound >= 0 && i !== playerIdx) {
        this.players[i].ippatsuRound = -1;
      }
    }

    this.phase = 'call_pending';
    this.availableActions = [];
    this.availableCalls = this.buildAvailableCalls(playerIdx, tile);
    p.lastDraw = null;
  }

  buildAvailableCalls(discardPlayerIdx, tile) {
    const calls = [];
    for (let i = 1; i <= 3; i++) {
      const pIdx = (discardPlayerIdx + i) % 4;
      const p = this.players[pIdx];
      if (p.isRiichi) continue;

      const hand = p.hand;

      const ronCheck = evaluateHand(hand, p.melds, tile, 'ron', this.getGameState(pIdx, tile, 'ron'));
      if (ronCheck) {
        calls.push({ type: 'ron', playerIdx: pIdx, tile });
      }

      const handCounts = getCounts(hand);
      const tileKey = tile.key();
      if ((handCounts[tileKey] || 0) >= 2) {
        const canPon = i >= 1;
        if (canPon) {
          calls.push({ type: 'pon', playerIdx: pIdx, tile });
        }
      }

      if (i === 1 && tile.suit !== 'honor') {
        const v = tile.value;
        const s = tile.suit;
        const chiSets = [];
        if (v >= 3 && findTile(hand, s, v-2) && findTile(hand, s, v-1)) {
          chiSets.push([new Tile(s, v-2), new Tile(s, v-1), tile]);
        }
        if (v >= 2 && v <= 8 && findTile(hand, s, v-1) && findTile(hand, s, v+1)) {
          chiSets.push([new Tile(s, v-1), tile, new Tile(s, v+1)]);
        }
        if (v <= 7 && findTile(hand, s, v+1) && findTile(hand, s, v+2)) {
          chiSets.push([tile, new Tile(s, v+1), new Tile(s, v+2)]);
        }
        if (chiSets.length > 0) {
          calls.push({ type: 'chi', playerIdx: pIdx, tile, chiSets });
        }
      }
    }

    const curP = this.players[discardPlayerIdx];
    if (!curP.isRiichi) {
      const handCounts = getCounts(curP.hand);
      const tileKey = tile.key();
      if ((handCounts[tileKey] || 0) >= 3) {
        calls.push({ type: 'kan', playerIdx: discardPlayerIdx, tile, isCalled: true });
      }
    }

    calls.sort((a, b) => {
      const pri = { ron:0, kan:1, pon:2, chi:3 };
      return pri[a.type] - pri[b.type];
    });

    return calls;
  }

  processCallPhase() {
    const humanCalls = this.availableCalls.filter(c => this.players[c.playerIdx].isHuman);

    if (humanCalls.length > 0) {
      this.availableActions = humanCalls;
      this.availableActions.push({ type: 'pass' });
      return true;
    }

    const aiCalls = this.availableCalls.filter(c => !this.players[c.playerIdx].isHuman);
    const chosenCall = aiDecideCall(this, aiCalls);

    if (chosenCall) {
      this.executeCall(chosenCall);
      if (this.phase === 'discard' && this.players[this.currentPlayer].isHuman) return true;
      if (this.phase === 'rinshan' && this.players[this.currentPlayer].isHuman) return true;
      return false;
    }

    this.advanceTurn();
    return false;
  }

  humanCall(callChoice) {
    if (callChoice.type === 'pass') {
      this.availableCalls = this.availableCalls.filter(c => !this.players[c.playerIdx].isHuman);
      const aiCalls = this.availableCalls.filter(c => !this.players[c.playerIdx].isHuman);
      const chosenCall = aiDecideCall(this, aiCalls);
      if (chosenCall) {
        this.executeCall(chosenCall);
      } else {
        this.advanceTurn();
      }
      return;
    }

    this.executeCall(callChoice);
  }

  executeCall(call) {
    const { type, playerIdx, tile } = call;
    const p = this.players[playerIdx];

    if (type === 'ron') {
      this.executeWin(playerIdx, 'ron', tile);
      return;
    }

    if (type === 'pon') {
      this.addLog(playerIdx, 'ポン', tile.name + ' ← ' + this.players[this.lastDiscardPlayer].name);
      let n = 2;
      const newHand = [];
      for (const t of p.hand) {
        if (n > 0 && t.key() === tile.key()) { n--; }
        else { newHand.push(t); }
      }
      p.hand = newHand;
      p.melds.push({ type:'pon', tiles:[tile, tile, tile], open:true, from: this.lastDiscardPlayer });
      this.lastDiscard = null;
      this.lastDiscardPlayer = -1;
      this.currentPlayer = playerIdx;
      this.phase = 'discard';

      for (let i = 0; i < 4; i++) {
        if (this.players[i].ippatsuRound >= 0) {
          this.players[i].ippatsuRound = -1;
        }
      }

      if (this.players[playerIdx].isHuman) {
        this.availableActions = ['discard'];
        return;
      }
      const idx = aiChooseDiscard(this, playerIdx);
      this.executeDiscard(playerIdx, idx);
      return;
    }

    if (type === 'chi') {
      this.addLog(playerIdx, 'チー', tile.name + ' ← ' + this.players[this.lastDiscardPlayer].name);
      const chiTileSet = call.chiSets[0];
      const newHand = [];
      const keepKeys = {};
      for (const ct of chiTileSet) {
        if (ct.key() === tile.key()) continue;
        keepKeys[ct.key()] = (keepKeys[ct.key()] || 0) + 1;
      }
      for (const t of p.hand) {
        const k = t.key();
        if (keepKeys[k] && keepKeys[k] > 0) {
          keepKeys[k]--;
        } else {
          newHand.push(t);
        }
      }
      p.hand = newHand;
      p.melds.push({ type:'chi', tiles:chiTileSet, open:true, from: this.lastDiscardPlayer });
      this.lastDiscard = null;
      this.lastDiscardPlayer = -1;
      this.currentPlayer = playerIdx;
      this.phase = 'discard';

      for (let i = 0; i < 4; i++) {
        if (this.players[i].ippatsuRound >= 0) this.players[i].ippatsuRound = -1;
      }

      if (this.players[playerIdx].isHuman) {
        this.availableActions = ['discard'];
        return;
      }
      const idx = aiChooseDiscard(this, playerIdx);
      this.executeDiscard(playerIdx, idx);
      return;
    }

    if (type === 'kan' && call.isCalled) {
      this.addLog(playerIdx, 'カン', tile.name);
      const removed = [];
      let n = 3;
      const newHand = [];
      for (const t of p.hand) {
        if (n > 0 && t.key() === tile.key()) { removed.push(t); n--; }
        else { newHand.push(t); }
      }
      p.hand = newHand;
      p.melds.push({ type:'kan', tiles:[tile, tile, tile, tile], open:true, from: this.lastDiscardPlayer });
      this.lastDiscard = null;
      this.lastDiscardPlayer = -1;
      this.wall.addDoraIndicator();
      this.currentPlayer = playerIdx;
      for (let i = 0; i < 4; i++) {
        if (this.players[i].ippatsuRound >= 0) this.players[i].ippatsuRound = -1;
      }
      this.phase = 'rinshan';
      return;
    }
  }

  addLog(playerIdx, action, detail) {
    const p = this.players[playerIdx];
    this.log.push({
      turn: this.turnCount,
      player: p ? p.name : '?',
      action,
      detail: detail || '',
    });
    if (this.log.length > 100) this.log.shift();
  }

  advanceTurn() {
    this.addLog(this.currentPlayer, '→', this.players[(this.currentPlayer + 1) % 4].name);
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.availableCalls = [];
    this.availableActions = [];
    this.players[this.currentPlayer].lastDraw = null;
    this.currentPlayer = (this.currentPlayer + 1) % 4;
    this.phase = 'draw';
  }

  // ===== Riichi =====

  humanRiichi(tileIdx) {
    if (!this.players[this.currentPlayer].isHuman) return;
    if (this.phase !== 'discard' && this.phase !== 'dealer_first_discard') return;
    const p = this.players[this.currentPlayer];
    if (p.isRiichi) return;
    if (p.melds.length > 0) return;
    if (this.wall.getRemainingCount() < 4) return;

    if (!p.hand.some((_, i) => {
      const testHand = p.hand.filter((__, j) => j !== i);
      return checkTenpai(testHand, p.melds);
    })) return;

    const tile = p.hand[tileIdx];
    const testHand = p.hand.filter((_, i) => i !== tileIdx);
    if (!checkTenpai(testHand, p.melds)) return;

    p.isRiichi = true;
    this.addLog(this.currentPlayer, '立直', tile.name);
    this.executeDiscard(this.currentPlayer, tileIdx);
    if (this.phase === 'call_pending') {
      p.ippatsuRound = this.turnCount;
    }
    this.riichiSticks++;
    p.riichiBet = 1000;
    this.riichiDeclaredThisTurn = true;
  }

  // ===== Kan =====

  humanKan(tileIdx) {
    const p = this.players[this.currentPlayer];
    if (!p.isHuman) return;
    if (p.isRiichi) return;
    if (this.phase !== 'discard') return;
    const tile = p.hand[tileIdx];
    const handCounts = getCounts(p.hand);

    if ((handCounts[tile.key()] || 0) >= 4) {
      const newHand = [];
      let n = 4;
      for (const t of p.hand) {
        if (n > 0 && t.key() === tile.key()) { n--; }
        else { newHand.push(t); }
      }
      p.hand = newHand;
      p.melds.push({ type:'kan', tiles:[tile, tile, tile, tile], open:false });
      this.wall.addDoraIndicator();
      this.availableActions = [];
      this.phase = 'rinshan';
      return;
    }

    for (const m of p.melds) {
      if (m.type === 'pon' && m.tiles[0].key() === tile.key() && !m.isKan) {
        const newHand = [];
        let removed = false;
        for (const t of p.hand) {
          if (!removed && t.key() === tile.key()) { removed = true; }
          else { newHand.push(t); }
        }
        p.hand = newHand;
        m.type = 'kan';
        m.tiles.push(tile);
        m.isKan = true;
        m.open = true;
        this.wall.addDoraIndicator();
        this.availableActions = [];
        this.phase = 'rinshan';
        return;
      }
    }
  }

  // ===== AI Kan Handling =====

  handleAIKan(playerIdx) {
    const p = this.players[playerIdx];
    if (p.isRiichi) return false;
    if (this.phase !== 'discard') return false;

    const counts = getCounts(p.hand);

    for (const [k, c] of Object.entries(counts)) {
      if (c === 4 && aiDecideKan(this, playerIdx)) {
        const tile = p.hand.find(t => t.key() === k);
        const newHand = [];
        let n = 4;
        for (const t of p.hand) {
          if (n > 0 && t.key() === k) { n--; }
          else { newHand.push(t); }
        }
        p.hand = newHand;
        p.melds.push({ type:'kan', tiles:[tile, tile, tile, tile], open:false });
        this.wall.addDoraIndicator();
        this.addLog(playerIdx, '暗槓', tile.name);
        this.availableActions = [];
        this.phase = 'rinshan';
        return true;
      }
    }

    for (const m of p.melds) {
      if (m.type === 'pon' && !m.isKan) {
        const ponKey = m.tiles[0].key();
        if ((counts[ponKey] || 0) >= 1) {
          const tile = p.hand.find(t => t.key() === ponKey);
          if (tile && Math.random() < 0.3) {
            const newHand = [];
            let removed = false;
            for (const t of p.hand) {
              if (!removed && t.key() === ponKey) { removed = true; }
              else { newHand.push(t); }
            }
            p.hand = newHand;
            m.type = 'kan';
            m.tiles.push(tile);
            m.isKan = true;
            this.wall.addDoraIndicator();
            this.addLog(playerIdx, '加槓', tile.name);
            this.availableActions = [];
            this.phase = 'rinshan';
            return true;
          }
        }
      }
    }

    return false;
  }

  checkTsumo(playerIdx) {
    const p = this.players[playerIdx];
    if (!p.lastDraw) return false;
    const handMinusDraw = removeTiles(p.hand, p.lastDraw.key(), 1);
    const result = evaluateHand(
      handMinusDraw,
      p.melds,
      p.lastDraw,
      'tsumo',
      this.getGameState(playerIdx, p.lastDraw, 'tsumo')
    );
    return result !== null;
  }

  checkRon(playerIdx, tile) {
    const p = this.players[playerIdx];
    const result = evaluateHand(
      p.hand, p.melds, tile, 'ron',
      this.getGameState(playerIdx, tile, 'ron')
    );
    return result;
  }

  executeWin(playerIdx, winType, tile) {
    const p = this.players[playerIdx];
    this.addLog(playerIdx, winType === 'tsumo' ? 'ツモ' : 'ロン', tile.name);
    const handForEval = winType === 'tsumo'
      ? removeTiles(p.hand, tile.key(), 1)
      : p.hand;
    const result = evaluateHand(
      handForEval,
      p.melds,
      tile,
      winType,
      this.getGameState(playerIdx, tile, winType)
    );

    if (!result) return;

    this.winner = playerIdx;
    this.roundResult = {
      winner: playerIdx,
      winType,
      yaku: result.yaku,
      totalHan: result.totalHan,
      fu: result.fu,
      payments: result.payments,
      isYakuman: result.isYakuman,
      winTile: tile,
      honba: this.honba,
      riichiSticks: this.riichiSticks,
    };

    this.applyScore(playerIdx, result.payments);
    this.roundOver = true;
    this.phase = 'round_end';
  }

  applyScore(winnerIdx, payments) {
    const p = this.players[winnerIdx];
    p.score += payments.total;

    if (payments.type === 'tsumo') {
      for (let i = 0; i < 4; i++) {
        if (i === winnerIdx) continue;
        const isDealer = i === this.dealerIndex;
        this.players[i].score -= isDealer ? payments.dealerPayment : payments.childPayment;
      }
    } else {
      const discardingPlayer = this.lastDiscardPlayer;
      this.players[discardingPlayer].score -= payments.discarderPayment;
    }

    if (this.honba > 0) {
      p.score += this.honba * 300;
    }
    p.score += this.riichiSticks * 1000;

    for (const pl of this.players) {
      if (pl.riichiBet > 0) {
        p.score += pl.riichiBet;
        pl.riichiBet = 0;
      }
    }

    if (winnerIdx === this.dealerIndex) {
      this.honba++;
    } else {
      this.dealerIndex = (this.dealerIndex + 1) % 4;
      this.honba = 0;
    }
    this.riichiSticks = 0;
  }

  handleExhaustiveDraw() {
    this.phase = 'exhaustive_draw';
    const tenpaiPlayers = [];
    const notenPlayers = [];

    for (let i = 0; i < 4; i++) {
      const p = this.players[i];
      p.isTenpai = checkTenpai(p.hand, p.melds);
      if (p.isTenpai) tenpaiPlayers.push(i);
      else notenPlayers.push(i);
    }

    if (notenPlayers.length > 0 && tenpaiPlayers.length > 0) {
      const paymentPerNoten = 1500;
      const total = paymentPerNoten * notenPlayers.length;
      const perTenpai = Math.floor(total / tenpaiPlayers.length);
      for (const ti of tenpaiPlayers) {
        this.players[ti].score += perTenpai;
      }
      for (const ni of notenPlayers) {
        this.players[ni].score -= paymentPerNoten;
      }
    }

    if (this.players[this.dealerIndex].isTenpai) {
      this.honba++;
    } else {
      this.dealerIndex = (this.dealerIndex + 1) % 4;
      this.honba = 0;
    }

    this.roundResult = {
      winner: -1,
      winType: 'exhaustive',
      tenpaiPlayers,
      notenPlayers,
      honba: this.honba,
    };
    this.roundOver = true;
    this.phase = 'round_end';
  }

  // ===== Game State for Yaku =====

  getGameState(playerIdx, winTile, winType) {
    const p = this.players[playerIdx];
    return {
      isDealer: playerIdx === this.dealerIndex,
      seatWind: p.seatWind,
      roundWind: this.roundWind + 1,
      winType,
      winTile,
      isRiichi: p.isRiichi,
      isIppatsu: p.ippatsuRound >= 0 && this.turnCount - p.ippatsuRound <= 1,
      isTenhou: this.turnCount === 0 && winType === 'tsumo' && p.isHuman && playerIdx === this.dealerIndex,
      isChiihou: this.turnCount === 0 && winType === 'tsumo' && p.isHuman && playerIdx !== this.dealerIndex,
      isRenhou: this.turnCount === 0 && winType === 'ron' && p.isHuman,
      doraIndicators: this.wall.getDoraIndicators(),
    };
  }

  // ===== End Game =====

  checkGameOver() {
    if (this.roundNumber >= this.maxRounds - 1) {
      this.gameOver = true;
      return true;
    }
    for (const p of this.players) {
      if (p.score <= 0) {
        this.gameOver = true;
        return true;
      }
    }
    return false;
  }

  endRound() {
    this.roundNumber++;

    if (this.checkGameOver()) {
      this.phase = 'game_end';
      this.gameOver = true;
    } else {
      this.startNewRound();
    }
  }

  getFinalScores() {
    const scores = this.players.map((p, i) => ({
      name: p.name,
      score: p.score,
      isHuman: p.isHuman,
    }));
    scores.sort((a, b) => b.score - a.score);
    scores.forEach((s, i) => { s.rank = i + 1; });
    return scores;
  }
}
