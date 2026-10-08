/*
  Nascence landing page behaviour. Vanilla JavaScript, no dependencies.

  Two jobs, both progressive enhancements (the page works fully without them):

  1. The hero "experiment" animation.
     PRODUCT REASON: the product's core claim is that it does not publish one
     ad, it runs an experiment across several versions and shifts budget toward
     the winner (docs/data-moat.md in the product repo). Showing the budget move
     over four "weeks" explains that in five seconds, without jargon.
     HONESTY: the shares below are illustrative, and the figure caption says
     so. They are not measured data and must never be presented as such.

  2. The waitlist form.
     PRODUCT REASON: the waitlist is the page's single conversion goal. Without
     JavaScript the form posts straight to Google Forms and the visitor sees
     Google's confirmation page. With JavaScript we validate in plain English,
     submit in the background, and confirm in place, so they never leave.
     TECHNICAL: Google Forms accepts an urlencoded POST to .../formResponse
     with "entry.<id>" fields, but sends no CORS headers. We therefore post
     with mode "no-cors": the browser delivers the request but hides the
     response. A network failure still rejects the promise, so "resolved"
     means "delivered to Google". That is why validation happens here, before
     sending: Google cannot tell us about a bad value.
*/

(function () {
  "use strict";

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* 1. Experiment animation                                            */
  /* ------------------------------------------------------------------ */

  // Illustrative budget shares per week for versions A, B, C (each row sums
  // to 100). Week 1 is an even split, which is how an experiment starts; by
  // week 4 the budget has moved toward B. Purely illustrative.
  var WEEKS = [
    { a: 33, b: 33, c: 34 },
    { a: 31, b: 42, c: 27 },
    { a: 27, b: 52, c: 21 },
    { a: 24, b: 61, c: 15 }
  ];
  var STEP_MS = 1300;

  function setupExperiment() {
    var figure = document.querySelector(".experiment");
    if (!figure) return;

    var ads = {
      a: figure.querySelector('[data-ad="a"]'),
      b: figure.querySelector('[data-ad="b"]'),
      c: figure.querySelector('[data-ad="c"]')
    };
    var weekLabel = figure.querySelector("[data-week]");
    var replayButton = figure.querySelector("[data-replay]");

    // Defensive: if the markup changes and an element is missing, leave the
    // static (final-state) figure alone rather than half-animating it.
    if (!ads.a || !ads.b || !ads.c || !weekLabel) return;

    // Reduced motion: the CSS already shows the final state; do nothing.
    if (prefersReducedMotion) return;

    var timers = [];

    function applyWeek(index) {
      var week = WEEKS[index];
      Object.keys(ads).forEach(function (key) {
        var bar = ads[key].querySelector(".share-bar");
        // CSSOM writes are allowed under our CSP (style-src 'self');
        // inline style attributes in the HTML would not be.
        if (bar) bar.style.setProperty("--share", String(week[key]));
      });
      weekLabel.textContent = String(index + 1);

      // The marigold "leading" highlight appears only on the final week, so
      // the visitor sees the budget move first and the verdict last.
      var isLast = index === WEEKS.length - 1;
      ads.b.classList.toggle("is-leading", isLast);
    }

    function play() {
      timers.forEach(clearTimeout);
      timers = [];
      if (replayButton) replayButton.hidden = true;

      applyWeek(0);
      for (var i = 1; i < WEEKS.length; i++) {
        timers.push(setTimeout(applyWeek.bind(null, i), STEP_MS * i));
      }
      timers.push(
        setTimeout(function () {
          if (replayButton) replayButton.hidden = false;
        }, STEP_MS * WEEKS.length)
      );
    }

    // Reset to week 1 straight away so the visitor never sees the end state
    // first and then watches it jump back.
    applyWeek(0);

    if (replayButton) replayButton.addEventListener("click", play);

    // Start when the figure is actually on screen. On phones it sits below
    // the form, and an animation that finished off-screen would be wasted.
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          if (entries.some(function (entry) { return entry.isIntersecting; })) {
            observer.disconnect();
            play();
          }
        },
        { threshold: 0.35 }
      );
      observer.observe(figure);
    } else {
      play();
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2. Waitlist form                                                   */
  /* ------------------------------------------------------------------ */

  var SUBMIT_TIMEOUT_MS = 15000;
  var CONTACT_EMAIL = "cagri@nascencesolution.com";

  // Deliberately lenient: the goal is to catch typos ("name@gmail", missing @),
  // not to enforce RFC 5322. A stricter pattern rejects real addresses.
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validateEmail(raw) {
    var value = raw.trim();
    if (!value) return { ok: false, message: "Enter your email address." };
    if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
      return { ok: false, message: "Enter an email address like name@yourbusiness.co.uk." };
    }
    return { ok: true, value: value };
  }

  // Owners type "mysite.co.uk", "www.mysite.co.uk" or a full URL. Accept all
  // three and store one normalised form, so the waitlist is easy to scan.
  function normaliseWebsite(raw) {
    var value = raw.trim().replace(/\s+/g, "");
    if (!value) return { ok: true, value: "" };
    if (value.length > 200) {
      return { ok: false, message: "That web address is too long. Check it and try again." };
    }
    var withScheme = /^https?:\/\//i.test(value) ? value : "https://" + value;
    try {
      var url = new URL(withScheme);
      // A real public site has a dot in its host name ("localhost" or a
      // single word is almost certainly a typo).
      if (url.hostname.indexOf(".") === -1) throw new Error("no dot");
      return { ok: true, value: url.href };
    } catch (error) {
      return { ok: false, message: "Enter a web address like yourbusiness.co.uk, or leave it empty." };
    }
  }

  function showFieldError(input, errorEl, message) {
    input.setAttribute("aria-invalid", "true");
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearFieldError(input, errorEl) {
    input.removeAttribute("aria-invalid");
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  function setupWaitlist() {
    var form = document.querySelector("form.waitlist");
    if (!form) return;

    var emailInput = form.querySelector("#email");
    var emailError = form.querySelector("#email-error");
    var websiteInput = form.querySelector("#website");
    var websiteError = form.querySelector("#website-error");
    var honeypot = form.querySelector("#hp-company");
    var button = form.querySelector('button[type="submit"]');
    var status = form.querySelector(".form-status");
    var endpoint = form.getAttribute("action");
    if (!emailInput || !emailError || !websiteInput || !websiteError || !button || !status) return;
    // Defensive: never post anywhere except the Google Forms endpoint the CSP
    // allows. If the markup is edited wrongly, fail loudly in the UI instead
    // of sending visitors' emails somewhere unexpected.
    var endpointOk = /^https:\/\/docs\.google\.com\/forms\/d\/[A-Za-z0-9_-]+\/formResponse$/.test(endpoint || "");

    var inFlight = false;

    // Clear an error as soon as the visitor starts fixing it.
    emailInput.addEventListener("input", function () { clearFieldError(emailInput, emailError); });
    websiteInput.addEventListener("input", function () { clearFieldError(websiteInput, websiteError); });

    function setStatus(message, tone) {
      status.textContent = message;
      if (tone) status.setAttribute("data-tone", tone);
      else status.removeAttribute("data-tone");
    }

    function setBusy(busy) {
      inFlight = busy;
      // aria-disabled rather than disabled: a disabled button loses focus,
      // which strands keyboard and screen-reader users.
      button.setAttribute("aria-disabled", busy ? "true" : "false");
      button.textContent = busy ? "Joining…" : "Join the waitlist";
    }

    function showDone(email) {
      var done = document.createElement("div");
      done.className = "waitlist-done";
      done.id = "join";

      var heading = document.createElement("h2");
      heading.textContent = "You're on the waitlist";
      heading.tabIndex = -1;

      var text = document.createElement("p");
      // textContent, never innerHTML: the email is user input.
      text.textContent =
        "We'll email " + email + " when there's a place in the pilot. " +
        "To change or delete your details, email " + CONTACT_EMAIL + ".";

      done.appendChild(heading);
      done.appendChild(text);
      form.replaceWith(done);
      heading.focus();
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (inFlight) return; // ignore double clicks / double Enter

      setStatus("", null);
      var email = validateEmail(emailInput.value);
      var website = normaliseWebsite(websiteInput.value);

      if (!email.ok) showFieldError(emailInput, emailError, email.message);
      else clearFieldError(emailInput, emailError);
      if (!website.ok) showFieldError(websiteInput, websiteError, website.message);
      else clearFieldError(websiteInput, websiteError);

      if (!email.ok) { emailInput.focus(); return; }
      if (!website.ok) { websiteInput.focus(); return; }

      // Honeypot filled: almost certainly a bot. Show success so it learns
      // nothing, but send nothing, which keeps junk out of the waitlist.
      if (honeypot && honeypot.value) {
        showDone(email.value);
        return;
      }

      if (!endpointOk) {
        setStatus("The waitlist isn't connected right now. Email " + CONTACT_EMAIL + " to join.", "error");
        return;
      }

      // Field names are Google's entry IDs, taken from the inputs themselves
      // so they're defined in exactly one place (index.html).
      var body = new URLSearchParams();
      body.set(emailInput.name, email.value);
      if (website.value) body.set(websiteInput.name, website.value);

      var controller = "AbortController" in window ? new AbortController() : null;
      var timeout = controller ? setTimeout(function () { controller.abort(); }, SUBMIT_TIMEOUT_MS) : null;

      setBusy(true);
      fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        // URLSearchParams sets Content-Type to application/x-www-form-urlencoded,
        // one of the types a no-cors request is allowed to send.
        body: body,
        credentials: "omit", // never send the visitor's Google cookies along
        signal: controller ? controller.signal : undefined
      })
        .then(function () {
          // Opaque response by design (see header comment): resolved means
          // the request reached Google.
          showDone(email.value);
        })
        .catch(function (error) {
          var timedOut = error && error.name === "AbortError";
          setStatus(
            timedOut
              ? "The waitlist took too long to respond. Check your connection and try again."
              : "Your details weren't saved. Try again in a minute, or email " + CONTACT_EMAIL + ".",
            "error"
          );
          setBusy(false);
        })
        .finally(function () {
          if (timeout) clearTimeout(timeout);
        });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. "Join the waitlist" links further down the page                 */
  /* ------------------------------------------------------------------ */

  // The closing call to action points at #join. Scrolling there is not
  // enough: put the cursor in the email field so the visitor can just type.
  function setupFocusLinks() {
    var links = document.querySelectorAll("[data-focus-email], .header-cta");
    Array.prototype.forEach.call(links, function (link) {
      link.addEventListener("click", function (event) {
        var target = document.getElementById("join");
        if (!target) return; // let the browser follow the anchor
        event.preventDefault();
        target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
        var email = document.getElementById("email");
        if (email) email.focus({ preventScroll: true });
        else {
          var heading = target.querySelector("h2");
          if (heading) heading.focus({ preventScroll: true });
        }
      });
    });
  }

  setupExperiment();
  setupWaitlist();
  setupFocusLinks();
})();
