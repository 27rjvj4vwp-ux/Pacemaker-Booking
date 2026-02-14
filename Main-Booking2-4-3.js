// Version 2.4.3 (Robust debug toggle + debug overlay + HH:MM tee-time extractor)
(function () {

    // --------------------------------------------------------------------
    // CONFIGURATION
    // --------------------------------------------------------------------
    const newpubtime = "07:45"; // Summer adjust: "07:15"


    // --------------------------------------------------------------------
    // STEP 1: USER INPUT
    // --------------------------------------------------------------------
    let teeTimeRaw = prompt(
        "Booking tool V2.4.3 : Pacemakers use only.\n" +
        "Enter your target tee time (e.g., 09:10 or 09:10 /b for debug mode):"
    );
    if (!teeTimeRaw) { alert("No tee time entered."); return; }


    // --------------------------------------------------------------------
    // DEBUG MODE TOGGLE
    // --------------------------------------------------------------------
    // Detect /b, /d, /debug, or "debug"
    let debugMode =
        /\/b/i.test(teeTimeRaw) ||
        /\/d/i.test(teeTimeRaw) ||
        /\/debug/i.test(teeTimeRaw) ||
        /debug/i.test(teeTimeRaw);

    // Extract clean HH:MM pattern
    const match = teeTimeRaw.match(/\b\d{1,2}:\d{2}\b/);
    if (!match) {
        alert("Invalid tee time entered.");
        return;
    }
    const teeTime = match[0]; // Safe extraction


    // --------------------------------------------------------------------
    // DEBUG OVERLAY INITIALISATION
    // --------------------------------------------------------------------
    function createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'bookingDebugPanel';
        panel.style.position = 'fixed';
        panel.style.bottom = '10px';
        panel.style.right = '10px';
        panel.style.width = '260px';
        panel.style.maxHeight = '180px';
        panel.style.overflowY = 'auto';
        panel.style.background = 'rgba(0,0,0,0.7)';
        panel.style.color = '#0f0';
        panel.style.fontSize = '12px';
        panel.style.fontFamily = 'monospace';
        panel.style.padding = '8px';
        panel.style.borderRadius = '6px';
        panel.style.zIndex = '999999';
        panel.style.whiteSpace = 'pre-wrap';
        panel.style.pointerEvents = 'none';
        document.body.appendChild(panel);
    }

    // dbg() is a no-op unless debug is on
    function dbg(msg) {}

    if (debugMode) {
        createDebugPanel();
        dbg = function(msg) {
            const panel = document.getElementById('bookingDebugPanel');
            if (!panel) return;
            const ts = new Date().toISOString().substr(11, 12); // HH:MM:SS.mmm
            panel.textContent += `[${ts}] ${msg}\n`;
            panel.scrollTop = panel.scrollHeight;
        };
        dbg("DEBUG MODE ENABLED");
        dbg("Raw input: " + teeTimeRaw);
        dbg("Clean tee time: " + teeTime);
    }


    // --------------------------------------------------------------------
    // STEP 2: CAPTURE TARGET DATE FROM PAGE
    // --------------------------------------------------------------------
    const dateBlock = document.querySelector('span.date-display');
    const targetDateText = dateBlock ? dateBlock.textContent.trim() : '';
    if (!targetDateText) {
        alert('Target date not found on page.');
        dbg("ERROR: Target date missing");
        return;
    }
    dbg("Target date detected: " + targetDateText);

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
    dbg("Booking system date: " + bookingSystemDate);


    // --------------------------------------------------------------------
    // STEP 3: DETERMINE WHETHER WE WAIT OR BOOK IMMEDIATELY
    // --------------------------------------------------------------------
    const now = new Date();
    const [pubH, pubM] = newpubtime.split(':').map(Number);

    const targetPub = new Date();
    targetPub.setHours(pubH, pubM, 0, 0);

    const publishInFuture = (targetPub.getTime() - now.getTime()) > 0;
    dbg("Publish in future? " + publishInFuture);


    // --------------------------------------------------------------------
    // STEP 4: CONFIRMATION POP-UP
    // --------------------------------------------------------------------
    if (publishInFuture) {
        const msg =
            `${teeTime} on ${targetDateText} selected.\n` +
            `Process will wait until ${newpubtime} UK time to book.\n` +
            `Do not press Reset. Press OK to continue.`;

        dbg("Prompting user to confirm WAIT");

        if (!confirm(msg)) {
            alert("Booking cancelled.");
            dbg("User cancelled");
            return;
        }

    } else {
        const msg =
            `${teeTime} on ${targetDateText} selected.\n` +
            `${newpubtime} has already passed.\n` +
            `Do you want to book immediately?`;

        dbg("Prompting user to confirm IMMEDIATE");

        if (!confirm(msg)) {
            alert("Booking cancelled.");
            dbg("User cancelled");
            return;
        }
        dbg("User approved immediate booking");
    }


    // --------------------------------------------------------------------
    // STEP 5: NAVIGATION – PREV → WAIT → NEXT
    // --------------------------------------------------------------------
    const prevArrow = document.querySelector('a[data-direction="prev"]');
    if (!prevArrow) {
        alert('Previous day arrow not found!');
        dbg("ERROR: prev arrow missing");
        return;
    }

    dbg("Clicking prev arrow");
    prevArrow.click();

    setTimeout(() => {

        dbg("Starting waitUntilUKTime");
        waitUntilUKTime(newpubtime, function () {

            const nextArrow = document.querySelector('a[data-direction="next"]');
            if (!nextArrow) {
                alert('Next day arrow not found!');
                dbg("ERROR: next arrow missing");
                return;
            }

            dbg("Clicking next arrow");
            nextArrow.click();

            setTimeout(() => {

                dbg("Polling for correct date");
                waitForDateDisplay(targetDateText, function () {

                    dbg("Correct date confirmed. Searching for slot.");
                    waitForBookingSlot(
                        teeTime,
                        bookingSystemDate,
                        15000,
                        function (btn) {
                            dbg("Slot found. Clicking Book.");
                            btn.click();
                            waitForConfirmationButton(5000);
                        }
                    );

                });

            }, 150);
        });

    }, 150);



    // ====================================================================
    // SUPPORT FUNCTIONS
    // ====================================================================

    function waitUntilUKTime(timeStr, cb) {
        dbg("Entering waitUntilUKTime(" + timeStr + ")");

        const [h, m] = timeStr.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);

        const earlyMs = 3000;

        function scheduler() {
            const nowMs = Date.now();
            const targetMs = target.getTime();
            const diff = targetMs - nowMs;

            if (diff <= earlyMs) {
                dbg("Close to publish time; entering tight loop");
                const tightLoop = () => {
                    if (Date.now() >= targetMs) {
                        dbg("Publish time reached");
                        cb();
                    } else setTimeout(tightLoop, 5);
                };
                return tightLoop();
            }

            const sleep = Math.min(2000, diff - earlyMs);
            dbg("Sleeping " + sleep + "ms");
            setTimeout(scheduler, sleep);
        }

        scheduler();
    }


    function waitForDateDisplay(targetDateText, cb) {
        const dateBlock = document.querySelector('span.date-display');
        if (!dateBlock) {
            alert("Date block not found!");
            dbg("ERROR: missing date block");
            return;
        }

        const start = Date.now();

        setTimeout(function poll() {
            const txt = dateBlock.textContent.trim();

            if (txt.toLowerCase() === targetDateText.toLowerCase()) {
                dbg("Date matched");
                return setTimeout(cb, 100);
            }

            if (Date.now() - start < 15000) {
                dbg("Date mismatch; retry");
                return setTimeout(poll, 20);
            }

            dbg("Timeout in date wait; retrying next arrow");
            const next = document.querySelector('a[data-direction="next"]');
            if (next) {
                next.click();
                setTimeout(poll, 500);
            } else {
                alert("Next arrow not found!");
                dbg("ERROR: next arrow missing");
            }
        }, 150);
    }


    function waitForBookingSlot(targetTime, bookingSystemDate, timeoutMs, cb) {
        const start = Date.now();

        function check() {
            const table = document.querySelector('#member_teetimes');

            if (!table) {
                if (Date.now() - start < timeoutMs) {
                    dbg("Table missing; retry");
                    return setTimeout(check, 50);
                }
                dbg("ERROR: table missing timeout");
                return alert("Booking table not found!");
            }

            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length === 0) {
                if (Date.now() - start < timeoutMs) {
                    dbg("Rows empty; retry");
                    return setTimeout(check, 50);
                }
                dbg("ERROR: rows empty timeout");
                return alert("Booking rows did not load in time.");
            }

            for (const row of rows) {

                const tCell = row.querySelector('th.slot-time');
                if (tCell && tCell.textContent.trim() === targetTime) {

                    const dateInput = row.querySelector('input[name="date"]');
                    if (dateInput && dateInput.value === bookingSystemDate) {

                        let bookBtn = row.querySelector('a.button.inlineBooking.btn-success');
                        if (!bookBtn) {
                            bookBtn = Array.from(row.querySelectorAll('button'))
                                           .find(btn => /book/i.test(btn.textContent.trim()));
                        }

                        if (bookBtn) {
                            dbg("Slot found at " + targetTime);
                            return cb(bookBtn, row);
                        }
                    }
                }
            }

            if (Date.now() - start < timeoutMs) {
                dbg("Slot not found yet; retry");
                return setTimeout(check, 30);
            }

            dbg("ERROR: slot search timeout");
            alert("Book button not found for " + targetTime + " on correct date");
        }

        check();
    }


    function waitForConfirmationButton(timeoutMs) {
        const start = Date.now();

        function check() {
            const btns = Array.from(document.querySelectorAll('button, a'));

            const c = btns.find(btn =>
                btn.textContent.includes('Book teetime at ' + teeTime)
            );

            if (c) {
                dbg("Confirmation button found");
                c.click();

                const nowPerf = performance.now();
                const nowISO = new Date().toISOString();
                const logs = JSON.parse(localStorage.getItem('bookingTimes') || '[]');

                logs.push({ iso: nowISO, perf: nowPerf });
                localStorage.setItem('bookingTimes', JSON.stringify(logs));
                return;
            }

            if (Date.now() - start < timeoutMs) {
                dbg("Waiting for confirmation");
                return setTimeout(check, 20);
            }

            dbg("ERROR: confirmation timeout");
            alert("Confirmation button not found for " + teeTime);
        }

        check();
    }

})();
