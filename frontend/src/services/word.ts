/**
 * Word database API service.
 */
import api from './api';

export interface Word {
  id: string;
  english: string;
  korean: string;
  level: number;
  category: string | null;
  book_name: string;
  lesson: string;
  part_of_speech: string | null;
  example_en: string | null;
  example_ko: string | null;
  created_at: string;
}

export interface CreateWordRequest {
  english: string;
  korean: string;
  level: number;
  category?: string;
  book_name?: string;
  lesson?: string;
  part_of_speech?: string;
  example_en?: string;
  example_ko?: string;
}

export interface UpdateWordRequest {
  english?: string;
  korean?: string;
  level?: number;
  category?: string;
  book_name?: string;
  lesson?: string;
  part_of_speech?: string;
  example_en?: string;
  example_ko?: string;
}

export interface WordListResponse {
  words: Word[];
  total: number;
}

export const wordService = {
  async listWords(params?: {
    level?: number;
    book_name?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<WordListResponse> {
    const response = await api.get<WordListResponse>('/api/v1/words', { params });
    return response.data;
  },

  async listBooks(): Promise<string[]> {
    const response = await api.get<string[]>('/api/v1/words/books');
    return response.data;
  },

  async createWord(data: CreateWordRequest): Promise<Word> {
    const response = await api.post<Word>('/api/v1/words', data);
    return response.data;
  },

  async updateWord(id: string, data: UpdateWordRequest): Promise<Word> {
    const response = await api.patch<Word>(`/api/v1/words/${id}`, data);
    return response.data;
  },

  async deleteWord(id: string): Promise<void> {
    await api.delete(`/api/v1/words/${id}`);
  },
};

export default wordService;
