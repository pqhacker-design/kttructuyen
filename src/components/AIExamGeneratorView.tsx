import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  Settings2, 
  Grid3X3, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  FileText, 
  Download, 
  Printer, 
  Radio, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle,
  ExternalLink,
  Info,
  Sliders,
  Percent,
  Cpu,
  CheckSquare,
  PenTool,
  Layers,
  ListChecks,
  Camera,
  Image as ImageIcon,
  Eye,
  Table,
  RotateCcw
} from 'lucide-react';
import { 
  SubjectCode, 
  ExamStructureConfig, 
  GeneratedAIQuestion, 
  AIExamGenerationResponse, 
  MatrixCellSpecification,
  LegalRegulation,
  EssayQuestionConfig,
  ExamFormatType,
  HybridRatioType,
  TextbookExtractionResult
} from '../types/aiExam';
import { TextbookScopeVisionUploader } from './TextbookScopeVisionUploader';
import { 
  getFormatPresets, 
  applyExamFormat, 
  getExamFormatInfo, 
  detectExamFormat, 
  ExamFormatPreset 
} from '../lib/examFormatHelper';
import { SubjectRuleEngine } from '../lib/subjectRuleEngine';
import { ExamValidator } from '../lib/examValidator';
import { aiExamService, GenerateExamParams } from '../services/aiExamService';
import { regulationService } from '../services/regulationService';
import { LegalRegulationsModal } from './LegalRegulationsModal';
import { Profile } from '../types';
import { MathRenderer } from './MathRenderer';
import { ExportModal } from './ExportModal';
import { exportExamToWord, exportAnswersToWord, exportMatrixToWord } from '../services/docxExportService';
import { exportExamToPdf, exportAnswersToPdf, exportMatrixToPdf } from '../services/pdfExportService';
import { buildCV7991Data } from '../lib/cv7991MatrixHelper';
import { CV7991MatrixTableView } from './CV7991MatrixTableView';
import { ApiKeyModal } from './ApiKeyModal';
import { hasUserApiKey, getMaskedApiKey } from '../services/apiKeyService';

interface AIExamGeneratorViewProps {
  currentProfile: Profile | null;
  onNavigateToSessions?: (examId: string) => void;
  onOpenAuth?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

type WizardStep = 'config' | 'structure' | 'matrix' | 'generating' | 'preview';

const AI_EXAM_DRAFT_KEY = 'eduexam_ai_exam_draft_v2';

interface AIDraftData {
  currentStep?: WizardStep;
  selectedSubject?: SubjectCode;
  grade?: number;
  term?: string;
  durationMinutes?: number;
  customPrompt?: string;
  selectedTopics?: string[];
  structure?: ExamStructureConfig;
  examFormat?: ExamFormatType;
  hybridRatio?: HybridRatioType;
  textbookResult?: TextbookExtractionResult | null;
  extractedTextbookContext?: string;
  generatedExamData?: AIExamGenerationResponse | null;
  matrixCells?: MatrixCellSpecification[];
  isAIMatrixGenerated?: boolean;
}

const loadAIDraft = (): AIDraftData | null => {
  try {
    const raw = sessionStorage.getItem(AI_EXAM_DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Lỗi đọc draft đề thi:', e);
  }
  return null;
};

export const AIExamGeneratorView: React.FC<AIExamGeneratorViewProps> = ({
  currentProfile,
  onNavigateToSessions,
  onOpenAuth,
  onNavigateToTab,
}) => {
  const initialDraft = React.useMemo(() => loadAIDraft(), []);

  const [currentStep, setCurrentStep] = useState<WizardStep>(() => initialDraft?.currentStep || 'config');
  const [isRegulationModalOpen, setIsRegulationModalOpen] = useState(false);

  // Step 1: Pedagogical Configuration
  const [selectedSubject, setSelectedSubject] = useState<SubjectCode>(() => initialDraft?.selectedSubject || 'toan');
  const [grade, setGrade] = useState<number>(() => initialDraft?.grade ?? 10);
  const [term, setTerm] = useState<string>(() => initialDraft?.term || 'Cuối kì I');
  const [durationMinutes, setDurationMinutes] = useState<number>(() => initialDraft?.durationMinutes ?? 90);
  const [customPrompt, setCustomPrompt] = useState<string>(() => initialDraft?.customPrompt || '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(() => {
    if (initialDraft?.selectedTopics && initialDraft.selectedTopics.length > 0) {
      return initialDraft.selectedTopics;
    }
    const defaultCurriculum = SubjectRuleEngine.getCurriculumTopics('toan', 10);
    return defaultCurriculum.map((c) => c.topic);
  });
  const [newTopicInput, setNewTopicInput] = useState<string>('');

  // Active Legal Regulation
  const [activeRegulation, setActiveRegulation] = useState<LegalRegulation>(() =>
    regulationService.getPrimaryReference(
      initialDraft?.selectedSubject || 'toan',
      (initialDraft?.grade ?? 10) <= 9 ? 'THCS' : 'THPT'
    )
  );

  // Step 2: Exam Structure Configuration
  const [structure, setStructure] = useState<ExamStructureConfig>(() => {
    if (initialDraft?.structure) return initialDraft.structure;
    const p = SubjectRuleEngine.getProfile(initialDraft?.selectedSubject || 'toan');
    return JSON.parse(JSON.stringify(p.default_structure));
  });

  // Exam format states: 'multiple_choice_only' | 'essay_only' | 'hybrid'
  const [examFormat, setExamFormat] = useState<ExamFormatType>(() => {
    if (initialDraft?.examFormat) return initialDraft.examFormat;
    const p = SubjectRuleEngine.getProfile(initialDraft?.selectedSubject || 'toan');
    return detectExamFormat(p.default_structure);
  });
  const [hybridRatio, setHybridRatio] = useState<HybridRatioType>(() => initialDraft?.hybridRatio || '70_30');

  const formatInfo = React.useMemo(() => {
    return getExamFormatInfo({
      ...structure,
      examFormat,
      hybridRatio,
    });
  }, [structure, examFormat, hybridRatio]);

  const currentFormatPresets = React.useMemo(() => {
    return getFormatPresets(examFormat, selectedSubject);
  }, [examFormat, selectedSubject]);

  const handleSelectFormat = (newFormat: ExamFormatType, newRatio: HybridRatioType = hybridRatio) => {
    setExamFormat(newFormat);
    if (newRatio) setHybridRatio(newRatio);
    const updated = applyExamFormat(structure, newFormat, newRatio, selectedSubject);
    setStructure(updated);
  };

  const handleApplyPreset = (preset: ExamFormatPreset) => {
    setStructure((prev) => ({
      ...prev,
      totalScore: 10.0,
      examFormat: preset.format,
      hybridRatio: preset.ratio || prev.hybridRatio,
      parts: JSON.parse(JSON.stringify(preset.parts)),
      cognitiveDistribution: JSON.parse(JSON.stringify(preset.cognitiveDistribution)),
    }));
    setExamFormat(preset.format);
    if (preset.ratio) setHybridRatio(preset.ratio);
  };

  // Step 3: Matrix
  const [matrixCells, setMatrixCells] = useState<MatrixCellSpecification[]>(() => initialDraft?.matrixCells ?? []);
  const [isAIMatrixGenerated, setIsAIMatrixGenerated] = useState<boolean>(() => initialDraft?.isAIMatrixGenerated ?? false);
  const [isGeneratingMatrix, setIsGeneratingMatrix] = useState<boolean>(false);

  // Textbook OCR / Vision Extraction State
  const [textbookResult, setTextbookResult] = useState<TextbookExtractionResult | null>(() => initialDraft?.textbookResult ?? null);
  const [extractedTextbookContext, setExtractedTextbookContext] = useState<string>(() => initialDraft?.extractedTextbookContext || '');

  // Step 4 & 5: Generated Exam & Results
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [generatedExamData, setGeneratedExamData] = useState<AIExamGenerationResponse | null>(() => initialDraft?.generatedExamData ?? null);
  const [previewTab, setPreviewTab] = useState<'exam' | 'answers' | 'matrix'>('exam');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null);

  // Publishing State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedResult, setPublishedResult] = useState<{ examId: string; accessCode?: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [hasKey, setHasKey] = useState(() => hasUserApiKey());

  useEffect(() => {
    const handleKeyChange = () => setHasKey(hasUserApiKey());
    window.addEventListener('edu_api_key_changed', handleKeyChange);
    return () => window.removeEventListener('edu_api_key_changed', handleKeyChange);
  }, []);

  // Track subject & grade to avoid overwriting restored draft topics on initial render
  const prevSubjectGradeRef = useRef<{ subject: SubjectCode; grade: number }>({
    subject: initialDraft?.selectedSubject || 'toan',
    grade: initialDraft?.grade ?? 10,
  });

  // When subject or grade changes BY TEACHER INTERACTION, update profile and default topics
  useEffect(() => {
    if (
      prevSubjectGradeRef.current.subject === selectedSubject &&
      prevSubjectGradeRef.current.grade === grade
    ) {
      // First mount or unchanged: do not overwrite draft topics / structure!
      return;
    }
    prevSubjectGradeRef.current = { subject: selectedSubject, grade };

    const profile = SubjectRuleEngine.getProfile(selectedSubject);
    const detected = detectExamFormat(profile.default_structure);
    setExamFormat(detected);
    setStructure(JSON.parse(JSON.stringify(profile.default_structure)));
    setDurationMinutes(profile.default_duration);

    const curriculum = SubjectRuleEngine.getCurriculumTopics(selectedSubject, grade);
    const defaultTopicNames = curriculum.map((c) => c.topic);
    setSelectedTopics(defaultTopicNames);

    const reg = regulationService.getPrimaryReference(selectedSubject, grade <= 9 ? 'THCS' : 'THPT');
    setActiveRegulation(reg);
  }, [selectedSubject, grade]);

  // Auto-save draft to sessionStorage to protect work when switching tabs or taking screenshots
  useEffect(() => {
    try {
      const draft: AIDraftData = {
        currentStep,
        selectedSubject,
        grade,
        term,
        durationMinutes,
        customPrompt,
        selectedTopics,
        structure,
        examFormat,
        hybridRatio,
        textbookResult,
        extractedTextbookContext,
        generatedExamData,
        matrixCells,
        isAIMatrixGenerated,
      };
      sessionStorage.setItem(AI_EXAM_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      // ignore storage quota errors
    }
  }, [
    currentStep,
    selectedSubject,
    grade,
    term,
    durationMinutes,
    customPrompt,
    selectedTopics,
    structure,
    examFormat,
    hybridRatio,
    textbookResult,
    extractedTextbookContext,
    generatedExamData,
    matrixCells,
    isAIMatrixGenerated,
  ]);

  // Handler to reset and start a fresh exam draft
  const handleResetDraft = () => {
    if (window.confirm('Thầy/Cô có chắc chắn muốn xóa bản nháp đang tạo và thiết lập lại từ đầu không?')) {
      try {
        sessionStorage.removeItem(AI_EXAM_DRAFT_KEY);
        sessionStorage.removeItem('eduexam_tb_images_draft');
        sessionStorage.removeItem('eduexam_tb_extracted_result');
      } catch {}

      setCurrentStep('config');
      setSelectedSubject('toan');
      setGrade(10);
      setTerm('Cuối kì I');
      setDurationMinutes(90);
      setCustomPrompt('');
      const defaultTopics = SubjectRuleEngine.getCurriculumTopics('toan', 10).map((c) => c.topic);
      setSelectedTopics(defaultTopics);
      const prof = SubjectRuleEngine.getProfile('toan');
      setStructure(JSON.parse(JSON.stringify(prof.default_structure)));
      setExamFormat(detectExamFormat(prof.default_structure));
      setHybridRatio('70_30');
      setTextbookResult(null);
      setExtractedTextbookContext('');
      setGeneratedExamData(null);
      setMatrixCells([]);
      setIsAIMatrixGenerated(false);
    }
  };

  // When topics, structure, or textbook result change, automatically recalculate matrix & specs
  useEffect(() => {
    // If matrix was already generated by AI and exists, do not overwrite with mechanical calculation
    if (isAIMatrixGenerated && matrixCells.length > 0) {
      return;
    }
    const cells = aiExamService.buildDefaultMatrix({
      subjectId: selectedSubject,
      grade,
      term,
      durationMinutes,
      topics: selectedTopics,
      structure,
      textbookResult: textbookResult || undefined,
    });
    setMatrixCells(cells);
  }, [selectedSubject, grade, term, durationMinutes, selectedTopics, structure, textbookResult, isAIMatrixGenerated]);

  // AI automatically generates matrix & specification table based on knowledge scope and structure
  const handleAIGenerateMatrix = async () => {
    if (!hasUserApiKey()) {
      setIsApiKeyModalOpen(true);
      return;
    }
    setIsGeneratingMatrix(true);
    try {
      const generatedMatrix = await aiExamService.generateMatrixAndSpecification({
        subjectId: selectedSubject,
        grade,
        term,
        durationMinutes,
        topics: selectedTopics,
        structure: {
          ...structure,
          examFormat,
          hybridRatio: examFormat === 'hybrid' ? hybridRatio : undefined,
        },
        customPromptRequirements: customPrompt,
        extractedTextbookContext: extractedTextbookContext || undefined,
        textbookResult: textbookResult || undefined,
      });

      if (generatedMatrix && generatedMatrix.length > 0) {
        setMatrixCells(generatedMatrix);
        setIsAIMatrixGenerated(true);
      }
    } catch (err: any) {
      console.error('Error generating AI matrix:', err);
      alert('Lỗi khi AI sinh ma trận & bảng đặc tả: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setIsGeneratingMatrix(false);
    }
  };

  const currentProfileData = SubjectRuleEngine.getProfile(selectedSubject);

  const cv7991Data = React.useMemo(() => {
    const subjProfile = SubjectRuleEngine.getProfile(selectedSubject);
    return buildCV7991Data({
      title: `${term} - Môn ${subjProfile.name}`,
      subject: subjProfile.name,
      grade,
      durationMinutes,
      questions: generatedExamData?.questions || [],
      matrixCells,
      structure: generatedExamData?.structure || structure,
    });
  }, [selectedSubject, term, grade, durationMinutes, generatedExamData, matrixCells, structure]);

  // Helper: calculate live total score
  const calculateLiveTotalScore = () => {
    let total = 0;
    structure.parts.forEach((p) => {
      if (p.enabled) {
        total += Number(p.totalPoints) || 0;
      }
    });
    return ExamValidator.round2(total);
  };

  const liveTotalScore = calculateLiveTotalScore();
  const isLiveScoreExact10 = Math.abs(liveTotalScore - 10.0) < 0.001;

  // Auto-balance structure points to 10.0
  const handleAutoBalancePoints = () => {
    const enabledParts = structure.parts.filter((p) => p.enabled);
    if (enabledParts.length === 0) return;

    const newParts = structure.parts.map((p) => ({ ...p }));

    if (examFormat === 'multiple_choice_only') {
      // Multiple choice only: disable Part 4, balance Parts 1, 2, 3
      const p4 = newParts.find((p) => p.part === 4);
      if (p4) {
        p4.enabled = false;
        p4.totalPoints = 0;
        p4.questionCount = 0;
      }

      const enabledMc = newParts.filter((p) => p.part !== 4 && p.enabled);
      if (enabledMc.length === 1) {
        enabledMc[0].totalPoints = 10.0;
        if (enabledMc[0].questionCount > 0) {
          enabledMc[0].pointsPerQuestion = ExamValidator.round2(10.0 / enabledMc[0].questionCount);
        }
      } else if (enabledMc.length > 1) {
        const sum = enabledMc.reduce((acc, p) => acc + p.totalPoints, 0);
        const diff = ExamValidator.round2(10.0 - sum);
        const last = enabledMc[enabledMc.length - 1];
        if (last) {
          last.totalPoints = ExamValidator.round2(Math.max(0, last.totalPoints + diff));
          if (last.questionCount > 0 && last.type === 'short_answer') {
            last.pointsPerQuestion = ExamValidator.round2(last.totalPoints / last.questionCount);
          }
        }
      }
    } else if (examFormat === 'essay_only') {
      // Essay only: disable Parts 1, 2, 3, set Part 4 to 10.0
      newParts.forEach((p) => {
        if (p.part !== 4) {
          p.enabled = false;
          p.totalPoints = 0;
          p.questionCount = 0;
        }
      });
      const p4 = newParts.find((p) => p.part === 4);
      if (p4) {
        p4.enabled = true;
        p4.totalPoints = 10.0;
        if (p4.questionCount <= 0) p4.questionCount = 2;
        if (p4.essayQuestions && p4.essayQuestions.length > 0) {
          const count = p4.essayQuestions.length;
          const avg = ExamValidator.round2(10.0 / count);
          p4.essayQuestions.forEach((eq, idx) => {
            if (idx === count - 1) {
              const prev = ExamValidator.round2(avg * (count - 1));
              eq.points = ExamValidator.round2(10.0 - prev);
            } else {
              eq.points = avg;
            }
          });
        }
      }
    } else {
      // Hybrid format
      if (selectedSubject === 'ngu_van') {
        const p1 = newParts.find((p) => p.part === 1 && p.enabled);
        const p4 = newParts.find((p) => p.part === 4 && p.enabled);
        if (p1 && p4) {
          p1.totalPoints = 4.0;
          p1.pointsPerQuestion = ExamValidator.round2(4.0 / (p1.questionCount || 8));
          p4.totalPoints = 6.0;
          if (p4.essayQuestions && p4.essayQuestions.length >= 2) {
            p4.essayQuestions[0].points = 2.0;
            p4.essayQuestions[1].points = 4.0;
          }
        }
      } else {
        // Standard 4 parts or ratio-based
        const p1 = newParts.find((p) => p.part === 1 && p.enabled);
        const p2 = newParts.find((p) => p.part === 2 && p.enabled);
        const p3 = newParts.find((p) => p.part === 3 && p.enabled);
        const p4 = newParts.find((p) => p.part === 4 && p.enabled);

        if (p1 && p2 && p3 && p4) {
          if (hybridRatio === '50_50') {
            p1.totalPoints = 3.0;
            p2.totalPoints = 2.0;
            p3.totalPoints = 0.0;
            p3.enabled = false;
            p4.totalPoints = 5.0;
          } else {
            p1.totalPoints = 3.0;
            p1.pointsPerQuestion = 0.25;
            p1.questionCount = 12;

            p2.totalPoints = 2.0;
            p2.pointsPerQuestion = 1.0;
            p2.questionCount = 2;

            p3.totalPoints = 2.0;
            p3.pointsPerQuestion = 0.5;
            p3.questionCount = 4;

            p4.totalPoints = 3.0;
            p4.questionCount = 2;
            if (p4.essayQuestions && p4.essayQuestions.length >= 2) {
              p4.essayQuestions[0].points = 2.0;
              p4.essayQuestions[1].points = 1.0;
            }
          }
        } else {
          // Distribute remaining points to the last enabled part
          const sum = newParts.reduce((acc, p) => (p.enabled ? acc + p.totalPoints : acc), 0);
          const diff = ExamValidator.round2(10.0 - sum);
          const lastEnabled = [...newParts].reverse().find((p) => p.enabled);
          if (lastEnabled) {
            lastEnabled.totalPoints = ExamValidator.round2(Math.max(0, lastEnabled.totalPoints + diff));
          }
        }
      }
    }

    setStructure({
      ...structure,
      totalScore: 10.0,
      parts: newParts,
    });
  };

  // Add custom topic
  const handleAddTopic = () => {
    if (!newTopicInput.trim()) return;
    if (!selectedTopics.includes(newTopicInput.trim())) {
      setSelectedTopics([...selectedTopics, newTopicInput.trim()]);
    }
    setNewTopicInput('');
  };

  // Remove topic
  const handleRemoveTopic = (t: string) => {
    setSelectedTopics(selectedTopics.filter((x) => x !== t));
  };

  // Cognitive distribution stats & verification (Must total exactly 10.0 points / 100%)
  const cognitiveStats = React.useMemo(() => {
    const cd = structure.cognitiveDistribution || {
      recognition: 4.0,
      comprehension: 3.0,
      application: 2.0,
      advanced_application: 1.0,
    };
    const recog = Number(cd.recognition) || 0;
    const comp = Number(cd.comprehension) || 0;
    const app = Number(cd.application) || 0;
    const adv = Number(cd.advanced_application) || 0;

    const totalPoints = ExamValidator.round2(recog + comp + app + adv);
    const totalPercent = ExamValidator.round2(totalPoints * 10);
    const isExact100 = Math.abs(totalPoints - 10.0) < 0.001;

    return {
      recog,
      comp,
      app,
      adv,
      recogPct: ExamValidator.round2(recog * 10),
      compPct: ExamValidator.round2(comp * 10),
      appPct: ExamValidator.round2(app * 10),
      advPct: ExamValidator.round2(adv * 10),
      totalPoints,
      totalPercent,
      isExact100,
      diff: ExamValidator.round2(10.0 - totalPoints),
      diffPct: ExamValidator.round2(100 - totalPercent),
    };
  }, [structure.cognitiveDistribution]);

  // Update individual cognitive level
  const handleUpdateCognitiveLevel = (
    level: 'recognition' | 'comprehension' | 'application' | 'advanced_application',
    rawVal: number
  ) => {
    const clamped = Math.max(0, Math.min(10, ExamValidator.round2(rawVal)));
    setStructure((prev) => ({
      ...prev,
      cognitiveDistribution: {
        ...prev.cognitiveDistribution,
        [level]: clamped,
      },
    }));
  };

  // Preset distributions
  const COGNITIVE_PRESETS = [
    {
      label: '40 - 30 - 20 - 10 (Chuẩn GDPT 2018)',
      desc: '40% Biết, 30% Hiểu, 20% Vận dụng, 10% VDC',
      values: { recognition: 4.0, comprehension: 3.0, application: 2.0, advanced_application: 1.0 },
    },
    {
      label: '50 - 30 - 20 - 0 (Cơ bản / Tốt nghiệp)',
      desc: '50% Biết, 30% Hiểu, 20% Vận dụng, 0% VDC',
      values: { recognition: 5.0, comprehension: 3.0, application: 2.0, advanced_application: 0.0 },
    },
    {
      label: '30 - 30 - 25 - 15 (Phân hóa cao)',
      desc: '30% Biết, 30% Hiểu, 25% Vận dụng, 15% VDC',
      values: { recognition: 3.0, comprehension: 3.0, application: 2.5, advanced_application: 1.5 },
    },
    {
      label: '30 - 35 - 25 - 10 (Đánh giá năng lực)',
      desc: '30% Biết, 35% Hiểu, 25% Vận dụng, 10% VDC',
      values: { recognition: 3.0, comprehension: 3.5, application: 2.5, advanced_application: 1.0 },
    },
  ];

  // Auto-balance cognitive levels to exactly 10.0 points / 100%
  const handleAutoBalanceCognitive = () => {
    const cd = structure.cognitiveDistribution || {
      recognition: 4.0,
      comprehension: 3.0,
      application: 2.0,
      advanced_application: 1.0,
    };
    const recog = cd.recognition || 0;
    const comp = cd.comprehension || 0;
    const app = cd.application || 0;
    const adv = cd.advanced_application || 0;
    const currentSum = recog + comp + app + adv;

    if (currentSum <= 0) {
      setStructure((prev) => ({
        ...prev,
        cognitiveDistribution: { recognition: 4.0, comprehension: 3.0, application: 2.0, advanced_application: 1.0 },
      }));
      return;
    }

    // Allocate difference to the last level or adjust proportionally
    const diff = ExamValidator.round2(10.0 - currentSum);
    if (adv + diff >= 0) {
      setStructure((prev) => ({
        ...prev,
        cognitiveDistribution: {
          ...prev.cognitiveDistribution,
          advanced_application: ExamValidator.round2(adv + diff),
        },
      }));
    } else if (app + diff >= 0) {
      setStructure((prev) => ({
        ...prev,
        cognitiveDistribution: {
          ...prev.cognitiveDistribution,
          application: ExamValidator.round2(app + diff),
        },
      }));
    } else {
      const r1 = Math.round(((recog / currentSum) * 10) * 2) / 2;
      const r2 = Math.round(((comp / currentSum) * 10) * 2) / 2;
      const r3 = Math.round(((app / currentSum) * 10) * 2) / 2;
      const r4 = ExamValidator.round2(10.0 - (r1 + r2 + r3));
      setStructure((prev) => ({
        ...prev,
        cognitiveDistribution: {
          recognition: r1,
          comprehension: r2,
          application: r3,
          advanced_application: Math.max(0, r4),
        },
      }));
    }
  };

  // Handle generation action
  const handleStartGeneration = async () => {
    if (!hasUserApiKey()) {
      setIsApiKeyModalOpen(true);
      return;
    }

    if (!isLiveScoreExact10) {
      alert('Tổng điểm cấu hình các phần bắt buộc phải bằng chính xác 10,0 điểm theo Công văn 7991. Vui lòng bấm "Tự động cân bằng 10,0 điểm".');
      return;
    }

    if (!cognitiveStats.isExact100) {
      alert(`Phân bố mức độ nhận thức chưa đạt đúng 100% (Hiện tại: ${cognitiveStats.totalPercent}% - ${cognitiveStats.totalPoints}/10 điểm). Vui lòng điều chỉnh hoặc bấm "Tự động cân bằng 100%".`);
      return;
    }

    setCurrentStep('generating');
    setIsGenerating(true);

    try {
      // BƯỚC 1: Dựa vào phạm vi kiến thức và cấu trúc đề, AI tự sinh ma trận và bảng đặc tả (CV 7991)
      setGenerationProgress('Bước 1/2: AI đang tự động phân tích phạm vi kiến thức và xây dựng Ma trận, Bảng đặc tả chi tiết (CV 7991)...');

      let effectiveMatrix = matrixCells;
      if (!isAIMatrixGenerated || !effectiveMatrix || effectiveMatrix.length === 0) {
        try {
          effectiveMatrix = await aiExamService.generateMatrixAndSpecification({
            subjectId: selectedSubject,
            grade,
            term,
            durationMinutes,
            topics: selectedTopics,
            structure: {
              ...structure,
              examFormat,
              hybridRatio: examFormat === 'hybrid' ? hybridRatio : undefined,
            },
            customPromptRequirements: customPrompt,
            extractedTextbookContext: extractedTextbookContext || undefined,
            textbookResult: textbookResult || undefined,
          });

          if (effectiveMatrix && effectiveMatrix.length > 0) {
            setMatrixCells(effectiveMatrix);
            setIsAIMatrixGenerated(true);
          }
        } catch (matErr) {
          console.warn('AI Matrix generation error, continuing with fallback matrix:', matErr);
        }
      }

      // BƯỚC 2: AI sinh đề dựa theo ma trận và đặc tả vừa sinh (sinh theo từng phần để đảm bảo đủ 100% số câu)
      setGenerationProgress('Giai đoạn 2: AI đang chuẩn bị tạo Đề thi & Đáp án chi tiết bám sát Ma trận...');

      const response = await aiExamService.generateExam({
        subjectId: selectedSubject,
        grade,
        term,
        durationMinutes,
        topics: selectedTopics,
        structure: {
          ...structure,
          examFormat,
          hybridRatio: examFormat === 'hybrid' ? hybridRatio : undefined,
        },
        matrixCells: effectiveMatrix,
        customPromptRequirements: customPrompt,
        extractedTextbookContext: extractedTextbookContext || undefined,
        textbookResult: textbookResult || undefined,
        onProgress: (msg: string) => setGenerationProgress(msg),
      });

      setGeneratedExamData(response);
      setCurrentStep('preview');

      // Automatically persist to Question Bank, Exam Management, and Matrix & Specs
      try {
        const ownerId = currentProfile?.user_id || currentProfile?.id || 'demo-teacher-001';
        const autoSaveResult = await aiExamService.publishExamToSystem(
          response,
          selectedSubject,
          ownerId
        );
        setPublishedResult(autoSaveResult);
      } catch (autoSaveErr) {
        console.warn('Auto save warning:', autoSaveErr);
      }
    } catch (err: any) {
      console.error('Error in AI Exam generation:', err);
      if (err.message && (err.message.includes('API Key') || err.message.includes('API_KEY'))) {
        setIsApiKeyModalOpen(true);
      }
      alert('Đã xảy ra lỗi trong quá trình tạo đề: ' + (err.message || 'Lỗi không xác định'));
      setCurrentStep('structure');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle regenerate single question
  const handleRegenerateQuestion = async (q: GeneratedAIQuestion) => {
    if (!hasUserApiKey()) {
      setIsApiKeyModalOpen(true);
      return;
    }
    if (!generatedExamData || !generatedExamData.questions) return;
    setRegeneratingQuestionId(q.id);

    try {
      const updatedQ = await aiExamService.regenerateSingleQuestion(
        q,
        selectedSubject,
        grade,
        q.topic
      );

      const currentQuestions = generatedExamData.questions || [];
      const newQuestions = currentQuestions.map((item) =>
        item.id === q.id ? updatedQ : item
      );

      const newValidation = ExamValidator.validateExam(
        generatedExamData.structure,
        newQuestions,
        generatedExamData.matrix
      );

      setGeneratedExamData({
        ...generatedExamData,
        questions: newQuestions,
        validation: newValidation,
      });
    } catch (err) {
      console.error('Failed to regenerate question:', err);
    } finally {
      setRegeneratingQuestionId(null);
    }
  };

  // Handle manual question content edit
  const handleSaveQuestionEdit = (qId: string, newContent: string, newExplanation: string) => {
    if (!generatedExamData) return;
    const newQuestions = generatedExamData.questions.map((q) => {
      if (q.id === qId) {
        return {
          ...q,
          content: newContent,
          explanation: newExplanation,
          teacher_accepted: true,
        };
      }
      return q;
    });

    const newValidation = ExamValidator.validateExam(
      generatedExamData.structure,
      newQuestions,
      generatedExamData.matrix
    );

    setGeneratedExamData({
      ...generatedExamData,
      questions: newQuestions,
      validation: newValidation,
    });
    setEditingQuestionId(null);
  };

  // Handle publish exam to system
  const handlePublishToSystem = async () => {
    if (!generatedExamData) return;
    if (!generatedExamData.validation.isValid) {
      alert('Đề thi chưa vượt qua kiểm định (Tổng điểm phải bằng 10,0 điểm và không còn lỗi nghiêm trọng).');
      return;
    }

    setIsPublishing(true);
    try {
      const ownerId = currentProfile?.user_id || currentProfile?.id || 'demo-teacher-001';
      const result = await aiExamService.publishExamToSystem(
        generatedExamData,
        selectedSubject,
        ownerId
      );

      setPublishedResult(result);
    } catch (err: any) {
      console.error('Publish error:', err);
      alert('Lỗi lưu đề thi: ' + (err.message || 'Không thể lưu đề thi vào cơ sở dữ liệu'));
    } finally {
      setIsPublishing(false);
    }
  };

  const copyAccessCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-indigo-500/20 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-indigo-500/30 border border-indigo-400/40 px-3 py-1 rounded-full text-xs font-semibold text-indigo-200 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Chuyên gia Sư phạm Khảo thí AI</span>
              <span className="w-1 h-1 bg-indigo-300 rounded-full" />
              <span>Công văn 7991/BGDĐT-GDTrH</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Tạo Đề Thi Bằng AI
            </h1>
            <p className="mt-1 text-sm text-indigo-100/90 max-w-2xl leading-relaxed">
              Quy trình sư phạm có kiểm soát: Ma trận → Bản đặc tả → Sinh câu hỏi theo profile môn học → Thang điểm chuẩn 10,0 → Kiểm định chéo Validator → Xuất phòng thi trực tuyến.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleResetDraft}
              className="inline-flex items-center px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-500/30 hover:border-rose-400/50 border border-white/20 text-xs font-semibold text-white backdrop-blur-xs transition-all shadow-xs cursor-pointer"
              title="Xóa bản nháp đang soạn và tạo lại từ đầu"
            >
              <RotateCcw className="w-4 h-4 mr-1.5 text-rose-300" />
              <span>Tạo đề mới</span>
            </button>

            <button
              onClick={() => setIsRegulationModalOpen(true)}
              className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white backdrop-blur-xs transition-all shadow-xs cursor-pointer"
            >
              <BookOpen className="w-4 h-4 mr-2 text-indigo-200" />
              <span>Căn cứ: {activeRegulation.document_number}</span>
            </button>
          </div>
        </div>

        {/* Wizard Steps Bar */}
        <div className="mt-6 pt-4 border-t border-indigo-500/30 grid grid-cols-4 gap-2 text-xs font-medium">
          <div 
            onClick={() => setCurrentStep('config')}
            className={`flex items-center space-x-2 cursor-pointer transition-all ${
              currentStep === 'config' ? 'text-amber-300 font-bold' : 'text-indigo-200/70 hover:text-white'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              currentStep === 'config' ? 'bg-amber-300 text-indigo-950 font-black' : 'bg-indigo-600 text-white'
            }`}>1</span>
            <span className="hidden sm:inline">1. Cấu hình Môn & Lớp</span>
          </div>

          <div 
            onClick={() => setCurrentStep('structure')}
            className={`flex items-center space-x-2 cursor-pointer transition-all ${
              currentStep === 'structure' ? 'text-amber-300 font-bold' : 'text-indigo-200/70 hover:text-white'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              currentStep === 'structure' ? 'bg-amber-300 text-indigo-950 font-black' : 'bg-indigo-600 text-white'
            }`}>2</span>
            <span className="hidden sm:inline">2. Cấu trúc & Thang điểm</span>
          </div>

          <div 
            onClick={() => setCurrentStep('matrix')}
            className={`flex items-center space-x-2 cursor-pointer transition-all ${
              currentStep === 'matrix' ? 'text-amber-300 font-bold' : 'text-indigo-200/70 hover:text-white'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              currentStep === 'matrix' ? 'bg-amber-300 text-indigo-950 font-black' : 'bg-indigo-600 text-white'
            }`}>3</span>
            <span className="hidden sm:inline">3. Ma trận & Đặc tả (Phần 1)</span>
          </div>

          <div 
            onClick={() => generatedExamData && setCurrentStep('preview')}
            className={`flex items-center space-x-2 cursor-pointer transition-all ${
              currentStep === 'preview' || currentStep === 'generating' ? 'text-amber-300 font-bold' : 'text-indigo-200/70 hover:text-white'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              currentStep === 'preview' ? 'bg-amber-300 text-indigo-950 font-black' : 'bg-indigo-600 text-white'
            }`}>4</span>
            <span className="hidden sm:inline">4. Đề thi & Đáp án (Phần 2)</span>
          </div>
        </div>
      </div>

      {/* API Key Configuration Status Banner (Enforced per-user API key requirement) */}
      <div className={`rounded-2xl p-4 border transition-all ${
        hasKey
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : 'bg-gradient-to-r from-amber-50 to-rose-50 border-amber-300 text-amber-950 shadow-xs'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-xl shrink-0 ${hasKey ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm">
                  {hasKey ? 'Cấu hình Gemini API Key: Đã sẵn sàng' : 'Yêu cầu cấu hình Gemini API Key cá nhân'}
                </h3>
                {hasKey ? (
                  <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                    {getMaskedApiKey()}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-rose-200 text-rose-800 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                    Bắt buộc
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                {hasKey
                  ? 'Đang sử dụng API Key cá nhân của bạn để sinh đề thi và tạo câu hỏi tự động độc lập.'
                  : 'Hệ thống bắt buộc mỗi giáo viên tự nhập Google Gemini API Key riêng (không dùng chung API hệ thống). Vui lòng cấu hình trước khi tạo đề.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsApiKeyModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center space-x-1.5 shadow-2xs ${
              hasKey
                ? 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25'
            }`}
          >
            <span>{hasKey ? 'Thay đổi API Key' : 'Cấu hình API Key ngay'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          STEP 1: CONFIGURATION (Môn, Lớp, Kì thi, Phạm vi)
          ========================================================================= */}
      {currentStep === 'config' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bước 1: Chọn Môn Học & Phạm Vi Sư Phạm</h2>
              <p className="text-xs text-slate-500">
                Mỗi môn học có profile và quy tắc kiểm tra đánh giá riêng biệt theo chuẩn GDPT 2018.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md">
              Căn cứ: {activeRegulation.document_number}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Subject Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Môn học *
              </label>
              <select
                id="select-subject"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value as SubjectCode)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value="toan">Toán học (MATH)</option>
                <option value="ngu_van">Ngữ văn (LIT - Đọc hiểu & Viết)</option>
                <option value="tieng_anh">Tiếng Anh (ENG - Kỹ năng ngôn ngữ)</option>
                <option value="khtn">Khoa học tự nhiên (Lớp 6-9)</option>
                <option value="vat_ly">Vật lí (PHYS)</option>
                <option value="hoa_hoc">Hóa học (CHEM - Chuẩn IUPAC)</option>
                <option value="sinh_hoc">Sinh học (BIO)</option>
                <option value="lich_su">Lịch sử (HIST)</option>
                <option value="dia_ly">Địa lí (GEO)</option>
                <option value="gdcd_gdktpl">Giáo dục công dân / GDKT&PL</option>
                <option value="tin_hoc">Tin học (CS - Python/C++)</option>
                <option value="cong_nghe">Công nghệ (TECH)</option>
                <option value="other">Môn học khác</option>
              </select>
            </div>

            {/* Grade Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Khối lớp *
              </label>
              <select
                id="select-grade"
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value={6}>Lớp 6 (THCS)</option>
                <option value={7}>Lớp 7 (THCS)</option>
                <option value={8}>Lớp 8 (THCS)</option>
                <option value={9}>Lớp 9 (THCS)</option>
                <option value={10}>Lớp 10 (THPT)</option>
                <option value={11}>Lớp 11 (THPT)</option>
                <option value={12}>Lớp 12 (THPT)</option>
              </select>
            </div>

            {/* Term Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Đợt kiểm tra / Kì thi *
              </label>
              <select
                id="select-term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value="Giữa kì I">Kiểm tra Giữa kì I</option>
                <option value="Cuối kì I">Kiểm tra Cuối kì I</option>
                <option value="Giữa kì II">Kiểm tra Giữa kì II</option>
                <option value="Cuối kì II">Kiểm tra Cuối kì II</option>
                <option value="1 tiết">Kiểm tra định kỳ 1 tiết (45 phút)</option>
                <option value="15 phút">Kiểm tra thường xuyên (15 phút)</option>
              </select>
            </div>
          </div>

          {/* Dạng đề thi mong muốn (Exam Format Selector) */}
          <div className="p-5 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 border border-indigo-100 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Dạng đề kiểm tra mong muốn *
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tùy chọn hình thức ra đề: Trắc nghiệm 100%, Tự luận 100% hoặc Kết hợp Trắc nghiệm + Tự luận
                </p>
              </div>

              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${formatInfo.badgeColor}`}>
                {formatInfo.label}
              </span>
            </div>

            {/* 3 Interactive Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Hybrid */}
              <button
                type="button"
                onClick={() => handleSelectFormat('hybrid')}
                className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  examFormat === 'hybrid'
                    ? 'bg-indigo-50/80 border-indigo-500 shadow-xs ring-2 ring-indigo-200/60'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${examFormat === 'hybrid' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Chuẩn CV 7991
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  Trắc nghiệm + Tự luận
                </h4>
                <p className="text-xs text-slate-500 line-clamp-2">
                  Kết hợp trắc nghiệm khách quan (Phần I, II, III) và tự luận (Phần IV) phân hóa năng lực.
                </p>
              </button>

              {/* Card 2: Multiple Choice Only */}
              <button
                type="button"
                onClick={() => handleSelectFormat('multiple_choice_only')}
                className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  examFormat === 'multiple_choice_only'
                    ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-2 ring-blue-200/60'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${examFormat === 'multiple_choice_only' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    10,0đ Trắc nghiệm
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  100% Trắc nghiệm
                </h4>
                <p className="text-xs text-slate-500 line-clamp-2">
                  Toàn bộ 10,0 điểm câu hỏi trắc nghiệm (Phần I, II, III). Không có câu tự luận.
                </p>
              </button>

              {/* Card 3: Essay Only */}
              <button
                type="button"
                onClick={() => handleSelectFormat('essay_only')}
                className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                  examFormat === 'essay_only'
                    ? 'bg-purple-50/80 border-purple-500 shadow-xs ring-2 ring-purple-200/60'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${examFormat === 'essay_only' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <PenTool className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    10,0đ Tự luận
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  100% Tự luận
                </h4>
                <p className="text-xs text-slate-500 line-clamp-2">
                  Toàn bộ 10,0 điểm câu hỏi tự luận có rubric chi tiết (Ngữ văn Đọc hiểu - Viết, bài toán tự luận...).
                </p>
              </button>
            </div>

            {/* Quick Ratio Selection for Hybrid */}
            {examFormat === 'hybrid' && (
              <div className="pt-3 border-t border-indigo-100/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <Percent className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Chọn nhanh tỷ lệ điểm Trắc nghiệm / Tự luận:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: '70_30' as HybridRatioType, label: '70% TN (7đ) - 30% TL (3đ)', desc: 'Chuẩn THPT' },
                    { id: '50_50' as HybridRatioType, label: '50% TN (5đ) - 50% TL (5đ)', desc: 'Chuẩn THCS' },
                    { id: '60_40' as HybridRatioType, label: '60% TN (6đ) - 40% TL (4đ)', desc: 'Cân đối' },
                    { id: '80_20' as HybridRatioType, label: '80% TN (8đ) - 20% TL (2đ)', desc: 'Đề nhanh' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectFormat('hybrid', r.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        hybridRatio === r.id
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Subject Rule Highlights */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl">
            <div className="flex items-center space-x-2 text-xs font-bold text-indigo-900 mb-2">
              <Info className="w-4 h-4 text-indigo-600" />
              <span>Quy tắc sư phạm đặc thù môn {currentProfileData.name}:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-indigo-950/80">
              {currentProfileData.special_requirements.map((req, idx) => (
                <li key={idx}>{req}</li>
              ))}
            </ul>
          </div>

          {/* =========================================================================
              TEXTBOOK VISION UPLOADER (Dán ảnh SGK / Chụp màn hình bằng AI Vision)
              ========================================================================= */}
          <TextbookScopeVisionUploader
            subject={currentProfileData.name}
            subjectId={selectedSubject}
            grade={grade}
            term={term}
            selectedTopics={selectedTopics}
            onTopicsUpdated={(newTopics) => setSelectedTopics(newTopics)}
            onExtractionComplete={(result, contextText) => {
              setTextbookResult(result);
              setExtractedTextbookContext(contextText);
            }}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          />

          {/* Topics and Knowledge Units */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Phạm vi kiến thức / Chương / Chủ đề ({selectedTopics.length})
              </label>
              <span className="text-[11px] text-slate-400">
                Tự động gợi ý theo Chương trình GDPT 2018 & Ảnh chụp SGK
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {selectedTopics.map((t, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center text-xs font-medium bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200"
                >
                  <span>{t}</span>
                  <button
                    onClick={() => handleRemoveTopic(t)}
                    className="ml-2 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nhập tên chương hoặc chủ đề bổ sung..."
                value={newTopicInput}
                onChange={(e) => setNewTopicInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTopic())}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                <Plus className="w-3.5 h-3.5 inline mr-1" />
                Thêm chủ đề
              </button>
            </div>
          </div>

          {/* Live Auto-Generated Matrix & Specification Status Banner */}
          <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-2xs">
                <Table className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-indigo-950 flex items-center space-x-1.5">
                  <span>Ma trận & Bản đặc tả đã được tự động sinh (CV 7991)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-700 font-semibold text-[11px]">Sẵn sàng trước khi sinh đề</span>
                </div>
                <p className="text-[11px] text-indigo-900/70 mt-0.5">
                  Đã tự động liên kết {selectedTopics.length} chủ đề và {matrixCells.length} đơn vị kiến thức
                  {textbookResult ? ` (bám sát bài SGK: "${textbookResult.detected_lesson_title}")` : ''}.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep('matrix')}
              className="inline-flex items-center px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              <span>Xem trước Ma trận & Đặc tả</span>
            </button>
          </div>

          {/* Custom prompt instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Chỉ đạo / Yêu cầu riêng của tổ chuyên môn (Tùy chọn)
            </label>
            <textarea
              rows={2}
              placeholder="VD: Chú trọng các câu hỏi liên hệ thực tiễn địa phương; Dành 1 câu tự luận phân hóa học sinh giỏi môn Toán..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              id="btn-next-step-structure"
              onClick={() => setCurrentStep('structure')}
              className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <span>Tiếp tục: Cấu hình cấu trúc đề</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 2: EXAM STRUCTURE CONFIGURATION (Bắt buộc 10,0 điểm)
          ========================================================================= */}
      {currentStep === 'structure' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bước 2: Cấu Trúc Đề & Thang Điểm (Bắt buộc: 10,0 Điểm)
              </h2>
              <p className="text-xs text-slate-500">
                Theo Công văn 7991, đề kiểm tra định kỳ có thể gồm 4 phần. Tổng điểm các câu phải bằng chính xác 10,0 điểm.
              </p>
            </div>

            {/* Live Score Counter */}
            <div className="flex items-center space-x-3">
              <div
                className={`px-4 py-2 rounded-xl text-center font-mono border ${
                  isLiveScoreExact10
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800 animate-pulse'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider">
                  Tổng điểm hiện tại
                </div>
                <div className="text-xl font-black">
                  {liveTotalScore} / 10,0
                </div>
              </div>

              {!isLiveScoreExact10 && (
                <button
                  id="btn-auto-balance"
                  onClick={handleAutoBalancePoints}
                  className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tự động cân bằng 10,0 điểm</span>
                </button>
              )}
            </div>
          </div>

          {/* Format Switcher & Presets in Step 2 */}
          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Hình thức đề thi:
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${formatInfo.badgeColor}`}>
                  {formatInfo.label}
                </span>
              </div>

              {/* Fast Format Segmented Switch */}
              <div className="inline-flex bg-slate-200/80 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectFormat('hybrid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    examFormat === 'hybrid'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Trắc nghiệm + Tự luận</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFormat('multiple_choice_only')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    examFormat === 'multiple_choice_only'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>100% Trắc nghiệm</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFormat('essay_only')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    examFormat === 'essay_only'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>100% Tự luận</span>
                </button>
              </div>
            </div>

            {/* Ratio pills if Hybrid */}
            {examFormat === 'hybrid' && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/70">
                <span className="text-xs text-slate-500 font-medium">Tỷ lệ Trắc nghiệm / Tự luận:</span>
                {[
                  { id: '70_30' as HybridRatioType, label: '70% TN (7,0đ) - 30% TL (3,0đ)' },
                  { id: '50_50' as HybridRatioType, label: '50% TN (5,0đ) - 50% TL (5,0đ)' },
                  { id: '60_40' as HybridRatioType, label: '60% TN (6,0đ) - 40% TL (4,0đ)' },
                  { id: '80_20' as HybridRatioType, label: '80% TN (8,0đ) - 20% TL (2,0đ)' },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectFormat('hybrid', r.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${
                      hybridRatio === r.id
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            {/* Presets List */}
            {currentFormatPresets.length > 0 && (
              <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                <div className="flex items-center space-x-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <ListChecks className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Gợi ý mẫu cấu trúc chuẩn (Nhấn để áp dụng ngay 10,0 điểm):</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {currentFormatPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="p-2.5 bg-white hover:bg-indigo-50/50 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all text-left group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
                            {preset.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-800 whitespace-nowrap">
                            {preset.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {preset.description}
                        </p>
                      </div>
                      <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-indigo-600 font-semibold">
                        <span>Áp dụng mẫu</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Visual ratio bar */}
            <div className="pt-2 border-t border-slate-200/70">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1.5">
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Trắc nghiệm: {formatInfo.mcPoints} điểm ({formatInfo.mcPercent}%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>Tự luận: {formatInfo.essayPoints} điểm ({formatInfo.essayPercent}%)</span>
                </div>
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, formatInfo.mcPercent))}%` }}
                />
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, formatInfo.essayPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Parts Configuration Cards */}
          <div className="space-y-4">
            {structure.parts.map((partConfig) => (
              <div
                key={partConfig.part}
                className={`p-4 rounded-xl border transition-all ${
                  partConfig.enabled
                    ? 'bg-white border-slate-200 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id={`part-toggle-${partConfig.part}`}
                      checked={partConfig.enabled}
                      onChange={(e) => {
                        const newParts = structure.parts.map((p) =>
                          p.part === partConfig.part ? { ...p, enabled: e.target.checked } : p
                        );
                        setStructure({ ...structure, parts: newParts });
                      }}
                      className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {partConfig.title}
                      </h4>
                      <p className="text-xs text-slate-500">{partConfig.description}</p>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg">
                    {partConfig.enabled ? `${partConfig.totalPoints} điểm` : 'Đã tắt'}
                  </span>
                </div>

                {partConfig.enabled && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Số câu hỏi:
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={partConfig.questionCount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const newParts = structure.parts.map((p) =>
                            p.part === partConfig.part
                              ? {
                                  ...p,
                                  questionCount: val,
                                  pointsPerQuestion:
                                    val > 0 ? ExamValidator.round2(p.totalPoints / val) : 0,
                                }
                              : p
                          );
                          setStructure({ ...structure, parts: newParts });
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Điểm / câu:
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        value={partConfig.pointsPerQuestion || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const newParts = structure.parts.map((p) =>
                            p.part === partConfig.part
                              ? {
                                  ...p,
                                  pointsPerQuestion: val,
                                  totalPoints: ExamValidator.round2(val * p.questionCount),
                                }
                              : p
                          );
                          setStructure({ ...structure, parts: newParts });
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Tổng điểm phần này:
                      </label>
                      <input
                        type="number"
                        step={0.25}
                        min={0}
                        max={10}
                        value={partConfig.totalPoints}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const newParts = structure.parts.map((p) =>
                            p.part === partConfig.part
                              ? {
                                  ...p,
                                  totalPoints: val,
                                  pointsPerQuestion:
                                    p.questionCount > 0
                                      ? ExamValidator.round2(val / p.questionCount)
                                      : 0,
                                  pointsPerStatement:
                                    p.questionCount > 0 && (p.statementsPerQuestion || 4) > 0
                                      ? ExamValidator.round2(val / p.questionCount / (p.statementsPerQuestion || 4))
                                      : p.pointsPerStatement,
                                }
                              : p
                          );
                          setStructure({ ...structure, parts: newParts });
                        }}
                        className="w-full px-3 py-1.5 text-xs font-bold text-slate-900 border border-slate-200 rounded-lg focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Đặc thù Phần II: Đúng/Sai - Cấu hình số ý (2, 4, 6, 8) và điểm mỗi ý */}
                  {(partConfig.type === 'true_false' || partConfig.part === 2) && (
                    <div className="mt-3 pt-3 border-t border-indigo-100/70 bg-indigo-50/50 -mx-4 -mb-4 p-4 rounded-b-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <Settings2 className="w-4 h-4 text-indigo-600" />
                          Cấu hình câu hỏi Đúng / Sai (Tính điểm theo từng ý):
                        </span>
                        <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-md">
                          {partConfig.statementsPerQuestion || 4} ý / câu × {partConfig.pointsPerStatement || 0.25}đ = {partConfig.pointsPerQuestion || 1.0}đ/câu
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Chọn số ý mỗi câu: 2, 4, 6, hoặc 8 ý */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                            Số ý (mệnh đề) trong mỗi câu:
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {([2, 4, 6, 8] as const).map((count) => {
                              const isSelected = (partConfig.statementsPerQuestion || 4) === count;
                              return (
                                <button
                                  type="button"
                                  key={count}
                                  onClick={() => {
                                    const stCount = count;
                                    const ptsPerSt = partConfig.pointsPerStatement || 0.25;
                                    const newPtsPerQ = ExamValidator.round2(stCount * ptsPerSt);
                                    const newTotal = ExamValidator.round2(partConfig.questionCount * newPtsPerQ);
                                    const newParts = structure.parts.map((p) =>
                                      p.part === partConfig.part
                                        ? {
                                            ...p,
                                            statementsPerQuestion: stCount,
                                            pointsPerQuestion: newPtsPerQ,
                                            totalPoints: newTotal,
                                          }
                                        : p
                                    );
                                    setStructure({ ...structure, parts: newParts });
                                  }}
                                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {count} ý
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Điểm cho mỗi ý */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                            Điểm cho mỗi ý đúng:
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              step={0.05}
                              min={0.05}
                              max={2}
                              value={partConfig.pointsPerStatement ?? 0.25}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const stCount = partConfig.statementsPerQuestion || 4;
                                const newPtsPerQ = ExamValidator.round2(stCount * val);
                                const newTotal = ExamValidator.round2(partConfig.questionCount * newPtsPerQ);
                                const newParts = structure.parts.map((p) =>
                                  p.part === partConfig.part
                                    ? {
                                        ...p,
                                        pointsPerStatement: val,
                                        pointsPerQuestion: newPtsPerQ,
                                        totalPoints: newTotal,
                                      }
                                    : p
                                );
                                setStructure({ ...structure, parts: newParts });
                              }}
                              className="w-28 px-3 py-1.5 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-indigo-500 bg-white"
                            />
                            <div className="flex gap-1">
                              {[0.1, 0.25, 0.5].map((preset) => (
                                <button
                                  type="button"
                                  key={preset}
                                  onClick={() => {
                                    const stCount = partConfig.statementsPerQuestion || 4;
                                    const newPtsPerQ = ExamValidator.round2(stCount * preset);
                                    const newTotal = ExamValidator.round2(partConfig.questionCount * newPtsPerQ);
                                    const newParts = structure.parts.map((p) =>
                                      p.part === partConfig.part
                                        ? {
                                            ...p,
                                            pointsPerStatement: preset,
                                            pointsPerQuestion: newPtsPerQ,
                                            totalPoints: newTotal,
                                          }
                                        : p
                                    );
                                    setStructure({ ...structure, parts: newParts });
                                  }}
                                  className="px-2 py-1 text-[10px] font-medium bg-white hover:bg-indigo-100 text-slate-700 rounded-md border border-slate-200"
                                >
                                  {preset}đ
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-indigo-800/80">
                        Học sinh làm bài sẽ tích chọn <strong>Đúng</strong> hoặc <strong>Sai</strong> cho từng ý (không hiển thị đáp án khi làm). Điểm số được tính theo từng ý đúng: làm đúng ý nào được cộng điểm ý đó ({partConfig.pointsPerStatement || 0.25}đ / ý).
                      </p>
                    </div>
                  )}

                  {/* Đặc thù Phần IV: Tự luận - Cấu hình linh hoạt cấu trúc 1-3 ý hỏi và phân bổ điểm */}
                  {(partConfig.type === 'essay' || partConfig.part === 4) && (
                    <div className="mt-3 pt-3 border-t border-indigo-100/70 bg-indigo-50/40 -mx-4 -mb-4 p-4 rounded-b-xl space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <Settings2 className="w-4 h-4 text-indigo-600" />
                          Cấu hình câu hỏi Tự luận theo 1–3 ý (Công văn 7991 & CT GDPT 2018):
                        </span>
                        <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-md">
                          Linh hoạt 1 ý, 2 ý hoặc 3 ý hỏi
                        </span>
                      </div>

                      {/* Cấu trúc số ý cho phép */}
                      <div className="space-y-1.5 bg-white p-3 rounded-xl border border-indigo-100">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Cấu trúc số ý cho phép trong đề:
                        </label>
                        <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                          {[1, 2, 3].map((cnt) => {
                            const currentAllowed = partConfig.allowedSubItemCounts || [1, 2, 3];
                            const isChecked = currentAllowed.includes(cnt as (1 | 2 | 3));
                            return (
                              <label key={cnt} className="flex items-center space-x-2 cursor-pointer font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    let nextAllowed = isChecked
                                      ? currentAllowed.filter((c) => c !== cnt)
                                      : [...currentAllowed, cnt as (1 | 2 | 3)].sort();
                                    if (nextAllowed.length === 0) {
                                      nextAllowed = [cnt as (1 | 2 | 3)]; // Always keep at least one
                                    }
                                    const newParts = structure.parts.map((p) =>
                                      p.part === partConfig.part
                                        ? { ...p, allowedSubItemCounts: nextAllowed }
                                        : p
                                    );
                                    setStructure({ ...structure, parts: newParts });
                                  }}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                />
                                <span>Cho phép {cnt} ý ({cnt === 1 ? 'Tự luận đơn' : cnt === 2 ? '2 ý a, b' : '3 ý a, b, c'})</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Chế độ phân bổ */}
                      <div className="space-y-2 bg-white p-3 rounded-xl border border-indigo-100">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Chế độ phân bổ cấu trúc số ý:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              const newParts = structure.parts.map((p) =>
                                p.part === partConfig.part
                                  ? { ...p, essayAllocationMode: 'auto' as const }
                                  : p
                              );
                              setStructure({ ...structure, parts: newParts });
                            }}
                            className={`p-2.5 rounded-lg border text-left flex items-start space-x-2 cursor-pointer transition-all ${
                              (partConfig.essayAllocationMode || 'auto') === 'auto'
                                ? 'border-indigo-500 bg-indigo-50/80 text-indigo-950 font-semibold'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="essayMode"
                              checked={(partConfig.essayAllocationMode || 'auto') === 'auto'}
                              onChange={() => {}}
                              className="mt-0.5 text-indigo-600"
                            />
                            <div>
                              <div className="font-bold">Chế độ phân bổ tự động (Khuyên dùng)</div>
                              <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                                AI tự động phân bổ số ý (1, 2, 3 ý) phù hợp với độ khó, ma trận kiến thức và thời lượng đề.
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const count = partConfig.questionCount || 2;
                              const defaultPts = ExamValidator.round2(partConfig.totalPoints / count);
                              const existingQuestions = partConfig.essayQuestions || [];
                              const newQuestions: EssayQuestionConfig[] = [];
                              for (let i = 0; i < count; i++) {
                                if (existingQuestions[i]) {
                                  newQuestions.push(existingQuestions[i]);
                                } else {
                                  newQuestions.push({
                                    id: `eq-${i + 1}`,
                                    questionOrder: i + 1,
                                    cognitiveLevel: i === count - 1 ? 'advanced_application' : 'application',
                                    points: defaultPts,
                                    subItemCount: (i % 3 + 1) as (1 | 2 | 3),
                                  });
                                }
                              }
                              const newParts = structure.parts.map((p) =>
                                p.part === partConfig.part
                                  ? { ...p, essayAllocationMode: 'manual' as const, essayQuestions: newQuestions }
                                  : p
                              );
                              setStructure({ ...structure, parts: newParts });
                            }}
                            className={`p-2.5 rounded-lg border text-left flex items-start space-x-2 cursor-pointer transition-all ${
                              partConfig.essayAllocationMode === 'manual'
                                ? 'border-indigo-500 bg-indigo-50/80 text-indigo-950 font-semibold'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="essayMode"
                              checked={partConfig.essayAllocationMode === 'manual'}
                              onChange={() => {}}
                              className="mt-0.5 text-indigo-600"
                            />
                            <div>
                              <div className="font-bold">Cấu hình thủ công từng câu</div>
                              <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                                Người dùng gán trước số ý (1, 2 hoặc 3 ý) và điểm số chi tiết cho từng câu tự luận.
                              </div>
                            </div>
                          </button>
                        </div>

                        {/* Chi tiết từng câu khi ở chế độ thủ công */}
                        {partConfig.essayAllocationMode === 'manual' && (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">
                                Danh sách các câu tự luận ({partConfig.questionCount} câu):
                              </span>
                              {(() => {
                                const currentQs = partConfig.essayQuestions || [];
                                const totalManual = currentQs.slice(0, partConfig.questionCount).reduce((acc, q) => acc + (Number(q.points) || 0), 0);
                                const isMatched = Math.abs(ExamValidator.round2(totalManual) - partConfig.totalPoints) < 0.001;
                                return (
                                  <div className="flex items-center space-x-2">
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                      isMatched
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      Tổng: {ExamValidator.round2(totalManual)}đ / {partConfig.totalPoints}đ
                                    </span>
                                    {!isMatched && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const count = partConfig.questionCount || 1;
                                          const pts = ExamValidator.round2(partConfig.totalPoints / count);
                                          const current = partConfig.essayQuestions || [];
                                          const updated = current.map((q) => ({ ...q, points: pts }));
                                          const newParts = structure.parts.map((p) =>
                                            p.part === partConfig.part
                                              ? { ...p, essayQuestions: updated }
                                              : p
                                          );
                                          setStructure({ ...structure, parts: newParts });
                                        }}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                                      >
                                        Chia đều điểm
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="space-y-2">
                              {Array.from({ length: partConfig.questionCount || 0 }).map((_, qIdx) => {
                                const qConf = (partConfig.essayQuestions && partConfig.essayQuestions[qIdx]) || {
                                  id: `eq-${qIdx + 1}`,
                                  questionOrder: qIdx + 1,
                                  cognitiveLevel: qIdx === (partConfig.questionCount - 1) ? 'advanced_application' : 'application',
                                  points: ExamValidator.round2(partConfig.totalPoints / (partConfig.questionCount || 1)),
                                  subItemCount: ((qIdx % 3) + 1) as (1 | 2 | 3),
                                };
                                return (
                                  <div key={qIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                                    <div className="flex items-center space-x-2 font-bold text-slate-800">
                                      <span className="w-16">Câu {qIdx + 1}:</span>
                                      <div className="flex items-center space-x-1">
                                        {[1, 2, 3].map((optSub) => (
                                          <button
                                            key={optSub}
                                            type="button"
                                            onClick={() => {
                                              const current = [...(partConfig.essayQuestions || [])];
                                              current[qIdx] = { ...qConf, subItemCount: optSub as (1 | 2 | 3) };
                                              const newParts = structure.parts.map((p) =>
                                                p.part === partConfig.part
                                                  ? { ...p, essayQuestions: current }
                                                  : p
                                              );
                                              setStructure({ ...structure, parts: newParts });
                                            }}
                                            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                                              (qConf.subItemCount || 1) === optSub
                                                ? 'bg-indigo-600 text-white shadow-2xs'
                                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                            }`}
                                          >
                                            {optSub} ý {optSub > 1 ? `(${optSub === 2 ? 'a, b' : 'a, b, c'})` : ''}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <span className="text-slate-600 font-medium">Điểm câu:</span>
                                      <input
                                        type="number"
                                        step={0.25}
                                        min={0.25}
                                        max={10}
                                        value={qConf.points ?? 1.0}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          const current = [...(partConfig.essayQuestions || [])];
                                          current[qIdx] = { ...qConf, points: val };
                                          const newParts = structure.parts.map((p) =>
                                            p.part === partConfig.part
                                              ? { ...p, essayQuestions: current }
                                              : p
                                          );
                                          setStructure({ ...structure, parts: newParts });
                                        }}
                                        className="w-20 px-2 py-1 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg bg-white"
                                      />
                                      <span className="text-slate-500 font-semibold">điểm</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                        * Mỗi ý trong câu tự luận có đơn vị kiến thức, yêu cầu cần đạt, mức độ nhận thức, điểm số và biểu điểm rubric riêng. Điểm tổng của câu luôn bằng tổng điểm các ý. Thí sinh tự nhập bài làm và không hiển thị trước đáp án.
                      </p>
                    </div>
                  )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Interactive Cognitive Distribution (Biết - Hiểu - Vận dụng - Vận dụng cao) */}
          <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Tùy chỉnh Phân bổ mức độ nhận thức (Bắt buộc đúng 100%)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Thầy cô có thể tùy chỉnh điểm hoặc tỷ lệ % từng mức độ. Tổng 4 mức độ nhận thức phải đảm bảo đúng 100% (10,0 điểm).
                </p>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                <span className="text-[10px] text-slate-400 font-medium">Mẫu nhanh:</span>
                {COGNITIVE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setStructure((prev) => ({ ...prev, cognitiveDistribution: preset.values }))}
                    title={preset.desc}
                    className="px-2 py-1 text-[10px] font-semibold rounded-md bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-slate-700 transition-colors shadow-2xs"
                  >
                    {preset.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Segmented Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                <div 
                  style={{ width: `${Math.min(100, Math.max(0, cognitiveStats.recogPct))}%` }} 
                  className="bg-emerald-500 transition-all duration-300" 
                  title={`Nhận biết: ${cognitiveStats.recog}đ (${cognitiveStats.recogPct}%)`}
                />
                <div 
                  style={{ width: `${Math.min(100, Math.max(0, cognitiveStats.compPct))}%` }} 
                  className="bg-sky-500 transition-all duration-300" 
                  title={`Thông hiểu: ${cognitiveStats.comp}đ (${cognitiveStats.compPct}%)`}
                />
                <div 
                  style={{ width: `${Math.min(100, Math.max(0, cognitiveStats.appPct))}%` }} 
                  className="bg-amber-500 transition-all duration-300" 
                  title={`Vận dụng: ${cognitiveStats.app}đ (${cognitiveStats.appPct}%)`}
                />
                <div 
                  style={{ width: `${Math.min(100, Math.max(0, cognitiveStats.advPct))}%` }} 
                  className="bg-purple-500 transition-all duration-300" 
                  title={`Vận dụng cao: ${cognitiveStats.adv}đ (${cognitiveStats.advPct}%)`}
                />
              </div>

              {/* Legend with percentages */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-0.5">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Biết: <strong>{cognitiveStats.recogPct}%</strong> ({cognitiveStats.recog}đ)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Hiểu: <strong>{cognitiveStats.compPct}%</strong> ({cognitiveStats.comp}đ)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Vận dụng: <strong>{cognitiveStats.appPct}%</strong> ({cognitiveStats.app}đ)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>VDC: <strong>{cognitiveStats.advPct}%</strong> ({cognitiveStats.adv}đ)</span>
                </span>
              </div>
            </div>

            {/* 4 Interactive Input Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Nhận biết */}
              <div className="p-3 bg-white rounded-xl border border-emerald-200/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Nhận biết</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700">
                    {cognitiveStats.recogPct}%
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateCognitiveLevel('recognition', cognitiveStats.recog - 0.5)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={cognitiveStats.recog}
                    onChange={(e) => handleUpdateCognitiveLevel('recognition', parseFloat(e.target.value) || 0)}
                    className="flex-1 text-center font-bold text-slate-900 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateCognitiveLevel('recognition', cognitiveStats.recog + 0.5)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Tái hiện kiến thức, khái niệm & sự kiện cơ bản
                </p>
              </div>

              {/* Thông hiểu */}
              <div className="p-3 bg-white rounded-xl border border-sky-200/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Thông hiểu</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-50 text-sky-700">
                    {cognitiveStats.compPct}%
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateCognitiveLevel('comprehension', cognitiveStats.comp - 0.5)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={cognitiveStats.comp}
                    onChange={(e) => handleUpdateCognitiveLevel('comprehension', parseFloat(e.target.value) || 0)}
                    className="flex-1 text-center font-bold text-slate-900 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateCognitiveLevel('comprehension', cognitiveStats.comp + 0.5)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Giải thích, so sánh, phân biệt và diễn giải dữ liệu
                </p>
              </div>

              {/* Vận dụng */}
              <div className="p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Vận dụng</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-700">
                    {cognitiveStats.appPct}%
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateCognitiveLevel('application', cognitiveStats.app - 0.5)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={cognitiveStats.app}
                    onChange={(e) => handleUpdateCognitiveLevel('application', parseFloat(e.target.value) || 0)}
                    className="flex-1 text-center font-bold text-slate-900 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateCognitiveLevel('application', cognitiveStats.app + 0.5)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Áp dụng công thức, giải bài toán và bài tập quen thuộc
                </p>
              </div>

              {/* Vận dụng cao */}
              <div className="p-3 bg-white rounded-xl border border-purple-200/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Vận dụng cao</span>
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-700">
                    {cognitiveStats.advPct}%
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateCognitiveLevel('advanced_application', cognitiveStats.adv - 0.5)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={cognitiveStats.adv}
                    onChange={(e) => handleUpdateCognitiveLevel('advanced_application', parseFloat(e.target.value) || 0)}
                    className="flex-1 text-center font-bold text-slate-900 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateCognitiveLevel('advanced_application', cognitiveStats.adv + 0.5)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs transition-colors"
                  >
                    +
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Tình huống mới thực tiễn, phân tích tổng hợp & sáng tạo
                </p>
              </div>
            </div>

            {/* Validation Banner */}
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              cognitiveStats.isExact100
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center space-x-2">
                {cognitiveStats.isExact100 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <div className="text-xs">
                  <span className="font-bold">
                    {cognitiveStats.isExact100 
                      ? '✓ Phân bố mức độ nhận thức hợp lệ: Đạt đúng 100% (10,0 điểm)' 
                      : `⚠ Tổng mức độ nhận thức: ${cognitiveStats.totalPercent}% (${cognitiveStats.totalPoints}/10,0 điểm)`}
                  </span>
                  {!cognitiveStats.isExact100 && (
                    <span className="block text-[11px] mt-0.5 text-rose-700">
                      {cognitiveStats.diff > 0 
                        ? `Còn thiếu ${ExamValidator.round2(cognitiveStats.diff * 10)}% (${cognitiveStats.diff} điểm) để đạt đúng 100%.`
                        : `Đang thừa ${ExamValidator.round2(Math.abs(cognitiveStats.diff) * 10)}% (${Math.abs(cognitiveStats.diff)} điểm), vui lòng giảm bớt.`}
                    </span>
                  )}
                </div>
              </div>

              {!cognitiveStats.isExact100 && (
                <button
                  type="button"
                  onClick={handleAutoBalanceCognitive}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  Tự động cân bằng 100%
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep('config')}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Quay lại</span>
            </button>

            <button
              id="btn-next-step-matrix"
              onClick={() => {
                setCurrentStep('matrix');
                if (hasUserApiKey() && !isAIMatrixGenerated) {
                  handleAIGenerateMatrix();
                }
              }}
              disabled={!isLiveScoreExact10 || !cognitiveStats.isExact100}
              className={`inline-flex items-center px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all ${
                isLiveScoreExact10 && cognitiveStats.isExact100
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
              title={
                !isLiveScoreExact10 
                  ? 'Tổng điểm các phần phải bằng 10,0' 
                  : !cognitiveStats.isExact100 
                  ? 'Tổng tỷ lệ nhận thức phải đạt đúng 100%' 
                  : ''
              }
            >
              <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
              <span>Tiếp tục: AI sinh Ma trận & Bản đặc tả</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: MATRIX & SPECIFICATION (CV 7991 Table)
          ========================================================================= */}
      {currentStep === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Bước 3: Khung Ma Trận & Bản Đặc Tả Đề Kiểm Tra (Tự Động Sinh - CV 7991)
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${
                  isAIMatrixGenerated
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}>
                  <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
                  <span>{isAIMatrixGenerated ? 'AI Đã Tự Động Sinh' : 'Ma trận chuẩn hóa'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dựa vào phạm vi kiến thức ({selectedTopics.length} chủ đề{extractedTextbookContext ? ' + ảnh SGK' : ''}) và cấu trúc đề, AI tự động thiết lập ma trận và bảng đặc tả. Đề thi sẽ được tạo bám sát 100% bảng này.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="btn-ai-regenerate-matrix"
                onClick={handleAIGenerateMatrix}
                disabled={isGeneratingMatrix}
                className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isGeneratingMatrix
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-indigo-800 border-indigo-200 hover:border-indigo-300'
                }`}
                title="Bấm để AI phân tích lại phạm vi kiến thức và cấu trúc đề để tự động sinh Ma trận và Bản đặc tả"
              >
                <Sparkles className={`w-3.5 h-3.5 mr-1.5 text-purple-600 ${isGeneratingMatrix ? 'animate-spin' : ''}`} />
                <span>{isGeneratingMatrix ? 'AI đang thiết lập...' : 'AI Tự Động Sinh Ma Trận & Bản Đặc Tả'}</span>
              </button>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${formatInfo.badgeColor}`}>
                {formatInfo.label}
              </span>
              <div className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg">
                {matrixCells.length} nội dung kiểm tra
              </div>
            </div>
          </div>

          {/* AI Generating In-Progress State */}
          {isGeneratingMatrix && (
            <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl flex items-start space-x-3 text-xs text-indigo-900 animate-pulse">
              <RefreshCw className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-spin" />
              <div className="space-y-1">
                <span className="font-bold">
                  AI đang tự động phân tích phạm vi kiến thức và cấu trúc đề để lập Khung Ma Trận & Bản Đặc Tả (CV 7991)...
                </span>
                <p className="text-indigo-800 text-[11px] leading-relaxed">
                  Hệ thống đang phân bổ số câu theo các mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng, VDC) và soạn thảo Yêu cầu cần đạt chuẩn GDPT 2018 cho từng nội dung kiến thức.
                </p>
              </div>
            </div>
          )}

          {/* Automatic Generation Informational Banner */}
          {!isGeneratingMatrix && (
            <div className="p-4 bg-gradient-to-r from-emerald-50/90 to-indigo-50/90 border border-emerald-200/90 rounded-2xl flex items-start space-x-3.5 text-xs text-slate-800 shadow-xs">
              <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-emerald-950 text-sm">
                    GIAI ĐOẠN 1: MA TRẬN & BẢNG ĐẶC TẢ ĐỀ THI (PHẦN RIÊNG BIỆT)
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full border border-emerald-300">
                    Chuẩn CV 7991/BGDĐT-GDTrH
                  </span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  Hệ thống phân tách quy trình ra đề làm <strong>2 giai đoạn độc lập</strong>: Ma trận & Bảng đặc tả được thiết lập và thẩm định trước tại đây (Thầy/Cô có thể xem xét, điều chỉnh hoặc xuất file riêng). Sau đó ở <strong>Giai đoạn 2</strong>, AI sẽ sinh <strong>Đề thi & Đáp án</strong> theo từng phần để tối ưu độ dài văn bản JSON và đảm bảo luôn đủ 100% số lượng câu hỏi theo quy định.
                </p>
              </div>
            </div>
          )}

          {/* Matrix CV 7991 Component */}
          <CV7991MatrixTableView
            cvData={cv7991Data}
            onExportWord={async () => {
              await exportMatrixToWord({
                title: `${term} - Môn ${SubjectRuleEngine.getProfile(selectedSubject).name}`,
                subject: SubjectRuleEngine.getProfile(selectedSubject).name,
                grade,
                durationMinutes,
                matrixCells,
                structure,
                cvData: cv7991Data,
              });
            }}
            onExportPdf={() => {
              exportMatrixToPdf({
                title: `${term} - Môn ${SubjectRuleEngine.getProfile(selectedSubject).name}`,
                subject: SubjectRuleEngine.getProfile(selectedSubject).name,
                grade,
                durationMinutes,
                matrixCells,
                structure,
                cvData: cv7991Data,
              });
            }}
          />

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep('structure')}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Quay lại Cấu trúc</span>
            </button>

            <button
              id="btn-start-ai-generation"
              onClick={handleStartGeneration}
              className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-teal-700 hover:from-indigo-700 hover:to-teal-800 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
              <span>Duyệt Ma trận & Bắt đầu Giai đoạn 2: Sinh Đề thi + Đáp án (Đủ 100% số câu)</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 4: GENERATING SCREEN (In-Progress) - 2-PHASE ARCHITECTURE
          ========================================================================= */}
      {currentStep === 'generating' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-12 text-center space-y-6 max-w-xl mx-auto animate-in fade-in zoom-in-95">
          <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-2xl animate-spin ring-8 ring-indigo-50/50">
            <RefreshCw className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200">
              Quy trình ra đề chuẩn 2 giai đoạn
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-2">Đang sinh Đề thi & Đáp án bám sát Ma trận</h3>
            <p className="text-xs text-indigo-600 font-semibold mt-1.5">{generationProgress}</p>
          </div>

          {/* Two Phase Status Cards */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
              <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Giai đoạn 1: Ma trận & Đặc tả</span>
              </div>
              <p className="text-[10px] text-emerald-800/80 mt-1">
                ✓ Đã hoàn tất độc lập theo CV 7991
              </p>
            </div>

            <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl">
              <div className="flex items-center space-x-1.5 text-indigo-700 font-bold text-xs">
                <RefreshCw className="w-4 h-4 shrink-0 text-indigo-600 animate-spin" />
                <span>Giai đoạn 2: Đề thi & Đáp án</span>
              </div>
              <p className="text-[10px] text-indigo-800/80 mt-1">
                Đang tạo từng phần để đảm bảo đủ 100% số câu
              </p>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 via-teal-500 to-emerald-500 h-full w-4/5 animate-pulse rounded-full" />
          </div>

          <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
            Hệ thống sinh theo từng phần (Part-by-Part) để tối ưu hóa độ dài chuỗi JSON, loại bỏ hiện tượng tràn token và đảm bảo đầy đủ câu hỏi, đáp án, lời giải và thang điểm 10,0.
          </p>
        </div>
      )}

      {/* =========================================================================
          STEP 5: PREVIEW, TEACHER REVIEW & PUBLISH
          ========================================================================= */}
      {currentStep === 'preview' && generatedExamData && (
        <div className="space-y-6">
          {/* Validation Result Banner */}
          <div
            className={`p-4 rounded-2xl border ${
              generatedExamData.validation.isValid
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                {generatedExamData.validation.isValid ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="text-sm font-bold">
                    {generatedExamData.validation.isValid
                      ? 'KIỂM ĐỊNH SƯ PHẠM: ĐẠT CHUẨN CÔNG VĂN 7991'
                      : 'KIỂM ĐỊNH SƯ PHẠM: CẦN LƯU Ý TRƯỚC KHI XUẤT BẢN'}
                  </h4>
                  <p className="text-xs opacity-90">
                    Tổng điểm: <span className="font-bold">{generatedExamData.validation.totalScore} / 10,0 điểm</span> • 
                    Số câu: <span className="font-bold">{generatedExamData.validation.totalQuestions} câu</span> • 
                    Mô hình: <span className="font-mono text-[11px]">{generatedExamData.model}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center transition-all"
                  title="Xuất file Word Equation OMML hoặc file PDF"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  <span>Xuất Word / PDF</span>
                </button>

                <button
                  id="btn-publish-exam"
                  onClick={handlePublishToSystem}
                  disabled={isPublishing || !generatedExamData.validation.isValid}
                  className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs flex items-center transition-all ${
                    generatedExamData.validation.isValid
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  <span>{isPublishing ? 'Đang lưu...' : 'Duyệt & Tổ chức thi ngay'}</span>
                </button>
              </div>
            </div>

            {/* Validation Errors or Warnings if any */}
            {generatedExamData.validation.errors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-200 text-xs text-rose-700 space-y-1">
                {generatedExamData.validation.errors.map((err, idx) => (
                  <div key={idx} className="flex items-center space-x-1 font-semibold">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Success Dialog when Exam is published with Access Code */}
          {publishedResult && (
            <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-2xl text-white shadow-xl space-y-4 animate-in zoom-in-95">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Đã lưu thành công vào Ngân hàng câu hỏi, Quản lý đề thi & Ma trận</span>
                  </div>
                  <h3 className="text-xl font-black">Bộ đề & Bảng đặc tả đã được đồng bộ vào hệ thống</h3>
                  <p className="text-xs text-emerald-100 mt-1">
                    Toàn bộ {generatedExamData.questions.length} câu hỏi, ma trận 4 mức độ nhận thức và đề thi đã sẵn sàng trong các mục tương ứng.
                  </p>
                </div>

                {publishedResult.accessCode && (
                  <div className="flex items-center space-x-3 bg-white/15 backdrop-blur-xs p-3 rounded-xl border border-white/20 shrink-0">
                    <div>
                      <div className="text-[10px] text-emerald-200 uppercase font-bold">Mã phòng thi trực tuyến</div>
                      <div className="text-2xl font-black font-mono tracking-widest text-amber-300">
                        {publishedResult.accessCode}
                      </div>
                    </div>
                    <button
                      onClick={() => copyAccessCode(publishedResult.accessCode!)}
                      className="p-2 bg-white text-emerald-800 rounded-lg hover:bg-emerald-50 text-xs font-bold transition-all shadow-xs"
                      title="Sao chép mã phòng"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Jump Navigation Buttons */}
              <div className="pt-3 border-t border-white/20 flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-medium text-emerald-100 mr-1">Chuyển nhanh tới:</span>
                
                {onNavigateToTab && (
                  <>
                    <button
                      onClick={() => onNavigateToTab('questions')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-800 hover:bg-emerald-50 transition-all shadow-xs flex items-center space-x-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ngân hàng câu hỏi ({generatedExamData.questions.length})</span>
                    </button>

                    <button
                      onClick={() => onNavigateToTab('exams')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-800 hover:bg-emerald-50 transition-all shadow-xs flex items-center space-x-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Quản lý đề thi</span>
                    </button>

                    <button
                      onClick={() => onNavigateToTab('matrices')}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-800 hover:bg-emerald-50 transition-all shadow-xs flex items-center space-x-1.5"
                    >
                      <Grid3X3 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Ma trận & Bảng đặc tả</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    if (onNavigateToSessions) {
                      onNavigateToSessions(publishedResult.examId);
                    } else if (onNavigateToTab) {
                      onNavigateToTab('sessions');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all shadow-xs flex items-center space-x-1.5"
                >
                  <Radio className="w-3.5 h-3.5 text-slate-900" />
                  <span>Vào phòng thi</span>
                </button>
              </div>
            </div>
          )}

          {/* Preview View Tabs: Exam / Answers / Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={() => setPreviewTab('exam')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    previewTab === 'exam'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  Đề thi chuẩn A4 (Học sinh)
                </button>
                <button
                  onClick={() => setPreviewTab('answers')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    previewTab === 'answers'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                  Đáp án & Hướng dẫn chấm / Rubric
                </button>
                <button
                  onClick={() => setPreviewTab('matrix')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    previewTab === 'matrix'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5 inline mr-1" />
                  Bản Ma Trận CV 7991
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (previewTab === 'exam') {
                      exportExamToWord({
                        title: generatedExamData.exam.title,
                        subject: selectedSubject,
                        grade,
                        durationMinutes: generatedExamData.exam.duration_minutes,
                        questions: generatedExamData.questions,
                        structure: generatedExamData.structure,
                      });
                    } else if (previewTab === 'answers') {
                      exportAnswersToWord({
                        title: generatedExamData.exam.title,
                        subject: selectedSubject,
                        grade,
                        questions: generatedExamData.questions,
                      });
                    } else {
                      exportMatrixToWord({
                        title: generatedExamData.exam.title,
                        subject: selectedSubject,
                        grade,
                        matrixCells,
                      });
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-700 text-slate-700 rounded-lg shadow-2xs flex items-center space-x-1 transition-all"
                  title="Xuất tab hiện tại ra file Word (.docx) tương thích 100% Word Equation"
                >
                  <span className="w-4 h-4 rounded bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">W</span>
                  <span>Xuất Word (.docx)</span>
                </button>

                <button
                  onClick={() => {
                    if (previewTab === 'exam') {
                      exportExamToPdf({
                        title: generatedExamData.exam.title,
                        subject: selectedSubject,
                        grade,
                        durationMinutes: generatedExamData.exam.duration_minutes,
                        questions: generatedExamData.questions,
                        structure: generatedExamData.structure,
                      });
                    } else if (previewTab === 'answers') {
                      exportAnswersToPdf({
                        title: generatedExamData.exam.title,
                        subject: selectedSubject,
                        grade,
                        questions: generatedExamData.questions,
                      });
                    } else {
                      exportMatrixToPdf({
                        title: generatedExamData.exam.title,
                        subject: selectedSubject,
                        grade,
                        matrixCells,
                      });
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-rose-500 hover:text-rose-700 text-slate-700 rounded-lg shadow-2xs flex items-center space-x-1 transition-all"
                  title="Xuất tab hiện tại ra file PDF in ấn chuẩn A4"
                >
                  <span className="w-4 h-4 rounded bg-rose-600 text-white font-bold text-[9px] flex items-center justify-center">P</span>
                  <span>Xuất PDF</span>
                </button>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  {generatedExamData.questions.length} câu • {generatedExamData.exam.duration_minutes} phút
                </span>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className="p-8 max-w-4xl mx-auto space-y-8 print:p-0">
              {/* Exam Header */}
              <div className="border-b-2 border-slate-900 pb-4 text-center space-y-2">
                <div className="grid grid-cols-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <div className="text-left">
                    SỞ GIÁO DỤC VÀ ĐÀO TẠO<br />
                    TRƯỜNG THCS & THPT CHUYÊN KHẢO THÍ
                  </div>
                  <div className="text-right">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />
                    Độc lập - Tự do - Hạnh phúc
                  </div>
                </div>

                <div className="pt-3">
                  <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">
                    {generatedExamData.exam.title}
                  </h2>
                  <p className="text-xs text-slate-700 font-medium italic">
                    Thời gian làm bài: {generatedExamData.exam.duration_minutes} phút (không kể thời gian phát đề) • Hình thức: {formatInfo.label}
                  </p>
                </div>
              </div>

              {/* TAB 1: EXAM QUESTIONS */}
              {previewTab === 'exam' && (
                <div className="space-y-6">
                  {/* Group Questions by Part */}
                  {[1, 2, 3, 4].map((partNum) => {
                    const partQuestions = generatedExamData.questions.filter(
                      (q) => q.exam_part === partNum
                    );
                    if (partQuestions.length === 0) return null;

                    const partConfig = generatedExamData.structure.parts.find((p) => p.part === partNum);

                    return (
                      <div key={partNum} className="space-y-4">
                        <div className="bg-slate-100 p-2.5 rounded-lg font-bold text-xs text-slate-900 uppercase tracking-wider">
                          {partConfig?.title || `Phần ${partNum}`}
                        </div>

                        <div className="space-y-4 pl-1">
                          {partQuestions.map((q) => {
                            const isEditing = editingQuestionId === q.id;
                            const isRegenerating = regeneratingQuestionId === q.id;

                            return (
                              <div
                                key={q.id}
                                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all text-xs space-y-3"
                              >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-slate-900">
                                      Câu {q.question_order}:
                                    </span>
                                    <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                                      {q.points} điểm
                                    </span>
                                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                      {q.cognitive_level === 'recognition' && 'Nhận biết'}
                                      {q.cognitive_level === 'comprehension' && 'Thông hiểu'}
                                      {q.cognitive_level === 'application' && 'Vận dụng'}
                                      {q.cognitive_level === 'advanced_application' && 'Vận dụng cao'}
                                    </span>
                                    {q.is_advanced_application && (
                                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md font-bold text-[10px]">
                                        ★ Vận dụng cao
                                      </span>
                                    )}
                                  </div>

                                  {/* Action buttons */}
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={() => handleRegenerateQuestion(q)}
                                      disabled={isRegenerating}
                                      className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100"
                                      title="Tái sinh câu này bằng AI"
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-indigo-600' : ''}`} />
                                    </button>
                                    <button
                                      onClick={() => setEditingQuestionId(isEditing ? null : q.id)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100"
                                      title="Chỉnh sửa nội dung"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Question Content or Edit Mode */}
                                {isEditing ? (
                                  <div className="space-y-2 pt-1">
                                    <textarea
                                      id={`edit-content-${q.id}`}
                                      defaultValue={q.content}
                                      rows={3}
                                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                                    />
                                    <textarea
                                      id={`edit-exp-${q.id}`}
                                      defaultValue={q.explanation || ''}
                                      rows={2}
                                      placeholder="Giải thích / hướng dẫn chấm..."
                                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                                    />
                                    <div className="flex justify-end space-x-2">
                                      <button
                                        onClick={() => setEditingQuestionId(null)}
                                        className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md"
                                      >
                                        Hủy
                                      </button>
                                      <button
                                        onClick={() => {
                                          const c = (document.getElementById(`edit-content-${q.id}`) as HTMLTextAreaElement).value;
                                          const e = (document.getElementById(`edit-exp-${q.id}`) as HTMLTextAreaElement).value;
                                          handleSaveQuestionEdit(q.id, c, e);
                                        }}
                                        className="px-3 py-1 bg-indigo-600 text-white font-semibold rounded-md"
                                      >
                                        Lưu thay đổi
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-slate-800 font-medium leading-relaxed">
                                    <MathRenderer text={q.content} />
                                  </div>
                                )}

                                {/* Render Options (Part I) */}
                                {q.question_type === 'single_choice' && q.options && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {q.options.map((opt, oIdx) => (
                                      <div
                                        key={opt.id}
                                        className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-start space-x-2"
                                      >
                                        <span className="font-bold text-slate-700 shrink-0">
                                          {['A', 'B', 'C', 'D'][oIdx] || `${oIdx + 1}`}.
                                        </span>
                                        <div className="text-slate-800">
                                          <MathRenderer text={opt.content} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Render Statements (Part II True/False) */}
                                {q.question_type === 'true_false' && q.statements && (
                                  <div className="space-y-1.5 pt-1">
                                    {q.statements.map((st, sIdx) => (
                                      <div
                                        key={st.id}
                                        className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between gap-2"
                                      >
                                        <div className="text-slate-800">
                                          <MathRenderer text={st.statement} />
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-sm shrink-0">
                                          Đúng / Sai
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Render Sub-items (Part IV Essay with multiple items) */}
                                {q.question_type === 'essay' && q.sub_items && q.sub_items.length > 1 && (
                                  <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                                      Các ý hỏi thành phần ({q.sub_items.length} ý):
                                    </span>
                                    <div className="grid grid-cols-1 gap-2">
                                      {q.sub_items.map((sub, sIdx) => (
                                        <div key={sub.id || sIdx} className="p-2.5 rounded-lg bg-indigo-50/40 border border-indigo-100 flex items-start justify-between gap-3 text-xs">
                                          <div className="flex items-start space-x-2">
                                            <span className="font-bold text-indigo-700 uppercase shrink-0">
                                              Ý {sub.item_number || ['a', 'b', 'c'][sIdx]}:
                                            </span>
                                            <div className="text-slate-800">
                                              <MathRenderer text={sub.question_text} />
                                            </div>
                                          </div>
                                          <span className="shrink-0 text-[11px] font-bold text-indigo-600 bg-white border border-indigo-200 px-2 py-0.5 rounded-md shadow-2xs">
                                            {sub.points}đ
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Render Essay Rubric overview (Part IV) */}
                                {q.question_type === 'essay' && q.essay_rubric && (
                                  <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
                                    <div className="font-bold text-[11px] text-purple-900 mb-1">
                                      Tiêu chí chấm điểm tổng quan (Rubric):
                                    </div>
                                    <ul className="list-disc list-inside space-y-0.5 text-purple-950/80 text-[11px]">
                                      {q.essay_rubric.map((r) => (
                                        <li key={r.id}>
                                          <MathRenderer text={r.criterion} />: <span className="font-bold">+{r.points}đ</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: ANSWERS & DETAILED RUBRIC */}
              {previewTab === 'answers' && (
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium">
                    Hướng dẫn chấm điểm và thang điểm chi tiết được xuất đồng bộ từ quy chuẩn sư phạm của AI.
                  </div>

                  <div className="space-y-4">
                    {generatedExamData.questions.map((q) => (
                      <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-white text-xs space-y-2">
                        <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                          <span>Câu {q.question_order} ({q.points} điểm)</span>
                          <span className="text-indigo-600">{q.topic}</span>
                        </div>

                        {q.question_type === 'single_choice' && (
                          <div className="space-y-1">
                            <div className="font-bold text-emerald-700 flex items-center space-x-1">
                              <span>Đáp án đúng:</span>
                              <MathRenderer text={q.options?.find((o) => o.is_correct)?.content || 'Chưa định nghĩa'} />
                            </div>
                            {q.explanation && (
                              <div className="text-slate-600 italic">
                                <span className="font-semibold text-slate-700 not-italic">Hướng dẫn giải: </span>
                                <MathRenderer text={q.explanation} />
                              </div>
                            )}
                          </div>
                        )}

                        {q.question_type === 'true_false' && q.statements && (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-800">Đáp án chi tiết từng mệnh đề:</span>
                            {q.statements.map((st) => (
                              <div key={st.id} className="flex items-center space-x-2">
                                <span className={st.is_correct ? 'text-emerald-600 font-bold shrink-0' : 'text-rose-600 font-bold shrink-0'}>
                                  {st.is_correct ? '✓ ĐÚNG' : '✗ SAI'}:
                                </span>
                                <div className="text-slate-700">
                                  <MathRenderer text={st.statement} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.question_type === 'short_answer' && (
                          <div className="space-y-1">
                            <div className="font-bold text-emerald-700 flex items-center space-x-1">
                              <span>Đáp số chuẩn:</span>
                              <MathRenderer text={q.short_answer?.normalized_answer} />
                            </div>
                            {q.explanation && (
                              <div className="text-slate-600 italic">
                                <span className="font-semibold text-slate-700 not-italic">Hướng dẫn giải: </span>
                                <MathRenderer text={q.explanation} />
                              </div>
                            )}
                          </div>
                        )}

                        {q.question_type === 'essay' && (
                          q.sub_items && q.sub_items.length > 1 ? (
                            <div className="space-y-3 pt-1">
                              <span className="font-bold text-purple-900">
                                Hướng dẫn giải & Biểu điểm chấm chi tiết theo từng ý:
                              </span>
                              {q.sub_items.map((sub, sIdx) => (
                                <div key={sub.id || sIdx} className="p-3 bg-purple-50/40 border border-purple-100 rounded-lg space-y-2">
                                  <div className="flex items-center justify-between font-bold text-purple-950">
                                    <span>Ý {sub.item_number || ['a', 'b', 'c'][sIdx]}: <MathRenderer text={sub.question_text} /></span>
                                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[11px] font-bold shrink-0">
                                      {sub.points}đ
                                    </span>
                                  </div>
                                  <div className="text-slate-700 bg-white p-2.5 rounded border border-purple-100">
                                    <span className="font-semibold text-purple-900">Yêu cầu cần đạt / Đáp án: </span>
                                    <MathRenderer text={sub.expected_answer} />
                                  </div>
                                  {sub.scoring_rubric && sub.scoring_rubric.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-bold text-slate-700">Biểu điểm thành phần:</span>
                                      <table className="w-full text-left border-collapse border border-slate-200 bg-white text-[11px]">
                                        <thead>
                                          <tr className="bg-slate-50 text-slate-700">
                                            <th className="p-1.5 border border-slate-200">Tiêu chí chấm điểm</th>
                                            <th className="p-1.5 border border-slate-200 text-right w-20">Điểm</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {sub.scoring_rubric.map((r, rIdx) => (
                                            <tr key={rIdx}>
                                              <td className="p-1.5 border border-slate-200">
                                                <MathRenderer text={r.criterion} />
                                              </td>
                                              <td className="p-1.5 border border-slate-200 text-right font-bold text-indigo-700">
                                                {r.points}đ
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            q.essay_rubric && (
                              <div className="space-y-2">
                                <span className="font-bold text-purple-900">Biểu điểm chấm tự luận chi tiết:</span>
                                <table className="w-full text-left border-collapse border border-slate-200">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-700">
                                      <th className="p-2 border border-slate-200">Nội dung / Tiêu chí yêu cầu</th>
                                      <th className="p-2 border border-slate-200 text-right w-24">Điểm</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {q.essay_rubric.map((r) => (
                                      <tr key={r.id}>
                                        <td className="p-2 border border-slate-200">
                                          <MathRenderer text={r.criterion} />
                                        </td>
                                        <td className="p-2 border border-slate-200 text-right font-bold text-indigo-700">
                                          {r.points}đ
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: MATRIX IN PREVIEW */}
              {previewTab === 'matrix' && (
                <div className="space-y-4">
                  <CV7991MatrixTableView
                    cvData={cv7991Data}
                    onExportWord={async () => {
                      await exportMatrixToWord({
                        title: generatedExamData.exam.title,
                        subject: SubjectRuleEngine.getProfile(selectedSubject).name,
                        grade,
                        durationMinutes: generatedExamData.exam.duration_minutes,
                        questions: generatedExamData.questions,
                        structure: generatedExamData.structure,
                        matrixCells,
                        cvData: cv7991Data,
                      });
                    }}
                    onExportPdf={() => {
                      exportMatrixToPdf({
                        title: generatedExamData.exam.title,
                        subject: SubjectRuleEngine.getProfile(selectedSubject).name,
                        grade,
                        durationMinutes: generatedExamData.exam.duration_minutes,
                        questions: generatedExamData.questions,
                        structure: generatedExamData.structure,
                        matrixCells,
                        cvData: cv7991Data,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {generatedExamData && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          examData={{
            title: generatedExamData.exam.title,
            subject: selectedSubject,
            grade,
            durationMinutes: generatedExamData.exam.duration_minutes,
            questions: generatedExamData.questions || [],
            structure: generatedExamData.structure,
            matrixCells: matrixCells,
            cvData: cv7991Data,
          }}
        />
      )}

      {/* Regulations Modal */}
      <LegalRegulationsModal
        isOpen={isRegulationModalOpen}
        onClose={() => setIsRegulationModalOpen(false)}
        onSelectRegulation={(reg) => setActiveRegulation(reg)}
      />

      {/* User-Enforced Gemini API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaved={() => setHasKey(hasUserApiKey())}
      />
    </div>
  );
};
