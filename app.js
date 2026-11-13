const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const percent = (score) => `${(score / 100).toFixed(2)}%`;
const integer = (value) => value.toLocaleString('zh-CN');

let poems = [];
let pairs = [];
let poemById = new Map();
let matchesByPoem = new Map();
let selectedPair = null;
let selectedPoem = null;
let activePoet = '王勃';
let pairLimit = 12;
let poemLimit = 18;

function poemFor(id) { return poemById.get(id); }
function lineFor(poemId, lineIndex) { return poemFor(poemId)?.lines.find(line => line.index === lineIndex); }

function renderStats() {
  const wang = poems.filter(poem => poem.poet === '王勃');
  const luo = poems.filter(poem => poem.poet === '骆宾王');
  const uniquePoemPairs = new Set(pairs.map(pair => `${pair.poem1}/${pair.poem2}`)).size;
  const stats = [
    ['王勃诗作', wang.length, `${integer(wang.reduce((sum, poem) => sum + poem.lines.length, 0))} 条诗句`],
    ['骆宾王诗作', luo.length, `${integer(luo.reduce((sum, poem) => sum + poem.lines.length, 0))} 条诗句`],
    ['相似诗句配对', pairs.length, '来自配对 CSV 的逐行记录'],
    ['涉及的诗歌组合', uniquePoemPairs, '按两首诗的《全唐诗》编号去重'],
  ];
  $('#stat-grid').innerHTML = stats.map(([label, value, sub]) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${integer(value)}</div><div class="stat-sub">${sub}</div></div>`).join('');
  $('.viz-top h3').textContent = `${integer(pairs.length)} 条记录的分布`;
  $('#wang-count').textContent = `(${wang.length})`;
  $('#luo-count').textContent = `(${luo.length})`;
}

function renderPlot() {
  const svg = $('#plot');
  svg.setAttribute('viewBox', '0 0 600 240');
  svg.innerHTML = '';
  for (let score = 7000; score <= 10000; score += 500) {
    const x = 15 + (score - 7000) / 3000 * 570;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    line.setAttribute('y1', 9); line.setAttribute('y2', 225);
    line.setAttribute('class', 'gridline');
    svg.append(line);
  }
  pairs.forEach((pair, index) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    // The vertical offset has no data meaning; it separates overlapping records.
    const y = 15 + ((index * 73 + Math.floor(index / 9) * 19) % 205);
    circle.setAttribute('cx', 15 + (pair.score - 7000) / 3000 * 570);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', pair === selectedPair ? 5.2 : 3.2);
    circle.setAttribute('class', `plot-dot${pair === selectedPair ? ' active' : ''}`);
    circle.setAttribute('tabindex', '0');
    circle.setAttribute('role', 'button');
    circle.setAttribute('aria-label', `${poemFor(pair.poem1).title}与${poemFor(pair.poem2).title}，相似度${percent(pair.score)}`);
    circle.addEventListener('click', () => selectPair(pair));
    circle.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPair(pair); } });
    svg.append(circle);
  });
}

function selectPair(pair, scroll = false) {
  selectedPair = pair;
  renderFeaturedPair();
  renderPlot();
  if (scroll) $('.explore-layout').scrollIntoView({behavior:'smooth', block:'start'});
}

function renderFeaturedPair() {
  const pair = selectedPair;
  const first = poemFor(pair.poem1);
  const second = poemFor(pair.poem2);
  const line1 = lineFor(pair.poem1, pair.line1);
  const line2 = lineFor(pair.poem2, pair.line2);
  $('#featured-pair').innerHTML = `<div class="featured-top"><span>当前选中的诗句</span><span class="score-pill">${percent(pair.score)}</span></div>
    <div class="featured-body"><div><span class="featured-poet">王勃</span><span class="featured-title">${escapeHtml(first.title)}</span><p class="featured-verse">${escapeHtml(line1.text)}</p></div><div class="featured-divider"></div><div><span class="featured-poet">骆宾王</span><span class="featured-title">${escapeHtml(second.title)}</span><p class="featured-verse">${escapeHtml(line2.text)}</p></div></div>
    <div class="featured-bottom">源值 ${pair.score} / 10,000 · 句序 ${pair.line1} 与 ${pair.line2}<br><button class="read-poem" data-id="${pair.poem1}" type="button">读王勃全诗 ↗</button><button class="read-poem" data-id="${pair.poem2}" type="button">读骆宾王全诗 ↗</button></div>`;
  $('#featured-pair').querySelectorAll('.read-poem').forEach(button => button.addEventListener('click', () => {
    selectPoem(poemFor(Number(button.dataset.id)), true);
  }));
}

function filteredPairs() {
  const query = $('#pair-search').value.trim().toLocaleLowerCase();
  const minimum = Number($('#score-filter').value);
  const sort = $('#pair-sort').value;
  const result = pairs.filter(pair => {
    if (pair.score < minimum) return false;
    if (!query) return true;
    const content = [poemFor(pair.poem1).title, poemFor(pair.poem2).title, lineFor(pair.poem1, pair.line1).text, lineFor(pair.poem2, pair.line2).text].join(' ').toLocaleLowerCase();
    return content.includes(query);
  });
  if (sort === 'high') result.sort((a,b) => b.score - a.score);
  if (sort === 'low') result.sort((a,b) => a.score - b.score);
  return result;
}

function renderPairList() {
  const result = filteredPairs();
  $('#result-count').textContent = `显示 ${Math.min(pairLimit, result.length)} / ${result.length} 条`;
  $('#pair-list').innerHTML = result.length ? result.slice(0, pairLimit).map((pair, index) => {
    const first = poemFor(pair.poem1), second = poemFor(pair.poem2);
    return `<button class="pair-card" type="button" data-index="${index}"><div class="pair-meta"><span>配对记录 · 源值 ${pair.score}</span><strong>${percent(pair.score)}</strong></div><div class="pair-lines"><div><span>王勃</span><p>${escapeHtml(lineFor(pair.poem1, pair.line1).text)}</p><small>${escapeHtml(first.title)} · 句序 ${pair.line1}</small></div><div><span>骆宾王</span><p>${escapeHtml(lineFor(pair.poem2, pair.line2).text)}</p><small>${escapeHtml(second.title)} · 句序 ${pair.line2}</small></div></div></button>`;
  }).join('') : '<div class="empty-state">当前条件下没有相似诗句记录。试试降低最低相似度或更换关键词。</div>';
  $('#pair-list').querySelectorAll('.pair-card').forEach(button => button.addEventListener('click', () => selectPair(result[Number(button.dataset.index)], true)));
  $('#more-pairs').hidden = pairLimit >= result.length;
}

function selectPoem(poem, scroll = false) {
  selectedPoem = poem;
  activePoet = poem.poet;
  poemLimit = Math.max(18, poems.filter(candidate => candidate.poet === poem.poet).findIndex(candidate => candidate.id === poem.id) + 1);
  $('#poem-search').value = '';
  renderPoemList();
  renderPoemReader();
  if (scroll) $('#library').scrollIntoView({behavior:'smooth', block:'start'});
}

function filteredPoems() {
  const query = $('#poem-search').value.trim().toLocaleLowerCase();
  return poems.filter(poem => poem.poet === activePoet && (!query || poem.title.toLocaleLowerCase().includes(query) || poem.lines.some(line => line.text.toLocaleLowerCase().includes(query))));
}

function renderPoemList() {
  document.querySelectorAll('.poet-tabs button').forEach(button => button.setAttribute('aria-selected', String(button.dataset.poet === activePoet)));
  const result = filteredPoems();
  $('#poem-result-count').textContent = `找到 ${result.length} 首作品 · 显示 ${Math.min(result.length, poemLimit)} 首`;
  $('#poem-list').innerHTML = result.length ? result.slice(0, poemLimit).map(poem => `<button class="poem-item${selectedPoem?.id === poem.id ? ' active' : ''}" type="button" data-id="${poem.id}"><span class="poem-item-title">${escapeHtml(poem.title)}</span><span class="poem-item-sub">《全唐诗》编号 ${poem.id} · ${poem.lines.length} 句${matchesByPoem.has(poem.id) ? ` · ${matchesByPoem.get(poem.id).size} 句见于配对文件` : ''}</span></button>`).join('') : '<div class="empty-state">未找到符合条件的作品。</div>';
  $('#poem-list').querySelectorAll('.poem-item').forEach(button => button.addEventListener('click', () => {
    selectedPoem = poemFor(Number(button.dataset.id));
    renderPoemList();
    renderPoemReader();
  }));
  $('#more-poems').hidden = poemLimit >= result.length;
}

function renderPoemReader() {
  const poem = selectedPoem;
  if (!poem) return;
  const matchedLines = matchesByPoem.get(poem.id) ?? new Set();
  $('#poem-reader').innerHTML = `<div class="reader-header"><span class="reader-kicker">${escapeHtml(poem.poet)} · 原文</span><h3>${escapeHtml(poem.title)}</h3><div class="reader-meta">《全唐诗》编号 ${poem.id} · ${poem.lines.length} 句</div></div><div class="reader-lines">${poem.lines.map(line => `<div class="reader-line${matchedLines.has(line.index) ? ' matched' : ''}"><span class="reader-line-num">${line.index}</span><span>${escapeHtml(line.text)}</span></div>`).join('')}</div><div class="reader-legend"><i></i>有底色的诗句出现在提供的相似配对文件中。左侧数字为源文件句序。</div>`;
}

function wireControls() {
  $('#pair-search').addEventListener('input', () => { pairLimit = 12; renderPairList(); });
  $('#score-filter').addEventListener('input', () => {
    $('#range-value').textContent = `${(Number($('#score-filter').value) / 100).toFixed(0)}%`;
    pairLimit = 12; renderPairList();
  });
  $('#pair-sort').addEventListener('change', () => { pairLimit = 12; renderPairList(); });
  $('#more-pairs').addEventListener('click', () => { pairLimit += 12; renderPairList(); });
  document.querySelectorAll('.poet-tabs button').forEach(button => button.addEventListener('click', () => {
    activePoet = button.dataset.poet;
    selectedPoem = poems.find(poem => poem.poet === activePoet);
    poemLimit = 18;
    $('#poem-search').value = '';
    renderPoemList(); renderPoemReader();
  }));
  $('#poem-search').addEventListener('input', () => { poemLimit = 18; renderPoemList(); });
  $('#more-poems').addEventListener('click', () => { poemLimit += 18; renderPoemList(); });
}

function init() {
  try {
    const data = window.poetryData;
    if (!data || !Array.isArray(data.poems) || !Array.isArray(data.pairs)) throw new Error('Poetry data unavailable');
    poems = data.poems;
    pairs = data.pairs;
    poemById = new Map(poems.map(poem => [poem.id, poem]));
    for (const pair of pairs) {
      if (!matchesByPoem.has(pair.poem1)) matchesByPoem.set(pair.poem1, new Set());
      if (!matchesByPoem.has(pair.poem2)) matchesByPoem.set(pair.poem2, new Set());
      matchesByPoem.get(pair.poem1).add(pair.line1);
      matchesByPoem.get(pair.poem2).add(pair.line2);
    }
    selectedPair = [...pairs].sort((a,b) => b.score - a.score)[0];
    selectedPoem = poems.find(poem => poem.poet === '王勃');
    renderStats(); renderPlot(); renderFeaturedPair(); renderPairList(); renderPoemList(); renderPoemReader(); wireControls();
  } catch (error) {
    console.error(error);
    $('#stat-grid').innerHTML = '<div class="empty-state">数据加载失败，请刷新页面重试。</div>';
  }
}
init();
