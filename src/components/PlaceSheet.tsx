import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

import type { Place } from '../types';
import { CATEGORIES, getFirstEmoji } from '../lib/categories';

interface Props {
  place: Place | null;
  onClose: () => void;
  onVote: (placeId: string, isUp: boolean) => void;
  onDelete: (placeId: string) => void;
  onEdit: (place: Place) => void;
}

function formatPrice(price: number): string {
  return price > 0 ? `${price} BYN` : 'Цена не указана';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getCategoryLabels(ids: string[]): string[] {
  return ids.map((id) => CATEGORIES.find((item) => item.id === id)?.label ?? id);
}

function closeHeadMenu(e: MouseEvent<Element>) {
  (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
}

export default function PlaceSheet({ place, onClose, onVote, onDelete, onEdit }: Props) {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);

  useEffect(() => {
    setFullscreenImage(null);
  }, [place?.id]);

  useEffect(() => {
    setDragOffset(0);
    setIsDraggingSheet(false);
    dragPointerIdRef.current = null;
  }, [place?.id]);

  useEffect(() => {
    if (!fullscreenImage) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenImage(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenImage]);

  if (!place) {
    return null;
  }

  const closeThreshold = 110;

  const handleDragStart = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    dragPointerIdRef.current = e.pointerId;
    dragStartYRef.current = e.clientY;
    setIsDraggingSheet(true);
    setDragOffset(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSheet || dragPointerIdRef.current !== e.pointerId) {
      return;
    }
    const nextOffset = Math.max(0, e.clientY - dragStartYRef.current);
    setDragOffset(nextOffset);
  };

  const finishDrag = (pointerId: number) => {
    if (dragPointerIdRef.current !== pointerId) {
      return;
    }
    dragPointerIdRef.current = null;
    const shouldClose = dragOffset > closeThreshold;
    setIsDraggingSheet(false);
    if (shouldClose) {
      onClose();
      return;
    }
    setDragOffset(0);
  };

  const handleDragEnd = (e: PointerEvent<HTMLDivElement>) => {
    finishDrag(e.pointerId);
  };

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.lat},${place.lng}`)}`;
  const categoryLabels = getCategoryLabels(place.categories);
  const categoryText = categoryLabels.join(', ') || 'Не указана';
  const totalVotes = place.votesUp + place.votesDown;
  const growthPct = totalVotes > 0 ? Math.round((place.votesUp / totalVotes) * 100) : 0;
  const declinePct = totalVotes > 0 ? Math.round((place.votesDown / totalVotes) * 100) : 0;
  const barUp = totalVotes === 0 ? 50 : growthPct;
  const barDown = totalVotes === 0 ? 50 : declinePct;
  const syntheticComments = place.note
    ? [
        {
          id: `${place.id}-note`,
          author: 'Аноним',
          text: place.note,
          createdLabel: formatDate(place.createdAt),
        },
      ]
    : [];

  return (
    <div className="place-sheet-layer" aria-live="polite">
      <button type="button" className="place-sheet-backdrop" onClick={onClose} aria-label="Закрыть карточку" />
      <section
        className={`place-sheet${isDraggingSheet ? ' is-dragging' : ''}`}
        role="dialog"
        aria-labelledby="placeSheetTitle"
        style={{ transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined }}
      >
        <div
          className={`place-sheet-handle${isDraggingSheet ? ' is-active' : ''}`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        />
        <div className="place-popup-head">
          <div className="place-popup-head-text">
            <h2 id="placeSheetTitle" className="place-popup-title">
              {place.name || 'Без названия'}
            </h2>
            <p className="place-popup-address">{place.address || 'Адрес не указан'}</p>
          </div>
          <div className="place-popup-head-actions">
            <details className="place-popup-menu-wrap">
              <summary className="place-popup-head-icon place-popup-menu-trigger" aria-label="Меню">
                ⋯
              </summary>
              <div className="place-popup-menu">
                <button
                  type="button"
                  className="place-popup-menu-item"
                  onClick={(e) => {
                    closeHeadMenu(e);
                    onEdit(place);
                  }}
                >
                  Редактировать
                </button>
                <button
                  type="button"
                  className="place-popup-menu-item"
                  onClick={(e) => {
                    closeHeadMenu(e);
                    onDelete(place.id);
                  }}
                >
                  Удалить место
                </button>
                <button
                  type="button"
                  className="place-popup-menu-item"
                  onClick={(e) => {
                    closeHeadMenu(e);
                    onClose();
                  }}
                >
                  Закрыть
                </button>
              </div>
            </details>
          </div>
        </div>

        <div className="place-popup-scroll">
          <div className="place-popup-media-row">
            {place.imageUrls.length > 0 ? (
              <>
                <div className="place-popup-media-card place-popup-media-card--photo">
                  <button
                    type="button"
                    className="place-popup-media-image-btn"
                    onClick={() => setFullscreenImage(place.imageUrls[0])}
                    aria-label="Открыть фото на весь экран"
                  >
                    <img className="place-popup-media-image" src={place.imageUrls[0]} alt={place.name || 'Фото заведения'} />
                  </button>
                </div>
                {place.imageUrls[1] ? (
                  <div className="place-popup-media-card place-popup-media-card--photo">
                    <button
                      type="button"
                      className="place-popup-media-image-btn"
                      onClick={() => setFullscreenImage(place.imageUrls[1])}
                      aria-label="Открыть фото на весь экран"
                    >
                      <img className="place-popup-media-image" src={place.imageUrls[1]} alt={`${place.name || 'Фото'} 2`} />
                    </button>
                  </div>
                ) : (
                  <div className="place-popup-media-card">
                    <div className="place-popup-media-emoji">{getFirstEmoji(place.categories)}</div>
                    <p className="place-popup-media-caption">{place.imageUrls.length} фото</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="place-popup-media-card">
                  <div className="place-popup-media-emoji">{getFirstEmoji(place.categories)}</div>
                  <p className="place-popup-media-caption">Нет изображения</p>
                </div>
                <button type="button" className="place-popup-add-button" disabled aria-label="Добавить фото (скоро)">
                  +
                </button>
              </>
            )}
          </div>

          <div className="place-popup-grid">
            <div className="place-popup-info-card">
              <p className="place-popup-card-label">Категория</p>
              <div className="place-popup-card-value">
                <span>{getFirstEmoji(place.categories)}</span>
                <span>{categoryText}</span>
              </div>
            </div>
            <div className="place-popup-info-card">
              <p className="place-popup-card-label">Цена</p>
              <p className="place-popup-card-text">{formatPrice(place.price)}</p>
            </div>
            <div className="place-popup-info-card">
              <p className="place-popup-card-label">Меню</p>
              <p className="place-popup-card-text">{place.dish || 'Не указано'}</p>
            </div>
            <div className="place-popup-info-card">
              <p className="place-popup-card-label">Подано</p>
              <p className="place-popup-card-text">{formatDate(place.createdAt)}</p>
            </div>
          </div>

          <div className="place-popup-note-card">
            <p className="place-popup-card-label">Примечание</p>
            <p className="place-popup-note-text">{place.note || 'Пока без текста.'}</p>
          </div>

          {place.hours && (
            <div className="place-popup-note-card">
              <p className="place-popup-card-label">Часы работы</p>
              <p className="place-popup-note-text">{place.hours}</p>
            </div>
          )}

          <div className="place-popup-vote-wrap">
            <div className="place-popup-vote-bar" aria-hidden="true">
              <div className="place-popup-vote-bar-up" style={{ width: `${barUp}%` }} />
              <div className="place-popup-vote-bar-down" style={{ width: `${barDown}%` }} />
            </div>
            <div className="place-popup-vote-labels">
              <span className="place-popup-vote-label place-popup-vote-label--up">Рост {growthPct}%</span>
              <span className="place-popup-vote-label place-popup-vote-label--down">Снижение на {declinePct}%</span>
            </div>
          </div>

          <div className="place-popup-actions-grid">
            <button type="button" className="place-popup-pill-button" onClick={() => onVote(place.id, true)}>
              <span aria-hidden="true">❤</span> {place.votesUp}
            </button>
            <button type="button" className="place-popup-pill-button" onClick={() => onVote(place.id, true)}>
              Значение ↑
            </button>
            <a href={mapUrl} target="_blank" rel="noreferrer" className="place-popup-pill-button place-popup-pill-link">
              Открыть на карте
            </a>
            <button type="button" className="place-popup-pill-button" onClick={() => onVote(place.id, false)}>
              Ценность ↓
            </button>
          </div>

          <p className="place-popup-comments-bar">Комментарии: {syntheticComments.length}</p>

          <div className="place-popup-comments">
            <div className="place-popup-comment-composer">
              <div className="place-popup-comment-auth">
                <input className="place-popup-comment-input" type="text" placeholder="Никнейм" />
                <input className="place-popup-comment-input" type="password" placeholder="Пароль" />
                <button type="button" className="place-popup-comment-register">
                  Регистрация
                </button>
              </div>
              <textarea className="place-popup-comment-textarea" placeholder="Оставьте ваш отзыв..." />
              <div className="place-popup-comment-tools">
                <button type="button" className="place-popup-comment-chip">
                  Добавить фото 0/5
                </button>
              </div>
            </div>

            <div className="place-popup-comment-filters">
              <button type="button" className="place-popup-comment-filter is-active">
                Сначала новые
              </button>
              <button type="button" className="place-popup-comment-filter">
                По лайкам
              </button>
            </div>

            <div className="place-popup-comment-list">
              {syntheticComments.length > 0 ? (
                syntheticComments.map((comment) => (
                  <article key={comment.id} className="place-popup-comment-card">
                    <div className="place-popup-comment-card-head">
                      <h5 className="place-popup-comment-author">{comment.author}</h5>
                      <button type="button" className="place-popup-comment-more" aria-label="Действия">
                        ⋯
                      </button>
                    </div>
                    <p className="place-popup-comment-body">{comment.text}</p>
                    <div className="place-popup-comment-meta">
                      <span>{comment.createdLabel}</span>
                      <button type="button" className="place-popup-comment-like">
                        ❤ <span>0</span>
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="place-popup-comment-empty">
                  Пока нет комментариев. Здесь будет лента отзывов, когда добавишь поддержку хранения.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      {fullscreenImage && (
        <div className="place-image-viewer" role="dialog" aria-label="Просмотр фото">
          <button
            type="button"
            className="place-image-viewer__backdrop"
            onClick={() => setFullscreenImage(null)}
            aria-label="Закрыть просмотр фото"
          />
          <div className="place-image-viewer__content">
            <button
              type="button"
              className="place-image-viewer__close"
              onClick={() => setFullscreenImage(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <img className="place-image-viewer__image" src={fullscreenImage} alt={place.name || 'Фото заведения'} />
          </div>
        </div>
      )}
    </div>
  );
}
