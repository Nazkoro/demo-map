import { getFirstEmoji } from '../lib/categories';
import { formatRuNum, isFullPriceRange } from '../lib/filters';
import type { Place } from '../types';

interface Props {
  places: Place[];
  visibleCount: number;
  totalCount: number;
  priceMin: number;
  priceMax: number;
  onSelectPlace: (place: Place) => void;
  onClose: () => void;
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export default function RecentRegistrationsPanel({
  places,
  visibleCount,
  totalCount,
  priceMin,
  priceMax,
  onSelectPlace,
  onClose,
}: Props) {
  const recentPlaces = [...places]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  const priceLabel = isFullPriceRange(priceMin, priceMax)
    ? 'Любой чек'
    : `${formatRuNum(priceMin)} - ${formatRuNum(priceMax)} BYN`;

  return (
    <section className="map-overlay-sheet map-recent-registrations-card" aria-label="Свежие добавления">
      <div className="map-overlay-sheet-head">
        <div>
          <p className="map-overlay-kicker">Свежие добавления</p>
          <h2 className="map-overlay-title">Что недавно появилось</h2>
        </div>
        <div className="map-overlay-actions">
          <span className="map-overlay-badge">{visibleCount}/{totalCount}</span>
          <button
            type="button"
            className="map-overlay-close"
            aria-label="Скрыть панель свежих добавлений"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <p className="map-overlay-lead">
        Живая подборка мест. Нажмите на карточку, чтобы центрировать карту и открыть детали.
      </p>

      <div className="map-overlay-filter-pill">
        <span className="map-overlay-filter-label">Текущий лимит</span>
        <strong>{priceLabel}</strong>
      </div>

      <div className="map-recent-list" role="list">
        {recentPlaces.length > 0 ? (
          recentPlaces.map((place, index) => (
            <button
              key={place.id}
              type="button"
              className="map-recent-item"
              onClick={() => onSelectPlace(place)}
            >
              <span className="map-recent-index">#{index + 1}</span>
              <div className="map-recent-content">
                <div className="map-recent-title-row">
                  <span className="map-recent-emoji">{getFirstEmoji(place.categories)}</span>
                  <span className="map-recent-name">{place.name || 'Без названия'}</span>
                </div>
                <span className="map-recent-address">{place.address || 'Адрес не указан'}</span>
                <div className="map-recent-meta">
                  <span className="map-recent-price">
                    {place.price > 0 ? formatRuNum(place.price) : 'Чек не указан'}
                  </span>
                  <span>{formatTimestamp(place.createdAt)}</span>
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="map-recent-empty">
            Пока нет ни одной точки. Добавь первое место и панель начнет заполняться сама.
          </div>
        )}
      </div>
    </section>
  );
}
