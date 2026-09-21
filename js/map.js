(function () {
  const cfg = window.SHOPMAP_CONFIG;
  const CATS = window.SHOPMAP_CATEGORIES;
  const PW_KEY = 'shopmap_pw';

  let shops = [];
  let activeCat = 'all';
  let me = null; // 現在地 [lat, lng]

  // ---------- 地図 ----------
  const map = L.map('map', { zoomControl: false, worldCopyJump: true })
    .setView(cfg.INITIAL_CENTER, cfg.INITIAL_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
  map.addLayer(cluster);
  let meMarker = null;

  function pinIcon(cat) {
    const c = CATS[cat] || CATS.other;
    return L.divIcon({
      className: '',
      html: `<div class="pin" style="background:${c.color}"><span>${c.icon}</span></div>`,
      iconSize: [36, 36], iconAnchor: [18, 36],
    });
  }

  function render() {
    cluster.clearLayers();
    const list = shops.filter((s) => activeCat === 'all' || s.category === activeCat);
    list.forEach((s) => {
      L.marker([s.lat, s.lng], { icon: pinIcon(s.category), title: s.name })
        .on('click', () => openSheet(s))
        .addTo(cluster);
    });
    document.getElementById('count').textContent = `${list.length}件のお店`;
  }

  // ---------- カテゴリ絞り込み ----------
  function renderChips() {
    const counts = {};
    shops.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1; });
    const items = [['all', 'すべて', shops.length]].concat(
      Object.entries(CATS).filter(([k]) => counts[k]).map(([k, c]) => [k, `${c.icon} ${c.label}`, counts[k]])
    );
    const box = document.getElementById('chips');
    box.innerHTML = items.map(([k, label]) =>
      `<button class="chip${k === activeCat ? ' on' : ''}" data-cat="${k}">${esc(label)}</button>`).join('');
  }
  document.getElementById('chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    activeCat = b.dataset.cat;
    renderChips();
    render();
    fitVisible();
  });

  function fitVisible() {
    const b = cluster.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [60, 60], maxZoom: 13 });
  }

  // ---------- 現在地 ----------
  const locateBtn = document.getElementById('locateBtn');
  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return alert('この端末では位置情報が使えません');
    locateBtn.classList.add('busy');
    locateBtn.textContent = '◎ 位置を取得中…';
    navigator.geolocation.getCurrentPosition((pos) => {
      me = [pos.coords.latitude, pos.coords.longitude];
      if (meMarker) meMarker.remove();
      meMarker = L.marker(me, {
        icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: false, zIndexOffset: 1000,
      }).addTo(map);
      // 近い順に3件が入る範囲へズーム（なければ現在地を中心に）
      const near = shops
        .filter((s) => activeCat === 'all' || s.category === activeCat)
        .map((s) => ({ s, d: distKm(me, [s.lat, s.lng]) }))
        .sort((a, b) => a.d - b.d).slice(0, 3).filter((x) => x.d < 50);
      if (near.length) {
        map.fitBounds(L.latLngBounds([me, ...near.map((x) => [x.s.lat, x.s.lng])]), { padding: [80, 80], maxZoom: 14 });
      } else {
        map.setView(me, 12);
      }
      resetLocateBtn();
    }, (err) => {
      resetLocateBtn();
      alert(err.code === 1
        ? '位置情報の利用が許可されていません。端末の設定でブラウザの位置情報をオンにしてください。'
        : '現在地を取得できませんでした。');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
  function resetLocateBtn() {
    locateBtn.classList.remove('busy');
    locateBtn.textContent = '◎ 現在地から探す';
  }

  function distKm(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ---------- 詳細シート ----------
  const sheet = document.getElementById('sheet');
  const backdrop = document.getElementById('backdrop');

  function openSheet(s) {
    const c = CATS[s.category] || CATS.other;
    const dist = me ? distKm(me, [s.lat, s.lng]) : null;
    const web = safeUrl(s.website), ig = igUrl(s.instagram);
    // 道案内は住所で（ピンは町名レベルの精度のことがあるため）。括弧内の補足は外す
    const dest = (s.address || '').replace(/（[^）]*）|\([^)]*\)/g, '').trim() || `${s.lat},${s.lng}`;
    const route = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
    const photo = safeUrl(s.photo_url) || (s.photo_url && s.photo_url.startsWith('blob:') ? s.photo_url : '');

    document.getElementById('sheetBody').innerHTML = `
      ${photo ? `<img class="sheet-photo" src="${esc(photo)}" alt="" loading="lazy">` : ''}
      <span class="sheet-cat" style="background:${c.color}">${c.icon} ${esc(c.label)}</span>
      <h2>${esc(s.name)}</h2>
      ${s.owner_name ? `<p class="owner">スクール生 ${esc(s.owner_name)} さんのお店</p>` : ''}
      ${s.message ? `<div class="perk"><b>スクール生のみなさんへ</b>${esc(s.message)}</div>` : ''}
      <ul class="info">
        ${s.hours ? `<li><span>🕒</span><span>${esc(s.hours)}</span></li>` : ''}
        <li><span>📍</span><span>${esc(s.address)}${dist != null ? `<br><small>現在地から約${dist < 10 ? dist.toFixed(1) : Math.round(dist)}km</small>` : ''}</span></li>
      </ul>
      <div class="links">
        <a class="primary" href="${route}" target="_blank" rel="noopener">ここへ行く</a>
        ${web ? `<a href="${esc(web)}" target="_blank" rel="noopener">Webサイト</a>` : ''}
        ${ig ? `<a href="${esc(ig)}" target="_blank" rel="noopener">Instagram</a>` : ''}
      </div>`;
    document.querySelector('.sheet-body').scrollTop = 0;
    sheet.classList.add('open');
    backdrop.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    map.panTo([s.lat, s.lng], { animate: true });
  }
  function closeSheet() {
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.style.transform = '';
  }
  backdrop.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // 取っ手を下へスワイプで閉じる
  const handle = document.getElementById('sheetHandle');
  let startY = null, dy = 0;
  handle.addEventListener('pointerdown', (e) => {
    startY = e.clientY; dy = 0;
    sheet.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const endDrag = () => {
    if (startY == null) return;
    sheet.classList.remove('dragging');
    startY = null;
    if (dy > 80) closeSheet(); else sheet.style.transform = '';
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  // ---------- パスワード → データ読込 ----------
  const gate = document.getElementById('gate');
  const gateErr = document.getElementById('gateErr');

  async function unlock(pw, remember) {
    try {
      shops = await ShopAPI.getApprovedShops(pw);
      if (remember) store.set(PW_KEY, pw);
      gate.remove();
      renderChips();
      render();
      map.invalidateSize();
      return true;
    } catch (e) {
      store.del(PW_KEY);
      gateErr.textContent = e.message === 'invalid_password'
        ? 'パスワードが違います' : '読み込みに失敗しました。通信環境を確認してください。';
      return false;
    }
  }

  document.getElementById('gateForm').addEventListener('submit', (e) => {
    e.preventDefault();
    gateErr.textContent = '';
    unlock(document.getElementById('gatePw').value.trim(), true);
  });

  const saved = store.get(PW_KEY);
  if (saved) unlock(saved, false);
  if (ShopAPI.DEMO) {
    document.querySelector('.gate-box p').insertAdjacentHTML('beforeend',
      `<br><small>（デモモード：パスワードは「${esc(cfg.DEMO_PASSWORD)}」）</small>`);
  }
})();
