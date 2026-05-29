class Game {
  constructor(options) {
    this.options = options;
    this.players = [];
    this.wall = null;
    this.roundNumber = 0;
    this.honba = 0;
    this.riichiSticks = 0;
    this.dealerIndex = 0;
    if (this.options.startingSeat) {
      if (this.options.startingSeat === 'random') {
        this.dealerIndex = Math.floor(Math.random() * 4);
      } else {
        const seatMap = { east: 0, south: 3, west: 2, north: 1 };
        this.dealerIndex = seatMap[this.options.startingSeat] || 0;
      }
    }
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
    this.firstRoundActive = false;
    this.firstRoundCallsMade = false;
    this.firstDiscards = [];
    this.kanDeclarers = [];
    this.riichiDeclarers = [];
    this.suuchaRiichiPending = false;
    this.sanchaRonCandidates = [];
    this.sanchaRonPending = false;
    this.roundCount = 0;
    this.renchanCount = 0;
    this.ryuukyokuCount = 0;
    this.log = [];
    this.logGroup = 0;
    this.lastLogPlayer = -1;
    this.logEntryId = 0;
  }

  get maxRounds() {
    return this.options.length === 'east' ? 4
         : this.options.length === 'half' ? 8 : 16;
  }

  get roundWind() {
    return Math.floor(this.roundNumber / 4);
  }

  get roundLabel() {
    let label = ['東','南','西','北'][Math.floor(this.roundNumber / 4)] + ((this.roundNumber % 4) + 1) + '局';
    if (this.roundNumber === this.maxRounds - 1) label += ' All Last';
    return label;
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
        difficulty: i === 0 ? this.options.autoPlayDifficulty || 'normal' : this.options.difficulties[i - 1],
        ai: AIFactory.create(i === 0 ? this.options.autoPlayDifficulty || 'normal' : this.options.difficulties[i - 1]),
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
        stats: { tsumo: 0, ron: 0, dealtIn: 0 },
      });
    }
    this.roundNumber = 0;
    this.honba = 0;
    this.riichiSticks = 0;
    this.dealerIndex = 0;
    if (this.options.startingSeat && this.options.startingSeat !== 'random') {
      const seatMap = { east: 0, south: 3, west: 2, north: 1 };
      this.dealerIndex = seatMap[this.options.startingSeat] || 0;
    } else if (this.options.startingSeat === 'random') {
      this.dealerIndex = Math.floor(Math.random() * 4);
    }
    this.gameOver = false;
    this.startNewRound();
  }

  startNewRound() {
    this.logGroup = 0;
    this.lastLogPlayer = -1;
    this.firstRoundActive = true;
    this.firstRoundCallsMade = false;
    this.firstDiscards = [];
    this.kanDeclarers = [];
    this.riichiDeclarers = [];
    this.suuchaRiichiPending = false;
    this.sanchaRonCandidates = [];
    this.sanchaRonPending = false;
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
      if (this.canDeclareKyuushu(this.currentPlayer)) {
        if (this.players[this.currentPlayer].isHuman) {
          this.availableActions = ['kyuushu', 'discard'];
          return true;
        }
        if (this.players[this.currentPlayer].ai.decideKyuushu(this, this.currentPlayer)) {
          this.handleKyuushuKyuuhai(this.currentPlayer);
          return true;
        }
      }
      if (this.players[this.currentPlayer].isHuman) {
        this.availableActions = ['discard'];
        return true;
      }
      const idx = this.players[this.currentPlayer].ai.chooseDiscard(this, this.currentPlayer);
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

      const tsumoInfo = this.checkTsumo(this.currentPlayer);
      if (tsumoInfo.canWin) {
        if (this.players[this.currentPlayer].isHuman) {
          this.availableActions = tsumoInfo.hasYaku ? ['tsumo', 'pass'] : ['tsumo-no-yaku', 'pass'];
          return true;
        }
        if (tsumoInfo.hasYaku && this.players[this.currentPlayer].ai.decideTsumo(this, this.currentPlayer)) {
          this.executeWin(this.currentPlayer, 'tsumo', tile);
          return true;
        }
      }

      if (!this.players[this.currentPlayer].isHuman && this.handleAIKan(this.currentPlayer)) {
        return false;
      }

      if (p.ippatsuRound >= 0) {
        p.ippatsuRound = -1;
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
      if (this.turnCount <= 3 && this.canDeclareKyuushu(this.currentPlayer)) {
        if (this.players[this.currentPlayer].isHuman) {
          this.availableActions = ['kyuushu', 'discard'];
          return true;
        }
        if (this.players[this.currentPlayer].ai.decideKyuushu(this, this.currentPlayer)) {
          this.handleKyuushuKyuuhai(this.currentPlayer);
          return true;
        }
      }
      if (this.players[this.currentPlayer].isHuman) {
        this.availableActions = ['discard'];
        return true;
      }
      if (this.handleAIKan(this.currentPlayer)) {
        return false;
      }
      const p = this.players[this.currentPlayer];
      if (!p.isRiichi && p.score >= 1000 && this.wall.getRemainingCount() >= 4 && p.ai.decideRiichi(this, this.currentPlayer)) {
        for (let i = 0; i < p.hand.length; i++) {
          const testHand = p.hand.filter((_, j) => j !== i);
          if (checkTenpai(testHand, p.melds)) {
            this.humanRiichi(i);
            return false;
          }
        }
      }
      const idx = this.players[this.currentPlayer].ai.chooseDiscard(this, this.currentPlayer);
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

      const tsumoInfo = this.checkTsumo(this.currentPlayer);
      if (tsumoInfo.canWin) {
        if (this.players[this.currentPlayer].isHuman) {
          this.availableActions = tsumoInfo.hasYaku ? ['tsumo', 'pass'] : ['tsumo-no-yaku', 'pass'];
          return true;
        }
        if (tsumoInfo.hasYaku && this.players[this.currentPlayer].ai.decideTsumo(this, this.currentPlayer)) {
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

    if (this.firstRoundActive) this.firstDiscards.push(tile);

    let detail = tile.name;
    if (isRiichi) {
      detail += '（立直）';
    } else if (p.lastDraw === tile) {
      detail += '（摸切）';
    }

    this.addLog(playerIdx, '打', detail);

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

    this.sanchaRonCandidates = calls.filter(c => c.type === 'ron').map(c => c.playerIdx);
    this.sanchaRonPending = this.sanchaRonCandidates.length >= 3;

    calls.sort((a, b) => {
      const pri = { ron:0, 'ron-no-yaku':1, 'ron-furiten':2, kan:3, pon:4, chi:5 };
      return (pri[a.type] ?? 99) - (pri[b.type] ?? 99);
    });

    return calls;
  }

  processCallPhase() {
    const aiCalls = this.availableCalls.filter(c => !this.players[c.playerIdx].isHuman);
    const aiDecisions = aiCalls.map(c => {
      const p = this.players[c.playerIdx];
      return { playerIdx: c.playerIdx, call: p.ai.decideCall(this, [c]) };
    }).filter(d => d.call !== null);

    const humanCalls = this.availableCalls.filter(c => this.players[c.playerIdx].isHuman);
    if (humanCalls.length > 0) {
      this.pendingAiDecisions = aiDecisions; // Store AI decisions while waiting for human
      this.availableActions = humanCalls;
      this.availableActions.push({ type: 'pass' });
      return true;
    }

    // No human calls, resolve immediately
    this.resolveCalls(aiDecisions);
    return false;
  }

  humanCall(callChoice) {
    const decisions = this.pendingAiDecisions || [];
    if (callChoice.type !== 'pass') {
      decisions.push({ playerIdx: 0, call: callChoice });
    } else {
      // Check if human passed on Ron for furiten
      const hadRon = this.availableCalls.some(c => c.playerIdx === 0 && (c.type === 'ron' || c.type === 'ron-no-yaku' || c.type === 'ron-furiten'));
      if (hadRon) this.players[0].isTempFuriten = true;
    }
    this.pendingAiDecisions = null;
    this.resolveCalls(decisions);
  }

  resolveCalls(decisions) {
    // 1. Separate Ron vs Others
    const rons = decisions.filter(d => d.call.type === 'ron');
    const others = decisions.filter(d => d.call.type !== 'ron');

    // 2. Handle Ron Priority
    if (rons.length > 0) {
      // Apply Temp Furiten to those who could Ron but didn't
      const ronEligibleIdxs = this.availableCalls.filter(c => c.type === 'ron').map(c => c.playerIdx);
      for (const idx of ronEligibleIdxs) {
        if (!rons.some(r => r.playerIdx === idx)) {
          this.players[idx].isTempFuriten = true;
        }
      }

      // Handle Sancha-ron (Triple Ron)
      if (rons.length >= 3) {
        this.handleSanchaRon();
        return;
      }

      // Sort by seat order from discarder (Head-Bump)
      rons.sort((a, b) => {
        const distA = (a.playerIdx - this.lastDiscardPlayer + 4) % 4;
        const distB = (b.playerIdx - this.lastDiscardPlayer + 4) % 4;
        return distA - distB;
      });

      // Log interception if someone was bumped
      if (rons.length > 1) {
        for (let i = 1; i < rons.length; i++) {
          this.addSystemLog('頭跳', `${this.players[rons[i].playerIdx].name}和了無效`);
        }
      }

      // Log interception if someone's meld was bumped by Ron
      for (const d of others) {
        this.addSystemLog('榮和優先', `${this.players[d.playerIdx].name}鳴牌無效`);
      }

      this.executeCall(rons[0].call);
      return;
    }

    // 3. Handle Meld Priority (Kan/Pon > Chi)
    if (others.length > 0) {
      const pri = { kan: 0, pon: 0, chi: 1 };
      others.sort((a, b) => (pri[a.call.type] ?? 99) - (pri[b.call.type] ?? 99));
      
      const best = others[0];
      // Log interception if Chi was bumped by Pon/Kan
      if (best.call.type !== 'chi') {
        for (let i = 1; i < others.length; i++) {
          if (others[i].call.type === 'chi') {
            this.addSystemLog('鳴牌優先', `${this.players[others[i].playerIdx].name}鳴牌無效`);
          }
        }
      }

      this.executeCall(best.call);
      return;
    }

    // 4. No one called, advance turn
    const ronEligibleIdxs = this.availableCalls.filter(c => c.type === 'ron').map(c => c.playerIdx);
    for (const idx of ronEligibleIdxs) {
      this.players[idx].isTempFuriten = true;
    }
    this.advanceTurn();
  }

  executeCall(call) {
    const { type, playerIdx, tile } = call;
    const p = this.players[playerIdx];

    if (type === 'ron') {
      this.executeWin(playerIdx, 'ron', tile);
      return;
    }

    if (type === 'pon') {
      this.firstRoundActive = false;
      this.firstRoundCallsMade = true;
      this.firstDiscards = [];
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
      const idx = this.players[playerIdx].ai.chooseDiscard(this, playerIdx);
      this.executeDiscard(playerIdx, idx);
      return;
    }

    if (type === 'chi') {
      this.firstRoundActive = false;
      this.firstRoundCallsMade = true;
      this.firstDiscards = [];
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
      const idx = this.players[playerIdx].ai.chooseDiscard(this, playerIdx);
      this.executeDiscard(playerIdx, idx);
      return;
    }

    if (type === 'kan' && call.isCalled) {
      this.firstRoundActive = false;
      this.firstRoundCallsMade = true;
      this.firstDiscards = [];
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
      this.kanDeclarers.push(playerIdx);
      if (this.kanDeclarers.length >= 4 && new Set(this.kanDeclarers).size > 1) {
        this.handleSuukantsuAbort();
        return;
      }
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
    if (this.suuchaRiichiPending) {
      this.suuchaRiichiPending = false;
      this.handleSuuchaRiichi();
      return;
    }
    if (this.firstRoundActive && this.firstDiscards.length === 4) {
      const first = this.firstDiscards[0];
      if (first.isWind && this.firstDiscards.every(t => t.key() === first.key())) {
        this.handleSuufonRendai();
        return;
      }
    }
    this.firstRoundActive = false;
    this.firstDiscards = [];
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
    if (p.score < 1000) return;
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
    this.riichiDeclarers.push(this.currentPlayer);
    if (this.riichiDeclarers.length === 4) {
      this.suuchaRiichiPending = true;
    }
    this.executeDiscard(this.currentPlayer, tileIdx, true);
    if (this.phase === 'call_pending') {
      p.ippatsuRound = this.turnCount;
    }
    p.score -= 1000;
    this.riichiSticks++;
    this.riichiDeclaredThisTurn = true;
  }

  // ===== Kan =====

  // Build available kan options when drawing (for human player)
  buildAvailableKans() {
    const p = this.players[this.currentPlayer];
    if (!p.isHuman) return [];
    if (p.isRiichi) return [];
    if (this.phase !== 'discard' && this.phase !== 'dealer_first_discard') return [];

    const kans = [];
    const handCounts = getCounts(p.hand);

    // Option 1: 暗槓 (4 of a kind in hand)
    for (const [k, c] of Object.entries(handCounts)) {
      if (c === 4) {
        const tile = p.hand.find(t => t.key() === k);
        kans.push({ type: 'ankan', tile, meldIndex: -1, desc: `暗槓 ${tile.name}` });
      }
    }

    // Option 2: 加槓 (add to existing triplet)
    for (let mi = 0; mi < p.melds.length; mi++) {
      const m = p.melds[mi];
      if (m.type === 'triplet' && !m.isKan) {
        const tileKey = m.tiles[0].key();
        if ((handCounts[tileKey] || 0) >= 1) {
          const tile = p.hand.find(t => t.key() === tileKey);
          if (tile) {
            kans.push({ type: 'kakan', tile, meldIndex: mi, desc: `加槓 ${tile.name}` });
          }
        }
      }
    }

    return kans;
  }

  executeKan(kanOption) {
    const p = this.players[this.currentPlayer];
    const tile = kanOption.tile;
    const handCounts = getCounts(p.hand);

    if (kanOption.type === 'ankan') {
      // 暗槓
      const newHand = [];
      let n = 4;
      for (const t of p.hand) {
        if (n > 0 && t.key() === tile.key()) { n--; }
        else { newHand.push(t); }
      }
      p.hand = newHand;
      p.melds.push({ type:'kan', tiles:[tile, tile, tile, tile], open:false });
      this.addLog(this.currentPlayer, '暗槓', tile.name);

      // 國士無雙搶暗槓：暗槓後檢查其他三家是否為國士無雙聽該張牌
      this.lastDiscardPlayer = this.currentPlayer;
      const chankanCalls = [];
      for (let ci = 1; ci <= 3; ci++) {
        const pIdx = (this.currentPlayer + ci) % 4;
        const other = this.players[pIdx];
        const gs = this.getGameState(pIdx, tile, 'ron');
        const result = evaluateHand(other.hand, other.melds, tile, 'ron', gs);
        if (result && !this.isFuriten(pIdx) && result.yaku.some(y => y.name === '国士無双')) {
          chankanCalls.push({ type: 'ron', playerIdx: pIdx, tile });
        }
      }
      if (chankanCalls.length > 0) {
        this.lastActionWasKan = true;
        this.sanchaRonCandidates = chankanCalls.map(c => c.playerIdx);
        this.sanchaRonPending = this.sanchaRonCandidates.length >= 3;
        this.availableCalls = chankanCalls;
        this.availableActions = [];
        this.phase = 'call_pending';
        return;
      }
    } else if (kanOption.type === 'kakan') {
      // 加槓
      const meldIndex = kanOption.meldIndex;
      const m = p.melds[meldIndex];
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
      this.addLog(this.currentPlayer, '加槓', tile.name);

      // 搶槓：加槓後檢查其他三家能否和
      this.lastDiscardPlayer = this.currentPlayer;
      const chankanCalls = [];
      for (let ci = 1; ci <= 3; ci++) {
        const pIdx = (this.currentPlayer + ci) % 4;
        const other = this.players[pIdx];
        const gs = this.getGameState(pIdx, tile, 'ron');
        const result = evaluateHand(other.hand, other.melds, tile, 'ron', gs);
        if (result && !this.isFuriten(pIdx)) {
          chankanCalls.push({ type: 'ron', playerIdx: pIdx, tile });
        }
      }
      if (chankanCalls.length > 0) {
        this.lastActionWasKan = true;
        this.sanchaRonCandidates = chankanCalls.map(c => c.playerIdx);
        this.sanchaRonPending = this.sanchaRonCandidates.length >= 3;
        this.availableCalls = chankanCalls;
        this.availableActions = [];
        this.phase = 'call_pending';
        return;
      }
    }

    // Kan is successful (not robbed or it was an Ankan)
    this.lastActionWasKan = true;
    for (let i = 0; i < 4; i++) {
      this.players[i].ippatsuRound = -1;
    }
    this.wall.addDoraIndicator();
    this.kanDeclarers.push(this.currentPlayer);
    if (this.kanDeclarers.length >= 4 && new Set(this.kanDeclarers).size > 1) {
      this.handleSuukantsuAbort();
      return;
    }
    this.availableActions = [];
    this.phase = 'rinshan';
  }

  // ===== AI Kan Handling =====

  handleAIKan(playerIdx) {
    const p = this.players[playerIdx];
    if (p.isRiichi) return false;
    if (this.phase !== 'discard') return false;
    if (!p.lastDraw) return false;

    const counts = getCounts(p.hand);

    for (const [k, c] of Object.entries(counts)) {
      if (c === 4 && p.ai.decideKan(this, playerIdx)) {
        const tile = p.hand.find(t => t.key() === k);
        const newHand = [];
        let n = 4;
        for (const t of p.hand) {
          if (n > 0 && t.key() === k) { n--; }
          else { newHand.push(t); }
        }
        p.hand = newHand;
        p.melds.push({ type:'kan', tiles:[tile, tile, tile, tile], open:false });
        this.addLog(playerIdx, '暗槓', tile.name);

        // 國士無雙搶暗槓檢查
        this.lastDiscardPlayer = playerIdx;
        const chankanCalls = [];
        for (let ci = 1; ci <= 3; ci++) {
          const oIdx = (playerIdx + ci) % 4;
          const other = this.players[oIdx];
          const gs = this.getGameState(oIdx, tile, 'ron');
          const result = evaluateHand(other.hand, other.melds, tile, 'ron', gs);
          if (result && !this.isFuriten(oIdx) && result.yaku.some(y => y.name === '国士無双')) {
            chankanCalls.push({ type: 'ron', playerIdx: oIdx, tile });
          }
        }
        if (chankanCalls.length > 0) {
          this.lastActionWasKan = true;
          this.sanchaRonCandidates = chankanCalls.map(c => c.playerIdx);
          this.sanchaRonPending = this.sanchaRonCandidates.length >= 3;
          this.availableCalls = chankanCalls;
          this.availableActions = [];
          this.phase = 'call_pending';
          return true;
        }

        this.wall.addDoraIndicator();
        for (let i = 0; i < 4; i++) {
          this.players[i].ippatsuRound = -1;
        }
        this.kanDeclarers.push(playerIdx);
        if (this.kanDeclarers.length >= 4 && new Set(this.kanDeclarers).size > 1) {
          this.handleSuukantsuAbort();
          return true;
        }
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
            const shantenBefore = p.ai.estimateShanten(p.hand, p.melds);
            const handAfter = removeTiles(p.hand, ponKey, 1);
            const shantenAfter = p.ai.estimateShanten(handAfter, p.melds);
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
              this.kanDeclarers.push(playerIdx);
              if (this.kanDeclarers.length >= 4 && new Set(this.kanDeclarers).size > 1) {
                this.handleSuukantsuAbort();
                return true;
              }
              this.addLog(playerIdx, '加槓', tile.name);

              // 搶槓檢查
              this.lastDiscardPlayer = playerIdx;
              const chankanCalls = [];
              for (let ci = 1; ci <= 3; ci++) {
                const pIdx = (playerIdx + ci) % 4;
                const other = this.players[pIdx];
                const gs = this.getGameState(pIdx, tile, 'ron');
                const result = evaluateHand(other.hand, other.melds, tile, 'ron', gs);
                if (result && !this.isFuriten(pIdx)) {
                  chankanCalls.push({ type: 'ron', playerIdx: pIdx, tile });
                }
              }
              if (chankanCalls.length > 0) {
                this.sanchaRonCandidates = chankanCalls.map(c => c.playerIdx);
                this.sanchaRonPending = this.sanchaRonCandidates.length >= 3;
                this.availableCalls = chankanCalls;
                this.availableActions = [];
                this.phase = 'call_pending';
                return true;
              }

              for (let i = 0; i < 4; i++) {
                this.players[i].ippatsuRound = -1;
              }
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

  canDeclareKyuushu(playerIdx) {
    const p = this.players[playerIdx];
    if (p.melds.length > 0) return false;
    const terminalTypes = new Set();
    for (const t of p.hand) {
      if (t.isTerminal) terminalTypes.add(t.key());
    }
    return terminalTypes.size >= 9;
  }

  checkTsumo(playerIdx) {
    const p = this.players[playerIdx];
    if (!p.lastDraw) return { canWin: false, hasYaku: false };
    const handMinusDraw = removeTiles(p.hand, p.lastDraw.key(), 1);
    const canForm = canFormCompleteHand(handMinusDraw, p.melds, p.lastDraw);
    if (!canForm) return { canWin: false, hasYaku: false };
    const result = evaluateHand(
      handMinusDraw,
      p.melds,
      p.lastDraw,
      'tsumo',
      this.getGameState(playerIdx, p.lastDraw, 'tsumo')
    );
    return { canWin: true, hasYaku: result !== null };
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

    if (p.isRiichi) {
      const uraTiles = this.wall.getUraDoraIndicators();
      this.addSystemLog('裏ドラ', uraTiles.map(t => t.name).join(' '));
    }
    this.applyScore(playerIdx, result.payments);
    if (winType === 'tsumo') {
      this.players[playerIdx].stats.tsumo++;
    } else {
      this.players[playerIdx].stats.ron++;
      this.players[this.lastDiscardPlayer].stats.dealtIn++;
    }
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

  wouldTriggerSuufonRendai(tile) {
    if (!this.firstRoundActive) return false;
    if (this.firstDiscards.length !== 3) return false;
    if (!tile || !tile.isWind) return false;
    const first = this.firstDiscards[0];
    return first.isWind && this.firstDiscards.every(t => t.key() === first.key()) && tile.key() === first.key();
  }

  wouldTriggerSuukantsuAbort(playerIdx) {
    if (this.kanDeclarers.length + 1 < 4) return false;
    const allDeclarers = [...this.kanDeclarers, playerIdx];
    return new Set(allDeclarers).size > 1;
  }

  wouldTriggerSuuchaRiichi(playerIdx) {
    return this.riichiDeclarers.length >= 3 && !this.riichiDeclarers.includes(playerIdx);
  }

  handleSuuchaRiichi() {
    this.addSystemLog('流局', '四家立直');
    for (const p of this.players) {
      p.isRiichi = false;
      p.riichiTurn = -1;
      p.score += 1000;
    }
    this.riichiSticks = 0;
    const nextWind = ['東', '南', '西', '北'][Math.floor(this.roundNumber / 4) % 4];
    const nextRoundLabel = `${nextWind}${(this.roundNumber % 4) + 1}局`;
    this.roundResult = {
      winner: -1,
      winType: 'suucha_riichi',
      honba: this.honba,
      riichiSticks: 0,
      isRenchan: true,
      nextRoundLabel,
    };
    this.roundOver = true;
    this.phase = 'round_end';
  }

  wouldTriggerSanchaRon(playerIdx) {
    if (!this.sanchaRonPending) return false;
    const pos = this.sanchaRonCandidates.indexOf(playerIdx);
    return pos >= 2;
  }

  handleSanchaRon() {
    this.addSystemLog('流局', '三家和');
    for (const p of this.players) {
      p.isRiichi = false;
      p.riichiTurn = -1;
    }
    const nextWind = ['東', '南', '西', '北'][Math.floor(this.roundNumber / 4) % 4];
    const nextRoundLabel = `${nextWind}${(this.roundNumber % 4) + 1}局`;
    this.roundResult = {
      winner: -1,
      winType: 'sancha_ron',
      honba: this.honba,
      riichiSticks: this.riichiSticks,
      isRenchan: true,
      nextRoundLabel,
    };
    this.roundOver = true;
    this.phase = 'round_end';
  }

  handleSuukantsuAbort() {
    this.addSystemLog('流局', '四槓散了');
    for (const p of this.players) {
      p.isRiichi = false;
      p.riichiTurn = -1;
    }
    const nextWind = ['東', '南', '西', '北'][Math.floor(this.roundNumber / 4) % 4];
    const nextRoundLabel = `${nextWind}${(this.roundNumber % 4) + 1}局`;
    this.roundResult = {
      winner: -1,
      winType: 'suukantsu_abort',
      honba: this.honba,
      riichiSticks: this.riichiSticks,
      isRenchan: true,
      nextRoundLabel,
    };
    this.roundOver = true;
    this.phase = 'round_end';
  }

  handleSuufonRendai() {
    this.addSystemLog('流局', '四風連打');
    for (const p of this.players) {
      p.isRiichi = false;
      p.riichiTurn = -1;
    }
    const nextWind = ['東', '南', '西', '北'][Math.floor(this.roundNumber / 4) % 4];
    const nextRoundLabel = `${nextWind}${(this.roundNumber % 4) + 1}局`;
    this.roundResult = {
      winner: -1,
      winType: 'suufon_rendai',
      honba: this.honba,
      riichiSticks: this.riichiSticks,
      isRenchan: true,
      nextRoundLabel,
    };
    this.roundOver = true;
    this.phase = 'round_end';
  }

  handleKyuushuKyuuhai(playerIdx) {
    this.addSystemLog('流局', '九種九牌 by ' + this.players[playerIdx].name);
    for (const p of this.players) {
      p.isRiichi = false;
      p.riichiTurn = -1;
    }
    const nextWind = ['東', '南', '西', '北'][Math.floor(this.roundNumber / 4) % 4];
    const nextRoundLabel = `${nextWind}${(this.roundNumber % 4) + 1}局`;
    this.roundResult = {
      winner: -1,
      winType: 'kyuushu_kyuuhai',
      declarer: playerIdx,
      honba: this.honba,
      riichiSticks: this.riichiSticks,
      isRenchan: true,
      nextRoundLabel,
    };
    this.roundOver = true;
    this.phase = 'round_end';
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
      isDoubleRiichi: p.isRiichi && !this.firstRoundCallsMade && p.riichiTurn < 4,
      isIppatsu: p.ippatsuRound >= 0,
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
    return false;
  }

  endRound() {
    this.roundCount++;
    if (this.roundResult.winner === -1) this.ryuukyokuCount++;
    if (this.roundResult.winType === 'kyuushu_kyuuhai' || this.roundResult.winType === 'suufon_rendai' || this.roundResult.winType === 'suukantsu_abort' || this.roundResult.winType === 'suucha_riichi' || this.roundResult.winType === 'sancha_ron') {
      this.honba++;
    } else if (this.roundResult.winner === -1) {
      const dealerTenpai = this.players[this.dealerIndex].isTenpai;
      if (!dealerTenpai) {
        this.dealerIndex = (this.dealerIndex + 1) % 4;
        this.honba = 0;
        this.roundNumber++;
      } else {
        this.honba++;
        this.renchanCount++;
      }
    } else {
      if (this.roundResult.winner === this.dealerIndex) {
        this.honba++;
        this.renchanCount++;
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
      tsumo: p.stats.tsumo,
      ron: p.stats.ron,
      dealtIn: p.stats.dealtIn,
    }));
    scores.sort((a, b) => b.score - a.score);
    scores.forEach((s, i) => { s.rank = i + 1; });
    return scores;
  }
}
