import * as React from "react";
import { View, Text, type ViewProps } from "react-native";
import { cn } from "./lib/utils";

function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "rounded-lg border border-border bg-card p-6 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ViewProps) {
  return (
    <View className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  );
}

function CardTitle({
  className,
  children,
  ...props
}: ViewProps & { children?: React.ReactNode }) {
  return (
    <Text
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Text>
  );
}

function CardDescription({
  className,
  children,
  ...props
}: ViewProps & { children?: React.ReactNode }) {
  return (
    <Text
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </Text>
  );
}

function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("flex flex-row items-center p-6 pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
