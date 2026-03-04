/** Renders the appropriate grammar card component for preview */
import type { GrammarQuestionType } from '../../types/grammar';
import { GrammarBlankCard } from './GrammarBlankCard';
import { GrammarErrorCard } from './GrammarErrorCard';
import { GrammarCommonCard } from './GrammarCommonCard';
import { GrammarUsageCard } from './GrammarUsageCard';
import { GrammarTransformCard } from './GrammarTransformCard';
import { GrammarOrderCard } from './GrammarOrderCard';
import { GrammarTranslateCard } from './GrammarTranslateCard';
import { GrammarPairCard } from './GrammarPairCard';

interface Props {
  questionType: GrammarQuestionType;
  questionData: Record<string, any>;
}

const noop = () => {};

export function GrammarCardPreview({ questionType, questionData }: Props) {
  switch (questionType) {
    case 'grammar_blank':
      return <GrammarBlankCard data={questionData as any} selected={undefined} onSelect={noop} />;
    case 'grammar_error':
      return <GrammarErrorCard data={questionData as any} selected={undefined} onSelect={noop} />;
    case 'grammar_common':
      return <GrammarCommonCard data={questionData as any} selected={undefined} onSelect={noop} />;
    case 'grammar_usage':
      return <GrammarUsageCard data={questionData as any} selected={undefined} onSelect={noop} />;
    case 'grammar_transform':
      return <GrammarTransformCard data={questionData as any} selected={undefined} onSelect={noop} />;
    case 'grammar_order':
      return <GrammarOrderCard data={questionData as any} selected={undefined} onSelect={noop} />;
    case 'grammar_translate':
      return <GrammarTranslateCard data={questionData as any} selected={undefined} onSelect={noop} />;
    case 'grammar_pair':
      return <GrammarPairCard data={questionData as any} selected={undefined} onSelect={noop} />;
    default:
      return <pre className="text-xs text-text-tertiary">{JSON.stringify(questionData, null, 2)}</pre>;
  }
}
