/* pdf.js — 前端生成 PDF（html2canvas + jsPDF，支持中文字形） */

const CDN = {
  html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const exist = document.querySelector(`script[src="${src}"]`);
    if (exist) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`脚本加载失败：${src}`));
    document.head.appendChild(s);
  });
}

/** 组装报告画布区域（不含表单），生成 PDF 并返回 base64（无 data: 前缀） */
export async function generatePdfBase64() {
  await loadScript(CDN.html2canvas);
  await loadScript(CDN.jspdf);

  // 把结果区克隆进离屏容器，统一白底排版
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;background:#fff;padding:36px 40px;font-family:"Noto Sans SC",sans-serif;';
  for (const id of ['resultHero', 'resultDims', 'resultAnalysis']) {
    const node = document.getElementById(id);
    const clone = node.cloneNode(true);
    clone.style.margin = '0 0 20px 0';
    clone.style.boxShadow = 'none';
    clone.style.borderRadius = '12px';
    wrap.appendChild(clone);
  }
  document.body.appendChild(wrap);

  try {
    const canvas = await window.html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    let heightLeft = imgH;
    let position = margin;
    pdf.addImage(imgData, 'JPEG', margin, position, imgW, imgH);
    heightLeft -= pageH - margin * 2;
    while (heightLeft > 0.5) {
      position = heightLeft - imgH + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgW, imgH);
      heightLeft -= pageH - margin * 2;
    }
    return pdf.output('datauristring').split(',')[1];
  } finally {
    wrap.remove();
  }
}
