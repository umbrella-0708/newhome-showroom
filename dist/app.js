'use strict';

(() => {
  const {groups, services, cases: previousCases} = window.CATALOG;
  const manual = window.MANUAL;
  const filmCases = previousCases.filter(item => item.service === 'film');
  const cases = [...manual.campaigns, ...filmCases];
  const {products, scenes} = window.SHOWROOM;
  const productsById = Object.fromEntries(products.map(product => [product.id, product]));
  const get = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[character]));
  const asset = name => window.INLINE_ASSETS?.[name] || 'assets/' + name + (name === 'brand' ? '.svg' : name === 'brand-print' ? '.png' : '.webp');
  const serviceHref = id => '#service/' + id;
  const planHref = id => '#plan/' + id;
  const caseHref = id => '#case/' + id;
  const dialog = get('selection');
  const storage = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch {}
    }
  };
  const stored = storage.get('showroom-plan', []);
  let saved = Array.isArray(stored) ? stored.filter(Boolean)
    .map(item => item.id === 'event' ? {id:'talent'} : item)
    .filter((item,index,items) => (Object.hasOwn(services,item.id) || Object.hasOwn(productsById,item.id))
      && items.findIndex(candidate => candidate.id === item.id) === index) : [];
  const configurator = window.createConfigurator({services,groups,products:productsById,manual,stored:id => saved.find(item => item.id === id)});
  let project = String(storage.get('showroom-project', '')).slice(0,70);
  let notes = String(storage.get('showroom-notes', '')).slice(0,500);
  let filter = '';
  let currentScene = 'area';
  let currentDistrict = '海珠区';
  let featuredId = 'wanbo-campaign';
  let activeRoute = 'catalog';
  let activeId = '';
  let activePackage = '';
  let catalogScroll = 0;
  let notifyTimer;
  const isWechat = typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent || '');
  document.body.dataset.browser = isWechat ? 'wechat' : 'browser';
  let pdfExport = null;
  let pdfGeneration = 0;

  function invalidatePDF() {
    pdfGeneration++;
    if (pdfExport) URL.revokeObjectURL(pdfExport.url);
    pdfExport = null;
    const panel = get('pdf-export');
    if (panel) { panel.innerHTML=''; panel.removeAttribute('aria-busy'); }
    dialog.querySelector('[data-action="export-pdf"]')?.removeAttribute('disabled');
  }

  function photo(name, alt, className = '', eager = false) {
    return '<img class="' + className + '" src="' + asset(name) + '" alt="' + escape(alt) + '" loading="' + (eager ? 'eager' : 'lazy') + '">';
  }

  function header() {
    get('header').innerHTML = '<div class="wrap header-inner"><a class="brand" href="#catalog">' +
      photo('brand', '贝壳 × 妙窝生活', 'brand-image', true) + '<span>广州站 · 新房营销</span></a>' +
      '<nav aria-label="主导航">' + [
        ['catalog','服务目录'], ['cases','项目案例'], ['plans','合作方案']
      ].map(([route,name]) => '<a href="#' + route + '"' +
        ((route === activeRoute || route === 'catalog' && activeRoute === 'service' || route === 'cases' && activeRoute === 'case' || route === 'plans' && activeRoute === 'plan') ? ' aria-current="page"' : '') +
        '>' + name + '</a>').join('') + '</nav>' +
      '<button type="button" class="saved-button" data-action="open-selection">意向清单 <span>' + saved.length + '</span></button></div>';
  }

  function route() {
    const [requested, id] = location.hash.slice(1).split('/');
    if (requested === 'service' && Object.hasOwn(services,id)) return ['service', id];
    if (requested === 'case' && cases.some(item => item.id === id)) return ['case', id];
    if (requested === 'plan' && ['matrix','focus'].includes(id)) return ['plan', id];
    if (['cases','plans'].includes(requested)) return [requested,''];
    return ['catalog',''];
  }

  function showStatus(message) {
    clearTimeout(notifyTimer);
    get('status').textContent = message;
    get('status').classList.add('visible');
    notifyTimer = setTimeout(() => get('status').classList.remove('visible'), 2200);
  }

  function catalogIntro() {
    return '<section class="catalog-intro"><div class="wrap intro-inner"><div><h1>新房营销服务目录</h1>' +
     '<p><span class="intro-desktop">查找具体服务，了解实际呈现、交付内容和合作方式</span><span class="intro-mobile">浏览服务与案例，按需配置合作方案</span></p></div>' +
     '<div class="search-box"><label for="service-search">搜索服务</label><div class="search-field">' +
     '<span class="search-icon" aria-hidden="true"></span><input type="search" id="service-search" placeholder="例如：达人探盘、直播、VR" value="' + escape(filter) + '" autocomplete="off"></div></div></div></section>';
  }

  function matchingGroups() {
    const terms = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return groups.map(group => ({
      ...group,
      services: group.services.filter(id => {
        const service = services[id];
        const search = [group.name, service.name, service.lead, id === 'digital' ? 'VR 沙盘' : '', (service.plans ?? []).map(plan => productsById[plan].name).join(' ')].join(' ').toLowerCase();
        return terms.every(term => search.includes(term));
      })
    })).filter(group => group.services.length);
  }

  function categoryNavigation(found) {
    return '<nav class="category-nav" aria-label="服务分类"><p>服务分类</p>' + found.map(group =>
      '<button type="button" data-action="jump" data-id="' + group.id + '"><span>' + group.name +
      '</span><small>' + group.services.length + '</small></button>').join('') + '</nav>';
  }

  function renderServiceList(found) {
    if (!found.length) return '<div class="empty"><h2>没有找到相关服务</h2><p>试试「直播」「探盘」或「置顶」</p><button class="outline" data-action="clear">清除搜索</button></div>';
    return found.map(group => '<section class="service-group" id="group-' + group.id + '" aria-labelledby="heading-' + group.id + '">' +
      '<div class="group-heading"><div><h2 id="heading-' + group.id + '">' + group.name + '</h2><p>' + group.description + '</p></div><small>' + group.services.length + ' 项服务</small></div>' +
      '<div class="service-rows">' + group.services.map(id => {
        const service = services[id];
        return '<a class="service-row" href="' + serviceHref(id) + '"><div><h3>' + service.name + '</h3><p>' + service.lead + '</p></div>' +
          entitlementTags(id) + '<span class="plus" aria-hidden="true"></span></a>';
      }).join('') + '</div></section>').join('');
  }

  function featuredContent() {
    const projects = ['wanbo-campaign','future','shanhai'].map(id => manual.campaigns.find(item => item.id === id));
    const selected = projects.find(item => item.id === featuredId);
    return '<div class="featured-top"><h2 id="feature-title">精选案例</h2><a href="#cases">全部案例</a></div>' +
      '<button class="featured-board" data-action="zoom-case" data-id="' + selected.id + '" aria-label="放大' + selected.name +
      '全案图">' + photo(selected.board,selected.name + '全案营销策略与结果','',true) +
      '<span class="board-expand">放大查看</span></button>' +
      '<div class="featured-project"><span class="featured-type">' + selected.type + '</span><h3>' + selected.name + '</h3><p>' + selected.title + '</p><a href="' + caseHref(selected.id) +
      '">查看营销策略与结果<span class="plus" aria-hidden="true"></span></a></div>' +
      '<div class="featured-switches" role="group" aria-label="切换精选案例">' +
      projects.map(item => '<button type="button" data-action="feature" data-id="' + item.id + '" aria-pressed="' +
      (item.id === featuredId) + '">' + item.name + '</button>').join('') + '</div>';
  }

  function featured() {
    return '<aside class="featured" aria-labelledby="feature-title">' + featuredContent() + '</aside>';
  }

  function entitlementTags(id) {
    const tiers = [['gold','金牌'],['platinum','铂金'],['diamond','钻石']];
    const included = tiers.filter(([tier]) => Object.hasOwn(manual.base[tier],id));
    const lines = [];
    if (services[id].product) lines.push('可单独合作');
    if (included.length) {
      const first = tiers.findIndex(([tier]) => tier === included[0][0]);
      const includesHigher = included.length === tiers.length - first;
      lines.push(included[0][1] + (includesHigher && included.length > 1 ? '及以上可享' : '可享'));
      if (!includesHigher) included.slice(1).forEach(([,label]) => lines.push(label + '可享'));
    }
    if (['light','mid','full'].some(tier => Object.hasOwn(manual.base[tier],id))) lines.push('广告套餐可享');
    if (id === 'voice') lines.push('首开可选');
    if (id === 'quality') lines.push('可单项加选');
    return '<div class="availability">' + lines.map(text => '<span>' + text + '</span>').join('') + '</div>';
  }

  function catalog() {
    const found = matchingGroups();
    return catalogIntro() + '<div class="wrap catalog-layout"><div id="category-index">' + categoryNavigation(found) +
      '</div><div class="service-index"><p id="results-count" role="status">' + countLabel(found) +
      '</p><div id="service-results">' + renderServiceList(found) + '</div></div>' + featured() + '</div>';
  }

  function countLabel(found) {
    const count = found.reduce((total, group) => total + group.services.length, 0);
    return filter.trim() ? '找到 ' + count + ' 项服务' : '全部服务 · ' + count + ' 项';
  }

  function updateResults() {
    const found = matchingGroups();
    get('category-index').innerHTML = categoryNavigation(found);
    get('service-results').innerHTML = renderServiceList(found);
    get('results-count').textContent = countLabel(found);
  }

  function breadcrumb(href,label,current) {
    return '<div class="breadcrumb"><a href="' + href + '">' + label + '</a><span aria-hidden="true">/</span><span aria-current="page">' + current + '</span></div>';
  }

  function saveButton(id) {
    return '<button type="button" class="primary" data-action="save" data-id="' + id + '">' +
      (saved.some(item => item.id === id) ? '更新意向清单' : '加入意向清单') + '</button>';
  }

  function packages(product) {
    if (!product) return '';
    return '<div class="packages" role="group" aria-label="' + product.packageLabel + '">' + product.packages.map(item =>
      '<button type="button" class="package" data-action="package" data-id="' + item.id + '" aria-pressed="' + (activePackage === item.id) +
      '"><span>' + item.name + '</span><strong>' + item.price + '</strong><small>' + item.meta + '</small><ul>' +
      item.items.map(text => '<li>' + text + '</li>').join('') + '</ul></button>'
    ).join('') + '</div><p class="source-note">' + product.priceNote + '</p>';
  }

  function relatedPlans(ids) {
    if (!ids?.length) return '';
    return '<div class="related-plans">' + ids.map(id => '<a href="' + planHref(id) + '">' + productsById[id].name +
      '<span class="plus" aria-hidden="true"></span></a>').join('') + '</div>';
  }

  function scenePanel() {
    const scene = scenes.find(item => item.id === currentScene);
    return '<div class="scene-panel" id="scene-panel"><div class="scene-buttons" role="group" aria-label="数字案场场景">' +
      scenes.map(item => '<button type="button" data-action="scene" data-id="' + item.id + '" aria-pressed="' +
        (scene.id === item.id) + '">' + item.name + '</button>').join('') + '</div>' +
      photo(scene.image,scene.name + '场景预览','scene-photo',true) +
      '<div class="scene-caption"><h3>' + scene.title + '</h3><p>' + scene.desc + '</p></div></div>';
  }

  function filmPreviews() {
    return '<div class="film-previews">' + cases.filter(item => item.service === 'film').map(item =>
      '<a href="' + caseHref(item.id) + '">' + photo(item.cover,item.alt) + '<div><b>' + item.name + '</b><span>' + item.type + '</span></div></a>'
    ).join('') + '</div>';
  }

  function rosterRows() {
    return '<table><thead><tr><th scope="col">达人账号</th><th scope="col">粉丝量</th><th scope="col">内容风格</th></tr></thead><tbody>' +
      manual.roster[currentDistrict].map(([name,followers,style]) => '<tr><th scope="row">@' + name + '</th><td>' + followers +
      '</td><td>' + style + '</td></tr>').join('') + '</tbody></table>';
  }

  function talentRoster() {
    const table = (rows,title,footnote) => '<div class="tier-reference"><h3>' + title + '</h3><ul>' +
      rows.map(([name,count,size]) => '<li><span>' + name + '</span><strong>' + count + '</strong>' +
        (size ? '<small>' + size + '</small>' : '') + '</li>').join('') + '</ul><p>' + footnote + '</p></div>';
    return '<section class="talent-roster"><div class="roster-head"><h2>广州签约房产达人</h2><div class="roster-metrics">' +
      '<div><b>3,000+</b><span>签约房产达人</span></div><div><b>2,000 万+</b><span>矩阵粉丝量</span></div></div></div>' +
      '<div class="roster-panel"><h3>按作业区域看代表达人</h3><div class="districts" role="group" aria-label="达人作业区域">' +
      Object.keys(manual.roster).map(name => '<button type="button" data-action="district" data-id="' + name +
      '" aria-pressed="' + (name === currentDistrict) + '">' + name + '</button>').join('') +
      '</div><div id="roster-rows">' + rosterRows() + '</div><p class="source-note">实际可约阵容、档期和粉丝量以项目确认时为准</p></div>' +
      '<div class="tier-references">' + table(manual.tiers.pool,'资源池分层','广州达人资源池分层') +
      table(manual.tiers.package,'报价表配额门槛','适用于 30／60／100 位广告套餐') + '</div></section>';
  }

  function serviceHighlights(id) {
    return '<section class="service-highlights"><h2>卖点与服务特色</h2><dl>' +
      manual.highlights[id].map(([title,copy]) => '<div><dt>' + title + '</dt><dd>' + copy + '</dd></div>').join('') +
      '</dl></section>';
  }

  function serviceVisual(id, service) {
    if (id === 'talent') return talentRoster();
    if (id === 'digital') return scenePanel();
    if (id === 'film' || id === 'official-video') return filmPreviews();
    if (!service.image) return '';
    return '<figure class="service-figure' + (service.portrait ? ' portrait' : '') + '">' +
      photo(service.image,service.alt,'',true) + '<figcaption>' + service.alt + '</figcaption></figure>';
  }

  function servicePage(id) {
    const service = services[id];
    const product = productsById[service.product];
    const group = groups.find(item => item.services.includes(id));
    const visual = serviceVisual(id, service);
    const relevantCase = cases.find(item => item.id === service.case);
    return '<article class="wrap detail">' + breadcrumb('#catalog','服务目录',group.name) +
      '<header class="detail-header"><div>' + entitlementTags(id) + '<h1>' + service.name +
      '</h1><p>' + service.lead + '</p></div>' + saveButton(id) + '</header>' +
      '<div class="detail-grid' + (!visual ? ' no-visual' : '') + '">' +
      (visual ? '<section class="detail-visual" aria-label="实际呈现">' + visual + (id === 'talent' ? '' : serviceHighlights(id)) + '</section>' : '') +
      '<div class="facts">' + (!visual || id === 'talent' ? serviceHighlights(id) : '') + '<section><h2>交付内容</h2>' + (product
        ? '<dl>' + product.deliverables.map(([title,description]) => '<div><dt>' + title + '</dt><dd>' + description + '</dd></div>').join('') + '</dl>'
        : '<ul>' + service.output.map(item => '<li>' + item + '</li>').join('') + '</ul>') + '</section>' +
      '<section><h2>合作方式</h2>' + (service.note ? '<p>' + service.note + '</p>' : '') +
      (product ? packages(product) : '') + relatedPlans(service.plans) + '</section>' +
      (product ? '<details class="plan-conditions"><summary>查看合作条件</summary><ul>' + product.conditions.map(item => '<li>' + item + '</li>').join('') + '</ul></details>' : '') +
      (relevantCase ? '<section><h2>相关案例</h2><div class="related-plans"><a href="' + caseHref(relevantCase.id) +
        '">' + relevantCase.name + '<span class="plus" aria-hidden="true"></span></a></div></section>' : '') +
      (id === 'aigc' ? '<section><h2>观看内容示例</h2><div class="related-plans"><a href="https://www.douyin.com/video/7593571254759583609" target="_blank" rel="noopener noreferrer">样板房实探</a><a href="https://www.douyin.com/video/7593556686414481137" target="_blank" rel="noopener noreferrer">全面价值解读</a><a href="https://www.douyin.com/video/7593612267427555322" target="_blank" rel="noopener noreferrer">楼盘品质讲解</a></div></section>' : '') +
      '</div></div></article>';
  }

  function caseCard(item, className = '') {
    const metric = item.results?.[0] || [item.metric,item.unit];
    return '<article class="project-card ' + className + (item.board ? ' board-card' : '') + '"><a href="' + caseHref(item.id) + '" class="project-link">' +
      '<div class="case-visual">' + photo(item.board || item.cover,item.board ? item.name + '全案营销策略与结果' : item.alt) +
      '<span class="case-hover-label">' + (item.url ? '查看作品' : '阅读全案') + '</span></div>' +
      '<div class="project-meta"><div><p class="project-type">' + item.type + '</p><h2>' + item.name + '</h2><p class="project-description">' +
      item.title + '</p></div><span class="project-open" aria-hidden="true">＋</span></div>' +
      '<div class="project-footnote"><span>' + metric[0] + ' <small>' + metric[1] + '</small></span><span>查看项目</span></div></a></article>';
  }

  function caseIndex(item) {
    const [value,label] = item.results[0];
    return '<a class="project-index-row" href="' + caseHref(item.id) + '"><div><span class="project-type">' + item.type +
      '</span><h3>' + item.name + '</h3></div><p>' + item.title + '</p><span class="index-result"><b>' +
      value + '</b><small>' + label + '</small></span><span class="project-open" aria-hidden="true">＋</span></a>';
  }

  function casesPage() {
    const lead = manual.campaigns.find(item => item.id === 'wanbo-campaign');
    const secondary = ['future','shanhai'].map(id => manual.campaigns.find(item => item.id === id));
    const more = manual.campaigns.filter(item => item.plan === 'focus' && ![lead.id,...secondary.map(item => item.id)].includes(item.id));
    return '<article class="wrap cases-editorial">' +
      '<header class="work-heading"><div><p class="editorial-kicker">贝壳广州 / 项目实践</p><h1>每个项目，<br><span>都有自己的打法</span></h1></div>' +
      '<div class="work-intro"><p>从首开、加推到持续销售，<br>看一次推广怎样被策划、执行和呈现</p><nav aria-label="案例类型"><a href="#campaigns" data-case-jump="campaigns">整合营销</a><a href="#matrix-projects" data-case-jump="matrix-projects">矩阵推广</a><a href="#films" data-case-jump="films">影像作品</a></nav></div></header>' +
      '<section id="campaigns" class="work-section"><div class="work-section-title"><h2>整合营销</h2><p>从项目目标到实际执行</p></div>' +
      '<div class="campaign-composition">' + caseCard(lead,'project-lead') + '<div class="project-secondary">' +
      secondary.map(item => caseCard(item,'project-compact')).join('') + '</div></div>' +
      '<div class="project-index">' + more.map(caseIndex).join('') + '</div></section>' +
      '<section id="matrix-projects" class="work-section"><div class="work-section-title"><h2>矩阵推广</h2><p>让区域达人和渠道，在同一节点发声</p></div><div class="matrix-projects">' +
      manual.campaigns.filter(item => item.plan === 'matrix').map(item => caseCard(item)).join('') + '</div></section>' +
      '<section id="films" class="work-section"><div class="work-section-title"><h2>影像作品</h2><p>按项目气质，找到内容的表达方式</p></div><div class="film-projects">' +
      filmCases.map(item => caseCard(item,'film-project')).join('') + '</div></section></article>';
  }

  function casePage(id) {
    const item = cases.find(entry => entry.id === id);
    const fullCampaign = Boolean(item.strategy);
    const results = item.results || [[item.metric,item.unit]];
    return '<article class="wrap detail case-detail">' + breadcrumb('#cases','项目案例',item.name) +
      '<header class="detail-header"><div><p class="eyeline">' + item.type + '</p><h1>' + item.name +
      '</h1><p>' + item.title + '</p></div>' +
      (item.url ? '<a class="primary" href="' + item.url + '" target="_blank" rel="noopener noreferrer">在视频号观看</a>' : '') +
      '</header>' + (item.board ? '<button class="case-overview" data-action="zoom-case" data-id="' + item.id + '">' +
      photo(item.board,item.name + '全案概览','',true) + '<span>放大查看全案</span></button>' : '') + '<div class="case-story' + (!item.cover ? ' text-only' : '') + '">' +
      (item.cover ? '<figure>' + photo(item.cover,item.alt,'',true) + '<figcaption>' + item.alt + '</figcaption></figure>' : '') +
      '<div class="story-body"><h2>' + (fullCampaign ? '项目目标' : '作品表达') + '</h2><p>' + (item.objective || item.lead) +
      '</p>' + (fullCampaign ? '<h2 class="strategy-heading">营销策略</h2><dl class="strategy-list">' +
      item.strategy.map(([title,copy]) => '<div><dt>' + title + '</dt><dd>' + copy + '</dd></div>').join('') + '</dl>' : '') +
      '<h2 class="strategy-heading">' + (fullCampaign ? '项目结果' : '作品数据') + '</h2><div class="case-results">' +
      results.map(([value,label]) => '<div class="story-stat"><strong>' + value + '</strong><span>' + label + '</span></div>').join('') +
      '</div><p class="case-period">' + item.note + '</p><div class="related-plans"><a href="' + serviceHref(item.service) + '">了解' + services[item.service].name +
      '<span class="plus" aria-hidden="true"></span></a></div>' + relatedPlans(item.plan ? [item.plan] : []) + '</div></div></article>';
  }

  function plansPage() {
    return '<article class="wrap detail">' + breadcrumb('#catalog','服务目录','合作方案') +
      '<header class="detail-header"><div><h1>合作方案</h1><p>先选基础配置，再按项目需要增加服务</p></div></header>' +
      '<div class="plan-entries">' + ['matrix','focus'].map(id => {
        const product = productsById[id];
        const details = id === 'matrix'
          ? '按达人规模选择推广力度，组合短视频、直播与私域传播'
          : '按资源配置联动平台曝光、达人内容与经纪人服务';
        return '<a class="plan-entry" href="' + planHref(id) + '"><div class="plan-entry-head"><span class="plan-type">' +
          (id === 'matrix' ? '广告付费' : '效果付费') + '</span><h2>' + product.name + '</h2><p>' + details + '</p></div>' +
          '<div class="plan-tier-list">' + product.packages.map(option => '<div><span class="plan-tier-name">' +
          option.name + '</span><span class="plan-tier-meta">' +
          (id === 'matrix' ? option.meta : '达人 ' + manual.base[option.id].talent) +
          '</span><span class="plan-tier-rate">' + option.price + '</span></div>').join('') + '</div>' +
          '<div class="plan-entry-action"><span>选择档位与加配服务</span><span class="plus" aria-hidden="true"></span></div></a>';
      }).join('') + '</div></article>';
  }

  function planPage(id) {
    const product = productsById[id];
    return '<article class="wrap detail">' + breadcrumb('#plans','合作方案',product.name) +
      '<header class="detail-header"><div><p class="eyeline">' + (id === 'matrix' ? '广告付费' : '效果付费') +
      '</p><h1>' + product.name + '</h1><p>选择基础档位，查看标准服务，再按项目需要添加单项服务并核对计费方式</p></div></header>' +
      '<div id="configurator">' + configurator.renderPlan(id) + '</div>' +
      '<details class="plan-conditions"><summary>合作条件</summary><ul>' +
      product.conditions.map(item => '<li>' + item + '</li>').join('') + '</ul></details></article>';
  }

  function updateConfiguration(element) {
    const {config,id} = element.dataset;
    if (activeRoute !== 'plan') return;
    if (config === 'quote') {
      get('quote-title')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
      get('quote-title')?.focus({preventScroll:true});
      return;
    }
    if (config === 'save') {
      const item = configurator.snapshot(activeId);
      setSaved([...saved.filter(entry => entry.id !== activeId), item]);
      showStatus('已保存基础档位与加选服务');
      return;
    }
    const panel = get('configurator');
    const open = Object.fromEntries(Array.from(panel.querySelectorAll('.add-group'), group => [group.dataset.group,group.open]));
    const value = element.type === 'checkbox' ? element.checked : element.value;
    configurator.change(activeId,config,id,value);
    panel.innerHTML = configurator.renderPlan(activeId,open);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) panel.querySelector('.config-summary')?.animate?.([{opacity:.65,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
    Array.from(panel.querySelectorAll('[data-config]')).find(candidate =>
      candidate.dataset.config === config && candidate.dataset.id === id)?.focus({preventScroll:true});
  }

  function render() {
    const [page,id] = route();
    if (activeRoute === 'catalog' && page !== 'catalog') catalogScroll = window.scrollY;
    activeRoute = page;
    activeId = id;
    document.body.dataset.page = page;
    const previous = saved.find(item => item.id === id);
    activePackage = previous?.package || '';
    header();
    get('main').innerHTML = ({catalog, service:servicePage, cases:casesPage, case:casePage, plans:plansPage, plan:planPage}[page])(id);
    document.title = get('main').querySelector('h1').textContent + ' · 贝壳 × 妙窝生活';
    window.scrollTo({top:page === 'catalog' ? catalogScroll : 0, behavior:'instant'});
    window.mountMotion?.();
  }

  function itemData(item) {
    const title = services[item.id]?.name || productsById[item.id]?.name || item.id;
    const option = productsById[item.id]?.packages.find(entry => entry.id === item.package);
    return {title,config:option ? option.name + ' · ' + option.price : '合作配置待沟通',
      addOns:Array.isArray(item.addOns) ? item.addOns.filter(entry => entry && entry.name && entry.quote) : []};
  }

  function renderSelection() {
    dialog.innerHTML = '<div class="selection-head"><h2 id="selection-title">意向清单</h2><button type="button" class="close" data-action="close-selection" aria-label="关闭意向清单">×</button></div>' +
      (saved.length ? '<p>已选 ' + saved.length + ' 项 · 核对服务配置，生成合作清单</p>' +
      '<ul class="saved-list">' + saved.map(item => {
        const {title,config,addOns} = itemData(item);
        return '<li><div><a data-action="close-selection" href="' + (services[item.id] ? serviceHref(item.id) : planHref(item.id)) +
          '"><b>' + title + '</b><small>' + config + '</small></a>' +
          addOns.map(extra => '<small>' + escape(extra.name) + ' · ' + escape(extra.quote) + '</small>').join('') +
          '</div><button data-action="remove" data-id="' + item.id +
      '" aria-label="移除' + title + '">移除</button></li>';
      }).join('') + '</ul><label>项目名称<input id="project" maxlength="70" value="' + escape(project) +
      '"></label><label>项目需求<textarea id="notes" rows="4" maxlength="500">' + escape(notes) +
      '</textarea></label><div id="pdf-export" class="pdf-export" aria-live="polite"></div>' +
      '<div class="selection-actions"><button class="primary" type="button" data-action="export-pdf">生成 PDF 清单</button>' +
      '<button class="outline print-option" type="button" data-action="print">打印清单</button><button class="text-download" type="button" data-action="download">导出文字版</button></div>'
      : '<div class="empty"><h3>还没有加入服务</h3><p>在服务详情或合作方案页选择「加入意向清单」</p></div>');
  }

  function setSaved(items) {
    invalidatePDF();
    saved = items;
    storage.set('showroom-plan', saved);
    const count = get('header').querySelector('.saved-button span');
    count.textContent = saved.length;
  }

  function selectionDocument() {
    return window.SelectionDocument.create({items:saved,project,notes});
  }

  function selectionText() {
    return window.SelectionDocument.toText(selectionDocument());
  }

  async function exportPDF() {
    if (!saved.length) return;
    invalidatePDF();
    const ticket=pdfGeneration;
    const panel=get('pdf-export');
    const button=dialog.querySelector('[data-action="export-pdf"]');
    if (!panel) return;
    panel.setAttribute('aria-busy','true');
    if (button) button.disabled=true;
    const progress=message=>{
      if (ticket===pdfGeneration && panel.isConnected) panel.innerHTML='<p class="pdf-progress"><span class="pdf-spinner" aria-hidden="true"></span>'+escape(message)+'</p>';
    };
    progress('正在整理清单');
    try {
      const result=await window.SelectionPDF.create(selectionDocument(),{logoUrl:asset('brand-print'),onProgress:progress});
      if (ticket!==pdfGeneration || !panel.isConnected) return;
      const blob=new Blob([result.bytes],{type:'application/pdf'});
      const file=typeof File==='function' ? new File([blob],result.filename,{type:'application/pdf'}) : null;
      const url=URL.createObjectURL(blob);
      pdfExport={url,blob,file,filename:result.filename};
      let canShare=false;
      try { canShare=!!(file && navigator.share && navigator.canShare?.({files:[file]})); } catch {}
      panel.innerHTML='<div class="pdf-ready"><b>PDF 已生成</b><span>'+result.pageCount+' 页 · '+Math.max(1,Math.round(blob.size/1024))+' KB</span></div>' +
        '<div class="pdf-file-actions"><a class="primary" href="'+url+'" target="_blank" rel="noopener" type="application/pdf">打开 PDF</a>'+
        (canShare ? '<button class="outline" type="button" data-action="share-pdf">保存／分享 PDF</button>' : '<a class="outline" href="'+url+'" download="'+escape(result.filename)+'">下载 PDF</a>')+'</div>' +
        (isWechat ? '<p class="pdf-help">如微信未打开文件，点右上角「…」在 Safari 中打开，再生成并保存 PDF<br>下方清单图片可长按保存</p>' : '<p class="pdf-help">打开 PDF 后可预览和保存，也可直接下载文件</p>') +
        '<details class="pdf-preview" open><summary>清单预览 · '+result.pageCount+' 页</summary><div>'+result.previews.map((src,index)=>'<img src="'+src+'" alt="服务清单第 '+(index+1)+' 页" loading="lazy">').join('')+'</div></details>';
      panel.scrollIntoView({behavior:'smooth',block:'start'});
    } catch (error) {
      if (ticket!==pdfGeneration || !panel.isConnected) return;
      panel.innerHTML='<div class="pdf-error" role="alert"><b>PDF 未能生成</b><p>'+escape(error.message || '请刷新页面后重试')+'</p><button class="outline" type="button" data-action="export-pdf">重新生成</button></div>';
    } finally {
      if (ticket===pdfGeneration) {panel.removeAttribute('aria-busy');if(button)button.disabled=false;}
    }
  }

  function sharePDF() {
    if (!pdfExport?.file || !navigator.share) return;
    try {
      navigator.share({files:[pdfExport.file]}).catch(error=>{
        if(error.name!=='AbortError') showStatus('分享暂不可用，请点击「打开 PDF」保存');
      });
    } catch { showStatus('分享暂不可用，请点击「打开 PDF」保存'); }
  }

  let printInProgress = false;
  async function printSelection() {
    if (isWechat) { showStatus('请使用「生成 PDF 清单」打开和保存文件'); return; }
    if (printInProgress || !saved.length) return;
    printInProgress = true;
    const sheet = document.createElement('section');
    sheet.id = 'print-sheet';
    sheet.innerHTML = window.SelectionDocument.toHtml(selectionDocument(),{logoUrl:asset('brand')});
    get('print-sheet')?.remove();
    document.body.append(sheet);
    const selectionWasOpen = dialog.open;
    const originalTitle = document.title;
    const restore = () => {
      sheet.remove();
      document.body.classList.remove('printing-selection');
      document.title = originalTitle;
      printInProgress = false;
      window.removeEventListener('afterprint',restore);
      if (selectionWasOpen && !dialog.open) {
        dialog.showModal();
        document.body.classList.add('dialog-open');
      }
    };
    try {
      const imagesReady = Promise.all(Array.from(sheet.querySelectorAll('img'), image =>
        image.decode ? image.decode().catch(() => {}) : Promise.resolve()));
      await Promise.race([
        Promise.all([imagesReady,document.fonts?.ready]),
        new Promise(resolve => setTimeout(resolve,3500))
      ]);
      if (selectionWasOpen) dialog.close();
      document.body.classList.add('printing-selection');
      document.title = (project.trim() || '项目') + ' · 新房营销服务配置清单';
      window.addEventListener('afterprint',restore,{once:true});
      window.print();
    } catch {
      restore();
      showStatus('打印未能打开，请重试');
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob(['\ufeff' + selectionText()],{type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = '新房营销意向清单.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const actions = {
    feature(id) {
      if (!['wanbo-campaign','future','shanhai'].includes(id) || id === featuredId) return;
      const panel = get('main').querySelector('.featured');
      featuredId = id;
      const change = () => {
        panel.innerHTML = featuredContent();
        panel.querySelector('[data-id="' + id + '"][data-action="feature"]')?.focus({preventScroll:true});
      };
      window.animateSwap ? window.animateSwap(panel,change) : change();
    },
    'zoom-case'(id) {
      const item = cases.find(entry => entry.id === id);
      if (!item?.board) return;
      const viewer = get('case-viewer');
      viewer.innerHTML = '<div class="viewer-head"><h2 id="viewer-title">' + item.name +
        '</h2><p>缩放查看策略与结果</p><label class="viewer-zoom">缩放<input aria-label="全案图片缩放" type="range" min="100" max="400" step="10" value="100" data-action="zoom-range"></label>' +
        '<button type="button" class="close" data-action="close-viewer" aria-label="关闭全案图">×</button></div>' +
        '<div class="viewer-stage">' + photo(item.board,item.name + '完整营销策略与结果','',true) + '</div>';
      viewer.showModal();
      document.body.classList.add('dialog-open');
    },
    'close-viewer'() { get('case-viewer').close(); },
    jump(id) { get('group-' + id)?.scrollIntoView({behavior:'smooth',block:'start'}); },
    clear() {
      filter = '';
      get('service-search').value = '';
      updateResults();
      get('service-search').focus();
    },
    package(id) {
      activePackage = activePackage === id ? '' : id;
      get('main').querySelectorAll('.package').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.id === activePackage)));
    },
    district(id) {
      if (!Object.hasOwn(manual.roster,id)) return;
      currentDistrict = id;
      get('roster-rows').innerHTML = rosterRows();
      get('main').querySelectorAll('[data-action="district"]').forEach(button =>
        button.setAttribute('aria-pressed',String(button.dataset.id === id)));
    },
    scene(id) {
      currentScene = id;
      get('scene-panel').outerHTML = scenePanel();
      get('scene-panel').querySelector('[data-id="' + id + '"]').focus({preventScroll:true});
    },
    save(id,button) {
      setSaved([...saved.filter(item => item.id !== id), {id,package:activePackage || null}]);
      get('main').querySelectorAll('[data-action="save"]').forEach(candidate => { candidate.textContent = '更新意向清单'; });
      showStatus('已保存到意向清单');
    },
    'open-selection'() {
      renderSelection();
      dialog.showModal();
      document.body.classList.add('dialog-open');
    },
    'close-selection'() { dialog.close(); },
    remove(id) {
      setSaved(saved.filter(item => item.id !== id));
      renderSelection();
      dialog.querySelector('.close').focus();
      const button = get('main').querySelector('[data-action="save"]');
      if (button && id === activeId) button.textContent = '加入意向清单';
    },
    download,
    'export-pdf':exportPDF,
    'share-pdf':sharePDF,
    print:printSelection
  };

  document.addEventListener('click', event => {
    const jump = event.target.closest('[data-case-jump]');
    if (jump) {
      event.preventDefault();
      get(jump.dataset.caseJump)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action) actions[action.dataset.action]?.(action.dataset.id, action);
    const configButton = event.target.closest('button[data-config]');
    if (configButton) updateConfiguration(configButton);
  });
  document.addEventListener('input', event => {
    if (event.target.dataset.action === 'zoom-range') {
      const image = get('case-viewer').querySelector('.viewer-stage img');
      image.style.width = event.target.value + '%';
      image.style.maxWidth = 'none';
    }
    const {id,value} = event.target;
    if (id === 'service-search') { filter = value; updateResults(); }
    if (id === 'project') { invalidatePDF(); project = value; storage.set('showroom-project',value); }
    if (id === 'notes') { invalidatePDF(); notes = value; storage.set('showroom-notes',value); }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('select[data-config],input[data-config]')) updateConfiguration(event.target);
  });
  const closeOverlay = () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open');
  };
  dialog.addEventListener('close', closeOverlay);
  get('case-viewer').addEventListener('close',closeOverlay);
  window.addEventListener('hashchange', () => {
    const update = () => {
      render();
      get('main').focus({preventScroll:true});
    };
    window.transitionPage ? window.transitionPage(update) : update();
  });
  render();
  const syncHeaderHeight = () => {
    document.documentElement.style.setProperty('--header-height',Math.ceil(get('header').getBoundingClientRect().height) + 'px');
  };
  syncHeaderHeight();
  if ('ResizeObserver' in window) new ResizeObserver(syncHeaderHeight).observe(get('header'));
  else window.addEventListener('resize',syncHeaderHeight,{passive:true});
})();
