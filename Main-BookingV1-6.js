(function () {
  // ✅ Passkey prompt based on today's date
  const secret = String.fromCharCode(51, 56, 52, 54); // "3846"
  const baseCode = secret;
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date();
  const dayLetter = days[today.getDay()];
  const expectedPass = baseCode + dayLetter;

  const passkey = prompt("Booking tool V1.7 : Pacemakers Group members only.\nPlease enter the passcode:");
  if (passkey !== expectedPass) { alert("Access denied."); return; }

  // ✅ Booking parameters
  const newpubtime = '15:30'; // Change manually when club decides
  const teeTime = prompt("Enter your target tee time (e.g., 09:10):");
  if (!teeTime) { alert("No tee time entered."); return; }

  // ✅ Capture the target date (browser is positioned here when script runs)
  const dateBlock = document.querySelector('span.date-display');
  const targetDateText = dateBlock ? dateBlock.textContent.trim() : '';
  if (!targetDateText) { alert('Target date not found on page.'); return; }

  // ✅ Confirmation message uses target date
  const message = `Waiting until ${newpubtime} UK time to book ${teeTime} on ${targetDateText}\nDo not press Reset.`;
  if (!confirm(message)) { alert('Booking cancelled.'); return; }

  // ✅ Move to previous day before waiting
  const prevArrow = document.querySelector('a[data-direction="prev"]');
  if (prevArrow) {
    prevArrow.click();
    waitUntilUKTime(newpubtime, function () {
      // ✅ Click forward arrow only after newpubtime
      const nextArrow = document.querySelector('a[data-direction="next"]');
      if (nextArrow) nextArrow.click(); else { alert('Next day arrow not found!'); return; }

      // ✅ Wait for target date to appear
      waitForDateUpdate(targetDateText, function () {
        // ✅ Only start booking when target date confirmed
        waitForBookingSlot(teeTime, targetDateText, 15000, function (btn) {
          btn.click();
          waitForConfirmationButton(5000);
        });
      });
    });
  } else { alert('Previous day arrow not found!'); }

  // ✅ Exact UK-time wait function
  function waitUntilUKTime(timeStr, cb) {
    const [h, m] = timeStr.split(':').map(Number);
    const ukNow = new Date(new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }));
    const targetUK = new Date(ukNow);
    targetUK.setHours(h, m, 0, 0);
    if (targetUK < ukNow) targetUK.setDate(targetUK.getDate() + 1);

    const delayMs = targetUK.getTime() - ukNow.getTime();
    setTimeout(cb, delayMs); // Fires exactly at newpubtime
  }

  // ✅ Wait for correct date before proceeding
  function waitForDateUpdate(targetDateText, cb) {
    const dateBlock = document.querySelector('span.date-display');
    if (!dateBlock) { alert('Date block not found!'); return; }

    const obs = new MutationObserver(() => {
      const newText = dateBlock.textContent.trim();
      if (newText === targetDateText) {
        obs.disconnect();
        cb();
      }
    });

    obs.observe(dateBlock, { characterData: true, subtree: true, childList: true });

    setTimeout(() => {
      obs.disconnect();
      alert('Date update not detected in time. Please check manually.');
    }, 15000); // Increased timeout
  }

  // ✅ Double-check date before booking
  function waitForBookingSlot(targetTime, targetDateText, timeoutMs, cb) {
    const start = Date.now();
    function check() {
      const dateBlock = document.querySelector('span.date-display');
      const currentDate = dateBlock ? dateBlock.textContent.trim() : '';
      if (currentDate !== targetDateText) {
        if (Date.now() - start < timeoutMs) { setTimeout(check, 100); return; }
        else { alert('Target date not reached in time.'); return; }
      }

      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find(row => row.textContent.includes(targetTime));
      if (targetRow) {
        const bookBtn = Array.from(targetRow.querySelectorAll('button')).find(btn => /book/i.test(btn.textContent.trim()));
        if (bookBtn) { cb(bookBtn, targetRow); return; }
      }
      if (Date.now() - start < timeoutMs) { setTimeout(check, 100); }
      else { alert('Book button not found for ' + targetTime); }
    }
    check();
  }

  // ✅ Confirm booking and log
  function waitForConfirmationButton(timeoutMs) {
    const start = Date.now();
    function check() {
      const confirmBtns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = confirmBtns.find(btn => btn.textContent.includes('Book tee time at ' + teeTime));
      if (confirmBtn) {
        confirmBtn.click();
        const now = new Date().toISOString();
        const logKey = 'bookingTimes';
        const logs = JSON.parse(localStorage.getItem(logKey) || '[]');
        logs.push(now);
        localStorage.setItem(logKey, JSON.stringify(logs));
      } else if (Date.now() - start < timeoutMs) setTimeout(check, 10);
      else alert('Confirmation button not found for ' + teeTime);
    }
    check();
  }
})();
