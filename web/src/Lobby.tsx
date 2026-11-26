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
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {VStack} from '@astryxdesign/core/VStack';
import {act, applyUpdate, fetchUpdate, useCampaigns, useGmStatus} from './api';
import type {UpdateInfo} from './api';
import {ENDING_LABEL, signed} from './Ask';
import {PixelAvatar} from './PixelAvatar';
import {HAIR, OUTFIT, SKIN} from './sprites';
import {OPTIONS} from './types';
import type {Campaign, Ending} from './types';

const GENRES = [
  {name: '헌터물', hook: '게이트, 등급, 스킬. 밑바닥에서 치고 올라가는 성장물.'},
  {name: '크툴루 호러', hook: '알면 안 되는 것을 조사한다. 싸우기보다 도망치고 버틴다.'},
  {name: '던전 탐험', hook: '횃불과 식량을 아끼며 깊이 내려간다. 지도와 함정, 전리품.'},
  {name: '무협', hook: '문파와 은원, 내공과 초식. 강호에 이름을 새긴다.'},
  {name: '로판', hook: '황실과 가문, 아카데미. 회귀·빙의·계약으로 판을 뒤집는다.'},
  {name: '미스터리', hook: '사건과 단서, 용의자. 흩어진 조각을 맞춰 범인을 지목한다.'},
  {name: 'GM에게 맡김', hook: '아래 요청 칸에 원하는 걸 적거나, 비워 두면 GM이 고른다.'},
];
const TONES = ['사이다 성장', '정통 모험', '하드코어'];
const HEAT = ['순한맛', '보통', '매운맛'];
const BONDS = ['없이', '은은하게', '진하게'];
const {결말: ENDINGS, 전투: COMBAT, 주인공: HERO} = OPTIONS;
const STYLES = [
  ['blade', '검'],
  ['tank', '방패'],
  ['caster', '술사'],
  ['plain', '맨손'],
];

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
const STATS = ['힘', '민첩', '지능', '정신'];
const POINTS = 4;

function Pick({label, hint, options, value, onChange}: {label: string; hint?: string; options: string[]; value: string; onChange: (v: string) => void}) {
  return (
    <VStack gap={1}>
      <Text type="label">{label}</Text>
      {hint && <Text type="supporting" color="secondary">{hint}</Text>}
      <SegmentedControl label={label} value={value} onChange={onChange}>
        {options.map(o => (
          <SegmentedControlItem key={o} value={o} label={o} />
        ))}
      </SegmentedControl>
    </VStack>
  );
}

const endingTone = (e: Ending) => (e.kind === 'bad' ? 'error' : e.kind === 'normal' ? 'neutral' : 'success');

function Endings({campaigns}: {campaigns: Campaign[]}) {
  // 2회차는 series 로 첫 캠페인에 묶여서 한 이야기의 결말로 같이 센다
  const groups = new Map<string, {title: string; seen: Map<string, Ending>}>();
  for (const c of campaigns) {
    if (!c.ending) continue;
    const key = c.series || c.slug;
    const group = groups.get(key) ?? {title: campaigns.find(x => x.slug === key)?.title ?? c.title, seen: new Map()};
    group.seen.set(c.ending.title, c.ending);
    groups.set(key, group);
  }
  if (!groups.size) return null;
  return (
    <VStack gap={3}>
      <Heading level={2}>본 엔딩</Heading>
      {[...groups.entries()].map(([key, group]) => {
        const seen = [...group.seen.values()];
        const total = Math.max(...seen.map(e => e.total ?? 0));
        return (
          <Card key={key} variant="muted">
            <VStack gap={2}>
              <HStack hAlign="between" vAlign="center">
                <Text type="label">{group.title}</Text>
                <Text color="secondary" hasTabularNumbers>{total ? `${seen.length}/${total}` : `${seen.length}개`}</Text>
              </HStack>
              <HStack gap={1} wrap="wrap">
                {seen.map(e => (
                  <Badge key={e.title} variant={endingTone(e)} label={`${ENDING_LABEL[e.kind]} · ${e.title}`} />
                ))}
              </HStack>
            </VStack>
          </Card>
        );
      })}
    </VStack>
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
  const [genre, setGenre] = useState(GENRES[0].name);
  const [tone, setTone] = useState(TONES[0]);
  const [heat, setHeat] = useState(HEAT[1]);
  const [bond, setBond] = useState(BONDS[1]);
  const [ending, setEnding] = useState(ENDINGS[0]);
  const [combat, setCombat] = useState(COMBAT[0]);
  const [hero, setHero] = useState(HERO[0]);
  const [gender, setGender] = useState('남성');
  const [look, setLook] = useState({style: 'blade', hair: HAIR[1], skin: SKIN[1], outfit: OUTFIT[0], cut: 'short', skirt: false});
  const [name, setName] = useState('');
  const [concept, setConcept] = useState('');
  const [wish, setWish] = useState('');
  const [stats, setStats] = useState<Record<string, number>>(Object.fromEntries(STATS.map(s => [s, 1])));
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

  const pickCombat = (value: string) => {
    setCombat(value);
    if (value === COMBAT[1]) setLook({...look, style: 'plain'});
  };
  const spent = STATS.reduce((sum, s) => sum + stats[s], 0);
  const bump = (stat: string, by: number) => {
    const next = stats[stat] + by;
    if (next < -1 || next > 3 || spent + by > POINTS) return;
    setStats({...stats, [stat]: next});
  };
  const start = async (auto: boolean) => {
    const form: Record<string, string> = {장르: genre, 분위기: tone, '판정 난이도': heat, '관계 서사': bond, 결말: ending, 전투: combat, 주인공: hero};
    if (auto) form.캐릭터 = 'GM이 알아서 만든다';
    else {
      form['캐릭터 이름'] = name;
      form.성별 = gender;
      form['캐릭터 설정'] = concept;
      form.능력치 = STATS.map(s => `${s} ${signed(stats[s])}`).join(', ');
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

  return (
    <VStack gap={8}>
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

      {!!campaigns?.length && (
        <VStack gap={3}>
          <Heading level={2}>이어하기</Heading>
          <Grid columns={{minWidth: 260}} gap={3}>
            {campaigns.map(c => (
              <ClickableCard
                key={c.slug}
                label={`${c.title} 이어하기`}
                onClick={async () => {
                  await act({kind: 'continue', c: c.slug});
                  location.search = `?c=${c.slug}`;
                }}>
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
        </VStack>
      )}

      {campaigns && <Endings campaigns={campaigns} />}

      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>새 게임</Heading>
          <Text color="secondary">고르기 귀찮으면 장르만 찍고 맨 아래 “알아서 시작”을 눌러.</Text>
        </VStack>

        <Grid columns={{minWidth: 220}} gap={3}>
          {GENRES.map(g => (
            <SelectableCard key={g.name} label={g.name} isSelected={genre === g.name} onChange={() => setGenre(g.name)}>
              <VStack gap={1}>
                <Text type="label">{g.name}</Text>
                <Text color="secondary">{g.hook}</Text>
              </VStack>
            </SelectableCard>
          ))}
        </Grid>

        <Grid columns={{minWidth: 260}} gap={4}>
          <Pick label="분위기" options={TONES} value={tone} onChange={setTone} />
          <Pick label="판정 난이도" hint="매울수록 실패가 잦고 대가가 크다" options={HEAT} value={heat} onChange={setHeat} />
          <Pick label="관계 서사" hint="동료·라이벌과의 유대와 감정선의 비중" options={BONDS} value={bond} onChange={setBond} />
          <Pick label="결말" hint="엔드리스는 끝없이 이어지고, 원할 때 엔딩을 내 달라고 하면 돼" options={ENDINGS} value={ending} onChange={setEnding} />
          <Pick label="전투" hint="미사용이면 어느 장르든 싸움 없이 대화·조사·관계로 풀어 가" options={COMBAT} value={combat} onChange={pickCombat} />
          <Pick label="주인공" hint="GM이 연기는 내 캐릭터의 대사와 행동도 GM이 살려서 써 줘. 큰 결정은 그래도 내가 해" options={HERO} value={hero} onChange={setHero} />
        </Grid>

        <Card>
          <VStack gap={4}>
            <Heading level={3}>캐릭터</Heading>
            <TextInput label="이름" value={name} onChange={setName} placeholder="비워 두면 GM이 짓는다" />
            <VStack gap={1}>
              <Text type="label">성별</Text>
              <SegmentedControl
                label="성별"
                value={gender}
                onChange={g => {
                  setGender(g);
                  // 고르면 기본 모습만 맞춰 주고, 머리 모양과 하의는 아래에서 따로 바꿀 수 있다
                  if (g === '여성') setLook({...look, cut: 'long', skirt: true});
                  if (g === '남성') setLook({...look, cut: 'short', skirt: false});
                }}>
                <SegmentedControlItem value="남성" label="남성" />
                <SegmentedControlItem value="여성" label="여성" />
                <SegmentedControlItem value="정하지 않음" label="정하지 않음" />
              </SegmentedControl>
            </VStack>
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
                <Text color="secondary">남은 점수 {POINTS - spent}</Text>
              </HStack>
              <Grid columns={{minWidth: 150}} gap={2}>
                {STATS.map(s => (
                  <Card key={s} variant="muted" padding={2}>
                    <HStack hAlign="between" vAlign="center">
                      <Button size="sm" label="−" isDisabled={stats[s] <= -1} onClick={() => bump(s, -1)} />
                      <VStack gap={0} hAlign="center">
                        <Text type="supporting" color="secondary">{s}</Text>
                        <Text type="large" hasTabularNumbers>{signed(stats[s])}</Text>
                      </VStack>
                      <Button size="sm" label="+" isDisabled={stats[s] >= 3 || spent >= POINTS} onClick={() => bump(s, 1)} />
                    </HStack>
                  </Card>
                ))}
              </Grid>
              <Text type="supporting" color="secondary">판정은 d20에 능력치를 더해 난이도 이상이면 성공이야. 각 −1~+3, 합계 +{POINTS}.</Text>
            </VStack>
            <VStack gap={2}>
              <Text type="label">외형</Text>
              <HStack gap={4} vAlign="start" wrap="wrap">
                <PixelAvatar look={look} size={112} />
                <VStack gap={3}>
                  <HStack gap={3} wrap="wrap">
                    <SegmentedControl label="무기" value={look.style} onChange={style => setLook({...look, style})}>
                      {STYLES.map(([value, label]) => (
                        <SegmentedControlItem key={value} value={value} label={label} />
                      ))}
                    </SegmentedControl>
                    <SegmentedControl label="머리 모양" value={look.cut} onChange={cut => setLook({...look, cut})}>
                      <SegmentedControlItem value="short" label="짧은 머리" />
                      <SegmentedControlItem value="bob" label="단발" />
                      <SegmentedControlItem value="long" label="긴 머리" />
                      <SegmentedControlItem value="tail" label="포니테일" />
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
        </Card>

        <TextArea
          label="GM에게 추가 요청"
          isOptional
          rows={2}
          value={wish}
          onChange={setWish}
          placeholder="보고 싶은 전개, 피하고 싶은 것, 참고할 작품 분위기 등"
        />
        <HStack gap={2} hAlign="end">
          <Button label="알아서 시작" onClick={() => void start(true)} />
          <Button variant="primary" label="이 설정으로 시작" onClick={() => void start(false)} />
        </HStack>
      </VStack>

      <Card variant="muted">
        <VStack gap={2}>
          <Heading level={3}>처음이라면</Heading>
          <ul className="rp-list">
            <li>장면은 눌러서 한 문단씩 넘겨 읽어. 다 읽으면 아래에 입력 칸이 열려.</li>
            <li>하고 싶은 행동을 자유롭게 적으면 돼. 결과가 불확실하면 GM이 판정을 요구하고, 주사위는 네가 직접 굴려.</li>
            <li>실패해도 이야기는 계속돼. 대신 대가를 치러.</li>
            <li>스킬과 소지품은 상태 탭에서 “이번 행동에 쓰기”로 붙일 수 있어.</li>
            <li>규칙 질문이나 방향 조정 같은 게임 밖 이야기는 Claude 채팅 창에 직접 말하면 돼.</li>
          </ul>
        </VStack>
      </Card>
    </VStack>
  );
}
