from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="PixelField API")

pixels = {}

class ClickRequest(BaseModel):
    x: int
    y: int

@app.get("/")
def root():
    return {"message": "PixelField API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/pixels/click")
def click_pixel(req:ClickRequest):
    key = (req.x, req.y)
    current = pixels.get(key, 0)
    pixels[key] = current + 1
    return {
        "x": req.x,
        "y": req.y,
        "version": pixels[key]
    }