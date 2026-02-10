
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { quiz, showAnswer } = req.body;

  try {
    // Fixed: Using any casting for defaultViewport and headless to bypass type check errors
    // while maintaining compatibility with @sparticuz/chromium runtime properties.
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless,
    });

    const page = await browser.newPage();

    // Template HTML untuk layout "Bank Soal Formal SMA"
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
          padding: 25mm 20mm;
          margin: 0 auto;
          box-sizing: border-box;
          position: relative;
        }

        /* HEADER / KOP SURAT */
        .header {
          text-align: center;
          margin-bottom: 5px;
        }
        .header h1 { 
          margin: 0; 
          font-size: 18pt; 
          font-weight: 800; 
          text-transform: uppercase; 
          letter-spacing: 1px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .header h2 { 
          margin: 5px 0; 
          font-size: 14pt; 
          font-weight: 700; 
          text-transform: uppercase; 
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .header-line {
          border: none;
          border-top: 3px solid black;
          border-bottom: 1px solid black;
          height: 4px;
          margin: 15px 0;
        }

        /* INFO TABLE */
        .info-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5pt;
          margin-bottom: 25px;
          font-weight: 600;
        }
        .info-table td {
          padding: 4px 0;
          vertical-align: top;
        }
        .info-table .label { width: 80px; }
        .info-table .separator { width: 15px; text-align: center; }

        /* SECTION TITLE */
        .section-title {
          font-size: 11pt;
          font-weight: 800;
          text-decoration: underline;
          text-transform: uppercase;
          margin-bottom: 20px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        /* QUESTION BLOCK */
        .questions {
          width: 100%;
        }
        .question-item {
          margin-bottom: 20px;
          page-break-inside: avoid;
          display: flex;
          gap: 12px;
          font-size: 11.5pt;
          line-height: 1.6;
        }
        .q-num { font-weight: 700; min-width: 25px; text-align: right; }
        .q-body { flex: 1; text-align: justify; }
        
        .passage {
          background: #fdfdfd;
          border-left: 4px solid #333;
          padding: 15px;
          margin: 10px 0 20px 0;
          font-style: italic;
          font-size: 10.5pt;
        }

        .options-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 10px;
        }
        .option {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .opt-label { font-weight: 700; min-width: 20px; }

        .answer-key {
          margin-top: 15px;
          padding: 12px;
          background: #f8f8f8;
          border: 1px dashed #ccc;
          font-size: 9.5pt;
          color: #444;
        }

        /* MathJax Styling */
        mjx-container { 
          display: inline-block !important; 
          vertical-align: middle; 
          margin: 0 2px;
        }

        .dotted-line {
          border-bottom: 1px dotted #aaa;
          margin-top: 10px;
          height: 10px;
          width: 100%;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <h1>BANK SOAL SMA</h1>
          <h2>${quiz.subject.toUpperCase()} - ${quiz.grade.toUpperCase()}</h2>
        </div>
        
        <div class="header-line"></div>

        <table class="info-table">
          <tr>
            <td class="label">Topik</td>
            <td class="separator">:</td>
            <td>${quiz.topic}</td>
            <td class="label" style="text-align: right;">Waktu</td>
            <td class="separator">:</td>
            <td style="width: 80px;">90 Menit</td>
          </tr>
          <tr>
            <td class="label">Kode</td>
            <td class="separator">:</td>
            <td>261419</td>
            <td class="label" style="text-align: right;">Jumlah</td>
            <td class="separator">:</td>
            <td>${quiz.questions.length} Soal</td>
          </tr>
        </table>

        <div class="section-title">URAIAN</div>

        <div class="questions">
          ${quiz.questions.map((q: any, i: number) => {
            const isNewPassage = q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage);
            return `
              ${isNewPassage ? `<div class="passage">${q.passage}</div>` : ''}
              <div class="question-item">
                <div class="q-num">${i + 1}.</div>
                <div class="q-body">
                  <div class="q-text">${q.text}</div>
                  ${q.options ? `
                    <div class="options-grid">
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
                  ` : `<div class="dotted-line"></div>`}
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
    
    // Tunggu MathJax selesai merender SVG sebelum snapshot PDF diambil
    await page.waitForSelector('.mjx-ready', { timeout: 15000 });

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
