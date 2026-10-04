// Booking Observatory V0.2
// Date synchronisation test only

(function () {

    const VERSION = "0.2";

    const TEST_MODE = true;
    const TEST_DELAY_SECONDS = 20;

    alert(
        "Booking Observatory V" +
        VERSION +
        "\n\nStage 1 - Script Loaded"
    );

    const dateBlock =
        document.querySelector(
            'span.date-display'
        );

    if (!dateBlock) {

        alert(
            "FAILED\n\nDate block not found."
        );

        return;
    }

    const targetDate =
        dateBlock.textContent.trim();

    alert(
        "Stage 2\n\nTarget Date:\n" +
        targetDate
    );

    const prev =
        document.querySelector(
            'a[data-direction="prev"]'
        );

    if (!prev) {

        alert(
            "FAILED\n\nPrevious day arrow not found."
        );

        return;
    }

    const next =
        document.querySelector(
            'a[data-direction="next"]'
        );

    if (!next) {

        alert(
            "FAILED\n\nNext day arrow not found."
        );

        return;
    }

    alert(
        "Stage 3\n\nMoving to previous day."
    );

    prev.click();

    function beginReturn() {

        alert(
            "Stage 4\n\nReturning to target day."
        );

        const start =
            performance.now();

        next.click();

        let polls = 0;

        function checkDate() {

            polls++;

            const block =
                document.querySelector(
                    'span.date-display'
                );

            const currentDate =
                block
                    ? block.textContent.trim()
                    : "(missing)";

            if (
                currentDate === targetDate
            ) {

                const elapsed =
                    Math.round(
                        performance.now() -
                        start
                    );

                alert(

                    "SUCCESS\n\n" +

                    "Target date restored.\n\n" +

                    "Date:\n" +
                    currentDate +

                    "\n\nPolls:\n" +
                    polls +

                    "\n\nElapsed:\n" +
                    elapsed +
                    " ms"

                );

                return;
            }

            if (polls % 25 === 0) {

                console.log(
                    "Waiting for target date...",
                    currentDate
                );
            }

            setTimeout(
                checkDate,
                20
            );
        }

        checkDate();
    }

    if (TEST_MODE) {

        alert(
            "Stage 4\n\nTEST MODE\n\n" +
            "Waiting " +
            TEST_DELAY_SECONDS +
            " seconds."
        );

        setTimeout(
            beginReturn,
            TEST_DELAY_SECONDS *
            1000
        );

    } else {

        alert(
            "LIVE MODE NOT IMPLEMENTED YET"
        );

    }

})();
