// js/quiz-loader.js
document.addEventListener("DOMContentLoaded", function () {
  const quizSelect = document.getElementById("quizSelect");
  const progressEl = document.getElementById("tv-progress");
  const qEl = document.getElementById("tv-question");
  const optsEl = document.getElementById("tv-options");
  const feedbackEl = document.getElementById("tv-feedback");
  const resultsEl = document.getElementById("tv-results");
  const prevBtn = document.getElementById("tv-prev");
  const nextBtn = document.getElementById("tv-next");

  // fallback status/note element
  let noteEl = document.getElementById("tv-note");
  if (!noteEl) {
    noteEl = document.createElement("div");
    noteEl.id = "tv-note";
    noteEl.setAttribute("role", "status");
    noteEl.style.marginTop = "0.5rem";
    const appContainer = document.getElementById('app-container');
    (appContainer || document.body).appendChild(noteEl);
    console.warn("tv-note not found — created fallback element.");
  }

  if (!quizSelect || !progressEl || !qEl || !optsEl || !feedbackEl || !resultsEl || !prevBtn || !nextBtn) {
    console.error("Required UI element missing:", {
      quizSelect, progressEl, qEl, optsEl, feedbackEl, resultsEl, prevBtn, nextBtn
    });
    if (progressEl) progressEl.textContent = "⚠️ UI elements இல்லை — பக்கம் சரிபார்க்கவும்.";
    return;
  }

  // --- State ---
  let quizData = [];
  let idx = 0;
  let score = 0;
  let currentQuizTitle = '';

  // --- Utility: sanitize titles (remove replacement char U+FFFD and trim) ---
  function sanitizeTitle(t) {
    if (t === undefined || t === null) return '';
    try {
      return String(t).replace(/\uFFFD/g, '').trim();
    } catch (e) {
      return String(t).trim();
    }
  }

  // --- Load categorized quiz list from server JSON (quiz-list.json) ---
  async function loadQuizList() {
    try {
      // Clear previous optgroups/options but keep placeholder (index 0)
      const placeholderIndex = 0;
      for (let i = quizSelect.options.length - 1; i >= 0; i--) {
        if (i !== placeholderIndex) quizSelect.remove(i);
      }

      const res = await fetch("quiz-list.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("quiz-list.json not found");
      const list = await res.json();

      // list expected: [{category: "மொழி", quizzes: [{file, title}, ...]}, ...]
      if (!Array.isArray(list)) throw new Error("Invalid quiz list format");

      list.forEach(categoryItem => {
        const optGroup = document.createElement("optgroup");
        optGroup.label = sanitizeTitle(categoryItem.category || "பிரிவு");

        const quizzesArr = Array.isArray(categoryItem.quizzes) ? categoryItem.quizzes : [];
        quizzesArr.forEach(quizItem => {
          // sanitize file & title
          const file = quizItem.file || quizItem.path || quizItem.url;
          const title = sanitizeTitle(quizItem.title || quizItem.name || file);
          if (!file) return;
          const opt = document.createElement("option");
          opt.value = file;
          opt.textContent = title;
          optGroup.appendChild(opt);
        });

        // only append if it has items
        if (optGroup.children.length > 0) quizSelect.appendChild(optGroup);
      });

      console.log("✅ Categorized quiz list loaded");
      quizSelect.disabled = false;
    } catch (err) {
      console.error("❌ Error loading quiz list:", err);
      progressEl.textContent = "⚠️ வினாடி–வினா பட்டியலை ஏற்ற முடியவில்லை: " + (err.message || err);
      // keep quizSelect disabled if no list
      quizSelect.disabled = true;
    }
  }

  // --- Load quiz questions from chosen file ---
  async function loadQuiz(file) {
    try {
      if (!file) throw new Error("No file specified");
      progressEl.textContent = "📥 வினாக்களை ஏற்றுகிறது…";
      const res = await fetch(file, { cache: "no-cache" });
      if (!res.ok) throw new Error(`${file} not found (${res.status})`);
      const data = await res.json();

      // Accept common shapes: {questions: [...]}, or direct array
      quizData = Array.isArray(data) ? data : (Array.isArray(data.questions) ? data.questions : []);
      if (!quizData.length) throw new Error("No questions found in quiz file");

      // initialize each question
      quizData.forEach(q => q.userChoice = undefined);

      // sanitize current title from select display
      currentQuizTitle = sanitizeTitle(quizSelect.options[quizSelect.selectedIndex]?.text || file);

      // Start timer if function exists
      if (typeof startQuizTimer === 'function') {
        startQuizTimer(quizData.length);
      } else {
        console.warn("startQuizTimer function not found. Timer won't start here.");
      }

      idx = 0;
      score = 0;

      // hide results, show question area
      if (resultsEl) resultsEl.style.display = "none";
      progressEl.style.display = 'block';
      qEl.style.display = 'block';
      optsEl.innerHTML = '';

      renderQuestion();
      console.log(`📘 Quiz loaded: ${file}`);
      progressEl.textContent = `வினா 1 / ${quizData.length}`;
      if (noteEl) noteEl.innerHTML = "🧾 வினாவை படித்து பதிலளிக்கவும்.";
    } catch (err) {
      console.error("Quiz load error:", err);
      progressEl.textContent = "⚠️ வினாக்களை ஏற்ற முடியவில்லை: " + (err.message || err);
    }
  }

  // --- Render current question ---
  function renderQuestion() {
    const q = quizData[idx];
    if (!q) {
      progressEl.textContent = "⚠️ செல்லுபடியாகாத வினா.";
      return;
    }

    const userChoice = q.userChoice;
    const hasAnswered = (userChoice !== undefined);

    progressEl.textContent = `வினா ${idx + 1} / ${quizData.length}`;
    qEl.textContent = sanitizeTitle(q.question || q.q || "வினா கிடைக்கவில்லை.");
    optsEl.innerHTML = "";
    nextBtn.style.display = "inline-block";
    prevBtn.style.display = idx > 0 ? "inline-block" : "none";

    const options = q.answerOptions || q.options || q.choices || [];
    if (!options.length) {
      optsEl.innerHTML = "<p>விருப்பங்கள் இல்லை.</p>";
      return;
    }

    // Determine correct index
    const correctIndex = (typeof q.answer === "number")
      ? q.answer
      : (Array.isArray(options) ? (options.findIndex(o => (o && o.isCorrect) || o.correct) : -1));

    options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      const label = ["(அ)", "(ஆ)", "(இ)", "(ஈ)", "(உ)"][i] || `(${i+1})`;
      const text = (typeof opt === "string") ? opt : (opt.text || opt.label || '');
      btn.innerHTML = `<strong>${label}.</strong> ${sanitizeTitle(text)}`;

      if (hasAnswered) {
        btn.disabled = true;
        if (i === correctIndex) btn.classList.add("correct");
        if (i === userChoice && userChoice !== correctIndex) btn.classList.add("wrong");
      } else {
        btn.addEventListener('click', () => selectAnswer(i, btn));
      }
      optsEl.appendChild(btn);
    });

    if (hasAnswered) {
      const explanation = sanitizeTitle(q.explanation ||
        (options[correctIndex] && options[correctIndex].rationale) ||
        "விளக்கம் வழங்கப்படவில்லை.");
      feedbackEl.style.display = "block";
      feedbackEl.innerHTML = `<strong>விளக்கம்:</strong> ${explanation}`;
      if (noteEl) noteEl.innerHTML = "✅❌ நீங்கள் ஏற்கனவே பதிலளித்த வினா.";
    } else {
      feedbackEl.style.display = "none";
      if (noteEl) noteEl.innerHTML = "🧾 வினாவை படித்து சரியான விடையைத் தேர்ந்தெடுக்கவும்.";
    }
  }

  // --- Handle answer selection ---
  function selectAnswer(choice, btn) {
    if (typeof resetInactivityTimer === 'function') resetInactivityTimer();

    const q = quizData[idx];
    if (!q || q.userChoice !== undefined) return;

    q.userChoice = choice;

    const correctIndex = (typeof q.answer === "number")
      ? q.answer
      : (q.answerOptions?.findIndex(o => o.isCorrect) ?? (q.options?.findIndex(o => o.isCorrect) ?? -1));

    const buttons = optsEl.querySelectorAll("button");
    buttons.forEach(b => b.disabled = true);

    if (choice === correctIndex) {
      score++;
      btn.classList.add("correct");
      if (noteEl) noteEl.innerHTML = "✅ சரியான விடை!";
    } else {
      btn.classList.add("wrong");
      if (buttons[correctIndex]) buttons[correctIndex].classList.add("correct");
      if (noteEl) noteEl.innerHTML = "❌ தவறான விடை.";
    }

    const explanation = sanitizeTitle(q.explanation ||
      q.answerOptions?.[correctIndex]?.rationale ||
      "விளக்கம் வழங்கப்படவில்லை.");
    feedbackEl.style.display = "block";
    feedbackEl.innerHTML = `<strong>விளக்கம்:</strong> ${explanation}`;
  }

  // --- Navigation ---
  nextBtn.addEventListener("click", () => {
    if (typeof resetInactivityTimer === 'function') resetInactivityTimer();
    if (idx < quizData.length - 1) {
      idx++;
      renderQuestion();
    } else {
      showResults();
    }
  });

  prevBtn.addEventListener("click", () => {
    if (typeof resetInactivityTimer === 'function') resetInactivityTimer();
    if (idx > 0) {
      idx--;
      renderQuestion();
    }
  });

  // --- Results ---
  function showResults() {
    // dispatch event so other scripts (dashboard) can save results
    const percentage = quizData.length ? Math.round((score / quizData.length) * 100) : 0;
    const detail = { title: currentQuizTitle || "Quiz", score: score, total: quizData.length, percentage: percentage };

    // If custom UI exists in host (showCustomResults), prefer that
    if (typeof showCustomResults === 'function') {
      showCustomResults(score, quizData.length, currentQuizTitle || 'Quiz');
    } else {
      // fallback UI
      resultsEl.style.display = "block";
      resultsEl.innerHTML = `<h3>மதிப்பெண்: ${score} / ${quizData.length}</h3>
                             <p>விழுக்காடு: ${percentage}%</p>`;
    }

    // also dispatch standardized event
    document.dispatchEvent(new CustomEvent('quiz-finished', { detail }));
    // and a second generic event for other listeners
    document.dispatchEvent(new CustomEvent('save-quiz-result', { detail }));
  }

  // --- Quiz selection handler ---
  quizSelect.addEventListener("change", (e) => {
    if (typeof resetInactivityTimer === 'function') resetInactivityTimer();
    const file = e.target.value;
    if (file) loadQuiz(file);
  });

  // --- Listen for storage updates (e.g., uploader or other tab writes quiz-list.json to localStorage) ---
  window.addEventListener('storage', (ev) => {
    if (!ev.key) return;
    // if uploader updates a key like 'quizList' then reload list
    if (ev.key === 'quizList' || ev.key === 'quiz-list') {
      try {
        const parsed = JSON.parse(ev.newValue || '[]');
        // reconstruct optgroups from parsed if formatted accordingly
        if (Array.isArray(parsed) && parsed.length) {
          // remove all existing non-placeholder options
          const placeholderIndex = 0;
          for (let i = quizSelect.options.length - 1; i >= 0; i--) {
            if (i !== placeholderIndex) quizSelect.remove(i);
          }
          parsed.forEach(categoryItem => {
            const optGroup = document.createElement("optgroup");
            optGroup.label = sanitizeTitle(categoryItem.category || "பிரிவு");
            const quizzesArr = Array.isArray(categoryItem.quizzes) ? categoryItem.quizzes : [];
            quizzesArr.forEach(quizItem => {
              const file = quizItem.file || quizItem.path;
              const title = sanitizeTitle(quizItem.title || quizItem.name || file);
              if (!file) return;
              const opt = document.createElement('option');
              opt.value = file;
              opt.textContent = title;
              optGroup.appendChild(opt);
            });
            if (optGroup.children.length > 0) quizSelect.appendChild(optGroup);
          });
        } else {
          // otherwise try to reload from quiz-list.json
          loadQuizList();
        }
      } catch (e) {
        loadQuizList();
      }
    }
  });

  // Public helper to allow manual refresh from console or uploader
  window.refreshQuizList = loadQuizList;

  // Start
  loadQuizList();
});
