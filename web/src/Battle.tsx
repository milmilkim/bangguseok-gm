import {useEffect, useRef} from 'react';
import {drawNumber, sprite, type Art, type Look, type Sprite} from './sprites';

export type Fighter = {name: string; sprite?: string; look?: Look; art?: Art; boss?: boolean; down?: boolean};
export type Fx = {id: number; who: string; delta: number};

const W = 240;
const H = 76;
const FLOOR = 62;
const HERO_X = 52;
const STEP = 460;

type Actor = {name: string; art: Sprite; x: number; scale: number; hero: boolean; down: boolean; downAt: number; phase: number};
type Hit = {at: number; attacker?: Actor; target: Actor; delta: number};

function backdrop(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  ['#0a0c14', '#0d101b', '#111524', '#151a2c'].forEach((fill, i) => {
    g.fillStyle = fill;
    g.fillRect(0, i * 16, W, 16);
  });
  g.fillStyle = '#1b2136';
  for (let x = 8; x < W; x += 46) g.fillRect(x, 8 + ((x * 7) % 13), 14, FLOOR - 8 - ((x * 7) % 13));
  g.fillStyle = '#0d101b';
  for (let x = 8; x < W; x += 46) g.fillRect(x + 3, 14 + ((x * 7) % 13), 3, 5);
  g.fillStyle = '#232a42';
  g.fillRect(0, FLOOR, W, H - FLOOR);
  g.fillStyle = '#2d3654';
  g.fillRect(0, FLOOR, W, 1);
  g.fillStyle = '#1a2036';
  for (let y = FLOOR + 4; y < H; y += 5) for (let x = (y * 3) % 16; x < W; x += 16) g.fillRect(x, y, 7, 1);
  return c;
}

export function BattleStage({hero, enemies, fx}: {hero: Fighter; enemies: Fighter[]; fx: Fx[]}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sim = useRef({actors: new Map<string, Actor>(), hits: [] as Hit[], seen: 0, nextAt: 0});
  const roster = [hero.name, JSON.stringify(hero.look), ...enemies.map(e => `${e.name}:${e.sprite}:${e.boss}:${e.down}:${e.art ? JSON.stringify(e.art) : ''}`)].join('|');

  useEffect(() => {
    const {actors} = sim.current;
    const now = performance.now();
    const place = (f: Fighter, isHero: boolean, x: number) => {
      const old = actors.get(f.name);
      const down = !!f.down;
      actors.set(f.name, {
        name: f.name,
        art: sprite(f.sprite, f.name, isHero ? 'right' : 'left', f.look, f.art),
        x,
        scale: f.boss ? 3 : 2,
        hero: isHero,
        down,
        // 처음부터 쓰러져 있던 적은 연출 없이 숨긴다
        downAt: down ? (old ? (old.down ? old.downAt : now + STEP) : -1e9) : 0,
        phase: old?.phase ?? Math.random() * 1000,
      });
    };
    const keep = new Set([hero.name, ...enemies.map(e => e.name)]);
    for (const name of actors.keys()) if (!keep.has(name)) actors.delete(name);
    place(hero, true, HERO_X);
    const n = enemies.length;
    enemies.forEach((e, i) => place(e, false, n === 1 ? 180 : 138 + (i * 84) / (n - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  useEffect(() => {
    const s = sim.current;
    const now = performance.now();
    for (const f of fx) {
      if (f.id <= s.seen) continue;
      s.seen = f.id;
      const target = s.actors.get(f.who);
      if (!target) continue;
      const foes = [...s.actors.values()].filter(a => a.hero !== target.hero && !a.down);
      const at = Math.max(now, s.nextAt);
      s.nextAt = at + STEP;
      s.hits.push({at, target, delta: f.delta, attacker: f.delta < 0 ? foes[0] : undefined});
    }
  }, [fx]);

  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    const bg = backdrop();
    let raf = 0;
    const frame = (now: number) => {
      const s = sim.current;
      s.hits = s.hits.filter(h => now - h.at < 1100);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bg, 0, 0);
      const actors = [...s.actors.values()].sort((a, b) => a.x - b.x);
      for (const a of actors) {
        const gone = a.down ? now - a.downAt : -1;
        if (gone > 600) continue;
        let dx = 0;
        let dy = Math.floor(((now + a.phase) / 420) % 2);
        let flash = false;
        for (const h of s.hits) {
          const t = now - h.at;
          if (t < 0) continue;
          if (h.attacker === a && t < 380) {
            const reach = (h.target.x - a.x) * 0.45;
            dx += reach * (t < 130 ? t / 130 : 1 - (t - 130) / 250);
            dy -= t < 130 ? 3 : 0;
          }
          if (h.target === a && h.delta < 0 && t >= 130 && t < 430) {
            flash = t < 230;
            dx += (a.hero ? -1 : 1) * (Math.floor(t / 40) % 2 ? 2 : -1);
          }
        }
        const w = a.art.w * a.scale;
        const hgt = a.art.h * a.scale;
        const sink = gone > 0 ? Math.floor((gone / 600) * 6) : 0;
        ctx.globalAlpha = gone > 0 ? Math.max(0, 1 - gone / 600) * (Math.floor(gone / 60) % 2 ? 0.5 : 1) : 1;
        ctx.fillStyle = '#00000055';
        ctx.fillRect(Math.round(a.x - w / 2 + 2), FLOOR + 1, w - 4, 2);
        ctx.drawImage(flash ? a.art.white : a.art.img, Math.round(a.x - w / 2 + dx), FLOOR - hgt + dy + sink + 2, w, hgt);
        ctx.globalAlpha = 1;
      }
      for (const h of s.hits) {
        const t = now - h.at - 130;
        if (t < 0 || t > 900) continue;
        const top = FLOOR - h.target.art.h * h.target.scale - 8 - Math.min(10, t / 40);
        ctx.globalAlpha = t > 650 ? 1 - (t - 650) / 250 : 1;
        drawNumber(ctx, (h.delta > 0 ? '+' : '') + h.delta, h.target.x, Math.round(top), h.delta > 0 ? '#7dffa8' : '#ff6b6b');
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="rp-stage" width={W} height={H} role="img" aria-label="전투 화면" />;
}
