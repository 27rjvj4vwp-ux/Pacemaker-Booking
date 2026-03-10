// Version 2.6 — Overlay-specific confirmation detection, auto-trim log, explicit mode flag, Safari-safe logging, log format: mode,date,hr,min,sec,milliseconds
(function () {

    // --- Configuration ---
    const newpubtime = "07:45"; // "07:15" in summer

    // --- Mode Tracking ---
    let bookingMode = 'SCH'; // Default to scheduled
    let dynamicBaseline = null;
    let dynamicStartDate = null;
    let fixedBaseline = null;

    // --- User Input ---
    let teeTimeRaw = prompt(
        "Booking tool V2.6 : Pacemakers use only.\n" +
        "Enter your target tee time (e.g., 09:10):"
    );
    if (!teeTimeRaw) { alert("No tee time entered."); return; }

    const match = teeTimeRaw.match(/\b\d{1,2}:\d{2}\b/);
    if (!match) { alert("Invalid tee time entered."); return; }
    const teeTime = match[0];

    // --- Target Date ---
    const dateBlock = document.querySelector('span.date-display');
    const targetDateText = dateBlock ? dateBlock.textContent.trim() : '';
    if (!targetDateText) { alert("Target date not found on this page."); return; }

    function getBookingSystemDate(str) {
        let parts = str.replace(',', '').split(' ');
        let day = parts[1].replace(/\D/g, '').padStart(2, '0');
        let monthName = parts[2];
        let year = parts[3] || (new Date().getFullYear());
        const monthMap = {
            January: '01', February: '02', March: '03', April: '04',
            May: '05', June: '06', July: '07', August: '08',
            September: '09', October: '10', November: '11', December: '12'
        };
        return `${day}-${monthMap[monthName]}-${year}`;
    }

    const bookingSystemDate = getBookingSystemDate(targetDateText);

    // --- Determine Mode ---
    const now = new Date();
    const [pubH, pubM] = newpubtime.split(':').map(Number);
    const targetPub = new Date();
    targetPub.setHours(pubH, pubM, 0, 0);
    const publishInFuture = targetPub.getTime() - now.getTime() > 0;

    if (publishInFuture) {
        // Scheduled mode
        bookingMode = 'SCH';
        if (!confirm(
            `${teeTime} on ${targetDateText} selected.\n` +
            `Process will wait until ${newpubtime} UK time.\n` +
            `Do not press Reset.`
        )) return;

        fixedBaseline = new Date();
        fixedBaseline.setHours(pubH, pubM, 0, 0);

    } else {
        // Immediate mode
        if (!confirm(
            `${teeTime} on ${targetDateText} selected.\n` +
            `${newpubtime} has passed.\n` +
            `Book immediately?`
        )) return;

        bookingMode = 'IM';
        dynamicBaseline = performance.now();
        dynamicStartDate = new Date();
    }

    // --- Navigate Prev → Wait → Next ---
    const prevArrow = document.querySelector('a[data-direction="prev"]');
    if (!prevArrow) { alert("Previous day arrow not found!"); return; }
    prevArrow.click();

    setTimeout(() => waitUntilUKTime(newpubtime, () => {

        const nextArrow = document.querySelector('a[data-direction="next"]');
        if (!nextArrow) { alert("Next day arrow not found!"); return; }
        nextArrow.click();

        setTimeout(() => waitForDateDisplay(targetDateText, () => {

            waitForBookingSlot(teeTime, bookingSystemDate, 2000, (btn) => {
                btn.click();
                waitForConfirmationButtonPolling(teeTime, 5000);
            });

        }), 150);

    }), 150);

    // --- SUPPORT FUNCTIONS ---

    function waitUntilUKTime(timeStr, cb) {
        const [h, m] = timeStr.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);

        const early = 3000;

        function scheduler() {
            const diff = target.getTime() - Date.now();
            if (diff <= early) {
                const loop = () => {
                    if (Date.now() >= target.getTime()) cb();
                    else setTimeout(loop, 5);
                };
                return loop();
            }
            setTimeout(scheduler, Math.min(2000, diff - early));
        }

        if (dynamicBaseline !== null) cb();
        else scheduler();
    }

    function waitForDateDisplay(targetDateText, cb) {
        const block = document.querySelector('span.date-display');
        if (!block) return alert("Date missing!");

        const start = Date.now();
        let clicks = 0;

        setTimeout(function poll() {
            if (block.textContent.trim().toLowerCase() === targetDateText.toLowerCase())
                return setTimeout(cb, 100);

            if (Date.now() - start < 15000)
                return setTimeout(poll, 20);

            const next = document.querySelector('a[data-direction="next"]');
            if (next && clicks < 3) {
                clicks++;
                next.click();
                return setTimeout(poll, 500);
            }

            alert("Failed to find date after several attempts.");
        }, 150);
    }

    function waitForBookingSlot(targetTime, bookingSystemDate, timeoutMs, cb) {
        const start = Date.now();
        function check() {
            const table = document.querySelector('#member_teetimes');
            if (!table) {
                if (Date.now() - start < timeoutMs) return setTimeout(check, 50);
                return alert("Booking table not found!");
            }

            for (const row of table.querySelectorAll('tr')) {
                const tCell = row.querySelector('th.slot-time');
                if (tCell && tCell.textContent.trim() === targetTime) {
                    const dateInput = row.querySelector('input[name="date"]');
                    if (dateInput && dateInput.value === bookingSystemDate) {
                        const btn = Array.from(row.querySelectorAll('a, button')).find(b =>
                            b.className &&
                            b.className.includes('inlineBooking') &&
                            b.className.includes('btn-success') &&
                            b.textContent.trim().toLowerCase() === 'book'
                        );
                        return btn ? cb(btn) : alert("Selected tee time not available.");
                    }
                }
            }

            if (Date.now() - start < timeoutMs) return setTimeout(check, 30);
            alert("Book button not found for " + targetTime);
        }
        check();
    }

    // --- Overlay-specific Confirmation Button Detection ---
    function waitForConfirmationButtonPolling(teeTime, timeoutMs) {
        const start = Date.now();

        function isConfirmationOverlay(el) {
            // Overlay is floating, not inside tee sheet
            if (!el) return false;
            let node = el.parentElement;
            let depth = 0;
            while (node && depth < 5) {
                const style = window.getComputedStyle(node);
                if (
                    (style.position === "absolute" || style.position === "fixed") &&
                    parseInt(style.zIndex, 10) > 100
                ) return true;
                node = node.parentElement;
                depth++;
            }
            return false;
        }

        function poll() {
            // Find all visible buttons/links
            const btns = Array.from(document.querySelectorAll("button, a, input[type=submit]"))
                .filter(b => b.offsetParent !== null);

            // Strict text match: "Book teetime at" + teeTime
            let c = btns.find(b => {
                const t = (b.innerText || b.value || "").toLowerCase();
                return (
                    t.startsWith("book teetime at") &&
                    t.includes(teeTime.toLowerCase()) &&
                    isConfirmationOverlay(b)
                );
            });

            if (c) {
                logBookingTime();

                // Safari/Edge-safe confirmation click
                requestAnimationFrame(() => {
                    setTimeout(() => c.click(), 200);
                });

                return;
            }

            if (Date.now() - start < timeoutMs)
                return setTimeout(poll, 30);

            alert("Confirmation button not found for " + teeTime);
        }

        poll();
    }

    // --- Logging with auto-trim (last 50 entries), explicit mode flag, log format: mode,date,hr,min,sec,milliseconds ---
    function logBookingTime() {
        let logHr, logMin, logSec, delayMs;
        const now = new Date();

        if (bookingMode === 'IM') {
            logHr = dynamicStartDate.getHours().toString().padStart(2, '0');
            logMin = dynamicStartDate.getMinutes().toString().padStart(2, '0');
            logSec = dynamicStartDate.getSeconds().toString().padStart(2, '0');
            delayMs = Math.floor(performance.now() - dynamicBaseline);
        } else if (fixedBaseline !== null) {
            logHr = now.getHours().toString().padStart(2, '0');
            logMin = now.getMinutes().toString().padStart(2, '0');
            logSec = now.getSeconds().toString().padStart(2, '0');
            const baseline = new Date(now);
            baseline.setHours(pubH, pubM, 0, 0);
            delayMs = Math.floor(now.getTime() - baseline.getTime());
        } else {
            logHr = now.getHours().toString().padStart(2, '0');
            logMin = now.getMinutes().toString().padStart(2, '0');
            logSec = now.getSeconds().toString().padStart(2, '0');
            delayMs = Math.floor(performance.now());
        }

        // Pad delay to at least three digits (milliseconds)
        let delayStr = delayMs.toString().padStart(3, '0');

        const entry = [
            bookingMode,
            now.toLocaleDateString('en-GB'),
            logHr,
            logMin,
            logSec,
            delayStr
        ].join(',');

        let logs = [];
        try {
            logs = JSON.parse(localStorage.getItem('bookingTimes') || '[]');
        } catch (e) {
            logs = [];
        }
        if (logs.length >= 50) logs = logs.slice(logs.length - 49);
        logs.push(entry);
        localStorage.setItem('bookingTimes', JSON.stringify(logs));
    }

})();
