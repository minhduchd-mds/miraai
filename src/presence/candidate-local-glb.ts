/** Client-side, no-upload scan of an explicitly selected .glb.
 * Reject external URI references before passing bytes to GLTFLoader.
 * This is an experimental preview gate, NOT a production avatar approval. */
export type CandidateInspection={name:string;bytes:number;vertices:number;triangles:number;meshes:number};
const MAX_FILE=16*1024*1024;
const MAX_JSON=1024*1024;
export async function inspectLocalCandidateGLB(file:Pick<File,'name'|'size'|'slice'>):Promise<CandidateInspection>{
 if(!/\.glb$/i.test(file.name)||file.size<28||file.size>MAX_FILE)
   throw new Error('Chỉ nhận file GLB 2.0 tối đa 16 MB.');
 const head=new DataView(await file.slice(0,20).arrayBuffer());
 if(head.getUint32(0,true)!==0x46546c67||head.getUint32(4,true)!==2||
    head.getUint32(8,true)!==file.size||head.getUint32(16,true)!==0x4e4f534a)
   throw new Error('File không đúng định dạng GLB 2.0.');
 const jsonLength=head.getUint32(12,true);
 if(jsonLength<2||jsonLength>MAX_JSON||jsonLength%4!==0||20+jsonLength>file.size)
   throw new Error('JSON GLB quá lớn hoặc không hợp lệ.');
 let doc:Record<string,unknown>;
 try{
   const raw=await file.slice(20,20+jsonLength).arrayBuffer();
   doc=JSON.parse(new TextDecoder().decode(raw)) as Record<string,unknown>;
 }catch{throw new Error('Không đọc được dữ liệu GLB.');}
 if(!doc||typeof doc!=='object'||(doc.asset as {version?:string}|undefined)?.version!=='2.0')
   throw new Error('GLB phải dùng chuẩn glTF 2.0.');
 // GLTFLoader can otherwise follow buffers/images URI references to the network.
 const toVisit:unknown[]=[doc];
 let visited=0;
 while(toVisit.length){
   const value=toVisit.pop();
   if(++visited>120_000)throw new Error('Cấu trúc GLB quá phức tạp.');
   if(!value||typeof value!=='object')continue;
   for(const [key,entry] of Object.entries(value)){
     if(key.toLowerCase()==='uri'&&typeof entry==='string')
       throw new Error('GLB chứa tài nguyên ngoài. Chỉ dùng texture nhúng.');
     if(entry&&typeof entry==='object')toVisit.push(entry);
   }
 }
 const meshes=Array.isArray(doc.meshes)?doc.meshes:[];
 const accessors=Array.isArray(doc.accessors)?doc.accessors:[];
 const nodes=Array.isArray(doc.nodes)?doc.nodes:[];
 if(meshes.length<1||meshes.length>64||nodes.length>256||accessors.length>1024)
   throw new Error('Số lượng mesh/node vượt giới hạn thử nghiệm.');
 let vertices=0,triangles=0;
 for(const mesh of meshes){
   const primitives=(mesh as {primitives?:Array<{attributes?:{POSITION?:number};indices?:number}>}).primitives||[];
   for(const p of primitives){
     const vertexCount=Number((accessors[p.attributes?.POSITION??-1] as {count?:number}|undefined)?.count)||0;
     const indexCount=p.indices===undefined?vertexCount:
       Number((accessors[p.indices] as {count?:number}|undefined)?.count)||0;
     vertices+=vertexCount;triangles+=Math.floor(indexCount/3);
   }
 }
 if(vertices<3||vertices>400_000||triangles>650_000)
   throw new Error('Mức độ phức tạp của model không phù hợp thiết bị.');
 return {name:file.name,bytes:file.size,vertices,triangles,meshes:meshes.length};
}
