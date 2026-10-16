"use client";

import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "./form-context";
import { TextField } from "./fields/text-field";
import { TextareaField } from "./fields/textarea-field";
import { SelectField } from "./fields/select-field";
import { CheckboxField } from "./fields/checkbox-field";
import { SwitchField } from "./fields/switch-field";
import { RadioGroupField } from "./fields/radio-group-field";
import { SliderField } from "./fields/slider-field";
import { ComboboxField } from "./fields/combobox-field";
import { DatePickerField, DateRangeField } from "./fields/date-picker-field";
import { OtpField } from "./fields/otp-field";
import { ColorField } from "./fields/color-field";
import { FileUploadField } from "./fields/file-upload-field";
import { CheckboxGroupField } from "./fields/checkbox-group-field";
import { TagsField } from "./fields/tags-field";
import { ToggleGroupField } from "./fields/toggle-group-field";
import { SubmitButton } from "./submit-button";

/**
 * App-wide form hook — TanStack's createFormHook with the field components
 * registered. Fields render inside `form.AppField`:
 *
 * ```tsx
 * const form = useAppForm({ defaultValues, validators: { onSubmit: schema }, onSubmit });
 *
 * <form.AppField name='email'
 *   children={(field) => <field.TextField label='Email' type='email' />} />
 * ```
 *
 * Every component's markup is the shadcn TanStack Form doc anatomy — for
 * one-off custom fields, drop down to the raw `form.Field` render prop and
 * compose the `Field` primitives directly (see docs/forms.md).
 */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    SelectField,
    CheckboxField,
    SwitchField,
    RadioGroupField,
    SliderField,
    ComboboxField,
    DatePickerField,
    DateRangeField,
    OtpField,
    ColorField,
    FileUploadField,
    CheckboxGroupField,
    TagsField,
    ToggleGroupField,
  },
  formComponents: {
    SubmitButton,
  },
});
