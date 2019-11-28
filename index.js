"use strict";

const SERVER_URL = "http://localhost:5000/api/";

let ctx;
let canvas;
let ctx2;
let canvas2;
let videoElement;
let recordedChunks = [];
let width = 700;
let height;
let imageX = 1230;
let imageY = 1600;
let imageColumns = 5;
let imageRows = 5;
let offsetX = 16;
let offsetY = 16;
// let imageWidth = 84;
let imageWidth = (imageX - 2 * offsetX) / imageColumns;
// let imageHeight = 110;
let imageHeight = (imageY - 2 * offsetY) / imageRows;
let birdSprite;



let birdPos = {};  // position of the bird in the video
let periods = {};
let birdCoords = [];
let unit;
let detectedObjects = [];
let currentDetectedObject = "";
let scannedObjects = {};

function setup() {
    if (!(navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia)) {
            alert("getUserMedia() is not supported in your browser.");
        }
    canvas = document.getElementById("stream");
    ctx = canvas.getContext("2d");
    videoElement = document.getElementById("video");

    canvas2 = document.getElementById("stream2");
    ctx2 = canvas2.getContext("2d");

    navigator.mediaDevices.getUserMedia({video: true, audio: false})
    .then(function(stream) {
      videoElement.srcObject = stream;
      videoElement.play();
    //   let mediaRecorder = new MediaRecorder(stream, {mimeType: "video/webm; codecs=vp9"});
    //   mediaRecorder.ondataavailable = handleDataAvailable;
    //   mediaRecorder.start(10);
    })
    .catch(function(err) {
      console.log("An error occurred: " + err);
    });

    videoElement.addEventListener('canplay', function(ev){
        height = videoElement.videoHeight / (videoElement.videoWidth/width);
    
        if (isNaN(height)) {
        height = width / (4/3);
        }
    
        videoElement.setAttribute('width', width);
        videoElement.setAttribute('height', height);
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);

        canvas2.setAttribute('width', width);
        canvas2.setAttribute('height', height);

        birdPos = {x: width - 500, y: height - 300};
        birdPos.targetX = birdPos.x;
        birdPos.targetY = birdPos.y;

        unit = width / 100;
        
      }, false);
    
    birdSprite = document.createElement("img");
    birdSprite.src = "images/bird3.png";
}

function handleDataAvailable(event) {
    if (event.data.size > 0) {
        recordedChunks.push(event.data);
        console.log(recordedChunks);
        uploadStream();
      }
}

function uploadStream() {
    var blob = new Blob(recordedChunks, {
        type: "video/webm"
      });
      var url = URL.createObjectURL(blob);
}

function setupSpritePeriods() {
    // let nImages = 22;
    let nImages = 14;
    let nMilis = 1000;
    let nPerRow = 5;
    let period = Math.ceil(nMilis / nImages);
    let index = -1;
    for (let i=0; i<1000; i++) {
        if (i % period == 0) index++;
        periods[i] = index;
    }

    for (let i=0; i<nImages; i++) {
        let row = Math.floor(i / nPerRow);
        let column = i % nPerRow;
        let sx = offsetX + column * imageWidth;
        let sy = offsetY + row * imageHeight;
        birdCoords.push({sx: sx, sy: sy})
    }

}

function getBirdSprite(stage) {
    let index = periods[stage];
    return birdCoords[index];
}

async function renderOriginalVideo() {
    console.log(videoElement.width + " x "  + videoElement.height);
    setupSpritePeriods();
    let cycles = 0;
    let prevTime = Date.now() / 1000;
    let prevCount = 0;
    console.log("Start time: " + prevTime);
    let curTime;
    let delta;
    let frames;
    let stage;
    let SLEEP_PERIOD = 30;
    let CYCLES_PER_UPLOAD = 8;
    let noObjectCount = 0;
    let noCurrentObjectCount = 0;
    let imagePadding = 55;

    let obStartX, obStartY, obWidth, obHeight, obLabel;

    while (true) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(videoElement, 0, 0, width, height);

        curTime = Date.now();

        // modify original frame
        if (obStartX) {
            updateBirdPos();
            ctx.font = "25px Arial";
            ctx.fillText(obLabel, birdPos.x + 170, birdPos.y + 100);
            stage = curTime % 1000;
            let coords = getBirdSprite(stage);
            ctx.drawImage(birdSprite, coords.sx, coords.sy, imageWidth, imageHeight, 
                birdPos.x - imagePadding, birdPos.y - imagePadding, imageWidth, imageHeight);
            
            // draw object rectangle
            ctx.strokeRect(obStartX, obStartY, obWidth, obHeight);
        }
        
        // upload the frame to the server
        if (cycles % CYCLES_PER_UPLOAD == 1) {
            ctx2.drawImage(videoElement, 0, 0, width, height);
            // let frameURL = canvas2.toDataURL();
            canvas2.toBlob(blob => {
                var formData = new FormData();
                formData.append("frame", blob);
                axios({
                    method: 'post',
                    url: SERVER_URL + "upload-frame",
                    data: formData,
                    headers: {'Content-Type': 'multipart/form-data' }
                    })
                    .then(function (response) {
                        console.log(response.data);
                        if (response.data.success) {
                            let objects = response.data.objects.filter(obj => !detectedObjects.includes(obj.label));
                            let objectPresent = false;
                            let ob;
                            for (let obj of objects) {
                                if (currentDetectedObject && obj.label == currentDetectedObject) {
                                    objectPresent = true;
                                    ob = obj;
                                    break;
                                }
                            }
                            if (!objectPresent) {
                                noCurrentObjectCount++;
                                if (noCurrentObjectCount > 5) {
                                    ob = objects[0];
                                    if (currentDetectedObject !== "") {
                                        scannedObjects[currentDetectedObject].disappeared = true;
                                    }
                                }
                                else {
                                    return;
                                }
                            } else {
                                noCurrentObjectCount = 0;
                            }

                            if (!ob) {
                                noObjectCount++;
                                if (noObjectCount > 10) {
                                    obLabel = "Scanned all objects!";
                                    obWidth = obHeight = 0;
                                    birdPos.targetX = -25.3 * unit;
                                    birdPos.targetY = height / 3;
                                }
                                return;
                            }
                            noObjectCount = 0;
                            obStartX = ob.startX;
                            obStartY = ob.startY;
                            obWidth = ob.endX - obStartX;
                            obHeight = ob.endY - obStartY;
                            obLabel = ob.label;

                            setCurrentDetectedObject(obLabel);
                            birdPos.targetX = obStartX;
                            birdPos.targetY = ob.endY - 100;

                        }
                    })
                    .catch(function (response) {
                        console.log(response);
                    });
            });
        }
        
        cycles++;
        if (cycles % 20) {
            await sleep(SLEEP_PERIOD);
            continue;
        }
        curTime /= 1000;
        delta = curTime - prevTime;
        frames = cycles - prevCount;
        console.log("frames: " + frames);
        console.log("delta: " + delta);
        console.log("fps: " + frames / delta);
        console.log("Bird pos: " + birdPos.x + ": " + birdPos.y);
        prevCount = cycles;
        prevTime = curTime;
        await sleep(SLEEP_PERIOD);
    }
}



function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function postData(url = '', data = {}) {
    // Default options are marked with *
    url = SERVER_URL + url;
    const response = await fetch(url, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin', // include, *same-origin, omit
      headers: {
        'Content-Type': 'application/json'
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      redirect: 'follow', // manual, *follow, error
      referrer: 'no-referrer', // no-referrer, *client
      body: JSON.stringify(data) // body data type must match "Content-Type" header
    });
    return await response.json(); // parses JSON response into native JavaScript objects
  }

function updateBirdPos() {
    birdPos.x = birdPos.targetX;
    birdPos.y = birdPos.targetY;
}

function setCurrentDetectedObject(name) {
    if (currentDetectedObject == name) return;
    currentDetectedObject = name;
    if (currentDetectedObject === "") return;
    console.log("current object: " + currentDetectedObject);
    scannedObjects[currentDetectedObject] = {disappeared: false};
    // setTimeout(name => {
    //     console.log("current object: " + name);
    //     if (!scannedObjects[name].disappeared)
    //         detectedObjects.push(name);
    //     currentDetectedObject = "";
    // }, 5000, currentDetectedObject);
    setTimeout(speakText, 1000, currentDetectedObject);
}

function speakText(name) {
    if (currentDetectedObject !== name) return;
    var msg = new SpeechSynthesisUtterance();
    var voice = window.speechSynthesis.getVoices()[0];
    msg.voice = voice;
    let text = descriptions[name];
    if (!text) {
        text = "This is " + name;
    }
    msg.text = text;
    msg.onend = function() {
        console.log(">>> current object: " + name);
        console.log(">>> detected objects: " + detectedObjects);
        // if (!scannedObjects[name].disappeared)
        detectedObjects.push(name);
        currentDetectedObject = "";
        console.log(">>> detected objects: " + detectedObjects);
    }
    speechSynthesis.speak(msg);
}

let descriptions = {
    chair: "One of the basic pieces of furniture, a chair is a type of seat. Its primary features are two pieces of a durable material, attached as back and seat to one another at a 90° or slightly greater angle, with usually the four corners of the horizontal seat attached in turn to four legs—or other parts of the seat's underside attached to three legs or to a shaft about which a four-arm turnstile on rollers can turn—strong enough to support the weight of a person who sits on the seat  and leans against the vertical back . The legs are typically high enough for the seated person's thighs and knees to form a 90° or lesser angle.",
    bottle: "A bottle is a narrow-necked container made of an impermeable material (clay, glass, plastic, aluminium etc.) in various shapes and sizes to store and transport liquids and whose mouth at the bottling line can be sealed with an internal stopper, an external bottle cap, a closure, or a conductive inner seal using induction sealing. Some of the earliest bottles appeared in China, Phoenicia, Crete, and Rome. ",
    pottedplant: "Plants are mainly multicellular, predominantly photosynthetic eukaryotes of the kingdom Plantae. Historically, plants were treated as one of two kingdoms including all living things that were not animals, and all algae and fungi were treated as plants. However, all current definitions of Plantae exclude the fungi and some algae, as well as the prokaryotes.",
    car: "A car (or automobile) is a wheeled motor vehicle used for transportation. Most definitions of cars say that they run primarily on roads, seat one to eight people, have four tires, and mainly transport people rather than goods.",
    person: "A person is a being that has certain capacities or attributes such as reason, morality, consciousness or self-consciousness, and being a part of a culturally established form of social relations such as kinship, ownership of property, or legal responsibility. The defining features of personhood and consequently what makes a person count as a person differ widely among cultures and contexts. "
};

setup();
renderOriginalVideo();