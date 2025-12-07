import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  baseline?: number;
  className?: string;
}

export function Sparkline({ 
  data, 
  width = 80, 
  height = 24, 
  color = 'var(--df-primary)', 
  baseline = 100,
  className = '' 
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div 
        className={className}
        style={{ width: `${width}px`, height: `${height}px` }} 
      />
    );
  }

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1; // Avoid division by zero
  
  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - minValue) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Generate baseline line if provided
  const baselineY = baseline !== undefined 
    ? height - ((baseline - minValue) / range) * height 
    : null;

  return (
    <div className={className} style={{ width: `${width}px`, height: `${height}px` }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Baseline */}
        {baselineY !== null && baselineY >= 0 && baselineY <= height && (
          <line
            x1="0"
            y1={baselineY}
            x2={width}
            y2={baselineY}
            stroke="var(--df-border)"
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.5"
          />
        )}
        
        {/* Sparkline */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Points */}
        {data.map((value, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - ((value - minValue) / range) * height;
          const isAboveBaseline = baseline !== undefined ? value > baseline : false;
          
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2"
              fill={isAboveBaseline ? 'var(--df-warning)' : 'var(--df-success)'}
              opacity="0.8"
            />
          );
        })}
      </svg>
    </div>
  );
}