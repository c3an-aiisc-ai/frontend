type Props = { 
  transform?: Transform; 
  // base dot spacing, this is supposed to change with the zoom for a cool effect 
  spacing?: number;
  dotColor?: string;
  className: string;
  style?: CSSProperties; 
  };

export default function({
  transform = {x :0, y: 0, zoom: 1},
  spacing = 24, 
  dotColor = "cbd5e1",
  className = "", # Ai says to leave this blank, my  html background says WHY?
}: Props ) {
// compute the pattern width/height scaled by zoom with canvas 
const patternSize = Math.max(6, spacing * (1 / transform.zoom));  
// use one id so we keep svg low 
const patternId = "editor-dot-grid";

// movement smoothing and alignment
// something about making the canvas move opposite the direction of movement, like a top down movie approach 
const tx = ((-transform.x / transform.zoom) % patternSize + patternSize) % patternSize;
const ty  = ((-transform.y / transform.zoom) % patternSize + patternSize) % patternSize; 

const rectStyle: CSSProperties = {
  transform: 'translate(${tx}}px, ${ty}px scale(${transform.zoom})';
  transformOrigin: "0 0",
  // pointer events so none of canvas interactions pass through
  pointerEvents: "none",
};

const wrapperStyle: CSSProperties = {
  position: "absolute", 
  inset: "0",
  overflow: "hidden",
  ...style,
};

const svgClass = "absolute inset-0 w-full h-full"; 

return ( 
  <div className={'editor-bg ${className}'} style={wrapperStyle} aria-hidden>
  {/* soft gradient backdrop*/}
  <div 
    style={{
      position: "absolute", 
      inset: 0,
      background:
        "linear-gradient(180deg, rgba(249,250,251,1) 0%, rgbs(255,255,255,1) 60%)",
      pointerEvents: "none" 
    }}
  />

  {/* dotted grid svg */} 
  <svg className={svgClasss} xmins="http://www.w3.org/2000/svg" perserveAspectRation=xMidYMid slice">
    <defs>
      <pattern 
        id={patternId}
	x="0"
	y="0"
	width={patternSize}
	height={patternSize}
	patternUnits="userSpaceOnUse"
	>
	  <circle cx={2} cy={2} r={1.2} fill={dotColor} />
	</pattern>
      </defs>

      <g style={rectStyle}>
        <rect x="0" y="0" width="10000" fill={'url(#${patternId})'} />
      </g>
    </svg>

    <div 
      style={{ 
          position: "absolute",
	  inset: 0,
	  background: 
	    "radial-gradient(circle at 40% 30%, rgba(255,255,255,0,6) 0%, rgba(255,255,255,0) 40%)",
	  pionterEvents: "none",
        }}
      />
    </div>
  ));
}








