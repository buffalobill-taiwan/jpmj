const SCREEN = { TITLE:0, GAME:1, RESULT:2 };
const TICK = 100;

let currentScreen = SCREEN.TITLE;
let game = null;
let selectedTile = -1;
let autoPlay = false;

const TITLE_TILE_CODEPOINTS = [0x1F000,0x1F001,0x1F002,0x1F003,0x1F004,0x1F005,0x1F006,0x1F007,0x1F00E,0x1F019];

let setup = {
  length: 'east',
  difficulties: ['normal','normal','normal'],
  startingSeat: 'random',
  autoPlayDifficulty: 'normal',
};

// ===== Initialization =====

function init() {
  const savedFont = localStorage.getItem('fontStyle') || 'colorful';
  VARIANT_SELECTOR = savedFont === 'colorful' ? '\uFE0F' : '\uFE0E';
  document.body.classList.toggle('font-mono', savedFont === 'mono');
  document.querySelectorAll('.font-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.value === savedFont);
  });

  populateDifficultySelects();

  const savedLength = localStorage.getItem('setupLength');
  if (savedLength && ['east','half','full'].includes(savedLength)) {
    setup.length = savedLength;
    document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.querySelector(`.length-btn[data-value="${savedLength}"]`);
    if (btn) btn.classList.add('selected');
    const radio = document.getElementById(`len-${savedLength}`);
    if (radio) radio.checked = true;
  }

  const savedDiffs = localStorage.getItem('setupDifficulties');
  if (savedDiffs) {
    try {
      const diffs = JSON.parse(savedDiffs);
      if (Array.isArray(diffs) && diffs.length === 3) {
        setup.difficulties = diffs;
        document.querySelectorAll('.difficulty-select[data-player]').forEach(sel => {
          sel.value = diffs[parseInt(sel.dataset.player)];
        });
      }
    } catch(e) {}
  }

  const savedAutoDiff = localStorage.getItem('setupAutoPlayDifficulty');
  if (savedAutoDiff && AI_TYPES.some(a => a.id === savedAutoDiff)) {
    setup.autoPlayDifficulty = savedAutoDiff;
    const sel = document.querySelector('select[data-auto-play]');
    if (sel) sel.value = savedAutoDiff;
  }

  const savedSeat = localStorage.getItem('setupStartingSeat');
  if (savedSeat && ['random','east','south','west','north'].includes(savedSeat)) {
    setup.startingSeat = savedSeat;
    document.querySelectorAll('.seat-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.querySelector(`.seat-btn[data-value="${savedSeat}"]`);
    if (btn) btn.classList.add('selected');
    const radio = document.getElementById(`seat-${savedSeat}`);
    if (radio) radio.checked = true;
  }

  renderTitleTiles();
  renderTitleScreen();
  bindTitleEvents();
  setupLogDrag();
  setupAutoBtn();
  setupControls();
}

function populateDifficultySelects() {
  document.querySelectorAll('.difficulty-select').forEach(sel => {
    sel.innerHTML = '';
    AI_TYPES.forEach(ai => {
      const opt = document.createElement('option');
      opt.value = ai.id;
      opt.textContent = ai.label;
      if (ai.id === 'normal') opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function renderTitleTiles() {
  const el = document.querySelector('.title-tiles');
  el.textContent = TITLE_TILE_CODEPOINTS.map(cp => String.fromCodePoint(cp) + VARIANT_SELECTOR).join('');
}

function setupAutoBtn() {
  const container = document.getElementById('auto-btn-container');
  const btn = document.createElement('button');
  btn.id = 'auto-btn';
  btn.addEventListener('click', () => {
    autoPlay = !autoPlay;
    updateAutoBtn();
    renderGame();
    if (autoPlay) continueGame();
  });
  container.appendChild(btn);
  updateAutoBtn();
}

function updateAutoBtn() {
  const btn = document.getElementById('auto-btn');
  if (!btn) return;
  btn.className = 'auto-btn';
  btn.textContent = autoPlay ? '中止' : '託管';
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
      localStorage.setItem('setupLength', setup.length);
    });
  });

  document.querySelectorAll('.length-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const radio = document.getElementById(`len-${btn.dataset.value}`);
      if (radio) radio.checked = true;
      setup.length = btn.dataset.value;
      localStorage.setItem('setupLength', setup.length);
    });
  });

  document.querySelectorAll('.difficulty-select[data-player]').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.dataset.player);
      setup.difficulties[idx] = sel.value;
      localStorage.setItem('setupDifficulties', JSON.stringify(setup.difficulties));
    });
  });

  document.querySelectorAll('input[name="seat"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.seat-btn').forEach(b => b.classList.remove('selected'));
      const btn = document.querySelector(`.seat-btn[data-value="${radio.value}"]`);
      if (btn) btn.classList.add('selected');
      setup.startingSeat = radio.value;
      localStorage.setItem('setupStartingSeat', setup.startingSeat);
    });
  });

  document.querySelectorAll('.seat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const radio = document.getElementById(`seat-${btn.dataset.value}`);
      if (radio) radio.checked = true;
      setup.startingSeat = btn.dataset.value;
      localStorage.setItem('setupStartingSeat', setup.startingSeat);
    });
  });

  document.querySelectorAll('.font-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const isMono = btn.dataset.value === 'mono';
      VARIANT_SELECTOR = isMono ? '\uFE0E' : '\uFE0F';
      document.body.classList.toggle('font-mono', isMono);
      localStorage.setItem('fontStyle', btn.dataset.value);
      renderTitleTiles();
    });
  });

  const autoPlaySelect = document.querySelector('select[data-auto-play]');
  if (autoPlaySelect) {
    autoPlaySelect.addEventListener('change', () => {
      setup.autoPlayDifficulty = autoPlaySelect.value;
      localStorage.setItem('setupAutoPlayDifficulty', setup.autoPlayDifficulty);
    });
  }

  document.getElementById('start-btn').addEventListener('click', startGame);
}

// ===== Start Game =====

function startGame() {
  game = new Game({
    length: setup.length,
    difficulties: [...setup.difficulties],
    startingSeat: setup.startingSeat,
    autoPlayDifficulty: setup.autoPlayDifficulty,
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

  const startTime = performance.now();

  const needHuman = game.advance();

  if (needHuman && autoPlay) {
    processAutoPlay();
  }

  renderGame();

  if (game.roundOver) {
    autoPlay = false;
    setTimeout(() => showRoundResult(), TICK);
    return;
  }

  const executionTime = performance.now() - startTime;
  const nextDelay = Math.max(0, TICK - executionTime);

  if (!needHuman || autoPlay) {
    setTimeout(continueGame, nextDelay);
  }
}

// ===== Game Rendering =====

let lastTenpaiCache = {
  handStr: '',
  isTenpai: false,
  waits: []
};

function renderGame() {
  if (!game) return;

  renderCenterInfo();
  renderPlayerArea();
  renderOpponent('opponent-right', 1);
  renderOpponent('opponent-top', 2);
  renderOpponent('opponent-left', 3);
  renderControls();
  renderLog();
  updateAutoBtn();
}

function updateTileChars(container, tiles, count, posFn) {
  let spans = container.querySelectorAll('.tile-char');
  if (spans.length === 0) {
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      container.appendChild(span);
    }
    spans = container.querySelectorAll('.tile-char');
  }

  for (let i = 0; i < count; i++) {
    const span = spans[i];
    if (i < tiles.length) {
      const d = tiles[i];
      const char = d.char || '🀫' + VARIANT_SELECTOR;
      if (span.textContent !== char) span.textContent = char;
      span.style.visibility = 'visible';
      span.style.pointerEvents = 'auto';
      span.className = 'tile-char';
      if (d.called) span.classList.add('called');
      if (d.isRiichi) span.classList.add('riichi-tile');
      if (posFn) posFn(span, i);
    } else {
      span.style.visibility = 'hidden';
      span.style.pointerEvents = 'none';
      span.textContent = '🀫' + VARIANT_SELECTOR;
      span.className = 'tile-char';
    }
  }
}

function renderCenterInfo() {
  const ci = document.getElementById('center-info');
  let rLabel = game.roundLabel;
  const extras = [];
  if (game.honba > 0) extras.push(`連莊 本場${game.honba}`);
  if (game.riichiSticks > 0) extras.push(`立直${game.riichiSticks}`);
  if (extras.length > 0) rLabel += ' ' + extras.join(' ');
  ci.querySelector('.round-label').textContent = rLabel;

  const wallCount = game.wall.getRemainingCount();
  ci.querySelector('.wall-count').textContent = `殘牌 ${wallCount} 張`;

  const doraArea = document.getElementById('dora-area');
  const indicators = game.wall.getDoraIndicators();
  let spans = doraArea.querySelectorAll('.tile-char');
  if (spans.length === 0) {
    for (let i = 0; i < 5; i++) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      doraArea.appendChild(span);
    }
    spans = doraArea.querySelectorAll('.tile-char');
  }
  for (let i = 0; i < 5; i++) {
    const span = spans[i];
    if (i < indicators.length) {
      span.className = 'tile-char';
      span.textContent = indicators[i].char;
    } else {
      span.className = 'tile-char tile-back';
      span.textContent = '🀫' + VARIANT_SELECTOR;
    }
  }
}

function renderMeldTiles(group, meld, reveal) {
  const tiles = meld.tiles;
  for (let i = 0; i < tiles.length; i++) {
    const span = document.createElement('span');
    span.className = 'tile-char';
    if (!reveal && meld.type === 'kan' && !meld.open && (i === 1 || i === 2)) {
      span.textContent = '🀫' + VARIANT_SELECTOR;
    } else {
      span.textContent = tiles[i].char;
    }
    if (meld.type === 'sequence' && i === (meld.calledIndex || 1)) {
      span.classList.add('called');
    } else if (meld.type === 'kan' && meld.isKan && i === tiles.length - 1) {
      span.classList.add('called');
    } else if (meld.open && (meld.type === 'triplet' || meld.type === 'kan') && i === (meld.calledIndex || 0)) {
      span.classList.add('called');
    }
    group.appendChild(span);
  }
}

function renderPlayerArea(mergeLastDraw) {
  const p = game.players[0];

  const pNameEl = document.querySelector('#player-info .player-name');
  pNameEl.textContent = `${p.name}${game.dealerIndex === 0 ? '🏠' : ''} (${['東','南','西','北'][p.seatWind-1]})`;
  pNameEl.classList.toggle('riichi-active', p.isRiichi);
  document.querySelector('#player-info .player-score').textContent = `${p.score}点`;

  const sig = p.hand.map(t => t.key()).join(',') + '|' +
              p.melds.map(m => m.tiles.map(t => t.key()).join('.')).join(',') + '|' +
              selectedTile + '|' + (mergeLastDraw ? '1' : '0');

  const meldsDiv = document.getElementById('player-melds');
  const handDiv = document.getElementById('player-hand');

  if (meldsDiv._sig !== sig) {
    meldsDiv._sig = sig;

    meldsDiv.innerHTML = '';
    for (const m of p.melds) {
      const group = document.createElement('span');
      group.className = 'meld-group';
      renderMeldTiles(group, m, true);
      meldsDiv.appendChild(group);
    }

    handDiv.innerHTML = '';
    const drawnTile = mergeLastDraw ? null : p.lastDraw;
    const drawnInHand = drawnTile ? p.hand.findIndex(t => t === drawnTile) : -1;
    const isMyDiscard = !mergeLastDraw && (game.phase === 'dealer_first_discard' || game.phase === 'discard') && game.currentPlayer === 0;

    for (let i = 0; i < p.hand.length; i++) {
      if (!mergeLastDraw && i === drawnInHand) continue;
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
      if (isMyDiscard) slot.addEventListener('click', () => onTileClick(i));
      handDiv.appendChild(slot);
    }

    if (mergeLastDraw) return;

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
      if (isMyDiscard) slot.addEventListener('click', () => onTileClick(drawnInHand));
      handDiv.appendChild(slot);
    } else {
      const slot = document.createElement('div');
      slot.className = 'tile-slot';
      slot.style.visibility = 'hidden';
      slot.style.pointerEvents = 'none';
      const span = document.createElement('span');
      span.className = 'tile-char';
      span.textContent = '🀫' + VARIANT_SELECTOR;
      slot.appendChild(span);
      handDiv.appendChild(slot);
    }
  }

  const discardsDiv = document.getElementById('player-discards');
  updateTileChars(discardsDiv, p.discards.slice(-24), 24);

  const drawnTile = p.lastDraw;
  const drawnInHand = drawnTile ? p.hand.findIndex(t => t === drawnTile) : -1;
  const tenpaiHand = drawnInHand >= 0
    ? p.hand.filter((_, i) => i !== drawnInHand)
    : p.hand;

  const handStr = tenpaiHand.map(t => t.key()).join(',') + '|' + p.melds.length;
  let isTenpai, waits;
  if (handStr === lastTenpaiCache.handStr) {
    isTenpai = lastTenpaiCache.isTenpai;
    waits = lastTenpaiCache.waits;
  } else {
    isTenpai = checkTenpai(tenpaiHand, p.melds);
    waits = isTenpai ? getWaitingTiles(tenpaiHand, p.melds) : [];
    lastTenpaiCache = { handStr, isTenpai, waits };
  }

  const handRow = document.getElementById('player-hand-row');
  const tenpaiSig = handStr + '|' + p.discards.length;
  if (handRow._tenpaiSig === tenpaiSig && handRow.querySelector('.tenpai-indicator')) {
    // skip — tenpai indicator unchanged
  } else {
    handRow._tenpaiSig = tenpaiSig;
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
}

function renderOpponent(areaId, playerIdx, reveal) {
  const area = document.getElementById(areaId);
  const p = game.players[playerIdx];
  if (!p) return;

  const oNameEl = area.querySelector('.player-name');
  oNameEl.textContent = `${p.name}${game.dealerIndex === playerIdx ? '🏠' : ''} (${['東','南','西','北'][p.seatWind-1]})`;
  oNameEl.classList.toggle('riichi-active', p.isRiichi);
  area.querySelector('.player-score').textContent = `${p.score}点`;

  const sig = p.hand.length + '|' + (p.lastDraw ? 1 : 0) + '|' +
              p.isRiichi + '|' + p.melds.length + '|' + reveal;

  const handDiv = area.querySelector('.tiles-row');
  const drawSlot = area.querySelector('.opponent-last-draw');
  const meldsDiv = area.querySelector('.opponent-melds');

  if (area._oppSig !== sig) {
    area._oppSig = sig;

    handDiv.innerHTML = '';
    drawSlot.innerHTML = '';

    const slotTile = document.createElement('span');
    slotTile.className = 'tile-char';
    slotTile.textContent = '🀫' + VARIANT_SELECTOR;
    drawSlot.appendChild(slotTile);

    const drawnTile = p.lastDraw;
    const drawnIdx = drawnTile ? p.hand.findIndex(t => t === drawnTile) : -1;

    if (reveal) {
      for (const t of p.hand) {
        const span = document.createElement('span');
        span.className = 'tile-char';
        span.textContent = t.char;
        handDiv.appendChild(span);
      }
      slotTile.classList.add('hidden');
    } else {
      const nonDrawn = [];
      for (let i = 0; i < p.hand.length; i++) {
        if (i !== drawnIdx) nonDrawn.push(p.hand[i]);
      }
      const hideCount = (p.isRiichi && nonDrawn.length > 0) ? 1 : 0;
      const shownNonDrawn = hideCount > 0 ? nonDrawn.slice(0, -1) : nonDrawn;
      for (const t of shownNonDrawn) {
        const span = document.createElement('span');
        span.className = 'tile-char';
        span.textContent = '🀫' + VARIANT_SELECTOR;
        handDiv.appendChild(span);
      }
      if (shownNonDrawn.length === 0) {
        const span = document.createElement('span');
        span.className = 'tile-char';
        span.style.visibility = 'hidden';
        span.textContent = '🀫' + VARIANT_SELECTOR;
        handDiv.appendChild(span);
      }
    }

    if (drawnIdx >= 0 && !p.isRiichi) {
      slotTile.classList.remove('hidden');
    } else {
      slotTile.classList.add('hidden');
    }

    meldsDiv.innerHTML = '';
    for (const m of p.melds) {
      const group = document.createElement('span');
      group.className = 'meld-group';
      renderMeldTiles(group, m, false);
      meldsDiv.appendChild(group);
    }
  }

  const discDiv = area.querySelector('.opponent-discards');
  updateTileChars(discDiv, p.discards.slice(-24), 24, (span, i) => {
    if (areaId === 'opponent-right') {
      span.style.gridRow = String(12 - (i % 12));
      span.style.gridColumn = String(Math.floor(i / 12) + 1);
    } else if (areaId === 'opponent-left') {
      span.style.gridRow = String((i % 12) + 1);
      span.style.gridColumn = String(Math.floor(i / 12) === 0 ? 2 : 1);
    }
  });
}

// ===== Controls =====

function setupControls() {
  const ctrl = document.getElementById('controls');
  const b = {};

  function make(id, text, cls) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = text;
    if (cls) btn.className = cls;
    btn.hidden = true;
    ctrl.appendChild(btn);
    return btn;
  }

  b.ron = make('btn-ron', 'ロン', 'danger');
  b.ron.addEventListener('click', () => {
    game.humanCall(b.ron._action);
    renderGame();
    showRoundResult();
  });

  b.pon = make('btn-pon', 'ポン', 'primary');
  b.pon.addEventListener('click', () => {
    game.humanCall(b.pon._action);
    continueGame();
  });

  b.chi = make('btn-chi', 'チー');
  b.chi.addEventListener('click', () => {
    const cs = b.chi._chiSets;
    if (cs && cs.length <= 1) {
      game.humanCall({ ...b.chi._action, chosenChiSet: 0 });
      continueGame();
    } else {
      showChiModal();
    }
  });

  b.kan = make('btn-kan', 'カン', 'primary');
  b.kan.addEventListener('click', () => {
    if (b.kan._mode === 'call') {
      game.humanCall(b.kan._action);
      continueGame();
    } else {
      const p = game.players[0];
      const tile = p.hand[selectedTile];
      const key = tile.key();
      const counts = getCounts(p.hand);
      if ((counts[key] || 0) >= 4) {
        game.executeKan({ type: 'ankan', tile, meldIndex: -1 });
      } else {
        const mi = p.melds.findIndex(m => m.type === 'triplet' && !m.isKan && m.tiles[0].key() === key);
        game.executeKan({ type: 'kakan', tile, meldIndex: mi });
      }
      selectedTile = -1;
      continueGame();
    }
  });

  b.passCall = make('btn-pass-call', '過');
  b.passCall.addEventListener('click', () => {
    game.humanCall({ type: 'pass' });
    continueGame();
  });

  b.kyuushu = make('btn-kyuushu', '九種九牌');
  b.kyuushu.addEventListener('click', () => {
    game.handleKyuushuKyuuhai(0);
    renderGame();
    showRoundResult();
  });

  b.riichi = make('btn-riichi', '立直', 'primary');
  b.riichi.addEventListener('click', () => {
    const rc = b.riichi._candidates;
    if (rc && rc.length === 1) {
      game.humanRiichi(rc[0]);
      selectedTile = -1;
      continueGame();
    } else if (rc && rc.length > 1) {
      showRiichiModal(rc);
    }
  });

  b.discard = make('btn-discard', '切る');
  b.discard.addEventListener('click', () => {
    if (selectedTile >= 0) {
      game.humanDiscard(selectedTile);
      selectedTile = -1;
      continueGame();
    }
  });

  b.tsumo = make('btn-tsumo', 'ツモ', 'danger');
  b.tsumo.addEventListener('click', () => {
    const p = game.players[0];
    game.executeWin(0, 'tsumo', p.lastDraw);
    renderGame();
    showRoundResult();
  });

  b.passDraw = make('btn-pass-draw', 'スルー');
  b.passDraw.addEventListener('click', () => {
    if (game.players[0].ippatsuRound >= 0) {
      game.players[0].ippatsuRound = -1;
    }
    game.availableActions = [];
    game.phase = 'discard';
    continueGame();
  });

  ctrl._buttons = b;
}

function renderControls() {
  const ctrl = document.getElementById('controls');
  const b = ctrl._buttons;
  if (!b) return;

  for (const key of Object.keys(b)) b[key].hidden = true;

  if (game.phase === 'call_pending') {
    for (const a of game.availableActions || []) {
      if (a.type === 'ron') {
        b.ron._action = a;
        b.ron.className = 'danger';
        b.ron.textContent = game.wouldTriggerSanchaRon(0) ? 'ロン(流局)' : 'ロン';
        b.ron.disabled = false;
        b.ron.hidden = false;
      } else if (a.type === 'ron-no-yaku') {
        b.ron.className = 'disabled';
        b.ron.textContent = 'ロン(無役)';
        b.ron.disabled = true;
        b.ron.hidden = false;
      } else if (a.type === 'ron-furiten') {
        b.ron.className = 'disabled';
        b.ron.textContent = 'ロン(振聽)';
        b.ron.disabled = true;
        b.ron.hidden = false;
      } else if (a.type === 'pon') {
        b.pon._action = a;
        b.pon.hidden = false;
      } else if (a.type === 'chi') {
        b.chi._action = a;
        b.chi._chiSets = a.chiSets || [];
        b.chi.hidden = false;
      } else if (a.type === 'kan') {
        b.kan._action = a;
        b.kan._mode = 'call';
        b.kan.textContent = game.wouldTriggerSuukantsuAbort(a.playerIdx) ? 'カン(流局)' : 'カン';
        b.kan.hidden = false;
      } else if (a.type === 'pass') {
        b.passCall.hidden = false;
      }
    }
  } else if (game.phase === 'dealer_first_discard' && game.currentPlayer === 0) {
    const p = game.players[0];
    if (game.availableActions.includes('kyuushu')) {
      b.kyuushu.hidden = false;
    }
    if (game.availableActions.includes('discard') && selectedTile >= 0) {
      const counts = getCounts(p.hand);
      const tile = p.hand[selectedTile];
      const key = tile.key();
      if (!p.isRiichi && p.lastDraw) {
        let canAnkan = (counts[key] || 0) >= 4;
        let canKakan = p.melds.some(m => m.type === 'triplet' && !m.isKan && m.tiles[0].key() === key);
        if (canAnkan || canKakan) {
          b.kan._mode = 'hand';
          b.kan.textContent = game.wouldTriggerSuukantsuAbort(0) ? 'カン(流局)' : 'カン';
          b.kan.hidden = false;
        }
      }
      b.discard.textContent = game.wouldTriggerSuufonRendai(tile) ? '切る(流局)' : '切る';
      b.discard.hidden = false;
    }
  } else if (game.phase === 'discard' && game.currentPlayer === 0) {
    const p = game.players[0];
    if (game.availableActions.includes('kyuushu')) {
      b.kyuushu.hidden = false;
    }
    if (p.isRiichi) {
      b.riichi.className = 'primary';
      b.riichi.textContent = '立直中';
      b.riichi.disabled = true;
      b.riichi.hidden = false;
    } else if (p.melds.length === 0 && game.wall.getRemainingCount() >= 4) {
      const rc = [];
      const seen = new Set();
      for (let i = 0; i < p.hand.length; i++) {
        const k = p.hand[i].key();
        if (seen.has(k)) continue;
        if (checkTenpai(p.hand.filter((_, j) => j !== i), p.melds)) {
          rc.push(i);
          seen.add(k);
        }
      }
      if (rc.length > 0) {
        b.riichi._candidates = rc;
        b.riichi.className = 'primary';
        const dblRiichi = !game.firstRoundCallsMade && game.turnCount < 4;
        b.riichi.textContent = game.wouldTriggerSuuchaRiichi(0) ? '立直(流局)' : (dblRiichi ? 'ダブル立直' : '立直');
        b.riichi.disabled = false;
        b.riichi.hidden = false;
      }
    }

    if (game.availableActions.includes('discard') && selectedTile >= 0) {
      const counts = getCounts(p.hand);
      const key = p.hand[selectedTile].key();
      const tile = p.hand[selectedTile];

      if (!p.isRiichi && p.lastDraw) {
        let canAnkan = (counts[key] || 0) >= 4;
        let canKakan = p.melds.some(m => m.type === 'triplet' && !m.isKan && m.tiles[0].key() === key);
        if (canAnkan || canKakan) {
          b.kan._mode = 'hand';
          b.kan.textContent = game.wouldTriggerSuukantsuAbort(0) ? 'カン(流局)' : 'カン';
          b.kan.hidden = false;
        }
      }

      b.discard.textContent = game.wouldTriggerSuufonRendai(tile) ? '切る(流局)' : '切る';
      b.discard.hidden = false;
    }
  } else if (game.availableActions) {
    for (const a of game.availableActions) {
      if (a === 'tsumo') {
        b.tsumo.className = 'danger';
        b.tsumo.textContent = 'ツモ';
        b.tsumo.disabled = false;
        b.tsumo.hidden = false;
      } else if (a === 'tsumo-no-yaku') {
        b.tsumo.className = 'disabled';
        b.tsumo.textContent = 'ツモ(無役)';
        b.tsumo.disabled = true;
        b.tsumo.hidden = false;
      } else if (a === 'pass') {
        b.passDraw.hidden = false;
      }
    }
  }
}

// ===== Auto-Play =====

function processAutoPlay() {
  // A. Discard phase
  if (game.phase === 'dealer_first_discard' || game.phase === 'discard') {
    if (game.players[game.currentPlayer].isHuman) {
      if (game.availableActions.includes('kyuushu')) {
        const p = game.players[0];
        if (p.ai.decideKyuushu(game, 0)) {
          game.handleKyuushuKyuuhai(0);
          renderGame();
          showRoundResult();
          return;
        }
        // Player passes on kyuushu, remove from available actions
        game.availableActions = game.availableActions.filter(a => a !== 'kyuushu');
      }
      if (!game.availableActions.includes('discard')) return;
      if (game.handleAIKan(0)) return;
      const p = game.players[0];
      if (!p.isRiichi && p.melds.length === 0) {
        if (p.ai.decideRiichi(game, 0)) {
          for (let i = 0; i < p.hand.length; i++) {
            const testHand = p.hand.filter((_, j) => j !== i);
            if (checkTenpai(testHand, p.melds)) {
              selectedTile = -1;
              game.humanRiichi(i);
              return;
            }
          }
        }
      }
      const idx = p.ai.chooseDiscard(game, 0);
      selectedTile = -1;
      game.humanDiscard(idx);
      return;
    }
  }

  // B. Call pending
  if (game.phase === 'call_pending') {
    const humanCalls = game.availableCalls.filter(c => c.playerIdx === 0);
    if (humanCalls.length === 0) {
      const passAction = game.availableActions.find(a => a.type === 'pass');
      if (passAction) game.humanCall(passAction);
      return;
    }

    const p = game.players[0];
    const chosenCall = p.ai.decideCall(game, humanCalls);
    if (chosenCall) {
      game.humanCall(chosenCall);
    } else {
      const passAction = game.availableActions.find(a => a.type === 'pass');
      if (passAction) game.humanCall(passAction);
    }
    return;
  }

  // C. Tsumo / pass
  if (game.availableActions) {
    if (game.availableActions.includes('tsumo')) {
      game.executeWin(0, 'tsumo', game.players[0].lastDraw);
      return;
    }
    if (game.availableActions.includes('tsumo-no-yaku') || game.availableActions.includes('pass')) {
      game.availableActions = [];
      game.phase = 'discard';
      return;
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
  if (!(game.phase === 'dealer_first_discard' || game.phase === 'discard')) return;
  if (game.currentPlayer !== 0) return;

  if (selectedTile === idx) {
    selectedTile = -1;
  } else {
    selectedTile = idx;
  }
  renderGame();
}

// ===== Round Result =====

function getRankLabel(totalHan, fu, isYakuman, yaku) {
  if (isYakuman) {
    const count = yaku.filter(y => y.isYakuman).length;
    if (count >= 2) return count + '倍役満';
    return '役満';
  }
  if (totalHan >= 13) return '数え役満';
  if (totalHan >= 11) return '三倍満';
  if (totalHan >= 8) return '倍満';
  if (totalHan >= 6) return '跳満';
  if (totalHan >= 5 || (totalHan === 4 && fu >= 40) || (totalHan === 3 && fu >= 70)) return '満貫';
  return null;
}

function showRoundResult() {
  renderOpponent('opponent-right', 1, true);
  renderOpponent('opponent-top', 2, true);
  renderOpponent('opponent-left', 3, true);
  renderPlayerArea(true);

  const overlay = document.getElementById('round-result');
  const content = overlay.querySelector('#round-result-content');
  const r = game.roundResult;
  const wouldEnd = !r.isRenchan && game.roundNumber + 1 >= game.maxRounds;

  let html;

  if (r.winType === 'suufon_rendai') {
    html = buildAbortiveResult('四風連打 流局', '四家第一打皆為同一風牌', r);
  } else if (r.winType === 'suucha_riichi') {
    html = buildAbortiveResult('四家立直 流局', '四家皆立直<br>各立直棒歸還', r);
  } else if (r.winType === 'sancha_ron') {
    html = buildAbortiveResult('三家和 流局', '同一張牌被三家榮和', r);
  } else if (r.winType === 'suukantsu_abort') {
    html = buildAbortiveResult('四槓散了 流局', '第四個槓成立', r);
  } else if (r.winType === 'kyuushu_kyuuhai') {
    const declarer = game.players[r.declarer].name;
    html = buildAbortiveResult('九種九牌 流局', declarer + ' 宣告九種九牌', r);
  } else if (r.winType === 'exhaustive') {
    html = buildExhaustiveResult(r, wouldEnd);
  } else {
    html = buildWinResult(r, wouldEnd);
  }

  content.innerHTML = html;
  overlay.style.display = 'flex';

  document.getElementById('next-round-btn').addEventListener('click', () => {
    overlay.style.display = 'none';

    if (wouldEnd || game.checkGameOver()) {
      showFinalResult();
    } else {
      game.endRound();
      selectedTile = -1;
      continueGame();
    }
  });
}

function buildAbortiveResult(title, desc, r) {
  return `
    <h3>${title}</h3>
    <div class="detail">${desc}</div>
    <div class="section">
      <div class="section-title">次局</div>
      <div class="detail">連莊（本場${r.honba + 1}） → ${r.nextRoundLabel}</div>
    </div>
    <button id="next-round-btn">次局へ</button>
  `;
}

function buildPaymentEntry(name, absAmount, type, detailText, suffix) {
  if (type === 'zero') {
    return `
      <div class="payment-row zero">
        <div class="payment-row-main">
          <span class="payment-player">${name}</span>
          <span class="payment-amount zero">±0</span>
        </div>
      </div>
    `;
  }
  const signChar = type === 'positive' ? '+' : '-';
  const suffixHtml = suffix ? ' <span class="payment-suffix">' + suffix + '</span>' : '';
  const detailHtml = detailText ? '<div class="payment-detail">' + detailText + '</div>' : '';
  return `
    <div class="payment-row ${type}">
      <div class="payment-row-main">
        <span class="payment-player">${name}${suffixHtml}</span>
        <span class="payment-amount ${type}">${signChar}${absAmount.toLocaleString()}</span>
      </div>
      ${detailHtml}
    </div>
  `;
}

function buildExhaustiveResult(r, wouldEnd) {
  const tenpaiStr = r.tenpaiPlayers.length > 0 ? r.tenpaiPlayers.map(i => game.players[i].name).join('、') : '無';
  const notenStr = r.notenPlayers.length > 0 ? r.notenPlayers.map(i => game.players[i].name).join('、') : '無';

  let html = '<h3>流局</h3>';

  html += '<div class="section"><div class="section-title">聽牌狀態</div>';
  html += '<div class="detail">聽牌：' + tenpaiStr + '</div>';
  html += '<div class="detail">不聽：' + notenStr + '</div>';
  html += '</div>';

  if (r.tenpaiPlayers.length > 0 && r.notenPlayers.length > 0) {
    html += '<div class="section"><div class="section-title">支払い明細</div><div class="payment-entries">';
    const paymentPerNoten = 3000 / r.notenPlayers.length;
    for (let i = 0; i < r.tenpaiPlayers.length; i++) {
      const ti = r.tenpaiPlayers[i];
      const name = (ti === game.dealerIndex ? '🏠 ' : '') + game.players[ti].name;
      html += buildPaymentEntry(name, r.notenPayment, 'positive', '罰符受取');
    }
    for (let i = 0; i < r.notenPlayers.length; i++) {
      const ni = r.notenPlayers[i];
      const name = (ni === game.dealerIndex ? '🏠 ' : '') + game.players[ni].name;
      html += buildPaymentEntry(name, paymentPerNoten, 'negative', '罰符支払い');
    }
    html += '</div></div>';
  }

  html += '<div class="section"><div class="section-title">次局</div>';
  if (r.riichiSticks > 0) {
    html += '<div class="detail">立直棒 ' + r.riichiSticks + ' 本（保留至次局）</div>';
  }
  if (r.honba > 0) {
    html += '<div class="detail">本場 ' + r.honba + '</div>';
  }
  const renchanStr = r.isRenchan ? '連莊（親家聽牌）' : '輪莊（親家不聽）';
  html += '<div class="detail">' + renchanStr + ' → ' + (wouldEnd ? '遊戲結束' : r.nextRoundLabel) + '</div>';
  html += '</div>';

  html += '<button id="next-round-btn">' + (wouldEnd ? '結果を見る' : '次局へ') + '</button>';
  return html;
}

function buildWinResult(r, wouldEnd) {
  const winner = game.players[r.winner];
  const dealerIdx = game.dealerIndex;
  const isDealerWinner = r.winner === dealerIdx;
  const dealerLabel = isDealerWinner ? '🏠 ' : '';

  let badgeHtml = '';
  if (r.isYakuman) {
    let count = 0;
    for (let i = 0; i < r.yaku.length; i++) {
      if (r.yaku[i].isYakuman) count++;
    }
    badgeHtml = '<span class="yaku-badge yakuman">' + (count >= 2 ? count + '倍役満' : '役満') + '</span>';
  }

  let html = '<div class="result-header"><h3>' + dealerLabel + winner.name + ' ' + (r.winType === 'tsumo' ? 'ツモ' : 'ロン') + '！</h3>' + badgeHtml + '</div>';

  const rankLabel = getRankLabel(r.totalHan, r.fu, r.isYakuman, r.yaku);
  let yakuItems = '';
  const sortedYaku = [...r.yaku].sort((a, b) => b.han - a.han);
  for (let i = 0; i < sortedYaku.length; i++) {
    yakuItems += '<span class="yaku-item">' + sortedYaku[i].name + '</span>';
  }
  if (r.doraHan > 0) yakuItems += '<span class="yaku-item">ドラ×' + r.doraHan + '</span>';
  if (r.uraDoraHan > 0) yakuItems += '<span class="yaku-item">裏ドラ×' + r.uraDoraHan + '</span>';

  html += '<div class="section"><div class="section-title">役種</div><div class="yaku-grid">' + yakuItems + '</div>';
  if (r.totalHan > 0) html += '<div class="yaku-total-line">合計 ' + (rankLabel || (r.totalHan + '飜 ' + r.fu + '符')) + '</div>';
  html += '</div>';

  const honbaBonus = r.honba * 300;
  const riichiBonus = r.riichiSticks * 1000;

  if (r.payments.type === 'tsumo') {
    const basePoints = r.payments.total;
    const totalPoints = basePoints + honbaBonus + riichiBonus;

    html += '<div class="section score-section">';
    html += '<div class="score-big">' + totalPoints.toLocaleString() + '点</div>';
    if (rankLabel) html += '<div class="rank-label">' + rankLabel + '</div>';
    html += '</div>';

    html += '<div class="section"><div class="section-title">支払い明細</div><div class="payment-entries">';

    const winnerDetails = ['基礎+' + basePoints.toLocaleString()];
    if (honbaBonus > 0) winnerDetails.push('本場+' + honbaBonus);
    if (riichiBonus > 0) winnerDetails.push('立直+' + riichiBonus);
    html += buildPaymentEntry(dealerLabel + winner.name, totalPoints, 'positive', winnerDetails.join(' '), '和了');

    for (let i = 0; i < 4; i++) {
      if (i === r.winner) continue;
      const basePayment = i === dealerIdx ? r.payments.dealerPayment : r.payments.childPayment;
      const honbaPayment = r.honba * 100;
      const totalPayment = basePayment + honbaPayment;
      const name = (i === dealerIdx ? '🏠 ' : '') + game.players[i].name;
      const details = ['基礎-' + basePayment.toLocaleString()];
      if (honbaPayment > 0) details.push('本場-' + honbaPayment);
      html += buildPaymentEntry(name, totalPayment, 'negative', details.join(' '));
    }

    html += '</div></div>';
  } else {
    const basePoints = r.payments.discarderPayment;
    const totalPoints = basePoints + honbaBonus + riichiBonus;

    html += '<div class="section score-section">';
    html += '<div class="score-big">' + totalPoints.toLocaleString() + '点</div>';
    if (rankLabel) html += '<div class="rank-label">' + rankLabel + '</div>';
    html += '</div>';

    html += '<div class="section"><div class="section-title">支払い明細</div><div class="payment-entries">';

    const winnerDetails = ['基礎+' + basePoints.toLocaleString()];
    if (honbaBonus > 0) winnerDetails.push('本場+' + honbaBonus);
    if (riichiBonus > 0) winnerDetails.push('立直+' + riichiBonus);
    html += buildPaymentEntry(dealerLabel + winner.name, totalPoints, 'positive', winnerDetails.join(' '), '和了');

    const discPlayer = game.players[game.lastDiscardPlayer];
    const discName = (game.lastDiscardPlayer === dealerIdx ? '🏠 ' : '') + discPlayer.name;
    const discTotal = basePoints + honbaBonus;
    const discDetails = ['基礎-' + basePoints.toLocaleString()];
    if (honbaBonus > 0) discDetails.push('本場-' + honbaBonus);
    html += buildPaymentEntry(discName, discTotal, 'negative', discDetails.join(' '), '放槍');

    // 不列出 ±0 的玩家

    html += '</div></div>';
  }

  html += '<div class="result-footer">';
  const extraParts = [];
  if (r.honba > 0) extraParts.push('本場' + r.honba);
  if (r.riichiSticks > 0) extraParts.push('立直棒' + r.riichiSticks + '本');
  if (extraParts.length > 0) {
    html += '<div class="detail">' + extraParts.join(' ') + '</div>';
  }
  const renchanStr = r.isRenchan ? '連莊' : '輪莊';
  html += '<div class="detail">' + renchanStr + ' → ' + (wouldEnd ? '遊戲結束' : r.nextRoundLabel) + '</div>';
  html += '</div>';

  html += '<button id="next-round-btn">' + (wouldEnd ? '結果を見る' : '次局へ') + '</button>';
  return html;
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

  const statsArea = document.getElementById('stats-area');
  let html = '<table class="result-stats-table"><thead><tr><th>順位</th><th>名前</th><th>点数</th><th>ツモ</th><th>ロン</th><th>放銃</th></tr></thead><tbody>';
  for (const s of scores) {
    const cls = s.rank === 1 ? ' class="rank-first"' : '';
    html += `<tr${cls}><td>${s.rank}位</td><td>${s.name}</td><td>${s.score}</td><td>${s.tsumo}</td><td>${s.ron}</td><td>${s.dealtIn}</td></tr>`;
  }
  html += '</tbody></table>';
  html += `<div class="result-summary">總局數 ${game.roundCount} ／ 流局 ${game.ryuukyokuCount}</div>`;
  statsArea.innerHTML = html;

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

  const lastEntry = game.log[game.log.length - 1];
  if (lastEntry && el._lastLogId === lastEntry.id) return;
  el._lastLogId = lastEntry ? lastEntry.id : -1;

  // Simplified robust sync: If the first log entry doesn't match the DOM, re-render.
  const currentFirstEntryId = game.log.length > 0 ? String(game.log[0].id) : null;
  const domFirstEntry = el.firstChild ? el.firstChild.getAttribute('data-id') : null;

  if (game.log.length === 0) {
    el.innerHTML = '';
  } else if (domFirstEntry !== currentFirstEntryId) {
    el.innerHTML = '';
    for (const e of game.log) {
      const div = document.createElement('div');
      div.className = 'log-entry';
      div.setAttribute('data-id', String(e.id));
      div.innerHTML = `<span class="log-turn">${e.group}.</span> <span class="log-player">${e.player}</span> ${e.action}${e.detail ? ' ' + e.detail : ''}`;
      el.appendChild(div);
    }
  } else {
    // Append only new entries
    const existingEntries = Array.from(el.children).map(c => c.getAttribute('data-id'));
    for (const e of game.log) {
      const entryId = String(e.id);
      if (!existingEntries.includes(entryId)) {
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.setAttribute('data-id', entryId);
        div.innerHTML = `<span class="log-turn">${e.group}.</span> <span class="log-player">${e.player}</span> ${e.action}${e.detail ? ' ' + e.detail : ''}`;
        el.appendChild(div);
      }
    }
  }

  // Cleanup
  while (el.children.length > 256) {
    el.removeChild(el.firstChild);
  }
  
  if (el.scrollHeight > el.clientHeight) {
    el.scrollTop = el.scrollHeight;
  }
}

// ===== Bootstrap =====

document.addEventListener('DOMContentLoaded', init);
