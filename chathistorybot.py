import boto3
import time
import streamlit as st

from image_generation import generate_image
from speech_generation import text_to_speech, transcribe_audio

# ---------------------------------------
# BEDROCK CLIENT
# ---------------------------------------
bedrock_client = boto3.client(
    service_name="bedrock-runtime",
    region_name="us-east-1"
)

MODEL_ID = "us.amazon.nova-pro-v1:0"

SYSTEM_PROMPT = "You are an AI assistant, and you need to answer the user's question."

# ---------------------------------------
# CALL MODEL WITH CHAT HISTORY
# ---------------------------------------
def call_model(messages):
    params = {
        "modelId": MODEL_ID,
        "system": [
            {
                "text": SYSTEM_PROMPT
            }
        ],

        "messages": messages,

        "inferenceConfig": {
            "temperature": 0.4,
            "maxTokens": 1024
        }
    }

    try:
        start_time = time.time()
        response = bedrock_client.converse(**params)
        print(f"[INFO] Call took {time.time() - start_time:.2f}s")

        return response["output"]["message"]["content"][0]["text"]

    except Exception as e:
        raise RuntimeError(f"Bedrock error: {str(e)}")


# ---------------------------------------
# STREAMLIT UI
# ---------------------------------------
st.set_page_config(page_title="Nova Chatbot", layout="centered")

st.title("🤖 Nova Chatbot (with memory)")

chat_tab, image_tab, speech_tab = st.tabs(["Chat", "Image generation", "Speech"])

with chat_tab:
    # ---------------------------------------
    # SESSION STATE INIT (NO SYSTEM HERE)
    # ---------------------------------------
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # ---------------------------------------
    # DISPLAY CHAT HISTORY
    # ---------------------------------------
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            with st.chat_message("user"):
                st.write(msg["content"][0]["text"])
        elif msg["role"] == "assistant":
            with st.chat_message("assistant"):
                st.write(msg["content"][0]["text"])

    # ---------------------------------------
    # USER INPUT
    # ---------------------------------------
    user_input = st.chat_input("Ask something...")

    if user_input:
        # Add user message
        user_message = {
            "role": "user",
            "content": [{"text": user_input}]
        }
        st.session_state.messages.append(user_message)

        # Display user message
        with st.chat_message("user"):
            st.write(user_input)

        # Call model
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                answer = call_model(st.session_state.messages)
                st.write(answer)

        st.session_state.last_answer = answer

        # Add assistant response
        assistant_message = {
            "role": "assistant",
            "content": [{"text": answer}]
        }
        st.session_state.messages.append(assistant_message)

    # ---------------------------------------
    # CLEAR CHAT BUTTON
    # ---------------------------------------
    if st.button("Clear Chat"):
        st.session_state.messages = []

    if "last_answer" in st.session_state and st.session_state.last_answer:
        if st.button("Speak last answer"):
            try:
                with st.spinner("Generating speech..."):
                    audio_bytes = text_to_speech(st.session_state.last_answer)
                st.audio(audio_bytes, format="audio/mp3")
            except Exception as e:
                st.error(str(e))


with image_tab:
    st.subheader("Generate an image")

    prompt = st.text_area(
        "Prompt",
        placeholder="Example: a watercolor painting of a cat astronaut",
        height=100,
    )

    if st.button("Generate image", type="primary"):
        if not prompt.strip():
            st.warning("Enter a prompt first.")
        else:
            try:
                with st.spinner("Generating..."):
                    image_bytes = generate_image(prompt.strip())
                st.image(image_bytes)
            except Exception as e:
                st.error(str(e))


with speech_tab:
    st.subheader("Text to speech")

    tts_text = st.text_area(
        "Text",
        value=st.session_state.get("last_answer", ""),
        placeholder="Type something to speak...",
        height=120,
    )

    if st.button("Generate speech", type="primary"):
        if not tts_text.strip():
            st.warning("Enter some text first.")
        else:
            try:
                with st.spinner("Generating..."):
                    audio_bytes = text_to_speech(tts_text.strip())
                st.audio(audio_bytes, format="audio/mp3")
            except Exception as e:
                st.error(str(e))

    st.divider()
    st.subheader("Speech to text")
    st.caption("Upload a short audio file (wav/mp3/flac/ogg/webm). Requires an S3 bucket for Transcribe input.")

    bucket = st.text_input("S3 bucket for transcription", value="", placeholder="e.g. my-transcribe-bucket")
    audio_file = st.file_uploader("Audio file", type=["wav", "mp3", "flac", "ogg", "webm", "mp4", "amr"])

    if st.button("Transcribe audio"):
        if not bucket.strip():
            st.warning("Enter an S3 bucket name first.")
        elif audio_file is None:
            st.warning("Upload an audio file first.")
        else:
            try:
                filename = audio_file.name
                ext = filename.split(".")[-1].lower() if "." in filename else ""
                media_format = ext if ext else "wav"
                object_key = f"streamlit-transcribe/{int(time.time())}-{filename}"

                with st.spinner("Transcribing..."):
                    transcript = transcribe_audio(
                        audio_file.getvalue(),
                        bucket_name=bucket.strip(),
                        object_key=object_key,
                        media_format=media_format,
                    )

                st.text_area("Transcript", value=transcript, height=140)
            except Exception as e:
                st.error(str(e))
