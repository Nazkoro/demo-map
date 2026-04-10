import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

import type { Place, PlaceFormData } from './types';
import { getFirstEmoji } from './lib/categories';
import { loadPlaces, insertPlace, updateVotes, removePlace } from './lib/places';
import {
  PRICE_SLIDER_MIN,
  PRICE_SLIDER_MAX,
  getVisiblePlaces,
  isFullPriceRange,
  placePassesCategoryFilter,
  placePassesPriceFilter,
  placePassesNameFilter,
} from './lib/filters';
import { supabase } from './lib/supabase';

import MapView from './components/MapView';
import FabStack from './components/FabStack';
import StatusToast from './components/StatusToast';
import AddPlaceModal from './components/AddPlaceModal';
import PriceModal from './components/PriceModal';
import SearchModal from './components/SearchModal';
import PlaceSheet from './components/PlaceSheet';
import RecentRegistrationsPanel from './components/RecentRegistrationsPanel';
import MapSidebar from './components/MapSidebar';

const MAP_STYLE = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';
const MAP_CENTER: [number, number] = [27.5618, 53.9023];
const MAP_ZOOM = 12;

interface Toast {
  msg: string;
  type: 'info' | 'success' | 'error';
  key: number;
}

interface SearchChip {
  text: string;
  placeId: string;
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null!);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentMarkersRef = useRef<maplibregl.Marker[]>([]);
  const addModeClickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [priceMin, setPriceMin] = useState(PRICE_SLIDER_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_SLIDER_MAX);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [focusBypassId, setFocusBypassId] = useState<string | null>(null);
  const [searchChip, setSearchChip] = useState<SearchChip | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [recentPanelOpen, setRecentPanelOpen] = useState(true);

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lng: number; lat: number } | null>(null);

  const [modalPrice, setModalPrice] = useState(false);
  const [modalSearch, setModalSearch] = useState(false);
  const [modalAdd, setModalAdd] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    setToast({ msg, type, key: Date.now() });
  }, []);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    root.classList.add('is-map-mode');

    return () => {
      root.classList.remove('is-map-mode');
    };
  }, []);

  // ── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: 0,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', async () => {
      if (!supabase) showToast('Supabase не настроен', 'error');
      try {
        const data = await loadPlaces();
        setPlaces(data);
        if (data.length === 0) showToast('Пока нет точек. Добавьте первое заведение', 'info');
      } catch (e: unknown) {
        showToast('Не удалось загрузить данные: ' + (e instanceof Error ? e.message : String(e)), 'error');
      }
    });

    map.on('click', () => {
      if (addModeClickHandlerRef.current) return; // handled by add-mode handler
      closeAllPopups();
      setFocusBypassId(null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild markers when visible places change ─────────────────────────────
  const visiblePlaces = getVisiblePlaces(
    places,
    priceMin,
    priceMax,
    selectedCategories,
    nameQuery,
    focusBypassId,
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    rebuildMarkers(map, visiblePlaces, selectedPlaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePlaces, selectedPlaceId]);

  function closeAllPopups() {
    setSelectedPlaceId(null);
  }

  function rebuildMarkers(map: maplibregl.Map, visible: Place[], activePlaceId: string | null) {
    currentMarkersRef.current.forEach((m) => m.remove());
    currentMarkersRef.current = [];

    visible.forEach((place) => {
      const emoji = getFirstEmoji(place.categories);
      const priceText = place.price ? place.price.toLocaleString('ru-RU') : '';

      const tooltipRows = [
        `<span class="mtt-name">${escapeHtml(place.name)}</span>`,
        place.address ? `<span class="mtt-row">${escapeHtml(place.address)}</span>` : '',
        place.hours   ? `<span class="mtt-row">${escapeHtml(place.hours)}</span>`   : '',
      ].filter(Boolean).join('');

      const el = document.createElement('div');
      el.className = `map-marker-pill${String(place.id) === String(activePlaceId) ? ' map-marker-pill--active' : ''}`;

      const emojiEl = document.createElement('span');
      emojiEl.className = 'map-marker-emoji';
      emojiEl.textContent = emoji;

      el.appendChild(emojiEl);

      if (priceText) {
        const priceEl = document.createElement('span');
        priceEl.className = 'map-marker-price';
        priceEl.textContent = priceText;
        el.appendChild(priceEl);
      }

      const tooltipEl = document.createElement('div');
      tooltipEl.className = 'mtt';
      tooltipEl.innerHTML = tooltipRows;
      el.appendChild(tooltipEl);

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedPlaceId(place.id);
      });

      currentMarkersRef.current.push(marker);
    });
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setModalPrice(false);
      setModalSearch(false);
      closeAllPopups();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Vote ───────────────────────────────────────────────────────────────────
  function handleVote(placeId: string, isUp: boolean) {
    setPlaces((prev) => {
      const updated = prev.map((p) => {
        if (String(p.id) !== String(placeId)) return p;
        return { ...p, votesUp: isUp ? p.votesUp + 1 : p.votesUp, votesDown: !isUp ? p.votesDown + 1 : p.votesDown };
      });
      const place = updated.find((p) => String(p.id) === String(placeId));
      if (place) {
        updateVotes(place).catch(() => showToast('Не удалось обновить голоса', 'error'));
      }
      return updated;
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(placeId: string) {
    if (!confirm('Удалить эту точку?')) return;
    try {
      await removePlace(placeId);
    } catch {
      showToast('Не удалось удалить в Supabase', 'error');
      return;
    }
    setPlaces((prev) => prev.filter((p) => String(p.id) !== String(placeId)));
    if (searchChip?.placeId === placeId) setSearchChip(null);
    if (focusBypassId === placeId) setFocusBypassId(null);
    closeAllPopups();
    showToast('Точка удалена', 'success');
  }

  // ── Add mode ───────────────────────────────────────────────────────────────
  function enableAddMode() {
    const map = mapRef.current;
    if (!map) return;

    if (isAddingMode) {
      // cancel
      if (addModeClickHandlerRef.current) {
        map.off('click', addModeClickHandlerRef.current);
        addModeClickHandlerRef.current = null;
      }
      map.getCanvas().style.cursor = '';
      setIsAddingMode(false);
      return;
    }

    setIsAddingMode(true);
    map.getCanvas().style.cursor = 'crosshair';

    const handler = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      setPendingCoords({ lng, lat });
      setModalAdd(true);
      map.off('click', handler);
      addModeClickHandlerRef.current = null;
      map.getCanvas().style.cursor = '';
      setIsAddingMode(false);
    };
    addModeClickHandlerRef.current = handler;
    map.on('click', handler);
  }

  async function handleAddSubmit(form: PlaceFormData) {
    if (!pendingCoords) return;
    try {
      const { place, local } = await insertPlace(pendingCoords.lng, pendingCoords.lat, form);
      setPlaces((prev) => [place, ...prev]);
      showToast(local ? 'Сохранено локально (без Supabase)' : 'Место сохранено в Supabase', local ? 'info' : 'success');
    } catch (e: unknown) {
      showToast('Ошибка сохранения: ' + (e instanceof Error ? e.message : String(e)), 'error');
      return;
    }
    setModalAdd(false);
    setPendingCoords(null);
  }

  // ── Price filter ──────────────────────────────────────────────────────────
  function handleApplyPrice(min: number, max: number, categories: string[]) {
    setPriceMin(min);
    setPriceMax(max);
    setSelectedCategories(categories);
    setFocusBypassId(null);
    setSearchChip(null);
    setModalPrice(false);
    closeAllPopups();
    const visible = getVisiblePlaces(places, min, max, categories, nameQuery, null);
    const hidden = places.length - visible.length;
    if (hidden > 0) showToast(`Показано ${visible.length} из ${places.length} точек`, 'info');
  }

  function handleClearPriceFilter() {
    setPriceMin(PRICE_SLIDER_MIN);
    setPriceMax(PRICE_SLIDER_MAX);
    setSelectedCategories([]);
    setFocusBypassId(null);
    setSearchChip(null);
    setModalPrice(false);
    closeAllPopups();
  }

  // ── Name search ───────────────────────────────────────────────────────────
  function handleApplyNameSearch(query: string) {
    setNameQuery(query);
    setFocusBypassId(null);
    setModalSearch(false);
    closeAllPopups();
    if (query.trim()) {
      const matches = places.filter(
        (p) =>
          placePassesPriceFilter(p, priceMin, priceMax) &&
          placePassesCategoryFilter(p, selectedCategories) &&
          placePassesNameFilter(p, query),
      );
      if (matches.length === 1) {
        focusPlaceOnMap(matches[0]);
        return;
      }
      setSearchChip(null);
      showToast(matches.length ? `Найдено: ${matches.length}` : 'Ничего не найдено', matches.length ? 'success' : 'info');
    } else {
      setSearchChip(null);
    }
  }

  function handleClearSearch() {
    setNameQuery('');
    setFocusBypassId(null);
    setSearchChip(null);
    setModalSearch(false);
    closeAllPopups();
  }

  // ── Focus place (fly + sheet) ─────────────────────────────────────────────
  function focusPlaceOnMap(place: Place) {
    const map = mapRef.current;
    if (!map) return;

    const passesPrice = placePassesPriceFilter(place, priceMin, priceMax);
    const passesCategory = placePassesCategoryFilter(place, selectedCategories);
    const passesName = placePassesNameFilter(place, nameQuery);
    const bypass = passesPrice && passesCategory && passesName ? null : place.id;
    setFocusBypassId(bypass);
    setSearchChip({ text: place.name || '—', placeId: place.id });
    setModalSearch(false);
    closeAllPopups();

    const targetZoom = Math.max(map.getZoom(), 15);
    map.flyTo({ center: [place.lng, place.lat], zoom: targetZoom, essential: true });

    let opened = false;
    function openSheet() {
      if (opened) return;
      opened = true;
      setSelectedPlaceId(place.id);
    }
    map.once('moveend', openSheet);
    setTimeout(openSheet, 900);
  }

  function dismissChip() {
    setSearchChip(null);
    setNameQuery('');
    setFocusBypassId(null);
    closeAllPopups();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const selectedPlace = places.find((place) => String(place.id) === String(selectedPlaceId)) ?? null;
  const hasActiveMapFilter = !isFullPriceRange(priceMin, priceMax) || selectedCategories.length > 0;

  return (
    <div className="app-shell">
      <MapView containerRef={mapContainerRef} />

      <div className="map-overlay-root">
        <header className="map-app-header" role="banner">
          <div className="map-app-header__brand">
            <h1 className="map-app-header__title">Карта нищего</h1>
            <p className="map-app-header__subtitle">
              Подборка ресторанов с наилучшим соотношением цены и качества в эпоху высоких цен.
            </p>
          </div>
        </header>

        <div className="map-left-rail">
          <MapSidebar places={visiblePlaces} onSelectPlace={focusPlaceOnMap} />
        </div>

        <div className="map-pc-right-rail">
          <div className="map-right-controls">
            <FabStack
              chip={searchChip}
              onOpenPriceFilter={() => setModalPrice(true)}
              onOpenNameSearch={() => setModalSearch(true)}
              onDismissChip={dismissChip}
            />
            {hasActiveMapFilter && (
              <div className="map-filter-pill" role="status">
                <span>
                  ~{priceMax.toLocaleString('ru-RU')}
                  {selectedCategories.length > 0 ? ` · ${selectedCategories.length} cat.` : ''}
                </span>
                <button type="button" onClick={handleClearPriceFilter} aria-label="Clear filters">
                  ×
                </button>
              </div>
            )}
          </div>

          {recentPanelOpen ? (
            <RecentRegistrationsPanel
              places={places}
              visibleCount={visiblePlaces.length}
              totalCount={places.length}
              priceMin={priceMin}
              priceMax={priceMax}
              onSelectPlace={focusPlaceOnMap}
              onClose={() => setRecentPanelOpen(false)}
            />
          ) : (
            <button
              type="button"
              className="map-panel-reopen"
              onClick={() => setRecentPanelOpen(true)}
            >
              Свежие
            </button>
          )}
        </div>

        <div className="controls">
          <button
            type="button"
            className={`btn${isAddingMode ? ' btn-primary' : ''}`}
            onClick={enableAddMode}
          >
            {isAddingMode ? 'Отменить выбор точки' : 'Добавить новое место'}
          </button>
        </div>
      </div>

      {isAddingMode && (
        <div className="map-hint-banner">
          <span className="map-hint-icon">📍</span>
          <span>Нажмите на карту, чтобы отметить новое заведение</span>
          <button type="button" className="map-hint-close" onClick={enableAddMode}>✕</button>
        </div>
      )}

      {toast && (
        <StatusToast
          key={toast.key}
          message={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      <PriceModal
        open={modalPrice}
        priceMin={priceMin}
        priceMax={priceMax}
        selectedCategories={selectedCategories}
        onClose={() => setModalPrice(false)}
        onApply={handleApplyPrice}
      />

      <SearchModal
        open={modalSearch}
        initialQuery={nameQuery}
        places={places}
        onClose={() => setModalSearch(false)}
        onApply={handleApplyNameSearch}
        onSelectPlace={(place) => focusPlaceOnMap(place)}
        onClear={handleClearSearch}
      />

      <AddPlaceModal
        open={modalAdd}
        onClose={() => { setModalAdd(false); setPendingCoords(null); }}
        onSubmit={handleAddSubmit}
      />

      <PlaceSheet
        place={selectedPlace}
        onClose={closeAllPopups}
        onVote={handleVote}
        onDelete={handleDelete}
      />
    </div>
  );
}
