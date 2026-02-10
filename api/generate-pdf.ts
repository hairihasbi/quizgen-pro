
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { quiz, exportMode, showAnswer } = req.body;

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Konstruksi Template HTML Internal yang kaku (A4)
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Amiri&display=swap');
        
        body { 
          font-family: 'Plus Jakarta Sans', sans-serif; 
          margin: 0; padding: 0; background: white; color: black;
          -webkit-print-color-adjust: exact;
        }

        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 22mm;
          margin: 0 auto;
          box-sizing: border-box;
          position: relative;
        }

        .header {
          border-bottom: 4px double black;
          text-align: center;
          padding-bottom: 10px;
          margin-bottom: 20px;
          text-transform: uppercase;
        }

        .header h1 { margin: 0; font-size: 20pt; font-weight: 800; }
        .header p { margin: 5px 0 0; font-size: 10pt; font-weight: 700; color: #555; }

        .identitas {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 10pt;
          font-weight: 700;
        }

        .identitas td {
          border: 2px solid black;
          padding: 8px 12px;
        }

        .question-block {
          margin-bottom: 15px;
          page-break-inside: avoid;
          display: flex;
          gap: 15px;
          font-size: 11pt;
          line-height: 1.6;
        }

        .q-num { font-weight: 800; width: 25px; shrink: 0; }
        .q-content { flex: 1; }
        .options-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 5px;
          margin-top: 10px;
        }
        .option-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .opt-label {
          border: 1.5px solid black;
          width: 22px; height: 22px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 9pt; border-radius: 4px;
        }

        .passage {
          background: #f9f9f9;
          border-left: 5px solid #ccc;
          padding: 15px;
          margin-bottom: 20px;
          font-style: italic;
          text-align: justify;
          font-size: 10.5pt;
        }

        .answer-key {
          margin-top: 10px;
          padding: 10px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          font-size: 9pt;
        }

        /* MathJax Adjustments */
        mjx-container { display: inline-block !important; vertical-align: middle; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <h1>${quiz.title}</h1>
          <p>${quiz.subject} | ${quiz.level} ${quiz.grade}</p>
        </div>

        <table class="identitas">
          <tr>
            <td width="50%">NAMA : ________________________</td>
            <td>HARI / TGL : ____________________</td>
          </tr>
          <tr>
            <td>KELAS : ________________________</td>
            <td>NO. ABSEN : ___________________</td>
          </tr>
        </table>

        <div class="questions">
          ${quiz.questions.map((q: any, i: number) => `
            <div class="question-block">
              <div class="q-num">${i + 1}.</div>
              <div class="q-content">
                ${q.passage ? `<div class="passage">${q.passage}</div>` : ''}
                <div class="text">${q.text}</div>
                ${q.options ? `
                  <div class="options-grid">
                    ${q.options.map((opt: any) => `
                      <div class="option-item">
                        <span class="opt-label">${opt.label}</span>
                        <span>${opt.text}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                ${showAnswer ? `
                  <div class="answer-key">
                    <strong>KUNCI: ${q.answer}</strong><br/>
                    <em>${q.explanation}</em>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <script>
        // Memastikan MathJax selesai sebelum Puppeteer mengambil PDF
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
    
    // Tunggu MathJax selesai merender SVG
    await page.waitForSelector('.mjx-ready', { timeout: 10000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quiz.pdf`);
    res.send(pdfBuffer);

  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ message: error.message });
  }
}
