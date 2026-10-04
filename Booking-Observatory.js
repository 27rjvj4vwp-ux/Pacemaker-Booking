// Booking Observatory V1.0-alpha
// Goodwood Booking Sheet Monitor
// Watches the publication process without attempting to book.

(function () {

    const version = "1.0-alpha";

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

    // -----------------------------------------------------
    // STARTUP CONFIRMATION
    // -----------------------------------------------------

    const dateBlock =
        document.querySelector('span.date-display');

    const targetDate =
        dateBlock
            ? dateBlock.textContent.trim()
            : "";

    if (!targetDate) {

        alert(
            "Booking Observatory V" +
            version +
            "\n\nTarget date not found."
        );

        return;
    }

    const proceed = confirm(

        "Booking Observatory V" +
        version +
        "\n\n" +

        "Target Date:\n" +
        targetDate +
        "\n\n" +

        "Monitored Tee Times:\n" +
        targetTimes.join(", ") +
        "\n\n" +

        "Publish Time:\n" +
        publishTime +
        "\n\n" +

        "This script:\n" +
        "• Moves to previous day\n" +
        "• Waits until publication\n" +
        "• Returns to target day\n" +
        "• Records all observable row changes\n" +
        "• Downloads JSON results\n\n" +

        "Press OK to arm observatory.\n" +
        "Press Cancel to abort."

    );

    if (!proceed) {

        alert(
            "Booking Observatory cancelled."
        );

        return;
    }

    // -----------------------------------------------------
    // LOGGING
    // -----------------------------------------------------

    function logEvent(slot, event, details = "") {

        const now = new Date();

        events.push({
            timestamp: now.toISOString(),
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

    // -----------------------------------------------------
    // TIMING
    // -----------------------------------------------------

    function waitUntilUKTime(timeStr, cb) {

        const [h, m] =
            timeStr.split(':').map(Number);

        const target = new Date();

        target.setHours(h, m, 0, 0);

        const early = 3000;

        function scheduler() {

            const diff =
                target.getTime() -
                Date.now();

            if (diff <= early) {

                const loop = () => {

                    if (
                        Date.now() >=
                        target.getTime()
                    )
                        cb();
                    else
                        setTimeout(loop, 5);

                };

                return loop();
            }

            setTimeout(
                scheduler,
                Math.min(
                    2000,
                    diff - early
                )
            );
        }

        scheduler();
    }

    // -----------------------------------------------------
    // STATE CAPTURE
    // -----------------------------------------------------

    function getRowState(row) {

        if (!row)
            return null;

        return {

            rowExists: true,

            text:
                row.innerText.trim(),

            bookButton:
                !!row.querySelector(
                    'a.inlineBooking.btn-success'
                ),

            tipForm:
                !!row.querySelector(
                    '.tipForm'
                ),

            dateInput:
                !!row.querySelector(
                    'input[name="date"]'
                ),

            courseInput:
                !!row.querySelector(
                    'input[name="course"]'
                ),

            groupInput:
                !!row.querySelector(
                    'input[name="group"]'
                ),

            bookInput:
                !!row.querySelector(
                    'input[name="book"]'
                ),

            inputCount:
                row.querySelectorAll('input')
                   .length
        };
    }

    function changed(a, b) {

        return JSON.stringify(a) !==
               JSON.stringify(b);
    }

    // -----------------------------------------------------
    // OBSERVATION
    // -----------------------------------------------------

    function observeSheet() {

        console.log(
            "=== GOODWOOD BIG BANG COMMENCED ==="
        );

        alert(
            "Publication detected.\n\n" +
            "Booking Observatory is now recording.\n\n" +
            "Do NOT refresh."
        );

        const start =
            performance.now();

        const timer =
            setInterval(() => {

                const table =
                    document.querySelector(
                        "#member_teetimes"
                    );

                if (!table)
                    return;

                for (
                    const targetTime
                    of targetTimes
                ) {

                    const row =
                        Array.from(
                            table.querySelectorAll(
                                "tr"
                            )
                        )
                        .find(r => {

                            const th =
                                r.querySelector(
                                    "th.slot-time"
                                );

                            return (
                                th &&
                                th.textContent
                                  .trim() ===
                                targetTime
                            );
                        });

                    const state =
                        getRowState(row);

                    if (
                        changed(
                            state,
                            previousState[
                                targetTime
                            ]
                        )
                    ) {

                        logEvent(
                            targetTime,
                            "STATE_CHANGE",
                            JSON.stringify(
                                state
                            )
                        );

                        previousState[
                            targetTime
                        ] = state;
                    }
                }

                if (
                    performance.now() -
                    start >
                    observationSeconds *
                    1000
                ) {

                    clearInterval(
                        timer
                    );

                    finishObservation();
                }

            }, pollMs);
    }

    // -----------------------------------------------------
    // FINISH
    // -----------------------------------------------------

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

        const blob =
            new Blob(
                [json],
                {
                    type:
                    "application/json"
                }
            );

        const a =
            document.createElement(
                "a"
            );

        a.href =
            URL.createObjectURL(
                blob
            );

        const now =
            new Date()
                .toISOString()
                .replace(
                    /[:.]/g,
                    "-"
                );

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
            "Booking Observatory V" +
            version +
            " complete.\n\n" +
            events.length +
            " events recorded.\n\n" +
            "JSON file downloaded.\n\n" +
            "Results also saved to localStorage."
        );
    }

    // -----------------------------------------------------
    // MOVE TO PREVIOUS DAY
    // -----------------------------------------------------

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

    alert(
        "Booking Observatory armed.\n\n" +
        "Moving to previous day.\n\n" +
        "Waiting for " +
        publishTime
    );

    prev.click();

    // -----------------------------------------------------
    // BIG BANG
    // -----------------------------------------------------

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
