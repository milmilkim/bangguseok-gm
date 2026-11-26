#!/usr/bin/env python3
"""RP 패널 도구.

  rp.py start            패널 서버를 띄우고(이미 떠 있으면 그대로) 주소와 캠페인 목록을 출력
  rp.py stop             패널 서버 종료
  rp.py turn <슬러그>    표준 입력의 대본을 장면으로 올리고, 패널 입력이 올 때까지 기다렸다가 출력
  rp.py wait             장면 없이 패널 입력만 기다렸다가 출력
  rp.py publish <슬러그> 장면 없이 state 수정만 패널에 반영
  rp.py answer <슬러그> <종류> [값]   유저가 채팅으로 답한 것을 패널에서 답한 것과 똑같이 처리해 결과를 출력
        action "행동 문장" | roll [강화 번호…] | choice 2 | code 4471 | card 2
  rp.py roll <슬러그> <판정명> <능력치> <난이도>   입력 요청 없이 GM이 바로 굴려 기록. 능력치는 힘, 힘+2, +3 꼴
  rp.py dice [면수]      GM 비공개 굴림 (기본 20)
  rp.py example [슬러그] 예제 캠페인을 내 세이브로 복사 (슬러그 없이 실행하면 목록)

대본 줄 형식 (빈 줄 무시, 아래에 안 걸리면 서술 한 문단):
  @이름 대사                         이름의 공백은 _
  ! 시스템 메시지
  $ 등급 전리품 | 설명               획득 카드
  ^ 큰 제목 | 부제                   전체 화면 연출
  * 대상 -5                          그 줄에서 대상 HP 가 변한다 (전투 연출). + 는 회복. state 의 HP 에도 반영된다
마지막에 유저에게 받을 입력을 하나 둔다 (없으면 자유 행동):
  > 제안                             자유 행동 + 눌러서 채울 수 있는 제안 (0~4줄)
  ?roll 판정명 | 능력치 | 난이도 | 걸린 것     능력치는 힘, 힘+2, 정신-1, +3 꼴
  ?boost 이름 | +7 | 대가            ?roll 뒤에. 유저가 굴리기 전에 켤 수 있는 강화
  ?aim                               ?roll 뒤에. 타이밍 게이지 (맞히면 +2, 빗나가면 -1)
  ?choice A | B | C                  이 중에서만 고른다
  ?timed 10 | A | B                  제한 시간(초) 안에 고른다. 시간 초과도 결과
  ?code 라벨 | 자리수                암호·숫자 입력
  ?cards 라벨 | 3                    뒤집힌 카드 N장 중 한 장
"""
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
DIST = WEB / "dist"
STATE_DIR = ROOT / "ui" / "state"
PORTRAIT_DIR = ROOT / "ui" / "portraits"
LOG_DIR = ROOT / "ui" / "log"
SAVE_DIR = ROOT / "saves"
EXAMPLE_DIR = ROOT / "examples"
RUN = ROOT / ".run"
INBOX = RUN / "inbox.jsonl"
WAITER = RUN / "waiter.json"
TAKEN = RUN / "taken"
# 패널은 state 원본이 아니라 turn/publish 때 찍어 둔 사본을 읽는다.
# GM이 원본을 고치는 도중의 수치가 장면보다 먼저 화면에 새지 않게 하기 위해서다.
PUB = RUN / "pub"
PORT = 4173
HOSTS = {f"localhost:{PORT}", f"127.0.0.1:{PORT}"}
URL = f"http://localhost:{PORT}/"
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
MAX_ROLLS = 30
MAX_TEXT = 2000


def state_path(slug):
    if not SLUG.match(slug or ""):
        raise ValueError(f"잘못된 슬러그: {slug!r}")
    return STATE_DIR / f"{slug}.json"


def shown_path(slug):
    pub = PUB / state_path(slug).name
    return pub if pub.exists() else state_path(slug)


def load_state(slug, shown=False):
    return json.loads((shown_path(slug) if shown else state_path(slug)).read_text(encoding="utf-8"))


def save_state(slug, state, shown=False):
    path = PUB / state_path(slug).name if shown else state_path(slug)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def publish(slug):
    save_state(slug, load_state(slug), shown=True)


# ---------------------------------------------------------------- 대본 파싱

def split(rest, n=None):
    parts = [p.strip() for p in rest.split("|")]
    if n is not None and len(parts) < n:
        raise ValueError(f"칸이 모자람({len(parts)}/{n}): {rest!r}")
    return parts


def stat_mod(expr, stats):
    m = re.fullmatch(r"\s*([^\s+\-\d]*)\s*([+-]\s*\d+)?\s*", expr)
    if not m or not (m.group(1) or m.group(2)):
        raise ValueError(f"능력치를 읽을 수 없음: {expr!r}")
    name, adj = m.group(1), int((m.group(2) or "0").replace(" ", ""))
    if name and name not in stats:
        raise ValueError(f"없는 능력치: {name!r} (있는 것: {', '.join(stats)})")
    return name, stats.get(name, 0) + adj


def parse(text, stats):
    lines, ask, suggestions = [], None, []
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            continue
        if s.startswith("?"):
            kind, _, rest = s[1:].partition(" ")
            if kind == "roll":
                name, stat, dc, *stakes = split(rest, 3)
                label, mod = stat_mod(stat, stats)
                need = int(dc) - mod
                if need <= 3:
                    raise ValueError(f"'{name}' 은 d20 {max(need, 2)} 이상이면 성공한다(난이도 {dc}, 보정 {mod:+d}). "
                                     "굴릴 필요가 없는 판정이다. 판정 없이 성공시키거나, 더 강한 상대·불리한 조건으로 난이도를 올린다")
                ask = {"type": "roll", "name": name, "stat": label, "mod": mod, "dc": int(dc),
                       "stakes": stakes[0] if stakes else "", "boosts": [], "aim": False}
            elif kind in ("boost", "aim"):
                if not ask or ask["type"] != "roll":
                    raise ValueError(f"?{kind} 는 ?roll 뒤에만 쓴다")
                if kind == "aim":
                    ask["aim"] = True
                else:
                    name, mod, *cost = split(rest, 2)
                    ask["boosts"].append({"name": name, "mod": int(mod), "cost": cost[0] if cost else ""})
            elif kind == "choice":
                ask = {"type": "choice", "choices": split(rest, 2)}
            elif kind == "timed":
                seconds, *choices = split(rest, 3)
                ask = {"type": "timed", "seconds": int(seconds), "choices": choices}
            elif kind == "code":
                label, *length = split(rest, 1)
                ask = {"type": "code", "label": label, "length": int(length[0]) if length else 0}
            elif kind == "cards":
                label, *count = split(rest, 1)
                ask = {"type": "cards", "label": label, "count": int(count[0]) if count else 3}
            else:
                raise ValueError(f"모르는 입력 종류: ?{kind}")
        elif s.startswith("> "):
            suggestions.append(s[2:].strip())
        elif ask or suggestions:
            raise ValueError(f"입력 요청(? >) 뒤에는 본문을 쓸 수 없음: {s[:30]!r}")
        elif s.startswith("@"):
            who, _, said = s[1:].partition(" ")
            lines.append({"t": "say", "who": who.replace("_", " "), "text": said})
        elif s.startswith("! "):
            lines.append({"t": "sys", "text": s[2:]})
        elif s.startswith("$ "):
            grade, _, rest = s[2:].partition(" ")
            name, _, desc = rest.partition("|")
            lines.append({"t": "loot", "grade": grade, "name": name.strip(), "text": desc.strip()})
        elif s.startswith("^ "):
            title, _, sub = s[2:].partition("|")
            lines.append({"t": "banner", "text": title.strip(), "sub": sub.strip()})
        elif s.startswith("* "):
            m = re.fullmatch(r"(.+?)\s+([+-]\d+)", s[2:])
            if not m:
                raise ValueError(f"'* 대상 -5' 꼴이어야 함: {s!r}")
            lines.append({"t": "fx", "who": m.group(1), "delta": int(m.group(2))})
        else:
            lines.append({"t": "narr", "text": s})
    if not lines:
        raise ValueError("대본이 비어 있음")
    if ask and suggestions:
        raise ValueError("> 제안은 자유 행동일 때만 쓴다")
    return lines, ask or {"type": "action", "choices": suggestions[:4]}


def apply_fx(state, lines):
    pc = state["pc"]
    enemies = {e["name"]: e for e in state.get("enemies", [])}
    others = {n["name"] for n in state.get("npcs", [])}
    for line in lines:
        if line["t"] != "fx":
            continue
        who, delta = line["who"], line["delta"]
        if who == pc["name"] and pc.get("gauges"):
            g = pc["gauges"][0]
            g["cur"] = max(0, min(g["max"], g["cur"] + delta))
        elif who in enemies:
            e = enemies[who]
            if e.get("max"):
                e["cur"] = max(0, min(e["max"], e.get("cur", e["max"]) + delta))
                if e["cur"] == 0:
                    e["down"] = True
        elif who not in others:
            raise ValueError(f"'* {who}' 의 대상이 state 에 없음 (유저 캐릭터, enemies, npcs 중 하나여야 함)")


def said_line(ask):
    """유저가 그 장면에 어떻게 답했는지 로그에 남길 한 줄."""
    a = (ask or {}).get("answer")
    if not a:
        return ""
    kind = a.get("kind")
    if kind == "action":
        return a.get("text", "") + (f" (사용: {', '.join(a['uses'])})" if a.get("uses") else "")
    if kind == "choice":
        return ask["choices"][a["index"]]
    if kind == "timeout":
        return "(시간 초과)"
    if kind == "code":
        return f"{ask['label']}: {a.get('text', '')}"
    if kind == "card":
        return f"{a['index'] + 1}번째 카드 (운 {a.get('luck')})"
    if kind == "roll":
        r = a["roll"]
        verdict = "대성공" if r["d20"] == 20 else "대실패" if r["d20"] == 1 else "성공" if r["success"] else "실패"
        return f"🎲 {r['name']}: {r['d20']} → 합계 {r['total']} / 난이도 {r['dc']} · {verdict}"
    return ""


def log_scene(slug, state):
    """새 장면으로 덮어쓰기 전에 지금 장면과 유저의 답을 로그 끝에 남긴다."""
    scene = state.get("scene")
    if not scene:
        return
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    entry = {"id": scene["id"], "time": state.get("time", ""), "place": state.get("place", ""),
             "lines": scene["lines"], "said": said_line(state.get("ask"))}
    with (LOG_DIR / f"{slug}.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_log(slug):
    state_path(slug)
    try:
        text = (LOG_DIR / f"{slug}.jsonl").read_text(encoding="utf-8")
    except OSError:
        return []
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def write_turn(slug, text):
    state = load_state(slug)
    lines, ask = parse(text, state["pc"]["stats"])
    # 시간·장소·답은 그 장면이 화면에 떠 있던 때의 값이어야 하므로 패널용 사본에서 읽는다
    log_scene(slug, load_state(slug, shown=True))
    apply_fx(state, lines)
    seq = state.get("scene", {}).get("id", 0) + 1
    state["scene"] = {"id": seq, "lines": lines}
    state["ask"] = {"id": seq, **ask}
    state["rolls"] = state.get("rolls", [])[-MAX_ROLLS:]
    save_state(slug, state)
    save_state(slug, state, shown=True)
    return seq, len(lines), ask["type"]


# ---------------------------------------------------------------- 패널 입력 → GM

_inbox_lock = threading.Lock()


def inbox_push(slug, text):
    RUN.mkdir(exist_ok=True)
    with _inbox_lock, INBOX.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"c": slug, "text": text}, ensure_ascii=False) + "\n")


def inbox_take():
    taken = INBOX.with_suffix(f".{os.getpid()}")
    try:
        os.replace(INBOX, taken)
    except FileNotFoundError:
        return []
    msgs = [json.loads(line) for line in taken.read_text(encoding="utf-8").splitlines() if line.strip()]
    taken.unlink()
    return msgs


def wait_for_input():
    RUN.mkdir(exist_ok=True)
    token = secrets.token_hex(4)
    WAITER.write_text(json.dumps({"token": token, "pid": os.getpid()}))
    # 세션이 죽어 고아가 된 대기는 입력을 가로채지 않도록 스스로 끝낸다 (처음부터 고아로 시작한 경우는 제외)
    born_orphan = os.getppid() == 1
    orphaned = lambda: not born_orphan and os.getppid() == 1
    while True:
        try:
            current = json.loads(WAITER.read_text())["token"]
        except (OSError, ValueError, KeyError):
            current = None
        if current != token:
            # 더 새 대기가 생겼다. 여기서 끝나면 GM이 빈 알림으로 깨어나므로 끝내지 않고 잠든다.
            deadline = time.time() + 12 * 3600
            while time.time() < deadline and not orphaned():
                time.sleep(5)
            return
        msgs = inbox_take()
        if msgs:
            WAITER.unlink(missing_ok=True)
            TAKEN.touch()
            for m in msgs:
                print(f"[패널 입력 · {m['c'] or '로비'}] {m['text']}")
            return
        if orphaned():
            return
        os.utime(WAITER)
        time.sleep(0.4)


def age(path):
    try:
        return time.time() - path.stat().st_mtime
    except OSError:
        return float("inf")


def status():
    # listening: GM이 입력을 기다리는 중 / busy: 입력을 받아 가서 다음 장면을 쓰는 중 / pending: 아직 아무도 안 가져간 입력이 있음
    listening = age(WAITER) < 5
    return {"listening": listening, "busy": not listening and age(TAKEN) < 300,
            "pending": INBOX.exists() and INBOX.stat().st_size > 0}


def clip(value, limit=MAX_TEXT):
    return " ".join(str(value or "").split())[:limit]


def roll_dice(state, name, mod, dc, bonus=()):
    """d20 을 굴려 state 의 rolls 에 기록하고 (기록, 한 줄 요약) 을 돌려준다."""
    d20 = secrets.randbelow(20) + 1
    total = d20 + mod + sum(b["mod"] for b in bonus)
    # 1은 합계와 무관하게 실패, 20은 합계와 무관하게 성공
    success = d20 == 20 or (d20 != 1 and total >= dc)
    rolls = state.setdefault("rolls", [])
    roll = {"id": (rolls[-1]["id"] + 1) if rolls else 1, "name": name, "d20": d20, "mod": mod, "bonus": list(bonus),
            "total": total, "dc": dc, "success": success, "at": state.get("time", "")}
    rolls.append(roll)
    del rolls[:-MAX_ROLLS]
    verdict = "대성공" if d20 == 20 else "대실패" if d20 == 1 else "성공" if success else "실패"
    extra = "".join(f" {b['mod']:+d}({b['label']})" for b in bonus)
    return roll, f"{name}: d20={d20} {mod:+d}{extra} = {total} / 난이도 {dc} → {verdict}"


def answer(body, from_chat=False):
    """입력 하나를 처리해 (HTTP 상태, 응답) 을 돌려준다. 패널에서 왔으면 대기 중인 GM에게 넘기고,
    from_chat 이면 GM이 이미 깨어 있으므로 넘기지 않고 응답에 요약(msg)만 담는다."""
    kind = body.get("kind")
    if kind == "new":
        form = body.get("form") or {}
        fields = [f"{k}: {clip(v, 400)}" for k, v in form.items() if clip(v)]
        inbox_push(None, "[새 게임] " + " / ".join(fields))
        return 200, {"ok": True}
    slug = body.get("c")
    try:
        state = load_state(slug, shown=True)
    except (ValueError, OSError):
        return 404, {"error": "없는 캠페인"}
    if kind == "continue":
        inbox_push(slug, "[이어하기] 이 캠페인을 이어서 한다")
        return 200, {"ok": True}

    ask = state.get("ask") or {}
    if body.get("ask") != ask.get("id") or ask.get("answer"):
        return 409, {"error": "이미 지나간 입력"}
    kinds = {"action": {"action"}, "roll": {"roll"}, "choice": {"choice"}, "timed": {"choice", "timeout"},
             "code": {"code"}, "cards": {"card"}}
    # 채팅에서는 판정이나 선택지가 떠 있어도 다른 행동을 하겠다고 말할 수 있다
    if kind not in kinds.get(ask.get("type"), set()) and not (from_chat and kind == "action"):
        return 400, {"error": f"지금 받을 수 없는 입력 (지금 요청: {ask.get('type')})"}

    if kind == "action":
        text = clip(body.get("text"))
        if not text:
            return 400, {"error": "빈 입력"}
        uses = [clip(u, 40) for u in (body.get("uses") or [])[:6]]
        said = {"kind": kind, "text": text, "uses": uses}
        msg = f"[행동] {text}" + (f" (사용: {', '.join(uses)})" if uses else "")
    elif kind == "choice":
        i = body.get("index")
        if not isinstance(i, int) or not 0 <= i < len(ask["choices"]):
            return 400, {"error": "없는 선택지"}
        said = {"kind": kind, "index": i}
        msg = f"[선택] {i + 1}번 \"{ask['choices'][i]}\""
    elif kind == "timeout":
        said = {"kind": kind}
        msg = f"[시간 초과] {ask['seconds']}초 안에 고르지 못했다"
    elif kind == "code":
        text = clip(body.get("text"), 60)
        said = {"kind": kind, "text": text}
        msg = f"[입력] {ask['label']}: {text}"
    elif kind == "card":
        i = body.get("index")
        if not isinstance(i, int) or not 0 <= i < ask["count"]:
            return 400, {"error": "없는 카드"}
        said = {"kind": kind, "index": i, "luck": secrets.randbelow(20) + 1}
        msg = f"[카드] {ask['count']}장 중 {i + 1}번째를 뒤집었다 (운 d20={said['luck']})"
    else:
        picked = sorted({i for i in body.get("boosts") or [] if isinstance(i, int) and 0 <= i < len(ask["boosts"])})
        bonus = [{"label": ask["boosts"][i]["name"], "mod": ask["boosts"][i]["mod"]} for i in picked]
        aim = body.get("aim")
        if ask["aim"] and aim in (-1, 0, 1, 2) and aim:
            bonus.append({"label": "조준", "mod": aim})
        roll, text = roll_dice(state, ask["name"], ask["mod"], ask["dc"], bonus)
        said = {"kind": kind, "roll": roll}
        costs = [f"{ask['boosts'][i]['name']}(대가: {ask['boosts'][i]['cost'] or '없음'})" for i in picked]
        msg = f"[판정] {text}" + (f" · 사용한 강화: {', '.join(costs)}" if costs else "")

    ask["answer"] = said
    save_state(slug, state, shown=True)
    # 원본에도 같은 답을 남긴다 (GM이 그 사이 고친 다른 내용은 건드리지 않는다)
    source = load_state(slug)
    if source.get("ask", {}).get("id") == ask["id"]:
        source["ask"]["answer"] = said
        if kind == "roll":
            source.setdefault("rolls", []).append(said["roll"])
        save_state(slug, source)
    if from_chat:
        return 200, {"ok": True, "msg": msg}
    inbox_push(slug, msg)
    return 200, {"ok": True, **said}


def campaigns():
    out = []
    for path in sorted(STATE_DIR.glob("*.json"), key=lambda p: -p.stat().st_mtime):
        try:
            s = json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            continue
        pc = s.get("pc", {})
        out.append({"slug": path.stem, "title": s.get("title", path.stem), "genre": s.get("genre", ""),
                    "time": s.get("time", ""), "place": s.get("place", ""), "pc": pc.get("name", ""),
                    "grade": pc.get("grade", ""), "scene": s.get("scene", {}).get("id", 0)})
    return out


# ---------------------------------------------------------------- 서버

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def local_only(self):
        # 다른 사이트가 이 서버로 입력을 밀어 넣으면 GM 세션에 그대로 들어가므로 Host·Origin 을 확인한다
        if self.headers.get("Host") not in HOSTS:
            self.send_json(403, {"error": "forbidden"})
            return False
        return True

    def translate_path(self, path):
        rel = unquote(urlparse(path).path).lstrip("/")
        if rel.startswith("state/") and SLUG.match(rel[6:-5]) and rel.endswith(".json"):
            return str(shown_path(rel[6:-5]))
        if rel.startswith("portraits/"):
            target = (PORTRAIT_DIR / rel[10:]).resolve()
            return str(target) if PORTRAIT_DIR.resolve() in target.parents else str(DIST / "__missing__")
        if rel.startswith("state/"):
            return str(DIST / "__missing__")
        target = (DIST / rel).resolve()
        if DIST.resolve() not in target.parents or not target.is_file():
            target = DIST / "index.html"
        return str(target)

    def do_GET(self):
        if not self.local_only():
            return
        path = urlparse(self.path).path
        if path == "/api/campaigns":
            return self.send_json(200, campaigns())
        if path == "/api/status":
            return self.send_json(200, status())
        if path == "/api/log":
            try:
                return self.send_json(200, read_log(parse_qs(urlparse(self.path).query).get("c", [""])[0]))
            except ValueError:
                return self.send_json(404, {"error": "없는 캠페인"})
        super().do_GET()

    def do_POST(self):
        if not self.local_only():
            return
        origin = self.headers.get("Origin", "")
        if urlparse(self.path).path != "/api/act" or urlparse(origin).netloc not in HOSTS \
                or "application/json" not in self.headers.get("Content-Type", ""):
            return self.send_json(403, {"error": "forbidden"})
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= 16384:
            return self.send_json(413, {"error": "too large"})
        try:
            body = json.loads(self.rfile.read(length))
            status, data = answer(body if isinstance(body, dict) else {})
        except (ValueError, KeyError, TypeError) as e:
            status, data = 400, {"error": str(e)}
        self.send_json(status, data)


def serve():
    RUN.mkdir(exist_ok=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


def server_up():
    try:
        with urllib.request.urlopen(URL + "api/status", timeout=1) as r:
            return r.status == 200
    except OSError:
        return False


def start():
    if not (DIST / "index.html").is_file():
        print("패널을 처음 빌드하는 중 (1분쯤 걸림)…", flush=True)
        subprocess.run("npm install && npm run build", shell=True, cwd=WEB, check=True, stdout=subprocess.DEVNULL)
    if not server_up():
        RUN.mkdir(exist_ok=True)
        with (RUN / "server.log").open("ab") as log:
            subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "serve"], stdout=log, stderr=log,
                             stdin=subprocess.DEVNULL, start_new_session=True)
        for _ in range(50):
            if server_up():
                break
            time.sleep(0.1)
        else:
            sys.exit(f"서버가 뜨지 않음. {RUN / 'server.log'} 확인")
    # 패널용 사본이 없는 세이브는 지금 상태로 찍어 둔다. 이후 원본 수정은 turn/publish 전까지 화면에 안 보인다.
    for path in STATE_DIR.glob("*.json"):
        if SLUG.match(path.stem) and not (PUB / path.name).exists():
            publish(path.stem)
    print(f"패널: {URL}")
    for c in campaigns():
        print(f"  세이브 {c['slug']}: {c['title']} ({c['genre']}) · {c['pc']} · {c['time']} {c['place']}  → {URL}?c={c['slug']}")


def stop():
    out = subprocess.run(["lsof", "-ti", f"tcp:{PORT}", "-sTCP:LISTEN"], capture_output=True, text=True).stdout.split()
    for pid in out:
        os.kill(int(pid), 15)
    print("서버 종료" if out else "떠 있는 서버 없음")


def main(argv):
    cmd, args = (argv[0], argv[1:]) if argv else ("", [])
    if cmd == "serve":
        serve()
    elif cmd == "start":
        start()
    elif cmd == "stop":
        stop()
    elif cmd == "turn" and len(args) == 1:
        try:
            seq, n, kind = write_turn(args[0], sys.stdin.read())
        except (ValueError, OSError, KeyError) as e:
            sys.exit(f"대본 오류, 장면을 올리지 않음: {e}")
        print(f"장면 #{seq} 올림 ({n}줄, 입력: {kind}). 패널 입력 대기 중…", flush=True)
        wait_for_input()
    elif cmd == "wait":
        wait_for_input()
    elif cmd == "publish" and len(args) == 1:
        publish(args[0])
        print("패널에 반영함")
    elif cmd == "answer" and len(args) >= 2:
        slug, kind, rest = args[0], args[1], args[2:]
        try:
            body = {"c": slug, "kind": kind, "ask": load_state(slug, shown=True).get("ask", {}).get("id")}
            if kind == "action":
                body["text"] = " ".join(rest)
            elif kind == "roll":
                body["boosts"] = [int(n) - 1 for n in rest]
            elif kind in ("choice", "card"):
                body["index"] = int(rest[0]) - 1
            elif kind == "code":
                body["text"] = " ".join(rest)
            status, data = answer(body, from_chat=True)
        except (ValueError, OSError, KeyError, IndexError) as e:
            sys.exit(f"처리하지 못함: {e}")
        if status != 200:
            sys.exit(f"처리하지 못함: {data.get('error')}")
        print(f"[채팅 입력 · {slug}] {data['msg']}")
    elif cmd == "roll" and len(args) == 4:
        try:
            state = load_state(args[0])
            _, text = roll_dice(state, args[1], stat_mod(args[2], state["pc"]["stats"])[1], int(args[3]))
        except (ValueError, OSError, KeyError) as e:
            sys.exit(f"굴리지 못함: {e}")
        save_state(args[0], state)
        print(text)
    elif cmd == "example":
        if not args:
            for d in sorted(EXAMPLE_DIR.iterdir()):
                state = json.loads((d / "state.json").read_text(encoding="utf-8"))
                print(f"{d.name}: {state['title']} ({state.get('genre', '')})")
            return
        state_path(args[0])
        src = EXAMPLE_DIR / args[0]
        targets = {"state.json": STATE_DIR / f"{args[0]}.json", "save.md": SAVE_DIR / f"{args[0]}.md", "log.jsonl": LOG_DIR / f"{args[0]}.jsonl"}
        if not (src / "state.json").is_file():
            sys.exit(f"없는 예제: {args[0]}")
        if any(t.exists() for t in targets.values()):
            sys.exit(f"이미 같은 이름의 세이브가 있어서 덮어쓰지 않음: {args[0]}")
        for name, target in targets.items():
            if (src / name).is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((src / name).read_bytes())
        print(f"예제 '{args[0]}' 를 가져옴. /rp 로 이어서 하면 된다")
    elif cmd == "dice":
        sides = int(args[0]) if args else 20
        print(f"🎲 d{sides} = {secrets.randbelow(sides) + 1}")
    else:
        sys.exit(__doc__)


def selfcheck():
    stats = {"힘": 3, "민첩": 0}
    lines, ask = parse("서술.\n@오_영감 젊은 놈이.\n! 조건 충족\n$ C 독샘 | 따뜻하다\n^ 승급 | E → D\n* 녹거미 -5\n"
                       "?roll 힘 판정 | 힘+2 | 16 | 방패가 날아간다\n?boost 일곱 몫 | +7 | HP 1\n?aim", stats)
    assert [l["t"] for l in lines] == ["narr", "say", "sys", "loot", "banner", "fx"], lines
    assert lines[1]["who"] == "오 영감" and lines[5] == {"t": "fx", "who": "녹거미", "delta": -5}
    assert ask["mod"] == 5 and ask["dc"] == 16 and ask["aim"] and ask["boosts"][0]["mod"] == 7, ask
    assert parse("가.\n> 문을 연다\n> 돌아간다", stats)[1] == {"type": "action", "choices": ["문을 연다", "돌아간다"]}
    assert parse("가.\n?timed 10 | 뛴다 | 숨는다", stats)[1]["seconds"] == 10
    try:
        parse("가.\n?roll 쉬운 일 | 힘 | 6", stats)
        raise AssertionError("너무 쉬운 판정이 통과함")
    except ValueError:
        pass
    assert stat_mod("+3", stats) == ("", 3) and stat_mod("민첩-2", stats) == ("민첩", -2)
    st = {"pc": {"name": "나", "gauges": [{"label": "HP", "cur": 5, "max": 10}]},
          "enemies": [{"name": "거미", "cur": 4, "max": 9}], "npcs": [{"name": "가을"}]}
    apply_fx(st, [{"t": "fx", "who": "거미", "delta": -6}, {"t": "fx", "who": "나", "delta": 9}, {"t": "fx", "who": "가을", "delta": -1}])
    assert st["enemies"][0] == {"name": "거미", "cur": 0, "max": 9, "down": True} and st["pc"]["gauges"][0]["cur"] == 10
    try:
        apply_fx(st, [{"t": "fx", "who": "오타", "delta": -1}])
        raise AssertionError("없는 대상이 통과함")
    except ValueError:
        pass
    for bad in ("", "가.\n?roll 힘 | 지능 | 12", "가.\n?aim", "가.\n> 제안\n뒤에 본문", "가.\n* 거미 5"):
        try:
            parse(bad, stats)
            raise AssertionError(f"통과하면 안 됨: {bad!r}")
        except ValueError:
            pass
    print("selfcheck ok")


if __name__ == "__main__":
    selfcheck() if sys.argv[1:] == ["selfcheck"] else main(sys.argv[1:])
