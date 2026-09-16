/**
 * Canonical site data.
 *
 * Every string a visitor reads that is a *fact about the company* lives here,
 * not inline in a component. Brand guideline 01 §5 defines these strings; this
 * file is their single implementation. Change a phone number once, here.
 */

export const company = {
  name: 'Defined Solution',
  legalName: 'Defined Solution Ltd.',
  tagline: 'Your digital infrastructure partner, from strategy to scale.',
  description:
    'Defined Solution is a 360° digital engineering and growth partner in Dhaka. Web and application engineering, MVP strategy, AI automation, brand and performance marketing — one team, from strategy to scale.',
  url: 'https://definedsolution.com',
} as const;

export const proprietor = {
  name: 'Ahmad Sayeef Khan',
  role: 'Founder',
  quote: 'We provide creative solutions for your creative ideas.',
  commitment:
    'I personally review every new project request to ensure we are the perfect technical fit for your vision.',
  portrait: '/images/ahmad-sayeef-khan',
  avatar: '/images/ahmad-sayeef-khan-avatar',
} as const;

export const contact = {
  email: 'hello@definedsolution.com',
  phonePrimary: { display: '+880 1850-664718', href: '+8801850664718' },
  whatsapp: { display: '+880 1850-664718', href: 'https://wa.me/8801850664718' },
  address: {
    street: '39/7/B, East Hazipara, Wasa Road',
    area: 'Rampura, Dhaka',
    country: 'Bangladesh',
    full: '39/7/B, East Hazipara, Wasa Road, Rampura, Dhaka, Bangladesh',
    maps: 'https://maps.google.com/?q=39/7/B+East+Hazipara+Wasa+Road+Rampura+Dhaka',
  },
} as const;

/**
 * The project form posts to Web3Forms, which forwards each submission to the
 * inbox the access key was created for (hello@definedsolution.com). The key is
 * public by design — it can only send mail to that one inbox — so it lives in
 * `.env` as PUBLIC_WEB3FORMS_KEY rather than in a server secret.
 *
 * With no key set, the form falls back to its old `mailto:` behaviour, so a
 * missing key degrades to "opens the visitor's mail app", never to a dead button.
 */
export const forms = {
  web3formsKey: (import.meta.env.PUBLIC_WEB3FORMS_KEY ?? '').trim(),
  endpoint: 'https://api.web3forms.com/submit',
  subject: 'New project request — definedsolution.com',
} as const;

export const social = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/95720697' },
  { label: 'Facebook', href: 'https://www.facebook.com/definedsolutionltd' },
  { label: 'WhatsApp', href: 'https://wa.me/8801850664718' },
] as const;

/** Guideline 01 §1 — the only numbers we are allowed to claim. */
export const stats = [
  { value: 50, suffix: '+', label: 'Happy customers worldwide' },
  { value: 65, suffix: '+', label: 'Projects delivered' },
  { value: 30, suffix: '+', label: 'Team members' },
] as const;

export const availability = {
  status: 'Accepting projects',
  window: 'Q4 2026',
  responseSla: 'Within 24 hours',
} as const;

/**
 * Page sections in order. Drives the navigation, the scroll rail and the mono
 * counters. The page is a linear argument, so order carries meaning and the
 * sections are numbered — guideline 02 §2.3.
 */
export const sections = [
  { id: 'index', number: '01', label: 'Index', nav: false },
  { id: 'studio', number: '02', label: 'Studio', nav: true },
  { id: 'services', number: '03', label: 'Services', nav: true },
  { id: 'work', number: '04', label: 'Work', nav: true },
  { id: 'questions', number: '05', label: 'Questions', nav: true },
  { id: 'contact', number: '06', label: 'Contact', nav: false },
] as const;
