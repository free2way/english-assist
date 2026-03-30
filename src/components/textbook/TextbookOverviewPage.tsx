import React from 'react';
import { Check, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LessonStageKey, StudyState, TextbookPageKey, TextbookPageMeta, UnitBundle } from './types';

interface Props {
  currentUnit: UnitBundle;
  studyState: StudyState;
  textbookPages: TextbookPageMeta[];
  lockedPage?: TextbookPageKey;
  activePage: TextbookPageKey;
  createTaskId: (unitId: string, stage: LessonStageKey) => string;
  getStageLabel: (stage: LessonStageKey) => string;
  getLessonOutcomeLabel: (unit: UnitBundle | null, stage: LessonStageKey, studyState: StudyState) => string;
  onSetActivePage: (page: TextbookPageKey) => void;
  onStageCardClick: (stage: LessonStageKey) => void;
  onOpenStage: (stage: LessonStageKey) => void;
}

export function TextbookOverviewPage({
  currentUnit,
  studyState,
  textbookPages,
  lockedPage,
  activePage,
  createTaskId,
  getStageLabel,
  getLessonOutcomeLabel,
  onSetActivePage,
  onStageCardClick,
  onOpenStage,
}: Props) {
  return (
    <>
      {!lockedPage && (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            {textbookPages.map((page) => (
              <button
                key={page.id}
                onClick={() => onSetActivePage(page.id)}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all',
                  activePage === page.id ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <page.icon size={16} className={activePage === page.id ? 'text-blue-500' : 'text-slate-400'} />
                  <span className="text-sm font-bold text-slate-800">{page.label}</span>
                </div>
                <div className="text-[11px] text-slate-500">{page.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {currentUnit.stages.map((stage, index) => {
          const completed = studyState.completedTaskIds.includes(createTaskId(currentUnit.id, stage.key));
          return (
            <button
              key={stage.key}
              onClick={() => onStageCardClick(stage.key)}
              className={cn(
                'rounded-3xl border p-5 text-left transition-all',
                studyState.currentStage === stage.key ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Lesson {index + 1}</span>
                {completed ? <Check size={16} className="text-emerald-500" /> : <Clock size={16} className="text-slate-300" />}
              </div>
              <div className="font-bold text-slate-800">{stage.title}</div>
              <p className="text-xs text-slate-500 mt-2">{stage.description}</p>
              <div className="text-[10px] text-slate-400 mt-3">{stage.estimatedMinutes} 分钟</div>
              <div className="text-[11px] text-slate-400 mt-2">{getLessonOutcomeLabel(currentUnit, stage.key, studyState)}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {currentUnit.stages.map((stage) => (
          <div key={`${stage.key}-goal`} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 mb-2">{getStageLabel(stage.key)}</div>
            <div className="font-bold text-slate-800">{stage.description}</div>
            <div className="text-xs text-slate-500 mt-2">{getLessonOutcomeLabel(currentUnit, stage.key, studyState)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">课文内容</h3>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <p className="text-sm text-slate-600 leading-7">
              {currentUnit.passage || currentUnit.sentences.slice(0, 5).map((sentence) => sentence.text).join(' ')}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-3">建议先通读课文，再进入各个独立模块完成词汇、句型、语法和朗读训练。</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">重点句型</h3>
          <div className="space-y-3">
            {(currentUnit.patterns && currentUnit.patterns.length > 0 ? currentUnit.patterns : currentUnit.sentences.slice(0, 4)).map((sentence, index) => (
              <div key={sentence.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 mb-2">Pattern {index + 1}</div>
                <div className="font-bold text-slate-800">{sentence.text}</div>
                <div className="text-sm text-slate-500 mt-1">{sentence.translation}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {currentUnit.phrases && currentUnit.phrases.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">固定搭配</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {currentUnit.phrases.map((phrase) => (
              <div key={phrase.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="font-bold text-slate-800">{phrase.phrase}</div>
                <div className="text-sm text-slate-500 mt-1">{phrase.meaning}</div>
                <div className="text-xs text-slate-400 mt-2">{phrase.example}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">课时3-4 巩固与输出闭环</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
            <div className="text-xs font-bold text-purple-500 uppercase tracking-[0.2em] mb-2">Step 3</div>
            <div className="font-bold text-slate-800 mb-2">进入听写巩固</div>
            <p className="text-sm text-slate-500 mb-4">围绕本单元词汇和重点句做听写，系统会自动把错误收进错题本。</p>
            <button onClick={() => onOpenStage('dictation')} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">
              开始听写
            </button>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
            <div className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em] mb-2">Step 4</div>
            <div className="font-bold text-slate-800 mb-2">进入口语表达</div>
            <p className="text-sm text-slate-500 mb-4">围绕本单元话题和重点句做 AI 问答，把输入转化成真实输出。</p>
            <button onClick={() => onOpenStage('speaking')} className="px-4 py-2 rounded-xl blue-gradient text-white text-sm font-bold">
              开始口语任务
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
