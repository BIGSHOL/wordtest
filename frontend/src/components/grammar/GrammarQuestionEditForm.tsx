/** Inline edit form for grammar question data — type-specific fields */
import { useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { GRAMMAR_TYPE_LABELS } from '../../types/grammar';
import type { GrammarQuestionType, GrammarQuestionBrowse } from '../../types/grammar';

interface Props {
  question: GrammarQuestionBrowse;
  onSave: (data: { question_type?: string; question_data?: Record<string, any>; difficulty?: number }) => Promise<void>;
  onCancel: () => void;
}

const ALL_TYPES = Object.keys(GRAMMAR_TYPE_LABELS) as GrammarQuestionType[];

export function GrammarQuestionEditForm({ question, onSave, onCancel }: Props) {
  const [qType, setQType] = useState(question.question_type);
  const [difficulty, setDifficulty] = useState(question.difficulty);
  const [data, setData] = useState<Record<string, any>>({ ...question.question_data });
  const [saving, setSaving] = useState(false);

  const update = (key: string, val: any) => setData((prev) => ({ ...prev, [key]: val }));

  const updateArrayItem = (key: string, idx: number, val: string) => {
    const arr = [...(data[key] || [])];
    arr[idx] = val;
    update(key, arr);
  };

  const addArrayItem = (key: string, defaultVal = '') => {
    update(key, [...(data[key] || []), defaultVal]);
  };

  const removeArrayItem = (key: string, idx: number) => {
    const arr = [...(data[key] || [])];
    arr.splice(idx, 1);
    update(key, arr);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: any = {};
      if (qType !== question.question_type) patch.question_type = qType;
      if (difficulty !== question.difficulty) patch.difficulty = difficulty;
      // Always send question_data since it may have changed
      patch.question_data = data;
      await onSave(patch);
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-xs font-medium text-text-secondary mb-1';
  const inputCls = 'w-full px-3 py-1.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-accent-indigo';
  const textareaCls = `${inputCls} resize-y min-h-[60px]`;

  return (
    <div className="space-y-4 p-4 bg-[#FAFAF8] rounded-xl border border-border-subtle">
      {/* Common fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>문제 유형</label>
          <select value={qType} onChange={(e) => setQType(e.target.value)} className={inputCls}>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{GRAMMAR_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>난이도</label>
          <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className={inputCls}>
            <option value={1}>기본</option>
            <option value={2}>중급</option>
            <option value={3}>고급</option>
          </select>
        </div>
      </div>

      {/* Type-specific fields */}
      {qType === 'grammar_blank' && (
        <BlankFields data={data} update={update} updateArrayItem={updateArrayItem}
          addArrayItem={addArrayItem} removeArrayItem={removeArrayItem}
          labelCls={labelCls} inputCls={inputCls} textareaCls={textareaCls} />
      )}
      {qType === 'grammar_error' && (
        <ErrorFields data={data} update={update} updateArrayItem={updateArrayItem}
          addArrayItem={addArrayItem} removeArrayItem={removeArrayItem}
          labelCls={labelCls} inputCls={inputCls} />
      )}
      {qType === 'grammar_common' && (
        <CommonFields data={data} update={update} updateArrayItem={updateArrayItem}
          addArrayItem={addArrayItem} removeArrayItem={removeArrayItem}
          labelCls={labelCls} inputCls={inputCls} />
      )}
      {qType === 'grammar_usage' && (
        <UsageFields data={data} update={update} updateArrayItem={updateArrayItem}
          addArrayItem={addArrayItem} removeArrayItem={removeArrayItem}
          labelCls={labelCls} inputCls={inputCls} />
      )}
      {qType === 'grammar_order' && (
        <OrderFields data={data} update={update} updateArrayItem={updateArrayItem}
          addArrayItem={addArrayItem} removeArrayItem={removeArrayItem}
          labelCls={labelCls} inputCls={inputCls} />
      )}
      {qType === 'grammar_transform' && (
        <TransformFields data={data} update={update} labelCls={labelCls} inputCls={inputCls} textareaCls={textareaCls} />
      )}
      {qType === 'grammar_translate' && (
        <TranslateFields data={data} update={update} labelCls={labelCls} inputCls={inputCls} textareaCls={textareaCls} />
      )}
      {qType === 'grammar_pair' && (
        <PairFields data={data} update={update} labelCls={labelCls} inputCls={inputCls} textareaCls={textareaCls} />
      )}

      {/* Save / Cancel */}
      <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent-indigo text-white text-sm font-medium rounded-lg hover:bg-accent-indigo/90 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '저장 중...' : '저장'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 border border-border-subtle text-text-secondary text-sm font-medium rounded-lg hover:bg-bg-muted"
        >
          <X className="w-3.5 h-3.5" />
          취소
        </button>
      </div>
    </div>
  );
}

// ── Type-specific field components ────────────────────────

interface FieldProps {
  data: Record<string, any>;
  update: (key: string, val: any) => void;
  labelCls: string;
  inputCls: string;
  textareaCls?: string;
  updateArrayItem?: (key: string, idx: number, val: string) => void;
  addArrayItem?: (key: string, defaultVal?: string) => void;
  removeArrayItem?: (key: string, idx: number) => void;
}

function ArrayField({ label, fieldKey, items, updateArrayItem, addArrayItem, removeArrayItem, inputCls, labelCls }: {
  label: string; fieldKey: string; items: string[];
  updateArrayItem: (key: string, idx: number, val: string) => void;
  addArrayItem: (key: string, defaultVal?: string) => void;
  removeArrayItem: (key: string, idx: number) => void;
  inputCls: string; labelCls: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary w-5 shrink-0">{i + 1}.</span>
            <input
              value={item}
              onChange={(e) => updateArrayItem(fieldKey, i, e.target.value)}
              className={inputCls}
            />
            <button onClick={() => removeArrayItem(fieldKey, i)} className="text-red-400 hover:text-red-600 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => addArrayItem(fieldKey)}
          className="flex items-center gap-1 text-xs text-accent-indigo hover:underline"
        >
          <Plus className="w-3 h-3" /> 추가
        </button>
      </div>
    </div>
  );
}

function BlankFields({ data, update, updateArrayItem, addArrayItem, removeArrayItem, labelCls, inputCls, textareaCls }: FieldProps) {
  const choices = data.choices || [];
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>프롬프트 (비우면 기본값)</label>
        <input value={data.prompt || ''} onChange={(e) => update('prompt', e.target.value || undefined)} className={inputCls}
          placeholder="다음 빈칸에 들어갈 알맞은 말을 고르세요." />
      </div>
      <div>
        <label className={labelCls}>문장 (stem) — ___로 빈칸 표시</label>
        <textarea value={data.stem || ''} onChange={(e) => update('stem', e.target.value)} className={textareaCls} />
      </div>
      <ArrayField label="보기 (choices)" fieldKey="choices" items={choices}
        updateArrayItem={updateArrayItem!} addArrayItem={addArrayItem!} removeArrayItem={removeArrayItem!}
        inputCls={inputCls} labelCls={labelCls} />
      <div>
        <label className={labelCls}>정답 인덱스 (0부터)</label>
        <select value={data.correct_index ?? 0} onChange={(e) => update('correct_index', Number(e.target.value))} className={inputCls}>
          {choices.map((_: string, i: number) => (
            <option key={i} value={i}>{i + 1}. {choices[i]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ErrorFields({ data, update, updateArrayItem, addArrayItem, removeArrayItem, labelCls, inputCls }: FieldProps) {
  const sentences = data.sentences || [];
  const correctIndices = new Set<number>(data.correct_indices || []);

  const toggleIndex = (idx: number) => {
    const next = new Set(correctIndices);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    update('correct_indices', Array.from(next).sort());
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>프롬프트</label>
        <input value={data.prompt || ''} onChange={(e) => update('prompt', e.target.value)} className={inputCls} />
      </div>
      <ArrayField label="문장 (sentences)" fieldKey="sentences" items={sentences}
        updateArrayItem={updateArrayItem!} addArrayItem={addArrayItem!} removeArrayItem={removeArrayItem!}
        inputCls={inputCls} labelCls={labelCls} />
      <div>
        <label className={labelCls}>정답 인덱스 (체크)</label>
        <div className="flex flex-wrap gap-2">
          {sentences.map((_: string, i: number) => (
            <label key={i} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={correctIndices.has(i)} onChange={() => toggleIndex(i)} />
              {i + 1}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>select_count</label>
          <input type="number" value={data.select_count ?? 1} onChange={(e) => update('select_count', Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>invert (반전)</label>
          <select value={data.invert ? 'true' : 'false'} onChange={(e) => update('invert', e.target.value === 'true')} className={inputCls}>
            <option value="false">아니오</option>
            <option value="true">예</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function CommonFields({ data, update, updateArrayItem, addArrayItem, removeArrayItem, labelCls, inputCls }: FieldProps) {
  const sentences = data.sentences || [];
  const choices = data.choices || [];
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>프롬프트</label>
        <input value={data.prompt || ''} onChange={(e) => update('prompt', e.target.value)} className={inputCls} />
      </div>
      <ArrayField label="문장 (sentences)" fieldKey="sentences" items={sentences}
        updateArrayItem={updateArrayItem!} addArrayItem={addArrayItem!} removeArrayItem={removeArrayItem!}
        inputCls={inputCls} labelCls={labelCls} />
      <ArrayField label="보기 (choices, 선택적)" fieldKey="choices" items={choices}
        updateArrayItem={updateArrayItem!} addArrayItem={addArrayItem!} removeArrayItem={removeArrayItem!}
        inputCls={inputCls} labelCls={labelCls} />
      {choices.length > 0 && (
        <div>
          <label className={labelCls}>정답 인덱스</label>
          <select value={data.correct_index ?? 0} onChange={(e) => update('correct_index', Number(e.target.value))} className={inputCls}>
            {choices.map((_: string, i: number) => (
              <option key={i} value={i}>{i + 1}. {choices[i]}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function UsageFields({ data, update, updateArrayItem, addArrayItem, removeArrayItem, labelCls, inputCls }: FieldProps) {
  const sentences = data.sentences || [];
  const choices = data.choices || [];
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>프롬프트</label>
        <input value={data.prompt || ''} onChange={(e) => update('prompt', e.target.value)} className={inputCls} />
      </div>
      <ArrayField label="문장 (sentences)" fieldKey="sentences" items={sentences}
        updateArrayItem={updateArrayItem!} addArrayItem={addArrayItem!} removeArrayItem={removeArrayItem!}
        inputCls={inputCls} labelCls={labelCls} />
      <ArrayField label="보기 참조 (choices, 선택적)" fieldKey="choices" items={choices}
        updateArrayItem={updateArrayItem!} addArrayItem={addArrayItem!} removeArrayItem={removeArrayItem!}
        inputCls={inputCls} labelCls={labelCls} />
      <div>
        <label className={labelCls}>정답 인덱스</label>
        <select value={data.correct_index ?? 0} onChange={(e) => update('correct_index', Number(e.target.value))} className={inputCls}>
          {sentences.map((_: string, i: number) => (
            <option key={i} value={i}>{i + 1}. {sentences[i]?.slice(0, 40)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function OrderFields({ data, update, updateArrayItem, addArrayItem, removeArrayItem, labelCls, inputCls }: FieldProps) {
  const words = data.words || [];
  return (
    <div className="space-y-3">
      <ArrayField label="단어 (words)" fieldKey="words" items={words}
        updateArrayItem={updateArrayItem!} addArrayItem={addArrayItem!} removeArrayItem={removeArrayItem!}
        inputCls={inputCls} labelCls={labelCls} />
      <div>
        <label className={labelCls}>정답 (correct_answer)</label>
        <input value={data.correct_answer || ''} onChange={(e) => update('correct_answer', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>한국어 문장 (sentence_ko)</label>
        <input value={data.sentence_ko || ''} onChange={(e) => update('sentence_ko', e.target.value)} className={inputCls} />
      </div>
    </div>
  );
}

function TransformFields({ data, update, labelCls, inputCls, textareaCls }: FieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>지시문 (instruction)</label>
        <input value={data.instruction || ''} onChange={(e) => update('instruction', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>원문 (original)</label>
        <textarea value={data.original || ''} onChange={(e) => update('original', e.target.value)} className={textareaCls} />
      </div>
      <div>
        <label className={labelCls}>정답 (correct_answer)</label>
        <input value={data.correct_answer || ''} onChange={(e) => update('correct_answer', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>허용 답안 (쉼표 구분)</label>
        <input
          value={(data.acceptable_answers || []).join(', ')}
          onChange={(e) => update('acceptable_answers', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
          className={inputCls}
          placeholder="답안1, 답안2"
        />
      </div>
    </div>
  );
}

function TranslateFields({ data, update, labelCls, inputCls, textareaCls }: FieldProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>한국어 문장 (sentence_ko)</label>
        <textarea value={data.sentence_ko || ''} onChange={(e) => update('sentence_ko', e.target.value)} className={textareaCls} />
      </div>
      <div>
        <label className={labelCls}>정답 (correct_answer)</label>
        <input value={data.correct_answer || ''} onChange={(e) => update('correct_answer', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>허용 답안 (쉼표 구분)</label>
        <input
          value={(data.acceptable_answers || []).join(', ')}
          onChange={(e) => update('acceptable_answers', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
          className={inputCls}
          placeholder="답안1, 답안2"
        />
      </div>
      <div>
        <label className={labelCls}>힌트 단어 (쉼표 구분)</label>
        <input
          value={(data.hint_words || []).join(', ')}
          onChange={(e) => update('hint_words', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
          className={inputCls}
          placeholder="단어1, 단어2"
        />
      </div>
    </div>
  );
}

function PairFields({ data, update, labelCls, inputCls, textareaCls }: FieldProps) {
  const pairs: string[][] = data.paired_choices || [];

  const updatePair = (idx: number, pos: number, val: string) => {
    const newPairs = pairs.map((p) => [...p]);
    if (!newPairs[idx]) newPairs[idx] = ['', ''];
    newPairs[idx][pos] = val;
    update('paired_choices', newPairs);
  };

  const addPair = () => update('paired_choices', [...pairs, ['', '']]);
  const removePair = (idx: number) => {
    const newPairs = [...pairs];
    newPairs.splice(idx, 1);
    update('paired_choices', newPairs);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>문장 (stem) — (A), (B)로 빈칸 표시</label>
        <textarea value={data.stem || ''} onChange={(e) => update('stem', e.target.value)} className={textareaCls} />
      </div>
      <div>
        <label className={labelCls}>짝 보기 (paired_choices)</label>
        <div className="space-y-1.5">
          {pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary w-5 shrink-0">{i + 1}.</span>
              <input value={pair[0] || ''} onChange={(e) => updatePair(i, 0, e.target.value)} className={inputCls} placeholder="(A)" />
              <span className="text-xs text-text-tertiary">—</span>
              <input value={pair[1] || ''} onChange={(e) => updatePair(i, 1, e.target.value)} className={inputCls} placeholder="(B)" />
              <button onClick={() => removePair(i)} className="text-red-400 hover:text-red-600 shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button onClick={addPair} className="flex items-center gap-1 text-xs text-accent-indigo hover:underline">
            <Plus className="w-3 h-3" /> 짝 추가
          </button>
        </div>
      </div>
      <div>
        <label className={labelCls}>정답 인덱스</label>
        <select value={data.correct_index ?? 0} onChange={(e) => update('correct_index', Number(e.target.value))} className={inputCls}>
          {pairs.map((pair, i) => (
            <option key={i} value={i}>{i + 1}. {pair[0]} — {pair[1]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
