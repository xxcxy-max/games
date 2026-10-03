// Ten varied wooden pieces tile an 8 × 5 frame.
const definitions = [
  {
    "color": "#efbb39",
    "cells": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        2,
        0
      ],
      [
        3,
        0
      ]
    ],
    "home": [
      0,
      0
    ]
  },
  {
    "color": "#69a785",
    "cells": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        0,
        1
      ],
      [
        1,
        1
      ]
    ],
    "home": [
      4,
      0
    ]
  },
  {
    "color": "#568ead",
    "cells": [
      [
        1,
        2
      ],
      [
        1,
        1
      ],
      [
        1,
        0
      ],
      [
        0,
        0
      ]
    ],
    "home": [
      6,
      0
    ]
  },
  {
    "color": "#cf7651",
    "cells": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        2,
        0
      ],
      [
        1,
        1
      ]
    ],
    "home": [
      0,
      1
    ]
  },
  {
    "color": "#df963d",
    "cells": [
      [
        1,
        0
      ],
      [
        1,
        1
      ],
      [
        0,
        1
      ],
      [
        0,
        2
      ]
    ],
    "home": [
      2,
      1
    ]
  },
  {
    "color": "#9c7bbb",
    "cells": [
      [
        1,
        0
      ],
      [
        1,
        1
      ],
      [
        1,
        2
      ],
      [
        0,
        2
      ]
    ],
    "home": [
      5,
      1
    ]
  },
  {
    "color": "#83a64e",
    "cells": [
      [
        0,
        2
      ],
      [
        0,
        1
      ],
      [
        0,
        0
      ],
      [
        1,
        1
      ]
    ],
    "home": [
      0,
      2
    ]
  },
  {
    "color": "#d26068",
    "cells": [
      [
        1,
        0
      ],
      [
        2,
        0
      ],
      [
        0,
        1
      ],
      [
        1,
        1
      ]
    ],
    "home": [
      3,
      2
    ]
  },
  {
    "color": "#6478ba",
    "cells": [
      [
        0,
        1
      ],
      [
        1,
        1
      ],
      [
        2,
        1
      ],
      [
        2,
        0
      ]
    ],
    "home": [
      5,
      3
    ]
  },
  {
    "color": "#c592aa",
    "cells": [
      [
        0,
        0
      ],
      [
        1,
        0
      ],
      [
        2,
        0
      ],
      [
        3,
        0
      ]
    ],
    "home": [
      1,
      4
    ]
  }
];
const board=document.querySelector('#board'),tray=document.querySelector('#tray'),message=document.querySelector('#message');
let pieces,selected=null,drag=null,start=null,finished=false,hints=false;
const size=()=>board.clientWidth/8;
const traySize=()=>Math.min(38,(tray.clientWidth/2-32)/4);
const bounds=c=>[Math.max(...c.map(p=>p[0]))+1,Math.max(...c.map(p=>p[1]))+1];
function shape(p,unit){const el=document.createElement('button'),[w,h]=bounds(p.cells);el.className='piece';el.style.width=w*unit+'px';el.style.height=h*unit+'px';el.setAttribute('aria-label',`积木 ${p.id+1}`);el.style.setProperty('--color',p.color);p.cells.forEach(([x,y])=>{const t=document.createElement('span');t.className='tile';Object.assign(t.style,{left:x*unit+'px',top:y*unit+'px',width:unit+'px',height:unit+'px'});el.append(t)});return el}
function render(){board.replaceChildren();tray.replaceChildren();const u=size();for(let y=0;y<5;y++)for(let x=0;x<8;x++){const cell=document.createElement('div');cell.className='square';if(hints){const d=definitions.find(d=>d.cells.some(([cx,cy])=>cx+d.home[0]===x&&cy+d.home[1]===y));cell.style.background=d.color;cell.classList.add('hint')}cell.addEventListener('click',()=>{if(selected!==null)place(selected,x,y)});board.append(cell)}pieces.forEach(p=>{const slot=document.createElement('div');slot.className='slot';tray.append(slot);const el=shape(p,p.pos?u:traySize());el.classList.toggle('selected',selected===p.id);if(p.pos){el.classList.add('on-board');el.style.left=p.pos[0]*u+'px';el.style.top=p.pos[1]*u+'px';board.append(el)}else slot.append(el);el.addEventListener('pointerdown',e=>begin(e,p));el.addEventListener('click',e=>{e.stopPropagation();selected=p.id;render()})});const count=pieces.filter(p=>p.pos).length*4;document.querySelector('#progress').textContent=`${count} / 40 格`;if(count===40&&!finished){finished=true;celebrate();sound('win');message.textContent='拼好了！每一块都找到了自己的位置 🎉'}}
function valid(id,x,y){const p=pieces[id];return p.cells.every(([cx,cy])=>{const a=x+cx,b=y+cy;return a>=0&&a<8&&b>=0&&b<5&&!pieces.some(q=>q.id!==id&&q.pos&&q.cells.some(([qx,qy])=>qx+q.pos[0]===a&&qy+q.pos[1]===b))})}
function place(id,x,y){if(valid(id,x,y)){sound('place');pieces[id].pos=[x,y];start??=Date.now();message.textContent='放得很好，继续试试下一块。';selected=null;hints=false;render()}else{sound('error');message.textContent='这里放不下，试试旋转或换一个位置。'}}
function begin(e,p){if(e.button!==0)return;e.preventDefault();sound('pick');selected=p.id;const rect=e.currentTarget.getBoundingClientRect(),unit=p.pos?size():traySize();drag={id:p.id,x:e.clientX,y:e.clientY,offsetX:(e.clientX-rect.left)/unit,offsetY:(e.clientY-rect.top)/unit,moved:false};render()}
document.addEventListener('pointermove',e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5&&!drag.moved)return;drag.moved=true;if(!drag.ghost){drag.ghost=shape(pieces[drag.id],size());drag.ghost.classList.add('ghost');document.body.append(drag.ghost)}drag.ghost.style.left=e.clientX-drag.offsetX*size()+'px';drag.ghost.style.top=e.clientY-drag.offsetY*size()+'px'});
document.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;d.ghost?.remove();if(d.moved){const r=board.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)place(d.id,Math.round((e.clientX-r.left)/size()-d.offsetX),Math.round((e.clientY-r.top)/size()-d.offsetY));else if(e.clientX>=tray.getBoundingClientRect().left&&e.clientY>=tray.getBoundingClientRect().top&&e.clientY<=tray.getBoundingClientRect().bottom){pieces[d.id].pos=null;finished=false;render()}}});
document.addEventListener('pointercancel',()=>{drag?.ghost?.remove();drag=null});
function rotate(){sound('rotate');if(selected===null){message.textContent='先选择一块积木。';return}const p=pieces[selected],old=p.cells;const rotated=old.map(([x,y])=>[-y,x]),minX=Math.min(...rotated.map(c=>c[0])),minY=Math.min(...rotated.map(c=>c[1]));p.cells=rotated.map(([x,y])=>[x-minX,y-minY]);if(p.pos&&!valid(p.id,...p.pos)){p.cells=old;message.textContent='旋转空间不足，请先取回积木。'}render()}
document.querySelector('#rotate').onclick=rotate;
document.querySelector('#return').onclick=()=>{if(selected===null){message.textContent='先选择要取回的积木。';return}pieces[selected].pos=null;finished=false;render()};
document.querySelector('#hint').onclick=()=>{hints=!hints;render();message.textContent=hints?'木框中的颜色是一种可行拼法。':'参考图已收起。'};
function reset(){document.querySelector('#confetti')?.remove();drag?.ghost?.remove();drag=null;pieces=definitions.map((d,id)=>({...d,id,cells:d.cells.map(c=>[...c]),pos:null}));selected=null;start=null;finished=false;hints=false;document.querySelector('#time').textContent='00:00';message.textContent='选一块积木，开始拼搭吧。';render()}
document.querySelector('#reset').onclick=reset;
document.addEventListener('keydown',e=>{if(e.target.matches('button,a,input,select'))return;if(e.key.toLowerCase()==='r')rotate();if(e.key==='Escape'){selected=null;render()}});
window.addEventListener('resize',render);
setInterval(()=>{if(!start||finished)return;const t=Math.floor((Date.now()-start)/1000);document.querySelector('#time').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`},1000);
let audioContext,muted=false;
function sound(type){if(muted)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audioContext??=new Audio();audioContext.resume();const notes={pick:[440],place:[523,659],rotate:[392,523],error:[180],win:[523,659,784,1047,784,1047]}[type];notes.forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime+i*.12;o.type=type==='error'?'triangle':'sine';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.24)})}catch{}}
function celebrate(){document.querySelector('#confetti')?.remove();const layer=document.createElement('div');layer.id='confetti';layer.setAttribute('aria-hidden','true');const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;for(let i=0;i<(reduced?24:100);i++){const bit=document.createElement('i');bit.style.setProperty('--x',Math.random()*100+'vw');bit.style.setProperty('--drift',(Math.random()-.5)*260+'px');bit.style.setProperty('--delay',Math.random()*.8+'s');bit.style.setProperty('--duration',2.5+Math.random()*1.5+'s');bit.style.background=definitions[i%definitions.length].color;layer.append(bit)}document.body.append(layer);setTimeout(()=>layer.remove(),5200)}
document.querySelector('#sound').onclick=()=>{muted=!muted;document.querySelector('#sound').textContent=muted?'音效：关':'音效：开';document.querySelector('#sound').setAttribute('aria-pressed',String(!muted));if(!muted)sound('pick')};
reset();
