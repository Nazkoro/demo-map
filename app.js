(function() {
    'use strict';

    const mapStyle = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';
    const map = new maplibregl.Map({
        container: 'map',
        style: mapStyle,
        center: [27.5618, 53.9023],
        zoom: 12,
        pitch: 0,
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

        places.forEach((place) => {
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

    map.on('load', async () => {
        initSupabase();
        await loadPlaces();
    });

    map.on('click', () => {
        if(!isAddingMode) closeAllPopups();
    });
})();
