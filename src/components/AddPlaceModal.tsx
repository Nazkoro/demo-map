import { useState, useEffect } from 'react';
import type { PlaceFormData } from '../types';
import { CATEGORIES } from '../lib/categories';

const MAX_CATS = 3;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PlaceFormData) => void;
}

export default function AddPlaceModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [dish, setDish] = useState('');
  const [priceRaw, setPriceRaw] = useState(''); // строка в инпуте
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setAddress('');
      setCats([]);
      setDish('');
      setPriceRaw('');
      setHours('');
      setNote('');
    }
  }, [open]);

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
    if (!name.trim()) {
      alert('Укажите название заведения');
      return;
    }
    if (!address.trim()) {
      alert('Укажите адрес заведения');
      return;
    }
    const price = priceRaw === '' ? 0 : Math.max(0, parseFloat(priceRaw) || 0);
    onSubmit({ name: name.trim(), price, categories: cats, dish, hours, address: address.trim(), note });
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

        {/* Scrollable form */}
        <form className="am-body" onSubmit={handleSubmit}>
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
              <label className="am-label">Название блюда</label>
              <input
                className="am-input"
                type="text"
                placeholder="например, Острый суп"
                value={dish}
                onChange={(e) => setDish(e.target.value)}
              />
            </div>
            <div className="am-field">
              <label className="am-label">Цена (BYN)</label>
              <input
                className="am-input"
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={priceRaw}
                onChange={(e) => setPriceRaw(e.target.value)}
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

          {/* Footer buttons */}
          <div className="am-footer">
            <button type="button" className="am-btn am-btn--cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="am-btn am-btn--submit">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
