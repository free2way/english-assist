import type { AzurePronunciationResult, AzurePronunciationWord } from '../components/textbook/types';

export interface SpeechTokenResponse {
  token: string;
  region: string;
  expiresInSeconds?: number;
}

export type SpeechTokenProvider = () => Promise<SpeechTokenResponse>;

type SpeechSdk = typeof import('microsoft-cognitiveservices-speech-sdk');

/**
 * The Azure Speech SDK is heavy (~1MB) and the authorization token is valid for
 * 10 minutes, so both are cached and can be warmed up before a student hits the
 * record button. This keeps the "click record -> start talking" gap low.
 */
let sdkPromise: Promise<SpeechSdk> | null = null;

const getSpeechSdk = (): Promise<SpeechSdk> => {
  if (!sdkPromise) {
    sdkPromise = import('microsoft-cognitiveservices-speech-sdk');
  }
  return sdkPromise;
};

export const preloadSpeechEngine = (provider?: SpeechTokenProvider) => {
  void getSpeechSdk();
  if (provider) {
    void ensureSpeechToken(provider).catch(() => undefined);
  }
};

const isDebugEnabled = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('speechDebug') === '1';
  } catch {
    return false;
  }
};

const debugLog = (...args: unknown[]) => {
  if (isDebugEnabled()) {
    console.log('[speech]', ...args);
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

// ---------------------------------------------------------------- token cache

interface CachedSpeechToken {
  token: string;
  region: string;
  expiresAt: number;
}

const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
let tokenCache: CachedSpeechToken | null = null;
let tokenInflight: Promise<CachedSpeechToken> | null = null;

export const invalidateSpeechToken = () => {
  tokenCache = null;
};

export const ensureSpeechToken = async (provider: SpeechTokenProvider): Promise<CachedSpeechToken> => {
  if (tokenCache && tokenCache.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache;
  }

  if (!tokenInflight) {
    tokenInflight = provider()
      .then((response) => {
        const ttlSeconds = response.expiresInSeconds && response.expiresInSeconds > 0 ? response.expiresInSeconds : 540;
        tokenCache = {
          token: response.token,
          region: response.region,
          expiresAt: Date.now() + ttlSeconds * 1000,
        };
        return tokenCache;
      })
      .finally(() => {
        tokenInflight = null;
      });
  }

  return tokenInflight;
};

// ------------------------------------------------------------------ microphone

const MICROPHONE_PERMISSION_TIMEOUT_MS = 30000;

export const openMicrophoneStream = async (): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持麦克风采集，请使用最新版 Chrome / Edge / Safari。');
  }

  const pending = navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // A permission prompt that is never answered used to leave the UI stuck in
  // "preparing" forever, so the wait is bounded here.
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new Error('等待麦克风授权超时：请在浏览器地址栏允许麦克风权限后重试。'));
    }, MICROPHONE_PERMISSION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([pending, timeout]);
  } catch (error) {
    // If the user answers the prompt late, do not leave the microphone open.
    void pending.then((stream) => stopMediaStream(stream)).catch(() => undefined);
    if (timedOut) throw error;

    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error('麦克风权限被拒绝：请在浏览器地址栏允许麦克风权限后重试。');
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      throw new Error('没有检测到麦克风设备，请接好耳麦后重试。');
    }
    throw new Error(`麦克风打开失败：${error instanceof Error ? error.message : name || '未知错误'}`);
  } finally {
    clearTimeout(timer);
  }
};

export const stopMediaStream = (stream: MediaStream | null | undefined) => {
  stream?.getTracks().forEach((track) => track.stop());
};

// -------------------------------------------------------------- result parsing

export interface PronunciationSegmentWord {
  word: string;
  accuracyScore: number;
  errorType: string;
  offset: number;
  duration: number;
}

export interface PronunciationSegment {
  recognizedText: string;
  pronunciationScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  words: PronunciationSegmentWord[];
  receivedAt: number;
}

const toSegment = (result: any, SpeechSDK: SpeechSdk, receivedAt: number): PronunciationSegment | null => {
  const jsonResult = result?.properties?.getProperty?.(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
  if (!jsonResult) return null;

  let parsed: any = null;
  try {
    parsed = JSON.parse(jsonResult);
  } catch {
    return null;
  }

  const bestResult = parsed?.NBest?.[0];
  const assessment = bestResult?.PronunciationAssessment;
  if (!assessment || assessment.PronScore === undefined) return null;

  const words: PronunciationSegmentWord[] = (bestResult?.Words || [])
    .map((item: any) => ({
      word: String(item.Word || ''),
      accuracyScore: Number(item.PronunciationAssessment?.AccuracyScore ?? 0),
      errorType: String(item.PronunciationAssessment?.ErrorType || 'None'),
      offset: Number(item.Offset ?? 0),
      duration: Number(item.Duration ?? 0),
    }))
    .filter((item: PronunciationSegmentWord) => item.word);

  return {
    recognizedText: String(bestResult?.Display || result?.text || '').trim(),
    pronunciationScore: Number(assessment.PronScore || 0),
    accuracyScore: Number(assessment.AccuracyScore || 0),
    fluencyScore: Number(assessment.FluencyScore || 0),
    completenessScore: Number(assessment.CompletenessScore || 0),
    words,
    receivedAt,
  };
};

const normalizeWord = (word: string) => word.toLowerCase().replace(/[^a-z0-9']/g, '');

type AlignedEntry =
  | { type: 'match'; word: string; accuracyScore: number; errorType: string }
  | { type: 'omission'; word: string }
  | { type: 'insertion'; word: string };

/**
 * Longest-common-subsequence alignment between the reference sentence and what
 * the service heard. In continuous mode the service does not return Omission /
 * Insertion tags, so they are derived here (same approach as the official
 * `pronunciationAssessmentContinue.js` sample).
 */
const alignWords = (referenceWords: string[], recognizedWords: PronunciationSegmentWord[]): AlignedEntry[] => {
  const n = referenceWords.length;
  const m = recognizedWords.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      table[i][j] =
        normalizeWord(referenceWords[i - 1]) === normalizeWord(recognizedWords[j - 1].word)
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  const entries: AlignedEntry[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const recognized = recognizedWords[j - 1];
    if (normalizeWord(referenceWords[i - 1]) === normalizeWord(recognized.word)) {
      entries.push({
        type: 'match',
        word: referenceWords[i - 1],
        accuracyScore: recognized.accuracyScore,
        errorType: recognized.errorType,
      });
      i -= 1;
      j -= 1;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      entries.push({ type: 'omission', word: referenceWords[i - 1] });
      i -= 1;
    } else {
      entries.push({ type: 'insertion', word: recognized.word });
      j -= 1;
    }
  }
  while (i > 0) {
    entries.push({ type: 'omission', word: referenceWords[i - 1] });
    i -= 1;
  }
  while (j > 0) {
    entries.push({ type: 'insertion', word: recognizedWords[j - 1].word });
    j -= 1;
  }

  return entries.reverse();
};

export interface PronunciationAssessmentOutcome {
  recognizedText: string;
  assessment: AzurePronunciationResult;
  weakWords: string[];
}

const round = (value: number) => Math.round(value);

/**
 * Continuous recognition can split one sentence into several `recognized`
 * events - a single mid-sentence pause is enough. Scoring only the last
 * fragment is what made the old scores look random; here all segments are
 * merged and re-scored with the weighting used by the official sample.
 */
export const aggregatePronunciationSegments = (segments: PronunciationSegment[], referenceText: string): PronunciationAssessmentOutcome => {
  const referenceWords = referenceText.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const allWords = segments.flatMap((segment) => segment.words);
  const aligned = alignWords(referenceWords, allWords);

  const matched = aligned.filter(
    (entry): entry is Extract<AlignedEntry, { type: 'match' }> => entry.type === 'match',
  );
  const omissions = aligned.filter((entry) => entry.type === 'omission').map((entry) => entry.word);
  const insertions = aligned.filter((entry) => entry.type === 'insertion').map((entry) => entry.word);

  const accuracyByAlignment = matched.length
    ? matched.reduce((sum, entry) => sum + entry.accuracyScore, 0) / matched.length
    : 0;
  const completenessByAlignment = referenceWords.length
    ? Math.min(100, (matched.length / referenceWords.length) * 100)
    : 0;

  const spanStart = allWords.length ? Math.min(...allWords.map((word) => word.offset)) : 0;
  const spanEnd = allWords.length ? Math.max(...allWords.map((word) => word.offset + word.duration)) : 0;
  const spokenDuration = allWords.reduce((sum, word) => sum + word.duration, 0);
  const fluencyByAlignment = spanEnd > spanStart
    ? Math.min(100, (spokenDuration / (spanEnd - spanStart)) * 100)
    : 0;

  // A single segment means the service scored the whole sentence against the
  // full reference text - trust its numbers. Several segments must be merged.
  const singleSegment = segments.length === 1;
  const accuracyScore = round(singleSegment ? segments[0].accuracyScore : accuracyByAlignment);
  const completenessScore = round(singleSegment ? segments[0].completenessScore : completenessByAlignment);
  const fluencyScore = round(singleSegment ? segments[0].fluencyScore : fluencyByAlignment);

  let pronunciationScore = round(segments[segments.length - 1].pronunciationScore);
  if (!singleSegment) {
    const sorted = [accuracyScore, completenessScore, fluencyScore].sort((a, b) => a - b);
    pronunciationScore = round(sorted[0] * 0.6 + sorted[1] * 0.2 + sorted[2] * 0.2);
  }

  const words: AzurePronunciationWord[] = aligned.map((entry) => {
    if (entry.type === 'omission') {
      return { word: entry.word, accuracyScore: 0, errorType: 'Omission' };
    }
    if (entry.type === 'insertion') {
      return { word: entry.word, accuracyScore: 0, errorType: 'Insertion' };
    }
    const errorType = entry.errorType && entry.errorType !== 'None'
      ? entry.errorType
      : entry.accuracyScore < 60
        ? 'Mispronunciation'
        : 'None';
    return { word: entry.word, accuracyScore: round(entry.accuracyScore), errorType };
  });

  const weakWordEntries = matched
    .filter((entry) => entry.accuracyScore < 70)
    .sort((a, b) => a.accuracyScore - b.accuracyScore);
  const weakWordLabels = weakWordEntries.slice(0, 3).map((entry) => `${entry.word}(${round(entry.accuracyScore)})`);

  const feedback: string[] = [];
  feedback.push(
    pronunciationScore >= 85
      ? '整体发音比较稳定，可以继续提高语流自然度。'
      : pronunciationScore >= 70
        ? '整体读音基本到位，建议重点回练低分单词。'
        : '整体发音还有提升空间，建议先慢速跟读再重新测。',
  );
  if (weakWordLabels.length > 0) {
    feedback.push(`建议优先回练：${weakWordLabels.join('、')}`);
  }
  if (omissions.length > 0) {
    feedback.push(
      `有 ${omissions.length} 处没有读到：${omissions.slice(0, 3).join('、')}${omissions.length > 3 ? ' 等' : ''}`,
    );
  }
  if (insertions.length > 0) {
    feedback.push(
      `多读了 ${insertions.length} 个词：${insertions.slice(0, 3).join('、')}${insertions.length > 3 ? ' 等' : ''}`,
    );
  }
  if (fluencyScore < 70) {
    feedback.push('流利度偏弱，建议按意群停顿后再完整朗读一遍。');
  }
  if (completenessScore < 85) {
    feedback.push('句子完整度不足，建议确保整句都读完。');
  }

  return {
    recognizedText: segments.map((segment) => segment.recognizedText).filter(Boolean).join(' ').trim(),
    assessment: {
      pronunciationScore,
      accuracyScore,
      fluencyScore,
      completenessScore,
      words,
      feedback,
    },
    weakWords: Array.from(new Set([...weakWordEntries.map((entry) => entry.word), ...omissions])),
  };
};

// ------------------------------------------------------------ recognition API

const toFriendlyError = (error: unknown, fallback: string): Error => {
  const raw = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : String(error ?? '');
  if (/401|403|unauthorized|authentication|token/i.test(raw)) {
    return new Error('Azure 语音服务授权失败（token 过期或无效），请刷新页面后重试。');
  }
  if (/1006|network|connect/i.test(raw)) {
    return new Error('连接 Azure 语音服务失败，请检查网络后重试。');
  }
  return new Error(raw ? `${fallback}：${raw}` : fallback);
};

const INITIAL_SILENCE_TIMEOUT_MS = 20000;

export async function recognizeSpeechFromMicrophone({
  getToken,
  language = 'en-US',
  mediaStream,
}: {
  getToken: SpeechTokenProvider;
  language?: string;
  mediaStream?: MediaStream;
}): Promise<string> {
  const SpeechSDK = await getSpeechSdk();
  const { token, region } = await ensureSpeechToken(getToken);
  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
  speechConfig.speechRecognitionLanguage = language;
  // The default initial-silence timeout (5s) is short for a hesitant student.
  speechConfig.setProperty(
    SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
    String(INITIAL_SILENCE_TIMEOUT_MS),
  );

  const audioConfig = mediaStream
    ? SpeechSDK.AudioConfig.fromStreamInput(mediaStream)
    : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

  try {
    const result = await new Promise<any>((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (sdkResult: any) => resolve(sdkResult),
        (sdkError: any) => reject(toFriendlyError(sdkError, '语音识别失败')),
      );
    });

    const text = String(result?.text || '').trim();
    if (!text) {
      if (result?.reason === SpeechSDK.ResultReason.NoMatch) {
        throw new Error('没有听到清晰的英语内容，请靠近麦克风、放慢语速再试一次。');
      }
      throw new Error('没有识别到清晰的语音内容，请再试一次。');
    }

    return text;
  } finally {
    recognizer.close();
  }
}

// ------------------------------------------------------- assessment sessions

export interface PronunciationSession {
  stop: () => Promise<PronunciationAssessmentOutcome>;
  cancel: () => void;
}

export interface PronunciationSessionOptions {
  getToken: SpeechTokenProvider;
  referenceText: string;
  language?: string;
  /** Shared microphone stream. When omitted the session opens (and owns) its own. */
  mediaStream?: MediaStream;
  /** Fired when the service session is live and audio is being evaluated. */
  onReady?: () => void;
  /** Fired with the live partial transcript while the student is reading. */
  onInterim?: (text: string) => void;
}

const CONNECT_TIMEOUT_MS = 15000;
const READY_TIMEOUT_MS = 12000;
// Official continuous pronunciation-assessment sample value: long enough to keep
// a slightly hesitant reader inside one segment, short enough to finalize fast.
const SEGMENTATION_SILENCE_TIMEOUT_MS = 1500;

export async function startPronunciationAssessmentSession(
  options: PronunciationSessionOptions,
): Promise<PronunciationSession> {
  const { getToken, referenceText, language = 'en-US', onReady, onInterim } = options;
  const SpeechSDK = await getSpeechSdk();
  const { token, region } = await ensureSpeechToken(getToken);

  const mediaStream = options.mediaStream ?? await openMicrophoneStream();
  const ownsStream = !options.mediaStream;

  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
  speechConfig.speechRecognitionLanguage = language;
  speechConfig.setProperty(
    SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
    String(SEGMENTATION_SILENCE_TIMEOUT_MS),
  );

  const recognizer = new SpeechSDK.SpeechRecognizer(
    speechConfig,
    SpeechSDK.AudioConfig.fromStreamInput(mediaStream),
  );
  const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
    referenceText,
    SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
    SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
    true,
  );
  pronunciationConfig.applyTo(recognizer);

  const segments: PronunciationSegment[] = [];
  let lastSegmentAt = 0;
  let lastInterimAt = 0;
  let cancelReason = '';
  let rejectWhenCanceled: ((error: Error) => void) | null = null;

  let sessionStarted = false;
  let resolveReady: () => void = () => undefined;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  recognizer.sessionStarted = () => {
    sessionStarted = true;
    debugLog('session started');
    resolveReady();
  };

  recognizer.recognizing = (_sender: any, event: any) => {
    lastInterimAt = Date.now();
    const text = String(event?.result?.text || '').trim();
    if (text) {
      onInterim?.(text);
    }
  };

  recognizer.recognized = (_sender: any, event: any) => {
    const segment = toSegment(event?.result, SpeechSDK, Date.now());
    if (!segment) return;
    segments.push(segment);
    lastSegmentAt = segment.receivedAt;
    debugLog('segment', segments.length, segment.recognizedText, `pron=${segment.pronunciationScore}`);
  };

  recognizer.canceled = (_sender: any, event: any) => {
    const code = event?.errorCode ? ` (code ${event.errorCode})` : '';
    cancelReason = `${event?.errorDetails || 'Azure 语音识别中断'}${code}`;
    debugLog('canceled', cancelReason);
    if (rejectWhenCanceled && !sessionStarted) {
      rejectWhenCanceled(toFriendlyError(cancelReason, 'Azure 语音识别中断'));
      rejectWhenCanceled = null;
    }
  };

  const release = () => {
    try {
      recognizer.close();
    } catch (error) {
      debugLog('close failed', error);
    }
    if (ownsStream) {
      stopMediaStream(mediaStream);
    }
  };

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        recognizer.startContinuousRecognitionAsync(
          () => resolve(),
          (error: any) => reject(toFriendlyError(error, '启动 Azure 发音评测失败')),
        );
      }),
      CONNECT_TIMEOUT_MS,
      '连接 Azure 语音服务超时，请检查网络后重试。',
    );

    await withTimeout(
      new Promise<void>((resolve, reject) => {
        rejectWhenCanceled = (error) => reject(error);
        readyPromise.then(() => {
          rejectWhenCanceled = null;
          resolve();
        });
      }),
      READY_TIMEOUT_MS,
      'Azure 语音服务没有响应，请稍后重试。',
    );

    onReady?.();
  } catch (error) {
    rejectWhenCanceled = null;
    release();
    throw error;
  }

  let closed = false;

  return {
    async stop() {
      if (closed) throw new Error('本次评测已经结束。');
      closed = true;
      const stopRequestedAt = Date.now();
      // If an interim result is newer than the last final one, the student was
      // still mid-sentence when they hit stop - give the service a moment to
      // flush that trailing phrase before scoring.
      const speechInFlight = lastInterimAt > lastSegmentAt;

      try {
        await withTimeout(
          new Promise<void>((resolve, reject) => {
            recognizer.stopContinuousRecognitionAsync(() => resolve(), (error: any) => reject(error));
          }),
          5000,
          'stop timeout',
        );
      } catch (error) {
        debugLog('stop failed, scoring partial result', error);
      }

      // Wait for the service to flush the phrase that was in flight when the
      // student pressed stop - but only as long as it can plausibly take.
      const graceMs = speechInFlight
        ? 2500
        : segments.length === 0
          ? 3000
          : Date.now() - lastSegmentAt < 1500
            ? 1200
            : 0;
      const waitUntil = Date.now() + graceMs;
      while (Date.now() < waitUntil) {
        if (segments.some((segment) => segment.receivedAt >= stopRequestedAt)) break;
        await sleep(80);
      }

      release();
      debugLog('stop', { segments: segments.length, speechInFlight, elapsedMs: Date.now() - stopRequestedAt });

      if (segments.length === 0) {
        if (cancelReason) {
          throw toFriendlyError(cancelReason, 'Azure 发音评测中断');
        }
        throw new Error('没有识别到清晰的语音内容，请靠近麦克风、用正常音量再试一次。');
      }

      return aggregatePronunciationSegments(segments, referenceText);
    },

    cancel() {
      if (closed) return;
      closed = true;
      rejectWhenCanceled = null;
      try {
        recognizer.stopContinuousRecognitionAsync(
          () => undefined,
          () => undefined,
        );
      } catch {
        // recognizer was not fully started - closing below is enough
      }
      release();
    },
  };
}

// ------------------------------------------------------------------------ TTS

export async function speakTextWithAzure({
  getToken,
  text,
  voiceName,
}: {
  getToken: SpeechTokenProvider;
  text: string;
  voiceName: string;
}): Promise<void> {
  const SpeechSDK = await getSpeechSdk();
  const { token, region } = await ensureSpeechToken(getToken);
  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
  speechConfig.speechSynthesisVoiceName = voiceName;
  const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);

  try {
    await new Promise<void>((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        () => resolve(),
        (error: any) => reject(error),
      );
    });
  } finally {
    synthesizer.close();
  }
}
