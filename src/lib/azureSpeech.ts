import type { AzurePronunciationResult } from '../components/textbook/types';

interface SpeechTokenResponse {
  token: string;
  region: string;
}

let sdkPromise: Promise<any> | null = null;

const getSpeechSdk = async () => {
  if (!sdkPromise) {
    sdkPromise = import('microsoft-cognitiveservices-speech-sdk');
  }
  return sdkPromise;
};

export async function recognizeSpeechFromMicrophone({
  token,
  region,
  language = 'en-US',
}: SpeechTokenResponse & { language?: string }): Promise<string> {
  const SpeechSDK = await getSpeechSdk();
  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
  speechConfig.speechRecognitionLanguage = language;
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

  try {
    const result = await new Promise<any>((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (sdkResult: any) => resolve(sdkResult),
        (sdkError: any) => reject(sdkError),
      );
    });

    if (!result?.text?.trim()) {
      throw new Error('没有识别到清晰的语音内容，请再试一次。');
    }

    return String(result.text).trim();
  } finally {
    recognizer.close();
  }
}

export async function assessPronunciationFromMicrophone({
  token,
  region,
  referenceText,
  language = 'en-US',
}: SpeechTokenResponse & { referenceText: string; language?: string }): Promise<{
  recognizedText: string;
  assessment: AzurePronunciationResult;
  weakWords: string[];
}> {
  const SpeechSDK = await getSpeechSdk();
  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
  speechConfig.speechRecognitionLanguage = language;

  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
  const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
    referenceText,
    SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
    SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
    true,
  );
  pronunciationConfig.applyTo(recognizer);

  try {
    const result = await new Promise<any>((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (sdkResult: any) => resolve(sdkResult),
        (sdkError: any) => reject(sdkError),
      );
    });
    return parsePronunciationAssessmentResult(result, SpeechSDK);
  } finally {
    recognizer.close();
  }
}

const parsePronunciationAssessmentResult = (result: any, SpeechSDK?: any): {
  recognizedText: string;
  assessment: AzurePronunciationResult;
  weakWords: string[];
} => {
  const jsonResult = SpeechSDK
    ? result?.properties?.getProperty?.(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult)
    : result?.properties?.getProperty?.('SpeechServiceResponse_JsonResult');
  const parsed = jsonResult ? JSON.parse(jsonResult) : null;
  const bestResult = parsed?.NBest?.[0] || {};
  const assessment = bestResult?.PronunciationAssessment || {};
  const words = (bestResult?.Words || []).map((item: any) => ({
    word: String(item.Word || ''),
    accuracyScore: Number(item.PronunciationAssessment?.AccuracyScore || 0),
    errorType: String(item.PronunciationAssessment?.ErrorType || 'None'),
  }));

  const weakWords = words.filter((item: any) => item.accuracyScore < 70).map((item: any) => item.word);
  const weakWordLabels = words
    .filter((item: any) => item.accuracyScore < 70)
    .map((item: any) => `${item.word}(${Math.round(item.accuracyScore)})`);
  const pronunciationValue = Math.round(Number(assessment?.PronScore || 0));
  const accuracyValue = Math.round(Number(assessment?.AccuracyScore || 0));
  const fluencyValue = Math.round(Number(assessment?.FluencyScore || 0));
  const completenessValue = Math.round(Number(assessment?.CompletenessScore || 0));

  const feedback: string[] = [];
  feedback.push(
    pronunciationValue >= 85
      ? '整体发音比较稳定，可以继续提高语流自然度。'
      : pronunciationValue >= 70
        ? '整体读音基本到位，建议重点回练低分单词。'
        : '整体发音还有提升空间，建议先慢速跟读再重新测。',
  );

  if (weakWordLabels.length > 0) feedback.push(`建议优先回练：${weakWordLabels.slice(0, 3).join('、')}`);
  if (fluencyValue < 70) feedback.push('流利度偏弱，建议按意群停顿后再完整朗读一遍。');
  if (completenessValue < 85) feedback.push('句子完整度不足，建议确保整句都读完。');

  return {
    recognizedText: String(bestResult?.Display || result?.text || '').trim(),
    assessment: {
      pronunciationScore: pronunciationValue,
      accuracyScore: accuracyValue,
      fluencyScore: fluencyValue,
      completenessScore: completenessValue,
      words,
      feedback,
    },
    weakWords,
  };
};

export async function speakTextWithAzure({
  token,
  region,
  text,
  voiceName,
}: SpeechTokenResponse & { text: string; voiceName: string }): Promise<void> {
  const SpeechSDK = await getSpeechSdk();
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

export async function createPronunciationAssessmentSession({
  token,
  region,
  referenceText,
  language = 'en-US',
}: SpeechTokenResponse & { referenceText: string; language?: string }) {
  const SpeechSDK = await getSpeechSdk();
  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
  speechConfig.speechRecognitionLanguage = language;
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
  const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
    referenceText,
    SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
    SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
    true,
  );
  pronunciationConfig.applyTo(recognizer);

  let latestResult: any = null;

  recognizer.recognized = (_sender: any, event: any) => {
    if (event?.result?.text?.trim()) {
      latestResult = event.result;
    }
  };

  await new Promise<void>((resolve, reject) => {
    recognizer.startContinuousRecognitionAsync(
      () => resolve(),
      (error: any) => reject(error),
    );
  });

  return {
    async stop() {
      await new Promise<void>((resolve, reject) => {
        recognizer.stopContinuousRecognitionAsync(
          () => resolve(),
          (error: any) => reject(error),
        );
      });
      try {
        if (!latestResult) {
          throw new Error('没有识别到清晰的语音内容，请再试一次。');
        }
        return parsePronunciationAssessmentResult(latestResult, SpeechSDK);
      } finally {
        recognizer.close();
      }
    },
    cancel() {
      recognizer.close();
    },
  };
}
