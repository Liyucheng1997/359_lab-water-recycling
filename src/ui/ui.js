import { STAGES, GROUPS, METRICS, stageById } from '../data/stages.js';
import { qCss } from '../flow/particles.js';

const $ = (id) => document.getElementById(id);
const LOOP = STAGES.filter((s) => s.id !== 'sludge');
const fmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));

/** 从 0 到 1 的清洁度渐变 CSS */
function gradientCss() {
  const stops = [];
  for (let i = 0; i <= 20; i++) stops.push(`${qCss(i / 20)} ${(i / 20) * 100}%`);
  return `linear-gradient(90deg, ${stops.join(',')})`;
}

export function createUI(h) {
  // 图例
  $('legend').innerHTML = [
    ['#b07a45', '污水管'], ['#2f86ea', '给水管'], ['#8a5cd6', '再生水管'], ['#2aa198', '原水/工艺管'], ['#6b4426', '污泥管'], ['#e7b416', '沼气管'],
  ].map(([c, n]) => `<span><i style="background:${c}"></i>${n}</span>`).join('');

  // 左侧流程列表
  const list = $('stageList');
  let html = '';
  for (const g of GROUPS) {
    const items = STAGES.filter((s) => s.group === g.id);
    if (!items.length) continue;
    html += `<li class="grp">${g.name}</li>`;
    for (const s of items) {
      const n = STAGES.indexOf(s) + 1;
      html += `<li class="st" data-id="${s.id}"><span class="dot" style="background:${s.id === 'sludge' ? '#5a3a1e' : qCss(s.q)}">${n}</span><span>${s.name}</span></li>`;
    }
  }
  list.innerHTML = html;
  list.addEventListener('click', (e) => { const li = e.target.closest('li.st'); if (li) h.onSelect(li.dataset.id); });

  // 底部时间轴
  $('track').style.background = gradientCss();
  const ticks = $('ticks');
  ticks.innerHTML = LOOP.map((s, i) => `<div class="tick" data-id="${s.id}" style="left:${(i / (LOOP.length - 1)) * 100}%;background:${qCss(s.q)}">${STAGES.indexOf(s) + 1}<span class="tip">${s.name}</span></div>`).join('');
  ticks.addEventListener('click', (e) => { const t = e.target.closest('.tick'); if (t) h.onSelect(t.dataset.id); });

  // 控件
  const btnPlay = $('btnPlay');
  btnPlay.onclick = () => h.onPlay();
  $('speed').oninput = (e) => h.onSpeed(+e.target.value);
  $('btnFollow').onclick = () => h.onFollow();
  $('btnTour').onclick = () => h.onTour();
  $('ground').oninput = (e) => h.onGround(+e.target.value);
  $('btnPipes').onclick = (e) => h.onPipes(e.currentTarget.classList.toggle('on'));
  $('btnLabels').onclick = (e) => h.onLabels(e.currentTarget.classList.toggle('on'));
  $('btnOverview').onclick = () => h.onOverview();

  let active = null;
  const api = {
    setPlaying(p) { btnPlay.querySelector('.ico').textContent = p ? '❚❚' : '▶'; },
    setFollow(f) { $('btnFollow').classList.toggle('on', f); },
    setTour(f) { $('btnTour').classList.toggle('on', f); },
    setGround(v) { $('ground').value = v; },
    setTracerStage(id) {
      list.querySelectorAll('li.st').forEach((li) => li.classList.toggle('tracer', li.dataset.id === id));
    },
    setDrop(frac, q) {
      const m = $('dropMarker');
      m.style.left = `${frac * 100}%`;
      m.style.background = qCss(q); m.style.boxShadow = `0 0 12px ${qCss(q)}`;
    },
    setActive(id) {
      active = id;
      list.querySelectorAll('li.st').forEach((li) => li.classList.toggle('active', li.dataset.id === id));
      ticks.querySelectorAll('.tick').forEach((t) => t.classList.toggle('active', t.dataset.id === id));
      document.querySelectorAll('.lbl').forEach((l) => l.classList.toggle('active', l.dataset.stage === id && !l.classList.contains('sub') && !l.classList.contains('site')));
      const li = list.querySelector(`li.st[data-id="${id}"]`); li?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (!id) { $('infoEmpty').hidden = false; $('infoBody').hidden = true; return; }
      renderInfo(stageById[id]);
    },
    get active() { return active; },
  };

  function renderInfo(s) {
    $('infoEmpty').hidden = true;
    const body = $('infoBody'); body.hidden = false;
    const n = STAGES.indexOf(s) + 1;
    const grp = GROUPS.find((g) => g.id === s.group);
    const color = s.id === 'sludge' ? '#5a3a1e' : qCss(s.q);
    let q = '';
    if (s.quality) {
      q = `<div class="sec-title">清洁度</div>
        <div class="clean" style="background:${gradientCss()}"><span class="mk" style="left:${s.q * 100}%"></span></div>
        <div class="clean-l"><span>原生污水</span><span>再生水</span><span>饮用水</span></div>
        <div class="sec-title">典型水质（出水）</div>` +
        METRICS.map((m) => {
          const v = s.quality[m.key];
          const f = m.log ? Math.log10(1 + v) / Math.log10(1 + m.max) : v / m.max;
          const ok = m.key === 'coli' ? v <= 0 : v <= m.std;
          const bar = ok ? '#3fd3a0' : f > 0.6 ? '#c8763a' : '#d9b44a';
          const txt = m.key === 'coli' ? (v <= 0 ? '未检出' : `10<sup>${v}</sup>`) : fmt(v);
          return `<div class="metric"><span>${m.name}</span><span class="bar"><i style="width:${Math.max(2, f * 100)}%;background:${bar}"></i></span><span class="val">${txt}<small>${m.key === 'coli' ? (v <= 0 ? '' : '/100mL') : m.unit}</small></span></div>`;
        }).join('') +
        `<div class="note">绿色条表示已达到饮用水/地表水准 IV 类量级的参考限值；数值为典型示意值，实际随水源与工艺而变。</div>`;
    } else {
      q = `<div class="sec-title">污泥去向</div><div class="note" style="font-size:12.5px">污水中约 1–2‰ 的体积最终以污泥形式离开水循环。厌氧消化可使有机质减量 40–50%，产生的沼气发电可满足厂区约 20–40% 的电耗，实现“能源回收 + 资源化”。</div>`;
    }
    const idx = STAGES.indexOf(s);
    const prev = STAGES[(idx - 1 + STAGES.length) % STAGES.length], next = STAGES[(idx + 1) % STAGES.length];
    $('infoBody').innerHTML = `
      <div class="info-head"><span class="dot" style="background:${color}">${n}</span>
        <div><h2>${s.name}</h2><div class="en">${s.en}</div><span class="tag" style="color:${grp.color}">● ${grp.name}</span></div></div>
      <p class="desc">${s.desc}</p>
      ${q}
      <div class="sec-title">关键设计参数</div>
      <table class="params">${s.params.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
      <div class="nav"><button class="btn" data-go="${prev.id}">‹ ${prev.name}</button><button class="btn" data-go="${next.id}">${next.name} ›</button></div>`;
    body.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => h.onSelect(b.dataset.go)));
    body.scrollTop = 0;
  }
  return api;
}
