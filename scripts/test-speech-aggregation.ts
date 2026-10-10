// Unit checks for the pronunciation-assessment merger.
//
// The old flow scored only the LAST `recognized` segment of a continuous
// recognition session. As soon as a student paused mid-sentence the service
// split the audio and that last fragment was scored against the whole
// reference sentence, which produced the "random" completeness/accuracy
// numbers reported by students.
//
// Run with: npm run test:speech
import assert from 'node:assert/strict';
import {
  aggregatePronunciationSegments,
  type PronunciationSegment,
} from '../src/lib/azureSpeech';

const REFERENCE = 'I usually get up at six thirty and then have breakfast with my family.';

const TICK = 1000000; // one word ≈ 0.3s of audio in 100ns ticks
const WORD_DURATION = 3 * TICK;
const GAP = TICK;

interface SegmentInput {
  words: string[];
  scores: number[];
  azure: { pron: number; accuracy: number; fluency: number; completeness: number };
  startOffset: number;
  recognizedText: string;
}

const makeSegment = (input: SegmentInput, index: number): PronunciationSegment => ({
  recognizedText: input.recognizedText,
  pronunciationScore: input.azure.pron,
  accuracyScore: input.azure.accuracy,
  fluencyScore: input.azure.fluency,
  completenessScore: input.azure.completeness,
  receivedAt: 1000 + index,
  words: input.words.map((word, wordIndex) => ({
    word,
    accuracyScore: input.scores[wordIndex],
    errorType: 'None',
    offset: input.startOffset + wordIndex * (WORD_DURATION + GAP),
    duration: WORD_DURATION,
  })),
});

const check = (name: string, fn: () => void) => {
  fn();
  console.log(`  ok - ${name}`);
};

// ---------------------------------------------------------------- case 1
check('single complete segment keeps the service scores as-is', () => {
  const words = REFERENCE.replace('.', '').split(' ');
  const segment = makeSegment({
    words,
    scores: words.map(() => 88),
    azure: { pron: 88, accuracy: 88, fluency: 90, completeness: 100 },
    startOffset: 0,
    recognizedText: REFERENCE,
  }, 0);

  const outcome = aggregatePronunciationSegments([segment], REFERENCE);
  assert.equal(outcome.assessment.pronunciationScore, 88);
  assert.equal(outcome.assessment.accuracyScore, 88);
  assert.equal(outcome.assessment.completenessScore, 100);
  assert.equal(outcome.assessment.words.filter((word) => word.errorType === 'Omission').length, 0);
  assert.deepEqual(outcome.weakWords, []);
});

// ---------------------------------------------------------------- case 2
check('two segments caused by a mid-sentence pause are merged correctly', () => {
  const firstHalf = 'I usually get up at six thirty'.split(' ');
  const secondHalf = 'and then have breakfast with my family'.split(' ');

  const generated = [
    makeSegment({
      words: firstHalf,
      scores: firstHalf.map(() => 92),
      // This is exactly what the service returns for a fragment: scored against
      // the full reference it looks half complete and only half accurate.
      azure: { pron: 46, accuracy: 90, fluency: 88, completeness: 50 },
      startOffset: 0,
      recognizedText: firstHalf.join(' '),
    }, 0),
    makeSegment({
      words: secondHalf,
      scores: secondHalf.map(() => 86),
      azure: { pron: 43, accuracy: 84, fluency: 80, completeness: 50 },
      startOffset: 8 * (WORD_DURATION + GAP), // includes the 1.8s pause
      recognizedText: secondHalf.join(' '),
    }, 1),
  ];

  const outcome = aggregatePronunciationSegments(generated, REFERENCE);

  // The old code surfaced the last fragment: pron 43 / completeness 50.
  assert.equal(outcome.assessment.completenessScore, 100);
  assert.equal(outcome.assessment.accuracyScore, 89); // (92*7 + 86*7) / 14
  // Fluency legitimately drops because of the 1.8s pause, but the score is now
  // in the same range as the reading instead of the fragment's 43.
  assert.ok(outcome.assessment.pronunciationScore >= 75, `pron=${outcome.assessment.pronunciationScore}`);
  assert.ok(outcome.assessment.fluencyScore < 90, `fluency=${outcome.assessment.fluencyScore}`);
  assert.equal(outcome.assessment.words.length, 14);
  assert.deepEqual(outcome.weakWords, []);
  assert.equal(outcome.recognizedText, `${firstHalf.join(' ')} ${secondHalf.join(' ')}`);
});

// ---------------------------------------------------------------- case 3
check('skipped words are reported as omissions and lower completeness', () => {
  const words = 'I usually get up at six thirty and then have my family'.split(' ');
  const half = Math.ceil(words.length / 2);
  const segments = [
    makeSegment({
      words: words.slice(0, half),
      scores: words.slice(0, half).map(() => 90),
      azure: { pron: 44, accuracy: 88, fluency: 80, completeness: 45 },
      startOffset: 0,
      recognizedText: words.slice(0, half).join(' '),
    }, 0),
    makeSegment({
      words: words.slice(half),
      scores: words.slice(half).map(() => 90),
      azure: { pron: 43, accuracy: 88, fluency: 80, completeness: 45 },
      startOffset: half * (WORD_DURATION + GAP),
      recognizedText: words.slice(half).join(' '),
    }, 1),
  ];

  const outcome = aggregatePronunciationSegments(segments, REFERENCE);
  const omissions = outcome.assessment.words
    .filter((word) => word.errorType === 'Omission')
    .map((word) => word.word);
  assert.deepEqual(omissions, ['breakfast', 'with']);
  assert.equal(outcome.assessment.words.filter((word) => word.errorType === 'Insertion').length, 0);
  assert.equal(outcome.assessment.completenessScore, 86);
  assert.ok(outcome.weakWords.includes('breakfast'));
  assert.ok(outcome.assessment.feedback.some((line) => line.includes('没有读到')));
});

// ---------------------------------------------------------------- case 4
check('extra words are reported as insertions without lowering accuracy', () => {
  const referenceWords = REFERENCE.replace('.', '').split(' ');
  const firstHalf = referenceWords.slice(0, 7);
  const secondHalf = ['uh', ...referenceWords.slice(7)];
  const segments = [
    makeSegment({
      words: firstHalf,
      scores: firstHalf.map(() => 90),
      azure: { pron: 45, accuracy: 90, fluency: 85, completeness: 50 },
      startOffset: 0,
      recognizedText: firstHalf.join(' '),
    }, 0),
    makeSegment({
      words: secondHalf,
      scores: secondHalf.map((word) => (word === 'uh' ? 40 : 90)),
      azure: { pron: 40, accuracy: 87, fluency: 70, completeness: 50 },
      startOffset: 8 * (WORD_DURATION + GAP),
      recognizedText: secondHalf.join(' '),
    }, 1),
  ];

  const outcome = aggregatePronunciationSegments(segments, REFERENCE);
  const insertions = outcome.assessment.words.filter((word) => word.errorType === 'Insertion');
  assert.equal(insertions.length, 1);
  assert.equal(insertions[0].word, 'uh');
  assert.equal(outcome.assessment.accuracyScore, 90);
  assert.equal(outcome.assessment.completenessScore, 100);
  assert.ok(outcome.assessment.feedback.some((line) => line.includes('多读')));
});

// ---------------------------------------------------------------- case 5
check('single partial segment keeps the service completeness and lists omissions', () => {
  const half = 'I usually get up at six thirty'.split(' ');
  const segment = makeSegment({
    words: half,
    scores: half.map(() => 75),
    azure: { pron: 51, accuracy: 75, fluency: 70, completeness: 50 },
    startOffset: 0,
    recognizedText: half.join(' '),
  }, 0);

  const outcome = aggregatePronunciationSegments([segment], REFERENCE);
  assert.equal(outcome.assessment.completenessScore, 50);
  assert.equal(outcome.assessment.pronunciationScore, 51);
  assert.equal(outcome.assessment.words.filter((word) => word.errorType === 'Omission').length, 7);
  assert.ok(outcome.assessment.feedback.some((line) => line.includes('完整度不足')));
});

// ---------------------------------------------------------------- case 6
check('mispronounced low scores are flagged and collected as weak words', () => {
  const words = REFERENCE.replace('.', '').split(' ');
  const segment = makeSegment({
    words,
    scores: words.map((word) => (word === 'breakfast' ? 42 : 88)),
    azure: { pron: 82, accuracy: 84, fluency: 85, completeness: 100 },
    startOffset: 0,
    recognizedText: REFERENCE,
  }, 0);

  const outcome = aggregatePronunciationSegments([segment], REFERENCE);
  const weak = outcome.assessment.words.find((word) => word.word === 'breakfast');
  assert.equal(weak?.errorType, 'Mispronunciation');
  assert.deepEqual(outcome.weakWords, ['breakfast']);
  assert.ok(outcome.assessment.feedback.some((line) => line.includes('优先回练')));
});

console.log('speech aggregation checks passed');
