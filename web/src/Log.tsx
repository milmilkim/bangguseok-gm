import {useEffect, useRef, useState} from 'react';
import {Divider} from '@astryxdesign/core/Divider';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/VStack';
import {fetchLog} from './api';
import {LineView, lookMap} from './Scene';
import type {GameState, LogEntry} from './types';

export function LogTab({c, state}: {c: string; state: GameState}) {
  const [log, setLog] = useState<LogEntry[] | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const sceneId = state.scene?.id ?? 0;
  useEffect(() => {
    let alive = true;
    void fetchLog(c).then(entries => alive && setLog(entries));
    return () => {
      alive = false;
    };
  }, [c, sceneId]);
  // 가장 최근 장면이 아래에 있으므로 열면 맨 아래부터 보여 준다
  useEffect(() => {
    if (log?.length) end.current?.scrollIntoView({block: 'end'});
  }, [log]);

  if (!log) return <EmptyState title="불러오는 중" actions={<Spinner />} />;
  if (!log.length) return <EmptyState title="아직 지나간 장면이 없어" description="다음 장면으로 넘어가면 지금 장면부터 여기에 쌓여." />;
  const looks = lookMap(state);
  return (
    <VStack gap={6}>
      {log.map((entry, i) => (
        <VStack key={i} gap={4}>
          <Divider label={[`#${entry.id}`, entry.time, entry.place].filter(Boolean).join(' · ')} />
          <div className="rp-scene">
            {entry.lines.map((line, j) => (
              <LineView key={j} c={c} line={line} now={false} looks={looks} />
            ))}
          </div>
          {entry.said && (
            <div className="rp-said">
              <Text type="supporting" color="secondary">내 선택</Text>
              <Text>{entry.said}</Text>
            </div>
          )}
        </VStack>
      ))}
      <Text type="supporting" color="secondary" justify="center" display="block">여기까지가 지나간 장면. 지금 장면은 “장면” 탭에 있어.</Text>
      <div ref={end} />
    </VStack>
  );
}
