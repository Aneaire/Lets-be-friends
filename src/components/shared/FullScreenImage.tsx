import React, { useState } from "react";

const FullScreenImage = ({ children }: any) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <>
      {" "}
      {/* Render the children */}
      {React.cloneElement(children, {
        onClick: toggleFullScreen, // Add onClick event to toggle fullscreen
      })}
      <div className="relative">
        {/* Render fullscreen image if isFullScreen is true */}
        {isFullScreen && (
          <div
            className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-90 flex justify-center items-center z-50 p-5 "
            onClick={toggleFullScreen}
          >
            {/* Clone the children to show fullscreen */}
            {React.cloneElement(children, {
              className: "max-w-full max-h-full",
            })}
            <button
              className="absolute top-4 right-4 text-white text-lg bg-gray-800 bg-opacity-50 px-4 py-2 rounded-lg"
              onClick={toggleFullScreen}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default FullScreenImage;
