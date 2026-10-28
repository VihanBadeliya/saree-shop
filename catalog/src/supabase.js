import { createClient } from '@supabase/supabase-js';
export const WORKER = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');
export const WHATSAPP = import.meta.env.VITE_WHATSAPP || '';
// All traffic goes through the Cloudflare Worker, never directly to *.supabase.co
export const supabase = createClient(WORKER || 'http://localhost:8787', import.meta.env.VITE_SUPABASE_ANON_KEY || 'anon');
export const photoUrl = (p) => `${WORKER}/storage/v1/object/public/photos/${p}`;
export const effPrice = (i) => (i.offer_price != null ? Number(i.offer_price) : i.price != null ? Number(i.price) : null);
export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
