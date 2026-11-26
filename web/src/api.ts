import {useEffect, useRef, useState} from 'react';
import type {Answer, Campaign, GameState, LogEntry} from './types';

export const slug = new URLSearchParams(location.search).get('c');

function usePolled<T>(url: string | null, ms: number): T | null {
  const [data, setData] = useState<T | null>(null);
  const last = useRef('');
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const tick = async () => {
      try {
        const text = await (await fetch(url, {cache: 'no-store'})).text();
        // 쓰는 도중에 읽혀 깨진 JSON이면 parse 가 던지고, 다음 폴링에서 다시 읽는다
        if (alive && text !== last.current) {
          const parsed = JSON.parse(text) as T;
          last.current = text;
          setData(parsed);
        }
      } catch {
        /* 다음 폴링에서 재시도 */
      }
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, ms]);
  return data;
}

export const useGameState = (c: string) => usePolled<GameState>(`/state/${c}.json`, 1000);
export const useCampaigns = () => usePolled<Campaign[]>('/api/campaigns', 2000);
export type GmStatus = {listening: boolean; busy: boolean; pending: boolean};
export const useGmStatus = () => usePolled<GmStatus>('/api/status', 2000);

export async function fetchLog(c: string): Promise<LogEntry[]> {
  const res = await fetch(`/api/log?c=${encodeURIComponent(c)}`, {cache: 'no-store'});
  return res.ok ? res.json() : [];
}

export type UpdateInfo = {behind: number; notes: string[]};
export const fetchUpdate = async (fresh = false): Promise<UpdateInfo> =>
  (await fetch(`/api/update${fresh ? '?fresh' : ''}`, {cache: 'no-store'})).json();
export const applyUpdate = async (): Promise<{done?: string[]; error?: string}> =>
  (await fetch('/api/update', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})).json();

export async function act(body: Record<string, unknown>): Promise<Answer & {ok?: boolean; error?: string}> {
  const res = await fetch('/api/act', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  return res.json();
}
