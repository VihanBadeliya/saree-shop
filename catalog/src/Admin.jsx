import { useEffect, useState } from 'react';
import { supabase, photoUrl } from './supabase.js';

const blank = { id: null, code: '', title: '', description: '', category: '', color: '', fabric: '',
  price: '', offer_price: '', offer_text: '', offer_ends: '', photos: [], is_published: true };

// Shrink phone photos to max 1200px JPEG (~150-300 KB) before upload
function compress(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('Compress failed'))), 'image/jpeg', 0.8);
    };
    img.onerror = () => reject(new Error('Not an image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function Admin() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <p className="muted pad">Loading…</p>;
  return session ? <Panel /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  const go = async (e) => {
    e.preventDefault(); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setErr('Wrong email or password.');
  };
  return <form className="login" onSubmit={go}><h2>Owner login</h2>
    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
    <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} required />
    {err && <p className="err">{err}</p>}<button className="btn">Sign in</button></form>;
}

function Panel() {
  const [tab, setTab] = useState('items');
  return <div className="admin">
    <div className="admin-top"><h2>Catalog manager</h2>
      <div><button className={'chip' + (tab === 'items' ? ' on' : '')} onClick={() => setTab('items')}>Sarees</button>
        <button className={'chip' + (tab === 'shop' ? ' on' : '')} onClick={() => setTab('shop')}>Shop info</button>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button></div></div>
    {tab === 'items' ? <Items /> : <Shop />}
  </div>;
}

function Items() {
  const [rows, setRows] = useState([]); const [form, setForm] = useState(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data } = await supabase.from('catalog_items').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addPhotos = async (files) => {
    const room = 4 - form.photos.length;
    if (room <= 0) return setMsg('Maximum 4 photos.');
    setBusy(true); setMsg('');
    try {
      const added = [];
      for (const f of [...files].slice(0, room)) {
        const blob = await compress(f);
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw error; added.push(path);
      }
      set('photos', [...form.photos, ...added]);
    } catch (e) { setMsg('Photo upload failed: ' + e.message); }
    setBusy(false);
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const num = v => (v === '' || v == null ? null : Number(v));
    const row = { code: form.code.trim() || null, title: form.title.trim(), description: form.description || null,
      category: form.category.trim() || null, color: form.color.trim() || null, fabric: form.fabric.trim() || null,
      price: num(form.price), offer_price: num(form.offer_price), offer_text: form.offer_text || null,
      offer_ends: form.offer_ends || null, photos: form.photos, is_published: form.is_published };
    const q = form.id ? supabase.from('catalog_items').update(row).eq('id', form.id) : supabase.from('catalog_items').insert(row);
    const { error } = await q;
    setBusy(false);
    if (error) return setMsg(error.message.includes('duplicate') ? 'That saree code is already in the catalog.' : error.message);
    setForm(null); load();
  };

  const remove = async (r) => {
    if (!confirm(`Delete "${r.title}" from the catalog?`)) return;
    await supabase.from('catalog_items').delete().eq('id', r.id);
    if (r.photos?.length) await supabase.storage.from('photos').remove(r.photos);
    load();
  };

  const backup = async () => {
    const [a, b, c] = await Promise.all([supabase.from('catalog_items').select('*'), supabase.from('shop_info').select('*'), supabase.from('stock').select('*')]);
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), catalog_items: a.data, shop_info: b.data, stock: c.data }, null, 2)], { type: 'application/json' });
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob);
    el.download = `catalog-backup-${new Date().toISOString().slice(0, 10)}.json`; el.click();
  };

  if (form) return (
    <form className="form" onSubmit={save}>
      <h3>{form.id ? 'Edit saree' : 'Add saree'}</h3>
      <label>Title *<input required value={form.title} onChange={e => set('title', e.target.value)} /></label>
      <label>Saree code (same as billing app — links live stock)<input value={form.code} onChange={e => set('code', e.target.value)} /></label>
      <div className="two"><label>Type<input value={form.category} onChange={e => set('category', e.target.value)} /></label>
        <label>Color<input value={form.color} onChange={e => set('color', e.target.value)} /></label></div>
      <label>Fabric<input value={form.fabric} onChange={e => set('fabric', e.target.value)} /></label>
      <label>Description<textarea rows="3" value={form.description || ''} onChange={e => set('description', e.target.value)} /></label>
      <div className="two"><label>Price (₹, shown to customers)<input type="number" min="0" value={form.price ?? ''} onChange={e => set('price', e.target.value)} /></label>
        <label>Offer price (₹)<input type="number" min="0" value={form.offer_price ?? ''} onChange={e => set('offer_price', e.target.value)} /></label></div>
      <div className="two"><label>Offer text<input placeholder="e.g. Diwali special" value={form.offer_text || ''} onChange={e => set('offer_text', e.target.value)} /></label>
        <label>Offer ends on<input type="date" value={form.offer_ends || ''} onChange={e => set('offer_ends', e.target.value)} /></label></div>
      <div className="photos">{form.photos.map(p => <div key={p} className="ph"><img src={photoUrl(p)} alt="" />
        <button type="button" onClick={() => set('photos', form.photos.filter(x => x !== p))}>×</button></div>)}</div>
      {form.photos.length < 4 && <label>Photos (up to 4)<input type="file" accept="image/*" multiple onChange={e => addPhotos(e.target.files)} /></label>}
      <label className="chk"><input type="checkbox" checked={form.is_published} onChange={e => set('is_published', e.target.checked)} /> Visible to customers</label>
      {msg && <p className="err">{msg}</p>}
      <div className="row"><button className="btn" disabled={busy}>{busy ? 'Please wait…' : 'Save'}</button>
        <button type="button" className="btn ghost" onClick={() => { setForm(null); setMsg(''); }}>Cancel</button></div>
    </form>
  );

  return <div>
    <div className="row"><button className="btn" onClick={() => setForm({ ...blank })}>+ Add saree</button>
      <button className="btn ghost" onClick={backup}>Download backup</button></div>
    <div className="list">{rows.map(r => <div key={r.id} className="li">
      {r.photos?.[0] ? <img src={photoUrl(r.photos[0])} alt="" /> : <div className="noimg sm">–</div>}
      <div className="grow"><b>{r.title}</b><div className="muted small">{r.code || 'no code'} · {r.is_published ? 'Visible' : 'Hidden'}</div></div>
      <button className="link" onClick={() => setForm({ ...blank, ...r })}>Edit</button>
      <button className="link danger" onClick={() => remove(r)}>Delete</button></div>)}
      {!rows.length && <p className="muted">No sarees yet. Add your first one.</p>}</div>
  </div>;
}

function Shop() {
  const [s, setS] = useState({}); const [msg, setMsg] = useState('');
  useEffect(() => { supabase.from('shop_info').select('*').eq('id', 1).maybeSingle().then(({ data }) => setS(data || {})); }, []);
  const f = (k, label, ph) => <label>{label}<input placeholder={ph || ''} value={s[k] || ''} onChange={e => setS({ ...s, [k]: e.target.value })} /></label>;
  const save = async (e) => { e.preventDefault(); const { error } = await supabase.from('shop_info').upsert({ ...s, id: 1 }); setMsg(error ? error.message : 'Saved ✓'); };
  return <form className="form" onSubmit={save}><h3>Shop info</h3>
    {f('name', 'Shop name')}{f('address', 'Address')}{f('timings', 'Timings', 'Mon–Sat 10am–9pm')}
    {f('phone', 'Phone')}{f('whatsapp', 'WhatsApp number (with country code)', '919999999999')}{f('map_link', 'Google Maps link')}
    {f('announcement', 'Announcement banner', 'Diwali sale starts 1 Nov!')}
    {msg && <p className="muted">{msg}</p>}<button className="btn">Save</button></form>;
}
