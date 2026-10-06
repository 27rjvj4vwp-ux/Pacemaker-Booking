// Booking Observatory V1.1 LIVE
// Goodwood Booking Sheet Observatory
// Non-intrusive monitoring only.
// Never presses Book or Confirm.

(function () {

    const VERSION = "1.1 LIVE";

    const TEST_MODE = false;
    const TEST_DELAY_SECONDS = 20;

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
    const previousStates = {};

    // ----------------------------------------------------
    // STARTUP
    // ----------------------------------------------------

    const dateBlock =
        document.querySelector(
            'span.date-display'
        );

    if (!dateBlock) {

        alert(
            "Booking Observatory V" +
            VERSION +
            "\n\nDate display not found."
        );

        return;
    }

    const targetDate =
        dateBlock.textContent.trim();

    const proceed = confirm(

        "Booking Observatory V" +
        VERSION +
        "\n\n" +

        "Target Date:\n" +
        targetDate +
        "\n\n" +

        "Monitored Slots:\n" +
        targetTimes.join(", ") +
        "\n\n" +

        (TEST_MODE
            ? ("TEST MODE\n" +
               TEST_DELAY_SECONDS +
               " second delay.\n\n")
            : "LIVE MODE\n\n") +

        "Press OK to arm observatory."

    );

    if (!proceed)
        return;

    console.clear();

    console.log(
        "Booking Observatory V" +
        VERSION +
        " started."
    );

    console.log(
        "Target date:",
        targetDate
    );

    // ----------------------------------------------------
    // LOGGING
    // ----------------------------------------------------

    function addEvent(slot, state) {
const event = {

    clock:
        new Date()
            .toISOString(),

    displayedDate:
        document.querySelector(
            'span.date-display'
        )?.textContent.trim() ||
        "(missing)",

    elapsedMs:
                  Math.round(
                    performance.now() -
                    observationStart
                ),

            slot,
            state

        };

        events.push(event);

        console.log(
            "[OBS]",
            event.elapsedMs + "ms",
            slot,
            state
        );

    }

    // ----------------------------------------------------
    // OBSERVED STATE
    // ----------------------------------------------------

    function getState(row) {

        if (!row) {

            return {
                rowExists: false
            };

        }

        return {

            rowExists: true,

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
                row.querySelectorAll(
                    'input'
                ).length,

            text:
                row.innerText.trim()
        };

    }

    function changed(a, b) {

        return JSON.stringify(a) !==
               JSON.stringify(b);

    }

    // ----------------------------------------------------
    // DATE SYNCHRONISATION
    // ----------------------------------------------------

    function waitForDateDisplay(cb) {

        const start = performance.now();

        function poll() {

            const block =
                document.querySelector(
                    'span.date-display'
                );

            if (!block) {

                return setTimeout(
                    poll,
                    20
                );

            }

            const current =
                block.textContent.trim();

            if (
                current === targetDate
            ) {

                console.log(
                    "Date synchronized after",
                    Math.round(
                        performance.now() -
                        start
                    ),
                    "ms"
                );

                return cb();

            }

            setTimeout(
                poll,
                20
            );
        }

        poll();
    }

    // ----------------------------------------------------
    // OBSERVATION
    // ----------------------------------------------------

    let observationStart = 0;

    function observe() {

        console.log(
            "Observation started."
        );

        observationStart =
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
                    const slot
                    of targetTimes
                ) {

                    const row =
                        Array.from(
                            table
                                .querySelectorAll(
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
                                  .trim() === slot
                            );

                        });

                    const state =
                        getState(row);

                    if (
                        changed(
                            state,
                            previousStates[
                                slot
                            ]
                        )
                    ) {

                        addEvent(
                            slot,
                            state
                        );

                        previousStates[
                            slot
                        ] = state;

                    }

                }

                if (
                    performance.now() -
                    observationStart >
                    observationSeconds *
                    1000
                ) {

                    clearInterval(
                        timer
                    );

                    finish();

                }

            }, pollMs);

    }

    // ----------------------------------------------------
    // FINISH
    // ----------------------------------------------------

    function finish() {

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

        a.download =
            "BookingObservatory.json";

        document.body.appendChild(a);

        a.click();

        a.remove();

        console.log(
            "Observation complete."
        );

        alert(
            "Booking Observatory V" +
            VERSION +
            "\n\nObservation complete.\n\n" +
            events.length +
            " events recorded.\n\n" +
            "JSON downloaded."
        );

    }
function waitUntilPublishTime(cb) {

    const target = new Date();

    target.setHours(
        7,
        15,
        0,
        0
    );

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
                ) {

                    console.log(
                        "Publish time reached."
                    );

                    return cb();

                }

                setTimeout(
                    loop,
                    5
                );

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
    // ----------------------------------------------------
    // MAIN SEQUENCE
    // ----------------------------------------------------

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

    setTimeout(() => {

        const launch = () => {

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

            waitForDateDisplay(
                observe
            );

        };

        if (TEST_MODE) {

            console.log(
                "Waiting",
                TEST_DELAY_SECONDS,
                "seconds"
            );

            setTimeout(
                launch,
                TEST_DELAY_SECONDS * 1000
            );

       } else {

    console.log(
        "Waiting for 07:15 publication."
    );

    waitUntilPublishTime(
        launch
    );

}

    }, 250);

})();
