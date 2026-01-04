
(function () {
  // Passkey prompt
  const secret = String.fromCharCode(51, 56, 52, 54); // "3846"
  const baseCode = secret;
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date();
  const dayLetter = days[today.getDay()];
  const expectedPass = baseCode + dayLetter;

  const passkey = prompt("Booking tool V1.7 - Pacemakers Group members only.\nPlease enter the passcode:");
  if (passkey !== expectedPass) { alert("Access denied."); return; }

  const newpubtime = '07:45'; // Change manually when club decides
  const teeTime = prompt("Enter your target tee time (e.g., 09:10):");
  if (!teeTime) { alert("No tee time entered."); return; }

  const dateBlock = document.querySelector('span.date-display');
  const dateText = dateBlock ? dateBlock.textContent.trim() : '';
  const message = `Waiting until ${newpubtime} UK time to book ${teeTime}${dateText ? ` on ${dateText}` : '.'}\nDo not press Reset.`;

  if (!confirm(message)) { alert('Booking cancelled.'); return; }

  const prevArrow = document.querySelector('a[data-direction="prev"]');
  if (prevArrow) {
    prevArrow.click();
    waitUntilUKTime(newpubtime, function () {
      waitForDateUpdate(dateText, function () {
        waitForBookingSlot(teeTime, 10000, function (btn) {
          btn.click();
          waitForConfirmationButton(5000);
        });
      });
    });
  } else { alert('Previous day arrow not found!'); }

  // Hybrid UK-time wait function
  function waitUntilUKTime(timeStr, cb) {
    const [h, m] = timeStr.split(':').map(Number);
    const nowUTC = new Date();
    const ukNow = new Date(nowUTC.toLocaleString("en-GB", { timeZone: "Europe/London" }));
    const targetUK = new Date(ukNow);
    targetUK.setHours(h, m, 0, 0);
    if (targetUK < ukNow) targetUK.setDate(targetUK.getDate() + 1);
    const delayMs = targetUK.getTime() - nowUTC.getTime();

    setTimeout(function () {
      function check() {
        const currentUK = new Date(new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }));
        if (currentUK.getHours() === h && currentUK.getMinutes() === m) cb();
        else setTimeout(check, 50);
      }
      check();
    }, Math.max(0, delayMs - 1000));
  }

  // Improved observer: waits for correct date before proceeding
  function waitForDateUpdate(targetText, cb) {
    const dateBlock = document.querySelector('span.date-display');
    if (!dateBlock) { alert('Date block not found!'); return; }

    const obs = new MutationObserver(function () {
      const newText = dateBlock.textContent.trim();
      if (newText === targetText) {
        obs.disconnect();
        cb(); // Only proceed when date matches target
      }
    });

    obs.observe(dateBlock, { characterData: true, subtree: true, childList: true });

    const nextArrow = document.querySelector('a[data-direction="next"]');
    if (nextArrow) nextArrow.click(); else alert('Next day arrow not found!');

    // Fallback timeout
    setTimeout(() => {
      obs.disconnect();
      alert('Date update not detected in time. Please check manually.');
    }, 5000);
  }

  // Double-check date before booking
  function waitForBookingSlot(a, b, c) {
    const start = Date.now();
    function check() {
      const dateBlock = document.querySelector('span.date-display');
      if (!dateBlock || dateBlock.textContent.trim() !== dateText) {
        if (Date.now() - start < b) { setTimeout(check, 50); return; }
        else { alert('Target date not reached in time.'); return; }
      }

      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find(row => row.textContent.includes(a));
      if (targetRow) {
        const bookBtn = Array.from(targetRow.querySelectorAll('button')).find(btn => /book/i.test(btn.textContent.trim()));
        if (bookBtn) { c(bookBtn, targetRow); return; }
      }
      if (Date.now() - start < b) { setTimeout(check, 50); }
      else { alert('Book button not found for ' + a); }
    }
    check();
  }

  function waitForConfirmationButton(a) {
    const start = Date.now();
    function check() {
      const confirmBtns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = confirmBtns.find(btn => btn.textContent.includes('Book tee time at ' + teeTime));
      if (confirmBtn) {
        confirmBtn.click();
        // Log booking time (outside critical section)
        const now = new Date().toISOString();
        const logKey = 'bookingTimes';
        const logs = JSON.parse(localStorage.getItem(logKey) || '[]');
        logs.push(now);
        localStorage.setItem(logKey, JSON.stringify(logs));
      } else if (Date.now() - start < a) setTimeout(check, 10);
      else alert('Confirmation button not found for ' + teeTime);
    }
    check();
  }
})();
