import json
import time
import uuid
from typing import Optional

import boto3
import requests

DEFAULT_REGION = "us-east-1"


def text_to_speech(text: str, *, voice_id: str = "Joanna", region_name: str = DEFAULT_REGION) -> bytes:
    polly = boto3.client("polly", region_name=region_name)

    response = polly.synthesize_speech(
        Text=text,
        OutputFormat="mp3",
        VoiceId=voice_id,
    )

    audio_stream = response.get("AudioStream")
    if audio_stream is None:
        raise RuntimeError("Polly returned no AudioStream")

    return audio_stream.read()


def transcribe_audio(
    audio_bytes: bytes,
    *,
    bucket_name: str,
    object_key: str,
    media_format: str,
    language_code: str = "en-US",
    region_name: str = DEFAULT_REGION,
    timeout_seconds: int = 180,
) -> str:
    """Transcribe an audio file using Amazon Transcribe.

    Requires an S3 bucket to upload the audio bytes.

    Parameters
    - bucket_name: S3 bucket used for input upload.
    - object_key: Key (path) where audio will be uploaded.
    - media_format: One of: mp3, mp4, wav, flac, ogg, amr, webm.
    """

    s3 = boto3.client("s3", region_name=region_name)
    transcribe = boto3.client("transcribe", region_name=region_name)

    s3.put_object(Bucket=bucket_name, Key=object_key, Body=audio_bytes)

    job_name = f"stt-{uuid.uuid4()}"
    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        LanguageCode=language_code,
        MediaFormat=media_format,
        Media={"MediaFileUri": f"s3://{bucket_name}/{object_key}"},
    )

    start_time = time.time()
    while True:
        status = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        job = status["TranscriptionJob"]
        job_status = job["TranscriptionJobStatus"]

        if job_status == "COMPLETED":
            transcript_uri = job["Transcript"]["TranscriptFileUri"]
            r = requests.get(transcript_uri, timeout=30)
            r.raise_for_status()
            data = r.json()
            transcripts = data.get("results", {}).get("transcripts", [])
            if not transcripts:
                raise RuntimeError("No transcript text found in Transcribe output")
            return transcripts[0].get("transcript", "")

        if job_status == "FAILED":
            reason = job.get("FailureReason", "Unknown")
            raise RuntimeError(f"Transcribe failed: {reason}")

        if time.time() - start_time > timeout_seconds:
            raise TimeoutError("Transcribe timed out waiting for completion")

        time.sleep(2)
