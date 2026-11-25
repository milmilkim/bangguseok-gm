# rp

Claude Code 채팅으로 진행하는 텍스트 RPG. GM 규칙은 스킬에, 화면은 고정 패널에 있다.

- `skill/SKILL.md`: `/rp` 스킬 본문
- `ui/index.html`: 상태창·인물·단서·기록·판정 패널. `ui/state/<슬러그>.json` 을 2초마다 다시 읽는다
- `roll.py`: d20 판정을 굴려 state에 기록한다
- `scene.py`: 대본(서술·대사·시스템 메시지·굴림·전리품 카드·승급 연출)을 state에 써서 장면 탭에서 한 줄씩 넘겨 보게 한다
- `saves/<슬러그>.md`: 재개 지점과 GM 전용 내용 (스포일러)

## 다른 컴퓨터에 설치

스킬이 `~/personal/rp` 경로를 그대로 쓰므로 같은 위치에 받는다.

```bash
git clone https://github.com/milmilkim/rp.git ~/personal/rp
mkdir -p ~/.claude/skills/rp
cp ~/personal/rp/skill/SKILL.md ~/.claude/skills/rp/SKILL.md
```

스킬을 고치면 `skill/SKILL.md` 에도 복사해서 커밋한다.

## 패널만 띄우기

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory ~/personal/rp/ui
```

`http://localhost:4173/?c=cheongun-3jo`
