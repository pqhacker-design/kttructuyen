import { 
  ExamStructureConfig, 
  GeneratedAIQuestion, 
  ExamValidationResult, 
  MatrixCellSpecification,
  CognitiveLevel
} from '../types/aiExam';

export class ExamValidator {
  /**
   * Safe floating point round to 2 decimal places
   */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  public static validateExam(
    structure: ExamStructureConfig,
    questions: GeneratedAIQuestion[],
    matrixCells?: MatrixCellSpecification[]
  ): ExamValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check questions count
    if (!questions || questions.length === 0) {
      errors.push('Đề thi chưa có câu hỏi nào được khởi tạo.');
      return {
        isValid: false,
        totalQuestions: 0,
        totalScore: 0,
        isScoreExact10: false,
        errors,
        warnings,
        partsSummary: [],
        cognitiveBreakdown: [],
        matrixMatches: [],
      };
    }

    // 2. Calculate actual points
    let calculatedTotalScore = 0;
    const partsMap: Record<number, { count: number; points: number }> = {
      1: { count: 0, points: 0 },
      2: { count: 0, points: 0 },
      3: { count: 0, points: 0 },
      4: { count: 0, points: 0 },
    };

    const cognitivePoints: Record<CognitiveLevel | 'advanced_application', number> = {
      recognition: 0,
      comprehension: 0,
      application: 0,
      advanced_application: 0,
    };

    questions.forEach((q, idx) => {
      const qNum = q.question_order || idx + 1;
      const pts = Number(q.points) || 0;
      calculatedTotalScore += pts;

      if (partsMap[q.exam_part]) {
        partsMap[q.exam_part].count += 1;
        partsMap[q.exam_part].points += pts;
      }

      // Cognitive level
      if (q.question_type === 'essay' && q.sub_items && q.sub_items.length > 0) {
        q.sub_items.forEach((sub) => {
          const subPts = Number(sub.points) || 0;
          if (sub.cognitive_level === 'advanced_application') {
            cognitivePoints.advanced_application += subPts;
          } else if (sub.cognitive_level) {
            cognitivePoints[sub.cognitive_level] = (cognitivePoints[sub.cognitive_level] || 0) + subPts;
          } else {
            cognitivePoints.application += subPts;
          }
        });
      } else {
        if (q.is_advanced_application) {
          cognitivePoints.advanced_application += pts;
        } else if (q.cognitive_level) {
          cognitivePoints[q.cognitive_level] = (cognitivePoints[q.cognitive_level] || 0) + pts;
        }
      }

      // Content integrity
      if (!q.content || q.content.trim().length < 5) {
        // If question has intro_text or sub_items, content can be in intro_text or sub_items
        const effectiveContent = q.content || q.intro_text || (q.sub_items && q.sub_items[0]?.question_text) || '';
        if (effectiveContent.trim().length < 5) {
          errors.push(`Câu ${qNum} (Phần ${q.exam_part}): Nội dung câu hỏi quá ngắn hoặc còn trống.`);
        }
      }

      // Question Type specific validation
      if (q.question_type === 'single_choice') {
        if (!q.options || q.options.length < 2) {
          errors.push(`Câu ${qNum} (Trắc nghiệm nhiều lựa chọn): Cần ít nhất 4 phương án lựa chọn.`);
        } else {
          const correctOptions = q.options.filter(o => o.is_correct);
          if (correctOptions.length !== 1) {
            errors.push(`Câu ${qNum}: Bắt buộc phải có đúng 1 phương án đúng (Hiện tại có ${correctOptions.length} phương án).`);
          }
          const hasEmptyOption = q.options.some(o => !o.content || o.content.trim().length === 0);
          if (hasEmptyOption) {
            errors.push(`Câu ${qNum}: Có phương án lựa chọn bị để trống.`);
          }
        }
      } else if (q.question_type === 'true_false') {
        if (!q.statements || q.statements.length !== 4) {
          errors.push(`Câu ${qNum} (Phần II Đúng/Sai): Bắt buộc phải có đúng 4 lệnh mệnh đề a, b, c, d (Hiện tại có ${q.statements?.length || 0} ý).`);
        } else {
          q.statements.forEach((st, sIdx) => {
            const label = ['a', 'b', 'c', 'd'][sIdx] || `${sIdx + 1}`;
            if (!st.statement || st.statement.trim().length === 0) {
              errors.push(`Câu ${qNum}, ý ${label}: Nội dung mệnh đề bị trống.`);
            }
            if (typeof st.is_correct !== 'boolean') {
              errors.push(`Câu ${qNum}, ý ${label}: Chưa xác định đáp án Đúng hay Sai.`);
            }
          });
        }
      } else if (q.question_type === 'short_answer') {
        if (!q.short_answer?.normalized_answer || q.short_answer.normalized_answer.trim().length === 0) {
          errors.push(`Câu ${qNum} (Phần III Trả lời ngắn): Chưa có đáp số chuẩn hoặc từ khóa.`);
        }
      } else if (q.question_type === 'essay') {
        // Validation for sub-items (1 - 3 sub-items)
        if (q.sub_items && q.sub_items.length > 0) {
          // ESSAY_SUBITEM_COUNT_VALID: length must be 1 to 3
          if (q.sub_items.length > 3) {
            errors.push(`Câu ${qNum} (Tự luận): Số lượng ý (${q.sub_items.length} ý) vượt quá quy định cho phép (tối đa 3 ý).`);
          }

          // ESSAY_SUBITEM_POINT_SUM_VALID: sum of sub-items points must equal question points
          const subTotal = q.sub_items.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
          if (Math.abs(ExamValidator.round2(subTotal) - ExamValidator.round2(pts)) > 0.01) {
            errors.push(`Câu ${qNum} (Tự luận): Tổng điểm các ý (${ExamValidator.round2(subTotal)}đ) không bằng tổng điểm câu (${pts}đ). Bắt buộc phải bằng nhau để xuất bản.`);
          }

          // ESSAY_SUBITEM_RUBRIC_VALID: validate each sub-item content and rubric
          q.sub_items.forEach((item, itIdx) => {
            const itLabel = item.item_number || (['a', 'b', 'c'][itIdx] || `${itIdx + 1}`);
            if (!item.question_text || item.question_text.trim().length === 0) {
              errors.push(`Câu ${qNum}, ý ${itLabel}: Nội dung câu hỏi của ý bị trống.`);
            }
            if (item.scoring_rubric && item.scoring_rubric.length > 0) {
              const rTotal = item.scoring_rubric.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
              if (Math.abs(ExamValidator.round2(rTotal) - ExamValidator.round2(item.points)) > 0.05) {
                warnings.push(`Câu ${qNum}, ý ${itLabel}: Tổng điểm rubric (${ExamValidator.round2(rTotal)}đ) chưa khớp điểm của ý (${item.points}đ).`);
              }
            }
          });
        } else {
          // Single essay question without sub_items
          if (!q.essay_rubric || q.essay_rubric.length === 0) {
            warnings.push(`Câu ${qNum} (Phần IV Tự luận): Chưa có biểu điểm chi tiết (Rubric chấm). Nên bổ sung tiêu chí 0.25đ / 0.5đ.`);
          } else {
            const rubricTotal = q.essay_rubric.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
            if (Math.abs(ExamValidator.round2(rubricTotal) - ExamValidator.round2(pts)) > 0.05) {
              warnings.push(`Câu ${qNum} (Tự luận): Tổng điểm rubric (${ExamValidator.round2(rubricTotal)}đ) lệch so với điểm câu hỏi (${pts}đ).`);
            }
          }
        }
      }
    });

    calculatedTotalScore = ExamValidator.round2(calculatedTotalScore);
    const isScoreExact10 = Math.abs(calculatedTotalScore - 10.0) < 0.001;

    if (!isScoreExact10) {
      errors.push(`TỔNG ĐIỂM TOÀN BÀI LÀ ${calculatedTotalScore} ĐIỂM (BẮT BUỘC PHẢI BẰNG CHÍNH XÁC 10,0 ĐIỂM theo Công văn 7991).`);
    }

    // 3. Parts Summary vs Structure Config
    const partsSummary = structure.parts.map(partConf => {
      const actual = partsMap[partConf.part] || { count: 0, points: 0 };
      const actualPts = ExamValidator.round2(actual.points);
      const reqPts = ExamValidator.round2(partConf.totalPoints);
      const isPartMatch = !partConf.enabled ? actual.count === 0 : Math.abs(actualPts - reqPts) < 0.01;

      if (partConf.enabled && !isPartMatch) {
        errors.push(`${partConf.title}: Điểm thực tế (${actualPts}đ) không khớp điểm cấu hình quy định (${reqPts}đ).`);
      }

      if (partConf.enabled && partConf.questionCount !== actual.count) {
        warnings.push(`${partConf.title}: Số lượng câu thực tế (${actual.count} câu) khác với số câu dự kiến (${partConf.questionCount} câu).`);
      }

      return {
        part: partConf.part,
        name: partConf.title,
        requiredPoints: reqPts,
        actualPoints: actualPts,
        questionCount: actual.count,
        isValid: isPartMatch,
      };
    });

    // 4. Cognitive Level Breakdown
    const totalCognitive = Object.values(cognitivePoints).reduce((a, b) => a + b, 0);
    const cognitiveBreakdown = [
      {
        level: 'recognition' as const,
        name: 'Nhận biết',
        targetPoints: structure.cognitiveDistribution.recognition,
        actualPoints: ExamValidator.round2(cognitivePoints.recognition),
        percentage: totalCognitive > 0 ? ExamValidator.round2((cognitivePoints.recognition / totalCognitive) * 100) : 0,
      },
      {
        level: 'comprehension' as const,
        name: 'Thông hiểu',
        targetPoints: structure.cognitiveDistribution.comprehension,
        actualPoints: ExamValidator.round2(cognitivePoints.comprehension),
        percentage: totalCognitive > 0 ? ExamValidator.round2((cognitivePoints.comprehension / totalCognitive) * 100) : 0,
      },
      {
        level: 'application' as const,
        name: 'Vận dụng',
        targetPoints: structure.cognitiveDistribution.application,
        actualPoints: ExamValidator.round2(cognitivePoints.application),
        percentage: totalCognitive > 0 ? ExamValidator.round2((cognitivePoints.application / totalCognitive) * 100) : 0,
      },
      {
        level: 'advanced_application' as const,
        name: 'Vận dụng cao',
        targetPoints: structure.cognitiveDistribution.advanced_application || 0,
        actualPoints: ExamValidator.round2(cognitivePoints.advanced_application),
        percentage: totalCognitive > 0 ? ExamValidator.round2((cognitivePoints.advanced_application / totalCognitive) * 100) : 0,
      },
    ];

    // 5. Matrix cell verification if matrix exists
    const matrixMatches = (matrixCells || []).map(cell => {
      const matchedQuestions = questions.filter(
        q => q.topic === cell.topic || q.matrix_cell_id === cell.id
      );
      const actualCount = matchedQuestions.length;
      const requiredCount = cell.total_questions;
      return {
        cellId: cell.id,
        topic: cell.topic,
        required: requiredCount,
        actual: actualCount,
        matched: actualCount === requiredCount,
      };
    });

    const hasMatrixMismatch = matrixMatches.some(m => !m.matched);
    if (hasMatrixMismatch && matrixCells && matrixCells.length > 0) {
      warnings.push('Một số ô trong ma trận có số lượng câu hỏi thực tế chưa khớp hoàn toàn với số câu dự kiến.');
    }

    const isValid = errors.length === 0 && isScoreExact10;

    return {
      isValid,
      totalQuestions: questions.length,
      totalScore: calculatedTotalScore,
      isScoreExact10,
      errors,
      warnings,
      partsSummary,
      cognitiveBreakdown,
      matrixMatches,
    };
  }
}
