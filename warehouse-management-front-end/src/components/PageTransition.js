import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

function PageTransition({ children }) {
  const { pathname, key } = useLocation();
  const navigationType = useNavigationType();
  const previousHistoryIndex = useRef(window.history.state?.idx ?? 0);
  const currentHistoryIndex = window.history.state?.idx ?? 0;
  const isBackNavigation =
    navigationType === "POP" && currentHistoryIndex < previousHistoryIndex.current;

  useLayoutEffect(() => {
    previousHistoryIndex.current = currentHistoryIndex;
    if (process.env.NODE_ENV !== "test") {
      window.scrollTo(0, 0);
    }
  }, [pathname, currentHistoryIndex]);

  return (
    <div
      key={key}
      className={`page-transition page-transition--${isBackNavigation ? "back" : "forward"}`}
    >
      {children}
    </div>
  );
}

export default PageTransition;
