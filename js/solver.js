// Ratkaisija: etsii reitin seisomakohdasta toiseen (kävely + hypyt), käyttää samaa moottoria kuin peli.
// Toimii Nodessa (require) ja selaimen workerissa (importScripts).
const PPSolver = (function(){
  const ENG = (typeof module!=='undefined' && typeof require!=='undefined') ? require('./engine.js') : self.PPEngine;
  const {ROWS,COLS,makeWorld,newState,cloneS,step,freeFor} = ENG;
  const NOIN={dir:0,jump:false};
  const gcd=(a,b)=>b?gcd(b,a%b):a, lcm=(a,b)=>a/gcd(a,b)*b;

  // palauttaa true / false / null (raja tuli vastaan)
  function solve(def,pieces,opts={}){
    const w=makeWorld(def,pieces); const s0=newState(w);
    const P=w.guards.length? w.guards.reduce((a,G)=>lcm(a,G.P),1):1;
    const q=[]; let won=null;
    const par=opts.trace? new Map():null;
    const key=s=>s.x+','+s.y+','+s.keys+','+(s.t%P)+'|'+s.hp.map(h=>h>0?1:0).join('');
    const gone=s=>{ let g=0; for(let i=0;i<s.hp.length;i++) if(s.hp[i]<=0) g|=(1<<i); return g; };
    const dom=new Map(); let cnt=0;
    const push=(s,from)=>{
      if(s.won){ won=s; if(par) par.set('WIN',from); return true; }
      if(s.dead) return false;
      const pk=s.x+','+s.y+','+(s.t%P), kk=s.keys, gg=gone(s);
      let arr=dom.get(pk); if(!arr){ arr=[]; dom.set(pk,arr); }
      for(const [k2,g2] of arr) if((k2&kk)===kk && (g2&~gg)===0) return false;
      for(let i=arr.length-1;i>=0;i--){ const [k2,g2]=arr[i]; if((kk&k2)===k2 && (gg&~g2)===0) arr.splice(i,1); }
      arr.push([kk,gg]); cnt++; q.push(s); if(par) par.set(key(s),from); return false; };
    const air=s=>{ let n=0; while(s.m!==0&&!s.dead&&!s.won&&n++<300) step(w,s,NOIN); return s; };
    push(s0,null);
    const limit=opts.limit||300000;
    for(let qi=0; qi<q.length; qi++){
      const node=q[qi];
      if(cnt>limit) return null;
      if(P>1){ const t=cloneS(node); step(w,t,NOIN); if(t.m!==0) air(t); if(push(t,node)) break; }
      let stop=false;
      for(const d of [-1,1]){
        let s=cloneS(node), lastX=-1;
        for(let i=0;i<200;i++){
          for(const j of [-1,0,1]){ const t=cloneS(s); step(w,t,{dir:j,jump:true}); air(t); if(push(t,node)){stop=true;break;} }
          if(stop) break;
          const k0=s.keys, h0=s.hp.map(h=>h>0?1:0).join('');
          step(w,s,{dir:d,jump:false});
          if(s.dead) break;
          if(s.won){ push(s,node); stop=true; break; }
          if(s.m!==0){ air(s); if(push(s,node)) stop=true; break; }
          if(s.keys!==k0 || s.hp.map(h=>h>0?1:0).join('')!==h0){ if(push(s,node)) stop=true; if(w.cl.length===0 || s.keys!==k0) break; }
          if(s.x===lastX) break; lastX=s.x;
        }
        if(stop) break;
      }
      if(won) break;
    }
    if(!won) return false;
    if(par){ const path=[]; let s=par.get('WIN'); while(s){ path.push({r:s.y/4,c:+(s.x/4).toFixed(1),keys:s.keys}); s=par.get(key(s)); } return path.reverse(); }
    return true;
  }

  const solPieces=L=>(L.sol||[]).map((s,k)=>s && ({type:L.pieces[k].type,len:L.pieces[k].len,r:s.r,c:s.c}));

  function placements(def,p,others){
    const out=[];
    for(let r=1;r<ROWS;r++) for(let c=0;c+p.len<=COLS;c++){
      const q={type:p.type,len:p.len,r,c}; if(freeFor(def,q,others)) out.push(q);
    }
    return out;
  }

  // Koko tarkistus editorille. report(viesti) kutsutaan välivaiheissa.
  function check(L,opts={},report=()=>{}){
    const res={};
    const sol=solPieces(L);
    res.missingSol = sol.length!==L.pieces.length || sol.some(s=>!s);
    report('Ilman paloja…');
    res.none = solve(L,[],opts);
    if(!res.missingSol){
      report('Ratkaisulla…');
      res.intended = solve(L,sol,opts);
      if(sol.length>=2){
        res.dropOne=[];
        for(let k=0;k<sol.length;k++){ report(`Ilman palaa ${k+1}…`); res.dropOne.push(solve(L,sol.filter((_,j)=>j!==k),opts)); }
      }
    }
    if(opts.alternatives && L.pieces.length===1){
      const list=placements(L,L.pieces[0],[]); let n=0, found=[];
      list.forEach((q,i)=>{ if(i%20===0) report(`Vaihtoehdot ${i}/${list.length}…`); if(solve(L,[q],{limit:opts.limit})===true){ n++; found.push(q); } });
      res.alternatives={count:n, list:found};
    }
    return res;
  }

  return {solve,check,solPieces,placements};
})();

if(typeof module!=='undefined') module.exports=PPSolver;
if(typeof self!=='undefined') self.PPSolver=PPSolver;
