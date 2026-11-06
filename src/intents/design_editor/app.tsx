import { useState } from "react";
import { addElementAtPoint } from "@canva/design";
import { useFeatureSupport } from "@canva/app-hooks";

type Kind = "Trapezium" | "Rectangle" | "Circle";
type Shape = { id:number; kind:Kind; top:number; bottom:number; height:number; label:string };
const px = (cm:number) => cm * (96 / 2.54);
const valid = (n:number) => Number.isFinite(n) && n > 0;

const css = `
*{box-sizing:border-box}body{margin:0;background:#111;color:#f5f5f5;font-family:Arial,sans-serif}
.app{padding:16px;background:#111;min-height:100vh}.head{display:flex;justify-content:space-between;align-items:center}
h1{font-size:20px;margin:0}.sub,.muted{font-size:12px;color:#999;margin-top:4px}.tag{border:1px solid #444;border-radius:20px;padding:5px 9px;font-size:10px;color:#bbb}
.panel{border:1px solid #333;border-radius:13px;padding:14px;margin-top:14px;background:#171717}
h2{font-size:13px;margin:0 0 12px;color:#ddd}.tabs{display:flex;gap:6px;margin-bottom:12px}
button{cursor:pointer}.tabs button,.secondary{background:#242424;color:#ddd;border:1px solid #444;border-radius:8px;padding:9px;flex:1}
.tabs button.active{background:#eee;color:#111;border-color:#eee}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.field label{display:block;color:#999;font-size:11px;margin-bottom:5px}
input{width:100%;background:#222;color:white;border:1px solid #444;border-radius:8px;padding:10px;font-size:14px}
.primary{background:#f3f3f3;color:#111;border:0;border-radius:9px;padding:12px 14px;font-weight:700;width:100%;margin-top:12px}
.primary:disabled{opacity:.45;cursor:not-allowed}.preview{border:1px dashed #444;border-radius:10px;padding:10px;min-height:80px;color:#888;font-size:12px}
.item{padding:9px 2px;border-bottom:1px solid #333;color:#ddd;display:flex;justify-content:space-between;gap:8px}
.remove{background:transparent;border:0;color:#aaa}.note{font-size:11px;color:#999;line-height:1.5}.status{font-size:12px;color:#ddd;margin-top:10px}
`;

function shapePath(points:number[][]) {
  return "M "+points.map(p=>p.join(" ")).join(" L ")+" Z";
}
function outlineChildren(s:Shape, stroke:number) {
  const w=px(s.bottom), h=px(s.height), t=stroke;
  if(s.kind==="Rectangle") return [
    {type:"shape" as const,top:0,left:0,width:w,height:t,viewBox:{top:0,left:0,width:w,height:t},paths:[{d:shapePath([[0,0],[w,0],[w,t],[0,t]]),fill:{color:"#222222"}}]},
    {type:"shape" as const,top:0,left:0,width:t,height:h,viewBox:{top:0,left:0,width:t,height:h},paths:[{d:shapePath([[0,0],[t,0],[t,h],[0,h]]),fill:{color:"#222222"}}]},
    {type:"shape" as const,top:h-t,left:0,width:w,height:t,viewBox:{top:0,left:0,width:w,height:t},paths:[{d:shapePath([[0,0],[w,0],[w,t],[0,t]]),fill:{color:"#222222"}}]},
    {type:"shape" as const,top:0,left:w-t,width:t,height:h,viewBox:{top:0,left:0,width:t,height:h},paths:[{d:shapePath([[0,0],[t,0],[t,h],[0,h]]),fill:{color:"#222222"}}]}
  ];
  const top=px(s.top), inset=(w-top)/2;
  const leftSide= Math.sqrt(h*h+inset*inset);
  const leftPoly=[[0,0],[inset,0],[inset+t* h/leftSide,t*inset/leftSide],[0,h]];
  const rightPoly=[[inset+top,0],[w,0],[w,h],[inset+top-t*h/leftSide,h-t*inset/leftSide]];
  return [
    {type:"shape" as const,top:0,left:inset,width:top,height:t,viewBox:{top:0,left:0,width:top,height:t},paths:[{d:shapePath([[0,0],[top,0],[top,t],[0,t]]),fill:{color:"#222222"}}]},
    {type:"shape" as const,top:0,left:0,width:inset+t,height:h,viewBox:{top:0,left:0,width:inset+t,height:h},paths:[{d:shapePath(leftPoly),fill:{color:"#222222"}}]},
    {type:"shape" as const,top:h-t,left:0,width:w,height:t,viewBox:{top:0,left:0,width:w,height:t},paths:[{d:shapePath([[0,0],[w,0],[w,t],[0,t]]),fill:{color:"#222222"}}]},
    {type:"shape" as const,top:0,left:inset+top-t,width:w-inset-top+t,height:h,viewBox:{top:0,left:0,width:w-inset-top+t,height:h},paths:[{d:shapePath(rightPoly.map(([x,y])=>[x-(inset+top-t),y])),fill:{color:"#222222"}}]}
  ];
}
function circlePath(r:number,t:number) {
  const inner=Math.max(0,r-t);
  return `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${2*r} A ${r} ${r} 0 1 1 ${r} 0 Z M ${r} ${t} A ${inner} ${inner} 0 1 0 ${r} ${2*r-t} A ${inner} ${inner} 0 1 0 ${r} ${t} Z`;
}

export const App = () => {
 const supported=useFeatureSupport();
 const canAdd=supported(addElementAtPoint);
 const [kind,setKind]=useState<Kind>("Trapezium");
 const [top,setTop]=useState(""),[bottom,setBottom]=useState(""),[height,setHeight]=useState(""),[label,setLabel]=useState("");
 const [shapes,setShapes]=useState<Shape[]>([]);
 const [status,setStatus]=useState(""); const [busy,setBusy]=useState(false);
 const addShape=()=>{
  const b=Number(bottom), h=kind==="Circle"?b:Number(height), u=kind==="Trapezium"?Number(top):b;
  if(!valid(b)||!valid(h)||!valid(u)||(kind==="Trapezium"&&u>b)){setStatus("Check the measurements. All dimensions must be positive, and the upper width cannot exceed the lower width.");return;}
  setShapes(prev=>[...prev,{id:Date.now()+prev.length,kind,top:u,bottom:b,height:h,label:label.trim()}]);setStatus("");
 };
 const exportAll=async()=>{
  if(!shapes.length||!canAdd)return;
  setBusy(true);setStatus("Adding editable elements to the current Canva page…");
  try{
   let x=40,y=40,rowHeight=0;
   const pageWidth=1000,gap=36,stroke=px(0.08);
   for(const s of shapes){
    const w=px(s.bottom),h=px(s.height);
    if(x+w>pageWidth){x=40;y+=rowHeight+gap;rowHeight=0;}
    if(s.kind==="Circle"){
     const r=w/2,t=stroke;
     await addElementAtPoint({type:"shape",top:y,left:x,width:w,height:h,viewBox:{top:0,left:0,width:w,height:h},paths:[{d:circlePath(r,t),fill:{color:"#222222"}}]});
    }else{
     const children=outlineChildren(s,stroke);
     await addElementAtPoint({type:"group",top:y,left:x,width:w,height:h,children});
    }
    if(s.label) await addElementAtPoint({type:"text",children:[s.label],top:y+h/2-14,left:x,width:w,fontSize:28,color:"#000000",textAlign:"center",fontWeight:"bold"});
    x+=w+gap;rowHeight=Math.max(rowHeight,h);
   }
   setStatus("Export complete. Borders are editable vector shapes; each center label is a separate text element.");
  }catch(error){setStatus("Export stopped: "+(error instanceof Error?error.message:String(error)));}
  finally{setBusy(false);}
 };
 const remove=(id:number)=>setShapes(prev=>prev.filter(s=>s.id!==id));
 return <div className="app"><style>{css}</style>
  <header className="head"><div><h1>Bharath Sports</h1><div className="sub">Shape layout builder</div></div><span className="tag">Canva app</span></header>
  <section className="panel"><h2>1. Create a shape</h2>
   <div className="tabs">{(["Trapezium","Rectangle","Circle"] as Kind[]).map(k=><button key={k} className={kind===k?"active":""} onClick={()=>setKind(k)}>{k}</button>)}</div>
   <div className="grid">
    {kind==="Trapezium"&&<div className="field"><label>Upper width (cm)</label><input type="number" min="0.1" step="0.1" value={top} onChange={e=>setTop(e.target.value)}/></div>}
    <div className="field"><label>{kind==="Circle"?"Diameter":"Lower width"} (cm)</label><input type="number" min="0.1" step="0.1" value={bottom} onChange={e=>setBottom(e.target.value)}/></div>
    {kind!=="Circle"&&<div className="field"><label>Height (cm)</label><input type="number" min="0.1" step="0.1" value={height} onChange={e=>setHeight(e.target.value)}/></div>}
    <div className="field"><label>Center text</label><input value={label} onChange={e=>setLabel(e.target.value)} maxLength={40}/></div>
   </div>
   <button className="primary" onClick={addShape}>Add shape</button>
  </section>
  <section className="panel"><h2>2. Page layout · {shapes.length} shapes</h2><div className="preview">{shapes.length?shapes.map((s,i)=><div className="item" key={s.id}><span>{i+1}. {s.kind} · {s.bottom} × {s.height} cm{s.label?" · "+s.label:""}</span><button className="remove" onClick={()=>remove(s.id)}>Remove</button></div>):"Your shapes will appear here."}</div><p className="note">Dimensions convert from centimetres to Canva pixels (96 px per inch). Elements are placed in rows on the current page. This version does not create extra Canva pages automatically.</p></section>
  <section className="panel"><h2>3. Canva export</h2><p className="note">Adds native editable vector outlines and separate center text to the currently open Canva design. Rectangle and trapezium borders are grouped so you can move the outline together or edit individual segments.</p><button className="primary" disabled={!shapes.length||busy||!canAdd} onClick={exportAll}>{busy?"Exporting…":"Add to Canva"}</button>{!canAdd&&<p className="note">This Canva design type does not support adding positioned elements.</p>}{status&&<p className="status" role="status">{status}</p>}</section>
 </div>;
};
