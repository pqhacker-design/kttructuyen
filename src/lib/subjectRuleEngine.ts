import { SubjectProfile, SubjectCode, ExamStructureConfig } from '../types/aiExam';

export const SUBJECT_PROFILES: Record<SubjectCode, SubjectProfile> = {
  toan: {
    id: 'sp-toan',
    subject_id: 'toan',
    name: 'Toán học',
    code: 'MATH',
    education_levels: ['THCS', 'THPT'],
    default_duration: 90,
    allowed_parts: [1, 2, 3, 4],
    allowed_question_types: ['single_choice', 'true_false', 'short_answer', 'essay'],
    special_requirements: [
      'Công thức toán học định dạng chuẩn LaTeX ($...$ hoặc $$...$$)',
      'Phần II Đúng/Sai gồm 1 tình huống/bài toán với 4 mệnh đề a, b, c, d độc lập',
      'Phần III Trả lời ngắn chỉ điền số hoặc phân số tối giản hoặc biểu thức ngắn',
      'Phần IV Tự luận có bước giải tường minh và rubric điểm theo từng bước (0.25 - 0.5đ)',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 90,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 1.0,
      cognitiveDistribution: {
        recognition: 3.0,
        comprehension: 3.0,
        application: 3.0,
        advanced_application: 1.0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
          description: 'Mỗi câu hỏi có 4 phương án, chỉ có 1 phương án đúng.',
          enabled: true,
          questionCount: 12,
          pointsPerQuestion: 0.25,
          totalPoints: 3.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
          description: 'Mỗi câu có 4 ý a, b, c, d. Chọn Đúng hoặc Sai cho từng ý.',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          statementsPerQuestion: 4,
          pointsPerStatement: 0.25,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Câu hỏi trắc nghiệm dạng trả lời ngắn',
          description: 'Thí sinh tự tính toán và ghi kết quả ngắn gọn vào ô đáp án.',
          enabled: true,
          questionCount: 4,
          pointsPerQuestion: 0.5,
          totalPoints: 2.0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Câu hỏi tự luận',
          description: 'Trình bày lời giải chi tiết, có thang điểm phân hóa.',
          enabled: true,
          questionCount: 2,
          totalPoints: 3.0,
          essayQuestions: [
            {
              id: 'essay-1',
              questionOrder: 1,
              title: 'Bài toán vận dụng thực tế',
              cognitiveLevel: 'application',
              isAdvancedApplication: false,
              points: 2.0,
              rubricItems: [
                { id: 'r1-1', criterion: 'Lập mô hình toán học / phương trình phù hợp', points: 0.5 },
                { id: 'r1-2', criterion: 'Thực hiện phép tính và biến đổi đại số chính xác', points: 1.0 },
                { id: 'r1-3', criterion: 'Kết luận và trả lời đúng yêu cầu bài toán', points: 0.5 },
              ],
            },
            {
              id: 'essay-2',
              questionOrder: 2,
              title: 'Bài toán tư duy nâng cao (Vận dụng cao)',
              cognitiveLevel: 'advanced_application',
              isAdvancedApplication: true,
              points: 1.0,
              rubricItems: [
                { id: 'r2-1', criterion: 'Đánh giá bất đẳng thức / điều kiện cực trị hoặc hình học', points: 0.5 },
                { id: 'r2-2', criterion: 'Hoàn thiện chứng minh và xác định dấu bằng xảy ra', points: 0.5 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_STANDARD',
      has_subtopic: true,
      required_sections: ['Đại số & Giải tích', 'Hình học & Đo lường', 'Thống kê & Xác suất'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Toán',
    },
    ai_generation_rules: {
      prompt_instructions: 'Sinh câu hỏi toán chuẩn, công thức dùng cú pháp LaTeX $...$. Không tạo bài toán vô nghiệm hoặc dữ kiện mâu thuẫn. Đáp án nhiễu phải xuất phát từ các sai lầm phổ biến của học sinh.',
      prohibited_patterns: ['Câu hỏi chỉ có lý thuyết suông không có biểu thức', 'Phương án nhiễu là các số ngẫu nhiên vô nghĩa'],
    },
  },

  ngu_van: {
    id: 'sp-ngu-van',
    subject_id: 'ngu_van',
    name: 'Ngữ văn',
    code: 'LIT',
    education_levels: ['THCS', 'THPT'],
    default_duration: 90,
    allowed_parts: [1, 4], // Ngữ văn đặc thù: Đọc hiểu và Viết (không dùng Phần II Đúng/Sai hay Phần III Trả lời ngắn theo kiểu trắc nghiệm máy móc!)
    allowed_question_types: ['single_choice', 'essay'],
    special_requirements: [
      'NGỮ LIỆU ĐỌC HIỂU: Phải sử dụng ngữ liệu mới (ngoài sách giáo khoa hiện hành) theo đúng tinh thần GDPT 2018',
      'Độ dài ngữ liệu: Thơ (1-3 khổ hoặc toàn bài ngắn), Truyện/Tản văn/Văn bản thông tin (300-600 chữ)',
      'Phần I Đọc hiểu: Hệ thống câu hỏi từ Nhận biết (thể thơ, phương thức biểu đạt, ngôi kể, chi tiết), Thông hiểu (ý nghĩa hình ảnh, biện pháp tu từ, thông điệp) đến Vận dụng (bài học rút ra, ý kiến cá nhân)',
      'Phần II Viết: Có 2 câu tự luận (1 câu Nghị luận xã hội khoảng 200 chữ 2.0 điểm, 1 câu Nghị luận văn học 4.0 điểm)',
      'Hướng dẫn chấm: BẮT BUỘC có Rubric chấm chi tiết (Đảm bảo hình thức, Xác định đúng vấn đề, Triển khai luận điểm, Sáng tạo, Chính tả/ngữ pháp)',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 90,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 1.0,
      cognitiveDistribution: {
        recognition: 2.0,
        comprehension: 2.0,
        application: 5.0,
        advanced_application: 1.0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: ĐỌC HIỂU (4,0 điểm)',
          description: 'Đọc đoạn trích/văn bản và trả lời các câu hỏi trắc nghiệm kết hợp tự luận ngắn.',
          enabled: true,
          questionCount: 8,
          pointsPerQuestion: 0.5,
          totalPoints: 4.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Đúng/Sai (Tắt đối với Ngữ văn)',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Trả lời ngắn (Tắt đối với Ngữ văn)',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần II: VIẾT (6,0 điểm)',
          description: 'Gồm câu viết đoạn văn nghị luận xã hội và bài văn nghị luận.',
          enabled: true,
          questionCount: 2,
          totalPoints: 6.0,
          essayQuestions: [
            {
              id: 'lit-essay-1',
              questionOrder: 1,
              title: 'Câu 1 (2,0 điểm): Viết đoạn văn nghị luận xã hội',
              cognitiveLevel: 'application',
              isAdvancedApplication: false,
              points: 2.0,
              requirementType: 'Đoạn văn khoảng 200 chữ bày tỏ suy nghĩ về một vấn đề rút ra từ ngữ liệu đọc hiểu',
              rubricItems: [
                { id: 'lr1-1', criterion: 'Bảo đảm yêu cầu về hình thức đoạn văn (khoảng 200 chữ, không ngắt đoạn tùy tiện)', points: 0.25 },
                { id: 'lr1-2', criterion: 'Xác định đúng vấn đề cần nghị luận', points: 0.25 },
                { id: 'lr1-3', criterion: 'Triển khai vấn đề nghị luận hợp lí, có dẫn chứng thực tế thuyết phục', points: 1.0 },
                { id: 'lr1-4', criterion: 'Chính tả, ngữ pháp, diễn đạt trong sáng', points: 0.25 },
                { id: 'lr1-5', criterion: 'Sáng tạo (có suy nghĩ sâu sắc, mới mẻ, giọng điệu riêng)', points: 0.25 },
              ],
            },
            {
              id: 'lit-essay-2',
              questionOrder: 2,
              title: 'Câu 2 (4,0 điểm): Viết bài văn nghị luận văn học',
              cognitiveLevel: 'advanced_application',
              isAdvancedApplication: true,
              points: 4.0,
              requirementType: 'Phân tích, đánh giá chủ đề và những nét đặc sắc về nghệ thuật của tác phẩm/đoạn trích',
              rubricItems: [
                { id: 'lr2-1', criterion: 'Bảo đảm cấu trúc bài văn nghị luận (Mở bài, Thân bài, Kết bài)', points: 0.25 },
                { id: 'lr2-2', criterion: 'Xác định đúng vấn đề cần nghị luận', points: 0.5 },
                { id: 'lr2-3', criterion: 'Phân tích chủ đề và giá trị nội dung tác phẩm', points: 1.5 },
                { id: 'lr2-4', criterion: 'Phân tích nét đặc sắc nghệ thuật (hình ảnh, ngôn từ, kết cấu)', points: 1.0 },
                { id: 'lr2-5', criterion: 'Chính tả, dùng từ, đặt câu', points: 0.25 },
                { id: 'lr2-6', criterion: 'Sáng tạo và tư duy phản biện (liên hệ so sánh sâu sắc)', points: 0.5 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'LITERATURE_GDPT2018',
      has_subtopic: true,
      required_sections: ['Đọc hiểu văn bản', 'Thực hành Tiếng Việt', 'Viết đoạn văn NLXH', 'Viết bài văn'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Ngữ văn',
    },
    ai_generation_rules: {
      prompt_instructions: 'Phải chọn ngữ liệu đọc hiểu thẩm mỹ, có tính giáo dục, nguồn dẫn rõ ràng. Không dùng các ngữ liệu cũ đã in trong SGK để đảm bảo đánh giá đúng năng lực đọc hiểu của học sinh. Rubric chấm tự luận phải có các tiêu chí chuẩn 0.25đ.',
      prohibited_patterns: ['Lấy văn bản trong SGK làm ngữ liệu đọc hiểu', 'Câu hỏi hỏi lại nguyên xi câu chữ mà không yêu cầu suy luận'],
    },
  },

  tieng_anh: {
    id: 'sp-tieng-anh',
    subject_id: 'tieng_anh',
    name: 'Tiếng Anh',
    code: 'ENG',
    education_levels: ['THCS', 'THPT'],
    default_duration: 60,
    allowed_parts: [1, 2, 3, 4],
    allowed_question_types: ['single_choice', 'true_false', 'short_answer', 'essay'],
    special_requirements: [
      'Đánh giá các kỹ năng: Phonetics (Pronunciation/Stress), Vocabulary & Grammar, Functional Communication, Reading (Guided Cloze & Comprehension), Writing',
      'Hỗ trợ cấu hình kỹ năng (Nghe có file Audio, Đọc có bài đọc 200-350 từ, Viết câu viết lại hoặc viết đoạn)',
      'Không tạo phương án nhiễu sai ngữ pháp cơ bản hoặc dễ loại trừ',
      'Đảm bảo tính tự nhiên của tiếng Anh chuẩn (Authentic English)',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 60,
      allowAdvancedApplication: true,
      advancedApplicationCount: 2,
      advancedApplicationPoints: 1.0,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.0,
        advanced_application: 1.0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Part I: Multiple Choice Questions (Language & Reading)',
          description: 'Pronunciation, vocabulary, grammar, communication, and reading comprehension.',
          enabled: true,
          questionCount: 28,
          pointsPerQuestion: 0.25,
          totalPoints: 7.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Part II: True / False Statements (Reading / Listening Context)',
          description: 'Decide whether each statement is True or False according to the passage.',
          enabled: true,
          questionCount: 1,
          pointsPerQuestion: 1.0,
          statementsPerQuestion: 4,
          pointsPerStatement: 0.25,
          totalPoints: 1.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Part III: Short Answer / Word Formation',
          description: 'Supply the correct word form or fill in the blank with one suitable word.',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Part IV: Writing (Sentence Transformation & Short Paragraph)',
          description: 'Rewrite sentences keeping the same meaning, or write a short paragraph of 100-120 words.',
          enabled: true,
          questionCount: 2,
          totalPoints: 2.0,
          essayQuestions: [
            {
              id: 'eng-essay-1',
              questionOrder: 1,
              title: 'Sentence transformation (4 sentences)',
              cognitiveLevel: 'application',
              points: 1.0,
              requirementType: 'Finish each of the sentences in such a way that it means the same as the sentence printed before it.',
              rubricItems: [
                { id: 'er1-1', criterion: 'Sentence 1 transformed accurately without grammatical errors', points: 0.25 },
                { id: 'er1-2', criterion: 'Sentence 2 transformed accurately without grammatical errors', points: 0.25 },
                { id: 'er1-3', criterion: 'Sentence 3 transformed accurately without grammatical errors', points: 0.25 },
                { id: 'er1-4', criterion: 'Sentence 4 transformed accurately without grammatical errors', points: 0.25 },
              ],
            },
            {
              id: 'eng-essay-2',
              questionOrder: 2,
              title: 'Paragraph writing (about 100-120 words)',
              cognitiveLevel: 'advanced_application',
              isAdvancedApplication: true,
              points: 1.0,
              requirementType: 'Write a paragraph (100-120 words) about a given topic.',
              rubricItems: [
                { id: 'er2-1', criterion: 'Task achievement & content relevance', points: 0.3 },
                { id: 'er2-2', criterion: 'Coherence & cohesion with appropriate linking devices', points: 0.3 },
                { id: 'er2-3', criterion: 'Lexical resource & grammatical accuracy', points: 0.4 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'ENGLISH_SKILLS_GDPT2018',
      has_subtopic: true,
      required_sections: ['Ngữ âm (Phonetics)', 'Ngữ pháp & Từ vựng', 'Giao tiếp (Speaking/Function)', 'Đọc hiểu (Reading)', 'Viết (Writing)'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Tiếng Anh',
    },
    ai_generation_rules: {
      prompt_instructions: 'Generate high-quality authentic English. Distractors must be grammatically plausible. Provide clear pronunciation targets (underlined letters) and context-based vocabulary.',
      prohibited_patterns: ['Unnatural translation English', 'Sentences with more than one grammatically correct choice'],
    },
  },

  khtn: {
    id: 'sp-khtn',
    subject_id: 'khtn',
    name: 'Khoa học tự nhiên (Lớp 6, 7, 8, 9)',
    code: 'KHTN',
    education_levels: ['THCS'],
    default_duration: 60,
    allowed_parts: [1, 2, 3, 4],
    allowed_question_types: ['single_choice', 'true_false', 'short_answer', 'essay'],
    special_requirements: [
      'Phân bổ cân đối các mạch nội dung: Chất và sự biến đổi của chất (Hóa), Năng lượng và sự biến đổi (Lý), Vật sống (Sinh)',
      'Gắn liền với hiện tượng tự nhiên và thí nghiệm thực hành',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 60,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 0.5,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.5,
        advanced_application: 0.5,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 16,
          pointsPerQuestion: 0.25,
          totalPoints: 4.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Trắc nghiệm Đúng - Sai',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Trả lời ngắn',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 0.5,
          totalPoints: 1.0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận',
          enabled: true,
          questionCount: 2,
          totalPoints: 3.0,
          essayQuestions: [
            {
              id: 'khtn-e1',
              questionOrder: 1,
              title: 'Bài tập giải thích hiện tượng tự nhiên / hóa học',
              cognitiveLevel: 'application',
              points: 2.0,
              rubricItems: [
                { id: 'k1-1', criterion: 'Xác định đúng bản chất hiện tượng', points: 1.0 },
                { id: 'k1-2', criterion: 'Viết phương trình / tính toán khối lượng hoặc năng lượng', points: 1.0 },
              ],
            },
            {
              id: 'khtn-e2',
              questionOrder: 2,
              title: 'Vận dụng kiến thức bảo vệ môi trường / sinh học',
              cognitiveLevel: 'advanced_application',
              isAdvancedApplication: true,
              points: 1.0,
              rubricItems: [
                { id: 'k2-1', criterion: 'Đề xuất giải pháp khoa học thực tiễn', points: 0.5 },
                { id: 'k2-2', criterion: 'Phân tích ưu nhược điểm giải pháp', points: 0.5 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_KHTN',
      has_subtopic: true,
      required_sections: ['Chất và sự biến đổi của chất', 'Năng lượng và sự biến đổi', 'Vật sống', 'Trái Đất và bầu trời'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn KHTN',
    },
    ai_generation_rules: {
      prompt_instructions: 'Gắn liền với thí nghiệm thực tiễn và bảng số liệu, ứng dụng công nghệ đời sống.',
      prohibited_patterns: ['Câu hỏi hàn lâm thuần túy ngoài đời thực'],
    },
  },

  vat_ly: {
    id: 'sp-vat-ly',
    subject_id: 'vat_ly',
    name: 'Vật lí',
    code: 'PHYS',
    education_levels: ['THPT'],
    default_duration: 50,
    allowed_parts: [1, 2, 3, 4],
    allowed_question_types: ['single_choice', 'true_false', 'short_answer', 'essay'],
    special_requirements: [
      'Đồ thị, hình vẽ mô phỏng chuyển động, mạch điện, từ trường, nhiệt động lực học',
      'Đơn vị đo lường theo chuẩn SI',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 50,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 0.5,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.5,
        advanced_application: 0.5,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 18,
          pointsPerQuestion: 0.25,
          totalPoints: 4.5,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
          enabled: true,
          questionCount: 4,
          pointsPerQuestion: 1.0,
          totalPoints: 4.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Câu hỏi dạng trả lời ngắn',
          enabled: true,
          questionCount: 3,
          pointsPerQuestion: 0.5,
          totalPoints: 1.5,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận (Tùy chọn)',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_PHYSICS',
      has_subtopic: true,
      required_sections: ['Cơ học', 'Nhiệt học', 'Điện từ học', 'Quang học', 'Vật lí hạt nhân'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Vật lí',
    },
    ai_generation_rules: {
      prompt_instructions: 'Mô tả rõ các giả thiết, bỏ qua ma sát hoặc lực cản nếu không đề cập. Đơn vị phải chuẩn xác.',
      prohibited_patterns: ['Thiếu đơn vị ở các phương án tính toán'],
    },
  },

  hoa_hoc: {
    id: 'sp-hoa-hoc',
    subject_id: 'hoa_hoc',
    name: 'Hóa học',
    code: 'CHEM',
    education_levels: ['THPT'],
    default_duration: 50,
    allowed_parts: [1, 2, 3, 4],
    allowed_question_types: ['single_choice', 'true_false', 'short_answer', 'essay'],
    special_requirements: [
      'Sử dụng danh pháp IUPAC theo chương trình GDPT 2018 (Ví dụ: Sodium, Methanoic acid, Ethan-1-ol)',
      'Phương trình phản ứng ghi rõ điều kiện và trạng thái nếu cần',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 50,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 0.5,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.5,
        advanced_application: 0.5,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 18,
          pointsPerQuestion: 0.25,
          totalPoints: 4.5,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
          enabled: true,
          questionCount: 4,
          pointsPerQuestion: 1.0,
          totalPoints: 4.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Câu hỏi dạng trả lời ngắn',
          enabled: true,
          questionCount: 3,
          pointsPerQuestion: 0.5,
          totalPoints: 1.5,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận (Tùy chọn)',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_CHEMISTRY',
      has_subtopic: true,
      required_sections: ['Nguyên tử & Bảng tuần hoàn', 'Liên kết hóa học', 'Năng lượng hóa học & Tốc độ phản ứng', 'Hóa học hữu cơ'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Hóa học',
    },
    ai_generation_rules: {
      prompt_instructions: 'BẮT BUỘC dùng danh pháp IUPAC quốc tế theo GDPT 2018. Khối lượng nguyên tử ghi rõ khi cần tính toán.',
      prohibited_patterns: ['Dùng tên gọi cũ như Axit sunfuric, Natri thay vì Sulfuric acid, Sodium'],
    },
  },

  sinh_hoc: {
    id: 'sp-sinh-hoc',
    subject_id: 'sinh_hoc',
    name: 'Sinh học',
    code: 'BIO',
    education_levels: ['THPT'],
    default_duration: 50,
    allowed_parts: [1, 2, 3, 4],
    allowed_question_types: ['single_choice', 'true_false', 'short_answer', 'essay'],
    special_requirements: [
      'Gắn với cơ chế di truyền phân tử, tế bào học, sinh thái học và tiến hóa',
      'Phần II Đúng/Sai phân tích sơ đồ phả hệ hoặc bảng số liệu thực nghiệm',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 50,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 0.5,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.5,
        advanced_application: 0.5,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 18,
          pointsPerQuestion: 0.25,
          totalPoints: 4.5,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Câu hỏi trắc nghiệm Đúng - Sai',
          enabled: true,
          questionCount: 4,
          pointsPerQuestion: 1.0,
          totalPoints: 4.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Câu hỏi dạng trả lời ngắn',
          enabled: true,
          questionCount: 3,
          pointsPerQuestion: 0.5,
          totalPoints: 1.5,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_BIOLOGY',
      has_subtopic: true,
      required_sections: ['Sinh học tế bào', 'Di truyền học', 'Tiến hóa', 'Sinh thái học'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Sinh học',
    },
    ai_generation_rules: {
      prompt_instructions: 'Câu hỏi phân tích cơ chế, sơ đồ lai, giải quyết vấn đề sức khỏe và nông nghiệp bền vững.',
      prohibited_patterns: ['Các câu hỏi ghi nhớ con số máy móc vô nghĩa'],
    },
  },

  lich_su: {
    id: 'sp-lich-su',
    subject_id: 'lich_su',
    name: 'Lịch sử',
    code: 'HIST',
    education_levels: ['THCS', 'THPT'],
    default_duration: 45,
    allowed_parts: [1, 2, 4],
    allowed_question_types: ['single_choice', 'true_false', 'essay'],
    special_requirements: [
      'Đánh giá nhận thức lịch sử, tư duy lịch sử, giải thích nguyên nhân và rút ra bài học kinh nghiệm',
      'Tránh hỏi vụn vặt về ngày tháng nếu không mang ý nghĩa bước ngoặt',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 45,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 1.0,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.0,
        advanced_application: 1.0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 24,
          pointsPerQuestion: 0.25,
          totalPoints: 6.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Trắc nghiệm Đúng - Sai (Trích dẫn sử liệu)',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Trả lời ngắn',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận / Đánh giá lịch sử',
          enabled: true,
          questionCount: 1,
          totalPoints: 2.0,
          essayQuestions: [
            {
              id: 'hist-e1',
              questionOrder: 1,
              title: 'Đánh giá ý nghĩa lịch sử và rút ra bài học cho hiện nay',
              cognitiveLevel: 'application',
              isAdvancedApplication: true,
              points: 2.0,
              rubricItems: [
                { id: 'h1-1', criterion: 'Nêu đúng bối cảnh và ý nghĩa lịch sử', points: 1.0 },
                { id: 'h1-2', criterion: 'Rút ra bài học kinh nghiệm sâu sắc cho sự nghiệp bảo vệ/xây dựng đất nước', points: 1.0 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_HISTORY',
      has_subtopic: true,
      required_sections: ['Lịch sử thế giới', 'Lịch sử khu vực Đông Nam Á', 'Lịch sử Việt Nam'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Lịch sử',
    },
    ai_generation_rules: {
      prompt_instructions: 'Sử dụng trích dẫn văn kiện, nhận định của các nhà sử học để làm ngữ liệu kiểm tra năng lực.',
      prohibited_patterns: ['Bắt học sinh nhớ máy móc từng giờ từng phút'],
    },
  },

  dia_ly: {
    id: 'sp-dia-ly',
    subject_id: 'dia_ly',
    name: 'Địa lí',
    code: 'GEO',
    education_levels: ['THCS', 'THPT'],
    default_duration: 45,
    allowed_parts: [1, 2, 4],
    allowed_question_types: ['single_choice', 'true_false', 'essay'],
    special_requirements: [
      'Đọc bản đồ, Atlat Địa lí Việt Nam, bảng số liệu thống kê, nhận xét biểu đồ',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 45,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 1.0,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.0,
        advanced_application: 1.0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Trắc nghiệm nhiều lựa chọn (Lí thuyết & Kĩ năng Atlat/Biểu đồ)',
          enabled: true,
          questionCount: 24,
          pointsPerQuestion: 0.25,
          totalPoints: 6.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Trắc nghiệm Đúng - Sai (Phân tích bảng số liệu/tình huống)',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Trả lời ngắn',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận (Phân tích giải pháp phát triển kinh tế - xã hội)',
          enabled: true,
          questionCount: 1,
          totalPoints: 2.0,
          essayQuestions: [
            {
              id: 'geo-e1',
              questionOrder: 1,
              title: 'Phân tích thế mạnh và định hướng phát triển một vùng kinh tế',
              cognitiveLevel: 'application',
              isAdvancedApplication: true,
              points: 2.0,
              rubricItems: [
                { id: 'g1-1', criterion: 'Trình bày đúng điều kiện tự nhiên và kinh tế - xã hội', points: 1.0 },
                { id: 'g1-2', criterion: 'Đề xuất định hướng khai thác hiệu quả và bền vững', points: 1.0 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_GEOGRAPHY',
      has_subtopic: true,
      required_sections: ['Địa lí tự nhiên', 'Địa lí dân cư', 'Địa lí các ngành kinh tế', 'Địa lí các vùng kinh tế'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Địa lí',
    },
    ai_generation_rules: {
      prompt_instructions: 'Rèn luyện kĩ năng đọc bảng số liệu, nhận diện dạng biểu đồ và giải thích mối quan hệ nhân quả địa lí.',
      prohibited_patterns: ['Số liệu cổ lỗ sĩ không bám sát tình hình hiện nay'],
    },
  },

  gdcd_gdktpl: {
    id: 'sp-gdcd-gdktpl',
    subject_id: 'gdcd_gdktpl',
    name: 'Giáo dục công dân / GDKT & PL',
    code: 'CIVIC',
    education_levels: ['THCS', 'THPT'],
    default_duration: 45,
    allowed_parts: [1, 2, 4],
    allowed_question_types: ['single_choice', 'true_false', 'essay'],
    special_requirements: [
      'Xử lý tình huống pháp luật và kinh tế gắn liền với đời sống thực tế',
      'Đánh giá hành vi của các chủ thể pháp luật/kinh tế',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 45,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 1.0,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 2.0,
        advanced_application: 1.0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 24,
          pointsPerQuestion: 0.25,
          totalPoints: 6.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Đúng - Sai (Giải quyết tình huống kinh tế / pháp luật)',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Trả lời ngắn',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận (Phân tích tình huống pháp lý và trách nhiệm công dân)',
          enabled: true,
          questionCount: 1,
          totalPoints: 2.0,
          essayQuestions: [
            {
              id: 'civic-e1',
              questionOrder: 1,
              title: 'Phân tích hành vi vi phạm pháp luật và đề xuất ứng xử đúng đắn',
              cognitiveLevel: 'application',
              isAdvancedApplication: true,
              points: 2.0,
              rubricItems: [
                { id: 'c1-1', criterion: 'Chỉ ra chủ thể vi phạm và loại vi phạm pháp luật', points: 1.0 },
                { id: 'c1-2', criterion: 'Rút ra bài học về quyền và nghĩa vụ công dân', points: 1.0 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_CIVICS',
      has_subtopic: true,
      required_sections: ['Giáo dục kinh tế', 'Giáo dục pháp luật', 'Đạo đức và kĩ năng sống'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn GDKT&PL',
    },
    ai_generation_rules: {
      prompt_instructions: 'Tình huống phải mang tính thời sự, các nhân vật có hành vi rõ ràng để học sinh nhận xét khách quan.',
      prohibited_patterns: ['Tình huống mơ hồ không đủ căn cứ pháp lý kết luận'],
    },
  },

  tin_hoc: {
    id: 'sp-tin-hoc',
    subject_id: 'tin_hoc',
    name: 'Tin học',
    code: 'CS',
    education_levels: ['THCS', 'THPT'],
    default_duration: 45,
    allowed_parts: [1, 2, 3, 4],
    allowed_question_types: ['single_choice', 'true_false', 'short_answer', 'essay'],
    special_requirements: [
      'Đoạn mã lập trình (Python/C++ chuẩn GDPT 2018), thuật toán, cơ sở dữ liệu, an toàn thông tin',
      'Phần III Trả lời ngắn hỏi giá trị đầu ra (Output) của đoạn chương trình',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 45,
      allowAdvancedApplication: true,
      advancedApplicationCount: 1,
      advancedApplicationPoints: 1.0,
      cognitiveDistribution: {
        recognition: 3.5,
        comprehension: 3.0,
        application: 2.5,
        advanced_application: 1.0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 16,
          pointsPerQuestion: 0.25,
          totalPoints: 4.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Đúng - Sai (Phân tích thuật toán / mã nguồn)',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Trả lời ngắn (Giá trị trả về của hàm / biến sau vòng lặp)',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 0.5,
          totalPoints: 1.0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận (Viết giải thuật / chương trình)',
          enabled: true,
          questionCount: 1,
          totalPoints: 3.0,
          essayQuestions: [
            {
              id: 'cs-e1',
              questionOrder: 1,
              title: 'Viết chương trình giải quyết bài toán thực tế',
              cognitiveLevel: 'application',
              isAdvancedApplication: true,
              points: 3.0,
              rubricItems: [
                { id: 'cs1-1', criterion: 'Xác định input/output và thiết kế cấu trúc dữ liệu', points: 1.0 },
                { id: 'cs1-2', criterion: 'Cài đặt thuật toán chính xác, tối ưu thời gian/bộ nhớ', points: 1.5 },
                { id: 'cs1-3', criterion: 'Quy chuẩn đặt tên biến và chú thích rõ ràng', points: 0.5 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_CS',
      has_subtopic: true,
      required_sections: ['Học máy & Khoa học máy tính', 'Công nghệ thông tin & Truyền thông', 'Ứng dụng tin học'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Tin học',
    },
    ai_generation_rules: {
      prompt_instructions: 'Đoạn mã phải viết bằng Python 3 hoặc C++ chuẩn, thụt lề chuẩn xác.',
      prohibited_patterns: ['Mã nguồn có lỗi cú pháp chạy không được'],
    },
  },

  cong_nghe: {
    id: 'sp-cong-nghe',
    subject_id: 'cong_nghe',
    name: 'Công nghệ',
    code: 'TECH',
    education_levels: ['THCS', 'THPT'],
    default_duration: 45,
    allowed_parts: [1, 2, 4],
    allowed_question_types: ['single_choice', 'true_false', 'essay'],
    special_requirements: [
      'Gắn liền với định hướng nông nghiệp hoặc công nghiệp (Điện tử, Cơ khí, Thiết kế công nghệ)',
    ],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 45,
      allowAdvancedApplication: false,
      advancedApplicationCount: 0,
      advancedApplicationPoints: 0,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 3.0,
        advanced_application: 0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 20,
          pointsPerQuestion: 0.25,
          totalPoints: 5.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Đúng - Sai (Quy trình công nghệ / Kĩ thuật)',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Trả lời ngắn',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận (Đề xuất giải pháp kĩ thuật / Sơ đồ mạch điện)',
          enabled: true,
          questionCount: 1,
          totalPoints: 3.0,
          essayQuestions: [
            {
              id: 'tech-e1',
              questionOrder: 1,
              title: 'Quy trình sản xuất / Thiết kế mạch điều khiển đơn giản',
              cognitiveLevel: 'application',
              points: 3.0,
              rubricItems: [
                { id: 't1-1', criterion: 'Vẽ sơ đồ nguyên lý / quy trình', points: 1.5 },
                { id: 't1-2', criterion: 'Giải thích nguyên lý và các lưu ý an toàn lao động', points: 1.5 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_TECH',
      has_subtopic: true,
      required_sections: ['Vẽ kĩ thuật & Thiết kế', 'Cơ khí & Động lực', 'Điện - Điện tử', 'Nông nghiệp công nghệ cao'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018 môn Công nghệ',
    },
    ai_generation_rules: {
      prompt_instructions: 'Nhấn mạnh vào an toàn lao động, bảo vệ môi trường và ứng dụng công nghệ 4.0.',
      prohibited_patterns: ['Công nghệ cũ không còn sử dụng'],
    },
  },

  other: {
    id: 'sp-other',
    subject_id: 'other',
    name: 'Môn học khác',
    code: 'GEN',
    education_levels: ['THCS', 'THPT'],
    default_duration: 45,
    allowed_parts: [1, 2, 3, 4],
    allowed_question_types: ['single_choice', 'true_false', 'short_answer', 'essay'],
    special_requirements: ['Tuân thủ quy định khung kiểm tra định kỳ CV 7991'],
    default_structure: {
      totalScore: 10.0,
      durationMinutes: 45,
      allowAdvancedApplication: false,
      advancedApplicationCount: 0,
      advancedApplicationPoints: 0,
      cognitiveDistribution: {
        recognition: 4.0,
        comprehension: 3.0,
        application: 3.0,
        advanced_application: 0,
      },
      parts: [
        {
          part: 1,
          type: 'multiple_choice',
          title: 'Phần I: Trắc nghiệm nhiều lựa chọn',
          enabled: true,
          questionCount: 20,
          pointsPerQuestion: 0.25,
          totalPoints: 5.0,
        },
        {
          part: 2,
          type: 'true_false',
          title: 'Phần II: Đúng - Sai',
          enabled: true,
          questionCount: 2,
          pointsPerQuestion: 1.0,
          totalPoints: 2.0,
        },
        {
          part: 3,
          type: 'short_answer',
          title: 'Phần III: Trả lời ngắn',
          enabled: false,
          questionCount: 0,
          totalPoints: 0,
        },
        {
          part: 4,
          type: 'essay',
          title: 'Phần IV: Tự luận',
          enabled: true,
          questionCount: 1,
          totalPoints: 3.0,
          essayQuestions: [
            {
              id: 'gen-e1',
              questionOrder: 1,
              title: 'Câu hỏi tự luận vận dụng kiến thức',
              cognitiveLevel: 'application',
              points: 3.0,
              rubricItems: [
                { id: 'g1', criterion: 'Trình bày đầy đủ nội dung yêu cầu', points: 2.0 },
                { id: 'g2', criterion: 'Lập luận chặt chẽ, liên hệ thực tiễn', points: 1.0 },
              ],
            },
          ],
        },
      ],
    },
    matrix_rules: {
      format: 'CV_7991_STANDARD',
      has_subtopic: true,
      required_sections: ['Lí thuyết trọng tâm', 'Vận dụng thực tiễn'],
    },
    specification_rules: {
      requires_learning_objectives: true,
      standard_reference: 'Chương trình GDPT 2018',
    },
    ai_generation_rules: {
      prompt_instructions: 'Xây dựng câu hỏi bám sát chuẩn kiến thức kĩ năng.',
      prohibited_patterns: [],
    },
  },
};

export class SubjectRuleEngine {
  public static getProfile(subjectId: SubjectCode): SubjectProfile {
    return SUBJECT_PROFILES[subjectId] || SUBJECT_PROFILES.toan;
  }

  public static getAllProfiles(): SubjectProfile[] {
    return Object.values(SUBJECT_PROFILES);
  }

  public static getCurriculumTopics(subjectId: SubjectCode, grade: number): { topic: string; units: string[] }[] {
    // Standard GDPT 2018 topic units database
    if (subjectId === 'toan') {
      if (grade === 10) {
        return [
          {
            topic: 'Mệnh đề và Tập hợp',
            units: ['Mệnh đề toán học', 'Tập hợp và các phép toán trên tập hợp'],
          },
          {
            topic: 'Bất phương trình và Hệ bất phương trình bậc nhất hai ẩn',
            units: ['Bất phương trình bậc nhất hai ẩn', 'Hệ bất phương trình bậc nhất hai ẩn và ứng dụng thực tế'],
          },
          {
            topic: 'Hàm số bậc hai và Đồ thị',
            units: ['Hàm số và đồ thị', 'Hàm số bậc hai', 'Dấu của tam thức bậc hai'],
          },
          {
            topic: 'Hệ thức lượng trong tam giác',
            units: ['Giá trị lượng giác của một góc từ 0° đến 180°', 'Định lí côsin và định lí sin', 'Giải tam giác và ứng dụng thực tế'],
          },
          {
            topic: 'Vectơ trong mặt phẳng',
            units: ['Khái niệm vectơ', 'Tổng và hiệu của hai vectơ', 'Tích của một số với một vectơ', 'Tích vô hướng của hai vectơ'],
          },
        ];
      }
      if (grade === 11) {
        return [
          {
            topic: 'Hàm số lượng giác và Phương trình lượng giác',
            units: ['Góc lượng giác', 'Giá trị lượng giác của góc lượng giác', 'Các phép biến đổi lượng giác', 'Hàm số lượng giác và đồ thị', 'Phương trình lượng giác cơ bản'],
          },
          {
            topic: 'Dãy số, Cấp số cộng và Cấp số nhân',
            units: ['Dãy số', 'Cấp số cộng', 'Cấp số nhân'],
          },
          {
            topic: 'Giới hạn và Hàm số liên tục',
            units: ['Giới hạn của dãy số', 'Giới hạn của hàm số', 'Hàm số liên tục'],
          },
          {
            topic: 'Quan hệ song song trong không gian',
            units: ['Đường thẳng và mặt phẳng trong không gian', 'Hai đường thẳng song song', 'Đường thẳng và mặt phẳng song song', 'Hai mặt phẳng song song'],
          },
        ];
      }
      if (grade === 12) {
        return [
          {
            topic: 'Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
            units: ['Tính đơn điệu và cực trị của hàm số', 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số', 'Đường tiệm cận của đồ thị hàm số', 'Khảo sát sự biến thiên và vẽ đồ thị của hàm số', 'Ứng dụng đạo hàm giải quyết một số bài toán thực tế'],
          },
          {
            topic: 'Toạ độ của vectơ trong không gian',
            units: ['Hệ toạ độ trong không gian', 'Toạ độ của vectơ trong không gian', 'Biểu thức toạ độ của các phép toán vectơ'],
          },
          {
            topic: 'Các số đặc trưng đo mức độ phân tán cho mẫu số liệu ghép nhóm',
            units: ['Khoảng biến thiên và khoảng tứ phân vị', 'Phương sai và độ lệch chuẩn của mẫu số liệu ghép nhóm'],
          },
        ];
      }
    }

    if (subjectId === 'ngu_van') {
      return [
        {
          topic: 'Đọc hiểu Văn bản Thơ (Thơ tự do, Thơ hiện đại)',
          units: ['Thể thơ, vần, nhịp và cấu tứ', 'Hình tượng thơ và biện pháp tu từ', 'Cảm xúc chủ đạo và tư tưởng thông điệp'],
        },
        {
          topic: 'Đọc hiểu Văn bản Truyện / Kí',
          units: ['Cốt truyện, nhân vật và ngôi kể', 'Chi tiết tiêu biểu và điểm nhìn trần thuật', 'Chủ đề và chiều sâu nhân văn'],
        },
        {
          topic: 'Thực hành Tiếng Việt',
          units: ['Biện pháp tu từ cú pháp và từ vựng', 'Lỗi dùng từ, ngữ pháp và cách sửa', 'Liên kết văn bản và mạch lạc'],
        },
        {
          topic: 'Viết Đoạn văn Nghị luận Xã hội (Khoảng 200 chữ)',
          units: ['Giải thích vấn đề tư tưởng, đạo lí hoặc hiện tượng đời sống', 'Bàn luận, phân tích dẫn chứng thực tế', 'Bài học nhận thức và hành động'],
        },
        {
          topic: 'Viết Bài văn Nghị luận Văn học / Xã hội',
          units: ['Mở bài trực tiếp hoặc gián tiếp ấn tượng', 'Hệ thống luận điểm rõ ràng, dẫn chứng sâu sắc', 'Đánh giá giá trị nội dung và nghệ thuật'],
        },
      ];
    }

    if (subjectId === 'tieng_anh') {
      return [
        {
          topic: 'Pronunciation & Stress',
          units: ['Vowel and consonant sounds', 'Word stress in two-syllable and three-syllable words'],
        },
        {
          topic: 'Vocabulary & Word Formation',
          units: ['Theme-based vocabulary', 'Prefixes, suffixes, and parts of speech', 'Collocations and phrasal verbs'],
        },
        {
          topic: 'Grammar in Context',
          units: ['Tenses and passive voice', 'Relative clauses and reduced relative clauses', 'Conditionals and inversion', 'Modal verbs'],
        },
        {
          topic: 'Reading Comprehension & Guided Cloze',
          units: ['Skimming for main ideas', 'Scanning for specific information', 'Contextual vocabulary guessing and inference'],
        },
        {
          topic: 'Writing & Sentence Transformation',
          units: ['Sentence transformation with given key words', 'Paragraph writing with topic sentence and supporting details'],
        },
      ];
    }

    // Default topics for other subjects
    return [
      {
        topic: 'Chủ đề 1: Kiến thức nền tảng và nhận thức khoa học',
        units: ['Đơn vị kiến thức 1.1: Khái niệm và quy luật', 'Đơn vị kiến thức 1.2: Phân loại và đặc tính'],
      },
      {
        topic: 'Chủ đề 2: Kĩ năng thực hành và phân tích số liệu',
        units: ['Đơn vị kiến thức 2.1: Thí nghiệm và đo lường', 'Đơn vị kiến thức 2.2: Phân tích bảng biểu, đồ thị'],
      },
      {
        topic: 'Chủ đề 3: Vận dụng kiến thức vào thực tiễn đời sống',
        units: ['Đơn vị kiến thức 3.1: Giải quyết vấn đề thực tế', 'Đơn vị kiến thức 3.2: Đánh giá tác động và giải pháp phát triển bền vững'],
      },
    ];
  }
}
