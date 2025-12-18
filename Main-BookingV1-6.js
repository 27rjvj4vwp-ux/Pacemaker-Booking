(async function () {
  // Base code obfuscated slightly
  const secret = String.fromCharCode(51, 56, 52, 54); // "3846"
  const baseCode = secret;
  // Day-of-week letter (Sunday–Saturday)
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date();
  const dayLetter = days[today.getDay()];
  // Build today's expected passcode
  const expectedPass = baseCode + dayLetter;

  // Helper: SHA-256 hash function
  async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Compute expected hash
  const expectedHash = await sha256(expectedPass);
  // Prompt user with group warning
  const passkey = prompt(
    "This tool is for Pacemakers Group members only.\nPlease enter the passcode:"
  );
  if (!passkey) {
    alert("No passcode entered.");
    return;
  }
  // Hash user input and compare
  const enteredHash = await sha256(passkey);
  if (enteredHash !== expectedHash) {
    alert("Access denied.");
    return;
  }
  // If we reach here, passcode is valid
  // Continue with rest of the script...
})();

  const newpubtime = '07:45'; // Change to '07:15' for summer booking
  const teeTime = prompt("Enter your target tee time (e.g., 09:10):");
  if (!teeTime) {
    alert("No tee time entered.");
    return;
  }

  // Get the date text from the page
  const dateBlock = document.querySelector('span.date-display');
  const dateText = dateBlock ? dateBlock.textContent.trim() : '';
  const message = `Waiting until ${newpubtime} to book ${teeTime}${dateText ? ` on ${dateText}` : '.'}
Do not press Refresh.`;

  const userConfirmed = confirm(message);
  if (!userConfirmed) {
    alert('Booking cancelled.');
    return;
  }

  // Delayed booking logic only
  const prevArrow = document.querySelector('a[data-direction="prev"]');
  if (prevArrow) {
    prevArrow.click();
    const parts = newpubtime.split(':');
    const targetHour = parseInt(parts[0], 10), targetMinute = parseInt(parts[1], 10);
    waitUntil(targetHour, targetMinute, 0, function () {
      waitForDateUpdate(dateText, function () {
        waitForBookingSlot(teeTime, 10000, function (btn) {
          btn.click();
          waitForConfirmationButton(5000);
        });
      });
    });
  } else {
    alert('Previous day arrow not found!');
  }

  // Helper functions
  function waitUntil(h, m, s, cb) {
    function check() {
      const now = new Date();
      if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() >= s) { cb(); }
      else { setTimeout(check, 100); }
    }
    check();
  }

  function waitForDateUpdate(targetText, cb) {
    const dateBlock = document.querySelector('span.date-display');
    if (!dateBlock) { alert('Date block not found!'); return; }
    const obs = new MutationObserver(function () {
      const newText = dateBlock.textContent.trim();
      if (newText === targetText) { obs.disconnect(); cb(); }
    });
    obs.observe(dateBlock, { characterData: true, subtree: true, childList: true });
    const nextArrow = document.querySelector('a[data-direction="next"]');
    if (nextArrow) { nextArrow.click(); }
    else { alert('Next day arrow not found!'); }
  }

  function waitForBookingSlot(a, b, c) {
    const start = Date.now();
    function check() {
      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find(row => row.textContent.includes(a));
      if (targetRow) {
        const bookBtn = Array.from(targetRow.querySelectorAll('button')).find(btn => /book/i.test(btn.textContent.trim()));
        if (bookBtn) { c(bookBtn, targetRow); return; }
      }
      if (Date.now() - start < b) { setTimeout(check, 10); }
      else { alert('Book button not found for ' + a); }
    }
    check();
  }

  function waitForConfirmationButton(a) {
    const start = Date.now();
    function check() {
      const confirmBtns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = confirmBtns.find(btn => btn.textContent.includes('Book tee time at ' + teeTime));
      if (confirmBtn) { confirmBtn.click(); }
      else if (Date.now() - start < a) { setTimeout(check, 10); }
      else { alert('Confirmation button not found for ' + teeTime); }
    }
    check();
   }
 })();
