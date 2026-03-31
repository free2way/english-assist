import React from 'react';
import { cn } from '../../lib/utils';
import type { StudyState, UnitBundle, SentenceItem } from './types';

interface Props {
  currentUnit: UnitBundle;
  studyState: StudyState;
  readingCompleted: boolean;
  onSelectStage: () => void;
  onPlaySentence: (text: string) => void;
  onMicPracticeSentence: (sentence: SentenceItem, index: number) => void;
  onToggleSentenceFollowed: (sentenceId: string) => void;
  onNeedCorrection: (sentence: SentenceItem, index: number) => void;
  onCompleteAndOpenDictation: () => void;
}

export function TextbookSentencesPage({
  currentUnit,
  studyState,
  readingCompleted,
  onSelectStage,
  onPlaySentence,
  onMicPracticeSentence,
  onToggleSentenceFollowed,
  onNeedCorrection,
  onCompleteAndOpenDictation,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">课时2 重点句跟读</h3>
          <button onClick={onSelectStage} className="text-xs font-bold text-blue-500">
            设为当前课时
          </button>
        </div>
        <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
          {currentUnit.sentences.map((sentence, index) => {
            const followed = studyState.followedSentenceIds.includes(sentence.id);
            return (
              <div key={sentence.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="font-bold text-slate-800">{sentence.text}</div>
                <div className="text-sm text-slate-500 mt-1">{sentence.translation}</div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => onMicPracticeSentence(sentence, index)}
                    className="px-4 py-2 rounded-xl bg-purple-500 text-white text-xs font-bold"
                  >
                    麦克风跟读
                  </button>
                  <button
                    onClick={() => onPlaySentence(sentence.text)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-100 text-blue-500 text-xs font-bold"
                  >
                    播放跟读
                  </button>
                  <button
                    onClick={() => onToggleSentenceFollowed(sentence.id)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-xs font-bold',
                      followed ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    )}
                  >
                    {followed ? '已完成跟读' : '标记已跟读'}
                  </button>
                  <button
                    onClick={() => onNeedCorrection(sentence, index)}
                    className="px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-600 text-xs font-bold"
                  >
                    需要纠音
                  </button>
                </div>
                <div className="mt-3 text-[11px] text-slate-400">
                  点“麦克风跟读”会直接进入 Azure 朗读评测；点“需要纠音”会优先打开这句的纠音流程。
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={onCompleteAndOpenDictation}
          className={cn('mt-4 w-full py-3 rounded-2xl text-white font-bold', readingCompleted ? 'bg-emerald-500' : 'bg-purple-500')}
        >
          {readingCompleted ? '重点句跟读已完成，继续听写' : '完成重点句跟读并进入听写'}
        </button>
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
  );
}
