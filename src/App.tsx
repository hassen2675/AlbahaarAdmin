import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

// ── colours ───────────────────────────────────────────────────────────────────
const C = {
  bg:      '#050E24',
  card:    '#0A1A35',
  border:  'rgba(255,255,255,.07)',
  teal:    '#00C8A0',
  gold:    '#F5A623',
  red:     '#FF6B6B',
  green:   '#00FF96',
  white:   '#FFFFFF',
  muted:   'rgba(255,255,255,.4)',
};

// ── helpers ───────────────────────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() {
  let c = '';
  for (let i = 0; i < 16; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}
function fmtCode(c: string) { return c.match(/.{1,4}/g)?.join('-') ?? c; }
function fmtSerial(n: number) { return `#${String(n).padStart(5, '0')}`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }

// ── types ─────────────────────────────────────────────────────────────────────
interface Profile  { id: string; name: string; plan: string; is_admin: boolean; created_at: string; }
interface Code     { id: string; serial: number; code: string; plan: string; used_by: string | null; used_at: string | null; created_at: string; }
interface Catch    { id: string; user_id: string; fish_name: string; weight?: number; location?: string; date?: string; created_at: string; }
interface Post     { id: string; user_id: string; content: string; likes?: number; created_at: string; }

type Tab = 'users' | 'codes' | 'catches' | 'posts';

// ── small components ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: `3px solid ${C.teal}30`,
        borderTopColor: C.teal,
        animation: 'spin .8s linear infinite',
      }}/>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
      background: color + '18', color,
    }}>{label}</span>
  );
}

// ── login ─────────────────────────────────────────────────────────────────────
function LoginView({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error || !data.user) { setErr(error?.message ?? 'Erreur'); setBusy(false); return; }
    onLogin(data.user);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 50% 0%, #0A2472 0%, ${C.bg} 60%)`,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <form onSubmit={submit} style={{
        width: '100%', maxWidth: 400, padding: 40,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 44 }}>🐟</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>
            AL<span style={{ color: C.teal }}>BAHAAR</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4, letterSpacing: '.1em' }}>ADMIN PORTAL</div>
        </div>

        {err && (
          <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 18 }}>
            ⚠️ {err}
          </div>
        )}

        <label style={{ fontSize: 11, color: C.muted, letterSpacing: '.08em' }}>EMAIL</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
          style={{ display: 'block', width: '100%', marginTop: 6, marginBottom: 16,
            background: 'rgba(255,255,255,.06)', border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '12px 14px', color: C.white, fontSize: 14, outline: 'none' }}/>

        <label style={{ fontSize: 11, color: C.muted, letterSpacing: '.08em' }}>MOT DE PASSE</label>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} required
          style={{ display: 'block', width: '100%', marginTop: 6, marginBottom: 24,
            background: 'rgba(255,255,255,.06)', border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '12px 14px', color: C.white, fontSize: 14, outline: 'none' }}/>

        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '14px 0', border: 'none', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
          background: busy ? `${C.teal}40` : `linear-gradient(135deg,${C.teal}EE,${C.teal}88)`,
          color: '#020D1F', fontWeight: 800, fontSize: 15,
        }}>{busy ? '…' : 'Connexion'}</button>
      </form>
    </div>
  );
}

// ── users tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]   = useState<Profile[]>([]);
  const [busy, setBusy]     = useState(true);
  const [toggling, setT]    = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data as Profile[]) || []);
    setBusy(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function togglePlan(u: Profile) {
    setT(u.id);
    const np = u.plan === 'premium' ? 'free' : 'premium';
    await supabase.rpc('admin_set_plan', { target_id: u.id, new_plan: np });
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, plan: np } : x));
    setT(null);
  }

  async function toggleAdmin(u: Profile) {
    setT(u.id + 'a');
    await supabase.from('profiles').update({ is_admin: !u.is_admin }).eq('id', u.id);
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_admin: !x.is_admin } : x));
    setT(null);
  }

  const filtered = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (busy) return <Spinner/>;
  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un utilisateur…"
        style={{
          width: '100%', marginBottom: 16, background: 'rgba(255,255,255,.05)',
          border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px',
          color: C.white, fontSize: 13, outline: 'none',
        }}/>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''}</div>
      {filtered.map(u => (
        <div key={u.id} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: u.plan === 'premium' ? `${C.gold}20` : `${C.teal}12`,
            border: `1.5px solid ${u.plan === 'premium' ? C.gold + '50' : C.teal + '30'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>{u.plan === 'premium' ? '👑' : '🎣'}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.white, marginBottom: 3 }}>
              {u.name || 'Sans nom'}
              {u.is_admin && <span style={{ marginLeft: 6, fontSize: 10, color: C.gold }}>⚡ Admin</span>}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(u.created_at)}</div>
          </div>

          <Badge label={u.plan === 'premium' ? '👑 Premium' : '🆓 Free'} color={u.plan === 'premium' ? C.gold : C.teal}/>

          <button onClick={() => togglePlan(u)} disabled={toggling === u.id} style={{
            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
            background: u.plan === 'premium' ? 'rgba(255,107,107,.15)' : `${C.teal}20`,
            color: u.plan === 'premium' ? C.red : C.teal,
          }}>{toggling === u.id ? '…' : u.plan === 'premium' ? '→ Free' : '→ Premium'}</button>

          <button onClick={() => toggleAdmin(u)} disabled={toggling === u.id + 'a'} title="Toggle Admin" style={{
            width: 32, height: 32, borderRadius: 8, border: `1px solid ${u.is_admin ? C.gold + '40' : C.border}`,
            background: u.is_admin ? `${C.gold}15` : 'rgba(255,255,255,.04)', cursor: 'pointer',
            fontSize: 14, color: u.is_admin ? C.gold : C.muted,
          }}>⚡</button>
        </div>
      ))}
    </div>
  );
}

// ── codes tab ─────────────────────────────────────────────────────────────────
function CodesTab() {
  const [genPlan, setGenPlan] = useState<'month' | 'year'>('month');
  const [qty, setQty]         = useState(5);
  const [busy, setBusy]       = useState(false);
  const [freshRows, setFresh] = useState<Code[]>([]);
  const [codes, setCodes]     = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('prepaid_codes').select('*').order('serial', { ascending: false }).limit(300);
    setCodes((data as Code[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setBusy(true);
    const rows = Array.from({ length: qty }, () => ({ code: makeCode(), plan: genPlan }));
    const { data } = await supabase.from('prepaid_codes').insert(rows).select('*');
    if (data) { setFresh(data as Code[]); load(); }
    setBusy(false);
  }

  function copyAll() {
    const txt = freshRows.map(r =>
      `${fmtSerial(r.serial)}  ${fmtCode(r.code)}  [${r.plan === 'year' ? '1 An — 49.99 TND' : '1 Mois — 8.99 TND'}]`
    ).join('\n');
    navigator.clipboard.writeText(txt);
    setCopied('all'); setTimeout(() => setCopied(null), 2000);
  }

  function copyOne(r: Code) {
    navigator.clipboard.writeText(`${fmtSerial(r.serial)}  ${fmtCode(r.code)}`);
    setCopied(r.code); setTimeout(() => setCopied(null), 1500);
  }

  const used  = codes.filter(c => c.used_by);
  const libre = codes.filter(c => !c.used_by);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total', value: codes.length, color: C.teal },
          { label: 'Utilisés', value: used.length, color: C.red },
          { label: 'Libres', value: libre.length, color: C.green },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, background: C.card, border: `1px solid ${s.color}22`,
            borderRadius: 14, padding: '14px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Generator */}
      <div style={{ background: C.card, border: `1px solid ${C.teal}25`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>✨ Générer des codes</div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: '.08em' }}>PLAN</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['month', 'year'] as const).map(p => (
                <button key={p} onClick={() => setGenPlan(p)} style={{
                  flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  background: genPlan === p ? (p === 'year' ? C.teal : C.gold) : 'rgba(255,255,255,.07)',
                  color: genPlan === p ? '#020D1F' : C.muted, transition: 'all .15s',
                }}>{p === 'month' ? '1 Mois — 8.99 TND' : '1 An — 49.99 TND'}</button>
              ))}
            </div>
          </div>
          <div style={{ width: 100 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: '.08em' }}>QUANTITÉ</div>
            <select value={qty} onChange={e => setQty(Number(e.target.value))} style={{
              width: '100%', background: 'rgba(255,255,255,.07)', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '10px 8px', color: C.white, fontSize: 13, outline: 'none',
            }}>
              {[1,2,3,5,10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <button onClick={generate} disabled={busy} style={{
          width: '100%', padding: '13px 0', border: 'none', borderRadius: 12, cursor: 'pointer',
          background: busy ? `${C.teal}30` : `linear-gradient(135deg,${C.teal}EE,${C.teal}88)`,
          color: '#020D1F', fontWeight: 800, fontSize: 14,
        }}>{busy ? 'Génération…' : `✨ Générer ${qty} code${qty > 1 ? 's' : ''}`}</button>

        {freshRows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{freshRows.length} codes générés — {genPlan === 'year' ? '1 An' : '1 Mois'}</span>
              <button onClick={copyAll} style={{
                background: copied === 'all' ? `${C.teal}20` : 'none', border: `1px solid ${C.teal}44`,
                borderRadius: 8, padding: '5px 12px', fontSize: 12, color: C.teal, cursor: 'pointer',
              }}>{copied === 'all' ? '✅ Copié !' : '📋 Tout copier'}</button>
            </div>
            {freshRows.map(r => (
              <div key={r.code} onClick={() => copyOne(r)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,.04)', borderRadius: 10,
                padding: '10px 14px', marginBottom: 6, cursor: 'pointer',
                border: `1px solid ${copied === r.code ? C.teal + '55' : 'transparent'}`,
                transition: 'border-color .15s',
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, fontFamily: 'monospace', minWidth: 60 }}>
                  {fmtSerial(r.serial)}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: '.14em', color: C.white, flex: 1 }}>
                  {fmtCode(r.code)}
                </span>
                <span style={{ fontSize: 12, color: copied === r.code ? C.teal : C.muted }}>
                  {copied === r.code ? '✅' : '📋'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: '.08em' }}>HISTORIQUE</div>
      {loading ? <Spinner/> : codes.map(r => (
        <div key={r.id} style={{
          background: C.card, border: `1px solid ${r.used_by ? C.red + '18' : C.teal + '18'}`,
          borderRadius: 12, padding: '10px 16px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, fontFamily: 'monospace', minWidth: 60 }}>
            {fmtSerial(r.serial)}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: '.1em', color: r.used_by ? `${C.white}40` : C.white, flex: 1 }}>
            {fmtCode(r.code)}
          </span>
          <Badge label={r.plan === 'year' ? '1 An' : '1 Mois'} color={r.plan === 'year' ? C.teal : C.gold}/>
          <Badge label={r.used_by ? '✓ Utilisé' : '◉ Libre'} color={r.used_by ? C.red : C.green}/>
          {r.used_at && <span style={{ fontSize: 10, color: C.muted }}>{fmtDate(r.used_at)}</span>}
        </div>
      ))}
    </div>
  );
}

// ── catches tab ───────────────────────────────────────────────────────────────
function CatchesTab() {
  const [catches, setCatches] = useState<Catch[]>([]);
  const [busy, setBusy]       = useState(true);

  useEffect(() => {
    (async () => {
      setBusy(true);
      const { data } = await supabase.from('catches').select('*').order('created_at', { ascending: false }).limit(200);
      setCatches((data as Catch[]) || []);
      setBusy(false);
    })();
  }, []);

  if (busy) return <Spinner/>;
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>{catches.length} prises enregistrées</div>
      {catches.map(c => (
        <div key={c.id} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🐟</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.white }}>{c.fish_name || 'Inconnu'}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {c.location && `📍 ${c.location}  `}{c.weight && `⚖️ ${c.weight}kg  `}{fmtDate(c.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── posts tab ─────────────────────────────────────────────────────────────────
function PostsTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy]   = useState(true);
  const [deleting, setDel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setBusy(true);
      const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(200);
      setPosts((data as Post[]) || []);
      setBusy(false);
    })();
  }, []);

  async function deletePost(id: string) {
    if (!confirm('Supprimer ce post ?')) return;
    setDel(id);
    await supabase.from('posts').delete().eq('id', id);
    setPosts(prev => prev.filter(p => p.id !== id));
    setDel(null);
  }

  if (busy) return <Spinner/>;
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>{posts.length} posts</div>
      {posts.map(p => (
        <div key={p.id} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '12px 16px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(p.created_at)}</span>
            <button onClick={() => deletePost(p.id)} disabled={deleting === p.id} style={{
              background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 6,
              padding: '3px 10px', fontSize: 11, color: C.red, cursor: 'pointer',
            }}>{deleting === p.id ? '…' : '🗑 Supprimer'}</button>
          </div>
          <div style={{ fontSize: 13, color: `${C.white}CC`, lineHeight: 1.55 }}>{p.content}</div>
          {p.likes !== undefined && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>❤️ {p.likes} likes</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>('users');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) loadProfile(data.session.user);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) loadProfile(s.user);
      else { setUser(null); setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(u: User) {
    setUser(u);
    const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single();
    setProfile(data as Profile | null);
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'users',   label: 'Membres',  icon: '👥' },
    { id: 'codes',   label: 'Codes',    icon: '🎟️' },
    { id: 'catches', label: 'Prises',   icon: '🐟' },
    { id: 'posts',   label: 'Posts',    icon: '💬' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner/>
    </div>
  );

  if (!user) return <LoginView onLogin={u => loadProfile(u)}/>;

  if (!profile?.is_admin) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🚫</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Accès refusé</div>
      <div style={{ fontSize: 13, color: C.muted }}>Vous n'avez pas les droits administrateur.</div>
      <button onClick={signOut} style={{ marginTop: 8, background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 10, padding: '10px 24px', color: C.red, cursor: 'pointer', fontSize: 14 }}>
        Déconnexion
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        select option { background: #0A1A35; }
      `}</style>

      {/* header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(5,14,36,.97)', backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', height: 56,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>
          AL<span style={{ color: C.teal }}>BAHAAR</span>
          <span style={{ fontSize: 10, color: C.muted, marginLeft: 10, letterSpacing: '.1em' }}>ADMIN</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginRight: 16 }}>{profile.name}</div>
        <button onClick={signOut} style={{
          background: 'rgba(255,107,107,.1)', border: `1px solid ${C.red}30`,
          borderRadius: 8, padding: '6px 14px', fontSize: 12, color: C.red, cursor: 'pointer',
        }}>Déconnexion</button>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* sidebar */}
        <nav style={{
          width: 200, flexShrink: 0,
          background: C.card, borderRight: `1px solid ${C.border}`,
          padding: '20px 12px',
          position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto',
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', marginBottom: 6, border: 'none', borderRadius: 12,
              cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
              background: tab === t.id ? `${C.teal}15` : 'transparent',
              color: tab === t.id ? C.teal : C.muted,
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {/* content */}
        <main style={{ flex: 1, padding: 24, maxWidth: 900, overflowY: 'auto' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: C.white }}>
            {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}
          </h1>
          {tab === 'users'   && <UsersTab/>}
          {tab === 'codes'   && <CodesTab/>}
          {tab === 'catches' && <CatchesTab/>}
          {tab === 'posts'   && <PostsTab/>}
        </main>
      </div>
    </div>
  );
}
