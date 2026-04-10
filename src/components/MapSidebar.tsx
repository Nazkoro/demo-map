import { getFirstEmoji } from '../lib/categories';
import { formatRuNum } from '../lib/filters';
import type { Place } from '../types';

interface Props {
  places: Place[];
  onSelectPlace: (place: Place) => void;
}

function getScore(place: Place): number {
  return place.votesUp - place.votesDown;
}

export default function MapSidebar({ places, onSelectPlace }: Props) {
  const rankedPlaces = [...places]
    .sort((a, b) => {
      const scoreDiff = getScore(b) - getScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return b.createdAt - a.createdAt;
    })
    .slice(0, 5);

  return (
    <section className="map-side-sheet" aria-label="Подборка мест">
      <div className="map-side-sheet-head">
        <h1 className="map-side-title">Карта нищего</h1>
        <p className="map-side-subtitle">
          Подборка мест с лучшим соотношением цены и качества на этой карте.
        </p>
      </div>

      <div className="map-side-toolbar">
        <span className="map-side-toolbar-label">Рейтинг</span>
        <button type="button" className="map-side-toolbar-toggle" aria-label="Свернуть список">
          ⌄
        </button>
      </div>

      <div className="map-side-list" role="list">
        {rankedPlaces.map((place, index) => (
          <button
            key={place.id}
            type="button"
            className="map-side-item"
            onClick={() => onSelectPlace(place)}
          >
            <span className="map-side-rank">#{index + 1}</span>
            <div className="map-side-item-main">
              <div className="map-side-name-row">
                <span className="map-side-item-emoji">{getFirstEmoji(place.categories)}</span>
                <span className="map-side-item-name">{place.name || 'Без названия'}</span>
                <span className="map-side-item-price">
                  {place.price > 0 ? formatRuNum(place.price) : '0'}
                </span>
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
    </section>
  );
}
