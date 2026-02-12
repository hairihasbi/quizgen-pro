
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

    // Urutkan soal berdasarkan tipe standar agar penomoran sinkron
    const typeOrder = [
      'Pilihan Ganda',
      'Pilihan Ganda Kompleks',
      'Benar/Salah',
      'Isian Singkat',
      'Uraian/Essay'
    ];

    const sortedQuestions = [...quiz.questions].sort((a, b) => {
      return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
    });

    // Helper untuk grouping yang mempertahankan urutan
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
          position: relative;
        }

        .page {
          padding: 15mm;
          margin: 0 auto;
          box-sizing: border-box;
          position: relative;
          min-height: 297mm;
        }

        .content-wrap {
          position: relative;
          z-index: 10;
        }

        .header { text-align: center; margin-bottom: 5px; }
        .header h1 { margin: 0; font-size: 14pt; font-weight: 800; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; }
        .header h2 { margin: 2px 0; font-size: 11pt; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; }
        .header-line { border-top: 3px solid black; border-bottom: 1px solid black; height: 4px; margin: 10px 0 15px 0; }

        .student-id { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 25px; }
        .student-id td { padding: 4px 0; font-weight: 700; }
        .dot-line { border-bottom: 1px dotted #ccc; color: #999; font-weight: 400; font-style: italic; }

        .type-header { 
          background: #f3f4f6; 
          padding: 6px 15px; 
          border-top: 2px solid black; 
          border-bottom: 2px solid black; 
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: 11pt;
          text-transform: uppercase;
          margin: 25px 0 15px 0;
        }

        .question-item { margin-bottom: 20px; page-break-inside: avoid; display: flex; gap: 10px; font-size: 10.5pt; }
        .q-num { font-weight: 700; min-width: 25px; text-align: right; }
        .q-body { flex: 1; text-align: justify; }
        .passage { background: #f9f9f9; border: 1.5px solid #000; padding: 12px; margin: 10px 0; font-style: italic; font-size: 10pt; page-break-inside: avoid; }

        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 30px;
          row-gap: 3px;
          margin-top: 8px;
        }
        .option-item { display: flex; gap: 8px; align-items: flex-start; }
        .opt-label { font-weight: 700; min-width: 15px; }

        .kisi-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
        .kisi-table th, .kisi-table td { border: 1px solid black; padding: 6px; vertical-align: top; }
        .kisi-table th { background: #eeeeee; font-weight: 800; text-align: center; }

        mjx-container { display: inline-block !important; vertical-align: middle; margin: 0 2px !important; }
        
        .footer-fingerprint {
          margin-top: 30px;
          border-top: 1px solid #eee;
          padding-top: 10px;
          font-size: 7pt;
          color: #999;
          display: flex;
          justify-content: space-between;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="content-wrap">
          <div class="header">
            <h1>NASKAH SOAL EVALUASI HASIL BELAJAR</h1>
            <h2>${quiz.subject.toUpperCase()} - ${quiz.grade.toUpperCase()}</h2>
          </div>
          <div class="header-line"></div>

          <table class="student-id">
            <tr>
              <td width="15%">Nama Siswa</td><td width="2%">:</td><td class="dot-line">.........................................................</td>
              <td width="15%" align="right">Hari / Tanggal</td><td width="2%">:</td><td width="20%" class="dot-line">......................</td>
            </tr>
            <tr>
              <td>Kelas / No. Absen</td><td>:</td><td class="dot-line">.........................................................</td>
              <td align="right">Waktu</td><td>:</td><td class="dot-line">90 Menit</td>
            </tr>
          </table>

          ${isKisiKisi ? `
            <div style="text-align:center; text-decoration:underline; font-weight:800; font-family:'Plus Jakarta Sans'; margin-bottom:20px;">MATRIKS KISI-KISI SOAL</div>
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
                ${sortedQuestions.map((q: any, i: number) => `
                  <tr>
                    <td style="text-align:center;">${i + 1}</td>
                    <td>${q.competency || `Menguasai topik ${q.topic}`}</td>
                    <td style="font-weight:700;">${q.topic}</td>
                    <td>${q.indicator}</td>
                    <td style="text-align:center; font-weight:700;">${mapLevel(q.cognitiveLevel)}</td>
                    <td style="text-align:center;">${q.type}</td>
                    <td style="text-align:center; font-weight:700;">${i + 1}</td>
                    <td style="text-align:center; font-weight:700;">${Array.isArray(q.answer) ? q.answer.join(',') : q.answer}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            ${Object.entries(grouped).map(([type, questions], gIdx) => `
              <div class="type-header">${String.fromCharCode(65 + gIdx)}. ${type}</div>
              <div class="questions">
                ${questions.map((q: any) => {
                  globalCounter++;
                  const isNewPassage = q.passage && (questions.indexOf(q) === 0 || questions[questions.indexOf(q)-1].passage !== q.passage);
                  return `
                    ${isNewPassage ? `<div class="passage"><strong>WACANA STIMULUS:</strong><br/>${q.passage}</div>` : ''}
                    <div class="question-item">
                      <div class="q-num">${globalCounter}.</div>
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
            `).join('')}
          `}
          
          <div class="footer-fingerprint">
            <span>Verified Educational Asset by GenZ QuizGen Pro v3.1</span>
            <span>Fingerprint: ${quiz.id.toUpperCase()} • Generated on ${new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      
      <!-- INVISIBLE PLAGIARISM MARKER -->
      <div style="position:fixed; top:0; left:0; width:1px; height:1px; color:rgba(0,0,0,0.01); font-size:1px; overflow:hidden;">
        SECURE_DOCUMENT_ID:${quiz.id};AUTHOR:${quiz.authorName};DISTRIBUTION_LOCK:ENABLED;
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
