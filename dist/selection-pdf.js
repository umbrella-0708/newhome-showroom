'use strict';

/* Local PDF export: no print dialog, server upload, or remote font required. */
window.SelectionPDF = (() => {
  const W=794, H=1123, M=46, RIGHT=W-M, BOTTOM=1042;
  const FONT='"Microsoft YaHei","PingFang SC",Arial,sans-serif';
  const INK='#182722', MUTED='#62706a', LINE='#dfe5e1', WASH='#f3f6f4';
  const face=(size,weight=400)=>weight+' '+size+'px '+FONT;

  function layout(model, measure) {
    const pages=[];
    let commands=[],y=112;
    const put=(type,data)=>commands.push({type,...data});
    const label=(value,x,top,size=13,color=INK,weight=400)=>put('text',{value:String(value),x,y:top,size,color,weight});
    const line=(top,color=LINE)=>put('line',{x:M,y:top,x2:RIGHT,color});
    const rect=(x,top,width,height,color)=>put('rect',{x,y:top,width,height,color});
    const wrap=(value,width,size=13,weight=400)=>{
      const lines=[];
      for(const paragraph of String(value??'').split('\n')) {
        let current='';
        for(const char of Array.from(paragraph)) {
          if(current && measure(current+char,size,weight)>width) {lines.push(current.trimEnd());current=char;}
          else current+=char;
        }
        lines.push(current.trimEnd());
      }
      return lines;
    };
    const texts=(lines,x,top,size=13,color=INK,weight=400,leading=20)=>lines.forEach((value,i)=>label(value,x,top+i*leading,size,color,weight));
    const page=()=>{pages.push(commands);commands=[];y=112;};
    const ensure=(height)=>{if(y+height>BOTTOM) {page();return true;}return false;};
    const paragraph=(value,{size=13,color=MUTED,leading=21,gap=10}={})=>{
      for(const valueLine of wrap(value,RIGHT-M,size)) {
        ensure(leading);label(valueLine,M,y,size,color);y+=leading;
      }
      y+=gap;
    };
    label('项目合作意向',M,y,12,MUTED);y+=25;
    label('服务配置清单',M,y,32,INK,600);y+=49;
    const projectLines=wrap(model.project,RIGHT-M,19,500);
    texts(projectLines,M,y,19,INK,500,29);y+=projectLines.length*29+7;
    label(model.sections.length+' 项意向 · '+model.serviceCount+' 项服务与交付明细',M,y,12,MUTED);y+=38;

    const feeHeader=continued=>{
      rect(M,y,RIGHT-M,34,WASH);label('合作费用摘要'+(continued?' · 续':''),M+12,y+9,14,INK,600);y+=34;
    };
    feeHeader(false);
    for(const entry of model.feeRows) {
      const left=wrap(entry.name,440,12.5),right=wrap(entry.fee,206,12.5);
      const height=Math.max(left.length,right.length)*20+16;
      if(ensure(height+12))feeHeader(true);
      rect(M,y,RIGHT-M,height,WASH);
      texts(left,M+12,y+8,12.5,MUTED,400,20);texts(right,M+480,y+8,12.5,INK,400,20);y+=height;
    }
    y+=10;paragraph('不同计费方式分别列示，待核价服务由商务确认后补充',{size:11.5,leading:18,gap:22});

    for(const section of model.sections) {
      const heading=continued=>{
        line(y,INK);y+=14;
        label(section.category+(continued?' · 续':''),M,y,11.5,MUTED);y+=21;
        const titles=wrap(section.title,440,21,600),meta=wrap(section.configuration+' · '+section.fee,235,12);
        texts(titles,M,y,21,INK,600,29);texts(meta,M+468,y+3,12,MUTED,400,19);
        y+=Math.max(titles.length*29,meta.length*19)+16;
        rect(M,y,RIGHT-M,31,WASH);
        label('具体服务项',M+10,y+8,11.5,MUTED);label('规格与交付内容',M+184,y+8,11.5,MUTED);label('费用口径',M+568,y+8,11.5,MUTED);y+=31;
      };
      ensure(160);heading(false);
      for(const entry of section.rows) {
        const names=wrap(entry.name,150,13,500),fees=wrap(entry.fee,124,12);
        const specs=wrap(entry.spec,352,13,500);
        const detailLines=entry.details.flatMap(value=>wrap('• '+value,352,12));
        let content=[...specs.map(value=>({value,weight:500,color:INK})),...detailLines.map(value=>({value,weight:400,color:MUTED}))];
        let first=true;
        while(content.length) {
          const minimum=Math.max(names.length*21+26,fees.length*20+20,80);
          if(y+minimum>BOTTOM) {page();heading(true);}
          const capacity=Math.max(1,Math.floor((BOTTOM-y-22)/20));
          const chunk=content.splice(0,capacity);
          const height=Math.max(chunk.length*20+22,names.length*21+38,fees.length*20+22);
          texts(names,M+10,y+12,13,INK,500,21);
          label(entry.kind+(first?'':' · 续'),M+10,y+names.length*21+17,10.5,MUTED);
          chunk.forEach((part,index)=>label(part.value,M+184,y+12+index*20,part.weight===500?13:12,part.color,part.weight));
          texts(fees,M+568,y+12,12,MUTED,400,20);
          y+=height;line(y);first=false;
          if(content.length) {page();heading(true);}
        }
      }
      y+=10;
      section.notes.forEach(value=>paragraph(value,{size:11.5,leading:19,gap:4}));
      y+=20;
    }
    if(model.notes) {
      ensure(105);line(y);y+=17;label('项目需求',M,y,17,INK,600);y+=30;
      paragraph(model.notes,{size:14,color:INK,leading:24,gap:18});
    }
    ensure(68);line(y);y+=14;
    paragraph('参考费用、服务数量、资源档期和具体交付以双方确认的合作约定为准',{size:11,leading:18,gap:4});
    if(model.hasOverlappingServices)paragraph('同类服务同时出现在基础方案和单项意向中时，交付次数与增配范围需确认',{size:11,leading:18,gap:0});
    if(commands.length)pages.push(commands);
    return pages;
  }

  function paint(context,commands,{logo,date,page,total}) {
    context.fillStyle='#fff';context.fillRect(0,0,W,H);
    if(logo)context.drawImage(logo,M,42,274,36.3);
    else {context.font=face(18,600);context.fillStyle=INK;context.fillText('贝壳 × 妙窝生活',M,48);}
    context.textBaseline='top';context.fillStyle=MUTED;context.font=face(11);
    context.fillText(date,RIGHT-context.measureText(date).width,54);
    context.strokeStyle=LINE;context.lineWidth=1;context.beginPath();context.moveTo(M,94);context.lineTo(RIGHT,94);context.stroke();
    for(const command of commands) {
      if(command.type==='text') {context.font=face(command.size,command.weight);context.fillStyle=command.color;context.fillText(command.value,command.x,command.y);}
      if(command.type==='rect') {context.fillStyle=command.color;context.fillRect(command.x,command.y,command.width,command.height);}
      if(command.type==='line') {context.strokeStyle=command.color;context.beginPath();context.moveTo(command.x,command.y);context.lineTo(command.x2,command.y);context.stroke();}
    }
    context.font=face(10.5);context.fillStyle=MUTED;context.fillText('贝壳 × 妙窝生活 · 广州新房营销',M,H-40);
    const count=page+' / '+total;context.fillText(count,RIGHT-context.measureText(count).width,H-40);
  }

  function loadLogo(url) {
    return new Promise(resolve=>{
      const logo=new Image();let finished=false;
      const finish=value=>{if(!finished){finished=true;clearTimeout(timer);resolve(value);}};
      const timer=setTimeout(()=>finish(null),5000);
      logo.onload=()=>finish(logo);logo.onerror=()=>finish(null);logo.src=url;
    });
  }

  async function create(model,{logoUrl,onProgress=()=>{}}={}) {
    if(!window.PDFLib?.PDFDocument)throw Error('PDF 组件未加载，请刷新后重试');
    onProgress('正在整理服务与交付明细');
    const canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;
    const context=canvas.getContext('2d');
    if(!context)throw Error('当前浏览器无法生成清单，请在 Safari 中重试');
    context.scale(2,2);
    await Promise.race([document.fonts?.ready||Promise.resolve(),new Promise(resolve=>setTimeout(resolve,1500))]);
    const logo=logoUrl?await loadLogo(logoUrl):null;
    const pages=layout(model,(value,size,weight)=>{context.font=face(size,weight);return context.measureText(value).width;});
    const pdf=await window.PDFLib.PDFDocument.create();
    pdf.setTitle(model.project+' · 服务配置清单');pdf.setAuthor('贝壳 × 妙窝生活');pdf.setCreator('新房营销服务展示台');
    const previews=[];
    for(let index=0;index<pages.length;index++) {
      onProgress('正在生成第 '+(index+1)+' / '+pages.length+' 页');
      paint(context,pages[index],{logo,date:model.date,page:index+1,total:pages.length});
      const jpeg=canvas.toDataURL('image/jpeg',.94);
      const image=await pdf.embedJpg(jpeg);
      const page=pdf.addPage([595.28,841.89]);page.drawImage(image,{x:0,y:0,width:595.28,height:841.89});
      previews.push(jpeg);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    canvas.width=canvas.height=1;
    const bytes=await pdf.save();
    const filename=(model.project.replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').trim().slice(0,60)||'项目')+'-服务配置清单.pdf';
    return {bytes,previews,filename,pageCount:pages.length};
  }
  return {create,layout,paint};
})();
