#!/usr/bin/env python3
"""Control smart bulbs through the Yandex Smart Home IoT API.

Token: put an OAuth token with scopes iot:view and iot:control into
~/.config/yandex-iot-token (or the YANDEX_IOT_TOKEN env variable).

Examples:
  lamps.py list
  lamps.py set all --temp 4000 --bright 100
  lamps.py set "Лампа" --rgb ff3300
  lamps.py set all --hsv 200,100,100
  lamps.py set all --scene candle
  lamps.py on all / lamps.py off all
  lamps.py curve            # print the circadian schedule for today
  lamps.py circadian        # run the circadian loop (brightness 100%, only temp changes)
"""
import argparse
import datetime as dt
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://api.iot.yandex.net/v1.0"
TOKEN_FILE = os.path.expanduser("~/.config/yandex-iot-token")

# Circadian settings: warm at night, cool in the middle of the day.
NIGHT_TEMP = 2700       # K, from evening to morning
DAY_TEMP = 5500         # K, around midday
SUNRISE = "07:00"       # warm-up to day temp starts here
SUNSET = "20:00"        # cool-down to night temp ends here
TRANSITION_MIN = 120    # minutes for each morning/evening transition
BRIGHTNESS = 100        # %, kept constant by the circadian loop
INTERVAL_SEC = 300      # how often the loop updates the bulbs
MIN_STEP_K = 50         # skip updates smaller than this


def token():
    t = os.environ.get("YANDEX_IOT_TOKEN")
    if not t and os.path.exists(TOKEN_FILE):
        t = open(TOKEN_FILE).read().strip()
    if not t:
        sys.exit(f"No token. Put it into {TOKEN_FILE}")
    return t


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode(errors='replace')}")


def lights():
    info = call("GET", "/user/info")
    rooms = {r["id"]: r["name"] for r in info.get("rooms", [])}
    return [
        dict(d, room=rooms.get(d.get("room"), ""))
        for d in info["devices"]
        if d["type"].startswith("devices.types.light")
    ]


def pick(target):
    devs = lights()
    if target == "all":
        return devs
    found = [d for d in devs if target.lower() in (d["name"] + " " + d["room"]).lower() or d["id"] == target]
    if not found:
        sys.exit(f"No light matches '{target}'. Run: lamps.py list")
    return found


def cap(dev, ctype):
    return next((c for c in dev["capabilities"] if c["type"] == ctype), None)


def temp_range(dev):
    c = cap(dev, "devices.capabilities.color_setting")
    t = (c or {}).get("parameters", {}).get("temperature_k")
    return (t["min"], t["max"]) if t else None


def is_on(dev):
    c = cap(dev, "devices.capabilities.on_off")
    return bool(c and c.get("state") and c["state"].get("value"))


def send(devs, actions_for):
    body = {"devices": [{"id": d["id"], "actions": actions_for(d)} for d in devs]}
    res = call("POST", "/devices/actions", body)
    for d in res.get("devices", []):
        for c in d.get("capabilities", []):
            r = c["state"].get("action_result", {})
            if r.get("status") != "DONE":
                print(f"  {d['id']} {c['state']['instance']}: {r}", file=sys.stderr)
    return res


def act_on(value):
    return {"type": "devices.capabilities.on_off", "state": {"instance": "on", "value": value}}


def act_bright(value):
    return {"type": "devices.capabilities.range", "state": {"instance": "brightness", "value": value}}


def act_color(instance, value):
    return {"type": "devices.capabilities.color_setting", "state": {"instance": instance, "value": value}}


def act_temp(dev, kelvin):
    rng = temp_range(dev)
    if rng:
        kelvin = max(rng[0], min(rng[1], kelvin))
    return act_color("temperature_k", int(kelvin))


def cmd_list(_):
    for d in lights():
        print(f"{d['name']}  [{d['room']}]  id={d['id']}")
        for c in d["capabilities"]:
            print(f"    {c['type'].split('.')[-1]:14} params={json.dumps(c.get('parameters', {}), ensure_ascii=False)}"
                  f"  state={json.dumps(c.get('state'), ensure_ascii=False)}")


def cmd_set(a):
    def actions(d):
        acts = [act_on(True)]
        if a.bright is not None:
            acts.append(act_bright(a.bright))
        if a.temp is not None:
            acts.append(act_temp(d, a.temp))
        if a.rgb is not None:
            acts.append(act_color("rgb", int(a.rgb.lstrip("#"), 16)))
        if a.hsv is not None:
            h, s, v = (int(x) for x in a.hsv.split(","))
            acts.append(act_color("hsv", {"h": h, "s": s, "v": v}))
        if a.scene is not None:
            acts.append(act_color("scene", a.scene))
        return acts
    send(pick(a.target), actions)


def cmd_onoff(value):
    return lambda a: send(pick(a.target), lambda d: [act_on(value)])


def minutes(hhmm):
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def circadian_temp(now):
    """Kelvin for the given time: smooth cosine ramps around sunrise and sunset."""
    t = now.hour * 60 + now.minute + now.second / 60
    rise, sset = minutes(SUNRISE), minutes(SUNSET)

    def ramp(start, end, frm, to):
        x = (t - start) / (end - start)
        return frm + (to - frm) * (1 - math.cos(math.pi * x)) / 2

    if rise <= t < rise + TRANSITION_MIN:
        return ramp(rise, rise + TRANSITION_MIN, NIGHT_TEMP, DAY_TEMP)
    if rise + TRANSITION_MIN <= t < sset - TRANSITION_MIN:
        return DAY_TEMP
    if sset - TRANSITION_MIN <= t < sset:
        return ramp(sset - TRANSITION_MIN, sset, DAY_TEMP, NIGHT_TEMP)
    return NIGHT_TEMP


def cmd_curve(_):
    day = dt.datetime.now().replace(minute=0, second=0, microsecond=0)
    for h in range(24):
        for m in (0, 30):
            t = day.replace(hour=h, minute=m)
            print(f"{t:%H:%M}  {circadian_temp(t):5.0f} K")


def cmd_circadian(a):
    last = {}
    print(f"circadian: {NIGHT_TEMP}-{DAY_TEMP} K, brightness {BRIGHTNESS}%, every {INTERVAL_SEC}s", flush=True)
    while True:
        try:
            kelvin = round(circadian_temp(dt.datetime.now()))
            # Only touch bulbs that are already on, so the loop never switches lights on by itself.
            on = [d for d in pick(a.target) if is_on(d)]
            # Forget bulbs that were switched off, so they get the right temp as soon as they come back on.
            last = {d["id"]: last[d["id"]] for d in on if d["id"] in last}
            todo = [d for d in on if abs(last.get(d["id"], 0) - kelvin) >= MIN_STEP_K]
            if todo:
                send(todo, lambda d: [act_bright(BRIGHTNESS), act_temp(d, kelvin)])
                for d in todo:
                    last[d["id"]] = kelvin
                print(f"{dt.datetime.now():%H:%M} {kelvin} K -> {', '.join(d['name'] for d in todo)}", flush=True)
        except SystemExit as e:
            print(e, file=sys.stderr, flush=True)
        except Exception as e:
            print(f"error: {e!r}", file=sys.stderr, flush=True)
        if a.once:
            return
        time.sleep(INTERVAL_SEC)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    s = sub.add_parser("set")
    s.add_argument("target", help="'all', part of a name/room, or device id")
    s.add_argument("--temp", type=int, help="color temperature, K")
    s.add_argument("--bright", type=int, help="brightness, 1-100")
    s.add_argument("--rgb", help="hex color, e.g. ff3300")
    s.add_argument("--hsv", help="h,s,v e.g. 200,100,100")
    s.add_argument("--scene", help="candle, ocean, romance, night, dinner, garland, rest")
    s.set_defaults(fn=cmd_set)
    for name, val in (("on", True), ("off", False)):
        o = sub.add_parser(name)
        o.add_argument("target")
        o.set_defaults(fn=cmd_onoff(val))
    sub.add_parser("curve").set_defaults(fn=cmd_curve)
    c = sub.add_parser("circadian")
    c.add_argument("target", nargs="?", default="all")
    c.add_argument("--once", action="store_true", help="update once and exit")
    c.set_defaults(fn=cmd_circadian)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
