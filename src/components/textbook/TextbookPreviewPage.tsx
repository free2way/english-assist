import React from 'react';
import { Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { UnitBundle, StudyState, VocabItem } from './types';

interface Props {
  currentUnit: UnitBundle;
  studyState: StudyState;
  previewCompleted: boolean;
  onSelectStage: () => void;
  onPlayWord: (word: string) => void;
  onMarkWord: (wordId: string, mastered: boolean, word: VocabItem) => void;
  onMarkUnknown: (word: VocabItem) => void;
  onCompleteAndGoSentences: () => void;
}

export function TextbookPreviewPage({
  currentUnit,
  studyState,
  previewCompleted,
  onSelectStage,
  onPlayWord,
  onMarkWord,
  onMarkUnknown,
  onCompleteAndGoSentences,
}: Props) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800">课时1 词汇预习</h3>
        <button onClick={onSelectStage} className="text-xs font-bold text-blue-500">
          设为当前课时
        </button>
      </div>
      <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
        {currentUnit.vocab.slice(0, 12).map((word) => {
          const mastered = studyState.masteredWordIds.includes(word.id);
          return (
            <div key={word.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-800">{word.word}</div>
                  <div className="text-xs text-slate-400 font-mono">{word.phonetic}</div>
                  <div className="text-sm text-slate-600 mt-1">{word.definition}</div>
                  <div className="text-xs text-slate-500 mt-2 italic">"{word.example}"</div>
                </div>
                <button
                  onClick={() => onPlayWord(word.word)}
                  className="w-10 h-10 rounded-xl bg-white text-blue-500 flex items-center justify-center border border-slate-100"
                >
                  <Volume2 size={18} />
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => onMarkUnknown(word)}
                  className="flex-1 py-2 rounded-xl bg-white border border-slate-100 text-slate-500 text-xs font-bold"
                >
                  还不熟
                </button>
                <button
                  onClick={() => onMarkWord(word.id, true, word)}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-bold',
                    mastered ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  )}
                >
                  {mastered ? '已掌握' : '标记掌握'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={onCompleteAndGoSentences}
        className={cn('mt-4 w-full py-3 rounded-2xl text-white font-bold', previewCompleted ? 'bg-emerald-500' : 'bg-blue-500')}
      >
        {previewCompleted ? '词汇预习已完成，进入重点句页面' : '完成词汇预习并进入重点句页面'}
      </button>
    </div>
  );
}
