import { buttonVariants } from "@pixa/ui/base-ui/button";
import { Icons } from "@pixa/ui/icons";
import { cn } from "@pixa/ui/lib/utils";

export default function CtaGithub() {
  return (
    <a
      aria-label="View on GitHub"
      href="https://github.com/Kiranism/next-shadcn-dashboard-starter"
      rel="noopener noreferrer"
      target="_blank"
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "group text-muted-foreground hover:text-foreground hidden transition-colors duration-300 sm:flex",
      )}
    >
      <Icons.github className="transition-transform duration-300 group-hover:animate-bounce" />
    </a>
  );
}
