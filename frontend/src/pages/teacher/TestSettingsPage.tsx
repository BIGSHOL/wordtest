/**
 * Test configuration management page.
 */
import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { logger } from '../../utils/logger';
import { testConfigService, type TestConfig, type CreateTestConfigRequest, type UpdateTestConfigRequest } from '../../services/testConfig';
import { Plus, Settings, Clock, BookOpen, ToggleLeft, ToggleRight, Copy, Hash } from 'lucide-react';

const QUESTION_OPTIONS = [10, 20, 30, 40, 50];
const TIME_OPTIONS = [
  { label: '5분', value: 300 },
  { label: '10분', value: 600 },
  { label: '15분', value: 900 },
  { label: '20분', value: 1200 },
  { label: '무제한', value: 0 },
];

export function TestSettingsPage() {
  const [configs, setConfigs] = useState<TestConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    test_type: 'placement' as 'placement' | 'periodic',
    question_count: 20,
    time_limit_seconds: 600,
    book_name: '',
    level_range_min: 1,
    level_range_max: 15,
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setIsLoading(true);
    try {
      const data = await testConfigService.listConfigs();
      setConfigs(data);
    } catch (error) {
      logger.error('Failed to load configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedConfig = configs.find((c) => c.id === selectedId);

  useEffect(() => {
    if (selectedConfig) {
      setFormData({
        name: selectedConfig.name,
        test_type: selectedConfig.test_type,
        question_count: selectedConfig.question_count,
        time_limit_seconds: selectedConfig.time_limit_seconds,
        book_name: selectedConfig.book_name || '',
        level_range_min: selectedConfig.level_range_min,
        level_range_max: selectedConfig.level_range_max,
      });
      setIsCreating(false);
    }
  }, [selectedConfig]);

  const handleSelectConfig = (id: string) => {
    setSelectedId(id);
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    setSelectedId(null);
    setIsCreating(true);
    setFormData({
      name: '',
      test_type: 'placement',
      question_count: 20,
      time_limit_seconds: 600,
      book_name: '',
      level_range_min: 1,
      level_range_max: 15,
    });
  };

  const handleToggleActive = async (config: TestConfig) => {
    try {
      await testConfigService.updateConfig(config.id, {
        is_active: !config.is_active,
      });
      await loadConfigs();
    } catch (error) {
      logger.error('Failed to toggle active:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (isCreating) {
        const createData: CreateTestConfigRequest = {
          name: formData.name,
          test_type: formData.test_type,
          question_count: formData.question_count,
          time_limit_seconds: formData.time_limit_seconds,
          book_name: formData.book_name || undefined,
          level_range_min: formData.level_range_min,
          level_range_max: formData.level_range_max,
        };
        const newConfig = await testConfigService.createConfig(createData);
        await loadConfigs();
        setSelectedId(newConfig.id);
        setIsCreating(false);
      } else if (selectedId) {
        const updateData: UpdateTestConfigRequest = {
          name: formData.name,
          question_count: formData.question_count,
          time_limit_seconds: formData.time_limit_seconds,
          book_name: formData.book_name || undefined,
          level_range_min: formData.level_range_min,
          level_range_max: formData.level_range_max,
        };
        await testConfigService.updateConfig(selectedId, updateData);
        await loadConfigs();
      }
    } catch (error) {
      logger.error('Failed to save config:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await testConfigService.deleteConfig(selectedId);
      await loadConfigs();
      setSelectedId(null);
      setIsCreating(false);
    } catch (error) {
      logger.error('Failed to delete config:', error);
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-text-primary">테스트 설정</h1>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            새 테스트 추가
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - Config List (60%) */}
          <div className="lg:col-span-3">
            <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border-subtle">
                <h2 className="text-lg font-semibold text-text-primary">테스트 목록</h2>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-text-secondary">로딩 중...</div>
              ) : configs.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">
                  테스트 설정이 없습니다. 새 테스트를 추가해주세요.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      onClick={() => handleSelectConfig(config.id)}
                      className={`px-5 py-4 cursor-pointer transition-colors ${
                        selectedId === config.id
                          ? 'bg-teal-light'
                          : 'hover:bg-bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Toggle Switch */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(config);
                          }}
                          className="text-text-secondary hover:text-text-primary transition-colors"
                        >
                          {config.is_active ? (
                            <ToggleRight className="w-8 h-8 text-teal" />
                          ) : (
                            <ToggleLeft className="w-8 h-8" />
                          )}
                        </button>

                        {/* Config Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-text-primary">{config.name}</h3>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                config.test_type === 'placement'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {config.test_type === 'placement' ? '배치' : '정기'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-text-secondary">
                            <span
                              className="flex items-center gap-1 font-mono text-xs bg-bg-muted px-1.5 py-0.5 rounded cursor-pointer hover:bg-border-subtle transition-colors"
                              title="클릭하여 코드 복사"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(config.test_code);
                              }}
                            >
                              <Hash className="w-3.5 h-3.5" />
                              {config.test_code}
                              <Copy className="w-3 h-3 text-text-tertiary" />
                            </span>
                            <span className="flex items-center gap-1">
                              <Settings className="w-4 h-4" />
                              {config.question_count}문제
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {config.time_limit_seconds === 0
                                ? '무제한'
                                : `${Math.floor(config.time_limit_seconds / 60)}분`}
                            </span>
                            {config.book_name && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-4 h-4" />
                                {config.book_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status */}
                        <div className="text-right">
                          <span
                            className={`text-xs font-medium ${
                              config.is_active ? 'text-teal' : 'text-text-tertiary'
                            }`}
                          >
                            {config.is_active ? '활성' : '비활성'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Settings Detail (40%) */}
          <div className="lg:col-span-2">
            {(selectedConfig || isCreating) && (
              <div className="bg-surface border border-border-subtle rounded-xl p-6 sticky top-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-text-primary">
                      {isCreating ? '새 테스트 추가' : '테스트 수정'}
                    </h2>
                    {!isCreating && (
                      <button
                        onClick={handleDelete}
                        className="text-sm text-wrong hover:underline"
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  {/* Test Code Display */}
                  {selectedConfig && (
                    <div className="flex items-center justify-between p-3 bg-bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-text-tertiary" />
                        <span className="text-sm text-text-secondary">테스트 코드</span>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedConfig.test_code)}
                        className="flex items-center gap-1.5 font-mono text-lg font-bold tracking-[0.15em] text-teal hover:opacity-80 transition-opacity"
                        title="코드 복사"
                      >
                        {selectedConfig.test_code}
                        <Copy className="w-4 h-4 text-text-tertiary" />
                      </button>
                    </div>
                  )}

                  {/* Form */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">
                        테스트 이름
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="예: 2024 1월 배치고사"
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
                      />
                    </div>

                    {/* Test Type (only for new) */}
                    {isCreating && (
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1.5">
                          테스트 유형
                        </label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={formData.test_type === 'placement'}
                              onChange={() => setFormData({ ...formData, test_type: 'placement' })}
                              className="w-4 h-4 text-teal focus:ring-teal"
                            />
                            <span className="text-sm text-text-primary">배치</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={formData.test_type === 'periodic'}
                              onChange={() => setFormData({ ...formData, test_type: 'periodic' })}
                              className="w-4 h-4 text-teal focus:ring-teal"
                            />
                            <span className="text-sm text-text-primary">정기</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Question Count */}
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">
                        문제 수
                      </label>
                      <div className="flex gap-2">
                        {QUESTION_OPTIONS.map((count) => (
                          <label key={count} className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              checked={formData.question_count === count}
                              onChange={() => setFormData({ ...formData, question_count: count })}
                              className="sr-only peer"
                            />
                            <span className="px-3 py-1.5 border border-border-subtle rounded-lg text-sm peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors">
                              {count}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Time Limit */}
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">
                        제한 시간
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {TIME_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              checked={formData.time_limit_seconds === option.value}
                              onChange={() =>
                                setFormData({ ...formData, time_limit_seconds: option.value })
                              }
                              className="sr-only peer"
                            />
                            <span className="px-3 py-1.5 border border-border-subtle rounded-lg text-sm peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors">
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Level Range */}
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">
                        레벨 범위
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={formData.level_range_min}
                          onChange={(e) =>
                            setFormData({ ...formData, level_range_min: parseInt(e.target.value) || 1 })
                          }
                          className="w-20 px-3 py-2 border border-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
                        />
                        <span className="text-text-secondary">~</span>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={formData.level_range_max}
                          onChange={(e) =>
                            setFormData({ ...formData, level_range_max: parseInt(e.target.value) || 15 })
                          }
                          className="w-20 px-3 py-2 border border-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Book Filter */}
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1.5">
                        교재 필터 (선택)
                      </label>
                      <input
                        type="text"
                        value={formData.book_name}
                        onChange={(e) => setFormData({ ...formData, book_name: e.target.value })}
                        placeholder="예: Word Master"
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
                      />
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={handleSave}
                      disabled={!formData.name.trim()}
                      className="w-full py-2.5 bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? '추가' : '저장'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!selectedConfig && !isCreating && (
              <div className="bg-surface border border-border-subtle rounded-xl p-12 text-center">
                <Settings className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
                <p className="text-text-secondary">
                  테스트를 선택하여 설정을 수정하거나<br />
                  새 테스트를 추가해주세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default TestSettingsPage;
