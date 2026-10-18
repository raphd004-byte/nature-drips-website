import json, os

base = '/c/Users/User/nature-drips-website/backend/data'

print("=== list data dir ===")
for f in sorted(os.listdir(base)):
    print(" ", f)

print("=== voice-calls.db.json ===")
vp = os.path.join(base, 'voice-calls.db.json')
if os.path.exists(vp):
    d = json.load(open(vp))
    print("total calls:", len(d['calls']))
    for c in d['calls']:
        print("  id:", c['id'])
        print("  status:", c['status'], "| intent:", c['intent'], "| action:", c['action'])
        print("  transcript:", (c['transcript'] or '')[:70] + "...")
        print("  handoff:", c.get('handoff'))
else:
    print("  MISSING")

print("=== nature-drips.db.json (website) ===")
wp = os.path.join(base, 'nature-drips.db.json')
if os.path.exists(wp):
    d = json.load(open(wp))
    print("  services:", len(d['services']), "| testimonials:", len(d['testimonials']), "| faqs:", len(d['faqs']))
    print("  phone:", d['siteSettings']['phone'])
else:
    print("  MISSING")
