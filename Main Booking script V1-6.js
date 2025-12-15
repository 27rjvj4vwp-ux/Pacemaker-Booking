
Javascript: (function(){
  // Passkey prompt with group warning and newline
  var passkey = prompt("Warning: This script is for authorised Pacemakers Group members only.\nPlease enter the passcode:");
  if(passkey !== "3846"){
    alert("Access denied.");
    return;
  }
  var newpubtime = '07:45'; // Change to '07:15' for summer booking
  var teeTime = prompt("Enter your target tee time (e.g., 09:10):");
  if (!teeTime) {
    alert("No tee time entered.");
    return;
  }
  var dateBlock = document.querySelector('span.date-display');
  var dateText = dateBlock ? dateBlock.textContent.trim() : '';
  // Final confirmation message with publish time
  if (!confirm("Booking will pause until " + newpubtime + " then book " + teeTime + (dateText ? " on " + dateText : "") + ".")) {
    alert("Booking cancelled.");
    return;
  }
  // Delayed booking logic only
  var prevArrow = document.querySelector('a[data-direction=\"prev\"]');
  if (prevArrow) {
    prevArrow.click();
    var parts = newpubtime.split(':');
    var targetHour = parseInt(parts[0], 10), targetMinute = parseInt(parts[1], 10);
    waitUntil(targetHour, targetMinute, 0, function() {
      waitForDateUpdate(dateText, function() {
        waitForBookingSlot(teeTime, 10000, function(btn) {
          btn.click();
          waitForConfirmationButton(5000);
        });
      });
    });
  } else {
    alert('Previous day arrow not found!');
  }

  // Helper functions
  function waitUntil(h, m, s, cb) {
    function check() {
      var now = new Date();
      if (now.getHours() === h && now.getMinutes() === m && now.getSeconds() >= s) { cb(); }
      else { setTimeout(check, 100); }
    }
    check();
  }
  function waitForDateUpdate(targetText, cb) {
    var dateBlock = document.querySelector('span.date-display');
    if (!dateBlock) { alert('Date block not found!'); return; }
    var obs = new MutationObserver(function() {
      var newText = dateBlock.textContent.trim();
      if (newText === targetText) { obs.disconnect(); cb(); }
    });
    obs.observe(dateBlock, { characterData: true, subtree: true, childList: true });
    var nextArrow = document.querySelector('a[data-direction=\"next\"]');
    if (nextArrow) { nextArrow.click(); }
    else { alert('Next day arrow not found!'); }
  }
  function waitForBookingSlot(a, b, c) {
    var start = Date.now();
    function check() {
      var rows = Array.from(document.querySelectorAll('tr'));
      var targetRow = rows.find(function(row) { return row.textContent.includes(a); });
      if (targetRow) {
        var bookBtn = Array.from(targetRow.querySelectorAll('button')).find(function(btn) {
          return /book/i.test(btn.textContent.trim());
        });
        if (bookBtn) { c(bookBtn, targetRow); return; }
      }
      if (Date.now() - start < b) { setTimeout(check, 10); }
      else { alert('Book button not found for ' + a); }
    }
    check();
  }
  function waitForConfirmationButton(a) {
    var start = Date.now();
    function check() {
      var confirmBtns = Array.from(document.querySelectorAll('button'));
      var confirmBtn = confirmBtns.find(function(btn) {
        return btn.textContent.includes('Book tee time at ' + teeTime);
      });
      if (confirmBtn) { confirmBtn.click(); }
      else if (Date.now() - start < a) { setTimeout(check, 10); }
      else { alert('Confirmation button not found for ' + teeTime); }
    }
    check();
  }
})();













