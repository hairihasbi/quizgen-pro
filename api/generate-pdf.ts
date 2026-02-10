
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { quiz, showAnswer, mode } = req.body;
  const isKisiKisi = mode === 'kisi-kisi';

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    });

    const page = await browser.newPage();

    // Mapping Level Kognitif Helper
    const mapLevel = (lvl: string) => {
      const l = lvl.toUpperCase();
      if (l.includes('C1') || l.includes('C2')) return 'L1';
      if (l.includes('C3')) return 'L2';
      if (l.includes('C4') || l.includes('C5') || l.includes('C6')) return 'L3 (HOTS)';
      return lvl;
    };

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <script>
        window.MathJax = {
          tex: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
          svg: { fontCache: 'none' },
          startup: {
            typeset: false,
            ready: () => {
              MathJax.startup.defaultReady();
              window.mathjaxReady = MathJax.typesetPromise();
            }
          }
        };
      </script>
      <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap');
        
        body { 
          font-family: 'Noto Serif', serif; 
          margin: 0; padding: 0; background: white; color: black;
          line-height: 1.4;
        }

        .page {
          padding: 15mm;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .header { text-align: center; margin-bottom: 5px; }
        .header h1 { margin: 0; font-size: 15pt; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif; }
        .header h2 { margin: 3px 0; font-size: 12pt; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; }
        .header-line { border-top: 3px solid black; border-bottom: 1px solid black; height: 4px; margin: 10px 0 20px 0; }

        .info-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 15px; font-weight: 700; }
        .info-table td { padding: 3px 0; }
        .section-title { font-size: 11pt; font-weight: 800; text-decoration: underline; text-transform: uppercase; margin-bottom: 20px; text-align: center; font-family: 'Plus Jakarta Sans', sans-serif; }

        /* Styles for Questions */
        .question-item { margin-bottom: 20px; page-break-inside: avoid; display: flex; gap: 10px; font-size: 10.5pt; }
        .q-num { font-weight: 700; min-width: 25px; text-align: right; }
        .q-body { flex: 1; text-align: justify; }
        .passage { background: #f9f9f9; border: 1.5px solid #000; padding: 12px; margin: 10px 0; font-style: italic; font-size: 10pt; page-break-inside: avoid; }

        /* HORIZONTAL OPTIONS LAYOUT */
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 30px;
          row-gap: 3px;
          margin-top: 8px;
        }
        .option-item {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .opt-label { font-weight: 700; min-width: 15px; }

        /* Styles for Matrix Table */
        .kisi-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
        .kisi-table th, .kisi-table td { border: 1px solid black; padding: 6px; vertical-align: top; }
        .kisi-table th { background: #eeeeee; font-weight: 800; text-align: center; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 800; }

        mjx-container { display: inline-block !important; vertical-align: middle; margin: 0 2px !important; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <h1>BANK SOAL KURIKULUM MERDEKA</h1>
          <h2>${quiz.subject.toUpperCase()} - ${quiz.grade.toUpperCase()}</h2>
        </div>
        <div class="header-line"></div>

        <table class="info-table">
          <tr>
            <td width="15%">Mata Pelajaran</td><td width="2%">:</td><td width="43%">${quiz.subject}</td>
            <td width="15%" align="right">Waktu</td><td width="2%">:</td><td width="23%">90 Menit</td>
          </tr>
          <tr>
            <td>Jenjang / Kelas</td><td>:</td><td>${quiz.level} / ${quiz.grade}</td>
            <td align="right">Jumlah Soal</td><td>:</td><td>${quiz.questions.length} Butir</td>
          </tr>
        </table>

        <div class="section-title">${isKisiKisi ? 'MATRIKS KISI-KISI SOAL' : 'DAFTAR BUTIR SOAL'}</div>

        ${isKisiKisi ? `
          <table class="kisi-table">
            <thead>
              <tr>
                <th width="30">NO</th>
                <th width="180">CAPAIAN PEMBELAJARAN (CP) / KD</th>
                <th width="100">MATERI</th>
                <th>INDIKATOR SOAL</th>
                <th width="60">LEVEL</th>
                <th width="70">BENTUK</th>
                <th width="30">NO</th>
                <th width="40">KUNCI</th>
              </tr>
            </thead>
            <tbody>
              ${quiz.questions.map((q: any, i: number) => `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td>${q.competency || `Menguasai konsep pada topik ${q.topic || quiz.topic}`}</td>
                  <td class="font-bold">${q.topic || quiz.topic}</td>
                  <td>${q.indicator}</td>
                  <td class="text-center font-bold">${mapLevel(q.cognitiveLevel)}</td>
                  <td class="text-center">${q.type}</td>
                  <td class="text-center font-bold">${i + 1}</td>
                  <td class="text-center font-bold">${Array.isArray(q.answer) ? q.answer.join(',') : q.answer}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="questions">
            ${quiz.questions.map((q: any, i: number) => {
              const isNewPassage = q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage);
              return `
                ${isNewPassage ? `<div class="passage"><strong>WACANA STIMULUS:</strong><br/>${q.passage}</div>` : ''}
                <div class="question-item">
                  <div class="q-num">${i + 1}.</div>
                  <div class="q-body">
                    <div>${q.text}</div>
                    ${q.options && q.options.length > 0 ? `
                      <div class="options-grid">
                        ${q.options.map((opt: any) => `
                          <div class="option-item">
                            <span class="opt-label">${opt.label}.</span>
                            <span>${opt.text}</span>
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}
                    ${showAnswer ? `<div style="margin-top:10px; padding:8px; background:#f0fdf4; border:1px dashed #166534; font-size:9pt;">
                      <strong>KUNCI: ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</strong><br/>
                      <em>Pembahasan: ${q.explanation}</em>
                    </div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </body>
    </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    await page.evaluate(async () => {
      if ((window as any).mathjaxReady) await (window as any).mathjaxReady;
    });

    await new Promise(r => setTimeout(r, 2500));

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: isKisiKisi,
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
    });

    await browser.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);

  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
