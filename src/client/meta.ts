/**
 * The tab type's metadata.
 *
 * One source for the sidebar tab chip and the panel header: the header writes
 * the same `meta.title` the tab registered, instead of repeating a decorative
 * name of its own.
 */
export const meta: {
  readonly title: { readonly en: string; readonly [language: string]: string }
} = {
  title: {
    en: 'Kaze Spec-Driven Development',
    zh: 'Kaze 规格驱动开发',
  },
}
