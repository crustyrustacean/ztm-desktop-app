import { useState } from "react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { applyTheme, saveTheme, type Theme } from "@/lib/theme";

type OptionsProps = {
  name: string;
  onNameChange: (name: string) => void;
};

export default function Options({ name, onNameChange }: OptionsProps) {
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
      <Field>
        <FieldLabel htmlFor="user-name">Name</FieldLabel>
        <Input
          id="user-name"
          value={name}
          maxLength={50}
          autoComplete="off"
          placeholder="Your name"
          onChange={(event) => onNameChange(event.target.value)}
        />
        <FieldDescription>Used to greet you on the Dashboard.</FieldDescription>
      </Field>
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
