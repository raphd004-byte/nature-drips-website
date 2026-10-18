#!/usr/bin/env python3
"""
Nature Drips — Physical-Robot Voice Bot Brain
==============================================
The "brain" that runs on the robot's computer.

It does what the robot CAN do locally:
  * listen via mic,   * transcribe via ASR,   * speak via TTS
It drives the middleware (Node/Express :3000) for:
  * call state / queue / persistence
  * NLU (rule engine or your local LLM)
  * admin queue view
  * SMS alert on handoff

Robot -> middleware protocol (REST):
  POST  /voice/calls                     answer incoming call
  POST  /voice/calls/:id/received        robot mic audio (base64 WAV) -> save
  POST  /voice/calls/:id/transcript      robot local ASR -> text
  POST  /voice/calls/:id/understand      NLU -> intent + response draft
  POST  /voice/calls/:id/audio           robot local TTS audio (base64 WAV) -> save
  POST  /voice/calls/:id/handoff         escalate to human
  POST  /voice/calls/:id/cancel          hang up
  GET   /voice/queue                     admin queue summary

Install:
  pip install -r requirements.txt
  (speechrecognition + pyaudio OR sounddevice; edge-tts)

Usage:
  python brain.py                                    # normal live call
  python brain.py --phone "+92 300 1234567" --call-sid t1   # replay mode (no mic)
  python brain.py --test-flow                        # drive the middleware via curl
"""

import os
import sys
import json
import time
import base64
import requests
import speech_recognition as sr

# ---------------------------------------------------------------- config

MIDWARE_HOST = os.environ.get("MIDWARE_HOST", "http://localhost:3000")
MIDWARE = lambda p: f"{MIDWARE_HOST}{p}"

PHONE = None
CALL_SID = None
CALL_ID = None

# ---------------------------------------------------------------- speech I/O

def listen(phrase_time_limit=15):
    """Record from the mic and return the recognised text (Google, no key)."""
    r = sr.Recognizer()
    with sr.Microphone() as src:
        r.adjust_for_ambient_noise(src, duration=0.6)
        print("  [brain] Listening... speak now, then stop.")
        audio = r.listen(src, timeout=10, phrase_time_limit=phrase_time_limit)
    try:
        text = r.recognize_google(audio)
        print(f"  [brain] You said: {text}")
        return text
    except sr.UnknownValueError:
        print("  [brain] (couldn't understand — try again)")
        return None
    except sr.RequestError as e:
        print(f"  [brain] ASR API error: {e}")
        return None

def transcribe_local(audio_path=None):
    """Use your local Whisper when installed (optional)."""
    try:
        import whisper
        model = whisper.load_model("base")
        if audio_path and os.path.exists(audio_path):
            return model.transcribe(audio_path)["text"].strip()
    except Exception as e:
        print(f"  [brain] local ASR not available ({e}) — using Google")
    return None

def speak_text(text, voice="en-US-AndrewNeural", rate="+0%"):
    """Return a base64 WAV of the spoken text (robot speaker)."""
    try:
        import edge_tts
        outfile = "/tmp/brain_tts.wav"
        edge_tts.Communicate(text, voice=voice, rate=rate).save_wav(outfile)
        with open(outfile, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")
    except Exception as e:
        print(f"  [brain] TTS error: {e} (play text aloud / ignore)")
        return None

def play_audio(audio_b64):
    """Feed the base64 WAV to the robot speaker hardware. Stub: save to disk."""
    if not audio_b64:
        return
    with open("/tmp/brain_out.wav", "wb") as f:
        f.write(base64.b64decode(audio_b64))
    print("  [brain] TTS saved -> /tmp/brain_out.wav (play on robot speaker)")

# ---------------------------------------------------------------- HTTP calls

def request(method, path, payload=None):
    r = requests.request(method, MIDWARE(path), json=payload, timeout=10)
    return r.json() if r.ok else {"error": r.text}

def answer():
    global CALL_ID
    res = request("POST", "/voice/calls", {"phone": PHONE, "callSid": CALL_SID,
                                           "callerName": get_caller_name()})
    CALL_ID = res.get("sessionId")
    print(f"\n  🌿 Call answered. Session: {CALL_ID}")
    if res.get("greeting"):
        print(f"  [brain] (server greeting: {res['greeting']})")
    return res

def send_audio(audio_b64):
    request("POST", f"/voice/calls/{CALL_ID}/received", {"audio": audio_b64})

def send_transcript(text):
    request("POST", f"/voice/calls/{CALL_ID}/transcript", {"transcript": text})

def understand(text):
    return request("POST", f"/voice/calls/{CALL_ID}/understand", {"transcript": text})

def send_audio_out(audio_b64):
    request("POST", f"/voice/calls/{CALL_ID}/audio", {"audio": audio_b64})

def handoff(reason="escalation"):
    return request("POST", f"/voice/calls/{CALL_ID}/handoff", {"reason": reason})

def cancel():
    request("POST", f"/voice/calls/{CALL_ID}/cancel")

def get_caller_name():
    # In production the phone system can supply this; stub here.
    return None

# ---------------------------------------------------------------- run loop

def run():
    answer()
    print("  [brain] Bot is ready — listening for the caller.")
    while True:
        text = listen()
        if not text:
            continue
        send_transcript(text)                       # tell middleware we transcribed
        res = understand(text)                      # NLU: intent + response draft
        if not res.get("ok"):
            cancel(); return
        action = res.get("action", "reply")
        if action in ("handoff", "hold"):
            print(f"  [brain] Handoff to human ({res.get('intent')}).")
            handoff(res.get("intent"))
            speak_text("Thank you for your patience. An expert is on the way.")
            play_audio(speak_text("Thank you for your patience. An expert is on the way."))
            time.sleep(12)   # watch the queue for a human to pick it up
            cancel()
            return
        speak_text(res["responseText"])
        play_audio(speak_text(res["responseText"]))
        print(f"  [brain] replied ({res.get('intent')}); type 'break' to end.")
        try:
            cmd = input("  [brain] Reply again? [y/N] ").strip().lower()
            if cmd == "break":
                cancel(); return
        except EOFError:
            cancel(); return

# ---------------------------------------------------------------- test replay

def run_replay(transcript_file=None):
    """Drive the middleware through a scripted call (no mic)."""
    answer()
    if not transcript_file:
        transcript_file = "/tmp/brain_replay.txt"
    lines = [l.strip() for l in open(transcript_file) if l.strip()]
    for t in lines:
        if not t:
            continue
        send_transcript(t)
        res = understand(t)
        if not res.get("ok"):
            print("  [replay] understand failed:", res); break
        action = res.get("action", "reply")
        if action == "handoff":
            handoff(res.get("intent"))
            speak_text("Thank you for your patience. An expert is on the way.")
            play_audio(speak_text("Thank you for your patience. An expert is on the way."))
            time.sleep(3)
            cancel(); return
        speak_text(res["responseText"])
        play_audio(speak_text(res["responseText"]))
        time.sleep(1)
    cancel()

if __name__ == "__main__":
    args = sys.argv[1:]
    if "--phone" in args:
        PHONE = args[args.index("--phone") + 1]
    if "--call-sid" in args:
        CALL_SID = args[args.index("--call-sid") + 1]
    if "--replay" in args:
        run_replay()
    elif "--test-flow" in args:
        print("[brain] test-flow: run the curl commands in the project docs to drive the middleware.")
    else:
        run()
