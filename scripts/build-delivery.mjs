import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]||path.join(root,'delivery'));
const dist=path.join(root,'dist');
fs.mkdirSync(output,{recursive:true});
let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
html=html.replace(/<link rel="stylesheet" href="([^"]+)"([^>]*)>/g,(_,file,attrs)=>'<style'+(attrs.includes('media="print"')?' media="print"':'')+'>'+fs.readFileSync(path.join(dist,file),'utf8')+'</style>');
const scripts=[...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map(match=>match[1]);
html=html.replace(/\s*<script defer src="[^"]+"><\/script>/g,'');
const assets=Object.fromEntries(fs.readdirSync(path.join(dist,'assets')).filter(file=>/\.(svg|webp)$/.test(file)).map(file=>[
  path.parse(file).name,'data:'+(file.endsWith('.svg')?'image/svg+xml':'image/webp')+';base64,'+fs.readFileSync(path.join(dist,'assets',file)).toString('base64')
]));
let inline='<script>window.INLINE_ASSETS='+JSON.stringify(assets)+';</script>';
for(const file of scripts)inline+='<script>'+fs.readFileSync(path.join(dist,file),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>';
html=html.replace('</body>',inline+'\n</body>');
fs.writeFileSync(path.join(output,'新房营销服务目录-动效版.html'),html);
const staging=path.join(output,'newhome-showroom');
fs.mkdirSync(staging,{recursive:true});
for(const item of ['dist','scripts','.github','README.md'])fs.cpSync(path.join(root,item),path.join(staging,item),{recursive:true});
const archive=path.join(output,'新房营销展示台-GitHub交付包.zip');
if(fs.existsSync(archive))fs.unlinkSync(archive);
execFileSync('zip',['-q','-r',archive,'newhome-showroom'],{cwd:output});
console.log('Offline HTML and GitHub source package prepared in '+output);
