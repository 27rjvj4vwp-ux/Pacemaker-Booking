// Booking Observatory V0.1 TEST
// Goodwood Booking Sheet Monitor
// Diagnostics only - does NOT attempt to book.

(function () {

    const VERSION = "0.1 TEST";

    const TEST_MODE = true;
    const TEST_DELAY_SECONDS = 20;

    const publishTime = "07:15";

    const targetTimes = [
        "09:10"
    ];

    const observationSeconds = 5;
    const pollMs = 20;

    const events = [];
    const previousState = {};

    // ---------------------------------------------------------
    // LOGGING
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // TIMING
    // ---------------------------------------------------------

    function waitForStart(cb) {

        if (TEST_MODE) {

            console.log(
                "TEST MODE - waiting " +
                TEST_DELAY_SECONDS +
                " seconds"
            );

            setTimeout(
                cb,
                TEST_DELAY_SECONDS * 1000
            );

            return;
        }

        const [h, m] =
            publishTime.split(':').map(Number);

        const target = new Date();

        target.setHours(h, m, 0, 0);

        function scheduler() {

            const diff =
                target.getTime() -
                Date.now();

            if (diff <= 2500) {

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
                    1000,
                    diff - 2500
                )
            );
        }

        scheduler();
    }

    // ---------------------------------------------------------
    // STATE CAPTURE
    // ---------------------------------------------------------

    function getRowState(row) {

        if (!row) {

            return {
                rowExists: false
            };
        }

        return {

            rowExists: true,

            rowText:
                row.innerText.trim(),

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
                row.querySelectorAll(
                    'input'
                ).length
        };
    }

    function hasChanged(a, b) {

        return JSON.stringify(a) !==
               JSON.stringify(b);
    }

    // ---------------------------------------------------------
    // OBSERVATION
    // ---------------------------------------------------------

    function observeSheet() {

        alert(
  
