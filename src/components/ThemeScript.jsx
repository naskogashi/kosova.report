// Theme runtime, inlined before first paint so there is no flash of the wrong theme.
// Modes: "auto" (light by day, dark between sunset and sunrise in Prishtina),
// "light", "dark", "sun" (high contrast). Light is the default and the no-JS fallback.
// Sun times use the standard sunrise equation for the city's coordinates, so no
// location permission is needed. `?theme=light|dark|sun` previews a mode for one page view without saving it.
const script = `(function(){var L=42.6629,G=21.1655,d=document.documentElement;
function night(t){var r=Math.PI/180,J=t/864e5+2440587.5,n=Math.ceil(J-2451545+8e-4),s=n-G/360,M=(357.5291+.98560028*s)%360,C=1.9148*Math.sin(M*r)+.02*Math.sin(2*M*r)+3e-4*Math.sin(3*M*r),l=(M+C+282.9372)%360,T=2451545+s+.0053*Math.sin(M*r)-.0069*Math.sin(2*l*r),D=Math.asin(Math.sin(l*r)*Math.sin(23.4397*r)),w=Math.acos((Math.sin(-.833*r)-Math.sin(L*r)*Math.sin(D))/(Math.cos(L*r)*Math.cos(D)))/r/360,f=function(j){return(j-2440587.5)*864e5};return t<f(T-w)||t>f(T+w)}
function mode(){var q=/[?&]theme=(auto|light|dark|sun)\\b/.exec(location.search);if(q)return q[1];try{var m=localStorage.getItem('kr-theme');if(m)return m;if(localStorage.getItem('kr-contrast')==='sun')return'sun'}catch(e){}return'auto'}
function apply(m){m=m||mode();var dark=m==='dark'||(m==='auto'&&night(Date.now()));d.dataset.theme=dark?'dark':'light';if(m==='sun')d.dataset.contrast='sun';else delete d.dataset.contrast;d.dataset.themeMode=m;try{localStorage.setItem('kr-theme-applied',dark?'dark':'light')}catch(e){}var c=document.querySelector('meta[name="theme-color"]');if(c)c.content=dark?'#09172b':'#f6f9fd';window.dispatchEvent(new Event('kr:theme'))}
window.krTheme={apply:apply,mode:mode,night:function(){return night(Date.now())},set:function(m){try{localStorage.setItem('kr-theme',m)}catch(e){}apply(m)}};apply();setInterval(function(){if(mode()==='auto')apply()},6e4)})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
