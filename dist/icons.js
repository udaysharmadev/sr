const shapes = {
  'badge-frontier-ace':'<path d="M17 1 29 7v11L17 31 5 18V7z" fill="#4f6652" stroke="#f5d985" stroke-width="2"/><path d="M17 5v20M7 14h20" stroke="#f5e6b1" stroke-width="2"/><circle cx="17" cy="14" r="6" fill="none" stroke="#f5e6b1" stroke-width="2"/><path d="m17 8 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="#d8a84d"/>',
  'badge-weapon-master':'<path d="M5 3h24v17L17 31 5 20z" fill="#ad8736" stroke="#f4d787" stroke-width="2"/><path d="m8 9 18 15 2-3L11 6zm18 0L8 24l-2-3L23 6z" fill="#f3e8bc"/><path d="m13 5 4 5 4-5-1 8h-6z" fill="#e5c558"/>',
  'badge-deadeye':'<path d="m17 1 4 5 7-1 1 7 4 4-4 5-1 7-7-1-4 4-4-4-7 1-1-7-4-5 4-4 1-7 7 1z" fill="#6c7b43" stroke="#d8cc81" stroke-width="1.5"/><g fill="none" stroke="#f4e6a7" stroke-width="2"><circle cx="17" cy="16" r="8"/><circle cx="17" cy="16" r="3"/><path d="M17 5v5m0 12v5M6 16h5m12 0h5"/></g>',
  'badge-untouchable':'<path d="m5 10 12-7 12 7v10l-12 11L5 20z" fill="#5e6d76" stroke="#dce1b6" stroke-width="2"/><path d="m8 12 5 4 4-7 4 7 5-4-3 11H11z" fill="#e9cf76"/><path d="M12 26h10" stroke="#f5e8aa" stroke-width="2"/>',
  'badge-veteran':'<path d="m17 3 4 8 9 1-7 7 2 10-8-5-8 5 2-10-7-7 9-1z" fill="#dcc36c" stroke="#fff0b2" stroke-width="1.5"/><path d="M7 29Q-3 17 6 6M27 29Q37 17 28 6M4 11l-3-2m3 8-4-1m6 8-4 1m28-14 3-2m-3 8 4-1m-6 8 4 1" fill="none" stroke="#a6b879" stroke-width="2.5"/>',
  coin:'<circle cx="17" cy="16" r="14" fill="#e3b944" stroke="#ffe7a0" stroke-width="2"/><circle cx="17" cy="16" r="10" fill="none" stroke="#a58227" stroke-width="1.5"/><path d="m17 8 2 5 5 1-4 4 1 5-4-3-4 3 1-5-4-4 5-1z" fill="#fff0b1"/>',
  shirt: '<path d="m11 3-8 4L0 16l7 3 2-5v15h16V14l2 5 7-3-3-9-8-4q-6 5-12 0z"/><path d="M14 6v21m6-21v21M10 12h14" stroke="#17324a" stroke-width="2" fill="none"/>',
  goggles: '<path d="M2 9q15-5 30 0v12l-5 4H7l-5-4z"/><path d="M6 12h9v8H6zm13 0h9v8h-9z" fill="#173d59"/><path d="m8 13 4 1-4 4m13-5 4 1-4 4" fill="#93ecff"/>',
  headset: '<path d="M5 18V13a12 12 0 0124 0v5h-4v-5a8 8 0 00-16 0v5zM2 15h7v12H2zm23 0h7v12h-7z"/><path d="M27 25v4H17v-3h8v-1z"/>',
  cap: '<path d="M5 20V13a12 12 0 0124 0v7zM3 21h27l4 5H0z"/><path d="M17 3v16" stroke="#223b50" stroke-width="2"/>',
  mask: '<path d="M4 9 17 5l13 4v14l-13 7L4 23z"/><path d="M8 13h18M8 18h18M10 23h14" stroke="#223b50" stroke-width="2"/>',
  shoe:
    '<path d="M6 4h9l2 12 12 5q3 2 2 7H2V15l4-1z"/><path d="M3 25h27M17 17l-4 2m9 0-4 2" stroke="#263e53" stroke-width="2" fill="none"/>',
  rifle:
    '<path d="M2 12l6-3 2 1 8-2 1 1 13-3 1 2-14 4-3 1-2 7-4-1 2-5-4 1-4 4-3-1z"/><path d="M13 6l8-2 1 3-8 2z"/>',
  bag:
    '<path d="M10 7V5a6 6 0 0112 0v2h3a3 3 0 013 3v17H4V10a3 3 0 013-3zm3 0h6V5a3 3 0 00-6 0z"/><path d="M8 15h16" stroke="#315086" stroke-width="2"/>',
  tasks:
    '<path d="M6 4h6V2h8v2h5v6h-3V7H8v18h14v-6h3v9H5V5z"/><path d="m11 15 4 4 12-14 3 3-15 16-7-7z" fill="#a7fa30"/>',
  friends:
    '<circle cx="16" cy="9" r="5"/><circle cx="6" cy="12" r="3.7"/><circle cx="26" cy="12" r="3.7"/><path d="M7.4 26v-2a8.6 8.6 0 0117.2 0v2zM0 24v-2a6 6 0 017.8-5.7A11 11 0 005.4 24zm27 0a11 11 0 00-2.6-7.7A6 6 0 0132 22v2z"/>',
  play: '<path d="M6 3q0-2 2-1l22 12q2 1 0 3L8 30q-2 1-2-2z"/>',
  target:
    '<g fill="none" stroke="currentColor" stroke-width="2.1"><circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="3"/><path d="M16 0v9m0 14v9M0 16h9m14 0h9"/></g>',
  cart:
    '<path d="M0 3h6l2 4h23l-4 13H10L5 7H1z"/><circle cx="12" cy="25" r="3"/><circle cx="24" cy="25" r="3"/>',
  gear:
    '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M26.98 11.87 27.56 13.75 30.83 13.81 30.83 18.19 27.56 18.25 26.98 20.13 26.06 21.88 28.33 24.23 25.23 27.33 22.88 25.06 21.13 25.98 19.25 26.56 19.19 29.83 14.81 29.83 14.75 26.56 12.87 25.98 11.12 25.06 8.77 27.33 5.67 24.23 7.94 21.88 7.02 20.13 6.44 18.25 3.17 18.19 3.17 13.81 6.44 13.75 7.02 11.87 7.94 10.12 5.67 7.77 8.77 4.67 11.12 6.94 12.87 6.02 14.75 5.44 14.81 2.17 19.19 2.17 19.25 5.44 21.13 6.02 22.88 6.94 25.23 4.67 28.33 7.77 26.06 10.12Z M22 16a5 5 0 1 0-10 0a5 5 0 1 0 10 0Z"/>',
  controller:
    '<path fill-rule="evenodd" d="M7 7q4-2 9 0 5-2 9 0 4 2 6 15 1 8-5 5l-5-5H11l-5 5q-6 3-5-5Q3 9 7 7zm1 5v3H5v3h3v3h3v-3h3v-3h-3v-3zm15 0a2 2 0 100 4 2 2 0 000-4zm4 5a2 2 0 100 4 2 2 0 000-4z"/>',
  news: '<path d="M3 12h7l16-8v23l-16-8H9l2 8H6l-2-8H2zM29 11q5 5 0 9z"/>',
  arrow: '<path d="m11 5 12 11-12 11-3-4 8-7-8-7z"/>',
  gem:
    '<path fill="#7bff1c" d="M1 11 8 3h17l6 8-15 18z"/><path fill="#caff7b" d="m1 11 7-8h5l-3 8zm9 0 6 18-15-18z"/><path fill="#37ba00" d="M22 11h9L16 29z"/>',
  medal:
    '<path d="m5 2 9 1 2 9-6 3zm22 0-9 1-2 9 6 3z" fill="#48b4ff"/><circle cx="16" cy="21" r="10" fill="#ffbb00"/><path d="m16 14 2.1 4.4 4.8.7-3.5 3.4.8 4.7-4.2-2.3-4.2 2.3.8-4.7-3.5-3.4 4.8-.7z" fill="#fff2a2"/>',
  close: '<path d="m7 4 9 9 9-9 3 3-9 9 9 9-3 3-9-9-9 9-3-3 9-9-9-9z"/>',
  sound:
    '<path d="M3 11h6l8-7v24l-8-7H3z"/><path d="M20 10q6 6 0 12m4-16q10 10 0 20" fill="none" stroke="currentColor" stroke-width="3"/>',
};
export const icon = (name) =>
  '<svg aria-hidden="true" viewBox="0 0 34 32" fill="currentColor">' +
  (shapes[name] || "") + "</svg>";
export function fillIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]")) {
    el.innerHTML = icon(el.dataset.icon);
  }
}
