/**
 * Test assignment page for teachers.
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
import { Send } from 'lucide-react';

export function TestSettingsPage() {
  const navigate = useNavigate();

  // Data
  const [students, setStudents] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TestAssignmentItem[]>([]);
  const [books, setBooks] = useState<string[]>([]);
  const [lessons, setLessons] = useState<LessonInfo[]>([]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Config
  const [config, setConfig] = useState<TestConfigState>({
    questionCount: 20,
    customQuestionCount: '',
    perQuestionTime: 10,
    questionTypes: ['word_meaning'],
    bookName: '',
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

  // Load lessons when book changes
  useEffect(() => {
    if (!config.bookName) {
      setLessons([]);
      return;
    }
    const loadLessons = async () => {
      try {
        const data = await wordService.listLessons(config.bookName);
        setLessons(data);
      } catch (error) {
        logger.error('Failed to load lessons:', error);
        setLessons([]);
      }
    };
    loadLessons();
  }, [config.bookName]);

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
    if (!config.bookName || !config.lessonStart || !config.lessonEnd) return;
    if (config.questionTypes.length === 0) return;

    const questionCount =
      config.questionCount === -1
        ? parseInt(config.customQuestionCount) || 0
        : config.questionCount;
    if (questionCount <= 0) return;

    setIsSubmitting(true);
    try {
      await testAssignmentService.assignTest({
        student_ids: Array.from(selectedIds),
        question_count: questionCount,
        per_question_time_seconds: config.perQuestionTime,
        question_types: config.questionTypes,
        book_name: config.bookName,
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

  const handleViewResult = (testSessionId: string) => {
    navigate(`/results/${testSessionId}`);
  };

  const canAssign =
    selectedIds.size > 0 &&
    config.bookName &&
    config.lessonStart &&
    config.lessonEnd &&
    config.questionTypes.length > 0 &&
    (config.questionCount > 0 || (config.questionCount === -1 && parseInt(config.customQuestionCount) > 0));

  return (
    <TeacherLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-text-primary">테스트 출제</h1>
            <p className="text-sm text-text-secondary mt-1">
              학생을 선택하고 테스트를 설정하여 출제하세요.
            </p>
          </div>
          <button
            onClick={handleAssign}
            disabled={!canAssign || isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal to-teal/80 text-white rounded-lg hover:from-teal/90 hover:to-teal/70 transition-all font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? '출제 중...' : '테스트 출제하기'}
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel (60%) */}
          <div className="lg:col-span-3 space-y-6">
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

          {/* Right Panel (40%) */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <TestConfigPanel
                config={config}
                onConfigChange={setConfig}
                books={books}
                lessons={lessons}
              />
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default TestSettingsPage;
