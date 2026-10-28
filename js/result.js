/* result.js — 三种结果形态渲染 + 邮件表单 */
import { buildAnalysis } from './analysis.js';
import { generatePdfBase64 } from './pdf.js';
import { showToast } from './app.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function dimBarHtml(row, accent) {
  const winLeft = row.score >= 0;
  return `
    <div class="dim-row">
      <div class="dim-label ${winLeft ? 'win' : ''}">${esc(row.left.name)} ${row.leftPct}%</div>
      <div class="dim-track"><div class="dim-fill" style="width:${row.leftPct}%;background:${accent}"></div></div>
      <div class="dim-label ${!winLeft && !row.ambiguous ? 'win' : ''}" style="text-align:right">${esc(row.right.name)} ${100 - row.leftPct}%</div>
    </div>`;
}

function renderHero(state) {
  const { result, bank } = state;
  const t = TEST_META[bank.meta.id];
  const usedMin = Math.max(1, Math.round((Date.now() - (state.startedAt || Date.now())) / 60000));
  const metaLine = `${bank.meta.questionCount} 题全部完成 · 用时约 ${usedMin} 分钟 · ${new Date().toLocaleDateString('zh-CN')} 生成`;

  if (result.kind === 'bigfive') {
    return `
      <span class="chip" style="background:${t.soft};color:${t.accent}">大五人格测评结果</span>
      <div class="result-code" style="color:${t.accent};font-size:44px">OCEAN 五特质画像</div>
      <div class="result-name">五个特质独立计分，没有好坏类型之分</div>
      <div class="result-meta">${esc(metaLine)}</div>`;
  }

  const nameLine =
    result.kind === 'mbti'
      ? `${esc(result.type.name)} · ${esc(result.type.summary.slice(0, 24))}…`
      : `${esc(result.role.name)} · ${esc(result.identityName)}`;
  const stackLine =
    result.kind === 'mbti' && result.type.cognitiveStack
      ? `认知功能栈：${esc(result.type.cognitiveStack.split('-').join(' · '))}`
      : result.kind === '16personalities'
        ? `${esc(result.role.group)} · 结果后缀 -${result.identity}`
        : '';

  return `
    <span class="chip" style="background:${t.soft};color:${t.accent}">${esc(t.name)} 结果</span>
    <div class="result-code" style="color:${t.accent}">${esc(result.displayCode)}</div>
    <div class="result-name">${nameLine}</div>
    ${stackLine ? `<div class="result-stack">${stackLine}</div>` : ''}
    ${result.ambiguous ? '<div class="result-stack" style="color:#D69B2B">有维度接近中点（倾向不明显），解读时可两侧参考。</div>' : ''}
    <div class="result-meta">${esc(metaLine)}</div>`;
}

const TEST_META = {
  mbti: { name: 'MBTI 测评', accent: '#6C5CE7', soft: '#EFECFF' },
  '16personalities': { name: '16Personalities', accent: '#23A094', soft: '#E3F5F2' },
  bigfive: { name: '大五人格', accent: '#E2529F', soft: '#FFECFA' },
};

export function renderResult(state) {
  const { result, bank } = state;
  const t = TEST_META[bank.meta.id];

  // Hero
  document.getElementById('resultHero').innerHTML = renderHero(state);

  // 维度条 / 特质条
  const dimsBox = document.getElementById('resultDims');
  if (result.kind === 'bigfive') {
    dimsBox.innerHTML =
      `<h2>五特质得分</h2>` +
      result.traits
        .map(
          (tr) => `
      <div class="trait-row">
        <div class="trait-head">
          <strong>${esc(tr.name)} <span style="color:var(--ink-3);font-weight:400;font-size:12px">${esc(tr.nameEn)}</span></strong>
          <span class="score">${tr.raw} / ${tr.max}　<span class="band" style="background:${t.soft};color:${t.accent}">${esc(tr.band)}</span></span>
        </div>
        <div class="trait-track"><div class="trait-fill" style="width:${tr.pct}%;background:${t.accent}"></div></div>
        <p class="trait-desc">${esc(tr.desc)}</p>
      </div>`
        )
        .join('');
  } else {
    dimsBox.innerHTML =
      `<h2>维度倾向</h2>` +
      result.detail.map((row) => dimBarHtml(row, t.accent)).join('');
  }

  // 分析
  const blocks = buildAnalysis(result);
  document.getElementById('resultAnalysis').innerHTML =
    `<h2>正式分析报告</h2>` +
    blocks
      .map(
        (b) => `<div class="analysis-block"><h3>${esc(b.title)}</h3><p>${esc(b.body).replace(/\n/g, '<br>')}</p></div>`
      )
      .join('');
}

/* ---------- 邮件表单 ---------- */
export function bindEmailForm(state) {
  const form = document.getElementById('emailForm');
  const msg = document.getElementById('formMsg');
  const btn = document.getElementById('btnSend');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    msg.textContent = '';

    const data = Object.fromEntries(new FormData(form).entries());
    const name = (data.name || '').trim();
    const gender = data.gender || '';
    const age = Number(data.age);
    const email = (data.email || '').trim();

    if (!name) return fail('请填写姓名');
    if (!gender) return fail('请选择性别');
    if (!Number.isFinite(age) || age < 1 || age > 120) return fail('请填写 1–120 之间的年龄');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Email 格式不正确');

    function fail(text) {
      msg.className = 'form-msg err';
      msg.textContent = text;
    }

    btn.disabled = true;
    btn.textContent = '正在生成 PDF…';
    try {
      const pdfBase64 = await generatePdfBase64();
      btn.textContent = '正在发送…';
      const subject = `${name} 的${TEST_META[state.bank.meta.id].name}报告`;
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, name, gender, age, subject, pdfBase64 }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || '发送失败，请稍后重试');
      msg.className = 'form-msg ok';
      msg.textContent = '报告已发送，请查收邮箱（如未看到，请检查垃圾邮件箱）。';
      showToast('PDF 报告已发送到你的邮箱');
    } catch (err) {
      msg.className = 'form-msg err';
      msg.textContent = err.message || '发送失败，请稍后重试';
    } finally {
      btn.disabled = false;
      btn.textContent = '生成 PDF 并发送到邮箱';
    }
  });
}
