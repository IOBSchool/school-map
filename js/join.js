(function () {
  const CATS = window.SHOPMAP_CATEGORIES;
  const $ = (id) => document.getElementById(id);
  const wanted = new URLSearchParams(location.search).get('shop');
  const msg = (cls, html) => { $('msg').innerHTML = `<div class="notice ${cls}">${html}</div>`; window.scrollTo(0, 0); };

  async function open() {
    try {
      const shops = await ShopAPI.getApprovedShops();
      $('form').hidden = false;
      $('shop').innerHTML = '<option value="">選んでください</option>' + shops
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
        .map((s) => `<option value="${esc(s.id)}"${String(s.id) === wanted ? ' selected' : ''}>${(CATS[s.category] || CATS.other).icon} ${esc(s.name)}</option>`).join('');
      People.mount($('peopleEditor'), [], { single: true });
    } catch (e) {
      console.error(e);
      msg('err', '読み込めませんでした。通信環境を確認してください。');
    }
  }
  open();

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const missing = [];
    if (!$('shop').value) missing.push('お店');
    if (!People.read($('peopleEditor')).length) missing.push('お名前');
    if (!$('contact_email').value.trim() || !$('contact_email').checkValidity()) missing.push('ご連絡先メールアドレス');
    if (missing.length) return msg('err', '次の項目を確認してください：<br>・' + missing.map(esc).join('<br>・'));

    const btn = $('submitBtn');
    btn.disabled = true;
    btn.textContent = '送信中…';
    try {
      const [person] = await People.collect($('peopleEditor'), ShopAPI.uploadPhoto);
      await ShopAPI.submitMemberRequest($('shop').value, person, $('contact_email').value.trim());
      const shopName = $('shop').selectedOptions[0].textContent;
      e.target.reset();
      People.mount($('peopleEditor'), [], { single: true });
      msg('ok', `ありがとうございます！「${esc(shopName)}」への追加申請を受け付けました。<br>確認後、お店の詳細に表示されます。`);
    } catch (err) {
      console.error(err);
      msg('err', '送信できませんでした。時間をおいてもう一度お試しください。');
    } finally {
      btn.disabled = false;
      btn.textContent = 'この内容で申請する';
    }
  });
})();
