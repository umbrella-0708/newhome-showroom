import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const [,file] of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) {
  if (/^(https?:|data:)/.test(file)) continue;
  assert(fs.existsSync(path.join(root,file.split(/[?#]/)[0])),`Missing entry asset: ${file}`);
}
for (const file of fs.readdirSync(root).filter(file=>file.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
}
const context={window:{},Intl,Date};vm.createContext(context);
for (const file of ['data.js','services.js','manual.js','configurator.js','selection-document.js','selection-pdf.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
}
const {CATALOG,SHOWROOM,MANUAL,createConfigurator,SelectionDocument}=context.window;
const products=Object.fromEntries(SHOWROOM.products.map(p=>[p.id,p]));
for (const group of CATALOG.groups) for (const id of group.services) assert(CATALOG.services[id],`Missing service ${id}`);
const images=new Set();
function collect(value,key='') {
  if (typeof value==='string' && /^(image|cover|board)$/.test(key)) images.add(value);
  if (Array.isArray(value)) value.forEach(v=>collect(v,key==='gallery'?'image':''));
  else if (value && typeof value==='object') Object.entries(value).forEach(([k,v])=>collect(v,k));
}
collect(CATALOG);collect(SHOWROOM);collect(MANUAL);
for (const name of images) assert(fs.existsSync(path.join(root,'assets',name+'.webp')),`Missing image ${name}`);
for (const id of ['matrix','focus']) {
  const config=createConfigurator({services:CATALOG.services,groups:CATALOG.groups,products,manual:MANUAL,stored:()=>null});
  if (id==='matrix') config.change(id,'variant','original');
  config.change(id,'addon','digital',true);
  config.change(id,'spec','digital','full');
  config.change(id,'addon','film',true);
  const item=config.snapshot(id);
  const model=SelectionDocument.create({items:[item],project:'测试项目',notes:''});
  assert(model.sections[0].rows.some(r=>r.name==='主片交付'));
  assert(model.sections[0].rows.some(r=>r.name==='数字案场扩展场景'));
  assert(model.sections[0].rows.every(r=>r.fee && r.spec));
  assert(config.renderPlan(id).includes('mobile-config-bar'));
}
const matrix=createConfigurator({services:CATALOG.services,groups:CATALOG.groups,products,manual:MANUAL,
  stored:()=>({package:'light',addOns:[{id:'digital',mode:'fee',spec:'basic'}]})});
assert.equal(matrix.snapshot('matrix').basePrice,'9.9 / 12 万元');
assert(matrix.snapshot('matrix').addOns.some(item=>item.id==='digital'));
matrix.change('matrix','variant','no-digital');
for (const [tier,price] of [['light','8 万元'],['mid','12 万元'],['full','18 万元']]) {
  matrix.change('matrix','tier',tier);
  const item=matrix.snapshot('matrix');
  assert.equal(item.basePrice,price);
  assert(!item.addOns.some(addOn=>addOn.id==='digital'));
  assert(!matrix.renderPlan('matrix').includes('data-id="digital"'));
  const model=SelectionDocument.create({items:[item],project:'测试项目',notes:''});
  assert.equal(model.sections[0].fee,price);
  assert(model.sections[0].configuration.includes('不含数字移动案场'));
  assert(!model.sections[0].rows.some(entry=>entry.name.includes('数字案场')));
}
assert(fs.readFileSync(path.join(root,'assets/brand.svg'),'utf8').includes('贝壳 × 妙窝生活'));
assert(fs.existsSync(path.join(root,'assets/brand-print.png')));
const exportModel=SelectionDocument.create({items:[{id:'focus',package:'diamond'},{id:'film'}],project:'项目',notes:'确认推广节点\n确认具体交付'});
const exportPages=context.window.SelectionPDF.layout(exportModel,(value,size)=>Array.from(value).length*size);
assert(exportPages.length>1);
for(const commands of exportPages)for(const command of commands)assert(command.y>=100 && command.y<1062,'PDF content outside the page');
console.log(`Validated scripts, ${images.size} image references, service records, configuration and PDF details`);
