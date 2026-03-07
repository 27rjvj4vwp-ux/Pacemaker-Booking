// Version 2.5.6a — Intelligent confirmation detection + Safari-safe logging
(function () {

    // --- Configuration ---
    const newpubtime = "07:45"; // "07:15" in summer
    window.lastLogAttempt = new Date().toLocaleString('en-GB');

    // --- Timing Baseline ---
    let dynamicBaseline = null;
    let fixedBaseline = null;

    // --- User Input ---
    let teeTimeRaw = prompt(
        "Booking tool V2.5.6a : Pacemakers use only.\n" +
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

        dynamicBaseline = performance.now();
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

    // --- Intelligent Confirmation Button Detection ---
    function waitForConfirmationButtonPolling(teeTime, timeoutMs) {

        const start = Date.now();

        function isLikelyConfirmationButton(b) {
            const r = b.getBoundingClientRect();
            if (r.width < 60 || r.height < 25) return false;

            const style = window.getComputedStyle(b);
            const bg = style.backgroundColor;
            if (!bg || bg === "transparent") return false;

            const t = (b.innerText || b.textContent || "").toLowerCase();
            if (t.includes(teeTime.toLowerCase())) return true;
            if (t.includes("book") && t.includes("teetime")) return true;

            return false;
        }

        function poll() {
            const btns = Array.from(document.querySelectorAll("button, a, input[type=submit]"));

            let c =
                btns.find(b => (b.innerText || "").toLowerCase().includes("book teetime") &&
                                (b.innerText || "").includes(teeTime)) ||
                btns.find(isLikelyConfirmationButton);

            if (c) {
                // --- WRITE LOG SAFELY ---
                logBookingTime();

                // --- SAFARI-SAFE CONFIRMATION CLICK ---
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

    // --- Logging ---
    function logBookingTime() {
        const now = new Date();
        let elapsedMs;

        if (dynamicBaseline !== null)
            elapsedMs = performance.now() - dynamicBaseline;
        else if (fixedBaseline !== null) {
            const baseline = new Date(now);
            baseline.setHours(pubH, pubM, 0, 0);
            elapsedMs = now.getTime() - baseline.getTime();
        } else {
            elapsedMs = performance.now();
        }

        const entry = [
            now.toLocaleDateString('en-GB'),
            now.getHours().toString().padStart(2, '0'),
            now.getMinutes().toString().padStart(2, '0'),
            now.getSeconds().toString().padStart(2, '0') + "." +
            Math.floor(elapsedMs).toString().padStart(3, '0')
        ].join(',');

        const logs = JSON.parse(localStorage.getItem('bookingTimes') || '[]');
        logs.push(entry);
        localStorage.setItem('bookingTimes', JSON.stringify(logs));
    }

})();
