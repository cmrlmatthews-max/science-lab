// molecules/compare-glass-gen.js  generator of the random glass network baked into compare-glass-data.js (pure, slow: minutes; not loaded by the app).
// Bond-switching (Wooten, Winer, Weaire style) on a diamond-like silicon network with a Keating strain energy. Seeded.
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function generateGlassNetwork(seed, opts={}){
  const rnd=mulberry32(seed);
  const SiSi=3.06, aD=SiSi*4/Math.sqrt(3), NC=opts.nc??2, L=aD*NC;
  const base=[[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]];
  const Xa=[];
  for(let i=0;i<NC;i++)for(let j=0;j<NC;j++)for(let k=0;k<NC;k++)for(const b of base)Xa.push((i+b[0])*aD,(j+b[1])*aD,(k+b[2])*aD);
  const X=Float64Array.from(Xa);const n=X.length/3;
  const mi=(d)=>d-L*Math.round(d/L);
  const nbr=Array.from({length:n},()=>[]);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const dx=mi(X[3*j]-X[3*i]),dy=mi(X[3*j+1]-X[3*i+1]),dz=mi(X[3*j+2]-X[3*i+2]);if(dx*dx+dy*dy+dz*dz<3.6*3.6){nbr[i].push(j);nbr[j].push(i);}}
  const A=opts.A??2.965,B=opts.B??0.285,d2=SiSi*SiSi;
  const kb=0.75*A/d2, ka=0.75*B/d2, cb=(3/16)*(A/d2), ca=(3/8)*(B/d2);
  const g=new Float64Array(3*n), G=new Float64Array(3*n), Q=new Float64Array(3*n);
  let bonds=[],angles=[];
  function topo(){bonds=[];angles=[];for(let i=0;i<n;i++){const ni=nbr[i];for(let a=0;a<4;a++){if(i<ni[a])bonds.push(i,ni[a]);for(let b=a+1;b<4;b++)angles.push(i,ni[a],ni[b]);}}}
  let free=null; // Uint8Array mask
  function eg(P){g.fill(0);let E=0;
    for(let m=0;m<bonds.length;m+=2){const i=bonds[m],j=bonds[m+1];if(free&&!free[i]&&!free[j])continue;const dx=mi(P[3*j]-P[3*i]),dy=mi(P[3*j+1]-P[3*i+1]),dz=mi(P[3*j+2]-P[3*i+2]);const s=dx*dx+dy*dy+dz*dz-d2;E+=cb*s*s;const f=kb*s;g[3*j]+=f*dx;g[3*j+1]+=f*dy;g[3*j+2]+=f*dz;g[3*i]-=f*dx;g[3*i+1]-=f*dy;g[3*i+2]-=f*dz;}
    for(let m=0;m<angles.length;m+=3){const i=angles[m],j=angles[m+1],k=angles[m+2];if(free&&!free[i]&&!free[j]&&!free[k])continue;const ux=mi(P[3*j]-P[3*i]),uy=mi(P[3*j+1]-P[3*i+1]),uz=mi(P[3*j+2]-P[3*i+2]);const vx=mi(P[3*k]-P[3*i]),vy=mi(P[3*k+1]-P[3*i+1]),vz=mi(P[3*k+2]-P[3*i+2]);const t=ux*vx+uy*vy+uz*vz+d2/3;E+=ca*t*t;const f=ka*t;
      g[3*j]+=f*vx;g[3*j+1]+=f*vy;g[3*j+2]+=f*vz;g[3*k]+=f*ux;g[3*k+1]+=f*uy;g[3*k+2]+=f*uz;g[3*i]-=f*(ux+vx);g[3*i+1]-=f*(uy+vy);g[3*i+2]-=f*(uz+vz);}
    if(free)for(let i=0;i<n;i++)if(!free[i]){g[3*i]=0;g[3*i+1]=0;g[3*i+2]=0;}
    return E;}
  const Xp=new Float64Array(3*n), Gp=new Float64Array(3*n);
  function relax(P,iters){let E=eg(P);G.set(g);let step=0.05;
    for(let it=0;it<iters;it++){let gm=0;for(let k=0;k<3*n;k++){const a=Math.abs(G[k]);if(a>gm)gm=a;}if(gm<5e-3)break;
      if(step*gm>0.25)step=0.25/gm;
      Xp.set(P);Gp.set(G);
      let tries=0,E2;
      for(;;){for(let k=0;k<3*n;k++)Q[k]=Xp[k]-step*Gp[k];E2=eg(Q);if(E2<=E+1e-12||tries>12)break;step*=0.5;tries++;}
      P.set(Q);E=E2;G.set(g);
      // BB step
      let sy=0,ss=0;for(let k=0;k<3*n;k++){const ds=P[k]-Xp[k],dg=G[k]-Gp[k];sy+=ds*dg;ss+=ds*ds;}
      step=sy>1e-14?ss/sy:step*1.5;if(!(step>1e-5))step=1e-3;if(step>0.5)step=0.5;}
    return E;}
  // shortest path length between a and c ignoring direct edge a-c (limit 3)
  function closeRing(a,c){ // true if path of length<=3 exists a..c apart from direct edge
    for(const x of nbr[a]){if(x===c)continue;if(nbr[x].includes(c))return true;for(const y of nbr[x]){if(y===a)continue;if(nbr[y].includes(c))return true;}}return false;}
  if(opts.X0){X.set(opts.X0);for(let i=0;i<n;i++)nbr[i]=opts.nbr0[i].slice();}
  topo();
  const kT=opts.kT??1.5, tries=opts.tries??300, anneal=opts.anneal??100;
  let acc=0;
  free=null;let Eg=relax(X,5);
  for(let t=0;t<tries+anneal;t++){
    const hot=t<tries;const kTc=hot?kT*(1-0.9*t/tries):kT*0.04;
    const b=Math.floor(rnd()*n);const c=nbr[b][Math.floor(rnd()*4)];
    const aa=nbr[b].filter(x=>x!==c);const dd=nbr[c].filter(x=>x!==b);
    const a=aa[Math.floor(rnd()*3)],d=dd[Math.floor(rnd()*3)];
    if(a===d||nbr[a].includes(c)||nbr[b].includes(d))continue;
    const saveX=Float64Array.from(X),saveN=nbr.map(l=>l.slice());
    // energy before (local): region
    nbr[b][nbr[b].indexOf(a)]=d;nbr[a][nbr[a].indexOf(b)]=c;nbr[c][nbr[c].indexOf(d)]=a;nbr[d][nbr[d].indexOf(c)]=b;
    if(closeRing(a,c)||closeRing(b,d)){X.set(saveX);for(let i=0;i<n;i++)nbr[i]=saveN[i];continue;}
    topo();
    // local region: atoms within 2 bonds of a,b,c,d
    free=new Uint8Array(n);const mark=(s,depth)=>{if(free[s]&&depth<=0)return;free[s]=1;if(depth>0)for(const w of nbr[s])mark(w,depth-1);};
    for(const s of [a,b,c,d])mark(s,2);
    free=null;
    const E2=relax(X,hot?120:120);
    const dE=E2-Eg;
    if(dE<0||(rnd()<Math.exp(-dE/kTc))){Eg=E2;acc++;}else{X.set(saveX);for(let i=0;i<n;i++)nbr[i]=saveN[i];topo();}
  }
  free=null;if(opts.finalIters){Eg=relax(X,opts.finalIters);}
  return {X,nbr,L,n,E:Eg,acc};
}
