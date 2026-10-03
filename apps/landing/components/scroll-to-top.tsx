"use client";

import { useEffect, useState } from "react";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.pageYOffset > 300);
    };
    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  return (
    <div className="fixed right-8 bottom-8 z-50">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
        tabIndex={isVisible ? 0 : -1}
        className={cn(
          "flex size-10 cursor-pointer items-center justify-center rounded-md bg-(--primary) text-(--primary-foreground) shadow-md transition duration-300 hover:opacity-80",
          !isVisible && "pointer-events-none opacity-0",
        )}
      >
        <Icons.arrowRight className="size-4 -rotate-90" aria-hidden />
      </button>
    </div>
  );
}
