import React, { useEffect, useState } from 'react';
import { Check, RotateCcw, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GrammarExercise, MistakeRecord, StudyState, UnitBundle } from './types';

interface Props {
  currentUnit: UnitBundle;
  studyState: StudyState;
  completedGrammarCount: number;
  grammarCompleted: boolean;
  grammarDrafts: Record<string, string>;
  grammarFeedback: Record<string, string>;
  onDraftChange: (exerciseId: string, value: string) => void;
  onChoiceAnswer: (exercise: GrammarExercise, option: string) => void;
  onFillAnswer: (exercise: GrammarExercise) => void;
  onPlayExample?: (text: string) => void;
  retryTarget?: MistakeRecord | null;
  onRetryTargetHandled?: () => void;
}

export function TextbookGrammarPage({
  currentUnit,
  studyState,
  completedGrammarCount,
  grammarCompleted,
  grammarDrafts,
  grammarFeedback,
  onDraftChange,
  onChoiceAnswer,
  onFillAnswer,
  onPlayExample,
  retryTarget,
  onRetryTargetHandled,
}: Props) {
  // Interactive word-tile selection indices per reorder exercise
  const [selectedTokenIndices, setSelectedTokenIndices] = useState<Record<string, number[]>>({});

  // Pre-fill broken sentence into correction inputs so students only fix the mistake!
  useEffect(() => {
    setSelectedTokenIndices({});
    currentUnit.grammar.exercises.forEach((exercise) => {
      if (exercise.type === 'correction' && !grammarDrafts[exercise.id]) {
        onDraftChange(exercise.id, exercise.question);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUnit.id]);

  const handleToggleToken = (exercise: GrammarExercise, tokenIndex: number) => {
    if (!exercise.tokens) return;
    const currentIndices = selectedTokenIndices[exercise.id] || [];
    const exists = currentIndices.includes(tokenIndex);
    const nextIndices = exists
      ? currentIndices.filter((idx) => idx !== tokenIndex)
      : [...currentIndices, tokenIndex];
    setSelectedTokenIndices((prev) => ({ ...prev, [exercise.id]: nextIndices }));
    const composed = nextIndices.map((idx) => exercise.tokens![idx]).join(' ');
    onDraftChange(exercise.id, composed);
  };

  const handleClearTokens = (exercise: GrammarExercise) => {
    setSelectedTokenIndices((prev) => ({ ...prev, [exercise.id]: [] }));
    onDraftChange(exercise.id, '');
  };

  return (
    <div className="space-y-5">
      {retryTarget && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 flex items-center justify-between gap-3">
          <span>正在复练语法错题：<strong>{retryTarget.prompt}</strong>（答对对应高亮题即自动销账）</span>
          <button
            onClick={() => onRetryTargetHandled?.()}
            className="text-xs font-bold text-violet-600 hover:underline shrink-0"
          >
            退出复练
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{currentUnit.grammar.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{currentUnit.grammar.focus}</p>
          </div>
          <div
            className={cn(
              'px-4 py-2 rounded-2xl text-xs font-bold self-start',
              grammarCompleted
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-violet-50 text-violet-700 border border-violet-200',
            )}
          >
            {grammarCompleted
              ? `全部 ${currentUnit.grammar.exercises.length} 题已完成 ✓`
              : `已完成 ${completedGrammarCount} / ${currentUnit.grammar.exercises.length} 题`}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.35fr] gap-6">
          {/* Left column: concise grammar notes */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
              <div className="text-xs font-bold text-violet-600 mb-2">核心规则</div>
              <p className="text-sm text-slate-700 leading-7">{currentUnit.grammar.summary}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
              <div className="text-xs font-bold text-slate-500 mb-2.5">记住这几点</div>
              <div className="space-y-2">
                {currentUnit.grammar.tips.map((tip) => (
                  <div key={tip} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="text-violet-500 font-bold">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
              <div className="text-xs font-bold text-slate-500 mb-3">典型例句</div>
              <div className="space-y-2.5">
                {currentUnit.grammar.examples.map((example, index) => (
                  <div key={`${example.text}-${index}`} className="rounded-2xl bg-white border border-slate-100 p-3.5 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{example.text}</div>
                      <div className="text-xs text-slate-500 mt-1">{example.translation}</div>
                    </div>
                    {onPlayExample && (
                      <button
                        onClick={() => onPlayExample(example.text)}
                        className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 hover:bg-violet-100"
                        title="听例句读音"
                      >
                        <Volume2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: interactive exercises */}
          <div className="space-y-4">
            {currentUnit.grammar.exercises.map((exercise, index) => {
              const done = studyState.completedGrammarQuestionIds.includes(exercise.id);
              const feedback = grammarFeedback[exercise.id];
              const isRetryHighlight = Boolean(retryTarget && retryTarget.prompt.includes(exercise.question));
              const chosenIndices = selectedTokenIndices[exercise.id] || [];

              return (
                <div
                  key={exercise.id}
                  className={cn(
                    'rounded-3xl border p-5 transition-all',
                    isRetryHighlight
                      ? 'border-violet-400 bg-violet-50/40 ring-2 ring-violet-200'
                      : done
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : 'border-slate-100 bg-slate-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-violet-600">第 {index + 1} 题 · {exercise.prompt}</span>
                        {isRetryHighlight && (
                          <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold">错题复练</span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-800">{exercise.question}</div>
                    </div>
                    {done && (
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check size={14} />
                      </span>
                    )}
                  </div>

                  {exercise.type === 'choice' || exercise.type === 'judge' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {exercise.options?.map((option) => (
                        <button
                          key={option}
                          onClick={() => onChoiceAnswer(exercise, option)}
                          className={cn(
                            'rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all',
                            done && option.trim().toLowerCase() === exercise.answer.trim().toLowerCase()
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50/40',
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : exercise.type === 'reorder' && exercise.tokens ? (
                    <div className="space-y-3">
                      {/* Composed sentence drop zone */}
                      <div className="min-h-[52px] rounded-2xl bg-white border border-slate-200 px-3 py-2.5 flex flex-wrap items-center gap-2">
                        {chosenIndices.length === 0 ? (
                          <span className="text-xs text-slate-400">点击下方词块按顺序拼出完整句子（也可以直接在下方修改）</span>
                        ) : (
                          chosenIndices.map((tokenIdx, pos) => (
                            <button
                              key={`${exercise.id}-chosen-${tokenIdx}-${pos}`}
                              type="button"
                              onClick={() => handleToggleToken(exercise, tokenIdx)}
                              className="px-3 py-1.5 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 transition-all"
                              title="点击移除该词"
                            >
                              {exercise.tokens![tokenIdx]}
                            </button>
                          ))
                        )}
                        {chosenIndices.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleClearTokens(exercise)}
                            className="ml-auto text-xs font-bold text-slate-400 hover:text-slate-600 inline-flex items-center gap-1"
                          >
                            <RotateCcw size={12} />
                            清空
                          </button>
                        )}
                      </div>

                      {/* Clickable word tiles */}
                      <div className="flex flex-wrap gap-2">
                        {exercise.tokens.map((token, tokenIndex) => {
                          const used = chosenIndices.includes(tokenIndex);
                          return (
                            <button
                              key={`${exercise.id}:tile:${token}:${tokenIndex}`}
                              type="button"
                              disabled={used}
                              onClick={() => handleToggleToken(exercise, tokenIndex)}
                              className={cn(
                                'px-3.5 py-2 rounded-xl border text-sm font-bold transition-all',
                                used
                                  ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-default'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-violet-400 hover:text-violet-700 active:scale-95',
                              )}
                            >
                              {token}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          value={grammarDrafts[exercise.id] || ''}
                          onChange={(event) => onDraftChange(exercise.id, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              onFillAnswer(exercise);
                            }
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-violet-400"
                          placeholder="点击词块自动填入，也可键盘微调后按回车检查"
                        />
                        <button
                          onClick={() => onFillAnswer(exercise)}
                          className="px-5 py-2.5 rounded-2xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 transition-all shrink-0"
                        >
                          检查句子
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        value={grammarDrafts[exercise.id] || ''}
                        onChange={(event) => onDraftChange(exercise.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            onFillAnswer(exercise);
                          }
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-violet-400"
                        placeholder={exercise.clue || '输入答案后按回车提交'}
                      />
                      <button
                        onClick={() => onFillAnswer(exercise)}
                        className="px-5 py-3 rounded-2xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 transition-all shrink-0"
                      >
                        {exercise.type === 'correction' ? '提交改错' : '检查答案'}
                      </button>
                    </div>
                  )}

                  {exercise.type === 'correction' && (
                    <div className="text-[11px] text-slate-400 mt-2">
                      已为你预填原病句，直接修改出错的词并按回车提交即可。
                    </div>
                  )}

                  {feedback && (
                    <div
                      className={cn(
                        'mt-3 rounded-2xl border px-4 py-3 text-sm',
                        done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800',
                      )}
                    >
                      {feedback}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
