// Speech probe: verify Azure pronunciation-assessment behaviour against a
// sentence that contains a realistic student pause.
//
// scenario A: one-shot recognizeOnceAsync + push stream (stream closed at the end)
// scenario B: continuous recognition, default segmentation timeouts
// scenario C: continuous recognition with SegmentationSilenceTimeoutMs = 1500
//             (what the app now uses)
//
// For each scenario it prints the per-segment scores and, for continuous runs,
// both "last segment only" (the old app behaviour) and the merged score.
//
// Credentials, in order of preference:
//   1. AZURE_SPEECH_KEY + AZURE_SPEECH_REGION            (subscription key)
//   2. AZURE_SPEECH_TOKEN + AZURE_SPEECH_REGION          (short-lived token)
//   3. AZURE_SPEECH_TOKEN_ENDPOINT (+ LEARN_ENG_USERNAME / LEARN_ENG_PASSWORD)
//      -> logs in to a deployment and pulls a fresh token from /api/speech-token,
//         so no subscription key ever has to leave the server.
//
// Optional: PROBE_INPUT=<16k mono 16-bit PCM WAV> assesses a supplied file (e.g.
// a real student recording) instead of a synthesized one.
// Usage: npm run probe:speech
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

dotenv.config({ path: path.resolve('.env.local') });

const KEY = process.env.AZURE_SPEECH_KEY;
let authToken = process.env.AZURE_SPEECH_TOKEN;
let region = process.env.AZURE_SPEECH_REGION;

const resolveCredentials = async () => {
  if (KEY || authToken) {
    if (!region) {
      console.error('AZURE_SPEECH_REGION is required');
      process.exit(1);
    }
    return;
  }

  const endpoint = process.env.AZURE_SPEECH_TOKEN_ENDPOINT;
  if (!endpoint) {
    console.error(
      'Set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION, or AZURE_SPEECH_TOKEN + AZURE_SPEECH_REGION, '
      + 'or AZURE_SPEECH_TOKEN_ENDPOINT (+ LEARN_ENG_USERNAME / LEARN_ENG_PASSWORD) in .env.local',
    );
    process.exit(1);
  }

  const origin = new URL(endpoint).origin;
  const loginResponse = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.LEARN_ENG_USERNAME || 'admin',
      password: process.env.LEARN_ENG_PASSWORD || '',
    }),
  });
  const session = await loginResponse.json().catch(() => ({}));
  if (!loginResponse.ok || !session.token) {
    console.error(`login failed: ${session.error || loginResponse.statusText}`);
    process.exit(1);
  }

  const tokenResponse = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const payload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !payload.token) {
    console.error(`token fetch failed: ${payload.error || tokenResponse.statusText}`);
    process.exit(1);
  }

  authToken = payload.token;
  region = payload.region;
  console.log(`using authorization token from ${endpoint} (region ${region})`);
};

const createSpeechConfig = () =>
  KEY
    ? sdk.SpeechConfig.fromSubscription(KEY, region)
    : sdk.SpeechConfig.fromAuthorizationToken(authToken, region);

const OUT_DIR = path.resolve('tmp/speech-probe');
fs.mkdirSync(OUT_DIR, { recursive: true });

const REFERENCE_TEXT = 'I usually get up at six thirty and then have breakfast with my family.';
const PART_A = 'I usually get up at six thirty';
const PART_B = 'and then have breakfast with my family.';
const PAUSE_MS = 1800;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Number(process.hrtime.bigint() / 1000000n);

// ---------------------------------------------------------------- synthesis
// Write the returned audio buffer out ourselves: the SDK's file output can be
// read back before it is flushed, which silently produced all-zero WAV files.
const synthesize = (file, text) =>
  new Promise((resolve, reject) => {
    const config = createSpeechConfig();
    config.speechSynthesisVoiceName = 'en-US-AvaMultilingualNeural';
    config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
    const synth = new sdk.SpeechSynthesizer(config);
    synth.speakTextAsync(
      text,
      (result) => {
        synth.close();
        if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
          reject(new Error(result.errorDetails || 'synthesis failed'));
          return;
        }
        fs.writeFileSync(file, Buffer.from(result.audioData));
        resolve();
      },
      (error) => {
        synth.close();
        reject(error);
      },
    );
  });

// ---------------------------------------------------------------- wav tools
const readWav = (file) => {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`not RIFF: ${file}`);
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, offset + 8 + size);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: body.readUInt16LE(0),
        channels: body.readUInt16LE(2),
        sampleRate: body.readUInt32LE(4),
        bitsPerSample: body.readUInt16LE(14),
      };
    } else if (id === 'data') {
      data = body;
    }
    offset += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`malformed wav: ${file}`);
  return { fmt, data };
};

const wavHeader = (dataLength, { channels, sampleRate, bitsPerSample }) => {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 28);
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataLength, 40);
  return header;
};

// ---------------------------------------------------------------- probing
const parseResult = (result) => {
  const raw = result?.properties?.getProperty?.(sdk.PropertyId.SpeechServiceResponse_JsonResult);
  const json = raw ? JSON.parse(raw) : null;
  const nb = json?.NBest?.[0];
  const pa = nb?.PronunciationAssessment;
  return {
    text: result?.text || '',
    recognitionStatus: json?.RecognitionStatus,
    pron: pa ? Number(pa.PronScore ?? 0) : null,
    accuracy: pa ? Number(pa.AccuracyScore ?? 0) : null,
    fluency: pa ? Number(pa.FluencyScore ?? 0) : null,
    completeness: pa ? Number(pa.CompletenessScore ?? 0) : null,
    words: (nb?.Words || []).map((w) => ({
      word: w.Word,
      accuracy: Number(w.PronunciationAssessment?.AccuracyScore ?? 0),
      errorType: w.PronunciationAssessment?.ErrorType,
      offset: Number(w.Offset ?? 0),
      duration: Number(w.Duration ?? 0),
    })),
  };
};

const feed = async (pushStream, pcm, { realtimeMsPerChunk = 100 } = {}) => {
  const bytesPerChunk = 3200; // 100ms @16k mono 16-bit
  for (let i = 0; i < pcm.length; i += bytesPerChunk) {
    const chunk = pcm.subarray(i, i + bytesPerChunk);
    // The Node SDK requires a real ArrayBuffer, not a Buffer view.
    pushStream.write(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
    if (realtimeMsPerChunk > 0) await sleep(realtimeMsPerChunk);
  }
  pushStream.close();
};

const runScenario = async (label, pcm, { continuous, extraProps = {}, segmentationTimeoutMs }) => {
  const log = [];
  const t0 = now();
  const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(format);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream, format);
  const speechConfig = createSpeechConfig();
  speechConfig.speechRecognitionLanguage = 'en-US';
  if (segmentationTimeoutMs) {
    speechConfig.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, String(segmentationTimeoutMs));
  }
  for (const [k, v] of Object.entries(extraProps)) speechConfig.setProperty(k, String(v));

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  new sdk.PronunciationAssessmentConfig(
    REFERENCE_TEXT,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    true,
  ).applyTo(recognizer);

  const segments = [];
  let canceled = null;
  recognizer.sessionStarted = () => log.push(`[${now() - t0}ms] sessionStarted`);
  recognizer.recognizing = (_s, e) => log.push(`[${now() - t0}ms] recognizing: "${e.result.text}"`);
  recognizer.recognized = (_s, e) => {
    const parsed = parseResult(e.result);
    segments.push({ at: now() - t0, ...parsed });
    log.push(`[${now() - t0}ms] recognized: "${parsed.text}" pron=${parsed.pron} acc=${parsed.accuracy} flu=${parsed.fluency} comp=${parsed.completeness} words=${parsed.words.length}`);
  };
  recognizer.canceled = (_s, e) => {
    canceled = `${sdk.CancellationReason[e.reason]} ${e.errorDetails || ''}`.trim();
    log.push(`[${now() - t0}ms] canceled: ${canceled}`);
  };
  recognizer.sessionStopped = () => log.push(`[${now() - t0}ms] sessionStopped`);

  let result = null;
  let closedAt = null;
  if (continuous) {
    await new Promise((resolve, reject) =>
      recognizer.startContinuousRecognitionAsync(resolve, reject));
    log.push(`[${now() - t0}ms] continuous started`);
    await feed(pushStream, pcm);
    closedAt = now() - t0;
    log.push(`[${closedAt}ms] audio stream closed`);
    await new Promise((resolve, reject) =>
      recognizer.stopContinuousRecognitionAsync(resolve, reject));
    log.push(`[${now() - t0}ms] continuous stopped`);
    await sleep(2500); // give the trailing recognized event time to arrive
  } else {
    const oncePromise = new Promise((resolve) => {
      recognizer.recognizeOnceAsync(
        (r) => resolve(r),
        (err) => resolve({ error: String(err) }),
      );
    });
    await sleep(50);
    await feed(pushStream, pcm);
    closedAt = now() - t0;
    log.push(`[${closedAt}ms] audio stream closed`);
    result = await oncePromise;
    log.push(`[${now() - t0}ms] recognizeOnce resolved (${result?.text ? `text "${result.text}"` : JSON.stringify(result)})`);
    await sleep(500);
  }
  recognizer.close();

  return { label, log, segments, canceled, closedAt, result: result ? parseResult(result) : null, t0 };
};

// merge segments following the official continuous-ASSESSMENT sample
const mergeSegments = (segments) => {
  const allWords = segments.flatMap((s) => s.words);
  const accuracies = allWords.filter((w) => w.errorType !== 'Insertion').map((w) => w.accuracy);
  const accuracy = accuracies.length ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : 0;
  const referenceWords = REFERENCE_TEXT.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);
  const matched = allWords.filter((w) => w.errorType !== 'Insertion').length;
  const completeness = Math.min(100, (matched / Math.max(1, referenceWords.length)) * 100);
  const start = Math.min(...allWords.map((w) => w.offset));
  const end = Math.max(...allWords.map((w) => w.offset + w.duration));
  const spoken = allWords.reduce((a, w) => a + w.duration, 0);
  const fluency = end > start ? (spoken / (end - start)) * 100 : 0;
  return {
    accuracy: accuracy.toFixed(1),
    completeness: completeness.toFixed(1),
    fluency: fluency.toFixed(1),
    words: allWords.length,
    referenceWords: referenceWords.length,
  };
};

const main = async () => {
  await resolveCredentials();

  let pcm;
  let probeWav;
  const inputPath = process.env.PROBE_INPUT;
  if (inputPath) {
    // Assess a supplied 16k/mono/16-bit PCM WAV instead of synthesizing one -
    // point this at a real student recording to reproduce field behaviour.
    probeWav = path.resolve(inputPath);
    const wav = readWav(probeWav);
    if (wav.fmt.sampleRate !== 16000 || wav.fmt.channels !== 1 || wav.fmt.bitsPerSample !== 16) {
      throw new Error('PROBE_INPUT must be 16kHz mono 16-bit PCM WAV');
    }
    pcm = wav.data;
    console.log(`probe wav: ${probeWav} (${(pcm.length / 2 / wav.fmt.sampleRate).toFixed(1)}s supplied)`);
  } else {
    const fileA = path.join(OUT_DIR, 'part-a.wav');
    const fileB = path.join(OUT_DIR, 'part-b.wav');
    await synthesize(fileA, PART_A);
    await synthesize(fileB, PART_B);
    const a = readWav(fileA);
    const b = readWav(fileB);
    const silence = Buffer.alloc(((a.fmt.sampleRate * PAUSE_MS) / 1000) * 2);
    pcm = Buffer.concat([a.data, silence, b.data]);
    probeWav = path.join(OUT_DIR, 'probe.wav');
    fs.writeFileSync(probeWav, Buffer.concat([wavHeader(pcm.length, a.fmt), pcm]));
    console.log(`probe wav: ${probeWav} (${(pcm.length / 2 / a.fmt.sampleRate).toFixed(1)}s incl. ${PAUSE_MS}ms pause)`);
  }

  const oneShot = await runScenario('A: one-shot + push stream', pcm, { continuous: false });
  console.log('\n=== A: one-shot (recognizeOnceAsync) ===');
  oneShot.log.forEach((line) => console.log(line));
  console.log('result:', JSON.stringify(oneShot.canceled ? { canceled: oneShot.canceled } : oneShot.result, null, 2));

  const continuousDefault = await runScenario('B: continuous (current app, no segmentation tuning)', pcm, { continuous: true });
  console.log('\n=== B: continuous, default timeout ===');
  continuousDefault.log.forEach((line) => console.log(line));
  console.log('segments:', continuousDefault.segments.length);
  console.log('last-segment-only (what the app shows today):', JSON.stringify(continuousDefault.segments.at(-1) ? {
    text: continuousDefault.segments.at(-1).text,
    pron: continuousDefault.segments.at(-1).pron,
    accuracy: continuousDefault.segments.at(-1).accuracy,
    fluency: continuousDefault.segments.at(-1).fluency,
    completeness: continuousDefault.segments.at(-1).completeness,
  } : null));
  console.log('merged:', JSON.stringify(mergeSegments(continuousDefault.segments)));

  const continuousTuned = await runScenario('C: continuous, segmentation timeout 1500ms', pcm, {
    continuous: true,
    segmentationTimeoutMs: 1500,
  });
  console.log('\n=== C: continuous, SegmentationSilenceTimeoutMs=1500 ===');
  continuousTuned.log.forEach((line) => console.log(line));
  console.log('segments:', continuousTuned.segments.length);
  console.log('merged:', JSON.stringify(mergeSegments(continuousTuned.segments)));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
