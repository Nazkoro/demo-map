export interface Category {
  id: string;
  emoji: string;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: 'korean',   emoji: '🥘', label: '🥘 Корейская' },
  { id: 'buffet',   emoji: '🍱', label: '🍱 Шведский стол' },
  { id: 'chinese',  emoji: '🥢', label: '🥢 Китайская' },
  { id: 'japanese', emoji: '🍣', label: '🍣 Японская' },
  { id: 'burgers',  emoji: '🍔', label: '🍔 Бургеры' },
  { id: 'salads',   emoji: '🥗', label: '🥗 Салаты' },
  { id: 'pizza',    emoji: '🍕', label: '🍕 Пицца' },
  { id: 'cafe',     emoji: '☕', label: '☕ Кафе' },
  { id: 'shawarma', emoji: '🌯', label: '🌯 Шаурма' },
];

export const DEFAULT_EMOJI = '🍲';

export function getCategoryEmoji(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.emoji ?? DEFAULT_EMOJI;
}

/** Returns the emoji for the first category in the array, or the default. */
export function getFirstEmoji(categories: string[]): string {
  if (!categories || categories.length === 0) return DEFAULT_EMOJI;
  return getCategoryEmoji(categories[0]);
}
