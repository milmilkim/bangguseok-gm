import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Text} from '@astryxdesign/core/Text';
import {Token} from '@astryxdesign/core/Token';
import {VStack} from '@astryxdesign/core/VStack';
import {signed, verdict, type Draft} from './Ask';
import {PixelAvatar} from './PixelAvatar';
import {Face, GRADE, heroLook} from './Scene';
import type {GameState, Npc} from './types';

const won = (n: number) => n.toLocaleString('ko-KR') + '원';
const SKILL: Record<string, [string, 'success' | 'warning' | 'neutral']> = {
  ready: ['사용 가능', 'success'],
  used: ['사용함', 'warning'],
  settling: ['정착 중', 'warning'],
  locked: ['잠김', 'neutral'],
};
const TONE = {good: 'success', warn: 'warning', bad: 'error', info: 'info'} as const;

function Block({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <VStack gap={2}>
      <Heading level={3}>{title}</Heading>
      {children}
    </VStack>
  );
}

function Bullets({items}: {items: string[]}) {
  return (
    <ul className="rp-list">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function StatusTab({c, state, draft}: {c: string; state: GameState; draft: Draft}) {
  const {pc} = state;
  const toggle = (name: string) =>
    draft.setUses(draft.uses.includes(name) ? draft.uses.filter(u => u !== name) : [...draft.uses, name]);
  const useButton = (name: string) => (
    <Button size="sm" label={draft.uses.includes(name) ? '이번 행동에서 빼기' : '이번 행동에 쓰기'} onClick={() => toggle(name)} />
  );
  return (
    <VStack gap={6}>
      <Card>
        <VStack gap={4}>
          <HStack gap={3} vAlign="center">
            <PixelAvatar look={heroLook(pc)} size={72} />
            <VStack gap={0.5}>
              <Heading level={2}>{pc.name}</Heading>
              {pc.blurb && <Text color="secondary">{pc.blurb}</Text>}
            </VStack>
            {pc.grade && <span className="rp-grade" data-grade={pc.grade}>{pc.grade}</span>}
          </HStack>
          {pc.gauges?.map(g => (
            <ProgressBar
              key={g.label}
              label={g.label}
              value={g.cur}
              max={g.max}
              variant={g.cur / g.max <= 0.34 ? 'error' : 'success'}
              hasValueLabel
              formatValueLabel={(v, max) => `${v} / ${max}`}
            />
          ))}
          {!!pc.conditions?.length && (
            <HStack gap={1} wrap="wrap">
              {pc.conditions.map(cond => (
                <Token key={cond} color="yellow" label={cond} />
              ))}
            </HStack>
          )}
          <Grid columns={Object.keys(pc.stats).length} gap={2}>
            {Object.entries(pc.stats).map(([name, value]) => (
              <Card key={name} variant="muted" padding={2}>
                <VStack gap={0} hAlign="center">
                  <Text type="supporting" color="secondary">{name}</Text>
                  <Text type="large" hasTabularNumbers color={value > 0 ? 'accent' : value < 0 ? 'secondary' : undefined}>
                    {signed(value)}
                  </Text>
                </VStack>
              </Card>
            ))}
          </Grid>
        </VStack>
      </Card>

      <Block title="스킬">
        {pc.skills.map(k => {
          const [label, variant] = SKILL[k.state] ?? [k.state, 'neutral'];
          return (
            <Collapsible
              key={k.name}
              defaultIsOpen={false}
              trigger={
                <HStack gap={2} vAlign="center">
                  <Text type="label" color={k.state === 'locked' ? 'disabled' : undefined}>「{k.name}」</Text>
                  <Badge variant={variant} label={label} />
                </HStack>
              }>
              <VStack gap={2} paddingBlock={2}>
                {k.desc && <Text>{k.desc}</Text>}
                {k.cost && <Text color="secondary">대가 · {k.cost}</Text>}
                {k.note && <Text color="secondary">{k.note}</Text>}
                {k.state !== 'locked' && k.state !== 'used' && <HStack>{useButton(`「${k.name}」`)}</HStack>}
              </VStack>
            </Collapsible>
          );
        })}
      </Block>

      <Block title="소지품">
        {pc.inventory.length ? (
          pc.inventory.map(it => (
            <Collapsible
              key={it.name}
              defaultIsOpen={false}
              trigger={
                <HStack gap={2} vAlign="center">
                  <Text type="label">{it.name}</Text>
                  {(it.qty ?? 1) > 1 && <Text color="secondary">×{it.qty}</Text>}
                </HStack>
              }>
              <VStack gap={2} paddingBlock={2}>
                <Text color="secondary">{it.desc || '특이 사항 없음'}</Text>
                <HStack>{useButton(it.name)}</HStack>
              </VStack>
            </Collapsible>
          ))
        ) : (
          <Text color="secondary">비어 있음</Text>
        )}
      </Block>

      {!!pc.money?.length && (
        <Block title="돈">
          {pc.money.map(m => (
            <HStack key={m.label} hAlign="between" vAlign="center">
              <VStack gap={0}>
                <Text>{m.label}</Text>
                {m.note && <Text type="supporting" color="secondary">{m.note}</Text>}
              </VStack>
              <Text type="label" hasTabularNumbers color={m.debt ? 'secondary' : undefined}>
                {m.debt ? '−' : ''}
                {won(m.amount)}
              </Text>
            </HStack>
          ))}
        </Block>
      )}
    </VStack>
  );
}

function NpcCard({c, n}: {c: string; n: Npc}) {
  const gone = n.status === '사망';
  return (
    <Collapsible
      defaultIsOpen={false}
      trigger={
        <HStack gap={3} vAlign="center" className={gone ? 'rp-dim' : undefined}>
          <Face c={c} name={n.name} look={n.look} tryPortrait={!!n.major} />
          <VStack gap={0}>
            <HStack gap={2} vAlign="center">
              <Text type="label">{n.name}</Text>
              {n.grade && <Badge variant={GRADE[n.grade] ?? 'neutral'} label={n.grade} />}
            </HStack>
            {n.role && <Text type="supporting" color="secondary">{n.role}</Text>}
          </VStack>
          {n.bond && (
            <span className="rp-bond" title={`${n.bond.label ?? '유대'} ${n.bond.cur}/${n.bond.max}`}>
              {Array.from({length: n.bond.max}, (_, i) => (
                <i key={i} className={i < n.bond!.cur ? 'on' : ''} />
              ))}
            </span>
          )}
        </HStack>
      }>
      <VStack gap={3} paddingBlock={2}>
        <HStack gap={2} wrap="wrap" vAlign="center">
          {n.status && <Badge variant="error" label={n.status} />}
          {n.attitude && n.attitude !== '—' && <Badge variant={n.tone ? TONE[n.tone] : 'neutral'} label={n.attitude} />}
          {n.age && <Text color="secondary">{n.age}세</Text>}
          {n.bond && (
            <Text color="secondary">
              {n.bond.label ?? '유대'} {n.bond.cur}/{n.bond.max}
            </Text>
          )}
        </HStack>
        {n.speech && <Text color="secondary">말투 · {n.speech}</Text>}
        {!!n.events?.length && (
          <VStack gap={1}>
            <Text type="supporting" color="secondary">있었던 일</Text>
            <Bullets items={n.events} />
          </VStack>
        )}
        {!!n.known?.length && (
          <VStack gap={1}>
            <Text type="supporting" color="secondary">내가 아는 것</Text>
            <Bullets items={n.known} />
          </VStack>
        )}
      </VStack>
    </Collapsible>
  );
}

export function PeopleTab({c, state}: {c: string; state: GameState}) {
  const major = state.npcs.filter(n => n.major);
  const minor = state.npcs.filter(n => !n.major);
  if (!state.npcs.length) return <EmptyState title="아직 만난 사람이 없어" />;
  return (
    <VStack gap={6}>
      <Block title="주요 인물">{major.map(n => <NpcCard key={n.name} c={c} n={n} />)}</Block>
      {minor.length > 0 && <Block title="그 외">{minor.map(n => <NpcCard key={n.name} c={c} n={n} />)}</Block>}
    </VStack>
  );
}

export function JournalTab({state}: {state: GameState}) {
  return (
    <VStack gap={6}>
      <Block title="단서 · 떡밥">
        {state.clues.length ? (
          <ul className="rp-list">
            {state.clues.map(clue => (
              <li key={clue.text} className={clue.done ? 'done' : undefined}>{clue.text}</li>
            ))}
          </ul>
        ) : (
          <Text color="secondary">아직 없음</Text>
        )}
      </Block>
      <Block title="지난 이야기">
        {state.story
          .map((chapter, i) => (
            <Collapsible key={chapter.title + i} defaultIsOpen={i === state.story.length - 1} trigger={<Text type="label">{chapter.title}</Text>}>
              <VStack paddingBlock={2}>
                <Text color="secondary">{chapter.text}</Text>
              </VStack>
            </Collapsible>
          ))
          .reverse()}
      </Block>
      <Block title="판정 기록">
        {state.rolls.length ? (
          state.rolls
            .slice()
            .reverse()
            .map(r => (
              <HStack key={r.id} gap={3} vAlign="center" hAlign="between">
                <VStack gap={0}>
                  <Text>{r.name}</Text>
                  {r.at && <Text type="supporting" color="secondary">{r.at}</Text>}
                </VStack>
                <HStack gap={3} vAlign="center">
                  <Text hasTabularNumbers color="secondary">
                    {r.d20} {signed(r.mod)}
                    {(r.bonus ?? []).map(b => ` ${signed(b.mod)}`).join('')} = {r.total} / {r.dc}
                  </Text>
                  <Badge variant={r.d20 === 20 ? 'yellow' : r.success ? 'success' : 'error'} label={verdict(r)} />
                </HStack>
              </HStack>
            ))
        ) : (
          <Text color="secondary">아직 굴린 판정이 없음</Text>
        )}
      </Block>
    </VStack>
  );
}
