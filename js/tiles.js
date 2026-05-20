const SUIT_ORDER = { man:0, pin:1, sou:2, honor:3 };

const CODE_POINT = {
  man:  [0x1F007,0x1F008,0x1F009,0x1F00A,0x1F00B,0x1F00C,0x1F00D,0x1F00E,0x1F00F],
  pin:  [0x1F010,0x1F011,0x1F012,0x1F013,0x1F014,0x1F015,0x1F016,0x1F017,0x1F018],
  sou:  [0x1F019,0x1F01A,0x1F01B,0x1F01C,0x1F01D,0x1F01E,0x1F01F,0x1F020,0x1F021],
  honor:[0x1F000,0x1F001,0x1F002,0x1F003,0x1F006,0x1F005,0x1F004],
};

const NAME_MAP = {
  man:   ['一萬','二萬','三萬','四萬','五萬','六萬','七萬','八萬','九萬'],
  pin:   ['一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒'],
  sou:   ['一索','二索','三索','四索','五索','六索','七索','八索','九索'],
  honor: ['東','南','西','北','白','發','中'],
};

class Tile {
  constructor(suit, value) {
    this.suit = suit;
    this.value = value;
  }

  get codePoint() {
    if (this.suit === 'honor') return CODE_POINT.honor[this.value - 1];
    return CODE_POINT[this.suit][this.value - 1];
  }

  get char() {
    return String.fromCodePoint(this.codePoint);
  }

  get name() {
    return NAME_MAP[this.suit][this.value - 1];
  }

  get isTerminal() {
    if (this.suit === 'honor') return true;
    return this.value === 1 || this.value === 9;
  }

  get isHonor() {
    return this.suit === 'honor';
  }

  get isSangen() {
    return this.isHonor && this.value >= 5;
  }

  get isWind() {
    return this.isHonor && this.value <= 4;
  }

  equals(other) {
    return other && this.suit === other.suit && this.value === other.value;
  }

  toString() {
    return this.suit[0] + this.value;
  }

  key() {
    return this.suit + this.value;
  }

  static fromString(str) {
    const suit = { m:'man', p:'pin', s:'sou', z:'honor' }[str[0]];
    const value = parseInt(str[1]);
    if (!suit) return null;
    if (suit === 'honor' && (value < 1 || value > 7)) return null;
    if (suit !== 'honor' && (value < 1 || value > 9)) return null;
    return new Tile(suit, value);
  }

  static allTiles() {
    const tiles = [];
    for (const suit of ['man','pin','sou']) {
      for (let v = 1; v <= 9; v++) {
        for (let c = 0; c < 4; c++) tiles.push(new Tile(suit, v));
      }
    }
    for (let v = 1; v <= 7; v++) {
      for (let c = 0; c < 4; c++) tiles.push(new Tile('honor', v));
    }
    return tiles;
  }

  static sortTiles(tiles) {
    return tiles.slice().sort((a, b) => {
      const sa = SUIT_ORDER[a.suit];
      const sb = SUIT_ORDER[b.suit];
      if (sa !== sb) return sa - sb;
      return a.value - b.value;
    });
  }

  static countMap(tiles) {
    const map = {};
    for (const t of tiles) {
      const k = t.key();
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }
}
