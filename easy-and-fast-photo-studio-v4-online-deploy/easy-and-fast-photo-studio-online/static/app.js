const $=s=>document.querySelector(s);
const canvas=$("#previewCanvas"),ctx=canvas.getContext("2d",{willReadFrequently:true});
let original=null,originalData=null,splitBackgroundData=null,activePreset="none",compare=false;
const controls=[
["Exposure",-100,100,0],["Contrast",-100,100,0],["Highlights",-100,100,0],["Shadows",-100,100,0],
["Temperature",-100,100,0],["Saturation",-100,100,0],["Vibrance",-100,100,0],["Fade",0,100,0]
];
const presets={
none:{},warm:{exposure:5,contrast:8,highlights:-12,shadows:10,temperature:24,saturation:12,vibrance:10,fade:5},
cinema:{exposure:-4,contrast:24,highlights:-30,shadows:-5,temperature:-8,saturation:-12,vibrance:10,fade:8},
teal:{exposure:0,contrast:18,highlights:-15,shadows:8,temperature:-18,saturation:12,vibrance:22,fade:0},
matte:{exposure:8,contrast:-15,highlights:-20,shadows:18,temperature:5,saturation:-18,vibrance:-5,fade:30},
bw:{exposure:2,contrast:24,highlights:-10,shadows:4,temperature:0,saturation:-100,vibrance:0,fade:5},
vivid:{exposure:4,contrast:15,highlights:-8,shadows:5,temperature:2,saturation:28,vibrance:35,fade:0},
moody:{exposure:-12,contrast:22,highlights:-28,shadows:-12,temperature:-12,saturation:-22,vibrance:8,fade:12}
};
const templates={portrait:"warm",travel:"vivid",food:"warm",night:"cinema"};
let values={...presets.none};
function buildSliders(){
 $("#sliders").innerHTML=controls.map(([name,min,max,val])=>`<div class="slider-row"><div class="slider-label"><label>${name}</label><output id="v-${name}">${val}</output></div><input type="range" min="${min}" max="${max}" value="${val}" step="1" data-key="${name.toLowerCase()}"></div>`).join("");
 $("#sliders").querySelectorAll("input").forEach(el=>el.addEventListener("input",()=>{values[el.dataset.key]=+el.value;$("#v-"+controls.find(x=>x[0].toLowerCase()===el.dataset.key)[0]).value=el.value;render();}));
}
buildSliders();
function setValues(next){values={...presets.none,...next};$("#sliders").querySelectorAll("input").forEach(el=>{el.value=values[el.dataset.key]||0;$("#v-"+controls.find(x=>x[0].toLowerCase()===el.dataset.key)[0]).value=el.value;});render();}
function selectPreset(id){activePreset=id;document.querySelectorAll(".preset").forEach(b=>b.classList.toggle("active",b.dataset.preset===id));setValues(presets[id]);}
document.querySelectorAll(".preset").forEach(b=>b.addEventListener("click",()=>selectPreset(b.dataset.preset)));
document.querySelectorAll(".template").forEach(b=>b.addEventListener("click",()=>{selectPreset(templates[b.dataset.template]);toast("ใช้เทมเพลต "+b.textContent.trim()+" แล้ว");}));
function clamp(v){return Math.max(0,Math.min(255,v));}
function render(){
 if(!originalData)return;
 const base=splitBackgroundData||originalData;const d=new ImageData(new Uint8ClampedArray(base.data),base.width,base.height),p=d.data;
 const exp=Math.pow(2,(values.exposure||0)/50),contrast=1+(values.contrast||0)/100,sat=1+(values.saturation||0)/100,vib=(values.vibrance||0)/100;
 const temp=(values.temperature||0)*.38,fade=(values.fade||0)/100;
 for(let i=0;i<p.length;i+=4){
  let r=p[i]*exp,g=p[i+1]*exp,b=p[i+2]*exp;
  const lum=.2126*r+.7152*g+.0722*b;
  const shadow=(values.shadows||0)/100*Math.max(0,1-lum/255)*45;
  const high=(values.highlights||0)/100*Math.max(0,lum/255)*45;
  r=(r+shadow+high-128)*contrast+128+temp;
  g=(g+shadow+high-128)*contrast+128;
  b=(b+shadow+high-128)*contrast+128-temp;
  const l=.2126*r+.7152*g+.0722*b;
  const localSat=sat+vib*(1-Math.min(1,Math.abs(l-128)/128));
  r=l+(r-l)*localSat;g=l+(g-l)*localSat;b=l+(b-l)*localSat;
  if(activePreset==="teal"){b+=Math.max(0,128-l)*.17;g+=Math.max(0,128-l)*.05;r+=Math.max(0,l-128)*.12;}
  if(activePreset==="moody"){g+=7;b-=4;}
  r=r*(1-fade)+128*fade*.22;g=g*(1-fade)+128*fade*.22;b=b*(1-fade)+128*fade*.22;
  p[i]=clamp(r);p[i+1]=clamp(g);p[i+2]=clamp(b);
 }
 ctx.putImageData(d,0,0);
}
async function loadFile(file){
 if(!file)return;
 const ext=file.name.split(".").pop().toLowerCase();
 const raw=["3fr","ari","arw","bay","cap","cr2","cr3","dcs","dcr","dng","drf","eip","erf","fff","gpr","iiq","k25","kdc","mdc","mef","mos","mrw","nef","nrw","obm","orf","pef","ptx","pxn","r3d","raf","raw","rw2","rwl","sr2","srf","srw","x3f"].includes(ext);
 try{
  let src;
  if(raw){
   const fd=new FormData();fd.append("file",file);
   const res=await fetch("/decode",{method:"POST",body:fd}),json=await res.json();
   if(!res.ok)throw new Error(json.error||"เปิดไฟล์ RAW ไม่สำเร็จ");
   src=json.data;
  }else src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  const img=new Image();img.onload=()=>{const scale=Math.min(1,2200/Math.max(img.width,img.height));canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);ctx.drawImage(img,0,0,canvas.width,canvas.height);original=img;originalData=ctx.getImageData(0,0,canvas.width,canvas.height);if(window.gigaResetForImage)window.gigaResetForImage();maskCanvas.width=canvas.width;maskCanvas.height=canvas.height;maskData=new Uint8Array(canvas.width*canvas.height);interaction.hidden=false;canvas.hidden=false;$("#emptyState").hidden=true;$("#exportBtn").disabled=false;$("#compareBtn").disabled=false;$("#fileInfo").textContent=file.name;$("#dimensions").textContent=`${img.width} × ${img.height}`;selectPreset("none");setTool("brush");syncOverlaySize();toast("โหลดภาพเรียบร้อย");};img.onerror=()=>toast("ไม่สามารถอ่านไฟล์ภาพนี้ได้");img.src=src;
 }catch(e){toast(e.message);}
}
$("#fileInput").addEventListener("change",e=>loadFile(e.target.files[0]));
$("#emptyUpload").onclick=()=>$("#fileInput").click();
$("#dropzone").addEventListener("dragover",e=>{e.preventDefault();$("#dropzone").style.borderColor="#d6ff5f";});
$("#dropzone").addEventListener("dragleave",()=>$("#dropzone").style.borderColor="");
$("#dropzone").addEventListener("drop",e=>{e.preventDefault();loadFile(e.dataTransfer.files[0]);});
$("#resetBtn").onclick=()=>selectPreset("none");
$("#compareBtn").addEventListener("pointerdown",()=>{if(originalData){ctx.putImageData(originalData,0,0);compare=true;}});
["pointerup","pointerleave","pointercancel"].forEach(ev=>$("#compareBtn").addEventListener(ev,()=>{if(compare){render();compare=false;}}));
$("#exportBtn").onclick=()=>{if(!originalData)return;const a=document.createElement("a");a.download="giga-edited-photo.jpg";a.href=canvas.toDataURL("image/jpeg",.95);a.click();toast("Export JPG เรียบร้อย");};
$("#fitSelect").onchange=()=>{canvas.style.objectFit=$("#fitSelect").value;};
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400);}

// Local editing: feathered brush masks and directional colored light.
const stage=$("#previewStage"), interaction=$("#interactionCanvas"), ictx=interaction.getContext("2d");
let maskCanvas=document.createElement("canvas"),maskCtx=maskCanvas.getContext("2d"),maskData=null;
let activeTool="brush",eraseMode=false,isDrawing=false,strokeLast=null,lightDrag=null,lights=[];
const val=id=>+$("#"+id).value;
function hexRgb(hex){return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}
function syncOverlaySize(){const r=stage.getBoundingClientRect();interaction.width=Math.max(1,Math.round(r.width*devicePixelRatio));interaction.height=Math.max(1,Math.round(r.height*devicePixelRatio));ictx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);drawOverlay();}
function imagePoint(e){const r=canvas.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return null;return {x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height,sx:e.clientX-stage.getBoundingClientRect().left,sy:e.clientY-stage.getBoundingClientRect().top};}
function paintAt(pt){const radius=val("brushSize")/2,feather=val("brushFeather")/100,outer=radius*(1+feather*1.8),x0=Math.max(0,Math.floor(pt.x-outer)),x1=Math.min(canvas.width-1,Math.ceil(pt.x+outer)),y0=Math.max(0,Math.floor(pt.y-outer)),y1=Math.min(canvas.height-1,Math.ceil(pt.y+outer));const sign=eraseMode?-1:1;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const dist=Math.hypot(x-pt.x,y-pt.y);if(dist>outer)continue;let a=dist<=radius?1:Math.pow(Math.max(0,1-(dist-radius)/(outer-radius||1)),2);const i=y*canvas.width+x;maskData[i]=Math.max(0,Math.min(255,maskData[i]+sign*a*255));}}
function drawOverlay(){if(!interaction.width)return;const w=stage.clientWidth,h=stage.clientHeight;ictx.clearRect(0,0,w,h);const r=canvas.getBoundingClientRect(),sr=stage.getBoundingClientRect();if(!canvas.hidden){ictx.save();ictx.strokeStyle="#d6ff5f";ictx.fillStyle="rgba(214,255,95,.12)";ictx.lineWidth=2;for(const l of lights){const x1=r.left-sr.left+l.x1/canvas.width*r.width,y1=r.top-sr.top+l.y1/canvas.height*r.height,x2=r.left-sr.left+l.x2/canvas.width*r.width,y2=r.top-sr.top+l.y2/canvas.height*r.height;ictx.beginPath();ictx.moveTo(x1,y1);ictx.lineTo(x2,y2);ictx.stroke();ictx.beginPath();ictx.arc(x1,y1,5,0,Math.PI*2);ictx.fill();ictx.beginPath();ictx.arc(x2,y2,4,0,Math.PI*2);ictx.stroke();}if(lightDrag){ictx.beginPath();ictx.moveTo(lightDrag.x1,lightDrag.y1);ictx.lineTo(lightDrag.x2,lightDrag.y2);ictx.stroke();}ictx.restore();}}
function applyLocalEffects(d){if(!maskData||!canvas.width)return;const p=d.data,[cr,cg,cb]=hexRgb($("#brushColor").value),exp=Math.pow(2,val("localExposure")/50),temp=val("localTemp")*.35,sat=1+val("localSat")/100,tint=val("brushTint")/100;for(let i=0,j=0;i<p.length;i+=4,j++){const m=maskData[j]/255;if(m<=0)continue;let r=p[i],g=p[i+1],b=p[i+2];r*=1+(exp-1)*m;g*=1+(exp-1)*m;b*=1+(exp-1)*m;r+=temp*m;b-=temp*m;const lum=.2126*r+.7152*g+.0722*b;r=lum+(r-lum)*((1-sat)*m+sat);g=lum+(g-lum)*((1-sat)*m+sat);b=lum+(b-lum)*((1-sat)*m+sat);r=r*(1-tint*m)+cr*tint*m;g=g*(1-tint*m)+cg*tint*m;b=b*(1-tint*m)+cb*tint*m;p[i]=clamp(r);p[i+1]=clamp(g);p[i+2]=clamp(b);}}
function applyLights(d){if(!lights.length)return;const p=d.data,w=canvas.width,h=canvas.height;for(const l of lights){const dx=l.x2-l.x1,dy=l.y2-l.y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,[rC,gC,bC]=hexRgb(l.color),maxDist=Math.hypot(w,h)*l.length/100,spread=Math.max(4,Math.min(w,h)*l.soft/100*.45),power=l.power/100*.8;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const vx=x-l.x1,vy=y-l.y1,t=vx*ux+vy*uy;if(t<0||t>maxDist)continue;const side=Math.abs(vx*uy-vy*ux),width=spread*(.35+t/maxDist*1.8);if(side>width*2.5)continue;const fall=Math.max(0,1-t/maxDist),edge=Math.exp(-Math.pow(side/width,2)*1.6),a=power*fall*edge;const i=(y*w+x)*4;p[i]=clamp(p[i]+(rC-p[i])*a);p[i+1]=clamp(p[i+1]+(gC-p[i+1])*a);p[i+2]=clamp(p[i+2]+(bC-p[i+2])*a);}}}
const baseRender=render;
render=function(){if(!originalData)return;const base=splitBackgroundData||originalData;const d=new ImageData(new Uint8ClampedArray(base.data),base.width,base.height),p=d.data;const exp=Math.pow(2,(values.exposure||0)/50),contrast=1+(values.contrast||0)/100,sat=1+(values.saturation||0)/100,vib=(values.vibrance||0)/100;const temp=(values.temperature||0)*.38,fade=(values.fade||0)/100;for(let i=0;i<p.length;i+=4){let r=p[i]*exp,g=p[i+1]*exp,b=p[i+2]*exp;const lum=.2126*r+.7152*g+.0722*b;const shadow=(values.shadows||0)/100*Math.max(0,1-lum/255)*45;const high=(values.highlights||0)/100*Math.max(0,lum/255)*45;r=(r+shadow+high-128)*contrast+128+temp;g=(g+shadow+high-128)*contrast+128;b=(b+shadow+high-128)*contrast+128-temp;const l=.2126*r+.7152*g+.0722*b;const localSat=sat+vib*(1-Math.min(1,Math.abs(l-128)/128));r=l+(r-l)*localSat;g=l+(g-l)*localSat;b=l+(b-l)*localSat;if(activePreset==="teal"){b+=Math.max(0,128-l)*.17;g+=Math.max(0,128-l)*.05;r+=Math.max(0,l-128)*.12;}if(activePreset==="moody"){g+=7;b-=4;}r=r*(1-fade)+128*fade*.22;g=g*(1-fade)+128*fade*.22;b=b*(1-fade)+128*fade*.22;p[i]=clamp(r);p[i+1]=clamp(g);p[i+2]=clamp(b);}applyLocalEffects(d);applyLights(d);ctx.putImageData(d,0,0);for(const layer of layers){if(layer.type!=="pixel"||!layer.visible||!layer.image)continue;ctx.save();ctx.globalAlpha=(layer.opacity??100)/100;ctx.drawImage(layer.image,0,0,canvas.width,canvas.height);ctx.restore();}};
function resetLocal(){if(maskData)maskData.fill(0);lights=[];drawOverlay();render();}
function setTool(tool){activeTool=tool;document.querySelectorAll(".tool-btn").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));$("#brushSettings").hidden=tool!=="brush";$("#lightSettings").hidden=tool!=="light";$("#toolHelp").textContent=tool==="brush"?"ระบายบนภาพเพื่อเลือกพื้นที่ที่ต้องการปรับ":"ลากจากจุดกำเนิดแสงไปยังทิศทางที่ต้องการบนภาพ";stage.classList.toggle("editing",!canvas.hidden);}
document.querySelectorAll(".tool-btn").forEach(b=>b.addEventListener("click",()=>setTool(b.dataset.tool)));
interaction.addEventListener("pointerdown",e=>{if(canvas.hidden)return;const pt=imagePoint(e);if(!pt)return;interaction.setPointerCapture(e.pointerId);if(activeTool==="brush"){isDrawing=true;strokeLast=pt;paintAt(pt);render();}else{isDrawing=true;lightDrag={x1:pt.sx,y1:pt.sy,x2:pt.sx,y2:pt.sy,ix:pt.x,iy:pt.y};drawOverlay();}});
interaction.addEventListener("pointermove",e=>{if(!isDrawing)return;const pt=imagePoint(e);if(!pt)return;if(activeTool==="brush"){const prev=strokeLast||pt,dist=Math.hypot(pt.x-prev.x,pt.y-prev.y),steps=Math.max(1,Math.ceil(dist/Math.max(2,val("brushSize")/5)));for(let k=1;k<=steps;k++)paintAt({x:prev.x+(pt.x-prev.x)*k/steps,y:prev.y+(pt.y-prev.y)*k/steps});strokeLast=pt;render();}else if(lightDrag){lightDrag.x2=pt.sx;lightDrag.y2=pt.sy;drawOverlay();}});
function finishPointer(e){if(!isDrawing)return;if(activeTool==="light"&&lightDrag){const pt=imagePoint(e);if(pt&&Math.hypot(pt.x-lightDrag.ix,pt.y-lightDrag.iy)>5){lights.push({x1:lightDrag.ix,y1:lightDrag.iy,x2:pt.x,y2:pt.y,color:$("#lightColor").value,power:val("lightPower"),soft:val("lightSoft"),length:val("lightLength")});render();}}isDrawing=false;strokeLast=null;lightDrag=null;drawOverlay();}
interaction.addEventListener("pointerup",finishPointer);interaction.addEventListener("pointercancel",finishPointer);
$("#eraseBtn").onclick=()=>{eraseMode=!eraseMode;$("#eraseBtn").textContent="ยางลบ: "+(eraseMode?"เปิด":"ปิด");};
$("#clearLocalBtn").onclick=resetLocal;$("#clearLightBtn").onclick=()=>{lights=[];drawOverlay();render();};
["brushSize","brushFeather","localExposure","localTemp","localSat","brushTint","lightPower","lightSoft","lightLength"].forEach(id=>$("#"+id).addEventListener("input",()=>{$("#"+id+"Val").textContent=$("#"+id).value;if(["localExposure","localTemp","localSat","brushTint","lightPower","lightSoft","lightLength"].includes(id))render();}));
$("#lightColor").addEventListener("change",()=>{if(lights.length){lights[lights.length-1].color=$("#lightColor").value;render();}});
window.addEventListener("resize",syncOverlaySize);new ResizeObserver(syncOverlaySize).observe(stage);


// V3 layer stack, history, AI masks and onboarding.
let layers=[],activeLayerId=null,history=[],historyIndex=-1,historyLock=false,historyTimer=null;
const cloneLayer=l=>({id:l.id,name:l.name,type:l.type,visible:l.visible,opacity:l.opacity,mask:l.mask?new Uint8Array(l.mask):null,lights:l.lights?l.lights.map(x=>({...x})):[],imageSrc:l.imageSrc||null});
function snapshot(){if(historyLock||!originalData)return;const state={values:{...values},activePreset,layers:layers.map(cloneLayer),activeLayerId,splitBackgroundData:splitBackgroundData?Array.from(splitBackgroundData.data):null};const encoded=JSON.stringify(state,(k,v)=>v instanceof Uint8Array?Array.from(v):v);if(historyIndex>=0&&history[historyIndex]===encoded)return;history=history.slice(0,historyIndex+1);history.push(encoded);if(history.length>35)history.shift();historyIndex=history.length-1;syncHistoryButtons();}
function syncHistoryButtons(){$("#undoBtn").disabled=historyIndex<=0;$("#redoBtn").disabled=historyIndex<0||historyIndex>=history.length-1;}
function restoreSnapshot(index){if(index<0||index>=history.length)return;historyLock=true;const s=JSON.parse(history[index]);values={...s.values};activePreset=s.activePreset;layers=s.layers.map(l=>{const q={...l,mask:l.mask?new Uint8Array(l.mask):null,image:null};if(q.type==="pixel"&&q.imageSrc){q.image=new Image();q.image.onload=()=>render();q.image.src=q.imageSrc;}return q;});splitBackgroundData=s.splitBackgroundData?new ImageData(new Uint8ClampedArray(s.splitBackgroundData),canvas.width,canvas.height):null;activeLayerId=s.activeLayerId;historyIndex=index;syncActiveLayer();syncLayerUI();syncSliders();render();drawOverlay();historyLock=false;syncHistoryButtons();}
function syncSliders(){document.querySelectorAll("#sliders input").forEach(el=>{el.value=values[el.dataset.key]??0;const c=controls.find(x=>x[0].toLowerCase()===el.dataset.key);if(c)$("#v-"+c[0]).value=el.value;});document.querySelectorAll(".preset").forEach(b=>b.classList.toggle("active",b.dataset.preset===activePreset));}
function syncActiveLayer(){const l=layers.find(x=>x.id===activeLayerId);if(l?.type==="brush")maskData=l.mask;else maskData=null;if(l?.type==="light")lights=l.lights;else lights=[];}
function makeLayer(type){if(!originalData)return toast("先อัปโหลดภาพก่อน");const id="layer-"+Date.now()+"-"+Math.random().toString(16).slice(2,6);const l={id,name:(type==="brush"?"Brush ":"Light ")+ (layers.filter(x=>x.type===type).length+1),type,visible:true,opacity:100,mask:type==="brush"?new Uint8Array(canvas.width*canvas.height):null,lights:[]};layers.push(l);activeLayerId=id;syncActiveLayer();syncLayerUI();snapshot();return l;}
function syncLayerUI(){const host=$("#layerList");if(!host)return;host.innerHTML=layers.slice().reverse().map(l=>`<div class="layer-item ${l.id===activeLayerId?"active":""}" data-layer="${l.id}"><button class="layer-vis" data-vis="${l.id}" title="ซ่อน/แสดง">${l.visible?"◉":"○"}</button><span class="layer-name">${l.name}</span><span class="layer-type">${l.type.toUpperCase()}</span><input aria-label="ความทึบ" data-opacity="${l.id}" type="range" min="0" max="100" value="${l.opacity}" style="width:58px"><button data-remove="${l.id}" title="ลบ">×</button></div>`).join("")||'<div class="layer-empty">ยังไม่มีเลเยอร์</div>';host.querySelectorAll(".layer-item").forEach(el=>el.addEventListener("click",e=>{if(e.target.closest("button")||e.target.matches("input"))return;activeLayerId=el.dataset.layer;syncActiveLayer();syncLayerUI();drawOverlay();}));host.querySelectorAll("[data-vis]").forEach(b=>b.onclick=e=>{e.stopPropagation();const l=layers.find(x=>x.id===b.dataset.vis);l.visible=!l.visible;syncLayerUI();render();snapshot();});host.querySelectorAll("[data-remove]").forEach(b=>b.onclick=e=>{e.stopPropagation();layers=layers.filter(x=>x.id!==b.dataset.remove);if(activeLayerId===b.dataset.remove)activeLayerId=layers.at(-1)?.id||null;syncActiveLayer();syncLayerUI();render();snapshot();});host.querySelectorAll("[data-opacity]").forEach(inp=>inp.oninput=()=>{const l=layers.find(x=>x.id===inp.dataset.opacity);l.opacity=+inp.value;render();});host.querySelectorAll("[data-opacity]").forEach(inp=>inp.onchange=snapshot);}
$("#addBrushLayer").onclick=()=>{makeLayer("brush");setTool("brush");};$("#addLightLayer").onclick=()=>{makeLayer("light");setTool("light");};
$("#layerDelete").onclick=()=>{if(!activeLayerId)return;layers=layers.filter(x=>x.id!==activeLayerId);activeLayerId=layers.at(-1)?.id||null;syncActiveLayer();syncLayerUI();render();snapshot();};
$("#layerUp").onclick=()=>moveLayer(1);$("#layerDown").onclick=()=>moveLayer(-1);
function moveLayer(delta){const i=layers.findIndex(x=>x.id===activeLayerId),j=i+delta;if(i<0||j<0||j>=layers.length)return;[layers[i],layers[j]]=[layers[j],layers[i]];syncLayerUI();render();snapshot();}
$("#undoBtn").onclick=()=>restoreSnapshot(historyIndex-1);$("#redoBtn").onclick=()=>restoreSnapshot(historyIndex+1);
$("#sliders").addEventListener("input",()=>{clearTimeout(historyTimer);historyTimer=setTimeout(snapshot,450);});
$("#resetBtn").addEventListener("click",()=>{setTimeout(snapshot,0);});
const priorLoadFile=loadFile;
loadFile=function(file){priorLoadFile(file);};
const originalLoadImageHandler=loadFile;
// Image initialization is observed through the image element's load event.
canvas.addEventListener("load",()=>{});
let trackedImageKey="";
window.gigaResetForImage=()=>{splitBackgroundData=null;trackedImageKey=`${canvas.width}x${canvas.height}:${$("#fileInfo").textContent}`;layers=[];activeLayerId=null;history=[];historyIndex=-1;makeLayer("brush");syncLayerUI();snapshot();};
const imageObserver=new MutationObserver(()=>{if(!canvas.hidden&&originalData){const key=`${canvas.width}x${canvas.height}:${$("#fileInfo").textContent}`;if(key!==trackedImageKey){trackedImageKey=key;layers=[];activeLayerId=null;history=[];historyIndex=-1;makeLayer("brush");syncLayerUI();snapshot();}}});
imageObserver.observe(canvas,{attributes:true,attributeFilter:["hidden"]});
const oldSetTool=setTool;
setTool=function(tool){if(tool==="light"&&!layers.some(l=>l.id===activeLayerId&&l.type==="light")){const l=makeLayer("light");if(!l)return;}else if(tool==="brush"&&!layers.some(l=>l.id===activeLayerId&&l.type==="brush")){const l=makeLayer("brush");if(!l)return;}syncActiveLayer();oldSetTool(tool);syncLayerUI();};
const oldApplyLocalEffects=applyLocalEffects;
applyLocalEffects=function(d){const active=maskData;for(const l of layers){if(l.type!=="brush"||!l.visible||!l.mask)continue;maskData=l.mask;const before=new Uint8ClampedArray(d.data);oldApplyLocalEffects(d);const opacity=l.opacity/100;if(opacity<1)for(let i=0;i<d.data.length;i++)d.data[i]=before[i]+(d.data[i]-before[i])*opacity;}maskData=active;};
const oldApplyLights=applyLights;
applyLights=function(d){const active=lights;for(const l of layers){if(l.type!=="light"||!l.visible||!l.lights?.length)continue;lights=l.lights;const before=new Uint8ClampedArray(d.data);oldApplyLights(d);const opacity=l.opacity/100;if(opacity<1)for(let i=0;i<d.data.length;i++)d.data[i]=before[i]+(d.data[i]-before[i])*opacity;}lights=active;};
const oldResetLocal=resetLocal;
resetLocal=function(){for(const l of layers){if(l.mask)l.mask.fill(0);if(l.lights)l.lights=[];}syncActiveLayer();drawOverlay();render();snapshot();};
const oldFinishPointer=finishPointer;
finishPointer=function(e){oldFinishPointer(e);snapshot();};
const oldClearLight= $("#clearLightBtn").onclick;
$("#clearLightBtn").onclick=()=>{if(lights)lights.length=0;drawOverlay();render();snapshot();};
// Each light vector is a free 360-degree direction, measured clockwise from the top.
const oldFinishHint=$("#toolHelp").textContent;
interaction.addEventListener("pointerup",e=>{if(lightDrag){const deg=(Math.atan2(lightDrag.y2-lightDrag.y1,lightDrag.x2-lightDrag.x1)*180/Math.PI+360)%360;$("#toolHelp").textContent=`ทิศทางแสง ${Math.round(deg)}° · ลากได้อิสระ 360°`;}});
async function splitImageLayers(){
 if(!originalData)return toast("อัปโหลดภาพก่อนแยกเลเยอร์");
 const btn=$("#splitLayersBtn");btn.disabled=true;const old=btn.textContent;btn.textContent="กำลังแยกวัตถุ…";
 try{
  const blob=await new Promise(resolve=>{const c=document.createElement("canvas");c.width=canvas.width;c.height=canvas.height;c.getContext("2d").putImageData(originalData,0,0);c.toBlob(resolve,"image/png");});
  const fd=new FormData();fd.append("file",blob,"source.png");
  const res=await fetch("/separate-layers",{method:"POST",body:fd}),json=await res.json();if(!res.ok)throw new Error(json.error||"AI layer separation error");
  const bg=new Image();bg.src=json.background;await bg.decode();const bc=document.createElement("canvas");bc.width=canvas.width;bc.height=canvas.height;bc.getContext("2d").drawImage(bg,0,0,bc.width,bc.height);splitBackgroundData=bc.getContext("2d").getImageData(0,0,bc.width,bc.height);
  layers=layers.filter(l=>l.type!=="pixel");
  for(const item of json.layers||[]){const im=new Image();im.src=item.image;await im.decode();layers.push({id:"pixel-"+Date.now()+"-"+Math.random().toString(16).slice(2,6),name:item.name,type:"pixel",visible:true,opacity:100,image:im,imageSrc:item.image,mask:null,lights:[]});}
  activeLayerId=layers.find(l=>l.type==="pixel")?.id||layers.at(-1)?.id||null;syncActiveLayer();syncLayerUI();render();snapshot();toast(`แยกเลเยอร์แล้ว ${json.layers.length} ชั้น`+(json.note?" · "+json.note:""));
 }catch(e){toast(e.message);}finally{btn.disabled=false;btn.textContent=old;}
}
$("#splitLayersBtn").addEventListener("click",splitImageLayers);
async function createAIMask(target){if(!originalData)return toast("อัปโหลดภาพก่อนใช้ AI Mask");const btn=document.querySelector(`[data-mask="${target}"]`);btn.disabled=true;btn.textContent="กำลังวิเคราะห์…";try{const blob=await new Promise(resolve=>{const c=document.createElement("canvas");c.width=canvas.width;c.height=canvas.height;c.getContext("2d").putImageData(originalData,0,0);c.toBlob(resolve,"image/png");});const fd=new FormData();fd.append("file",blob,"source.png");fd.append("target",target);const res=await fetch("/ai-mask",{method:"POST",body:fd}),json=await res.json();if(!res.ok)throw new Error(json.error||"AI Mask error");let img=new Image();img.src=json.mask;await img.decode();const c=document.createElement("canvas");c.width=canvas.width;c.height=canvas.height;const cx=c.getContext("2d");cx.drawImage(img,0,0,c.width,c.height);const raw=cx.getImageData(0,0,c.width,c.height).data;let l=layers.find(x=>x.id===activeLayerId&&x.type==="brush");if(!l)l=makeLayer("brush");if(!l)return;for(let i=0,j=0;i<raw.length;i+=4,j++)l.mask[j]=raw[i];syncActiveLayer();setTool("brush");render();drawOverlay();snapshot();toast("สร้าง AI Mask เรียบร้อย");}catch(e){toast(e.message);}finally{btn.disabled=false;btn.textContent=target==="person"?"คน":target==="sky"?"ท้องฟ้า":"ฉากหลัง";}}
document.querySelectorAll("[data-mask]").forEach(b=>b.addEventListener("click",()=>createAIMask(b.dataset.mask)));
// First-run tutorial and persistent Help Center.
const helpPages=[{title:"เริ่มต้นใช้งาน",body:"<p>1. อัปโหลดภาพจากแถบด้านซ้าย</p><p>2. เลือก Looks หรือปรับ Exposure, Contrast และสี</p><p>3. กด + Brush เพื่อระบายเลือกพื้นที่ หรือ + Light เพื่อสร้างแสง</p>"},{title:"เลเยอร์และแสง",body:"<p>เลือกเลเยอร์เพื่อแก้ไขเฉพาะชั้นนั้น</p><p>ใช้ปุ่ม ◉ เพื่อซ่อน/แสดง ปรับความทึบด้วยแถบเลื่อน และใช้ ↑ ↓ เพื่อจัดลำดับ</p><p>ลากเส้นบนภาพเพื่อกำหนดทิศทางแสงได้ครบ 360 องศา</p>"},{title:"AI Mask และประวัติ",body:"<p>กด คน / ท้องฟ้า / ฉากหลัง เพื่อสร้างมาสก์อัตโนมัติ；กด แยกวัตถุ AI เพื่อสร้างเลเยอร์ภาพแยกคนและสิ่งของ ต้องติดตั้งแพ็กเกจ AI เพิ่มก่อน</p><p>ใช้ ↶ Undo และ ↷ Redo เพื่อย้อนหรือคืนค่าการแก้ไข</p><p>กด Help บนแถบด้านบนเพื่อเปิดคู่มือนี้อีกครั้ง</p>"}];let helpPage=0;
function showHelp(page=0){helpPage=page;$("#modalTitle").textContent=helpPages[page].title;$("#modalBody").innerHTML=helpPages[page].body;$("#tutorialPrev").disabled=page===0;$("#tutorialNext").textContent=page===helpPages.length-1?"เริ่มใช้งาน":"ถัดไป";$("#welcomeModal").hidden=false;}
$("#helpBtn").onclick=()=>showHelp(0);$("#tutorialPrev").onclick=()=>showHelp(Math.max(0,helpPage-1));$("#tutorialNext").onclick=()=>{if(helpPage<helpPages.length-1)showHelp(helpPage+1);else{$("#welcomeModal").hidden=true;localStorage.setItem("giga-v3-tutorial-seen","1");}};document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=()=>$("#welcomeModal").hidden=true);$("#welcomeModal").addEventListener("click",e=>{if(e.target.id==="welcomeModal")$("#welcomeModal").hidden=true;});
if(!localStorage.getItem("giga-v3-tutorial-seen"))showHelp(0);

// Record completed adjustment changes without flooding the history stack while dragging sliders.
let localHistoryTimer=null;
[...document.querySelectorAll("#brushSettings input, #lightSettings input")].forEach(el=>{el.addEventListener("change",snapshot);el.addEventListener("input",()=>{clearTimeout(localHistoryTimer);localHistoryTimer=setTimeout(snapshot,500);});});
document.querySelectorAll(".preset,.template").forEach(el=>el.addEventListener("click",()=>setTimeout(snapshot,0)));
