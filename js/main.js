// ===== State Management =====

const SCREEN = { TITLE:0, GAME:1, RESULT:2 };

let currentScreen = SCREEN.TITLE;
let game = null;
let selectedTile = -1;
let setup = {
  length: 'east',
  difficulties: ['normal','normal','normal'],
};

// ===== Initialization =====

function init() {
  renderTitleScreen();
  bindTitleEvents();
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
  if (game.gameOver) { showFinalResult(); return; }
  if (game.roundOver) { setTimeout(() => showRoundResult(), 300); return; }

  renderGame();
  const needHuman = game.advance();
  renderGame();

  if (game.roundOver) {
    setTimeout(() => showRoundResult(), 300);
    return;
  }

  if (!needHuman) {
    setTimeout(continueGame, 500);
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
  ci.querySelector('.round-label').textContent = `${game.roundLabel} ${game.roundWindName}風`;

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
}

function renderPlayerArea() {
  const p = game.players[0];

  document.querySelector('#player-info .player-name').textContent = `${p.name} (${['東','南','西','北'][p.seatWind-1]})`;
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
  for (const d of p.discards) {
    const span = document.createElement('span');
    span.className = 'tile-char';
    span.textContent = d.char;
    discardsDiv.appendChild(span);
  }

  const handDiv = document.getElementById('player-hand');
  handDiv.innerHTML = '';

  const drawnTile = p.lastDraw;
  const drawnInHand = p.hand.findIndex(t => t.equals(drawnTile));
  const displayOrder = [];
  for (let i = 0; i < p.hand.length; i++) {
    if (i !== drawnInHand) displayOrder.push(i);
  }
  if (drawnInHand >= 0) displayOrder.push(drawnInHand);

  for (let vi = 0; vi < displayOrder.length; vi++) {
    const actualIdx = displayOrder[vi];
    const t = p.hand[actualIdx];
    const isDrawn = actualIdx === drawnInHand;

    const slot = document.createElement('div');
    slot.className = 'tile-slot';
    if (actualIdx === selectedTile) slot.classList.add('selected');

    if (isDrawn) {
      const gap = document.createElement('div');
      gap.className = 'tile-gap';
      handDiv.appendChild(gap);
      slot.classList.add('last-draw-slot');
    }

    const span = document.createElement('span');
    span.className = 'tile-char';
    span.textContent = t.char;
    slot.appendChild(span);

    const label = document.createElement('div');
    label.className = 'tile-label';
    label.textContent = t.name;
    slot.appendChild(label);

    slot.addEventListener('click', () => onTileClick(actualIdx));
    handDiv.appendChild(slot);
  }
}

function renderOpponent(areaId, playerIdx) {
  const area = document.getElementById(areaId);
  const p = game.players[playerIdx];
  if (!p) return;

  area.querySelector('.player-name').textContent = `${p.name} (${['東','南','西','北'][p.seatWind-1]})`;
  area.querySelector('.player-score').textContent = `${p.score}点`;

  const handDiv = area.querySelector('.tiles-row');
  handDiv.innerHTML = '';
  const displayTiles = p.isRiichi ? p.hand.length - 1 : p.hand.length;
  if (p.isRiichi) {
    for (let i = 0; i < displayTiles; i++) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      span.textContent = '🀥';
      handDiv.appendChild(span);
    }
  } else {
    for (const t of p.hand) {
      const span = document.createElement('span');
      span.className = 'tile-char';
      span.textContent = '🀥';
      handDiv.appendChild(span);
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
  const discards = p.discards.slice(-12);
  for (const d of discards) {
    const span = document.createElement('span');
    span.className = 'tile-char';
    span.textContent = d.char;
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
        const btn = document.createElement('button');
        btn.textContent = 'チー';
        btn.addEventListener('click', () => {
          game.humanCall(action);
          continueGame();
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
  } else if (game.phase === 'discard' || game.phase === 'dealer_first_discard') {
    const p = game.players[0];
    if (p.isRiichi) {
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = '立直中';
      btn.disabled = true;
      ctrl.appendChild(btn);
    } else if (p.melds.length === 0 && game.wall.getRemainingCount() >= 4) {
      if (checkTenpai(p.hand, p.melds)) {
        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = '立直';
        btn.addEventListener('click', () => {
          if (selectedTile >= 0) {
            game.humanRiichi(selectedTile);
            selectedTile = -1;
            continueGame();
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
          if (m.type === 'pon' && !m.isKan && m.tiles[0].key() === selectedKey) {
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

function showRoundResult() {
  const overlay = document.getElementById('round-result');
  const content = overlay.querySelector('#round-result-content');

  if (game.roundResult.winType === 'exhaustive') {
    content.innerHTML = `
      <h3>流局</h3>
      <div class="detail">聽牌：${game.roundResult.tenpaiPlayers.map(i => game.players[i].name).join('、') || '無'}</div>
      <div class="detail">不聽：${game.roundResult.notenPlayers.map(i => game.players[i].name).join('、') || '無'}</div>
      <div class="detail">本場：${game.roundResult.honba}</div>
      <button id="next-round-btn">次局へ</button>
    `;
  } else {
    const winner = game.players[game.roundResult.winner];
    const r = game.roundResult;
    let yakuStr = r.yaku.map(y => `${y.name}（${y.isYakuman ? '役滿' : y.han + '飜'}）`).join('<br>');
    if (r.totalHan > 0) yakuStr += `<br>合計 ${r.totalHan}飜 ${r.fu}符`;

    let scoreStr = '';
    if (r.payments.type === 'tsumo') {
      const isDealerWinner = game.players[game.roundResult.winner].seatWind === 1;
      const dealerIdx = game.dealerIndex;
      let details = '';
      for (let i = 0; i < 4; i++) {
        if (i === game.roundResult.winner) continue;
        const amt = i === dealerIdx ? r.payments.dealerPayment : r.payments.childPayment;
        details += `${game.players[i].name}: ${amt} `;
      }
      scoreStr = `ツモ ${r.payments.total}点 (${details})`;
    } else {
      const discPlayer = game.players[game.lastDiscardPlayer];
      scoreStr = `ロン ${game.lastDiscardPlayer >= 0 ? discPlayer.name + '→' : ''}${r.payments.discarderPayment}点`;
    }
    if (r.honba > 0) scoreStr += `（本場${r.honba}）`;

    content.innerHTML = `
      <h3>${winner.name} ${r.winType === 'tsumo' ? 'ツモ' : 'ロン'}！</h3>
      <div class="score-big">${scoreStr}</div>
      <div class="yaku-list">${yakuStr}</div>
      <div class="detail">${r.isYakuman ? '🎉 役滿！' : r.totalHan + '飜' + r.fu + '符'}</div>
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
  const el = document.getElementById('game-log');
  if (!el) return;
  const entries = game.log;
  el.innerHTML = entries.slice(-25).map(e =>
    `<div class="log-entry"><span class="log-turn">${e.turn}.</span> <span class="log-player">${e.player}</span> ${e.action}${e.detail ? ' ' + e.detail : ''}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

// ===== Bootstrap =====

document.addEventListener('DOMContentLoaded', init);
