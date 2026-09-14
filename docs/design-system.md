# Design System

## Ownership

`@pixa/ui` is the shared UI platform. It owns semantic tokens, typography,
spacing, icon access, primitive components, and documented interaction patterns.
Apps compose feature screens and may not fork primitive styling to achieve a
one-off look. `apps/template` is an inspiration/starter, not an upstream copied
into production applications.

Web uses the existing shadcn-style primitives built on Base UI. Mobile exposes
native equivalents through platform-specific files. A component enters the shared
package only when at least two apps need the same stable behavior; otherwise keep
it feature-local.

## Composition rules

- Check `@pixa/ui` before adding custom markup or a registry component.
- Use semantic tokens such as `bg-background` and `text-muted-foreground`, not
  hard-coded palette values. Use variants before custom component styling.
- Use `flex`/`grid` with `gap-*`, `size-*` for equal dimensions, and `cn()` for
  conditional layout classes.
- Use `FieldGroup`/`Field` for forms, full Card anatomy, `Empty` and `Skeleton`
  for non-happy states, `AlertDialog` for destructive confirmation, and titled
  Dialog/Sheet/Drawer overlays.
- Use the `Icons` registry. Do not add direct icon-library imports in app code.

## Restaurant interaction standard

POS and KDS screens are touch-first: primary actions have generous targets,
status is understandable without colour alone, and irreversible actions require
reason capture and confirmation. Every screen specifies loading, empty, error,
permission-denied, and offline/sync states. Keyboard and screen-reader operation
remain required for web back-office surfaces.

## Contribution checklist

Before changing shared UI, confirm the API works on every target platform,
preserves semantic tokens, exposes accessible labels/states, and has an example
consumer. Document a breaking component API change in an ADR or migration note.
