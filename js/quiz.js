/* quiz.js — 答题流程 + 三套计分逻辑 */

export const OPTION_LABELS = ['非常不同意', '比较不同意', '不确定', '比较同意', '非常同意'];

/** 每个维度的满分绝对值（双极：题数 × 2；单极：题数 × 5），用于换算百分比 */
export function dimMaxAbs(bank) {
  const count = {};
  for (const q of bank.questions) count[q.dimension] = (count[q.dimension] || 0) + 1;
  const per = bank.meta.scoringModel === 'unipolar' ? 5 : 2;
  const max = {};
  for (const d of bank.dimensions) max[d.code] = (count[d.code] || 0) * per;
  return max;
}

/** 计分：所选选项 score 按维度求和 */
export function scoreAnswers(bank, answers) {
  const dim = {};
  for (const d of bank.dimensions) dim[d.code] = 0;
  bank.questions.forEach((q, i) => {
    const opt = q.options.find((o) => o.id === answers[i]);
    if (opt) dim[q.dimension] += opt.score;
  });
  return dim;
}

/**
 * 计算结果
 * - mbti / 16personalities: 类型码 + 维度明细
 * - bigfive: 五特质原始分 + 分段
 */
export function computeResult(bank, dim) {
  const max = dimMaxAbs(bank);

  if (bank.meta.id === 'bigfive') {
    const traits = bank.results.traits.map((t) => {
      const raw = dim[t.code] ?? 0;
      const bandObj = bank.results.bandModel.bands.find((b) => raw >= b.min && raw <= b.max);
      const label = bandObj ? bandObj.label : '低';
      return {
        code: t.code,
        name: t.name,
        nameEn: t.nameEn,
        raw,
        max: max[t.code],
        pct: Math.round((raw / max[t.code]) * 100),
        band: label,
        desc: t.bands[label] || '',
      };
    });
    return { kind: 'bigfive', traits };
  }

  // 双极维度：正 → poleA，负 → poleB，0 → X（倾向不明显）
  const detail = [];
  let code = '';
  for (const dimCode of bank.scoring.letterOrder) {
    const d = bank.dimensions.find((x) => x.code === dimCode);
    const s = dim[dimCode] ?? 0;
    const ambiguous = s === 0;
    const letter = ambiguous ? 'X' : s > 0 ? d.poleA.code : d.poleB.code;
    code += letter;
    const ratio = max[dimCode] ? Math.abs(s) / max[dimCode] : 0;
    detail.push({
      code: dimCode,
      name: d.name,
      left: d.poleA,
      right: d.poleB,
      score: s,
      letter,
      ambiguous,
      leftPct: Math.round((s > 0 ? 0.5 + ratio / 2 : s < 0 ? 0.5 - ratio / 2 : 0.5) * 100),
    });
  }

  if (bank.meta.id === '16personalities') {
    const idScore = dim.ID ?? 0;
    const identity = idScore >= 0 ? 'A' : 'T';
    const idDim = bank.dimensions.find((x) => x.code === 'ID');
    const idRatio = max.ID ? Math.abs(idScore) / max.ID : 0;
    detail.push({
      code: 'ID',
      name: idDim.name,
      left: idDim.poleA,
      right: idDim.poleB,
      score: idScore,
      letter: identity,
      ambiguous: idScore === 0,
      leftPct: Math.round((idScore >= 0 ? 0.5 + idRatio / 2 : 0.5 - idRatio / 2) * 100),
    });
    const role = bank.results.roles.find((r) => r.code === code);
    return {
      kind: '16personalities',
      typeCode: code,
      displayCode: `${code}-${identity}`,
      identity,
      identityName: identity === 'A' ? '坚决型' : '谨慎型',
      role: role || { code, name: '独特组合', nameEn: '', group: '', summary: '你的维度组合较为少见，建议结合各维度倾向解读。' },
      detail,
      ambiguous: detail.some((x) => x.ambiguous),
    };
  }

  // MBTI
  const type = bank.results.types.find((t) => t.code === code);
  return {
    kind: 'mbti',
    typeCode: code,
    displayCode: code,
    type: type || {
      code,
      name: '独特组合',
      nameEn: '',
      cognitiveStack: '',
      summary: '你的维度组合较为少见，建议结合各维度倾向解读。',
    },
    detail,
    ambiguous: detail.some((x) => x.ambiguous),
  };
}

/** 渲染单题 */
export function renderQuestion(bank, index, answers) {
  const q = bank.questions[index];
  const box = document.getElementById('optionsBox');
  document.getElementById('questionText').textContent = q.text;
  box.innerHTML = '';
  q.options.forEach((o) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option' + (answers[index] === o.id ? ' selected' : '');
    btn.innerHTML = `<span class="radio"></span><span>${o.text}</span>`;
    btn.addEventListener('click', () => {
      answers[index] = o.id;
      box.querySelectorAll('.option').forEach((el) => el.classList.remove('selected'));
      btn.classList.add('selected');
    });
    box.appendChild(btn);
  });

  const total = bank.questions.length;
  document.getElementById('progressNum').textContent = `第 ${index + 1} / ${total} 题`;
  const answered = answers.filter(Boolean).length;
  const remainMin = Math.max(1, Math.round(bank.meta.estimatedMinutes * (1 - answered / total)));
  document.getElementById('progressTime').textContent = `预计还需 ${remainMin} 分钟`;
  document.getElementById('progressFill').style.width = `${((index + 1) / total) * 100}%`;
  document.getElementById('btnPrev').disabled = index === 0;
  document.getElementById('btnPrev').style.opacity = index === 0 ? '.45' : '1';
  document.getElementById('btnNext').textContent = index === total - 1 ? '查看结果' : '下一题';
}
