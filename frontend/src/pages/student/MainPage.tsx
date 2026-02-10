/**
 * Student main page.
 */
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { useAuthStore } from '../../stores/auth';

export function StudentMainPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">
          안녕하세요, {user?.name}님!
        </h1>

        <div className="bg-surface border border-[#E2E8F0] rounded-xl p-6 text-center space-y-4">
          <div className="text-5xl">📝</div>
          <h2 className="text-xl font-semibold text-text-primary">
            영어 단어 레벨 테스트
          </h2>
          <p className="text-text-secondary">
            나의 영어 단어 실력을 테스트해보세요!
          </p>
          <button
            onClick={() => navigate('/test')}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
          >
            테스트 시작
          </button>
        </div>
      </div>
    </Layout>
  );
}

export default StudentMainPage;
