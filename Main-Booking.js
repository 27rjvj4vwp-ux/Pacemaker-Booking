//Main Booking script
(function () {
 // Passkey prompt based on today's date
 // const secret = String.fromCharCode(51, 56, 52, 54); // "3846"
 // const baseCode = secret;
 // const days = ["S", "M", "T", "W", "T", "F", "S"];
 // const today = new Date();
 // const dayLetter = days[today.getDay()];
 // const expectedPass = baseCode + dayLetter;

 // const passkey = prompt(8"Booking tool V1.7 : Pacemakers use only.\nPlease enter the passcode:");
 // if (passkey !== expectedPass) { alert("Access denied."); return; }

  const newpubtime = "07:45"; // Hardcode publication time
  const teeTime = prompt("Booking tool V1.7.1 : Pacemakers use only.\nEnter your target tee time (e.g., 09:10):");
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

  const message = `Waiting until ${newpubtime} UK time to book ${teeTime} on ${targetDateText}\nDo not press Reset.`;
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

  function waitUntilUKTime(timeStr, cb) {
    const [h, m] = timeStr.split(':').map(Number);
    const ukNow = new Date(new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }));
    const targetUK = new Date(ukNow);
    targetUK.setHours(h, m, 0, 0);
    if (targetUK < ukNow) targetUK.setDate(targetUK.getDate() + 1);
    const delayMs = targetUK.getTime() - ukNow.getTime();
    setTimeout(cb, delayMs);
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
 
// High-precision, absolute epoch + ISO (UTC) + perf delta
const nowPerf   = performance.now();                         // ms since timeOrigin
const epochMsHp = performance.timeOrigin + nowPerf;          // absolute epoch (ms)
const nowISO    = new Date(epochMsHp).toISOString();         // ISO aligned to epochMsHp

const logKey = 'bookingTimes';
const logs   = JSON.parse(localStorage.getItem(logKey) || '[]');
logs.push({ iso: nowISO, perf: nowPerf, epochMsHp: epochMsHp }); // uniform shape
localStorage.setItem(logKey, JSON.stringify(logs));
       
      // const nowPerf = performance.now(); // High-resolution timestamp
       // const nowISO = new Date().toISOString();
       // const logKey = 'bookingTimes';
       // const logs = JSON.parse(localStorage.getItem(logKey) || '[]');
       // logs.push({ iso: nowISO, perf: nowPerf });
       // localStorage.setItem(logKey, JSON.stringify(logs));
      } else if (Date.now() - start < timeoutMs) setTimeout(check, 10);
      else alert('Confirmation button not found for ' + teeTime);
    }
    check();
  }
})();
