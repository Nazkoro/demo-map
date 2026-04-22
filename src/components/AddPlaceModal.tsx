import { useState, useEffect, useMemo } from 'react';
import type { PlaceFormData } from '../types';
import { CATEGORIES } from '../lib/categories';
import { supabase } from '../lib/supabase';
import InlineAuthBlock from './InlineAuthBlock';

const MAX_CATS = 3;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE_MB = 3;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PlaceFormData) => void;
  isAuthenticated: boolean;
  memberLabel?: string | null;
}

export default function AddPlaceModal({ open, onClose, onSubmit, isAuthenticated, memberLabel }: Props) {
  const [images, setImages] = useState<File[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [dish, setDish] = useState('');
  const [priceRaw, setPriceRaw] = useState(''); // строка в инпуте
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [authExpanded, setAuthExpanded] = useState(false);
  const imagePreviews = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images],
  );

  useEffect(() => {
    return () => {
      imagePreviews.forEach((entry) => URL.revokeObjectURL(entry.url));
    };
  }, [imagePreviews]);

  useEffect(() => {
    if (open) {
      setImages([]);
      setName('');
      setAddress('');
      setCats([]);
      setDish('');
      setPriceRaw('');
      setHours('');
      setNote('');
      setAuthExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    if (isAuthenticated) {
      setAuthExpanded(false);
    }
  }, [isAuthenticated]);

  if (!open) {
    return null;
  }

  function toggleCat(id: string) {
    setCats((prev) => {
      if (prev.includes(id)) {
        return prev.filter((c) => c !== id);
      }
      if (prev.length >= MAX_CATS) {
        return prev;
      }
      return [...prev, id];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated && supabase) {
      alert('Войдите или зарегистрируйтесь в блоке выше, чтобы сохранить заведение.');
      setAuthExpanded(true);
      return;
    }
    if (isProcessingImages) {
      alert('Подождите, изображения еще обрабатываются');
      return;
    }
    if (images.length < 1) {
      alert('Добавьте минимум 1 фото');
      return;
    }
    if (images.some((image) => image.size > MAX_IMAGE_SIZE_BYTES)) {
      alert(`Каждое фото должно быть не больше ${MAX_IMAGE_SIZE_MB} МБ`);
      return;
    }
    if (!name.trim()) {
      alert('Укажите название заведения');
      return;
    }
    if (!address.trim()) {
      alert('Укажите адрес заведения');
      return;
    }
    if (!dish.trim()) {
      alert('Укажите название блюда');
      return;
    }
    if (priceRaw.trim() === '') {
      alert('Укажите цену блюда');
      return;
    }
    const price = priceRaw === '' ? 0 : Math.max(0, parseFloat(priceRaw) || 0);
    if (price <= 0) {
      alert('Цена должна быть больше 0');
      return;
    }
    onSubmit({ name: name.trim(), price, categories: cats, dish: dish.trim(), hours, address: address.trim(), note, images });
  }

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

  async function compressImage(file: File): Promise<File> {
    if (file.size <= MAX_IMAGE_SIZE_BYTES) {
      return file;
    }

    const image = await fileToImage(file);
    const ratio = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
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
      if (blob.size <= MAX_IMAGE_SIZE_BYTES) {
        const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], compressedName, { type: 'image/jpeg', lastModified: Date.now() });
      }
    }

    throw new Error(`Не удалось сжать файл до ${MAX_IMAGE_SIZE_MB} МБ`);
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    if (!incoming.length) {
      return;
    }

    const freeSlots = Math.max(0, MAX_IMAGES - images.length);
    if (!freeSlots) {
      alert(`Можно загрузить максимум ${MAX_IMAGES} фото`);
      e.target.value = '';
      return;
    }

    const candidates = incoming.slice(0, freeSlots);
    if (incoming.length > freeSlots) {
      alert(`Можно загрузить максимум ${MAX_IMAGES} фото`);
    }

    setIsProcessingImages(true);
    try {
      const prepared: File[] = [];
      for (const image of candidates) {
        if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
          alert(`Файл "${image.name}" пропущен: поддерживаются JPG, PNG и WEBP`);
          continue;
        }
        try {
          const compressed = await compressImage(image);
          prepared.push(compressed);
        } catch (error: unknown) {
          alert(
            `Файл "${image.name}" пропущен: ${
              error instanceof Error ? error.message : 'ошибка обработки изображения'
            }`,
          );
        }
      }
      if (prepared.length) {
        setImages((prev) => [...prev, ...prepared]);
      }
    } finally {
      setIsProcessingImages(false);
    }
    e.target.value = '';
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="am-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="am-card">
        {/* Header */}
        <div className="am-header">
          <h2 className="am-title">Добавить заведение</h2>
          <button type="button" className="am-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="am-body">
          {isAuthenticated ? (
            <div className="am-auth-banner am-auth-banner--member">
              <p className="am-auth-banner-title">Режим участника</p>
              <div className="am-member-chip">
                <span className="am-member-chip-label">Ник в аккаунте</span>
                <span className="am-member-chip-value">{memberLabel?.trim() || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="am-auth-banner am-auth-banner--guest">
              <div className="am-auth-banner-row">
                <p className="am-auth-banner-title">
                  Режим гостя <span className="am-auth-banner-hint">(доступен режим с аккаунтом)</span>
                </p>
                <button
                  type="button"
                  className="am-auth-banner-btn"
                  onClick={() => setAuthExpanded((v) => !v)}
                  aria-expanded={authExpanded}
                >
                  {authExpanded ? 'Свернуть' : 'Войти / Регистрация'}
                </button>
              </div>
              {authExpanded && <InlineAuthBlock />}
            </div>
          )}

        <form className="am-place-form" onSubmit={handleSubmit}>
          {/* Restaurant name */}
          <div className="am-field">
            <label className="am-label">Название заведения *</label>
            <input
              className="am-input"
              type="text"
              placeholder="например, Ресторан Уют"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Address */}
          <div className="am-field">
            <label className="am-label">Адрес *</label>
            <input
              className="am-input"
              type="text"
              placeholder="ул. Ленина 12, Минск"
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* Categories */}
          <div className="am-cats-box">
            <label className="am-label am-label--primary">Категории (мин. 1, макс. {MAX_CATS})</label>
            <div className="am-cats-grid">
              {CATEGORIES.map((cat) => {
                const checked = cats.includes(cat.id);
                const disabled = !checked && cats.length >= MAX_CATS;
                return (
                  <label
                    key={cat.id}
                    className={`am-cat-item${checked ? ' am-cat-item--checked' : ''}${disabled ? ' am-cat-item--disabled' : ''}`}
                  >
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleCat(cat.id)} />
                    <span>{cat.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="am-cats-count">
              Выбрано: {cats.length}/{MAX_CATS}
            </p>
          </div>

          {/* Dish + Price */}
          <div className="am-grid2">
            <div className="am-field">
              <label className="am-label">Название блюда *</label>
              <input
                className="am-input"
                type="text"
                placeholder="например, Острый суп"
                value={dish}
                onChange={(e) => setDish(e.target.value)}
                required
              />
            </div>
            <div className="am-field">
              <label className="am-label">Цена (BYN) *</label>
              <input
                className="am-input"
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={priceRaw}
                onChange={(e) => setPriceRaw(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Notice */}
          <div className="am-notice">
            <span className="am-notice-badge">Важно</span>
            <p className="am-notice-text">
              Добавляйте только реальные заведения с актуальными ценами. Объявления могут быть удалены после проверки.
            </p>
          </div>

          {/* Hours */}
          <div className="am-field">
            <label className="am-label">Часы работы (опционально)</label>
            <input
              className="am-input"
              type="text"
              placeholder="Будни 11:00–20:00 / Сб 11:00–15:00 / Вс — выходной"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="am-field">
            <label className="am-label">Заметка (опционально)</label>
            <textarea
              className="am-input am-textarea"
              placeholder="Что вкусного? Особенности, советы..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="am-field">
            <label className="am-label">Фото *</label>
            <div className="am-image-box">
              <p className="am-image-count">
                Images {images.length}/{MAX_IMAGES} (min 1, max {MAX_IMAGE_SIZE_MB} MB each)
              </p>
              <div className="am-image-grid">
                {imagePreviews.map((entry, index) => (
                  <div className="am-image-item" key={`${entry.file.name}-${entry.file.lastModified}-${index}`}>
                    <img className="am-image-thumb" src={entry.url} alt={`Фото ${index + 1}`} />
                    <button
                      type="button"
                      className="am-image-remove"
                      onClick={() => removeImage(index)}
                      aria-label={`Удалить фото ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <label className={`am-image-upload${isProcessingImages ? ' am-image-upload--disabled' : ''}`}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleImagePick}
                      disabled={isProcessingImages}
                    />
                    <span>{isProcessingImages ? '...' : '+'}</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="am-footer">
            <button type="button" className="am-btn am-btn--cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="am-btn am-btn--submit" disabled={isProcessingImages}>
              Сохранить
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
