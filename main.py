from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Tuple
from collections import defaultdict
import base64
from io import BytesIO
from PIL import Image
import ast
from fastapi import FastAPI
from pydantic import BaseModel
from gradio_client import Client
import os
import math

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


class ChartRequest(BaseModel):
    image_dir: str  # This will be a base64 encoded image
    prompt: str
    threthold: float


def calculate_precision(value, is_percent):
    if is_percent:
        return 2  # 如果是百分比，固定保留三位小数
    magnitude = int(math.log10(abs(value))) + 1
    return max(0, 4 - magnitude)  # 对于非百分比值，依然按照原来的逻辑

@app.post("/process-data/")
async def process_data(image: ImageData):
    X_axis = defaultdict(list)
    lines = defaultdict(lambda: defaultdict(list))
    Ymin = {}
    Ymin_point = {}
    Ymax = {}
    Ymax_point = {}
    is_percent = {}  # 储存每个轴是否为百分比

    for op in image.operations:
        axis = op.axis
        if op.label.startswith("Ymin"):
            is_percent[axis] = '%' in op.label
            Ymin[axis] = float(op.label.split("Ymin=")[-1].replace('%', ''))/100 if is_percent[axis] else float(op.label.split("Ymin=")[-1])
            Ymin_point[axis] = (op.x, op.y)
        elif op.label.startswith("X="):
            X_axis[op.label.split("X=")[-1]].append((op.x, op.y))
        elif op.label.startswith("Ymax"):
            is_percent[axis] = '%' in op.label
            Ymax[axis] = float(op.label.split("Ymax=")[-1].replace('%', ''))/100 if is_percent[axis] else float(op.label.split("Ymax=")[-1])
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

                interpolated_value = Ymin[axis] + (Ymin_point[axis][1] - y) / (Ymin_point[axis][1] - Ymax_point[axis][1]) * (Ymax[axis] - Ymin[axis])
                precision = calculate_precision(interpolated_value, is_percent[axis])
                value = round(interpolated_value, precision)
                value = f"{value * 100:.{precision}f}%" if is_percent[axis] else f"{value:.{precision}f}"
                temp_dict[minimum[0]] = value
            data[f"{legend}"] = temp_dict

    return data

@app.post("/process-chart/")
async def process_chart(request: ChartRequest):
    # Decode the base64 image
    image_data = base64.b64decode(request.image_dir.split(",")[1])
    image = Image.open(BytesIO(image_data))
    
    # Save the image to a temporary file
    temp_image_path = "temp_image.png"
    image.save(temp_image_path)
    
    url = "http://10.100.92.10/4-onechart/"
    client = Client(url)
    result, text = client.predict(temp_image_path, request.prompt, request.threthold, api_name="/start_inference")
    
    try:
        result_dict = ast.literal_eval(result)
        legends = result_dict["values"].keys()
        x_axis = []
        for i in legends:
            subdict = result_dict["values"][i].keys()
            x_axis = subdict if len(subdict) > len(x_axis) else x_axis
        if "图表解析结果不可靠" in text:
            return {"ret": False, 
                    "axis": list(x_axis),
                    "data": result_dict}
        else:
            return {"ret": True, 
                    "axis": list(x_axis),
                    "data": result_dict}

    except Exception as e:
        return {"ret": False, 
                "axis": [],
                "data": None}
    finally:
        os.remove(temp_image_path)
