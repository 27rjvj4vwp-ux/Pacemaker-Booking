// Version 2.4.7 (Prevents multiple simultaneous runs)
(function () {
    if (window.pacemakerScriptRunning) {
        alert("Booking script is already running!");
        return;
    }
    window.pacemakerScriptRunning = true;

    // --- Configuration ---
    const newpubtime = "07:45"; // Change for summer if needed

    // --- User Input ---
    let teeTimeRaw = prompt(
        "Booking tool V2.4.7 : Pacemakers use only.\n" +
        "Enter your target tee time (e.g., 09:10):"
    );
    if (!teeTimeRaw) { window.pacemakerScriptRunning = false; alert("No tee time entered."); return; }

    // Extract clean HH:MM pattern
    const match = teeTimeRaw.match(/\b\d{1,2}:\d{2}\b/);
    if (!match) { window.pacemakerScriptRunning = false; alert("Invalid tee time entered."); return; }
    const teeTime = match[0];

    // --- Target Date ---
    const dateBlock = document.querySelector('span.date-display');
    const targetDateText = dateBlock ? dateBlock.textContent.trim() : '';
    if (!targetDateText) { window.pacemakerScriptRunning = false; alert('Target date not found on page.'); return; }

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

    // --- Wait or Book Immediately? ---
    const now = new Date();
    const [pubH, pubM] = newpubtime.split(':').map(Number);
    const targetPub = new Date();
    targetPub.setHours(pubH, pubM, 0, 0);
    const publishInFuture = (targetPub.getTime() - now.getTime()) > 0;

    // --- User Confirmation ---
    if (publishInFuture) {
        const msg =
            `${teeTime} on ${targetDateText} selected.\n` +
            `Process will wait until ${newpubtime} UK time to book.\n` +
            `Do not press Reset.`;
        if (!confirm(msg)) { window.pacemakerScriptRunning = false; return; }
    } else {
        const msg =
            `${teeTime} on ${targetDateText} selected.\n` +
            `${newpubtime} has passed.\n` +
            `Book immediately?`;
        if (!confirm(msg)) { window.pacemakerScriptRunning = false; return; }
    }

    // --- Prev → Wait → Next ---
    const prevArrow = document.querySelector('a[data-direction="prev"]');
    if (!prevArrow) { window.pacemakerScriptRunning = false; alert('Previous day arrow not found!'); return; }

    prevArrow.click();

    setTimeout(() => {

        waitUntilUKTime(newpubtime, () => {

            const nextArrow = document.querySelector('a[data-direction="next"]');
            if (!nextArrow) { window.pacemakerScriptRunning = false; alert("Next day arrow not found!"); return; }

            nextArrow.click();

            setTimeout(() => {

                waitForDateDisplay(targetDateText, () => {

                    waitForBookingSlot(teeTime, bookingSystemDate, 2000, (btn) => {
                        btn.click();
                        waitForConfirmationButton(5000);
                    });

                });

            }, 150);

        });

    }, 150);

    // --- SUPPORT FUNCTIONS ---

    function waitUntilUKTime(timeStr, cb) {
        const [h, m] = timeStr.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);

        const early = 3000;

        function scheduler() {
            const nowMs = Date.now();
            const diff = target.getTime() - nowMs;

            if (diff <= early) {
                const loop = () => {
                    if (Date.now() >= target.getTime()) {
                        cb();
                    } else setTimeout(loop, 5);
                };
                return loop();
            }

            const sleep = Math.min(2000, diff - early);
            setTimeout(scheduler, sleep);
        }

        scheduler();
    }

    function waitForDateDisplay(targetDateText, cb) {
        const block = document.querySelector('span.date-display');
        if (!block) { window.pacemakerScriptRunning = false; alert("Date missing"); return; }

        const start = Date.now();
        let nextDayClicks = 0;
        const maxNextDayClicks = 3; // Limit to 3 cycles

        setTimeout(function poll() {
            const txt = block.textContent.trim();

            if (txt.toLowerCase() === targetDateText.toLowerCase()) {
                return setTimeout(cb, 100);
            }

            if (Date.now() - start < 15000) {
                return setTimeout(poll, 20);
            }

            const next = document.querySelector('a[data-direction="next"]');
            if (next && nextDayClicks < maxNextDayClicks) {
                nextDayClicks++;
                next.click();
                return setTimeout(poll, 500);
            }

            window.pacemakerScriptRunning = false;
            alert("Failed to find the correct date after several attempts. Please check the booking sheet and try again.");
        }, 150);
    }

    function waitForBookingSlot(targetTime, bookingSystemDate, timeoutMs, cb) {
        const start = Date.now();

        function check() {
            const table = document.querySelector('#member_teetimes');

            if (!table) {
                if (Date.now() - start < timeoutMs) {
                    return setTimeout(check, 50);
                }
                window.pacemakerScriptRunning = false;
                return alert("Booking table not found!");
            }

            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length === 0) {
                if (Date.now() - start < timeoutMs) {
                    return setTimeout(check, 50);
                }
                window.pacemakerScriptRunning = false;
                return alert("Booking rows did not load");
            }

            let slotRowFound = false;
            for (const row of rows) {
                const tCell = row.querySelector('th.slot-time');
                if (!tCell) continue;

                if (tCell.textContent.trim() === targetTime) {
                    const dateInput = row.querySelector('input[name="date"]');
                    if (dateInput && dateInput.value === bookingSystemDate) {
                        slotRowFound = true;

                        let btn = row.querySelector('a.button.inlineBooking.btn-success');
                        if (!btn) {
                            btn = Array.from(row.querySelectorAll('button'))
                                       .find(b => /book/i.test(b.textContent.trim()));
                        }

                        if (btn) {
                            return cb(btn, row);
                        } else {
                            window.pacemakerScriptRunning = false;
                            alert("The selected tee time (" + targetTime + ") is not available to book.");
                            return;
                        }
                    }
                }
            }

            if (!slotRowFound && (Date.now() - start < timeoutMs)) {
                return setTimeout(check, 30);
            }

            if (!slotRowFound) {
                window.pacemakerScriptRunning = false;
                alert("Book button not found for " + targetTime + " on correct date");
            }
        }

        check();
    }

    function waitForConfirmationButton(timeoutMs) {
        const start = Date.now();

        function check() {
            const btns = Array.from(document.querySelectorAll('button, a'));

            const c = btns.find(
                b => b.textContent.includes('Book teetime at ' + teeTime)
            );

            if (c) {
                c.click();

                // Log performance time
                const nowPerf = performance.now();
                const nowISO = new Date().toISOString();
                const logs = JSON.parse(localStorage.getItem('bookingTimes') || '[]');

                logs.push({ iso: nowISO, perf: nowPerf });
                localStorage.setItem('bookingTimes', JSON.stringify(logs));
                window.pacemakerScriptRunning = false;
                return;
            }

            if (Date.now() - start < timeoutMs) {
                return setTimeout(check, 20);
            }

            window.pacemakerScriptRunning = false;
            alert("Confirmation not found for " + teeTime);
        }

        check();
    }

})();
