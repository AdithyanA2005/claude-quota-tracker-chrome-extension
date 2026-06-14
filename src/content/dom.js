export function isVisibleElement(el) {
  if (!el || !(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 40 && rect.height > 20;
}

export function getComposerInputs() {
  const selectors = ["textarea", '[contenteditable="true"][role="textbox"]', '[contenteditable="true"][aria-label*="prompt" i]', '[contenteditable="true"]'];
  const candidates = [];
  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    for (const node of nodes) if (isVisibleElement(node)) candidates.push(node);
  }
  return candidates;
}

export function chooseBestComposerHost() {
  const inputs = getComposerInputs();
  for (const input of inputs) {
    const form = input.closest("form");
    if (form && isVisibleElement(form)) return form;
    const panel = input.closest('[class*="composer" i], [class*="prompt" i], [class*="input" i]');
    if (panel && isVisibleElement(panel)) return panel;
    const immediate = input.parentElement;
    if (immediate && isVisibleElement(immediate)) return immediate;
  }
  return null;
}

export function findControlsContainer(host) {
  // Stage 1: Look for the grow container (middle spacer section with flex-row layout)
  // This is the ideal placement for progress bars - centered with plenty of space
  const modelBtns = Array.from(document.querySelectorAll('[data-testid="model-selector-dropdown"]'));
  const modelBtn = modelBtns[modelBtns.length - 1];
  if (modelBtn) {
    let row = modelBtn.parentElement;
    for (let i = 0; i < 6; i++) {
      if (row && typeof row.className === 'string' && row.className.includes('gap-2') && row.className.includes('w-full') && row.className.includes('flex')) {
        // Look for the .grow container (middle empty section) within this row
        const growContainer = row.querySelector('.grow');
        if (growContainer) return growContainer;
        break;
      }
      if (row) row = row.parentElement;
    }
  }

  // Stage 2: Fallback to flex-1 container if grow not found
  const plusBtns = Array.from(document.querySelectorAll('[aria-label*="Add files" i], [aria-label*="Add files," i]'));
  const plusBtn = plusBtns[plusBtns.length - 1];
  if (plusBtn) {
    let flexContainer = plusBtn.parentElement;
    for (let i = 0; i < 5; i++) {
      if (flexContainer && typeof flexContainer.className === 'string' && flexContainer.className.includes('flex-1') && flexContainer.className.includes('flex')) return flexContainer;
      if (flexContainer) flexContainer = flexContainer.parentElement;
    }
  }

  // Stage 3: Fallback to common ancestor of buttons
  const buttons = Array.from(host.querySelectorAll('button'));
  if (buttons.length >= 2) {
    const firstBtn = buttons[0];
    let ancestor = firstBtn.parentElement;
    while (ancestor && ancestor !== host && ancestor !== document.body) {
      if (ancestor.contains(buttons[buttons.length - 1])) return ancestor;
      ancestor = ancestor.parentElement;
    }
  }
  
  return null;
}
