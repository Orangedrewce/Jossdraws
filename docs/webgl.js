// WebGL Shader for Header Background — flat ribbons with 2x SSAA and gamma-correct resolve
(function() {
  // ===== ADJUSTABLE SPEED VARIABLE =====
  const SHADER_SPEED = .750; // left-to-right wave speed (0.1 = slower, 1.0 = faster)
  // =====================================

  const canvas = document.getElementById('shaderCanvas');
  if (!canvas) return;

  // Antialias true helps polygon edges; procedural edges are handled in shader
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) ||
             canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
  if (!gl) {
    console.error('WebGL not supported on this browser.');
    return;
  }

  // Prefer high precision if available (reduces shimmer on some GPUs)
  const fragmentPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const hasHighp = fragmentPrecision && fragmentPrecision.precision > 0;

  // Keep flat fills clean
  gl.disable(gl.DITHER);

  // ---------------------
  // Shaders (pass 1: scene in linear color space)
  // ---------------------
  const sceneVertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Renders ribbons and outputs LINEAR color (no sRGB conversion here).
  const sceneFragmentShaderSource = `
    precision ${hasHighp ? 'highp' : 'mediump'} float;
    uniform vec2 iResolution;   // hi-res (SSAA) buffer size in pixels
    uniform float iTime;

    #define R iResolution
    #define T iTime

    // Tunables
    const float BASE_THICKNESS = 0.10; // stripe thickness in UV units (relative to canvas height)
    const float AA_PX = 1.5;           // analytic AA width in pixels (increase to 2.0–2.25 for softer edges)

    // Brand colors (sRGB)
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

    // sRGB -> Linear (approx 2.2)
    vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

    void main() {
      vec2 fragCoord = gl_FragCoord.xy;

      // Normalize so 1.0 UV unit equals the buffer height in pixels
      vec2 uv = (fragCoord - 0.5 * R.xy) / R.y;

      // Background (linear)
      vec3 bg = toLinear(vec3(1.0));

      // Wave (vertical displacement only; flat ribbons, no twist/pivot)
      float yWave = sin(uv.x*3.0 + T)*0.25
                  + sin(uv.x*1.1 - T*0.8)*0.10;

      float bandThickness = BASE_THICKNESS;

      // Stripe coordinate: each [n, n+1) is one ribbon
      float s = ((uv.y - yWave) + 0.205) / bandThickness;
      float xi = floor(s);
      float xf = s - xi; // 0..1 inside a stripe

      // Neighbor stripe indices
      int iCenter = int(xi);
      int iLeft   = iCenter - 1;
      int iRight  = iCenter + 1;

      // Clamp visible ribbons [0..4]
      int cCenter = int(clamp(float(iCenter), 0.0, 4.0));
      int cLeft   = int(clamp(float(iLeft),   0.0, 4.0));
      int cRight  = int(clamp(float(iRight),  0.0, 4.0));

      // Colors in linear space
      vec3 c0 = toLinear(getColor(cCenter));
      vec3 cL = toLinear(getColor(cLeft));
      vec3 cR = toLinear(getColor(cRight));

      // Constant AA width in 's' units derived from pixel width
      // 1px in uv.y = 1/R.y; divide by bandThickness to convert to 's'
      float pxS = 1.0 / (bandThickness * R.y);
      float aaw = AA_PX * pxS;

      // Piecewise 2-way blend near stripe edges (prevents weight overshoot)
      vec3 bandCol;
      if (xf < aaw) {
        float t = smoothstep(0.0, aaw, xf);
        bandCol = mix(cL, c0, t);
      } else if (xf > 1.0 - aaw) {
        float t = smoothstep(1.0 - aaw, 1.0, xf);
        bandCol = mix(c0, cR, t);
      } else {
        bandCol = c0;
      }

      // Visible ribbon range [0,5) with AA against background (linear)
      float coverL = smoothstep(-aaw, 0.0, s);
      float coverR = 1.0 - smoothstep(5.0, 5.0 + aaw, s);
      float cover = coverL * coverR;

      // Composite in linear space
      vec3 outLinear = mix(bg, bandCol, cover);

      gl_FragColor = vec4(outLinear, 1.0);
    }
  `;

  // ---------------------
  // Shaders (pass 2: resolve 2x2 in linear space, convert to sRGB)
  // ---------------------
  const resolveVertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const resolveFragmentShaderSource = `
    precision ${hasHighp ? 'highp' : 'mediump'} float;
    uniform sampler2D u_texture; // hi-res linear color texture
    uniform vec2 u_hiSize;       // hi-res size in pixels

    // Linear -> sRGB
    vec3 toSRGB(vec3 c) { return pow(c, vec3(1.0/2.2)); }

    void main() {
      // Low-res (canvas) pixel center in its own pixel coords
      vec2 p = gl_FragCoord.xy;

      // Map to the top-left hi-res texel center for this low-res pixel:
      // uv00 corresponds to hi-res index (2x) of (2*floor(p) + 0.5).
      vec2 invHi = 1.0 / u_hiSize;
      vec2 uv00 = (( (p - 0.5) * 2.0 ) + 0.5) * invHi;

      // Exact 2x2 box in hi-res texel centers
      vec3 c00 = texture2D(u_texture, uv00).rgb;
      vec3 c10 = texture2D(u_texture, uv00 + vec2(invHi.x, 0.0)).rgb;
      vec3 c01 = texture2D(u_texture, uv00 + vec2(0.0, invHi.y)).rgb;
      vec3 c11 = texture2D(u_texture, uv00 + invHi).rgb;

      // Average in LINEAR space, then convert to sRGB for display
      vec3 linAvg = 0.25 * (c00 + c10 + c01 + c11);
      gl_FragColor = vec4(toSRGB(linAvg), 1.0);
    }
  `;

  // Compile helper
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

  // Link helper
  function createProgram(vsSrc, fsSrc) {
    const vs = compileShader(vsSrc, gl.VERTEX_SHADER);
    const fs = compileShader(fsSrc, gl.FRAGMENT_SHADER);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    return prog;
  }

  // Programs
  const sceneProgram = createProgram(sceneVertexShaderSource, sceneFragmentShaderSource);
  const resolveProgram = createProgram(resolveVertexShaderSource, resolveFragmentShaderSource);
  if (!sceneProgram || !resolveProgram) return;

  // Attributes and uniforms (scene)
  const scenePosLoc = gl.getAttribLocation(sceneProgram, 'a_position');
  const sceneResLoc = gl.getUniformLocation(sceneProgram, 'iResolution');
  const sceneTimeLoc = gl.getUniformLocation(sceneProgram, 'iTime');

  // Attributes and uniforms (resolve)
  const resolvePosLoc = gl.getAttribLocation(resolveProgram, 'a_position');
  const resolveTexLoc = gl.getUniformLocation(resolveProgram, 'u_texture');
  const resolveHiSizeLoc = gl.getUniformLocation(resolveProgram, 'u_hiSize');

  // Fullscreen quad
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1,  1,  1,  1
  ]), gl.STATIC_DRAW);

  // ---------------------
  // SSAA setup (2x)
  // ---------------------
  const supersampleFactor = 2; // increase to 3 for extra smoothing (costs performance)
  let fb, fbTex, hiW = 0, hiH = 0;

  function setupFramebuffer() {
    // Clean up old
    if (fbTex) gl.deleteTexture(fbTex);
    if (fb) gl.deleteFramebuffer(fb);

    // Create hi-res color texture
    fbTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Use NEAREST so our manual 2x2 resolve is exact
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, hiW, hiH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // Create framebuffer and attach
    fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0);

    // Unbind
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---------------------
  // HiDPI resize
  // ---------------------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = Math.max(1, Math.floor(canvas.clientWidth || canvas.offsetWidth || 0));
    const cssH = Math.max(1, Math.floor(canvas.clientHeight || canvas.offsetHeight || 0));
    const outW = Math.max(1, Math.floor(cssW * dpr));
    const outH = Math.max(1, Math.floor(cssH * dpr));

    // Low-res (display) buffer
    if (canvas.width !== outW || canvas.height !== outH) {
      canvas.width = outW;
      canvas.height = outH;
    }

    // Hi-res (SSAA) buffer
    const newHiW = outW * supersampleFactor;
    const newHiH = outH * supersampleFactor;
    if (hiW !== newHiW || hiH !== newHiH) {
      hiW = newHiW;
      hiH = newHiH;
      setupFramebuffer();
    }
  }

  // ---------------------
  // Animation timing (hover-to-slow)
  // ---------------------
  let animTime = 0.0;
  let lastRealTime = performance.now() * 0.001;
  let currentSpeed = 1.0;
  let targetSpeed = 1.0;
  const SPEED_SMOOTH_TAU = 0.25;

  const hoverEl = document.querySelector('header');
  if (hoverEl) {
    const onEnter = () => { targetSpeed = 0.2; };
    const onLeave = () => { targetSpeed = 1.0; };
    hoverEl.addEventListener('pointerenter', onEnter);
    hoverEl.addEventListener('pointerleave', onLeave);
    hoverEl.addEventListener('mouseenter', onEnter);
    hoverEl.addEventListener('mouseleave', onLeave);
  }

  // ---------------------
  // Render loop
  // ---------------------
  function render() {
    resize();

    // Time step
    const now = performance.now() * 0.001;
    let dt = now - lastRealTime;
    lastRealTime = now;
    dt = Math.max(0.0, Math.min(dt, 0.05));

    // Smooth speed
    const blend = 1.0 - Math.exp(-dt / SPEED_SMOOTH_TAU);
    currentSpeed += (targetSpeed - currentSpeed) * blend;
    animTime += dt * currentSpeed;

    // PASS 1: render scene to hi-res framebuffer (linear color)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, hiW, hiH);
    gl.useProgram(sceneProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(scenePosLoc);
    gl.vertexAttribPointer(scenePosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(sceneResLoc, hiW, hiH);
    gl.uniform1f(sceneTimeLoc, animTime * SHADER_SPEED);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // PASS 2: resolve to canvas with gamma-correct 2x2 average
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(resolveProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(resolvePosLoc);
    gl.vertexAttribPointer(resolvePosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbTex);
    gl.uniform1i(resolveTexLoc, 0);
    gl.uniform2f(resolveHiSizeLoc, hiW, hiH);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(render);
  }

  render();
})();
