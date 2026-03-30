import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GrammarExercise, StudyState, UnitBundle } from './types';

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
}: Props) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="font-bold text-slate-800">{currentUnit.grammar.title}</h3>
          <p className="text-sm text-slate-500 mt-1">{currentUnit.grammar.focus}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="px-4 py-2 rounded-2xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-100">
            {currentUnit.grammar.sourceType === 'configured' ? '教材语法点已配置' : '语法点由教材内容自动生成'}
          </div>
          <div
            className={cn(
              'px-4 py-2 rounded-2xl text-xs font-bold',
              grammarCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-violet-50 text-violet-600 border border-violet-100'
            )}
          >
            {grammarCompleted ? '语法模块已完成' : `待完成 ${currentUnit.grammar.exercises.length - completedGrammarCount} 题`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500 mb-2">Grammar Focus</div>
            <p className="text-sm text-slate-600 leading-7">{currentUnit.grammar.summary}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Key Tips</div>
            <div className="space-y-2">
              {currentUnit.grammar.tips.map((tip) => (
                <div key={tip} className="text-sm text-slate-600">• {tip}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">Examples</div>
            <div className="space-y-3">
              {currentUnit.grammar.examples.map((example, index) => (
                <div key={`${example.text}-${index}`} className="rounded-2xl bg-white border border-slate-100 p-4">
                  <div className="font-bold text-slate-800">{example.text}</div>
                  <div className="text-sm text-slate-500 mt-1">{example.translation}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {currentUnit.grammar.exercises.map((exercise, index) => {
            const done = studyState.completedGrammarQuestionIds.includes(exercise.id);
            const feedback = grammarFeedback[exercise.id];
            return (
              <div key={exercise.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500 mb-2">Exercise {index + 1}</div>
                    <div className="font-bold text-slate-800">{exercise.prompt}</div>
                    <div className="text-sm text-slate-600 mt-2">{exercise.question}</div>
                  </div>
                  {done && <Check size={18} className="text-emerald-500 shrink-0" />}
                </div>

                {exercise.type === 'choice' || exercise.type === 'judge' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {exercise.options?.map((option) => (
                      <button
                        key={option}
                        onClick={() => onChoiceAnswer(exercise, option)}
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all',
                          done && option.trim().toLowerCase() === exercise.answer.trim().toLowerCase()
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-100 bg-white text-slate-700 hover:border-violet-200'
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 space-y-3">
                      {exercise.type === 'reorder' && exercise.tokens && (
                        <div className="flex flex-wrap gap-2">
                          {exercise.tokens.map((token, tokenIndex) => (
                            <span
                              key={`${exercise.id}:${token}:${tokenIndex}`}
                              className="px-3 py-2 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-600"
                            >
                              {token}
                            </span>
                          ))}
                        </div>
                      )}
                      <input
                        value={grammarDrafts[exercise.id] || ''}
                        onChange={(event) => onDraftChange(exercise.id, event.target.value)}
                        className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-violet-400"
                        placeholder={exercise.clue || '请输入答案'}
                      />
                    </div>
                    <button onClick={() => onFillAnswer(exercise)} className="px-5 py-3 rounded-2xl bg-violet-500 text-white text-sm font-bold">
                      {exercise.type === 'correction' ? '提交改错' : exercise.type === 'reorder' ? '检查句子' : '检查答案'}
                    </button>
                  </div>
                )}

                {feedback && (
                  <div
                    className={cn(
                      'mt-4 rounded-2xl border px-4 py-3 text-sm',
                      done ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'
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
  );
}
