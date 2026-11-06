import { useState } from "react";
import { addElementAtPoint, getCurrentPageContext } from "@canva/design";
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

function polygonElement(points:number[][], strokeColor="#222222") {
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const left=Math.min(...xs), top=Math.min(...ys);
  const width=Math.max(...xs)-left, height=Math.max(...ys)-top;
  const path="M "+points.map(([x,y])=>(x-left)+" "+(y-top)).join(" L ")+" Z";
  return {type:"shape" as const,left,top,width,height,viewBox:{left:0,top:0,width,height},paths:[{d:path,fill:{color:strokeColor}}]};
}
function shapeElements(s:Shape,x:number,y:number,stroke:number):any[] {
  const w=px(s.bottom),h=px(s.height);
  if(s.kind==="Rectangle") {
    return [{type:"shape",top:y,left:x,width:w,height:h,viewBox:{top:0,left:0,width:w,height:h},paths:[{d:`M 0 0 H ${w} V ${h} H 0 Z M ${stroke} ${stroke} V ${h-stroke} H ${w-stroke} V ${stroke} Z`,fill:{color:"#222222"}}]}];
  }
  if(s.kind==="Circle") {
    const r=w/2,t=stroke,inner=Math.max(0,r-t);
    return [{type:"shape",top:y,left:x,width:w,height:h,viewBox:{top:0,left:0,width:w,height:h},paths:[{d:`M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${2*r} A ${r} ${r} 0 1 1 ${r} 0 Z M ${r} ${t} A ${inner} ${inner} 0 1 0 ${r} ${2*r-t} A ${inner} ${inner} 0 1 0 ${r} ${t} Z`,fill:{color:"#222222"}}]}];
  }
  const topWidth=px(s.top), inset=(w-topWidth)/2;
  const p1=[inset,0],p2=[inset+topWidth,0],p3=[w,h],p4=[0,h];
  const linePoly=(a:number[],b:number[])=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    const ox=-dy/len*stroke/2,oy=dx/len*stroke/2;
    return [[a[0]+ox,a[1]+oy],[b[0]+ox,b[1]+oy],[b[0]-ox,b[1]-oy],[a[0]-ox,a[1]-oy]];
  };
  return [[p1,p2],[p2,p3],[p3,p4],[p4,p1]].map(pair=>{
    const el=polygonElement(linePoly(pair[0],pair[1]));
    return {...el,top:el.top+y,left:el.left+x};
  });
}
function makeShapeElements(s:Shape,x:number,y:number,stroke:number):any[] {
  const elements=shapeElements(s,x,y,stroke);
  const w=px(s.bottom),h=px(s.height);
  if(s.label) elements.push({type:"text",children:[s.label],top:y+h/2-14,left:x,width:w,fontSize:28,color:"#000000",textAlign:"center",fontWeight:"bold"});
  return elements;
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
  setBusy(true);setStatus("Calculating page layout…");
  try{
   const pageContext=await getCurrentPageContext();
   const dimensions=pageContext.dimensions;
   if(!dimensions) throw new Error("This design has no fixed page dimensions. Open a fixed-size Canva design.");
   const margin=40,gap=24,stroke=px(0.08);
   const pageWidth=dimensions.width,pageHeight=dimensions.height;
   const placements=shapes.map(shape=>({shape,width:px(shape.bottom),height:px(shape.height)}));
   for(const item of placements){
    if(item.width>pageWidth-margin*2||item.height>pageHeight-margin*2)
     throw new Error(`A ${item.shape.kind.toLowerCase()} (${item.shape.bottom} × ${item.shape.height} cm) is larger than the usable page area.`);
   }
   const pages:any[][]=[];
   let current:any[]=[];
   let x=margin,y=margin,rowHeight=0;
   for(const item of placements){
    const {shape,width,height}=item;
    if(x+width>pageWidth-margin){x=margin;y+=rowHeight+gap;rowHeight=0;}
    if(y+height>pageHeight-margin){
     if(current.length) pages.push(current);
     current=[];x=margin;y=margin;rowHeight=0;
    }
    current.push(...makeShapeElements(shape,x,y,stroke));
    x+=width+gap;rowHeight=Math.max(rowHeight,height);
   }
   if(current.length) pages.push(current);
   if(!pages.length) throw new Error("No printable elements were generated.");
   setStatus(`Adding ${shapes.length} shapes across ${pages.length} page(s)…`);
   for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
    if(pageIndex===0){
     for(const element of pages[pageIndex]) await addElementAtPoint(element);
    }else{
     await addPage({title:`Bharath Sports · ${pageIndex+1}`,elements:pages[pageIndex]});
    }
   }
   setStatus(`Export complete. ${shapes.length} shapes placed across ${pages.length} page(s). Rectangles and circles are single editable shapes; each trapezium side and each center label is separate and editable.`);
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
  <section className="panel"><h2>2. Page layout · {shapes.length} shapes</h2><div className="preview">{shapes.length?shapes.map((s,i)=><div className="item" key={s.id}><span>{i+1}. {s.kind} · {s.bottom} × {s.height} cm{s.label?" · "+s.label:""}</span><button className="remove" onClick={()=>remove(s.id)}>Remove</button></div>):"Your shapes will appear here."}</div><p className="note">Dimensions convert from centimetres to Canva pixels (96 px per inch). Elements are packed into rows using the current page dimensions. When a page fills, the remaining shapes continue automatically on new Canva pages.</p></section>
  <section className="panel"><h2>3. Canva export</h2><p className="note">Adds editable shapes to the current Canva design. Rectangles and circles are single shape elements. Each trapezium side and center label is independent. Overflow continues onto new pages automatically.</p><button className="primary" disabled={!shapes.length||busy||!canAdd} onClick={exportAll}>{busy?"Exporting…":"Add to Canva"}</button>{!canAdd&&<p className="note">This Canva design type does not support adding positioned elements.</p>}{status&&<p className="status" role="status">{status}</p>}</section>
 </div>;
};
