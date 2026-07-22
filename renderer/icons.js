/**
 * Halo — SVG Icon Module
 * Original geometric icon set. No external icon libraries.
 */

const HaloIcons = {
  // Assist — sparkle/magic wand
  assist: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 1L10.5 6.5L16 8L10.5 9.5L9 15L7.5 9.5L2 8L7.5 6.5L9 1Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M14 2L14.8 4.2L17 5L14.8 5.8L14 8L13.2 5.8L11 5L13.2 4.2L14 2Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" opacity="0.6"/>
  </svg>`,

  // Say — speech bubble
  say: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3.5C3 2.67 3.67 2 4.5 2H13.5C14.33 2 15 2.67 15 3.5V10.5C15 11.33 14.33 12 13.5 12H7L4 15V12H4.5C3.67 12 3 11.33 3 10.5V3.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    <line x1="6" y1="5.5" x2="12" y2="5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
    <line x1="6" y1="8.5" x2="10" y2="8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
  </svg>`,

  // Follow-up — forward arrow with plus
  followup: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9H12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M9 5L13 9L9 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15 6V12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
  </svg>`,

  // Recap — list/summary
  recap: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/>
    <line x1="6" y1="6.5" x2="12" y2="6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
    <line x1="6" y1="9" x2="11" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
    <line x1="6" y1="11.5" x2="9" y2="11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.3"/>
  </svg>`,

  // Code — terminal bracket
  code: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 5L3 9L6 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 5L15 9L12 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="10" y1="3" x2="8" y2="15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.4"/>
  </svg>`,

  // Microphone
  mic: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" stroke-width="1.3"/>
    <path d="M3 7.5C3 10.26 5.24 12.5 8 12.5C10.76 12.5 13 10.26 13 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <line x1="8" y1="12.5" x2="8" y2="14.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,

  // Send arrow
  send: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 8H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M8 4L12 8L8 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Settings gear
  settings: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>
    <path d="M8 1.5V3M8 13V14.5M14.5 8H13M3 8H1.5M12.6 3.4L11.5 4.5M4.5 11.5L3.4 12.6M12.6 12.6L11.5 11.5M4.5 4.5L3.4 3.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,

  // Close X
  close: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  // Chevron down (for expand/collapse)
  chevron: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 5L7 9L11 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Three-dot menu (more)
  more: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="3" r="1.2" fill="currentColor"/>
    <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
    <circle cx="7" cy="11" r="1.2" fill="currentColor"/>
  </svg>`,

  // Copy
  copy: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
    <path d="M10 4V3C10 2.45 9.55 2 9 2H3C2.45 2 2 2.45 2 3V9C2 9.55 2.45 10 3 10H4" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  // Upload
  upload: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 9V2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M4 4.5L7 1.5L10 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M2 9V11.5C2 12.05 2.45 12.5 3 12.5H11C11.55 12.5 12 12.05 12 11.5V9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,

  // Document / file
  document: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 2C3 1.45 3.45 1 4 1H8L11 4V12C11 12.55 10.55 13 10 13H4C3.45 13 3 12.55 3 12V2Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M8 1V4H11" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.5"/>
    <line x1="5" y1="9.5" x2="8" y2="9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.3"/>
  </svg>`,

  // Timer / clock
  timer: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7.5" r="5" stroke="currentColor" stroke-width="1.3"/>
    <line x1="7" y1="5" x2="7" y2="7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <line x1="7" y1="7.5" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="6" y1="1.5" x2="8" y2="1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,

  // Minimize / eye
  minimize: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 7C1 7 3.5 3 7 3C10.5 3 13 7 13 7C13 7 10.5 11 7 11C3.5 11 1 7 1 7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    <circle cx="7" cy="7" r="1.8" stroke="currentColor" stroke-width="1.3"/>
  </svg>`,

  // Trash / delete
  trash: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 3.5H9.5L9 10.5C9 10.78 8.78 11 8.5 11H3.5C3.22 11 3 10.78 3 10.5L2.5 3.5Z" stroke="currentColor" stroke-width="1.2"/>
    <line x1="1.5" y1="3.5" x2="10.5" y2="3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M4.5 3.5V2C4.5 1.72 4.72 1.5 5 1.5H7C7.28 1.5 7.5 1.72 7.5 2V3.5" stroke="currentColor" stroke-width="1.2"/>
  </svg>`,
};

/**
 * Inject SVG icons into elements with [data-icon] attributes.
 */
function injectIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const iconName = el.getAttribute('data-icon');
    if (HaloIcons[iconName]) {
      el.innerHTML = HaloIcons[iconName];
    }
  });
}

// Run on load
document.addEventListener('DOMContentLoaded', injectIcons);
