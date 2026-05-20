class Wall {
  constructor() {
    this.tiles = Tile.allTiles();
    this.drawIndex = 0;
    this.deadWallStart = 122;
    this.doraCount = 1;
    this.rinshanIndex = 135;
  }

  shuffle() {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  deal(players) {
    this.shuffle();
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let p = 0; p < 4; p++) {
        for (let s = 0; s < 4; s++) {
          players[p].hand.push(this.tiles[idx++]);
        }
      }
    }
    for (let p = 0; p < 4; p++) {
      players[p].hand.push(this.tiles[idx++]);
    }
    players[0].hand.push(this.tiles[idx++]);
    this.dealerExtraTile = this.tiles[idx - 1];
    this.drawIndex = idx;
    this.doraCount = 1;
    this.rinshanIndex = 135;
  }

  draw() {
    if (this.drawIndex >= this.deadWallStart) return null;
    return this.tiles[this.drawIndex++];
  }

  getRemainingCount() {
    return Math.max(0, this.deadWallStart - this.drawIndex);
  }

  isExhausted() {
    return this.drawIndex >= this.deadWallStart;
  }

  getDoraIndicators() {
    return this.tiles.slice(this.deadWallStart, this.deadWallStart + this.doraCount);
  }

  getUraDoraIndicators() {
    return this.tiles.slice(this.deadWallStart + 5, this.deadWallStart + 5 + this.doraCount);
  }

  drawRinshan() {
    if (this.rinshanIndex < this.deadWallStart + 10) return null;
    return this.tiles[this.rinshanIndex--];
  }

  addDoraIndicator() {
    if (this.doraCount < 5) this.doraCount++;
  }
}
