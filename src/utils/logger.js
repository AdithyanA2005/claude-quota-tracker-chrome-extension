const LOG_PREFIX = "[CLUT]";
export function log(message, extra) {
  if (typeof extra === "undefined") {
    console.log(`${LOG_PREFIX} ${message}`);
  } else {
    console.log(`${LOG_PREFIX} ${message}`, extra);
  }
}
