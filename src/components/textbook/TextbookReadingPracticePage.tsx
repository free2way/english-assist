import React from 'react';
import { Check, Mic2, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AzurePronunciationResult, StudyState, UnitBundle } from './types';

interface Props {
  currentUnit: UnitBundle;
  studyState: StudyState;
  currentReadingSentence: UnitBundle['sentences'][number] | undefined;
  readingIndex: number;
  isRecordingSentence: boolean;
  recordedSentenceUrl: string;
  recognizedSentenceText: string;
  pronunciationScore: number | null;
  recordingError: string;
  azureAssessment: AzurePronunciationResult | null;
  azureAssessmentError: string;
  isAzureAssessing: boolean;
  getPronunciationHint: (score: number) => string;
  onSelectStage: () => void;
  onPlaySentence: (text: string) => void;
  onToggleRecording: () => void;
  onCompleteCurrentSentence: () => void;
  onMarkNotSmooth: () => void;
  onSelectReadingSentence: (index: number) => void;
}

export function TextbookReadingPracticePage({
  currentUnit,
  studyState,
  currentReadingSentence,
  readingIndex,
  isRecordingSentence,
  recordedSentenceUrl,
  recognizedSentenceText,
  pronunciationScore,
  recordingError,
  azureAssessment,
  azureAssessmentError,
  isAzureAssessing,
  getPronunciationHint,
  onSelectStage,
  onPlaySentence,
  onToggleRecording,
  onCompleteCurrentSentence,
  onMarkNotSmooth,
  onSelectReadingSentence,
}: Props) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="font-bold text-slate-800">课文朗读训练</h3>
          <p className="text-sm text-slate-500 mt-1">按句推进，逐句播放、跟读、标记完成。</p>
        </div>
        <button onClick={onSelectStage} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold">
          当前课时：重点句跟读
        </button>
      </div>

      {currentReadingSentence ? (
        <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
          <div className="rounded-3xl bg-slate-50 border border-slate-100 p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
              Sentence {readingIndex + 1}/{currentUnit.sentences.length}
            </div>
            <div className="text-2xl font-black text-slate-800 leading-relaxed">{currentReadingSentence.text}</div>
            <div className="text-sm text-slate-500 mt-3">{currentReadingSentence.translation}</div>
            <div className="mt-6 flex flex-col items-start gap-4">
              <button
                onClick={onToggleRecording}
                disabled={isAzureAssessing}
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all',
                  isAzureAssessing
                    ? 'bg-slate-200 text-slate-500'
                    : isRecordingSentence
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-purple-500 text-white hover:scale-105 active:scale-95',
                )}
                aria-label={isRecordingSentence ? '停止录音并提交评测' : '开始录音并朗读'}
              >
                {isRecordingSentence ? <Square size={28} /> : <Mic2 size={30} />}
              </button>
              <div className="text-sm font-bold text-slate-700">
                {isAzureAssessing
                  ? '正在提交 Azure 评测...'
                  : isRecordingSentence
                    ? '正在录音，请朗读；读完后再点一次麦克风提交评测'
                    : '点一下麦克风开始录音，读完后再点一次停止并评测'}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              <button onClick={() => onPlaySentence(currentReadingSentence.text)} className="px-4 py-3 rounded-2xl bg-white border border-slate-100 text-blue-500 text-sm font-bold">
                播放本句
              </button>
              <button onClick={onCompleteCurrentSentence} className="px-4 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold">
                完成并进入下一句
              </button>
              <button onClick={onMarkNotSmooth} className="px-4 py-3 rounded-2xl bg-white border border-amber-200 text-amber-600 text-sm font-bold">
                这句读不顺
              </button>
            </div>

            {(recordedSentenceUrl || recognizedSentenceText || recordingError) && (
              <div className="mt-6 rounded-2xl bg-white border border-slate-100 p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-400">跟读对比结果</div>
                    <div className="text-sm text-slate-600 mt-1">用同一个麦克风按钮控制开始和停止，第二次点击后会立刻提交 Azure 发音评测。</div>
                  </div>
                  {pronunciationScore !== null && (
                    <div
                      className={cn(
                        'px-3 py-2 rounded-xl text-sm font-bold',
                        pronunciationScore >= 80 ? 'bg-emerald-50 text-emerald-600' : pronunciationScore >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                      )}
                    >
                      发音相似度 {pronunciationScore}%
                    </div>
                  )}
                </div>

                {recordedSentenceUrl && (
                  <div>
                    <div className="text-xs font-bold text-slate-400 mb-2">我的录音</div>
                    <audio controls src={recordedSentenceUrl} className="w-full" />
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-xs font-bold text-slate-400 mb-2">目标句子</div>
                    <div className="text-sm font-bold text-slate-800">{currentReadingSentence.text}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-xs font-bold text-slate-400 mb-2">识别结果</div>
                    <div className="text-sm font-bold text-slate-800">{recognizedSentenceText || '等待识别结果'}</div>
                  </div>
                </div>

                {pronunciationScore !== null && (
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">{getPronunciationHint(pronunciationScore)}</div>
                )}

                {recordingError && <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">{recordingError}</div>}
              </div>
            )}

            {(azureAssessment || azureAssessmentError) && (
              <div className="mt-6 rounded-2xl bg-white border border-slate-100 p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-400 mb-1">Azure 发音评测</div>
                    <div className="text-sm text-slate-600">基于参考句进行准确度、流利度和完整度评测。</div>
                  </div>
                  {azureAssessment && <div className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold">总分 {azureAssessment.pronunciationScore}</div>}
                </div>

                {azureAssessment && (
                  <>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-400">发音总分</div>
                        <div className="text-xl font-black text-slate-800 mt-1">{azureAssessment.pronunciationScore}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-400">准确度</div>
                        <div className="text-xl font-black text-slate-800 mt-1">{azureAssessment.accuracyScore}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-400">流利度</div>
                        <div className="text-xl font-black text-slate-800 mt-1">{azureAssessment.fluencyScore}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-400">完整度</div>
                        <div className="text-xl font-black text-slate-800 mt-1">{azureAssessment.completenessScore}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs font-bold text-slate-400 mb-3">逐词反馈</div>
                        <div className="flex flex-wrap gap-2">
                          {azureAssessment.words.map((word) => (
                            <span
                              key={`${word.word}-${word.accuracyScore}`}
                              className={cn(
                                'px-3 py-2 rounded-xl text-sm font-bold border',
                                word.accuracyScore >= 85
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                  : word.accuracyScore >= 70
                                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                                    : 'bg-rose-50 border-rose-100 text-rose-700'
                              )}
                            >
                              {word.word} {Math.round(word.accuracyScore)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs font-bold text-slate-400 mb-3">学习建议</div>
                        <div className="space-y-2">
                          {azureAssessment.feedback.map((item) => (
                            <div key={item} className="text-sm text-slate-600">• {item}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {azureAssessmentError && <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">{azureAssessmentError}</div>}
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
            {currentUnit.sentences.map((sentence, index) => {
              const done = studyState.followedSentenceIds.includes(sentence.id);
              const active = currentReadingSentence.id === sentence.id;
              return (
                <button
                  key={sentence.id}
                  onClick={() => onSelectReadingSentence(index)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all',
                    active ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-800">{sentence.text}</span>
                    {done && <Check size={16} className="text-emerald-500 shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">{sentence.translation}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-sm text-slate-500">当前单元还没有可用的朗读句子。</div>
      )}
    </div>
  );
}
