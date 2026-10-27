#!/usr/bin/env python3
"""Control Sber bulbs through Sber's own cloud gateway, without Yandex in between.

Values go in Sber's raw scale (brightness 50-1000, colour h 0-360, s/v 0-1000),
so the bulb gets exactly what we send instead of Yandex's 1-100% mapping.

Setup:
  1. Russian Trusted Root CA in russian_trusted_root_ca.pem next to this file
     (Sber's servers use it; it is used only by this script, not installed system-wide).
  2. sber.py login        # phone + SMS code, typed by you; tokens go to ~/.config/sber-iot.json

Examples:
  sber.py list                       # devices, attribute ranges, current raw state
  sber.py colour all 0 1000 10       # pure red at v=10 (raw, out of 1000)
  sber.py white all 50 300           # brightness 50 (raw), colour temp 300 (raw, 0-1000)
  sber.py scene all candle 50        # scene at raw brightness 50 (the dimmest found)
  sber.py night                      # same as above: candle at 50 on all bulbs
  sber.py on all / sber.py off all
"""
import base64
import hashlib
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
CA_FILE = os.path.join(HERE, "russian_trusted_root_ca.pem")
TOKENS_FILE = os.path.expanduser("~/.config/sber-iot.json")

GATEWAY = "https://gateway.iot.sberdevices.ru/gateway/v1/"
UAPI = "https://online.sberbank.ru/CSAFront/uapi/v2/"
TOKEN_URL = "https://online.sberbank.ru:4431/CSAFront/api/service/oidc/v3/token"
JWT_URL = "https://companion.devices.sberbank.ru/v13/smarthome/token"
CLIENT_ID = "b1f0f0c6-fcb0-4ece-8374-6b614ebe3d42"  # Salute companion app
REDIRECT_URI = "companionapp://host"
USER_AGENT = "Salute+prod%2F24.11.1.15991+%28Android+29%3B+Xiaomi+MIX+2S%29"
DEVICEPRINT = (
    "version=1.7.3&pm_br=Chrome&pm_brmjv=120&iframed=0&intip=&pm_expt=&pm_fpacn=Mozilla&pm_fpan=Netscape"
    "&pm_fpasw=&pm_fpco=1&pm_fpjv=0&pm_fpln=lang=ru|syslang=|userlang=&pm_fpol=true&pm_fposp=&pm_fpsaw=393"
    "&pm_fpsbd=&pm_fpsc=24|393|786|786&pm_fpsdx=&pm_fpsdy=&pm_fpslx=&pm_fpsly=&pm_fpspd=24&pm_fpsui=&pm_fpsw="
    "&pm_fptz=3&pm_fpua=mozilla/5.0 (linux; android 10; k) applewebkit/537.36 (khtml, like gecko) "
    "chrome/120.0.0.0 mobile safari/537.36|5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36|Linux armv81&pm_fpup=&pm_inpt=&pm_os=Android"
)

_ctx = None


def ctx():
    global _ctx
    if _ctx is None:
        if not os.path.exists(CA_FILE):
            sys.exit(f"Missing {CA_FILE} (Russian Trusted Root CA)")
        _ctx = ssl.create_default_context(cafile=CA_FILE)
    return _ctx


def http(method, url, body=None, form=None, headers=None):
    headers = dict(headers or {})
    # Sber's WAF (SOWA) rejects the default Python-urllib user agent.
    headers.setdefault("User-Agent", USER_AGENT)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers.setdefault("Content-Type", "application/json")
    elif form is not None:
        data = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20, context=ctx()) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} {url}: {e.read().decode(errors='replace')[:500]}")


# --- auth -------------------------------------------------------------------

def load_tokens():
    try:
        with open(TOKENS_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        sys.exit("Not logged in. Run: sber.py login")


def save_tokens(t):
    os.makedirs(os.path.dirname(TOKENS_FILE), exist_ok=True)
    fd = os.open(TOKENS_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(t, f)


def jwt_exp(token):
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("exp", 0)
    except Exception:
        return 0


def store_access(resp, t):
    # The refresh token is single-use: always keep the newest one.
    t.update(access_token=resp["access_token"], refresh_token=resp["refresh_token"], jwt=None)
    save_tokens(t)


def gateway_jwt():
    t = load_tokens()
    if t.get("jwt") and jwt_exp(t["jwt"]) > time.time() + 60:
        return t["jwt"]
    if not t.get("access_token") or jwt_exp(t["access_token"]) < time.time() + 60:
        resp = http("POST", TOKEN_URL, form={
            "client_id": CLIENT_ID, "grant_type": "refresh_token", "refresh_token": t["refresh_token"]})
        store_access(resp, t)
    resp = http("GET", JWT_URL, headers={"Authorization": f"Bearer {t['access_token']}"})
    t["jwt"] = resp["token"]
    save_tokens(t)
    return t["jwt"]


def cmd_login(_):
    verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    channel = {
        "rsa_data": {"dom_elements": "", "htmlinjection": "", "manvsmachinedetection": "", "js_events": "",
                     "deviceprint": DEVICEPRINT},
        "oidc": {"scope": "openid", "response_type": "code", "redirect_uri": REDIRECT_URI,
                 "state": str(uuid.uuid4()), "nonce": str(uuid.uuid4()), "code_challenge_method": "S256",
                 "client_id": CLIENT_ID, "code_challenge": challenge, "referer_uri": ""},
        "browser": "Chrome", "os": "Android 10",
    }
    headers = {"Accept": "*/*", "Referer": UAPI, "User-Agent": USER_AGENT}
    phone = input("Phone (digits, starting with 7): ").strip().lstrip("+")
    resp = http("POST", UAPI + "authenticate", headers=headers, body={
        "identifier": {"type": "phone", "data": {"value": phone}},
        "authenticator": {"type": "sms_otp", "data": {}},
        "channel": {"type": "web", "user_type": "private", "data": channel}})
    ouid = resp["ouid"]
    sms = input("SMS code: ").strip()
    resp = http("POST", UAPI + "verify", headers=headers, body={
        "identifier": {"type": "ouid", "data": {"value": ouid}},
        "authenticator": {"type": "sms_otp", "data": {"value": sms}},
        "channel": {"type": "web", "data": dict(channel, set_cookie=False)}})
    authcode = resp["response_data"]["authcode"]
    resp = http("POST", TOKEN_URL, form={
        "code": authcode, "code_verifier": verifier, "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI, "grant_type": "authorization_code"})
    store_access(resp, {})
    print(f"Logged in, tokens saved to {TOKENS_FILE}")


# --- devices ----------------------------------------------------------------

def gw(method, path, body=None):
    return http(method, GATEWAY + path, body=body, headers={"x-auth-jwt": gateway_jwt()})


def devices():
    out = []
    for g in gw("GET", "device_groups")["result"]:
        tree = gw("GET", "device_groups/tree?id=" + urllib.parse.quote(g["id"]))["result"]
        out += tree.get("devices", [])
    return out


def pick(target):
    devs = [d for d in devices() if "light" in json.dumps(d.get("full_categories", "")) or "bulb" in d["device_info"]["model"]]
    if target == "all":
        return devs
    found = [d for d in devs if target.lower() in d["name"]["name"].lower() or d["id"] == target]
    if not found:
        sys.exit(f"No bulb matches '{target}'. Run: sber.py list")
    return found


def state_value(s):
    if s.get("color_value"):
        return s["color_value"]
    return {"BOOL": s.get("bool_value"), "ENUM": s.get("enum_value"), "INTEGER": s.get("integer_value"),
            "STRING": s.get("string_value"), "FLOAT": s.get("float_value")}.get(s["type"])


def cmd_list(_):
    for d in pick("all"):
        info = d["device_info"]
        print(f"{d['name']['name']}  model={info['model']}  sw={info['sw_version']}  id={d['id']}")
        for a in d["attributes"]:
            rng = a.get("int_values") or a.get("color_values") or a.get("enum_values") or ""
            print(f"    attr {a['key']:20} {json.dumps(rng, ensure_ascii=False)}")
        for s in d["reported_state"]:
            print(f"    now  {s['key']:20} {json.dumps(state_value(s), ensure_ascii=False)}")


def put_state(devs, states):
    for d in devs:
        t0 = time.time()
        gw("PUT", f"devices/{d['id']}/state", {"device_id": d["id"], "desired_state": states})
        print(f"{d['name']['name']}: sent in {(time.time() - t0) * 1000:.0f} ms")


def on_state(value):
    return {"key": "on_off", "type": "BOOL", "bool_value": value}


def cmd_colour(a):
    h, s, v = (int(x) for x in a[1:4])
    put_state(pick(a[0]), [
        on_state(True),
        {"key": "light_mode", "type": "ENUM", "enum_value": "colour"},
        {"key": "light_colour", "type": "COLOR", "color_value": {"h": h, "s": s, "v": v}},
    ])


def cmd_white(a):
    brightness, temp = int(a[1]), int(a[2])
    put_state(pick(a[0]), [
        on_state(True),
        {"key": "light_mode", "type": "ENUM", "enum_value": "white"},
        {"key": "light_brightness", "type": "INTEGER", "integer_value": brightness},
        {"key": "light_colour_temp", "type": "INTEGER", "integer_value": temp},
    ])


def cmd_scene(a):
    brightness = int(a[2]) if len(a) > 2 else 50
    put_state(pick(a[0]), [
        on_state(True),
        {"key": "light_mode", "type": "ENUM", "enum_value": "scene"},
        {"key": "light_scene", "type": "ENUM", "enum_value": a[1]},
        {"key": "scene_brightness", "type": "INTEGER", "integer_value": brightness},
    ])


def cmd_onoff(value):
    return lambda a: put_state(pick(a[0]), [on_state(value)])


COMMANDS = {"login": cmd_login, "list": cmd_list, "colour": cmd_colour, "white": cmd_white,
            "scene": cmd_scene, "night": lambda a: cmd_scene([a[0] if a else "all", "candle", "50"]),
            "on": cmd_onoff(True), "off": cmd_onoff(False)}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(__doc__)
    COMMANDS[sys.argv[1]](sys.argv[2:])
