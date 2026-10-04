// Booking Observatory V0.1a

(function () {

    alert("Stage 1 - Script Loaded");

    const dateBlock =
        document.querySelector('span.date-display');

    if (!dateBlock) {

        alert("Stage 2 FAILED - Date block not found");

        return;

    }

    alert(
        "Stage 2 - Date found:\n\n" +
        dateBlock.textContent.trim()
    );

    const prev =
        document.querySelector(
            'a[data-direction="prev"]'
        );

    if (!prev) {

        alert(
            "Stage 3 FAILED - Previous day arrow not found"
        );

        return;

    }

    alert(
        "Stage 3 - Previous day arrow found"
    );

    prev.click();

    alert(
        "Stage 4 - Previous day clicked"
    );

    setTimeout(function () {

        const next =
            document.querySelector(
                'a[data-direction="next"]'
            );

        if (!next) {

            alert(
                "Stage 5 FAILED - Next day arrow not found"
            );

            return;

        }

        alert(
            "Stage 5 - Next day found"
        );

        next.click();

        alert(
            "Stage 6 - Returned to target day"
        );

        const table =
            document.querySelector(
                "#member_teetimes"
            );

        alert(
            table
                ? "Stage 7 - Booking table found"
                : "Stage 7 - Booking table NOT found"
        );

    }, 3000);

})();
