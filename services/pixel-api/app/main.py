from fastapi import FastAPI

app = FastAPI(title="PixelField API")

@app.get("/")
def root():
    return {"message": "PixelField API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}