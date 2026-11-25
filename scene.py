#!/usr/bin/env python3
"""표준 입력의 대본을 캠페인 state.json 의 scene 에 써서 패널 '장면' 탭에서 한 줄씩 넘겨 보게 한다.

사용: scene.py <캠페인-슬러그> < 대본
줄 형식:  @이름 대사 | ! 시스템 메시지 | # 굴림id | 그 외는 서술. 빈 줄은 무시.
"""
import json
import os
import sys
from pathlib import Path

STATE_DIR = Path(__file__).parent / "ui" / "state"


def parse(text):
    lines = []
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            continue
        if s.startswith("@"):
            who, _, said = s[1:].partition(" ")
            lines.append({"t": "say", "who": who.replace("_", " "), "text": said})
        elif s.startswith("! "):
            lines.append({"t": "sys", "text": s[2:]})
        elif s.startswith("# "):
            lines.append({"t": "roll", "roll": int(s[2:])})
        else:
            lines.append({"t": "narr", "text": s})
    return lines


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    path = STATE_DIR / f"{sys.argv[1]}.json"
    state = json.loads(path.read_text(encoding="utf-8"))
    lines = parse(sys.stdin.read())
    assert lines, "대본이 비어 있음"
    state["scene"] = {"id": state.get("scene", {}).get("id", 0) + 1, "lines": lines}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    print(f"scene #{state['scene']['id']}: {len(lines)}줄")
