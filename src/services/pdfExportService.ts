import katex from 'katex';
import { GeneratedAIQuestion, ExamStructureConfig, MatrixCellSpecification } from '../types/aiExam';
import { Exam, Matrix, Question } from '../types';
import { getQuestionStatements, NormalizedStatement } from './docxExportService';
import { buildCV7991Data, renderCV7991MatrixHtml, renderCV7991SpecificationHtml, CV7991Data } from '../lib/cv7991MatrixHelper';

/**
 * Replaces LaTeX math delimiters with KaTeX rendered HTML for PDF generation
 */
export function renderMathInHtml(text: string | null | undefined): string {
  if (!text) return '';

  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$(?:\\\$|[^\$\n])+?\$|\\\([\s\S]*?\\\))/g;

  return String(text).replace(regex, (match) => {
    let isBlock = false;
    let math = '';

    if (match.startsWith('$$') && match.endsWith('$$')) {
      isBlock = true;
      math = match.slice(2, -2).trim();
    } else if (match.startsWith('\\[') && match.endsWith('\\]')) {
      isBlock = true;
      math = match.slice(2, -2).trim();
    } else if (match.startsWith('$') && match.endsWith('$')) {
      isBlock = false;
      math = match.slice(1, -1).trim();
    } else if (match.startsWith('\\(') && match.endsWith('\\)')) {
      isBlock = false;
      math = match.slice(2, -2).trim();
    }

    try {
      return katex.renderToString(math, {
        displayMode: isBlock,
        throwOnError: false,
        strict: false,
        output: 'html',
      });
    } catch (e) {
      return match;
    }
  });
}

export function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Creates printable HTML and triggers print preview with reliable fallback
 */
export function triggerPrintPdf(htmlContent: string, title: string, options?: { landscape?: boolean }) {
  const isLandscape = options?.landscape ?? false;
  const pageCss = isLandscape
    ? `@page { size: A4 landscape; margin: 10mm 10mm 10mm 10mm; }`
    : `@page { size: A4 portrait; margin: 16mm 14mm 16mm 14mm; }`;

  const fullDoc = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    ${pageCss}
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 13pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 16px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .header-table td {
      vertical-align: top;
      padding: 2px 4px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    
    .exam-title {
      font-size: 15pt;
      font-weight: bold;
      text-align: center;
      margin: 10px 0 6px 0;
    }
    .student-info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 16px 0;
      border: 1px solid #000;
    }
    .student-info-table td {
      padding: 6px 10px;
      border: 1px solid #000;
      font-size: 12pt;
    }
    .exam-code-box {
      width: 130px;
      text-align: center;
      background-color: #f8fafc;
      font-weight: bold;
    }
    .exam-code-num {
      font-size: 18pt;
      font-weight: bold;
    }

    .part-header {
      margin-top: 16px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }
    .part-title {
      font-size: 13.5pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    .part-instructions {
      font-size: 12pt;
      font-style: italic;
      margin-bottom: 8px;
    }

    .question-block {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .question-content {
      font-size: 13pt;
      margin-bottom: 6px;
      text-align: justify;
    }
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 20px;
      margin-left: 12px;
      margin-bottom: 8px;
    }
    .option-item {
      font-size: 12.5pt;
    }

    .true-false-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 12px 0;
      page-break-inside: avoid;
    }
    .true-false-table th, .true-false-table td {
      border: 1px solid #333;
      padding: 6px 10px;
      font-size: 12.5pt;
      vertical-align: middle;
    }
    .true-false-table th {
      background-color: #f3f4f6;
      font-weight: bold;
    }

    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      page-break-inside: avoid;
    }
    .matrix-table th, .matrix-table td {
      border: 1px solid #000;
      padding: 6px 8px;
      font-size: 11.5pt;
    }
    .matrix-table th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
      margin-top: 24px;
    }
    .footer-end {
      text-align: center;
      font-weight: bold;
      margin: 28px 0 12px 0;
      font-size: 12pt;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: fixed; top: 12px; right: 12px; z-index: 9999; background: #fff; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; gap: 8px;">
    <button onclick="window.print()" style="font-family: inherit; font-size: 13px; font-weight: bold; padding: 8px 16px; background: #4f46e5; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
      🖨️ Lưu file PDF / In ngay
    </button>
    <button onclick="window.close()" style="font-family: inherit; font-size: 13px; font-weight: 500; padding: 8px 14px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
      Đóng
    </button>
  </div>
  ${htmlContent}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
  `;

  // Try opening in new tab/window
  const printWindow = window.open('', '_blank', 'width=950,height=850');
  if (printWindow && !printWindow.closed) {
    try {
      printWindow.document.open();
      printWindow.document.write(fullDoc);
      printWindow.document.close();
      return;
    } catch (e) {
      console.warn('Direct print window write failed, using iframe fallback:', e);
    }
  }

  // Fallback for iframe environments where window.open is blocked by the host
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(fullDoc);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 3000);
    }, 600);
  }
}

/**
 * Builds HTML string for exam questions
 */
function renderExamQuestionsHtml(
  questions: GeneratedAIQuestion[] | Question[],
  structure?: ExamStructureConfig
): string {
  let bodyHtml = '';
  const parts = [1, 2, 3, 4];
  let currentOrder = 1;

  parts.forEach((partNum) => {
    const partQuestions = (questions as any[]).filter((q) => (q.exam_part || 1) === partNum);
    if (partQuestions.length === 0) return;

    const partConfig = structure?.parts.find((p) => p.part === partNum);
    const partTitle = partConfig?.title || (
      partNum === 1 ? 'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn' :
      partNum === 2 ? 'PHẦN II. Câu trắc nghiệm đúng sai' :
      partNum === 3 ? 'PHẦN III. Câu trắc nghiệm trả lời ngắn' :
      'PHẦN IV. Tự luận'
    );
    const partInstructions = (partConfig as any)?.instructions || partConfig?.description || (
      partNum === 1 ? 'Thí sinh trả lời từ câu 1 đến câu n. Mỗi câu hỏi thí sinh chỉ chọn một phương án.' :
      partNum === 2 ? 'Thí sinh trả lời từ câu 1 đến câu n. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.' :
      partNum === 3 ? 'Thí sinh trả lời từ câu 1 đến câu n và viết kết quả vào phiếu trả lời.' :
      'Thí sinh trình bày chi tiết lời giải vào tờ giấy thi.'
    );

    bodyHtml += `
      <div class="part-header">
        <div class="part-title">${escapeHtml(partTitle)}</div>
        <div class="part-instructions">${escapeHtml(partInstructions)}</div>
      </div>
    `;

    partQuestions.forEach((q) => {
      const qNum = q.question_order || currentOrder++;
      const points = q.points ? ` (${q.points} điểm)` : '';
      const renderedContent = renderMathInHtml(q.content || '');

      bodyHtml += `
        <div class="question-block">
          <div class="question-content">
            <strong>Câu ${qNum}${points}:</strong> ${renderedContent}
          </div>
      `;

      // Options for Part I
      if (partNum === 1 && q.options && q.options.length > 0) {
        bodyHtml += '<div class="options-grid">';
        q.options.forEach((opt: any, oIdx: number) => {
          const letter = String.fromCharCode(65 + oIdx);
          const optContent = opt.content || opt.statement || opt.text || '';
          const renderedOpt = renderMathInHtml(optContent);
          bodyHtml += `
            <div class="option-item">
              <strong>${letter}.</strong> ${renderedOpt}
            </div>
          `;
        });
        bodyHtml += '</div>';
      }

      // Statements for Part II (True / False) - Uses normalized helper
      if (partNum === 2 || q.question_type === 'true_false') {
        const statements = getQuestionStatements(q);
        if (statements.length > 0) {
          bodyHtml += `
            <table class="true-false-table">
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">Ý</th>
                  <th>Nội dung mệnh đề</th>
                  <th style="width: 90px; text-align: center;">Đúng</th>
                  <th style="width: 90px; text-align: center;">Sai</th>
                </tr>
              </thead>
              <tbody>
          `;
          const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          statements.forEach((st, sIdx) => {
            const letter = labels[sIdx] || String.fromCharCode(97 + sIdx);
            let stText = st.statement.replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, '');
            const renderedStmt = renderMathInHtml(stText);
            bodyHtml += `
              <tr>
                <td style="text-align: center; font-weight: bold;">${letter}</td>
                <td>${renderedStmt}</td>
                <td style="text-align: center;">[  ]</td>
                <td style="text-align: center;">[  ]</td>
              </tr>
            `;
          });
          bodyHtml += '</tbody></table>';
        }
      }

      // Short answer space
      if (q.question_type === 'short_answer' || q.exam_part === 3) {
        bodyHtml += `
          <div style="font-style: italic; color: #475569; margin-left: 12px; margin-bottom: 8px;">
            Trả lời: .....................................................................................................................................................
          </div>
        `;
      }

      // Essay space
      if (q.question_type === 'essay' || q.exam_part === 4) {
        if (q.sub_items && q.sub_items.length > 1) {
          bodyHtml += `
            <div style="margin-left: 12px; margin-top: 6px; margin-bottom: 8px;">
              ${q.sub_items.map((sub: any) => `
                <div style="margin-bottom: 8px;">
                  <div style="font-weight: bold; color: #1e293b;">${escapeHtml(sub.item_number || '')}) ${renderMathInHtml(sub.question_text || '')} <span style="font-weight: normal; color: #64748b;">(${sub.points} điểm)</span></div>
                  <div style="color: #94a3b8; margin-top: 2px; line-height: 1.8;">
                    .....................................................................................................................................................................................................<br>
                    .....................................................................................................................................................................................................
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          bodyHtml += `
            <div style="font-style: italic; font-weight: bold; color: #334155; margin-left: 12px; margin-bottom: 4px;">
              Bài làm:
            </div>
            <div style="color: #94a3b8; margin-left: 12px; margin-bottom: 8px; line-height: 2;">
              .....................................................................................................................................................................................................<br>
              .....................................................................................................................................................................................................
            </div>
          `;
        }
      }

      bodyHtml += '</div>';
    });
  });

  return bodyHtml;
}

/**
 * Builds administrative header HTML
 */
function renderAdministrativeHeader(
  examTitle: string,
  subject: string,
  grade: number,
  duration: number
): string {
  return `
    <table class="header-table">
      <tr>
        <td style="width: 46%; text-align: center;">
          <div class="font-bold">SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
          <div class="font-bold">TRƯỜNG THCS & THPT CHUYÊN KHẢO THÍ</div>
          <div class="font-italic" style="font-size: 11pt;">(Đề thi có ___ trang)</div>
        </td>
        <td style="width: 54%; text-align: center;">
          <div class="font-bold uppercase">KỲ KIỂM TRA ĐỊNH KỲ NĂM HỌC 2026 - 2027</div>
          <div class="font-bold uppercase">MÔN: ${escapeHtml(subject)} - KHỐI ${grade}</div>
          <div class="font-italic" style="font-size: 11.5pt;">Thời gian làm bài: ${duration} phút (không kể thời gian phát đề)</div>
        </td>
      </tr>
    </table>

    <div class="exam-title uppercase">${escapeHtml(examTitle)}</div>

    <table class="student-info-table">
      <tr>
        <td>
          <div style="margin-bottom: 4px;">Họ và tên thí sinh: ........................................................................................................</div>
          <div>Số báo danh: ..................................................... Lớp: ................. Phòng thi: ......................</div>
        </td>
        <td class="exam-code-box">
          <div style="font-size: 11pt;">MÃ ĐỀ THI</div>
          <div class="exam-code-num">101</div>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Export Exam to PDF
 */
export function exportExamToPdf(params: {
  title: string;
  subject: string;
  grade: number;
  durationMinutes: number;
  questions: GeneratedAIQuestion[] | Question[];
  structure?: ExamStructureConfig;
}): void {
  const { title, subject, grade, durationMinutes, questions, structure } = params;

  let bodyHtml = renderAdministrativeHeader(title, subject, grade, durationMinutes);
  bodyHtml += renderExamQuestionsHtml(questions, structure);
  bodyHtml += '<div class="footer-end">----------------------------- HẾT -----------------------------</div>';

  triggerPrintPdf(bodyHtml, `De_thi_${subject}_K${grade}`);
}

/**
 * Export Answers & Rubric to PDF
 */
export function exportAnswersToPdf(params: {
  title: string;
  subject: string;
  grade: number;
  questions: GeneratedAIQuestion[] | Question[];
}): void {
  const { title, subject, grade, questions } = params;

  let bodyHtml = `
    <table class="header-table">
      <tr>
        <td style="width: 46%; text-align: center;">
          <div class="font-bold">SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
          <div class="font-bold">TRƯỜNG THCS & THPT CHUYÊN KHẢO THÍ</div>
        </td>
        <td style="width: 54%; text-align: center;">
          <div class="font-bold uppercase">HƯỚNG DẪN CHẤM VÀ BIỂU ĐIỂM CHI TIẾT</div>
          <div class="font-bold uppercase">MÔN: ${escapeHtml(subject)} - KHỐI ${grade}</div>
        </td>
      </tr>
    </table>

    <div class="exam-title uppercase" style="margin-top: 14px;">ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM ĐỀ KIỂM TRA</div>
    <div class="text-center font-bold uppercase" style="font-size: 13pt; margin-bottom: 16px;">
      ${escapeHtml(title)} (MÔN: ${escapeHtml(subject)} - KHỐI ${grade})
    </div>
  `;

  // Quick Table for Part I (wrapped in tables of at most 10 columns)
  const part1 = (questions as any[]).filter((q) => (q.exam_part || 1) === 1 && q.options && q.options.length > 0);
  if (part1.length > 0) {
    bodyHtml += `<div class="part-title" style="font-size: 12.5pt; margin-top: 14px;">I. BẢNG ĐÁP ÁN TRẮC NGHIỆM NHIỀU LỰA CHỌN (PHẦN I)</div>`;
    
    const chunkSize = 10;
    for (let c = 0; c < part1.length; c += chunkSize) {
      const chunk = part1.slice(c, c + chunkSize);
      bodyHtml += `
        <table class="matrix-table" style="text-align: center; margin-bottom: 12px;">
          <thead>
            <tr>
              ${chunk.map((q, idx) => `<th>Câu ${q.question_order || (c + idx + 1)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr style="font-weight: bold; color: #15803d; font-size: 13pt;">
              ${chunk.map((q) => {
                const cIdx = q.options?.findIndex((o: any) => o.is_correct);
                const letter = cIdx !== -1 && cIdx !== undefined ? String.fromCharCode(65 + cIdx) : '-';
                return `<td>${letter}</td>`;
              }).join('')}
            </tr>
          </tbody>
        </table>
      `;
    }
  }

  // Detailed Solutions
  bodyHtml += `<div class="part-title" style="font-size: 12.5pt; margin-top: 18px;">II. LỜI GIẢI VÀ HƯỚNG DẪN CHẤM CHI TIẾT</div>`;

  let qOrder = 1;
  (questions as any[]).forEach((q) => {
    const num = q.question_order || qOrder++;
    const points = q.points ? ` (${q.points} điểm)` : '';
    const content = renderMathInHtml(q.content || '');
    const explanation = q.explanation ? renderMathInHtml(q.explanation) : '';

    bodyHtml += `
      <div class="question-block" style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 12px;">
        <div><strong>Câu ${num}${points}:</strong> ${content}</div>
    `;

    // Part I correct option
    if (q.options && q.options.length > 0 && (!q.question_type || q.question_type === 'single_choice' || q.question_type === 'multiple_choice')) {
      const correct = q.options.find((o: any) => o.is_correct);
      if (correct) {
        bodyHtml += `<div style="color: #15803d; font-weight: bold; margin-top: 4px;">→ Đáp án đúng: ${renderMathInHtml(correct.content || correct.statement || '')}</div>`;
      }
    }

    // Part II True/False Breakdown Table
    const statements = getQuestionStatements(q);
    if (statements.length > 0) {
      bodyHtml += `
        <div style="font-weight: bold; margin-top: 6px; color: #1e293b;">→ Bảng đáp án các mệnh đề:</div>
        <table class="true-false-table" style="margin-top: 4px;">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">Ý</th>
              <th>Nội dung mệnh đề</th>
              <th style="width: 80px; text-align: center;">Đáp án</th>
              <th style="width: 240px;">Hướng dẫn giải</th>
            </tr>
          </thead>
          <tbody>
      `;
      const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      statements.forEach((st, sIdx) => {
        const letter = labels[sIdx] || String.fromCharCode(97 + sIdx);
        const mark = st.is_correct ? '<span style="color: #15803d; font-weight: bold;">ĐÚNG</span>' : '<span style="color: #dc2626; font-weight: bold;">SAI</span>';
        bodyHtml += `
          <tr>
            <td style="text-align: center; font-weight: bold;">${letter}</td>
            <td>${renderMathInHtml(st.statement)}</td>
            <td style="text-align: center;">${mark}</td>
            <td style="font-size: 11pt; color: #334155;">${renderMathInHtml(st.explanation || 'Theo chuẩn kiến thức.')}</td>
          </tr>
        `;
      });
      bodyHtml += `</tbody></table>`;
    }

    // Short answer
    if (q.short_answer) {
      const shortAns = typeof q.short_answer === 'object' ? q.short_answer.normalized_answer : q.short_answer;
      bodyHtml += `<div style="color: #15803d; font-weight: bold; margin-top: 4px;">→ Đáp số chuẩn: ${escapeHtml(shortAns)}</div>`;
    }

    // Explanation
    if (explanation) {
      bodyHtml += `<div style="margin-top: 4px; color: #334155; line-height: 1.4;"><strong>Lời giải chi tiết:</strong> ${explanation}</div>`;
    }

    // Rubric / Sub-items for Essay
    if (q.sub_items && q.sub_items.length > 1) {
      bodyHtml += `
        <div style="margin-top: 8px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
          <div style="font-weight: bold; color: #1e293b; margin-bottom: 6px;">→ Hướng dẫn chấm chi tiết theo từng ý:</div>
          ${q.sub_items.map((sub: any) => `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 8px;">
              <div style="font-weight: bold; color: #0f172a; font-size: 11pt;">
                Ý ${escapeHtml(sub.item_number || '')}) ${renderMathInHtml(sub.question_text || '')} <span style="color: #4f46e5;">(${sub.points} điểm)</span>
              </div>
              ${sub.expected_answer ? `<div style="color: #15803d; font-weight: bold; margin-top: 4px;">→ Đáp án mong đợi: ${renderMathInHtml(sub.expected_answer)}</div>` : ''}
              ${sub.scoring_rubric && sub.scoring_rubric.length > 0 ? `
                <table class="matrix-table" style="margin-top: 6px;">
                  <thead>
                    <tr><th>Tiêu chí yêu cầu</th><th style="width: 80px; text-align: center;">Điểm</th></tr>
                  </thead>
                  <tbody>
                    ${sub.scoring_rubric.map((r: any) => `
                      <tr>
                        <td>${escapeHtml(r.criterion)}</td>
                        <td style="text-align: center; font-weight: bold; color: #4f46e5;">+${r.points}đ</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (q.essay_rubric && q.essay_rubric.length > 0) {
      bodyHtml += `
        <table class="matrix-table" style="margin-top: 6px;">
          <thead>
            <tr><th>Nội dung / Tiêu chí yêu cầu</th><th style="width: 100px; text-align: center;">Điểm</th></tr>
          </thead>
          <tbody>
            ${q.essay_rubric.map((r: any) => `
              <tr>
                <td>${escapeHtml(r.criterion)}</td>
                <td style="text-align: center; font-weight: bold; color: #4f46e5;">+${r.points}đ</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    bodyHtml += `</div>`;
  });

  triggerPrintPdf(bodyHtml, `Dap_an_${subject}_K${grade}`);
}

/**
 * Export Matrix & Specifications to PDF
 */
export function exportMatrixToPdf(params: {
  title: string;
  subject: string;
  grade: number;
  matrixCells?: MatrixCellSpecification[];
  matrix?: Matrix;
  questions?: GeneratedAIQuestion[] | Question[];
  structure?: ExamStructureConfig;
  durationMinutes?: number;
  cvData?: CV7991Data;
}): void {
  const { title, subject, grade, matrixCells, matrix, questions, structure, durationMinutes = 90, cvData: passedCvData } = params;

  const cvData = passedCvData || buildCV7991Data({
    title,
    subject,
    grade,
    durationMinutes,
    questions,
    matrixCells,
    structure,
    matrix,
  });

  const matrixHtml = renderCV7991MatrixHtml(cvData);
  const specHtml = renderCV7991SpecificationHtml(cvData);

  const fullHtml = `
    ${matrixHtml}
    <div style="page-break-before: always; margin-top: 24px;"></div>
    ${specHtml}
  `;

  triggerPrintPdf(fullHtml, `Ma_tran_Bang_dac_ta_CV7991_${subject}_K${grade}`, { landscape: true });
}

/**
 * Export Complete Exam Dossier to PDF (Ma trận & Bản đặc tả + Đề thi + Đáp án & Hướng dẫn chấm)
 */
export function exportFullExamDossierToPdf(params: {
  title: string;
  subject: string;
  grade: number;
  durationMinutes: number;
  questions: GeneratedAIQuestion[] | Question[];
  structure?: ExamStructureConfig;
  matrixCells?: MatrixCellSpecification[];
  matrix?: Matrix;
  cvData?: CV7991Data;
}): void {
  const { title, subject, grade, durationMinutes, questions, structure, matrixCells, matrix, cvData: passedCvData } = params;

  let bodyHtml = '';

  // 1. Ma trận & Bản đặc tả theo chuẩn Công văn 7991/BGDĐT-GDTrH
  const cvData = passedCvData || buildCV7991Data({
    title,
    subject,
    grade,
    durationMinutes,
    questions,
    structure,
    matrixCells,
    matrix,
  });

  bodyHtml += renderCV7991MatrixHtml(cvData);
  bodyHtml += `<div class="page-break" style="page-break-before: always; margin-top: 24px;"></div>`;
  bodyHtml += renderCV7991SpecificationHtml(cvData);

  // Page break to Exam
  bodyHtml += `<div class="page-break" style="page-break-before: always; margin-top: 24px;"></div>`;

  // 2. Đề thi chính thức
  bodyHtml += renderAdministrativeHeader(title, subject, grade, durationMinutes);
  bodyHtml += renderExamQuestionsHtml(questions, structure);
  bodyHtml += '<div class="footer-end">----------------------------- HẾT ĐỀ THI -----------------------------</div>';

  // Page break to Answers
  bodyHtml += `<div class="page-break"></div>`;

  // 3. Đáp án & Hướng dẫn chấm
  bodyHtml += `
    <div class="text-center font-bold" style="font-size: 13pt;">PHẦN 3: ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM CHI TIẾT</div>
    <div class="exam-title uppercase" style="margin-top: 10px;">${escapeHtml(title)} (MÔN: ${escapeHtml(subject)} - KHỐI ${grade})</div>
  `;

  // Quick Part I table
  const part1 = (questions as any[]).filter((q) => (q.exam_part || 1) === 1 && q.options && q.options.length > 0);
  if (part1.length > 0) {
    bodyHtml += `<div class="part-title" style="font-size: 12.5pt; margin-top: 12px;">I. BẢNG ĐÁP ÁN TRẮC NGHIỆM NHIỀU LỰA CHỌN</div>`;
    const chunkSize = 10;
    for (let c = 0; c < part1.length; c += chunkSize) {
      const chunk = part1.slice(c, c + chunkSize);
      bodyHtml += `
        <table class="matrix-table" style="text-align: center; margin-bottom: 12px;">
          <thead>
            <tr>${chunk.map((q, idx) => `<th>Câu ${q.question_order || (c + idx + 1)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            <tr style="font-weight: bold; color: #15803d; font-size: 13pt;">
              ${chunk.map((q) => {
                const cIdx = q.options?.findIndex((o: any) => o.is_correct);
                const letter = cIdx !== -1 && cIdx !== undefined ? String.fromCharCode(65 + cIdx) : '-';
                return `<td>${letter}</td>`;
              }).join('')}
            </tr>
          </tbody>
        </table>
      `;
    }
  }

  // Detailed Rubrics
  bodyHtml += `<div class="part-title" style="font-size: 12.5pt; margin-top: 16px;">II. LỜI GIẢI VÀ BIỂU ĐIỂM CHI TIẾT</div>`;
  let qOrder = 1;
  (questions as any[]).forEach((q) => {
    const num = q.question_order || qOrder++;
    const points = q.points ? ` (${q.points} điểm)` : '';
    bodyHtml += `<div class="question-block" style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 10px;">
      <div><strong>Câu ${num}${points}:</strong> ${renderMathInHtml(q.content || '')}</div>
    `;

    const statements = getQuestionStatements(q);
    if (statements.length > 0) {
      bodyHtml += `
        <table class="true-false-table" style="margin-top: 4px;">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">Ý</th>
              <th>Mệnh đề</th>
              <th style="width: 80px; text-align: center;">Đáp án</th>
              <th>Hướng dẫn giải</th>
            </tr>
          </thead>
          <tbody>
      `;
      statements.forEach((st, sIdx) => {
        const letter = ['a', 'b', 'c', 'd'][sIdx] || `${sIdx + 1}`;
        const mark = st.is_correct ? '<span style="color: #15803d; font-weight: bold;">ĐÚNG</span>' : '<span style="color: #dc2626; font-weight: bold;">SAI</span>';
        bodyHtml += `
          <tr>
            <td style="text-align: center; font-weight: bold;">${letter}</td>
            <td>${renderMathInHtml(st.statement)}</td>
            <td style="text-align: center;">${mark}</td>
            <td style="font-size: 11pt;">${renderMathInHtml(st.explanation || '')}</td>
          </tr>
        `;
      });
      bodyHtml += `</tbody></table>`;
    }

    if (q.short_answer) {
      const shortAns = typeof q.short_answer === 'object' ? q.short_answer.normalized_answer : q.short_answer;
      bodyHtml += `<div style="color: #15803d; font-weight: bold; margin-top: 4px;">→ Đáp số: ${escapeHtml(shortAns)}</div>`;
    }

    if (q.explanation) {
      bodyHtml += `<div style="margin-top: 4px; color: #334155;"><strong>Lời giải:</strong> ${renderMathInHtml(q.explanation)}</div>`;
    }

    bodyHtml += `</div>`;
  });

  triggerPrintPdf(bodyHtml, `Ho_so_de_thi_${subject}_K${grade}`);
}
