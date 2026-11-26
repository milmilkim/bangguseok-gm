import type {Art, Look} from './sprites';

export type Gauge = {label: string; cur: number; max: number};
export type Skill = {name: string; state: string; desc?: string; cost?: string; note?: string};
export type InvItem = {name: string; desc?: string; qty?: number};
export type Money = {label: string; amount: number; debt?: boolean; note?: string};

export type Pc = {
  name: string;
  blurb?: string;
  grade?: string;
  sprite?: string;
  look?: Look;
  gauges?: Gauge[];
  conditions?: string[];
  stats: Record<string, number>;
  skills: Skill[];
  inventory: InvItem[];
  money?: Money[];
};

export type Npc = {
  name: string;
  major?: boolean;
  age?: number;
  grade?: string;
  role?: string;
  attitude?: string;
  tone?: 'good' | 'warn' | 'bad' | 'info';
  speech?: string;
  status?: string;
  look?: Look;
  bond?: {cur: number; max: number; label?: string};
  events?: string[];
  known?: string[];
};

export type Enemy = {
  name: string;
  grade?: string;
  sprite?: string;
  art?: Art;
  boss?: boolean;
  cur?: number;
  max?: number;
  traits?: string[];
  down?: boolean;
};

export type Clock = {label: string; cur: number; max: number; bad?: boolean};

export type Roll = {
  id: number;
  name: string;
  d20: number;
  mod: number;
  bonus?: {label: string; mod: number}[];
  total: number;
  dc: number;
  success: boolean;
  at?: string;
};

export type Line =
  | {t: 'narr'; text: string}
  | {t: 'say'; who: string; text: string}
  | {t: 'sys'; text: string}
  | {t: 'loot'; grade: string; name: string; text?: string}
  | {t: 'banner'; text: string; sub?: string}
  | {t: 'fx'; who: string; delta: number}
  | {t: 'roll'; roll: number};

export type Answer = {
  kind: string;
  text?: string;
  uses?: string[];
  index?: number;
  luck?: number;
  roll?: Roll;
};

export type Ending = {title: string; kind: 'true' | 'good' | 'normal' | 'bad'; text: string};

type AskBase = {id: number; answer?: Answer};
export type Ask = AskBase &
  (
    | {type: 'action'; choices: string[]}
    | {
        type: 'roll';
        name: string;
        stat: string;
        mod: number;
        dc: number;
        stakes: string;
        boosts: {name: string; mod: number; cost: string}[];
        aim: boolean;
      }
    | {type: 'choice'; choices: string[]}
    | {type: 'timed'; seconds: number; choices: string[]}
    | {type: 'code'; label: string; length: number}
    | {type: 'cards'; label: string; count: number}
    | ({type: 'ending'; choices: string[]} & Ending)
  );

export type GameMap = {rows: string[]; legend?: Record<string, string>; note?: string};

export type GameState = {
  title: string;
  genre?: string;
  time?: string;
  place?: string;
  pc: Pc;
  npcs: Npc[];
  clues: {text: string; done?: boolean}[];
  story: {title: string; text: string}[];
  rolls: Roll[];
  scene?: {id: number; lines: Line[]};
  ask?: Ask;
  enemies?: Enemy[];
  clocks?: Clock[];
  map?: GameMap;
  ending?: Ending;
};

export type LogEntry = {id: number; time?: string; place?: string; lines: Line[]; said?: string};

export type Campaign = {
  slug: string;
  title: string;
  genre: string;
  time: string;
  place: string;
  pc: string;
  grade: string;
  scene: number;
  ending?: Ending | null;
};
