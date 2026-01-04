
(function () {
  // Passkey prompt
  const secret = String.fromCharCode(51, 56, 52, 54); // "3846"
  const baseCode = secret;
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date();
  const dayLetter = days[today.getDay()];
  const expectedPass = baseCode + dayLetter;

  const passkey = prompt("Booking tool V1.7 : Pacemakers Group members only.\nPlease enter the passcode:");
  if (passkey !== expectedPass) { alert("Access denied."); return; }

  const newpubtime = '13:15'; // Change manually when club decides
  const teeTime = prompt("Enter your target tee time (e.g., 09:10):");
  if (!teeTime) { alert("No tee time entered."); return; }

  const dateBlock = document.querySelector('span.date-display');
  const dateText = dateBlock ? dateBlock.textContent.trim() : '';

  // Compute tomorrow's expected date text
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const expectedDateText = tomorrow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const message = `Waiting until ${newpubtime} UK time to book ${teeTime}${expectedDateText ? ` on ${expectedDateText}` : '.'}\nDo not press Reset.`;
  if (!confirm(message)) { alert('Booking cancelled.'); return; }

  const prevArrow = document.querySelector('a[data-direction="prev"]');
  if (prevArrow) {
    prevArrow.click();
    waitUntilUKTime(newpubtime, function () {
      waitForDateUpdate(expectedDateText, function () {
        waitForBookingSlot(teeTime, expectedDateText, 15000, function (btn) {
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
  function waitForDateUpdate(expectedDateText, cb) {
    const dateBlock = document.querySelector('span.date-display');
    if (!dateBlock) { alert('Date block not found!'); return; }

    const obs = new MutationObserver(() => {
      const newText = dateBlock.textContent.trim();
      if (newText === expectedDateText) {
        obs.disconnect();
        cb();
      }
    });

    obs.observe(dateBlock, { characterData: true, subtree: true, childList: true });

    const nextArrow = document.querySelector('a[data-direction="next"]');
    if (nextArrow) nextArrow.click(); else alert('Next day arrow not found!');

    setTimeout(() => {
      obs.disconnect();
      alert('Date update not detected in time. Please check manually.');
    }, 15000); // Increased timeout
  }

  // ✅ Double-check date before booking
  function waitForBookingSlot(targetTime, expectedDateText, timeoutMs, cb) {
    const start = Date.now();
    function check() {
      const dateBlock = document.querySelector('span.date-display');
      if (!dateBlock || dateBlock.textContent.trim() !== expectedDateText) {
        if (Date.now() - start < timeoutMs) { setTimeout(check, 50); return; }
        else { alert('Target date not reached in time.'); return; }
      }

      const rows = Array.from(document.querySelectorAll('tr'));
      const targetRow = rows.find(row => row.textContent.includes(targetTime));
      if (targetRow) {
        const bookBtn = Array.from(targetRow.querySelectorAll('button')).find(btn => /book/i.test(btn.textContent.trim()));
        if (bookBtn) { cb(bookBtn, targetRow); return; }
      }
      if (Date.now() - start < timeoutMs) { setTimeout(check, 50); }
      else { alert('Book button not found for ' + targetTime); }
    }
    check();
  }

  function waitForConfirmationButton(timeoutMs) {
    const start = Date.now();
    function check() {
      const confirmBtns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = confirmBtns.find(btn => btn.textContent.includes('Book tee time at ' + teeTime));
      if (confirmBtn) {
        confirmBtn.click();
        // Log booking time
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
