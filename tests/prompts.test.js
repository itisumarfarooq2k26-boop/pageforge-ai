import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, STYLES, makePrompt, makeCaptionRequest } from '../public/prompts.js';

test('35 starter image categories are unique', () => {
  assert.equal(CATEGORIES.length, 35);
  assert.equal(new Set(CATEGORIES).size, 35);
  assert.ok(STYLES.length >= 5);
});
test('generator creates crop-safe, watermark-free directions', () => {
  const value = makePrompt({ category: 'Luxury Cars', subject: 'Midnight blue car', style: 'Luxury Studio', brand: 'Navy and silver' });
  assert.match(value, /Luxury Cars/);
  assert.match(value, /Midnight blue car/);
  assert.match(value, /4:5/);
  assert.match(value, /watermarks/);
});
test('caption request includes chosen identity', () => {
  const value = makeCaptionRequest({ page: { name: 'Art Daily', category: 'Nature' }, subject: 'Sunrise', tone: 'warm' });
  assert.match(value, /Art Daily/);
  assert.match(value, /Sunrise/);
  assert.match(value, /hashtags/);
});
