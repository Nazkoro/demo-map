interface SearchChip {
  text: string;
  placeId: string;
}

interface Props {
  chip: SearchChip | null;
  onOpenPriceFilter: () => void;
  onOpenNameSearch: () => void;
  onDismissChip: () => void;
}

export default function FabStack({ chip, onOpenPriceFilter, onOpenNameSearch, onDismissChip }: Props) {
  return (
    <div className="map-fab-stack" aria-label="Действия на карте">
      <div className="map-fab-row">
        <button
          type="button"
          className="map-fab"
          title="Фильтр по цене"
          aria-label="Фильтр по цене"
          onClick={onOpenPriceFilter}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        </button>
        <button
          type="button"
          className="map-fab"
          title="Поиск по названию"
          aria-label="Поиск по названию"
          onClick={onOpenNameSearch}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </div>
      {chip && (
        <div className="map-search-chip-wrap">
          <div className="map-search-chip" role="status">
            <span className="map-search-chip-label">{chip.text}</span>
            <button
              type="button"
              className="map-search-chip-dismiss"
              aria-label="Показать все точки на карте"
              onClick={(e) => { e.stopPropagation(); onDismissChip(); }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
