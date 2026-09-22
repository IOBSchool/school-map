(function () {
  const cfg = window.SHOPMAP_CONFIG;
  const CATS = window.SHOPMAP_CATEGORIES;
  const $ = (id) => document.getElementById(id);
  const msg = (cls, html) => { $('msg').innerHTML = `<div class="notice ${cls}">${html}</div>`; window.scrollTo(0, 0); };

  if (ShopAPI.DEMO) $('msg').innerHTML = '<div class="notice demo">デモモードです。送信の流れは試せますが、データは保存されません。</div>';

  $('category').innerHTML = '<option value="">選んでください</option>' +
    Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.icon} ${esc(c.label)}</option>`).join('');

  People.mount($('peopleEditor'), []);
  const isOnline = () => $('category').value === 'online';
  $('category').addEventListener('change', () => {
    $('addressField').hidden = isOnline();
    if (isOnline()) pick.invalidateSize();
    else setTimeout(() => pick.invalidateSize(), 0);
  });

  // ---------- 位置指定用の小さな地図 ----------
  const pick = L.map('pickMap').setView(cfg.INITIAL_CENTER, cfg.INITIAL_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  }).addTo(pick);
  let pin = null;
  function setPin(lat, lng, zoom) {
    if (pin) pin.setLatLng([lat, lng]);
    else pin = L.marker([lat, lng], { draggable: true }).addTo(pick);
    pick.setView([lat, lng], zoom || Math.max(pick.getZoom(), 16));
    $('pickHint').textContent = 'この位置で登録します。ずれていたら地図をタップするか、ピンを動かしてください。';
  }
  pick.on('click', (e) => setPin(e.latlng.lat, e.latlng.lng, pick.getZoom()));

  // 住所 → 緯度経度（OpenStreetMap Nominatim・無料。1秒1回までの利用ルールあり）
  $('geoBtn').addEventListener('click', async () => {
    const q = $('address').value.trim();
    if (!q) return alert('先に住所を入れてください');
    $('geoBtn').disabled = true;
    $('geoBtn').textContent = '探しています…';
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ja&q=' + encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (data[0]) setPin(+data[0].lat, +data[0].lon, 17);
      else alert('見つかりませんでした。番地を省いて試すか、地図をタップして位置を指定してください。');
    } catch {
      alert('位置の検索に失敗しました。地図をタップして位置を指定してください。');
    } finally {
      $('geoBtn').disabled = false;
      $('geoBtn').textContent = '住所から地図の位置を探す';
    }
  });

  // ---------- 写真：送る前に端末側で縮小（通信量とストレージ節約） ----------
  let photoBlob = null;
  $('photo').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    photoBlob = null;
    $('photoPreview').style.display = 'none';
    if (!f) return;
    try {
      photoBlob = await resizeImage(f, 1280, 0.82);
      $('photoPreview').src = URL.createObjectURL(photoBlob);
      $('photoPreview').style.display = 'block';
    } catch {
      alert('この写真は読み込めませんでした。JPEGかPNGでお試しください。');
      e.target.value = '';
    }
  });

  async function resizeImage(file, maxSide, quality) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((ok, ng) => canvas.toBlob((b) => (b ? ok(b) : ng()), 'image/jpeg', quality));
  }

  // ---------- 送信 ----------
  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.elements.website2.value) return; // スパム対策（人には見えない欄）
    const v = (n) => f.elements[n].value.trim();

    const missing = [];
    if (!v('name')) missing.push('お店・ブランド・活動の名前');
    if (!v('category')) missing.push('カテゴリ');
    if (!isOnline() && !v('address')) missing.push('住所');
    if (!isOnline() && !pin) missing.push('地図の位置（「住所から地図の位置を探す」か地図をタップ）');
    if (!f.elements.contact_email.checkValidity() || !v('contact_email')) missing.push('ご連絡先メールアドレス');
    if (v('website') && !safeUrl(v('website'))) missing.push('WebサイトのURL（https:// から）');
    if (missing.length) return msg('err', '次の項目を確認してください：<br>・' + missing.map(esc).join('<br>・'));

    const btn = $('submitBtn');
    btn.disabled = true;
    btn.textContent = '送信中…';
    try {
      const photo_url = photoBlob ? await ShopAPI.uploadPhoto(photoBlob) : null;
      const people = await People.collect($('peopleEditor'), ShopAPI.uploadPhoto);
      const { lat, lng } = isOnline() ? { lat: null, lng: null } : pin.getLatLng();
      await ShopAPI.submitShop({
        name: v('name'), category: v('category'), address: isOnline() ? null : v('address'),
        lat, lng, hours: v('hours') || null, message: v('message') || null,
        website: v('website') || null, instagram: v('instagram') || null,
        people, contact_email: v('contact_email'), photo_url,
      });
      f.reset();
      photoBlob = null;
      $('photoPreview').style.display = 'none';
      if (pin) { pin.remove(); pin = null; }
      People.mount($('peopleEditor'), []);
      $('addressField').hidden = false;
      msg('ok', 'ありがとうございます！受け付けました。<br>内容を確認して、地図に載せたらお知らせします。');
    } catch (err) {
      console.error(err);
      msg('err', '送信できませんでした。時間をおいてもう一度お試しください。');
    } finally {
      btn.disabled = false;
      btn.textContent = 'この内容で送る';
    }
  });
})();
