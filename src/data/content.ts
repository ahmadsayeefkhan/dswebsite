/**
 * Page content — from brand-guidelines/WebsiteContent.md, voiced against the
 * protocol in brand guideline 01 §3.
 */

/* ── Hero ─────────────────────────────────────────────────────────────── */

export const hero = {
  /* One string, split into lines at runtime by GSAP SplitText. Hand-broken
     lines were tried first and were wrong: the masks have to match the lines
     the browser actually renders, and those change with viewport and with
     whatever width the font loads at. */
  headline: 'Empowering your business with intelligent solutions that drive growth',
  lead: 'Comprehensive digital support for enterprise and organizational growth. We build, market and manage the digital tools you rely on every day.',
  sub: 'We believe your digital presence should be a source of strength, not stress. We provide the web infrastructure, digital marketing and AI expertise you need — so you can focus on what you love.',
  primary: { label: 'Book a free consultation', href: '#contact' },
  secondary: { label: 'Explore our services', href: '#services' },
};

/* ── Tool marquee ─────────────────────────────────────────────────────────
   Three lanes. Lanes 1 and 3 travel right-to-left, lane 2 left-to-right —
   opposing directions read as motion; one direction reads as a broken
   carousel. Lane speed reacts to scroll velocity (see scripts/motion.ts).

   Each tool carries the vendor's own mark, stored as a single-colour SVG in
   public/logos and painted through a CSS mask so it inherits --color-dim and
   lifts to --color-bone on hover — the band stays monochrome, exactly as the
   wordmarks did. `logo` is the filename stem; omit it and the item falls back
   to its wordmark, which is the honest answer for a tool with no mark of its
   own (SQL). Hermes Agent's mark (Nous Research) comes from the MIT-licensed
   @lobehub/icons set.                                                        */

export interface MarqueeItem {
  name: string;
  logo?: string;
}

export const marqueeLanes: {
  label: string;
  direction: 'rtl' | 'ltr';
  speed: number;
  items: MarqueeItem[];
}[] = [
  {
    label: 'AI',
    direction: 'rtl',
    speed: 42,
    items: [
      { name: 'ChatGPT', logo: 'openai' },
      { name: 'Copilot', logo: 'githubcopilot' },
      { name: 'Midjourney', logo: 'midjourney' },
      { name: 'Claude', logo: 'claude' },
      { name: 'Gemini', logo: 'googlegemini' },
      { name: 'NotebookLM', logo: 'notebooklm' },
      { name: 'ElevenLabs', logo: 'elevenlabs' },
      { name: 'Replit', logo: 'replit' },
      { name: 'Hermes Agent', logo: 'hermesagent' },
      { name: 'OpenClaw', logo: 'openclaw' },
      { name: 'n8n', logo: 'n8n' },
      { name: 'Perplexity', logo: 'perplexity' },
      { name: 'HeyGen', logo: 'heygen' },
      { name: 'Make.com', logo: 'make' },
      { name: 'Zapier', logo: 'zapier' },
      { name: 'Figma AI', logo: 'figma' },
      { name: 'Higgsfield', logo: 'higgsfield' },
    ],
  },
  {
    label: 'Management',
    direction: 'ltr',
    speed: 54,
    items: [
      { name: 'Figma', logo: 'figma' },
      { name: 'Jira', logo: 'jira' },
      { name: 'Notion', logo: 'notion' },
      { name: 'Slack', logo: 'slack' },
      { name: 'Asana', logo: 'asana' },
      { name: 'GoHighLevel', logo: 'gohighlevel' },
      { name: 'QuickBooks', logo: 'quickbooks' },
      { name: 'Xero', logo: 'xero' },
      { name: 'HubSpot', logo: 'hubspot' },
      { name: 'Meta', logo: 'meta' },
      { name: 'GA4', logo: 'googleanalytics' },
      { name: 'Mailchimp', logo: 'mailchimp' },
      { name: 'Klaviyo', logo: 'klaviyo' },
      { name: 'ClickUp', logo: 'clickup' },
      { name: 'Trello', logo: 'trello' },
      { name: 'Miro', logo: 'miro' },
    ],
  },
  {
    label: 'Engineering',
    direction: 'rtl',
    speed: 47,
    items: [
      { name: 'Astro', logo: 'astro' },
      { name: 'Tailwind CSS', logo: 'tailwindcss' },
      { name: 'React', logo: 'react' },
      { name: 'Next.js', logo: 'nextdotjs' },
      { name: 'Node.js', logo: 'nodedotjs' },
      { name: 'GitHub', logo: 'github' },
      { name: 'AWS', logo: 'amazonwebservices' },
      { name: 'Vercel', logo: 'vercel' },
      { name: 'MongoDB', logo: 'mongodb' },
      { name: 'SQL' },
      { name: 'TypeScript', logo: 'typescript' },
      { name: 'Flutter', logo: 'flutter' },
      { name: 'React Native', logo: 'react' },
      { name: 'Swift', logo: 'swift' },
      { name: 'Android', logo: 'android' },
      { name: 'PostgreSQL', logo: 'postgresql' },
      { name: 'Firebase', logo: 'firebase' },
      { name: 'Supabase', logo: 'supabase' },
      { name: 'Docker', logo: 'docker' },
    ],
  },
];

/* ── Studio ───────────────────────────────────────────────────────────── */

export const studio = {
  headline: 'Your digital infrastructure partner, from strategy to scale',
  lead: 'We bring strategy, human-centred design and robust development together to solve complex business challenges. We do not just hand off files — we act as an extension of your team, building, marketing and managing the digital tools your business relies on every day.',
  whyHeading: 'Why choose us',
  why: 'Every solution we engineer is mapped to your actual business goals. We focus entirely on creating functional, simple, human-centred digital products that turn digital friction into your competitive advantage.',
};

/* ── Services ─────────────────────────────────────────────────────────────
   Scroll horizontally through a pinned section. Order is fixed by guideline
   01 §4 Tier 4: engineering first, because it is the claim competitors cannot
   copy. Marketing last, because leading with it recategorises us as an ad
   agency.                                                                  */

export const services = [
  {
    id: 'engineering',
    number: '01',
    kicker: 'Web & software engineering',
    title: 'Web & application engineering',
    icon: 'code' as const,
    body: 'We build lightning-fast, scalable digital platforms. From robust web architecture to seamless mobile applications, we engineer solutions designed to perform and to scale.',
    deliverables: [
      'Web & mobile design',
      'Website development',
      'Application development',
      'Architecture & infrastructure',
      'Maintenance & support',
    ],
  },
  {
    id: 'mvp',
    number: '02',
    kicker: 'MVP & product strategy',
    title: 'MVP & product strategy',
    icon: 'compass' as const,
    body: 'Turning complex ideas into market-ready products. We guide you from initial consultation to a fully functional pilot, so your product is validated and ready for scale.',
    deliverables: [
      'MVP consultation',
      'Clickable prototype',
      'Pilot MVP development',
      'Complete MVP development',
      'MVP development solutions',
    ],
  },
  {
    id: 'ai',
    number: '03',
    kicker: 'AI & automation',
    title: 'AI experiences & automation',
    icon: 'sparkles' as const,
    body: 'Future-proof your operations with intelligent systems. We integrate AI and agent workflows to automate process and create entirely new user experiences.',
    deliverables: [
      'AI experiences',
      'AI product strategy',
      'Assistants & copilots',
      'Agent workflows & automation',
      'AI creative media creation',
    ],
  },
  {
    id: 'brand',
    number: '04',
    kicker: 'Brand & digital growth',
    title: 'Brand & digital marketing',
    icon: 'megaphone' as const,
    body: 'We do not just launch your product; we make sure it reaches the market. Bold visual identity paired with data-led performance marketing to maximise your return.',
    deliverables: [
      'Branding',
      'UI/UX design',
      'Creative design & media production',
      'Digital marketing & promotions',
      'Digital ads',
      'AEO & SEO',
      'Content strategy & planning',
    ],
  },
];

/* ── Selected work ────────────────────────────────────────────────────────
   `span` maps to the bento grid.

   `media` is the card's artwork. Each one was art-directed from the real
   client material — the live paperwarefactory.com / starlingint.net /
   bangalifoundation.org sites and our own case-study mockups — then re-lit
   into the house palette: plum ground, bone shapes, exactly one rose element.
   They are representations of the work, not screenshots of it, so every UI
   surface in them carries generic labels and no invented brand names.
     `base`  → /images/work/<base>.webp (+ .jpg) and /video/work/<base>.mp4
     `video` → whether an ambient loop exists; the still is always the poster
     `alt`   → describes what the card shows, not what the project is called

   `visual` is the procedural SVG fallback in ProjectVisual.astro, still used
   for any project that has no `media` yet — guideline 02 §8: never a grey box.

   `liveUrl`: paste the real URL to make the "View live site" action appear on
   a card. Left empty deliberately — a dead or invented link costs more trust
   than a missing one. Paperware, Starling and Bangali Foundation are live.  */

export const projects = [
  {
    id: 'food-delivery',
    number: '01',
    name: 'Online Food Delivery System',
    sector: 'SAAS Complete MVP',
    span: 'full' as const,
    visual: 'erp' as const,
    media: {
      base: 'food-delivery',
      video: false,
      alt: 'A sleek food delivery app interface showing live order tracking, restaurant listings and an AI-powered dispatch dashboard, set against a warm gradient background.',
    },
    liveUrl: '',
    tags: [
      'Web & Mobile App Development', 'Branding', 'UI/UX design',
      'Website development', 'AI workflow automation',
    ],
    description:
      'An AI-powered food delivery MVP engineered to launch hyperlocal delivery operations — from intelligent order routing and real-time driver dispatch to predictive demand forecasting — giving entrepreneurs everything they need to own their town\'s delivery market.',
  },
  {
    id: 'paperware',
    number: '02',
    name: 'Ai Automation on Paper Cup Manufacture Factory',
    sector: 'Manufacturing Factory',
    span: 'full' as const,
    visual: 'erp' as const,
    media: {
      base: 'paperware',
      video: true,
      alt: 'Kraft paper cups running down a production line, with a floating ERP dashboard behind them showing throughput, efficiency and live batch status.',
    },
    liveUrl: '',
    tags: [
      'ERP software development', 'Branding', 'UI/UX design',
      'Website development', 'AI workflows automation',
    ],
    description:
      'A complete end-to-end digital transformation. We engineered a custom ERP system powered by AI workflow automation to streamline manufacturing operations, complemented by a total brand overhaul and a modern web platform.',
  },
  {
    id: 'employee-mart',
    number: '03',
    name: 'Specialized Employee Mart',
    sector: 'Corporate Internal commerce',
    span: 'half' as const,
    visual: 'commerce' as const,
    media: {
      base: 'employee-mart',
      video: true,
      alt: 'A laptop showing the dark-mode staff storefront: a search bar, a promo banner and a twelve-tile category grid, with plain kraft delivery boxes stacked beside it.',
    },
    liveUrl: '',
    tags: ['Software development', 'UI/UX design', 'E-commerce development'],
    description:
      'A robust internal commerce and operations portal designed to streamline workforce engagement and secure internal transactions.',
  },
  {
    id: 'pos',
    number: '04',
    name: 'Advanced POS System',
    sector: 'Retail · SaaS',
    span: 'half' as const,
    visual: 'pos' as const,
    media: {
      base: 'pos',
      video: true,
      alt: 'A checkout counter: a point-of-sale terminal showing a scanned item and its running totals, a receipt printer, and a handheld scanner reading the barcode on a parcel.',
    },
    liveUrl: '',
    tags: ['Software development', 'UI/UX design', 'SaaS'],
    description:
      'A highly responsive point-of-sale platform engineered for fast, secure and intuitive retail management at scale.',
  },
  {
    id: 'crm',
    number: '05',
    name: 'Real Estate CRM Application',
    sector: 'Real Estate · CRM',
    span: 'two-thirds' as const,
    visual: 'crm' as const,
    media: {
      base: 'crm',
      video: true,
      alt: 'A CRM dashboard panel with deal counters, a target gauge and an agent leaderboard, standing behind a white architectural model of an apartment block.',
    },
    liveUrl: '',
    tags: ['Software development', 'UI/UX design', 'Agent workflows'],
    description:
      'A bespoke application built to automate complex agent workflows, manage property portfolios, and scale lead generation seamlessly.',
  },
  {
    id: 'starling',
    number: '06',
    name: 'Global Recruitment Agency Platform',
    sector: 'Online Recruiter Platform',
    span: 'third' as const,
    visual: 'brand' as const,
    media: {
      base: 'starling',
      video: true,
      alt: 'A pale globe with a flock of swallows lifting away from it, one of them picked out in rose — the migration motif from the Starling International identity.',
    },
    liveUrl: '',
    tags: ['Branding', 'UI/UX', 'Web design'],
    description:
      'A high-performance digital presence and brand identity built to connect top-tier talent with global enterprises.',
  },
  {
    id: 'bangali-foundation',
    number: '07',
    name: 'Non-Profit Organization Platform',
    sector: 'NGO',
    span: 'full' as const,
    visual: 'nonprofit' as const,
    media: {
      base: 'bangali-foundation',
      video: true,
      alt: 'Two boys laughing together in a paddy field at dusk — the documentary photography the Bangali Foundation platform is built around.',
    },
    liveUrl: '',
    tags: ['Branding', 'UI/UX', 'Web Design', 'System Design'],
    description:
      'A visually compelling brand identity and optimised web platform designed to maximise digital engagement, transparency, and donor trust.',
  },
];

/* ── FAQ ──────────────────────────────────────────────────────────────── */

export const faqs = [
  {
    q: 'What sets Defined Solution apart from other digital agencies?',
    a: 'Instead of juggling different agencies for design, coding and marketing, you get one cohesive team with us. Our designers, developers and marketers work side by side right here in our Dhaka office. That means no communication gaps, fewer delays, and a final product where the design perfectly matches the technology. Think of us as an extension of your own team.',
  },
  {
    q: 'What services do you offer for start-ups?',
    a: 'We love helping start-ups bring their ideas to life without burning through their budgets. We offer flexible MVP services to get your core idea launched and validated quickly. Whether you need a clickable prototype to show investors or a fully functioning pilot app, we will guide you step by step so you can launch smart and scale safely.',
  },
  {
    q: 'Can you work with our existing product or internal development team?',
    a: 'Absolutely. If you are starting from scratch, we can build your product from the ground up. But if you already have an in-house team and just need extra firepower — a fresh UI/UX redesign, some complex software engineering, or a new marketing strategy — we are more than happy to jump in and collaborate with your crew.',
  },
  {
    q: 'How do you estimate development time, and how much does an app cost?',
    a: 'Because every business is unique, there is no one-size-fits-all price tag or timeline. A standard website might take a few weeks, while a custom mobile app or an ERP system will naturally take longer. When we first meet, our goal is to understand exactly what you need. After that we provide a clear, honest breakdown of the costs and a realistic timeline — no hidden fees, no surprises.',
  },
  {
    q: 'How do I start a project with Defined Solution?',
    a: 'Getting started is easy. Reach out and we will set up a relaxed, free consultation. We will talk through your ideas, map out what you need, and suggest the best way forward.',
  },
];

/* ── Contact form ─────────────────────────────────────────────────────── */

export const serviceChips = [
  'Web & app engineering',
  'MVP & product strategy',
  'AI & automation',
  'Brand & digital marketing',
];

export const budgetBands = [
  { value: 'under-1k', label: 'Less than $1k' },
  { value: '1.5k-5k', label: '$1.5k – $5k' },
  { value: '10k-20k-plus', label: '$10k – $20k+' },
];

/* ── Footer ───────────────────────────────────────────────────────────── */

export const footerLinks = [
  {
    heading: 'Company',
    links: [
      { label: 'Studio', href: '#studio' },
      { label: 'Services', href: '#services' },
      { label: 'Selected work', href: '#work' },
      { label: 'Questions', href: '#questions' },
    ],
  },
  {
    heading: 'Capabilities',
    links: [
      { label: 'Web & app engineering', href: '#services' },
      { label: 'MVP & product strategy', href: '#services' },
      { label: 'AI & automation', href: '#services' },
      { label: 'Brand & digital marketing', href: '#services' },
    ],
  },
];
