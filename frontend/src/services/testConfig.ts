/**
 * Test configuration API service.
 */
import api from './api';

export interface TestConfig {
  id: string;
  teacher_id: string;
  name: string;
  test_code: string;
  test_type: 'placement' | 'periodic';
  question_count: number;
  time_limit_seconds: number;
  is_active: boolean;
  book_name: string | null;
  level_range_min: number;
  level_range_max: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTestConfigRequest {
  name: string;
  test_type: 'placement' | 'periodic';
  question_count: number;
  time_limit_seconds: number;
  book_name?: string;
  level_range_min?: number;
  level_range_max?: number;
}

export interface UpdateTestConfigRequest {
  name?: string;
  question_count?: number;
  time_limit_seconds?: number;
  is_active?: boolean;
  book_name?: string;
  level_range_min?: number;
  level_range_max?: number;
}

export const testConfigService = {
  async listConfigs(): Promise<TestConfig[]> {
    const response = await api.get<TestConfig[]>('/api/v1/test-configs');
    return response.data;
  },

  async createConfig(data: CreateTestConfigRequest): Promise<TestConfig> {
    const response = await api.post<TestConfig>('/api/v1/test-configs', data);
    return response.data;
  },

  async updateConfig(id: string, data: UpdateTestConfigRequest): Promise<TestConfig> {
    const response = await api.patch<TestConfig>(`/api/v1/test-configs/${id}`, data);
    return response.data;
  },

  async deleteConfig(id: string): Promise<void> {
    await api.delete(`/api/v1/test-configs/${id}`);
  },

  async getConfigByCode(code: string): Promise<TestConfig> {
    const response = await api.get<TestConfig>(`/api/v1/test-configs/code/${code}`);
    return response.data;
  },
};

export default testConfigService;
