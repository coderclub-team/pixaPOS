import React from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { Button, Card, Input, Label, Separator } from "@pixa/ui";

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text className="text-2xl font-bold text-foreground">pixaPOS — Mobile</Text>
        <Text className="text-sm text-muted-foreground">
          Shared shadcn-style components
        </Text>

        <Card className="p-4 gap-3">
          <Label className="text-muted-foreground">Shared UI</Label>
          <Text className="text-lg font-semibold text-card-foreground">Today</Text>
          <Text className="text-sm text-muted-foreground">
            Use the same design system across web and mobile.
          </Text>
          <Separator className="my-1" />
          <Input placeholder="Search products" className="h-11" />
          <View className="flex-row gap-3">
            <Button variant="secondary" onPress={() => {}} className="flex-1">
              Draft Order
            </Button>
            <Button onPress={() => {}} className="flex-1">
              New Sale
            </Button>
          </View>
        </Card>

        <Card className="p-4 gap-3">
          <Text className="text-lg font-semibold text-card-foreground">Shared UI</Text>
          <Text className="text-sm text-muted-foreground">
            Button, Card, Input, and Separator now come from the shared package.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
