import { Component, h } from '@stencil/core';

@Component({
  tag: 'h2-icon',
  shadow: true,
})
export class H2Icon {
  render() {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ stroke: 'var(--color-text-dark)' }}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide lucide-heading2-icon lucide-heading-2"
      >
        <path d="M4 12h8" />
        <path d="M4 18V6" />
        <path d="M12 18V6" />
        <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
      </svg>
    );
  }
}
