'use strict';

window.createConfigurator = ({services, groups, products, manual, stored}) => {
  const configurations = new Map();

  function settings(id) {
    if (!configurations.has(id)) {
      const previous = stored(id);
      const product = products[id];
      const tier = product.packages.some(option => option.id === previous?.package) ? previous.package : product.packages[0].id;
      const addOns = Object.create(null);
      for (const entry of Array.isArray(previous?.addOns) ? previous.addOns : []) {
        if (!entry || !Object.hasOwn(services,entry.id) || !['fee','commission'].includes(entry.mode)) continue;
        addOns[entry.id] = {mode:entry.mode, spec:entry.spec === 'full' ? 'full' : 'basic'};
      }
      configurations.set(id,{tier,channel:previous?.channel === 'pure' ? 'pure' : 'open',addOns});
    }
    return configurations.get(id);
  }

  function standard(id) {
    const setting = settings(id);
    return Object.entries(manual.base[setting.tier]).filter(([serviceId]) =>
      id !== 'matrix' || setting.channel !== 'pure' || !['agent-home','poster'].includes(serviceId));
  }

  function serviceName(id) { return id === 'coin' ? '贝壳币激励' : services[id].name; }

  function available(id, serviceId) {
    return id !== 'matrix' || settings(id).channel !== 'pure' || !['agent-home','poster'].includes(serviceId);
  }

  function included(id, serviceId) {
    return standard(id).find(([key]) => key === serviceId)?.[1];
  }

  function describeAddon(id, serviceId, option) {
    const existing = included(id, serviceId);
    const upgrade = Boolean(existing);
    const label = serviceId === 'digital' && upgrade
      ? (existing === '基础版' ? '基础版升级满配版' : '增配制作范围')
      : (upgrade ? '扩量或升级' : '加选');
    if (option.mode === 'commission') {
      const spec = serviceId === 'digital' && !upgrade ? ' · ' + (option.spec === 'full' ? '满配版' : '基础版') : '';
      return {quote:'加佣金点位 · 商务核价', amount:null, label:label + spec};
    }
    if (serviceId === 'digital' && !existing) {
      const bundled = id === 'matrix';
      const full = option.spec === 'full';
      const amount = full ? (bundled ? 4 : 10) : (bundled ? 2 : 5);
      return {
        quote:(bundled ? '广告套餐加购参考价' : '独立采购参考价') + ' +' + amount + ' 万元',
        amount,
        label:full ? '满配版' : '基础版'
      };
    }
    if (serviceId === 'film') return {quote:'推广参考价 +3 万元', amount:3,label:'标准服务'};
    return {quote:'追加广告费 · 商务核价', amount:null,label};
  }

  function snapshot(id) {
    const {tier,channel,addOns} = settings(id);
    const base = products[id].packages.find(option => option.id === tier);
    return {
      id, package:tier, channel,
      basePrice:base.price,
      included:standard(id).map(([key,spec]) => ({name:serviceName(key),spec})),
      addOns:Object.entries(addOns).filter(([key]) => available(id,key)).map(([key,option]) => ({
        id:key, ...option, ...describeAddon(id,key,option), name:serviceName(key)
      }))
    };
  }

  function renderPlan(id, preserve = {}) {
    const setting = settings(id);
    const product = products[id];
    const details = snapshot(id);
    const includedIds = new Set(standard(id).map(([key]) => key));
    const idPrefix = id === 'matrix' ? '广告付费' : '效果付费';
    const explanations = id === 'matrix'
      ? '按推广规模选择基础套餐，双档价格的适用条件由商务确认'
      : '按资源配置选择基础档位，佣金额度、成交范围和计费基数以合作约定为准';
    const tiers = product.packages.map(option =>
      '<button class="tier-option" type="button" data-config="tier" data-id="' + option.id +
      '" aria-pressed="' + (option.id === setting.tier) + '"><span>' + option.name + '</span><strong>' +
      option.price + '</strong><small>' + option.meta + '</small></button>').join('');
    const channel = id === 'matrix' ? '<label class="channel-choice">渠道合作<select data-config="channel" aria-label="渠道合作">' +
      '<option value="open"' + (setting.channel === 'open' ? ' selected' : '') + '>按开渠方案预览</option><option value="pure"' +
      (setting.channel === 'pure' ? ' selected' : '') + '>纯广告 · 未开渠</option></select></label>' : '';
    const rows = standard(id).map(([serviceId,spec]) => {
      const name = serviceName(serviceId);
      return '<li>' + (serviceId === 'coin' ? '<span>' + name + '</span>' : '<a href="#service/' + serviceId + '">' + name + '</a>') +
        '<span>' + spec + '</span></li>';
    }).join('');
    const groupOptions = groups.map(group => {
      const choices = group.services.filter(serviceId => available(id,serviceId));
      if (!choices.length) return '';
      const open = preserve[group.id] ?? choices.some(key => setting.addOns[key]);
      return '<details class="add-group" data-group="' + group.id + '"' + (open ? ' open' : '') + '><summary>' +
        group.name + '<span>' + choices.length + ' 项</span></summary><div>' + choices.map(key => {
          const service = services[key];
          const selected = setting.addOns[key];
          const isIncluded = includedIds.has(key);
          const specSelect = key === 'digital' && !isIncluded
            ? '<label>产品版本<select data-config="spec" data-id="' + key + '"><option value="basic"' +
              (selected?.spec === 'basic' ? ' selected' : '') + '>基础版</option><option value="full"' +
              (selected?.spec === 'full' ? ' selected' : '') + '>满配版</option></select></label>'
            : '';
          const modes = selected ? '<div class="add-options">' + specSelect +
            (isIncluded && key === 'digital' ? '<span>' + describeAddon(id,key,selected).label + '</span>' : '') +
            '<label>计费方式<select data-config="mode" data-id="' + key + '">' +
            '<option value="fee"' + (selected.mode === 'fee' ? ' selected' : '') + '>追加广告费</option><option value="commission"' +
            (selected.mode === 'commission' ? ' selected' : '') + '>加佣金点位</option></select></label><span>' +
            describeAddon(id,key,selected).quote + '</span></div>' : '';
          return '<div class="add-item"><label class="add-toggle"><input type="checkbox" data-config="addon" data-id="' + key + '"' +
            (selected ? ' checked' : '') + '><span>' + service.name + '<small>' +
            (isIncluded ? '已含基础规格，可提扩量或升级需求' : '可提出单项选配需求') +
            '</small></span></label><a href="#service/' + key + '">介绍</a>' + modes + '</div>';
        }).join('') + '</div></details>';
    }).join('');

    const addOns = details.addOns.map(item => '<li><div><b>' + item.name + '</b><small>' +
      item.label + '</small></div><span>' + item.quote + '</span></li>').join('');
    const known = details.addOns.filter(item => item.amount !== null);
    const knownAmount = known.reduce((total,item) => total + item.amount,0);
    const pendingFee = details.addOns.filter(item => item.mode === 'fee' && item.amount === null).length;
    const pendingCommission = details.addOns.filter(item => item.mode === 'commission').length;

    return '<div class="config-layout"><div class="config-main"><section class="config-section"><h2>选择基础档位</h2><p>' +
      explanations + '</p><div class="tier-options">' + tiers + '</div>' + channel + '</section>' +
      '<section class="config-section"><h2>基础档位包含 <span>' + details.included.length +
      ' 项</span></h2><p>选定档位后，自动列出标准服务；点击服务名查看呈现方式与交付内容</p><ul class="standard-list">' +
      rows + '</ul></section><section class="config-section"><h2>按需加选服务</h2><p>可加选其他服务，也可对已含服务提出扩量或升级需求，合作条件与计费方式由商务确认</p>' +
      groupOptions + '</section></div><aside class="config-summary" aria-labelledby="quote-title"><h2 id="quote-title" tabindex="-1">方案费用明细</h2><p>' +
      idPrefix + '基础档位</p><strong>' + details.basePrice + '</strong><div class="quote-extras"><h3>加选服务 <span>' +
      details.addOns.length + '</span></h3>' +
      (addOns ? '<ul>' + addOns + '</ul>' : '<p>展开服务分类，勾选需要的加配项</p>') + '</div>' +
      (known.length ? '<div class="quote-line"><span>已列价的广告加配</span><b>+' + knownAmount + ' 万元</b></div>' : '') +
      (pendingFee ? '<div class="quote-line"><span>广告费待核价</span><b>' + pendingFee + ' 项</b></div>' : '') +
      (pendingCommission ? '<div class="quote-line"><span>佣金点位待核价</span><b>' + pendingCommission + ' 项</b></div>' : '') +
      '<p class="quote-note">参考价和待核价项分别列示，最终费用和适用条件以双方确认结果为准</p>' +
      '<button class="primary" type="button" data-config="save">保存到意向清单</button></aside></div>' +
      '<div class="mobile-config-bar" aria-label="方案快捷操作"><button type="button" class="mobile-quote" data-config="quote"><small>基础方案 · 加选 ' +
      details.addOns.length + ' 项</small><strong>' + details.basePrice + '</strong><span>查看费用明细</span></button>' +
      '<button class="primary" type="button" data-config="save">保存方案</button></div>';
  }

  function change(id, action, key, value) {
    const setting = settings(id);
    if (action === 'tier' && products[id].packages.some(item => item.id === key)) setting.tier = key;
    if (action === 'channel') setting.channel = value === 'pure' ? 'pure' : 'open';
    if (action === 'addon' && Object.hasOwn(services,key) && available(id,key)) {
      if (!value) delete setting.addOns[key];
      else setting.addOns[key] = {mode:id === 'focus' && !['film','digital'].includes(key) ? 'commission' : 'fee', spec:'basic'};
    }
    if (action === 'mode' && setting.addOns[key]) setting.addOns[key].mode = value === 'commission' ? 'commission' : 'fee';
    if (action === 'spec' && setting.addOns[key]) setting.addOns[key].spec = value === 'full' ? 'full' : 'basic';
  }

  return {renderPlan, change, snapshot};
};
