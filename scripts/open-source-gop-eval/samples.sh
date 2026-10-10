#!/usr/bin/env bash
# Builds the evaluation samples with macOS `say` (no external services needed).
#   good.wav        native US voice, normal reading
#   accented.wav    Chinese voice reading English (proxy for a heavy accent)
#   wrongwords.wav  "breakfast" replaced by "lunch"
# score.py additionally derives noisy.wav / truncated.wav from good.wav by
# filename convention.
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p audio

SENTENCE="I usually get up at six thirty and then have breakfast with my family."

say -v Samantha -o audio/good.aiff "$SENT"
say -v "Flo (Chinese (China mainland))" -o audio/accented.aiff "$SENT"
say -v Samantha -o audio/wrongwords.aiff "I usually get up at six thirty and then have lunch with my family."

for name in good accented wrongwords; do
  afconvert -f WAVE -d LEI16@16000 -c 1 "audio/$name.aiff" "audio/$name.wav"
  rm -f "audio/$name.aiff"
done

cp audio/good.wav audio/noisy.wav
cp audio/good.wav audio/truncated.wav

ls -la audio/
