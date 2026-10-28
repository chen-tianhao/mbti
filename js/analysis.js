/* analysis.js — 认知功能库与三种结果的分析文案组装 */

export const COG = {
  Ni: { name: '内倾直觉', desc: '无意识整合信息，捕捉本质与未来趋势，形成顿悟式结论。' },
  Ne: { name: '外倾直觉', desc: '快速发散出多种可能性，看到事物之间隐藏的关联。' },
  Si: { name: '内倾感觉', desc: '依靠过去经验与记忆建立内在参照，重视细节、稳定与连续性。' },
  Se: { name: '外倾感觉', desc: '敏锐感知当下环境，行动力强，享受即时体验与感官刺激。' },
  Ti: { name: '内倾思考', desc: '追求内部逻辑自洽，构建精准的概念框架，分析入微。' },
  Te: { name: '外倾思考', desc: '关注外部效率与结果，善于组织资源、制定流程与达成目标。' },
  Fi: { name: '内倾情感', desc: '拥有强烈的个人价值观与道德准则，追求内在真实与意义感。' },
  Fe: { name: '外倾情感', desc: '敏锐感知他人情绪与群体氛围，善于维护和谐、照顾他人感受。' },
};

const ROLE_WORD = ['主导功能', '辅助功能', '第三功能', '劣势功能'];

/** MBTI：核心特征 / 认知功能 / 优势与成长 */
export function buildMbtiAnalysis(result) {
  const t = result.type;
  const stack = (t.cognitiveStack || '').split('-').filter(Boolean);
  const blocks = [];

  blocks.push({
    title: '核心特征',
    body: `${t.summary}${stack.length ? `你的主导功能是 ${stack[0]}（${COG[stack[0]]?.name || ''}），它决定了你最自然的信息处理与行动模式。` : ''}`,
  });

  if (stack.length) {
    const lines = stack.map((fn, i) => `${ROLE_WORD[i]} ${fn}（${COG[fn]?.name || ''}）：${COG[fn]?.desc || ''}`);
    blocks.push({ title: '认知功能栈', body: lines.join('\n') });
  }

  const dom = stack[0];
  const inf = stack[3];
  blocks.push({
    title: '优势与成长方向',
    body:
      `优势：${COG[dom]?.desc || '拥有稳定的内在驱动力与清晰的个人风格。'}` +
      (inf ? ` 需要留意：劣势功能 ${inf}（${COG[inf]?.name || ''}）是压力下的盲区——` +
      `过度消耗时容易出现它的失控表现（如突然变得冲动、焦虑或过度在意外界评价）。成长方向不是消灭它，而是通过日常小练习让它从盲区变成可控区。` : ''),
  });

  return blocks;
}

/** 16P：角色解读 + Identity 说明 + 维度 */
export function build16pAnalysis(result) {
  const r = result.role;
  const idDesc =
    result.identity === 'A'
      ? '坚决型（A）：情绪平稳、自信从容、抗压性强，不易被外界评价左右，对现状较满意。'
      : '谨慎型（T）：自我要求高、对压力与评价更敏感、容易反复反思，常被“做得更好”驱动，也更容易持续进步。';

  return [
    { title: '核心特征', body: `${r.summary}（${r.group} · ${r.name}）` },
    {
      title: 'Identity 维度',
      body: `${idDesc}\n你的结果后缀是 -${result.identity}，它描述的不是能力高低，而是你面对压力与自我评价时的典型反应方式。`,
    },
    {
      title: '如何看待这份结果',
      body:
        '前四个维度描述你获取能量、处理信息、做决定与安排生活的方式；Identity 描述你对自身状态的反应。' +
        '两者组合起来才是完整的你。如果某个维度接近中点，说明你在该维度上较为灵活，不需要强行给自己贴标签。',
    },
  ];
}

/** 大五：逐特质分段解读 */
export function buildBigFiveAnalysis(result) {
  const blocks = result.traits.map((t) => ({
    title: `${t.name}（${t.nameEn}）· ${t.band}`,
    body: t.desc,
  }));
  blocks.push({
    title: '如何使用这份画像',
    body:
      '大五人格的五个特质是相互独立的维度，没有“好类型/坏类型”之分。' +
      '每个特质的高低都有其适应场景——关键在于了解自己的默认设置，在需要的时候有意识地调整。' +
      '若得分集中在中段，说明你在该特质上情境适应性较强。',
  });
  return blocks;
}

export function buildAnalysis(result) {
  if (result.kind === 'mbti') return buildMbtiAnalysis(result);
  if (result.kind === '16personalities') return build16pAnalysis(result);
  return buildBigFiveAnalysis(result);
}
