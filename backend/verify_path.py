import json, sys
for p in sys.argv[1:]:
    try:
        d = json.load(open(p))
        if isinstance(d, dict):
            print(f"OK {p}: keys={list(d.keys())}")
        else:
            print(f"OK {p}: parsed as {type(d).__name__}")
    except Exception as e:
        print(f"FAIL {p}: {e}")
