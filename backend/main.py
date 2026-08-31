from fastapi import FastAPI

app = FastAPI(title="Voice AI Incident Commander")


@app.get("/")
def root():
    return {
        "message": "Voice AI Incident Commander backend is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }