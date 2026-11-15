(function () {
	"use strict";

	/* ---------------------------------------------------------
     Elements
     --------------------------------------------------------- */
	var scenes = {
		1: document.getElementById("scene1"),
		2: document.getElementById("scene2"),
		3: document.getElementById("scene3"),
	};

	var letterBody = document.getElementById("letterBody");
	var paras = Array.prototype.slice.call(
		letterBody.querySelectorAll("p[data-type]"),
	);
	var continueBtn = document.getElementById("toScene3");
	var openBtn = document.getElementById("toScene2");
	var progressBar = document.getElementById("progressBar");
	var scene2 = scenes[2];

	var reduceMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;

	var totalChars = paras.reduce(function (sum, p) {
		return sum + p.getAttribute("data-type").length;
	}, 0);

	var activeScene = 1;
	var locked = false;

	var scrollIndicator = document.getElementById("scrollIndicator");

	var audio = document.getElementById("scene2Audio");
	var audioToggleBtn = document.getElementById("audioToggle");
	var iconUnmuted = document.getElementById("iconUnmuted");
	var iconMuted = document.getElementById("iconMuted");
	var audioFadeInterval = null;

	/* ---------------------------------------------------------
     Layout stability
     Every paragraph permanently reserves the height of its FULL
     text from the very first frame, so the page never reflows
     or jumps while characters are being typed in.
     --------------------------------------------------------- */
	function reserveHeights() {
		for (var i = 0; i < paras.length; i++) {
			var p = paras[i];
			var full = p.getAttribute("data-type");
			var current = p.textContent;

			p.style.minHeight = "0px";
			p.textContent = full;
			var h = p.offsetHeight;
			p.textContent = current;

			p.style.minHeight = h + 1 + "px";
		}
	}

	reserveHeights();

	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(reserveHeights);
	}

	var resizeTimer;
	window.addEventListener(
		"resize",
		function () {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(reserveHeights, 180);
		},
		{ passive: true },
	);

	/* ---------------------------------------------------------
     Scene routing — outgoing lifts, incoming rises (crossfade)
     --------------------------------------------------------- */
	function focusContent(scene) {
		var el = scene.querySelector(".scene__content");
		if (el) {
			try {
				el.focus({ preventScroll: true });
			} catch (e) {
				el.focus();
			}
		}
	}

	function goTo(n) {
		if (locked || n === activeScene) return;
		locked = true;

		var prev = scenes[activeScene];
		var next = scenes[n];

		// Handle Audio Fading based on scene changes
		if (activeScene === 2 && n !== 2) {
			pauseAudioFadeOut();
		}
		if (n === 2) {
			playAudioFadeIn();
		}

		prev.classList.add("is-leaving");
		prev.classList.remove("is-active");

		window.setTimeout(function () {
			prev.classList.remove("is-leaving");
			prev.scrollTop = 0;

			next.classList.add("is-active");
			next.scrollTop = 0;

			activeScene = n;
			locked = false;

			focusContent(next);

			if (n === 2) startLetter();
		}, 340);
	}

	openBtn.addEventListener("click", function () {
		goTo(2);
	});
	continueBtn.addEventListener("click", function () {
		goTo(3);
	});

	/* ---------------------------------------------------------
     Typewriter state
     --------------------------------------------------------- */
	var typeTimer = null;
	var typing = false;
	var pIndex = 0;
	var cIndex = 0;
	var typedChars = 0;

	function setProgress(ratio) {
		progressBar.style.transform =
			"scaleX(" + Math.max(0, Math.min(1, ratio)).toFixed(4) + ")";
	}

	// Smooth fade-in for audio
	function playAudioFadeIn() {
		if (!audio) return;
		window.clearInterval(audioFadeInterval);
		audio.volume = 0;
		audio.play().catch(function (e) {
			console.log("Audio autoplay blocked:", e);
		});

		var vol = 0;
		audioFadeInterval = setInterval(function () {
			if (vol < 0.5) {
				// 0.5 is a comfortable background volume
				vol += 0.05;
				audio.volume = Math.min(vol, 0.5);
			} else {
				clearInterval(audioFadeInterval);
			}
		}, 100);
	}

	// Smooth fade-out for audio
	function pauseAudioFadeOut() {
		if (!audio) return;
		window.clearInterval(audioFadeInterval);
		var vol = audio.volume;

		audioFadeInterval = setInterval(function () {
			if (vol > 0.05) {
				vol -= 0.05;
				audio.volume = Math.max(vol, 0);
			} else {
				audio.pause();
				clearInterval(audioFadeInterval);
			}
		}, 100);
	}

	function updateScrollIndicator() {
		if (activeScene !== 2) return;

		// Check if there is actually content to scroll to (buffer of 20px)
		var hasOverflow = scene2.scrollHeight > scene2.clientHeight + 20;

		// Check if the user is already at the bottom (buffer of 40px)
		var isAtBottom =
			scene2.scrollTop + scene2.clientHeight >= scene2.scrollHeight - 40;

		if (hasOverflow && !isAtBottom) {
			scrollIndicator.classList.remove("is-hidden");
		} else {
			scrollIndicator.classList.add("is-hidden");
		}
	}

	function resetLetter() {
		window.clearTimeout(typeTimer);
		typing = false;
		pIndex = 0;
		cIndex = 0;
		typedChars = 0;

		for (var i = 0; i < paras.length; i++) {
			paras[i].textContent = "";
			paras[i].classList.remove("is-typing");
		}

		continueBtn.classList.add("is-hidden");
		setProgress(0);

		scene2.scrollTop = 0;
	}

	/* The letter always finishes typing at its own pace. No scroll,
     no scrollIntoView — the reader stays exactly where they are.
     The Continue button simply fades in inside its reserved slot. */
	function completeLetter() {
		window.clearTimeout(typeTimer);
		typing = false;

		for (var i = 0; i < paras.length; i++) {
			paras[i].textContent = paras[i].getAttribute("data-type");
			paras[i].classList.remove("is-typing");
		}

		pIndex = paras.length;
		typedChars = totalChars;
		setProgress(1);
		continueBtn.classList.remove("is-hidden");
	}

	/* ---------------------------------------------------------
     Typing loop — no auto-scroll, no interruptions.
     The letter always types through to the very end.
     --------------------------------------------------------- */
	function typeStep() {
		if (!typing) return;

		var p = paras[pIndex];
		if (!p) {
			completeLetter();
			return;
		}

		var text = p.getAttribute("data-type");

		if (cIndex < text.length) {
			cIndex++;
			typedChars++;
			p.textContent = text.slice(0, cIndex);
			setProgress(typedChars / totalChars);
			updateScrollIndicator();

			var ch = text.charAt(cIndex - 1);

			// EMOTIONAL PACING
			// Base speed is slower (25-45ms)
			var delay = 25 + Math.random() * 20;

			if (ch === "." || ch === "!" || ch === "?") {
				delay += 450; // Long, dramatic pause at the end of a sentence
			} else if (ch === "," || ch === ";" || ch === ":") {
				delay += 250; // Softer pause at commas
			}

			typeTimer = window.setTimeout(typeStep, delay);
			return;
		}

		// Paragraph complete
		p.classList.remove("is-typing");
		pIndex++;
		cIndex = 0;

		if (pIndex >= paras.length) {
			completeLetter();
			return;
		}

		paras[pIndex].classList.add("is-typing");
		// Longer pause between paragraphs (700ms) for emotional weight
		typeTimer = window.setTimeout(typeStep, 700);
	}

	function startLetter() {
		resetLetter();
		scrollIndicator.classList.add("is-hidden");

		if (reduceMotion) {
			completeLetter();
			return;
		}

		typing = true;
		paras[0].classList.add("is-typing");
		typeTimer = window.setTimeout(typeStep, 700); // let the scene settle first
	}

	// Mute / Unmute Toggle
	if (audioToggleBtn) {
		audioToggleBtn.addEventListener("click", function () {
			if (audio.muted) {
				audio.muted = false;
				iconUnmuted.classList.remove("is-hidden");
				iconMuted.classList.add("is-hidden");
			} else {
				audio.muted = true;
				iconUnmuted.classList.add("is-hidden");
				iconMuted.classList.remove("is-hidden");
			}
		});
	}

	/* ---------------------------------------------------------
     Pause typing while the tab is hidden, resume when back
     --------------------------------------------------------- */
	document.addEventListener("visibilitychange", function () {
		if (document.hidden) {
			if (typing) window.clearTimeout(typeTimer);
		} else if (typing) {
			typeTimer = window.setTimeout(typeStep, 400);
		}
	});

	// Make the button scroll down when clicked
	scrollIndicator.addEventListener("click", function () {
		scene2.scrollBy({
			top: scene2.clientHeight * 0.6,
			behavior: "smooth",
		});
	});

	// Listen for manual scrolling to hide/show the indicator
	scene2.addEventListener("scroll", updateScrollIndicator, { passive: true });
})();
