const gl = c.getContext("webgl");
c.width = innerWidth;
c.height = innerHeight;
gl.viewport(0, 0, c.width, c.height);

const vs = `
attribute vec2 p;
void main() {
  gl_Position = vec4(p, 0, 1);
}`;

// noise copied from https://github.com/stegu/webgl-noise
const noiseShader = `
// Modulo 289 without a division (only multiplications)
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 permute(vec3 x) {
  return mod289(((x*34.0)+10.0)*x);
}

float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}`;

const fs = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
${noiseShader}

vec3 adjustSaturation(vec3 color, float value) {
  const vec3 luminosityFactor = vec3(0.2126, 0.7152, 0.0722);
  vec3 grayscale = vec3(dot(color, luminosityFactor));
  return mix(grayscale, color, 1.0 + value);
}

vec3 white = vec3(1.0,1.0,1.0);
vec3 black = vec3(0.0,0.0,0.0);
vec3 orange = vec3(0.9255, 0.3882, 0.0745);
vec3 lower_color_1 = vec3(1.0, 0.7, 0.5);
vec3 lower_color_2 = vec3(1.0, 1.0, 0.9);
float S = 40.0;

float PI = 3.14;

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  float y = fragCoord.y;
  float x = fragCoord.x;
  float t = y / (u_resolution.y - 1.0);
  float MID_Y = u_resolution.y * 0.5;

  float A = 80.0 * (1.0 + sin(u_time));
  float L = 1.0;
  float Hz = 0.01;
  float curve_y = MID_Y + sin((x + u_time * S) * Hz) * A;
     
  curve_y += snoise(vec2(x * L * 10.0, u_time)) * A * 0.01;
  curve_y += snoise(vec2(x * L * 10.0, u_time)) * A * 0.05;

  float verticalAmp = u_resolution.y * 0.5;
  float phase = u_time * 0.5;
  
  // make the wave go up and down
  float deltaY = y + sin(y/u_resolution.y * PI * 2.0 * 0.5 + phase) * verticalAmp;
  float dist = curve_y - (deltaY);
  float alpha = (sign(dist) + 1.0) / 2.0;
  
  vec3 color_1 = orange;
  vec3 color_2 = black;
  lower_color_1 = white;
  lower_color_2 = black;

  float saturationSpeed = 0.69; // 8)
  float saturationAmount = sin(u_time * saturationSpeed) * 0.5;

  if(x >= u_resolution.x*0.3 && x <= u_resolution.x*0.7){
    color_1 = white;
    color_2 = orange;
    lower_color_1 = orange;
    lower_color_2 = orange;
  }else if(x > u_resolution.x*0.7){
    color_1 = orange;
    color_2 = black;
    lower_color_1 = black;
    lower_color_2 = black;
  }

  if(color_1 == orange) {
    color_1 = adjustSaturation(color_1, saturationAmount);
  }
  if(color_2 == orange) {
    color_2 = adjustSaturation(color_2, saturationAmount);
  }
  
  
  vec3 upper_color = mix(color_1, color_1, t);
  vec3 lower_color = mix(lower_color_1, lower_color_2, 1.0);
  
  vec3 color = mix(upper_color, lower_color, alpha);
  
  gl_FragColor = vec4(color, 1.0);
}`;

function compile(type, src) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  return shader;
}

let prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog);
gl.useProgram(prog);

const u_resolution = gl.getUniformLocation(prog, "u_resolution");
gl.uniform2f(u_resolution, c.width, c.height);

let buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
  gl.STATIC_DRAW
);
let loc = gl.getAttribLocation(prog, "p");
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

let u_time = gl.getUniformLocation(prog, "u_time");
function raf(t) {
  gl.uniform1f(u_time, t * 0.001);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  requestAnimationFrame(raf);
}
raf(0);
