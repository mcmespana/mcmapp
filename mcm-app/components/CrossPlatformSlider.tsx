import React from 'react';
import { Platform } from 'react-native';

interface SliderProps {
  style: any;
  minimumValue: number;
  maximumValue: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
}

const CrossPlatformSlider: React.FC<SliderProps> = ({
  minimumValue,
  maximumValue,
  step,
  value,
  onValueChange,
}) => {
  if (Platform.OS === 'web') {
    return (
      <div style={{ width: '100%', position: 'relative' }}>
        <style>{`
          .custom-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 8px;
            border-radius: 4px;
            background: #ddd;
            outline: none;
            opacity: 0.8;
            transition: opacity 0.2s;
            cursor: pointer;
          }
          
          .custom-slider:hover {
            opacity: 1;
          }
          
          .custom-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #253883;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          
          .custom-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #253883;
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          
          .custom-slider::-webkit-slider-track {
            width: 100%;
            height: 8px;
            cursor: pointer;
            background: #ddd;
            border-radius: 4px;
          }
          
          .custom-slider::-moz-range-track {
            width: 100%;
            height: 8px;
            cursor: pointer;
            background: #ddd;
            border-radius: 4px;
            border: none;
          }
        `}</style>
        <input
          type="range"
          min={minimumValue}
          max={maximumValue}
          step={step}
          value={value}
          onChange={(e) => onValueChange(parseFloat(e.target.value))}
          aria-label="Scroll speed control"
          className="custom-slider"
        />
      </div>
    );
  }

  // For now, we'll use a web-compatible approach for all platforms
  // This avoids the import issues with @react-native-community/slider
  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <style>{`
        .custom-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: #ddd;
          outline: none;
          opacity: 0.8;
          transition: opacity 0.2s;
          cursor: pointer;
        }
        
        .custom-slider:hover {
          opacity: 1;
        }
        
        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #253883;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .custom-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #253883;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .custom-slider::-webkit-slider-track {
          width: 100%;
          height: 8px;
          cursor: pointer;
          background: #ddd;
          border-radius: 4px;
        }
        
        .custom-slider::-moz-range-track {
          width: 100%;
          height: 8px;
          cursor: pointer;
          background: #ddd;
          border-radius: 4px;
          border: none;
        }
      `}</style>
      <input
        type="range"
        min={minimumValue}
        max={maximumValue}
        step={step}
        value={value}
        onChange={(e) => onValueChange(parseFloat(e.target.value))}
        aria-label="Scroll speed control"
        className="custom-slider"
      />
    </div>
  );
};

export default CrossPlatformSlider;
