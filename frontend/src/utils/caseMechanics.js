/**
 * caseMechanics.js: CS:GO Case Opening Physics, Deceleration, and Rarity Rules for FoodFast
 */

export const TILE_WIDTH = 240;
export const TILE_GAP = 14;
export const STEP = TILE_WIDTH + TILE_GAP; // 254px

/**
 * Price rarity classification (FoodFast Requirement R2):
 * - Common (Blue / #4b69ff): < 35,000 VND
 * - Rare (Purple / #8847ff): 35,000 to 70,000 VND
 * - Legendary (Gold / #ffd700): > 70,000 VND
 */
export const RARITY_TIERS = {
  COMMON: {
    id: 0,
    tierKey: 'common',
    label: 'Phổ biến',
    labelEn: 'Common',
    color: '#4b69ff',
    borderClass: 'border-[#4b69ff]',
    textClass: 'text-[#4b69ff]',
    bgClass: 'bg-[#4b69ff]',
    glowColor: 'rgba(75, 105, 255, 0.45)',
    sound: 'item_reveal3_rare'
  },
  RARE: {
    id: 1,
    tierKey: 'rare',
    label: 'Hiếm',
    labelEn: 'Rare',
    color: '#8847ff',
    borderClass: 'border-[#8847ff]',
    textClass: 'text-[#8847ff]',
    bgClass: 'bg-[#8847ff]',
    glowColor: 'rgba(136, 71, 255, 0.55)',
    sound: 'item_reveal4_mythical'
  },
  LEGENDARY: {
    id: 2,
    tierKey: 'legendary',
    label: 'Huyền thoại',
    labelEn: 'Legendary',
    color: '#ffd700',
    borderClass: 'border-[#ffd700]',
    textClass: 'text-[#ffd700]',
    bgClass: 'bg-[#ffd700]',
    glowColor: 'rgba(255, 215, 0, 0.65)',
    sound: 'item_reveal6_ancient'
  }
};

/**
 * Classifies dish into rarity tier by price
 * @param {number} price - Dish price in VND
 * @returns {object} Rarity tier object from RARITY_TIERS
 */
export function getDishRarity(price) {
  const p = Number(price) || 0;
  if (p < 35000) return RARITY_TIERS.COMMON;
  if (p <= 70000) return RARITY_TIERS.RARE;
  return RARITY_TIERS.LEGENDARY;
}

/**
 * Maps rarity tier or price to reveal sound
 * @param {object|string|number} rarityOrPrice
 * @returns {string} sound name
 */
export function getRaritySound(rarityOrPrice) {
  if (typeof rarityOrPrice === 'number') {
    if (rarityOrPrice > 1000) {
      return getDishRarity(rarityOrPrice).sound;
    }
    if (rarityOrPrice <= 0) return RARITY_TIERS.COMMON.sound;
    if (rarityOrPrice === 1) return RARITY_TIERS.RARE.sound;
    return RARITY_TIERS.LEGENDARY.sound;
  }
  if (typeof rarityOrPrice === 'string') {
    const key = rarityOrPrice.toUpperCase();
    if (RARITY_TIERS[key]) return RARITY_TIERS[key].sound;
  }
  if (rarityOrPrice && typeof rarityOrPrice === 'object' && rarityOrPrice.sound) {
    return rarityOrPrice.sound;
  }
  return RARITY_TIERS.COMMON.sound;
}

/**
 * stopFraction: random float between 0.10 and 0.90
 * Guarantees center needle lands comfortably inside the card body, never on card edges
 */
export function stopFraction(random = Math.random) {
  return (Math.floor(random() * 81) + 10) / 100;
}

/**
 * CS:GO non-linear deceleration formula:
 * spinProgress(progress, friction) = 1 - Math.pow(1 - progress, friction)
 * Starts at high velocity and smoothly decelerates to 0 velocity at progress = 1.
 */
export function spinProgress(progress, friction = 3.0) {
  const p = Math.max(0, Math.min(1, progress));
  return 1 - Math.pow(1 - p, friction);
}

/**
 * Calculates winning target stop position (world coordinate)
 * Formula: end = width / 2 - tileWidth * stopFraction - target * step
 */
export function calcStopPosition(viewportWidth, targetSlot, sf = stopFraction(), tileWidth = TILE_WIDTH, step = STEP) {
  return viewportWidth / 2 - tileWidth * sf - targetSlot * step;
}

/**
 * Creates profile for spin duration, tiles travelled, and friction factor
 */
export function createSpinProfile(random = Math.random, reducedMotion = false) {
  if (reducedMotion) {
    return {
      durationMs: 4000 + Math.floor(random() * 1001), // 4.0s - 5.0s
      tiles: 10 + Math.floor(random() * 4),            // 10 - 13 tiles
      friction: 2.7 + random() * 0.6                  // 2.7 - 3.3
    };
  }
  return {
    durationMs: 7500 + Math.floor(random() * 2001),   // 7.5s - 9.5s
    tiles: 30 + Math.floor(random() * 11),            // 30 - 40 tiles
    friction: 2.7 + random() * 0.6                    // 2.7 - 3.3
  };
}

/**
 * Panorama Cubic-Bezier fallback (cubic-bezier(0.075, 0.82, 0.165, 1))
 */
export function caseEase(progress) {
  const p = Math.max(0, Math.min(1, progress));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2;
    const u = 1 - t;
    const x = 3 * u * u * t * 0.075 + 3 * u * t * t * 0.165 + t * t * t;
    if (x < p) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  const u = 1 - t;
  return 3 * u * u * t * 0.82 + 3 * u * t * t + t * t * t;
}
