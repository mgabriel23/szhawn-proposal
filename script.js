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
	var paras = letterBody ? Array.prototype.slice.call(letterBody.querySelectorAll("p[data-type]")) : [];

	var continueBtn = document.getElementById("toScene3");
	var progressBar = document.getElementById("progressBar");
	var scene2 = scenes[2];

	var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

	var stageTrack = document.getElementById('stageTrack');
	var touchStartX = 0;
	var touchStartY = 0;

	var swipeHint = document.getElementById('swipeHint');
	var dots = document.querySelectorAll('.dot');
	var hintTimeout;

	/* ---------------------------------------------------------
	 Layout stability
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
	 Scene routing
	 --------------------------------------------------------- */
	function focusContent(scene) {
		if (!scene) return;
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

		// --- LEAVING SCENE 2 ---
		if (activeScene === 2 && n !== 2) {
			pauseAudio();

			if (typing) {
				window.clearTimeout(typeTimer);
				typing = false;
				var currentP = paras[pIndex];
				if (currentP) currentP.classList.remove("is-typing");
			}
		}

		// --- ENTERING SCENE 2 ---
		if (n === 2) {
			if (audioToggleBtn) audioToggleBtn.classList.add('is-visible');
			playAudio();

			if (!letterStarted) {
				startLetter();
			} else if (!letterCompleted) {
				typing = true;
				var p = paras[pIndex];
				if (p) p.classList.add("is-typing");
				typeTimer = window.setTimeout(typeStep, 500);
			}
		} else {
			if (audioToggleBtn) audioToggleBtn.classList.remove('is-visible');
		}

		if (n !== 2 && scrollIndicator) {
			scrollIndicator.classList.add("is-hidden");
		}

		// Update classes & slide
		if (prev) prev.classList.remove('is-active');
		if (next) next.classList.add('is-active');

		if (stageTrack) {
			stageTrack.style.transform = 'translateX(-' + ((n - 1) * 100) + '%)';
		}

		// Update Dots
		dots.forEach(function (dot) {
			dot.classList.remove('is-active');
			if (parseInt(dot.getAttribute('data-scene')) === n) {
				dot.classList.add('is-active');
			}
		});

		if (swipeHint) swipeHint.classList.add('is-hidden');
		window.clearTimeout(hintTimeout);
		activeScene = n;

		window.setTimeout(function () {
			locked = false;
			focusContent(next);
			if (n === 2) {
				updateScrollIndicator();
			}
		}, 850);
	}

	if (continueBtn) {
		continueBtn.addEventListener("click", function () {
			goTo(3);
		});
	}

	/* ---------------------------------------------------------
	 Typewriter state
	 --------------------------------------------------------- */
	var typeTimer = null;
	var typing = false;
	var letterStarted = false;
	var letterCompleted = false;
	var pIndex = 0;
	var cIndex = 0;
	var typedChars = 0;

	function setProgress(ratio) {
		if (progressBar) {
			progressBar.style.transform = "scaleX(" + Math.max(0, Math.min(1, ratio)).toFixed(4) + ")";
		}
	}

	function playAudio() {
		if (!audio) return;
		audio.volume = 0.5;
		audio.play().catch(function (e) {
			console.log("Audio autoplay blocked:", e);
		});
	}

	function pauseAudio() {
		if (!audio || audio.paused) return;
		audio.pause();
	}

	function updateScrollIndicator() {
		if (!scrollIndicator || !scene2) return;
		if (activeScene !== 2) {
			scrollIndicator.classList.add('is-hidden');
			return;
		}

		var hasOverflow = scene2.scrollHeight > scene2.clientHeight + 20;
		var isAtBottom = scene2.scrollTop + scene2.clientHeight >= scene2.scrollHeight - 40;

		if (hasOverflow && !isAtBottom) {
			scrollIndicator.classList.remove('is-hidden');
		} else {
			scrollIndicator.classList.add('is-hidden');
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

		if (continueBtn) continueBtn.classList.add("is-hidden");
		setProgress(0);

		if (scene2) scene2.scrollTop = 0;
	}

	function completeLetter() {
		window.clearTimeout(typeTimer);
		typing = false;
		letterCompleted = true;

		for (var i = 0; i < paras.length; i++) {
			paras[i].textContent = paras[i].getAttribute("data-type");
			paras[i].classList.remove("is-typing");
		}

		pIndex = paras.length;
		typedChars = totalChars;
		setProgress(1);
		if (continueBtn) continueBtn.classList.remove("is-hidden");
	}

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
			var delay = 25 + Math.random() * 20;

			if (ch === "." || ch === "!" || ch === "?") {
				delay += 450;
			} else if (ch === "," || ch === ";" || ch === ":") {
				delay += 250;
			}

			typeTimer = window.setTimeout(typeStep, delay);
			return;
		}

		p.classList.remove("is-typing");
		pIndex++;
		cIndex = 0;

		if (pIndex >= paras.length) {
			completeLetter();
			return;
		}

		paras[pIndex].classList.add("is-typing");
		typeTimer = window.setTimeout(typeStep, 700);
	}

	function startLetter() {
		letterStarted = true;
		letterCompleted = false;
		resetLetter();

		if (reduceMotion) {
			completeLetter();
			return;
		}

		typing = true;
		if (paras[0]) paras[0].classList.add("is-typing");
		typeTimer = window.setTimeout(typeStep, 700);
	}

	if (audioToggleBtn && audio && iconUnmuted && iconMuted) {
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

	document.addEventListener("visibilitychange", function () {
		if (document.hidden) {
			if (typing) window.clearTimeout(typeTimer);
		} else if (typing) {
			typeTimer = window.setTimeout(typeStep, 400);
		}
	});

	if (scrollIndicator && scene2) {
		scrollIndicator.addEventListener("click", function () {
			scene2.scrollBy({
				top: scene2.clientHeight * 0.6,
				behavior: "smooth",
			});
		});
	}

	if (scene2) {
		scene2.addEventListener("scroll", updateScrollIndicator, { passive: true });
	}

	/* ---------------------------------------------------------
	 Manual Carousel Controls (Swipe & Keyboard)
	 --------------------------------------------------------- */
	var stageEl = document.querySelector('.stage');
	if (stageEl) {
		stageEl.addEventListener('touchstart', function (e) {
			touchStartX = e.changedTouches[0].screenX;
			touchStartY = e.changedTouches[0].screenY;
		}, { passive: true });

		stageEl.addEventListener('touchend', function (e) {
			var touchEndX = e.changedTouches[0].screenX;
			var touchEndY = e.changedTouches[0].screenY;

			var diffX = touchEndX - touchStartX;
			var diffY = touchEndY - touchStartY;

			if (Math.abs(diffX) < Math.abs(diffY) || Math.abs(diffX) < 60) return;

			if (diffX < -60 && activeScene < 3) {
				goTo(activeScene + 1);
			} else if (diffX > 60 && activeScene > 1) {
				goTo(activeScene - 1);
			}
		}, { passive: true });
	}

	document.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowRight' && activeScene < 3) {
			goTo(activeScene + 1);
		} else if (e.key === 'ArrowLeft' && activeScene > 1) {
			goTo(activeScene - 1);
		}
	});

	/* ---------------------------------------------------------
	 Dot Navigation & Swipe Hint
	 --------------------------------------------------------- */
	dots.forEach(function (dot) {
		dot.addEventListener('click', function () {
			var target = parseInt(this.getAttribute('data-scene'));
			goTo(target);
		});
	});

	hintTimeout = setTimeout(function () {
		if (swipeHint) swipeHint.classList.add('is-hidden');
	}, 6000);
})();