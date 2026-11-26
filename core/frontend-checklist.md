# Frontend Acceptance Checklist

Use this checklist when a spec changes a user-visible surface. It is a compact
acceptance aid, not a design system and not a Browser Host binding.

## States

- primary success path;
- loading;
- empty;
- error;
- disabled;
- permission-denied or unauthorized;
- long content and narrow viewport.

## Accessibility

- semantic HTML and landmark structure;
- accessible names for controls;
- keyboard path for every action;
- visible focus;
- labels, descriptions, and error associations;
- contrast and reduced-motion behavior.

## Layout and motion

- no horizontal overflow at narrow, medium, and wide widths;
- no fragile fixed sizing or clipped controls;
- motion only when it improves comprehension;
- `prefers-reduced-motion` respected;
- no animation blocks interaction.

## Validation

- exercise the primary happy path on the real rendered surface when the host
  exposes a browser or preview capability;
- exercise at least one error or permission path;
- verify the observable saved result for write flows, not only static markup;
- if browser or visual validation is unavailable, write "浏览器验收未执行"
  (or the user's language equivalent) and name the blocker;
- do not invent a browser bridge, vendor API key, or temporary route to fake a
  pass.
