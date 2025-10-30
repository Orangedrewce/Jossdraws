// WebGL Shader for Header Background
(function() {
  const canvas = document.getElementById('shaderCanvas');
  if (!canvas) return;
  
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn('WebGL not supported');
    return;
  }

  // Vertex shader
  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Fragment shader (converted from Shadertoy GLSL) — revised look with soft shading and subtle texture
  const fragmentShaderSource = `
    precision mediump float;
    #extension GL_OES_standard_derivatives : enable
    uniform vec2 iResolution;
    uniform float iTime;
    
    #define R iResolution
    #define T iTime
    #define BASE_THICKNESS 0.10
    
    // Brand colors
    vec3 home      = vec3(0.004, 0.569, 0.663);
    vec3 portfolio = vec3(0.482, 0.804, 0.796);
    vec3 about     = vec3(0.988, 0.855, 0.024);
    vec3 shop      = vec3(0.973, 0.561, 0.173);
    vec3 contact   = vec3(0.937, 0.341, 0.553);
    
    vec3 getColor(int i){
        if(i==0)return home;
        if(i==1)return portfolio;
        if(i==2)return about;
        if(i==3)return shop;
        if(i==4)return contact;
        return vec3(1.0);
    }
    
    mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
    
  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = (fragCoord - 0.5 * R.xy) / R.y;
    vec3 col = vec3(1.0); // white background

    // --- Base wavy motion ---
    float yWave = sin(uv.x*3.0 + T*1.0)*0.25 
          + sin(uv.x*1.1 - T*0.8)*0.1;
    float xOffset = sin(T*0.7 + uv.y*2.0)*0.25;
    float stretch = 0.8 + 0.4*sin(T*1.3 + uv.x*2.5);
    float bandThickness = BASE_THICKNESS * stretch;
    float offset = (uv.y - yWave) + xOffset * 0.3;

    // --- 180° twist logic ---
    float twistPeriod = 6.0;                   // seconds between twists
    float tPhase = floor(T / twistPeriod);     // which interval we're in
    float localT = fract(T / twistPeriod);     // progress in this interval
    float twistAngle = smoothstep(0.0, 0.9, localT) * 3.14159; // 0→π over half interval

    // pseudo-random direction (+ or -)
    float randDir = sign(sin(tPhase * 12.345)); 
    twistAngle *= randDir;

    // apply the twist as rotation of the UV frame
    uv *= rot(twistAngle * 0.5);

    // --- Color band mapping with AA and no white seams ---
    // Placement of the band in the header
    float s = (offset + 0.205) / bandThickness;   

    // Screen-space AA width using derivatives (fallback constant if unavailable)
    #ifdef GL_OES_standard_derivatives
      float aaw = max(fwidth(s) * 1.25, 0.0015);
    #else
      float aaw = 0.002; // conservative fallback
    #endif

    float xi = floor(s);
    float xf = s - xi; // local position within current band [0,1)

    //number is stroke width lower number is blended
    int iCenter = int(xi);
    int iLeft   = iCenter - 1;
    int iRight  = iCenter + 1;

  // Valid band indices are [0..4] (use float clamp for WebGL1 compatibility)
  int cCenter = int(clamp(float(iCenter), 0.0, 4.0));
  int cLeft   = int(clamp(float(iLeft),   0.0, 4.0));
  int cRight  = int(clamp(float(iRight),  0.0, 4.0));
  vec3 c0 = getColor(cCenter);
  vec3 cL = getColor(cLeft);
  vec3 cR = getColor(cRight);

    // Three-way blend across the band with antialiased edges
    float wL = 1.0 - smoothstep(0.0, aaw, xf);
    float wR = smoothstep(1.0 - aaw, 1.0, xf);
    float w0 = 1.0 - wL - wR;
    vec3 bandCol = c0*w0 + cL*wL + cR*wR;

    // --- Plastic Surface Shading ---
    // We model the ribbon as a cylinder. The lighting will be based on the angle
    // to a simulated light source.
    // 'centerFactor' is 1 at the center of the ribbon and 0 at the edges.
    float dEdge = min(xf, 1.0 - xf);
    //opacity color 
    float centerFactor = smoothstep(0.0, 10.0, dEdge);

    
    // 1.125 is the brightness level of the colors.
    vec3 shaded = bandCol * mix(1.125, 1.0, centerFactor);

    // Specular highlight for a "glossy" look.
    // This creates a sharp, bright reflection near the center.
    float specularPower = 50.0; // Higher value = sharper highlight
    float highlight = pow(centerFactor, specularPower);
    shaded = mix(shaded, vec3(1.0), highlight * 0.75); // Mix with white for the highlight

    // Subtle drop shadow for depth.
    float edgeShadow = 1.0 - smoothstep(0.0, max(aaw*2.0, 0.002), xf);
    shaded *= 1.0 - edgeShadow * 0.1;

    // Only show bands in the intended range [0,5); AA the outermost boundary
    float inRangeAA = smoothstep(-aaw, 0.0, s) * (1.0 - smoothstep(5.0, 5.0 + aaw, s));
    col = mix(vec3(1.0), shaded, inRangeAA);

    gl_FragColor = vec4(col, 1.0);
  }
  `;

  // Compile shader
  function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  // Enable standard derivatives for better AA in fragment shader (if available)
  gl.getExtension('OES_standard_derivatives');

  // Create program
  const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
  
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }
  
  gl.useProgram(program);

  // Set up geometry (full-screen quad)
  const positions = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1
  ]);
  
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Get uniform locations
  const resolutionLocation = gl.getUniformLocation(program, 'iResolution');
  const timeLocation = gl.getUniformLocation(program, 'iTime');

  // --- Interactive speed control (hover to slow down) ---
  // We'll accumulate our own shader time (animTime) using a smoothed speed factor.
  let animTime = 0.0;                 // time fed to the shader
  let lastRealTime = performance.now() * 0.001; // seconds
  let currentSpeed = 1.0;             // smoothed speed factor actually used each frame
  let targetSpeed = 1.0;              // 1.0 = normal, 0.2 = slowed
  const SPEED_SMOOTH_TAU = 0.25;      // seconds to ease between speeds (~250ms)

  // Listen for hover on the header (canvas has pointer-events: none in CSS)
  const hoverEl = document.querySelector('header');
  if (hoverEl) {
    // Use pointerenter/leave for broader device support, fall back to mouse events
    const onEnter = () => { targetSpeed = 0.2; };
    const onLeave = () => { targetSpeed = 1.0; };
    hoverEl.addEventListener('pointerenter', onEnter);
    hoverEl.addEventListener('pointerleave', onLeave);
    hoverEl.addEventListener('mouseenter', onEnter);
    hoverEl.addEventListener('mouseleave', onLeave);
  }

  // Resize canvas to match display size
  function resize() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  // Animation loop
  function render() {
    resize();
    // Real elapsed time since last frame
    const now = performance.now() * 0.001; // seconds
    let dt = now - lastRealTime;
    lastRealTime = now;
    // Clamp dt to avoid spikes when the tab regains focus
    dt = Math.max(0.0, Math.min(dt, 0.05));

    // Smoothly ease currentSpeed toward targetSpeed with a time-constant
    const blend = 1.0 - Math.exp(-dt / SPEED_SMOOTH_TAU);
    currentSpeed += (targetSpeed - currentSpeed) * blend;

    // Advance the shader time with the (smoothed) speed factor
    animTime += dt * currentSpeed;

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, animTime);
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    requestAnimationFrame(render);
  }
  
  render();
})();
