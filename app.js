(function() {
    'use strict';

    const mapStyle = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';
    const map = new maplibregl.Map({
        container: 'map',
        style: mapStyle,
        center: [27.5618, 53.9023],
        zoom: 12,
        pitch: 0,
        attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const SUPABASE_URL = window.SUPABASE_URL || 'PASTE_YOUR_SUPABASE_URL';
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'PASTE_YOUR_SUPABASE_ANON_KEY';
    const SUPABASE_TABLE = 'places';
    let supabaseClient = null;
    let statusTimer = null;

    function showStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = 'status ' + (type || 'info');
        statusEl.style.display = 'block';
        if(statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3500);
    }

    function initSupabase() {
        const notConfigured = SUPABASE_URL.startsWith('PASTE_') || SUPABASE_ANON_KEY.startsWith('PASTE_');
        if(notConfigured) {
            showStatus('Supabase не настроен: проверьте config.js', 'error');
            return false;
        }
        if(!window.supabase || typeof window.supabase.createClient !== 'function') {
            showStatus('Ошибка загрузки supabase-js', 'error');
            return false;
        }
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }

    let places = [];

    const PRICE_SLIDER_MIN = 0;
    const PRICE_SLIDER_MAX = 50000;
    let appliedPriceMin = PRICE_SLIDER_MIN;
    let appliedPriceMax = PRICE_SLIDER_MAX;
    let appliedNameQuery = '';
    /** Показывать эту точку на карте, даже если её отсекает фильтр цены (после выбора в диалоге). */
    let focusBypassId = null;
    let markerByPlaceId = {};
    let searchListDebounceTimer = null;
    /** Текст чипа под кнопками после перехода к заведению из поиска */
    let mapSearchChipText = null;
    let mapSearchChipPlaceId = null;

    function updateMapSearchChip() {
        const wrap = document.getElementById('mapSearchChipWrap');
        const label = document.getElementById('mapSearchChipLabel');
        if(!wrap || !label) return;
        const t = mapSearchChipText && String(mapSearchChipText).trim();
        if(t) {
            label.textContent = t;
            wrap.hidden = false;
        } else {
            label.textContent = '';
            wrap.hidden = true;
        }
    }

    function dismissMapSearchChip() {
        mapSearchChipText = null;
        mapSearchChipPlaceId = null;
        appliedNameQuery = '';
        clearFocusBypass();
        const input = document.getElementById('nameSearchInput');
        if(input) input.value = '';
        closeAllPopups();
        renderMarkers();
        updateMapSearchChip();
    }

    function clearMapSearchChipState() {
        mapSearchChipText = null;
        mapSearchChipPlaceId = null;
        updateMapSearchChip();
    }

    function parsePriceNumbers(priceStr) {
        if(!priceStr || typeof priceStr !== 'string') return [];
        const matches = priceStr.match(/\d+(?:[.,]\d+)?/g);
        if(!matches) return [];
        return matches.map(function(m) {
            return parseFloat(m.replace(',', '.'));
        }).filter(function(n) {
            return !isNaN(n);
        });
    }

    function isFullPriceRange(minV, maxV) {
        return minV <= PRICE_SLIDER_MIN && maxV >= PRICE_SLIDER_MAX;
    }

    function placePassesPriceFilter(place) {
        if(isFullPriceRange(appliedPriceMin, appliedPriceMax)) return true;
        const nums = parsePriceNumbers(place.price);
        if(nums.length === 0) return false;
        return nums.some(function(n) {
            return n >= appliedPriceMin && n <= appliedPriceMax;
        });
    }

    function placePassesNameFilter(place) {
        const q = appliedNameQuery.trim().toLowerCase();
        if(!q) return true;
        return (place.name || '').toLowerCase().indexOf(q) !== -1;
    }

    function getVisiblePlaces() {
        return places.filter(function(p) {
            if(focusBypassId != null && String(p.id) === String(focusBypassId)) return true;
            return placePassesPriceFilter(p) && placePassesNameFilter(p);
        });
    }

    function clearFocusBypass() {
        focusBypassId = null;
    }

    function refreshSearchResultsList() {
        const list = document.getElementById('searchResultsList');
        const hint = document.getElementById('searchResultsHint');
        const input = document.getElementById('nameSearchInput');
        if(!list) return;
        const q = (input && input.value || '').trim().toLowerCase();
        list.innerHTML = '';
        if(!q) {
            if(hint) {
                hint.textContent = 'Введите название — ниже появятся совпадения. Нажмите на строку, чтобы перейти к маркеру.';
            }
            return;
        }
        const matches = places.filter(function(p) {
            return (p.name || '').toLowerCase().indexOf(q) !== -1;
        });
        if(hint) {
            hint.textContent = matches.length
                ? 'Найдено: ' + matches.length + '. Нажмите строку — карта перейдёт к маркеру.'
                : 'Ничего не найдено. Попробуйте другой запрос.';
        }
        matches.forEach(function(place) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'search-result-item';
            btn.setAttribute('data-place-id', String(place.id));
            btn.setAttribute('role', 'option');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'search-result-name';
            nameSpan.textContent = place.name || '—';
            const priceSpan = document.createElement('span');
            priceSpan.className = 'search-result-price';
            priceSpan.textContent = place.price || '—';
            btn.appendChild(nameSpan);
            btn.appendChild(priceSpan);
            li.appendChild(btn);
            list.appendChild(li);
        });
    }

    function scheduleRefreshSearchResultsList() {
        if(searchListDebounceTimer) clearTimeout(searchListDebounceTimer);
        searchListDebounceTimer = setTimeout(function() {
            searchListDebounceTimer = null;
            refreshSearchResultsList();
        }, 200);
    }

    function openPopupForPlaceId(placeId) {
        const key = String(placeId);
        const marker = markerByPlaceId[key];
        if(!marker) return;
        closeAllPopups();
        const popup = marker.getPopup();
        if(!popup) return;
        window.currentPopup = popup;
        marker.togglePopup();
    }

    function focusPlaceOnMap(place) {
        const input = document.getElementById('nameSearchInput');
        appliedNameQuery = input ? input.value.trim() : '';
        const passesPrice = placePassesPriceFilter(place);
        const passesName = (function() {
            const q = appliedNameQuery.trim().toLowerCase();
            if(!q) return true;
            return (place.name || '').toLowerCase().indexOf(q) !== -1;
        })();
        focusBypassId = passesPrice && passesName ? null : place.id;
        mapSearchChipText = (place.name || '').trim() || '—';
        mapSearchChipPlaceId = place.id;
        updateMapSearchChip();
        closeGlassModal('modalSearch');
        closeAllPopups();
        renderMarkers();
        const targetZoom = Math.max(map.getZoom(), 15);
        map.flyTo({
            center: [place.lng, place.lat],
            zoom: targetZoom,
            essential: true
        });
        let opened = false;
        function tryOpenPopup() {
            if(opened) return;
            opened = true;
            openPopupForPlaceId(place.id);
        }
        map.once('moveend', tryOpenPopup);
        setTimeout(tryOpenPopup, 900);
    }

    function formatRuNum(n) {
        return Math.round(n).toLocaleString('ru-RU');
    }

    function updatePriceRangeLabel() {
        const minEl = document.getElementById('priceRangeMin');
        const maxEl = document.getElementById('priceRangeMax');
        const label = document.getElementById('priceRangeLabel');
        if(!minEl || !maxEl || !label) return;
        label.textContent = formatRuNum(+minEl.value) + ' — ' + formatRuNum(+maxEl.value);
    }

    function updateDualRangeTrack() {
        const minEl = document.getElementById('priceRangeMin');
        const maxEl = document.getElementById('priceRangeMax');
        const track = document.getElementById('dualRangeTrack');
        if(!minEl || !maxEl || !track) return;
        const minv = +minEl.value;
        const maxv = +maxEl.value;
        const span = PRICE_SLIDER_MAX - PRICE_SLIDER_MIN;
        const p1 = span ? ((minv - PRICE_SLIDER_MIN) / span) * 100 : 0;
        const p2 = span ? ((maxv - PRICE_SLIDER_MIN) / span) * 100 : 100;
        track.style.background = 'linear-gradient(to right, #d8dbe8 ' + p1 + '%, #1a1c2e ' + p1 + '%, #1a1c2e ' + p2 + '%, #d8dbe8 ' + p2 + '%)';
    }

    function syncDualRangeFromInputs() {
        const minEl = document.getElementById('priceRangeMin');
        const maxEl = document.getElementById('priceRangeMax');
        if(!minEl || !maxEl) return;
        let minv = +minEl.value;
        let maxv = +maxEl.value;
        if(minv > maxv) {
            minv = maxv;
            minEl.value = String(minv);
        }
        updatePriceRangeLabel();
        updateDualRangeTrack();
    }

    function openGlassModal(id) {
        const el = document.getElementById(id);
        if(!el) return;
        el.classList.add('active');
        el.setAttribute('aria-hidden', 'false');
    }

    function closeGlassModal(id) {
        const el = document.getElementById(id);
        if(!el) return;
        el.classList.remove('active');
        el.setAttribute('aria-hidden', 'true');
    }

    function openPriceFilterModal() {
        const minEl = document.getElementById('priceRangeMin');
        const maxEl = document.getElementById('priceRangeMax');
        if(minEl && maxEl) {
            minEl.value = String(Math.max(PRICE_SLIDER_MIN, Math.min(appliedPriceMin, PRICE_SLIDER_MAX)));
            maxEl.value = String(Math.max(PRICE_SLIDER_MIN, Math.min(appliedPriceMax, PRICE_SLIDER_MAX)));
            if(+minEl.value > +maxEl.value) maxEl.value = minEl.value;
        }
        updatePriceRangeLabel();
        updateDualRangeTrack();
        openGlassModal('modalPrice');
    }

    function applyPriceFilterFromUi() {
        const minEl = document.getElementById('priceRangeMin');
        const maxEl = document.getElementById('priceRangeMax');
        if(!minEl || !maxEl) return;
        appliedPriceMin = +minEl.value;
        appliedPriceMax = +maxEl.value;
        if(appliedPriceMin > appliedPriceMax) {
            const t = appliedPriceMin;
            appliedPriceMin = appliedPriceMax;
            appliedPriceMax = t;
        }
        clearFocusBypass();
        clearMapSearchChipState();
        closeGlassModal('modalPrice');
        closeAllPopups();
        renderMarkers();
        const visible = getVisiblePlaces();
        const hidden = places.length - visible.length;
        if(hidden > 0) {
            showStatus('Показано ' + visible.length + ' из ' + places.length + ' точек', 'info');
        }
    }

    function applyNameSearchFromUi() {
        const input = document.getElementById('nameSearchInput');
        appliedNameQuery = input ? input.value : '';
        clearFocusBypass();
        closeGlassModal('modalSearch');
        closeAllPopups();
        renderMarkers();
        const matches = places.filter(function(p) {
            return placePassesPriceFilter(p) && placePassesNameFilter(p);
        });
        if(appliedNameQuery.trim() && matches.length === 1) {
            focusPlaceOnMap(matches[0]);
            return;
        }
        clearMapSearchChipState();
        const vis = getVisiblePlaces().length;
        if(appliedNameQuery.trim()) {
            showStatus(vis ? 'Найдено: ' + vis : 'Ничего не найдено', vis ? 'success' : 'info');
        }
    }

    function clearNameSearchUi() {
        const input = document.getElementById('nameSearchInput');
        if(input) input.value = '';
        appliedNameQuery = '';
        clearFocusBypass();
        clearMapSearchChipState();
        closeGlassModal('modalSearch');
        closeAllPopups();
        renderMarkers();
    }

    function mapDbRowToPlace(row) {
        return {
            id: row.id,
            lng: row.lng,
            lat: row.lat,
            name: row.name,
            price: row.price,
            desc: row.description,
            votesUp: row.votes_up || 0,
            votesDown: row.votes_down || 0,
            createdAt: new Date(row.created_at).getTime()
        };
    }

    async function loadPlaces() {
        if(!supabaseClient) {
            places = [];
            renderMarkers();
            return;
        }

        const { data, error } = await supabaseClient
            .from(SUPABASE_TABLE)
            .select('*')
            .order('created_at', { ascending: false });

        if(error) {
            places = [];
            renderMarkers();
            showStatus('Не удалось загрузить данные: ' + error.message, 'error');
            return;
        }

        places = (data || []).map(mapDbRowToPlace);
        renderMarkers();
        if(places.length === 0) {
            showStatus('Пока нет точек. Добавьте первое заведение', 'info');
        }
    }

    function generateId() {
        return Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    }

    async function addPlace(lng, lat, name, price, desc) {
        if(!name.trim()) {
            alert('Укажите название заведения');
            return false;
        }

        const newPlace = {
            id: generateId(),
            lng: lng,
            lat: lat,
            name: name.trim(),
            price: price.trim() || 'Не указано',
            desc: desc.trim() || '—',
            votesUp: 0,
            votesDown: 0,
            createdAt: Date.now()
        };

        if(supabaseClient) {
            const { data, error } = await supabaseClient
                .from(SUPABASE_TABLE)
                .insert({
                    id: newPlace.id,
                    name: newPlace.name,
                    price: newPlace.price,
                    description: newPlace.desc,
                    lng: newPlace.lng,
                    lat: newPlace.lat,
                    votes_up: newPlace.votesUp,
                    votes_down: newPlace.votesDown,
                    created_at: new Date(newPlace.createdAt).toISOString()
                })
                .select()
                .single();

            if(error) {
                showStatus('Ошибка сохранения: ' + error.message, 'error');
                return false;
            }
            places.unshift(mapDbRowToPlace(data));
            showStatus('Место сохранено в Supabase', 'success');
        } else {
            places.push(newPlace);
            showStatus('Сохранено локально (без Supabase)', 'info');
        }

        renderMarkers();
        return true;
    }

    async function vote(placeId, isUp) {
        const place = places.find((p) => p.id === placeId);
        if(!place) return;

        if(isUp) place.votesUp = (place.votesUp || 0) + 1;
        else place.votesDown = (place.votesDown || 0) + 1;

        renderMarkers();
        closeAllPopups();

        if(!supabaseClient) return;
        const { error } = await supabaseClient
            .from(SUPABASE_TABLE)
            .update({ votes_up: place.votesUp, votes_down: place.votesDown })
            .eq('id', place.id);
        if(error) showStatus('Не удалось обновить голоса', 'error');
    }

    async function deletePlace(placeId) {
        if(!confirm('Удалить эту точку?')) return;

        if(supabaseClient) {
            const { error } = await supabaseClient
                .from(SUPABASE_TABLE)
                .delete()
                .eq('id', placeId);
            if(error) {
                showStatus('Не удалось удалить в Supabase', 'error');
                return;
            }
        }

        places = places.filter((p) => p.id !== placeId);
        if(focusBypassId != null && String(focusBypassId) === String(placeId)) clearFocusBypass();
        if(mapSearchChipPlaceId != null && String(mapSearchChipPlaceId) === String(placeId)) {
            clearMapSearchChipState();
        }
        renderMarkers();
        closeAllPopups();
        showStatus('Точка удалена', 'success');
    }

    function closeAllPopups() {
        if(window.currentPopup) {
            window.currentPopup.remove();
            window.currentPopup = null;
        }
    }

    let currentMarkers = [];
    function renderMarkers() {
        currentMarkers.forEach((marker) => marker.remove());
        currentMarkers = [];
        markerByPlaceId = {};

        getVisiblePlaces().forEach((place) => {
            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.innerHTML = '🍜';
            el.style.fontSize = '28px';
            el.style.cursor = 'pointer';
            el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
            el.style.textShadow = '0 0 2px black';

            const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([place.lng, place.lat])
                .addTo(map);

            const popup = new maplibregl.Popup({ offset: 25, closeButton: true, closeOnClick: false })
                .setHTML(generatePopupHTML(place));

            marker.getElement().addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllPopups();
                popup.setHTML(generatePopupHTML(place));
                window.currentPopup = popup;
                marker.setPopup(popup).togglePopup();
            });

            currentMarkers.push(marker);
            markerByPlaceId[String(place.id)] = marker;
        });
    }

    function generatePopupHTML(place) {
        return `
                <div>
                    <div class="popup-title">${escapeHtml(place.name)}</div>
                    <div class="popup-price">💰 ${escapeHtml(place.price)}</div>
                    <div class="popup-desc">📝 ${escapeHtml(place.desc)}</div>
                    <div class="popup-votes">
                        <button class="vote-btn vote-up" data-id="${place.id}" data-vote="up">👍 ${place.votesUp}</button>
                        <button class="vote-btn vote-down" data-id="${place.id}" data-vote="down">👎 ${place.votesDown}</button>
                    </div>
                    <button class="vote-btn delete-btn" data-id="${place.id}">🗑️ Удалить</button>
                    <div class="popup-meta">добавлено ${new Date(place.createdAt).toLocaleDateString()}</div>
                </div>
            `;
    }

    function escapeHtml(str) {
        if(!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if(m === '&') return '&amp;';
            if(m === '<') return '&lt;';
            if(m === '>') return '&gt;';
            return m;
        });
    }

    document.body.addEventListener('click', (e) => {
        const target = e.target;
        if(target.classList && target.classList.contains('vote-btn')) {
            const placeId = target.getAttribute('data-id');
            const voteType = target.getAttribute('data-vote');
            if(placeId && voteType) {
                e.preventDefault();
                e.stopPropagation();
                vote(placeId, voteType === 'up');
            }
        }
        if(target.classList && target.classList.contains('delete-btn')) {
            const placeId = target.getAttribute('data-id');
            if(placeId) {
                e.preventDefault();
                e.stopPropagation();
                deletePlace(placeId);
            }
        }
    });

    let pendingCoordinates = null;
    let isAddingMode = false;

    function enableAddMode() {
        if(isAddingMode) {
            isAddingMode = false;
            map.getCanvas().style.cursor = '';
            document.getElementById('addBtn').classList.remove('btn-primary');
            document.getElementById('addBtn').style.opacity = '0.7';
            alert('Режим добавления отключён');
            return;
        }
        isAddingMode = true;
        map.getCanvas().style.cursor = 'crosshair';
        document.getElementById('addBtn').classList.add('btn-primary');
        alert('Кликните по карте в том месте, где находится заведение');

        const onClickMap = (e) => {
            if(!isAddingMode) {
                map.off('click', onClickMap);
                return;
            }
            const { lng, lat } = e.lngLat;
            pendingCoordinates = { lng, lat };
            document.getElementById('placeName').value = '';
            document.getElementById('priceInfo').value = '';
            document.getElementById('description').value = '';
            document.getElementById('modal').classList.add('active');
            map.off('click', onClickMap);
            isAddingMode = false;
            map.getCanvas().style.cursor = '';
            document.getElementById('addBtn').classList.remove('btn-primary');
        };
        map.on('click', onClickMap);
    }

    async function submitNewPlace() {
        if(!pendingCoordinates) {
            alert('Сначала кликните на карте, чтобы указать местоположение');
            return;
        }
        const name = document.getElementById('placeName').value;
        const price = document.getElementById('priceInfo').value;
        const desc = document.getElementById('description').value;
        const success = await addPlace(pendingCoordinates.lng, pendingCoordinates.lat, name, price, desc);
        if(success) {
            closeModal();
            pendingCoordinates = null;
        }
    }

    function closeModal() {
        document.getElementById('modal').classList.remove('active');
        pendingCoordinates = null;
    }

    document.getElementById('addBtn').addEventListener('click', enableAddMode);
    document.getElementById('submitPlace').addEventListener('click', submitNewPlace);
    document.getElementById('cancelModal').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if(e.target === document.getElementById('modal')) closeModal();
    });

    (function setupGlassModals() {
        const minEl = document.getElementById('priceRangeMin');
        const maxEl = document.getElementById('priceRangeMax');
        if(minEl && maxEl) {
            ['input', 'change'].forEach(function(ev) {
                minEl.addEventListener(ev, syncDualRangeFromInputs);
                maxEl.addEventListener(ev, syncDualRangeFromInputs);
            });
        }

        document.getElementById('openPriceFilter').addEventListener('click', function() {
            openPriceFilterModal();
        });
        document.getElementById('openNameSearch').addEventListener('click', function() {
            const input = document.getElementById('nameSearchInput');
            if(input) input.value = appliedNameQuery;
            openGlassModal('modalSearch');
            refreshSearchResultsList();
            setTimeout(function() {
                if(input) input.focus();
            }, 100);
        });

        document.getElementById('nameSearchInput').addEventListener('input', function() {
            scheduleRefreshSearchResultsList();
        });

        document.getElementById('searchResultsList').addEventListener('click', function(e) {
            const btn = e.target.closest('.search-result-item');
            if(!btn) return;
            const id = btn.getAttribute('data-place-id');
            const place = places.find(function(p) {
                return String(p.id) === String(id);
            });
            if(place) focusPlaceOnMap(place);
        });
        document.getElementById('closePriceModal').addEventListener('click', function() {
            closeGlassModal('modalPrice');
        });
        document.getElementById('closeSearchModal').addEventListener('click', function() {
            closeGlassModal('modalSearch');
        });
        document.getElementById('applyPriceFilter').addEventListener('click', applyPriceFilterFromUi);
        document.getElementById('applyNameSearch').addEventListener('click', applyNameSearchFromUi);
        document.getElementById('clearNameSearch').addEventListener('click', clearNameSearchUi);
        document.getElementById('mapSearchChipDismiss').addEventListener('click', function(e) {
            e.stopPropagation();
            dismissMapSearchChip();
        });

        document.getElementById('modalPrice').addEventListener('click', function(e) {
            if(e.target === document.getElementById('modalPrice')) closeGlassModal('modalPrice');
        });
        document.getElementById('modalSearch').addEventListener('click', function(e) {
            if(e.target === document.getElementById('modalSearch')) closeGlassModal('modalSearch');
        });

        document.getElementById('nameSearchInput').addEventListener('keydown', function(e) {
            if(e.key === 'Enter') {
                e.preventDefault();
                applyNameSearchFromUi();
            }
        });

        document.addEventListener('keydown', function(e) {
            if(e.key !== 'Escape') return;
            closeGlassModal('modalPrice');
            closeGlassModal('modalSearch');
        });

        updatePriceRangeLabel();
        updateDualRangeTrack();
    })();

    map.on('load', async () => {
        initSupabase();
        await loadPlaces();
    });

    map.on('click', () => {
        if(isAddingMode) return;
        closeAllPopups();
        if(focusBypassId != null) {
            clearFocusBypass();
            renderMarkers();
        }
    });
})();
