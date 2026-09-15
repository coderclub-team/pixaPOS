import { Button } from "../base-ui/button";
import { Icons } from "../icons";

export default function CtaGithub() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="group hidden sm:flex"
      nativeButton={false}
      aria-label="View on GitHub"
      render={
        <span
          aria-label="GitHub"
          className="text-muted-foreground transition-colors duration-300"
        />
      }
    >
      <Icons.github className="transition-transform duration-300 group-hover:animate-bounce" />
    </Button>
  );
}
