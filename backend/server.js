const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = '/api';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../')));

// Ensure data directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// In-memory data store (JSON files for persistence)
const DB_FILE = path.join(DATA_DIR, 'nature-drips.db.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) { console.warn('DB load error, starting fresh:', e.message); }
  return getDefaultDB();
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getDefaultDB() {
  return {
    services: [
      {
        id: 'svc-001',
        category: 'hydration',
        icon: '💧',
        title: 'Hydration & Electrolyte Drip',
        description: 'Rapid rehydration with essential electrolytes. Perfect for jet lag recovery, heat exhaustion, or general fatigue.',
        ingredients: ['Sodium', 'Potassium', 'Magnesium', 'Vitamin C'],
        price: 8500,
        currency: 'PKR',
        duration: '30–45 min',
        featured: true,
        image: null
      },
      {
        id: 'svc-002',
        category: 'hydration',
        icon: '🌊',
        title: 'Jet Lag Recovery Drip',
        description: 'Specially formulated for travelers. Rehydrates, restores circadian rhythm-supporting nutrients, and clears travel fatigue fast.',
        ingredients: ['B-Complex', 'Magnesium', 'Electrolytes', 'Glutathione'],
        price: 10500,
        currency: 'PKR',
        duration: '40–50 min',
        featured: false,
        image: null
      },
      {
        id: 'svc-003',
        category: 'immunity',
        icon: '🛡️',
        title: 'Immunity Boost Drip',
        description: 'High-dose Vitamin C, Zinc, and antioxidant-rich blend to strengthen your immune defenses and speed up recovery.',
        ingredients: ['Vitamin C (High-Dose)', 'Zinc', 'Selenium', 'B-Complex'],
        price: 12000,
        currency: 'PKR',
        duration: '45–60 min',
        featured: true,
        image: null
      },
      {
        id: 'svc-004',
        category: 'immunity',
        icon: '🍊',
        title: 'Vitamin C Power Drip',
        description: 'Mega-dose ascorbic acid infusion for antioxidant protection, collagen support, and enhanced immune response.',
        ingredients: ['Vitamin C (5000mg)', 'Glutathione', 'B-Complex'],
        price: 14000,
        currency: 'PKR',
        duration: '45–60 min',
        featured: false,
        image: null
      },
      {
        id: 'svc-005',
        category: 'beauty',
        icon: '✨',
        title: 'Beauty Glow Drip',
        description: 'Glutathione, Biotin, and collagen-building nutrients for radiant skin, stronger hair, and healthier nails.',
        ingredients: ['Glutathione', 'Biotin', 'Vitamin C', 'Zinc'],
        price: 15000,
        currency: 'PKR',
        duration: '45–60 min',
        featured: true,
        image: null
      },
      {
        id: 'svc-006',
        category: 'beauty',
        icon: '💎',
        title: 'Collagen Builder Drip',
        description: 'Nutrient-dense infusion with amino acids and antioxidants that support your body\'s natural collagen production.',
        ingredients: ['Proline', 'Lysine', 'Vitamin C', 'Copper', 'Glutathione'],
        price: 16500,
        currency: 'PKR',
        duration: '50–60 min',
        featured: false,
        image: null
      },
      {
        id: 'svc-007',
        category: 'energy',
        icon: '⚡',
        title: 'Energy & Performance Drip',
        description: 'B-Complex, B12, and amino acid blend for athletes, professionals, and anyone needing a serious energy lift.',
        ingredients: ['B-Complex', 'B12 (High-Dose)', 'Amino Acids', 'Magnesium'],
        price: 13500,
        currency: 'PKR',
        duration: '45–60 min',
        featured: true,
        image: null
      },
      {
        id: 'svc-008',
        category: 'energy',
        icon: '🏃',
        title: 'Athletic Recovery Drip',
        description: 'Post-workout recovery formula with amino acids, electrolytes, and anti-inflammatory nutrients to help you bounce back faster.',
        ingredients: ['Amino Acids', 'Electrolytes', 'B-Complex', 'Vitamin C'],
        price: 14500,
        currency: 'PKR',
        duration: '40–55 min',
        featured: false,
        image: null
      },
      {
        id: 'svc-009',
        category: 'detox',
        icon: '🌿',
        title: 'Detox & Cleanse Drip',
        description: 'Glutathione and antioxidant-rich formulation to combat oxidative stress and support your liver\'s natural detox pathways.',
        ingredients: ['Glutathione (High-Dose)', 'Vitamin C', 'B-Complex', 'Magnesium'],
        price: 15500,
        currency: 'PKR',
        duration: '50–60 min',
        featured: true,
        image: null
      },
      {
        id: 'svc-010',
        category: 'detox',
        icon: '🔄',
        title: 'Antioxidant Shield Drip',
        description: 'A powerful blend of antioxidants to neutralize free radicals, reduce inflammation, and support cellular health.',
        ingredients: ['Glutathione', 'Vitamin C', 'Vitamin E', 'Selenium'],
        price: 13000,
        currency: 'PKR',
        duration: '45–55 min',
        featured: false,
        image: null
      },
      {
        id: 'svc-011',
        category: 'shots',
        icon: '💉',
        title: 'Vitamin B12 Shot (IM)',
        description: 'Fast-acting intramuscular B12 injection for energy, nerve health, and red blood cell production. Takes less than 5 minutes.',
        ingredients: ['Vitamin B12 (Cyanocobalamin)'],
        price: 3500,
        currency: 'PKR',
        duration: '5 min',
        featured: false,
        image: null
      },
      {
        id: 'svc-012',
        category: 'shots',
        icon: '☀️',
        title: 'Vitamin D Shot (IM)',
        description: 'Intramuscular Vitamin D3 injection to support bone health, immunity, and mood — especially helpful during darker months.',
        ingredients: ['Vitamin D3 (Cholecalciferol)'],
        price: 3000,
        currency: 'PKR',
        duration: '5 min',
        featured: false,
        image: null
      },
      {
        id: 'svc-013',
        category: 'shots',
        icon: '🧴',
        title: 'Glutathione Shot (IM)',
        description: 'Express intramuscular glutathione shot for antioxidant support, skin brightening, and detox — quick and convenient.',
        ingredients: ['Glutathione'],
        price: 4500,
        currency: 'PKR',
        duration: '5 min',
        featured: false,
        image: null
      }
    ],
    testimonials: [
      {
        id: 'ts-001',
        name: 'Ayesha Khan',
        initials: 'AK',
        role: 'Karachi · Frequent Traveler',
        text: 'I was skeptical at first, but after my first hydration drip I felt like a completely different person. The jet lag vanished in an hour. Now I book monthly.',
        rating: 5,
        approved: true
      },
      {
        id: 'ts-002',
        name: 'Sana Malik',
        initials: 'SM',
        role: 'Lahore · Beauty Enthusiast',
        text: 'The beauty glow drip is no joke. My skin has never looked this clear. I\'ve recommended Nature Drips to literally everyone in my circle.',
        rating: 5,
        approved: true
      },
      {
        id: 'ts-003',
        name: 'Tahir Hussain',
        initials: 'TH',
        role: 'Islamabad · Marathon Runner',
        text: 'As an athlete, recovery is everything. The B-complex and amino acid blend has noticeably improved my recovery time and energy levels. Worth every rupee.',
        rating: 5,
        approved: true
      }
    ],
    faqs: [
      { id: 'faq-001', question: 'Is IV drip therapy safe?', answer: 'Yes, when administered by trained professionals using sterile equipment. Every Nature Drips session begins with a health screening to identify any contraindications. Our practitioners are certified and follow strict hygiene protocols. However, IV therapy is not suitable for everyone — clients with certain heart conditions, kidney disease, or who are pregnant should consult their physician first.' },
      { id: 'faq-002', question: 'How long does a session take?', answer: 'Most IV drip sessions take 30 to 60 minutes from start to finish. Intramuscular (IM) vitamin shots take less than 5 minutes. The exact duration depends on the specific drip formula and your individual response.' },
      { id: 'faq-003', question: 'Do I need to prepare before my appointment?', answer: 'We recommend eating a light meal and drinking plenty of water before your session. This helps your body absorb the nutrients more effectively and minimizes any mild side effects like lightheadedness. Bring a book or your phone — most clients relax during the drip.' },
      { id: 'faq-004', question: 'How soon will I feel the effects?', answer: 'Many clients report feeling refreshed and energized within hours of their session. Some effects — like improved hydration — are immediate. Others, such as skin improvements from beauty drips, may build up over a few sessions. Results vary based on individual needs and the specific formula.' },
      { id: 'faq-005', question: 'Can I get IV therapy at home?', answer: 'Yes! Nature Drips offers both in-clinic sessions and mobile/at-home concierge services in select cities (Karachi, Lahore, Islamabad). Our mobile team brings the full sterile setup to your home or office. Contact us to check availability in your area.' },
      { id: 'faq-006', question: 'How often should I get IV drips?', answer: 'This depends on your wellness goals. Some clients benefit from weekly sessions (e.g., athletes in training), while others prefer monthly maintenance drips. During your consultation, our practitioner will recommend a schedule tailored to your needs and budget.' },
      { id: 'faq-007', question: 'Do you offer packages or memberships?', answer: 'Yes! We offer discounted multi-session packages and a monthly membership program for regular clients. Reach out to our team or visit our booking page for current package rates and savings.' },
      { id: 'faq-008', question: 'Are there any side effects?', answer: 'Side effects are generally mild and uncommon. Some clients experience a temporary cooling sensation during the infusion, mild bruising at the injection site, or slight lightheadedness. These typically resolve quickly. Serious reactions are rare and our team is trained to handle them.' }
    ],
    siteSettings: {
      siteTitle: 'Nature Drips — Premium IV Drip Therapy & Wellness',
      siteDescription: "Pakistan's premium IV drip therapy and wellness brand. Rehydrate, revitalize, and renew — customized to you.",
      phone: '+92 300 1234567',
      email: 'hello@thenaturedrip.pk',
      locations: 'Karachi · Lahore · Islamabad',
      heroTitle: 'Rehydrate. Revitalize. Renew.',
      heroSubtitle: 'Tailored IV drip therapy and vitamin treatments designed to boost your energy, strengthen your immunity, and bring your natural glow back — delivered by certified wellness professionals.',
      heroBadge: "Pakistan's Premium IV Wellness",
      aboutTitle: 'Wellness, Delivered at the Cellular Level',
      aboutText: 'At Nature Drips, we believe true vitality starts from within. Our medically formulated IV drip therapies bypass the digestive system entirely, delivering 100% of nutrients directly into your bloodstream for faster, more effective absorption.',
      aboutText2: 'Every treatment is personalized after a brief health screening — because your body isn\'t generic, and neither are our blends. Our certified wellness practitioners combine modern science with a holistic, client-first approach.',
      ctaTitle: 'Ready to Feel Your Best?',
      ctaText: 'Book a consultation and let our practitioners design the perfect IV drip for your body and your goals. Your first visit includes a complimentary wellness screening.',
      stats: { clients: '5K+', satisfaction: '98%', avgDuration: '30 min' },
      featuredServiceId: 'svc-001',
      updatedAt: new Date().toISOString()
    }
  };
}

// Helper: generate ID
function genId(prefix) {
  const uuid = require('uuid').v4();
  return `${prefix}-${uuid.slice(0, 8)}`;
}

// Load DB into memory
let db = loadDB();

// ==================== API ROUTES ====================

// Health check
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), dbVersion: '1.0' });
});

// ==================== SERVICES ====================

// Get all services (with optional category filter)
app.get(`${API_PREFIX}/services`, (req, res) => {
  const { category } = req.query;
  let services = db.services;
  if (category && category !== 'all') {
    services = services.filter(s => s.category === category);
  }
  res.json(services);
});

// Get single service
app.get(`${API_PREFIX}/services/:id`, (req, res) => {
  const service = db.services.find(s => s.id === req.params.id);
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

// Create service
app.post(`${API_PREFIX}/services`, (req, res) => {
  const { title, description, category, ingredients, price, duration, icon, featured } = req.body;
  if (!title || !category) {
    return res.status(400).json({ error: 'Title and category are required' });
  }
  const service = {
    id: genId('svc'),
    title,
    description: description || '',
    category,
    ingredients: ingredients || [],
    price: price || 0,
    currency: 'PKR',
    duration: duration || '30 min',
    icon: icon || '💧',
    featured: featured || false,
    image: null,
    createdAt: new Date().toISOString()
  };
  db.services.push(service);
  saveDB(db);
  res.status(201).json(service);
});

// Update service
app.put(`${API_PREFIX}/services/:id`, (req, res) => {
  const idx = db.services.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Service not found' });
  const allowed = ['title', 'description', 'category', 'ingredients', 'price', 'duration', 'icon', 'featured', 'image'];
  const updated = { ...db.services[idx] };
  allowed.forEach(key => {
    if (req.body[key] !== undefined) updated[key] = req.body[key];
  });
  updated.updatedAt = new Date().toISOString();
  db.services[idx] = updated;
  saveDB(db);
  res.json(updated);
});

// Delete service
app.delete(`${API_PREFIX}/services/:id`, (req, res) => {
  const idx = db.services.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Service not found' });
  const deleted = db.services.splice(idx, 1)[0];
  saveDB(db);
  res.json(deleted);
});

// ==================== TESTIMONIALS ====================

app.get(`${API_PREFIX}/testimonials`, (req, res) => {
  res.json(db.testimonials.filter(t => t.approved));
});

app.post(`${API_PREFIX}/testimonials`, (req, res) => {
  const { name, role, text, rating, initials, approved } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Name and text are required' });
  const testimonial = {
    id: genId('ts'),
    name,
    role: role || '',
    text,
    rating: rating || 5,
    initials: initials || name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    approved: approved !== false,
    createdAt: new Date().toISOString()
  };
  db.testimonials.push(testimonial);
  saveDB(db);
  res.status(201).json(testimonial);
});

app.put(`${API_PREFIX}/testimonials/:id`, (req, res) => {
  const idx = db.testimonials.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Testimonial not found' });
  const allowed = ['name', 'role', 'text', 'rating', 'approved', 'initials'];
  const updated = { ...db.testimonials[idx] };
  allowed.forEach(key => {
    if (req.body[key] !== undefined) updated[key] = req.body[key];
  });
  db.testimonials[idx] = updated;
  saveDB(db);
  res.json(updated);
});

app.delete(`${API_PREFIX}/testimonials/:id`, (req, res) => {
  const idx = db.testimonials.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Testimonial not found' });
  const deleted = db.testimonials.splice(idx, 1)[0];
  saveDB(db);
  res.json(deleted);
});

// ==================== FAQ ====================

app.get(`${API_PREFIX}/faqs`, (req, res) => {
  res.json(db.faqs);
});

app.post(`${API_PREFIX}/faqs`, (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });
  const faq = { id: genId('faq'), question, answer, createdAt: new Date().toISOString() };
  db.faqs.push(faq);
  saveDB(db);
  res.status(201).json(faq);
});

app.put(`${API_PREFIX}/faqs/:id`, (req, res) => {
  const idx = db.faqs.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'FAQ not found' });
  const { question, answer } = req.body;
  if (question) db.faqs[idx].question = question;
  if (answer) db.faqs[idx].answer = answer;
  db.faqs[idx].updatedAt = new Date().toISOString();
  saveDB(db);
  res.json(db.faqs[idx]);
});

app.delete(`${API_PREFIX}/faqs/:id`, (req, res) => {
  const idx = db.faqs.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'FAQ not found' });
  const deleted = db.faqs.splice(idx, 1)[0];
  saveDB(db);
  res.json(deleted);
});

// ==================== SITE SETTINGS ====================

app.get(`${API_PREFIX}/settings`, (req, res) => {
  res.json(db.siteSettings);
});

app.put(`${API_PREFIX}/settings`, (req, res) => {
  const allowed = ['siteTitle', 'siteDescription', 'phone', 'email', 'locations',
    'heroTitle', 'heroSubtitle', 'heroBadge', 'aboutTitle', 'aboutText', 'aboutText2',
    'ctaTitle', 'ctaText', 'featuredServiceId'];
  const updated = { ...db.siteSettings };
  allowed.forEach(key => {
    if (req.body[key] !== undefined) updated[key] = req.body[key];
  });
  updated.updatedAt = new Date().toISOString();
  db.siteSettings = updated;
  saveDB(db);
  res.json(updated);
});

// ==================== EXPORT/IMPORT ====================

app.get(`${API_PREFIX}/export`, (req, res) => {
  res.json({ ...db, exportedAt: new Date().toISOString() });
});

app.post(`${API_PREFIX}/import`, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Valid JSON data required' });
  }
  // Merge: replace collections, keep unknown keys
  if (data.services) db.services = data.services;
  if (data.testimonials) db.testimonials = data.testimonials;
  if (data.faqs) db.faqs = data.faqs;
  if (data.siteSettings) db.siteSettings = data.siteSettings;
  saveDB(db);
  res.json({ message: 'Data imported successfully', importedAt: new Date().toISOString() });
});

// ==================== STATS ====================

app.get(`${API_PREFIX}/stats`, (req, res) => {
  res.json({
    totalServices: db.services.length,
    totalTestimonials: db.testimonials.length,
    approvedTestimonials: db.testimonials.filter(t => t.approved).length,
    totalFaqs: db.faqs.length,
    categories: [...new Set(db.services.map(s => s.category))],
    lastUpdated: db.siteSettings.updatedAt
  });
});

// ==================== FALLBACK: serve index.html ====================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n  🌿 Nature Drips API running on http://localhost:${PORT}`);
  console.log(`  📊 API base: http://localhost:${PORT}${API_PREFIX}`);
  console.log(`  📁 Data file: ${DB_FILE}`);
  console.log(`\n  Available endpoints:`);
  console.log(`    GET  ${API_PREFIX}/health`);
  console.log(`    GET  ${API_PREFIX}/services`);
  console.log(`    POST ${API_PREFIX}/services`);
  console.log(`    GET  ${API_PREFIX}/testimonials`);
  console.log(`    POST ${API_PREFIX}/testimonials`);
  console.log(`    GET  ${API_PREFIX}/faqs`);
  console.log(`    POST ${API_PREFIX}/faqs`);
  console.log(`    GET  ${API_PREFIX}/settings`);
  console.log(`    PUT  ${API_PREFIX}/settings`);
  console.log(`    GET  ${API_PREFIX}/export`);
  console.log(`    POST ${API_PREFIX}/import`);
  console.log(`    GET  ${API_PREFIX}/stats`);
  console.log(`  📱 Admin panel: http://localhost:${PORT}/admin.html\n`);
});
