'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const C = {paper:'#faf9f6', ink:'#292b2c', muted:'#82867e', line:'#ccd0c5', pale:'#eeefe8', cpu:'#487fa4', gpu:'#bd6c53', npu:'#468779', mem:'#b18536', other:'#979b90'};
  const sans = '-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
  const mono = 'ui-monospace,SFMono-Regular,Consolas,monospace';
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const lerp = (a,b,t) => a+(b-a)*t;
  const rgba = (hex,a) => { const n=parseInt(hex.slice(1),16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${clamp(a,0,1)})`; };
  function text(ctx, str, x,y,size=14,color=C.ink,align='center',weight=400,font=sans){ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(str,x,y);}
  function lines(ctx,arr,x,y,size=14,color=C.ink,weight=400,step=18){arr.forEach((s,i)=>text(ctx,s,x,y+(i-(arr.length-1)/2)*step,size,color,'center',weight));}
  function rect(ctx,x,y,w,h,fill,stroke=C.line,lw=1,r=0){ctx.beginPath();if(r&&ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
  function line(ctx,x1,y1,x2,y2,color=C.line,lw=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke();}
  function path(ctx,pts,color=C.line,lw=1){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke();}
  function arrow(ctx,x1,y1,x2,y2,color=C.muted,lw=1,head=5){line(ctx,x1,y1,x2,y2,color,lw);const a=Math.atan2(y2-y1,x2-x1);ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-head*Math.cos(a-.48),y2-head*Math.sin(a-.48));ctx.lineTo(x2-head*Math.cos(a+.48),y2-head*Math.sin(a+.48));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
  function dot(ctx,x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function hatch(ctx,x,y,w,h,color,mode='grid',pitch=5){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();for(let yy=y+pitch/2;yy<y+h;yy+=pitch)line(ctx,x,yy,x+w,yy,color,.7);if(mode==='grid')for(let xx=x+pitch/2;xx<x+w;xx+=pitch)line(ctx,xx,y,xx,y+h,color,.6);ctx.restore();}
  function setText(id,value){const e=$(id);if(e.textContent!==String(value))e.textContent=value;}
  let globalPaused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let clock=0, previous=0;
  const state={heroReveal:0,heroFilter:'all',tilesMode:'logic',tilesZoom:0,memAddress:29,cpuStage:0,gpuGroups:2,gpuProgress:0,gpuRunning:false,npuStep:0,npuSelected:0,npuRunning:false,npuElapsed:0,wireLength:1,layerSeparation:0};
  const memory=Array.from({length:64},(_,i)=>((i*17+Math.floor(i/8)*13+3)%11)<5?0:1);
  const A=[[1,2,1,0],[0,1,2,1],[2,0,1,1],[1,1,0,2]];
  const B=[[2,0,1,1],[1,2,0,1],[0,1,2,0],[1,0,1,2]];
  const matrixAt=(step)=>A.map((row,i)=>B[0].map((_,j)=>row.reduce((sum,a,k)=>sum+(i+j+k<step?a*B[k][j]:0),0)));
  const diagrams=new Map();
  class Diagram {
    constructor(id,draw){this.id=id;this.canvas=$(id);this.ctx=this.canvas.getContext('2d');this.draw=draw;this.visible=false;this.dirty=true;this.w=0;this.h=0;diagrams.set(id,this);new ResizeObserver(()=>this.resize()).observe(this.canvas.parentElement);observer.observe(this.canvas);this.resize();}
    resize(){const b=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);this.w=b.width;this.h=b.height;if(!this.w||!this.h)return;this.canvas.width=Math.round(this.w*dpr);this.canvas.height=Math.round(this.h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.dpr=dpr;this.dirty=true;this.render();}
    render(){if(!this.w||!this.h)return;this.ctx.save();this.ctx.clearRect(0,0,this.w,this.h);this.draw(this.ctx,this.w,this.h,clock);this.ctx.restore();this.dirty=false;}
  }
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{const d=diagrams.get(e.target.id);if(d){d.visible=e.isIntersecting;if(d.visible){d.dirty=true;d.render();}}}),{rootMargin:'100px'});
  const redraw=id=>{const d=diagrams.get(id);if(d){d.dirty=true;d.render();}};
  function pressed(group,value){$(group).querySelectorAll('button[data-value]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===String(value))));}
  function choose(group,fn){$(group).querySelectorAll('button[data-value]').forEach(b=>b.addEventListener('click',()=>{pressed(group,b.dataset.value);fn(b.dataset.value);}));}
  function input(id,fn){$(id).addEventListener('input',e=>fn(Number(e.target.value)));}
  function syncPause(){const b=$('pause-all');b.textContent=globalPaused?'▶ Enable motion':'Ⅱ Pause motion';b.setAttribute('aria-pressed',String(globalPaused));}
  function enableMotion(){if(globalPaused){globalPaused=false;syncPause();}}
  $('pause-all').addEventListener('click',()=>{globalPaused=!globalPaused;syncPause();});syncPause();

  // The overview is a deliberately invented chip. Memory is nested within compute blocks.
  function drawChip(ctx,w,h){
    const dw=Math.min(w-34,(h-30)*1.28,650),dh=dw/1.28,ox=(w-dw)/2,oy=(h-dh)/2;
    const reveal=state.heroReveal,filter=state.heroFilter;
    rect(ctx,ox-5,oy-5,dw+10,dh+10,C.pale,'#90988a',1.2);
    rect(ctx,ox,oy,dw,dh,C.paper,'#bdc3b7',1);
    function block(x,y,bw,bh,kind,group,pattern='logic'){
      x=ox+x*dw;y=oy+y*dh;bw*=dw;bh*=dh;
      const active=filter==='all'||filter===group||filter===kind;
      const a=active?1:.10;ctx.save();ctx.globalAlpha=a;
      rect(ctx,x,y,bw,bh,rgba(C[kind],.035+.20*reveal),rgba(C.ink,.66*(1-reveal)+.24),.8);
      if(pattern==='grid')hatch(ctx,x+2,y+2,bw-4,bh-4,rgba(reveal?C[kind]:C.ink,.33),'grid',Math.max(3,dw/135));
      else if(pattern==='stripes')hatch(ctx,x+2,y+2,bw-4,bh-4,rgba(reveal?C[kind]:C.ink,.48),'stripes',Math.max(3.6,dw/118));
      else{
        const rh=bh/5;
        for(let row=0;row<5;row++){let xx=x+2,ii=0;while(xx<x+bw-4){const width=Math.min((.13+.06*((row*3+ii*7)%4))*bw,x+bw-2-xx);rect(ctx,xx,y+2+row*rh,width-1,rh-3,null,rgba(reveal?C[kind]:C.ink,.34),.65);xx+=width;ii++;}}
      }
      ctx.restore();
    }
    function outline(x,y,bw,bh,kind){const active=filter==='all'||filter===kind||(filter==='mem'&&kind!=='other');ctx.save();ctx.globalAlpha=active?.75:.1;rect(ctx,ox+x*dw,oy+y*dh,bw*dw,bh*dh,null,rgba(reveal?C[kind]:C.ink,.5),1.2);ctx.restore();}
    for(let r=0;r<2;r++)for(let c=0;c<2;c++){
      const x=.035+c*.222,y=.04+r*.222,bw=.207,bh=.207;
      outline(x,y,bw,bh,'cpu');
      block(x+.009,y+.009,.083,.053,'mem','cpu','grid');
      block(x+.10,y+.009,.098,.053,'cpu','cpu');
      block(x+.009,y+.07,.061,.076,'cpu','cpu');
      block(x+.077,y+.07,.12,.044,'cpu','cpu');
      block(x+.078,y+.122,.047,.054,'cpu','cpu','stripes');
      block(x+.132,y+.122,.065,.054,'cpu','cpu');
      block(x+.009,y+.155,.061,.043,'cpu','cpu','stripes');
      block(x+.077,y+.184,.12,.014,'mem','cpu','stripes');
    }
    for(let r=0;r<2;r++)for(let c=0;c<3;c++){
      const x=.50+c*.155,y=.04+r*.222;outline(x,y,.143,.207,'gpu');
      block(x+.008,y+.008,.127,.03,'gpu','gpu');
      block(x+.008,y+.046,.127,.042,'mem','gpu','grid');
      for(let k=0;k<4;k++)block(x+.009+k*.033,y+.096,.026,.10,'gpu','gpu','stripes');
    }
    outline(.035,.514,.43,.355,'npu');
    block(.047,.526,.406,.044,'mem','npu','grid');
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      const x=.048+c*.102,y=.584+r*.067;block(x,y,.090,.054,'npu','npu','logic');
    }
    for(let r=0;r<2;r++)for(let c=0;c<2;c++)block(.50+c*.233,.514+r*.117,.221,.102,'mem','mem','grid');
    block(.50,.764,.17,.105,'other','other','stripes');
    block(.68,.764,.285,.105,'other','other','logic');
    for(let i=0;i<6;i++)block(.035+i*.155,.912,.143,.042,'other','other','stripes');
    const bus=rgba(C.ink,filter==='all'?.25:.08);
    for(let q=0;q<3;q++)line(ctx,ox+.035*dw,oy+(.485+q*.007)*dh,ox+.965*dw,oy+(.485+q*.007)*dh,bus,.7);
    for(let q=0;q<2;q++)line(ctx,ox+.476*dw+q*3,oy+.04*dh,ox+.476*dw+q*3,oy+.87*dh,bus,.6);
    if(reveal>.12){
      function badge(str,x,y,kind){if(filter!=='all'&&filter!==kind)return;ctx.save();ctx.globalAlpha=clamp((reveal-.12)/.65,0,1);const fs=dw<380?13:16;ctx.font=`650 ${fs}px ${sans}`;const tw=ctx.measureText(str).width;rect(ctx,ox+x*dw-tw/2-9,oy+y*dh-13,tw+18,26,rgba(C.paper,.95),rgba(C[kind],.38),.8,2);text(ctx,str,ox+x*dw,oy+y*dh,fs,C[kind],'center',650);ctx.restore();}
      badge('CPU',.25,.25,'cpu');badge('GPU',.732,.25,'gpu');badge('NPU',.25,.70,'npu');badge('SRAM',.732,.625,'mem');badge('Other',.732,.815,'other');
    }
  }
  new Diagram('hero-c',drawChip);
  const heroDescriptions={all:'What makes each region look different? Move the slider to reveal what’s inside.',cpu:'Four copies of a core. Inside each one, different circuits handle instructions, calculations, and storage.',gpu:'Each repeated group brings its own arithmetic lanes, instruction handling, and memory.',npu:'This example pairs repeated compute tiles with nearby buffers to keep their data close.',mem:'Memory turns up all over the chip. Look for the smaller gold patches inside the compute blocks.'};
  input('hero-reveal',v=>{state.heroReveal=v/100;setText('hero-percent',v+'%');redraw('hero-c');});
  choose('hero-filter',v=>{state.heroFilter=v;if(v!=='all'&&state.heroReveal<.5){state.heroReveal=1;$('hero-reveal').value=100;setText('hero-percent','100%');}setText('hero-status',heroDescriptions[v]);redraw('hero-c');});

  new Diagram('tiles-c',(ctx,w,h)=>{
    const t=state.tilesZoom,rows=Math.round(lerp(3,17,t)),cols=Math.round(lerp(7,32,t));
    const ox=22,oy=22,ww=w-44,hh=h-44,rh=hh/rows,unit=ww/cols;
    rect(ctx,ox-4,oy-4,ww+8,hh+8,null,C.line,.8);
    for(let r=0;r<rows;r++){
      line(ctx,ox,oy+r*rh,ox+ww,oy+r*rh,'#c5cabe',.8);
      let c=0,idx=0;
      while(c<cols){
        const span=state.tilesMode==='memory'?1:Math.min(1+(r*11+idx*7)%3,cols-c);
        const x=ox+c*unit+1,y=oy+r*rh+2,bw=span*unit-2,bh=rh-4;
        const color=state.tilesMode==='memory'?C.mem:C.cpu;
        rect(ctx,x,y,bw,bh,rgba(color,state.tilesMode==='memory'?.13:.07+((r+idx)%3)*.05),rgba(color,.52),.7);
        if(bh>30&&bw>28){
          const name=state.tilesMode==='memory'?'bit':(['NOT','MUX','FF'][(r+idx)%3]);
          text(ctx,name,x+bw/2,y+bh/2,Math.min(13,bw/3.2),rgba(C.ink,.75),'center',500,mono);
          if(state.tilesMode==='memory'){
            line(ctx,x+bw*.25,y+bh*.2,x+bw*.75,y+bh*.2,rgba(color,.55),1);line(ctx,x+bw*.25,y+bh*.8,x+bw*.75,y+bh*.8,rgba(color,.55),1);
          }
        }
        c+=span;idx++;
      }
    }
    line(ctx,ox,oy+hh,ox+ww,oy+hh,'#c5cabe',.8);
  });
  function updateTiles(){setText('tiles-status',state.tilesMode==='memory'?'One storage cell, copied over and over. Shared rows and columns turn the copies into a grid.':'The cells sit in tidy rows, but their shapes and jobs vary.');setText('tiles-out',state.tilesZoom<.33?'Close':state.tilesZoom<.66?'Pulling back':'Many rows');redraw('tiles-c');}
  choose('tiles-mode',v=>{state.tilesMode=v;updateTiles();});input('tiles-zoom',v=>{state.tilesZoom=v/100;updateTiles();});

  let memHit=null;
  new Diagram('mem-c',(ctx,w,h)=>{
    const pitch=Math.min((w-102)/8,(h-122)/8,36),ww=pitch*8,ox=(w-ww)/2+17,oy=32;
    const row=Math.floor(state.memAddress/8),col=state.memAddress%8;memHit={x:ox,y:oy,pitch};
    const dx=ox-44,dw=26;
    rect(ctx,dx,oy,dw,ww,rgba(C.mem,.08),rgba(C.mem,.5),1);
    ctx.save();ctx.translate(dx+dw/2,oy+ww/2);ctx.rotate(-Math.PI/2);text(ctx,'ROW SELECT',0,0,10,C.mem,'center',600);ctx.restore();
    for(let r=0;r<8;r++)line(ctx,dx+dw,oy+(r+.5)*pitch,ox+ww,oy+(r+.5)*pitch,rgba(C.mem,r===row?.9:.21),r===row?2:1);
    for(let c=0;c<8;c++){
      text(ctx,c+1,ox+(c+.5)*pitch,oy-13,11,c===col?C.mem:C.muted,'center',c===col?650:400,mono);
      for(const q of [-2,2])line(ctx,ox+(c+.5)*pitch+q,oy-3,ox+(c+.5)*pitch+q,oy+ww+16,rgba(C.mem,c===col?.65:.15),c===col?1.5:.7);
    }
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const active=r===row&&c===col,along=r===row||c===col;
      rect(ctx,ox+c*pitch+4,oy+r*pitch+4,pitch-8,pitch-8,active?C.mem:along?'#eae1c8':C.paper,rgba(C.mem,active?1:.38),active?1.5:.8,2);
      text(ctx,memory[r*8+c],ox+(c+.5)*pitch,oy+(r+.5)*pitch,13,active?C.paper:rgba(C.ink,.70),'center',active?650:400,mono);
    }
    rect(ctx,ox,oy+ww+16,ww,29,rgba(C.mem,.11),rgba(C.mem,.45),1,2);
    text(ctx,'Column select · read / write',ox+ww/2,oy+ww+30,12,C.mem,'center',500);
    arrow(ctx,ox+(col+.5)*pitch,oy+ww+46,ox+(col+.5)*pitch,oy+ww+60,C.mem,1.5);
    text(ctx,String(memory[state.memAddress]),ox+(col+.5)*pitch,oy+ww+72,17,C.mem,'center',650,mono);
  });
  function updateMemory(){const i=state.memAddress;setText('mem-out',i+' / 63');setText('mem-status',`Address ${i} → row ${Math.floor(i/8)+1}, column ${i%8+1} · stored bit: ${memory[i]}`);$('mem-address').value=i;redraw('mem-c');}
  input('mem-address',v=>{state.memAddress=v;updateMemory();});$('write-zero').addEventListener('click',()=>{memory[state.memAddress]=0;updateMemory();});$('write-one').addEventListener('click',()=>{memory[state.memAddress]=1;updateMemory();});
  $('mem-c').addEventListener('click',e=>{if(!memHit)return;const b=e.currentTarget.getBoundingClientRect(),x=e.clientX-b.left-memHit.x,y=e.clientY-b.top-memHit.y,c=Math.floor(x/memHit.pitch),r=Math.floor(y/memHit.pitch);if(c>=0&&c<8&&r>=0&&r<8){state.memAddress=r*8+c;updateMemory();}});updateMemory();

  const cpuSteps=[
    'Fetch: bring in instructions. Branch prediction makes a guess about which ones will be needed next.',
    'Decode and rename: work out what each instruction asks for and map its register names to internal storage.',
    'Select ready work: find operations whose inputs are ready, choose which can run, and collect their data.',
    'Execute: do the calculations and read or write memory as the instructions require.',
    'Commit: make the completed results official, in the order the program requires.'
  ];
  new Diagram('cpu-c',(ctx,w,h)=>{
    const ww=Math.min(w-38,610),hh=h-54,ox=(w-ww)/2,oy=28;
    rect(ctx,ox-8,oy-10,ww+16,hh+20,null,C.line,1);
    const nodes=[
      {id:'ic',x:0,y:.02,w:.46,h:.13,kind:'mem',stage:0,label:['Instruction cache']},
      {id:'fetch',x:.50,y:.02,w:.50,h:.13,kind:'cpu',stage:0,label:['Fetch + predict']},
      {id:'decode',x:0,y:.21,w:.34,h:.16,kind:'cpu',stage:1,label:['Decode','+ rename']},
      {id:'schedule',x:.38,y:.21,w:.62,h:.16,kind:'cpu',stage:2,label:['Dependency tracking','+ scheduling']},
      {id:'reg',x:0,y:.43,w:.62,h:.12,kind:'mem',stage:2,label:['Registers']},
      {id:'ls',x:.68,y:.43,w:.32,h:.27,kind:'cpu',stage:3,label:['Load / store']},
      {id:'alu1',x:0,y:.60,w:.18,h:.13,kind:'cpu',stage:3,label:['Integer']},
      {id:'alu2',x:.22,y:.60,w:.18,h:.13,kind:'cpu',stage:3,label:['Integer']},
      {id:'vec',x:.44,y:.60,w:.18,h:.13,kind:'cpu',stage:3,label:['Vector','/ float']},
      {id:'dc',x:.68,y:.78,w:.32,h:.13,kind:'mem',stage:3,label:['Data cache']},
      {id:'retire',x:0,y:.82,w:.62,h:.13,kind:'cpu',stage:4,label:['Completion tracking + commit']}
    ];
    const n=Object.fromEntries(nodes.map(v=>[v.id,{...v,X:ox+v.x*ww,Y:oy+v.y*hh,W:v.w*ww,H:v.h*hh}]));
    function connect(a,b){a=n[a];b=n[b];const x1=a.X+a.W/2,y1=a.Y+a.H,x2=b.X+b.W/2,y2=b.Y;path(ctx,[[x1,y1],[x1,(y1+y2)/2],[x2,(y1+y2)/2],[x2,y2]],'#bdc3b7',1);}
    connect('fetch','decode');connect('schedule','reg');connect('reg','alu1');connect('reg','alu2');connect('reg','vec');connect('ls','dc');connect('alu2','retire');
    arrow(ctx,n.ic.X+n.ic.W,n.ic.Y+n.ic.H/2,n.fetch.X,n.fetch.Y+n.fetch.H/2,'#bdc3b7',1);
    arrow(ctx,n.decode.X+n.decode.W,n.decode.Y+n.decode.H/2,n.schedule.X,n.schedule.Y+n.schedule.H/2,'#bdc3b7',1);
    arrow(ctx,n.reg.X+n.reg.W,n.reg.Y+n.reg.H/2,n.ls.X,n.ls.Y+n.ls.H*.27,'#bdc3b7',1);
    for(const v of Object.values(n)){
      const active=v.stage===state.cpuStage,color=C[v.kind];
      rect(ctx,v.X,v.Y,v.W,v.H,rgba(color,active?.21:.06),rgba(color,active?.95:.38),active?2:1,2);
      if(v.kind==='mem')hatch(ctx,v.X+4,v.Y+4,v.W-8,v.H-8,rgba(color,.13),'grid',6);
      else if(v.id!=='alu1'&&v.id!=='alu2'&&v.id!=='vec'){
        for(let i=0;i<5;i++){const yy=v.Y+5+i*4;if(yy<v.Y+v.H-5)line(ctx,v.X+4,yy,v.X+v.W-4,yy,rgba(color,.05),.7);}
      }
      const fs=ww<420?(v.id==='retire'?11.4:v.id.startsWith('alu')||v.id==='vec'?10.5:12):14;
      const tw=Math.min(v.W-8,Math.max(...v.label.map(s=>s.length))*fs*.54+8),lh=v.label.length*(fs+3);
      rect(ctx,v.X+(v.W-tw)/2,v.Y+(v.H-lh)/2,tw,lh,rgba(C.paper,.87),null);
      lines(ctx,v.label,v.X+v.W/2,v.Y+v.H/2,fs,active?C.ink:'#798073',active?600:400,fs+4);
    }
  });
  function updateCPU(){setText('cpu-out',`${state.cpuStage+1} / 5`);setText('cpu-status',cpuSteps[state.cpuStage]);redraw('cpu-c');}input('cpu-stage',v=>{state.cpuStage=v;updateCPU();});updateCPU();

  const gpuLanes=()=>state.gpuGroups*4;
  const gpuRounds=()=>64/gpuLanes();
  const gpuDone=()=>Math.min(64,Math.floor(state.gpuProgress+1e-8)*gpuLanes());
  new Diagram('gpu-c',(ctx,w,h,time)=>{
    const gap=4,cols=16,cell=Math.min(23,(w-46-gap*(cols-1))/cols),tw=cols*cell+(cols-1)*gap,ox=(w-tw)/2,oy=44;
    const completed=gpuDone();text(ctx,'64 independent jobs',w/2,21,14,C.ink,'center',500);
    for(let i=0;i<64;i++){
      const x=ox+(i%cols)*(cell+gap),y=oy+Math.floor(i/cols)*(cell+gap),done=i<completed,active=state.gpuRunning&&i>=completed&&i<completed+gpuLanes();
      rect(ctx,x,y,cell,cell,done?rgba(C.gpu,.8):active?rgba(C.gpu,.17+.08*Math.sin(time*5)):'#e4e7df',active?C.gpu:done?rgba(C.gpu,.7):'#d7dbd0',active?1.4:.5,2);
    }
    const bottom=oy+4*(cell+gap),top=bottom+54;
    text(ctx,'Each group: issue + storage + four lanes',w/2,bottom+24,w<400?11:12,C.muted);
    const gcols=w<580?2:4,grows=8/gcols,gapx=14,gapy=12,bw=Math.min((w-42-(gcols-1)*gapx)/gcols,174),bh=Math.min(87,(h-top-14-(grows-1)*gapy)/grows),gx=(w-(gcols*bw+(gcols-1)*gapx))/2;
    for(let i=0;i<8;i++){
      const x=gx+(i%gcols)*(bw+gapx),y=top+Math.floor(i/gcols)*(bh+gapy),enabled=i<state.gpuGroups;
      if(!enabled){ctx.save();ctx.setLineDash([3,4]);rect(ctx,x,y,bw,bh,null,'#d4d8cd',1,3);ctx.restore();text(ctx,'+',x+bw/2,y+bh/2,17,'#cbd1c4');continue;}
      rect(ctx,x,y,bw,bh,rgba(C.gpu,.025),rgba(C.gpu,.62),1,3);
      const inset=7,labelW=22,ix=x+labelW+inset,iw=bw-labelW-inset*2;
      const my=y+bh*.29,mh=Math.max(5,bh*.15);
      text(ctx,`${i+1}`,x+inset+6,(y+my)/2,11,C.gpu,'center',600,mono);
      rect(ctx,ix,y+6,iw,Math.max(5,bh*.10),rgba(C.gpu,.40),null,0,1);
      rect(ctx,x+inset,my,bw-inset*2,mh,rgba(C.mem,.40),rgba(C.mem,.3),.7,1);
      for(let k=0;k<4;k++){
        const lw=(bw-inset*2-9)/4,lx=x+inset+k*(lw+3),ly=y+bh*.57,lh=bh*.32;
        rect(ctx,lx,ly,lw,lh,rgba(C.gpu,state.gpuRunning?.26:.12),rgba(C.gpu,.40),.7,1);
        if(state.gpuRunning){const f=(state.gpuProgress%1);dot(ctx,lx+lw/2,ly+3+f*Math.max(1,lh-6),1.7,C.gpu);}
      }
    }
  });
  function updateGPU(){const done=gpuDone();setText('gpu-out',`${state.gpuGroups} ${state.gpuGroups===1?'group':'groups'} · ${gpuLanes()} lanes`);setText('gpu-status',`${done} / 64 jobs complete · ${gpuRounds()} rounds in this model with ${gpuLanes()} lanes.`);setText('gpu-run',state.gpuRunning?'Ⅱ Pause jobs':done===64?'↺ Run again':'▶ Run 64 jobs');redraw('gpu-c');}
  input('gpu-groups',v=>{state.gpuGroups=2**v;state.gpuProgress=0;state.gpuRunning=false;updateGPU();});
  $('gpu-run').addEventListener('click',()=>{if(gpuDone()===64)state.gpuProgress=0;state.gpuRunning=!state.gpuRunning;if(state.gpuRunning)enableMotion();updateGPU();});
  $('gpu-reset').addEventListener('click',()=>{state.gpuProgress=0;state.gpuRunning=false;updateGPU();});updateGPU();

  $('matrix-inputs').innerHTML=[['A',A,C.gpu],['B',B,C.cpu]].map(([name,m,color])=>`<span class="matrix-item"><strong style="color:${color}">${name} =</strong><span class="matrix">${m.flat().map(v=>`<span>${v}</span>`).join('')}</span></span>`).join('');
  let npuHit=null;
  new Diagram('npu-c',(ctx,w,h)=>{
    const pitch=Math.min((w-105)/4,(h-100)/4,78),cell=pitch-12,side=4*pitch-12,ox=(w-side)/2+16,oy=56,step=state.npuStep,t=step-1,vals=matrixAt(step);
    npuHit={x:ox,y:oy,pitch,cell};
    text(ctx,'B ↓',ox-27,22,12,C.cpu,'center',600);
    text(ctx,'A →',ox-48,oy-17,12,C.gpu,'center',600);
    for(let j=0;j<4;j++){
      const k=t-j,x=ox+j*pitch+cell/2;arrow(ctx,x,oy-21,x,oy-5,rgba(C.cpu,.55),1,4);text(ctx,k>=0&&k<4?B[k][j]:'·',x,oy-34,14,C.cpu,'center',600,mono);
    }
    for(let i=0;i<4;i++){
      const k=t-i,y=oy+i*pitch+cell/2;arrow(ctx,ox-23,y,ox-6,y,rgba(C.gpu,.55),1,4);text(ctx,k>=0&&k<4?A[i][k]:'·',ox-35,y,14,C.gpu,'center',600,mono);
    }
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){
      const x=ox+j*pitch,y=oy+i*pitch,k=t-i-j,active=k>=0&&k<4,complete=step>=i+j+4,selected=state.npuSelected===i*4+j;
      if(j<3)arrow(ctx,x+cell,y+cell/2,x+pitch-2,y+cell/2,rgba(C.gpu,active?.9:.25),active?1.5:1,4);
      if(i<3)arrow(ctx,x+cell/2,y+cell,x+cell/2,y+pitch-2,rgba(C.cpu,active?.9:.25),active?1.5:1,4);
      rect(ctx,x,y,cell,cell,rgba(C.npu,active?.23:complete?.12:.03),rgba(C.npu,selected?1:active?.7:.3),selected?2.5:1,3);
      if(active)text(ctx,`${A[i][k]} × ${B[k][j]}`,x+cell/2,y+cell*.22,cell<55?10:11,C.npu,'center',500,mono);
      else text(ctx,`C${i+1}${j+1}`,x+cell/2,y+cell*.22,10,'#8a9586','center',400,mono);
      text(ctx,vals[i][j],x+cell/2,y+cell*.61,cell<55?21:26,active||complete?C.npu:'#a0a89a','center',selected?650:400,mono);
    }
    const finished=A.reduce((total,row,i)=>total+row.reduce((r,_,j)=>r+clamp(step-i-j,0,4),0),0);
    text(ctx,`${finished} / 64 multiply–accumulates`,w/2,oy+side+31,12,C.muted);
  });
  function updateNPU(){const s=state.npuStep,i=Math.floor(state.npuSelected/4),j=state.npuSelected%4,n=clamp(s-i-j,0,4),value=matrixAt(s)[i][j];setText('npu-out',`Step ${s} / 10`);$('npu-step').value=s;setText('npu-cell-out',`Row ${i+1} · column ${j+1}`);$('npu-cell').value=state.npuSelected;const terms=Array.from({length:n},(_,k)=>`${A[i][k]}×${B[k][j]}`).join(' + ');setText('npu-status',n?`C[${i+1}, ${j+1}] = ${terms} = ${value} · ${n} of 4 products added`:`C[${i+1}, ${j+1}] = 0 · Waiting for its first pair of numbers`);setText('npu-run',state.npuRunning?'Ⅱ Pause':s===10?'↺ Replay':'▶ Play');redraw('npu-c');}
  input('npu-step',v=>{state.npuStep=v;state.npuElapsed=0;state.npuRunning=false;updateNPU();});
  input('npu-cell',v=>{state.npuSelected=v;updateNPU();});
  $('npu-run').addEventListener('click',()=>{if(state.npuStep===10){state.npuStep=0;state.npuElapsed=0;}state.npuRunning=!state.npuRunning;if(state.npuRunning)enableMotion();updateNPU();});
  $('npu-next').addEventListener('click',()=>{state.npuRunning=false;state.npuElapsed=0;state.npuStep=state.npuStep===10?0:state.npuStep+1;updateNPU();});
  $('npu-reset').addEventListener('click',()=>{state.npuRunning=false;state.npuElapsed=0;state.npuStep=0;updateNPU();});
  $('npu-c').addEventListener('click',e=>{if(!npuHit)return;const b=e.currentTarget.getBoundingClientRect(),x=e.clientX-b.left-npuHit.x,y=e.clientY-b.top-npuHit.y,j=Math.floor(x/npuHit.pitch),i=Math.floor(y/npuHit.pitch);if(i>=0&&i<4&&j>=0&&j<4&&x%npuHit.pitch<=npuHit.cell&&y%npuHit.pitch<=npuHit.cell){state.npuSelected=i*4+j;updateNPU();}});updateNPU();

  let wireHit=null,wireDragging=false;
  new Diagram('wire-c',(ctx,w,h)=>{
    const cpuW=w<450?76:98,memW=w<450?82:105,ww=Math.min(w-46,620),ox=(w-ww)/2,base=(ww-cpuW-memW)/4,gap=base*state.wireLength,cy=55,bh=100,mx=ox+cpuW+gap;
    wireHit={x:mx,y:cy,w:memW,h:bh,base,start:ox+cpuW};
    text(ctx,'CPU core',ox+cpuW/2,cy-18,13,C.cpu,'center',600);text(ctx,'Memory',mx+memW/2,cy-18,13,C.mem,'center',600);
    for(let i=0;i<9;i++){const y=cy+18+i*8;line(ctx,ox+cpuW,y,mx,y,rgba(C.ink,.31),1);}
    rect(ctx,ox,cy,cpuW,bh,rgba(C.cpu,.06),rgba(C.cpu,.65),1.2,2);
    rect(ctx,ox+8,cy+8,cpuW*.35,25,rgba(C.cpu,.22),rgba(C.cpu,.25),.6);rect(ctx,ox+cpuW*.5,cy+8,cpuW*.38,25,rgba(C.cpu,.12),rgba(C.cpu,.25),.6);
    rect(ctx,ox+8,cy+39,cpuW-16,16,rgba(C.mem,.19),rgba(C.mem,.3),.6);
    for(let k=0;k<3;k++)rect(ctx,ox+8+k*(cpuW-16)/3,cy+62,(cpuW-22)/3,29,rgba(C.cpu,.22),rgba(C.cpu,.25),.6);
    rect(ctx,mx,cy,memW,bh,rgba(C.mem,.08),rgba(C.mem,.65),1.2,2);hatch(ctx,mx+7,cy+8,memW-14,bh-30,rgba(C.mem,.35),'grid',6);rect(ctx,mx+7,cy+bh-18,memW-14,10,rgba(C.mem,.25),null);
    const y=cy+bh+29;line(ctx,ox+cpuW,y-5,ox+cpuW,y+5,C.muted,1);line(ctx,mx,y-5,mx,y+5,C.muted,1);line(ctx,ox+cpuW,y,mx,y,C.muted,.8);
    const label=`${state.wireLength.toFixed(1)} L`;rect(ctx,ox+cpuW+gap/2-22,y-9,44,18,C.paper,null);text(ctx,label,ox+cpuW+gap/2,y,12,C.ink,'center',500,mono);
    text(ctx,'drag the memory, or use the slider',w/2,h-15,11,C.muted);
  });
  function updateWire(){const l=state.wireLength;setText('wire-length',l.toFixed(1)+'×');setText('wire-cap',l.toFixed(1)+'×');setText('wire-delay',(l*l).toFixed(1)+'×');setText('wire-out','L = '+l.toFixed(2));$('wire-distance').value=Math.round(l*100);redraw('wire-c');}
  input('wire-distance',v=>{state.wireLength=v/100;updateWire();});
  $('wire-c').addEventListener('pointerdown',e=>{const b=e.currentTarget.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;if(wireHit&&x>=wireHit.x-6&&x<=wireHit.x+wireHit.w+6&&y>=wireHit.y-8&&y<=wireHit.y+wireHit.h+8){wireDragging=true;e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('dragging');e.preventDefault();}});
  $('wire-c').addEventListener('pointermove',e=>{if(!wireDragging||!wireHit)return;const b=e.currentTarget.getBoundingClientRect(),x=e.clientX-b.left;state.wireLength=clamp((x-wireHit.w/2-wireHit.start)/wireHit.base,1,4);updateWire();});
  function stopDrag(e){wireDragging=false;e.currentTarget.classList.remove('dragging');}['pointerup','pointercancel','lostpointercapture'].forEach(ev=>$('wire-c').addEventListener(ev,stopDrag));updateWire();

  new Diagram('layers-c',(ctx,w,h)=>{
    const t=state.layerSeparation,p=Math.min(w*.52,280),ox=(w-1.62*p)/2,by=h-58-.42*p,sep=Math.max(28,(h-120-.67*p)/3)*t;
    const names=['Devices','Local wiring','Longer routes','Power distribution'];
    // Each plane is drawn in its own affine projection. Thickness is purely illustrative.
    for(let k=0;k<4;k++){
      ctx.save();ctx.transform(1,-.25,.62,.42,ox,by-k*sep);
      rect(ctx,0,0,p,p,k===0?'#e7eae1':rgba('#f5f5ee',lerp(.99,.88,t)),'#a9b19e',1);
      if(k===0){
        const units=[[.03,.04,.39,.39,'cpu'],[.46,.04,.49,.39,'gpu'],[.03,.48,.39,.47,'npu'],[.46,.48,.49,.47,'mem']];
        units.forEach(([x,y,a,b,kind])=>{rect(ctx,x*p,y*p,a*p,b*p,rgba(C[kind],.24),rgba(C[kind],.5),1);hatch(ctx,x*p+3,y*p+3,a*p-6,b*p-6,rgba(C[kind],.4),kind==='mem'?'grid':'stripes',kind==='mem'?5:9);});
      }else if(k===1){
        for(let i=1;i<25;i++){const y=i*p/25,x1=p*(.03+.06*(i%3)),x2=p*(.73+.06*(i%4));line(ctx,x1,y,x2,y,'#acb49f',1.6);if(i%3===0)line(ctx,x2,y,x2,y+p*.10,'#acb49f',1.4);}
      }else if(k===2){
        for(let i=1;i<8;i++){const x=i*p/8;path(ctx,[[x,p*.03],[x,p*.27],[x+p*.035,p*.27],[x+p*.035,p*.76],[x-p*.028,p*.76],[x-p*.028,p*.97]],'#96a68c',3);}
      }else{
        for(let i=1;i<5;i++){const y=i*p/5;line(ctx,p*.02,y,p*.98,y,'#b8b69b',6);line(ctx,y,p*.02,y,p*.98,'#babfae',5);}
        for(let i=1;i<5;i++)for(let j=1;j<5;j++)rect(ctx,i*p/5-3,j*p/5-3,6,6,'#f6f6ed','#9fa78f',.5);
      }
      ctx.restore();
    }
    if(t>.36){
      const alpha=clamp((t-.36)/.3,0,1);ctx.save();ctx.globalAlpha=alpha;
      for(let k=0;k<4;k++){
        const y=by+.42*p-k*sep,x=ox+.62*p;
        line(ctx,22,y,x-5,y,'#b6beab',.8);ctx.font=`12px ${sans}`;const labelW=ctx.measureText(names[k]).width+12;rect(ctx,17,y-11,labelW,22,rgba(C.paper,.98),null);text(ctx,names[k],22,y,12,k===0?C.ink:C.muted,'left',500);
      }
      ctx.restore();
    }else{text(ctx,'More of the chip sits underneath.',w/2,26,13,C.muted);}
  });
  input('layer-separate',v=>{state.layerSeparation=v/100;setText('layer-out',v<15?'Stacked':v>85?'Separated':'Separating');setText('layer-status',v<35?'There’s more under the surface. Separate the layers to take a look.':'The wiring makes patterns too. Some of the lines carry signals; others deliver power.');redraw('layers-c');});

  // Only run visible demonstrations; nothing makes a network request.
  function tick(now){
    const dt=previous?Math.min((now-previous)/1000,.06):0;previous=now;
    if(!globalPaused&&!document.hidden){
      clock+=dt;
      const gd=diagrams.get('gpu-c');
      if(state.gpuRunning&&gd.visible){const before=gpuDone();state.gpuProgress=Math.min(gpuRounds(),state.gpuProgress+dt/.72);if(state.gpuProgress>=gpuRounds())state.gpuRunning=false;if(gpuDone()!==before||!state.gpuRunning)updateGPU();gd.dirty=true;}
      const nd=diagrams.get('npu-c');
      if(state.npuRunning&&nd.visible){state.npuElapsed+=dt;if(state.npuElapsed>=.85){state.npuElapsed-=.85;state.npuStep=Math.min(10,state.npuStep+1);if(state.npuStep===10)state.npuRunning=false;updateNPU();}}
    }
    for(const d of diagrams.values())if(d.visible&&d.dirty)d.render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  function updateProgress(){const de=document.documentElement,den=de.scrollHeight-innerHeight;const p=den>0?100*scrollY/den:0;$('progress').style.width=p+'%';}
  addEventListener('scroll',updateProgress,{passive:true});addEventListener('resize',updateProgress);updateProgress();
  document.querySelectorAll('.toc nav a').forEach(a=>a.addEventListener('click',()=>document.querySelector('.toc').removeAttribute('open')));
  addEventListener('beforeprint',()=>{for(const d of diagrams.values())d.render();});
  // A minimal inspection API for verifying the deterministic teaching models.
  window.__chipDemo={state,memory,A,B,matrixAt,gpuDone,gpuRounds,redrawAll:()=>diagrams.forEach(d=>d.render()),diagramIds:[...diagrams.keys()]};
})();
