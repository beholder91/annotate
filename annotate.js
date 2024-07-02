let canvas = document.getElementById('graphCanvas');
let ctx = canvas.getContext('2d');
let fileInput = document.getElementById('file-input');
let fileList = document.getElementById('fileList');
let saveButton = document.getElementById('saveButton');
let errorMessage = document.getElementById('errorMessage');
let images = [];
let currentIndex = 0;
let currentAction = null;
let continuousMode = false;
let activeLegend = null;

let axisSelect = document.getElementById('axisSelect');
let yMinButton = document.getElementById('setYMinBtn');
let xPointsButton = document.getElementById('setXPointsBtn');
let yMaxButton = document.getElementById('setYMaxBtn');

// 获取新按钮和文本框
let preAnnotateBtn = document.getElementById('preAnnotateBtn');
let dataInput = document.getElementById('dataInput');
let prevImageBtn = document.getElementById('prevImageBtn');
let nextImageBtn = document.getElementById('nextImageBtn');

// 初始化存储标注结果的数组
let annotations = [];

// 添加按钮点击事件
preAnnotateBtn.addEventListener('click', requestChartAnalysis);
prevImageBtn.addEventListener('click', showPrevImage);
nextImageBtn.addEventListener('click', showNextImage);
saveButton.addEventListener('click', saveJson);

// 激活按钮
function activateButton(button) {
    yMinButton.classList.remove('active');
    xPointsButton.classList.remove('active');
    yMaxButton.classList.remove('active');
    button?.classList.add('active');
}

async function sortFiles(files) {
    const response = await fetch('http://10.100.2.195:8107/sort_files/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files: files })
    });
    const data = await response.json();
    return data.sorted_files;
}

fileInput.addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    const fileNames = files.map(file => file.name);
    const sortedFileNames = await sortFiles(fileNames);

    images = [];
    annotations = [];
    let loadedImages = 0;

    sortedFileNames.forEach((fileName, index) => {
        const file = files.find(f => f.name === fileName);
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                images[index] = { img: img, fileName: file.name };
                annotations[index] = { operations: [], legends: [], preAnnotateData: '', axisLabels: [] };
                loadedImages++;
                if (loadedImages === sortedFileNames.length) {
                    currentIndex = 0;
                    drawImage(currentIndex);
                    populateFileList();
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});


function drawImage(index) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(images[index].img, 0, 0, canvas.width, canvas.height);
    annotations[index].operations.forEach(op => {
        drawPoint(op.x, op.y, op.label, op.color);
        if (op.label.startsWith('X=')) {
            drawVerticalLine(op.x);
        }
    });
    displayLegends(index);
    displayPreAnnotateData(index);
}

function drawPoint(x, y, label, color) {
    ctx.fillStyle = color || '#000000';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillText(label, x + 10, y);
}

function drawVerticalLine(x) {
    ctx.strokeStyle = 'red';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
}

function updateActiveFile() {
    let fileItems = document.querySelectorAll('#fileList li');
    fileItems.forEach((item, index) => {
        if (index === currentIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (images[currentIndex]) {
        annotations[currentIndex].operations = [];
        annotations[currentIndex].legends = [];
    }
    drawImage(currentIndex);
    let dataDisplay = document.getElementById('dataDisplay');
    dataDisplay.innerHTML = '';
}

function setYMin() {
    currentAction = 'setYMin';
    continuousMode = true;
    activateButton(yMinButton);
}

function setXPoints() {
    currentAction = 'setXPoints';
    continuousMode = true;
    activateButton(xPointsButton);
}

function setYMax() {
    currentAction = 'setYMax';
    continuousMode = true;
    activateButton(yMaxButton);
}

function createXLabels(axisList) {
    if (annotations[currentIndex]) {
        let xPointOperations = annotations[currentIndex].operations.filter(op => op.label.startsWith('X='));
        if (xPointOperations.length > 0 || !axisList) {
            let labels = prompt('Enter labels for X points, separated by ; (eng):', axisList ? axisList.join(';') : '');
            if (labels) {
                let labelArray = labels.split(';').map(label => label.trim());
                for (let i = 0; i < xPointOperations.length && i < labelArray.length; i++) {
                    xPointOperations[i].label = `X=${labelArray[i]}`;
                }
                drawImage(currentIndex);
            }
        } else {
            alert('No X points have been set.');
        }
    } else {
        alert('You need to set X points first.');
    }
}

function addLegend() {
    let color = "#" + Math.floor(Math.random() * 16777215).toString(16);
    let label = prompt("Enter legend label:");
    let axis = axisSelect.value;
    if (label && annotations[currentIndex]) {
        annotations[currentIndex].legends.push({ label: label, color: color, axis: axis });
        displayLegend(label, color, axis);
    }
}

function displayLegend(label, color, axis) {
    let legendContainer = document.getElementById('legendContainer');
    let legendElement = document.createElement('div');
    legendElement.textContent = `${label} (${axis})`;
    legendElement.style.color = color;
    legendElement.style.margin = '5px';
    legendElement.style.cursor = 'pointer';
    legendElement.onclick = function() {
        activateLegend(label, color);
    };
    legendContainer.appendChild(legendElement);
}

function displayLegends(index) {
    const legendContainer = document.getElementById('legendContainer');
    legendContainer.innerHTML = '';
    annotations[index].legends.forEach(leg => {
        displayLegend(leg.label, leg.color, leg.axis);
    });
}

function displayPreAnnotateData(index) {
    dataInput.value = annotations[index].preAnnotateData;
    document.getElementById('createXLabelsBtn').onclick = function() {
        createXLabels(annotations[index].axisLabels);
    };
}

function activateLegend(label, color) {
    let foundLegend = annotations[currentIndex].legends.find(leg => leg.label === label);
    if (foundLegend) {
        if (activeLegend === label) {
            activeLegend = null;
            document.querySelectorAll('#legendContainer div').forEach(div => {
                div.style.backgroundColor = '';
            });
        } else {
            activeLegend = label;
            document.querySelectorAll('#legendContainer div').forEach(div => {
                div.style.backgroundColor = div.textContent.startsWith(label) ? 'lightgray' : '';
            });
            currentAction = 'legend';
            continuousMode = true;
        }
    }
}

function undo() {
    if (annotations[currentIndex] && annotations[currentIndex].operations.length > 0) {
        annotations[currentIndex].operations.pop();
        drawImage(currentIndex);
    }
}

canvas.addEventListener('click', function(e) {
    if (currentAction) {
        let rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (currentAction === 'setXPoints') {
            performAction(x, y, 'X=', null, axisSelect.value);
        } else if (currentAction === 'setYMax' || currentAction === 'setYMin') {
            let defaultValue = currentAction === 'setYmax' ? '' : '0';
            let value = prompt(`Enter value for ${currentAction === 'setYMax' ? 'Y Max' : 'Y Min'}`, defaultValue);
            let label = currentAction === 'setYMax' ? `Ymax=${value}` : `Ymin=${value}`;
            performAction(x, y, label, null, axisSelect.value);
        } else if (currentAction === 'legend' && activeLegend) {
            let legend = annotations[currentIndex].legends.find(leg => leg.label === activeLegend);
            performAction(x, y, legend.label, legend.color, legend.axis);
        }
    }
});

function performAction(x, y, label, color = null, axis = 'left') {
    if (!color) {
        if (label.startsWith('X=')) {
            color = '#0000ff';
        } else if (label.startsWith('Ymax=')) {
            color = '#00ff00';
        } else if (label.startsWith('Ymin=')) {
            color = '#ff00ff';
        } else if (label === 'Origin') {
            color = '#ff2626';
        }
    }
    annotations[currentIndex].operations.push({ x: x, y: y, label: label, color: color, axis: axis });
    drawPoint(x, y, label, color);
    if (label.startsWith('X=')) {
        drawVerticalLine(x);
    }
    if (!continuousMode) {
        currentAction = null;
        activateButton(null);
    }
}

async function exportData() {
    if (annotations[currentIndex]) {
        let data = {
            operations: annotations[currentIndex].operations,
            legends: annotations[currentIndex].legends
        };
        let response = await fetch('http://10.100.2.195:8107/process-data/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            let result = await response.json();
            displayData(result);
        } else {
            console.error('Failed to process data');
        }
    } else {
        console.error('No image selected or no operations to export.');
    }
}

function displayData(data) {
    let dataDisplay = document.getElementById('dataDisplay');
    let jsonData = JSON.stringify(data, null, 2);
    jsonData = jsonData.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
    dataDisplay.innerHTML = `<pre>${jsonData}</pre>`;
}

// 图表解析服务请求函数
async function requestChartAnalysis() {
    let imageDir = '';  // 从当前加载的图片中获取路径
    if (images[currentIndex] && images[currentIndex].img.src) {
        imageDir = images[currentIndex].img.src;
    } else {
        alert('请先上传并选择一张图片。');
        return;
    }
    
    let url = "http://10.100.2.195:8107/process-chart/";
    let prompt = "Covert the key information of the chart to a python dict:";
    let threshold = 0.1;

    let requestData = {
        image_dir: imageDir,
        prompt: prompt,
        threthold: threshold
    };

    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (response.ok) {
            let result = await response.json();
            if (result.data !== null) {
                let jsonData = JSON.stringify(result.data, null, 2);
                jsonData = jsonData.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\/g, '');
                annotations[currentIndex].preAnnotateData = jsonData;
                annotations[currentIndex].axisLabels = result.axis || [];
                displayPreAnnotateData(currentIndex);
            } else {
                annotations[currentIndex].preAnnotateData = 'No reliable data returned.';
                annotations[currentIndex].axisLabels = [];
                displayPreAnnotateData(currentIndex);
            }
        } else {
            throw new Error('Failed to fetch data');
        }
    } catch (error) {
        console.log(error);
        console.error(error);
        annotations[currentIndex].preAnnotateData = 'Error fetching data';
        annotations[currentIndex].axisLabels = [];
        displayPreAnnotateData(currentIndex);
    }
}

function showPrevImage() {
    if (currentIndex > 0) {
        saveCurrentPreAnnotateData();
        currentIndex--;
        drawImage(currentIndex);
        updateActiveFile();
    }
}

function showNextImage() {
    if (currentIndex < images.length - 1) {
        saveCurrentPreAnnotateData();
        currentIndex++;
        drawImage(currentIndex);
        updateActiveFile();
    }
}


function saveCurrentPreAnnotateData() {
    if (annotations[currentIndex]) {
        annotations[currentIndex].preAnnotateData = dataInput.value;
    }
}

function populateFileList() {
    fileList.innerHTML = '';
    images.forEach((image, index) => {
        let listItem = document.createElement('li');
        listItem.textContent = image.fileName;
        listItem.addEventListener('click', () => {
            saveCurrentPreAnnotateData();
            currentIndex = index;
            drawImage(currentIndex);
            updateActiveFile();
        });
        fileList.appendChild(listItem);
    });
    updateActiveFile();
}

function saveJson() {
    errorMessage.textContent = '';
    const jsonData = dataInput.value;
    let data;
    try {
        data = JSON.parse(jsonData);
    } catch (e) {
        errorMessage.textContent = '解析错误';
        return;
    }

    const fileName = images[currentIndex].fileName.replace(/\.[^/.]+$/, ".json");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}