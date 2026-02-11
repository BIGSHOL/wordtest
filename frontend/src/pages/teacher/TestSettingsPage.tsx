/**
 * Test assignment page for teachers.
 * Supports cross-book range selection.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { StudentSelectionCard } from '../../components/test-settings/StudentSelectionCard';
import { TestConfigPanel, type TestConfigState } from '../../components/test-settings/TestConfigPanel';
import { AssignmentStatusTable } from '../../components/test-settings/AssignmentStatusTable';
import { studentService } from '../../services/student';
import { wordService } from '../../services/word';
import { testAssignmentService } from '../../services/testAssignment';
import type { User } from '../../types/auth';
import type { LessonInfo } from '../../services/word';
import type { TestAssignmentItem } from '../../services/testAssignment';
import { logger } from '../../utils/logger';

export function TestSettingsPage() {
  const navigate = useNavigate();

  // Data
  const [students, setStudents] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TestAssignmentItem[]>([]);
  const [books, setBooks] = useState<string[]>([]);
  const [lessonsStart, setLessonsStart] = useState<LessonInfo[]>([]);
  const [lessonsEnd, setLessonsEnd] = useState<LessonInfo[]>([]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Config
  const [config, setConfig] = useState<TestConfigState>({
    testType: 'periodic',
    questionCount: 20,
    customQuestionCount: '',
    perQuestionTime: 10,
    questionTypes: ['word_meaning'],
    bookStart: '',
    bookEnd: '',
    lessonStart: '',
    lessonEnd: '',
  });

  // UI
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load initial data
  useEffect(() => {
    const load = async () => {
      try {
        const [studentData, bookData, assignmentData] = await Promise.all([
          studentService.listStudents(),
          wordService.listBooks(),
          testAssignmentService.listAssignments(),
        ]);
        setStudents(studentData);
        setBooks(bookData);
        setAssignments(assignmentData);
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

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    if (!config.bookStart || !config.bookEnd || !config.lessonStart || !config.lessonEnd) return;
    if (config.questionTypes.length === 0) return;

    const questionCount = config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;
    if (questionCount <= 0) return;

    setIsSubmitting(true);
    try {
      await testAssignmentService.assignTest({
        student_ids: Array.from(selectedIds),
        test_type: config.testType,
        question_count: questionCount,
        per_question_time_seconds: config.perQuestionTime,
        question_types: config.questionTypes,
        book_name: config.bookStart,
        book_name_end: config.bookEnd !== config.bookStart ? config.bookEnd : undefined,
        lesson_range_start: config.lessonStart,
        lesson_range_end: config.lessonEnd,
      });
      setSelectedIds(new Set());
      await refreshAssignments();
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

  const handleViewResult = (studentId: string) => {
    navigate(`/students/${studentId}/results`);
  };

  const canAssign =
    selectedIds.size > 0 &&
    !!config.bookStart &&
    !!config.bookEnd &&
    !!config.lessonStart &&
    !!config.lessonEnd &&
    config.questionTypes.length > 0 &&
    (config.questionCount > 0 || (config.questionCount === -1 && parseInt(config.customQuestionCount) > 0));

  return (
    <TeacherLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-text-primary">테스트 출제</h1>
            <p className="text-[13px] text-text-secondary mt-1">
              학생을 선택하고 테스트를 설정한 뒤 출제합니다
            </p>
          </div>
          <button
            onClick={handleAssign}
            disabled={!canAssign || isSubmitting}
            className="flex items-center justify-center rounded-[10px] text-sm font-semibold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)',
              padding: '10px 24px',
            }}
          >
            {isSubmitting ? '출제 중...' : '테스트 출제하기'}
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6">
          {/* Left Column */}
          <div className="flex-1 min-w-0 space-y-5">
            <StudentSelectionCard
              students={students}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
            />
            <AssignmentStatusTable
              assignments={assignments}
              onDelete={handleDelete}
              onViewResult={handleViewResult}
            />
          </div>

          {/* Right Column */}
          <div className="w-[380px] shrink-0">
            <div className="sticky top-6">
              <TestConfigPanel
                config={config}
                onConfigChange={setConfig}
                books={books}
                lessonsStart={lessonsStart}
                lessonsEnd={lessonsEnd}
              />
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default TestSettingsPage;
