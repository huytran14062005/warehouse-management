import { useCallback, useEffect, useRef, useState } from "react";

// Keeps notification messages retriggerable even when the same text is shown twice.
export default function useNotificationState(initialMessage = "") {
  const [message, setMessage] = useState(initialMessage);
  const nextMessageTimer = useRef(null);

  const notify = useCallback((nextMessage) => {
    if (nextMessageTimer.current) {
      window.clearTimeout(nextMessageTimer.current);
      nextMessageTimer.current = null;
    }
    setMessage("");
    if (nextMessage) {
      nextMessageTimer.current = window.setTimeout(() => {
        setMessage(String(nextMessage));
        nextMessageTimer.current = null;
      }, 0);
    }
  }, []);

  useEffect(() => () => {
    if (nextMessageTimer.current) window.clearTimeout(nextMessageTimer.current);
  }, []);

  return [message, notify];
}
