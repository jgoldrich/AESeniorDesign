// AE Senior Design Website 2017 - Jake Goldrich

/* =================================SETUP AND INITIALIZATION CODE================================= */

var gl;
var canvas;
var shaderProgram;
var vertexPositionBuffer;

// sphere base geom
var sphereVertexPositionBuffer; // Create a place to store sphere geometry
var sphereVertexNormalBuffer; // Create a place to store normals for shading

var vSphere = [];
var nSphere = [];
var fSphere = [];

var sphereIndexTriBuffer;

// View parameters
var eyePt = vec3.fromValues(0.0,0.0,70.0);
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);

var lightPosEye; // variable for the 3-vec for the light position - global to pass around, created from the transformed 4-vec

var nMatrix = mat3.create(); // Create the normal matrix
var mvMatrix = mat4.create(); // Create ModelView matrix
var pMatrix = mat4.create(); //Create Projection matrix
var mvMatrixStack = []; // setup matrix stack for transformations

var material_indices = []; // array of kd color materials to be loaded from the .mtl, referenced in obj with usemtl
var faceSlices = []; // push when see new usemtl
var materials = []; // materials to be loaded from the .mtl

/* =================================BUFFERS AND DRAW SETUP================================= */

// sphere buffer
function setupSphereBuffers() {
    
    // specify veritces
    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);   
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vSphere), gl.STATIC_DRAW);
    sphereVertexPositionBuffer.itemSize = 3;
    sphereVertexPositionBuffer.numItems = vSphere.length/3;
    
    // Specify normals to be able to do lighting calculations - uncomment after calculating normals
    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nSphere), gl.STATIC_DRAW);
    sphereVertexNormalBuffer.itemSize = 3;
    sphereVertexNormalBuffer.numItems = nSphere.length/3; // ?
    
    // Specify faces 
    sphereIndexTriBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexTriBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(fSphere), gl.STATIC_DRAW);
    sphereIndexTriBuffer.itemSize = 1;
    sphereIndexTriBuffer.numItems = fSphere.length; // ?
    
}

// draw a sphere
function drawSphere() {
    
 gl.polygonOffset(0,0);
    
 // bind vertex buffer
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sphereVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

 // Bind normal buffer
 gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
 gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, sphereVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);   
    
 // Draw 
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexTriBuffer); // splice this buffer here? or re-setup the faces buffer each time by splicing the fSphere array?
 gl.drawElements(gl.TRIANGLES, sphereIndexTriBuffer.numItems, gl.UNSIGNED_SHORT,0);   // issue with unsigned short? // check the buffer
    
}

/* =================================UPLOAD MATS TO SHADER================================= */

// ModelView
function uploadModelViewMatrixToShader() {
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

// Projection
function uploadProjectionMatrixToShader() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
}

// Normal
function uploadNormalMatrixToShader() {
    mat3.fromMat4(nMatrix,mvMatrix);
    mat3.transpose(nMatrix,nMatrix);
    mat3.invert(nMatrix,nMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

// call all the upload functions
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

// Lights
function uploadLightsToShader(loc,a,d,s) {
    gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
    gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
    gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
    gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

// Material properties
function uploadMaterialToShader(a,d,s) {
    gl.uniform3fv(shaderProgram.uniformAmbientMatColorLoc, a);
    gl.uniform3fv(shaderProgram.uniformDiffuseMatColorLoc, d);
    gl.uniform3fv(shaderProgram.uniformSpecularMatColorLoc, s);
}

/* =================================UTILITY FUNCTIONS================================= */

// push matrix onto transformation stack
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}

// pop matrix off of the transformation stack
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}


// deg/rad conversion
function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

/* =================================INITIALIZATION================================= */


// make a webgl context to display
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

// load the shaders from the GLSL code
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
  if (!shaderScript) {
    return null;
  }
  
  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
 
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
 
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
 
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader;
}

// setup the vertex and fragment shaders
function setupShaders() {
    vertexShader = loadShaderFromDOM("shader-vs");
    fragmentShader = loadShaderFromDOM("shader-fs");
  
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Failed to setup shaders");
    }

    gl.useProgram(shaderProgram);

    // bind all the attributes and uniforms to the shader program
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");

    shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
    shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
    shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
    shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");

    shaderProgram.uniformAmbientMatColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientMatColor");  
    shaderProgram.uniformDiffuseMatColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseMatColor");
    shaderProgram.uniformSpecularMatColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularMatColor");    
    
}

// load up the vertices and face indicies for the geometry
function setupBuffers() {
    setupSphereBuffers();    

}


function loadData() {

    // load materials from the mtl
    $.get("uav_obj.mtl", function(mtl_data) {
        processMtl(mtl_data);
    })
    
    // load sphere geom from obj
    $.get("uav_obj.obj", function(data) {
            processObj(data);
    }).done(function(){startup()});
    
}

function processMtl(mtl_data) {
    var words = mtl_data.split(" ");
    
    for (var i = 0; i < words.length; i++) {
        
        var currWord = words[i];
        
        if (currWord.substring(0,1) == "0" || currWord.substring(0,1) == "1") {
            var R = parseFloat(currWord.substring(0,5));
            var G = parseFloat(words[i+1].substring(0,5));
            var B = parseFloat(words[i+2].substring(0,5));
            
            var thisMat = vec3.fromValues(R, G, B);
            
            materials.push(thisMat);
            
            i += 2; // need to jump ahead 3 in total
        }
        
    }
    
}

function processObj(data) {

    var lines = data.split("\n");
    
    for (var i = 0; i < lines.length; i++) {
        var currLine = lines[i];
        var currLineSplit = currLine.split(" ");
        
        var type = currLineSplit[0];
        
        if (type == "v") {
            vSphere.push(currLineSplit[2]);
            vSphere.push(currLineSplit[3]);
            vSphere.push(currLineSplit[4]);
            
            // calculate normals as just the normalized coordinate
            var normal = vec3.fromValues(currLineSplit[2], currLineSplit[3], currLineSplit[4]);
            vec3.normalize(normal, normal);
            
            nSphere.push(normal[0]);
            nSphere.push(normal[1]);
            nSphere.push(normal[2]);
            
        } else if (type == "usemtl") {
            
            var materialNumber = currLineSplit[1].substring(3);
            
            // check if default material
            if (materialNumber == "AULT_MTL") {
                material_indices.push(0);
            } else {
                material_indices.push(parseInt(materialNumber)+1); // off by one since default material
            }
            
            //var fStart = lines[i+1].split(" ")[1].split("/")[0]-1; // current face - from first face on next line
            
            var fStart = fSphere.length; // start recording from here
            
            var fEnd = 0; // set in the f part
            
            var thisSlice = [fStart, fEnd];
            
            faceSlices.push(thisSlice);
            
        } else if (type == "f") {
            
            // remember to subtract by 1 to account for being 1-indexed instead of 0 for the verts
            var face1s = currLineSplit[1].split("/");
            fSphere.push(face1s[0]-1);
            
            var face2s = currLineSplit[3].split("/");
            fSphere.push(face2s[0]-1);
            
            var face3s = currLineSplit[5].split("/");
            fSphere.push(face3s[0]-1);
            
            // update end from last slice
            //var fEnd = fSphere[fSphere.length-1];
            
            var fEnd = fSphere.length-1; // record last index
            
            faceSlices[faceSlices.length-1][1] = fEnd;
            
        }
    }
    
}

// function called from the body onload
function startup() {
    canvas = document.getElementById("myGLCanvas");
    gl = createGLContext(canvas);
    setupShaders();
    setupBuffers();
    gl.clearColor(0.53, 0.81, 0.92, 1.0); // background color
    gl.enable(gl.DEPTH_TEST);
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
    
    tick(); // kick off the rendering and animation loop
}

// run on every frame refresh
function tick() {
    requestAnimFrame(tick); // update stuff
    handleKeys();
    draw();
    
    animate();
}

/* =================================EVENT HANDLING================================= */

// from simple user interaction class example
var currentlyPressedKeys = {};

function handleKeyDown(event) {
        currentlyPressedKeys[event.keyCode] = true;
}

function handleKeyUp(event) {
        currentlyPressedKeys[event.keyCode] = false;
}

var Zangle = 0.0;
var Yangle = 90.0;
var Xangle = 0.0;
depth = 70.0;
function handleKeys() {
    inc = 0.75
    if (currentlyPressedKeys[65]) {
        // A
        Zangle += inc;
    } else if (currentlyPressedKeys[68]) {
        // D
        Zangle -= inc;
    }
    
    if (currentlyPressedKeys[87]) {
        // W
        Xangle -= inc;
    } else if (currentlyPressedKeys[83]) {
        // S
        Xangle += inc;
    }
    
    if (currentlyPressedKeys[81]) {
        Yangle += inc;
    } else if (currentlyPressedKeys[69]) {
        Yangle -= inc;
    }
    
    if (currentlyPressedKeys[88]) {
        // X
        depth -= inc;
    } else if (currentlyPressedKeys[90]) {
        // Z
        depth += inc;
    }
    
}

/* =================================RENDERING================================= */

// main draw loop
function draw() { 
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective projection
    mat4.perspective(pMatrix,degToRad(45), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);

    var eyePt = vec3.fromValues(0.0,0.0,depth);
    
    // We want to look down -z, so create a lookat point in that direction    
    vec3.add(viewPt, eyePt, viewDir);
    
    // Then generate the lookat matrix and initialize the MV matrix to that view
    mat4.lookAt(mvMatrix,eyePt,viewPt,up); 
    
    mat4.rotateZ(mvMatrix, mvMatrix, degToRad(Zangle))
    mat4.rotateY(mvMatrix, mvMatrix, degToRad(Yangle))
    mat4.rotateX(mvMatrix, mvMatrix, degToRad(Xangle))
    
    // light position
    var lightPosEye4 = vec4.fromValues(0.0, 0.0, 100.0, 1.0);
    lightPosEye4 = vec4.transformMat4(lightPosEye4,lightPosEye4,mvMatrix);
    lightPosEye = vec3.fromValues(lightPosEye4[0],lightPosEye4[1],lightPosEye4[2]);
    
    setupSpheresDraw();
  
}

function setupSpheresDraw() {

    var transformVec = vec3.create(); // vector to move objects around
    var scaleVec = vec3.create(); // scaling vector

    // Set up light parameters
    var Ia = vec3.fromValues(1.0,1.0,1.0); // ambient
    var Id = vec3.fromValues(1.0,1.0,1.0); // diffuse
    var Is = vec3.fromValues(1.0,1.0,1.0); // specular

    // Set up material parameters    
    var ka = vec3.fromValues(0.0,0.0,0.0); // ambient
    var kd = vec3.fromValues(0.0, 0.0, 0.0); // diffuse - will be set for each mtl
    var ks = vec3.fromValues(1.0,1.0,1.0); // specular

    //mvPushMatrix(); // for matrix transformation

    //mat4.translate(mvMatrix, mvMatrix, spheres[ind][i].position);

    // scaleFactor = 1.0;
    //vec3.set(scaleVec, scaleFactor, scaleFactor, scaleFactor); // use this to set the scale
    //mat4.scale(mvMatrix, mvMatrix, scaleVec);
    
    
    // loop thru all the components here with diff vertex buffers, colors, etc.
            
    // slice fSphere for this component
    var fLen = fSphere.length;
    
    for (var i = 0; i < faceSlices.length; i++) {
        
        mvPushMatrix(); // for matrix transformation for each part
        
        var start = faceSlices[i][0];
        var end = faceSlices[i][1];
        
        var thisF = fSphere.slice(start, end);
        
        if (material_indices[i] < materials.length) // mask error - look at logic here
        kd = materials[material_indices[i]];
        
        // set kd
//        if (i == 0) {
//            kd = vec3.fromValues(1,0,0);
//            thisF = fSphere.slice(0, fLen/2);
//        } else {
//            kd = vec3.fromValues(0,0,1);
//            thisF = fSphere.slice(fLen/2);
//        }


        // re-bind the triindexbuffer with the appropriate faces slice
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIndexTriBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(thisF), gl.STATIC_DRAW);
        sphereIndexTriBuffer.itemSize = 1;
        sphereIndexTriBuffer.numItems = thisF.length; // ?


        uploadLightsToShader(lightPosEye,Ia,Id,Is);
        uploadMaterialToShader(ka,kd,ks);
        setMatrixUniforms();
        drawSphere();
        mvPopMatrix();
    
    }
}

function animate() {

    if (document.getElementById("animate").checked) {
        var speed = document.getElementById("speed").value;
        // increment angles

    } else if (document.getElementById("pause").checked) {
        // do't
    }
    
       
}

function restart() {
    // reset angles
}


