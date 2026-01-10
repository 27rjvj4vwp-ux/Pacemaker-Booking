// Version 2.0
(function () {

  // Dynamic publish time for testing
  const newpubtime = "07:45";
  // const newpubtime = (prompt("Enter publish time (HH:MM) or leave blank for default 07:45:") || defaultPubTime).trim();
  const teeTime = prompt("Booking tool V2.0 : Pacemakers use only.\nEnter your target tee time (e.g., 09:10):");
  if (!teeTime) { alert("No tee time entered."); return; }

  // Capture target date
  const dateBlock = document.querySelector('span.date-display');
  const targetDateText = dateBlock ? dateBlock.textContent.trim() : '';
  if (!targetDateText) { alert('Target date not found on page.'); return; }

  function getBookingSystemDate(str) {
    let parts = str.replace(',', '').split(' ');
    let day = parts[1].replace(/\D/g, '').padStart(2, '0');
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

  const message = `Wait until ${newpubtime} UK time to book ${teeTime} on ${targetDateText}.\nDo not press Reset.\nPress OK to enter Wait.`;
  if (!confirm(message)) { alert('Booking cancelled.'); return; }

  const prevArrow = document.querySelector('a[data-direction="prev"]');
  if (prevArrow) {
    prevArrow.click();
    waitUntilUKTime(newpubtime, function () {
      const nextArrow = document.querySelector('a[data-direction="next"]');
      if (nextArrow) {
        nextArrow.click();
      } else { alert('Next day arrow not found!'); return; }

      waitForDateDisplay(targetDateText, function () {
        waitForBookingSlot(teeTime, bookingSystemDate, 10000, function (btn) {
          btn.click();
          waitForConfirmationButton(5000);
        });
      });
    });
  } else { alert('Previous day arrow not found!'); }

 // --- Fixed wait logic: UK time, safe delay calculation ---
  function waitUntilUKTime(timeStr, cb) {
    const [h, m] = timeStr.split(':').map(Number);
    const ukNow = new Date(new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }));
    const targetUK = new Date(ukNow);
    targetUK.setHours(h, m, 0, 0);

    let delay = targetUK.getTime() - ukNow.getTime();
    if (delay <= 0) {
      alert('Warning: Publish time for today has passed.');
      return;
    }

    // Wake 3 seconds early
    delay = Math.max(0, delay - 3000);
    setTimeout(() => {
      const tick = () => {
        if (new Date(new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })).getTime() >= targetUK.getTime()) cb();
        else setTimeout(tick, 5);
      };
      tick();
    }, delay);
  }

function waitForDateDisplay(targetDateText, cb) {
    const dateBlock = document.querySelector('span.date-display');
    if (!dateBlock) { alert('Date block not found!'); return; }
    const start = Date.now();
    function poll() {
      const newText = dateBlock.textContent.trim();
      if (newText.toLowerCase() === targetDateText.toLowerCase()) {
        setTimeout(cb, 100);
        return;
      }
      if (Date.now() - start < 5000) setTimeout(poll, 10);
      else alert('Date update not detected in time. Please check manually.');
    }
    poll();
  }

  function waitForBookingSlot(targetTime, bookingSystemDate, timeoutMs, cb) {
    const start = Date.now();
    function check() {
      const table = document.querySelector('#member_teetimes');
      if (!table) { alert('Booking table not found!'); return; }
      const rows = Array.from(table.querySelectorAll('tr'));
      for (const row of rows) {
        const timeCell = row.querySelector('th.slot-time');
        if (timeCell && timeCell.textContent.trim() === teeTime) {
          const hiddenDateInput = row.querySelector('input[name="date"]');
          if (hiddenDateInput) {
            const rowDate = hiddenDateInput.value;
            if (rowDate === bookingSystemDate) {
              let bookBtn = row.querySelector('a.button.inlineBooking.btn-success');
              if (!bookBtn) {
                bookBtn = Array.from(row.querySelectorAll('button')).find(btn => /book/i.test(btn.textContent.trim()));
              }
              if (bookBtn) { cb(bookBtn, row); return; }
            }
          }
        }
      }
      if (Date.now() - start < timeoutMs) { setTimeout(check, 10); }
      else { alert('Book button not found for ' + targetTime + ' on correct date'); }
    }
    check();
  }

  function waitForConfirmationButton(timeoutMs) {
    const start = Date.now();
    function check() {
      const confirmBtns = Array.from(document.querySelectorAll('button, a'));
      const confirmBtn = confirmBtns.find(btn => btn.textContent.includes('Book teetime at ' + teeTime));
      if (confirmBtn) {
        confirmBtn.click();
        const nowPerf = performance.now(); // High-resolution timestamp
        const nowISO = new Date().toISOString();
        const logKey = 'bookingTimes';
        const logs = JSON.parse(localStorage.getItem(logKey) || '[]');
        logs.push({ iso: nowISO, perf: nowPerf });
        localStorage.setItem(logKey, JSON.stringify(logs));
      } else if (Date.now() - start < timeoutMs) setTimeout(check, 10);
      else alert('Confirmation button not found for ' + teeTime);
    }
    check();
  }
})();
