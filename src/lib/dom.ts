/** Appends to <body>, deferring when the library runs before <body> exists. */
export function appendToBody(el: HTMLElement): void {
  if (document.body) document.body.appendChild(el);
  else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el), { once: true });
}
