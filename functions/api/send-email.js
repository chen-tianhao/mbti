/**
 * Cloudflare Pages Function — POST /api/send-email
 * 通过 Resend 发送 PDF 报告，发件人固定（可用环境变量 FROM_EMAIL 覆盖）。
 *
 * 【发件人配置步骤】
 * 1. resend.com 注册 → Add Domain（建议 mail.你的域名.com）
 * 2. 在 DNS 服务商（Cloudflare DNS）添加 Resend 给出的 DKIM + SPF 记录并验证
 * 3. Resend → API Keys → Create API Key（权限 Sending），复制
 * 4. Cloudflare Pages → 项目 → Settings → Environment variables：
 *      RESEND_API_KEY = <你的 API Key>（标记 Secret）
 *      FROM_EMAIL     = 心镜测评 <noreply@mail.你的域名.com>（可选，默认见下）
 * 5. 重新部署一次使环境变量生效
 *
 * 注意：API Key 只存在于服务端环境变量，前端永远不接触它。
 * 建议在 Cloudflare WAF 里给 /api/send-email 配一条限频规则（如每 IP 每小时 5 次）。
 */

const MAX_PDF_BYTES = 6 * 1024 * 1024; // base64 约 8MB 原文上限，防止滥用
const DEFAULT_FROM = '心镜测评 <noreply@mail.mindmirror.example>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const { to, name, gender, age, subject, pdfBase64 } = payload || {};

  if (!to || !EMAIL_RE.test(String(to))) return json({ error: '收件邮箱格式不正确' }, 400);
  if (!name || String(name).trim().length < 1 || String(name).length > 60) return json({ error: '姓名无效' }, 400);
  if (!['男', '女', '不便透露'].includes(gender)) return json({ error: '性别无效' }, 400);
  const ageNum = Number(age);
  if (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > 120) return json({ error: '年龄无效' }, 400);
  if (!pdfBase64 || typeof pdfBase64 !== 'string') return json({ error: '缺少 PDF 内容' }, 400);
  if (pdfBase64.length > MAX_PDF_BYTES) return json({ error: 'PDF 文件过大' }, 413);

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return json({ error: '服务端未配置 RESEND_API_KEY' }, 500);

  const from = env.FROM_EMAIL || DEFAULT_FROM;
  const safeSubject = String(subject || `${name} 的人格测评报告`).slice(0, 120);

  const html = `
    <div style="font-family:sans-serif;line-height:1.7;color:#221D33">
      <h2 style="color:#6C5CE7">你的测评报告已生成</h2>
      <p>${escapeHtml(String(name))}，你好：</p>
      <p>感谢完成测评。你的 PDF 报告见附件。</p>
      <p style="color:#6B6580;font-size:13px">
        姓名：${escapeHtml(String(name))}　性别：${escapeHtml(String(gender))}　年龄：${ageNum}<br/>
        本报告仅供自我探索参考，不构成任何临床诊断或专业建议。
      </p>
      <p style="color:#9B95AD;font-size:12px">— 心镜测评（本邮件由系统自动发出，请勿直接回复）</p>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [String(to)],
        subject: safeSubject,
        html,
        attachments: [
          {
            filename: `${String(name).replace(/[^\w\u4e00-\u9fa5-]/g, '_')}-人格测评报告.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Resend error:', res.status, out);
      return json({ error: '邮件发送失败，请稍后重试' }, 502);
    }
    return json({ ok: true, id: out.id || null });
  } catch (err) {
    console.error('send-email failed:', err);
    return json({ error: '邮件服务暂时不可用' }, 502);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
