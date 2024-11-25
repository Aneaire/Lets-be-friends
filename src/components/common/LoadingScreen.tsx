import LoadingIcon from "./LoadingIcon";

const LoadingScreen = ({
  set = "with-logo",
}: {
  set?: "with-logo" | "without-logo";
}) => {
  return (
    <div className=" w-full h-screen flex-center flex-col">
      {set === "with-logo" && (
        <img
          className=" w-2/12 min-w-[200px]"
          src="/images/screen-logo.svg"
          alt="Screen Logo"
        />
      )}
      <span className=" mt-10">
        <LoadingIcon size="10" />
      </span>
    </div>
  );
};

export default LoadingScreen;
