// Booking Observatory V1.0
// Watches publication of selected tee times.
// Does NOT book anything.
// Records row structure changes after 07:15 publication.

(function () {

    const publishTime = "07:15";

    const targetTimes = [
        "08:50",
        "09:00",
        "09:10",
        "09:20",
        "09:30"
    ];

    const observationSeconds = 10;
    const pollMs = 20;

    const events = [];

    const previousState = {};

    const startWallClock = new Date();

    function logEvent(slot, event, details = "") {

        const now = new Date();

        events.push({
            timestamp: now.toISOString(),
            elapsedMs: Math.round(performance.now()),
            slot,
            event,
            details
        });

        console.log(
            now.toLocaleTimeString() +
            " | " +
            slot +
            " | " +
            event +
            (details ? " | " + details : "")
        );
    }

    function waitUntilUKTime(timeStr, cb) {

        const [h, m] = timeStr.split(':').map(Number);

        const target = new Date();

        target.setHours(h, m, 0, 0);

        const early = 3000;

        function scheduler() {

            const diff = target.getTime() - Date.now();

            if (diff <= early) {

                const loop = () => {

                    if (Date.now() >= target.getTime())
                        cb();
                    else
                        setTimeout(loop, 5);

                };

                return loop();

            }

            setTimeout(
                scheduler,
                Math.min(2000, diff - early)
            );
        }

        scheduler();
    }

    function getRowState(row) {

        if (!row)
            return null;

        return {

            rowExists: true,

            rowText: row.innerText.trim(),

            hasBookButton:
                !!row.querySelector(
                    'a.inlineBooking.btn-success'
                ),

            hasTipForm:
                !!row.querySelector(
                    '.tipForm'
                ),

            hasDateInput:
                !!row.querySelector(
                    'input[name="date"]'
                ),

            hasCourseInput:
                !!row.querySelector(
                    'input[name="course"]'
                ),

            hasGroupInput:
                !!row.querySelector(
                    'input[name="group"]'
                ),

            hasBookInput:
                !!row.querySelector(
                    'input[name="book"]'
                ),

            inputCount:
                row.querySelectorAll('input').length
        };
    }

    function stateChanged(a, b) {

        return JSON.stringify(a) !== JSON.stringify(b);

    }

    function observeSheet() {

        console.log(
            "=== OBSERVATION COMMENCED ==="
        );

        const startPerf = performance.now();

        const timer = setInterval(() => {

            const table =
                document.querySelector(
                    '#member_teetimes'
                );

            if (!table)
                return;

            for (const targetTime of targetTimes) {

                const row =
                    Array.from(
                        table.querySelectorAll('tr')
                    )
                    .find(r => {

                        const th =
                            r.querySelector(
                                'th.slot-time'
                            );

                        return th &&
                               th.textContent.trim() === targetTime;

                    });

                const state =
                    getRowState(row);

                if (
                    stateChanged(
                        state,
                        previousState[targetTime]
                    )
                ) {

                    logEvent(
                        targetTime,
                        "STATE CHANGE",
                        JSON.stringify(state)
                    );

                    previousState[targetTime] = state;
                }
            }

            if (
                performance.now() - startPerf >
                observationSeconds * 1000
            ) {

                clearInterval(timer);

                finishObservation();
            }

        }, pollMs);
    }

    function finishObservation() {

        const json =
            JSON.stringify(
                events,
                null,
                2
            );

        localStorage.setItem(
            "bookingObservatory",
            json
        );

        const blob = new Blob(
            [json],
            {
                type: "application/json"
            }
        );

        const a =
            document.createElement("a");

        a.href =
            URL.createObjectURL(blob);

        const now =
            new Date()
                .toISOString()
                .replace(/[:.]/g, "-");

        a.download =
            "BookingObservatory-" +
            now +
            ".json";

        document.body.appendChild(a);

        a.click();

        a.remove();

        console.log(
            "=== OBSERVATION COMPLETE ==="
        );

        alert(
            "Booking Observatory complete.\n" +
            events.length +
            " events recorded.\n" +
            "JSON file downloaded."
        );
    }

    // -------------------------------------------------
    // MAIN SEQUENCE
    // -------------------------------------------------

    const dateBlock =
        document.querySelector(
            'span.date-display'
        );

    const targetDate =
        dateBlock
            ? dateBlock.textContent.trim()
            : "";

    if (!targetDate) {

        alert(
            "Target date not found."
        );

        return;
    }

    alert(
        "Booking Observatory armed.\n\n" +
        "Monitoring:\n" +
        targetTimes.join(", ") +
        "\n\nWaiting for " +
        publishTime
    );

    const prev =
        document.querySelector(
            'a[data-direction="prev"]'
        );

    if (!prev) {

        alert(
            "Previous day arrow not found."
        );

        return;
    }

    prev.click();

    waitUntilUKTime(
        publishTime,
        function () {

            const next =
                document.querySelector(
                    'a[data-direction="next"]'
                );

            if (!next) {

                alert(
                    "Next day arrow not found."
                );

                return;
            }

            next.click();

            setTimeout(
                observeSheet,
                100
            );

        }
    );

})();



