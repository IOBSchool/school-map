// データの出入り口。デモモードと本番(Supabase)の差はこのファイルに閉じ込める
(function () {
  const cfg = window.SHOPMAP_CONFIG;
  const DEMO = !cfg.SUPABASE_URL;
  const sb = DEMO ? null : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // デモ用サンプル（架空の店舗）
  const demoShops = [
    { id: 'd1', status: 'approved', name: 'サンプル：オーガニックカフェ 陽だまり', category: 'food',
      photo_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
      hours: '10:00〜17:00（火曜定休）', address: '東京都渋谷区（サンプル住所）', lat: 35.664, lng: 139.698,
      message: 'スクール生の方はドリンク1杯サービス！「マップを見た」とお声がけください。',
      website: 'https://example.com', instagram: 'example', owner_name: '',
      people: [
        { name: 'サンプル 花子', role: 'オーナー', certs: ['オーガニック専門家資格'], courses: ['オーガニック専門家コース', 'オーガニック教養コース'], note: '2024年修了' },
        { name: 'サンプル 一郎', role: 'スタッフ', certs: [], courses: ['オーガニックライフスタイルコース'], note: '' },
      ] },
    { id: 'd2', status: 'approved', name: 'サンプル：自然栽培の畑 みどり農園', category: 'farm',
      photo_url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
      hours: '土日 9:00〜12:00（収穫体験は要予約）', address: '長野県（サンプル住所）', lat: 36.65, lng: 138.18,
      message: '収穫体験、スクール生は無料でご案内します。', website: '', instagram: 'example', owner_name: 'サンプル 太郎' },
    { id: 'd3', status: 'approved', name: 'サンプル：オーガニックサロン 和', category: 'salon',
      photo_url: '', hours: '予約制', address: '京都府京都市（サンプル住所）', lat: 35.011, lng: 135.768,
      message: '初回10%オフ', website: 'https://example.com', instagram: '', owner_name: '' },
    { id: 'd4', status: 'approved', name: 'Sample: Bioladen München', category: 'shop',
      photo_url: '', hours: 'Mo–Sa 9:00–19:00', address: 'München（サンプル住所）', lat: 48.137, lng: 11.575,
      message: '日本語OKです。旅行の際はぜひ。', website: '', instagram: 'example', owner_name: '' },
    { id: 'd6', status: 'approved', name: 'サンプル：手づくり石けん工房（オンライン販売）', category: 'online',
      photo_url: '', hours: '', address: null, lat: null, lng: null,
      message: 'スクール生は送料無料', website: 'https://example.com', instagram: 'example', owner_name: '',
      people: [{ name: 'サンプル 桃子', role: 'オーナー', certs: ['オーガニックコスメ専門家資格'], courses: ['オーガニックコスメ専門家コース'], note: '' }] },
    { id: 'd5', status: 'pending', name: 'サンプル：承認待ちのお宿', category: 'stay',
      photo_url: '', hours: 'チェックイン15時', address: '北海道（サンプル住所）', lat: 43.06, lng: 141.35,
      message: '連泊割あり', website: '', instagram: '', owner_name: 'サンプル 次郎', contact_email: 'sample@example.com',
      created_at: new Date().toISOString() },
  ];

  async function getApprovedShops(password) {
    if (DEMO) {
      if (password !== cfg.DEMO_PASSWORD) throw new Error('invalid_password');
      return demoShops.filter((s) => s.status === 'approved');
    }
    const { data, error } = await sb.rpc('shopmap_get_shops', { p_password: password });
    if (error) throw new Error(error.message.includes('invalid_password') ? 'invalid_password' : error.message);
    return data;
  }

  async function uploadPhoto(file) {
    if (DEMO) return URL.createObjectURL(file);
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(cfg.PHOTO_BUCKET).upload(path, file, { contentType: 'image/jpeg' });
    if (error) throw error;
    return sb.storage.from(cfg.PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function submitShop(shop) {
    if (DEMO) { demoShops.push({ ...shop, id: 'd' + Date.now(), status: 'pending', created_at: new Date().toISOString() }); return; }
    const { error } = await sb.from('shopmap_shops').insert({ ...shop, status: 'pending' });
    if (error) throw error;
  }

  // ---- 管理者用 ----
  async function adminSignIn(email, password) {
    if (DEMO) return { email };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }
  async function adminCurrentUser() {
    if (DEMO) return null;
    const { data } = await sb.auth.getUser();
    return data.user;
  }
  async function adminSignOut() { if (!DEMO) await sb.auth.signOut(); }

  async function adminListShops(status) {
    if (DEMO) return demoShops.filter((s) => s.status === status);
    const { data, error } = await sb.from('shopmap_shops').select('*').eq('status', status)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  async function adminSetStatus(id, status) {
    const approved_at = status === 'approved' ? new Date().toISOString() : null;
    if (DEMO) { Object.assign(demoShops.find((s) => s.id === id), { status, approved_at }); return; }
    const { error } = await sb.from('shopmap_shops').update({ status, approved_at }).eq('id', id);
    if (error) throw error;
  }
  async function adminUpdate(id, fields) {
    if (DEMO) { Object.assign(demoShops.find((s) => s.id === id), fields); return; }
    const { error } = await sb.from('shopmap_shops').update(fields).eq('id', id);
    if (error) throw error;
  }
  // ---- スクール生の追加申請（既存のお店に「私もここにいます」） ----
  const demoRequests = [];
  async function submitMemberRequest(shop_id, person, contact_email) {
    if (DEMO) { demoRequests.push({ id: 'r' + Date.now(), shop_id, person, contact_email, status: 'pending', created_at: new Date().toISOString() }); return; }
    const { error } = await sb.from('shopmap_member_requests').insert({ shop_id, person, contact_email, status: 'pending' });
    if (error) throw error;
  }
  async function adminListRequests(status) {
    if (DEMO) return demoRequests.filter((r) => r.status === status)
      .map((r) => ({ ...r, shop: demoShops.find((s) => s.id === r.shop_id) }));
    const { data, error } = await sb.from('shopmap_member_requests')
      .select('*, shop:shopmap_shops(id, name, people)').eq('status', status).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  // 承認＝お店の people に追加してから申請を承認済みにする
  async function adminDecideRequest(req, approve) {
    if (approve) {
      const current = DEMO ? (demoShops.find((s) => s.id === req.shop_id).people || [])
        : ((await sb.from('shopmap_shops').select('people').eq('id', req.shop_id).single()).data?.people || []);
      await adminUpdate(req.shop_id, { people: [...current, req.person] });
    }
    const status = approve ? 'approved' : 'rejected';
    if (DEMO) { demoRequests.find((r) => r.id === req.id).status = status; return; }
    const { error } = await sb.from('shopmap_member_requests').update({ status }).eq('id', req.id);
    if (error) throw error;
  }

  async function adminDelete(id) {
    if (DEMO) { demoShops.splice(demoShops.findIndex((s) => s.id === id), 1); return; }
    const { error } = await sb.from('shopmap_shops').delete().eq('id', id);
    if (error) throw error;
  }

  window.ShopAPI = {
    DEMO, getApprovedShops, uploadPhoto, submitShop, submitMemberRequest, adminListRequests, adminDecideRequest,
    adminSignIn, adminCurrentUser, adminSignOut, adminListShops, adminSetStatus, adminUpdate, adminDelete,
  };
})();

// 共通ユーティリティ
window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
window.igUrl = (v) => {
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://www.instagram.com/' + encodeURIComponent(v.replace(/^@/, '')) + '/';
};
window.store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
