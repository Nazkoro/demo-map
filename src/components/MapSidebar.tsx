import { useEffect, useMemo, useRef, useState } from 'react';

import { getFirstEmoji } from '../lib/categories';
import { formatRuNum } from '../lib/filters';
import type { Place } from '../types';

interface Props {
  places: Place[];
  onSelectPlace: (place: Place) => void;
}

const PAGE_SIZE = 10;

function getScore(place: Place): number {
  return place.votesUp - place.votesDown;
}

export default function MapSidebar({ places, onSelectPlace }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const syncCollapsedState = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsCollapsed(event.matches);
    };

    syncCollapsedState(mq);
    mq.addEventListener('change', syncCollapsedState);

    return () => {
      mq.removeEventListener('change', syncCollapsedState);
    };
  }, []);

  const rankedPlaces = useMemo(
    () =>
      [...places].sort((a, b) => {
        const scoreDiff = getScore(b) - getScore(a);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return b.createdAt - a.createdAt;
      }),
    [places],
  );

  const totalPages = Math.max(1, Math.ceil(rankedPlaces.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pagedPlaces = rankedPlaces.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage((prevPage) => Math.min(prevPage, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    if (!isCollapsed && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [page, isCollapsed]);

  return (
    <section className={`map-side-sheet${isCollapsed ? ' is-collapsed' : ''}`} aria-label="Подборка мест">
      {!isCollapsed && (
        <div className="map-side-sheet-head">
          <h1 className="map-side-title">Карта нищего</h1>
          <p className="map-side-subtitle">Подборка мест с лучшим соотношением цены и качества на этой карте.</p>
        </div>
      )}
      <div className="map-side-toolbar">
        <span className="map-side-toolbar-label">Рейтинг</span>
        <button
          type="button"
          className={`map-side-toolbar-toggle${isCollapsed ? ' is-collapsed' : ''}`}
          aria-label={isCollapsed ? 'Развернуть список' : 'Свернуть список'}
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M5 12.5L10 7.5L15 12.5" />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div ref={listRef} className="map-side-list" role="list">
          {pagedPlaces.map((place, index) => (
            <button key={place.id} type="button" className="map-side-item" onClick={() => onSelectPlace(place)}>
              <span className="map-side-rank">#{pageStart + index + 1}</span>
              <div className="map-side-item-main">
                <div className="map-side-name-row">
                  <span className="map-side-item-emoji">{getFirstEmoji(place.categories)}</span>
                  <span className="map-side-item-name">{place.name || 'Без названия'}</span>
                  <span className="map-side-item-price">{place.price > 0 ? formatRuNum(place.price) : '0'}</span>
                </div>
                <span className="map-side-item-address">{place.address || 'Адрес не указан'}</span>
              </div>
              <span className="map-side-item-score">
                {getScore(place) >= 0 ? '+' : ''}
                {getScore(place)}
              </span>
            </button>
          ))}
        </div>
      )}

      {!isCollapsed && totalPages > 1 && (
        <div className="map-side-pagination">
          <button
            type="button"
            className="map-side-pagination-btn"
            aria-label="Предыдущая страница"
            disabled={page === 0}
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          >
            ‹
          </button>
          <span className="map-side-pagination-label">{page + 1} стр.</span>
          <button
            type="button"
            className="map-side-pagination-btn"
            aria-label="Следующая страница"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}
