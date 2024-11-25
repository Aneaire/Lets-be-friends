import autoAnimate from "@formkit/auto-animate";
import { ReactNode, useLayoutEffect, useRef } from "react";

const GridPostContainer = ({ children }: { children: ReactNode }) => {
  const parent = useRef(null);
  useLayoutEffect(() => {
    parent.current && autoAnimate(parent.current);
  }, [parent]);
  return (
    <ul ref={parent} className=" grid-container">
      {children}
    </ul>
  );
};

export default GridPostContainer;
