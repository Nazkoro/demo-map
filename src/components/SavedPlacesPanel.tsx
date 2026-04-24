import { getFirstEmoji } from '../lib/categories';
import { formatRuNum } from '../lib/filters';
import type { Place } from '../types';

interface Props {
  open: boolean;
  places: Place[];
  loading: boolean;
  onClose: () => void;
  onSelectPlace: (place: Place) => void;
}

export default function SavedPlacesPanel({ open, places, loading, onClose, onSelectPlace }: Props) {
  if (!open) {
    return null;
  }

  return (
    <section className="saved-list-panel" aria-label="Saved list">
      <header className="saved-list-panel__head">
        <h2 className="saved-list-panel__title">Saved list</h2>
        <button type="button" className="saved-list-panel__close" aria-label="Закрыть saved list" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="saved-list-panel__list" role="list">
        {loading ? (
          <div className="saved-list-panel__empty">Загрузка...</div>
        ) : places.length > 0 ? (
          places.map((place) => (
            <button key={place.id} type="button" className="saved-list-item" onClick={() => onSelectPlace(place)}>
              <div className="saved-list-item__main">
                <div className="saved-list-item__name-row">
                  <span className="saved-list-item__emoji">{getFirstEmoji(place.categories)}</span>
                  <span className="saved-list-item__name">{place.name || 'Без названия'}</span>
                  <span className="saved-list-item__price">{place.price > 0 ? `${formatRuNum(place.price)} BYN` : '—'}</span>
                </div>
                <span className="saved-list-item__address">{place.address || 'Адрес не указан'}</span>
              </div>
            </button>
          ))
        ) : (
          <div className="saved-list-panel__empty">Список сохраненных мест пока пуст.</div>
        )}
      </div>
    </section>
  );
}
