import JSZip from 'jszip';
import katex from 'katex';
import { mml2omml } from 'mathml2omml';
import { GeneratedAIQuestion, ExamStructureConfig, MatrixCellSpecification } from '../types/aiExam';
import { Exam, Matrix, Question } from '../types';
import { buildCV7991Data, renderCV7991MatrixWordXml, renderCV7991SpecificationWordXml, CV7991Data } from '../lib/cv7991MatrixHelper';

// XML Escape helper with strict invalid control character removal for ECMA-376 compliance
export function escapeXml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Normalized statement structure for Part II True/False questions
 */
export interface NormalizedStatement {
  id?: string;
  statement: string;
  is_correct?: boolean;
  explanation?: string;
}

/**
 * Robust helper to extract True/False statements regardless of AI format or database structure.
 * Supports 2, 4, 6, 8 statements (a, b, c, d, e, f, g, h).
 */
export function getQuestionStatements(q: any): NormalizedStatement[] {
  if (!q) return [];

  const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  // 1. Direct statements field (array, object, or JSON string)
  let rawStatements = q.statements;
  if (typeof rawStatements === 'string') {
    try {
      rawStatements = JSON.parse(rawStatements);
    } catch {
      rawStatements = null;
    }
  }

  if (rawStatements) {
    const list = Array.isArray(rawStatements) ? rawStatements : Object.values(rawStatements);
    if (list.length > 0) {
      return list.map((st: any, idx: number) => {
        let rawText = '';
        if (typeof st === 'string') {
          rawText = st;
        } else if (st && typeof st === 'object') {
          rawText = st.statement || st.content || st.text || st.title || '';
        }
        const cleaned = rawText
          .replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, '')
          .replace(/\s*\[(ĐÚNG|SAI|DUNG|TRUE|FALSE)\]\s*$/i, '')
          .trim();

        const defaultLabel = labels[idx] || `${idx + 1}`;
        return {
          id: st?.id || `st-${defaultLabel}`,
          statement: cleaned || rawText.trim() || `Mệnh đề ${defaultLabel}`,
          is_correct: Boolean(st?.is_correct ?? st?.correct ?? (st?.answer === 'Đúng' || st?.answer === true)),
          explanation: st?.explanation || st?.feedback || '',
        };
      });
    }
  }

  // 2. Fallback: options field for True/False questions (from DB, banks, or alternative AI response formats)
  if (Array.isArray(q.options) && q.options.length > 0 && (q.question_type === 'true_false' || Number(q.exam_part) === 2)) {
    return q.options.map((opt: any, idx: number) => {
      let rawText = '';
      if (typeof opt === 'string') {
        rawText = opt;
      } else if (opt && typeof opt === 'object') {
        rawText = opt.content || opt.statement || opt.text || opt.title || '';
      }
      const cleaned = rawText
        .replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, '')
        .replace(/\s*\[(ĐÚNG|SAI|DUNG|TRUE|FALSE)\]\s*$/i, '')
        .trim();

      const defaultLabel = labels[idx] || `${idx + 1}`;
      return {
        id: opt?.id || `opt-${defaultLabel}`,
        statement: cleaned || rawText.trim() || `Mệnh đề ${defaultLabel}`,
        is_correct: Boolean(opt?.is_correct ?? opt?.correct ?? (opt?.answer === 'Đúng' || opt?.answer === true)),
        explanation: opt?.explanation || opt?.feedback || '',
      };
    });
  }

  // 3. Fallback: Parse statements embedded inside q.content (e.g., text contains "a) ... b) ...")
  if (Number(q.exam_part) === 2 || q.question_type === 'true_false') {
    const content = q.content || '';
    const lines = content.split('\n');
    const parsedStatements: NormalizedStatement[] = [];
    lines.forEach((line: string) => {
      const match = line.match(/^([a-hA-H])\s*[\)\.\:]\s*(.+)$/i);
      if (match) {
        const lbl = match[1].toLowerCase();
        parsedStatements.push({
          id: `st-${lbl}`,
          statement: match[2].replace(/\s*\[(ĐÚNG|SAI|DUNG|TRUE|FALSE)\]\s*$/i, '').trim(),
          is_correct: /\[\s*(ĐÚNG|DUNG|TRUE)\s*\]/i.test(line),
          explanation: '',
        });
      }
    });

    if (parsedStatements.length >= 2) {
      return parsedStatements;
    }

    // 4. Default 4 statements placeholder so Part II is never empty!
    return [
      { id: 'st-a', statement: 'Mệnh đề a', is_correct: true, explanation: '' },
      { id: 'st-b', statement: 'Mệnh đề b', is_correct: false, explanation: '' },
      { id: 'st-c', statement: 'Mệnh đề c', is_correct: true, explanation: '' },
      { id: 'st-d', statement: 'Mệnh đề d', is_correct: false, explanation: '' },
    ];
  }

  return [];
}

/**
 * Converts a LaTeX math string to Microsoft Word OMML (<m:oMath>...</m:oMath>)
 * Strips invalid XML declarations and un-embeds m:oMathPara to prevent Word corruption
 */
export function latexToOmml(latex: string): string {
  if (!latex || !latex.trim()) return '';
  try {
    const rawMathML = katex.renderToString(latex.trim(), {
      output: 'mathml',
      throwOnError: false,
      strict: false,
    });

    const match = rawMathML.match(/<math[\s\S]*?<\/math>/);
    if (!match) return '';

    // Remove annotations to avoid mathml2omml warnings
    const cleanMathML = match[0].replace(/<annotation[\s\S]*?<\/annotation>/g, '');
    let omml = mml2omml(cleanMathML);
    if (!omml) return '';

    // CRITICAL: Strip any <?xml ...?> declarations generated by mathml2omml
    omml = omml.replace(/<\?xml[\s\S]*?\?>/gi, '').trim();
    // Unwrap <m:oMathPara> if present so it doesn't corrupt paragraph XML
    omml = omml.replace(/<\/?m:oMathPara[^>]*>/gi, '').trim();

    return omml;
  } catch (err) {
    console.warn('Error converting LaTeX to OMML:', latex, err);
    return '';
  }
}

/**
 * Parses mixed text containing LaTeX delimiters ($...$, $$...$$, \(...\), \[...\])
 * and returns WordprocessingML runs (<w:r>) and OMML equations (<m:oMath>).
 */
export function parseTextToWordRuns(
  text: string,
  options?: { bold?: boolean; italic?: boolean; size?: number; color?: string }
): string {
  if (!text) return '';

  const boldXml = options?.bold ? '<w:b/>' : '';
  const italicXml = options?.italic ? '<w:i/>' : '';
  const sizeXml = options?.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '';
  const colorXml = options?.color ? `<w:color w:val="${options.color}"/>` : '';
  const rPr = `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${boldXml}${italicXml}${sizeXml}${colorXml}</w:rPr>`;

  // Split by LaTeX delimiters
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$(?:\\\$|[^\$\n])+?\$|\\\([\s\S]*?\\\))/g;
  const parts = text.split(regex);

  let xml = '';

  for (const part of parts) {
    if (!part) continue;

    let mathContent: string | null = null;

    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
      mathContent = part.slice(2, -2).trim();
    } else if (part.startsWith('\\[') && part.endsWith('\\]') && part.length >= 4) {
      mathContent = part.slice(2, -2).trim();
    } else if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      mathContent = part.slice(1, -1).trim();
    } else if (part.startsWith('\\(') && part.endsWith('\\)') && part.length >= 4) {
      mathContent = part.slice(2, -2).trim();
    }

    if (mathContent !== null) {
      const omml = latexToOmml(mathContent);
      if (omml) {
        // Place raw <m:oMath> inside the paragraph
        xml += omml;
      } else {
        // Fallback to text if conversion failed
        xml += `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
      }
    } else {
      // Regular text with possible line breaks
      const lines = part.split('\n');
      lines.forEach((line, lIdx) => {
        if (lIdx > 0) {
          xml += '<w:r><w:br/></w:r>';
        }
        if (line) {
          xml += `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`;
        }
      });
    }
  }

  return xml;
}

/**
 * Creates a Word paragraph XML string
 */
export function createWordParagraph(
  runsXml: string,
  options?: {
    align?: 'left' | 'center' | 'right' | 'both';
    spacingBefore?: number;
    spacingAfter?: number;
    lineSpacing?: number;
    keepWithNext?: boolean;
  }
): string {
  const align = options?.align ? `<w:jc w:val="${options.align}"/>` : '<w:jc w:val="both"/>';
  const spacing = `<w:spacing w:before="${options?.spacingBefore ?? 60}" w:after="${options?.spacingAfter ?? 60}" w:line="${options?.lineSpacing ?? 276}" w:lineRule="auto"/>`;
  const keepNext = options?.keepWithNext ? '<w:keepNext/>' : '';

  return `<w:p><w:pPr>${align}${spacing}${keepNext}</w:pPr>${runsXml}</w:p>`;
}

/**
 * Creates a Word Table XML string strictly compliant with OpenXML ISO/IEC 29500 (ECMA-376)
 */
export function createWordTable(
  rowsXml: string,
  options?: {
    borders?: boolean;
    colWidths?: number[];
    align?: 'center' | 'left';
  }
): string {
  const hasBorders = options?.borders !== false;
  const bordersXml = hasBorders
    ? `<w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="A0AEC0"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="A0AEC0"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="A0AEC0"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="A0AEC0"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
      </w:tblBorders>`
    : `<w:tblBorders>
        <w:top w:val="none"/>
        <w:left w:val="none"/>
        <w:bottom w:val="none"/>
        <w:right w:val="none"/>
        <w:insideH w:val="none"/>
        <w:insideV w:val="none"/>
      </w:tblBorders>`;

  // Calculate or generate compliant <w:tblGrid>
  let gridColsXml = '';
  if (options?.colWidths && options.colWidths.length > 0) {
    gridColsXml = options.colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  } else {
    // Attempt to extract widths from the first row or derive from column count
    const firstRowMatch = rowsXml.match(/<w:tr[\s\S]*?<\/w:tr>/);
    if (firstRowMatch) {
      const tcWidthMatches = Array.from(firstRowMatch[0].matchAll(/<w:tcW\s+w:w="(\d+)"/g));
      if (tcWidthMatches.length > 0) {
        gridColsXml = tcWidthMatches.map((m) => `<w:gridCol w:w="${m[1]}"/>`).join('');
      } else {
        const tcCount = (firstRowMatch[0].match(/<w:tc[\s>]/g) || []).length;
        if (tcCount > 0) {
          const colW = Math.floor(9400 / tcCount);
          gridColsXml = Array(tcCount).fill(`<w:gridCol w:w="${colW}"/>`).join('');
        } else {
          gridColsXml = '<w:gridCol w:w="9400"/>';
        }
      }
    } else {
      gridColsXml = '<w:gridCol w:w="9400"/>';
    }
  }

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="0" w:type="auto"/>
      <w:jc w:val="${options?.align || 'center'}"/>
      ${bordersXml}
      <w:tblCellMar>
        <w:top w:w="120" w:type="dxa"/>
        <w:left w:w="160" w:type="dxa"/>
        <w:bottom w:w="120" w:type="dxa"/>
        <w:right w:w="160" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      ${gridColsXml}
    </w:tblGrid>
    ${rowsXml}
  </w:tbl>`;
}

/**
 * Creates a Word Table Row
 */
export function createWordTableRow(cellsXml: string, isHeader?: boolean): string {
  const headerPr = isHeader ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>';
  return `<w:tr>${headerPr}${cellsXml}</w:tr>`;
}

/**
 * Creates a Word Table Cell strictly containing at least one paragraph
 */
export function createWordTableCell(
  paragraphsXml: string,
  options?: {
    widthDxa?: number;
    bgColor?: string;
    colSpan?: number;
    verticalAlign?: 'top' | 'center' | 'bottom';
    vMerge?: 'restart' | 'continue';
  }
): string {
  const wXml = options?.widthDxa ? `<w:tcW w:w="${options.widthDxa}" w:type="dxa"/>` : '<w:tcW w:w="0" w:type="auto"/>';
  const shd = options?.bgColor ? `<w:shd w:val="clear" w:color="auto" w:fill="${options.bgColor}"/>` : '';
  const gridSpan = options?.colSpan && options.colSpan > 1 ? `<w:gridSpan w:val="${options.colSpan}"/>` : '';
  const vAlign = options?.verticalAlign ? `<w:vAlign w:val="${options.verticalAlign}"/>` : '';
  const vMerge = options?.vMerge ? `<w:vMerge${options.vMerge === 'restart' ? ' w:val="restart"' : ''}/>` : '';
  const content = paragraphsXml && paragraphsXml.trim().length > 0 ? paragraphsXml : '<w:p/>';

  return `<w:tc><w:tcPr>${wXml}${gridSpan}${shd}${vAlign}${vMerge}</w:tcPr>${content}</w:tc>`;
}

/**
 * Generates an official Vietnamese administrative exam header
 */
function generateOfficialExamHeader(examTitle: string, subject: string, grade: number, duration: number): string {
  const leftCell = `
    ${createWordParagraph(parseTextToWordRuns('SỞ GIÁO DỤC VÀ ĐÀO TẠO', { bold: true, size: 22 }), { align: 'center' })}
    ${createWordParagraph(parseTextToWordRuns('TRƯỜNG THCS & THPT CHUYÊN KHẢO THÍ', { bold: true, size: 22 }), { align: 'center' })}
    ${createWordParagraph(parseTextToWordRuns('(Đề thi có ___ trang)', { italic: true, size: 20 }), { align: 'center' })}
  `;

  const rightCell = `
    ${createWordParagraph(parseTextToWordRuns('KỲ KIỂM TRA ĐỊNH KỲ NĂM HỌC 2026 - 2027', { bold: true, size: 22 }), { align: 'center' })}
    ${createWordParagraph(parseTextToWordRuns(`MÔN: ${subject.toUpperCase()} - KHỐI ${grade}`, { bold: true, size: 22 }), { align: 'center' })}
    ${createWordParagraph(parseTextToWordRuns(`Thời gian làm bài: ${duration} phút (không kể thời gian phát đề)`, { italic: true, size: 20 }), { align: 'center' })}
  `;

  const headerTable = createWordTable(
    createWordTableRow(
      createWordTableCell(leftCell, { widthDxa: 4600 }) +
      createWordTableCell(rightCell, { widthDxa: 4800 })
    ),
    { borders: false, colWidths: [4600, 4800] }
  );

  const studentInfoBox = `
    ${createWordParagraph(parseTextToWordRuns(examTitle.toUpperCase(), { bold: true, size: 28 }), { align: 'center', spacingBefore: 140, spacingAfter: 100 })}
    ${createWordTable(
      createWordTableRow(
        createWordTableCell(
          createWordParagraph(parseTextToWordRuns('Họ và tên thí sinh: ............................................................................................', { size: 22 })) +
          createWordParagraph(parseTextToWordRuns('Số báo danh: ........................................... Lớp: ................. Phòng thi: ..........', { size: 22 })),
          { widthDxa: 7400 }
        ) +
        createWordTableCell(
          createWordParagraph(parseTextToWordRuns('MÃ ĐỀ THI', { bold: true, size: 22 }), { align: 'center' }) +
          createWordParagraph(parseTextToWordRuns('101', { bold: true, size: 32 }), { align: 'center' }),
          { widthDxa: 2000, bgColor: 'F8FAFC' }
        )
      ),
      { borders: true, colWidths: [7400, 2000] }
    )}
  `;

  return headerTable + studentInfoBox;
}

export interface DocxZipOptions {
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/**
 * Builds the complete, valid OpenXML .docx zip package
 */
export async function buildDocxZip(
  documentBodyXml: string,
  options?: DocxZipOptions
): Promise<Blob> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`
  );

  // 4. word/settings.xml (Valid OpenXML schema without illegal enums)
  zip.file(
    'word/settings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
</w:settings>`
  );

  // 5. word/styles.xml (Complete with Normal paragraph, DefaultParagraphFont, and TableNormal)
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:before="60" w:after="60" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">
    <w:name w:val="Default Paragraph Font"/>
    <w:uiPriority w:val="1"/>
    <w:semiHidden/>
    <w:unhideWhenUsed/>
  </w:style>
  <w:style w:type="table" w:default="1" w:styleId="TableNormal">
    <w:name w:val="Normal Table"/>
    <w:uiPriority w:val="99"/>
    <w:semiHidden/>
    <w:unhideWhenUsed/>
    <w:tblPr>
      <w:tblInd w:w="0" w:type="dxa"/>
      <w:tblCellMar>
        <w:top w:w="0" w:type="dxa"/>
        <w:left w:w="108" w:type="dxa"/>
        <w:bottom w:w="0" w:type="dxa"/>
        <w:right w:w="108" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
  </w:style>
</w:styles>`
  );

  // 6. word/document.xml
  const isLandscape = options?.orientation === 'landscape';
  const width = isLandscape ? 16838 : 11906;
  const height = isLandscape ? 11906 : 16838;
  const top = options?.margins?.top ?? (isLandscape ? 850 : 1134);
  const right = options?.margins?.right ?? (isLandscape ? 850 : 1134);
  const bottom = options?.margins?.bottom ?? (isLandscape ? 850 : 1134);
  const left = options?.margins?.left ?? (isLandscape ? 850 : 1134);
  const orientAttr = isLandscape ? ' w:orient="landscape"' : '';

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" 
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    ${documentBodyXml}
    <w:sectPr>
      <w:pgSz w:w="${width}" w:h="${height}"${orientAttr}/>
      <w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', docXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}

/**
 * Triggers client-side download of a Blob file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ----------------------------------------------------------------------------
// HIGH LEVEL EXPORT FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Helper to render questions into Word body XML
 */
function renderQuestionsToWordXml(
  questions: GeneratedAIQuestion[] | Question[],
  structure?: ExamStructureConfig
): string {
  let bodyXml = '';
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

    bodyXml += createWordParagraph(
      parseTextToWordRuns(partTitle.toUpperCase(), { bold: true, size: 24 }),
      { spacingBefore: 180, spacingAfter: 40 }
    );
    bodyXml += createWordParagraph(
      parseTextToWordRuns(partInstructions, { italic: true, size: 22 }),
      { spacingBefore: 0, spacingAfter: 120 }
    );

    partQuestions.forEach((q) => {
      const qNum = q.question_order || currentOrder++;
      const pointsText = q.points ? ` (${q.points} điểm)` : '';

      // Question content with embedded OMML equations
      const qHeader = parseTextToWordRuns(`Câu ${qNum}${pointsText}: `, { bold: true, size: 24 });
      const qBody = parseTextToWordRuns(q.content || '', { size: 24 });
      bodyXml += createWordParagraph(qHeader + qBody, { spacingBefore: 100, spacingAfter: 60 });

      // Options for Part I
      if (partNum === 1 && q.options && q.options.length > 0) {
        let optRows = '';
        let currentCells = '';
        q.options.forEach((opt: any, oIdx: number) => {
          const letter = String.fromCharCode(65 + oIdx);
          const optContent = opt.content || opt.statement || opt.text || '';
          const optRuns = parseTextToWordRuns(`${letter}. `, { bold: true, size: 24 }) + parseTextToWordRuns(optContent, { size: 24 });
          currentCells += createWordTableCell(createWordParagraph(optRuns, { spacingBefore: 40, spacingAfter: 40 }), { widthDxa: 4700 });

          if (oIdx % 2 === 1 || oIdx === q.options.length - 1) {
            // If odd number of options, balance the last row
            if (oIdx % 2 === 0 && oIdx === q.options.length - 1) {
              currentCells += createWordTableCell(createWordParagraph(''), { widthDxa: 4700 });
            }
            optRows += createWordTableRow(currentCells);
            currentCells = '';
          }
        });
        bodyXml += createWordTable(optRows, { borders: false, colWidths: [4700, 4700] });
      }

      // Statements for Part II (True / False) - Always extracts reliably!
      if (partNum === 2 || q.question_type === 'true_false') {
        const statements = getQuestionStatements(q);
        if (statements.length > 0) {
          let stmtRows = '';
          const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          statements.forEach((st, sIdx) => {
            const letter = labels[sIdx] || String.fromCharCode(97 + sIdx);
            let stText = st.statement.replace(/^([a-hA-H1-8]\s*[\)\.\:]\s*)+/i, '');
            const left = parseTextToWordRuns(`${letter}) `, { bold: true, size: 24 }) + parseTextToWordRuns(stText, { size: 24 });
            stmtRows += createWordTableRow(
              createWordTableCell(createWordParagraph(left, { spacingBefore: 40, spacingAfter: 40 }), { widthDxa: 7800 }) +
              createWordTableCell(createWordParagraph(parseTextToWordRuns('[  ] Đ    [  ] S', { size: 22 }), { align: 'center', spacingBefore: 40, spacingAfter: 40 }), { widthDxa: 1600 })
            );
          });
          bodyXml += createWordTable(stmtRows, { borders: true, colWidths: [7800, 1600] });
        }
      }

      // Short answer space
      if (q.question_type === 'short_answer' || q.exam_part === 3) {
        bodyXml += createWordParagraph(
          parseTextToWordRuns('Trả lời: .....................................................................................................................................................', { italic: true, size: 22 }),
          { spacingBefore: 60, spacingAfter: 80 }
        );
      }

      // Essay space
      if (q.question_type === 'essay' || q.exam_part === 4) {
        if (q.sub_items && q.sub_items.length > 1) {
          q.sub_items.forEach((sub: any) => {
            const subLabel = sub.item_number ? `${sub.item_number}) ` : '';
            const subPts = sub.points ? ` (${sub.points} điểm)` : '';
            bodyXml += createWordParagraph(
              parseTextToWordRuns(`${subLabel}${sub.question_text || ''}${subPts}`, { bold: true, size: 22 }),
              { spacingBefore: 40, spacingAfter: 20 }
            );
            bodyXml += createWordParagraph(parseTextToWordRuns('.....................................................................................................................................................................................................', { size: 20 }), { spacingBefore: 20, spacingAfter: 40 });
          });
        } else {
          bodyXml += createWordParagraph(
            parseTextToWordRuns('Bài làm:', { italic: true, bold: true, size: 22 }),
            { spacingBefore: 60, spacingAfter: 40 }
          );
          bodyXml += createWordParagraph(parseTextToWordRuns('.....................................................................................................................................................................................................', { size: 20 }), { spacingBefore: 40, spacingAfter: 40 });
          bodyXml += createWordParagraph(parseTextToWordRuns('.....................................................................................................................................................................................................', { size: 20 }), { spacingBefore: 40, spacingAfter: 80 });
        }
      }
    });
  });

  return bodyXml;
}

/**
 * Export Exam Paper to Word (.docx) with 100% Word Equation formulas
 */
export async function exportExamToWord(params: {
  title: string;
  subject: string;
  grade: number;
  durationMinutes: number;
  questions: GeneratedAIQuestion[] | Question[];
  structure?: ExamStructureConfig;
}): Promise<void> {
  const { title, subject, grade, durationMinutes, questions, structure } = params;

  let bodyXml = generateOfficialExamHeader(title, subject, grade, durationMinutes);
  bodyXml += renderQuestionsToWordXml(questions, structure);

  bodyXml += createWordParagraph(
    parseTextToWordRuns('----------------------------- HẾT -----------------------------', { bold: true, size: 22 }),
    { align: 'center', spacingBefore: 240, spacingAfter: 120 }
  );

  const docxBlob = await buildDocxZip(bodyXml);
  const cleanFilename = `De_thi_${subject}_K${grade}_${new Date().toISOString().slice(0, 10)}.docx`;
  downloadBlob(docxBlob, cleanFilename);
}

/**
 * Export Exam Answers and Grading Guide to Word (.docx)
 */
export async function exportAnswersToWord(params: {
  title: string;
  subject: string;
  grade: number;
  questions: GeneratedAIQuestion[] | Question[];
}): Promise<void> {
  const { title, subject, grade, questions } = params;

  let bodyXml = `
    ${createWordParagraph(parseTextToWordRuns('SỞ GIÁO DỤC VÀ ĐÀO TẠO', { bold: true, size: 22 }), { align: 'center' })}
    ${createWordParagraph(parseTextToWordRuns('TRƯỜNG THCS & THPT CHUYÊN KHẢO THÍ', { bold: true, size: 22 }), { align: 'center' })}
    ${createWordParagraph(parseTextToWordRuns('ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM ĐỀ KIỂM TRA', { bold: true, size: 28 }), { align: 'center', spacingBefore: 120, spacingAfter: 40 })}
    ${createWordParagraph(parseTextToWordRuns(`${title.toUpperCase()} (MÔN ${subject.toUpperCase()} - KHỐI ${grade})`, { bold: true, size: 24 }), { align: 'center', spacingBefore: 0, spacingAfter: 160 })}
  `;

  // 1. Quick Answer Table for Part I (wrapped in chunks of at most 10 columns)
  const part1Qs = (questions as any[]).filter((q) => (q.exam_part || 1) === 1 && q.options && q.options.length > 0);
  if (part1Qs.length > 0) {
    bodyXml += createWordParagraph(parseTextToWordRuns('I. BẢNG ĐÁP ÁN TRẮC NGHIỆM NHIỀU LỰA CHỌN (PHẦN I)', { bold: true, size: 24 }), { spacingBefore: 120, spacingAfter: 60 });

    const chunkSize = 10;
    for (let c = 0; c < part1Qs.length; c += chunkSize) {
      const chunk = part1Qs.slice(c, c + chunkSize);
      let headerRow = '';
      let dataRow = '';
      const colWidth = Math.floor(9400 / chunk.length);

      chunk.forEach((q, idx) => {
        const qNum = q.question_order || (c + idx + 1);
        let correctOpt = 'A';
        if (q.options) {
          const cIdx = q.options.findIndex((o: any) => o.is_correct);
          if (cIdx !== -1) correctOpt = String.fromCharCode(65 + cIdx);
        }
        headerRow += createWordTableCell(createWordParagraph(parseTextToWordRuns(`C.${qNum}`, { bold: true, size: 20 }), { align: 'center' }), { widthDxa: colWidth, bgColor: 'F1F5F9' });
        dataRow += createWordTableCell(createWordParagraph(parseTextToWordRuns(correctOpt, { bold: true, size: 22, color: '15803D' }), { align: 'center' }), { widthDxa: colWidth });
      });

      bodyXml += createWordTable(createWordTableRow(headerRow, true) + createWordTableRow(dataRow), { borders: true });
    }
  }

  // 2. Detailed Explanations and Scoring Rubrics
  bodyXml += createWordParagraph(parseTextToWordRuns('II. HƯỚNG DẪN GIẢI VÀ THANG ĐIỂM CHI TIẾT', { bold: true, size: 24 }), { spacingBefore: 180, spacingAfter: 80 });

  let qOrder = 1;
  (questions as any[]).forEach((q) => {
    const num = q.question_order || qOrder++;
    const points = q.points ? ` (${q.points} điểm)` : '';

    let contentXml = parseTextToWordRuns(`Câu ${num}${points}: `, { bold: true, size: 24 }) +
      parseTextToWordRuns(q.content || '', { size: 24 });
    bodyXml += createWordParagraph(contentXml, { spacingBefore: 100, spacingAfter: 40 });

    // Correct Answer line for Multiple Choice
    if (q.options && q.options.length > 0 && (!q.question_type || q.question_type === 'single_choice' || q.question_type === 'multiple_choice')) {
      const correct = q.options.find((o: any) => o.is_correct);
      if (correct) {
        bodyXml += createWordParagraph(
          parseTextToWordRuns('→ Đáp án đúng: ', { bold: true, size: 22, color: '15803D' }) +
          parseTextToWordRuns(correct.content || correct.statement || '', { size: 22 }),
          { spacingBefore: 20, spacingAfter: 40 }
        );
      }
    }

    // Statements for Part II True/False (Table of results)
    const statements = getQuestionStatements(q);
    if (statements.length > 0) {
      bodyXml += createWordParagraph(parseTextToWordRuns('→ Bảng kết quả các mệnh đề:', { bold: true, size: 22 }), { spacingBefore: 40, spacingAfter: 20 });
      
      let tfHeader = createWordTableRow(
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Ý', { bold: true, size: 20 }), { align: 'center' }), { widthDxa: 800, bgColor: 'F1F5F9' }) +
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Nội dung mệnh đề', { bold: true, size: 20 })), { widthDxa: 4800, bgColor: 'F1F5F9' }) +
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Đáp án', { bold: true, size: 20 }), { align: 'center' }), { widthDxa: 1200, bgColor: 'F1F5F9' }) +
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Hướng dẫn giải', { bold: true, size: 20 })), { widthDxa: 2600, bgColor: 'F1F5F9' }),
        true
      );
      let tfRows = tfHeader;
      const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      statements.forEach((st, sIdx) => {
        const letter = labels[sIdx] || String.fromCharCode(97 + sIdx);
        const mark = st.is_correct ? 'ĐÚNG' : 'SAI';
        const color = st.is_correct ? '15803D' : 'BE123C';
        tfRows += createWordTableRow(
          createWordTableCell(createWordParagraph(parseTextToWordRuns(letter, { bold: true, size: 22 }), { align: 'center' }), { widthDxa: 800 }) +
          createWordTableCell(createWordParagraph(parseTextToWordRuns(st.statement, { size: 22 })), { widthDxa: 4800 }) +
          createWordTableCell(createWordParagraph(parseTextToWordRuns(mark, { bold: true, size: 22, color }), { align: 'center' }), { widthDxa: 1200 }) +
          createWordTableCell(createWordParagraph(parseTextToWordRuns(st.explanation || 'Theo định nghĩa chuẩn.', { size: 20 })), { widthDxa: 2600 })
        );
      });
      bodyXml += createWordTable(tfRows, { borders: true, colWidths: [800, 4800, 1200, 2600] });
    }

    // Short answer
    if (q.short_answer) {
      const shortAns = typeof q.short_answer === 'object' ? q.short_answer.normalized_answer : q.short_answer;
      bodyXml += createWordParagraph(
        parseTextToWordRuns('→ Kết quả chuẩn: ', { bold: true, size: 22, color: '15803D' }) +
        parseTextToWordRuns(String(shortAns || ''), { bold: true, size: 22 }),
        { spacingBefore: 20, spacingAfter: 30 }
      );
    }

    // Explanation with math
    if (q.explanation) {
      bodyXml += createWordParagraph(
        parseTextToWordRuns('Lời giải chi tiết: ', { italic: true, bold: true, size: 22 }) +
        parseTextToWordRuns(q.explanation, { size: 22 }),
        { spacingBefore: 20, spacingAfter: 60 }
      );
    }

    // Rubric Table for Essay
    if (q.sub_items && q.sub_items.length > 1) {
      q.sub_items.forEach((sub: any) => {
        const subLbl = sub.item_number ? `Ý ${sub.item_number}) ` : '';
        bodyXml += createWordParagraph(
          parseTextToWordRuns(`${subLbl}${sub.question_text || ''} (${sub.points} điểm)`, { bold: true, size: 22, color: '1E293B' }),
          { spacingBefore: 60, spacingAfter: 20 }
        );
        if (sub.expected_answer) {
          bodyXml += createWordParagraph(
            parseTextToWordRuns('→ Đáp án mong đợi: ', { bold: true, size: 20, color: '15803D' }) +
            parseTextToWordRuns(sub.expected_answer, { size: 20 }),
            { spacingBefore: 10, spacingAfter: 20 }
          );
        }
        if (sub.scoring_rubric && sub.scoring_rubric.length > 0) {
          let rRows = createWordTableRow(
            createWordTableCell(createWordParagraph(parseTextToWordRuns('Tiêu chí yêu cầu', { bold: true, size: 20 })), { widthDxa: 7400, bgColor: 'F1F5F9' }) +
            createWordTableCell(createWordParagraph(parseTextToWordRuns('Điểm', { bold: true, size: 20 }), { align: 'center' }), { widthDxa: 2000, bgColor: 'F1F5F9' }),
            true
          );
          sub.scoring_rubric.forEach((r: any) => {
            rRows += createWordTableRow(
              createWordTableCell(createWordParagraph(parseTextToWordRuns(r.criterion, { size: 20 })), { widthDxa: 7400 }) +
              createWordTableCell(createWordParagraph(parseTextToWordRuns(`+${r.points}đ`, { bold: true, size: 20 }), { align: 'center' }), { widthDxa: 2000 })
            );
          });
          bodyXml += createWordTable(rRows, { borders: true, colWidths: [7400, 2000] });
        }
      });
    } else if (q.essay_rubric && q.essay_rubric.length > 0) {
      let rRows = createWordTableRow(
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Nội dung / Tiêu chí yêu cầu', { bold: true, size: 20 })), { widthDxa: 7400, bgColor: 'F1F5F9' }) +
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Điểm', { bold: true, size: 20 }), { align: 'center' }), { widthDxa: 2000, bgColor: 'F1F5F9' }),
        true
      );
      q.essay_rubric.forEach((r: any) => {
        rRows += createWordTableRow(
          createWordTableCell(createWordParagraph(parseTextToWordRuns(r.criterion, { size: 22 })), { widthDxa: 7400 }) +
          createWordTableCell(createWordParagraph(parseTextToWordRuns(`${r.points}đ`, { bold: true, size: 22 }), { align: 'center' }), { widthDxa: 2000 })
        );
      });
      bodyXml += createWordTable(rRows, { borders: true, colWidths: [7400, 2000] });
    }
  });

  const docxBlob = await buildDocxZip(bodyXml);
  const cleanFilename = `Dap_an_${subject}_K${grade}_${new Date().toISOString().slice(0, 10)}.docx`;
  downloadBlob(docxBlob, cleanFilename);
}

/**
 * Export Exam Matrix & Specification strictly compliant with Công văn số 7991/BGDĐT-GDTrH to Word (.docx)
 */
export async function exportMatrixToWord(params: {
  title: string;
  subject: string;
  grade: number;
  matrixCells?: MatrixCellSpecification[];
  matrix?: Matrix;
  questions?: GeneratedAIQuestion[] | Question[];
  structure?: ExamStructureConfig;
  durationMinutes?: number;
  cvData?: CV7991Data;
}): Promise<void> {
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

  let bodyXml = '';
  // 1. Ma trận đề kiểm tra định kì (19 cột chuẩn CV 7991)
  bodyXml += renderCV7991MatrixWordXml(cvData);

  // Ngắt trang giữa Ma trận và Bảng đặc tả
  bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  // 2. Bảng đặc tả kiểm tra định kì (16 cột chuẩn CV 7991)
  bodyXml += renderCV7991SpecificationWordXml(cvData);

  const docxBlob = await buildDocxZip(bodyXml, { orientation: 'landscape' });
  const cleanFilename = `Ma_tran_Bang_dac_ta_CV7991_${subject}_K${grade}_${new Date().toISOString().slice(0, 10)}.docx`;
  downloadBlob(docxBlob, cleanFilename);
}

/**
 * Export Complete Dossier (Ma trận & Bảng đặc tả + Đề thi + Đáp án & Hướng dẫn chấm) into one unified DOCX file
 */
export async function exportFullExamDossierToWord(params: {
  title: string;
  subject: string;
  grade: number;
  durationMinutes: number;
  questions: GeneratedAIQuestion[] | Question[];
  structure?: ExamStructureConfig;
  matrixCells?: MatrixCellSpecification[];
  matrix?: Matrix;
  cvData?: CV7991Data;
}): Promise<void> {
  const { title, subject, grade, durationMinutes, questions, structure, matrixCells, matrix, cvData: passedCvData } = params;

  let bodyXml = '';

  // --------------------------------------------------------------------------
  // SECTION 1: MA TRẬN VÀ BẢN ĐẶC TẢ THEO CHUẨN CÔNG VĂN 7991/BGDĐT-GDTrH (Landscape)
  // --------------------------------------------------------------------------
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

  bodyXml += renderCV7991MatrixWordXml(cvData);
  bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  bodyXml += renderCV7991SpecificationWordXml(cvData);

  // Section Break: Section 1 (Ma trận & Bản đặc tả CV 7991) is Landscape, while subsequent sections continue in standard portrait
  bodyXml += '<w:p><w:pPr><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:pPr></w:p>';

  // --------------------------------------------------------------------------
  // SECTION 2: ĐỀ KIỂM TRA CHÍNH THỨC
  // --------------------------------------------------------------------------
  bodyXml += generateOfficialExamHeader(title, subject, grade, durationMinutes);
  bodyXml += renderQuestionsToWordXml(questions, structure);
  bodyXml += createWordParagraph(
    parseTextToWordRuns('----------------------------- HẾT ĐỀ THI -----------------------------', { bold: true, size: 22 }),
    { align: 'center', spacingBefore: 200, spacingAfter: 120 }
  );

  // Page Break between Exam and Answers
  bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  // --------------------------------------------------------------------------
  // SECTION 3: ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM CHI TIẾT
  // --------------------------------------------------------------------------
  bodyXml += createWordParagraph(parseTextToWordRuns('PHẦN 3: ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM CHI TIẾT', { bold: true, size: 28 }), { align: 'center', spacingBefore: 80, spacingAfter: 40 });
  bodyXml += createWordParagraph(parseTextToWordRuns(`${title.toUpperCase()} (MÔN ${subject.toUpperCase()} - KHỐI ${grade})`, { bold: true, size: 24 }), { align: 'center', spacingBefore: 0, spacingAfter: 160 });

  // Quick Multiple Choice Answers
  const part1Qs = (questions as any[]).filter((q) => (q.exam_part || 1) === 1 && q.options && q.options.length > 0);
  if (part1Qs.length > 0) {
    bodyXml += createWordParagraph(parseTextToWordRuns('I. BẢNG ĐÁP ÁN TRẮC NGHIỆM NHIỀU LỰA CHỌN', { bold: true, size: 24 }), { spacingBefore: 100, spacingAfter: 60 });
    const chunkSize = 10;
    for (let c = 0; c < part1Qs.length; c += chunkSize) {
      const chunk = part1Qs.slice(c, c + chunkSize);
      let headerRow = '';
      let dataRow = '';
      const colWidth = Math.floor(9400 / chunk.length);

      chunk.forEach((q, idx) => {
        const qNum = q.question_order || (c + idx + 1);
        let correctOpt = 'A';
        if (q.options) {
          const cIdx = q.options.findIndex((o: any) => o.is_correct);
          if (cIdx !== -1) correctOpt = String.fromCharCode(65 + cIdx);
        }
        headerRow += createWordTableCell(createWordParagraph(parseTextToWordRuns(`C.${qNum}`, { bold: true, size: 20 }), { align: 'center' }), { widthDxa: colWidth, bgColor: 'F1F5F9' });
        dataRow += createWordTableCell(createWordParagraph(parseTextToWordRuns(correctOpt, { bold: true, size: 22, color: '15803D' }), { align: 'center' }), { widthDxa: colWidth });
      });

      bodyXml += createWordTable(createWordTableRow(headerRow, true) + createWordTableRow(dataRow), { borders: true });
    }
  }

  // Detailed Rubrics
  bodyXml += createWordParagraph(parseTextToWordRuns('II. LỜI GIẢI VÀ BIỂU ĐIỂM CHI TIẾT', { bold: true, size: 24 }), { spacingBefore: 180, spacingAfter: 80 });
  
  let qOrder = 1;
  (questions as any[]).forEach((q) => {
    const num = q.question_order || qOrder++;
    const points = q.points ? ` (${q.points} điểm)` : '';

    bodyXml += createWordParagraph(
      parseTextToWordRuns(`Câu ${num}${points}: `, { bold: true, size: 24 }) +
      parseTextToWordRuns(q.content || '', { size: 24 }),
      { spacingBefore: 80, spacingAfter: 40 }
    );

    const statements = getQuestionStatements(q);
    if (statements.length > 0) {
      let tfHeader = createWordTableRow(
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Ý', { bold: true, size: 20 }), { align: 'center' }), { widthDxa: 800, bgColor: 'F1F5F9' }) +
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Mệnh đề', { bold: true, size: 20 })), { widthDxa: 4800, bgColor: 'F1F5F9' }) +
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Đáp án', { bold: true, size: 20 }), { align: 'center' }), { widthDxa: 1200, bgColor: 'F1F5F9' }) +
        createWordTableCell(createWordParagraph(parseTextToWordRuns('Giải thích', { bold: true, size: 20 })), { widthDxa: 2600, bgColor: 'F1F5F9' }),
        true
      );
      let tfRows = tfHeader;
      statements.forEach((st, sIdx) => {
        const letter = ['a', 'b', 'c', 'd'][sIdx] || `${sIdx + 1}`;
        const mark = st.is_correct ? 'ĐÚNG' : 'SAI';
        const color = st.is_correct ? '15803D' : 'BE123C';
        tfRows += createWordTableRow(
          createWordTableCell(createWordParagraph(parseTextToWordRuns(letter, { bold: true, size: 22 }), { align: 'center' }), { widthDxa: 800 }) +
          createWordTableCell(createWordParagraph(parseTextToWordRuns(st.statement, { size: 22 })), { widthDxa: 4800 }) +
          createWordTableCell(createWordParagraph(parseTextToWordRuns(mark, { bold: true, size: 22, color }), { align: 'center' }), { widthDxa: 1200 }) +
          createWordTableCell(createWordParagraph(parseTextToWordRuns(st.explanation || '', { size: 20 })), { widthDxa: 2600 })
        );
      });
      bodyXml += createWordTable(tfRows, { borders: true, colWidths: [800, 4800, 1200, 2600] });
    }

    if (q.short_answer) {
      const shortAns = typeof q.short_answer === 'object' ? q.short_answer.normalized_answer : q.short_answer;
      bodyXml += createWordParagraph(
        parseTextToWordRuns('→ Đáp số: ', { bold: true, size: 22, color: '15803D' }) +
        parseTextToWordRuns(String(shortAns || ''), { bold: true, size: 22 }),
        { spacingBefore: 20, spacingAfter: 30 }
      );
    }

    if (q.explanation) {
      bodyXml += createWordParagraph(
        parseTextToWordRuns('Lời giải: ', { italic: true, bold: true, size: 22 }) +
        parseTextToWordRuns(q.explanation, { size: 22 }),
        { spacingBefore: 20, spacingAfter: 40 }
      );
    }
  });

  const docxBlob = await buildDocxZip(bodyXml);
  const cleanFilename = `Ho_so_de_thi_toan_dien_${subject}_K${grade}_${new Date().toISOString().slice(0, 10)}.docx`;
  downloadBlob(docxBlob, cleanFilename);
}
