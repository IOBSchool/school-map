// お店にいるスクール生（名前・役割・受講講座・認定資格）の表示と入力フォーム
// データ形式：people = [{ name, role, courses: [], certs: [], note }]
(function () {
  const cfg = window.SHOPMAP_CONFIG;

  // 旧形式（owner_name の自由記述「名前（役割）」を1行1人）からの読み替え
  function fromShop(s) {
    if (Array.isArray(s.people) && s.people.length) return s.people;
    return String(s.owner_name || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.+?)[（(]([^）)]+)[）)]$/);
      return { name: m ? m[1].trim() : l, role: m ? m[2].trim() : '', courses: [], certs: [], note: '' };
    });
  }

  // 検索用の文字列（名前・役割・講座・資格）
  function searchText(s) {
    return fromShop(s).map((p) => [p.name, p.role, ...(p.courses || []), ...(p.certs || []), p.note].join(' ')).join(' ');
  }

  // 詳細カード用
  function detailHtml(s) {
    const people = fromShop(s);
    if (!people.length) return '';
    return `<section class="people">
      <h3>このお店のスクール生</h3>
      ${people.map((p) => `
        <div class="person-card">
          <div class="person-head">
            ${safeUrl(p.photo_url) ? `<img class="avatar" src="${esc(p.photo_url)}" alt="" loading="lazy">` : `<span class="avatar ph">${esc((p.name || '?').slice(0, 1))}</span>`}
            <span><b>${esc(p.name)}</b>${p.role ? `<span class="role">${esc(p.role)}</span>` : ''}</span>
          </div>
          ${(p.certs || []).length ? `<div class="person-row"><span class="label">🎓 資格・修了</span><span class="tags">${p.certs.map((c) => `<span class="tag cert">${esc(c)}</span>`).join('')}</span></div>` : ''}
          ${(p.courses || []).length ? `<div class="person-row"><span class="label">📘 受講・参加</span><span class="tags">${p.courses.map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</span></div>` : ''}
          ${p.note ? `<div class="person-note">${esc(p.note)}</div>` : ''}
        </div>`).join('')}
    </section>`;
  }

  // 一覧用の1行要約
  function summary(s) {
    return fromShop(s).map((p) => `${p.name}${p.role ? `（${p.role}）` : ''}${(p.certs || []).length ? ' 🎓' : ''}`).join('・');
  }

  // ---------- 入力フォーム ----------
  function personBlock(p, i) {
    const checks = (list, picked, key) => list.map((v) => `
      <label class="check"><input type="checkbox" data-k="${key}" value="${esc(v)}"${(picked || []).includes(v) ? ' checked' : ''}>${esc(v)}</label>`).join('');
    return `
      <fieldset class="person-edit">
        <legend>スクール生 ${i + 1}人目</legend>
        <div class="row2">
          <input data-k="name" placeholder="お名前" value="${esc(p.name || '')}">
          <select data-k="role">
            <option value="">役割を選ぶ</option>
            ${cfg.PEOPLE_ROLES.map((r) => `<option${p.role === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}
            ${p.role && !cfg.PEOPLE_ROLES.includes(p.role) ? `<option selected>${esc(p.role)}</option>` : ''}
          </select>
        </div>
        <div class="photo-row">
          <img class="avatar" data-preview alt=""${p._preview || safeUrl(p.photo_url) ? ` src="${esc(p._preview || p.photo_url)}"` : ' hidden'}>
          <label class="photo-pick">プロフィール写真を選ぶ<input type="file" accept="image/*" data-k="photo" hidden></label>
        </div>
        <div class="sub">🎓 持っている認定資格・修了タイトル</div>
        <div class="checks">${checks(cfg.IOB_CERTS, p.certs, 'certs')}</div>
        <div class="sub">📘 受講・参加したコース・講座・コミュニティ</div>
        <div class="checks">${checks(cfg.IOB_COURSES, p.courses, 'courses')}</div>
        <input data-k="note" placeholder="補足（例：2023年修了、第3期 など）" value="${esc(p.note || '')}">
        <button type="button" class="link-btn" data-remove>この人を消す</button>
      </fieldset>`;
  }

  function mount(container, people) {
    let list = (people && people.length) ? people.map((p) => ({ ...p })) : [{}];
    const draw = () => {
      container.innerHTML = list.map(personBlock).join('') +
        '<button type="button" class="btn sub" data-add>＋ もう1人追加</button>';
      [...container.querySelectorAll('.person-edit')].forEach((f, i) => { f._blob = list[i]._blob; f._photo = list[i].photo_url; });
    };
    const sync = () => { list = read(container, true); };
    container.addEventListener('change', async (e) => {
      const inp = e.target.closest('input[data-k="photo"]');
      if (!inp || !inp.files[0]) return;
      const f = inp.closest('.person-edit');
      try {
        f._blob = await resizeSquare(inp.files[0], 400);
        const img = f.querySelector('[data-preview]');
        img.src = URL.createObjectURL(f._blob);
        img.hidden = false;
      } catch { alert('この写真は読み込めませんでした。JPEGかPNGでお試しください。'); }
    });
    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) { sync(); list.push({}); draw(); }
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        sync();
        const idx = [...container.querySelectorAll('.person-edit')].indexOf(rm.closest('.person-edit'));
        list.splice(idx, 1);
        if (!list.length) list.push({});
        draw();
      }
    });
    draw();
  }

  // keepEmpty=true は画面の描き直し用（名前が空の人も残す）
  function read(container, keepEmpty) {
    return [...container.querySelectorAll('.person-edit')].map((f) => {
      const val = (k) => (f.querySelector(`[data-k="${k}"]`)?.value || '').trim();
      const picked = (k) => [...f.querySelectorAll(`input[data-k="${k}"]:checked`)].map((x) => x.value);
      const p = { name: val('name'), role: val('role'), courses: picked('courses'), certs: picked('certs'), note: val('note'), photo_url: f._photo || null };
      if (f._blob) { p._blob = f._blob; p._preview = URL.createObjectURL(f._blob); }
      return p;
    }).filter((p) => keepEmpty || p.name);
  }

  // 送信用：選ばれた写真をアップロードして photo_url に置き換える
  async function collect(container, upload) {
    const people = read(container);
    for (const p of people) {
      if (p._blob) p.photo_url = await upload(p._blob);
      delete p._blob; delete p._preview;
    }
    return people;
  }

  // 顔写真は正方形に切り抜いて縮小
  async function resizeSquare(file, size) {
    const bmp = await createImageBitmap(file);
    const side = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(size, side);
    canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return new Promise((ok, ng) => canvas.toBlob((b) => (b ? ok(b) : ng()), 'image/jpeg', 0.85));
  }

  window.People = { fromShop, searchText, detailHtml, summary, mount, read, collect };
})();
