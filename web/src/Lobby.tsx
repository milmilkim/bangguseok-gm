import {useEffect, useRef, useState} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {SelectableCard} from '@astryxdesign/core/SelectableCard';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {ToggleButton} from '@astryxdesign/core/ToggleButton';
import {VStack} from '@astryxdesign/core/VStack';
import {act, applyUpdate, fetchUpdate, useCampaigns, useGmStatus} from './api';
import type {UpdateInfo} from './api';
import {ENDING_LABEL, signed} from './Ask';
import {endingTone} from './Home';
import {PixelAvatar} from './PixelAvatar';
import {HAIR, OUTFIT, SKIN} from './sprites';
import {OPTIONS} from './types';

const GENRES = [
  {name: '헌터물', hook: '게이트, 등급, 스킬. 밑바닥에서 치고 올라가는 성장물.'},
  {name: '크툴루 호러', hook: '알면 안 되는 것을 조사한다. 싸우기보다 도망치고 버틴다.'},
  {name: '던전 탐험', hook: '횃불과 식량을 아끼며 깊이 내려간다. 지도와 함정, 전리품.'},
  {name: '무협', hook: '문파와 은원, 내공과 초식. 강호에 이름을 새긴다.'},
  {name: '로판', hook: '황실과 가문, 아카데미. 회귀·빙의·계약으로 판을 뒤집는다.'},
  {name: '미스터리', hook: '사건과 단서, 용의자. 흩어진 조각을 맞춰 범인을 지목한다.'},
  {name: 'GM에게 맡김', hook: '요청 칸에 원하는 걸 적거나, 비워 두면 GM이 고른다.'},
];
const TONES = ['사이다 성장', '정통 모험', '하드코어'];
const HEAT = ['순한맛', '보통', '매운맛'];
const BONDS = ['없이', '은은하게', '진하게'];
const GENDERS = ['남성', '여성', '정하지 않음'];
const {결말: ENDINGS, 전투: COMBAT, 주인공: HERO} = OPTIONS;
const STYLES = [
  ['blade', '검'],
  ['tank', '방패'],
  ['caster', '술사'],
  ['plain', '맨손'],
];
const CUTS = [
  ['short', '짧은 머리'],
  ['bob', '단발'],
  ['long', '긴 머리'],
  ['tail', '포니테일'],
];

const STATS = [
  ['힘', '밀고 부수고 맞붙는다'],
  ['민첩', '피하고 숨고 손끝을 쓴다'],
  ['체력', '버티고 견딘다. HP가 늘어난다'],
  ['지능', '알고 살피고 추리한다'],
  ['정신', '겁먹지 않고 흔들리지 않는다'],
  ['매력', '설득하고 속이고 마음을 얻는다'],
];
const STAT_MIN = -2;
// 분위기가 시작 캐릭터의 크기를 정한다. 스킬 "6. 판정 규칙"의 표와 같아야 한다
const BUILD: Record<string, {points: number; max: number; traits: number}> = {
  '사이다 성장': {points: 10, max: 4, traits: 3},
  '정통 모험': {points: 7, max: 3, traits: 2},
  하드코어: {points: 4, max: 3, traits: 1},
};
const TRAITS = [
  {name: '싸움꾼', desc: '맞붙어 싸우는 판정 +2', combat: true},
  {name: '명사수', desc: '쏘고 던지는 판정 +2', combat: true},
  {name: '날쌘 몸', desc: '피하기·달리기·곡예 +2'},
  {name: '그림자', desc: '숨기·미행·잠입 +2'},
  {name: '손재주', desc: '자물쇠·기계·응급처치 +2'},
  {name: '눈썰미', desc: '관찰·수색·거짓말 간파 +2'},
  {name: '책벌레', desc: '지식·조사·해독 +2'},
  {name: '달변', desc: '설득·협상·흥정 +2'},
  {name: '능청', desc: '거짓말·연기·변장 +2'},
  {name: '강심장', desc: '공포·위압·유혹 버티기 +2'},
  {name: '강골', desc: '최대 HP +4'},
  {name: '행운아', desc: '카드 뽑기와 운에 맡기는 굴림 +3'},
];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function Swatches({label, colors, value, onChange}: {label: string; colors: string[]; value: string; onChange: (c: string) => void}) {
  return (
    <VStack gap={1}>
      <Text type="supporting" color="secondary">{label}</Text>
      <HStack gap={1} wrap="wrap">
        {colors.map(color => (
          <button
            key={color}
            type="button"
            className="rp-swatch"
            style={{background: color}}
            aria-label={`${label} ${color}`}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
          />
        ))}
      </HStack>
    </VStack>
  );
}

function Row({label, hint, options, value, onChange}: {label: string; hint?: string; options: string[]; value: string; onChange: (v: string) => void}) {
  return (
    <div className="rp-row">
      <VStack gap={0.5}>
        <Text type="label">{label}</Text>
        {hint && <Text type="supporting" color="secondary">{hint}</Text>}
      </VStack>
      <SegmentedControl label={label} value={value} onChange={onChange}>
        {options.map(o => (
          <SegmentedControlItem key={o} value={o} label={o} />
        ))}
      </SegmentedControl>
    </div>
  );
}

function Part({title, note, children}: {title: string; note?: string; children: React.ReactNode}) {
  return (
    <Card>
      <VStack gap={3}>
        <VStack gap={0.5}>
          <Heading level={3}>{title}</Heading>
          {note && <Text type="supporting" color="secondary">{note}</Text>}
        </VStack>
        {children}
      </VStack>
    </Card>
  );
}

function Update() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{done?: string[]; error?: string} | null>(null);
  // 직접 눌러서 확인했을 때만 결과를 글로 알려 준다
  const [asked, setAsked] = useState(false);
  const check = (fresh: boolean) =>
    void fetchUpdate(fresh).then(
      found => {
        setInfo(found);
        setAsked(fresh);
      },
      () => {},
    );
  useEffect(() => check(false), []);
  const run = async () => {
    setBusy(true);
    try {
      const res = await applyUpdate();
      setResult(res);
      // 서버가 새 코드로 다시 뜰 시간을 준 뒤 새 패널을 불러온다
      if (!res.error) setTimeout(() => location.reload(), 2500);
    } catch {
      setResult({error: '서버가 응답하지 않아. 잠시 뒤에 새로 고쳐 봐.'});
    }
    setBusy(false);
  };

  if (result?.error) return <Banner status="error" title="업데이트하지 못했어" description={result.error} collapsible={false} />;
  if (result) return <Banner status="success" title="업데이트 완료" description={`${result.done?.join(' · ')}. 곧 화면을 새로 불러와.`} collapsible={false} />;
  if (!info) return null;
  if (!info.behind) {
    return (
      <HStack hAlign="end" vAlign="center" gap={2}>
        {asked && (
          <Text type="supporting" color="secondary">
            {info.checked ? '지금이 최신 버전이야' : '확인하지 못했어. 인터넷 연결을 확인해 줘'}
          </Text>
        )}
        <Button size="sm" variant="ghost" label="업데이트 확인" onClick={() => check(true)} />
      </HStack>
    );
  }
  return (
    <Banner
      status="info"
      title={`새 버전이 있어 (변경 ${info.behind}개)`}
      description={info.notes.join(' / ')}
      collapsible={false}
      endContent={<Button variant="primary" size="sm" label={busy ? '받는 중…' : '업데이트'} isDisabled={busy} onClick={() => void run()} />}
    />
  );
}

export function Lobby() {
  const campaigns = useCampaigns();
  const gm = useGmStatus();
  const away = !!gm && !gm.listening && !gm.busy;
  const [tab, setTab] = useState<string | null>(null);
  const [genre, setGenre] = useState(GENRES[0].name);
  const [tone, setTone] = useState(TONES[0]);
  const [heat, setHeat] = useState(HEAT[1]);
  const [bond, setBond] = useState(BONDS[1]);
  const [ending, setEnding] = useState(ENDINGS[0]);
  const [combat, setCombat] = useState(COMBAT[0]);
  const [hero, setHero] = useState(HERO[0]);
  const [maker, setMaker] = useState('GM에게 맡기기');
  const [gender, setGender] = useState(GENDERS[0]);
  const [look, setLook] = useState({style: 'blade', hair: HAIR[1], skin: SKIN[1], outfit: OUTFIT[0], cut: 'short', skirt: false});
  const [name, setName] = useState('');
  const [concept, setConcept] = useState('');
  const [wish, setWish] = useState('');
  const [stats, setStats] = useState<Record<string, number>>(Object.fromEntries(STATS.map(([s]) => [s, 0])));
  const [traits, setTraits] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const known = useRef<Set<string> | null>(null);

  // 새 게임을 보낸 뒤 GM이 캠페인을 만들고 첫 장면을 올리면 그리로 들어간다
  useEffect(() => {
    if (!campaigns) return;
    if (!sent) known.current = new Set(campaigns.map(c => c.slug));
    else {
      const made = campaigns.find(c => !known.current?.has(c.slug) && c.scene > 0);
      if (made) location.search = `?c=${made.slug}`;
    }
  }, [campaigns, sent]);

  const build = BUILD[tone];
  const fighting = combat === COMBAT[0];
  const offered = TRAITS.filter(t => fighting || !t.combat);
  const spent = STATS.reduce((sum, [s]) => sum + stats[s], 0);
  const bump = (stat: string, by: number) => {
    const next = stats[stat] + by;
    if (next < STAT_MIN || next > build.max || spent + by > build.points) return;
    setStats({...stats, [stat]: next});
  };
  const pickTone = (value: string) => {
    setTone(value);
    // 점수와 상한이 달라지므로 넘치는 배분은 처음으로 돌린다
    const next = BUILD[value];
    if (spent > next.points || STATS.some(([s]) => stats[s] > next.max)) setStats(Object.fromEntries(STATS.map(([s]) => [s, 0])));
    setTraits(traits.slice(0, next.traits));
  };
  const pickCombat = (value: string) => {
    setCombat(value);
    if (value === COMBAT[1]) {
      setLook({...look, style: 'plain'});
      setTraits(traits.filter(t => !TRAITS.find(x => x.name === t)?.combat));
    }
  };
  const pickGender = (value: string) => {
    setGender(value);
    // 고르면 기본 모습만 맞춰 주고, 머리 모양과 하의는 아래에서 따로 바꿀 수 있다
    if (value === '여성') setLook({...look, cut: 'long', skirt: true});
    if (value === '남성') setLook({...look, cut: 'short', skirt: false});
  };
  const randomize = () => {
    const rolled = Object.fromEntries(STATS.map(([s]) => [s, 0]));
    rolled[pick(STATS)[0]] = build.max;
    for (let left = build.points - build.max; left > 0; ) {
      const stat = pick(STATS)[0];
      if (rolled[stat] < build.max) {
        rolled[stat] += 1;
        left -= 1;
      }
    }
    setStats(rolled);
    setTraits([...offered].sort(() => Math.random() - 0.5).slice(0, build.traits).map(t => t.name));
    setLook({
      style: fighting ? pick(STYLES)[0] : 'plain',
      hair: pick(HAIR),
      skin: pick(SKIN),
      outfit: pick(OUTFIT),
      cut: gender === '여성' ? pick(['bob', 'long', 'tail']) : gender === '남성' ? 'short' : pick(CUTS)[0],
      skirt: gender === '여성' && Math.random() < 0.5,
    });
  };
  const start = async () => {
    const form: Record<string, string> = {장르: genre, 분위기: tone, '판정 난이도': heat, '관계 서사': bond, 결말: ending, 전투: combat, 주인공: hero, 성별: gender};
    if (maker === 'GM에게 맡기기') form.캐릭터 = `GM이 만든다 (능력치 ${build.points}점, 특성 ${build.traits}개)`;
    else {
      form['캐릭터 이름'] = name;
      form['캐릭터 설정'] = concept;
      form.능력치 = STATS.map(([s]) => `${s} ${signed(stats[s])}`).join(', ') + (spent < build.points ? ` (남은 ${build.points - spent}점은 GM이 배분)` : '');
      form.특성 = traits.join(', ') || `GM이 ${build.traits}개 고른다`;
      form['외형(pc.look 에 그대로 넣는다)'] = JSON.stringify(look);
    }
    form['추가 요청'] = wish;
    await act({kind: 'new', form});
    setSent(true);
  };

  if (sent) {
    return (
      <VStack gap={4} hAlign="center" paddingBlock={10}>
        <Spinner size="xl" />
        <Heading level={2}>GM이 세계를 짓는 중</Heading>
        <Text color="secondary">첫 장면이 준비되면 자동으로 넘어가. 1분쯤 걸려.</Text>
        {away && (
          <Banner status="warning" title="GM이 듣고 있지 않아" description="채팅 창에 /rp 라고 보내면 GM이 깨어나서 이 요청을 받아." collapsible={false} />
        )}
      </VStack>
    );
  }
  if (!campaigns) return <VStack hAlign="center" paddingBlock={10}><Spinner size="xl" /></VStack>;

  const shown = tab ?? (campaigns.length ? 'continue' : 'new');
  return (
    <VStack gap={5}>
      <VStack gap={1}>
        <Heading level={1} type="display-3">방구석 GM</Heading>
        <Text color="secondary">이야기는 이 화면에서 읽고, 행동도 여기서 입력해. GM은 채팅 창 뒤에서 판을 굴려.</Text>
      </VStack>

      <Update />

      {away && (
        <Banner
          status="info"
          title="GM이 아직 자리에 없어"
          description="Claude 채팅 창에 /rp 라고 보내면 GM이 깨어나. 그 뒤로는 이 화면만 보고 플레이하면 돼."
          collapsible={false}
        />
      )}

      <TabList value={shown} onChange={setTab} hasDivider>
        {campaigns.length > 0 && <Tab value="continue" label="내 게임" />}
        <Tab value="new" label="새 게임" />
        <Tab value="help" label="처음이라면" />
      </TabList>

      {shown === 'continue' && (
          <Grid columns={{minWidth: 260}} gap={3}>
            {campaigns.map(c => (
              <ClickableCard
                key={c.slug}
                label={`${c.title} 열기`}
                onClick={() => (location.search = `?h=${c.slug}`)}>
                <VStack gap={1}>
                  <Heading level={3}>{c.title}</Heading>
                  <Text color="secondary">
                    {c.genre} · {c.pc}
                    {c.grade ? ` (${c.grade}급)` : ''}
                  </Text>
                  <Text type="supporting" color="secondary">{[c.time, c.place].filter(Boolean).join(' · ')}</Text>
                  {c.ending && <Badge variant={endingTone(c.ending)} label={`${ENDING_LABEL[c.ending.kind]} · ${c.ending.title}`} />}
                </VStack>
              </ClickableCard>
            ))}
          </Grid>
      )}

      {shown === 'new' && (
        <VStack gap={4}>
          <Part title="이야기" note="장르만 고르고 맨 아래 시작을 눌러도 돼. 나머지는 기본값으로 가.">
            <Grid columns={{minWidth: 200}} gap={2}>
              {GENRES.map(g => (
                <SelectableCard key={g.name} label={g.name} isSelected={genre === g.name} onChange={() => setGenre(g.name)}>
                  <VStack gap={0.5}>
                    <Text type="label">{g.name}</Text>
                    <Text type="supporting" color="secondary">{g.hook}</Text>
                  </VStack>
                </SelectableCard>
              ))}
            </Grid>
            <div>
              <Row label="분위기" hint="사이다는 시작부터 강하고 성장이 빨라. 하드코어는 빠듯해" options={TONES} value={tone} onChange={pickTone} />
              <Row label="판정 난이도" hint="매울수록 실패가 잦고 대가가 커" options={HEAT} value={heat} onChange={setHeat} />
              <Row label="관계 서사" hint="동료·라이벌과의 유대와 감정선의 비중" options={BONDS} value={bond} onChange={setBond} />
            </div>
          </Part>

          <Part title="진행 방식" note="이 셋은 고른 그대로 적용돼. GM이 임의로 바꾸지 않고, 게임 중에는 상태 탭에서 바꿀 수 있어.">
            <div>
              <Row label="결말" hint="엔드리스는 끝없이 이어지고, 원할 때 엔딩을 내 달라고 하면 돼" options={ENDINGS} value={ending} onChange={setEnding} />
              <Row label="전투" hint="미사용이면 어느 장르든 싸움 없이 대화·조사·관계로 풀어 가" options={COMBAT} value={combat} onChange={pickCombat} />
              <Row label="주인공" hint="GM이 연기는 내 캐릭터의 대사와 행동도 GM이 써 줘. 큰 결정은 그래도 내가 해" options={HERO} value={hero} onChange={setHero} />
            </div>
          </Part>

          <Part title="캐릭터">
            <div>
              <Row label="만드는 사람" hint="맡기면 이름·성격·능력치·특성·외형을 GM이 장르에 맞춰 만들어" options={['GM에게 맡기기', '직접 만들기']} value={maker} onChange={setMaker} />
              <Row label="성별" options={GENDERS} value={gender} onChange={pickGender} />
            </div>

            {maker === '직접 만들기' && (
              <VStack gap={5}>
                <HStack hAlign="end">
                  <Button size="sm" label="🎲 능력치·특성·외형 무작위로" onClick={randomize} />
                </HStack>
                <TextInput label="이름" value={name} onChange={setName} placeholder="비워 두면 GM이 짓는다" />
                <TextArea
                  label="어떤 사람인가"
                  rows={2}
                  value={concept}
                  onChange={setConcept}
                  placeholder="예: 빚에 쫓기는 전직 물류센터 반장. 말수가 적고 실리를 따진다."
                />

                <VStack gap={2}>
                  <HStack hAlign="between" vAlign="center">
                    <Text type="label">능력치</Text>
                    <Text color="secondary" hasTabularNumbers>남은 점수 {build.points - spent} / {build.points} · HP {10 + stats.체력 * 2 + (traits.includes('강골') ? 4 : 0)}</Text>
                  </HStack>
                  <Grid columns={{minWidth: 200}} gap={2}>
                    {STATS.map(([s, what]) => (
                      <Card key={s} variant="muted" padding={2}>
                        <HStack hAlign="between" vAlign="center" gap={2}>
                          <Button size="sm" label="−" isDisabled={stats[s] <= STAT_MIN} onClick={() => bump(s, -1)} />
                          <VStack gap={0} hAlign="center">
                            <Text type="label">{s} <Text type="large" hasTabularNumbers>{signed(stats[s])}</Text></Text>
                            <Text type="supporting" color="secondary">{what}</Text>
                          </VStack>
                          <Button size="sm" label="+" isDisabled={stats[s] >= build.max || spent >= build.points} onClick={() => bump(s, 1)} />
                        </HStack>
                      </Card>
                    ))}
                  </Grid>
                  <Text type="supporting" color="secondary">
                    판정은 d20에 능력치를 더해 난이도 이상이면 성공이야. {tone}은 {build.points}점을 각 {signed(STAT_MIN)}~{signed(build.max)}로 나눠. 0 아래로 깎으면 그만큼 다른 데 더 줄 수 있어.
                  </Text>
                </VStack>

                <VStack gap={2}>
                  <HStack hAlign="between" vAlign="center">
                    <Text type="label">특성</Text>
                    <Text color="secondary" hasTabularNumbers>{traits.length} / {build.traits}</Text>
                  </HStack>
                  <Grid columns={{minWidth: 200}} gap={2}>
                    {offered.map(t => {
                      const on = traits.includes(t.name);
                      return (
                        <VStack key={t.name} gap={0.5} hAlign="start">
                          <ToggleButton
                            size="sm"
                            label={t.name}
                            isPressed={on}
                            isDisabled={!on && traits.length >= build.traits}
                            onPressedChange={() => setTraits(on ? traits.filter(x => x !== t.name) : [...traits, t.name])}
                          />
                          <Text type="supporting" color="secondary">{t.desc}</Text>
                        </VStack>
                      );
                    })}
                  </Grid>
                </VStack>

                <VStack gap={2}>
                  <Text type="label">외형</Text>
                  <HStack gap={4} vAlign="start" wrap="wrap">
                    <PixelAvatar look={look} size={112} />
                    <VStack gap={3}>
                      <HStack gap={3} wrap="wrap">
                        {fighting && (
                          <SegmentedControl label="무기" value={look.style} onChange={style => setLook({...look, style})}>
                            {STYLES.map(([value, label]) => (
                              <SegmentedControlItem key={value} value={value} label={label} />
                            ))}
                          </SegmentedControl>
                        )}
                        <SegmentedControl label="머리 모양" value={look.cut} onChange={cut => setLook({...look, cut})}>
                          {CUTS.map(([value, label]) => (
                            <SegmentedControlItem key={value} value={value} label={label} />
                          ))}
                        </SegmentedControl>
                        <SegmentedControl label="하의" value={look.skirt ? 'skirt' : 'pants'} onChange={v => setLook({...look, skirt: v === 'skirt'})}>
                          <SegmentedControlItem value="pants" label="바지" />
                          <SegmentedControlItem value="skirt" label="치마" />
                        </SegmentedControl>
                      </HStack>
                      <Swatches label={look.style === 'tank' ? '투구·머리' : '머리'} colors={HAIR} value={look.hair} onChange={hair => setLook({...look, hair})} />
                      <Swatches label="피부" colors={SKIN} value={look.skin} onChange={skin => setLook({...look, skin})} />
                      <Swatches label="옷" colors={OUTFIT} value={look.outfit} onChange={outfit => setLook({...look, outfit})} />
                    </VStack>
                  </HStack>
                </VStack>
              </VStack>
            )}
          </Part>

          <TextArea
            label="GM에게 추가 요청"
            isOptional
            rows={2}
            value={wish}
            onChange={setWish}
            placeholder="보고 싶은 전개, 피하고 싶은 것, 참고할 작품 분위기 등"
          />
          <HStack hAlign="end">
            <Button variant="primary" size="lg" label="시작" onClick={() => void start()} />
          </HStack>
        </VStack>
      )}

      {shown === 'help' && (
        <ul className="rp-list">
          <li>장면은 눌러서 한 문단씩 넘겨 읽어. 다 읽으면 아래에 입력 칸이 열려.</li>
          <li>하고 싶은 행동을 자유롭게 적으면 돼. 결과가 불확실하면 GM이 판정을 요구하고, 주사위는 네가 직접 굴려.</li>
          <li>실패해도 이야기는 계속돼. 대신 대가를 치러.</li>
          <li>스킬과 소지품은 상태 탭에서 “이번 행동에 쓰기”로 붙일 수 있어.</li>
          <li>결말·전투·주인공 설정은 게임 중에도 상태 탭 맨 아래에서 바꿀 수 있어.</li>
          <li>규칙 질문이나 방향 조정 같은 게임 밖 이야기는 Claude 채팅 창에 직접 말하면 돼.</li>
        </ul>
      )}
    </VStack>
  );
}
