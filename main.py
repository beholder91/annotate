from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Tuple
from collections import defaultdict

app = FastAPI()

# Set up CORS to allow requests from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

class DataPoint(BaseModel):
    x: float
    y: float
    label: str

class ImageData(BaseModel):
    operations: List[DataPoint]

@app.post("/process-data/")
async def process_data(image: ImageData):
    X_axis = defaultdict(list)
    lines = defaultdict(list)
    Origin_point = None
    Ymax = None
    Ymax_point = None

    for op in image.operations:
        if op.label == "Origin":
            Origin_point = op.x, op.y
        elif op.label.startswith("X="):
            X_axis[op.label.split("X=")[-1]].append((op.x, op.y))
        elif op.label.startswith("Ymax"):
            Ymax = float(op.label.split("Ymax=")[-1])
            Ymax_point = op.x, op.y
        else:
            lines[op.label].append((op.x, op.y))

    data = {}
    for legend in lines:
        temp_dict = {}
        for x, y in lines[legend]:
            minimum = min(X_axis.items(), key=lambda item: abs(x-item[1][0][0]))
            temp_dict[minimum[0]] = (Origin_point[1] - y) / (Origin_point[1] - Ymax_point[1]) * Ymax
        data[legend] = temp_dict
    return data