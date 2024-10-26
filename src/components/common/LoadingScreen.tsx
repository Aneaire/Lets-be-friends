import LoadingIcon from "./LoadingIcon";

const LoadingScreen = () => {
  return (
    <div className=" w-full h-screen flex-center flex-col">
      <img
        className=" w-2/12"
        src="/images/screen-logo.svg"
        alt="Screen Logo"
      />
      <span className=" mt-10">
        <LoadingIcon size="10" />
      </span>
    </div>
  );
};

export default LoadingScreen;
