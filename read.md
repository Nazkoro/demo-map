## Деплой GitHub Pages (main → gh-pages)

https://nazkoro.github.io/demo-map/

## Стек

React 18 + TypeScript + Vite · MapLibre GL · Supabase

## Запуск локально

```bash
npm install
npm run dev        # http://localhost:5173
```

## Сборка

```bash
npm run build      # dist/
npm run preview    # предпросмотр собранного
```

## Переменные окружения

Создать `.env.local` в корне:

```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```
