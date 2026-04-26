import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import { CATEGORIES, getFirstEmoji } from '../lib/categories';
import { formatRuNum } from '../lib/filters';
import type { Place } from '../types';

const CLOSE_DRAG_THRESHOLD = 110;

function categorySubline(place: Place): string {
  const d = place.dish?.trim();
  if (d) {
    return d;
  }
  const id = place.categories[0];
  if (!id) {
    return '';
  }
  const full = CATEGORIES.find((c) => c.id === id)?.label ?? id;
  const tail = full.trim().split(/\s+/).slice(1).join(' ').trim();
  return tail || full;
}

interface Props {
  open: boolean;
  places: Place[];
  loading: boolean;
  onClose: () => void;
  onSelectPlace: (place: Place) => void;
}

export default function SavedPlacesPanel({ open, places, loading, onClose, onSelectPlace }: Props) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);
  const dragOffsetRef = useRef(0);

  useEffect(() => {
    if (open) {
      setDragOffset(0);
      dragOffsetRef.current = 0;
      setIsDraggingSheet(false);
      dragPointerIdRef.current = null;
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const isEmpty = !loading && places.length === 0;

  const handleDragStart = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    dragPointerIdRef.current = e.pointerId;
    dragStartYRef.current = e.clientY;
    setIsDraggingSheet(true);
    setDragOffset(0);
    dragOffsetRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== e.pointerId) {
      return;
    }
    const nextOffset = Math.max(0, e.clientY - dragStartYRef.current);
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  };

  const finishDrag = (pointerId: number) => {
    if (dragPointerIdRef.current !== pointerId) {
      return;
    }
    dragPointerIdRef.current = null;
    const shouldClose = dragOffsetRef.current > CLOSE_DRAG_THRESHOLD;
    setIsDraggingSheet(false);
    if (shouldClose) {
      onClose();
      return;
    }
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  const handleDragEnd = (e: PointerEvent<HTMLDivElement>) => {
    finishDrag(e.pointerId);
  };

  return (
    <div className="saved-list-layer" role="presentation">
      <button type="button" className="saved-list-backdrop" onClick={onClose} aria-label="Закрыть список сохраненных мест" />
      <section
        className={`saved-list-sheet${isEmpty ? ' saved-list-panel--empty' : ''}${
          isDraggingSheet ? ' is-dragging' : ''
        }`}
        style={{ transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="savedListTitle"
      >
        <div
          className={`place-sheet-handle${isDraggingSheet ? ' is-active' : ''}`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        />
        <header className="saved-list-panel__head">
          <h2 id="savedListTitle" className="saved-list-panel__title">
            Сохраненные места
          </h2>
          <button type="button" className="saved-list-panel__close" aria-label="Закрыть список сохраненных мест" onClick={onClose}>
            <span className="saved-list-panel__close-icon" aria-hidden="true">
              ×
            </span>
          </button>
        </header>

        <div
          className="saved-list-panel__list"
          role={places.length > 0 && !loading ? 'list' : undefined}
        >
          {loading ? (
            <p className="saved-list-panel__empty-hint">Загрузка…</p>
          ) : places.length > 0 ? (
            places.map((place) => {
              const thumb = place.imageUrls[0];
              const sub = categorySubline(place);
              return (
                <button key={place.id} type="button" className="saved-list-item" onClick={() => onSelectPlace(place)}>
                  {thumb ? (
                    <div className="saved-list-item__thumb">
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.closest('.saved-list-item__thumb')?.remove();
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="saved-list-item__body">
                    <div className="saved-list-item__name-row">
                      <span className="saved-list-item__emoji" aria-hidden="true">
                        {getFirstEmoji(place.categories)}
                      </span>
                      <span className="saved-list-item__name">{place.name || 'Без названия'}</span>
                    </div>
                    <p className="saved-list-item__address">{place.address || 'Адрес не указан'}</p>
                  </div>
                  <div className="saved-list-item__aside">
                    <span className="saved-list-item__price">
                      {place.price > 0 ? `${formatRuNum(place.price)} BYN` : '—'}
                    </span>
                    {sub ? <span className="saved-list-item__sub">{sub}</span> : null}
                  </div>
                </button>
              );
            })
          ) : (
            <p className="saved-list-panel__empty-hint">Пока нет сохранённых ресторанов.</p>
          )}
        </div>
      </section>
    </div>
  );
}
