import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MO   = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const ICON_CATEGORIES = [
  { label: 'Saúde & Corpo', icons: ['🏃','💪','🧘','🚶','🏋️','🤸','🚴','🏊','🧗','⛹️','🤾','🏄','🥊','🤼','🎽','🦵','🦷','😴','🛌','💊','🩺','🩹','❤️','🫀','🫁','🧬','🩻','💉','🧪'] },
  { label: 'Alimentação', icons: ['🥗','🥦','🍎','🥑','🍳','🥩','🐟','🥕','🌽','🧄','🫐','🍇','🍓','🍊','🍋','🥝','🍵','💧','🥤','🧃','☕','🫖','🥛','🍫','🚫🍔'] },
  { label: 'Mente & Foco', icons: ['🧠','📚','✍️','📖','🎯','📝','💡','🔬','🎓','📐','🗂️','📊','💭','🤔','🧩','♟️','🔭','📡','🗺️','🌐'] },
  { label: 'Criatividade', icons: ['🎨','🎵','🎸','🎹','🎺','🎻','🥁','🎙️','🎤','🖌️','✏️','📷','🎬','🎭','🎪','🪄','🎲','🧶','🪡','🏺'] },
  { label: 'Rotina & Casa', icons: ['🧹','🧺','🛁','🪥','🧴','🪞','⏰','📅','🗓️','📋','✅','🔑','🏠','🌱','🌿','💐','🪴','🕯️','🧘'] },
  { label: 'Dinheiro & Trabalho', icons: ['💰','💳','📈','📉','💼','🖥️','⌨️','🖱️','📱','📞','📧','🗒️','📌','📎','🔗','🏦','💹','🪙','💎','🤝'] },
  { label: 'Bem-estar Mental', icons: ['😊','🙏','🧘','💆','🌅','🌄','🌙','⭐','✨','🌈','🕊️','🫶','❤️‍🔥','💚','🌻','🌸','🍃','🌊','🏔️','🌴'] },
  { label: 'Desafios', icons: ['🚭','🚫','⛔','🔥','🏆','🥇','🎖️','🏅','🎯','💯','⚡','🌟','💥','🚀','🛡️','⚔️','🗡️','🎪','🤺','🥋'] },
];
const ALL_ICONS = ICON_CATEGORIES.flatMap(c => c.icons);
const HICONS = ALL_ICONS; // backward compat
const HCOLS  = ['#00E5A0','#4488FF','#FF4466','#FFB800','#AA66FF','#FF8844','#44DDFF','#FF44AA','#88FF44','#FFAA00','#44AAFF','#FF6644','#66FF88','#AA44FF','#FFD044'];
const PALETTE = ['#00E5A0','#4488FF','#FF4466','#FFB800','#AA66FF','#FF8844','#44DDFF','#FF44BB','#66FF44','#FF6644','#44BBFF','#FFD044','#FF4488','#88FF66','#44FFCC'];
const DEFAULT_COLS = [{label:'Backlog',color:'#44445A',position:0},{label:'A Fazer',color:'#4488FF',position:1},{label:'Em Progresso',color:'#FFB800',position:2},{label:'Concluído',color:'#00E5A0',position:3}];
const DEFAULT_TAGS = [{label:'Design',color:'#4488FF'},{label:'Dev',color:'#AA66FF'},{label:'Produto',color:'#00E5A0'},{label:'Pessoal',color:'#FF8844'},{label:'Financeiro',color:'#FFB800'},{label:'Saúde',color:'#FF4466'}];

// ─────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────
const toK = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayKey = () => toK(new Date());
const lastN = n => Array.from({length:n},(_,i) => { const d=new Date(); d.setDate(d.getDate()-(n-1-i)); return toK(d); });
const dlabel = k => { const [y,m,d]=k.split('-').map(Number); return DAYS[new Date(y,m-1,d).getDay()]; };
const dnum   = k => parseInt(k.split('-')[2], 10);
const fmtReminder = iso => { try { return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch { return iso; } };
const reminderPast = iso => iso && new Date(iso) < new Date();

function calcStreak(logs, habitId) {
  let s=0; const d=new Date();
  while(true){ const k=toK(d); if((logs[k]||[]).includes(habitId)){s++;d.setDate(d.getDate()-1);}else break; }
  return s;
}
function calcTotal(logs, habitId) { return Object.values(logs).filter(a=>a.includes(habitId)).length; }
const renderIcon = (icon, size=19) => {
  if (icon?.startsWith('data:')) return <img src={icon} alt="" style={{width:size,height:size,borderRadius:4,objectFit:'cover'}}/>;
  return icon;
};

// ─────────────────────────────────────────────────────
// SVG RING
// ─────────────────────────────────────────────────────
function Ring({ pct, size=96 }) {
  const r = size/2-7, c = 2*Math.PI*r, off = c-(pct/100)*c;
  return (
    <svg width={size} height={size} style={{transform:'rotate(-90deg)',display:'block'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--b2)" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--acc)" strokeWidth="6"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{transition:'stroke-dashoffset .7s cubic-bezier(.34,1.56,.64,1)'}}/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────
// AUTH PAGE
// ─────────────────────────────────────────────────────
function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async e => {
    e.preventDefault(); setError(''); setMsg(''); setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg('Conta criada! Verifique seu email para confirmar.');
      }
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const googleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <img src="/logo192.png" alt="Mnemos" className="auth-mark-img"/>
          <div className="auth-name">Mnemos</div>
        </div>
        <div className="auth-h">{mode==='login' ? 'Entrar' : 'Criar conta'}</div>
        <div className="auth-sub">Produtividade Pessoal</div>
        {error && <div className="auth-error">{error}</div>}
        {msg   && <div className="auth-success">{msg}</div>}
        <form onSubmit={submit}>
          <label className="auth-label">Email</label>
          <input className="auth-input" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
          <label className="auth-label">Senha</label>
          <input className="auth-input" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} required minLength={6}/>
          <button className="auth-btn" disabled={loading}>{loading ? 'Aguarde...' : mode==='login' ? 'ENTRAR' : 'CRIAR CONTA'}</button>
        </form>
        <div className="auth-divider">OU</div>
        <button className="auth-google" onClick={googleLogin}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continuar com Google
        </button>
        <div className="auth-toggle">
          {mode==='login' ? <>Não tem conta?<button onClick={()=>{setMode('signup');setError('');}}>Criar conta</button></> : <>Já tem conta?<button onClick={()=>{setMode('login');setError('');}}>Entrar</button></>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_,session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="loading-screen"><div className="loading-spinner"/><div className="loading-text">Carregando...</div></div>;
  if (!session) return <AuthPage />;
  return <FlowApp session={session} />;
}

// ─────────────────────────────────────────────────────
// FLOW APP (authenticated)
// ─────────────────────────────────────────────────────
function FlowApp({ session }) {
  const uid = session.user.id;

  // ── Theme ────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('mnemos-theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mnemos-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // ── Data state ──────────────────────────────────────
  const [habits,   setHabits]   = useState([]);
  const [logs,     setLogs]     = useState({});   // { dateKey: [habitId, ...] }
  const [kbCols,   setKbCols]   = useState([]);
  const [kbTags,   setKbTags]   = useState([]);
  const [tasks,    setTasks]    = useState([]);
  const [entries,  setEntries]  = useState([]);  // journal entries
  const [routines, setRoutines] = useState([]);
  const [rBlocks,  setRBlocks]  = useState([]);
  const [rLogs,    setRLogs]    = useState({});  // { dateKey: [blockId,...] }
  const [fSheets,  setFSheets]  = useState([]);
  const [fEntries, setFEntries] = useState([]);
  const [dataReady, setDataReady] = useState(false);

  // ── UI state ────────────────────────────────────────
  const [page,     setPage]     = useState('habits');
  const [habTab,   setHabTab]   = useState('today');
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editHabitId,  setEditHabitId]  = useState(null);
  const [nHName,   setNHName]   = useState('');
  const [nHIcon,   setNHIcon]   = useState('🌅');
  const [nHColor,  setNHColor]  = useState('#00E5A0');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTaskId,    setEditTaskId]    = useState(null);
  const [tTitle, setTTitle] = useState('');
  const [tDesc,  setTDesc]  = useState('');
  const [tCol,   setTCol]   = useState('');
  const [tTags,  setTTags]  = useState([]);
  const [tReminder, setTReminder] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newColName,  setNewColName]  = useState('');
  const [newColColor, setNewColColor] = useState('#4488FF');
  const [newTagName,  setNewTagName]  = useState('');
  const [newTagColor, setNewTagColor] = useState('#4488FF');
  const [pickingColorFor, setPickingColorFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const dragId = useRef(null);

  // ── Load all data ────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [hRes, lRes, cRes, tgRes, tkRes, jRes, rtRes, rbRes, rlRes, fsRes, feRes] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', uid).order('created_at'),
        supabase.from('habit_logs').select('*').eq('user_id', uid),
        supabase.from('kb_cols').select('*').eq('user_id', uid).order('position'),
        supabase.from('kb_tags').select('*').eq('user_id', uid),
        supabase.from('tasks').select('*').eq('user_id', uid).order('position'),
        supabase.from('journal_entries').select('*').eq('user_id', uid).order('entry_date', {ascending:false}),
        supabase.from('routines').select('*').eq('user_id', uid).order('position'),
        supabase.from('routine_blocks').select('*').eq('user_id', uid).order('start_time'),
        supabase.from('routine_logs').select('*').eq('user_id', uid),
        supabase.from('finance_sheets').select('*').eq('user_id', uid).order('position'),
        supabase.from('finance_entries').select('*').eq('user_id', uid).order('position'),
      ]);

      setHabits(hRes.data || []);

      // Build logs map: { dateKey: [habitId, ...] }
      const logsMap = {};
      (lRes.data || []).forEach(l => {
        if (!logsMap[l.date]) logsMap[l.date] = [];
        logsMap[l.date].push(l.habit_id);
      });
      setLogs(logsMap);

      // If no cols yet, seed defaults
      let cols = cRes.data || [];
      if (cols.length === 0) {
        const inserts = DEFAULT_COLS.map(c => ({ ...c, user_id: uid }));
        const { data } = await supabase.from('kb_cols').insert(inserts).select();
        cols = data || [];
      }
      setKbCols(cols);

      let tags = tgRes.data || [];
      if (tags.length === 0) {
        const inserts = DEFAULT_TAGS.map(t => ({ ...t, user_id: uid }));
        const { data } = await supabase.from('kb_tags').insert(inserts).select();
        tags = data || [];
      }
      setKbTags(tags);

      const tk = tkRes.data || [];
      setTasks(tk);
      setEntries(jRes.data || []);
      setRoutines(rtRes.data || []);
      setRBlocks(rbRes.data || []);
      // Build rLogs map: { dateKey: [blockId,...] }
      const rlogsMap = {};
      (rlRes.data || []).forEach(l => {
        if (!rlogsMap[l.date]) rlogsMap[l.date] = [];
        rlogsMap[l.date].push(l.block_id);
      });
      setRLogs(rlogsMap);

      // Finance — seed default sheets if none
      let sheets = fsRes.data || [];
      if (sheets.length === 0) {
        const defaults = [
          { user_id: uid, name: 'Despesas',   type: 'expense',      position: 0 },
          { user_id: uid, name: 'Receitas',   type: 'income',       position: 1 },
          { user_id: uid, name: 'Fixos',      type: 'fixed',        position: 2 },
        ];
        const { data } = await supabase.from('finance_sheets').insert(defaults).select();
        sheets = data || [];
      }
      setFSheets(sheets);
      setFEntries(feRes.data || []);

      if (cols.length > 0) setTCol(cols[0].id);
      setDataReady(true);
    }
    load();
  }, [uid]);

  // ── Notification permission ──────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  function scheduleNotif(title, isoTime) {
    const ms = new Date(isoTime) - Date.now();
    if (ms <= 0 || !('Notification' in window)) return;
    const fire = () => new Notification('⏰ Lembrete Flow', { body: title });
    if (Notification.permission === 'granted') setTimeout(fire, ms);
  }

  // ── HABIT ACTIONS ────────────────────────────────────
  const toggleHabit = useCallback(async (habitId, dateK) => {
    const dk = dateK || todayKey();
    const existing = (logs[dk] || []).includes(habitId);
    // Optimistic
    setLogs(prev => {
      const arr = [...(prev[dk] || [])];
      const i = arr.indexOf(habitId);
      if (i >= 0) arr.splice(i, 1); else arr.push(habitId);
      return { ...prev, [dk]: arr };
    });
    if (existing) {
      await supabase.from('habit_logs').delete().eq('user_id', uid).eq('habit_id', habitId).eq('date', dk);
    } else {
      await supabase.from('habit_logs').insert({ user_id: uid, habit_id: habitId, date: dk });
    }
  }, [logs, uid]);

  const addHabit = useCallback(async () => {
    if (!nHName.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('habits').insert({ user_id: uid, name: nHName.trim(), icon: nHIcon, color: nHColor }).select().single();
    if (data) setHabits(prev => [...prev, data]);
    setNHName(''); setNHIcon('🌅'); setNHColor('#00E5A0'); setShowAddHabit(false);
    setSaving(false);
  }, [nHName, nHIcon, nHColor, uid]);

  const deleteHabit = useCallback(async id => {
    setHabits(prev => prev.filter(h => h.id !== id));
    setEditHabitId(null);
    await supabase.from('habits').delete().eq('id', id);
  }, []);

  // ── TASK ACTIONS ─────────────────────────────────────
  const openNewTask = (colId) => {
    setEditTaskId(null); setTTitle(''); setTDesc('');
    setTCol(colId || (kbCols[0]?.id || '')); setTTags([]); setTReminder('');
    setShowTaskModal(true);
  };
  const openEditTask = (id) => {
    const t = tasks.find(t => t.id === id); if (!t) return;
    setEditTaskId(id); setTTitle(t.title); setTDesc(t.description || '');
    setTCol(t.col_id); setTTags(t.tags || []); setTReminder(t.reminder ? t.reminder.slice(0,16) : '');
    setShowTaskModal(true);
  };

  const saveTask = useCallback(async () => {
    if (!tTitle.trim()) return;
    setSaving(true);
    const payload = { title: tTitle, description: tDesc, col_id: tCol, tags: tTags, reminder: tReminder || null };
    if (editTaskId) {
      const { data } = await supabase.from('tasks').update(payload).eq('id', editTaskId).select().single();
      if (data) setTasks(prev => prev.map(t => t.id === editTaskId ? data : t));
    } else {
      const pos = tasks.filter(t => t.col_id === tCol).length;
      const { data } = await supabase.from('tasks').insert({ ...payload, user_id: uid, position: pos }).select().single();
      if (data) setTasks(prev => [...prev, data]);
    }
    if (tReminder) scheduleNotif(tTitle, tReminder);
    setShowTaskModal(false); setEditTaskId(null);
    setSaving(false);
  }, [tTitle, tDesc, tCol, tTags, tReminder, editTaskId, tasks, uid]);

  const deleteTask = useCallback(async id => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  }, []);

  const moveTask = useCallback(async (id, colId) => {
    setTasks(prev => prev.map(t => t.id === id ? {...t, col_id: colId} : t));
    await supabase.from('tasks').update({ col_id: colId }).eq('id', id);
  }, []);

  // ── COLUMN ACTIONS ───────────────────────────────────
  const addCol = useCallback(async () => {
    if (!newColName.trim()) return;
    const pos = kbCols.length;
    const { data } = await supabase.from('kb_cols').insert({ user_id: uid, label: newColName.trim(), color: newColColor, position: pos }).select().single();
    if (data) setKbCols(prev => [...prev, data]);
    setNewColName(''); setNewColColor('#4488FF');
  }, [newColName, newColColor, kbCols, uid]);

  const deleteCol = useCallback(async id => {
    if (kbCols.length <= 1) { alert('É necessário ao menos uma coluna.'); return; }
    const fallback = kbCols.find(c => c.id !== id)?.id || '';
    const newCols = kbCols.filter(c => c.id !== id);
    setKbCols(newCols);
    setTasks(prev => prev.map(t => t.col_id === id ? {...t, col_id: fallback} : t));
    await supabase.from('kb_cols').delete().eq('id', id);
    if (fallback) await supabase.from('tasks').update({ col_id: fallback }).eq('col_id', id).eq('user_id', uid);
    // Renumber remaining positions
    for (let i = 0; i < newCols.length; i++) {
      await supabase.from('kb_cols').update({ position: i }).eq('id', newCols[i].id);
    }
  }, [kbCols, uid]);

  const updateCol = useCallback(async (id, patch) => {
    setKbCols(prev => prev.map(c => c.id === id ? {...c, ...patch} : c));
    await supabase.from('kb_cols').update(patch).eq('id', id);
  }, []);

  const reorderCol = useCallback(async (id, dir) => {
    const cols = [...kbCols];
    const idx = cols.findIndex(c => c.id === id);
    const target = idx + dir;
    if (target < 0 || target >= cols.length) return;
    // Swap in local state immediately
    [cols[idx], cols[target]] = [cols[target], cols[idx]];
    setKbCols(cols);
    // Save each new position to Supabase sequentially
    for (let i = 0; i < cols.length; i++) {
      await supabase.from('kb_cols').update({ position: i }).eq('id', cols[i].id);
    }
  }, [kbCols]);

  // ── TAG ACTIONS ──────────────────────────────────────
  const addTag = useCallback(async () => {
    if (!newTagName.trim()) return;
    const { data } = await supabase.from('kb_tags').insert({ user_id: uid, label: newTagName.trim(), color: newTagColor }).select().single();
    if (data) setKbTags(prev => [...prev, data]);
    setNewTagName(''); setNewTagColor('#4488FF');
  }, [newTagName, newTagColor, uid]);

  const deleteTag = useCallback(async id => {
    setKbTags(prev => prev.filter(t => t.id !== id));
    const updatedTasks = tasks.map(t => ({...t, tags: (t.tags||[]).filter(x => x !== id)}));
    setTasks(updatedTasks);
    await supabase.from('kb_tags').delete().eq('id', id);
    for (const t of updatedTasks.filter(t => !(t.tags||[]).includes(id))) {
      await supabase.from('tasks').update({ tags: t.tags }).eq('id', t.id);
    }
  }, [tasks]);

  const updateTag = useCallback(async (id, patch) => {
    setKbTags(prev => prev.map(t => t.id === id ? {...t, ...patch} : t));
    await supabase.from('kb_tags').update(patch).eq('id', id);
  }, []);

  // ── ROUTINE ACTIONS ──────────────────────────────────
  const addRoutine = useCallback(async (name, color, days) => {
    const pos = routines.length;
    const { data } = await supabase.from('routines').insert({ user_id: uid, name, color, days, position: pos }).select().single();
    if (data) setRoutines(prev => [...prev, data]);
    return data;
  }, [routines, uid]);

  const updateRoutine = useCallback(async (id, patch) => {
    setRoutines(prev => prev.map(r => r.id === id ? {...r, ...patch} : r));
    await supabase.from('routines').update(patch).eq('id', id);
  }, []);

  const deleteRoutine = useCallback(async id => {
    setRoutines(prev => prev.filter(r => r.id !== id));
    setRBlocks(prev => prev.filter(b => b.routine_id !== id));
    await supabase.from('routines').delete().eq('id', id);
  }, []);

  const addBlock = useCallback(async (routineId, block) => {
    const pos = rBlocks.filter(b => b.routine_id === routineId).length;
    const { data } = await supabase.from('routine_blocks')
      .insert({ user_id: uid, routine_id: routineId, ...block, position: pos }).select().single();
    if (data) setRBlocks(prev => [...prev, data]);
    return data;
  }, [rBlocks, uid]);

  const updateBlock = useCallback(async (id, patch) => {
    setRBlocks(prev => prev.map(b => b.id === id ? {...b, ...patch} : b));
    await supabase.from('routine_blocks').update(patch).eq('id', id);
  }, []);

  const deleteBlock = useCallback(async id => {
    setRBlocks(prev => prev.filter(b => b.id !== id));
    await supabase.from('routine_blocks').delete().eq('id', id);
  }, []);

  const toggleBlock = useCallback(async (blockId, dateK) => {
    const dk = dateK || todayKey();
    const existing = (rLogs[dk] || []).includes(blockId);
    setRLogs(prev => {
      const arr = [...(prev[dk] || [])];
      const i = arr.indexOf(blockId);
      if (i >= 0) arr.splice(i, 1); else arr.push(blockId);
      return { ...prev, [dk]: arr };
    });
    if (existing) {
      await supabase.from('routine_logs').delete().eq('user_id', uid).eq('block_id', blockId).eq('date', dk);
    } else {
      await supabase.from('routine_logs').insert({ user_id: uid, block_id: blockId, date: dk });
    }
  }, [rLogs, uid]);

  // ── FINANCE ACTIONS ──────────────────────────────────
  const addFEntry = useCallback(async (sheetId, entry) => {
    const pos = fEntries.filter(e => e.sheet_id === sheetId).length;
    const { data } = await supabase.from('finance_entries')
      .insert({ user_id: uid, sheet_id: sheetId, ...entry, position: pos }).select().single();
    if (data) setFEntries(prev => [...prev, data]);
    return data;
  }, [fEntries, uid]);

  const updateFEntry = useCallback(async (id, patch) => {
    setFEntries(prev => prev.map(e => e.id === id ? {...e, ...patch} : e));
    await supabase.from('finance_entries').update(patch).eq('id', id);
  }, []);

  const deleteFEntry = useCallback(async id => {
    setFEntries(prev => prev.filter(e => e.id !== id));
    await supabase.from('finance_entries').delete().eq('id', id);
  }, []);

  const addFSheet = useCallback(async (name, type) => {
    const pos = fSheets.length;
    const { data } = await supabase.from('finance_sheets')
      .insert({ user_id: uid, name, type, position: pos }).select().single();
    if (data) setFSheets(prev => [...prev, data]);
    return data;
  }, [fSheets, uid]);

  const updateFSheet = useCallback(async (id, patch) => {
    setFSheets(prev => prev.map(s => s.id === id ? {...s, ...patch} : s));
    await supabase.from('finance_sheets').update(patch).eq('id', id);
  }, []);

  const deleteFSheet = useCallback(async id => {
    setFSheets(prev => prev.filter(s => s.id !== id));
    setFEntries(prev => prev.filter(e => e.sheet_id !== id));
    await supabase.from('finance_sheets').delete().eq('id', id);
  }, []);

  // ── JOURNAL ACTIONS ──────────────────────────────────
  const saveEntry = useCallback(async (entryData) => {
    const base = { title: entryData.title, body: entryData.body, mood: entryData.mood, tags: entryData.tags };
    const withImg = { ...base, image_url: entryData.image_url };
    if (entryData.id) {
      // Try with image first, fallback without
      let res = await supabase.from('journal_entries').update(withImg).eq('id', entryData.id).select().single();
      if (res.error) res = await supabase.from('journal_entries').update(base).eq('id', entryData.id).select().single();
      if (res.data) setEntries(prev => prev.map(e => e.id === res.data.id ? res.data : e));
      return res.data;
    } else {
      const insert = { user_id: uid, ...base, entry_date: entryData.entry_date };
      const insertWithImg = { ...insert, image_url: entryData.image_url };
      let res = await supabase.from('journal_entries').insert(insertWithImg).select().single();
      if (res.error) res = await supabase.from('journal_entries').insert(insert).select().single();
      if (res.data) setEntries(prev => [res.data, ...prev]);
      return res.data;
    }
  }, [uid]);

  const deleteEntry = useCallback(async id => {
    setEntries(prev => prev.filter(e => e.id !== id));
    await supabase.from('journal_entries').delete().eq('id', id);
  }, []);

  if (!dataReady) return <div className="loading-screen"><div className="loading-spinner"/><div className="loading-text">Carregando seus dados...</div></div>;

  const d = new Date();
  const td = todayKey();
  const doneH = (logs[td] || []).length;

  return (
    <div className="app">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="sb-logo">
            <img src="/logo192.png" alt="Mnemos" className="sb-mark-img"/>
            <div className="sb-name">Mnemos</div>
          </div>
          <div className="sb-tag">Produtividade Pessoal</div>
        </div>
        <div className="sb-scroll">
          <div className="sb-section-label">Módulos</div>
          {[
            {id:'habits',  ico:'◎', label:'Hábitos',  badge:`${doneH}/${habits.length}`},
            {id:'kanban',  ico:'⊞', label:'Kanban',   badge:`${tasks.length} tarefas`},
            {id:'journal', ico:'✦', label:'Diário',   badge:`${entries.length} entradas`},
            {id:'routine', ico:'◷', label:'Rotina',   badge:`${routines.length} rotinas`},
            {id:'finance', ico:'₢', label:'Finanças', badge:`${fSheets.length} planilhas`},
          ].map(({id,ico,label,badge}) => (
            <button key={id} className={`sb-item ${page===id?'active':''}`} onClick={()=>setPage(id)}>
              <div className="sb-item-bar"/>
              <div className="sb-item-ico">{ico}</div>
              <div className="sb-item-lbl">{label}</div>
              <div className="sb-item-badge">{badge}</div>
            </button>
          ))}
        </div>
        <div className="sb-foot">
          <div className="sb-foot-row">
            <div className="sb-foot-date">
              <b>{String(d.getDate()).padStart(2,'0')} {MO[d.getMonth()]} {d.getFullYear()}</b><br/>
              {DAYS[d.getDay()].toUpperCase()}
            </div>
            <div className="sb-foot-actions">
              <button className="theme-toggle" onClick={toggleTheme} title={theme==='dark'?'Modo claro':'Modo escuro'}>
                {theme==='dark' ? '☀' : '☾'}
              </button>
              <button className="sb-signout" onClick={()=>supabase.auth.signOut()}>SAIR</button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="main">
      {page !== 'finance' && (
        <div className="mod-header">
          <div className="mod-eyebrow fade">
            {page==='habits' ? {today:'ACOMPANHAMENTO DIÁRIO',week:'VISÃO 7 DIAS',stats:'ANÁLISE DE DESEMPENHO',manage:'GERENCIAMENTO'}[habTab]
            : page==='kanban'  ? 'GESTÃO DE TAREFAS'
            : page==='journal' ? 'REFLEXÕES & ANOTAÇÕES'
            : 'PLANEJAMENTO DO DIA'}
          </div>
          <div className="mod-title fade" dangerouslySetInnerHTML={{__html:
            page==='habits' ? {today:'Hábitos <span class="hi">de Hoje</span>',week:'Visão <span class="hi">Semanal</span>',stats:'Análise <span class="hi">de Dados</span>',manage:'Meus <span class="hi">Hábitos</span>'}[habTab]
            : page==='kanban'  ? 'Quadro <span class="hi">Kanban</span>'
            : page==='journal' ? 'Meu <span class="hi">Diário</span>'
            : 'Minha <span class="hi">Rotina</span>'
          }}/>
          {page==='habits' && (
            <div className="sub-tabs">
              {[{id:'today',label:'Hoje'},{id:'week',label:'Semana'},{id:'stats',label:'Stats'},{id:'manage',label:'Hábitos'}].map(({id,label}) => (
                <button key={id} className={`sub-tab ${habTab===id?'active':''}`} onClick={()=>{setHabTab(id);setShowAddHabit(false);setEditHabitId(null);}}>{label}</button>
              ))}
            </div>
          )}
        </div>
      )}

        <div className={page==='finance' ? 'finance-fullbody' : 'mod-body'}>
          {page==='habits' && habTab==='today'  && <HabToday  habits={habits} logs={logs} td={td} onToggle={toggleHabit}/>}
          {page==='habits' && habTab==='week'   && <HabWeek   habits={habits} logs={logs} td={td} onToggle={toggleHabit}/>}
          {page==='habits' && habTab==='stats'  && <HabStats  habits={habits} logs={logs} td={td}/>}
          {page==='habits' && habTab==='manage' && (
            <HabManage habits={habits} logs={logs}
              editId={editHabitId} setEditId={setEditHabitId}
              onDelete={deleteHabit}
              showAdd={showAddHabit} setShowAdd={setShowAddHabit}
              nHName={nHName} setNHName={setNHName}
              nHIcon={nHIcon} setNHIcon={setNHIcon}
              nHColor={nHColor} setNHColor={setNHColor}
              onAdd={addHabit} saving={saving}
            />
          )}
          {page==='kanban' && (
            <KanbanPage tasks={tasks} kbCols={kbCols} kbTags={kbTags}
              onNewTask={openNewTask} onEditTask={openEditTask} onDeleteTask={deleteTask}
              onMoveTask={moveTask} dragId={dragId}
              onOpenSettings={()=>setShowSettings(true)}
            />
          )}
          {page==='journal' && (
            <JournalPage entries={entries} onSave={saveEntry} onDelete={deleteEntry}/>
          )}
          {page==='routine' && (
            <RoutinePage
              routines={routines} blocks={rBlocks} logs={rLogs}
              onAddRoutine={addRoutine} onUpdateRoutine={updateRoutine} onDeleteRoutine={deleteRoutine}
              onAddBlock={addBlock} onUpdateBlock={updateBlock} onDeleteBlock={deleteBlock}
              onToggleBlock={toggleBlock}
            />
          )}
          {page==='finance' && (
            <FinancePage
              sheets={fSheets} entries={fEntries}
              onAddSheet={addFSheet} onUpdateSheet={updateFSheet} onDeleteSheet={deleteFSheet}
              onAddEntry={addFEntry} onUpdateEntry={updateFEntry} onDeleteEntry={deleteFEntry}
            />
          )}
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="bnav">
        {[{ico:'◎',label:'HÁBITOS',id:'habits'},{ico:'⊞',label:'KANBAN',id:'kanban'},{ico:'✦',label:'DIÁRIO',id:'journal'},{ico:'◷',label:'ROTINA',id:'routine'},{ico:'₢',label:'FINANÇAS',id:'finance'}].map(({ico,label,id})=>(
          <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}>
            <span className="bnav-ico">{ico}</span><span>{label}</span><div className="bnav-pip"/>
          </button>
        ))}
        <button onClick={toggleTheme} style={{maxWidth:52}}>
          <span className="bnav-ico">{theme==='dark'?'☀':'☾'}</span>
          <span>{theme==='dark'?'CLARO':'ESC'}</span>
        </button>
      </nav>

      {/* ── TASK MODAL ── */}
      {showTaskModal && (
        <TaskModal
          editId={editTaskId} kbCols={kbCols} kbTags={kbTags}
          tTitle={tTitle} setTTitle={setTTitle}
          tDesc={tDesc}   setTDesc={setTDesc}
          tCol={tCol}     setTCol={setTCol}
          tTags={tTags}   setTTags={setTTags}
          tReminder={tReminder} setTReminder={setTReminder}
          onSave={saveTask} saving={saving}
          onClose={()=>setShowTaskModal(false)}
        />
      )}

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <SettingsModal
          kbCols={kbCols} kbTags={kbTags}
          onAddCol={addCol} onDeleteCol={deleteCol} onUpdateCol={updateCol} onReorderCol={reorderCol}
          onAddTag={addTag} onDeleteTag={deleteTag} onUpdateTag={updateTag}
          newColName={newColName} setNewColName={setNewColName}
          newColColor={newColColor} setNewColColor={setNewColColor}
          newTagName={newTagName} setNewTagName={setNewTagName}
          newTagColor={newTagColor} setNewTagColor={setNewTagColor}
          pickingColorFor={pickingColorFor} setPickingColorFor={setPickingColorFor}
          onClose={()=>{setShowSettings(false);setPickingColorFor(null);}}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// HABITS — TODAY
// ─────────────────────────────────────────────────────
function HabToday({ habits, logs, td, onToggle }) {
  const l7 = lastN(7);
  const done = (logs[td]||[]).length, tot = habits.length;
  const pct = tot>0 ? Math.round(done/tot*100) : 0;
  const msgs = [[100,'Máxima eficiência. Dia concluído.'],[75,'Ritmo forte. Não pare agora.'],[50,'Metade feita. Continue o momentum.'],[1,'O dia começa com uma ação.'],[0,'Defina seus hábitos para começar.']];
  const msg = msgs.find(([t])=>pct>=t)[1];
  const wd = l7.filter(d=>(logs[d]||[]).length===tot&&tot>0).length;
  return (
    <div>
      <div className="prog-card">
        <div className="ring-wrap">
          <Ring pct={pct}/>
          <div className="ring-lbl">
            <div className={`ring-pct${pct===100?' full':''}`}>{pct}%</div>
            <div className="ring-sub">FEITO</div>
          </div>
        </div>
        <div>
          <div className="prog-ct"><strong>{done}</strong> de {tot} hoje</div>
          <div className="prog-msg">{msg}</div>
          <div className="prog-bar-bg"><div className="prog-bar-fg" style={{width:pct+'%'}}/></div>
          <div className="chip-row">
            <div className="chip"><div className="cdot" style={{background:'#00E5A0'}}/>{pct}% hoje</div>
            <div className="chip"><div className="cdot" style={{background:'#FFB800'}}/>{wd}/7 dias perfeitos</div>
            <div className="chip"><div className="cdot" style={{background:'#4488FF'}}/>{tot} hábito{tot!==1?'s':''}</div>
          </div>
        </div>
      </div>
      {!habits.length ? (
        <div className="empty fade"><div className="empty-ico">✦</div><div className="empty-h">Nenhum hábito definido</div><div className="empty-s">Vá em "Hábitos" para configurar</div></div>
      ) : (
        <div className="bento g2 stagger">
          {habits.map(h => {
            const isDone = (logs[td]||[]).includes(h.id);
            const s = calcStreak(logs, h.id);
            return (
              <div key={h.id} className={`card${isDone?' lit':''}`} style={isDone?{'--acc':h.color}:{}}>
                <div className="hab-row">
                  <div className="hab-ico">{renderIcon(h.icon)}</div>
                  <div className="hab-body">
                    <div className="hab-name">{h.name}</div>
                    <div className="hab-meta">
                      {s>0 ? <><div className="s-badge">{s}d 🔥</div>{s} dia{s!==1?'s':''}</> : '— iniciar hoje'}
                    </div>
                  </div>
                  <button className={`chk${isDone?' done':''}`} onClick={()=>onToggle(h.id)}
                    style={isDone?{background:h.color,borderColor:h.color,color:'#000'}:{}}>
                    {isDone?'✓':''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// HABITS — WEEK
// ─────────────────────────────────────────────────────
function HabWeek({ habits, logs, td, onToggle }) {
  const l7 = lastN(7);
  return (
    <div className="wk-scroll">
      <div className="wk-inner">
        <div className="wk-hdr">
          <div/>
          {l7.map(d=>(
            <div key={d}>
              <div className="wk-dc">{dlabel(d)}</div>
              <div className={`wk-dn${d===td?' tod':''}`}>{dnum(d)}</div>
            </div>
          ))}
        </div>
        {!habits.length ? <div className="empty"><div className="empty-ico">◈</div><div className="empty-h">Sem hábitos</div></div> :
          habits.map(h=>(
            <div key={h.id} className="wk-row">
              <div className="wk-lbl">
                <span style={{fontSize:15}}>{renderIcon(h.icon, 18)}</span>
                <span style={{fontSize:11,fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{h.name}</span>
              </div>
              {l7.map(d=>{
                const done=(logs[d]||[]).includes(h.id),isT=d===td;
                return <div key={d} className={`wk-cell${done?' done':''} click${isT?' tod-c':''}`}
                  style={done?{background:h.color+'22',color:h.color}:{}}
                  title={done?'Clique para desmarcar':'Clique para marcar'}
                  onClick={()=>onToggle(h.id,d)}>{done?'✓':''}</div>;
              })}
            </div>
          ))
        }
        <div className="wk-tip">Clique em qualquer dia para marcar ou desmarcar</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// HABITS — STATS
// ─────────────────────────────────────────────────────
function HabStats({ habits, logs, td }) {
  const l7=lastN(7), l28=lastN(28);
  if (!habits.length) return <div className="empty"><div className="empty-ico">◈</div><div className="empty-h">Sem dados ainda</div><div className="empty-s">Adicione hábitos para ver stats</div></div>;
  return (
    <div>
      <div className="heat-box fade">
        <div className="heat-ttl">ATIVIDADE — 28 DIAS</div>
        <div className="heat-grid">
          {['D','S','T','Q','Q','S','S'].map((d,i)=><div key={i} className="heat-dh">{d}</div>)}
          {l28.map(d=>{
            const done=(logs[d]||[]).length, t=habits.length, ratio=t>0?done/t:0;
            const bg=ratio===0?'rgba(255,255,255,0.03)':ratio<.34?'#5BA89620':ratio<.67?'#5BA89645':ratio<1?'#5BA89670':'#5BA896';
            return <div key={d} className={`heat-c${d===td?' tod':''}`} style={{background:bg}} title={`${d}: ${done}/${t}`}/>;
          })}
        </div>
        <div className="heat-leg">
          MENOS {['rgba(255,255,255,0.03)','#5BA89620','#5BA89645','#5BA89670','#5BA896'].map((c,i)=><div key={i} className="heat-sq" style={{background:c}}/>)} MAIS
        </div>
      </div>
      <div className="bento g2 stagger">
        {habits.map(h=>{
          const s=calcStreak(logs,h.id), t=calcTotal(logs,h.id), w7=l7.filter(d=>(logs[d]||[]).includes(h.id)).length;
          return (
            <div key={h.id} className="stat-card">
              <div className="stat-hdr">
                <div className="stat-ico" style={{borderColor:h.color+'40',background:h.color+'12'}}>{renderIcon(h.icon,16)}</div>
                <div className="stat-hname">{h.name}</div>
              </div>
              <div className="stat-nums">
                {[{l:'SEQUÊNCIA',v:s+'🔥',c:h.color},{l:'SEMANA',v:`${w7}/7`,c:'#4488FF'},{l:'TOTAL',v:t,c:'#AA66FF'}].map(({l,v,c})=>(
                  <div key={l} className="stat-n"><div className="stat-v" style={{color:c}}>{v}</div><div className="stat-l">{l}</div></div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ICON PICKER
// ─────────────────────────────────────────────────────
function IconPicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const isCustom = value && value.startsWith('data:');

  const categories = ['Todos', ...ICON_CATEGORIES.map(c => c.label)];

  const filtered = search.trim()
    ? ALL_ICONS.filter(ic => ic.includes(search))
    : activeCategory === 'Todos'
      ? ALL_ICONS
      : ICON_CATEGORIES.find(c => c.label === activeCategory)?.icons || [];

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Imagem muito grande. Use uma menor que 500KB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="icon-picker">
      {/* Search + Upload row */}
      <div className="icon-picker-top">
        <input
          className="icon-search"
          placeholder="🔍  Buscar ícone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label className="icon-upload-btn" title="Fazer upload de imagem">
          <input type="file" accept="image/*" style={{display:'none'}} onChange={handleUpload}/>
          📁 Upload
        </label>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="icon-cats">
          {categories.map(cat => (
            <button key={cat}
              className={`icon-cat-btn${activeCategory===cat?' active':''}`}
              onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Custom image preview */}
      {isCustom && (
        <div className="icon-custom-preview">
          <img src={value} alt="ícone personalizado" className="icon-custom-img"/>
          <span className="icon-custom-label">Ícone personalizado</span>
          <button className="icon-custom-remove" onClick={() => onChange('🌅')}>✕</button>
        </div>
      )}

      {/* Icon grid */}
      <div className="icon-grid-scroll">
        <div className="icon-grid">
          {filtered.map((ic, i) => (
            <button key={i}
              className={`icon-btn${value===ic?' sel':''}`}
              onClick={() => onChange(ic)}>
              {ic}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{gridColumn:'1/-1',textAlign:'center',padding:'24px 0',color:'var(--t3)',fontFamily:'var(--fm)',fontSize:'11px',letterSpacing:'.1em'}}>
              NENHUM ÍCONE ENCONTRADO
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// HABITS — MANAGE
// ─────────────────────────────────────────────────────
function HabManage({ habits, logs, editId, setEditId, onDelete, showAdd, setShowAdd, nHName, setNHName, nHIcon, setNHIcon, nHColor, setNHColor, onAdd, saving }) {
  const renderIcon = (icon) => {
    if (icon?.startsWith('data:')) return <img src={icon} alt="" style={{width:20,height:20,borderRadius:4,objectFit:'cover'}}/>;
    return icon;
  };
  return (
    <div className="stagger">
      {habits.map(h=>{
        const isE=editId===h.id, s=calcStreak(logs,h.id), t=calcTotal(logs,h.id);
        return (
          <div key={h.id} className="mgr">
            <div className="mgr-bar" style={{background:h.color}}/>
            <div className="mgr-ico">{renderIcon(h.icon)}</div>
            <div className="mgr-body">
              <div className="mgr-name">{h.name}</div>
              <div className="mgr-sub">{s} dia{s!==1?'s':''} seguidos · {t} total</div>
            </div>
            {isE ? <>
              <button className="btn-xc" onClick={()=>setEditId(null)}>CANCELAR</button>
              <button className="btn-del" onClick={()=>onDelete(h.id)}>EXCLUIR</button>
            </> : <button className="btn-dots" onClick={()=>setEditId(isE?null:h.id)}>···</button>}
          </div>
        );
      })}
      {!showAdd ? (
        <button className="btn-add-new" onClick={()=>setShowAdd(true)}>+ NOVO HÁBITO</button>
      ) : (
        <div className="add-form fade">
          <div className="add-form-h"><div className="acc-dot"/>Novo Hábito</div>
          <label className="flabel">NOME</label>
          <input className="finput" placeholder="Ex: Meditar 10 minutos..." value={nHName} onChange={e=>setNHName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onAdd()} autoFocus/>
          <label className="flabel">ÍCONE</label>
          <IconPicker value={nHIcon} onChange={setNHIcon}/>
          <label className="flabel" style={{marginTop:16}}>COR</label>
          <div className="col-grid">{HCOLS.map(c=><button key={c} className={`col-btn${nHColor===c?' sel':''}`} style={{background:c}} onClick={()=>setNHColor(c)}/>)}</div>
          <div className="form-btns">
            <button className="btn-save" onClick={onAdd} disabled={saving}>{saving?'Salvando...':'CRIAR HÁBITO'}</button>
            <button className="btn-cancel" onClick={()=>setShowAdd(false)}>CANCELAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// KANBAN PAGE
// ─────────────────────────────────────────────────────
function KanbanPage({ tasks, kbCols, kbTags, onNewTask, onEditTask, onDeleteTask, onMoveTask, dragId, onOpenSettings }) {
  const tot=tasks.length;
  return (
    <div className="fade">
      <div className="kb-toolbar">
        <div className="kb-meta">{tot} TAREFA{tot!==1?'S':''}</div>
        <div className="kb-toolbar-btns">
          <button className="btn-settings" onClick={onOpenSettings}>⚙ CONFIGURAR</button>
          <button className="btn-new-task" onClick={()=>onNewTask()}>+ NOVA TAREFA</button>
        </div>
      </div>
      <div className="kb-board-scroll">
        <div className="kb-board" style={{gridTemplateColumns:`repeat(${kbCols.length},280px)`}}>
          {kbCols.map(col=>(
            <KbCol key={col.id} col={col} tasks={tasks.filter(t=>t.col_id===col.id)} kbCols={kbCols} kbTags={kbTags}
              onNewTask={onNewTask} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onMoveTask={onMoveTask} dragId={dragId}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function KbCol({ col, tasks, kbCols, kbTags, onNewTask, onEditTask, onDeleteTask, onMoveTask, dragId }) {
  const [over, setOver] = useState(false);
  return (
    <div className="kb-col">
      <div className="kb-col-head">
        <div className="kb-col-title">{col.label}</div>
        <div className="kb-col-count">{tasks.length}</div>
      </div>
      <div className={`kb-cards${over?' drag-over':''}`}
        onDragOver={e=>{e.preventDefault();setOver(true);}}
        onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOver(false);}}
        onDrop={e=>{e.preventDefault();setOver(false);const id=e.dataTransfer.getData('tid');if(id)onMoveTask(id,col.id);}}>
        {tasks.map(t=>(
          <TaskCard key={t.id} task={t} kbCols={kbCols} kbTags={kbTags}
            onEdit={onEditTask} onDelete={onDeleteTask} onMove={onMoveTask} dragId={dragId}/>
        ))}
      </div>
      <button className="kb-add-btn" onClick={()=>onNewTask(col.id)}>+ Adicionar</button>
    </div>
  );
}

function TaskCard({ task, kbCols, kbTags, onEdit, onDelete, onMove, dragId }) {
  const [dragging, setDragging] = useState(false);
  const colIdx = kbCols.findIndex(c=>c.id===task.col_id);
  return (
    <div className={`tc${dragging?' dragging':''}`}
      draggable onDragStart={e=>{e.dataTransfer.setData('tid',task.id);setDragging(true);dragId.current=task.id;}}
      onDragEnd={()=>{setDragging(false);dragId.current=null;}}>
      <div className="tc-title">{task.title}</div>
      {task.tags?.length>0 && (
        <div className="tc-tags">
          {task.tags.map(tid=>{const t=kbTags.find(x=>x.id===tid);return t?<div key={tid} className="tc-tag" style={{background:t.color+'18',color:t.color}}>{t.label}</div>:null;})}
        </div>
      )}
      {task.description && <div className="tc-desc">{task.description}</div>}
      {task.reminder && (
        <div className={`tc-reminder${reminderPast(task.reminder)?' past':''}`}>
          {reminderPast(task.reminder)?'⏰':'🔔'} {fmtReminder(task.reminder)}
        </div>
      )}
      <div className="tc-foot">
        <div className="tc-actions">
          {colIdx>0 && <button className="tc-btn" title={'← '+kbCols[colIdx-1]?.label} onClick={e=>{e.stopPropagation();onMove(task.id,kbCols[colIdx-1].id);}}>←</button>}
          {colIdx<kbCols.length-1 && <button className="tc-btn" title={'→ '+kbCols[colIdx+1]?.label} onClick={e=>{e.stopPropagation();onMove(task.id,kbCols[colIdx+1].id);}}>→</button>}
          <button className="tc-btn" title="Editar" onClick={e=>{e.stopPropagation();onEdit(task.id);}}>✎</button>
          <button className="tc-btn danger" title="Excluir" onClick={e=>{e.stopPropagation();if(window.confirm('Excluir tarefa?'))onDelete(task.id);}}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// TASK MODAL
// ─────────────────────────────────────────────────────
function TaskModal({ editId, kbCols, kbTags, tTitle, setTTitle, tDesc, setTDesc, tCol, setTCol, tTags, setTTags, tReminder, setTReminder, onSave, saving, onClose }) {
  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal">
        <div className="modal-h"><div className="acc-dot"/>{editId?'Editar Tarefa':'Nova Tarefa'}</div>
        <label className="mlabel" style={{marginTop:0}}>TÍTULO</label>
        <input className="minput" placeholder="Descreva a tarefa..." value={tTitle} onChange={e=>setTTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&onSave()} autoFocus/>
        <label className="mlabel">DESCRIÇÃO</label>
        <textarea className="minput" placeholder="Detalhes opcionais..." value={tDesc} onChange={e=>setTDesc(e.target.value)}/>
        <label className="mlabel">COLUNA</label>
        <select className="mselect" value={tCol} onChange={e=>setTCol(e.target.value)}>
          {kbCols.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {kbTags.length>0 && <>
          <label className="mlabel">ETIQUETAS</label>
          <div className="tag-grid">
            {kbTags.map(t=>{
              const sel=tTags.includes(t.id);
              return <button key={t.id} className="tag-opt"
                style={{background:sel?t.color+'18':'transparent',borderColor:sel?t.color:t.color+'40',color:sel?t.color:'var(--t3)'}}
                onClick={()=>setTTags(sel?tTags.filter(x=>x!==t.id):[...tTags,t.id])}>{t.label}</button>;
            })}
          </div>
        </>}
        <label className="mlabel">LEMBRETE</label>
        <div className="reminder-row">
          <input className="minput" type="datetime-local" value={tReminder} onChange={e=>setTReminder(e.target.value)} style={{colorScheme:'dark',flex:1}}/>
          {tReminder && <button className="btn-cancel" style={{padding:'10px 12px',flexShrink:0}} onClick={()=>setTReminder('')} title="Remover lembrete">✕</button>}
        </div>
        {tReminder && <div style={{fontFamily:'var(--fm)',fontSize:'10px',color:'var(--blue)',marginTop:6,letterSpacing:'.04em'}}>🔔 {fmtReminder(tReminder)}</div>}
        <div className="modal-btns">
          <button className="modal-save" onClick={onSave} disabled={saving}>{saving?'Salvando...':(editId?'SALVAR':'CRIAR TAREFA')}</button>
          <button className="modal-close" onClick={onClose}>CANCELAR</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// SETTINGS MODAL
// ─────────────────────────────────────────────────────
function SettingsModal({ kbCols, kbTags, onAddCol, onDeleteCol, onUpdateCol, onReorderCol, onAddTag, onDeleteTag, onUpdateTag, newColName, setNewColName, newColColor, setNewColColor, newTagName, setNewTagName, newTagColor, setNewTagColor, pickingColorFor, setPickingColorFor, onClose }) {
  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal">
        <div className="modal-h"><div className="acc-dot"/>Configurações do Kanban</div>

        {/* COLUMNS */}
        <div className="settings-section">
          <div className="settings-section-title">COLUNAS</div>
          {kbCols.map((col, idx)=>(
            <div key={col.id} className="set-item">
              <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>
                <button className="reorder-btn" onClick={()=>onReorderCol(col.id,-1)} disabled={idx===0} title="Mover para cima">▲</button>
                <button className="reorder-btn" onClick={()=>onReorderCol(col.id,1)} disabled={idx===kbCols.length-1} title="Mover para baixo">▼</button>
              </div>
              <input className="set-item-input" value={col.label} onChange={e=>onUpdateCol(col.id,{label:e.target.value})}/>
              <button className="set-del" onClick={()=>{if(kbCols.length<=1){alert('Mínimo 1 coluna.');return;}if(window.confirm(`Excluir "${col.label}"?`))onDeleteCol(col.id);}}>✕</button>
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:4,alignItems:'center'}}>
            <input className="minput" placeholder="Nova coluna..." value={newColName} onChange={e=>setNewColName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onAddCol()} style={{flex:1,padding:'8px 12px',fontSize:13}}/>
            <button className="btn-save" style={{flex:'0 0 36px',padding:8,minWidth:36}} onClick={onAddCol}>+</button>
          </div>
        </div>

        {/* TAGS */}
        <div className="settings-section">
          <div className="settings-section-title">ETIQUETAS</div>
          {kbTags.map(tag=>(
            <div key={tag.id}>
              <div className="set-item">
                <div className="set-color-dot" style={{background:tag.color}} onClick={()=>setPickingColorFor(pickingColorFor?.id===tag.id?null:{type:'tag',id:tag.id})}/>
                <input className="set-item-input" value={tag.label} onChange={e=>onUpdateTag(tag.id,{label:e.target.value})}/>
                <button className="set-del" onClick={()=>{if(window.confirm(`Excluir "${tag.label}"?`))onDeleteTag(tag.id);}}>✕</button>
              </div>
              {pickingColorFor?.id===tag.id && (
                <div className="color-swatch-row">
                  {PALETTE.map(c=><div key={c} className={`color-swatch${tag.color===c?' sel':''}`} style={{background:c}} onClick={()=>{onUpdateTag(tag.id,{color:c});setPickingColorFor(null);}}/>)}
                </div>
              )}
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:4,alignItems:'center'}}>
            <div className="set-color-dot" style={{background:newTagColor,width:20,height:20,borderRadius:5,flexShrink:0}} onClick={()=>setPickingColorFor(pickingColorFor?.id==='newtag'?null:{type:'newtag',id:'newtag'})}/>
            <input className="minput" placeholder="Nova etiqueta..." value={newTagName} onChange={e=>setNewTagName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onAddTag()} style={{flex:1,padding:'8px 12px',fontSize:13}}/>
            <button className="btn-save" style={{flex:'0 0 36px',padding:8,minWidth:36}} onClick={onAddTag}>+</button>
          </div>
          {pickingColorFor?.id==='newtag' && (
            <div className="color-swatch-row">
              {PALETTE.map(c=><div key={c} className={`color-swatch${newTagColor===c?' sel':''}`} style={{background:c}} onClick={()=>{setNewTagColor(c);setPickingColorFor(null);}}/>)}
            </div>
          )}
        </div>

        <div className="modal-btns">
          <button className="modal-save" onClick={onClose}>FECHAR</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// JOURNAL PAGE
// ─────────────────────────────────────────────────────
const MOODS = [
  { id: 'great',  emoji: '😄', label: 'Ótimo'    },
  { id: 'good',   emoji: '🙂', label: 'Bem'       },
  { id: 'meh',    emoji: '😐', label: 'Neutro'    },
  { id: 'bad',    emoji: '😔', label: 'Mal'       },
  { id: 'awful',  emoji: '😞', label: 'Péssimo'   },
];

const JTAGS = ['Trabalho','Pessoal','Saúde','Família','Reflexão','Gratidão','Planos','Sonhos','Aprendizado','Outros'];

const fmtEntryDate = iso => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
};

const fmtEntryShort = iso => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
};

const groupByMonth = entries => {
  const groups = {};
  entries.forEach(e => {
    const [y, m] = e.entry_date.split('-');
    const key = `${y}-${m}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return groups;
};

const monthLabel = key => {
  const [y, m] = key.split('-');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${months[parseInt(m)-1]} ${y}`;
};

function JournalPage({ entries, onSave, onDelete }) {
  const [selectedId, setSelectedId]   = useState(null);
  const [isNew,      setIsNew]        = useState(false);
  const [search,     setSearch]       = useState('');
  const [filterMood, setFilterMood]   = useState(null);
  // Editor state
  const [eTitle,  setETitle]  = useState('');
  const [eBody,   setEBody]   = useState('');
  const [eMood,   setEMood]   = useState('good');
  const [eTags,   setETags]   = useState([]);
  const [eDate,   setEDate]   = useState(todayKey());
  const [eImage,  setEImage]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);
  const textRef = useRef(null);

  const selected = entries.find(e => e.id === selectedId);

  // On this day: entries from same month/day in previous years
  const today = todayKey();
  const [todayM, todayD] = today.split('-').slice(1);
  const onThisDay = entries.filter(e => {
    const [,m,d] = e.entry_date.split('-');
    return m === todayM && d === todayD && e.entry_date !== today;
  });

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.title?.toLowerCase().includes(search.toLowerCase()) || e.body?.toLowerCase().includes(search.toLowerCase());
    const matchMood = !filterMood || e.mood === filterMood;
    return matchSearch && matchMood;
  });

  const grouped = groupByMonth(filtered);

  const openEntry = e => {
    setSelectedId(e.id); setIsNew(false);
    setETitle(e.title||''); setEBody(e.body||'');
    setEMood(e.mood||'good'); setETags(e.tags||[]);
    setEDate(e.entry_date); setEImage(e.image_url||null); setDirty(false);
  };

  const newEntry = () => {
    setSelectedId(null); setIsNew(true);
    setETitle(''); setEBody('');
    setEMood('good'); setETags([]);
    setEDate(todayKey()); setEImage(null); setDirty(false);
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const save = async () => {
    if (!eBody.trim() && !eTitle.trim()) return;
    setSaving(true);
    try {
      const payload = {
        id: isNew ? null : selectedId,
        title: eTitle, body: eBody,
        mood: eMood, tags: eTags,
        entry_date: eDate,
        image_url: eImage || null,
      };
      // If image is large, try without it first then update image separately
      let result = await onSave(payload);
      if (!result && eImage) {
        // Retry without image (may be too large for single request)
        result = await onSave({ ...payload, image_url: null });
      }
      if (result) { setSelectedId(result.id); setIsNew(false); }
    } catch(e) {
      console.error('Save error:', e);
    }
    setDirty(false); setSaving(false);
  };

  const del = async () => {
    if (!window.confirm('Excluir esta entrada?')) return;
    await onDelete(selectedId);
    setSelectedId(null); setIsNew(false);
  };

  const isDesktop = window.innerWidth >= 860;
  const showEditor = isNew || selectedId;

  return (
    <div className="journal-layout">
      {/* ── LEFT: entries list ── */}
      {(!showEditor || isDesktop) && (
        <div className="journal-list">
          {/* Search + new */}
          <div className="journal-list-top">
            <input className="journal-search" placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <button className="journal-new-btn" onClick={newEntry}>+ Nova</button>
          </div>
          {/* Mood filter */}
          <div className="journal-mood-filter">
            {MOODS.map(m => (
              <button key={m.id}
                className={`journal-mood-chip${filterMood===m.id?' active':''}`}
                onClick={() => setFilterMood(filterMood===m.id?null:m.id)}
                title={m.label}>
                {m.emoji}
              </button>
            ))}
          </div>
          {/* On this day */}
          {onThisDay.length > 0 && !search && !filterMood && (
            <div className="journal-otd">
              <div className="journal-otd-label">✦ Neste dia</div>
              {onThisDay.map(e => (
                <button key={e.id} className={`journal-otd-item${selectedId===e.id?' active':''}`} onClick={()=>openEntry(e)}>
                  <span className="journal-otd-year">{e.entry_date.split('-')[0]}</span>
                  <span className="journal-otd-title">{e.title || e.body?.slice(0,40) || 'Entrada sem título'}</span>
                </button>
              ))}
            </div>
          )}
          {/* Entry list grouped by month */}
          <div className="journal-list-scroll">
          {Object.keys(grouped).length === 0 ? (
            <div className="empty" style={{paddingTop:40}}>
              <div className="empty-ico">📖</div>
              <div className="empty-h">{search||filterMood?'Nenhuma entrada encontrada':'Nenhuma entrada ainda'}</div>
              <div className="empty-s">{!search&&!filterMood&&'Clique em "+ Nova" para começar'}</div>
            </div>
          ) : Object.keys(grouped).map(month => (
            <div key={month} className="journal-month-group">
              <div className="journal-month-label">{monthLabel(month)}</div>
              {grouped[month].map(e => {
                const mood = MOODS.find(m => m.id === e.mood);
                return (
                  <button key={e.id} className={`journal-entry-item${selectedId===e.id?' active':''}`} onClick={()=>openEntry(e)}>
                    <div className="journal-entry-item-top">
                      <span className="journal-entry-date">{fmtEntryShort(e.entry_date)}</span>
                      {mood && <span className="journal-entry-mood">{mood.emoji}</span>}
                    </div>
                    <div className="journal-entry-item-body">
                      <div className="journal-entry-text">
                        <div className="journal-entry-title">{e.title || 'Sem título'}</div>
                        <div className="journal-entry-preview">{e.body?.slice(0,80) || '—'}</div>
                      </div>
                      {e.image_url && (
                        <div className="journal-entry-thumb-wrap">
                          <img src={e.image_url} alt="" className="journal-entry-thumb"/>
                        </div>
                      )}
                    </div>
                    {e.tags?.length > 0 && (
                      <div className="journal-entry-tags">
                        {e.tags.slice(0,3).map(t => <span key={t} className="journal-entry-tag">{t}</span>)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          </div>
        </div>
      )}

      {/* ── RIGHT: editor ── */}
      {showEditor ? (
        <div className="journal-editor">
          {/* Editor header */}
          <div className="journal-editor-header">
            {!isDesktop && (
              <button className="journal-back-btn" onClick={()=>{setSelectedId(null);setIsNew(false);}}>← Voltar</button>
            )}
            <input type="date" className="journal-date-input" value={eDate} onChange={e=>{setEDate(e.target.value);setDirty(true);}}
              disabled={!isNew} style={!isNew?{opacity:.5,cursor:'default'}:{}}/>
            <div className="journal-editor-actions">
              {(selectedId||isNew) && !isNew && (
                <button className="journal-del-btn" onClick={del} title="Excluir entrada">🗑</button>
              )}
              <button className="journal-save-btn" onClick={save} disabled={saving||(!dirty&&!isNew)}>
                {saving ? '...' : dirty||isNew ? 'Salvar' : 'Salvo ✓'}
              </button>
            </div>
          </div>
          {/* Mood picker */}
          <div className="journal-mood-row">
            <span className="journal-mood-label">Como você está?</span>
            {MOODS.map(m => (
              <button key={m.id} className={`journal-mood-opt${eMood===m.id?' active':''}`}
                onClick={()=>{setEMood(m.id);setDirty(true);}}>
                <span className="journal-mood-emoji">{m.emoji}</span>
                <span className="journal-mood-name">{m.label}</span>
              </button>
            ))}
          </div>
          {/* Title */}
          <input
            className="journal-title-input"
            placeholder="Título (opcional)..."
            value={eTitle}
            onChange={e=>{setETitle(e.target.value);setDirty(true);}}
          />
          {/* Body */}
          <textarea
            ref={textRef}
            className="journal-body-input"
            placeholder="O que está na sua mente hoje?

Escreva livremente. Este é o seu espaço..."
            value={eBody}
            onChange={e=>{setEBody(e.target.value);setDirty(true);}}
          />
          {/* Image */}
          <div className="journal-image-section">
            {eImage ? (
              <div className="journal-image-preview-wrap">
                <img src={eImage} alt="Imagem da entrada" className="journal-image-preview"/>
                <button className="journal-image-remove" onClick={()=>{setEImage(null);setDirty(true);}} title="Remover imagem">✕</button>
              </div>
            ) : (
              <label className="journal-image-upload">
                <input type="file" accept="image/*" style={{display:'none'}} onChange={ev=>{
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande. Use menos de 2MB.'); return; }
                  const reader = new FileReader();
                  reader.onload = e => { setEImage(e.target.result); setDirty(true); };
                  reader.readAsDataURL(file);
                }}/>
                <span className="journal-image-upload-ico">🖼</span>
                <span className="journal-image-upload-label">Adicionar imagem</span>
              </label>
            )}
          </div>
          {/* Tags */}
          <div className="journal-tags-section">
            <div className="journal-tags-label">ETIQUETAS</div>
            <div className="journal-tags-grid">
              {JTAGS.map(t => {
                const sel = eTags.includes(t);
                return (
                  <button key={t} className={`journal-tag-btn${sel?' active':''}`}
                    onClick={()=>{setETags(sel?eTags.filter(x=>x!==t):[...eTags,t]);setDirty(true);}}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Word count */}
          <div className="journal-wordcount">
            {eBody.trim() ? `${eBody.trim().split(/\s+/).length} palavras · ${eBody.length} caracteres` : ''}
          </div>
        </div>
      ) : (
        isDesktop && (
          <div className="journal-empty-editor">
            <div style={{fontSize:48,marginBottom:16}}>📖</div>
            <div style={{fontFamily:'var(--fm)',fontSize:12,color:'var(--t3)',letterSpacing:'.12em',textAlign:'center'}}>
              SELECIONE UMA ENTRADA<br/>OU CRIE UMA NOVA
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// ROUTINE PAGE
// ─────────────────────────────────────────────────────
const DAYS_FULL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const BLOCK_COLORS = ['#5BA896','#4A7FAA','#7A6FAA','#AA6F7A','#AA8F4A','#6FAA6F','#AA6F4A','#4A9AAA'];
// Reuse full icon library from habits
const BLOCK_ICONS = ALL_ICONS;

function timeToMin(t) {
  const [h,m] = t.split(':').map(Number);
  return h*60+m;
}
function minToTime(m) {
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
function fmtTime(t) {
  const [h,m] = t.split(':').map(Number);
  return `${h}:${String(m).padStart(2,'0')}`;
}
function fmtDuration(min) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min/60), m = min%60;
  return m ? `${h}h${m}min` : `${h}h`;
}

function RoutinePage({ routines, blocks, logs, onAddRoutine, onUpdateRoutine, onDeleteRoutine, onAddBlock, onUpdateBlock, onDeleteBlock, onToggleBlock }) {
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [showNewRoutine, setShowNewRoutine] = useState(false);
  const [showNewBlock, setShowNewBlock]     = useState(false);
  const [editBlockId, setEditBlockId]       = useState(null);
  const [showManage, setShowManage]         = useState(false);

  // New routine form
  const [nrName,  setNrName]  = useState('');
  const [nrColor, setNrColor] = useState('#5BA896');
  const [nrDays,  setNrDays]  = useState([1,2,3,4,5]);

  // Block form
  const [bTitle,    setBTitle]    = useState('');
  const [bIcon,     setBIcon]     = useState('⏰');
  const [bStart,    setBStart]    = useState('07:00');
  const [bEnd,      setBEnd]      = useState('07:30');
  const [bColor,    setBColor]    = useState('#5BA896');

  // Computed duration from start/end
  const bDurationCalc = () => {
    const s = timeToMin(bStart), e = timeToMin(bEnd);
    const diff = e > s ? e - s : (24*60 - s + e); // handle overnight
    return Math.max(5, diff);
  };

  const td = todayKey();
  const todayDow = new Date().getDay();

  useEffect(() => {
    if (!activeRoutine && routines.length > 0) {
      const todayR = routines.find(r => (r.days||[]).includes(todayDow));
      setActiveRoutine(todayR?.id || routines[0].id);
    }
  }, [routines]);

  const currentRoutine = routines.find(r => r.id === activeRoutine);
  const currentBlocks  = blocks.filter(b => b.routine_id === activeRoutine)
    .sort((a,b) => timeToMin(a.start_time) - timeToMin(b.start_time));

  const doneBlocks   = currentBlocks.filter(b => (logs[td]||[]).includes(b.id));
  const progress     = currentBlocks.length > 0 ? Math.round(doneBlocks.length / currentBlocks.length * 100) : 0;

  const nowMin = new Date().getHours()*60 + new Date().getMinutes();
  // Only show "Agora" if today is an active day for this routine
  const routineActiveToday = (currentRoutine?.days||[]).includes(todayDow);
  const nowBlock = routineActiveToday ? currentBlocks.find(b => {
    const start = timeToMin(b.start_time);
    return nowMin >= start && nowMin < start + b.duration;
  }) : null;

  const saveRoutine = async () => {
    if (!nrName.trim()) return;
    await onAddRoutine(nrName.trim(), nrColor, nrDays);
    setNrName(''); setNrColor('#5BA896'); setNrDays([1,2,3,4,5]);
    setShowNewRoutine(false);
  };

  const saveBlock = async () => {
    if (!bTitle.trim()) return;
    const duration = bDurationCalc();
    const payload = { title:bTitle, icon:bIcon, start_time:bStart, duration, color:bColor };
    if (editBlockId) {
      await onUpdateBlock(editBlockId, payload);
      setEditBlockId(null);
    } else {
      await onAddBlock(activeRoutine, payload);
    }
    setBTitle(''); setBIcon('⏰'); setBStart('07:00'); setBEnd('07:30'); setBColor('#5BA896');
    setShowNewBlock(false);
  };

  const openEditBlock = b => {
    setEditBlockId(b.id); setBTitle(b.title); setBIcon(b.icon||'⏰');
    setBStart(b.start_time);
    setBEnd(minToTime(timeToMin(b.start_time) + b.duration));
    setBColor(b.color||'#5BA896');
    setShowNewBlock(true);
  };

  const openNewBlock = () => {
    setEditBlockId(null); setBTitle(''); setBIcon('⏰');
    const lastStart = currentBlocks.length > 0
      ? minToTime(timeToMin(currentBlocks[currentBlocks.length-1].start_time) + currentBlocks[currentBlocks.length-1].duration)
      : '07:00';
    const lastEnd = minToTime(timeToMin(lastStart) + 30);
    setBStart(lastStart); setBEnd(lastEnd);
    setBColor(currentRoutine?.color || '#5BA896');
    setShowNewBlock(true);
  };

  return (
    <div className="routine-page">
      {/* ── ROUTINE TABS ── */}
      <div className="routine-tabs-row">
        <div className="routine-tabs">
          {routines.map(r => (
            <div key={r.id} className={`routine-tab-wrap${activeRoutine===r.id?' active':''}`}>
              <button
                className={`routine-tab${activeRoutine===r.id?' active':''}`}
                style={activeRoutine===r.id ? {'--rt-color': r.color} : {}}
                onClick={()=>setActiveRoutine(r.id)}>
                <span className="routine-tab-dot" style={{background: r.color}}/>
                {r.name}
                {(r.days||[]).includes(todayDow) && <span className="routine-tab-today">HOJE</span>}
              </button>
              {activeRoutine===r.id && (
                <button className="routine-tab-edit" onClick={()=>setShowManage(true)} title="Editar rotina">✎</button>
              )}
            </div>
          ))}
          <button className="routine-tab-add" onClick={()=>setShowNewRoutine(true)}>+ Nova</button>
        </div>
      </div>

      {!currentRoutine ? (
        <div className="empty fade" style={{paddingTop:60}}>
          <div className="empty-ico">◷</div>
          <div className="empty-h">Nenhuma rotina criada</div>
          <div className="empty-s">Clique em "+ Nova" para começar</div>
        </div>
      ) : (
        <>
          {/* ── PROGRESS CARD ── */}
          <div className="routine-progress-card fade">
            <div className="routine-progress-info">
              <div className="routine-progress-title">
                {!routineActiveToday
                  ? `${currentRoutine.name} — não é hoje`
                  : progress===100
                    ? '🎉 Rotina concluída!'
                    : nowBlock
                      ? `Agora: ${nowBlock.icon} ${nowBlock.title}`
                      : currentRoutine.name}
              </div>
              <div className="routine-progress-sub">
                {doneBlocks.length}/{currentBlocks.length} concluídos · {progress}%
              </div>
            </div>
            <div className="routine-progress-bar-wrap">
              <div className="routine-progress-bar-bg">
                <div className="routine-progress-bar-fg" style={{width:`${progress}%`, background: currentRoutine.color}}/>
              </div>
              <div className="routine-days-row">
                {DAYS_FULL.map((d,i) => (
                  <div key={i} className={`routine-day-dot${(currentRoutine.days||[]).includes(i)?' active':''}${i===todayDow?' today':''}`}
                    style={(currentRoutine.days||[]).includes(i)?{background:currentRoutine.color}:{}}>
                    {d.slice(0,1)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── TIMELINE ── */}
          <div className="routine-timeline fade">
            {currentBlocks.length === 0 ? (
              <div className="routine-empty-blocks">
                <div style={{fontSize:32,marginBottom:8}}>⏱</div>
                <div style={{fontFamily:'var(--fm)',fontSize:11,color:'var(--t3)',letterSpacing:'.1em'}}>NENHUM BLOCO ADICIONADO</div>
              </div>
            ) : currentBlocks.map((b, i) => {
              const done  = (logs[td]||[]).includes(b.id);
              const isNow = nowBlock?.id === b.id;
              const endMin = timeToMin(b.start_time) + b.duration;
              return (
                <div key={b.id} className={`rt-block${done?' done':''}${isNow?' now':''}`}>
                  <div className="rt-time-col">
                    <div className="rt-start">{fmtTime(b.start_time)}</div>
                    {i < currentBlocks.length-1 && <div className="rt-line" style={{background:b.color+'40'}}/>}
                  </div>
                  <div className="rt-card" style={done?{borderColor:b.color+'50',background:b.color+'08'}:isNow?{borderColor:b.color+'80',boxShadow:`0 0 0 1px ${b.color}20`}:{}}>
                    {isNow && <div className="rt-now-badge">AGORA</div>}
                    <div className="rt-card-left">
                      <div className="rt-icon" style={{background:b.color+'18',border:`1px solid ${b.color}30`}}>{b.icon||'⏰'}</div>
                      <div className="rt-info">
                        <div className="rt-title" style={done?{color:b.color}:{}}>{b.title}</div>
                        <div className="rt-meta">{fmtTime(b.start_time)} → {fmtTime(minToTime(endMin))} · {fmtDuration(b.duration)}</div>
                      </div>
                    </div>
                    <div className="rt-card-right">
                      <button className="rt-edit-btn" onClick={()=>openEditBlock(b)} title="Editar">✎</button>
                      <button className={`rt-check${done?' done':''}`}
                        style={done?{background:b.color,borderColor:b.color}:{}}
                        onClick={()=>onToggleBlock(b.id)}>
                        {done?'✓':''}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="rt-add-block" onClick={openNewBlock}>+ Adicionar bloco</button>
          </div>
        </>
      )}

      {/* ── NEW ROUTINE MODAL ── */}
      {showNewRoutine && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setShowNewRoutine(false);}}>
          <div className="modal">
            <div className="modal-h"><div className="acc-dot"/>Nova Rotina</div>
            <label className="mlabel" style={{marginTop:0}}>NOME</label>
            <input className="minput" placeholder="Ex: Manhã, Noturna, Fim de semana..." value={nrName} onChange={e=>setNrName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveRoutine()} autoFocus/>
            <label className="mlabel">COR</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:4}}>
              {BLOCK_COLORS.map(c=><button key={c} style={{width:26,height:26,borderRadius:5,background:c,border:`2px solid ${nrColor===c?'var(--t1)':'transparent'}`,cursor:'pointer',transition:'all .12s'}} onClick={()=>setNrColor(c)}/>)}
            </div>
            <label className="mlabel">DIAS ATIVOS</label>
            <div style={{display:'flex',gap:6,marginBottom:4}}>
              {DAYS_FULL.map((d,i)=>(
                <button key={i} style={{width:34,height:34,borderRadius:'50%',border:`1px solid ${nrDays.includes(i)?nrColor:'var(--b2)'}`,background:nrDays.includes(i)?nrColor+'20':'transparent',color:nrDays.includes(i)?nrColor:'var(--t3)',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s',fontFamily:'var(--fm)'}}
                  onClick={()=>setNrDays(nrDays.includes(i)?nrDays.filter(x=>x!==i):[...nrDays,i])}>
                  {d.slice(0,1)}
                </button>
              ))}
            </div>
            <div className="modal-btns">
              <button className="modal-save" onClick={saveRoutine}>CRIAR ROTINA</button>
              <button className="modal-close" onClick={()=>setShowNewRoutine(false)}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BLOCK MODAL ── */}
      {showNewBlock && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setShowNewBlock(false);setEditBlockId(null);}}}>
          <div className="modal">
            <div className="modal-h"><div className="acc-dot"/>{editBlockId?'Editar Bloco':'Novo Bloco'}</div>
            <label className="mlabel" style={{marginTop:0}}>ATIVIDADE</label>
            <input className="minput" placeholder="Ex: Meditação, Café, Exercício..." value={bTitle} onChange={e=>setBTitle(e.target.value)} autoFocus/>
            <label className="mlabel">ÍCONE</label>
            <IconPicker value={bIcon} onChange={setBIcon}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:4}}>
              <div>
                <label className="mlabel">INÍCIO</label>
                <input className="minput" type="time" value={bStart}
                  onChange={e=>{setBStart(e.target.value);}}
                  style={{colorScheme:'dark'}}/>
              </div>
              <div>
                <label className="mlabel">FIM</label>
                <input className="minput" type="time" value={bEnd}
                  onChange={e=>setBEnd(e.target.value)}
                  style={{colorScheme:'dark'}}/>
              </div>
            </div>
            {/* Duration preview */}
            {bStart && bEnd && (
              <div style={{fontFamily:'var(--fm)',fontSize:10,color:'var(--acc)',letterSpacing:'.08em',marginTop:6,marginBottom:4}}>
                ⏱ Duração: {fmtDuration(bDurationCalc())}
              </div>
            )}
            <label className="mlabel">COR</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:4}}>
              {BLOCK_COLORS.map(c=><button key={c} style={{width:26,height:26,borderRadius:5,background:c,border:`2px solid ${bColor===c?'var(--t1)':'transparent'}`,cursor:'pointer',transition:'all .12s'}} onClick={()=>setBColor(c)}/>)}
            </div>
            <div className="modal-btns">
              <button className="modal-save" onClick={saveBlock}>{editBlockId?'SALVAR':'ADICIONAR'}</button>
              {editBlockId && <button className="btn-del" style={{padding:'12px 14px'}} onClick={async()=>{await onDeleteBlock(editBlockId);setEditBlockId(null);setShowNewBlock(false);}}>EXCLUIR</button>}
              <button className="modal-close" onClick={()=>{setShowNewBlock(false);setEditBlockId(null);}}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANAGE ROUTINE MODAL ── */}
      {showManage && currentRoutine && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setShowManage(false);}}>
          <div className="modal">
            <div className="modal-h"><div className="acc-dot"/>Editar Rotina</div>
            <label className="mlabel" style={{marginTop:0}}>NOME</label>
            <input className="minput" value={currentRoutine.name} onChange={e=>onUpdateRoutine(currentRoutine.id,{name:e.target.value})}/>
            <label className="mlabel">COR</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:4}}>
              {BLOCK_COLORS.map(c=><button key={c} style={{width:26,height:26,borderRadius:5,background:c,border:`2px solid ${currentRoutine.color===c?'var(--t1)':'transparent'}`,cursor:'pointer',transition:'all .12s'}} onClick={()=>onUpdateRoutine(currentRoutine.id,{color:c})}/>)}
            </div>
            <label className="mlabel">DIAS ATIVOS</label>
            <div style={{display:'flex',gap:6,marginBottom:16}}>
              {DAYS_FULL.map((d,i)=>{
                const active=(currentRoutine.days||[]).includes(i);
                return <button key={i} style={{width:34,height:34,borderRadius:'50%',border:`1px solid ${active?currentRoutine.color:'var(--b2)'}`,background:active?currentRoutine.color+'20':'transparent',color:active?currentRoutine.color:'var(--t3)',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s',fontFamily:'var(--fm)'}}
                  onClick={()=>{const days=active?(currentRoutine.days||[]).filter(x=>x!==i):[...(currentRoutine.days||[]),i];onUpdateRoutine(currentRoutine.id,{days});}}>
                  {d.slice(0,1)}
                </button>;
              })}
            </div>
            <div className="modal-btns">
              <button className="modal-save" onClick={()=>setShowManage(false)}>FECHAR</button>
              <button className="btn-del" style={{padding:'12px 14px'}} onClick={async()=>{await onDeleteRoutine(currentRoutine.id);setActiveRoutine(null);setShowManage(false);}}>EXCLUIR ROTINA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────
// FINANCE PAGE
// ─────────────────────────────────────────────────────
const BANKS   = ['Itaú','Nubank','Bradesco','Santander','C6','Inter','PicPay','Caixa','BTG','XP','Outro'];
const METHODS = ['PIX','Débito','Crédito','Boleto','TED','Dinheiro'];
const TAGS_FIN = ['Moradia','Alimentação','Transporte','Saúde','Lazer','Educação','Assinaturas','Investimentos','Contas','Pessoal','Trabalho','Outro'];

const fmtBRL = v => {
  const n = parseFloat(v)||0;
  return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
};

const installmentLabel = (done, total) => {
  if (!total) return null;
  const left = total - done;
  return `${done}/${total} — ${left} restante${left!==1?'s':''}`;
};

// ── Donut Chart ──────────────────────────────────────
function FinDonut({ income, expenses }) {
  const size = 80, r = 32, c = 2*Math.PI*r;
  const total = income + expenses || 1;
  const incPct = income / total;
  const expPct = expenses / total;
  const incArc = c * incPct;
  const expArc = c * expPct;
  return (
    <div className="fin-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--b2)" strokeWidth="10"/>
        {expenses > 0 && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--red)" strokeWidth="10"
          strokeDasharray={`${expArc} ${c}`} strokeDashoffset={0} strokeLinecap="round"/>}
        {income > 0 && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--acc)" strokeWidth="10"
          strokeDasharray={`${incArc} ${c}`} strokeDashoffset={-expArc} strokeLinecap="round"/>}
      </svg>
      <div className="fin-donut-legend">
        <div className="fin-donut-leg-item"><span style={{background:'var(--acc)'}}/> Receitas</div>
        <div className="fin-donut-leg-item"><span style={{background:'var(--red)'}}/> Despesas</div>
      </div>
    </div>
  );
}

function FinancePage({ sheets, entries, onAddSheet, onUpdateSheet, onDeleteSheet, onAddEntry, onUpdateEntry, onDeleteEntry }) {
  const [activeSheet, setActiveSheet] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editEntryId, setEditEntryId]       = useState(null);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [editSheetId, setEditSheetId]       = useState(null);
  const [sheetName, setSheetName]           = useState('');
  const [sheetType, setSheetType]           = useState('expense');

  // Entry form state
  const [eName,    setEName]    = useState('');
  const [eAmount,  setEAmount]  = useState('');
  const [eTag,     setETag]     = useState('');
  const [eBank,    setEBank]    = useState('');
  const [eMethod,  setEMethod]  = useState('');
  const [eDueDay,  setEDueDay]  = useState('');
  const [eInstTotal, setEInstTotal] = useState('');
  const [eInstDone,  setEInstDone]  = useState('');
  const [eNotes,   setENotes]   = useState('');
  const [eLogoUrl, setELogoUrl] = useState(null);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!activeSheet && sheets.length > 0) setActiveSheet(sheets[0].id);
  }, [sheets]);

  const currentSheet   = sheets.find(s => s.id === activeSheet);
  const currentEntries = entries.filter(e => e.sheet_id === activeSheet)
    .sort((a,b) => a.position - b.position);

  // Summary stats
  const totalAll    = entries.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const totalSheet  = currentEntries.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const paidSheet   = currentEntries.filter(e=>e.paid).reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const unpaidSheet = totalSheet - paidSheet;

  // Income sheet total
  const incomeSheet  = sheets.find(s=>s.type==='income');
  const totalIncome  = entries.filter(e=>e.sheet_id===incomeSheet?.id).reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const expenseSheets = sheets.filter(s=>s.type!=='income');
  const totalExpenses = entries.filter(e=>expenseSheets.find(s=>s.id===e.sheet_id)).reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const balance = totalIncome - totalExpenses;

  const openNewEntry = () => {
    setEditEntryId(null); setEName(''); setEAmount(''); setETag('');
    setEBank(''); setEMethod(''); setEDueDay(''); setEInstTotal(''); setEInstDone(''); setENotes(''); setELogoUrl(null);
    setShowEntryModal(true);
  };
  const openEditEntry = e => {
    setEditEntryId(e.id); setEName(e.name); setEAmount(String(e.amount||''));
    setETag(e.tag||''); setEBank(e.bank||''); setEMethod(e.method||'');
    setEDueDay(String(e.due_day||'')); setEInstTotal(String(e.installments_total||''));
    setEInstDone(String(e.installments_done||'')); setENotes(e.notes||''); setELogoUrl(e.logo_url||null);
    setShowEntryModal(true);
  };
  const saveEntry = async () => {
    if (!eName.trim()) return;
    setSaving(true);
    const payload = {
      name: eName, amount: parseFloat(eAmount)||0, tag: eTag, bank: eBank,
      method: eMethod, due_day: parseInt(eDueDay)||null,
      installments_total: parseInt(eInstTotal)||null,
      installments_done: parseInt(eInstDone)||0,
      notes: eNotes, logo_url: eLogoUrl || null,
    };
    if (editEntryId) await onUpdateEntry(editEntryId, payload);
    else await onAddEntry(activeSheet, payload);
    setShowEntryModal(false); setEditEntryId(null); setSaving(false);
  };

  const saveSheet = async () => {
    if (!sheetName.trim()) return;
    if (editSheetId) await onUpdateSheet(editSheetId, { name: sheetName });
    else await onAddSheet(sheetName, sheetType);
    setShowSheetModal(false); setEditSheetId(null); setSheetName('');
  };

  return (
    <div className="finance-page">
      {/* ── SUMMARY BAR ── */}
      <div className="fin-summary-bar fade">
        <div className="fin-summary-card">
          <div className="fin-summary-label">RECEITAS</div>
          <div className="fin-summary-value income">{fmtBRL(totalIncome)}</div>
        </div>
        <div className="fin-summary-card">
          <div className="fin-summary-label">DESPESAS</div>
          <div className="fin-summary-value expense">{fmtBRL(totalExpenses)}</div>
        </div>
        <div className="fin-summary-card">
          <div className="fin-summary-label">SALDO</div>
          <div className={`fin-summary-value ${balance>=0?'income':'expense'}`}>{fmtBRL(balance)}</div>
        </div>
        <div className="fin-chart-card">
          <FinDonut income={totalIncome} expenses={totalExpenses}/>
        </div>
      </div>

      {/* ── SHEET TABS ── */}
      <div className="fin-tabs-row">
        <div className="fin-tabs">
          {sheets.map(s => (
            <button key={s.id}
              className={`fin-tab${activeSheet===s.id?' active':''} fin-tab-${s.type}`}
              onClick={()=>setActiveSheet(s.id)}
              onDoubleClick={()=>{setEditSheetId(s.id);setSheetName(s.name);setShowSheetModal(true);}}>
              {s.type==='income'?'↑':s.type==='fixed'?'↻':'↓'} {s.name}
            </button>
          ))}
          <button className="fin-tab-add" onClick={()=>{setEditSheetId(null);setSheetName('');setSheetType('expense');setShowSheetModal(true);}}>+ Nova</button>
        </div>
        <button className="fin-add-btn" onClick={openNewEntry}>+ Entrada</button>
      </div>

      {/* ── TABLE ── */}
      <div className="fin-table-wrap">
        <table className="fin-table">
          <thead>
            <tr>
              <th style={{width:40}}></th>
              <th>Item</th>
              <th>Valor</th>
              <th>Tag</th>
              {currentSheet?.type!=='income' && <><th>Banco</th><th>Método</th><th>Dia</th></>}
              {currentSheet?.type==='fixed' && <th>Parcelas</th>}
              <th>Obs</th>
              <th style={{width:32}}></th>
            </tr>
          </thead>
          <tbody>
            {currentEntries.length === 0 ? (
              <tr><td colSpan={10} className="fin-empty-row">
                <div className="fin-empty">Nenhuma entrada ainda — clique em "+ Entrada"</div>
              </td></tr>
            ) : currentEntries.map(e => {
              const instLeft = e.installments_total ? e.installments_total - (e.installments_done||0) : null;
              const instDone = instLeft === 0;
              const showLogo = currentSheet?.type === 'income' || currentSheet?.type === 'fixed';
              return (
                <tr key={e.id} className={`fin-row${e.paid?' paid':''}${instDone?' inst-done':''}`}
                  onClick={()=>openEditEntry(e)}>
                  <td onClick={ev=>ev.stopPropagation()}>
                    {showLogo ? (
                      <label className="fin-logo-cell" title="Clique para adicionar logo">
                        <input type="file" accept="image/*" style={{display:'none'}} onChange={ev=>{
                          const file=ev.target.files?.[0]; if(!file) return;
                          if(file.size>500*1024){alert('Imagem muito grande. Use menos de 500KB.');return;}
                          const reader=new FileReader();
                          reader.onload=async re=>{ await onUpdateEntry(e.id,{logo_url:re.target.result}); };
                          reader.readAsDataURL(file);
                        }}/>
                        {e.logo_url
                          ? <img src={e.logo_url} alt="" className="fin-logo-img"/>
                          : <div className="fin-logo-placeholder">+</div>
                        }
                      </label>
                    ) : (
                      <button className={`fin-check${e.paid?' done':''}`}
                        onClick={ev=>{ev.stopPropagation();onUpdateEntry(e.id,{paid:!e.paid});}}>
                        {e.paid?'✓':''}
                      </button>
                    )}
                  </td>
                  <td className="fin-name">{e.name}</td>
                  <td className="fin-amount">{fmtBRL(e.amount)}</td>
                  <td>{e.tag && <span className="fin-tag">{e.tag}</span>}</td>
                  {currentSheet?.type!=='income' && <>
                    <td>{e.bank && <span className="fin-badge fin-bank">{e.bank}</span>}</td>
                    <td>{e.method && <span className={`fin-badge fin-method fin-method-${e.method?.toLowerCase()}`}>{e.method}</span>}</td>
                    <td className="fin-day">{e.due_day||'—'}</td>
                  </>}
                  {currentSheet?.type==='fixed' && (
                    <td>
                      {e.installments_total ? (
                        <div className="fin-inst-wrap">
                          <div className="fin-inst-bar-bg">
                            <div className="fin-inst-bar-fg" style={{width:`${Math.min(100,(e.installments_done||0)/e.installments_total*100)}%`, background: instDone?'var(--acc)':'var(--yellow)'}}/>
                          </div>
                          <span className={`fin-inst-label${instDone?' done':''}`}>
                            {instDone ? '✓ Quitado' : `${e.installments_done||0}/${e.installments_total}`}
                          </span>
                        </div>
                      ) : <span className="fin-inst-fixed">Fixo</span>}
                    </td>
                  )}
                  <td className="fin-notes">{e.notes}</td>
                  <td>
                    <button className="fin-del-btn" title="Excluir"
                      onClick={ev=>{ev.stopPropagation();if(window.confirm('Excluir?'))onDeleteEntry(e.id);}}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {currentEntries.length > 0 && (
            <tfoot>
              <tr className="fin-total-row">
                <td colSpan={2} style={{textAlign:'right',paddingRight:16,fontFamily:'var(--fm)',fontSize:10,color:'var(--t3)',letterSpacing:'.1em'}}>SOMA</td>
                <td className="fin-amount fin-total">{fmtBRL(totalSheet)}</td>
                <td colSpan={10}/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── ENTRY MODAL ── */}
      {showEntryModal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setShowEntryModal(false);}}>
          <div className="modal">
            <div className="modal-h"><div className="acc-dot"/>{editEntryId?'Editar Entrada':'Nova Entrada'}</div>
            <label className="mlabel" style={{marginTop:0}}>NOME</label>
            <input className="minput" placeholder="Ex: Aluguel, Netflix, Salário..." value={eName} onChange={e=>setEName(e.target.value)} autoFocus/>
            <label className="mlabel">VALOR (R$)</label>
            <input className="minput" type="number" placeholder="0,00" value={eAmount} onChange={e=>setEAmount(e.target.value)} step="0.01"/>
            <label className="mlabel">TAG</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:4}}>
              {TAGS_FIN.map(t=>(
                <button key={t} className={`tag-opt${eTag===t?' sel':''}`}
                  style={{fontSize:10,padding:'3px 9px',borderColor:eTag===t?'var(--acc)':'var(--b2)',color:eTag===t?'var(--acc)':'var(--t3)',background:eTag===t?'var(--acc-dim)':'transparent'}}
                  onClick={()=>setETag(eTag===t?'':t)}>{t}</button>
              ))}
            </div>
            {currentSheet?.type!=='income' && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label className="mlabel">BANCO</label>
                  <select className="mselect" value={eBank} onChange={e=>setEBank(e.target.value)}>
                    <option value="">—</option>
                    {BANKS.map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mlabel">MÉTODO</label>
                  <select className="mselect" value={eMethod} onChange={e=>setEMethod(e.target.value)}>
                    <option value="">—</option>
                    {METHODS.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mlabel">DIA DO VENCIMENTO</label>
                  <input className="minput" type="number" placeholder="Ex: 15" min="1" max="31" value={eDueDay} onChange={e=>setEDueDay(e.target.value)}/>
                </div>
                <div>
                  <label className="mlabel">PARCELAS (TOTAL / FEITAS)</label>
                  <div style={{display:'flex',gap:6}}>
                    <input className="minput" type="number" placeholder="Total" min="0" value={eInstTotal} onChange={e=>setEInstTotal(e.target.value)} style={{flex:1}}/>
                    <input className="minput" type="number" placeholder="Feitas" min="0" value={eInstDone} onChange={e=>setEInstDone(e.target.value)} style={{flex:1}}/>
                  </div>
                  {eInstTotal && <div style={{fontFamily:'var(--fm)',fontSize:10,color:'var(--acc)',marginTop:4,letterSpacing:'.06em'}}>
                    {parseInt(eInstTotal)-(parseInt(eInstDone)||0)} parcela{(parseInt(eInstTotal)-(parseInt(eInstDone)||0))!==1?'s':''} restante{(parseInt(eInstTotal)-(parseInt(eInstDone)||0))!==1?'s':''}
                  </div>}
                </div>
              </div>
            )}
            <label className="mlabel">LOGO / ÍCONE (opcional)</label>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:4}}>
              <label className="fin-modal-logo-upload" title="Upload de logo">
                <input type="file" accept="image/*" style={{display:'none'}} onChange={ev=>{
                  const file=ev.target.files?.[0]; if(!file) return;
                  if(file.size>500*1024){alert('Use menos de 500KB.');return;}
                  const reader=new FileReader();
                  reader.onload=re=>setELogoUrl(re.target.result);
                  reader.readAsDataURL(file);
                }}/>
                {eLogoUrl
                  ? <img src={eLogoUrl} alt="" style={{width:36,height:36,borderRadius:8,objectFit:'cover'}}/>
                  : <div style={{width:36,height:36,borderRadius:8,background:'var(--glass-bg)',border:'1px dashed var(--b3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'var(--t3)'}}>+</div>
                }
              </label>
              {eLogoUrl && <button onClick={()=>setELogoUrl(null)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:12}}>Remover</button>}
            </div>
            <label className="mlabel">OBS</label>
            <input className="minput" placeholder="Observações opcionais..." value={eNotes} onChange={e=>setENotes(e.target.value)}/>
            <div className="modal-btns">
              <button className="modal-save" onClick={saveEntry} disabled={saving}>{saving?'Salvando...':editEntryId?'SALVAR':'ADICIONAR'}</button>
              <button className="modal-close" onClick={()=>{setShowEntryModal(false);setEditEntryId(null);}}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHEET MODAL ── */}
      {showSheetModal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setShowSheetModal(false);}}>
          <div className="modal">
            <div className="modal-h"><div className="acc-dot"/>{editSheetId?'Editar Planilha':'Nova Planilha'}</div>
            <label className="mlabel" style={{marginTop:0}}>NOME</label>
            <input className="minput" placeholder="Ex: Cartão Nubank, Investimentos..." value={sheetName} onChange={e=>setSheetName(e.target.value)} autoFocus/>
            {!editSheetId && <>
              <label className="mlabel">TIPO</label>
              <div style={{display:'flex',gap:8,marginBottom:4}}>
                {[{id:'expense',label:'↓ Despesas'},{id:'income',label:'↑ Receitas'},{id:'fixed',label:'↻ Fixos/Parcelas'}].map(t=>(
                  <button key={t.id} style={{flex:1,padding:'10px 8px',borderRadius:'var(--r)',border:`1px solid ${sheetType===t.id?'var(--acc)':'var(--b2)'}`,background:sheetType===t.id?'var(--acc-dim)':'transparent',color:sheetType===t.id?'var(--acc)':'var(--t3)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--fm)',letterSpacing:'.06em',transition:'all .15s'}}
                    onClick={()=>setSheetType(t.id)}>{t.label}</button>
                ))}
              </div>
            </>}
            <div className="modal-btns">
              <button className="modal-save" onClick={saveSheet}>{editSheetId?'SALVAR':'CRIAR'}</button>
              {editSheetId && <button className="btn-del" style={{padding:'12px 14px'}} onClick={async()=>{await onDeleteSheet(editSheetId);setShowSheetModal(false);setEditSheetId(null);}}>EXCLUIR</button>}
              <button className="modal-close" onClick={()=>{setShowSheetModal(false);setEditSheetId(null);}}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
