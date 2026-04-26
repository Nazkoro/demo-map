import { useEffect, useMemo, useState } from 'react';

import { getFirstEmoji } from '../lib/categories';
import { formatRuNum } from '../lib/filters';
import type { Place } from '../types';

interface Props {
  places: Place[];
  onSelectPlace: (place: Place) => void;
  onClose: () => void;
}

const PAGE_SIZE = 6;

/** Как на макете: 04/20, 21:17 */
function formatRecentStamp(timestamp: number): string {
  const d = new Date(timestamp);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}, ${hh}:${min}`;
}

export default function RecentRegistrationsPanel({ places, onSelectPlace, onClose }: Props) {
  const [page, setPage] = useState(0);

  const sortedByRecent = useMemo(
    () => [...places].sort((a, b) => b.createdAt - a.createdAt),
    [places],
  );

  const totalPages = Math.max(1, Math.ceil(sortedByRecent.length / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE;
  const pagePlaces = sortedByRecent.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  return (
    <section className="map-overlay-sheet map-recent-registrations-card" aria-label="Свежие добавления">
      <header className="map-recent-sheet-head">
        <div className="map-recent-sheet-head-text">
        <h2 className="map-recent-panel-title">Оценка</h2>
          {/* <h2 className="map-recent-panel-title">Свежие добавления</h2> */}
          <p className="map-recent-panel-sub">Пожалуйста, дайте строгий отзыв.</p>
        </div>
        <button
          type="button"
          className="map-recent-sheet-close"
          aria-label="Скрыть панель свежих добавлений"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="map-recent-card-list" role="list">
        {pagePlaces.length > 0 ? (
          pagePlaces.map((place, index) => (
            <button
              key={place.id}
              type="button"
              className="map-recent-card"
              onClick={() => onSelectPlace(place)}
            >
              <span className="map-recent-card-rank">#{pageStart + index + 1}</span>
              <div className="map-recent-card-main">
                <div className="map-recent-card-name-row">
                  <span className="map-recent-card-emoji">{getFirstEmoji(place.categories)}</span>
                  <div className="map-recent-card-namegroup">
                    <span className="map-recent-card-name">{place.name || 'Без названия'}</span>
                    <span className="map-recent-card-price">
                      {place.price > 0 ? formatRuNum(place.price) : '—'}
                    </span>
                  </div>
                </div>
                <span className="map-recent-card-address">{place.address || 'Адрес не указан'}</span>
              </div>
              <div className="map-recent-card-aside">
                <span className="map-recent-card-added">Добавлено</span>
                <span className="map-recent-card-datetime">{formatRecentStamp(place.createdAt)}</span>
              </div>
            </button>
          ))
        ) : (
          <div className="map-recent-card-empty" role="status">
            Пока нет ни одной точки. Добавь первое место — список заполнится сам.
          </div>
        )}
      </div>

      {sortedByRecent.length > 0 && totalPages > 1 && (
        <div className="map-recent-card-pagination">
          <button
            type="button"
            className="map-recent-card-pagination-btn"
            aria-label="Предыдущая страница"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹
          </button>
          <span className="map-recent-card-pagination-label">{page + 1} стр.</span>
          <button
            type="button"
            className="map-recent-card-pagination-btn"
            aria-label="Следующая страница"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}
