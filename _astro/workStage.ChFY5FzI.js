function e(e,t,n){let r=e.createShader(t);if(!r)throw Error(`shader`);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`shader: ${t}`)}return r}function t(e){let t=e.replace(`#`,``).trim(),n=parseInt(t.length===3?t.replace(/./g,e=>e+e):t,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function n(e,t){return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}var r=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};function i(i,a,o,s={}){let c={alpha:!1,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,powerPreference:`high-performance`},l=null;try{l=i.getContext(`webgl2`,c)||i.getContext(`webgl`,c)}catch{l=null}if(!l)return null;let u;try{if(u=l.createProgram(),l.attachShader(u,e(l,l.VERTEX_SHADER,`
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  // y runs down, so uv matches the image's row order and the pointer's frame.
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`)),l.attachShader(u,e(l,l.FRAGMENT_SHADER,`
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_a;
uniform sampler2D u_b;
uniform float u_readyA;
uniform float u_readyB;
uniform float u_mix;     // 0 = A, 1 = B
uniform float u_time;
uniform vec2  u_res;
uniform float u_vel;     // -1..1, normalised scroll speed, sign = direction
uniform vec2  u_mouse;   // uv; far off-canvas when absent
uniform float u_hover;   // 0..1
uniform vec3  u_rose;
uniform vec3  u_ground;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = p * 2.07 + vec2(3.1, 1.7);
    amp *= 0.5;
  }
  return v;
}

// A plate, sampled with its channels pulled slightly apart along \`split\`.
vec3 plate(sampler2D tex, float ready, vec2 uv, vec2 split) {
  if (ready < 0.5) return u_ground;
  float r = texture2D(tex, uv + split).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv - split).b;
  return vec3(r, g, b);
}

void main() {
  float asp = u_res.x / u_res.y;
  vec2 uv = v_uv;

  /* Scroll: the glass bows with velocity — the centre lags the edges in the
     direction of travel, and the whole plate squashes a touch. */
  float k = u_vel;
  uv.y -= cos((uv.x - 0.5) * 3.14159) * k * 0.022;
  uv.y = 0.5 + (uv.y - 0.5) * (1.0 + abs(k) * 0.05);

  /* Pointer: a soft lens. Sampling coordinates draw in toward the pointer,
     so the picture swells gently under it. */
  vec2 dm = (uv - u_mouse) * vec2(asp, 1.0);
  float md = length(dm);
  float lens = smoothstep(0.36, 0.0, md) * u_hover;
  uv -= dm / vec2(asp, 1.0) * lens * 0.11;

  /* The front. A diagonal, bent by noise that drifts slowly so a slow scrub
     still reads as ink moving rather than a mask sliding. */
  vec2 q = vec2(uv.x * asp, uv.y);
  float n1 = fbm(q * 1.6 + vec2(u_time * 0.04, -u_time * 0.03));
  float n2 = fbm(q * 3.1 + vec2(-u_time * 0.02, u_time * 0.05) + 11.0);
  const float W = 0.2;
  float field = uv.x * 0.78 + uv.y * 0.22 + (n1 - 0.5) * 0.7;
  // The sweep has to start past the field's lowest value and end past its
  // highest, or B leaks in at mix 0 and A lingers at mix 1.
  float edge = mix(-0.42 - W, 1.42 + W, u_mix);
  float m = 1.0 - smoothstep(edge - W, edge + W, field);   // 1 where B has arrived
  float band = 1.0 - smoothstep(0.0, W, abs(field - edge)); // 1 at the front
  float hot = u_mix * (1.0 - u_mix) * 4.0;                  // 0 at rest, 1 mid-wipe

  vec2 disp = vec2(n1 - 0.5, n2 - 0.5) * band * 0.065;
  vec2 split = disp * 0.35 + vec2(0.0, k * 0.004);

  /* Depth: the plate leaving pushes away from the reader, the one arriving
     settles in from slightly larger. A small overscan at rest keeps the
     bow and the lens from ever showing an edge. */
  float sA = 1.05 + u_mix * 0.06;
  float sB = 1.13 - u_mix * 0.08;
  vec2 uvA = (uv - 0.5) / sA + 0.5 + disp;
  vec2 uvB = (uv - 0.5) / sB + 0.5 - disp;

  vec3 a = plate(u_a, u_readyA, uvA, split);
  vec3 b = plate(u_b, u_readyB, uvB, split);
  vec3 col = mix(a, b, m);

  /* The front itself: ink darkens it, and a thin rose light rides its
     leading edge — the one accent, kept to a line rather than a wash, and
     only while the wipe is in flight. */
  float lip = 1.0 - smoothstep(0.0, W * 0.24, abs(field - edge));
  col *= 1.0 - band * 0.3 * hot;
  col += u_rose * pow(lip, 3.0) * 0.45 * hot;

  /* Vignette, the lens's sheen, and grain. */
  float d = length((v_uv - 0.5) * vec2(1.0, 1.25));
  col *= 1.0 - smoothstep(0.42, 0.98, d) * 0.3;
  col += vec3(0.05) * lens;
  col += (hash(gl_FragCoord.xy + fract(u_time) * 17.0) - 0.5) * 0.04;

  gl_FragColor = vec4(col, 1.0);
}
`)),l.linkProgram(u),!l.getProgramParameter(u,l.LINK_STATUS))throw Error(`link`)}catch{return l.getExtension(`WEBGL_lose_context`)?.loseContext(),null}l.useProgram(u);let d=l.createBuffer();l.bindBuffer(l.ARRAY_BUFFER,d),l.bufferData(l.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),l.STATIC_DRAW);let f=l.getAttribLocation(u,`a_pos`);l.enableVertexAttribArray(f),l.vertexAttribPointer(f,2,l.FLOAT,!1,0,0);let p={a:l.getUniformLocation(u,`u_a`),b:l.getUniformLocation(u,`u_b`),readyA:l.getUniformLocation(u,`u_readyA`),readyB:l.getUniformLocation(u,`u_readyB`),mix:l.getUniformLocation(u,`u_mix`),time:l.getUniformLocation(u,`u_time`),res:l.getUniformLocation(u,`u_res`),vel:l.getUniformLocation(u,`u_vel`),mouse:l.getUniformLocation(u,`u_mouse`),hover:l.getUniformLocation(u,`u_hover`),rose:l.getUniformLocation(u,`u_rose`),ground:l.getUniformLocation(u,`u_ground`)};l.uniform1i(p.a,0),l.uniform1i(p.b,1),l.uniform3f(p.ground,.067,.051,.082),l.disable(l.DEPTH_TEST),l.disable(l.BLEND);function m(){let e=t(n(`--color-rose`,document.documentElement.dataset.theme===`light`?`#bd3d5c`:`#cb4a68`));l.uniform3f(p.rose,e[0],e[1],e[2])}m();let h=new MutationObserver(m);h.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let g=o.map(()=>({still:null,stillLoading:!1,videoTex:null,live:!1,videoFailed:!1,wired:!1,lastTime:-1})),_=o.length,v=!1;function y(){let e=l.createTexture();return l.bindTexture(l.TEXTURE_2D,e),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_S,l.CLAMP_TO_EDGE),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_WRAP_T,l.CLAMP_TO_EDGE),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_MIN_FILTER,l.LINEAR),l.texParameteri(l.TEXTURE_2D,l.TEXTURE_MAG_FILTER,l.LINEAR),e}function b(e){let t=g[e],n=o[e]?.still;if(!t||!n||t.still||t.stillLoading)return;t.stillLoading=!0;let r=new Image;r.decoding=`async`,r.onload=()=>{let e=()=>{if(v)return;let e=y();l.texImage2D(l.TEXTURE_2D,0,l.RGBA,l.RGBA,l.UNSIGNED_BYTE,r),t.still=e,H()};r.decode?r.decode().then(e,e):e()},r.onerror=()=>{t.stillLoading=!1},r.src=n}function x(e){let t=g[e],n=o[e]?.video;if(t&&n&&!t.videoFailed){if(!t.wired){t.wired=!0;let e=n.dataset.src;!n.src&&e&&(n.src=e,n.load()),n.addEventListener(`playing`,()=>{t.live=!0,H()});let r=()=>{t.live=!1};n.addEventListener(`pause`,r),n.addEventListener(`waiting`,r),n.addEventListener(`emptied`,r),n.addEventListener(`error`,()=>{t.live=!1,t.videoFailed=!0},{once:!0})}n.paused&&n.play().catch(()=>{t.live=!1})}}function S(e){let t=o[e]?.video;t&&!t.paused&&t.pause()}function C(e){let t=g[e],n=o[e]?.video;if(!t||!n||!t.live||n.readyState<2)return!1;if(n.currentTime===t.lastTime)return!0;t.lastTime=n.currentTime,t.videoTex?l.bindTexture(l.TEXTURE_2D,t.videoTex):t.videoTex=y();try{l.texImage2D(l.TEXTURE_2D,0,l.RGBA,l.RGBA,l.UNSIGNED_BYTE,n)}catch{return t.live=!1,!1}return!0}function w(e,t){let n=g[t];return n?(l.activeTexture(l.TEXTURE0+e),n.live&&C(t)&&n.videoTex?(l.bindTexture(l.TEXTURE_2D,n.videoTex),!0):n.still?(l.bindTexture(l.TEXTURE_2D,n.still),!0):!1):!1}let T=0,E=0,D=1,O=0,k=0,A=0,j=0,M=-10,N=-10,P=!1,F=0,I=!1,L=!1,R=!1,z=!0,B=0,V=performance.now();function H(){z=!0,G()}function U(){let e=i.getBoundingClientRect(),t=Math.max(1,Math.round(e.width)),n=Math.max(1,Math.round(e.height)),r=Math.min(devicePixelRatio||1,1.5);(t!==T||n!==E||r!==D)&&(T=t,E=n,D=r,i.width=Math.round(t*r),i.height=Math.round(n*r),l.viewport(0,0,i.width,i.height),l.uniform2f(p.res,i.width,i.height),z=!0)}function W(e){if(!L)return;B=requestAnimationFrame(W),U();let t=O-k;Math.abs(t)>5e-4?(k+=t*.24,z=!0):k!==O&&(k=O,z=!0),A*=.9,Math.abs(A)<.002&&(A=0);let n=A-j;Math.abs(n)>.001?(j+=n*(Math.abs(A)>Math.abs(j)?.2:.06),z=!0):j!==A&&(j=A,z=!0);let i=+!!P-F;Math.abs(i)>.002?(F+=i*.1,z=!0):F!==+!!P&&(F=+!!P,z=!0);let o=Math.min(_-1,Math.max(0,Math.floor(k))),s=Math.min(_-1,o+1),c=r(.22,.78,s===o?0:k-o);b(o),b(s),b(o-1),b(s+1);for(let e=0;e<_;e++)e===o||e===s?x(e):S(e);let u=c<.999,d=c>.001;if((u&&g[o].live||d&&g[s].live||F>.001)&&(z=!0),!z)return;z=!1;let f=u?w(0,o):!1,m=d?w(1,s):!1;l.uniform1f(p.readyA,+!!f),l.uniform1f(p.readyB,+!!m),l.uniform1f(p.mix,c),l.uniform1f(p.time,(e-V)/1e3),l.uniform1f(p.vel,j),l.uniform2f(p.mouse,M,N),l.uniform1f(p.hover,F),l.drawArrays(l.TRIANGLES,0,3),!R&&(f||m)&&(R=!0,a.classList.add(`is-ready`))}function G(){let e=I&&!document.hidden&&!v;if(e&&!L)L=!0,z=!0,B=requestAnimationFrame(W);else if(!e&&L){L=!1,cancelAnimationFrame(B);for(let e=0;e<_;e++)S(e)}}let K=new IntersectionObserver(e=>{I=e.some(e=>e.isIntersecting),G()},{rootMargin:`10% 0px`});K.observe(a);let q=()=>G();document.addEventListener(`visibilitychange`,q);let J=e=>{let t=i.getBoundingClientRect();M=(e.clientX-t.left)/Math.max(1,t.width),N=(e.clientY-t.top)/Math.max(1,t.height),P=!0,z=!0},Y=()=>{P=!1,z=!0};a.addEventListener(`pointermove`,J,{passive:!0}),a.addEventListener(`pointerleave`,Y);let X=e=>{e.preventDefault(),Z(),s.onLost?.()};i.addEventListener(`webglcontextlost`,X);function Z(){if(!v){v=!0,L=!1,cancelAnimationFrame(B),K.disconnect(),h.disconnect(),document.removeEventListener(`visibilitychange`,q),a.removeEventListener(`pointermove`,J),a.removeEventListener(`pointerleave`,Y),i.removeEventListener(`webglcontextlost`,X),a.classList.remove(`is-ready`);for(let e=0;e<_;e++)S(e);l.isContextLost()||(g.forEach(e=>{e.still&&l.deleteTexture(e.still),e.videoTex&&l.deleteTexture(e.videoTex)}),l.deleteBuffer(d),l.deleteProgram(u),l.getExtension(`WEBGL_lose_context`)?.loseContext())}}return{setProgress(e){O=Math.min(_-1,Math.max(0,e)),H()},setVelocity(e){A=Math.max(-1,Math.min(1,e/2600)),H()},destroy:Z}}export{i as mountWorkStage};