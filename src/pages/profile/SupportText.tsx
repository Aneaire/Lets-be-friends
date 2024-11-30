import React from "react";

const SupportText = React.memo(({ text }: { text: string }) => {
  const [toggleText, setToggleText] = React.useState(false);

  return (
    <span className=" flex gap-1.5">
      ~
      <p
        onClick={() => setToggleText((prev) => !prev)}
        className={`${toggleText ? "" : "line-clamp-2"} cursor-pointer text-sm font-regular`}
      >
        {text}
      </p>
    </span>
  );
});

export default SupportText;
