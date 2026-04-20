import maplibregl from 'maplibre-gl';

import type { Place } from '../types';
import { getFirstEmoji } from './categories';

export const CLUSTER_SOURCE_ID = 'places-clusters';
export const CLUSTER_CIRCLES_LAYER_ID = 'places-cluster-circles';
export const CLUSTER_COUNT_LAYER_ID = 'places-cluster-count';
export const UNCLUSTERED_POINTS_LAYER_ID = 'places-unclustered-points';
export const UNCLUSTERED_COUNT_LAYER_ID = 'places-unclustered-count';
export const UNCLUSTERED_LOW_POINTS_LAYER_ID = 'places-unclustered-low-points';
export const UNCLUSTERED_LOW_COUNT_LAYER_ID = 'places-unclustered-low-count';
export const CLUSTER_MARKER_ZOOM = 10;

// function hashStringToUnit(value: string): number {
//   let hash = 2166136261;
//   for (let i = 0; i < value.length; i += 1) {
//     hash ^= value.charCodeAt(i);
//     hash = Math.imul(hash, 16777619);
//   }
//   return (hash >>> 0) / 4294967295;
// }
//
// function getMarkerSortKey(place: Place): number {
//   // Основной порядок — по широте (визуально ниже на экране обычно выше по приоритету),
//   // tie-breaker — стабильный хеш id, чтобы при одинаковых координатах порядок не "мигал"
//   // и совпадал для слоя фона и слоя контента.
//   return place.lat * 1_000_000 + hashStringToUnit(String(place.id));
// }

function getMarkerSortKey(place: Place): number {
  // При icon-allow-overlap=true более высокий sort-key оказывается визуально выше.
  // Поэтому используем отрицательную цену: чем цена ниже, тем выше маркер.
  // Пустую цену отправляем вниз.
  const price = typeof place.price === 'number' ? place.price : Number.POSITIVE_INFINITY;
  return -price;
}

export function isClusterZoom(zoom: number): boolean {
  return zoom < CLUSTER_MARKER_ZOOM;
}

function buildClusterGeoJson(places: Place[]) {
  return {
    type: 'FeatureCollection' as const,
    features: places.map((place) => {
      const emoji = getFirstEmoji(place.categories);
      return {
        type: 'Feature' as const,
        properties: {
          id: place.id,
          markerLabel: place.price ? place.price.toLocaleString('ru-RU') : '',
          markerCardImageId: `marker-card-${encodeURIComponent(`${emoji}|${place.price ?? ''}`)}`,
          markerSort: getMarkerSortKey(place),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [place.lng, place.lat] as [number, number],
        },
      };
    }),
  };
}

export function updateClusterSource(map: maplibregl.Map, places: Place[]) {
  const source = map.getSource(CLUSTER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData(buildClusterGeoJson(places));
}

function createMarkerCardImage(emoji: string, label: string): ImageData {
  const logicalWidth = 54;
  const logicalHeight = 20;
  const dpr = 2;
  const width = logicalWidth * dpr;
  const height = logicalHeight * dpr;
  const radius = logicalHeight / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new ImageData(width, height);
  }

  ctx.scale(dpr, dpr);

  const drawRoundedRect = () => {
    ctx.beginPath();
    ctx.moveTo(radius, 0.5);
    ctx.lineTo(logicalWidth - radius, 0.5);
    ctx.quadraticCurveTo(logicalWidth - 0.5, 0.5, logicalWidth - 0.5, radius);
    ctx.lineTo(logicalWidth - 0.5, logicalHeight - radius);
    ctx.quadraticCurveTo(logicalWidth - 0.5, logicalHeight - 0.5, logicalWidth - radius, logicalHeight - 0.5);
    ctx.lineTo(radius, logicalHeight - 0.5);
    ctx.quadraticCurveTo(0.5, logicalHeight - 0.5, 0.5, logicalHeight - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0.5, 0.5, radius, 0.5);
    ctx.closePath();
  };

  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  drawRoundedRect();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  drawRoundedRect();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(34, 197, 94, 1)';
  ctx.stroke();

  ctx.font = '20px "Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 11, logicalHeight / 2 + 1);

  ctx.font = '700 12px "Open Sans", "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgb(15, 23, 42)';
  ctx.fillText(label, 35, logicalHeight / 2 + 0.5);

  return ctx.getImageData(0, 0, width, height);
}

export function ensureMarkerAssets(map: maplibregl.Map, places: Place[]) {
  const unique = new Map<string, { emoji: string; label: string }>();
  places.forEach((place) => {
    const emoji = getFirstEmoji(place.categories);
    const label = place.price ? place.price.toLocaleString('ru-RU') : '';
    const imageId = `marker-card-${encodeURIComponent(`${emoji}|${place.price ?? ''}`)}`;
    if (!unique.has(imageId)) {
      unique.set(imageId, { emoji, label });
    }
  });

  unique.forEach(({ emoji, label }, imageId) => {
    if (!map.hasImage(imageId)) {
      map.addImage(imageId, createMarkerCardImage(emoji, label), { pixelRatio: 2 });
    }
  });
}

export function addMarkerLayers(map: maplibregl.Map) {
  map.addSource(CLUSTER_SOURCE_ID, {
    type: 'geojson',
    data: buildClusterGeoJson([]),
    cluster: true,
    clusterMaxZoom: CLUSTER_MARKER_ZOOM - 1,
    clusterRadius: 40,
  });

  map.addLayer({
    id: CLUSTER_CIRCLES_LAYER_ID,
    type: 'circle',
    source: CLUSTER_SOURCE_ID,
    maxzoom: CLUSTER_MARKER_ZOOM,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#b8d3ff',
      'circle-stroke-color': '#6f9df2',
      'circle-stroke-width': 2,
      'circle-radius': ['step', ['get', 'point_count'], 18, 5, 22, 10, 25, 20, 28],
      'circle-blur': 0,
    },
  });

  map.addLayer({
    id: CLUSTER_COUNT_LAYER_ID,
    type: 'symbol',
    source: CLUSTER_SOURCE_ID,
    maxzoom: CLUSTER_MARKER_ZOOM,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Bold'],
      'text-size': 14,
    },
    paint: {
      'text-color': '#2558ab',
      'text-halo-color': '#e9f1ff',
      'text-halo-width': 1,
    },
  });

  map.addLayer({
    id: UNCLUSTERED_LOW_POINTS_LAYER_ID,
    type: 'circle',
    source: CLUSTER_SOURCE_ID,
    maxzoom: CLUSTER_MARKER_ZOOM,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#b8d3ff',
      'circle-radius': 16,
      'circle-stroke-color': '#6f9df2',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: UNCLUSTERED_LOW_COUNT_LAYER_ID,
    type: 'symbol',
    source: CLUSTER_SOURCE_ID,
    maxzoom: CLUSTER_MARKER_ZOOM,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': '1',
      'text-font': ['Open Sans Bold'],
      'text-size': 14,
    },
    paint: {
      'text-color': '#2558ab',
      'text-halo-color': '#e9f1ff',
      'text-halo-width': 1,
    },
  });

  map.addLayer({
    id: UNCLUSTERED_POINTS_LAYER_ID,
    type: 'circle',
    source: CLUSTER_SOURCE_ID,
    minzoom: CLUSTER_MARKER_ZOOM,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': 16,
      'circle-opacity': 0,
      'circle-stroke-width': 0,
    },
  });

  map.addLayer({
    id: UNCLUSTERED_COUNT_LAYER_ID,
    type: 'symbol',
    source: CLUSTER_SOURCE_ID,
    minzoom: CLUSTER_MARKER_ZOOM,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'markerCardImageId'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], CLUSTER_MARKER_ZOOM, 1, 18, 1.06],
      'symbol-sort-key': ['get', 'markerSort'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}
