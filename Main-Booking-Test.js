// Version 2.5.3 (robust selectors and improved logging)
(function () {

    // --- Configuration ---
    const newpubtime = "07:45"; // Change to "07:15" for summer booking

    // --- Timing Baseline (dynamic for immediate bookings) ---
    let dynamicBaseline = null; // For immediate booking
    let fixedBaseline = null;   // For normal booking

    // --- User Input ---
    let teeTimeRaw = prompt(
        "Booking tool V2.5.3 : Pacemakers use only.\n" +
        "Enter your target tee time (e.g., 09:10):"
    );
    if (!teeTimeRaw) { alert("No tee time entered."); return; }

    const match = teeTimeRaw.match(/\b\d{1,2}:\d{2}\b/);
    if (!match) { alert("Invalid tee time entered."); return; }
    const teeTime = match[0];

    // --- Target Date ---
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

    // --- Determines Normal vs Immediate Mode ---
    const now = new Date();
    const [pubH, pubM] = newpubtime.split(':').map(Number);
    const targetPub = new Date();
    targetPub.setHours(pubH, pubM, 0, 0);

    const publishInFuture = (targetPub.getTime() - now.getTime()) > 0;

    // --- User Confirmation & Baseline Assignment ---
    if (publishInFuture) {
        // Normal booking
        const msg =
            `${teeTime} on ${targetDateText} selected.\n` +
            `Process will wait until ${newpubtime} UK time to book.\n` +
            `Do not press Reset.`;
        if (!confirm(msg)) return;

        fixedBaseline = new Date();
        fixedBaseline.setHours(pubH, pubM, 0, 0);

    } else {
        // Immediate booking → set dynamic baseline
        const msg =
            `${teeTime} on ${targetDateText} selected.\n` +
            `${newpubtime} has passed.\n` +
            `Book immediately?`;
        if (!confirm(msg)) return;

        dynamicBaseline = performance.now(); // new baseline
    }

    // --- Prev → Wait → Next ---
    const prevArrow = document.querySelector('a[data-direction="prev"]');
    if (!prevArrow) { alert('Previous day arrow not found!'); return; }

    prevArrow.click();

    setTimeout(() => {

        waitUntilUKTime(newpubtime, () => {

            const nextArrow = document.querySelector('a[data-direction="next"]');
            if (!nextArrow) { alert("Next day arrow not found!"); return; }

            nextArrow.click();

            setTimeout(() => {

                waitForDateDisplay(targetDateText, () => {

                    waitForBookingSlot(teeTime, bookingSystemDate, 2000, (btn) => {
                        btn.click();
                        waitForConfirmationButtonMutationObserver(teeTime, 5000);
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
                    if (Date.now() >= target.getTime()) cb();
                    else setTimeout(loop, 5);
                };
                return loop();
            }

            const sleep = Math.min(2000, diff - early);
            setTimeout(scheduler, sleep);
        }

        if (dynamicBaseline !== null) {
            // Immediate booking → skip wait
            cb();
        } else {
            scheduler();
        }
    }

    function waitForDateDisplay(targetDateText, cb) {
        const block = document.querySelector('span.date-display');
        if (!block) { alert("Date missing"); return; }

        const start = Date.now();
        let nextDayClicks = 0;
        const maxNextDayClicks = 3;

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

            alert("Failed to find date after several attempts.");
        }, 150);
    }

    // --- Robust slot booking button selector ---
    function waitForBookingSlot(targetTime, bookingSystemDate, timeoutMs, cb) {
        const start = Date.now();

        function check() {
            const table = document.querySelector('#member_teetimes');

            if (!table) {
                if (Date.now() - start < timeoutMs) return setTimeout(check, 50);
                return alert("Booking table not found!");
            }

            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length === 0) {
                if (Date.now() - start < timeoutMs) return setTimeout(check, 50);
                return alert("Booking rows not loaded");
            }

            for (const row of rows) {
                const tCell = row.querySelector('th.slot-time');
                if (!tCell) continue;

                if (tCell.textContent.trim() === targetTime) {
                    const dateInput = row.querySelector('input[name="date"]');
                    if (dateInput && dateInput.value === bookingSystemDate) {
                        // Robust selector for slot booking button
                        let btn = Array.from(row.querySelectorAll('a, button')).find(b =>
                            b.className &&
                            b.className.includes('inlineBooking') &&
                            b.className.includes('btn-success') &&
                            b.textContent &&
                            b.textContent.trim().toLowerCase() === 'book'
                        );
                        if (btn) return cb(btn, row);

                        return alert("The selected tee time is not available.");
                    }
                }
            }

            if (Date.now() - start < timeoutMs) return setTimeout(check, 30);

            alert("Book button not found for " + targetTime);
        }

        check();
    }

    // --- MutationObserver-based confirmation pop-up handler with tolerant selector ---
    function waitForConfirmationButtonMutationObserver(teeTime, timeoutMs) {
        let found = false;
        let timer;

        function tryClickConfirmation() {
            const btns = Array.from(document.querySelectorAll('button, a'));
            // Match if text contains "Book teetime at" and the teeTime
            const c = btns.find(b =>
                b.textContent &&
                b.textContent.toLowerCase().includes("book teetime at") &&
                b.textContent.includes(teeTime)
            );
            if (c && !found) {
                found = true;
                c.click();
                if (timer) clearTimeout(timer);
                if (observer) observer.disconnect();
                logBookingTime();
            }
        }

        const observer = new MutationObserver(tryClickConfirmation);
        observer.observe(document.body, { childList: true, subtree: true });

        timer = setInterval(tryClickConfirmation, 20);

        setTimeout(() => {
            if (!found) {
                if (observer) observer.disconnect();
                if (timer) clearInterval(timer);
                alert("Confirmation pop-up not found for " + teeTime);
            }
        }, timeoutMs);

        tryClickConfirmation();
    }

    // --- Improved logging function ---
    function logBookingTime() {
        let elapsedMs;
        const now = new Date();

        if (dynamicBaseline !== null) {
            // Immediate booking mode: use dynamic baseline
            elapsedMs = performance.now() - dynamicBaseline;
        } else if (fixedBaseline !== null) {
            // Scheduled booking: use fixed baseline (e.g., 07:45 or 07:15)
            const baseline = new Date(now);
            baseline.setHours(pubH, pubM, 0, 0);
            elapsedMs = now.getTime() - baseline.getTime();
        } else {
            // Fallback: just use performance.now()
            elapsedMs = performance.now();
        }

        const entry = [
            now.toLocaleDateString('en-GB'),
            now.getHours().toString().padStart(2, '0'),
            now.getMinutes().toString().padStart(2, '0'),
            now.getSeconds().toString().padStart(2, '0') + "." +
            Math.floor(elapsedMs).toString().padStart(3, '0')
        ].join(',');
        // debug output
        console.log("Booking log entry.",entry);
        const logs = JSON.parse(localStorage.getItem('bookingTimes') || '[]');
        logs.push(entry);
        localStorage.setItem('bookingTimes', JSON.stringify(logs));
    }

})();
