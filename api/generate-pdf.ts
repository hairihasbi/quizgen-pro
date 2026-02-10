
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { quiz, showAnswer } = req.body;

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    });

    const page = await browser.newPage();

    // Template HTML High-Quality untuk PDF
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap');
        
        body { 
          font-family: 'Noto Serif', serif; 
          margin: 0; padding: 0; background: white; color: black;
          -webkit-print-color-adjust: exact;
        }

        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 20mm 15mm;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .header { text-align: center; margin-bottom: 5px; }
        .header h1 { margin: 0; font-size: 16pt; font-weight: 800; text-transform: uppercase; font-family: 'Plus Jakarta Sans', sans-serif; }
        .header h2 { margin: 5px 0; font-size: 13pt; font-weight: 700; text-transform: uppercase; font-family: 'Plus Jakarta Sans', sans-serif; }
        .header-line { border-top: 3px solid black; border-bottom: 1px solid black; height: 4px; margin: 10px 0 20px 0; }

        .info-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 20px; font-weight: 700; }
        .info-table td { padding: 3px 0; }

        .section-title { font-size: 11pt; font-weight: 800; text-decoration: underline; text-transform: uppercase; margin-bottom: 15px; text-align: center; font-family: 'Plus Jakarta Sans', sans-serif; }

        .question-item { margin-bottom: 20px; page-break-inside: avoid; display: flex; gap: 10px; font-size: 11pt; line-height: 1.5; }
        .q-num { font-weight: 700; min-width: 25px; text-align: right; }
        .q-body { flex: 1; text-align: justify; }
        
        .passage { background: #f9f9f9; border: 1px solid #000; padding: 15px; margin: 10px 0 20px 0; font-style: italic; font-size: 10pt; }

        .option { display: flex; gap: 8px; margin-top: 4px; }
        .opt-label { font-weight: 700; min-width: 18px; }

        .answer-key { margin-top: 10px; padding: 10px; background: #f0f0f0; border: 1px dashed #666; font-size: 9pt; }

        mjx-container { display: inline-block !important; vertical-align: middle; margin: 0 2px; }
        .mjx-ready body { opacity: 1 !important; }
        body { opacity: 0; transition: opacity 0.5s; }
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
            <td width="15%">Topik</td><td width="2%">:</td><td width="43%">${quiz.topic}</td>
            <td width="15%" align="right">Waktu</td><td width="2%">:</td><td width="23%">90 Menit</td>
          </tr>
          <tr>
            <td>Jenjang</td><td>:</td><td>${quiz.level}</td>
            <td align="right">Jumlah</td><td>:</td><td>${quiz.questions.length} Soal</td>
          </tr>
        </table>

        <div class="section-title">URAIAN SOAL</div>

        <div class="questions">
          ${quiz.questions.map((q: any, i: number) => {
            const isNewPassage = q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage);
            return `
              ${isNewPassage ? `<div class="passage"><strong>STIMULUS:</strong><br/>${q.passage}</div>` : ''}
              <div class="question-item">
                <div class="q-num">${i + 1}.</div>
                <div class="q-body">
                  <div>${q.text}</div>
                  ${q.options ? `
                    <div style="margin-top: 8px;">
                      ${q.options.map((opt: any) => `
                        <div class="option">
                          <span class="opt-label">${opt.label}.</span>
                          <span>${opt.text}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                  ${showAnswer ? `
                    <div class="answer-key">
                      <strong>KUNCI: ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}</strong><br/>
                      <em>Pembahasan: ${q.explanation}</em>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <script>
        window.MathJax = {
          startup: {
            pageReady: () => {
              return MathJax.startup.defaultPageReady().then(() => {
                document.body.classList.add('mjx-ready');
              });
            }
          }
        };
      </script>
    </body>
    </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Tunggu Rendering MathJax (Ditambah menjadi 30 detik untuk soal kompleks)
    try {
      await page.waitForSelector('.mjx-ready', { timeout: 30000 });
    } catch (e) {
      console.warn("MathJax timeout, continuing with current render.");
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Quiz_${quiz.title.replace(/\s+/g, '_')}.pdf`);
    res.send(pdfBuffer);

  } catch (error: any) {
    console.error('PDF SSR Error:', error);
    res.status(500).json({ message: error.message });
  }
}
