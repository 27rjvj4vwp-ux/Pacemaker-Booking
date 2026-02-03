// Version 2.3 (Adds "after newpubtime" confirmation logic)
(function () {

    // Flip dynamic publish time for testing
    const newpubtime = "07:45"; // change to defaultPubTime = "07:45"; for testing
    //const newpubtime = (prompt("Enter publish time (HH:MM) or leave blank for default:") || defaultPubTime).trim();

    const teeTime = prompt("Booking tool V2.3 : Pacemakers use only.\nEnter your target tee time (e.g., 09:10):");
    if (!teeTime) { alert("No tee time entered."); return; }

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

    // -------------------------------------------------------------------------
    // NEW LOGIC: Detect whether newpubtime is in the past, and confirm behaviour
    // -------------------------------------------------------------------------

    const now = new Date();
    const [pubH, pubM] = newpubtime.split(':').map(Number);
    const targetPub = new Date();
    targetPub.setHours(pubH, pubM, 0, 0);

    const publishInFuture = (targetPub.getTime() - now.getTime()) > 0;

    if (publishInFuture) {
        // NORMAL CASE (e.g., 06:30 → 07:45 still ahead)
        const message =
            `${teeTime} on ${targetDateText} selected.\n` +
            `Process will wait until ${newpubtime} UK time to book.\n` +
            `Do not press Reset. Press OK to continue.`;

        if (!confirm(message)) {
            alert('Booking cancelled.'); 
            return;
        }

    } else {
        // AFTER PUBLISH TIME (e.g., 08:00 → 07:45 has passed)
        const message =
            `${teeTime} on ${targetDateText} selected.\n` +
            `${newpubtime} UK time has already passed.\n` +
            `Do you want to book immediately?`;

        if (!confirm(message)) {
            alert('Booking cancelled.');
            return;
        }
        // If user confirms → proceed immediately without waiting
    }

    // -----------------------------------------------------------
    // EXISTING LOGIC (unchanged)
    // -----------------------------------------------------------

    const prevArrow = document.querySelector('a[data-direction="prev"]');
    if (prevArrow) {
        prevArrow.click();

        // Give DOM time to update after clicking "previous"
        setTimeout(() => {

            waitUntilUKTime(newpubtime, function () {
                const nextArrow = document.querySelector('a[data-direction="next"]');
                if (nextArrow) {
                    nextArrow.click();

                    // Stabilisation delay before reading DOM
                    setTimeout(() => {

                        waitForDateDisplay(targetDateText, function () {
                            waitForBookingSlot(teeTime, bookingSystemDate, 15000, function (btn) {
                                btn.click();
                                waitForConfirmationButton(5000);
                            });
                        });

                    }, 150);
                } else { alert('Next day arrow not found!'); return; }
            });

        }, 150);
    } else { alert('Previous day arrow not found!'); return; }

    // -----------------------------------------------------------
    // Robust waitUntilUKTime()
    // -----------------------------------------------------------
    function waitUntilUKTime(timeStr, cb) {
        const [h, m] = timeStr.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);

        const earlyMs = 3000;

        function scheduler() {
            const now = Date.now();
            const targetMs = target.getTime();
            const diff = targetMs - now;

            if (diff <= earlyMs) {
                const tightLoop = () => {
                    if (Date.now() >= targetMs) cb();
                    else setTimeout(tightLoop, 5);
                };
                return tightLoop();
            }

            const sleep = Math.min(2000, diff - earlyMs);
            setTimeout(scheduler, sleep);
        }

        scheduler();
    }

    // -----------------------------------------------------------
    // Improved date display polling
    // -----------------------------------------------------------
    function waitForDateDisplay(targetDateText, cb) {
        const dateBlock = document.querySelector('span.date-display');
        if (!dateBlock) { alert('Date block not found!'); return; }

        const start = Date.now();

        setTimeout(function poll() {
            const newText = dateBlock.textContent.trim();
            if (newText.toLowerCase() === targetDateText.toLowerCase()) {
                setTimeout(cb, 100);
                return;
            }
            if (Date.now() - start < 15000) setTimeout(poll, 20);
            else {
                const nextArrow = document.querySelector('a[data-direction="next"]');
                if (nextArrow) {
                    nextArrow.click();
                    setTimeout(poll, 500);
                } else alert('Next day arrow not found for retry!');
            }
        }, 150);
    }

    // -----------------------------------------------------------
    // Stronger booking slot detection
    // -----------------------------------------------------------
    function waitForBookingSlot(targetTime, bookingSystemDate, timeoutMs, cb) {
        const start = Date.now();

        function check() {
            const table = document.querySelector('#member_teetimes');
            if (!table) {
                if (Date.now() - start < timeoutMs) return setTimeout(check, 50);
                return alert('Booking table not found!');
            }

            const rows = Array.from(table.querySelectorAll('tr'));

            if (rows.length === 0) {
                if (Date.now() - start < timeoutMs) return setTimeout(check, 50);
                return alert('Booking rows did not load in time.');
            }

            for (const row of rows) {
                const timeCell = row.querySelector('th.slot-time');
                if (timeCell && timeCell.textContent.trim() === targetTime) {
                    const hiddenDateInput = row.querySelector('input[name="date"]');
                    if (hiddenDateInput && hiddenDateInput.value === bookingSystemDate) {

                        let bookBtn = row.querySelector('a.button.inlineBooking.btn-success');
                        if (!bookBtn) {
                            bookBtn = Array.from(row.querySelectorAll('button')).find(btn => /book/i.test(btn.textContent.trim()));
                        }

                        if (bookBtn) return cb(bookBtn, row);
                    }
                }
            }

            if (Date.now() - start < timeoutMs) return setTimeout(check, 30);

            alert('Book button not found for ' + targetTime + ' on correct date');
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
                const nowPerf = performance.now();
                const nowISO = new Date().toISOString();
                const logs = JSON.parse(localStorage.getItem('bookingTimes') || '[]');
                logs.push({ iso: nowISO, perf: nowPerf });
                localStorage.setItem('bookingTimes', JSON.stringify(logs));
            } else if (Date.now() - start < timeoutMs) setTimeout(check, 20);
            else alert('Confirmation button not found for ' + teeTime);
        }
        check();
    }

})();
