import { LegalRegulation } from '../types/aiExam';

const STORAGE_KEY = 'edusam_legal_regulations_v1';

export const INITIAL_REGULATIONS: LegalRegulation[] = [
  {
    id: 'reg-cv-7991',
    title: 'Công văn 7991/BGDĐT-GDTrH về việc hướng dẫn xây dựng ma trận, bản đặc tả và đề kiểm tra định kỳ',
    document_number: '7991/BGDĐT-GDTrH',
    issued_date: '2024-12-17',
    effective_date: '2024-12-17',
    subject_scope: ['all'],
    education_level: 'all',
    issuer: 'Bộ Giáo dục và Đào tạo - Vụ Giáo dục Trung học',
    summary: 'Khung ma trận, bản đặc tả đề kiểm tra định kỳ cấp THCS và THPT; quy chuẩn 4 dạng phần kiểm tra đánh giá (Nhiều lựa chọn, Đúng/Sai, Trả lời ngắn, Tự luận); phân bổ mức độ nhận thức Biết - Hiểu - Vận dụng.',
    content: `CÔNG VĂN 7991/BGDĐT-GDTrH (17/12/2024)
1. Nguyên tắc chung: Đề kiểm tra định kỳ phải xây dựng dựa trên ma trận và bản đặc tả đề kiểm tra.
2. Cấu trúc thang điểm: Tổng điểm toàn bài là 10,0 điểm.
3. Các dạng câu hỏi:
   - Dạng 1 (Phần I): Câu hỏi trắc nghiệm nhiều lựa chọn (chọn 1 phương án đúng trong 4 phương án).
   - Dạng 2 (Phần II): Câu hỏi trắc nghiệm Đúng - Sai (mỗi câu gồm 1 lệnh hỏi lớn và 4 ý a, b, c, d; học sinh chọn Đúng hoặc Sai cho từng ý).
   - Dạng 3 (Phần III): Câu hỏi trắc nghiệm dạng trả lời ngắn (học sinh tự điền đáp số/từ khóa ngắn gọn).
   - Dạng 4 (Phần IV): Câu hỏi tự luận (kèm biểu điểm, thang điểm và hướng dẫn chấm/rubric chi tiết).
4. Phân hóa năng lực học sinh: Cân đối hợp lý giữa các mức độ nhận thức Nhận biết, Thông hiểu, Vận dụng (và Vận dụng cao ở câu tự luận/phân hóa).
5. Đặc thù môn học: Không áp dụng máy móc cấu trúc Toán học cho các môn mang tính đặc thù cao như Ngữ văn (Đọc hiểu - Viết) hay Tiếng Anh (Kỹ năng ngôn ngữ).`,
    version: '1.0',
    status: 'active',
  },
  {
    id: 'reg-tt-32-gdpt2018',
    title: 'Thông tư 32/2018/TT-BGDĐT ban hành Chương trình Giáo dục phổ thông 2018',
    document_number: '32/2018/TT-BGDĐT',
    issued_date: '2018-12-26',
    effective_date: '2019-02-15',
    subject_scope: ['all'],
    education_level: 'all',
    issuer: 'Bộ Giáo dục và Đào tạo',
    summary: 'Quy định mục tiêu, yêu cầu cần đạt về phẩm chất và năng lực của từng môn học và hoạt động giáo dục cấp THCS và THPT.',
    content: `CHƯƠNG TRÌNH GIÁO DỤC PHỔ THÔNG 2018 (Thông tư 32/2018/TT-BGDĐT)
- Cốt lõi: Đánh giá sự hình thành và phát triển năng lực, phẩm chất của học sinh.
- Yêu cầu cần đạt: Căn cứ pháp lý cao nhất để xác định nội dung, mức độ nhận thức trong ma trận và bản đặc tả kiểm tra định kỳ.
- Ngữ văn: Đánh giá năng lực Đọc (văn bản thông tin, văn bản nghị luận, văn bản văn học với ngữ liệu mới) và năng lực Viết (nghị luận xã hội, nghị luận văn học).
- Ngoại ngữ (Tiếng Anh): Đánh giá 4 kỹ năng Nghe, Nói, Đọc, Viết và kiến thức ngôn ngữ (ngữ âm, từ vựng, ngữ pháp).
- Khoa học tự nhiên, Toán, Vật lí, Hóa học, Sinh học: Đánh giá năng lực nhận thức khoa học, tìm hiểu thế giới tự nhiên và vận dụng kiến thức, kĩ năng đã học vào thực tiễn.`,
    version: '1.0',
    status: 'active',
  },
  {
    id: 'reg-tt-22-danhgia',
    title: 'Thông tư 22/2021/TT-BGDĐT quy định về đánh giá học sinh trung học cơ sở và trung học phổ thông',
    document_number: '22/2021/TT-BGDĐT',
    issued_date: '2021-07-20',
    effective_date: '2021-09-05',
    subject_scope: ['all'],
    education_level: 'all',
    issuer: 'Bộ Giáo dục và Đào tạo',
    summary: 'Hình thức đánh giá định kỳ (kiểm tra giữa kỳ, kiểm tra cuối kỳ); thời lượng bài kiểm tra (45 - 90 phút); thang điểm 10,0 và nguyên tắc bảo đảm khách quan, công bằng.',
    content: `QUY ĐỊNH ĐÁNH GIÁ ĐỊNH KỲ (Thông tư 22/2021/TT-BGDĐT)
- Đánh giá định kỳ gồm: đánh giá giữa kì và đánh giá cuối kì.
- Bài kiểm tra được xây dựng dựa trên ma trận, đặc tả của đề kiểm tra, đáp ứng mức độ cần đạt của môn học.
- Điểm đánh giá định kỳ được tính theo thang điểm 10, làm tròn đến chữ số thập phân thứ nhất.`,
    version: '1.0',
    status: 'active',
  },
];

class RegulationService {
  private getStore(): LegalRegulation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REGULATIONS));
        return INITIAL_REGULATIONS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_REGULATIONS;
    }
  }

  private saveStore(regs: LegalRegulation[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(regs));
    } catch (e) {
      console.error('Failed to persist regulations', e);
    }
  }

  public getAll(): LegalRegulation[] {
    const list = this.getStore();
    // Sort by effective_date desc (newest regulation has precedence!)
    return list.sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime());
  }

  public getActiveRegulations(subject?: string, level?: 'THCS' | 'THPT'): LegalRegulation[] {
    const all = this.getAll().filter(r => r.status === 'active');
    return all.filter(r => {
      const matchLevel = r.education_level === 'all' || !level || r.education_level === level;
      const matchSubject = r.subject_scope.includes('all') || !subject || r.subject_scope.includes(subject);
      return matchLevel && matchSubject;
    });
  }

  public getPrimaryReference(subject?: string, level?: 'THCS' | 'THPT'): LegalRegulation {
    const active = this.getActiveRegulations(subject, level);
    return active[0] || INITIAL_REGULATIONS[0];
  }

  public addRegulation(reg: Omit<LegalRegulation, 'id'>): LegalRegulation {
    const list = this.getStore();
    const newReg: LegalRegulation = {
      ...reg,
      id: `reg-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(newReg);
    this.saveStore(list);
    return newReg;
  }

  public updateRegulation(id: string, updates: Partial<LegalRegulation>): LegalRegulation | null {
    const list = this.getStore();
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveStore(list);
    return list[idx];
  }

  public resetToDefaults(): void {
    this.saveStore(INITIAL_REGULATIONS);
  }
}

export const regulationService = new RegulationService();
