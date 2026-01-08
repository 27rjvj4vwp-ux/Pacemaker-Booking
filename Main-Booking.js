// Booking tool v1.7.2 : Pacemakers use only.
// Tight timing + MutationObserver gating to avoid previous-day rows.
// Confirm-button loop tightened to 5 ms.

(function () {
 // const newpubtime = "07:45"; // Hardcode publication time (winter)
  // const teeTime = (prompt("Booking tool V1.7.2 : Pacemakers use only.\nEnter your target tee time (e.g., 09:10):") || '').trim();
  // if (!teeTime) { alert("No tee time entered."); return; }

const defaultPubTime = "07:45";
const newpubtime = (prompt("Booking tool V1.7.2 : Pacemakers use only.\nEnter publish time (HH:MM) or leave blank for default 07:45:") || defaultPubTime).trim();
const teeTime = (prompt("Enter your target tee time (e.g., 09:10):") || '').trim();
if (!teeTime) { alert("No tee time entered."); return; }

  // Capture target date text (from on-page booking envelope)
  const dateBlock = document.querySelector('span.date-display');
  const targetDateText = dateBlock ? dateBlock.textContent.trim() : '';
  if (!targetDateText) { alert('Target date not found on page.'); return; }

  function getBookingSystemDate(str) {
    let parts = str.replace(',', '').split(' ');
    let day = (parts[1] || '').replace(/\D/g, '').padStart(2, '0');
    let monthName = parts[2];
    let year = parts[3] || (new Date().getFullYear().toString());
    const monthMap = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    let month = monthMap[monthName];
    return `${day}-${month}-${year}`;
  }
  const bookingSystemDate = getBookingSystemDate(targetDateText);

  const message = `Waiting until ${newpubtime} UK time to book ${teeTime} on ${targetDateText}\nDo not press Reset.`;
  if (!confirm(message)) { alert('Booking cancelled.'); return; }

  const prevArrow = document.querySelector('a[data-direction="prev"]');
  if (!prevArrow) { alert('Previous day arrow not found!'); return; }

  // --- Tight straight-wait to today's publish time (no roll to tomorrow), with 5 ms final approach ---
  function waitUntilUKTimeTightSameDay(timeStr, cb) {
    const [h, m] = timeStr.split(':').map(Number);
    // Europe/London wall clock for target-setting; scheduling still depends on the tab being foregrounded/awake.
    const ukNow = new Date(new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }));
    const targetUK = new Date(ukNow);
    targetUK.setHours(h, m, 0, 0);

    const targetMs = targetUK.getTime();
    const nowMs = Date.now();
    const delay = targetMs - nowMs;

    if (delay <= 0) {
      // Straight-wait policy: if we're past today's publish time, abort (no roll to tomorrow)
      alert('Publish time for today has passed.');
      return;
    }

    // Wake slightly early, then tighten with a 5 ms micro-ticker
    const early = Math.max(0, delay - 3000); // wake 3 seconds early
    setTimeout(() => {
      const tick = () => {
        if (Date.now() >= targetMs) cb();
        else setTimeout(tick, 5);
      };
      tick();
    }, early);
  }

  // --- MO: wait for date display to show targetDateText (no extra 100 ms delay) ---
  function waitForDateDisplayMO(targetText, cb) {
    const block = document.querySelector('span.date-display');
    if (!block) { alert('Date block not found!'); return; }
    const target = (targetText || '').trim().toLowerCase();

    const matches = () => (block.textContent || '').trim().toLowerCase() === target;
    if (matches()) { cb(); return; }

    const obs = new MutationObserver(() => {
      if (matches()) { obs.disconnect(); cb(); }
    });
    obs.observe(block, { characterData: true, childList: true, subtree: true });

    // Safety cutoff (5 s)
    setTimeout(() => {
      obs.disconnect();
      if (!matches()) alert('Date update not detected in time. Please check manually.');
    }, 5000);
  }

  // --- MO: wait for booking table to contain rows belonging to bookingSystemDate, then locate target slot ---
  // Explicit gating on row hidden date == bookingSystemDate to avoid prior-day residual rows.
  function waitForBookingSlotMO(targetTime, bookingDate, timeoutMs, cb) {
    const table = document.querySelector('#member_teetimes');
    if (!table) { alert('Booking table not found!'); return; }

    const deadline = performance.now() + timeoutMs;
    const targetTimeTrim = (targetTime || '').trim();

    // Scan routine: returns true when we find the correct-day + correct-time + bookable button.
    function scan() {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        // Require hidden date to match the target day to avoid prior-day artifacts.
        const hiddenDateInput = row.querySelector('input[name="date"]');
        if (!hiddenDateInput) continue;
        if (hiddenDateInput.value !== bookingDate) continue;

        const timeCell = row.querySelector('th.slot-time');
        if (!timeCell) continue;
        if (timeCell.textContent.trim() !== targetTimeTrim) continue;

        // Prefer green success button; fall back to text match.
        let bookBtn = row.querySelector('a.button.inlineBooking.btn-success');
        if (!bookBtn) bookBtn = row.querySelector('button.btn-success, a.btn-success');
        if (!bookBtn) {
          bookBtn = Array.from(row.querySelectorAll('button,a'))
            .find(btn => /book/i.test((btn.textContent || '').trim()));
        }
        if (bookBtn) { cb(bookBtn, row); return true; }
      }
      return false;
    }

    if (scan()) return;

    const obs = new MutationObserver(() => {
      if (scan()) { obs.disconnect(); }
      else if (performance.now() > deadline) {
        obs.disconnect();
        alert('Book button not found for ' + targetTimeTrim + ' on correct date');
      }
    });
    obs.observe(table, { childList: true, subtree: true });

    // Hard cutoff to avoid hanging if no mutations occur
    setTimeout(() => {
      if (performance.now() <= deadline) return; // still within budget
      obs.disconnect();
    }, timeoutMs);
  }

  // --- Confirmation button: tightened cadence to 5 ms, 5 s overall (same selector/text logic) ---
  function waitForConfirmationButton(timeoutMs) {
    const start = performance.now();
    function check() {
      const confirmBtns = Array.from(document.querySelectorAll('button, a'));
      const confirmBtn = confirmBtns.find(btn => btn.textContent.includes('Book teetime at ' + teeTime));
      if (confirmBtn) {
        confirmBtn.click();

        // High-precision, absolute epoch + ISO (UTC) + perf delta
        const nowPerf   = performance.now();                         // ms since timeOrigin
        const epochMsHp = performance.timeOrigin + nowPerf;          // absolute epoch (ms)
        const nowISO    = new Date(epochMsHp).toISOString();         // ISO aligned to epochMsHp

        const logKey = 'bookingTimes';
        const logs   = JSON.parse(localStorage.getItem(logKey) || '[]');
        logs.push({ iso: nowISO, perf: nowPerf, epochMsHp: epochMsHp }); // uniform shape
        localStorage.setItem(logKey, JSON.stringify(logs));
      } else if (performance.now() - start < timeoutMs) {
        setTimeout(check, 5); // tightened to 5 ms
      } else {
        alert('Confirmation button not found for ' + teeTime);
      }
    }
    check();
  }

  // --- Main flow ---
  prevArrow.click(); // position to previous day
  waitUntilUKTimeTightSameDay(newpubtime, function () {
    // At publish time, advance to the target day envelope
    const nextArrow = document.querySelector('a[data-direction="next"]');
    if (!nextArrow) { alert('Next day arrow not found!'); return; }
    nextArrow.click();

    // 1) Wait for the date display to show the target day (envelope ready)
    waitForDateDisplayMO(targetDateText, function () {
      // 2) Wait for the table rows that belong to the target day and time; then book.
      waitForBookingSlotMO(teeTime, bookingSystemDate, 10000, function (btn /*, row */) {
        btn.click();
        waitForConfirmationButton(5000);
      });
    });
  });
})();
``
