import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  CheckCircle2, 
  Calendar, 
  Plus, 
  AlertCircle, 
  FileText,
  Building2,
  ExternalLink
} from 'lucide-react';
import { LegalRegulation } from '../types/aiExam';
import { regulationService } from '../services/regulationService';

interface LegalRegulationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRegulation?: (reg: LegalRegulation) => void;
}

export const LegalRegulationsModal: React.FC<LegalRegulationsModalProps> = ({
  isOpen,
  onClose,
  onSelectRegulation,
}) => {
  const [regulations, setRegulations] = useState<LegalRegulation[]>(() => regulationService.getAll());
  const [selectedReg, setSelectedReg] = useState<LegalRegulation>(() => regulations[0]);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New regulation form
  const [newTitle, setNewTitle] = useState('');
  const [newDocNumber, setNewDocNumber] = useState('');
  const [newIssuedDate, setNewIssuedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEffectiveDate, setNewEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [newIssuer, setNewIssuer] = useState('Bộ Giáo dục và Đào tạo');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');

  if (!isOpen) return null;

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDocNumber.trim() || !newContent.trim()) {
      alert('Vui lòng điền đầy đủ tiêu đề, số hiệu văn bản và nội dung.');
      return;
    }

    const created = regulationService.addRegulation({
      title: newTitle,
      document_number: newDocNumber,
      issued_date: newIssuedDate,
      effective_date: newEffectiveDate,
      issuer: newIssuer,
      education_level: 'all',
      subject_scope: ['all'],
      summary: newSummary || newTitle,
      content: newContent,
      version: '1.0',
      status: 'active',
    });

    const refreshed = regulationService.getAll();
    setRegulations(refreshed);
    setSelectedReg(created);
    setIsAddingNew(false);

    // Reset
    setNewTitle('');
    setNewDocNumber('');
    setNewSummary('');
    setNewContent('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        id="legal-regulations-modal"
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Văn bản Pháp lý & Căn cứ Khảo thí</h2>
              <p className="text-xs text-slate-500">
                Các văn bản, thông tư, công văn quy định chuẩn ma trận, bản đặc tả và đề kiểm tra định kỳ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Left Column: Regulation List */}
          <div className="w-full md:w-80 bg-slate-50/50 p-4 overflow-y-auto shrink-0 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Danh sách văn bản ({regulations.length})
                </span>
                <button
                  onClick={() => setIsAddingNew(!isAddingNew)}
                  className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Thêm mới
                </button>
              </div>

              <div className="space-y-2">
                {regulations.map((reg, idx) => {
                  const isSelected = selectedReg.id === reg.id && !isAddingNew;
                  const isHighestPriority = idx === 0;

                  return (
                    <div
                      key={reg.id}
                      onClick={() => {
                        setSelectedReg(reg);
                        setIsAddingNew(false);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white border-indigo-500 shadow-xs ring-2 ring-indigo-500/10'
                          : 'bg-white/80 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {reg.document_number}
                        </span>
                        {isHighestPriority && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm">
                            Ưu tiên cao nhất
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-slate-800 line-clamp-2">
                        {reg.title}
                      </div>
                      <div className="mt-2 flex items-center text-[11px] text-slate-400 space-x-2">
                        <span>Hiệu lực: {reg.effective_date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Nguyên tắc áp dụng:</span> Văn bản có ngày hiệu lực mới hơn sẽ tự động được hệ thống AI ưu tiên tham chiếu trước.
            </div>
          </div>

          {/* Right Column: Detail View or Add Form */}
          <div className="flex-1 p-6 overflow-y-auto bg-white">
            {isAddingNew ? (
              <form onSubmit={handleCreateNew} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-base font-bold text-slate-900">
                    Bổ sung Văn bản / Công văn / Hướng dẫn mới
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Hủy bỏ
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số hiệu văn bản *
                    </label>
                    <input
                      type="text"
                      placeholder="VD: 7991/BGDĐT-GDTrH hoặc 123/SGDĐT-GDTrH"
                      value={newDocNumber}
                      onChange={(e) => setNewDocNumber(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cơ quan ban hành *
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Bộ Giáo dục và Đào tạo / Sở GD&ĐT"
                      value={newIssuer}
                      onChange={(e) => setNewIssuer(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên đầy đủ của văn bản *
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Hướng dẫn chuyên môn về kiểm tra đánh giá môn..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày ban hành
                    </label>
                    <input
                      type="date"
                      value={newIssuedDate}
                      onChange={(e) => setNewIssuedDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày có hiệu lực *
                    </label>
                    <input
                      type="date"
                      value={newEffectiveDate}
                      onChange={(e) => setNewEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tóm tắt quy định trọng tâm
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tóm lược các điểm mới, quy định thang điểm hoặc cấu trúc đề..."
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nội dung văn bản / Hướng dẫn chi tiết *
                  </label>
                  <textarea
                    rows={6}
                    placeholder="Dán toàn bộ nội dung công văn hoặc hướng dẫn chuyên môn để AI nạp làm tri thức tham chiếu..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                  >
                    Lưu văn bản pháp lý
                  </button>
                </div>
              </form>
            ) : (
              selectedReg && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                        {selectedReg.document_number}
                      </span>
                      <span className="text-xs font-medium text-slate-500 flex items-center">
                        <Building2 className="w-3.5 h-3.5 mr-1" />
                        {selectedReg.issuer}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {selectedReg.title}
                    </h3>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                      <span>Ban hành: {selectedReg.issued_date}</span>
                      <span>•</span>
                      <span>Có hiệu lực từ: {selectedReg.effective_date}</span>
                      <span>•</span>
                      <span className="inline-flex items-center text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Đang hiệu lực
                      </span>
                    </div>
                  </div>

                  {selectedReg.summary && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
                      <span className="font-bold">Trọng tâm: </span>
                      {selectedReg.summary}
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Nội dung chi tiết nạp vào AI:
                    </h4>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {selectedReg.content}
                    </div>
                  </div>

                  {onSelectRegulation && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          onSelectRegulation(selectedReg);
                          onClose();
                        }}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                      >
                        Chọn văn bản này làm căn cứ chính
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Hệ thống tự động đồng bộ căn cứ pháp lý vào quy trình tạo ma trận và bảng đặc tả của AI.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
