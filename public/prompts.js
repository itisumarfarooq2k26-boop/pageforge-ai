export const CATEGORIES = [
  'Luxury Cars', 'Dream Houses', 'Nature Photography', 'Cute Cats', 'Cute Dogs',
  'Wildlife Photography', 'Beautiful Birds', 'Flowers & Gardens', 'Space & Universe',
  'Luxury Watches', 'Fashion & Outfits', 'Food Photography', 'Cakes & Desserts',
  'Travel Destinations', 'Interior Design', 'Home Decoration', 'AI Fantasy Art',
  '3D Cartoon Characters', 'Funny Memes', 'Motivational Quotes', 'Love & Friendship',
  'Good Morning Wishes', 'Good Night Wishes', 'Baby Animals', 'Ocean & Beaches',
  'Supercars & Bikes', 'Luxury Lifestyle', 'Architecture', 'Futuristic Cities',
  'AI Robots', 'Product Photography', 'Wedding Inspiration', 'Gardening Ideas',
  'Coffee & Tea Aesthetic', 'Optical Illusions & Puzzles'
];

export const STYLES = [
  'Photorealistic Editorial', 'Clean Product Commercial', 'Soft Natural Daylight',
  'Cinematic 3D', 'Minimal Pastel', 'Luxury Studio', 'Dreamy Fantasy'
];

export const IDEAS = [
  'A dramatic hero subject with an unforgettable background and clear visual hierarchy',
  'An extraordinary close-up of a beautiful detail most people overlook',
  'A surprising scale comparison captured in one elegant image',
  'A serene, naturally lit scene with magazine-level composition',
  'An unexpected creative concept that sparks curiosity without misleading viewers',
  'A before-and-after style visual with clear differentiation and coherent lighting',
  'A vivid scene built around a single rich color and tasteful contrast',
  'A playful composition with beautiful textures and polished details',
  'A seasonal concept with authentic atmosphere and modern styling',
  'A breathtaking wide composition with cinematic depth and natural realism'
];

export function makePrompt({ category, subject, style, brand, notes }) {
  const categoryText = String(category || 'Creative imagery').trim().slice(0, 100);
  const subjectText = String(subject || `A visually outstanding concept about ${categoryText}`).trim().slice(0, 700);
  const styleText = String(style || 'Photorealistic Editorial').trim().slice(0, 100);
  const brandText = String(brand || 'clean, sophisticated and memorable').trim().slice(0, 200);
  const notesText = String(notes || '').trim().slice(0, 400);
  return [
    `Create an original, exceptional-quality image for a social media content page in the niche: ${categoryText}.`,
    `Subject and scene: ${subjectText}.`,
    `Visual direction: ${styleText}; polished professional art direction, excellent composition, coherent objects, realistic light where appropriate, natural depth and a compelling focal point.`,
    `Brand identity: ${brandText}.`,
    'Portrait image for Facebook feed. Keep the central subject within a 4:5 safe crop (source generation may be 2:3).',
    'No text, captions, signatures, logos, watermarks, recognizable copyrighted characters, or misleading news imagery.',
    notesText ? `Additional art direction: ${notesText}.` : ''
  ].filter(Boolean).join('\n');
}

export function makeCaptionRequest({ page, subject, tone }) {
  const name = String(page?.name || 'Creative Page').slice(0, 100);
  const category = String(page?.category || 'Visual Art').slice(0, 100);
  return [
    'Write an original, concise Facebook photo post caption (max 55 words) and 3 relevant hashtags.',
    `Page: ${name}; niche: ${category}; topic: ${String(subject || category).slice(0, 400)}.`,
    `Tone: ${String(tone || 'engaging and professional').slice(0, 80)}.`,
    'Avoid invented facts, inflated claims, copyrighted slogans, calls to engagement bait, and misleading descriptions.',
    'Return only the finished caption and hashtags.'
  ].join('\n');
}
