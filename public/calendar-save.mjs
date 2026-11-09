// SPDX-License-Identifier: AGPL-3.0-only
// Saves a calendar file on the person's own device. The file is made in the browser and handed to the browser's
// own download. Nothing is uploaded anywhere.
export function saveIcs(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
