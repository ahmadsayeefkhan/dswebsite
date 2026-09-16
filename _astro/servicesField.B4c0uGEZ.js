function e(e,t,n){let r=e.createShader(t);if(!r)throw Error(`shader`);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`shader: ${t}`)}return r}function t(e){let t=e.replace(`#`,``).trim(),n=parseInt(t.length===3?t.replace(/./g,e=>e+e):t,16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function n(e,t){return getComputedStyle(document.documentElement).getPropertyValue(e).trim()||t}function r(r,i){let a=r.getContext(`webgl2`,{alpha:!0,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!0,powerPreference:`low-power`})||r.getContext(`webgl`,{alpha:!0,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!0});if(!a)return null;let o;try{if(o=a.createProgram(),a.attachShader(o,e(a,a.VERTEX_SHADER,`
precision highp float;

attribute vec4 a_seed;   // x, y in 0..1 · size · phase

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_head;
uniform vec2  u_mouse;
uniform float u_scroll;  // accumulated scroll offset, px
uniform float u_vel;     // normalised scroll speed 0..1
uniform float u_dpr;

varying float v_glow;
varying float v_alpha;

void main() {
  // Base position: the field scrolls at a fraction of the page, so it reads
  // as depth behind the content rather than as paint on it.
  float y0 = a_seed.y * u_res.y - u_scroll * 0.18;
  y0 = mod(y0, u_res.y + 80.0) - 40.0;
  vec2 p = vec2(a_seed.x * u_res.x, y0);

  // Idle drift, phase-shifted per mote so the field never breathes in unison.
  float ph = a_seed.w * 6.2831;
  p.x += sin(u_time * 0.21 + ph) * 14.0 + cos(u_time * 0.09 + ph * 1.7) * 6.0;
  p.y += cos(u_time * 0.17 + ph * 1.3) * 11.0;

  // The comet gathers the field. Pull is soft and wide, so the motes lean in
  // rather than snap.
  vec2 toHead = u_head - p;
  float dh = length(toHead);
  float pull = smoothstep(340.0, 0.0, dh);
  p += toHead * pull * 0.34;

  // The cursor parts it.
  vec2 fromMouse = p - u_mouse;
  float dm = length(fromMouse);
  float push = smoothstep(150.0, 0.0, dm);
  p += normalize(fromMouse + 0.001) * push * 46.0;

  v_glow  = smoothstep(300.0, 20.0, dh);
  v_alpha = 0.11 + a_seed.z * 0.2 + v_glow * 0.55 + u_vel * 0.12;

  vec2 clip = (p / u_res) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = (1.4 + a_seed.z * 2.2 + v_glow * 2.6) * u_dpr;
}
`)),a.attachShader(o,e(a,a.FRAGMENT_SHADER,`
precision mediump float;

uniform vec3 u_bone;
uniform vec3 u_rose;

varying float v_glow;
varying float v_alpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float disc = smoothstep(0.5, 0.18, d);
  vec3 col = mix(u_bone, u_rose, v_glow);
  gl_FragColor = vec4(col, disc * v_alpha);
}
`)),a.linkProgram(o),!a.getProgramParameter(o,a.LINK_STATUS))throw Error(`link`)}catch{return a.getExtension(`WEBGL_lose_context`)?.loseContext(),null}a.useProgram(o);let s=new Float32Array(3600);for(let e=0;e<900;e++)s[e*4]=Math.random(),s[e*4+1]=Math.random(),s[e*4+2]=Math.random()**2.4,s[e*4+3]=Math.random();let c=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,c),a.bufferData(a.ARRAY_BUFFER,s,a.STATIC_DRAW);let l=a.getAttribLocation(o,`a_seed`);a.enableVertexAttribArray(l),a.vertexAttribPointer(l,4,a.FLOAT,!1,0,0);let u={res:a.getUniformLocation(o,`u_res`),time:a.getUniformLocation(o,`u_time`),head:a.getUniformLocation(o,`u_head`),mouse:a.getUniformLocation(o,`u_mouse`),scroll:a.getUniformLocation(o,`u_scroll`),vel:a.getUniformLocation(o,`u_vel`),dpr:a.getUniformLocation(o,`u_dpr`),bone:a.getUniformLocation(o,`u_bone`),rose:a.getUniformLocation(o,`u_rose`)};a.disable(a.DEPTH_TEST),a.enable(a.BLEND);let d=!0;function f(){d=document.documentElement.dataset.theme!==`light`;let e=t(n(d?`--color-bone`:`--color-slate`,d?`#ededed`:`#554e60`)),r=t(n(`--color-rose`,d?`#cb4a68`:`#bd3d5c`));a.uniform3f(u.bone,e[0],e[1],e[2]),a.uniform3f(u.rose,r[0],r[1],r[2]),d?a.blendFunc(a.SRC_ALPHA,a.ONE):a.blendFunc(a.SRC_ALPHA,a.ONE_MINUS_SRC_ALPHA)}f();let p=new MutationObserver(f);p.observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]});let m=0,h=0,g=1,_=0,v=0,y=-9999,b=-9999,x=-9999,S=-9999,C=0,w=0,T=0,E=window.scrollY,D=!1,O=!1,k=0,A=!1,j=performance.now();function M(){let e=r.getBoundingClientRect();_=e.left,v=e.top;let t=Math.max(1,Math.round(e.width)),n=Math.max(1,Math.round(e.height)),i=Math.min(devicePixelRatio||1,1.5);(t!==m||n!==h||i!==g)&&(m=t,h=n,g=i,r.width=Math.round(t*i),r.height=Math.round(n*i),a.viewport(0,0,r.width,r.height),a.uniform2f(u.res,t,n),a.uniform1f(u.dpr,i))}function N(e){if(!O)return;M();let t=window.scrollY;T+=t-E,E=t,w+=(C-w)*(C>w?.2:.05),a.uniform1f(u.time,(e-j)/1e3),a.uniform2f(u.head,y-_,b-v),a.uniform2f(u.mouse,x<-1e3?x:x-_,S<-1e3?S:S-v),a.uniform1f(u.scroll,T),a.uniform1f(u.vel,w),a.clearColor(0,0,0,0),a.clear(a.COLOR_BUFFER_BIT),a.drawArrays(a.POINTS,0,900),k=requestAnimationFrame(N)}function P(){let e=D&&!document.hidden&&!A;e&&!O?(O=!0,E=window.scrollY,k=requestAnimationFrame(N)):!e&&O&&(O=!1,cancelAnimationFrame(k))}let F=new IntersectionObserver(e=>{D=e.some(e=>e.isIntersecting),P()},{rootMargin:`10% 0px`});F.observe(i);let I=()=>P();document.addEventListener(`visibilitychange`,I);let L=e=>{x=e.clientX,S=e.clientY},R=()=>{x=-9999,S=-9999};return i.addEventListener(`pointermove`,L,{passive:!0}),i.addEventListener(`pointerleave`,R),r.parentElement?.classList.add(`is-live`),{setHead(e,t){y=e,b=t},setVelocity(e){C=Math.min(1,Math.abs(e)/2600)},destroy(){A||(A=!0,O=!1,cancelAnimationFrame(k),F.disconnect(),p.disconnect(),document.removeEventListener(`visibilitychange`,I),i.removeEventListener(`pointermove`,L),i.removeEventListener(`pointerleave`,R),r.parentElement?.classList.remove(`is-live`),a.deleteBuffer(c),a.deleteProgram(o),a.getExtension(`WEBGL_lose_context`)?.loseContext())}}}export{r as mountServicesField};