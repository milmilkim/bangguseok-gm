// 도트 스프라이트. 글자 하나가 픽셀 하나이고 '.' 은 투명, 'k' 는 외곽선이다.
// half 로 적은 것은 왼쪽 절반만 그린 것으로, 좌우 대칭으로 펼친다.

type Def = {rows: string; pal: Record<string, string>; half?: boolean};

const K = '#0b0d14';

const heroBody = `
................
.....kkkkk......
....khhhhhk.....
`;

const DEFS: Record<string, Def> = {
  tank: {
    pal: {k: K, h: '#a9b4c6', s: '#f0c9a0', e: '#1b2030', a: '#3d5a80', b: '#d5dde8', c: '#4f83cc', m: '#8a8f9c', w: '#8b5a2b'},
    rows: `${heroBody}
....khhhhhhk....
....khssesk.....
....kssssskbbk..
.....kkkkkkbccbk
....kaaaakbcccbk
.mmkaaaaakbcccbk
kmmmkaaaakbcccbk
.mwkaaaaaakbcbk.
..wkkaaaak.kbk..
..w.kakkak..k...
....kak.kak.....
...kkak.kakk....
...kkkk.kkkk....`,
  },
  blade: {
    pal: {k: K, h: '#8a4a34', s: '#f0c9a0', e: '#1b2030', a: '#2e6b66', w: '#eef3f8', g: '#d9a441', y: '#6b4a2b'},
    rows: `${heroBody}
....khhhhhhk.k..
....khssesk.kwk.
....ksssssk.kwk.
.....kkkkk..kwk.
....kaaaak..kwk.
...kaaaaaak.kwk.
...kaaaaaaskgwgk
...kaaaaaak.kyk.
....kaaaak...k..
....kakkak......
....kak.kak.....
...kkak.kakk....
...kkkk.kkkk....`,
  },
  caster: {
    pal: {k: K, p: '#6a48a8', h: '#d8d2c4', s: '#f0c9a0', e: '#1b2030', r: '#4a3478', o: '#7fe0ff', w: '#8b5a2b'},
    rows: `
......kkk.......
.....kpppk......
....kpppppk...k.
..kkkkkkkkkk.kok
....khssesk..kwk
....ksssssk..kwk
.....kkkkk...kwk
....krrrrk...kwk
...krrrrrrk..kwk
...krrrrrrrskkwk
...krrrrrrk..kwk
...krrrrrrk..kwk
..krrrrrrrrk.kwk
..krrrrrrrrk.kwk
..kkrrrrrrkk.kwk
...kkkkkkkk..kkk`,
  },
  rat: {
    pal: {k: K, g: '#7b7485', p: '#e5989b', w: '#f2b5b5', e: '#ff4d4d', t: '#b5838d'},
    rows: `
....kk..........
...kppkkkkkk....
..kgggggggggk...
.kgeggggggggggk.
kwggggggggggggkt
.kkggggggggggk.t
...kgkkkkkgkk..t
...kk....kk..tt.`,
  },
  beast: {
    pal: {k: K, f: '#56627a', e: '#ffd166', w: '#e2e8f0'},
    rows: `
.kk.............
kffk....kkkkkk..
kfffkkkkffffffk.
kefffffffffffffk
kffffffffffffffk
.kwwfffffffffffk
..kkfffffffffffk
....kffkkkkkffk.
....kfk....kfk..
....kfk....kfk..
...kkfk...kkfk..
...kkkk...kkkk..`,
  },
  slime: {
    half: true,
    pal: {k: K, g: '#4fb477', w: '#b8f2c9', m: '#1f5a3a'},
    rows: `
......kk
....kkgg
...kgggg
..kggwgg
.kggwggg
.kgggggg
kgggkkgg
kgggkkgg
kggggggg
kgggggmm
.kgggggg
..kkkkkk`,
  },
  ghost: {
    half: true,
    pal: {k: K, w: '#dfe7f5', s: '#9fb0cf'},
    rows: `
.....kkk
...kkwww
..kwwwww
.kwwwwww
.kwwkkww
.kwwkkww
kwwwwwww
kwwwwwkk
kwwwwwkk
kwwwwwww
kwwwwwww
kwwswwsw
kwkwwkww
kk.kk.kk`,
  },
  eye: {
    half: true,
    pal: {k: K, r: '#a33a52', w: '#f3ece0', b: '#3fa7a0', p: '#0b0d14', t: '#a33a52'},
    rows: `
.....kkk
...kkrrr
..krrrrr
.krrwwww
.krwwwww
krrwwwbb
krrwwbbp
krrwwbbp
krrwwwbb
.krwwwww
.krrwwww
..krrrrr
.t.kkrrr
t..t.kkk`,
  },
  golem: {
    half: true,
    pal: {k: K, s: '#8d8676', d: '#5f5a4e', o: '#ffb347'},
    rows: `
....kkkk
...kssss
...ksoss
...kssss
...kkkkk
.kkkssss
kssksdss
kssksssd
kssksdss
kssksssd
kkkkssss
..kkssss
..kssk..
..kssk..
..kssk..
..kkkk..`,
  },
  spider: {
    half: true,
    pal: {k: K, b: '#3b2f4a', r: '#ff4d4d'},
    rows: `
.k......
k.k.....
...k.kkk
.kk.kbbb
k..kbbbb
.kkkbrbb
k..kbbbb
.kkkbbbb
k...kbbb
.k...kkk
..k.....`,
  },
};

// 무기 없는 사람: 검사에서 칼이 있는 오른쪽 다섯 열을 지운다. NPC 프로필에 쓴다.
DEFS.plain = {
  pal: DEFS.blade.pal,
  rows: grid(DEFS.blade)
    .map((row, y) => (y === 9 ? row.slice(0, 10) + 'k' : row.slice(0, 11)).padEnd(16, '.'))
    .join('\n'),
};
// 적으로 나오는 사람은 검사 스프라이트를 뒤집어 색만 바꿔 쓴다
DEFS.human = {...DEFS.blade, pal: {...DEFS.blade.pal, h: '#3a3d4a', a: '#6b2737', s: '#caa98a'}};

/** GM이 직접 그린 도트. rows 의 글자를 pal 의 색으로 칠한다. half 면 왼쪽 절반만 적은 것. 왼쪽을 보게 그린다. */
export type Art = {rows: string[]; pal: Record<string, string>; half?: boolean};

/** 사람 외형. style 은 blade | tank | caster | plain, cut 은 short | bob | long | tail | bald, 색은 #rrggbb. */
export type Look = {style?: string; hair?: string; skin?: string; outfit?: string; cut?: string; skirt?: boolean};

// 행 번호 → [시작 열, 덮어쓸 글자]. 캐릭터는 오른쪽을 보므로 뒤통수는 3~4열이다.
type Patch = Record<number, [number, string]>;
const CUTS: Record<string, Patch> = {
  bob: {4: [3, 'kh'], 5: [3, 'kh'], 6: [3, 'kh']},
  long: {4: [3, 'kh'], 5: [3, 'kh'], 6: [3, 'kh'], 7: [3, 'kh'], 8: [3, 'kh']},
  tail: {2: [3, 'k'], 3: [2, 'kh'], 4: [2, 'kh'], 5: [1, 'khk'], 6: [1, 'khk'], 7: [1, 'kk']},
};
const SKIRT: Patch = {11: [3, 'kaaaaaak'], 12: [2, 'kaaaaaaaak'], 13: [2, 'kkkkkkkkkk'], 14: [2, '..ksk.ksk.'], 15: [2, '..kkk.kkk.']};

const overlay = (rows: string[], patch: Patch) =>
  rows.map((row, y) => (patch[y] ? row.slice(0, patch[y][0]) + patch[y][1] + row.slice(patch[y][0] + patch[y][1].length) : row));

export const HAIR = ['#2b2523', '#5b3a29', '#8a4a34', '#c8963e', '#e8dcc0', '#d8d2c4', '#b33a3a', '#3f6fb5', '#7a4fa3', '#e59ab5'];
export const SKIN = ['#fbe0c8', '#f0c9a0', '#d9a577', '#a8734a', '#6e4a31'];
export const OUTFIT = ['#2e6b66', '#3d5a80', '#6b2737', '#4a3478', '#8a6d1f', '#3c4048', '#e6e2d6', '#8f2d56'];

/** 외형을 정하지 않은 인물은 이름으로 색과 머리 모양을 골라, 같은 이름이면 늘 같은 모습이 되게 한다. */
export function autoLook(name: string): Look {
  const h = hash(name);
  // 성별도 나이도 모르므로 누구에게나 어색하지 않게 짧은 머리, 자연스러운 머리색, 바지로만 고른다
  return {style: 'plain', hair: HAIR[h % 3], skin: SKIN[(h >>> 4) % 3], outfit: OUTFIT[(h >>> 8) % 6], cut: 'short'};
}

const shade = (hex: string, k: number) =>
  '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

function dressed(look: Look): Def {
  const base = DEFS[look.style ?? ''] ?? DEFS.plain;
  const pal = {...base.pal};
  if (look.hair) pal.h = look.hair;
  if (look.skin) pal.s = look.skin;
  if (look.cut === 'bald') pal.h = pal.s;
  if (look.outfit) {
    pal.a = look.outfit;
    pal.p = look.outfit;
    pal.r = shade(look.outfit, 0.72);
  }
  let rows = grid(base);
  if (CUTS[look.cut ?? '']) rows = overlay(rows, CUTS[look.cut!]);
  // 술사는 원래 발끝까지 오는 로브라 치마를 따로 그리지 않는다
  if (look.skirt && base !== DEFS.caster) rows = overlay(rows, SKIRT);
  return {pal, rows: rows.join('\n')};
}
const FACES_RIGHT = new Set(['tank', 'blade', 'caster', 'plain', 'human']);

export type Sprite = {img: HTMLCanvasElement; white: HTMLCanvasElement; w: number; h: number};

function grid(def: Def): string[] {
  const rows = def.rows.split('\n').filter(r => r.length > 0);
  const full = def.half ? rows.map(r => r + [...r].reverse().join('')) : rows;
  const w = Math.max(...full.map(r => r.length));
  return full.map(r => r.padEnd(w, '.'));
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// 스프라이트를 정하지 않은 적은 이름을 씨앗으로 대칭 무늬를 만들어, 같은 이름이면 늘 같은 모습이 되게 한다
function procedural(seed: string): Def {
  let s = hash(seed);
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  const H = 11;
  const W = 6;
  const cells = Array.from({length: H}, (_, y) =>
    Array.from({length: W}, (_, x) => rnd() < 0.34 + 0.09 * x - 0.02 * Math.abs(y - 5)),
  );
  cells[3][W - 2] = true;
  const at = (x: number, y: number) => (y >= 0 && y < H && x >= 0 ? cells[y][Math.min(x, 2 * W - 1 - x)] ?? false : false);
  const rows = Array.from({length: H + 2}, (_, gy) =>
    Array.from({length: W + 1}, (_, gx) => {
      const x = gx - 1;
      const y = gy - 1;
      if (at(x, y)) return y === 3 && x === W - 2 ? 'e' : rnd() < 0.2 ? 'd' : 'f';
      return at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? 'k' : '.';
    }).join(''),
  ).join('\n');
  const hue = hash(seed + '#') % 360;
  return {half: true, rows, pal: {k: K, f: `hsl(${hue} 45% 52%)`, d: `hsl(${hue} 45% 36%)`, e: '#ffe9a8'}};
}

function paint(rows: string[], color: (ch: string) => string | undefined, flip: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = ch === '.' ? undefined : color(ch);
      if (!fill) return;
      ctx.fillStyle = fill;
      ctx.fillRect(flip ? row.length - 1 - x : x, y, 1, 1);
    }),
  );
  return canvas;
}

const cache = new Map<string, Sprite>();

/** facing: 화면에서 바라볼 방향. 아군은 오른쪽, 적은 왼쪽을 본다. look 을 주면 유저 캐릭터로 그린다. */
export function sprite(name: string | undefined, seed: string, facing: 'left' | 'right', look?: Look, art?: Art): Sprite {
  const drawn = art && Array.isArray(art.rows) && art.rows.length > 0 && art.rows.every(r => typeof r === 'string') ? art : undefined;
  if (look) name = DEFS[look.style ?? ''] ? look.style : 'plain';
  const known = !drawn && name && DEFS[name] ? name : undefined;
  const key = `${known ?? '?' + seed}:${facing}:${look ? JSON.stringify(look) : ''}:${drawn ? JSON.stringify(drawn) : ''}`;
  let hit = cache.get(key);
  if (!hit) {
    const def: Def = drawn
      ? {rows: drawn.rows.join('\n'), pal: {k: K, ...drawn.pal}, half: drawn.half}
      : look
        ? dressed(look)
        : known
          ? DEFS[known]
          : procedural(seed);
    const rows = grid(def);
    const flip = drawn ? facing === 'right' : known ? FACES_RIGHT.has(known) !== (facing === 'right') : false;
    hit = {
      img: paint(rows, ch => def.pal[ch], flip),
      white: paint(rows, () => '#ffffff', flip),
      w: rows[0].length,
      h: rows.length,
    };
    cache.set(key, hit);
  }
  return hit;
}

const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '-': ['000', '000', '111', '000', '000'],
  '+': ['000', '010', '111', '010', '000'],
};

export function drawNumber(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string) {
  let x = Math.round(cx - (text.length * 4 - 1) / 2);
  for (const ch of text) {
    const glyph = DIGITS[ch];
    if (glyph) {
      for (const [dx, dy, fill] of [[1, 1, K], [0, 0, color]] as const) {
        ctx.fillStyle = fill;
        glyph.forEach((row, gy) => [...row].forEach((bit, gx) => bit === '1' && ctx.fillRect(x + gx + dx, y + gy + dy, 1, 1)));
      }
    }
    x += 4;
  }
}
