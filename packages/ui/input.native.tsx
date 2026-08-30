import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "./lib/utils";

const Input = React.forwardRef<TextInput, TextInputProps>(
  ({ className, placeholderTextColor, ...props }, ref) => {
    return (
      <TextInput
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        placeholderTextColor={placeholderTextColor ?? "#a1a1aa"}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
