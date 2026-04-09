import { useState, useEffect, useRef } from 'react';
import type { Place } from '../types';

interface Props {
  open: boolean;
  initialQuery: string;
  places: Place[];
  onClose: () => void;
  onApply: (query: string) => void;
  onSelectPlace: (place: Place) => void;
  onClear: () => void;
}

export default function SearchModal({
  open,
  initialQuery,
  places,
  onClose,
  onApply,
  onSelectPlace,
  onClear,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, initialQuery]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const matches = q
    ? places.filter((p) => (p.name || '').toLowerCase().includes(q))
    : [];

  const hint = !q
    ? 'Введите название — ниже появятся совпадения. Нажмите на строку, чтобы перейти к маркеру.'
    : matches.length > 0
      ? `Найдено: ${matches.length}. Нажмите строку — карта перейдёт к маркеру.`
      : 'Ничего не найдено. Попробуйте другой запрос.';

  function handleApply() {
    if (query.trim() && matches.length === 1) {
      onSelectPlace(matches[0]);
    } else {
      onApply(query);
    }
  }

  return (
    <div
      className="modal modal-glass active"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-modal-card glass-modal-card--search" role="dialog" aria-labelledby="modalSearchTitle">
        <div className="glass-modal-head">
          <h3 id="modalSearchTitle">Поиск заведений</h3>
          <button type="button" className="glass-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="glass-search-field">
          <svg className="glass-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            placeholder="Поиск по названию заведения"
            autoComplete="off"
            aria-label="Название заведения"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          />
        </div>
        <p className="search-results-hint">{hint}</p>
        {matches.length > 0 && (
          <ul className="search-results-list" role="listbox" aria-label="Совпадения по названию">
            {matches.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className="search-result-item"
                  role="option"
                  onClick={() => onSelectPlace(place)}
                >
                  <span className="search-result-name">{place.name || '—'}</span>
                  <span className="search-result-price">{place.price || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="glass-modal-actions">
          <button type="button" className="glass-btn-secondary" onClick={onClear}>
            Очистить
          </button>
          <button type="button" className="glass-btn-primary" onClick={handleApply}>
            Поиск
          </button>
        </div>
      </div>
    </div>
  );
}
