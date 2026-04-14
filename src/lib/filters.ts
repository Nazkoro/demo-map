import type { Place } from '../types';

export const PRICE_SLIDER_MIN = 0;
export const PRICE_SLIDER_MAX = 20;
export const PRICE_SLIDER_STEP = 1;

export function isFullPriceRange(min: number, max: number): boolean {
  return min <= PRICE_SLIDER_MIN && max >= PRICE_SLIDER_MAX;
}

export function placePassesPriceFilter(place: Place, min: number, max: number): boolean {
  if (isFullPriceRange(min, max)) {
    return true;
  }
  if (!place.price) {
    return false;
  }
  return place.price >= min && place.price <= max;
}

export function placePassesCategoryFilter(place: Place, selectedCategoryIds: string[]): boolean {
  if (selectedCategoryIds.length === 0) {
    return true;
  }
  return place.categories.some((categoryId) => selectedCategoryIds.includes(categoryId));
}

export function placePassesNameFilter(place: Place, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const haystack = [place.name, place.dish, place.note, ...(place.categories ?? [])].join(' ').toLowerCase();
  return haystack.includes(q);
}

export function getVisiblePlaces(
  places: Place[],
  priceMin: number,
  priceMax: number,
  selectedCategoryIds: string[],
  nameQuery: string,
  focusBypassId: string | null,
): Place[] {
  return places.filter((p) => {
    if (focusBypassId != null && String(p.id) === String(focusBypassId)) {
      return true;
    }
    return (
      placePassesPriceFilter(p, priceMin, priceMax) &&
      placePassesCategoryFilter(p, selectedCategoryIds) &&
      placePassesNameFilter(p, nameQuery)
    );
  });
}

export function formatRuNum(n: number): string {
  return Math.round(n).toLocaleString('ru-RU');
}
