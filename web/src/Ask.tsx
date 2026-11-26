import {useEffect, useRef, useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {HStack} from '@astryxdesign/core/HStack';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {SelectableCard} from '@astryxdesign/core/SelectableCard';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Token} from '@astryxdesign/core/Token';
import {VStack} from '@astryxdesign/core/VStack';
import {act} from './api';
import type {Answer, Ask, Ending, GameState, Roll} from './types';

export const signed = (n: number) => (n < 0 ? '−' : '+') + Math.abs(n);
export const verdict = (r: Roll) => (r.d20 === 20 ? '대성공' : r.d20 === 1 ? '대실패' : r.success ? '성공' : '실패');

export type Draft = {
  text: string;
  setText: (text: string) => void;
  uses: string[];
  setUses: (uses: string[]) => void;
};

type Send = (body: Record<string, unknown>) => Promise<Answer | null>;

function Waiting({stuck, children}: {stuck: boolean; children?: React.ReactNode}) {
  return (
    <VStack gap={3}>
      {children}
      <HStack gap={2} vAlign="center">
        <Spinner size="sm" />
        <Text color="secondary">GM이 다음 장면을 쓰는 중</Text>
      </HStack>
      {stuck && (
        <Banner
          status="warning"
          title="GM이 듣고 있지 않아"
          description="입력은 저장됐어. 채팅 창에 아무 말이나 보내면 GM이 깨어나서 이어 가."
          collapsible={false}
        />
      )}
    </VStack>
  );
}

function Die({roll, spinning}: {roll?: Roll; spinning: boolean}) {
  const [face, setFace] = useState(20);
  useEffect(() => {
    if (!spinning) return;
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * 20)), 60);
    return () => clearInterval(id);
  }, [spinning]);
  const shown = spinning || !roll ? (spinning ? face : '?') : roll.d20;
  const tone = !spinning && roll ? (roll.d20 === 20 ? ' crit' : roll.d20 === 1 ? ' fumble' : roll.success ? ' win' : ' lose') : '';
  return <div className={`rp-die${spinning ? ' spin' : ''}${tone}`}>{shown}</div>;
}

function AimGauge({posRef}: {posRef: React.RefObject<number>}) {
  const marker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const phase = ((now - t0) / 850) % 2;
      const pos = phase < 1 ? phase : 2 - phase;
      posRef.current = pos;
      if (marker.current) marker.current.style.left = `${pos * 100}%`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [posRef]);
  return (
    <div className="rp-aim" aria-hidden>
      <div className="rp-aim-marker" ref={marker} />
    </div>
  );
}

function aimBonus(pos: number) {
  const off = Math.abs(pos - 0.5);
  return off < 0.06 ? 2 : off < 0.16 ? 1 : off < 0.32 ? 0 : -1;
}

function RollAsk({ask, send, stuck}: {ask: Extract<Ask, {type: 'roll'}>; send: Send; stuck: boolean}) {
  const done = ask.answer?.roll;
  const [roll, setRoll] = useState<Roll | undefined>(done);
  const [spinning, setSpinning] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const pos = useRef(0.5);
  const result = roll ?? done;

  const go = async () => {
    const aim = ask.aim ? aimBonus(pos.current) : 0;
    setSpinning(true);
    const [res] = await Promise.all([send({kind: 'roll', boosts: picked, aim}), new Promise(r => setTimeout(r, 900))]);
    setRoll(res?.roll);
    setSpinning(false);
  };

  const bonus = picked.reduce((sum, i) => sum + ask.boosts[i].mod, 0);
  // 1은 항상 실패, 20은 항상 성공이라 확률은 5%~95% 사이다
  const chance = Math.round(Math.min(0.95, Math.max(0.05, (21 - (ask.dc - ask.mod - bonus)) / 20)) * 100);
  return (
    <VStack gap={3} hAlign="center">
      <VStack gap={0.5} hAlign="center">
        <Text type="label">{ask.name}</Text>
        <Text color="secondary">
          d20 {signed(ask.mod)}
          {ask.stat ? ` (${ask.stat})` : ''}
          {bonus ? ` ${signed(bonus)}` : ''} ≥ {ask.dc}
        </Text>
      </VStack>
      <Die roll={result} spinning={spinning} />
      {result && !spinning ? (
        <Waiting stuck={stuck}>
          <VStack gap={1} hAlign="center">
            <Text type="large" weight="bold">
              {verdict(result)}
            </Text>
            <Text color="secondary" hasTabularNumbers>
              {result.d20} {signed(result.mod)}
              {(result.bonus ?? []).map(b => ` ${signed(b.mod)}(${b.label})`).join('')} = {result.total} / 난이도 {result.dc}
            </Text>
          </VStack>
        </Waiting>
      ) : (
        <>
          <Text color="secondary" hasTabularNumbers>성공 확률 약 {chance}%{ask.aim ? ' (조준 전)' : ''}</Text>
          {ask.stakes && <Text color="secondary">걸린 것 · {ask.stakes}</Text>}
          {ask.boosts.length > 0 && (
            <HStack gap={2} wrap="wrap" hAlign="center">
              {ask.boosts.map((b, i) => (
                <SelectableCard
                  key={b.name}
                  label={b.name}
                  padding={2}
                  isSelected={picked.includes(i)}
                  isDisabled={spinning}
                  onChange={on => setPicked(on ? [...picked, i] : picked.filter(p => p !== i))}>
                  <VStack gap={0}>
                    <Text type="label">
                      「{b.name}」 {signed(b.mod)}
                    </Text>
                    {b.cost && <Text type="supporting" color="secondary">대가 · {b.cost}</Text>}
                  </VStack>
                </SelectableCard>
              ))}
            </HStack>
          )}
          {ask.aim && !spinning && (
            <VStack gap={1} hAlign="center" width="100%">
              <AimGauge posRef={pos} />
              <Text type="supporting" color="secondary">가운데에서 멈추면 +2, 크게 빗나가면 −1</Text>
            </VStack>
          )}
          <Button variant="primary" size="lg" label={ask.aim ? '멈추고 굴리기' : '굴리기'} isDisabled={spinning} onClick={go} />
        </>
      )}
    </VStack>
  );
}

function ActionAsk({ask, send, draft}: {ask: Extract<Ask, {type: 'action' | 'ending'}>; send: Send; draft: Draft}) {
  const submit = () => {
    if (draft.text.trim()) void send({kind: 'action', text: draft.text, uses: draft.uses});
  };
  return (
    <VStack gap={2}>
      {ask.choices.length > 0 && (
        <HStack gap={2} wrap="wrap">
          {ask.choices.map(choice => (
            <Button key={choice} size="sm" label={choice} onClick={() => draft.setText(choice)} />
          ))}
        </HStack>
      )}
      {draft.uses.length > 0 && (
        <HStack gap={1} wrap="wrap" vAlign="center">
          <Text type="supporting" color="secondary">함께 사용</Text>
          {draft.uses.map(use => (
            <Token key={use} size="sm" color="blue" label={use} onRemove={() => draft.setUses(draft.uses.filter(u => u !== use))} />
          ))}
        </HStack>
      )}
      <TextArea
        label="행동"
        isLabelHidden
        rows={2}
        maxLength={2000}
        placeholder={ask.type === 'ending' ? '이야기는 끝났어. GM에게 하고 싶은 말이 있으면 적어 줘' : '무엇을 할까? (Enter로 보내기, Shift+Enter로 줄바꿈)'}
        value={draft.text}
        onChange={draft.setText}
        onKeyDown={e => {
          // 한글 조합 중의 Enter 는 글자 확정이라 보내지 않는다
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <HStack hAlign="end">
        <Button variant="primary" label={ask.type === 'ending' ? '보내기' : '행동하기'} isDisabled={!draft.text.trim()} onClick={submit} />
      </HStack>
    </VStack>
  );
}

function ChoiceAsk({ask, send}: {ask: Extract<Ask, {type: 'choice' | 'timed'}>; send: Send}) {
  const total = ask.type === 'timed' ? ask.seconds * 1000 : 0;
  const [left, setLeft] = useState(total);
  const fired = useRef(false);
  useEffect(() => {
    if (!total) return;
    const end = performance.now() + total;
    const id = setInterval(() => {
      const remain = Math.max(0, end - performance.now());
      setLeft(remain);
      if (!remain && !fired.current) {
        fired.current = true;
        void send({kind: 'timeout'});
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);
  const pick = (index: number) => {
    if (fired.current) return;
    fired.current = true;
    void send({kind: 'choice', index});
  };
  return (
    <VStack gap={3}>
      {total > 0 && (
        <ProgressBar
          label="남은 시간"
          value={left}
          max={total}
          variant={left < total / 3 ? 'error' : 'warning'}
          hasValueLabel
          formatValueLabel={v => `${Math.ceil(v / 1000)}초`}
        />
      )}
      <VStack gap={2}>
        {ask.choices.map((choice, i) => (
          <Button key={choice} size="lg" label={choice} onClick={() => pick(i)} />
        ))}
      </VStack>
    </VStack>
  );
}

function CodeAsk({ask, send}: {ask: Extract<Ask, {type: 'code'}>; send: Send}) {
  const [text, setText] = useState('');
  const ready = ask.length ? text.length === ask.length : text.trim().length > 0;
  const submit = () => {
    if (ready) void send({kind: 'code', text});
  };
  return (
    <HStack gap={2} vAlign="end">
      <TextInput
        label={ask.label}
        description={ask.length ? `${ask.length}자리` : undefined}
        value={text}
        onChange={v => setText(ask.length ? v.slice(0, ask.length) : v)}
        onEnter={submit}
        hasAutoFocus
        controlClassName="rp-code"
      />
      <Button variant="primary" label="입력" isDisabled={!ready} onClick={submit} />
    </HStack>
  );
}

function CardsAsk({ask, send}: {ask: Extract<Ask, {type: 'cards'}>; send: Send}) {
  return (
    <VStack gap={3} hAlign="center">
      <Text type="label">{ask.label}</Text>
      <HStack gap={3} hAlign="center">
        {Array.from({length: ask.count}, (_, i) => (
          <button key={i} type="button" className="rp-card" aria-label={`${i + 1}번째 카드`} onClick={() => void send({kind: 'card', index: i})} />
        ))}
      </HStack>
    </VStack>
  );
}

export const ENDING_LABEL: Record<Ending['kind'], string> = {true: '진 엔딩', good: '굿 엔딩', normal: '노멀 엔딩', bad: '배드 엔딩'};

function EndingCard({ending, state}: {ending: Ending; state: GameState}) {
  const bonds = state.npcs.filter(n => n.bond).sort((a, b) => b.bond!.cur - a.bond!.cur).slice(0, 3);
  const record = [
    `장면 ${state.scene?.id ?? 0}`,
    `판정 ${state.rolls.at(-1)?.id ?? 0}회`,
    state.pc.grade && `${state.pc.grade}급`,
    ...bonds.map(n => `${n.name} 유대 ${n.bond!.cur}/${n.bond!.max}`),
  ].filter(Boolean);
  return (
    <div className={`rp-ending ${ending.kind}`}>
      <small>{ENDING_LABEL[ending.kind]}</small>
      <h2>{ending.title}</h2>
      {ending.text && <p>{ending.text}</p>}
      {!!ending.total && <p>이 이야기의 결말 {ending.total}갈래 중 하나</p>}
      <hr />
      <span>{state.pc.name} · {record.join(' · ')}</span>
    </div>
  );
}

function sentText(ask: Ask, a: Answer): React.ReactNode {
  if (a.kind === 'action') return a.text;
  if (a.kind === 'timeout') return '시간 초과';
  if (a.kind === 'code') return a.text;
  if (a.kind === 'choice' && 'choices' in ask) return ask.choices[a.index ?? 0];
  if (a.kind === 'card') return `${(a.index ?? 0) + 1}번째 카드`;
  return null;
}

export function AskDock({c, ask, draft, stuck, state}: {c: string; ask: Ask; draft: Draft; stuck: boolean; state: GameState}) {
  const [local, setLocal] = useState<Answer | null>(null);
  const [error, setError] = useState('');
  const send: Send = async body => {
    const res = await act({c, ask: ask.id, ...body});
    if (res.error) {
      setError(res.error);
      return null;
    }
    setLocal(res);
    draft.setText('');
    draft.setUses([]);
    return res;
  };
  const answer = ask.answer ?? local;

  if (ask.type === 'roll') return <RollAsk ask={ask} send={send} stuck={stuck} />;
  if (answer) {
    return (
      <Waiting stuck={stuck}>
        {ask.type === 'ending' && <EndingCard ending={ask} state={state} />}
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Badge variant="info" label="보냄" />
          <Text>{sentText(ask, answer)}</Text>
          {answer.uses?.map(use => <Token key={use} size="sm" color="blue" label={use} />)}
          {answer.kind === 'card' && <Text color="secondary">운 {answer.luck}</Text>}
        </HStack>
      </Waiting>
    );
  }
  return (
    <VStack gap={2}>
      {error && <Banner status="error" title={error} collapsible={false} isDismissable onDismiss={() => setError('')} />}
      {ask.type === 'ending' && <EndingCard ending={ask} state={state} />}
      {(ask.type === 'action' || ask.type === 'ending') && <ActionAsk ask={ask} send={send} draft={draft} />}
      {(ask.type === 'choice' || ask.type === 'timed') && <ChoiceAsk ask={ask} send={send} />}
      {ask.type === 'code' && <CodeAsk ask={ask} send={send} />}
      {ask.type === 'cards' && <CardsAsk ask={ask} send={send} />}
    </VStack>
  );
}
