import { useState, useEffect } from "react";

const MESSAGES = [
  "Reading your knowledge...",
  "Understanding the content...",
  "Identifying key concepts...",
  "Generating UPSC-quality questions...",
  "Balancing difficulty...",
  "Finalizing your quiz...",
];

export function useTypingEffect() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      if (text.length < MESSAGES[messageIndex].length) {
        timeout = setTimeout(() => {
          setText(MESSAGES[messageIndex].slice(0, text.length + 1));
        }, 35);
      } else {
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 1000);
      }
    } else {
      timeout = setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
        setText("");
        setIsTyping(true);
      }, 500);
    }

    return () => clearTimeout(timeout);
  }, [text, isTyping, messageIndex]);

  return { text, isTyping };
}
