import { useState } from "react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  SHORTCUT_MODIFIER_LABELS,
  type ShortcutModifier,
} from "@/lib/shortcuts";
import { applyTheme, saveTheme, type Theme } from "@/lib/theme";

type OptionsProps = {
  name: string;
  onNameChange: (name: string) => void;
  academyMember: boolean;
  onAcademyMemberChange: (academyMember: boolean) => void;
  shortcutModifier: ShortcutModifier;
  onShortcutModifierChange: (shortcutModifier: ShortcutModifier) => void;
};

export default function Options({
  name,
  onNameChange,
  academyMember,
  onAcademyMemberChange,
  shortcutModifier,
  onShortcutModifierChange,
}: OptionsProps) {
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
          spellCheck={false}
          placeholder="Your name"
          onChange={(event) => onNameChange(event.target.value)}
        />
        <FieldDescription>Used to greet you on the Dashboard.</FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="academy-member">Academy member</FieldLabel>
          <FieldDescription>
            Whether you have a Zero To Mastery Academy membership.
          </FieldDescription>
        </FieldContent>
        <Switch
          id="academy-member"
          checked={academyMember}
          onCheckedChange={onAcademyMemberChange}
        />
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
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="shortcut-modifier">Shortcut key</FieldLabel>
          <FieldDescription>
            Hold to show shortcuts, then press 1–5 to jump to a menu item or S
            to filter courses.
          </FieldDescription>
        </FieldContent>
        <NativeSelect
          id="shortcut-modifier"
          value={shortcutModifier}
          onChange={(event) =>
            onShortcutModifierChange(event.target.value as ShortcutModifier)
          }
        >
          {Object.entries(SHORTCUT_MODIFIER_LABELS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </section>
  );
}
