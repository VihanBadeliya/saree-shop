import { useEffect, useMemo, useState } from 'react';
import { supabase, photoUrl, effPrice, rupees, WHATSAPP } from './supabase.js';

const toggle = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

export default function Public() {
  const [items, setItems] = useState(null);
  const [shop, setShop] = useState({});
  const [err, setErr] = useState('');
  const [cats, setCats] = useState([]);
  const [colors, setColors] = useState([]);
  const [minP, setMinP] = useState('');
  const [maxP, setMaxP] = useState('');
  const [inStock, setInStock] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [sort, setSort] = useState('new');
  const [open, setOpen] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const a = await supabase.from('public_catalog').select('*').order('created_at', { ascending: false });
      if (a.error) setErr('Could not load the collection. Please try again shortly.'); else setItems(a.data);
      const b = await supabase.from('shop_info').select('*').eq('id', 1).maybeSingle();
      if (b.data) setShop(b.data);
    })();
  }, []);

  const allCats = useMemo(() => [...new Set((items || []).map(i => i.category).filter(Boolean))].sort(), [items]);
  const allColors = useMemo(() => [...new Set((items || []).map(i => i.color).filter(Boolean))].sort(), [items]);

  const list = useMemo(() => {
    let l = (items || []).filter(i =>
      (!cats.length || cats.includes(i.category)) &&
      (!colors.length || colors.includes(i.color)) &&
      (!inStock || i.stock_qty > 0) &&
      (!offersOnly || i.offer_price != null) &&
      (minP === '' || (effPrice(i) ?? 0) >= Number(minP)) &&
      (maxP === '' || (effPrice(i) ?? Infinity) <= Number(maxP)));
    if (sort === 'low') l = [...l].sort((a, b) => (effPrice(a) ?? 1e12) - (effPrice(b) ?? 1e12));
    if (sort === 'high') l = [...l].sort((a, b) => (effPrice(b) ?? -1) - (effPrice(a) ?? -1));
    return l;
  }, [items, cats, colors, minP, maxP, inStock, offersOnly, sort]);

  const clear = () => { setCats([]); setColors([]); setMinP(''); setMaxP(''); setInStock(false); setOffersOnly(false); };
  const active = cats.length + colors.length + (minP !== '') + (maxP !== '') + inStock + offersOnly;

  return (
    <div>
      <header className="hero">
        <h1>{shop.name || 'Saree Collection'}</h1>
        <p>Browse our latest sarees from home — visit the shop to see and buy.</p>
        {shop.announcement && <div className="announce">{shop.announcement}</div>}
      </header>

      <div className="layout">
        <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
          Filters{active ? ` (${active})` : ''} ▾
        </button>
        <aside className={'filters' + (showFilters ? ' show' : '')}>
          <FilterGroup title="Type" opts={allCats} sel={cats} on={v => setCats(toggle(cats, v))} />
          <FilterGroup title="Color" opts={allColors} sel={colors} on={v => setColors(toggle(colors, v))} />
          <div className="fg"><h4>Price (₹)</h4>
            <div className="range"><input type="number" placeholder="Min" value={minP} onChange={e => setMinP(e.target.value)} />
              <span>–</span><input type="number" placeholder="Max" value={maxP} onChange={e => setMaxP(e.target.value)} /></div></div>
          <label className="chk"><input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} /> In stock only</label>
          <label className="chk"><input type="checkbox" checked={offersOnly} onChange={e => setOffersOnly(e.target.checked)} /> Offers only</label>
          {active > 0 && <button className="link" onClick={clear}>Clear all filters</button>}
        </aside>

        <main>
          <div className="bar"><span>{items ? `${list.length} saree${list.length === 1 ? '' : 's'}` : ''}</span>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="new">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
            </select></div>
          {err && <p className="err">{err}</p>}
          {!items && !err && <p className="muted">Loading…</p>}
          {items && list.length === 0 && <p className="muted">No sarees match these filters.</p>}
          <div className="grid">{list.map(i => <Card key={i.id} i={i} onOpen={() => setOpen(i)} />)}</div>
        </main>
      </div>

      <footer className="visit">
        <h3>Visit us</h3>
        {shop.address && <p>{shop.address}</p>}
        {shop.timings && <p>🕒 {shop.timings}</p>}
        {shop.phone && <p>📞 <a href={`tel:${shop.phone}`}>{shop.phone}</a></p>}
        {shop.map_link && <p><a href={shop.map_link} target="_blank" rel="noreferrer">📍 Open in Maps</a></p>}
        <p className="muted small">Availability shown is indicative. Please visit the shop to purchase.</p>
      </footer>

      {open && <Detail i={open} shop={shop} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FilterGroup({ title, opts, sel, on }) {
  if (!opts.length) return null;
  return <div className="fg"><h4>{title}</h4><div className="chips">
    {opts.map(o => <button key={o} className={'chip' + (sel.includes(o) ? ' on' : '')} onClick={() => on(o)}>{o}</button>)}
  </div></div>;
}

function Stock({ q }) {
  if (q <= 0) return <span className="stock out">Out of stock</span>;
  if (q <= 2) return <span className="stock low">Only {q} left</span>;
  return <span className="stock in">In stock</span>;
}

function Price({ i }) {
  if (i.offer_price != null) return <div className="price"><b>{rupees(i.offer_price)}</b>{i.price != null && <s>{rupees(i.price)}</s>}</div>;
  return i.price != null ? <div className="price"><b>{rupees(i.price)}</b></div> : null;
}

function Card({ i, onOpen }) {
  return (
    <div className="card" onClick={onOpen}>
      <div className="img">
        {i.photos?.[0] ? <img loading="lazy" src={photoUrl(i.photos[0])} alt={i.title} /> : <div className="noimg">No photo</div>}
        {i.is_new && <span className="badge new">New</span>}
        {i.offer_price != null && <span className="badge offer">Offer</span>}
      </div>
      <div className="info"><h3>{i.title}</h3>
        <div className="sub">{[i.category, i.color].filter(Boolean).join(' · ')}</div>
        <Price i={i} /><Stock q={i.stock_qty} /></div>
    </div>
  );
}

function Detail({ i, shop, onClose }) {
  const [idx, setIdx] = useState(0);
  const num = (shop.whatsapp || WHATSAPP || '').replace(/\D/g, '');
  const msg = encodeURIComponent(`Hi, I'm interested in this saree: ${i.title}${i.code ? ` (Code: ${i.code})` : ''}. Is it available?`);
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <div className="gallery">
          {i.photos?.length ? <img src={photoUrl(i.photos[idx])} alt={i.title} /> : <div className="noimg big">No photo</div>}
          {i.photos?.length > 1 && <div className="thumbs">{i.photos.map((p, k) =>
            <img key={p} src={photoUrl(p)} className={k === idx ? 'on' : ''} onClick={() => setIdx(k)} alt="" />)}</div>}
        </div>
        <div className="detail">
          <h2>{i.title}</h2>
          {i.code && <div className="muted">Code: {i.code}</div>}
          <Price i={i} />
          {i.offer_text && <div className="offer-text">🎁 {i.offer_text}{i.offer_ends ? ` (till ${new Date(i.offer_ends).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})` : ''}</div>}
          <Stock q={i.stock_qty} />
          <table><tbody>
            {i.category && <tr><td>Type</td><td>{i.category}</td></tr>}
            {i.color && <tr><td>Color</td><td>{i.color}</td></tr>}
            {i.fabric && <tr><td>Fabric</td><td>{i.fabric}</td></tr>}
          </tbody></table>
          {i.description && <p>{i.description}</p>}
          {num && <a className="wa" target="_blank" rel="noreferrer" href={`https://wa.me/${num}?text=${msg}`}>💬 Ask about this saree on WhatsApp</a>}
          <p className="muted small">To buy, please visit our shop.</p>
        </div>
      </div>
    </div>
  );
}
