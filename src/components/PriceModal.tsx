import { useState, useEffect, useCallback } from 'react';
import { PRICE_SLIDER_MIN, PRICE_SLIDER_MAX, formatRuNum } from '../lib/filters';

interface Props {
  open: boolean;
  priceMin: number;
  priceMax: number;
  onClose: () => void;
  onApply: (min: number, max: number) => void;
}

export default function PriceModal({ open, priceMin, priceMax, onClose, onApply }: Props) {
  const [localMin, setLocalMin] = useState(priceMin);
  const [localMax, setLocalMax] = useState(priceMax);

  useEffect(() => {
    if (open) {
      setLocalMin(priceMin);
      setLocalMax(priceMax);
    }
  }, [open, priceMin, priceMax]);

  const trackStyle = useCallback(() => {
    const span = PRICE_SLIDER_MAX - PRICE_SLIDER_MIN;
    const p1 = span ? ((localMin - PRICE_SLIDER_MIN) / span) * 100 : 0;
    const p2 = span ? ((localMax - PRICE_SLIDER_MIN) / span) * 100 : 100;
    return `linear-gradient(to right, #d8dbe8 ${p1}%, #1a1c2e ${p1}%, #1a1c2e ${p2}%, #d8dbe8 ${p2}%)`;
  }, [localMin, localMax]);

  if (!open) return null;

  function handleMinChange(v: number) {
    setLocalMin(Math.min(v, localMax));
  }

  function handleMaxChange(v: number) {
    setLocalMax(Math.max(v, localMin));
  }

  function handleApply() {
    const min = Math.min(localMin, localMax);
    const max = Math.max(localMin, localMax);
    onApply(min, max);
  }

  return (
    <div
      className="modal modal-glass active"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-modal-card" role="dialog" aria-labelledby="modalPriceTitle">
        <div className="glass-modal-head">
          <h3 id="modalPriceTitle">Фильтр цен</h3>
          <button type="button" className="glass-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <p className="glass-modal-label">
          Ценовой диапазон{' '}
          <span className="glass-range-value">
            {formatRuNum(localMin)} — {formatRuNum(localMax)}
          </span>
        </p>
        <div className="dual-range">
          <div className="dual-range-track" style={{ background: trackStyle() }} />
          <input
            type="range"
            className="dual-range-input dual-range-min"
            min={PRICE_SLIDER_MIN}
            max={PRICE_SLIDER_MAX}
            step={500}
            value={localMin}
            aria-label="Минимальная цена"
            onChange={(e) => handleMinChange(Number(e.target.value))}
          />
          <input
            type="range"
            className="dual-range-input dual-range-max"
            min={PRICE_SLIDER_MIN}
            max={PRICE_SLIDER_MAX}
            step={500}
            value={localMax}
            aria-label="Максимальная цена"
            onChange={(e) => handleMaxChange(Number(e.target.value))}
          />
        </div>
        <div className="dual-range-scale">
          <span>0</span>
          <span>50 000</span>
        </div>
        <p className="glass-modal-hint">
          Учитываются числа из поля «цены» у точки (любая валюта). Без цифр — точка скрывается при
          сужении диапазона.
        </p>
        <button type="button" className="glass-btn-apply" onClick={handleApply}>
          Применить
        </button>
      </div>
    </div>
  );
}
