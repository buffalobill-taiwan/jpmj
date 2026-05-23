// ===== State Management =====

const SCREEN = { TITLE:0, GAME:1, RESULT:2 };
const TICK = 100;

let currentScreen = SCREEN.TITLE;
let game = null;
let selectedTile = -1;
let autoPlay = false;
let setup = {
  length: 'east',
  difficulties: ['normal','normal','normal'],
};

// ===== Initialization =====

function init() {
  renderTitleScreen();
  bindTitleEvents();
  setupLogDrag();
}

function setupLogDrag() {
  const log = document.getElementById('game-log');
  const handle = document.getElementById('log-drag-handle');
  let dragging = false, startX, startY, startLeft, startTop;

  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    const rect = log.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    log.style.left = (startLeft + e.clientX - startX) + 'px';
    log.style.top = (startTop + e.clientY - startY) + 'px';
    log.style.right = 'auto';
    log.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
  });
}

// ===== Title Screen =====

function renderTitleScreen() {
  currentScreen = SCREEN.TITLE;
  document.getElementById('title-screen').style.display = 'flex';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('result-screen').style.display = 'none';
  document.getElementById('round-result').style.display = 'none';
}

function bindTitleEvents() {
  document.querySelectorAll('input[name="length"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('selected'));
      const btn = document.querySelector(`.length-btn[data-value="${radio.value}"]`);
      if (btn) btn.classList.add('selected');
      setup.length = radio.value;
    });
  });

  document.querySelectorAll('.length-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const radio = document.getElementById(`len-${btn.dataset.value}`);
      if (radio) radio.checked = true;
      setup.length = btn.dataset.value;
    });
  });

  document.querySelectorAll('.difficulty-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.dataset.player);
      setup.difficulties[idx] = sel.value;
    });
  });

  document.getElementById('start-btn').addEventListener('click', startGame);
}

// ===== Start Game =====

function startGame() {
  game = new Game({
    length: setup.length,
    difficulties: [...setup.difficulties],
  });
  game.initGame();
  currentScreen = SCREEN.GAME;
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  selectedTile = -1;
  renderGame();
  continueGame();
}

function continueGame() {
  if (!game) return;
  if (game.gameOver) { autoPlay = false; showFinalResult(); return; }
  if (game.roundOver) { autoPlay = false; setTimeout(() => showRoundResult(), TICK); return; }

  renderGame();
  const needHuman = game.advance();
  renderGame();

  if (game.roundOver) {
    autoPlay = false;
    setTimeout(() => showRoundResult(), TICK);
    return;
  }

  if (!needHuman) {
    setTimeout(continueGame, TICK);
  } else if (autoPlay) {
    processAutoPlay();
    renderGame();
    setTimeout(continueGame, TICK);
  }
}

// ===== Game Rendering =====

function renderGame() {
  if (!game) return;

  renderCenterInfo();
  renderPlayerArea();
  renderOpponent('opponent-right', 1);
  renderOpponent('opponent-top', 2);
  renderOpponent('opponent-left', 3);
  renderControls();
  renderLog();
}

function renderCenterInfo() {
  const ci = document.getElementById('center-info');
  let rLabel = `${game.roundLabel} ${game.roundWindName}風`;
  const extras = [];
  if (game.honba > 0) extras.push(`連莊 本場${game.honba}`);
  if (game.riichiSticks > 0) extras.push(`立直${game.riichiSticks}`);
  if (extras.length > 0) rLabel += ' ' + extras.join(' ');
  ci.querySelector('.round-label').textContent = rLabel;

  const wallCount = game.wall.getRemainingCount();
  ci.querySelector('.wall-count').textContent = `殘牌 ${wallCount} 張`;

  const doraArea = document.getElementById('dora-area');
  doraArea.innerHTML = '';
  const indicators = game.wall.getDoraIndicators();
  for (const ind of indicators) {
    const span = document.createElement('span');
    span.className = 'tile-char';
    span.textContent = ind.char;
    doraArea.appendChild(span);
  }
  const maxDoraPositions = 5;
  for (let i = indicators.length; i < maxDoraPositions; i++) {
    const span = document.createElement('span');
    span.className = 'tile-char tile-back';
    span.textContent = '🀫\uFE0F';
    doraArea.appendChild(span);
  }
}

function renderPlayerArea() {
  const p = game.players[0];

  const pNameEl = document.querySelector('#player-info .player-name');
  pNameEl.textContent = `${p.name} (${['東','南','西','北'][p.seatWind-1]})`;
  pNameEl.classList.toggle('riichi-active', p.isRiichi);
  document.querySelector('#player-info .player-score').textContent = `${p.score}点`;

  const meldsDiv = document.getElementById('player-melds');
  meldsDiv.innerHTML = '';
  for (const m of p.melds) {
    const group = document.createElement('span');
    group.className = 'meld-group';
    for (const t of m.tiles) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      span.textContent = t.char;
      group.appendChild(span);
    }
    meldsDiv.appendChild(group);
  }

  const discardsDiv = document.getElementById('player-discards');
  discardsDiv.innerHTML = '';
  const playerDiscards = p.discards.slice(-24);
  for (let i = 0; i < 24; i++) {
    const span = document.createElement('span');
    span.className = 'tile-char';
    if (i < playerDiscards.length) {
      const d = playerDiscards[i];
      if (d.called) span.classList.add('called');
      if (d.isRiichi) span.classList.add('riichi-tile');
      span.textContent = d.char;
    } else {
      span.style.visibility = 'hidden';
      span.style.pointerEvents = 'none';
      span.textContent = '🀫\uFE0F';
    }
    discardsDiv.appendChild(span);
  }

  const handDiv = document.getElementById('player-hand');
  handDiv.innerHTML = '';

  const drawnTile = p.lastDraw;
  const drawnInHand = drawnTile ? p.hand.findIndex(t => t === drawnTile) : -1;

  for (let i = 0; i < p.hand.length; i++) {
    if (i === drawnInHand) continue;
    const t = p.hand[i];

    const slot = document.createElement('div');
    slot.className = 'tile-slot';
    if (i === selectedTile) slot.classList.add('selected');

    const span = document.createElement('span');
    span.className = 'tile-char';
    span.textContent = t.char;
    slot.appendChild(span);

    const label = document.createElement('div');
    label.className = 'tile-label';
    label.textContent = t.name;
    slot.appendChild(label);

    slot.addEventListener('click', () => onTileClick(i));
    handDiv.appendChild(slot);
  }

  const gap = document.createElement('div');
  gap.className = 'tile-gap';
  handDiv.appendChild(gap);

  if (drawnInHand >= 0) {
    const t = p.hand[drawnInHand];
    const slot = document.createElement('div');
    slot.className = 'tile-slot last-draw-slot';
    if (drawnInHand === selectedTile) slot.classList.add('selected');

    const span = document.createElement('span');
    span.className = 'tile-char';
    span.textContent = t.char;
    slot.appendChild(span);

    const label = document.createElement('div');
    label.className = 'tile-label';
    label.textContent = t.name;
    slot.appendChild(label);

    slot.addEventListener('click', () => onTileClick(drawnInHand));
    handDiv.appendChild(slot);
  } else {
    const slot = document.createElement('div');
    slot.className = 'tile-slot';
    slot.style.visibility = 'hidden';
    slot.style.pointerEvents = 'none';
    const span = document.createElement('span');
    span.className = 'tile-char';
    span.textContent = '🀫\uFE0F';
    slot.appendChild(span);
    handDiv.appendChild(slot);
  }

  const tenpaiHand = drawnInHand >= 0
    ? p.hand.filter((_, i) => i !== drawnInHand)
    : p.hand;
  const isTenpai = checkTenpai(tenpaiHand, p.melds);
  const waits = isTenpai ? getWaitingTiles(tenpaiHand, p.melds) : [];

  const handRow = document.getElementById('player-hand-row');
  const oldIndicator = handRow.querySelector('.tenpai-indicator');
  if (oldIndicator) oldIndicator.remove();

  if (isTenpai && waits.length > 0) {
    const indicator = document.createElement('div');
    indicator.className = 'tenpai-indicator';

    const isFuriten = waits.some(w => p.discards.some(d => d.key() === w.key()));

    const label = document.createElement('span');
    label.className = 'tenpai-label-main' + (isFuriten ? ' tenpai-warning' : '');
    label.textContent = isFuriten ? '聽（振聽）' : '聽';
    indicator.appendChild(label);

    for (const w of waits) {
      const tileSpan = document.createElement('span');
      let cls = 'tenpai-tile';
      if (p.discards.some(d => d.key() === w.key())) cls += ' furiten-wait';
      tileSpan.className = cls;
      tileSpan.textContent = w.char;
      indicator.appendChild(tileSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tenpai-tile-name';
      nameSpan.textContent = w.name;
      indicator.appendChild(nameSpan);
    }

    handRow.appendChild(indicator);
  }
}

function renderOpponent(areaId, playerIdx, reveal) {
  const area = document.getElementById(areaId);
  const p = game.players[playerIdx];
  if (!p) return;

  const oNameEl = area.querySelector('.player-name');
  oNameEl.textContent = `${p.name} (${['東','南','西','北'][p.seatWind-1]})`;
  oNameEl.classList.toggle('riichi-active', p.isRiichi);
  area.querySelector('.player-score').textContent = `${p.score}点`;

  const handDiv = area.querySelector('.tiles-row');
  handDiv.innerHTML = '';
  const drawSlot = area.querySelector('.opponent-last-draw');
  drawSlot.innerHTML = '';

  /* always put a tile-char in the slot (hidden when no draw) */
  const slotTile = document.createElement('span');
  slotTile.className = 'tile-char';
  slotTile.textContent = '🀫\uFE0F';
  drawSlot.appendChild(slotTile);

  if (reveal) {
    /* result screen: show all tiles together in the hand */
    for (const t of p.hand) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      span.textContent = t.char;
      handDiv.appendChild(span);
    }
    slotTile.classList.add('hidden');
  } else {
    /* normal play: separate drawn tile into slot */
    const drawnTile = p.lastDraw;
    const drawnIdx = drawnTile ? p.hand.findIndex(t => t === drawnTile) : -1;
    const nonDrawn = [];
    for (let i = 0; i < p.hand.length; i++) {
      if (i !== drawnIdx) nonDrawn.push(p.hand[i]);
    }

    const hideCount = (p.isRiichi && nonDrawn.length > 0) ? 1 : 0;
    const shownNonDrawn = hideCount > 0 ? nonDrawn.slice(0, -1) : nonDrawn;

    for (const t of shownNonDrawn) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      span.textContent = '🀫\uFE0F';
      handDiv.appendChild(span);
    }
    if (shownNonDrawn.length === 0) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      span.style.visibility = 'hidden';
      span.textContent = '🀫\uFE0F';
      handDiv.appendChild(span);
    }

    /* slot: show tile only when drawn and not riichi */
    if (drawnIdx >= 0 && !p.isRiichi) {
      slotTile.classList.remove('hidden');
    } else {
      slotTile.classList.add('hidden');
    }
  }

  const meldsDiv = area.querySelector('.opponent-melds');
  meldsDiv.innerHTML = '';
  for (const m of p.melds) {
    const group = document.createElement('span');
    group.className = 'meld-group';
    for (const t of m.tiles) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      span.textContent = t.char;
      group.appendChild(span);
    }
    meldsDiv.appendChild(group);
  }

  const discDiv = area.querySelector('.opponent-discards');
  discDiv.innerHTML = '';
  const discards = p.discards.slice(-24);

  for (let i = 0; i < 24; i++) {
    const span = document.createElement('span');
    span.className = 'tile-char';
    if (i < discards.length) {
      const d = discards[i];
      if (d.called) span.classList.add('called');
      if (d.isRiichi) span.classList.add('riichi-tile');
      span.textContent = d.char;
    } else {
      span.style.visibility = 'hidden';
      span.style.pointerEvents = 'none';
      span.textContent = '🀫\uFE0F';
    }
    if (areaId === 'opponent-right') {
      span.style.gridRow = String(12 - (i % 12));
      span.style.gridColumn = String(Math.floor(i / 12) + 1);
    } else if (areaId === 'opponent-left') {
      span.style.gridRow = String((i % 12) + 1);
      span.style.gridColumn = String(Math.floor(i / 12) === 0 ? 2 : 1);
    }
    discDiv.appendChild(span);
  }
}

// ===== Controls =====

function renderControls() {
  const ctrl = document.getElementById('controls');
  ctrl.innerHTML = '';

  if (game.phase === 'call_pending') {
    const available = game.availableActions || [];
    for (const action of available) {
      if (action.type === 'pass') {
        const btn = document.createElement('button');
        btn.textContent = '過';
        btn.addEventListener('click', () => {
          game.humanCall(action);
          continueGame();
        });
        ctrl.appendChild(btn);
      } else if (action.type === 'ron') {
        const btn = document.createElement('button');
        btn.className = 'danger';
        btn.textContent = 'ロン';
        btn.addEventListener('click', () => {
          game.humanCall(action);
          renderGame();
          showRoundResult();
        });
        ctrl.appendChild(btn);
      } else if (action.type === 'ron-no-yaku') {
        const btn = document.createElement('button');
        btn.className = 'disabled';
        btn.textContent = 'ロン(無役)';
        btn.disabled = true;
        ctrl.appendChild(btn);
      } else if (action.type === 'ron-furiten') {
        const btn = document.createElement('button');
        btn.className = 'disabled';
        btn.textContent = 'ロン(振聽)';
        btn.disabled = true;
        ctrl.appendChild(btn);
      } else if (action.type === 'pon') {
        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = 'ポン';
        btn.addEventListener('click', () => {
          game.humanCall(action);
          continueGame();
        });
        ctrl.appendChild(btn);
      } else if (action.type === 'chi') {
        const chiSets = action.chiSets || [];
        const btn = document.createElement('button');
        btn.textContent = 'チー';
        btn.addEventListener('click', () => {
          if (chiSets.length <= 1) {
            game.humanCall({ ...action, chosenChiSet: 0 });
            continueGame();
          } else {
            showChiModal();
          }
        });
        ctrl.appendChild(btn);
      } else if (action.type === 'kan') {
        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = 'カン';
        btn.addEventListener('click', () => {
          game.humanCall(action);
          continueGame();
        });
        ctrl.appendChild(btn);
      }
    }
  } else if ((game.phase === 'discard' || game.phase === 'dealer_first_discard') && game.currentPlayer === 0) {
    const p = game.players[0];
    if (p.isRiichi) {
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = '立直中';
      btn.disabled = true;
      ctrl.appendChild(btn);
    } else if (p.melds.length === 0 && game.wall.getRemainingCount() >= 4) {
      const riichiCandidates = [];
      const seenKeys = new Set();
      for (let i = 0; i < p.hand.length; i++) {
        const k = p.hand[i].key();
        if (seenKeys.has(k)) continue;
        const testHand = p.hand.filter((_, j) => j !== i);
        if (checkTenpai(testHand, p.melds)) {
          riichiCandidates.push(i);
          seenKeys.add(k);
        }
      }
      if (riichiCandidates.length > 0) {
        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = '立直';
        btn.addEventListener('click', () => {
          if (riichiCandidates.length === 1) {
            game.humanRiichi(riichiCandidates[0]);
            selectedTile = -1;
            continueGame();
          } else {
            showRiichiModal(riichiCandidates);
          }
        });
        ctrl.appendChild(btn);
      }
    }

    if (selectedTile >= 0) {
      const counts = getCounts(p.hand);
      const selectedKey = p.hand[selectedTile].key();

      if (!p.isRiichi) {
        if ((counts[selectedKey] || 0) >= 4) {
          const btn = document.createElement('button');
          btn.className = 'primary';
          btn.textContent = 'カン';
          btn.addEventListener('click', () => {
            game.humanKan(selectedTile);
            selectedTile = -1;
            continueGame();
          });
          ctrl.appendChild(btn);
        }

        for (const m of p.melds) {
          if (m.type === 'triplet' && !m.isKan && m.tiles[0].key() === selectedKey) {
            const btn = document.createElement('button');
            btn.className = 'primary';
            btn.textContent = '加槓';
            btn.addEventListener('click', () => {
              game.humanKan(selectedTile);
              selectedTile = -1;
              continueGame();
            });
            ctrl.appendChild(btn);
            break;
          }
        }
      }

      const btn = document.createElement('button');
      btn.textContent = '切る';
      btn.addEventListener('click', () => {
        if (selectedTile >= 0) {
          game.humanDiscard(selectedTile);
          selectedTile = -1;
          continueGame();
        }
      });
      ctrl.appendChild(btn);
    }
  } else if (game.availableActions) {
    for (const action of game.availableActions) {
      if (action === 'discard') {
        if (selectedTile >= 0) {
          const btn = document.createElement('button');
          btn.textContent = '切る';
          btn.addEventListener('click', () => {
            game.humanDiscard(selectedTile);
            selectedTile = -1;
            continueGame();
          });
          ctrl.appendChild(btn);
        }
      } else if (action === 'tsumo') {
        const btn = document.createElement('button');
        btn.className = 'danger';
        btn.textContent = 'ツモ';
        btn.addEventListener('click', () => {
          const p = game.players[0];
          const tile = p.lastDraw;
          game.executeWin(0, 'tsumo', tile);
          renderGame();
          showRoundResult();
        });
        ctrl.appendChild(btn);
      } else if (action === 'pass') {
        const btn = document.createElement('button');
        btn.textContent = 'スルー';
        btn.addEventListener('click', () => {
          game.availableActions = [];
          game.phase = 'discard';
          continueGame();
        });
        ctrl.appendChild(btn);
      }
    }
  }

  if (!game.gameOver && !game.roundOver) {
    const autoBtn = document.createElement('button');
    autoBtn.className = 'auto-btn';
    autoBtn.textContent = autoPlay ? '中止' : '託管';
    autoBtn.addEventListener('click', () => {
      autoPlay = !autoPlay;
      renderGame();
      if (autoPlay) continueGame();
    });
    ctrl.appendChild(autoBtn);
  }
}

// ===== Auto-Play =====

function processAutoPlay() {
  // A. Discard phase
  if (game.phase === 'dealer_first_discard' || game.phase === 'discard') {
    if (game.players[game.currentPlayer].isHuman && game.availableActions.includes('discard')) {
      if (game.handleAIKan(0)) return;
      const p = game.players[0];
      if (!p.isRiichi && p.melds.length === 0) {
        for (let i = 0; i < p.hand.length; i++) {
          const testHand = p.hand.filter((_, j) => j !== i);
          if (checkTenpai(testHand, p.melds) && Math.random() < AI_DIFFICULTY.normal.riichiRate) {
            selectedTile = -1;
            game.humanRiichi(i);
            return;
          }
        }
      }
      const idx = normalDiscard(game, 0);
      selectedTile = -1;
      game.humanDiscard(idx);
      return;
    }
  }

  // B. Call pending
  if (game.phase === 'call_pending') {
    const humanCalls = game.availableActions.filter(a => a.type && a.type !== 'pass');
    const ronCall = humanCalls.find(a => a.type === 'ron');
    if (ronCall) {
      game.humanCall(ronCall);
      return;
    }

    const p = game.players[0];
    const shantenBefore = estimateShanten(p.hand, p.melds);

    const kanCall = humanCalls.find(a => a.type === 'kan');
    if (kanCall) {
      const handAfter = removeTiles(p.hand, kanCall.tile.key(), 3);
      const shantenAfter = estimateShanten(handAfter, [...p.melds, {type:'kan'}]);
      if (shantenAfter < shantenBefore) {
        game.humanCall(kanCall);
        return;
      }
    }

    const nonRonCalls = humanCalls.filter(a => a.type === 'pon' || a.type === 'chi');
    let chosenCall = null;
    for (const call of nonRonCalls) {
      if (call.type === 'pon') {
        const handAfter = removeTiles(p.hand, call.tile.key(), 2);
        const shantenAfter = estimateShanten(handAfter, [...p.melds, {type:'pon'}]);
        if (shantenAfter < shantenBefore) {
          chosenCall = call;
          break;
        }
      } else if (call.type === 'chi') {
        for (let ci = 0; ci < call.chiSets.length; ci++) {
          const chiSet = call.chiSets[ci];
          let handAfter = [...p.hand];
          for (const ct of chiSet) {
            if (ct.key() === call.tile.key()) continue;
            handAfter = removeTiles(handAfter, ct.key(), 1);
          }
          const shantenAfter = estimateShanten(handAfter, [...p.melds, {type:'chi'}]);
          if (shantenAfter < shantenBefore) {
            chosenCall = { ...call, chosenChiSet: ci };
            break;
          }
        }
        if (chosenCall) break;
      }
    }
    if (chosenCall) {
      game.humanCall(chosenCall);
      return;
    }

    const passAction = game.availableActions.find(a => a.type === 'pass');
    if (passAction) {
      game.humanCall(passAction);
      return;
    }
    return;
  }

  // C. Tsumo / pass
  if (game.availableActions) {
    for (const action of game.availableActions) {
      if (action === 'tsumo') {
        if (aiDecideTsumo(game, 0)) {
          const p = game.players[0];
          const tile = p.lastDraw;
          game.executeWin(0, 'tsumo', tile);
        } else {
          game.availableActions = [];
          game.phase = 'discard';
        }
        return;
      }
    }
    for (const action of game.availableActions) {
      if (action === 'pass') {
        game.availableActions = [];
        game.phase = 'discard';
        return;
      }
    }
  }
}

function showChiModal() {
  const modal = document.getElementById('chi-modal');
  const options = document.getElementById('chi-options');
  options.innerHTML = '';
  const chiActions = game.availableActions.filter(a => a.type === 'chi');
  for (const action of chiActions) {
    for (let ci = 0; ci < action.chiSets.length; ci++) {
      const cs = action.chiSets[ci];
      const btn = document.createElement('button');
      btn.textContent = cs.map(t => t.char).join(' ');
      btn.addEventListener('click', () => {
        modal.style.display = 'none';
        game.humanCall({ ...action, chosenChiSet: ci });
        continueGame();
      });
      options.appendChild(btn);
    }
  }
  document.getElementById('chi-cancel').onclick = () => {
    modal.style.display = 'none';
    const passAction = game.availableActions.find(a => a.type === 'pass');
    if (passAction) game.humanCall(passAction);
    continueGame();
  };
  modal.style.display = 'flex';
}

function showRiichiModal(candidates) {
  const modal = document.getElementById('riichi-modal');
  const options = document.getElementById('riichi-options');
  options.innerHTML = '';
  const p = game.players[0];
  for (const idx of candidates) {
    const tile = p.hand[idx];
    const testHand = p.hand.filter((_, j) => j !== idx);
    const waits = getWaitingTiles(testHand, p.melds);
    const waitStr = waits.map(t => t.char + t.name).join('、');
    const btn = document.createElement('button');
    btn.innerHTML = `<span class="riichi-discard">${tile.char} ${tile.name}</span> <span class="riichi-waits">聽：${waitStr}</span>`;
    btn.addEventListener('click', () => {
      modal.style.display = 'none';
      game.humanRiichi(idx);
      continueGame();
    });
    options.appendChild(btn);
  }
  document.getElementById('riichi-cancel').onclick = () => {
    modal.style.display = 'none';
  };
  modal.style.display = 'flex';
}

function onTileClick(idx) {
  const p = game.players[0];

  if (game.phase === 'dealer_first_discard' || game.phase === 'discard') {
    if (selectedTile === idx) {
      selectedTile = -1;
    } else {
      selectedTile = idx;
    }
    renderGame();
  }
}

// ===== Round Result =====

function getRankLabel(totalHan, isYakuman, yaku) {
  if (isYakuman) {
    const count = yaku.filter(y => y.isYakuman).length;
    if (count >= 2) return count + '倍役満';
    return '役満';
  }
  if (totalHan >= 13) return '数え役満';
  if (totalHan >= 11) return '三倍満';
  if (totalHan >= 8) return '倍満';
  if (totalHan >= 6) return '跳満';
  if (totalHan >= 5) return '満貫';
  return null;
}

function showRoundResult() {
  renderOpponent('opponent-right', 1, true);
  renderOpponent('opponent-top', 2, true);
  renderOpponent('opponent-left', 3, true);

  const overlay = document.getElementById('round-result');
  const content = overlay.querySelector('#round-result-content');

  if (game.roundResult.winType === 'exhaustive') {
    const r = game.roundResult;
    const tenpaiStr = r.tenpaiPlayers.length > 0 ? r.tenpaiPlayers.map(i => game.players[i].name).join('、') : '無';
    const notenStr = r.notenPlayers.length > 0 ? r.notenPlayers.map(i => game.players[i].name).join('、') : '無';

    const paymentLines = [];
    if (r.tenpaiPlayers.length > 0 && r.notenPlayers.length > 0) {
      for (const ti of r.tenpaiPlayers) {
        paymentLines.push(`${game.players[ti].name}: +${r.notenPayment}`);
      }
      const paymentPerNoten = 3000 / r.notenPlayers.length;
      for (const ni of r.notenPlayers) {
        paymentLines.push(`${game.players[ni].name}: -${paymentPerNoten}`);
      }
    }

    let riichiStr = '';
    if (r.riichiSticks > 0) {
      riichiStr = `<div class="detail">立直棒 ${r.riichiSticks} 本（保留至次局）</div>`;
    }

    const honbaStr = r.honba > 0 ? `<div class="detail">本場：${r.honba}</div>` : '';
    const renchanStr = r.isRenchan ? '連莊（親家聽牌）' : '輪莊（親家不聽）';

    content.innerHTML = `
      <h3>流局</h3>
      <div class="detail">聽牌：${tenpaiStr}</div>
      <div class="detail">不聽：${notenStr}</div>
      ${paymentLines.map(l => `<div class="detail">${l}</div>`).join('')}
      ${riichiStr}
      ${honbaStr}
      <div class="detail">${renchanStr} → ${r.nextRoundLabel}</div>
      <button id="next-round-btn">次局へ</button>
    `;
  } else {
    const winner = game.players[game.roundResult.winner];
    const r = game.roundResult;

    const rankLabel = getRankLabel(r.totalHan, r.isYakuman, r.yaku);
    let yakuRows = '';
    for (const y of r.yaku) {
      const hanStr = y.isYakuman ? '役滿' : y.han + '飜';
      yakuRows += `<tr><td>${y.name}</td><td>${hanStr}</td></tr>`;
    }
    if (r.doraHan > 0) yakuRows += `<tr><td>ドラ</td><td>${r.doraHan}飜</td></tr>`;
    if (r.uraDoraHan > 0) yakuRows += `<tr><td>裏ドラ</td><td>${r.uraDoraHan}飜</td></tr>`;
    if (r.totalHan > 0) yakuRows += `<tr class="yaku-total"><td>合計</td><td>${rankLabel || (r.totalHan + '飜 ' + r.fu + '符')}</td></tr>`;
    const yakuStr = `<table class="yaku-table">${yakuRows}</table>`;

    let scoreStr = '';
    const paymentLines = [];
    if (r.payments.type === 'tsumo') {
      const isDealerWinner = game.players[game.roundResult.winner].seatWind === 1;
      const dealerIdx = game.dealerIndex;
      paymentLines.push(`${winner.name}: +${r.payments.total}`);
      for (let i = 0; i < 4; i++) {
        if (i === game.roundResult.winner) continue;
        const amt = i === dealerIdx ? r.payments.dealerPayment : r.payments.childPayment;
        paymentLines.push(`${game.players[i].name}: -${amt}`);
      }
      scoreStr = `ツモ ${r.payments.total}点`;
    } else {
      const discPlayer = game.players[game.lastDiscardPlayer];
      scoreStr = `ロン ${r.payments.discarderPayment}点`;
      if (game.lastDiscardPlayer >= 0) {
        paymentLines.push(`${winner.name}: +${r.payments.discarderPayment}`);
        paymentLines.push(`${discPlayer.name}: -${r.payments.discarderPayment}`);
      }
    }

    const extraDetails = [];
    if (r.honba > 0) extraDetails.push(`本場${r.honba}`);
    if (r.riichiSticks > 0) extraDetails.push(`立直${r.riichiSticks}`);

    content.innerHTML = `
      <h3>${winner.name} ${r.winType === 'tsumo' ? 'ツモ' : 'ロン'}！</h3>
      <div class="score-big">${scoreStr}</div>
      <div class="yaku-list">${yakuStr}</div>
      ${paymentLines.map(l => `<div class="detail">${l}</div>`).join('')}
      ${extraDetails.length > 0 ? `<div class="detail">${extraDetails.join(' ')}</div>` : ''}
      <div class="detail">${game.roundLabel}</div>
      <button id="next-round-btn">次局へ</button>
    `;
  }

  overlay.style.display = 'flex';

  document.getElementById('next-round-btn').addEventListener('click', () => {
    overlay.style.display = 'none';

    if (game.checkGameOver()) {
      showFinalResult();
    } else {
      game.endRound();
      selectedTile = -1;
      continueGame();
    }
  });
}

// ===== Final Result =====

function showFinalResult() {
  currentScreen = SCREEN.RESULT;
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('round-result').style.display = 'none';

  const rs = document.getElementById('result-screen');
  rs.style.display = 'flex';

  if (game.riichiSticks > 0) {
    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    sorted[0].score += game.riichiSticks * 1000;
    game.riichiSticks = 0;
  }

  const scores = game.getFinalScores();
  const list = document.getElementById('rank-list');
  list.innerHTML = '';
  for (const s of scores) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="rank">${s.rank}位</span><span class="name">${s.name}</span><span class="score">${s.score}点</span>`;
    list.appendChild(li);
  }

  document.getElementById('back-btn').addEventListener('click', () => {
    rs.style.display = 'none';
    game = null;
    renderTitleScreen();
  });
}

// ===== Game Log =====

function renderLog() {
  const el = document.getElementById('log-entries');
  if (!el) return;
  const entries = game.log;
  el.innerHTML = entries.slice(-25).map(e =>
    `<div class="log-entry"><span class="log-turn">${e.turn + 1}.</span> <span class="log-player">${e.player}</span> ${e.action}${e.detail ? ' ' + e.detail : ''}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

// ===== Bootstrap =====

document.addEventListener('DOMContentLoaded', init);
