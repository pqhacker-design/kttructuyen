import React, { useState } from 'react';
import { Download, Printer, Table, FileText } from 'lucide-react';
import { CV7991Data, formatVnNumber } from '../lib/cv7991MatrixHelper';

interface CV7991MatrixTableViewProps {
  cvData: CV7991Data;
  onExportWord?: () => void;
  onExportPdf?: () => void;
  className?: string;
}

export const CV7991MatrixTableView: React.FC<CV7991MatrixTableViewProps> = ({
  cvData,
  onExportWord,
  onExportPdf,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'specification'>('matrix');

  if (!cvData) {
    return null;
  }

  const rows = cvData.rows || [];
  const specRows = cvData.specRows || [];
  const summary = cvData.summary || {
    counts: {} as any,
    points: {} as any,
    percentages: {} as any,
  };

  const renderCellCount = (val: number | undefined | null) => {
    if (val && val > 0) {
      return (
        <span className="inline-flex items-center justify-center font-bold text-indigo-900 bg-indigo-50 border border-indigo-200/80 rounded px-1.5 py-0.5 text-[11px] shadow-2xs min-w-[20px]">
          {val}
        </span>
      );
    }
    return <span className="text-slate-300 font-normal">-</span>;
  };

  const renderSpecCell = (questionsStr?: string, count?: number) => {
    if (questionsStr && questionsStr.trim() !== '') {
      return <span className="font-bold text-indigo-700">{questionsStr}</span>;
    }
    if (count && count > 0) {
      return <span className="font-bold text-indigo-700">{count} câu</span>;
    }
    return <span className="text-slate-300 font-normal">-</span>;
  };

  const formatCell = (val: number | undefined | null) => (val && val > 0 ? String(val) : '-');
  const formatVn = (val: number | undefined | null) =>
    val !== undefined && val !== null ? formatVnNumber(val) : '0,0';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab bar & Quick Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>1. Khung Ma Trận (19 Cột CV 7991)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('specification')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'specification'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Bản Đặc Tả Đề Kiểm Tra (CV 7991)</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {onExportWord && (
            <button
              type="button"
              onClick={onExportWord}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Xuất bảng Ma trận & Đặc tả theo mẫu Công văn 7991 ra Word (.docx)"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Xuất Word (.docx)</span>
            </button>
          )}

          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="In hoặc Xuất PDF khổ A4 ngang chuẩn văn bản"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In / Xuất PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 text-center space-y-1 shadow-2xs">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          MẪU THEO CÔNG VĂN SỐ 7991/BGDĐT-GDTrH BỘ GIÁO DỤC VÀ ĐÀO TẠO
        </div>
        <h3 className="text-base font-black text-slate-900 uppercase">
          {activeTab === 'matrix'
            ? '1. KHUNG MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ'
            : '2. BẢNG ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KÌ'}
        </h3>
        <div className="text-xs font-semibold text-slate-700">
          MÔN: {cvData.subject?.toUpperCase()} - LỚP {cvData.grade} • THỜI GIAN: {cvData.durationMinutes} PHÚT
        </div>
      </div>

      {/* TAB 1: 19-COLUMN MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
            <table className="w-full text-xs text-left border-collapse min-w-[980px]">
              <thead>
                {/* Row 1 */}
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200 text-center">
                  <th rowSpan={4} className="p-2 border-r border-slate-200 w-10">TT</th>
                  <th rowSpan={4} className="p-2 border-r border-slate-200 w-36">Chủ đề/ Chương</th>
                  <th rowSpan={4} className="p-2 border-r border-slate-200 w-44">Nội dung/đơn vị kiến thức</th>
                  <th colSpan={12} className="p-2 border-r border-slate-200 bg-indigo-50/70">
                    Mức độ đánh giá
                  </th>
                  <th colSpan={3} className="p-2 border-r border-slate-200 bg-amber-50/70">
                    Tổng nhận thức
                  </th>
                  <th rowSpan={4} className="p-2 w-24 bg-slate-100 border-l border-slate-200 text-center">
                    <div className="text-slate-900 font-bold">Tổng số câu</div>
                    <div className="text-[10px] text-slate-500 font-normal">% điểm</div>
                  </th>
                </tr>

                {/* Row 2 */}
                <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200 text-center text-[11px]">
                  <th colSpan={9} className="p-1.5 border-r border-slate-200 bg-sky-50/50">
                    Trắc nghiệm khách quan
                  </th>
                  <th colSpan={3} rowSpan={2} className="p-1.5 border-r border-slate-200 bg-purple-50/50 align-middle">
                    Tự luận ⁴
                  </th>
                  <th colSpan={3} rowSpan={2} className="p-1.5 border-r border-slate-200 bg-amber-50/40 align-middle">
                    Tổng nhận thức
                  </th>
                </tr>

                {/* Row 3 */}
                <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200 text-center text-[11px]">
                  <th colSpan={3} className="p-1 border-r border-slate-200 bg-sky-50/80">
                    Nhiều lựa chọn
                  </th>
                  <th colSpan={3} className="p-1 border-r border-slate-200 bg-emerald-50/80">
                    " Đúng – Sai " ²
                  </th>
                  <th colSpan={3} className="p-1 border-r border-slate-200 bg-teal-50/80">
                    Trả lời ngắn ³
                  </th>
                </tr>

                {/* Row 4 */}
                <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200 text-center text-[10px]">
                  {/* TNKQ: Nhiều lựa chọn */}
                  <th className="p-1 border-r border-slate-200 bg-sky-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-sky-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-sky-50/80 w-8">Vận dụng</th>

                  {/* TNKQ: Đúng Sai */}
                  <th className="p-1 border-r border-slate-200 bg-emerald-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-emerald-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-emerald-50/80 w-8">Vận dụng</th>

                  {/* TNKQ: Trả lời ngắn */}
                  <th className="p-1 border-r border-slate-200 bg-teal-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-teal-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-teal-50/80 w-8">Vận dụng</th>

                  {/* Tự luận */}
                  <th className="p-1 border-r border-slate-200 bg-purple-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-purple-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-purple-50/80 w-8">Vận dụng</th>

                  {/* Tổng mức độ */}
                  <th className="p-1 border-r border-slate-200 bg-amber-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-amber-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-amber-50/80 w-8">Vận dụng</th>
                </tr>

                {/* Sub-header labels (1), (2), ..., (19) */}
                <tr className="bg-slate-50 text-[10px] text-slate-500 border-b border-slate-200 text-center italic">
                  <td className="p-0.5 border-r border-slate-200 font-mono">1</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">2</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">3</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">4</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">5</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">6</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">7</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">8</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">9</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">10</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">11</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">12</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">13</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">14</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">15</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">16</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">17</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">18</td>
                  <td className="p-0.5 font-mono">19</td>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {rows.map((row, idx) => (
                  <tr key={row.tt || idx} className="hover:bg-slate-50/70">
                    <td className="p-2 text-center border-r border-slate-100 font-bold">{row.tt}</td>
                    <td className="p-2 border-r border-slate-100 font-semibold text-slate-900">{row.topic}</td>
                    <td className="p-2 border-r border-slate-100 text-slate-700">{row.contentUnit}</td>

                    {/* Part I: Nhiều lựa chọn */}
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.mc_rec)}</td>
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.mc_com)}</td>
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.mc_app)}</td>

                    {/* Part II: Đúng - Sai */}
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.tf_rec)}</td>
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.tf_com)}</td>
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.tf_app)}</td>

                    {/* Part III: Trả lời ngắn */}
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.sa_rec)}</td>
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.sa_com)}</td>
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.sa_app)}</td>

                    {/* Part IV: Tự luận */}
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.essay_rec)}</td>
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.essay_com)}</td>
                    <td className="p-1.5 text-center border-r border-slate-100">{renderCellCount(row.essay_app)}</td>

                    {/* Tổng nhận thức theo dòng */}
                    <td className="p-1.5 text-center border-r border-slate-100 font-bold bg-amber-50/40">
                      {row.total_rec > 0 ? (
                        <span className="font-extrabold text-amber-900 bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                          {row.total_rec}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-1.5 text-center border-r border-slate-100 font-bold bg-amber-50/40">
                      {row.total_com > 0 ? (
                        <span className="font-extrabold text-amber-900 bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                          {row.total_com}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-1.5 text-center border-r border-slate-100 font-bold bg-amber-50/40">
                      {row.total_app > 0 ? (
                        <span className="font-extrabold text-amber-900 bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                          {row.total_app}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Tổng số câu & Tỷ lệ % điểm */}
                    <td className="p-2 text-center font-bold bg-indigo-50/40 border-l border-slate-100">
                      <div className="font-black text-indigo-950 text-xs inline-flex items-center space-x-1 px-2 py-0.5 bg-white rounded border border-indigo-200 shadow-2xs">
                        <span>{(row.total_rec || 0) + (row.total_com || 0) + (row.total_app || 0)} câu</span>
                      </div>
                      <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                        {row.percentage}% điểm
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* SUMMARY ROWS AS PRESCRIBED IN CV 7991 */}
              <tfoot>
                {/* 1. Tổng số câu/lệnh hỏi */}
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={3} className="p-2.5 text-left pl-3 border-r border-slate-200">
                    Tổng số câu / lệnh hỏi
                  </td>
                  {/* MC */}
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.mc_rec ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.mc_com ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.mc_app ?? 0}</td>

                  {/* TF */}
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.tf_rec ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.tf_com ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.tf_app ?? 0}</td>

                  {/* SA */}
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.sa_rec ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.sa_com ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.sa_app ?? 0}</td>

                  {/* Essay */}
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.essay_rec ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.essay_com ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.essay_app ?? 0}</td>

                  {/* Totals by level */}
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/70 font-black text-amber-950">
                    {summary.counts?.total_rec ?? 0}
                  </td>
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/70 font-black text-amber-950">
                    {summary.counts?.total_com ?? 0}
                  </td>
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/70 font-black text-amber-950">
                    {summary.counts?.total_app ?? 0}
                  </td>
                  <td className="p-2 text-center text-indigo-950 bg-indigo-100/90 font-black text-xs">
                    {summary.counts?.grand_total_questions ?? 0} câu
                  </td>
                </tr>

                {/* 2. Tổng số điểm */}
                <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <td colSpan={3} className="p-2.5 text-left pl-3 border-r border-slate-200">
                    Tổng số điểm
                  </td>
                  <td colSpan={3} className="p-1.5 text-center border-r border-slate-200 text-sky-800 font-extrabold">
                    {formatVn(summary.points?.mc_total)}
                  </td>
                  <td colSpan={3} className="p-1.5 text-center border-r border-slate-200 text-emerald-800 font-extrabold">
                    {formatVn(summary.points?.tf_total)}
                  </td>
                  <td colSpan={3} className="p-1.5 text-center border-r border-slate-200 text-teal-800 font-extrabold">
                    {formatVn(summary.points?.sa_total)}
                  </td>
                  <td colSpan={3} className="p-1.5 text-center border-r border-slate-200 text-purple-800 font-extrabold">
                    {formatVn(summary.points?.essay_total)}
                  </td>
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/70 text-amber-900 font-black">
                    {formatVn(summary.points?.total_rec)}
                  </td>
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/70 text-amber-900 font-black">
                    {formatVn(summary.points?.total_com)}
                  </td>
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/70 text-amber-900 font-black">
                    {formatVn(summary.points?.total_app)}
                  </td>
                  <td className="p-2 text-center text-emerald-700 bg-emerald-100/60 font-black text-sm">
                    {formatVn(summary.points?.grand_total_points)} đ
                  </td>
                </tr>

                {/* 3. Tỷ lệ % */}
                <tr className="bg-slate-100/80 font-bold text-slate-800 border-t border-slate-200">
                  <td colSpan={3} className="p-2 text-left pl-3 border-r border-slate-200">
                    Tỷ lệ %
                  </td>
                  <td colSpan={3} className="p-1.5 text-center border-r border-slate-200">
                    {summary.percentages?.mc_total ?? 0}%
                  </td>
                  <td colSpan={3} className="p-1.5 text-center border-r border-slate-200">
                    {summary.percentages?.tf_total ?? 0}%
                  </td>
                  <td colSpan={3} className="p-1.5 text-center border-r border-slate-200">
                    {summary.percentages?.sa_total ?? 0}%
                  </td>
                  <td colSpan={3} className="p-1.5 text-center border-r border-slate-200">
                    {summary.percentages?.essay_total ?? 0}%
                  </td>
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/50">
                    {summary.percentages?.total_rec ?? 0}%
                  </td>
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/50">
                    {summary.percentages?.total_com ?? 0}%
                  </td>
                  <td className="p-1.5 text-center border-r border-slate-200 bg-amber-100/50">
                    {summary.percentages?.total_app ?? 0}%
                  </td>
                  <td className="p-2 text-center font-black text-indigo-700 bg-indigo-50">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Official Footnotes from CV 7991 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
            <div className="font-bold text-slate-800 mb-1">
              Ghi chú theo quy định tại Phụ lục Công văn số 7991/BGDĐT-GDTrH:
            </div>
            <div>
              <strong>(1)</strong> Các câu hỏi ở mức độ nhận biết và thông hiểu là các câu hỏi trắc nghiệm khách quan 4 lựa chọn, đúng/sai, trả lời ngắn.
            </div>
            <div>
              <strong>(2)</strong> Số điểm tính cho 1 câu hỏi, mỗi câu hỏi có 4 ý lệnh hỏi (chọn đúng 1 ý được 0,1đ; 2 ý được 0,25đ; 3 ý được 0,5đ; đúng cả 4 ý được 1,0đ).
            </div>
            <div>
              <strong>(3)</strong> Số điểm tính cho 1 câu hỏi trả lời ngắn, mỗi câu trả lời đúng được tính điểm theo quy định biểu điểm.
            </div>
            <div>
              <strong>(4)</strong> Điểm phần tự luận phân bố theo mức độ nhận thức (Thông hiểu: 1,0đ - 1,5đ; Vận dụng: 1,5đ - 2,0đ). Điểm số trong các ô là số điểm cho câu hỏi/ý hỏi tương ứng.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 16-COLUMN SPECIFICATION TABLE */}
      {activeTab === 'specification' && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
            <table className="w-full text-xs text-left border-collapse min-w-[980px]">
              <thead>
                {/* Row 1 */}
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200 text-center">
                  <th rowSpan={4} className="p-2 border-r border-slate-200 w-10">TT</th>
                  <th rowSpan={4} className="p-2 border-r border-slate-200 w-44 min-w-[150px]">Chủ đề/ Chương</th>
                  <th rowSpan={4} className="p-2 border-r border-slate-200 w-52 min-w-[180px]">Nội dung/đơn vị kiến thức</th>
                  <th rowSpan={4} className="p-2 border-r border-slate-200 min-w-[340px] text-left">
                    Yêu cầu cần đạt
                  </th>
                  <th colSpan={12} className="p-2 border-r border-slate-200 bg-indigo-50/70">
                    Số câu hỏi ở các mức độ đánh giá
                  </th>
                </tr>

                {/* Row 2 */}
                <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200 text-center text-[11px]">
                  <th colSpan={9} className="p-1.5 border-r border-slate-200 bg-sky-50/50">
                    Trắc nghiệm khách quan
                  </th>
                  <th colSpan={3} rowSpan={2} className="p-1.5 border-r border-slate-200 bg-purple-50/50 align-middle">
                    Tự luận
                  </th>
                </tr>

                {/* Row 3 */}
                <tr className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200 text-center text-[11px]">
                  <th colSpan={3} className="p-1 border-r border-slate-200 bg-sky-50/80">
                    Nhiều lựa chọn
                  </th>
                  <th colSpan={3} className="p-1 border-r border-slate-200 bg-emerald-50/80">
                    "Đúng – Sai"
                  </th>
                  <th colSpan={3} className="p-1 border-r border-slate-200 bg-teal-50/80">
                    Trả lời ngắn
                  </th>
                </tr>

                {/* Row 4 */}
                <tr className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200 text-center text-[10px]">
                  {/* MC */}
                  <th className="p-1 border-r border-slate-200 bg-sky-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-sky-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-sky-50/80 w-8">Vận dụng</th>

                  {/* TF */}
                  <th className="p-1 border-r border-slate-200 bg-emerald-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-emerald-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-emerald-50/80 w-8">Vận dụng</th>

                  {/* SA */}
                  <th className="p-1 border-r border-slate-200 bg-teal-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-teal-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-teal-50/80 w-8">Vận dụng</th>

                  {/* Essay */}
                  <th className="p-1 border-r border-slate-200 bg-purple-50/80 w-8">Biết</th>
                  <th className="p-1 border-r border-slate-200 bg-purple-50/80 w-8">Hiểu</th>
                  <th className="p-1 border-r border-slate-200 bg-purple-50/80 w-8">Vận dụng</th>
                </tr>

                {/* Column numbering */}
                <tr className="bg-slate-50 text-[10px] text-slate-500 border-b border-slate-200 text-center italic">
                  <td className="p-0.5 border-r border-slate-200 font-mono">1</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">2</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">3</td>
                  <td className="p-0.5 border-r border-slate-200 font-mono">4</td>
                  <td colSpan={3} className="p-0.5 border-r border-slate-200 font-medium">Nhiều lựa chọn</td>
                  <td colSpan={3} className="p-0.5 border-r border-slate-200 font-medium">Đúng - Sai</td>
                  <td colSpan={3} className="p-0.5 border-r border-slate-200 font-medium">Trả lời ngắn</td>
                  <td colSpan={3} className="p-0.5 border-r border-slate-200 font-medium">Tự luận</td>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {specRows.map((row, idx) => (
                  <React.Fragment key={row.tt || idx}>
                    {/* Level 1: Biết */}
                    <tr className="hover:bg-slate-50/70 align-top border-t border-slate-200">
                      <td rowSpan={3} className="p-2 text-center border-r border-slate-100 font-bold bg-slate-50/40">
                        {row.tt}
                      </td>
                      <td rowSpan={3} className="p-2 border-r border-slate-100 font-semibold text-slate-900 bg-slate-50/40">
                        {row.topic}
                      </td>
                      <td rowSpan={3} className="p-2 border-r border-slate-100 text-slate-700 bg-slate-50/40">
                        {row.contentUnit}
                      </td>

                      {/* Yêu cầu cần đạt: Biết */}
                      <td className="p-2 border-r border-slate-100 text-slate-700 leading-relaxed">
                        <span className="font-bold text-sky-900 block mb-0.5">Nhận biết:</span>
                        <div className="text-[11px] text-slate-600 whitespace-pre-line pl-1">
                          {row.recognition?.requirement}
                        </div>
                      </td>

                      {/* MC Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.recognition?.mc_questions, row.recognition?.mc_count)}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>

                      {/* TF Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.recognition?.tf_questions, row.recognition?.tf_count)}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>

                      {/* SA Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.recognition?.sa_questions, row.recognition?.sa_count)}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>

                      {/* Essay Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.recognition?.essay_questions, row.recognition?.essay_count)}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                    </tr>

                    {/* Level 2: Hiểu */}
                    <tr className="hover:bg-slate-50/70 align-top border-t border-slate-100">
                      {/* Yêu cầu cần đạt: Hiểu */}
                      <td className="p-2 border-r border-slate-100 text-slate-700 leading-relaxed">
                        <span className="font-bold text-emerald-900 block mb-0.5">Thông hiểu:</span>
                        <div className="text-[11px] text-slate-600 whitespace-pre-line pl-1">
                          {row.comprehension?.requirement}
                        </div>
                      </td>

                      {/* MC Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.comprehension?.mc_questions, row.comprehension?.mc_count)}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>

                      {/* TF Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.comprehension?.tf_questions, row.comprehension?.tf_count)}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>

                      {/* SA Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.comprehension?.sa_questions, row.comprehension?.sa_count)}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>

                      {/* Essay Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.comprehension?.essay_questions, row.comprehension?.essay_count)}
                      </td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                    </tr>

                    {/* Level 3: Vận dụng */}
                    <tr className="hover:bg-slate-50/70 align-top border-t border-slate-100">
                      {/* Yêu cầu cần đạt: Vận dụng */}
                      <td className="p-2 border-r border-slate-100 text-slate-700 leading-relaxed">
                        <span className="font-bold text-amber-900 block mb-0.5">Vận dụng:</span>
                        <div className="text-[11px] text-slate-600 whitespace-pre-line pl-1">
                          {row.application?.requirement}
                        </div>
                      </td>

                      {/* MC Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.application?.mc_questions, row.application?.mc_count)}
                      </td>

                      {/* TF Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.application?.tf_questions, row.application?.tf_count)}
                      </td>

                      {/* SA Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.application?.sa_questions, row.application?.sa_count)}
                      </td>

                      {/* Essay Biết, Hiểu, Vận dụng */}
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 bg-slate-50/40 text-slate-400">-</td>
                      <td className="p-1.5 text-center border-r border-slate-100 font-semibold text-indigo-700">
                        {renderSpecCell(row.application?.essay_questions, row.application?.essay_count)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={4} className="p-2.5 text-left pl-3 border-r border-slate-200">
                    <div className="flex items-center justify-between pr-3">
                      <span>Tổng số câu / lệnh hỏi</span>
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-950 text-xs rounded-md font-black border border-indigo-200">
                        {summary.counts?.grand_total_questions ?? 0} câu
                      </span>
                    </div>
                  </td>
                  {/* MC */}
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.mc_rec ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.mc_com ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.mc_app ?? 0}</td>

                  {/* TF */}
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.tf_rec ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.tf_com ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.tf_app ?? 0}</td>

                  {/* SA */}
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.sa_rec ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.sa_com ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.sa_app ?? 0}</td>

                  {/* Essay */}
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.essay_rec ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.essay_com ?? 0}</td>
                  <td className="p-1.5 text-center border-r border-slate-200 font-black text-slate-800">{summary.counts?.essay_app ?? 0}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
