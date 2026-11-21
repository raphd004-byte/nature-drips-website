# 🌿 Nature Drips — Premium IV Drip Therapy & Wellness Website

**Digital website for the Nature Drips wellness brand** — physical-robot voice agent customer care desk, IV drip therapy, and wellness services.

> 🌐 **Live site:** https://thenaturedrip.pk  
> 🏷️ **Branch:** `main`  
> 👤 **Maintainer:** raphd004-byte | Last commit: 3 weeks ago

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [Key Features](#-key-features)
4. [Tech Stack](#-tech-stack)
5. [Getting Started](#-getting-started)
6. [API Endpoints](#-api-endpoints)
7. [File Structure](#-file-structure)
8. [Environment Variables](#-environment-variables)
9. [Deployment](#-deployment)
10. [Contributing](#-contributing)
11. [License](#-license)

---

## 🌿 Project Overview

Nature Drips is a premium wellness brand offering IV drip therapy and related health services. This repository contains the complete **digital experience** — a public website with SEO optimization, a voice-agent customer care desk (physical robot), and an admin panel for content management.

The project is split into:
- **Frontend:** Static HTML/CSS/JavaScript website
- **Backend:** Node.js + Express voice middleware (public API)
- **Voice Engine:** Python-powered physical robot customer care desk

---

## 🏗️ Architecture

```
nature-drips-website/
├── frontend/                  # Static public website
│   ├── index.html             # Homepage
│   ├── admin.html             # Public admin dashboard
│   ├── gallery.html           # Image gallery
│   └── assets/                # Images, CSS, JS
├── backend/                   # Node.js Express voice middleware
│   ├── server.js              # Main Express server
│   ├── voice/                 # Voice agent logic
│   │   ├── config.json        # Voice config
│   │   ├── voice.js           # Voice service
│   │   └── brain/             # Python voice engine (ASR+TTS)
│   │       ├── brain.py       # Python voice engine
│   │       └── requirements.txt
│   └── data/                  # Data storage (JSON)
└── README.md                  # This file
```

---

## ✨ Key Features

### 🌐 Public Website
- **Responsive design** — works on desktop, tablet, and mobile
- **SEO optimized** — meta tags, sitemap.xml, robots.txt, Google Search Console verification
- **Gallery page** — selectable image gallery with lazy loading
- **Brand imagery** — custom hero, social, section background, and logo images

### 🤖 Physical Robot Voice Agent
- **Bi-directional voice communication** — ASR (speech-to-text) + TTS (text-to-speech)
- **Voice state machine** — ringing → listening → transcribing → thinking → speaking → on-hold → completed
- **NLU rule engine** — classifies intent: urgent, sales, info, faq, complaint, greeting
- **Human handoff** — plays "expert is on the way" + sends SMS alert, logs to queue
- **Audio persistence** — all voice calls saved to disk and served at `/voice/audio`

### 📱 Voice Admin Dashboard
- **Live call queue** — view active and history of calls
- **Voice state monitoring** — see real-time agent status
- **Config management** — adjust voice settings via config.json

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Node.js, Express.js |
| **Voice Engine** | Python (ASR + TTS) |
| **Database** | JSON file storage |
| **Audio** | WAV files on disk |
| **Communication** | Twilio SMS, Webhooks |
| **Hosting** | GitHub Pages / custom domain (thenaturedrip.pk) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (for backend)
- Python 3.8+ (for voice engine)
- Git
- Twilio account (for SMS)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/raphd004-byte/nature-drips-website.git
   cd nature-drips-website
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install voice engine dependencies**
   ```bash
   cd backend/voice/brain
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Twilio credentials and voice config
   ```

5. **Start the server**
   ```bash
   # Terminal 1 - Backend (port 3000)
   cd backend
   node server.js

   # Terminal 2 - Voice engine (Python)
   cd backend/voice/brain
   python brain.py
   ```

### Running Tests

```bash
cd backend
npm test
```

---

## 🔌 API Endpoints

All voice API endpoints are prefixed with `/voice/*`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/voice/calls` | Answers incoming calls, starts session |
| `POST` | `/voice/received` | Call received confirmation |
| `POST` | `/voice/transcript` | Speech-to-text transcript |
| `POST` | `/voice/understand` | NLU intent classification |
| `GET` | `/voice/audio` | Serve recorded audio files |
| `POST` | `/voice/handoff` | Handoff to human operator |
| `POST` | `/voice/cancel` | Cancel active call |

### Example Request

```bash
curl -X POST http://localhost:3000/voice/calls   -H "Content-Type: application/json"   -d '{"from": "+1234567890", "to": "+0987654321"}'
```

---

## 📁 File Structure

```
nature-drips-website/
├── .gitignore
├── CNAME
├── admin.html                    # Public admin dashboard
├── bing-verify.html              # Bing SEO verification
├── gallery.html                  # Image gallery
├── index.html                    # Homepage
├── robots.txt                    # SEO robots
├── sitemap.xml                   # SEO sitemap
├── voice-admin.html              # Voice desk queue UI
├── assets/
│   ├── images/
│   │   ├── hero-studio.jpg
│   │   ├── social-glowing-woman.jpg
│   │   ├── instagram-story-promo.jpg
│   │   ├── section-water-droplets.jpg
│   │   └── logo-brandmark.png
│   └── css/
│       └── style.css
├── backend/
│   ├── server.js                 # Express voice middleware
│   ├── README-voice.md           # Voice-specific README
│   ├── voice/
│   │   ├── config.json           # Voice engine config
│   │   ├── voice.js              # Voice service
│   │   └── brain/
│   │       ├── brain.py          # Python voice engine
│   │       └── requirements.txt  # Python dependencies
│   └── data/
│       ├── nature-drips.db.json  # Main data store
│       ├── voice-calls.db.json   # Call queue database
│       └── voice/                # Recorded audio files
└── README.md                     # This file
```

---

## ⚙️ Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Yes |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | Yes |
| `PORT` | Backend server port (default: 3000) | No |
| `VOICE_ENGINE_HOST` | Python voice engine host (default: localhost) | No |
| `VOICE_ENGINE_PORT` | Python voice engine port (default: 3001) | No |

---

## 📦 Deployment

### GitHub Pages (Static Site)

The frontend can be deployed to GitHub Pages:
1. Go to **Settings → Pages**
2. Select `main` branch, root directory
3. Visit `https://thenaturedrip.pk`

### Custom Domain (thenaturedrip.pk)

The `CNAME` file is already configured for custom domain.

### Production Voice Middleware

1. Set environment variables in `.env`
2. Run `node server.js`
3. Configure Twilio webhook to `https://your-domain.com/voice/calls`

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 📬 Contact

**raphd004-byte** — [GitHub](https://github.com/raphd004-byte)  
🌐 Website: https://thenaturedrip.pk
