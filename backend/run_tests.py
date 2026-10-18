#!/usr/bin/env python3
# 20-system-verification-tests for Nature Drips Voice Agent Middleware
import json, sys, time, urllib.request, urllib.error, os, ast

BASE = "http://localhost:3000"
_LAST_HTTP = None
passed = 0
failed = 0
results = []

def call(method, path, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type":"application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=5)
        return r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:
        return -1, str(e)

def httpok(method, path, body=None, expect=200):
    global _LAST_HTTP
    st, txt = call(method, path, body)
    _LAST_HTTP = st
    ok = st == expect
    results.append([f"{method} {path}", ok, str(st), txt[:80]])
    return st, txt, ok

def jget(txt, key):
    try:
        return json.loads(txt).get(key)
    except Exception:
        return None

def check(name, cond, detail=""):
    """Record pass/fail and return bool(cond)."""
    results.append([name, bool(cond), str(_LAST_HTTP) if 'st' in dir() else "", detail])
    return bool(cond)

# ---- TEST 1: Health ----
st, txt, ok = httpok("GET", "/api/health", expect=200)
passed += check("1. health", ok, txt[:60])

# ---- TEST 2: Answer call ----
st, txt, ok = httpok("POST", "/voice/calls", {"phone":"+92 300 1234567","callSid":"t1","callerName":"Ayesha"}, expect=200)
sid = jget(txt, "sessionId")
passed += check("2. answer_call", ok and bool(sid), "sessionId="+str(sid))

# ---- TEST 3: Understand (sales) ----
st, txt, ok = httpok("POST", f"/voice/calls/{sid}/understand", {"transcript":"I need a hydration drip and what is the price"}, expect=200)
i = jget(txt, "intent"); a = jget(txt, "action")
passed += check("3. nlu_sales", ok and i=="sales" and a=="reply", f"intent={i} action={a}")

# ---- TEST 4: Understand (urgent -> handoff) ----
st, txt, ok = httpok("POST", f"/voice/calls/{sid}/understand", {"transcript":"I have chest pain and trouble breathing"}, expect=200)
i = jget(txt, "intent"); a = jget(txt, "action"); h = jget(txt, "handoff")
passed += check("4. nlu_urgent_handoff", ok and i=="urgent" and a=="handoff" and bool(h), f"intent={i} action={a}")

# ---- TEST 5: Transcribe store ----
st, txt, ok = httpok("POST", f"/voice/calls/{sid}/transcript", {"transcript":"Hello, I would like to book a drip"}, expect=200)
passed += check("5. transcribe", ok and jget(txt, "didTranscribe") is True)

# ---- TEST 12: Call content (transcript) — right after transcribe, before later updates
st, txt, ok = httpok("GET", f"/voice/calls/{sid}", expect=200)
c = jget(txt, "call")
passed += check("12. call_content", ok and c and c.get("transcript")=="Hello, I would like to book a drip")

# ---- TEST 6: Received audio ----
st, txt, ok = httpok("POST", f"/voice/calls/{sid}/received", {"audio":"UklGRiAAAAA="}, expect=200)
passed += check("6. received_audio", ok and jget(txt, "status")=="listening")

# ---- TEST 7: Handoff path (/understand triggers handoff+queue) ----
st, txt, ok = httpok("POST", f"/voice/calls/{sid}/understand", {"transcript":"I need urgent help with my drip"}, expect=200)
h = jget(txt, "handoff")
passed += check("7. handoff_queue", ok and jget(txt, "action") in ("handoff","hold") and bool(h))

# ---- TEST 8: Understand (FAQ/info) ----
st, txt, ok = httpok("POST", f"/voice/calls/{sid}/understand", {"transcript":"What are your business hours and location"}, expect=200)
i = jget(txt, "intent")
passed += check("8. nlu_info_faq", ok and i in ("info","faq"), "intent=" + str(i))

# ---- TEST 9: Understand (complaint) ----
st, txt, ok = httpok("POST", f"/voice/calls/{sid}/understand", {"transcript":"Refund my money, this was a scam"}, expect=200)
i = jget(txt, "intent")
passed += check("9. nlu_complaint", ok and i=="complaint", "intent=" + str(i))

# ---- TEST 10: Single call detail ----
st, txt, ok = httpok("GET", f"/voice/calls/{sid}", expect=200)
c = jget(txt, "call")
passed += check("10. call_detail", ok and c and c.get("id")==sid and c.get("phone"))

# ---- TEST 11: Queue listing ----
st, txt, ok = httpok("GET", "/voice/queue", expect=200)
q = json.loads(txt)
passed += check("11. queue", ok and q.get("total",0)>=1 and isinstance(q.get("byStatus"), dict), "total="+str(q.get("total")))

# ---- TEST 13: Admin page HTML ----
st, txt, ok = httpok("GET", "/voice-admin.html", expect=200)
passed += check("13. admin_page", ok and "Nature Drips" in txt)

# ---- TEST 14: Audio static serving ----
st, txt, ok = httpok("GET", "/voice/audio/call-inbound-1792339794579.wav", expect=200)
if ok:
    try:
        r = urllib.request.urlopen("http://localhost:3000/voice/audio/call-inbound-1792339794579.wav", timeout=5)
        ok2 = True
    except Exception:
        ok2 = False
    res_len = r.read().__len__() if 'r' in dir() else 0
else:
    ok2 = False
passed += check("14. audio_static", ok2, "bytes=" + str(res_len))

# ---- TEST 15: Cancel call ----
st, txt, ok = httpok("POST", f"/voice/calls/{sid}/cancel", expect=200)
passed += check("15. cancel", ok and jget(txt, "status")=="completed")

# ---- TEST 16: Queue after cancel ----
st, txt, ok = httpok("GET", "/voice/queue", expect=200)
q = json.loads(txt)
passed += check("16. queue_after", ok and q.get("total",0)>=1 and isinstance(q.get("byStatus"), dict), "total="+str(q.get("total")))

# ---- TEST 17: Brain.py valid Python ----
try:
    ast.parse(open("brain/brain.py").read())
    ok = True
except Exception as e:
    ok = False
passed += check("17. brain.py_ast", ok)

# ---- TEST 18: Config JSON valid ----
try:
    json.load(open("voice/config.json"))
    ok = True
except Exception:
    ok = False
passed += check("18. config_json", ok)

# ---- TEST 19: Website API intact ----
st, txt, ok = httpok("GET", "/api/services", expect=200)
ok2 = ok and isinstance(json.loads(txt), list) and len(json.loads(txt))>0
passed += check("19. website_api", ok2, "services="+str(len(json.loads(txt))) if ok2 else "none")

# ---- TEST 20: Default call (empty body) answers ----
st, txt, ok = httpok("POST", "/voice/calls", {}, expect=200)
sid2 = jget(txt, "sessionId")
passed += check("20. default_call", ok and bool(sid2), "sessionId="+str(sid2))

print("="*64)
print("20-TEST VERIFICATION SUMMARY")
print("="*64)
for name, ok, http, detail in results:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name:46s} | {http} | {detail}")
print("="*64)
print(f"TOTAL: {passed} passed | {failed} failed")
sys.exit(0 if failed==0 else 1)
