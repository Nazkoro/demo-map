import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, MouseEvent, PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Place, PlaceComment } from '../types';
import { CATEGORIES } from '../lib/categories';

interface Props {
  place: Place | null;
  comments: PlaceComment[];
  commentsLoading: boolean;
  isAuthenticated: boolean;
  currentUserId: string | null;
  isSaved: boolean;
  userVote: 'up' | 'down' | null;
  isVoting: boolean;
  onClose: () => void;
  onToggleSaved: (placeId: string) => Promise<void>;
  onVote: (placeId: string, isUp: boolean) => void;
  onDelete: (placeId: string) => void;
  onEdit: (place: Place) => void;
  onAddComment: (placeId: string, body: string, images: File[]) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

const MAX_COMMENT_IMAGES = 3;
const MAX_COMMENT_IMAGE_SIZE_MB = 3;
const MAX_COMMENT_IMAGE_SIZE_BYTES = MAX_COMMENT_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_COMMENT_IMAGE_DIMENSION = 1920;
const ALLOWED_COMMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {filled ? (
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z" fill="currentColor" />
      ) : (
        <path
          d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function TrendIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={up ? 'M6 14l6-6 6 6' : 'M6 10l6 6 6-6'} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlaceholderImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="9.3" r="1.7" fill="currentColor" />
      <path d="M5.8 16.5l4.2-4 3.1 2.7 2.8-2.4 2.3 3.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PlaceSheet({
  place,
  comments,
  commentsLoading,
  isAuthenticated,
  currentUserId,
  isSaved,
  userVote,
  isVoting,
  onClose,
  onToggleSaved,
  onVote,
  onDelete,
  onEdit,
  onAddComment,
  onDeleteComment,
}: Props) {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [commentImages, setCommentImages] = useState<File[]>([]);
  const [isProcessingCommentImages, setIsProcessingCommentImages] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);
  const navigate = useNavigate();
  const commentImagePreviews = useMemo(
    () => commentImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [commentImages],
  );

  useEffect(() => {
    return () => {
      commentImagePreviews.forEach((entry) => URL.revokeObjectURL(entry.url));
    };
  }, [commentImagePreviews]);

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

  const closeFullscreenImage = () => {
    setFullscreenImage(null);
  };

  const stopImageViewerEvent = (e: MouseEvent<Element> | PointerEvent<Element>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const closeFullscreenImageFromClick = (e: MouseEvent<Element>) => {
    stopImageViewerEvent(e);
    closeFullscreenImage();
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
  const canSubmitComment =
    isAuthenticated &&
    commentBody.trim().length > 0 &&
    !commentSubmitting &&
    !isProcessingCommentImages;

  async function fileToImage(file: File): Promise<HTMLImageElement> {
    const src = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Не удалось открыть изображение'));
        image.src = src;
      });
      return image;
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    });
  }

  async function compressCommentImage(file: File): Promise<File> {
    if (file.size <= MAX_COMMENT_IMAGE_SIZE_BYTES) {
      return file;
    }
    const image = await fileToImage(file);
    const ratio = Math.min(1, MAX_COMMENT_IMAGE_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Браузер не поддерживает обработку изображений');
    }
    ctx.drawImage(image, 0, 0, width, height);

    const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) {
        continue;
      }
      if (blob.size <= MAX_COMMENT_IMAGE_SIZE_BYTES) {
        const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], compressedName, { type: 'image/jpeg', lastModified: Date.now() });
      }
    }
    throw new Error(`Не удалось сжать файл до ${MAX_COMMENT_IMAGE_SIZE_MB} МБ`);
  }

  async function handleCommentImagePick(e: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    if (!incoming.length) {
      return;
    }

    const freeSlots = Math.max(0, MAX_COMMENT_IMAGES - commentImages.length);
    if (!freeSlots) {
      alert(`Можно загрузить максимум ${MAX_COMMENT_IMAGES} фото`);
      e.target.value = '';
      return;
    }

    const candidates = incoming.slice(0, freeSlots);
    if (incoming.length > freeSlots) {
      alert(`Можно загрузить максимум ${MAX_COMMENT_IMAGES} фото`);
    }

    setIsProcessingCommentImages(true);
    try {
      const prepared: File[] = [];
      for (const image of candidates) {
        if (!ALLOWED_COMMENT_IMAGE_TYPES.includes(image.type)) {
          alert(`Файл "${image.name}" пропущен: поддерживаются JPG, PNG и WEBP`);
          continue;
        }
        try {
          const compressed = await compressCommentImage(image);
          prepared.push(compressed);
        } catch (error: unknown) {
          alert(
            `Файл "${image.name}" пропущен: ${
              error instanceof Error ? error.message : 'ошибка обработки изображения'
            }`,
          );
        }
      }
      if (prepared.length > 0) {
        setCommentImages((prev) => [...prev, ...prepared]);
      }
    } finally {
      setIsProcessingCommentImages(false);
    }

    e.target.value = '';
  }

  function removeCommentImage(index: number) {
    setCommentImages((prev) => prev.filter((_, i) => i !== index));
  }

  const handleSubmitComment = async () => {
    if (!place || !canSubmitComment) {
      return;
    }
    setCommentSubmitting(true);
    try {
      await onAddComment(place.id, commentBody, commentImages);
      setCommentBody('');
      setCommentImages([]);
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <div className="place-sheet-layer" aria-live="polite">
      <button
        type="button"
        className="place-sheet-backdrop"
        onClick={onClose}
        aria-label="Закрыть карточку"
      />
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
          <div
            className={`place-popup-media-row${place.imageUrls.length > 0 ? ' place-popup-media-row--gallery' : ''}`}
            style={
              place.imageUrls.length > 0
                ? ({
                    '--media-count': Math.max(1, Math.min(place.imageUrls.length, 5)),
                  } as CSSProperties)
                : undefined
            }
          >
            {place.imageUrls.length > 0 ? (
              place.imageUrls.map((imageUrl, index) => (
                <div key={`${place.id}-image-${index}`} className="place-popup-media-card place-popup-media-card--photo">
                  <button
                    type="button"
                    className="place-popup-media-image-btn"
                    onClick={() => setFullscreenImage(imageUrl)}
                    aria-label="Открыть фото на весь экран"
                  >
                    <img className="place-popup-media-image" src={imageUrl} alt={`${place.name || 'Фото'} ${index + 1}`} />
                  </button>
                </div>
              ))
            ) : (
              <>
                <div className="place-popup-media-card">
                  <div className="place-popup-media-emoji" aria-hidden="true">
                    <PlaceholderImageIcon />
                  </div>
                  <p className="place-popup-media-caption">Нет изображения</p>
                </div>

              </>
            )}
          </div>

          <div className="place-popup-grid">
            <div className="place-popup-info-card">
              <p className="place-popup-card-label">Категория</p>
              <p className="place-popup-card-text">{categoryText}</p>
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
              <p className="place-popup-card-label">дата добавления</p>
              <p className="place-popup-card-text">{formatDate(place.createdAt)}</p>
            </div>
          </div>

          {place.note  && (
              <div className="place-popup-note-card">
                  <p className="place-popup-card-label">Примечание</p>
                  <p className="place-popup-note-text">{place.note || 'Пока без текста.'}</p>
              </div>
              )}

          {place.hours && (
            <div className="place-popup-note-card">
              <p className="place-popup-card-label">Время работы</p>
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
            <button type="button" className="place-popup-pill-button" onClick={() => void onToggleSaved(place.id)}>
              <span className="place-popup-pill-icon" aria-hidden="true">
                <HeartIcon filled={isSaved} />
              </span>
              {isSaved ? 'Сохранено' : 'Сохранить'}
            </button>
            <button
              type="button"
              className={`place-popup-pill-button${userVote === 'up' ? ' is-vote-up-active' : ''}`}
              onClick={() => onVote(place.id, true)}
              disabled={isVoting}
            >
              <span className="place-popup-pill-icon" aria-hidden="true">
                <TrendIcon up />
              </span>
              Ценность
            </button>
            <a href={mapUrl} target="_blank" rel="noreferrer" className="place-popup-pill-button place-popup-pill-link">
              Открыть на карте
            </a>
            <button
              type="button"
              className={`place-popup-pill-button${userVote === 'down' ? ' is-vote-down-active' : ''}`}
              onClick={() => onVote(place.id, false)}
              disabled={isVoting}
            >
              <span className="place-popup-pill-icon" aria-hidden="true">
                <TrendIcon up={false} />
              </span>
              Ценность
            </button>
          </div>

          <p className="place-popup-comments-bar">Комментарии: {comments.length}</p>

          <div className="place-popup-comments">
            {isAuthenticated ? (
              <div className="place-popup-comment-composer">
                <textarea
                  className="place-popup-comment-textarea"
                  placeholder="Оставьте ваш отзыв..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  disabled={commentSubmitting || isProcessingCommentImages}
                />
                <div className="place-popup-comment-images-box">
                  <label
                    className={`place-popup-comment-images-count${commentImages.length >= MAX_COMMENT_IMAGES || commentSubmitting || isProcessingCommentImages ? ' is-disabled' : ''}`}
                  >
                    Фото {commentImages.length}/{MAX_COMMENT_IMAGES} (до {MAX_COMMENT_IMAGE_SIZE_MB} МБ)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleCommentImagePick}
                      disabled={commentSubmitting || isProcessingCommentImages || commentImages.length >= MAX_COMMENT_IMAGES}
                    />
                  </label>
                  <div className="place-popup-comment-images-grid">
                    {commentImagePreviews.map((entry, index) => (
                      <div className="place-popup-comment-image-item" key={`${entry.file.name}-${entry.file.lastModified}-${index}`}>
                        <img className="place-popup-comment-image-thumb" src={entry.url} alt={`Фото к комментарию ${index + 1}`} />
                        <button
                          type="button"
                          className="place-popup-comment-image-remove"
                          onClick={() => removeCommentImage(index)}
                          aria-label={`Удалить фото ${index + 1}`}
                          disabled={commentSubmitting || isProcessingCommentImages}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="place-popup-comment-tools">
                  <button
                    type="button"
                    className="place-popup-comment-chip"
                    onClick={() => void handleSubmitComment()}
                    disabled={!canSubmitComment}
                  >
                    {commentSubmitting ? 'Публикация...' : 'Опубликовать комментарий'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="am-auth-banner am-auth-banner--guest">
                <div className="am-auth-banner-row">
                  <p className="am-auth-banner-title">Войдите в аккаунт, чтобы оставить комментарий</p>
                  <button
                    type="button"
                    className="am-auth-banner-btn"
                    onClick={() => navigate('/account')}
                  >
                    Войти / Регистрация
                  </button>
                </div>
              </div>
            )}

            <div className="place-popup-comment-filters">
              <button type="button" className="place-popup-comment-filter is-active">
                Сначала новые
              </button>
              <button type="button" className="place-popup-comment-filter">
                По лайкам
              </button>
            </div>

            <div className="place-popup-comment-list">
              {commentsLoading ? (
                <div className="place-popup-comment-empty">Загрузка комментариев...</div>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <article key={comment.id} className="place-popup-comment-card">
                    <div className="place-popup-comment-card-head">
                      <h5 className="place-popup-comment-author">{comment.authorName}</h5>
                      {currentUserId === comment.authorId && (
                        <button
                          type="button"
                          className="place-popup-comment-more"
                          aria-label="Удалить комментарий"
                          onClick={() => void onDeleteComment(comment.id)}
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                    <p className="place-popup-comment-body">{comment.body}</p>
                    {comment.imageUrls.length > 0 && (
                      <div className="place-popup-comment-gallery">
                        {comment.imageUrls.map((imageUrl, imageIndex) => (
                          <button
                            type="button"
                            key={`${comment.id}-image-${imageIndex}`}
                            className="place-popup-comment-gallery-item"
                            onClick={() => setFullscreenImage(imageUrl)}
                            aria-label={`Открыть фото комментария ${imageIndex + 1}`}
                          >
                            <img
                              className="place-popup-comment-gallery-image"
                              src={imageUrl}
                              alt={`Фото комментария ${imageIndex + 1}`}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="place-popup-comment-meta">
                      <span>{formatDate(comment.createdAt)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="place-popup-comment-empty">
                  Пока нет комментариев.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      {fullscreenImage && (
        <div
          className="place-image-viewer"
          role="dialog"
          aria-label="Просмотр фото"
          onClick={stopImageViewerEvent}
          onPointerDown={stopImageViewerEvent}
        >
          <button
            type="button"
            className="place-image-viewer__backdrop"
            onPointerDown={stopImageViewerEvent}
            onClick={closeFullscreenImageFromClick}
            aria-label="Закрыть просмотр фото"
          />
          <div className="place-image-viewer__content" onPointerDown={stopImageViewerEvent} onClick={stopImageViewerEvent}>
            <button
              type="button"
              className="place-image-viewer__close"
              onPointerDown={stopImageViewerEvent}
              onClick={closeFullscreenImageFromClick}
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
