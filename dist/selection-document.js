'use strict';

window.SelectionDocument = (() => {
  const services = window.CATALOG.services;
  const products = Object.fromEntries(window.SHOWROOM.products.map(product => [product.id,product]));
  const manual = window.MANUAL;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[character]));
  const text = value => String(value ?? '').trim();
  const feeText = value => text(value).replace(/手册/g,'');
  const serviceId = name => Object.keys(services).find(id => services[id].name === name);
  const row = (name,spec,details,kind,fee) => ({name,spec,details,kind,fee});

  function digitalRows(spec,kind,fee) {
    const full = /满配|full/.test(spec);
    const undecided = !/基础|满配|basic|full/.test(spec);
    const rows = [
      row('数字案场展示入口','楼盘卡片及 VR 入口',[
        '贝壳 APP 详情页 VR 入口、心选定制楼盘卡片',
        '楼盘卡片停留 6 个月，配套呈现及定制图文信息窗'
      ],kind,fee),
      row('楼盘配套与产品展示','户型及场景信息',[
        '特价户型最多 6 个、区域配套最多 50 个标签、项目鉴赏最多 20 个标签',
        '基础 VR 航拍、项目展示与示范区导览，按确认版本制作'
      ],kind,fee),
      row('数字案场制作','制作周期约 2–4 周',[
        '开发商提供符合要求的图文素材',
        '建设中项目的建模费用另计，航拍需符合空域、天气与项目条件'
      ],kind,fee)
    ];
    if (full) rows.splice(2,0,row('数字案场扩展场景','满配版',[
      '景观漫游、区位交通、户型动态落位与品牌展示',
      '阳台景观等具体场景按确认的产品版本及拍摄条件交付'
    ],kind,fee));
    if (undecided) rows.push(row('产品版本','基础版／满配版待确认',[
      '按选定版本确认场景、功能和制作范围'
    ],kind,fee));
    return rows;
  }

  function filmRows(kind,fee,executive) {
    const rows = products.film.deliverables.map(([name,detail]) =>
      row(name,name === '主片交付' ? '高清主片 1 条' : '标准服务',[detail],kind,fee));
    if (executive) rows.push(row('增值出镜','事业部总级别出镜人',[
      '具体人选、出镜安排和拍摄档期需确认'
    ],kind,'标准服务另加 1 万元'));
    return rows;
  }

  function serviceRows(id,spec,kind,fee,options = {}) {
    const bundleFee = kind === '基础标配' ? '方案内含' : '随服务包计费';
    if (id === 'film') return filmRows(kind,bundleFee,options.executive);
    if (id === 'digital') return digitalRows(spec,kind,bundleFee);
    if (id === 'coin') return [row('贝壳币激励',spec,[
      '激励对象、发放条件及执行方案在合作时确认'
    ],kind,fee)];
    const service = services[id];
    if (!service) return [];
    const details = kind === '基础标配'
      ? [service.lead]
      : (service.output || [service.lead]);
    const rows = [row(service.name,spec || '规格及执行安排待确认',details,kind,fee)];
    if (id === 'talent' && options.adTier) {
      rows.push(row('探盘活动物料','全套物料',[
        '主画面 1 套、6–8 个打卡 KT 牌、按人数配置臂贴',
        '至少提前 3 天提供素材，项目方提供桁架'
      ],kind,fee));
      if (['mid','full'].includes(options.adTier)) rows.push(row('摄影宣传','1 项',[
        '结合探盘活动安排摄影宣传，拍摄需求与档期在合作时确认'
      ],kind,fee));
    }
    return rows;
  }

  function isUpgrade(id,entry) {
    return /升级|扩量|增配/.test(entry.label || '') || /升级|扩量|增配/.test(entry.quote || '');
  }

  function addOnRows(entry,planId,tier) {
    const upgrade = isUpgrade(entry.id,entry);
    const spec = entry.label || (entry.spec === 'full' ? '满配版' : '规格待确认');
    if (upgrade && entry.id === 'digital' && /基础版升级/.test(spec)) return [row(
      services.digital.name,spec,[
        '新增景观漫游、区位交通、户型动态落位与品牌展示',
        '在现有基础版上升级，具体场景和新增制作范围需确认'
      ],'加配需求',feeText(entry.quote) || '商务核价')];
    if (upgrade) return [row(services[entry.id]?.name || entry.name,spec,[
      '在当前标配基础上增加数量、制作范围或升级版本',
      '具体新增交付范围在商务沟通后确认'
    ],'加配需求',feeText(entry.quote) || '商务核价')];
    return serviceRows(entry.id,spec,'加选服务',feeText(entry.quote) || '商务核价',{
      adTier:entry.id === 'talent' && planId === 'matrix' ? tier : null
    });
  }

  function planSection(item) {
    const product = products[item.id];
    const selected = product.packages.find(option => option.id === item.package);
    if (!selected) return {
      title:product.name, category:'基础方案意向', configuration:'档位待确认', fee:'费用待确认',
      rows:product.deliverables.map(([name,description]) => row(name,'具体档位待确认',[description],'方案需求','商务核价')),
      notes:['选择具体档位后确认达人数量、资源位置和各项交付规格']
    };
    const configuration = window.createConfigurator({
      services,groups:window.CATALOG.groups,products,manual,stored:() => item
    }).snapshot(item.id);
    // Keep the service specifications saved with the selection. Legacy records are reconstructed.
    const noDigital = configuration.variant === 'no-digital';
    const included = Array.isArray(item.included) && item.included.length ? item.included : configuration.included;
    const rows = [];
    for (const entry of included) {
      const id = entry.name === '贝壳币激励' ? 'coin' : serviceId(entry.name);
      if (noDigital && id === 'digital') continue;
      if (!id) {
        rows.push(row(entry.name,entry.spec || '待确认',[],'基础标配','方案内含'));
        continue;
      }
      rows.push(...serviceRows(id,entry.spec,'基础标配','方案内含',{
        adTier:item.id === 'matrix' ? selected.id : null
      }));
    }
    for (const entry of configuration.addOns) rows.push(...addOnRows(entry,item.id,selected.id));
    const notes = item.id === 'matrix'
      ? [item.channel === 'pure' ? '纯广告未开渠，基础方案不含经纪人私域霸屏海报及 B 端首页展位' :
         item.channel === 'open' ? '当前按开渠方案配置，渠道资格与资源档期在合作时确认' :
         '渠道合作状态待确认，涉及开渠条件的权益需核实']
      : ['成交范围、佣金额度、计费基数和结算条件在合作时确认'];
    return {
      title:product.name,category:'基础方案',configuration:selected.name + (noDigital ? ' · 不含数字移动案场' : ''),
      fee:feeText(item.basePrice) || configuration.basePrice,rows,notes,
      additions:configuration.addOns.map(entry => ({
        name:services[entry.id]?.name || entry.name,
        fee:feeText(entry.quote), mode:entry.mode
      }))
    };
  }

  function standaloneSection(item) {
    const service = services[item.id];
    const product = products[service.product];
    const option = product?.packages.find(entry => entry.id === item.package);
    const spec = option ? option.name : '规格待确认';
    const rows = serviceRows(item.id,spec,'单项意向','费用待确认',{
      executive:item.id === 'film' && item.package === 'executive'
    });
    return {
      title:service.name,category:'单项服务',configuration:spec,
      fee:option ? option.price + ' · 参考' : '费用待确认',rows,
      notes:service.note ? [service.note] : []
    };
  }

  function create({items,project,notes,date = new Date()}) {
    const sections = [];
    for (const item of items) {
      if (['matrix','focus'].includes(item.id)) sections.push(planSection(item));
      else if (Object.hasOwn(services,item.id)) sections.push(standaloneSection(item));
    }
    const requirements = text(notes);
    const dateLabel = new Intl.DateTimeFormat('zh-CN',{
      timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'
    }).format(date);
    const serviceNames = sections.flatMap(section => section.rows.map(entry => entry.name));
    return {
      project:text(project) || '项目名称待填写',notes:requirements,date:dateLabel,sections,
      hasOverlappingServices:new Set(serviceNames).size < serviceNames.length,
      serviceCount:sections.reduce((total,section) => total + section.rows.length,0),
      feeRows:sections.flatMap(section => [
        {name:section.title + (section.configuration !== '规格待确认' ? ' · ' + section.configuration : ''),fee:section.fee},
        ...(section.additions || []).map(item => ({name:section.title + ' / ' + item.name,fee:item.fee}))
      ])
    };
  }

  function rowsHtml(rows) {
    return rows.map(entry => '<tr><th scope="row"><span class="pdf-service-name">' + escape(entry.name) +
      '</span><span class="pdf-service-kind">' + escape(entry.kind) + '</span></th>' +
      '<td><strong class="pdf-spec">' + escape(entry.spec) + '</strong>' +
      (entry.details.length ? '<ul>' + entry.details.map(detail => '<li>' + escape(detail) + '</li>').join('') + '</ul>' : '') +
      '</td><td class="pdf-row-fee">' + escape(entry.fee) + '</td></tr>').join('');
  }

  function toHtml(model,{logoUrl}) {
    return '<article class="selection-document">' +
      '<header class="pdf-header"><img src="' + escape(logoUrl) + '" alt="贝壳 × 妙窝生活" class="pdf-logo">' +
      '<span class="pdf-brand-name">广州站 · 新房营销</span><span class="pdf-date">' + escape(model.date) + '</span></header>' +
      '<div class="pdf-title"><p>项目合作意向</p><h1>服务配置清单</h1><div class="pdf-project">' +
      escape(model.project) + '</div><p class="pdf-document-info">' + model.sections.length + ' 项意向 · ' +
      model.serviceCount + ' 项服务与交付明细</p></div>' +
      '<section class="pdf-fees"><h2>合作费用摘要</h2><table><colgroup><col style="width:65%"><col style="width:35%"></colgroup><tbody>' +
      model.feeRows.map(item => '<tr><th scope="row">' + escape(item.name) + '</th><td>' +
      escape(item.fee) + '</td></tr>').join('') + '</tbody></table>' +
      '<p class="pdf-fee-note">不同计费方式分别列示，待核价服务由商务确认后补充</p></section>' +
      model.sections.map(section => '<section class="pdf-section"><div class="pdf-section-head"><div><p>' +
        escape(section.category) + '</p><h2>' + escape(section.title) + '</h2></div><div class="pdf-section-meta"><b>' +
        escape(section.configuration) + '</b><span>' + escape(section.fee) + '</span></div></div>' +
        '<table class="pdf-service-table"><colgroup><col style="width:24%"><col style="width:56%"><col style="width:20%"></colgroup>' +
        '<thead><tr><th scope="col">具体服务项</th><th scope="col">规格与交付内容</th><th scope="col">费用口径</th></tr></thead><tbody>' +
        rowsHtml(section.rows) + '</tbody></table>' +
        (section.notes.length ? '<div class="pdf-section-notes">' + section.notes.map(note => '<p>' + escape(note) + '</p>').join('') + '</div>' : '') +
        '</section>').join('') +
      (model.notes ? '<section class="pdf-requirements"><h2>项目需求</h2><p>' + escape(model.notes) + '</p></section>' : '') +
      '<footer class="pdf-final-note"><p>参考费用、服务数量、资源档期和具体交付以双方确认的合作约定为准</p>' +
      (model.hasOverlappingServices ? '<p>同类服务同时出现在基础方案和单项意向中时，交付次数与增配范围需确认</p>' : '') + '</footer></article>';
  }

  function toText(model) {
    const lines = ['贝壳 × 妙窝生活 · 广州新房营销服务配置清单','项目：' + model.project,'整理日期：' + model.date,''];
    lines.push('合作费用摘要');
    model.feeRows.forEach(item => lines.push(item.name + ' · ' + item.fee));
    model.sections.forEach(section => {
      lines.push('',section.title + ' / ' + section.configuration);
      section.rows.forEach((entry,index) => {
        lines.push((index + 1) + '. ' + entry.name + ' · ' + entry.spec + ' · ' + entry.fee);
        entry.details.forEach(detail => lines.push('   ' + detail));
      });
      section.notes.forEach(note => lines.push('说明：' + note));
    });
    if (model.notes) lines.push('','项目需求',model.notes);
    lines.push('','参考费用与资源配置以确认的合作约定为准');
    return lines.join('\n');
  }

  return {create,toHtml,toText};
})();
