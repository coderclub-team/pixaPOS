import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

export default function CtaGithub() {
  return (
    <span
      aria-label="GitHub"
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "group text-muted-foreground hidden transition-colors duration-300 sm:flex",
      )}
    >
      <Icons.github className="transition-transform duration-300 group-hover:animate-bounce" />
    </span>
  );
}
