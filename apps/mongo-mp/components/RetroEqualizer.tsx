import React from 'react';

interface RetroEqualizerProps {
  bpm: number;
  isPlaying: boolean;
}

const RetroEqualizer: React.FC<RetroEqualizerProps> = ({ bpm, isPlaying }) => {
  // Convert BPM to animation duration in seconds
  const getDuration = (bpm: number) => {
    return (60 / bpm) * 2;
  };

  const barHeights = [120, 80, 140, 60, 100, 120, 40, 80, 140];
  const barColors = ['#FF3D3D', '#FF9F3D', '#FFE03D', '#48FF3D', '#3DCFFF', '#3D51FF', '#B03DFF', '#FF3DC3', '#FF3D3D'];

  return (
    <div className="bg-[#222] rounded-lg p-4">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" className="w-full max-w-xl">
        <rect width="400" height="200" fill="#2C2C2C"/>
        
        <g transform="translate(20, 180)">
          {barHeights.map((height, index) => (
            <rect
              key={index}
              x={index * 40}
              width="30"
              height={height}
              fill={barColors[index]}
              transform="scale(1, -1)"
            >
              {isPlaying && (
                <animate
                  attributeName="height"
                  values={`${height};40;${height}`}
                  dur={`${getDuration(bpm) * (0.8 + index * 0.05)}s`}
                  repeatCount="indefinite"
                />
              )}
            </rect>
          ))}
        </g>
        
        <rect width="400" height="100" fill="url(#gloss)" opacity="0.1"/>
        <defs>
          <linearGradient id="gloss" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="white" stopOpacity="0"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default RetroEqualizer;

