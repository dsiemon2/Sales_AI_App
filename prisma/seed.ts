import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 24 Languages - All Enabled
const languages = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' }
];

// 17 Industries
const industries = [
  { code: 'pen', name: 'General Sales (Pen)', description: 'Classic sales training with pen products', icon: 'bi-pen', colorPrimary: '#2563eb', colorSecondary: '#1d4ed8', colorAccent: '#3b82f6', sortOrder: 1 },
  { code: 'auto', name: 'Automotive Sales', description: 'Vehicle and dealership sales training', icon: 'bi-car-front', colorPrimary: '#0d9488', colorSecondary: '#0f766e', colorAccent: '#14b8a6', sortOrder: 2 },
  { code: 'salon', name: 'Beauty & Salon Services', description: 'Salon and beauty service sales', icon: 'bi-scissors', colorPrimary: '#db2777', colorSecondary: '#be185d', colorAccent: '#ec4899', sortOrder: 3 },
  { code: 'western', name: 'Western Ware & Retail', description: 'Western apparel and retail sales', icon: 'bi-shop', colorPrimary: '#b45309', colorSecondary: '#a16207', colorAccent: '#d97706', sortOrder: 4 },
  { code: 'insurance', name: 'Life Insurance', description: 'Life insurance and financial protection sales', icon: 'bi-shield-check', colorPrimary: '#0369a1', colorSecondary: '#075985', colorAccent: '#0ea5e9', sortOrder: 5 },
  { code: 'solar', name: 'Solar Panel Sales', description: 'Residential and commercial solar sales', icon: 'bi-sun', colorPrimary: '#f59e0b', colorSecondary: '#d97706', colorAccent: '#fbbf24', sortOrder: 6 },
  { code: 'security', name: 'Home & Commercial Security', description: 'Security system sales', icon: 'bi-shield-lock', colorPrimary: '#1e40af', colorSecondary: '#1e3a8a', colorAccent: '#3b82f6', sortOrder: 7 },
  { code: 'doors_windows', name: 'Doors & Windows', description: 'Home improvement sales', icon: 'bi-door-open', colorPrimary: '#64748b', colorSecondary: '#475569', colorAccent: '#94a3b8', sortOrder: 8 },
  { code: 'flooring', name: 'Flooring Sales', description: 'Carpet, hardwood, and flooring sales', icon: 'bi-grid-3x3', colorPrimary: '#8b5cf6', colorSecondary: '#7c3aed', colorAccent: '#a855f7', sortOrder: 9 },
  { code: 'real_estate', name: 'Real Estate', description: 'Property and real estate sales', icon: 'bi-house-door', colorPrimary: '#10b981', colorSecondary: '#059669', colorAccent: '#34d399', sortOrder: 10 },
  { code: 'saas', name: 'SaaS & Software Sales', description: 'B2B software subscription sales', icon: 'bi-cloud', colorPrimary: '#6366f1', colorSecondary: '#4f46e5', colorAccent: '#818cf8', sortOrder: 11 },
  { code: 'fitness', name: 'Fitness & Gym', description: 'Gym membership and personal training sales', icon: 'bi-heart-pulse', colorPrimary: '#ef4444', colorSecondary: '#dc2626', colorAccent: '#f87171', sortOrder: 12 },
  { code: 'hospitality', name: 'Hospitality & Hotels', description: 'Hotel and hospitality sales', icon: 'bi-building', colorPrimary: '#f97316', colorSecondary: '#ea580c', colorAccent: '#fb923c', sortOrder: 13 },
  { code: 'medical', name: 'Medical & Healthcare', description: 'Medical equipment and healthcare sales', icon: 'bi-hospital', colorPrimary: '#06b6d4', colorSecondary: '#0891b2', colorAccent: '#22d3ee', sortOrder: 14 },
  { code: 'food_drink', name: 'Coffee & Specialty Beverages', description: 'Coffee, tea, and specialty beverage sales', icon: 'bi-cup-hot', colorPrimary: '#92400e', colorSecondary: '#78350f', colorAccent: '#b45309', sortOrder: 15 },
  { code: 'dental', name: 'Dental Practice Sales', description: 'Dental service and treatment sales', icon: 'bi-emoji-smile', colorPrimary: '#0284c7', colorSecondary: '#0369a1', colorAccent: '#38bdf8', sortOrder: 16 },
  { code: 'cell_phone', name: 'Wireless & Cell Phone Sales', description: 'Mobile device and plan sales', icon: 'bi-phone', colorPrimary: '#7c3aed', colorSecondary: '#6d28d9', colorAccent: '#a855f7', sortOrder: 17 }
];

// ALL 17 Sample Companies with full data
const sampleCompanies = [
  // 1. PEN SALES
  {
    industry: 'pen',
    company: { name: 'Elite Writing Instruments', slug: 'elite-writing', subscriptionTier: 'professional' },
    users: [
      { email: 'john@elitewriting.com', firstName: 'John', lastName: 'Mitchell', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'sarah@elitewriting.com', firstName: 'Sarah', lastName: 'Johnson', role: 'MANAGER', password: 'Demo123!' },
      { email: 'mike@elitewriting.com', firstName: 'Mike', lastName: 'Thompson', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Executive Signature Pen', sku: 'PEN-001', category: 'executive', tagline: 'Make Every Signature Count', basePrice: 49.99, features: ['Tungsten carbide tip', 'German ink system', 'Lifetime warranty'], benefits: ['Projects professionalism', 'Never skips or smears'], featured: true },
      { name: 'Premium Writing Set', sku: 'PEN-002', category: 'gift', tagline: 'The Perfect Gift', basePrice: 129.99, features: ['Two matching pens', 'Leather case', 'Personalization available'], benefits: ['Impressive gift', 'Complete set'], featured: true },
      { name: 'Daily Writer', sku: 'PEN-003', category: 'everyday', tagline: 'Reliable Daily Performance', basePrice: 24.99, features: ['Ergonomic grip', 'Smooth ink flow', '2-year warranty'], benefits: ['Comfortable writing', 'Great value'] }
    ],
    techniques: [
      { name: 'The Emotional Connection', category: 'discovery', description: 'Build rapport through personal stories', script: 'Tell me about a time when your current pen let you down in an important moment...', effectiveness: 'high' },
      { name: 'Feature-Benefit Bridge', category: 'positioning', description: 'Connect features to customer needs', script: 'You mentioned reliability is important. This pen uses a German-engineered ink system that guarantees smooth flow every time...', effectiveness: 'high' },
      { name: 'Feel-Felt-Found', category: 'objection_handling', description: 'Classic objection handling technique', script: 'I understand how you feel. Others have felt the same way. What they found was...', effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What situations do you find yourself writing in most often?', purpose: 'Identifies writing frequency and context', targetNeed: 'usage_pattern', phase: 'discovery' },
      { question: 'How important is the impression your writing tools make on others?', purpose: 'Reveals status/professionalism needs', targetNeed: 'professionalism', phase: 'discovery' },
      { question: 'Have you ever been frustrated by a pen that skips or smears?', purpose: 'Uncovers reliability concerns', targetNeed: 'reliability', phase: 'discovery' }
    ],
    objections: [
      { objection: "It's too expensive", category: 'price', response: 'I understand price is a consideration. Let me ask - how much would you pay to never have a pen fail you in an important moment?', technique: 'Value Reframe', frequency: 'very_common' },
      { objection: "I don't really need a new pen", category: 'need', response: 'Many of our customers thought the same until they experienced the difference. When was the last time a pen actually impressed you?', technique: 'Create Awareness', frequency: 'common' },
      { objection: "Let me think about it", category: 'timing', response: 'Of course, this is an important decision. What specific concerns would you like to think through?', technique: 'Isolate Concern', frequency: 'common' }
    ],
    closings: [
      { name: 'The Choice Close', type: 'choice', script: 'Would you prefer the Matte Black or the Brushed Silver finish?', useWhen: 'Customer has shown strong interest' },
      { name: 'The Summary Close', type: 'summary', script: "So you're looking for a pen that's reliable, makes a great impression, and comes with a lifetime warranty. This Executive Signature Pen checks all those boxes. Shall we get you started?", useWhen: 'After reviewing all key benefits' },
      { name: 'The Gift Close', type: 'urgency', script: "With the holidays coming up, this would make a perfect gift. Should I wrap one up for you?", useWhen: 'When gift-giving opportunity exists' }
    ]
  },

  // 2. AUTOMOTIVE SALES
  {
    industry: 'auto',
    company: { name: 'Premier Auto Group', slug: 'premier-auto', subscriptionTier: 'business' },
    users: [
      { email: 'tom@premierauto.com', firstName: 'Tom', lastName: 'Anderson', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'lisa@premierauto.com', firstName: 'Lisa', lastName: 'Chen', role: 'MANAGER', password: 'Demo123!' },
      { email: 'david@premierauto.com', firstName: 'David', lastName: 'Williams', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: '2024 Explorer Limited', sku: 'FORD-EXP-24', category: 'SUV', tagline: 'Adventure Awaits', basePrice: 52995, features: ['Twin-turbo V6', 'Leather interior', 'Ford Co-Pilot360'], benefits: ['Family-ready space', 'Premium comfort', 'Advanced safety'], featured: true },
      { name: '2024 F-150 XLT', sku: 'FORD-F150-24', category: 'Truck', tagline: 'Built Ford Tough', basePrice: 44995, features: ['5.0L V8 engine', 'Pro Power Onboard', '12,000 lb towing'], benefits: ['Get the job done', 'Versatile workhorse'], featured: true },
      { name: '2024 Mustang GT', sku: 'FORD-MUST-24', category: 'Sports', tagline: 'Iconic Performance', basePrice: 42995, features: ['5.0L V8', '480 horsepower', 'Track-ready suspension'], benefits: ['Thrilling drive', 'American muscle legend'] }
    ],
    techniques: [
      { name: 'The Test Drive Close', category: 'closing', description: 'Get them behind the wheel', script: "Let's take it for a spin so you can feel the difference. Which color catches your eye?", effectiveness: 'high' },
      { name: 'Trade-In Discovery', category: 'discovery', description: 'Understand their current vehicle', script: "Tell me about your current vehicle. What do you love about it? What would you change?", effectiveness: 'high' },
      { name: 'Lifestyle Matching', category: 'positioning', description: 'Match vehicle to their life', script: "Based on what you've told me about your family and camping trips, the Explorer seems perfect. It has...", effectiveness: 'high' }
    ],
    discoveryQuestions: [
      { question: 'What will you primarily use this vehicle for?', purpose: 'Identifies usage needs', targetNeed: 'primary_use', phase: 'discovery' },
      { question: 'How many people typically travel with you?', purpose: 'Determines seating requirements', targetNeed: 'capacity', phase: 'discovery' },
      { question: "What's most important to you - performance, fuel economy, or safety features?", purpose: 'Prioritizes buying criteria', targetNeed: 'priorities', phase: 'qualification' }
    ],
    objections: [
      { objection: "Your price is too high", category: 'price', response: "I understand budget is important. Let me show you our financing options - many customers are surprised how affordable the monthly payment can be.", technique: 'Payment Focus', frequency: 'very_common' },
      { objection: "I need to check with my spouse", category: 'authority', response: "Absolutely - this is a big decision! Would it help if I put together all the details so you can review them together?", technique: 'Involve Spouse', frequency: 'common' },
      { objection: "I'm just looking today", category: 'timing', response: "No pressure at all - I'm here to help you find the right vehicle when you're ready. What brought you in today?", technique: 'No Pressure', frequency: 'very_common' }
    ],
    closings: [
      { name: 'Test Drive Close', type: 'assumptive', script: "Based on everything you've told me, this Explorer is perfect for your family. Let me get the keys!", useWhen: 'Customer has expressed strong interest' },
      { name: 'Monthly Payment Close', type: 'summary', script: "So for just $549 a month, you get the safety, space, and reliability you want. Shall we start the paperwork?", useWhen: 'After discussing financing' },
      { name: 'Trade-In Close', type: 'urgency', script: "With current incentives and your trade-in value, this is the best time to upgrade.", useWhen: 'End of month promotions' }
    ]
  },

  // 3. SALON SERVICES
  {
    industry: 'salon',
    company: { name: 'Luxe Hair Studio', slug: 'luxe-hair', subscriptionTier: 'professional' },
    users: [
      { email: 'amanda@luxehair.com', firstName: 'Amanda', lastName: 'Roberts', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'jessica@luxehair.com', firstName: 'Jessica', lastName: 'Taylor', role: 'MANAGER', password: 'Demo123!' },
      { email: 'brittany@luxehair.com', firstName: 'Brittany', lastName: 'Moore', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Signature Cut & Style', sku: 'SVC-CUT-01', category: 'haircut', tagline: 'Your Best Look', basePrice: 65, features: ['Consultation', 'Precision cut', 'Styling'], benefits: ['Personalized to your face shape', 'Long-lasting style'], featured: true },
      { name: 'Full Highlight Package', sku: 'SVC-COLOR-01', category: 'color', tagline: 'Dimension & Depth', basePrice: 185, features: ['Full foil highlights', 'Toner', 'Deep conditioning'], benefits: ['Natural-looking dimension', 'Damage protection'], featured: true },
      { name: 'Bridal Hair Design', sku: 'SVC-BRIDAL-01', category: 'special', tagline: 'Your Perfect Day', basePrice: 250, features: ['Trial session', 'Day-of styling', 'Touch-up kit'], benefits: ['Stress-free wedding day', 'Photo-ready hair'] }
    ],
    techniques: [
      { name: 'The Consultation Upsell', category: 'upselling', description: 'Add services during consultation', script: "I notice your ends are a bit dry. A deep conditioning treatment would really bring back the shine.", effectiveness: 'high' },
      { name: 'The Product Prescription', category: 'positioning', description: 'Recommend take-home products', script: "To maintain this look at home, you'll want to use this specific shampoo and conditioner.", effectiveness: 'medium' },
      { name: 'The Rebooking Script', category: 'closing', description: 'Book the next appointment', script: "To keep this color looking fresh, you'll want to come back in 6-8 weeks. What day works best?", effectiveness: 'high' }
    ],
    discoveryQuestions: [
      { question: "What's your daily hair routine like?", purpose: 'Understand maintenance capacity', targetNeed: 'lifestyle', phase: 'discovery' },
      { question: "When's the last time you felt truly great about your hair?", purpose: 'Identify desired outcome', targetNeed: 'satisfaction', phase: 'discovery' },
      { question: 'Do you have any special events coming up?', purpose: 'Identify upsell opportunities', targetNeed: 'events', phase: 'qualification' }
    ],
    objections: [
      { objection: "That's more than I wanted to spend", category: 'price', response: "I totally understand. Let me show you some options at different price points that can still give you a great result.", technique: 'Budget Discovery', frequency: 'common' },
      { objection: "I just want a trim", category: 'scope', response: "Of course! While I'm trimming, I can also show you a few styling techniques that might work great for you.", technique: 'Add Value', frequency: 'common' },
      { objection: "The products are too expensive", category: 'price', response: "A bottle typically lasts 2-3 months, so it's actually about $1 a day for healthier hair.", technique: 'Cost Per Use', frequency: 'common' }
    ],
    closings: [
      { name: 'Mirror Moment', type: 'emotional', script: "What do you think? Look at that shine! This is definitely your color.", useWhen: 'After revealing the finished look' },
      { name: 'Maintenance Close', type: 'assumptive', script: "Your color will look perfect for about 6-8 weeks. Let me get you on the schedule.", useWhen: 'After color service' },
      { name: 'Package Close', type: 'summary', script: "If you book a package of 3 cuts upfront, you save 15%.", useWhen: 'With returning clients' }
    ]
  },

  // 4. WESTERN WARE
  {
    industry: 'western',
    company: { name: 'Prairie Rose Trading Co', slug: 'prairie-rose', subscriptionTier: 'professional' },
    users: [
      { email: 'dusty@prairierose.com', firstName: 'Dusty', lastName: 'Miller', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'grace@prairierose.com', firstName: 'Grace', lastName: 'Walker', role: 'MANAGER', password: 'Demo123!' },
      { email: 'billy@prairierose.com', firstName: 'Billy', lastName: 'Cooper', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Handcrafted Cowboy Boots', sku: 'BOOT-001', category: 'footwear', tagline: 'Built to Last a Lifetime', basePrice: 349.99, features: ['Full-grain leather', 'Goodyear welt construction', 'Custom fitting'], benefits: ['Authentic craftsmanship', 'Generations of quality'], featured: true },
      { name: 'Premium Felt Hat', sku: 'HAT-001', category: 'headwear', tagline: 'The Crown of the West', basePrice: 189.99, features: ['100% beaver felt', 'Hand-shaped', 'Sweat-resistant band'], benefits: ['Classic western style', 'All-weather durability'], featured: true },
      { name: 'Western Work Shirt', sku: 'SHIRT-001', category: 'apparel', tagline: 'Work Hard, Look Good', basePrice: 69.99, features: ['Pearl snap buttons', 'Double-stitched seams', 'Breathable cotton'], benefits: ['Ranch-ready', 'Timeless style'] }
    ],
    techniques: [
      { name: 'Heritage Story', category: 'positioning', description: 'Connect product to western tradition', script: "These boots are made the same way they've been made for over 100 years - by hand, one at a time.", effectiveness: 'high' },
      { name: 'Fit Experience', category: 'discovery', description: 'Focus on proper fit', script: "Let me measure your feet properly. A good boot should feel like it was made just for you.", effectiveness: 'high' },
      { name: 'Occasion Discovery', category: 'discovery', description: 'Understand their needs', script: "What will you primarily be wearing these for - work, riding, or special occasions?", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'Are you looking for work boots or dress boots?', purpose: 'Identifies primary use case', targetNeed: 'usage', phase: 'discovery' },
      { question: 'Do you spend more time in the saddle or on your feet?', purpose: 'Determines heel and sole needs', targetNeed: 'comfort', phase: 'discovery' },
      { question: 'What style fits your personality - traditional or contemporary?', purpose: 'Style preference', targetNeed: 'style', phase: 'qualification' }
    ],
    objections: [
      { objection: "These are expensive compared to big box stores", category: 'price', response: "Those boots might last a year or two. These are an investment that'll last 20 years with proper care. That's about $17 a year.", technique: 'Investment Mindset', frequency: 'very_common' },
      { objection: "I'm not sure about the style", category: 'need', response: "Let me show you a few different options. Western style ranges from subtle to statement - we'll find your perfect fit.", technique: 'Options', frequency: 'common' },
      { objection: "Do you have my size in stock?", category: 'availability', response: "Let me check. If not, we can special order and have them here in about 2 weeks, fitted perfectly for you.", technique: 'Solution', frequency: 'common' }
    ],
    closings: [
      { name: 'Try-On Close', type: 'assumptive', script: "Walk around a bit - feel how comfortable they are? These are definitely your boots.", useWhen: 'After trying on and walking' },
      { name: 'Complete Look Close', type: 'upselling', script: "These boots look amazing with that belt. Should I wrap them together?", useWhen: 'When customer has multiple items' },
      { name: 'Event Close', type: 'urgency', script: "You mentioned the rodeo is in 3 weeks. Let's get you fitted today so they're broken in by then.", useWhen: 'When specific event mentioned' }
    ]
  },

  // 5. LIFE INSURANCE
  {
    industry: 'insurance',
    company: { name: 'Guardian Life Solutions', slug: 'guardian-life', subscriptionTier: 'business' },
    users: [
      { email: 'robert@guardianlife.com', firstName: 'Robert', lastName: 'Harrison', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'nancy@guardianlife.com', firstName: 'Nancy', lastName: 'Clark', role: 'MANAGER', password: 'Demo123!' },
      { email: 'james@guardianlife.com', firstName: 'James', lastName: 'Wilson', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: '20-Year Term Life', sku: 'TERM-20', category: 'term', tagline: 'Protect Your Family', basePrice: 25, features: ['Fixed premiums 20 years', 'Coverage $100K-$10M', 'Convertible to permanent'], benefits: ['Covers mortgage payoff', 'Protects until kids are independent'], featured: true },
      { name: 'Whole Life Insurance', sku: 'WHOLE-LIFE', category: 'permanent', tagline: 'Lifetime Protection', basePrice: 150, features: ['Lifetime coverage', 'Cash value growth', 'Dividends'], benefits: ['Builds wealth', 'Estate planning tool'], featured: true },
      { name: 'Final Expense', sku: 'FINAL-EXP', category: 'final_expense', tagline: 'Leave Love, Not Bills', basePrice: 35, features: ['No medical exam', 'Quick approval', '$5K-$50K coverage'], benefits: ['Covers funeral costs', 'Easy qualification'] }
    ],
    techniques: [
      { name: 'The Family Protection Story', category: 'emotional', description: 'Share impact stories', script: "I recently helped a family where the husband passed unexpectedly. Because he had life insurance, his wife didn't have to sell their home...", effectiveness: 'high' },
      { name: 'The Needs Analysis', category: 'discovery', description: 'Calculate protection needs', script: "Let's calculate exactly what your family would need. Mortgage: $300K. Income replacement: $750K. That's $1.05M in total needs.", effectiveness: 'high' },
      { name: 'The Health Window', category: 'urgency', description: 'Create urgency around health', script: "Your excellent health today qualifies you for our best rates. I've seen people wait a month and then discover a condition that changes everything.", effectiveness: 'high' }
    ],
    discoveryQuestions: [
      { question: 'What would happen to your family financially if you weren\'t here tomorrow?', purpose: 'Identify financial vulnerability', targetNeed: 'protection_gap', phase: 'opening' },
      { question: 'Do you have any life insurance through work?', purpose: 'Identify coverage gaps', targetNeed: 'existing_coverage', phase: 'discovery' },
      { question: 'How many years would you want your family to have income replacement?', purpose: 'Calculate coverage needs', targetNeed: 'income_replacement', phase: 'discovery' }
    ],
    objections: [
      { objection: "I can't afford it right now", category: 'price', response: "For less than a daily coffee - about $1.50 a day - you can protect your family with $500K coverage. The question isn't whether you can afford protection - it's whether your family can afford to be without it.", technique: 'Daily Cost Reframe', frequency: 'very_common' },
      { objection: "I'm young and healthy, I don't need it", category: 'timing', response: "That's exactly why now is the perfect time! A healthy 30-year-old pays half what a 40-year-old pays.", technique: 'Rate Lock', frequency: 'common' },
      { objection: "I have coverage through work", category: 'need', response: "Employer coverage usually only covers 1-2x salary. Would $150K be enough to replace 20 years of income and pay off your mortgage?", technique: 'Gap Analysis', frequency: 'common' }
    ],
    closings: [
      { name: 'Protection Gap Close', type: 'summary', script: "Your family needs $1.2M to cover the mortgage, income, and education. This policy fills that gap for $55/month. Let's get started.", useWhen: 'After needs analysis' },
      { name: 'Health Window Close', type: 'urgency', script: "With your excellent health, you qualify for preferred rates. Let's lock these in today.", useWhen: 'When prospect is healthy' },
      { name: 'Choice Close', type: 'assumptive', script: "I see two options: $500K at $42/month or $750K at $58/month. Which feels right for your family?", useWhen: 'When prospect agrees coverage is needed' }
    ]
  },

  // 6. SOLAR PANEL SALES
  {
    industry: 'solar',
    company: { name: 'SunPower Pro', slug: 'sunpower-pro', subscriptionTier: 'business' },
    users: [
      { email: 'kevin@sunpowerpro.com', firstName: 'Kevin', lastName: 'Garcia', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'maria@sunpowerpro.com', firstName: 'Maria', lastName: 'Rodriguez', role: 'MANAGER', password: 'Demo123!' },
      { email: 'tyler@sunpowerpro.com', firstName: 'Tyler', lastName: 'Brown', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: '8kW Home System', sku: 'SOLAR-8KW', category: 'residential', tagline: 'Power Your Home', basePrice: 18500, features: ['20 high-efficiency panels', 'String inverter', '25-year warranty'], benefits: ['75-90% bill offset', 'Increase home value'], featured: true },
      { name: 'Solar + Battery', sku: 'SOLAR-BATT', category: 'storage', tagline: 'Energy Independence', basePrice: 35000, features: ['8kW solar', '13.5kWh battery', 'Backup power'], benefits: ['Power during outages', 'Maximum savings'], featured: true },
      { name: 'Ground Mount System', sku: 'SOLAR-GROUND', category: 'ground', tagline: 'Perfect for Any Property', basePrice: 28000, features: ['10kW system', 'Optimal angle', 'No roof penetrations'], benefits: ['Best for shaded roofs', 'Easy maintenance'] }
    ],
    techniques: [
      { name: 'The Utility Bill Review', category: 'discovery', description: 'Analyze current costs', script: "Let's look at your electric bill. I see you're paying $250/month - that's $3,000/year to the utility. What if that went into your pocket instead?", effectiveness: 'high' },
      { name: 'The Tax Credit Close', category: 'urgency', description: 'Emphasize the 30% credit', script: "The 30% federal tax credit means $7,500 back in your pocket on this system.", effectiveness: 'high' },
      { name: 'The Payback Calculation', category: 'positioning', description: 'Show the ROI timeline', script: "Your system pays for itself in 5-6 years. After that, you're generating free electricity for 20+ more years.", effectiveness: 'high' }
    ],
    discoveryQuestions: [
      { question: "What's your average monthly electric bill?", purpose: 'Quantify savings potential', targetNeed: 'cost_savings', phase: 'qualification' },
      { question: 'Do you own your home and how long do you plan to stay?', purpose: 'Qualify for ownership and ROI', targetNeed: 'ownership', phase: 'qualification' },
      { question: 'Have you experienced power outages in your area?', purpose: 'Identify battery storage need', targetNeed: 'backup_power', phase: 'discovery' }
    ],
    objections: [
      { objection: "Solar is too expensive", category: 'price', response: "With $0 down financing, your monthly payment is often LESS than your current electric bill. You're replacing an expense with an investment.", technique: 'Payment Comparison', frequency: 'very_common' },
      { objection: "What about when it's cloudy?", category: 'technology', response: "Solar works on cloudy days too. Plus, we design for annual production - sunny day credits cover cloudy days through net metering.", technique: 'Education', frequency: 'common' },
      { objection: "I'm not sure I'll be here long enough", category: 'timing', response: "Homes with solar sell for 4-6% more and 20% faster. You either cash out the equity or transfer the loan.", technique: 'Value Add', frequency: 'common' }
    ],
    closings: [
      { name: 'Savings Comparison Close', type: 'summary', script: "You're paying $250/month to the utility forever. With solar, you pay $180/month for 15 years, then nothing. Ready to start saving?", useWhen: 'After presenting proposal' },
      { name: 'Tax Credit Close', type: 'urgency', script: "The 30% federal credit means $7,500 back. These incentives won't last forever. Let's lock in your savings.", useWhen: 'When discussing incentives' },
      { name: 'Site Survey Close', type: 'assumptive', script: "Based on your roof and usage, this system is perfect. Let me schedule the site survey - Tuesday or Thursday?", useWhen: 'When customer shows interest' }
    ]
  },

  // 7. HOME SECURITY
  {
    industry: 'security',
    company: { name: 'SecureHome Pro', slug: 'securehome-pro', subscriptionTier: 'business' },
    users: [
      { email: 'marcus@securehomepro.com', firstName: 'Marcus', lastName: 'Davis', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'diana@securehomepro.com', firstName: 'Diana', lastName: 'Adams', role: 'MANAGER', password: 'Demo123!' },
      { email: 'brett@securehomepro.com', firstName: 'Brett', lastName: 'Simmons', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Complete Home Security', sku: 'SEC-COMPLETE', category: 'system', tagline: '24/7 Peace of Mind', basePrice: 499, features: ['Control panel', '3 door sensors', '2 motion detectors', 'HD doorbell camera'], benefits: ['Professional monitoring', 'Smart home integration'], featured: true },
      { name: 'Smart Doorbell Pro', sku: 'SEC-DOORBELL', category: 'camera', tagline: 'See Who is There', basePrice: 199, features: ['1080p HD video', 'Two-way audio', 'Night vision'], benefits: ['Package theft prevention', 'Visitor screening'], featured: true },
      { name: 'Indoor Camera Pack', sku: 'SEC-INDOOR', category: 'camera', tagline: 'Watch What Matters', basePrice: 149, features: ['2 indoor cameras', 'Cloud storage', 'Motion alerts'], benefits: ['Pet monitoring', 'Child safety'] }
    ],
    techniques: [
      { name: 'Safety Story', category: 'emotional', description: 'Share protection stories', script: "Last month, one of our customers received a break-in alert while at work. Police arrived in 4 minutes - before the burglar could take anything.", effectiveness: 'high' },
      { name: 'Vulnerability Assessment', category: 'discovery', description: 'Identify security gaps', script: "Looking at your home, I notice you have 3 entry points without sensors and no outdoor cameras. Let me show you how we can protect those.", effectiveness: 'high' },
      { name: 'Insurance Discount', category: 'value', description: 'Highlight savings', script: "Most homeowners get 10-20% off their insurance with a monitored system. That's $200-400 per year.", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What made you start thinking about home security?', purpose: 'Uncover trigger event', targetNeed: 'motivation', phase: 'discovery' },
      { question: 'Do you have any existing security measures in place?', purpose: 'Assess current protection', targetNeed: 'current_state', phase: 'discovery' },
      { question: 'Are there times when your home is unoccupied for extended periods?', purpose: 'Identify vulnerability windows', targetNeed: 'schedule', phase: 'qualification' }
    ],
    objections: [
      { objection: "I've never had a break-in", category: 'need', response: "That's fortunate! But did you know a burglary happens every 25 seconds in America? The question isn't if it could happen, but whether you'll be protected when it does.", technique: 'Statistics', frequency: 'common' },
      { objection: "The monthly monitoring fee is too high", category: 'price', response: "That $29/month includes 24/7 professional monitoring, insurance discounts of $20-40/month, and complete peace of mind. It actually pays for itself.", technique: 'Value Stack', frequency: 'very_common' },
      { objection: "I can just use cameras without monitoring", category: 'alternative', response: "Cameras show you what happened. Professional monitoring actually prevents it and dispatches help in seconds.", technique: 'Differentiation', frequency: 'common' }
    ],
    closings: [
      { name: 'Protection Close', type: 'emotional', script: "Your family's safety shouldn't wait another day. Let's get your system scheduled for installation this week.", useWhen: 'After vulnerability assessment' },
      { name: 'Free Equipment Close', type: 'urgency', script: "Right now, we're offering $500 worth of equipment free with monitoring. This ends this month.", useWhen: 'During promotions' },
      { name: 'Insurance Close', type: 'summary', script: "Between insurance savings and peace of mind, this system essentially pays for itself. Ready to get protected?", useWhen: 'After discussing value' }
    ]
  },

  // 8. DOORS & WINDOWS
  {
    industry: 'doors_windows',
    company: { name: 'Comfort Windows & Doors', slug: 'comfort-windows', subscriptionTier: 'professional' },
    users: [
      { email: 'paul@comfortwindows.com', firstName: 'Paul', lastName: 'Stevens', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'linda@comfortwindows.com', firstName: 'Linda', lastName: 'Baker', role: 'MANAGER', password: 'Demo123!' },
      { email: 'ryan@comfortwindows.com', firstName: 'Ryan', lastName: 'Foster', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Triple-Pane Energy Windows', sku: 'WIN-TRIPLE', category: 'windows', tagline: 'Ultimate Energy Efficiency', basePrice: 599, features: ['Triple-pane glass', 'Argon gas fill', 'Low-E coating'], benefits: ['30-40% energy savings', 'Noise reduction'], featured: true },
      { name: 'Fiberglass Entry Door', sku: 'DOOR-FIBER', category: 'doors', tagline: 'Beauty Meets Durability', basePrice: 1299, features: ['Fiberglass construction', 'Steel frame', 'Multi-point locking'], benefits: ['Will not warp or rot', 'Enhanced security'], featured: true },
      { name: 'Sliding Patio Door', sku: 'DOOR-PATIO', category: 'doors', tagline: 'Seamless Indoor-Outdoor', basePrice: 1599, features: ['Double-pane glass', 'Smooth glide system', 'Built-in blinds option'], benefits: ['More natural light', 'Easy operation'] }
    ],
    techniques: [
      { name: 'Energy Audit', category: 'discovery', description: 'Identify energy loss', script: "Feel that draft? Your old windows are costing you $300-500 a year in wasted energy. Let me show you how much you'd save.", effectiveness: 'high' },
      { name: 'Comfort Touch Test', category: 'positioning', description: 'Demonstrate quality', script: "Touch this window sample. Feel how solid it is compared to your current windows? That's the difference quality makes.", effectiveness: 'high' },
      { name: 'ROI Calculator', category: 'closing', description: 'Show investment return', script: "With energy savings of $400/year, these windows pay for themselves in 7 years - and they last 30+ years.", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'How old are your current windows and doors?', purpose: 'Assess replacement need', targetNeed: 'age', phase: 'qualification' },
      { question: 'Do you notice drafts or temperature inconsistencies in your home?', purpose: 'Identify comfort issues', targetNeed: 'comfort', phase: 'discovery' },
      { question: 'What concerns you most - energy efficiency, appearance, or security?', purpose: 'Prioritize features', targetNeed: 'priorities', phase: 'discovery' }
    ],
    objections: [
      { objection: "That's more than I expected", category: 'price', response: "I understand. Let's look at the financing - for $99/month, you get new windows that save you $35/month in energy. Net cost of $64/month for comfort, beauty, and value.", technique: 'Monthly Payment', frequency: 'very_common' },
      { objection: "I want to get more quotes", category: 'competition', response: "Absolutely! When comparing, ask about glass thickness, warranty length, and installation quality. We stand behind everything.", technique: 'Set Criteria', frequency: 'common' },
      { objection: "We're selling the house soon", category: 'timing', response: "New windows can add 70-80% of their cost to your home value and help it sell faster. They're an investment in sale price.", technique: 'Resale Value', frequency: 'common' }
    ],
    closings: [
      { name: 'Comfort Close', type: 'emotional', script: "Imagine this winter, no drafts, even temperatures throughout the house, lower energy bills. Should we get your order started?", useWhen: 'After discussing comfort benefits' },
      { name: 'Seasonal Close', type: 'urgency', script: "Installation schedules fill up before winter. To have these installed before cold weather, we should order today.", useWhen: 'Fall/pre-winter' },
      { name: 'Financing Close', type: 'summary', script: "For $99/month with 0% interest, you get all new windows with lifetime warranty. Ready to move forward?", useWhen: 'After budget discussion' }
    ]
  },

  // 9. FLOORING SALES
  {
    industry: 'flooring',
    company: { name: 'Premier Flooring Designs', slug: 'premier-flooring', subscriptionTier: 'professional' },
    users: [
      { email: 'anthony@premierflooring.com', firstName: 'Anthony', lastName: 'Rivera', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'susan@premierflooring.com', firstName: 'Susan', lastName: 'Martinez', role: 'MANAGER', password: 'Demo123!' },
      { email: 'josh@premierflooring.com', firstName: 'Josh', lastName: 'Turner', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Luxury Vinyl Plank', sku: 'FLR-LVP', category: 'vinyl', tagline: 'Hardwood Look, Easy Care', basePrice: 4.99, features: ['Waterproof core', 'Scratch resistant', 'Easy click installation'], benefits: ['Pet and kid friendly', 'DIY-able'], featured: true },
      { name: 'Engineered Hardwood', sku: 'FLR-ENG', category: 'hardwood', tagline: 'Real Wood Beauty', basePrice: 7.99, features: ['Real wood veneer', 'Multi-layer stability', 'Refinishable'], benefits: ['Timeless elegance', 'Adds home value'], featured: true },
      { name: 'Plush Carpet', sku: 'FLR-CARPET', category: 'carpet', tagline: 'Soft Underfoot', basePrice: 3.49, features: ['Stain-resistant fiber', 'Comfortable padding', 'Variety of colors'], benefits: ['Warmth and comfort', 'Sound absorption'] }
    ],
    techniques: [
      { name: 'Lifestyle Discovery', category: 'discovery', description: 'Match flooring to life', script: "Tell me about your household - kids, pets, how you use your space. This helps me recommend the perfect flooring.", effectiveness: 'high' },
      { name: 'Sample Experience', category: 'positioning', description: 'Let them feel the product', script: "Take this sample home. Walk on it, see it in your light, show your family. You'll know if it's right.", effectiveness: 'high' },
      { name: 'Room Visualization', category: 'closing', description: 'Help them see the result', script: "Imagine walking into your living room on this beautiful hardwood every day. That's what we're creating for you.", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What rooms are you looking to floor?', purpose: 'Scope the project', targetNeed: 'project_size', phase: 'qualification' },
      { question: 'Do you have pets or young children?', purpose: 'Durability requirements', targetNeed: 'durability', phase: 'discovery' },
      { question: 'What style are you going for - modern, traditional, rustic?', purpose: 'Style preference', targetNeed: 'aesthetics', phase: 'discovery' }
    ],
    objections: [
      { objection: "That's more per square foot than I expected", category: 'price', response: "Think of it as cost per year. At $8/sq ft lasting 25 years vs $3/sq ft lasting 5 years - which is the better value?", technique: 'Long-term Value', frequency: 'very_common' },
      { objection: "We're worried about installation mess", category: 'concern', response: "Our professional installers protect your home and clean up completely. You'll come home to beautiful new floors, not a mess.", technique: 'Reassurance', frequency: 'common' },
      { objection: "We can't decide between options", category: 'decision', response: "Take samples home for a week. See them in your space, your lighting. The right choice will become clear.", technique: 'Take Home Samples', frequency: 'common' }
    ],
    closings: [
      { name: 'Vision Close', type: 'emotional', script: "Picture your family gathered in this room on these beautiful floors. Let's make that vision real - when works for installation?", useWhen: 'After showing samples' },
      { name: 'Package Close', type: 'summary', script: "For the whole house, with installation and warranty, we're at $X. I can hold this price through Friday.", useWhen: 'After full quote' },
      { name: 'Timeline Close', type: 'urgency', script: "With the holidays coming, let's get this done now so you can enjoy your new floors for family gatherings.", useWhen: 'Before holidays' }
    ]
  },

  // 10. REAL ESTATE
  {
    industry: 'real_estate',
    company: { name: 'Hometown Realty', slug: 'hometown-realty', subscriptionTier: 'business' },
    users: [
      { email: 'jennifer@hometownrealty.com', firstName: 'Jennifer', lastName: 'Collins', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'michael@hometownrealty.com', firstName: 'Michael', lastName: 'Ramirez', role: 'MANAGER', password: 'Demo123!' },
      { email: 'katie@hometownrealty.com', firstName: 'Katie', lastName: 'Morgan', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Full-Service Listing', sku: 'RE-FULL', category: 'listing', tagline: 'Maximum Exposure, Maximum Price', basePrice: 5, features: ['Professional photos', 'MLS listing', 'Open houses', 'Negotiation support'], benefits: ['Average 15% higher sale price', 'Faster sale'], featured: true },
      { name: 'Buyer Representation', sku: 'RE-BUYER', category: 'buying', tagline: 'Your Advocate in Every Deal', basePrice: 0, features: ['Market analysis', 'Home showings', 'Offer negotiation', 'Closing coordination'], benefits: ['Pay nothing as buyer', 'Expert guidance'], featured: true },
      { name: 'Home Valuation', sku: 'RE-VALUE', category: 'valuation', tagline: 'Know Your Home is Worth', basePrice: 0, features: ['Comparative analysis', 'Market trends', 'Improvement recommendations'], benefits: ['Informed decisions', 'No obligation'] }
    ],
    techniques: [
      { name: 'Lifestyle Discovery', category: 'discovery', description: 'Understand their dream home', script: "Tell me about your ideal Saturday morning. Where are you, what are you doing? This helps me find your perfect home.", effectiveness: 'high' },
      { name: 'Market Insight', category: 'positioning', description: 'Share local expertise', script: "In this neighborhood, homes are selling in an average of 12 days and 3% over asking. Here's what that means for you...", effectiveness: 'high' },
      { name: 'Emotional Connection', category: 'closing', description: 'Paint the picture', script: "I can see your kids playing in that backyard. This feels like your family's home, doesn't it?", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What made you start thinking about moving?', purpose: 'Understand motivation', targetNeed: 'motivation', phase: 'discovery' },
      { question: 'What are your must-haves versus nice-to-haves?', purpose: 'Prioritize requirements', targetNeed: 'requirements', phase: 'discovery' },
      { question: 'Have you been pre-approved for a mortgage?', purpose: 'Qualify buyer', targetNeed: 'financing', phase: 'qualification' }
    ],
    objections: [
      { objection: "We can sell it ourselves and save the commission", category: 'competition', response: "FSBO homes sell for an average of 15% less. My 6% commission more than pays for itself in the higher price I'll get you.", technique: 'Value Demonstration', frequency: 'common' },
      { objection: "We're not sure about the market right now", category: 'timing', response: "There's never a 'perfect' time. What matters is your situation. Let me show you how current conditions actually work in your favor.", technique: 'Market Education', frequency: 'common' },
      { objection: "We need to sell before we can buy", category: 'logistics', response: "That's common. I have strategies for this - bridge loans, contingent offers, or we time the closings. Let me show you the options.", technique: 'Solutions', frequency: 'common' }
    ],
    closings: [
      { name: 'Dream Home Close', type: 'emotional', script: "This home checks every box on your list. Let's write an offer before someone else does.", useWhen: 'When buyer is excited' },
      { name: 'Market Timing Close', type: 'urgency', script: "Homes in this price range are selling in under a week. If you love it, we need to move today.", useWhen: 'Hot market' },
      { name: 'Listing Close', type: 'summary', script: "With my marketing plan and pricing strategy, I'm confident we'll exceed your expectations. Ready to get started?", useWhen: 'After listing presentation' }
    ]
  },

  // 11. SAAS SOFTWARE SALES
  {
    industry: 'saas',
    company: { name: 'CloudFlow Solutions', slug: 'cloudflow', subscriptionTier: 'professional' },
    users: [
      { email: 'alex@cloudflow.com', firstName: 'Alex', lastName: 'Thompson', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'jennifer@cloudflow.com', firstName: 'Jennifer', lastName: 'Lee', role: 'MANAGER', password: 'Demo123!' },
      { email: 'marcus@cloudflow.com', firstName: 'Marcus', lastName: 'Johnson', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'CloudFlow Professional', sku: 'CF-PRO', category: 'subscription', tagline: 'Streamline Your Operations', basePrice: 99, features: ['Unlimited users', 'API access', 'Custom workflows'], benefits: ['50% time savings', 'Better visibility'], featured: true },
      { name: 'CloudFlow Enterprise', sku: 'CF-ENT', category: 'enterprise', tagline: 'Enterprise-Grade Solution', basePrice: 299, features: ['SSO/SAML', 'Dedicated instance', 'Custom integrations'], benefits: ['Security compliance', 'Unlimited scale'], featured: true },
      { name: 'CloudFlow Starter', sku: 'CF-START', category: 'starter', tagline: 'Start Your Journey', basePrice: 29, features: ['5 users', 'Core features', 'Email support'], benefits: ['Easy onboarding', 'Low commitment'] }
    ],
    techniques: [
      { name: 'The Pain Discovery', category: 'discovery', description: 'Uncover business pain points', script: "Tell me about your current process. Where does it break down? How much time does your team spend on that?", effectiveness: 'high' },
      { name: 'The ROI Calculation', category: 'positioning', description: 'Quantify the business impact', script: "If you're spending 10 hours/week on manual data entry at $50/hour, that's $26,000/year. Our solution automates 80% of that.", effectiveness: 'high' },
      { name: 'The Competitive Trap', category: 'objection_handling', description: 'Handle competitor comparisons', script: "We get compared to [competitor] often. The key difference is our [unique feature] - something they simply can't do.", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What tools are you currently using to manage this?', purpose: 'Understand current stack', targetNeed: 'current_solution', phase: 'discovery' },
      { question: 'How many people are involved in this process?', purpose: 'Scope the opportunity', targetNeed: 'team_size', phase: 'discovery' },
      { question: 'What happens if this problem isn\'t solved in the next 6 months?', purpose: 'Create urgency', targetNeed: 'impact', phase: 'qualification' }
    ],
    objections: [
      { objection: "We're already using [competitor]", category: 'competition', response: "Many of our best customers switched from [competitor]. They found our specific feature saved them an additional 10 hours per week.", technique: 'Switch Story', frequency: 'common' },
      { objection: "We don't have budget right now", category: 'budget', response: "What is this costing you now? If manual processes cost $50K/year and we cut that in half, the ROI is immediate.", technique: 'Cost of Inaction', frequency: 'common' },
      { objection: "We need to involve IT/Legal", category: 'authority', response: "Absolutely - I'd be happy to join a call with them. What are their typical concerns we should address?", technique: 'Expand Circle', frequency: 'very_common' }
    ],
    closings: [
      { name: 'ROI Close', type: 'summary', script: "Based on 15 hours/week savings, CloudFlow saves you $39,000 annually. At $3,600/year, that's 10x ROI. Ready to get started?", useWhen: 'After ROI discussion' },
      { name: 'Pilot Close', type: 'trial', script: "Let's start with a 30-day pilot with your team. You'll see the value firsthand with minimal risk.", useWhen: 'When prospect needs proof' },
      { name: 'Timeline Close', type: 'urgency', script: "You mentioned Q1 goals. To hit those, we need to start implementation by [date]. Should we lock that in?", useWhen: 'Business deadlines' }
    ]
  },

  // 12. FITNESS & GYM
  {
    industry: 'fitness',
    company: { name: 'Peak Performance Gym', slug: 'peak-performance', subscriptionTier: 'professional' },
    users: [
      { email: 'steve@peakgym.com', firstName: 'Steve', lastName: 'Powers', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'kelly@peakgym.com', firstName: 'Kelly', lastName: 'Adams', role: 'MANAGER', password: 'Demo123!' },
      { email: 'chris@peakgym.com', firstName: 'Chris', lastName: 'Morgan', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Premium Membership', sku: 'MEM-PREM', category: 'membership', tagline: 'Unlimited Access', basePrice: 79, features: ['24/7 access', 'All classes', 'Sauna/steam', 'Guest passes'], benefits: ['Flexibility', 'Full access'], featured: true },
      { name: 'Personal Training (8 Sessions)', sku: 'PT-8', category: 'training', tagline: 'Expert Guidance', basePrice: 480, features: ['8 one-hour sessions', 'Custom program', 'Nutrition guidance'], benefits: ['Faster results', 'Accountability'], featured: true },
      { name: 'Basic Membership', sku: 'MEM-BASIC', category: 'membership', tagline: 'Start Your Journey', basePrice: 29, features: ['Gym access', 'Basic equipment'], benefits: ['Affordable start', 'No commitment'] }
    ],
    techniques: [
      { name: 'The Goal Setting Close', category: 'discovery', description: 'Connect membership to goals', script: "You mentioned wanting to lose 20 pounds. Let me show you exactly how we'll help you get there.", effectiveness: 'high' },
      { name: 'The Tour Close', category: 'closing', description: 'End tour at signup desk', script: "Now that you've seen everything, let me show you our membership options. Which features stood out?", effectiveness: 'high' },
      { name: 'The Buddy System', category: 'positioning', description: 'Bring a friend motivation', script: "Working out with a friend makes you 65% more likely to stick with it. Is there someone who'd want to join with you?", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: "What's your main fitness goal right now?", purpose: 'Identify primary motivation', targetNeed: 'goals', phase: 'discovery' },
      { question: 'Have you been a gym member before? What happened?', purpose: 'Uncover barriers', targetNeed: 'history', phase: 'discovery' },
      { question: 'What time of day would you typically work out?', purpose: 'Match to membership', targetNeed: 'schedule', phase: 'qualification' }
    ],
    objections: [
      { objection: "I'll never use it", category: 'commitment', response: "I hear that. That's why we have accountability groups and your first 3 PT sessions included to build your habit.", technique: 'Support System', frequency: 'very_common' },
      { objection: "It's too expensive", category: 'price', response: "Our basic membership is just $29/month - less than a dollar a day. What's reaching your goal worth to you?", technique: 'Value Question', frequency: 'very_common' },
      { objection: "I can work out at home", category: 'alternative', response: "You can! The question is, are you? Research shows gym members exercise 3x more. What's been your experience?", technique: 'Results Focus', frequency: 'common' }
    ],
    closings: [
      { name: 'Today Special Close', type: 'urgency', script: "No enrollment fee ($99 value) and first month free - this expires Saturday. Should we get you started?", useWhen: 'During promotions' },
      { name: 'Goal Timeline Close', type: 'emotional', script: "Your wedding is in 6 months. If you start today, that's 26 weeks to reach your goal. Ready to make it happen?", useWhen: 'Specific deadline' },
      { name: 'Try It Close', type: 'trial', script: "Try us for 7 days completely free. If it's not for you, no hard feelings. What do you have to lose?", useWhen: 'Prospect hesitant' }
    ]
  },

  // 13. HOSPITALITY & HOTELS
  {
    industry: 'hospitality',
    company: { name: 'Grand Horizon Hotels', slug: 'grand-horizon', subscriptionTier: 'business' },
    users: [
      { email: 'victoria@grandhorizon.com', firstName: 'Victoria', lastName: 'Palmer', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'carlos@grandhorizon.com', firstName: 'Carlos', lastName: 'Mendez', role: 'MANAGER', password: 'Demo123!' },
      { email: 'emily@grandhorizon.com', firstName: 'Emily', lastName: 'Scott', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Deluxe King Suite', sku: 'ROOM-KING', category: 'rooms', tagline: 'Luxury Redefined', basePrice: 299, features: ['King bed', 'City view', 'Executive lounge access', 'Spa credits'], benefits: ['Ultimate comfort', 'Premium experience'], featured: true },
      { name: 'Conference Package', sku: 'EVENT-CONF', category: 'events', tagline: 'Perfect Meetings', basePrice: 150, features: ['Meeting room', 'AV equipment', 'Catering', 'Breakout rooms'], benefits: ['Productive meetings', 'All-inclusive'], featured: true },
      { name: 'Wedding Package', sku: 'EVENT-WEDDING', category: 'events', tagline: 'Your Dream Day', basePrice: 5000, features: ['Ballroom', 'Catering', 'Decor', 'Coordination'], benefits: ['Stress-free planning', 'Unforgettable memories'] }
    ],
    techniques: [
      { name: 'Experience Selling', category: 'positioning', description: 'Sell the experience', script: "Imagine waking up to this view, having breakfast delivered to your suite, then walking right into your morning meeting downstairs...", effectiveness: 'high' },
      { name: 'Upgrade Presentation', category: 'upselling', description: 'Present room upgrades', script: "For just $50 more per night, you'd be in our executive suite with lounge access - that includes free breakfast and cocktails.", effectiveness: 'high' },
      { name: 'Group Discovery', category: 'discovery', description: 'Understand event needs', script: "Tell me about your event. What's the purpose? What outcomes do you need? What would make it a success?", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What brings you to our city?', purpose: 'Understand trip purpose', targetNeed: 'purpose', phase: 'discovery' },
      { question: 'Is this a special occasion we should know about?', purpose: 'Upsell opportunities', targetNeed: 'occasion', phase: 'discovery' },
      { question: 'How many guests are you expecting for your event?', purpose: 'Size the opportunity', targetNeed: 'capacity', phase: 'qualification' }
    ],
    objections: [
      { objection: "Your rates are higher than the chain hotels", category: 'price', response: "Those hotels charge extra for WiFi, parking, and breakfast. Our all-inclusive approach often works out the same or less, with far better service.", technique: 'Total Value', frequency: 'common' },
      { objection: "We're considering another venue for our event", category: 'competition', response: "I'd love to know what features are important to you. Let me show you what makes our events truly special.", technique: 'Discovery', frequency: 'common' },
      { objection: "We need to check some things first", category: 'timing', response: "Of course. Our best rates are available now - shall I hold the room/venue for 48 hours while you confirm?", technique: 'Soft Hold', frequency: 'common' }
    ],
    closings: [
      { name: 'Experience Close', type: 'emotional', script: "Picture your guests arriving to this beautiful space, the seamless service, the memories you'll create. Shall we reserve your date?", useWhen: 'After venue tour' },
      { name: 'Limited Availability Close', type: 'urgency', script: "That weekend only has one ballroom available. To secure your date, we'll need a deposit today.", useWhen: 'Popular dates' },
      { name: 'Upgrade Close', type: 'assumptive', script: "I've put together the executive package for you. Should I proceed with the reservation?", useWhen: 'After showing value' }
    ]
  },

  // 14. MEDICAL & HEALTHCARE
  {
    industry: 'medical',
    company: { name: 'MedTech Solutions', slug: 'medtech-solutions', subscriptionTier: 'enterprise' },
    users: [
      { email: 'dr.wilson@medtechsolutions.com', firstName: 'Dr. William', lastName: 'Wilson', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'sarah@medtechsolutions.com', firstName: 'Sarah', lastName: 'Chen', role: 'MANAGER', password: 'Demo123!' },
      { email: 'andrew@medtechsolutions.com', firstName: 'Andrew', lastName: 'Price', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Diagnostic Imaging Suite', sku: 'MED-IMAGING', category: 'equipment', tagline: 'Precision Diagnosis', basePrice: 250000, features: ['High-resolution imaging', 'AI-assisted analysis', 'Cloud storage'], benefits: ['Faster diagnosis', 'Better outcomes'], featured: true },
      { name: 'Patient Management System', sku: 'MED-PMS', category: 'software', tagline: 'Streamline Your Practice', basePrice: 500, features: ['EHR integration', 'Scheduling', 'Billing', 'Telehealth'], benefits: ['Reduce admin time', 'Improve patient experience'], featured: true },
      { name: 'Medical Supplies Package', sku: 'MED-SUPPLIES', category: 'supplies', tagline: 'Quality You Can Trust', basePrice: 2000, features: ['Premium supplies', 'Auto-replenishment', 'Volume discounts'], benefits: ['Never run out', 'Cost savings'] }
    ],
    techniques: [
      { name: 'Outcome Focus', category: 'positioning', description: 'Focus on patient outcomes', script: "This technology has been shown to improve diagnostic accuracy by 23%, leading to earlier interventions and better patient outcomes.", effectiveness: 'high' },
      { name: 'ROI in Healthcare', category: 'discovery', description: 'Calculate financial impact', script: "How many patients do you see weekly? With our system, you could reduce time per patient by 15 minutes while improving care quality.", effectiveness: 'high' },
      { name: 'Compliance Selling', category: 'positioning', description: 'Address regulatory needs', script: "This solution is fully HIPAA compliant and includes automatic updates as regulations change.", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What are your biggest operational challenges right now?', purpose: 'Identify pain points', targetNeed: 'challenges', phase: 'discovery' },
      { question: 'How do you currently handle [specific process]?', purpose: 'Understand current state', targetNeed: 'current_process', phase: 'discovery' },
      { question: 'What patient outcomes are you most focused on improving?', purpose: 'Align with priorities', targetNeed: 'outcomes', phase: 'qualification' }
    ],
    objections: [
      { objection: "The capital expenditure is too high", category: 'price', response: "Let's look at the lease option - it spreads the cost over 5 years and the improved efficiency typically covers the payment.", technique: 'Financing Options', frequency: 'very_common' },
      { objection: "We need to go through a committee", category: 'authority', response: "Absolutely. I can prepare a comprehensive proposal for the committee. What information would be most valuable for their decision?", technique: 'Support Process', frequency: 'very_common' },
      { objection: "We're concerned about implementation disruption", category: 'concern', response: "We've helped 500+ practices transition smoothly. Our team handles everything after hours with minimal disruption to patients.", technique: 'Experience', frequency: 'common' }
    ],
    closings: [
      { name: 'Patient Care Close', type: 'emotional', script: "Every day without this technology is another day your patients aren't getting the best possible care. Let's move forward.", useWhen: 'After outcome discussion' },
      { name: 'Budget Cycle Close', type: 'urgency', script: "To get this into next year's budget, we need to start the evaluation now. Shall we schedule a demo for the committee?", useWhen: 'Budget planning season' },
      { name: 'Trial Close', type: 'trial', script: "Let's start with a 90-day pilot in one department. You'll see the results before committing facility-wide.", useWhen: 'Large purchases' }
    ]
  },

  // 15. COFFEE & SPECIALTY BEVERAGES
  {
    industry: 'food_drink',
    company: { name: 'Artisan Coffee Roasters', slug: 'artisan-coffee', subscriptionTier: 'professional' },
    users: [
      { email: 'maria@artisancoffee.com', firstName: 'Maria', lastName: 'Santos', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'james@artisancoffee.com', firstName: 'James', lastName: 'Chen', role: 'MANAGER', password: 'Demo123!' },
      { email: 'olivia@artisancoffee.com', firstName: 'Olivia', lastName: 'Thompson', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Single-Origin Ethiopian', sku: 'COFFEE-ETH', category: 'coffee', tagline: 'Birthplace of Coffee', basePrice: 18.99, features: ['Light roast', 'Fruity notes', 'Fair trade certified'], benefits: ['Complex flavor', 'Ethically sourced'], featured: true },
      { name: 'Premium Tea Collection', sku: 'TEA-PREMIUM', category: 'tea', tagline: 'The Finest Leaves', basePrice: 24.99, features: ['6 varieties', 'Loose leaf', 'Gift box included'], benefits: ['Health benefits', 'Perfect gift'], featured: true },
      { name: 'Monthly Coffee Subscription', sku: 'SUB-COFFEE', category: 'subscription', tagline: 'Fresh to Your Door', basePrice: 34.99, features: ['2 bags monthly', 'Rotating origins', 'Free shipping'], benefits: ['Never run out', 'Discover new favorites'] }
    ],
    techniques: [
      { name: 'Tasting Experience', category: 'positioning', description: 'Engage the senses', script: "Let me brew this for you. Notice the aroma first - that's the Ethiopian terroir. Now taste - do you get the blueberry notes?", effectiveness: 'high' },
      { name: 'Origin Story', category: 'positioning', description: 'Share the coffee journey', script: "This coffee comes from a small cooperative in Sidamo. Every purchase directly supports 200 farming families.", effectiveness: 'high' },
      { name: 'Brewing Discovery', category: 'discovery', description: 'Understand their habits', script: "How do you typically brew your coffee at home? That helps me recommend the perfect grind and roast for you.", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What do you usually drink - coffee or tea?', purpose: 'Product direction', targetNeed: 'preference', phase: 'discovery' },
      { question: 'How do you like your coffee - strong, mild, fruity, chocolatey?', purpose: 'Flavor preference', targetNeed: 'taste', phase: 'discovery' },
      { question: 'How many cups do you drink per day?', purpose: 'Consumption level', targetNeed: 'volume', phase: 'qualification' }
    ],
    objections: [
      { objection: "This is more expensive than grocery store coffee", category: 'price', response: "It works out to about 50 cents more per cup for dramatically better taste. Once you taste the difference, grocery store coffee will never be the same.", technique: 'Cost Per Cup', frequency: 'very_common' },
      { objection: "I'm happy with what I have", category: 'need', response: "Many of our best customers said that - until they tried a proper specialty coffee. Can I offer you a sample to take home?", technique: 'Sample Offer', frequency: 'common' },
      { objection: "I don't know how to brew specialty coffee", category: 'concern', response: "We include brewing guides with every order. And I'm here anytime for tips. It's easier than you think!", technique: 'Support', frequency: 'common' }
    ],
    closings: [
      { name: 'Sample Close', type: 'trial', script: "Take this sample home. If you love it as much as I think you will, come back for a bag. Fair?", useWhen: 'First-time customer' },
      { name: 'Subscription Close', type: 'summary', script: "The subscription saves you 20% and ensures you never run out. Plus, you can change or cancel anytime.", useWhen: 'Regular purchaser' },
      { name: 'Gift Close', type: 'emotional', script: "This would make a perfect gift for a coffee lover. Should I wrap it up?", useWhen: 'Gift-giving occasions' }
    ]
  },

  // 16. DENTAL PRACTICE
  {
    industry: 'dental',
    company: { name: 'Smile Dental Care', slug: 'smile-dental', subscriptionTier: 'professional' },
    users: [
      { email: 'dr.patel@smiledentalcare.com', firstName: 'Dr. Priya', lastName: 'Patel', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'michelle@smiledentalcare.com', firstName: 'Michelle', lastName: 'Roberts', role: 'MANAGER', password: 'Demo123!' },
      { email: 'jason@smiledentalcare.com', firstName: 'Jason', lastName: 'Lee', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'Professional Teeth Whitening', sku: 'DENT-WHITEN', category: 'cosmetic', tagline: 'Brighten Your Smile', basePrice: 399, features: ['In-office treatment', 'Take-home kit included', '8 shades lighter'], benefits: ['Confidence boost', 'Lasting results'], featured: true },
      { name: 'Invisalign Treatment', sku: 'DENT-INVIS', category: 'orthodontic', tagline: 'Invisible Transformation', basePrice: 4500, features: ['Clear aligners', 'Custom treatment plan', 'Regular check-ins'], benefits: ['Discreet straightening', 'Removable convenience'], featured: true },
      { name: 'Complete Exam & Cleaning', sku: 'DENT-EXAM', category: 'preventive', tagline: 'Foundation of Oral Health', basePrice: 175, features: ['Full exam', 'X-rays', 'Professional cleaning', 'Oral cancer screening'], benefits: ['Early detection', 'Fresh clean feeling'] }
    ],
    techniques: [
      { name: 'Visual Education', category: 'positioning', description: 'Show before/after', script: "Let me show you some before and after photos of patients with similar concerns. See the transformation? That could be you.", effectiveness: 'high' },
      { name: 'Health Connection', category: 'discovery', description: 'Link dental to overall health', script: "Did you know gum disease is linked to heart disease and diabetes? Taking care of your teeth protects your whole body.", effectiveness: 'high' },
      { name: 'Anxiety Acknowledgment', category: 'objection_handling', description: 'Address dental fear', script: "I hear you - many of our patients felt the same way. That's why we offer sedation options. You'll be completely comfortable.", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'How long has it been since your last dental visit?', purpose: 'Assess urgency', targetNeed: 'current_state', phase: 'discovery' },
      { question: "Is there anything about your smile you'd like to change?", purpose: 'Cosmetic opportunity', targetNeed: 'aesthetics', phase: 'discovery' },
      { question: 'Do you have any dental anxieties we should know about?', purpose: 'Address fears', targetNeed: 'comfort', phase: 'qualification' }
    ],
    objections: [
      { objection: "I don't have dental insurance", category: 'price', response: "We offer our own membership plan - $299/year covers all your preventive care and gives you 20% off treatments. Better than most insurance!", technique: 'Alternative Plan', frequency: 'very_common' },
      { objection: "I'm scared of the dentist", category: 'concern', response: "You're not alone - 75% of adults have some dental anxiety. We specialize in anxious patients with sedation options and a gentle approach.", technique: 'Empathy', frequency: 'common' },
      { objection: "I'll think about the cosmetic work", category: 'timing', response: "I understand it's a decision. Let me give you our financing info - most patients are surprised how affordable monthly payments are.", technique: 'Financing', frequency: 'common' }
    ],
    closings: [
      { name: 'Health Close', type: 'emotional', script: "Taking care of this now prevents more expensive and painful problems later. Let's get you scheduled for treatment.", useWhen: 'After diagnosis' },
      { name: 'Special Close', type: 'urgency', script: "We're offering 20% off whitening this month. Shall I add that to your cleaning appointment?", useWhen: 'During promotions' },
      { name: 'Financing Close', type: 'summary', script: "With CareCredit, your Invisalign is just $150/month with 0% interest. Should we start your treatment plan?", useWhen: 'Larger treatments' }
    ]
  },

  // 17. CELL PHONE & WIRELESS
  {
    industry: 'cell_phone',
    company: { name: 'Wireless World', slug: 'wireless-world', subscriptionTier: 'business' },
    users: [
      { email: 'derek@wirelessworld.com', firstName: 'Derek', lastName: 'Zhang', role: 'COMPANY_ADMIN', password: 'Demo123!' },
      { email: 'tiffany@wirelessworld.com', firstName: 'Tiffany', lastName: 'Johnson', role: 'MANAGER', password: 'Demo123!' },
      { email: 'brandon@wirelessworld.com', firstName: 'Brandon', lastName: 'Wilson', role: 'TRAINEE', password: 'Demo123!' }
    ],
    products: [
      { name: 'iPhone 15 Pro Max', sku: 'PHONE-IP15PM', category: 'phones', tagline: 'The Ultimate iPhone', basePrice: 1199, features: ['Titanium design', 'A17 Pro chip', 'Pro camera system'], benefits: ['Best photos ever', 'Gaming powerhouse'], featured: true },
      { name: 'Samsung Galaxy S24 Ultra', sku: 'PHONE-S24U', category: 'phones', tagline: 'Galaxy AI Built In', basePrice: 1299, features: ['AI features', 'S Pen included', '200MP camera'], benefits: ['Productivity boost', 'Creative freedom'], featured: true },
      { name: 'Unlimited Plus Plan', sku: 'PLAN-UNLIM', category: 'plans', tagline: 'Truly Unlimited', basePrice: 75, features: ['Unlimited data', '5G access', 'Hotspot included', 'Streaming perks'], benefits: ['Never worry about data', 'Full speed always'] }
    ],
    techniques: [
      { name: 'Usage Analysis', category: 'discovery', description: 'Understand their usage', script: "Looking at your current plan, you're paying for data you're not using. Let me show you a plan that saves you $30/month.", effectiveness: 'high' },
      { name: 'Feature Demo', category: 'positioning', description: 'Hands-on experience', script: "Let me show you this camera feature - take a photo of something and watch what the AI does. Pretty amazing, right?", effectiveness: 'high' },
      { name: 'Family Savings', category: 'upselling', description: 'Bundle family plans', script: "If you add your family members, you'd all save. 4 lines on unlimited is actually cheaper per line than what you're paying now.", effectiveness: 'medium' }
    ],
    discoveryQuestions: [
      { question: 'What do you use your phone for most?', purpose: 'Feature priorities', targetNeed: 'usage', phase: 'discovery' },
      { question: 'How much data do you typically use?', purpose: 'Right-size plan', targetNeed: 'data_needs', phase: 'qualification' },
      { question: 'Is anyone else on your plan or considering switching?', purpose: 'Family opportunity', targetNeed: 'family', phase: 'qualification' }
    ],
    objections: [
      { objection: "I can get this phone cheaper online", category: 'price', response: "You might, but you won't get our in-store support, same-day setup, and screen protector included. Plus, our trade-in values are typically higher.", technique: 'Added Value', frequency: 'common' },
      { objection: "I'm locked into my current carrier", category: 'switching', response: "We'll pay off your current phone - up to $800. Plus, we often have better coverage and speeds in this area.", technique: 'Switching Help', frequency: 'very_common' },
      { objection: "My current phone still works fine", category: 'need', response: "I get it! But with 5G and these new AI features, you're missing out on a much better experience. Plus, your trade-in value drops every month.", technique: 'FOMO', frequency: 'common' }
    ],
    closings: [
      { name: 'Trade-In Close', type: 'urgency', script: "Your current phone is worth $400 today, but that drops $50 next month. Let's lock in that value now.", useWhen: 'Trade-in opportunity' },
      { name: 'Family Bundle Close', type: 'summary', script: "With 4 lines, you're getting unlimited everything for $45/line. Plus 4 new phones with trade-ins. Ready to switch?", useWhen: 'Family plan' },
      { name: 'Same-Day Close', type: 'assumptive', script: "I can have you walking out with your new phone, fully set up and data transferred, in about 30 minutes. Let's get started.", useWhen: 'Customer interested' }
    ]
  }
];

async function main() {
  console.log('Starting comprehensive database seed for ALL 17 INDUSTRIES...');

  // Clean up existing company-specific data to prevent duplicates
  console.log('Cleaning up existing data...');

  await prisma.sessionMessage.deleteMany({});
  await prisma.sessionAnalytics.deleteMany({});
  await prisma.salesSession.deleteMany({});
  await prisma.closingStrategy.deleteMany({});
  await prisma.objectionHandler.deleteMany({});
  await prisma.discoveryQuestion.deleteMany({});
  await prisma.salesTechnique.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.stylist.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.companyStoreInfo.deleteMany({});
  await prisma.companyBranding.deleteMany({});
  await prisma.user.deleteMany({ where: { role: { not: 'SUPER_ADMIN' } } });
  await prisma.company.deleteMany({});

  console.log('✓ Cleaned up existing data');

  // Seed Languages
  console.log('Seeding 24 languages...');
  for (let i = 0; i < languages.length; i++) {
    await prisma.language.upsert({
      where: { code: languages[i].code },
      update: { enabled: true },
      create: { ...languages[i], enabled: true, sortOrder: i + 1 }
    });
  }
  console.log(`✓ Seeded ${languages.length} languages (all enabled)`);

  // Seed Industries
  console.log('Seeding 17 industries...');
  for (const industry of industries) {
    await prisma.industry.upsert({
      where: { code: industry.code },
      update: {},
      create: { ...industry, isActive: true }
    });
  }
  console.log(`✓ Seeded ${industries.length} industries`);

  // Create Super Admin user
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@apexsalesai.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!';
  const hashedSuperAdminPassword = await bcrypt.hash(superAdminPassword, 12);

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { email: superAdminEmail, companyId: null }
  });

  if (!existingSuperAdmin) {
    await prisma.user.create({
      data: {
        email: superAdminEmail,
        password: hashedSuperAdminPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        emailVerified: true,
        isActive: true
      }
    });
    console.log(`✓ Super admin created: ${superAdminEmail} / ${superAdminPassword}`);
  } else {
    console.log(`✓ Super admin already exists: ${superAdminEmail}`);
  }

  // Create Sample Companies for ALL 17 industries
  console.log(`\nSeeding ${sampleCompanies.length} sample companies with full data...\n`);

  for (const sample of sampleCompanies) {
    const industry = await prisma.industry.findUnique({ where: { code: sample.industry } });
    if (!industry) {
      console.log(`  ⚠ Industry ${sample.industry} not found, skipping`);
      continue;
    }

    // Create company
    const company = await prisma.company.upsert({
      where: { slug: sample.company.slug },
      update: {},
      create: {
        name: sample.company.name,
        slug: sample.company.slug,
        industryId: industry.id,
        subscriptionTier: sample.company.subscriptionTier,
        subscriptionStatus: 'active',
        isActive: true
      }
    });
    console.log(`✓ Company: ${sample.company.name} (${sample.industry})`);

    // Create company branding
    await prisma.companyBranding.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        primaryColor: industry.colorPrimary,
        secondaryColor: industry.colorSecondary,
        accentColor: industry.colorAccent
      }
    });

    // Create users
    for (const user of sample.users) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      const existingUser = await prisma.user.findUnique({
        where: { email_companyId: { email: user.email, companyId: company.id } }
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: user.email,
            password: hashedPassword,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            companyId: company.id,
            emailVerified: true,
            isActive: true
          }
        });
        console.log(`  ✓ User: ${user.email} (${user.role})`);
      }
    }

    // Create products
    if (sample.products) {
      for (const product of sample.products) {
        await prisma.product.create({
          data: {
            ...product,
            companyId: company.id,
            features: product.features || [],
            benefits: product.benefits || [],
            isActive: true
          }
        });
      }
      console.log(`  ✓ ${sample.products.length} products created`);
    }

    // Create techniques
    if (sample.techniques) {
      for (let i = 0; i < sample.techniques.length; i++) {
        await prisma.salesTechnique.create({
          data: {
            ...sample.techniques[i],
            companyId: company.id,
            tips: [],
            examples: [],
            bestFor: [],
            isActive: true,
            sortOrder: i + 1
          }
        });
      }
      console.log(`  ✓ ${sample.techniques.length} techniques created`);
    }

    // Create discovery questions
    if (sample.discoveryQuestions) {
      for (let i = 0; i < sample.discoveryQuestions.length; i++) {
        await prisma.discoveryQuestion.create({
          data: {
            ...sample.discoveryQuestions[i],
            companyId: company.id,
            isActive: true,
            sortOrder: i + 1
          }
        });
      }
      console.log(`  ✓ ${sample.discoveryQuestions.length} discovery questions created`);
    }

    // Create objection handlers
    if (sample.objections) {
      for (let i = 0; i < sample.objections.length; i++) {
        await prisma.objectionHandler.create({
          data: {
            ...sample.objections[i],
            companyId: company.id,
            isActive: true,
            sortOrder: i + 1
          }
        });
      }
      console.log(`  ✓ ${sample.objections.length} objection handlers created`);
    }

    // Create closing strategies
    if (sample.closings) {
      for (let i = 0; i < sample.closings.length; i++) {
        await prisma.closingStrategy.create({
          data: {
            ...sample.closings[i],
            companyId: company.id,
            tips: [],
            isActive: true,
            sortOrder: i + 1
          }
        });
      }
      console.log(`  ✓ ${sample.closings.length} closing strategies created`);
    }

    // Create AI Tools for this company
    const aiTools = [
      { name: 'Product Lookup', functionName: 'getProductInfo', description: 'Search and retrieve product information', parameters: { productId: 'string', query: 'string' } },
      { name: 'Check Inventory', functionName: 'checkInventory', description: 'Check product availability and stock levels', parameters: { productId: 'string', quantity: 'number' } },
      { name: 'Calculate Quote', functionName: 'calculateQuote', description: 'Generate price quotes based on selections', parameters: { items: 'array', discountCode: 'string' } },
      { name: 'Schedule Appointment', functionName: 'scheduleAppointment', description: 'Book appointments and demonstrations', parameters: { date: 'string', time: 'string', customerInfo: 'object' } }
    ];
    for (const tool of aiTools) {
      await prisma.aITool.create({
        data: { ...tool, companyId: company.id, isActive: true }
      });
    }
    console.log(`  ✓ ${aiTools.length} AI tools created`);

    // Create AI Agents for this company
    const aiAgents = [
      { name: 'Sales Training Coach', description: 'Primary AI coach for sales training sessions', type: 'training', persona: 'Encouraging and knowledgeable sales mentor', instructions: 'You are an expert sales training coach. Help trainees improve their sales techniques through role-play scenarios.', isDefault: true },
      { name: 'Customer Simulator', description: 'Simulates various customer personalities for practice', type: 'demo', persona: 'Realistic customer with objections', instructions: 'Simulate a realistic customer in a sales scenario. Present objections naturally and respond based on the quality of the sales approach.' },
      { name: 'Performance Analyzer', description: 'Analyzes sales performance and provides feedback', type: 'support', persona: 'Objective performance analyst', instructions: 'Analyze sales conversations and provide constructive feedback on technique usage, rapport building, and closing effectiveness.' }
    ];
    for (const agent of aiAgents) {
      await prisma.aIAgent.create({
        data: { ...agent, companyId: company.id, isActive: true }
      });
    }
    console.log(`  ✓ ${aiAgents.length} AI agents created`);

    // Create Knowledge Base articles for this company
    const knowledgeArticles = [
      { title: 'Getting Started Guide', category: 'onboarding', content: 'Welcome to your sales training platform. This guide will help you get started with your first training session.', sortOrder: 1 },
      { title: 'Product Knowledge Basics', category: 'products', content: 'Understanding your products is essential for effective selling. Learn the key features and benefits here.', sortOrder: 2 },
      { title: 'Handling Common Objections', category: 'techniques', content: 'Learn proven techniques for handling the most common customer objections in your industry.', sortOrder: 3 },
      { title: 'Closing Techniques Master Guide', category: 'techniques', content: 'Master the art of closing with these proven strategies that turn prospects into customers.', sortOrder: 4 },
      { title: 'Discovery Questions Framework', category: 'techniques', content: 'Effective discovery is the foundation of successful sales. Learn to ask the right questions at the right time.', sortOrder: 5 }
    ];
    for (const article of knowledgeArticles) {
      await prisma.knowledgeArticle.create({
        data: { ...article, companyId: company.id, isActive: true, tags: [] }
      });
    }
    console.log(`  ✓ ${knowledgeArticles.length} knowledge base articles created`);

    // Create AI Config for this company
    await prisma.aIConfig.create({
      data: {
        companyId: company.id,
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: `You are a helpful sales training assistant for ${company.name}. Help trainees improve their sales skills through interactive practice and feedback.`,
        greeting: `Welcome to ${company.name}! I'm your AI sales training coach. I'm here to help you practice your sales techniques in a realistic, supportive environment. Would you like to start a practice session, review sales techniques, or get tips on handling objections?`,
        voiceId: 'alloy',
        language: 'en',
        responseStyle: 'professional',
        verbosity: 'balanced'
      }
    });
    console.log(`  ✓ AI configuration with greeting created`);

    // Create Payment Settings for this company with sample Stripe test keys
    await prisma.companyPaymentSettings.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        enabled: true,
        stripeEnabled: true,
        stripePublishableKey: 'pk_test_51ABC123DEF456GHI789JKL0MNOPQRSTUVWXYZabcdefghijklmnop',
        stripeSecretKey: 'sk_test_51ABC123DEF456GHI789JKL0MNOPQRSTUVWXYZabcdefghijklmnop',
        stripeWebhookSecret: 'whsec_test_abcdefghijklmnopqrstuvwxyz123456',
        stripeAchEnabled: false,
        stripeTestMode: true,
        paypalEnabled: false,
        paypalTestMode: true,
        squareEnabled: false,
        squareTestMode: true,
        authorizeEnabled: false,
        authorizeTestMode: true,
        braintreeEnabled: false,
        braintreeTestMode: true
      }
    });
    console.log(`  ✓ Payment settings created with sample Stripe test keys`);

    // Create sample sales sessions
    const companyUsers = await prisma.user.findMany({ where: { companyId: company.id } });
    const companyProducts = await prisma.product.findMany({ where: { companyId: company.id } });
    const outcomes = ['completed', 'completed', 'completed', 'sale_made', 'sale_made', 'no_sale', 'abandoned', 'in_progress'];
    const scenarios = ['Cold Call', 'Walk-in Customer', 'Follow-up Call', 'Product Demo', 'Objection Practice', 'Closing Practice', 'Discovery Practice', 'General Training'];

    for (let i = 0; i < 10; i++) {
      const user = companyUsers[Math.floor(Math.random() * companyUsers.length)];
      const product = companyProducts.length > 0 ? companyProducts[Math.floor(Math.random() * companyProducts.length)] : null;
      const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 30));
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + Math.floor(Math.random() * 45) + 5);

      const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

      await prisma.salesSession.create({
        data: {
          companyId: company.id,
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          productId: product?.id || null,
          scenario: scenario,
          mode: Math.random() > 0.3 ? 'text' : 'voice',
          startedAt: startDate,
          endedAt: outcome !== 'in_progress' ? endDate : null,
          outcome: outcome,
          saleConfirmed: outcome === 'sale_made',
          currentPhase: outcome === 'completed' || outcome === 'sale_made' ? 'closing' : 'discovery',
          techniquesUsed: sample.techniques ? [sample.techniques[0].name] : [],
          score: (outcome === 'completed' || outcome === 'sale_made') ? Math.floor(Math.random() * 25) + 75 : null
        }
      });
    }
    console.log(`  ✓ 10 sample sales sessions created`);
    console.log('');
  }

  console.log('========================================');
  console.log('DATABASE SEED COMPLETED SUCCESSFULLY!');
  console.log(`✓ ${industries.length} industries`);
  console.log(`✓ ${sampleCompanies.length} companies with full sample data`);
  console.log(`✓ ${languages.length} languages (all enabled)`);
  console.log('========================================');
  console.log('\nLogin Credentials:');
  console.log('------------------');
  console.log(`Super Admin: ${superAdminEmail} / ${superAdminPassword}`);
  console.log('\nAll sample company users use password: Demo123!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
