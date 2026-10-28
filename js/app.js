/* app.js — 状态管理、视图路由、首页渲染、入口 */
import { scoreAnswers, computeResult, renderQuestion } from './quiz.js';
import { renderResult, bindEmailForm } from './result.js';

export const TESTS = {
  mbti: {
    key: 'mbti',
    bankId: 'mbti',
    name: 'MBTI 性格类型测评',
    file: 'data/mbti_question_bank.json',
    accent: '#6C5CE7',
    soft: '#EFECFF',
    meta: '72 道题 · 4 个维度 · 约 12 分钟',
    desc: '基于荣格心理类型理论的经典四维度模型，输出 16 种人格类型与认知功能栈解读。',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#6C5CE7" stroke-width="2"/><path d="M12 6l2.5 6L12 18l-2.5-6L12 6z" fill="#6C5CE7"/></svg>',
  },
  '16p': {
    key: '16p',
    bankId: '16personalities',
    name: '16Personalities 测评',
    file: 'data/16p_question_bank.json',
    accent: '#23A094',
    soft: '#E3F5F2',
    meta: '60 道题 · 5 个维度 · 约 10 分钟',
    desc: '在四维度基础上增加 Identity 维度，结果带 A/T 后缀，更贴近情绪与压力反应。',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="#23A094" stroke-width="2" stroke-linejoin="round"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" stroke="#23A094" stroke-width="2" stroke-linejoin="round"/></svg>',
  },
  bigfive: {
    key: 'bigfive',
    bankId: 'bigfive',
    name: '大五人格测评',
    file: 'data/bigfive_question_bank.json',
    accent: '#E2529F',
    soft: '#FFECFA',
    meta: '100 道题 · 5 个特质 · 约 15 分钟',
    desc: '现代心理学主流的五因素模型，OCEAN 五特质独立计分，画像更细腻立体。',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="12" width="3.5" height="7" rx="1.75" fill="#E2529F"/><rect x="10.25" y="8" width="3.5" height="11" rx="1.75" fill="#E2529F"/><rect x="16.5" y="5" width="3.5" height="14" rx="1.75" fill="#E2529F"/></svg>',
  },
};

const STORE_KEY = 'mindmirror_state_v1';

export const state = {
  testKey: null,
  bank: null,
  answers: [],
  qIndex: 0,
  startedAt: null,
  result: null,
};

/* ---------- localStorage ---------- */
function saveState() {
  if (!state.testKey) return;
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        testKey: state.testKey,
        answers: state.answers,
        qIndex: state.qIndex,
        startedAt: state.startedAt,
      })
    );
  } catch (_) { /* 隐私模式下忽略 */ }
}
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch (_) {
    return null;
  }
}
function clearState() {
  try { localStorage.removeItem(STORE_KEY); } catch (_) {}
}

/* ---------- 视图切换 ---------- */
export function switchView(name) {
  for (const v of ['home', 'quiz', 'result']) {
    document.getElementById(`view-${v}`).hidden = v !== name;
  }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ---------- 首页测试卡 ---------- */
function renderTestCards() {
  const box = document.getElementById('testCards');
  box.innerHTML = '';
  Object.values(TESTS).forEach((t) => {
    const card = document.createElement('div');
    card.className = 'test-card';
    card.innerHTML = `
      <span class="icon" style="background:${t.soft}">${t.icon}</span>
      <h3>${t.name}</h3>
      <p class="meta">${t.meta}\n${t.desc}</p>
      <span class="go" style="color:${t.accent}">开始测试
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="${t.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>`;
    card.addEventListener('click', () => startTest(t.key));
    box.appendChild(card);
  });
}

/* ---------- 测试流程 ---------- */
async function loadBank(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`题库加载失败：${file}`);
  return res.json();
}

export async function startTest(testKey, restore = false) {
  const t = TESTS[testKey];
  if (!t) return;
  state.testKey = testKey;
  state.bank = await loadBank(t.file);
  if (!restore) {
    state.answers = new Array(state.bank.questions.length).fill(null);
    state.qIndex = 0;
    state.startedAt = Date.now();
  }
  document.getElementById('quizTitle').textContent = t.name;
  renderQuestion(state.bank, state.qIndex, state.answers);
  switchView('quiz');
  saveState();
}

function goNext() {
  const total = state.bank.questions.length;
  if (!state.answers[state.qIndex]) {
    showToast('请先选择一个选项');
    return;
  }
  if (state.qIndex < total - 1) {
    state.qIndex += 1;
    renderQuestion(state.bank, state.qIndex, state.answers);
    saveState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    finishTest();
  }
}

function goPrev() {
  if (state.qIndex > 0) {
    state.qIndex -= 1;
    renderQuestion(state.bank, state.qIndex, state.answers);
    saveState();
  }
}

function finishTest() {
  const dim = scoreAnswers(state.bank, state.answers);
  state.result = computeResult(state.bank, dim);
  renderResult(state);
  clearState();
  switchView('result');
}

/* ---------- Toast ---------- */
let toastTimer = null;
export function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ---------- 启动 ---------- */
function boot() {
  renderTestCards();

  document.getElementById('btnNext').addEventListener('click', goNext);
  document.getElementById('btnPrev').addEventListener('click', goPrev);
  document.getElementById('quizBack').addEventListener('click', () => switchView('home'));
  document.getElementById('quizExit').addEventListener('click', () => {
    if (confirm('退出后当前作答进度将被清除，确定退出吗？')) {
      clearState();
      switchView('home');
    }
  });
  document.getElementById('btnRetake').addEventListener('click', () => startTest(state.testKey));
  document.getElementById('btnOther').addEventListener('click', () => {
    switchView('home');
    document.getElementById('tests').scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.getAttribute('data-nav');
      if (target === 'home') switchView('home');
      if (target === 'tests') {
        switchView('home');
        setTimeout(() => document.getElementById('tests').scrollIntoView({ behavior: 'smooth' }), 60);
      }
    });
  });

  bindEmailForm(state);

  // 恢复未完成的作答
  const saved = loadState();
  if (saved && saved.testKey && TESTS[saved.testKey] && Array.isArray(saved.answers)) {
    if (confirm('检测到上次未完成的作答，是否继续？')) {
      startTest(saved.testKey, true).then(() => {
        state.answers = saved.answers;
        state.qIndex = Math.min(saved.qIndex || 0, state.bank.questions.length - 1);
        state.startedAt = saved.startedAt || Date.now();
        renderQuestion(state.bank, state.qIndex, state.answers);
        saveState();
      });
      return;
    }
    clearState();
  }
  switchView('home');
}

boot();
