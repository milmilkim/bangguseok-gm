import {useEffect, useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {Link} from '@astryxdesign/core/Link';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/VStack';
import {act, useCampaigns, useGameState} from './api';
import {ENDING_LABEL, EndingCard} from './Ask';
import {LogTab} from './Log';
import {PeopleTab} from './Panels';
import {PixelAvatar} from './PixelAvatar';
import {heroLook} from './Scene';
import type {Campaign, Ending} from './types';

export const endingTone = (e: Ending) => (e.kind === 'bad' ? 'error' : e.kind === 'normal' ? 'neutral' : 'success');

// 2회차는 series 로 첫 캠페인에 묶여서 한 이야기의 결말로 같이 센다
function seenEndings(campaigns: Campaign[], c: string) {
  const key = campaigns.find(x => x.slug === c)?.series || c;
  const seen = new Map<string, Ending>();
  for (const x of campaigns) if (x.ending && (x.series || x.slug) === key) seen.set(x.ending.title, x.ending);
  return [...seen.values()];
}

export function Home({c}: {c: string}) {
  const state = useGameState(c);
  const campaigns = useCampaigns();
  const [tab, setTab] = useState('story');
  useEffect(() => {
    if (state) document.title = state.title;
  }, [state?.title]);

  if (!state) return <EmptyState title="불러오는 중" description={`${c} 캠페인의 상태를 읽고 있어.`} actions={<Spinner />} />;

  const seen = seenEndings(campaigns ?? [], c);
  const total = Math.max(0, ...seen.map(e => e.total ?? 0));
  const play = async () => {
    await act({kind: 'continue', c});
    location.search = `?c=${c}`;
  };

  return (
    <VStack gap={5}>
      <Link href="/">← 로비</Link>
      <HStack gap={3} vAlign="center">
          <PixelAvatar look={heroLook(state.pc)} size={72} />
          <VStack gap={0.5}>
            <Heading level={1}>{state.title}</Heading>
            <Text color="secondary">
              {[state.genre, state.pc.name + (state.pc.grade ? ` (${state.pc.grade}급)` : '')].filter(Boolean).join(' · ')}
            </Text>
            <Text type="supporting" color="secondary">{[state.time, state.place].filter(Boolean).join(' · ')}</Text>
        </VStack>
      </HStack>

      {state.ending && <EndingCard ending={state.ending} state={state} />}

      {seen.length > 0 && (
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label" hasTabularNumbers>본 엔딩 {total ? `${seen.length}/${total}` : `${seen.length}개`}</Text>
          {seen.map(e => (
            <Badge key={e.title} variant={endingTone(e)} label={`${ENDING_LABEL[e.kind]} · ${e.title}`} />
          ))}
        </HStack>
      )}

      <HStack gap={2} wrap="wrap">
        <Button variant="primary" size="lg" label={state.ending ? '후일담 이어 보기' : '이어하기'} onClick={() => void play()} />
        {/* GM을 부르지 않고 화면만 연다 */}
        <Button size="lg" label="플레이 화면만 열기" onClick={() => (location.search = `?c=${c}`)} />
      </HStack>

      <div className="rp-tabs">
        <TabList value={tab} onChange={setTab} hasDivider>
          <Tab value="story" label="지난 이야기" />
          <Tab value="people" label="인물" />
          <Tab value="log" label="전체 장면" />
        </TabList>
      </div>

      {tab === 'story' &&
        (state.story.length ? (
          <VStack gap={4}>
            {state.story.map((chapter, i) => (
              <VStack key={chapter.title + i} gap={1}>
                <Heading level={3}>{chapter.title}</Heading>
                <Text color="secondary">{chapter.text}</Text>
              </VStack>
            ))}
          </VStack>
        ) : (
          <EmptyState title="아직 정리된 이야기가 없어" description="장면이 일단락될 때마다 여기에 쌓여." />
        ))}
      {tab === 'people' && <PeopleTab c={c} state={state} />}
      {tab === 'log' && <LogTab c={c} state={state} />}
    </VStack>
  );
}
