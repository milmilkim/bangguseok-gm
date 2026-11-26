import {useEffect, useRef} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/VStack';
import type {GameMap} from './types';

const T = 8;

const GLYPH: Record<string, string[]> = {
  '>': ['........', '.....aa.', '.....aa.', '...aaaa.', '...aaaa.', '.aaaaaa.', '.aaaaaa.', '........'],
  '+': ['........', '.aaaaaa.', '.a....a.', '.a....a.', '.a...aa.', '.a....a.', '.a....a.', '........'],
  $: ['........', '...aa...', '..aaaa..', '.aabbaa.', '.aabbaa.', '..aaaa..', '...aa...', '........'],
  '!': ['........', '...aa...', '...aa...', '...aa...', '...aa...', '........', '...aa...', '........'],
  '?': ['........', '..aaaa..', '.aa..aa.', '....aa..', '...aa...', '........', '...aa...', '........'],
  '@': ['........', '...aa...', '..aaaa..', '..aaaa..', '...aa...', '..aaaa..', '.aaaaaa.', '........'],
};
const INK: Record<string, [string, string]> = {
  '>': ['#7fe0ff', '#7fe0ff'],
  '+': ['#b07a3f', '#b07a3f'],
  $: ['#ffd166', '#fff3c4'],
  '!': ['#ff5d6c', '#ff5d6c'],
  '?': ['#b9a7ff', '#b9a7ff'],
  '@': ['#ffffff', '#ffffff'],
};

function draw(ctx: CanvasRenderingContext2D, rows: string[], blink: boolean) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ' ') return;
      const px = x * T;
      const py = y * T;
      if (ch === '#') {
        ctx.fillStyle = '#2b3350';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#3a4468';
        ctx.fillRect(px, py, T, 1);
        ctx.fillStyle = '#20263d';
        ctx.fillRect(px + ((x + y) % 2 ? 2 : 5), py + 3, 1, 2);
        return;
      }
      ctx.fillStyle = ch === '~' ? '#123a44' : '#141927';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = ch === '~' ? '#1f6b78' : '#1d2438';
      if (ch === '~') {
        ctx.fillRect(px + 1, py + 2, 3, 1);
        ctx.fillRect(px + 4, py + 5, 3, 1);
      } else ctx.fillRect(px + 3, py + 3, 1, 1);
      const glyph = GLYPH[ch];
      if (glyph && !(ch === '@' && blink)) {
        const [a, b] = INK[ch];
        glyph.forEach((g, gy) =>
          [...g].forEach((bit, gx) => {
            if (bit === '.') return;
            ctx.fillStyle = bit === 'a' ? a : b;
            ctx.fillRect(px + gx, py + gy, 1, 1);
          }),
        );
      } else if (/[A-Z]/.test(ch)) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
        ctx.fillStyle = '#141927';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, px + T / 2, py + T / 2 + 0.5);
      }
    }),
  );
}

const KEY: [string, string][] = [
  ['@', '나'],
  ['!', '위험'],
  ['$', '전리품'],
  ['?', '미확인'],
  ['+', '문'],
  ['>', '출구·계단'],
  ['~', '위험 지형'],
];

export function MapView({map, onPick}: {map: GameMap; onPick?: (place: string) => void}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cols = Math.max(...map.rows.map(r => r.length));
  const text = map.rows.join('\n');
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    let on = false;
    draw(ctx, map.rows, on);
    const id = setInterval(() => draw(ctx, map.rows, (on = !on)), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const used = new Set(text);
  return (
    <VStack gap={3}>
      <canvas
        ref={ref}
        className="rp-map"
        width={cols * T}
        height={map.rows.length * T}
        style={{maxWidth: cols * T * 4}}
        role="img"
        aria-label="지도"
      />
      {map.note && <Text color="secondary">{map.note}</Text>}
      {map.legend && (
        <HStack gap={2} wrap="wrap">
          {Object.entries(map.legend).map(([ch, name]) => (
            <Button key={ch} size="sm" label={`${ch} · ${name}`} onClick={() => onPick?.(name)} tooltip="행동 입력에 넣기" />
          ))}
        </HStack>
      )}
      <Text type="supporting" color="secondary">
        {KEY.filter(([ch]) => used.has(ch))
          .map(([ch, name]) => `${ch} ${name}`)
          .join('  ·  ')}
      </Text>
    </VStack>
  );
}
