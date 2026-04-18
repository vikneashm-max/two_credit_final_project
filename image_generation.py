import boto3
import json
import base64
import time
import os

from typing import Optional

import requests


# ---------------------------------------
# BEDROCK CLIENT
# ---------------------------------------
BEDROCK_REGION = os.getenv("BEDROCK_REGION", "us-east-1")
BEDROCK_IMAGE_MODEL_ID = os.getenv("BEDROCK_IMAGE_MODEL_ID", "amazon.nova-canvas-v1:0")

# Non-Bedrock fallback (Hugging Face Inference API)
# Requires env var HUGGINGFACEHUB_API_TOKEN (or HF_TOKEN).
HF_IMAGE_MODEL = os.getenv("HF_IMAGE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")


def _generate_image_bedrock(prompt: str) -> bytes:
    bedrock_client = boto3.client(
        service_name="bedrock-runtime",
        region_name=BEDROCK_REGION,
    )


# ---------------------------------------
# GENERATE IMAGE USING TITAN
# ---------------------------------------
    # NOTE: request format is model-specific. The original code used Titan's schema.
    # We keep Titan schema for backwards compatibility when users still have access.
    request_body = {
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {"text": prompt},
        "imageGenerationConfig": {
            "numberOfImages": 1,
            "height": 512,
            "width": 512,
            "cfgScale": 8.0,
            "seed": 42,
        },
    }

    start_time = time.time()
    response = bedrock_client.invoke_model(
        modelId=BEDROCK_IMAGE_MODEL_ID,
        body=json.dumps(request_body),
        accept="application/json",
        contentType="application/json",
    )
    print(f"[INFO] Bedrock image call took {time.time() - start_time:.2f}s")

    response_body = json.loads(response["body"].read())
    image_base64 = response_body["images"][0]
    return base64.b64decode(image_base64)


def _generate_image_huggingface(prompt: str) -> bytes:
    token = os.getenv("HUGGINGFACEHUB_API_TOKEN") or os.getenv("HF_TOKEN")
    if not token:
        raise RuntimeError(
            "Hugging Face token missing. Set HUGGINGFACEHUB_API_TOKEN (or HF_TOKEN) to use non-Bedrock image generation."
        )

    url = f"https://api-inference.huggingface.co/models/{HF_IMAGE_MODEL}"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"inputs": prompt}

    # Some HF models may return a 503 JSON while the model is loading.
    for attempt in range(2):
        r = requests.post(url, headers=headers, json=payload, timeout=120)

        content_type = r.headers.get("content-type", "")
        if "application/json" in content_type:
            data = r.json()
            if r.status_code == 503 and attempt == 0 and "estimated_time" in data:
                time.sleep(2)
                continue
            raise RuntimeError(f"Hugging Face error: {data}")

        r.raise_for_status()
        return r.content

    raise RuntimeError("Hugging Face error: model still loading, please try again.")


def generate_image(prompt: str, output_file: Optional[str] = None) -> bytes:
    provider = os.getenv("IMAGE_PROVIDER", "auto").lower().strip()

    try:
        if provider in ("bedrock", "aws", "auto"):
            image_bytes = _generate_image_bedrock(prompt)
        elif provider in ("huggingface", "hf"):
            image_bytes = _generate_image_huggingface(prompt)
        else:
            raise RuntimeError(
                "Unknown IMAGE_PROVIDER. Use 'auto', 'bedrock', or 'huggingface'."
            )
    except Exception as e:
        # In auto mode, fall back to Hugging Face when Bedrock is blocked/legacy.
        msg = str(e)
        if provider == "auto" and (
            "Legacy" in msg
            or "marked by provider as Legacy" in msg
            or "Access denied" in msg
            or "ResourceNotFoundException" in msg
        ):
            image_bytes = _generate_image_huggingface(prompt)
        else:
            raise

    if output_file:
        with open(output_file, "wb") as f:
            f.write(image_bytes)
        print(f"[SUCCESS] Image saved as {output_file}")

    return image_bytes


# ---------------------------------------
# SIMPLE DEMO RUN
# ---------------------------------------
if __name__ == "__main__":
    print("AWS Titan Image Generator Demo")
    print("-" * 35)

    prompt = input("Enter image prompt: ")

    generate_image(prompt, output_file="output.png")
