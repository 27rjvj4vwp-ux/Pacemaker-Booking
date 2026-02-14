// Version 2.4.2 (Persistent debug overlay, debug toggle fix, fully commented)
(function () {

    // --------------------------------------------------------------------
    // CONFIGURATION
    // --------------------------------------------------------------------
    const newpubtime = "07:45";   // Summer adjust to "07:15"


    // --------------------------------------------------------------------
    // STEP 0: RESTORE DEBUG LOG IF PRESENT (Option A)
    // --------------------------------------------------------------------
    // If debug was active before a page navigation, restore the overlay now.
    if (localStorage.getItem("debugLog_active") === "true") {
        createDebugPanel();
        const panel = document.getElementById("bookingDebugPanel");
        panel.textContent = localStorage.getItem("debugLog") || "";
        panel.scrollTop = panel.scrollHeight;
        // Clear after display to avoid persistence into next session
        localStorage.removeItem("debugLog_active");
        localStorage.removeItem("debugLog");
    }

    // Placeholder dbg() before knowing if debugMode is enabled
    function dbg(msg) {}

    // --------------------------------------------------------------------
    // STEP 1: GET TEE-TIME INPUT
    // --------------------------------------------------------------------
    let teeTimeRaw = prompt(
        "Booking tool V2.4.2 : Pacemakers use only.\n" +
        "Enter your target tee time (e.g., 09:10 or 09:10 /d for debug mode):"
    );
    if (!teeTimeRaw) { alert("No tee time entered."); return; }


    // --------------------------------------------------------------------
    // STEP 2: DEBUG TOGGLE AND TEE-TIME CLEANING
    // --------------------------------------------------------------------

    // Tee time always first 5 characters (HH:MM)
    let teeTime = teeTimeRaw.substring(0, 5).trim();

    // Extra input determines debug mode
    let extraInput = teeTimeRaw.substring(5).toLowerCase();
    let debugMode = extraInput.includes("/d") || extraInput.includes("debug");


    // If debug mode activated now, create panel + enable dbg()
    if (debugMode) {
        createDebugPanel();
        dbg = function (msg) {
            const panel = document.getElementById('bookingDebugPanel');
            if (!panel) return;
            const ts = new Date().toISOString().substr(11, 12); // HH:MM:SS.mmm
            panel.textContent += `[${ts}] ${msg}\n`;
            panel.scrollTop = panel.scrollHeight;
        };
        dbg("DEBUG MODE ENABLED");
        dbg("Raw input: " + teeTimeRaw);
        dbg("Parsed tee time: " + teeTime);
        dbg("Extra input: " + extraInput);
    }


    // --------------------------------------------------------------------
    // STEP 3: GET TARGET DATE FROM PAGE
    // --------------------------------------------------------------------
    const dateBlock = document.querySelector('span.date-display');
    const targetDateText = dateBlock ? dateBlock.textContent.trim() : '';
    if (!targetDateText) { alert('Target date not found on page.'); return; }

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
    dbg("System date: " + bookingSystemDate);


    // --------------------------------------------------------------------
    // STEP 4: CHECK IF PUBLISH TIME IS FUTURE OR PAST
    // --------------------------------------------------------------------
    const now = new Date();
    const [pubH, pubM] = newpubtime.split(':').map(Number);
    const targetPub = new Date();
    targetPub.setHours(pubH, pubM, 0, 0);

    const publishInFuture = (targetPub.getTime() - now.getTime()) > 0;
    dbg("Publish time future? " + publishInFuture);


    // --------------------------------------------------------------------
    // STEP 5: USER CONFIRMATION
    // --------------------------------------------------------------------
    if (publishInFuture) {

        const message =
            `${teeTime} on ${targetDateText} selected.\n` +
            `Process will wait until ${newpubtime} UK time to book.\n` +
            `Do not press Reset. Press OK to continue.`;

        dbg("User confirmation: wait mode");

        if (!confirm(message)) {
            dbg("User cancelled");
            alert('Booking cancelled.');
            return;
        }

    } else {

        const message =
            `${teeTime} on ${targetDateText} selected.\n` +
            `${newpubtime} has already passed.\n` +
            `Do you want to book immediately?`;

        dbg("User confirmation: immediate mode");

        if (!confirm(message)) {
            dbg("User cancelled");
            alert('Booking cancelled.');
            return;
        }

        dbg("Immediate booking approved");
    }


    // --------------------------------------------------------------------
    // STEP 6: NAVIGATE PREV → WAIT → NEXT
    // --------------------------------------------------------------------
    const prevArrow = document.querySelector('a[data-direction="prev"]');
    if (!prevArrow) {
        dbg("ERROR: prev arrow missing");
        alert('Previous day arrow not found!');
        return;
    }

    dbg("Clicking previous-day arrow");
    prevArrow.click();

    setTimeout(() => {

        dbg("Calling waitUntilUKTime");
        waitUntilUKTime(newpubtime, function () {

            const nextArrow = document.querySelector('a[data-direction="next"]');
            if (!nextArrow) {
                dbg("ERROR: next arrow missing");
                alert('Next day arrow not found!');
                return;
            }

            dbg("Clicking next-day arrow");
            nextArrow.click();

            setTimeout(() => {

                dbg("Waiting for target date display");
                waitForDateDisplay(targetDateText, function () {

                    dbg("Correct date displayed; locating slot");
                    waitForBookingSlot(
                        teeTime,
                        bookingSystemDate,
                        15000,
                        function (btn) {
                            dbg("Slot found; clicking Book");
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

    // --------------------------------------------------------------------
    // A: STALL-RESISTANT WAIT
    // --------------------------------------------------------------------
    function waitUntilUKTime(timeStr, cb) {
        dbg("waitUntilUKTime start for " + timeStr);

        const [h, m] = timeStr.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);
        const earlyMs = 3000;

        function scheduler() {
            const diff = target.getTime() - Date.now();

            if (diff <= earlyMs) {
                dbg("Entering tight loop (publish imminent)");
                const tightLoop = () => {
                    if (Date.now() >= target.getTime()) {
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


    // --------------------------------------------------------------------
    // B: WAIT FOR DATE DISPLAY
    // --------------------------------------------------------------------
    function waitForDateDisplay(targetDateText, cb) {
        const dateBlock = document.querySelector('span.date-display');
        if (!dateBlock) {
            dbg("ERROR: date block missing");
            alert('Date block not found!');
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
                dbg("Date mismatch; polling");
                return setTimeout(poll, 20);
            }

            dbg("Date mismatch timeout; retry next click");
            const nextArrow = document.querySelector('a[data-direction="next"]');
            if (nextArrow) {
                nextArrow.click();
                setTimeout(poll, 500);
            } else {
                dbg("ERROR: next arrow missing on retry");
                alert('Next day arrow not found for retry!');
            }

        }, 150);
    }


    // --------------------------------------------------------------------
    // C: WAIT FOR SLOT APPEARANCE
    // --------------------------------------------------------------------
    function waitForBookingSlot(targetTime, bookingSystemDate, timeoutMs, cb) {
        const start = Date.now();

        function check() {
            const table = document.querySelector('#member_teetimes');
            if (!table) {
                if (Date.now() - start < timeoutMs) {
                    dbg("Waiting for table");
                    return setTimeout(check, 50);
                }
                dbg("ERROR: table not found");
                return alert('Booking table not found!');
            }

            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length === 0) {
                if (Date.now() - start < timeoutMs) {
                    dbg("Waiting for rows");
                    return setTimeout(check, 50);
                }
                dbg("ERROR: rows missing");
                return alert('Booking rows did not load in time.');
            }

            for (const row of rows) {
                const timeCell = row.querySelector('th.slot-time');

                if (timeCell && timeCell.textContent.trim() === targetTime) {

                    const hiddenDate = row.querySelector('input[name="date"]');
                    if (hiddenDate && hiddenDate.value === bookingSystemDate) {

                        let bookBtn =
                            row.querySelector('a.button.inlineBooking.btn-success') ||
                            Array.from(row.querySelectorAll('button'))
                                .find(b => /book/i.test(b.textContent.trim()));

                        if (bookBtn) {
                            dbg("Correct slot found at " + targetTime);
                            return cb(bookBtn, row);
                        }

                        dbg("WARN: slot row but no Book button");
                    }
                }
            }

            if (Date.now() - start < timeoutMs) {
                dbg("Slot not found; retrying");
                return setTimeout(check, 30);
            }

            dbg("ERROR: slot not found in timeout");
            alert('Book button not found for ' + targetTime);
        }

        check();
    }


    // --------------------------------------------------------------------
    // D: CONFIRMATION + PERSISTENT DEBUG LOG
    // --------------------------------------------------------------------
    function waitForConfirmationButton(timeoutMs) {
        const start = Date.now();

        function check() {
            const btns = Array.from(document.querySelectorAll('button, a'));
            const confirmBtn = btns.find(btn =>
                btn.textContent.includes('Book teetime at ' + teeTime)
            );

            if (confirmBtn) {
                dbg("Confirmation button found; booking now");

                // BEFORE clicking — save the debug log
                if (debugMode) {
                    const panelText =
                        document.getElementById("bookingDebugPanel")?.textContent || "";
                    localStorage.setItem("debugLog", panelText);
                    localStorage.setItem("debugLog_active", "true");
                }

                // Complete booking
                confirmBtn.click();

                // Log timing
                const nowPerf = performance.now();
                const nowISO = new Date().toISOString();
                const logs = JSON.parse(localStorage.getItem('bookingTimes') || '[]');
                logs.push({ iso: nowISO, perf: nowPerf });
                localStorage.setItem('bookingTimes', JSON.stringify(logs));

            } else if (Date.now() - start < timeoutMs) {
                dbg("Waiting for confirmation button");
                return setTimeout(check, 20);
            } else {
                dbg("ERROR: confirmation button missing");
                alert('Confirmation button not found for ' + teeTime);
            }
        }

        check();
    }


    // --------------------------------------------------------------------
    // UTILITY: CREATE DEBUG PANEL
    // (Declared at bottom so it's available to the restore logic too)
    // --------------------------------------------------------------------
    function createDebugPanel() {
        if (document.getElementById("bookingDebugPanel")) return;

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

})();
