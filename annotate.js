let canvas = document.getElementById('graphCanvas');
let ctx = canvas.getContext('2d');
let fileInput = document.getElementById('file-input');
let images = [];
let currentIndex = 0;
let currentAction = null;
let continuousMode = false;
let activeLegend = null;

let originButton = document.getElementById('setOriginBtn');
let xPointsButton = document.getElementById('setXPointsBtn');
let yMaxButton = document.getElementById('setYMaxBtn');

function activateButton(button) {
    originButton.classList.remove('active');
    xPointsButton.classList.remove('active');
    yMaxButton.classList.remove('active');
    button?.classList.add('active');
}

fileInput.addEventListener('change', function(e) {
    const files = e.target.files;
    images = [];
    let loadedImages = 0;
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                images.push({ img: img, operations: [], legends: [], fileName: file.name });
                loadedImages++;
                if (loadedImages === files.length) {
                    currentIndex = 0;
                    drawImage(currentIndex);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

function drawImage(index) {
    clearCanvas();
    ctx.drawImage(images[index].img, 0, 0, canvas.width, canvas.height);
    images[index].operations.forEach(op => {
        drawPoint(op.x, op.y, op.label, op.color);
    });
    displayLegends(index);
}

function drawPoint(x, y, label, color) {
    ctx.fillStyle = color || '#000000';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillText(label, x + 10, y);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function setOrigin() {
    currentAction = 'setOrigin';
    continuousMode = true;
    activateButton(originButton);
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

function addLegend() {
    let color = "#" + Math.floor(Math.random()*16777215).toString(16);
    let label = prompt("Enter legend label:");
    if (label && images[currentIndex]) {
        images[currentIndex].legends.push({ label: label, color: color });
        displayLegend(label, color);
    }
}

function displayLegend(label, color) {
    let legendContainer = document.getElementById('legendContainer');
    let legendElement = document.createElement('div');
    legendElement.textContent = label;
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
    images[index].legends.forEach(leg => {
        displayLegend(leg.label, leg.color);
    });
}

function activateLegend(label, color) {
    let foundLegend = images[currentIndex].legends.find(leg => leg.label === label);
    if (foundLegend) {
        if (activeLegend === label) {
            activeLegend = null;
            document.querySelectorAll('#legendContainer div').forEach(div => {
                div.style.backgroundColor = '';
            });
        } else {
            activeLegend = label;
            document.querySelectorAll('#legendContainer div').forEach(div => {
                div.style.backgroundColor = div.textContent === label ? foundLegend.color : '';
            });
            currentAction = 'legend';
            continuousMode = true;
        }
    }
}

function undo() {
    if (images[currentIndex] && images[currentIndex].operations.length > 0) {
        images[currentIndex].operations.pop();
        drawImage(currentIndex);
    }
}

canvas.addEventListener('click', function(e) {
    if (currentAction) {
        let rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        if (currentAction === 'legend' && activeLegend) {
            let legend = images[currentIndex].legends.find(leg => leg.label === activeLegend);
            performAction(x, y, legend.label, legend.color);
        } else if (['setXPoints', 'setYMax'].includes(currentAction)) {
            let value = prompt(`Enter value for ${currentAction === 'setXPoints' ? 'X Point' : 'Y Max'}`);
            let label = `${currentAction === 'setXPoints' ? 'X=' + value : 'Ymax=' + value}`;
            performAction(x, y, label);
        } else {
            performAction(x, y, currentAction);
        }
    }
});

function performAction(x, y, label, color = null) {
    if (!color) {
        if (label.startsWith('X=') || label.startsWith('Ymax=')) {
            color = label.startsWith('X=') ? '#0000ff' : '#00ff00';
        } else if (label === 'setOrigin') {
            color = '#ff2626'; // Red for origin
            label = 'Origin';
        }
    }
    images[currentIndex].operations.push({ x: x, y: y, label: label, color: color });
    drawPoint(x, y, label, color);
    if (!continuousMode) {
        currentAction = null;
        activateButton(null);
    }
}

async function exportData() {
    if (images[currentIndex]) {
        let data = { operations: images[currentIndex].operations };
        let response = await fetch('http://localhost:8000/process-data/', {
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
    dataDisplay.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
}


