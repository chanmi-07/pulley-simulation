import React, { FC } from "react";

interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (newValue: number) => void;
}

const WeightSlider: FC<WeightSliderProps> = (weightSliderProps) => {
    const { label, value, onChange } = weightSliderProps;
    return (
    <div>
      <label>{label}: {value} kg</label>
      <input
        type="range"
        min="1"
        max="50"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default WeightSlider;