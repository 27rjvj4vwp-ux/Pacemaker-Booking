// Version 2.3 (Adds after-publish confirmation + robust timing + DOM stabilisation)
(function () {

    // --------------------------------------------------------------------
    // CONFIGURATION
    // --------------------------------------------------------------------
    // The publish time for new booking sheets (07:45 in winter / 07:15 in summer).
    // Only change this ONE line for seasonal adjustments.
    const newpubtime = "07:45";

    // Optional dynamic input form (disabled for production):
    // const newpubtime = (prompt("Enter publish time (HH:MM) or leave blank for default:") || defaultPubTime).trim();

    // --------------------------------------------------------------------
    // STEP 1: Ask user for their desired tee time
    // --------------------------------------------------------------------
    const teeTime = prompt(
        "Booking tool V2.3 : Pacemakers use only.\nEnter your target tee time (e.g., 09:10):"
    );
    if (!teeTime) { alert("No tee time entered."); return; }

    // --------------------------------------------------------------------
    // STEP 2: Extract the target booking date from the site’s displayed header
    // --------------------------------------------------------------------
    const dateBlock = document.querySelector('span.date-display');
    const targetDateText = dateBlock ? dateBlock.textContent.trim() : '';
    if (!targetDateText) { alert('Target date not found on page.'); return; }

    // Converts site’s display text (e.g. "Friday 2 February 2026")
    // into booking-format "02-02-2026"
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

    // --------------------------------------------------------------------
    // STEP 3: Determine whether publish time is still ahead or already passed
    // --------------------------------------------------------------------
    const now = new Date();
    const [pubH, pubM] = newpubtime.split(':').map(Number);

    const targetPub = new Date();
    targetPub.setHours(pubH, pubM, 0, 0);

    const publishInFuture = (targetPub.getTime() - now.getTime()) > 0;

    // --------------------------------------------------------------------
    // STEP 4: Show appropriate user confirmation message
    // --------------------------------------------------------------------
    if (publishInFuture) {

        // Normal case: Before publish time → script will wait
        const message =
            `${teeTime} on ${targetDateText} selected.\n` +
            `Process will wait until ${newpubtime} UK time to book.\n` +
            `Do not press Reset. Press OK to continue.`;

        if (!confirm(message)) {
            alert('Booking cancelled.');
            return;
        }

    } else {

        // After publish time: Ask user for confirmation before immediate booking
        const message =
            `${teeTime} on ${targetDateText} selected.\n` +
            `${newpubtime} UK time has already passed.\n` +
            `Do you want to book immediately?`;

        if (!confirm(message)) {
            alert('Booking cancelled.');
            return;
        }

        // If user confirms → skip waiting and proceed immediately
    }

    // --------------------------------------------------------------------
    // STEP 5: Move one day back, wait until publish time, then move forward
    // --------------------------------------------------------------------
    const prevArrow = document.querySelector('a[data-direction="prev"]');
    if (prevArrow) {
        prevArrow.click();

        // Allow page to update after clicking "previous"
        setTimeout(() => {

            // Wait until exact publish moment (unless already passed)
            waitUntilUKTime(newpubtime, function () {

                const nextArrow = document.querySelector('a[data-direction="next"]');
                if (nextArrow) {

                    nextArrow.click();

                    // Small buffer before inspecting DOM
                    setTimeout(() => {

                        // Confirm the correct date is displayed
                        waitForDateDisplay(targetDateText, function () {

                            // Poll for the desired tee time row
                            waitForBookingSlot(
                                teeTime,
                                bookingSystemDate,
                                15000,
                                function (btn) {
                                    btn.click();
                                    waitForConfirmationButton(5000);
                                }
                            );
                        });

                    }, 150); // Stabilisation time after clicking next

                } else {
                    alert('Next day arrow not found!');
                    return;
                }
            });

        }, 150); // Stabilisation time after clicking previous

    } else {
        alert('Previous day arrow not found!');
        return;
    }

    // ====================================================================
    //  SUPPORT FUNCTIONS
    // ====================================================================

    // --------------------------------------------------------------------
    // Accurate, stall-resistant timing system
    // --------------------------------------------------------------------
    function waitUntilUKTime(timeStr, cb) {

        // Convert "HH:MM" to a Date object for today
        const [h, m] = timeStr.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);

        const earlyMs = 3000; // Wake 3 seconds early

        function scheduler() {
            const now = Date.now();
            const targetMs = target.getTime();
            const diff = targetMs - now;

            // Enter tight loop when within 3 seconds of target
            if (diff <= earlyMs) {
                const tightLoop = () => {
                    if (Date.now() >= targetMs) cb();
                    else setTimeout(tightLoop, 5);
                };
                return tightLoop();
            }

            // Sleep only small intervals to survive Safari/iOS throttling
            const sleep = Math.min(2000, diff - earlyMs);
            setTimeout(scheduler, sleep);
        }

        scheduler();
    }

    // --------------------------------------------------------------------
    // Wait for the correct date to appear in "date-display"
    // --------------------------------------------------------------------
    function waitForDateDisplay(targetDateText, cb) {

        const dateBlock = document.querySelector('span.date-display');
        if (!dateBlock) { alert('Date block not found!'); return; }

        const start = Date.now();

        // Small delay before beginning polling
        setTimeout(function poll() {
            const newText = dateBlock.textContent.trim();

            // Date now matches what user selected
            if (newText.toLowerCase() === targetDateText.toLowerCase()) {
                setTimeout(cb, 100);
                return;
            }

            // Retry until timeout
            if (Date.now() - start < 15000) {
                setTimeout(poll, 20);
            } else {

                // Safety fallback: click next again to re-trigger the sheet load
                const nextArrow = document.querySelector('a[data-direction="next"]');
                if (nextArrow) {
                    nextArrow.click();
                    setTimeout(poll, 500);
                } else {
                    alert('Next day arrow not found for retry!');
                }
            }

        }, 150);
    }

    // --------------------------------------------------------------------
    // Poll for the booking table and target time row
    // --------------------------------------------------------------------
    function waitForBookingSlot(targetTime, bookingSystemDate, timeoutMs, cb) {

        const start = Date.now();

        function check() {

            const table = document.querySelector('#member_teetimes');

            // Table not yet created or loaded
            if (!table) {
                if (Date.now() - start < timeoutMs) return setTimeout(check, 50);
                return alert('Booking table not found!');
            }

            const rows = Array.from(table.querySelectorAll('tr'));

            // Table exists but rows haven’t been inserted yet
            if (rows.length === 0) {
                if (Date.now() - start < timeoutMs) return setTimeout(check, 50);
                return alert('Booking rows did not load in time.');
            }

            // Search all rows for the target time + correct date
            for (const row of rows) {
                const timeCell = row.querySelector('th.slot-time');

                if (timeCell && timeCell.textContent.trim() === targetTime) {

                    const hiddenDateInput = row.querySelector('input[name="date"]');

                    if (hiddenDateInput && hiddenDateInput.value === bookingSystemDate) {

                        // Find "Book" button for this row
                        let bookBtn = row.querySelector('a.button.inlineBooking.btn-success');

                        // Fallback for alternate button types
                        if (!bookBtn) {
                            bookBtn = Array.from(row.querySelectorAll('button'))
                                .find(btn => /book/i.test(btn.textContent.trim()));
                        }

                        if (bookBtn) return cb(bookBtn, row);
                    }
                }
            }

            // Retry until timeout
            if (Date.now() - start < timeoutMs) return setTimeout(check, 30);

            alert('Book button not found for ' + targetTime + ' on correct date');
        }

        check();
    }

    // --------------------------------------------------------------------
    // After clicking "Book", wait for the confirmation button to appear
    // --------------------------------------------------------------------
    function waitForConfirmationButton(timeoutMs) {

        const start = Date.now();

        function check() {

            const confirmBtns = Array.from(document.querySelectorAll('button, a'));

            // Confirmation button text includes "Book teetime at HH:MM"
            const confirmBtn = confirmBtns.find(btn =>
                btn.textContent.includes('Book teetime at ' + teeTime)
            );

            if (confirmBtn) {

                confirmBtn.click();

                // Log timing info for diagnostics
                const nowPerf = performance.now();
                const nowISO = new Date().toISOString();
                const logs = JSON.parse(localStorage.getItem('bookingTimes') || '[]');

                logs.push({ iso: nowISO, perf: nowPerf });
                localStorage.setItem('bookingTimes', JSON.stringify(logs));

            } else if (Date.now() - start < timeoutMs) {

                // Retry
                setTimeout(check, 20);

            } else {
                alert('Confirmation button not found for ' + teeTime);
            }
        }

        check();
    }

})();
