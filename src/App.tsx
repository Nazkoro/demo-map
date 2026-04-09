import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

import type { Place, PlaceFormData } from './types';
import { getFirstEmoji } from './lib/categories';
import { loadPlaces, insertPlace, updateVotes, removePlace } from './lib/places';
import {
  PRICE_SLIDER_MIN,
  PRICE_SLIDER_MAX,
  getVisiblePlaces,
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

function generatePopupHTML(place: Place): string {
  const cats = place.categories.length
    ? `<div class="popup-cats">${place.categories.map((c) => `<span class="popup-cat">${escapeHtml(c)}</span>`).join('')}</div>`
    : '';
  const priceLabel = place.price ? `${place.price} BYN` : '';
  const dishPrice = (place.dish || priceLabel)
    ? `<div class="popup-dish-row">
        ${place.dish ? `<span>🍽 ${escapeHtml(place.dish)}</span>` : ''}
        ${priceLabel ? `<span class="popup-price-chip">💰 ${priceLabel}</span>` : ''}
       </div>`
    : '';
  const hours = place.hours ? `<div class="popup-hours">🕐 ${escapeHtml(place.hours)}</div>` : '';
  const address = place.address ? `<div class="popup-address">📍 ${escapeHtml(place.address)}</div>` : '';
  const note = place.note ? `<div class="popup-note">📝 ${escapeHtml(place.note)}</div>` : '';

  return `
    <div class="popup-body">
      <div class="popup-title">${escapeHtml(place.name)}</div>
      ${cats}
      ${dishPrice}
      ${address}
      ${hours}
      ${note}
      <div class="popup-votes">
        <button class="vote-btn vote-up" data-id="${place.id}" data-vote="up">👍 ${place.votesUp}</button>
        <button class="vote-btn vote-down" data-id="${place.id}" data-vote="down">👎 ${place.votesDown}</button>
      </div>
      <button class="vote-btn delete-btn" data-id="${place.id}">🗑️ Удалить</button>
      <div class="popup-meta">добавлено ${new Date(place.createdAt).toLocaleDateString()}</div>
    </div>
  `;
}

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null!);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentMarkersRef = useRef<maplibregl.Marker[]>([]);
  const markerByPlaceIdRef = useRef<Record<string, maplibregl.Marker>>({});
  const currentPopupRef = useRef<maplibregl.Popup | null>(null);
  const addModeClickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [priceMin, setPriceMin] = useState(PRICE_SLIDER_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_SLIDER_MAX);
  const [nameQuery, setNameQuery] = useState('');
  const [focusBypassId, setFocusBypassId] = useState<string | null>(null);
  const [searchChip, setSearchChip] = useState<SearchChip | null>(null);

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lng: number; lat: number } | null>(null);

  const [modalPrice, setModalPrice] = useState(false);
  const [modalSearch, setModalSearch] = useState(false);
  const [modalAdd, setModalAdd] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    setToast({ msg, type, key: Date.now() });
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
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
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
  const visiblePlaces = getVisiblePlaces(places, priceMin, priceMax, nameQuery, focusBypassId);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    rebuildMarkers(map, visiblePlaces);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePlaces]);

  function closeAllPopups() {
    if (currentPopupRef.current) {
      currentPopupRef.current.remove();
      currentPopupRef.current = null;
    }
  }

  function rebuildMarkers(map: maplibregl.Map, visible: Place[]) {
    currentMarkersRef.current.forEach((m) => m.remove());
    currentMarkersRef.current = [];
    markerByPlaceIdRef.current = {};

    visible.forEach((place) => {
      const emoji = getFirstEmoji(place.categories);
      const priceText = place.price ? `${place.price} BYN` : '';

      const tooltipRows = [
        `<span class="mtt-name">${escapeHtml(place.name)}</span>`,
        place.address ? `<span class="mtt-row">${escapeHtml(place.address)}</span>` : '',
        place.hours   ? `<span class="mtt-row">${escapeHtml(place.hours)}</span>`   : '',
      ].filter(Boolean).join('');

      const el = document.createElement('div');
      el.className = 'map-marker-pill';
      el.innerHTML =
        `<span class="map-marker-emoji">${emoji}</span>` +
        (priceText ? `<span class="map-marker-price">${priceText}</span>` : '') +
        `<div class="mtt">${tooltipRows}</div>`;

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      const popup = new maplibregl.Popup({ offset: 25, closeButton: true, closeOnClick: false })
        .setHTML(generatePopupHTML(place));

      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllPopups();
        popup.setHTML(generatePopupHTML(place));
        currentPopupRef.current = popup;
        marker.setPopup(popup).togglePopup();
      });

      currentMarkersRef.current.push(marker);
      markerByPlaceIdRef.current[String(place.id)] = marker;
    });
  }

  // ── Popup button delegation (vote / delete) ────────────────────────────────
  useEffect(() => {
    function handleBodyClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.classList) return;

      if (target.classList.contains('vote-btn') && !target.classList.contains('delete-btn')) {
        const placeId = target.getAttribute('data-id');
        const voteType = target.getAttribute('data-vote');
        if (placeId && voteType) {
          e.preventDefault();
          e.stopPropagation();
          handleVote(placeId, voteType === 'up');
        }
      }
      if (target.classList.contains('delete-btn')) {
        const placeId = target.getAttribute('data-id');
        if (placeId) {
          e.preventDefault();
          e.stopPropagation();
          handleDelete(placeId);
        }
      }
    }
    document.body.addEventListener('click', handleBodyClick);
    return () => document.body.removeEventListener('click', handleBodyClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setModalPrice(false);
      setModalSearch(false);
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
    closeAllPopups();
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
  function handleApplyPrice(min: number, max: number) {
    setPriceMin(min);
    setPriceMax(max);
    setFocusBypassId(null);
    setSearchChip(null);
    setModalPrice(false);
    closeAllPopups();
    const visible = getVisiblePlaces(places, min, max, nameQuery, null);
    const hidden = places.length - visible.length;
    if (hidden > 0) showToast(`Показано ${visible.length} из ${places.length} точек`, 'info');
  }

  // ── Name search ───────────────────────────────────────────────────────────
  function handleApplyNameSearch(query: string) {
    setNameQuery(query);
    setFocusBypassId(null);
    setModalSearch(false);
    closeAllPopups();
    if (query.trim()) {
      const matches = places.filter(
        (p) => placePassesPriceFilter(p, priceMin, priceMax) && placePassesNameFilter(p, query),
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

  // ── Focus place (fly + popup) ─────────────────────────────────────────────
  function focusPlaceOnMap(place: Place) {
    const map = mapRef.current;
    if (!map) return;

    const passesPrice = placePassesPriceFilter(place, priceMin, priceMax);
    const passesName = placePassesNameFilter(place, nameQuery);
    const bypass = passesPrice && passesName ? null : place.id;
    setFocusBypassId(bypass);
    setSearchChip({ text: place.name || '—', placeId: place.id });
    setModalSearch(false);
    closeAllPopups();

    const targetZoom = Math.max(map.getZoom(), 15);
    map.flyTo({ center: [place.lng, place.lat], zoom: targetZoom, essential: true });

    let opened = false;
    function tryOpenPopup() {
      if (opened) return;
      opened = true;
      const marker = markerByPlaceIdRef.current[String(place.id)];
      if (!marker) return;
      closeAllPopups();
      const popup = marker.getPopup();
      if (!popup) return;
      currentPopupRef.current = popup;
      marker.togglePopup();
    }
    map.once('moveend', tryOpenPopup);
    setTimeout(tryOpenPopup, 900);
  }

  function dismissChip() {
    setSearchChip(null);
    setNameQuery('');
    setFocusBypassId(null);
    closeAllPopups();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <MapView containerRef={mapContainerRef} />

      <FabStack
        chip={searchChip}
        onOpenPriceFilter={() => setModalPrice(true)}
        onOpenNameSearch={() => setModalSearch(true)}
        onDismissChip={dismissChip}
      />

      <div className="controls">
        <button
          type="button"
          className={`btn${isAddingMode ? ' btn-primary' : ''}`}
          onClick={enableAddMode}
        >
          {isAddingMode ? '❌ Отмена' : '➕ Добавить заведение'}
        </button>
      </div>

      {isAddingMode && (
        <div className="map-hint-banner">
          <span className="map-hint-icon">📍</span>
          <span>Кликните по карте, чтобы выбрать место заведения</span>
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
    </>
  );
}
