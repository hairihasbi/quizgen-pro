
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { quiz, showAnswer, mode } = req.body;
  if (!quiz) return res.status(400).send('Quiz data missing');
  const isKisiKisi = mode === 'kisi-kisi';

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    });

    const page = await browser.newPage();

    const mapLevel = (lvl: string) => {
      if (!lvl) return '-';
      const l = lvl.toUpperCase();
      if (l.includes('C1') || l.includes('C2')) return 'L1';
      if (l.includes('C3')) return 'L2';
      if (l.includes('C4') || l.includes('C5') || l.includes('C6')) return 'L3 (HOTS)';
      return lvl;
    };

    const typeOrder = [
      'Pilihan Ganda',
      'Pilihan Ganda Kompleks',
      'Benar/Salah',
      'Isian Singkat',
      'Uraian/Essay'
    ];

    const sortedQuestions = [...(quiz.questions || [])].sort((a, b) => {
      return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
    });

    const groupByType = (questions: any[]) => {
      const groups: Record<string, any[]> = {};
      questions.forEach(q => {
        if (!groups[q.type]) groups[q.type] = [];
        groups[q.type].push(q);
      });
      return groups;
    };

    const grouped = groupByType(sortedQuestions);
    let globalCounter = 0;

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
      <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap');
        body { font-family: 'Noto Serif', serif; margin: 0; padding: 0; background: white; color: black; line-height: 1.4; }
        .page { padding: 15mm; box-sizing: border-box; min-height: 297mm; }
        .header { text-align: center; margin-bottom: 5px; }
        .header h1 { margin: 0; font-size: 14pt; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; }
        .header-line { border-top: 3px solid black; border-bottom: 1px solid black; height: 4px; margin: 10px 0 15px 0; }
        .student-id { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 25px; }
        .student-id td { padding: 4px 0; font-weight: 700; }
        .type-header { background: #f3f4f6; padding: 6px 15px; border-top: 2px solid black; border-bottom: 2px solid black; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 11pt; text-transform: uppercase; margin: 25px 0 15px 0; }
        .question-item { margin-bottom: 20px; page-break-inside: avoid; display: flex; gap: 10px; font-size: 10.5pt; }
        .q-num { font-weight: 700; min-width: 25px; text-align: right; }
        .q-body { flex: 1; text-align: justify; }
        .passage { background: #f9f9f9; border: 1.5px solid #000; padding: 12px; margin: 10px 0; font-style: italic; font-size: 10pt; page-break-inside: avoid; }
        .q-image { margin: 10px 0; max-width: 100%; border-radius: 8px; border: 1px solid #ddd; }
        .options-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 30px; row-gap: 3px; margin-top: 8px; }
        .option-item { display: flex; gap: 8px; align-items: flex-start; }
        .opt-label { font-weight: 700; min-width: 15px; }
        .kisi-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
        .kisi-table th, .kisi-table td { border: 1px solid black; padding: 6px; vertical-align: top; }
        .kisi-table th { background: #eeeeee; font-weight: 800; text-align: center; }
        .footer { margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; font-size: 7pt; color: #999; display: flex; justify-content: space-between; font-style: italic; }
      </style>
    </head>
    <body>
      <div id="pdf-root" class="page">
        <div class="header">
          <h1>NASKAH SOAL EVALUASI HASIL BELAJAR</h1>
          <h2>${(quiz.subject || '').toUpperCase()} - ${(quiz.grade || '').toUpperCase()}</h2>
        </div>
        <div class="header-line"></div>

        ${!isKisiKisi ? `
          <table class="student-id">
            <tr>
              <td width="15%">Nama Siswa</td><td width="2%">:</td><td style="border-bottom: 1px dotted #ccc;"></td>
              <td width="15%" align="right">Hari / Tanggal</td><td width="2%">:</td><td width="20%" style="border-bottom: 1px dotted #ccc;"></td>
            </tr>
          </table>
        ` : ''}

        ${isKisiKisi ? `
          <div style="text-align:center; text-decoration:underline; font-weight:800; font-family:'Plus Jakarta Sans'; margin-bottom:20px;">MATRIKS KISI-KISI SOAL</div>
          <table class="kisi-table">
            <thead>
              <tr><th>NO</th><th>KD / CP</th><th>MATERI</th><th>INDIKATOR</th><th>LEVEL</th><th>BENTUK</th><th>NO</th><th>KUNCI</th></tr>
            </thead>
            <tbody>
              ${sortedQuestions.map((q: any, i: number) => `
                <tr>
                  <td align="center">${i + 1}</td>
                  <td>${q.competency || '-'}</td>
                  <td>${q.topic}</td>
                  <td>${q.indicator}</td>
                  <td align="center">${mapLevel(q.cognitiveLevel)}</td>
                  <td align="center">${q.type}</td>
                  <td align="center">${i + 1}</td>
                  <td align="center">${Array.isArray(q.answer) ? q.answer.join(',') : q.answer}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          ${Object.entries(grouped).map(([type, questions], gIdx) => `
            <div class="type-header">${String.fromCharCode(65 + gIdx)}. ${type}</div>
            ${questions.map((q: any, idx: number) => {
              globalCounter++;
              const normalize = (s?: string) => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
              const isNewPassage = q.passage && (idx === 0 || normalize(questions[idx-1].passage) !== normalize(q.passage));
              return `
                ${isNewPassage ? `<div class="passage"><strong>WACANA:</strong><br/>${q.passage}</div>` : ''}
                <div class="question-item">
                  <div class="q-num">${globalCounter}.</div>
                  <div class="q-body">
                    <div>${q.text}</div>
                    ${q.image ? `<img src="${q.image}" class="q-image" style="max-height: 80mm;" />` : ''}
                    ${q.options ? `<div class="options-grid">${q.options.map((opt: any) => `<div class="option-item"><span class="opt-label">${opt.label}.</span><span>${opt.text}</span></div>`).join('')}</div>` : ''}
                    ${showAnswer ? `<div style="margin-top:10px; background:#f0fdf4; padding:5px; border:1px dashed #166534;"><strong>KUNCI: ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</strong><br/><em>${q.explanation}</em></div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          `).join('')}
        `}
        <div class="footer">
          <span>GenZ QuizGen Pro v3.1</span>
          <span>Fingerprint: ${(quiz.id || '').toUpperCase()}</span>
        </div>
      </div>
      <script>
        document.addEventListener("DOMContentLoaded", function() {
          renderMathInElement(document.body, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false},
              {left: '\\(', right: '\\)', display: false},
              {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
          });
        });
      </script>
    </body>
    </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    // Jeda 1 detik untuk memastikan KaTeX selesai rendering di Puppeteer
    await new Promise(r => setTimeout(r, 1000));
    const pdfBuffer = await page.pdf({ format: 'A4', landscape: isKisiKisi, printBackground: true });
    await browser.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
