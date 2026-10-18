/**
 * Nature Drips — Voice Agent Middleware
 * ==========================
 *
 * The "software part" the physical robot connects to.
 *
 * What this module does (it never does ASR/TTS itself):
 *   1. Owns the call session state machine.
 *   2. Stores call audio + transcripts to disk + JSON.
 *   3. Runs a rule-based NLU (works offline) — or calls your local LLM.
 *   4. Queues the call for the human admin panel.
 *   5. Sends an SMS alert when a call is handed off to an expert.
 *   6. Exposes an HTTP API the robot's "brain" (Python) calls.
 *
 * Robot-brain protocol (REST, same-origin as the website API on :3000):
 *   POST /api/voice/calls                       → answer incoming call
 *   POST /api/voice/calls/:id/received         → robot mic captured audio
 *   POST /api/voice/calls/:id/transcript       → robot local ASR → put transcript
 *   POST /api/voice/calls/:id/understand       → ask middleware how to reply
 *   POST /api/voice/calls/:id/audio            → robot local TTS → play audio
 *   POST /api/voice/calls/:id/handoff          → escalate to expert
 *   POST /api/voice/calls/:id/cancel           → hang up
 *   GET  /api/voice/calls                      → list calls (admin queue)
 *   GET  /api/voice/calls/:id                  → full session
 *   GET  /api/voice/queue                      → summary counts
 *
 * The website API (services/testimonials/etc.) keeps working untouched.
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DIRNAME = __dirname;
const DATA_DIR = path.join(DIRNAME, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const AUDIO_DIR = path.join(DATA_DIR, 'voice', 'audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// ---------------------------------------------------------------- config

function loadConfig() {
  try {
    return { ...require(path.join(DIRNAME, 'config.json')) };
  } catch (e) {
    return {};
  }
}
const CONFIG = loadConfig();

// ---------------------------------------------------------------- persistence

const VOICE_DB_FILE = path.join(DATA_DIR, 'voice-calls.db.json');
let voiceDB = { calls: [] };

function loadVoiceDB() {
  try {
    if (fs.existsSync(VOICE_DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VOICE_DB_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.calls)) return parsed;
    }
  } catch (e) { console.warn('[voice] db load error, starting fresh:', e.message); }
  return { calls: [] };
}
function saveVoiceDB() {
  fs.writeFileSync(VOICE_DB_FILE, JSON.stringify(voiceDB, null, 2));
}

// ---------------------------------------------------------------- call model

const STATUSES = [
  'created', 'ringing', 'listening', 'transcribing', 'thinking',
  'speaking', 'on-hold', 'completed', 'failed'
];

function createCall(phone, callSid, callerName) {
  return {
    id: uuidv4(),
    phone: phone || null,
    callSid: callSid || null,
    callerName: callerName || null,
    status: 'created',
    mode: 'inbound',
    transcript: '',
    intent: null,
    intentLabel: null,
    confidence: null,
    responseText: null,
    action: null, // reply | hold | handoff
    audioFiles: [],
    events: [],
    handoff: null,
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
  };
}

function pushEvent(call, type, payload) {
  call.events.push({ type, at: Date.now(), payload });
}

function setStatus(call, next) {
  if (!STATUSES.includes(next)) return false;
  call.status = next;
  return true;
}

// ---- audio storage: write base64 or Buffer to disk, remember relative path

function storeAudio(data, role) {
  let buf;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('data:')) {
      const base64 = trimmed.split(',').pop();
      buf = Buffer.from(base64, 'base64');
    } else {
      buf = Buffer.from(trimmed, 'base64');
    }
  } else if (Buffer.isBuffer(data)) {
    buf = data;
  } else {
    return null;
  }
  // Keep a readable filename. (Content-based format detection is minimal;
  // we store as .wav for the admin player.)
  const safe = (s) => (s || 'call').replace(/[^a-z0-9\-_]/gi, '_').slice(0, 40);
  const filename = `${safe('call')}-${role}-${Date.now()}.wav`;
  const rel = path.join('voice/audio', filename).replace(/\\/g, '/');
  fs.writeFileSync(path.join(AUDIO_DIR, filename), buf);
  return rel;
}

// ---------------------------------------------------------------- NLU (rule engine)

const RULE = {
  urgent: ['emergency', 'urgent', 'doctor', 'hospital', 'severe', 'critical',
    'pain', 'bleeding', 'allergic', 'chest', 'breathing', 'unconscious', 'poison'],
  sales: ['price', 'cost', 'booking', 'appointment', 'reserve', 'how much', 'book', 'rate', 'amount', 'can i book', 'book now'],
  greeting: ['hello', 'hi ', 'hey', 'good morning', 'good afternoon', 'good evening', 'who are you', 'hello there', 'hiii'],
  closing: ['thank you', 'thanks', 'bye', 'goodbye', 'see you', 'okay bye', 'okay thank you'],
  complaint: ['refund', 'cancel', 'complaint', 'problem', 'issue', 'error', 'bug', 'wrong', 'bad service', 'worst', 'rude', 'poor'],
  info: ['hours', 'location', 'address', 'open', 'closed', 'where', 'near me', 'route', 'directions', 'how to reach'],
  safety: ['safe', 'side effect', 'precaution', 'preparation', 'before', 'after', 'risk'],
  faq: ['drip', 'ingredients', 'b12', 'glutathione', 'vitamin c', 'duration', 'time', 'take', 'effects', 'members'],
};

function classify(text) {
  const t = (text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const votes = {};
  for (const [label, keywords] of Object.entries(RULE)) {
    let score = 0;
    for (const kw of keywords) {
      const re = new RegExp(`\\b${kw}\\b`, 'i');
      if (re.test(t)) score += 2;
      else if (t.includes(kw)) score += 1;
    }
    if (score > 0) votes[label] = score;
  }
  let best = null, bestScore = 0;
  for (const [label, score] of Object.entries(votes)) {
    if (score > bestScore) { best = label; bestScore = score; }
  }
  return { intent: best || 'general', score: bestScore || 0, raw: t };
}

function lookupFaq(transcript) {
  const db = globalThis.__NA_DB__;
  const faqs = (db && db.faqs) || [];
  const t = transcript.toLowerCase();
  for (const faq of faqs) {
    const q = (faq && faq.question || '').toLowerCase();
    if (t.includes(q) || q.includes(t)) return faq.answer;
  }
  return null;
}

function ruleNlu(call, transcript) {
  const { intent, score } = classify(transcript);
  const faqAnswer = lookupFaq(transcript);
  let responseText = null;
  let action = 'reply';

  if (intent === 'urgent') {
    responseText = "I understand this is urgent. I'm alerting our expert team right now — an expert will be with you shortly. Thank you for waiting.";
    action = 'handoff';
  } else if (intent === 'sales') {
    responseText = "I can help you book a drip or ask about pricing. Our most popular options are: Hydration & Electrolyte Drip (PKR 8,500), Jet Lag Recovery Drip (PKR 10,500), Immunity Boost Drip (PKR 12,000). I can also check availability — what would you like to know?";
    action = 'reply';
  } else if (intent === 'info') {
    responseText = "You can reach us at " + (CONFIG.office && CONFIG.office.phone ? CONFIG.office.phone : '+92 300 1234567') + ". We serve Karachi, Lahore and Islamabad. Would you like pricing or appointment details?";
    action = 'reply';
  } else if (intent === 'safety' || intent === 'faq') {
    if (faqAnswer) {
      responseText = faqAnswer;
    } else {
      responseText = "Our IV drip therapy is safe when done by our trained professionals after a brief health screening. Let me know if you'd like details about any specific drip or preparation steps.";
    }
    action = 'reply';
  } else if (intent === 'complaint') {
    responseText = "I'm sorry to hear that. I'm passing your feedback directly to our team so we can make it right. Can you tell me a little more?";
    action = 'reply';
  } else if (intent === 'closing') {
    responseText = "You're welcome! Welcome to Nature Drips. Our team will call you soon. Have a great day!";
    action = 'reply';
  } else if (intent === 'greeting') {
    responseText = "Assalam o Alaikum! Welcome to Nature Drips. How can I help you today with your IV drip therapy or appointment?";
    action = 'reply';
  } else {
    responseText = "Thank you for calling Nature Drips. I'll have an expert assist you shortly — an expert is on the way. In the meantime, is there anything specific you'd like to know about your drip session?";
    action = 'hold';
  }

  return {
    transcript,
    intent: intent,
    intentLabel: intent,
    confidence: Math.min(1, 0.3 + (score / 20)),
    responseText,
    action,
    faqAnswer: faqAnswer || null,
  };
}

// ---------------------------------------------------------------- SMS (alerts)

function sendSmsAlert(call, reason) {
  const cfg = CONFIG.sms || {};
  const phone = (call && call.phone) || '';
  const text = `🗣 Nature Drips voice alert — ${reason}. Caller → ${phone} (session ${call.id}).`;

  if (cfg.provider === 'twilio' && cfg.twilio && cfg.twilio.enabled) {
    console.log('[voice][sms] twilio enabled but not connected — set TWILIO_ACCOUNT_SID etc.');
    return false;
  }

  // Default webhook (env SMS_WEBHOOK_URL or a local listener)
  const url = process.env[cfg.webhookUrlEnv] || 'http://localhost:8080/sms';
  try {
    const body = { text, to: phone, sessionId: call.id, from: (CONFIG.office && CONFIG.office.smsPhone) || '' };
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => {
      if (r.ok) { console.log('[voice][sms] alert sent to', url); return true; }
      console.warn('[voice][sms] alert rejected', r.status);
      return false;
    }).catch(() => console.warn('[voice][sms] alert failed'));
    return true;
  } catch (e) {
    console.warn('[voice][sms] alert failed to send:', e.message);
    return false;
  }
}

// ---------------------------------------------------------------- helpers

function tryJson(m) {
  try {
    return JSON.parse(m);
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- voice router

const router = express.Router();

// ---- POST /api/voice/calls : answer incoming call (from phone gateway)

router.post('/calls', (req, res) => {
  const { phone, callSid, callerName } = req.body || {};
  const call = createCall(phone, callSid, callerName);
  voiceDB.calls.unshift(call);
  saveVoiceDB();
  pushEvent(call, 'answered', { from: phone, callSid });
  setStatus(call, 'ringing');

  // Optional: tell a webhook to play the greeting
  if (CONFIG.voice && typeof CONFIG.voice.greetingWebhook === 'string' && CONFIG.voice.greetingWebhook) {
    playWebhook(CONFIG.voice.greetingWebhook, 'greeting', call);
  }
  res.json({
    ok: true,
    sessionId: call.id,
    status: 'ringing',
    greeting: CONFIG.voice && CONFIG.voice.greeting ? CONFIG.voice.greeting : null,
  });
});

// ---- POST /api/voice/calls/:id/received : robot mic captured audio

router.post('/calls/:id/received', (req, res) => {
  const call = findCall(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (!['listening', 'transcribing', 'thinking', 'on-hold', 'ringing'].includes(call.status)) {
    return res.status(409).json({ error: 'Call not ready to receive audio', status: call.status });
  }
  const audio = storeAudio(req.body && req.body.audio, 'inbound');
  if (audio) call.audioFiles.push({ url: audio, role: 'inbound', at: Date.now() });
  setStatus(call, 'listening');
  pushEvent(call, 'inbound_audio', { role: 'inbound' });
  saveVoiceDB();
  res.json({ ok: true, status: 'listening', audio: audio || null });
});

// ---- POST /api/voice/calls/:id/transcript : robot local ASR output

router.post('/calls/:id/transcript', (req, res) => {
  const call = findCall(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  const transcript = (req.body && req.body.transcript) || '';
  call.transcript = transcript;
  call.mode = 'inbound';
  setStatus(call, 'transcribing');
  pushEvent(call, 'transcribed', { transcript });
  saveVoiceDB();
  res.json({ ok: true, status: 'transcribing', transcript, didTranscribe: true });
});

// ---- POST /api/voice/calls/:id/understand : NLU (rule or local LLM)

router.post('/calls/:id/understand', async (req, res) => {
  const call = findCall(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });

  const transcript = (req.body && req.body.transcript) || call.transcript || '';
  call.transcript = transcript;
  let result = null;

  // 1) Optional local LLM hook (e.g. Ollama). If it returns valid JSON with
  //    intent + response, use it; otherwise fall through to the rule engine.
  if (CONFIG.nlu && CONFIG.nlu.localLLM && typeof CONFIG.nlu.localLLM === 'object') {
    try {
      const { host, path: llmPath, model = 'llama3' } = CONFIG.nlu.localLLM;
      const body = {
        model,
        messages: [{ role: 'user', content: `Call transcript: "${transcript}". Return JSON only with keys intent, response, action.` }]
      };
      const r = await fetch((host || 'http://localhost:11434') + (llmPath || '/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = await r.json();
        const parsed = tryJson(j.message || j || '');
        if (parsed && parsed.intent && parsed.response != null) {
          result = {
            transcript,
            intent: parsed.intent,
            intentLabel: parsed.intent,
            confidence: 0.95,
            responseText: parsed.response,
            action: (parsed.action === 'hold' || parsed.action === 'handoff') ? parsed.action : 'reply',
          };
        }
      }
    } catch (e) { console.warn('[voice] localLLM call failed, falling back to rule:', e.message); }
  }

  if (!result) {
    result = ruleNlu(call, transcript);
  }

  call.intent = result.intent;
  call.intentLabel = result.intentLabel;
  call.confidence = result.confidence;
  call.responseText = result.responseText;
  call.action = result.action;
  pushEvent(call, 'understood', { intent: result.intent, action: result.action, response: result.responseText });
  setStatus(call, 'thinking');
  saveVoiceDB();

  // ---- handoff path: play hold message + SMS alert + queue
  const isHandoff = result.action === 'hold' || result.action === 'handoff' || result.intent === 'urgent';
  if (isHandoff) {
    if (CONFIG.voice && typeof CONFIG.voice.holdWebhook === 'string' && CONFIG.voice.holdWebhook) {
      playWebhook(CONFIG.voice.holdWebhook, 'hold', call);
    }
    call.status = 'on-hold';
    call.handedOff = true;
    call.handedOffAt = Date.now();
    call.handoff = call.handoff || {};
    call.handoff.reason = result.intent;
    call.handoff.to = call.handoff.to || null;
    call.handoff.via = call.handoff.via || 'physical_desk';
    call.handoff.at = Date.now();
    const sent = sendSmsAlert(call, `Handoff — ${result.intent}`);
    pushEvent(call, 'handoff', { reason: result.intent, smsSent: sent });
    saveVoiceDB();
  }

  res.json({
    ok: true,
    status: call.status,
    transcript: result.transcript,
    intent: result.intent,
    intentLabel: result.intentLabel,
    confidence: result.confidence,
    responseText: result.responseText,
    action: result.action,
    handoff: call.handoff || null,
  });
});

// ---- POST /api/voice/calls/:id/audio : robot local TTS outbound audio

router.post('/calls/:id/audio', (req, res) => {
  const call = findCall(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (!['speaking', 'thinking', 'on-hold'].includes(call.status)) {
    return res.status(409).json({ error: 'Call not ready for playback', status: call.status });
  }
  const audio = storeAudio(req.body && req.body.audio, 'outbound');
  if (audio) {
    call.audioFiles.push({ url: audio, role: 'outbound', at: Date.now() });
  }
  const next = call.status === 'on-hold' ? 'speaking' : call.status;
  setStatus(call, next);
  pushEvent(call, 'outbound_audio', { role: 'outbound' });
  saveVoiceDB();

  if (CONFIG.voice && typeof CONFIG.voice.speakWebhook === 'string' && CONFIG.voice.speakWebhook) {
    playWebhook(CONFIG.voice.speakWebhook, 'speak', call, audio);
  }

  res.json({ ok: true, status: next, audio: audio || null });
});

// ---- POST /api/voice/calls/:id/handoff : explicit escalate by the brain

router.post('/calls/:id/handoff', (req, res) => {
  const call = findCall(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  const { reason, to, via } = req.body || {};
  call.status = 'on-hold';
  call.handedOff = true;
  call.handedOffAt = Date.now();
  call.handoff = {
    reason: reason || 'human_escalation',
    to: to || null,
    via: via || 'physical_desk',
    at: Date.now(),
  };
  const sent = sendSmsAlert(call, `Handoff — ${reason || 'escalation'}`);
  pushEvent(call, 'handoff', { reason, via, smsSent: sent });
  saveVoiceDB();
  res.json({ ok: true, status: 'on-hold', handoff: call.handoff, smsSent: sent });
});

// ---- POST /api/voice/calls/:id/cancel : hang up

router.post('/calls/:id/cancel', (req, res) => {
  const call = findCall(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  call.status = 'completed';
  call.endedAt = Date.now();
  pushEvent(call, 'cancelled', {});
  saveVoiceDB();
  res.json({ ok: true, status: 'completed' });
});

// ---- GET /api/voice/calls

router.get('/calls', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const all = voiceDB.calls.slice().sort((a, b) => b.createdAt - a.createdAt);
  const pending = all.filter(c =>
    ['created', 'ringing', 'listening', 'transcribing', 'thinking', 'speaking', 'on-hold'].includes(c.status)
  );
  res.json({
    calls: all.slice(0, limit),
    pending: pending.map(pick),
    counts: counts(),
  });
});

// ---- GET /api/voice/calls/:id

router.get('/calls/:id', (req, res) => {
  const call = findCall(req.params.id);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  res.json({ ok: true, call: pick(call) });
});

// ---- GET /api/voice/queue

router.get('/queue', (req, res) => {
  const pending = voiceDB.calls.filter(c =>
    ['created', 'ringing', 'listening', 'transcribing', 'thinking', 'speaking', 'on-hold'].includes(c.status)
  );
  res.json({
    total: voiceDB.calls.length,
    pending: pending.length,
    byStatus: counts(),
    recent: pending.slice(0, 10).map(pick),
  });
});

// ---- helpers

function findCall(id) {
  return voiceDB.calls.find(c => c.id === id) || null;
}

function pick(call) {
  return {
    id: call.id,
    phone: call.phone,
    callSid: call.callSid,
    callerName: call.callerName,
    status: call.status,
    intent: call.intent,
    intentLabel: call.intentLabel,
    confidence: call.confidence,
    responseText: call.responseText,
    action: call.action,
    transcript: call.transcript,
    audioCount: call.audioFiles.length,
    handoff: call.handoff || null,
    handedOff: call.handedOff,
    createdAt: call.createdAt,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
  };
}

function counts() {
  const out = {};
  for (const s of STATUSES) out[s] = 0;
  for (const c of voiceDB.calls) if (out[c.status] !== undefined) out[c.status] += 1;
  return out;
}

function playWebhook(url, event, call, audioUrl) {
  if (typeof fetch !== 'function') return;
  const payload = { event, sessionId: call.id, audio: audioUrl || null };
  if (event === 'hold' || event === 'speak') {
    payload.audio = { url: audioUrl || '/voice/audio/placeholder', text: (event === 'hold' ? CONFIG.voice.holdMessage : CONFIG.voice.greeting) };
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

module.exports = router;
