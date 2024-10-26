const LoadingIcon = ({ size = "4" }: { size?: string }) => {
  return (
    <div
      className={`animate-spin h-${size} w-${size} border-b-2 border-content rounded-full`}
    ></div>
  );
};

export default LoadingIcon;
