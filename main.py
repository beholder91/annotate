from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Tuple
from collections import defaultdict
import base64
from io import BytesIO
from PIL import Image
import ast
import os
import math
from gradio_client import Client
import uuid  # 导入 uuid 库
from natsort import natsorted

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
        return 2  # 如果是百分比，固定保留两位小数
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
            Ymin[axis] = float(op.label.split("Ymin=")[-1].replace('%', ''))
            Ymin_point[axis] = (op.x, op.y)
        elif op.label.startswith("X="):
            X_axis[op.label.split("X=")[-1]].append((op.x, op.y))
        elif op.label.startswith("Ymax"):
            is_percent[axis] = '%' in op.label
            Ymax[axis] = float(op.label.split("Ymax=")[-1].replace('%', ''))
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
                if is_percent[axis]:
                    value = f"{interpolated_value:.2f}%"  # 直接格式化为百分比形式，保留两位小数
                else:
                    precision = calculate_precision(interpolated_value, False)
                    value = f"{interpolated_value:.{precision}f}"
                temp_dict[minimum[0]] = value
            data[f"{legend}"] = temp_dict

    return data

request_counter = 0

@app.post("/process-chart/")
async def process_chart(request: ChartRequest):
    global request_counter  # Use the global counter

    # Decode the base64 image
    image_data = base64.b64decode(request.image_dir.split(",")[1])
    image = Image.open(BytesIO(image_data))

    # Save the image to a temporary file with a unique name using uuid
    temp_image_path = f"temp_image_{uuid.uuid4()}.png"
    image.save(temp_image_path)

    # Round-robin URL selection based on the request counter
    urls = ["http://10.100.92.10/4-onechart/", "http://10.100.92.10/4-onechart-2/"]
    url = urls[request_counter % 2]  # Select URL based on the current value of the request counter

    # Increment and reset the request counter
    request_counter = (request_counter + 1) % 2

    client = Client(url)
    result, text = client.predict(temp_image_path, request.prompt, request.threthold, api_name="/start_inference")

    try:
        result_dict = ast.literal_eval(result)
        legends = result_dict["values"].keys()
        x_axis = []
        for i in legends:
            try:
                subdict = result_dict["values"][i].keys()
            except Exception:
                return {"ret": True, 
                "axis": list(legends),
                "data": result_dict}
            x_axis = subdict if len(subdict) > len(x_axis) else x_axis
        if "图表解析结果不可靠" in text:
            return {"ret": True, 
                    "axis": list(x_axis),
                    "data": result_dict}
        else:
            return {"ret": True, 
                    "axis": list(x_axis),
                    "data": result_dict}

    except Exception as e:
        print(e)
        return {"ret": False, 
                "axis": [],
                "data": result}
    finally:
        # Ensure the temporary image is deleted after processing
        os.remove(temp_image_path)

class FileList(BaseModel):
    files: List[str]

@app.post("/sort_files/")
def sort_files(file_list: FileList):
    sorted_files = natsorted(file_list.files, key=lambda x: (x.lower(), x))
    return {"sorted_files": sorted_files}