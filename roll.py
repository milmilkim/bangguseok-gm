#!/usr/bin/env python3
"""d20 판정을 굴려 캠페인 state.json 의 rolls 에 기록한다.

사용: roll.py <캠페인-슬러그> <판정명> <보정> <난이도>
"""
import json
import os
import secrets
import sys
import time
from pathlib import Path

STATE_DIR = Path(__file__).parent / "ui" / "state"


def roll(slug, name, mod, dc):
    path = STATE_DIR / f"{slug}.json"
    state = json.loads(path.read_text(encoding="utf-8"))
    d20 = secrets.randbelow(20) + 1
    total = d20 + mod
    # 1은 합계와 무관하게 실패, 20은 합계와 무관하게 성공
    success = d20 == 20 or (d20 != 1 and total >= dc)
    rolls = state.setdefault("rolls", [])
    entry = {
        "id": (rolls[-1]["id"] + 1) if rolls else 1,
        "name": name, "d20": d20, "mod": mod, "total": total, "dc": dc,
        "success": success, "at": state.get("time", time.strftime("%m/%d %H:%M")),
    }
    rolls.append(entry)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    return entry


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    r = roll(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
    tag = "대성공" if r["d20"] == 20 else "대실패" if r["d20"] == 1 else "성공" if r["success"] else "실패"
    print(f"🎲 #{r['id']} {r['name']} d20={r['d20']} {r['mod']:+d} = {r['total']} (난이도 {r['dc']}) → {tag}")
