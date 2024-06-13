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
    color: str
    axis: str  # 添加 axis 字段

class Legend(BaseModel):
    label: str
    color: str
    axis: str  # 添加 axis 字段

class ImageData(BaseModel):
    operations: List[DataPoint]
    legends: List[Legend]  # 添加 legends 字段

@app.post("/process-data/")
async def process_data(image: ImageData):
    X_axis = defaultdict(list)  # X_axis[value] = [(x, y), ...]
    lines = defaultdict(lambda: defaultdict(list))  # lines[axis][label] = [(x, y), ...]
    Ymin = {}
    Ymin_point = {}
    Ymax = {}
    Ymax_point = {}

    for op in image.operations:
        axis = op.axis
        if op.label.startswith("Ymin"):
            Ymin[axis] = float(op.label.split("Ymin=")[-1])
            Ymin_point[axis] = (op.x, op.y)
        elif op.label.startswith("X="):
            X_axis[op.label.split("X=")[-1]].append((op.x, op.y))
        elif op.label.startswith("Ymax"):
            Ymax[axis] = float(op.label.split("Ymax=")[-1])
            Ymax_point[axis] = (op.x, op.y)
        else:
            lines[axis][op.label].append((op.x, op.y))

    data = {}
    for axis in lines:
        for legend in lines[axis]:
            temp_dict = {}
            for x, y in lines[axis][legend]:
                if not X_axis:
                    raise ValueError("No X-axis points found")
                minimum = min(X_axis.items(), key=lambda item: abs(x-item[1][0][0]))
                if axis not in Ymin or axis not in Ymax or axis not in Ymin_point or axis not in Ymax_point:
                    raise ValueError(f"Y-axis bounds not set for axis {axis}")
                temp_dict[minimum[0]] = Ymin[axis] + (Ymin_point[axis][1] - y) / (Ymin_point[axis][1] - Ymax_point[axis][1]) * (Ymax[axis] - Ymin[axis])
            data[f"{legend} ({axis})"] = temp_dict

    return data
