import { useState } from "react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { applyTheme, saveTheme, type Theme } from "@/lib/theme";

export default function Options() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  function handleThemeChange(checked: boolean) {
    const next: Theme = checked ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    saveTheme(next).catch((error) =>
      console.error("Could not save theme", error),
    );
  }

  return (
    <section className="flex max-w-xl flex-col gap-6 p-6">
      <h1 className="text-[1.75rem] font-semibold">Options</h1>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="dark-mode">Dark mode</FieldLabel>
          <FieldDescription>
            Switch between light and dark colour schemes.
          </FieldDescription>
        </FieldContent>
        <Switch
          id="dark-mode"
          checked={theme === "dark"}
          onCheckedChange={handleThemeChange}
        />
      </Field>
    </section>
  );
}
