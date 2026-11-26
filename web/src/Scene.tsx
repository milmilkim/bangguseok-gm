import {useEffect, useMemo, useRef, useState} from 'react';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {HStack} from '@astryxdesign/core/HStack';
import {Kbd} from '@astryxdesign/core/Kbd';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';
import {VStack} from '@astryxdesign/core/VStack';
import {AskDock, type Draft} from './Ask';
import {BattleStage, type Fx} from './Battle';
import {PixelAvatar} from './PixelAvatar';
import {autoLook, type Look} from './sprites';
import type {Clock, Enemy, GameState, Line, Pc} from './types';

export const GRADE: Record<string, 'neutral' | 'green' | 'blue' | 'purple' | 'yellow' | 'red'> = {
  E: 'neutral',
  D: 'green',
  C: 'blue',
  B: 'purple',
  A: 'yellow',
  S: 'red',
};
export const heroLook = (pc: Pc): Look => ({style: pc.sprite ?? 'blade', ...pc.look});

/** 초상 그림이 있으면 그걸, 없으면 도트 캐릭터를 보여 준다. 외형이 없는 인물은 이름으로 자동 생성한다. */
export function Face({c, name, look, size = 48, tryPortrait = true}: {c: string; name: string; look?: Look; size?: number; tryPortrait?: boolean}) {
  const [hasPortrait, setHasPortrait] = useState(false);
  useEffect(() => {
    if (!tryPortrait) return;
    const img = new Image();
    img.onload = () => setHasPortrait(true);
    img.src = portrait(c, name);
  }, [c, name, tryPortrait]);
  if (hasPortrait) return <Avatar name={name} src={portrait(c, name)} size={size >= 64 ? 'xl' : 'md'} shape="rounded" tooltip={false} />;
  return <PixelAvatar look={look ?? autoLook(name)} size={size} bust />;
}
export const portrait = (c: string, name: string) => `/portraits/${c}/${encodeURIComponent(name)}.png`;

/** 이름 → 외형. 대본은 "세리아"처럼 이름만 쓰고 인물 목록에는 "세리아 발트하임"으로 적혀 있을 수 있어 첫 단어로도 찾는다. */
export function lookMap(state: GameState) {
  const looks = new Map<string, Look | undefined>();
  for (const n of state.npcs) {
    const first = n.name.split(' ')[0];
    if (!looks.has(first)) looks.set(first, n.look);
  }
  for (const n of state.npcs) looks.set(n.name, n.look);
  looks.set(state.pc.name, heroLook(state.pc));
  looks.set(state.pc.name.split(' ')[0], heroLook(state.pc));
  return looks;
}

type Hp = Record<string, number>;

function hpOf(s: GameState): Hp {
  const hp: Hp = {};
  const first = s.pc.gauges?.[0];
  if (first) hp[s.pc.name] = first.cur;
  for (const e of s.enemies ?? []) if (e.max) hp[e.name] = e.down ? 0 : e.cur ?? e.max;
  return hp;
}

function Clocks({clocks}: {clocks: Clock[]}) {
  return (
    <VStack gap={1}>
      {clocks.map(c => (
        <HStack key={c.label} gap={3} vAlign="center" hAlign="between">
          <Text color={c.bad && c.cur >= c.max ? 'accent' : undefined}>{c.label}</Text>
          <div className={`rp-clock${c.bad ? ' bad' : ''}`} title={`${c.cur} / ${c.max}`}>
            {Array.from({length: c.max}, (_, i) => (
              <i key={i} className={i < c.cur ? 'on' : ''} />
            ))}
          </div>
        </HStack>
      ))}
    </VStack>
  );
}

function EnemyRow({e, hp}: {e: Enemy; hp?: number}) {
  const dead = e.max ? (hp ?? 0) <= 0 : !!e.down;
  return (
    <VStack gap={1} className={dead ? 'rp-dim' : undefined}>
      <HStack gap={2} vAlign="center">
        {e.grade && <Badge variant={GRADE[e.grade] ?? 'neutral'} label={e.grade} />}
        <Text type="label" hasStrikethrough={dead}>
          {e.name}
        </Text>
        {e.boss && <Badge variant="error" label="BOSS" />}
        {dead && <Text color="secondary">처치</Text>}
      </HStack>
      {e.max && !dead && (
        <ProgressBar
          label={`${e.name} 체력`}
          isLabelHidden
          variant="error"
          value={hp ?? 0}
          max={e.max}
          hasValueLabel
          formatValueLabel={(v, max) => `${v} / ${max}`}
        />
      )}
      {!dead && !!e.traits?.length && (
        <HStack gap={1} wrap="wrap">
          {e.traits.map(t => (
            <Token key={t} size="sm" label={t} />
          ))}
        </HStack>
      )}
    </VStack>
  );
}

export function LineView({c, line, now, looks}: {c: string; line: Line; now: boolean; looks: Map<string, Look | undefined>}) {
  const cls = `rp-line${now ? ' now' : ''}`;
  switch (line.t) {
    case 'say':
      return (
        <HStack gap={3} vAlign="start" className={cls}>
          <Face c={c} name={line.who} look={looks.get(line.who)} tryPortrait={looks.has(line.who)} />
          <VStack gap={0.5} className="rp-say">
            <Text type="label" color="accent">
              {line.who}
            </Text>
            <p className="rp-prose">{line.text}</p>
          </VStack>
        </HStack>
      );
    case 'sys':
      return <div className={`${cls} rp-sys`}>{line.text}</div>;
    case 'loot':
      return (
        <div className={`${cls} rp-loot`} data-grade={line.grade}>
          <Badge variant={GRADE[line.grade] ?? 'neutral'} label={line.grade} />
          <VStack gap={0}>
            <Text type="label">{line.name}</Text>
            {line.text && <Text color="secondary">{line.text}</Text>}
          </VStack>
          <Text type="supporting" color="secondary">획득</Text>
        </div>
      );
    case 'banner':
      return (
        <div className={`${cls} rp-bannerline`}>
          <Divider label={line.text} />
          {line.sub && <Text color="secondary">{line.sub}</Text>}
        </div>
      );
    case 'fx':
      return (
        <div className={`${cls} rp-fx ${line.delta < 0 ? 'hurt' : 'heal'}`}>
          {line.who} {line.delta < 0 ? '−' : '+'}
          {Math.abs(line.delta)}
        </div>
      );
    case 'narr':
      return <p className={`${cls} rp-prose`}>{line.text}</p>;
    default:
      return null;
  }
}

export function SceneView({
  c,
  state,
  base,
  draft,
  stuck,
}: {
  c: string;
  state: GameState;
  base: GameState;
  draft: Draft;
  stuck: boolean;
}) {
  const lines = state.scene?.lines ?? [];
  const key = `rp:${c}:${state.scene?.id ?? 0}`;
  const resumed = Number(sessionStorage.getItem(key)) || 0;
  const [shown, setShown] = useState(Math.max(1, resumed));
  // 읽던 도중에 새로 고쳤으면 이전 수치를 모르므로 지금 수치를 그대로 쓴다
  const [hp, setHp] = useState<Hp>(() => hpOf(resumed ? state : base));
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<Extract<Line, {t: 'banner'}> | null>(null);
  const fxId = useRef(0);
  const synced = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const done = shown >= lines.length;

  const applyHits = (hits: [string, number][]) => {
    if (!hits.length) return;
    const items = hits.map(([who, delta]) => ({id: ++fxId.current, who, delta}));
    setFx(list => [...list, ...items]);
    setHp(h => hits.reduce((acc, [who, delta]) => ({...acc, [who]: Math.max(0, (acc[who] ?? 0) + delta)}), h));
  };

  const advance = (all = false) => {
    if (done || banner) return;
    const next = all ? lines.length : shown + 1;
    const fresh = lines.slice(shown, next);
    applyHits(fresh.flatMap(l => (l.t === 'fx' ? [[l.who, l.delta] as [string, number]] : [])));
    const last = fresh[fresh.length - 1];
    if (!all && last?.t === 'banner') setBanner(last);
    setShown(next);
  };

  const mounted = useRef(false);
  useEffect(() => {
    sessionStorage.setItem(key, String(shown));
    // 처음 열 때는 제목과 탭이 보이도록 그대로 두고, 넘길 때만 따라 내려간다
    if (mounted.current) end.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
    mounted.current = true;
  }, [key, shown]);

  // 다 읽었으면 대본에 없던 수치 변화까지 실제 상태에 맞춘다
  const actual = useMemo(() => hpOf(state), [state]);
  useEffect(() => {
    if (!done) return;
    const hits: [string, number][] = [];
    const sets: Hp = {};
    for (const [who, cur] of Object.entries(actual)) {
      const before = hp[who];
      if (before === undefined || synced.current) sets[who] = cur;
      else if (before !== cur) hits.push([who, cur - before]);
    }
    synced.current = true;
    if (Object.keys(sets).length) setHp(h => ({...h, ...sets}));
    applyHits(hits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, actual]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, button, [role=tab]')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (banner) setBanner(null);
        else advance();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (!lines.length) return <EmptyState title="아직 장면이 없어" description="GM이 첫 장면을 쓰면 여기에 나타나." />;

  // 읽는 동안에는 이전 장면의 적만 보여 주고, 이번 장면에서 새로 나온 적은 그 줄을 지나야 나타난다
  const seen = new Set(lines.slice(0, shown).flatMap(l => (l.t === 'fx' ? [l.who] : [])));
  const before = new Map((base.enemies ?? []).map(e => [e.name, e]));
  const current = state.enemies ?? [];
  const roster = done
    ? current
    : [...(base.enemies ?? []).map(e => current.find(n => n.name === e.name) ?? e), ...current.filter(e => !before.has(e.name) && seen.has(e.name))];
  const clocks = (done ? state.clocks : base.clocks) ?? [];
  const pcGauge = state.pc.gauges?.[0];
  const looks = lookMap(state);
  const fighting = roster.length > 0;

  return (
    <VStack gap={4}>
      {fighting && (
        <div className="rp-stagewrap">
          <BattleStage
            hero={{name: state.pc.name, look: heroLook(state.pc)}}
            enemies={roster.map(e => ({name: e.name, sprite: e.sprite, art: e.art, boss: e.boss, down: e.max ? (hp[e.name] ?? 0) <= 0 : e.down}))}
            fx={fx}
          />
          {pcGauge && (
            <div className="rp-stagehp">
              <ProgressBar
                label={`${state.pc.name} ${pcGauge.label}`}
                variant={(hp[state.pc.name] ?? 0) / pcGauge.max <= 0.34 ? 'error' : 'success'}
                value={hp[state.pc.name] ?? 0}
                max={pcGauge.max}
                hasValueLabel
                formatValueLabel={(v, max) => `${v} / ${max}`}
              />
            </div>
          )}
        </div>
      )}

      <div className={`rp-scene${done ? '' : ' reading'}`} onClick={() => !done && advance()}>
        {lines.slice(0, shown).map((line, i) => (
          <LineView key={i} c={c} line={line} now={i === shown - 1} looks={looks} />
        ))}
        {!done && (
          <HStack gap={3} vAlign="center" hAlign="center" className="rp-next">
            <Text color="secondary">
              눌러서 계속 <Kbd keys="Space" /> · {shown}/{lines.length}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              label="전부 보기"
              onClick={e => {
                e.stopPropagation();
                advance(true);
              }}
            />
          </HStack>
        )}
      </div>

      {done && (
        <Card padding={4}>
          <VStack gap={4}>
            {clocks.length > 0 && <Clocks clocks={clocks} />}
            {fighting && (
              <VStack gap={3}>
                {roster.map(e => (
                  <EnemyRow key={e.name} e={e} hp={hp[e.name]} />
                ))}
              </VStack>
            )}
            {(clocks.length > 0 || fighting) && <Divider />}
            {state.ask ? (
              <AskDock key={state.ask.id} c={c} ask={state.ask} draft={draft} stuck={stuck} />
            ) : (
              <Text color="secondary">GM의 다음 장면을 기다리는 중</Text>
            )}
          </VStack>
        </Card>
      )}
      <div ref={end} />

      {banner && (
        <div className="rp-banner" onClick={() => setBanner(null)} role="dialog" aria-label={banner.text}>
          <div>
            <small>SYSTEM</small>
            <hr />
            <h2>{banner.text}</h2>
            <hr />
            {banner.sub && <p>{banner.sub}</p>}
          </div>
        </div>
      )}
    </VStack>
  );
}
