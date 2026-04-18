import os
import time
from typing import Literal, Optional

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from image_generation import generate_image
from speech_generation import text_to_speech

load_dotenv()


BEDROCK_REGION = os.getenv("BEDROCK_REGION", "us-east-1")
BEDROCK_TEXT_MODEL_ID = os.getenv("BEDROCK_TEXT_MODEL_ID", "us.amazon.nova-pro-v1:0")
SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are an AI assistant. Answer clearly and helpfully.",
)


bedrock_client = boto3.client(
    service_name="bedrock-runtime",
    region_name=BEDROCK_REGION,
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    text: str


class ImageRequest(BaseModel):
    prompt: str


class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "Joanna"


app = FastAPI(title="GenAI Workshop API", version="1.0")

allow_all = os.getenv("CORS_ALLOW_ALL", "true").lower() in ("1", "true", "yes")
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else [frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


def _call_bedrock_chat(messages: list[ChatMessage]) -> str:
    bedrock_messages = []
    for m in messages:
        bedrock_messages.append({"role": m.role, "content": [{"text": m.content}]})

    params = {
        "modelId": BEDROCK_TEXT_MODEL_ID,
        "system": [{"text": SYSTEM_PROMPT}],
        "messages": bedrock_messages,
        "inferenceConfig": {"temperature": 0.4, "maxTokens": 1024},
    }

    start_time = time.time()
    try:
        response = bedrock_client.converse(**params)
    except Exception as e:
        raise RuntimeError(str(e))

    _ = time.time() - start_time
    return response["output"]["message"]["content"][0]["text"]


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    try:
        text = _call_bedrock_chat(req.messages)
        return ChatResponse(text=text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.post("/image")
def image(req: ImageRequest):
    prompt = (req.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    try:
        image_bytes = generate_image(prompt)
        return Response(content=image_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image error: {str(e)}")


@app.post("/tts")
def tts(req: TTSRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    try:
        audio_bytes = text_to_speech(text, voice_id=req.voice_id or "Joanna")
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")
