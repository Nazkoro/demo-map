import type { Place } from '../types';
import { CATEGORIES, getFirstEmoji } from '../lib/categories';

interface Props {
  place: Place | null;
  onClose: () => void;
  onVote: (placeId: string, isUp: boolean) => void;
  onDelete: (placeId: string) => void;
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

export default function PlaceSheet({ place, onClose, onVote, onDelete }: Props) {
  if (!place) return null;

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.lat},${place.lng}`,
  )}`;
  const categoryLabels = getCategoryLabels(place.categories);
  const categoryText = categoryLabels.join(', ') || 'Не указана';
  const score = place.votesUp - place.votesDown;
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
      <button
        type="button"
        className="place-sheet-backdrop"
        onClick={onClose}
        aria-label="Закрыть карточку"
      />
      <section className="place-sheet" role="dialog" aria-labelledby="placeSheetTitle">
        <div className="place-sheet-handle" />
        <div className="place-popup-head">
          <div className="place-popup-head-text">
            <h2 id="placeSheetTitle" className="place-popup-title">
              {place.name || 'Без названия'}
            </h2>
            <p className="place-popup-address">{place.address || 'Адрес не указан'}</p>
          </div>
          <button type="button" className="place-popup-close" onClick={onClose} aria-label="Закрыть">
            ⋯
          </button>
        </div>

        <div className="place-popup-scroll">
          <div className="place-popup-media-row">
            <div className="place-popup-media-card">
              <div className="place-popup-media-emoji">{getFirstEmoji(place.categories)}</div>
              <p className="place-popup-media-caption">Нет фото</p>
            </div>
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="place-popup-add-button"
              aria-label="Открыть место в картах"
            >
              ↗
            </a>
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
              <p className="place-popup-card-label">Обновлено</p>
              <p className="place-popup-card-text">{formatDate(place.createdAt)}</p>
            </div>
          </div>

          <div className="place-popup-note-card">
            <p className="place-popup-card-label">Заметка</p>
            <p className="place-popup-note-text">{place.note || 'Пока без заметки.'}</p>
          </div>

          {place.hours && (
            <div className="place-popup-note-card">
              <p className="place-popup-card-label">Часы работы</p>
              <p className="place-popup-note-text">{place.hours}</p>
            </div>
          )}

          <div className="place-popup-actions-row">
            <button
              type="button"
              className="place-popup-pill-button"
              onClick={() => onVote(place.id, true)}
            >
              ❤ {place.votesUp}
            </button>
            <button
              type="button"
              className="place-popup-pill-button"
              onClick={() => onVote(place.id, true)}
            >
              Цена/Качество ↑
            </button>
          </div>

          <div className="place-popup-actions-col">
            <a href={mapUrl} target="_blank" rel="noreferrer" className="place-popup-pill-button place-popup-pill-link">
              Посмотреть на картах
            </a>
            <button
              type="button"
              className="place-popup-pill-button"
              onClick={() => onVote(place.id, false)}
            >
              Цена/Качество ↓
            </button>
          </div>

          <div className="place-popup-footer">
            <span className={`place-popup-score${score < 0 ? ' is-negative' : ''}`}>
              Рейтинг: {score >= 0 ? '+' : ''}{score}
            </span>
            <button type="button" className="place-popup-delete" onClick={() => onDelete(place.id)}>
              Удалить место
            </button>
          </div>

          <div className="place-popup-comments">
            <div className="place-popup-comments-head">
              <h4 className="place-popup-comments-title">Комментарии</h4>
              <span className="place-popup-comments-count">{syntheticComments.length}</span>
            </div>

            <div className="place-popup-comment-composer">
              <div className="place-popup-comment-auth">
                <input
                  className="place-popup-comment-input"
                  type="text"
                  placeholder="Никнейм"
                />
                <input
                  className="place-popup-comment-input"
                  type="password"
                  placeholder="Пароль"
                />
                <button type="button" className="place-popup-comment-register">
                  Регистрация
                </button>
              </div>
              <textarea
                className="place-popup-comment-textarea"
                placeholder="Оставьте ваш отзыв..."
              />
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
    </div>
  );
}
