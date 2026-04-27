import { formatCountdown } from '../utils/formatting.js';

export const TRACKER_ROOT_ID = "clu-usage-inline-root";
export const TRACKER_STYLE_ID = "clu-usage-inline-style";

export function injectInlineStyles() {
  if (document.getElementById(TRACKER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TRACKER_STYLE_ID;
  style.textContent = `
    #${TRACKER_ROOT_ID} {
      flex: 1;
      width: auto;
      margin: 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 0;
      box-sizing: border-box;
      animation: cluFadeIn 220ms ease;
      position: relative;
      z-index: 2;
    }
    #${TRACKER_ROOT_ID} .clu-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 8px;
      align-items: center;
      flex: 1;
      color: rgba(255, 255, 255, 0.85);
      font-size: 11px;
      line-height: 1;
    }
    #${TRACKER_ROOT_ID} .clu-label {
      font-weight: 500;
      min-width: 20px;
      color: rgba(255, 255, 255, 0.5);
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    #${TRACKER_ROOT_ID} .clu-track {
      width: 100%;
      height: 4px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
      position: relative;
    }
    #${TRACKER_ROOT_ID} .clu-fill {
      width: 0;
      height: 100%;
      border-radius: 999px;
      transition: width 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
      background: rgba(255, 255, 255, 0.85);
    }
    #${TRACKER_ROOT_ID} .clu-fill.warning {
      background: #f6c47f;
    }
    #${TRACKER_ROOT_ID} .clu-fill.critical {
      background: #ff9ea6;
    }
    #${TRACKER_ROOT_ID} .clu-meta {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      color: rgba(255, 255, 255, 0.4);
      font-size: 10px;
      white-space: nowrap;
    }
    #${TRACKER_ROOT_ID} .clu-dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
    }
    @keyframes cluFadeIn {
      from { opacity: 0; transform: translateY(3px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

export function buildRow(prefix, labelText) {
  const row = document.createElement("div");
  row.className = "clu-row";
  const label = document.createElement("span");
  label.className = "clu-label";
  label.textContent = labelText;
  const track = document.createElement("div");
  track.className = "clu-track";
  const fill = document.createElement("div");
  fill.className = "clu-fill";
  fill.id = `${prefix}-fill`;
  track.appendChild(fill);
  const meta = document.createElement("span");
  meta.className = "clu-meta";
  meta.id = `${prefix}-meta`;
  meta.textContent = "--%";
  row.append(label, track, meta);
  return row;
}

export function createTrackerRoot() {
  const root = document.createElement('div');
  root.id = TRACKER_ROOT_ID;
  root.dataset.cluMounted = '1';
  root.appendChild(buildRow('clu-five-hour', '5H'));
  root.appendChild(buildRow('clu-seven-day', '7D'));
  return root;
}

export function getTrackerRoot() {
  return document.getElementById(TRACKER_ROOT_ID);
}

export function getSeverityClass(percentage) {
  if (percentage >= 90) return "critical";
  if (percentage >= 70) return "warning";
  return "";
}

export function setRowState(prefix, quotaObj) {
  const fill = document.getElementById(`${prefix}-fill`);
  const meta = document.getElementById(`${prefix}-meta`);
  if (!fill || !meta) return;
  if (!quotaObj) {
    fill.style.width = "0%";
    fill.className = "clu-fill";
    meta.textContent = "--%";
    return;
  }
  const percentage = Math.max(0, Math.min(100, Number(quotaObj.utilization) || 0));
  fill.style.width = `${percentage}%`;
  fill.className = `clu-fill ${getSeverityClass(percentage)}`.trim();
  const pctText = `${Math.round(percentage)}%`;
  const countdown = formatCountdown(quotaObj.resetsAtISO);
  meta.textContent = "";
  const pctNode = document.createElement("span");
  pctNode.textContent = pctText;
  const dot = document.createElement("span");
  dot.className = "clu-dot";
  const resetNode = document.createElement("span");
  resetNode.textContent = countdown;
  meta.append(pctNode, dot, resetNode);
}
