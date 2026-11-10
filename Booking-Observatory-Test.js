// Booking Observatory II — Goodwood booking-sheet monitor
// Observes page state and records changes. Never presses Book or Confirm.
// Scheduled mode uses the date navigation controls to request the sheet,
// matching the existing observatory workflow. Immediate mode only observes.

(function () {
    "use strict";

    const VERSION = "2.1";
    const targetTimes = ["09:10", "09:20", "09:30", "10:30", "14:00"];
    const observationSeconds = 5;
    const pollMs = 20;

    const events = [];
    const previousStates = new Map();
    const rowRevisions = new Map();

    let observationStart = 0;
    let observationStartedAt = "";
    let timer = null;
    let finishTimer = null;
    let finished = false;
    let mode = "";
    let modeSelectedAt = "";
    let triggerOffsetMs = null;
    let initialDateHeader = "(missing)";
    let preNextDateHeader = null;
    let preNextSnapshot = null;
    let previousPageFingerprint = null;

    function getDateHeader() {
        const block = document.querySelector("span.date-display");
        return block ? block.textContent : "(missing)";
    }

    function getControlState(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            return {
                exists: false,
                disabled: null,
                ariaDisabled: null,
                className: null
            };
        }

        return {
            exists: true,
            disabled: Boolean(element.disabled) || element.classList.contains("disabled"),
            ariaDisabled: element.getAttribute("aria-disabled"),
            className: typeof element.className === "string" ? element.className : ""
        };
    }

    function getNavigationState() {
        return {
            prev: getControlState('a[data-direction="prev"]'),
            next: getControlState('a[data-direction="next"]')
        };
    }

    function findSlotRow(table, slot) {
        if (!table) return null;

        return Array.from(table.querySelectorAll("tr")).find(row => {
            const heading = row.querySelector("th.slot-time");
            return heading && heading.textContent.trim() === slot;
        }) || null;
    }

    function getState(row) {
        if (!row) {
            return {
                rowExists: false,
                slotState: "missing",
                pageReady: false,
                bookButton: false,
                tipForm: false,
                dateInput: false,
                courseInput: false,
                groupInput: false,
                bookInput: false,
                inputCount: 0,
                availabilityText: false,
                text: ""
            };
        }

        const bookButton = Boolean(row.querySelector("a.inlineBooking.btn-success"));
        const tipForm = Boolean(row.querySelector(".tipForm"));
        const dateInput = Boolean(row.querySelector('input[name="date"]'));
        const courseInput = Boolean(row.querySelector('input[name="course"]'));
        const groupInput = Boolean(row.querySelector('input[name="group"]'));
        const bookInput = Boolean(row.querySelector('input[name="book"]'));
        const text = row.innerText.trim();
        const pageReady = bookButton && dateInput;
        const anyBookingControls = bookButton || tipForm || dateInput || courseInput || groupInput || bookInput;

        // These labels describe visible controls only; they do not infer occupancy from names.
        let slotState;
        if (pageReady) {
            slotState = "booking-controls-ready";
        } else if (anyBookingControls) {
            slotState = "partial-booking-controls";
        } else {
            slotState = "no-booking-controls";
        }

        return {
            rowExists: true,
            slotState,
            pageReady,
            bookButton,
            tipForm,
            dateInput,
            courseInput,
            groupInput,
            bookInput,
            inputCount: row.querySelectorAll("input").length,
            availabilityText: /\bslots? available\b/i.test(text),
            text
        };
    }

    function stateFingerprint(state) {
        return JSON.stringify(state);
    }

    function makeSnapshot() {
        const table = document.querySelector("#member_teetimes");
        const snapshot = {};
        for (const slot of targetTimes) {
            snapshot[slot] = getState(findSlotRow(table, slot));
        }
        return snapshot;
    }

    function recordEvent(event) {
        events.push(event);
        console.log("[OBS II]", event.elapsedMs + "ms", event.type, event.slot || "page", event);
    }

    function eventBase() {
        return {
            clock: new Date().toISOString(),
            elapsedMs: Math.round(performance.now() - observationStart)
        };
    }

    function sample() {
        const dateHeader = getDateHeader();
        const dateHeaderTrimmed = dateHeader.trim();
        const navigation = getNavigationState();
        const table = document.querySelector("#member_teetimes");
        const pageState = { dateHeader, navigation, tableExists: Boolean(table) };
        const pageFingerprint = JSON.stringify(pageState);

        if (pageFingerprint !== previousPageFingerprint) {
            const headerMatchesTarget = dateHeaderTrimmed === initialDateHeader.trim();
            recordEvent({
                type: "page",
                ...eventBase(),
                dateHeader,
                dateHeaderTrimmed,
                headerMatchesTarget,
                navigation,
                tableExists: Boolean(table)
            });
            previousPageFingerprint = pageFingerprint;
        }

        for (const slot of targetTimes) {
            const state = getState(findSlotRow(table, slot));
            const rowStateFingerprint = stateFingerprint(state);
            const previous = previousStates.get(slot);
            const previousRevision = rowRevisions.get(slot);
            const rowRevision = previousRevision
                ? previousRevision.revision + (previousRevision.fingerprint !== rowStateFingerprint ? 1 : 0)
                : 1;
            rowRevisions.set(slot, { fingerprint: rowStateFingerprint, revision: rowRevision });

            const matchesPreNext = Boolean(
                mode === "scheduled" &&
                preNextSnapshot &&
                dateHeaderTrimmed === initialDateHeader.trim() &&
                preNextSnapshot[slot] &&
                stateFingerprint(preNextSnapshot[slot]) === rowStateFingerprint
            );

            const observedState = {
                ...state,
                rowRevision,
                possiblePrePublicationSnapshot: matchesPreNext,
                transitionNote: matchesPreNext
                    ? "Possible transitional snapshot: target date header is showing, but this row still matches its pre-next-click state."
                    : null
            };
            const observedFingerprint = JSON.stringify(observedState);

            if (observedFingerprint !== previous) {
                recordEvent({
                    type: "slot",
                    ...eventBase(),
                    dateHeader,
                    dateHeaderTrimmed,
                    headerMatchesTarget: dateHeaderTrimmed === initialDateHeader.trim(),
                    slot,
                    state: observedState
                });
                previousStates.set(slot, observedFingerprint);
            }
        }
    }

    function startObservation() {
        observationStart = performance.now();
        observationStartedAt = new Date().toISOString();
        console.log("Observation started in", mode, "mode; polling every", pollMs, "ms for", observationSeconds, "seconds.");
        sample();
        timer = setInterval(sample, pollMs);
        finishTimer = setTimeout(finish, observationSeconds * 1000);
    }

    function finish() {
        if (finished) return;
        finished = true;
        if (timer !== null) clearInterval(timer);
        if (finishTimer !== null) clearTimeout(finishTimer);

        const output = {
            version: VERSION,
            mode,
            modeSelectedAt,
            triggerOffsetMs,
            observationStartedAt,
            initialDateHeader,
            preNextDateHeader,
            observationSeconds,
            pollMs,
            targetTimes,
            events
        };
        const json = JSON.stringify(output, null, 2);

        try {
            localStorage.setItem("bookingObservatoryII", json);
        } catch (error) {
            console.warn("Could not save Observatory II data to localStorage:", error);
        }

        const blob = new Blob([json], { type: "application/json" });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "BookingObservatory-II.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

        console.log("Observation complete.", events.length, "events recorded.");
        alert(
            "Booking Observatory " + VERSION +
            "\n\nObservation complete.\n\n" + events.length +
            " events recorded.\nJSON downloaded."
        );
    }

    function waitUntilPublishTime(callback) {
        const target = new Date();
        target.setHours(7, 45, 0, triggerOffsetMs);

        console.log("Scheduled next-date click for", target.toLocaleTimeString(), "(offset", triggerOffsetMs, "ms).");

        function scheduler() {
            const difference = target.getTime() - Date.now();
            if (difference <= 100) {
                const finalCheck = () => {
                    if (Date.now() >= target.getTime()) {
                        console.log("Scheduled trigger time reached.");
                        callback();
                        return;
                    }
                    setTimeout(finalCheck, 5);
                };
                finalCheck();
                return;
            }
            setTimeout(scheduler, Math.min(2000, difference - 100));
        }
        scheduler();
    }

    function beginScheduledRun() {
        const prev = document.querySelector('a[data-direction="prev"]');
        if (!prev) {
            alert("Previous day arrow not found. No date was changed by the observatory.");
            return;
        }

        console.log("Moving to previous date before the scheduled next-date request.");
        prev.click();

        setTimeout(() => {
            waitUntilPublishTime(() => {
                const next = document.querySelector('a[data-direction="next"]');
                if (!next) {
                    alert("Next day arrow not found. No booking action was taken.");
                    return;
                }

                // Capture the visible pre-request rows as a comparison point, then
                // start polling immediately after the next-date request.
                preNextDateHeader = getDateHeader();
                preNextSnapshot = makeSnapshot();
                recordEvent({
                    type: "pre-next-baseline",
                    clock: new Date().toISOString(),
                    elapsedMs: 0,
                    dateHeader: preNextDateHeader,
                    dateHeaderTrimmed: preNextDateHeader.trim(),
                    rows: preNextSnapshot
                });

                console.log("Requesting target date. Observation begins immediately after the next-date click.");
                next.click();
                startObservation();
            });
        }, 250);
    }

    const dateBlock = document.querySelector("span.date-display");
    if (!dateBlock) {
        alert("Booking Observatory " + VERSION + "\n\nDate display not found.");
        return;
    }

    initialDateHeader = dateBlock.textContent;

    const now = new Date();
    modeSelectedAt = now.toISOString();
    const todayPublishTime = new Date(now);
    todayPublishTime.setHours(7, 45, 0, 0);
    mode = now < todayPublishTime ? "scheduled" : "immediate";

    if (mode === "scheduled") {
        const enteredOffset = prompt(
            "The device's local time is before 07:45, so Scheduled mode is selected.\n\n" +
            "Enter the delay after 07:45:00.000 in milliseconds.\n\n" +
            "Examples: 0 = 07:45:00.000, 900 = 07:45:00.900, 3000 = 07:45:03.000",
            "900"
        );
        if (enteredOffset === null) return;
        triggerOffsetMs = Number(enteredOffset.trim());
        if (!Number.isFinite(triggerOffsetMs) || triggerOffsetMs < 0 || triggerOffsetMs > 60000) {
            alert("Enter a whole number from 0 to 60000 milliseconds.");
            return;
        }
        if (!Number.isInteger(triggerOffsetMs)) {
            alert("Enter a whole number of milliseconds.");
            return;
        }
    }

    const summary =
        "Booking Observatory " + VERSION +
        "\n\nMode selected automatically from the device's local time: " + mode +
        "\nCurrent local time: " + now.toLocaleTimeString() +
        "\nStarting date header: " + initialDateHeader.trim() +
        "\nMonitored slots: " + targetTimes.join(", ") +
        "\nObservation: " + observationSeconds + " seconds at " + pollMs + " ms intervals." +
        (mode === "scheduled"
            ? "\nNext-date trigger: 07:45:00.000 + " + triggerOffsetMs + " ms.\nThe script will click prev now, then next at the scheduled time."
            : "\nImmediate mode will observe the current sheet without navigation because it is 07:45 or later.") +
        "\n\nThe script never presses Book or Confirm. Continue?";

    if (!confirm(summary)) return;

    console.clear();
    console.log("Booking Observatory " + VERSION + " started.");
    console.log("Initial date header (raw):", initialDateHeader);
    console.log("Mode selected automatically:", mode, "Target slots:", targetTimes);

    if (mode === "immediate") {
        startObservation();
    } else {
        beginScheduledRun();
    }
})();
