import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { NavLink } from 'react-router-dom';

import type { Place, PlaceFormData, PlaceUpdateData } from './types';
import {
  loadPlacesByViewport,
  loadRecentPlaces,
  searchPlacesByName,
  insertPlace,
  updatePlace,
  updateVotes,
  removePlace,
} from './lib/places';
import {
  PRICE_SLIDER_MIN,
  PRICE_SLIDER_MAX,
  isFullPriceRange,
} from './lib/filters';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import {
  addMarkerLayers,
  CLUSTER_CIRCLES_LAYER_ID,
  CLUSTER_MARKER_ZOOM,
  CLUSTER_SOURCE_ID,
  ensureMarkerAssets,
  isClusterZoom,
  UNCLUSTERED_LOW_POINTS_LAYER_ID,
  UNCLUSTERED_POINTS_LAYER_ID,
  updateClusterSource,
} from './lib/mapMarkerHandler';

import MapView from './components/MapView';
import FabStack from './components/FabStack';
import StatusToast from './components/StatusToast';
import AddPlaceModal from './components/AddPlaceModal';
import EditPlaceModal from './components/EditPlaceModal';
import PriceModal from './components/PriceModal';
import SearchModal from './components/SearchModal';
import PlaceSheet from './components/PlaceSheet';
import RecentRegistrationsPanel from './components/RecentRegistrationsPanel';
import MapSidebar from './components/MapSidebar';
import { getVersatilesLightStyle } from './lib/versatilesLightStyle';
const MAP_CENTER: [number, number] = [27.5618, 53.9023];
const MAP_ZOOM = 12;
const VIEWPORT_FETCH_LIMIT = 500;
const VIEWPORT_FETCH_OFFSET = 0;
const VIEWPORT_FETCH_DEBOUNCE_MS = 250;
const SEARCH_FETCH_LIMIT = 30;
const SEARCH_FETCH_OFFSET = 0;
const RECENT_FETCH_LIMIT = 8;
const RECENT_FETCH_OFFSET = 0;

interface Toast {
  msg: string;
  type: 'info' | 'success' | 'error';
  key: number;
}

interface SearchChip {
  text: string;
  placeId: string;
}

function sessionMemberLabel(session: Session | null): string | null {
  const user = session?.user;
  if (!user) {
    return null;
  }
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const nick = meta?.nickname;
  if (typeof nick === 'string' && nick.trim()) {
    return nick.trim();
  }
  const email = user.email;
  if (email) {
    const local = email.split('@')[0];
    return local?.trim() || email;
  }
  return 'Участник';
}

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null!);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const addModeClickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [priceMin, setPriceMin] = useState(PRICE_SLIDER_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_SLIDER_MAX);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [searchChip, setSearchChip] = useState<SearchChip | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [recentPanelOpen, setRecentPanelOpen] = useState(true);

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lng: number; lat: number } | null>(null);

  const [modalPrice, setModalPrice] = useState(false);
  const [modalSearch, setModalSearch] = useState(false);
  const [modalAdd, setModalAdd] = useState(false);
  const [modalEdit, setModalEdit] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [memberLabel, setMemberLabel] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState<Place[]>([]);

  const [toast, setToast] = useState<Toast | null>(null);
  const [currentZoom, setCurrentZoom] = useState(MAP_ZOOM);
  const [isMapReady, setIsMapReady] = useState(false);
  const fetchSeqRef = useRef(0);
  const searchSeqRef = useRef(0);

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    setToast({ msg, type, key: Date.now() });
  }, []);

  const fetchPlacesForViewport = useCallback(
    async () => {
      const map = mapRef.current;
      if (!map || !isMapReady) {
        return;
      }
      if (!supabase) {
        setPlaces([]);
        return;
      }

      const bounds = map.getBounds();
      if (!bounds) {
        return;
      }

      const west = bounds.getWest();
      const south = bounds.getSouth();
      const east = bounds.getEast();
      const north = bounds.getNorth();

      const requestId = ++fetchSeqRef.current;
      try {
        const nextPlaces = await loadPlacesByViewport({
          minLat: Math.min(south, north),
          minLng: Math.min(west, east),
          maxLat: Math.max(south, north),
          maxLng: Math.max(west, east),
          minPrice: priceMin === PRICE_SLIDER_MIN ? null : priceMin,
          maxPrice: priceMax === PRICE_SLIDER_MAX ? null : priceMax,
          categoryKeys: selectedCategories.length > 0 ? selectedCategories : null,
          limit: VIEWPORT_FETCH_LIMIT,
          offset: VIEWPORT_FETCH_OFFSET,
        });
        if (requestId !== fetchSeqRef.current) {
          return;
        }
        setPlaces(nextPlaces);
      } catch (e: unknown) {
        if (requestId !== fetchSeqRef.current) {
          return;
        }
        showToast('Не удалось загрузить точки по области: ' + (e instanceof Error ? e.message : String(e)), 'error');
      }
    },
    [isMapReady, priceMin, priceMax, selectedCategories, showToast],
  );

  const fetchSearchResults = useCallback(
    async (query: string) => {
      const normalized = query.trim();
      if (!normalized) {
        setSearchLoading(false);
        setSearchResults([]);
        return [];
      }
      const requestId = ++searchSeqRef.current;
      setSearchLoading(true);
      try {
        const matches = await searchPlacesByName({
          query: normalized,
          limit: SEARCH_FETCH_LIMIT,
          offset: SEARCH_FETCH_OFFSET,
        });
        if (requestId !== searchSeqRef.current) {
          return [];
        }
        setSearchResults(matches);
        setSearchLoading(false);
        return matches;
      } catch (e: unknown) {
        if (requestId !== searchSeqRef.current) {
          return [];
        }
        setSearchLoading(false);
        showToast('Не удалось выполнить поиск: ' + (e instanceof Error ? e.message : String(e)), 'error');
        return [];
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (!supabase) {
      setIsAuthenticated(false);
      setMemberLabel(null);
      return;
    }
    const applySession = (session: Session | null) => {
      setIsAuthenticated(Boolean(session));
      setMemberLabel(sessionMemberLabel(session));
    };
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) {
      return;
    }

    root.classList.add('is-map-mode');

    return () => {
      root.classList.remove('is-map-mode');
    };
  }, []);

  // ── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getVersatilesLightStyle(),
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      renderWorldCopies: false,
      minZoom: 5,
      maxZoom: 18,
      pitch: 0,
      attributionControl: false,
    });
    mapRef.current = map;

    const syncZoom = () => {
      setCurrentZoom(map.getZoom());
    };

    const zoomIntoCluster = async (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const geometry = feature?.geometry;
      const clusterId = feature?.properties?.cluster_id;
      if (!geometry || geometry.type !== 'Point' || clusterId == null) {
        return;
      }

      const [lng, lat] = geometry.coordinates as [number, number];
      const source = map.getSource(CLUSTER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

      let targetZoom = CLUSTER_MARKER_ZOOM;
      if (source) {
        try {
          const expansionZoom = await source.getClusterExpansionZoom(clusterId as number);
          // Если все точки кластера в одной координате (expansionZoom >= maxZoom),
          // всё равно уходим минимум в режим маркеров.
          targetZoom = Math.max(expansionZoom, CLUSTER_MARKER_ZOOM);
        } catch {
          // fallback — просто уйдём в режим маркеров
        }
      }

      map.easeTo({ center: [lng, lat], zoom: Math.min(targetZoom, 18), duration: 250 });
    };

    // Одиночная точка: на малом зуме приближаем, на большом открываем карточку.
    const zoomIntoSingleClusterPoint = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const geometry = feature?.geometry;
      if (!geometry || geometry.type !== 'Point') {
        return;
      }

      const id = feature.properties?.id;
      if (!isClusterZoom(map.getZoom())) {
        if (id) {
          setSelectedPlaceId(String(id));
        }
        return;
      }

      const [lng, lat] = geometry.coordinates as [number, number];
      map.easeTo({ center: [lng, lat], zoom: CLUSTER_MARKER_ZOOM, duration: 250 });
    };

    const setClusterCursor = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const resetClusterCursor = () => {
      if (!addModeClickHandlerRef.current) {
        map.getCanvas().style.cursor = '';
      }
    };

    map.on('load', async () => {
      addMarkerLayers(map);

      map.on('click', CLUSTER_CIRCLES_LAYER_ID, zoomIntoCluster);
      map.on('click', UNCLUSTERED_POINTS_LAYER_ID, zoomIntoSingleClusterPoint);
      map.on('click', UNCLUSTERED_LOW_POINTS_LAYER_ID, zoomIntoSingleClusterPoint);
      map.on('mouseenter', CLUSTER_CIRCLES_LAYER_ID, setClusterCursor);
      map.on('mouseenter', UNCLUSTERED_POINTS_LAYER_ID, setClusterCursor);
      map.on('mouseenter', UNCLUSTERED_LOW_POINTS_LAYER_ID, setClusterCursor);
      map.on('mouseleave', CLUSTER_CIRCLES_LAYER_ID, resetClusterCursor);
      map.on('mouseleave', UNCLUSTERED_POINTS_LAYER_ID, resetClusterCursor);
      map.on('mouseleave', UNCLUSTERED_LOW_POINTS_LAYER_ID, resetClusterCursor);

      syncZoom();
      if (!supabase) {
        showToast('Supabase не настроен', 'error');
      }
      try {
        const recent = await loadRecentPlaces({
          limit: RECENT_FETCH_LIMIT,
          offset: RECENT_FETCH_OFFSET,
        });
        setRecentPlaces(recent);
      } catch (e: unknown) {
        showToast('Не удалось загрузить блок "Оценка": ' + (e instanceof Error ? e.message : String(e)), 'error');
      }
      setIsMapReady(true);
    });

    map.on('click', () => {
      if (addModeClickHandlerRef.current) {
        return;
      } // handled by add-mode handler
      closeAllPopups();
    });
    map.on('zoom', syncZoom);

    return () => {
      map.off('click', CLUSTER_CIRCLES_LAYER_ID, zoomIntoCluster);
      map.off('click', UNCLUSTERED_POINTS_LAYER_ID, zoomIntoSingleClusterPoint);
      map.off('click', UNCLUSTERED_LOW_POINTS_LAYER_ID, zoomIntoSingleClusterPoint);
      map.off('mouseenter', CLUSTER_CIRCLES_LAYER_ID, setClusterCursor);
      map.off('mouseenter', UNCLUSTERED_POINTS_LAYER_ID, setClusterCursor);
      map.off('mouseenter', UNCLUSTERED_LOW_POINTS_LAYER_ID, setClusterCursor);
      map.off('mouseleave', CLUSTER_CIRCLES_LAYER_ID, resetClusterCursor);
      map.off('mouseleave', UNCLUSTERED_POINTS_LAYER_ID, resetClusterCursor);
      map.off('mouseleave', UNCLUSTERED_LOW_POINTS_LAYER_ID, resetClusterCursor);
      map.off('zoom', syncZoom);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleFetch = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void fetchPlacesForViewport();
      }, VIEWPORT_FETCH_DEBOUNCE_MS);
    };

    const onMoveEnd = () => {
      scheduleFetch();
    };

    map.on('moveend', onMoveEnd);
    scheduleFetch();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      map.off('moveend', onMoveEnd);
    };
  }, [isMapReady, fetchPlacesForViewport]);

  // Строгая граница: <10 кластеры, >=10 маркеры.
  const mapMode: 'cluster' | 'markers' = isClusterZoom(currentZoom) ? 'cluster' : 'markers';

  useEffect(() => {
    const map = mapRef.current;
    // `map.loaded()` во время активной анимации зума может возвращать false
    // (идёт загрузка тайлов), что раньше отсекало единственный триггер эффекта
    // на смену mapMode и кластеры переставали обновляться.
    // Достаточно убедиться, что источник уже добавлен (то есть отработал `load`).
    if (!map || !map.getSource(CLUSTER_SOURCE_ID)) {
      return;
    }
    ensureMarkerAssets(map, places);
    updateClusterSource(map, places);
    // Зависим от mapMode, а не currentZoom, чтобы не пересобирать DOM-маркеры
    // на каждом кадре анимации зума — только при фактическом переключении режима.
  }, [places, mapMode]);

  function closeAllPopups() {
    setSelectedPlaceId(null);
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') {
        return;
      }
      setModalPrice(false);
      setModalSearch(false);
      setModalEdit(false);
      closeAllPopups();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Vote ───────────────────────────────────────────────────────────────────
  function handleVote(placeId: string, isUp: boolean) {
    if (!isAuthenticated) {
      showToast('Войдите в аккаунт, чтобы голосовать', 'info');
      return;
    }
    setPlaces((prev) => {
      const updated = prev.map((p) => {
        if (String(p.id) !== String(placeId)) {
          return p;
        }
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
    if (!isAuthenticated) {
      showToast('Войдите в аккаунт, чтобы удалять места', 'info');
      return;
    }
    if (!confirm('Удалить эту точку?')) {
      return;
    }
    try {
      await removePlace(placeId);
    } catch {
      showToast('Не удалось удалить в Supabase', 'error');
      return;
    }
    setPlaces((prev) => prev.filter((p) => String(p.id) !== String(placeId)));
    if (searchChip?.placeId === placeId) {
      setSearchChip(null);
    }
    closeAllPopups();
    showToast('Точка удалена', 'success');
  }

  // ── Add mode ───────────────────────────────────────────────────────────────
  function enableAddMode() {
    const map = mapRef.current;
    if (!map) {
      return;
    }

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
    if (!pendingCoords) {
      return;
    }
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

  async function handleEditSubmit(form: PlaceUpdateData) {
    if (!editingPlace) {
      return;
    }
    if (!isAuthenticated) {
      showToast('Войдите в аккаунт, чтобы редактировать места', 'info');
      return;
    }
    try {
      const updated = await updatePlace(editingPlace.id, form);
      setPlaces((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setRecentPlaces((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSearchResults((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingPlace(updated);
      setSelectedPlaceId(updated.id);
      showToast('Изменения сохранены', 'success');
      setModalEdit(false);
    } catch (e: unknown) {
      showToast('Не удалось сохранить изменения: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  }

  // ── Price filter ──────────────────────────────────────────────────────────
  function handleApplyPrice(min: number, max: number, categories: string[]) {
    setPriceMin(min);
    setPriceMax(max);
    setSelectedCategories(categories);
    setSearchChip(null);
    setModalPrice(false);
    closeAllPopups();
  }

  function handleClearPriceFilter() {
    setPriceMin(PRICE_SLIDER_MIN);
    setPriceMax(PRICE_SLIDER_MAX);
    setSelectedCategories([]);
    setSearchChip(null);
    setModalPrice(false);
    closeAllPopups();
  }

  // ── Name search ───────────────────────────────────────────────────────────
  function handleApplyNameSearch(query: string) {
    setNameQuery(query);
    closeAllPopups();

    const run = async () => {
      if (!query.trim()) {
        setSearchChip(null);
        return;
      }
      const matches = await fetchSearchResults(query);
      if (matches.length === 0) {
        // Оставляем модалку открытой, чтобы пользователь мог сразу исправить запрос.
        setSearchChip(null);
        return;
      }
      if (matches.length === 1) {
        setModalSearch(false);
        const only = matches[0];
        setPlaces((prev) => (prev.some((p) => p.id === only.id) ? prev : [only, ...prev]));
        focusPlaceOnMap(only);
        return;
      }
      setSearchChip(null);
    };
    void run();
  }

  function handleClearSearch() {
    setNameQuery('');
    setSearchChip(null);
    setSearchResults([]);
    setSearchLoading(false);
    setModalSearch(false);
    closeAllPopups();
  }

  // ── Focus place (fly + sheet) ─────────────────────────────────────────────
  function focusPlaceOnMap(place: Place) {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    setSearchChip({ text: place.name || '—', placeId: place.id });
    setModalSearch(false);
    closeAllPopups();

    const targetZoom = Math.max(map.getZoom(), 15);
    map.flyTo({ center: [place.lng, place.lat], zoom: targetZoom, essential: true });

    let opened = false;
    function openSheet() {
      if (opened) {
        return;
      }
      opened = true;
      setSelectedPlaceId(place.id);
    }
    map.once('moveend', openSheet);
    setTimeout(openSheet, 900);
  }

  function dismissChip() {
    setSearchChip(null);
    setNameQuery('');
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
          <div className="map-app-header__actions">
            <button type="button" className={`map-header-add-btn${isAddingMode ? ' is-active' : ''}`} onClick={enableAddMode}>
              {isAddingMode ? 'Отменить выбор точки' : 'Добавить новое место'}
            </button>
          </div>
        </header>

        <div className="map-left-rail">
          <MapSidebar places={places} onSelectPlace={focusPlaceOnMap} />
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
              places={recentPlaces}
              onSelectPlace={(place) => {
                setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [place, ...prev]));
                focusPlaceOnMap(place);
              }}
              onClose={() => setRecentPanelOpen(false)}
            />
          ) : (
            <button type="button" className="map-panel-reopen" onClick={() => setRecentPanelOpen(true)}>
              Оценка
            </button>
          )}
        </div>

      </div>

      {isAddingMode && (
        <div className="map-hint-banner">
          <span className="map-hint-icon">📍</span>
          <span>Нажмите на карту, чтобы отметить новое заведение</span>
          <button type="button" className="map-hint-close" onClick={enableAddMode}>
            ✕
          </button>
        </div>
      )}

      {toast && <StatusToast key={toast.key} message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

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
        results={searchResults}
        isLoading={searchLoading}
        onClose={() => setModalSearch(false)}
        onApply={handleApplyNameSearch}
        onSelectPlace={(place) => {
          setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [place, ...prev]));
          focusPlaceOnMap(place);
        }}
        onClear={handleClearSearch}
      />

      <AddPlaceModal
        open={modalAdd}
        onClose={() => {
          setModalAdd(false);
          setPendingCoords(null);
        }}
        onSubmit={handleAddSubmit}
        isAuthenticated={isAuthenticated}
        memberLabel={memberLabel}
      />

      <EditPlaceModal
        open={modalEdit}
        place={editingPlace}
        onClose={() => setModalEdit(false)}
        onSubmit={handleEditSubmit}
      />

      <PlaceSheet
        place={selectedPlace}
        onClose={closeAllPopups}
        onVote={handleVote}
        onDelete={handleDelete}
        onEdit={(place) => {
          setEditingPlace(place);
          setModalEdit(true);
        }}
      />

      <nav className="map-bottom-nav" aria-label="Основная навигация">
        <NavLink to="/" end className={({ isActive }) => `map-bottom-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="map-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4.5 6.5 9 4l6 2.5 4.5-2v13L15 20l-6-2.5-4.5 2z" />
              <path d="M9 4v13.5M15 6.5V20" />
            </svg>
          </span>
        </NavLink>
        <NavLink to="/account" className={({ isActive }) => `map-bottom-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="map-bottom-nav__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4 8h16M4 16h16" />
              <circle cx="9" cy="8" r="2" />
              <circle cx="15" cy="16" r="2" />
            </svg>
          </span>
        </NavLink>
      </nav>
    </div>
  );
}
