#!/usr/bin/env python3.11
"""Offline pronunciation-scoring experiment (open-source route).

Pipeline: wav2vec2 CTC acoustic model + forced alignment against the reference
sentence -> per-token acoustic confidence (a GOP-lite score), aggregated to
word level. This is the cheapest credible open-source substitute for a
commercial pronunciation-assessment API, so the numbers here bound what a
self-hosted engine can do.

Usage:
  python score.py audio/good.wav audio/accented.wav ...
"""
from __future__ import annotations

import json
import re
import sys
import time

import numpy as np
import soundfile as sf
import torch
import torchaudio
import torchaudio.functional as F

from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

MODEL_ID = "facebook/wav2vec2-base-960h"
REFERENCE = "I usually get up at six thirty and then have breakfast with my family."
SAMPLE_RATE = 16000


def load_audio(path: str) -> np.ndarray:
    wav, sr = sf.read(path, dtype="float32")
    if wav.ndim > 1:
        wav = wav.mean(axis=1)
    if sr != SAMPLE_RATE:
        wav = F.resample(torch.from_numpy(wav), sr, SAMPLE_RATE).numpy()
    return wav


def add_noise(wav: np.ndarray, snr_db: float = 5.0, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    noise = rng.normal(0.0, 1.0, size=wav.shape).astype(np.float32)
    speech_power = float(np.mean(wav**2)) or 1e-6
    noise_power = float(np.mean(noise**2))
    target_noise_power = speech_power / (10 ** (snr_db / 10))
    noise *= np.sqrt(target_noise_power / noise_power)
    return np.clip(wav + noise, -1.0, 1.0).astype(np.float32)


def token_spans(alignment: list[int], scores: list[float], blank: int = 0):
    spans = []
    current = None
    for frame, token in enumerate(alignment):
        if token == blank:
            if current is not None:
                spans.append(current)
                current = None
            continue
        if current is not None and current["token"] == token:
            current["end"] = frame
            current["sum"] += scores[frame]
            current["count"] += 1
        else:
            if current is not None:
                spans.append(current)
            current = {"token": token, "start": frame, "end": frame, "sum": scores[frame], "count": 1}
    if current is not None:
        spans.append(current)
    return spans


def main() -> None:
    files = sys.argv[1:]
    if not files:
        print(__doc__)
        raise SystemExit(1)

    processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
    model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID).eval()
    id_to_token = {value: key for key, value in processor.tokenizer.get_vocab().items()}

    reference_letters = re.sub(r"[^A-Z ]", "", REFERENCE.upper())
    reference_words = [word for word in reference_letters.split(" ") if word]
    # wav2vec2-960h maps a space to the literal "|" token; build the target
    # sequence (plus a letter -> word owner map) by hand.
    reference_tokens: list[str] = []
    letter_owner: list[int | None] = []
    for index, word in enumerate(reference_words):
        if index > 0:
            reference_tokens.append("|")
            letter_owner.append(None)
        for letter in word:
            reference_tokens.append(letter)
            letter_owner.append(index)
    target_ids = processor.tokenizer.convert_tokens_to_ids(reference_tokens)

    results = []
    for path in files:
        wav = load_audio(path)
        if "noisy" in path:
            wav = add_noise(wav, snr_db=5.0)
        if "truncated" in path:
            wav = wav[: len(wav) // 2]

        started = time.perf_counter()
        inputs = processor(wav, sampling_rate=SAMPLE_RATE, return_tensors="pt").input_values
        with torch.no_grad():
            logits = model(inputs).logits
        log_probs = torch.log_softmax(logits, dim=-1)
        targets = torch.tensor([target_ids], dtype=torch.int32)
        alignment, frame_scores = torchaudio.functional.forced_align(log_probs, targets, blank=0)
        elapsed = time.perf_counter() - started

        spans = token_spans(alignment[0].tolist(), frame_scores[0].tolist())
        total_frames = log_probs.shape[1]
        speech_frames = sum(span["count"] for span in spans)

        letter_probs: dict[int, list[float]] = {}
        per_letter = []
        for order, span in enumerate(spans):
            if order >= len(letter_owner):
                break  # extra tokens the model inserted beyond the reference
            letter = id_to_token.get(span["token"], "?")
            if letter == "|":
                continue
            prob = float(np.exp(span["sum"] / max(1, span["count"])))
            per_letter.append({"letter": letter, "prob": round(prob, 3)})
            owner = letter_owner[order]
            if owner is not None:
                letter_probs.setdefault(owner, []).append(prob)

        word_scores = {
            reference_words[index]: round(float(np.mean(values)) * 100, 1)
            for index, values in letter_probs.items()
        }
        mean_prob = float(np.mean([p["prob"] for p in per_letter])) if per_letter else 0.0
        weakest = sorted(per_letter, key=lambda item: item["prob"])[:5]

        results.append(
            {
                "file": path,
                "audio_seconds": round(len(wav) / SAMPLE_RATE, 2),
                "gop_lite_score": round(mean_prob * 100, 1),
                "coverage_percent": round(100 * speech_frames / total_frames, 1),
                "aligned_letters": len(per_letter),
                "reference_letters": len(letter_owner),
                "weakest_letters": weakest,
                "word_scores": word_scores,
                "worst_words": sorted(word_scores.items(), key=lambda item: item[1])[:4],
                "compute_seconds": round(elapsed, 2),
            }
        )

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
