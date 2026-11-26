import {useEffect, useRef, useState} from 'react';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {Link} from '@astryxdesign/core/Link';
import {Spinner} from '@astryxdesign/core/Spinner';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/VStack';
import {useGameState, useGmStatus} from './api';
import {MapView} from './MapView';
import {LogTab} from './Log';
import {JournalTab, PeopleTab, StatusTab} from './Panels';
import {SceneView} from './Scene';
import type {GmStatus} from './api';
import type {GameState} from './types';

const gmLabel = (gm: GmStatus) => (gm.listening ? 'GM 입력 대기 중' : gm.busy ? 'GM 쓰는 중' : 'GM 자리 비움');

export function Game({c}: {c: string}) {
  const state = useGameState(c);
  const gm = useGmStatus();
  const [tab, setTab] = useState('scene');
  const [text, setText] = useState('');
  const [uses, setUses] = useState<string[]>([]);
  // 새 장면이 오기 직전의 상태. 장면을 읽는 동안 HP·적·시계는 이 값에서 출발한다.
  const held = useRef<{sceneId: number; base: GameState; latest: GameState} | null>(null);

  const sceneId = state?.scene?.id ?? 0;
  if (state) {
    if (!held.current) held.current = {sceneId, base: state, latest: state};
    else if (held.current.sceneId !== sceneId) held.current = {sceneId, base: held.current.latest, latest: state};
    else held.current.latest = state;
  }
  useEffect(() => {
    if (sceneId) setTab('scene');
  }, [sceneId]);
  useEffect(() => {
    if (state) document.title = state.title;
  }, [state?.title]);

  const view = held.current?.latest;
  if (!view || !held.current) {
    return <EmptyState title="불러오는 중" description={`${c} 캠페인의 상태를 읽고 있어.`} actions={<Spinner />} />;
  }
  const draft = {text, setText, uses, setUses};
  const shownTab = tab;
  const pick = (place: string) => {
    setText(`${place}(으)로 이동한다`);
    setTab('scene');
  };

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="end" gap={3}>
        <VStack gap={0.5}>
          <Heading level={1}>{view.title}</Heading>
          <Text color="secondary">{[view.time, view.place].filter(Boolean).join(' · ')}</Text>
        </VStack>
        <HStack gap={3} vAlign="center">
          {gm && (
            <HStack gap={1} vAlign="center">
              <StatusDot variant={gm.listening ? 'success' : gm.busy ? 'accent' : 'warning'} label={gmLabel(gm)} isPulsing={gm.busy} />
              <Text type="supporting" color="secondary">{gmLabel(gm)}</Text>
            </HStack>
          )}
          <Link href="/">로비</Link>
        </HStack>
      </HStack>
      <div className="rp-tabs">
        <TabList value={shownTab} onChange={setTab} hasDivider>
          <Tab value="scene" label="장면" />
          <Tab value="status" label="상태" />
          <Tab value="people" label="인물" />
          {view.map && <Tab value="map" label="지도" />}
          <Tab value="journal" label="기록" />
          <Tab value="log" label="지난 장면" />
        </TabList>
      </div>
      {/* 탭을 옮겨도 읽던 위치와 전투 연출이 유지되도록 장면은 숨기기만 한다 */}
      <div hidden={shownTab !== 'scene'}>
        <SceneView key={sceneId} c={c} state={view} base={held.current.base} draft={draft} stuck={!!gm && gm.pending && !gm.listening} />
      </div>
      {shownTab === 'status' && <StatusTab c={c} state={view} draft={draft} />}
      {shownTab === 'people' && <PeopleTab c={c} state={view} />}
      {shownTab === 'map' && view.map && <MapView map={view.map} onPick={pick} />}
      {shownTab === 'journal' && <JournalTab state={view} />}
      {shownTab === 'log' && <LogTab c={c} state={view} />}
    </VStack>
  );
}
