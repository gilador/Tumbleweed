import React from "react";

interface SplitScreenProps {
  id?: string;
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  leftWidth?: string;
  rightWidth?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const SplitScreen: React.FC<SplitScreenProps> = ({
  leftPanel,
  rightPanel,
  leftWidth = "30%",
  rightWidth = "70%",
  className = "",
  style,
}) => {
  return (
    <div
      className={`flex flex-col md:flex-row gap-2 md:gap-4 w-full h-full ${className}`}
      style={style}
    >
      <div
        className="w-full md:w-auto h-full flex flex-col min-h-0"
        style={{ width: leftWidth }}
        id="left-panel"
      >
        {leftPanel}
      </div>
      <div
        className="w-full md:w-auto h-full flex flex-col min-h-0"
        style={{ width: rightWidth }}
        id="right-panel"
      >
        {rightPanel}
      </div>
    </div>
  );
};
