"use client";

import { useEffect, useState } from "react";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.pageYOffset > 300);
    };
    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed right-8 bottom-8 z-[999]">
      <div
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="scroll to top"
        className="back-to-top flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-primary text-white shadow-md transition duration-300 ease-in-out hover:bg-dark"
      >
        <span className="mt-[6px] h-3 w-3 rotate-45 border-t border-l border-white" />
      </div>
    </div>
  );
}
