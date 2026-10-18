# Nature Drips — Voice Agent (Physical Robot Desk)

The software that sits behind the physical robot on the customer-care desk.
It is phone-line agnostic, speaks back to callers, and hands complex calls
to a human expert with an SMS alert.

## What's here

| Path | Purpose |
|---|---|
| `backend/voice/voice.js` | Call state machine, NLU (rule engine or local LLM), queue, SMS alert |
| `backend/voice/config.json` | Voice greeting, handoff messages, NLU/SMS/LLM settings |
| `backend/voice/README-voice.md` | This doc |
| `backend/brain/brain.py` | Robot "brain" sample (Python: listen, transcribe, speak) |
| `backend/brain/requirements.txt` | Brain dependencies |
| `backend/server.js` | Original website API + voice router mounted at `/voice` |

## Architecture

```
Caller -> Phone (VoIP/SIP/cloud/FXO) -> Robot speaker/mic
   -> Robot brain (Python): ASR + TTS + local LLM
   -> Middleware (Node/Express :3000): call state, NLU, queue, SMS, persistence
   -> Admin panel: queue view + handoff
```

### REST API (robot + admin)

| Method | Path | Purpose |
|---|---|---|
| POST | `/voice/calls` | Answer incoming call |
| POST | `/voice/calls/:id/received` | Robot mic captured audio (base64 WAV) |
| POST | `/voice/calls/:id/transcript` | Robot local ASR -> text |
| POST | `/voice/calls/:id/understand` | NLU -> intent + response draft |
| POST | `/voice/calls/:id/audio` | Robot local TTS audio (base64 WAV) |
| POST | `/voice/calls/:id/handoff` | Escalate to human expert |
| POST | `/voice/calls/:id/cancel` | Hang up |
| GET | `/voice/calls` | List calls |
| GET | `/voice/calls/:id` | Full session |
| GET | `/voice/queue` | Queue summary + recent calls |

Audio files are served statically at `/voice/audio/…`.

## Setup

1. Install the brain's deps: `pip install -r backend/brain/requirements.txt`
2. Start the middleware: `cd backend && npm start` (Node 18+)
3. Answer a call (curl):  
   `curl -X POST http://localhost:3000/voice/calls -d '{"phone":"+92 300 1234567","callSid":"t1"}'`
4. Drive the loop: see `backend/brain/brain.py` (`python brain.py`).

## Phone line

The middleware never touches the phone itself — the gateway does. Point your
gateway at `/voice/calls` (answer hook) and stream the robot's mic/speaker
audio through `/voice/calls/:id/received` and `/voice/calls/:id/audio`. The
greeting is a file the gateway replays.

## Handoff

When NLU returns `action=handoff`, the middleware:
- marks the call `on-hold`,
- plays the hold message,
- sends an SMS alert to `office.smsPhone` (configurable webhook or Twilio),
- records the handoff reason + session in the DB and admin queue.

## Testing with curl

```bash
# 1. answer
SESS=$(curl -s -X POST http://localhost:3000/voice/calls -d '{"phone":"+92 300 1234567","callSid":"t1"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['sessionId'])")
# 2. received audio
curl -X POST http://localhost:3000/voice/calls/$SESS/received -d '{"audio":"UklGRiAAAAA="}'
# 3. transcript
curl -X POST http://localhost:3000/voice/calls/$SESS/transcript -d '{"transcript":"Hi, book me a drip"}'
# 4. understand
curl -X POST http://localhost:3000/voice/calls/$SESS/understand -d '{"transcript":"Hi, book me a drip"}'
# 5. queue
curl http://localhost:3000/voice/queue
```

## Files to notice

- `backend/data/nature-drips.db.json` — the website's data (unchanged by voice).
- `backend/data/voice-calls.db.json` — voice call history (handoffs, transcripts, audio refs).
