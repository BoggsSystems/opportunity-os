import React from 'react';

interface MetricProps {
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'amber' | 'red';
}

export const Metric: React.FC<MetricProps> = ({ label, value, tone }) => {
  return (
    <div className={`metric metric-${tone}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
};
