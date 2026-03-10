import { useState, useEffect, useRef } from "react";

async function callClaude(system, user, history = []) {
  const messages = history.length ? [...history, { role: "user", content: user }] : [{ role: "user", content: user }];
  const res = await fetch("/api/claude", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system, messages }),
  });
  return (await res.json()).content?.[0]?.text || "";
}

const C = {
  bg: "#050914", card: "#0a1120", border: "#111d35", text: "#e2e8f0", muted: "#4b5563",
  dim: "#0f1c2e", green: "#22c55e", blue: "#3b82f6", purple: "#8b5cf6",
  yellow: "#eab308", red: "#ef4444", indigo: "#6366f1", cyan: "#06b6d4",
};
const S = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 },
  input: { background: "#060c18", border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" },
  textarea: { background: "#060c18", border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box", resize: "vertical" },
  btn: { background: `linear-gradient(135deg,${C.indigo},#4338ca)`, color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  ghost: { background: C.dim, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 11px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  label: { color: "#1e3a5f", fontSize: 10, fontFamily: "monospace", letterSpacing: 1.3, marginBottom: 5, display: "block" },
  sel: { background: "#060c18", border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", cursor: "pointer" },
};

function Out({ text }) {
  if (!text) return null;
  return (
    <div style={{ ...S.card, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={S.label}>OUTPUT</span>
        <button onClick={() => navigator.clipboard.writeText(text)} style={S.ghost}>📋 Copy</button>
      </div>
      <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>{text}</p>
    </div>
  );
}
function Spin() { return <div style={{ textAlign: "center", padding: 40, color: "#1e3a5f", fontSize: 13 }}>⚡ Generating...</div>; }
function F({ label, children }) { return <div style={{ marginBottom: 12 }}><span style={S.label}>{label}</span>{children}</div>; }
function Pill({ color, children }) { return <span style={{ fontSize: 10, color, background: color + "18", padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", whiteSpace: "nowrap" }}>{children}</span>; }
function Tag({ color, children }) { return <span style={{ fontSize: 10, color, background: color + "15", padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", whiteSpace: "nowrap" }}>{children}</span>; }
function Hdr({ title, sub }) { return <div style={{ marginBottom: 20 }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{title}</h2>{sub && <p style={{ margin: "3px 0 0", fontSize: 12, color: C.muted }}>{sub}</p>}</div>; }

// ─── GLOBAL STORE + NEON DB ──────────────────────────────────────────────────
const store = { clients: [], integrations: {}, listeners: [], loaded: false };

function broadcast() {
  store.listeners.forEach(l => l({ clients: store.clients, integrations: store.integrations, loaded: store.loaded }));
}

// Load everything from DB on startup
async function loadFromDB() {
  try {
    const [cr, ir] = await Promise.all([
      fetch("/api/clients").then(r => r.json()),
      fetch("/api/integrations").then(r => r.json()),
    ]);
    store.clients = cr.clients || [];
    store.integrations = ir.integrations || {};
  } catch(e) {
    console.warn("DB load failed, using empty state", e);
  }
  store.loaded = true;
  broadcast();
}
loadFromDB();

function useStore() {
  const [state, setState] = useState({ clients: store.clients, integrations: store.integrations, loaded: store.loaded });
  useEffect(() => {
    const cb = s => setState({ ...s });
    store.listeners.push(cb);
    return () => { store.listeners = store.listeners.filter(l => l !== cb); };
  }, []);

  const update = async (patch) => {
    // Optimistically update local state
    Object.assign(store, patch);
    broadcast();
    // Persist to DB
    if (patch.clients !== undefined) {
      // handled per-op below
    }
    if (patch.integrations !== undefined) {
      // handled per-op below
    }
  };

  // Specific DB operations
  const addClient = async (client) => {
    store.clients = [...store.clients, client];
    broadcast();
    try { await fetch("/api/clients", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(client) }); }
    catch(e) { console.error("Failed to save client", e); }
  };

  const removeClient = async (id) => {
    store.clients = store.clients.filter(c => c.id !== id);
    broadcast();
    try { await fetch("/api/clients", { method: "DELETE", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ id }) }); }
    catch(e) { console.error("Failed to delete client", e); }
  };

  const saveIntegration = async (key, value) => {
    store.integrations = { ...store.integrations, [key]: value };
    broadcast();
    try { await fetch("/api/integrations", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ key, value }) }); }
    catch(e) { console.error("Failed to save integration", e); }
  };

  return [state, { update, addClient, removeClient, saveIntegration }];
}

const TIERS = {
  low: { label: "Starter", fee: 400, color: C.green },
  mid: { label: "Growth", fee: 500, color: C.blue },
  high: { label: "Pro", fee: 700, color: C.yellow },
};
const MILESTONES = [
  { id: 1, label: "First Revenue", icon: "🚀", mrr: 500,  desc: "Land your first paying client. Prove the model works.", bonusClients: 1 },
  { id: 2, label: "Getting Traction", icon: "📈", mrr: 1500, desc: "3 clients, real recurring income. Word starts to spread.", bonusClients: 3 },
  { id: 3, label: "Real Business", icon: "💰", mrr: 2500, desc: "5 clients. You're running a legit operation.", bonusClients: 5 },
  { id: 4, label: "Scaling Up", icon: "🔥", mrr: 4000, desc: "Agency mode. Start thinking about outsourcing.", bonusClients: 8 },
  { id: 5, label: "Six Figures Pace", icon: "👑", mrr: 6000, desc: "$72K/yr run rate. You're ahead of 95% of people your age.", bonusClients: 12 },
  { id: 6, label: "BMW M3 G80 🏎️", icon: "🏎️", mrr: 10000, desc: "The goal. $10K/mo. Buy the car.", bonusClients: 15 },
];
const NICHES = ["barbershop", "roofing contractor", "hair salon", "plumber", "HVAC company", "landscaper", "auto shop", "dentist"];

function Tool({ sys, fields, buildPrompt, quickBtns, btnLabel }) {
  const [vals, setVals] = useState({});
  const [out, setOut] = useState(""); const [loading, setLoading] = useState(false);
  const go = async override => { setLoading(true); setOut(""); setOut(await callClaude(sys, override || buildPrompt(vals))); setLoading(false); };
  const sv = k => e => setVals(v => ({ ...v, [k]: e.target.value }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={S.card}>
        {fields.map(f => (
          <F key={f.key} label={f.label}>
            {f.type === "select" ? <select value={vals[f.key] || f.opts[0]} onChange={sv(f.key)} style={S.sel}>{f.opts.map(o => <option key={o}>{o}</option>)}</select>
              : f.type === "textarea" ? <textarea value={vals[f.key] || ""} onChange={sv(f.key)} placeholder={f.ph} style={{ ...S.textarea, height: f.h || 80 }} />
                : <input value={vals[f.key] || ""} onChange={sv(f.key)} placeholder={f.ph} style={S.input} />}
          </F>
        ))}
        {quickBtns && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>{quickBtns.map(q => <button key={q.l} onClick={() => go(q.p(vals))} style={S.ghost}>{q.l}</button>)}</div>}
        <button onClick={() => go()} style={{ ...S.btn, width: "100%" }} disabled={loading}>{loading ? "Generating..." : btnLabel}</button>
      </div>
      {loading ? <Spin /> : <Out text={out} />}
    </div>
  );
}

// ═══════ HOME ═══════
function Home({ onNav }) {
  const [{ clients }] = useStore();
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const mrr = clients.reduce((s, c) => s + (c.fee || 0), 0);
  const count = clients.length;
  const nextIdx = MILESTONES.findIndex(m => mrr < m.mrr);
  const nextM = MILESTONES[Math.max(0, nextIdx === -1 ? MILESTONES.length - 1 : nextIdx)];
  const prevM = MILESTONES[Math.max(0, (nextIdx === -1 ? MILESTONES.length - 1 : nextIdx) - 1)];
  const pct = nextM ? Math.min(((mrr - (prevM?.mrr || 0)) / ((nextM.mrr || 1) - (prevM?.mrr || 0))) * 100, 100) : 100;

  useEffect(() => {
    (async () => {
      try {
        const raw = await callClaude("Output only valid JSON array. No markdown.", `5 short daily goals for Chris, 18yo Chattanooga TN, Reli AI agency. ${count} clients, $${mrr} MRR. Today: ${today}. JSON: [{"id":"1","text":"...","category":"outreach|sales|admin","done":false}]`);
        setGoals(JSON.parse(raw.replace(/```json|```/g, "").trim()).map(g => ({ ...g, done: false })));
      } catch {
        setGoals([
          { id: "1", text: "Send 30 SMS to roofers via StraightText", category: "outreach", done: false },
          { id: "2", text: "Follow up on all warm replies", category: "sales", done: false },
          { id: "3", text: "Scrape 50 new leads via Outscraper", category: "admin", done: false },
          { id: "4", text: "Post in Chattanooga Facebook group", category: "outreach", done: false },
          { id: "5", text: "Send 5 cold emails to salon owners", category: "sales", done: false },
        ]);
      }
      setLoadingGoals(false);
    })();
  }, []);

  const toggle = id => setGoals(g => g.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const done = goals.filter(g => g.done).length;
  const cc = { outreach: C.blue, sales: C.green, admin: C.purple };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Hey Chris 👋</h1>
          <p style={{ margin: "2px 0 0", color: C.muted, fontSize: 12 }}>{today}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onNav("clients")} style={{ ...S.btn, fontSize: 12 }}>＋ Add Client</button>
          <button onClick={() => onNav("integrations")} style={{ ...S.ghost, fontSize: 12 }}>⚙ Integrations</button>
        </div>
      </div>

      {/* First client banner */}
      {count === 0 && (
        <div style={{ ...S.card, background: "linear-gradient(135deg,#0a0f20,#13103a)", border: `1px solid ${C.indigo}35`, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: C.indigo + "20", border: `2px solid ${C.indigo}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🤝</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#a5b4fc" }}>Milestone #1 — Land Your First Client</p>
              <p style={{ margin: "3px 0 0", color: C.indigo + "90", fontSize: 12 }}>No MRR yet. The only goal right now is closing that first deal.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onNav("offers")} style={{ ...S.btn, fontSize: 12 }}>Make Offer</button>
              <button onClick={() => onNav("roi")} style={{ ...S.ghost, fontSize: 12 }}>ROI Calc</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        {[
          { l: "Monthly Revenue", v: `$${mrr.toLocaleString()}`, sub: `$${(mrr * 12).toLocaleString()}/yr`, c: C.green },
          { l: "Active Clients", v: count, sub: count === 0 ? "none yet" : `${clients.filter(c=>c.tier==="high").length}H · ${clients.filter(c=>c.tier==="mid").length}M · ${clients.filter(c=>c.tier==="low").length}L`, c: C.blue },
          { l: "Next Milestone", v: nextM?.icon + " " + (nextM?.label || "—"), sub: `$${(nextM?.mrr||0).toLocaleString()}/mo target`, c: C.purple },
          { l: "Goals Today", v: `${done}/${goals.length}`, sub: "completed", c: C.yellow },
        ].map(s => (
          <div key={s.l} style={{ ...S.card, position: "relative", overflow: "hidden" }}>
            <span style={S.label}>{s.l.toUpperCase()}</span>
            <div style={{ fontSize: s.l === "Next Milestone" ? 14 : 26, fontWeight: 800, color: s.c, fontFamily: "monospace", lineHeight: 1.1, marginBottom: 4 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: C.muted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Milestone bar */}
      <div style={{ ...S.card }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{nextM?.icon}</span>
            <div>
              <span style={S.label}>NEXT MILESTONE</span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{nextM?.label}</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.indigo, fontFamily: "monospace" }}>{Math.round(pct)}%</div>
            <button onClick={() => onNav("milestones")} style={{ ...S.ghost, fontSize: 10, padding: "2px 8px" }}>All →</button>
          </div>
        </div>
        <div style={{ width: "100%", height: 6, background: C.dim, borderRadius: 99 }}>
          <div style={{ height: "100%", background: `linear-gradient(90deg,${C.indigo},${C.green})`, borderRadius: 99, width: `${pct}%`, transition: "width 0.5s" }} />
        </div>
        {nextM && mrr < nextM.mrr && <p style={{ margin: "7px 0 0", fontSize: 11, color: C.muted }}>${mrr.toLocaleString()} / ${nextM.mrr.toLocaleString()} MRR · ~{Math.ceil((nextM.mrr - mrr) / 500)} more clients at $500/mo avg{nextM.bonusClients ? ` · 🎯 Bonus: ${nextM.bonusClients} clients` : ""}</p>}
      </div>

      {/* Two col: goals + actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
        {/* Goals */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={S.label}>TODAY'S GOALS</span>
            <button onClick={() => onNav("goals")} style={{ ...S.ghost, fontSize: 10, padding: "2px 8px" }}>All →</button>
          </div>
          <div style={{ width: "100%", height: 3, background: C.dim, borderRadius: 99, marginBottom: 12 }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg,${C.green},${C.blue})`, borderRadius: 99, width: `${goals.length ? (done / goals.length) * 100 : 0}%`, transition: "width .4s" }} />
          </div>
          {loadingGoals ? <div style={{ color: C.muted, fontSize: 12 }}>Loading...</div> : goals.map(g => (
            <div key={g.id} onClick={() => toggle(g.id)} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "7px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer", opacity: g.done ? 0.3 : 1 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${g.done ? C.green : "#1e3a5f"}`, background: g.done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#000", flexShrink: 0, marginTop: 2 }}>{g.done && "✓"}</div>
              <span style={{ color: g.done ? "#1e3a5f" : "#94a3b8", fontSize: 12, flex: 1, textDecoration: g.done ? "line-through" : "none", lineHeight: 1.4 }}>{g.text}</span>
              <span style={{ fontSize: 8, color: cc[g.category] || C.muted, fontFamily: "monospace", flexShrink: 0 }}>{(g.category || "").slice(0, 3).toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={S.card}>
          <span style={S.label}>QUICK ACTIONS</span>
          {[
            { l: "📱 Write SMS", p: "sms" }, { l: "📧 Write Email", p: "email" },
            { l: "💼 Make an Offer", p: "offers" }, { l: "🧮 ROI Calculator", p: "roi" },
            { l: "🛡 Handle Objection", p: "objections" }, { l: "📝 Contract", p: "contract" },
            { l: "🎙 Retell Prompt", p: "retell" }, { l: "🌐 Build Website", p: "website" },
          ].map(a => (
            <button key={a.p} onClick={() => onNav(a.p)} style={{ ...S.ghost, display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 6, fontSize: 12, color: "#64748b" }}>{a.l}</button>
          ))}
        </div>
      </div>

      {/* Client list */}
      {clients.length > 0 && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={S.label}>ACTIVE CLIENTS · ${mrr}/mo total</span>
            <button onClick={() => onNav("clients")} style={{ ...S.ghost, fontSize: 10, padding: "2px 8px" }}>Manage →</button>
          </div>
          {clients.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < clients.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: TIERS[c.tier]?.color || C.blue, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{c.biz}</span>
              <Pill color={TIERS[c.tier]?.color || C.blue}>{TIERS[c.tier]?.label}</Pill>
              <span style={{ fontSize: 14, fontWeight: 800, color: TIERS[c.tier]?.color, fontFamily: "monospace" }}>${c.fee}/mo</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════ CLIENTS ═══════
function Clients() {
  const [{clients,loaded},{addClient,removeClient}] = useStore();
  const [form,setForm] = useState({name:"",biz:"",niche:"barbershop",tier:"mid",fee:"500",phone:"",email:""});
  const [adding,setAdding] = useState(false);
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const add = () => {
    if(!form.name||!form.biz) return;
    addClient({...form,id:String(Date.now()),fee:parseInt(form.fee)||500,startDate:new Date().toLocaleDateString()});
    setForm({name:"",biz:"",niche:"barbershop",tier:"mid",fee:"500",phone:"",email:""});
    setAdding(false);
  };
  const remove = id => removeClient(id);
  const mrr = clients.reduce((s,c)=>s+(c.fee||0),0);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
        {[{l:"Total MRR",v:`$${mrr}/mo`,c:C.green},{l:"Starter ($400)",v:clients.filter(c=>c.tier==="low").length,c:C.green},{l:"Growth ($500)",v:clients.filter(c=>c.tier==="mid").length,c:C.blue},{l:"Pro ($700)",v:clients.filter(c=>c.tier==="high").length,c:C.yellow}].map(s=>(
          <div key={s.l} style={{...S.card,textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:s.c,fontFamily:"monospace"}}>{s.v}</div><div style={{fontSize:9,color:C.muted,marginTop:4}}>{s.l}</div></div>
        ))}
      </div>
      <div style={S.card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:adding?16:0}}>
          <span style={S.label}>CLIENT ROSTER</span>
          <button onClick={()=>setAdding(v=>!v)} style={S.btn}>{adding?"✕ Cancel":"＋ Add Client"}</button>
        </div>
        {adding&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <F label="CLIENT NAME"><input value={form.name} onChange={set("name")} placeholder="Marcus Johnson" style={S.input}/></F>
              <F label="BUSINESS NAME"><input value={form.biz} onChange={set("biz")} placeholder="King's Cuts" style={S.input}/></F>
              <F label="PHONE"><input value={form.phone} onChange={set("phone")} placeholder="(423) 555-0100" style={S.input}/></F>
              <F label="EMAIL"><input value={form.email} onChange={set("email")} placeholder="mike@kingcuts.com" style={S.input}/></F>
              <F label="BUSINESS TYPE"><select value={form.niche} onChange={set("niche")} style={S.sel}>{NICHES.map(n=><option key={n}>{n}</option>)}</select></F>
              <F label="TIER"><div style={{display:"flex",gap:8}}><select value={form.tier} onChange={e=>{const t=e.target.value;setForm(f=>({...f,tier:t,fee:TIERS[t]?.fee||500}));}} style={{...S.sel,flex:1}}>{Object.entries(TIERS).map(([k,v])=><option key={k} value={k}>{v.label} — ${v.fee}</option>)}</select><input type="number" value={form.fee} onChange={set("fee")} style={{...S.input,width:80}}/></div></F>
            </div>
            <button onClick={add} style={{...S.btn,width:"100%"}} disabled={!form.name||!form.biz}>Add Client</button>
          </div>
        )}
      </div>
      {clients.length===0?<div style={{...S.card,textAlign:"center",padding:60,color:C.dim}}><div style={{fontSize:36,marginBottom:10}}>👥</div><p>No clients yet. Land your first deal and add them here.</p></div>
        :clients.map(c=>(
        <div key={c.id} style={{...S.card,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:9,background:`${TIERS[c.tier]?.color||C.blue}18`,border:`1px solid ${TIERS[c.tier]?.color||C.blue}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>
            {c.niche?.includes("barber")?"✂️":c.niche?.includes("roof")?"🏠":c.niche?.includes("salon")?"💇":c.niche?.includes("plumb")?"🔧":"🏢"}
          </div>
          <div style={{flex:1}}><p style={{margin:0,fontSize:13,fontWeight:600,color:C.text}}>{c.biz}</p><p style={{margin:"1px 0 0",fontSize:11,color:C.muted}}>{c.name}{c.phone?` · ${c.phone}`:""}</p></div>
          <Tag color={TIERS[c.tier]?.color||C.blue}>{TIERS[c.tier]?.label}</Tag>
          <span style={{fontSize:14,fontWeight:800,color:TIERS[c.tier]?.color,fontFamily:"monospace"}}>${c.fee}/mo</span>
          <button onClick={()=>remove(c.id)} style={{...S.ghost,color:C.red,fontSize:11,padding:"4px 8px"}}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── MILESTONES ────────────────────────────────────────────────────────────────
function Milestones() {
  const [{clients}] = useStore();
  const mrr = clients.reduce((s,c)=>s+(c.fee||0),0);
  const count = clients.length;
  const nextIdx = MILESTONES.findIndex(m => mrr < m.mrr);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Header stat */}
      <div style={{...S.card,background:"linear-gradient(135deg,#060b18,#0d1424)"}}>
        <span style={S.label}>CURRENT MRR</span>
        <div style={{fontSize:44,fontWeight:900,color:C.green,fontFamily:"monospace",letterSpacing:-2}}>${mrr.toLocaleString()}</div>
        <div style={{display:"flex",gap:12,marginTop:6,alignItems:"center"}}>
          <p style={{margin:0,color:C.muted,fontSize:12}}>${(mrr*12).toLocaleString()} / year</p>
          <Tag color={C.blue}>{count} client{count!==1?"s":""}</Tag>
        </div>
      </div>

      {/* Timeline */}
      <div style={{position:"relative",paddingLeft:24}}>
        {/* Vertical line */}
        <div style={{position:"absolute",left:8,top:0,bottom:0,width:2,background:`linear-gradient(180deg,${C.indigo},${C.green}20)`,borderRadius:99}}/>

        {MILESTONES.map((m,i)=>{
          const isDone = mrr >= m.mrr;
          const isCurrent = !isDone && (i === 0 || mrr >= MILESTONES[i-1].mrr);
          const pct = Math.min((mrr/m.mrr)*100,100);
          const rem = Math.max(0,m.mrr-mrr);
          const clientsNeededH = Math.ceil(rem/700);
          const clientsNeededM = Math.ceil(rem/500);
          const clientsNeededL = Math.ceil(rem/400);

          return (
            <div key={m.id} style={{position:"relative",marginBottom:14}}>
              {/* Dot */}
              <div style={{position:"absolute",left:-19,top:14,width:14,height:14,borderRadius:"50%",background:isDone?C.green:isCurrent?C.indigo:C.dim,border:`2px solid ${isDone?C.green:isCurrent?C.indigo:"#1e293b"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#000",zIndex:1}}>{isDone&&"✓"}</div>

              <div style={{...S.card,border:`1px solid ${isDone?C.green+"30":isCurrent?C.indigo+"30":C.border}`,background:isDone?"#052e1608":isCurrent?"#0f0e2308":C.card}}>
                {/* Month badge + title row */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      {isDone&&<Tag color={C.green}>✓ Done</Tag>}
                      {isCurrent&&<Tag color={C.indigo}>← Current</Tag>}
                    </div>
                    <p style={{margin:0,fontSize:15,fontWeight:700,color:isDone?C.green:isCurrent?C.text:"#334155"}}>{m.icon} {m.label}</p>
                    <p style={{margin:"3px 0 0",fontSize:11,color:isDone?C.green+"70":isCurrent?C.muted:"#1e293b"}}>{m.desc}</p>
                  </div>
                  {/* MRR target — primary */}
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                    <div style={{fontSize:18,fontWeight:800,color:isDone?C.green:isCurrent?C.blue:"#334155",fontFamily:"monospace"}}>${m.mrr.toLocaleString()}</div>
                    <div style={{fontSize:9,color:"#1e293b",fontFamily:"monospace"}}>/mo target</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{width:"100%",height:5,background:C.dim,borderRadius:99,marginBottom:6}}>
                  <div style={{height:"100%",background:isDone?C.green:`linear-gradient(90deg,${C.indigo},${C.blue})`,borderRadius:99,width:`${pct}%`,transition:"width 0.5s"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:isCurrent&&!isDone?8:0}}>
                  <span style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>${mrr.toLocaleString()} / ${m.mrr.toLocaleString()}</span>
                  {!isDone&&<span style={{fontSize:10,color:"#334155",fontFamily:"monospace"}}>${rem.toLocaleString()} to go</span>}
                </div>

                {/* Clients needed — secondary/bonus */}
                {!isDone&&rem>0&&(
                  <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,marginTop:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,color:"#334155",fontFamily:"monospace"}}>CLIENTS BONUS:</span>
                      <Tag color={C.yellow}>{clientsNeededH} Pro ($700)</Tag>
                      <Tag color={C.blue}>{clientsNeededM} Growth ($500)</Tag>
                      <Tag color={C.green}>{clientsNeededL} Starter ($400)</Tag>
                      <span style={{fontSize:10,color:"#1e293b"}}>to hit target</span>
                    </div>
                    {m.bonusClients&&<p style={{margin:"5px 0 0",fontSize:10,color:"#1e293b"}}>🎯 Typical client count at this level: ~{m.bonusClients} clients</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PAYMENTS ──────────────────────────────────────────────────────────────────
function Payments() {
  const [{integrations}] = useStore();
  const [key,setKey]=useState(integrations?.stripe||""); const [saved,setSaved]=useState(!!integrations?.stripe);
  const [charges,setCharges]=useState([]); const [loading,setLoading]=useState(false);
  const [error,setError]=useState(""); const [show,setShow]=useState(false);
  const [tab,setTab]=useState("charges");

  useEffect(()=>{ if(integrations?.stripe){setKey(integrations.stripe);setSaved(true);loadCharges(integrations.stripe);} },[integrations?.stripe]);

  const loadCharges = async k => { setLoading(true); setError(""); try { const r=await fetch("https://api.stripe.com/v1/charges?limit=20",{headers:{Authorization:`Bearer ${k}`}}); if(!r.ok){const e=await r.json();throw new Error(e.error?.message);} setCharges((await r.json()).data||[]); } catch(e){setError(e.message||"Check your Stripe key");} finally{setLoading(false);} };
  const fmt=(c,cur="usd")=>new Intl.NumberFormat("en-US",{style:"currency",currency:cur}).format(c/100);
  const fmtD=ts=>new Date(ts*1000).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const rev=charges.filter(c=>c.status==="succeeded").reduce((s,c)=>s+c.amount,0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Key input */}
      <div style={S.card}>
        <span style={S.label}>STRIPE SECRET KEY</span>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1,position:"relative"}}>
            <input type={show?"text":"password"} value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(setSaved(true),loadCharges(key))} placeholder="sk_live_..." style={S.input}/>
            <button onClick={()=>setShow(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#334155",cursor:"pointer"}}>{show?"🙈":"👁"}</button>
          </div>
          <button onClick={()=>{setSaved(true);loadCharges(key);}} style={S.btn} disabled={loading||!key.trim()}>{loading?"...":saved?"Refresh":"Connect"}</button>
        </div>
        {error&&<p style={{color:C.red,fontSize:12,marginTop:7}}>❌ {error}</p>}
        {saved&&!error&&<p style={{color:C.green,fontSize:11,marginTop:5}}>✓ Connected — save this key in the Integrations tab to auto-load it next time</p>}
      </div>

      {/* Tabs */}
      {saved&&(
        <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`,width:"fit-content"}}>
          {[["charges","💳 Charges"],["links","🔗 Payment Links"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{background:tab===v?C.indigo:"transparent",color:tab===v?"#fff":C.muted,border:"none",padding:"7px 18px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:tab===v?600:400}}>{l}</button>
          ))}
        </div>
      )}

      {/* CHARGES TAB */}
      {tab==="charges"&&saved&&(
        <>
          {charges.length>0&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                {[{l:"Total Revenue",v:fmt(rev),c:C.green},{l:"Charges",v:charges.length,c:C.blue},{l:"Succeeded",v:charges.filter(c=>c.status==="succeeded").length,c:C.purple}].map(s=>(
                  <div key={s.l} style={{...S.card,textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:s.c,fontFamily:"monospace"}}>{s.v}</div><div style={{fontSize:9,color:C.muted,marginTop:4}}>{s.l}</div></div>
                ))}
              </div>
              <div style={S.card}>
                <span style={S.label}>RECENT CHARGES</span>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Date","Description","Amount","Status"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:"#1e293b",fontWeight:400}}>{h}</th>)}</tr></thead>
                  <tbody>{charges.map(c=>(<tr key={c.id} style={{borderBottom:`1px solid ${C.bg}`}}><td style={{padding:"8px 10px",color:C.muted}}>{fmtD(c.created)}</td><td style={{padding:"8px 10px",color:"#94a3b8"}}>{c.description||"—"}</td><td style={{padding:"8px 10px",color:C.green,fontFamily:"monospace"}}>{fmt(c.amount,c.currency)}</td><td style={{padding:"8px 10px"}}><Tag color={c.status==="succeeded"?C.green:C.red}>{c.status}</Tag></td></tr>))}</tbody>
                </table>
              </div>
            </>
          )}
          {charges.length===0&&!loading&&<div style={{...S.card,textAlign:"center",padding:40,color:C.dim}}>No charges found yet.</div>}
        </>
      )}

      {/* PAYMENT LINKS TAB */}
      {tab==="links"&&saved&&<PaymentLinkGen stripeKey={key}/>}

      {!saved&&<div style={{...S.card,textAlign:"center",padding:60,color:C.dim}}><div style={{fontSize:36,marginBottom:10}}>💳</div><p>Enter your Stripe key above to get started</p></div>}
    </div>
  );
}

// ── PAYMENT LINK GENERATOR ────────────────────────────────────────────────────
function PaymentLinkGen({stripeKey}) {
  const [{clients}] = useStore();
  const [form,setForm]=useState({clientName:"",bizName:"",setupFee:"300",monthlyFee:"500",includeSetup:true,includeMonthly:true,description:""});
  const [links,setLinks]=useState([]); // {id, url, label, amount, created}
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(null);

  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const toggle=k=>setForm(f=>({...f,[k]:!f[k]}));

  const stripePost = async (endpoint, params) => {
    const body = new URLSearchParams();
    const flatten = (obj, prefix="") => {
      for(const [k,v] of Object.entries(obj)){
        const key = prefix ? `${prefix}[${k}]` : k;
        if(typeof v === "object" && !Array.isArray(v)) flatten(v, key);
        else body.append(key, v);
      }
    };
    flatten(params);
    const r = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
      method:"POST", headers:{Authorization:`Bearer ${stripeKey}`,"Content-Type":"application/x-www-form-urlencoded"},
      body: body.toString()
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error?.message || "Stripe error");
    return data;
  };

  const createLink = async (label, amountCents, desc) => {
    // 1. Create product
    const product = await stripePost("products", {name: desc});
    // 2. Create price
    const price = await stripePost("prices", {
      product: product.id,
      unit_amount: amountCents,
      currency: "usd",
    });
    // 3. Create payment link
    const link = await stripePost("payment_links", {
      "line_items[0][price]": price.id,
      "line_items[0][quantity]": 1,
    });
    return { id: link.id, url: link.url, label, amount: amountCents, created: Date.now() };
  };

  const generate = async () => {
    if(!form.includeSetup && !form.includeMonthly) { setError("Select at least one payment type."); return; }
    setLoading(true); setError("");
    const clientLabel = form.clientName || form.bizName || "Client";
    const desc = form.description || `Reli AI — ${clientLabel}`;
    try {
      const newLinks = [];
      if(form.includeSetup && form.setupFee) {
        const l = await createLink(`Setup Fee — ${clientLabel}`, parseInt(form.setupFee)*100, `${desc} Setup Fee`);
        newLinks.push(l);
      }
      if(form.includeMonthly && form.monthlyFee) {
        const l = await createLink(`Monthly — ${clientLabel}`, parseInt(form.monthlyFee)*100, `${desc} Monthly Service`);
        newLinks.push(l);
      }
      setLinks(prev=>[...newLinks,...prev]);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const copyLink = (url, id) => { navigator.clipboard.writeText(url); setCopied(id); setTimeout(()=>setCopied(null),2000); };
  const fmt = cents => `$${(cents/100).toLocaleString()}`;
  const fmtD = ts => new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric"});

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{...S.card,border:`1px solid ${C.green}25`}}>
        <p style={{margin:"0 0 14px",fontSize:13,fontWeight:600,color:C.green}}>🔗 Generate Stripe Payment Link</p>
        <p style={{margin:"0 0 14px",fontSize:12,color:C.muted}}>Creates a real Stripe product + price + payment link. Copy the link and send it straight to your client.</p>

        {/* Quick fill from client */}
        {clients.length>0&&(
          <div style={{marginBottom:14}}>
            <span style={S.label}>QUICK FILL FROM CLIENT</span>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {clients.map(c=>(
                <button key={c.id} onClick={()=>setForm(f=>({...f,clientName:c.name,bizName:c.biz,monthlyFee:String(c.fee||500)}))} style={{...S.ghost,fontSize:11}}>
                  {c.biz}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <F label="CLIENT NAME"><input value={form.clientName} onChange={set("clientName")} placeholder="e.g. Marcus" style={S.input}/></F>
          <F label="BUSINESS NAME"><input value={form.bizName} onChange={set("bizName")} placeholder="e.g. King's Cuts" style={S.input}/></F>
        </div>

        <F label="LINK DESCRIPTION (optional)"><input value={form.description} onChange={set("description")} placeholder="e.g. Reli AI Receptionist Service" style={S.input}/></F>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
          {/* Setup Fee */}
          <div style={{...S.card,background:"#060a12",border:`1px solid ${form.includeSetup?C.blue+"40":C.border}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:form.includeSetup?C.blue:C.muted}}>Setup Fee</span>
              <button onClick={()=>toggle("includeSetup")} style={{...S.ghost,fontSize:10,padding:"2px 8px",color:form.includeSetup?C.blue:C.muted,borderColor:form.includeSetup?C.blue+"40":C.border}}>{form.includeSetup?"✓ On":"Off"}</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:C.muted,fontSize:13}}>$</span>
              <input type="number" value={form.setupFee} onChange={set("setupFee")} style={{...S.input,fontFamily:"monospace",fontSize:18,fontWeight:800,color:form.includeSetup?C.blue:C.dim,opacity:form.includeSetup?1:0.3}} disabled={!form.includeSetup}/>
            </div>
            <p style={{margin:"5px 0 0",fontSize:10,color:"#1e293b"}}>one-time payment</p>
          </div>

          {/* Monthly */}
          <div style={{...S.card,background:"#060a12",border:`1px solid ${form.includeMonthly?C.green+"40":C.border}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,color:form.includeMonthly?C.green:C.muted}}>Monthly Fee</span>
              <button onClick={()=>toggle("includeMonthly")} style={{...S.ghost,fontSize:10,padding:"2px 8px",color:form.includeMonthly?C.green:C.muted,borderColor:form.includeMonthly?C.green+"40":C.border}}>{form.includeMonthly?"✓ On":"Off"}</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:C.muted,fontSize:13}}>$</span>
              <input type="number" value={form.monthlyFee} onChange={set("monthlyFee")} style={{...S.input,fontFamily:"monospace",fontSize:18,fontWeight:800,color:form.includeMonthly?C.green:C.dim,opacity:form.includeMonthly?1:0.3}} disabled={!form.includeMonthly}/>
            </div>
            <p style={{margin:"5px 0 0",fontSize:10,color:"#1e293b"}}>monthly service</p>
          </div>
        </div>

        {error&&<p style={{color:C.red,fontSize:12,margin:"10px 0 0"}}>❌ {error}</p>}

        <button onClick={generate} style={{...S.btn,width:"100%",marginTop:14}} disabled={loading||(!form.includeSetup&&!form.includeMonthly)}>
          {loading?"⚡ Creating links in Stripe...":"⚡ Generate Payment Link(s)"}
        </button>
      </div>

      {/* Generated links */}
      {links.length>0&&(
        <div style={S.card}>
          <span style={S.label}>GENERATED PAYMENT LINKS</span>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
            {links.map(l=>(
              <div key={l.id} style={{...S.card,background:"#060a12",border:`1px solid ${C.green}25`,display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.text}}>{l.label}</span>
                    <Tag color={C.green}>{fmt(l.amount)}</Tag>
                    <span style={{fontSize:10,color:"#1e293b"}}>{fmtD(l.created)}</span>
                  </div>
                  <p style={{margin:0,fontSize:11,color:C.blue,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.url}</p>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>copyLink(l.url,l.id)} style={{...S.btn,fontSize:11,padding:"5px 10px",background:copied===l.id?C.green+"22":undefined,color:copied===l.id?C.green:"#fff",border:copied===l.id?`1px solid ${C.green}`:"none"}}>
                    {copied===l.id?"✓ Copied":"📋 Copy"}
                  </button>
                  <a href={l.url} target="_blank" rel="noreferrer" style={{...S.ghost,fontSize:11,padding:"5px 10px",textDecoration:"none",color:C.blue}}>↗ Open</a>
                </div>
              </div>
            ))}
          </div>
          <p style={{margin:"12px 0 0",fontSize:11,color:"#1e293b"}}>💡 Copy the link and text/email it directly to your client. Payment goes straight to your Stripe account.</p>
        </div>
      )}
    </div>
  );
}

// ── GOALS ─────────────────────────────────────────────────────────────────────
function Goals() {
  const [goals,setGoals]=useState([]); const [loading,setLoading]=useState(false); const [note,setNote]=useState("");
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const gen=async(done=[],skip=[])=>{setLoading(true);try{const raw=await callClaude("Output only valid JSON array. No markdown.",`Goal coach for Chris, Reli AI. ${done.length?`Done: ${done.join(", ")}`:""} ${skip.length?`Skipped: ${skip.join(", ")}`:""} ${note?`Context: ${note}`:""} 6 goals for ${today}. JSON: [{"id":"1","text":"...","category":"outreach|admin|sales|personal","priority":"high|medium|low"}]`);setGoals(JSON.parse(raw.replace(/```json|```/g,"").trim()).map(g=>({...g,done:false})));} catch{setGoals([{id:"1",text:"Send 30 SMS to roofers",category:"outreach",priority:"high",done:false},{id:"2",text:"Follow up on warm replies",category:"sales",priority:"high",done:false},{id:"3",text:"Scrape 50 new leads via Outscraper",category:"admin",priority:"medium",done:false},{id:"4",text:"Send 5 cold emails",category:"outreach",priority:"medium",done:false},{id:"5",text:"Post in Chattanooga Facebook group",category:"outreach",priority:"low",done:false},{id:"6",text:"Review closing script",category:"admin",priority:"low",done:false}]);}finally{setLoading(false);}};
  useEffect(()=>{gen();},[]);
  const toggle=id=>setGoals(g=>g.map(x=>x.id===id?{...x,done:!x.done}:x));
  const done=goals.filter(g=>g.done).length;
  const cc={outreach:C.blue,sales:C.green,admin:C.purple,personal:C.yellow};
  return (<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{...S.card,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}><div><span style={S.label}>{today.toUpperCase()}</span><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20,fontWeight:800,color:C.green,fontFamily:"monospace"}}>{done}/{goals.length}</span><div style={{width:110,height:4,background:C.dim,borderRadius:99}}><div style={{height:"100%",background:`linear-gradient(90deg,${C.green},${C.blue})`,borderRadius:99,width:`${goals.length?(done/goals.length)*100:0}%`}}/></div></div></div><button onClick={()=>gen(goals.filter(g=>g.done).map(g=>g.text),goals.filter(g=>!g.done).map(g=>g.text))} style={S.btn} disabled={loading}>{loading?"...":"↻ Regenerate"}</button></div><div style={S.card}><span style={S.label}>CONTEXT</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. focus on salons today" style={S.input}/></div>{loading?<Spin/>:goals.map(g=>(<div key={g.id} onClick={()=>toggle(g.id)} style={{...S.card,display:"flex",alignItems:"center",gap:12,cursor:"pointer",opacity:g.done?0.3:1}}><div style={{width:17,height:17,borderRadius:4,border:`2px solid ${g.done?C.green:C.dim}`,background:g.done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#000",flexShrink:0}}>{g.done&&"✓"}</div><div style={{flex:1}}><p style={{color:g.done?C.dim:C.text,textDecoration:g.done?"line-through":"none",margin:0,fontSize:13}}>{g.text}</p><div style={{marginTop:2}}><span style={{fontSize:9,color:cc[g.category]||"#555",fontFamily:"monospace"}}>{(g.category||"").toUpperCase()}</span><span style={{fontSize:9,color:C.dim,fontFamily:"monospace"}}> · {g.priority}</span></div></div></div>))}</div>);
}

// ── INTEGRATIONS ──────────────────────────────────────────────────────────────
function Integrations() {
  const [{integrations},{saveIntegration}] = useStore();
  const [keys,setKeys] = useState({retell:"",stripe:"",ghl:"",zapier:"",calendly:"",slack:"",sheets:"",...integrations});
  const [show,setShow] = useState({}); const [status,setStatus] = useState({}); const [log,setLog] = useState([]);
  // Sync keys when integrations load from DB
  useEffect(()=>{ setKeys(k=>({...k,...integrations})); },[JSON.stringify(integrations)]);
  const save = async k => { await saveIntegration(k, keys[k]); setStatus(s=>({...s,[k]:"saved"})); setTimeout(()=>setStatus(s=>({...s,[k]:null})),2000); };
  const testHook = async url => { if(!url) return; try { const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:"Reli AI OS",test:true,timestamp:new Date().toISOString()})}); setLog(l=>[{url,status:r.ok?"✅ Success":`❌ ${r.status}`,time:new Date().toLocaleTimeString()},...l.slice(0,4)]); } catch(e){setLog(l=>[{url,status:`❌ ${e.message}`,time:new Date().toLocaleTimeString()},...l.slice(0,4)]);} };
  const INTGS = [
    {key:"retell",label:"Retell AI",icon:"🎙",desc:"AI voice receptionist platform",ph:"Your Retell API key",hint:"Retell dashboard → API Keys",type:"api"},
    {key:"stripe",label:"Stripe",icon:"💳",desc:"Payment processing & revenue tracking",ph:"sk_live_...",hint:"Dashboard → Developers → API Keys",type:"api"},
    {key:"ghl",label:"GoHighLevel",icon:"📊",desc:"CRM & pipeline management",ph:"GHL API key",hint:"Settings → Integrations → API Keys",type:"api"},
    {key:"zapier",label:"Zapier Webhook",icon:"⚡",desc:"Trigger automations on new leads/clients",ph:"https://hooks.zapier.com/...",hint:"Create a Zap → Webhook trigger → copy URL",type:"webhook"},
    {key:"calendly",label:"Calendly",icon:"📅",desc:"Auto-book demo calls from prospects",ph:"https://calendly.com/your-link",hint:"Your Calendly event link for demos",type:"link"},
    {key:"slack",label:"Slack Webhook",icon:"💬",desc:"Get notified when new leads reply",ph:"https://hooks.slack.com/...",hint:"Slack → Apps → Incoming Webhooks",type:"webhook"},
    {key:"sheets",label:"Google Sheets Webhook",icon:"📋",desc:"Log new clients to a spreadsheet automatically",ph:"https://script.google.com/...",hint:"Google Apps Script webhook URL",type:"webhook"},
  ];
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{...S.card,background:"linear-gradient(135deg,#060b18,#0d1424)",border:`1px solid ${C.blue}25`}}>
        <p style={{margin:0,fontSize:13,color:C.blue,fontWeight:600}}>⚙ API & Webhook Integrations</p>
        <p style={{margin:"5px 0 0",fontSize:12,color:C.muted}}>Connect your tools for automations, live data, and smarter workflows. Keys are stored in-session only.</p>
      </div>
      {INTGS.map(intg=>{
        const connected=!!integrations[intg.key];
        return (
          <div key={intg.key} style={{...S.card,border:`1px solid ${connected?C.green+"30":C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <span style={{fontSize:20}}>{intg.icon}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><p style={{margin:0,fontSize:13,fontWeight:600,color:C.text}}>{intg.label}</p>{connected&&<Tag color={C.green}>Connected ✓</Tag>}<Tag color={intg.type==="api"?C.blue:intg.type==="webhook"?C.purple:C.yellow}>{intg.type.toUpperCase()}</Tag></div>
                <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>{intg.desc}</p>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1,position:"relative"}}><input type={show[intg.key]?"text":"password"} value={keys[intg.key]||""} onChange={e=>setKeys(k=>({...k,[intg.key]:e.target.value}))} placeholder={intg.ph} style={S.input}/><button onClick={()=>setShow(s=>({...s,[intg.key]:!s[intg.key]}))} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#334155",cursor:"pointer"}}>{show[intg.key]?"🙈":"👁"}</button></div>
              <button onClick={()=>save(intg.key)} style={{...S.btn,padding:"8px 14px",fontSize:12}} disabled={!keys[intg.key]}>{status[intg.key]==="saved"?"✓ Saved":"Save"}</button>
              {intg.type==="webhook"&&keys[intg.key]&&<button onClick={()=>testHook(keys[intg.key])} style={{...S.ghost,fontSize:12}}>Test</button>}
            </div>
            <p style={{margin:"5px 0 0",fontSize:10,color:"#1e293b"}}>💡 {intg.hint}</p>
          </div>
        );
      })}
      {log.length>0&&<div style={S.card}><span style={S.label}>WEBHOOK TEST LOG</span>{log.map((l,i)=>(<div key={i} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}><span style={{color:C.muted,flexShrink:0}}>{l.time}</span><span style={{color:"#334155",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.url}</span><span style={{color:l.status.includes("✅")?C.green:C.red,flexShrink:0}}>{l.status}</span></div>))}</div>}
    </div>
  );
}

// ── RETELL PROMPT GENERATOR ───────────────────────────────────────────────────
function RetellPrompt() {
  const [form,setForm] = useState({bizName:"",niche:"barbershop",services:"",hours:"",bookingSystem:"over the phone",ownerName:"",tone:"friendly and professional",custom:""});
  const [out,setOut] = useState(""); const [loading,setLoading] = useState(false);
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));
  const gen = async () => {
    setLoading(true); setOut("");
    setOut(await callClaude("Expert at writing Retell AI system prompts for AI phone receptionists. Write clean, professional, effective prompts.",
      `Generate a complete Retell AI system prompt for:\nBusiness: ${form.bizName||"the business"}\nIndustry: ${form.niche}\nServices: ${form.services||"general industry services"}\nHours: ${form.hours||"Mon-Fri 9am-5pm"}\nBooking: ${form.bookingSystem}\nOwner: ${form.ownerName||"the owner"}\nTone: ${form.tone}\n${form.custom?`Special instructions: ${form.custom}`:""}\n\nRequirements: give AI a fitting name, warm greeting, handle booking, answer FAQs, handle after-hours, know when to take a message, handle frustrated callers, never confirm it's AI unless asked directly, close every call with next steps. Start with "You are [Name]..."`));
    setLoading(false);
  };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{...S.card,border:`1px solid ${C.purple}25`,background:"#0c0914"}}><p style={{margin:"0 0 3px",fontSize:13,fontWeight:600,color:C.purple}}>🎙 Retell AI Prompt Generator</p><p style={{margin:0,fontSize:12,color:C.muted}}>Fill in client details → AI generates a complete system prompt for Retell AI.</p></div>
      <div style={S.card}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <F label="BUSINESS NAME"><input value={form.bizName} onChange={set("bizName")} placeholder="e.g. King's Cuts" style={S.input}/></F>
          <F label="INDUSTRY"><select value={form.niche} onChange={set("niche")} style={S.sel}>{NICHES.map(n=><option key={n}>{n}</option>)}</select></F>
          <F label="OWNER NAME"><input value={form.ownerName} onChange={set("ownerName")} placeholder="e.g. Marcus" style={S.input}/></F>
          <F label="BOOKING SYSTEM"><select value={form.bookingSystem} onChange={set("bookingSystem")} style={S.sel}>{["over the phone","Square Appointments","Acuity Scheduling","Calendly","StyleSeat","Housecall Pro","ServiceTitan","take a message"].map(b=><option key={b}>{b}</option>)}</select></F>
          <F label="AGENT TONE"><select value={form.tone} onChange={set("tone")} style={S.sel}>{["friendly and professional","warm and conversational","concise and efficient","cheerful and upbeat","calm and reassuring"].map(t=><option key={t}>{t}</option>)}</select></F>
          <F label="BUSINESS HOURS"><input value={form.hours} onChange={set("hours")} placeholder="e.g. Mon-Sat 9am-7pm" style={S.input}/></F>
        </div>
        <F label="SERVICES"><textarea value={form.services} onChange={set("services")} placeholder="e.g. Haircuts, fades, beard trims, lineup..." style={{...S.textarea,height:55}}/></F>
        <F label="SPECIAL INSTRUCTIONS (optional)"><textarea value={form.custom} onChange={set("custom")} placeholder="e.g. Always ask for name. Mention $5 first-visit discount." style={{...S.textarea,height:55}}/></F>
        <button onClick={gen} style={{...S.btn,width:"100%"}} disabled={loading}>{loading?"🎙 Generating...":"⚡ Generate Retell Prompt"}</button>
      </div>
      {loading?<Spin/>:out&&<div style={{...S.card,border:`1px solid ${C.purple}25`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={S.label}>RETELL SYSTEM PROMPT — COPY INTO RETELL AI</span><button onClick={()=>navigator.clipboard.writeText(out)} style={S.ghost}>📋 Copy</button></div><pre style={{color:"#c4b5fd",fontSize:12,lineHeight:1.75,whiteSpace:"pre-wrap",margin:0,fontFamily:"inherit"}}>{out}</pre></div>}
    </div>
  );
}

// ── ROI CALCULATOR ────────────────────────────────────────────────────────────
function ROICalc() {
  const [period,setPeriod]=useState("month");
  const [form,setForm]=useState({calls:"50",missedPct:"30",avgJob:"200",monthly:"500"});
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const mult={day:30,week:4.33,month:1}[period];
  const pLabel={day:"Day",week:"Week",month:"Month"}[period];
  const callsIn=parseFloat(form.calls)||0; const callsMo=callsIn*mult;
  const missed=callsMo*((parseFloat(form.missedPct)||0)/100);
  const avgJob=parseFloat(form.avgJob)||0; const fee=parseFloat(form.monthly)||0;
  const recovered=missed*avgJob*0.4; const roi=fee>0?((recovered-fee)/fee)*100:0;
  const fmt=n=>`$${Math.round(n).toLocaleString()}`;
  const pitch=`You're getting about ${Math.round(callsMo)} calls a month and missing roughly ${Math.round(missed)} of them. At $${avgJob} average per job, that's ${fmt(missed*avgJob)} walking out the door every month. Reli AI answers every call — even after hours — for just $${fee}/month. Based on converting even 40% of those missed calls, you're looking at ${fmt(recovered)} recovered per month. That's a ${Math.round(roi)}% ROI.`;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={S.card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:C.blue}}>🧮 Client ROI Calculator</p>
          <div style={{display:"flex",borderRadius:7,overflow:"hidden",border:`1px solid ${C.border}`}}>{["day","week","month"].map(p=><button key={p} onClick={()=>setPeriod(p)} style={{background:period===p?C.blue:"transparent",color:period===p?"#fff":C.muted,border:"none",padding:"5px 14px",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:period===p?600:400}}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>)}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:4}}>
          <F label={`CALLS PER ${pLabel.toUpperCase()}`}><input type="number" value={form.calls} onChange={set("calls")} style={S.input}/></F>
          <F label="% CALLS MISSED"><input type="number" value={form.missedPct} onChange={set("missedPct")} style={S.input}/></F>
          <F label="AVERAGE JOB VALUE ($)"><input type="number" value={form.avgJob} onChange={set("avgJob")} style={S.input}/></F>
          <F label="RELI AI MONTHLY FEE ($)"><input type="number" value={form.monthly} onChange={set("monthly")} style={S.input}/></F>
        </div>
        {period!=="month"&&<p style={{margin:"4px 0 0",fontSize:11,color:C.muted}}>{callsIn} calls/{period} → <strong style={{color:"#64748b"}}>{Math.round(callsMo)} calls/month</strong></p>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[{l:"Missed Calls / Month",v:Math.round(missed),c:C.red},{l:"Revenue Lost / Month",v:fmt(missed*avgJob),c:C.red},{l:"Recovered Revenue / Month",v:fmt(recovered),c:C.green},{l:"Net Gain After Reli Fee",v:fmt(recovered-fee),c:recovered>fee?C.green:C.red},{l:"ROI",v:`${Math.round(roi)}%`,c:roi>0?C.green:C.red},{l:"Annual Recovered Revenue",v:fmt(recovered*12),c:C.purple}].map(s=>(
          <div key={s.l} style={{...S.card,background:"#060a12"}}><div style={{fontSize:22,fontWeight:800,color:s.c,fontFamily:"monospace"}}>{s.v}</div><div style={{fontSize:10,color:C.muted,marginTop:4}}>{s.l}</div></div>
        ))}
      </div>
      <div style={{...S.card,background:C.green+"08",border:`1px solid ${C.green}25`}}>
        <span style={S.label}>PITCH SUMMARY</span>
        <p style={{color:"#bbf7d0",fontSize:13,lineHeight:1.7,margin:0}}>{pitch}</p>
        <button onClick={()=>navigator.clipboard.writeText(pitch)} style={{...S.ghost,marginTop:10}}>📋 Copy Pitch</button>
      </div>
    </div>
  );
}

// ── OFFERS ────────────────────────────────────────────────────────────────────
function Offers() {
  const [form,setForm]=useState({clientName:"",biz:"",niche:"barbershop",tier:"mid",urgency:"standard"});
  const [out,setOut]=useState(""); const [loading,setLoading]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const PKGS={low:{name:"Starter",setup:200,monthly:400,feats:["AI call answering","Appointment booking","After-hours coverage","Monthly report"]},mid:{name:"Growth",setup:300,monthly:500,feats:["Everything in Starter","Custom call script","CRM integration","Priority support"]},high:{name:"Pro",setup:400,monthly:700,feats:["Everything in Growth","Multi-line support","Advanced AI flows","Weekly reports"]}};
  const pkg=PKGS[form.tier];
  const gen=async()=>{setLoading(true);setOut("");setOut(await callClaude("Write persuasive sales offers for an AI receptionist agency. Confident and professional.",`Offer to ${form.clientName||"the client"} (${form.biz}, ${form.niche}). Package: ${pkg.name} — $${pkg.setup} setup + $${pkg.monthly}/month. Features: ${pkg.feats.join(", ")}. Urgency: ${form.urgency}. Under 150 words. Chris, 18yo local entrepreneur. Mention what system does for THEIR biz type. Clear CTA.`));setLoading(false);};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={S.card}>
        <p style={{color:C.blue,fontSize:13,margin:"0 0 14px",fontWeight:600}}>💼 Offer Generator</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <F label="CLIENT NAME"><input value={form.clientName} onChange={set("clientName")} placeholder="Marcus" style={S.input}/></F>
          <F label="BUSINESS NAME"><input value={form.biz} onChange={set("biz")} placeholder="King's Cuts" style={S.input}/></F>
          <F label="BUSINESS TYPE"><select value={form.niche} onChange={set("niche")} style={S.sel}>{NICHES.map(n=><option key={n}>{n}</option>)}</select></F>
          <F label="URGENCY"><select value={form.urgency} onChange={set("urgency")} style={S.sel}>{["standard","limited spots this month","this week only discount","follow-up after demo"].map(u=><option key={u}>{u}</option>)}</select></F>
        </div>
        <span style={S.label}>PACKAGE</span>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
          {Object.entries(PKGS).map(([k,v])=>(
            <div key={k} onClick={()=>setForm(f=>({...f,tier:k}))} style={{padding:12,borderRadius:8,border:`2px solid ${form.tier===k?TIERS[k].color:C.border}`,background:form.tier===k?TIERS[k].color+"10":"#060a12",cursor:"pointer"}}>
              <div style={{fontSize:13,fontWeight:700,color:TIERS[k].color}}>{v.name}</div>
              <div style={{fontSize:10,color:C.muted,marginTop:1}}>${v.setup} setup</div>
              <div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:"monospace",marginTop:4}}>${v.monthly}<span style={{fontSize:10,color:C.muted}}>/mo</span></div>
              {v.feats.slice(0,2).map(f=><div key={f} style={{fontSize:9,color:"#334155",marginTop:3}}>✓ {f}</div>)}
            </div>
          ))}
        </div>
        <button onClick={gen} style={{...S.btn,width:"100%"}} disabled={loading}>{loading?"Generating...":"⚡ Generate Offer"}</button>
      </div>
      {loading?<Spin/>:<Out text={out}/>}
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
function Onboarding() {
  const STEPS=[
    {s:"📋 Before Setup",items:["Send signed contract","Collect setup fee","Get business phone number","Get business hours (inc. after-hours)","Get full service list","Get booking system info","Ask how they currently handle appointments"]},
    {s:"🔧 Retell AI Setup",items:["Create new agent in Retell AI","Name agent after business","Set up call script w/ hours/services","Configure appointment booking flow","Set after-hours message","Test all call flows internally","Forward client number to Retell number"]},
    {s:"🧪 Testing",items:["Make test call — confirm agent answers","Test full booking flow end to end","Test after-hours message","Test transfer-to-human option","Review call quality, adjust script"]},
    {s:"🚀 Go Live",items:["Confirm number forwarding is live","Send client go-live confirmation","Walk client through reports","Set Day 7 check-in reminder","Set monthly reporting reminder"]},
    {s:"📊 Ongoing",items:["Week 1: Check call volume + quality","Month 1: Send performance report","Month 1: Ask for referral if happy","Ongoing: Monitor for issues"]},
  ];
  const [checked,setChecked]=useState({});
  const toggle=k=>setChecked(c=>({...c,[k]:!c[k]}));
  const total=STEPS.reduce((s,sec)=>s+sec.items.length,0);
  const done=Object.values(checked).filter(Boolean).length;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={S.card}><span style={S.label}>PROGRESS</span><div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:22,fontWeight:800,color:C.green,fontFamily:"monospace"}}>{done}/{total}</span><div style={{flex:1,height:5,background:C.dim,borderRadius:99}}><div style={{height:"100%",background:`linear-gradient(90deg,${C.green},${C.blue})`,borderRadius:99,width:`${(done/total)*100}%`,transition:"width 0.3s"}}/></div><button onClick={()=>setChecked({})} style={{...S.ghost,fontSize:10,padding:"3px 8px"}}>Reset</button></div></div>
      {STEPS.map(sec=>(
        <div key={sec.s} style={S.card}><p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:C.text}}>{sec.s}</p>{sec.items.map((item,i)=>{const k=`${sec.s}-${i}`;const isDone=!!checked[k];return(<div key={i} onClick={()=>toggle(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer",opacity:isDone?0.35:1}}><div style={{width:15,height:15,borderRadius:3,border:`2px solid ${isDone?C.green:C.dim}`,background:isDone?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#000",flexShrink:0}}>{isDone&&"✓"}</div><span style={{color:isDone?C.dim:"#94a3b8",fontSize:12,textDecoration:isDone?"line-through":"none"}}>{item}</span></div>);})}</div>
      ))}
    </div>
  );
}

// ── CONTRACT ──────────────────────────────────────────────────────────────────
function Contract() {
  const [form,setForm]=useState({clientName:"",clientBiz:"",clientAddress:"",startDate:"",monthlyFee:"500",setupFee:"300",niche:"barbershop",term:"month-to-month"});
  const [out,setOut]=useState(""); const [loading,setLoading]=useState(false);
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const gen=async()=>{setLoading(true);setOut("");setOut(await callClaude("Legal document drafter. Professional service contracts.formal language.",`AI receptionist contract for Reli AI (Chris, Chattanooga TN): Client: ${form.clientName}, Business: ${form.clientBiz} (${form.niche}), Address: ${form.clientAddress}, Start: ${form.startDate}, Setup: $${form.setupFee}, Monthly: $${form.monthlyFee}, Term: ${form.term}. Sections: Parties, Services, Payment Terms, Term & Termination, Confidentiality, Limitation of Liability, Tennessee law, Signatures.`));setLoading(false);};
  return (<div style={{display:"flex",flexDirection:"column",gap:14}}><div style={S.card}><p style={{color:C.blue,fontSize:13,margin:"0 0 14px",fontWeight:600}}>📝 Contract Generator</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><F label="CLIENT NAME"><input value={form.clientName} onChange={set("clientName")} placeholder="Marcus Johnson" style={S.input}/></F><F label="BUSINESS NAME"><input value={form.clientBiz} onChange={set("clientBiz")} placeholder="King's Cuts" style={S.input}/></F><F label="BUSINESS TYPE"><select value={form.niche} onChange={set("niche")} style={S.sel}>{NICHES.map(n=><option key={n}>{n}</option>)}</select></F><F label="ADDRESS"><input value={form.clientAddress} onChange={set("clientAddress")} placeholder="123 Main St, Chattanooga TN" style={S.input}/></F><F label="START DATE"><input type="date" value={form.startDate} onChange={set("startDate")} style={S.input}/></F><F label="TERM"><select value={form.term} onChange={set("term")} style={S.sel}>{["month-to-month","3-month minimum","6-month minimum","1-year"].map(t=><option key={t}>{t}</option>)}</select></F><F label="SETUP FEE ($)"><input type="number" value={form.setupFee} onChange={set("setupFee")} style={S.input}/></F><F label="MONTHLY FEE ($)"><input type="number" value={form.monthlyFee} onChange={set("monthlyFee")} style={S.input}/></F></div><button onClick={gen} style={{...S.btn,width:"100%",marginTop:6}} disabled={loading||!form.clientName||!form.clientBiz}>{loading?"Generating...":"📝 Generate Contract"}</button></div>{loading?<Spin/>:out&&<div style={S.card}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={S.label}>CONTRACT</span><div style={{display:"flex",gap:8}}><button onClick={()=>navigator.clipboard.writeText(out)} style={S.ghost}>📋 Copy</button><button onClick={()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([out],{type:"text/plain"}));a.download=`Reli_Contract_${form.clientBiz.replace(/\s+/g,"_")}.txt`;a.click();}} style={S.ghost}>⬇️ Download</button></div></div><pre style={{color:"#cbd5e1",fontSize:12,lineHeight:1.75,whiteSpace:"pre-wrap",margin:0,fontFamily:"inherit"}}>{out}</pre></div>}</div>);
}

// ── WEBSITE BUILDER ───────────────────────────────────────────────────────────
function Website() {
  const [form,setForm]=useState({bizName:"",tagline:"",phone:"",address:"",description:"",style:"modern dark",niche:"barbershop"});
  const [logoB64,setLogoB64]=useState(null); const [logoName,setLogoName]=useState(""); const [extras,setExtras]=useState([]);
  const [html,setHtml]=useState(""); const [loading,setLoading]=useState(false); const [view,setView]=useState("preview"); const [clientUrl,setClientUrl]=useState("");
  const logoRef=useRef(null); const extRef=useRef(null);
  const readB64=f=>new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f);});
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const build=async()=>{setLoading(true);setHtml("");setClientUrl("");const p=`Build a complete beautiful single-file HTML website. Business: ${form.bizName} | Tagline: ${form.tagline} | Phone: ${form.phone} | Address: ${form.address} | Desc: ${form.description} | Industry: ${form.niche} | Style: ${form.style} ${logoB64?`Logo in header: <img src="${logoB64}" style="max-height:80px;">`:""}. Self-contained HTML+CSS+JS, mobile responsive, hero/services/why us/contact form. Return ONLY <!DOCTYPE html>.`;try{const raw=await callClaude("Expert web designer. Return ONLY raw HTML starting with <!DOCTYPE html>. No markdown.",p);const clean=raw.replace(/^```html\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();setHtml(clean);setClientUrl(URL.createObjectURL(new Blob([clean],{type:"text/html"})));setView("preview");}catch(e){setHtml(`<html><body style="background:#111;color:red;padding:40px">Error: ${e.message}</body></html>`);}setLoading(false);};
  return (<div style={{display:"flex",flexDirection:"column",gap:14}}><div style={S.card}><p style={{color:C.blue,fontSize:13,margin:"0 0 14px",fontWeight:600}}>🌐 Website Builder</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><F label="BUSINESS NAME"><input value={form.bizName} onChange={set("bizName")} placeholder="King's Cuts" style={S.input}/></F><F label="TAGLINE"><input value={form.tagline} onChange={set("tagline")} placeholder="Best cuts in Chattanooga" style={S.input}/></F><F label="PHONE"><input value={form.phone} onChange={set("phone")} placeholder="(423) 555-0100" style={S.input}/></F><F label="ADDRESS"><input value={form.address} onChange={set("address")} placeholder="123 Main St, Chattanooga" style={S.input}/></F><F label="INDUSTRY"><select value={form.niche} onChange={set("niche")} style={S.sel}>{[...NICHES,"restaurant","gym"].map(n=><option key={n}>{n}</option>)}</select></F><F label="STYLE"><select value={form.style} onChange={set("style")} style={S.sel}>{["modern dark","clean light","bold & colorful","luxury minimal","professional blue","warm & friendly"].map(s=><option key={s}>{s}</option>)}</select></F></div><F label="DESCRIPTION"><textarea value={form.description} onChange={set("description")} placeholder="Services, what makes them unique..." style={{...S.textarea,height:55}}/></F><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}><div><span style={S.label}>LOGO</span><div onClick={()=>logoRef.current?.click()} style={{...S.input,cursor:"pointer",color:logoName?C.green:C.dim,display:"flex",alignItems:"center",gap:8}}>🖼 {logoName||"Upload logo"}</div><input ref={logoRef} type="file" accept="image/*" onChange={async e=>{const f=e.target.files[0];if(f){setLogoName(f.name);setLogoB64(await readB64(f));}}  } style={{display:"none"}}/></div><div><span style={S.label}>EXTRA PHOTOS</span><div onClick={()=>extRef.current?.click()} style={{...S.input,cursor:"pointer",color:extras.length?C.green:C.dim,display:"flex",alignItems:"center",gap:8}}>📷 {extras.length?`${extras.length} photo(s)`:"Upload photos"}</div><input ref={extRef} type="file" accept="image/*" multiple onChange={async e=>{const b64s=await Promise.all(Array.from(e.target.files).map(readB64));setExtras(p=>[...p,...b64s]);}} style={{display:"none"}}/></div></div>{logoB64&&<div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}><img src={logoB64} alt="logo" style={{width:40,height:40,borderRadius:7,objectFit:"cover",border:`1px solid ${C.border}`}}/><div><p style={{margin:0,fontSize:11,color:C.green}}>Logo ready ✓</p><button onClick={()=>{setLogoB64(null);setLogoName("");}} style={{...S.ghost,fontSize:10,padding:"2px 7px",marginTop:2}}>Remove</button></div></div>}<button onClick={build} style={{...S.btn,width:"100%"}} disabled={loading||!form.bizName}>{loading?"🔨 Building...":"⚡ Generate Website"}</button></div>{html&&<div style={S.card}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}><div style={{display:"flex",borderRadius:6,overflow:"hidden",border:`1px solid ${C.border}`}}>{[["preview","👁 Preview"],["code","💻 Code"]].map(([v,l])=><button key={v} onClick={()=>setView(v)} style={{background:view===v?C.blue:"transparent",color:view===v?"#fff":C.muted,border:"none",padding:"5px 14px",cursor:"pointer",fontSize:12}}>{l}</button>)}</div><div style={{display:"flex",gap:8}}>{clientUrl&&<a href={clientUrl} target="_blank" rel="noreferrer" style={{...S.btn,textDecoration:"none",fontSize:12,padding:"6px 14px"}}>🔗 Client Link</a>}{view==="code"&&<button onClick={()=>navigator.clipboard.writeText(html)} style={S.ghost}>📋 Copy</button>}</div></div>{view==="preview"?<iframe srcDoc={html} style={{width:"100%",height:480,border:`1px solid ${C.border}`,borderRadius:8}} sandbox="allow-scripts allow-same-origin"/>:<pre style={{background:"#060a12",padding:14,borderRadius:8,overflowX:"auto",fontSize:11,color:"#7ab8ff",fontFamily:"monospace",maxHeight:480,overflowY:"auto",margin:0}}>{html}</pre>}</div>}{!html&&!loading&&<div style={{...S.card,textAlign:"center",padding:60,color:C.dim}}><div style={{fontSize:36,marginBottom:10}}>🌐</div><p>Fill in info, upload logo, AI builds the full site.</p></div>}</div>);
}

// ── ALL OTHER TOOLS ───────────────────────────────────────────────────────────
function SMSGen(){return<Tool sys="Short human-sounding SMS for local AI receptionist sales agency. Sound like real local person Chris. No AI buzzwords. Max 2 sentences." fields={[{key:"niche",label:"BUSINESS TYPE",type:"select",opts:NICHES},{key:"angle",label:"ANGLE",type:"select",opts:["cold outreach","follow-up (no reply)","follow-up (interested)","demo follow-up","check-in"]}]} buildPrompt={v=>`3 SMS variants for ${v.niche||"barbershop"} owner. Angle: ${v.angle||"cold outreach"}. Chattanooga local tone. Under 2 sentences each.`} btnLabel="📱 Generate SMS"/>;}
function EmailGen(){return<Tool sys="Cold outreach emails for local AI receptionist agency. Professional but conversational. Include subject line." fields={[{key:"niche",label:"BUSINESS TYPE",type:"select",opts:NICHES},{key:"angle",label:"TYPE",type:"select",opts:["cold outreach","follow-up","demo confirmation","proposal follow-up"]},{key:"name",label:"NAME (optional)",type:"text",ph:"e.g. Mike"}]} buildPrompt={v=>`${v.angle||"Cold outreach"} email to ${v.name?v.name:"a"} ${v.niche||"barbershop"} owner. Reli AI phone receptionist. From: Chris. Subject + body. Under 150 words.`} btnLabel="📧 Generate Email"/>;}
function DMGen(){return<Tool sys="Short human DMs for local AI receptionist agency. No AI buzzwords. Sign off as Chris from Reli." fields={[{key:"platform",label:"PLATFORM",type:"select",opts:["Instagram","Facebook","LinkedIn","Twitter/X"]},{key:"niche",label:"BUSINESS TYPE",type:"select",opts:NICHES}]} buildPrompt={v=>`Cold DM for ${v.platform||"Instagram"} targeting ${v.niche||"barbershop"} owner in Chattanooga TN. Under 3 sentences. Casual and local.`} btnLabel="✉️ Generate DM"/>;}
function LinkedInContent(){return<Tool sys="LinkedIn content for young entrepreneur running AI receptionist agency. Authentic, thought-leadership." fields={[{key:"type",label:"TYPE",type:"select",opts:["value post","founder story","client result","industry insight","connection request"]},{key:"topic",label:"TOPIC",type:"text",ph:"e.g. why local businesses lose $10k/year to missed calls"}]} buildPrompt={v=>`LinkedIn ${v.type||"value post"} for Chris, 18yo founder of Reli AI, Chattanooga TN. Topic: ${v.topic||"AI receptionists for local businesses"}. Real founder tone, not corporate. Hook, value, CTA. Under 200 words.`} btnLabel="💼 Generate LinkedIn Post"/>;}
function ABTester(){return<Tool sys="A/B variants for outreach messages. Return 3 labeled A, B, C. Each under 3 sentences." fields={[{key:"msg",label:"ORIGINAL MESSAGE",type:"textarea",ph:"Paste your SMS, email, or DM...",h:90}]} buildPrompt={v=>`Original:\n${v.msg}\n\nCreate 3 A/B variants. Different hook and CTA. Human, not AI-sounding.`} btnLabel="⚖️ Generate A/B Variants"/>;}
function CallScript(){return<Tool sys="Cold call scripts for local AI receptionist agency. Natural, not robotic." fields={[{key:"niche",label:"BUSINESS TYPE",type:"select",opts:[...NICHES,"dentist"]}]} buildPrompt={v=>`Call script targeting ${v.niche||"barbershop"} owner. AI phone receptionist, $400-700/mo. Opener, pain question, pitch, demo offer, one objection, close. Under 60 sec. Speaker labels.`} btnLabel="📞 Generate Call Script"/>;}
function ProposalGen(){return<Tool sys="Concise persuasive sales proposals for AI receptionist agency." fields={[{key:"name",label:"CLIENT NAME",type:"text",ph:"Mike Johnson"},{key:"biz",label:"BUSINESS NAME",type:"text",ph:"King's Cuts"},{key:"niche",label:"TYPE",type:"select",opts:NICHES},{key:"pain",label:"PAIN POINT",type:"text",ph:"misses calls while cutting hair"}]} buildPrompt={v=>`Proposal for ${v.name} (${v.biz}, ${v.niche}). Pain: ${v.pain}. Include problem, solution (Reli AI), benefits, pricing ($300 setup + $400-700/mo), ROI, CTA.`} btnLabel="📄 Generate Proposal"/>;}
function CaseStudy(){return<Tool sys="Projection-based case studies for AI receptionist agency. Frame as 'typical results'." fields={[{key:"niche",label:"BUSINESS TYPE",type:"select",opts:NICHES}]} buildPrompt={v=>`30-day case study for ${v.niche||"barbershop"} using Reli AI. Fictional business, problem, solution, results (calls, appointments, recovered revenue). Realistic numbers.`} btnLabel="📊 Generate Case Study"/>;}
function NicheResearch(){
  const [niche,setNiche]=useState(""); const [out,setOut]=useState(""); const [loading,setLoading]=useState(false);
  const go=async n=>{const q=n||niche;setLoading(true);setOut("");setOut(await callClaude("Research niches for AI phone receptionist agency. Specific and practical.",`Analyze ${q} for Reli AI. Why they miss calls, avg revenue/client, best channels, best time, key pain points, sample SMS opener.`));setLoading(false);};
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={S.card}><span style={S.label}>NICHE</span><div style={{display:"flex",gap:10,marginBottom:12}}><input value={niche} onChange={e=>setNiche(e.target.value)} placeholder="e.g. plumbers, nail salons..." style={S.input}/><button onClick={()=>go()} style={S.btn} disabled={loading||!niche.trim()}>Research</button></div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["roofers","barbershops","hair salons","plumbers","HVAC","landscapers","dentists"].map(n=><button key={n} onClick={()=>{setNiche(n);go(n);}} style={S.ghost}>{n}</button>)}</div></div>{loading?<Spin/>:<Out text={out}/>}</div>);
}
function InstaCaptions(){
  const quick=["Missed calls cost money","AI receptionist demo","Client results","How Reli AI works","Behind the scenes"];
  const [type,setType]=useState("Value Post"); const [topic,setTopic]=useState(""); const [out,setOut]=useState(""); const [loading,setLoading]=useState(false);
  const go=async t=>{setLoading(true);setOut("");setOut(await callClaude("Instagram captions for young entrepreneur running AI receptionist agency. Authentic.",`3 captions. Type: ${type}. Topic: ${t||topic}. Chris, 18, Chattanooga. Real and personal. Hashtags. Different hook each.`));setLoading(false);};
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={S.card}><span style={S.label}>POST TYPE</span><select value={type} onChange={e=>setType(e.target.value)} style={{...S.sel,marginBottom:12}}>{["Value Post","Behind the scenes","Client win","Educational","Personal story"].map(t=><option key={t}>{t}</option>)}</select><span style={S.label}>QUICK TOPICS</span><div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>{quick.map(q=><button key={q} onClick={()=>go(q)} style={S.ghost}>{q}</button>)}</div><span style={S.label}>CUSTOM</span><div style={{display:"flex",gap:10}}><input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. how AI answered 47 calls this month" style={S.input}/><button onClick={()=>go()} style={S.btn} disabled={loading||!topic.trim()}>Generate</button></div></div>{loading?<Spin/>:<Out text={out}/>}</div>);
}
function FBPosts(){return<Tool sys="Facebook group posts for local entrepreneur selling AI phone receptionists. Not ads." fields={[{key:"group",label:"GROUP TYPE",type:"select",opts:["local business","Chattanooga entrepreneurs","home services","barbershop owners","roofing contractors"]},{key:"angle",label:"ANGLE",type:"select",opts:["question","value tip","personal story","case study"]}]} buildPrompt={v=>`Post for ${v.group||"local business"} group in Chattanooga. Angle: ${v.angle||"question"}. Don't mention AI first sentence. Sound local. Soft CTA.`} btnLabel="📘 Generate Post"/>;}
function CCOpeners(){return<Tool sys="Cold call openers for local AI phone receptionist agency. Short, human, natural." fields={[{key:"niche",label:"BUSINESS TYPE",type:"select",opts:NICHES}]} buildPrompt={v=>`5 cold call openers targeting ${v.niche||"barbershop"} owners. Under 15 sec each. Vary: curiosity, problem-first, referral-style, direct, compliment. Don't mention AI upfront.`} btnLabel="🎙️ Generate Openers"/>;}
function FollowUp(){return<Tool sys="Follow-up messages for local AI receptionist agency. Short, human, not pushy." fields={[{key:"name",label:"PROSPECT",type:"text",ph:"Mike's Barbershop"},{key:"status",label:"LAST STATUS",type:"select",opts:["no reply","said maybe","asked for more info","seemed interested but ghosted","said call back later"]},{key:"days",label:"DAYS SINCE",type:"text",ph:"3"}]} buildPrompt={v=>`Follow-up for ${v.name} who had '${v.status||"no reply"}' after ${v.days||"3"} days. Under 3 sentences. Casual local tone. Re-open conversation.`} btnLabel="📅 Generate Follow-Up"/>;}

// ── AI CHAT ───────────────────────────────────────────────────────────────────
function AIChat() {
  const [{clients,integrations}] = useStore();
  const mrr = clients.reduce((s,c)=>s+(c.fee||0),0);
  const connectedIntegrations = Object.entries(integrations).filter(([,v])=>!!v).map(([k])=>k).join(", ")||"none yet";
  const clientSummary = clients.length>0?clients.map(c=>`${c.biz} (${c.niche}, ${TIERS[c.tier]?.label}, $${c.fee}/mo)`).join("; "):"no clients yet";
  const nextIdx = MILESTONES.findIndex(m=>mrr<m.mrr);
  const nextM = MILESTONES[Math.max(0,nextIdx)];
  const zapierUrl = integrations?.zapier || null;
  const slackUrl = integrations?.slack || null;

  const triggerWebhook = async (url, payload) => {
    try { await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) }); return true; } catch { return false; }
  };

  const SYSTEM = `You are the AI inside Reli AI OS — business dashboard for Chris, 18yo entrepreneur Chattanooga TN, running Reli AI (AI voice receptionist agency using Retell AI).

LIVE APP STATE RIGHT NOW:
- Clients: ${clients.length} active | MRR: $${mrr}/mo | ARR: $${mrr*12}/mo
- Client list: ${clientSummary}
- Next milestone: ${nextM?.label} (target: $${nextM?.mrr}/mo)
- ${nextM&&mrr<nextM.mrr?`Need $${nextM.mrr-mrr} more MRR — roughly ${Math.ceil((nextM.mrr-mrr)/500)} clients at $500/mo avg`:""}
- Connected integrations: ${connectedIntegrations}

WHAT YOU CAN ACTUALLY DO:
${zapierUrl ? "- ✅ ZAPIER connected — if Chris says 'send to Zapier' or 'trigger Zapier', respond with the JSON payload you'd send and tell him you're triggering it. Format: {action, data}" : "- ❌ Zapier not connected — tell Chris to connect it in the Integrations tab to unlock automation"}
${slackUrl ? "- ✅ SLACK connected — if Chris says 'send to Slack' or 'ping Slack', respond with the message you'd send and say you're firing the webhook" : "- ❌ Slack not connected — suggest connecting it for instant deal alerts"}
- Gmail/Calendar: NOT directly connected (would need OAuth). Tell Chris to use Zapier to bridge these — e.g. "Add a Zap: Webhook → Gmail" to auto-send emails when triggered.
- Stripe: ${integrations?.stripe ? "✅ Connected — payment links can be created in the Payments tab" : "❌ Not connected"}
- Retell AI: ${integrations?.retell ? "✅ API key saved — use the Retell Prompt Generator to build agent scripts" : "❌ Not connected"}

BUSINESS CONTEXT:
- AI phone receptionists powered by Retell AI
- Targets: barbershops, roofers, salons, plumbers, HVAC, landscapers
- Pricing: Starter $400/mo, Growth $500/mo, Pro $700/mo + setup fee
- Outreach: Outscraper (Google Maps scraping), StraightText (bulk SMS), cold calls, Facebook groups
- Personal goal: BMW M3 G80 by end of year

Be direct, casual, specific. Reference actual numbers. If Chris asks you to take an action (send Slack message, trigger Zapier), tell him exactly what you'd send and what he needs to set up to make it happen automatically. No filler.`;
  const [msgs,setMsgs] = useState([{role:"assistant",content:`Hey Chris 👋 I can see your whole dashboard right now.\n\n📊 ${clients.length} client${clients.length!==1?"s":""} · $${mrr}/mo MRR · Next: ${nextM?.label}\n${connectedIntegrations!=="none yet"?`⚙ Connected: ${connectedIntegrations}`:""}\n\nWhat do you need?`}]);
  const [input,setInput] = useState(""); const [loading,setLoading] = useState(false);
  const bottom = useRef(null);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const send = async () => {
    if(!input.trim()||loading) return;
    const u=input.trim(); setInput("");
    const newMsgs=[...msgs,{role:"user",content:u}]; setMsgs(newMsgs); setLoading(true);
    const hist=newMsgs.slice(1).map(m=>({role:m.role,content:m.content})); const last=hist.pop();
    try{
      const reply=await callClaude(SYSTEM,last?.content||u,hist);
      setMsgs(m=>[...m,{role:"assistant",content:reply}]);
      // Auto-trigger webhooks if user asked for it
      const lowerU = u.toLowerCase();
      if(zapierUrl && (lowerU.includes("zapier") || lowerU.includes("trigger") || lowerU.includes("automate"))) {
        triggerWebhook(zapierUrl, {source:"Reli AI OS Chat", message:u, timestamp:new Date().toISOString(), mrr, clients:clients.length});
      }
      if(slackUrl && (lowerU.includes("slack") || lowerU.includes("ping") || lowerU.includes("notify"))) {
        triggerWebhook(slackUrl, {text:`*Reli AI OS*: ${u}`, mrr, clients:clients.length});
      }
    }
    catch{setMsgs(m=>[...m,{role:"assistant",content:"Error. Try again."}]);}
    setLoading(false);
  };
  return (
    <div style={{display:"flex",flexDirection:"column",height:560}}>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <Tag color={C.green}>{clients.length} clients</Tag>
        <Tag color={C.blue}>${mrr}/mo MRR</Tag>
        <Tag color={C.purple}>{nextM?.label} next</Tag>
        {Object.entries(integrations).filter(([,v])=>!!v).map(([k])=><Tag key={k} color={C.yellow}>{k} ✓</Tag>)}
      </div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingBottom:8}}>
        {msgs.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:m.role==="user"?"13px 13px 4px 13px":"13px 13px 13px 4px",background:m.role==="user"?C.indigo+"18":C.card,border:`1px solid ${m.role==="user"?C.indigo+"30":C.border}`,color:"#cbd5e1",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{m.content}</div></div>))}
        {loading&&<div style={{display:"flex"}}><div style={{padding:"10px 14px",borderRadius:"13px 13px 13px 4px",background:C.card,border:`1px solid ${C.border}`,color:C.dim,fontSize:13}}>thinking...</div></div>}
        <div ref={bottom}/>
      </div>
      <div style={{...S.card,display:"flex",gap:10,marginTop:10}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask anything — I can see your clients, MRR, milestones, and integrations..." style={{...S.input,flex:1}} disabled={loading}/>
        <button onClick={send} style={S.btn} disabled={loading||!input.trim()}>→</button>
      </div>
    </div>
  );
}

// ── OBJECTION HANDLER ─────────────────────────────────────────────────────────
function ObjHandler() {
  const quick=["I already have a receptionist","We don't get that many calls","Too expensive","I need to think about it","How does it work?","I don't trust AI"];
  const [obj,setObj]=useState(""); const [out,setOut]=useState(""); const [loading,setLoading]=useState(false);
  const go=async o=>{setLoading(true);setOut("");setOut(await callClaude("Sales coach for AI phone receptionist agency. Short confident rebuttals.",`Objection: "${o||obj}". 2-3 sentence rebuttal. Call it 'the system'. End with soft close.`));setLoading(false);};
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={S.card}><span style={S.label}>QUICK OBJECTIONS</span><div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>{quick.map(q=><button key={q} onClick={()=>go(q)} style={S.ghost}>{q}</button>)}</div><span style={S.label}>CUSTOM</span><div style={{display:"flex",gap:10}}><input value={obj} onChange={e=>setObj(e.target.value)} placeholder="Type objection..." style={S.input}/><button onClick={()=>go()} style={S.btn} disabled={loading||!obj.trim()}>Handle</button></div></div>{loading?<Spin/>:<Out text={out}/>}</div>);
}

function OutreachStats() {
  const [s,setS]=useState({sent:"",replies:"",demos:"",closed:""});
  const [out,setOut]=useState(""); const [loading,setLoading]=useState(false);
  const go=async()=>{setLoading(true);setOut("");setOut(await callClaude("Sales coach analyzing outreach funnel. Direct and brief.",`Sent: ${s.sent}, Replies: ${s.replies}, Demos: ${s.demos}, Closed: ${s.closed}. Analyze funnel. Weakest point. 3 specific improvements this week.`));setLoading(false);};
  const rr=(a,b)=>b&&+b?`${Math.round((+a/+b)*100)}%`:"—";
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={S.card}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>{[["sent","MESSAGES SENT"],["replies","REPLIES"],["demos","DEMOS BOOKED"],["closed","DEALS CLOSED"]].map(([k,l])=>(<div key={k}><span style={S.label}>{l}</span><input type="number" value={s[k]} onChange={e=>setS(x=>({...x,[k]:e.target.value}))} placeholder="0" style={S.input}/></div>))}</div><button onClick={go} style={{...S.btn,width:"100%"}} disabled={loading}>{loading?"Analyzing...":"📊 Analyze Funnel"}</button></div>{s.sent&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>{[{l:"Reply Rate",v:rr(s.replies,s.sent),c:C.blue},{l:"Demo Rate",v:rr(s.demos,s.replies),c:C.purple},{l:"Close Rate",v:rr(s.closed,s.demos),c:C.green}].map(x=>(<div key={x.l} style={{...S.card,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:x.c,fontFamily:"monospace"}}>{x.v}</div><div style={{fontSize:9,color:C.muted,marginTop:4}}>{x.l}</div></div>))}</div>}{loading?<Spin/>:<Out text={out}/>}</div>);
}

// ── COLLAPSIBLE SIDEBAR NAV ───────────────────────────────────────────────────
const NAV_GROUPS = [
  { section: null, items: [
    {id:"home",label:"Dashboard",icon:"🏠"},
    {id:"clients",label:"Clients",icon:"👥"},
    {id:"milestones",label:"Milestones",icon:"🏆"},
    {id:"payments",label:"Payments",icon:"💳"},
    {id:"goals",label:"Daily Goals",icon:"🎯"},
    {id:"chat",label:"AI Assistant",icon:"🤖"},
  ]},
  { section:"INTEGRATIONS", items:[
    {id:"integrations",label:"API & Webhooks",icon:"⚙"},
  ]},
  { section:"OUTREACH", items:[
    {id:"sms",label:"SMS Generator",icon:"📱"},
    {id:"email",label:"Email Generator",icon:"📧"},
    {id:"dms",label:"DM Generator",icon:"✉️"},
    {id:"linkedin",label:"LinkedIn Content",icon:"💼"},
    {id:"abtester",label:"AB Tester",icon:"⚖️"},
    {id:"stats",label:"Outreach Stats",icon:"📊"},
  ]},
  { section:"CLOSING", items:[
    {id:"objections",label:"Objection Handler",icon:"🛡"},
    {id:"callscript",label:"Call Script",icon:"📞"},
    {id:"offers",label:"Offer Generator",icon:"💼"},
    {id:"roi",label:"ROI Calculator",icon:"🧮"},
    {id:"proposal",label:"Proposal Generator",icon:"📄"},
    {id:"casestudy",label:"Case Study",icon:"📈"},
    {id:"contract",label:"Contract Generator",icon:"📝"},
  ]},
  { section:"CLIENTS", items:[
    {id:"onboarding",label:"Onboarding Checklist",icon:"✅"},
    {id:"niche",label:"Niche Research",icon:"🔍"},
    {id:"retell",label:"Retell Prompt Gen",icon:"🎙"},
  ]},
  { section:"CONTENT", items:[
    {id:"instagram",label:"Instagram Captions",icon:"📸"},
    {id:"facebook",label:"Facebook Posts",icon:"👥"},
    {id:"openers",label:"Cold Call Openers",icon:"🎙"},
  ]},
  { section:"TOOLS", items:[
    {id:"followup",label:"Follow-Up Scheduler",icon:"📅"},
    {id:"website",label:"Website Builder",icon:"🌐"},
  ]},
];

const TITLES = {home:"Dashboard",clients:"Clients",milestones:"Milestone Tracker",payments:"Payments",goals:"Daily Goals",chat:"AI Assistant",integrations:"Integrations",sms:"SMS Generator",email:"Email Generator",dms:"DM Generator",linkedin:"LinkedIn Content",abtester:"AB Tester",stats:"Outreach Stats",objections:"Objection Handler",callscript:"Call Script",offers:"Offer Generator",roi:"ROI Calculator",proposal:"Proposal Generator",casestudy:"Case Study",contract:"Contract Generator",onboarding:"Onboarding Checklist",niche:"Niche Research",retell:"Retell Prompt Generator",instagram:"Instagram Captions",facebook:"Facebook Posts",openers:"Cold Call Openers",followup:"Follow-Up Scheduler",website:"Website Builder"};

function SidebarGroup({ group, page, setPage, collapsed }) {
  const [open, setOpen] = useState(true);
  if (collapsed) {
    return (
      <div>
        {group.section && <div style={{height:1,background:C.border,margin:"4px 8px"}}/>}
        {group.items.map(item=>(
          <button key={item.id} title={item.label} onClick={()=>setPage(item.id)} style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:"8px 0",background:page===item.id?C.indigo+"20":"transparent",borderLeft:"none",border:"none",borderLeft:`2px solid ${page===item.id?C.indigo:"transparent"}`,color:page===item.id?"#818cf8":C.dim,fontSize:16,cursor:"pointer",fontFamily:"inherit",transition:"all 0.1s"}}>{item.icon}</button>
        ))}
      </div>
    );
  }
  return (
    <div>
      {group.section && (
        <button onClick={()=>setOpen(v=>!v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"8px 13px 2px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
          <span style={{fontSize:8,color:"#1e293b",fontFamily:"monospace",letterSpacing:1.5}}>{group.section}</span>
          <span style={{fontSize:9,color:"#1e293b"}}>{open?"▾":"▸"}</span>
        </button>
      )}
      {(open||!group.section) && group.items.map(item=>(
        <button key={item.id} onClick={()=>setPage(item.id)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"6px 13px",background:page===item.id?C.indigo+"18":"transparent",border:"none",borderLeft:`2px solid ${page===item.id?C.indigo:"transparent"}`,color:page===item.id?"#818cf8":"#334155",fontSize:12,cursor:"pointer",textAlign:"left",fontFamily:"inherit",whiteSpace:"nowrap",transition:"all 0.1s"}}>
          <span style={{fontSize:13}}>{item.icon}</span><span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function ReliOS() {
  const [{loaded}] = useStore();
  const [page,setPage] = useState("home");
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [collapsed,setCollapsed] = useState(false);

  if (!loaded) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#050914",flexDirection:"column",gap:16}}>
      <div style={{fontSize:32}}>⚡</div>
      <p style={{color:"#6366f1",fontFamily:"monospace",fontSize:14,letterSpacing:2}}>RELI AI OS</p>
      <p style={{color:"#1e293b",fontSize:12}}>Loading your data...</p>
    </div>
  );

  const getPage = (nav) => ({
    home:<Home onNav={nav}/>, clients:<Clients/>, milestones:<Milestones/>, payments:<Payments/>, goals:<Goals/>, chat:<AIChat/>, integrations:<Integrations/>,
    sms:<SMSGen/>, email:<EmailGen/>, dms:<DMGen/>, linkedin:<LinkedInContent/>, abtester:<ABTester/>, stats:<OutreachStats/>,
    objections:<ObjHandler/>, callscript:<CallScript/>, offers:<Offers/>, roi:<ROICalc/>, proposal:<ProposalGen/>, casestudy:<CaseStudy/>, contract:<Contract/>,
    onboarding:<Onboarding/>, niche:<NicheResearch/>, retell:<RetellPrompt/>,
    instagram:<InstaCaptions/>, facebook:<FBPosts/>, openers:<CCOpeners/>,
    followup:<FollowUp/>, website:<Website/>,
  });

  const sidebarWidth = !sidebarOpen ? 0 : collapsed ? 44 : 190;

  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,color:"#fff",fontFamily:"'Inter','Segoe UI',sans-serif",overflow:"hidden"}}>
      {/* SIDEBAR */}
      <div style={{width:sidebarWidth,minWidth:sidebarWidth,background:"#090f1d",borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden",transition:"width 0.2s,min-width 0.2s",flexShrink:0}}>
        {/* Logo */}
        <div style={{padding:collapsed?"12px 0":"12px 13px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:9,justifyContent:collapsed?"center":"flex-start"}}>
          <div style={{width:26,height:26,borderRadius:6,background:`linear-gradient(135deg,${C.indigo},${C.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0,color:"#fff"}}>R</div>
          {!collapsed&&<div><div style={{fontWeight:700,fontSize:13,whiteSpace:"nowrap",color:C.text}}>Reli AI</div><div style={{fontSize:8,color:"#1e293b",fontFamily:"monospace"}}>OS</div></div>}
        </div>
        {/* Nav items */}
        <div style={{flex:1,overflowY:"auto",padding:"4px 0"}}>
          {NAV_GROUPS.map((g,gi)=>(
            <SidebarGroup key={gi} group={g} page={page} setPage={setPage} collapsed={collapsed}/>
          ))}
        </div>
        {/* Collapse toggle */}
        {sidebarOpen&&<button onClick={()=>setCollapsed(v=>!v)} style={{padding:"8px",background:"none",border:"none",borderTop:`1px solid ${C.border}`,color:"#1e293b",cursor:"pointer",fontSize:11,fontFamily:"inherit",color:C.dim}}>{collapsed?"→":"← Collapse"}</button>}
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Topbar */}
        <div style={{padding:"11px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,background:C.bg,flexShrink:0}}>
          <button onClick={()=>setSidebarOpen(v=>!v)} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:15,padding:0}}>☰</button>
          <h1 style={{margin:0,fontSize:14,fontWeight:600,color:"#94a3b8"}}>{TITLES[page]||page}</h1>
          <div style={{marginLeft:"auto",fontSize:9,color:"#1e293b",fontFamily:"monospace"}}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}).toUpperCase()}</div>
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <div style={{maxWidth:860,margin:"0 auto"}}>{getPage(setPage)[page]}</div>
        </div>
      </div>
    </div>
  );
}
