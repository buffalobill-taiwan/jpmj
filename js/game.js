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
    this.lastActionWasKan = false;
    this.discardAfterRiichi = null;
    this.log = [];
    this.logGroup = 0;
    this.lastLogPlayer = -1;
    this.logEntryId = 0;
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
        difficulty: i === 0 ? 'normal' : this.options.difficulties[i - 1],
        hand: [],
        melds: [],
        discards: [],
        score: 25000,
        seatWind: 0,
        isRiichi: false,
        riichiTurn: -1,
        isTenpai: false,
        ippatsuRound: -1,
        lastDraw: null,
        isTempFuriten: false,
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
    this.logGroup = 0;
    this.lastLogPlayer = -1;
    const wind = ['東', '南', '西', '北'][Math.floor(this.roundNumber / 4) % 4];
    const label = `${wind}${(this.roundNumber % 4) + 1}局`;
    this.addSystemLog('開始', label);

    this.wall = new Wall();
    for (const p of this.players) {
      p.hand = [];
      p.melds = [];
      p.discards = [];
      p.isRiichi = false;
      p.riichiTurn = -1;
      p.isTenpai = false;
      p.ippatsuRound = -1;
      p.lastDraw = null;
      p.isTempFuriten = false;
    }
    for (let i = 0; i < 4; i++) {
      this.players[i].seatWind = ((i - this.dealerIndex + 4) % 4) + 1;
    }

    this.wall.deal(this.players);
    for (const p of this.players) {
      p.hand = Tile.sortTiles(p.hand);
    }
    this.players[this.dealerIndex].hand.push(this.wall.dealerExtraTile);
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
      p.isTempFuriten = false;
      const isHuman = this.players[this.currentPlayer].isHuman;
      this.addLog(this.currentPlayer, isHuman ? '摸' : '摸牌', isHuman ? tile.name : '');
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

      if (!this.players[this.currentPlayer].isHuman && this.handleAIKan(this.currentPlayer)) {
        return false;
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
      const p = this.players[this.currentPlayer];
      if (!p.isRiichi && aiDecideRiichi(this, this.currentPlayer)) {
        for (let i = 0; i < p.hand.length; i++) {
          const testHand = p.hand.filter((_, j) => j !== i);
          if (checkTenpai(testHand, p.melds)) {
            this.humanRiichi(i);
            return false;
          }
        }
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

  executeDiscard(playerIdx, tileIdx, isRiichi = false) {
    const p = this.players[playerIdx];
    const tile = p.hand.splice(tileIdx, 1)[0];
    if (!tile) return;
    if (isRiichi) tile.isRiichi = true;
    p.hand = Tile.sortTiles(p.hand);
    p.discards.push(tile);
    this.lastDiscard = tile;
    this.lastDiscardPlayer = playerIdx;
    this.riichiDeclaredThisTurn = false;
    this.lastActionWasKan = false;

    let detail = tile.name;
    if (isRiichi) {
      detail += '（立直）';
    } else if (p.lastDraw === tile) {
      detail += '（摸切）';
    }

    this.addLog(playerIdx, '打', detail);

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
      const hand = p.hand;
      if (p.isRiichi) {
        const ronCheck = evaluateHand(hand, p.melds, tile, 'ron', this.getGameState(pIdx, tile, 'ron'));
        if (ronCheck && !this.isFuriten(pIdx)) {
          calls.push({ type: 'ron', playerIdx: pIdx, tile });
        }
        continue;
      }

      const ronCheck = evaluateHand(hand, p.melds, tile, 'ron', this.getGameState(pIdx, tile, 'ron'));
      if (ronCheck && !this.isFuriten(pIdx)) {
        calls.push({ type: 'ron', playerIdx: pIdx, tile });
      }
      if (p.isHuman) {
        if (this.isFuriten(pIdx) && (ronCheck || canFormCompleteHand(hand, p.melds, tile))) {
          calls.push({ type: 'ron-furiten', playerIdx: pIdx, tile });
        } else if (!ronCheck && canFormCompleteHand(hand, p.melds, tile)) {
          calls.push({ type: 'ron-no-yaku', playerIdx: pIdx, tile });
        }
      }

      if (!this.wall.isExhausted()) {
        const handCounts = getCounts(hand);
        const tileKey = tile.key();
        if ((handCounts[tileKey] || 0) >= 2) {
          calls.push({ type: 'pon', playerIdx: pIdx, tile });
          if ((handCounts[tileKey] || 0) >= 3) {
            calls.push({ type: 'kan', playerIdx: pIdx, tile, isCalled: true });
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
    }

    calls.sort((a, b) => {
      const pri = { ron:0, 'ron-no-yaku':1, 'ron-furiten':2, kan:3, pon:4, chi:5 };
      return (pri[a.type] ?? 99) - (pri[b.type] ?? 99);
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

    for (const c of aiCalls) {
      if (c.type === 'ron') {
        this.players[c.playerIdx].isTempFuriten = true;
      }
    }

    this.advanceTurn();
    return false;
  }

  humanCall(callChoice) {
    if (callChoice.type === 'pass') {
      const hadRon = this.availableCalls.some(c => c.playerIdx === 0 && c.type === 'ron');
      if (hadRon) this.players[0].isTempFuriten = true;
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
      p.melds.push({ type:'triplet', tiles:[tile, tile, tile], open:true, from: this.lastDiscardPlayer, calledIndex:0 });
      if (this.lastDiscard) this.lastDiscard.called = true;
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
      const chiTileSet = call.chosenChiSet !== undefined ? call.chiSets[call.chosenChiSet] : call.chiSets[0];
      const meldTiles = chiTileSet.slice();
      const calledIndex = meldTiles.findIndex(t => t.key() === tile.key());
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
      p.melds.push({ type:'sequence', tiles:meldTiles, open:true, from: this.lastDiscardPlayer, calledIndex });
      if (this.lastDiscard) this.lastDiscard.called = true;
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
      p.melds.push({ type:'kan', tiles:[tile, tile, tile, tile], open:true, from: this.lastDiscardPlayer, calledIndex:0 });
      if (this.lastDiscard) this.lastDiscard.called = true;
      this.lastDiscard = null;
      this.lastDiscardPlayer = -1;
      this.lastActionWasKan = true;
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
    if (playerIdx !== this.lastLogPlayer) this.logGroup++;
    this.lastLogPlayer = playerIdx;
    const p = this.players[playerIdx];
    this.log.push({
      id: this.logEntryId++,
      turn: this.turnCount,
      group: this.logGroup,
      player: p ? p.name : '系統',
      action,
      detail: detail || '',
    });
    if (this.log.length > 256) this.log.shift();
  }

  addSystemLog(action, detail) {
    this.addLog(-1, action, detail);
  }

  advanceTurn() {
    this.addLog(this.currentPlayer, '→', this.players[(this.currentPlayer + 1) % 4].name);
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.lastActionWasKan = false;
    this.availableCalls = [];
    this.availableActions = [];
    this.players[this.currentPlayer].lastDraw = null;
    this.currentPlayer = (this.currentPlayer + 1) % 4;
    this.phase = 'draw';
  }

  // ===== Riichi =====

  humanRiichi(tileIdx) {
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
    p.riichiTurn = this.turnCount;
    this.addLog(this.currentPlayer, '立直', tile.name);
    this.executeDiscard(this.currentPlayer, tileIdx, true);
    if (this.phase === 'call_pending') {
      p.ippatsuRound = this.turnCount;
    }
    p.score -= 1000;
    this.riichiSticks++;
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
      this.lastActionWasKan = true;
      this.wall.addDoraIndicator();
      this.availableActions = [];
      this.phase = 'rinshan';
      return;
    }

    for (const m of p.melds) {
      if (m.type === 'triplet' && m.tiles[0].key() === tile.key() && !m.isKan) {
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
      if (m.type === 'triplet' && !m.isKan) {
        const ponKey = m.tiles[0].key();
        if ((counts[ponKey] || 0) >= 1) {
          const tile = p.hand.find(t => t.key() === ponKey);
          if (tile) {
            const shantenBefore = estimateShanten(p.hand, p.melds);
            const handAfter = removeTiles(p.hand, ponKey, 1);
            const shantenAfter = estimateShanten(handAfter, p.melds);
            if (shantenAfter <= shantenBefore) {
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
              this.lastActionWasKan = true;
              this.wall.addDoraIndicator();
              this.addLog(playerIdx, '加槓', tile.name);
              this.availableActions = [];
              this.phase = 'rinshan';
              return true;
            }
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
    if (this.isFuriten(playerIdx)) return null;
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
    const isRenchan = playerIdx === this.dealerIndex;
    const nextRoundNum = isRenchan ? this.roundNumber : this.roundNumber + 1;
    const nextWind = ['東', '南', '西', '北'][Math.floor(nextRoundNum / 4) % 4];
    const nextRoundLabel = `${nextWind}${(nextRoundNum % 4) + 1}局`;
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
      doraHan: result.doraHan || 0,
      uraDoraHan: result.uraDoraHan || 0,
      isRenchan,
      nextRoundLabel,
    };

    this.applyScore(playerIdx, result.payments);
    this.addSystemLog('和牌', p.name);
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
      const totalHonba = this.honba * 300;
      if (payments.type === 'tsumo') {
        for (let i = 0; i < 4; i++) {
          if (i === winnerIdx) continue;
          this.players[i].score -= this.honba * 100;
        }
      } else {
        this.players[this.lastDiscardPlayer].score -= totalHonba;
      }
      p.score += totalHonba;
    }

    if (this.riichiSticks > 0) {
      p.score += this.riichiSticks * 1000;
      this.riichiSticks = 0;
    }
  }

  handleExhaustiveDraw() {
    this.addSystemLog('流局', '');
    this.phase = 'exhaustive_draw';
    const tenpaiPlayers = [];
    const notenPlayers = [];

    for (let i = 0; i < 4; i++) {
      const p = this.players[i];
      p.isTenpai = checkTenpai(p.hand, p.melds);
      if (p.isTenpai) tenpaiPlayers.push(i);
      else notenPlayers.push(i);
    }

    let notenPayment = 0;
    if (notenPlayers.length > 0 && tenpaiPlayers.length > 0) {
      const paymentPerNoten = 3000 / notenPlayers.length;
      const total = 3000;
      notenPayment = total / tenpaiPlayers.length;
      for (const ti of tenpaiPlayers) {
        this.players[ti].score += notenPayment;
      }
      for (const ni of notenPlayers) {
        this.players[ni].score -= paymentPerNoten;
      }
    }

    for (const p of this.players) {
        p.isRiichi = false;
        p.riichiTurn = -1;
    }

    const dealerTenpai = tenpaiPlayers.includes(this.dealerIndex);
    const isRenchan = dealerTenpai;
    const nextRoundNum = isRenchan ? this.roundNumber : this.roundNumber + 1;
    const nextWind = ['東', '南', '西', '北'][Math.floor(nextRoundNum / 4) % 4];
    const nextRoundLabel = `${nextWind}${(nextRoundNum % 4) + 1}局`;

    this.roundResult = {
      winner: -1,
      winType: 'exhaustive',
      tenpaiPlayers,
      notenPlayers,
      honba: this.honba,
      riichiSticks: this.riichiSticks,
      notenPayment,
      isRenchan,
      nextRoundLabel,
    };
    this.roundOver = true;
    this.phase = 'round_end';
  }

  // ===== Game State for Yaku =====

  isFuriten(playerIdx) {
    const p = this.players[playerIdx];
    if (p.isTempFuriten) return true;
    const waits = getWaitingTiles(p.hand, p.melds);
    if (waits.length === 0) return false;
    return waits.some(w => p.discards.some(d => d.key() === w.key()));
  }

  getGameState(playerIdx, winTile, winType) {
    const p = this.players[playerIdx];
    return {
      isDealer: playerIdx === this.dealerIndex,
      seatWind: p.seatWind,
      roundWind: this.roundWind + 1,
      winType,
      winTile,
      isRiichi: p.isRiichi,
      isDoubleRiichi: p.isRiichi && p.riichiTurn === 0,
      isIppatsu: p.ippatsuRound >= 0 && (this.turnCount - p.ippatsuRound <= 1),
      isTenhou: this.turnCount === 0 && winType === 'tsumo' && playerIdx === this.dealerIndex,
      isChiihou: this.turnCount === 0 && winType === 'tsumo' && playerIdx !== this.dealerIndex,
      isRinshan: this.phase === 'rinshan',
      isChankan: this.phase === 'call_pending' && this.lastActionWasKan,
      isHaitei: this.wall.isExhausted() && winType === 'tsumo',
      isHoutei: this.wall.isExhausted() && winType === 'ron',
      doraIndicators: this.wall.getDoraIndicators(),
      uraDoraIndicators: this.wall.getUraDoraIndicators(),
    };
  }

  // ===== End Game =====

  checkGameOver() {
    if (this.roundNumber >= this.maxRounds) {
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
    if (this.roundResult.winner === -1) {
      const dealerTenpai = this.players[this.dealerIndex].isTenpai;
      if (!dealerTenpai) {
        this.dealerIndex = (this.dealerIndex + 1) % 4;
        this.honba = 0;
        this.roundNumber++;
      } else {
        this.honba++;
      }
    } else {
      if (this.roundResult.winner === this.dealerIndex) {
        this.honba++;
      } else {
        this.dealerIndex = (this.dealerIndex + 1) % 4;
        this.honba = 0;
        this.roundNumber++;
      }
    }

    if (this.checkGameOver()) {
      this.phase = 'game_end';
      this.gameOver = true;
      this.addSystemLog('終局', '遊戲結束');
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
