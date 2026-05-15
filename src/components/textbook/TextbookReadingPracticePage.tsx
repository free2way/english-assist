import React from 'react';
import { Check, Mic2, Radio, Square } from 'lucide-react';
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
  onSelectReadingSentence,
}: Props) {
  const recordingTitle = isAzureAssessing
    ? '正在提交评分'
    : isRecordingSentence
      ? '正在录音'
      : '准备开始录音';
  const recordingDescription = isAzureAssessing
    ? '正在把你的朗读提交给 Azure 发音评测，请稍等。'
    : isRecordingSentence
      ? '请朗读上面的英文句子；读完后，点下面红色按钮结束录音并提交评分。'
      : '点下面按钮开始录音，系统会边录边准备发音评测。';
  const recordingButtonLabel = isAzureAssessing
    ? '正在评分...'
    : isRecordingSentence
      ? '结束录音并提交评分'
      : '开始录音朗读';

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
            <div
              className={cn(
                'mt-6 rounded-3xl border p-5 transition-all',
                isAzureAssessing
                  ? 'border-blue-100 bg-blue-50'
                  : isRecordingSentence
                    ? 'border-red-100 bg-red-50'
                    : 'border-purple-100 bg-white',
              )}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-2xl flex items-center justify-center',
                    isAzureAssessing
                      ? 'bg-blue-100 text-blue-600'
                      : isRecordingSentence
                        ? 'bg-red-100 text-red-600'
                        : 'bg-purple-100 text-purple-600',
                  )}
                >
                  {isRecordingSentence ? <Radio size={20} className="animate-pulse" /> : <Mic2 size={20} />}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800">{recordingTitle}</div>
                  <div className="text-sm text-slate-600 mt-1">{recordingDescription}</div>
                </div>
              </div>
              <button
                onClick={onToggleRecording}
                disabled={isAzureAssessing}
                className={cn(
                  'w-full sm:w-auto px-5 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm font-black',
                  isAzureAssessing
                    ? 'bg-slate-200 text-slate-500 cursor-wait'
                    : isRecordingSentence
                      ? 'bg-red-500 text-white shadow-red-100 hover:bg-red-600 active:scale-95'
                      : 'bg-purple-500 text-white hover:scale-105 active:scale-95',
                )}
                aria-label={isRecordingSentence ? '停止录音并提交评测' : '开始录音并朗读'}
              >
                {isRecordingSentence ? <Square size={18} /> : <Mic2 size={18} />}
                {recordingButtonLabel}
              </button>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              <button onClick={() => onPlaySentence(currentReadingSentence.text)} className="px-4 py-3 rounded-2xl bg-white border border-slate-100 text-blue-500 text-sm font-bold">
                播放本句
              </button>
              <button onClick={onCompleteCurrentSentence} className="px-4 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold">
                完成并进入下一句
              </button>
              <button
                onClick={() => {
                  if (!recordedSentenceUrl) return;
                  const audio = new Audio(recordedSentenceUrl);
                  audio.play().catch(() => undefined);
                }}
                disabled={!recordedSentenceUrl}
                className={cn(
                  'px-4 py-3 rounded-2xl text-sm font-bold',
                  recordedSentenceUrl
                    ? 'bg-white border border-amber-200 text-amber-600'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                学员录音回放
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
