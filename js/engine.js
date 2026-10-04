// ---- Engine (deterministic, tick-based, Manic Miner -style) ----
const U = 4;                 // units per tile
const COLS = 28, ROWS = 16;
const JUMP = [-2,-2,-2,-1,-1,-1,-1,0,0,1,1,1,1,2,2,2];
const MAXFALL = 20;          // units from peak; more = fatal
const CRUMBLE_HP = 8;
const CONV_SP = 3;           // conveyor speed, half-units per tick (1.5x walking)
const halfSteps=(sp,t)=>Math.floor(t*sp/2)-Math.floor((t-1)*sp/2);
// tile codes
const E=0, FLOOR=1, WALL=2, CRUMB=3, CONVL=4, CONVR=5, SPIKE=6, EXIT=7;
const CH = {'=':FLOOR,'#':WALL,'~':CRUMB,'<':CONVL,'>':CONVR,'^':SPIKE,'E':EXIT};

function parseLevel(def){
  const g = new Uint8Array(COLS*ROWS);
  let start=null; const keys=[]; let exit=null;
  def.map.forEach((row,r)=>{
    for(let c=0;c<COLS;c++){
      const ch=row[c]||'.';
      const t=CH[ch];
      if(t) g[r*COLS+c]=t;
      if(ch==='E') exit={r,c};
      if(ch==='k') keys.push({r,c});
      if(ch==='P') start={x:c*U, y:(r+1)*U};
    }
  });
  return {g, start, keys, exit};
}

function makeWorld(def, pieces){ // pieces: [{type,len,r,c}]
  const {g,start,keys,exit}=parseLevel(def);
  for(const p of (pieces||[])) if(p) for(let k=0;k<p.len;k++) g[p.r*COLS+p.c+k]=p.type;
  const cl=[]; for(let i=0;i<g.length;i++) if(g[i]===CRUMB) cl.push(i);
  const hpIdx=new Int16Array(g.length).fill(-1); cl.forEach((i,k)=>hpIdx[i]=k);
  const guards=(def.guards||[]).map(G=>{ const R=(G.c1-G.c0)*U; return {...G, R, P:2*R}; });
  return {g, cl, hpIdx, start, keys, exit, guards, allKeys:(1<<keys.length)-1};
}

function newState(w){
  return {x:w.start.x, y:w.start.y, m:0, jt:0, jd:0, peak:w.start.y, dead:0, won:0, t:0, keys:0,
          hp: Array(w.cl.length).fill(CRUMBLE_HP), cause:'', face:1};
}
function cloneS(s){ return {...s, hp:s.hp.slice()}; }

function guardPos(G,t){
  const p=t%G.P; const off = p<G.R ? p : G.P-p;
  const x = G.dir<0 ? G.c1*U-off : G.c0*U+off;
  return {x, y:(G.r+1)*U, d: (p<G.R ? 1 : -1)*(G.dir<0?-1:1)};
}

function tileAt(w,s,r,c){
  if(r<0||r>=ROWS||c<0||c>=COLS) return E;
  const i=r*COLS+c, t=w.g[i];
  if(t===CRUMB && s.hp[w.hpIdx[i]]<=0) return E;
  return t;
}
const standable = t => t===FLOOR||t===WALL||t===CRUMB||t===CONVL||t===CONVR;

function supportCols(w,s){
  if(s.y%U) return [];
  const r=s.y/U, c0=s.x>>2, c1=(s.x+U-1)>>2, out=[];
  for(let c=c0;c<=c1;c++) if(standable(tileAt(w,s,r,c))) out.push(c);
  return out;
}
function blocked(w,s,x,y){
  if(x<0 || x+U>COLS*U) return true;
  const r0=Math.floor((y-8)/U), r1=Math.floor((y-1)/U), c0=x>>2, c1=(x+U-1)>>2;
  for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++) if(tileAt(w,s,r,c)===WALL) return true;
  return false;
}
function land(s){
  s.m=0;
  if(s.y-s.peak>MAXFALL){ s.dead=1; s.cause='fall'; }
}
function checkHazards(w,s){
  if(s.y>ROWS*U+8){ s.dead=1; s.cause='pit'; return; }
  const bx0=s.x, bx1=s.x+U-1, by0=s.y-8, by1=s.y-1;
  const r0=Math.floor(by0/U), r1=Math.floor(by1/U), c0=bx0>>2, c1=bx1>>2;
  let atExit=false;
  for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++){
    const t=tileAt(w,s,r,c);
    if(t===SPIKE && by1>=r*U+2){ s.dead=1; s.cause='spike'; return; }
    if(t===EXIT) atExit=true;
  }
  w.keys.forEach((K,i)=>{ if(!(s.keys>>i&1) && K.r>=r0&&K.r<=r1&&K.c>=c0&&K.c<=c1) s.keys|=1<<i; });
  for(const G of w.guards){
    const p=guardPos(G,s.t);
    if(Math.abs(p.x-s.x)<3 && s.y-8 < p.y-1 && p.y-7 < s.y){ s.dead=1; s.cause='guard'; return; }
  }
  if(atExit && s.keys===w.allKeys) s.won=1;
}

// input: {dir:-1|0|1, jump:bool}
function step(w,s,inp){
  if(s.dead||s.won) return s;
  s.t++;
  if(s.m===0){
    const sup=supportCols(w,s);
    if(!sup.length){ s.m=2; s.peak=s.y; }
    else{
      let dir=inp.dir, sp=2;            // speed in half-units per tick
      for(const c of sup){
        const t=tileAt(w,s,s.y/U,c);
        if(t===CONVL){ dir=-1; sp=CONV_SP; } else if(t===CONVR){ dir=1; sp=CONV_SP; }
      }
      for(const c of sup){
        const i=(s.y/U)*COLS+c;
        if(w.g[i]===CRUMB) s.hp[w.hpIdx[i]]--;
      }
      if(dir) s.face=dir;
      if(inp.jump){ s.m=1; s.jt=0; s.jd=dir*sp; s.peak=s.y; }
      else { const n=halfSteps(sp,s.t); for(let k=0;k<n;k++) if(dir && !blocked(w,s,s.x+dir,s.y)) s.x+=dir; }
    }
  }
  if(s.m===1){
    const dy=JUMP[s.jt++];
    const jdir=Math.sign(s.jd), n=halfSteps(Math.abs(s.jd),s.jt);
    for(let k=0;k<n;k++) if(!blocked(w,s,s.x+jdir,s.y)) s.x+=jdir;
    if(dy<0){
      for(let k=0;k<-dy;k++){
        if(blocked(w,s,s.x,s.y-1)){ s.m=2; break; }
        s.y--;
      }
      if(s.y<s.peak) s.peak=s.y;
    } else if(dy>0){
      for(let k=0;k<dy;k++){ s.y++; if(supportCols(w,s).length){ land(s); break; } }
    }
    if(s.m===1 && s.jt>=JUMP.length) s.m=2;
  } else if(s.m===2){
    for(let k=0;k<2;k++){ s.y++; if(supportCols(w,s).length){ land(s); break; } }
  }
  // a melting tile you have stepped off is gone
  if(w.cl.length){
    const under = s.m===0 ? supportCols(w,s).map(c=>(s.y/U)*COLS+c) : [];
    for(let k=0;k<w.cl.length;k++) if(s.hp[k]>0 && s.hp[k]<CRUMBLE_HP && !under.includes(w.cl[k])) s.hp[k]=0;
  }
  checkHazards(w,s);
  return s;
}

// can a piece go here? (cells empty in the base map and not taken by other pieces)
function freeFor(def, piece, others){
  const {g,keys}=parseLevel(def);
  if(piece.r<1||piece.r>=ROWS||piece.c<0||piece.c+piece.len>COLS) return false;
  for(const o of others||[]) if(o) for(let k=0;k<o.len;k++) g[o.r*COLS+o.c+k]=FLOOR;
  for(let k=0;k<piece.len;k++){
    const c=piece.c+k;
    if(g[piece.r*COLS+c]!==E) return false;
    if(keys.some(K=>K.r===piece.r&&K.c===c)) return false;
  }
  return true;
}

if(typeof module!=='undefined') module.exports={CONV_SP,U,COLS,ROWS,JUMP,MAXFALL,CRUMBLE_HP,E,FLOOR,WALL,CRUMB,CONVL,CONVR,SPIKE,EXIT,
  parseLevel,makeWorld,newState,cloneS,step,freeFor,tileAt,supportCols,guardPos};

// selain ja worker: kaikki yhden nimen alle
if(typeof self!=='undefined') self.PPEngine={CONV_SP,U,COLS,ROWS,JUMP,MAXFALL,CRUMBLE_HP,E,FLOOR,WALL,CRUMB,CONVL,CONVR,SPIKE,EXIT,
  parseLevel,makeWorld,newState,cloneS,step,freeFor,tileAt,supportCols,guardPos};
