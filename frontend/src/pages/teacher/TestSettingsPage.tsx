/**
 * Test assignment page for teachers.
 * Supports cross-book range selection.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { TestConfigPanel, type TestConfigState } from '../../components/test-settings/TestConfigPanel';
import { AssignmentStatusTable } from '../../components/test-settings/AssignmentStatusTable';
import { ConfigPreviewPanel } from '../../components/test-settings/ConfigPreviewPanel';
import { TestConfigListPanel } from '../../components/test-settings/TestConfigListPanel';
import { AssignStudentsModal } from '../../components/test-settings/AssignStudentsModal';
import { studentService } from '../../services/student';
import { wordService } from '../../services/word';
import { testAssignmentService } from '../../services/testAssignment';
import type { User } from '../../types/auth';
import type { LessonInfo } from '../../services/word';
import type { TestAssignmentItem, TestConfigItem, CreateTestConfigRequest } from '../../services/testAssignment';
import { logger } from '../../utils/logger';

type Tab = 'create' | 'configs' | 'status';

const TAB_ITEMS: { key: Tab; label: string }[] = [
  { key: 'create', label: '테스트 출제' },
  { key: 'configs', label: '생성된 테스트' },
  { key: 'status', label: '출제 현황' },
];

export function TestSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('create');

  // Data
  const [students, setStudents] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TestAssignmentItem[]>([]);
  const [books, setBooks] = useState<string[]>([]);
  const [lessonsStart, setLessonsStart] = useState<LessonInfo[]>([]);
  const [lessonsEnd, setLessonsEnd] = useState<LessonInfo[]>([]);

  // Configs (test-only, no students)
  const [configs, setConfigs] = useState<TestConfigItem[]>([]);
  const [assignModalConfig, setAssignModalConfig] = useState<TestConfigItem | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Config
  const [config, setConfig] = useState<TestConfigState>({
    timeMode: 'per_question',
    perQuestionTime: 10,
    customPerQuestionTime: '',
    totalTime: 600,
    customTotalTime: '',
    questionCount: 20,
    customQuestionCount: '',
    questionSelectionMode: 'engine',
    questionTypes: ['en_to_ko', 'ko_to_en'],
    skillAreas: [],
    engine: 'levelup',
    bookStart: '',
    bookEnd: '',
    lessonStart: '',
    lessonEnd: '',
    distributionMode: 'equal',
    manualCounts: {},
    configName: '',
  });

  // Word count from API
  const [wordCount, setWordCount] = useState(0);
  // Compatible word counts per engine type (e.g. { emoji: 120, sentence: 300, ... })
  const [compatibleCounts, setCompatibleCounts] = useState<Record<string, number>>({});

  // UI
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch word count + compatible counts when range changes
  useEffect(() => {
    if (!config.bookStart || !config.bookEnd || !config.lessonStart || !config.lessonEnd) {
      setWordCount(0);
      setCompatibleCounts({});
      return;
    }
    const rangeParams = {
      book_start: config.bookStart,
      book_end: config.bookEnd,
      lesson_start: config.lessonStart,
      lesson_end: config.lessonEnd,
    };
    const fetchCounts = async () => {
      try {
        const [count, compat] = await Promise.all([
          wordService.countWordsInRange(rangeParams),
          wordService.getCompatibleCounts(rangeParams),
        ]);
        setWordCount(count);
        setCompatibleCounts(compat);
      } catch {
        setWordCount(0);
        setCompatibleCounts({});
      }
    };
    fetchCounts();
  }, [config.bookStart, config.bookEnd, config.lessonStart, config.lessonEnd]);

  // Auto-deselect question types that become disabled when range changes (engine mode only)
  useEffect(() => {
    if (config.questionSelectionMode !== 'engine') return;
    if (Object.keys(compatibleCounts).length === 0) return;
    const stillValid = config.questionTypes.filter(
      t => (compatibleCounts[t] ?? 0) >= 4
    );
    if (stillValid.length < config.questionTypes.length) {
      setConfig(prev => ({ ...prev, questionTypes: stillValid.length > 0 ? stillValid : ['en_to_ko', 'ko_to_en'] }));
    }
  }, [compatibleCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load initial data
  useEffect(() => {
    const load = async () => {
      try {
        const [studentData, bookData, assignmentData, configData] = await Promise.all([
          studentService.listStudents(),
          wordService.listBooks(),
          testAssignmentService.listAssignments(),
          testAssignmentService.listTestConfigs(),
        ]);
        setStudents(studentData);
        setBooks(bookData);
        setAssignments(assignmentData);
        setConfigs(configData);
      } catch (error) {
        logger.error('Failed to load data:', error);
      }
    };
    load();
  }, []);

  // Load lessons when start book changes
  useEffect(() => {
    if (!config.bookStart) {
      setLessonsStart([]);
      return;
    }
    const loadLessons = async () => {
      try {
        const data = await wordService.listLessons(config.bookStart);
        setLessonsStart(data);
      } catch (error) {
        logger.error('Failed to load start lessons:', error);
        setLessonsStart([]);
      }
    };
    loadLessons();
  }, [config.bookStart]);

  // Load lessons when end book changes
  useEffect(() => {
    if (!config.bookEnd) {
      setLessonsEnd([]);
      return;
    }
    // If same book, reuse start lessons
    if (config.bookEnd === config.bookStart) {
      setLessonsEnd(lessonsStart);
      return;
    }
    const loadLessons = async () => {
      try {
        const data = await wordService.listLessons(config.bookEnd);
        setLessonsEnd(data);
      } catch (error) {
        logger.error('Failed to load end lessons:', error);
        setLessonsEnd([]);
      }
    };
    loadLessons();
  }, [config.bookEnd, config.bookStart, lessonsStart]);

  // Auto-set lessonStart (and lessonEnd when same book) when lessonsStart loads
  useEffect(() => {
    if (lessonsStart.length > 0 && !config.lessonStart) {
      setConfig(prev => ({
        ...prev,
        lessonStart: lessonsStart[0].lesson,
        ...(prev.bookStart === prev.bookEnd
          ? { lessonEnd: lessonsStart[lessonsStart.length - 1].lesson }
          : {}),
      }));
    }
  }, [lessonsStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set lessonEnd when lessonsEnd loads
  useEffect(() => {
    if (lessonsEnd.length > 0 && !config.lessonEnd) {
      setConfig(prev => ({ ...prev, lessonEnd: lessonsEnd[lessonsEnd.length - 1].lesson }));
    }
  }, [lessonsEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === students.length && students.length > 0) {
        return new Set();
      }
      return new Set(students.map((s) => s.id));
    });
  }, [students]);

  const refreshAssignments = async () => {
    try {
      const data = await testAssignmentService.listAssignments();
      setAssignments(data);
    } catch (error) {
      logger.error('Failed to refresh assignments:', error);
    }
  };

  const refreshConfigs = async () => {
    try {
      const data = await testAssignmentService.listTestConfigs();
      setConfigs(data);
    } catch (error) {
      logger.error('Failed to refresh configs:', error);
    }
  };

  const handleCreateConfig = async () => {
    const effectiveCount = config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;

    const perQ = config.timeMode === 'per_question'
      ? (config.perQuestionTime === -1 ? parseInt(config.customPerQuestionTime) || 15 : config.perQuestionTime)
      : Math.ceil((config.totalTime === -1 ? parseInt(config.customTotalTime) * 60 || 600 : config.totalTime) / effectiveCount);

    const selectedTypes = config.questionSelectionMode === 'engine'
      ? config.questionTypes
      : config.skillAreas.length > 0 ? config.skillAreas : ['en_to_ko', 'ko_to_en'];

    const requestData: CreateTestConfigRequest = {
      name: config.configName.trim() || undefined,
      engine: config.engine,
      question_count: effectiveCount,
      per_question_time_seconds: perQ,
      question_types: selectedTypes,
      book_name: config.bookStart || undefined,
      book_name_end: config.bookEnd !== config.bookStart ? config.bookEnd : undefined,
      lesson_range_start: config.lessonStart || undefined,
      lesson_range_end: config.lessonEnd || undefined,
      total_time_override_seconds: config.timeMode === 'total'
        ? (config.totalTime === -1 ? parseInt(config.customTotalTime) * 60 || undefined : config.totalTime)
        : undefined,
      question_type_counts: config.distributionMode === 'manual' && Object.keys(config.manualCounts).length > 0
        ? config.manualCounts
        : undefined,
    };

    setIsSubmitting(true);
    try {
      await testAssignmentService.createTestConfig(requestData);
      await refreshConfigs();
      setActiveTab('configs');
    } catch (error) {
      logger.error('Failed to create test config:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!window.confirm('이 테스트 설정을 삭제하시겠습니까?')) return;
    try {
      await testAssignmentService.deleteTestConfig(configId);
      await refreshConfigs();
    } catch (error) {
      logger.error('Failed to delete config:', error);
    }
  };

  const handleAssignToConfig = (configId: string) => {
    const cfg = configs.find(c => c.id === configId);
    if (cfg) setAssignModalConfig(cfg);
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    if (!config.bookStart || !config.bookEnd || !config.lessonStart || !config.lessonEnd) return;

    // Validate question types based on selection mode
    if (config.questionSelectionMode === 'engine' && config.questionTypes.length === 0) return;
    if (config.questionSelectionMode === 'skill' && config.skillAreas.length === 0) return;

    const questionCount = config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;
    if (questionCount <= 0) return;

    // Derive per_question_time and total_time based on time mode
    const isExamMode = config.timeMode === 'total';
    const perQuestionTime = isExamMode
      ? Math.max(1, Math.ceil(config.totalTime / questionCount))
      : config.perQuestionTime;
    const totalTimeOverride = isExamMode ? config.totalTime : undefined;

    // For skill mode, send skill areas as question_types (prefixed)
    // Backend will resolve these; for now fallback to en_to_ko,ko_to_en
    const questionTypes = config.questionSelectionMode === 'engine'
      ? config.questionTypes
      : ['en_to_ko', 'ko_to_en']; // TODO: map skill areas to engines when backend ready

    const requestData = {
      student_ids: Array.from(selectedIds),
      name: config.configName.trim() || undefined,
      engine: config.engine,
      question_count: questionCount,
      per_question_time_seconds: perQuestionTime,
      question_types: questionTypes,
      book_name: config.bookStart,
      book_name_end: config.bookEnd !== config.bookStart ? config.bookEnd : undefined,
      lesson_range_start: config.lessonStart,
      lesson_range_end: config.lessonEnd,
      total_time_override_seconds: totalTimeOverride,
      question_type_counts: undefined as Record<string, number> | undefined,
    };

    if (config.distributionMode === 'manual') {
      requestData.question_type_counts = config.manualCounts;
    }

    setIsSubmitting(true);
    try {
      await testAssignmentService.assignTest(requestData);
      setSelectedIds(new Set());
      await refreshAssignments();
      setActiveTab('status');
    } catch (error) {
      logger.error('Failed to assign test:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('출제를 삭제하시겠습니까?')) return;
    try {
      await testAssignmentService.deleteAssignment(id);
      await refreshAssignments();
    } catch (error) {
      logger.error('Failed to delete assignment:', error);
    }
  };

  const handleReset = async (id: string) => {
    if (!window.confirm('이 테스트를 초기화하시겠습니까? 새 코드가 발급됩니다.')) return;
    try {
      await testAssignmentService.resetAssignment(id);
      await refreshAssignments();
    } catch (error) {
      logger.error('Failed to reset assignment:', error);
    }
  };

  const handleViewResult = (item: TestAssignmentItem) => {
    if ((item.assignment_type === 'mastery' || item.assignment_type === 'listening') && item.learning_session_id) {
      navigate(`/students/${item.student_id}/mastery/${item.learning_session_id}`);
    } else {
      navigate(`/students/${item.student_id}/results`);
    }
  };

  const hasValidTypes = config.questionSelectionMode === 'engine'
    ? config.questionTypes.length > 0
    : config.skillAreas.length > 0;

  const canCreateConfig =
    !!config.bookStart && !!config.bookEnd &&
    !!config.lessonStart && !!config.lessonEnd &&
    hasValidTypes &&
    (config.questionCount > 0 || (config.questionCount === -1 && parseInt(config.customQuestionCount) > 0));

  const canAssign = selectedIds.size > 0 && canCreateConfig;

  return (
    <TeacherLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Tab navigation */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1px solid #E8E8E6', backgroundColor: '#F8F8F6' }}
        >
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-3 text-[14px] font-semibold transition-all relative"
              style={{
                backgroundColor: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.key ? '#2D9CAE' : '#9C9B99',
                borderBottom: activeTab === tab.key ? '2px solid #2D9CAE' : '2px solid transparent',
              }}
            >
              {tab.label}
              {tab.key === 'configs' && configs.length > 0 && (
                <span
                  className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
                >
                  {configs.length}
                </span>
              )}
              {tab.key === 'status' && assignments.length > 0 && (
                <span
                  className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
                >
                  {assignments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: 테스트 출제 */}
        {activeTab === 'create' && (
          <div className="flex gap-6">
            <div className="w-[880px] shrink-0">
              <TestConfigPanel
                config={config}
                onConfigChange={setConfig}
                books={books}
                lessonsStart={lessonsStart}
                lessonsEnd={lessonsEnd}
                wordCount={wordCount}
                compatibleCounts={compatibleCounts}
                students={students}
                selectedIds={selectedIds}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
              />
            </div>
            <div className="flex-1 min-w-0">
              <ConfigPreviewPanel
                config={config}
                selectedStudentCount={selectedIds.size}
                wordCount={wordCount}
                onNameChange={(name) => setConfig(prev => ({ ...prev, configName: name }))}
                onAssign={handleAssign}
                onCreateConfig={handleCreateConfig}
                canAssign={canAssign}
                canCreateConfig={canCreateConfig}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* Tab: 생성된 테스트 */}
        {activeTab === 'configs' && (
          <TestConfigListPanel
            configs={configs}
            onAssign={handleAssignToConfig}
            onDelete={handleDeleteConfig}
          />
        )}

        {/* Tab: 출제 현황 */}
        {activeTab === 'status' && (
          <AssignmentStatusTable
            assignments={assignments}
            onDelete={handleDelete}
            onReset={handleReset}
            onViewResult={handleViewResult}
          />
        )}

        {/* 학생 배정 모달 (always available) */}
        {assignModalConfig && (
          <AssignStudentsModal
            isOpen={!!assignModalConfig}
            onClose={() => setAssignModalConfig(null)}
            config={assignModalConfig}
            students={students}
            onAssigned={async () => {
              setAssignModalConfig(null);
              await Promise.all([refreshAssignments(), refreshConfigs()]);
            }}
          />
        )}
      </div>
    </TeacherLayout>
  );
}

export default TestSettingsPage;
