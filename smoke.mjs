/* smoke.mjs — 计分冒烟测试（node smoke.mjs 可复跑，验证三套计分与分段） */
import { readFileSync } from 'node:fs';
import { scoreAnswers, computeResult, dimMaxAbs } from './js/quiz.js';

function loadBank(name) {
  return JSON.parse(readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8'));
}

let failed = 0;
function check(label, cond, extra = '') {
  if (cond) console.log(`  PASS  ${label} ${extra}`);
  else { console.log(`  FAIL  ${label} ${extra}`); failed++; }
}

// ---------- MBTI ----------
const mbti = loadBank('mbti_question_bank.json');
{
  // 全选 poleA 端（direction A 的选 5 分，direction B 的选 1 分 → -2）
  const answers = mbti.questions.map((q) => (q.direction === 'A' ? '5' : '1'));
  const dim = scoreAnswers(mbti, answers);
  const r = computeResult(mbti, dim);
  check('MBTI 全 A 维度 → ESTJ', r.typeCode === 'ESTJ', `got ${r.typeCode}`);
  check('MBTI 类型可查表', !!r.type && r.type.name === '总经理', `got ${r.type?.name}`);
  check('MBTI 维度数 = 4', r.detail.length === 4);
  check('MBTI 每维度得分 = +36', r.detail.every((d) => d.score === 36), JSON.stringify(r.detail.map((d) => d.score)));

  const answers2 = mbti.questions.map((q) => (q.direction === 'A' ? '1' : '5'));
  const r2 = computeResult(mbti, scoreAnswers(mbti, answers2));
  check('MBTI 全 B 维度 → INFP', r2.typeCode === 'INFP', `got ${r2.typeCode}`);
  check('MBTI 百分比互补', r.detail[0].leftPct === 100 && r2.detail[0].leftPct === 0);
}

// ---------- 16P ----------
const p16 = loadBank('16p_question_bank.json');
{
  // 16P 各维度 poleA：MI=E, EN=S(观察型), NA=T, TA=J；ID poleA=A
  // direction A 的题选 5 分、direction B 的题选 1 分 → 全部倒向 poleA
  const answers = p16.questions.map((q) => (q.direction === 'A' ? '5' : '1'));
  const dim = scoreAnswers(p16, answers);
  const r = computeResult(p16, dim);
  check('16P 全 poleA + ID=A → ESTJ-A', r.displayCode === 'ESTJ-A', `got ${r.displayCode}`);
  check('16P identity = A', r.identity === 'A');
  check('16P 维度数 = 5', r.detail.length === 5);
  check('16P 角色可查表', r.role.name === '总经理', `got ${r.role.name}`);

  // 全倒向 poleB，且 ID 题：direction A 选 1、direction B 选 5 → ID 负分 → T
  const answers2 = p16.questions.map((q) =>
    q.dimension === 'ID' ? (q.direction === 'A' ? '1' : '5') : q.direction === 'A' ? '1' : '5'
  );
  const r2 = computeResult(p16, scoreAnswers(p16, answers2));
  check('16P 全 poleB + ID=T → INFP-T', r2.displayCode === 'INFP-T', `got ${r2.displayCode}`);
  check('16P identity = T', r2.identity === 'T');
}

// ---------- Big Five ----------
const bf = loadBank('bigfive_question_bank.json');
{
  // 正向题全 5 分、反向题全 1 分 → 每特质 100 分
  const answers = bf.questions.map((q) => (q.direction === 'positive' ? '5' : '1'));
  const dim = scoreAnswers(bf, answers);
  const r = computeResult(bf, dim);
  check('BF 全高分 → 五特质 100', r.traits.every((t) => t.raw === 100), JSON.stringify(r.traits.map((t) => t.raw)));
  check('BF 全高分 → 全部「高」段', r.traits.every((t) => t.band === '高'), JSON.stringify(r.traits.map((t) => t.band)));
  check('BF 分段描述非空', r.traits.every((t) => t.desc.length > 5));

  const answers2 = bf.questions.map((q) => (q.direction === 'positive' ? '1' : '5'));
  const r2 = computeResult(bf, scoreAnswers(bf, answers2));
  check('BF 全低分 → 五特质 20', r2.traits.every((t) => t.raw === 20), JSON.stringify(r2.traits.map((t) => t.raw)));
  check('BF 全低分 → 全部「低」段', r2.traits.every((t) => t.band === '低'));

  // 中间值：全 3 分 → 60 分 → 「中等偏高」(59-74)
  const answers3 = bf.questions.map(() => '3');
  const r3 = computeResult(bf, scoreAnswers(bf, answers3));
  check('BF 全 3 分 → 60 分', r3.traits.every((t) => t.raw === 60));
  check('BF 60 分 → 中等偏高', r3.traits.every((t) => t.band === '中等偏高'), JSON.stringify(r3.traits.map((t) => t.band)));
}

check('dimMaxAbs MBTI = 36', dimMaxAbs(mbti).EI === 36);
check('dimMaxAbs 16P = 24', dimMaxAbs(p16).MI === 24);
check('dimMaxAbs BF = 100', dimMaxAbs(bf).O === 100);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
