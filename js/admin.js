(function () {
  const CATS = window.SHOPMAP_CATEGORIES;
  const $ = (id) => document.getElementById(id);
  let tab = 'pending';

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
          ${row('運営者', esc(s.owner_name))}
          ${row('連絡先', esc(s.contact_email))}
          ${row('受付日', s.created_at ? esc(new Date(s.created_at).toLocaleString('ja-JP')) : '')}
        </dl>
        <div class="admin-actions">${btns}</div>
      </article>`;
  }

  $('list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.closest('.admin-card').dataset.id;
    const act = b.dataset.act;
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

  ShopAPI.adminCurrentUser().then((u) => { if (u) showPanel(); });
})();
