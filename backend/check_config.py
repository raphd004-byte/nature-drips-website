import json, sys
p = sys.argv[1]
d = json.load(open(p))
print("config keys:", list(d.keys()))
print("voice.greeting:", d.get("voice", {}).get("greeting", "")[:40])
print("voice.holdMessage:", d.get("voice", {}).get("holdMessage", "")[:40])
print("nlu.localLLM:", d.get("nlu", {}).get("localLLM"))
print("sms.provider:", d.get("sms", {}).get("provider"))
