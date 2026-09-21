(function () {
  const CATS = window.SHOPMAP_CATEGORIES;
  const $ = (id) => document.getElementById(id);
  let tab = 'pending';
  let rowsById = {};

  const note = (cls, text) => { $('msg').innerHTML = text ? `<div class="notice ${cls}">${esc(text)}</div>` : ''; };
  if (ShopAPI.DEMO) note('demo', 'デモモードです。メールとパスワードは何を入れてもログインできます。');

  function showPanel() {
    $('login').hidden = true;
    $('panel').hidden = false;
    load();
  }

  $('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await ShopAPI.adminSignIn($('email').value.trim(), $('password').value);
      showPanel();
    } catch {
      note('err', 'ログインできませんでした。メールアドレスとパスワードを確認してください。');
    }
  });

  $('logout').addEventListener('click', async () => {
    await ShopAPI.adminSignOut();
    location.reload();
  });

  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    tab = b.dataset.s;
    [...$('tabs').children].forEach((x) => x.classList.toggle('on', x === b));
    load();
  });

  async function load() {
    $('list').innerHTML = '<p class="empty">読み込み中…</p>';
    try {
      const rows = await ShopAPI.adminListShops(tab);
      rowsById = Object.fromEntries(rows.map((r) => [String(r.id), r]));
      $('list').innerHTML = rows.length ? rows.map(card).join('') : '<p class="empty">該当するお店はありません</p>';
    } catch (err) {
      console.error(err);
      $('list').innerHTML = '<p class="empty">読み込めませんでした（管理者として登録されていない可能性があります）</p>';
    }
  }

  function card(s) {
    const c = CATS[s.category] || CATS.other;
    const photo = safeUrl(s.photo_url) || (s.photo_url && s.photo_url.startsWith('blob:') ? s.photo_url : '');
    const osm = `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}`;
    const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
    const btns = {
      pending: `<button class="approve" data-act="approved">承認して公開</button><button data-act="rejected">見送る</button>`,
      approved: `<button data-act="pending">非公開に戻す</button>`,
      rejected: `<button data-act="pending">承認待ちに戻す</button><button class="danger" data-act="delete">削除</button>`,
    }[s.status];
    return `
      <article class="admin-card" data-id="${esc(s.id)}">
        ${photo ? `<img src="${esc(photo)}" alt="">` : ''}
        <h3>${c.icon} ${esc(s.name)}</h3>
        <dl>
          ${row('カテゴリ', esc(c.label))}
          ${row('住所', `${esc(s.address)}<br><a href="${osm}" target="_blank" rel="noopener">ピンの位置を確認</a>`)}
          ${row('営業時間', esc(s.hours))}
          ${row('特典', esc(s.message))}
          ${row('Web', safeUrl(s.website) ? `<a href="${esc(s.website)}" target="_blank" rel="noopener">${esc(s.website)}</a>` : '')}
          ${row('Instagram', igUrl(s.instagram) ? `<a href="${esc(igUrl(s.instagram))}" target="_blank" rel="noopener">${esc(s.instagram)}</a>` : '')}
          ${row('スクール生', esc(s.owner_name))}
          ${row('連絡先', esc(s.contact_email))}
          ${row('受付日', s.created_at ? esc(new Date(s.created_at).toLocaleString('ja-JP')) : '')}
        </dl>
        <div class="admin-actions">${btns}<button data-act="edit">編集</button></div>
      </article>`;
  }

  $('list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const cardEl = b.closest('.admin-card');
    const id = cardEl.dataset.id;
    const act = b.dataset.act;
    if (act === 'edit') { cardEl.outerHTML = editForm(rowsById[id]); return; }
    if (act === 'cancel') { load(); return; }
    if (act === 'save') {
      const get = (n) => { const v = cardEl.querySelector(`[name="${n}"]`).value.trim(); return v || null; };
      const fields = {};
      EDIT_FIELDS.forEach(([n]) => { fields[n] = get(n); });
      if (!fields.name || !fields.address || !fields.category) return note('err', 'お店の名前・カテゴリ・住所は空にできません。');
      if (fields.website && !safeUrl(fields.website)) return note('err', 'WebサイトのURLは https:// から書いてください。');
      b.disabled = true;
      try {
        await ShopAPI.adminUpdate(id, fields);
        note('ok', '保存しました。地図にもすぐ反映されます。');
        load();
      } catch (err) {
        console.error(err);
        note('err', '保存できませんでした。');
        b.disabled = false;
      }
      return;
    }
    if (act === 'delete' && !confirm('このお店のデータを完全に削除します。元に戻せません。よろしいですか？')) return;
    b.disabled = true;
    try {
      if (act === 'delete') await ShopAPI.adminDelete(id);
      else await ShopAPI.adminSetStatus(id, act);
      note('ok', act === 'approved' ? '公開しました。地図に表示されます。' : '更新しました。');
      load();
    } catch (err) {
      console.error(err);
      note('err', '更新できませんでした。');
      b.disabled = false;
    }
  });

  // 編集できる項目（位置の緯度経度は住所の変更では動かない点に注意）
  const EDIT_FIELDS = [
    ['name', 'お店の名前'], ['category', 'カテゴリ'], ['owner_name', 'このお店にいるスクール生（1行に1人）', 'area'],
    ['message', 'スクール生へのメッセージ・特典', 'area'], ['hours', '営業時間'], ['address', '住所'],
    ['website', 'WebサイトのURL'], ['instagram', 'Instagram'], ['contact_email', '連絡先メール（地図には出ない）'],
  ];
  function editForm(s) {
    const input = ([n, label, type]) => {
      const v = esc(s[n] ?? '');
      let el;
      if (n === 'category') {
        el = `<select name="category">${Object.entries(CATS).map(([k, c]) =>
          `<option value="${k}"${k === s.category ? ' selected' : ''}>${c.icon} ${esc(c.label)}</option>`).join('')}</select>`;
      } else if (type === 'area') {
        el = `<textarea name="${n}">${v}</textarea>`;
      } else {
        el = `<input name="${n}" value="${v}">`;
      }
      return `<div class="field"><label>${label}</label>${el}</div>`;
    };
    return `
      <article class="admin-card admin-edit" data-id="${esc(s.id)}">
        <h3>編集：${esc(s.name)}</h3>
        ${EDIT_FIELDS.map(input).join('')}
        <div class="admin-actions">
          <button class="approve" data-act="save">保存</button><button data-act="cancel">やめる</button>
        </div>
      </article>`;
  }

  ShopAPI.adminCurrentUser().then((u) => { if (u) showPanel(); });
})();
