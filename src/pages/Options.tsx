import { useState } from "react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { CourseOpenMode } from "@/lib/course";
import { applyTheme, saveTheme, type Theme } from "@/lib/theme";

type OptionsProps = {
  name: string;
  onNameChange: (name: string) => void;
  academyMember: boolean;
  onAcademyMemberChange: (academyMember: boolean) => void;
  courseOpenMode: CourseOpenMode;
  onCourseOpenModeChange: (courseOpenMode: CourseOpenMode) => void;
};

export default function Options({
  name,
  onNameChange,
  academyMember,
  onAcademyMemberChange,
  courseOpenMode,
  onCourseOpenModeChange,
}: OptionsProps) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  function handleThemeChange(checked: boolean) {
    const next: Theme = checked ? "dark" : "light";
    setTheme(next);
    void applyTheme(next);
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
      <FieldSet>
        <FieldLegend variant="label">Open courses in</FieldLegend>
        <RadioGroup
          value={courseOpenMode}
          onValueChange={(value) =>
            onCourseOpenModeChange(value as CourseOpenMode)
          }
        >
          <Field orientation="horizontal">
            <RadioGroupItem value="embedded" id="open-embedded" />
            <FieldContent>
              <FieldLabel htmlFor="open-embedded">The app (default)</FieldLabel>
              <FieldDescription>
                Courses load in the Web View, next to the app's sidebar.
              </FieldDescription>
            </FieldContent>
          </Field>
          <Field orientation="horizontal">
            <RadioGroupItem value="window" id="open-window" />
            <FieldContent>
              <FieldLabel htmlFor="open-window">A separate window</FieldLabel>
              <FieldDescription>
                Courses open in their own window you can move or resize.
              </FieldDescription>
            </FieldContent>
          </Field>
        </RadioGroup>
      </FieldSet>
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
